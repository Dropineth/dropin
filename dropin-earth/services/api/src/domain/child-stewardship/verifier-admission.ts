import { applyRightsOperation } from './rights.js';
import type { RightsApproval, RightsOperation } from './rights-types.js';
import { ChildApiError, stableJson } from './store.js';
import { normalizeChildSnapshot, reconstructChildSnapshot, type ChildSqlClient } from './postgres-store.js';

/** Separate verification service boundary. Its connection must have ONLY the
 * operation-verifier scope, never the application's write scopes. No production
 * connection or automatic admission is configured by the runtime mount.
 * PostgreSQL checks immutable admission and exact deltas; this service performs
 * actual Ed25519 and current-policy verification before admitting those deltas.
 */
export class ChildRightsVerifier {
  constructor(private readonly client: ChildSqlClient) {}
  async admit(sessionId: string, operation: RightsOperation, approvals: RightsApproval[], now: string): Promise<void> {
    await this.client.transaction(async db => {
      await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','operation-verifier',true)",[sessionId]);
      const sessions=await db.query<{revision:string}>("SELECT revision::text FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND mode='synthetic-demo' AND storage_format='normalized-v2' FOR UPDATE",[sessionId,now]);
      if(!sessions[0]) throw new ChildApiError('AUTHORITY_UNAVAILABLE',503);
      const revision=Number(sessions[0].revision);
      const records=await db.query<{domain:string;collection:string;record_id:string;payload:unknown;position:number}>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[sessionId]);
      const before=reconstructChildSnapshot(records,revision);
      if(!before.rightsContext) throw new ChildApiError('RIGHTS_UNVERIFIED',503);
      const after={...before,rights:applyRightsOperation(before.rights,operation,approvals,{...before.rightsContext,now})};
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
        [sessionId,operation.operationId,approvalDigest,JSON.stringify(operation),JSON.stringify(approvals),JSON.stringify(before.rightsContext),revision,JSON.stringify(mutations),operation.expiresAt,`ed25519:${approvalDigest}`]);
      const admitted=await db.query<{matches:boolean}>(`SELECT approval_digest=$3
          AND envelope_digest=encode(sha256(convert_to(($4::jsonb)::text,'UTF8')),'hex')
          AND signatures_digest=encode(sha256(convert_to(($5::jsonb)::text,'UTF8')),'hex')
          AND registry_digest=encode(sha256(convert_to(($6::jsonb)::text,'UTF8')),'hex')
          AND expected_revision=$7 AND approved_mutations=$8::jsonb AS matches
        FROM child_stewardship.verification_admissions WHERE session_id=$1::uuid AND operation_id=$2`,
        [sessionId,operation.operationId,approvalDigest,JSON.stringify(operation),JSON.stringify(approvals),JSON.stringify(before.rightsContext),revision,JSON.stringify(mutations)]);
      if(admitted[0]?.matches!==true) throw new ChildApiError('VERIFICATION_ADMISSION_CONFLICT',409);
    });
  }
}
