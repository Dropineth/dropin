import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSyntheticAccountNetwork,networkSigningBytes,type NetworkRequest} from '../../integrations/cai/synthetic-account-network.js';
import {createChildTwinOrchestration} from '../../integrations/cai/child-twin-orchestration.js';

function fixture(){
  let now=1000;
  const keys=[0,1].map(()=>generateKeyPairSync('ed25519'));
  const participants=keys.map((key,i)=>({id:`synthetic-guardian-${i}`,principal:`synthetic-human-${i}`,role:'verified-guardian-fixture' as const,publicKey:key.publicKey.export({type:'spki',format:'pem'}).toString()}));
  const network=createSyntheticAccountNetwork('synthetic-account',participants,()=>now);
  const request:NetworkRequest={profile:'CanopyProof-Synthetic-CAI/2',account:'synthetic-account',epoch:0,nonce:'synthetic-proposal',action:'learning-review',evidenceDigest:'a'.repeat(64),expiresAt:2000};
  const approvals=()=>keys.map((key,i)=>({participant:participants[i]!.id,signature:sign(null,networkSigningBytes(request),key.privateKey).toString('base64url')}));
  return {network,request,approvals,setTime:(value:number)=>{now=value;}};
}

test('foreign, stale, expired, overlong and consumed proposals never reach the inference provider',async()=>{
  for(const mode of ['account','epoch','expired','overlong','consumed'] as const){
    const f=fixture();let calls=0;
    if(mode==='account')f.request.account='synthetic-other-account';
    if(mode==='epoch')f.request.epoch=1;
    if(mode==='expired')f.setTime(2000);
    if(mode==='overlong')f.request.expiresAt=31001;
    if(mode==='consumed'){f.network.recordChildAssent(f.request);f.network.commit(f.request,f.approvals());}
    const twin=createChildTwinOrchestration(f.network,{async propose(input){calls++;return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
    await assert.rejects(twin.propose(f.request),/AUTHORITY_UNAVAILABLE/,mode);
    assert.equal(calls,0,mode);assert.equal(twin.snapshot().state,'denied');
  }
});

test('account epoch changes before the provider microtask prevent invocation',async()=>{
  const f=fixture();let calls=0;
  const twin=createChildTwinOrchestration(f.network,{async propose(input){calls++;return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
  const pending=twin.propose(f.request);f.network.revoke('synthetic-guardian-0');
  await assert.rejects(pending,/AUTHORITY_UNAVAILABLE/);assert.equal(calls,0);assert.equal(twin.snapshot().state,'denied');
});

test('expiry, revocation or nonce consumption during inference prevents a consent handoff',async()=>{
  for(const mode of ['expired','revoked','consumed'] as const){
    const f=fixture();let complete!:(value:unknown)=>void,started!:()=>void;
    const began=new Promise<void>(resolve=>{started=resolve;});
    const twin=createChildTwinOrchestration(f.network,{propose(){started();return new Promise(resolve=>{complete=resolve;});}});
    const pending=twin.propose(f.request);await began;
    if(mode==='expired')f.setTime(2000);
    if(mode==='revoked')f.network.revoke('synthetic-guardian-0');
    if(mode==='consumed'){f.network.recordChildAssent(f.request);f.network.commit(f.request,f.approvals());}
    complete({kind:'learning-review-proposal',evidenceDigest:f.request.evidenceDigest,tools:[]});
    await assert.rejects(pending,/AUTHORITY_UNAVAILABLE/,mode);assert.equal(twin.snapshot().state,'denied');
  }
});

test('invalid host clocks cannot admit proposals, record assent or commit requests',async()=>{
  for(const time of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
    const f=fixture();f.network.recordChildAssent(f.request);f.setTime(time);let calls=0;
    const twin=createChildTwinOrchestration(f.network,{async propose(input){calls++;return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
    await assert.rejects(twin.propose(f.request),/AUTHORITY_UNAVAILABLE/);assert.equal(calls,0);
    assert.throws(()=>f.network.commit(f.request,f.approvals()),/AUTHORITY_UNAVAILABLE/);
    assert.throws(()=>f.network.recordChildAssent(f.request),/AUTHORITY_UNAVAILABLE/);
    assert.equal(f.network.snapshot().assent,false);
  }
});

test('request-aware proposal validation requires an explicit learning request and never grants authority',async()=>{
  const f=fixture();
  assert.throws(()=>f.network.assertProposalAllowed(undefined as unknown as NetworkRequest));
  assert.throws(()=>f.network.assertProposalAllowed({...f.request,action:'withdraw'}));
  f.network.assertProposalAllowed(f.request);
  assert.equal(f.network.snapshot().assent,false);assert.deepEqual(f.network.snapshot().receipts,[]);
  const twin=createChildTwinOrchestration(f.network,{async propose(input){return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
  const proposal=await twin.propose(f.request);
  assert.deepEqual(proposal,f.request);assert.equal(f.network.snapshot().assent,false);
  f.network.recordChildAssent(f.request);twin.authorize(f.approvals());
  assert.equal(twin.snapshot().state,'authorized');assert.equal(twin.snapshot().signer,false);
  assert.deepEqual(f.network.snapshot().receipts,[]);
});
