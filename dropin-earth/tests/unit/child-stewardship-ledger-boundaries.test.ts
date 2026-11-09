import assert from 'node:assert/strict';
import test from 'node:test';
import {syntheticLedgerSnapshot} from '../fixtures/child-stewardship-ledger.js';
import {normalizeChildSnapshot,reconstructChildSnapshot} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {readChildLearningView,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {assertChildSnapshotLedgerBoundaries} from '../../services/api/src/domain/child-stewardship/ledger-boundaries.js';
import {createSyntheticRightsFixture} from '../fixtures/child-stewardship-rights.js';

test('learning evidence and noncash feedback survive durable encoding with no money or carbon capability',()=>{
 const snapshot=syntheticLedgerSnapshot(),restored=reconstructChildSnapshot(normalizeChildSnapshot(snapshot),0);
 const view=readChildLearningView(restored.learning,{actorId:'demo-child',deviceId:'demo-device-child',epoch:1},new Date().toISOString());
 assert.equal(view.capabilities.funds,false);assert.equal(view.capabilities.carbonExecution,false);
 assert.equal(view.observations[0]!.evidenceLevel,'E0');assert.equal(view.contributions[0]!.unit,'EDU_FEEDBACK');
 assert.equal(view.contributions[0]!.cashValue,false);assert.deepEqual(restored.rights.entitlements,{});
});

test('cross-ledger relabelling is rejected at read, command, persistence and reconstruction boundaries',()=>{
 const original=syntheticLedgerSnapshot();
 const cases=[['contributions','unit','USD'],['contributions','cashValue',true],['contributions','transferable',true],
  ['contributions','amount',100],['contributions','acceptedScope','carbon_credit'],['contributions','balanceMinor',100],
  ['observations','evidenceLevel','E3'],['observations','captureTimeVerified',true],['observations','sourceType','verified-field'],
  ['observations','issuedCredits',1],['reviews','decision','carbon_credit_issued'],['reviews','moneyAmount',10],
  ['assessments','state','verified'],['assessments','evidenceLevel','E3'],['assessments','certifiedCarbonTonnes',1]] as const;
 for(const [collection,key,value] of cases){
  const snapshot=structuredClone(original),entries=snapshot.learning[collection];
  const entry=Object.values(entries)[0] as unknown as Record<string,unknown>;entry[key]=value;
  assert.throws(()=>normalizeChildSnapshot(snapshot),/LEARNING_LEDGER_BOUNDARY_INVALID/);
  assert.throws(()=>readChildLearningView(snapshot.learning,{actorId:'demo-child',deviceId:'demo-device-child',epoch:1},new Date().toISOString()),/LEARNING_LEDGER_BOUNDARY_INVALID/);
  assert.throws(()=>executeLearningCommand(snapshot.learning,{}, {actorId:'demo-child',deviceId:'demo-device-child',epoch:1},new Date().toISOString()),/LEARNING_LEDGER_BOUNDARY_INVALID/);
  const records=normalizeChildSnapshot(original),row=records.find(r=>r.domain==='learning'&&r.collection===collection)!;
  row.payload=entry;assert.throws(()=>reconstructChildSnapshot(records,0),/LEARNING_LEDGER_BOUNDARY_INVALID/);
 }
 assert.equal(original.learning.contributions[0]!.cashValue,false,'validation never rewrites source data');
 const wrong=structuredClone(original);
 Object.assign(wrong.rights.entitlements,{converted:wrong.learning.contributions[0]});
 assert.throws(()=>assertChildSnapshotLedgerBoundaries(wrong),/RIGHTS_LEDGER_BOUNDARY_INVALID/);
});

test('separate simulated rights records cannot be relabelled as commercial currency on durable read',()=>{
 const fixture=createSyntheticRightsFixture(),snapshot=syntheticLedgerSnapshot();
 snapshot.rights=fixture.apply(fixture.funded(),fixture.payment(),['g','r1','t']);
 assert.doesNotThrow(()=>assertChildSnapshotLedgerBoundaries(snapshot));
 for(const collection of ['entitlements','fundingLots','payments'] as const){
  const corrupted=structuredClone(snapshot);
  Object.assign(Object.values(corrupted.rights[collection])[0]!,{currency:'USD'});
  assert.throws(()=>reconstructChildSnapshot(normalizeChildSnapshot(corrupted),0),/RIGHTS_LEDGER_BOUNDARY_INVALID/);
 }
});
