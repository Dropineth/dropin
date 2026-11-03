import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {syntheticAuthenticator} from '../fixtures/child-stewardship-webauthn.js';
import {ChildSyntheticWebAuthn} from '../../services/api/src/domain/child-stewardship/webauthn.js';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {PostgresChildResumeStore} from '../../services/api/src/domain/child-stewardship/resume-store.js';
import {createChildStewardshipRoutes} from '../../services/api/src/routes/child-stewardship/index.js';
import {createSyntheticLearningState,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {createEmptyRightsState} from '../../services/api/src/domain/child-stewardship/rights.js';
import {childDigest,createDemoTokens,tokenDigest} from '../../services/api/src/domain/child-stewardship/store.js';

// Real crypto + Hono + independent non-owner database logins + native row locks.
// Only fixed synthetic identities and in-process authenticator keys are used.
test('native guardian product sessions: exact binding, one-use exchange and execution-time revocation',async t=>{
 const admin=nativeChildPool();const originalUrl=process.env.CANOPYPROOF_NATIVE_DATABASE_URL!;
 const database=`guardian_native_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${database}`);
 const testUrl=new URL(originalUrl);testUrl.pathname=`/${database}`;process.env.CANOPYPROOF_NATIVE_DATABASE_URL=testUrl.toString();
 const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
 let verifier:pg.Pool|undefined;let verifierRole='';
 try{
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-webauthn.sql','child-stewardship-resume.sql','child-stewardship-guardian-sessions.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  runtime=await scopedNativeChildPool(owner);const role=(await runtime.pool.query('SELECT current_user AS role')).rows[0].role;
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship_guardian,child_stewardship_webauthn TO ${role}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA child_stewardship_webauthn TO ${role}`);
  await owner.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA child_stewardship_webauthn TO ${role}`);
  for(const signature of ['capability_session(text,uuid)','exchange(text,uuid)','authorize(text,uuid)','logout(text,uuid)'])await owner.query(`GRANT EXECUTE ON FUNCTION child_stewardship_guardian.${signature} TO ${role}`);
  verifierRole=`guardian_verify_${randomUUID().replaceAll('-','')}`;const password=randomBytes(32).toString('hex');
  await owner.query(`CREATE ROLE ${verifierRole} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOINHERIT`);
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship_webauthn TO ${verifierRole}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA child_stewardship_webauthn TO ${verifierRole}`);
  await owner.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA child_stewardship_webauthn TO ${verifierRole}`);
  await owner.query("INSERT INTO child_stewardship_webauthn.verifier_roles VALUES($1,true,clock_timestamp()+interval '1 hour')",[verifierRole]);
  const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);url.username=verifierRole;url.password=password;verifier=new pg.Pool({connectionString:url.toString(),max:6});
  const client=nativeChildSql(runtime.pool);const store=new PostgresChildStore(client);
  assert.equal(await store.ready(),true);
  const external=t.mock.method(globalThis,'fetch',async()=>{throw new Error('unexpected external request');});
  async function fixture(bindingVersion=1,taskLifetime?:number){
   const id=randomUUID(),tokens=createDemoTokens(id),now=new Date().toISOString();
   const learning=createSyntheticLearningState(now);if(taskLifetime)learning.tasks['demo-task-leaf-comparison']!.closesAt=new Date(Date.now()+taskLifetime).toISOString();
   await store.create({id,expiresAt:new Date(Date.now()+3_600_000).toISOString(),snapshot:{version:0,learning,rights:createEmptyRightsState()}},tokens.records);
   const app=createChildStewardshipRoutes({mode:'synthetic-demo',store,resumeStore:new PostgresChildResumeStore(client)});
   const view=async(token=tokens.publicTokens.child)=>{const r=await app.request('/view',{headers:{authorization:`Bearer ${token}`}});assert.equal(r.status,200,await r.clone().text());return (await r.json()).data;};
   const post=(path:string,body:unknown,token=tokens.publicTokens.guardian,headers:Record<string,string>={})=>app.request(path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...headers},body:JSON.stringify(body)});
   const command=async(token:string,fields:Record<string,unknown>)=>{const current=await view(token),packet={commandId:`demo-${randomUUID()}`,expectedVersion:current.version,...fields};const r=await post('/commands',packet,token,{'idempotency-key':packet.commandId,'if-match':String(packet.expectedVersion)});assert.equal(r.status,200,await r.clone().text());return (await r.json()).data;};
   await command(tokens.publicTokens.guardian,{type:'create-profile',profileId:'demo-profile-a',ageBand:'9-12',locale:'en',nickname:'leaf'});
   const authenticator=syntheticAuthenticator(),webauthn=new ChildSyntheticWebAuthn(client,authenticator.fixture,nativeChildSql(verifier!));
   const scope=await webauthn.createFixtureSandbox(new Date().toISOString());
   const registration=await webauthn.begin(scope,'registration',new Date().toISOString());
   await webauthn.finish(scope,registration.ceremonyId,authenticator.registration({challenge:registration.options.challenge}),new Date().toISOString());
   const binding=randomUUID();
   await owner.query(`INSERT INTO child_stewardship_guardian.bindings(id,session_id,sandbox_id,actor_id,device_id,actor_epoch,generation,profile_id,guardian_link_version,credential_id,credential_epoch,approval_ref,expires_at)
    VALUES($1,$2,$3,'demo-guardian','demo-device-guardian',1,0,'demo-profile-a',$5,$4,1,'local-synthetic-owner-binding',clock_timestamp()+interval '30 minutes')`,[binding,id,scope.sandboxId,authenticator.fixture.credentialId,bindingVersion]);
   let counter=0;
   const authenticate=async()=>{const begin=await webauthn.begin(scope,'authentication',new Date().toISOString());const result=await webauthn.finish(scope,begin.ceremonyId,authenticator.authentication({challenge:begin.options.challenge,counter:++counter}),new Date().toISOString());assert.ok(result.sessionToken);return result.sessionToken;};
   const login=async()=>{const authenticationToken=await authenticate();const r=await post('/guardian/sessions',{bindingId:binding,authenticationToken});assert.equal(r.status,201,await r.clone().text());const data=(await r.json()).data;assert.equal(data.identityVerified,false);assert.equal(data.syntheticOnly,true);assert.equal('tokens'in data,false);assert.equal(data.principal.actorId,'demo-guardian');return data.sessionToken as string;};
   return {id,tokens,app,view,post,command,webauthn,scope,binding,authenticate,login};
  }
  await t.test('actual ES256 login creates only guardian session; current consent and child assent remain separate; old upload proof denied after withdrawal',async()=>{
   const f=await fixture(),guardian=await f.login();assert.match(guardian,/^cp-guardian\.[A-Za-z0-9_-]{43}$/);
   assert.equal((await new PostgresChildStore(client).guardianSessions.resolve(guardian)).sessionId,f.id,'persisted session survives service restart');
   for(const purpose of ['learning','upload']){
    await f.command(guardian,{type:'grant-consent',profileId:'demo-profile-a',purpose,policyVersion:'child-learning-demo-v1'});
    const v=await f.view(guardian);const forged={type:'set-assent',commandId:`demo-${randomUUID()}`,expectedVersion:v.version,profileId:'demo-profile-a',purpose,willing:true};
    assert.equal((await f.post('/commands',forged,guardian,{'idempotency-key':forged.commandId,'if-match':String(v.version)})).status,403);
    await f.command(f.tokens.publicTokens.child,{type:'set-assent',profileId:'demo-profile-a',purpose,willing:true});
   }
   const assignment=(await f.command(f.tokens.publicTokens.child,{type:'assign-task',profileId:'demo-profile-a',taskId:'demo-task-leaf-comparison'})).id;
   const current=await f.view(),draftId=randomUUID();
   const packet={type:'submit-observation',commandId:`demo-${draftId}`,expectedVersion:current.version,assignmentId:assignment,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:new Date().toISOString()};
   const proposal={draftId,intentDigest:childDigest(packet),assignmentId:assignment,originalSessionId:f.id,originalConsentEpoch:current.uploadEligibility[0].consentEpoch,purpose:'synthetic-learning-upload',schemaVersion:'CanopyProof-SyntheticDraft/2',policyVersion:current.policyVersion,expectedVersion:current.version};
   const grant=await f.post('/draft-authorizations',proposal,f.tokens.publicTokens.child);assert.equal(grant.status,201);const proof=(await grant.json()).data.authorizationToken;
   assert.equal((await f.post('/draft-authorizations',proposal,guardian)).status,401,'guardian cannot mint child upload permission');
   await f.command(guardian,{type:'withdraw-consent',profileId:'demo-profile-a',purpose:'upload'});
   const rejected=await f.post('/commands',packet,f.tokens.publicTokens.child,{'idempotency-key':packet.commandId,'if-match':String(packet.expectedVersion),'x-child-upload-authorization':proof});assert.notEqual(rejected.status,200);
   assert.equal((await owner.query("SELECT count(*)::int AS n FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.id])).rows[0].n,0);
   assert.equal((await f.post('/rights/operations',{operation:{},approvals:[]},guardian,{'idempotency-key':'guardian-rights-denial','if-match':'0'})).status,403);
   assert.equal((await f.post('/suspend',{},guardian)).status,401,'fixture resume must not issue all-role tokens for guardian bearer');
   const complaint=await f.command(f.tokens.publicTokens.child,{type:'open-dispute',profileId:'demo-profile-a',targetId:'demo-profile-a',reason:'unsafe_adult'});
   assert.equal(JSON.stringify(await f.view(guardian)).includes(complaint.id),false,'guardian session cannot disclose a protected complaint');
   const privacy=await f.command(guardian,{type:'request-privacy',profileId:'demo-profile-a',kind:'export_learning'});
   const receipt=await f.app.request(`/privacy/requests/${privacy.id}`,{headers:{authorization:`Bearer ${guardian}`}});assert.equal(receipt.status,200);assert.equal((await receipt.json()).data.state,'requested');
   const logout=await f.post('/guardian/logout',{},guardian);assert.equal(logout.status,200);
   assert.equal((await f.app.request('/view',{headers:{authorization:`Bearer ${guardian}`}})).status,401);
   assert.ok(await f.view(f.tokens.publicTokens.child),'logout does not revoke unrelated child participation');
   assert.ok(await f.view(await f.login()),'new verified authentication is required after logout');
  });
  await t.test('one authentication consumed once under concurrent exchanges; caller cannot select role, tenant, lifetime or verified status',async()=>{
   const f=await fixture(),authenticationToken=await f.authenticate();
   for(const field of ['role','actorId','sessionId','expiresAt','verified'])assert.equal((await f.post('/guardian/sessions',{bindingId:f.binding,authenticationToken,[field]:true})).status,400);
   const results=await Promise.all([f.post('/guardian/sessions',{bindingId:f.binding,authenticationToken}),f.post('/guardian/sessions',{bindingId:f.binding,authenticationToken})]);
   assert.deepEqual(results.map(r=>r.status).sort(),[201,401]);
   const winner=await results.find(r=>r.status===201)!.json();
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship_guardian.sessions WHERE binding_id=$1',[f.binding])).rows[0].n,1);
   await f.post('/guardian/logout',{},winner.data.sessionToken);
   assert.equal((await f.post('/guardian/sessions',{bindingId:f.binding,authenticationToken})).status,401,'logout cannot resurrect consumed admission');
   const second=await fixture();assert.equal((await second.post('/guardian/sessions',{bindingId:second.binding,authenticationToken:await f.authenticate()})).status,401);
   const token=await second.login();await assert.rejects(store.transact(f.id,new Date().toISOString(),()=>{throw new Error('must not execute');},{guardianToken:token}),/UNAUTHORIZED/);
  });
  await t.test('runtime SQL cannot forge binding/session even with all table grants, known hashes or fake GUCs; verifier login cannot use product gate',async()=>{
   const f=await fixture(),token=await f.login();
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship_guardian TO ${role}`);
   await owner.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA child_stewardship_guardian TO ${role}`);
   try{
    await runtime!.pool.query("SELECT set_config('app.child_actor_role','guardian',false),set_config('app.child_session_id',$1,false)",[f.id]);
    assert.equal((await runtime!.pool.query('SELECT * FROM child_stewardship_guardian.sessions')).rowCount,0);
    const existingBinding=(await owner.query('SELECT * FROM child_stewardship_guardian.bindings WHERE id=$1',[f.binding])).rows[0];
    const columns=Object.keys(existingBinding);await assert.rejects(runtime!.pool.query(`INSERT INTO child_stewardship_guardian.bindings(${columns.join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(existingBinding)),/GUARDIAN_AUTH_FUNCTION_REQUIRED|row-level security/);
    await assert.rejects(runtime!.pool.query("INSERT INTO child_stewardship_guardian.audit(binding_id,action) VALUES($1,'exchange')",[f.binding]),/GUARDIAN_AUTH_FUNCTION_REQUIRED|row-level security/);
    assert.equal((await runtime!.pool.query('SELECT child_stewardship_guardian.authorize($1,$2) AS identity',[tokenDigest(token),f.id])).rows[0].identity,null);
    await assert.rejects(runtime!.pool.query('SELECT child_stewardship_guardian.current_binding($1)',[f.binding]),/permission denied/);
    const snapshot=(await owner.query('SELECT * FROM child_stewardship_guardian.sessions WHERE binding_id=$1',[f.binding])).rows[0];
    await assert.rejects(runtime!.pool.query('INSERT INTO child_stewardship_guardian.sessions VALUES($1,$2,$3,$4,$5,false)',['a'.repeat(64),f.binding,snapshot.authentication_id,snapshot.created_at,snapshot.expires_at]),/GUARDIAN_AUTH_FUNCTION_REQUIRED|row-level security/);
    await assert.rejects(owner.query('UPDATE child_stewardship_guardian.bindings SET actor_id=$2 WHERE id=$1',[f.binding,'demo-operator']),/GUARDIAN_AUTH_IMMUTABLE/);
   }finally{await runtime!.pool.query('RESET ALL');}
   await owner.query(`GRANT USAGE ON SCHEMA child_stewardship_guardian TO ${verifierRole}`);
   await owner.query(`GRANT EXECUTE ON FUNCTION child_stewardship_guardian.authorize(text,uuid) TO ${verifierRole}`);
   assert.equal((await verifier!.query('SELECT child_stewardship_guardian.authorize($1,$2) AS identity',[token,f.id])).rows[0].identity,null);
  });
  await t.test('credential, actor/device and guardian-link version revocations invalidate captured identity at execution',async()=>{
   const f=await fixture(),token=await f.login();await store.guardianSessions.resolve(token);
   await f.webauthn.revoke(f.scope,new Date().toISOString());
   let ran=false;await assert.rejects(store.transact(f.id,new Date().toISOString(),()=>{ran=true;},{guardianToken:token}),/UNAUTHORIZED/);assert.equal(ran,false);
   const device=await fixture(),deviceToken=await device.login();
   await device.command(deviceToken,{type:'revoke-device',actorId:'demo-guardian',deviceId:'demo-device-guardian'});
   await assert.rejects(store.guardianSessions.resolve(deviceToken),/UNAUTHORIZED/);
   const changed=await fixture(2);
   assert.equal((await changed.post('/guardian/sessions',{bindingId:changed.binding,authenticationToken:await changed.authenticate()})).status,401,'bound guardian-link version must match current relationship');
  });
  await t.test('revocation committed while request waits for tenant lock prevents the already-resolved request from executing',async()=>{
   const f=await fixture(),token=await f.login();await store.guardianSessions.resolve(token);
   const blocker=await owner.connect();let ran=false;
   try{
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[f.id]);
    const pending=store.transact(f.id,new Date().toISOString(),()=>{ran=true;},{guardianToken:token});const checked=assert.rejects(pending,/UNAUTHORIZED/);
    await blocker.query('UPDATE child_stewardship_guardian.bindings SET revoked=true WHERE id=$1',[f.binding]);await blocker.query('COMMIT');
    await checked;assert.equal(ran,false);
   }finally{await blocker.query('ROLLBACK');blocker.release();}
  });
  await t.test('sandbox lock wait refreshes execution time before a task deadline is evaluated',async()=>{
   const f=await fixture(1,1800),token=await f.login();
   for(const purpose of ['learning','upload']){
    await f.command(token,{type:'grant-consent',profileId:'demo-profile-a',purpose,policyVersion:'child-learning-demo-v1'});
    await f.command(f.tokens.publicTokens.child,{type:'set-assent',profileId:'demo-profile-a',purpose,willing:true});
   }
   const identity=await store.guardianSessions.resolve(token);
   const snapshot=await store.transact(f.id,new Date().toISOString(),tx=>tx.snapshot);
   const expiry=Date.parse(snapshot.learning.tasks['demo-task-leaf-comparison']!.closesAt);
   assert.ok(expiry>Date.now(),'positive control begins before the task expires');
   const command={type:'assign-task',commandId:`demo-${randomUUID()}`,expectedVersion:snapshot.learning.version,profileId:'demo-profile-a',taskId:'demo-task-leaf-comparison'};
   assert.equal(executeLearningCommand(snapshot.learning,command,identity.principal,new Date().toISOString()).result.status,'assigned');
   const blocker=await owner.connect();
   try{
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM child_stewardship_webauthn.sandboxes WHERE id=$1 FOR UPDATE',[f.scope.sandboxId]);
    const pending=store.transact(f.id,new Date().toISOString(),tx=>executeLearningCommand(tx.snapshot.learning,command,identity.principal,tx.executionTime!),{guardianToken:token});
    const denied=assert.rejects(pending,/TASK_EXPIRED/);
    // Wait for this exact runtime to reach the sandbox lock, not an assumed schedule.
    const deadline=Date.now()+1000;let waiting=false;
    while(Date.now()<deadline){
     waiting=(await owner.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock' AND query LIKE '%child_stewardship_guardian.authorize%') AS waiting",[role])).rows[0].waiting;
     if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true);await new Promise(resolve=>setTimeout(resolve,Math.max(1,expiry-Date.now()+30)));
    await blocker.query('COMMIT');await denied;
   }finally{await blocker.query('ROLLBACK');blocker.release();}
   assert.equal((await owner.query("SELECT count(*)::int AS n FROM child_stewardship.state_records WHERE session_id=$1 AND collection='assignments'",[f.id])).rows[0].n,0);
  });
  await t.test('runtime role revocation committed during sandbox wait invalidates execution',async()=>{
   const f=await fixture(),token=await f.login();const blocker=await owner.connect();let ran=false;
   try{
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM child_stewardship_webauthn.sandboxes WHERE id=$1 FOR UPDATE',[f.scope.sandboxId]);
    const denied=assert.rejects(store.transact(f.id,new Date().toISOString(),()=>{ran=true;},{guardianToken:token}),/UNAUTHORIZED/);
    const deadline=Date.now()+1000;let waiting=false;
    while(Date.now()<deadline){waiting=(await owner.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock' AND query LIKE '%child_stewardship_guardian.authorize%') AS waiting",[role])).rows[0].waiting;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));}
    assert.equal(waiting,true);
    await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'guardian',2,false,'local-synthetic-revocation',clock_timestamp()+interval '1 hour')",[role]);
    await blocker.query('COMMIT');await denied;assert.equal(ran,false);
   }finally{await blocker.query('ROLLBACK');blocker.release();await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'guardian',3,true,'local-synthetic-restoration',clock_timestamp()+interval '1 hour')",[role]);}
  });
  await t.test('session-generation recovery does not revive old guardian authority or old authentication exchange',async()=>{
   const f=await fixture(),token=await f.login(),authenticationToken=await f.authenticate();
   const suspended=await f.post('/suspend',{},f.tokens.publicTokens.child);assert.equal(suspended.status,200);const ticket=(await suspended.json()).data.resumeTicket;
   const resumed=await f.post('/resume',{resumeTicket:ticket},f.tokens.publicTokens.child);assert.equal(resumed.status,200);
   await assert.rejects(store.guardianSessions.resolve(token),/UNAUTHORIZED/);
   assert.equal((await f.post('/guardian/sessions',{bindingId:f.binding,authenticationToken})).status,401);
   assert.equal((await f.post('/guardian/passkeys/recover',{})).status,503);
  });
  await t.test('missing independent restore anchor fails closed for login, not a fallback to a database self-assertion',async()=>{
   const f=await fixture(),authenticationToken=await f.authenticate();
   const guarded=new PostgresChildStore(client,async()=>{throw new Error('independent checkpoint unavailable');});
   await assert.rejects(guarded.guardianSessions.exchange({bindingId:f.binding,authenticationToken}),/RESTORATION_UNVERIFIED/);
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship_guardian.sessions WHERE binding_id=$1',[f.binding])).rows[0].n,0);
  });
  await t.test('non-destructive rollback disables exchange and retains consumed authentication and audit',async()=>{
   const f=await fixture(),token=await f.login(),authenticationToken=await f.authenticate();
   const counts=async()=>(await owner.query('SELECT (SELECT count(*) FROM child_stewardship_guardian.sessions) AS sessions,(SELECT count(*) FROM child_stewardship_guardian.audit) AS audit')).rows[0];
   const before=await counts();
   await owner.query(await readFile('services/api/prisma/child-stewardship-guardian-sessions.rollback.sql','utf8'));
   assert.equal((await runtime!.pool.query('SELECT child_stewardship_guardian.authorize($1,$2) AS identity',[token,f.id])).rows[0].identity,null);assert.deepEqual(await counts(),before);
   await owner.query(await readFile('services/api/prisma/child-stewardship-guardian-sessions.sql','utf8'));
   await assert.rejects(store.guardianSessions.exchange({bindingId:f.binding,authenticationToken}),/UNAUTHORIZED/);
   await assert.rejects(store.guardianSessions.resolve(token),/UNAUTHORIZED/);
  });
  await t.test('restore isolation, admission expiry under lock, and complete multi-authenticator roots under non-bypass RLS',async()=>{
   const f=await fixture(),token=await f.login(),authenticationToken=await f.authenticate();
   // A second independently pinned authenticator belongs to the same synthetic
   // guardian. It must not disappear from the restore root under FORCE RLS.
   const otherAuthenticator=syntheticAuthenticator();const otherService=new ChildSyntheticWebAuthn(client,otherAuthenticator.fixture,nativeChildSql(verifier!));
   const otherScope=await otherService.createFixtureSandbox(new Date().toISOString());
   const registration=await otherService.begin(otherScope,'registration',new Date().toISOString());
   await otherService.finish(otherScope,registration.ceremonyId,otherAuthenticator.registration({challenge:registration.options.challenge}),new Date().toISOString());
   await owner.query(`INSERT INTO child_stewardship_guardian.bindings SELECT $1,session_id,$2,actor_id,device_id,actor_epoch,generation,profile_id,guardian_link_version,$3,credential_epoch,approval_ref,clock_timestamp(),expires_at,false FROM child_stewardship_guardian.bindings WHERE id=$4`,[randomUUID(),otherScope.sandboxId,otherAuthenticator.fixture.credentialId,f.binding]);
   await owner.query(await readFile('services/api/prisma/child-stewardship-restore.sql','utf8'));
   const before=(await owner.query('SELECT count(*)::int AS n FROM child_stewardship_guardian.sessions WHERE binding_id=$1',[f.binding])).rows[0].n;
   assert.equal((await runtime!.pool.query('SELECT child_stewardship_guardian.exchange($1,$2) AS result',[authenticationToken,f.binding])).rows[0].result,null);
   assert.equal((await runtime!.pool.query('SELECT child_stewardship_guardian.authorize($1,$2) AS result',[token,f.id])).rows[0].result,null);
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM child_stewardship_guardian.sessions WHERE binding_id=$1',[f.binding])).rows[0].n,before);
   const reader=`guardian_root_${randomUUID().replaceAll('-','')}`,originalOwner=(await owner.query('SELECT current_user AS name')).rows[0].name;
   await owner.query(`CREATE ROLE ${reader} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
   await owner.query(`GRANT USAGE ON SCHEMA child_stewardship,child_stewardship_guardian,child_stewardship_webauthn TO ${reader}`);
   await owner.query(`GRANT CREATE ON SCHEMA child_stewardship,child_stewardship_guardian TO ${reader}`);
   for(const schema of ['child_stewardship','child_stewardship_guardian','child_stewardship_webauthn']){
    await owner.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${reader}`);
    await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${reader}`);
   }
   await owner.query(`ALTER TABLE child_stewardship_guardian.bindings OWNER TO ${reader}`);
   await owner.query(`ALTER TABLE child_stewardship.restore_admissions OWNER TO ${reader}`);
   await owner.query(`ALTER FUNCTION child_stewardship.restore_state_roots(uuid) OWNER TO ${reader}`);
   const readRoots=async(prior:string)=>{
    const c=await owner.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL ROLE ${reader}`);await c.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.webauthn_sandbox',$2,true)",[f.id,prior]);
     const roots=(await c.query('SELECT child_stewardship.restore_state_roots($1) AS roots',[f.id])).rows[0].roots;
     assert.equal((await c.query("SELECT current_setting('app.webauthn_sandbox') AS prior")).rows[0].prior,prior);await c.query('COMMIT');return roots;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   };
   try{
    await owner.query("INSERT INTO child_stewardship.restore_verifier_roles VALUES($1,1,true,'disposable-SQL-expiry-fixture-not-cryptographic-attestation',clock_timestamp()+interval '1 hour')",[reader]);
    await owner.query(`GRANT INSERT ON child_stewardship.restore_quarantines,child_stewardship.restore_admissions TO ${reader}`);
    await owner.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${reader}`);
    const roots=await readRoots('');assert.deepEqual(await readRoots(randomUUID()),roots);
    // This is a storage expiry fixture, not a production checkpoint signature.
    // The independent Ed25519/checkpoint backup path has its own native suite.
    const expiry=Date.now()+1200,c=await owner.connect();
    try{
     await c.query('BEGIN');await c.query(`SET LOCAL ROLE ${reader}`);await c.query("SELECT set_config('app.child_session_id',$1,true)",[f.id]);
     const q=(await c.query("INSERT INTO child_stewardship.restore_quarantines(session_id,instance_id,database_oid,anchor_digest,checkpoint_id,checkpoint_sequence) VALUES($1,$2,(SELECT oid FROM pg_database WHERE datname=current_database()),$3,'synthetic-storage-expiry',1) RETURNING sequence",[f.id,randomUUID(),'a'.repeat(64)])).rows[0].sequence;
     await c.query("INSERT INTO child_stewardship.restore_admissions VALUES($1,$2,$3,$3,$4,$5,$6,(SELECT revision FROM child_stewardship.sessions WHERE id=$2),'[\"fixture-a\",\"fixture-b\"]',clock_timestamp(),$7)",[q,f.id,'a'.repeat(64),roots.canonical,roots.security,roots.privacy,new Date(expiry)]);
     await c.query('COMMIT');
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
    assert.ok((await runtime!.pool.query('SELECT child_stewardship_guardian.authorize($1,$2) AS identity',[token,f.id])).rows[0].identity,'positive current SQL admission');
    const blocker=await owner.connect();
    try{
     await blocker.query('BEGIN');await blocker.query('SELECT id FROM child_stewardship_webauthn.sandboxes WHERE id=$1 FOR UPDATE',[f.scope.sandboxId]);
     const pending=runtime!.pool.query('SELECT child_stewardship_guardian.authorize($1,$2) AS identity',[token,f.id]);
     const deadline=Date.now()+700;let waiting=false;
     while(Date.now()<deadline){waiting=(await owner.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock' AND query LIKE '%child_stewardship_guardian.authorize%') AS waiting",[role])).rows[0].waiting;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));}
     assert.equal(waiting,true);await new Promise(resolve=>setTimeout(resolve,Math.max(1,expiry-Date.now()+30)));
     await blocker.query('COMMIT');assert.equal((await pending).rows[0].identity,null,'restore admission expires while sandbox is locked');
    }finally{await blocker.query('ROLLBACK');blocker.release();}

    await f.webauthn.revoke(f.scope,new Date().toISOString());const first=await readRoots('');assert.notEqual(first.security,roots.security);
    await otherService.revoke(otherScope,new Date().toISOString());const second=await readRoots(f.scope.sandboxId);assert.notEqual(second.security,first.security);
   }finally{await owner.query(`REASSIGN OWNED BY ${reader} TO ${originalOwner}`);await owner.query(`DROP OWNED BY ${reader}`);await owner.query(`DROP ROLE ${reader}`);}

  });
  assert.equal(external.mock.calls.length,0);
 }finally{
  if(verifier){await verifier.end();await owner.query('DELETE FROM child_stewardship_webauthn.verifier_roles WHERE database_role=$1',[verifierRole]);await owner.query(`DROP OWNED BY ${verifierRole}`);await owner.query(`DROP ROLE ${verifierRole}`);}
  await runtime?.close();await owner.end();
  process.env.CANOPYPROOF_NATIVE_DATABASE_URL=originalUrl;await admin.query(`DROP DATABASE ${database}`);await admin.end();
 }
});
