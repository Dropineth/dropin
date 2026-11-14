import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {chmod,copyFile,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,dirname} from 'node:path';
import process from 'node:process';
import {createServer,createConnection,isIPv4} from 'node:net';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
export const PIN=Object.freeze({
  candidate:'0e3d33b36beac4502488b18a0707c17fd34062e5',candidateTree:'b21c6879460663eb391e94d281cbcb0b042c1dfb',
  rollback:'1d2efaa5258b70ed9f815af0ebf7109443734e59',rollbackTree:'3127db96e31d75a6f6a69430d66739f58cc35d76',
  node:'v22.23.5',base:'docker.io/library/node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee',
  postgres:'docker.io/library/postgres:17.12@sha256:dbb9623d5121b5d2c2c9e2fba56e40193cbb3510d4af7f035b1ab1823aff3205',
});
const stages=['source_preflight','docker_preflight','build_candidate','build_rollback','candidate_closed_http','rollback_closed_http',
  'private_environment','private_postgres','native_dependencies','native_synthetic_lifecycle','prepare_fixture','synthetic_authority_fixture',
  'combined_candidate_readiness','postgres_tls_observed','combined_tls_hostname_denial',
  'synthetic_https_reachability','rollback_data_baseline','candidate_stop','combined_rollback_readiness','rollback_data_invariants','source_recheck','cleanup'];
export function receipt(){return {kind:'CanopyProofDockerRehearsal/1',candidateSha:PIN.candidate,rollbackSha:PIN.rollback,
  scope:'isolated-synthetic-rehearsal',stages:Object.fromEntries(stages.map(name=>[name,{status:'NOT_RUN'}])),
  ociSignedPerSessionCheckpoint:{status:'NOT_RUN',reason:'No pre-provisioned session/checkpoint is injected into final OCI.'},
  productionEnrollment:{status:'NOT_RUN',reason:'Real enrollment must remain unavailable.'},
  productionReady:false,authorizationGranted:false,releaseApproval:false,productionDeployed:false};}
export function parseTap(text){
  const value=name=>Number(text.match(new RegExp(`^# ${name} (\\d+)$`,'m'))?.[1]??NaN);
  const result={tests:value('tests'),passed:value('pass'),failed:value('fail'),cancelled:value('cancelled'),skipped:value('skipped')};
  assert.ok(result.tests>0&&result.passed===result.tests&&result.failed===0&&result.cancelled===0&&result.skipped===0,'NATIVE_TESTS_INCOMPLETE');return result;
}
// Only fixed categories escape to the receipt. Never persist command arguments,
 // raw stderr, container logs, database URLs, or credential material.
export function postgresFailureClass(details){
  const value=String(details??'').slice(-16000);
  if(/manifest unknown|no matching manifest|not found: manifest/i.test(value))return 'IMAGE_MANIFEST_UNAVAILABLE';
  if(/toomanyrequests|rate limit/i.test(value))return 'REGISTRY_RATE_LIMIT';
  if(/permission denied|wrong ownership|group or world access/i.test(value))return 'PERMISSION_OR_OWNERSHIP';
  if(/failed to load|could not load|private key file|certificate file/i.test(value))return 'TLS_FILE_LOAD';
  if(/bind for.+failed|port is already allocated|failed to bind host port/i.test(value))return 'LOOPBACK_PORT_BIND';
  if(/database system is starting up|not yet accepting connections/i.test(value))return 'DB_STARTING';
  return 'UNCLASSIFIED';
}
export function privateContainerAddress(container,networkName,networkId){
  const endpoint=container.NetworkSettings?.Networks?.[networkName];
  assert.deepEqual(Object.keys(container.NetworkSettings?.Networks??{}),[networkName]);
  assert.equal(endpoint?.NetworkID,networkId);
  assert.ok(!container.HostConfig?.PortBindings||Object.keys(container.HostConfig.PortBindings).length===0);
  const target=endpoint?.IPAddress;
  assert.ok(isIPv4(target),'PRIVATE_PG_IPV4_REQUIRED');
  const [a,b]=target.split('.').map(Number);
  assert.ok(a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168),'PRIVATE_PG_IPV4_REQUIRED');
  return target;
}
async function openPgRelay(target){
  await new Promise((resolve,reject)=>{
    const socket=createConnection({host:target,port:5432});
    socket.setTimeout(4000,()=>socket.destroy(new Error('PRIVATE_PG_CONNECT_TIMEOUT')));
    socket.once('error',reject);
    socket.once('connect',()=>{socket.destroy();resolve();});
  });
  const sockets=new Set();
  const server=createServer(client=>{
    if(client.remoteAddress!=='127.0.0.1'||sockets.size>=48){client.destroy();return;}
    const upstream=createConnection({host:target,port:5432});
    for(const socket of [client,upstream]){
      sockets.add(socket);socket.setTimeout(120000,()=>socket.destroy());
      socket.on('error',()=>socket.destroy());socket.on('close',()=>sockets.delete(socket));
    }
    client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.destroy());
    client.pipe(upstream);upstream.pipe(client);
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});
  });
  server.on('error',()=>{for(const socket of sockets)socket.destroy();});
  const address=server.address();assert.equal(address?.address,'127.0.0.1');assert.ok(address.port>0);
  return {port:address.port,close:async()=>{for(const socket of sockets)socket.destroy();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const idPattern=/^[a-f0-9]{64}$/;
const imagePattern=/^sha256:[a-f0-9]{64}$/;
export function imageIdentity(value){assert.match(value.Id,imagePattern);assert.equal(value.Os,'linux');assert.equal(value.Architecture,'amd64');return value.Id;}
export function authorityKeys(credentials){
  assert.equal(credentials.kind,'DisposableChildRehearsalFixture/1');
  assert.equal(typeof credentials.authorityPublicKey,'string');assert.equal(typeof credentials.authorityPrivateKey,'string');
  return {authorityPublicKey:credentials.authorityPublicKey,authorityPrivateKey:credentials.authorityPrivateKey};
}
export function containerBoundary(value,imageId,{network='none',user='node'}={}){
  assert.equal(value.Image,imageId);assert.equal(value.Config.User,user);assert.equal(value.HostConfig.ReadonlyRootfs,true);
  assert.equal(value.HostConfig.NetworkMode,network);assert.equal(value.HostConfig.Privileged,false);
  assert.ok(value.HostConfig.CapDrop?.includes('ALL'));assert.ok(value.HostConfig.SecurityOpt?.some(option=>['no-new-privileges','no-new-privileges=true'].includes(option)));
  assert.ok(!value.HostConfig.PortBindings||Object.keys(value.HostConfig.PortBindings).length===0);
}
export function safePaths(candidate,rollback,output){
  for(const path of [candidate,rollback,output])assert.ok(isAbsolute(path),'ABSOLUTE_PATHS_REQUIRED');
  const inside=(base,path)=>{const rel=relative(base,path);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
  assert.notEqual(candidate,rollback);assert.ok(!inside(candidate,output)&&!inside(rollback,output));
  assert.ok(!inside(output,candidate)&&!inside(output,rollback));
}
const operationNames=['PATH','HOME','TMPDIR','TMP','TEMP','SYSTEMROOT','SystemRoot','NODE_OPTIONS','NODE_USE_ENV_PROXY','NODE_EXTRA_CA_CERTS',
  'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR','CURL_CA_BUNDLE'];
const operationalEnv=()=>Object.fromEntries(operationNames.filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
export async function main(args){
  if(args.length!==3)throw new Error('THREE_PATHS_REQUIRED');
  args.forEach(path=>assert.ok(isAbsolute(path),'ABSOLUTE_PATHS_REQUIRED'));
  const [candidate,rollback]=await Promise.all(args.slice(0,2).map(path=>realpath(path))),output=resolve(args[2]);
  safePaths(candidate,rollback,output);assert.ok(isAbsolute(args[2]));
  // New output directory only. Never overwrite an existing receipt or user tree.
  await mkdir(output,{mode:0o700});
  const report=receipt();let privateDir,pgRelay;const containers=[],networks=[],images=[];let active='source_preflight';
  const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  const run=async(file,argv,{cwd=here,env={},timeout=120_000,diagnostic=false}={})=>{
    const result=await exec(file,argv,{cwd,env:{...operationalEnv(),...env},timeout,maxBuffer:32*1024*1024});return (diagnostic?result.stdout+'\n'+result.stderr:result.stdout).trim();
  };
  const docker=(argv,options)=>run('docker',['--host','unix:///var/run/docker.sock',...argv],options);
  const inspect=async(kind,id)=>JSON.parse(await docker([kind,'inspect',id]))[0];
  const stage=async(name,fn)=>{
    active=name;report.stages[name]={status:'RUNNING'};await save();
    const result=await fn();report.stages[name]={status:'PASS',...result};await save();return result;
  };
  const source=async(path,sha,tree)=>{
    assert.equal(await run('git',['rev-parse','HEAD'],{cwd:path}),sha);assert.equal(await run('git',['rev-parse','HEAD^{tree}'],{cwd:path}),tree);
    assert.equal(await run('git',['status','--porcelain','--untracked-files=all'],{cwd:path}),'');
    const plan=JSON.parse(await readFile(join(path,'dropin-earth/infra/child-backend/deployment-plan.json'),'utf8'));
    assert.equal(plan.api.nodeImageDigest,PIN.base);assert.equal(plan.api.defaultAccountMode,'disabled');assert.equal(plan.api.migrationOnStartup,false);
  };
  const start=async(argv)=>{const id=await docker(['create',...argv]);assert.match(id,idPattern);containers.push(id);await docker(['start',id]);return id;};
  const stop=async(id)=>{await docker(['stop','--time','25',id]);const ended=await inspect('container',id);assert.equal(ended.State.ExitCode,0);};
  const common=['--read-only','--cap-drop','ALL','--security-opt','no-new-privileges'];
  const probeCode=`const assert=require('node:assert/strict');(async()=>{let r;for(let i=0;i<100;i++){try{r=await fetch('http://127.0.0.1:10000/health/live');if(r.status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.equal(r?.status,200);const live=await r.json();assert.equal(live.sourceSha,process.argv[1]);assert.equal(live.realCapabilities,false);assert.equal(live.syntheticOnly,true);const ready=await fetch('http://127.0.0.1:10000/health/ready');assert.equal(ready.status,Number(process.argv[2]));const state=await ready.json();assert.equal(state.realCapabilities,false);assert.equal(state.accountEntry,process.argv[2]==='200'?'synthetic-only':'closed');for(const path of ['guardian/passkeys/register','guardian/passkeys/recover','demo-sessions']){const denied=await fetch('http://127.0.0.1:10000/canopyproof/child-stewardship/v1/'+path,{method:'POST'});assert.equal(denied.status,503);}assert.notEqual(process.getuid(),0);assert.equal(process.version,'v22.23.5');console.log(JSON.stringify({sourceSha:live.sourceSha,node:process.version,uid:process.getuid(),readiness:ready.status,accountEntry:state.accountEntry,realCapabilities:false,enrollmentDenied:true}));})().catch(()=>process.exit(1));`;
  const probe=async(id,sha,status)=>JSON.parse(await docker(['exec',id,'node','-e',probeCode,sha,String(status)]));
  let failed=false;
  try{
    await stage('source_preflight',async()=>{
      assert.equal(process.version,PIN.node);assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.ok(process.getuid()>0);
      assert.equal(process.env.GITHUB_ACTIONS,'true','HOSTED_RUNNER_REQUIRED');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','HOSTED_RUNNER_REQUIRED');
      assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED,'0');
      for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','CONTAINER_HOST','BUILDKIT_HOST'])assert.ok(!process.env[key],'AMBIENT_RUNTIME_SELECTOR_DENIED');
      await source(candidate,PIN.candidate,PIN.candidateTree);await source(rollback,PIN.rollback,PIN.rollbackTree);
      return {candidateTree:PIN.candidateTree,rollbackTree:PIN.rollbackTree,node:process.version};
    });
    await stage('docker_preflight',async()=>{
      const version=JSON.parse(await docker(['version','--format','{{json .}}']));assert.equal(version.Server.Os,'linux');assert.equal(version.Server.Arch,'amd64');
      return {serverVersion:version.Server.Version,os:'linux',architecture:'amd64',endpoint:'local-unix-socket'};
    });
    privateDir=await mkdtemp(join(output,'.private-'));await chmod(privateDir,0o700);
    const build=async(label,path,sha)=>stage(`build_${label}`,async()=>{
      const iid=join(privateDir,`${label}.iid`);await docker(['build','--pull=false','--iidfile',iid,'--build-arg',`NODE_IMAGE=${PIN.base}`,'--build-arg',`CHILD_BUILD_SHA=${sha}`,'-f','infra/child-backend/Dockerfile','.'],{cwd:join(path,'dropin-earth'),timeout:900_000});
      const imageId=(await readFile(iid,'utf8')).trim();assert.match(imageId,imagePattern);images.push(imageId);
      const metadata=await inspect('image',imageId);assert.equal(imageIdentity(metadata),imageId);assert.equal(metadata.Config.User,'node');
      return {imageId,sourceSha:sha,baseImage:PIN.base};
    });
    const candidateImage=(await build('candidate',candidate,PIN.candidate)).imageId;
    const rollbackImage=(await build('rollback',rollback,PIN.rollback)).imageId;assert.notEqual(candidateImage,rollbackImage);
    for(const [label,imageId,sha] of [['candidate',candidateImage,PIN.candidate],['rollback',rollbackImage,PIN.rollback]]){
      await stage(`${label}_closed_http`,async()=>{
        const id=await start(['--network','none',...common,imageId]);containerBoundary(await inspect('container',id),imageId);
        const observed=await probe(id,sha,503);
        const verification=JSON.parse(await docker(['exec',id,'node','-e',`const f=require('node:fs'),c=require('node:crypto'),a=require('node:assert/strict');const m=JSON.parse(f.readFileSync('/app/build.json'));a.equal(m.sourceSha,process.argv[1]);a.equal(m.syntheticOnly,true);a.equal(m.releaseApproval,false);for(const n of ['server.mjs','migrate.mjs'])a.equal(c.createHash('sha256').update(f.readFileSync('/app/'+n)).digest('hex'),m.artifacts[n]);console.log(JSON.stringify({manifest:m,actualBundleHashesVerified:true}));`,sha]));
        await stop(id);return {...observed,...verification,imageId,network:'none',cleanExit:true};
      });
    }
    // All networked fixtures use a newly owned internal network. Only PG is bound
    // to an ephemeral 127.0.0.1 host port so the repository native tests can use it.
    const networkName=`cp-rehearsal-${randomUUID()}`,tls=join(privateDir,'tls');
    const privateNet=await stage('private_environment',async()=>{
    const network=await docker(['network','create','--internal',networkName]);assert.match(network,idPattern);networks.push(network);
    assert.equal((await inspect('network',network)).Internal,true);
    await mkdir(tls,{mode:0o700});
    await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Disposable rehearsal CA','-keyout',join(tls,'ca.key'),'-out',join(tls,'ca.crt')]);
    await chmod(join(tls,'ca.crt'),0o644);
    for(const name of ['pg','authority']){
      await run('openssl',['req','-newkey','rsa:2048','-nodes','-subj',`/CN=rehearsal-${name}`,'-keyout',join(tls,`${name}.key`),'-out',join(tls,`${name}.csr`)]);
      await writeFile(join(tls,`${name}.ext`),`subjectAltName=DNS:rehearsal-${name}\nextendedKeyUsage=serverAuth\n`,{mode:0o600});
      await run('openssl',['x509','-req','-days','1','-in',join(tls,`${name}.csr`),'-CA',join(tls,'ca.crt'),'-CAkey',join(tls,'ca.key'),'-CAcreateserial','-extfile',join(tls,`${name}.ext`),'-out',join(tls,`${name}.crt`)]);
      await chmod(join(tls,`${name}.key`),0o600);
    }
    return {networkId:network,internalDockerNetwork:true,temporaryCA:true,systemTrustModified:false};
    });
    const password=randomBytes(32).toString('hex'),pgEnv=join(privateDir,'pg.env');
    await writeFile(pgEnv,`POSTGRES_USER=rehearsal_admin\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=rehearsal_native_test\n`,{mode:0o600});
    const pg=await stage('private_postgres',async()=>{
      let phase='image_pull', id;const ownedBefore=containers.length;
      try{
      await docker(['pull',PIN.postgres],{timeout:300_000});
      phase='image_identity';const pgImage=imageIdentity(await inspect('image',PIN.postgres));
      phase='container_launch';
      id=await start(['--network',networkName,'--network-alias','rehearsal-pg','--network-alias','rehearsal-pg-wrong','--user',`${process.getuid()}:${process.getgid()}`,
        '--env-file',pgEnv,'--mount',`type=bind,source=${join(tls,'pg.crt')},target=/certs/pg.crt,readonly`,
        '--mount',`type=bind,source=${join(tls,'pg.key')},target=/certs/pg.key,readonly`,
        '--tmpfs',`/var/lib/postgresql/data:rw,nosuid,size=1g,mode=0700,uid=${process.getuid()},gid=${process.getgid()}`,
        '--tmpfs',`/var/run/postgresql:rw,nosuid,size=8m,mode=0770,uid=${process.getuid()},gid=${process.getgid()}`,
        pgImage,'postgres','-c','ssl=on','-c','ssl_cert_file=/certs/pg.crt','-c','ssl_key_file=/certs/pg.key']);
      phase='tcp_readiness';let ready=false;
      // The image entrypoint starts a Unix-socket-only temporary server first.
      // Wait for the actual TCP server, not its initialization process.
      for(let i=0;i<90;i++){
        const state=(await inspect('container',id)).State;
        if(!state.Running)break;
        try{await docker(['exec',id,'pg_isready','-h','127.0.0.1','-p','5432','-U','rehearsal_admin','-d','rehearsal_native_test'],{timeout:4000});ready=true;break;}
        catch{await new Promise(r=>setTimeout(r,1000));}
      }
      assert.ok(ready,'POSTGRES_NOT_READY');
      phase='loopback_relay';
      const target=privateContainerAddress(await inspect('container',id),networkName,privateNet.networkId);
      pgRelay=await openPgRelay(target);
      phase='server_version';const version=await docker(['exec',id,'psql','-U','rehearsal_admin','-d','rehearsal_native_test','-Atc','SHOW server_version']);assert.match(version,/^17\.12(?:\s|$)/);
      return {containerId:id,port:pgRelay.port,imageId:pgImage,version,privateNetwork:true,hostBinding:'127.0.0.1-relay-only',dockerPortPublished:false};
      }catch(error){
        const ownedId=id??(containers.length>ownedBefore?containers[containers.length-1]:undefined);
        let state, logs='';
        if(ownedId && ['container_launch','tcp_readiness','loopback_relay','server_version'].includes(phase)){
          try{ state=(await inspect('container',ownedId)).State; }catch{}
          try{ logs=await docker(['logs','--tail','40',ownedId],{timeout:4000,diagnostic:true}); }catch(e){ logs=e?.stderr??''; }
        }
        const categories=[postgresFailureClass(error?.stderr),postgresFailureClass(logs)].filter(x=>x!=='UNCLASSIFIED');
        throw Object.assign(new Error('POSTGRES_REHEARSAL_STAGE_FAILED'),{code:'POSTGRES_REHEARSAL_STAGE_FAILED',
          diagnostic:{phase,categories:[...new Set(categories)],containerState:['created','running','exited','dead','restarting'].includes(state?.Status)?state.Status:null,
            containerExitCode:Number.isInteger(state?.ExitCode)?state.ExitCode:null}});
      }
    });
    const dbUrl=`postgresql://rehearsal_admin:${password}@127.0.0.1:${pg.port}/rehearsal_native_test`,app=join(candidate,'dropin-earth');
    const npmHome=join(privateDir,'npm'),npm=join(npmHome,'node_modules/npm/bin/npm-cli.js');
    await stage('native_dependencies',async()=>{
      await run('npm',['install','--prefix',npmHome,'npm@10.9.4','--ignore-scripts','--no-audit','--no-fund'],{timeout:120_000});
      assert.equal(await run(process.execPath,[npm,'--version']),'10.9.4');
      await run(process.execPath,[npm,'ci','--ignore-scripts','--include=optional','--no-audit','--no-fund'],{cwd:app,timeout:600_000});return {npm:'10.9.4',lockfile:true};
    });
    const nativeEnv={CANOPYPROOF_NATIVE_TEST_CONFIRM:'confirm-disposable-test-database',CANOPYPROOF_NATIVE_DATABASE_URL:dbUrl,CANOPYPROOF_NATIVE_POSTGRES_CONTAINER:pg.containerId,DATABASE_URL:dbUrl,
      CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED:'false',CANOPYPROOF_NASA_GIBS_ENABLED:'false'};
    await stage('native_synthetic_lifecycle',async()=>{
      await run(process.execPath,[npm,'run','prisma:generate:test'],{cwd:app,env:nativeEnv});
      const files=[...['webauthn','guardian-sessions','resume','restore'].map(n=>`tests/integration/child-stewardship-${n}.integration.ts`),'tests/integration/child-backend.integration.ts'];
      const text=await run(process.execPath,['--test','--test-concurrency=1','--import','tsx',...files],{cwd:app,env:nativeEnv,timeout:600_000});
      return {...parseTap(text),files,logSha256:digest(text),transport:'host Node/Hono plus actual disposable PostgreSQL/Docker backup',ociPerSessionFlow:false};
    });
    const credentialsFile=join(privateDir,'credentials.json'),tsx=join(app,'node_modules/tsx/dist/loader.mjs');
    const fixtureEnv={REHEARSAL_DATABASE_URL:dbUrl,REHEARSAL_CONFIRM:'disposable-local-synthetic'};
    const helper=(mode,extra)=>run(process.execPath,['--import',tsx,join(here,'prepare-fixture.mjs'),mode,app,...extra],{env:fixtureEnv});
    await stage('prepare_fixture',async()=>{await helper('prepare',[credentialsFile]);return {schemaAndRestrictedRolePrepared:true,syntheticOnly:true};});
    const creds=JSON.parse(await readFile(credentialsFile,'utf8'));
    await stage('synthetic_authority_fixture',async()=>{
    // No CA signing key, PG server key, migration login, or runtime DB credentials
    // enter this fixture. Its only secrets are its own disposable TLS/Ed25519 keys.
    const authorityDir=join(privateDir,'authority');await mkdir(authorityDir,{mode:0o700});
    for(const name of ['authority.crt','authority.key'])await copyFile(join(tls,name),join(authorityDir,name));
    await writeFile(join(authorityDir,'credentials.json'),JSON.stringify(authorityKeys(creds)),{mode:0o600});
    await start(['--network',networkName,'--network-alias','rehearsal-authority','--user',`${process.getuid()}:${process.getgid()}`,...common,
      '--mount',`type=bind,source=${authorityDir},target=/fixture,readonly`,'--mount',`type=bind,source=${join(here,'authority-fixture.mjs')},target=/authority-fixture.mjs,readonly`,PIN.base,'node','/authority-fixture.mjs']);
    return {configuredEd25519Fixture:true,signedPerSessionCheckpoint:'NOT_RUN',publicPorts:false};
    });
    const runtimeUrl=new URL(creds.runtimeDatabaseUrl);assert.equal(runtimeUrl.hostname,'127.0.0.1');runtimeUrl.hostname='rehearsal-pg';runtimeUrl.port='5432';
    const envFile=join(privateDir,'backend.env');assert.ok(!creds.authorityPublicKey.includes('\r'));
    // PEM newlines cannot go into --env-file; the public key is passed as an
    // explicit nonsecret docker env value, while the DB password stays in a file.
    await writeFile(envFile,`CHILD_BACKEND_MODE=synthetic-demo\nCHILD_DATABASE_TLS=verify-full\nCHILD_DATABASE_URL=${runtimeUrl}\nCHILD_CURRENT_AUTHORITY_URL=https://rehearsal-authority:8443/current\nNODE_EXTRA_CA_CERTS=/rehearsal-ca.crt\n`,{mode:0o600});
    const combined=async(imageId,sha,{file=envFile,status=200}={})=>{
      const id=await start(['--network',networkName,...common,'--env-file',file,'-e',`CHILD_CURRENT_AUTHORITY_PUBLIC_KEY=${creds.authorityPublicKey}`,
        '--mount',`type=bind,source=${join(tls,'ca.crt')},target=/rehearsal-ca.crt,readonly`,imageId]);
      containerBoundary(await inspect('container',id),imageId,{network:networkName});return {id,observed:await probe(id,sha,status)};
    };
    const current=await stage('combined_candidate_readiness',async()=>{const value=await combined(candidateImage,PIN.candidate);return {containerId:value.id,...value.observed,imageId:candidateImage,scope:'schema-and-runtime-readiness-only'};});
    await stage('postgres_tls_observed',async()=>{const file=join(privateDir,'tls-observed.json');await helper('tls',[credentialsFile,file]);return JSON.parse(await readFile(file,'utf8'));});
    await stage('combined_tls_hostname_denial',async()=>{
      const file=join(privateDir,'wrong-host.env');const contents=await readFile(envFile,'utf8');
      await writeFile(file,contents.replace('@rehearsal-pg:', '@rehearsal-pg-wrong:'),{mode:0o600});
      const denied=await combined(candidateImage,PIN.candidate,{file,status:503});await stop(denied.id);
      return {...denied.observed,control:'same database/image/CA and resolvable host; hostname absent from certificate SAN'};
    });
    await stage('synthetic_https_reachability',async()=>{
      const observed=JSON.parse(await docker(['exec',current.containerId,'node','-e',`const a=require('node:assert/strict');(async()=>{let r;for(let i=0;i<50;i++){try{r=await fetch('https://rehearsal-authority:8443/health');if(r.status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}a.equal(r?.status,200);const b=await r.json();a.equal(b.fixture,true);a.equal(b.authorizationGranted,false);console.log(JSON.stringify({tlsVerified:true,currentRequests:b.currentRequests,authorizationGranted:false}));})().catch(()=>process.exit(1));`]));
      return {...observed,signedPerSessionCheckpoint:'NOT_RUN'};
    });
    let before;
    await stage('rollback_data_baseline',async()=>{const beforeFile=join(privateDir,'before.json');await helper('snapshot',[beforeFile]);before=JSON.parse(await readFile(beforeFile,'utf8'));return {snapshot:before};});
    await stage('candidate_stop',async()=>{await stop(current.containerId);return {cleanExit:true};});
    await stage('combined_rollback_readiness',async()=>{const value=await combined(rollbackImage,PIN.rollback);await stop(value.id);return {...value.observed,imageId:rollbackImage,cleanExit:true,scope:'distinct-older-image-same-disposable-database'};});
    await stage('rollback_data_invariants',async()=>{const afterFile=join(privateDir,'after.json');await helper('snapshot',[afterFile]);const after=JSON.parse(await readFile(afterFile,'utf8'));assert.deepEqual(after,before);return {unchanged:true,snapshot:after,scope:'closed/no-session image switch; not a live account or asset rollback'};});
    await stage('source_recheck',async()=>{await source(candidate,PIN.candidate,PIN.candidateTree);await source(rollback,PIN.rollback,PIN.rollbackTree);return {unchanged:true};});
  }catch(error){failed=true;report.stages[active]={status:'FAIL',errorCode:typeof error?.code==='string'?error.code:'ASSERTION_OR_COMMAND_FAILED',outcomeUncertain:Boolean(error?.killed),...(active==='private_postgres'&&error?.code==='POSTGRES_REHEARSAL_STAGE_FAILED'?{diagnostic:error.diagnostic}:{})};}
  finally{
    const failures=[];
    if(pgRelay){try{await pgRelay.close();}catch{failures.push('loopback-relay');}}
    for(const id of containers.reverse()){try{await docker(['rm','--force','--volumes',id]);}catch{failures.push('container');}}
    for(const id of networks.reverse()){try{await docker(['network','rm',id]);}catch{failures.push('network');}}
    for(const id of [...new Set(images)]){try{await docker(['image','rm',id]);}catch{failures.push('image');}}
    if(privateDir){try{await rm(privateDir,{recursive:true,force:true});}catch{failures.push('private-files');}}
    const cleanupAttempted=Boolean(privateDir||containers.length||networks.length||images.length);
    report.stages.cleanup={status:cleanupAttempted?(failures.length?'FAIL':'PASS'):'NOT_RUN',failures};report.result=failed||failures.length?'FAIL':'PARTIAL_PASS';
    // Partial is deliberate even with all implemented checks passed: no OCI
    // session/checkpoint or real enrollment workflow was exercised.
    await save();process.exitCode=failed||failures.length?1:0;
  }
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--describe')process.stdout.write(JSON.stringify(receipt(),null,2)+'\n');
  else main(process.argv.slice(2)).catch(()=>{process.stderr.write('REHEARSAL_PREFLIGHT_FAILED\n');process.exitCode=1;});
}
