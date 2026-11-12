import {expect,it} from 'vitest';
import {verifyChildSignatureWebCrypto} from '../src/signature';
import {signatureCases} from './signature-cases';
const pem=(encoded:string)=>`-----BEGIN PUBLIC KEY-----\n${encoded}\n-----END PUBLIC KEY-----\n`;
const original=signatureCases()[0]!.input;
const body=original.registeredPublicKey.split('\n')[1]!;
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const padIndex=body.indexOf('=')-1;
const noncanonical=body.slice(0,padIndex)+alphabet[alphabet.indexOf(body[padIndex]!)^1]+body.slice(padIndex+1);
const der=atob(body),wrongOid=der.slice(0,8)+String.fromCharCode(0x71)+der.slice(9);
const cases=[
 ['noncanonical base64 padding bits',pem(noncanonical)],
 ['wrong SPKI OID',pem(btoa(wrongOid))],
 ['trailing DER bytes',pem(btoa(der+'\0'))],
 ['malformed PEM boundary',original.registeredPublicKey.replace('-----END PUBLIC KEY-----','-----END PRIVATE KEY-----')],
 ['space inside PEM body',pem(body.slice(0,20)+' '+body.slice(20))],
 ['trailing PEM text',original.registeredPublicKey+'trailing text'],
] as const;
for(const [label,key]of cases)it('explicitly narrow public-key parser rejects '+label,async()=>{
 expect(await verifyChildSignatureWebCrypto({...original,registeredPublicKey:key})).toEqual({valid:false,reason:'INVALID_PUBLIC_KEY'});
});
