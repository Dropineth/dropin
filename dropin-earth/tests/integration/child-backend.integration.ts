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
import {PostgresChildStore,assertChildRestoreReady,type ChildSqlClient} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {PostgresChildResumeStore} from '../../services/api/src/domain/child-stewardship/resume-store.js';
import {closeNativeChildPool} from '../fixtures/child-stewardship-pool-close.js';
import {ChildRestoreVerifier,type RestoreAnchor,type RestoreRoots,type RestoreCheckpointKey,type SignedRestoreCheckpoint} from '../../services/api/src/domain/child-stewardship/restore-checkpoint.js';
import {syntheticCurrentAuthorityProvider} from '../../integrations/cai/synthetic-current-authority.js';
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
   assert.deepEqual(results.map(r=>r.applied.length).sort((a,b)=>a-b),[0,12]);
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_backend_migrations.entries')).rows[0].n,12);
   const changed=migrations.map(m=>({...m}));changed[0]!.digest='a'.repeat(64);await assert.rejects(migrateChildBackend(owner,changed,{database,role:ownerRole}),/MANIFEST_INVALID/);
   await assert.rejects(migrateChildBackend(owner,migrations,{database,role:'wrong-role'}),/IDENTITY_MISMATCH/);
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.sessions')).rows[0].n,1);
  });
  await t.test('managed-style migration owner needs neither superuser, BYPASSRLS, role creation nor database creation',async()=>{
   const ownerLogin=`backend_owner_${randomUUID().replaceAll('-','')}`,ownerPassword=randomUUID();
   const ownedDatabase=`child_backend_test_${randomUUID().replaceAll('-','')}`;
   await admin.query(`CREATE ROLE ${ownerLogin} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${ownerPassword}'`);
   await admin.query(`CREATE DATABASE ${ownedDatabase} OWNER ${ownerLogin}`);
   const target=new URL(url);target.pathname=`/${ownedDatabase}`;target.username=ownerLogin;target.password=ownerPassword;
   const limitedOwner=new pg.Pool({connectionString:target.toString()});
   try{
    const privileges=(await limitedOwner.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(Object.values(privileges),[false,false,false,false]);
    assert.equal((await migrateChildBackend(limitedOwner,migrations,{database:ownedDatabase,role:ownerLogin})).applied.length,12);
    assert.equal((await migrateChildBackend(limitedOwner,migrations,{database:ownedDatabase,role:ownerLogin})).unchanged.length,12);
    assert.equal(await new PostgresChildStore(nativeChildSql(limitedOwner),async()=>({checkpointId:'not-an-admission',sequence:1,digest:'a'.repeat(64)})).ready(),false);
   }finally{await closeNativeChildPool(limitedOwner);await admin.query(`DROP DATABASE ${ownedDatabase} WITH (FORCE)`);await admin.query(`DROP ROLE ${ownerLogin}`);}
  });
  await t.test('failed final migration leaves neither partial schema nor a successful journal',async()=>{
   const failedDatabase=`child_backend_test_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${failedDatabase}`);
   const target=new URL(url);target.pathname=`/${failedDatabase}`;const failedPool=new pg.Pool({connectionString:target.toString()});
   try{
    const broken=migrations.map(m=>({...m}));broken[broken.length-1]!.sql+='\nSELECT * FROM child_backend_intentionally_missing;';broken[broken.length-1]!.digest=createHash('sha256').update(broken[broken.length-1]!.sql).digest('hex');
    await assert.rejects(migrateChildBackend(failedPool,broken,{database:failedDatabase,role:ownerRole}),/does not exist/);
    assert.equal((await failedPool.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname IN('child_stewardship','child_backend_migrations')")).rows[0].n,0);
   }finally{await closeNativeChildPool(failedPool);await admin.query(`DROP DATABASE ${failedDatabase} WITH (FORCE)`);}
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
  keys.push({...keys[1]!,keyId:'test-alternative',controlDomain:'test-alternative-domain',publicKey:generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString()});
  const registry={version:'test-v1',keys};let anchor:RestoreAnchor={sessionId:session,checkpointId:'test-checkpoint',sequence:1,digest:'a'.repeat(64),keyRegistryVersion:registry.version};let offline=false;
  const provider=syntheticCurrentAuthorityProvider({environment:'SIMULATION_ONLY',audience:config.authorityAudience,privateKey:root.privateKey,
   snapshot:id=>id===session?{anchor,registry}:null});
  // Explicit local transport injection; the production HTTPS configuration stays unchanged.
  const transport:typeof fetch=async(_url,init)=>{
   if(offline)throw new Error('fixture unavailable');
   return provider.handle(new Request('http://127.0.0.1/current',init));
  };
  let revokeAfterWrite=false;
  const instrumented:ChildSqlClient={query:db.query,transaction:run=>db.transaction(connection=>run({query:async<T extends Record<string,unknown>>(sql:string,values?:unknown[]):Promise<T[]>=>{
   const result=await connection.query<T>(sql,values);
   if(revokeAfterWrite&&sql.startsWith('INSERT INTO child_stewardship.audit')){revokeAfterWrite=false;keys[1]!.revoked=true;}
   return result;
  }}))};
  const backend=createChildBackend({config,client:instrumented,migrations,sourceSha:'a'.repeat(40),fetch:transport});
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
  await t.test('restore cannot count the same signing key twice under distinct role and control-domain labels',async()=>{
   const roots=await nativeChildSql(owner).transaction(async c=>{await c.query("SELECT set_config('app.child_session_id',$1,true)",[session]);return (await c.query<{roots:RestoreRoots}>('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[session]))[0]!.roots;});
   const checkpoint:SignedRestoreCheckpoint['checkpoint']={protocol:'CanopyProof-RestoreCheckpoint/1',environment:'SIMULATION_ONLY',domainSeparator:'canopyproof:synthetic:restore:v1',checkpointId:anchor.checkpointId,sequence:1,sessionId:session,keyRegistryVersion:registry.version,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString(),roots};
   anchor={...anchor,digest:childDigest(checkpoint)};
   const before=(await owner.query('SELECT revision FROM child_stewardship.sessions WHERE id=$1',[session])).rows;
   for(const alias of [keys[0]!.publicKey,keys[0]!.publicKey.replaceAll('\n','\r\n')]){
    const duplicated={version:registry.version,keys:[keys[0]!,{...keys[1]!,publicKey:alias}]};
    const check=new ChildRestoreVerifier(nativeChildSql(verifier!),async()=>anchor,duplicated);
    const signed={checkpoint,signatures:duplicated.keys.map(key=>({keyId:key.keyId,signature:sign(null,Buffer.from(stableJson(checkpoint)),signing[0]!.privateKey).toString('base64url')}))};
    await assert.rejects(check.verifyAndAdmit(session,signed),/RESTORE_SIGNER_NOT_CURRENT_OR_INDEPENDENT/);
    assert.equal(await check.isReadyForAnchor(session),false);
    assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.restore_admissions')).rows[0].n,0);
   }
   assert.deepEqual((await owner.query('SELECT revision FROM child_stewardship.sessions WHERE id=$1',[session])).rows,before);
   assert.equal((await backend.app.request('/canopyproof/child-stewardship/v1/view',{headers:{authorization:`Bearer ${tokens.publicTokens.child}`}})).status,503);
  });
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
   await assert.rejects(db.transaction(async connection=>{
    await connection.query("SELECT set_config('app.child_session_id',$1,true)",[session]);
    const delayed={query:async<T extends Record<string,unknown>>(sql:string,values?:unknown[]):Promise<T[]>=>{
     if(sql.includes(' AS permitted'))await connection.query('SELECT pg_sleep(0.05)');
     return connection.query<T>(sql,values);
    }};
    await assertChildRestoreReady(delayed,session,async()=>({...anchor,registryDigest:childDigest(registry),authorityExpiresAt:new Date(Date.now()+10).toISOString()}));
   }),/RESTORATION_UNVERIFIED/,'snapshot expiry during database wait is enforced at registry gate');
   const base='/canopyproof/child-stewardship/v1';
   const command=async(role:'guardian'|'child'|'protector',fields:Record<string,unknown>)=>{
    const current=await (await view()).json();const packet={commandId:`demo-${randomUUID()}`,expectedVersion:current.data.version,...fields};
    return backend.app.request(`${base}/commands`,{method:'POST',headers:{authorization:`Bearer ${tokens.publicTokens[role]}`,'content-type':'application/json','idempotency-key':packet.commandId,'if-match':String(packet.expectedVersion)},body:JSON.stringify(packet)});
   };
   let disputeId='';
   for(const [role,fields] of [
    ['guardian',{type:'create-profile',profileId:'demo-profile-a',ageBand:'9-12',locale:'en',nickname:'leaf'}],
    ['guardian',{type:'grant-consent',profileId:'demo-profile-a',purpose:'learning',policyVersion:'child-learning-demo-v1'}],
    ['child',{type:'set-assent',profileId:'demo-profile-a',purpose:'learning',willing:true}],
    ['guardian',{type:'withdraw-consent',profileId:'demo-profile-a',purpose:'learning'}],
    ['child',{type:'open-dispute',profileId:'demo-profile-a',targetId:'demo-profile-a',reason:'unsafe_adult'}],
   ] as const){const result=await command(role,fields);assert.equal(result.status,200,await result.clone().text());if(fields.type==='open-dispute')disputeId=(await result.json()).data.id;}
   assert.ok(disputeId);
   assert.equal((await command('guardian',{type:'resolve-dispute',disputeId,resolution:'unknown'})).status,403);
   const resolved=await command('protector',{type:'resolve-dispute',disputeId,resolution:'unknown'});assert.equal(resolved.status,200,await resolved.clone().text());
   const denied=await command('child',{type:'grant-consent',profileId:'demo-profile-a',purpose:'learning',policyVersion:'child-learning-demo-v1'});assert.equal(denied.status,403);
   for(const path of ['/guardian/passkeys/register','/guardian/passkeys/recover','/demo-sessions'])assert.equal((await backend.app.request(`${base}${path}`,{method:'POST'})).status,503,'unimplemented enrollment/recovery must stay closed');
   keys[1]!.revoked=true;assert.equal((await view()).status,503,'provider current revocation closes admitted session');keys[1]!.revoked=false;
   const originalKey=keys[1]!.publicKey;keys[1]!.publicKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString();
   assert.equal((await view()).status,503,'same key ID with new signing material cannot preserve admission');keys[1]!.publicKey=originalKey;
   assert.equal((await view()).status,200,'unchanged committed registry remains admitted');
   const beforeLateRevocation=(await owner.query('SELECT revision FROM child_stewardship.sessions WHERE id=$1',[session])).rows;
   const beforeAudit=(await owner.query('SELECT count(*)::int n FROM child_stewardship.audit WHERE session_id=$1',[session])).rows;
   revokeAfterWrite=true;
   const interrupted=await command('guardian',{type:'grant-consent',profileId:'demo-profile-a',purpose:'learning',policyVersion:'child-learning-demo-v1'});
   assert.equal(interrupted.status,503,'revocation after tentative SQL writes aborts before commit');
   assert.equal(revokeAfterWrite,false,'fault actually injected after audit write');
   assert.deepEqual((await owner.query('SELECT revision FROM child_stewardship.sessions WHERE id=$1',[session])).rows,beforeLateRevocation);
   assert.deepEqual((await owner.query('SELECT count(*)::int n FROM child_stewardship.audit WHERE session_id=$1',[session])).rows,beforeAudit);
   keys[1]!.revoked=false;assert.equal((await view()).status,200);
   offline=true;assert.equal((await view()).status,503);offline=false;
   anchor={...anchor,sequence:2};assert.equal((await view()).status,503,'external floor advanced: old restored/admitted state denied');
   assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.restore_admissions')).rows[0].n,1);
   anchor={...anchor,sequence:1};
   await t.test('native capability writes roll back on a late authority change; positive retry retains restore admission',async()=>{
    for(const purpose of ['learning','upload']){
     const granted=await command('guardian',{type:'grant-consent',profileId:'demo-profile-a',purpose,policyVersion:'child-learning-demo-v1'});assert.equal(granted.status,200);
     const assented=await command('child',{type:'set-assent',profileId:'demo-profile-a',purpose,willing:true});assert.equal(assented.status,200);
    }
    const assigned=await command('child',{type:'assign-task',profileId:'demo-profile-a',taskId:'demo-task-leaf-comparison'});assert.equal(assigned.status,200);
    const assignmentId=(await assigned.json()).data.id,current=(await (await view()).json()).data,draftId=randomUUID();
    const packet={type:'submit-observation',commandId:`demo-${draftId}`,expectedVersion:current.version,assignmentId,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:new Date().toISOString()};
    const proposal={draftId,intentDigest:childDigest(packet),assignmentId,originalSessionId:session,originalConsentEpoch:current.uploadEligibility[0].consentEpoch,
     purpose:'synthetic-learning-upload',schemaVersion:'CanopyProof-SyntheticDraft/2',policyVersion:current.policyVersion,expectedVersion:current.version};
    let fault='';
    const watched:ChildSqlClient={query:db.query,transaction:run=>db.transaction(connection=>run({query:async<T extends Record<string,unknown>>(sql:string,values?:unknown[]):Promise<T[]>=>{
     const rows=await connection.query<T>(sql,values);
     if(fault&&sql.startsWith(fault)){fault='';keys[1]!.revoked=true;}
     return rows;
    }}))};
    const currentAnchor=async(id:string)=>{const value=await read(id);return {...value.anchor,registryDigest:childDigest(value.registry),authorityExpiresAt:value.expiresAt};};
    const grants=new PostgresChildStore(watched,currentAnchor),resume=new PostgresChildResumeStore(watched,currentAnchor);
    const snapshot=async()=>{
     const state:Record<string,unknown>={};
     for(const table of ['draft_authorizations','session_resumption','resume_tickets','resume_mints','resume_token_lookup','session_tokens'])
      state[table]=(await owner.query(`SELECT to_jsonb(t) value FROM child_stewardship.${table} t WHERE session_id=$1 ORDER BY to_jsonb(t)::text`,[session])).rows;
     return state;
    };
    for(const kind of ['draft','suspend'] as const){
     const before=await snapshot();fault=kind==='draft'?'SELECT child_stewardship.issue_draft_authorization(':'SELECT child_stewardship.suspend_synthetic_session(';
     await assert.rejects(kind==='draft'?grants.issueDraftAuthorization(tokens.publicTokens.child,proposal):resume.suspend(tokens.publicTokens.child),/RESTORATION_UNVERIFIED/);
     assert.equal(fault,'','fault injected after the actual SQL function completed');assert.deepEqual(await snapshot(),before);
     keys[1]!.revoked=false;
    }
    assert.match(await grants.issueDraftAuthorization(tokens.publicTokens.child,proposal),/^cp-upload\./);
    const suspended=await resume.suspend(tokens.publicTokens.child),before=await snapshot();
    fault='SELECT child_stewardship.resume_synthetic_session(';
    await assert.rejects(resume.resume(suspended.resumeTicket),/RESTORATION_UNVERIFIED/);
    assert.equal(fault,'');assert.deepEqual(await snapshot(),before,'failed final read restores ticket, generation and all token/mint rows');
    keys[1]!.revoked=false;
    const resumed=await resume.resume(suspended.resumeTicket);Object.assign(tokens.publicTokens,resumed.tokens);
    assert.equal((await view()).status,200,'new tokens work after both current-authority checks pass');
    await assert.rejects(resume.resume(suspended.resumeTicket),/UNAUTHORIZED/,'successful redemption remains one-use');
   });
   provider.stop();assert.equal((await view()).status,503);
   backend.stop();assert.equal((await backend.app.request('/health/ready')).status,503);
  });
 }finally{
  if(live)await closeNativeChildPool(live);if(verifier)await closeNativeChildPool(verifier);await runtime?.close();
  if(verifierRole){await owner.query(`DROP OWNED BY ${verifierRole}`);await owner.query(`DROP ROLE ${verifierRole}`);}
  await closeNativeChildPool(owner);process.env.CANOPYPROOF_NATIVE_DATABASE_URL=original;await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);await closeNativeChildPool(admin);
 }
});
