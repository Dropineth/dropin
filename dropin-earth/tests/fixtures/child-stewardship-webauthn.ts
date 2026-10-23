import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";

/** Minimal synthetic CTAP/WebAuthn byte fixture, not a production authenticator.
 * Keys exist only in process memory; server verification is done by SimpleWebAuthn.
 */
function head(major: number, size: number): Buffer {
  if(size<24)return Buffer.from([(major<<5)|size]);
  if(size<256)return Buffer.from([(major<<5)|24,size]);
  const prefix=Buffer.alloc(3);prefix[0]=(major<<5)|25;prefix.writeUInt16BE(size,1);return prefix;
}
function cbor(value: string | number | Uint8Array | Map<string | number, unknown>): Buffer {
  if(typeof value==="number")return head(value>=0?0:1,value>=0?value:-1-value);
  if(typeof value==="string"){const bytes=Buffer.from(value);return Buffer.concat([head(3,bytes.length),bytes]);}
  if(value instanceof Map)return Buffer.concat([head(5,value.size),...[...value].flatMap(([key,item])=>[cbor(key),cbor(item as Parameters<typeof cbor>[0])])]);
  return Buffer.concat([head(2,value.length),Buffer.from(value)]);
}
const hash=(value:string|Uint8Array)=>createHash("sha256").update(value).digest();
export function syntheticAuthenticator(configuration: { credentialId?: string; algorithm?: -7 | -8 } = {}) {
  const pair=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
  const jwk=pair.publicKey.export({format:"jwk"});
  const publicKey=cbor(new Map<number,unknown>([[1,2],[3,configuration.algorithm??-7],[-1,1],[-2,Buffer.from(jwk.x!,"base64url")],[-3,Buffer.from(jwk.y!,"base64url")]]));
  const credentialBytes=configuration.credentialId?Buffer.from(configuration.credentialId,"base64url"):randomBytes(32);const credentialId=credentialBytes.toString("base64url");
  const fixture={credentialId,publicKeySha256:hash(publicKey).toString("hex")};
  type Options={challenge:string;rp?:string;origin?:string;uv?:boolean;up?:boolean;counter?:number;crossOrigin?:boolean;userHandle?:string};
  function clientData(type:string,options:Options) {
    return Buffer.from(JSON.stringify({type,challenge:options.challenge,origin:options.origin??"https://webauthn.synthetic.invalid",crossOrigin:options.crossOrigin??false}));
  }
  function authData(options:Options,attested:boolean) {
    const header=Buffer.alloc(37);hash(options.rp??"webauthn.synthetic.invalid").copy(header);
    header[32]=(options.up===false?0:1)|(options.uv===false?0:4)|(attested?64:0);
    header.writeUInt32BE(options.counter??0,33);
    if(!attested)return header;
    const idLength=Buffer.alloc(2);idLength.writeUInt16BE(credentialBytes.length);
    return Buffer.concat([header,Buffer.alloc(16),idLength,credentialBytes,publicKey]);
  }
  return {
    fixture,publicKey,
    registration(options:Options):RegistrationResponseJSON {
      const attestation=cbor(new Map<string,unknown>([["fmt","none"],["attStmt",new Map()],["authData",authData(options,true)]]));
      return {id:credentialId,rawId:credentialId,type:"public-key",clientExtensionResults:{},authenticatorAttachment:"platform",
        response:{clientDataJSON:clientData("webauthn.create",options).toString("base64url"),attestationObject:attestation.toString("base64url"),transports:["internal"]}};
    },
    authentication(options:Options):AuthenticationResponseJSON {
      const client=clientData("webauthn.get",options);const data=authData(options,false);
      return {id:credentialId,rawId:credentialId,type:"public-key",clientExtensionResults:{},authenticatorAttachment:"platform",
        response:{clientDataJSON:client.toString("base64url"),authenticatorData:data.toString("base64url"),
          signature:sign("sha256",Buffer.concat([data,hash(client)]),pair.privateKey).toString("base64url"),
          ...(options.userHandle?{userHandle:options.userHandle}:{})}};
    },
  };
}
