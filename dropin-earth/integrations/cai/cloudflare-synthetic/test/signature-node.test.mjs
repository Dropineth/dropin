import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
// Exercise the existing API's actual primitive, not a copied expected verifier.
import {verifyChildSignatureBytes} from '../../../../services/api/src/domain/child-stewardship/signature.ts';
import {signatureCases} from './signature-cases.ts';
test('three interoperability vectors match the checked-in AHIN public contract',()=>{
 const contract=JSON.parse(readFileSync(new URL('../../../../contracts/ahin-signer-profile/v1/fixtures.json',import.meta.url),'utf8'));
 const local=JSON.parse(readFileSync(new URL('./signature-vectors.json',import.meta.url),'utf8'));
 assert.equal(contract.syntheticOnly,true);assert.equal(local.syntheticOnly,true);
 const expected=[{publicKey:contract.publicKey,payloadHex:contract.canonicalUtf8Hex,signatureHex:Buffer.from(contract.response.signature,'base64url').toString('hex')},
  ...contract.restoreVector.signed.signatures.map((s,i)=>({publicKey:contract.restoreVector.publicKeys[i],payloadHex:contract.restoreVector.canonicalUtf8Hex,signatureHex:Buffer.from(s.signature,'base64url').toString('hex')}))];
 assert.deepEqual(local.vectors.slice(0,3).map(({label,...v})=>v),expected);
});
for(const value of signatureCases())test('Existing Node verifier: '+value.label,()=>{
 assert.deepEqual(verifyChildSignatureBytes(value.input),value.expected);
});
