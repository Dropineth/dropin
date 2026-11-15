/** Care continuity application contract. Not a replacement for AHIN/PoCC authority. */
export const VERSION = 'canopyproof-care-v2';
export const CATEGORIES = Object.freeze(['water','hygiene','air','health','food','protection']);
export const ISSUES = Object.freeze({water: ['no_supply','access_difficulty','quality_concern'], hygiene: ['washing_unavailable','toilet_unavailable','wastewater']});
export const STAGES = Object.freeze(['RECEIVED','ASSIGNED','ACCEPTED','BLOCKED','ACTION_RECORDED','VERIFIED','CLOSED','REOPENED']);
const ROLE_ACTIONS = Object.freeze({
  dispatcher: ['ASSIGN','HANDOFF_REQUEST','ESCALATE'],
  responder: ['ACCEPT','BLOCK','RECORD_ACTION','HANDOFF_REQUEST','HANDOFF_ACCEPT'],
  reviewer: ['REVIEW'], reporter: ['FEEDBACK'], auditor: []
});
export const AHIN_ACTIONS = Object.freeze({RECEIVE:'ASSERT', ASSIGN:'DELEGATE', ACCEPT:'ASSERT', BLOCK:'REASON', RECORD_ACTION:'FULFILL', REVIEW:'ASSERT', FEEDBACK:'ASSERT', HANDOFF_REQUEST:'DELEGATE', HANDOFF_ACCEPT:'ASSERT', ESCALATE:'DELEGATE'});
export class CareError extends Error { constructor(code, status=400) {super(code);this.name='CareError';this.code=code;this.status=status;} }
export const fail = (code, status=400) => {throw new CareError(code,status);};
export function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value)!==Object.prototype) fail('INVALID_OBJECT');
  if(Object.keys(value).some(k=>!keys.includes(k))) fail('UNEXPECTED_FIELD');
}
export const identifier = value => typeof value==='string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,95}$/.test(value);
export function choice(value, values) {if(!values.includes(value)) fail('INVALID_CHOICE'); return value;}
export function canonical(value) {
  if(value===null || typeof value==='boolean' || typeof value==='string') return JSON.stringify(value);
  if(typeof value==='number' && Number.isFinite(value)) return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object' && Object.getPrototypeOf(value)===Object.prototype) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  fail('NON_CANONICAL_VALUE');
}
export function requireAuthority(grant, principal, serviceId, now, action='READ') {
  if(!grant || !principal || !identifier(principal.actorId) || !identifier(principal.tenantId)) fail('AUTH_REQUIRED',401);
  if(grant.actorId!==principal.actorId || grant.tenantId!==principal.tenantId || grant.role!==principal.role) fail('AUTH_MISMATCH',403);
  if(!Object.hasOwn(ROLE_ACTIONS,grant.role)||!Number.isSafeInteger(grant.validFrom)||grant.revoked || !Number.isSafeInteger(grant.version) || !Number.isFinite(grant.validUntil) || grant.validUntil<=now || grant.validFrom>now) fail('AUTH_REVOKED_OR_EXPIRED',403);
  if(!Array.isArray(grant.serviceIds)||!grant.serviceIds.includes(serviceId)) fail('SERVICE_SCOPE_DENIED',403);
  if(action!=='READ' && !ROLE_ACTIONS[grant.role]?.includes(action)) fail('ROLE_DENIED',403);
  return grant;
}
export function validateIntake(input, service, now) {
  exact(input,['serviceId','category','issue','channel','observedAt']);
  if(!identifier(input.serviceId) || !service || input.serviceId!==service.id) fail('SERVICE_NOT_FOUND',404);
  if(!Object.hasOwn(ISSUES,input.category)) fail('ADULT_CHANNEL_NOT_CONNECTED',503);
  if(service.category!==input.category || service.acceptingReports!==true) fail('SERVICE_NOT_ACCEPTING',503);
  choice(input.issue,ISSUES[input.category]);choice(input.channel,['self','assisted']);
  if(input.observedAt!==undefined && (!Number.isSafeInteger(input.observedAt)||input.observedAt<0||input.observedAt>now+60000)) fail('INVALID_OBSERVED_AT');
  return {serviceId:input.serviceId,category:input.category,issue:input.issue,channel:input.channel,observedAt:input.observedAt??now};
}
export function initialState(id, tenantId, input, now) {
  return {id,tenantId,serviceId:input.serviceId,category:input.category,issue:input.issue,channel:input.channel,
    observedAt:input.observedAt,receivedAt:now,updatedAt:now,stage:'RECEIVED',revision:1,
    assignedTo:null,handoffTo:null,actionBy:null,actionOrg:null,actionAt:null,actionEvidence:null,actionEvidenceDigest:null,reviewEvidence:null,reviewEvidenceDigest:null,reviewBy:null,
    actionOutcome:null,reviewOutcome:null,blockReason:null,feedback:null,feedbackAt:null,
    escalations:0,childAccountRequired:false,chainRankDelta:0,waterSafety:'unknown'};
}
export function validateCommand(command, now) {
  exact(command,['type','expectedRevision','nonce','grantVersion','issuedAt','expiresAt','payload']);
  if(!Object.hasOwn(AHIN_ACTIONS,command.type)||command.type==='RECEIVE') fail('INVALID_ACTION');
  if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<1) fail('INVALID_REVISION');
  if(!Number.isSafeInteger(command.grantVersion)||command.grantVersion<1) fail('INVALID_GRANT_VERSION');
  if(typeof command.nonce!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(command.nonce)) fail('INVALID_NONCE');
  if(!Number.isSafeInteger(command.issuedAt)||!Number.isSafeInteger(command.expiresAt)||command.issuedAt>now+30000||command.expiresAt<=now||command.expiresAt<=command.issuedAt||command.expiresAt-command.issuedAt>300000) fail('COMMAND_EXPIRED_OR_INVALID',409);
  exact(command.payload, payloadKeys(command.type));return command;
}
function payloadKeys(action) {
  return ({ASSIGN:['actorId'],ACCEPT:[],BLOCK:['reason'],RECORD_ACTION:['outcome','evidenceId'],REVIEW:['outcome','evidenceId'],FEEDBACK:['result'],HANDOFF_REQUEST:['actorId'],HANDOFF_ACCEPT:[],ESCALATE:['reason']})[action];
}
function evidence(ctx, id, state, now, expectedAuthor) {
  if(!identifier(id)) fail('INVALID_EVIDENCE');const e=ctx.evidence(id);
  if(!e||e.tenantId!==state.tenantId||e.serviceId!==state.serviceId||e.privacyReviewed!==true||e.revoked||!e.license||!e.sourceDigest?.match(/^[a-f0-9]{64}$/)||!Number.isSafeInteger(e.observedAt)||e.observedAt>now||!Number.isSafeInteger(e.expiresAt)||e.expiresAt<=now||e.observedAt<state.receivedAt) fail('EVIDENCE_INVALID_OR_STALE',409);
  if(expectedAuthor&&e.authorId!==expectedAuthor) fail('EVIDENCE_AUTHOR_MISMATCH',403);
  return e;
}
function target(ctx,id,state,now) {
  if(!identifier(id)) fail('INVALID_TARGET');const g=ctx.grant(id);
  requireAuthority(g,{actorId:id,tenantId:state.tenantId,role:'responder'},state.serviceId,now);
  if(g.onDuty!==true) fail('TARGET_UNAVAILABLE',409);return g;
}
export function transition(state, command, principal, grant, now, ctx) {
  validateCommand(command,now);
  requireAuthority(grant,principal,state.serviceId,now,command.type);
  if(grant.version!==command.grantVersion) fail('AUTH_VERSION_CONFLICT',409);
  if(state.tenantId!==principal.tenantId) fail('NOT_FOUND',404);
  if(command.expectedRevision!==state.revision) fail('REVISION_CONFLICT',409);
  if(!Number.isSafeInteger(now)||now<state.updatedAt) fail('CLOCK_ROLLBACK',409);
  const p=command.payload, next=structuredClone(state), actor=principal.actorId;
  const stages=(allowed)=>{if(!allowed.includes(state.stage))fail('INVALID_TRANSITION',409);};
  const assigned=()=>{if(state.assignedTo!==actor)fail('NOT_ASSIGNED',403);};
  switch(command.type) {
    case 'ASSIGN':
      stages(['RECEIVED','REOPENED']);target(ctx,p.actorId,state,now);
      next.assignedTo=p.actorId;next.stage='ASSIGNED';next.handoffTo=null;next.blockReason=null;break;
    case 'ACCEPT':
      stages(['ASSIGNED']);assigned();if(grant.onDuty!==true)fail('RESPONDER_OFF_DUTY',409);
      next.stage='ACCEPTED';break;
    case 'BLOCK':
      stages(['ACCEPTED','BLOCKED']);assigned();
      next.blockReason=choice(p.reason,['supply_shortage','access_restricted','weather','capacity','connection']);next.stage='BLOCKED';break;
    case 'HANDOFF_REQUEST':
      stages(['ASSIGNED','ACCEPTED','BLOCKED']);
      if(principal.role==='responder')assigned();if(p.actorId===state.assignedTo)fail('SAME_HANDOFF_TARGET');
      target(ctx,p.actorId,state,now);next.handoffTo=p.actorId;break;
    case 'HANDOFF_ACCEPT':
      stages(['ASSIGNED','ACCEPTED','BLOCKED']);if(state.handoffTo!==actor)fail('NOT_HANDOFF_TARGET',403);
      if(grant.onDuty!==true)fail('RESPONDER_OFF_DUTY',409);
      next.assignedTo=actor;next.handoffTo=null;next.blockReason=null;next.stage='ACCEPTED';break;
    case 'RECORD_ACTION':
      stages(['ACCEPTED','BLOCKED']);assigned();if(grant.onDuty!==true)fail('RESPONDER_OFF_DUTY',409);
      const actionEvidence=evidence(ctx,p.evidenceId,state,now,actor);
      next.actionEvidenceDigest=actionEvidence.sourceDigest;
      next.actionOutcome=choice(p.outcome,['restored','partial','not_restored']);
      next.actionBy=actor;next.actionOrg=grant.organizationId;next.actionAt=now;next.actionEvidence=p.evidenceId;
      next.reviewBy=null;next.reviewOutcome=null;next.reviewEvidence=null;next.reviewEvidenceDigest=null;next.stage='ACTION_RECORDED';next.handoffTo=null;break;
    case 'REVIEW': {
      stages(['ACTION_RECORDED']);
      if(actor===state.actionBy||grant.organizationId===state.actionOrg)fail('INDEPENDENT_REVIEW_REQUIRED',403);
      const priorEvidence=evidence(ctx,state.actionEvidence,state,now);
      if(priorEvidence.sourceDigest!==state.actionEvidenceDigest)fail('EVIDENCE_VERSION_CHANGED',409);
      const e=evidence(ctx,p.evidenceId,state,now,actor);
      if(!Number.isSafeInteger(state.actionAt)||e.observedAt<state.actionAt)fail('REVIEW_PREDATES_ACTION',409);
      if(e.id===state.actionEvidence||e.sourceDigest===ctx.evidence(state.actionEvidence).sourceDigest)fail('INDEPENDENT_EVIDENCE_REQUIRED',403);
      next.reviewEvidence=e.id;next.reviewEvidenceDigest=e.sourceDigest;next.reviewBy=actor;next.reviewOutcome=choice(p.outcome,['confirmed','inconclusive','not_resolved']);
      next.stage=(p.outcome==='confirmed'&&state.actionOutcome==='restored')?'VERIFIED':p.outcome==='not_resolved'?'REOPENED':'ACTION_RECORDED';break;
    }
    case 'FEEDBACK':
      if(grant.ticketId!==state.id)fail('REPORT_SCOPE_DENIED',403);
      next.feedback=choice(p.result,['resolved','still_needed','cannot_confirm','withdraw_participation']);next.feedbackAt=now;
      if(p.result==='resolved') {stages(['VERIFIED']);next.stage='CLOSED';}
      if(p.result==='still_needed'&&['ACTION_RECORDED','VERIFIED','CLOSED'].includes(state.stage)){next.stage='REOPENED';next.reviewBy=null;next.reviewOutcome=null;}
      // Withdrawing participation does not erase a community facility issue or certify success.
      break;
    case 'ESCALATE':
      if(state.stage==='CLOSED')fail('INVALID_TRANSITION',409);
      choice(p.reason,['no_response','need_capacity','access_restricted']);next.escalations++;break;
    default: fail('INVALID_ACTION');
  }
  next.revision++;next.updatedAt=now;next.chainRankDelta=0;next.waterSafety='unknown';
  return next;
}
export function childView(state) {
  return {id:state.id,category:state.category,issue:state.issue,stage:state.stage,revision:state.revision,
    receivedAt:state.receivedAt,updatedAt:state.updatedAt,handoffPending:state.handoffTo!==null,
    actionOutcome:state.actionOutcome,reviewOutcome:state.reviewOutcome,feedback:state.feedback,
    waterSafety:'unknown',childAccountRequired:false,chainRankDelta:0};
}
export function canUseObservation(observation, now) {
  return !!observation && observation.privacyReviewed===true && observation.permission==='active' && !observation.revoked && Number.isSafeInteger(observation.capturedAt) && observation.capturedAt<=now && observation.validUntil>now;
}
export function publicAggregate() {
  // Suppressed until local disclosure rules and approved aggregation thresholds exist.
  return {status:'WITHHELD_PENDING_DISCLOSURE_REVIEW',uniqueChildren:null,locations:null,cases:null};
}
export function readiness(config={}) {
  const requirements=['operator','serviceRoster','dataRegion','authorityAdapter','postgresRuntimeTests','privacyReview','safeguarding','backupRecovery','monitoring','productionAcceptance'];
  return {mode:'CLOSED',activationAllowed:false,reason:'LIVE_ACTIVATION_NOT_IMPLEMENTED',checks:requirements.map(k=>({id:k,verified:config[k]===true})),realEnrollment:false,dispatch:false};
}

/** App event mapping only; no changes to the existing AHIN protocol. */
export function ahinActionFor(type,payload={}) {
  if(type==='FEEDBACK'&&payload.result==='still_needed')return 'CHALLENGE';
  return AHIN_ACTIONS[type];
}
