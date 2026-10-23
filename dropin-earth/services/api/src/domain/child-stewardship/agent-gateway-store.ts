import {createHash} from 'node:crypto';
import {answerChildAgent,canonicalChildAgentEnvelope,validateEnvelope,type ChildAgentCredential,type ChildAgentDelegation} from './agent-gateway.js';
import {assertChildRestoreReady,reconstructChildSnapshot,type ChildSqlClient,type ChildSqlConnection,type ChildRestoreAnchorProvider} from './postgres-store.js';
import {ChildApiError,tokenDigest} from './store.js';

export type ChildAgentWireApproval={keyId:string;algorithm:'Ed25519';signature:string;signedPayload:string};
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** Trusted, separately credentialed Ed25519 verifier. It serves only approved
 * static synthetic explanations. No model invocation or official AHIN claim. */
export class PostgresChildAgentGateway {
  constructor(private readonly verifier:ChildSqlClient,private readonly restoreAnchor?:ChildRestoreAnchorProvider){}
  async ready():Promise<boolean>{return this.identityReady(this.verifier);}
  private async identityReady(db:ChildSqlConnection):Promise<boolean>{
    try{
      const rows=await db.query<{ready:boolean}>(`SELECT current_user=session_user
        AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
        AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname<>current_user AND pg_has_role(current_user,oid,'MEMBER'))
        AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=current_user)
        AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(c.relowner)=current_user)
        AND child_stewardship.agent_verifier_active()
        AND to_regprocedure('child_stewardship.consume_child_capability_limit(text,text)') IS NOT NULL
        AND to_regprocedure('child_stewardship.consume_child_scoped_limit(text,text)') IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(actor_role) enabled,expires_at FROM child_stewardship.service_role_scopes WHERE database_role=current_user ORDER BY actor_role,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp()) AS ready`);
      if(rows[0]?.ready!==true)return false;
      const optional=await db.query<{privacy:boolean;media:boolean;webauthn:boolean}>(`SELECT
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='privacy_worker_roles') AS privacy,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='media_roles') AS media,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship_webauthn' AND c.relname='verifier_roles') AS webauthn`);
      if(optional[0]?.privacy&&(await db.query(`SELECT 1 FROM (SELECT enabled,expires_at FROM child_stewardship.privacy_worker_roles WHERE database_role=current_user ORDER BY scope_version DESC LIMIT 1) s WHERE enabled AND expires_at>clock_timestamp()`)).length)return false;
      if(optional[0]?.media&&(await db.query(`SELECT 1 FROM (SELECT DISTINCT ON(scope) enabled,expires_at FROM child_stewardship.media_roles WHERE database_role=current_user ORDER BY scope,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp()`)).length)return false;
      if(optional[0]?.webauthn&&(await db.query(`SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp()`)).length)return false;
      const restore=await db.query<{installed:boolean;anchor_function:boolean}>("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS installed,to_regprocedure('child_stewardship.restore_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor_function");
      if(restore[0]?.installed?typeof this.restoreAnchor!=='function'||!restore[0].anchor_function:Boolean(this.restoreAnchor))return false;
      return true;
    }catch{return false;}
  }
  async answer(rawBearer:string,input:unknown,wire:ChildAgentWireApproval){
    if(!/^cp-demo\.[A-Za-z0-9_-]{43}$/.test(rawBearer))throw new ChildApiError('UNAUTHORIZED',401);
    if(!wire||typeof wire!=='object'||Array.isArray(wire)||Object.keys(wire).sort().join(',')!=='algorithm,keyId,signature,signedPayload'
      ||typeof wire.keyId!=='string'||!/^demo-[a-z0-9-]{1,72}$/.test(wire.keyId)||wire.algorithm!=='Ed25519'
      ||typeof wire.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(wire.signature)
      ||typeof wire.signedPayload!=='string'||!/^[A-Za-z0-9_-]{1,8192}$/.test(wire.signedPayload))throw new ChildApiError('INVALID_SIGNATURE',403);
    const approval={keyId:wire.keyId,algorithm:wire.algorithm,signature:Buffer.from(wire.signature,'base64url'),signedPayload:Buffer.from(wire.signedPayload,'base64url')};
    if(approval.signature.toString('base64url')!==wire.signature||approval.signedPayload.toString('base64url')!==wire.signedPayload)throw new ChildApiError('INVALID_SIGNATURE',403);
    const quota=await this.verifier.query<{status:string}>("SELECT child_stewardship.consume_child_capability_limit('agent_request',$1) AS status",[rawBearer]);
    const status=quota[0]?.status;
    if(status!=='allowed')throw new ChildApiError(status==='limited'?'RATE_LIMITED':status==='unauthorized'?'UNAUTHORIZED':'AGENT_VERIFIER_UNAVAILABLE',status==='limited'?429:status==='unauthorized'?401:503);
    return this.verifier.transaction(async db=>{
      if(!await this.identityReady(db))throw new ChildApiError('AGENT_VERIFIER_UNAVAILABLE',503);
      const hash=tokenDigest(rawBearer);
      await db.query("SELECT set_config('app.child_token_hash',$1,true)",[hash]);
      const tokens=await db.query<{session_id:string;actor_id:string;device_id:string;epoch:number;generation:string}>(`SELECT session_id::text,actor_id,device_id,epoch,generation::text FROM child_stewardship.session_tokens WHERE token_hash=$1`,[hash]);
      const token=tokens[0];if(!token)throw new ChildApiError('UNAUTHORIZED',401);
      await db.query("SELECT set_config('app.child_session_id',$1,true)",[token.session_id]);
      const sessions=await db.query<{revision:string;expires_at:Date}>("SELECT revision::text,expires_at FROM child_stewardship.sessions WHERE id=$1::uuid AND mode='synthetic-demo' AND storage_format='normalized-v2' FOR UPDATE",[token.session_id]);
      if(!sessions[0]||sessions[0].expires_at.getTime()<=Date.now())throw new ChildApiError('UNAUTHORIZED',401);
      if(!await this.identityReady(db))throw new ChildApiError('AGENT_VERIFIER_UNAVAILABLE',503);
      await assertChildRestoreReady(db,token.session_id,this.restoreAnchor);
      // Resolve again after the lock. A bearer resolved before suspend/revoke
      // cannot survive generation rotation while waiting for this transaction.
      if(!(await db.query('SELECT 1 FROM child_stewardship.session_tokens WHERE token_hash=$1',[hash])).length)throw new ChildApiError('UNAUTHORIZED',401);
      const rows=await db.query<{domain:string;collection:string;record_id:string;payload:unknown;position:number}>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[token.session_id]);
      const state=reconstructChildSnapshot(rows,Number(sessions[0].revision)).learning;
      const registries=await db.query<{version:string;credentials:Record<string,ChildAgentCredential>;delegations:Record<string,ChildAgentDelegation>;expires_at:Date}>("SELECT version::text,credentials,delegations,expires_at FROM child_stewardship.agent_registries WHERE session_id=$1::uuid ORDER BY version DESC LIMIT 1",[token.session_id]);
      const registry=registries[0];if(!registry||registry.expires_at.getTime()<=Date.now())throw new ChildApiError('AGENT_REGISTRY_UNAVAILABLE',503);
      const now=new Date().toISOString(),envelope=validateEnvelope(input,now);
      if(envelope.actorId!==token.actor_id||envelope.deviceId!==token.device_id||envelope.epoch!==token.epoch)throw new ChildApiError('UNAUTHORIZED',401);
      // Only this actor's replay facts are read; unrelated protected activity
      // and aggregate versions are not exposed in answers or rejection bodies.
      const nonces=await db.query<{nonce:string}>("SELECT nonce FROM child_stewardship.agent_admissions WHERE session_id=$1::uuid AND actor_id=$2 AND nonce=$3",[token.session_id,envelope.actorId,envelope.nonce]);
      const context={state,credentials:registry.credentials,delegations:registry.delegations,usedNonces:nonces.map(row=>`${envelope.actorId}:${row.nonce}`),now};
      answerChildAgent(envelope,approval,context);
      await assertChildRestoreReady(db,token.session_id,this.restoreAnchor);
      const fresh=new Date().toISOString();
      if(sessions[0].expires_at.getTime()<=Date.parse(fresh)||registry.expires_at.getTime()<=Date.parse(fresh))throw new ChildApiError('AGENT_REGISTRY_UNAVAILABLE',503);
      const result=answerChildAgent(envelope,approval,{...context,now:fresh});
      const output={event:result.event,answer:result.answer,source:result.source,evidence:result.evidence,identity:result.identity,finalAuthority:result.finalAuthority,syntheticOnly:result.syntheticOnly,limitations:result.limitations};
      const outputJson=JSON.stringify(output),envelopeDigest=digest(canonicalChildAgentEnvelope(envelope)),signatureDigest=digest(approval.signature);
      await db.query(`INSERT INTO child_stewardship.agent_admissions(session_id,event_id,actor_id,nonce,registry_version,session_generation,state_revision,envelope_digest,signature_digest,output_digest,expires_at)
        VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,encode(sha256(convert_to(($10::jsonb)::text,'UTF8')),'hex'),$11::timestamptz)`,[token.session_id,envelope.eventId,envelope.actorId,envelope.nonce,registry.version,token.generation,sessions[0].revision,envelopeDigest,signatureDigest,outputJson,envelope.expiresAt]);
      // Do not retain a second copy of learning evidence or claimed/receipt
      // timestamps. The response is transient; only its digest is durable.
      await db.query(`INSERT INTO child_stewardship.agent_outputs(session_id,event_id,output)
        SELECT session_id,event_id,jsonb_build_object('schema','CanopyProof-StaticAgentReceipt/1','outputDigest',output_digest,
          'source','approved-static-learning-v1','finalAuthority',false,'syntheticOnly',true)
        FROM child_stewardship.agent_admissions WHERE session_id=$1::uuid AND event_id=$2`,[token.session_id,envelope.eventId]);
      await db.query(`INSERT INTO child_stewardship.agent_audit(session_id,event_id,actor_id,envelope_digest,output_digest)
        SELECT session_id,event_id,actor_id,envelope_digest,output_digest FROM child_stewardship.agent_admissions WHERE session_id=$1::uuid AND event_id=$2`,[token.session_id,envelope.eventId]);
      return output;
    });
  }
}
