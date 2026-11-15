import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChildHome,networkReadiness,assetForChild,serviceForChild,careForChild,currentGrant } from './network.mjs';
import { renderNetworkPage } from './network-page.mjs';
import { initialState } from '../../dropin-earth/integrations/care-continuity-v2/src/domain.mjs';
const now=1794787200000;
function fixture(){
  const tenantId='tenant:test',subjectId='child:synthetic',actorId='actor:synthetic';
  const source={id:'source:test',version:'v1',licenseId:'TEST_ONLY',reuseApproved:true,withdrawn:false,digest:'a'.repeat(64),observedAt:now-10000,reviewedAt:now-1000,validUntil:now+60000,kind:'observed',resolutionM:30,fieldVerified:false};
  const project={id:'project:test',tenantId,version:1,revoked:false,titles:{zh:'一起照护树木',en:'Care for a tree'},evidence:[source],participationReview:'approved',privacyReview:'approved'};
  const asset={id:'asset:test',tenantId,version:1,revoked:false,projectId:project.id,kind:'terrain_dsm',privacyReview:'approved',releaseStatus:'released',capturedAt:now-10000,validUntil:now+60000,digest:'b'.repeat(64),crs:'TEST_ENU',verticalDatum:'TEST_EGM',source,geometricErrorM:null,rawUrl:'private://secret-model',exactLocation:'secret-location'};
  const service={id:'service:test',tenantId,operatorId:'operator:test',publicName:'Synthetic care partner',verified:true,safeguarding:'approved',projectIds:[project.id],revoked:false,validFrom:now-1000,validUntil:now+60000,capacity:1,onDuty:true,capabilities:['ecology','water'],phone:'private-phone',latitude:123};
  const state=initialState('case:test',tenantId,{serviceId:'service:test',category:'water',issue:'no_supply',channel:'assisted',observedAt:now-1000},now-1000);
  const care={id:state.id,tenantId,subjectId,version:1,revoked:false,state};
  const principal={actorId,tenantId,subjectId,preferredLocale:'zh'};
  const grants=[['project',project],['asset',asset],['care',care]].map(([resourceType,r])=>({actorId,tenantId,subjectId,resourceType,resourceId:r.id,resourceVersion:1,action:'read',revoked:false,validFrom:now-1000,validUntil:now+60000}));
  return {project,asset,service,care,source,ctx:{principal,grants,now},snapshot:{tenantId,subjectId,generatedAt:now-1000,validUntil:now+30000,projects:[project],assets:[asset],services:[service],care:[care],projectRefs:[project.id]}};
}
test('static readiness never activates enrollment, dispatch or carbon balances',()=>{
 const r=networkReadiness();assert.equal(r.personalizedHome,'not_connected');assert.equal(r.ledgers.verifiedRemovalKgCO2e,null);assert.equal(r.spatial.assessmentGrid.metres,3000);assert.equal(r.spatial.assessmentGrid.sizeKind,'flat_to_flat');assert.equal(r.chainRankWrite,false);
 r.spatial.assessmentGrid.metres=5000;assert.equal(networkReadiness().spatial.assessmentGrid.metres,3000);
});
test('scoped read model joins project, evidence, 3D reference and care without dispatch',()=>{
 const f=fixture(),v=buildChildHome(f.snapshot,f.ctx);assert.equal(v.projects.length,1);assert.equal(v.projects[0].assets[0].representation,'2.5d_surface');assert.equal(v.projects[0].assets[0].assetURL,null);assert.equal(v.projects[0].services[0].responseStatus,'not_requested');assert.equal(v.care[0].responseConfirmed,false);assert.equal(v.permissions.enroll,false);assert.equal(v.projects[0].netCarbonKgCO2e,null);
});
for(const [key,value]of [['tenantId','other:tenant'],['subjectId','other:child']])test('snapshot scope denies wrong '+key,()=>{
 const f=fixture();f.snapshot[key]=value;assert.throws(()=>buildChildHome(f.snapshot,f.ctx),e=>e.code==='SCOPE_DENIED');
});
for(const [key,value]of [['revoked',true],['validUntil',now],['validFrom',now+1],['resourceVersion',2],['subjectId','child:other'],['actorId','actor:other'],['action','write'],['resourceType','asset']])test('project grant rejects '+key,()=>{
 const f=fixture();f.ctx.grants[0][key]=value;assert.equal(buildChildHome(f.snapshot,f.ctx).projects.length,0);
});
test('revocation and permission changes are rechecked on every projection',()=>{
 const f=fixture();assert.equal(buildChildHome(f.snapshot,f.ctx).projects.length,1);f.project.revoked=true;assert.equal(buildChildHome(f.snapshot,f.ctx).projects.length,0);
});
for(const [key,value]of [['generatedAt',now+1],['validUntil',now]])test('stale or future snapshot '+key,()=>{
 const f=fixture();f.snapshot[key]=value;assert.throws(()=>buildChildHome(f.snapshot,f.ctx),e=>e.code==='STALE_SNAPSHOT');
});
test('unassociated or unreviewed project is not exposed',()=>{
 const f=fixture();f.snapshot.projectRefs=[];assert.equal(buildChildHome(f.snapshot,f.ctx).projects.length,0);f.snapshot.projectRefs=[f.project.id];f.project.privacyReview='pending';assert.equal(buildChildHome(f.snapshot,f.ctx).projects.length,0);
});
for(const [key,value]of [['privacyReview','pending'],['releaseStatus','draft'],['revoked',true],['validUntil',now],['capturedAt',now+1],['digest','bad'],['verticalDatum',null],['projectId','project:other']])test('3D asset gate '+key,()=>{
 const f=fixture();f.asset[key]=value;assert.equal(assetForChild(f.asset,f.project,f.ctx),null);
});
test('project permission alone never grants private 3D access',()=>{
 const f=fixture();f.ctx.grants=f.ctx.grants.filter(g=>g.resourceType!=='asset');assert.equal(assetForChild(f.asset,f.project,f.ctx),null);
});
test('illustration remains illustration, cannot claim field reconstruction',()=>{
 const f=fixture();f.asset.kind='illustration';assert.equal(assetForChild(f.asset,f.project,f.ctx),null);f.source.kind='illustrative';assert.equal(assetForChild(f.asset,f.project,f.ctx).representation,'illustration');f.asset.kind='photogrammetry';assert.equal(assetForChild(f.asset,f.project,f.ctx),null);
});
for(const [key,value]of [['reuseApproved',false],['withdrawn',true],['validUntil',now],['observedAt',now+1],['digest','not-a-digest']])test('source gate '+key,()=>{
 const f=fixture();f.source[key]=value;const v=buildChildHome(f.snapshot,f.ctx);assert.equal(v.projects[0].evidence.length,0);assert.equal(v.projects[0].assets.length,0);
});
test('model output cannot be relabelled field verification',()=>{
 const f=fixture();f.source.kind='modelled';f.source.fieldVerified=true;assert.equal(buildChildHome(f.snapshot,f.ctx).projects[0].evidence[0].fieldVerified,false);
});
for(const [key,value]of [['verified',false],['onDuty',false],['capacity',0],['revoked',true],['safeguarding','pending'],['validUntil',now],['projectIds',['project:other']]])test('service gate '+key,()=>{
 const f=fixture();f.service[key]=value;assert.equal(serviceForChild(f.service,f.project,f.ctx),null);
});
test('nearby or high-score but unauthorized service never overrides service-area checks',()=>{
 const f=fixture();f.service.projectIds=[];f.service.distanceM=1;f.service.chainRank=999999;assert.equal(serviceForChild(f.service,f.project,f.ctx),null);
});
test('care uses existing core childView, strips identity/evidence and preserves pending handoff',()=>{
 const f=fixture();f.care.state.stage='ACCEPTED';f.care.state.handoffTo='actor:backup';f.care.state.chainRankDelta=-5;f.care.state.waterSafety='safe';f.care.state.symptoms='secret-health';
 const v=careForChild(f.care,f.ctx);assert.equal(v.chainRankDelta,0);assert.equal(v.waterSafety,'unknown');assert.equal(v.handoffPending,true);assert.equal(v.responseConfirmed,true);assert.equal('symptoms'in v,false);assert.equal('handoffTo'in v,false);
});
test('another child or version-mismatched care event is hidden',()=>{
 const f=fixture();f.care.subjectId='child:other';assert.equal(careForChild(f.care,f.ctx),null);f.care.subjectId=f.ctx.principal.subjectId;f.care.state.revision=2;assert.equal(careForChild(f.care,f.ctx),null);
});
for(const category of ['health','protection'])test(category+' is not exposed through the ecological account feed',()=>{
 const f=fixture();f.care.state.category=category;assert.equal(careForChild(f.care,f.ctx),null);
});
test('language selection is explicit, never inferred from a spatial cell',()=>{
 const f=fixture();f.ctx.principal.preferredLocale='en';f.ctx.principal.latitude=40;f.ctx.principal.ethnicity='secret';assert.equal(buildChildHome(f.snapshot,f.ctx).locale,'en');f.ctx.principal.preferredLocale='ar';const v=buildChildHome(f.snapshot,f.ctx);assert.equal(v.locale,'en');assert.equal(v.requestedLocale,'ar');
});
test('output excludes raw URLs, coordinates, contacts, identity attributes and grants',()=>{
 const f=fixture();f.snapshot.childName='secret-name';f.snapshot.gps='secret-gps';f.ctx.principal.health='secret-health';const s=JSON.stringify(buildChildHome(f.snapshot,f.ctx));
 for(const secret of ['private://','secret-location','private-phone','secret-name','secret-gps','secret-health','actor:synthetic','child:synthetic','operator:test'])assert.equal(s.includes(secret),false);
});
test('bounded projection rejects duplicated or excessively large collections',()=>{
 const f=fixture();f.snapshot.assets.push(f.asset);assert.throws(()=>buildChildHome(f.snapshot,f.ctx),e=>e.code==='INVALID_ASSETS');f.snapshot.assets=[];f.snapshot.projects=Array(201).fill(f.project);assert.throws(()=>buildChildHome(f.snapshot,f.ctx),e=>e.code==='INVALID_PROJECTS');
});
test('read model never mutates its inputs',()=>{
 const f=fixture(),before=JSON.stringify(f);buildChildHome(f.snapshot,f.ctx);assert.equal(JSON.stringify(f),before);
});
test('no current identity cannot authorize any resource',()=>{
 const f=fixture();assert.equal(currentGrant({},f.project,'project'),false);assert.throws(()=>buildChildHome(f.snapshot,{}),e=>e.code==='AUTH_REQUIRED');
});
for(const zh of [true,false])test('existing private network route rendering '+(zh?'zh':'en'),()=>{
 const h=renderNetworkPage(zh);assert.match(h,/CanopyProof/);assert.match(h,/2050/);assert.match(h,/children2050.css/);assert.match(h,/aria-current="page"/);assert.match(h,/id="main"/);assert.match(h,/noindex,nofollow/);assert.match(h,/cdn-cgi\/access\/logout/);assert.doesNotMatch(h,/<script|<form|<input|<iframe/);assert.doesNotMatch(h,/localStorage|geolocation.getCurrentPosition|worldComplete/);assert.ok(h.includes(zh?'尚未连接查看器':'no viewer is connected'));
});
