import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {validateClosedCandidate} from '../../scripts/child-closed-candidate.mjs';
import {sha256} from '../../scripts/lifepp-release-policy.mjs';

const plan = JSON.parse(readFileSync(new URL('../../infra/child-backend/deployment-plan.json',import.meta.url),'utf8'));
function fixture() {
  function side(id:string) {
    // Deliberately not executable: the checker must only hash these bytes.
    const artifacts = {'server.mjs':Buffer.from(`throw new Error('MUST_NOT_RUN_${id}');`),
      'migrate.mjs':Buffer.from(`throw new Error('MUST_NOT_MIGRATE_${id}');`)};
    const manifest = {sourceSha:id.repeat(40),workingTreeDirty:null,node:'v22.23.5',sourceFingerprint:id.repeat(64),
      artifacts:Object.fromEntries(Object.entries(artifacts).map(([name,bytes]) => [name,sha256(bytes)])),syntheticOnly:true,releaseApproval:false};
    const manifestBytes = Buffer.from(JSON.stringify(manifest));
    const imageCheck = {sourceSha:manifest.sourceSha,baseImage:plan.api.nodeImageDigest,imageId:`sha256:${id.repeat(64)}`,
      manifest:structuredClone(manifest),probe:{node:manifest.node,sourceSha:manifest.sourceSha,uid:1000,accountEntry:'closed'},exitCode:0,productionDeployed:false};
    return {reference:{sourceSha:manifest.sourceSha,imageId:imageCheck.imageId,buildManifestSha256:sha256(manifestBytes)},
      evidence:{manifestBytes,imageCheck,artifacts}};
  }
  const candidate = side('a'),rollback = side('b');
  return {selection:{kind:'CanopyProofClosedCandidate/1',candidate:candidate.reference,rollback:rollback.reference,
    boundary:{backendMode:'disabled',proxyMode:'disabled',gatewayMode:'disabled',workersDev:false,previewUrls:false,publicRoutes:[],realEnrollment:false}},
    candidate:candidate.evidence,rollback:rollback.evidence,plan:structuredClone(plan)};
}
type Fixture = ReturnType<typeof fixture>;
const reject = (change:(input:Fixture)=>void) => { const input=fixture(); change(input); assert.throws(()=>validateClosedCandidate(input)); };
function replaceManifest(input:Fixture, change:(manifest:Record<string,unknown>)=>void) {
  const manifest = JSON.parse(input.candidate.manifestBytes.toString()); change(manifest);
  input.candidate.manifestBytes = Buffer.from(JSON.stringify(manifest));
  input.candidate.imageCheck.manifest = structuredClone(manifest);
  input.selection.candidate.buildManifestSha256 = sha256(input.candidate.manifestBytes);
}

test('closed candidate checks only local bytes, preserving unknown source provenance and all release denials',()=>{
  const result = validateClosedCandidate(fixture());
  assert.equal(result.localEvidenceConsistent,true); assert.equal(result.scope,'offline-evidence-consistency');
  assert.equal(result.accountEntry,'closed'); assert.equal(result.syntheticOnly,true); assert.equal(result.candidate.workingTreeDirty,null);
  for (const key of ['cleanSourceAttested','boundaryObserved','rollbackAvailabilityVerified','liveReceiptVerified','productionReady','releaseApproval','authorizationGranted','productionDeployed']) assert.equal(result[key],false);
  const clean = fixture(); replaceManifest(clean,m=>{m.workingTreeDirty=false;});
  assert.equal(validateClosedCandidate(clean).cleanSourceAttested,false);
});

test('rejects moving, shortened, malformed and identical candidate/rollback references',()=>{
  for (const value of ['main','v1.0.0','a'.repeat(7),'A'.repeat(40),'a'.repeat(40)+'\n','https://example.invalid/token']) {
    reject(i=>{i.selection.candidate.sourceSha=value;}); reject(i=>{i.selection.rollback.sourceSha=value;});
  }
  for (const value of ['latest','node:22.23.5','sha256:bad','sha256:'+'A'.repeat(64)]) reject(i=>{i.selection.candidate.imageId=value;});
  for (const key of ['sourceSha','imageId','buildManifestSha256'] as const) reject(i=>{i.selection.rollback[key]=i.selection.candidate[key];});
  reject(i=>{i.selection.candidate.buildManifestSha256='moving-tag';});
});

test('binds every reference, manifest, probe and byte digest on BOTH sides',()=>{
  for (const side of ['candidate','rollback'] as const) {
    reject(i=>{i.selection[side].sourceSha='c'.repeat(40);});
    reject(i=>{i.selection[side].imageId='sha256:'+'c'.repeat(64);});
    reject(i=>{i.selection[side].buildManifestSha256='c'.repeat(64);});
    reject(i=>{i[side].imageCheck.sourceSha='c'.repeat(40);});
    reject(i=>{i[side].imageCheck.probe.sourceSha='c'.repeat(40);});
    reject(i=>{i[side].imageCheck.manifest.sourceFingerprint='c'.repeat(64);});
    reject(i=>{i[side].manifestBytes=Buffer.concat([i[side].manifestBytes,Buffer.from('\n')]);});
    for (const name of ['server.mjs','migrate.mjs'] as const) reject(i=>{i[side].artifacts[name]=Buffer.from('changed');});
  }
  reject(i=>replaceManifest(i,m=>{m.sourceSha='c'.repeat(40);}));
  reject(i=>replaceManifest(i,m=>{m.sourceFingerprint='not-a-digest';}));
});

test('rejects public/default-enabled/demo policy and broad/unknown boundary claims',()=>{
  for (const key of ['backendMode','proxyMode','gatewayMode'] as const) for (const value of ['synthetic-demo','production','real','',undefined]) {
    reject(i=>Object.assign(i.selection.boundary,{[key]:value}));
  }
  for (const key of ['workersDev','previewUrls','realEnrollment'] as const) for (const value of [true,'false',null]) reject(i=>Object.assign(i.selection.boundary,{[key]:value}));
  reject(i=>Object.assign(i.selection.boundary,{publicRoutes:['*/*']}));
  reject(i=>Object.assign(i.selection.boundary,{publicRoutes:false}));
  reject(i=>Object.assign(i.selection.boundary,{approved:true}));
});

test('requires pinned runtime, non-root closed probe, clean shutdown and synthetic-only nondeployment evidence',()=>{
  for (const side of ['candidate','rollback'] as const) {
    for (const uid of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) reject(i=>{i[side].imageCheck.probe.uid=uid;});
    for (const mode of ['synthetic-only','open','synthetic-demo']) reject(i=>{i[side].imageCheck.probe.accountEntry=mode;});
    reject(i=>{i[side].imageCheck.probe.node='v22.23.4';});
    reject(i=>{i[side].imageCheck.baseImage='node:latest';});
    reject(i=>{i[side].imageCheck.exitCode=1;});
    reject(i=>{i[side].imageCheck.productionDeployed=true;});
  }
  for (const changes of [{workingTreeDirty:true},{workingTreeDirty:'false'},{node:'v22.23.4'},
    {syntheticOnly:false},{releaseApproval:true}]) reject(i=>replaceManifest(i,m=>Object.assign(m,changes)));
  reject(i=>{i.plan.api.defaultAccountMode='synthetic-demo';});
  for (const field of ['automaticDeploy','automaticPreviewResources','migrationOnStartup']) reject(i=>{i.plan.api[field]=true;});
  reject(i=>{i.plan.realChildren=true;}); reject(i=>{i.plan.api.nodeImageDigest='node:latest';});
});

test('strict evidence objects reject missing/extra fields and never accept an injected secret or topology',()=>{
  for (const target of [(i:Fixture)=>i.selection,(i:Fixture)=>i.selection.candidate,(i:Fixture)=>i.selection.rollback,
    (i:Fixture)=>i.candidate,(i:Fixture)=>i.candidate.imageCheck,(i:Fixture)=>i.candidate.imageCheck.probe,
    (i:Fixture)=>i.candidate.artifacts]) reject(i=>Object.assign(target(i),{token:'MUST_NOT_ECHO'}));
  reject(i=>replaceManifest(i,m=>{m.token='MUST_NOT_ECHO';}));
  reject(i=>replaceManifest(i,m=>{delete m.syntheticOnly;}));
  reject(i=>{const {candidate,rollback,...rest}=i.selection;Object.assign(i,{selection:{...rest,'candidate,rollback':{candidate,rollback}}});});
  reject(i=>replaceManifest(i,m=>{m.artifacts={...(m.artifacts as object),extra:'a'.repeat(64)};}));
  reject(i=>{i.candidate.manifestBytes=Buffer.from('{malformed');i.selection.candidate.buildManifestSha256=sha256(i.candidate.manifestBytes);});
  reject(i=>{i.candidate.manifestBytes=Buffer.alloc(65_537);});
});

test('offline CLI hashes fixed files, never executes bundles, and reports only bounded fixed errors',()=>{
  const root=mkdtempSync(join(tmpdir(),'child-closed-candidate-'));
  const script=new URL('../../scripts/child-closed-candidate.mjs',import.meta.url);
  const args=[script.pathname,join(root,'selection.json'),join(root,'candidate'),join(root,'rollback')];
  const input=fixture();
  try {
    writeFileSync(args[1]!,JSON.stringify(input.selection));
    for(const side of ['candidate','rollback'] as const){
      const dir=join(root,side);mkdirSync(dir);
      writeFileSync(join(dir,'build.json'),input[side].manifestBytes);
      writeFileSync(join(dir,'image-check.json'),JSON.stringify(input[side].imageCheck));
      for(const [name,bytes] of Object.entries(input[side].artifacts))writeFileSync(join(dir,name),bytes);
    }
    const output=JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8',env:{PATH:process.env.PATH}}));
    assert.equal(output.localEvidenceConsistent,true); assert.equal(output.productionReady,false);
    assert.equal(output.selectionSha256,sha256(readFileSync(args[1]!)));
    const fail=()=>{const result=spawnSync(process.execPath,args,{encoding:'utf8',env:{PATH:process.env.PATH},timeout:3000});
      assert.equal(result.status,1);assert.equal(result.stdout,'');
      assert.deepEqual(JSON.parse(result.stderr),{error:'CLOSED_CANDIDATE_EVIDENCE_INVALID',productionReady:false,releaseApproval:false,authorizationGranted:false,liveReceiptVerified:false});
      assert.equal(result.stderr.includes(root),false);assert.equal(result.stderr.includes('MUST_NOT_ECHO'),false);};
    writeFileSync(args[1]!,JSON.stringify({...input.selection,token:'MUST_NOT_ECHO'}));fail();
    writeFileSync(args[1]!,'{MUST_NOT_ECHO');fail();
    writeFileSync(args[1]!,Buffer.alloc(65_537));fail();
    writeFileSync(args[1]!,JSON.stringify(input.selection));rmSync(join(root,'rollback','migrate.mjs'));fail();
    symlinkSync(join(root,'candidate','migrate.mjs'),join(root,'rollback','migrate.mjs'));fail();
    rmSync(join(root,'rollback','migrate.mjs'));
    if(process.platform==='linux'){
      execFileSync('mkfifo',[join(root,'rollback','migrate.mjs')]);fail();
    }
    assert.equal(spawnSync(process.execPath,[script.pathname],{encoding:'utf8'}).status,1);
  } finally {rmSync(root,{recursive:true,force:true});}
});
