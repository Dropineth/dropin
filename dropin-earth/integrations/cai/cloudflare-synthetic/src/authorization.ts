/** Synthetic-only envelope, NOT the production AHIN signer/WebAuthn profile.
 * Use validated primitive fields. No caller-supplied role, algorithm or audience.
 * This module exports serialization only, never a private key or signing API.
 */
export type SignedCommitFields={scope:string;proposalId:string;commandId:string;digest:string;nonce:string;expectedEpoch:number;expiresAt:number;keyId:string;keyRevision:number};
export function syntheticCommitBytes(v:SignedCommitFields,objectAudience:string):Uint8Array<ArrayBuffer>{
 return new TextEncoder().encode(JSON.stringify({profile:'canopyproof.synthetic-do.commit.v1',action:'commit-synthetic-e0',
  audience:objectAudience,scope:v.scope,role:'guardian-fixture',keyId:v.keyId,keyRevision:v.keyRevision,
  proposalId:v.proposalId,commandId:v.commandId,digest:v.digest,nonce:v.nonce,expectedEpoch:v.expectedEpoch,expiresAt:v.expiresAt}));
}
