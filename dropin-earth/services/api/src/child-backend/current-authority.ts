import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {stableJson} from '../domain/child-stewardship/store.js';
import {verifyChildSignatureBytes} from '../domain/child-stewardship/signature.js';
import type {RestoreAnchor,RestoreCheckpointKey} from '../domain/child-stewardship/restore-checkpoint.js';

const timestamp = z.iso.datetime({precision:3});
const id = z.string().regex(/^[A-Za-z0-9:_-]{1,160}$/);
const registryKey = z.object({keyId:id,role:z.enum(['protection','trustee']),controlDomain:id,
  independentOfOperator:z.boolean(),publicKey:z.string().max(1024),revoked:z.boolean(),validAfter:timestamp,expiresAt:timestamp}).strict();
const responseSchema = z.object({
  payload:z.object({protocol:z.literal('CanopyProof-CurrentRestoreAuthority/1'),environment:z.literal('SIMULATION_ONLY'),
    audience:id,nonce:z.string().regex(/^[A-Za-z0-9_-]{43}$/),sessionId:z.uuid(),issuedAt:timestamp,expiresAt:timestamp,
    anchor:z.object({checkpointId:id,sequence:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),digest:z.string().regex(/^[a-f0-9]{64}$/),sessionId:z.uuid(),keyRegistryVersion:id}).strict(),
    registry:z.object({version:id,keys:z.array(registryKey).min(2).max(8)}).strict(),
  }).strict(),signature:z.string().regex(/^[A-Za-z0-9_-]{86}$/),
}).strict();
export type CurrentAuthority = {anchor:RestoreAnchor;registry:{version:string;keys:RestoreCheckpointKey[]}};
const unavailable = (): never => { throw new Error('CURRENT_RESTORE_AUTHORITY_UNAVAILABLE'); };
/** Product transport contract, not a Life++ protocol change or an independence claim.
 * A fresh nonce-bound response is required on EVERY call; no cached rollback floor. */
export function currentAuthorityClient(options:{url:string;publicKey:string;audience:string;fetch?:typeof fetch;now?:()=>number}) {
  const fetcher = options.fetch ?? fetch, now = options.now ?? Date.now;
  return async (sessionId:string):Promise<CurrentAuthority> => {
    if(!z.uuid().safeParse(sessionId).success) return unavailable();
    const nonce = randomBytes(32).toString('base64url'), controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async ():Promise<CurrentAuthority> => {
      const response = await fetcher(options.url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({protocol:'CanopyProof-CurrentRestoreAuthority/1',environment:'SIMULATION_ONLY',audience:options.audience,nonce,sessionId})});
      if(response.status!==200 || !response.headers.get('content-type')?.startsWith('application/json') || !response.body) return unavailable();
      const reader = response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
      try {
        for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65_536)return unavailable();chunks.push(part.value);}
      } finally { await reader.cancel().catch(()=>{}); }
      const parsed = responseSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      if(!parsed.success) return unavailable();
      const {payload,signature} = parsed.data, moment=now();
      if(payload.sessionId!==sessionId || payload.anchor.sessionId!==sessionId || payload.nonce!==nonce || payload.audience!==options.audience
        || payload.registry.version!==payload.anchor.keyRegistryVersion || Date.parse(payload.issuedAt)>moment
        || Date.parse(payload.expiresAt)<=moment || Date.parse(payload.expiresAt)-Date.parse(payload.issuedAt)>30_000
        || new Set(payload.registry.keys.map(key=>key.keyId)).size!==payload.registry.keys.length) return unavailable();
      const bytes=Buffer.from(stableJson(payload)), raw=Buffer.from(signature,'base64url');
      if(raw.toString('base64url')!==signature || !verifyChildSignatureBytes({algorithm:'Ed25519',expectedPayload:bytes,signedPayload:bytes,signature:raw,registeredPublicKey:options.publicKey}).valid) return unavailable();
      // Signed membership is still subject to current eligibility and quorum checks.
      const eligible=payload.registry.keys.filter(key=>!key.revoked && key.independentOfOperator && Date.parse(key.validAfter)<=moment && Date.parse(key.expiresAt)>moment);
      if(!eligible.some(a=>a.role==='protection' && eligible.some(b=>b.role==='trustee' && a.controlDomain!==b.controlDomain))) return unavailable();
      return {anchor:payload.anchor,registry:payload.registry};
    };
    try {
      return await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('CURRENT_RESTORE_AUTHORITY_UNAVAILABLE'));},3000);})]);
    } catch { return unavailable(); }
    finally { if(timer)clearTimeout(timer);controller.abort(); }
  };
}
