import {createHash} from 'node:crypto';

/** Reviewed source identifiers, not deployment or protocol-finality claims. */
export const LIFEPP_CHILD_SOURCE_HEADS=Object.freeze({
  cai:'463d4bb2bb476fbf9c718e43d48b14e3cca455bc',
  pocc:'65e5602c579e40c9b39d9fb742ce946b04d85aa0',
  ahin:'72a7d144c1920ee1c588800253f34e89469e0b05',
  chainrank:'e0707049a529b5bfbd847fc41d4efe4e6a3f99c8',
});
export const CHILD_FIXTURE_PROFILE='CanopyProof-Lifepp-Child-Fixture/1';
type JsonRecord=Record<string,unknown>;
type Decision='PASS'|'FAIL'|'ABSTAIN'|'PENDING_CHALLENGE';
type Finality='FINALIZED'|'PROVISIONAL'|'PENDING_CHALLENGE';
type Membership='CANDIDATE'|'PROBATION'|'ACTIVE'|'SUSPENDED'|'EVICTED';
export type ChildProtocolFixture=Readonly<{
  profile:typeof CHILD_FIXTURE_PROFILE;mode:'SIMULATION_ONLY';personaId:string;
  sequence:number;issuedAt:number;expiresAt:number;
  sourceHeads:typeof LIFEPP_CHILD_SOURCE_HEADS;
  verdict:Readonly<{id:string;decision:Decision;severity:'NONE'|'HARD';finality:Finality;evidenceRoot:string}>;
  kya:Readonly<{level:'KYA_0_UNVERIFIED'|'KYA_1_ACCOUNTABLE_OPERATOR'|'KYA_2_HUMAN_ANCHORED_DIGITAL_TWIN'|'KYA_3_HIGH_ASSURANCE_HUMAN_ANCHOR';active:boolean;continuity:boolean}>;
  membership:Membership;openChallenge:boolean;liveness:boolean;
  decisionControlDomains:readonly string[];
  chainrank:Readonly<{scoreMillionths:number;advisoryOnly:true}>;
}>;
export type AppealFixture=Readonly<{
  profile:typeof CHILD_FIXTURE_PROFILE;mode:'SIMULATION_ONLY';personaId:string;
  appealId:string;decisionRoot:string;counterevidenceRoot:string;
  reviewers:readonly Readonly<{principal:string;controlDomain:string;human:true;conflict:false}>[];
}>;

function fail(code:string):never{throw new Error(code);}
function record(value:unknown,keys:readonly string[]):JsonRecord{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('LIFEPP_FIXTURE_SHAPE');
  const result=value as JsonRecord;
  if(Object.keys(result).length!==keys.length||keys.some(key=>!Object.hasOwn(result,key)))fail('LIFEPP_FIXTURE_SHAPE');
  return result;
}
const synthetic=(v:unknown)=>typeof v==='string'&&/^synthetic-[a-z0-9-]{1,64}$/.test(v);
const digest=(v:unknown)=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const bool=(v:unknown)=>typeof v==='boolean';
const choice=(v:unknown,values:readonly string[])=>typeof v==='string'&&values.includes(v);
function canonical(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as JsonRecord)[key])}`).join(',')}}`;
}
const root=(domain:string,value:unknown)=>`sha256:${createHash('sha256').update(`${domain}\n${canonical(value)}`).digest('hex')}`;
const copy=<T>(value:T):T=>structuredClone(value);
function parseFixture(input:unknown):ChildProtocolFixture{
  const v=record(input,['profile','mode','personaId','sequence','issuedAt','expiresAt','sourceHeads','verdict','kya','membership','openChallenge','liveness','decisionControlDomains','chainrank']);
  if(v.profile!==CHILD_FIXTURE_PROFILE||v.mode!=='SIMULATION_ONLY'||!synthetic(v.personaId))fail('LIFEPP_SYNTHETIC_ONLY');
  if(!integer(v.sequence)||!integer(v.issuedAt)||!integer(v.expiresAt))fail('LIFEPP_FIXTURE_TIME');
  const pins=record(v.sourceHeads,['cai','pocc','ahin','chainrank']);
  if(Object.entries(LIFEPP_CHILD_SOURCE_HEADS).some(([key,sha])=>pins[key]!==sha))fail('LIFEPP_SOURCE_MISMATCH');
  const proof=record(v.verdict,['id','decision','severity','finality','evidenceRoot']);
  if(!synthetic(proof.id)||!digest(proof.evidenceRoot)||!choice(proof.decision,['PASS','FAIL','ABSTAIN','PENDING_CHALLENGE'])||!choice(proof.severity,['NONE','HARD'])||!choice(proof.finality,['FINALIZED','PROVISIONAL','PENDING_CHALLENGE']))fail('LIFEPP_VERDICT_INVALID');
  if((proof.severity==='HARD'&&proof.decision!=='FAIL')||(proof.decision==='PENDING_CHALLENGE'&&proof.finality!=='PENDING_CHALLENGE'))fail('LIFEPP_VERDICT_INVALID');
  const kya=record(v.kya,['level','active','continuity']);
  if(!choice(kya.level,['KYA_0_UNVERIFIED','KYA_1_ACCOUNTABLE_OPERATOR','KYA_2_HUMAN_ANCHORED_DIGITAL_TWIN','KYA_3_HIGH_ASSURANCE_HUMAN_ANCHOR'])||!bool(kya.active)||!bool(kya.continuity))fail('LIFEPP_KYA_INVALID');
  if(!choice(v.membership,['CANDIDATE','PROBATION','ACTIVE','SUSPENDED','EVICTED'])||!bool(v.openChallenge)||!bool(v.liveness))fail('LIFEPP_MEMBERSHIP_INVALID');
  const domains=v.decisionControlDomains;
  if(!Array.isArray(domains)||domains.length<1||domains.length>16||domains.some(x=>!synthetic(x))||new Set(domains).size!==domains.length)fail('LIFEPP_CONTROL_INVALID');
  const rank=record(v.chainrank,['scoreMillionths','advisoryOnly']);
  if(!integer(rank.scoreMillionths)||Number(rank.scoreMillionths)>1_000_000||rank.advisoryOnly!==true)fail('LIFEPP_CHAINRANK_ADVISORY_ONLY');
  return copy(v) as ChildProtocolFixture;
}

/** HOST-ONLY, synthetic composition gate. It neither verifies a live PoCC
 * certificate nor authenticates humans or independence. No I/O, keys, custody,
 * authorization issuance, enrollment, membership activation or deployment.
 * Permanent means terminal in this in-memory history, not durable across restart.
 * Production must supply an authenticated, durable protocol adapter instead. */
export function createLifeppChildBoundary(personaId:string,now:()=>number=Date.now){
  if(!synthetic(personaId))fail('LIFEPP_SYNTHETIC_ONLY');
  let current:ChildProtocolFixture|undefined,sequence=-1,evicted=false,lastObservedTime=-1;
  const decisions:{decisionRoot:string;fixture:ChildProtocolFixture}[]=[];
  const appeals:{appealRoot:string;fixture:AppealFixture;status:'PENDING_INDEPENDENT_REVIEW'}[]=[];
  const appealIds=new Set<string>();
  function clock(){
    const value=now();
    if(!integer(value)){current=undefined;fail('LIFEPP_CLOCK_INVALID');}
    if(value<lastObservedTime){current=undefined;fail('LIFEPP_CLOCK_ROLLBACK');}
    lastObservedTime=value;return value;
  }
  function allowed(){
    if(evicted||!current)return false;
    const v=current,time=clock();
    // Observed expiry is latched. A clock rollback/catch-up cannot revive a
    // consumed observation; recovery requires a new monotonically sequenced one.
    if(time<v.issuedAt||time>=v.expiresAt){current=undefined;return false;}
    return v.verdict.decision==='PASS'&&v.verdict.severity==='NONE'&&v.verdict.finality==='FINALIZED'
      &&v.membership==='ACTIVE'&&!v.openChallenge&&v.liveness&&v.kya.active&&v.kya.continuity
      &&['KYA_2_HUMAN_ANCHORED_DIGITAL_TWIN','KYA_3_HIGH_ASSURANCE_HUMAN_ANCHOR'].includes(v.kya.level);
  }
  return Object.freeze({
    observeFixture(input:unknown){
      // A malformed/newer observation must never leave an earlier PASS usable.
      current=undefined;
      if(evicted)fail('LIFEPP_EVICTED_TERMINAL');
      const v=parseFixture(input),time=clock();
      if(v.personaId!==personaId)fail('LIFEPP_PERSONA_MISMATCH');
      if(v.sequence<=sequence)fail('LIFEPP_FIXTURE_REPLAY');
      if(v.issuedAt>time||v.expiresAt<=time||v.expiresAt<=v.issuedAt||v.expiresAt-v.issuedAt>30_000)fail('LIFEPP_FIXTURE_STALE');
      if(decisions.length>=128)fail('LIFEPP_HISTORY_LIMIT');
      const decisionRoot=root('CanopyProof Lifepp child fixture decision v1',v);
      decisions.push({decisionRoot,fixture:v});sequence=v.sequence;current=v;
      // Never let rank, a replacement PASS, or an appeal clear same-Persona eviction.
      evicted=v.membership==='EVICTED'||(v.verdict.decision==='FAIL'&&v.verdict.severity==='HARD'&&v.verdict.finality==='FINALIZED');
      return {decisionRoot,syntheticOnly:true as const,learningEligible:allowed(),evicted};
    },
    assertLearningAllowed(){if(!allowed())fail(evicted?'LIFEPP_EVICTED_TERMINAL':'LIFEPP_LEARNING_INELIGIBLE');},
    recordAppealFixture(input:unknown){
      const v=record(input,['profile','mode','personaId','appealId','decisionRoot','counterevidenceRoot','reviewers']);
      if(v.profile!==CHILD_FIXTURE_PROFILE||v.mode!=='SIMULATION_ONLY'||v.personaId!==personaId||!synthetic(v.appealId)||!digest(v.decisionRoot)||!digest(v.counterevidenceRoot))fail('LIFEPP_APPEAL_INVALID');
      const decision=decisions.find(d=>d.decisionRoot===v.decisionRoot);
      if(!decision||appealIds.has(String(v.appealId))||appeals.length>=32)fail('LIFEPP_APPEAL_UNAVAILABLE');
      if(!Array.isArray(v.reviewers)||v.reviewers.length<2||v.reviewers.length>16)fail('LIFEPP_APPEAL_INDEPENDENCE');
      const principals=new Set<string>(),domains=new Set<string>();
      for(const value of v.reviewers){
        const r=record(value,['principal','controlDomain','human','conflict']);
        if(!synthetic(r.principal)||!synthetic(r.controlDomain)||r.human!==true||r.conflict!==false||r.principal===personaId||principals.has(String(r.principal))||domains.has(String(r.controlDomain))||decision.fixture.decisionControlDomains.includes(String(r.controlDomain)))fail('LIFEPP_APPEAL_INDEPENDENCE');
        principals.add(String(r.principal));domains.add(String(r.controlDomain));
      }
      const fixture=copy(v) as AppealFixture,appealRoot=root('CanopyProof Lifepp child fixture appeal v1',fixture);
      appeals.push({appealRoot,fixture,status:'PENDING_INDEPENDENT_REVIEW'});appealIds.add(fixture.appealId);
      return {appealRoot,status:'PENDING_INDEPENDENT_REVIEW' as const,authorityRestored:false as const};
    },
    snapshot(){return copy({personaId,mode:'SIMULATION_ONLY',evicted,learningEligible:allowed(),sequence,
      decisions,appeals,historyRoot:root('CanopyProof Lifepp child fixture history v1',{decisions,appeals}),
      caiSigner:false,chainrankAuthorization:false,productionAuthority:false,productionEnrollment:false,
      custodyEnabled:false,assetExecution:false,certifiedImpactIssuance:false,childRightsModified:false,
      durableRestartProtection:false,appealResolutionImplemented:false});},
  });
}
