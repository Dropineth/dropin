import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { PostgresChildStore } from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import { ChildRightsVerifier } from '../../services/api/src/domain/child-stewardship/verifier-admission.js';
import { admittedRightsRecordedAt,applyRightsOperation,RIGHTS_CONTRIBUTION_ADMISSION_MS } from '../../services/api/src/domain/child-stewardship/rights.js';
import { createDemoTokens } from '../../services/api/src/domain/child-stewardship/store.js';
import { createSyntheticLearningState } from '../../services/api/src/domain/child-stewardship/learning.js';
import { createChildStewardshipRoutes } from '../../services/api/src/routes/child-stewardship/index.js';
import { createSyntheticRightsFixture } from '../fixtures/child-stewardship-rights.js';
import { nativeChildPool,nativeChildSql,scopedNativeChildPool } from '../fixtures/child-stewardship-postgres.js';

test('native rights admission clock: exact immutable outputs with current execution-time authority',async t=>{
  const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
  let verification:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
  try{
    await owner.query(await readFile('services/api/prisma/child-stewardship.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-authority.sql','utf8'));
    runtime=await scopedNativeChildPool(owner);verification=await scopedNativeChildPool(owner,true);
    const client=nativeChildSql(runtime.pool);const store=new PostgresChildStore(client);
    const verifier=new ChildRightsVerifier(nativeChildSql(verification.pool));
    assert.equal(await verifier.ready(),true);
    assert.equal(await new ChildRightsVerifier(client).ready(),false);
    assert.equal(await new ChildRightsVerifier(nativeChildSql(owner)).ready(),false);
    const clock=()=>new Date().toISOString();
    const seed=async(contribution=false,credentialLifetime?:number,objectionMs?:number)=>{
      const fixture=createSyntheticRightsFixture();fixture.context.now=clock();
      if(objectionMs!==undefined)fixture.context.policy.contributionObjectionMs=objectionMs;
      if(credentialLifetime!==undefined)fixture.context.credentials.find(c=>c.keyId==='g')!.expiresAt=new Date(Date.now()+credentialLifetime).toISOString();
      let rights=fixture.funded(100);
      if(contribution){
        rights=fixture.apply(rights,fixture.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-outcome',clearingReceiptRef:'clearing-outcome'}}),['r1','t']);
        rights=fixture.apply(rights,fixture.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:['funding-outcome'],details:{outcomeId:'outcome-clock',fundingPlanId:'plan-clock'}}),['r1','t']);
      }
      const id=randomUUID();const tokens=createDemoTokens(id);
      await store.create({id,expiresAt:new Date(Date.now()+3_600_000).toISOString(),snapshot:{version:0,learning:createSyntheticLearningState(clock()),rights,rightsContext:fixture.context}},tokens.records);
      const app=createChildStewardshipRoutes({mode:'synthetic-demo',store});
      return {fixture,id,tokens,app,rights};
    };
    const submit=async(f:Awaited<ReturnType<typeof seed>>,operation:ReturnType<ReturnType<typeof createSyntheticRightsFixture>['payment']>,approvals:ReturnType<ReturnType<typeof createSyntheticRightsFixture>['approvals']>,version=0,extra:Record<string,unknown>={})=>{
      const response=await f.app.request('/rights/operations',{method:'POST',headers:{authorization:`Bearer ${f.tokens.publicTokens.operator}`,'content-type':'application/json','if-match':String(version),'idempotency-key':`clock-${randomUUID()}`},body:JSON.stringify({operation,approvals,...extra})});
      return {status:response.status,body:await response.json()};
    };
    const unchanged=async(f:Awaited<ReturnType<typeof seed>>,operation:ReturnType<ReturnType<typeof createSyntheticRightsFixture>['payment']>)=>{
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.rights_nonces WHERE session_id=$1 AND nonce=$2',[f.id,operation.nonce])).rows[0].n,0);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.receipts WHERE session_id=$1',[f.id])).rows[0].n,0);
      const state=await store.transact(f.id,clock(),tx=>tx.snapshot.rights);assert.equal(Object.keys(state.payments).length,0);
    };
    const external=t.mock.method(globalThis,'fetch',async()=>{throw new Error('unexpected external request');});

    await t.test('verifier LOGIN cannot RESET ROLE to owner and rejects owner membership or role-creation power',async()=>{
      const connection=await verification!.pool.connect();
      const ownerRole=(await owner.query('SELECT current_user')).rows[0].current_user as string;
      const verifierRole=(await connection.query('SELECT current_user')).rows[0].current_user as string;
      assert.match(ownerRole,/^[a-zA-Z0-9_]+$/);assert.match(verifierRole,/^[a-zA-Z0-9_]+$/);
      try{
        await connection.query('RESET ROLE');assert.deepEqual((await connection.query('SELECT current_user,session_user')).rows[0],{current_user:verifierRole,session_user:verifierRole});
        await assert.rejects(connection.query(`SET ROLE ${ownerRole}`),/permission denied/);
        await owner.query(`GRANT ${ownerRole} TO ${verifierRole}`);
        try{assert.equal(await verifier.ready(),false);const f=await seed(),op=f.fixture.payment();await assert.rejects(verifier.admit(f.id,op,f.fixture.approvals(op,['g','r1','t']),clock()),/VERIFIER_IDENTITY_UNAVAILABLE/);}finally{await owner.query(`REVOKE ${ownerRole} FROM ${verifierRole}`);}
        await owner.query(`ALTER ROLE ${verifierRole} CREATEROLE`);
        try{assert.equal(await verifier.ready(),false);}finally{await owner.query(`ALTER ROLE ${verifierRole} NOCREATEROLE`);}
      }finally{connection.release();}
      assert.equal(await verifier.ready(),true);
    });

    await t.test('real advancing clock admits, re-admits idempotently, and executes the exact approved delta',async()=>{
      const f=await seed();const op=f.fixture.payment();const approvals=f.fixture.approvals(op,['g','r1','t']);
      await verifier.admit(f.id,op,approvals,clock());
      const admission=(await owner.query('SELECT approved_mutations FROM child_stewardship.verification_admissions WHERE session_id=$1 AND operation_id=$2',[f.id,op.operationId])).rows[0].approved_mutations;
      const decision=admittedRightsRecordedAt(admission,op.operationId);
      await new Promise(resolve=>setTimeout(resolve,25));await verifier.admit(f.id,op,approvals,clock());
      const result=await submit(f,op,approvals);assert.equal(result.status,200,JSON.stringify(result.body));
      const state=await store.transact(f.id,clock(),tx=>tx.snapshot.rights);
      assert.equal(state.audit.at(-1)?.at,decision);
      const event=(await owner.query("SELECT event FROM child_stewardship.audit WHERE session_id=$1 AND event->>'outcome'='accepted' ORDER BY sequence DESC LIMIT 1",[f.id])).rows[0].event;
      assert.ok(Date.parse(event.time)>Date.parse(decision));
      for(const mutation of admission){
        const actual=await owner.query('SELECT payload FROM child_stewardship.state_records WHERE session_id=$1 AND domain=$2 AND collection=$3 AND record_id=$4',[f.id,'rights',mutation.collection,mutation.record_id]);
        assert.deepEqual(actual.rows[0]?.payload,mutation.payload);
      }
    });

    await t.test('operation and signer expiry at execution reject without nonce, receipt or payment effects',async()=>{
      for(const expiry of ['operation','credential']){
        const f=await seed(false,expiry==='credential'?250:undefined);
        const op=f.fixture.payment(40,expiry==='operation'?{expiresAt:new Date(Date.now()+250).toISOString()}:{});
        const approvals=f.fixture.approvals(op,['g','r1','t']);await verifier.admit(f.id,op,approvals,clock());
        await new Promise(resolve=>setTimeout(resolve,300));
        const result=await submit(f,op,approvals);assert.equal(result.status,403);
        assert.equal(result.body.error.code,expiry==='operation'?'AUTHORIZATION_EXPIRED':'CREDENTIAL_UNAVAILABLE');
        await unchanged(f,op);
      }
    });

    await t.test('contribution delay preserves a full seven-day objection window and stale or weakened-policy admissions fail',async()=>{
      const f=await seed(true);
      const op=f.fixture.operation('CONFIRM_CONTRIBUTION',{amountMinor:100,details:{contributionId:'contribution-clock',outcomeId:'outcome-clock',fundingPlanId:'plan-clock',participantCanonicalRef:'canonical-a',attributionNumerator:1,attributionDenominator:1,outcomeBudgetMinor:100}});
      const approvals=f.fixture.approvals(op,['v1','v3']);await verifier.admit(f.id,op,approvals,clock());
      const row=(await owner.query('SELECT approved_mutations,expires_at FROM child_stewardship.verification_admissions WHERE session_id=$1 AND operation_id=$2',[f.id,op.operationId])).rows[0];
      const decision=admittedRightsRecordedAt(row.approved_mutations,op.operationId);
      const original=JSON.stringify(f.rights);
      assert.equal(row.expires_at.getTime(),Date.parse(decision)+RIGHTS_CONTRIBUTION_ADMISSION_MS);
      const latest=new Date(Date.parse(decision)+RIGHTS_CONTRIBUTION_ADMISSION_MS-1).toISOString();
      const atBoundary=applyRightsOperation(f.rights,op,approvals,{...f.fixture.context,now:latest},decision);
      assert.ok(Date.parse(atBoundary.contributions['contribution-clock']!.objectionEndsAt)-Date.parse(latest)>=7*86_400_000);
      assert.throws(()=>applyRightsOperation(f.rights,op,approvals,{...f.fixture.context,now:new Date(Date.parse(decision)+RIGHTS_CONTRIBUTION_ADMISSION_MS).toISOString()},decision),/CONTRIBUTION_ADMISSION_EXPIRED/);
      for(const minimum of [0,-1,1,7*86_400_000-1])assert.throws(()=>applyRightsOperation(f.rights,op,approvals,{...f.fixture.context,now:decision,policy:{...f.fixture.context.policy,contributionObjectionMs:minimum}},decision),/OBJECTION_POLICY_INVALID/);
      const insecure=await seed(true,undefined,0);
      const unsafeOp=insecure.fixture.operation('CONFIRM_CONTRIBUTION',{amountMinor:100,details:{...op.details}});
      await assert.rejects(verifier.admit(insecure.id,unsafeOp,insecure.fixture.approvals(unsafeOp,['v1','v3']),clock()),/OBJECTION_POLICY_INVALID/);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.verification_admissions WHERE session_id=$1',[insecure.id])).rows[0].n,0);
      assert.equal(JSON.stringify(f.rights),original,'rejected stale/weakened-policy attempts preserve all input state');
      await new Promise(resolve=>setTimeout(resolve,25));
      const result=await submit(f,op,approvals);assert.equal(result.status,200,JSON.stringify(result.body));
      assert.equal(JSON.stringify(f.rights),original,'pure rejected boundary checks never mutate their input');
      const current=await store.transact(f.id,clock(),tx=>tx.snapshot.rights.contributions['contribution-clock']!);
      const applied=(await owner.query("SELECT event FROM child_stewardship.audit WHERE session_id=$1 AND event->>'outcome'='accepted' ORDER BY sequence DESC LIMIT 1",[f.id])).rows[0].event.time;
      assert.ok(Date.parse(current.objectionEndsAt)-Date.parse(applied)>=7*86_400_000);
      assert.equal(current.confirmedAt,decision);
    });

    await t.test('HTTP clients cannot supply a historical recordedAt to bypass current authorization',async()=>{
      const f=await seed();const op=f.fixture.payment();const approvals=f.fixture.approvals(op,['g','r1','t']);await verifier.admit(f.id,op,approvals,clock());
      const result=await submit(f,op,approvals,0,{recordedAt:'2026-01-01T00:00:00Z'});assert.equal(result.status,400);await unchanged(f,op);
    });

    await t.test('governed registry revocation after admission rejects the old operation without consuming its nonce',async()=>{
      const f=await seed();const op=f.fixture.payment();const approvals=f.fixture.approvals(op,['g','r1','t']);await verifier.admit(f.id,op,approvals,clock());
      const role=`clock_publisher_${randomUUID().replaceAll('-','')}`;const password=randomBytes(32).toString('hex');
      await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOINHERIT`);
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
      await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest(ARRAY['operator','registry-publisher']),1,true,'synthetic-clock-governance',clock_timestamp()+interval '1 hour'",[role]);
      const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);url.username=role;url.password=password;const publisher=new pg.Pool({connectionString:url.toString()});
      try{
        const next=structuredClone(f.fixture.context);next.signerRegistryVersion='signers-v2';next.controlDomainRegistryVersion='domains-v2';next.conflictCheckVersion='conflicts-v2';next.credentials.find(c=>c.keyId==='g')!.revoked=true;
        await owner.query("INSERT INTO child_stewardship.registry_decisions SELECT $1,'clock-revocation',encode(sha256(convert_to($2::jsonb::text,'UTF8')),'hex'),encode(sha256(convert_to($3::jsonb::text,'UTF8')),'hex'),'synthetic-clock-decision',$4,clock_timestamp()+interval '1 hour'",[f.id,JSON.stringify(f.fixture.context),JSON.stringify(next),'a'.repeat(64)]);
        await nativeChildSql(publisher).transaction(async db=>{
          await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','operator',true),set_config('app.child_operation','rights-registry-update',true),set_config('app.child_registry_decision_id','clock-revocation',true)",[f.id]);
          await db.query("SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE",[f.id]);
          await db.query("UPDATE child_stewardship.state_records SET payload=$2::jsonb,revision=1 WHERE session_id=$1 AND domain='rights' AND collection='securityContext' AND record_id='current'",[f.id,JSON.stringify(next)]);
          await db.query("UPDATE child_stewardship.sessions SET revision=1 WHERE id=$1",[f.id]);
        });
        const result=await submit(f,op,approvals,1);assert.equal(result.status,403);await unchanged(f,op);
      }finally{await publisher.end();await owner.query(`DROP OWNED BY ${role}`);await owner.query(`DROP ROLE ${role}`);}
    });
    assert.equal(external.mock.callCount(),0);
  }finally{await verification?.close();await runtime?.close();await owner.end();}
});
