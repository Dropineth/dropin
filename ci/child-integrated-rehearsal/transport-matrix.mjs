import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {request as httpsRequest} from 'node:https';
import {rootCertificates} from 'node:tls';
import {startSignedAuthority} from './signed-current-authority.mjs';
import {signedFixture} from './prepare-session.mjs';

// Invoked by run-transport.mjs in a child which alone trusts the disposable CA.
const [app,tlsDir]=process.argv.slice(2);
const sessionId=randomUUID();
const {stableJson,childDigest}=await import(pathToFileURL(join(app,'services/api/src/domain/child-stewardship/store.ts')).href);
const fixture={kind:'SyntheticOciSessionFixture/1',environment:'SIMULATION_ONLY',audience:'canopyproof:synthetic:child-backend',sessionId,
  ...signedFixture({sessionId,roots:{canonical:'a'.repeat(64),security:'b'.repeat(64),privacy:'c'.repeat(64)},stableJson,childDigest})};
const {currentAuthorityClient}=await import(pathToFileURL(join(app,'services/api/src/child-backend/current-authority.ts')).href);
const tls={key:await readFile(join(tlsDir,'server.key')),cert:await readFile(join(tlsDir,'server.crt'))};
const server=await startSignedAuthority({app,fixture,tls});
const read=currentAuthorityClient({url:server.endpoint,publicKey:server.publicKey,audience:fixture.audience});
const cases=[];
const tlsDenied=async(name,options,expected)=>{
  const before=server.metrics().currentRequests;
  const code=await new Promise(resolve=>{
    const request=httpsRequest(server.endpoint,{...options,method:'POST',timeout:2000},response=>{response.resume();resolve('UNEXPECTED_HTTP_RESPONSE');});
    request.on('error',error=>resolve(error.code));request.on('timeout',()=>request.destroy());request.end('{}');
  });
  assert.ok(expected.includes(code),name);assert.equal(server.metrics().currentRequests,before);
  cases.push({name,status:'PASS',actualHttpsCalls:0,tlsHandshake:'rejected-before-handler',errorCode:code});
};
const run=async(name,mode,rejected=false)=>{
  server.setMode(mode);const before=server.metrics();
  if(rejected)await assert.rejects(read(sessionId),/CURRENT_RESTORE_AUTHORITY_UNAVAILABLE/);
  else assert.equal((await read(sessionId)).anchor.sequence,1);
  const after=server.metrics();assert.equal(after.currentRequests,before.currentRequests+1);
  assert.equal(after.handlerErrors,0);cases.push({name,status:'PASS',actualHttpsCalls:1,readerResult:rejected?'unavailable':'verified-synthetic-read'});
};
try{
  await tlsDenied('untrusted_ca_denied',{ca:rootCertificates},['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','SELF_SIGNED_CERT_IN_CHAIN']);
  await tlsDenied('wrong_hostname_denied',{servername:'not-in-rehearsal-san.invalid'},['ERR_TLS_CERT_ALTNAME_INVALID']);
  await run('unavailable_before_baseline','unavailable',true);
  await run('valid_signed_baseline','healthy');
  for(const mode of ['revoked','expired','unavailable']){
    await run(`${mode}_denied`,mode,true);
    await run(`${mode}_healthy_control`,'healthy');
  }
  const before=server.metrics().currentRequests;
  assert.equal(server.advanceFloor(),2);
  assert.equal((await read(sessionId)).anchor.sequence,2,'wire floor advances, not a SQL admission');
  assert.equal(server.metrics().currentRequests,before+1);
  assert.throws(()=>server.advanceFloor(),/FLOOR_CAN_ONLY_ADVANCE_ONCE/);
  cases.push({name:'advanced_floor_propagated_without_reset',status:'PASS',actualHttpsCalls:1,readerResult:'sequence-2-not-admission'});
  const observed=server.metrics();assert.equal(observed.handlerErrors,0);
  assert.equal(observed.currentRequests,9);assert.equal(observed.signedResponses,7);assert.equal(observed.uniqueNonces,7);
  await server.stop();
  process.stdout.write(JSON.stringify({kind:'SyntheticSignedHttpsTransport/1',cases,metrics:observed,
    listener:'127.0.0.1-only',nativeFetch:true,tlsVerification:true,reusedRepositoryProvider:true,
    reusedRepositoryCurrentReader:true,fixtureAnchorOnly:true,sqlAdmission:'NOT_RUN',ociPerSession:'NOT_RUN',
    advancedFloorSqlDenial:'NOT_RUN',crossServiceWritesRevocationRace:'NOT_RUN',productionFinality:'NOT_RUN',
    realAuthorityConnected:false,authorizationGranted:false,productionReady:false})+'\n');
}catch{await server.stop().catch(()=>{});process.stderr.write('SYNTHETIC_TRANSPORT_MATRIX_FAILED\n');process.exitCode=1;}
