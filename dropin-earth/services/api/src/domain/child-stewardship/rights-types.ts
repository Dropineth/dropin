/** Synthetic rights execution contract. These are product-local schemas, not AHIN/PoCC wire formats. */
export type RightsRole = 'C' | 'G' | 'B' | 'V' | 'R' | 'T' | 'O' | 'S' | 'A' | 'X' | 'COMMUNITY';
export type RightsOperationType =
  | 'REGISTER_BENEFICIARY' | 'CONFIRM_CONTRIBUTION' | 'RECORD_OBLIGATION'
  | 'RECORD_CLEARED_FUNDING' | 'RESERVE_OUTCOME' | 'RESERVE_FUNDING' | 'VEST'
  | 'PAY_PROTECTED' | 'PAY_EXCEPTIONAL' | 'PAY_EMERGENCY'
  | 'PAYMENT_RESULT' | 'REFUND' | 'PAUSE' | 'RESUME'
  | 'ROTATE_GUARDIAN_KEY' | 'RECOVER_GUARDIAN_KEY' | 'CHANGE_GUARDIAN'
  | 'CAPACITY_TRANSFER' | 'LEGAL_CORRECTION' | 'POLICY_CHANGE' | 'GRANT_DELEGATION' | 'REVOKE_DELEGATION';
export interface RightsOperation {
  protocol: 'CanopyProof-Rights/0.1-proposal';
  operationId: string;
  operationType: RightsOperationType;
  beneficiaryRef: string;
  entitlementIds: string[];
  policyVersion: string;
  signerRegistryVersion: string;
  controlDomainRegistryVersion: string;
  conflictCheckVersion: string;
  legalBasisRef: string;
  evidenceBundleRef: string;
  purposeCode: string;
  recipientBindingRef: string | null;
  recipientBindingVersion: number;
  recipientDestinationDigest: string | null;
  amountMinor: number;
  currency: 'XTS';
  feesMinor: number;
  fundingLotIds: string[];
  validAfter: string;
  expiresAt: string;
  nonce: string;
  authorizationEpoch: number;
  delegationId: string | null;
  jurisdictionPolicyRef: string;
  environment: 'SIMULATION_ONLY';
  domainSeparator: string;
  /** All command-specific values are included in the signed canonical payload. */
  details: RightsOperationDetails;
}
export interface RightsOperationDetails {
  delegation?: RightsDelegation;
  revokeDelegationId?: string;
  legalSubjectRef?: string;
  guardianActorRef?: string;
  newControllerRef?: string;
  legalDecisionRef?: string;
  capacityEvidenceRef?: string;
  notificationEvidenceRef?: string;
  contributionId?: string;
  outcomeId?: string;
  fundingPlanId?: string;
  participantCanonicalRef?: string;
  attributionNumerator?: number;
  attributionDenominator?: number;
  outcomeBudgetMinor?: number;
  obligorRef?: string;
  dueAt?: string;
  contributionRequired?: boolean;
  rightKind?: 'contractual_grant' | 'lawful_service_benefit';
  fundingLotId?: string;
  clearingReceiptRef?: string;
  payoutId?: string;
  providerOperationRef?: string;
  receiptRef?: string;
  paymentStatus?: 'accepted' | 'processing' | 'unknown' | 'settled' | 'failed' | 'returned';
  replacesBeneficiaryRef?: string;
  disputeId?: string;
  resolutionRef?: string;
  nextPolicyVersion?: string;
  policyEffectiveAfter?: string;
}
export interface RightsApproval {
  keyId: string;
  algorithm: string;
  payloadBase64: string;
  signatureBase64: string;
}
export interface RightsCredential {
  keyId: string;
  actorRef: string;
  publicKeyPem: string;
  role: RightsRole;
  controlDomainId: string;
  legalEntityRef: string;
  appointmentEvidenceRef: string;
  independenceEvidenceRef: string;
  independenceVerifiedUntil: string;
  validAfter: string;
  expiresAt: string;
  revoked: boolean;
  isAgent: boolean;
  /** Established by independent governance, never accepted from request input. */
  externalToOperatorAndSchool: boolean;
  conflictBeneficiaryRefs: string[];
}
export interface RightsPolicy {
  version: string;
  jurisdictionPolicyRef: string;
  allowedPurposes: string[];
  allowedOperationTypes: RightsOperationType[];
  validAfter: string;
  expiresAt: string;
  periodId: string;
  perPaymentLimitMinor: number;
  beneficiaryPeriodLimitMinor: number;
  destinationPeriodLimitMinor: number;
  verificationPanelKeyIds: string[];
  protectionPanelKeyIds: string[];
  governancePanelKeyIds: string[];
  contributionObjectionMs: number;
  exceptionalPaymentWaitMs: number;
  recoveryWaitMs: number;
  policyNoticeMs: number;
}
export interface RightsContext {
  /** This snapshot is supplied by the authoritative server/store under its transaction lock. */
  now: string;
  environment: 'SIMULATION_ONLY';
  domainSeparator: string;
  signerRegistryVersion: string;
  controlDomainRegistryVersion: string;
  conflictCheckVersion: string;
  credentials: RightsCredential[];
  policy: RightsPolicy;
  /** Immutable original entitlement terms; current policy still supplies safety/revocation controls. */
  entitlementPolicies: Record<string, RightsPolicy>;
  restorationVerified: boolean;
  /** Reviewed synthetic evidence registry, owned by the server, never set by the request. */
  legalEvidenceRefs: string[];
  notices: Record<string, { beneficiaryRef: string; issuedAt: string; kind: 'payment' | 'recovery' | 'policy'; operationDigest: string }>;
  /** An independent checkpoint; stale restored state must not lower any epoch. */
  minimumEpochs: Record<string, number>;
  executedOperationCheckpoint: string[];
}
export interface RightsBeneficiary {
  ref: string;
  legalSubjectRef: string;
  guardianActorRef: string;
  guardianKeyId: string | null;
  controllerRef: string;
  participantKeyId: string | null;
  authorizationEpoch: number;
  legalBasisRef: string;
  status: 'active' | 'superseded';
}
export interface RightsDestination {
  ref: string;
  version: number;
  destinationDigest: string;
  beneficiaryRef: string;
  relatedControlDomainIds: string[];
  protected: boolean;
  active: boolean;
  allowedPurposeCodes: string[];
  /** Links related destinations without disclosing a public child identifier. */
  cumulativeGroupRef: string;
}
export interface RightsEntitlement {
  id: string;
  beneficiaryRef: string;
  obligorRef: string;
  legalBasisRef: string;
  rightKind: 'contractual_grant' | 'lawful_service_benefit';
  policyVersion: string;
  currency: 'XTS';
  amountMinor: number;
  paidMinor: number;
  dueAt: string;
  legalState: 'legally_committed' | 'vested';
  contributionRequired: boolean;
  contributionId: string | null;
  disputeIds: string[];
}
export interface RightsFundingLot {
  id: string;
  currency: 'XTS';
  clearedAssetsMinor: number;
  unallocatedMinor: number;
  allocations: Record<string, { reservedMinor: number; vestedMinor: number; submittedMinor: number }>;
  clearingReceiptRef: string;
  outcomeReserves: Record<string, number>;
}
export interface RightsContribution {
  id: string;
  beneficiaryRef: string;
  participantCanonicalRef: string;
  outcomeId: string;
  fundingPlanId: string;
  amountMinor: number;
  numerator: number;
  denominator: number;
  outcomeBudgetMinor: number;
  policyVersion: string;
  confirmedAt: string;
  objectionEndsAt: string;
}
export interface RightsPayment {
  id: string;
  operationId: string;
  beneficiaryRef: string;
  entitlementId: string;
  fundingLotId: string;
  recipientBindingRef: string;
  recipientBindingVersion: number;
  recipientDestinationDigest: string;
  amountMinor: number;
  currency: 'XTS';
  status: 'submitted' | 'accepted' | 'processing' | 'unknown' | 'settled' | 'failed' | 'returned';
  providerOperationRef: string | null;
  receiptRefs: string[];
  refundedMinor: number;
  /** Synthetic outbox item only; no real institution is attached. */
  submissionCount: number;
}
export interface RightsDelegation {
  id: string;
  parentId: string | null;
  issuerActorRef: string;
  delegateActorRef: string;
  beneficiaryRef: string;
  epoch: number;
  operationTypes: RightsOperationType[];
  entitlementIds: string[];
  destinationRefs: string[];
  purposeCodes: string[];
  currency: 'XTS';
  validAfter: string;
  expiresAt: string;
  perCallLimitMinor: number;
  cumulativeLimitMinor: number;
  maximumCalls: number;
  consumedMinor: number;
  consumedCalls: number;
  revoked: boolean;
  allowRedelegation: boolean;
  approvalDigest: string;
}
export interface RightsState {
  schemaVersion: 1;
  mode: 'synthetic-demo';
  beneficiaries: Record<string, RightsBeneficiary>;
  destinations: Record<string, RightsDestination>;
  entitlements: Record<string, RightsEntitlement>;
  fundingLots: Record<string, RightsFundingLot>;
  contributions: Record<string, RightsContribution>;
  outcomeBudgets: Record<string, { outcomeId: string; fundingPlanId: string; fundingLotId: string; maximumMinor: number }>;
  payments: Record<string, RightsPayment>;
  delegations: Record<string, RightsDelegation>;
  consumedNonces: string[];
  executedOperations: Record<string, string>;
  approvalRecords: Record<string, { operation: RightsOperation; approvals: RightsApproval[]; approvalDigest: string }>;
  economicKeys: string[];
  cumulativeAmounts: Record<string, number>;
  outbox: { id: string; kind: 'synthetic-payment'; payoutId: string; status: 'pending' | 'delivered' }[];
  audit: { operationId: string; type: RightsOperationType; digest: string; previousDigest: string; stateDigest: string; at: string; result: 'synthetic-applied' }[];
}
