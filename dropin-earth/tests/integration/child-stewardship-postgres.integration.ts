import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {createChildStewardshipRoutes} from '../../services/api/src/routes/child-stewardship/index.js';
import {createSyntheticLearningState} from '../../services/api/src/domain/child-stewardship/learning.js';
import {createDemoTokens,newDemoSessionId} from '../../services/api/src/domain/child-stewardship/store.js';
import {createSyntheticRightsFixture,now} from '../fixtures/child-stewardship-rights.js';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {ChildRightsVerifier} from '../../services/api/src/domain/child-stewardship/verifier-admission.js';

// Actual production store and Hono routes against native PostgreSQL; no in-memory store.
test('native authority: exact signed payments serialize budgets/nonces; failed receipt persistence rolls back all facts',async t=>{
  const pool=nativeChildPool();
  let scoped:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
  let verifierScope:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
  try {
    await pool.query(await readFile('services/api/prisma/child-stewardship.sql','utf8'));
    await pool.query(await readFile('services/api/prisma/child-stewardship-authority.sql','utf8'));
    assert.equal(await new PostgresChildStore(nativeChildSql(pool)).ready(),false,'migration owner is never a runtime identity');
    scoped=await scopedNativeChildPool(pool);
    verifierScope=await scopedNativeChildPool(pool,true);
    const verifier=new ChildRightsVerifier(nativeChildSql(verifierScope.pool));
    let crash=false;
    const store=new PostgresChildStore(nativeChildSql(scoped.pool,text=>{if(crash&&text.startsWith('INSERT INTO child_stewardship.receipts')){crash=false;throw new Error('injected receipt boundary crash');}}));
    assert.equal(await store.ready(),true);
    const rights=createSyntheticRightsFixture();
    const id=newDemoSessionId();const tokens=createDemoTokens(id);
    await store.create({id,expiresAt:'2026-10-24T12:00:00Z',snapshot:{version:0,learning:createSyntheticLearningState(now),rights:rights.funded(100),rightsContext:rights.context}},tokens.records);
    for(const update of ["actor_id='demo-operator'","device_id='demo-device-operator'",'epoch=epoch+1']){
      await assert.rejects(nativeChildSql(scoped.pool).transaction(async db=>{
        await db.query("SELECT set_config('app.child_session_id',$1,true)",[id]);
        await db.query(`UPDATE child_stewardship.session_tokens SET ${update} WHERE session_id=$1::uuid AND actor_id='demo-child'`,[id]);
      }),/CHILD_TOKEN_MAPPING_IMMUTABLE/);
    }
    await assert.rejects(nativeChildSql(scoped.pool).transaction(async db=>{
      await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','bootstrap',true),set_config('app.child_operation','create-synthetic-session',true)",[id]);
      await db.query("INSERT INTO child_stewardship.session_tokens(token_hash,session_id,actor_id,device_id,epoch) VALUES($1,$2::uuid,'demo-operator','demo-device-operator',1)",['a'.repeat(64),id]);
    }),/CHILD_TOKEN_BOOTSTRAP_CLOSED/);
    const app=createChildStewardshipRoutes({mode:'synthetic-demo',store,now:()=>now});
    const external=t.mock.method(globalThis,'fetch',async()=>{throw new Error('unexpected provider request');});
    let sequence=0;
    async function submit(op:ReturnType<typeof rights.payment>,version=0,key=`native-payment-${++sequence}`){
      const response=await app.request('/rights/operations',{method:'POST',headers:{authorization:`Bearer ${tokens.publicTokens.operator}`,'content-type':'application/json','idempotency-key':key,'if-match':String(version)},body:JSON.stringify({operation:op,approvals:rights.approvals(op,['g','r1','t'])})});
      return {status:response.status,body:await response.json()};
    }
    const failed=rights.payment(60,{details:{payoutId:'native-failed'}});
    const forged=rights.approvals(failed,['g','r1','t']);forged[0]!.signatureBase64=Buffer.alloc(64).toString('base64');
    await assert.rejects(verifier.admit(id,failed,forged,now),/INVALID_SIGNATURE/);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM child_stewardship.verification_admissions WHERE session_id=$1',[id])).rows[0].count,0);
    assert.equal((await submit(failed)).status,503,'valid signatures cannot bypass missing independent verifier admission');
    await verifier.admit(id,failed,rights.approvals(failed,['g','r1','t']),now);
    crash=true;
    assert.equal((await submit(failed)).status,503);
    const afterFailure=await store.transact(id,now,tx=>structuredClone(tx.snapshot));
    assert.equal(afterFailure.version,0);
    assert.equal(Object.keys(afterFailure.rights.payments).length,0);
    assert.ok(!afterFailure.rights.consumedNonces.includes(failed.nonce));
    const a=rights.payment(60,{details:{payoutId:'native-a'}}),b=rights.payment(60,{details:{payoutId:'native-b'}});
    await verifier.admit(id,a,rights.approvals(a,['g','r1','t']),now);
    await verifier.admit(id,b,rights.approvals(b,['g','r1','t']),now);
    const results=await Promise.all([submit(a,0,'native-concurrent-a'),submit(b,0,'native-concurrent-b')]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const winner=results[0]!.status===200?a:b;const loser=winner===a?b:a;
    const replay=await submit(winner,0,winner===a?'native-concurrent-a':'native-concurrent-b');assert.equal(replay.status,200);
    assert.equal((await submit(loser,1,'native-second-attempt')).status,403);
    const current=await store.transact(id,now,tx=>structuredClone(tx.snapshot));
    assert.equal(current.version,1);assert.equal(Object.keys(current.rights.payments).length,1);
    assert.equal(current.rights.fundingLots['funding-a']!.allocations['entitlement-a']!.submittedMinor,60);
    assert.equal(current.rights.fundingLots['funding-a']!.allocations['entitlement-a']!.vestedMinor,40);
    for(const update of ['revision=0','revision=revision','revision=revision+2',"expires_at=expires_at+interval '1 day'","storage_format='uninitialized'","id=gen_random_uuid()"]){
      await assert.rejects(nativeChildSql(scoped.pool).transaction(async db=>{
        await db.query("SELECT set_config('app.child_session_id',$1,true)",[id]);
        await db.query(`UPDATE child_stewardship.sessions SET ${update} WHERE id=$1::uuid`,[id]);
      }),/CHILD_SESSION_(REVISION_INVALID|IDENTITY_IMMUTABLE)/);
    }
    await assert.rejects(nativeChildSql(scoped.pool).transaction(async db=>{
      await db.query("SELECT set_config('app.child_session_id',$1,true)",[id]);
      await db.query('UPDATE child_stewardship.sessions SET revision=revision+1 WHERE id=$1::uuid',[id]);
    }),/CHILD_SESSION_MUTATION_REQUIRED/);
    const nonceClone=rights.payment(10,{nonce:winner.nonce,details:{payoutId:'native-replay'}});
    assert.equal((await submit(nonceClone,1)).status,403);
    assert.equal(external.mock.callCount(),0);
    const receipts=await pool.query('SELECT count(*)::int AS count FROM child_stewardship.receipts WHERE session_id=$1',[id]);assert.equal(receipts.rows[0].count,1);
    const audit=await pool.query('SELECT event FROM child_stewardship.audit WHERE session_id=$1 ORDER BY sequence',[id]);assert.ok(audit.rows.some(r=>r.event.outcome==='rejected'));
    // Rollback is non-destructive: preserve nonce and receipt facts, never restore old authority.
    await pool.query(await readFile('services/api/prisma/child-stewardship.rollback.sql','utf8'));
    assert.equal((await store.transact(id,now,tx=>tx.snapshot.version)),1);
    const identity=await scoped.pool.query('SELECT current_user AS role');
    await pool.query("INSERT INTO child_stewardship.service_role_scopes(database_role,actor_role,scope_version,enabled,approval_ref,expires_at) VALUES($1,'child',2,false,'native-readiness-revocation',clock_timestamp()+interval '1 hour')",[identity.rows[0].role]);
    assert.equal(await store.ready(),false,'latest revoked scope overrides earlier enabled scope');
    const unavailable=await app.request('/demo-sessions',{method:'POST'});
    assert.equal(unavailable.status,503,'no memory fallback after database authority revocation');
    assert.equal((await (await app.request('/status')).json()).data.available,false);
  } finally {await verifierScope?.close();await scoped?.close();await pool.end();}
});

test('native Hono learning: current withdrawal survives reconnect; request idempotency and projection are durable',async()=>{
  const pool=nativeChildPool();
  let scoped:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
  try {
    scoped=await scopedNativeChildPool(pool);
    const store=new PostgresChildStore(nativeChildSql(scoped.pool));
    const app=createChildStewardshipRoutes({mode:'synthetic-demo',store,now:()=>now});
    const created=await (await app.request('/demo-sessions',{method:'POST'})).json();
    assert.ok(created.data?.tokens);
    const tokens=created.data.tokens as Record<string,string>;
    let version=0;let sequence=0;
    async function command(role:string,fields:Record<string,unknown>){const key=`demo-native-${++sequence}`;const response=await app.request('/commands',{method:'POST',headers:{authorization:`Bearer ${tokens[role]}`,'content-type':'application/json','idempotency-key':key,'if-match':String(version)},body:JSON.stringify({commandId:key,expectedVersion:version,...fields})});const body=await response.json();if(response.status===200)version=body.version;return {response,body};}
    assert.equal((await command('guardian',{type:'create-profile',profileId:'demo-native-profile',ageBand:'9-12',locale:'zh-CN',nickname:'leaf'})).response.status,200);
    for(const purpose of ['learning','upload']){
      assert.equal((await command('guardian',{type:'grant-consent',profileId:'demo-native-profile',purpose,policyVersion:'child-learning-demo-v1'})).response.status,200);
      assert.equal((await command('child',{type:'set-assent',profileId:'demo-native-profile',purpose,willing:true})).response.status,200);
    }
    const assignment=(await command('child',{type:'assign-task',profileId:'demo-native-profile',taskId:'demo-task-leaf-comparison'})).body.data.id;
    assert.equal((await command('guardian',{type:'withdraw-consent',profileId:'demo-native-profile',purpose:'upload'})).response.status,200);
    const refused=await command('child',{type:'submit-observation',assignmentId:assignment,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:now});assert.equal(refused.response.status,403);
    const reconnected=new PostgresChildStore(nativeChildSql(scoped.pool));
    const snapshot=await reconnected.transact(created.data.sessionId,now,tx=>tx.snapshot);
    assert.equal(Object.keys(snapshot.learning.observations).length,0);
    assert.ok(Object.values(snapshot.learning.consents).some(c=>c.purpose==='upload'&&c.withdrawnAt));
  }finally{await scoped?.close();await pool.end();}
});
