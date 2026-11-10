import assert from 'node:assert/strict';
import test from 'node:test';
import {CHILD_FIXTURE_PROFILE,LIFEPP_CHILD_SOURCE_HEADS,createLifeppChildBoundary,type ChildProtocolFixture,type AppealFixture} from '../../integrations/cai/lifepp-child-boundary.js';

function fixture():ChildProtocolFixture{return {profile:CHILD_FIXTURE_PROFILE,mode:'SIMULATION_ONLY',personaId:'synthetic-persona',sequence:0,issuedAt:1000,expiresAt:2000,
  sourceHeads:{...LIFEPP_CHILD_SOURCE_HEADS},verdict:{id:'synthetic-verdict',decision:'PASS',severity:'NONE',finality:'FINALIZED',evidenceRoot:`sha256:${'a'.repeat(64)}`},
  kya:{level:'KYA_2_HUMAN_ANCHORED_DIGITAL_TWIN',active:true,continuity:true},membership:'ACTIVE',openChallenge:false,liveness:true,
  decisionControlDomains:['synthetic-target-control','synthetic-original-reviewer-control'],chainrank:{scoreMillionths:0,advisoryOnly:true}};}
function setup(){let now=1000;const boundary=createLifeppChildBoundary('synthetic-persona',()=>now);return {boundary,advance:(value:number)=>{now=value;}};}
function appeal(decisionRoot:string):AppealFixture{return {profile:CHILD_FIXTURE_PROFILE,mode:'SIMULATION_ONLY',personaId:'synthetic-persona',appealId:'synthetic-appeal',decisionRoot,counterevidenceRoot:`sha256:${'b'.repeat(64)}`,
  reviewers:[{principal:'synthetic-reviewer-a',controlDomain:'synthetic-independent-a',human:true,conflict:false},{principal:'synthetic-reviewer-b',controlDomain:'synthetic-independent-b',human:true,conflict:false}]};}

test('unknown state denies; synthetic PASS supplies only learning eligibility, never authority',()=>{
  const {boundary}=setup();assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
  boundary.observeFixture(fixture());boundary.assertLearningAllowed();
  const snapshot=boundary.snapshot();assert.equal(snapshot.learningEligible,true);
  for(const key of ['caiSigner','chainrankAuthorization','productionAuthority','productionEnrollment','custodyEnabled','assetExecution','certifiedImpactIssuance','childRightsModified','durableRestartProtection','appealResolutionImplemented'] as const)assert.equal(snapshot[key],false,key);
});
test('all eligibility requirements are binary; maximum ChainRank cannot override any',()=>{
  const base=fixture();
  const changes:Partial<ChildProtocolFixture>[]=[
    {verdict:{...base.verdict,decision:'ABSTAIN'}},{verdict:{...base.verdict,finality:'PROVISIONAL'}},
    {verdict:{...base.verdict,decision:'PENDING_CHALLENGE',finality:'PENDING_CHALLENGE'}},
    {membership:'CANDIDATE'},{membership:'PROBATION'},{membership:'SUSPENDED'},
    {openChallenge:true},{liveness:false},{kya:{...base.kya,active:false}},{kya:{...base.kya,continuity:false}},
    {kya:{...base.kya,level:'KYA_0_UNVERIFIED'}},{kya:{...base.kya,level:'KYA_1_ACCOUNTABLE_OPERATOR'}},
  ];
  for(const change of changes){const {boundary}=setup();boundary.observeFixture({...base,...change,chainrank:{scoreMillionths:1_000_000,advisoryOnly:true}});assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);}
});
test('same-Persona finalized FAIL HARD is terminal; PASS, score and appeal cannot restore it',()=>{
  const {boundary}=setup(),v=fixture();
  const result=boundary.observeFixture({...v,verdict:{...v.verdict,decision:'FAIL',severity:'HARD'}});
  assert.equal(result.evicted,true);assert.throws(()=>boundary.assertLearningAllowed(),/EVICTED_TERMINAL/);
  const history=boundary.snapshot().decisions;
  assert.throws(()=>boundary.observeFixture({...v,sequence:1,chainrank:{scoreMillionths:1_000_000,advisoryOnly:true}}),/EVICTED_TERMINAL/);
  assert.equal(boundary.recordAppealFixture(appeal(result.decisionRoot)).authorityRestored,false);
  assert.throws(()=>boundary.assertLearningAllowed(),/EVICTED_TERMINAL/);
  assert.deepEqual(boundary.snapshot().decisions,history);assert.equal(boundary.snapshot().childRightsModified,false);
});
test('provisional HARD is suspended rather than terminal; finalized AHIN eviction is conservative',()=>{
  const {boundary}=setup(),v=fixture();boundary.observeFixture({...v,verdict:{...v.verdict,decision:'FAIL',severity:'HARD',finality:'PROVISIONAL'}});
  assert.equal(boundary.snapshot().evicted,false);assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
  boundary.observeFixture({...v,sequence:1});boundary.assertLearningAllowed();
  boundary.observeFixture({...v,sequence:2,membership:'EVICTED'});assert.equal(boundary.snapshot().evicted,true);
});
test('expiry and invalid clock are rechecked at action time',()=>{
  const {boundary,advance}=setup();boundary.observeFixture(fixture());advance(2000);
  assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
  advance(999);assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
  const invalid=setup();invalid.boundary.observeFixture(fixture());invalid.advance(NaN);
  assert.throws(()=>invalid.boundary.assertLearningAllowed(),/CLOCK_INVALID/);
});
test('observed expiry stays latched through clock rollback and requires a fresh observation',()=>{
  const {boundary,advance}=setup(),v=fixture();boundary.observeFixture(v);
  advance(2000);assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
  advance(1500);assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);assert.equal(boundary.snapshot().learningEligible,false);
  assert.throws(()=>boundary.observeFixture({...v,sequence:1,issuedAt:1500,expiresAt:2500}),/CLOCK_ROLLBACK/);
  advance(2001);assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
  boundary.observeFixture({...v,sequence:1,issuedAt:2001,expiresAt:3000});boundary.assertLearningAllowed();
});
test('pre-expiry clock rollback or invalid time invalidates the current observation until renewal',()=>{
  for(const time of [1400,NaN,Infinity]){
    const {boundary,advance}=setup(),v=fixture();boundary.observeFixture(v);advance(1500);boundary.assertLearningAllowed();
    advance(time);assert.throws(()=>boundary.assertLearningAllowed(),/CLOCK_(ROLLBACK|INVALID)/);
    advance(1600);assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);
    boundary.observeFixture({...v,sequence:1,issuedAt:1600,expiresAt:2500});boundary.assertLearningAllowed();
  }
});
test('invalid, replayed or foreign observation clears an earlier PASS',()=>{
  const v=fixture();
  const invalid:unknown[]=[null,{}, {...v,mode:'LIVE'}, {...v,personaId:'real-child'}, {...v,personaId:'synthetic-other'},
    {...v,sourceHeads:{...v.sourceHeads,pocc:'0'.repeat(40)}}, {...v,privateKey:'no'},
    {...v,sequence:NaN},{...v,sequence:Number.MAX_SAFE_INTEGER+1},{...v,issuedAt:1001}, {...v,expiresAt:1000}, {...v,expiresAt:31_001},
    {...v,verdict:{...v.verdict,decision:'UNKNOWN'}},{...v,verdict:{...v.verdict,severity:'HARD'}},
    ...['decision','severity','finality'].map(key=>({...v,verdict:{...v.verdict,[key]:[(v.verdict as unknown as Record<string,unknown>)[key]]}})),
    {...v,kya:{...v.kya,level:[v.kya.level]}},{...v,membership:['ACTIVE']},
    {...v,kya:{...v.kya,active:'true'}},{...v,liveness:'true'},{...v,decisionControlDomains:[]},
    {...v,chainrank:{scoreMillionths:1_000_001,advisoryOnly:true}}, {...v,chainrank:{scoreMillionths:0,advisoryOnly:false}},
    {...v,chainrank:{scoreMillionths:0.2,advisoryOnly:true}}, v,
  ];
  for(const value of invalid){const {boundary}=setup();boundary.observeFixture(v);assert.throws(()=>boundary.observeFixture(value));assert.throws(()=>boundary.assertLearningAllowed(),/INELIGIBLE/);}
});
test('observation and snapshot aliases cannot modify decisions, source pins or eligibility',()=>{
  const {boundary}=setup(),v=structuredClone(fixture());boundary.observeFixture(v);
  (v as {membership:string}).membership='EVICTED';
  const snapshot=boundary.snapshot();(snapshot.decisions[0]!.fixture as {membership:string}).membership='EVICTED';snapshot.decisions.length=0;
  boundary.assertLearningAllowed();assert.equal(boundary.snapshot().decisions.length,1);assert.equal(Object.isFrozen(LIFEPP_CHILD_SOURCE_HEADS),true);
});
test('appeals are evidence-only, require separated humans and cannot rewrite the decision',()=>{
  const {boundary}=setup(),result=boundary.observeFixture(fixture()),v=appeal(result.decisionRoot),r=v.reviewers[0]!;
  const invalid=[{...v,reviewers:[]},{...v,reviewers:[r,r]},
    {...v,reviewers:[r,{...v.reviewers[1],controlDomain:r.controlDomain}]},
    {...v,reviewers:[{...r,controlDomain:'synthetic-original-reviewer-control'},v.reviewers[1]]},
    {...v,reviewers:[{...r,controlDomain:'synthetic-target-control'},v.reviewers[1]]},
    {...v,reviewers:[{...r,principal:'synthetic-persona'},v.reviewers[1]]},
    {...v,reviewers:[{...r,human:false},v.reviewers[1]]},
    {...v,reviewers:[{...r,conflict:true},v.reviewers[1]]},
    {...v,decisionRoot:`sha256:${'c'.repeat(64)}`},{...v,authorityRestored:true},
  ];
  for(const value of invalid)assert.throws(()=>boundary.recordAppealFixture(value));
  const before=boundary.snapshot().decisions;const pending=boundary.recordAppealFixture(v);
  assert.equal(pending.status,'PENDING_INDEPENDENT_REVIEW');assert.equal(pending.authorityRestored,false);
  assert.throws(()=>boundary.recordAppealFixture(v),/UNAVAILABLE/);assert.deepEqual(boundary.snapshot().decisions,before);
});
test('deterministic roots ignore object key ordering and history is bounded',()=>{
  const a=setup().boundary,b=setup().boundary,v=fixture();
  const reversed=Object.fromEntries(Object.entries(v).reverse());a.observeFixture(v);b.observeFixture(reversed);
  assert.equal(a.snapshot().historyRoot,b.snapshot().historyRoot);
  for(let sequence=1;sequence<128;sequence++)a.observeFixture({...v,sequence,verdict:{...v.verdict,id:`synthetic-verdict-${sequence}`}});
  assert.throws(()=>a.observeFixture({...v,sequence:128}),/HISTORY_LIMIT/);assert.throws(()=>a.assertLearningAllowed(),/INELIGIBLE/);
  assert.equal(a.snapshot().decisions.length,128);
});
test('appeal history cannot be mutated through aliases and its size limit fails closed',()=>{
  const {boundary}=setup(),decision=boundary.observeFixture(fixture()),v=structuredClone(appeal(decision.decisionRoot));
  boundary.recordAppealFixture(v);
  (v.reviewers[0] as {controlDomain:string}).controlDomain='synthetic-tampered';
  const snapshot=boundary.snapshot();snapshot.appeals.length=0;
  assert.equal(boundary.snapshot().appeals[0]!.fixture.reviewers[0]!.controlDomain,'synthetic-independent-a');
  for(let i=1;i<32;i++)boundary.recordAppealFixture({...appeal(decision.decisionRoot),appealId:`synthetic-appeal-${i}`});
  assert.throws(()=>boundary.recordAppealFixture({...appeal(decision.decisionRoot),appealId:'synthetic-overflow'}),/UNAVAILABLE/);
  assert.equal(boundary.snapshot().appeals.length,32);boundary.assertLearningAllowed();
});
