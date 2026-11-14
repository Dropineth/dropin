import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {receipt} from './rehearse.mjs';
import {expectedSource} from './oci-view-probe.mjs';
test('integrated receipt starts unexecuted and cannot imply production authority',()=>{
  const value=receipt();assert.equal(value.kind,'CanopyProofHostedSeparateDatabaseRehearsal/1');
  for(const key of ['ociSignedPerSessionCheckpoint','crossServiceWritesRevocationRace','productionFinality','productionEnrollment'])assert.equal(value[key].status,'NOT_RUN');
  for(const key of ['before_admission','signed_sql_admission','candidate_valid','backup_before_migration','append_outbox_hold','restore_to_separate_database','advance_floor_before_restore_probe','rollback_advanced_floor_denied','rollback_data_invariants'])assert.equal(value.stages[key].status,'NOT_RUN');
});
test('image HTTP probe accepts only the two exact independently pinned backend sources',()=>{
  assert.equal(expectedSource('0e3d33b36beac4502488b18a0707c17fd34062e5'),'0e3d33b36beac4502488b18a0707c17fd34062e5');
  assert.equal(expectedSource('1d2efaa5258b70ed9f815af0ebf7109443734e59'),'1d2efaa5258b70ed9f815af0ebf7109443734e59');
  for(const value of ['main','latest','a'.repeat(40),undefined])assert.throws(()=>expectedSource(value));
});
test('orchestration retains full DB snapshots and never resets the fixture floor',async()=>{
  const source=await readFile(new URL('./rehearse.mjs',import.meta.url),'utf8');
  assert.equal((source.match(/control\('advance-floor'\)/g)??[]).length,1);
  const stages=['backup_before_migration','append_outbox_hold','prior_image_rejects_migrated_db','restore_to_separate_database','advance_floor_before_restore_probe','combined_rollback_readiness','rollback_advanced_floor_denied'];
  for(let i=1;i<stages.length;i++)assert.ok(source.indexOf(`stage('${stages[i-1]}'`)<source.indexOf(`stage('${stages[i]}'`));
  assert.ok(source.includes("snapshot('restored-before-application','snapshot-restored'),before"));
  assert.ok(source.includes('deliveryConsumerStarted:false,deliveryReceiverConfigured:false'));
  assert.ok(source.includes("assert.ok(calls>0,'FRESH_AUTHORITY_READ_REQUIRED')"));
  // The one -p belongs to pg_isready's TCP port, never docker create/run.
  assert.equal((source.match(/'-p'/g)??[]).length,1);
  assert.ok(source.includes("'pg_isready','-h','127.0.0.1','-p','5432'"));
  assert.equal(source.includes("'--publish'"),false);assert.equal(source.includes("'--network','host'"),false);
  assert.ok(source.includes('NODE_EXTRA_CA_CERTS:trust'));assert.ok(source.includes('authorityOnly(fixture)'));
});
test('fixture IPC is neither an HTTP admin route nor an untrusted destination input',async()=>{
  const source=await readFile(new URL('./authority-control-client.mjs',import.meta.url),'utf8');
  assert.ok(source.includes("const PATH='/tmp/authority-control.sock'"));
  assert.equal(source.includes('http:'),false);assert.equal(source.includes('https:'),false);
  const entry=await readFile(new URL('./authority-container.mjs',import.meta.url),'utf8');
  assert.ok(entry.includes("path:'/tmp/authority-control.sock'"));assert.ok(entry.includes("host:'0.0.0.0',port:8443,isolatedContainer:true"));
});
