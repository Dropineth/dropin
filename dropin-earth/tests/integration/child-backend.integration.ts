import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import pg from 'pg';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {backendConfig} from '../../services/api/src/child-backend/config.js';
import {backendSql,backendPool} from '../../services/api/src/child-backend/database.js';
import {createChildBackend} from '../../services/api/src/child-backend/app.js';
import {loadChildMigrations,migrateChildBackend,childMigrationReady} from '../../services/api/src/child-backend/migrations.js';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {ChildRestoreVerifier,type RestoreAnchor,type RestoreRoots,type RestoreCheckpointKey,type SignedRestoreCheckpoint} from '../../services/api/src/domain/child-stewardship/restore-checkpoint.js';
import {currentAuthorityClient} from '../../services/api/src/child-backend/current-authority.js';
import {createSyntheticLearningState} from '../../services/api/src/domain/child-stewardship/learning.js';
import {createEmptyRightsState} from '../../services/api/src/domain/child-stewardship/rights.js';
import {createDemoTokens,stableJson,childDigest} from '../../services/api/src/domain/child-stewardship/store.js';

test('backend native migration, direct runtime role, external current anchor and admission boundary',{timeout:60_000},async t=>{
 const admin=nativeChildPool(),original=process.env.CANOPYPROOF_NATIVE_DATABASE_URL!;
 const database=`child_backend_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${database}`);
 const url=new URL(original);url.pathname=`/${database}`;process.env.CANOPYPROOF_NATIVE_DATABASE_URL=url.toString();
 const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;let live:pg.Pool|undefined;let verifier:pg.Pool|undefined;let verifierRole='';
 const migrations=await loadChildMigrations(pathToFileURL(resolve('services/api/prisma')+'/'));
 try{
  // Pre-existing fixed fixture, before installing the strict restore gate. This
  // is not a production enrollment API and is never shipped as a seed command.
  for(const file of ['child-stewardship.sql','child-stewardship-authority.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
  runtime=await scopedNativeChildPool(owner);
  const session=randomUUID(),tokens=createDemoTokens(session),now=new Date().toISOString();
  await new PostgresChildStore(nativeChildSql(runtime.pool)).create({id:session,expiresAt:new Date(Date.now()+3_600_000).toISOString(),snapshot:{version:0,learning:createSyntheticLearningState(now),rights:createEmptyRightsState()}},tokens.records);
  const ownerRole=(await owner.query('SELECT current_user role')).rows[0].role;
  await t.test('migration is atomic, serialized, exactly journaled and replayed without rewriting data',async()=>{
   const results=await Promise.all([migrateChildBackend(owner,migrations,{database,role:ownerRole}),migrateChildBackend(owner,migrations,{database,role:ownerRole})]);
   assert.deepEqual(results.map(r=>r.applied.length).sort((a,b)=>a-b),[0,11]);
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_backend_migrations.entries')).rows[0].n,11);
   const changed=migrations.map(m=>({...m}));changed[0]!.digest='a'.repeat(64);await assert.rejects(migrateChildBackend(owner,changed,{database,role:ownerRole}),/MANIFEST_INVALID/);
   await assert.rejects(migrateChildBackend(owner,migrations,{database,role:'wrong-role'}),/IDENTITY_MISMATCH/);
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.sessions')).rows[0].n,1);
  });
  await t.test('failed final migration leaves neither partial schema nor a successful journal',async()=>{
   const failedDatabase=`child_backend_test_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${failedDatabase}`);
   const target=new URL(url);target.pathname=`/${failedDatabase}`;const failedPool=new pg.Pool({connectionString:target.toString()});
   try{
    const broken=migrations.map(m=>({...m}));broken[broken.length-1]!.sql+='\nSELECT * FROM child_backend_intentionally_missing;';broken[broken.length-1]!.digest=createHash('sha256').update(broken[broken.length-1]!.sql).digest('hex');
    await assert.rejects(migrateChildBackend(failedPool,broken,{database:failedDatabase,role:ownerRole}),/does not exist/);
    assert.equal((await failedPool.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname IN('child_stewardship','child_backend_migrations')")).rows[0].n,0);
   }finally{await failedPool.end();await admin.query(`DROP DATABASE ${failedDatabase} WITH (FORCE)`);}
  });
  const role=(await runtime.pool.query('SELECT current_user role')).rows[0].role;
  await owner.query(`GRANT USAGE ON SCHEMA child_backend_migrations,child_stewardship_webauthn,child_stewardship_guardian TO ${role}`);
  await owner.query(`GRANT SELECT ON child_backend_migrations.entries,child_stewardship_webauthn.verifier_roles TO ${role}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
  const runtimeUrl=new URL(runtime.pool.options.connectionString!);
  const root=generateKeyPairSync('ed25519'),publicKey=root.publicKey.export({type:'spki',format:'pem'}).toString();
  const config=backendConfig({CHILD_BACKEND_MODE:'synthetic-demo',CHILD_DATABASE_URL:runtimeUrl.toString(),CHILD_DATABASE_TLS:'local-test',CHILD_CURRENT_AUTHORITY_URL:'https://authority.synthetic.invalid/current',CHILD_CURRENT_AUTHORITY_PUBLIC_KEY:publicKey});
  live=backendPool(config);const db=backendSql(live);
  const signing=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
  const keys:RestoreCheckpointKey[]=signing.map((key,i)=>({keyId:`test-${i}`,role:i===0?'protection':'trustee',controlDomain:`test-domain-${i}`,independentOfOperator:true,publicKey:key.publicKey.export({type:'spki',format:'pem'}).toString(),revoked:false,validAfter:new Date(Date.now()-60_000).toISOString(),expiresAt:new Date(Date.now()+600_000).toISOString()}));
  const registry={version:'test-v1',keys};let anchor:RestoreAnchor={sessionId:session,checkpointId:'test-checkpoint',sequence:1,digest:'a'.repeat(64),keyRegistryVersion:registry.version};let offline=false;
  const transport:typeof fetch=async(_url,init)=>{
   if(offline)throw new Error('fixture unavailable');const request=JSON.parse(String(init?.body));
   const payload={...request,anchor,registry,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+10_000).toISOString()};
   return Response.json({payload,signature:sign(null,Buffer.from(stableJson(payload)),root.privateKey).toString('base64url')});
  };
  const backend=createChildBackend({config,client:db,migrations,sourceSha:'a'.repeat(40),fetch:transport});
  await t.test('migration owner cannot serve; runtime cannot alter migration history or switch to owner',async()=>{
   assert.equal(await childMigrationReady(db,migrations),true);
   assert.equal(await new PostgresChildStore(nativeChildSql(owner),async()=>anchor).ready(),false);
   await assert.rejects(migrateChildBackend(live!,migrations,{database,role}),/OWNER_REQUIRED/);
   await assert.rejects(db.query("DELETE FROM child_backend_migrations.entries"),/permission denied/);
   await assert.rejects(db.query(`SET ROLE ${ownerRole}`),/permission denied/);
   assert.equal((await backend.app.request('/health/ready')).status,200);
   const r=await backend.app.request('/canopyproof/child-stewardship/v1/view',{headers:{authorization:`Bearer ${tokens.publicTokens.child}`}});assert.equal(r.status,503,'no independently admitted checkpoint');
  });
  await t.test('transaction rollback is not retried; pool resets tenant GUC and enforces database timeouts',async()=>{
   let calls=0;await assert.rejects(db.transaction(async c=>{calls++;await c.query("SELECT set_config('app.child_session_id',$1,false)",[session]);throw new Error('fixture failure');}));assert.equal(calls,1);
   await db.transaction(async c=>{await c.query("SELECT set_config('app.child_session_id',$1,false)",[session]);});
   const state=await db.query<{scope:string;timeout:string}>("SELECT current_setting('app.child_session_id',true) scope,current_setting('statement_timeout') timeout");assert.ok(!state[0]!.scope);assert.equal(state[0]!.timeout,'5s');
   assert.equal((await db.query('SELECT * FROM child_stewardship.sessions')).length,0,'RLS has no ambient tenant');
  });
  verifierRole=`backend_restore_${randomUUID().replaceAll('-','')}`;const password=randomUUID();
  await owner.query(`CREATE ROLE ${verifierRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT PASSWORD '${password}'`);
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship,child_stewardship_webauthn TO ${verifierRole}`);
  await owner.query(`GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA child_stewardship TO ${verifierRole}`);
  await owner.query(`GRANT UPDATE ON child_stewardship.sessions TO ${verifierRole}`);
  await owner.query(`GRANT SELECT ON child_stewardship_webauthn.verifier_roles TO ${verifierRole}`);
  await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${verifierRole}`);
  await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${verifierRole}`);
  await owner.query("INSERT INTO child_stewardship.restore_verifier_roles VALUES($1,1,true,'synthetic-native-test',clock_timestamp()+interval '1 hour')",[verifierRole]);
  const verifierUrl=new URL(url);verifierUrl.username=verifierRole;verifierUrl.password=password;verifier=new pg.Pool({connectionString:verifierUrl.toString()});
  await t.test('actual signed external read plus distinct verifier admits current state; changed floor or outage closes existing sessions',async()=>{
   const roots=await nativeChildSql(owner).transaction(async c=>{await c.query("SELECT set_config('app.child_session_id',$1,true)",[session]);return (await c.query<{roots:RestoreRoots}>('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[session]))[0]!.roots;});
   const checkpoint:SignedRestoreCheckpoint['checkpoint']={protocol:'CanopyProof-RestoreCheckpoint/1',environment:'SIMULATION_ONLY',domainSeparator:'canopyproof:synthetic:restore:v1',checkpointId:anchor.checkpointId,sequence:1,sessionId:session,keyRegistryVersion:registry.version,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString(),roots};
   anchor={...anchor,digest:childDigest(checkpoint)};
   const read=currentAuthorityClient({url:config.authorityUrl!,publicKey,audience:config.authorityAudience,fetch:transport});
   const check=new ChildRestoreVerifier(nativeChildSql(verifier!),async id=>(await read(id)).anchor,registry);
   const signed={checkpoint,signatures:signing.map((key,i)=>({keyId:keys[i]!.keyId,signature:sign(null,Buffer.from(stableJson(checkpoint)),key.privateKey).toString('base64url')}))};
   await check.verifyAndAdmit(session,signed);
   const view=()=>backend.app.request('/canopyproof/child-stewardship/v1/view',{headers:{authorization:`Bearer ${tokens.publicTokens.child}`}});
   assert.equal((await view()).status,200,'positive actual SQL + Ed25519 + HTTP control');
   offline=true;assert.equal((await view()).status,503);offline=false;
   anchor={...anchor,sequence:2};assert.equal((await view()).status,503,'external floor advanced: old restored/admitted state denied');
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.restore_admissions')).rows[0].n,1);
   backend.stop();assert.equal((await backend.app.request('/health/ready')).status,503);
  });
 }finally{
  await live?.end();await verifier?.end();await runtime?.close();
  if(verifierRole){await owner.query(`DROP OWNED BY ${verifierRole}`);await owner.query(`DROP ROLE ${verifierRole}`);}
  await owner.end();process.env.CANOPYPROOF_NATIVE_DATABASE_URL=original;await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);await admin.end();
 }
});
