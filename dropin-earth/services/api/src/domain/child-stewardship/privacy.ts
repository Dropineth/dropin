import type { ChildSqlClient, ChildSqlConnection, ChildRestoreAnchorProvider } from './postgres-store.js';
import { assertChildRestoreReady, assertChildRestoreCleanupReady, reconstructChildSnapshot } from './postgres-store.js';
import { readChildLearningView } from './learning.js';
import { ChildApiError } from './store.js';

type Job={request_id:string;profile_id:string;requested_by:string;kind:'export_learning'|'delete_learning';state:string};
type Resource={domain:'learning'|'object';collection:string;record_id:string;payload_digest:string;payload?:Record<string,unknown>;purpose?:string;external?:boolean;expires_at?:Date|null};
const collections=['profiles','guardianLinks','consents','assignments','observations','reviews','assessments','disputes'];
/** A separately provisioned worker processes the durable inventory. This native
 * adapter really removes its own stored copies; external processor entries stay
 * pending without an actual registered provider. No production worker is enabled.
 */
export class ChildPrivacyWorker {
  constructor(private readonly client:ChildSqlClient,private readonly exportRetentionMs=3_600_000,
    private readonly restoreAnchor?:ChildRestoreAnchorProvider) {
    if(!Number.isSafeInteger(exportRetentionMs)||exportRetentionMs<1||exportRetentionMs>3_600_000)throw new ChildApiError('RETENTION_POLICY_INVALID');
  }
  /** A credential boundary, not SET ROLE on a migration-owner connection. */
  async ready():Promise<boolean> {
    try{
      if(!await this.identityReady(this.client))return false;
      const restore=await this.client.query<{installed:boolean;anchor_function:boolean;cleanup_function:boolean}>("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS installed,to_regprocedure('child_stewardship.restore_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor_function,to_regprocedure('child_stewardship.restore_cleanup_permitted(uuid)') IS NOT NULL AND to_regprocedure('child_stewardship.restore_cleanup_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS cleanup_function");
      return restore[0]?.installed?typeof this.restoreAnchor==='function'&&restore[0].anchor_function&&restore[0].cleanup_function:!this.restoreAnchor;
    }catch{return false;}
  }
  private async identityReady(db:ChildSqlConnection):Promise<boolean> {
    const rows=await db.query<{ready:boolean}>(`WITH latest AS (
      SELECT DISTINCT ON(actor_role) actor_role,enabled,expires_at FROM child_stewardship.service_role_scopes
      WHERE database_role=current_user ORDER BY actor_role,scope_version DESC
    ) SELECT current_user=session_user
      AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
      AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(c.relowner)=current_user)
      AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=current_user)
      AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname<>current_user AND pg_has_role(current_user,r.oid,'MEMBER'))
      AND coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.privacy_worker_roles
        WHERE database_role=current_user ORDER BY scope_version DESC LIMIT 1),false)
      AND NOT EXISTS(SELECT 1 FROM latest WHERE enabled AND expires_at>clock_timestamp()) AS ready`);
    if(rows[0]?.ready!==true)return false;
    // Optional modules may be installed independently. An installed registry must
    // be readable; inability to establish separation fails closed.
    const optional=await db.query<{media:boolean;webauthn:boolean}>(`SELECT
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='media_roles') AS media,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship_webauthn' AND c.relname='verifier_roles') AS webauthn`);
    if(optional[0]?.media&&(await db.query(`SELECT 1 FROM (SELECT DISTINCT ON(scope) enabled,expires_at FROM child_stewardship.media_roles WHERE database_role=current_user ORDER BY scope,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp()`)).length)return false;
    if(optional[0]?.webauthn&&(await db.query(`SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp()`)).length)return false;
    return true;
  }
  private async assertIdentity(db:ChildSqlConnection):Promise<void> {
    try{if(await this.identityReady(db))return;}catch{/* Missing identity evidence is never permission. */}
    throw new ChildApiError('PRIVACY_WORKER_IDENTITY_UNAVAILABLE',503);
  }
  /** Bounded drain over durable jobs. A deployment still needs an approved
   * scheduler and provider adapters; neither is enabled by this method. */
  async processSession(sessionId:string,limit=25):Promise<{processed:number;completed:number;waiting:number;exportsExpired:number;more:boolean}> {
    if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ChildApiError('PRIVACY_BATCH_INVALID');
    const jobs=await this.client.transaction(async db=>{
      await this.assertIdentity(db);
      await db.query("SELECT set_config('app.child_session_id',$1,true)",[sessionId]);
      await db.query('SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid FOR UPDATE',[sessionId]);
      await this.assertIdentity(db);
      await assertChildRestoreCleanupReady(db,sessionId,this.restoreAnchor);
      return db.query<{request_id:string}>(`SELECT request_id FROM child_stewardship.privacy_jobs
        WHERE session_id=$1::uuid AND (kind='delete_learning' OR EXISTS(SELECT 1 FROM child_stewardship.sessions s WHERE s.id=session_id AND s.expires_at>clock_timestamp()))
          AND (state<>'completed' OR child_stewardship.privacy_retention_due(session_id,request_id))
        ORDER BY CASE state WHEN 'requested' THEN 0 WHEN 'processing' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,request_id LIMIT $2`,[sessionId,limit+1]);
    });
    const exportsExpired=await this.expireExports(sessionId,limit);
    let completed=0,waiting=0;
    for(const job of jobs.slice(0,limit)){const result=await this.process(sessionId,job.request_id);if(result.state==='completed')completed++;else waiting++;}
    return {processed:completed+waiting,completed,waiting,exportsExpired,more:jobs.length>limit||exportsExpired===limit};
  }
  async expireExports(sessionId:string,limit=100):Promise<number> {
    if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ChildApiError('PRIVACY_BATCH_INVALID');
    return this.client.transaction(async db=>{
      await this.assertIdentity(db);
      await db.query("SELECT set_config('app.child_session_id',$1,true)",[sessionId]);
      await db.query("SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid FOR UPDATE",[sessionId]);
      await this.assertIdentity(db);
      await assertChildRestoreCleanupReady(db,sessionId,this.restoreAnchor);
      const expired=await db.query<{request_id:string;object_id:string}>(`SELECT j.request_id,o.object_id FROM child_stewardship.privacy_objects o
        JOIN child_stewardship.privacy_jobs j ON j.session_id=o.session_id AND o.object_id='export:'||j.request_id
        WHERE o.session_id=$1::uuid AND o.kind='export' AND o.purpose='learning' AND NOT o.external
          AND o.expires_at<=clock_timestamp() AND j.kind='export_learning' AND j.state='completed' ORDER BY j.request_id LIMIT $2`,[sessionId,limit]);
      for(const item of expired){
        await db.query("SELECT set_config('app.child_privacy_request_id',$1,true)",[item.request_id]);
        await db.query("DELETE FROM child_stewardship.privacy_objects WHERE session_id=$1::uuid AND object_id=$2",[sessionId,item.object_id]);
      }
      await assertChildRestoreCleanupReady(db,sessionId,this.restoreAnchor);
      return expired.length;
    });
  }
  async process(sessionId:string,requestId:string):Promise<{state:string}> {
    return this.client.transaction(async db=>{
      await this.assertIdentity(db);
      await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_privacy_request_id',$2,true)",[sessionId,requestId]);
      const sessions=await db.query<{revision:string}>("SELECT revision::text FROM child_stewardship.sessions WHERE id=$1::uuid AND storage_format='normalized-v2' FOR UPDATE",[sessionId]);
      if(!sessions[0]) throw new ChildApiError('AUTHORITY_UNAVAILABLE',503);
      await this.assertIdentity(db);
      const jobs=await db.query<Job&Record<string,unknown>>("SELECT request_id,profile_id,requested_by,kind,state FROM child_stewardship.privacy_jobs WHERE session_id=$1::uuid AND request_id=$2 FOR UPDATE",[sessionId,requestId]);
      const job=jobs[0];if(!job)throw new ChildApiError('FORBIDDEN',403);
      await (job.kind==='export_learning'?assertChildRestoreReady:assertChildRestoreCleanupReady)(db,sessionId,this.restoreAnchor);
      if(job.state==='completed'&&!(await db.query<{due:boolean}>("SELECT child_stewardship.privacy_retention_due($1::uuid,$2) AS due",[sessionId,requestId]))[0]?.due)return {state:'completed'};
      await db.query("UPDATE child_stewardship.privacy_jobs SET state='processing',completed_at=NULL WHERE session_id=$1::uuid AND request_id=$2",[sessionId,requestId]);
      if(job.kind==='export_learning')return this.export(db,sessionId,job,Number(sessions[0].revision));
      const held=(await db.query<{held:boolean}>("SELECT child_stewardship.privacy_profile_held($1::uuid,$2) AS held",[sessionId,job.profile_id]))[0]!.held;
      const records=await db.query<Resource&Record<string,unknown>>(`SELECT 'learning' AS domain,collection,record_id,payload,
        encode(sha256(convert_to(payload::text,'UTF8')),'hex') AS payload_digest
        FROM child_stewardship.state_records WHERE session_id=$1::uuid AND domain='learning' AND collection=ANY($3::text[])
        AND child_stewardship.privacy_record_belongs_to(session_id,collection,record_id,$2)`,[sessionId,job.profile_id,collections]);
      const objects=await db.query<Resource&Record<string,unknown>>(`SELECT 'object' AS domain,kind AS collection,object_id AS record_id,purpose,external,expires_at,
        encode(sha256(coalesce(content,''::bytea)),'hex') AS payload_digest
        FROM child_stewardship.privacy_objects WHERE session_id=$1::uuid AND profile_id=$2`,[sessionId,job.profile_id]);
      for(const resource of [...records,...objects]) {
        let reason='purpose_ended';
        if(resource.purpose==='protection'||resource.collection==='disputes'&&resource.payload?.kind==='protection')reason='protection_retention';
        else if(resource.purpose==='rights')reason='rights_retention';
        else if(resource.external)reason='processor_unavailable';
        else if(resource.collection==='backup'&&resource.expires_at&&resource.expires_at.getTime()>Date.now())reason='backup_unexpired';
        else if(held)reason='legal_hold';
        await db.query(`INSERT INTO child_stewardship.privacy_plan_items(session_id,request_id,domain,collection,record_id,payload_digest,action,reason)
          VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,[sessionId,requestId,resource.domain,resource.collection,resource.record_id,resource.payload_digest,reason==='purpose_ended'?'erase':'retain',reason]);
      }
      // Plans are immutable and retain the original payload digest across crashes.
      const items=await db.query<{domain:string;collection:string;record_id:string;reason:string;action:string}>("SELECT domain,collection,record_id,reason,action FROM child_stewardship.privacy_plan_items WHERE session_id=$1::uuid AND request_id=$2",[sessionId,requestId]);
      await assertChildRestoreCleanupReady(db,sessionId,this.restoreAnchor);
      let erasedRecords=0;
      for(const item of items) {
        if(item.action!=='erase'&&item.reason!=='backup_unexpired'&&item.reason!=='legal_hold')continue;
        if(held)continue;
        if(item.reason==='legal_hold'){
          const resource=[...records,...objects].find(r=>r.domain===item.domain&&r.collection===item.collection&&r.record_id===item.record_id);
          if(!resource||held||resource.external||resource.purpose==='rights'||resource.purpose==='protection'||resource.payload?.kind==='protection'||resource.collection==='backup'&&resource.expires_at&&resource.expires_at.getTime()>Date.now())continue;
        }
        if(item.domain==='learning') {
          const removed=await db.query("DELETE FROM child_stewardship.state_records WHERE session_id=$1::uuid AND domain='learning' AND collection=$2 AND record_id=$3 RETURNING record_id",[sessionId,item.collection,item.record_id]);
          erasedRecords+=removed.length;
        } else {
          await db.query("DELETE FROM child_stewardship.privacy_objects WHERE session_id=$1::uuid AND object_id=$2 AND (kind<>'backup' OR expires_at<=clock_timestamp())",[sessionId,item.record_id]);
        }
      }
      if(erasedRecords)await db.query("UPDATE child_stewardship.sessions SET revision=revision+1 WHERE id=$1::uuid",[sessionId]);
      const pending=await db.query(`SELECT 1 FROM child_stewardship.privacy_plan_items i WHERE i.session_id=$1::uuid AND i.request_id=$2
        AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_receipts r WHERE r.session_id=i.session_id AND r.request_id=i.request_id
          AND r.resource_kind=CASE i.domain WHEN 'object' THEN 'object' ELSE 'record' END
          AND r.resource_ref=CASE i.domain WHEN 'object' THEN i.record_id ELSE i.collection||'/'||i.record_id END
          AND r.content_digest=i.payload_digest AND (r.outcome='deleted' OR r.outcome='retained' AND child_stewardship.privacy_retention_valid(i.session_id,i.request_id,i.domain,i.collection,i.record_id))) LIMIT 1`,[sessionId,requestId]);
      const state=pending.length?'waiting':'completed';
      await assertChildRestoreCleanupReady(db,sessionId,this.restoreAnchor);
      await db.query("UPDATE child_stewardship.privacy_jobs SET state=$3,completed_at=CASE WHEN $3='completed' THEN clock_timestamp() ELSE NULL END WHERE session_id=$1::uuid AND request_id=$2",[sessionId,requestId,state]);
      return {state};
    });
  }
  private async export(db:ChildSqlConnection,sessionId:string,job:Job,revision:number):Promise<{state:string}> {
    await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
    if((await db.query("SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=$1::uuid AND profile_id=$2",[sessionId,job.profile_id])).length)throw new ChildApiError('PRIVACY_SUPPRESSED',403);
    const rows=await db.query<{domain:string;collection:string;record_id:string;payload:unknown;position:number}>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[sessionId]);
    const snapshot=reconstructChildSnapshot(rows,revision);
    const actor=snapshot.learning.actors[job.requested_by];if(!actor?.deviceIds[0])throw new ChildApiError('UNAUTHORIZED',401);
    await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
    const view=readChildLearningView(snapshot.learning,{actorId:actor.id,deviceId:actor.deviceIds[0],epoch:actor.epoch},new Date().toISOString());
    // The export is an explicit ordinary-learning projection, never a raw snapshot,
    // protection inbox, internal audit, token, canonical alias or R/F data export.
    const assignments=new Set(view.assignments.filter(a=>a.profileId===job.profile_id).map(a=>a.id));
    const observations=view.observations.filter(o=>assignments.has(o.assignmentId));
    const observationIds=new Set(observations.map(o=>o.id));
    const artifact={schema:'CanopyProof-SyntheticLearningExport/1',syntheticOnly:true,profiles:view.profiles.filter(p=>p.id===job.profile_id),observations,reviews:view.reviews.filter(r=>observationIds.has(r.observationId)),contributions:view.contributions.filter(c=>observationIds.has(c.sourceObservationId)),disputes:view.disputes.filter(d=>d.kind!=='protection'&&d.profileId===job.profile_id),rightsAndFundsUnchanged:true};
    await db.query(`INSERT INTO child_stewardship.privacy_objects(session_id,object_id,profile_id,purpose,kind,content,expires_at,external)
      VALUES($1::uuid,$2,$3,'learning','export',$4,clock_timestamp()+$5*interval '1 millisecond',false)`,[sessionId,`export:${job.request_id}`,job.profile_id,Buffer.from(JSON.stringify(artifact)),this.exportRetentionMs]);
    await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
    await db.query("UPDATE child_stewardship.privacy_jobs SET state='completed',completed_at=clock_timestamp() WHERE session_id=$1::uuid AND request_id=$2",[sessionId,job.request_id]);
    return {state:'completed'};
  }
}
