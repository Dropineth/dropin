import assert from 'node:assert/strict';
import test from 'node:test';
import {Buffer} from 'node:buffer';
import vector from './authorization-vector.json' with {type:'json'};
import {syntheticCommitBytes} from '../src/authorization.ts';
import {verifyChildSignatureBytes} from '../../../../services/api/src/domain/child-stewardship/signature.ts';
const payload=Buffer.from(vector.canonicalUtf8);
const input={algorithm:'Ed25519',expectedPayload:payload,signedPayload:payload,signature:Buffer.from(vector.signatureHex,'hex'),registeredPublicKey:vector.publicKey};
test('synthetic encoder matches independently constructed literal Node-signed bytes',()=>{
 assert.equal(vector.syntheticOnly,true);
 assert.deepEqual(syntheticCommitBytes(vector.fields,vector.objectAudience),new Uint8Array(payload));
});
test('actual backend Node verifier accepts public synthetic DO envelope vector',()=>{
 assert.deepEqual(verifyChildSignatureBytes(input),{valid:true});
});
for(const [field,value] of [['role','AI'],['audience','another-object'],['scope','synthetic-other'],['expiresAt',vector.fields.expiresAt+1]]){
 test('actual backend Node verifier rejects signed envelope substitution: '+field,()=>{
  const changed={...JSON.parse(vector.canonicalUtf8),[field]:value},bytes=Buffer.from(JSON.stringify(changed));
  assert.deepEqual(verifyChildSignatureBytes({...input,expectedPayload:bytes,signedPayload:bytes}),{valid:false,reason:'INVALID_SIGNATURE'});
 });
}
