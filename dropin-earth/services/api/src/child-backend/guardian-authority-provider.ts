import {Buffer} from 'node:buffer';
import {randomBytes} from 'node:crypto';
import {clearTimeout,setTimeout} from 'node:timers';
import {URL} from 'node:url';
import {z} from 'zod';
import {childEd25519KeyIdentity,verifyChildSignatureBytes} from '../domain/child-stewardship/signature.js';
import {stableJson} from '../domain/child-stewardship/store.js';

const id=z.string().regex(/^[A-Za-z0-9:_-]{1,160}$/);
const timestamp=z.iso.datetime({precision:3});
const scopeSchema=z.object({sessionId:z.uuid(),childSubjectId:id,guardianSubjectId:id,
  operation:z.enum(['enrollment','session','recovery']),minimumSequence:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict();
const configurationSchema=z.object({endpoint:z.string(),issuerId:id,keyId:id,publicKey:z.string().max(1024),audience:id}).strict();
const statementSchema=z.object({protocol:z.literal('CanopyProof-GuardianAuthorityObservation/1'),
  issuerId:id,keyId:id,audience:id,nonce:z.string().regex(/^[A-Za-z0-9_-]{43}$/),request:scopeSchema,
  issuedAt:timestamp,expiresAt:timestamp,sequence:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  relationship:z.object({subjectType:z.literal('human-guardian'),status:z.enum(['active','revoked','suspended']),
    validFrom:timestamp,validUntil:timestamp}).strict(),
}).strict();
const envelopeSchema=z.object({statement:statementSchema,signature:z.string().regex(/^[A-Za-z0-9_-]{86}$/)}).strict();

export type GuardianAuthorityScope=z.infer<typeof scopeSchema>;
export type GuardianAuthorityConfiguration=z.infer<typeof configurationSchema>;
export type GuardianAuthorityObservation=
  | {kind:'unavailable';authorizationGranted:false}
  | {kind:'signed-attestation';authorizationGranted:false;statement:z.infer<typeof statementSchema>};
export interface GuardianAuthorityProvider {
  observe(scope:GuardianAuthorityScope):Promise<GuardianAuthorityObservation>;
}
const unavailable=():GuardianAuthorityObservation=>({kind:'unavailable',authorizationGranted:false});

/** Proposed external-service observation contract, NOT an AHIN standard or an
 * authorization grant. No signer, enrollment route, fixture root or production
 * mode is installed. Trust in an issuer's legal authority must be established
 * independently before configuring a real integration. A signature only proves
 * attribution to the pinned key; it does not prove legal guardianship.
 *
 * Defaults closed. Deliberately not wired into createChildBackend. The existing
 * SIMULATION_ONLY restore protocol is unchanged. No response can mint a session,
 * approve a recovery, or make a cross-service revocation/commit fence atomic. */
export function createGuardianAuthorityProvider(options:{configuration?:GuardianAuthorityConfiguration;
  fetch?:typeof fetch;now?:()=>number}={}):GuardianAuthorityProvider {
  if(!options.configuration)return {observe:async()=>unavailable()};
  const parsed=configurationSchema.safeParse(options.configuration);
  if(!parsed.success)throw new Error('GUARDIAN_AUTHORITY_CONFIGURATION_INVALID');
  const config=Object.freeze({...parsed.data});
  let endpoint:URL;
  try{endpoint=new URL(config.endpoint);}catch{throw new Error('GUARDIAN_AUTHORITY_CONFIGURATION_INVALID');}
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash
    ||!childEd25519KeyIdentity(config.publicKey))throw new Error('GUARDIAN_AUTHORITY_CONFIGURATION_INVALID');
  const fetcher=options.fetch??fetch,now=options.now??Date.now;
  let lastObservedTime=-Infinity;
  const time=()=>{
    const moment=now();
    if(!Number.isSafeInteger(moment)||moment<lastObservedTime)throw new Error('CLOCK_UNAVAILABLE');
    lastObservedTime=moment;return moment;
  };
  return {async observe(input){
    const scope=scopeSchema.safeParse(input);
    if(!scope.success)return unavailable();
    // A parsed copy prevents callers changing scope while the read is pending.
    const request=scope.data,nonce=randomBytes(32).toString('base64url');
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const read=async():Promise<GuardianAuthorityObservation>=>{
      time();
      const response=await fetcher(endpoint.href,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({protocol:'CanopyProof-GuardianAuthorityObservation/1',issuerId:config.issuerId,audience:config.audience,nonce,request})});
      if(response.status!==200||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json'||!response.body){
        void response.body?.cancel().catch(()=>{});return unavailable();
      }
      if(controller.signal.aborted){void response.body.cancel().catch(()=>{});return unavailable();}
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
      const cancel=()=>{void reader.cancel().catch(()=>{});};
      controller.signal.addEventListener('abort',cancel,{once:true});
      try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>16_384)return unavailable();chunks.push(next.value);}}
      finally{controller.signal.removeEventListener('abort',cancel);cancel();reader.releaseLock();}
      if(controller.signal.aborted)return unavailable();
      const envelope=envelopeSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      if(!envelope.success)return unavailable();
      const {statement,signature}=envelope.data,moment=time();
      if(statement.issuerId!==config.issuerId||statement.keyId!==config.keyId||statement.audience!==config.audience||statement.nonce!==nonce
        ||stableJson(statement.request)!==stableJson(request)||statement.sequence<request.minimumSequence
        ||statement.relationship.status!=='active'||Date.parse(statement.relationship.validFrom)>moment
        ||Date.parse(statement.relationship.validUntil)<=moment||Date.parse(statement.issuedAt)>moment
        ||Date.parse(statement.expiresAt)<=moment||Date.parse(statement.expiresAt)-Date.parse(statement.issuedAt)>30_000
        ||Date.parse(statement.expiresAt)>Date.parse(statement.relationship.validUntil))return unavailable();
      const bytes=Buffer.from(stableJson(statement)),raw=Buffer.from(signature,'base64url');
      if(raw.toString('base64url')!==signature||!verifyChildSignatureBytes({algorithm:'Ed25519',expectedPayload:bytes,signedPayload:bytes,
        signature:raw,registeredPublicKey:config.publicKey}).valid)return unavailable();
      return {kind:'signed-attestation',authorizationGranted:false,statement};
    };
    try{return await Promise.race([read(),new Promise<GuardianAuthorityObservation>(resolve=>{
      timer=setTimeout(()=>{controller.abort();resolve(unavailable());},3000);
    })]);}catch{return unavailable();}finally{if(timer)clearTimeout(timer);controller.abort();}
  }};
}
