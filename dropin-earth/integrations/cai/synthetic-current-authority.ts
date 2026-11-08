import {sign,type KeyObject} from 'node:crypto';
import {z} from 'zod';
import {currentAuthorityResponseSchema,type CurrentAuthority} from '../../services/api/src/child-backend/current-authority.js';
import {stableJson} from '../../services/api/src/domain/child-stewardship/store.js';

export const currentAuthorityRequestSchema=z.object({protocol:z.literal('CanopyProof-CurrentRestoreAuthority/1'),
 environment:z.literal('SIMULATION_ONLY'),audience:z.string(),nonce:z.string().regex(/^[A-Za-z0-9_-]{43}$/),sessionId:z.uuid()}).strict();

/** Local fixture provider only. No enrollment, guardian verification or production trust.
 * The caller owns its ephemeral key and atomic synchronous fixture snapshot. Never
 * mount this handler in the product server or supply operational authority keys. */
export function syntheticCurrentAuthorityProvider(options:{environment:'SIMULATION_ONLY';audience:string;privateKey:KeyObject;
 snapshot:(sessionId:string)=>CurrentAuthority|null;now?:()=>number}) {
 if(options.environment!=='SIMULATION_ONLY'||options.privateKey.type!=='private'||options.privateKey.asymmetricKeyType!=='ed25519')throw new Error('SYNTHETIC_AUTHORITY_CONFIGURATION_INVALID');
 let stopped=false;
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
 return {stop:()=>{stopped=true;},async handle(request:Request):Promise<Response>{
  if(stopped)return reply(503,{error:'UNAVAILABLE'});
  const url=new URL(request.url);
  if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/current'||url.search)return reply(404,{error:'NOT_FOUND'});
  if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)return reply(400,{error:'INVALID_REQUEST'});
  const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const read=async()=>{const chunks:Uint8Array[]=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4096)throw new Error('OVERSIZE');chunks.push(part.value);}return Buffer.concat(chunks).toString('utf8');};
   const body=await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DEADLINE')),1000);})]);
   const parsed=currentAuthorityRequestSchema.safeParse(JSON.parse(body));
   if(!parsed.success||parsed.data.audience!==options.audience)return reply(400,{error:'INVALID_REQUEST'});
   if(stopped||request.signal.aborted)return reply(503,{error:'UNAVAILABLE'});
   // No await between snapshot and signing: withdrawal is observed on every request.
   const state=options.snapshot(parsed.data.sessionId);
   if(!state)return reply(404,{error:'NOT_FOUND'});
   const now=(options.now??Date.now)();
   const candidate={...parsed.data,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+20_000).toISOString(),anchor:state.anchor,registry:state.registry};
   const payload=currentAuthorityResponseSchema.shape.payload.parse(candidate);
   if(payload.anchor.sessionId!==parsed.data.sessionId||payload.registry.version!==payload.anchor.keyRegistryVersion)throw new Error('INVALID_SNAPSHOT');
   return reply(200,{payload,signature:sign(null,Buffer.from(stableJson(payload)),options.privateKey).toString('base64url')});
  }catch{return reply(503,{error:'UNAVAILABLE'});}
  finally{if(timer)clearTimeout(timer);void reader.cancel().catch(()=>{});reader.releaseLock();}
 }};
}
