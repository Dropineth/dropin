import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { applyRightsOperation } from '../../services/api/src/domain/child-stewardship/rights.js';
import { childBoundaryDenies } from '../../services/api/src/domain/child-stewardship/runtime-boundary.js';
import { createSyntheticRightsFixture } from '../fixtures/child-stewardship-rights.js';

test('one cryptographic key cannot fill independent approval seats through renamed registry entries',()=>{
  for(const reformat of [false,true]) {
    const f=createSyntheticRightsFixture(),state=f.funded(),op=f.payment();
    const g=f.context.credentials.find(c=>c.keyId==='g')!,r=f.context.credentials.find(c=>c.keyId==='r1')!;
    r.publicKeyPem=reformat?g.publicKeyPem.replaceAll('\n','\r\n'):g.publicKeyPem;
    // The three role labels, actor references and declared control domains differ.
    // The R approval nevertheless uses the same actual private key as G.
    const approvals=f.approvals(op,['g','r1','t']);
    approvals[1]={...approvals[0]!,keyId:'r1'};
    const before=structuredClone(state);
    assert.throws(()=>applyRightsOperation(state,op,approvals,f.context),/DUPLICATE_SIGNING_KEY/);
    assert.deepEqual(state,before);
  }
});

test('a declared three-person panel cannot conceal key reuse in a non-voting seat',()=>{
  const f=createSyntheticRightsFixture(),state=f.funded(),op=f.payment();
  f.context.credentials.find(c=>c.keyId==='r2')!.publicKeyPem=f.context.credentials.find(c=>c.keyId==='r3')!.publicKeyPem;
  assert.throws(()=>f.apply(state,op,['g','r1','t']),/PANEL_NOT_INDEPENDENT/);
});

test('independent panel validation rejects malformed, private and non-Ed25519 public key material',()=>{
  const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({type:'spki',format:'pem'}).toString();
  // Generate the private-material negative control only in memory; never commit
  // key text or weaken the repository's secret-marker gate for a test fixture.
  const privateMaterial=generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString();
  for(const publicKeyPem of ['-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----',privateMaterial,ec]) {
    const f=createSyntheticRightsFixture(),state=f.funded(),op=f.payment();
    f.context.credentials.find(c=>c.keyId==='r2')!.publicKeyPem=publicKeyPem;
    assert.throws(()=>f.apply(state,op,['g','r1','t']),/INVALID_PUBLIC_KEY/);
  }
});

test('child voice is not a payment co-signature; independent adult positive control remains available',()=>{
  const f=createSyntheticRightsFixture(),state=f.funded(),op=f.payment();
  assert.throws(()=>f.apply(state,op,['g','r1','t','c']),/CHILD_PAYMENT_SIGNATURE_FORBIDDEN/);
  assert.equal(f.apply(state,op,['g','r1','t']).payments['payout-a']!.status,'submitted');
});

test('a human agent cannot add a vote and a child can request protection without a majority',()=>{
  const f=createSyntheticRightsFixture(),state=f.funded(),op=f.payment();
  f.context.credentials.find(c=>c.keyId==='r1')!.isAgent=true;
  assert.throws(()=>f.apply(state,op,['g','r1','t']),/CREDENTIAL_UNAVAILABLE/);
  const pause=f.operation('PAUSE',{entitlementIds:['entitlement-a'],details:{disputeId:'child-protection'}});
  assert.ok(f.apply(state,pause,['c']).entitlements['entitlement-a']!.disputeIds.includes('child-protection'));
});

test('all child-account capability families remain excluded from Tree Lotto and legacy execution paths',()=>{
  for(const kind of ['demo','guardian','resume','upload'])
    for(const path of ['/tree-lotto','/tree-lotto/entries','/lottery','/payments','/wallets','/treasury','/settlement'])
      assert.equal(childBoundaryDenies(path,`Bearer cp-${kind}.synthetic-test`,undefined),true);
  assert.equal(childBoundaryDenies('/canopyproof/child-stewardship/v1/commands','Bearer cp-guardian.synthetic-test',undefined),false);
});
