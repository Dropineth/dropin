import {randomUUID} from 'node:crypto';
import type {ChildSqlClient,ChildSqlConnection} from './postgres-store.js';
import {ChildApiError,childDigest,stableJson} from './store.js';
import {verifyChildSignatureBytes} from './signature.js';

export type RestoreRoots={canonical:string;security:string;privacy:string};
export type RestoreCheckpoint={
  protocol:'CanopyProof-RestoreCheckpoint/1';environment:'SIMULATION_ONLY';domainSeparator:'canopyproof:synthetic:restore:v1';
  checkpointId:string;sequence:number;sessionId:string;keyRegistryVersion:string;issuedAt:string;expiresAt:string;roots:RestoreRoots;
};
export type SignedRestoreCheckpoint={checkpoint:RestoreCheckpoint;signatures:{keyId:string;signature:string}[]};
export type RestoreAnchor={checkpointId:string;sequence:number;digest:string;sessionId:string;keyRegistryVersion:string};
export type RestoreAnchorProvider=(sessionId:string)=>Promise<RestoreAnchor|null>;
export type RestoreCheckpointKey={keyId:string;role:'protection'|'trustee';controlDomain:string;independentOfOperator:boolean;publicKey:string;revoked:boolean;validAfter:string;expiresAt:string};
const fail=(code:string):never=>{throw new ChildApiError(code,503);};
const sha=/^[a-f0-9]{64}$/;
function time(value:string):number{const valueMs=Date.parse(value);if(!Number.isFinite(valueMs)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value))return fail('RESTORE_INVALID_TIME');return valueMs;}
function verifyEnvelope(signed:SignedRestoreCheckpoint,anchor:RestoreAnchor,keys:readonly RestoreCheckpointKey[],now:string):string[]{
  const c=signed?.checkpoint;if(!c||Object.keys(c).sort().join(',')!=='checkpointId,domainSeparator,environment,expiresAt,issuedAt,keyRegistryVersion,protocol,roots,sequence,sessionId'||c.protocol!=='CanopyProof-RestoreCheckpoint/1'||c.environment!=='SIMULATION_ONLY'||c.domainSeparator!=='canopyproof:synthetic:restore:v1'||!Number.isSafeInteger(c.sequence)||c.sequence<1||Object.keys(c.roots??{}).sort().join(',')!=='canonical,privacy,security'||!Object.values(c.roots).every(v=>typeof v==='string'&&sha.test(v)))return fail('RESTORE_INVALID_CHECKPOINT');
  if(c.sessionId!==anchor.sessionId||c.checkpointId!==anchor.checkpointId||c.sequence!==anchor.sequence||c.keyRegistryVersion!==anchor.keyRegistryVersion||childDigest(c)!==anchor.digest)return fail('RESTORE_CURRENT_ANCHOR_MISMATCH');
  const moment=time(now);if(time(c.issuedAt)>moment||time(c.expiresAt)<=moment||time(c.expiresAt)-moment>3_600_000||time(c.expiresAt)<=time(c.issuedAt))return fail('RESTORE_CHECKPOINT_EXPIRED');
  if(!Array.isArray(signed.signatures)||signed.signatures.length<2||signed.signatures.length>8||new Set(keys.map(k=>k.keyId)).size!==keys.length)return fail('RESTORE_SIGNER_REGISTRY_INVALID');
  const payload=Buffer.from(stableJson(c)),seen=new Set<string>(),domains=new Set<string>(),roles=new Set<string>();
  for(const approval of signed.signatures){
    const key=keys.find(k=>k.keyId===approval.keyId);if(!key||seen.has(key.keyId)||key.revoked||!key.independentOfOperator||domains.has(key.controlDomain)||time(key.validAfter)>moment||time(key.expiresAt)<=moment||!(/^[A-Za-z0-9_-]{86}$/.test(approval.signature)))return fail('RESTORE_SIGNER_NOT_CURRENT_OR_INDEPENDENT');
    const signature=Buffer.from(approval.signature,'base64url');if(signature.toString('base64url')!==approval.signature||!verifyChildSignatureBytes({algorithm:'Ed25519',expectedPayload:payload,signedPayload:payload,signature,registeredPublicKey:key.publicKey}).valid)return fail('RESTORE_INVALID_SIGNATURE');
    seen.add(key.keyId);domains.add(key.controlDomain);roles.add(key.role);
  }
  if(!roles.has('protection')||!roles.has('trustee'))return fail('RESTORE_INDEPENDENT_QUORUM_REQUIRED');return[...seen].sort();
}
/** Dedicated verifier connection; no external institution or current provider is fabricated. */
export class ChildRestoreVerifier{
  private readonly keys:RestoreCheckpointKey[];
  private readonly keyRegistryVersion:string;
  constructor(private readonly verifier:ChildSqlClient,private readonly currentAnchor:RestoreAnchorProvider,registry:{version:string;keys:readonly RestoreCheckpointKey[]}){this.keys=structuredClone([...registry.keys]);this.keyRegistryVersion=registry.version;}
  async ready():Promise<boolean>{return this.identityReady(this.verifier);}
  private async identityReady(db:ChildSqlConnection):Promise<boolean>{try{
    const result=await db.query<{ready:boolean}>(`WITH principal AS(SELECT oid,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user)
      SELECT current_user=session_user AND EXISTS(SELECT 1 FROM principal WHERE NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN principal p ON p.oid=m.member)
      AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN principal p ON p.oid=c.relowner WHERE c.relnamespace='child_stewardship'::regnamespace)
      AND child_stewardship.is_restore_verifier() ready`);
    if(result[0]?.ready!==true)return false;
    for(const table of ['child_stewardship.service_role_scopes','child_stewardship.privacy_worker_roles','child_stewardship.media_roles','child_stewardship.agent_verifier_roles','child_stewardship_webauthn.verifier_roles']){
      const installed=await db.query<{installed:boolean}>('SELECT to_regclass($1) IS NOT NULL installed',[table]);
      if(installed[0]?.installed&&(await db.query(`SELECT 1 FROM ${table} WHERE database_role=current_user AND enabled LIMIT 1`)).length)return false;
    }return true;
  }catch{return false;}}
  private async anchor(session:string):Promise<RestoreAnchor>{
    const anchor=await this.currentAnchor(session);if(!anchor||anchor.sessionId!==session||!sha.test(anchor.digest)||!Number.isSafeInteger(anchor.sequence)||anchor.sequence<1)return fail('RESTORE_CURRENT_ANCHOR_UNAVAILABLE');return structuredClone(anchor);
  }
  private async lock(db:ChildSqlConnection,session:string){
    await db.query("SELECT set_config('app.child_session_id',$1,true)",[session]);
    const rows=await db.query<{revision:string;expires_at:Date}>('SELECT revision::text,expires_at FROM child_stewardship.sessions WHERE id=$1::uuid FOR UPDATE',[session]);
    const clock=await db.query<{now:Date}>('SELECT clock_timestamp() now');if(!rows[0])return fail('RESTORE_SESSION_UNAVAILABLE');return{revision:rows[0].revision,now:clock[0]!.now.toISOString()};
  }
  async quarantine(session:string):Promise<{sequence:string;anchor:RestoreAnchor}>{
    if(!await this.ready())return fail('RESTORE_VERIFIER_UNAVAILABLE');const anchor=await this.anchor(session);
    return this.verifier.transaction(async db=>{await this.lock(db,session);if(!await this.identityReady(db))return fail('RESTORE_VERIFIER_UNAVAILABLE');const rows=await db.query<{sequence:string}>(`INSERT INTO child_stewardship.restore_quarantines(session_id,instance_id,database_oid,anchor_digest,checkpoint_id,checkpoint_sequence)
      VALUES($1::uuid,$2::uuid,(SELECT oid FROM pg_database WHERE datname=current_database()),$3,$4,$5) RETURNING sequence::text`,[session,randomUUID(),anchor.digest,anchor.checkpointId,anchor.sequence]);return{sequence:rows[0]!.sequence,anchor};});
  }
  async verifyAndAdmit(session:string,signed:SignedRestoreCheckpoint){
    // Committed first: failed signature/root verification cannot leave an earlier admission open.
    const quarantine=await this.quarantine(session);
    return this.verifier.transaction(async db=>{
      const locked=await this.lock(db,session),anchor=await this.anchor(session);if(stableJson(anchor)!==stableJson(quarantine.anchor))return fail('RESTORE_ANCHOR_CHANGED');
      if(!await this.identityReady(db))return fail('RESTORE_VERIFIER_UNAVAILABLE');
      if(anchor.keyRegistryVersion!==this.keyRegistryVersion)return fail('RESTORE_SIGNER_REGISTRY_CHANGED');
      let moment=(await db.query<{now:Date}>('SELECT clock_timestamp() now'))[0]!.now.toISOString();
      const signers=verifyEnvelope(signed,anchor,this.keys,moment);
      const roots=(await db.query<{roots:RestoreRoots}>('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[session]))[0]!.roots;
      if(stableJson(roots)!==stableJson(signed.checkpoint.roots))return fail('RESTORE_CANONICAL_STATE_STALE');
      const finalAnchor=await this.anchor(session);if(stableJson(finalAnchor)!==stableJson(anchor))return fail('RESTORE_ANCHOR_CHANGED');
      moment=(await this.lock(db,session)).now;verifyEnvelope(signed,finalAnchor,this.keys,moment);
      const admissionExpiry=new Date(Math.min(Date.parse(signed.checkpoint.expiresAt),...this.keys.filter(key=>signers.includes(key.keyId)).map(key=>Date.parse(key.expiresAt)))).toISOString();
      await db.query(`INSERT INTO child_stewardship.restore_admissions(quarantine_sequence,session_id,checkpoint_digest,anchor_digest,canonical_root,security_root,privacy_root,admitted_revision,signer_key_ids,expires_at)
        VALUES($1::bigint,$2::uuid,$3,$3,$4,$5,$6,$7::bigint,$8::jsonb,$9::timestamptz)`,[quarantine.sequence,session,anchor.digest,roots.canonical,roots.security,roots.privacy,locked.revision,JSON.stringify(signers),admissionExpiry]);
      return{verified:true as const,syntheticOnly:true as const,checkpointId:anchor.checkpointId,sequence:anchor.sequence};
    });
  }
  async isReadyForAnchor(session:string):Promise<boolean>{try{
    const anchor=await this.anchor(session);return this.verifier.transaction(async db=>{await this.lock(db,session);return(await db.query<{ready:boolean}>('SELECT child_stewardship.restore_anchor_current($1::uuid,$2,$3::bigint,$4) ready',[session,anchor.checkpointId,anchor.sequence,anchor.digest]))[0]?.ready===true;});
  }catch{return false;}}
}
