import { createHash } from 'node:crypto';
import { verifyChildSignatureBytes } from './signature.js';
import type { RightsApproval, RightsContext, RightsCredential, RightsDelegation, RightsOperation, RightsOperationType, RightsPolicy, RightsRole, RightsState } from './rights-types.js';

export class ChildRightsError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'ChildRightsError'; this.code = code; }
}
export function requireRights(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ChildRightsError(code);
}
export function rightsInteger(value: unknown, code = 'INVALID_AMOUNT'): asserts value is number {
  requireRights(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, code);
}
export function rightsTime(value: string): number {
  requireRights(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value), 'INVALID_TIME');
  const time = Date.parse(value);
  requireRights(Number.isFinite(time), 'INVALID_TIME');
  requireRights(new Date(time).toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z'), 'INVALID_TIME');
  return time;
}
/** Deterministic JSON subset: sorted object keys, safe integers, no floats/undefined/prototypes. */
export function canonicalRightsJson(value: unknown): string {
  const ancestors = new Set<object>();
  let nodes = 0;
  function encode(item: unknown, depth: number): string {
    requireRights(depth <= 32 && ++nodes <= 100_000, 'CANONICAL_LIMIT');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number') {
      requireRights(Number.isSafeInteger(item) && !Object.is(item, -0), 'NON_CANONICAL_NUMBER');
      return String(item);
    }
    requireRights(typeof item === 'object' && item !== null && !ancestors.has(item), 'NON_CANONICAL_OBJECT');
    ancestors.add(item);
    let result: string;
    if (Array.isArray(item)) result = `[${item.map(child => encode(child,depth+1)).join(',')}]`;
    else {
      requireRights(Object.getPrototypeOf(item) === Object.prototype, 'NON_CANONICAL_OBJECT');
      const object = item as Record<string, unknown>;
      requireRights(Object.keys(object).every(key => !['__proto__', 'prototype', 'constructor'].includes(key)), 'INVALID_KEY');
      result = `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${encode(object[key],depth+1)}`).join(',')}}`;
    }
    ancestors.delete(item);
    return result;
  }
  return encode(value,0);
}
export function rightsDigest(value: unknown): string { return createHash('sha256').update(canonicalRightsJson(value)).digest('hex'); }
export function rightsOperationBytes(operation: RightsOperation): Uint8Array { return new TextEncoder().encode(canonicalRightsJson(operation)); }

const operationKeys = ['protocol','operationId','operationType','beneficiaryRef','entitlementIds','policyVersion','signerRegistryVersion','controlDomainRegistryVersion','conflictCheckVersion','legalBasisRef','evidenceBundleRef','purposeCode','recipientBindingRef','recipientBindingVersion','recipientDestinationDigest','amountMinor','currency','feesMinor','fundingLotIds','validAfter','expiresAt','nonce','authorizationEpoch','delegationId','jurisdictionPolicyRef','environment','domainSeparator','details'];
const detailKeys = ['delegation','revokeDelegationId','legalSubjectRef','guardianActorRef','newControllerRef','legalDecisionRef','capacityEvidenceRef','notificationEvidenceRef','contributionId','outcomeId','fundingPlanId','participantCanonicalRef','attributionNumerator','attributionDenominator','outcomeBudgetMinor','obligorRef','dueAt','contributionRequired','rightKind','fundingLotId','clearingReceiptRef','payoutId','providerOperationRef','receiptRef','paymentStatus','replacesBeneficiaryRef','disputeId','resolutionRef','nextPolicyVersion','policyEffectiveAfter'];
const operations: RightsOperationType[] = ['REGISTER_BENEFICIARY','CONFIRM_CONTRIBUTION','RECORD_OBLIGATION','RECORD_CLEARED_FUNDING','RESERVE_OUTCOME','RESERVE_FUNDING','VEST','PAY_PROTECTED','PAY_EXCEPTIONAL','PAY_EMERGENCY','PAYMENT_RESULT','REFUND','PAUSE','RESUME','ROTATE_GUARDIAN_KEY','RECOVER_GUARDIAN_KEY','CHANGE_GUARDIAN','CAPACITY_TRANSFER','LEGAL_CORRECTION','POLICY_CHANGE','GRANT_DELEGATION','REVOKE_DELEGATION'];
export function assertRightsReference(value: unknown): asserts value is string {
  requireRights(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value) && !['__proto__','constructor','prototype'].includes(value), 'INVALID_REFERENCE');
}
export function validateRightsOperation(operation: RightsOperation): void {
  requireRights(operation && typeof operation === 'object' && !Array.isArray(operation), 'INVALID_OPERATION');
  requireRights(Object.keys(operation).length === operationKeys.length && Object.keys(operation).every(key => operationKeys.includes(key)), 'UNKNOWN_OPERATION_FIELD');
  requireRights(operation.protocol === 'CanopyProof-Rights/0.1-proposal' && operations.includes(operation.operationType), 'PROTOCOL_UNSUPPORTED');
  requireRights(operation.environment === 'SIMULATION_ONLY' && operation.currency === 'XTS', 'REAL_VALUE_DISABLED');
  for (const key of ['operationId','beneficiaryRef','policyVersion','signerRegistryVersion','controlDomainRegistryVersion','conflictCheckVersion','legalBasisRef','evidenceBundleRef','purposeCode','nonce','jurisdictionPolicyRef','domainSeparator'] as const) assertRightsReference(operation[key]);
  for (const ids of [operation.entitlementIds, operation.fundingLotIds]) {
    requireRights(Array.isArray(ids) && ids.length <= 32 && new Set(ids).size === ids.length, 'INVALID_REFERENCE_SET');
    ids.forEach(assertRightsReference);
  }
  if (operation.recipientBindingRef !== null) assertRightsReference(operation.recipientBindingRef);
  if (operation.delegationId !== null) assertRightsReference(operation.delegationId);
  requireRights(operation.recipientDestinationDigest === null || /^[a-f0-9]{64}$/.test(operation.recipientDestinationDigest), 'INVALID_DESTINATION_DIGEST');
  [operation.amountMinor, operation.feesMinor, operation.authorizationEpoch, operation.recipientBindingVersion].forEach(value => rightsInteger(value));
  requireRights(operation.feesMinor === 0, 'FEES_NOT_ENABLED');
  requireRights(rightsTime(operation.validAfter) < rightsTime(operation.expiresAt), 'INVALID_WINDOW');
  requireRights(operation.details && typeof operation.details === 'object' && !Array.isArray(operation.details) && Object.keys(operation.details).every(key => detailKeys.includes(key)), 'UNKNOWN_DETAIL_FIELD');
  requireRights(rightsOperationBytes(operation).byteLength <= 65_536, 'OPERATION_TOO_LARGE');
}
function liveCredential(credential: RightsCredential, context: RightsContext, beneficiaryRef: string): boolean {
  const now = rightsTime(context.now);
  return !credential.revoked && !credential.isAgent && now >= rightsTime(credential.validAfter)
    && now < rightsTime(credential.expiresAt) && now < rightsTime(credential.independenceVerifiedUntil)
    && !!credential.legalEntityRef && !!credential.appointmentEvidenceRef && !!credential.independenceEvidenceRef
    && !credential.conflictBeneficiaryRefs.includes(beneficiaryRef);
}
function strictBase64(value: string): Uint8Array {
  requireRights(typeof value === 'string' && value.length <= 90_000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value), 'INVALID_SIGNATURE_ENCODING');
  const bytes = Buffer.from(value, 'base64');
  requireRights(bytes.toString('base64') === value, 'INVALID_SIGNATURE_ENCODING');
  return bytes;
}
function checkPanel(role: 'V' | 'R', signers: RightsCredential[], context: RightsContext, beneficiaryRef: string, required: number): void {
  const ids = role === 'V' ? context.policy.verificationPanelKeyIds : context.policy.protectionPanelKeyIds;
  requireRights(ids.length === 3 && new Set(ids).size === 3, 'PANEL_INVALID');
  const panel = ids.map(id => context.credentials.find(key => key.keyId === id));
  requireRights(panel.every(key => key && key.role === role && liveCredential(key, context, beneficiaryRef)), 'PANEL_UNAVAILABLE');
  requireRights(new Set(panel.map(key => key?.controlDomainId)).size === 3, 'PANEL_NOT_INDEPENDENT');
  const counted = signers.filter(key => key.role === role && ids.includes(key.keyId));
  requireRights(counted.length >= required, 'ROLE_QUORUM_MISSING');
  if (role === 'V') requireRights(counted.some(key => key.externalToOperatorAndSchool), 'EXTERNAL_APPROVAL_REQUIRED');
  if (role === 'R') requireRights(counted.every(key => key.externalToOperatorAndSchool), 'PROTECTION_INDEPENDENCE_REQUIRED');
}
const thresholds: Partial<Record<RightsOperationType, Partial<Record<RightsRole, number>>>> = {
  GRANT_DELEGATION: { G: 1, R: 1, T: 1 }, REGISTER_BENEFICIARY: { G: 1, B: 1, R: 1 }, CONFIRM_CONTRIBUTION: { V: 2 },
  RECORD_OBLIGATION: { R: 1, T: 1 }, RECORD_CLEARED_FUNDING: { T: 1, R: 1 },
  RESERVE_OUTCOME: { T: 1, R: 1 }, RESERVE_FUNDING: { T: 1, R: 1 }, VEST: { T: 1, R: 1 },
  PAY_PROTECTED: { G: 1, R: 1, T: 1 }, PAY_EXCEPTIONAL: { G: 1, R: 2, T: 1 }, PAY_EMERGENCY: { R: 2, T: 1 },
  PAYMENT_RESULT: { T: 1 }, REFUND: { T: 1, R: 1 }, RESUME: { R: 2, T: 1 },
  ROTATE_GUARDIAN_KEY: { G: 1, B: 1, R: 1 }, RECOVER_GUARDIAN_KEY: { B: 1, R: 2 },
  CHANGE_GUARDIAN: { B: 1, R: 2, T: 1 }, CAPACITY_TRANSFER: { C: 1, B: 1, R: 1, T: 1 },
  LEGAL_CORRECTION: { A: 1, B: 1, R: 2, T: 1 },
};
export interface RightsAuthorization { digest: string; signers: RightsCredential[]; delegationChain: RightsDelegation[]; termsPolicy: RightsPolicy }
/** Must execute under the same transaction/snapshot as applyRightsOperation. */
export function authorizeRightsOperation(operation: RightsOperation, approvals: RightsApproval[], context: RightsContext, state: RightsState): RightsAuthorization {
  validateRightsOperation(operation);
  requireRights(state.mode === 'synthetic-demo' && context.environment === 'SIMULATION_ONLY' && operation.environment === context.environment, 'REAL_VALUE_DISABLED');
  requireRights(context.restorationVerified, 'RESTORATION_UNVERIFIED');
  requireRights(context.legalEvidenceRefs.includes(operation.legalBasisRef), 'LEGAL_BASIS_UNVERIFIED');
  if (operation.details.legalDecisionRef) requireRights(context.legalEvidenceRefs.includes(operation.details.legalDecisionRef), 'LEGAL_DECISION_UNVERIFIED');
  requireRights(operation.domainSeparator === context.domainSeparator, 'DOMAIN_MISMATCH');
  const now = rightsTime(context.now);
  requireRights(now >= rightsTime(operation.validAfter) && now < rightsTime(operation.expiresAt), 'AUTHORIZATION_EXPIRED');
  requireRights(now >= rightsTime(context.policy.validAfter) && now < rightsTime(context.policy.expiresAt), 'POLICY_EXPIRED');
  const payment = ['PAY_PROTECTED','PAY_EXCEPTIONAL','PAY_EMERGENCY'].includes(operation.operationType);
  const entitlement = payment && operation.entitlementIds.length === 1 ? state.entitlements[operation.entitlementIds[0]!] : undefined;
  const termsPolicy = entitlement && entitlement.policyVersion !== context.policy.version ? context.entitlementPolicies[entitlement.policyVersion] : context.policy;
  requireRights(termsPolicy && operation.policyVersion === termsPolicy.version && (!entitlement || entitlement.policyVersion === termsPolicy.version) && operation.jurisdictionPolicyRef === termsPolicy.jurisdictionPolicyRef && operation.jurisdictionPolicyRef === context.policy.jurisdictionPolicyRef, 'POLICY_CHANGED');
  requireRights(operation.signerRegistryVersion === context.signerRegistryVersion && operation.controlDomainRegistryVersion === context.controlDomainRegistryVersion && operation.conflictCheckVersion === context.conflictCheckVersion, 'REGISTRY_CHANGED');
  requireRights(context.policy.allowedOperationTypes.includes(operation.operationType) && context.policy.allowedPurposes.includes(operation.purposeCode) && termsPolicy.allowedOperationTypes.includes(operation.operationType) && termsPolicy.allowedPurposes.includes(operation.purposeCode), 'PURPOSE_NOT_ALLOWED');
  requireRights(!state.consumedNonces.includes(operation.nonce) && !state.executedOperations[operation.operationId] && !context.executedOperationCheckpoint.includes(operation.operationId), 'OPERATION_REPLAY');
  const beneficiary = state.beneficiaries[operation.beneficiaryRef];
  if (operation.operationType !== 'REGISTER_BENEFICIARY') {
    requireRights(beneficiary && beneficiary.status === 'active', 'BENEFICIARY_UNAVAILABLE');
    requireRights(operation.authorizationEpoch === beneficiary.authorizationEpoch && beneficiary.authorizationEpoch >= (context.minimumEpochs[beneficiary.ref] ?? 0), 'AUTHORIZATION_EPOCH_CHANGED');
  } else requireRights(!beneficiary && operation.authorizationEpoch === 0 && (context.minimumEpochs[operation.beneficiaryRef] ?? 0) === 0, 'BENEFICIARY_ALREADY_EXISTS');
  requireRights(Array.isArray(approvals) && approvals.length > 0 && approvals.length <= 12, 'APPROVALS_REQUIRED');
  requireRights(new Set(context.credentials.map(key => key.keyId)).size === context.credentials.length, 'REGISTRY_AMBIGUOUS');
  const signers: RightsCredential[] = [];
  const bytes = rightsOperationBytes(operation);
  for (const approval of approvals) {
    requireRights(approval && typeof approval === 'object' && Object.keys(approval).length === 4 && Object.keys(approval).every(key => ['keyId','algorithm','payloadBase64','signatureBase64'].includes(key)), 'INVALID_APPROVAL');
    const credential = context.credentials.find(key => key.keyId === approval.keyId);
    requireRights(credential && liveCredential(credential, context, operation.beneficiaryRef), 'CREDENTIAL_UNAVAILABLE');
    requireRights(!signers.some(key => key.keyId === credential.keyId || key.actorRef === credential.actorRef || key.controlDomainId === credential.controlDomainId), 'DUPLICATE_CONTROL_DOMAIN');
    const verification = verifyChildSignatureBytes({ algorithm: approval.algorithm, expectedPayload: bytes, signedPayload: strictBase64(approval.payloadBase64), signature: strictBase64(approval.signatureBase64), registeredPublicKey: credential.publicKeyPem });
    requireRights(verification.valid, 'INVALID_SIGNATURE');
    if (credential.role === 'G') {
      requireRights(credential.actorRef === (beneficiary?.guardianActorRef ?? operation.details.guardianActorRef), 'GUARDIAN_MISMATCH');
      requireRights(!beneficiary?.guardianKeyId || credential.keyId === beneficiary.guardianKeyId, 'GUARDIAN_KEY_REVOKED');
    }
    if (credential.role === 'C') {
      requireRights(beneficiary && credential.actorRef === beneficiary.controllerRef, 'PARTICIPANT_MISMATCH');
      requireRights(!beneficiary.participantKeyId || credential.keyId === beneficiary.participantKeyId, 'PARTICIPANT_KEY_REVOKED');
    }
    if (['B','T','A','X'].includes(credential.role)) requireRights(credential.externalToOperatorAndSchool, 'INDEPENDENT_ROLE_REQUIRED');
    signers.push(credential);
  }
  if (operation.operationType === 'PAUSE' || operation.operationType === 'REVOKE_DELEGATION') requireRights(signers.some(key => ['C','G','R','T'].includes(key.role)), 'ROLE_QUORUM_MISSING');
  else if (operation.operationType === 'POLICY_CHANGE') {
    const panel = context.policy.governancePanelKeyIds;
    requireRights(panel.length === 6 && new Set(panel).size === 6, 'PANEL_INVALID');
    requireRights(signers.length >= 4 && signers.every(key => panel.includes(key.keyId)), 'ROLE_QUORUM_MISSING');
    requireRights(signers.filter(key => key.role === 'R' && key.externalToOperatorAndSchool).length >= 2 && signers.some(key => ['T','X'].includes(key.role) && key.externalToOperatorAndSchool), 'GOVERNANCE_INDEPENDENCE_REQUIRED');
  } else {
    const required = thresholds[operation.operationType];
    requireRights(required, 'OPERATION_UNSUPPORTED');
    for (const [role, count] of Object.entries(required)) {
      if (role === 'V' || role === 'R') checkPanel(role, signers, context, operation.beneficiaryRef, count);
      else requireRights(signers.filter(key => key.role === role).length >= count, 'ROLE_QUORUM_MISSING');
    }
  }
  if (payment) {
    requireRights(operation.recipientBindingRef, 'DESTINATION_REQUIRED');
    const destination = state.destinations[operation.recipientBindingRef];
    requireRights(destination?.active && destination.protected && destination.beneficiaryRef === operation.beneficiaryRef, 'DESTINATION_UNAVAILABLE');
    requireRights(destination.version === operation.recipientBindingVersion && destination.destinationDigest === operation.recipientDestinationDigest, 'DESTINATION_CHANGED');
    requireRights(destination.allowedPurposeCodes.includes(operation.purposeCode), 'PURPOSE_NOT_ALLOWED');
    requireRights(operation.amountMinor > 0 && operation.amountMinor <= Math.min(context.policy.perPaymentLimitMinor,termsPolicy.perPaymentLimitMinor), 'PAYMENT_LIMIT');
    if (operation.operationType === 'PAY_PROTECTED') requireRights(destination.relatedControlDomainIds.length === 0, 'RELATED_DESTINATION_REQUIRES_REVIEW');
    if (operation.operationType === 'PAY_EXCEPTIONAL') {
      requireRights(!!operation.details.notificationEvidenceRef, 'NOTICE_REQUIRED');
      const notice = context.notices[operation.details.notificationEvidenceRef!];
      requireRights(notice?.kind === 'payment' && notice.beneficiaryRef === operation.beneficiaryRef && notice.operationDigest === rightsDigest(operation) && now - rightsTime(notice.issuedAt) >= Math.max(context.policy.exceptionalPaymentWaitMs,termsPolicy.exceptionalPaymentWaitMs), 'WAIT_PERIOD');
      if (destination.relatedControlDomainIds.length) requireRights(signers.some(key => key.role === 'A'), 'INDEPENDENT_LEGAL_REVIEW_REQUIRED');
    }
    if (operation.operationType === 'PAY_EMERGENCY') requireRights(!!operation.details.legalDecisionRef, 'EMERGENCY_LEGAL_BASIS_REQUIRED');
  }
  const delegationChain = operation.delegationId ? validateRightsDelegation(state, operation, context) : [];
  // Delegation is an additional constraint, never a replacement for independent approvals.
  return { digest: rightsDigest(operation), signers, delegationChain, termsPolicy };
}
const nonDelegable: RightsOperationType[] = ['REGISTER_BENEFICIARY','ROTATE_GUARDIAN_KEY','RECOVER_GUARDIAN_KEY','CHANGE_GUARDIAN','CAPACITY_TRANSFER','LEGAL_CORRECTION','POLICY_CHANGE','GRANT_DELEGATION','REVOKE_DELEGATION'];
export function assertDelegationNarrower(child: RightsDelegation, parent: RightsDelegation): void {
  const subset = <T>(a: T[], b: T[]) => a.every(value => b.includes(value));
  requireRights(parent.allowRedelegation && child.parentId === parent.id && child.issuerActorRef === parent.delegateActorRef, 'REDELEGATION_FORBIDDEN');
  requireRights(child.beneficiaryRef === parent.beneficiaryRef && child.epoch === parent.epoch && child.currency === parent.currency, 'DELEGATION_SCOPE_EXPANDED');
  requireRights(subset(child.operationTypes, parent.operationTypes) && subset(child.entitlementIds, parent.entitlementIds) && subset(child.destinationRefs, parent.destinationRefs) && subset(child.purposeCodes, parent.purposeCodes), 'DELEGATION_SCOPE_EXPANDED');
  requireRights(rightsTime(child.validAfter) >= rightsTime(parent.validAfter) && rightsTime(child.expiresAt) <= rightsTime(parent.expiresAt), 'DELEGATION_SCOPE_EXPANDED');
  requireRights(child.perCallLimitMinor <= parent.perCallLimitMinor && child.cumulativeLimitMinor <= parent.cumulativeLimitMinor && child.maximumCalls <= parent.maximumCalls, 'DELEGATION_SCOPE_EXPANDED');
}
export function validateRightsDelegation(state: RightsState, operation: RightsOperation, context: RightsContext): RightsDelegation[] {
  requireRights(!nonDelegable.includes(operation.operationType), 'OPERATION_NOT_DELEGABLE');
  const chain: RightsDelegation[] = [];
  let id = operation.delegationId;
  const now = rightsTime(context.now);
  while (id) {
    requireRights(chain.length < 8 && !chain.some(item => item.id === id), 'DELEGATION_CYCLE');
    const delegation: RightsDelegation | undefined = state.delegations[id];
    requireRights(delegation && !delegation.revoked && delegation.approvalDigest.length === 64, 'DELEGATION_REVOKED');
    requireRights(delegation.beneficiaryRef === operation.beneficiaryRef && delegation.epoch === operation.authorizationEpoch && delegation.currency === operation.currency, 'DELEGATION_SCOPE');
    requireRights(now >= rightsTime(delegation.validAfter) && now < rightsTime(delegation.expiresAt) && rightsTime(delegation.expiresAt) - rightsTime(delegation.validAfter) <= 30 * 86_400_000, 'DELEGATION_EXPIRED');
    requireRights(delegation.operationTypes.includes(operation.operationType) && operation.entitlementIds.every(ref => delegation.entitlementIds.includes(ref)) && delegation.purposeCodes.includes(operation.purposeCode) && (!operation.recipientBindingRef || delegation.destinationRefs.includes(operation.recipientBindingRef)), 'DELEGATION_SCOPE');
    [delegation.perCallLimitMinor,delegation.cumulativeLimitMinor,delegation.maximumCalls,delegation.consumedMinor,delegation.consumedCalls].forEach(value => rightsInteger(value));
    requireRights(operation.amountMinor <= delegation.perCallLimitMinor && delegation.consumedMinor + operation.amountMinor <= delegation.cumulativeLimitMinor && delegation.consumedCalls < delegation.maximumCalls, 'DELEGATION_LIMIT');
    if (chain.length) assertDelegationNarrower(chain[chain.length - 1]!, delegation);
    chain.push(delegation); id = delegation.parentId;
  }
  return chain;
}
