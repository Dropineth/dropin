import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import test from 'node:test';
import {childAuthorityContract} from '../../scripts/export-child-authority-contract.js';
import {stableJson} from '../../services/api/src/domain/child-stewardship/store.js';
import {currentAuthorityClient,currentAuthorityResponseSchema} from '../../services/api/src/child-backend/current-authority.js';
import {currentAuthorityRequestSchema} from '../../integrations/cai/synthetic-current-authority.js';

const directory='contracts/ahin-signer-profile/v1/';
const fixture=JSON.parse(readFileSync(directory+'fixtures.json','utf8'));
test('frozen OpenAPI matches implementation-derived schemas and public signing vector',()=>{
 assert.deepEqual(JSON.parse(readFileSync(directory+'openapi.json','utf8')),childAuthorityContract());
 assert.ok(currentAuthorityRequestSchema.safeParse(fixture.request).success);
 assert.ok(currentAuthorityResponseSchema.safeParse(fixture.response).success);
 const bytes=Buffer.from(stableJson(fixture.response.payload));
 assert.equal(bytes.toString('hex'),fixture.canonicalUtf8Hex);
 assert.equal(verify(null,bytes,fixture.publicKey,Buffer.from(fixture.response.signature,'base64url')),true);
 assert.equal(verify(null,Buffer.from(JSON.stringify(fixture.response.payload)),fixture.publicKey,Buffer.from(fixture.response.signature,'base64url')),false,'ordinary JSON order is not signing encoding');
 for(const mutation of fixture.schemaNegativeMutations){const value=structuredClone(fixture.response);let target=value;for(const key of mutation.path.slice(0,-1))target=target[key];target[mutation.path.at(-1)]=mutation.value;assert.equal(currentAuthorityResponseSchema.safeParse(value).success,false);}
 const restored=Buffer.from(stableJson(fixture.restoreVector.signed.checkpoint));
 assert.equal(restored.toString('hex'),fixture.restoreVector.canonicalUtf8Hex);
 for(const [i,approval] of fixture.restoreVector.signed.signatures.entries())assert.ok(verify(null,restored,fixture.restoreVector.publicKeys[i],Buffer.from(approval.signature,'base64url')));
 assert.throws(()=>stableJson({value:0.5}));
});

test('contract-shaped but semantically invalid signed snapshots fail actual client',async()=>{
 const key=generateKeyPairSync('ed25519');
 type Payload=typeof currentAuthorityResponseSchema._output.payload;
 const mutations:Array<(payload:Payload)=>void>=[()=>{},p=>{p.nonce=fixture.request.nonce;},p=>{p.audience='wrong';},p=>{p.sessionId='22222222-2222-4222-8222-222222222222';},p=>{p.expiresAt='2026-11-04T00:01:00.000Z';},p=>{p.expiresAt=p.issuedAt;},p=>{p.registry.keys[1]!.revoked=true;},p=>{p.registry.keys[1]!.publicKey=p.registry.keys[0]!.publicKey;},p=>{p.registry.version='wrong';}];
 for(const [index,mutate] of mutations.entries()){
  const client=currentAuthorityClient({url:'https://fixture.invalid/current',audience:fixture.request.audience,publicKey:key.publicKey.export({format:'pem',type:'spki'}).toString(),now:()=>Date.parse('2026-11-04T00:00:01.000Z'),fetch:async(_url,init)=>{
   const payload:Payload=structuredClone(fixture.response.payload);payload.nonce=JSON.parse(String(init?.body)).nonce;mutate(payload);
   assert.ok(currentAuthorityResponseSchema.safeParse({payload,signature:fixture.response.signature}).success,'shape alone cannot establish authority');
   return Response.json({payload,signature:sign(null,Buffer.from(stableJson(payload)),key.privateKey).toString('base64url')});
  }});
  if(index===0)assert.equal((await client(fixture.request.sessionId)).anchor.sequence,1);
  else await assert.rejects(client(fixture.request.sessionId),/CURRENT_RESTORE_AUTHORITY_UNAVAILABLE/);
 }
});
