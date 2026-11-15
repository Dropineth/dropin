import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIntake,initialState,transition,readiness,publicAggregate,childView,ahinActionFor,canonical} from '../src/domain.mjs';
import {fixtures,TENANT} from '../src/fixtures.mjs';
import {createSyntheticKey,makeReceipt,verifyReceipt,verifyChain,digest} from '../src/ledger.mjs';
const AT=1794732000000;
function scenario(){
 const f=fixtures(AT),grants=new Map(f.grants.map(g=>[g.actorId,g]));
 const input=validateIntake({serviceId:'synthetic-water',category:'water',issue:'no_supply',channel:'assisted'},f.services[0],AT);
 let s=initialState('synthetic-need-contract',TENANT,input,AT),clock=AT,seq=0;
 grants.set('synthetic-reporter',{...f.grants[0],actorId:'synthetic-reporter',role:'reporter',ticketId:s.id,organizationId:'synthetic-participation'});
 const evidence=new Map(f.evidence.map(e=>[e.id,e]));
 const run=(type,payload={},actor='synthetic-dispatcher',override={})=>{
  clock+=10;const g=grants.get(actor),p={actorId:actor,tenantId:TENANT,role:g.role};
  if(payload.evidenceId){const e=evidence.get(payload.evidenceId);if(e)evidence.set(e.id,{...e,observedAt:clock});}
  const c={type,payload,expectedRevision:s.revision,grantVersion:g.version,nonce:`contract_${++seq}`,issuedAt:clock,expiresAt:clock+60000,...override};
  s=transition(s,c,p,g,clock,{grant:id=>grants.get(id),evidence:id=>evidence.get(id)});return s;
 };
 const accepted=()=>{run('ASSIGN',{actorId:'synthetic-responder'});run('ACCEPT',{},'synthetic-responder');};
 const action=()=>{accepted();run('RECORD_ACTION',{outcome:'restored',evidenceId:'synthetic-water-action'},'synthetic-responder');};
 return {f,run,grants,evidence,accepted,action,state:()=>s};
}
const err=code=>e=>e.code===code;
test('service-first intake has no required school, identity, device or guardian fields',()=>{
 const h=scenario();assert.equal(h.state().stage,'RECEIVED');assert.equal(h.state().childAccountRequired,false);
 for(const key of ['schoolId','childName','guardianId','latitude','health','message'])assert.throws(()=>validateIntake({serviceId:'synthetic-water',category:'water',issue:'no_supply',channel:'self',[key]:'private'},h.f.services[0],AT),err('UNEXPECTED_FIELD'));
});
test('unconnected health/protection channels cannot create a water workflow',()=>{
 const h=scenario();for(const category of ['health','protection','air','food','toString'])assert.throws(()=>validateIntake({serviceId:'synthetic-water',category,issue:'no_supply',channel:'self'},h.f.services[0],AT),err('ADULT_CHANNEL_NOT_CONNECTED'));
});
test('handoff remains pending until its scoped responder accepts',()=>{
 const h=scenario();h.accepted();h.run('HANDOFF_REQUEST',{actorId:'synthetic-backup'});assert.equal(h.state().assignedTo,'synthetic-responder');
 h.run('HANDOFF_ACCEPT',{},'synthetic-backup');assert.equal(h.state().assignedTo,'synthetic-backup');assert.equal(h.state().handoffTo,null);
});
test('resource barriers never deduct child score or assert drinking safety',()=>{
 const h=scenario();h.accepted();h.run('BLOCK',{reason:'access_restricted'},'synthetic-responder');assert.equal(h.state().stage,'BLOCKED');assert.equal(h.state().chainRankDelta,0);assert.equal(h.state().waterSafety,'unknown');
});
test('received or unreviewed action cannot become closed',()=>{
 const h=scenario();assert.throws(()=>h.run('FEEDBACK',{result:'resolved'},'synthetic-reporter'),err('INVALID_TRANSITION'));h.action();assert.throws(()=>h.run('FEEDBACK',{result:'resolved'},'synthetic-reporter'),err('INVALID_TRANSITION'));
});
test('independent review and feedback complete a service issue, still-needed reopens',()=>{
 const h=scenario();h.action();h.run('REVIEW',{outcome:'confirmed',evidenceId:'synthetic-water-review'},'synthetic-reviewer');
 h.run('FEEDBACK',{result:'cannot_confirm'},'synthetic-reporter');assert.equal(h.state().stage,'VERIFIED');
 h.run('FEEDBACK',{result:'resolved'},'synthetic-reporter');assert.equal(h.state().stage,'CLOSED');
 h.run('FEEDBACK',{result:'still_needed'},'synthetic-reporter');assert.equal(h.state().stage,'REOPENED');assert.equal(h.state().chainRankDelta,0);
});
test('same organization cannot approve its own action',()=>{
 const h=scenario();h.action();h.grants.get('synthetic-reviewer').organizationId='synthetic-wash';
 assert.throws(()=>h.run('REVIEW',{outcome:'confirmed',evidenceId:'synthetic-water-review'},'synthetic-reviewer'),err('INDEPENDENT_REVIEW_REQUIRED'));
});
test('changed action evidence digest invalidates a later review',()=>{
 const h=scenario();h.action();const id=h.state().actionEvidence;h.evidence.set(id,{...h.evidence.get(id),sourceDigest:'f'.repeat(64)});
 assert.throws(()=>h.run('REVIEW',{outcome:'confirmed',evidenceId:'synthetic-water-review'},'synthetic-reviewer'),err('EVIDENCE_VERSION_CHANGED'));
});
test('revoked, stale authority and expired commands fail closed',()=>{
 const h=scenario();h.grants.get('synthetic-dispatcher').revoked=true;assert.throws(()=>h.run('ASSIGN',{actorId:'synthetic-responder'}),err('AUTH_REVOKED_OR_EXPIRED'));
 h.grants.get('synthetic-dispatcher').revoked=false;
 assert.throws(()=>h.run('ASSIGN',{actorId:'synthetic-responder'},'synthetic-dispatcher',{grantVersion:2}),err('AUTH_VERSION_CONFLICT'));
 assert.throws(()=>h.run('ASSIGN',{actorId:'synthetic-responder'},'synthetic-dispatcher',{expiresAt:AT-1}),err('COMMAND_EXPIRED_OR_INVALID'));
});
test('child view excludes internal actors, service references and evidence identifiers',()=>{
 const view=childView(scenario().state());for(const key of ['tenantId','serviceId','assignedTo','actionEvidence','actionBy'])assert.equal(key in view,false);
 assert.equal(publicAggregate().cases,null);assert.equal(readiness({operator:true}).activationAllowed,false);
});
test('AHIN application mapping distinguishes feedback from an explicit challenge',()=>{
 assert.equal(ahinActionFor('FEEDBACK',{result:'resolved'}),'ASSERT');assert.equal(ahinActionFor('FEEDBACK',{result:'still_needed'}),'CHALLENGE');assert.equal(ahinActionFor('BLOCK'),'REASON');
});
test('synthetic receipt verification detects tampering; no real multisig is claimed',()=>{
 const key=createSyntheticKey(),s=scenario().state();
 const r=makeReceipt({ticketId:s.id,tenantId:TENANT,revision:1,actorId:'synthetic-reporter',role:'reporter',type:'RECEIVE',grantVersion:1,at:AT,nonce:'contract_receipt',commandDigest:digest({source:'fixture'}),stateDigest:digest(s),previousHash:'0'.repeat(64)},key.privateKey);
 assert.ok(verifyReceipt(r,key.publicKey));assert.equal(verifyChain([r],key.publicKey).externalAnchorVerified,false);assert.equal(r.event.externalEffect,'NONE');
 const bad=structuredClone(r);bad.event.chainRankDelta=-1;assert.equal(verifyReceipt(bad,key.publicKey),false);
 assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));
});
