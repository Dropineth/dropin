import {createHash, createPublicKey, verify} from 'node:crypto';
import {z} from 'zod';
import {canonicalRightsJson} from '../../services/api/src/domain/child-stewardship/authorization.js';

const id=z.string().regex(/^synthetic-[a-z0-9-]{1,64}$/);
const roles=['verified-guardian-fixture'] as const;
const participant=z.object({id,principal:id,role:z.enum(roles),publicKey:z.string().max(512)}).strict();
const request=z.object({profile:z.literal('CanopyProof-Synthetic-CAI/2'),account:id,epoch:z.number().int().nonnegative(),nonce:id,
  action:z.enum(['learning-review','withdraw']),evidenceDigest:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.number().int().positive()}).strict();
const signature=z.object({participant:id,signature:z.string().regex(/^[A-Za-z0-9_-]{86}$/)}).strict();
export type NetworkRequest=z.infer<typeof request>;
export type NetworkParticipant=z.infer<typeof participant>;
export type NetworkSignature=z.infer<typeof signature>;
export const networkSigningBytes=(value:NetworkRequest)=>Buffer.from(`CanopyProof synthetic CAI request v2\n${canonicalRightsJson(request.parse(value))}`);
export const networkDigest=(value:NetworkRequest)=>createHash('sha256').update(networkSigningBytes(value)).digest('hex');

/** Trusted local fixture host, never an IdP or production authority. All transitions
 * are synchronous in one process; there is no distributed authorization guarantee. */
export function createSyntheticAccountNetwork(account:string,participants:NetworkParticipant[],now:()=>number=Date.now){
  id.parse(account);
  const registry=z.array(participant).min(2).max(16).parse(participants);
  const seen=new Set<string>(),principals=new Set<string>(),keys=new Set<string>();
  for(const p of registry){
    if(!/^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\n?$/.test(p.publicKey))throw new Error('PUBLIC_KEY_ONLY');
    const key=createPublicKey(p.publicKey);
    if(key.asymmetricKeyType!=='ed25519')throw new Error('ED25519_REQUIRED');
    const fingerprint=key.export({type:'spki',format:'der'}).toString('hex');
    if(seen.has(p.id)||principals.has(p.principal)||keys.has(fingerprint))throw new Error('INDEPENDENT_PARTICIPANTS_REQUIRED');
    seen.add(p.id);principals.add(p.principal);keys.add(fingerprint);
  }
  let epoch=0,closed=false,assent=false;
  const revoked=new Set<string>(),consumed=new Set<string>();
  let receipts:{digest:string;kind:'learning-review';syntheticOnly:true;cashValue:false;carbonCredit:false}[]=[];
  function check(value:NetworkRequest,approvals:NetworkSignature[]){
    const r=request.parse(value),time=now();
    if(closed||r.account!==account||r.epoch!==epoch||r.expiresAt<=time||r.expiresAt>time+30000||consumed.has(r.nonce))throw new Error('AUTHORITY_UNAVAILABLE');
    const signatures=z.array(signature).max(16).parse(approvals),signers=new Set<string>();
    for(const approval of signatures){
      const p=registry.find(p=>p.id===approval.participant);
      if(!p||revoked.has(p.id)||signers.has(p.id)||!verify(null,networkSigningBytes(r),p.publicKey,Buffer.from(approval.signature,'base64url')))throw new Error('SIGNATURE_UNAVAILABLE');
      signers.add(p.id);
    }
    if(r.action==='learning-review'&&(!assent||signers.size<2))throw new Error('GUARDIAN_QUORUM_AND_ASSENT_REQUIRED');
    if(r.action==='withdraw'&&signers.size<1)throw new Error('GUARDIAN_REQUIRED');
    return r;
  }
  return {
    check,
    // Trusted human-interaction port, not accessible to inference or tools.
    recordChildAssent(){if(closed)throw new Error('AUTHORITY_UNAVAILABLE');assent=true;},
    withdrawChild(){closed=true;assent=false;epoch++;receipts=[];consumed.clear();},
    commit(value:NetworkRequest,approvals:NetworkSignature[]){
      const r=check(value,approvals);
      if(r.action==='withdraw'){closed=true;epoch++;receipts=[];consumed.clear();return {withdrawn:true as const};}
      if(receipts.length>=32)throw new Error('RETENTION_LIMIT');
      consumed.add(r.nonce);
      const receipt={digest:networkDigest(r),kind:'learning-review' as const,syntheticOnly:true as const,cashValue:false as const,carbonCredit:false as const};
      receipts.push(receipt);return {...receipt};
    },
    // Host control plane only: these functions are never exposed to the worker.
    revoke(participantId:string){if(!seen.has(participantId))throw new Error('UNKNOWN_PARTICIPANT');if(!revoked.has(participantId)){revoked.add(participantId);epoch++;consumed.clear();}},
    shutdown(){closed=true;epoch++;receipts=[];consumed.clear();},
    snapshot:()=>({account,epoch,closed,assent,receipts:receipts.map(r=>({...r})),syntheticOnly:true,productionAuthority:false}),
  };
}
