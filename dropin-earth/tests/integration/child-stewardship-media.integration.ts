import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import sharp from 'sharp';
import {PostgresChildStore,type ChildSqlClient,type ChildSqlConnection} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {createSyntheticLearningState,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {SyntheticChildMediaService} from '../../services/api/src/domain/child-stewardship/media.js';
import {ChildPrivacyWorker} from '../../services/api/src/domain/child-stewardship/privacy.js';
import {createSyntheticRightsFixture} from '../fixtures/child-stewardship-rights.js';
import type {LearningPrincipal} from '../../services/api/src/domain/child-stewardship/learning-types.js';
function sql(client:pg.Client):ChildSqlClient{const connection:ChildSqlConnection={async query<T extends Record<string,unknown>>(q:string,v:unknown[]=[]):Promise<T[]>{return(await client.query(q,v)).rows as T[];}};return{...connection,async transaction<T>(run:(db:ChildSqlConnection)=>Promise<T>){await client.query('BEGIN');try{const value=await run(connection);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}}};}
const denied=(error:unknown)=>error instanceof Error&&'code'in error&&['42501','23514'].includes(String(error.code));
const principal=(role:string):LearningPrincipal=>({actorId:`demo-${role}`,deviceId:`demo-device-${role}`,epoch:1,sessionGeneration:0});

test('native fixed synthetic media: sanitization, quarantine, independent role review and deletion',{timeout:120_000},async t=>{
 assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL??'');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
 const suffix=randomUUID().replaceAll('-',''),name=`media_native_${suffix}`,roles={runtime:`mr_${suffix}`,ingest:`mi_${suffix}`,reviewer:`mv_${suffix}`,privacy:`mp_${suffix}`};const admin=new pg.Client({connectionString:url.toString()});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);url.pathname=`/${name}`;const owner=new pg.Client({connectionString:url.toString()});await owner.connect();const clients:pg.Client[]=[];
 try{
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-privacy.sql','child-stewardship-resume.sql','child-stewardship-media.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  const connections={}as Record<keyof typeof roles,pg.Client>;
  for(const key of Object.keys(roles)as(keyof typeof roles)[]){const role=roles[key],password=randomUUID().replaceAll('-','');await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
   if(key==='runtime')await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest(ARRAY['bootstrap','guardian','child','reviewer','protector','operator']),1,true,'local-media-native',clock_timestamp()+interval '1 hour'",[role]);
   else if(key==='privacy')await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,1,true,'local-media-native',clock_timestamp()+interval '1 hour')",[role]);
   else await owner.query("INSERT INTO child_stewardship.media_roles VALUES($1,$2,1,true,'local-media-native',clock_timestamp()+interval '1 hour')",[role,key]);
   const scopedUrl=new URL(url);scopedUrl.username=role;scopedUrl.password=password;const client=new pg.Client({connectionString:scopedUrl.toString()});await client.connect();clients.push(client);connections[key]=client;
  }
  const service=new SyntheticChildMediaService(sql(connections.ingest),sql(connections.reviewer)),store=new PostgresChildStore(sql(connections.runtime));
  async function seed(conflict=false,expiry?:'reviewer'|'task'){const at=new Date(Date.now()-1000).toISOString();let learning=createSyntheticLearningState(at);let sequence=0;function command(role:string,body:Record<string,unknown>){learning=executeLearningCommand(learning,{...body,commandId:`demo-command-${++sequence}`,expectedVersion:learning.version},principal(role),new Date().toISOString()).state;}
   command('guardian',{type:'create-profile',profileId:'demo-profile',ageBand:'9-12',nickname:'leaf',locale:'en'});for(const purpose of ['learning','upload']){command('guardian',{type:'grant-consent',profileId:'demo-profile',purpose,policyVersion:learning.policyVersion});command('child',{type:'set-assent',profileId:'demo-profile',purpose,willing:true});}command('guardian',{type:'assign-task',profileId:'demo-profile',taskId:'demo-task-leaf-comparison'});
   if(conflict)learning.actors['demo-reviewer']!.controlDomain=learning.actors['demo-guardian']!.controlDomain;
   if(expiry==='reviewer')learning.actors['demo-reviewer']!.expiresAt=new Date(Date.now()+1600).toISOString();
   if(expiry==='task')learning.tasks['demo-task-leaf-comparison']!.closesAt=new Date(Date.now()+1600).toISOString();
   const fixture=createSyntheticRightsFixture(),session=randomUUID();await store.create({id:session,expiresAt:new Date(Date.now()+86_400_000).toISOString(),snapshot:{version:0,learning,rights:fixture.funded(100),rightsContext:fixture.context}},[]);return{session,assignment:Object.keys(learning.assignments)[0]!,learning};}
  async function scoped<T>(key:keyof typeof connections,session:string,actor:LearningPrincipal,run:()=>Promise<T>){const client=connections[key];return sql(client).transaction(async()=>{await client.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_id',$2,true),set_config('app.child_device_id',$3,true),set_config('app.child_actor_epoch',$4,true),set_config('app.child_session_generation',$5,true)",[session,actor.actorId,actor.deviceId,String(actor.epoch),String(actor.sessionGeneration??0)]);return run();});}
  await t.test('actual restricted logins cannot reset or switch into reviewer/owner privileges and readiness rejects unsafe clients',async()=>{
   assert.equal(await service.ready(),true);assert.equal(await new SyntheticChildMediaService(sql(owner),sql(owner)).ready(),false);assert.equal(await new SyntheticChildMediaService(sql(connections.ingest),sql(connections.ingest)).ready(),false);
   await connections.ingest.query('RESET ROLE');assert.deepEqual((await connections.ingest.query('SELECT current_user,session_user')).rows[0],{current_user:roles.ingest,session_user:roles.ingest});
   const ownerRole=(await owner.query('SELECT current_user')).rows[0].current_user;assert.match(ownerRole,/^[a-zA-Z_][a-zA-Z0-9_]*$/);
   await assert.rejects(()=>connections.ingest.query(`SET ROLE ${roles.reviewer}`),denied);await assert.rejects(()=>connections.ingest.query(`SET ROLE ${ownerRole}`),denied);
   await owner.query(`GRANT ${roles.reviewer} TO ${roles.ingest}`);assert.equal(await service.ready(),false);await owner.query(`REVOKE ${roles.reviewer} FROM ${roles.ingest}`);assert.equal(await service.ready(),true);
  });
  const x=await seed();let id='',digest='';
  await t.test('actual bytes are cleaned and quarantined; family cannot read before separate synthetic review',async()=>{
   const received=await service.ingestFixture(x.session,principal('child'),x.assignment,'demo-media-oriented-jpeg',new Date().toISOString());id=received.mediaId;digest=received.sanitizedDigest;assert.equal(received.status,'quarantined');assert.equal(received.evidenceLevel,'E0');
   await assert.rejects(()=>service.readSanitized(x.session,principal('guardian'),id,new Date().toISOString()),/MEDIA_QUARANTINED/);
   const preview=await service.readSanitized(x.session,principal('reviewer'),id,new Date().toISOString(),true),metadata=await sharp(preview.bytes).metadata();assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(metadata.orientation,undefined);assert.equal(metadata.width,48);assert.equal(metadata.height,64);
   const count=await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1',[x.session]);assert.equal(count.rows[0].n,3);
   const raw=await scoped('reviewer',x.session,principal('reviewer'),()=>connections.reviewer.query("SELECT content FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='source'",[x.session]));assert.equal(raw.rowCount,0);
  });
  await t.test('review binds exact sanitized digest and separate actor/control domain; rejected media stays private',async()=>{
   await assert.rejects(()=>service.review(x.session,principal('reviewer'),id,'f'.repeat(64),'accepted',new Date().toISOString()),denied);
   await assert.rejects(()=>service.review(x.session,principal('guardian'),id,digest,'accepted',new Date().toISOString()),/FORBIDDEN/);
   const invalid=await scoped('reviewer',x.session,principal('guardian'),()=>connections.reviewer.query("SELECT content FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='derived'",[x.session]));assert.equal(invalid.rowCount,0);
   const reviewed=await service.review(x.session,principal('reviewer'),id,digest,'accepted',new Date().toISOString());assert.equal(reviewed.reviewKind,'synthetic_role_separation');assert.equal((await service.readSanitized(x.session,principal('child'),id,new Date().toISOString())).contentType,'image/png');
   const conflict=await seed(true),bad=await service.ingestFixture(conflict.session,principal('child'),conflict.assignment,'demo-media-pattern-png',new Date().toISOString());await assert.rejects(()=>service.review(conflict.session,principal('reviewer'),bad.mediaId,bad.sanitizedDigest,'accepted',new Date().toISOString()),denied);
   const rejected=await service.ingestFixture(x.session,principal('child'),x.assignment,'demo-media-pattern-png',new Date().toISOString());await service.review(x.session,principal('reviewer'),rejected.mediaId,rejected.sanitizedDigest,'rejected',new Date().toISOString());await assert.rejects(()=>service.readSanitized(x.session,principal('child'),rejected.mediaId,new Date().toISOString()),/MEDIA_QUARANTINED/);
  });
  await t.test('exact/pixel replay index and heuristic flags never mint evidence grade, contributions or rights',async()=>{
   const duplicate=await service.ingestFixture(x.session,principal('child'),x.assignment,'demo-media-oriented-jpeg',new Date().toISOString());assert.ok(duplicate.duplicateFlags.includes('exact_repeat'));assert.equal(duplicate.evidenceLevel,'E0');
   assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.media_canonical_keys WHERE session_id=$1 AND kind='exact'",[x.session])).rows[0].n,2);
   assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.state_records WHERE session_id=$1 AND domain='learning' AND collection IN ('observations','contributions')",[x.session])).rows[0].n,0);
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.rights_nonces WHERE session_id=$1',[x.session])).rows[0].n,4);
  });
  await t.test('non-allowlisted fixture and matching forged derived/index manifests are rejected without writes',async()=>{
   await assert.rejects(()=>service.ingestFixture(x.session,principal('child'),x.assignment,'user-photo' as 'demo-media-pattern-png',new Date().toISOString()),/SYNTHETIC_MEDIA_NOT_ALLOWLISTED/);
   await assert.rejects(()=>scoped('ingest',x.session,principal('child'),()=>connections.ingest.query("UPDATE child_stewardship.media_fixture_allowlist SET raw_digest=$1",['b'.repeat(64)])),denied);
   await assert.rejects(()=>scoped('ingest',x.session,principal('child'),()=>connections.ingest.query("INSERT INTO child_stewardship.media_fixture_allowlist SELECT 'arbitrary-user-photo',$1,sanitized_digest,pixel_digest,index_digest,width,height,perceptual_hashes FROM child_stewardship.media_fixture_allowlist LIMIT 1",['b'.repeat(64)])),denied);
   for(const field of ['sanitized_digest','index_digest','pixel_digest']){
    const forged=`demo-media-${randomUUID()}`;
    await assert.rejects(()=>scoped('ingest',x.session,principal('child'),()=>connections.ingest.query(`INSERT INTO child_stewardship.media_assets SELECT(jsonb_populate_record(NULL::child_stewardship.media_assets,to_jsonb(a)||jsonb_build_object('media_id',$3::text,'raw_object_id',$3::text||':source','sanitized_object_id',$3::text||':derived','index_object_id',$3::text||':index','status','quarantined','${field}',$4::text))).* FROM child_stewardship.media_assets a WHERE session_id=$1 AND media_id=$2`,[x.session,id,forged,'c'.repeat(64)])),(error:unknown)=>error instanceof Error&&error.message==='CHILD_MEDIA_INGRESS_DENIED');
   }
  });
  await t.test('stale session generation rejects read, review and ingest after suspension and resumption',async()=>{
   const y=await seed(),item=await service.ingestFixture(y.session,principal('child'),y.assignment,'demo-media-pattern-png',new Date().toISOString());
   await owner.query("INSERT INTO child_stewardship.session_resumption VALUES($1,1,'suspended')",[y.session]);
   await assert.rejects(()=>service.readSanitized(y.session,principal('reviewer'),item.mediaId,new Date().toISOString(),true),/UNAUTHORIZED/);
   await owner.query("UPDATE child_stewardship.session_resumption SET state='active' WHERE session_id=$1",[y.session]);
   await assert.rejects(()=>service.review(y.session,principal('reviewer'),item.mediaId,item.sanitizedDigest,'accepted',new Date().toISOString()),/UNAUTHORIZED/);
   await assert.rejects(()=>service.ingestFixture(y.session,principal('child'),y.assignment,'demo-media-pattern-png',new Date().toISOString()),/UNAUTHORIZED/);
  });
  await t.test('direct SQL waits on the session lock and rechecks actor, role and task expiry after waiting',async()=>{
   for(const scenario of ['reviewer','task','role']as const){
    const y=await seed(false,scenario==='role'?undefined:scenario),item=await service.ingestFixture(y.session,principal('child'),y.assignment,'demo-media-pattern-png',new Date().toISOString());
    if(scenario==='role')await owner.query("INSERT INTO child_stewardship.media_roles VALUES($1,'reviewer',2,true,'local-expiry-regression',clock_timestamp()+interval '1600 milliseconds')",[roles.reviewer]);
    const key=scenario==='task'?'ingest':'reviewer',client=connections[key],actor=principal(scenario==='task'?'child':'reviewer'),pid=(await client.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await owner.query('BEGIN');await owner.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[y.session]);
    const write=scoped(key,y.session,actor,()=>scenario==='task'?client.query(`INSERT INTO child_stewardship.media_assets SELECT(jsonb_populate_record(NULL::child_stewardship.media_assets,to_jsonb(a)||jsonb_build_object('media_id',$3::text,'raw_object_id',$3::text||':source','sanitized_object_id',$3::text||':derived','index_object_id',$3::text||':index'))).* FROM child_stewardship.media_assets a WHERE session_id=$1 AND media_id=$2`,[y.session,item.mediaId,`demo-media-${randomUUID()}`]):client.query('INSERT INTO child_stewardship.media_reviews(session_id,media_id,reviewer_id,reviewer_domain,sanitized_digest,decision) VALUES($1,$2,$3,$4,$5,$6)',[y.session,item.mediaId,actor.actorId,y.learning.actors[actor.actorId]!.controlDomain,item.sanitizedDigest,'accepted']));
    const rejected=assert.rejects(write,(error:unknown)=>error instanceof Error&&error.message===(scenario==='task'?'CHILD_MEDIA_INGRESS_DENIED':'CHILD_MEDIA_REVIEW_SCOPE'));
    try{
     let blocked=false;for(let attempt=0;attempt<100;attempt++){const activity=await admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[pid]);if(activity.rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(blocked,true,'direct SQL must wait behind session lock');
     await new Promise(resolve=>setTimeout(resolve,1700));
    }finally{await owner.query('COMMIT');}await rejected;
    assert.equal((await owner.query('SELECT status FROM child_stewardship.media_assets WHERE session_id=$1 AND media_id=$2',[y.session,item.mediaId])).rows[0].status,'quarantined');
    const unreadable=await scoped(key,y.session,actor,()=>client.query("SELECT content FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='derived'",[y.session]));assert.equal(unreadable.rowCount,0);
    if(scenario==='role')await owner.query("INSERT INTO child_stewardship.media_roles VALUES($1,'reviewer',3,true,'local-expiry-restored',clock_timestamp()+interval '1 hour')",[roles.reviewer]);
   }
  });
  await t.test('privacy erasure removes actual source, sanitized and index copies plus child links without erasing rights',async()=>{
   const request=await store.transact(x.session,new Date().toISOString(),tx=>{const transition=executeLearningCommand(tx.snapshot.learning,{type:'request-privacy',kind:'delete_learning',profileId:'demo-profile',commandId:'demo-media-erasure',expectedVersion:tx.snapshot.learning.version},principal('guardian'),new Date().toISOString());tx.snapshot.learning=transition.state;tx.snapshot.version++;tx.actorId='demo-guardian';tx.actorRole='guardian';tx.operation='request-privacy';return transition.result.id;});
   await assert.rejects(()=>service.readSanitized(x.session,principal('guardian'),id,new Date().toISOString()),/MEDIA_AUTHORITY_REVOKED|PRIVACY_SUPPRESSED/);
   await assert.rejects(()=>service.ingestFixture(x.session,principal('child'),x.assignment,'demo-media-pattern-png',new Date().toISOString()),/MEDIA_AUTHORITY_REVOKED/);
   assert.deepEqual(await new ChildPrivacyWorker(sql(connections.privacy)).process(x.session,request),{state:'completed'});
   for(const table of ['privacy_objects','media_assets'])assert.equal((await owner.query(`SELECT count(*)::int n FROM child_stewardship.${table} WHERE session_id=$1`,[x.session])).rows[0].n,0);
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.entitlement_balances WHERE session_id=$1',[x.session])).rows[0].n,1);
   assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.media_canonical_keys WHERE session_id=$1 AND kind='exact'",[x.session])).rows[0].n,2);
  });
 }finally{await Promise.all(clients.map(c=>c.end()));await owner.end();await admin.query(`DROP DATABASE ${name}`);for(const role of Object.values(roles))await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();}
});
