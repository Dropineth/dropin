import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {execFile} from 'node:child_process';
import console from 'node:console';
import {createHash,generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer,request as httpsRequest} from 'node:https';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import process from 'node:process';
import {rootCertificates} from 'node:tls';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {createGuardianAuthorityProvider} from '../services/api/src/child-backend/guardian-authority-provider.ts';
import {stableJson} from '../services/api/src/domain/child-stewardship/store.ts';

const exec=promisify(execFile),script=fileURLToPath(import.meta.url),root=resolve(dirname(script),'..');
const sources=['scripts/guardian-authority-acceptance.mjs','services/api/src/child-backend/guardian-authority-provider.ts',
  'services/api/src/domain/child-stewardship/signature.ts','services/api/src/domain/child-stewardship/store.ts','package-lock.json'];
const closed={kind:'CanopyProofGuardianAuthorityAcceptance/1',productionReady:false,realAuthorityConnected:false,authorizationGranted:false};
let phase='argument-validation';
// Preserve platform transport/security controls; do not propagate unrelated
// application credentials. This is not an independent or hostile-runtime sandbox.
const environmentNames=['PATH','HOME','TMPDIR','TMP','TEMP','SYSTEMROOT','SystemRoot',
  'NODE_OPTIONS','NODE_NO_WARNINGS','NODE_USE_ENV_PROXY','NODE_EXTRA_CA_CERTS','NODE_V8_COVERAGE',
  'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy',
  'SSL_CERT_FILE','SSL_CERT_DIR','CURL_CA_BUNDLE'];
const childEnvironment=()=>Object.fromEntries(environmentNames.filter(name=>process.env[name]!==undefined).map(name=>[name,process.env[name]]));

async function provenance(){
  const git=async(args)=>(await exec('git',args,{cwd:root,env:childEnvironment()})).stdout.trim();
  const sourceSha=await git(['rev-parse','HEAD']),sourceTree=await git(['rev-parse','HEAD^{tree}']);
  assert.match(sourceSha,/^[a-f0-9]{40}$/);assert.match(sourceTree,/^[a-f0-9]{40}$/);
  const hashes=[];for(const path of sources)hashes.push([path,createHash('sha256').update(await readFile(join(root,path))).digest('hex')]);
  return {sourceSha,sourceTree,workingTreeDirty:Boolean(await git(['status','--porcelain'])),
    sourceFingerprint:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),node:process.version};
}

// Only the disposable child uses this process-local CA. No system trust store,
// browser, persistent backend, product route or external service is changed.
async function fixture(){
  phase='fixture-configuration';
  assert.equal(process.env.CANOPYPROOF_AUTHORITY_ACCEPTANCE_CHILD,'synthetic-only');
  const directory=process.env.CANOPYPROOF_AUTHORITY_ACCEPTANCE_DIRECTORY;
  assert.ok(directory&&directory.startsWith(join(tmpdir(),'canopyproof-authority-acceptance-')));
  assert.equal(process.env.NODE_EXTRA_CA_CERTS,join(directory,'ca.crt'));
  assert.equal(process.env.CANOPYPROOF_ACCEPTANCE_SECRET_SENTINEL,undefined);
  assert.equal(process.env.DATABASE_URL,undefined);
  const rootKey=generateKeyPairSync('ed25519'),wrongKey=generateKeyPairSync('ed25519');
  const issuerId='fixture-not-a-real-issuer',keyId='fixture-only-key',audience='fixture-only-backend';
  const scope={sessionId:randomUUID(),childSubjectId:'fixture-child',guardianSubjectId:'fixture-adult',operation:'session',minimumSequence:4};
  let mode='active',saved,wireCalls=0,redirectCalls=0,handlerFailures=0;const nonces=new Set(),cases=[];
  const server=createServer({key:await readFile(join(directory,'server.key')),cert:await readFile(join(directory,'server.crt'))},(request,response)=>{
    void (async()=>{
      if(request.url==='/redirect-target'){redirectCalls++;response.writeHead(503);response.end();return;}
      assert.equal(request.url,'/observe');assert.equal(request.method,'POST');
      const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;assert.ok(size<=4096);chunks.push(chunk);}
      const packet=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.equal(packet.issuerId,issuerId);assert.equal(packet.audience,audience);assert.deepEqual(packet.request,scope);
      assert.equal(nonces.has(packet.nonce),false);nonces.add(packet.nonce);wireCalls++;
      if(mode==='revoked'&&process.env.CANOPYPROOF_AUTHORITY_ACCEPTANCE_FAULT==='handler')throw new Error('intentional fixture self-test');
      if(mode==='redirect'){response.writeHead(302,{location:'/redirect-target'});response.end();return;}
      response.setHeader('content-type','application/json');
      if(mode==='outage'){response.writeHead(503);response.end('{}');return;}
      if(mode==='oversize'){response.end('x'.repeat(16_385));return;}
      if(mode==='malformed'){response.end('not-json');return;}
      if(mode==='stall'){response.writeHead(200);response.flushHeaders();response.write('{');return;}
      if(mode==='replay'){response.end(saved);return;}
      const now=Date.now(),statement={protocol:'CanopyProof-GuardianAuthorityObservation/1',issuerId,keyId,audience,nonce:packet.nonce,request:packet.request,
        issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+20_000).toISOString(),sequence:4,
        relationship:{subjectType:'human-guardian',status:mode==='revoked'?'revoked':'active',validFrom:new Date(now-1000).toISOString(),validUntil:new Date(now+60_000).toISOString()}};
      if(mode==='wrong-operation')statement.request.operation='recovery';
      if(mode==='expired'){statement.issuedAt=new Date(now-30_000).toISOString();statement.expiresAt=new Date(now-1).toISOString();}
      const envelope=JSON.stringify({statement,signature:sign(null,Buffer.from(stableJson(statement)),mode==='wrong-key'?wrongKey.privateKey:rootKey.privateKey).toString('base64url')});
      if(mode==='active')saved=envelope;response.end(envelope);
    })().catch(()=>{handlerFailures++;response.destroy();});
  });
  const close=()=>new Promise(resolveClose=>{if(!server.listening)return resolveClose();server.close(()=>resolveClose());server.closeAllConnections();});
  try{
    await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
    const address=server.address();assert.ok(address&&typeof address==='object');
    const endpoint=`https://127.0.0.1:${address.port}/observe`;
    phase='tls-negative-controls';
    const tlsAttempt=extra=>new Promise((resolveRequest,reject)=>{const request=httpsRequest(endpoint,{method:'POST',...extra},response=>{response.resume();resolveRequest();});request.once('error',reject);request.end('{}');});
    await assert.rejects(tlsAttempt({ca:rootCertificates}),error=>/certificate|issuer|self.signed/i.test(error.message));cases.push('missing-test-ca-rejected');
    await assert.rejects(tlsAttempt({servername:'wrong.synthetic.invalid'}),error=>error.code==='ERR_TLS_CERT_ALTNAME_INVALID');cases.push('wrong-hostname-rejected');
    assert.equal(wireCalls,0,'TLS failures never reach the handler');
    phase='default-closed-check';const unavailable={kind:'unavailable',authorizationGranted:false};
    assert.deepEqual(await createGuardianAuthorityProvider().observe(scope),unavailable);assert.equal(wireCalls,0);cases.push('missing-configuration-no-network');
    const provider=createGuardianAuthorityProvider({configuration:{endpoint,issuerId,keyId,audience,publicKey:rootKey.publicKey.export({type:'spki',format:'pem'}).toString()}});
    phase='positive-attestation';const positive=await provider.observe(scope);assert.equal(positive.kind,'signed-attestation');assert.equal(positive.authorizationGranted,false);cases.push('verified-tls-signed-observation-only');
    for(const failure of ['revoked','wrong-operation','wrong-key','expired','replay','outage','malformed','oversize','redirect','stall']){
      phase=`${failure}-refusal`;mode=failure;const before=wireCalls;assert.deepEqual(await provider.observe(scope),unavailable);assert.equal(wireCalls,before+1,'no automatic retry');cases.push(`${failure}-closed`);
    }
    assert.equal(redirectCalls,0);assert.equal(nonces.size,wireCalls);assert.equal(handlerFailures,0,'fixture failures cannot masquerade as expected refusals');
    phase='shutdown-refusal';await close();assert.deepEqual(await provider.observe(scope),unavailable);cases.push('closed-provider-unavailable');
    return {cases,wireCalls,uniqueNonces:nonces.size,redirectCalls,handlerFailures,listenerClosed:!server.listening,credentialSentinelAbsent:true};
  }finally{await close();}
}

async function main(){
  if(process.argv[2]==='--fixture-child'&&process.argv.length===3){console.log(JSON.stringify(await fixture()));return;}
  const fault=process.argv.length===4&&process.argv[3]==='--self-test-handler-failure';
  if((process.argv.length!==3&&!fault)||process.argv[2]!=='--synthetic-only'){
    console.log(JSON.stringify({...closed,status:'closed',network:'none',error:'EXPLICIT_SYNTHETIC_ONLY_REQUIRED'}));process.exitCode=2;return;
  }
  assert.equal(process.version,'v22.23.5');
  assert.ok(process.env.NODE_TLS_REJECT_UNAUTHORIZED===undefined||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='1','TLS verification disabling is unsupported');
  phase='source-provenance';
  const before=await provenance(),directory=await mkdtemp(join(tmpdir(),'canopyproof-authority-acceptance-'));
  let result;
  try{
    phase='ephemeral-tls-material';
    const openssl=async args=>exec('openssl',args,{cwd:directory,env:childEnvironment(),timeout:10_000,maxBuffer:64*1024});
    await openssl(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','1','-subj','/CN=CanopyProof SYNTHETIC TEST ONLY',
      '-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
    await openssl(['req','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=localhost']);
    await writeFile(join(directory,'extensions'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n');
    await openssl(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out','server.crt','-days','1','-extfile','extensions']);
    // Add the disposable CA without dropping an existing security/proxy CA.
    if(process.env.NODE_EXTRA_CA_CERTS)await writeFile(join(directory,'ca.crt'),Buffer.concat([await readFile(process.env.NODE_EXTRA_CA_CERTS),Buffer.from('\n'),await readFile(join(directory,'ca.crt'))]));
    phase='isolated-wire-matrix';const child=await exec(process.execPath,['--import','tsx',script,'--fixture-child'],{cwd:root,timeout:15_000,maxBuffer:64*1024,
      env:{...childEnvironment(),NODE_EXTRA_CA_CERTS:join(directory,'ca.crt'),CANOPYPROOF_AUTHORITY_ACCEPTANCE_CHILD:'synthetic-only',CANOPYPROOF_AUTHORITY_ACCEPTANCE_DIRECTORY:directory,
        ...(fault?{CANOPYPROOF_AUTHORITY_ACCEPTANCE_FAULT:'handler'}:{})}});
    result=JSON.parse(child.stdout);assert.equal(result.cases.length,15);assert.equal(result.listenerClosed,true);
    phase='source-recheck';assert.deepEqual(await provenance(),before,'source must remain unchanged during acceptance');
  }finally{await rm(directory,{recursive:true,force:true});}
  console.log(JSON.stringify({...closed,status:'synthetic-wire-passed',requestTargets:'loopback-only',networkIsolation:'not-asserted',securityHooks:'preserved',...before,...result,temporaryKeysRemoved:true}));
}
void main().catch(()=>{console.log(JSON.stringify({...closed,status:'failed',phase,error:'SYNTHETIC_ACCEPTANCE_FAILED'}));process.exitCode=1;});
