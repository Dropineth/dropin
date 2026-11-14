// Disposable synthetic fixture only. Never install in a backend image or enroll a real subject.
import {Buffer} from 'node:buffer';
import {execFile} from 'node:child_process';
import {generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {constants} from 'node:fs';
import {open,readFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export const SOURCE_TREE='b21c6879460663eb391e94d281cbcb0b042c1dfb';
const OCI_SOURCE='0e3d33b36beac4502488b18a0707c17fd34062e5';
const DATABASE='rehearsal_session_test';
const fail=()=>{throw new Error('SYNTHETIC_SESSION_FIXTURE_FAILED');};
const check=value=>{if(!value)fail();};
export function localUrl(value,confirmation){
  check(confirmation==='disposable-local-synthetic');const url=new URL(value);
  check(['postgres:','postgresql:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  check(/^\/[A-Za-z0-9_]*test[A-Za-z0-9_]*$/.test(url.pathname)&&url.username&&url.password&&!url.search&&!url.hash);
  return url;
}
export function authorityUrl(value){
  const url=new URL(value);
  check(url.protocol==='https:'&&['localhost','127.0.0.1','[::1]','rehearsal-authority'].includes(url.hostname));
  check(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/current');return url.toString();
}
async function writeNew(path,value){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await f.close();}}
async function readPrivate(path){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();check(s.isFile()&&s.size<=65536&&(s.mode&0o077)===0);
    const b=Buffer.alloc(65537);const {bytesRead}=await f.read(b,0,b.length,0);check(bytesRead<=65536);return JSON.parse(b.subarray(0,bytesRead).toString());
  }finally{await f.close();}
}
async function source(input){
  let root=resolve(input);if(!await stat(join(root,'services/api/package.json')).then(s=>s.isFile()).catch(()=>false))root=join(root,'dropin-earth');
  check((await exec('git',['rev-parse','HEAD^{tree}'],{cwd:root})).stdout.trim()===SOURCE_TREE);
  await exec('git',['diff','--quiet','HEAD','--'],{cwd:root});
  check((await exec('git',['status','--porcelain','--untracked-files=all'],{cwd:root})).stdout.trim()==='');
  return root;
}
const load=(root,path)=>import(pathToFileURL(join(root,path)).href);
function pool(pg,url){const p=new pg.Pool({connectionString:url.toString(),max:2,ssl:false,connectionTimeoutMillis:5000,statement_timeout:30000});
  p.on('error',()=>{process.stderr.write('SYNTHETIC_SESSION_FIXTURE_FAILED\n');process.exitCode=1;});return p;}
const publicPem=key=>key.export({type:'spki',format:'pem'}).toString();
const privatePem=key=>key.export({type:'pkcs8',format:'pem'}).toString();

export function signedFixture({sessionId,roots,stableJson,childDigest,now=Date.now()}){
  const transport=generateKeyPairSync('ed25519'),pairs=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
  const registry={version:'synthetic-oci-quorum-v1',keys:pairs.map((pair,i)=>({keyId:`synthetic-key-${i}`,role:i===0?'protection':'trustee',
    controlDomain:`synthetic-fixture-domain-${i}`,independentOfOperator:true,publicKey:publicPem(pair.publicKey),revoked:false,
    validAfter:new Date(now-60000).toISOString(),expiresAt:new Date(now+3600000).toISOString()}))};
  const checkpoint={protocol:'CanopyProof-RestoreCheckpoint/1',environment:'SIMULATION_ONLY',domainSeparator:'canopyproof:synthetic:restore:v1',
    checkpointId:'synthetic-oci-checkpoint-1',sequence:1,sessionId,keyRegistryVersion:registry.version,
    issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+2700000).toISOString(),roots};
  return {transportPrivateKey:privatePem(transport.privateKey),transportPublicKey:publicPem(transport.publicKey),
    quorumPrivateKeys:pairs.map((pair,i)=>({keyId:registry.keys[i].keyId,privateKey:privatePem(pair.privateKey)})),
    current:{anchor:{sessionId,checkpointId:checkpoint.checkpointId,sequence:1,digest:childDigest(checkpoint),keyRegistryVersion:registry.version},registry},
    checkpointSigned:{checkpoint,signatures:pairs.map((pair,i)=>({keyId:registry.keys[i].keyId,signature:sign(null,Buffer.from(stableJson(checkpoint)),pair.privateKey).toString('base64url')}))}};
}

async function prepare(root,adminUrl,output){
  const pg=createRequire(join(root,'services/api/package.json'))('pg');
  const {nativeChildSql}=await load(root,'tests/fixtures/child-stewardship-postgres.ts');
  const {PostgresChildStore}=await load(root,'services/api/src/domain/child-stewardship/postgres-store.ts');
  const {loadChildMigrations,migrateChildBackend,childMigrationReady}=await load(root,'services/api/src/child-backend/migrations.ts');
  const {createDemoTokens,stableJson,childDigest}=await load(root,'services/api/src/domain/child-stewardship/store.ts');
  const {createSyntheticLearningState}=await load(root,'services/api/src/domain/child-stewardship/learning.ts');
  const {createEmptyRightsState}=await load(root,'services/api/src/domain/child-stewardship/rights.ts');
  const admin=pool(pg,adminUrl);let owner,runtime,verifier;
  try{
    check(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount);
    const suffix=randomBytes(12).toString('hex'),urls={};
    for(const kind of ['owner','runtime','verifier']){
      const role=`oci_${kind}_${suffix}`,password=randomBytes(32).toString('hex');
      await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD '${password}'`);
      const url=new URL(adminUrl);url.pathname=`/${DATABASE}`;url.username=role;url.password=password;urls[kind]=url;
    }
    const ownerRole=urls.owner.username,runtimeRole=urls.runtime.username,verifierRole=urls.verifier.username;
    await admin.query(`CREATE DATABASE ${DATABASE} OWNER ${ownerRole}`);
    await admin.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC;GRANT CONNECT ON DATABASE ${DATABASE} TO ${ownerRole},${runtimeRole},${verifierRole}`);
    owner=pool(pg,urls.owner);runtime=pool(pg,urls.runtime);verifier=pool(pg,urls.verifier);
    // Match native integration seeding order. Strict restore is deliberately not yet installed.
    for(const name of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-privacy.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql','child-stewardship-rate-limit.sql']){
      await owner.query(await readFile(join(root,'services/api/prisma',name),'utf8'));
    }
    const grantRuntime=async()=>{
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${runtimeRole};GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${runtimeRole};GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${runtimeRole};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${runtimeRole}`);
    };
    await grantRuntime();
    await owner.query("INSERT INTO child_stewardship.service_role_scopes(database_role,actor_role,scope_version,enabled,approval_ref,expires_at) SELECT $1,unnest($2::text[]),1,true,'synthetic-oci-fixture-only',clock_timestamp()+interval '1 hour'",[runtimeRole,['bootstrap','guardian','child','reviewer','protector','operator']]);
    const sessionId=randomUUID(),tokens=createDemoTokens(sessionId),now=new Date().toISOString();
    await new PostgresChildStore(nativeChildSql(runtime)).create({id:sessionId,expiresAt:new Date(Date.now()+3600000).toISOString(),snapshot:{version:0,learning:createSyntheticLearningState(now),rights:createEmptyRightsState()}},tokens.records);
    const migrations=await loadChildMigrations(pathToFileURL(join(root,'services/api/prisma')+'/'));
    const migrated=await migrateChildBackend(owner,migrations,{database:DATABASE,role:ownerRole});check(migrated.applied.length===migrations.length);
    await grantRuntime();
    await owner.query(`GRANT USAGE ON SCHEMA child_backend_migrations,child_stewardship_webauthn,child_stewardship_guardian TO ${runtimeRole};GRANT SELECT ON child_backend_migrations.entries,child_stewardship_webauthn.verifier_roles TO ${runtimeRole}`);
    await owner.query(`GRANT USAGE ON SCHEMA child_stewardship,child_stewardship_webauthn TO ${verifierRole};GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA child_stewardship TO ${verifierRole};GRANT UPDATE ON child_stewardship.sessions TO ${verifierRole};GRANT SELECT ON child_stewardship_webauthn.verifier_roles TO ${verifierRole};GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${verifierRole};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${verifierRole}`);
    await owner.query("INSERT INTO child_stewardship.restore_verifier_roles VALUES($1,1,true,'synthetic-oci-fixture-only',clock_timestamp()+interval '1 hour')",[verifierRole]);
    check(await childMigrationReady(nativeChildSql(runtime),migrations));
    check(await new PostgresChildStore(nativeChildSql(runtime),async()=>{throw new Error('NOT_ADMITTED');}).ready());
    const roots=await nativeChildSql(owner).transaction(async db=>{
      await db.query("SELECT set_config('app.child_session_id',$1,true)",[sessionId]);
      await db.query("INSERT INTO child_stewardship.outbox(session_id,event_id,kind,resource_id,audience) VALUES ($1,'hosted-pending','fixture','synthetic','ordinary')",[sessionId]);
      return (await db.query('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[sessionId]))[0].roots;
    });
    const signed=signedFixture({sessionId,roots,stableJson,childDigest});
    await writeNew(output,{kind:'SyntheticOciSessionFixture/1',environment:'SIMULATION_ONLY',audience:'canopyproof:synthetic:child-backend',
      sessionId,...signed,ownerDatabaseUrl:urls.owner.toString(),runtimeDatabaseUrl:urls.runtime.toString(),verifierDatabaseUrl:urls.verifier.toString(),runtimeRole,verifierRole,
      tokens:{child:tokens.publicTokens.child},sourceTree:SOURCE_TREE,ociSourceSha:OCI_SOURCE,
      database:DATABASE,independenceEvidence:'NONE: distinct test keys and labels are fixture mechanics only',
      perSessionAuth:'NOT_RUN',productionReady:false,authorizationGranted:false,releaseApproval:false});
  }finally{await runtime?.end();await verifier?.end();await owner?.end();await admin.end();}
}

async function admit(root,fixturePath,endpoint,output,env){
  const fixture=await readPrivate(fixturePath);
  check(fixture.kind==='SyntheticOciSessionFixture/1'&&fixture.environment==='SIMULATION_ONLY'&&fixture.sourceTree===SOURCE_TREE&&fixture.database===DATABASE);
  check(fixture.audience==='canopyproof:synthetic:child-backend'&&fixture.ociSourceSha===OCI_SOURCE);
  const target=localUrl(fixture.verifierDatabaseUrl,env.REHEARSAL_CONFIRM);check(target.pathname===`/${DATABASE}`);
  check(/^oci_verifier_[a-f0-9]{24}$/.test(target.username)&&target.username===fixture.verifierRole);
  const pg=createRequire(join(root,'services/api/package.json'))('pg');
  const {nativeChildSql}=await load(root,'tests/fixtures/child-stewardship-postgres.ts');
  const {ChildRestoreVerifier}=await load(root,'services/api/src/domain/child-stewardship/restore-checkpoint.ts');
  const {currentAuthorityClient}=await load(root,'services/api/src/child-backend/current-authority.ts');
  const {stableJson}=await load(root,'services/api/src/domain/child-stewardship/store.ts');
  const verifier=pool(pg,target);
  try{
    // Actual HTTPS fetch, default TLS validation, no injected transport or cached anchor.
    const read=currentAuthorityClient({url:authorityUrl(endpoint),publicKey:fixture.transportPublicKey,audience:fixture.audience});
    const observed=await read(fixture.sessionId);check(stableJson(observed.registry)===stableJson(fixture.current.registry));
    const anchor=async id=>{const current=await read(id);check(stableJson(current.registry)===stableJson(observed.registry));return current.anchor;};
    const checkRestore=new ChildRestoreVerifier(nativeChildSql(verifier),anchor,observed.registry);
    check(await checkRestore.ready());
    const admitted=await checkRestore.verifyAndAdmit(fixture.sessionId,fixture.checkpointSigned);
    check(admitted.verified===true&&admitted.syntheticOnly===true&&await checkRestore.isReadyForAnchor(fixture.sessionId));
    await writeNew(output,{kind:'SyntheticOciSessionAdmission/1',environment:'SIMULATION_ONLY',sourceTree:SOURCE_TREE,
      actualSqlVerifierAdmission:true,actualHttpsAuthorityRead:true,finalOciSessionRequest:'NOT_RUN',
      realIdentityVerified:false,independenceVerified:false,productionReady:false,authorizationGranted:false,releaseApproval:false});
  }finally{await verifier.end();}
}
export async function main(argv=process.argv.slice(2),env=process.env){
  check((argv[0]==='prepare'&&argv.length===3)||(argv[0]==='admit'&&argv.length===5));
  check(env.REHEARSAL_CONFIRM==='disposable-local-synthetic'&&env.NODE_TLS_REJECT_UNAUTHORIZED!=='0');
  const root=await source(argv[1]),output=resolve(argv.at(-1));
  check(!await stat(output).then(()=>true).catch(()=>false));
  if(argv[0]==='prepare')await prepare(root,localUrl(env.REHEARSAL_DATABASE_URL,env.REHEARSAL_CONFIRM),output);
  else await admit(root,resolve(argv[2]),argv[3],output,env);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(()=>{process.stderr.write('SYNTHETIC_SESSION_FIXTURE_FAILED\n');process.exitCode=1;});
}
