import assert from 'node:assert/strict';
import {execFile,spawn} from 'node:child_process';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {mkdtemp,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import pg from 'pg';
import {PostgresChildStore,assertChildRestoreReady,type ChildSqlClient,type ChildSqlConnection} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {ChildRestoreVerifier,type RestoreAnchor,type RestoreRoots,type RestoreCheckpointKey,type SignedRestoreCheckpoint} from '../../services/api/src/domain/child-stewardship/restore-checkpoint.js';
import {ChildPrivacyWorker} from '../../services/api/src/domain/child-stewardship/privacy.js';
import {ChildRightsVerifier} from '../../services/api/src/domain/child-stewardship/verifier-admission.js';
import {createSyntheticLearningState,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {applyRightsOperation} from '../../services/api/src/domain/child-stewardship/rights.js';
import {childDigest,createDemoTokens,stableJson,tokenDigest} from '../../services/api/src/domain/child-stewardship/store.js';
import {createSyntheticRightsFixture} from '../fixtures/child-stewardship-rights.js';
const run=promisify(execFile),clock=()=>new Date().toISOString();
function sql(client:pg.Client):ChildSqlClient{const db:ChildSqlConnection={async query<T extends Record<string,unknown>>(q:string,v:unknown[]=[]):Promise<T[]>{return(await client.query(q,v)).rows as T[];}};return{...db,async transaction<T>(fn:(db:ChildSqlConnection)=>Promise<T>){await client.query('BEGIN');try{const value=await fn(db);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}}};}
const denied=(error:unknown)=>error instanceof Error&&'code'in error&&['42501','23514'].includes(String(error.code));
test('native actual backup/restore quarantine and independently current signed checkpoints',{timeout:120_000},async t=>{
 assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL??'');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
 const suffix=randomUUID().replaceAll('-',''),sourceName=`restore_native_source_${suffix}`,targetName=`restore_native_target_${suffix}`,container=process.env.CANOPYPROOF_NATIVE_POSTGRES_CONTAINER??'canopyproof-child-test-pg';assert.match(container,/^[a-zA-Z0-9_-]+$/);
 const admin=new pg.Client({connectionString:url.toString()});await admin.connect();const directory=await mkdtemp(join(tmpdir(),'canopyproof-restore-anchor-')),anchorPath=join(directory,'current.json');
 const roles=Object.fromEntries(['runtime','privacy','operation','restore','unused'].map(k=>[k,{name:`restore_${k}_${suffix}`,password:randomUUID().replaceAll('-','')}]))as Record<string,{name:string;password:string}>;
 const clients:pg.Client[]=[],pools:pg.Pool[]=[];let source:pg.Client|undefined,target:pg.Client|undefined;
 async function connect(database:string,roleName?:string){const connection=new URL(url);connection.pathname=`/${database}`;if(roleName){connection.username=roles[roleName]!.name;connection.password=roles[roleName]!.password;}const client=new pg.Client({connectionString:connection.toString()});await client.connect();clients.push(client);return client;}
 async function grant(owner:pg.Client,selected=Object.values(roles)){for(const role of selected){await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role.name}`);await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role.name}`);await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role.name}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role.name}`);}}
 async function dump(database:string){return(await run('docker',['exec',container,'pg_dump','-U',decodeURIComponent(url.username),'-Fc','--no-owner','--no-acl','--schema=child_stewardship',database],{encoding:'buffer',maxBuffer:32*1024*1024})).stdout;}
 async function restore(owner:pg.Client,database:string,archive:Buffer){assert.match(database,/^restore_native_(source|target)_[a-f0-9]{32}$/);await owner.query('DROP SCHEMA IF EXISTS child_stewardship CASCADE');await new Promise<void>((resolve,reject)=>{const child=spawn('docker',['exec','-i',container,'pg_restore','-U',decodeURIComponent(url.username),'--no-owner','--no-acl','-d',database],{stdio:['pipe','pipe','pipe']});let error='';child.stderr.on('data',chunk=>{error+=String(chunk);});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`LOCAL_RESTORE_FAILED:${error}`)));child.stdin.end(archive);});await grant(owner,[roles.restore!]);}
 try{
  await admin.query(`CREATE DATABASE ${sourceName}`);await admin.query(`CREATE DATABASE ${targetName}`);
  for(const role of Object.values(roles))await admin.query(`CREATE ROLE ${role.name} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${role.password}'`);
  source=await connect(sourceName);target=await connect(targetName);
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-privacy.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql','child-stewardship-rate-limit.sql','child-stewardship-media.sql','child-stewardship-agent-gateway.sql'])await source.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  await grant(source);
  for(const [key,scopes]of [['runtime',['bootstrap','guardian','child','reviewer','protector','operator']],['operation',['operation-verifier']],['unused',['operator']]]as const)await source.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest($2::text[]),1,true,'local-restore-test',clock_timestamp()+interval '1 hour'",[roles[key]!.name,scopes]);
  await source.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,1,true,'local-restore-test',clock_timestamp()+interval '1 hour')",[roles.privacy!.name]);
  const runtime=await connect(sourceName,'runtime'),privacy=await connect(sourceName,'privacy'),operation=await connect(sourceName,'operation'),verification=await connect(sourceName,'restore');
  const fixture=createSyntheticRightsFixture();fixture.context.now=clock();const session=randomUUID(),tokens=createDemoTokens(session);let learning=createSyntheticLearningState(clock()),commandSequence=0;
  function build(role:string,body:Record<string,unknown>){const command={...body,commandId:`demo-seed-${++commandSequence}`,expectedVersion:learning.version};learning=executeLearningCommand(learning,command,{actorId:`demo-${role}`,deviceId:`demo-device-${role}`,epoch:1},clock()).state;}
  build('guardian',{type:'create-profile',profileId:'demo-profile',ageBand:'9-12',nickname:'leaf',locale:'en'});for(const purpose of ['learning','upload']){build('guardian',{type:'grant-consent',profileId:'demo-profile',purpose,policyVersion:learning.policyVersion});build('child',{type:'set-assent',profileId:'demo-profile',purpose,willing:true});}build('guardian',{type:'assign-task',profileId:'demo-profile',taskId:'demo-task-leaf-comparison'});
  await new PostgresChildStore(sql(runtime)).create({id:session,expiresAt:new Date(Date.now()+3_600_000).toISOString(),snapshot:{version:0,learning,rights:fixture.funded(100),rightsContext:fixture.context}},tokens.records);
  await sql(runtime).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','child',true)",[session]);await db.query("INSERT INTO child_stewardship.privacy_objects VALUES($1,'demo-original-source','demo-profile','upload','source',$2,clock_timestamp()+interval '1 hour',false)",[session,Buffer.from('fixed synthetic restore fixture')]);});
  const currentProvider=async(id:string)=>{const anchor=JSON.parse(await readFile(anchorPath,'utf8')) as RestoreAnchor;if(anchor.sessionId!==id)throw new Error('CURRENT_ANCHOR_UNAVAILABLE');return anchor;};
  async function mutate(store:PostgresChildStore,role:'guardian'|'child',body:Record<string,unknown>){return store.transact(session,clock(),tx=>{const next=executeLearningCommand(tx.snapshot.learning,{...body,commandId:`demo-mutation-${++commandSequence}`,expectedVersion:tx.snapshot.learning.version},{actorId:`demo-${role}`,deviceId:`demo-device-${role}`,epoch:1},tx.executionTime??clock());tx.snapshot.learning=next.state;tx.snapshot.version++;tx.actorId=`demo-${role}`;tx.actorRole=role;tx.operation=String(body.type);return next.result.id;});}
  const exportId=await mutate(new PostgresChildStore(sql(runtime)),'child',{type:'request-privacy',kind:'export_learning',profileId:'demo-profile'});await new ChildPrivacyWorker(sql(privacy)).process(session,exportId);
  const id=randomUUID(),extraTokens=createDemoTokens(id),actorExpiry=Date.now()+3500;
   const extraLearning=structuredClone(learning);extraLearning.actors['demo-child']!.expiresAt=new Date(actorExpiry).toISOString();
   await new PostgresChildStore(sql(runtime)).create({id,expiresAt:new Date(Date.now()+60_000).toISOString(),snapshot:{version:0,learning:extraLearning,rights:fixture.funded(100),rightsContext:fixture.context}},extraTokens.records);
   const expiryRequestId=await new PostgresChildStore(sql(runtime)).transact(id,clock(),tx=>{const request=executeLearningCommand(tx.snapshot.learning,{type:'request-privacy',kind:'export_learning',profileId:'demo-profile',commandId:'demo-expiry-export',expectedVersion:tx.snapshot.learning.version},{actorId:'demo-child',deviceId:'demo-device-child',epoch:1},clock());tx.snapshot.learning=request.state;tx.snapshot.version++;tx.actorRole='child';tx.actorId='demo-child';tx.operation='request-privacy';return request.result.id;});
  const oldSchemaArchive=await dump(sourceName);
  await source.query(await readFile('services/api/prisma/child-stewardship-restore.sql','utf8'));await grant(source);await source.query("INSERT INTO child_stewardship.restore_verifier_roles VALUES($1,1,true,'local-independent-restore-fixture',clock_timestamp()+interval '1 hour')",[roles.restore!.name]);
  const pairs=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];const keys:RestoreCheckpointKey[]=pairs.map((pair,i)=>({keyId:`demo-checkpoint-${i}`,role:i===0?'protection':'trustee',controlDomain:`demo-independent-domain-${i}`,independentOfOperator:true,publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString(),revoked:false,validAfter:'2026-01-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z'}));
  const registry={version:'demo-checkpoint-registry-v1',keys};
  async function roots(owner:pg.Client){return sql(owner).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[session]);return(await db.query<{roots:RestoreRoots}>('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[session]))[0]!.roots;});}
  function signed(root:RestoreRoots,sequence:number,overrides:Partial<SignedRestoreCheckpoint['checkpoint']>={}):SignedRestoreCheckpoint{const checkpoint:SignedRestoreCheckpoint['checkpoint']={protocol:'CanopyProof-RestoreCheckpoint/1',environment:'SIMULATION_ONLY',domainSeparator:'canopyproof:synthetic:restore:v1',checkpointId:`demo-checkpoint-${sequence}`,sequence,sessionId:session,keyRegistryVersion:registry.version,issuedAt:clock(),expiresAt:new Date(Date.now()+600_000).toISOString(),roots:root,...overrides};return{checkpoint,signatures:pairs.map((pair,i)=>({keyId:keys[i]!.keyId,signature:sign(null,Buffer.from(stableJson(checkpoint)),pair.privateKey).toString('base64url')}))};}
  async function publish(envelope:SignedRestoreCheckpoint){const c=envelope.checkpoint,anchor:RestoreAnchor={sessionId:session,checkpointId:c.checkpointId,sequence:c.sequence,digest:childDigest(c),keyRegistryVersion:c.keyRegistryVersion};await writeFile(`${anchorPath}.next`,JSON.stringify(anchor));await rename(`${anchorPath}.next`,anchorPath);}
  const checkpointOne=signed(await roots(source),1);await publish(checkpointOne);const verifier=new ChildRestoreVerifier(sql(verification),currentProvider,registry);
  await t.test('actual independent Ed25519 quorum admits current roots only through a separate restricted login',async()=>{
   assert.equal(await verifier.ready(),true);assert.equal(await new ChildRestoreVerifier(sql(runtime),currentProvider,registry).ready(),false);assert.equal(await verifier.isReadyForAnchor(session),false);
   const pooledUrl=new URL(url);pooledUrl.pathname=`/${sourceName}`;pooledUrl.username=roles.restore!.name;pooledUrl.password=roles.restore!.password;const pool=new pg.Pool({connectionString:pooledUrl.toString(),max:1});pools.push(pool);
   const pooled:ChildSqlClient={async query<T extends Record<string,unknown>>(q:string,v:unknown[]=[]){return(await pool.query(q,v)).rows as T[];},async transaction<T>(fn:(db:ChildSqlConnection)=>Promise<T>){const connection=await pool.connect();try{return await sql(connection).transaction(fn);}finally{connection.release();}}};
   assert.equal((await new ChildRestoreVerifier(pooled,currentProvider,registry).verifyAndAdmit(session,checkpointOne)).verified,true);assert.equal(await verifier.isReadyForAnchor(session),true);
   await assert.rejects(()=>sql(runtime).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[session]);await db.query("INSERT INTO child_stewardship.restore_quarantines(session_id,instance_id,database_oid,anchor_digest,checkpoint_id,checkpoint_sequence) VALUES($1,$2,(SELECT oid FROM pg_database WHERE datname=current_database()),$3,'forged',1)",[session,randomUUID(),'a'.repeat(64)]);}),denied);
  });
  await t.test('privacy export rechecks actor expiry after a slow current checkpoint provider and returns no bytes',async()=>{
   const extraRoots=await sql(source!).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[id]);return(await db.query<{roots:RestoreRoots}>('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[id]))[0]!.roots;});
   const checkpoint=signed(extraRoots,1,{sessionId:id,checkpointId:'demo-actor-expiry-checkpoint'}),c=checkpoint.checkpoint;
   const anchor:RestoreAnchor={sessionId:id,checkpointId:c.checkpointId,sequence:c.sequence,digest:childDigest(c),keyRegistryVersion:c.keyRegistryVersion};
   const provider=async(requested:string)=>{assert.equal(requested,id);return anchor;};
   await new ChildRestoreVerifier(sql(verification),provider,registry).verifyAndAdmit(id,checkpoint);
   await new ChildPrivacyWorker(sql(privacy),3_600_000,provider).process(id,expiryRequestId);
   const principal={actorId:'demo-child',deviceId:'demo-device-child',epoch:1,sessionGeneration:0};
   const before=await new PostgresChildStore(sql(runtime),provider).privacyResult(id,principal,expiryRequestId,clock());assert.equal((before as {kind:string}).kind,'export_learning');
   assert.ok(actorExpiry>Date.now(),'fixture must start while the real actor lifetime remains valid');
   let waited=false;const slow=async(requested:string)=>{await new Promise(resolve=>setTimeout(resolve,Math.max(1,actorExpiry-Date.now()+80)));waited=true;return provider(requested);};
   const facts=await source!.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1',[id]);
   await assert.rejects(()=>new PostgresChildStore(sql(runtime),slow).privacyResult(id,principal,expiryRequestId,clock()),/UNAUTHORIZED/);
   assert.equal(waited,true);assert.ok(Date.parse(c.expiresAt)>Date.now(),'the independent checkpoint itself stays current');
   assert.deepEqual((await source!.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1',[id])).rows,facts.rows);
  });
  await t.test('child privacy pause cannot rewrite identity, unpause, create profiles or alter guardian links through direct SQL',async()=>{
   const profile=(await source!.query("SELECT payload FROM child_stewardship.state_records WHERE session_id=$1 AND collection='profiles'",[session])).rows[0].payload;
   const attempt=async(payload:unknown,actor='demo-child',record='demo-profile',collection='profiles')=>sql(runtime).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','child',true),set_config('app.child_actor_id',$2,true),set_config('app.child_operation','request-privacy',true)",[session,actor]);await db.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision,position) VALUES($1,'learning',$2,$3,$4::jsonb,1,0) ON CONFLICT(session_id,domain,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision",[session,collection,record,JSON.stringify(payload)]);});
   for(const changed of [{...profile,status:'paused',nickname:'acorn'},{...profile,status:'paused',actorId:'demo-other-child'},{...profile,status:'active'}])await assert.rejects(()=>attempt(changed),/CHILD_IDENTITY_ROLE_DENIED/);
   await assert.rejects(()=>attempt({...profile,status:'paused'},'demo-other-child'),/CHILD_IDENTITY_ROLE_DENIED/);await assert.rejects(()=>attempt({...profile,status:'paused'},'demo-child','demo-created-profile'),/CHILD_IDENTITY_ROLE_DENIED/);await assert.rejects(()=>attempt({...profile,status:'paused'},'demo-child','demo-link','guardianLinks'),/CHILD_IDENTITY_ROLE_DENIED/);
  });
  const admittedArchive=await dump(sourceName),sourceOid=(await source.query('SELECT oid FROM pg_database WHERE datname=current_database()')).rows[0].oid;
  const liveStore=new PostgresChildStore(sql(runtime),currentProvider),rightsVerifier=new ChildRightsVerifier(sql(operation),currentProvider);
  const funding=fixture.operation('RECORD_CLEARED_FUNDING',{amountMinor:1,details:{fundingLotId:'funding-after-backup',clearingReceiptRef:'clearing-after-backup'}}),approvals=fixture.approvals(funding,['r1','t']);await rightsVerifier.admit(session,funding,approvals,clock());
  await liveStore.transact(session,clock(),tx=>{tx.snapshot.rights=applyRightsOperation(tx.snapshot.rights,funding,approvals,{...tx.snapshot.rightsContext!,now:tx.executionTime??clock()},tx.rightsRecordedAt?.[funding.operationId]);tx.snapshot.version++;tx.actorRole='operator';tx.actorId='demo-operator';tx.operation=funding.operationType;});
  await mutate(liveStore,'guardian',{type:'revoke-device',actorId:'demo-guardian',deviceId:'demo-device-guardian'});
  const deletion=await mutate(liveStore,'child',{type:'request-privacy',kind:'delete_learning',profileId:'demo-profile'});const pendingRoots=await roots(source),pendingArchive=await dump(sourceName);await new ChildPrivacyWorker(sql(privacy),3_600_000,currentProvider).process(session,deletion);
  const beforeScopeRevocation=await roots(source);
  await source.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'operator',2,false,'local-revocation-after-backup',clock_timestamp()+interval '1 hour')",[roles.unused!.name]);
  const afterScopeRevocation=await roots(source);
  await sql(source).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[session]);await db.query("INSERT INTO child_stewardship.agent_registries(session_id,version,credentials,delegations,expires_at,approval_ref) VALUES($1,1,'{}','{}',clock_timestamp()+interval '1 hour','local-current-registry')",[session]);});
  const currentRoots=await roots(source),checkpointTwo=signed(currentRoots,2);await publish(checkpointTwo);await verifier.verifyAndAdmit(session,checkpointTwo);const currentArchive=await dump(sourceName);
  await t.test('current canonical roots include live obligations, nonce/revocation floors, deletion tombstones and role/agent registry changes',async()=>{
   assert.notEqual(beforeScopeRevocation.security,afterScopeRevocation.security);assert.equal(beforeScopeRevocation.canonical,afterScopeRevocation.canonical);assert.notEqual(afterScopeRevocation.security,currentRoots.security);
   assert.notEqual(currentRoots.canonical,checkpointOne.checkpoint.roots.canonical);assert.notEqual(currentRoots.security,checkpointOne.checkpoint.roots.security);assert.notEqual(currentRoots.privacy,checkpointOne.checkpoint.roots.privacy);
   assert.equal((await source!.query('SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1',[session])).rows[0].n,0);assert.equal((await source!.query('SELECT count(*)::int n FROM child_stewardship.privacy_suppressions WHERE session_id=$1',[session])).rows[0].n,1);
   assert.equal((await source!.query('SELECT count(*)::int n FROM child_stewardship.rights_nonces WHERE session_id=$1',[session])).rows[0].n,5);
  });
  await t.test('same-OID restore of previously admitted old backup cannot reopen with the independently advanced anchor',async()=>{
   await restore(source!,sourceName,admittedArchive);assert.equal((await source!.query('SELECT oid FROM pg_database WHERE datname=current_database()')).rows[0].oid,sourceOid);assert.equal((await currentProvider(session)).sequence,2);
   await assert.rejects(()=>runtime.query('SELECT * FROM child_stewardship.state_records'),denied);
   await verifier.quarantine(session);await grant(source!);
   assert.equal((await source!.query('SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1',[session])).rows[0].n>0,true,'test actually restored deleted bytes');
   await assert.rejects(()=>liveStore.resolveToken(tokenDigest(tokens.publicTokens.child),clock()),/RESTORATION_UNVERIFIED/);await assert.rejects(()=>liveStore.transact(session,clock(),tx=>tx.snapshot),/RESTORATION_UNVERIFIED/);
   await assert.rejects(()=>liveStore.privacyResult(session,{actorId:'demo-child',deviceId:'demo-device-child',epoch:1,sessionGeneration:0},exportId,clock()),/RESTORATION_UNVERIFIED/);
   await assert.rejects(()=>verifier.verifyAndAdmit(session,checkpointTwo),/RESTORE_CANONICAL_STATE_STALE/);assert.equal(await verifier.isReadyForAnchor(session),false);
   await assert.rejects(()=>sql(runtime).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','child',true),set_config('app.child_operation','read',true)",[session]);await db.query("UPDATE child_stewardship.state_records SET payload=payload,revision=revision+1 WHERE session_id=$1 AND collection='meta' AND domain='learning'",[session]);}),/CHILD_RESTORE_QUARANTINED/);
  });
  await t.test('backup predating the restore module cannot disable an externally required restore gate',async()=>{
   await restore(source!,sourceName,oldSchemaArchive);assert.equal(await liveStore.ready(),false);await assert.rejects(()=>assertChildRestoreReady(sql(source!),session,currentProvider),/RESTORATION_UNVERIFIED/);await assert.rejects(()=>runtime.query('SELECT * FROM child_stewardship.state_records'),denied);
  });
  await t.test('actual current backup restored into a different database remains quarantined until fresh exact verification',async()=>{
   await restore(target!,targetName,currentArchive);const targetRuntime=await connect(targetName,'runtime'),targetVerifier=await connect(targetName,'restore'),guard=new ChildRestoreVerifier(sql(targetVerifier),currentProvider,registry),store=new PostgresChildStore(sql(targetRuntime),currentProvider);
   assert.equal(await guard.isReadyForAnchor(session),false);await guard.quarantine(session);await grant(target!);await assert.rejects(()=>store.transact(session,clock(),tx=>tx.snapshot),/RESTORATION_UNVERIFIED/);
   assert.equal((await guard.verifyAndAdmit(session,checkpointTwo)).verified,true);const restored=await store.transact(session,clock(),tx=>tx.snapshot);
   assert.equal(Object.keys(restored.learning.profiles).length,0);assert.equal(restored.rights.consumedNonces.length,5);assert.equal(restored.rights.fundingLots['funding-after-backup']!.clearedAssetsMinor,1);assert.equal(restored.learning.actors['demo-guardian']!.epoch,2);assert.equal(restored.rights.entitlements['entitlement-a']!.amountMinor,100);
   const foreign={...checkpointTwo,checkpoint:{...checkpointTwo.checkpoint,sessionId:randomUUID()}};await assert.rejects(()=>guard.verifyAndAdmit(session,foreign),/RESTORE_CURRENT_ANCHOR_MISMATCH/);assert.equal(await guard.isReadyForAnchor(session),false);
   const forged=structuredClone(checkpointTwo);forged.signatures[0]!.signature='A'.repeat(86);await assert.rejects(()=>guard.verifyAndAdmit(session,forged),/RESTORE_INVALID_SIGNATURE/);assert.equal(await guard.isReadyForAnchor(session),false);
   await guard.verifyAndAdmit(session,checkpointTwo);
  });
  await t.test('current external registry version invalidates old configured keys and expired checkpoints cannot release quarantine',async()=>{
   const targetVerifier=await connect(targetName,'restore'),guard=new ChildRestoreVerifier(sql(targetVerifier),currentProvider,registry);
   const updated=signed(currentRoots,3,{keyRegistryVersion:'demo-checkpoint-registry-v2'});await publish(updated);await assert.rejects(()=>guard.verifyAndAdmit(session,updated),/RESTORE_SIGNER_REGISTRY_CHANGED/);assert.equal(await guard.isReadyForAnchor(session),false);
   const expired=signed(currentRoots,4,{issuedAt:new Date(Date.now()-10_000).toISOString(),expiresAt:new Date(Date.now()-1000).toISOString()});await publish(expired);await assert.rejects(()=>guard.verifyAndAdmit(session,expired),/RESTORE_CHECKPOINT_EXPIRED/);
  });

  await t.test('actual same-OID old pending deletion cannot erase bytes after a newer independent checkpoint records a legal hold',async()=>{
   await restore(target!,targetName,pendingArchive);const targetVerifier=await connect(targetName,'restore'),targetPrivacy=await connect(targetName,'privacy'),guard=new ChildRestoreVerifier(sql(targetVerifier),currentProvider,registry);
   const pendingCheckpoint=signed(pendingRoots,5);await publish(pendingCheckpoint);await guard.verifyAndAdmit(session,pendingCheckpoint);await grant(target!);const admittedPending=await dump(targetName),oid=(await target!.query('SELECT oid FROM pg_database WHERE datname=current_database()')).rows[0].oid;
   await sql(target!).transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[session]);await db.query("INSERT INTO child_stewardship.privacy_legal_holds VALUES($1,'demo-profile','demo-later-hold','demo-independent-retention-authority',clock_timestamp()+interval '1 hour')",[session]);});
   const heldCheckpoint=signed(await roots(target!),6);await publish(heldCheckpoint);await guard.verifyAndAdmit(session,heldCheckpoint);
   await restore(target!,targetName,admittedPending);assert.equal((await target!.query('SELECT oid FROM pg_database WHERE datname=current_database()')).rows[0].oid,oid);await guard.quarantine(session);await grant(target!);
   const count=async()=>{return(await target!.query("SELECT (SELECT count(*)::int FROM child_stewardship.privacy_objects WHERE session_id=$1) objects,(SELECT count(*)::int FROM child_stewardship.privacy_receipts WHERE session_id=$1) receipts,(SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1 AND request_id=$2) state",[session,deletion])).rows[0];};const before=await count();assert.ok(before.objects>0);assert.equal(before.state,'requested');
   assert.equal((await target!.query('SELECT count(*)::int n FROM child_stewardship.privacy_legal_holds WHERE session_id=$1',[session])).rows[0].n,0,'the old backup really predates the hold');
   const worker=new ChildPrivacyWorker(sql(targetPrivacy),3_600_000,currentProvider);await assert.rejects(()=>worker.process(session,deletion),/RESTORATION_UNVERIFIED/);await assert.rejects(()=>worker.expireExports(session),/RESTORATION_UNVERIFIED/);assert.deepEqual(await count(),before);
   await assert.rejects(()=>guard.verifyAndAdmit(session,heldCheckpoint),/RESTORE_CANONICAL_STATE_STALE/);assert.deepEqual(await count(),before);
  });
  await t.test('provider wait across signer expiry rejects instead of trusting the pre-provider clock',async()=>{
   await restore(target!,targetName,currentArchive);const targetVerifier=await connect(targetName,'restore');const expiring=structuredClone(registry);expiring.keys[0]!.expiresAt=new Date(Date.now()+450).toISOString();
   const checkpoint=signed(currentRoots,7);await publish(checkpoint);let calls=0;const delayed=async(id:string)=>{if(++calls===2)await new Promise(resolve=>setTimeout(resolve,700));return currentProvider(id);};const guard=new ChildRestoreVerifier(sql(targetVerifier),delayed,expiring);
   await assert.rejects(()=>guard.verifyAndAdmit(session,checkpoint),/RESTORE_SIGNER_NOT_CURRENT_OR_INDEPENDENT/);assert.equal(await guard.isReadyForAnchor(session),false);
  });
  await t.test('committed rollback closes interactive and cleanup admission despite explicit runtime and worker grants',async()=>{
   await restore(target!,targetName,pendingArchive);const targetVerifier=await connect(targetName,'restore'),targetPrivacy=await connect(targetName,'privacy'),targetRuntime=await connect(targetName,'runtime');const guard=new ChildRestoreVerifier(sql(targetVerifier),currentProvider,registry),checkpoint=signed(pendingRoots,8);await publish(checkpoint);await guard.verifyAndAdmit(session,checkpoint);await grant(target!);
   const count=async()=>{return(await target!.query("SELECT (SELECT count(*)::int FROM child_stewardship.privacy_objects WHERE session_id=$1) objects,(SELECT count(*)::int FROM child_stewardship.privacy_receipts WHERE session_id=$1) receipts,(SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1 AND request_id=$2) state",[session,deletion])).rows[0];};const before=await count();assert.ok(before.objects>0);
   await target!.query(await readFile('services/api/prisma/child-stewardship-restore.rollback.sql','utf8'));
   await assert.rejects(()=>new ChildPrivacyWorker(sql(targetPrivacy),3_600_000,currentProvider).process(session,deletion),/RESTORATION_UNVERIFIED/);await assert.rejects(()=>new PostgresChildStore(sql(targetRuntime),currentProvider).transact(session,clock(),tx=>tx.snapshot),/RESTORATION_UNVERIFIED/);assert.deepEqual(await count(),before);
  });
 }finally{await Promise.all(pools.map(pool=>pool.end()));await Promise.all(clients.map(client=>client.end()));for(const name of [sourceName,targetName])await admin.query(`DROP DATABASE IF EXISTS ${name}`);for(const role of Object.values(roles))await admin.query(`DROP ROLE IF EXISTS ${role.name}`);await admin.end();await rm(directory,{recursive:true,force:true});}
});
