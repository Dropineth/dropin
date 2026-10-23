import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {ChildPrivacyWorker} from '../../services/api/src/domain/child-stewardship/privacy.js';
import {PostgresChildAgentGateway} from '../../services/api/src/domain/child-stewardship/agent-gateway-store.js';
import {createChildAgentGatewayRoutes} from '../../services/api/src/routes/child-stewardship/agent-gateway.js';
import {CHILD_AGENT_PROTOCOL,canonicalChildAgentEnvelope,type ChildAgentEnvelope,type ChildAgentDelegation} from '../../services/api/src/domain/child-stewardship/agent-gateway.js';
import {createSyntheticLearningState,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {createEmptyRightsState} from '../../services/api/src/domain/child-stewardship/rights.js';
import {childDigest,createDemoTokens,tokenDigest} from '../../services/api/src/domain/child-stewardship/store.js';

test('native signed static agent gateway: dedicated verifier, atomic replay protection and current ancestry',{timeout:120_000},async t=>{
 const admin=nativeChildPool(),database=`agent_test_${randomUUID().replaceAll('-','')}`,role=`agent_v_${randomUUID().replaceAll('-','')}`,password=randomBytes(32).toString('hex');
 await admin.query(`CREATE DATABASE ${database}`);const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);url.pathname=`/${database}`;
 const owner=new pg.Pool({connectionString:url.toString(),max:6});let runtime:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined,verification:pg.Pool|undefined;
 try{
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql','child-stewardship-privacy.sql','child-stewardship-agent-gateway.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  // This helper reads the explicit disposable URL; constrain the override to
  // constructing the fixture pool and restore it before any test action.
  const previous=process.env.CANOPYPROOF_NATIVE_DATABASE_URL;process.env.CANOPYPROOF_NATIVE_DATABASE_URL=url.toString();
  try{runtime=await scopedNativeChildPool(owner);}finally{process.env.CANOPYPROOF_NATIVE_DATABASE_URL=previous;}
  await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
  await owner.query("INSERT INTO child_stewardship.agent_verifier_roles VALUES($1,1,true,clock_timestamp()+interval '1 hour','local-native-gateway')",[role]);
  const verifierUrl=new URL(url);verifierUrl.username=role;verifierUrl.password=password;verification=new pg.Pool({connectionString:verifierUrl.toString(),max:6});
  const store=new PostgresChildStore(nativeChildSql(runtime.pool)),gateway=new PostgresChildAgentGateway(nativeChildSql(verification)),app=createChildAgentGatewayRoutes({mode:'synthetic-demo',gateway});
  const external=t.mock.method(globalThis,'fetch',async()=>{throw new Error('external model/provider request forbidden');});
  async function fixture(){
   const now=new Date().toISOString();let learning=createSyntheticLearningState(now),sequence=0;
   function command(actor:'guardian'|'child',fields:Record<string,unknown>){learning=executeLearningCommand(learning,{...fields,commandId:`demo-seed-${++sequence}`,expectedVersion:learning.version},{actorId:`demo-${actor}`,deviceId:`demo-device-${actor}`,epoch:1},new Date().toISOString()).state;}
   command('guardian',{type:'create-profile',profileId:'demo-profile',ageBand:'9-12',locale:'en',nickname:'leaf'});command('guardian',{type:'grant-consent',profileId:'demo-profile',purpose:'learning',policyVersion:learning.policyVersion});command('child',{type:'set-assent',profileId:'demo-profile',purpose:'learning',willing:true});
   const id=randomUUID(),tokens=createDemoTokens(id),keys=generateKeyPairSync('ed25519');
   await store.create({id,expiresAt:new Date(Date.now()+3600000).toISOString(),snapshot:{version:0,learning,rights:createEmptyRightsState()}},tokens.records);
   const credential={keyId:'demo-key',actorId:'demo-child',epoch:1,publicKey:keys.publicKey.export({format:'pem',type:'spki'}).toString(),revoked:false,expiresAt:new Date(Date.now()+3600000).toISOString()};
   let version=0;
   async function publish(delegations:Record<string,ChildAgentDelegation>={},revoked=false,credentialExpiry=credential.expiresAt){await owner.query('INSERT INTO child_stewardship.agent_registries(session_id,version,credentials,delegations,expires_at,approval_ref) VALUES($1,$2,$3::jsonb,$4::jsonb,clock_timestamp()+interval \'1 hour\',\'local-governed-fixture\')',[id,++version,JSON.stringify({'demo-key':{...credential,revoked,expiresAt:credentialExpiry}}),JSON.stringify(delegations)]);}
   await publish();
   function signed(overrides:Partial<ChildAgentEnvelope>={}){
    const envelope:ChildAgentEnvelope={protocol:CHILD_AGENT_PROTOCOL,environment:'synthetic-demo',eventId:`demo-${randomUUID()}`,verb:'REASON',actorId:'demo-child',deviceId:'demo-device-child',epoch:1,taskId:'demo-task-leaf-comparison',consentVersion:learning.consents['demo-profile:learning']!.version,evidenceIds:[],delegationId:null,policyVersion:learning.policyVersion,issuedAt:new Date(Date.now()-100).toISOString(),expiresAt:new Date(Date.now()+120000).toISOString(),nonce:`demo-${randomUUID()}`,question:'what_is_unknown',...overrides};
    const bytes=canonicalChildAgentEnvelope(envelope);return{envelope,approval:{keyId:'demo-key',algorithm:'Ed25519' as const,signature:sign(null,bytes,keys.privateKey).toString('base64url'),signedPayload:Buffer.from(bytes).toString('base64url')}};
   }
   async function post(body:unknown,token=tokens.publicTokens.child){const response=await app.request('/agent/answer',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};}
   async function mutate(actor:'guardian'|'child',fields:Record<string,unknown>,proof?:string){return store.transact(id,new Date().toISOString(),tx=>{const body={commandId:`demo-${randomUUID()}`,expectedVersion:tx.snapshot.learning.version,...fields};const result=executeLearningCommand(tx.snapshot.learning,body,{actorId:`demo-${actor}`,deviceId:`demo-device-${actor}`,epoch:1},new Date().toISOString());tx.snapshot.learning=result.state;learning=result.state;tx.snapshot.version++;tx.actorRole=actor;tx.actorId=`demo-${actor}`;tx.operation=String(fields.type);if(proof)tx.draftAuthorization={proof,actorId:`demo-${actor}`,command:body};return result.result;});}
   async function observe(){
    await mutate('guardian',{type:'grant-consent',profileId:'demo-profile',purpose:'upload',policyVersion:learning.policyVersion});await mutate('child',{type:'set-assent',profileId:'demo-profile',purpose:'upload',willing:true});const assignment=await mutate('child',{type:'assign-task',profileId:'demo-profile',taskId:'demo-task-leaf-comparison'});
    const draftId=randomUUID(),body={commandId:`demo-${draftId}`,expectedVersion:learning.version,type:'submit-observation',assignmentId:assignment.id,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:new Date().toISOString()};
    const proof=await store.issueDraftAuthorization(tokens.publicTokens.child,{draftId,intentDigest:childDigest(body),assignmentId:assignment.id,originalSessionId:id,originalConsentEpoch:learning.consents['demo-profile:upload']!.version,purpose:'synthetic-learning-upload',schemaVersion:'CanopyProof-SyntheticDraft/2',policyVersion:learning.policyVersion,expectedVersion:learning.version});
    return mutate('child',body,proof);
   }
   return{id,tokens,learning,publish,signed,post,mutate,observe};
  }
  const counts=async(id:string)=>({admissions:(await owner.query('SELECT count(*)::int n FROM child_stewardship.agent_admissions WHERE session_id=$1',[id])).rows[0].n,outputs:(await owner.query('SELECT count(*)::int n FROM child_stewardship.agent_outputs WHERE session_id=$1',[id])).rows[0].n,audit:(await owner.query('SELECT count(*)::int n FROM child_stewardship.agent_audit WHERE session_id=$1',[id])).rows[0].n});
  await t.test('actual Ed25519 Hono request persists one bounded static output, admission and audit; concurrent replay has one winner',async()=>{
   assert.equal(await gateway.ready(),true);assert.equal(await new PostgresChildAgentGateway(nativeChildSql(owner)).ready(),false);assert.equal(await new PostgresChildAgentGateway(nativeChildSql(runtime!.pool)).ready(),false);
   const f=await fixture(),body=f.signed(),results=await Promise.all([f.post(body),f.post(body),f.post(body)]);
   assert.deepEqual(results.map(r=>r.status).sort(),[200,403,403]);assert.deepEqual(await counts(f.id),{admissions:1,outputs:1,audit:1});
   const output=results.find(r=>r.status===200)!.body.data;assert.equal(output.syntheticOnly,true);assert.equal(output.finalAuthority,false);assert.equal(output.source,'approved-static-learning-v1');assert.equal('consumeNonce'in output,false);assert.equal('registryVersion'in output,false);assert.equal('signature'in output,false);
   assert.equal(external.mock.calls.length,0);
  });
  await t.test('valid foreign environment bytes, forged signature, wrong bearer and unknown fields cause zero admission effects',async()=>{
   const f=await fixture();
   for(const body of [f.signed({environment:'production' as 'synthetic-demo'}),{...f.signed(),rawPrompt:'forbidden'},(()=>{const body=f.signed();body.approval.signature=Buffer.alloc(64).toString('base64url');return body;})()])assert.notEqual((await f.post(body)).status,200);
   assert.equal((await f.post(f.signed(),f.tokens.publicTokens.guardian)).status,401);
   assert.equal((await f.post(f.signed(),tokenDigest(f.tokens.publicTokens.child))).status,401);
   assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});assert.equal(external.mock.calls.length,0);
  });
  await t.test('current key and delegation ancestor revocation reject real signatures without output or nonce effects',async()=>{
   const f=await fixture();const expiry=new Date(Date.now()+120000).toISOString();
   const parent:ChildAgentDelegation={id:'demo-parent',parentId:null,issuerActorId:'demo-guardian',delegateActorId:'demo-child',verbs:['REASON'],taskIds:['demo-task-leaf-comparison'],expiresAt:expiry,revoked:false,epoch:1,allowRedelegation:true};
   const child:ChildAgentDelegation={...parent,id:'demo-delegate',parentId:parent.id,issuerActorId:'demo-child',allowRedelegation:false};
   await f.publish({[parent.id]:parent,[child.id]:child});const body=f.signed({delegationId:child.id});
   await f.publish({[parent.id]:{...parent,revoked:true},[child.id]:child});assert.equal((await f.post(body)).body.error.code,'DELEGATION_REVOKED');
   await f.publish({},true);assert.equal((await f.post(f.signed())).body.error.code,'SIGNER_REVOKED');assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});
   await f.publish({},false,'not-a-date');assert.equal((await f.post(f.signed())).body.error.code,'SIGNER_REVOKED');assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});
  });
  await t.test('withdrawn learning consent and current actor revocation reject an otherwise valid signature',async()=>{
   for(const action of ['withdraw-consent','revoke-device']){
    const f=await fixture(),body=f.signed();await store.transact(f.id,new Date().toISOString(),tx=>{const actor=action==='withdraw-consent'?'guardian':'protector';const fields=action==='withdraw-consent'?{type:action,profileId:'demo-profile',purpose:'learning'}:{type:action,actorId:'demo-child',deviceId:'demo-device-child'};const result=executeLearningCommand(tx.snapshot.learning,{...fields,commandId:`demo-${randomUUID()}`,expectedVersion:tx.snapshot.learning.version},{actorId:`demo-${actor}`,deviceId:`demo-device-${actor}`,epoch:1},new Date().toISOString());tx.snapshot.learning=result.state;tx.snapshot.version++;tx.actorRole=actor;tx.actorId=`demo-${actor}`;tx.operation=action;});
    assert.equal((await f.post(body)).status,action==='revoke-device'?401:403);assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});
   }
  });
  await t.test('queued request expiring behind the actual session lock is rejected after the wait',async()=>{
   const f=await fixture(),body=f.signed({expiresAt:new Date(Date.now()+500).toISOString()}),blocker=await owner.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[f.id]);
   const pending=f.post(body);try{let locked=false;for(let i=0;i<100;i++){if((await owner.query("SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",[role])).rows.length){locked=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}assert.equal(locked,true);await new Promise(resolve=>setTimeout(resolve,550));}finally{await blocker.query('ROLLBACK');blocker.release();}
   assert.equal((await pending).body.error.code,'ENVELOPE_EXPIRED');assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});
  });
  await t.test('output failure rolls back nonce and admission so a valid identical retry succeeds',async()=>{
   const f=await fixture(),body=f.signed();let fail=true;const broken=new PostgresChildAgentGateway(nativeChildSql(verification!,sql=>{if(fail&&sql.startsWith('INSERT INTO child_stewardship.agent_outputs')){fail=false;throw new Error('injected output failure');}}));
   await assert.rejects(broken.answer(f.tokens.publicTokens.child,body.envelope,body.approval),/injected/);assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});assert.equal((await f.post(body)).status,200);assert.deepEqual(await counts(f.id),{admissions:1,outputs:1,audit:1});
  });
  await t.test('real gateway evidence response leaves no copied evidence in durable receipts after privacy deletion',async()=>{
   const f=await fixture(),observation=await f.observe(),body=f.signed({question:'last_record',evidenceIds:[observation.id]});
   const response=await f.post(body);assert.equal(response.status,200);assert.equal(response.body.data.evidence[0].id,observation.id);
   const stored=(await owner.query('SELECT output FROM child_stewardship.agent_outputs WHERE session_id=$1',[f.id])).rows[0].output;
   assert.deepEqual(Object.keys(stored).sort(),['finalAuthority','outputDigest','schema','source','syntheticOnly']);assert.equal(JSON.stringify(stored).includes(observation.id),false);assert.equal(JSON.stringify(stored).includes('observedAtClaimed'),false);
   const request=await f.mutate('guardian',{type:'request-privacy',profileId:'demo-profile',kind:'delete_learning'}),workerRole=`agent_privacy_${randomUUID().replaceAll('-','')}`,workerPassword=randomBytes(32).toString('hex');let workerPool:pg.Pool|undefined;
   try{
    await owner.query(`CREATE ROLE ${workerRole} LOGIN PASSWORD '${workerPassword}' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${workerRole}`);await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${workerRole}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${workerRole}`);await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,1,true,'disposable-agent-privacy-test',clock_timestamp()+interval '1 hour')",[workerRole]);
    const connection=new URL(url);connection.username=workerRole;connection.password=workerPassword;workerPool=new pg.Pool({connectionString:connection.toString()});
    const worker=new ChildPrivacyWorker(nativeChildSql(workerPool));assert.deepEqual(await worker.process(f.id,request.id),{state:'completed'});
    assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.id])).rows[0].n,0);
    for(const table of ['agent_admissions','agent_outputs','agent_audit']){const records=(await owner.query(`SELECT row_to_json(t) record FROM child_stewardship.${table} t WHERE session_id=$1`,[f.id])).rows;assert.equal(JSON.stringify(records).includes(observation.id),false);assert.equal(JSON.stringify(records).includes('demo-leaf-green'),false);}
    assert.deepEqual(await counts(f.id),{admissions:1,outputs:1,audit:1});assert.notEqual((await f.post(f.signed())).status,200);
   }finally{await workerPool?.end();await owner.query(`DROP OWNED BY ${workerRole}`).catch(()=>{});await owner.query(`DROP ROLE IF EXISTS ${workerRole}`);}
  });
  await t.test('ordinary direct SQL cannot forge receipts, publish keys, mutate accepted output or inspect another tenant',async()=>{
   const f=await fixture(),foreign=await fixture(),body=f.signed();assert.equal((await f.post(body)).status,200);
   const scoped=<T>(run:(db:ReturnType<typeof nativeChildSql>)=>Promise<T>)=>{const db=nativeChildSql(runtime!.pool);return db.transaction(async connection=>{await connection.query("SELECT set_config('app.child_session_id',$1,true)",[f.id]);return run({...db,query:connection.query});});};
   await assert.rejects(scoped(db=>db.query("INSERT INTO child_stewardship.agent_admissions SELECT session_id,'demo-forged',actor_id,'demo-forged',registry_version,session_generation,state_revision,envelope_digest,signature_digest,output_digest,expires_at,pg_current_xact_id()::text,clock_timestamp() FROM child_stewardship.agent_admissions WHERE session_id=$1",[f.id])),/VERIFIER_REQUIRED/);
   await assert.rejects(scoped(db=>db.query("UPDATE child_stewardship.agent_outputs SET output='{}'::jsonb WHERE session_id=$1",[f.id])),/IMMUTABLE/);
   await assert.rejects(scoped(db=>db.query("INSERT INTO child_stewardship.agent_registries SELECT session_id,version+1,credentials,delegations,expires_at,'forged' FROM child_stewardship.agent_registries WHERE session_id=$1",[f.id])),/OWNER_APPEND_ONLY/);
   assert.equal((await scoped(db=>db.query('SELECT * FROM child_stewardship.agent_registries WHERE session_id=$1',[foreign.id]))).length,0);
   const ownerRole=(await owner.query('SELECT current_user')).rows[0].current_user;assert.match(ownerRole,/^[a-zA-Z0-9_]+$/);
   await assert.rejects(verification!.query(`SET ROLE ${ownerRole}`),/permission denied/);
   await owner.query(`GRANT ${ownerRole} TO ${role}`);try{assert.equal(await gateway.ready(),false);}finally{await owner.query(`REVOKE ${ownerRole} FROM ${role}`);}
  });
  await t.test('durable actor-specific gateway quota counts failed signatures and isolates other actors and tenants',async()=>{
   const f=await fixture(),other=await fixture();
   const invalid=f.signed();invalid.approval.signature=Buffer.alloc(64).toString('base64url');
   // Different native connections share the committed counter. Invalid business
   // requests consume capacity but never admit a nonce/output/audit record.
   const results=await Promise.all(Array.from({length:120},()=>f.post(invalid)));
   assert.ok(results.every(result=>result.status===403));
   const limited=await f.post(f.signed());assert.equal(limited.status,429);assert.equal(limited.body.error.code,'RATE_LIMITED');
   assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});
   assert.equal((await other.post(other.signed())).status,200);
   const guardian=await verification!.query("SELECT child_stewardship.consume_child_capability_limit('agent_request',$1) status",[f.tokens.publicTokens.guardian]);assert.equal(guardian.rows[0].status,'allowed');
   assert.equal((await runtime!.pool.query("SELECT child_stewardship.consume_child_capability_limit('agent_request',$1) status",[f.tokens.publicTokens.child])).rows[0].status,'unavailable');
   assert.equal((await verification!.query("SELECT child_stewardship.consume_child_capability_limit('agent_request',$1) status",[tokenDigest(f.tokens.publicTokens.child)])).rows[0].status,'unauthorized');
   const counters=(await owner.query("SELECT bucket_id,consumed FROM child_stewardship.api_rate_limits WHERE kind='agent_request' AND bucket_id LIKE $1",[`${f.id}:%`])).rows;assert.equal(counters.length,2);assert.deepEqual(counters.map(row=>row.consumed).sort((a:number,b:number)=>a-b),[1,120]);
   assert.equal(JSON.stringify(counters).includes(f.tokens.publicTokens.child),false);
  });
  await t.test('unconfigured/real router is unavailable and SQL rollback pauses explicitly granted verifier without erasing history',async()=>{
   const f=await fixture();assert.equal((await f.post(f.signed())).status,200);
   const disabled=createChildAgentGatewayRoutes({mode:'real',gateway});assert.equal((await disabled.request('/agent/answer',{method:'POST'})).status,503);
   const absent=createChildAgentGatewayRoutes({mode:'synthetic-demo',gateway:null});assert.equal((await (await absent.request('/agent/status')).json()).data.connected,false);
   await owner.query(await readFile('services/api/prisma/child-stewardship-agent-gateway.rollback.sql','utf8'));assert.equal(await gateway.ready(),false);assert.equal((await f.post(f.signed())).status,503);assert.deepEqual(await counts(f.id),{admissions:1,outputs:1,audit:1});assert.equal(external.mock.calls.length,0);
  });
  await t.test('installing the real restore module quarantines the signed gateway without a fresh admission',async()=>{
   await owner.query(await readFile('services/api/prisma/child-stewardship-agent-gateway.sql','utf8'));
   const f=await fixture(),body=f.signed();
   await owner.query(await readFile('services/api/prisma/child-stewardship-restore.sql','utf8'));
   await owner.query(`GRANT SELECT ON child_stewardship.restore_verifier_roles TO ${role}`);
   await owner.query(`GRANT EXECUTE ON FUNCTION child_stewardship.restore_execution_permitted(uuid),child_stewardship.restore_anchor_current(uuid,text,bigint,text) TO ${role}`);
   assert.equal(await gateway.ready(),false,'missing outside-backup startup anchor fails closed');
   const response=await f.post(body);assert.equal(response.status,503);
   const currentAnchor=new PostgresChildAgentGateway(nativeChildSql(verification!),async()=>({checkpointId:'unadmitted-checkpoint',sequence:1,digest:'a'.repeat(64)}));
   await assert.rejects(currentAnchor.answer(f.tokens.publicTokens.child,body.envelope,body.approval),/RESTORATION_UNVERIFIED/);
   assert.deepEqual(await counts(f.id),{admissions:0,outputs:0,audit:0});assert.equal(external.mock.calls.length,0);
  });
 }finally{await verification?.end();await runtime?.close();await owner.query(`DROP OWNED BY ${role}`).catch(()=>{});await owner.end();await admin.query(`DROP DATABASE ${database}`);await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();}
});
