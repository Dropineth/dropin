import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofOrganizationTypes = [
  "un_agency",
  "research_institution",
  "ngo",
  "university",
  "government",
  "corporate",
  "community_organization",
  "auditor",
  "investor",
  "restoration_operator",
  "climate_fund",
] as const;

export const canopyProofPartnerRoles = ["owner", "admin", "verifier", "researcher", "community", "observer"] as const;
export const canopyProofOrganizationVerificationStatuses = ["pending", "document_review", "verified", "suspended", "revoked"] as const;
export const canopyProofOrganizationTrustLevels = ["unverified", "basic", "verified", "institutional", "suspended"] as const;
export const canopyProofDataAccessRequestStatuses = ["pending", "approved", "denied", "revoked", "expired"] as const;
export const canopyProofDataSharingAgreementTransitionTypes = ["renewal", "supersession"] as const;
export const canopyProofDataAccessDeliveryChannels = ["audit_export_manifest", "partner_api", "regulator_portal", "research_data_room"] as const;
export const canopyProofDataUseAttestationStates = ["within_scope", "no_use", "misuse_challenged", "revocation_requested"] as const;
export const canopyProofDataUseEnforcementStates = [
  "opened",
  "under_review",
  "action_required",
  "access_suspended",
  "access_revoked",
  "remediation_required",
  "resolved",
  "rejected",
] as const;
export const canopyProofDataUseEnforcementActions = [
  "notify_partner",
  "suspend_data_access",
  "revoke_data_access",
  "require_remediation",
  "legal_hold",
] as const;
export const canopyProofDataAccessRestrictionStates = ["remediation_hold", "suspended", "revoked", "restored"] as const;
export const canopyProofDataAccessAccountabilityIssueCodes = [
  "packet_hash_mismatch",
  "packet_root_mismatch",
  "lineage_stale",
  "expected_root_mismatch",
  "safety_boundary_violation",
] as const;
export const canopyProofDataAccessAccountabilityDisclosureStates = ["current", "stale"] as const;
export const canopyProofDataAccessAccountabilityDisclosureGovernanceStates = [
  "unchallenged",
  "challenged",
  "needs_more_evidence",
  "correction_required",
  "withdrawal_required",
  "corrected",
  "withdrawn",
  "challenge_dismissed",
] as const;
export const canopyProofDataAccessAccountabilityDisclosureChallengeReasons = [
  "lineage_stale",
  "incorrect_metadata",
  "privacy_risk",
  "governance_violation",
  "source_verification_disputed",
  "other",
] as const;
export const canopyProofDataAccessAccountabilityDisclosureResolutionDecisions = ["upheld", "dismissed", "needs_more_evidence"] as const;
export const canopyProofDataAccessAccountabilityDisclosureRemedialActions = [
  "none",
  "publish_correction",
  "publish_withdrawal_notice",
] as const;
export const canopyProofDataAccessAccountabilityDisclosureNoticeTypes = ["correction", "withdrawal"] as const;

export type CanopyProofOrganizationType = (typeof canopyProofOrganizationTypes)[number];
export type CanopyProofPartnerRole = (typeof canopyProofPartnerRoles)[number];
export type CanopyProofAccreditationStatus = "pending" | "approved" | "suspended" | "revoked";
export type CanopyProofOrganizationVerificationStatus = (typeof canopyProofOrganizationVerificationStatuses)[number];
export type CanopyProofOrganizationTrustLevel = (typeof canopyProofOrganizationTrustLevels)[number];
export type CanopyProofDataAccessRequestStatus = (typeof canopyProofDataAccessRequestStatuses)[number];
export type CanopyProofDataSharingAgreementTransitionType = (typeof canopyProofDataSharingAgreementTransitionTypes)[number];
export type CanopyProofDataAccessDeliveryChannel = (typeof canopyProofDataAccessDeliveryChannels)[number];
export type CanopyProofDataUseAttestationState = (typeof canopyProofDataUseAttestationStates)[number];
export type CanopyProofDataUseEnforcementState = (typeof canopyProofDataUseEnforcementStates)[number];
export type CanopyProofDataUseEnforcementAction = (typeof canopyProofDataUseEnforcementActions)[number];
export type CanopyProofDataAccessRestrictionState = (typeof canopyProofDataAccessRestrictionStates)[number];
export type CanopyProofDataAccessAccountabilityIssueCode = (typeof canopyProofDataAccessAccountabilityIssueCodes)[number];
export type CanopyProofDataAccessAccountabilityDisclosureState =
  (typeof canopyProofDataAccessAccountabilityDisclosureStates)[number];
export type CanopyProofDataAccessAccountabilityDisclosureGovernanceState =
  (typeof canopyProofDataAccessAccountabilityDisclosureGovernanceStates)[number];
export type CanopyProofDataAccessAccountabilityDisclosureChallengeReason =
  (typeof canopyProofDataAccessAccountabilityDisclosureChallengeReasons)[number];
export type CanopyProofDataAccessAccountabilityDisclosureResolutionDecision =
  (typeof canopyProofDataAccessAccountabilityDisclosureResolutionDecisions)[number];
export type CanopyProofDataAccessAccountabilityDisclosureRemedialAction =
  (typeof canopyProofDataAccessAccountabilityDisclosureRemedialActions)[number];
export type CanopyProofDataAccessAccountabilityDisclosureNoticeType =
  (typeof canopyProofDataAccessAccountabilityDisclosureNoticeTypes)[number];

export type CanopyProofOrganizationDocument = {
  readonly documentId: string;
  readonly documentType: "registration" | "tax" | "accreditation" | "mandate" | "audit_letter" | "other";
  readonly documentHash: string;
  readonly issuedBy?: string;
  readonly uploadedAt: string;
};

export type CanopyProofOrganizationProfile = {
  readonly id: string;
  readonly name: string;
  readonly legalName: string;
  readonly organizationType: CanopyProofOrganizationType;
  readonly jurisdiction: string;
  readonly registrationNumber?: string;
  readonly publicContact: string;
  readonly operatingRegions: readonly string[];
  readonly verificationCapabilities: readonly string[];
  readonly accreditationStatus: CanopyProofAccreditationStatus;
  readonly verificationStatus: CanopyProofOrganizationVerificationStatus;
  readonly documents: readonly CanopyProofOrganizationDocument[];
  readonly authorizedUsers: readonly string[];
  readonly trustLevel: CanopyProofOrganizationTrustLevel;
  readonly dataSharingPolicy: "open" | "restricted" | "private";
  readonly profileHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofMembership = {
  readonly id: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly role: CanopyProofPartnerRole;
  readonly status: "active" | "suspended" | "revoked";
  readonly conflictDisclosure: string;
  readonly grantedBy: string;
  readonly grantedAt: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofAccreditation = {
  readonly id: string;
  readonly organizationId: string;
  readonly status: CanopyProofAccreditationStatus;
  readonly scope: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly rationale: string;
  readonly evidenceHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofPartnerAuthoritySnapshot = {
  readonly organizations: readonly CanopyProofOrganizationProfile[];
  readonly memberships: readonly CanopyProofMembership[];
  readonly accreditations: readonly CanopyProofAccreditation[];
  readonly dataSharingAgreements?: readonly CanopyProofDataSharingAgreement[];
  readonly dataSharingAgreementRevocations?: readonly CanopyProofDataSharingAgreementRevocation[];
  readonly dataSharingAgreementSupersessions?: readonly CanopyProofDataSharingAgreementSupersession[];
  readonly dataAccessRequests?: readonly CanopyProofDataAccessRequest[];
  readonly dataAccessRequestDecisions?: readonly CanopyProofDataAccessRequestDecision[];
  readonly dataAccessDeliveryReceipts?: readonly CanopyProofDataAccessDeliveryReceipt[];
  readonly dataUseAttestations?: readonly CanopyProofDataUseAttestation[];
  readonly dataUseEnforcementCases?: readonly CanopyProofDataUseEnforcementCase[];
  readonly dataAccessRestrictions?: readonly CanopyProofDataAccessRestriction[];
  readonly dataAccessAccountabilityPackets?: readonly CanopyProofDataAccessAccountabilityPacket[];
  readonly dataAccessAccountabilityVerifications?: readonly CanopyProofDataAccessAccountabilityVerification[];
  readonly dataAccessAccountabilityDisclosures?: readonly CanopyProofDataAccessAccountabilityDisclosure[];
  readonly dataAccessAccountabilityDisclosureChallenges?: readonly CanopyProofDataAccessAccountabilityDisclosureChallenge[];
  readonly dataAccessAccountabilityDisclosureResolutions?: readonly CanopyProofDataAccessAccountabilityDisclosureResolution[];
  readonly dataAccessAccountabilityDisclosureNotices?: readonly CanopyProofDataAccessAccountabilityDisclosureNotice[];
};

export type CanopyProofDataSharingAgreement = {
  readonly id: string;
  readonly organizationId: string;
  readonly datasetScopes: readonly string[];
  readonly privacyTier: "public" | "restricted" | "confidential";
  readonly permittedUses: readonly string[];
  readonly revoked: boolean;
  readonly superseded: boolean;
  readonly supersededByAgreementId?: string;
  readonly supersedesAgreementId?: string;
  readonly expiresAt?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly agreementHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataSharingAgreementSupersession = {
  readonly id: string;
  readonly organizationId: string;
  readonly predecessorAgreementId: string;
  readonly predecessorAgreementHash: string;
  readonly successorAgreementId: string;
  readonly successorAgreementHash: string;
  readonly transitionType: CanopyProofDataSharingAgreementTransitionType;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly supersededBy: string;
  readonly supersededAt: string;
  readonly supersessionHash: string;
  readonly supersessionRoot: string;
  readonly safety: {
    readonly predecessorBound: true;
    readonly successorBound: true;
    readonly scopeExpansionBlocked: true;
    readonly privacyEscalationBlocked: true;
    readonly priorAgreementFutureAccessBlocked: true;
    readonly priorAgreementFutureDeliveryBlocked: true;
    readonly appendOnly: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataSharingAgreementRevocation = {
  readonly id: string;
  readonly organizationId: string;
  readonly agreementId: string;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly revokedBy: string;
  readonly revokedAt: string;
  readonly revocationHash: string;
  readonly revocationRoot: string;
  readonly safety: {
    readonly agreementBound: true;
    readonly separateRevocationRecord: true;
    readonly futureAccessBlocked: true;
    readonly futureDeliveryBlocked: true;
    readonly appendOnly: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessRequest = {
  readonly id: string;
  readonly organizationId: string;
  readonly agreementId: string;
  readonly datasetScopes: readonly string[];
  readonly permittedUses: readonly string[];
  readonly privacyTier: CanopyProofDataSharingAgreement["privacyTier"];
  readonly purpose: string;
  readonly status: CanopyProofDataAccessRequestStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly decisionBy?: string;
  readonly decidedAt?: string;
  readonly decisionRationale?: string;
  readonly expiresAt?: string;
  readonly requestHash: string;
  readonly accessRoot: string;
  readonly safety: {
    readonly agreementBound: true;
    readonly scopeLimited: true;
    readonly humanDecisionRequired: true;
    readonly rawDataNotEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
  readonly decisionAuditEvent?: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessRequestDecision = {
  readonly id: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly agreementId: string;
  readonly previousStatus: CanopyProofDataAccessRequestStatus;
  readonly status: Exclude<CanopyProofDataAccessRequestStatus, "pending">;
  readonly decisionBy: string;
  readonly decidedAt: string;
  readonly rationale: string;
  readonly decisionHash: string;
  readonly decisionRoot: string;
  readonly safety: {
    readonly requestBound: true;
    readonly agreementBound: true;
    readonly independentHumanDecision: true;
    readonly appendOnly: true;
    readonly rawDataNotEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessDeliveryReceipt = {
  readonly id: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly agreementId: string;
  readonly manifestId: string;
  readonly manifestRequesterOrganizationId: string;
  readonly manifestHash: string;
  readonly manifestEntryRoot: string;
  readonly manifestClassification: "public" | "internal" | "restricted" | "confidential";
  readonly channel: CanopyProofDataAccessDeliveryChannel;
  readonly recipientActorId: string;
  readonly deliveredBy: string;
  readonly deliveredAt: string;
  readonly purpose: string;
  readonly accessRoot: string;
  readonly receiptHash: string;
  readonly deliveryRoot: string;
  readonly safety: {
    readonly approvedRequestBound: true;
    readonly agreementBound: true;
    readonly manifestHashOnly: true;
    readonly redactionPolicyEnforced: true;
    readonly rawDataNotEmbedded: true;
    readonly noPrivateContactData: true;
    readonly humanDecisionRequired: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataUseAttestation = {
  readonly id: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly deliveryId: string;
  readonly manifestId: string;
  readonly usageState: CanopyProofDataUseAttestationState;
  readonly useCase: string;
  readonly outputHashes: readonly string[];
  readonly evidenceEventRoots: readonly string[];
  readonly limitations: readonly string[];
  readonly attestedBy: string;
  readonly attestedAt: string;
  readonly attestationHash: string;
  readonly usageRoot: string;
  readonly safety: {
    readonly deliveryReceiptBound: true;
    readonly approvedRequestBound: true;
    readonly purposeBound: true;
    readonly outputHashOnly: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataUseEnforcementCase = {
  readonly id: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly deliveryId: string;
  readonly attestationId: string;
  readonly manifestId: string;
  readonly caseState: CanopyProofDataUseEnforcementState;
  readonly enforcementAction: CanopyProofDataUseEnforcementAction;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly reviewerId: string;
  readonly reviewedAt: string;
  readonly enforcementHash: string;
  readonly enforcementRoot: string;
  readonly safety: {
    readonly challengedAttestationBound: true;
    readonly deliveryReceiptBound: true;
    readonly approvedRequestBound: true;
    readonly humanDecisionRequired: true;
    readonly independentReviewerRequired: true;
    readonly accessMutationRequiresSeparateApproval: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly appendOnly: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessRestriction = {
  readonly id: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly enforcementCaseId: string;
  readonly attestationId: string;
  readonly deliveryId: string;
  readonly previousRestrictionId?: string;
  readonly previousRestrictionRoot?: string;
  readonly previousRestrictionState?: CanopyProofDataAccessRestrictionState;
  readonly restrictionState: CanopyProofDataAccessRestrictionState;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly expiresAt?: string;
  readonly restrictionHash: string;
  readonly restrictionRoot: string;
  readonly safety: {
    readonly enforcementCaseBound: true;
    readonly approvedRequestBound: true;
    readonly separateApprovalPath: true;
    readonly independentDecisionRequired: true;
    readonly reviewerSeparationRequired: true;
    readonly deliveryBlockingEnforced: true;
    readonly appendOnly: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessAccountabilityPacket = {
  readonly id: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly agreementId: string;
  readonly generatedBy: string;
  readonly generatedAt: string;
  readonly intendedAudience: string;
  readonly requestStatus: CanopyProofDataAccessRequestStatus;
  readonly counts: {
    readonly agreementRevocationCount: number;
    readonly agreementSupersessionCount: number;
    readonly deliveryReceiptCount: number;
    readonly dataUseAttestationCount: number;
    readonly enforcementCaseCount: number;
    readonly activeRestrictionCount: number;
    readonly totalRestrictionCount: number;
  };
  readonly lineageRoots: {
    readonly accessRoot: string;
    readonly agreementRevocationRoots: readonly string[];
    readonly agreementSupersessionRoots: readonly string[];
    readonly deliveryRoots: readonly string[];
    readonly usageRoots: readonly string[];
    readonly enforcementRoots: readonly string[];
    readonly restrictionRoots: readonly string[];
  };
  readonly packetHash: string;
  readonly packetRoot: string;
  readonly safety: {
    readonly requestBound: true;
    readonly appendOnlyLedgerDerived: true;
    readonly hashOnlyLineage: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly observerReadable: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

type CanopyProofDataAccessAccountabilitySnapshot = Pick<
  CanopyProofDataAccessAccountabilityPacket,
  "counts" | "lineageRoots"
>;

export type CanopyProofDataAccessAccountabilityVerification = {
  readonly id: string;
  readonly packetId: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly valid: boolean;
  readonly issues: readonly CanopyProofDataAccessAccountabilityIssueCode[];
  readonly expectedPacketRoot?: string;
  readonly packetHash: string;
  readonly recomputedPacketHash: string;
  readonly packetRoot: string;
  readonly recomputedPacketRoot: string;
  readonly verifiedBy: string;
  readonly verifiedAt: string;
  readonly verificationRoot: string;
  readonly safety: {
    readonly replayVerification: true;
    readonly hashOnlyLineage: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessAccountabilityDisclosure = {
  readonly id: string;
  readonly organizationId: string;
  readonly packetId: string;
  readonly packetHash: string;
  readonly packetRoot: string;
  readonly verificationId: string;
  readonly verificationRoot: string;
  readonly policyId: "canopyproof_policy_partner_accountability_disclosure_v1";
  readonly publishedBy: string;
  readonly publishedAt: string;
  readonly disclosureHash: string;
  readonly disclosureRoot: string;
  readonly safety: {
    readonly packetBound: true;
    readonly validReplayRequired: true;
    readonly independentPublicationRequired: true;
    readonly appendOnly: true;
    readonly hashOnly: true;
    readonly observerDiscoverable: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessAccountabilityDisclosureView = CanopyProofDataAccessAccountabilityDisclosure & {
  readonly currentState: CanopyProofDataAccessAccountabilityDisclosureState;
  readonly currentIssues: readonly CanopyProofDataAccessAccountabilityIssueCode[];
  readonly governanceState: CanopyProofDataAccessAccountabilityDisclosureGovernanceState;
  readonly challengeCount: number;
  readonly openChallengeCount: number;
  readonly noticeIds: readonly string[];
  readonly replacementDisclosureIds: readonly string[];
};

export type CanopyProofDataAccessAccountabilityDisclosureChallenge = {
  readonly id: string;
  readonly organizationId: string;
  readonly disclosureId: string;
  readonly disclosureRoot: string;
  readonly reason: CanopyProofDataAccessAccountabilityDisclosureChallengeReason;
  readonly statement: string;
  readonly evidenceEventRoots: readonly string[];
  readonly challengedBy: string;
  readonly challengerRole: CanopyProofPartnerRole;
  readonly challengedAt: string;
  readonly challengeHash: string;
  readonly challengeRoot: string;
  readonly safety: {
    readonly disclosureBound: true;
    readonly publicStatement: true;
    readonly appendOnly: true;
    readonly humanResolutionRequired: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessAccountabilityDisclosureResolution = {
  readonly id: string;
  readonly organizationId: string;
  readonly disclosureId: string;
  readonly challengeId: string;
  readonly decision: CanopyProofDataAccessAccountabilityDisclosureResolutionDecision;
  readonly remedialAction: CanopyProofDataAccessAccountabilityDisclosureRemedialAction;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly previousResolutionId?: string;
  readonly previousResolutionRoot?: string;
  readonly reviewedBy: string;
  readonly reviewerRole: "owner" | "admin" | "verifier";
  readonly reviewedAt: string;
  readonly resolutionHash: string;
  readonly resolutionRoot: string;
  readonly safety: {
    readonly challengeBound: true;
    readonly independentHumanReviewRequired: true;
    readonly appendOnly: true;
    readonly historyPreserved: true;
    readonly noAutomatedFinalAuthority: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataAccessAccountabilityDisclosureNotice = {
  readonly id: string;
  readonly organizationId: string;
  readonly disclosureId: string;
  readonly challengeId: string;
  readonly resolutionId: string;
  readonly noticeType: CanopyProofDataAccessAccountabilityDisclosureNoticeType;
  readonly replacementDisclosureId?: string;
  readonly statement: string;
  readonly evidenceEventRoots: readonly string[];
  readonly publishedBy: string;
  readonly publisherRole: "owner" | "admin";
  readonly publishedAt: string;
  readonly noticeHash: string;
  readonly noticeRoot: string;
  readonly safety: {
    readonly resolutionBound: true;
    readonly originalDisclosurePreserved: true;
    readonly publicStatement: true;
    readonly appendOnly: true;
    readonly noRawDataEmbedded: true;
    readonly noPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

const organizationDocumentSchema = z.object({
  documentId: z.string().min(1).optional(),
  documentType: z.enum(["registration", "tax", "accreditation", "mandate", "audit_letter", "other"]),
  documentHash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
  issuedBy: z.string().min(1).optional(),
  uploadedAt: z.string().datetime().optional(),
});

const organizationProfileSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2),
  legalName: z.string().min(2).optional(),
  organizationType: z.enum(canopyProofOrganizationTypes),
  jurisdiction: z.string().min(1),
  registrationNumber: z.string().min(2).optional(),
  publicContact: z.string().min(3),
  operatingRegions: z.array(z.string().min(1)).min(1),
  verificationCapabilities: z.array(z.string().min(1)).default([]),
  documents: z.array(organizationDocumentSchema).default([]),
  authorizedUsers: z.array(z.string().min(1)).default([]),
  verificationStatus: z.enum(canopyProofOrganizationVerificationStatuses).default("pending"),
  trustLevel: z.enum(canopyProofOrganizationTrustLevels).default("unverified"),
  dataSharingPolicy: z.enum(["open", "restricted", "private"]).default("restricted"),
  createdAt: z.string().datetime().optional(),
});

const membershipSchema = z.object({
  actorId: z.string().min(1),
  role: z.enum(canopyProofPartnerRoles),
  conflictDisclosure: z.string().min(1),
  grantedAt: z.string().datetime().optional(),
});

const membershipStatusSchema = z.object({
  status: z.enum(["active", "suspended", "revoked"]),
  rationale: z.string().min(1),
  changedAt: z.string().datetime().optional(),
});

const accreditationSchema = z.object({
  status: z.enum(["pending", "approved", "suspended", "revoked"]),
  scope: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1),
  evidenceHash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
  decidedAt: z.string().datetime().optional(),
});

const agreementSchema = z.object({
  datasetScopes: z.array(z.string().min(1)).min(1),
  privacyTier: z.enum(["public", "restricted", "confidential"]),
  permittedUses: z.array(z.string().min(1)).min(1),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
});

const agreementRevocationSchema = z.object({
  rationale: z.string().min(12),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1),
  revokedAt: z.string().datetime().optional(),
});

const agreementSupersessionSchema = z
  .object({
    transitionType: z.enum(canopyProofDataSharingAgreementTransitionTypes),
    successor: agreementSchema.omit({ createdAt: true }),
    rationale: z.string().min(12),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1),
    supersededAt: z.string().datetime().optional(),
  })
  .strict();

const dataAccessRequestSchema = z.object({
  agreementId: z.string().min(1),
  datasetScopes: z.array(z.string().min(1)).min(1),
  permittedUses: z.array(z.string().min(1)).min(1),
  privacyTier: z.enum(["public", "restricted", "confidential"]),
  purpose: z.string().min(12),
  requestedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

const dataAccessDecisionSchema = z.object({
  status: z.enum(["approved", "denied", "revoked", "expired"]),
  rationale: z.string().min(12),
  decidedAt: z.string().datetime().optional(),
});

const dataAccessDeliverySchema = z.object({
  manifestId: z.string().min(1),
  manifestRequesterOrganizationId: z.string().min(1),
  manifestHash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
  manifestEntryRoot: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
  manifestClassification: z.enum(["public", "internal", "restricted", "confidential"]),
  channel: z.enum(canopyProofDataAccessDeliveryChannels),
  recipientActorId: z.string().min(1),
  purpose: z.string().min(12),
  deliveredAt: z.string().datetime().optional(),
});

const dataUseAttestationSchema = z.object({
  usageState: z.enum(canopyProofDataUseAttestationStates),
  useCase: z.string().min(12).max(2_000),
  outputHashes: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  limitations: z.array(z.string().min(4).max(500)).max(32).default([]),
  attestedAt: z.string().datetime().optional(),
});

const dataUseEnforcementCaseSchema = z.object({
  caseState: z.enum(canopyProofDataUseEnforcementStates),
  enforcementAction: z.enum(canopyProofDataUseEnforcementActions),
  rationale: z.string().min(12).max(2_000),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  reviewedAt: z.string().datetime().optional(),
});

const dataAccessRestrictionSchema = z.object({
  restrictionState: z.enum(canopyProofDataAccessRestrictionStates),
  rationale: z.string().min(12).max(2_000),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  decidedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

const dataAccessAccountabilityPacketSchema = z
  .object({
    intendedAudience: z.string().min(3).max(300).default("institutional audit reviewer"),
    generatedAt: z.string().datetime().optional(),
  })
  .strict();

const dataAccessAccountabilityVerificationSchema = z
  .object({
    expectedPacketRoot: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    verifiedAt: z.string().datetime().optional(),
  })
  .strict();

const dataAccessAccountabilityDisclosureSchema = z
  .object({
    verificationId: z.string().min(1),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();

const dataAccessAccountabilityDisclosureChallengeSchema = z
  .object({
    reason: z.enum(canopyProofDataAccessAccountabilityDisclosureChallengeReasons),
    statement: z.string().min(24).max(2_000),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1).max(128),
    challengedAt: z.string().datetime().optional(),
  })
  .strict();

const dataAccessAccountabilityDisclosureResolutionSchema = z
  .object({
    decision: z.enum(canopyProofDataAccessAccountabilityDisclosureResolutionDecisions),
    remedialAction: z.enum(canopyProofDataAccessAccountabilityDisclosureRemedialActions),
    rationale: z.string().min(24).max(2_000),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1).max(128),
    reviewedAt: z.string().datetime().optional(),
  })
  .strict();

const dataAccessAccountabilityDisclosureNoticeSchema = z
  .object({
    noticeType: z.enum(canopyProofDataAccessAccountabilityDisclosureNoticeTypes),
    replacementDisclosureId: z.string().min(1).optional(),
    statement: z.string().min(24).max(2_000),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1).max(128),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();

const organizationVerificationSchema = z.object({
  verificationStatus: z.enum(canopyProofOrganizationVerificationStatuses),
  trustLevel: z.enum(canopyProofOrganizationTrustLevels).optional(),
  registrationNumber: z.string().min(2).optional(),
  documents: z.array(organizationDocumentSchema).default([]),
  authorizedUsers: z.array(z.string().min(1)).default([]),
  rationale: z.string().min(12),
  reviewedAt: z.string().datetime().optional(),
});

export class CanopyProofPartnerService {
  private readonly organizationsById = new Map<string, CanopyProofOrganizationProfile>();
  private readonly membershipsById = new Map<string, CanopyProofMembership>();
  private readonly accreditationsById = new Map<string, CanopyProofAccreditation>();
  private readonly agreementsById = new Map<string, CanopyProofDataSharingAgreement>();
  private readonly agreementRevocationsById = new Map<string, CanopyProofDataSharingAgreementRevocation>();
  private readonly agreementSupersessionsById = new Map<string, CanopyProofDataSharingAgreementSupersession>();
  private readonly dataAccessRequestsById = new Map<string, CanopyProofDataAccessRequest>();
  private readonly dataAccessRequestDecisionsById = new Map<string, CanopyProofDataAccessRequestDecision>();
  private readonly dataAccessDeliveryReceiptsById = new Map<string, CanopyProofDataAccessDeliveryReceipt>();
  private readonly dataUseAttestationsById = new Map<string, CanopyProofDataUseAttestation>();
  private readonly dataUseEnforcementCasesById = new Map<string, CanopyProofDataUseEnforcementCase>();
  private readonly dataAccessRestrictionsById = new Map<string, CanopyProofDataAccessRestriction>();
  private readonly dataAccessAccountabilityPacketsById = new Map<string, CanopyProofDataAccessAccountabilityPacket>();
  private readonly dataAccessAccountabilityVerificationsById = new Map<string, CanopyProofDataAccessAccountabilityVerification>();
  private readonly dataAccessAccountabilityDisclosuresById = new Map<string, CanopyProofDataAccessAccountabilityDisclosure>();
  private readonly dataAccessAccountabilityDisclosureChallengesById = new Map<
    string,
    CanopyProofDataAccessAccountabilityDisclosureChallenge
  >();
  private readonly dataAccessAccountabilityDisclosureResolutionsById = new Map<
    string,
    CanopyProofDataAccessAccountabilityDisclosureResolution
  >();
  private readonly dataAccessAccountabilityDisclosureNoticesById = new Map<
    string,
    CanopyProofDataAccessAccountabilityDisclosureNotice
  >();

  static fromAuthoritySnapshot(snapshot: CanopyProofPartnerAuthoritySnapshot): CanopyProofPartnerService {
    const service = new CanopyProofPartnerService();
    for (const organization of snapshot.organizations) {
      if (service.organizationsById.has(organization.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate organization: ${organization.id}`);
      }
      service.organizationsById.set(organization.id, organization);
    }
    for (const membership of snapshot.memberships) {
      if (!service.organizationsById.has(membership.organizationId)) {
        throw new Error(`CanopyProof partner snapshot membership references a missing organization: ${membership.organizationId}`);
      }
      if (service.membershipsById.has(membership.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate membership: ${membership.id}`);
      }
      service.membershipsById.set(membership.id, membership);
    }
    for (const accreditation of snapshot.accreditations) {
      if (!service.organizationsById.has(accreditation.organizationId)) {
        throw new Error(`CanopyProof partner snapshot accreditation references a missing organization: ${accreditation.organizationId}`);
      }
      if (service.accreditationsById.has(accreditation.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate accreditation: ${accreditation.id}`);
      }
      service.accreditationsById.set(accreditation.id, accreditation);
    }
    for (const agreement of snapshot.dataSharingAgreements ?? []) {
      if (!service.organizationsById.has(agreement.organizationId)) {
        throw new Error(`CanopyProof partner snapshot agreement references a missing organization: ${agreement.organizationId}`);
      }
      if (service.agreementsById.has(agreement.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data-sharing agreement: ${agreement.id}`);
      }
      service.agreementsById.set(agreement.id, agreement);
    }
    for (const revocation of snapshot.dataSharingAgreementRevocations ?? []) {
      const agreement = service.agreementsById.get(revocation.agreementId);
      if (!agreement || agreement.organizationId !== revocation.organizationId) {
        throw new Error(`CanopyProof partner snapshot revocation references an invalid agreement: ${revocation.agreementId}`);
      }
      if (service.agreementRevocationsById.has(revocation.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate agreement revocation: ${revocation.id}`);
      }
      if ([...service.agreementRevocationsById.values()].some((entry) => entry.agreementId === revocation.agreementId)) {
        throw new Error(`CanopyProof partner snapshot contains multiple revocations for agreement: ${revocation.agreementId}`);
      }
      service.agreementRevocationsById.set(revocation.id, revocation);
      service.agreementsById.set(agreement.id, { ...agreement, revoked: true });
    }
    for (const supersession of snapshot.dataSharingAgreementSupersessions ?? []) {
      const predecessor = service.agreementsById.get(supersession.predecessorAgreementId);
      const successor = service.agreementsById.get(supersession.successorAgreementId);
      if (
        !predecessor ||
        !successor ||
        predecessor.organizationId !== supersession.organizationId ||
        successor.organizationId !== supersession.organizationId ||
        predecessor.agreementHash !== supersession.predecessorAgreementHash ||
        successor.agreementHash !== supersession.successorAgreementHash
      ) {
        throw new Error(`CanopyProof partner snapshot supersession has invalid agreement lineage: ${supersession.id}`);
      }
      if (predecessor.revoked) {
        throw new Error(`CanopyProof partner snapshot supersedes a revoked agreement: ${predecessor.id}`);
      }
      if (
        service.agreementSupersessionsById.has(supersession.id) ||
        [...service.agreementSupersessionsById.values()].some(
          (entry) =>
            entry.predecessorAgreementId === supersession.predecessorAgreementId ||
            entry.successorAgreementId === supersession.successorAgreementId,
        )
      ) {
        throw new Error(`CanopyProof partner snapshot contains conflicting agreement supersession: ${supersession.id}`);
      }
      service.agreementSupersessionsById.set(supersession.id, supersession);
      service.agreementsById.set(predecessor.id, {
        ...predecessor,
        superseded: true,
        supersededByAgreementId: successor.id,
      });
      service.agreementsById.set(successor.id, {
        ...successor,
        supersedesAgreementId: predecessor.id,
      });
    }
    for (const request of snapshot.dataAccessRequests ?? []) {
      const organization = service.organizationsById.get(request.organizationId);
      const agreement = service.agreementsById.get(request.agreementId);
      if (!organization || !agreement || agreement.organizationId !== request.organizationId) {
        throw new Error(`CanopyProof partner snapshot data access request has invalid authority lineage: ${request.id}`);
      }
      if (service.dataAccessRequestsById.has(request.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data access request: ${request.id}`);
      }
      if (
        request.status !== "pending" ||
        request.decisionBy !== undefined ||
        request.decidedAt !== undefined ||
        request.decisionRationale !== undefined ||
        request.decisionAuditEvent !== undefined
      ) {
        throw new Error(`CanopyProof partner snapshot request fact must remain pending and immutable: ${request.id}`);
      }
      assertDataAccessRequestSnapshotIntegrity({ organization, agreement, request });
      service.dataAccessRequestsById.set(request.id, request);
    }
    const decisionsByOrganization = new Map<string, CanopyProofDataAccessRequestDecision[]>();
    for (const decision of snapshot.dataAccessRequestDecisions ?? []) {
      const organization = service.organizationsById.get(decision.organizationId);
      const request = service.dataAccessRequestsById.get(decision.requestId);
      if (
        !organization ||
        !request ||
        request.organizationId !== decision.organizationId ||
        request.agreementId !== decision.agreementId
      ) {
        throw new Error(`CanopyProof partner snapshot data access decision has invalid request lineage: ${decision.id}`);
      }
      if (service.dataAccessRequestDecisionsById.has(decision.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data access decision: ${decision.id}`);
      }
      const decisions = decisionsByOrganization.get(decision.organizationId) ?? [];
      decisions.push(decision);
      decisionsByOrganization.set(decision.organizationId, decisions);
    }
    for (const [organizationId, decisions] of decisionsByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(`CanopyProof partner snapshot data access decisions reference a missing organization: ${organizationId}`);
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      decisions.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof partner snapshot data access decision is missing from the organization audit stream.");
        }
        return leftOrder - rightOrder;
      });
      for (const decision of decisions) {
        const request = service.dataAccessRequestsById.get(decision.requestId);
        if (!request) {
          throw new Error(`CanopyProof partner snapshot data access decision references a missing request: ${decision.requestId}`);
        }
        assertDataAccessRequestDecisionSnapshotIntegrity(request, decision);
        service.dataAccessRequestDecisionsById.set(decision.id, decision);
        service.dataAccessRequestsById.set(request.id, applyDataAccessRequestDecision(request, decision));
      }
    }
    const deliveriesByOrganization = new Map<string, CanopyProofDataAccessDeliveryReceipt[]>();
    const deliveryIds = new Set<string>();
    for (const receipt of snapshot.dataAccessDeliveryReceipts ?? []) {
      const organization = service.organizationsById.get(receipt.organizationId);
      const request = snapshot.dataAccessRequests?.find((entry) => entry.id === receipt.requestId);
      const agreement = snapshot.dataSharingAgreements?.find((entry) => entry.id === receipt.agreementId);
      if (
        !organization ||
        !request ||
        !agreement ||
        request.organizationId !== receipt.organizationId ||
        request.agreementId !== receipt.agreementId ||
        agreement.organizationId !== receipt.organizationId
      ) {
        throw new Error(`CanopyProof partner snapshot data access delivery has invalid authority lineage: ${receipt.id}`);
      }
      if (service.dataAccessDeliveryReceiptsById.has(receipt.id) || deliveryIds.has(receipt.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data access delivery receipt: ${receipt.id}`);
      }
      deliveryIds.add(receipt.id);
      const deliveries = deliveriesByOrganization.get(receipt.organizationId) ?? [];
      deliveries.push(receipt);
      deliveriesByOrganization.set(receipt.organizationId, deliveries);
    }
    for (const [organizationId, deliveries] of deliveriesByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(`CanopyProof partner snapshot data access deliveries reference a missing organization: ${organizationId}`);
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      deliveries.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof partner snapshot data access delivery is missing from the organization audit stream.");
        }
        return leftOrder - rightOrder;
      });
      for (const receipt of deliveries) {
        const deliveryOrder = eventOrder.get(receipt.auditEvent.eventRoot);
        const baseRequest = snapshot.dataAccessRequests?.find((entry) => entry.id === receipt.requestId);
        const baseAgreement = snapshot.dataSharingAgreements?.find((entry) => entry.id === receipt.agreementId);
        if (deliveryOrder === undefined || !baseRequest || !baseAgreement) {
          throw new Error(`CanopyProof partner snapshot data access delivery is missing its replay authority: ${receipt.id}`);
        }
        const requestAtDelivery = projectDataAccessRequestAtAuditOrder({
          request: baseRequest,
          decisions: snapshot.dataAccessRequestDecisions ?? [],
          eventOrder,
          targetOrder: deliveryOrder,
        });
        const agreementAtDelivery = projectDataSharingAgreementAtAuditOrder({
          agreement: baseAgreement,
          revocations: snapshot.dataSharingAgreementRevocations ?? [],
          supersessions: snapshot.dataSharingAgreementSupersessions ?? [],
          eventOrder,
          targetOrder: deliveryOrder,
        });
        assertDataAccessDeliveryReceiptSnapshotIntegrity({
          organization,
          request: requestAtDelivery,
          agreement: agreementAtDelivery,
          receipt,
        });
        service.dataAccessDeliveryReceiptsById.set(receipt.id, receipt);
      }
    }
    const attestationsByOrganization = new Map<string, CanopyProofDataUseAttestation[]>();
    const attestationIds = new Set<string>();
    for (const attestation of snapshot.dataUseAttestations ?? []) {
      const organization = service.organizationsById.get(attestation.organizationId);
      const delivery = service.dataAccessDeliveryReceiptsById.get(attestation.deliveryId);
      if (
        !organization ||
        !delivery ||
        delivery.organizationId !== attestation.organizationId ||
        delivery.requestId !== attestation.requestId ||
        delivery.manifestId !== attestation.manifestId
      ) {
        throw new Error(`CanopyProof partner snapshot data use attestation has invalid delivery lineage: ${attestation.id}`);
      }
      if (service.dataUseAttestationsById.has(attestation.id) || attestationIds.has(attestation.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data use attestation: ${attestation.id}`);
      }
      attestationIds.add(attestation.id);
      const attestations = attestationsByOrganization.get(attestation.organizationId) ?? [];
      attestations.push(attestation);
      attestationsByOrganization.set(attestation.organizationId, attestations);
    }
    for (const [organizationId, attestations] of attestationsByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(`CanopyProof partner snapshot data use attestations reference a missing organization: ${organizationId}`);
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      attestations.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof partner snapshot data use attestation is missing from the organization audit stream.");
        }
        return leftOrder - rightOrder;
      });
      for (const attestation of attestations) {
        const attestationOrder = eventOrder.get(attestation.auditEvent.eventRoot);
        const delivery = service.dataAccessDeliveryReceiptsById.get(attestation.deliveryId);
        const baseRequest = snapshot.dataAccessRequests?.find((entry) => entry.id === attestation.requestId);
        const baseAgreement = baseRequest
          ? snapshot.dataSharingAgreements?.find((entry) => entry.id === baseRequest.agreementId)
          : undefined;
        const deliveryOrder = delivery ? eventOrder.get(delivery.auditEvent.eventRoot) : undefined;
        if (
          attestationOrder === undefined ||
          deliveryOrder === undefined ||
          attestationOrder <= deliveryOrder ||
          !delivery ||
          !baseRequest ||
          !baseAgreement
        ) {
          throw new Error(`CanopyProof partner snapshot data use attestation is missing its replay authority: ${attestation.id}`);
        }
        const requestAtAttestation = projectDataAccessRequestAtAuditOrder({
          request: baseRequest,
          decisions: snapshot.dataAccessRequestDecisions ?? [],
          eventOrder,
          targetOrder: attestationOrder,
        });
        const agreementAtAttestation = projectDataSharingAgreementAtAuditOrder({
          agreement: baseAgreement,
          revocations: snapshot.dataSharingAgreementRevocations ?? [],
          supersessions: snapshot.dataSharingAgreementSupersessions ?? [],
          eventOrder,
          targetOrder: attestationOrder,
        });
        assertDataUseAttestationSnapshotIntegrity({
          delivery,
          request: requestAtAttestation,
          agreement: agreementAtAttestation,
          attestation,
        });
        service.dataUseAttestationsById.set(attestation.id, attestation);
      }
    }
    const enforcementCasesByOrganization = new Map<string, CanopyProofDataUseEnforcementCase[]>();
    const enforcementCaseIds = new Set<string>();
    for (const enforcementCase of snapshot.dataUseEnforcementCases ?? []) {
      const organization = service.organizationsById.get(enforcementCase.organizationId);
      const attestation = service.dataUseAttestationsById.get(enforcementCase.attestationId);
      const delivery = service.dataAccessDeliveryReceiptsById.get(enforcementCase.deliveryId);
      const request = service.dataAccessRequestsById.get(enforcementCase.requestId);
      if (
        !organization ||
        !attestation ||
        !delivery ||
        !request ||
        attestation.organizationId !== enforcementCase.organizationId ||
        attestation.requestId !== enforcementCase.requestId ||
        attestation.deliveryId !== enforcementCase.deliveryId ||
        attestation.manifestId !== enforcementCase.manifestId ||
        delivery.organizationId !== enforcementCase.organizationId ||
        delivery.requestId !== enforcementCase.requestId ||
        delivery.manifestId !== enforcementCase.manifestId
      ) {
        throw new Error(`CanopyProof partner snapshot data use enforcement case has invalid authority lineage: ${enforcementCase.id}`);
      }
      if (service.dataUseEnforcementCasesById.has(enforcementCase.id) || enforcementCaseIds.has(enforcementCase.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data use enforcement case: ${enforcementCase.id}`);
      }
      enforcementCaseIds.add(enforcementCase.id);
      const enforcementCases = enforcementCasesByOrganization.get(enforcementCase.organizationId) ?? [];
      enforcementCases.push(enforcementCase);
      enforcementCasesByOrganization.set(enforcementCase.organizationId, enforcementCases);
    }
    for (const [organizationId, enforcementCases] of enforcementCasesByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(`CanopyProof partner snapshot data use enforcement cases reference a missing organization: ${organizationId}`);
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      enforcementCases.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof partner snapshot data use enforcement case is missing from the organization audit stream.");
        }
        return leftOrder - rightOrder;
      });
      for (const enforcementCase of enforcementCases) {
        const attestation = service.dataUseAttestationsById.get(enforcementCase.attestationId);
        const delivery = service.dataAccessDeliveryReceiptsById.get(enforcementCase.deliveryId);
        const request = service.dataAccessRequestsById.get(enforcementCase.requestId);
        const enforcementOrder = eventOrder.get(enforcementCase.auditEvent.eventRoot);
        const attestationOrder = attestation ? eventOrder.get(attestation.auditEvent.eventRoot) : undefined;
        if (
          !attestation ||
          !delivery ||
          !request ||
          enforcementOrder === undefined ||
          attestationOrder === undefined ||
          enforcementOrder <= attestationOrder
        ) {
          throw new Error(`CanopyProof partner snapshot data use enforcement case is missing its replay authority: ${enforcementCase.id}`);
        }
        assertDataUseEnforcementCaseSnapshotIntegrity({
          attestation,
          delivery,
          request,
          enforcementCase,
        });
        service.dataUseEnforcementCasesById.set(enforcementCase.id, enforcementCase);
      }
    }
    const restrictionsByOrganization = new Map<string, CanopyProofDataAccessRestriction[]>();
    const restrictionIds = new Set<string>();
    for (const restriction of snapshot.dataAccessRestrictions ?? []) {
      const organization = service.organizationsById.get(restriction.organizationId);
      const request = service.dataAccessRequestsById.get(restriction.requestId);
      const enforcementCase = service.dataUseEnforcementCasesById.get(restriction.enforcementCaseId);
      const attestation = service.dataUseAttestationsById.get(restriction.attestationId);
      const delivery = service.dataAccessDeliveryReceiptsById.get(restriction.deliveryId);
      if (
        !organization ||
        !request ||
        !enforcementCase ||
        !attestation ||
        !delivery ||
        request.organizationId !== restriction.organizationId ||
        enforcementCase.organizationId !== restriction.organizationId ||
        enforcementCase.requestId !== restriction.requestId ||
        enforcementCase.attestationId !== restriction.attestationId ||
        enforcementCase.deliveryId !== restriction.deliveryId
      ) {
        throw new Error(`CanopyProof partner snapshot data access restriction has invalid authority lineage: ${restriction.id}`);
      }
      if (service.dataAccessRestrictionsById.has(restriction.id) || restrictionIds.has(restriction.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate data access restriction: ${restriction.id}`);
      }
      restrictionIds.add(restriction.id);
      const restrictions = restrictionsByOrganization.get(restriction.organizationId) ?? [];
      restrictions.push(restriction);
      restrictionsByOrganization.set(restriction.organizationId, restrictions);
    }
    for (const [organizationId, restrictions] of restrictionsByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(`CanopyProof partner snapshot data access restrictions reference a missing organization: ${organizationId}`);
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      restrictions.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof partner snapshot data access restriction is missing from the organization audit stream.");
        }
        return leftOrder - rightOrder;
      });
      const currentRestrictionByRequest = new Map<string, CanopyProofDataAccessRestriction>();
      for (const restriction of restrictions) {
        const request = service.dataAccessRequestsById.get(restriction.requestId);
        const enforcementCase = service.dataUseEnforcementCasesById.get(restriction.enforcementCaseId);
        const attestation = service.dataUseAttestationsById.get(restriction.attestationId);
        const delivery = service.dataAccessDeliveryReceiptsById.get(restriction.deliveryId);
        const restrictionOrder = eventOrder.get(restriction.auditEvent.eventRoot);
        const enforcementOrder = enforcementCase ? eventOrder.get(enforcementCase.auditEvent.eventRoot) : undefined;
        const currentRestriction = currentRestrictionByRequest.get(restriction.requestId);
        const currentRestrictionOrder = currentRestriction
          ? eventOrder.get(currentRestriction.auditEvent.eventRoot)
          : undefined;
        if (
          !request ||
          !enforcementCase ||
          !attestation ||
          !delivery ||
          restrictionOrder === undefined ||
          enforcementOrder === undefined ||
          restrictionOrder <= enforcementOrder ||
          (currentRestriction && (currentRestrictionOrder === undefined || enforcementOrder <= currentRestrictionOrder))
        ) {
          throw new Error(`CanopyProof partner snapshot data access restriction is missing its replay authority: ${restriction.id}`);
        }
        assertDataAccessRestrictionSnapshotIntegrity({
          request,
          enforcementCase,
          attestation,
          delivery,
          restriction,
          ...(currentRestriction ? { currentRestriction } : {}),
        });
        currentRestrictionByRequest.set(restriction.requestId, restriction);
        service.dataAccessRestrictionsById.set(restriction.id, restriction);
      }
    }
    const packetsByOrganization = new Map<string, CanopyProofDataAccessAccountabilityPacket[]>();
    const packetIds = new Set<string>();
    for (const packet of snapshot.dataAccessAccountabilityPackets ?? []) {
      const organization = service.organizationsById.get(packet.organizationId);
      const request = snapshot.dataAccessRequests?.find((entry) => entry.id === packet.requestId);
      const agreement = snapshot.dataSharingAgreements?.find((entry) => entry.id === packet.agreementId);
      if (
        !organization ||
        !request ||
        !agreement ||
        request.organizationId !== packet.organizationId ||
        request.agreementId !== packet.agreementId ||
        agreement.organizationId !== packet.organizationId
      ) {
        throw new Error(`CanopyProof partner snapshot accountability packet has invalid authority lineage: ${packet.id}`);
      }
      if (service.dataAccessAccountabilityPacketsById.has(packet.id) || packetIds.has(packet.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate accountability packet: ${packet.id}`);
      }
      packetIds.add(packet.id);
      const packets = packetsByOrganization.get(packet.organizationId) ?? [];
      packets.push(packet);
      packetsByOrganization.set(packet.organizationId, packets);
    }
    for (const [organizationId, packets] of packetsByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(`CanopyProof partner snapshot accountability packets reference a missing organization: ${organizationId}`);
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      packets.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof partner snapshot accountability packet is missing from the organization audit stream.");
        }
        return leftOrder - rightOrder;
      });
      for (const packet of packets) {
        const packetOrder = eventOrder.get(packet.auditEvent.eventRoot);
        const baseRequest = snapshot.dataAccessRequests?.find((entry) => entry.id === packet.requestId);
        const requestOrder = baseRequest ? eventOrder.get(baseRequest.auditEvent.eventRoot) : undefined;
        if (packetOrder === undefined || requestOrder === undefined || packetOrder <= requestOrder || !baseRequest) {
          throw new Error(`CanopyProof partner snapshot accountability packet is missing its replay authority: ${packet.id}`);
        }
        const requestAtPacket = projectDataAccessRequestAtAuditOrder({
          request: baseRequest,
          decisions: snapshot.dataAccessRequestDecisions ?? [],
          eventOrder,
          targetOrder: packetOrder,
        });
        const packetSnapshot = service.buildDataAccessAccountabilitySnapshot(requestAtPacket, {
          eventOrder,
          beforeOrder: packetOrder,
        });
        assertDataAccessAccountabilityPacketSnapshotIntegrity({
          request: requestAtPacket,
          packet,
          snapshot: packetSnapshot,
        });
        service.dataAccessAccountabilityPacketsById.set(packet.id, packet);
      }
    }
    const verificationsByOrganization = new Map<string, CanopyProofDataAccessAccountabilityVerification[]>();
    const verificationIds = new Set<string>();
    for (const verification of snapshot.dataAccessAccountabilityVerifications ?? []) {
      const packet = service.dataAccessAccountabilityPacketsById.get(verification.packetId);
      if (
        !packet ||
        packet.organizationId !== verification.organizationId ||
        packet.requestId !== verification.requestId
      ) {
        throw new Error(
          `CanopyProof partner snapshot accountability verification has invalid packet lineage: ${verification.id}`,
        );
      }
      if (service.dataAccessAccountabilityVerificationsById.has(verification.id) || verificationIds.has(verification.id)) {
        throw new Error(`CanopyProof partner snapshot contains duplicate accountability verification: ${verification.id}`);
      }
      verificationIds.add(verification.id);
      const verifications = verificationsByOrganization.get(verification.organizationId) ?? [];
      verifications.push(verification);
      verificationsByOrganization.set(verification.organizationId, verifications);
    }
    for (const [organizationId, verifications] of verificationsByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(
          `CanopyProof partner snapshot accountability verifications reference a missing organization: ${organizationId}`,
        );
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      verifications.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error(
            "CanopyProof partner snapshot accountability verification is missing from the organization audit stream.",
          );
        }
        return leftOrder - rightOrder;
      });
      for (const verification of verifications) {
        const packet = service.dataAccessAccountabilityPacketsById.get(verification.packetId);
        const verificationOrder = eventOrder.get(verification.auditEvent.eventRoot);
        const packetOrder = packet ? eventOrder.get(packet.auditEvent.eventRoot) : undefined;
        const baseRequest = snapshot.dataAccessRequests?.find((entry) => entry.id === verification.requestId);
        if (
          !packet ||
          !baseRequest ||
          verificationOrder === undefined ||
          packetOrder === undefined ||
          verificationOrder <= packetOrder
        ) {
          throw new Error(
            `CanopyProof partner snapshot accountability verification is missing its replay authority: ${verification.id}`,
          );
        }
        const requestAtVerification = projectDataAccessRequestAtAuditOrder({
          request: baseRequest,
          decisions: snapshot.dataAccessRequestDecisions ?? [],
          eventOrder,
          targetOrder: verificationOrder,
        });
        const replay = service.replayDataAccessAccountabilityPacket(packet, requestAtVerification, {
          eventOrder,
          beforeOrder: verificationOrder,
        });
        assertDataAccessAccountabilityVerificationSnapshotIntegrity({ packet, verification, replay });
        service.dataAccessAccountabilityVerificationsById.set(verification.id, verification);
      }
    }
    const disclosuresByOrganization = new Map<string, CanopyProofDataAccessAccountabilityDisclosure[]>();
    const disclosureIds = new Set<string>();
    const disclosedPacketIds = new Set<string>();
    for (const disclosure of snapshot.dataAccessAccountabilityDisclosures ?? []) {
      const packet = service.dataAccessAccountabilityPacketsById.get(disclosure.packetId);
      const verification = service.dataAccessAccountabilityVerificationsById.get(disclosure.verificationId);
      if (
        !packet ||
        !verification ||
        packet.organizationId !== disclosure.organizationId ||
        verification.organizationId !== disclosure.organizationId ||
        verification.packetId !== packet.id
      ) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure has invalid packet verification lineage: ${disclosure.id}`,
        );
      }
      if (
        service.dataAccessAccountabilityDisclosuresById.has(disclosure.id) ||
        disclosureIds.has(disclosure.id) ||
        disclosedPacketIds.has(disclosure.packetId)
      ) {
        throw new Error(`CanopyProof partner snapshot contains a duplicate accountability disclosure: ${disclosure.id}`);
      }
      disclosureIds.add(disclosure.id);
      disclosedPacketIds.add(disclosure.packetId);
      const disclosures = disclosuresByOrganization.get(disclosure.organizationId) ?? [];
      disclosures.push(disclosure);
      disclosuresByOrganization.set(disclosure.organizationId, disclosures);
    }
    for (const [organizationId, disclosures] of disclosuresByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosures reference a missing organization: ${organizationId}`,
        );
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      disclosures.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error(
            "CanopyProof partner snapshot accountability disclosure is missing from the organization audit stream.",
          );
        }
        return leftOrder - rightOrder;
      });
      for (const disclosure of disclosures) {
        const packet = service.dataAccessAccountabilityPacketsById.get(disclosure.packetId);
        const verification = service.dataAccessAccountabilityVerificationsById.get(disclosure.verificationId);
        const disclosureOrder = eventOrder.get(disclosure.auditEvent.eventRoot);
        const verificationOrder = verification ? eventOrder.get(verification.auditEvent.eventRoot) : undefined;
        const packetOrder = packet ? eventOrder.get(packet.auditEvent.eventRoot) : undefined;
        const baseRequest = packet
          ? snapshot.dataAccessRequests?.find((entry) => entry.id === packet.requestId)
          : undefined;
        if (
          !packet ||
          !verification ||
          !baseRequest ||
          disclosureOrder === undefined ||
          verificationOrder === undefined ||
          packetOrder === undefined ||
          verificationOrder <= packetOrder ||
          disclosureOrder <= verificationOrder
        ) {
          throw new Error(
            `CanopyProof partner snapshot accountability disclosure is missing its replay authority: ${disclosure.id}`,
          );
        }
        const requestAtDisclosure = projectDataAccessRequestAtAuditOrder({
          request: baseRequest,
          decisions: snapshot.dataAccessRequestDecisions ?? [],
          eventOrder,
          targetOrder: disclosureOrder,
        });
        const replay = service.replayDataAccessAccountabilityPacket(packet, requestAtDisclosure, {
          eventOrder,
          beforeOrder: disclosureOrder,
        });
        assertDataAccessAccountabilityDisclosureSnapshotIntegrity({
          packet,
          verification,
          disclosure,
          replay,
        });
        service.dataAccessAccountabilityDisclosuresById.set(disclosure.id, disclosure);
      }
    }
    const challengesByOrganization = new Map<string, CanopyProofDataAccessAccountabilityDisclosureChallenge[]>();
    const challengeIds = new Set<string>();
    const challengeUniqueness = new Set<string>();
    for (const challenge of snapshot.dataAccessAccountabilityDisclosureChallenges ?? []) {
      const disclosure = service.dataAccessAccountabilityDisclosuresById.get(challenge.disclosureId);
      if (!disclosure || disclosure.organizationId !== challenge.organizationId) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure challenge has invalid disclosure lineage: ${challenge.id}`,
        );
      }
      const uniquenessKey = `${challenge.disclosureId}\u0000${challenge.challengedBy}\u0000${challenge.reason}`;
      if (
        service.dataAccessAccountabilityDisclosureChallengesById.has(challenge.id) ||
        challengeIds.has(challenge.id) ||
        challengeUniqueness.has(uniquenessKey)
      ) {
        throw new Error(
          `CanopyProof partner snapshot contains a duplicate accountability disclosure challenge: ${challenge.id}`,
        );
      }
      challengeIds.add(challenge.id);
      challengeUniqueness.add(uniquenessKey);
      const challenges = challengesByOrganization.get(challenge.organizationId) ?? [];
      challenges.push(challenge);
      challengesByOrganization.set(challenge.organizationId, challenges);
    }
    for (const [organizationId, challenges] of challengesByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure challenges reference a missing organization: ${organizationId}`,
        );
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      challenges.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error(
            "CanopyProof partner snapshot accountability disclosure challenge is missing from the organization audit stream.",
          );
        }
        return leftOrder - rightOrder;
      });
      for (const challenge of challenges) {
        const disclosure = service.dataAccessAccountabilityDisclosuresById.get(challenge.disclosureId);
        const challengeOrder = eventOrder.get(challenge.auditEvent.eventRoot);
        const disclosureOrder = disclosure ? eventOrder.get(disclosure.auditEvent.eventRoot) : undefined;
        if (
          !disclosure ||
          challengeOrder === undefined ||
          disclosureOrder === undefined ||
          challengeOrder <= disclosureOrder
        ) {
          throw new Error(
            `CanopyProof partner snapshot accountability disclosure challenge is missing its publication authority: ${challenge.id}`,
          );
        }
        assertDataAccessAccountabilityDisclosureChallengeSnapshotIntegrity({ disclosure, challenge });
        service.dataAccessAccountabilityDisclosureChallengesById.set(challenge.id, challenge);
      }
    }
    const resolutionsByOrganization = new Map<string, CanopyProofDataAccessAccountabilityDisclosureResolution[]>();
    const resolutionIds = new Set<string>();
    for (const resolution of snapshot.dataAccessAccountabilityDisclosureResolutions ?? []) {
      const challenge = service.dataAccessAccountabilityDisclosureChallengesById.get(resolution.challengeId);
      const disclosure = service.dataAccessAccountabilityDisclosuresById.get(resolution.disclosureId);
      if (
        !challenge ||
        !disclosure ||
        challenge.disclosureId !== disclosure.id ||
        challenge.organizationId !== resolution.organizationId ||
        disclosure.organizationId !== resolution.organizationId
      ) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure resolution has invalid challenge lineage: ${resolution.id}`,
        );
      }
      if (service.dataAccessAccountabilityDisclosureResolutionsById.has(resolution.id) || resolutionIds.has(resolution.id)) {
        throw new Error(
          `CanopyProof partner snapshot contains a duplicate accountability disclosure resolution: ${resolution.id}`,
        );
      }
      resolutionIds.add(resolution.id);
      const resolutions = resolutionsByOrganization.get(resolution.organizationId) ?? [];
      resolutions.push(resolution);
      resolutionsByOrganization.set(resolution.organizationId, resolutions);
    }
    for (const [organizationId, resolutions] of resolutionsByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure resolutions reference a missing organization: ${organizationId}`,
        );
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      const latestByChallenge = new Map<string, CanopyProofDataAccessAccountabilityDisclosureResolution>();
      resolutions.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error(
            "CanopyProof partner snapshot accountability disclosure resolution is missing from the organization audit stream.",
          );
        }
        return leftOrder - rightOrder;
      });
      for (const resolution of resolutions) {
        const challenge = service.dataAccessAccountabilityDisclosureChallengesById.get(resolution.challengeId);
        const disclosure = service.dataAccessAccountabilityDisclosuresById.get(resolution.disclosureId);
        const previousResolution = latestByChallenge.get(resolution.challengeId);
        const resolutionOrder = eventOrder.get(resolution.auditEvent.eventRoot);
        const challengeOrder = challenge ? eventOrder.get(challenge.auditEvent.eventRoot) : undefined;
        const previousResolutionOrder = previousResolution
          ? eventOrder.get(previousResolution.auditEvent.eventRoot)
          : undefined;
        if (
          !challenge ||
          !disclosure ||
          resolutionOrder === undefined ||
          challengeOrder === undefined ||
          resolutionOrder <= challengeOrder ||
          (previousResolutionOrder !== undefined && resolutionOrder <= previousResolutionOrder)
        ) {
          throw new Error(
            `CanopyProof partner snapshot accountability disclosure resolution is missing its challenge authority: ${resolution.id}`,
          );
        }
        if (
          (previousResolution &&
            (resolution.previousResolutionId !== previousResolution.id ||
              resolution.previousResolutionRoot !== previousResolution.resolutionRoot)) ||
          (!previousResolution &&
            (resolution.previousResolutionId !== undefined || resolution.previousResolutionRoot !== undefined))
        ) {
          throw new Error(
            `CanopyProof partner snapshot accountability disclosure resolution has a forked predecessor: ${resolution.id}`,
          );
        }
        assertDataAccessAccountabilityDisclosureResolutionSnapshotIntegrity({
          disclosure,
          challenge,
          resolution,
          ...(previousResolution ? { previousResolution } : {}),
        });
        service.dataAccessAccountabilityDisclosureResolutionsById.set(resolution.id, resolution);
        latestByChallenge.set(resolution.challengeId, resolution);
      }
    }
    const noticesByOrganization = new Map<string, CanopyProofDataAccessAccountabilityDisclosureNotice[]>();
    const noticeIds = new Set<string>();
    const noticedResolutionIds = new Set<string>();
    for (const notice of snapshot.dataAccessAccountabilityDisclosureNotices ?? []) {
      const resolution = service.dataAccessAccountabilityDisclosureResolutionsById.get(notice.resolutionId);
      const challenge = service.dataAccessAccountabilityDisclosureChallengesById.get(notice.challengeId);
      const disclosure = service.dataAccessAccountabilityDisclosuresById.get(notice.disclosureId);
      const replacementDisclosure = notice.replacementDisclosureId
        ? service.dataAccessAccountabilityDisclosuresById.get(notice.replacementDisclosureId)
        : undefined;
      if (
        !resolution ||
        !challenge ||
        !disclosure ||
        resolution.challengeId !== challenge.id ||
        resolution.disclosureId !== disclosure.id ||
        resolution.organizationId !== notice.organizationId ||
        challenge.organizationId !== notice.organizationId ||
        disclosure.organizationId !== notice.organizationId ||
        (notice.replacementDisclosureId && !replacementDisclosure)
      ) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure notice has invalid resolution lineage: ${notice.id}`,
        );
      }
      if (
        service.dataAccessAccountabilityDisclosureNoticesById.has(notice.id) ||
        noticeIds.has(notice.id) ||
        noticedResolutionIds.has(notice.resolutionId)
      ) {
        throw new Error(
          `CanopyProof partner snapshot contains a duplicate accountability disclosure notice: ${notice.id}`,
        );
      }
      noticeIds.add(notice.id);
      noticedResolutionIds.add(notice.resolutionId);
      const notices = noticesByOrganization.get(notice.organizationId) ?? [];
      notices.push(notice);
      noticesByOrganization.set(notice.organizationId, notices);
    }
    for (const [organizationId, notices] of noticesByOrganization) {
      const organization = service.organizationsById.get(organizationId);
      if (!organization) {
        throw new Error(
          `CanopyProof partner snapshot accountability disclosure notices reference a missing organization: ${organizationId}`,
        );
      }
      const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
      notices.sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error(
            "CanopyProof partner snapshot accountability disclosure notice is missing from the organization audit stream.",
          );
        }
        return leftOrder - rightOrder;
      });
      for (const notice of notices) {
        const resolution = service.dataAccessAccountabilityDisclosureResolutionsById.get(notice.resolutionId);
        const challenge = service.dataAccessAccountabilityDisclosureChallengesById.get(notice.challengeId);
        const disclosure = service.dataAccessAccountabilityDisclosuresById.get(notice.disclosureId);
        const replacementDisclosure = notice.replacementDisclosureId
          ? service.dataAccessAccountabilityDisclosuresById.get(notice.replacementDisclosureId)
          : undefined;
        const noticeOrder = eventOrder.get(notice.auditEvent.eventRoot);
        const resolutionOrder = resolution ? eventOrder.get(resolution.auditEvent.eventRoot) : undefined;
        const replacementOrder = replacementDisclosure
          ? eventOrder.get(replacementDisclosure.auditEvent.eventRoot)
          : undefined;
        if (
          !resolution ||
          !challenge ||
          !disclosure ||
          noticeOrder === undefined ||
          resolutionOrder === undefined ||
          noticeOrder <= resolutionOrder ||
          (replacementDisclosure && (replacementOrder === undefined || replacementOrder >= noticeOrder))
        ) {
          throw new Error(
            `CanopyProof partner snapshot accountability disclosure notice is missing its publication authority: ${notice.id}`,
          );
        }
        const latestResolution = service.listDataAccessAccountabilityDisclosureResolutions(challenge.id).at(-1);
        const replacementPacket = replacementDisclosure
          ? service.dataAccessAccountabilityPacketsById.get(replacementDisclosure.packetId)
          : undefined;
        const replacementBaseRequest = replacementPacket
          ? snapshot.dataAccessRequests?.find((entry) => entry.id === replacementPacket.requestId)
          : undefined;
        const replacementRequestAtNotice = replacementBaseRequest
          ? projectDataAccessRequestAtAuditOrder({
              request: replacementBaseRequest,
              decisions: snapshot.dataAccessRequestDecisions ?? [],
              eventOrder,
              targetOrder: noticeOrder,
            })
          : undefined;
        if (replacementDisclosure && (!replacementPacket || !replacementRequestAtNotice)) {
          throw new Error(
            `CanopyProof partner snapshot accountability correction notice is missing replacement replay authority: ${notice.id}`,
          );
        }
        const replacementDisclosureView =
          replacementDisclosure && replacementRequestAtNotice
            ? service.buildDataAccessAccountabilityDisclosureView(
                replacementDisclosure,
                { eventOrder, beforeOrder: noticeOrder },
                replacementRequestAtNotice,
              )
            : undefined;
        assertDataAccessAccountabilityDisclosureNoticeSnapshotIntegrity({
          disclosure,
          challenge,
          resolution,
          ...(latestResolution ? { latestResolution } : {}),
          ...(replacementDisclosureView ? { replacementDisclosure: replacementDisclosureView } : {}),
          notice,
        });
        service.dataAccessAccountabilityDisclosureNoticesById.set(notice.id, notice);
      }
    }
    return service;
  }

  registerOrganization(input: unknown, actorId: string) {
    const parsed = organizationProfileSchema.parse(input);
    assertSafePartnerText([
      parsed.name,
      parsed.legalName ?? parsed.name,
      parsed.jurisdiction,
      parsed.registrationNumber ?? "not_provided",
      parsed.publicContact,
      ...parsed.verificationCapabilities,
      ...parsed.authorizedUsers,
    ]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const documents = normalizeOrganizationDocuments(parsed.documents, createdAt);
    const authorizedUsers = [...new Set(parsed.authorizedUsers)].sort();
    const organizationId =
      parsed.id ??
      `cp_org_${hashJson({
        name: parsed.name,
        legalName: parsed.legalName ?? parsed.name,
        organizationType: parsed.organizationType,
        jurisdiction: parsed.jurisdiction,
        createdAt,
      }).slice(0, 24)}`;
    const payload = {
      name: parsed.name,
      legalName: parsed.legalName ?? parsed.name,
      organizationType: parsed.organizationType,
      jurisdiction: parsed.jurisdiction,
      registrationNumber: parsed.registrationNumber ?? null,
      operatingRegions: [...parsed.operatingRegions].sort(),
      verificationCapabilities: [...parsed.verificationCapabilities].sort(),
      verificationStatus: parsed.verificationStatus,
      trustLevel: parsed.trustLevel,
      documentRoots: documents.map((document) => document.documentHash).sort(),
      authorizedUsers,
      dataSharingPolicy: parsed.dataSharingPolicy,
    };
    const profileHash = hashJson({ kind: "canopyproof-organization-profile-v1", ...payload, createdAt });
    const existing = this.organizationsById.get(organizationId);
    if (existing) {
      if (existing.profileHash === profileHash) return existing;
      throw new Error(`CanopyProof organization already exists with conflicting payload: ${organizationId}`);
    }
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "organization",
      entityId: organizationId,
      payload,
      createdAt,
      rationale: "CanopyProof partner organization profile registered with explicit jurisdiction, capabilities, and data-sharing policy.",
    });
    const profile: CanopyProofOrganizationProfile = {
      id: organizationId,
      name: parsed.name,
      legalName: parsed.legalName ?? parsed.name,
      organizationType: parsed.organizationType,
      jurisdiction: parsed.jurisdiction,
      ...(parsed.registrationNumber ? { registrationNumber: parsed.registrationNumber } : {}),
      publicContact: parsed.publicContact,
      operatingRegions: [...parsed.operatingRegions].sort(),
      verificationCapabilities: [...parsed.verificationCapabilities].sort(),
      accreditationStatus: "pending",
      verificationStatus: parsed.verificationStatus,
      documents,
      authorizedUsers,
      trustLevel: parsed.trustLevel,
      dataSharingPolicy: parsed.dataSharingPolicy,
      profileHash,
      createdAt,
      updatedAt: createdAt,
      auditHistory,
    };
    this.organizationsById.set(profile.id, profile);
    return profile;
  }

  listOrganizations() {
    return [...this.organizationsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  listPartners() {
    return this.listOrganizations().filter(
      (organization) =>
        organization.accreditationStatus === "approved" &&
        organization.verificationStatus !== "suspended" &&
        organization.verificationStatus !== "revoked",
    );
  }

  getOrganization(organizationId: string) {
    const organization = this.organizationsById.get(organizationId);
    if (!organization) {
      throw new Error(`CanopyProof organization not found: ${organizationId}`);
    }
    return organization;
  }

  updateOrganizationVerification(organizationId: string, input: unknown, actorId: string) {
    const organization = this.getOrganization(organizationId);
    const parsed = organizationVerificationSchema.parse(input);
    assertSafePartnerText([
      parsed.registrationNumber ?? organization.registrationNumber ?? "not_provided",
      parsed.rationale,
      ...parsed.authorizedUsers,
    ]);
    const reviewedAt = parsed.reviewedAt ?? new Date(0).toISOString();
    const documents = mergeOrganizationDocuments(organization.documents, normalizeOrganizationDocuments(parsed.documents, reviewedAt));
    const registrationNumber = parsed.registrationNumber ?? organization.registrationNumber;
    assertVerificationTransition({
      previousStatus: organization.verificationStatus,
      nextStatus: parsed.verificationStatus,
      documentCount: documents.length,
      ...(registrationNumber ? { registrationNumber } : {}),
      ...(parsed.trustLevel ? { trustLevel: parsed.trustLevel } : {}),
    });
    const authorizedUsers = [...new Set([...organization.authorizedUsers, ...parsed.authorizedUsers])].sort();
    const trustLevel = resolveTrustLevel(parsed.verificationStatus, parsed.trustLevel ?? organization.trustLevel);
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.verificationStatus === "verified" ? "FULFILL" : parsed.verificationStatus === "suspended" || parsed.verificationStatus === "revoked" ? "CHALLENGE" : "ASSERT",
      actor: actorId,
      entityType: "organization_verification",
      entityId: organization.id,
      payload: {
        previousStatus: organization.verificationStatus,
        verificationStatus: parsed.verificationStatus,
        previousTrustLevel: organization.trustLevel,
        trustLevel,
        registrationNumber: registrationNumber ?? null,
        documentRoots: documents.map((document) => document.documentHash).sort(),
        authorizedUsers,
      },
      createdAt: reviewedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof organization verification update failed to append audit event.");
    }
    const updated: CanopyProofOrganizationProfile = {
      ...organization,
      ...(registrationNumber ? { registrationNumber } : {}),
      verificationStatus: parsed.verificationStatus,
      documents,
      authorizedUsers,
      trustLevel,
      updatedAt: reviewedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    };
    this.organizationsById.set(updated.id, updated);
    return updated;
  }

  grantMembership(organizationId: string, input: unknown, actorId: string) {
    const organization = this.getOrganization(organizationId);
    const parsed = membershipSchema.parse(input);
    assertSafePartnerText([parsed.actorId, parsed.conflictDisclosure]);
    const grantedAt = parsed.grantedAt ?? new Date(0).toISOString();
    const membershipId = `cp_member_${hashJson({ organizationId, actorId: parsed.actorId, role: parsed.role, grantedAt }).slice(0, 24)}`;
    const existing = [...this.membershipsById.values()].find(
      (membership) =>
        membership.organizationId === organizationId && membership.actorId === parsed.actorId && membership.role === parsed.role,
    );
    if (existing) {
      if (
        existing.id === membershipId &&
        existing.conflictDisclosure === parsed.conflictDisclosure &&
        existing.grantedBy === actorId &&
        existing.grantedAt === grantedAt
      ) {
        return existing;
      }
      throw new Error(`CanopyProof membership already exists for actor and role: ${parsed.actorId}/${parsed.role}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "DELEGATE",
      actor: actorId,
      entityType: "membership",
      entityId: membershipId,
      payload: {
        organizationId,
        actorId: parsed.actorId,
        role: parsed.role,
        conflictDisclosure: parsed.conflictDisclosure,
      },
      createdAt: grantedAt,
      rationale: "Organization-scoped CanopyProof membership granted through RBAC boundary.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof membership grant failed to append audit event.");
    }
    const membership: CanopyProofMembership = {
      id: membershipId,
      organizationId,
      actorId: parsed.actorId,
      role: parsed.role,
      status: "active",
      conflictDisclosure: parsed.conflictDisclosure,
      grantedBy: actorId,
      grantedAt,
      auditEvent,
    };
    this.membershipsById.set(membership.id, membership);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: grantedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return membership;
  }

  updateMembershipStatus(organizationId: string, membershipId: string, input: unknown, actorId: string) {
    const organization = this.getOrganization(organizationId);
    const membership = this.getMembership(membershipId);
    if (membership.organizationId !== organizationId) {
      throw new Error(`CanopyProof membership ${membershipId} does not belong to organization ${organizationId}.`);
    }
    const parsed = membershipStatusSchema.parse(input);
    const changedAt = parsed.changedAt ?? new Date(0).toISOString();
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.status === "active" ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "membership",
      entityId: membershipId,
      payload: {
        previousStatus: membership.status,
        status: parsed.status,
        rationale: parsed.rationale,
      },
      createdAt: changedAt,
      rationale: "Organization-scoped membership status changed with explicit rationale.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof membership update failed to append audit event.");
    }
    const updated: CanopyProofMembership = {
      ...membership,
      status: parsed.status,
      auditEvent,
    };
    this.membershipsById.set(updated.id, updated);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: changedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return updated;
  }

  recordAccreditation(organizationId: string, input: unknown, actorId: string) {
    const organization = this.getOrganization(organizationId);
    const parsed = accreditationSchema.parse(input);
    const decidedAt = parsed.decidedAt ?? new Date(0).toISOString();
    const accreditationId = `cp_accreditation_${hashJson({ organizationId, status: parsed.status, scope: parsed.scope, decidedAt }).slice(0, 24)}`;
    const existing = this.accreditationsById.get(accreditationId);
    if (existing) {
      if (
        existing.status === parsed.status &&
        existing.scope.join("\u0000") === [...parsed.scope].sort().join("\u0000") &&
        existing.decidedBy === actorId &&
        existing.decidedAt === decidedAt &&
        existing.rationale === parsed.rationale &&
        existing.evidenceHash === parsed.evidenceHash.toLowerCase()
      ) {
        return existing;
      }
      throw new Error(`CanopyProof accreditation already exists with conflicting payload: ${accreditationId}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.status === "approved" ? "FULFILL" : "CHALLENGE",
      actor: actorId,
      entityType: "accreditation",
      entityId: accreditationId,
      payload: {
        organizationId,
        status: parsed.status,
        scope: parsed.scope,
        evidenceHash: parsed.evidenceHash.toLowerCase(),
      },
      createdAt: decidedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof accreditation failed to append audit event.");
    }
    const accreditation: CanopyProofAccreditation = {
      id: accreditationId,
      organizationId,
      status: parsed.status,
      scope: [...parsed.scope].sort(),
      decidedBy: actorId,
      decidedAt,
      rationale: parsed.rationale,
      evidenceHash: parsed.evidenceHash.toLowerCase(),
      auditEvent,
    };
    this.accreditationsById.set(accreditation.id, accreditation);
    this.organizationsById.set(organization.id, {
      ...organization,
      accreditationStatus: parsed.status,
      trustLevel: parsed.status === "approved" && organization.trustLevel === "unverified" ? "basic" : organization.trustLevel,
      updatedAt: decidedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return accreditation;
  }

  createDataSharingAgreement(organizationId: string, input: unknown, actorId: string) {
    const organization = this.getOrganization(organizationId);
    const parsed = agreementSchema.parse(input);
    assertSafePartnerText([...parsed.datasetScopes, ...parsed.permittedUses]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const agreementSeed = {
      organizationId,
      datasetScopes: [...parsed.datasetScopes].sort(),
      privacyTier: parsed.privacyTier,
      permittedUses: [...parsed.permittedUses].sort(),
      expiresAt: parsed.expiresAt ?? null,
      createdBy: actorId,
      createdAt,
    };
    const agreementHash = hashJson({ kind: "canopyproof-data-sharing-agreement-v1", ...agreementSeed });
    const agreementId = `cp_agreement_${agreementHash.slice(0, 24)}`;
    const existing = this.agreementsById.get(agreementId);
    if (existing) {
      if (
        existing.organizationId === organizationId &&
        existing.agreementHash === agreementHash &&
        existing.datasetScopes.join("\u0000") === agreementSeed.datasetScopes.join("\u0000") &&
        existing.privacyTier === agreementSeed.privacyTier &&
        existing.permittedUses.join("\u0000") === agreementSeed.permittedUses.join("\u0000") &&
        (existing.expiresAt ?? null) === agreementSeed.expiresAt &&
        existing.createdBy === actorId &&
        existing.createdAt === createdAt
      ) {
        return existing;
      }
      throw new Error(`CanopyProof data-sharing agreement already exists with conflicting content: ${agreementId}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "DELEGATE",
      actor: actorId,
      entityType: "data_sharing_agreement",
      entityId: agreementId,
      payload: agreementSeed,
      createdAt,
      rationale: "CanopyProof data-sharing agreement created with explicit dataset scope, privacy tier, and permitted uses.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data-sharing agreement failed to append audit event.");
    }
    const agreement: CanopyProofDataSharingAgreement = {
      id: agreementId,
      organizationId,
      datasetScopes: agreementSeed.datasetScopes,
      privacyTier: parsed.privacyTier,
      permittedUses: agreementSeed.permittedUses,
      revoked: false,
      superseded: false,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      createdBy: actorId,
      createdAt,
      agreementHash,
      auditEvent,
    };
    this.agreementsById.set(agreement.id, agreement);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: createdAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return agreement;
  }

  revokeDataSharingAgreement(agreementId: string, input: unknown, actorId: string) {
    const agreement = this.getDataSharingAgreement(agreementId);
    const organization = this.getOrganization(agreement.organizationId);
    const parsed = agreementRevocationSchema.parse(input);
    const revokedAt = parsed.revokedAt ?? new Date(0).toISOString();
    const evidenceEventRoots = normalizeHashes(parsed.evidenceEventRoots);
    assertSafePartnerText([parsed.rationale]);
    assertNoRawDataAccessMaterial([parsed.rationale]);
    assertDataSharingAgreementRevocable({ agreement, revokedAt });
    const safety = dataSharingAgreementRevocationSafetyBoundary();
    const revocationSeed = {
      organizationId: organization.id,
      agreementId: agreement.id,
      agreementHash: agreement.agreementHash,
      rationale: parsed.rationale,
      evidenceEventRoots,
      revokedBy: actorId,
      revokedAt,
      safety,
    };
    const revocationHash = hashJson({ kind: "canopyproof-data-sharing-agreement-revocation-v1", ...revocationSeed });
    const revocationRoot = hashJson({
      kind: "canopyproof-data-sharing-agreement-revocation-root-v1",
      revocationHash,
      agreementHash: agreement.agreementHash,
      evidenceEventRoots,
    });
    const revocationId = `cp_agreement_revocation_${revocationHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "CHALLENGE",
      actor: actorId,
      entityType: "data_sharing_agreement_revocation",
      entityId: revocationId,
      payload: {
        ...revocationSeed,
        revocationHash,
        revocationRoot,
      },
      createdAt: revokedAt,
      rationale: "CanopyProof data-sharing agreement revoked through a separate append-only governance record that blocks future access.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data-sharing agreement revocation failed to append audit event.");
    }
    const revocation: CanopyProofDataSharingAgreementRevocation = {
      id: revocationId,
      organizationId: organization.id,
      agreementId: agreement.id,
      rationale: parsed.rationale,
      evidenceEventRoots,
      revokedBy: actorId,
      revokedAt,
      revocationHash,
      revocationRoot,
      safety,
      auditEvent,
    };
    this.agreementRevocationsById.set(revocation.id, revocation);
    this.agreementsById.set(agreement.id, { ...agreement, revoked: true });
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: revokedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return revocation;
  }

  supersedeDataSharingAgreement(agreementId: string, input: unknown, actorId: string) {
    const predecessor = this.getDataSharingAgreement(agreementId);
    const organization = this.getOrganization(predecessor.organizationId);
    const parsed = agreementSupersessionSchema.parse(input);
    const supersededAt = parsed.supersededAt ?? new Date(0).toISOString();
    const datasetScopes = normalizePartnerTextList(parsed.successor.datasetScopes);
    const permittedUses = normalizePartnerTextList(parsed.successor.permittedUses);
    const evidenceEventRoots = normalizeHashes(parsed.evidenceEventRoots);
    assertSafePartnerText([...datasetScopes, ...permittedUses, parsed.rationale]);
    assertNoRawDataAccessMaterial([...datasetScopes, ...permittedUses, parsed.rationale]);
    assertDataSharingAgreementSupersedable({
      predecessor,
      transitionType: parsed.transitionType,
      successorDatasetScopes: datasetScopes,
      successorPermittedUses: permittedUses,
      successorPrivacyTier: parsed.successor.privacyTier,
      ...(parsed.successor.expiresAt ? { successorExpiresAt: parsed.successor.expiresAt } : {}),
      supersededAt,
      alreadySuperseded: this.listDataSharingAgreementSupersessions(predecessor.id).some(
        (supersession) => supersession.predecessorAgreementId === predecessor.id,
      ),
    });
    const safety = dataSharingAgreementSupersessionSafetyBoundary();
    const successorSeed = {
      organizationId: organization.id,
      datasetScopes,
      privacyTier: parsed.successor.privacyTier,
      permittedUses,
      expiresAt: parsed.successor.expiresAt ?? null,
      createdBy: actorId,
      createdAt: supersededAt,
    };
    const successorAgreementHash = hashJson({ kind: "canopyproof-data-sharing-agreement-v1", ...successorSeed });
    const successorAgreementId = `cp_agreement_${successorAgreementHash.slice(0, 24)}`;
    if (successorAgreementId === predecessor.id || this.agreementsById.has(successorAgreementId)) {
      throw new Error(`CanopyProof successor data-sharing agreement already exists: ${successorAgreementId}`);
    }
    const successorAuditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "DELEGATE",
      actor: actorId,
      entityType: "data_sharing_agreement",
      entityId: successorAgreementId,
      payload: {
        ...successorSeed,
        supersedesAgreementId: predecessor.id,
        predecessorAgreementHash: predecessor.agreementHash,
      },
      createdAt: supersededAt,
      rationale: "CanopyProof successor data-sharing agreement created as a constrained, versioned continuation of an immutable predecessor.",
    }).at(-1);
    if (!successorAuditEvent) {
      throw new Error("CanopyProof successor data-sharing agreement failed to append audit event.");
    }
    const supersessionSeed = {
      organizationId: organization.id,
      predecessorAgreementId: predecessor.id,
      predecessorAgreementHash: predecessor.agreementHash,
      successorAgreementId,
      successorAgreementHash,
      transitionType: parsed.transitionType,
      rationale: parsed.rationale,
      evidenceEventRoots,
      supersededBy: actorId,
      supersededAt,
      safety,
    };
    const supersessionHash = hashJson({ kind: "canopyproof-data-sharing-agreement-supersession-v1", ...supersessionSeed });
    const supersessionRoot = hashJson({
      kind: "canopyproof-data-sharing-agreement-supersession-root-v1",
      supersessionHash,
      predecessorAgreementHash: predecessor.agreementHash,
      successorAgreementHash,
      evidenceEventRoots,
    });
    const supersessionId = `cp_agreement_supersession_${supersessionHash.slice(0, 24)}`;
    const supersessionAuditEvent = appendCanopyProofAuditEvent([...organization.auditHistory, successorAuditEvent], {
      action: "FULFILL",
      actor: actorId,
      entityType: "data_sharing_agreement_supersession",
      entityId: supersessionId,
      payload: {
        ...supersessionSeed,
        supersessionHash,
        supersessionRoot,
      },
      createdAt: supersededAt,
      rationale:
        "CanopyProof data-sharing agreement supersession recorded as append-only lineage; the predecessor can no longer authorize future access or delivery.",
    }).at(-1);
    if (!supersessionAuditEvent) {
      throw new Error("CanopyProof data-sharing agreement supersession failed to append audit event.");
    }
    const successor: CanopyProofDataSharingAgreement = {
      id: successorAgreementId,
      organizationId: organization.id,
      datasetScopes,
      privacyTier: parsed.successor.privacyTier,
      permittedUses,
      revoked: false,
      superseded: false,
      supersedesAgreementId: predecessor.id,
      ...(parsed.successor.expiresAt ? { expiresAt: parsed.successor.expiresAt } : {}),
      createdBy: actorId,
      createdAt: supersededAt,
      agreementHash: successorAgreementHash,
      auditEvent: successorAuditEvent,
    };
    const supersession: CanopyProofDataSharingAgreementSupersession = {
      id: supersessionId,
      organizationId: organization.id,
      predecessorAgreementId: predecessor.id,
      predecessorAgreementHash: predecessor.agreementHash,
      successorAgreementId: successor.id,
      successorAgreementHash: successor.agreementHash,
      transitionType: parsed.transitionType,
      rationale: parsed.rationale,
      evidenceEventRoots,
      supersededBy: actorId,
      supersededAt,
      supersessionHash,
      supersessionRoot,
      safety,
      auditEvent: supersessionAuditEvent,
    };
    this.agreementsById.set(predecessor.id, {
      ...predecessor,
      superseded: true,
      supersededByAgreementId: successor.id,
    });
    this.agreementsById.set(successor.id, successor);
    this.agreementSupersessionsById.set(supersession.id, supersession);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: supersededAt,
      auditHistory: [...organization.auditHistory, successorAuditEvent, supersessionAuditEvent],
    });
    return supersession;
  }

  requestDataAccess(organizationId: string, input: unknown, actorId: string) {
    const organization = this.getOrganization(organizationId);
    const parsed = dataAccessRequestSchema.parse(input);
    const agreement = this.getDataSharingAgreement(parsed.agreementId);
    const datasetScopes = normalizePartnerTextList(parsed.datasetScopes);
    const permittedUses = normalizePartnerTextList(parsed.permittedUses);
    assertSafePartnerText([...datasetScopes, ...permittedUses, parsed.purpose]);
    assertNoRawDataAccessMaterial([...datasetScopes, ...permittedUses, parsed.purpose]);
    const requestedAt = parsed.requestedAt ?? new Date(0).toISOString();
    assertDataAccessEligible({
      organization,
      agreement,
      datasetScopes,
      permittedUses,
      privacyTier: parsed.privacyTier,
      requestedAt,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
    });
    const safety = dataAccessSafetyBoundary();
    const accessSeed = {
      organizationId,
      agreementId: agreement.id,
      datasetScopes,
      permittedUses,
      privacyTier: parsed.privacyTier,
      purpose: parsed.purpose,
      requestedBy: actorId,
      requestedAt,
      expiresAt: parsed.expiresAt ?? null,
      safety,
    };
    const requestHash = hashJson({ kind: "canopyproof-data-access-request-v1", ...accessSeed });
    const requestId = `cp_data_access_${requestHash.slice(0, 24)}`;
    const accessRoot = hashJson({
      kind: "canopyproof-data-access-root-v1",
      requestHash,
      agreementHash: agreement.agreementHash,
      organizationTrustLevel: organization.trustLevel,
      organizationVerificationStatus: organization.verificationStatus,
    });
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "ASSERT",
      actor: actorId,
      entityType: "data_access_request",
      entityId: requestId,
      payload: {
        ...accessSeed,
        requestHash,
        accessRoot,
      },
      createdAt: requestedAt,
      rationale: "CanopyProof governed data access requested within a bounded data-sharing agreement and privacy policy.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access request failed to append audit event.");
    }
    const request: CanopyProofDataAccessRequest = {
      id: requestId,
      organizationId,
      agreementId: agreement.id,
      datasetScopes,
      permittedUses,
      privacyTier: parsed.privacyTier,
      purpose: parsed.purpose,
      status: "pending",
      requestedBy: actorId,
      requestedAt,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      requestHash,
      accessRoot,
      safety,
      auditEvent,
    };
    this.dataAccessRequestsById.set(request.id, request);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: requestedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return request;
  }

  decideDataAccessRequest(requestId: string, input: unknown, actorId: string) {
    const request = this.getDataAccessRequest(requestId);
    const organization = this.getOrganization(request.organizationId);
    const parsed = dataAccessDecisionSchema.parse(input);
    assertSafePartnerText([parsed.rationale]);
    assertNoRawDataAccessMaterial([parsed.rationale]);
    assertDataAccessDecisionTransition(request.status, parsed.status);
    if (request.requestedBy === actorId) {
      throw new Error("CanopyProof data access requests require an independent human decision actor.");
    }
    const decidedAt = parsed.decidedAt ?? new Date(0).toISOString();
    assertDataAccessDecisionTiming({
      request,
      agreement: this.getDataSharingAgreement(request.agreementId),
      status: parsed.status,
      decidedAt,
    });
    const decisionMaterial = createDataAccessRequestDecisionMaterial(
      request,
      parsed.status,
      parsed.rationale,
      actorId,
      decidedAt,
    );
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.status === "approved" ? "FULFILL" : "CHALLENGE",
      actor: actorId,
      entityType: "data_access_request_decision",
      entityId: decisionMaterial.id,
      payload: {
        ...decisionMaterial.seed,
        decisionHash: decisionMaterial.decisionHash,
        decisionRoot: decisionMaterial.decisionRoot,
      },
      createdAt: decidedAt,
      rationale: "Human-in-the-loop CanopyProof data access decision recorded without granting proof authority or financial claims.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access decision failed to append audit event.");
    }
    const decision: CanopyProofDataAccessRequestDecision = {
      id: decisionMaterial.id,
      organizationId: request.organizationId,
      requestId: request.id,
      agreementId: request.agreementId,
      previousStatus: request.status,
      status: parsed.status,
      decisionBy: actorId,
      decidedAt,
      rationale: parsed.rationale,
      decisionHash: decisionMaterial.decisionHash,
      decisionRoot: decisionMaterial.decisionRoot,
      safety: decisionMaterial.safety,
      auditEvent,
    };
    const updated = applyDataAccessRequestDecision(request, decision);
    this.dataAccessRequestDecisionsById.set(decision.id, decision);
    this.dataAccessRequestsById.set(updated.id, updated);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: decidedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return updated;
  }

  recordDataAccessDelivery(requestId: string, input: unknown, actorId: string) {
    const request = this.getDataAccessRequest(requestId);
    const organization = this.getOrganization(request.organizationId);
    const parsed = dataAccessDeliverySchema.parse(input);
    const deliveredAt = parsed.deliveredAt ?? new Date(0).toISOString();
    assertSafePartnerText([parsed.manifestId, parsed.manifestRequesterOrganizationId, parsed.recipientActorId, parsed.purpose]);
    assertNoRawDataAccessMaterial([parsed.manifestId, parsed.manifestRequesterOrganizationId, parsed.recipientActorId, parsed.purpose]);
    const safety = dataAccessDeliverySafetyBoundary();
    const deliverySeed = {
      organizationId: organization.id,
      requestId: request.id,
      agreementId: request.agreementId,
      manifestId: parsed.manifestId,
      manifestRequesterOrganizationId: parsed.manifestRequesterOrganizationId,
      manifestHash: normalizeHash(parsed.manifestHash),
      manifestEntryRoot: normalizeHash(parsed.manifestEntryRoot),
      manifestClassification: parsed.manifestClassification,
      channel: parsed.channel,
      recipientActorId: parsed.recipientActorId,
      deliveredBy: actorId,
      deliveredAt,
      purpose: parsed.purpose,
      accessRoot: request.accessRoot,
      safety,
    };
    const receiptHash = hashJson({ kind: "canopyproof-data-access-delivery-receipt-v1", ...deliverySeed });
    const deliveryRoot = hashJson({
      kind: "canopyproof-data-access-delivery-root-v1",
      receiptHash,
      requestHash: request.requestHash,
      accessRoot: request.accessRoot,
      manifestHash: deliverySeed.manifestHash,
      manifestEntryRoot: deliverySeed.manifestEntryRoot,
    });
    const deliveryId = `cp_data_delivery_${receiptHash.slice(0, 24)}`;
    const existing = this.dataAccessDeliveryReceiptsById.get(deliveryId);
    if (existing) {
      if (existing.receiptHash === receiptHash && existing.deliveryRoot === deliveryRoot) return existing;
      throw new Error(`CanopyProof data access delivery already exists with conflicting payload: ${deliveryId}`);
    }
    assertDataAccessDeliveryEligible({
      request,
      agreement: this.getDataSharingAgreement(request.agreementId),
      organizationId: organization.id,
      manifestRequesterOrganizationId: parsed.manifestRequesterOrganizationId,
      manifestClassification: parsed.manifestClassification,
      deliveredAt,
    });
    this.assertDataAccessRequestNotRestricted(request.id);
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "FULFILL",
      actor: actorId,
      entityType: "data_access_delivery_receipt",
      entityId: deliveryId,
      payload: {
        ...deliverySeed,
        receiptHash,
        deliveryRoot,
      },
      createdAt: deliveredAt,
      rationale: "CanopyProof approved data access delivered as a hash-only manifest receipt with redaction and claim boundaries.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access delivery receipt failed to append audit event.");
    }
    const receipt: CanopyProofDataAccessDeliveryReceipt = {
      id: deliveryId,
      ...deliverySeed,
      receiptHash,
      deliveryRoot,
      auditEvent,
    };
    this.dataAccessDeliveryReceiptsById.set(receipt.id, receipt);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: deliveredAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return receipt;
  }

  recordDataUseAttestation(deliveryId: string, input: unknown, actorId: string) {
    const delivery = this.getDataAccessDeliveryReceipt(deliveryId);
    const request = this.getDataAccessRequest(delivery.requestId);
    const organization = this.getOrganization(delivery.organizationId);
    const parsed = dataUseAttestationSchema.parse(input);
    const outputHashes = normalizeHashes(parsed.outputHashes);
    const evidenceEventRoots = normalizeHashes(parsed.evidenceEventRoots);
    const limitations = normalizePartnerTextList(parsed.limitations);
    const attestedAt = parsed.attestedAt ?? new Date(0).toISOString();
    assertSafePartnerText([parsed.useCase, ...limitations]);
    assertNoRawDataAccessMaterial([parsed.useCase, ...limitations]);
    assertDataUseAttestationEvidence({ usageState: parsed.usageState, outputHashes, evidenceEventRoots });
    const safety = dataUseAttestationSafetyBoundary();
    const usageSeed = {
      organizationId: organization.id,
      requestId: request.id,
      deliveryId: delivery.id,
      manifestId: delivery.manifestId,
      usageState: parsed.usageState,
      useCase: parsed.useCase,
      outputHashes,
      evidenceEventRoots,
      limitations,
      attestedBy: actorId,
      attestedAt,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      safety,
    };
    const attestationHash = hashJson({ kind: "canopyproof-data-use-attestation-v1", ...usageSeed });
    const usageRoot = hashJson({
      kind: "canopyproof-data-use-root-v1",
      attestationHash,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      outputHashes,
      evidenceEventRoots,
    });
    const attestationId = `cp_data_use_${attestationHash.slice(0, 24)}`;
    const existing = this.dataUseAttestationsById.get(attestationId);
    if (existing) {
      if (existing.attestationHash === attestationHash && existing.usageRoot === usageRoot) return existing;
      throw new Error(`CanopyProof data-use attestation already exists with conflicting payload: ${attestationId}`);
    }
    assertDataUseAttestationEligible({
      delivery,
      request,
      agreement: this.getDataSharingAgreement(request.agreementId),
      usageState: parsed.usageState,
      actorId,
      attestedAt,
    });
    if (parsed.usageState === "within_scope") this.assertDataAccessRequestNotRestricted(request.id);
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.usageState === "within_scope" || parsed.usageState === "no_use" ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "data_use_attestation",
      entityId: attestationId,
      payload: {
        ...usageSeed,
        attestationHash,
        usageRoot,
      },
      createdAt: attestedAt,
      rationale: "CanopyProof data-use attestation recorded against a hash-only delivery receipt and approved access root.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data-use attestation failed to append audit event.");
    }
    const attestation: CanopyProofDataUseAttestation = {
      id: attestationId,
      organizationId: organization.id,
      requestId: request.id,
      deliveryId: delivery.id,
      manifestId: delivery.manifestId,
      usageState: parsed.usageState,
      useCase: parsed.useCase,
      outputHashes,
      evidenceEventRoots,
      limitations,
      attestedBy: actorId,
      attestedAt,
      attestationHash,
      usageRoot,
      safety,
      auditEvent,
    };
    this.dataUseAttestationsById.set(attestation.id, attestation);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: attestedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return attestation;
  }

  recordDataUseEnforcementCase(attestationId: string, input: unknown, actorId: string) {
    const attestation = this.getDataUseAttestation(attestationId);
    const delivery = this.getDataAccessDeliveryReceipt(attestation.deliveryId);
    const request = this.getDataAccessRequest(attestation.requestId);
    const organization = this.getOrganization(attestation.organizationId);
    const parsed = dataUseEnforcementCaseSchema.parse(input);
    const reviewedAt = parsed.reviewedAt ?? new Date(0).toISOString();
    const evidenceEventRoots = normalizeHashes([...attestation.evidenceEventRoots, ...parsed.evidenceEventRoots]);
    assertSafePartnerText([parsed.rationale]);
    assertNoRawDataAccessMaterial([parsed.rationale]);
    assertDataUseEnforcementAction({ caseState: parsed.caseState, enforcementAction: parsed.enforcementAction });
    const safety = dataUseEnforcementSafetyBoundary();
    const enforcementSeed = {
      organizationId: organization.id,
      requestId: request.id,
      deliveryId: delivery.id,
      attestationId: attestation.id,
      manifestId: delivery.manifestId,
      caseState: parsed.caseState,
      enforcementAction: parsed.enforcementAction,
      rationale: parsed.rationale,
      evidenceEventRoots,
      reviewerId: actorId,
      reviewedAt,
      usageRoot: attestation.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: request.accessRoot,
      safety,
    };
    const enforcementHash = hashJson({ kind: "canopyproof-data-use-enforcement-case-v1", ...enforcementSeed });
    const enforcementRoot = hashJson({
      kind: "canopyproof-data-use-enforcement-root-v1",
      enforcementHash,
      usageRoot: attestation.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: request.accessRoot,
      evidenceEventRoots,
    });
    const enforcementCaseId = `cp_data_use_enforcement_${enforcementHash.slice(0, 24)}`;
    const existing = this.dataUseEnforcementCasesById.get(enforcementCaseId);
    if (existing) {
      if (existing.enforcementHash === enforcementHash && existing.enforcementRoot === enforcementRoot) return existing;
      throw new Error(`CanopyProof data-use enforcement case already exists with conflicting payload: ${enforcementCaseId}`);
    }
    assertDataUseEnforcementEligible({
      attestation,
      delivery,
      request,
      actorId,
      reviewedAt,
      evidenceEventRoots,
    });
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.caseState === "resolved" || parsed.caseState === "rejected" ? "FULFILL" : "CHALLENGE",
      actor: actorId,
      entityType: "data_use_enforcement_case",
      entityId: enforcementCaseId,
      payload: {
        ...enforcementSeed,
        enforcementHash,
        enforcementRoot,
      },
      createdAt: reviewedAt,
      rationale: "CanopyProof data-use enforcement case recorded by an independent human reviewer without mutating historical delivery records.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data-use enforcement case failed to append audit event.");
    }
    const enforcementCase: CanopyProofDataUseEnforcementCase = {
      id: enforcementCaseId,
      organizationId: organization.id,
      requestId: request.id,
      deliveryId: delivery.id,
      attestationId: attestation.id,
      manifestId: delivery.manifestId,
      caseState: parsed.caseState,
      enforcementAction: parsed.enforcementAction,
      rationale: parsed.rationale,
      evidenceEventRoots,
      reviewerId: actorId,
      reviewedAt,
      enforcementHash,
      enforcementRoot,
      safety,
      auditEvent,
    };
    this.dataUseEnforcementCasesById.set(enforcementCase.id, enforcementCase);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: reviewedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return enforcementCase;
  }

  recordDataAccessRestriction(enforcementCaseId: string, input: unknown, actorId: string) {
    const enforcementCase = this.getDataUseEnforcementCase(enforcementCaseId);
    const attestation = this.getDataUseAttestation(enforcementCase.attestationId);
    const delivery = this.getDataAccessDeliveryReceipt(enforcementCase.deliveryId);
    const request = this.getDataAccessRequest(enforcementCase.requestId);
    const organization = this.getOrganization(enforcementCase.organizationId);
    const parsed = dataAccessRestrictionSchema.parse(input);
    const decidedAt = parsed.decidedAt ?? new Date(0).toISOString();
    const evidenceEventRoots = normalizeHashes([...enforcementCase.evidenceEventRoots, ...parsed.evidenceEventRoots]);
    assertSafePartnerText([parsed.rationale]);
    assertNoRawDataAccessMaterial([parsed.rationale]);
    const currentRestriction = this.getCurrentDataAccessRestriction(request.id);
    assertDataAccessRestrictionEligible({
      enforcementCase,
      attestation,
      delivery,
      request,
      restrictionState: parsed.restrictionState,
      actorId,
      decidedAt,
      evidenceEventRoots,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      ...(currentRestriction ? { currentRestriction } : {}),
    });
    const safety = dataAccessRestrictionSafetyBoundary();
    const restrictionSeed = {
      organizationId: organization.id,
      requestId: request.id,
      enforcementCaseId: enforcementCase.id,
      attestationId: attestation.id,
      deliveryId: delivery.id,
      previousRestrictionId: currentRestriction?.id ?? null,
      previousRestrictionRoot: currentRestriction?.restrictionRoot ?? null,
      previousRestrictionState: currentRestriction?.restrictionState ?? null,
      restrictionState: parsed.restrictionState,
      rationale: parsed.rationale,
      evidenceEventRoots,
      decidedBy: actorId,
      decidedAt,
      expiresAt: parsed.expiresAt ?? null,
      enforcementRoot: enforcementCase.enforcementRoot,
      usageRoot: attestation.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: request.accessRoot,
      safety,
    };
    const restrictionHash = hashJson({ kind: "canopyproof-data-access-restriction-v1", ...restrictionSeed });
    const restrictionRoot = hashJson({
      kind: "canopyproof-data-access-restriction-root-v1",
      restrictionHash,
      enforcementRoot: enforcementCase.enforcementRoot,
      usageRoot: attestation.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: request.accessRoot,
      evidenceEventRoots,
      previousRestrictionRoot: currentRestriction?.restrictionRoot ?? null,
    });
    const restrictionId = `cp_data_access_restriction_${restrictionHash.slice(0, 24)}`;
    const existing = this.dataAccessRestrictionsById.get(restrictionId);
    if (existing) {
      if (existing.restrictionHash === restrictionHash && existing.restrictionRoot === restrictionRoot) return existing;
      throw new Error(`CanopyProof data access restriction already exists with conflicting payload: ${restrictionId}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.restrictionState === "restored" ? "FULFILL" : "CHALLENGE",
      actor: actorId,
      entityType: "data_access_restriction",
      entityId: restrictionId,
      payload: {
        ...restrictionSeed,
        restrictionHash,
        restrictionRoot,
      },
      createdAt: decidedAt,
      rationale: "CanopyProof partner data access restriction recorded through a separate approval path bound to an enforcement case.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access restriction failed to append audit event.");
    }
    const restriction: CanopyProofDataAccessRestriction = {
      id: restrictionId,
      organizationId: organization.id,
      requestId: request.id,
      enforcementCaseId: enforcementCase.id,
      attestationId: attestation.id,
      deliveryId: delivery.id,
      ...(currentRestriction
        ? {
            previousRestrictionId: currentRestriction.id,
            previousRestrictionRoot: currentRestriction.restrictionRoot,
            previousRestrictionState: currentRestriction.restrictionState,
          }
        : {}),
      restrictionState: parsed.restrictionState,
      rationale: parsed.rationale,
      evidenceEventRoots,
      decidedBy: actorId,
      decidedAt,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      restrictionHash,
      restrictionRoot,
      safety,
      auditEvent,
    };
    this.dataAccessRestrictionsById.set(restriction.id, restriction);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: decidedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return restriction;
  }

  createDataAccessAccountabilityPacket(requestId: string, input: unknown, actorId: string) {
    const request = this.getDataAccessRequest(requestId);
    const organization = this.getOrganization(request.organizationId);
    const parsed = dataAccessAccountabilityPacketSchema.parse(input);
    const generatedAt = parsed.generatedAt ?? new Date(0).toISOString();
    assertSafePartnerText([parsed.intendedAudience]);
    assertNoRawDataAccessMaterial([parsed.intendedAudience]);
    const safety = dataAccessAccountabilityPacketSafetyBoundary();
    const snapshot = this.buildDataAccessAccountabilitySnapshot(request);
    assertDataAccessAccountabilitySnapshotBounded(snapshot);
    const packetSeed = {
      organizationId: organization.id,
      requestId: request.id,
      agreementId: request.agreementId,
      generatedBy: actorId,
      generatedAt,
      intendedAudience: parsed.intendedAudience,
      requestStatus: request.status,
      requestHash: request.requestHash,
      counts: snapshot.counts,
      lineageRoots: snapshot.lineageRoots,
      safety,
    };
    const packetHash = hashJson({ kind: "canopyproof-data-access-accountability-packet-v1", ...packetSeed });
    const packetRoot = hashJson({
      kind: "canopyproof-data-access-accountability-root-v1",
      packetHash,
      accessRoot: request.accessRoot,
      lineageRoots: snapshot.lineageRoots,
      counts: snapshot.counts,
    });
    const packetId = `cp_data_access_packet_${packetHash.slice(0, 24)}`;
    const existing = this.dataAccessAccountabilityPacketsById.get(packetId);
    if (existing) {
      if (existing.packetHash === packetHash) return existing;
      throw new Error(`CanopyProof data access accountability packet already exists with conflicting payload: ${packetId}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "ASSERT",
      actor: actorId,
      entityType: "data_access_accountability_packet",
      entityId: packetId,
      payload: {
        ...packetSeed,
        packetHash,
        packetRoot,
      },
      createdAt: generatedAt,
      rationale: "CanopyProof data access accountability packet generated from append-only hash lineage for institutional review.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access accountability packet failed to append audit event.");
    }
    const packet: CanopyProofDataAccessAccountabilityPacket = {
      id: packetId,
      organizationId: organization.id,
      requestId: request.id,
      agreementId: request.agreementId,
      generatedBy: actorId,
      generatedAt,
      intendedAudience: parsed.intendedAudience,
      requestStatus: request.status,
      counts: snapshot.counts,
      lineageRoots: snapshot.lineageRoots,
      packetHash,
      packetRoot,
      safety,
      auditEvent,
    };
    this.dataAccessAccountabilityPacketsById.set(packet.id, packet);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: generatedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return packet;
  }

  verifyDataAccessAccountabilityPacket(packetId: string, input: unknown, actorId: string) {
    const packet = this.getDataAccessAccountabilityPacket(packetId);
    const organization = this.getOrganization(packet.organizationId);
    const request = this.getDataAccessRequest(packet.requestId);
    const parsed = dataAccessAccountabilityVerificationSchema.parse(input);
    const verifiedAt = parsed.verifiedAt ?? new Date(0).toISOString();
    if (actorId === packet.generatedBy) {
      throw new Error("CanopyProof accountability replay verification requires an actor independent from the packet generator.");
    }
    if (Date.parse(verifiedAt) < Date.parse(packet.generatedAt)) {
      throw new Error("CanopyProof accountability replay verification cannot predate the packet.");
    }
    const safety = dataAccessAccountabilityVerificationSafetyBoundary();
    const replay = this.replayDataAccessAccountabilityPacket(packet, request);
    const issues: CanopyProofDataAccessAccountabilityIssueCode[] = [...replay.issues];
    const expectedPacketRoot = parsed.expectedPacketRoot?.toLowerCase() ?? null;
    if (expectedPacketRoot && expectedPacketRoot !== packet.packetRoot) issues.push("expected_root_mismatch");
    const uniqueIssues = [...new Set(issues)].sort();
    const verificationSeed = {
      organizationId: packet.organizationId,
      packetId: packet.id,
      requestId: packet.requestId,
      valid: uniqueIssues.length === 0,
      issues: uniqueIssues,
      expectedPacketRoot,
      packetHash: packet.packetHash,
      recomputedPacketHash: replay.recomputedPacketHash,
      packetRoot: packet.packetRoot,
      recomputedPacketRoot: replay.recomputedPacketRoot,
      verifiedBy: actorId,
      verifiedAt,
      safety,
    };
    const verificationRoot = hashJson({ kind: "canopyproof-data-access-accountability-verification-v1", ...verificationSeed });
    const verificationId = `cp_data_access_packet_verification_${verificationRoot.slice(0, 24)}`;
    const existing = this.dataAccessAccountabilityVerificationsById.get(verificationId);
    if (existing) {
      if (existing.verificationRoot === verificationRoot) return existing;
      throw new Error(`CanopyProof accountability verification already exists with conflicting payload: ${verificationId}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: uniqueIssues.length === 0 ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "data_access_accountability_verification",
      entityId: verificationId,
      payload: {
        ...verificationSeed,
        verificationRoot,
      },
      createdAt: verifiedAt,
      rationale:
        uniqueIssues.length === 0
          ? "CanopyProof data access accountability packet replay verification passed."
          : "CanopyProof data access accountability packet replay verification found stale lineage or mismatched roots.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access accountability verification failed to append audit event.");
    }
    const verification: CanopyProofDataAccessAccountabilityVerification = {
      id: verificationId,
      packetId: packet.id,
      organizationId: packet.organizationId,
      requestId: packet.requestId,
      valid: uniqueIssues.length === 0,
      issues: uniqueIssues,
      ...(expectedPacketRoot ? { expectedPacketRoot } : {}),
      packetHash: packet.packetHash,
      recomputedPacketHash: replay.recomputedPacketHash,
      packetRoot: packet.packetRoot,
      recomputedPacketRoot: replay.recomputedPacketRoot,
      verifiedBy: actorId,
      verifiedAt,
      verificationRoot,
      safety,
      auditEvent,
    };
    this.dataAccessAccountabilityVerificationsById.set(verification.id, verification);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: verifiedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return verification;
  }

  publishDataAccessAccountabilityDisclosure(packetId: string, input: unknown, actorId: string) {
    const packet = this.getDataAccessAccountabilityPacket(packetId);
    const organization = this.getOrganization(packet.organizationId);
    const request = this.getDataAccessRequest(packet.requestId);
    const parsed = dataAccessAccountabilityDisclosureSchema.parse(input);
    const verification = this.getDataAccessAccountabilityVerification(parsed.verificationId);
    const publishedAt = parsed.publishedAt ?? new Date(0).toISOString();
    const existing = [...this.dataAccessAccountabilityDisclosuresById.values()].find(
      (disclosure) => disclosure.packetId === packet.id,
    );
    if (existing) {
      if (
        existing.verificationId === verification.id &&
        existing.publishedBy === actorId &&
        existing.publishedAt === publishedAt
      ) {
        return this.buildDataAccessAccountabilityDisclosureView(existing);
      }
      throw new Error(`CanopyProof data access accountability packet is already disclosed: ${packet.id}`);
    }
    const replay = this.replayDataAccessAccountabilityPacket(packet, request);
    assertDataAccessAccountabilityDisclosureEligible({
      packet,
      verification,
      replayIssues: replay.issues,
      publishedBy: actorId,
      publishedAt,
    });
    const safety = dataAccessAccountabilityDisclosureSafetyBoundary();
    const disclosureSeed = {
      organizationId: organization.id,
      packetId: packet.id,
      packetHash: packet.packetHash,
      packetRoot: packet.packetRoot,
      verificationId: verification.id,
      verificationRoot: verification.verificationRoot,
      policyId: "canopyproof_policy_partner_accountability_disclosure_v1" as const,
      publishedBy: actorId,
      publishedAt,
      safety,
    };
    const disclosureHash = hashJson({ kind: "canopyproof-data-access-accountability-disclosure-v1", ...disclosureSeed });
    const disclosureRoot = hashJson({
      kind: "canopyproof-data-access-accountability-disclosure-root-v1",
      disclosureHash,
      packetRoot: packet.packetRoot,
      verificationRoot: verification.verificationRoot,
    });
    const disclosureId = `cp_data_access_disclosure_${disclosureHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "FULFILL",
      actor: actorId,
      entityType: "data_access_accountability_disclosure",
      entityId: disclosureId,
      payload: {
        ...disclosureSeed,
        disclosureHash,
        disclosureRoot,
      },
      createdAt: publishedAt,
      rationale:
        "CanopyProof accountability packet hash lineage published after current independent replay verification and separation-of-duties review.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof data access accountability disclosure failed to append audit event.");
    }
    const disclosure: CanopyProofDataAccessAccountabilityDisclosure = {
      id: disclosureId,
      ...disclosureSeed,
      disclosureHash,
      disclosureRoot,
      auditEvent,
    };
    this.dataAccessAccountabilityDisclosuresById.set(disclosure.id, disclosure);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: publishedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return this.buildDataAccessAccountabilityDisclosureView(disclosure);
  }

  challengeDataAccessAccountabilityDisclosure(
    disclosureId: string,
    input: unknown,
    actorId: string,
    challengerRole: CanopyProofPartnerRole,
  ) {
    const disclosure = this.getDataAccessAccountabilityDisclosureRecord(disclosureId);
    const organization = this.getOrganization(disclosure.organizationId);
    const parsed = dataAccessAccountabilityDisclosureChallengeSchema.parse(input);
    const challengedAt = parsed.challengedAt ?? new Date(0).toISOString();
    const evidenceEventRoots = normalizeHashes(parsed.evidenceEventRoots);
    assertSafePartnerText([parsed.statement]);
    assertNoRawDataAccessMaterial([parsed.statement]);
    if (Date.parse(challengedAt) < Date.parse(disclosure.publishedAt)) {
      throw new Error("CanopyProof accountability disclosure challenge cannot predate publication.");
    }
    const existing = this.listDataAccessAccountabilityDisclosureChallenges(disclosure.id).find(
      (challenge) => challenge.challengedBy === actorId && challenge.reason === parsed.reason,
    );
    if (existing) {
      if (
        existing.statement === parsed.statement &&
        existing.challengerRole === challengerRole &&
        existing.challengedAt === challengedAt &&
        hashJson(existing.evidenceEventRoots) === hashJson(evidenceEventRoots)
      ) {
        return existing;
      }
      throw new Error("CanopyProof accountability disclosure already has this challenger and reason.");
    }
    const safety = dataAccessAccountabilityDisclosureChallengeSafetyBoundary();
    const challengeSeed = {
      organizationId: organization.id,
      disclosureId: disclosure.id,
      disclosureRoot: disclosure.disclosureRoot,
      reason: parsed.reason,
      statement: parsed.statement,
      evidenceEventRoots,
      challengedBy: actorId,
      challengerRole,
      challengedAt,
      safety,
    };
    const challengeHash = hashJson({ kind: "canopyproof-data-access-accountability-disclosure-challenge-v1", ...challengeSeed });
    const challengeRoot = hashJson({
      kind: "canopyproof-data-access-accountability-disclosure-challenge-root-v1",
      challengeHash,
      disclosureRoot: disclosure.disclosureRoot,
      evidenceEventRoots,
    });
    const challengeId = `cp_data_access_disclosure_challenge_${challengeHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "CHALLENGE",
      actor: actorId,
      entityType: "data_access_accountability_disclosure_challenge",
      entityId: challengeId,
      payload: { ...challengeSeed, challengeHash, challengeRoot },
      createdAt: challengedAt,
      rationale: "CanopyProof public accountability disclosure challenged with bounded evidence roots for independent human review.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof accountability disclosure challenge failed to append audit event.");
    }
    const challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge = {
      id: challengeId,
      ...challengeSeed,
      challengeHash,
      challengeRoot,
      auditEvent,
    };
    this.dataAccessAccountabilityDisclosureChallengesById.set(challenge.id, challenge);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: challengedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return challenge;
  }

  resolveDataAccessAccountabilityDisclosureChallenge(
    challengeId: string,
    input: unknown,
    actorId: string,
    reviewerRole: "owner" | "admin" | "verifier",
  ) {
    const challenge = this.getDataAccessAccountabilityDisclosureChallenge(challengeId);
    const disclosure = this.getDataAccessAccountabilityDisclosureRecord(challenge.disclosureId);
    const organization = this.getOrganization(challenge.organizationId);
    const parsed = dataAccessAccountabilityDisclosureResolutionSchema.parse(input);
    const reviewedAt = parsed.reviewedAt ?? new Date(0).toISOString();
    const evidenceEventRoots = normalizeHashes(parsed.evidenceEventRoots);
    assertSafePartnerText([parsed.rationale]);
    assertNoRawDataAccessMaterial([parsed.rationale]);
    const existing = this.listDataAccessAccountabilityDisclosureResolutions(challenge.id).find(
      (resolution) => resolution.reviewedBy === actorId && resolution.reviewedAt === reviewedAt,
    );
    if (existing) {
      if (
        existing.decision === parsed.decision &&
        existing.remedialAction === parsed.remedialAction &&
        existing.rationale === parsed.rationale &&
        existing.reviewerRole === reviewerRole &&
        hashJson(existing.evidenceEventRoots) === hashJson(evidenceEventRoots)
      ) {
        return existing;
      }
      throw new Error("CanopyProof accountability disclosure resolution actor and timestamp already identify another review.");
    }
    const previousResolution = this.listDataAccessAccountabilityDisclosureResolutions(challenge.id).at(-1);
    assertDataAccessAccountabilityDisclosureResolutionEligible({
      challenge,
      disclosure,
      ...(previousResolution ? { previousResolution } : {}),
      decision: parsed.decision,
      remedialAction: parsed.remedialAction,
      reviewedBy: actorId,
      reviewedAt,
    });
    const safety = dataAccessAccountabilityDisclosureResolutionSafetyBoundary();
    const resolutionSeed = {
      organizationId: organization.id,
      disclosureId: disclosure.id,
      challengeId: challenge.id,
      decision: parsed.decision,
      remedialAction: parsed.remedialAction,
      rationale: parsed.rationale,
      evidenceEventRoots,
      ...(previousResolution ? { previousResolutionId: previousResolution.id, previousResolutionRoot: previousResolution.resolutionRoot } : {}),
      reviewedBy: actorId,
      reviewerRole,
      reviewedAt,
      previousResolutionRoot: previousResolution?.resolutionRoot ?? null,
      safety,
    };
    const resolutionHash = hashJson({ kind: "canopyproof-data-access-accountability-disclosure-resolution-v1", ...resolutionSeed });
    const resolutionRoot = hashJson({
      kind: "canopyproof-data-access-accountability-disclosure-resolution-root-v1",
      resolutionHash,
      challengeRoot: challenge.challengeRoot,
      evidenceEventRoots,
      previousResolutionRoot: previousResolution?.resolutionRoot ?? null,
    });
    const resolutionId = `cp_data_access_disclosure_resolution_${resolutionHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: parsed.decision === "dismissed" ? "ASSERT" : parsed.decision === "upheld" ? "FULFILL" : "REASON",
      actor: actorId,
      entityType: "data_access_accountability_disclosure_resolution",
      entityId: resolutionId,
      payload: { ...resolutionSeed, resolutionHash, resolutionRoot },
      createdAt: reviewedAt,
      rationale: "CanopyProof disclosure challenge independently reviewed without deleting or rewriting the public record.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof accountability disclosure resolution failed to append audit event.");
    }
    const resolution: CanopyProofDataAccessAccountabilityDisclosureResolution = {
      id: resolutionId,
      organizationId: organization.id,
      disclosureId: disclosure.id,
      challengeId: challenge.id,
      decision: parsed.decision,
      remedialAction: parsed.remedialAction,
      rationale: parsed.rationale,
      evidenceEventRoots,
      ...(previousResolution ? { previousResolutionId: previousResolution.id, previousResolutionRoot: previousResolution.resolutionRoot } : {}),
      reviewedBy: actorId,
      reviewerRole,
      reviewedAt,
      resolutionHash,
      resolutionRoot,
      safety,
      auditEvent,
    };
    this.dataAccessAccountabilityDisclosureResolutionsById.set(resolution.id, resolution);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: reviewedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return resolution;
  }

  publishDataAccessAccountabilityDisclosureNotice(
    resolutionId: string,
    input: unknown,
    actorId: string,
    publisherRole: "owner" | "admin",
  ) {
    const resolution = this.getDataAccessAccountabilityDisclosureResolution(resolutionId);
    const challenge = this.getDataAccessAccountabilityDisclosureChallenge(resolution.challengeId);
    const disclosure = this.getDataAccessAccountabilityDisclosureRecord(resolution.disclosureId);
    const organization = this.getOrganization(resolution.organizationId);
    const parsed = dataAccessAccountabilityDisclosureNoticeSchema.parse(input);
    const publishedAt = parsed.publishedAt ?? new Date(0).toISOString();
    const evidenceEventRoots = normalizeHashes(parsed.evidenceEventRoots);
    assertSafePartnerText([parsed.statement]);
    assertNoRawDataAccessMaterial([parsed.statement]);
    const replacementDisclosure = parsed.replacementDisclosureId
      ? this.getDataAccessAccountabilityDisclosure(parsed.replacementDisclosureId)
      : undefined;
    const existing = this.listDataAccessAccountabilityDisclosureNotices(disclosure.id).find(
      (notice) => notice.resolutionId === resolution.id,
    );
    if (existing) {
      if (
        existing.noticeType === parsed.noticeType &&
        existing.replacementDisclosureId === replacementDisclosure?.id &&
        existing.statement === parsed.statement &&
        existing.publishedBy === actorId &&
        existing.publisherRole === publisherRole &&
        existing.publishedAt === publishedAt &&
        hashJson(existing.evidenceEventRoots) === hashJson(evidenceEventRoots)
      ) {
        return existing;
      }
      throw new Error("CanopyProof accountability disclosure resolution already has a different public notice.");
    }
    const latestResolution = this.listDataAccessAccountabilityDisclosureResolutions(challenge.id).at(-1);
    assertDataAccessAccountabilityDisclosureNoticeEligible({
      disclosure,
      challenge,
      resolution,
      ...(latestResolution ? { latestResolution } : {}),
      ...(replacementDisclosure ? { replacementDisclosure } : {}),
      noticeType: parsed.noticeType,
      publishedBy: actorId,
      publishedAt,
      noticeAlreadyExists: false,
    });
    const safety = dataAccessAccountabilityDisclosureNoticeSafetyBoundary();
    const noticeSeed = {
      organizationId: organization.id,
      disclosureId: disclosure.id,
      challengeId: challenge.id,
      resolutionId: resolution.id,
      resolutionRoot: resolution.resolutionRoot,
      noticeType: parsed.noticeType,
      replacementDisclosureId: replacementDisclosure?.id ?? null,
      replacementDisclosureRoot: replacementDisclosure?.disclosureRoot ?? null,
      statement: parsed.statement,
      evidenceEventRoots,
      publishedBy: actorId,
      publisherRole,
      publishedAt,
      safety,
    };
    const noticeHash = hashJson({ kind: "canopyproof-data-access-accountability-disclosure-notice-v1", ...noticeSeed });
    const noticeRoot = hashJson({
      kind: "canopyproof-data-access-accountability-disclosure-notice-root-v1",
      noticeHash,
      disclosureRoot: disclosure.disclosureRoot,
      resolutionRoot: resolution.resolutionRoot,
      replacementDisclosureRoot: replacementDisclosure?.disclosureRoot ?? null,
      evidenceEventRoots,
    });
    const noticeId = `cp_data_access_disclosure_notice_${noticeHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(organization.auditHistory, {
      action: "FULFILL",
      actor: actorId,
      entityType: "data_access_accountability_disclosure_notice",
      entityId: noticeId,
      payload: { ...noticeSeed, noticeHash, noticeRoot },
      createdAt: publishedAt,
      rationale:
        parsed.noticeType === "correction"
          ? "CanopyProof correction notice linked an immutable challenged disclosure to a replacement disclosure."
          : "CanopyProof withdrawal notice marked an immutable disclosure as withdrawn without deleting public history.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof accountability disclosure notice failed to append audit event.");
    }
    const notice: CanopyProofDataAccessAccountabilityDisclosureNotice = {
      id: noticeId,
      organizationId: organization.id,
      disclosureId: disclosure.id,
      challengeId: challenge.id,
      resolutionId: resolution.id,
      noticeType: parsed.noticeType,
      ...(replacementDisclosure ? { replacementDisclosureId: replacementDisclosure.id } : {}),
      statement: parsed.statement,
      evidenceEventRoots,
      publishedBy: actorId,
      publisherRole,
      publishedAt,
      noticeHash,
      noticeRoot,
      safety,
      auditEvent,
    };
    this.dataAccessAccountabilityDisclosureNoticesById.set(notice.id, notice);
    this.organizationsById.set(organization.id, {
      ...organization,
      updatedAt: publishedAt,
      auditHistory: [...organization.auditHistory, auditEvent],
    });
    return notice;
  }

  listMemberships(organizationId?: string) {
    const memberships = [...this.membershipsById.values()];
    return (organizationId ? memberships.filter((membership) => membership.organizationId === organizationId) : memberships).sort((left, right) =>
      left.actorId.localeCompare(right.actorId),
    );
  }

  listAccreditations(organizationId?: string) {
    const accreditations = [...this.accreditationsById.values()];
    return (organizationId ? accreditations.filter((accreditation) => accreditation.organizationId === organizationId) : accreditations).sort(
      (left, right) => right.decidedAt.localeCompare(left.decidedAt),
    );
  }

  listDataSharingAgreements(organizationId?: string) {
    const agreements = [...this.agreementsById.values()];
    return (organizationId ? agreements.filter((agreement) => agreement.organizationId === organizationId) : agreements).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  listDataSharingAgreementRevocations(agreementId?: string) {
    const revocations = [...this.agreementRevocationsById.values()];
    return (agreementId ? revocations.filter((revocation) => revocation.agreementId === agreementId) : revocations).sort((left, right) =>
      right.revokedAt.localeCompare(left.revokedAt),
    );
  }

  getDataSharingAgreementRevocation(revocationId: string) {
    const revocation = this.agreementRevocationsById.get(revocationId);
    if (!revocation) {
      throw new Error(`CanopyProof data-sharing agreement revocation not found: ${revocationId}`);
    }
    return revocation;
  }

  listDataSharingAgreementSupersessions(agreementId?: string) {
    const supersessions = [...this.agreementSupersessionsById.values()];
    return (
      agreementId
        ? supersessions.filter(
            (supersession) =>
              supersession.predecessorAgreementId === agreementId || supersession.successorAgreementId === agreementId,
          )
        : supersessions
    ).sort((left, right) => right.supersededAt.localeCompare(left.supersededAt) || left.id.localeCompare(right.id));
  }

  getDataSharingAgreementSupersession(supersessionId: string) {
    const supersession = this.agreementSupersessionsById.get(supersessionId);
    if (!supersession) {
      throw new Error(`CanopyProof data-sharing agreement supersession not found: ${supersessionId}`);
    }
    return supersession;
  }

  listDataAccessRequests(organizationId?: string) {
    const requests = [...this.dataAccessRequestsById.values()];
    return (organizationId ? requests.filter((request) => request.organizationId === organizationId) : requests).sort((left, right) =>
      right.requestedAt.localeCompare(left.requestedAt),
    );
  }

  getDataAccessRequest(requestId: string) {
    const request = this.dataAccessRequestsById.get(requestId);
    if (!request) {
      throw new Error(`CanopyProof data access request not found: ${requestId}`);
    }
    return request;
  }

  listDataAccessRequestDecisions(requestId?: string) {
    const decisions = [...this.dataAccessRequestDecisionsById.values()];
    return (requestId ? decisions.filter((decision) => decision.requestId === requestId) : decisions).sort(
      (left, right) => left.decidedAt.localeCompare(right.decidedAt) || left.id.localeCompare(right.id),
    );
  }

  getDataAccessRequestDecision(decisionId: string) {
    const decision = this.dataAccessRequestDecisionsById.get(decisionId);
    if (!decision) {
      throw new Error(`CanopyProof data access request decision not found: ${decisionId}`);
    }
    return decision;
  }

  listDataAccessDeliveryReceipts(requestId?: string) {
    const receipts = [...this.dataAccessDeliveryReceiptsById.values()];
    return (requestId ? receipts.filter((receipt) => receipt.requestId === requestId) : receipts).sort((left, right) =>
      right.deliveredAt.localeCompare(left.deliveredAt),
    );
  }

  getDataAccessDeliveryReceipt(deliveryId: string) {
    const receipt = this.dataAccessDeliveryReceiptsById.get(deliveryId);
    if (!receipt) {
      throw new Error(`CanopyProof data access delivery receipt not found: ${deliveryId}`);
    }
    return receipt;
  }

  listDataUseAttestations(deliveryId?: string) {
    const attestations = [...this.dataUseAttestationsById.values()];
    return (deliveryId ? attestations.filter((attestation) => attestation.deliveryId === deliveryId) : attestations).sort((left, right) =>
      right.attestedAt.localeCompare(left.attestedAt),
    );
  }

  getDataUseAttestation(attestationId: string) {
    const attestation = this.dataUseAttestationsById.get(attestationId);
    if (!attestation) {
      throw new Error(`CanopyProof data-use attestation not found: ${attestationId}`);
    }
    return attestation;
  }

  listDataUseEnforcementCases(attestationId?: string) {
    const cases = [...this.dataUseEnforcementCasesById.values()];
    return (attestationId ? cases.filter((enforcementCase) => enforcementCase.attestationId === attestationId) : cases).sort((left, right) =>
      right.reviewedAt.localeCompare(left.reviewedAt),
    );
  }

  getDataUseEnforcementCase(caseId: string) {
    const enforcementCase = this.dataUseEnforcementCasesById.get(caseId);
    if (!enforcementCase) {
      throw new Error(`CanopyProof data-use enforcement case not found: ${caseId}`);
    }
    return enforcementCase;
  }

  listDataAccessRestrictions(requestId?: string) {
    const restrictions = [...this.dataAccessRestrictionsById.values()];
    if (!requestId) {
      return restrictions.sort((left, right) => {
        const timeOrder = right.decidedAt.localeCompare(left.decidedAt);
        return timeOrder === 0 ? left.id.localeCompare(right.id) : timeOrder;
      });
    }
    const request = this.getDataAccessRequest(requestId);
    const organization = this.getOrganization(request.organizationId);
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    return restrictions
      .filter((restriction) => restriction.requestId === requestId)
      .sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof data access restriction is missing from the organization audit stream.");
        }
        return rightOrder - leftOrder;
      });
  }

  getDataAccessRestriction(restrictionId: string) {
    const restriction = this.dataAccessRestrictionsById.get(restrictionId);
    if (!restriction) {
      throw new Error(`CanopyProof data access restriction not found: ${restrictionId}`);
    }
    return restriction;
  }

  listDataAccessAccountabilityPackets(requestId?: string) {
    const packets = [...this.dataAccessAccountabilityPacketsById.values()];
    if (!requestId) {
      return packets.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt) || left.id.localeCompare(right.id));
    }
    const request = this.getDataAccessRequest(requestId);
    const organization = this.getOrganization(request.organizationId);
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    return packets
      .filter((packet) => packet.requestId === requestId)
      .sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof data access accountability packet is missing from the organization audit stream.");
        }
        return rightOrder - leftOrder;
      });
  }

  getDataAccessAccountabilityPacket(packetId: string) {
    const packet = this.dataAccessAccountabilityPacketsById.get(packetId);
    if (!packet) {
      throw new Error(`CanopyProof data access accountability packet not found: ${packetId}`);
    }
    return packet;
  }

  listDataAccessAccountabilityVerifications(packetId?: string) {
    const verifications = [...this.dataAccessAccountabilityVerificationsById.values()];
    if (!packetId) {
      return verifications.sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt) || left.id.localeCompare(right.id));
    }
    const packet = this.getDataAccessAccountabilityPacket(packetId);
    const organization = this.getOrganization(packet.organizationId);
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    return verifications
      .filter((verification) => verification.packetId === packetId)
      .sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof accountability verification is missing from the organization audit stream.");
        }
        return rightOrder - leftOrder;
      });
  }

  getDataAccessAccountabilityVerification(verificationId: string) {
    const verification = this.dataAccessAccountabilityVerificationsById.get(verificationId);
    if (!verification) {
      throw new Error(`CanopyProof data access accountability verification not found: ${verificationId}`);
    }
    return verification;
  }

  listDataAccessAccountabilityDisclosures(
    filter: Readonly<{
      organizationId?: string;
      currentState?: CanopyProofDataAccessAccountabilityDisclosureState;
      governanceState?: CanopyProofDataAccessAccountabilityDisclosureGovernanceState;
    }> = {},
  ) {
    return [...this.dataAccessAccountabilityDisclosuresById.values()]
      .map((disclosure) => this.buildDataAccessAccountabilityDisclosureView(disclosure))
      .filter((disclosure) => !filter.organizationId || disclosure.organizationId === filter.organizationId)
      .filter((disclosure) => !filter.currentState || disclosure.currentState === filter.currentState)
      .filter((disclosure) => !filter.governanceState || disclosure.governanceState === filter.governanceState)
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.id.localeCompare(right.id));
  }

  getDataAccessAccountabilityDisclosure(disclosureId: string) {
    const disclosure = this.getDataAccessAccountabilityDisclosureRecord(disclosureId);
    return this.buildDataAccessAccountabilityDisclosureView(disclosure);
  }

  listDataAccessAccountabilityDisclosureChallenges(disclosureId?: string) {
    const challenges = [...this.dataAccessAccountabilityDisclosureChallengesById.values()];
    if (!disclosureId) {
      return challenges.sort(
        (left, right) => right.challengedAt.localeCompare(left.challengedAt) || left.id.localeCompare(right.id),
      );
    }
    const disclosure = this.getDataAccessAccountabilityDisclosureRecord(disclosureId);
    const organization = this.getOrganization(disclosure.organizationId);
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    return challenges
      .filter((challenge) => challenge.disclosureId === disclosureId)
      .sort((left, right) => {
        const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
        const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
        if (leftOrder === undefined || rightOrder === undefined) {
          throw new Error("CanopyProof accountability disclosure challenge is missing from the organization audit stream.");
        }
        return rightOrder - leftOrder;
      });
  }

  getDataAccessAccountabilityDisclosureChallenge(challengeId: string) {
    const challenge = this.dataAccessAccountabilityDisclosureChallengesById.get(challengeId);
    if (!challenge) {
      throw new Error(`CanopyProof data access accountability disclosure challenge not found: ${challengeId}`);
    }
    return challenge;
  }

  listDataAccessAccountabilityDisclosureResolutions(challengeId?: string) {
    const resolutions = [...this.dataAccessAccountabilityDisclosureResolutionsById.values()];
    const filtered = challengeId ? resolutions.filter((resolution) => resolution.challengeId === challengeId) : resolutions;
    if (!challengeId) {
      return filtered.sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id));
    }
    const challenge = this.getDataAccessAccountabilityDisclosureChallenge(challengeId);
    const organization = this.getOrganization(challenge.organizationId);
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    return filtered.sort((left, right) => {
      const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
      const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
      if (leftOrder === undefined || rightOrder === undefined) {
        throw new Error("CanopyProof accountability disclosure resolution is missing from the organization audit stream.");
      }
      return leftOrder - rightOrder;
    });
  }

  getDataAccessAccountabilityDisclosureResolution(resolutionId: string) {
    const resolution = this.dataAccessAccountabilityDisclosureResolutionsById.get(resolutionId);
    if (!resolution) {
      throw new Error(`CanopyProof data access accountability disclosure resolution not found: ${resolutionId}`);
    }
    return resolution;
  }

  listDataAccessAccountabilityDisclosureNotices(disclosureId?: string) {
    const notices = [...this.dataAccessAccountabilityDisclosureNoticesById.values()];
    const filtered = disclosureId ? notices.filter((notice) => notice.disclosureId === disclosureId) : notices;
    if (!disclosureId) {
      return filtered.sort(
        (left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.id.localeCompare(right.id),
      );
    }
    const disclosure = this.getDataAccessAccountabilityDisclosureRecord(disclosureId);
    const organization = this.getOrganization(disclosure.organizationId);
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    return filtered.sort((left, right) => {
      const leftOrder = eventOrder.get(left.auditEvent.eventRoot);
      const rightOrder = eventOrder.get(right.auditEvent.eventRoot);
      if (leftOrder === undefined || rightOrder === undefined) {
        throw new Error("CanopyProof accountability disclosure notice is missing from the organization audit stream.");
      }
      return rightOrder - leftOrder;
    });
  }

  getDataAccessAccountabilityDisclosureNotice(noticeId: string) {
    const notice = this.dataAccessAccountabilityDisclosureNoticesById.get(noticeId);
    if (!notice) {
      throw new Error(`CanopyProof data access accountability disclosure notice not found: ${noticeId}`);
    }
    return notice;
  }

  getDataAccessAccountabilityDisclosureIndex(
    input: Readonly<{
      organizationId?: string;
      currentState?: CanopyProofDataAccessAccountabilityDisclosureState;
      governanceState?: CanopyProofDataAccessAccountabilityDisclosureGovernanceState;
      cursor?: string;
      limit?: number;
    }> = {},
  ) {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("CanopyProof public accountability disclosure limit must be an integer between 1 and 100.");
    }
    const disclosures = this.listDataAccessAccountabilityDisclosures({
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.currentState ? { currentState: input.currentState } : {}),
      ...(input.governanceState ? { governanceState: input.governanceState } : {}),
    });
    const cursorIndex = input.cursor ? disclosures.findIndex((disclosure) => disclosure.id === input.cursor) : -1;
    if (input.cursor && cursorIndex < 0) {
      throw new Error(`CanopyProof public accountability disclosure cursor is invalid: ${input.cursor}`);
    }
    const offset = cursorIndex + 1;
    const items = disclosures.slice(offset, offset + limit);
    const hasNextPage = offset + items.length < disclosures.length;
    const immutableRoots = disclosures.map((disclosure) => disclosure.disclosureRoot).sort();
    const disclosureSetRoot =
      immutableRoots.length > 0
        ? merkleRoot(immutableRoots)
        : hashJson({ kind: "canopyproof-empty-public-accountability-disclosure-set-v1" });
    return {
      service: "canopyproof-public-accountability-disclosures" as const,
      totalCount: disclosures.length,
      limit,
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(hasNextPage && items.length > 0 ? { nextCursor: items.at(-1)?.id } : {}),
      items,
      indexRoot: hashJson({
        kind: "canopyproof-public-accountability-disclosure-index-v1",
        organizationId: input.organizationId ?? null,
        currentState: input.currentState ?? null,
        governanceState: input.governanceState ?? null,
        totalCount: disclosures.length,
        disclosureSetRoot,
      }),
      safety: publicAccountabilityDisclosureIndexSafetyBoundary(),
    };
  }

  getDataAccessAccountabilityDisclosureStatus() {
    const disclosures = this.listDataAccessAccountabilityDisclosures();
    const immutableRoots = [...this.dataAccessAccountabilityDisclosuresById.values()].map((disclosure) => disclosure.disclosureRoot).sort();
    return {
      service: "canopyproof-public-accountability-disclosures" as const,
      disclosureCount: disclosures.length,
      currentDisclosureCount: disclosures.filter((disclosure) => disclosure.currentState === "current").length,
      staleDisclosureCount: disclosures.filter((disclosure) => disclosure.currentState === "stale").length,
      challengedDisclosureCount: disclosures.filter((disclosure) => disclosure.challengeCount > 0).length,
      openChallengeCount: disclosures.reduce((count, disclosure) => count + disclosure.openChallengeCount, 0),
      correctedDisclosureCount: disclosures.filter((disclosure) => disclosure.governanceState === "corrected").length,
      withdrawnDisclosureCount: disclosures.filter((disclosure) => disclosure.governanceState === "withdrawn").length,
      disclosureRoot:
        immutableRoots.length > 0
          ? merkleRoot(immutableRoots)
          : hashJson({ kind: "canopyproof-empty-public-accountability-disclosure-root-v1" }),
      safety: publicAccountabilityDisclosureIndexSafetyBoundary(),
    };
  }

  getStatus() {
    return {
      service: "canopyproof-partner-collaboration",
      organizationCount: this.organizationsById.size,
      activePartnerCount: this.listPartners().length,
      membershipCount: this.membershipsById.size,
      accreditationCount: this.accreditationsById.size,
      dataSharingAgreementCount: this.agreementsById.size,
      revokedDataSharingAgreementCount: this.listDataSharingAgreements().filter((agreement) => agreement.revoked).length,
      dataSharingAgreementRevocationCount: this.agreementRevocationsById.size,
      supersededDataSharingAgreementCount: this.listDataSharingAgreements().filter((agreement) => agreement.superseded).length,
      dataSharingAgreementSupersessionCount: this.agreementSupersessionsById.size,
      dataAccessRequestCount: this.dataAccessRequestsById.size,
      pendingDataAccessRequestCount: this.listDataAccessRequests().filter((request) => request.status === "pending").length,
      approvedDataAccessRequestCount: this.listDataAccessRequests().filter((request) => request.status === "approved").length,
      dataAccessDeliveryReceiptCount: this.dataAccessDeliveryReceiptsById.size,
      dataUseAttestationCount: this.dataUseAttestationsById.size,
      challengedDataUseAttestationCount: this.listDataUseAttestations().filter(
        (attestation) => attestation.usageState === "misuse_challenged" || attestation.usageState === "revocation_requested",
      ).length,
      dataUseEnforcementCaseCount: this.dataUseEnforcementCasesById.size,
      openDataUseEnforcementCaseCount: this.listDataUseEnforcementCases().filter((enforcementCase) =>
        ["opened", "under_review", "action_required", "access_suspended", "remediation_required"].includes(enforcementCase.caseState),
      ).length,
      revokedDataUseEnforcementCaseCount: this.listDataUseEnforcementCases().filter(
        (enforcementCase) => enforcementCase.caseState === "access_revoked" || enforcementCase.enforcementAction === "revoke_data_access",
      ).length,
      dataAccessRestrictionCount: this.dataAccessRestrictionsById.size,
      activeDataAccessRestrictionCount: this.listDataAccessRequests().filter((request) => {
        const currentRestriction = this.getCurrentDataAccessRestriction(request.id);
        return currentRestriction ? currentRestriction.restrictionState !== "restored" : false;
      }).length,
      revokedDataAccessRestrictionCount: this.listDataAccessRestrictions().filter((restriction) => restriction.restrictionState === "revoked").length,
      dataAccessAccountabilityPacketCount: this.dataAccessAccountabilityPacketsById.size,
      dataAccessAccountabilityVerificationCount: this.dataAccessAccountabilityVerificationsById.size,
      failedDataAccessAccountabilityVerificationCount: this.listDataAccessAccountabilityVerifications().filter((verification) => !verification.valid).length,
      dataAccessAccountabilityDisclosureCount: this.dataAccessAccountabilityDisclosuresById.size,
      staleDataAccessAccountabilityDisclosureCount: this.listDataAccessAccountabilityDisclosures({ currentState: "stale" }).length,
      dataAccessAccountabilityDisclosureChallengeCount: this.dataAccessAccountabilityDisclosureChallengesById.size,
      openDataAccessAccountabilityDisclosureChallengeCount: this.listDataAccessAccountabilityDisclosures().reduce(
        (count, disclosure) => count + disclosure.openChallengeCount,
        0,
      ),
      dataAccessAccountabilityDisclosureResolutionCount: this.dataAccessAccountabilityDisclosureResolutionsById.size,
      dataAccessAccountabilityDisclosureNoticeCount: this.dataAccessAccountabilityDisclosureNoticesById.size,
      withdrawnDataAccessAccountabilityDisclosureCount: this.listDataAccessAccountabilityDisclosures({ governanceState: "withdrawn" }).length,
      correctedDataAccessAccountabilityDisclosureCount: this.listDataAccessAccountabilityDisclosures({ governanceState: "corrected" }).length,
      verifiedOrganizationCount: this.listOrganizations().filter((organization) => organization.verificationStatus === "verified").length,
      suspendedOrganizationCount: this.listOrganizations().filter(
        (organization) => organization.verificationStatus === "suspended" || organization.verificationStatus === "revoked",
      ).length,
      organizationTypes: canopyProofOrganizationTypes,
      roles: canopyProofPartnerRoles,
      verificationStatuses: canopyProofOrganizationVerificationStatuses,
      trustLevels: canopyProofOrganizationTrustLevels,
      dataAccessRequestStatuses: canopyProofDataAccessRequestStatuses,
      dataSharingAgreementTransitionTypes: canopyProofDataSharingAgreementTransitionTypes,
      dataAccessDeliveryChannels: canopyProofDataAccessDeliveryChannels,
      dataUseAttestationStates: canopyProofDataUseAttestationStates,
      dataUseEnforcementStates: canopyProofDataUseEnforcementStates,
      dataUseEnforcementActions: canopyProofDataUseEnforcementActions,
      dataAccessRestrictionStates: canopyProofDataAccessRestrictionStates,
      dataAccessAccountabilityDisclosureStates: canopyProofDataAccessAccountabilityDisclosureStates,
      dataAccessAccountabilityDisclosureGovernanceStates: canopyProofDataAccessAccountabilityDisclosureGovernanceStates,
      dataAccessAccountabilityDisclosureChallengeReasons: canopyProofDataAccessAccountabilityDisclosureChallengeReasons,
      dataAccessAccountabilityDisclosureResolutionDecisions: canopyProofDataAccessAccountabilityDisclosureResolutionDecisions,
      dataAccessAccountabilityDisclosureRemedialActions: canopyProofDataAccessAccountabilityDisclosureRemedialActions,
      dataAccessAccountabilityDisclosureNoticeTypes: canopyProofDataAccessAccountabilityDisclosureNoticeTypes,
    };
  }

  private getMembership(membershipId: string) {
    const membership = this.membershipsById.get(membershipId);
    if (!membership) {
      throw new Error(`CanopyProof membership not found: ${membershipId}`);
    }
    return membership;
  }

  private getDataSharingAgreement(agreementId: string) {
    const agreement = this.agreementsById.get(agreementId);
    if (!agreement) {
      throw new Error(`CanopyProof data-sharing agreement not found: ${agreementId}`);
    }
    return agreement;
  }

  private getCurrentDataAccessRestriction(requestId: string) {
    return this.listDataAccessRestrictions(requestId).at(0);
  }

  private assertDataAccessRequestNotRestricted(requestId: string) {
    const currentRestriction = this.getCurrentDataAccessRestriction(requestId);
    if (currentRestriction && currentRestriction.restrictionState !== "restored") {
      throw new Error(`CanopyProof data access request ${requestId} is currently restricted: ${currentRestriction.restrictionState}.`);
    }
  }

  private replayDataAccessAccountabilityPacket(
    packet: CanopyProofDataAccessAccountabilityPacket,
    request: CanopyProofDataAccessRequest,
    boundary?: Readonly<{ eventOrder: ReadonlyMap<string, number>; beforeOrder: number }>,
  ) {
    const snapshot = this.buildDataAccessAccountabilitySnapshot(request, boundary);
    assertDataAccessAccountabilitySnapshotBounded(snapshot);
    const storedPacketSeed = {
      organizationId: packet.organizationId,
      requestId: packet.requestId,
      agreementId: packet.agreementId,
      generatedBy: packet.generatedBy,
      generatedAt: packet.generatedAt,
      intendedAudience: packet.intendedAudience,
      requestStatus: packet.requestStatus,
      requestHash: request.requestHash,
      counts: packet.counts,
      lineageRoots: packet.lineageRoots,
      safety: packet.safety,
    };
    const canonicalPacketHash = hashJson({
      kind: "canopyproof-data-access-accountability-packet-v1",
      ...storedPacketSeed,
    });
    const canonicalPacketRoot = hashJson({
      kind: "canopyproof-data-access-accountability-root-v1",
      packetHash: canonicalPacketHash,
      accessRoot: request.accessRoot,
      lineageRoots: packet.lineageRoots,
      counts: packet.counts,
    });
    const recomputedPacketSeed = {
      organizationId: packet.organizationId,
      requestId: packet.requestId,
      agreementId: packet.agreementId,
      generatedBy: packet.generatedBy,
      generatedAt: packet.generatedAt,
      intendedAudience: packet.intendedAudience,
      requestStatus: request.status,
      requestHash: request.requestHash,
      counts: snapshot.counts,
      lineageRoots: snapshot.lineageRoots,
      safety: packet.safety,
    };
    const recomputedPacketHash = hashJson({ kind: "canopyproof-data-access-accountability-packet-v1", ...recomputedPacketSeed });
    const recomputedPacketRoot = hashJson({
      kind: "canopyproof-data-access-accountability-root-v1",
      packetHash: recomputedPacketHash,
      accessRoot: request.accessRoot,
      lineageRoots: snapshot.lineageRoots,
      counts: snapshot.counts,
    });
    const issues: CanopyProofDataAccessAccountabilityIssueCode[] = [];
    if (packet.packetHash !== canonicalPacketHash) issues.push("packet_hash_mismatch");
    if (packet.packetRoot !== canonicalPacketRoot) issues.push("packet_root_mismatch");
    if (packet.packetRoot !== recomputedPacketRoot || packet.packetHash !== recomputedPacketHash) issues.push("lineage_stale");
    if (!dataAccessAccountabilityPacketSafetyIsSafe(packet.safety)) issues.push("safety_boundary_violation");
    return {
      recomputedPacketHash,
      recomputedPacketRoot,
      issues: [...new Set(issues)].sort(),
    };
  }

  private getDataAccessAccountabilityDisclosureRecord(disclosureId: string) {
    const disclosure = this.dataAccessAccountabilityDisclosuresById.get(disclosureId);
    if (!disclosure) {
      throw new Error(`CanopyProof data access accountability disclosure not found: ${disclosureId}`);
    }
    return disclosure;
  }

  private buildDataAccessAccountabilityDisclosureView(
    disclosure: CanopyProofDataAccessAccountabilityDisclosure,
    boundary?: Readonly<{ eventOrder: ReadonlyMap<string, number>; beforeOrder: number }>,
    requestAtBoundary?: CanopyProofDataAccessRequest,
  ): CanopyProofDataAccessAccountabilityDisclosureView {
    const packet = this.getDataAccessAccountabilityPacket(disclosure.packetId);
    const request = requestAtBoundary ?? this.getDataAccessRequest(packet.requestId);
    const replay = this.replayDataAccessAccountabilityPacket(packet, request, boundary);
    const beforeBoundary = (event: CanopyProofAuditEvent) => {
      if (!boundary) return true;
      const order = boundary.eventOrder.get(event.eventRoot);
      if (order === undefined) {
        throw new Error("CanopyProof accountability disclosure governance event is missing from the organization audit stream.");
      }
      return order < boundary.beforeOrder;
    };
    const challenges = this.listDataAccessAccountabilityDisclosureChallenges(disclosure.id).filter((challenge) =>
      beforeBoundary(challenge.auditEvent),
    );
    const latestResolutions = challenges.map((challenge) => {
      const resolution = this.listDataAccessAccountabilityDisclosureResolutions(challenge.id)
        .filter((entry) => beforeBoundary(entry.auditEvent))
        .at(-1);
      return { challenge, ...(resolution ? { resolution } : {}) };
    });
    const notices = this.listDataAccessAccountabilityDisclosureNotices(disclosure.id).filter((notice) =>
      beforeBoundary(notice.auditEvent),
    );
    const openChallengeCount = latestResolutions.filter(
      ({ resolution }) => !resolution || resolution.decision === "needs_more_evidence",
    ).length;
    return {
      ...disclosure,
      currentState: replay.issues.length === 0 ? "current" : "stale",
      currentIssues: replay.issues,
      governanceState: resolveDataAccessAccountabilityDisclosureGovernanceState({ latestResolutions, notices }),
      challengeCount: challenges.length,
      openChallengeCount,
      noticeIds: notices.map((notice) => notice.id).sort(),
      replacementDisclosureIds: notices
        .flatMap((notice) => (notice.replacementDisclosureId ? [notice.replacementDisclosureId] : []))
        .sort(),
    };
  }

  private buildDataAccessAccountabilitySnapshot(
    request: CanopyProofDataAccessRequest,
    boundary?: Readonly<{ eventOrder: ReadonlyMap<string, number>; beforeOrder: number }>,
  ) {
    const precedesBoundary = (event: CanopyProofAuditEvent) => {
      if (!boundary) return true;
      const order = boundary.eventOrder.get(event.eventRoot);
      if (order === undefined) {
        throw new Error("CanopyProof data access accountability source is missing from the organization audit stream.");
      }
      return order < boundary.beforeOrder;
    };
    const agreementRevocations = this.listDataSharingAgreementRevocations(request.agreementId).filter((entry) =>
      precedesBoundary(entry.auditEvent),
    );
    const agreementSupersessions = this.listDataSharingAgreementSupersessions(request.agreementId).filter((entry) =>
      precedesBoundary(entry.auditEvent),
    );
    const deliveries = this.listDataAccessDeliveryReceipts(request.id).filter((entry) => precedesBoundary(entry.auditEvent));
    const deliveryIds = new Set(deliveries.map((delivery) => delivery.id));
    const attestations = this.listDataUseAttestations().filter(
      (attestation) => deliveryIds.has(attestation.deliveryId) && precedesBoundary(attestation.auditEvent),
    );
    const attestationIds = new Set(attestations.map((attestation) => attestation.id));
    const enforcementCases = this.listDataUseEnforcementCases().filter(
      (enforcementCase) => attestationIds.has(enforcementCase.attestationId) && precedesBoundary(enforcementCase.auditEvent),
    );
    const restrictions = this.listDataAccessRestrictions(request.id).filter((entry) => precedesBoundary(entry.auditEvent));
    const currentRestriction = restrictions.at(0);
    return {
      counts: {
        agreementRevocationCount: agreementRevocations.length,
        agreementSupersessionCount: agreementSupersessions.length,
        deliveryReceiptCount: deliveries.length,
        dataUseAttestationCount: attestations.length,
        enforcementCaseCount: enforcementCases.length,
        activeRestrictionCount: currentRestriction && currentRestriction.restrictionState !== "restored" ? 1 : 0,
        totalRestrictionCount: restrictions.length,
      },
      lineageRoots: {
        accessRoot: request.accessRoot,
        agreementRevocationRoots: agreementRevocations.map((revocation) => revocation.revocationRoot).sort(),
        agreementSupersessionRoots: agreementSupersessions.map((supersession) => supersession.supersessionRoot).sort(),
        deliveryRoots: deliveries.map((delivery) => delivery.deliveryRoot).sort(),
        usageRoots: attestations.map((attestation) => attestation.usageRoot).sort(),
        enforcementRoots: enforcementCases.map((enforcementCase) => enforcementCase.enforcementRoot).sort(),
        restrictionRoots: restrictions.map((restriction) => restriction.restrictionRoot).sort(),
      },
    };
  }
}

function normalizeOrganizationDocuments(input: readonly z.infer<typeof organizationDocumentSchema>[], fallbackUploadedAt: string) {
  return input
    .map((document) => {
      const documentHash = document.documentHash.toLowerCase();
      return {
        documentId: document.documentId ?? `cp_org_doc_${hashJson({ documentType: document.documentType, documentHash }).slice(0, 24)}`,
        documentType: document.documentType,
        documentHash,
        ...(document.issuedBy ? { issuedBy: document.issuedBy } : {}),
        uploadedAt: document.uploadedAt ?? fallbackUploadedAt,
      } satisfies CanopyProofOrganizationDocument;
    })
    .sort((left, right) => left.documentId.localeCompare(right.documentId));
}

function mergeOrganizationDocuments(
  existing: readonly CanopyProofOrganizationDocument[],
  incoming: readonly CanopyProofOrganizationDocument[],
) {
  const documentsById = new Map<string, CanopyProofOrganizationDocument>();
  for (const document of [...existing, ...incoming]) {
    documentsById.set(document.documentId, document);
  }
  return [...documentsById.values()].sort((left, right) => left.documentId.localeCompare(right.documentId));
}

function resolveTrustLevel(
  verificationStatus: CanopyProofOrganizationVerificationStatus,
  requestedTrustLevel: CanopyProofOrganizationTrustLevel,
): CanopyProofOrganizationTrustLevel {
  if (verificationStatus === "suspended" || verificationStatus === "revoked") return "suspended";
  if (verificationStatus === "pending") return requestedTrustLevel === "suspended" ? "unverified" : requestedTrustLevel;
  if (verificationStatus === "document_review" && requestedTrustLevel === "unverified") return "basic";
  if (verificationStatus === "verified" && (requestedTrustLevel === "unverified" || requestedTrustLevel === "basic")) return "verified";
  return requestedTrustLevel;
}

function assertVerificationTransition(input: Readonly<{
  previousStatus: CanopyProofOrganizationVerificationStatus;
  nextStatus: CanopyProofOrganizationVerificationStatus;
  registrationNumber?: string;
  documentCount: number;
  trustLevel?: CanopyProofOrganizationTrustLevel;
}>) {
  if (input.previousStatus === "revoked" && input.nextStatus !== "revoked") {
    throw new Error("CanopyProof revoked organizations cannot be reactivated without a new institutional identity.");
  }
  if (input.nextStatus === "document_review" && input.documentCount === 0) {
    throw new Error("CanopyProof organization document review requires at least one hash-bound document.");
  }
  if (input.nextStatus === "verified") {
    if (!input.registrationNumber) {
      throw new Error("CanopyProof organization verification requires a registration number.");
    }
    if (input.documentCount === 0) {
      throw new Error("CanopyProof organization verification requires at least one hash-bound document.");
    }
    if (input.trustLevel === "suspended") {
      throw new Error("CanopyProof verified organizations cannot use suspended trust level.");
    }
  }
}

function assertSafePartnerText(values: readonly string[]) {
  const unsafePatterns = [
    /\bcertified\s+carbon\s+credit\b/i,
    /\bcarbon[-\s]?tax\s+offset\b/i,
    /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
    /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
  ];
  for (const value of values) {
    for (const pattern of unsafePatterns) {
      if (pattern.test(value) && !/\bnot\b/i.test(value)) {
        throw new Error(`CanopyProof partner input contains unsupported public claim: ${value}`);
      }
    }
  }
}

function normalizePartnerTextList(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function dataAccessSafetyBoundary() {
  return {
    agreementBound: true,
    scopeLimited: true,
    humanDecisionRequired: true,
    rawDataNotEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessRequestDecisionSafetyBoundary() {
  return {
    requestBound: true,
    agreementBound: true,
    independentHumanDecision: true,
    appendOnly: true,
    rawDataNotEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function createDataAccessRequestDecisionMaterial(
  request: CanopyProofDataAccessRequest,
  status: Exclude<CanopyProofDataAccessRequestStatus, "pending">,
  rationale: string,
  decisionBy: string,
  decidedAt: string,
) {
  const safety = dataAccessRequestDecisionSafetyBoundary();
  const seed = {
    organizationId: request.organizationId,
    requestId: request.id,
    agreementId: request.agreementId,
    previousStatus: request.status,
    status,
    decisionBy,
    decidedAt,
    rationale,
    requestHash: request.requestHash,
    accessRoot: request.accessRoot,
    safety,
  };
  const decisionHash = hashJson({ kind: "canopyproof-data-access-request-decision-v1", ...seed });
  const decisionRoot = hashJson({
    kind: "canopyproof-data-access-request-decision-root-v1",
    decisionHash,
    requestHash: request.requestHash,
    accessRoot: request.accessRoot,
  });
  return {
    id: `cp_data_access_decision_${decisionHash.slice(0, 24)}`,
    seed,
    safety,
    decisionHash,
    decisionRoot,
  };
}

function dataSharingAgreementRevocationSafetyBoundary() {
  return {
    agreementBound: true,
    separateRevocationRecord: true,
    futureAccessBlocked: true,
    futureDeliveryBlocked: true,
    appendOnly: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataSharingAgreementSupersessionSafetyBoundary() {
  return {
    predecessorBound: true,
    successorBound: true,
    scopeExpansionBlocked: true,
    privacyEscalationBlocked: true,
    priorAgreementFutureAccessBlocked: true,
    priorAgreementFutureDeliveryBlocked: true,
    appendOnly: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessDeliverySafetyBoundary() {
  return {
    approvedRequestBound: true,
    agreementBound: true,
    manifestHashOnly: true,
    redactionPolicyEnforced: true,
    rawDataNotEmbedded: true,
    noPrivateContactData: true,
    humanDecisionRequired: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataUseAttestationSafetyBoundary() {
  return {
    deliveryReceiptBound: true,
    approvedRequestBound: true,
    purposeBound: true,
    outputHashOnly: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataUseEnforcementSafetyBoundary() {
  return {
    challengedAttestationBound: true,
    deliveryReceiptBound: true,
    approvedRequestBound: true,
    humanDecisionRequired: true,
    independentReviewerRequired: true,
    accessMutationRequiresSeparateApproval: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    appendOnly: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessRestrictionSafetyBoundary() {
  return {
    enforcementCaseBound: true,
    approvedRequestBound: true,
    separateApprovalPath: true,
    independentDecisionRequired: true,
    reviewerSeparationRequired: true,
    deliveryBlockingEnforced: true,
    appendOnly: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessAccountabilityPacketSafetyBoundary() {
  return {
    requestBound: true,
    appendOnlyLedgerDerived: true,
    hashOnlyLineage: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    observerReadable: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function assertDataAccessAccountabilitySnapshotBounded(snapshot: CanopyProofDataAccessAccountabilitySnapshot) {
  const counts = Object.values(snapshot.counts);
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("CanopyProof data access accountability counts must be non-negative safe integers.");
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.lineageRoots.accessRoot)) {
    throw new Error("CanopyProof data access accountability access root must be a lowercase SHA-256 hash.");
  }
  const rootSets = [
    snapshot.lineageRoots.agreementRevocationRoots,
    snapshot.lineageRoots.agreementSupersessionRoots,
    snapshot.lineageRoots.deliveryRoots,
    snapshot.lineageRoots.usageRoots,
    snapshot.lineageRoots.enforcementRoots,
    snapshot.lineageRoots.restrictionRoots,
  ];
  for (const roots of rootSets) {
    if (
      roots.length > 1_024 ||
      roots.some((root) => !/^[a-f0-9]{64}$/.test(root)) ||
      JSON.stringify(roots) !== JSON.stringify([...new Set(roots)].sort())
    ) {
      throw new Error("CanopyProof data access accountability lineage roots must be bounded, sorted, and unique SHA-256 hashes.");
    }
  }
}

function dataAccessAccountabilityVerificationSafetyBoundary() {
  return {
    replayVerification: true,
    hashOnlyLineage: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessAccountabilityDisclosureSafetyBoundary() {
  return {
    packetBound: true,
    validReplayRequired: true,
    independentPublicationRequired: true,
    appendOnly: true,
    hashOnly: true,
    observerDiscoverable: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessAccountabilityDisclosureChallengeSafetyBoundary() {
  return {
    disclosureBound: true,
    publicStatement: true,
    appendOnly: true,
    humanResolutionRequired: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessAccountabilityDisclosureResolutionSafetyBoundary() {
  return {
    challengeBound: true,
    independentHumanReviewRequired: true,
    appendOnly: true,
    historyPreserved: true,
    noAutomatedFinalAuthority: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessAccountabilityDisclosureNoticeSafetyBoundary() {
  return {
    resolutionBound: true,
    originalDisclosurePreserved: true,
    publicStatement: true,
    appendOnly: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function publicAccountabilityDisclosureIndexSafetyBoundary() {
  return {
    publicReadOnly: true,
    hashOnly: true,
    boundedPagination: true,
    staleLineageVisible: true,
    appendOnlySource: true,
    noRawDataEmbedded: true,
    noPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  } as const;
}

function dataAccessAccountabilityPacketSafetyIsSafe(safety: CanopyProofDataAccessAccountabilityPacket["safety"]) {
  return (
    safety.requestBound === true &&
    safety.appendOnlyLedgerDerived === true &&
    safety.hashOnlyLineage === true &&
    safety.noRawDataEmbedded === true &&
    safety.noPrivateContactData === true &&
    safety.observerReadable === true &&
    safety.notFinalProofAuthority === true &&
    safety.notCarbonCredit === true &&
    safety.notFinancialAsset === true &&
    safety.notTaxOffset === true &&
    safety.notGuaranteedYield === true
  );
}

function assertDataAccessAccountabilityDisclosureEligible(input: Readonly<{
  packet: CanopyProofDataAccessAccountabilityPacket;
  verification: CanopyProofDataAccessAccountabilityVerification;
  replayIssues: readonly CanopyProofDataAccessAccountabilityIssueCode[];
  publishedBy: string;
  publishedAt: string;
}>) {
  if (
    input.verification.packetId !== input.packet.id ||
    input.verification.organizationId !== input.packet.organizationId ||
    input.verification.requestId !== input.packet.requestId
  ) {
    throw new Error("CanopyProof accountability disclosure verification must bind to the published packet.");
  }
  if (
    !input.verification.valid ||
    input.verification.issues.length > 0 ||
    input.verification.packetHash !== input.packet.packetHash ||
    input.verification.recomputedPacketHash !== input.packet.packetHash ||
    input.verification.packetRoot !== input.packet.packetRoot ||
    input.verification.recomputedPacketRoot !== input.packet.packetRoot
  ) {
    throw new Error("CanopyProof accountability disclosure requires a valid packet replay verification.");
  }
  if (
    input.verification.safety.replayVerification !== true ||
    input.verification.safety.hashOnlyLineage !== true ||
    input.verification.safety.noRawDataEmbedded !== true ||
    input.verification.safety.noPrivateContactData !== true
  ) {
    throw new Error("CanopyProof accountability disclosure verification violates the public safety boundary.");
  }
  if (input.replayIssues.length > 0) {
    throw new Error(`CanopyProof accountability disclosure requires current packet lineage: ${input.replayIssues.join(",")}`);
  }
  if (!dataAccessAccountabilityPacketSafetyIsSafe(input.packet.safety)) {
    throw new Error("CanopyProof accountability disclosure packet violates the public safety boundary.");
  }
  const publicationActors = new Set([input.packet.generatedBy, input.verification.verifiedBy, input.publishedBy]);
  if (publicationActors.size !== 3) {
    throw new Error("CanopyProof accountability disclosure requires separate packet generator, replay verifier, and publisher actors.");
  }
  if (
    Date.parse(input.verification.verifiedAt) < Date.parse(input.packet.generatedAt) ||
    Date.parse(input.publishedAt) < Date.parse(input.verification.verifiedAt)
  ) {
    throw new Error("CanopyProof accountability disclosure requires packet, verification, and publication chronology.");
  }
}

function assertDataAccessAccountabilityDisclosureResolutionEligible(input: Readonly<{
  challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge;
  disclosure: CanopyProofDataAccessAccountabilityDisclosure;
  previousResolution?: CanopyProofDataAccessAccountabilityDisclosureResolution;
  decision: CanopyProofDataAccessAccountabilityDisclosureResolutionDecision;
  remedialAction: CanopyProofDataAccessAccountabilityDisclosureRemedialAction;
  reviewedBy: string;
  reviewedAt: string;
}>) {
  if (input.challenge.disclosureId !== input.disclosure.id || input.challenge.organizationId !== input.disclosure.organizationId) {
    throw new Error("CanopyProof disclosure challenge resolution must remain bound to its disclosure.");
  }
  if (input.reviewedBy === input.challenge.challengedBy || input.reviewedBy === input.disclosure.publishedBy) {
    throw new Error("CanopyProof disclosure challenge requires an independent human reviewer.");
  }
  if (Date.parse(input.reviewedAt) < Date.parse(input.challenge.challengedAt)) {
    throw new Error("CanopyProof disclosure challenge resolution cannot predate the challenge.");
  }
  if (input.previousResolution && input.previousResolution.decision !== "needs_more_evidence") {
    throw new Error("CanopyProof disclosure challenge already has a final resolution.");
  }
  if (input.previousResolution && Date.parse(input.reviewedAt) <= Date.parse(input.previousResolution.reviewedAt)) {
    throw new Error("CanopyProof disclosure challenge follow-up resolution must occur after the prior review.");
  }
  if (input.decision === "upheld" && input.remedialAction === "none") {
    throw new Error("CanopyProof upheld disclosure challenge requires a correction or withdrawal notice.");
  }
  if (input.decision !== "upheld" && input.remedialAction !== "none") {
    throw new Error("CanopyProof non-upheld disclosure challenge cannot require a correction or withdrawal notice.");
  }
}

function assertDataAccessAccountabilityDisclosureNoticeEligible(input: Readonly<{
  disclosure: CanopyProofDataAccessAccountabilityDisclosure;
  challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge;
  resolution: CanopyProofDataAccessAccountabilityDisclosureResolution;
  latestResolution?: CanopyProofDataAccessAccountabilityDisclosureResolution;
  replacementDisclosure?: CanopyProofDataAccessAccountabilityDisclosureView;
  noticeType: CanopyProofDataAccessAccountabilityDisclosureNoticeType;
  publishedBy: string;
  publishedAt: string;
  noticeAlreadyExists: boolean;
}>) {
  if (
    input.resolution.challengeId !== input.challenge.id ||
    input.resolution.disclosureId !== input.disclosure.id ||
    input.resolution.organizationId !== input.disclosure.organizationId
  ) {
    throw new Error("CanopyProof disclosure notice must remain bound to its resolution and disclosure.");
  }
  if (!input.latestResolution || input.latestResolution.id !== input.resolution.id) {
    throw new Error("CanopyProof disclosure notice requires the latest challenge resolution.");
  }
  if (input.noticeAlreadyExists) {
    throw new Error("CanopyProof disclosure resolution already has a public notice.");
  }
  if (input.resolution.decision !== "upheld") {
    throw new Error("CanopyProof disclosure notice requires an upheld challenge resolution.");
  }
  const expectedNoticeType = input.resolution.remedialAction === "publish_correction" ? "correction" : "withdrawal";
  if (input.resolution.remedialAction === "none" || input.noticeType !== expectedNoticeType) {
    throw new Error("CanopyProof disclosure notice type must match the resolved remedial action.");
  }
  if (
    input.publishedBy === input.disclosure.publishedBy ||
    input.publishedBy === input.challenge.challengedBy ||
    input.publishedBy === input.resolution.reviewedBy
  ) {
    throw new Error(
      "CanopyProof disclosure notice requires a publisher independent from the original publisher, challenger, and reviewer.",
    );
  }
  if (Date.parse(input.publishedAt) < Date.parse(input.resolution.reviewedAt)) {
    throw new Error("CanopyProof disclosure notice cannot predate its resolution.");
  }
  if (input.noticeType === "correction") {
    if (!input.replacementDisclosure) {
      throw new Error("CanopyProof correction notice requires a replacement disclosure.");
    }
    if (
      input.replacementDisclosure.id === input.disclosure.id ||
      input.replacementDisclosure.organizationId !== input.disclosure.organizationId ||
      input.replacementDisclosure.currentState !== "current" ||
      !["unchallenged", "challenge_dismissed"].includes(input.replacementDisclosure.governanceState)
    ) {
      throw new Error("CanopyProof correction notice requires a current, uncontested replacement disclosure from the same organization.");
    }
  } else if (input.replacementDisclosure) {
    throw new Error("CanopyProof withdrawal notice cannot reference a replacement disclosure.");
  }
}

function resolveDataAccessAccountabilityDisclosureGovernanceState(input: Readonly<{
  latestResolutions: readonly Readonly<{
    challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge;
    resolution?: CanopyProofDataAccessAccountabilityDisclosureResolution;
  }>[];
  notices: readonly CanopyProofDataAccessAccountabilityDisclosureNotice[];
}>): CanopyProofDataAccessAccountabilityDisclosureGovernanceState {
  if (input.latestResolutions.length === 0) return "unchallenged";
  if (input.notices.some((notice) => notice.noticeType === "withdrawal")) return "withdrawn";
  const openResolutions = input.latestResolutions.filter(
    ({ resolution }) => !resolution || resolution.decision === "needs_more_evidence",
  );
  if (openResolutions.some(({ resolution }) => !resolution)) return "challenged";
  if (openResolutions.length > 0) return "needs_more_evidence";
  const noticedResolutionIds = new Set(input.notices.map((notice) => notice.resolutionId));
  const pendingUpheld = input.latestResolutions
    .map(({ resolution }) => resolution)
    .filter((resolution): resolution is CanopyProofDataAccessAccountabilityDisclosureResolution => Boolean(resolution))
    .filter((resolution) => resolution.decision === "upheld" && !noticedResolutionIds.has(resolution.id));
  if (pendingUpheld.some((resolution) => resolution.remedialAction === "publish_withdrawal_notice")) return "withdrawal_required";
  if (pendingUpheld.some((resolution) => resolution.remedialAction === "publish_correction")) return "correction_required";
  if (input.notices.some((notice) => notice.noticeType === "correction")) return "corrected";
  return "challenge_dismissed";
}

function assertDataSharingAgreementRevocable(input: Readonly<{
  agreement: CanopyProofDataSharingAgreement;
  revokedAt: string;
}>) {
  if (input.agreement.revoked) {
    throw new Error("CanopyProof data-sharing agreement is already revoked.");
  }
  if (input.agreement.superseded) {
    throw new Error("CanopyProof data-sharing agreement is already superseded and cannot be revoked as an active agreement.");
  }
  if (input.agreement.expiresAt && Date.parse(input.agreement.expiresAt) <= Date.parse(input.revokedAt)) {
    throw new Error("CanopyProof expired data-sharing agreements should not be revoked; record an expired access decision instead.");
  }
}

function assertDataSharingAgreementSupersedable(input: Readonly<{
  predecessor: CanopyProofDataSharingAgreement;
  transitionType: CanopyProofDataSharingAgreementTransitionType;
  successorDatasetScopes: readonly string[];
  successorPermittedUses: readonly string[];
  successorPrivacyTier: CanopyProofDataSharingAgreement["privacyTier"];
  successorExpiresAt?: string;
  supersededAt: string;
  alreadySuperseded: boolean;
}>) {
  if (input.predecessor.revoked) {
    throw new Error("CanopyProof revoked data-sharing agreements cannot be superseded.");
  }
  if (input.predecessor.superseded || input.alreadySuperseded) {
    throw new Error("CanopyProof data-sharing agreement already has a successor.");
  }
  if (Date.parse(input.supersededAt) <= Date.parse(input.predecessor.createdAt)) {
    throw new Error("CanopyProof data-sharing agreement supersession must occur after predecessor creation.");
  }
  if (input.successorExpiresAt && Date.parse(input.successorExpiresAt) <= Date.parse(input.supersededAt)) {
    throw new Error("CanopyProof successor data-sharing agreement must expire after its effective supersession time.");
  }
  const sameScopes = sameStringSet(input.successorDatasetScopes, input.predecessor.datasetScopes);
  const sameUses = sameStringSet(input.successorPermittedUses, input.predecessor.permittedUses);
  const samePrivacyTier = input.successorPrivacyTier === input.predecessor.privacyTier;
  if (input.transitionType === "renewal") {
    if (!input.predecessor.expiresAt || !input.successorExpiresAt) {
      throw new Error("CanopyProof agreement renewal requires both predecessor and successor expiration times.");
    }
    if (!sameScopes || !sameUses || !samePrivacyTier) {
      throw new Error("CanopyProof agreement renewal must preserve dataset scopes, permitted uses, and privacy tier.");
    }
    if (Date.parse(input.successorExpiresAt) <= Date.parse(input.predecessor.expiresAt)) {
      throw new Error("CanopyProof agreement renewal must extend the predecessor expiration time.");
    }
    return;
  }
  if (!isSubset(input.successorDatasetScopes, input.predecessor.datasetScopes)) {
    throw new Error("CanopyProof agreement supersession cannot expand predecessor dataset scopes.");
  }
  if (!isSubset(input.successorPermittedUses, input.predecessor.permittedUses)) {
    throw new Error("CanopyProof agreement supersession cannot expand predecessor permitted uses.");
  }
  if (privacyTierRank(input.successorPrivacyTier) > privacyTierRank(input.predecessor.privacyTier)) {
    throw new Error("CanopyProof agreement supersession cannot escalate predecessor privacy tier.");
  }
  if (
    input.predecessor.expiresAt &&
    (!input.successorExpiresAt || Date.parse(input.successorExpiresAt) > Date.parse(input.predecessor.expiresAt))
  ) {
    throw new Error("CanopyProof agreement supersession cannot extend predecessor duration; use a constrained renewal.");
  }
  if (
    sameScopes &&
    sameUses &&
    samePrivacyTier &&
    (input.successorExpiresAt ?? null) === (input.predecessor.expiresAt ?? null)
  ) {
    throw new Error("CanopyProof agreement supersession must create a materially constrained successor.");
  }
}

function assertDataAccessEligible(input: Readonly<{
  organization: CanopyProofOrganizationProfile;
  agreement: CanopyProofDataSharingAgreement;
  datasetScopes: readonly string[];
  permittedUses: readonly string[];
  privacyTier: CanopyProofDataSharingAgreement["privacyTier"];
  requestedAt: string;
  expiresAt?: string;
}>) {
  if (input.agreement.organizationId !== input.organization.id) {
    throw new Error("CanopyProof data access request must be bound to the requesting organization agreement.");
  }
  if (input.organization.verificationStatus !== "verified") {
    throw new Error("CanopyProof data access requires a verified organization.");
  }
  if (!["verified", "institutional"].includes(input.organization.trustLevel)) {
    throw new Error("CanopyProof data access requires verified or institutional organization trust.");
  }
  if (input.agreement.revoked) {
    throw new Error("CanopyProof data access cannot use a revoked data-sharing agreement.");
  }
  if (input.agreement.superseded) {
    throw new Error("CanopyProof data access cannot use a superseded data-sharing agreement.");
  }
  if (Date.parse(input.requestedAt) < Date.parse(input.agreement.createdAt)) {
    throw new Error("CanopyProof data access request cannot predate its data-sharing agreement.");
  }
  if (input.agreement.expiresAt && Date.parse(input.agreement.expiresAt) <= Date.parse(input.requestedAt)) {
    throw new Error("CanopyProof data access cannot use an expired data-sharing agreement.");
  }
  if (input.expiresAt && Date.parse(input.expiresAt) <= Date.parse(input.requestedAt)) {
    throw new Error("CanopyProof data access request expiration must follow request submission.");
  }
  if (
    input.expiresAt &&
    input.agreement.expiresAt &&
    Date.parse(input.expiresAt) > Date.parse(input.agreement.expiresAt)
  ) {
    throw new Error("CanopyProof data access request cannot outlive its data-sharing agreement.");
  }
  if (!isSubset(input.datasetScopes, input.agreement.datasetScopes)) {
    throw new Error("CanopyProof data access dataset scopes must be a subset of the data-sharing agreement.");
  }
  if (!isSubset(input.permittedUses, input.agreement.permittedUses)) {
    throw new Error("CanopyProof data access permitted uses must be a subset of the data-sharing agreement.");
  }
  if (privacyTierRank(input.privacyTier) > privacyTierRank(input.agreement.privacyTier)) {
    throw new Error("CanopyProof data access privacy tier cannot exceed the data-sharing agreement tier.");
  }
  if (input.privacyTier === "confidential" && input.organization.trustLevel !== "institutional") {
    throw new Error("CanopyProof confidential data access requires institutional trust.");
  }
}

function assertDataAccessRequestSnapshotIntegrity(input: Readonly<{
  organization: CanopyProofOrganizationProfile;
  agreement: CanopyProofDataSharingAgreement;
  request: CanopyProofDataAccessRequest;
}>) {
  const { agreement, request } = input;
  if (
    request.auditEvent.entityType !== "data_access_request" ||
    request.auditEvent.entityId !== request.id ||
    request.auditEvent.actor !== request.requestedBy ||
    request.auditEvent.createdAt !== request.requestedAt
  ) {
    throw new Error(`CanopyProof partner snapshot request has invalid semantic event binding: ${request.id}`);
  }
  if (JSON.stringify(request.datasetScopes) !== JSON.stringify(normalizePartnerTextList(request.datasetScopes))) {
    throw new Error(`CanopyProof partner snapshot request has invalid dataset scope normalization: ${request.id}`);
  }
  if (JSON.stringify(request.permittedUses) !== JSON.stringify(normalizePartnerTextList(request.permittedUses))) {
    throw new Error(`CanopyProof partner snapshot request has invalid permitted-use normalization: ${request.id}`);
  }
  if (!isSubset(request.datasetScopes, agreement.datasetScopes) || !isSubset(request.permittedUses, agreement.permittedUses)) {
    throw new Error(`CanopyProof partner snapshot request exceeds its agreement boundary: ${request.id}`);
  }
  if (privacyTierRank(request.privacyTier) > privacyTierRank(agreement.privacyTier)) {
    throw new Error(`CanopyProof partner snapshot request exceeds its agreement privacy tier: ${request.id}`);
  }
  if (Date.parse(request.requestedAt) < Date.parse(agreement.createdAt)) {
    throw new Error(`CanopyProof partner snapshot request predates its agreement: ${request.id}`);
  }
  if (agreement.expiresAt && Date.parse(request.requestedAt) >= Date.parse(agreement.expiresAt)) {
    throw new Error(`CanopyProof partner snapshot request was created after agreement expiry: ${request.id}`);
  }
  if (request.expiresAt && Date.parse(request.expiresAt) <= Date.parse(request.requestedAt)) {
    throw new Error(`CanopyProof partner snapshot request has an invalid expiration: ${request.id}`);
  }
  if (request.expiresAt && agreement.expiresAt && Date.parse(request.expiresAt) > Date.parse(agreement.expiresAt)) {
    throw new Error(`CanopyProof partner snapshot request outlives its agreement: ${request.id}`);
  }
  if (hashJson(request.safety) !== hashJson(dataAccessSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot request has an invalid safety boundary: ${request.id}`);
  }
  const requestSeed = {
    organizationId: request.organizationId,
    agreementId: request.agreementId,
    datasetScopes: request.datasetScopes,
    permittedUses: request.permittedUses,
    privacyTier: request.privacyTier,
    purpose: request.purpose,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt ?? null,
    safety: request.safety,
  };
  const expectedHash = hashJson({ kind: "canopyproof-data-access-request-v1", ...requestSeed });
  if (request.requestHash !== expectedHash || request.id !== `cp_data_access_${expectedHash.slice(0, 24)}`) {
    throw new Error(`CanopyProof partner snapshot request hash or identifier is invalid: ${request.id}`);
  }
}

function assertDataAccessRequestDecisionSnapshotIntegrity(
  request: CanopyProofDataAccessRequest,
  decision: CanopyProofDataAccessRequestDecision,
) {
  if (decision.previousStatus !== request.status) {
    throw new Error(`CanopyProof partner snapshot decision predecessor is invalid: ${decision.id}`);
  }
  assertDataAccessDecisionTransition(request.status, decision.status);
  if (decision.decisionBy === request.requestedBy) {
    throw new Error(`CanopyProof partner snapshot decision is not independent: ${decision.id}`);
  }
  if (Date.parse(decision.decidedAt) < Date.parse(request.requestedAt)) {
    throw new Error(`CanopyProof partner snapshot decision predates its request: ${decision.id}`);
  }
  if (
    decision.auditEvent.entityType !== "data_access_request_decision" ||
    decision.auditEvent.entityId !== decision.id ||
    decision.auditEvent.actor !== decision.decisionBy ||
    decision.auditEvent.createdAt !== decision.decidedAt
  ) {
    throw new Error(`CanopyProof partner snapshot decision has invalid semantic event binding: ${decision.id}`);
  }
  const material = createDataAccessRequestDecisionMaterial(
    request,
    decision.status,
    decision.rationale,
    decision.decisionBy,
    decision.decidedAt,
  );
  if (
    decision.id !== material.id ||
    decision.decisionHash !== material.decisionHash ||
    decision.decisionRoot !== material.decisionRoot ||
    hashJson(decision.safety) !== hashJson(material.safety)
  ) {
    throw new Error(`CanopyProof partner snapshot decision hash lineage is invalid: ${decision.id}`);
  }
}

function applyDataAccessRequestDecision(
  request: CanopyProofDataAccessRequest,
  decision: CanopyProofDataAccessRequestDecision,
): CanopyProofDataAccessRequest {
  return {
    ...request,
    status: decision.status,
    decisionBy: decision.decisionBy,
    decidedAt: decision.decidedAt,
    decisionRationale: decision.rationale,
    decisionAuditEvent: decision.auditEvent,
  };
}

function projectDataAccessRequestAtAuditOrder(input: Readonly<{
  request: CanopyProofDataAccessRequest;
  decisions: readonly CanopyProofDataAccessRequestDecision[];
  eventOrder: ReadonlyMap<string, number>;
  targetOrder: number;
}>) {
  let projected = input.request;
  const decisions = input.decisions
    .filter((decision) => decision.requestId === input.request.id)
    .map((decision) => {
      const order = input.eventOrder.get(decision.auditEvent.eventRoot);
      if (order === undefined) {
        throw new Error(`CanopyProof partner snapshot decision is missing from the organization audit stream: ${decision.id}`);
      }
      return { decision, order };
    })
    .filter(({ order }) => order <= input.targetOrder)
    .sort((left, right) => left.order - right.order);
  for (const { decision } of decisions) {
    assertDataAccessRequestDecisionSnapshotIntegrity(projected, decision);
    projected = applyDataAccessRequestDecision(projected, decision);
  }
  return projected;
}

function projectDataSharingAgreementAtAuditOrder(input: Readonly<{
  agreement: CanopyProofDataSharingAgreement;
  revocations: readonly CanopyProofDataSharingAgreementRevocation[];
  supersessions: readonly CanopyProofDataSharingAgreementSupersession[];
  eventOrder: ReadonlyMap<string, number>;
  targetOrder: number;
}>) {
  const revocations = input.revocations.filter((entry) => entry.agreementId === input.agreement.id);
  const supersessions = input.supersessions.filter((entry) => entry.predecessorAgreementId === input.agreement.id);
  const { supersededByAgreementId: _supersededByAgreementId, ...agreementWithoutSuccessor } = input.agreement;
  let projected: CanopyProofDataSharingAgreement = {
    ...agreementWithoutSuccessor,
    revoked: input.agreement.revoked && revocations.length === 0,
    superseded: input.agreement.superseded && supersessions.length === 0,
    ...(supersessions.length === 0 && _supersededByAgreementId
      ? { supersededByAgreementId: _supersededByAgreementId }
      : {}),
  };
  for (const revocation of revocations) {
    const order = input.eventOrder.get(revocation.auditEvent.eventRoot);
    if (order === undefined) {
      throw new Error(`CanopyProof partner snapshot agreement revocation is missing from the organization audit stream: ${revocation.id}`);
    }
    if (order <= input.targetOrder) projected = { ...projected, revoked: true };
  }
  for (const supersession of supersessions) {
    const order = input.eventOrder.get(supersession.auditEvent.eventRoot);
    if (order === undefined) {
      throw new Error(`CanopyProof partner snapshot agreement supersession is missing from the organization audit stream: ${supersession.id}`);
    }
    if (order <= input.targetOrder) {
      projected = {
        ...projected,
        superseded: true,
        supersededByAgreementId: supersession.successorAgreementId,
      };
    }
  }
  return projected;
}

function assertDataAccessDeliveryReceiptSnapshotIntegrity(input: Readonly<{
  organization: CanopyProofOrganizationProfile;
  request: CanopyProofDataAccessRequest;
  agreement: CanopyProofDataSharingAgreement;
  receipt: CanopyProofDataAccessDeliveryReceipt;
}>) {
  const { organization, request, agreement, receipt } = input;
  if (
    receipt.organizationId !== organization.id ||
    receipt.requestId !== request.id ||
    receipt.agreementId !== agreement.id ||
    receipt.accessRoot !== request.accessRoot
  ) {
    throw new Error(`CanopyProof partner snapshot delivery has invalid request lineage: ${receipt.id}`);
  }
  if (
    receipt.auditEvent.action !== "FULFILL" ||
    receipt.auditEvent.entityType !== "data_access_delivery_receipt" ||
    receipt.auditEvent.entityId !== receipt.id ||
    receipt.auditEvent.actor !== receipt.deliveredBy ||
    receipt.auditEvent.createdAt !== receipt.deliveredAt
  ) {
    throw new Error(`CanopyProof partner snapshot delivery has invalid semantic event binding: ${receipt.id}`);
  }
  if (receipt.deliveredBy === receipt.recipientActorId) {
    throw new Error(`CanopyProof partner snapshot delivery actor is not independent from its recipient: ${receipt.id}`);
  }
  if (
    receipt.manifestHash !== normalizeHash(receipt.manifestHash) ||
    receipt.manifestEntryRoot !== normalizeHash(receipt.manifestEntryRoot) ||
    hashJson(receipt.safety) !== hashJson(dataAccessDeliverySafetyBoundary())
  ) {
    throw new Error(`CanopyProof partner snapshot delivery has an invalid hash or safety boundary: ${receipt.id}`);
  }
  assertSafePartnerText([
    receipt.manifestId,
    receipt.manifestRequesterOrganizationId,
    receipt.recipientActorId,
    receipt.purpose,
  ]);
  assertNoRawDataAccessMaterial([
    receipt.manifestId,
    receipt.manifestRequesterOrganizationId,
    receipt.recipientActorId,
    receipt.purpose,
  ]);
  assertDataAccessDeliveryEligible({
    request,
    agreement,
    organizationId: organization.id,
    manifestRequesterOrganizationId: receipt.manifestRequesterOrganizationId,
    manifestClassification: receipt.manifestClassification,
    deliveredAt: receipt.deliveredAt,
  });
  const deliverySeed = {
    organizationId: receipt.organizationId,
    requestId: receipt.requestId,
    agreementId: receipt.agreementId,
    manifestId: receipt.manifestId,
    manifestRequesterOrganizationId: receipt.manifestRequesterOrganizationId,
    manifestHash: receipt.manifestHash,
    manifestEntryRoot: receipt.manifestEntryRoot,
    manifestClassification: receipt.manifestClassification,
    channel: receipt.channel,
    recipientActorId: receipt.recipientActorId,
    deliveredBy: receipt.deliveredBy,
    deliveredAt: receipt.deliveredAt,
    purpose: receipt.purpose,
    accessRoot: receipt.accessRoot,
    safety: receipt.safety,
  };
  const expectedReceiptHash = hashJson({ kind: "canopyproof-data-access-delivery-receipt-v1", ...deliverySeed });
  const expectedDeliveryRoot = hashJson({
    kind: "canopyproof-data-access-delivery-root-v1",
    receiptHash: expectedReceiptHash,
    requestHash: request.requestHash,
    accessRoot: request.accessRoot,
    manifestHash: receipt.manifestHash,
    manifestEntryRoot: receipt.manifestEntryRoot,
  });
  const expectedPayloadHash = hashJson({ ...deliverySeed, receiptHash: expectedReceiptHash, deliveryRoot: expectedDeliveryRoot });
  if (
    receipt.id !== `cp_data_delivery_${expectedReceiptHash.slice(0, 24)}` ||
    receipt.receiptHash !== expectedReceiptHash ||
    receipt.deliveryRoot !== expectedDeliveryRoot ||
    receipt.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot delivery hash lineage is invalid: ${receipt.id}`);
  }
}

function assertDataUseAttestationSnapshotIntegrity(input: Readonly<{
  delivery: CanopyProofDataAccessDeliveryReceipt;
  request: CanopyProofDataAccessRequest;
  agreement: CanopyProofDataSharingAgreement;
  attestation: CanopyProofDataUseAttestation;
}>) {
  const { delivery, request, agreement, attestation } = input;
  if (
    attestation.organizationId !== delivery.organizationId ||
    attestation.requestId !== request.id ||
    attestation.deliveryId !== delivery.id ||
    attestation.manifestId !== delivery.manifestId
  ) {
    throw new Error(`CanopyProof partner snapshot data use attestation has invalid authority lineage: ${attestation.id}`);
  }
  const expectedAction = attestation.usageState === "within_scope" || attestation.usageState === "no_use" ? "ASSERT" : "CHALLENGE";
  if (
    attestation.auditEvent.action !== expectedAction ||
    attestation.auditEvent.entityType !== "data_use_attestation" ||
    attestation.auditEvent.entityId !== attestation.id ||
    attestation.auditEvent.actor !== attestation.attestedBy ||
    attestation.auditEvent.createdAt !== attestation.attestedAt
  ) {
    throw new Error(`CanopyProof partner snapshot data use attestation has invalid semantic event binding: ${attestation.id}`);
  }
  if (
    JSON.stringify(attestation.outputHashes) !== JSON.stringify(normalizeHashes(attestation.outputHashes)) ||
    JSON.stringify(attestation.evidenceEventRoots) !== JSON.stringify(normalizeHashes(attestation.evidenceEventRoots)) ||
    JSON.stringify(attestation.limitations) !== JSON.stringify(normalizePartnerTextList(attestation.limitations))
  ) {
    throw new Error(`CanopyProof partner snapshot data use attestation has non-canonical arrays: ${attestation.id}`);
  }
  if (hashJson(attestation.safety) !== hashJson(dataUseAttestationSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot data use attestation has an invalid safety boundary: ${attestation.id}`);
  }
  assertSafePartnerText([attestation.useCase, ...attestation.limitations]);
  assertNoRawDataAccessMaterial([attestation.useCase, ...attestation.limitations]);
  assertDataUseAttestationEvidence({
    usageState: attestation.usageState,
    outputHashes: attestation.outputHashes,
    evidenceEventRoots: attestation.evidenceEventRoots,
  });
  assertDataUseAttestationEligible({
    delivery,
    request,
    agreement,
    usageState: attestation.usageState,
    actorId: attestation.attestedBy,
    attestedAt: attestation.attestedAt,
  });
  const usageSeed = {
    organizationId: attestation.organizationId,
    requestId: attestation.requestId,
    deliveryId: attestation.deliveryId,
    manifestId: attestation.manifestId,
    usageState: attestation.usageState,
    useCase: attestation.useCase,
    outputHashes: attestation.outputHashes,
    evidenceEventRoots: attestation.evidenceEventRoots,
    limitations: attestation.limitations,
    attestedBy: attestation.attestedBy,
    attestedAt: attestation.attestedAt,
    deliveryRoot: delivery.deliveryRoot,
    accessRoot: delivery.accessRoot,
    safety: attestation.safety,
  };
  const expectedAttestationHash = hashJson({ kind: "canopyproof-data-use-attestation-v1", ...usageSeed });
  const expectedUsageRoot = hashJson({
    kind: "canopyproof-data-use-root-v1",
    attestationHash: expectedAttestationHash,
    deliveryRoot: delivery.deliveryRoot,
    accessRoot: delivery.accessRoot,
    outputHashes: attestation.outputHashes,
    evidenceEventRoots: attestation.evidenceEventRoots,
  });
  const expectedPayloadHash = hashJson({
    ...usageSeed,
    attestationHash: expectedAttestationHash,
    usageRoot: expectedUsageRoot,
  });
  if (
    attestation.id !== `cp_data_use_${expectedAttestationHash.slice(0, 24)}` ||
    attestation.attestationHash !== expectedAttestationHash ||
    attestation.usageRoot !== expectedUsageRoot ||
    attestation.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot data use attestation hash lineage is invalid: ${attestation.id}`);
  }
}

function assertDataUseEnforcementCaseSnapshotIntegrity(input: Readonly<{
  attestation: CanopyProofDataUseAttestation;
  delivery: CanopyProofDataAccessDeliveryReceipt;
  request: CanopyProofDataAccessRequest;
  enforcementCase: CanopyProofDataUseEnforcementCase;
}>) {
  const { attestation, delivery, request, enforcementCase } = input;
  if (
    enforcementCase.organizationId !== attestation.organizationId ||
    enforcementCase.requestId !== request.id ||
    enforcementCase.deliveryId !== delivery.id ||
    enforcementCase.attestationId !== attestation.id ||
    enforcementCase.manifestId !== delivery.manifestId ||
    delivery.requestId !== request.id ||
    delivery.accessRoot !== request.accessRoot
  ) {
    throw new Error(`CanopyProof partner snapshot data use enforcement case has invalid authority lineage: ${enforcementCase.id}`);
  }
  const expectedAction = enforcementCase.caseState === "resolved" || enforcementCase.caseState === "rejected" ? "FULFILL" : "CHALLENGE";
  if (
    enforcementCase.auditEvent.action !== expectedAction ||
    enforcementCase.auditEvent.entityType !== "data_use_enforcement_case" ||
    enforcementCase.auditEvent.entityId !== enforcementCase.id ||
    enforcementCase.auditEvent.actor !== enforcementCase.reviewerId ||
    enforcementCase.auditEvent.createdAt !== enforcementCase.reviewedAt
  ) {
    throw new Error(`CanopyProof partner snapshot data use enforcement case has invalid semantic event binding: ${enforcementCase.id}`);
  }
  if (JSON.stringify(enforcementCase.evidenceEventRoots) !== JSON.stringify(normalizeHashes(enforcementCase.evidenceEventRoots))) {
    throw new Error(`CanopyProof partner snapshot data use enforcement case has non-canonical evidence roots: ${enforcementCase.id}`);
  }
  if (hashJson(enforcementCase.safety) !== hashJson(dataUseEnforcementSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot data use enforcement case has an invalid safety boundary: ${enforcementCase.id}`);
  }
  assertSafePartnerText([enforcementCase.rationale]);
  assertNoRawDataAccessMaterial([enforcementCase.rationale]);
  assertDataUseEnforcementAction({
    caseState: enforcementCase.caseState,
    enforcementAction: enforcementCase.enforcementAction,
  });
  assertDataUseEnforcementEligible({
    attestation,
    delivery,
    request,
    actorId: enforcementCase.reviewerId,
    reviewedAt: enforcementCase.reviewedAt,
    evidenceEventRoots: enforcementCase.evidenceEventRoots,
  });
  const enforcementSeed = {
    organizationId: enforcementCase.organizationId,
    requestId: enforcementCase.requestId,
    deliveryId: enforcementCase.deliveryId,
    attestationId: enforcementCase.attestationId,
    manifestId: enforcementCase.manifestId,
    caseState: enforcementCase.caseState,
    enforcementAction: enforcementCase.enforcementAction,
    rationale: enforcementCase.rationale,
    evidenceEventRoots: enforcementCase.evidenceEventRoots,
    reviewerId: enforcementCase.reviewerId,
    reviewedAt: enforcementCase.reviewedAt,
    usageRoot: attestation.usageRoot,
    deliveryRoot: delivery.deliveryRoot,
    accessRoot: request.accessRoot,
    safety: enforcementCase.safety,
  };
  const expectedEnforcementHash = hashJson({
    kind: "canopyproof-data-use-enforcement-case-v1",
    ...enforcementSeed,
  });
  const expectedEnforcementRoot = hashJson({
    kind: "canopyproof-data-use-enforcement-root-v1",
    enforcementHash: expectedEnforcementHash,
    usageRoot: attestation.usageRoot,
    deliveryRoot: delivery.deliveryRoot,
    accessRoot: request.accessRoot,
    evidenceEventRoots: enforcementCase.evidenceEventRoots,
  });
  const expectedPayloadHash = hashJson({
    ...enforcementSeed,
    enforcementHash: expectedEnforcementHash,
    enforcementRoot: expectedEnforcementRoot,
  });
  if (
    enforcementCase.id !== `cp_data_use_enforcement_${expectedEnforcementHash.slice(0, 24)}` ||
    enforcementCase.enforcementHash !== expectedEnforcementHash ||
    enforcementCase.enforcementRoot !== expectedEnforcementRoot ||
    enforcementCase.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot data use enforcement case hash lineage is invalid: ${enforcementCase.id}`);
  }
}

function assertDataAccessRestrictionSnapshotIntegrity(input: Readonly<{
  request: CanopyProofDataAccessRequest;
  enforcementCase: CanopyProofDataUseEnforcementCase;
  attestation: CanopyProofDataUseAttestation;
  delivery: CanopyProofDataAccessDeliveryReceipt;
  restriction: CanopyProofDataAccessRestriction;
  currentRestriction?: CanopyProofDataAccessRestriction;
}>) {
  const { request, enforcementCase, attestation, delivery, restriction, currentRestriction } = input;
  if (
    restriction.organizationId !== request.organizationId ||
    restriction.requestId !== request.id ||
    restriction.enforcementCaseId !== enforcementCase.id ||
    restriction.attestationId !== attestation.id ||
    restriction.deliveryId !== delivery.id ||
    enforcementCase.requestId !== request.id ||
    enforcementCase.attestationId !== attestation.id ||
    enforcementCase.deliveryId !== delivery.id ||
    delivery.accessRoot !== request.accessRoot
  ) {
    throw new Error(`CanopyProof partner snapshot data access restriction has invalid authority lineage: ${restriction.id}`);
  }
  if (
    restriction.previousRestrictionId !== currentRestriction?.id ||
    restriction.previousRestrictionRoot !== currentRestriction?.restrictionRoot ||
    restriction.previousRestrictionState !== currentRestriction?.restrictionState
  ) {
    throw new Error(`CanopyProof partner snapshot data access restriction has an invalid predecessor: ${restriction.id}`);
  }
  const expectedAction = restriction.restrictionState === "restored" ? "FULFILL" : "CHALLENGE";
  if (
    restriction.auditEvent.action !== expectedAction ||
    restriction.auditEvent.entityType !== "data_access_restriction" ||
    restriction.auditEvent.entityId !== restriction.id ||
    restriction.auditEvent.actor !== restriction.decidedBy ||
    restriction.auditEvent.createdAt !== restriction.decidedAt
  ) {
    throw new Error(`CanopyProof partner snapshot data access restriction has invalid semantic event binding: ${restriction.id}`);
  }
  if (JSON.stringify(restriction.evidenceEventRoots) !== JSON.stringify(normalizeHashes(restriction.evidenceEventRoots))) {
    throw new Error(`CanopyProof partner snapshot data access restriction has non-canonical evidence roots: ${restriction.id}`);
  }
  if (hashJson(restriction.safety) !== hashJson(dataAccessRestrictionSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot data access restriction has an invalid safety boundary: ${restriction.id}`);
  }
  assertSafePartnerText([restriction.rationale]);
  assertNoRawDataAccessMaterial([restriction.rationale]);
  assertDataAccessRestrictionEligible({
    enforcementCase,
    attestation,
    delivery,
    request,
    restrictionState: restriction.restrictionState,
    actorId: restriction.decidedBy,
    decidedAt: restriction.decidedAt,
    evidenceEventRoots: restriction.evidenceEventRoots,
    ...(restriction.expiresAt ? { expiresAt: restriction.expiresAt } : {}),
    ...(currentRestriction ? { currentRestriction } : {}),
  });
  const restrictionSeed = {
    organizationId: restriction.organizationId,
    requestId: restriction.requestId,
    enforcementCaseId: restriction.enforcementCaseId,
    attestationId: restriction.attestationId,
    deliveryId: restriction.deliveryId,
    previousRestrictionId: restriction.previousRestrictionId ?? null,
    previousRestrictionRoot: restriction.previousRestrictionRoot ?? null,
    previousRestrictionState: restriction.previousRestrictionState ?? null,
    restrictionState: restriction.restrictionState,
    rationale: restriction.rationale,
    evidenceEventRoots: restriction.evidenceEventRoots,
    decidedBy: restriction.decidedBy,
    decidedAt: restriction.decidedAt,
    expiresAt: restriction.expiresAt ?? null,
    enforcementRoot: enforcementCase.enforcementRoot,
    usageRoot: attestation.usageRoot,
    deliveryRoot: delivery.deliveryRoot,
    accessRoot: request.accessRoot,
    safety: restriction.safety,
  };
  const expectedRestrictionHash = hashJson({
    kind: "canopyproof-data-access-restriction-v1",
    ...restrictionSeed,
  });
  const expectedRestrictionRoot = hashJson({
    kind: "canopyproof-data-access-restriction-root-v1",
    restrictionHash: expectedRestrictionHash,
    enforcementRoot: enforcementCase.enforcementRoot,
    usageRoot: attestation.usageRoot,
    deliveryRoot: delivery.deliveryRoot,
    accessRoot: request.accessRoot,
    evidenceEventRoots: restriction.evidenceEventRoots,
    previousRestrictionRoot: restriction.previousRestrictionRoot ?? null,
  });
  const expectedPayloadHash = hashJson({
    ...restrictionSeed,
    restrictionHash: expectedRestrictionHash,
    restrictionRoot: expectedRestrictionRoot,
  });
  if (
    restriction.id !== `cp_data_access_restriction_${expectedRestrictionHash.slice(0, 24)}` ||
    restriction.restrictionHash !== expectedRestrictionHash ||
    restriction.restrictionRoot !== expectedRestrictionRoot ||
    restriction.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot data access restriction hash lineage is invalid: ${restriction.id}`);
  }
}

function assertDataAccessAccountabilityPacketSnapshotIntegrity(input: Readonly<{
  request: CanopyProofDataAccessRequest;
  packet: CanopyProofDataAccessAccountabilityPacket;
  snapshot: CanopyProofDataAccessAccountabilitySnapshot;
}>) {
  const { request, packet, snapshot } = input;
  if (
    packet.organizationId !== request.organizationId ||
    packet.requestId !== request.id ||
    packet.agreementId !== request.agreementId ||
    packet.requestStatus !== request.status ||
    packet.lineageRoots.accessRoot !== request.accessRoot
  ) {
    throw new Error(`CanopyProof partner snapshot accountability packet has invalid request lineage: ${packet.id}`);
  }
  if (
    packet.auditEvent.action !== "ASSERT" ||
    packet.auditEvent.entityType !== "data_access_accountability_packet" ||
    packet.auditEvent.entityId !== packet.id ||
    packet.auditEvent.actor !== packet.generatedBy ||
    packet.auditEvent.createdAt !== packet.generatedAt
  ) {
    throw new Error(`CanopyProof partner snapshot accountability packet has invalid semantic event binding: ${packet.id}`);
  }
  if (Date.parse(packet.generatedAt) < Date.parse(request.requestedAt)) {
    throw new Error(`CanopyProof partner snapshot accountability packet predates its request: ${packet.id}`);
  }
  assertSafePartnerText([packet.intendedAudience]);
  assertNoRawDataAccessMaterial([packet.intendedAudience]);
  assertDataAccessAccountabilitySnapshotBounded(snapshot);
  if (
    hashJson(packet.counts) !== hashJson(snapshot.counts) ||
    hashJson(packet.lineageRoots) !== hashJson(snapshot.lineageRoots)
  ) {
    throw new Error(`CanopyProof partner snapshot accountability packet omits or adds ledger lineage: ${packet.id}`);
  }
  if (hashJson(packet.safety) !== hashJson(dataAccessAccountabilityPacketSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot accountability packet has an invalid safety boundary: ${packet.id}`);
  }
  const packetSeed = {
    organizationId: packet.organizationId,
    requestId: packet.requestId,
    agreementId: packet.agreementId,
    generatedBy: packet.generatedBy,
    generatedAt: packet.generatedAt,
    intendedAudience: packet.intendedAudience,
    requestStatus: packet.requestStatus,
    requestHash: request.requestHash,
    counts: packet.counts,
    lineageRoots: packet.lineageRoots,
    safety: packet.safety,
  };
  const expectedPacketHash = hashJson({ kind: "canopyproof-data-access-accountability-packet-v1", ...packetSeed });
  const expectedPacketRoot = hashJson({
    kind: "canopyproof-data-access-accountability-root-v1",
    packetHash: expectedPacketHash,
    accessRoot: request.accessRoot,
    lineageRoots: packet.lineageRoots,
    counts: packet.counts,
  });
  const expectedPayloadHash = hashJson({
    ...packetSeed,
    packetHash: expectedPacketHash,
    packetRoot: expectedPacketRoot,
  });
  if (
    packet.id !== `cp_data_access_packet_${expectedPacketHash.slice(0, 24)}` ||
    packet.packetHash !== expectedPacketHash ||
    packet.packetRoot !== expectedPacketRoot ||
    packet.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot accountability packet hash lineage is invalid: ${packet.id}`);
  }
}

function assertDataAccessAccountabilityVerificationSnapshotIntegrity(input: Readonly<{
  packet: CanopyProofDataAccessAccountabilityPacket;
  verification: CanopyProofDataAccessAccountabilityVerification;
  replay: Readonly<{
    recomputedPacketHash: string;
    recomputedPacketRoot: string;
    issues: readonly CanopyProofDataAccessAccountabilityIssueCode[];
  }>;
}>) {
  const { packet, verification, replay } = input;
  if (
    verification.packetId !== packet.id ||
    verification.organizationId !== packet.organizationId ||
    verification.requestId !== packet.requestId ||
    verification.packetHash !== packet.packetHash ||
    verification.packetRoot !== packet.packetRoot ||
    verification.recomputedPacketHash !== replay.recomputedPacketHash ||
    verification.recomputedPacketRoot !== replay.recomputedPacketRoot
  ) {
    throw new Error(`CanopyProof partner snapshot accountability verification has invalid packet replay: ${verification.id}`);
  }
  if (verification.verifiedBy === packet.generatedBy || Date.parse(verification.verifiedAt) < Date.parse(packet.generatedAt)) {
    throw new Error(
      `CanopyProof partner snapshot accountability verification lacks independent chronological review: ${verification.id}`,
    );
  }
  if (verification.expectedPacketRoot && !/^[a-f0-9]{64}$/.test(verification.expectedPacketRoot)) {
    throw new Error(`CanopyProof partner snapshot accountability verification has an invalid expected root: ${verification.id}`);
  }
  const expectedIssues = [...replay.issues];
  if (verification.expectedPacketRoot && verification.expectedPacketRoot !== packet.packetRoot) {
    expectedIssues.push("expected_root_mismatch");
  }
  const canonicalIssues = [...new Set(expectedIssues)].sort();
  if (
    JSON.stringify(verification.issues) !== JSON.stringify(canonicalIssues) ||
    verification.valid !== (canonicalIssues.length === 0)
  ) {
    throw new Error(`CanopyProof partner snapshot accountability verification has invalid issue derivation: ${verification.id}`);
  }
  const expectedAction = verification.valid ? "ASSERT" : "CHALLENGE";
  if (
    verification.auditEvent.action !== expectedAction ||
    verification.auditEvent.entityType !== "data_access_accountability_verification" ||
    verification.auditEvent.entityId !== verification.id ||
    verification.auditEvent.actor !== verification.verifiedBy ||
    verification.auditEvent.createdAt !== verification.verifiedAt
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability verification has invalid semantic event binding: ${verification.id}`,
    );
  }
  if (hashJson(verification.safety) !== hashJson(dataAccessAccountabilityVerificationSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot accountability verification has an invalid safety boundary: ${verification.id}`);
  }
  const verificationSeed = {
    organizationId: verification.organizationId,
    packetId: verification.packetId,
    requestId: verification.requestId,
    valid: verification.valid,
    issues: verification.issues,
    expectedPacketRoot: verification.expectedPacketRoot ?? null,
    packetHash: verification.packetHash,
    recomputedPacketHash: verification.recomputedPacketHash,
    packetRoot: verification.packetRoot,
    recomputedPacketRoot: verification.recomputedPacketRoot,
    verifiedBy: verification.verifiedBy,
    verifiedAt: verification.verifiedAt,
    safety: verification.safety,
  };
  const expectedVerificationRoot = hashJson({
    kind: "canopyproof-data-access-accountability-verification-v1",
    ...verificationSeed,
  });
  const expectedPayloadHash = hashJson({ ...verificationSeed, verificationRoot: expectedVerificationRoot });
  if (
    verification.id !== `cp_data_access_packet_verification_${expectedVerificationRoot.slice(0, 24)}` ||
    verification.verificationRoot !== expectedVerificationRoot ||
    verification.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot accountability verification hash lineage is invalid: ${verification.id}`);
  }
}

function assertDataAccessAccountabilityDisclosureSnapshotIntegrity(input: Readonly<{
  packet: CanopyProofDataAccessAccountabilityPacket;
  verification: CanopyProofDataAccessAccountabilityVerification;
  disclosure: CanopyProofDataAccessAccountabilityDisclosure;
  replay: Readonly<{
    recomputedPacketHash: string;
    recomputedPacketRoot: string;
    issues: readonly CanopyProofDataAccessAccountabilityIssueCode[];
  }>;
}>) {
  const { packet, verification, disclosure, replay } = input;
  assertDataAccessAccountabilityDisclosureEligible({
    packet,
    verification,
    replayIssues: replay.issues,
    publishedBy: disclosure.publishedBy,
    publishedAt: disclosure.publishedAt,
  });
  if (
    disclosure.organizationId !== packet.organizationId ||
    disclosure.packetId !== packet.id ||
    disclosure.packetHash !== packet.packetHash ||
    disclosure.packetRoot !== packet.packetRoot ||
    disclosure.verificationId !== verification.id ||
    disclosure.verificationRoot !== verification.verificationRoot ||
    disclosure.policyId !== "canopyproof_policy_partner_accountability_disclosure_v1"
  ) {
    throw new Error(`CanopyProof partner snapshot accountability disclosure has invalid source lineage: ${disclosure.id}`);
  }
  if (
    disclosure.auditEvent.action !== "FULFILL" ||
    disclosure.auditEvent.entityType !== "data_access_accountability_disclosure" ||
    disclosure.auditEvent.entityId !== disclosure.id ||
    disclosure.auditEvent.actor !== disclosure.publishedBy ||
    disclosure.auditEvent.createdAt !== disclosure.publishedAt
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure has invalid semantic event binding: ${disclosure.id}`,
    );
  }
  if (hashJson(disclosure.safety) !== hashJson(dataAccessAccountabilityDisclosureSafetyBoundary())) {
    throw new Error(`CanopyProof partner snapshot accountability disclosure has an invalid safety boundary: ${disclosure.id}`);
  }
  const disclosureSeed = {
    organizationId: disclosure.organizationId,
    packetId: disclosure.packetId,
    packetHash: disclosure.packetHash,
    packetRoot: disclosure.packetRoot,
    verificationId: disclosure.verificationId,
    verificationRoot: disclosure.verificationRoot,
    policyId: disclosure.policyId,
    publishedBy: disclosure.publishedBy,
    publishedAt: disclosure.publishedAt,
    safety: disclosure.safety,
  };
  const expectedDisclosureHash = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-v1",
    ...disclosureSeed,
  });
  const expectedDisclosureRoot = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-root-v1",
    disclosureHash: expectedDisclosureHash,
    packetRoot: packet.packetRoot,
    verificationRoot: verification.verificationRoot,
  });
  const expectedPayloadHash = hashJson({
    ...disclosureSeed,
    disclosureHash: expectedDisclosureHash,
    disclosureRoot: expectedDisclosureRoot,
  });
  if (
    disclosure.id !== `cp_data_access_disclosure_${expectedDisclosureHash.slice(0, 24)}` ||
    disclosure.disclosureHash !== expectedDisclosureHash ||
    disclosure.disclosureRoot !== expectedDisclosureRoot ||
    disclosure.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(`CanopyProof partner snapshot accountability disclosure hash lineage is invalid: ${disclosure.id}`);
  }
}

function assertDataAccessAccountabilityDisclosureChallengeSnapshotIntegrity(input: Readonly<{
  disclosure: CanopyProofDataAccessAccountabilityDisclosure;
  challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge;
}>) {
  const { disclosure, challenge } = input;
  if (
    challenge.organizationId !== disclosure.organizationId ||
    challenge.disclosureId !== disclosure.id ||
    challenge.disclosureRoot !== disclosure.disclosureRoot ||
    Date.parse(challenge.challengedAt) < Date.parse(disclosure.publishedAt)
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure challenge has invalid publication lineage: ${challenge.id}`,
    );
  }
  assertSafePartnerText([challenge.statement]);
  assertNoRawDataAccessMaterial([challenge.statement]);
  if (
    challenge.evidenceEventRoots.length < 1 ||
    challenge.evidenceEventRoots.length > 128 ||
    challenge.evidenceEventRoots.some((root) => !/^[a-f0-9]{64}$/.test(root)) ||
    JSON.stringify(challenge.evidenceEventRoots) !==
      JSON.stringify([...new Set(challenge.evidenceEventRoots)].sort())
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure challenge has invalid evidence roots: ${challenge.id}`,
    );
  }
  if (
    challenge.auditEvent.action !== "CHALLENGE" ||
    challenge.auditEvent.entityType !== "data_access_accountability_disclosure_challenge" ||
    challenge.auditEvent.entityId !== challenge.id ||
    challenge.auditEvent.actor !== challenge.challengedBy ||
    challenge.auditEvent.createdAt !== challenge.challengedAt
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure challenge has invalid semantic event binding: ${challenge.id}`,
    );
  }
  if (hashJson(challenge.safety) !== hashJson(dataAccessAccountabilityDisclosureChallengeSafetyBoundary())) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure challenge has an invalid safety boundary: ${challenge.id}`,
    );
  }
  const challengeSeed = {
    organizationId: challenge.organizationId,
    disclosureId: challenge.disclosureId,
    disclosureRoot: challenge.disclosureRoot,
    reason: challenge.reason,
    statement: challenge.statement,
    evidenceEventRoots: challenge.evidenceEventRoots,
    challengedBy: challenge.challengedBy,
    challengerRole: challenge.challengerRole,
    challengedAt: challenge.challengedAt,
    safety: challenge.safety,
  };
  const expectedChallengeHash = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-challenge-v1",
    ...challengeSeed,
  });
  const expectedChallengeRoot = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-challenge-root-v1",
    challengeHash: expectedChallengeHash,
    disclosureRoot: disclosure.disclosureRoot,
    evidenceEventRoots: challenge.evidenceEventRoots,
  });
  const expectedPayloadHash = hashJson({
    ...challengeSeed,
    challengeHash: expectedChallengeHash,
    challengeRoot: expectedChallengeRoot,
  });
  if (
    challenge.id !== `cp_data_access_disclosure_challenge_${expectedChallengeHash.slice(0, 24)}` ||
    challenge.challengeHash !== expectedChallengeHash ||
    challenge.challengeRoot !== expectedChallengeRoot ||
    challenge.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure challenge hash lineage is invalid: ${challenge.id}`,
    );
  }
}

function assertDataAccessAccountabilityDisclosureResolutionSnapshotIntegrity(input: Readonly<{
  disclosure: CanopyProofDataAccessAccountabilityDisclosure;
  challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge;
  resolution: CanopyProofDataAccessAccountabilityDisclosureResolution;
  previousResolution?: CanopyProofDataAccessAccountabilityDisclosureResolution;
}>) {
  const { disclosure, challenge, resolution, previousResolution } = input;
  assertDataAccessAccountabilityDisclosureResolutionEligible({
    challenge,
    disclosure,
    ...(previousResolution ? { previousResolution } : {}),
    decision: resolution.decision,
    remedialAction: resolution.remedialAction,
    reviewedBy: resolution.reviewedBy,
    reviewedAt: resolution.reviewedAt,
  });
  if (
    resolution.organizationId !== disclosure.organizationId ||
    resolution.disclosureId !== disclosure.id ||
    resolution.challengeId !== challenge.id
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure resolution has invalid source lineage: ${resolution.id}`,
    );
  }
  assertSafePartnerText([resolution.rationale]);
  assertNoRawDataAccessMaterial([resolution.rationale]);
  if (
    resolution.evidenceEventRoots.length < 1 ||
    resolution.evidenceEventRoots.length > 128 ||
    resolution.evidenceEventRoots.some((root) => !/^[a-f0-9]{64}$/.test(root)) ||
    JSON.stringify(resolution.evidenceEventRoots) !==
      JSON.stringify([...new Set(resolution.evidenceEventRoots)].sort())
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure resolution has invalid evidence roots: ${resolution.id}`,
    );
  }
  const expectedAction =
    resolution.decision === "dismissed" ? "ASSERT" : resolution.decision === "upheld" ? "FULFILL" : "REASON";
  if (
    resolution.auditEvent.action !== expectedAction ||
    resolution.auditEvent.entityType !== "data_access_accountability_disclosure_resolution" ||
    resolution.auditEvent.entityId !== resolution.id ||
    resolution.auditEvent.actor !== resolution.reviewedBy ||
    resolution.auditEvent.createdAt !== resolution.reviewedAt
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure resolution has invalid semantic event binding: ${resolution.id}`,
    );
  }
  if (hashJson(resolution.safety) !== hashJson(dataAccessAccountabilityDisclosureResolutionSafetyBoundary())) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure resolution has an invalid safety boundary: ${resolution.id}`,
    );
  }
  const resolutionSeed = {
    organizationId: resolution.organizationId,
    disclosureId: resolution.disclosureId,
    challengeId: resolution.challengeId,
    decision: resolution.decision,
    remedialAction: resolution.remedialAction,
    rationale: resolution.rationale,
    evidenceEventRoots: resolution.evidenceEventRoots,
    ...(previousResolution
      ? { previousResolutionId: previousResolution.id, previousResolutionRoot: previousResolution.resolutionRoot }
      : {}),
    reviewedBy: resolution.reviewedBy,
    reviewerRole: resolution.reviewerRole,
    reviewedAt: resolution.reviewedAt,
    previousResolutionRoot: previousResolution?.resolutionRoot ?? null,
    safety: resolution.safety,
  };
  const expectedResolutionHash = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-resolution-v1",
    ...resolutionSeed,
  });
  const expectedResolutionRoot = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-resolution-root-v1",
    resolutionHash: expectedResolutionHash,
    challengeRoot: challenge.challengeRoot,
    evidenceEventRoots: resolution.evidenceEventRoots,
    previousResolutionRoot: previousResolution?.resolutionRoot ?? null,
  });
  const expectedPayloadHash = hashJson({
    ...resolutionSeed,
    resolutionHash: expectedResolutionHash,
    resolutionRoot: expectedResolutionRoot,
  });
  if (
    resolution.id !== `cp_data_access_disclosure_resolution_${expectedResolutionHash.slice(0, 24)}` ||
    resolution.resolutionHash !== expectedResolutionHash ||
    resolution.resolutionRoot !== expectedResolutionRoot ||
    resolution.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure resolution hash lineage is invalid: ${resolution.id}`,
    );
  }
}

function assertDataAccessAccountabilityDisclosureNoticeSnapshotIntegrity(input: Readonly<{
  disclosure: CanopyProofDataAccessAccountabilityDisclosure;
  challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge;
  resolution: CanopyProofDataAccessAccountabilityDisclosureResolution;
  latestResolution?: CanopyProofDataAccessAccountabilityDisclosureResolution;
  replacementDisclosure?: CanopyProofDataAccessAccountabilityDisclosureView;
  notice: CanopyProofDataAccessAccountabilityDisclosureNotice;
}>) {
  const { disclosure, challenge, resolution, latestResolution, replacementDisclosure, notice } = input;
  assertDataAccessAccountabilityDisclosureNoticeEligible({
    disclosure,
    challenge,
    resolution,
    ...(latestResolution ? { latestResolution } : {}),
    ...(replacementDisclosure ? { replacementDisclosure } : {}),
    noticeType: notice.noticeType,
    publishedBy: notice.publishedBy,
    publishedAt: notice.publishedAt,
    noticeAlreadyExists: false,
  });
  if (
    notice.organizationId !== disclosure.organizationId ||
    notice.disclosureId !== disclosure.id ||
    notice.challengeId !== challenge.id ||
    notice.resolutionId !== resolution.id ||
    notice.replacementDisclosureId !== replacementDisclosure?.id
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure notice has invalid source lineage: ${notice.id}`,
    );
  }
  assertSafePartnerText([notice.statement]);
  assertNoRawDataAccessMaterial([notice.statement]);
  if (
    notice.evidenceEventRoots.length < 1 ||
    notice.evidenceEventRoots.length > 128 ||
    notice.evidenceEventRoots.some((root) => !/^[a-f0-9]{64}$/.test(root)) ||
    JSON.stringify(notice.evidenceEventRoots) !== JSON.stringify([...new Set(notice.evidenceEventRoots)].sort())
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure notice has invalid evidence roots: ${notice.id}`,
    );
  }
  if (
    notice.auditEvent.action !== "FULFILL" ||
    notice.auditEvent.entityType !== "data_access_accountability_disclosure_notice" ||
    notice.auditEvent.entityId !== notice.id ||
    notice.auditEvent.actor !== notice.publishedBy ||
    notice.auditEvent.createdAt !== notice.publishedAt
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure notice has invalid semantic event binding: ${notice.id}`,
    );
  }
  if (hashJson(notice.safety) !== hashJson(dataAccessAccountabilityDisclosureNoticeSafetyBoundary())) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure notice has an invalid safety boundary: ${notice.id}`,
    );
  }
  const noticeSeed = {
    organizationId: notice.organizationId,
    disclosureId: notice.disclosureId,
    challengeId: notice.challengeId,
    resolutionId: notice.resolutionId,
    resolutionRoot: resolution.resolutionRoot,
    noticeType: notice.noticeType,
    replacementDisclosureId: replacementDisclosure?.id ?? null,
    replacementDisclosureRoot: replacementDisclosure?.disclosureRoot ?? null,
    statement: notice.statement,
    evidenceEventRoots: notice.evidenceEventRoots,
    publishedBy: notice.publishedBy,
    publisherRole: notice.publisherRole,
    publishedAt: notice.publishedAt,
    safety: notice.safety,
  };
  const expectedNoticeHash = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-notice-v1",
    ...noticeSeed,
  });
  const expectedNoticeRoot = hashJson({
    kind: "canopyproof-data-access-accountability-disclosure-notice-root-v1",
    noticeHash: expectedNoticeHash,
    disclosureRoot: disclosure.disclosureRoot,
    resolutionRoot: resolution.resolutionRoot,
    replacementDisclosureRoot: replacementDisclosure?.disclosureRoot ?? null,
    evidenceEventRoots: notice.evidenceEventRoots,
  });
  const expectedPayloadHash = hashJson({
    ...noticeSeed,
    noticeHash: expectedNoticeHash,
    noticeRoot: expectedNoticeRoot,
  });
  if (
    notice.id !== `cp_data_access_disclosure_notice_${expectedNoticeHash.slice(0, 24)}` ||
    notice.noticeHash !== expectedNoticeHash ||
    notice.noticeRoot !== expectedNoticeRoot ||
    notice.auditEvent.payloadHash !== expectedPayloadHash
  ) {
    throw new Error(
      `CanopyProof partner snapshot accountability disclosure notice hash lineage is invalid: ${notice.id}`,
    );
  }
}

function assertDataAccessDecisionTiming(input: Readonly<{
  request: CanopyProofDataAccessRequest;
  agreement: CanopyProofDataSharingAgreement;
  status: Exclude<CanopyProofDataAccessRequestStatus, "pending">;
  decidedAt: string;
}>) {
  const decidedAt = Date.parse(input.decidedAt);
  if (decidedAt < Date.parse(input.request.requestedAt)) {
    throw new Error("CanopyProof data access decision cannot predate the request.");
  }
  if (input.status === "approved") {
    if (input.agreement.revoked || input.agreement.superseded) {
      throw new Error("CanopyProof data access approval requires an active data-sharing agreement.");
    }
    if (input.agreement.expiresAt && decidedAt >= Date.parse(input.agreement.expiresAt)) {
      throw new Error("CanopyProof data access approval cannot use an expired data-sharing agreement.");
    }
    if (input.request.expiresAt && decidedAt >= Date.parse(input.request.expiresAt)) {
      throw new Error("CanopyProof data access approval cannot approve an expired request.");
    }
  }
  if (input.status === "expired") {
    const expiryTimes = [input.request.expiresAt, input.agreement.expiresAt]
      .filter((value): value is string => Boolean(value))
      .map((value) => Date.parse(value));
    if (expiryTimes.length === 0 || decidedAt < Math.min(...expiryTimes)) {
      throw new Error("CanopyProof data access expiration requires a reached request or agreement expiry boundary.");
    }
  }
}

function assertDataAccessDecisionTransition(previous: CanopyProofDataAccessRequestStatus, next: Exclude<CanopyProofDataAccessRequestStatus, "pending">) {
  if (previous === "pending" && (next === "approved" || next === "denied" || next === "expired")) return;
  if (previous === "approved" && (next === "revoked" || next === "expired")) return;
  throw new Error(`CanopyProof data access request cannot transition from ${previous} to ${next}.`);
}

function assertDataAccessDeliveryEligible(input: Readonly<{
  request: CanopyProofDataAccessRequest;
  agreement: CanopyProofDataSharingAgreement;
  organizationId: string;
  manifestRequesterOrganizationId: string;
  manifestClassification: "public" | "internal" | "restricted" | "confidential";
  deliveredAt: string;
}>) {
  if (input.request.organizationId !== input.organizationId) {
    throw new Error("CanopyProof data access delivery must belong to the request organization.");
  }
  if (input.request.agreementId !== input.agreement.id || input.agreement.organizationId !== input.organizationId) {
    throw new Error("CanopyProof data access delivery must remain bound to the original data-sharing agreement.");
  }
  if (input.agreement.revoked) {
    throw new Error("CanopyProof data access delivery cannot use a revoked data-sharing agreement.");
  }
  if (input.agreement.superseded) {
    throw new Error("CanopyProof data access delivery cannot use a superseded data-sharing agreement.");
  }
  if (input.request.status !== "approved") {
    throw new Error("CanopyProof data access delivery requires an approved data access request.");
  }
  if (!input.request.decidedAt || Date.parse(input.deliveredAt) < Date.parse(input.request.decidedAt)) {
    throw new Error("CanopyProof data access delivery cannot predate request approval.");
  }
  if (Date.parse(input.deliveredAt) < Date.parse(input.request.requestedAt)) {
    throw new Error("CanopyProof data access delivery cannot predate its data access request.");
  }
  if (input.request.expiresAt && Date.parse(input.request.expiresAt) <= Date.parse(input.deliveredAt)) {
    throw new Error("CanopyProof data access delivery cannot use an expired data access request.");
  }
  if (Date.parse(input.deliveredAt) < Date.parse(input.agreement.createdAt)) {
    throw new Error("CanopyProof data access delivery cannot predate its data-sharing agreement.");
  }
  if (input.agreement.expiresAt && Date.parse(input.agreement.expiresAt) <= Date.parse(input.deliveredAt)) {
    throw new Error("CanopyProof data access delivery cannot use an expired data-sharing agreement.");
  }
  if (input.manifestRequesterOrganizationId !== input.organizationId) {
    throw new Error("CanopyProof data access delivery manifest must belong to the approved request organization.");
  }
  if (exportClassificationRank(input.manifestClassification) > privacyTierRank(input.request.privacyTier)) {
    throw new Error("CanopyProof data access delivery manifest classification exceeds the approved request privacy tier.");
  }
}

function assertDataUseAttestationEligible(input: Readonly<{
  delivery: CanopyProofDataAccessDeliveryReceipt;
  request: CanopyProofDataAccessRequest;
  agreement: CanopyProofDataSharingAgreement;
  usageState: CanopyProofDataUseAttestationState;
  actorId: string;
  attestedAt: string;
}>) {
  if (input.delivery.requestId !== input.request.id) {
    throw new Error("CanopyProof data-use attestation must bind to the delivery request.");
  }
  if (Date.parse(input.attestedAt) < Date.parse(input.delivery.deliveredAt)) {
    throw new Error("CanopyProof data-use attestation cannot predate its delivery receipt.");
  }
  if (
    (input.usageState === "within_scope" || input.usageState === "no_use") &&
    input.actorId !== input.delivery.recipientActorId
  ) {
    throw new Error("CanopyProof positive and no-use attestations require the named delivery recipient.");
  }
  if (input.usageState === "within_scope") {
    if (input.request.status !== "approved") {
      throw new Error("CanopyProof within-scope data use requires an approved data access request.");
    }
    if (input.request.expiresAt && Date.parse(input.attestedAt) >= Date.parse(input.request.expiresAt)) {
      throw new Error("CanopyProof within-scope data use cannot use an expired data access request.");
    }
    if (input.agreement.revoked || input.agreement.superseded) {
      throw new Error("CanopyProof within-scope data use requires an active data-sharing agreement.");
    }
    if (input.agreement.expiresAt && Date.parse(input.attestedAt) >= Date.parse(input.agreement.expiresAt)) {
      throw new Error("CanopyProof within-scope data use cannot use an expired data-sharing agreement.");
    }
    if (input.delivery.safety.rawDataNotEmbedded !== true) {
      throw new Error("CanopyProof data-use attestation requires a no-raw-data delivery receipt.");
    }
  }
}

function assertDataUseAttestationEvidence(input: Readonly<{
  usageState: CanopyProofDataUseAttestationState;
  outputHashes: readonly string[];
  evidenceEventRoots: readonly string[];
}>) {
  if (input.usageState === "within_scope" && input.outputHashes.length === 0) {
    throw new Error("CanopyProof within-scope data-use attestation requires at least one output hash.");
  }
  if (input.usageState === "no_use" && input.outputHashes.length > 0) {
    throw new Error("CanopyProof no-use data-use attestation cannot include output hashes.");
  }
  if ((input.usageState === "misuse_challenged" || input.usageState === "revocation_requested") && input.evidenceEventRoots.length === 0) {
    throw new Error("CanopyProof challenged data-use attestation requires at least one evidence event root.");
  }
}

function assertDataUseEnforcementEligible(input: Readonly<{
  attestation: CanopyProofDataUseAttestation;
  delivery: CanopyProofDataAccessDeliveryReceipt;
  request: CanopyProofDataAccessRequest;
  actorId: string;
  reviewedAt: string;
  evidenceEventRoots: readonly string[];
}>) {
  if (input.attestation.deliveryId !== input.delivery.id || input.attestation.requestId !== input.request.id) {
    throw new Error("CanopyProof data-use enforcement case must bind to the attestation delivery and request.");
  }
  if (input.attestation.usageState !== "misuse_challenged" && input.attestation.usageState !== "revocation_requested") {
    throw new Error("CanopyProof data-use enforcement cases require a challenged or revocation-requested attestation.");
  }
  if (
    input.attestation.attestedBy === input.actorId ||
    input.delivery.recipientActorId === input.actorId ||
    input.delivery.deliveredBy === input.actorId
  ) {
    throw new Error("CanopyProof data-use enforcement cases require an independent human reviewer separate from the attester, recipient, and delivery actor.");
  }
  if (Date.parse(input.reviewedAt) < Date.parse(input.attestation.attestedAt)) {
    throw new Error("CanopyProof data-use enforcement review cannot predate its challenged attestation.");
  }
  if (input.evidenceEventRoots.length === 0) {
    throw new Error("CanopyProof data-use enforcement cases require at least one evidence event root.");
  }
  if (!isSubset(input.attestation.evidenceEventRoots, input.evidenceEventRoots)) {
    throw new Error("CanopyProof data-use enforcement case must retain every challenged attestation evidence root.");
  }
}

function assertDataUseEnforcementAction(input: Readonly<{
  caseState: CanopyProofDataUseEnforcementState;
  enforcementAction: CanopyProofDataUseEnforcementAction;
}>) {
  const allowedActionsByState: Record<CanopyProofDataUseEnforcementState, readonly CanopyProofDataUseEnforcementAction[]> = {
    opened: ["notify_partner", "legal_hold"],
    under_review: ["notify_partner", "legal_hold"],
    action_required: ["notify_partner", "require_remediation", "legal_hold"],
    access_suspended: ["suspend_data_access", "legal_hold"],
    access_revoked: ["revoke_data_access", "legal_hold"],
    remediation_required: ["require_remediation", "notify_partner"],
    resolved: ["notify_partner", "require_remediation"],
    rejected: ["notify_partner"],
  };
  if (!allowedActionsByState[input.caseState].includes(input.enforcementAction)) {
    throw new Error(`CanopyProof data-use enforcement action ${input.enforcementAction} is not valid for state ${input.caseState}.`);
  }
}

function assertDataAccessRestrictionEligible(input: Readonly<{
  enforcementCase: CanopyProofDataUseEnforcementCase;
  attestation: CanopyProofDataUseAttestation;
  delivery: CanopyProofDataAccessDeliveryReceipt;
  request: CanopyProofDataAccessRequest;
  restrictionState: CanopyProofDataAccessRestrictionState;
  actorId: string;
  decidedAt: string;
  expiresAt?: string;
  evidenceEventRoots: readonly string[];
  currentRestriction?: CanopyProofDataAccessRestriction;
}>) {
  if (
    input.enforcementCase.attestationId !== input.attestation.id ||
    input.enforcementCase.deliveryId !== input.delivery.id ||
    input.enforcementCase.requestId !== input.request.id
  ) {
    throw new Error("CanopyProof data access restriction must bind to the enforcement case lineage.");
  }
  if (
    input.actorId === input.enforcementCase.reviewerId ||
    input.actorId === input.attestation.attestedBy ||
    input.actorId === input.delivery.recipientActorId ||
    input.actorId === input.delivery.deliveredBy
  ) {
    throw new Error("CanopyProof data access restrictions require a separate independent approval actor.");
  }
  if (Date.parse(input.decidedAt) < Date.parse(input.enforcementCase.reviewedAt)) {
    throw new Error("CanopyProof data access restriction decision cannot predate its enforcement review.");
  }
  if (input.expiresAt && Date.parse(input.expiresAt) <= Date.parse(input.decidedAt)) {
    throw new Error("CanopyProof data access restriction expiry must follow its decision time.");
  }
  if (input.restrictionState === "restored" && input.expiresAt) {
    throw new Error("CanopyProof restored data access restrictions cannot carry an expiry timer.");
  }
  if (input.evidenceEventRoots.length === 0) {
    throw new Error("CanopyProof data access restrictions require at least one evidence event root.");
  }
  if (!isSubset(input.enforcementCase.evidenceEventRoots, input.evidenceEventRoots)) {
    throw new Error("CanopyProof data access restriction must retain every enforcement evidence root.");
  }
  if (
    input.restrictionState === "remediation_hold" &&
    !(
      (input.enforcementCase.caseState === "action_required" || input.enforcementCase.caseState === "remediation_required") &&
      input.enforcementCase.enforcementAction === "require_remediation"
    )
  ) {
    throw new Error("CanopyProof remediation holds require a remediation enforcement disposition.");
  }
  if (
    input.restrictionState === "suspended" &&
    !(
      input.enforcementCase.caseState === "access_suspended" &&
      input.enforcementCase.enforcementAction === "suspend_data_access"
    )
  ) {
    throw new Error("CanopyProof suspended access restrictions require a suspension enforcement disposition.");
  }
  if (
    input.restrictionState === "revoked" &&
    !(
      input.enforcementCase.caseState === "access_revoked" &&
      input.enforcementCase.enforcementAction === "revoke_data_access"
    )
  ) {
    throw new Error("CanopyProof revoked access restrictions require a revocation enforcement disposition.");
  }
  if (input.restrictionState === "restored") {
    if (input.enforcementCase.caseState !== "resolved") {
      throw new Error("CanopyProof restored access restrictions require a resolved enforcement disposition.");
    }
    if (!input.currentRestriction || input.currentRestriction.restrictionState === "restored") {
      throw new Error("CanopyProof restored access restrictions require an active prior restriction.");
    }
    if (input.actorId === input.currentRestriction.decidedBy) {
      throw new Error("CanopyProof restored access restrictions require an actor independent from the prior restriction decision.");
    }
  }
  if (input.currentRestriction && Date.parse(input.decidedAt) < Date.parse(input.currentRestriction.decidedAt)) {
    throw new Error("CanopyProof data access restriction decision cannot move behind its predecessor.");
  }
  if (
    input.currentRestriction &&
    Date.parse(input.enforcementCase.reviewedAt) < Date.parse(input.currentRestriction.decidedAt)
  ) {
    throw new Error("CanopyProof data access restriction successor requires a later enforcement review.");
  }
  if (!isDataAccessRestrictionTransitionAllowed(input.currentRestriction?.restrictionState, input.restrictionState)) {
    throw new Error("CanopyProof data access restriction state transition is invalid.");
  }
}

function isDataAccessRestrictionTransitionAllowed(
  previous: CanopyProofDataAccessRestrictionState | undefined,
  next: CanopyProofDataAccessRestrictionState,
) {
  if (!previous) return next === "remediation_hold" || next === "suspended" || next === "revoked";
  if (previous === "remediation_hold") return next === "suspended" || next === "revoked" || next === "restored";
  if (previous === "suspended") return next === "revoked" || next === "restored";
  if (previous === "revoked") return next === "restored";
  return next === "remediation_hold" || next === "suspended" || next === "revoked";
}

function isSubset(requested: readonly string[], allowed: readonly string[]) {
  const allowedSet = new Set(allowed.map((value) => value.trim()));
  return requested.every((value) => allowedSet.has(value.trim()));
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && isSubset(left, right) && isSubset(right, left);
}

function privacyTierRank(tier: CanopyProofDataSharingAgreement["privacyTier"]) {
  return { public: 1, restricted: 2, confidential: 3 }[tier];
}

function exportClassificationRank(classification: "public" | "internal" | "restricted" | "confidential") {
  return { public: 1, internal: 2, restricted: 2, confidential: 3 }[classification];
}

function normalizeHash(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function normalizeHashes(values: readonly string[]) {
  return [...new Set(values.map(normalizeHash))].sort();
}

function assertNoRawDataAccessMaterial(values: readonly string[]) {
  const unsafePatterns = [
    /\b(?:BEGIN|END)\s+(?:RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY\b/i,
    /\bprivate[_\s-]?key\b/i,
    /\b(?:api|access|client)?[_\s-]?secret\b/i,
    /\bpassword\b/i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b\+?\d[\d\s().-]{7,}\d\b/,
  ];
  for (const value of values) {
    for (const pattern of unsafePatterns) {
      if (pattern.test(value)) {
        throw new Error("CanopyProof data access requests cannot embed raw private contact, key, or secret material.");
      }
    }
  }
}
