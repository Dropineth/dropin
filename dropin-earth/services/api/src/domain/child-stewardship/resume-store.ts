import { assertChildRestoreReady, PostgresChildStore, type ChildSqlClient, type ChildRestoreAnchorProvider } from "./postgres-store.js";
import { ChildApiError } from "./store.js";
import type { LearningRole } from "./learning-types.js";

export type ChildSuspension = { resumeTicket: string; sessionId: string; expiresAt: string; syntheticOnly: true };
export type ChildResumption = { sessionId: string; expiresAt: string; tokens: Record<LearningRole,string>; syntheticOnly: true; identityVerified: false };
export type ChildResumeCancellation={cancelled:true;syntheticOnly:true};
export interface ChildResumeStore {
  ready(): Promise<boolean>;
  suspend(rawBearer: string): Promise<ChildSuspension>;
  resume(rawTicket: string): Promise<ChildResumption>;
  cancel(rawTicket:string):Promise<ChildResumeCancellation>;
}

/** Native, atomic capability redemption. Raw bearer/ticket is hashed inside the
 * SECURITY DEFINER function, never replaced by caller-asserted actor/hash/GUC.
 * Rejected current-state/expiry checks consume an identified ticket durably.
 */
export class PostgresChildResumeStore implements ChildResumeStore {
  constructor(private readonly client: ChildSqlClient,private readonly restoreAnchor?:ChildRestoreAnchorProvider) {}
  async ready(): Promise<boolean> {
    try {
      if (!await new PostgresChildStore(this.client,this.restoreAnchor).ready()) return false;
      const rows=await this.client.query<{ready:boolean}>(`SELECT
        to_regprocedure('child_stewardship.suspend_synthetic_session(text)') IS NOT NULL
        AND to_regprocedure('child_stewardship.resume_synthetic_session(text)') IS NOT NULL
        AND to_regprocedure('child_stewardship.cancel_synthetic_resume(text)') IS NOT NULL
        AND to_regprocedure('child_stewardship.resume_capability_session(text)') IS NOT NULL
        AND to_regprocedure('child_stewardship.consume_child_capability_limit(text,text)') IS NOT NULL
        AND to_regprocedure('child_stewardship.consume_child_scoped_limit(text,text)') IS NOT NULL
        AND to_regclass('child_stewardship.resume_mints') IS NOT NULL AS ready`);
      return rows[0]?.ready===true;
    }catch{return false;}
  }
  async suspend(rawBearer:string):Promise<ChildSuspension> {
    if(!/^cp-demo\.[A-Za-z0-9_-]{43}$/.test(rawBearer))throw new ChildApiError("UNAUTHORIZED",401);
    const rows=await this.redeem<ChildSuspension>(rawBearer,'suspend');
    const result=rows[0]?.result;
    if(!result||"denied" in result)throw new ChildApiError("UNAUTHORIZED",401);
    return result;
  }
  async resume(rawTicket:string):Promise<ChildResumption> {
    if(!/^cp-resume\.[A-Za-z0-9_-]{43}$/.test(rawTicket))throw new ChildApiError("UNAUTHORIZED",401);
    const rows=await this.redeem<ChildResumption>(rawTicket,'resume');
    const result=rows[0]?.result;
    // The SQL statement has committed consumption before this error is thrown.
    if(!result||"denied" in result)throw new ChildApiError("UNAUTHORIZED",401);
    return result;
  }
  private async redeem<T extends ChildSuspension|ChildResumption>(raw:string,operation:'suspend'|'resume'):Promise<{result:T|{denied:true}}[]>{
    const schema=await this.client.query<{lookup:boolean}>("SELECT to_regprocedure('child_stewardship.resume_capability_session(text)') IS NOT NULL AS lookup");
    if(!schema[0]?.lookup)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
    const quota=await this.client.query<{status:string}>('SELECT child_stewardship.consume_child_capability_limit($1,$2) AS status',[operation==='suspend'?'session_suspend':'session_resume',raw]);
    const status=quota[0]?.status;
    if(status!=='allowed')throw new ChildApiError(status==='limited'?'RATE_LIMITED':status==='unauthorized'?'UNAUTHORIZED':'SERVICE_UNAVAILABLE',status==='limited'?429:status==='unauthorized'?401:503);
    return this.client.transaction(async db=>{
      const installed=await db.query<{lookup:boolean;restore:boolean;anchor:boolean}>(`SELECT
        to_regprocedure('child_stewardship.resume_capability_session(text)') IS NOT NULL AS lookup,
        to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS restore,
        to_regprocedure('child_stewardship.restore_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor`);
      if(!installed[0]?.lookup||this.restoreAnchor&&(!installed[0].restore||!installed[0].anchor))throw new ChildApiError('RESTORATION_UNVERIFIED',503);
      const proof=await db.query<{session_id:string|null}>('SELECT child_stewardship.resume_capability_session($1)::text AS session_id',[raw]);
      if(!proof[0]?.session_id)throw new ChildApiError('UNAUTHORIZED',401);
      const sessionId=proof[0].session_id;
      await db.query("SELECT set_config('app.child_session_id',$1,true)",[sessionId]);
      await db.query('SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid FOR UPDATE',[sessionId]);
      await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
      return db.query<{result:T|{denied:true}}>(operation==='suspend'?'SELECT child_stewardship.suspend_synthetic_session($1) AS result':'SELECT child_stewardship.resume_synthetic_session($1) AS result',[raw]);
    });
  }
  async cancel(rawTicket:string):Promise<ChildResumeCancellation>{
    const rows=await this.client.query<{result:ChildResumeCancellation}>("SELECT child_stewardship.cancel_synthetic_resume($1) AS result",[rawTicket]);
    if(!rows[0]?.result)throw new ChildApiError("SERVICE_UNAVAILABLE",503);
    return rows[0].result;
  }
}
