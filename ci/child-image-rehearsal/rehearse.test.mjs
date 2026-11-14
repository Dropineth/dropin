import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {PIN,receipt,parseTap,imageIdentity,authorityKeys,containerBoundary,safePaths,main} from './rehearse.mjs';

test('plan pins two distinct exact commits/trees and retains NOT_RUN production/per-session claims',()=>{
  assert.match(PIN.candidate,/^[a-f0-9]{40}$/);assert.match(PIN.rollback,/^[a-f0-9]{40}$/);assert.notEqual(PIN.candidate,PIN.rollback);
  assert.notEqual(PIN.candidateTree,PIN.rollbackTree);assert.match(PIN.base,/@sha256:[a-f0-9]{64}$/);assert.match(PIN.postgres,/@sha256:[a-f0-9]{64}$/);
  const report=receipt();assert.ok(Object.values(report.stages).every(value=>value.status==='NOT_RUN'));
  assert.equal(report.ociSignedPerSessionCheckpoint.status,'NOT_RUN');assert.equal(report.productionEnrollment.status,'NOT_RUN');
  for(const key of ['productionReady','authorizationGranted','releaseApproval','productionDeployed'])assert.equal(report[key],false);
});
test('native summary cannot pass on skipped, missing, cancelled or failed tests',()=>{
  const tap='# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0';assert.equal(parseTap(tap).tests,2);
  for(const text of ['',tap.replace('# tests 2','# tests 0'),tap.replace('# fail 0','# fail 1'),tap.replace('# skipped 0','# skipped 1'),tap.replace('# cancelled 0','# cancelled 1'),tap.replace('# pass 2','# pass 1')])assert.throws(()=>parseTap(text));
});
test('immutable image identity refuses moving references and wrong platform',()=>{
  const image={Id:'sha256:'+'a'.repeat(64),Os:'linux',Architecture:'amd64'};assert.equal(imageIdentity(image),image.Id);
  for(const change of [{Id:'latest'},{Id:'sha256:bad'},{Os:'windows'},{Architecture:'arm64'}])assert.throws(()=>imageIdentity({...image,...change}));
});
test('authority fixture receives only its disposable key pair, never database credentials',()=>{
  const credentials={kind:'DisposableChildRehearsalFixture/1',authorityPublicKey:'public',authorityPrivateKey:'private',runtimeDatabaseUrl:'secret',runtimeRole:'role',ownerPassword:'secret'};
  assert.deepEqual(authorityKeys(credentials),{authorityPublicKey:'public',authorityPrivateKey:'private'});
  assert.throws(()=>authorityKeys({...credentials,kind:'unknown'}));
});
test('runtime boundary requires actual image ID, no public port and retained isolation flags',()=>{
  const imageId='sha256:'+'a'.repeat(64);
  const good=()=>({Image:imageId,Config:{User:'node'},HostConfig:{ReadonlyRootfs:true,NetworkMode:'none',Privileged:false,CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PortBindings:{}}});
  containerBoundary(good(),imageId);
  for(const change of [{ReadonlyRootfs:false},{NetworkMode:'host'},{Privileged:true},{CapDrop:[]},{SecurityOpt:[]},{PortBindings:{'10000/tcp':[{HostIp:'0.0.0.0',HostPort:'10000'}]}}]){
    const value=good();Object.assign(value.HostConfig,change);assert.throws(()=>containerBoundary(value,imageId));
  }
  const wrong=good();wrong.Image='sha256:'+'b'.repeat(64);assert.throws(()=>containerBoundary(wrong,imageId));
  const root=good();root.Config.User='root';assert.throws(()=>containerBoundary(root,imageId));
});
test('output cannot overlap either source checkout',()=>{
  safePaths('/a','/b','/output');
  for(const args of [['a','/b','/output'],['/a','/a','/output'],['/a','/b','/a/out'],['/a/sub','/b','/a'],['/a','/b','relative']])assert.throws(()=>safePaths(...args));
});
test('non-hosted preflight creates a truthful failure receipt without executing Docker',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'rehearsal-contract-')),candidate=join(directory,'candidate'),rollback=join(directory,'rollback'),output=join(directory,'out');
  await mkdir(candidate);await mkdir(rollback);
  const prior=process.env.GITHUB_ACTIONS,exit=process.exitCode;delete process.env.GITHUB_ACTIONS;
  try{
    await main([candidate,rollback,output]);const report=JSON.parse(await readFile(join(output,'receipt.json'),'utf8'));
    assert.equal(report.stages.source_preflight.status,'FAIL');assert.equal(report.stages.docker_preflight.status,'NOT_RUN');assert.equal(report.stages.cleanup.status,'NOT_RUN');
    assert.equal(report.result,'FAIL');assert.equal(report.productionReady,false);
    assert.equal(JSON.stringify(report).includes(directory),false);
  }finally{process.exitCode=exit;if(prior===undefined)delete process.env.GITHUB_ACTIONS;else process.env.GITHUB_ACTIONS=prior;await rm(directory,{recursive:true,force:true});}
});
test('standalone source does not deploy, publish, mount host Docker socket or weaken TLS',async()=>{
  const text=await readFile(new URL('./rehearse.mjs',import.meta.url),'utf8');
  for(const forbidden of ['docker push','wrangler deploy','--privileged','NODE_TLS_REJECT_UNAUTHORIZED=0','rejectUnauthorized:false'])assert.equal(text.includes(forbidden),false);
  assert.ok(text.includes("'--host','unix:///var/run/docker.sock'"));
  assert.equal(/source=[^\n]*docker\.sock/.test(text),false);
  assert.ok(text.includes("['network','create','--internal'"));
  assert.ok(text.includes('CHILD_DATABASE_TLS=verify-full'));
});
