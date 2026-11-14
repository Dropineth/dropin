import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import {authorityOnly,startSignedAuthority} from './signed-current-authority.mjs';
import {expectedStatus} from './oci-view-probe.mjs';
const make=()=>{const key=generateKeyPairSync('ed25519'),sessionId=randomUUID();return{
  kind:'SyntheticOciSessionFixture/1',environment:'SIMULATION_ONLY',audience:'canopyproof:synthetic:child-backend',sessionId,
  transportPrivateKey:key.privateKey.export({type:'pkcs8',format:'pem'}).toString(),transportPublicKey:key.publicKey.export({type:'spki',format:'pem'}).toString(),
  current:{anchor:{sessionId,sequence:1},registry:{keys:[]}},runtimeDatabaseUrl:'never-copy',verifierDatabaseUrl:'never-copy',tokens:{child:'never-copy'},quorumPrivateKeys:['never-copy']};};
test('authority-only projection excludes all DB, bearer, quorum private material',()=>{
  const value=authorityOnly(make());assert.deepEqual(Object.keys(value).sort(),['audience','current','environment','kind','sessionId','transportPrivateKey','transportPublicKey'].sort());
  assert.equal(JSON.stringify(value).includes('never-copy'),false);
});
test('fixture projection rejects non-synthetic scope and mismatched signing roots',()=>{
  for(const patch of [{kind:'unknown'},{environment:'production'},{audience:'real:authority'},{transportPublicKey:make().transportPublicKey}])assert.throws(()=>authorityOnly({...make(),...patch}));
});
test('arbitrary network listen targets and unconfirmed wildcard fail before loading code',async()=>{
  for(const host of ['example.com','10.1.1.1','0.0.0.0'])await assert.rejects(startSignedAuthority({host,app:'/nonexistent',fixture:make(),tls:{}}),/TEST_LISTENER_BOUNDARY_REQUIRED/);
});
test('OCI expectation modes cannot promote an unimplemented or negative case to success',()=>{
  assert.equal(expectedStatus('valid'),200);
  for(const mode of ['before-admission','revoked','expired','unavailable','advanced-floor'])assert.equal(expectedStatus(mode),503);
  for(const mode of ['production','enrolled','',undefined])assert.throws(()=>expectedStatus(mode));
});
test('no opt-in rejects without network or output writes',async()=>{
  const run=promisify(execFile);await assert.rejects(run(process.execPath,[new URL('./rehearse.mjs',import.meta.url).pathname]),error=>error.code===1&&error.stdout===''&&error.stderr.trim()==='REHEARSAL_PREFLIGHT_FAILED');
});
test('existing output is never overwritten, even on rejection',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'signed-current-contract-')),receipt=join(dir,'receipt.json');await writeFile(receipt,'KEEP');
  try{await assert.rejects(promisify(execFile)(process.execPath,[new URL('./rehearse.mjs',import.meta.url).pathname,'/tmp','/workspace',dir]),error=>error.code===1&&error.stderr.trim()==='REHEARSAL_PREFLIGHT_FAILED');assert.equal(await readFile(receipt,'utf8'),'KEEP');}
  finally{await rm(dir,{recursive:true,force:true});}
});
