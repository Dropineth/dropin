import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSyntheticAccountNetwork,networkSigningBytes,type NetworkRequest} from '../../integrations/cai/synthetic-account-network.js';
import {createChildTwinOrchestration} from '../../integrations/cai/child-twin-orchestration.js';

function fixture(){
  let now=1000,clockFailure=false;
  const keys=[0,1].map(()=>generateKeyPairSync('ed25519'));
  const participants=keys.map((key,i)=>({id:`synthetic-guardian-${i}`,principal:`synthetic-human-${i}`,role:'verified-guardian-fixture' as const,publicKey:key.publicKey.export({type:'spki',format:'pem'}).toString()}));
  const network=createSyntheticAccountNetwork('synthetic-account',participants,()=>{
    if(clockFailure)throw new Error('HOST_CLOCK_FAILURE');
    return now;
  });
  const request:NetworkRequest={profile:'CanopyProof-Synthetic-CAI/2',account:'synthetic-account',epoch:0,nonce:'synthetic-proposal',action:'learning-review',evidenceDigest:'a'.repeat(64),expiresAt:2000};
  const approvals=(value=request)=>keys.map((key,i)=>({participant:participants[i]!.id,signature:sign(null,networkSigningBytes(value),key.privateKey).toString('base64url')}));
  return {network,request,approvals,setTime:(value:number)=>{now=value;},failClock:(value:boolean)=>{clockFailure=value;}};
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

test('observed expiry cannot be undone by a backward host clock at any admission port',()=>{
  for(const observe of ['check','proposal','assent','snapshot'] as const){
    const f=fixture();f.network.recordChildAssent(f.request);f.setTime(2000);
    if(observe==='snapshot')assert.equal(f.network.snapshot().assent,false);
    else assert.throws(()=>{
      if(observe==='check')f.network.check(f.request,f.approvals());
      else if(observe==='proposal')f.network.assertProposalAllowed(f.request);
      else f.network.recordChildAssent(f.request);
    },/AUTHORITY_UNAVAILABLE/);
    f.setTime(1500);
    assert.throws(()=>f.network.assertProposalAllowed(f.request),/AUTHORITY_UNAVAILABLE/,observe);
    assert.throws(()=>f.network.commit(f.request,f.approvals()),/AUTHORITY_UNAVAILABLE/,observe);
    assert.throws(()=>f.network.recordChildAssent(f.request),/AUTHORITY_UNAVAILABLE/,observe);
    assert.equal(f.network.snapshot().assent,false);
    assert.deepEqual(f.network.snapshot().receipts,[]);
    f.setTime(2000);
    assert.throws(()=>f.network.recordChildAssent(f.request),/AUTHORITY_UNAVAILABLE/);
    const next={...f.request,nonce:'synthetic-after-expiry',expiresAt:3000};
    assert.throws(()=>f.network.commit(next,f.approvals(next)),/ASSENT_REQUIRED/);
    f.network.recordChildAssent(next);
    assert.equal('digest' in f.network.commit(next,f.approvals(next)),true);
  }
});

test('observed clock rollback erases assent and catch-up requires a new human grant',()=>{
  for(const observe of ['proposal','snapshot'] as const){
    const f=fixture();f.network.recordChildAssent(f.request);f.setTime(1500);
    f.network.assertProposalAllowed(f.request);f.setTime(1400);
    if(observe==='snapshot')assert.equal(f.network.snapshot().assent,false);
    else assert.throws(()=>f.network.assertProposalAllowed(f.request),/AUTHORITY_UNAVAILABLE/);
    f.setTime(1500);
    assert.throws(()=>f.network.commit(f.request,f.approvals()),/ASSENT_REQUIRED/);
    assert.equal(f.network.snapshot().assent,false);
    f.network.recordChildAssent(f.request);f.network.commit(f.request,f.approvals());
    assert.equal(f.network.snapshot().receipts.length,1);
  }
});

test('invalid or throwing clock observations cannot leave old assent usable after recovery',()=>{
  for(const bad of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1,'throws'] as const){
    for(const observe of ['proposal','snapshot'] as const){
      const f=fixture();f.network.recordChildAssent(f.request);
      if(bad==='throws')f.failClock(true);else f.setTime(bad);
      if(observe==='snapshot')assert.equal(f.network.snapshot().assent,false);
      else assert.throws(()=>f.network.assertProposalAllowed(f.request),/AUTHORITY_UNAVAILABLE/);
      f.failClock(false);f.setTime(1000);
      assert.equal(f.network.snapshot().assent,false);
      assert.throws(()=>f.network.commit(f.request,f.approvals()),/ASSENT_REQUIRED/);
      f.network.recordChildAssent(f.request);f.network.commit(f.request,f.approvals());
    }
  }
});

test('a backward clock cannot reopen a provider result after independently observed request expiry',async()=>{
  const f=fixture();let complete!:(value:unknown)=>void,started!:()=>void;
  const began=new Promise<void>(resolve=>{started=resolve;});
  const twin=createChildTwinOrchestration(f.network,{propose(){started();return new Promise(resolve=>{complete=resolve;});}});
  const pending=twin.propose(f.request);await began;
  f.setTime(2000);assert.throws(()=>f.network.assertProposalAllowed(f.request),/AUTHORITY_UNAVAILABLE/);
  f.setTime(1500);complete({kind:'learning-review-proposal',evidenceDigest:f.request.evidenceDigest,tools:[]});
  await assert.rejects(pending,/AUTHORITY_UNAVAILABLE/);
  assert.equal(twin.snapshot().state,'denied');
  assert.equal(f.network.snapshot().assent,false);assert.deepEqual(f.network.snapshot().receipts,[]);
});

test('human withdrawal and shutdown remain available even when the clock is unavailable',()=>{
  for(const end of ['withdrawChild','shutdown'] as const){
    const f=fixture();f.network.recordChildAssent(f.request);f.failClock(true);
    assert.doesNotThrow(()=>f.network[end]());
    assert.equal(f.network.snapshot().closed,true);
    assert.equal(f.network.snapshot().assent,false);
    assert.deepEqual(f.network.snapshot().receipts,[]);
    f.failClock(false);
    assert.throws(()=>f.network.commit(f.request,f.approvals()),/AUTHORITY_UNAVAILABLE/);
  }
});
