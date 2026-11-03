import { ChildApiError } from './store.js';
import type { LearningPrincipal } from './learning-types.js';
import { assertChildRestoreReady, type ChildRestoreAnchorProvider, type ChildSqlClient, type ChildSqlConnection } from './postgres-store.js';

export type GuardianTransactionAuthorization = { guardianToken: string };
type GuardianIdentity = {sessionId:string;principal:LearningPrincipal};
const bearer = /^cp-guardian\.[A-Za-z0-9_-]{43}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Must run within the existing domain transaction, after the tenant lock and
 * immediately before execution/release. Middleware authentication is not enough. */
export async function authorizeGuardianTransaction(db:ChildSqlConnection,sessionId:string,authorization:GuardianTransactionAuthorization):Promise<GuardianIdentity> {
  if(!bearer.test(authorization.guardianToken))throw new ChildApiError('UNAUTHORIZED',401);
  const rows=await db.query<{identity:GuardianIdentity|null}>(
    'SELECT child_stewardship_guardian.authorize($1,$2::uuid) AS identity',[authorization.guardianToken,sessionId]);
  const identity=rows[0]?.identity;
  if(!identity||identity.sessionId!==sessionId)throw new ChildApiError('UNAUTHORIZED',401);
  return identity;
}
/** Durable guardian-only product sessions. The bridge consumes a recently
 * verified WebAuthn authentication exactly once, only against an independently
 * provisioned binding. The current adapter accepts synthetic accounts only.
 * It does not establish legal identity, guardianship or recovery authority. */
export class PostgresGuardianSessions {
  constructor(private readonly client:ChildSqlClient,private readonly restoreAnchor?:ChildRestoreAnchorProvider){}
  private async scope(db:ChildSqlConnection,raw:string,binding:string|null):Promise<string> {
    const rows=await db.query<{id:string|null}>('SELECT child_stewardship_guardian.capability_session($1,$2::uuid)::text AS id',[raw,binding]);
    const id=rows[0]?.id;if(!id)throw new ChildApiError('UNAUTHORIZED',401);
    await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','guardian',true)",[id]);
    const locked=await db.query('SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid FOR UPDATE',[id]);
    if(!locked.length)throw new ChildApiError('UNAUTHORIZED',401);
    await assertChildRestoreReady(db,id,this.restoreAnchor);
    return id;
  }
  async exchange(input:unknown):Promise<GuardianIdentity&{sessionToken:string;expiresAt:string;syntheticOnly:true;identityVerified:false}> {
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='authenticationToken,bindingId')throw new ChildApiError('INVALID_INPUT');
    const {authenticationToken,bindingId}=input as Record<string,unknown>;
    if(typeof authenticationToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(authenticationToken)||typeof bindingId!=='string'||!uuid.test(bindingId))throw new ChildApiError('INVALID_INPUT');
    return this.client.transaction(async db=>{
      await this.scope(db,authenticationToken,bindingId);
      const rows=await db.query<{result:(GuardianIdentity&{sessionToken:string;expiresAt:string;syntheticOnly:true;identityVerified:false})|null}>(
        'SELECT child_stewardship_guardian.exchange($1,$2::uuid) AS result',[authenticationToken,bindingId]);
      if(!rows[0]?.result)throw new ChildApiError('UNAUTHORIZED',401);
      return rows[0].result;
    });
  }
  async resolve(raw:string):Promise<GuardianIdentity> {
    if(!bearer.test(raw))throw new ChildApiError('UNAUTHORIZED',401);
    return this.client.transaction(async db=>authorizeGuardianTransaction(db,await this.scope(db,raw,null),{guardianToken:raw}));
  }
  async logout(raw:string):Promise<void> {
    if(!bearer.test(raw))throw new ChildApiError('UNAUTHORIZED',401);
    await this.client.transaction(async db=>{
      const id=await this.scope(db,raw,null);
      const rows=await db.query<{accepted:boolean}>('SELECT child_stewardship_guardian.logout($1,$2::uuid) AS accepted',[raw,id]);
      if(rows[0]?.accepted!==true)throw new ChildApiError('UNAUTHORIZED',401);
    });
  }
}
