import { admittedRightsRecordedAt, applyRightsOperation,RIGHTS_CONTRIBUTION_ADMISSION_MS } from './rights.js';
import type { RightsApproval, RightsOperation } from './rights-types.js';
import { ChildApiError, stableJson } from './store.js';
import { assertChildRestoreReady,childExecutionTime,normalizeChildSnapshot, reconstructChildSnapshot, type ChildSqlClient, type ChildSqlConnection, type ChildRestoreAnchorProvider } from './postgres-store.js';

/** Separate verification service boundary. Its connection must have ONLY the
 * operation-verifier scope, never the application's write scopes. No production
 * connection or automatic admission is configured by the runtime mount.
 * PostgreSQL checks immutable admission and exact deltas; this service performs
 * actual Ed25519 and current-policy verification before admitting those deltas.
 */
export class ChildRightsVerifier {
  constructor(private readonly client: ChildSqlClient,private readonly restoreAnchor?:ChildRestoreAnchorProvider) {}
  async ready():Promise<boolean>{
    return this.identityReady(this.client);
  }
  private async identityReady(db:ChildSqlConnection):Promise<boolean>{
    try{
      const rows=await db.query<{ready:boolean}>(`WITH latest AS (
        SELECT DISTINCT ON(database_role,actor_role) database_role,actor_role,enabled,expires_at
        FROM child_stewardship.service_role_scopes ORDER BY database_role,actor_role,scope_version DESC
      ) SELECT current_user=session_user
        AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
        AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(c.relowner)=current_user)
        AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=current_user)
        AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname<>current_user AND pg_has_role(current_user,r.oid,'MEMBER'))
        AND EXISTS(SELECT 1 FROM latest WHERE database_role=current_user AND actor_role='operation-verifier' AND enabled AND expires_at>clock_timestamp())
        AND NOT EXISTS(SELECT 1 FROM latest s JOIN pg_roles r ON r.rolname=s.database_role
          WHERE s.actor_role<>'operation-verifier' AND s.enabled AND s.expires_at>clock_timestamp()
            AND pg_has_role(current_user,r.oid,'MEMBER')) AS ready`);
      if(rows[0]?.ready!==true)return false;
      const installed=await db.query<{privacy:boolean;media:boolean;webauthn:boolean}>(`SELECT
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='privacy_worker_roles') AS privacy,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='media_roles') AS media,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship_webauthn' AND c.relname='verifier_roles') AS webauthn`);
      if(installed[0]?.privacy&&(await db.query(`SELECT 1 FROM (SELECT enabled,expires_at FROM child_stewardship.privacy_worker_roles WHERE database_role=current_user ORDER BY scope_version DESC LIMIT 1) s WHERE enabled AND expires_at>clock_timestamp()`)).length)return false;
      if(installed[0]?.media&&(await db.query(`SELECT 1 FROM (SELECT DISTINCT ON(scope) enabled,expires_at FROM child_stewardship.media_roles WHERE database_role=current_user ORDER BY scope,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp()`)).length)return false;
      if(installed[0]?.webauthn&&(await db.query(`SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp()`)).length)return false;
      const restore=await db.query<{installed:boolean;anchor_function:boolean}>("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL AS installed,to_regprocedure('child_stewardship.restore_anchor_current(uuid,text,bigint,text)') IS NOT NULL AS anchor_function");
      if(restore[0]?.installed?typeof this.restoreAnchor!=='function'||!restore[0].anchor_function:Boolean(this.restoreAnchor))return false;
      return true;
    }catch{return false;}
  }
  async admit(sessionId: string, operation: RightsOperation, approvals: RightsApproval[], now: string): Promise<void> {
    const started=performance.now();
    if(!await this.ready())throw new ChildApiError('VERIFIER_IDENTITY_UNAVAILABLE',503);
    await this.client.transaction(async db => {
      if(!await this.identityReady(db))throw new ChildApiError('VERIFIER_IDENTITY_UNAVAILABLE',503);
      await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','operation-verifier',true)",[sessionId]);
      const sessions=await db.query<{revision:string;expires_at:Date}>("SELECT revision::text,expires_at FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND mode='synthetic-demo' AND storage_format='normalized-v2' FOR UPDATE",[sessionId,now]);
      if(!sessions[0]) throw new ChildApiError('AUTHORITY_UNAVAILABLE',503);
      if(!await this.identityReady(db))throw new ChildApiError('VERIFIER_IDENTITY_UNAVAILABLE',503);
      await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
      let executionTime=childExecutionTime(now,started);
      if(sessions[0].expires_at.getTime()<=Date.parse(executionTime))throw new ChildApiError('AUTHORITY_UNAVAILABLE',503);
      const revision=Number(sessions[0].revision);
      const records=await db.query<{domain:string;collection:string;record_id:string;payload:unknown;position:number}>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[sessionId]);
      const before=reconstructChildSnapshot(records,revision);
      if(!before.rightsContext) throw new ChildApiError('RIGHTS_UNVERIFIED',503);
      const prior=await db.query<{expected_revision:string;approved_mutations:unknown}>("SELECT expected_revision::text,approved_mutations FROM child_stewardship.verification_admissions WHERE session_id=$1::uuid AND operation_id=$2",[sessionId,operation.operationId]);
      if(prior[0]&&Number(prior[0].expected_revision)!==revision)throw new ChildApiError('VERIFICATION_ADMISSION_CONFLICT',409);
      await assertChildRestoreReady(db,sessionId,this.restoreAnchor);
      executionTime=childExecutionTime(now,started);
      if(sessions[0].expires_at.getTime()<=Date.parse(executionTime))throw new ChildApiError('AUTHORITY_UNAVAILABLE',503);
      const recordedAt=prior[0]?admittedRightsRecordedAt(prior[0].approved_mutations,operation.operationId):executionTime;
      const after={...before,rights:applyRightsOperation(before.rights,operation,approvals,{...before.rightsContext,now:executionTime},recordedAt)};
      const admissionExpiresAt=operation.operationType==='CONFIRM_CONTRIBUTION'
        ?new Date(Math.min(Date.parse(operation.expiresAt),Date.parse(recordedAt)+RIGHTS_CONTRIBUTION_ADMISSION_MS)).toISOString():operation.expiresAt;
      const old=new Map(records.map(record=>[`${record.domain}/${record.collection}/${record.record_id}`,record]));
      const mutations=normalizeChildSnapshot(after).filter(record=>record.domain==='rights'&&record.collection!=='securityContext'&&stableJson(old.get(`${record.domain}/${record.collection}/${record.record_id}`)?.payload??null)!==stableJson(record.payload)).map(({collection,record_id,payload})=>({collection,record_id,payload}));
      const approvalDigest=after.rights.approvalRecords[operation.operationId]!.approvalDigest;
      // SQL JSONB formatting supplies consistent database-side digests, independently
      // of the canonical signed-byte format checked above.
      await db.query(`INSERT INTO child_stewardship.verification_admissions
        (session_id,operation_id,approval_digest,envelope_digest,signatures_digest,registry_digest,expected_revision,approved_mutations,expires_at,verification_ref)
        VALUES($1::uuid,$2,$3,encode(sha256(convert_to(($4::jsonb)::text,'UTF8')),'hex'),
          encode(sha256(convert_to(($5::jsonb)::text,'UTF8')),'hex'),
          encode(sha256(convert_to(($6::jsonb)::text,'UTF8')),'hex'),$7,$8::jsonb,$9::timestamptz,$10)
        ON CONFLICT(session_id,operation_id) DO NOTHING`,
        [sessionId,operation.operationId,approvalDigest,JSON.stringify(operation),JSON.stringify(approvals),JSON.stringify(before.rightsContext),revision,JSON.stringify(mutations),admissionExpiresAt,`ed25519:${approvalDigest}`]);
      const admitted=await db.query<{matches:boolean}>(`SELECT approval_digest=$3
          AND envelope_digest=encode(sha256(convert_to(($4::jsonb)::text,'UTF8')),'hex')
          AND signatures_digest=encode(sha256(convert_to(($5::jsonb)::text,'UTF8')),'hex')
          AND registry_digest=encode(sha256(convert_to(($6::jsonb)::text,'UTF8')),'hex')
          AND expected_revision=$7 AND approved_mutations=$8::jsonb AND expires_at=$9::timestamptz AS matches
        FROM child_stewardship.verification_admissions WHERE session_id=$1::uuid AND operation_id=$2`,
        [sessionId,operation.operationId,approvalDigest,JSON.stringify(operation),JSON.stringify(approvals),JSON.stringify(before.rightsContext),revision,JSON.stringify(mutations),admissionExpiresAt]);
      if(admitted[0]?.matches!==true) throw new ChildApiError('VERIFICATION_ADMISSION_CONFLICT',409);
    });
  }
}
