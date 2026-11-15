import { Buffer } from 'node:buffer';
import {createHash,generateKeyPairSync,sign,verify,createPrivateKey,createPublicKey} from 'node:crypto';
import {canonical, AHIN_ACTIONS, CareError} from './domain.mjs';
export const digest = data => createHash('sha256').update(typeof data==='string'?data:canonical(data)).digest('hex');
export const createSyntheticKey=()=>generateKeyPairSync('ed25519');
export function makeReceipt({ticketId,tenantId,revision,actorId,role,type,grantVersion,at,nonce,commandDigest,stateDigest,previousHash,ahinAction=AHIN_ACTIONS[type]},privateKey) {
  if(!['ASSERT','REASON','DELEGATE','FULFILL','CHALLENGE'].includes(ahinAction))throw new CareError('INVALID_AHIN_ACTION');
  const event={schema:'canopyproof:care-receipt:v2',audience:'canopyproof:care:synthetic',ticketId,tenantId,revision,actorId,role,type,ahinAction,grantVersion,at,nonce,commandDigest,stateDigest,previousHash,
    authority:'SERVER_AUTHENTICATED_SYNTHETIC',externalEffect:'NONE',chainRankDelta:0};
  const hash=digest(event), signature=sign(null,Buffer.from(canonical(event)),privateKey).toString('base64url');
  return {event,hash,signature};
}
export function verifyReceipt(receipt,publicKey) {
  try{return receipt.hash===digest(receipt.event)&&verify(null,Buffer.from(canonical(receipt.event)),publicKey,Buffer.from(receipt.signature,'base64url'));}catch{return false;}
}
export function verifyChain(receipts,publicKey,checkpoint=null) {
  let last='0'.repeat(64), seq=0, ticket,tenant;
  if(!Array.isArray(receipts)||receipts.length===0)return {valid:false,reason:'EMPTY'};
  for(const r of receipts){
    if(!verifyReceipt(r,publicKey)||r.event.revision!==seq+1||r.event.previousHash!==last||r.event.audience!=='canopyproof:care:synthetic')return {valid:false,reason:'BROKEN_CHAIN'};
    if(seq && (r.event.ticketId!==ticket||r.event.tenantId!==tenant))return {valid:false,reason:'MIXED_SCOPE'};
    ticket=r.event.ticketId;tenant=r.event.tenantId;last=r.hash;seq++;
  }
  if(checkpoint && (checkpoint.ticketId!==ticket||checkpoint.revision!==seq||checkpoint.hash!==last))return {valid:false,reason:'CHECKPOINT_MISMATCH'};
  return {valid:true,revision:seq,hash:last,externalAnchorVerified:false};
}
export function assertSigningKey(privatePem,publicPem) {
  const privateKey=createPrivateKey(privatePem),publicKey=createPublicKey(publicPem);
  if(privateKey.asymmetricKeyType!=='ed25519'||publicKey.asymmetricKeyType!=='ed25519')throw new CareError('INVALID_SIGNING_KEY');
  const challenge=Buffer.from('canopyproof:synthetic:key-check');
  if(!verify(null,challenge,publicKey,sign(null,challenge,privateKey)))throw new CareError('SIGNING_KEY_MISMATCH');
  return {privateKey,publicKey};
}
