import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {closeNativeChildPool} from '../fixtures/child-stewardship-pool-close.js';
import {syntheticLedgerSnapshot} from '../fixtures/child-stewardship-ledger.js';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {createDemoTokens} from '../../services/api/src/domain/child-stewardship/store.js';
import {createSyntheticLearningState} from '../../services/api/src/domain/child-stewardship/learning.js';

test('native ledger validation rolls back invalid initial state and cross-ledger mutations',async()=>{
 const original=process.env.CANOPYPROOF_NATIVE_DATABASE_URL!,admin=nativeChildPool();
 const database=`child_ledger_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${database}`);
 const url=new URL(original);url.pathname=`/${database}`;process.env.CANOPYPROOF_NATIVE_DATABASE_URL=url.toString();
 const owner=nativeChildPool();let scoped:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
 try{
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  scoped=await scopedNativeChildPool(owner);const store=new PostgresChildStore(nativeChildSql(scoped.pool));
  const id=randomUUID(),tokens=createDemoTokens(id),snapshot=syntheticLedgerSnapshot();
  const corrupted=structuredClone(snapshot);Object.assign(corrupted.learning.contributions[0]!,{cashValue:true});
  await assert.rejects(store.create({id,expiresAt:new Date(Date.now()+60_000).toISOString(),snapshot:corrupted},tokens.records),/LEARNING_LEDGER_BOUNDARY_INVALID/);
  assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.sessions')).rows[0].n,0,'failed provisioning leaves no session');
  // Valid initial sessions cannot pre-seed observations: SQL independently
  // requires fresh one-use upload authority for those writes.
  snapshot.learning=createSyntheticLearningState();
  await store.create({id,expiresAt:new Date(Date.now()+60_000).toISOString(),snapshot},tokens.records);
  const before=(await owner.query('SELECT collection,record_id,payload FROM child_stewardship.state_records WHERE session_id=$1 ORDER BY domain,collection,record_id',[id])).rows;
  await assert.rejects(store.transact(id,new Date().toISOString(),tx=>{
   tx.snapshot.learning=structuredClone(corrupted.learning);tx.snapshot.version++;
  }),/LEARNING_LEDGER_BOUNDARY_INVALID/);
  assert.deepEqual((await owner.query('SELECT collection,record_id,payload FROM child_stewardship.state_records WHERE session_id=$1 ORDER BY domain,collection,record_id',[id])).rows,before);
  const observed=await store.transact(id,new Date().toISOString(),tx=>tx.snapshot.learning.contributions);
  assert.deepEqual(observed,[],'failed mutation creates no benefit or money entry');
 }finally{
  await scoped?.close();await closeNativeChildPool(owner);process.env.CANOPYPROOF_NATIVE_DATABASE_URL=original;
  await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);await closeNativeChildPool(admin);
 }
});
