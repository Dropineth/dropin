import { ChildApiError, childDigest, stableJson, tokenDigest, type ChildStore, type ChildSnapshot, type ChildReceipt, type ChildTransaction, type DemoSession, type DemoToken } from "./store.js";
import type { LearningPrincipal,LearningActor } from './learning-types.js';
import { admittedRightsRecordedAt } from './rights.js';

export interface ChildSqlConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]>;
}
export interface ChildSqlClient extends ChildSqlConnection {
  transaction<T>(run: (connection: ChildSqlConnection) => Promise<T>): Promise<T>;
}
/** Must come from independently current deployment configuration, never the
 * restored database or a browser request. Its digest covers the signed checkpoint. */
export type ChildRestoreAnchor={checkpointId:string;sequence:number;digest:string};
export type ChildRestoreAnchorProvider=(sessionId:string)=>Promise<ChildRestoreAnchor>;
export async function assertChildRestoreReady(db:ChildSqlConnection,sessionId:string,provider?:ChildRestoreAnchorProvider):Promise<void>{
  const installed=await db.query<{installed:boolean;anchor_function:boolean}>("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS installed,to_regprocedure('child_stewardship.restore_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor_function");
  if(!installed[0]?.installed){if(provider)throw new ChildApiError('RESTORATION_UNVERIFIED',503);return;}
  if(!installed[0].anchor_function)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
  let anchor:ChildRestoreAnchor|undefined;
  try{anchor=await provider?.(sessionId);}catch{throw new ChildApiError('RESTORATION_UNVERIFIED',503);}
  if(!anchor||!Number.isSafeInteger(anchor.sequence)||anchor.sequence<1||!/^[a-f0-9]{64}$/.test(anchor.digest)||!anchor.checkpointId)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
  const rows=await db.query<{permitted:boolean}>("SELECT child_stewardship.restore_execution_permitted($1::uuid) AND child_stewardship.restore_anchor_current($1::uuid,$2,$3::bigint,$4) AS permitted",[sessionId,anchor.checkpointId,anchor.sequence,anchor.digest]);
  if(rows[0]?.permitted!==true)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
}
/** Retention cleanup still requires independently current evidence, but does not
 * grant interactive access to an expired session. Export uses the stricter gate. */
export async function assertChildRestoreCleanupReady(db:ChildSqlConnection,sessionId:string,provider?:ChildRestoreAnchorProvider):Promise<void>{
  const installed=await db.query<{installed:boolean;cleanup_function:boolean;anchor_function:boolean}>("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS installed,to_regprocedure('child_stewardship.restore_cleanup_permitted(uuid)') IS NOT NULL AS cleanup_function,to_regprocedure('child_stewardship.restore_cleanup_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor_function");
  if(!installed[0]?.installed){if(provider)throw new ChildApiError('RESTORATION_UNVERIFIED',503);return;}
  if(!installed[0].cleanup_function||!installed[0].anchor_function)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
  let anchor:ChildRestoreAnchor|undefined;
  try{anchor=await provider?.(sessionId);}catch{throw new ChildApiError('RESTORATION_UNVERIFIED',503);}
  if(!anchor||!Number.isSafeInteger(anchor.sequence)||anchor.sequence<1||!/^[a-f0-9]{64}$/.test(anchor.digest)||!anchor.checkpointId)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
  const rows=await db.query<{permitted:boolean}>("SELECT child_stewardship.restore_cleanup_permitted($1::uuid) AND child_stewardship.restore_cleanup_anchor_current($1::uuid,$2,$3::bigint,$4) AS permitted",[sessionId,anchor.checkpointId,anchor.sequence,anchor.digest]);
  if(rows[0]?.permitted!==true)throw new ChildApiError('RESTORATION_UNVERIFIED',503);
}
type StateRecord = { domain: string; collection: string; record_id: string; payload: unknown; position: number };
/** Advance the server's supplied clock through lock waits; never backdate execution. */
export function childExecutionTime(requestedAt:string,started:number):string {
  return new Date(Math.max(Date.now(),Date.parse(requestedAt)+performance.now()-started)).toISOString();
}
const learningCollections = ['actors','profiles','guardianLinks','consents','trees','tasks','assignments','observations','reviews','assessments','contributions','disputes','aliases','audit','outbox','privacyRequests','idempotency'];
export function normalizeChildSnapshot(snapshot: ChildSnapshot): StateRecord[] {
  const records: StateRecord[] = [];
  for (const domain of ['learning','rights'] as const) {
    const state = snapshot[domain] as unknown as Record<string, unknown>;
    const meta: Record<string, unknown> = {};
    const arrays: string[] = [];
    for (const [collection, value] of Object.entries(state)) {
      if (domain === 'learning' && !learningCollections.includes(collection) || domain === 'rights' && ['schemaVersion','mode'].includes(collection)) { meta[collection] = value; continue; }
      if (Array.isArray(value)) {
        arrays.push(collection);
        value.forEach((payload, position) => {
          const identity = typeof payload === 'string' ? payload : payload.id ?? payload.operationId;
          if (typeof identity !== 'string') throw new ChildApiError('INVALID_STATE', 503);
          records.push({ domain, collection, record_id: identity, payload, position });
        });
      } else if (value && typeof value === 'object') {
        for (const [record_id, payload] of Object.entries(value)) records.push({ domain, collection, record_id, payload, position: 0 });
      } else throw new ChildApiError('INVALID_STATE', 503);
    }
    meta.collections = Object.keys(state).filter(key => !(key in meta));
    meta.arrays = arrays;
    records.push({ domain, collection: 'meta', record_id: 'current', payload: meta, position: 0 });
  }
  if (snapshot.rightsContext) records.push({ domain: 'rights', collection: 'securityContext', record_id: 'current', payload: snapshot.rightsContext, position: 0 });
  return records;
}
export function reconstructChildSnapshot(records: StateRecord[], revision: number): ChildSnapshot {
  const snapshot: Record<string, unknown> = { version: revision };
  for (const domain of ['learning','rights']) {
    const meta = records.find(r => r.domain === domain && r.collection === 'meta')?.payload as Record<string, unknown> | undefined;
    if (!meta || !Array.isArray(meta.collections) || !Array.isArray(meta.arrays)) throw new ChildApiError('AUTHORITY_UNAVAILABLE', 503);
    const { collections, arrays, ...state } = meta;
    for (const collection of collections as string[]) {
      const rows = records.filter(r => r.domain === domain && r.collection === collection).sort((a,b) => a.position-b.position);
      state[collection] = arrays.includes(collection) ? rows.map(r => r.payload) : Object.fromEntries(rows.map(r => [r.record_id,r.payload]));
    }
    snapshot[domain] = state;
  }
  const context = records.find(r => r.domain === 'rights' && r.collection === 'securityContext');
  if (context) snapshot.rightsContext = context.payload;
  return snapshot as ChildSnapshot;
}
async function scope(db: ChildSqlConnection, sessionId: string, role: string, operation: string, operationId = '') {
  await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role',$2,true),set_config('app.child_operation',$3,true),set_config('app.child_operation_id',$4,true)",[sessionId,role,operation,operationId]);
}
const recordKey = (record: StateRecord) => `${record.domain}/${record.collection}/${record.record_id}`;
async function lockedGeneration(db:ChildSqlConnection,sessionId:string):Promise<number> {
  const schema=await db.query<{installed:boolean}>("SELECT to_regclass('child_stewardship.session_resumption') IS NOT NULL AS installed");
  if(!schema[0]?.installed)return 0;
  const rows=await db.query<{generation:string;state:string}>("SELECT generation::text,state FROM child_stewardship.session_resumption WHERE session_id=$1::uuid",[sessionId]);
  if(!rows[0])return 0;
  if(rows[0].state!=='active')throw new ChildApiError('UNAUTHORIZED',401);
  return Number(rows[0].generation);
}
async function persist(db: ChildSqlConnection, sessionId: string, revision: number, before: StateRecord[], after: StateRecord[]) {
  const old = new Map(before.map(record => [recordKey(record),record]));
  const next = new Set(after.map(recordKey));
  if (before.some(record => !next.has(recordKey(record)))) throw new ChildApiError('APPEND_CORRECTION_REQUIRED', 409);
  for (const record of after) {
    const previous = old.get(recordKey(record));
    if (previous && stableJson(previous.payload) === stableJson(record.payload) && previous.position === record.position) continue;
    await db.query(`INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision,position)
      VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6,$7)
      ON CONFLICT (session_id,domain,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision,position=EXCLUDED.position`,
      [sessionId,record.domain,record.collection,record.record_id,JSON.stringify(record.payload),revision,record.position]);
  }
}
/** PostgreSQL normalized state + immutable facts. No snapshot or memory fallback.
 * Existing snapshot-only rows are rejected until explicitly migrated and reviewed.
 */
export class PostgresChildStore implements ChildStore {
  constructor(private readonly client: ChildSqlClient,private readonly restoreAnchor?:ChildRestoreAnchorProvider) {}
  async consumeRateLimit(kind:'session_creation'|'session_request',sessionId?:string,actorId?:string):Promise<void>{
    // This transaction commits before the business transaction. Rejected or
    // rolled-back requests must not restore their consumed request allowance.
    const accepted=await this.client.transaction(async db=>{
      await scope(db,sessionId??'',kind==='session_creation'?'bootstrap':'child','rate-limit');
      await db.query("SELECT set_config('app.child_actor_id',$1,true)",[actorId??'']);
      const rows=await db.query<{accepted:boolean}>("SELECT child_stewardship.consume_child_api_limit($1,$2::uuid) AS accepted",[kind,sessionId??null]);
      return rows[0]?.accepted===true;
    });
    if(!accepted)throw new ChildApiError('RATE_LIMITED',429);
  }
  async issueDraftAuthorization(rawBearer:string,proposal:unknown):Promise<string> {
    return this.client.transaction(async db=>{
      if(!/^cp-demo\.[A-Za-z0-9_-]{43}$/.test(rawBearer))throw new ChildApiError('UNAUTHORIZED',401);
      await db.query("SELECT set_config('app.child_token_hash',$1,true)",[tokenDigest(rawBearer)]);
      const tokens=await db.query<{session_id:string}>("SELECT session_id::text FROM child_stewardship.session_tokens WHERE token_hash=$1",[tokenDigest(rawBearer)]);
      if(!tokens[0])throw new ChildApiError('UNAUTHORIZED',401);
      await scope(db,tokens[0].session_id,'child','authorize-draft');
      await db.query("SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid FOR UPDATE",[tokens[0].session_id]);
      await assertChildRestoreReady(db,tokens[0].session_id,this.restoreAnchor);
      const rows=await db.query<{token:string|null}>("SELECT child_stewardship.issue_draft_authorization($1,$2::jsonb) AS token",[rawBearer,JSON.stringify(proposal)]);
      if(!rows[0]?.token)throw new ChildApiError('CURRENT_DRAFT_AUTHORIZATION_REQUIRED',403);
      return rows[0].token;
    });
  }
  async ready(): Promise<boolean> {
    try {
      // Schema presence alone is not authority readiness. Never run this adapter as
      // its migration owner or with a login that can bypass tenant policies.
      const rows = await this.client.query<{ready:boolean}>(`WITH effective_role AS (
        SELECT oid,rolname,rolsuper,rolbypassrls,rolcanlogin,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user
      ), latest_scopes AS (
        SELECT DISTINCT ON (actor_role) actor_role,enabled,expires_at
        FROM child_stewardship.service_role_scopes WHERE database_role=current_user
        ORDER BY actor_role,scope_version DESC
      ) SELECT EXISTS(SELECT 1 FROM child_stewardship.storage_version WHERE version=2)
        AND current_user=session_user
        AND EXISTS(SELECT 1 FROM effective_role WHERE rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
        AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname<>current_user AND pg_has_role(current_user,r.oid,'MEMBER'))
        AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=current_user)
        AND to_regclass('child_stewardship.draft_authorizations') IS NOT NULL
        AND to_regclass('child_stewardship.draft_authorization_uses') IS NOT NULL
        AND to_regclass('child_stewardship.privacy_jobs') IS NOT NULL
        AND to_regclass('child_stewardship.privacy_suppressions') IS NOT NULL
        AND to_regclass('child_stewardship.api_rate_limits') IS NOT NULL
        AND coalesce(has_function_privilege(current_user,to_regprocedure('child_stewardship.issue_draft_authorization(text,jsonb)'),'EXECUTE'),false)
        AND coalesce(has_function_privilege(current_user,to_regprocedure('child_stewardship.consume_draft_authorization(text,uuid,text,jsonb)'),'EXECUTE'),false)
        AND coalesce(has_function_privilege(current_user,to_regprocedure('child_stewardship.consume_child_api_limit(text,uuid)'),'EXECUTE'),false)
        AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN effective_role r ON r.oid=c.relowner WHERE n.nspname='child_stewardship')
        AND (SELECT count(*) FROM latest_scopes WHERE enabled AND expires_at>clock_timestamp()
          AND actor_role IN ('bootstrap','guardian','child','reviewer','protector','operator'))=6
        AND NOT EXISTS(SELECT 1 FROM latest_scopes WHERE actor_role IN ('registry-publisher','operation-verifier') AND enabled AND expires_at>clock_timestamp())
        AND NOT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.privacy_worker_roles WHERE database_role=current_user ORDER BY scope_version DESC LIMIT 1),false)
        AS ready`);
      if(rows[0]?.ready!==true)return false;
      const restoration=(await this.client.query<{installed:boolean;anchor_function:boolean}>("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS installed,to_regprocedure('child_stewardship.restore_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor_function"))[0];
      if(restoration?.installed?!this.restoreAnchor||!restoration.anchor_function:Boolean(this.restoreAnchor))return false;
      const optional=await this.client.query<{media:boolean;webauthn:boolean}>(`SELECT
        to_regclass('child_stewardship.media_roles') IS NOT NULL AS media,
        to_regclass('child_stewardship_webauthn.verifier_roles') IS NOT NULL AS webauthn`);
      if(optional[0]?.media&&(await this.client.query(`SELECT 1 FROM (SELECT DISTINCT ON(scope) enabled,expires_at FROM child_stewardship.media_roles WHERE database_role=current_user ORDER BY scope,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp()`)).length)return false;
      if(optional[0]?.webauthn&&(await this.client.query(`SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp()`)).length)return false;
      return true;
    } catch { return false; }
  }
  async create(session: DemoSession, tokens: DemoToken[]): Promise<void> {
    await this.client.transaction(async db => {
      await scope(db,session.id,'bootstrap','create-synthetic-session');
      await db.query("INSERT INTO child_stewardship.sessions(id,mode,expires_at,revision,storage_format) VALUES ($1::uuid,'synthetic-demo',$2::timestamptz,$3,'normalized-v2')",[session.id,session.expiresAt,session.snapshot.version]);
      await persist(db,session.id,session.snapshot.version,[],normalizeChildSnapshot(session.snapshot));
      for (const token of tokens) await db.query("INSERT INTO child_stewardship.session_tokens(token_hash,session_id,actor_id,device_id,epoch) VALUES ($1,$2::uuid,$3,$4,$5)",[token.hash,session.id,token.principal.actorId,token.principal.deviceId,token.principal.epoch]);
    });
  }
  async resolveToken(hash: string, now: string) {
    const started=performance.now();
    return this.client.transaction(async db => {
      await db.query("SELECT set_config('app.child_token_hash',$1,true)",[hash]);
      const rows = await db.query<{session_id:string;actor_id:string;device_id:string;epoch:number;generation:string}>("SELECT session_id::text,actor_id,device_id,epoch,generation::text FROM child_stewardship.session_tokens WHERE token_hash=$1",[hash]);
      const token = rows[0]; if (!token) return null;
      await scope(db,token.session_id,'child','authenticate');
      await assertChildRestoreReady(db,token.session_id,this.restoreAnchor);
      const sessions = await db.query("SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND mode='synthetic-demo' AND storage_format='normalized-v2'",[token.session_id,childExecutionTime(now,started)]);
      return sessions.length ? {sessionId:token.session_id,principal:{actorId:token.actor_id,deviceId:token.device_id,epoch:token.epoch,sessionGeneration:Number(token.generation)}} : null;
    });
  }
  async transact<T>(sessionId: string, now: string, run: (tx: ChildTransaction) => T): Promise<T> {
    const started=performance.now();
    return this.client.transaction(async db => {
      await scope(db,sessionId,'child','read');
      const sessions = await db.query<{revision:string;expires_at:Date}>("SELECT revision::text,expires_at FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND mode='synthetic-demo' AND storage_format='normalized-v2' FOR UPDATE",[sessionId,now]);
      if (!sessions[0]) throw new ChildApiError('UNAUTHORIZED',401);
      const executionTime=childExecutionTime(now,started);
      if(sessions[0].expires_at.getTime()<=Date.parse(executionTime))throw new ChildApiError('UNAUTHORIZED',401);
      await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
      const sessionGeneration=await lockedGeneration(db,sessionId);
      const records = await db.query<StateRecord & Record<string,unknown>>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[sessionId]);
      const revision = Number(sessions[0].revision);
      const snapshot = reconstructChildSnapshot(records,revision);
      const storedReceipts = await db.query<{actor_id:string;idempotency_key:string;request_digest:string;result:unknown;revision:string}>("SELECT actor_id,idempotency_key,request_digest,result,revision::text FROM child_stewardship.receipts WHERE session_id=$1::uuid",[sessionId]);
      const receipts:ChildReceipt[] = storedReceipts.map(r=>({actorId:r.actor_id,key:r.idempotency_key,digest:r.request_digest,result:r.result,version:Number(r.revision)}));
      const oldOperations = new Set(Object.keys(snapshot.rights.executedOperations));
      const oldPrivacyRequests = new Set(Object.keys(snapshot.learning.privacyRequests));
      const admissions=await db.query<{operation_id:string;approved_mutations:unknown}>("SELECT operation_id,approved_mutations FROM child_stewardship.verification_admissions WHERE session_id=$1::uuid AND expected_revision=$2",[sessionId,revision]);
      const rightsRecordedAt:Record<string,string>={};
      for(const admission of admissions){
        try{rightsRecordedAt[admission.operation_id]=admittedRightsRecordedAt(admission.approved_mutations,admission.operation_id);}catch{/* malformed admission never authorizes a transition */}
      }
      const currentExecutionTime=childExecutionTime(now,started);
      if(sessions[0].expires_at.getTime()<=Date.parse(currentExecutionTime))throw new ChildApiError('UNAUTHORIZED',401);
      const tx:ChildTransaction = {snapshot,receipts,audit:[],outbox:[],sessionGeneration,executionTime:currentExecutionTime,rightsRecordedAt};
      const result = run(tx);
      const newOperation = Object.keys(tx.snapshot.rights.executedOperations).find(key=>!oldOperations.has(key)) ?? '';
      await scope(db,sessionId,tx.actorRole ?? 'child',tx.operation ?? 'read',newOperation);
      await db.query("SELECT set_config('app.child_actor_id',$1,true)",[tx.actorId ?? '']);
      if(tx.draftAuthorization){
        const grant=tx.draftAuthorization;
        const admitted=await db.query<{accepted:boolean}>("SELECT child_stewardship.consume_draft_authorization($1,$2::uuid,$3,$4::jsonb) AS accepted",[grant.proof,sessionId,grant.actorId,JSON.stringify(grant.command)]);
        if(admitted[0]?.accepted!==true)throw new ChildApiError('CURRENT_DRAFT_AUTHORIZATION_REQUIRED',403);
      }
      if (tx.snapshot.version !== revision) {
        await persist(db,sessionId,tx.snapshot.version,records,normalizeChildSnapshot(tx.snapshot));
        for(const request of Object.values(tx.snapshot.learning.privacyRequests).filter(item=>!oldPrivacyRequests.has(item.id))) {
          await db.query(`INSERT INTO child_stewardship.privacy_jobs(session_id,request_id,profile_id,requested_by,kind,state,policy_version,created_at)
            VALUES($1::uuid,$2,$3,$4,$5,'requested',$7,$6::timestamptz)`,[sessionId,request.id,request.profileId,tx.actorId,request.kind,request.requestedAt,tx.snapshot.learning.policyVersion]);
        }
        await db.query("UPDATE child_stewardship.sessions SET revision=$2 WHERE id=$1::uuid",[sessionId,tx.snapshot.version]);
      }
      for (const receipt of tx.receipts.slice(storedReceipts.length)) await db.query("INSERT INTO child_stewardship.receipts(session_id,actor_id,idempotency_key,request_digest,result,revision) VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6)",[sessionId,receipt.actorId,receipt.key,receipt.digest,JSON.stringify(receipt.result),receipt.version]);
      if (tx.audit.length) {
        const previous = await db.query<{digest:string}>("SELECT digest FROM child_stewardship.audit WHERE session_id=$1::uuid ORDER BY sequence DESC LIMIT 1",[sessionId]);
        let previousDigest = previous[0]?.digest ?? '0'.repeat(64);
        for (const event of tx.audit) {
          const digest=childDigest({previousDigest,event});
          await db.query("INSERT INTO child_stewardship.audit(session_id,event,previous_digest,digest) VALUES ($1::uuid,$2::jsonb,$3,$4)",[sessionId,JSON.stringify(event),previousDigest,digest]); previousDigest=digest;
        }
      }
      for (const event of tx.outbox) await db.query("INSERT INTO child_stewardship.outbox(session_id,event_id,kind,resource_id,audience) VALUES ($1::uuid,$2,$3,$4,$5) ON CONFLICT DO NOTHING",[sessionId,event.id,event.kind,event.resourceId,event.audience]);
      return result;
    });
  }
  async privacyResult(sessionId:string,principal:LearningPrincipal,requestId:string,now:string):Promise<unknown> {
    const started=performance.now();
    return this.client.transaction(async db=>{
      await scope(db,sessionId,'child','read-privacy-result');
      const sessions=await db.query<{expires_at:Date}>("SELECT expires_at FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND storage_format='normalized-v2' FOR UPDATE",[sessionId,now]);
      await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
      const generation=await lockedGeneration(db,sessionId);
      const actors=await db.query<{payload:LearningActor}>("SELECT payload FROM child_stewardship.state_records WHERE session_id=$1::uuid AND domain='learning' AND collection='actors' AND record_id=$2",[sessionId,principal.actorId]);
      const actor=actors[0]?.payload;
      const executionTime=childExecutionTime(now,started);
      if(!sessions.length||sessions[0]!.expires_at.getTime()<=Date.parse(executionTime)||generation!==(principal.sessionGeneration??0)||!actor||actor.revoked||actor.epoch!==principal.epoch||!actor.deviceIds.includes(principal.deviceId)||Date.parse(actor.expiresAt)<=Date.parse(executionTime))throw new ChildApiError('UNAUTHORIZED',401);
      const rows=await db.query<{kind:string;state:string;profile_id:string}>("SELECT kind,state,profile_id FROM child_stewardship.privacy_jobs WHERE session_id=$1::uuid AND request_id=$2 AND requested_by=$3",[sessionId,requestId,principal.actorId]);
      const job=rows[0]; if(!job) throw new ChildApiError('FORBIDDEN',403);
      // Ordinary users never receive processing counts/timing or hold-dependent
      // states that could disclose a protected case. Durable worker receipts keep
      // the actual processing state; this response confirms withdrawal only.
      const result:{requestId:string;kind:string;state:string;syntheticOnly:true;retentionNotice:string;export?:unknown}={requestId,kind:job.kind,state:job.kind==='delete_learning'?'learning_access_withdrawn':job.state,syntheticOnly:true,retentionNotice:job.kind==='delete_learning'?'Learning access is withdrawn. Physical processing and minimum security, protection and legal-purpose retention are independently tracked. This response does not certify deletion of every copy. No rights or funds are forfeited.':'This export contains authorized ordinary learning records only. Its availability expires separately from source retention. Requesting an export does not withdraw learning access or forfeit rights or funds.'};
      if(job.kind==='export_learning'&&job.state==='completed') {
        const suppressed=await db.query("SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=$1::uuid AND profile_id=$2 AND active",[sessionId,job.profile_id]);
        if(suppressed.length) throw new ChildApiError('PRIVACY_SUPPRESSED',403);
        const objects=await db.query<{content:Uint8Array;expires_at:Date}>("SELECT content,expires_at FROM child_stewardship.privacy_objects WHERE session_id=$1::uuid AND object_id=$2 AND kind='export' AND expires_at>clock_timestamp()",[sessionId,`export:${requestId}`]);
        if(!objects[0]) throw new ChildApiError('EXPORT_UNAVAILABLE',503);
        const releaseTime=Date.parse(childExecutionTime(now,started));
        if(sessions[0]!.expires_at.getTime()<=releaseTime||Date.parse(actor.expiresAt)<=releaseTime)throw new ChildApiError('UNAUTHORIZED',401);
        if(objects[0].expires_at.getTime()<=releaseTime)throw new ChildApiError('EXPORT_UNAVAILABLE',503);
        result.export=JSON.parse(Buffer.from(objects[0].content).toString('utf8'));
      }
      return result;
    });
  }
}
