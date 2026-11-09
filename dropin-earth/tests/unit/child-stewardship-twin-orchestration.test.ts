import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSyntheticAccountNetwork,networkSigningBytes,type NetworkRequest} from '../../integrations/cai/synthetic-account-network.js';
import {createChildTwinOrchestration,type ScopedInferenceProvider} from '../../integrations/cai/child-twin-orchestration.js';
function fixture(){
  const keys=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
  const participants=keys.map((key,i)=>({id:`synthetic-guardian-${i}`,principal:`synthetic-human-${i}`,role:'verified-guardian-fixture' as const,publicKey:key.publicKey.export({type:'spki',format:'pem'}).toString()}));
  const network=createSyntheticAccountNetwork('synthetic-account',participants);
  const request:NetworkRequest={profile:'CanopyProof-Synthetic-CAI/2',account:'synthetic-account',epoch:0,nonce:'synthetic-proposal',action:'learning-review',evidenceDigest:'a'.repeat(64),expiresAt:Date.now()+20000};
  const approvals=()=>keys.map((key,i)=>({participant:participants[i].id,signature:sign(null,networkSigningBytes(request),key.privateKey).toString('base64url')}));
  const provider:ScopedInferenceProvider={propose:async input=>{assert.deepEqual(Object.keys(input).sort(),['evidenceDigest','tools']);return {kind:'learning-review-proposal',evidenceDigest:input.evidenceDigest,tools:[]};}};
  return {network,request,approvals,provider};
}
test('inference not configured denies; proposal cannot approve itself or skip human assent',async()=>{
  const f=fixture();await assert.rejects(createChildTwinOrchestration(f.network).propose(f.request),/NOT_CONFIGURED/);
  const twin=createChildTwinOrchestration(f.network,f.provider);
  await assert.rejects(twin.execute('unused'),/STATE_INVALID/);
  assert.deepEqual(await twin.propose(f.request),f.request);
  assert.equal(twin.snapshot().state,'awaiting-human-consent');
  assert.throws(()=>twin.authorize(f.approvals()),/ASSENT_REQUIRED/);
  assert.equal(twin.snapshot().state,'denied');assert.deepEqual(f.network.snapshot().receipts,[]);
});
test('provider tool requests, authority claims and evidence substitution are denied',async()=>{
  for(const change of [{tools:['pay']},{signature:'forged'},{evidenceDigest:'b'.repeat(64)}]){
    const f=fixture(),twin=createChildTwinOrchestration(f.network,{propose:async()=>({kind:'learning-review-proposal',evidenceDigest:f.request.evidenceDigest,tools:[],...change})});
    await assert.rejects(twin.propose(f.request));assert.equal(twin.snapshot().state,'denied');
  }
});
test('inference timeout, withdrawal, denial and shutdown reject even a provider ignoring abort',async()=>{
  for(const action of ['timeout','withdraw','deny','shutdown','abort'] as const){
    const f=fixture(),twin=createChildTwinOrchestration(f.network,{propose:()=>new Promise(()=>{})});
    const pending=twin.propose(f.request,20);if(action!=='timeout')twin[action]();
    await assert.rejects(pending,/ABORTED/);assert.deepEqual(f.network.snapshot().receipts,[]);
  }
});
test('revocation between explicit handoff and execution prevents dispatch',async()=>{
  const f=fixture();f.network.recordChildAssent();const twin=createChildTwinOrchestration(f.network,f.provider);
  await twin.propose(f.request);twin.authorize(f.approvals());f.network.revoke('synthetic-guardian-0');
  await assert.rejects(twin.execute('must-not-load'),/AUTHORITY/);assert.equal(twin.snapshot().state,'denied');
});
test('actual pinned Engine executes only after explicit human handoff; twin never signs',{skip:!process.env.CAI_DEEPSEEK_ROOT},async()=>{
  const f=fixture(),twin=createChildTwinOrchestration(f.network,f.provider);
  await twin.propose(f.request);f.network.recordChildAssent();twin.authorize(f.approvals());
  await twin.execute(process.env.CAI_DEEPSEEK_ROOT!);
  assert.equal(twin.snapshot().state,'receipted');assert.equal(twin.snapshot().signer,false);
  assert.equal(f.network.snapshot().receipts.length,1);
  await assert.rejects(twin.execute(process.env.CAI_DEEPSEEK_ROOT!),/STATE_INVALID/);
  twin.withdraw();assert.deepEqual(f.network.snapshot().receipts,[]);
});
