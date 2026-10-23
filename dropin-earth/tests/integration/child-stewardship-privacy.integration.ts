import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {ChildPrivacyWorker} from '../../services/api/src/domain/child-stewardship/privacy.js';
import {createSyntheticLearningState} from '../../services/api/src/domain/child-stewardship/learning.js';
import {childDigest,createDemoTokens,newDemoSessionId} from '../../services/api/src/domain/child-stewardship/store.js';
import {createChildStewardshipRoutes} from '../../services/api/src/routes/child-stewardship/index.js';
import {createSyntheticRightsFixture} from '../fixtures/child-stewardship-rights.js';

test('native privacy lifecycle: actual erasure, scoped export, retained rights, suppression and immutable receipts',async t=>{
  const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;let workerPool:pg.Pool|undefined;
  const workerRole=`privacy_${randomUUID().replaceAll('-','')}`;
  try{
    for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql','child-stewardship-privacy.sql','child-stewardship-rate-limit.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
    runtime=await scopedNativeChildPool(owner);
    const workerPassword=randomBytes(32).toString('hex');
    await owner.query(`CREATE ROLE ${workerRole} LOGIN PASSWORD '${workerPassword}' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
    await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${workerRole}`);
    await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${workerRole}`);
    await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${workerRole}`);
    await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${workerRole}`);
    const verifierRegistry=(await owner.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='child_stewardship_webauthn') AS installed")).rows[0].installed;
    if(verifierRegistry){await owner.query(`GRANT USAGE ON SCHEMA child_stewardship_webauthn TO ${workerRole}`);await owner.query(`GRANT SELECT ON child_stewardship_webauthn.verifier_roles TO ${workerRole}`);}
    await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,1,true,'disposable-test-only',clock_timestamp()+interval '1 hour')",[workerRole]);
    const workerUrl=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);workerUrl.username=workerRole;workerUrl.password=workerPassword;
    workerPool=new pg.Pool({connectionString:workerUrl.toString(),max:4});
    const store=new PostgresChildStore(nativeChildSql(runtime.pool));
    const worker=new ChildPrivacyWorker(nativeChildSql(workerPool));
    const time=new Date().toISOString();
    async function fixture(){
      const id=newDemoSessionId(),tokens=createDemoTokens(id),rights=createSyntheticRightsFixture().funded(100);
      await store.create({id,expiresAt:new Date(Date.now()+86400000).toISOString(),snapshot:{version:0,learning:createSyntheticLearningState(time),rights}},tokens.records);
      const app=createChildStewardshipRoutes({mode:'synthetic-demo',store,now:()=>time});
      async function view(role='guardian'){const response=await app.request('/view',{headers:{authorization:`Bearer ${tokens.publicTokens[role as keyof typeof tokens.publicTokens]}`}});assert.equal(response.status,200);return (await response.json()).data;}
      async function command(role:string,fields:Record<string,unknown>){
        const key=`demo-${randomUUID()}`,current=await view(role),version=current.version;
        const body={commandId:key,expectedVersion:version,...fields};
        const headers:Record<string,string>={authorization:`Bearer ${tokens.publicTokens[role as keyof typeof tokens.publicTokens]}`,'content-type':'application/json','idempotency-key':key,'if-match':String(version)};
        if(fields.type==='submit-observation'){
          const assignment=current.assignments.find((item:{id:string})=>item.id===fields.assignmentId);
          const consent=current.consents.find((item:{profileId:string;purpose:string})=>item.profileId===assignment.profileId&&item.purpose==='upload');
          const response=await app.request('/draft-authorizations',{method:'POST',headers,body:JSON.stringify({draftId:key.slice(5),intentDigest:childDigest(body),assignmentId:fields.assignmentId,originalSessionId:id,originalConsentEpoch:consent.version,purpose:'synthetic-learning-upload',schemaVersion:'CanopyProof-SyntheticDraft/2',policyVersion:current.policyVersion,expectedVersion:version})});
          const admission=await response.json();assert.equal(response.status,201,JSON.stringify(admission));headers['x-child-upload-authorization']=admission.data.authorizationToken;
        }
        const response=await app.request('/commands',{method:'POST',headers,body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.data;
      }
      await command('guardian',{type:'create-profile',profileId:'demo-profile-one',ageBand:'9-12',locale:'zh-CN',nickname:'leaf'});
      for(const purpose of ['learning','upload']){await command('guardian',{type:'grant-consent',profileId:'demo-profile-one',purpose,policyVersion:'child-learning-demo-v1'});await command('child',{type:'set-assent',profileId:'demo-profile-one',purpose,willing:true});}
      const assignment=await command('child',{type:'assign-task',profileId:'demo-profile-one',taskId:'demo-task-leaf-comparison'});
      const observation=await command('child',{type:'submit-observation',assignmentId:assignment.id,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:time});
      await command('reviewer',{type:'review-observation',observationId:observation.id,decision:'insufficient_for_survival',reason:'synthetic_source'});
      await command('reviewer',{type:'grant-contribution',observationId:observation.id,policyVersion:'child-learning-demo-v1'});
      async function request(kind='delete_learning'){return (await command('guardian',{type:'request-privacy',profileId:'demo-profile-one',kind})).id as string;}
      async function result(requestId:string,role='guardian'){return app.request(`/privacy/requests/${requestId}`,{headers:{authorization:`Bearer ${tokens.publicTokens[role as keyof typeof tokens.publicTokens]}`}});}
      async function object(objectId:string,kind:string,purpose='learning',external=false,expiry:Date|null=null){await nativeChildSql(runtime!.pool).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','operator',true)",[id]);await db.query("INSERT INTO child_stewardship.privacy_objects(session_id,object_id,profile_id,purpose,kind,content,external,expires_at) VALUES($1::uuid,$2,'demo-profile-one',$3,$4,$5,$6,$7)",[id,objectId,purpose,kind,external?null:Buffer.from(`synthetic-private-copy:${objectId}`),external,expiry]);});}
      return {id,tokens,app,view,command,request,result,object,rights};
    }
    await t.test('worker requires a live dedicated LOGIN identity; RESET ROLE cannot regain owner and SET ROLE escalation is denied',async()=>{
      assert.equal(await worker.ready(),true);
      assert.equal(await new ChildPrivacyWorker(nativeChildSql(owner)).ready(),false);
      assert.equal(await new ChildPrivacyWorker(nativeChildSql(runtime!.pool)).ready(),false);
      const connection=await workerPool!.connect();
      try{
        await connection.query('RESET ROLE');
        assert.deepEqual((await connection.query('SELECT current_user,session_user')).rows[0],{current_user:workerRole,session_user:workerRole});
        const ownerRole=(await owner.query('SELECT current_user')).rows[0].current_user;
        const runtimeRole=(await runtime!.pool.query('SELECT current_user')).rows[0].current_user;
        for(const role of [ownerRole,runtimeRole]){assert.match(role,/^[a-zA-Z0-9_]+$/);await assert.rejects(connection.query(`SET ROLE ${role}`),/permission denied/);}
        // Even NOINHERIT membership permits SET ROLE; readiness rejects it.
        await owner.query(`GRANT ${runtimeRole} TO ${workerRole}`);
        try{assert.equal(await worker.ready(),false);await assert.rejects(worker.expireExports(randomUUID()),/PRIVACY_WORKER_IDENTITY_UNAVAILABLE/);}finally{await owner.query(`REVOKE ${runtimeRole} FROM ${workerRole}`);}
      }finally{connection.release();}
      assert.equal(await worker.ready(),true);
      await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,2,true,'expired-disposable-admission',clock_timestamp()-interval '1 second')",[workerRole]);
      assert.equal(await worker.ready(),false);
      for(const operation of [()=>worker.process(randomUUID(),'unknown'),()=>worker.expireExports(randomUUID()),()=>worker.processSession(randomUUID())])await assert.rejects(operation,/PRIVACY_WORKER_IDENTITY_UNAVAILABLE/);
      await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,3,false,'revoked-disposable-admission',clock_timestamp()+interval '1 hour')",[workerRole]);
      assert.equal(await worker.ready(),false);
      await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,4,true,'restored-disposable-admission',clock_timestamp()+interval '1 hour')",[workerRole]);
      assert.equal(await worker.ready(),true);
    });
    await t.test('bounded durable drain processes pending exports and expires their actual stored bytes',async()=>{
      const f=await fixture();await f.request('export_learning');await f.request('export_learning');
      const short=new ChildPrivacyWorker(nativeChildSql(workerPool!),500);
      assert.deepEqual(await short.processSession(f.id,1),{processed:1,completed:1,waiting:0,exportsExpired:0,more:true});
      assert.deepEqual(await short.processSession(f.id,5),{processed:1,completed:1,waiting:0,exportsExpired:0,more:false});
      await new Promise(resolve=>setTimeout(resolve,550));
      assert.deepEqual(await short.processSession(f.id,5),{processed:0,completed:0,waiting:0,exportsExpired:2,more:false});
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='export'",[f.id])).rows[0].n,0);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM child_stewardship.privacy_receipts WHERE session_id=$1 AND outcome='deleted'",[f.id])).rows[0].n,2);
      for(const limit of [0,101,1.5])await assert.rejects(short.processSession(f.id,limit),/PRIVACY_BATCH_INVALID/);
    });
    await t.test('worker admission expiring during a real session lock wait cannot process or erase anything',async()=>{
      const f=await fixture(),request=await f.request();
      await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,5,true,'lock-wait-expiry',clock_timestamp()+interval '500 milliseconds')",[workerRole]);
      const blocker=await owner.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[f.id]);
      const pending=worker.process(f.id,request);const rejected=assert.rejects(pending,/PRIVACY_WORKER_IDENTITY_UNAVAILABLE/);
      try{
        let blocked=false;
        for(let attempt=0;attempt<100;attempt++){if((await owner.query("SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",[workerRole])).rows.length){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}
        assert.equal(blocked,true);await new Promise(resolve=>setTimeout(resolve,550));
      }finally{await blocker.query('ROLLBACK');blocker.release();}
      await rejected;
      assert.equal((await owner.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1 AND request_id=$2',[f.id,request])).rows[0].state,'requested');
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.privacy_receipts WHERE session_id=$1',[f.id])).rows[0].n,0);
      await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,6,true,'restored-after-wait',clock_timestamp()+interval '1 hour')",[workerRole]);
      assert.deepEqual(await worker.processSession(f.id),{processed:1,completed:1,waiting:0,exportsExpired:0,more:false});
    });
    await t.test('guardian exports omit protected case existence; wrong actor and revoked credentials cannot download',async()=>{
      const f=await fixture();const first=await f.request('export_learning');assert.deepEqual(await worker.process(f.id,first),{state:'completed'});
      const before=(await (await f.result(first)).json()).data.export;
      await f.command('child',{type:'open-dispute',profileId:'demo-profile-one',targetId:'demo-profile-one',reason:'unsafe_adult'});
      const second=await f.request('export_learning');await worker.process(f.id,second);
      assert.deepEqual((await (await f.result(second)).json()).data.export,before);
      assert.equal((await f.result(second,'reviewer')).status,403);
      const principal=f.tokens.records.find(x=>x.principal.actorId==='demo-guardian')!.principal;
      await f.command('guardian',{type:'revoke-device',actorId:'demo-guardian',deviceId:'demo-device-guardian'});
      await assert.rejects(store.privacyResult(f.id,principal,second,time),error=>!!error&&typeof error==='object'&&'code'in error&&error.code==='UNAUTHORIZED');
      assert.equal((await f.result(second)).status,401);
    });
    await t.test('delete local source/derived/index/cache/export/mirror/processor/expired backups; retain protected and R/F facts',async()=>{
      const f=await fixture();
      for(const kind of ['source','derived','index','cache','export','mirror','processor','backup'])await f.object(`copy-${kind}`,kind,'learning',false,kind==='backup'?new Date(Date.now()-1000):null);
      await f.object('protected-copy','source','protection');await f.object('rights-copy','source','rights');
      await f.command('child',{type:'open-dispute',profileId:'demo-profile-one',targetId:'demo-profile-one',reason:'unsafe_adult'});
      const canonical=(await owner.query("SELECT payload FROM child_stewardship.state_records WHERE session_id=$1 AND domain='learning' AND collection='profiles'",[f.id])).rows[0].payload.canonicalParticipantRef;
      const original=(await owner.query("SELECT collection,record_id,payload FROM child_stewardship.state_records WHERE session_id=$1 AND domain='rights' ORDER BY collection,record_id",[f.id])).rows;
      const request=await f.request();assert.equal((await f.view()).observations.length,0,'suppression precedes worker');
      assert.deepEqual(await worker.process(f.id,request),{state:'completed'});assert.deepEqual(await worker.process(f.id,request),{state:'completed'});
      assert.equal((await (await f.result(request)).json()).data.state,'learning_access_withdrawn');
      assert.deepEqual((await owner.query('SELECT object_id FROM child_stewardship.privacy_objects WHERE session_id=$1 ORDER BY object_id',[f.id])).rows.map(r=>r.object_id),['protected-copy','rights-copy']);
      assert.deepEqual((await owner.query("SELECT collection,record_id,payload FROM child_stewardship.state_records WHERE session_id=$1 AND domain='rights' ORDER BY collection,record_id",[f.id])).rows,original);
      const receipts=(await owner.query('SELECT * FROM child_stewardship.privacy_receipts WHERE session_id=$1',[f.id])).rows;assert.ok(receipts.some(r=>r.outcome==='deleted'));assert.ok(!JSON.stringify(receipts).includes('synthetic-private-copy'));
      await assert.rejects(owner.query("UPDATE child_stewardship.privacy_receipts SET outcome='retained' WHERE session_id=$1",[f.id]),/IMMUTABLE/);
      await assert.rejects(nativeChildSql(runtime!.pool).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','guardian',true),set_config('app.child_operation','create-profile',true)",[f.id]);await db.query("INSERT INTO child_stewardship.state_records VALUES($1::uuid,'learning','profiles','demo-renamed',$2::jsonb,99,0)",[f.id,JSON.stringify({id:'demo-renamed',canonicalParticipantRef:canonical})]);}),/SUPPRESSED/);
    });
    await t.test('external processor and live backup remain waiting, cannot forge completion',async()=>{
      const f=await fixture();await f.object('remote-copy','processor','learning',true);await f.object('future-backup','backup','learning',false,new Date(Date.now()+60000));const request=await f.request();
      assert.deepEqual(await worker.process(f.id,request),{state:'waiting'});
      await assert.rejects(nativeChildSql(workerPool!).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_privacy_request_id',$2,true)",[f.id,request]);await db.query("UPDATE child_stewardship.privacy_jobs SET state='processing' WHERE session_id=$1 AND request_id=$2",[f.id,request]);await db.query("UPDATE child_stewardship.privacy_jobs SET state='completed',completed_at=clock_timestamp() WHERE session_id=$1 AND request_id=$2",[f.id,request]);}),/PENDING|INCOMPLETE/);
    });
    await t.test('failed byte deletion rolls back all state and receipts; retry completes once',async()=>{
      const f=await fixture();await f.object('crash-copy','source');const request=await f.request();let crash=true;
      const broken=new ChildPrivacyWorker(nativeChildSql(workerPool!,sql=>{if(crash&&sql.startsWith('DELETE FROM child_stewardship.privacy_objects')){crash=false;throw new Error('injected privacy byte failure');}}));
      await assert.rejects(broken.process(f.id,request),/injected/);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.privacy_receipts WHERE session_id=$1',[f.id])).rows[0].n,0);
      assert.equal((await owner.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1 AND request_id=$2',[f.id,request])).rows[0].state,'requested');
      assert.deepEqual(await worker.process(f.id,request),{state:'completed'});
    });
    await t.test('real backup deadline and expired legal hold trigger followup physical cleanup without changing R/F',async()=>{
      const backup=await fixture();await backup.object('timed-backup','backup','learning',false,new Date(Date.now()+700));const backupRequest=await backup.request();
      assert.deepEqual(await worker.process(backup.id,backupRequest),{state:'waiting'});
      await new Promise(resolve=>setTimeout(resolve,750));
      assert.deepEqual(await worker.process(backup.id,backupRequest),{state:'completed'});
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.privacy_objects WHERE session_id=$1',[backup.id])).rows[0].n,0);
      const held=await fixture();await held.object('held-copy','source');
      await owner.query("INSERT INTO child_stewardship.privacy_legal_holds VALUES($1,'demo-profile-one','synthetic-hold','synthetic-independent-authority',clock_timestamp()+interval '800 milliseconds')",[held.id]);
      const request=await held.request();assert.deepEqual(await worker.process(held.id,request),{state:'completed'});
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.privacy_objects WHERE session_id=$1',[held.id])).rows[0].n,1);
      await new Promise(resolve=>setTimeout(resolve,850));
      assert.deepEqual(await worker.process(held.id,request),{state:'completed'});
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.privacy_objects WHERE session_id=$1',[held.id])).rows[0].n,0);
      assert.deepEqual((await store.transact(held.id,time,tx=>tx.snapshot.rights)),held.rights);
    });
    await t.test('export expiry stops serving and physical sweep removes bytes with immutable receipt',async()=>{
      const f=await fixture(),request=await f.request('export_learning');const short=new ChildPrivacyWorker(nativeChildSql(workerPool!),500);
      await short.process(f.id,request);assert.equal((await f.result(request)).status,200);
      await new Promise(resolve=>setTimeout(resolve,550));assert.equal((await f.result(request)).status,503);
      assert.equal(await short.expireExports(f.id),1);assert.equal(await short.expireExports(f.id),0);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship.privacy_objects WHERE session_id=$1',[f.id])).rows[0].n,0);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM child_stewardship.privacy_receipts WHERE session_id=$1 AND outcome='deleted'",[f.id])).rows[0].n,1);
    });
    await t.test('privacy worker cannot mint tokens, change rights, forge receipts or inspect foreign retention facts',async()=>{
      const a=await fixture(),b=await fixture();
      await owner.query("INSERT INTO child_stewardship.privacy_legal_holds VALUES($1,'demo-profile-one','foreign-hold','synthetic-authority',clock_timestamp()+interval '1 hour')",[b.id]);
      const queryAs=(pool:pg.Pool,sql:string,values:unknown[])=>nativeChildSql(pool).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','operator',true)",[a.id]);return db.query(sql,values);});
      assert.equal((await queryAs(runtime!.pool,"SELECT child_stewardship.privacy_profile_held($1::uuid,'demo-profile-one') AS held",[b.id]))[0]!.held,false);
      assert.equal((await queryAs(workerPool!,"SELECT child_stewardship.privacy_profile_held($1::uuid,'demo-profile-one') AS held",[b.id]))[0]!.held,false);
      await assert.rejects(queryAs(workerPool!,"UPDATE child_stewardship.session_tokens SET actor_id='demo-operator' WHERE session_id=$1",[a.id]),/NARROW_SCOPE|IMMUTABLE/);
      await assert.rejects(queryAs(workerPool!,"UPDATE child_stewardship.state_records SET payload=jsonb_set(payload,'{clearedAssetsMinor}','999'),revision=revision+1 WHERE session_id=$1 AND domain='rights' AND collection='fundingLots'",[a.id]),/SCOPE|ROLE|ADMISSION/);
      await assert.rejects(queryAs(runtime!.pool,"DELETE FROM child_stewardship.state_records WHERE session_id=$1 AND domain='learning' AND collection='observations'",[a.id]),/CHILD_CANONICAL_DELETE_FORBIDDEN/);
    });
    await t.test('ordinary deletion results reveal neither protected report nor hidden hold through processing status',async()=>{
      const outputs:unknown[]=[];
      for(const hidden of [false,true]){
        const f=await fixture();await f.object('known-processor','processor','learning',true);await f.object('known-backup','backup','learning',false,new Date(Date.now()+60000));
        if(hidden){await f.command('child',{type:'open-dispute',profileId:'demo-profile-one',targetId:'demo-profile-one',reason:'unsafe_adult'});await owner.query("INSERT INTO child_stewardship.privacy_legal_holds VALUES($1,'demo-profile-one','confidential-hold','synthetic-protection-authority',clock_timestamp()+interval '1 hour')",[f.id]);}
        const request=await f.request();const before=(await (await f.result(request)).json()).data;
        const ordinaryViewBefore=await f.view();
        assert.deepEqual(ordinaryViewBefore.privacyRequests,[]);
        assert.deepEqual(await worker.process(f.id,request),{state:'waiting'});
        const after=(await (await f.result(request)).json()).data;
        assert.deepEqual(after,before);
        assert.deepEqual(await f.view(),ordinaryViewBefore,'the complete ordinary view cannot reveal physical erasure versus confidential retention');
        const {requestId,...ordinary}=after;assert.equal(requestId,request);outputs.push(ordinary);
      }
      assert.deepEqual(outputs[0],outputs[1]);
    });
  }finally{await workerPool?.end();await runtime?.close();await owner.query(`DROP OWNED BY ${workerRole}`).catch(()=>{});await owner.query(`DROP ROLE ${workerRole}`).catch(()=>{});await owner.end();}
});
