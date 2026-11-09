import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSyntheticAccountNetwork,networkSigningBytes,type NetworkRequest} from '../../integrations/cai/synthetic-account-network.js';
function fixture(){
  let now=1000;
  const roles=['verified-guardian-fixture','verified-guardian-fixture','verified-guardian-fixture'] as const;
  const keys=roles.map(()=>generateKeyPairSync('ed25519'));
  const participants=roles.map((role,i)=>({id:`synthetic-${i}`,principal:`synthetic-principal-${i}`,role,publicKey:keys[i].publicKey.export({type:'spki',format:'pem'}).toString()}));
  const network=createSyntheticAccountNetwork('synthetic-account',participants,()=>now);
  network.recordChildAssent();
  const request:NetworkRequest={profile:'CanopyProof-Synthetic-CAI/2',account:'synthetic-account',epoch:0,nonce:'synthetic-nonce',action:'learning-review',evidenceDigest:'a'.repeat(64),expiresAt:2000};
  const approvals=(r=request,indices=[0,1])=>indices.map(i=>({participant:participants[i].id,signature:sign(null,networkSigningBytes(r),keys[i].privateKey).toString('base64url')}));
  return {network,request,approvals,participants,advance:()=>{now=2001;}};
}
test('synthetic role quorum records only digest learning receipt and prevents replay',()=>{
  const f=fixture();assert.throws(()=>f.network.commit(f.request,f.approvals(f.request,[0])),/GUARDIAN_QUORUM/);
  assert.throws(()=>f.network.commit(f.request,[]),/GUARDIAN_QUORUM/);
  const receipt=f.network.commit(f.request,f.approvals());assert.equal('cashValue' in receipt&&receipt.cashValue,false);
  assert.throws(()=>f.network.commit(f.request,f.approvals()),/AUTHORITY/);
  assert.equal(JSON.stringify(f.network.snapshot()).includes('publicKey'),false);
});
test('duplicate principals or keys cannot impersonate independent roles',()=>{
  for(const field of ['principal','publicKey'] as const){const f=fixture();f.participants[1][field]=f.participants[0][field];assert.throws(()=>createSyntheticAccountNetwork('synthetic-account',f.participants),/INDEPENDENT/);}
});
test('tampering, wrong account, expired approval, revoked registry and financial fields fail closed',()=>{
  for(const change of [{evidenceDigest:'b'.repeat(64)},{account:'synthetic-other'},{action:'payment'},{amount:1}]){
    const f=fixture();assert.throws(()=>f.network.commit({...f.request,...change} as NetworkRequest,f.approvals()));
  }
  const f=fixture();f.advance();assert.throws(()=>f.network.commit(f.request,f.approvals()),/AUTHORITY/);
  const g=fixture();g.network.revoke('synthetic-1');assert.throws(()=>g.network.commit(g.request,g.approvals()),/AUTHORITY/);
});
test('child withdrawal needs no signing key, erases receipts and closes account',()=>{
  const f=fixture();f.network.commit(f.request,f.approvals());
  f.network.withdrawChild();assert.deepEqual(f.network.snapshot().receipts,[]);
  assert.throws(()=>f.network.commit({...f.request,epoch:1},f.approvals()),/AUTHORITY/);
});
const source=process.env.CAI_DEEPSEEK_ROOT;
test('real pinned Engine and isolated worker produce synthetic network receipt; withdrawal and expiry during work defeat commit',{skip:!source},async()=>{
  const {runSyntheticNetworkReview}=await import(pathToFileURL(resolve('integrations/cai/synthetic-network-router.mjs')).href);
  const f=fixture();const result=await runSyntheticNetworkReview(source,f.network,f.request,f.approvals());
  assert.equal(result.receipt.syntheticOnly,true);assert.ok(result.events.includes('assignment.started'));
  for(const mode of ['withdraw','expire','revoke','shutdown']){
    const g=fixture();
    await assert.rejects(runSyntheticNetworkReview(source,g.network,g.request,g.approvals(),{delayMs:100,onStarted:()=>{
      if(mode==='expire')g.advance();
      else if(mode==='revoke')g.network.revoke('synthetic-1');
      else if(mode==='shutdown')g.network.shutdown();
      else {const r={...g.request,action:'withdraw' as const};g.network.commit(r,g.approvals(r,[0]));}
    }}),/AUTHORITY/);
    assert.deepEqual(g.network.snapshot().receipts,[]);
  }
});
test('private key input is refused and registry updates cannot bypass receipt retention',()=>{
  const f=fixture();f.participants[1].publicKey=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'}).toString();
  assert.throws(()=>createSyntheticAccountNetwork('synthetic-account',f.participants),/PUBLIC_KEY_ONLY/);
  const g=fixture();
  for(let i=0;i<32;i++){
    const r={...g.request,nonce:`synthetic-nonce-${i}`,epoch:g.network.snapshot().epoch};
    g.network.commit(r,g.approvals(r));
  }
  g.network.revoke('synthetic-2');g.network.revoke('synthetic-2');assert.equal(g.network.snapshot().epoch,1);
  const r={...g.request,nonce:'synthetic-last',epoch:1};
  assert.throws(()=>g.network.commit(r,g.approvals(r)),/RETENTION_LIMIT/);
  const withdrawal={...r,action:'withdraw' as const};g.network.commit(withdrawal,g.approvals(withdrawal,[0]));
  assert.deepEqual(g.network.snapshot().receipts,[]);
});

test('guardian-only fixture registry rejects institutions and twins; human-child signing is not implemented',()=>{
  for(const role of ['child','un-placeholder','bev-placeholder','canopyproof-placeholder','local-child-organization-placeholder','child-cai']){
    const f=fixture();assert.throws(()=>createSyntheticAccountNetwork('synthetic-account',f.participants.map((p,i)=>i===0?{...p,role}:p) as typeof f.participants));
  }
  const f=fixture(),network=createSyntheticAccountNetwork('synthetic-account',f.participants,()=>1000);
  assert.throws(()=>network.commit(f.request,f.approvals()),/ASSENT_REQUIRED/);
  network.recordChildAssent();network.commit(f.request,f.approvals());
});
