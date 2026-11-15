import assert from 'node:assert/strict';
import test from 'node:test';
import {MIGRATIONS,SOURCES,validateReceipt} from '../../scripts/child-image-publication.mjs';

const sha='a'.repeat(40),run='123';
function fixture(){return {kind:'CanopyProofPublishedClosedImages/1',status:'PASS',repository:'Dropineth/dropin',runId:run,workflowSha:sha,scope:'registry-publication-and-closed-probe',productionDeployed:false,productionReady:false,realEnrollment:false,images:Object.fromEntries(Object.entries(SOURCES).map(([role,sourceSha],i)=>{const digest=`sha256:${String(i+1).repeat(64)}`;return[role,{sourceSha,sourceTree:'b'.repeat(40),platform:'linux/amd64',baseImage:'docker.io/library/node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee',registryDigest:digest,imageId:`sha256:${'3'.repeat(64)}`,image:`ghcr.io/dropineth/canopyproof-child-backend@${digest}`,buildManifestSha256:'4'.repeat(64),sourceFingerprint:'5'.repeat(64),bundleHashes:{'server.mjs':'6'.repeat(64),'migrate.mjs':'7'.repeat(64)},migrations:MIGRATIONS.map(name=>({name,digest:'8'.repeat(64)}))}]}))};}
test('receipt accepts exact source and distinct registry manifest identities',()=>{validateReceipt(fixture(),run,sha);});
test('receipt rejects moving refs, wrong run and workflow identity',()=>{
 for(const change of [r=>{r.images.candidate.sourceSha='main';},r=>{r.runId='124';},r=>{r.workflowSha='c'.repeat(40);},r=>{r.repository='another/repo';}]){const r=fixture();change(r);assert.throws(()=>validateReceipt(r,run,sha));}
});
test('receipt rejects claimed production readiness, missing migration and derived thirteenth migration',()=>{
 for(const change of [r=>{r.productionReady=true;},r=>{r.productionDeployed=true;},r=>{r.realEnrollment=true;},r=>{r.images.candidate.migrations.pop();},r=>{r.images.candidate.migrations.push({name:'derived.sql',digest:'8'.repeat(64)});}]){const r=fixture();change(r);assert.throws(()=>validateReceipt(r,run,sha));}
});
test('receipt rejects configuration ID as manifest reference and equal rollback',()=>{
 const wrong=fixture();wrong.images.candidate.image='ghcr.io/dropineth/canopyproof-child-backend:latest';assert.throws(()=>validateReceipt(wrong,run,sha));
 const same=fixture();same.images.rollback.registryDigest=same.images.candidate.registryDigest;same.images.rollback.image=same.images.candidate.image;assert.throws(()=>validateReceipt(same,run,sha));
});
