import {expect,it} from 'vitest';
import {verifyChildSignatureWebCrypto} from '../src/signature';
import {signatureCases} from './signature-cases';

for(const value of signatureCases())it('Web Crypto matches Node contract: '+value.label,async()=>{
 expect(await verifyChildSignatureWebCrypto(value.input)).toEqual(value.expected);
});
it('snapshot before await prevents caller mutation of original byte views',async()=>{
 const {input}=signatureCases()[0]!;
 const result=verifyChildSignatureWebCrypto(input);
 input.expectedPayload.fill(0);input.signedPayload.fill(0);input.signature.fill(0);input.registeredPublicKey='invalid';
 expect(await result).toEqual({valid:true});
});
