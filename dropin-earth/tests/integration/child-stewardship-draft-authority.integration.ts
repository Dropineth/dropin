import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {PostgresChildStore,type ChildSqlClient,type ChildSqlConnection} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {PostgresChildResumeStore} from '../../services/api/src/domain/child-stewardship/resume-store.js';
import {createSyntheticLearningState,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {createEmptyRightsState} from '../../services/api/src/domain/child-stewardship/rights.js';
import {createDemoTokens,childDigest,tokenDigest} from '../../services/api/src/domain/child-stewardship/store.js';
import type {LearningPrincipal} from '../../services/api/src/domain/child-stewardship/learning-types.js';
function sql(client:pg.Client):ChildSqlClient{const connection:ChildSqlConnection={async query<T extends Record<string,unknown>>(q:string,v:unknown[]=[]):Promise<T[]>{return(await client.query(q,v)).rows as T[];}};return{...connection,async transaction<T>(run:(db:ChildSqlConnection)=>Promise<T>){await client.query('BEGIN');try{const value=await run(connection);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}}};}
const denied=(error:unknown)=>error instanceof Error&&'code'in error&&['42501','23514'].includes(String(error.code));
const principal=(role:string,generation=0):LearningPrincipal=>({actorId:`demo-${role}`,deviceId:`demo-device-${role}`,epoch:1,sessionGeneration:generation});
test('native draft capability authority: metadata-only, exact digest, current generation and atomic single use',{timeout:120_000},async t=>{
 assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL??'');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
 const suffix=randomUUID().replaceAll('-',''),name=`draft_native_${suffix}`,role=`du_${suffix}`,password=randomUUID().replaceAll('-','');const admin=new pg.Client({connectionString:url.toString()});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);url.pathname=`/${name}`;const owner=new pg.Client({connectionString:url.toString()});await owner.connect();let runtime:pg.Client|undefined;
 try{
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-rate-limit.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
  await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest(ARRAY['bootstrap','guardian','child','reviewer','protector','operator']),1,true,'local-draft-native',clock_timestamp()+interval '1 hour'",[role]);
  const local=new URL(url);local.username=role;local.password=password;runtime=new pg.Client({connectionString:local.toString()});await runtime.connect();const client=runtime,db=sql(client),store=new PostgresChildStore(db),resume=new PostgresChildResumeStore(db);
  async function seed(expireActor=false,resumed=true){let learning=createSyntheticLearningState(new Date(Date.now()-1000).toISOString());let seq=0;function command(roleName:string,body:Record<string,unknown>){learning=executeLearningCommand(learning,{...body,commandId:`demo-seed-${++seq}`,expectedVersion:learning.version},principal(roleName),new Date().toISOString()).state;}
   command('guardian',{type:'create-profile',profileId:'demo-profile',ageBand:'9-12',nickname:'leaf',locale:'en'});for(const purpose of ['learning','upload']){command('guardian',{type:'grant-consent',profileId:'demo-profile',purpose,policyVersion:learning.policyVersion});command('child',{type:'set-assent',profileId:'demo-profile',purpose,willing:true});}command('guardian',{type:'assign-task',profileId:'demo-profile',taskId:'demo-task-leaf-comparison'});
   if(expireActor)learning.actors['demo-child']!.expiresAt=new Date(Date.now()+1600).toISOString();
   const session=randomUUID(),tokens=createDemoTokens(session);await store.create({id:session,expiresAt:new Date(Date.now()+86_400_000).toISOString(),snapshot:{version:0,learning,rights:createEmptyRightsState()}},tokens.records);
   if(!resumed)return{session,learning,original:tokens.publicTokens,token:tokens.publicTokens.child,assignment:Object.keys(learning.assignments)[0]!};
   const ticket=await resume.suspend(tokens.publicTokens.child),fresh=await resume.resume(ticket.resumeTicket);return{session,learning,original:tokens.publicTokens,token:fresh.tokens.child,assignment:Object.keys(learning.assignments)[0]!};}
  function proposal(f:Awaited<ReturnType<typeof seed>>){const draftId=randomUUID(),command={type:'submit-observation',commandId:`demo-${draftId}`,expectedVersion:f.learning.version,assignmentId:f.assignment,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:new Date().toISOString()};return{command,proposal:{draftId,intentDigest:childDigest(command),assignmentId:f.assignment,originalSessionId:f.session,originalConsentEpoch:f.learning.consents['demo-profile:upload']!.version,purpose:'synthetic-learning-upload',schemaVersion:'CanopyProof-SyntheticDraft/2',policyVersion:f.learning.policyVersion,expectedVersion:f.learning.version}};}
  const issue=async(token:string,p:unknown)=>(await client.query('SELECT child_stewardship.issue_draft_authorization($1,$2::jsonb) proof',[token,JSON.stringify(p)])).rows[0].proof as string|null;
  async function scope<T>(session:string,run:()=>Promise<T>){return db.transaction(async()=>{await client.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_id','demo-child',true),set_config('app.child_actor_role','child',true),set_config('app.child_operation','submit-observation',true)",[session]);await client.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[session]);return run();});}
  const consume=async(proof:string,session:string,command:unknown)=>(await client.query("SELECT child_stewardship.consume_draft_authorization($1,$2::uuid,'demo-child',$3::jsonb) accepted",[proof,session,JSON.stringify(command)])).rows[0].accepted as boolean;
  async function commit(f:Awaited<ReturnType<typeof seed>>,proof:string,command:unknown){return store.transact(f.session,new Date().toISOString(),tx=>{const result=executeLearningCommand(tx.snapshot.learning,command,principal('child',1),new Date().toISOString());tx.snapshot.learning=result.state;tx.snapshot.version++;tx.actorRole='child';tx.actorId='demo-child';tx.operation='submit-observation';tx.draftAuthorization={proof,actorId:'demo-child',command};tx.receipts.push({key:String((command as Record<string,unknown>).commandId),digest:childDigest({path:'/commands',body:command}),actorId:'demo-child',result:result.result,version:tx.snapshot.version});f.learning=result.state;return result.result;});}
  const count=async(session:string,table='draft_authorization_uses')=>(await owner.query(`SELECT count(*)::int n FROM child_stewardship.${table} WHERE session_id=$1`,[session])).rows[0].n as number;
  await t.test('metadata-only issuance and exact canonical command digest yield one real persisted E0 observation',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);assert.match(proof!,/^cp-upload\.[A-Za-z0-9_-]{43}$/);
   const stored=(await owner.query('SELECT proposal,proof_hash FROM child_stewardship.draft_authorizations WHERE session_id=$1',[f.session])).rows[0];assert.equal('command'in stored.proposal,false);assert.equal('sampleId'in stored.proposal,false);assert.equal(stored.proof_hash,tokenDigest(proof!));
   const accepted=await commit(f,proof!,p.command);assert.equal(accepted.status,'received_pending_review');assert.equal(await count(f.session),1);
   assert.equal(await scope(f.session,()=>consume(proof!,f.session,p.command)),true);assert.equal(await count(f.session),1);
  });
  await t.test('generation zero also requires fresh authorization; later review cannot rewrite admitted answer/source',async()=>{
   const f=await seed(false,false),p=proposal(f),next=executeLearningCommand(f.learning,p.command,principal('child'),new Date().toISOString()),record=next.state.observations[next.result.id]!;
   await assert.rejects(()=>scope(f.session,()=>client.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,'learning','observations',$2,$3::jsonb,1)",[f.session,record.id,JSON.stringify(record)])),/CHILD_FRESH_DRAFT_AUTHORIZATION_REQUIRED/);
   const proof=await issue(f.token,p.proposal);await commit(f,proof!,p.command);
   await store.transact(f.session,new Date().toISOString(),tx=>{const review=executeLearningCommand(tx.snapshot.learning,{type:'review-observation',commandId:'demo-review-admitted',expectedVersion:tx.snapshot.learning.version,observationId:record.id,decision:'learning_observation_accepted',reason:'synthetic_source'},principal('reviewer'),new Date().toISOString());tx.snapshot.learning=review.state;tx.snapshot.version++;tx.actorRole='reviewer';tx.actorId='demo-reviewer';tx.operation='review-observation';});
   const stored=(await owner.query("SELECT payload FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.session])).rows[0].payload;assert.equal(stored.state,'accepted_for_learning');assert.equal(stored.answer,'green');
   await assert.rejects(()=>scope(f.session,()=>client.query("UPDATE child_stewardship.state_records SET payload=jsonb_set(payload,'{answer}','\"yellow\"'),revision=3 WHERE session_id=$1 AND collection='observations'",[f.session])),/CHILD_OBSERVATION_CONTENT_IMMUTABLE/);
   const use=(await owner.query('SELECT to_jsonb(u) record FROM child_stewardship.draft_authorization_uses u WHERE session_id=$1',[f.session])).rows[0].record;assert.equal('command'in use,false);assert.equal('answer'in use,false);assert.equal(use.command_digest,childDigest(p.command));
  });
  await t.test('exact durable receipt replay still requires a current proof; fresh proof can acknowledge the old command without rewriting observation',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);await commit(f,proof!,p.command);
   const before=await owner.query("SELECT payload,revision,xmin::text tx FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.session]);
   const fresh=await issue(f.token,{...p.proposal,expectedVersion:f.learning.version});assert.ok(fresh);assert.equal(await scope(f.session,()=>consume(fresh,f.session,p.command)),true);assert.equal(await count(f.session),2);
   assert.deepEqual((await owner.query("SELECT payload,revision,xmin::text tx FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.session])).rows,before.rows);
   assert.equal((await owner.query("SELECT outcome FROM child_stewardship.draft_authorization_uses WHERE proof_hash=$1",[tokenDigest(fresh)])).rows[0].outcome,'receipt');
   assert.equal(await scope(f.session,()=>consume(fresh,f.session,{...p.command,answer:'yellow'})),false);assert.equal(await scope(f.session,()=>consume('',f.session,p.command)),false);
   const ticket=await resume.suspend(f.token),resumed=await resume.resume(ticket.resumeTicket);assert.equal(await scope(f.session,()=>consume(proof!,f.session,p.command)),false);assert.equal(await scope(f.session,()=>consume(fresh,f.session,p.command)),false);
   const restored=await issue(resumed.tokens.child,{...p.proposal,expectedVersion:f.learning.version});assert.ok(restored);assert.equal(await scope(f.session,()=>consume(restored,f.session,p.command)),true);assert.equal(await count(f.session),3);
  });
  await t.test('known token hashes, forged direct grants/uses and immutable grant rewrites cannot mint authority',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);assert.equal(await issue(tokenDigest(f.token),p.proposal),null);assert.equal(await issue(f.token,{...p.proposal,command:p.command}),null);
   await assert.rejects(()=>scope(f.session,()=>client.query("INSERT INTO child_stewardship.draft_authorizations SELECT $2,session_id,actor_id,device_id,actor_epoch,generation,proposal,issued_at,expires_at FROM child_stewardship.draft_authorizations WHERE session_id=$1",[f.session,'a'.repeat(64)])),denied);
   await assert.rejects(()=>scope(f.session,()=>client.query("INSERT INTO child_stewardship.draft_authorization_uses VALUES($1,$2,'demo-child',$3,$4,6,'observation',$4,pg_current_xact_id()::text,clock_timestamp())",[tokenDigest(proof!),f.session,p.command.commandId,childDigest(p.command)])),denied);
   for(const statement of ['UPDATE child_stewardship.draft_authorizations SET expires_at=expires_at+interval \'1 day\' WHERE session_id=$1','DELETE FROM child_stewardship.draft_authorizations WHERE session_id=$1'])await assert.rejects(()=>scope(f.session,()=>client.query(statement,[f.session])),denied);
   assert.equal(await scope(f.session,()=>consume(`cp-upload.${tokenDigest(proof!).slice(0,43)}`,f.session,p.command)),false);assert.equal(await count(f.session),0);
  });
  await t.test('changed command, actor/tenant, extra fields and stale versions leave admission and observations unchanged',async()=>{
   const f=await seed(),other=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);const initial=(await owner.query("SELECT count(*)::int n FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.session])).rows[0].n;
   for(const changed of [{...p.command,answer:'yellow'},{...p.command,sampleId:'demo-leaf-yellow'},{...p.command,expectedVersion:0},{...p.command,commandId:'demo-altered'},{...p.command,rawImage:'private'},{...p.command,capturedAtClaimed:'2026-99-99T00:00:00Z'}])assert.equal(await scope(f.session,()=>consume(proof!,f.session,changed)),false);
   assert.equal(await scope(other.session,()=>consume(proof!,other.session,p.command)),false);assert.equal(await issue(f.token,{...p.proposal,originalSessionId:other.session}),null);assert.equal(await issue(f.token,{...p.proposal,expectedVersion:0}),null);
   assert.equal(await count(f.session),0);assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.state_records WHERE session_id=$1 AND collection='observations'",[f.session])).rows[0].n,initial);await commit(f,proof!,p.command);
  });
  await t.test('consumption without an observation and changed admitted observation roll back, allowing exact retry',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);
   await assert.rejects(()=>scope(f.session,async()=>{assert.equal(await consume(proof!,f.session,p.command),true);}),/CHILD_DRAFT_OBSERVATION_REQUIRED/);assert.equal(await count(f.session),0);
   const next=executeLearningCommand(f.learning,p.command,principal('child',1),new Date().toISOString()),record=next.state.observations[next.result.id]!;
   await assert.rejects(()=>scope(f.session,()=>client.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,'learning','observations',$2,$3::jsonb,1)",[f.session,record.id,JSON.stringify(record)])),/CHILD_FRESH_DRAFT_AUTHORIZATION_REQUIRED/);
   await assert.rejects(()=>scope(f.session,async()=>{assert.equal(await consume(proof!,f.session,p.command),true);await client.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,'learning','observations',$2,$3::jsonb,1)",[f.session,record.id,JSON.stringify({...record,answer:'yellow'})]);}),/CHILD_DRAFT_COMMAND_MISMATCH/);assert.equal(await count(f.session),0);await commit(f,proof!,p.command);
  });
  await t.test('suspend/resume invalidates an old grant and original bearer even when learning consent is unchanged',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal),ticket=await resume.suspend(f.token),fresh=await resume.resume(ticket.resumeTicket);
   assert.equal(await issue(f.token,p.proposal),null);assert.equal(await issue(f.original.child,p.proposal),null);assert.equal(await scope(f.session,()=>consume(proof!,f.session,p.command)),false);
   const replacement=await issue(fresh.tokens.child,p.proposal);assert.match(replacement!,/^cp-upload\./);assert.notEqual(replacement,proof);
  });
  await t.test('withdrawal and a new assent epoch cannot revive an already issued draft grant',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);let sequence=0;
   async function mutate(roleName:'guardian'|'child',body:Record<string,unknown>){await store.transact(f.session,new Date().toISOString(),tx=>{const next=executeLearningCommand(tx.snapshot.learning,{...body,commandId:`demo-withdraw-${++sequence}`,expectedVersion:tx.snapshot.learning.version},principal(roleName,1),new Date().toISOString());tx.snapshot.learning=next.state;tx.snapshot.version++;tx.actorRole=roleName;tx.actorId=`demo-${roleName}`;tx.operation=String(body.type);f.learning=next.state;});}
   await mutate('guardian',{type:'withdraw-consent',profileId:'demo-profile',purpose:'upload'});assert.equal(await scope(f.session,()=>consume(proof!,f.session,p.command)),false);
   await mutate('guardian',{type:'grant-consent',profileId:'demo-profile',purpose:'upload',policyVersion:f.learning.policyVersion});await mutate('child',{type:'set-assent',profileId:'demo-profile',purpose:'upload',willing:true});assert.equal(await scope(f.session,()=>consume(proof!,f.session,p.command)),false);assert.equal(await issue(f.token,{...p.proposal,expectedVersion:f.learning.version}),null);assert.equal(await count(f.session),0);
  });
  await t.test('rollback denies new issuance and an existing unconsumed proof despite explicit runtime grants',async()=>{
   const f=await seed(),p=proposal(f),proof=await issue(f.token,p.proposal);assert.ok(proof);
   const rollback=(await readFile('services/api/prisma/child-stewardship-draft-authorization.rollback.sql','utf8')).replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
   await owner.query(rollback);
   assert.equal(await issue(f.token,p.proposal),null);assert.equal(await scope(f.session,()=>consume(proof,f.session,p.command)),false);assert.equal(await count(f.session),0);
   // Reapply the forward migration to the same disposable database, preserving
   // immutable pending grants and explicit runtime permissions throughout.
   await owner.query(await readFile('services/api/prisma/child-stewardship-draft-authorization.sql','utf8'));
   await commit(f,proof,p.command);
  });
  await t.test('raw-bearer issuance waits on the session lock and rejects an actor expired during the wait',async()=>{
   const f=await seed(true),p=proposal(f),pid=(await client.query('SELECT pg_backend_pid() pid')).rows[0].pid;await owner.query('BEGIN');await owner.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[f.session]);
   const pending=issue(f.token,p.proposal);try{let blocked=false;for(let i=0;i<100;i++){if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(blocked,true);await new Promise(resolve=>setTimeout(resolve,1700));}finally{await owner.query('COMMIT');}assert.equal(await pending,null);assert.equal(await count(f.session,'draft_authorizations'),0);
  });
 }finally{await runtime?.end();await owner.end();await admin.query(`DROP DATABASE ${name}`);await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();}
});
