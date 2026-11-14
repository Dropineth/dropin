import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {chmod,copyFile,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,dirname} from 'node:path';
import process from 'node:process';
import {createServer,createConnection,isIPv4} from 'node:net';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {authorityOnly} from './signed-current-authority.mjs';
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
export const PIN=Object.freeze({
  candidate:'0e3d33b36beac4502488b18a0707c17fd34062e5',candidateTree:'b21c6879460663eb391e94d281cbcb0b042c1dfb',
  rollback:'1d2efaa5258b70ed9f815af0ebf7109443734e59',rollbackTree:'3127db96e31d75a6f6a69430d66739f58cc35d76',
  node:'v22.23.5',base:'docker.io/library/node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee',
  postgres:'docker.io/library/postgres:17.12@sha256:dbb9623d5121b5d2c2c9e2fba56e40193cbb3510d4af7f035b1ab1823aff3205',
});
const stages=['source_preflight','docker_preflight','build_candidate','build_rollback','candidate_closed_http','rollback_closed_http',
  'private_environment','private_postgres','native_dependencies','native_synthetic_lifecycle','prepare_session','signed_authority',
  'combined_candidate_readiness','postgres_tls_observed','combined_tls_hostname_denial','before_admission','signed_sql_admission','candidate_valid',
  'revoked_denied','revoked_healthy_control','expired_denied','expired_healthy_control','unavailable_denied','unavailable_healthy_control',
  'rollback_data_baseline','candidate_stop','backup_before_migration','append_outbox_hold','prior_image_rejects_migrated_db','restore_to_separate_database','verify_restored_snapshot','configure_rollback_target','advance_floor_before_restore_probe','combined_rollback_readiness','rollback_data_invariants',
  'rollback_advanced_floor_denied','rollback_stop',
  'source_recheck','cleanup'];
export function receipt(){return {kind:'CanopyProofHostedSeparateDatabaseRehearsal/1',candidateSha:PIN.candidate,rollbackSha:PIN.rollback,
  scope:'isolated-synthetic-signed-session-rehearsal',stages:Object.fromEntries(stages.map(name=>[name,{status:'NOT_RUN'}])),
  ociSignedPerSessionCheckpoint:{status:'NOT_RUN'},productionEnrollment:{status:'NOT_RUN',reason:'Real enrollment must remain unavailable.'},
  crossServiceWritesRevocationRace:{status:'NOT_RUN'},productionFinality:{status:'NOT_RUN'},
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
async function openPrivateRelay(target,port){
  assert.ok([5432,8443].includes(port));
  await new Promise((resolve,reject)=>{
    const socket=createConnection({host:target,port});
    socket.setTimeout(4000,()=>socket.destroy(new Error('PRIVATE_PG_CONNECT_TIMEOUT')));
    socket.once('error',reject);
    socket.once('connect',()=>{socket.destroy();resolve();});
  });
  const sockets=new Set();
  const server=createServer(client=>{
    if(client.remoteAddress!=='127.0.0.1'||sockets.size>=48){client.destroy();return;}
    const upstream=createConnection({host:target,port});
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
  const report=receipt();let privateDir,pgRelay,authorityRelay;const containers=[],networks=[],images=[];let active='source_preflight';
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
  const probeCode=`const assert=require('node:assert/strict');(async()=>{let r;for(let i=0;i<100;i++){try{r=await fetch('http://127.0.0.1:10000/health/live');if(r.status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.equal(r?.status,200);const live=await r.json();assert.equal(live.sourceSha,process.argv[1]);assert.equal(live.realCapabilities,false);assert.equal(live.syntheticOnly,true);const ready=await fetch('http://127.0.0.1:10000/health/ready');assert.equal(ready.status,Number(process.argv[2]));const state=await ready.json();assert.equal(state.realCapabilities,false);if(process.argv[2]==='200')assert.equal(state.accountEntry,'synthetic-only');for(const path of ['guardian/passkeys/register','guardian/passkeys/recover','demo-sessions']){const denied=await fetch('http://127.0.0.1:10000/canopyproof/child-stewardship/v1/'+path,{method:'POST'});assert.equal(denied.status,503);}assert.notEqual(process.getuid(),0);assert.equal(process.version,'v22.23.5');console.log(JSON.stringify({sourceSha:live.sourceSha,node:process.version,uid:process.getuid(),readiness:ready.status,accountEntry:state.accountEntry,realCapabilities:false,enrollmentDenied:true}));})().catch(()=>process.exit(1));`;
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
      await writeFile(join(tls,`${name}.ext`),`subjectAltName=DNS:rehearsal-${name}${name==='authority'?',IP:127.0.0.1':''}\nextendedKeyUsage=serverAuth\n`,{mode:0o600});
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
      pgRelay=await openPrivateRelay(target,5432);
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
    const fixtureFile=join(privateDir,'session.json'),tsx=join(app,'node_modules/tsx/dist/loader.mjs');
    const fixtureEnv={REHEARSAL_DATABASE_URL:dbUrl,REHEARSAL_CONFIRM:'disposable-local-synthetic'};
    const helper=(script,argv,env={})=>run(process.execPath,['--import',tsx,join(here,script),...argv],{env:{...fixtureEnv,...env}});
    await stage('prepare_session',async()=>{await helper('prepare-session.mjs',['prepare',app,fixtureFile]);return {syntheticSubjectsOnly:true,exactMigrations:true,distinctOwnerRuntimeVerifier:true};});
    const fixture=JSON.parse(await readFile(fixtureFile,'utf8'));
    const authority=await stage('signed_authority',async()=>{
      const authorityDir=join(privateDir,'authority'),toolDir=join(privateDir,'authority-tools');
      await mkdir(authorityDir,{mode:0o700});await mkdir(toolDir,{mode:0o700});
      for(const name of ['authority.crt','authority.key'])await copyFile(join(tls,name),join(authorityDir,name));
      await writeFile(join(authorityDir,'authority.json'),JSON.stringify(authorityOnly(fixture)),{mode:0o600});
      for(const name of ['signed-current-authority.mjs','authority-container.mjs','authority-control.mjs','authority-control-client.mjs'])await copyFile(join(here,name),join(toolDir,name));
      const id=await start(['--network',networkName,'--network-alias','rehearsal-authority','--user',`${process.getuid()}:${process.getgid()}`,...common,
        '--tmpfs',`/tmp:rw,nosuid,noexec,size=8m,mode=0700,uid=${process.getuid()},gid=${process.getgid()}`,
        '--mount',`type=bind,source=${authorityDir},target=/fixture,readonly`,
        '--mount',`type=bind,source=${toolDir},target=/tools,readonly`,
        '--mount',`type=bind,source=${app},target=/candidate,readonly`,
        PIN.base,'node','--import','/candidate/node_modules/tsx/dist/loader.mjs','/tools/authority-container.mjs']);
      containerBoundary(await inspect('container',id),imageIdentity(await inspect('image',PIN.base)),{network:networkName,user:`${process.getuid()}:${process.getgid()}`});
      let ready=false;for(let i=0;i<60;i++){try{const r=JSON.parse(await docker(['exec',id,'node','/tools/authority-control-client.mjs','metrics']));if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
      assert.ok(ready,'AUTHORITY_FIXTURE_NOT_READY');
      const target=privateContainerAddress(await inspect('container',id),networkName,privateNet.networkId);
      authorityRelay=await openPrivateRelay(target,8443);
      return {containerId:id,privateHttps:true,control:'private-unix-socket-via-docker-exec-only',dockerPortsPublished:false,hostVerifierRelay:'127.0.0.1-only'};
    });
    const control=async command=>{const result=JSON.parse(await docker(['exec',authority.containerId,'node','/tools/authority-control-client.mjs',command]));assert.equal(result.ok,true);return result;};
    const metrics=async()=>{const m=(await control('metrics')).metrics;assert.equal(m.handlerErrors,0);assert.ok(Number.isSafeInteger(m.currentRequests));return m;};
    const runtimeUrl=new URL(fixture.runtimeDatabaseUrl);assert.equal(runtimeUrl.hostname,'127.0.0.1');runtimeUrl.hostname='rehearsal-pg';runtimeUrl.port='5432';
    const envFile=join(privateDir,'backend.env');
    await writeFile(envFile,`CHILD_BACKEND_MODE=synthetic-demo\nCHILD_DATABASE_TLS=verify-full\nCHILD_DATABASE_URL=${runtimeUrl}\nCHILD_CURRENT_AUTHORITY_URL=https://rehearsal-authority:8443/current\nNODE_EXTRA_CA_CERTS=/rehearsal-ca.crt\n`,{mode:0o600});
    const tokenFile=join(privateDir,'session-access.json');
    // Public-readable file permissions only inside a private host directory and
    // this exact image's read-only file mount, so the image's node UID can read it.
    await writeFile(tokenFile,JSON.stringify({kind:'SyntheticOciSessionAccess/1',environment:'SIMULATION_ONLY',childToken:fixture.tokens.child}),{mode:0o644});
    const combined=async(imageId,sha,{file=envFile,status=200}={})=>{
      const id=await start(['--network',networkName,...common,'--env-file',file,'-e',`CHILD_CURRENT_AUTHORITY_PUBLIC_KEY=${fixture.transportPublicKey}`,
        '--mount',`type=bind,source=${join(tls,'ca.crt')},target=/rehearsal-ca.crt,readonly`,
        '--mount',`type=bind,source=${tokenFile},target=/rehearsal/session-access.json,readonly`,
        '--mount',`type=bind,source=${join(here,'oci-view-probe.mjs')},target=/rehearsal/oci-view-probe.mjs,readonly`,imageId]);
      containerBoundary(await inspect('container',id),imageId,{network:networkName});return {id,observed:await probe(id,sha,status)};
    };
    const sessionProbe=async(id,sha,mode)=>{
      const before=await metrics();
      const observed=JSON.parse(await docker(['exec',id,'node','/rehearsal/oci-view-probe.mjs',mode,sha]));
      const after=await metrics(),calls=after.currentRequests-before.currentRequests;
      assert.ok(calls>0,'FRESH_AUTHORITY_READ_REQUIRED');
      return {...observed,authorityCallCountVerified:true,actualHttpsRequests:calls,sourceSha:sha};
    };
    const current=await stage('combined_candidate_readiness',async()=>{const value=await combined(candidateImage,PIN.candidate);return {containerId:value.id,...value.observed,imageId:candidateImage};});
    await stage('postgres_tls_observed',async()=>{const file=join(privateDir,'tls-observed.json');await helper('inspect-session.mjs',['tls',app,fixtureFile,file]);return JSON.parse(await readFile(file,'utf8'));});
    await stage('combined_tls_hostname_denial',async()=>{
      const file=join(privateDir,'wrong-host.env');await writeFile(file,(await readFile(envFile,'utf8')).replace('@rehearsal-pg:', '@rehearsal-pg-wrong:'),{mode:0o600});
      const denied=await combined(candidateImage,PIN.candidate,{file,status:503});await stop(denied.id);return {...denied.observed,resolvableSameDbWrongSan:true};
    });
    await stage('before_admission',()=>sessionProbe(current.containerId,PIN.candidate,'before-admission'));
    await stage('signed_sql_admission',async()=>{
      const trust=join(privateDir,'verifier-trust.pem'),result=join(privateDir,'admission.json');
      const ambient=process.env.NODE_EXTRA_CA_CERTS?await readFile(process.env.NODE_EXTRA_CA_CERTS):Buffer.alloc(0);
      await writeFile(trust,Buffer.concat([ambient,Buffer.from('\n'),await readFile(join(tls,'ca.crt'))]),{mode:0o600});
      const before=await metrics();
      await helper('prepare-session.mjs',['admit',app,fixtureFile,`https://127.0.0.1:${authorityRelay.port}/current`,result],{NODE_EXTRA_CA_CERTS:trust});
      const after=await metrics();assert.ok(after.currentRequests>before.currentRequests);
      return {...JSON.parse(await readFile(result,'utf8')),actualHttpsRequests:after.currentRequests-before.currentRequests};
    });
    await stage('candidate_valid',()=>sessionProbe(current.containerId,PIN.candidate,'valid'));
    for(const mode of ['revoked','expired','unavailable']){
      await stage(`${mode}_denied`,async()=>{await control(mode);return sessionProbe(current.containerId,PIN.candidate,mode);});
      await stage(`${mode}_healthy_control`,async()=>{await control('healthy');return sessionProbe(current.containerId,PIN.candidate,'valid');});
    }
    const snapshot=async (name,mode='snapshot')=>{const file=join(privateDir,`${name}.json`);await helper('inspect-session.mjs',[mode,app,file]);return JSON.parse(await readFile(file,'utf8'));};
    let before;
    await stage('rollback_data_baseline',async()=>{before=await snapshot('before-switch');return {snapshot:before};});
    await stage('candidate_stop',async()=>{await stop(current.containerId);return {cleanExit:true};});
    const pgcmd=(name,...args)=>docker(['exec',pg.containerId,name,...args]);
    const pgQuery=(db,sql)=>pgcmd('psql','-X','-v','ON_ERROR_STOP=1','-U','rehearsal_admin','-d',db,'-Atc',sql);
    const pgFrom='rehearsal_session_test',pgTo='rehearsal_separate_test',dump='/tmp/rehearsal-pre-migration.dump';
    const owner=new URL(fixture.ownerDatabaseUrl).username;
    assert.match(owner,/^oci_owner_[a-f0-9]{24}$/);
    assert.match(fixture.runtimeRole,/^oci_runtime_[a-f0-9]{24}$/);
    await stage('backup_before_migration',async()=>{
      await pgcmd('pg_dump','-U','rehearsal_admin','-Fc','-f',dump,pgFrom);
      const hash=(await pgcmd('sha256sum',dump)).split(' ')[0];assert.match(hash,/^[a-f0-9]{64}$/);
      return {sha256:hash,disposableDatabase:true};
    });
    await stage('append_outbox_hold',async()=>{
      const patch=join(here,'closed-delivery.patch');
      assert.equal(digest(await readFile(patch)), 'dd6c6dc32332016de12dd6f9da7a5f0a0c0ac2c59b220e1061be50c2872873a0');
      const scratch=join(privateDir,'patched');
      await mkdir(scratch,{mode:0o700});
      // Copy exact committed inputs from the pinned source without changing it.
      const target=join(scratch,'dropin-earth/services/api');
      for(const part of ['prisma','src/child-backend']) await mkdir(join(target,part),{recursive:true});
      for(const name of (await run('git',['ls-files','dropin-earth/services/api/prisma'],{cwd:candidate})).split('\n')){
        assert.match(name,/^dropin-earth\/services\/api\/prisma\/[a-zA-Z0-9_.-]+$/);
        await copyFile(join(candidate,name),join(scratch,name));
      }
      await copyFile(join(app,'services/api/src/child-backend/migrations.ts'),join(target,'src/child-backend/migrations.ts'));
      await run('git',['apply',patch],{cwd:scratch});
      const result=JSON.parse(await helper('apply-disposable-migration.mjs',[app,target,fixtureFile]));
      assert.equal(await pgQuery(pgFrom,"SELECT count(*) FROM child_stewardship.outbox WHERE event_id='hosted-pending' AND delivered_at IS NULL"),'1');
      return {...result,pendingPreserved:true,patchedMigratorHostedNotImage:true};
    });
    await stage('prior_image_rejects_migrated_db',async()=>{
      const denied=await combined(rollbackImage,PIN.rollback,{status:503});
      await stop(denied.id);return denied.observed;
    });
    const separateEnv=join(privateDir,'rollback.env');
    await stage('restore_to_separate_database',async()=>{
      await pgcmd('createdb','-U','rehearsal_admin','-O',owner,pgTo);
      const distinct=await pgQuery('rehearsal_native_test',"SELECT count(DISTINCT oid) FROM pg_database WHERE datname IN ('rehearsal_session_test','rehearsal_separate_test')");
      if(distinct!=='2')throw Object.assign(new Error('DISTINCT_DATABASE_REQUIRED'),{code:'DISTINCT_DATABASE_REQUIRED'});
      await pgcmd('pg_restore','-U','rehearsal_admin','--single-transaction','--exit-on-error','-d',pgTo,dump);
      await pgQuery(pgTo,`REVOKE ALL ON DATABASE ${pgTo} FROM PUBLIC; GRANT CONNECT ON DATABASE ${pgTo} TO ${fixture.runtimeRole}`);
      return {distinctDatabase:true,logicalRestore:true,deliveryConsumerStarted:false,deliveryReceiverConfigured:false};
    });
    await stage('verify_restored_snapshot',async()=>{
      try{
        assert.deepEqual(await snapshot('restored-before-application','snapshot-restored'),before);
      }catch(e){
        const actual=e?.actual;
        if(e?.code!=='ERR_ASSERTION'||!Array.isArray(actual?.tables))throw e;
        const schemaMismatch=actual.schemaSha256!==before.schemaSha256;
        const dataMismatch=actual.dataSha256!==before.dataSha256;
        const prior=new Map(before.tables.map(t=>[t.table,t])), restored=new Map(actual.tables.map(t=>[t.table,t]));
        const changed=[...new Set([...prior.keys(),...restored.keys()])].filter(k=>{
          const a=prior.get(k),b=restored.get(k);return a?.count!==b?.count||a?.sha256!==b?.sha256;
        }).filter(k=>/^(child_stewardship(?:_webauthn|_guardian)?|child_backend_migrations)\.[a-z_]+$/.test(k)).slice(0,20);
        throw Object.assign(new Error('RESTORED_SNAPSHOT_MISMATCH'),{code:'RESTORED_SNAPSHOT_MISMATCH',restoreDiagnostic:{schemaMismatch,dataMismatch,changedTables:changed}});
      }
      return {schemaMatch:true,dataMatch:true};
    });
    await stage('configure_rollback_target',async()=>{
      const alternate=new URL(runtimeUrl);
      assert.equal(alternate.pathname,'/'+pgFrom);
      alternate.pathname='/'+pgTo;
      const text=await readFile(envFile,'utf8');
      const entry='CHILD_DATABASE_URL='+runtimeUrl.toString();
      const lines=text.split('\n');assert.equal(lines.filter(line=>line===entry).length,1);
      await writeFile(separateEnv,lines.map(line=>line===entry?'CHILD_DATABASE_URL='+alternate.toString():line).join('\n'),{mode:0o600});
      return {targetDatabase:pgTo,deliveryConsumerStarted:false,deliveryReceiverConfigured:false};
    });
    await stage('advance_floor_before_restore_probe',async()=>{const result=await control('advance-floor');assert.equal(result.sequence,2);return {sequence:2};});
    const older=await stage('combined_rollback_readiness',async()=>{const value=await combined(rollbackImage,PIN.rollback,{file:separateEnv});return {containerId:value.id,...value.observed,imageId:rollbackImage,sameDatabase:false};});
    await stage('rollback_advanced_floor_denied',()=>sessionProbe(older.containerId,PIN.rollback,'advanced-floor'));
    await stage('rollback_data_invariants',async()=>{
      const check="SELECT count(*) FROM child_stewardship.outbox WHERE event_id='hosted-pending' AND delivered_at IS NULL";
      assert.equal(await pgQuery(pgTo,check),'1');assert.equal(await pgQuery(pgFrom,check),'1');
      const constraints="SELECT count(*) FROM pg_constraint WHERE conname='child_outbox_delivery_closed'";
      assert.equal(await pgQuery(pgFrom,constraints),'1');assert.equal(await pgQuery(pgTo,constraints),'0');
      return {pendingPreservedInBothDatabases:true,restoreRetainsPriorSchema:true,externalDispatch:'NOT_RUN'};
    });
    await stage('rollback_stop',async()=>{await stop(older.containerId);return {cleanExit:true};});
    report.ociSignedPerSessionCheckpoint={status:'PASS',scope:'isolated OCI images against separate PostgreSQL databases with synthetic signed HTTPS; patched migrator ran on the host, not in an image',productionReady:false};
    await stage('source_recheck',async()=>{await source(candidate,PIN.candidate,PIN.candidateTree);await source(rollback,PIN.rollback,PIN.rollbackTree);return {unchanged:true};});
  }catch(error){failed=true;report.stages[active]={status:'FAIL',errorCode:typeof error?.code==='string'?error.code:'ASSERTION_OR_COMMAND_FAILED',outcomeUncertain:Boolean(error?.killed),...(active==='verify_restored_snapshot'&&error?.code==='RESTORED_SNAPSHOT_MISMATCH'?{diagnostic:error.restoreDiagnostic}:{}),...(active==='private_postgres'&&error?.code==='POSTGRES_REHEARSAL_STAGE_FAILED'?{diagnostic:error.diagnostic}:{})};}
  finally{
    const failures=[];
    if(authorityRelay){try{await authorityRelay.close();}catch{failures.push('authority-loopback-relay');}}
    if(pgRelay){try{await pgRelay.close();}catch{failures.push('loopback-relay');}}
    for(const id of containers.reverse()){try{await docker(['rm','--force','--volumes',id]);}catch{failures.push('container');}}
    for(const id of networks.reverse()){try{await docker(['network','rm',id]);}catch{failures.push('network');}}
    for(const id of [...new Set(images)]){try{await docker(['image','rm',id]);}catch{failures.push('image');}}
    if(privateDir){try{await rm(privateDir,{recursive:true,force:true});}catch{failures.push('private-files');}}
    const cleanupAttempted=Boolean(privateDir||containers.length||networks.length||images.length);
    report.stages.cleanup={status:cleanupAttempted?(failures.length?'FAIL':'PASS'):'NOT_RUN',failures};report.result=failed||failures.length?'FAIL':'PARTIAL_PASS';
    // Partial remains deliberate: synthetic read-flow proof is neither real
    // enrollment, cross-service write fencing nor production finality.
    await save();process.exitCode=failed||failures.length?1:0;
  }
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--describe')process.stdout.write(JSON.stringify(receipt(),null,2)+'\n');
  else main(process.argv.slice(2)).catch(()=>{process.stderr.write('REHEARSAL_PREFLIGHT_FAILED\n');process.exitCode=1;});
}
