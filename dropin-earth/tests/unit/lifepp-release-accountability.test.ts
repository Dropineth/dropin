import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateCiArtifactEvidence } from '../../scripts/lifepp-release-run.mjs';
import { REPOSITORY,TRUST_GATES,sha256,validateEvidence } from '../../scripts/lifepp-release-policy.mjs';

// Local fixtures model authenticated CI metadata and archive bytes; no GitHub call,
// actual approval, production credentials or deployment is performed by these tests.
const target='a'.repeat(40),now=Date.parse('2026-10-24T12:00:00Z');
const manifest=JSON.parse(readFileSync('config/accountability-adversarial.json','utf8'));
function fixture(){
 const run={id:101,run_attempt:1,workflow_id:7,repository:{full_name:REPOSITORY},head_sha:target,head_branch:'main',event:'push',status:'completed',conclusion:'success'};
 const jobs=[{id:201,runner_id:301,run_id:101,head_sha:target,name:'Verify trust kernel and OpenNext artifact',status:'completed',conclusion:'success',started_at:'2026-10-24T10:00:00Z',completed_at:'2026-10-24T11:30:00Z',steps:[{name:'Run deterministic workspace gate',status:'completed',conclusion:'success'}]}];
 const snapshot={head:target,node:'v22.23.4',npm:'10.9.4',lockSha256:'d'.repeat(64),sourceFingerprintSha256:'e'.repeat(64),sourceStatus:''};
 const files=new Map<string,Buffer>();
 const report={schemaVersion:1,status:'PASS',...snapshot,expectedSha:target,runId:'101',runAttempt:'1',checkoutClean:true,finalSnapshot:{...snapshot},expectedCommands:TRUST_GATES,commands:TRUST_GATES.map(id=>({id,status:'PASS',exitCode:0,commandExitCode:0,signal:null,startedAt:'2026-10-24T10:01:00Z',finishedAt:'2026-10-24T11:20:00Z',before:{...snapshot},after:{...snapshot},logSha256:sha256(id),artifacts:[] as {path:string;sha256:string}[]}))};
 report.commands.forEach(entry=>files.set(`${entry.id}.log`,Buffer.from(entry.id)));
 const artifact=(owner:string,path:string,bytes:Buffer)=>{files.set(`artifacts/${path}`,bytes);const entry=report.commands.find(item=>item.id===owner)!;entry.artifacts=entry.artifacts.filter(item=>item.path!==path);entry.artifacts.push({path,sha256:sha256(bytes)});};
 const tap=Buffer.from(manifest.cases.map((id:string,i:number)=>`ok ${i+1} - ${id}`).join('\n')+'\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n');
 const receipt={targetSha:target,runnerId:`${REPOSITORY}:101:1:trust-gate`,phase:'merge_candidate',completedAt:'2026-10-24T11:00:00Z',conclusion:'success',sourceDirty:false,before:{...snapshot},after:{...snapshot},command:['/trusted/node','--test','--test-reporter=tap','--import','tsx',...manifest.files],seedRange:manifest.seedRange,mutants:manifest.mutants,tests:manifest.cases.map((id:string)=>({id,executed:true,status:'passed',assertions:1})),stdoutSha256:sha256(tap),exitCode:0,signal:null,error:null};
 const save=()=>artifact('workspace','reports/ci/accountability-adversarial.json',Buffer.from(JSON.stringify(receipt)));
 save();artifact('workspace','reports/ci/accountability-adversarial.tap',tap);
 artifact('workspace','reports/npm-audit-moderate.json',Buffer.from(JSON.stringify({metadata:{vulnerabilities:{moderate:0,high:0,critical:0}}})));
 for(const id of ['coverage','critical-coverage','webgl','workerd-smoke'])artifact(id,`reports/${id}.json`,Buffer.from('{}'));
 const args=()=>({file:'canopyproof-ci.yml',workflow:{id:7,path:'.github/workflows/canopyproof-ci.yml'},run,jobs,report,expectedSha:target,expectedLockSha256:snapshot.lockSha256,adversarialManifest:manifest,verifiedAt:now,readEntry:(name:string)=>{const bytes=files.get(name);assert.ok(bytes,`missing archive entry: ${name}`);return bytes;}});
 return {run,jobs,report,files,receipt,save,artifact,args};
}

test('release artifact path accepts complete current exact-head accountability evidence without granting release approval',()=>{
 const f=fixture(),accepted=validateCiArtifactEvidence(f.args());assert.equal(accepted.accepted,true);assert.equal(accepted.releaseApproval,false);assert.equal(accepted.jobId,201);assert.equal(accepted.githubRunnerId,301);assert.equal(accepted.tests,manifest.cases.length);
 const source=readFileSync('scripts/lifepp-release-run.mjs','utf8');assert.match(source,/const accountability = validateCiArtifactEvidence\(/);assert.match(source,/adversarialManifest: readJson\('config\/accountability-adversarial.json'\)/);
});

test('historical reports remain inspectable but cannot substitute for a current candidate receipt',()=>{
 const f=fixture();f.report.commands.find(x=>x.id==='workspace')!.artifacts=f.report.commands.find(x=>x.id==='workspace')!.artifacts.filter(x=>!x.path.includes('accountability'));
 validateEvidence(f.report,target,f.run,TRUST_GATES);assert.throws(()=>validateCiArtifactEvidence(f.args()),/Missing or ambiguous accountability artifact/);
});

test('release artifact path rejects missing, skipped, wrong-head, wrong-phase and self-claimed runner receipts',()=>{
 const mutations=[
  (f:ReturnType<typeof fixture>)=>{f.receipt.targetSha='b'.repeat(40);},
  (f:ReturnType<typeof fixture>)=>{f.receipt.phase='pull_request';},
  (f:ReturnType<typeof fixture>)=>{f.receipt.runnerId='local-diagnostic';},
  (f:ReturnType<typeof fixture>)=>{f.receipt.runnerId=`${REPOSITORY}:101:2:trust-gate`;},
  (f:ReturnType<typeof fixture>)=>{f.receipt.tests.pop();},
  (f:ReturnType<typeof fixture>)=>{f.receipt.tests[0].status='skipped';},
  (f:ReturnType<typeof fixture>)=>{f.receipt.tests[0].executed=false;},
  (f:ReturnType<typeof fixture>)=>{f.receipt.conclusion='neutral';},
  (f:ReturnType<typeof fixture>)=>{f.receipt.completedAt='2026-10-22T11:00:00Z';},
  (f:ReturnType<typeof fixture>)=>{f.receipt.completedAt='2026-10-24T11:40:00Z';},
  (f:ReturnType<typeof fixture>)=>{f.receipt.stdoutSha256='f'.repeat(64);},
  (f:ReturnType<typeof fixture>)=>{f.receipt.sourceDirty=true;},
  (f:ReturnType<typeof fixture>)=>{f.receipt.after.sourceFingerprintSha256='f'.repeat(64);},
  (f:ReturnType<typeof fixture>)=>{f.receipt.seedRange=[0,0];},
  (f:ReturnType<typeof fixture>)=>{f.receipt.mutants=[];},
  (f:ReturnType<typeof fixture>)=>{f.receipt.command.pop();},
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);f.save();assert.throws(()=>validateCiArtifactEvidence(f.args()));}
 const missing=fixture();missing.files.delete('artifacts/reports/ci/accountability-adversarial.json');assert.throws(()=>validateCiArtifactEvidence(missing.args()),/missing archive entry/);
 const altered=fixture();altered.files.set('artifacts/reports/ci/accountability-adversarial.json',Buffer.from('{}'));assert.throws(()=>validateCiArtifactEvidence(altered.args()),/missing or altered/);
});

test('authenticated CI job state and actual TAP cannot be replaced by a success field',()=>{
 for(const change of [{conclusion:'neutral'},{conclusion:'skipped'},{status:'in_progress'},{run_id:999},{head_sha:'b'.repeat(40)},{runner_id:0}]){const f=fixture();Object.assign(f.jobs[0],change);assert.throws(()=>validateCiArtifactEvidence(f.args()));}
 const wrongWorkflow=fixture();assert.throws(()=>validateCiArtifactEvidence({...wrongWorkflow.args(),workflow:{id:8,path:'.github/workflows/canopyproof-ci.yml'}}));
 const skip=fixture();const tap=Buffer.from(manifest.cases.map((id:string,i:number)=>`ok ${i+1} - ${id}`).join('\n')+'\n# fail 0\n# skipped 1\n# cancelled 0\n# todo 0\n');skip.artifact('workspace','reports/ci/accountability-adversarial.tap',tap);skip.receipt.stdoutSha256=sha256(tap);skip.save();assert.throws(()=>validateCiArtifactEvidence(skip.args()),/unexecuted or failed/);
 const ambiguous=fixture(),ambiguousTap=Buffer.concat([ambiguous.files.get('artifacts/reports/ci/accountability-adversarial.tap')!,Buffer.from('# skipped 1\n')]);ambiguous.artifact('workspace','reports/ci/accountability-adversarial.tap',ambiguousTap);ambiguous.receipt.stdoutSha256=sha256(ambiguousTap);ambiguous.save();assert.throws(()=>validateCiArtifactEvidence(ambiguous.args()),/ambiguous totals/);
 const owner=fixture(),workspace=owner.report.commands.find(x=>x.id==='workspace')!;const receipt=workspace.artifacts.find(x=>x.path.endsWith('accountability-adversarial.json'))!;workspace.artifacts=workspace.artifacts.filter(x=>x!==receipt);owner.report.commands.find(x=>x.id==='coverage')!.artifacts.push(receipt);assert.throws(()=>validateCiArtifactEvidence(owner.args()),/belong to the workspace/);
 const duplicate=fixture();duplicate.report.commands.find(x=>x.id==='coverage')!.artifacts.push(duplicate.report.commands.find(x=>x.id==='workspace')!.artifacts.find(x=>x.path.endsWith('accountability-adversarial.json'))!);assert.throws(()=>validateCiArtifactEvidence(duplicate.args()),/ambiguous accountability/);
});
