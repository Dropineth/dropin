import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { applyRightsOperation, createEmptyRightsState } from '../../services/api/src/domain/child-stewardship/rights.js';
import { rightsDigest, rightsOperationBytes } from '../../services/api/src/domain/child-stewardship/authorization.js';
import type { RightsApproval, RightsContext, RightsCredential, RightsOperation, RightsOperationType, RightsRole, RightsState } from '../../services/api/src/domain/child-stewardship/rights-types.js';

/** Ephemeral synthetic Ed25519 keys generated per fixture; never persisted or networked. */
export const now = '2026-10-23T12:00:00Z';
export const before = '2026-01-01T00:00:00Z';
export const after = '2027-01-01T00:00:00Z';
export type SyntheticRightsClock = {now:string;before:string;after:string};
const historicalClock: SyntheticRightsClock = {now,before,after};
const operationTypes: RightsOperationType[] = ['REGISTER_BENEFICIARY','CONFIRM_CONTRIBUTION','RECORD_OBLIGATION','RECORD_CLEARED_FUNDING','RESERVE_OUTCOME','RESERVE_FUNDING','VEST','PAY_PROTECTED','PAY_EXCEPTIONAL','PAY_EMERGENCY','PAYMENT_RESULT','REFUND','PAUSE','RESUME','ROTATE_GUARDIAN_KEY','RECOVER_GUARDIAN_KEY','CHANGE_GUARDIAN','CAPACITY_TRANSFER','LEGAL_CORRECTION','POLICY_CHANGE','GRANT_DELEGATION','REVOKE_DELEGATION'];
export function createSyntheticRightsFixture(clock: SyntheticRightsClock = historicalClock) {
  const {now,before,after}=clock;
  const secrets = new Map<string, KeyObject>();
  const credentials: RightsCredential[] = [];
  for (const [keyId, role] of [['g','G'],['b','B'],['v1','V'],['v2','V'],['v3','V'],['r1','R'],['r2','R'],['r3','R'],['t','T'],['a','A'],['c','C'],['x','X'],['community','COMMUNITY'],['o','O']] as [string,RightsRole][]) {
    const pair = generateKeyPairSync('ed25519'); secrets.set(keyId,pair.privateKey);
    credentials.push({ keyId, role, actorRef: `actor-${keyId}`, publicKeyPem: pair.publicKey.export({type:'spki',format:'pem'}).toString(), controlDomainId: `domain-${keyId}`, legalEntityRef: `entity-${keyId}`, appointmentEvidenceRef: 'appointment-synthetic', independenceEvidenceRef: 'independence-synthetic', independenceVerifiedUntil: after, validAfter: before, expiresAt: after, revoked: false, isAgent: false, externalToOperatorAndSchool: !['v1','v2','o','g'].includes(keyId), conflictBeneficiaryRefs: [] });
  }
  const context: RightsContext = { now, environment:'SIMULATION_ONLY', domainSeparator:'synthetic-rights-local', signerRegistryVersion:'signers-v1', controlDomainRegistryVersion:'domains-v1', conflictCheckVersion:'conflicts-v1', credentials, entitlementPolicies:{}, restorationVerified:true, minimumEpochs:{}, executedOperationCheckpoint:[], legalEvidenceRefs:['legal-synthetic','decision-synthetic','capacity-synthetic','resolution-synthetic'], notices:{ 'notice-recovery':{beneficiaryRef:'beneficiary-a',issuedAt:before,kind:'recovery',operationDigest:''},'notice-payment':{beneficiaryRef:'beneficiary-a',issuedAt:before,kind:'payment',operationDigest:''},'notice-policy':{beneficiaryRef:'beneficiary-a',issuedAt:before,kind:'policy',operationDigest:''} }, policy:{version:'policy-v1',jurisdictionPolicyRef:'jurisdiction-synthetic',allowedPurposes:['LEARNING_SUPPORT'],allowedOperationTypes:operationTypes,validAfter:before,expiresAt:after,periodId:'period-one',perPaymentLimitMinor:100_000,beneficiaryPeriodLimitMinor:100_000,destinationPeriodLimitMinor:100_000,verificationPanelKeyIds:['v1','v2','v3'],protectionPanelKeyIds:['r1','r2','r3'],governancePanelKeyIds:['r1','r2','t','x','community','o'],contributionObjectionMs:7*86_400_000,exceptionalPaymentWaitMs:72*3_600_000,recoveryWaitMs:7*86_400_000,policyNoticeMs:30*86_400_000} };
  const state = createEmptyRightsState();
  state.beneficiaries['beneficiary-a'] = {ref:'beneficiary-a',legalSubjectRef:'canonical-a',guardianActorRef:'actor-g',guardianKeyId:'g',controllerRef:'actor-c',participantKeyId:null,authorizationEpoch:0,legalBasisRef:'legal-synthetic',status:'active'};
  state.destinations['destination-a'] = {ref:'destination-a',version:1,destinationDigest:'a'.repeat(64),beneficiaryRef:'beneficiary-a',relatedControlDomainIds:[],protected:true,active:true,allowedPurposeCodes:['LEARNING_SUPPORT'],cumulativeGroupRef:'related-destinations-a'};
  let sequence = 0;
  function operation(type: RightsOperationType, patch: Partial<RightsOperation> = {}): RightsOperation {
    sequence++;
    const result: RightsOperation = { protocol:'CanopyProof-Rights/0.1-proposal',operationId:`operation-${sequence}`,operationType:type,beneficiaryRef:'beneficiary-a',entitlementIds:[],policyVersion:context.policy.version,signerRegistryVersion:context.signerRegistryVersion,controlDomainRegistryVersion:context.controlDomainRegistryVersion,conflictCheckVersion:context.conflictCheckVersion,legalBasisRef:'legal-synthetic',evidenceBundleRef:`evidence-${sequence}`,purposeCode:'LEARNING_SUPPORT',recipientBindingRef:null,recipientBindingVersion:0,recipientDestinationDigest:null,amountMinor:0,currency:'XTS',feesMinor:0,fundingLotIds:[],validAfter:before,expiresAt:after,nonce:`nonce-${sequence}`,authorizationEpoch:0,delegationId:null,jurisdictionPolicyRef:'jurisdiction-synthetic',environment:'SIMULATION_ONLY',domainSeparator:'synthetic-rights-local',details:{},...patch };
    const noticeRef = result.details.notificationEvidenceRef;
    if (noticeRef && context.notices[noticeRef]) context.notices[noticeRef]!.operationDigest = rightsDigest(result);
    return result;
  }
  function approvals(op: RightsOperation, ids: string[]): RightsApproval[] {
    const payload = rightsOperationBytes(op);
    return ids.map(keyId => ({keyId,algorithm:'Ed25519',payloadBase64:Buffer.from(payload).toString('base64'),signatureBase64:sign(null,payload,secrets.get(keyId)!).toString('base64')}));
  }
  function apply(input: RightsState, op: RightsOperation, ids: string[]) { return applyRightsOperation(input,op,approvals(op,ids),context); }
  function funded(amount = 100) {
    let result = apply(state,operation('RECORD_OBLIGATION',{amountMinor:amount,entitlementIds:['entitlement-a'],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:after,contributionRequired:false}}),['r1','t']);
    result = apply(result,operation('VEST',{amountMinor:amount,entitlementIds:['entitlement-a']}),['r1','t']);
    result = apply(result,operation('RECORD_CLEARED_FUNDING',{amountMinor:amount,details:{fundingLotId:'funding-a',clearingReceiptRef:'clearing-a'}}),['r1','t']);
    return apply(result,operation('RESERVE_FUNDING',{amountMinor:amount,entitlementIds:['entitlement-a'],fundingLotIds:['funding-a']}),['r1','t']);
  }
  function payment(amount = 40, patch: Partial<RightsOperation> = {}) { return operation('PAY_PROTECTED',{amountMinor:amount,entitlementIds:['entitlement-a'],fundingLotIds:['funding-a'],recipientBindingRef:'destination-a',recipientBindingVersion:1,recipientDestinationDigest:'a'.repeat(64),details:{payoutId:'payout-a'},...patch}); }
  return {state,context,operation,approvals,apply,funded,payment,secrets};
}
