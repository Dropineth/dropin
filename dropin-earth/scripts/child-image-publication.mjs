import assert from 'node:assert/strict';
import console from 'node:console';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import process from 'node:process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const exec=promisify(execFile);
export const SOURCES=Object.freeze({candidate:'dbb6d991bc5d34bbed7946c6b548d904c4a4e9b0',rollback:'1d2efaa5258b70ed9f815af0ebf7109443734e59'});
const REPOSITORY='Dropineth/dropin',BRANCH='refs/heads/release/child-images-20261115';
const IMAGE='ghcr.io/dropineth/canopyproof-child-backend';
const BASE='docker.io/library/node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee';
export const MIGRATIONS=Object.freeze(['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-privacy.sql','child-stewardship-webauthn.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql','child-stewardship-rate-limit.sql','child-stewardship-media.sql','child-stewardship-agent-gateway.sql','child-stewardship-guardian-sessions.sql','child-stewardship-restore.sql','child-stewardship-restore-registry.sql']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const command=async(binary,args,cwd,timeout=30000)=>(await exec(binary,args,{cwd,timeout,maxBuffer:32*1024*1024})).stdout.trim();
const docker=(args,timeout)=>command('docker',args,undefined,timeout);
const git=(args,cwd)=>command('git',args,cwd);
const json=async file=>JSON.parse(await readFile(file,'utf8'));
export function validateReceipt(receipt,runId,workflowSha){
 assert.equal(receipt.kind,'CanopyProofPublishedClosedImages/1');assert.equal(receipt.status,'PASS');
 assert.equal(receipt.repository,REPOSITORY);assert.equal(receipt.runId,runId);assert.equal(receipt.workflowSha,workflowSha);
 assert.equal(receipt.scope,'registry-publication-and-closed-probe');
 assert.equal(receipt.productionDeployed,false);assert.equal(receipt.productionReady,false);assert.equal(receipt.realEnrollment,false);
 assert.deepEqual(Object.keys(receipt.images).sort(),['candidate','rollback']);
 for(const [role,sha]of Object.entries(SOURCES)){
  const item=receipt.images[role];assert.equal(item.sourceSha,sha);assert.equal(item.platform,'linux/amd64');assert.equal(item.baseImage,BASE);
  assert.match(item.registryDigest,/^sha256:[a-f0-9]{64}$/);assert.match(item.imageId,/^sha256:[a-f0-9]{64}$/);
  assert.equal(item.image,`${IMAGE}@${item.registryDigest}`);assert.match(item.sourceTree,/^[a-f0-9]{40}$/);
  assert.match(item.buildManifestSha256,/^[a-f0-9]{64}$/);assert.match(item.sourceFingerprint,/^[a-f0-9]{64}$/);
  assert.deepEqual(item.migrations.map(x=>x.name),MIGRATIONS);item.migrations.forEach(x=>assert.match(x.digest,/^[a-f0-9]{64}$/));
  for(const name of ['server.mjs','migrate.mjs'])assert.match(item.bundleHashes[name],/^[a-f0-9]{64}$/);
 }
 assert.notEqual(receipt.images.candidate.registryDigest,receipt.images.rollback.registryDigest);
}
function context(){
 assert.equal(process.env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_REF,BRANCH);
 assert.match(process.env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);assert.match(process.env.GITHUB_RUN_ID??'',/^[1-9][0-9]*$/);assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 assert.equal(process.version,'v22.23.5');
 return {repository:REPOSITORY,workflowSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:1};
}
const identityScript=`const fs=require('node:fs'),crypto=require('node:crypto');const h=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const m=JSON.parse(fs.readFileSync('/app/build.json'));console.log(JSON.stringify({manifest:m,buildManifestSha256:h('/app/build.json'),bundleHashes:{'server.mjs':h('/app/server.mjs'),'migrate.mjs':h('/app/migrate.mjs')},migrations:fs.readdirSync('/app/migrations').sort().map(name=>({name,digest:h('/app/migrations/'+name)}))}));`;
const secure=['--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges'];
async function imageEvidence(image){
 return JSON.parse(await docker(['run','--rm',...secure,image,'node','-e',identityScript]));
}
function verifyImageEvidence(actual,expected){
 assert.equal(actual.manifest.sourceSha,expected.sourceSha);assert.equal(actual.manifest.node,'v22.23.5');
 assert.equal(actual.manifest.syntheticOnly,true);assert.equal(actual.manifest.releaseApproval,false);
 assert.equal(actual.manifest.sourceFingerprint,expected.sourceFingerprint);assert.equal(actual.buildManifestSha256,expected.buildManifestSha256);
 assert.deepEqual(actual.bundleHashes,expected.bundleHashes);assert.deepEqual(actual.manifest.artifacts,expected.bundleHashes);
 assert.deepEqual(actual.migrations,[...expected.migrations].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0));
}
async function publish(root,output){
 const ctx=context(),receipt={kind:'CanopyProofPublishedClosedImages/1',...ctx,status:'PUBLISHING',scope:'registry-publication-and-closed-probe',createdAt:new Date().toISOString(),productionDeployed:false,productionReady:false,realEnrollment:false,images:{}};
 await mkdir(output,{recursive:true});
 for(const [role,sourceSha]of Object.entries(SOURCES)){
  const source=resolve(root,role),cwd=resolve(source,'dropin-earth');
  assert.equal(await git(['rev-parse','HEAD'],source),sourceSha);assert.equal(await git(['status','--porcelain'],source),'');
  const sourceTree=await git(['rev-parse','HEAD^{tree}'],source),plan=await json(resolve(cwd,'infra/child-backend/deployment-plan.json'));
  assert.equal(plan.api.nodeImageDigest,BASE);assert.equal(plan.api.defaultAccountMode,'disabled');assert.equal(plan.api.automaticDeploy,false);
  const migrations=await Promise.all(MIGRATIONS.map(async name=>({name,digest:hash(await readFile(resolve(cwd,'services/api/prisma',name)))})));
  // Exact source's existing build/container probe, unchanged and with no credentials passed to Docker.
  await command(process.execPath,['scripts/child-backend-image-check.mjs'],cwd,900000);
  const report=await json(resolve(cwd,'reports/child-backend/image-check.json'));
  assert.equal(report.sourceSha,sourceSha);assert.equal(report.baseImage,BASE);assert.equal(report.exitCode,0);assert.equal(report.productionDeployed,false);assert.equal(report.probe.accountEntry,'closed');
  const local=`canopyproof-child-backend:test-${sourceSha}`,actual=await imageEvidence(local);
  const item={sourceSha,sourceTree,platform:'linux/amd64',baseImage:BASE,imageId:report.imageId,sourceFingerprint:report.manifest.sourceFingerprint,buildManifestSha256:actual.buildManifestSha256,bundleHashes:report.manifest.artifacts,migrations};
  verifyImageEvidence(actual,item);
  const tag=`${IMAGE}:${role}-${sourceSha}-${ctx.runId}`;
  await docker(['tag',report.imageId,tag]);await docker(['push',tag],300000);
  const metadata=JSON.parse(await docker(['buildx','imagetools','inspect',tag,'--format','{{json .Manifest}}']));
  assert.match(metadata.digest??'',/^sha256:[a-f0-9]{64}$/);
  item.registryDigest=metadata.digest;item.image=`${IMAGE}@${metadata.digest}`;item.tag=tag;
  receipt.images[role]=item;
  await writeFile(resolve(output,`${role}-image-check.json`),JSON.stringify(report,null,2)+'\n');
  await writeFile(resolve(output,'publication.json'),JSON.stringify(receipt,null,2)+'\n');
 }
 receipt.status='PASS';validateReceipt(receipt,ctx.runId,ctx.workflowSha);
 await writeFile(resolve(output,'publication.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({kind:receipt.kind,runId:ctx.runId,candidate:receipt.images.candidate.image,rollback:receipt.images.rollback.image,productionReady:false}));
}
async function freshPull(input,output){
 const ctx=context(),bytes=await readFile(input),receipt=JSON.parse(bytes);validateReceipt(receipt,ctx.runId,ctx.workflowSha);
 await mkdir(output,{recursive:true});const checks={};
 // A separate GitHub-hosted runner starts without either published image cached.
 for(const [role,item]of Object.entries(receipt.images)){
  await docker(['pull',item.image],300000);const image=JSON.parse(await docker(['image','inspect',item.image]))[0];
  assert.equal(image.Id,item.imageId);assert.equal(image.Config.User,'node');assert.equal(image.Os,'linux');assert.equal(image.Architecture,'amd64');
  assert.ok(image.RepoDigests.includes(item.image));verifyImageEvidence(await imageEvidence(item.image),item);
  const plan=JSON.parse(await docker(['run','--rm',...secure,item.image,'node','/app/migrate.mjs','--plan']));
  assert.equal(plan.mode,'plan-only');assert.equal(plan.createsRoles,false);assert.equal(plan.grantsAuthority,false);assert.deepEqual(plan.migrations,item.migrations);
  const name=`child-closed-${randomUUID()}`;let exitCode;
  try{
   await docker(['run','--detach','--name',name,...secure,item.image]);
   const probe=`const a=require('node:assert/strict');(async()=>{let r;for(let i=0;i<50;i++){try{r=await fetch('http://127.0.0.1:10000/health/live');break}catch{await new Promise(r=>setTimeout(r,50))}}a.equal(r?.status,200);const b=await r.json();a.equal(b.sourceSha,process.argv[1]);a.equal(b.syntheticOnly,true);a.equal(b.realCapabilities,false);a.equal(process.version,'v22.23.5');a.notEqual(process.getuid(),0);a.equal((await fetch('http://127.0.0.1:10000/health/ready')).status,503);a.equal((await fetch('http://127.0.0.1:10000/canopyproof/child-stewardship/v1/guardian/sessions',{method:'POST',body:'fixed synthetic input'})).status,503)})().catch(()=>process.exit(1));`;
   await docker(['exec',name,'node','-e',probe,item.sourceSha]);
   await docker(['stop','--time','25',name]);exitCode=JSON.parse(await docker(['inspect',name]))[0].State.ExitCode;assert.equal(exitCode,0);
  }finally{await docker(['rm','--force',name]);}
  checks[role]={image:item.image,imageId:image.Id,sourceSha:item.sourceSha,manifestAndBundleHashesVerified:true,migrationFiles:plan.migrations.length,registryPull:'PASS',closedProbe:'PASS',readinessStatus:503,guardianSessionStatus:503,exitCode,containerRemoved:true};
 }
 const result={kind:'CanopyProofFreshPullClosedProbe/1',...ctx,publicationSha256:hash(bytes),completedAt:new Date().toISOString(),status:'PASS',scope:'registry-availability-and-isolated-closed-runtime',checks,productionDeployed:false,productionReady:false,realEnrollment:false,privateLinkAcceptance:'NOT_RUN',databaseRestoreAcceptance:'NOT_RUN',realAuthorityAcceptance:'NOT_RUN',poccExternalFinality:'NOT_RUN'};
 await writeFile(resolve(output,'fresh-pull.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
async function main(){
 const [mode,...args]=process.argv.slice(2);if(mode==='publish'&&args.length===2)await publish(...args);else if(mode==='fresh-pull'&&args.length===2)await freshPull(...args);else throw new Error('PUBLICATION_ARGUMENTS_INVALID');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error('CHILD_IMAGE_PUBLICATION_FAILED');process.exitCode=1;});
