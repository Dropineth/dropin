import data from './signature-vectors.json' with {type:'json'};
import type {SignatureInput,SignatureResult} from '../src/signature';
const bytes=(hex:string)=>Uint8Array.from(hex.match(/../g)??[],b=>parseInt(b,16));
const changed=(v:Uint8Array)=>{const r=new Uint8Array(v);r[0]^=1;return r;};
export function signatureCases():{label:string;input:SignatureInput;expected:SignatureResult}[]{
 const cases:{label:string;input:SignatureInput;expected:SignatureResult}[]=[];
 for(const [i,v]of data.vectors.entries()){
  const base:SignatureInput={algorithm:'Ed25519',expectedPayload:bytes(v.payloadHex),signedPayload:bytes(v.payloadHex),signature:bytes(v.signatureHex),registeredPublicKey:v.publicKey};
  const add=(label:string,change:Partial<SignatureInput>,expected:SignatureResult)=>cases.push({label:v.label+': '+label,input:{...base,...change},expected});
  add('valid synthetic signature',{}, {valid:true});
  add('CRLF public-key alias',{registeredPublicKey:v.publicKey.replaceAll('\n','\r\n')},{valid:true});
  add('wrong expected bytes',{expectedPayload:changed(base.expectedPayload)},{valid:false,reason:'PAYLOAD_MISMATCH'});
  add('wrong signed bytes',{signedPayload:changed(base.signedPayload)},{valid:false,reason:'PAYLOAD_MISMATCH'});
  add('tampered signature',{signature:changed(base.signature)},{valid:false,reason:'INVALID_SIGNATURE'});
  add('short signature',{signature:base.signature.slice(0,63)},{valid:false,reason:'INVALID_SIGNATURE'});
  add('oversized signature',{signature:new Uint8Array(65_537)},{valid:false,reason:'INVALID_SIGNATURE'});
  const detachedBuffer=new ArrayBuffer(64),detachedSignature=new Uint8Array(detachedBuffer);
  structuredClone(detachedBuffer,{transfer:[detachedBuffer]});
  add('detached signature',{signature:detachedSignature},{valid:false,reason:'INVALID_SIGNATURE'});
  add('wrong registered key',{registeredPublicKey:data.vectors[(i+1)%data.vectors.length]!.publicKey},{valid:false,reason:'INVALID_SIGNATURE'});
  add('private-key header is not accepted',{registeredPublicKey:v.publicKey.replaceAll('PUBLIC KEY','PRIVATE KEY')},{valid:false,reason:'INVALID_PUBLIC_KEY'});
  add('malformed key',{registeredPublicKey:'invalid'},{valid:false,reason:'INVALID_PUBLIC_KEY'});
  add('empty payload',{expectedPayload:new Uint8Array(),signedPayload:new Uint8Array()},{valid:false,reason:'INVALID_INPUT'});
  add('oversized payload',{expectedPayload:new Uint8Array(65_537),signedPayload:new Uint8Array(65_537)},{valid:false,reason:'INVALID_INPUT'});
  add('ES256 not silently reinterpreted',{algorithm:'ES256'},{valid:false,reason:'UNSUPPORTED_ALGORITHM'});
  add('WebAuthn not raw-message signature',{algorithm:'WebAuthn'},{valid:false,reason:'UNSUPPORTED_ALGORITHM'});
 }
 return cases;
}
