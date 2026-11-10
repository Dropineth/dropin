import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createLifeppSyntheticAccountNetwork} from '../../integrations/cai/lifepp-synthetic-account-network.js';
import {CHILD_FIXTURE_PROFILE,LIFEPP_CHILD_SOURCE_HEADS,type ChildProtocolFixture} from '../../integrations/cai/lifepp-child-boundary.js';
import {networkSigningBytes,type NetworkRequest} from '../../integrations/cai/synthetic-account-network.js';
import {createChildTwinOrchestration} from '../../integrations/cai/child-twin-orchestration.js';

function fixture(){
  let now=1000;const keys=[0,1].map(()=>generateKeyPairSync('ed25519'));
  const participants=keys.map((key,i)=>({id:`synthetic-guardian-${i}`,principal:`synthetic-principal-${i}`,role:'verified-guardian-fixture' as const,publicKey:key.publicKey.export({format:'pem',type:'spki'}).toString()}));
  const {network,protocolBoundary}=createLifeppSyntheticAccountNetwork('synthetic-account','synthetic-persona',participants,()=>now);
  const request:NetworkRequest={profile:'CanopyProof-Synthetic-CAI/2',account:'synthetic-account',epoch:0,nonce:'synthetic-nonce',action:'learning-review',evidenceDigest:'a'.repeat(64),expiresAt:2500};
  const protocol:ChildProtocolFixture={profile:CHILD_FIXTURE_PROFILE,mode:'SIMULATION_ONLY',personaId:'synthetic-persona',sequence:0,issuedAt:1000,expiresAt:2000,sourceHeads:{...LIFEPP_CHILD_SOURCE_HEADS},
    verdict:{id:'synthetic-verdict',decision:'PASS',severity:'NONE',finality:'FINALIZED',evidenceRoot:`sha256:${'b'.repeat(64)}`},kya:{level:'KYA_3_HIGH_ASSURANCE_HUMAN_ANCHOR',active:true,continuity:true},membership:'ACTIVE',openChallenge:false,liveness:true,decisionControlDomains:['synthetic-original-control'],chainrank:{scoreMillionths:0,advisoryOnly:true}};
  const approvals=(r=request)=>keys.map((key,i)=>({participant:participants[i]!.id,signature:sign(null,networkSigningBytes(r),key.privateKey).toString('base64url')}));
  return {network,protocolBoundary,request,protocol,approvals,advance:(t:number)=>{now=t;}};
}
test('composed network cannot use human fixture signatures without a current Life++ fixture',()=>{
  const f=fixture();f.network.recordChildAssent(f.request);assert.throws(()=>f.network.commit(f.request,f.approvals()),/LIFEPP_LEARNING_INELIGIBLE/);
  f.protocolBoundary.observeFixture(f.protocol);const result=f.network.commit(f.request,f.approvals());assert.equal('syntheticOnly' in result&&result.syntheticOnly,true);
});
test('Life++ fixture does not replace child assent or guardian signatures',()=>{
  const f=fixture();f.protocolBoundary.observeFixture(f.protocol);assert.throws(()=>f.network.commit(f.request,f.approvals()),/ASSENT_REQUIRED/);
  f.network.recordChildAssent(f.request);assert.throws(()=>f.network.commit(f.request,[]),/GUARDIAN_QUORUM/);
});
test('eviction between authorization and commit prevents learning but never blocks human withdrawal',()=>{
  for(const who of ['child','guardian']){
    const f=fixture();f.protocolBoundary.observeFixture(f.protocol);f.network.recordChildAssent(f.request);f.network.check(f.request,f.approvals());
    f.protocolBoundary.observeFixture({...f.protocol,sequence:1,verdict:{...f.protocol.verdict,decision:'FAIL',severity:'HARD'}});
    assert.throws(()=>f.network.commit(f.request,f.approvals()),/EVICTED_TERMINAL/);assert.deepEqual(f.network.snapshot().receipts,[]);
    if(who==='child')f.network.withdrawChild();else {const withdrawal={...f.request,action:'withdraw' as const};f.network.commit(withdrawal,f.approvals(withdrawal).slice(0,1));}
    assert.equal(f.network.snapshot().closed,true);assert.equal(f.protocolBoundary.snapshot().evicted,true);assert.equal(f.protocolBoundary.snapshot().childRightsModified,false);
  }
});
test('expiry, malformed observation and open challenge between dispatch check and commit fail closed',()=>{
  for(const mode of ['expiry','challenge','malformed']){const f=fixture();f.protocolBoundary.observeFixture(f.protocol);f.network.recordChildAssent(f.request);f.network.check(f.request,f.approvals());
    if(mode==='expiry')f.advance(2000);else if(mode==='malformed')assert.throws(()=>f.protocolBoundary.observeFixture({}));else f.protocolBoundary.observeFixture({...f.protocol,sequence:1,openChallenge:true});
    assert.throws(()=>f.network.commit(f.request,f.approvals()),/LIFEPP_LEARNING_INELIGIBLE/);assert.deepEqual(f.network.snapshot().receipts,[]);
  }
});
test('no protocol fixture is needed to withdraw a synthetic account',()=>{
  for(const who of ['child','guardian']){const f=fixture();
    if(who==='child')f.network.withdrawChild();else {const request={...f.request,action:'withdraw' as const};f.network.commit(request,f.approvals(request).slice(0,1));}
    assert.equal(f.network.snapshot().closed,true);
  }
});
test('orchestration never calls a provider without a valid fixture or after terminal eviction',async()=>{
  for(const mode of ['missing','evicted','challenge','expired']){
    const f=fixture();let calls=0;
    if(mode!=='missing')f.protocolBoundary.observeFixture(f.protocol);
    if(mode==='evicted')f.protocolBoundary.observeFixture({...f.protocol,sequence:1,verdict:{...f.protocol.verdict,decision:'FAIL',severity:'HARD'}});
    if(mode==='challenge')f.protocolBoundary.observeFixture({...f.protocol,sequence:1,openChallenge:true});
    if(mode==='expired')f.advance(2000);
    const twin=createChildTwinOrchestration(f.network,{async propose(input){calls++;return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
    await assert.rejects(twin.propose(f.request),/LIFEPP_(LEARNING_INELIGIBLE|EVICTED_TERMINAL)/);
    assert.equal(calls,0,mode);assert.equal(twin.snapshot().state,'denied');assert.deepEqual(f.network.snapshot().receipts,[]);
  }
});
test('eviction after scheduling but before the provider microtask prevents its invocation',async()=>{
  const f=fixture();f.protocolBoundary.observeFixture(f.protocol);let calls=0;
  const twin=createChildTwinOrchestration(f.network,{async propose(input){calls++;return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
  const pending=twin.propose(f.request);
  f.protocolBoundary.observeFixture({...f.protocol,sequence:1,verdict:{...f.protocol.verdict,decision:'FAIL',severity:'HARD'}});
  await assert.rejects(pending,/EVICTED_TERMINAL/);assert.equal(calls,0);assert.equal(twin.snapshot().state,'denied');
});
test('protocol invalidation during inference rejects the output before the human-consent handoff',async()=>{
  for(const mode of ['evicted','expired','malformed','rollback']){
    const f=fixture();f.protocolBoundary.observeFixture(f.protocol);
    let complete!:(value:unknown)=>void,started!:()=>void;
    const providerStarted=new Promise<void>(resolve=>{started=resolve;});
    const twin=createChildTwinOrchestration(f.network,{propose(){started();return new Promise(resolve=>{complete=resolve;});}});
    const pending=twin.propose(f.request);await providerStarted;
    if(mode==='evicted')f.protocolBoundary.observeFixture({...f.protocol,sequence:1,verdict:{...f.protocol.verdict,decision:'FAIL',severity:'HARD'}});
    if(mode==='expired')f.advance(2000);
    if(mode==='malformed')assert.throws(()=>f.protocolBoundary.observeFixture({}));
    if(mode==='rollback')f.advance(999);
    complete({kind:'learning-review-proposal',evidenceDigest:f.request.evidenceDigest,tools:[]});
    await assert.rejects(pending,/LIFEPP_(LEARNING_INELIGIBLE|EVICTED_TERMINAL|CLOCK_ROLLBACK)/);
    assert.equal(twin.snapshot().state,'denied');assert.deepEqual(f.network.snapshot().receipts,[]);
  }
});
test('fresh fixture allows proposal only; expiry cannot be reversed to authorize a completed proposal',async()=>{
  const f=fixture();f.protocolBoundary.observeFixture(f.protocol);let calls=0;
  const twin=createChildTwinOrchestration(f.network,{async propose(input){calls++;return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}});
  await twin.propose(f.request);assert.equal(calls,1);assert.equal(twin.snapshot().state,'awaiting-human-consent');
  f.network.recordChildAssent(f.request);f.advance(2000);assert.throws(()=>f.network.assertProposalAllowed(),/INELIGIBLE/);
  f.advance(1500);assert.throws(()=>twin.authorize(f.approvals()),/INELIGIBLE/);assert.equal(twin.snapshot().state,'denied');
});
