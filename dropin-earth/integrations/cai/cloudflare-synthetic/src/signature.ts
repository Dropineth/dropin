/** Web Crypto primitive only. This does not establish a human, guardian, current
 * registry membership, consent, quorum or restore admission. The registered key
 * and exact expected envelope must come from a trusted caller, not the signer.
 * No signing facility is exported; WebAuthn/ES256 are deliberately unsupported.
 */
export type SignatureResult={valid:true}|{valid:false;reason:'INVALID_INPUT'|'UNSUPPORTED_ALGORITHM'|'PAYLOAD_MISMATCH'|'INVALID_PUBLIC_KEY'|'INVALID_SIGNATURE'};
export type SignatureInput={algorithm:string;expectedPayload:Uint8Array;signedPayload:Uint8Array;signature:Uint8Array;registeredPublicKey:string};
const invalid=(reason:Extract<SignatureResult,{valid:false}>['reason']):SignatureResult=>({valid:false,reason});
export async function verifyChildSignatureWebCrypto(input:SignatureInput):Promise<SignatureResult>{
 if(!input||typeof input!=='object')return invalid('INVALID_INPUT');
 if(input.algorithm!=='Ed25519')return invalid('UNSUPPORTED_ALGORITHM');
 if(!(input.expectedPayload instanceof Uint8Array)||!(input.signedPayload instanceof Uint8Array)||!(input.signature instanceof Uint8Array)
  ||input.expectedPayload.byteLength===0||input.expectedPayload.byteLength>65_536||input.signedPayload.byteLength!==input.expectedPayload.byteLength)return invalid('INVALID_INPUT');
 // Snapshot all mutable byte inputs before the first await. A caller mutation
 // during import/verify cannot substitute another envelope after comparison.
 let expected:Uint8Array<ArrayBuffer>,payload:Uint8Array<ArrayBuffer>,signature:Uint8Array<ArrayBuffer>;
 try{expected=new Uint8Array(input.expectedPayload);payload=new Uint8Array(input.signedPayload);}
 catch{return invalid('INVALID_INPUT');}
 let difference=0;for(let i=0;i<expected.length;i++)difference|=expected[i]!^payload[i]!;
 if(difference!==0)return invalid('PAYLOAD_MISMATCH');
 if(input.signature.byteLength!==64)return invalid('INVALID_SIGNATURE');
 try{signature=new Uint8Array(input.signature);}catch{return invalid('INVALID_SIGNATURE');}
 const bytes=decodeEd25519PublicKey(input.registeredPublicKey);
 if(!bytes)return invalid('INVALID_PUBLIC_KEY');
 let key:CryptoKey;
 try{key=await crypto.subtle.importKey('spki',bytes,{name:'Ed25519'},false,['verify']);}
 catch{return invalid('INVALID_PUBLIC_KEY');}
 try{return await crypto.subtle.verify({name:'Ed25519'},key,signature,payload)?{valid:true}:invalid('INVALID_SIGNATURE');}
 catch{return invalid('INVALID_SIGNATURE');}
}

/** Bounded canonical public-key encoding check, not identity or possession. */
export function decodeEd25519PublicKey(pem:unknown):Uint8Array<ArrayBuffer>|undefined{
 if(typeof pem!=='string'||pem.length>1024||!pem.startsWith('-----BEGIN PUBLIC KEY-----'))return undefined;
 try{
  const match=/^-----BEGIN PUBLIC KEY-----\r?\n([A-Za-z0-9+/=\r\n]+)-----END PUBLIC KEY-----\r?\n?$/.exec(pem);
  if(!match)return undefined;
  const encoded=match[1]!.replace(/[\r\n]/g,'');
  const decoded=atob(encoded);if(btoa(decoded)!==encoded)return undefined;
  const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
  const header=[0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00];
  if(bytes.length!==44||header.some((v,i)=>bytes[i]!==v))return undefined;
  return bytes;
 }catch{return undefined;}
}
