import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {PIN,REGISTRY,OLD,exactInputs,receipt} from './rehearse.mjs';
const s='f'.repeat(64), g='e'.repeat(64);
const make=()=>{
  const common={repository:'Dropineth/dropin',status:'PASS',productionDeployed:false,realEnrollment:false,productionReady:false,runAttempt:1,workflowSha:'a'.repeat(40),runId:'731'};
  const item={sourceSha:PIN.finalCandidate,sourceTree:PIN.finalCandidateTree,baseImage:PIN.base,platform:'linux/amd64',registryDigest:'sha256:'+s,image:REGISTRY+'@sha256:'+s,imageId:'sha256:'+g,migrations:[...Array.from({length:12},(_,i)=>({name:'base-'+i,digest:g})),{name:'child-stewardship-outbox-hold.sql',digest:'62fae28bdd5d0f7ad95f8839c94f492dbd6266473b417cfef76b466aeccf611b'}]};
  const pub={...common,kind:'CanopyProofPublishedClosedImage13/1',verifiedMainGate:{runId:'43685689778',jobId:'132725663380',sourceSha:PIN.finalCandidate},images:{candidate:item}};
  const fresh={...common,kind:'CanopyProofFreshPullClosedImage13/1',checks:{candidate:{image:item.image,imageId:item.imageId,sourceSha:item.sourceSha,registryPull:'PASS',closedProbe:'PASS',migrationFiles:13,manifestAndBundleHashesVerified:true,readinessStatus:503,guardianSessionStatus:503}}};
  return {pub,fresh,item};
};
function evaluate({pub,fresh}) {
  const bytes=Buffer.from(JSON.stringify(pub));
  return exactInputs(pub,{publicationSha256:createHash('sha256').update(bytes).digest('hex'),...fresh},bytes);
}
test('requires a fresh pull receipt byte-bound to the exact 13-entry candidate publication',()=>{const input=make();assert.deepEqual(evaluate(input),input.item);});
test('rejects wrong release receipt, tag, old image digest and status claims',()=>{
  for(const bad of [
    r=>{r.fresh.publicationSha256='0'.repeat(64);},
    r=>{r.fresh.runId='732';},
    r=>{r.fresh.checks.candidate.closedProbe='NOT_RUN';},
    r=>{r.item.image=REGISTRY+':main';},
    r=>{r.item.image=OLD.rollback;r.item.registryDigest=OLD.rollback.split('@')[1];r.fresh.checks.candidate.image=r.item.image;},
    r=>{r.item.sourceTree='x'.repeat(40);},
    r=>{r.item.migrations.at(-1).digest='d'.repeat(64);},
    r=>{r.fresh.realEnrollment=true;},
  ]){const data=make();bad(data);assert.throws(()=>evaluate(data));}
});
test('unexecuted receipt makes no readiness, authority or deployment claims',()=>{
  const r=receipt();assert.equal(r.candidateSha,PIN.finalCandidate);
  assert.ok(Object.values(r.stages).every(x=>x.status==='NOT_RUN'));assert.equal(r.productionEnrollment.status,'NOT_RUN');
  assert.equal(r.productionFinality.status,'NOT_RUN');assert.equal(r.productionReady,false);
});
