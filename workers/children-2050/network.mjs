import { childView, STAGES as CARE_STAGES } from '../../dropin-earth/integrations/care-continuity-v2/src/domain.mjs';
/**
 * Global-to-child read-model boundary. Pure functions, no IO or authorization minting.
 * Call only with CURRENT authenticated identity, grants and server-owned snapshots.
 * The Worker exposes static readiness only; personalized data is NOT activated here.
 */
export const NETWORK_SCHEMA = 'canopyproof:child-network:v1';
const TYPES = new Set(['project','asset','care']);
const STAGES = new Set(CARE_STAGES);
const ASSET_KINDS = new Set(['terrain_dsm','photogrammetry','lidar','gaussian_splat','illustration']);
const MAX_ITEMS = 200;
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{2,127}$/.test(x);
const time = x => Number.isSafeInteger(x) && x >= 0;
const text = (x,max=160) => typeof x === 'string' && x.length > 0 && x.length <= max && !/[\u0000-\u001f\u007f]/.test(x);
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export class NetworkError extends Error {
  constructor(code,status=400){super(code);this.name='NetworkError';this.code=code;this.status=status;}
}
const reject = (code,status=400) => {throw new NetworkError(code,status);};
const array = (x,name) => {
  if(!Array.isArray(x)||x.length>MAX_ITEMS)reject('INVALID_'+name);
  return x;
};
function unique(rows,name) {
  const seen=new Set();for(const row of array(rows,name)){
    if(!row||!id(row.id)||seen.has(row.id))reject('INVALID_'+name);
    seen.add(row.id);
  }
  return rows;
}
export function networkReadiness() {
  // Intentionally not toggled by a request, environment flag or Access sign-in.
  return {
    schema:NETWORK_SCHEMA,mode:'protected_editorial',personalizedHome:'not_connected',
    accountOpening:'not_connected',captureDispatch:'not_connected',careDelivery:'not_connected',
    spatial:{assessmentGrid:{system:'regional_laea_hex',sizeKind:'flat_to_flat',metres:3000},
      proposedGlobalIndex:'h3',globalIndexDeployment:'not_attested',globalReconstruction:'not_attested'},
    threeD:{viewerIntegration:'not_connected',assetCount:null,liveCapture:false},
    ledgers:{learning:null,participation:null,footprintKgCO2e:null,verifiedRemovalKgCO2e:null},
    localOperatorCount:null,childCount:null,chainRankWrite:false,
    privateRecordsCentralized:false,schoolRequiredForBasicHelp:false,deviceRequiredForBasicHelp:false
  };
}
export function currentGrant(context,resource,type) {
  if(!context||!resource||!TYPES.has(type)||!time(context.now))return false;
  const {principal,grants,now}=context;
  if(!principal||!id(principal.actorId)||!id(principal.subjectId)||!id(principal.tenantId)||!Array.isArray(grants)||grants.length>1000)return false;
  if(resource.tenantId!==principal.tenantId||!id(resource.id)||!Number.isSafeInteger(resource.version)||resource.version<1||resource.revoked!==false)return false;
  return grants.some(g=>g&&g.actorId===principal.actorId&&g.subjectId===principal.subjectId&&g.tenantId===principal.tenantId&&
    g.resourceType===type&&g.resourceId===resource.id&&g.resourceVersion===resource.version&&g.action==='read'&&
    g.revoked===false&&time(g.validFrom)&&time(g.validUntil)&&g.validFrom<=now&&now<g.validUntil);
}
function sourceProjection(s,now) {
  if(!s||!id(s.id)||!text(s.version)||!text(s.licenseId)||s.reuseApproved!==true||s.withdrawn!==false||
     !hash(s.digest)||!time(s.observedAt)||s.observedAt>now||!time(s.reviewedAt)||s.reviewedAt>now||
     !time(s.validUntil)||s.validUntil<=now||!['observed','modelled','illustrative'].includes(s.kind))return null;
  return {id:s.id,version:s.version,licenseId:s.licenseId,digest:s.digest,observedAt:s.observedAt,
    kind:s.kind,measurementResolutionM:Number.isFinite(s.resolutionM)&&s.resolutionM>0?s.resolutionM:null,
    fieldVerified:s.kind==='observed'&&s.fieldVerified===true};
}
export function assetForChild(asset,project,context) {
  if(!asset||!project||!currentGrant(context,project,'project')||!currentGrant(context,asset,'asset')||
    asset.projectId!==project.id||asset.privacyReview!=='approved'||asset.releaseStatus!=='released'||
    !ASSET_KINDS.has(asset.kind)||!time(asset.capturedAt)||asset.capturedAt>context.now||
    !time(asset.validUntil)||asset.validUntil<=context.now||asset.revoked!==false||
    !hash(asset.digest)||!text(asset.crs)||!text(asset.verticalDatum))return null;
  const source=sourceProjection(asset.source,context.now);if(!source)return null;
  // An illustration is never reclassified as a scan. A DSM is never full 3D.
  if((asset.kind==='illustration')!==(source.kind==='illustrative'))return null;
  if(['photogrammetry','lidar','gaussian_splat'].includes(asset.kind)&&source.kind!=='observed')return null;
  return {id:asset.id,version:asset.version,kind:asset.kind,capturedAt:asset.capturedAt,
    digest:asset.digest,source,representation:asset.kind==='terrain_dsm'?'2.5d_surface':asset.kind==='illustration'?'illustration':'reconstructed_scene',
    geometricErrorM:Number.isFinite(asset.geometricErrorM)&&asset.geometricErrorM>=0?asset.geometricErrorM:null,
    endpointStatus:'object_gateway_required',assetURL:null,live:false,carbonRemovalKgCO2e:null};
}
export function serviceForChild(service,project,context) {
  if(!service||!project||!currentGrant(context,project,'project')||service.tenantId!==context.principal.tenantId||
    !id(service.id)||!id(service.operatorId)||!text(service.publicName)||service.verified!==true||service.safeguarding!=='approved'||
    !Array.isArray(service.projectIds)||!service.projectIds.includes(project.id)||service.revoked!==false||
    !time(service.validFrom)||!time(service.validUntil)||service.validFrom>context.now||service.validUntil<=context.now||
    !Number.isFinite(service.capacity)||service.capacity<=0||service.onDuty!==true)return null;
  if(!Array.isArray(service.capabilities)||!service.capabilities.every(x=>['ecology','water','hygiene','health','protection'].includes(x)))return null;
  // Capability/area verification is NOT a message delivery or an accepted case.
  return {id:service.id,name:service.publicName,capabilities:[...new Set(service.capabilities)],
    responseStatus:'not_requested',dispatchEnabled:false,contact:null};
}
export function careForChild(record,context) {
  if(!record||!currentGrant(context,record,'care')||record.subjectId!==context.principal.subjectId)return null;
  const state=record.state;
  if(!state||state.id!==record.id||state.tenantId!==record.tenantId||state.revision!==record.version||
    !['water','hygiene'].includes(state.category)||!STAGES.has(state.stage)||!time(state.updatedAt)||state.updatedAt>context.now)return null;
  const view=childView(state); // Reuse the existing core; strip additional private details.
  return {id:view.id,version:view.revision,category:view.category,stage:view.stage,updatedAt:view.updatedAt,
    responseConfirmed:['ACCEPTED','BLOCKED','ACTION_RECORDED','VERIFIED','CLOSED'].includes(view.stage),
    handoffPending:view.handoffPending,chainRankDelta:view.chainRankDelta,waterSafety:view.waterSafety};
}
export function buildChildHome(snapshot,context) {
  if(!snapshot||!context?.principal||!time(context.now))reject('AUTH_REQUIRED',401);
  const p=context.principal;
  if(!id(p.actorId)||!id(p.subjectId)||!id(p.tenantId)||snapshot.tenantId!==p.tenantId||snapshot.subjectId!==p.subjectId)reject('SCOPE_DENIED',403);
  if(!time(snapshot.generatedAt)||snapshot.generatedAt>context.now||!time(snapshot.validUntil)||snapshot.validUntil<=context.now)reject('STALE_SNAPSHOT',409);
  const projects=unique(snapshot.projects,'PROJECTS'),assets=unique(snapshot.assets,'ASSETS'),services=unique(snapshot.services,'SERVICES'),cases=unique(snapshot.care,'CASES');
  const refs=array(snapshot.projectRefs,'PROJECT_REFS');if(!refs.every(id)||new Set(refs).size!==refs.length)reject('INVALID_PROJECT_REFS');
  const locale=p.preferredLocale==='zh'?'zh':'en'; // Explicit preference, never a coordinate inference.
  const cards=[];
  for(const project of projects){
    if(!refs.includes(project.id)||!currentGrant(context,project,'project')||!project.titles||
      !text(project.titles[locale])||project.participationReview!=='approved'||project.privacyReview!=='approved')continue;
    const evidence=array(project.evidence,'EVIDENCE').map(x=>sourceProjection(x,context.now)).filter(Boolean);
    cards.push({id:project.id,version:project.version,title:project.titles[locale],
      evidence,assets:assets.filter(x=>x.projectId===project.id).map(x=>assetForChild(x,project,context)).filter(Boolean),
      services:services.map(x=>serviceForChild(x,project,context)).filter(Boolean),
      plantingPermission:'not_determined',speciesSuitability:'not_determined',netCarbonKgCO2e:null});
  }
  return {schema:NETWORK_SCHEMA,locale,requestedLocale:text(p.preferredLocale,40)?p.preferredLocale:null,
    projects:cards,care:cases.map(x=>careForChild(x,context)).filter(Boolean),
    accountState:'read_model_only',ledgers:networkReadiness().ledgers,globalClaims:networkReadiness().spatial,
    permissions:{dispatch:false,enroll:false,changeChainRank:false},
    spatialPrivacy:'No child coordinates, grid IDs, raw asset URLs or health details in this projection.'};
}
