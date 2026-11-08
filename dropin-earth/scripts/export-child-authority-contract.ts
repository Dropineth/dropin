import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {currentAuthorityResponseSchema} from '../services/api/src/child-backend/current-authority.js';
import {currentAuthorityRequestSchema} from '../integrations/cai/synthetic-current-authority.js';

export function childAuthorityContract(){
 const schema=(value:z.ZodType)=>{const {$schema,...result}=z.toJSONSchema(value);void $schema;return result;};
 const hash=z.string().regex(/^[a-f0-9]{64}$/),signature=z.string().regex(/^[A-Za-z0-9_-]{86}$/);
 const checkpoint=z.object({protocol:z.literal('CanopyProof-RestoreCheckpoint/1'),environment:z.literal('SIMULATION_ONLY'),domainSeparator:z.literal('canopyproof:synthetic:restore:v1'),
  checkpointId:z.string(),sequence:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),sessionId:z.string(),keyRegistryVersion:z.string(),
  issuedAt:z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/),expiresAt:z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/),
  roots:z.object({canonical:hash,security:hash,privacy:hash}).strict()}).strict();
 const json=(ref:string)=>({'application/json':{schema:{$ref:`#/components/schemas/${ref}`}}});
 return {openapi:'3.1.0',info:{title:'AHIN Signer Profile v1 — CanopyProof synthetic integration contract',version:'1.0.0',
  description:'Product-local contract export. Not an approved AHIN wire/signing profile or production guardian authority. See README.md for mandatory signing and semantic validation.'},
  'x-authority-status':'SIMULATION_ONLY; no production authority established',
  servers:[{url:'http://127.0.0.1:{port}',description:'Isolated fixture handler only; not a deployed service',variables:{port:{default:'8080'}}}],
  paths:{'/current':{post:{operationId:'readSyntheticCurrentRestoreAuthority','x-implementation-status':'unmounted fixture handler',
   description:'Nonce-bound signed current snapshot. No standalone revocation-list or recovery API is implemented.',
   requestBody:{required:true,content:json('CurrentAuthorityRequest')},responses:{'200':{description:'Signed snapshot; client must verify all semantic rules',content:json('SignedSnapshot')},
    ...Object.fromEntries([400,404,405,503].map(status=>[String(status),{description:'Fixture error; caller treats every non-200 as unavailable',content:json('ProviderError')}]))}}}},
  components:{schemas:{CurrentAuthorityRequest:schema(currentAuthorityRequestSchema),SignedSnapshot:schema(currentAuthorityResponseSchema),
   Registry:schema(currentAuthorityResponseSchema.shape.payload.shape.registry),
   SignedRestoreCheckpoint:{...schema(z.object({checkpoint,signatures:z.array(z.object({keyId:z.string(),signature}).strict()).min(2).max(8)}).strict()),
    description:'Internal verifyAndAdmit argument, NOT an HTTP recovery endpoint. Session supplied separately must match the current trusted anchor. Outer/signature objects are profile-strict; current verifier also tolerates extra fields there.'},
   ResumeRequest:{...schema(z.object({resumeTicket:z.string().regex(/^cp-resume\.[A-Za-z0-9_-]{43}$/)}).strict()),description:'Existing synthetic resume/cancel-resume body; possession ticket, not IdP identity recovery. Bad ticket string shape is rejected by store with 401.'},
   ProviderError:schema(z.object({error:z.enum(['UNAVAILABLE','NOT_FOUND','METHOD_NOT_ALLOWED','INVALID_REQUEST'])}).strict())}}};
}
if(process.argv[1]?.endsWith('export-child-authority-contract.ts'))writeFileSync('contracts/ahin-signer-profile/v1/openapi.json',JSON.stringify(childAuthorityContract(),null,2)+'\n');
