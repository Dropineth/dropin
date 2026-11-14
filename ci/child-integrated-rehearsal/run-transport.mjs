import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmod,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
const TREE='b21c6879460663eb391e94d281cbcb0b042c1dfb',CANDIDATE='0e3d33b36beac4502488b18a0707c17fd34062e5';
const operational=['PATH','HOME','TMPDIR','TMP','TEMP','NODE_OPTIONS','NODE_USE_ENV_PROXY','NODE_EXTRA_CA_CERTS',
  'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR','CURL_CA_BUNDLE'];
const cleanEnv=()=>Object.fromEntries(operational.filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
let output,outputOwned=false,temporary,report={kind:'SyntheticSignedHttpsAcceptance/1',status:'NOT_RUN',candidate:CANDIDATE,sourceTree:TREE,
  ociPerSession:'NOT_RUN',sqlAdmission:'NOT_RUN',crossServiceWritesRevocationRace:'NOT_RUN',productionFinality:'NOT_RUN',
  realAuthorityConnected:false,productionReady:false,authorizationGranted:false};
try{
  const [consent,root,out]=process.argv.slice(2);assert.equal(process.argv.length,5);
  assert.equal(consent,'--synthetic-only');assert.ok(isAbsolute(root)&&isAbsolute(out));
  assert.equal(process.version,'v22.23.5');assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED,'0');
  const repo=await realpath(root),app=join(repo,'dropin-earth');output=resolve(out);
  assert.ok(!output.startsWith(repo+'/')&&!repo.startsWith(output+'/')&&repo!==output);
  await mkdir(output,{mode:0o700});outputOwned=true;temporary=await mkdtemp(join(output,'.tls-'));await chmod(temporary,0o700);
  const run=async(file,args,options={})=>(await exec(file,args,{cwd:repo,env:cleanEnv(),timeout:60_000,maxBuffer:1024*1024,...options})).stdout.trim();
  const source=async()=>{assert.equal(await run('git',['rev-parse','HEAD^{tree}']),TREE);assert.equal(await run('git',['status','--porcelain','--untracked-files=all']),'');};
  await source();report.actualCheckoutSha=await run('git',['rev-parse','HEAD']);report.sourceIdentity='exact-tree-equivalent-not-claiming-same-commit';
  await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Disposable signed current authority CA','-keyout',join(temporary,'ca.key'),'-out',join(temporary,'ca.crt')]);
  await run('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout',join(temporary,'server.key'),'-out',join(temporary,'server.csr')]);
  await writeFile(join(temporary,'server.ext'),'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n',{mode:0o600});
  await run('openssl',['x509','-req','-days','1','-in',join(temporary,'server.csr'),'-CA',join(temporary,'ca.crt'),'-CAkey',join(temporary,'ca.key'),'-CAcreateserial','-extfile',join(temporary,'server.ext'),'-out',join(temporary,'server.crt')]);
  // Preserve any existing public extra trust roots, without changing system trust.
  const extra=process.env.NODE_EXTRA_CA_CERTS?await readFile(process.env.NODE_EXTRA_CA_CERTS):Buffer.alloc(0);
  await writeFile(join(temporary,'trust.pem'),Buffer.concat([extra,Buffer.from('\n'),await readFile(join(temporary,'ca.crt'))]),{mode:0o600});
  const text=await run(process.execPath,['--import',join(app,'node_modules/tsx/dist/loader.mjs'),join(here,'transport-matrix.mjs'),app,temporary],
    {env:{...cleanEnv(),NODE_EXTRA_CA_CERTS:join(temporary,'trust.pem')}});
  const result=JSON.parse(text);assert.equal(result.cases.length,11);assert.ok(result.cases.every(c=>c.status==='PASS'));
  await source();report={...report,status:'PASS',node:process.version,transport:result};
  const files=['integrations/cai/synthetic-current-authority.ts','services/api/src/child-backend/current-authority.ts','package-lock.json'];
  report.sourceHashes={};for(const path of files)report.sourceHashes[path]=createHash('sha256').update(await readFile(join(app,path))).digest('hex');
}catch{report.status='FAIL';report.error='SYNTHETIC_TRANSPORT_ACCEPTANCE_FAILED';process.exitCode=1;}
finally{
  if(temporary)try{await rm(temporary,{recursive:true,force:true});report.privateFixtureCleanup='PASS';}catch{report.privateFixtureCleanup='FAIL';report.status='FAIL';process.exitCode=1;}
  if(outputOwned)await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify(report)+'\n');
}
