import { Prisma, type PrismaClient } from "@prisma/client";
import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  CanopyProofAuditExportManifestService,
  canopyProofAuditExportClassifications,
  canopyProofAuditExportEntryTypes,
  canopyProofAuditExportManifestKinds,
  canopyProofAuditExportRedactionPolicies,
  canopyProofAuditExportScopes,
  type CanopyProofAuditExportClassification,
  type CanopyProofAuditExportEntry,
  type CanopyProofAuditExportManifest,
  type CanopyProofAuditExportScope,
} from "./audit-export-manifests.js";
import {
  CanopyProofIdentityService,
  canopyProofIdentityParticipantTypes,
  canopyProofIdentityReputationSources,
  canopyProofIdentityRoles,
  canopyProofIdentityVerificationStatuses,
  type CanopyProofIdentityParticipant,
  type CanopyProofIdentityReputationSnapshot,
} from "./identity.js";
import {
  CanopyProofPartnerService,
  canopyProofOrganizationTypes,
  canopyProofOrganizationTrustLevels,
  canopyProofOrganizationVerificationStatuses,
  canopyProofDataAccessDeliveryChannels,
  canopyProofDataAccessAccountabilityIssueCodes,
  canopyProofDataAccessAccountabilityDisclosureChallengeReasons,
  canopyProofDataAccessAccountabilityDisclosureGovernanceStates,
  canopyProofDataAccessAccountabilityDisclosureNoticeTypes,
  canopyProofDataAccessAccountabilityDisclosureRemedialActions,
  canopyProofDataAccessAccountabilityDisclosureResolutionDecisions,
  canopyProofDataAccessAccountabilityDisclosureStates,
  canopyProofDataAccessRestrictionStates,
  canopyProofDataUseAttestationStates,
  canopyProofDataUseEnforcementActions,
  canopyProofDataUseEnforcementStates,
  canopyProofPartnerRoles,
  type CanopyProofAccreditation,
  type CanopyProofDataAccessAccountabilityPacket,
  type CanopyProofDataAccessAccountabilityDisclosure,
  type CanopyProofDataAccessAccountabilityDisclosureChallenge,
  type CanopyProofDataAccessAccountabilityDisclosureNotice,
  type CanopyProofDataAccessAccountabilityDisclosureResolution,
  type CanopyProofDataAccessAccountabilityDisclosureGovernanceState,
  type CanopyProofDataAccessAccountabilityDisclosureState,
  type CanopyProofDataAccessAccountabilityDisclosureView,
  type CanopyProofDataAccessAccountabilityVerification,
  type CanopyProofDataAccessDeliveryReceipt,
  type CanopyProofDataAccessRestriction,
  type CanopyProofDataAccessRequest,
  type CanopyProofDataAccessRequestDecision,
  type CanopyProofDataUseAttestation,
  type CanopyProofDataUseEnforcementCase,
  type CanopyProofDataSharingAgreement,
  type CanopyProofDataSharingAgreementRevocation,
  type CanopyProofDataSharingAgreementSupersession,
  type CanopyProofMembership,
  type CanopyProofOrganizationDocument,
  type CanopyProofOrganizationProfile,
  type CanopyProofPartnerAuthoritySnapshot,
} from "./partner-collaboration.js";
import {
  canopyAiCapabilities,
  canopyProofAuditEntityTypes,
  canopyProofEvidenceTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
  type CanopyProofEvidenceType,
} from "./proof-engine.js";
import {
  CanopyProofProjectRegistryService,
  canopyProofProjectMonitoringEventTypes,
  canopyProofProjectMonitoringStates,
  canopyProofProjectStatuses,
  canopyProofProjectTypes,
  type CanopyProofProjectAuthoritySnapshot,
  type CanopyProofProjectClaimBoundary,
  type CanopyProofProjectMonitoringEvent,
  type CanopyProofProjectMonitoringEventType,
  type CanopyProofProjectMonitoringState,
  type CanopyProofProjectProfile,
  type CanopyProofProjectRegistryStatus,
  type CanopyProofProjectStatus,
  type CanopyProofProjectStatusTransition,
  type CanopyProofProjectType,
} from "./project-registry.js";
import {
  CanopyProofEvidenceRegistryService,
  canopyProofEvidenceContributorRoles,
  canopyProofEvidenceRegistrationStatuses,
  canopyProofEvidenceValidationIssues,
  type CanopyProofEvidenceAuthoritySnapshot,
  type CanopyProofEvidenceClaimBoundary,
  type CanopyProofEvidenceContributorRole,
  type CanopyProofEvidenceRegistration,
  type CanopyProofEvidenceRegistrationStatus,
  type CanopyProofEvidenceRegistryStatus,
} from "./evidence-registry.js";
import {
  CanopyProofEvidenceVerificationAuthorityService,
  canopyProofAiRecommendations,
  canopyProofEvidenceChallengeReasons,
  canopyProofEvidenceChallengeResolutionDecisions,
  canopyProofEvidenceChallengeSeverities,
  canopyProofEvidenceCorrectionActions,
  canopyProofEvidenceFinalDecisionKinds,
  canopyProofEvidenceRelianceStates,
  canopyProofFindingDispositions,
  canopyProofHumanReviewDecisions,
  canopyProofValidationCheckStates,
  canopyProofValidationOutcomes,
  type CanopyProofAdvisoryAiAnalysis,
  type CanopyProofEvidenceChallenge,
  type CanopyProofEvidenceChallengeResolution,
  type CanopyProofEvidenceCorrection,
  type CanopyProofEvidenceFinalDecision,
  type CanopyProofEvidenceFinalVerification,
  type CanopyProofEvidenceHumanReview,
  type CanopyProofEvidenceReliance,
  type CanopyProofEvidenceValidationRun,
  type CanopyProofVerificationActorSnapshot,
} from "./evidence-verification-authority.js";
import {
  CanopyProofMethodologyGovernanceAuthorityService,
  canopyProofGovernedPolicyReviewerRoles,
  canopyProofGovernedPolicySubjects,
  canopyProofMethodologyPublicationDecisions,
  type CanopyProofGovernedPolicyAuthority,
  type CanopyProofGovernedPolicySubject,
  type CanopyProofMethodologyPublication,
  type CanopyProofMethodologyPublicationApproval,
} from "./methodology-governance-authority.js";
import {
  CanopyProofMethodologyRegistryService,
  canopyProofMethodologyDataSources,
  canopyProofMethodologyQualityGates,
  canopyProofMethodologyScopes,
  canopyProofMethodologyStatuses,
  type CanopyProofMethodology,
} from "./methodology-registry.js";
import {
  CanopyProofEnvironmentalProofAuthorityService,
  canopyProofEnvironmentalProofApprovalDecisions,
  type CanopyProofEnvironmentalProofCandidate,
  type CanopyProofEnvironmentalProofCandidateApproval,
  type CanopyProofEnvironmentalProofRecord,
} from "./environmental-proof-authority.js";
import {
  CanopyProofEnvironmentalProofChallengeAuthorityService,
  canopyProofEnvironmentalProofChallengeReasons,
  canopyProofEnvironmentalProofChallengeResolutionDecisions,
  canopyProofEnvironmentalProofChallengeReviewDecisions,
  canopyProofEnvironmentalProofChallengeSeverities,
  type CanopyProofEnvironmentalProofChallenge,
  type CanopyProofEnvironmentalProofChallengeBundle,
  type CanopyProofEnvironmentalProofChallengeResolution,
  type CanopyProofEnvironmentalProofChallengeReview,
  type CanopyProofEnvironmentalProofChallengeRiskSignal,
} from "./environmental-proof-challenge-authority.js";
import {
  CanopyProofEvidenceCustodyAuthorityService,
  canopyProofEvidenceConsentLawfulBases,
  canopyProofEvidenceConsentPrivacyModes,
  canopyProofEvidenceConsentPurposes,
  canopyProofEvidenceCustodyActorAuthorityRoot,
  canopyProofEvidenceCustodyRoles,
  canopyProofEvidenceDeviceAttestationProviders,
  canopyProofEvidenceDeviceAttestationTypes,
  canopyProofEvidenceDeviceRiskFlags,
  type CanopyProofEvidenceConsentProjection,
  type CanopyProofEvidenceConsentReceiptFact,
  type CanopyProofEvidenceConsentRevocationFact,
  type CanopyProofEvidenceCustodyActorSnapshot,
  type CanopyProofEvidenceCustodyRole,
  type CanopyProofEvidenceDeviceAttestationFact,
  type CanopyProofEvidenceDeviceAttestationProjection,
} from "./evidence-custody-authority.js";
import {
  assertCanopyProofMobileEvidenceBindingAuthority,
  type CanopyProofMobileEvidenceAtomicRegistrationResult,
  type CanopyProofMobileEvidenceBindingAuthorityRequirements,
} from "./mobile-evidence-sync-authority.js";
import {
  CanopyProofEvidenceMediaAuthorityService,
  canopyProofEvidenceMediaAgentAuthorityRoot,
  canopyProofEvidenceMediaAgentCapabilities,
  canopyProofEvidenceMediaContentTypes,
  canopyProofEvidenceMediaEncryptionModes,
  canopyProofEvidenceMediaObjectLockModes,
  canopyProofEvidenceMediaScanVerdicts,
  canopyProofEvidenceMediaStorageProviders,
  type CanopyProofEvidenceMediaAgentCapability,
  type CanopyProofEvidenceMediaAgentSnapshot,
  type CanopyProofEvidenceMediaAuthoritySnapshot,
  type CanopyProofEvidenceMediaDuplicateRelationFact,
  type CanopyProofEvidenceMediaObjectFact,
  type CanopyProofEvidenceMediaObjectProjection,
  type CanopyProofEvidenceMediaScanResultFact,
  type CanopyProofEvidenceMediaUploadIntentFact,
} from "./evidence-media-authority.js";
import {
  projectCanopyProofEffectiveMediaObject,
  projectCanopyProofEvidenceMediaAdapterTrust,
  buildCanopyProofEvidenceMediaProviderVerificationFact,
  buildCanopyProofEvidenceMediaScannerVerificationFact,
  type CanopyProofEffectiveMediaObjectProjection,
  type CanopyProofDurableMalwareScanReceipt,
  type CanopyProofEvidenceMediaAdapterTrustProjection,
  type CanopyProofEvidenceMediaProviderVerificationBundle,
  type CanopyProofEvidenceMediaProviderVerificationFact,
  type CanopyProofEvidenceMediaScannerVerificationBundle,
  type CanopyProofEvidenceMediaScannerVerificationFact,
} from "./evidence-media-adapter-authority.js";
import {
  assertCanopyProofDeviceAttestationVerificationFact,
  projectCanopyProofEffectiveDeviceAttestation,
  type CanopyProofDeviceAttestationVerificationFact,
  type CanopyProofEffectiveDeviceAttestationProjection,
} from "./evidence-device-attestation-adapter-authority.js";
import {
  validateCanopyProofStoredObjectReceipt,
  type CanopyProofAdapterVerifiedStoredObjectReceipt,
  type CanopyProofStoredObjectReceipt,
} from "./object-storage-adapter.js";
import {
  CanopyProofEvidenceMediaReviewAuthorityService,
  canopyProofEvidenceMediaCustodyActions,
  canopyProofEvidenceMediaCustodyArtifactTypes,
  canopyProofEvidenceMediaReviewDecisions,
  canopyProofEvidenceMediaReviewSeverities,
  type CanopyProofEvidenceMediaCustodyEventFact,
  type CanopyProofEvidenceMediaReviewAssignmentFact,
  type CanopyProofEvidenceMediaReviewAuthoritySnapshot,
  type CanopyProofEvidenceMediaReviewDecisionFact,
  type CanopyProofEvidenceMediaReviewTaskFact,
} from "./evidence-review-authority.js";
import {
  rebuildVisualEvidenceAuthoritySnapshot,
  verifyVisualEvidenceAuthoritySnapshot,
  visualAuthorityRecords,
  visualEvidenceAuditGenesisRoot,
  type CanopyProofVisualEvidenceAuthoritySnapshot,
} from "./visual-evidence-intelligence.js";
import type {
  CandidateFinding,
  DatasetSnapshot,
  ReviewQueueSnapshot,
  VisualAuthorityActor,
  VisualRecordEnvelope,
} from "./visual-evidence-types.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";

const canopyProofTrustCommandMaxAttempts = 8;

export const canopyProofTrustRegistryErrorCodes = [
  "CANOPYPROOF_IDEMPOTENCY_REQUIRED",
  "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
  "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE",
] as const;

export type CanopyProofTrustRegistryErrorCode = (typeof canopyProofTrustRegistryErrorCodes)[number];

export type CanopyProofTrustRegistryStatus = {
  readonly service: "canopyproof-trust-registry";
  readonly storage: "postgresql";
  readonly transactional: true;
  readonly identityWritesDurable: true;
  readonly organizationAuthorityWritesDurable: true;
  readonly dataSharingAgreementWritesDurable: true;
  readonly dataAccessRequestWritesDurable: true;
  readonly dataAccessDeliveryReceiptWritesDurable: true;
  readonly dataUseAttestationWritesDurable: true;
  readonly dataUseEnforcementCaseWritesDurable: true;
  readonly dataAccessRestrictionWritesDurable: true;
  readonly dataAccessAccountabilityPacketWritesDurable: true;
  readonly dataAccessAccountabilityVerificationWritesDurable: true;
  readonly dataAccessAccountabilityDisclosureWritesDurable: true;
  readonly dataAccessAccountabilityDisclosureChallengeWritesDurable: true;
  readonly dataAccessAccountabilityDisclosureResolutionWritesDurable: true;
  readonly dataAccessAccountabilityDisclosureNoticeWritesDurable: true;
  readonly auditExportManifestWritesDurable: true;
  readonly projectLifecycleWritesDurable: true;
  readonly evidenceRegistrationWritesDurable: true;
  readonly mobileEvidenceBindingWritesDurable: true;
  readonly evidenceConsentReceiptWritesDurable: true;
  readonly evidenceConsentRevocationWritesDurable: true;
  readonly evidenceDeviceAttestationWritesDurable: true;
  readonly evidenceMediaUploadIntentWritesDurable: true;
  readonly evidenceMediaObjectWritesDurable: true;
  readonly evidenceMediaDuplicateRelationWritesDurable: true;
  readonly evidenceMediaScanResultWritesDurable: true;
  readonly evidenceMediaProviderReceiptVerificationWritesDurable: true;
  readonly evidenceMediaScannerReceiptVerificationWritesDurable: true;
  readonly evidenceMediaAdapterRoutesMounted: false;
  readonly evidenceMediaReviewTaskWritesDurable: true;
  readonly evidenceMediaReviewAssignmentWritesDurable: true;
  readonly evidenceMediaReviewDecisionWritesDurable: true;
  readonly evidenceMediaCustodyEventWritesDurable: true;
  readonly visualEvidenceAuthorityWritesDurable: true;
  readonly evidenceVerificationWritesDurable: true;
  readonly evidenceChallengeCorrectionWritesDurable: true;
  readonly evidenceFinalDecisionWritesDurable: true;
  readonly governedPolicyWritesDurable: true;
  readonly methodologyVersionWritesDurable: true;
  readonly methodologyPublicationWritesDurable: true;
  readonly environmentalProofCandidateWritesDurable: true;
  readonly environmentalProofApprovalWritesDurable: true;
  readonly environmentalProofRecordWritesDurable: true;
  readonly environmentalProofChallengeWritesDurable: true;
  readonly environmentalProofChallengeRiskWritesDurable: true;
  readonly environmentalProofChallengeReviewWritesDurable: true;
  readonly environmentalProofChallengeResolutionWritesDurable: true;
  readonly semanticAuditAppendOnly: true;
  readonly databaseAuditEnabled: true;
  readonly idempotencyRequired: true;
  readonly privateKeyHandlingDisabled: true;
};

export type CanopyProofTrustRegistryConfigurationStatus = {
  readonly service: "canopyproof-trust-registry-configuration";
  readonly mode: "postgresql" | "development_memory";
  readonly production: boolean;
  readonly configured: boolean;
  readonly authorityCommandsDurable: true;
  readonly dataSharingAgreementCommandsDurable: true;
  readonly dataAccessRequestCommandsDurable: true;
  readonly dataAccessDeliveryReceiptCommandsDurable: true;
  readonly dataUseAttestationCommandsDurable: true;
  readonly dataUseEnforcementCaseCommandsDurable: true;
  readonly dataAccessRestrictionCommandsDurable: true;
  readonly dataAccessAccountabilityPacketCommandsDurable: true;
  readonly dataAccessAccountabilityVerificationCommandsDurable: true;
  readonly dataAccessAccountabilityDisclosureCommandsDurable: true;
  readonly dataAccessAccountabilityDisclosureChallengeCommandsDurable: true;
  readonly dataAccessAccountabilityDisclosureResolutionCommandsDurable: true;
  readonly dataAccessAccountabilityDisclosureNoticeCommandsDurable: true;
  readonly auditExportManifestCommandsDurable: true;
  readonly projectLifecycleCommandsDurable: true;
  readonly evidenceRegistrationCommandsDurable: true;
  readonly evidenceConsentReceiptCommandsDurable: true;
  readonly evidenceConsentRevocationCommandsDurable: true;
  readonly evidenceDeviceAttestationCommandsDurable: true;
  readonly evidenceMediaUploadIntentCommandsDurable: true;
  readonly evidenceMediaObjectCommandsDurable: true;
  readonly evidenceMediaDuplicateRelationCommandsDurable: true;
  readonly evidenceMediaScanResultCommandsDurable: true;
  readonly evidenceMediaProviderReceiptVerificationCommandsDurable: true;
  readonly evidenceMediaScannerReceiptVerificationCommandsDurable: true;
  readonly evidenceMediaAdapterRoutesMounted: false;
  readonly evidenceMediaReviewTaskCommandsDurable: true;
  readonly evidenceMediaReviewAssignmentCommandsDurable: true;
  readonly evidenceMediaReviewDecisionCommandsDurable: true;
  readonly evidenceMediaCustodyEventCommandsDurable: true;
  readonly visualEvidenceAuthorityCommandsDurable: true;
  readonly evidenceVerificationCommandsDurable: true;
  readonly evidenceChallengeCorrectionCommandsDurable: true;
  readonly evidenceFinalDecisionCommandsDurable: true;
  readonly governedPolicyCommandsDurable: true;
  readonly methodologyVersionCommandsDurable: true;
  readonly methodologyPublicationCommandsDurable: true;
  readonly environmentalProofCandidateCommandsDurable: true;
  readonly environmentalProofApprovalCommandsDurable: true;
  readonly environmentalProofRecordCommandsDurable: true;
  readonly environmentalProofChallengeCommandsDurable: true;
  readonly environmentalProofChallengeReviewCommandsDurable: true;
  readonly environmentalProofChallengeResolutionCommandsDurable: true;
  readonly pendingPartnerWorkflowAdapters: true;
  readonly safety: {
    readonly noProductionMemoryFallback: true;
    readonly idempotencyKeysHashed: true;
    readonly semanticEventsAppendOnly: true;
    readonly transactionActorRequired: true;
    readonly privateKeyHandlingDisabled: true;
  };
};

export class CanopyProofTrustRegistryError extends Error {
  constructor(
    readonly code: CanopyProofTrustRegistryErrorCode,
    readonly httpStatus: 400 | 409 | 503,
  ) {
    super(
      code === "CANOPYPROOF_IDEMPOTENCY_REQUIRED"
        ? "CANOPYPROOF_IDEMPOTENCY_REQUIRED: a bounded Idempotency-Key is required for durable trust commands."
        : code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT"
          ? "CANOPYPROOF_TRUST_REGISTRY_CONFLICT: the durable trust command conflicts with committed authority."
          : "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE: the durable trust command could not be committed safely.",
    );
    this.name = "CanopyProofTrustRegistryError";
  }
}

export function canopyProofTrustRegistryConfigurationStatus(
  environment: Readonly<Record<string, string | undefined>>,
): CanopyProofTrustRegistryConfigurationStatus {
  const production = environment.DROPIN_CANOPYPROOF_MODE === "production" || environment.NODE_ENV === "production";
  const authorizationEnforced = production || environment.DROPIN_CANOPYPROOF_AUTH_MODE === "cloudflare_access_jwt";
  const postgresql =
    authorizationEnforced && environment.DROPIN_REPOSITORY === "prisma" && Boolean(environment.DATABASE_URL?.trim());
  return {
    service: "canopyproof-trust-registry-configuration",
    mode: postgresql ? "postgresql" : "development_memory",
    production,
    configured: authorizationEnforced ? postgresql : true,
    authorityCommandsDurable: true,
    dataSharingAgreementCommandsDurable: true,
    dataAccessRequestCommandsDurable: true,
    dataAccessDeliveryReceiptCommandsDurable: true,
    dataUseAttestationCommandsDurable: true,
    dataUseEnforcementCaseCommandsDurable: true,
    dataAccessRestrictionCommandsDurable: true,
    dataAccessAccountabilityPacketCommandsDurable: true,
    dataAccessAccountabilityVerificationCommandsDurable: true,
    dataAccessAccountabilityDisclosureCommandsDurable: true,
    dataAccessAccountabilityDisclosureChallengeCommandsDurable: true,
    dataAccessAccountabilityDisclosureResolutionCommandsDurable: true,
    dataAccessAccountabilityDisclosureNoticeCommandsDurable: true,
    auditExportManifestCommandsDurable: true,
    projectLifecycleCommandsDurable: true,
    evidenceRegistrationCommandsDurable: true,
    evidenceConsentReceiptCommandsDurable: true,
    evidenceConsentRevocationCommandsDurable: true,
    evidenceDeviceAttestationCommandsDurable: true,
    evidenceMediaUploadIntentCommandsDurable: true,
    evidenceMediaObjectCommandsDurable: true,
    evidenceMediaDuplicateRelationCommandsDurable: true,
    evidenceMediaScanResultCommandsDurable: true,
    evidenceMediaProviderReceiptVerificationCommandsDurable: true,
    evidenceMediaScannerReceiptVerificationCommandsDurable: true,
    evidenceMediaAdapterRoutesMounted: false,
    evidenceMediaReviewTaskCommandsDurable: true,
    evidenceMediaReviewAssignmentCommandsDurable: true,
    evidenceMediaReviewDecisionCommandsDurable: true,
    evidenceMediaCustodyEventCommandsDurable: true,
    visualEvidenceAuthorityCommandsDurable: true,
    evidenceVerificationCommandsDurable: true,
    evidenceChallengeCorrectionCommandsDurable: true,
    evidenceFinalDecisionCommandsDurable: true,
    governedPolicyCommandsDurable: true,
    methodologyVersionCommandsDurable: true,
    methodologyPublicationCommandsDurable: true,
    environmentalProofCandidateCommandsDurable: true,
    environmentalProofApprovalCommandsDurable: true,
    environmentalProofRecordCommandsDurable: true,
    environmentalProofChallengeCommandsDurable: true,
    environmentalProofChallengeReviewCommandsDurable: true,
    environmentalProofChallengeResolutionCommandsDurable: true,
    pendingPartnerWorkflowAdapters: true,
    safety: {
      noProductionMemoryFallback: true,
      idempotencyKeysHashed: true,
      semanticEventsAppendOnly: true,
      transactionActorRequired: true,
      privateKeyHandlingDisabled: true,
    },
  };
}

type TrustTransaction = Prisma.TransactionClient;
type CommandResult<T> = {
  readonly value: T;
  readonly resultEntityType: string;
  readonly resultEntityId: string;
  readonly responseHash: string;
  readonly auditEventRoot: string;
  readonly createdAt: string;
};

const accreditationStatuses = ["pending", "approved", "suspended", "revoked"] as const;
const membershipStatuses = ["active", "suspended", "revoked"] as const;
const dataSharingPolicies = ["open", "restricted", "private"] as const;

const auditEventRowSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor_id: z.string().min(1),
  entity_type: z.enum(canopyProofAuditEntityTypes),
  entity_id: z.string().min(1),
  previous_root: z.string().regex(/^[a-f0-9]{64}$/),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  event_root: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.coerce.date(),
  rationale: z.string().min(1),
});

const joinedAuditEventRowSchema = z.object({
  semantic_event_id: z.string().min(1),
  semantic_event_action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  semantic_event_actor_id: z.string().min(1),
  semantic_event_entity_type: z.enum(canopyProofAuditEntityTypes),
  semantic_event_entity_id: z.string().min(1),
  semantic_event_previous_root: z.string().regex(/^[a-f0-9]{64}$/),
  semantic_event_payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  semantic_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  semantic_event_created_at: z.coerce.date(),
  semantic_event_rationale: z.string().min(1),
  semantic_event_sequence_no: z.coerce.number().int().positive(),
});

const databaseSafeIntegerSchema = z.preprocess(
  (value) => (typeof value === "bigint" ? Number(value) : value),
  z.coerce.number().int().refine(Number.isSafeInteger),
);

const projectLocationRowSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    areaHectares: z.number().finite().nonnegative(),
    boundaryHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  })
  .strict();

const projectClaimBoundaryRowSchema = z
  .object({
    restorationProjectRegistryOnly: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
    disclosure: z.string().min(1),
  })
  .strict();

const projectRegistrationRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    region_id: z.string().min(1),
    title: z.string().min(3),
    project_type: z.enum(canopyProofProjectTypes),
    status: z.literal("submitted"),
    location: projectLocationRowSchema,
    area_hectares: z.coerce.number().finite().nonnegative(),
    target_tree_count: databaseSafeIntegerSchema,
    biodiversity_indicators: z.array(z.string().min(1)),
    water_indicators: z.array(z.string().min(1)),
    climate_risk_indicators: z.array(z.string().min(1)),
    monitoring_cadence_days: z.coerce.number().int().positive().max(3_650),
    governance_policy_id: z.string().min(1).nullable(),
    governance_approval_id: z.null(),
    created_by: z.string().min(1),
    created_by_role: z.enum(["owner", "admin", "verifier"]),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
    project_hash: z.string().regex(/^[a-f0-9]{64}$/),
    project_root: z.string().regex(/^[a-f0-9]{64}$/),
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    audit_history: z.unknown(),
    claim_boundary: projectClaimBoundaryRowSchema,
  })
  .and(joinedAuditEventRowSchema);

const projectStatusTransitionRowSchema = z
  .object({
    id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    previous_status: z.enum(canopyProofProjectStatuses),
    status: z.enum(canopyProofProjectStatuses),
    previous_project_root: z.string().regex(/^[a-f0-9]{64}$/),
    governance_approval_id: z.string().min(1).nullable(),
    rationale: z.string().min(12).max(2_000),
    updated_by: z.string().min(1),
    updater_role: z.enum(["owner", "admin", "verifier"]),
    updated_at: z.coerce.date(),
    transition_hash: z.string().regex(/^[a-f0-9]{64}$/),
    transition_root: z.string().regex(/^[a-f0-9]{64}$/),
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const projectMonitoringRowSchema = z
  .object({
    id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    event_type: z.enum(canopyProofProjectMonitoringEventTypes),
    observed_at: z.coerce.date(),
    observed_by: z.string().min(1),
    observer_role: z.enum(["owner", "admin", "verifier", "researcher"]),
    previous_status: z.enum(canopyProofProjectStatuses),
    project_status: z.enum(canopyProofProjectStatuses),
    previous_project_root: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_ids: z.array(z.string().min(1)),
    terra_scene_ids: z.array(z.string().min(1)),
    biodiversity_indicators: z.array(z.string().min(1)),
    water_indicators: z.array(z.string().min(1)),
    climate_risk_indicators: z.array(z.string().min(1)),
    metrics: z.record(z.string().min(1), z.number().finite()),
    state: z.enum(canopyProofProjectMonitoringStates),
    rationale: z.string().min(12).max(2_000),
    event_hash: z.string().regex(/^[a-f0-9]{64}$/),
    monitoring_root: z.string().regex(/^[a-f0-9]{64}$/),
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const projectRegistryAggregateRowSchema = z.object({
  project_count: z.coerce.number().int().nonnegative(),
  active_project_count: z.coerce.number().int().nonnegative(),
  challenged_project_count: z.coerce.number().int().nonnegative(),
  status_transition_count: z.coerce.number().int().nonnegative(),
  monitoring_event_count: z.coerce.number().int().nonnegative(),
  challenged_monitoring_event_count: z.coerce.number().int().nonnegative(),
  project_root: z.string().regex(/^[a-f0-9]{64}$/),
  monitoring_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const evidenceLocationRowSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracyMeters: z.number().finite().nonnegative().max(100_000).optional(),
    regionId: z.string().min(1).max(160).optional(),
  })
  .strict();

const evidenceClaimBoundaryRowSchema = z
  .object({
    structuralValidationOnly: z.literal(true),
    pendingAiAndHumanReview: z.literal(true),
    notFinalVerification: z.literal(true),
    notCertificate: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
    disclosure: z.string().min(1),
  })
  .strict();

const evidenceRegistrationRowSchema = z
  .object({
    id: z.string().min(1).max(240),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    project_root_at_submission: z.string().regex(/^[a-f0-9]{64}$/),
    project_status_at_submission: z.enum(canopyProofProjectStatuses),
    project_region_id_at_submission: z.string().min(1).max(160),
    project_authority_updated_at_at_submission: z.coerce.date(),
    evidence_type: z.enum(canopyProofEvidenceTypes),
    location: evidenceLocationRowSchema,
    observed_at: z.coerce.date(),
    contributor_id: z.string().min(1),
    contributor_role: z.enum(canopyProofEvidenceContributorRoles),
    media_hash: z.string().regex(/^[a-f0-9]{64}$/),
    gps_hash: z.string().regex(/^[a-f0-9]{64}$/),
    offline_sync_id: z.string().min(1).max(240).nullable(),
    device_fingerprint_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    exif_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    verification_status: z.enum(canopyProofEvidenceRegistrationStatuses),
    confidence_score: z.coerce.number().int().min(0).max(100),
    reviewers: z.array(z.string()).length(0),
    validation_issues: z.array(z.enum(canopyProofEvidenceValidationIssues)),
    created_at: z.coerce.date(),
    evidence_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    audit_history: z.unknown(),
    claim_boundary: evidenceClaimBoundaryRowSchema,
  })
  .and(joinedAuditEventRowSchema);

const evidenceRegistryAggregateRowSchema = z.object({
  registration_count: z.coerce.number().int().nonnegative(),
  validated_count: z.coerce.number().int().nonnegative(),
  challenged_count: z.coerce.number().int().nonnegative(),
  evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const evidenceVerificationSafetyRowSchema = z
  .object({
    evidenceRegistrationImmutable: z.literal(true),
    aiAdvisoryOnly: z.literal(true),
    independentHumanApprovalRequired: z.literal(true),
    notFinalVerification: z.literal(true),
    notCertificate: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const verificationActorSnapshotRowSchema = z
  .object({
    id: z.string().min(1),
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: z.string().min(1),
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: z.string().regex(/^[a-f0-9]{64}$/),
    organizationRoot: z.string().regex(/^[a-f0-9]{64}$/),
    membershipId: z.string().min(1).optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    accreditationId: z.string().min(1).optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    accreditationScope: z.array(z.string().min(1)),
    authorityRoot: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const evidenceCustodySafetyRowSchema = z
  .object({
    appendOnly: z.literal(true),
    subjectBound: z.literal(true),
    organizationBound: z.literal(true),
    semanticEventBound: z.literal(true),
    noRawDeviceIdentifier: z.literal(true),
    noRawProviderCredential: z.literal(true),
    providerVerificationRequiredForHardwareTrust: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const evidenceCustodyActorSnapshotRowSchema = z
  .object({
    id: z.string().min(1),
    participantType: z.literal("human"),
    role: z.enum(canopyProofEvidenceCustodyRoles),
    verificationStatus: z.literal("verified"),
    organizationId: z.string().min(1),
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: z.string().regex(/^[a-f0-9]{64}$/),
    organizationRoot: z.string().regex(/^[a-f0-9]{64}$/),
    membershipId: z.string().min(1),
    membershipStatus: z.literal("active"),
    membershipRoot: z.string().regex(/^[a-f0-9]{64}$/),
    authorityRoot: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const evidenceConsentReceiptRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    subject_id: z.string().min(1),
    subject_root: z.string().regex(/^[a-f0-9]{64}$/),
    subject_authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    device_fingerprint_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    purposes: z.array(z.enum(canopyProofEvidenceConsentPurposes)).min(1),
    lawful_basis: z.enum(canopyProofEvidenceConsentLawfulBases),
    privacy_mode: z.enum(canopyProofEvidenceConsentPrivacyModes),
    policy_version: z.string().min(1),
    evidence_hash: z.string().regex(/^[a-f0-9]{64}$/),
    retention_days: z.coerce.number().int().positive().max(3_650),
    actor_snapshot: evidenceCustodyActorSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    subject_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    receipt_root: z.string().regex(/^[a-f0-9]{64}$/),
    granted_at: z.coerce.date(),
    expires_at: z.coerce.date().nullable(),
    created_by: z.string().min(1),
    safety: evidenceCustodySafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceConsentRevocationRowSchema = z
  .object({
    id: z.string().min(1),
    receipt_id: z.string().min(1),
    receipt_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    subject_id: z.string().min(1),
    subject_root: z.string().regex(/^[a-f0-9]{64}$/),
    reason_hash: z.string().regex(/^[a-f0-9]{64}$/),
    revoked_at: z.coerce.date(),
    actor_snapshot: evidenceCustodyActorSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    subject_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    revocation_hash: z.string().regex(/^[a-f0-9]{64}$/),
    revocation_root: z.string().regex(/^[a-f0-9]{64}$/),
    revoked_by: z.string().min(1),
    safety: evidenceCustodySafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceDeviceAttestationRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    subject_id: z.string().min(1),
    subject_root: z.string().regex(/^[a-f0-9]{64}$/),
    subject_authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    device_fingerprint_hash: z.string().regex(/^[a-f0-9]{64}$/),
    consent_receipt_id: z.string().min(1),
    consent_receipt_root: z.string().regex(/^[a-f0-9]{64}$/),
    attestation_type: z.enum(canopyProofEvidenceDeviceAttestationTypes),
    provider: z.enum(canopyProofEvidenceDeviceAttestationProviders),
    provider_key_id: z.string().min(1),
    provider_receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    provider_verification_state: z.enum(["modeled_only", "verified"]),
    public_key_hash: z.string().regex(/^[a-f0-9]{64}$/),
    attestation_hash: z.string().regex(/^[a-f0-9]{64}$/),
    reputation_score: z.coerce.number().int().min(0).max(100),
    risk_flags: z.array(z.enum(canopyProofEvidenceDeviceRiskFlags)),
    actor_snapshot: evidenceCustodyActorSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    subject_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    device_hash: z.string().regex(/^[a-f0-9]{64}$/),
    attestation_root: z.string().regex(/^[a-f0-9]{64}$/),
    issued_at: z.coerce.date(),
    expires_at: z.coerce.date(),
    created_by: z.string().min(1),
    safety: evidenceCustodySafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceConsentProjectionRowSchema = z.object({
  receipt_id: z.string().min(1),
  receipt_root: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  subject_id: z.string().min(1),
  state: z.enum(["active", "expired", "revoked"]),
  evaluated_at_utc: z.coerce.date(),
  revocation_id: z.string().min(1).nullable(),
  revocation_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: evidenceCustodySafetyRowSchema,
});

const evidenceDeviceAttestationProjectionRowSchema = z.object({
  attestation_id: z.string().min(1),
  attestation_root: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  subject_id: z.string().min(1),
  consent_receipt_id: z.string().min(1),
  state: z.enum(["current", "expired", "consent_revoked", "consent_expired", "needs_review"]),
  evaluated_at_utc: z.coerce.date(),
  consent_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: evidenceCustodySafetyRowSchema,
});

const evidenceDeviceAttestationAdapterSafetyRowSchema = z
  .object({
    appendOnly: z.literal(true),
    organizationBound: z.literal(true),
    subjectBound: z.literal(true),
    consentBound: z.literal(true),
    baseAttestationBound: z.literal(true),
    semanticEventBound: z.literal(true),
    commandReceiptBound: z.literal(true),
    providerSignatureVerifiedIndependently: z.literal(true),
    baseAttestationRemainsModeledOnly: z.literal(true),
    strictAsOfProjection: z.literal(true),
    noRawDeviceIdentifier: z.literal(true),
    noRawAttestation: z.literal(true),
    noRawChallenge: z.literal(true),
    noRawSignature: z.literal(true),
    noProviderCredential: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const effectiveDeviceAttestationProjectionRowSchema = z.object({
  attestation_id: z.string().min(1),
  attestation_root: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  subject_id: z.string().min(1),
  consent_receipt_id: z.string().min(1),
  state: z.enum([
    "current",
    "expired",
    "consent_revoked",
    "consent_expired",
    "needs_review",
    "rejected",
    "verification_expired",
  ]),
  issue_codes: z.array(z.string()),
  evaluated_at_utc: z.coerce.date(),
  consent_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  verification_fact_id: z.string().min(1).nullable(),
  verification_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: evidenceDeviceAttestationAdapterSafetyRowSchema,
});

const evidenceDeviceAttestationVerificationFactRecordSchema = z
  .object({
    factType: z.literal("evidence_device_attestation_receipt_verification"),
    id: z.string().min(1),
  })
  .passthrough();

const evidenceDeviceAttestationVerificationFactRowSchema = z.object({
  fact_record: evidenceDeviceAttestationVerificationFactRecordSchema,
});

const evidenceMediaSafetyRowSchema = z
  .object({
    appendOnly: z.literal(true),
    subjectBound: z.literal(true),
    organizationBound: z.literal(true),
    projectBound: z.literal(true),
    consentBound: z.literal(true),
    deviceBound: z.literal(true),
    semanticEventBound: z.literal(true),
    noPersistedUploadGrant: z.literal(true),
    noProviderCredential: z.literal(true),
    quarantineByDefault: z.literal(true),
    providerVerificationRequiredForAvailability: z.literal(true),
    scannerVerificationRequiredForAvailability: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const evidenceMediaAgentSnapshotRowSchema = z
  .object({
    id: z.string().min(1),
    participantType: z.literal("agent"),
    role: z.literal("agent"),
    verificationStatus: z.literal("verified"),
    organizationId: z.string().min(1),
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: z.string().regex(/^[a-f0-9]{64}$/),
    organizationRoot: z.string().regex(/^[a-f0-9]{64}$/),
    agentType: z.literal("evidence"),
    agentStatus: z.literal("active"),
    capability: z.enum(canopyProofEvidenceMediaAgentCapabilities),
    agentRegistryHash: z.string().regex(/^[a-f0-9]{64}$/),
    authorityRoot: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const evidenceMediaUploadIntentRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    project_root: z.string().regex(/^[a-f0-9]{64}$/),
    project_status: z.enum(["submitted", "under_review", "active", "monitored", "challenged"]),
    evidence_id: z.string().min(1),
    subject_id: z.string().min(1),
    subject_root: z.string().regex(/^[a-f0-9]{64}$/),
    subject_authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    consent_receipt_id: z.string().min(1),
    consent_receipt_root: z.string().regex(/^[a-f0-9]{64}$/),
    consent_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
    device_attestation_id: z.string().min(1),
    device_attestation_root: z.string().regex(/^[a-f0-9]{64}$/),
    device_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
    device_trust_state: z.enum(["current", "needs_review"]),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    content_type: z.enum(canopyProofEvidenceMediaContentTypes),
    byte_length: z.coerce.number().int().positive(),
    object_key: z.string().min(1),
    captured_at: z.coerce.date(),
    expires_at: z.coerce.date(),
    actor_snapshot: evidenceCustodyActorSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    intent_hash: z.string().regex(/^[a-f0-9]{64}$/),
    intent_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaObjectRowSchema = z
  .object({
    id: z.string().min(1),
    intent_id: z.string().min(1),
    intent_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    project_root: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_id: z.string().min(1),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    content_type: z.enum(canopyProofEvidenceMediaContentTypes),
    byte_length: z.coerce.number().int().positive(),
    object_key: z.string().min(1),
    storage_provider: z.enum(canopyProofEvidenceMediaStorageProviders),
    provider_namespace: z.string().min(1),
    object_version: z.string().min(1),
    etag_hash: z.string().regex(/^[a-f0-9]{64}$/),
    provider_receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    provider_verification_state: z.enum(["modeled_only", "verified"]),
    encryption_mode: z.enum(canopyProofEvidenceMediaEncryptionModes),
    encryption_key_ref: z.string().min(1).nullable(),
    object_lock_mode: z.enum(canopyProofEvidenceMediaObjectLockModes),
    retain_until: z.coerce.date().nullable(),
    stored_at: z.coerce.date(),
    agent_snapshot: evidenceMediaAgentSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    object_hash: z.string().regex(/^[a-f0-9]{64}$/),
    object_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaDuplicateRelationRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    object_root: z.string().regex(/^[a-f0-9]{64}$/),
    duplicate_of_object_id: z.string().min(1),
    duplicate_of_object_root: z.string().regex(/^[a-f0-9]{64}$/),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    detected_at: z.coerce.date(),
    agent_snapshot: evidenceMediaAgentSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    relation_hash: z.string().regex(/^[a-f0-9]{64}$/),
    relation_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaScanResultRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    object_root: z.string().regex(/^[a-f0-9]{64}$/),
    scanner_name: z.string().min(1),
    scanner_version: z.string().min(1),
    scanner_image_digest: z.string().regex(/^[a-f0-9]{64}$/),
    signature_database_version: z.string().min(1),
    verdict: z.enum(canopyProofEvidenceMediaScanVerdicts),
    finding_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
    provider_receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    provider_verification_state: z.enum(["modeled_only", "verified"]),
    scanned_at: z.coerce.date(),
    agent_snapshot: evidenceMediaAgentSnapshotRowSchema,
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    scan_hash: z.string().regex(/^[a-f0-9]{64}$/),
    scan_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaAdapterSafetyRowSchema = z
  .object({
    appendOnly: z.literal(true),
    organizationBound: z.literal(true),
    projectBound: z.literal(true),
    evidenceBound: z.literal(true),
    objectBound: z.literal(true),
    semanticEventBound: z.literal(true),
    commandReceiptBound: z.literal(true),
    providerReceiptVerifiedIndependently: z.literal(true),
    retentionPolicyVerifiedIndependently: z.literal(true),
    scannerSignatureVerifiedIndependently: z.literal(true),
    noPersistedUploadGrant: z.literal(true),
    noRawSignature: z.literal(true),
    noProviderCredential: z.literal(true),
    notAvailabilityDecision: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const evidenceMediaProviderVerificationRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    object_root: z.string().regex(/^[a-f0-9]{64}$/),
    intent_id: z.string().min(1),
    intent_root: z.string().regex(/^[a-f0-9]{64}$/),
    verifier_id: z.string().min(1),
    verifier_snapshot: evidenceMediaAgentSnapshotRowSchema,
    storage_provider: z.enum(canopyProofEvidenceMediaStorageProviders),
    provider_namespace: z.string().min(1),
    object_key: z.string().min(1),
    object_version: z.string().min(1),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    content_type: z.enum(canopyProofEvidenceMediaContentTypes),
    byte_length: z.coerce.number().int().positive(),
    etag_hash: z.string().regex(/^[a-f0-9]{64}$/),
    uploaded_at: z.coerce.date(),
    encryption_mode: z.enum(canopyProofEvidenceMediaEncryptionModes),
    encryption_key_ref: z.string().min(1).nullable(),
    object_lock_mode: z.enum(canopyProofEvidenceMediaObjectLockModes),
    retain_until: z.coerce.date().nullable(),
    retention_policy_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    retention_verification_state: z.enum(["modeled_only", "verified"]),
    provider_receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    verified_at: z.coerce.date(),
    provider_verification_root: z.string().regex(/^[a-f0-9]{64}$/),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    command_receipt_id: z.string().min(1),
    fact_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaAdapterSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaScannerVerificationRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    object_root: z.string().regex(/^[a-f0-9]{64}$/),
    scan_result_id: z.string().min(1),
    scan_root: z.string().regex(/^[a-f0-9]{64}$/),
    verifier_id: z.string().min(1),
    verifier_snapshot: evidenceMediaAgentSnapshotRowSchema,
    scanner_id: z.string().min(1),
    signer_key_id: z.string().min(1),
    signature_algorithm: z.literal("ed25519"),
    signature_hash: z.string().regex(/^[a-f0-9]{64}$/),
    scanner_policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    object_provider_receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    scanner_receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    source_scan_verdict: z.enum(canopyProofEvidenceMediaScanVerdicts),
    verified_at: z.coerce.date(),
    scanner_verification_root: z.string().regex(/^[a-f0-9]{64}$/),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    command_receipt_id: z.string().min(1),
    fact_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaAdapterSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaObjectProjectionRowSchema = z.object({
  object_id: z.string().min(1),
  object_root: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  evidence_id: z.string().min(1),
  state: z.enum(["pending_scan", "quarantined", "duplicate", "needs_review", "available"]),
  evaluated_at_utc: z.coerce.date(),
  consent_state: z.enum(["active", "expired", "revoked"]),
  device_state: z.enum([
    "current",
    "expired",
    "consent_revoked",
    "consent_expired",
    "needs_review",
    "rejected",
    "verification_expired",
  ]),
  latest_scan_result_id: z.string().min(1).nullable(),
  latest_scan_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  duplicate_relation_id: z.string().min(1).nullable(),
  duplicate_relation_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: evidenceMediaSafetyRowSchema,
});

const evidenceMediaAdapterTrustProjectionRowSchema = z.object({
  object_id: z.string().min(1),
  object_root: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  provider_verification_fact_id: z.string().min(1).nullable(),
  provider_verification_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  retention_verification_state: z.enum(["modeled_only", "verified"]).nullable(),
  latest_scan_result_id: z.string().min(1).nullable(),
  latest_scan_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  scanner_verification_fact_id: z.string().min(1).nullable(),
  scanner_verification_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  state: z.enum([
    "provider_pending",
    "retention_pending",
    "scanner_pending",
    "receipt_challenged",
    "verified_receipts",
  ]),
  evaluated_at_utc: z.coerce.date(),
  projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: evidenceMediaAdapterSafetyRowSchema,
});

const effectiveMediaSafetyRowSchema = z
  .object({
    derivedProjectionOnly: z.literal(true),
    baseProjectionBound: z.literal(true),
    adapterTrustProjectionBound: z.literal(true),
    asOfEvaluationBound: z.literal(true),
    hardStateCannotBePromoted: z.literal(true),
    verifiedReceiptsRequired: z.literal(true),
    activeConsentRequired: z.literal(true),
    currentDeviceRequired: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const effectiveMediaObjectProjectionRowSchema = z.object({
  object_id: z.string().min(1),
  object_root: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  evidence_id: z.string().min(1),
  base_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  adapter_trust_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  device_trust_projection_root: z.string().regex(/^[a-f0-9]{64}$/).nullish(),
  state: z.enum(["pending_scan", "quarantined", "duplicate", "needs_review", "available"]),
  issue_codes: z.array(z.string().min(1)),
  evaluated_at_utc: z.coerce.date(),
  projection_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: effectiveMediaSafetyRowSchema,
});

const evidenceMediaReviewSafetyRowSchema = z
  .object({
    appendOnly: z.literal(true),
    organizationBound: z.literal(true),
    mediaObjectBound: z.literal(true),
    mediaProjectionBound: z.literal(true),
    semanticEventBound: z.literal(true),
    independentAccreditedHumanReviewerRequired: z.literal(true),
    reviewCannotOverrideProviderVerification: z.literal(true),
    custodyPreviousRootLinked: z.literal(true),
    noRawRationale: z.literal(true),
    noProviderCredential: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const evidenceMediaReviewHumanActorRowSchema = verificationActorSnapshotRowSchema.extend({
  participantType: z.literal("human"),
  role: z.enum(["owner", "admin", "verifier", "researcher"]),
  membershipId: z.string().min(1),
  membershipStatus: z.literal("active"),
  membershipRoot: z.string().regex(/^[a-f0-9]{64}$/),
});

const evidenceMediaReviewTaskRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    object_root: z.string().regex(/^[a-f0-9]{64}$/),
    media_projection_state: z.enum(["pending_scan", "quarantined", "duplicate", "needs_review", "available"]),
    media_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
    contributor_id: z.string().min(1),
    review_round: z.coerce.number().int().positive(),
    previous_review_task_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    reason_codes: z.array(z.string().min(1)).min(1),
    severity: z.enum(canopyProofEvidenceMediaReviewSeverities),
    policy_id: z.string().min(1),
    opened_by: z.string().min(1),
    opener_snapshot: evidenceMediaReviewHumanActorRowSchema,
    opened_at: z.coerce.date(),
    due_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    task_hash: z.string().regex(/^[a-f0-9]{64}$/),
    task_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaReviewSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaReviewAssignmentRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    task_id: z.string().min(1),
    task_root: z.string().regex(/^[a-f0-9]{64}$/),
    contributor_id: z.string().min(1),
    reviewer_id: z.string().min(1),
    reviewer_snapshot: evidenceMediaReviewHumanActorRowSchema,
    assigned_by: z.string().min(1),
    assigner_snapshot: evidenceMediaReviewHumanActorRowSchema,
    assigned_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    assignment_hash: z.string().regex(/^[a-f0-9]{64}$/),
    assignment_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaReviewSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaReviewDecisionRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    object_id: z.string().min(1),
    task_id: z.string().min(1),
    task_root: z.string().regex(/^[a-f0-9]{64}$/),
    assignment_id: z.string().min(1),
    assignment_root: z.string().regex(/^[a-f0-9]{64}$/),
    media_projection_state: z.enum(["pending_scan", "quarantined", "duplicate", "needs_review", "available"]),
    media_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
    reviewer_id: z.string().min(1),
    reviewer_snapshot: evidenceMediaReviewHumanActorRowSchema,
    decision: z.enum(canopyProofEvidenceMediaReviewDecisions),
    rationale_hash: z.string().regex(/^[a-f0-9]{64}$/),
    limitation_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    decided_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    decision_hash: z.string().regex(/^[a-f0-9]{64}$/),
    decision_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaReviewSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaCustodyEventRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    evidence_id: z.string().min(1),
    action: z.enum(canopyProofEvidenceMediaCustodyActions),
    artifact_type: z.enum(canopyProofEvidenceMediaCustodyArtifactTypes),
    artifact_id: z.string().min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    custodian_id: z.string().min(1),
    custodian_snapshot: evidenceMediaReviewHumanActorRowSchema,
    custody_note_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_id: z.string().min(1),
    occurred_at: z.coerce.date(),
    previous_custody_root: z.string().regex(/^[a-f0-9]{64}$/),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    custody_hash: z.string().regex(/^[a-f0-9]{64}$/),
    custody_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceMediaReviewSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceMediaUploadCommandSchema = z
  .object({
    evidenceId: z.string().min(1),
    consentReceiptId: z.string().min(1),
    deviceAttestationId: z.string().min(1),
    contentHash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
    contentType: z.enum(canopyProofEvidenceMediaContentTypes),
    byteLength: z.number().int().positive().max(50 * 1024 * 1024),
    capturedAt: z.string().datetime(),
  })
  .strict();

const evidenceMediaObjectCommandRoutingSchema = z
  .object({
    intentId: z.string().min(1),
    providerVerificationState: z.enum(["modeled_only", "verified"]),
  })
  .passthrough();

const evidenceMediaScanCommandRoutingSchema = z
  .object({
    objectId: z.string().min(1),
    providerVerificationState: z.enum(["modeled_only", "verified"]),
  })
  .passthrough();

const evidenceMediaReviewTaskCommandSchema = z
  .object({
    objectId: z.string().min(1),
    reasonCodes: z.array(z.string().min(1)).min(1).max(32),
    severity: z.enum(canopyProofEvidenceMediaReviewSeverities),
    policyId: z.string().min(1),
    openedAt: z.string().datetime(),
    dueAt: z.string().datetime(),
  })
  .strict();

const evidenceMediaReviewAssignmentCommandSchema = z
  .object({
    taskId: z.string().min(1),
    reviewerId: z.string().min(1),
    assignedAt: z.string().datetime(),
  })
  .strict();

const evidenceMediaReviewDecisionCommandSchema = z
  .object({
    taskId: z.string().min(1),
    decision: z.enum(canopyProofEvidenceMediaReviewDecisions),
    rationale: z.string().trim().min(20).max(4_000),
    limitations: z.array(z.string().trim().min(3).max(1_000)).min(1).max(32),
    decidedAt: z.string().datetime(),
  })
  .strict();

const evidenceValidationCheckRowSchema = z
  .object({
    code: z.enum([
      "registration_integrity",
      "project_status_eligible",
      "structural_registration",
      "location_accuracy",
      "project_region_binding",
      "minimum_confidence",
    ]),
    state: z.enum(canopyProofValidationCheckStates),
    detail: z.string().min(1),
  })
  .strict();

const evidenceValidationRunRowSchema = z
  .object({
    id: z.string().min(1),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    ruleset_id: z.literal("canopyproof-evidence-validation-core"),
    ruleset_version: z.literal("1.0.0"),
    ruleset_hash: z.string().regex(/^[a-f0-9]{64}$/),
    checks: z.array(evidenceValidationCheckRowSchema),
    issues: z.array(z.string().min(1)),
    outcome: z.enum(canopyProofValidationOutcomes),
    confidence_score: z.coerce.number().int().min(0).max(100),
    executor_id: z.string().min(1),
    executor_snapshot: verificationActorSnapshotRowSchema,
    executed_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(2),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    validation_hash: z.string().regex(/^[a-f0-9]{64}$/),
    validation_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceVerificationSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const advisoryAiFindingRowSchema = z
  .object({
    id: z.string().min(1),
    capability: z.enum(canopyAiCapabilities),
    severity: z.enum(["low", "medium", "high", "critical"]),
    code: z.string().min(1),
    message: z.string().min(1),
    recommendedAction: z.enum(["REASON", "DELEGATE", "CHALLENGE"]),
    sourceEventRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    findingHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const advisoryAiAnalysisRowSchema = z
  .object({
    id: z.string().min(1),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    validation_run_id: z.string().min(1),
    validation_root: z.string().regex(/^[a-f0-9]{64}$/),
    agent_id: z.string().min(1),
    agent_snapshot: verificationActorSnapshotRowSchema,
    model_provider: z.string().min(1),
    model_name: z.string().min(1),
    model_version: z.string().min(1),
    model_artifact_hash: z.string().regex(/^[a-f0-9]{64}$/),
    prompt_hash: z.string().regex(/^[a-f0-9]{64}$/),
    dataset_snapshot_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(2),
    execution_environment: z.string().min(1),
    capabilities: z.array(z.enum(canopyAiCapabilities)),
    findings: z.array(advisoryAiFindingRowSchema),
    recommendation: z.enum(canopyProofAiRecommendations),
    claimed_confidence_score: z.coerce.number().int().min(0).max(100),
    confidence_score: z.coerce.number().int().min(0).max(100),
    advisory_only: z.literal(true),
    analyzed_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(3),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    analysis_hash: z.string().regex(/^[a-f0-9]{64}$/),
    analysis_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceVerificationSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const humanFindingDispositionRowSchema = z
  .object({
    analysisId: z.string().min(1),
    findingId: z.string().min(1),
    disposition: z.enum(canopyProofFindingDispositions),
    rationale: z.string(),
    evidenceEventRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
    dispositionHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const evidenceHumanReviewRowSchema = z
  .object({
    id: z.string().min(1),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    validation_run_id: z.string().min(1),
    validation_root: z.string().regex(/^[a-f0-9]{64}$/),
    ai_analysis_ids: z.array(z.string().min(1)).min(1),
    ai_analysis_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    reviewer_id: z.string().min(1),
    reviewer_snapshot: verificationActorSnapshotRowSchema,
    decision: z.enum(canopyProofHumanReviewDecisions),
    finding_dispositions: z.array(humanFindingDispositionRowSchema),
    rationale: z.string().min(12),
    limitations: z.array(z.string().min(1)),
    reviewed_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(4),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    review_hash: z.string().regex(/^[a-f0-9]{64}$/),
    review_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceVerificationSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceChallengeSafetyRowSchema = evidenceVerificationSafetyRowSchema.extend({
  factsAppendOnly: z.literal(true),
  originalEvidencePreserved: z.literal(true),
  challengeSuspendsReliance: z.literal(true),
  independentHumanResolutionRequired: z.literal(true),
  upheldChallengeRequiresCorrection: z.literal(true),
  replacementRequiresIndependentApproval: z.literal(true),
  crossOrganizationChallengeGrantsNoAccess: z.literal(true),
});

const evidenceChallengeRowSchema = z
  .object({
    id: z.string().min(1),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenged_reliance_state: z.enum(canopyProofEvidenceRelianceStates),
    challenged_reliance_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenged_terminal_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenged_validation_run_id: z.string().min(1).nullable(),
    challenged_validation_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    challenged_ai_analysis_ids: z.array(z.string().min(1)),
    challenged_ai_analysis_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
    challenged_human_review_id: z.string().min(1).nullable(),
    challenged_human_review_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    reason: z.enum(canopyProofEvidenceChallengeReasons),
    severity: z.enum(canopyProofEvidenceChallengeSeverities),
    rationale: z.string().min(24),
    supporting_artifact_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    challenger_id: z.string().min(1),
    challenger_organization_id: z.string().min(1),
    challenger_snapshot: verificationActorSnapshotRowSchema,
    challenged_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(2),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenge_hash: z.string().regex(/^[a-f0-9]{64}$/),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceChallengeResolutionRowSchema = z
  .object({
    id: z.string().min(1),
    challenge_id: z.string().min(1),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    previous_resolution_id: z.string().min(1).nullable(),
    previous_resolution_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    decision: z.enum(canopyProofEvidenceChallengeResolutionDecisions),
    rationale: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    reviewer_id: z.string().min(1),
    reviewer_snapshot: verificationActorSnapshotRowSchema,
    reviewed_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(3),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    resolution_hash: z.string().regex(/^[a-f0-9]{64}$/),
    resolution_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceCorrectionRowSchema = z
  .object({
    id: z.string().min(1),
    challenge_id: z.string().min(1),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    resolution_id: z.string().min(1),
    resolution_root: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    action: z.enum(canopyProofEvidenceCorrectionActions),
    replacement_evidence_id: z.string().min(1).nullable(),
    replacement_evidence_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    replacement_reliance_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    replacement_terminal_event_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    rationale: z.string().min(24),
    evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    publisher_id: z.string().min(1),
    publisher_snapshot: verificationActorSnapshotRowSchema,
    corrected_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(4),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    correction_hash: z.string().regex(/^[a-f0-9]{64}$/),
    correction_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const evidenceFinalDecisionSafetyRowSchema = z
  .object({
    evidenceRegistrationImmutable: z.literal(true),
    aiAdvisoryOnly: z.literal(true),
    makerCheckerRequired: z.literal(true),
    currentAccreditedVerifierRequired: z.literal(true),
    challengeAwareRelianceBound: z.literal(true),
    laterFactsInvalidateDecision: z.literal(true),
    notEnvironmentalProofRecord: z.literal(true),
    notCertificate: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const evidenceFinalDecisionRowSchema = z
  .object({
    id: z.string().min(1),
    evidence_id: z.string().min(1),
    project_id: z.string().min(1),
    organization_id: z.string().min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    pre_decision_reliance_state: z.enum(canopyProofEvidenceRelianceStates),
    pre_decision_reliance_root: z.string().regex(/^[a-f0-9]{64}$/),
    pre_decision_terminal_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    validation_run_id: z.string().min(1),
    validation_root: z.string().regex(/^[a-f0-9]{64}$/),
    ai_analysis_ids: z.array(z.string().min(1)).min(1),
    ai_analysis_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    human_review_id: z.string().min(1),
    human_review_root: z.string().regex(/^[a-f0-9]{64}$/),
    prior_final_decision_id: z.string().min(1).nullable(),
    prior_final_decision_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    decision: z.enum(canopyProofEvidenceFinalDecisionKinds),
    rationale: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    verifier_id: z.string().min(1),
    verifier_snapshot: verificationActorSnapshotRowSchema,
    decided_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_sequence: z.coerce.number().int().min(5),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    decision_hash: z.string().regex(/^[a-f0-9]{64}$/),
    decision_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: evidenceFinalDecisionSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const methodologyGovernanceSafetyRowSchema = z
  .object({
    immutableAuthority: z.literal(true),
    exactHumanAuthority: z.literal(true),
    independentQuorumRequired: z.literal(true),
    aiIsNeverFinalAuthority: z.literal(true),
    environmentalAccountabilityOnly: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const governedPolicyRowSchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(canopyProofGovernedPolicySubjects),
    governance_organization_id: z.string().min(1),
    title: z.string().min(16),
    required_approvals: z.coerce.number().int().min(2).max(32),
    allowed_reviewer_roles: z.array(z.enum(canopyProofGovernedPolicyReviewerRoles)).min(2).max(4),
    supersedes_policy_id: z.string().min(1).nullable(),
    supersedes_policy_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    creator_id: z.string().min(1),
    creator_snapshot: verificationActorSnapshotRowSchema,
    created_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: methodologyGovernanceSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const governedPolicyCommandRoutingSchema = z.object({
  subject: z.enum(canopyProofGovernedPolicySubjects),
});

const methodologyClaimBoundaryRowSchema = z
  .object({
    environmentalAccountabilityOnly: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const methodologyVersionRowSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    title: z.string().min(8),
    scope: z.enum(canopyProofMethodologyScopes),
    status: z.enum(canopyProofMethodologyStatuses),
    summary: z.string().min(24),
    required_data_sources: z.array(z.enum(canopyProofMethodologyDataSources)).min(1),
    quality_gates: z.array(z.enum(canopyProofMethodologyQualityGates)).min(1),
    minimum_gps_accuracy_meters: z.coerce.number().positive(),
    monitoring_cadence_days: z.coerce.number().int().positive(),
    evidence_retention_days: z.coerce.number().int().positive(),
    governance_approval_ids: z.array(z.string().min(1)),
    supersedes: z.string().min(1).nullable(),
    limitations: z.array(z.string().min(1)).min(1),
    claim_boundary: methodologyClaimBoundaryRowSchema,
    quality_gate_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_hash: z.string().regex(/^[a-f0-9]{64}$/),
    created_by: z.string().min(1),
    created_at: z.coerce.date(),
    published_at: z.coerce.date().nullable(),
    event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const methodologyPublicationApprovalRowSchema = z
  .object({
    id: z.string().min(1),
    methodology_id: z.string().min(1),
    methodology_hash: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    policy_id: z.string().min(1),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    governance_organization_id: z.string().min(1),
    prior_approval_id: z.string().min(1).nullable(),
    prior_approval_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    decision: z.enum(canopyProofMethodologyPublicationDecisions),
    rationale: z.string().min(24),
    conflict_disclosure: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    approver_id: z.string().min(1),
    approver_snapshot: verificationActorSnapshotRowSchema,
    decided_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_sequence: z.coerce.number().int().min(2),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    approval_hash: z.string().regex(/^[a-f0-9]{64}$/),
    approval_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: methodologyGovernanceSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const methodologyPublicationRowSchema = z
  .object({
    id: z.string().min(1),
    methodology_id: z.string().min(1),
    methodology_hash: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_quality_gate_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    policy_id: z.string().min(1),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    governance_organization_id: z.string().min(1),
    approval_ids: z.array(z.string().min(1)).min(2),
    approval_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(2),
    approval_quorum_root: z.string().regex(/^[a-f0-9]{64}$/),
    publisher_id: z.string().min(1),
    publisher_snapshot: verificationActorSnapshotRowSchema,
    rationale: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    published_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_sequence: z.coerce.number().int().min(3),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    publication_hash: z.string().regex(/^[a-f0-9]{64}$/),
    publication_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: methodologyGovernanceSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofSafetyRowSchema = z
  .object({
    environmentalAccountabilityOnly: z.literal(true),
    sourceAuthorityReplayed: z.literal(true),
    currentFinalEvidenceOnly: z.literal(true),
    governedMethodologyRequired: z.literal(true),
    acceptedMonitoringRequired: z.literal(true),
    independentHumanGovernanceRequired: z.literal(true),
    publicChallengeRequiredBeforePublicReliance: z.literal(true),
    noRawEvidence: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const environmentalProofPublicLocationRowSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    regionId: z.string().min(1),
    areaHectares: z.number().finite().positive(),
  })
  .strict();

const environmentalProofCandidateRowSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    project_status: z.enum(["active", "monitored"]),
    project_root: z.string().regex(/^[a-f0-9]{64}$/),
    project_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_id: z.string().min(1),
    methodology_hash: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_quality_gate_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_publication_id: z.string().min(1),
    methodology_publication_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_publication_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_publication_bundle_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_publication_policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_publication_policy_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_approval_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(2),
    methodology_approval_quorum_root: z.string().regex(/^[a-f0-9]{64}$/),
    policy_id: z.string().min(1),
    policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    policy_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    required_approvals: z.coerce.number().int().min(2).max(32),
    allowed_reviewer_roles: z.array(z.enum(canopyProofGovernedPolicyReviewerRoles)).min(2).max(4),
    evidence_ids: z.array(z.string().min(1)).min(1),
    evidence_registration_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    evidence_final_decision_ids: z.array(z.string().min(1)).min(1),
    evidence_final_decision_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    evidence_final_verification_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    final_decision_root: z.string().regex(/^[a-f0-9]{64}$/),
    monitoring_event_ids: z.array(z.string().min(1)).min(1),
    monitoring_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    monitoring_root: z.string().regex(/^[a-f0-9]{64}$/),
    contributor_ids: z.array(z.string().min(1)).min(1),
    source_actor_ids: z.array(z.string().min(1)).min(1),
    public_location: environmentalProofPublicLocationRowSchema,
    confidence_score: z.coerce.number().int().min(0).max(100),
    limitations: z.array(z.string().min(1)).min(1),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    derived_by_id: z.string().min(1),
    derived_by_snapshot: verificationActorSnapshotRowSchema,
    derived_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    candidate_hash: z.string().regex(/^[a-f0-9]{64}$/),
    candidate_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: environmentalProofSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofApprovalRowSchema = z
  .object({
    id: z.string().min(1),
    candidate_id: z.string().min(1),
    candidate_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    policy_id: z.string().min(1),
    policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    prior_approval_id: z.string().min(1).nullable(),
    prior_approval_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    decision: z.enum(canopyProofEnvironmentalProofApprovalDecisions),
    rationale: z.string().min(24),
    conflict_disclosure: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    approver_id: z.string().min(1),
    approver_snapshot: verificationActorSnapshotRowSchema,
    decided_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    candidate_sequence: z.coerce.number().int().min(2),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    approval_hash: z.string().regex(/^[a-f0-9]{64}$/),
    approval_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: environmentalProofSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofRecordRowSchema = z
  .object({
    id: z.string().min(1),
    record_type: z.literal("environmental_proof_record"),
    candidate_id: z.string().min(1),
    candidate_root: z.string().regex(/^[a-f0-9]{64}$/),
    authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    project_root: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_id: z.string().min(1),
    methodology_hash: z.string().regex(/^[a-f0-9]{64}$/),
    methodology_publication_id: z.string().min(1),
    methodology_publication_root: z.string().regex(/^[a-f0-9]{64}$/),
    policy_id: z.string().min(1),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_ids: z.array(z.string().min(1)).min(1),
    evidence_root: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_final_decision_ids: z.array(z.string().min(1)).min(1),
    evidence_final_decision_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    monitoring_event_ids: z.array(z.string().min(1)).min(1),
    monitoring_root: z.string().regex(/^[a-f0-9]{64}$/),
    contributor_ids: z.array(z.string().min(1)).min(1),
    public_location: environmentalProofPublicLocationRowSchema,
    confidence_score: z.coerce.number().int().min(0).max(100),
    governance_approval_ids: z.array(z.string().min(1)).min(2),
    governance_approval_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(2),
    governance_quorum_root: z.string().regex(/^[a-f0-9]{64}$/),
    issuer_id: z.string().min(1),
    issuer_snapshot: verificationActorSnapshotRowSchema,
    rationale: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    issued_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    candidate_sequence: z.coerce.number().int().min(3),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    record_hash: z.string().regex(/^[a-f0-9]{64}$/),
    record_root: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.literal("issued"),
    claim_boundary: environmentalProofSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofChallengeSafetyRowSchema = z
  .object({
    environmentalAccountabilityOnly: z.literal(true),
    immutableRecordPreserved: z.literal(true),
    riskSignalAdvisoryOnly: z.literal(true),
    independentHumanGovernanceRequired: z.literal(true),
    crossOrganizationStandingGrantsNoDataAccess: z.literal(true),
    noRawEvidence: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const environmentalProofChallengeRowSchema = z
  .object({
    id: z.string().min(1),
    record_id: z.string().min(1),
    record_root: z.string().regex(/^[a-f0-9]{64}$/),
    candidate_id: z.string().min(1),
    candidate_root: z.string().regex(/^[a-f0-9]{64}$/),
    authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    policy_id: z.string().min(1),
    policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenged_record_state: z.enum(["issued", "stale"]),
    challenged_record_projection_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenged_source_authority_current: z.boolean(),
    challenged_current_authority_root: z.string().regex(/^[a-f0-9]{64}$/),
    prior_challenge_id: z.string().min(1).nullable(),
    prior_resolution_id: z.string().min(1).nullable(),
    prior_resolution_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    reason: z.enum(canopyProofEnvironmentalProofChallengeReasons),
    severity: z.enum(canopyProofEnvironmentalProofChallengeSeverities),
    rationale: z.string().min(24),
    supporting_artifact_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenger_id: z.string().min(1),
    challenger_snapshot: verificationActorSnapshotRowSchema,
    challenger_organization_id: z.string().min(1),
    opened_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    record_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    challenge_hash: z.string().regex(/^[a-f0-9]{64}$/),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: environmentalProofChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofChallengeRiskRowSchema = z
  .object({
    id: z.string().min(1),
    challenge_id: z.string().min(1),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    record_id: z.string().min(1),
    record_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    reason: z.enum(canopyProofEnvironmentalProofChallengeReasons),
    risk_level: z.enum(canopyProofEnvironmentalProofChallengeSeverities),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    detected_by_id: z.string().min(1),
    detected_by_snapshot: verificationActorSnapshotRowSchema,
    detected_at: z.coerce.date(),
    record_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    risk_hash: z.string().regex(/^[a-f0-9]{64}$/),
    risk_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: environmentalProofChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofChallengeReviewRowSchema = z
  .object({
    id: z.string().min(1),
    challenge_id: z.string().min(1),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    risk_signal_id: z.string().min(1),
    risk_root: z.string().regex(/^[a-f0-9]{64}$/),
    record_id: z.string().min(1),
    record_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    policy_id: z.string().min(1),
    policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    prior_review_id: z.string().min(1).nullable(),
    prior_review_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    decision: z.enum(canopyProofEnvironmentalProofChallengeReviewDecisions),
    rationale: z.string().min(24),
    conflict_disclosure: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    reviewer_id: z.string().min(1),
    reviewer_snapshot: verificationActorSnapshotRowSchema,
    reviewed_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    record_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    review_hash: z.string().regex(/^[a-f0-9]{64}$/),
    review_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: environmentalProofChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofChallengeResolutionRowSchema = z
  .object({
    id: z.string().min(1),
    challenge_id: z.string().min(1),
    challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
    risk_signal_id: z.string().min(1),
    risk_root: z.string().regex(/^[a-f0-9]{64}$/),
    record_id: z.string().min(1),
    record_root: z.string().regex(/^[a-f0-9]{64}$/),
    organization_id: z.string().min(1),
    project_id: z.string().min(1),
    policy_id: z.string().min(1),
    policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    policy_root: z.string().regex(/^[a-f0-9]{64}$/),
    review_ids: z.array(z.string().min(1)).min(2),
    review_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(2),
    review_quorum_root: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(canopyProofEnvironmentalProofChallengeResolutionDecisions),
    rationale: z.string().min(24),
    limitations: z.array(z.string().min(1)),
    source_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    source_root: z.string().regex(/^[a-f0-9]{64}$/),
    resolver_id: z.string().min(1),
    resolver_snapshot: verificationActorSnapshotRowSchema,
    resolved_at: z.coerce.date(),
    command_hash: z.string().regex(/^[a-f0-9]{64}$/),
    record_sequence: z.coerce.number().int().positive(),
    previous_event_root: z.string().regex(/^[a-f0-9]{64}$/),
    resolution_hash: z.string().regex(/^[a-f0-9]{64}$/),
    resolution_root: z.string().regex(/^[a-f0-9]{64}$/),
    safety: environmentalProofChallengeSafetyRowSchema,
    audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .and(joinedAuditEventRowSchema);

const environmentalProofCandidateCommandRoutingSchema = z.object({
  projectId: z.string().min(1),
  methodologyId: z.string().min(1),
  policyId: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1).max(256),
  monitoringEventIds: z.array(z.string().min(1)).min(1).max(256),
});

const verificationActorAuthorityRowSchema = z.object({
  id: z.string().min(1),
  participant_type: z.enum(["human", "agent"]),
  roles: z.array(z.enum(["owner", "admin", "verifier", "researcher", "community", "observer", "agent"])),
  verification_status: z.literal("verified"),
  participant_organization_id: z.string().min(1).nullable(),
  subject_hash: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().min(1),
  organization_verification_status: z.literal("verified"),
  organization_root: z.string().regex(/^[a-f0-9]{64}$/),
  membership_id: z.string().min(1).nullable(),
  membership_status: z.literal("active").nullable(),
  membership_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  accreditation_id: z.string().min(1).nullable(),
  accreditation_status: z.enum(["approved", "pending", "suspended", "revoked"]).nullable(),
  accreditation_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  accreditation_scope: z.array(z.string().min(1)).nullable(),
});

const participantRowSchema = z.object({
  id: z.string().min(1),
  participant_type: z.enum(canopyProofIdentityParticipantTypes),
  display_name: z.string().min(1),
  owner_id: z.string().min(1).nullable(),
  organization_id: z.string().min(1).nullable(),
  roles: z.array(z.enum(canopyProofIdentityRoles)).min(1),
  verification_status: z.enum(canopyProofIdentityVerificationStatuses),
  reputation_score: z.number().int().min(0).max(100),
  credential_commitments: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)),
  public_key_hash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i).nullable(),
  subject_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const reputationRowSchema = z.object({
  id: z.string().min(1),
  participant_id: z.string().min(1),
  previous_score: z.number().int().min(0).max(100),
  new_score: z.number().int().min(0).max(100),
  source: z.enum(canopyProofIdentityReputationSources),
  reason: z.string().min(12),
  recorded_by: z.string().min(1),
  recorded_at: z.coerce.date(),
  snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const organizationRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).nullable(),
  legal_name: z.string().min(1),
  organization_type: z.enum(canopyProofOrganizationTypes),
  jurisdiction: z.string().min(1),
  public_contact: z.string().min(1).nullable(),
  operating_regions: z.array(z.string().min(1)),
  verification_capabilities: z.array(z.string().min(1)),
  registration_number: z.string().min(1).nullable(),
  verification_status: z.enum(canopyProofOrganizationVerificationStatuses),
  trust_level: z.enum(canopyProofOrganizationTrustLevels),
  authorized_users: z.unknown(),
  accreditation_status: z.enum(accreditationStatuses),
  data_sharing_policy: z.enum(dataSharingPolicies),
  profile_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const documentRowSchema = z.object({
  id: z.string().min(1),
  document_type: z.enum(["registration", "tax", "accreditation", "mandate", "audit_letter", "other"]),
  document_hash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
  issued_by: z.string().min(1).nullable(),
  uploaded_at: z.coerce.date(),
});

const membershipRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  actor_id: z.string().min(1),
  role: z.enum(canopyProofPartnerRoles),
  status: z.enum(membershipStatuses),
  conflict_disclosure: z.string().min(1),
  granted_by: z.string().min(1),
  granted_at: z.coerce.date(),
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const accreditationRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  status: z.enum(accreditationStatuses),
  scope: z.array(z.string().min(1)).min(1),
  decided_by: z.string().min(1),
  decided_at: z.coerce.date(),
  rationale: z.string().min(1),
  evidence_hash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataSharingAgreementRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  dataset_scopes: z.array(z.string().min(1)).min(1),
  privacy_tier: z.enum(["public", "restricted", "confidential"]),
  permitted_uses: z.array(z.string().min(1)).min(1),
  revoked: z.boolean(),
  expires_at: z.coerce.date().nullable(),
  created_by: z.string().min(1),
  created_at: z.coerce.date(),
  agreement_hash: z.string().regex(/^[a-f0-9]{64}$/),
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataSharingAgreementRevocationSafetySchema = z
  .object({
    agreementBound: z.literal(true),
    separateRevocationRecord: z.literal(true),
    futureAccessBlocked: z.literal(true),
    futureDeliveryBlocked: z.literal(true),
    appendOnly: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataSharingAgreementRevocationRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  agreement_id: z.string().min(1),
  rationale: z.string().min(12),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  revoked_by: z.string().min(1),
  revoked_at: z.coerce.date(),
  revocation_hash: z.string().regex(/^[a-f0-9]{64}$/),
  revocation_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataSharingAgreementRevocationSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataSharingAgreementSupersessionSafetySchema = z
  .object({
    predecessorBound: z.literal(true),
    successorBound: z.literal(true),
    scopeExpansionBlocked: z.literal(true),
    privacyEscalationBlocked: z.literal(true),
    priorAgreementFutureAccessBlocked: z.literal(true),
    priorAgreementFutureDeliveryBlocked: z.literal(true),
    appendOnly: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataSharingAgreementSupersessionRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  predecessor_agreement_id: z.string().min(1),
  predecessor_agreement_hash: z.string().regex(/^[a-f0-9]{64}$/),
  successor_agreement_id: z.string().min(1),
  successor_agreement_hash: z.string().regex(/^[a-f0-9]{64}$/),
  transition_type: z.enum(["renewal", "supersession"]),
  rationale: z.string().min(12),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  superseded_by: z.string().min(1),
  superseded_at: z.coerce.date(),
  supersession_hash: z.string().regex(/^[a-f0-9]{64}$/),
  supersession_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataSharingAgreementSupersessionSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessRequestSafetySchema = z
  .object({
    agreementBound: z.literal(true),
    scopeLimited: z.literal(true),
    humanDecisionRequired: z.literal(true),
    rawDataNotEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessRequestRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  agreement_id: z.string().min(1),
  dataset_scopes: z.array(z.string().min(1)).min(1),
  permitted_uses: z.array(z.string().min(1)).min(1),
  privacy_tier: z.enum(["public", "restricted", "confidential"]),
  purpose: z.string().min(12),
  status: z.enum(["pending", "approved", "denied", "revoked", "expired"]),
  requested_by: z.string().min(1),
  requested_at: z.coerce.date(),
  decision_by: z.string().min(1).nullable(),
  decided_at: z.coerce.date().nullable(),
  decision_rationale: z.string().min(12).nullable(),
  expires_at: z.coerce.date().nullable(),
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
  access_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessRequestSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessRequestDecisionSafetySchema = z
  .object({
    requestBound: z.literal(true),
    agreementBound: z.literal(true),
    independentHumanDecision: z.literal(true),
    appendOnly: z.literal(true),
    rawDataNotEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessRequestDecisionRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  agreement_id: z.string().min(1),
  previous_status: z.enum(["pending", "approved"]),
  status: z.enum(["approved", "denied", "revoked", "expired"]),
  decision_by: z.string().min(1),
  decided_at: z.coerce.date(),
  rationale: z.string().min(12),
  decision_hash: z.string().regex(/^[a-f0-9]{64}$/),
  decision_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessRequestDecisionSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessDeliverySafetySchema = z
  .object({
    approvedRequestBound: z.literal(true),
    agreementBound: z.literal(true),
    manifestHashOnly: z.literal(true),
    redactionPolicyEnforced: z.literal(true),
    rawDataNotEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    humanDecisionRequired: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessDeliveryReceiptRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  agreement_id: z.string().min(1),
  manifest_id: z.string().min(1),
  manifest_requester_organization_id: z.string().min(1),
  manifest_hash: z.string().regex(/^[a-f0-9]{64}$/),
  manifest_entry_root: z.string().regex(/^[a-f0-9]{64}$/),
  manifest_classification: z.enum(canopyProofAuditExportClassifications),
  channel: z.enum(canopyProofDataAccessDeliveryChannels),
  recipient_actor_id: z.string().min(1),
  delivered_by: z.string().min(1),
  delivered_at: z.coerce.date(),
  purpose: z.string().min(12).max(1_000),
  access_root: z.string().regex(/^[a-f0-9]{64}$/),
  receipt_hash: z.string().regex(/^[a-f0-9]{64}$/),
  delivery_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessDeliverySafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessDeliveryCommandSchema = z.object({
  manifestId: z.string().min(1),
  channel: z.enum(canopyProofDataAccessDeliveryChannels),
  recipientActorId: z.string().min(1),
  purpose: z.string().min(12).max(1_000),
  deliveredAt: z.string().datetime(),
});

const dataUseAttestationSafetySchema = z
  .object({
    deliveryReceiptBound: z.literal(true),
    approvedRequestBound: z.literal(true),
    purposeBound: z.literal(true),
    outputHashOnly: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataUseAttestationRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  delivery_id: z.string().min(1),
  manifest_id: z.string().min(1),
  usage_state: z.enum(canopyProofDataUseAttestationStates),
  use_case: z.string().min(12).max(2_000),
  output_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(128),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(128),
  limitations: z.array(z.string().min(4).max(500)).max(32),
  attested_by: z.string().min(1),
  attested_at: z.coerce.date(),
  attestation_hash: z.string().regex(/^[a-f0-9]{64}$/),
  usage_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataUseAttestationSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataUseAttestationCommandSchema = z.object({
  usageState: z.enum(canopyProofDataUseAttestationStates),
  useCase: z.string().min(12).max(2_000),
  outputHashes: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  limitations: z.array(z.string().min(4).max(500)).max(32).default([]),
  attestedAt: z.string().datetime(),
});

const dataUseEnforcementSafetySchema = z
  .object({
    challengedAttestationBound: z.literal(true),
    deliveryReceiptBound: z.literal(true),
    approvedRequestBound: z.literal(true),
    humanDecisionRequired: z.literal(true),
    independentReviewerRequired: z.literal(true),
    accessMutationRequiresSeparateApproval: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    appendOnly: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataUseEnforcementCaseRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  delivery_id: z.string().min(1),
  attestation_id: z.string().min(1),
  manifest_id: z.string().min(1),
  case_state: z.enum(canopyProofDataUseEnforcementStates),
  enforcement_action: z.enum(canopyProofDataUseEnforcementActions),
  rationale: z.string().min(12).max(2_000),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(128),
  reviewer_id: z.string().min(1),
  reviewed_at: z.coerce.date(),
  enforcement_hash: z.string().regex(/^[a-f0-9]{64}$/),
  enforcement_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataUseEnforcementSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataUseEnforcementCaseCommandSchema = z.object({
  caseState: z.enum(canopyProofDataUseEnforcementStates),
  enforcementAction: z.enum(canopyProofDataUseEnforcementActions),
  rationale: z.string().min(12).max(2_000),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  reviewedAt: z.string().datetime(),
});

const dataAccessRestrictionSafetySchema = z
  .object({
    enforcementCaseBound: z.literal(true),
    approvedRequestBound: z.literal(true),
    separateApprovalPath: z.literal(true),
    independentDecisionRequired: z.literal(true),
    reviewerSeparationRequired: z.literal(true),
    deliveryBlockingEnforced: z.literal(true),
    appendOnly: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessRestrictionRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  enforcement_case_id: z.string().min(1),
  attestation_id: z.string().min(1),
  delivery_id: z.string().min(1),
  previous_restriction_id: z.string().min(1).nullable(),
  previous_restriction_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  previous_restriction_state: z.enum(canopyProofDataAccessRestrictionStates).nullable(),
  restriction_state: z.enum(canopyProofDataAccessRestrictionStates),
  rationale: z.string().min(12).max(2_000),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(128),
  decided_by: z.string().min(1),
  decided_at: z.coerce.date(),
  expires_at: z.coerce.date().nullable(),
  restriction_hash: z.string().regex(/^[a-f0-9]{64}$/),
  restriction_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessRestrictionSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessRestrictionCommandSchema = z.object({
  restrictionState: z.enum(canopyProofDataAccessRestrictionStates),
  rationale: z.string().min(12).max(2_000),
  evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).max(128).default([]),
  decidedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

const dataAccessAccountabilityCountsSchema = z
  .object({
    agreementRevocationCount: z.number().int().min(0).max(2_147_483_647),
    agreementSupersessionCount: z.number().int().min(0).max(2_147_483_647),
    deliveryReceiptCount: z.number().int().min(0).max(2_147_483_647),
    dataUseAttestationCount: z.number().int().min(0).max(2_147_483_647),
    enforcementCaseCount: z.number().int().min(0).max(2_147_483_647),
    activeRestrictionCount: z.number().int().min(0).max(1),
    totalRestrictionCount: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();

const dataAccessAccountabilityLineageRootsSchema = z
  .object({
    accessRoot: z.string().regex(/^[a-f0-9]{64}$/),
    agreementRevocationRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1_024),
    agreementSupersessionRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1_024),
    deliveryRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1_024),
    usageRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1_024),
    enforcementRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1_024),
    restrictionRoots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1_024),
  })
  .strict();

const dataAccessAccountabilityPacketSafetySchema = z
  .object({
    requestBound: z.literal(true),
    appendOnlyLedgerDerived: z.literal(true),
    hashOnlyLineage: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    observerReadable: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessAccountabilityPacketRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  agreement_id: z.string().min(1),
  generated_by: z.string().min(1),
  generated_at: z.coerce.date(),
  intended_audience: z.string().min(3).max(300),
  request_status: z.enum(["pending", "approved", "denied", "revoked", "expired"]),
  counts: dataAccessAccountabilityCountsSchema,
  lineage_roots: dataAccessAccountabilityLineageRootsSchema,
  packet_hash: z.string().regex(/^[a-f0-9]{64}$/),
  packet_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessAccountabilityPacketSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessAccountabilityPacketCommandSchema = z
  .object({
    intendedAudience: z.string().min(3).max(300).default("institutional audit reviewer"),
    generatedAt: z.string().datetime(),
  })
  .strict();

const dataAccessAccountabilityVerificationSafetySchema = z
  .object({
    replayVerification: z.literal(true),
    hashOnlyLineage: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessAccountabilityVerificationRowSchema = z.object({
  id: z.string().min(1),
  packet_id: z.string().min(1),
  organization_id: z.string().min(1),
  request_id: z.string().min(1),
  valid: z.boolean(),
  issues: z.array(z.enum(canopyProofDataAccessAccountabilityIssueCodes)).max(5),
  expected_packet_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  packet_hash: z.string().regex(/^[a-f0-9]{64}$/),
  recomputed_packet_hash: z.string().regex(/^[a-f0-9]{64}$/),
  packet_root: z.string().regex(/^[a-f0-9]{64}$/),
  recomputed_packet_root: z.string().regex(/^[a-f0-9]{64}$/),
  verified_by: z.string().min(1),
  verified_at: z.coerce.date(),
  verification_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessAccountabilityVerificationSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessAccountabilityVerificationCommandSchema = z
  .object({
    expectedPacketRoot: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    verifiedAt: z.string().datetime(),
  })
  .strict();

const dataAccessAccountabilityDisclosureSafetySchema = z
  .object({
    packetBound: z.literal(true),
    validReplayRequired: z.literal(true),
    independentPublicationRequired: z.literal(true),
    appendOnly: z.literal(true),
    hashOnly: z.literal(true),
    observerDiscoverable: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessAccountabilityDisclosureRowSchema = z.object({
  id: z.string().regex(/^cp_data_access_disclosure_[a-f0-9]{24}$/),
  organization_id: z.string().min(1),
  packet_id: z.string().min(1),
  packet_hash: z.string().regex(/^[a-f0-9]{64}$/),
  packet_root: z.string().regex(/^[a-f0-9]{64}$/),
  verification_id: z.string().min(1),
  verification_root: z.string().regex(/^[a-f0-9]{64}$/),
  policy_id: z.literal("canopyproof_policy_partner_accountability_disclosure_v1"),
  published_by: z.string().min(1),
  published_at: z.coerce.date(),
  disclosure_hash: z.string().regex(/^[a-f0-9]{64}$/),
  disclosure_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessAccountabilityDisclosureSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessAccountabilityDisclosureCommandSchema = z
  .object({
    verificationId: z.string().min(1),
    publishedAt: z.string().datetime(),
  })
  .strict();

const dataAccessAccountabilityDisclosureChallengeSafetySchema = z
  .object({
    disclosureBound: z.literal(true),
    publicStatement: z.literal(true),
    appendOnly: z.literal(true),
    humanResolutionRequired: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessAccountabilityDisclosureChallengeRowSchema = z.object({
  id: z.string().regex(/^cp_data_access_disclosure_challenge_[a-f0-9]{24}$/),
  organization_id: z.string().min(1),
  disclosure_id: z.string().min(1),
  disclosure_root: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.enum(canopyProofDataAccessAccountabilityDisclosureChallengeReasons),
  statement: z.string().min(24).max(2_000),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(128),
  challenged_by: z.string().min(1),
  challenger_role: z.enum(canopyProofPartnerRoles),
  challenged_at: z.coerce.date(),
  challenge_hash: z.string().regex(/^[a-f0-9]{64}$/),
  challenge_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessAccountabilityDisclosureChallengeSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessAccountabilityDisclosureChallengeCommandSchema = z
  .object({
    reason: z.enum(canopyProofDataAccessAccountabilityDisclosureChallengeReasons),
    statement: z.string().min(24).max(2_000),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1).max(128),
    challengedAt: z.string().datetime(),
  })
  .strict();

const dataAccessAccountabilityDisclosureResolutionSafetySchema = z
  .object({
    challengeBound: z.literal(true),
    independentHumanReviewRequired: z.literal(true),
    appendOnly: z.literal(true),
    historyPreserved: z.literal(true),
    noAutomatedFinalAuthority: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessAccountabilityDisclosureResolutionRowSchema = z.object({
  id: z.string().regex(/^cp_data_access_disclosure_resolution_[a-f0-9]{24}$/),
  organization_id: z.string().min(1),
  disclosure_id: z.string().min(1),
  challenge_id: z.string().min(1),
  decision: z.enum(canopyProofDataAccessAccountabilityDisclosureResolutionDecisions),
  remedial_action: z.enum(canopyProofDataAccessAccountabilityDisclosureRemedialActions),
  rationale: z.string().min(24).max(2_000),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(128),
  previous_resolution_id: z.string().min(1).nullable(),
  previous_resolution_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  reviewed_by: z.string().min(1),
  reviewer_role: z.enum(["owner", "admin", "verifier"]),
  reviewed_at: z.coerce.date(),
  resolution_hash: z.string().regex(/^[a-f0-9]{64}$/),
  resolution_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessAccountabilityDisclosureResolutionSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessAccountabilityDisclosureResolutionCommandSchema = z
  .object({
    decision: z.enum(canopyProofDataAccessAccountabilityDisclosureResolutionDecisions),
    remedialAction: z.enum(canopyProofDataAccessAccountabilityDisclosureRemedialActions),
    rationale: z.string().min(24).max(2_000),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1).max(128),
    reviewedAt: z.string().datetime(),
  })
  .strict();

const dataAccessAccountabilityDisclosureNoticeSafetySchema = z
  .object({
    resolutionBound: z.literal(true),
    originalDisclosurePreserved: z.literal(true),
    publicStatement: z.literal(true),
    appendOnly: z.literal(true),
    noRawDataEmbedded: z.literal(true),
    noPrivateContactData: z.literal(true),
    notFinalProofAuthority: z.literal(true),
    notCarbonCredit: z.literal(true),
    notFinancialAsset: z.literal(true),
    notTaxOffset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const dataAccessAccountabilityDisclosureNoticeRowSchema = z.object({
  id: z.string().regex(/^cp_data_access_disclosure_notice_[a-f0-9]{24}$/),
  organization_id: z.string().min(1),
  disclosure_id: z.string().min(1),
  challenge_id: z.string().min(1),
  resolution_id: z.string().min(1),
  notice_type: z.enum(canopyProofDataAccessAccountabilityDisclosureNoticeTypes),
  replacement_disclosure_id: z.string().min(1).nullable(),
  statement: z.string().min(24).max(2_000),
  evidence_event_roots: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(128),
  published_by: z.string().min(1),
  publisher_role: z.enum(["owner", "admin"]),
  published_at: z.coerce.date(),
  notice_hash: z.string().regex(/^[a-f0-9]{64}$/),
  notice_root: z.string().regex(/^[a-f0-9]{64}$/),
  safety: dataAccessAccountabilityDisclosureNoticeSafetySchema,
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const dataAccessAccountabilityDisclosureNoticeCommandSchema = z
  .object({
    noticeType: z.enum(canopyProofDataAccessAccountabilityDisclosureNoticeTypes),
    replacementDisclosureId: z.string().min(1).optional(),
    statement: z.string().min(24).max(2_000),
    evidenceEventRoots: z.array(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)).min(1).max(128),
    publishedAt: z.string().datetime(),
  })
  .strict();

const publicDataAccessAccountabilityDisclosureCandidateSchema = z.object({
  id: z.string().regex(/^cp_data_access_disclosure_[a-f0-9]{24}$/),
  organization_id: z.string().min(1),
  published_at: z.coerce.date(),
  current_state: z.enum(canopyProofDataAccessAccountabilityDisclosureStates),
  governance_state: z.enum(canopyProofDataAccessAccountabilityDisclosureGovernanceStates),
});

const publicDataAccessAccountabilityDisclosureAggregateSchema = z.object({
  total_count: z.coerce.number().int().nonnegative(),
  current_count: z.coerce.number().int().nonnegative(),
  stale_count: z.coerce.number().int().nonnegative(),
  challenged_disclosure_count: z.coerce.number().int().nonnegative(),
  open_challenge_count: z.coerce.number().int().nonnegative(),
  corrected_disclosure_count: z.coerce.number().int().nonnegative(),
  withdrawn_disclosure_count: z.coerce.number().int().nonnegative(),
  disclosure_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const auditExportEntryRowSchema = z
  .object({
    id: z.string().min(1),
    resourceType: z.enum(canopyProofAuditExportEntryTypes),
    resourceId: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    eventRoot: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    classification: z.enum(canopyProofAuditExportClassifications),
    redactionPolicy: z.enum(canopyProofAuditExportRedactionPolicies),
    included: z.boolean(),
    reason: z.string().min(8).max(1_000),
  })
  .strict();

const auditExportManifestSafetySchema = z
  .object({
    hashOnlyManifest: z.literal(true),
    rawEvidenceExcluded: z.literal(true),
    personalDataRedacted: z.literal(true),
    preciseLocationRedactedUnlessAuthorized: z.literal(true),
    noFinancialOrCarbonCreditAuthority: z.literal(true),
  })
  .strict();

const auditExportManifestRowSchema = z.object({
  id: z.string().min(1),
  manifest_version: z.literal("canopyproof_audit_export_manifest_v1"),
  manifest_kind: z.enum(canopyProofAuditExportManifestKinds),
  scope: z.enum(canopyProofAuditExportScopes),
  subject_id: z.string().min(1),
  requester_organization_id: z.string().min(1),
  requested_by: z.string().min(1),
  purpose: z.string().min(12).max(1_000),
  classification: z.enum(canopyProofAuditExportClassifications),
  entries: z.array(auditExportEntryRowSchema).min(1),
  entry_root: z.string().regex(/^[a-f0-9]{64}$/),
  redaction_root: z.string().regex(/^[a-f0-9]{64}$/),
  source_event_root: z.string().regex(/^[a-f0-9]{64}$/),
  export_hash: z.string().regex(/^[a-f0-9]{64}$/),
  safety: auditExportManifestSafetySchema,
  expires_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const authorizedUsersSchema = z.array(z.string().min(1));

const commandReceiptRowSchema = z.object({
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
  result_entity_type: z.string().min(1),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(/^[a-f0-9]{64}$/),
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const authorityFenceRowSchema = z.object({
  revision: z.string().regex(/^[1-9][0-9]*$/),
});

const receiptEventBindingSchema = z.object({
  actor_id: z.string().min(1),
  entity_id: z.string().min(1),
  event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

const visualAuthorityFactPayloadRowSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  sequence_no: databaseSafeIntegerSchema.refine((value) => value > 0),
});

const visualAuthorityScopeRowSchema = z.object({
  tenant_id: z.string().min(1),
  organization_id: z.string().min(1),
  project_id: z.string().min(1).nullable(),
});

const visualCanonicalActorRowSchema = z.object({
  id: z.string().min(1),
  participant_type: z.enum(["human", "agent", "organization", "device"]),
  participant_organization_id: z.string().min(1).nullable(),
  roles: z.array(z.string().min(1)),
  participant_verification_status: z.string().min(1),
  organization_verification_status: z.string().min(1),
  membership_roles: z.array(z.string().min(1)),
  agent_capabilities: z.array(z.string().min(1)),
  agent_status: z.string().min(1).nullable(),
  agent_final_authority: z.boolean().nullable(),
  accreditation_id: z.string().min(1).nullable(),
  accreditation_status: z.string().min(1).nullable(),
  accreditation_scope: z.array(z.string().min(1)),
  accreditation_root: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});

const visualSqlEntityTypeByRecordType = {
  acquisition_mission: "acquisition_mission",
  sensor_stream: "sensor_stream",
  multimodal_dataset: "multimodal_dataset",
  dataset_snapshot: "dataset_snapshot",
  media_asset: "media_asset",
  point_cloud_asset: "point_cloud_asset",
  derived_visual_asset: "derived_visual_asset",
  model_definition: "model_definition",
  model_run: "model_run",
  embedding_index: "embedding_index",
  candidate_finding: "candidate_finding",
  review_queue: "review_queue",
  review_queue_snapshot: "review_queue_snapshot",
  review_decision: "review_decision",
  field_verification_task: "field_verification_task",
  field_verification_result: "field_verification_result",
  hard_negative: "hard_negative",
  known_decoy: "known_decoy",
  sensor_domain_gap: "sensor_domain_gap",
  visual_finding: "visual_finding",
  visual_provenance_edge: "visual_provenance_edge",
} as const;

type VisualSqlRecordType = keyof typeof visualSqlEntityTypeByRecordType;

type VisualAuthorityScope = Readonly<{
  tenantId: string;
  organizationId: string;
  projectId?: string;
}>;

export class PrismaCanopyProofTrustRegistryService {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofTrustRegistryStatus {
    return {
      service: "canopyproof-trust-registry",
      storage: "postgresql",
      transactional: true,
      identityWritesDurable: true,
      organizationAuthorityWritesDurable: true,
      dataSharingAgreementWritesDurable: true,
      dataAccessRequestWritesDurable: true,
      dataAccessDeliveryReceiptWritesDurable: true,
      dataUseAttestationWritesDurable: true,
      dataUseEnforcementCaseWritesDurable: true,
      dataAccessRestrictionWritesDurable: true,
      dataAccessAccountabilityPacketWritesDurable: true,
      dataAccessAccountabilityVerificationWritesDurable: true,
      dataAccessAccountabilityDisclosureWritesDurable: true,
      dataAccessAccountabilityDisclosureChallengeWritesDurable: true,
      dataAccessAccountabilityDisclosureResolutionWritesDurable: true,
      dataAccessAccountabilityDisclosureNoticeWritesDurable: true,
      auditExportManifestWritesDurable: true,
      projectLifecycleWritesDurable: true,
      evidenceRegistrationWritesDurable: true,
      mobileEvidenceBindingWritesDurable: true,
      evidenceConsentReceiptWritesDurable: true,
      evidenceConsentRevocationWritesDurable: true,
      evidenceDeviceAttestationWritesDurable: true,
      evidenceMediaUploadIntentWritesDurable: true,
      evidenceMediaObjectWritesDurable: true,
      evidenceMediaDuplicateRelationWritesDurable: true,
      evidenceMediaScanResultWritesDurable: true,
      evidenceMediaProviderReceiptVerificationWritesDurable: true,
      evidenceMediaScannerReceiptVerificationWritesDurable: true,
      evidenceMediaAdapterRoutesMounted: false,
      evidenceMediaReviewTaskWritesDurable: true,
      evidenceMediaReviewAssignmentWritesDurable: true,
      evidenceMediaReviewDecisionWritesDurable: true,
      evidenceMediaCustodyEventWritesDurable: true,
      visualEvidenceAuthorityWritesDurable: true,
      evidenceVerificationWritesDurable: true,
      evidenceChallengeCorrectionWritesDurable: true,
      evidenceFinalDecisionWritesDurable: true,
      governedPolicyWritesDurable: true,
      methodologyVersionWritesDurable: true,
      methodologyPublicationWritesDurable: true,
      environmentalProofCandidateWritesDurable: true,
      environmentalProofApprovalWritesDurable: true,
      environmentalProofRecordWritesDurable: true,
      environmentalProofChallengeWritesDurable: true,
      environmentalProofChallengeRiskWritesDurable: true,
      environmentalProofChallengeReviewWritesDurable: true,
      environmentalProofChallengeResolutionWritesDurable: true,
      semanticAuditAppendOnly: true,
      databaseAuditEnabled: true,
      idempotencyRequired: true,
      privateKeyHandlingDisabled: true,
    };
  }

  async createGovernedPolicy(
    input: unknown,
    governanceOrganizationId: string,
    actorId: string,
    actorRole: "owner" | "admin",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "createdAt");
    const { subject } = governedPolicyCommandRoutingSchema.parse(normalizedInput);
    return this.executeCommand({
      actorId,
      operation: "governance.proof-policy.create",
      idempotencyKey: normalizedKey,
      request: { input: normalizedInput, governanceOrganizationId, actorRole },
      replay: (transaction, resultId) => this.requireGovernedPolicy(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, governedPolicyStreamId(subject));
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          governanceOrganizationId,
        );
        const domain = await this.loadGovernedPolicyDomain(transaction);
        const policy = domain.createPolicy(normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, governedPolicyStreamId(subject), policy.auditEvent);
        await this.insertGovernedPolicy(transaction, policy);
        return commandResult(
          policy,
          "governed_policy_authority",
          policy.id,
          policy.policyRoot,
          policy.auditEvent,
        );
      },
    });
  }

  async listGovernedPolicies(
    governanceOrganizationId: string,
    subject?: CanopyProofGovernedPolicySubject,
  ) {
    return this.read(async (transaction) => {
      const domain = await this.loadGovernedPolicyDomain(transaction);
      return domain
        .listPolicies(subject)
        .filter((policy) => policy.governanceOrganizationId === governanceOrganizationId);
    });
  }

  async getGovernedPolicy(policyId: string, governanceOrganizationId: string) {
    return this.read(async (transaction) => {
      const policy = await this.requireGovernedPolicy(transaction, policyId);
      if (policy.governanceOrganizationId !== governanceOrganizationId) {
        throw new Error("CanopyProof governed policy organization scope mismatch.");
      }
      return policy;
    });
  }

  async getCurrentGovernedPolicy(
    subject: CanopyProofGovernedPolicySubject,
    governanceOrganizationId: string,
  ) {
    return this.read(async (transaction) => {
      const policy = (await this.loadGovernedPolicyDomain(transaction)).getCurrentPolicy(subject);
      if (policy.governanceOrganizationId !== governanceOrganizationId) {
        throw new Error("CanopyProof current governed policy organization scope mismatch.");
      }
      return policy;
    });
  }

  async createMethodologyVersion(
    input: unknown,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "createdAt");
    return this.executeCommand({
      actorId,
      operation: "governance.methodology-version.create",
      idempotencyKey: normalizedKey,
      request: { input: normalizedInput, actorRole },
      replay: (transaction, resultId) => this.requireMethodologyVersion(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, methodologyVersionStreamId());
        const domain = await this.loadMethodologyVersionDomain(transaction);
        const methodology = domain.createMethodology(normalizedInput, actorId);
        await this.insertDomainEvent(transaction, methodology.id, methodology.auditEvent);
        await this.insertMethodologyVersion(transaction, methodology);
        return commandResult(
          methodology,
          "methodology",
          methodology.id,
          methodology.methodologyHash,
          methodology.auditEvent,
        );
      },
    });
  }

  async listMethodologyVersions() {
    return this.read(async (transaction) =>
      (await this.loadMethodologyVersionDomain(transaction)).listMethodologies({ includeAll: true }),
    );
  }

  async getMethodologyVersion(methodologyId: string) {
    return this.read((transaction) => this.requireMethodologyVersion(transaction, methodologyId));
  }

  async approveMethodologyPublication(
    methodologyId: string,
    input: unknown,
    governanceOrganizationId: string,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "decidedAt");
    return this.executeCommand({
      actorId,
      operation: "governance.methodology-publication.approve",
      idempotencyKey: normalizedKey,
      request: { methodologyId, input: normalizedInput, governanceOrganizationId, actorRole },
      replay: (transaction, resultId) => this.requireMethodologyPublicationApproval(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, methodologyId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          governanceOrganizationId,
        );
        const domain = await this.loadMethodologyGovernanceDomain(transaction);
        const approval = domain.approveMethodology(methodologyId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, methodologyId, approval.auditEvent);
        await this.insertMethodologyPublicationApproval(transaction, approval);
        return commandResult(
          approval,
          "methodology_publication_approval",
          approval.id,
          approval.approvalRoot,
          approval.auditEvent,
        );
      },
    });
  }

  async publishMethodology(
    methodologyId: string,
    input: unknown,
    governanceOrganizationId: string,
    actorId: string,
    actorRole: "owner" | "admin",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "publishedAt");
    return this.executeCommand({
      actorId,
      operation: "governance.methodology-publication.publish",
      idempotencyKey: normalizedKey,
      request: { methodologyId, input: normalizedInput, governanceOrganizationId, actorRole },
      replay: (transaction, resultId) => this.requireMethodologyPublication(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, methodologyId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          governanceOrganizationId,
        );
        const domain = await this.loadMethodologyGovernanceDomain(transaction);
        const publication = domain.publishMethodology(methodologyId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, methodologyId, publication.auditEvent);
        await this.insertMethodologyPublication(transaction, publication);
        return commandResult(
          publication,
          "methodology_publication",
          publication.id,
          publication.publicationRoot,
          publication.auditEvent,
        );
      },
    });
  }

  async listMethodologyPublicationApprovals(methodologyId: string, governanceOrganizationId: string) {
    return this.read(async (transaction) => {
      const approvals = (await this.loadMethodologyGovernanceDomain(transaction)).listApprovals(methodologyId);
      if (approvals.some((approval) => approval.governanceOrganizationId !== governanceOrganizationId)) {
        throw new Error("CanopyProof methodology publication approval organization scope mismatch.");
      }
      return approvals;
    });
  }

  async getMethodologyPublication(publicationId: string, governanceOrganizationId: string) {
    return this.read(async (transaction) => {
      const publication = await this.requireMethodologyPublication(transaction, publicationId);
      if (publication.governanceOrganizationId !== governanceOrganizationId) {
        throw new Error("CanopyProof methodology publication organization scope mismatch.");
      }
      return publication;
    });
  }

  async getCurrentMethodologyPublicationBundle(methodologyId: string, governanceOrganizationId: string) {
    return this.read(async (transaction) => {
      const bundle = (await this.loadMethodologyGovernanceDomain(transaction)).getCurrentPublicationBundle(methodologyId);
      if (bundle.publication.governanceOrganizationId !== governanceOrganizationId) {
        throw new Error("CanopyProof methodology publication bundle organization scope mismatch.");
      }
      return bundle;
    });
  }

  async deriveEnvironmentalProofCandidate(
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "derivedAt");
    const routing = environmentalProofCandidateCommandRoutingSchema.parse(normalizedInput);
    return this.executeCommand({
      actorId,
      operation: "environmental-proof.candidate.derive",
      idempotencyKey: normalizedKey,
      request: { input: normalizedInput, organizationId, actorRole },
      replay: (transaction, resultId) => this.requireEnvironmentalProofCandidate(transaction, resultId),
      execute: async (transaction) => {
        const initialSources = await this.loadEnvironmentalProofSources(
          transaction,
          routing.projectId,
          routing.evidenceIds,
        );
        const initialActor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const initial = new CanopyProofEnvironmentalProofAuthorityService().deriveCandidate(
          normalizedInput,
          actorInput(initialActor),
          initialSources,
        );
        await this.lockSemanticStreams(transaction, [
          initial.id,
          routing.projectId,
          routing.methodologyId,
          routing.policyId,
          ...routing.evidenceIds,
        ]);
        const sources = await this.loadEnvironmentalProofSources(
          transaction,
          routing.projectId,
          routing.evidenceIds,
        );
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const candidate = new CanopyProofEnvironmentalProofAuthorityService().deriveCandidate(
          normalizedInput,
          actorInput(actor),
          sources,
        );
        if (candidate.id !== initial.id || candidate.organizationId !== organizationId) {
          throw new Error("CanopyProof Environmental Proof candidate source authority changed while locking.");
        }
        await this.insertDomainEvent(transaction, candidate.id, candidate.auditEvent);
        await this.insertEnvironmentalProofCandidate(transaction, candidate);
        return commandResult(
          candidate,
          "environmental_proof_candidate",
          candidate.id,
          candidate.candidateRoot,
          candidate.auditEvent,
        );
      },
    });
  }

  async approveEnvironmentalProofCandidate(
    candidateId: string,
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "decidedAt");
    return this.executeCommand({
      actorId,
      operation: "environmental-proof.candidate.approve",
      idempotencyKey: normalizedKey,
      request: { candidateId, input: normalizedInput, organizationId, actorRole },
      replay: (transaction, resultId) => this.requireEnvironmentalProofApproval(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, candidateId);
        const candidate = await this.requireEnvironmentalProofCandidate(transaction, candidateId);
        if (candidate.organizationId !== organizationId) {
          throw new Error("CanopyProof Environmental Proof candidate organization scope mismatch.");
        }
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const domain = await this.loadEnvironmentalProofDomain(transaction);
        const approval = domain.approveCandidate(candidateId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, candidateId, approval.auditEvent);
        await this.insertEnvironmentalProofApproval(transaction, approval);
        return commandResult(
          approval,
          "environmental_proof_candidate_approval",
          approval.id,
          approval.approvalRoot,
          approval.auditEvent,
        );
      },
    });
  }

  async issueEnvironmentalProofRecord(
    candidateId: string,
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "issuedAt");
    return this.executeCommand({
      actorId,
      operation: "environmental-proof.record.issue",
      idempotencyKey: normalizedKey,
      request: { candidateId, input: normalizedInput, organizationId, actorRole },
      replay: (transaction, resultId) => this.requireEnvironmentalProofRecord(transaction, resultId),
      execute: async (transaction) => {
        const candidate = await this.requireEnvironmentalProofCandidate(transaction, candidateId);
        if (candidate.organizationId !== organizationId) {
          throw new Error("CanopyProof Environmental Proof candidate organization scope mismatch.");
        }
        await this.lockSemanticStreams(transaction, [candidateId, candidate.projectId, ...candidate.evidenceIds]);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const domain = await this.loadEnvironmentalProofDomain(transaction);
        const currentSources = await this.loadEnvironmentalProofSources(
          transaction,
          candidate.projectId,
          candidate.evidenceIds,
        );
        const record = domain.issueRecord(candidateId, normalizedInput, actorInput(actor), currentSources);
        await this.insertDomainEvent(transaction, candidateId, record.auditEvent);
        await this.insertEnvironmentalProofRecord(transaction, record);
        return commandResult(
          record,
          "environmental_proof_record",
          record.id,
          record.recordRoot,
          record.auditEvent,
        );
      },
    });
  }

  async getEnvironmentalProofCandidate(candidateId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const candidate = await this.requireEnvironmentalProofCandidate(transaction, candidateId);
      if (candidate.organizationId !== organizationId) {
        throw new Error("CanopyProof Environmental Proof candidate organization scope mismatch.");
      }
      return candidate;
    });
  }

  async listEnvironmentalProofApprovals(candidateId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const candidate = await this.requireEnvironmentalProofCandidate(transaction, candidateId);
      if (candidate.organizationId !== organizationId) {
        throw new Error("CanopyProof Environmental Proof candidate organization scope mismatch.");
      }
      return (await this.loadEnvironmentalProofDomain(transaction)).listApprovals(candidateId);
    });
  }

  async getEnvironmentalProofRecord(recordId: string, organizationId: string) {
    return this.read(async (transaction) => {
      return this.getEnvironmentalProofRecordInTransaction(transaction, recordId, organizationId);
    });
  }

  /** Reuses a caller-owned transaction whose tenant context is already established. */
  async getEnvironmentalProofRecordInTransaction(
    transaction: Prisma.TransactionClient,
    recordId: string,
    organizationId: string,
  ) {
    const record = await this.requireEnvironmentalProofRecord(transaction, recordId);
    if (record.organizationId !== organizationId) {
      throw new Error("CanopyProof Environmental Proof record organization scope mismatch.");
    }
    return record;
  }

  async getEnvironmentalProofRecordStatus(recordId: string, organizationId: string) {
    return this.read((transaction) =>
      this.getEnvironmentalProofRecordStatusInTransaction(transaction, recordId, organizationId));
  }

  /** Reuses a caller-owned transaction whose tenant context is already established. */
  async getEnvironmentalProofRecordStatusInTransaction(
    transaction: Prisma.TransactionClient,
    recordId: string,
    organizationId: string,
  ) {
    const record = await this.getEnvironmentalProofRecordInTransaction(
      transaction,
      recordId,
      organizationId,
    );
    const currentSources = await this.loadEnvironmentalProofSources(
      transaction,
      record.projectId,
      record.evidenceIds,
    );
    return (await this.loadEnvironmentalProofChallengeDomain(transaction)).projectRecordStatus(
      recordId,
      currentSources,
    );
  }

  async openEnvironmentalProofChallenge(
    recordId: string,
    input: unknown,
    challengerOrganizationId: string,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "openedAt");
    return this.executeCommand({
      actorId,
      operation: "environmental-proof.challenge.open",
      idempotencyKey: normalizedKey,
      request: { recordId, input: normalizedInput, challengerOrganizationId, actorRole },
      replay: (transaction, resultId) => this.requireEnvironmentalProofChallengeBundle(transaction, resultId),
      execute: async (transaction) => {
        const initialRecord = await this.requireEnvironmentalProofRecord(transaction, recordId);
        await this.lockSemanticStreams(transaction, [
          initialRecord.candidateId,
          initialRecord.projectId,
          ...initialRecord.evidenceIds,
        ]);
        const record = await this.requireEnvironmentalProofRecord(transaction, recordId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          challengerOrganizationId,
        );
        const currentSources = await this.loadEnvironmentalProofSources(
          transaction,
          record.projectId,
          record.evidenceIds,
        );
        const domain = await this.loadEnvironmentalProofChallengeDomain(transaction);
        const bundle = domain.openChallenge(recordId, normalizedInput, actorInput(actor), currentSources);
        await this.insertDomainEvent(transaction, record.candidateId, bundle.challenge.auditEvent);
        await this.insertEnvironmentalProofChallenge(transaction, bundle.challenge);
        await this.insertDomainEvent(transaction, record.candidateId, bundle.riskSignal.auditEvent);
        await this.insertEnvironmentalProofChallengeRisk(transaction, bundle.riskSignal);
        return commandResult(
          bundle,
          "environmental_proof_challenge",
          bundle.challenge.id,
          bundle.challenge.challengeRoot,
          bundle.challenge.auditEvent,
        );
      },
    });
  }

  async reviewEnvironmentalProofChallenge(
    challengeId: string,
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "reviewedAt");
    return this.executeCommand({
      actorId,
      operation: "environmental-proof.challenge.review",
      idempotencyKey: normalizedKey,
      request: { challengeId, input: normalizedInput, organizationId, actorRole },
      replay: (transaction, resultId) => this.requireEnvironmentalProofChallengeReview(transaction, resultId),
      execute: async (transaction) => {
        const initial = await this.requireEnvironmentalProofChallenge(transaction, challengeId);
        await this.lockSemanticStream(transaction, initial.candidateId);
        const domain = await this.loadEnvironmentalProofChallengeDomain(transaction);
        const challenge = domain.getChallenge(challengeId);
        if (challenge.organizationId !== organizationId) {
          throw new Error("CanopyProof Environmental Proof challenge review organization scope mismatch.");
        }
        const actor = await this.loadVerificationActorSnapshot(transaction, actorId, actorRole, organizationId);
        const review = domain.reviewChallenge(challengeId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, challenge.candidateId, review.auditEvent);
        await this.insertEnvironmentalProofChallengeReview(transaction, review);
        return commandResult(
          review,
          "environmental_proof_challenge_review",
          review.id,
          review.reviewRoot,
          review.auditEvent,
        );
      },
    });
  }

  async resolveEnvironmentalProofChallenge(
    challengeId: string,
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "resolvedAt");
    return this.executeCommand({
      actorId,
      operation: "environmental-proof.challenge.resolve",
      idempotencyKey: normalizedKey,
      request: { challengeId, input: normalizedInput, organizationId, actorRole },
      replay: (transaction, resultId) => this.requireEnvironmentalProofChallengeResolution(transaction, resultId),
      execute: async (transaction) => {
        const initial = await this.requireEnvironmentalProofChallenge(transaction, challengeId);
        await this.lockSemanticStream(transaction, initial.candidateId);
        const domain = await this.loadEnvironmentalProofChallengeDomain(transaction);
        const challenge = domain.getChallenge(challengeId);
        if (challenge.organizationId !== organizationId) {
          throw new Error("CanopyProof Environmental Proof challenge resolution organization scope mismatch.");
        }
        const actor = await this.loadVerificationActorSnapshot(transaction, actorId, actorRole, organizationId);
        const resolution = domain.resolveChallenge(challengeId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, challenge.candidateId, resolution.auditEvent);
        await this.insertEnvironmentalProofChallengeResolution(transaction, resolution);
        return commandResult(
          resolution,
          "environmental_proof_challenge_resolution",
          resolution.id,
          resolution.resolutionRoot,
          resolution.auditEvent,
        );
      },
    });
  }

  async getEnvironmentalProofChallenge(challengeId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const challenge = await this.requireEnvironmentalProofChallenge(transaction, challengeId);
      if (challenge.organizationId !== organizationId) {
        throw new Error("CanopyProof Environmental Proof challenge organization scope mismatch.");
      }
      return challenge;
    });
  }

  async listEnvironmentalProofChallengeReviews(challengeId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const domain = await this.loadEnvironmentalProofChallengeDomain(transaction);
      const challenge = domain.getChallenge(challengeId);
      if (challenge.organizationId !== organizationId) {
        throw new Error("CanopyProof Environmental Proof challenge organization scope mismatch.");
      }
      return domain.listReviews(challengeId);
    });
  }

  async getEnvironmentalProofChallengeStatus(challengeId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const domain = await this.loadEnvironmentalProofChallengeDomain(transaction);
      const challenge = domain.getChallenge(challengeId);
      if (challenge.organizationId !== organizationId) {
        throw new Error("CanopyProof Environmental Proof challenge organization scope mismatch.");
      }
      return domain.projectChallenge(challengeId);
    });
  }

  async registerProject(
    input: unknown,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "createdAt");
    const candidate = new CanopyProofProjectRegistryService().registerProject(normalizedInput, actorId, actorRole);
    if (candidate.status !== "submitted" || candidate.governanceApprovalId) {
      throw new Error("CanopyProof durable project registration must begin in submitted state without an approval.");
    }
    return this.executeCommand({
      actorId,
      operation: "project.registration.create",
      idempotencyKey: normalizedKey,
      request: normalizedInput,
      replay: (transaction, resultId) => this.requireProjectRegistration(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, candidate.id);
        await this.touchAuthorityFence(transaction, projectAuthorityFenceId(candidate.id));
        const existing = await this.loadProjectRegistration(transaction, candidate.id);
        if (existing) {
          if (existing.projectHash !== candidate.projectHash || existing.projectRoot !== candidate.projectRoot) {
            throw conflict();
          }
          return commandResult(
            existing,
            "project",
            existing.id,
            existing.projectRoot,
            requireLastAuditEvent(existing.auditHistory),
          );
        }
        const auditEvent = requireLastAuditEvent(candidate.auditHistory);
        await this.insertDomainEvent(transaction, candidate.id, auditEvent);
        await this.insertProjectRegistration(transaction, candidate);
        return commandResult(candidate, "project", candidate.id, candidate.projectRoot, auditEvent);
      },
    });
  }

  async updateProjectStatus(
    projectId: string,
    input: unknown,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "updatedAt");
    return this.executeCommand({
      actorId,
      operation: "project.status.transition",
      idempotencyKey: normalizedKey,
      request: { projectId, input: normalizedInput, actorRole },
      replay: async (transaction, transitionId) => {
        const transition = await this.requireProjectStatusTransition(transaction, transitionId);
        return this.requireProjectAtSequence(
          transaction,
          transition.projectId,
          transition.auditEvent,
        );
      },
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, projectId);
        await this.touchAuthorityFence(transaction, projectAuthorityFenceId(projectId));
        const domain = await this.requireProjectDomain(transaction, projectId);
        const updated = domain.updateProjectStatus(projectId, normalizedInput, actorId, actorRole);
        const transition = domain.listProjectStatusTransitions(projectId).at(-1);
        if (!transition) throw unavailable();
        await this.insertDomainEvent(transaction, projectId, transition.auditEvent);
        await this.insertProjectStatusTransition(transaction, transition);
        return commandResult(
          updated,
          "project_status_transition",
          transition.id,
          transition.transitionRoot,
          transition.auditEvent,
        );
      },
    });
  }

  async recordProjectMonitoringEvent(
    projectId: string,
    input: unknown,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    return this.executeCommand({
      actorId,
      operation: "project.monitoring.record",
      idempotencyKey: normalizedKey,
      request: { projectId, input, actorRole },
      replay: (transaction, eventId) => this.requireProjectMonitoringEvent(transaction, eventId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, projectId);
        await this.touchAuthorityFence(transaction, projectAuthorityFenceId(projectId));
        const domain = await this.requireProjectDomain(transaction, projectId);
        const monitoringEvent = domain.recordMonitoringEvent(projectId, input, actorId, actorRole);
        await this.insertDomainEvent(transaction, projectId, monitoringEvent.auditEvent);
        await this.insertProjectMonitoringEvent(transaction, monitoringEvent);
        return commandResult(
          monitoringEvent,
          "project_monitoring_event",
          monitoringEvent.id,
          monitoringEvent.monitoringRoot,
          monitoringEvent.auditEvent,
        );
      },
    });
  }

  async listProjects(
    filter: Readonly<{
      organizationId?: string;
      regionId?: string;
      projectType?: CanopyProofProjectType;
      status?: CanopyProofProjectStatus;
      limit?: number;
    }> = {},
  ) {
    const limit = boundedProjectReadLimit(filter.limit);
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT registration.id
        FROM projects.projects registration
        JOIN LATERAL projects.current_authority(registration.id) authority ON true
        WHERE (${filter.organizationId ?? null}::text IS NULL OR registration.organization_id = ${filter.organizationId ?? null})
          AND (${filter.regionId ?? null}::text IS NULL OR registration.region_id = ${filter.regionId ?? null})
          AND (${filter.projectType ?? null}::text IS NULL OR registration.project_type = ${filter.projectType ?? null})
          AND (${filter.status ?? null}::text IS NULL OR authority.status = ${filter.status ?? null})
        ORDER BY registration.title ASC, registration.id ASC
        LIMIT ${limit}
      `);
      if (rows.length === 0) return [];
      const domain = await this.loadProjectDomain(transaction, rows.map((row) => idRow(row)));
      return domain.listProjects(filter);
    });
  }

  async getProject(projectId: string) {
    return this.read(async (transaction) => (await this.requireProjectDomain(transaction, projectId)).getProject(projectId));
  }

  async listProjectStatusTransitions(projectId: string) {
    return this.read(async (transaction) =>
      (await this.requireProjectDomain(transaction, projectId)).listProjectStatusTransitions(projectId),
    );
  }

  async listProjectMonitoringEvents(
    filter: Readonly<{
      projectId?: string;
      state?: CanopyProofProjectMonitoringState;
      eventType?: CanopyProofProjectMonitoringEventType;
      limit?: number;
    }> = {},
  ) {
    const limit = boundedProjectReadLimit(filter.limit);
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ project_id: string }>>(Prisma.sql`
        SELECT DISTINCT monitoring.project_id
        FROM projects.monitoring_events monitoring
        WHERE (${filter.projectId ?? null}::text IS NULL OR monitoring.project_id = ${filter.projectId ?? null})
          AND (${filter.state ?? null}::text IS NULL OR monitoring.state = ${filter.state ?? null})
          AND (${filter.eventType ?? null}::text IS NULL OR monitoring.event_type = ${filter.eventType ?? null})
        ORDER BY monitoring.project_id ASC
        LIMIT ${limit}
      `);
      if (rows.length === 0) return [];
      const projectIds = rows.map((row) => row.project_id);
      const domain = await this.loadProjectDomain(transaction, projectIds);
      return domain.listMonitoringEvents(filter).slice(0, limit);
    });
  }

  async getProjectMonitoringEvent(eventId: string) {
    return this.read((transaction) => this.requireProjectMonitoringEvent(transaction, eventId));
  }

  async getProjectRegistryStatus(): Promise<CanopyProofProjectRegistryStatus> {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        WITH current_projects AS (
          SELECT registration.id, authority.status, authority.project_root
          FROM projects.projects registration
          JOIN LATERAL projects.current_authority(registration.id) authority ON true
        ), project_aggregate AS (
          SELECT
            COUNT(*)::text AS project_count,
            COUNT(*) FILTER (WHERE status IN ('active', 'monitored'))::text AS active_project_count,
            COUNT(*) FILTER (WHERE status = 'challenged')::text AS challenged_project_count,
            audit.merkle_root(COALESCE(array_agg(project_root ORDER BY project_root), ARRAY[]::text[])) AS project_root
          FROM current_projects
        ), monitoring_aggregate AS (
          SELECT
            COUNT(*)::text AS monitoring_event_count,
            COUNT(*) FILTER (WHERE state = 'challenged')::text AS challenged_monitoring_event_count,
            audit.merkle_root(COALESCE(array_agg(event_hash ORDER BY event_hash), ARRAY[]::text[])) AS monitoring_root
          FROM projects.monitoring_events
        ), transition_aggregate AS (
          SELECT COUNT(*)::text AS status_transition_count
          FROM projects.project_status_transitions
        )
        SELECT * FROM project_aggregate, monitoring_aggregate, transition_aggregate
      `);
      if (rows.length !== 1) throw unavailable();
      const parsed = projectRegistryAggregateRowSchema.safeParse(rows[0]);
      if (!parsed.success) throw unavailable();
      return {
        service: "canopyproof-project-registry",
        projectCount: parsed.data.project_count,
        activeProjectCount: parsed.data.active_project_count,
        challengedProjectCount: parsed.data.challenged_project_count,
        statusTransitionCount: parsed.data.status_transition_count,
        monitoringEventCount: parsed.data.monitoring_event_count,
        challengedMonitoringEventCount: parsed.data.challenged_monitoring_event_count,
        projectRoot:
          parsed.data.project_count === 0
            ? hashJson({ kind: "canopyproof-empty-project-root-v1" })
            : parsed.data.project_root,
        monitoringRoot:
          parsed.data.monitoring_event_count === 0
            ? hashJson({ kind: "canopyproof-empty-project-monitoring-root-v1" })
            : parsed.data.monitoring_root,
        supportedProjectTypes: canopyProofProjectTypes,
        supportedStatuses: canopyProofProjectStatuses,
        supportedMonitoringEventTypes: canopyProofProjectMonitoringEventTypes,
        supportedMonitoringStates: canopyProofProjectMonitoringStates,
        safety: {
          projectsAreAudited: true,
          monitoringEventsAreAudited: true,
          publicClaimsBounded: true,
          activeStatusRequiresGovernanceApproval: true,
          noFinancialOrCarbonCreditClaims: true,
        },
      };
    });
  }

  async registerEvidence(
    input: unknown,
    actorId: string,
    actorRole: CanopyProofEvidenceContributorRole,
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "createdAt");
    const projectId = requireObjectString(normalizedInput, "projectId");
    return this.executeCommand({
      actorId,
      operation: "evidence.registration.create",
      idempotencyKey: normalizedKey,
      request: { input, actorRole },
      replay: async (transaction, evidenceId) => evidenceRegistrationResult(await this.requireEvidenceRegistration(transaction, evidenceId)),
      execute: async (transaction) => {
        await this.lockProjectAuthorityShared(transaction, projectId);
        await this.observeAuthorityFence(transaction, projectAuthorityFenceId(projectId));
        return this.registerEvidenceInTransaction(transaction, normalizedInput, actorId, actorRole);
      },
    });
  }

  async registerMobileEvidenceWithAuthority(
    input: unknown,
    requirements: CanopyProofMobileEvidenceBindingAuthorityRequirements,
    idempotencyKey: string,
  ): Promise<CanopyProofMobileEvidenceAtomicRegistrationResult> {
    const normalizedInput = withTimestamp(input, "createdAt");
    const projectId = requireObjectString(normalizedInput, "projectId");
    if (projectId !== requirements.projectId) throw conflict();
    const evaluatedAt = z.string().datetime().parse(requirements.evaluatedAt);
    const request = {
      input: normalizedInput,
      actor: requirements.actor,
      projectId: requirements.projectId,
      consentReceiptId: requirements.consentReceiptId,
      deviceAttestationId: requirements.deviceAttestationId,
      deviceFingerprintHash: requirements.deviceFingerprintHash,
    } as const;
    return this.executeCommand({
      actorId: requirements.actor.id,
      organizationId: requirements.actor.organizationId,
      operation: "evidence.mobile-binding.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request,
      replay: async (transaction, evidenceId) => {
        const evidence = await this.requireEvidenceRegistration(transaction, evidenceId);
        const consent = await this.requireEvidenceConsentReceipt(transaction, requirements.consentReceiptId);
        const device = await this.requireEvidenceDeviceAttestation(transaction, requirements.deviceAttestationId);
        if (
          evidence.organizationId !== requirements.actor.organizationId ||
          evidence.projectId !== requirements.projectId ||
          evidence.contributor !== requirements.actor.id ||
          consent.organizationId !== requirements.actor.organizationId ||
          consent.subjectId !== requirements.actor.id ||
          device.organizationId !== requirements.actor.organizationId ||
          device.subjectId !== requirements.actor.id ||
          device.consentReceiptId !== consent.id
        ) {
          throw unavailable();
        }
        return { registration: evidenceRegistrationResult(evidence), consent, device };
      },
      execute: async (transaction) => {
        // Consent/device mutation commands use the same subject stream lock. Taking it
        // before the project shared lock makes authorization and registration atomic.
        await this.lockSemanticStream(transaction, evidenceCustodyStreamId(requirements.actor.id));
        await this.touchAuthorityFence(
          transaction,
          evidenceCustodyFenceId(requirements.actor.id),
        );
        await this.lockProjectAuthorityShared(transaction, projectId);
        await this.observeAuthorityFence(transaction, projectAuthorityFenceId(projectId));
        const actor = await this.loadEvidenceCustodyActorSnapshot(
          transaction,
          requirements.actor.id,
          requirements.actor.role,
          requirements.actor.organizationId,
        );
        const project = (await this.requireProjectDomain(transaction, projectId)).getProject(projectId);
        const consent = await this.requireEvidenceConsentReceipt(transaction, requirements.consentReceiptId);
        const device = await this.requireEvidenceDeviceAttestation(transaction, requirements.deviceAttestationId);
        assertEvidenceCustodyOrganization(consent.organizationId, requirements.actor.organizationId);
        assertEvidenceCustodyOrganization(device.organizationId, requirements.actor.organizationId);
        const consentProjection = await this.loadEvidenceConsentProjection(
          transaction,
          consent,
          evaluatedAt,
        );
        const deviceProjection = await this.loadEvidenceEffectiveDeviceProjection(
          transaction,
          device,
          evaluatedAt,
        );
        assertCanopyProofMobileEvidenceBindingAuthority(
          { actor, project, consent, consentProjection, device, deviceProjection },
          requirements,
        );
        const registration = await this.registerEvidenceInTransaction(
          transaction,
          normalizedInput,
          requirements.actor.id,
          requirements.actor.role,
        );
        return {
          ...registration,
          value: { registration: registration.value, consent, device },
        };
      },
    });
  }

  private async registerEvidenceInTransaction(
    transaction: TrustTransaction,
    input: unknown,
    actorId: string,
    actorRole: CanopyProofEvidenceContributorRole,
  ): Promise<CommandResult<ReturnType<typeof evidenceRegistrationResult>>> {
    const projectId = requireObjectString(input, "projectId");
    const project = (await this.requireProjectDomain(transaction, projectId)).getProject(projectId);
    const candidate = new CanopyProofEvidenceRegistryService().registerEvidence(
      input,
      {
        id: project.id,
        organizationId: project.organizationId,
        regionId: project.regionId,
        status: project.status,
        projectRoot: project.projectRoot,
        updatedAt: project.updatedAt,
      },
      actorId,
      actorRole,
    );
    await this.lockSemanticStream(transaction, candidate.evidence.id);
    await this.lockEvidenceMedia(transaction, candidate.evidence.media_hash);
    const existing = await this.loadEvidenceRegistration(transaction, candidate.evidence.id);
    if (existing) {
      if (
        existing.evidenceHash !== candidate.evidence.evidenceHash ||
        existing.evidenceRoot !== candidate.evidence.evidenceRoot
      ) {
        throw conflict();
      }
      return commandResult(
        evidenceRegistrationResult(existing),
        "evidence",
        existing.id,
        existing.evidenceRoot,
        existing.audit_history[0],
      );
    }
    const duplicate = await this.findEvidenceByMediaHash(transaction, candidate.evidence.media_hash);
    if (duplicate) throw conflict();
    const auditEvent = candidate.evidence.audit_history[0];
    if (!auditEvent) throw unavailable();
    await this.insertDomainEvent(transaction, candidate.evidence.id, auditEvent);
    await this.insertEvidenceRegistration(transaction, candidate.evidence);
    return commandResult(
      candidate,
      "evidence",
      candidate.evidence.id,
      candidate.evidence.evidenceRoot,
      auditEvent,
    );
  }

  async listEvidence(
    filter: Readonly<{
      organizationId?: string;
      projectId?: string;
      evidenceType?: CanopyProofEvidenceType;
      verificationStatus?: CanopyProofEvidenceRegistrationStatus;
      limit?: number;
    }> = {},
  ) {
    const limit = boundedEvidenceReadLimit(filter.limit);
    return this.read(async (transaction) => {
      const rows = await this.loadEvidenceRegistrationRows(transaction, Prisma.sql`
        WHERE (${filter.organizationId ?? null}::text IS NULL OR registration.organization_id = ${filter.organizationId ?? null})
          AND (${filter.projectId ?? null}::text IS NULL OR registration.project_id = ${filter.projectId ?? null})
          AND (${filter.evidenceType ?? null}::text IS NULL OR registration.evidence_type = ${filter.evidenceType ?? null})
          AND (${filter.verificationStatus ?? null}::text IS NULL OR registration.verification_status = ${filter.verificationStatus ?? null})
        ORDER BY registration.created_at DESC, registration.id ASC
        LIMIT ${limit}
      `);
      return hydrateEvidenceAuthoritySnapshot({ registrations: rows.map((row) => mapEvidenceRegistration(row)) })
        .listEvidence(filter);
    });
  }

  async getEvidence(evidenceId: string) {
    return this.read((transaction) => this.requireEvidenceRegistration(transaction, evidenceId));
  }

  async getEvidenceRegistryStatus(): Promise<CanopyProofEvidenceRegistryStatus> {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT
          COUNT(*)::text AS registration_count,
          COUNT(*) FILTER (WHERE verification_status = 'validated')::text AS validated_count,
          COUNT(*) FILTER (WHERE verification_status = 'challenged')::text AS challenged_count,
          audit.merkle_root(COALESCE(array_agg(evidence_root ORDER BY evidence_root), ARRAY[]::text[])) AS evidence_root
        FROM evidence.evidence_objects
        WHERE evidence_root IS NOT NULL
      `);
      if (rows.length !== 1) throw unavailable();
      const parsed = evidenceRegistryAggregateRowSchema.safeParse(rows[0]);
      if (!parsed.success) throw unavailable();
      return {
        service: "canopyproof-evidence-registry",
        registrationCount: parsed.data.registration_count,
        validatedCount: parsed.data.validated_count,
        challengedCount: parsed.data.challenged_count,
        evidenceRoot:
          parsed.data.registration_count === 0
            ? hashJson({ kind: "canopyproof-empty-evidence-registration-root-v1" })
            : parsed.data.evidence_root,
        supportedEvidenceTypes: canopyProofEvidenceTypes,
        supportedContributorRoles: canopyProofEvidenceContributorRoles,
        safety: {
          registrationsImmutable: true,
          projectRootBound: true,
          structuralValidationNotFinal: true,
          aiCannotApprove: true,
          noFinancialOrCarbonCreditClaims: true,
        },
      };
    });
  }

  async runEvidenceValidation(
    evidenceId: string,
    input: unknown,
    actorId: string,
    actorRole: "agent" | "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "executedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.validation.run",
      idempotencyKey: normalizedKey,
      request: { evidenceId, input: normalizedInput, actorRole },
      replay: (transaction, resultId) => this.requireEvidenceValidationRun(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceId);
        const registration = await this.requireEvidenceRegistration(transaction, evidenceId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          registration.organizationId,
        );
        const domain = await this.loadEvidenceVerificationDomain(transaction, evidenceId);
        const run = domain.runValidation(evidenceId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, evidenceId, run.auditEvent);
        await this.insertEvidenceValidationRun(transaction, run);
        return commandResult(run, "validation_run", run.id, run.validationRoot, run.auditEvent);
      },
    });
  }

  async recordEvidenceAiAnalysis(
    evidenceId: string,
    input: unknown,
    actorId: string,
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "analyzedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.ai-analysis.record",
      idempotencyKey: normalizedKey,
      request: { evidenceId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireEvidenceAiAnalysis(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceId);
        const registration = await this.requireEvidenceRegistration(transaction, evidenceId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          "agent",
          registration.organizationId,
        );
        const domain = await this.loadEvidenceVerificationDomain(transaction, evidenceId);
        const analysis = domain.recordAiAnalysis(evidenceId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, evidenceId, analysis.auditEvent);
        await this.insertEvidenceAiAnalysis(transaction, analysis);
        return commandResult(analysis, "ai_analysis", analysis.id, analysis.analysisRoot, analysis.auditEvent);
      },
    });
  }

  async recordEvidenceHumanReview(
    evidenceId: string,
    input: unknown,
    actorId: string,
    actorRole: "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "reviewedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.human-review.record",
      idempotencyKey: normalizedKey,
      request: { evidenceId, input: normalizedInput, actorRole },
      replay: (transaction, resultId) => this.requireEvidenceHumanReview(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceId);
        const registration = await this.requireEvidenceRegistration(transaction, evidenceId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          registration.organizationId,
        );
        const domain = await this.loadEvidenceVerificationDomain(transaction, evidenceId);
        const review = domain.recordHumanReview(evidenceId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, evidenceId, review.auditEvent);
        await this.insertEvidenceHumanReview(transaction, review);
        return commandResult(review, "human_review", review.id, review.reviewRoot, review.auditEvent);
      },
    });
  }

  async openEvidenceChallenge(
    evidenceId: string,
    input: unknown,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    actorOrganizationId: string,
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "challengedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.challenge.open",
      idempotencyKey: normalizedKey,
      request: { evidenceId, input: normalizedInput, actorRole, actorOrganizationId },
      replay: (transaction, resultId) => this.requireEvidenceChallenge(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceId);
        await this.requireEvidenceRegistration(transaction, evidenceId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          actorOrganizationId,
        );
        const domain = await this.loadEvidenceVerificationDomain(transaction, evidenceId);
        const challenge = domain.openChallenge(evidenceId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, evidenceId, challenge.auditEvent);
        await this.insertEvidenceChallenge(transaction, challenge);
        return commandResult(challenge, "evidence_challenge", challenge.id, challenge.challengeRoot, challenge.auditEvent);
      },
    });
  }

  async resolveEvidenceChallenge(
    challengeId: string,
    input: unknown,
    actorId: string,
    actorRole: "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "reviewedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.challenge.resolve",
      idempotencyKey: normalizedKey,
      request: { challengeId, input: normalizedInput, actorRole },
      replay: (transaction, resultId) => this.requireEvidenceChallengeResolution(transaction, resultId),
      execute: async (transaction) => {
        const reference = await this.requireEvidenceChallengeReference(transaction, challengeId);
        await this.lockSemanticStream(transaction, reference.evidenceId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          reference.organizationId,
        );
        const domain = await this.loadEvidenceVerificationDomain(transaction, reference.evidenceId);
        const resolution = domain.resolveChallenge(challengeId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, reference.evidenceId, resolution.auditEvent);
        await this.insertEvidenceChallengeResolution(transaction, resolution);
        return commandResult(
          resolution,
          "evidence_challenge_resolution",
          resolution.id,
          resolution.resolutionRoot,
          resolution.auditEvent,
        );
      },
    });
  }

  async recordEvidenceCorrection(
    resolutionId: string,
    input: unknown,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier",
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "correctedAt");
    const replacementEvidenceId = optionalStringField(normalizedInput, "replacementEvidenceId");
    return this.executeCommand({
      actorId,
      operation: "evidence.correction.record",
      idempotencyKey: normalizedKey,
      request: { resolutionId, input: normalizedInput, actorRole },
      replay: (transaction, resultId) => this.requireEvidenceCorrection(transaction, resultId),
      execute: async (transaction) => {
        const reference = await this.requireEvidenceChallengeResolutionReference(transaction, resolutionId);
        const streamIds = [...new Set([reference.evidenceId, ...(replacementEvidenceId ? [replacementEvidenceId] : [])])].sort();
        for (const streamId of streamIds) await this.lockSemanticStream(transaction, streamId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          actorRole,
          reference.organizationId,
        );
        const domain = await this.loadEvidenceVerificationDomains(transaction, streamIds);
        const correction = domain.recordCorrection(resolutionId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, reference.evidenceId, correction.auditEvent);
        await this.insertEvidenceCorrection(transaction, correction);
        return commandResult(
          correction,
          "evidence_correction",
          correction.id,
          correction.correctionRoot,
          correction.auditEvent,
        );
      },
    });
  }

  async recordEvidenceFinalDecision(
    evidenceId: string,
    input: unknown,
    actorId: string,
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedInput = withTimestamp(input, "decidedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.final-decision.record",
      idempotencyKey: normalizedKey,
      request: { evidenceId, input: normalizedInput, actorRole: "verifier" },
      replay: (transaction, resultId) => this.requireEvidenceFinalDecision(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceId);
        const registration = await this.requireEvidenceRegistration(transaction, evidenceId);
        const actor = await this.loadVerificationActorSnapshot(
          transaction,
          actorId,
          "verifier",
          registration.organizationId,
        );
        const domain = await this.loadEvidenceVerificationDomain(transaction, evidenceId);
        const decision = domain.recordFinalDecision(evidenceId, normalizedInput, actorInput(actor));
        await this.insertDomainEvent(transaction, evidenceId, decision.auditEvent);
        await this.insertEvidenceFinalDecision(transaction, decision);
        return commandResult(
          decision,
          "evidence_final_decision",
          decision.id,
          decision.decisionRoot,
          decision.auditEvent,
        );
      },
    });
  }

  async listEvidenceValidationRuns(evidenceId: string, organizationId: string) {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).listValidationRuns(evidenceId);
    });
  }

  async listEvidenceAiAnalyses(evidenceId: string, organizationId: string) {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).listAiAnalyses(evidenceId);
    });
  }

  async listEvidenceHumanReviews(evidenceId: string, organizationId: string) {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).listHumanReviews(evidenceId);
    });
  }

  async listEvidenceChallenges(evidenceId: string, organizationId: string) {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).listChallenges(evidenceId);
    });
  }

  async listEvidenceChallengeResolutions(challengeId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const challenge = await this.requireEvidenceChallenge(transaction, challengeId);
      if (challenge.organizationId !== organizationId) {
        throw new Error("CanopyProof verification authority scope mismatch.");
      }
      return (await this.loadEvidenceVerificationDomain(transaction, challenge.evidenceId)).listChallengeResolutions(
        challengeId,
      );
    });
  }

  async listEvidenceCorrections(evidenceId: string, organizationId: string) {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).listCorrections(evidenceId);
    });
  }

  async listEvidenceFinalDecisions(evidenceId: string, organizationId: string) {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).listFinalDecisions(evidenceId);
    });
  }

  async getEvidenceFinalVerification(
    evidenceId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceFinalVerification> {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).getEvidenceFinalVerification(
        evidenceId,
      );
    });
  }

  async getEvidenceReliance(evidenceId: string, organizationId: string): Promise<CanopyProofEvidenceReliance> {
    return this.read(async (transaction) => {
      await this.requireEvidenceOrganization(transaction, evidenceId, organizationId);
      return (await this.loadEvidenceVerificationDomain(transaction, evidenceId)).getEvidenceReliance(evidenceId);
    });
  }

  async getEvidenceValidationRun(validationRunId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const run = await this.requireEvidenceValidationRun(transaction, validationRunId);
      if (run.organizationId !== organizationId) throw new Error("CanopyProof verification authority scope mismatch.");
      return run;
    });
  }

  async getEvidenceAiAnalysis(analysisId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const analysis = await this.requireEvidenceAiAnalysis(transaction, analysisId);
      if (analysis.organizationId !== organizationId) throw new Error("CanopyProof verification authority scope mismatch.");
      return analysis;
    });
  }

  async getEvidenceHumanReview(reviewId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const review = await this.requireEvidenceHumanReview(transaction, reviewId);
      if (review.organizationId !== organizationId) throw new Error("CanopyProof verification authority scope mismatch.");
      return review;
    });
  }

  async getEvidenceChallenge(challengeId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const challenge = await this.requireEvidenceChallenge(transaction, challengeId);
      if (challenge.organizationId !== organizationId) {
        throw new Error("CanopyProof verification authority scope mismatch.");
      }
      return challenge;
    });
  }

  async getEvidenceChallengeResolution(resolutionId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const resolution = await this.requireEvidenceChallengeResolution(transaction, resolutionId);
      if (resolution.organizationId !== organizationId) {
        throw new Error("CanopyProof verification authority scope mismatch.");
      }
      return resolution;
    });
  }

  async getEvidenceCorrection(correctionId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const correction = await this.requireEvidenceCorrection(transaction, correctionId);
      if (correction.organizationId !== organizationId) {
        throw new Error("CanopyProof verification authority scope mismatch.");
      }
      return correction;
    });
  }

  async getEvidenceFinalDecision(decisionId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const decision = await this.requireEvidenceFinalDecision(transaction, decisionId);
      if (decision.organizationId !== organizationId) {
        throw new Error("CanopyProof verification authority scope mismatch.");
      }
      return decision;
    });
  }

  async registerParticipant(input: unknown, ownerId: string, idempotencyKey: string) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const candidate = new CanopyProofIdentityService().registerParticipant(withTimestamp(input, "createdAt"), ownerId);
    return this.executeCommand({
      actorId: ownerId,
      operation: "identity.participant.register",
      idempotencyKey: normalizedKey,
      request: input,
      replay: (transaction, resultId) => this.requireParticipant(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, candidate.id);
        const existing = await this.loadParticipant(transaction, candidate.id, true);
        if (existing) {
          if (existing.subjectHash !== candidate.subjectHash) throw conflict();
          return commandResult(existing, "identity_participant", existing.id, existing.subjectHash, existing.auditHistory.at(-1));
        }
        const auditEvent = requireLastAuditEvent(candidate.auditHistory);
        await this.insertDomainEvent(transaction, candidate.id, auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO identity.participants (
            id, participant_type, display_name, owner_id, organization_id, roles,
            verification_status, reputation_score, credential_commitments,
            public_key_hash, subject_hash, created_at, updated_at
          ) VALUES (
            ${candidate.id}, ${candidate.participantType}, ${candidate.displayName}, ${candidate.ownerId},
            ${candidate.organizationId ?? null}, ${textArray(candidate.roles)}, ${candidate.verificationStatus},
            ${candidate.reputationScore}, ${textArray(candidate.credentialCommitments)},
            ${candidate.publicKeyHash ?? null}, ${candidate.subjectHash}, ${asDate(candidate.createdAt)}, ${asDate(candidate.updatedAt)}
          )
        `));
        return commandResult(candidate, "identity_participant", candidate.id, candidate.subjectHash, auditEvent);
      },
    });
  }

  async listParticipants(filter: Readonly<{ participantType?: string; verificationStatus?: string; organizationId?: string }> = {}) {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT id
        FROM identity.participants
        WHERE (${filter.participantType ?? null}::text IS NULL OR participant_type = ${filter.participantType ?? null})
          AND (${filter.verificationStatus ?? null}::text IS NULL OR verification_status = ${filter.verificationStatus ?? null})
          AND (${filter.organizationId ?? null}::text IS NULL OR organization_id = ${filter.organizationId ?? null})
        ORDER BY updated_at DESC, id ASC
      `);
      return Promise.all(rows.map((row) => this.requireParticipant(transaction, idRow(row))));
    });
  }

  async getParticipant(participantId: string) {
    return this.read((transaction) => this.requireParticipant(transaction, participantId));
  }

  async recordReputationSnapshot(participantId: string, input: unknown, recordedBy: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId: recordedBy,
      operation: "identity.reputation.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { participantId, input },
      replay: (transaction, resultId) => this.requireReputationSnapshot(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, participantId);
        const participant = await this.requireParticipant(transaction, participantId, true);
        const snapshots = await this.loadReputationSnapshots(transaction, participantId, participant.auditHistory);
        const domain = CanopyProofIdentityService.fromAuthoritySnapshot({ participants: [participant], reputationSnapshots: snapshots });
        const snapshot = domain.recordReputationSnapshot(participantId, withTimestamp(input, "recordedAt"), recordedBy);
        const existing = snapshots.find((entry) => entry.id === snapshot.id);
        if (existing) return commandResult(existing, "identity_reputation_snapshot", existing.id, existing.snapshotHash, existing.auditEvent);
        const updatedParticipant = domain.getParticipant(participantId);
        await this.insertDomainEvent(transaction, participantId, snapshot.auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO identity.reputation_snapshots (
            id, participant_id, previous_score, new_score, source, reason,
            recorded_by, recorded_at, snapshot_hash, audit_event_root
          ) VALUES (
            ${snapshot.id}, ${snapshot.participantId}, ${snapshot.previousScore}, ${snapshot.newScore},
            ${snapshot.source}, ${snapshot.reason}, ${snapshot.recordedBy}, ${asDate(snapshot.recordedAt)},
            ${snapshot.snapshotHash}, ${snapshot.auditEvent.eventRoot}
          )
        `));
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          UPDATE identity.participants
          SET reputation_score = ${updatedParticipant.reputationScore}, updated_at = ${asDate(updatedParticipant.updatedAt)}
          WHERE id = ${participantId}
        `));
        return commandResult(snapshot, "identity_reputation_snapshot", snapshot.id, snapshot.snapshotHash, snapshot.auditEvent);
      },
    });
  }

  async listReputationSnapshots(participantId: string) {
    return this.read(async (transaction) => {
      const participant = await this.requireParticipant(transaction, participantId);
      return this.loadReputationSnapshots(transaction, participantId, participant.auditHistory);
    });
  }

  async getIdentityStatus() {
    return this.read(async (transaction) => {
      const participantIds = await transaction.$queryRaw<unknown[]>(Prisma.sql`SELECT id FROM identity.participants ORDER BY id`);
      const participants = await Promise.all(participantIds.map((row) => this.requireParticipant(transaction, idRow(row))));
      const snapshots = (
        await Promise.all(participants.map((participant) => this.loadReputationSnapshots(transaction, participant.id, participant.auditHistory)))
      ).flat();
      return CanopyProofIdentityService.fromAuthoritySnapshot({ participants, reputationSnapshots: snapshots }).getStatus();
    });
  }

  async registerOrganization(input: unknown, actorId: string, idempotencyKey: string) {
    const candidate = new CanopyProofPartnerService().registerOrganization(withTimestamp(input, "createdAt"), actorId);
    return this.executeCommand({
      actorId,
      operation: "organization.register",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: input,
      replay: (transaction, resultId) => this.requireOrganization(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, candidate.id);
        const existing = await this.loadOrganization(transaction, candidate.id, true);
        if (existing) {
          if (existing.profileHash !== candidate.profileHash) throw conflict();
          return commandResult(existing, "organization", existing.id, existing.profileHash, existing.auditHistory.at(-1));
        }
        const auditEvent = requireLastAuditEvent(candidate.auditHistory);
        await this.insertDomainEvent(transaction, candidate.id, auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO organizations.organizations (
            id, name, organization_type, legal_name, jurisdiction, public_contact,
            operating_regions, verification_capabilities, registration_number,
            verification_status, trust_level, documents, authorized_users,
            accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
          ) VALUES (
            ${candidate.id}, ${candidate.name}, ${candidate.organizationType}, ${candidate.legalName}, ${candidate.jurisdiction},
            ${candidate.publicContact}, ${textArray(candidate.operatingRegions)}, ${textArray(candidate.verificationCapabilities)},
            ${candidate.registrationNumber ?? null}, ${candidate.verificationStatus}, ${candidate.trustLevel},
            ${jsonValue(candidate.documents)}, ${jsonValue(candidate.authorizedUsers)}, ${candidate.accreditationStatus},
            ${candidate.dataSharingPolicy}, ${candidate.profileHash}, ${asDate(candidate.createdAt)}, ${asDate(candidate.updatedAt)}
          )
        `));
        await this.insertOrganizationDocuments(transaction, candidate, actorId, auditEvent.eventRoot);
        return commandResult(candidate, "organization", candidate.id, candidate.profileHash, auditEvent);
      },
    });
  }

  async listOrganizations() {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`SELECT id FROM organizations.organizations ORDER BY name, id`);
      return Promise.all(rows.map((row) => this.requireOrganization(transaction, idRow(row))));
    });
  }

  async listPartners() {
    const organizations = await this.listOrganizations();
    return organizations.filter(
      (organization) =>
        organization.accreditationStatus === "approved" &&
        organization.verificationStatus !== "suspended" &&
        organization.verificationStatus !== "revoked",
    );
  }

  async getOrganization(organizationId: string) {
    return this.read((transaction) => this.requireOrganization(transaction, organizationId));
  }

  async updateOrganizationVerification(organizationId: string, input: unknown, actorId: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId,
      operation: "organization.verification.update",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input },
      replay: (transaction, resultId) => this.requireOrganization(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, organizationId);
        const organization = await this.requireOrganization(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot({ organizations: [organization], memberships: [], accreditations: [] });
        const updated = domain.updateOrganizationVerification(organizationId, withTimestamp(input, "reviewedAt"), actorId);
        const auditEvent = requireLastAuditEvent(updated.auditHistory);
        await this.insertDomainEvent(transaction, organizationId, auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          UPDATE organizations.organizations
          SET registration_number = ${updated.registrationNumber ?? null},
              verification_status = ${updated.verificationStatus},
              trust_level = ${updated.trustLevel},
              documents = ${jsonValue(updated.documents)},
              authorized_users = ${jsonValue(updated.authorizedUsers)},
              updated_at = ${asDate(updated.updatedAt)}
          WHERE id = ${organizationId}
        `));
        await this.insertOrganizationDocuments(transaction, updated, actorId, auditEvent.eventRoot);
        return commandResult(updated, "organization", updated.id, hashJson(updated), auditEvent);
      },
    });
  }

  async grantMembership(organizationId: string, input: unknown, actorId: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId,
      operation: "organization.membership.grant",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input },
      replay: (transaction, resultId) => this.requireMembership(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadOrganizationAuthoritySnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let membership: CanopyProofMembership;
        try {
          membership = domain.grantMembership(organizationId, withTimestamp(input, "grantedAt"), actorId);
        } catch (error) {
          if (error instanceof Error && error.message.includes("membership already exists")) throw conflict();
          throw error;
        }
        const alreadyCommitted = snapshot.memberships.find((entry) => entry.id === membership.id);
        if (alreadyCommitted) {
          return commandResult(alreadyCommitted, "membership", alreadyCommitted.id, hashJson(alreadyCommitted), alreadyCommitted.auditEvent);
        }
        await this.insertDomainEvent(transaction, organizationId, membership.auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO organizations.memberships (
            id, organization_id, actor_id, role, status, conflict_disclosure,
            granted_by, granted_at, updated_at, audit_event_root
          ) VALUES (
            ${membership.id}, ${membership.organizationId}, ${membership.actorId}, ${membership.role}, ${membership.status},
            ${membership.conflictDisclosure}, ${membership.grantedBy}, ${asDate(membership.grantedAt)},
            ${asDate(membership.grantedAt)}, ${membership.auditEvent.eventRoot}
          )
        `));
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          UPDATE organizations.organizations
          SET updated_at = ${asDate(membership.grantedAt)}
          WHERE id = ${organizationId}
        `));
        return commandResult(membership, "membership", membership.id, hashJson(membership), membership.auditEvent);
      },
    });
  }

  async updateMembershipStatus(
    organizationId: string,
    membershipId: string,
    input: unknown,
    actorId: string,
    idempotencyKey: string,
  ) {
    return this.executeCommand({
      actorId,
      operation: "organization.membership.status.update",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, membershipId, input },
      replay: (transaction, resultId) => this.requireMembership(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadOrganizationAuthoritySnapshot(transaction, organizationId, true);
        await this.requireMembership(transaction, membershipId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const membership = domain.updateMembershipStatus(organizationId, membershipId, withTimestamp(input, "changedAt"), actorId);
        await this.insertDomainEvent(transaction, organizationId, membership.auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          UPDATE organizations.memberships
          SET status = ${membership.status}, updated_at = ${asDate(membership.auditEvent.createdAt)},
              audit_event_root = ${membership.auditEvent.eventRoot}
          WHERE id = ${membership.id} AND organization_id = ${organizationId}
        `));
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          UPDATE organizations.organizations
          SET updated_at = ${asDate(membership.auditEvent.createdAt)}
          WHERE id = ${organizationId}
        `));
        return commandResult(membership, "membership", membership.id, hashJson(membership), membership.auditEvent);
      },
    });
  }

  async listMemberships(organizationId: string) {
    return this.read(async (transaction) => {
      const organization = await this.requireOrganization(transaction, organizationId);
      return this.loadMemberships(transaction, organizationId, organization.auditHistory);
    });
  }

  async recordAccreditation(organizationId: string, input: unknown, actorId: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId,
      operation: "organization.accreditation.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input },
      replay: (transaction, resultId) => this.requireAccreditation(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadOrganizationAuthoritySnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const accreditation = domain.recordAccreditation(organizationId, withTimestamp(input, "decidedAt"), actorId);
        const alreadyCommitted = snapshot.accreditations.find((entry) => entry.id === accreditation.id);
        if (alreadyCommitted) {
          return commandResult(alreadyCommitted, "accreditation", alreadyCommitted.id, hashJson(alreadyCommitted), alreadyCommitted.auditEvent);
        }
        const updatedOrganization = domain.getOrganization(organizationId);
        await this.insertDomainEvent(transaction, organizationId, accreditation.auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO organizations.accreditations (
            id, organization_id, status, scope, decided_by, decided_at,
            rationale, evidence_hash, audit_event_root
          ) VALUES (
            ${accreditation.id}, ${accreditation.organizationId}, ${accreditation.status}, ${textArray(accreditation.scope)},
            ${accreditation.decidedBy}, ${asDate(accreditation.decidedAt)}, ${accreditation.rationale},
            ${accreditation.evidenceHash}, ${accreditation.auditEvent.eventRoot}
          )
        `));
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          UPDATE organizations.organizations
          SET accreditation_status = ${updatedOrganization.accreditationStatus},
              trust_level = ${updatedOrganization.trustLevel},
              updated_at = ${asDate(updatedOrganization.updatedAt)}
          WHERE id = ${organizationId}
        `));
        return commandResult(accreditation, "accreditation", accreditation.id, hashJson(accreditation), accreditation.auditEvent);
      },
    });
  }

  async listAccreditations(organizationId: string) {
    return this.read(async (transaction) => {
      const organization = await this.requireOrganization(transaction, organizationId);
      return this.loadAccreditations(transaction, organizationId, organization.auditHistory);
    });
  }

  async createDataSharingAgreement(organizationId: string, input: unknown, actorId: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId,
      operation: "organization.data-sharing-agreement.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input },
      replay: (transaction, resultId) => this.requireDataSharingAgreement(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const agreement = domain.createDataSharingAgreement(organizationId, withTimestamp(input, "createdAt"), actorId);
        const alreadyCommitted = snapshot.dataSharingAgreements?.find((entry) => entry.id === agreement.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_sharing_agreement",
            alreadyCommitted.id,
            alreadyCommitted.agreementHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, agreement.auditEvent);
        await this.insertDataSharingAgreement(transaction, agreement);
        await this.updateOrganizationTimestamp(transaction, organizationId, agreement.createdAt);
        return commandResult(
          agreement,
          "data_sharing_agreement",
          agreement.id,
          agreement.agreementHash,
          agreement.auditEvent,
        );
      },
    });
  }

  async listDataSharingAgreements(organizationId: string) {
    return this.read(async (transaction) => {
      const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataSharingAgreements(organizationId);
    });
  }

  async revokeDataSharingAgreement(agreementId: string, input: unknown, actorId: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId,
      operation: "organization.data-sharing-agreement.revoke",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { agreementId, input },
      replay: (transaction, resultId) => this.requireDataSharingAgreementRevocation(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataSharingAgreementOrganizationId(transaction, agreementId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let revocation: CanopyProofDataSharingAgreementRevocation;
        try {
          revocation = domain.revokeDataSharingAgreement(agreementId, withTimestamp(input, "revokedAt"), actorId);
        } catch (error) {
          if (isDataSharingAgreementStateConflict(error)) throw conflict();
          throw error;
        }
        await this.insertDomainEvent(transaction, organizationId, revocation.auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO organizations.data_sharing_agreement_revocations (
            id, organization_id, agreement_id, rationale, evidence_event_roots,
            revoked_by, revoked_at, revocation_hash, revocation_root, safety,
            audit_event_root
          ) VALUES (
            ${revocation.id}, ${revocation.organizationId}, ${revocation.agreementId}, ${revocation.rationale},
            ${textArray(revocation.evidenceEventRoots)}, ${revocation.revokedBy}, ${asDate(revocation.revokedAt)},
            ${revocation.revocationHash}, ${revocation.revocationRoot}, ${jsonValue(revocation.safety)},
            ${revocation.auditEvent.eventRoot}
          )
        `));
        await this.updateOrganizationTimestamp(transaction, organizationId, revocation.revokedAt);
        return commandResult(
          revocation,
          "data_sharing_agreement_revocation",
          revocation.id,
          revocation.revocationHash,
          revocation.auditEvent,
        );
      },
    });
  }

  async listDataSharingAgreementRevocations(agreementId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataSharingAgreementOrganizationId(transaction, agreementId);
      const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataSharingAgreementRevocations(agreementId);
    });
  }

  async getDataSharingAgreementRevocation(revocationId: string) {
    return this.read((transaction) => this.requireDataSharingAgreementRevocation(transaction, revocationId));
  }

  async supersedeDataSharingAgreement(agreementId: string, input: unknown, actorId: string, idempotencyKey: string) {
    return this.executeCommand({
      actorId,
      operation: "organization.data-sharing-agreement.supersede",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { agreementId, input },
      replay: (transaction, resultId) => this.requireDataSharingAgreementSupersession(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataSharingAgreementOrganizationId(transaction, agreementId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let supersession: CanopyProofDataSharingAgreementSupersession;
        try {
          supersession = domain.supersedeDataSharingAgreement(agreementId, withTimestamp(input, "supersededAt"), actorId);
        } catch (error) {
          if (isDataSharingAgreementStateConflict(error)) throw conflict();
          throw error;
        }
        const successor = domain
          .listDataSharingAgreements(organizationId)
          .find((agreement) => agreement.id === supersession.successorAgreementId);
        if (!successor) throw unavailable();

        await this.insertDomainEvent(transaction, organizationId, successor.auditEvent);
        await this.insertDataSharingAgreement(transaction, successor);
        await this.insertDomainEvent(transaction, organizationId, supersession.auditEvent);
        requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
          INSERT INTO organizations.data_sharing_agreement_supersessions (
            id, organization_id, predecessor_agreement_id, predecessor_agreement_hash,
            successor_agreement_id, successor_agreement_hash, transition_type,
            rationale, evidence_event_roots, superseded_by, superseded_at,
            supersession_hash, supersession_root, safety, audit_event_root
          ) VALUES (
            ${supersession.id}, ${supersession.organizationId}, ${supersession.predecessorAgreementId},
            ${supersession.predecessorAgreementHash}, ${supersession.successorAgreementId},
            ${supersession.successorAgreementHash}, ${supersession.transitionType}, ${supersession.rationale},
            ${textArray(supersession.evidenceEventRoots)}, ${supersession.supersededBy},
            ${asDate(supersession.supersededAt)}, ${supersession.supersessionHash},
            ${supersession.supersessionRoot}, ${jsonValue(supersession.safety)},
            ${supersession.auditEvent.eventRoot}
          )
        `));
        await this.updateOrganizationTimestamp(transaction, organizationId, supersession.supersededAt);
        return commandResult(
          supersession,
          "data_sharing_agreement_supersession",
          supersession.id,
          supersession.supersessionHash,
          supersession.auditEvent,
        );
      },
    });
  }

  async listDataSharingAgreementSupersessions(agreementId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataSharingAgreementOrganizationId(transaction, agreementId);
      const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataSharingAgreementSupersessions(agreementId);
    });
  }

  async getDataSharingAgreementSupersession(supersessionId: string) {
    return this.read((transaction) => this.requireDataSharingAgreementSupersession(transaction, supersessionId));
  }

  async requestDataAccess(organizationId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = withTimestamp(input, "requestedAt");
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-request.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessRequestAtCreation(transaction, resultId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const request = domain.requestDataAccess(organizationId, normalizedInput, actorId);
        const alreadyCommitted = snapshot.dataAccessRequests?.find((entry) => entry.id === request.id);
        if (alreadyCommitted) {
          const committed = domain.getDataAccessRequest(alreadyCommitted.id);
          return commandResult(committed, "data_access_request", committed.id, committed.requestHash, committed.auditEvent);
        }
        await this.insertDomainEvent(transaction, organizationId, request.auditEvent);
        await this.insertDataAccessRequest(transaction, request);
        await this.updateOrganizationTimestamp(transaction, organizationId, request.requestedAt);
        return commandResult(request, "data_access_request", request.id, request.requestHash, request.auditEvent);
      },
    });
  }

  async listDataAccessRequests(organizationId: string) {
    return this.read(async (transaction) => {
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessRequests(organizationId);
    });
  }

  async getDataAccessRequest(requestId: string) {
    return this.read((transaction) => this.requireDataAccessRequest(transaction, requestId));
  }

  async decideDataAccessRequest(requestId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = withTimestamp(input, "decidedAt");
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-request.decide",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { requestId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessRequestAtDecision(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let updated: CanopyProofDataAccessRequest;
        try {
          updated = domain.decideDataAccessRequest(requestId, normalizedInput, actorId);
        } catch (error) {
          if (isDataAccessRequestStateConflict(error)) throw conflict();
          throw error;
        }
        const decision = domain
          .listDataAccessRequestDecisions(requestId)
          .find((entry) => entry.auditEvent.eventRoot === updated.decisionAuditEvent?.eventRoot);
        if (!decision) throw unavailable();
        await this.insertDomainEvent(transaction, organizationId, decision.auditEvent);
        await this.insertDataAccessRequestDecision(transaction, decision);
        await this.updateOrganizationTimestamp(transaction, organizationId, decision.decidedAt);
        return commandResult(
          updated,
          "data_access_request_decision",
          decision.id,
          decision.decisionHash,
          decision.auditEvent,
        );
      },
    });
  }

  async createAuditExportManifest(input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = withTimestamp(input, "createdAt");
    const requesterOrganizationId = requireObjectString(normalizedInput, "requesterOrganizationId");
    return this.executeCommand({
      actorId,
      operation: "audit.export-manifest.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: normalizedInput,
      replay: (transaction, resultId) => this.requireAuditExportManifest(transaction, resultId, requesterOrganizationId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, requesterOrganizationId);
        const organization = await this.requireOrganization(transaction, requesterOrganizationId, true);
        const manifests = await this.loadAuditExportManifests(
          transaction,
          requesterOrganizationId,
          organization.auditHistory,
        );
        const domain = hydrateAuditExportManifestSnapshot(manifests);
        const manifest = domain.createManifest(normalizedInput, actorId, organization.auditHistory);
        const alreadyCommitted = manifests.find((entry) => entry.id === manifest.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "audit_export_manifest",
            alreadyCommitted.id,
            alreadyCommitted.exportHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, requesterOrganizationId, manifest.auditEvent);
        await this.insertAuditExportManifest(transaction, manifest);
        await this.updateOrganizationTimestamp(transaction, requesterOrganizationId, manifest.createdAt);
        return commandResult(
          manifest,
          "audit_export_manifest",
          manifest.id,
          manifest.exportHash,
          manifest.auditEvent,
        );
      },
    });
  }

  async listAuditExportManifests(
    requesterOrganizationId: string,
    filter: Readonly<{
      scope?: CanopyProofAuditExportScope;
      subjectId?: string;
      classification?: CanopyProofAuditExportClassification;
      includeSensitive?: boolean;
    }> = {},
  ) {
    return this.read(async (transaction) => {
      const organization = await this.requireOrganization(transaction, requesterOrganizationId);
      const manifests = await this.loadAuditExportManifests(
        transaction,
        requesterOrganizationId,
        organization.auditHistory,
      );
      return hydrateAuditExportManifestSnapshot(manifests).listManifests({
        ...filter,
        requesterOrganizationId,
      });
    });
  }

  async getAuditExportManifest(
    manifestId: string,
    requesterOrganizationId: string,
    includeSensitive = false,
  ) {
    return this.read(async (transaction) => {
      const manifest = await this.requireAuditExportManifest(transaction, manifestId, requesterOrganizationId);
      return hydrateAuditExportManifestSnapshot([manifest]).getManifest(manifestId, includeSensitive);
    });
  }

  async getAuditExportManifestStatus(requesterOrganizationId: string) {
    return this.read(async (transaction) => {
      const organization = await this.requireOrganization(transaction, requesterOrganizationId);
      const manifests = await this.loadAuditExportManifests(
        transaction,
        requesterOrganizationId,
        organization.auditHistory,
      );
      return hydrateAuditExportManifestSnapshot(manifests).getStatus(requesterOrganizationId);
    });
  }

  async recordDataAccessDelivery(requestId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = dataAccessDeliveryCommandSchema.parse(withTimestamp(input, "deliveredAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-delivery.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { requestId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessDeliveryReceipt(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const manifest = await this.requireAuditExportManifest(transaction, normalizedInput.manifestId, organizationId);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let receipt: CanopyProofDataAccessDeliveryReceipt;
        try {
          receipt = domain.recordDataAccessDelivery(
            requestId,
            {
              ...normalizedInput,
              manifestId: manifest.id,
              manifestRequesterOrganizationId: manifest.requesterOrganizationId,
              manifestHash: manifest.exportHash,
              manifestEntryRoot: manifest.entryRoot,
              manifestClassification: manifest.classification,
            },
            actorId,
          );
        } catch (error) {
          if (isDataAccessDeliveryStateConflict(error)) throw conflict();
          throw error;
        }
        const alreadyCommitted = snapshot.dataAccessDeliveryReceipts?.find((entry) => entry.id === receipt.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_delivery_receipt",
            alreadyCommitted.id,
            alreadyCommitted.receiptHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, receipt.auditEvent);
        await this.insertDataAccessDeliveryReceipt(transaction, receipt);
        await this.updateOrganizationTimestamp(transaction, organizationId, receipt.deliveredAt);
        return commandResult(
          receipt,
          "data_access_delivery_receipt",
          receipt.id,
          receipt.receiptHash,
          receipt.auditEvent,
        );
      },
    });
  }

  async listDataAccessDeliveryReceipts(requestId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessDeliveryReceipts(requestId);
    });
  }

  async getDataAccessDeliveryReceipt(deliveryId: string) {
    return this.read((transaction) => this.requireDataAccessDeliveryReceipt(transaction, deliveryId));
  }

  async recordDataUseAttestation(deliveryId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = dataUseAttestationCommandSchema.parse(withTimestamp(input, "attestedAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-use-attestation.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { deliveryId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataUseAttestation(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessDeliveryOrganizationId(transaction, deliveryId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let attestation: CanopyProofDataUseAttestation;
        try {
          attestation = domain.recordDataUseAttestation(deliveryId, normalizedInput, actorId);
        } catch (error) {
          if (isDataUseAttestationStateConflict(error)) throw conflict();
          throw error;
        }
        const alreadyCommitted = snapshot.dataUseAttestations?.find((entry) => entry.id === attestation.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_use_attestation",
            alreadyCommitted.id,
            alreadyCommitted.attestationHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, attestation.auditEvent);
        await this.insertDataUseAttestation(transaction, attestation);
        await this.updateOrganizationTimestamp(transaction, organizationId, attestation.attestedAt);
        return commandResult(
          attestation,
          "data_use_attestation",
          attestation.id,
          attestation.attestationHash,
          attestation.auditEvent,
        );
      },
    });
  }

  async listDataUseAttestations(deliveryId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessDeliveryOrganizationId(transaction, deliveryId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataUseAttestations(deliveryId);
    });
  }

  async getDataUseAttestation(attestationId: string) {
    return this.read((transaction) => this.requireDataUseAttestation(transaction, attestationId));
  }

  async recordDataUseEnforcementCase(attestationId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = dataUseEnforcementCaseCommandSchema.parse(withTimestamp(input, "reviewedAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-use-enforcement-case.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { attestationId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataUseEnforcementCase(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataUseAttestationOrganizationId(transaction, attestationId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let enforcementCase: CanopyProofDataUseEnforcementCase;
        try {
          enforcementCase = domain.recordDataUseEnforcementCase(attestationId, normalizedInput, actorId);
        } catch (error) {
          if (isDataUseEnforcementCaseStateConflict(error)) throw conflict();
          throw error;
        }
        const alreadyCommitted = snapshot.dataUseEnforcementCases?.find((entry) => entry.id === enforcementCase.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_use_enforcement_case",
            alreadyCommitted.id,
            alreadyCommitted.enforcementHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, enforcementCase.auditEvent);
        await this.insertDataUseEnforcementCase(transaction, enforcementCase);
        await this.updateOrganizationTimestamp(transaction, organizationId, enforcementCase.reviewedAt);
        return commandResult(
          enforcementCase,
          "data_use_enforcement_case",
          enforcementCase.id,
          enforcementCase.enforcementHash,
          enforcementCase.auditEvent,
        );
      },
    });
  }

  async listDataUseEnforcementCases(attestationId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataUseAttestationOrganizationId(transaction, attestationId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataUseEnforcementCases(attestationId);
    });
  }

  async getDataUseEnforcementCase(caseId: string) {
    return this.read((transaction) => this.requireDataUseEnforcementCase(transaction, caseId));
  }

  async recordDataAccessRestriction(enforcementCaseId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = dataAccessRestrictionCommandSchema.parse(withTimestamp(input, "decidedAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-restriction.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { enforcementCaseId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessRestriction(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataUseEnforcementCaseOrganizationId(transaction, enforcementCaseId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        let restriction: CanopyProofDataAccessRestriction;
        try {
          restriction = domain.recordDataAccessRestriction(enforcementCaseId, normalizedInput, actorId);
        } catch (error) {
          if (isDataAccessRestrictionStateConflict(error)) throw conflict();
          throw error;
        }
        const alreadyCommitted = snapshot.dataAccessRestrictions?.find((entry) => entry.id === restriction.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_restriction",
            alreadyCommitted.id,
            alreadyCommitted.restrictionHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, restriction.auditEvent);
        await this.insertDataAccessRestriction(transaction, restriction);
        await this.updateOrganizationTimestamp(transaction, organizationId, restriction.decidedAt);
        return commandResult(
          restriction,
          "data_access_restriction",
          restriction.id,
          restriction.restrictionHash,
          restriction.auditEvent,
        );
      },
    });
  }

  async listDataAccessRestrictions(requestId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessRestrictions(requestId);
    });
  }

  async getDataAccessRestriction(restrictionId: string) {
    return this.read((transaction) => this.requireDataAccessRestriction(transaction, restrictionId));
  }

  async createDataAccessAccountabilityPacket(requestId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = dataAccessAccountabilityPacketCommandSchema.parse(withTimestamp(input, "generatedAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-accountability-packet.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { requestId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessAccountabilityPacket(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const packet = domain.createDataAccessAccountabilityPacket(requestId, normalizedInput, actorId);
        const alreadyCommitted = snapshot.dataAccessAccountabilityPackets?.find((entry) => entry.id === packet.id);
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_accountability_packet",
            alreadyCommitted.id,
            alreadyCommitted.packetHash,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, packet.auditEvent);
        await this.insertDataAccessAccountabilityPacket(transaction, packet);
        await this.updateOrganizationTimestamp(transaction, organizationId, packet.generatedAt);
        return commandResult(
          packet,
          "data_access_accountability_packet",
          packet.id,
          packet.packetHash,
          packet.auditEvent,
        );
      },
    });
  }

  async listDataAccessAccountabilityPackets(requestId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessAccountabilityPackets(requestId);
    });
  }

  async getDataAccessAccountabilityPacket(packetId: string) {
    return this.read((transaction) => this.requireDataAccessAccountabilityPacket(transaction, packetId));
  }

  async verifyDataAccessAccountabilityPacket(packetId: string, input: unknown, actorId: string, idempotencyKey: string) {
    const normalizedInput = dataAccessAccountabilityVerificationCommandSchema.parse(withTimestamp(input, "verifiedAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-accountability-verification.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { packetId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessAccountabilityVerification(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessAccountabilityPacketOrganizationId(transaction, packetId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const verification = domain.verifyDataAccessAccountabilityPacket(packetId, normalizedInput, actorId);
        const alreadyCommitted = snapshot.dataAccessAccountabilityVerifications?.find(
          (entry) => entry.id === verification.id,
        );
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_accountability_verification",
            alreadyCommitted.id,
            alreadyCommitted.verificationRoot,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, verification.auditEvent);
        await this.insertDataAccessAccountabilityVerification(transaction, verification);
        await this.updateOrganizationTimestamp(transaction, organizationId, verification.verifiedAt);
        return commandResult(
          verification,
          "data_access_accountability_verification",
          verification.id,
          verification.verificationRoot,
          verification.auditEvent,
        );
      },
    });
  }

  async listDataAccessAccountabilityVerifications(packetId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessAccountabilityPacketOrganizationId(transaction, packetId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessAccountabilityVerifications(packetId);
    });
  }

  async getDataAccessAccountabilityVerification(verificationId: string) {
    return this.read((transaction) => this.requireDataAccessAccountabilityVerification(transaction, verificationId));
  }

  async publishDataAccessAccountabilityDisclosure(
    packetId: string,
    input: unknown,
    actorId: string,
    idempotencyKey: string,
  ) {
    const normalizedInput = dataAccessAccountabilityDisclosureCommandSchema.parse(withTimestamp(input, "publishedAt"));
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-accountability-disclosure.publish",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { packetId, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessAccountabilityDisclosure(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessAccountabilityPacketOrganizationId(transaction, packetId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const disclosure = domain.publishDataAccessAccountabilityDisclosure(packetId, normalizedInput, actorId);
        const alreadyCommitted = snapshot.dataAccessAccountabilityDisclosures?.find(
          (entry) => entry.id === disclosure.id,
        );
        if (alreadyCommitted) {
          return commandResult(
            domain.getDataAccessAccountabilityDisclosure(alreadyCommitted.id),
            "data_access_accountability_disclosure",
            alreadyCommitted.id,
            alreadyCommitted.disclosureRoot,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, disclosure.auditEvent);
        await this.insertDataAccessAccountabilityDisclosure(transaction, disclosure);
        await this.updateOrganizationTimestamp(transaction, organizationId, disclosure.publishedAt);
        return commandResult(
          disclosure,
          "data_access_accountability_disclosure",
          disclosure.id,
          disclosure.disclosureRoot,
          disclosure.auditEvent,
        );
      },
    });
  }

  async challengeDataAccessAccountabilityDisclosure(
    disclosureId: string,
    input: unknown,
    actorId: string,
    challengerRole: (typeof canopyProofPartnerRoles)[number],
    idempotencyKey: string,
  ) {
    const normalizedInput = dataAccessAccountabilityDisclosureChallengeCommandSchema.parse(
      withTimestamp(input, "challengedAt"),
    );
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-accountability-disclosure-challenge.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { disclosureId, challengerRole, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessAccountabilityDisclosureChallenge(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessAccountabilityDisclosureOrganizationId(transaction, disclosureId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const challenge = domain.challengeDataAccessAccountabilityDisclosure(
          disclosureId,
          normalizedInput,
          actorId,
          challengerRole,
        );
        const alreadyCommitted = snapshot.dataAccessAccountabilityDisclosureChallenges?.find(
          (entry) => entry.id === challenge.id,
        );
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_accountability_disclosure_challenge",
            alreadyCommitted.id,
            alreadyCommitted.challengeRoot,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, challenge.auditEvent);
        await this.insertDataAccessAccountabilityDisclosureChallenge(transaction, challenge);
        await this.updateOrganizationTimestamp(transaction, organizationId, challenge.challengedAt);
        return commandResult(
          challenge,
          "data_access_accountability_disclosure_challenge",
          challenge.id,
          challenge.challengeRoot,
          challenge.auditEvent,
        );
      },
    });
  }

  async listDataAccessAccountabilityDisclosureChallenges(disclosureId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessAccountabilityDisclosureOrganizationId(transaction, disclosureId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessAccountabilityDisclosureChallenges(disclosureId);
    });
  }

  async getDataAccessAccountabilityDisclosureChallenge(challengeId: string) {
    return this.read(async (transaction) => {
      return this.requireDataAccessAccountabilityDisclosureChallenge(transaction, challengeId);
    });
  }

  async resolveDataAccessAccountabilityDisclosureChallenge(
    challengeId: string,
    input: unknown,
    actorId: string,
    reviewerRole: "owner" | "admin" | "verifier",
    idempotencyKey: string,
  ) {
    const normalizedInput = dataAccessAccountabilityDisclosureResolutionCommandSchema.parse(
      withTimestamp(input, "reviewedAt"),
    );
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-accountability-disclosure-resolution.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { challengeId, reviewerRole, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessAccountabilityDisclosureResolution(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessAccountabilityDisclosureChallengeOrganizationId(transaction, challengeId);
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const resolution = domain.resolveDataAccessAccountabilityDisclosureChallenge(
          challengeId,
          normalizedInput,
          actorId,
          reviewerRole,
        );
        const alreadyCommitted = snapshot.dataAccessAccountabilityDisclosureResolutions?.find(
          (entry) => entry.id === resolution.id,
        );
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_accountability_disclosure_resolution",
            alreadyCommitted.id,
            alreadyCommitted.resolutionRoot,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, resolution.auditEvent);
        await this.insertDataAccessAccountabilityDisclosureResolution(transaction, resolution);
        await this.updateOrganizationTimestamp(transaction, organizationId, resolution.reviewedAt);
        return commandResult(
          resolution,
          "data_access_accountability_disclosure_resolution",
          resolution.id,
          resolution.resolutionRoot,
          resolution.auditEvent,
        );
      },
    });
  }

  async listDataAccessAccountabilityDisclosureResolutions(challengeId: string) {
    return this.read(async (transaction) => {
      const challenge = await this.requireDataAccessAccountabilityDisclosureChallenge(transaction, challengeId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, challenge.organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessAccountabilityDisclosureResolutions(challengeId);
    });
  }

  async getDataAccessAccountabilityDisclosureResolution(resolutionId: string) {
    return this.read(async (transaction) => {
      return this.requireDataAccessAccountabilityDisclosureResolution(transaction, resolutionId);
    });
  }

  async publishDataAccessAccountabilityDisclosureNotice(
    resolutionId: string,
    input: unknown,
    actorId: string,
    publisherRole: "owner" | "admin",
    idempotencyKey: string,
  ) {
    const normalizedInput = dataAccessAccountabilityDisclosureNoticeCommandSchema.parse(
      withTimestamp(input, "publishedAt"),
    );
    return this.executeCommand({
      actorId,
      operation: "organization.data-access-accountability-disclosure-notice.publish",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { resolutionId, publisherRole, input: normalizedInput },
      replay: (transaction, resultId) => this.requireDataAccessAccountabilityDisclosureNotice(transaction, resultId),
      execute: async (transaction) => {
        const organizationId = await this.dataAccessAccountabilityDisclosureResolutionOrganizationId(
          transaction,
          resolutionId,
        );
        await this.lockSemanticStream(transaction, organizationId);
        const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId, true);
        const domain = hydratePartnerAuthoritySnapshot(snapshot);
        const notice = domain.publishDataAccessAccountabilityDisclosureNotice(
          resolutionId,
          normalizedInput,
          actorId,
          publisherRole,
        );
        const alreadyCommitted = snapshot.dataAccessAccountabilityDisclosureNotices?.find(
          (entry) => entry.id === notice.id,
        );
        if (alreadyCommitted) {
          return commandResult(
            alreadyCommitted,
            "data_access_accountability_disclosure_notice",
            alreadyCommitted.id,
            alreadyCommitted.noticeRoot,
            alreadyCommitted.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, organizationId, notice.auditEvent);
        await this.insertDataAccessAccountabilityDisclosureNotice(transaction, notice);
        await this.updateOrganizationTimestamp(transaction, organizationId, notice.publishedAt);
        return commandResult(
          notice,
          "data_access_accountability_disclosure_notice",
          notice.id,
          notice.noticeRoot,
          notice.auditEvent,
        );
      },
    });
  }

  async listDataAccessAccountabilityDisclosureNotices(disclosureId: string) {
    return this.read(async (transaction) => {
      const organizationId = await this.dataAccessAccountabilityDisclosureOrganizationId(transaction, disclosureId);
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      return hydratePartnerAuthoritySnapshot(snapshot).listDataAccessAccountabilityDisclosureNotices(disclosureId);
    });
  }

  async getDataAccessAccountabilityDisclosureNotice(noticeId: string) {
    return this.read((transaction) => this.requireDataAccessAccountabilityDisclosureNotice(transaction, noticeId));
  }

  async getDataAccessAccountabilityDisclosure(disclosureId: string) {
    return this.read(async (transaction) => {
      return this.requireDataAccessAccountabilityDisclosure(transaction, disclosureId);
    });
  }

  async getDataAccessAccountabilityDisclosureIndex(
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
    if (
      input.currentState &&
      !canopyProofDataAccessAccountabilityDisclosureStates.includes(input.currentState)
    ) {
      throw new Error(`CanopyProof public accountability disclosure state is invalid: ${input.currentState}`);
    }
    if (
      input.governanceState &&
      !canopyProofDataAccessAccountabilityDisclosureGovernanceStates.includes(input.governanceState)
    ) {
      throw new Error(
        `CanopyProof public accountability disclosure governance state is invalid: ${input.governanceState}`,
      );
    }
    return this.read(async (transaction) => {
      const cursor = input.cursor
        ? await this.publicDataAccessAccountabilityDisclosureCandidate(transaction, input.cursor)
        : undefined;
      if (
        cursor &&
        ((input.organizationId && cursor.organization_id !== input.organizationId) ||
          (input.currentState && cursor.current_state !== input.currentState) ||
          (input.governanceState && cursor.governance_state !== input.governanceState))
      ) {
        throw new Error(`CanopyProof public accountability disclosure cursor is invalid: ${input.cursor}`);
      }
      const aggregate = await this.aggregatePublicDataAccessAccountabilityDisclosures(transaction, input);
      const candidates = await this.listPublicDataAccessAccountabilityDisclosureCandidates(
        transaction,
        input,
        cursor,
        limit + 1,
      );
      const hasNextPage = candidates.length > limit;
      const page = candidates.slice(0, limit);
      const views = await this.loadPublicDataAccessAccountabilityDisclosureViews(transaction, page);
      const viewsById = new Map(views.map((view) => [view.id, view]));
      const items = page.map((candidate) => {
        const view = viewsById.get(candidate.id);
        if (
          !view ||
          view.currentState !== candidate.current_state ||
          view.governanceState !== candidate.governance_state
        ) {
          throw unavailable();
        }
        return view;
      });
      return {
        service: "canopyproof-public-accountability-disclosures" as const,
        totalCount: aggregate.total_count,
        limit,
        ...(input.cursor ? { cursor: input.cursor } : {}),
        ...(hasNextPage && items.length > 0 ? { nextCursor: items.at(-1)?.id } : {}),
        items,
        indexRoot: hashJson({
          kind: "canopyproof-public-accountability-disclosure-index-v1",
          organizationId: input.organizationId ?? null,
          currentState: input.currentState ?? null,
          governanceState: input.governanceState ?? null,
          totalCount: aggregate.total_count,
          disclosureSetRoot: aggregate.disclosure_root,
        }),
        safety: publicDataAccessAccountabilityDisclosureSafetyBoundary(),
      };
    });
  }

  async getDataAccessAccountabilityDisclosureStatus() {
    return this.read(async (transaction) => {
      const aggregate = await this.aggregatePublicDataAccessAccountabilityDisclosures(transaction, {});
      return {
        service: "canopyproof-public-accountability-disclosures" as const,
        disclosureCount: aggregate.total_count,
        currentDisclosureCount: aggregate.current_count,
        staleDisclosureCount: aggregate.stale_count,
        challengedDisclosureCount: aggregate.challenged_disclosure_count,
        openChallengeCount: aggregate.open_challenge_count,
        correctedDisclosureCount: aggregate.corrected_disclosure_count,
        withdrawnDisclosureCount: aggregate.withdrawn_disclosure_count,
        disclosureRoot: aggregate.disclosure_root,
        safety: publicDataAccessAccountabilityDisclosureSafetyBoundary(),
      };
    });
  }

  async recordEvidenceConsentReceipt(
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    idempotencyKey: string,
  ) {
    const normalizedInput = withTimestamp(input, "grantedAt");
    const subjectId = requireObjectString(normalizedInput, "subjectId");
    return this.executeCommand({
      actorId,
      operation: "evidence.consent-receipt.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, actorRole, input: normalizedInput },
      replay: (transaction, receiptId) => this.requireEvidenceConsentReceipt(transaction, receiptId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceCustodyStreamId(subjectId));
        await this.touchAuthorityFence(transaction, evidenceCustodyFenceId(subjectId));
        const actor = await this.loadEvidenceCustodyActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const domain = await this.loadEvidenceCustodyDomain(transaction, subjectId);
        const receipt = domain.recordConsentReceipt(normalizedInput, actor);
        const committed = await this.loadEvidenceConsentReceipt(transaction, receipt.id);
        if (committed) {
          if (committed.receiptRoot !== receipt.receiptRoot || committed.commandHash !== receipt.commandHash) {
            throw conflict();
          }
          return commandResult(
            committed,
            "consent_receipt",
            committed.id,
            committed.receiptRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, evidenceCustodyStreamId(subjectId), receipt.auditEvent);
        await this.insertEvidenceConsentReceipt(transaction, receipt);
        return commandResult(
          receipt,
          "consent_receipt",
          receipt.id,
          receipt.receiptRoot,
          receipt.auditEvent,
        );
      },
    });
  }

  async revokeEvidenceConsentReceipt(
    receiptId: string,
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    idempotencyKey: string,
  ) {
    const normalizedInput = withTimestamp(input, "revokedAt");
    return this.executeCommand({
      actorId,
      operation: "evidence.consent-revocation.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { receiptId, organizationId, actorRole, input: normalizedInput },
      replay: (transaction, revocationId) => this.requireEvidenceConsentRevocation(transaction, revocationId),
      execute: async (transaction) => {
        const receipt = await this.requireEvidenceConsentReceipt(transaction, receiptId);
        assertEvidenceCustodyOrganization(receipt.organizationId, organizationId);
        await this.lockSemanticStream(transaction, evidenceCustodyStreamId(receipt.subjectId));
        await this.touchAuthorityFence(
          transaction,
          evidenceCustodyFenceId(receipt.subjectId),
        );
        const actor = await this.loadEvidenceCustodyActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const domain = await this.loadEvidenceCustodyDomain(transaction, receipt.subjectId);
        const revocation = domain.revokeConsentReceipt(receiptId, normalizedInput, actor);
        const committed = await this.loadEvidenceConsentRevocation(transaction, revocation.id);
        if (committed) {
          if (
            committed.revocationRoot !== revocation.revocationRoot ||
            committed.commandHash !== revocation.commandHash
          ) {
            throw conflict();
          }
          return commandResult(
            committed,
            "consent_revocation",
            committed.id,
            committed.revocationRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(
          transaction,
          evidenceCustodyStreamId(receipt.subjectId),
          revocation.auditEvent,
        );
        await this.insertEvidenceConsentRevocation(transaction, revocation);
        return commandResult(
          revocation,
          "consent_revocation",
          revocation.id,
          revocation.revocationRoot,
          revocation.auditEvent,
        );
      },
    });
  }

  async recordEvidenceDeviceAttestation(
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    idempotencyKey: string,
  ) {
    const normalizedInput = withTimestamp(input, "issuedAt");
    const subjectId = requireObjectString(normalizedInput, "subjectId");
    if (requireObjectString(normalizedInput, "providerVerificationState") !== "modeled_only") {
      throw new Error(
        "CanopyProof evidence device provider verification is unavailable until a trusted provider adapter verifies the receipt.",
      );
    }
    return this.executeCommand({
      actorId,
      operation: "evidence.device-attestation.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, actorRole, input: normalizedInput },
      replay: (transaction, attestationId) => this.requireEvidenceDeviceAttestation(transaction, attestationId),
      execute: async (transaction) => {
        await this.lockSemanticStream(transaction, evidenceCustodyStreamId(subjectId));
        await this.touchAuthorityFence(transaction, evidenceCustodyFenceId(subjectId));
        const actor = await this.loadEvidenceCustodyActorSnapshot(
          transaction,
          actorId,
          actorRole,
          organizationId,
        );
        const domain = await this.loadEvidenceCustodyDomain(transaction, subjectId);
        const attestation = domain.recordDeviceAttestation(normalizedInput, actor);
        const committed = await this.loadEvidenceDeviceAttestation(transaction, attestation.id);
        if (committed) {
          if (
            committed.attestationRoot !== attestation.attestationRoot ||
            committed.commandHash !== attestation.commandHash
          ) {
            throw conflict();
          }
          return commandResult(
            committed,
            "device_attestation",
            committed.id,
            committed.attestationRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(
          transaction,
          evidenceCustodyStreamId(subjectId),
          attestation.auditEvent,
        );
        await this.insertEvidenceDeviceAttestation(transaction, attestation);
        return commandResult(
          attestation,
          "device_attestation",
          attestation.id,
          attestation.attestationRoot,
          attestation.auditEvent,
        );
      },
    });
  }

  async getEvidenceCustodyActorSnapshot(
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    organizationId: string,
  ) {
    return this.read((transaction) =>
      this.loadEvidenceCustodyActorSnapshot(transaction, actorId, actorRole, organizationId),
    );
  }

  async getEvidenceConsentReceipt(receiptId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const receipt = await this.requireEvidenceConsentReceipt(transaction, receiptId);
      assertEvidenceCustodyOrganization(receipt.organizationId, organizationId);
      return receipt;
    });
  }

  async getEvidenceConsentRevocation(revocationId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const revocation = await this.requireEvidenceConsentRevocation(transaction, revocationId);
      assertEvidenceCustodyOrganization(revocation.organizationId, organizationId);
      return revocation;
    });
  }

  async getEvidenceDeviceAttestation(attestationId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const attestation = await this.requireEvidenceDeviceAttestation(transaction, attestationId);
      assertEvidenceCustodyOrganization(attestation.organizationId, organizationId);
      return attestation;
    });
  }

  async getEvidenceConsentProjection(
    receiptId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEvidenceConsentProjection> {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    return this.read(async (transaction) => {
      const receipt = await this.requireEvidenceConsentReceipt(transaction, receiptId);
      assertEvidenceCustodyOrganization(receipt.organizationId, organizationId);
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM evidence.consent_receipt_projection(${receiptId}, ${asDate(evaluation)})
      `);
      if (rows.length !== 1) throw unavailable();
      const projection = mapEvidenceConsentProjection(rows[0]);
      const replayed = (await this.loadEvidenceCustodyDomain(transaction, receipt.subjectId)).projectConsentReceipt(
        receiptId,
        evaluation,
      );
      if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
      return projection;
    });
  }

  async getEvidenceDeviceAttestationProjection(
    attestationId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEvidenceDeviceAttestationProjection> {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    return this.read(async (transaction) => {
      const attestation = await this.requireEvidenceDeviceAttestation(transaction, attestationId);
      assertEvidenceCustodyOrganization(attestation.organizationId, organizationId);
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM evidence.device_attestation_projection(${attestationId}, ${asDate(evaluation)})
      `);
      if (rows.length !== 1) throw unavailable();
      const projection = mapEvidenceDeviceAttestationProjection(rows[0]);
      const replayed = (
        await this.loadEvidenceCustodyDomain(transaction, attestation.subjectId)
      ).projectDeviceAttestation(attestationId, evaluation);
      if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
      return projection;
    });
  }

  async getEvidenceEffectiveDeviceAttestationProjection(
    attestationId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEffectiveDeviceAttestationProjection> {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    return this.readOrganization(organizationId, async (transaction) => {
      const attestation = await this.requireEvidenceDeviceAttestation(transaction, attestationId);
      assertEvidenceCustodyOrganization(attestation.organizationId, organizationId);
      return this.loadEvidenceEffectiveDeviceProjection(transaction, attestation, evaluation);
    });
  }

  async createEvidenceMediaUploadIntent(
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    idempotencyKey: string,
  ) {
    const parsed = evidenceMediaUploadCommandSchema.parse(input);
    const mediaInput = {
      evidenceId: parsed.evidenceId,
      contentHash: parsed.contentHash,
      contentType: parsed.contentType,
      byteLength: parsed.byteLength,
      capturedAt: parsed.capturedAt,
    } as const;
    return this.executeCommand({
      actorId,
      organizationId,
      operation: "evidence.media-upload-intent.create",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, actorRole, input: parsed },
      replay: (transaction, intentId) => this.requireEvidenceMediaUploadIntent(transaction, intentId),
      execute: async (transaction) => {
        const evidence = await this.requireEvidenceOrganization(transaction, parsed.evidenceId, organizationId);
        if (evidence.contributor !== actorId) {
          throw new Error("CanopyProof evidence media intent requires the original evidence contributor.");
        }
        if (normalizeHash(parsed.contentHash) !== normalizeHash(evidence.media_hash)) {
          throw new Error("CanopyProof evidence media intent content hash must match the registered evidence commitment.");
        }
        await this.lockSemanticStream(transaction, evidenceMediaStreamId(evidence.id));
        await this.lockProjectAuthorityShared(transaction, evidence.projectId);
        const actor = await this.loadEvidenceCustodyActorSnapshot(transaction, actorId, actorRole, organizationId);
        const project = (await this.requireProjectDomain(transaction, evidence.projectId)).getProject(evidence.projectId);
        if (project.organizationId !== organizationId || ["suspended", "archived"].includes(project.status)) {
          throw new Error("CanopyProof evidence media intent project authority is not eligible.");
        }
        const consent = await this.requireEvidenceConsentReceipt(transaction, parsed.consentReceiptId);
        const device = await this.requireEvidenceDeviceAttestation(transaction, parsed.deviceAttestationId);
        const consentProjection = await this.loadEvidenceConsentProjection(transaction, consent, parsed.capturedAt);
        const deviceProjection = await this.loadEvidenceEffectiveDeviceProjection(
          transaction,
          device,
          parsed.capturedAt,
        );
        const domain = await this.loadEvidenceMediaDomain(transaction, evidence.id);
        const intent = domain.createUploadIntent(mediaInput, {
          actor,
          project: {
            id: project.id,
            organizationId: project.organizationId,
            status: project.status as "submitted" | "under_review" | "active" | "monitored" | "challenged",
            projectRoot: project.projectRoot,
          },
          consent,
          consentProjection,
          device,
          deviceProjection,
        });
        const committed = await this.loadEvidenceMediaUploadIntent(transaction, intent.id);
        if (committed) {
          if (committed.intentRoot !== intent.intentRoot || committed.commandHash !== intent.commandHash) {
            throw conflict();
          }
          return commandResult(committed, "evidence_media_upload_intent", committed.id, committed.intentRoot, committed.auditEvent);
        }
        await this.insertDomainEvent(transaction, evidenceMediaStreamId(evidence.id), intent.auditEvent);
        await this.insertEvidenceMediaUploadIntent(transaction, intent);
        return commandResult(intent, "evidence_media_upload_intent", intent.id, intent.intentRoot, intent.auditEvent);
      },
    });
  }

  async confirmEvidenceMediaObject(
    input: unknown,
    organizationId: string,
    agentId: string,
    idempotencyKey: string,
  ) {
    const routing = evidenceMediaObjectCommandRoutingSchema.parse(input);
    if (routing.providerVerificationState !== "modeled_only") {
      throw new Error(
        "CanopyProof storage receipt verification is unavailable until an approved object-storage adapter verifies the receipt.",
      );
    }
    return this.executeCommand({
      actorId: agentId,
      organizationId,
      operation: "evidence.media-object.confirm",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input },
      replay: async (transaction, objectId) => ({
        object: await this.requireEvidenceMediaObject(transaction, objectId),
        ...(await this.loadEvidenceMediaDuplicateRelationByObject(transaction, objectId)
          ? { duplicateRelation: await this.requireEvidenceMediaDuplicateRelationByObject(transaction, objectId) }
          : {}),
      }),
      execute: async (transaction) => {
        const intent = await this.requireEvidenceMediaUploadIntent(transaction, routing.intentId);
        assertEvidenceCustodyOrganization(intent.organizationId, organizationId);
        await this.lockSemanticStream(transaction, evidenceMediaStreamId(intent.evidenceId));
        await this.lockEvidenceMedia(transaction, intent.contentHash);
        const agent = await this.loadEvidenceMediaAgentSnapshot(
          transaction,
          agentId,
          organizationId,
          "object_storage_receipt",
        );
        const domain = await this.loadEvidenceMediaDomain(transaction, intent.evidenceId);
        const result = domain.confirmMediaObject(input, agent);
        const committed = await this.loadEvidenceMediaObject(transaction, result.object.id);
        if (committed) {
          if (committed.objectRoot !== result.object.objectRoot || committed.commandHash !== result.object.commandHash) {
            throw conflict();
          }
          const relation = await this.loadEvidenceMediaDuplicateRelationByObject(transaction, committed.id);
          return commandResult(
            { object: committed, ...(relation ? { duplicateRelation: relation } : {}) },
            "evidence_media_object",
            committed.id,
            committed.objectRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, evidenceMediaStreamId(intent.evidenceId), result.object.auditEvent);
        await this.insertEvidenceMediaObject(transaction, result.object);
        if (result.duplicateRelation) {
          await this.insertDomainEvent(
            transaction,
            evidenceMediaStreamId(intent.evidenceId),
            result.duplicateRelation.auditEvent,
          );
          await this.insertEvidenceMediaDuplicateRelation(transaction, result.duplicateRelation);
        }
        return commandResult(
          result,
          "evidence_media_object",
          result.object.id,
          result.object.objectRoot,
          result.object.auditEvent,
        );
      },
    });
  }

  async recordEvidenceMediaScanResult(
    input: unknown,
    organizationId: string,
    agentId: string,
    idempotencyKey: string,
  ) {
    const routing = evidenceMediaScanCommandRoutingSchema.parse(input);
    if (routing.providerVerificationState !== "modeled_only") {
      throw new Error(
        "CanopyProof scanner receipt verification is unavailable until an approved scanner adapter verifies the receipt.",
      );
    }
    return this.executeCommand({
      actorId: agentId,
      organizationId,
      operation: "evidence.media-scan-result.record",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input },
      replay: (transaction, scanId) => this.requireEvidenceMediaScanResult(transaction, scanId),
      execute: async (transaction) => {
        const object = await this.requireEvidenceMediaObject(transaction, routing.objectId);
        assertEvidenceCustodyOrganization(object.organizationId, organizationId);
        await this.lockSemanticStream(transaction, evidenceMediaStreamId(object.evidenceId));
        const agent = await this.loadEvidenceMediaAgentSnapshot(
          transaction,
          agentId,
          organizationId,
          "malware_scan_result",
        );
        const domain = await this.loadEvidenceMediaDomain(transaction, object.evidenceId);
        const scan = domain.recordScanResult(input, agent);
        const committed = await this.loadEvidenceMediaScanResult(transaction, scan.id);
        if (committed) {
          if (committed.scanRoot !== scan.scanRoot || committed.commandHash !== scan.commandHash) throw conflict();
          return commandResult(committed, "evidence_media_scan_result", committed.id, committed.scanRoot, committed.auditEvent);
        }
        await this.insertDomainEvent(transaction, evidenceMediaStreamId(object.evidenceId), scan.auditEvent);
        await this.insertEvidenceMediaScanResult(transaction, scan);
        return commandResult(scan, "evidence_media_scan_result", scan.id, scan.scanRoot, scan.auditEvent);
      },
    });
  }

  async commitEvidenceMediaProviderVerification(
    receipt: CanopyProofAdapterVerifiedStoredObjectReceipt,
    organizationId: string,
    agentId: string,
    idempotencyKey: string,
  ): Promise<CanopyProofEvidenceMediaProviderVerificationBundle> {
    const providerReceiptHash = z.string().regex(/^[a-f0-9]{64}$/).parse(receipt.providerReceiptHash);
    const providerVerificationRoot = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(receipt.providerVerificationRoot);
    return this.executeCommand({
      actorId: agentId,
      organizationId,
      operation: "evidence.media-provider-receipt.commit",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: {
        organizationId,
        intentId: receipt.intentId,
        intentRoot: receipt.intentRoot,
        providerReceiptHash,
        providerVerificationRoot,
      },
      replay: (transaction, verificationId) =>
        this.requireEvidenceMediaProviderVerificationBundle(transaction, verificationId),
      execute: async (transaction) => {
        const intent = await this.requireEvidenceMediaUploadIntent(transaction, receipt.intentId);
        assertEvidenceCustodyOrganization(intent.organizationId, organizationId);
        revalidateStoredObjectReceipt(intent, receipt);
        await this.lockSemanticStreams(transaction, [
          evidenceMediaStreamId(intent.evidenceId),
          evidenceMediaAdapterStreamId(intent.evidenceId),
        ]);
        await this.lockEvidenceMedia(transaction, intent.contentHash);
        const existingVerification = await this.loadEvidenceMediaProviderVerificationByIntent(
          transaction,
          intent.id,
          organizationId,
        );
        if (existingVerification) {
          if (
            existingVerification.providerReceiptHash !== providerReceiptHash ||
            existingVerification.providerVerificationRoot !== providerVerificationRoot
          ) {
            throw conflict();
          }
          const bundle = await this.requireEvidenceMediaProviderVerificationBundle(
            transaction,
            existingVerification.id,
          );
          return commandResult(
            bundle,
            "media_provider_receipt_verification",
            existingVerification.id,
            existingVerification.factRoot,
            existingVerification.auditEvent,
          );
        }

        const verifier = await this.loadEvidenceMediaAgentSnapshot(
          transaction,
          agentId,
          organizationId,
          "object_storage_receipt",
        );
        const domain = await this.loadEvidenceMediaDomain(transaction, intent.evidenceId);
        const proposed = domain.confirmMediaObject(providerReceiptToObjectInput(receipt), verifier);
        const committedObject = await this.loadEvidenceMediaObject(transaction, proposed.object.id);
        const object = committedObject ?? proposed.object;
        if (
          object.objectRoot !== proposed.object.objectRoot ||
          object.commandHash !== proposed.object.commandHash
        ) {
          throw conflict();
        }
        let duplicateRelation = await this.loadEvidenceMediaDuplicateRelationByObject(transaction, object.id);
        if (!committedObject) {
          await this.insertDomainEvent(
            transaction,
            evidenceMediaStreamId(intent.evidenceId),
            proposed.object.auditEvent,
          );
          await this.insertEvidenceMediaObject(transaction, proposed.object);
          if (proposed.duplicateRelation) {
            await this.insertDomainEvent(
              transaction,
              evidenceMediaStreamId(intent.evidenceId),
              proposed.duplicateRelation.auditEvent,
            );
            await this.insertEvidenceMediaDuplicateRelation(transaction, proposed.duplicateRelation);
            duplicateRelation = proposed.duplicateRelation;
          }
        }
        const verification = buildCanopyProofEvidenceMediaProviderVerificationFact({
          intent,
          object,
          receipt,
          verifier,
          streamEvents: await this.loadAuditHistory(
            transaction,
            evidenceMediaAdapterStreamId(intent.evidenceId),
          ),
        });
        await this.insertDomainEvent(
          transaction,
          evidenceMediaAdapterStreamId(intent.evidenceId),
          verification.auditEvent,
        );
        await this.insertEvidenceMediaAdapterCommandReceipt(transaction, verification);
        await this.insertEvidenceMediaProviderVerification(transaction, verification);
        const bundle = {
          object,
          ...(duplicateRelation ? { duplicateRelation } : {}),
          verification,
        };
        return commandResult(
          bundle,
          "media_provider_receipt_verification",
          verification.id,
          verification.factRoot,
          verification.auditEvent,
        );
      },
    });
  }

  async commitEvidenceMediaScannerVerification(
    receipt: CanopyProofDurableMalwareScanReceipt,
    organizationId: string,
    agentId: string,
    idempotencyKey: string,
  ): Promise<CanopyProofEvidenceMediaScannerVerificationBundle> {
    const scannerReceiptHash = z.string().regex(/^[a-f0-9]{64}$/).parse(receipt.receiptHash);
    const scannerVerificationRoot = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(receipt.verificationRoot);
    return this.executeCommand({
      actorId: agentId,
      organizationId,
      operation: "evidence.media-scanner-receipt.commit",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: {
        organizationId,
        objectId: receipt.objectId,
        objectRoot: receipt.objectRoot,
        scannerReceiptHash,
        scannerVerificationRoot,
      },
      replay: (transaction, verificationId) =>
        this.requireEvidenceMediaScannerVerificationBundle(transaction, verificationId),
      execute: async (transaction) => {
        const object = await this.requireEvidenceMediaObject(transaction, receipt.objectId);
        assertEvidenceCustodyOrganization(object.organizationId, organizationId);
        await this.lockSemanticStreams(transaction, [
          evidenceMediaStreamId(object.evidenceId),
          evidenceMediaAdapterStreamId(object.evidenceId),
        ]);
        await this.requireEvidenceMediaProviderVerificationByObject(
          transaction,
          object.id,
          organizationId,
        );
        const verifier = await this.loadEvidenceMediaAgentSnapshot(
          transaction,
          agentId,
          organizationId,
          "malware_scan_result",
        );
        const domain = await this.loadEvidenceMediaDomain(transaction, object.evidenceId);
        const proposed = domain.recordScanResult(scannerReceiptToScanInput(receipt), verifier);
        const committedScan = await this.loadEvidenceMediaScanResult(transaction, proposed.id);
        const scan = committedScan ?? proposed;
        if (scan.scanRoot !== proposed.scanRoot || scan.commandHash !== proposed.commandHash) {
          throw conflict();
        }
        const existingVerification = await this.loadEvidenceMediaScannerVerificationByScan(
          transaction,
          scan.id,
          organizationId,
        );
        if (existingVerification) {
          if (
            existingVerification.scannerReceiptHash !== scannerReceiptHash ||
            existingVerification.scannerVerificationRoot !== scannerVerificationRoot
          ) {
            throw conflict();
          }
          const bundle = await this.requireEvidenceMediaScannerVerificationBundle(
            transaction,
            existingVerification.id,
          );
          return commandResult(
            bundle,
            "media_scanner_receipt_verification",
            existingVerification.id,
            existingVerification.factRoot,
            existingVerification.auditEvent,
          );
        }
        if (!committedScan) {
          await this.insertDomainEvent(
            transaction,
            evidenceMediaStreamId(object.evidenceId),
            proposed.auditEvent,
          );
          await this.insertEvidenceMediaScanResult(transaction, proposed);
        }
        const verification = buildCanopyProofEvidenceMediaScannerVerificationFact({
          object,
          scan,
          receipt,
          verifier,
          streamEvents: await this.loadAuditHistory(
            transaction,
            evidenceMediaAdapterStreamId(object.evidenceId),
          ),
        });
        await this.insertDomainEvent(
          transaction,
          evidenceMediaAdapterStreamId(object.evidenceId),
          verification.auditEvent,
        );
        await this.insertEvidenceMediaAdapterCommandReceipt(transaction, verification);
        await this.insertEvidenceMediaScannerVerification(transaction, verification);
        const bundle = { scan, verification };
        return commandResult(
          bundle,
          "media_scanner_receipt_verification",
          verification.id,
          verification.factRoot,
          verification.auditEvent,
        );
      },
    });
  }

  async findEvidenceMediaProviderVerificationForIntent(intentId: string, organizationId: string) {
    return this.readOrganization(organizationId, async (transaction) => {
      const verification = await this.loadEvidenceMediaProviderVerificationByIntent(
        transaction,
        intentId,
        organizationId,
      );
      if (!verification) return undefined;
      return this.requireEvidenceMediaProviderVerificationBundle(transaction, verification.id);
    });
  }

  async findEvidenceMediaScannerVerificationForObject(objectId: string, organizationId: string) {
    return this.readOrganization(organizationId, async (transaction) => {
      const verification = await this.loadLatestEvidenceMediaScannerVerificationByObject(
        transaction,
        objectId,
        organizationId,
      );
      if (!verification) return undefined;
      return this.requireEvidenceMediaScannerVerificationBundle(transaction, verification.id);
    });
  }

  async getEvidenceMediaUploadIntent(intentId: string, organizationId: string) {
    return this.readOrganization(organizationId, async (transaction) => {
      const intent = await this.requireEvidenceMediaUploadIntent(transaction, intentId);
      assertEvidenceCustodyOrganization(intent.organizationId, organizationId);
      return intent;
    });
  }

  async getEvidenceMediaObject(objectId: string, organizationId: string) {
    return this.readOrganization(organizationId, async (transaction) => {
      const object = await this.requireEvidenceMediaObject(transaction, objectId);
      assertEvidenceCustodyOrganization(object.organizationId, organizationId);
      return object;
    });
  }

  async getEvidenceMediaAgentAuthority(
    agentId: string,
    organizationId: string,
    capability: CanopyProofEvidenceMediaAgentCapability,
  ) {
    return this.readOrganization(organizationId, (transaction) =>
      this.loadEvidenceMediaAgentSnapshot(transaction, agentId, organizationId, capability)
    );
  }

  async getEvidenceMediaObjectProjection(objectId: string, organizationId: string, evaluatedAt: string) {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    return this.readOrganization(organizationId, async (transaction) => {
      const object = await this.requireEvidenceMediaObject(transaction, objectId);
      assertEvidenceCustodyOrganization(object.organizationId, organizationId);
      const intent = await this.requireEvidenceMediaUploadIntent(transaction, object.intentId);
      const consent = await this.requireEvidenceConsentReceipt(transaction, intent.consentReceiptId);
      const device = await this.requireEvidenceDeviceAttestation(transaction, intent.deviceAttestationId);
      const current = {
        consent: await this.loadEvidenceConsentProjection(transaction, consent, evaluation),
        device: await this.loadEvidenceEffectiveDeviceProjection(transaction, device, evaluation),
      };
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM evidence.media_object_projection(${objectId}, ${asDate(evaluation)})
      `);
      if (rows.length !== 1) throw unavailable();
      const projection = mapEvidenceMediaObjectProjection(rows[0]);
      const replayed = (await this.loadEvidenceMediaDomain(transaction, object.evidenceId)).projectMediaObject(
        objectId,
        evaluation,
        current,
      );
      if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
      return projection;
    });
  }

  async getEvidenceMediaExtractionProjectionAuthority(
    objectId: string,
    organizationId: string,
    evaluatedAt: string,
  ) {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    return this.readOrganization(organizationId, async (transaction) => {
      const object = await this.requireEvidenceMediaObject(transaction, objectId);
      assertEvidenceCustodyOrganization(object.organizationId, organizationId);
      const intent = await this.requireEvidenceMediaUploadIntent(transaction, object.intentId);
      const baseMediaProjection = await this.loadEvidenceMediaProjection(
        transaction,
        object,
        intent,
        evaluation,
      );

      const adapterRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM evidence.media_adapter_trust_projection(${objectId}, ${asDate(evaluation)})
      `);
      if (adapterRows.length !== 1) throw unavailable();
      const mediaAdapterTrustProjection = mapEvidenceMediaAdapterTrustProjection(adapterRows[0]);
      const mediaSnapshot = (await this.loadEvidenceMediaDomain(
        transaction,
        object.evidenceId,
      )).getAuthoritySnapshot();
      const providerVerification = await this.loadEvidenceMediaProviderVerificationByIntent(
        transaction,
        object.intentId,
        organizationId,
      );
      const scannerVerificationRows = await this.loadEvidenceMediaScannerVerificationRows(
        transaction,
        Prisma.sql`WHERE fact.object_id = ${objectId} AND fact.organization_id = ${organizationId}`,
      );
      const replayedAdapter = projectCanopyProofEvidenceMediaAdapterTrust({
        object,
        ...(providerVerification ? { providerVerification } : {}),
        scans: mediaSnapshot.scanResults.filter((scan) => scan.objectId === object.id),
        scannerVerifications: scannerVerificationRows.map(mapEvidenceMediaScannerVerification),
        evaluatedAt: evaluation,
      });
      if (hashJson(mediaAdapterTrustProjection) !== hashJson(replayedAdapter)) throw unavailable();

      const effectiveRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM evidence.effective_media_object_projection(${objectId}, ${asDate(evaluation)})
      `);
      if (effectiveRows.length !== 1) throw unavailable();
      const mediaProjection = mapEffectiveMediaObjectProjection(effectiveRows[0]);
      const deviceTrustProjection = await this.loadEvidenceEffectiveDeviceProjection(
        transaction,
        await this.requireEvidenceDeviceAttestation(transaction, intent.deviceAttestationId),
        evaluation,
      );
      const replayedEffective = projectCanopyProofEffectiveMediaObject({
        baseProjection: baseMediaProjection,
        adapterTrustProjection: mediaAdapterTrustProjection,
        deviceTrustProjection,
      });
      if (hashJson(mediaProjection) !== hashJson(replayedEffective)) throw unavailable();

      return { baseMediaProjection, mediaAdapterTrustProjection, mediaProjection };
    });
  }

  async openEvidenceMediaReviewTask(
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin" | "verifier" | "researcher",
    idempotencyKey: string,
  ) {
    const parsed = evidenceMediaReviewTaskCommandSchema.parse(input);
    return this.executeCommand({
      actorId,
      organizationId,
      operation: "evidence.media-review-task.open",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, actorRole, input: parsed },
      replay: (transaction, taskId) => this.requireEvidenceMediaReviewTaskBundle(transaction, taskId),
      execute: async (transaction) => {
        const object = await this.requireEvidenceMediaObject(transaction, parsed.objectId);
        assertEvidenceCustodyOrganization(object.organizationId, organizationId);
        await this.lockSemanticStream(transaction, evidenceMediaStreamId(object.evidenceId));
        const intent = await this.requireEvidenceMediaUploadIntent(transaction, object.intentId);
        const opener = await this.loadVerificationActorSnapshot(transaction, actorId, actorRole, organizationId);
        const mediaProjection = await this.loadEvidenceMediaProjection(
          transaction,
          object,
          intent,
          parsed.openedAt,
        );
        const domain = await this.loadEvidenceMediaReviewDomain(transaction, object.evidenceId);
        const result = domain.openReviewTask(parsed, { intent, object, mediaProjection, opener });
        const committed = await this.loadEvidenceMediaReviewTask(transaction, result.task.id);
        if (committed) {
          if (committed.taskRoot !== result.task.taskRoot || committed.commandHash !== result.task.commandHash) {
            throw conflict();
          }
          const custodyEvent = await this.requireEvidenceMediaCustodyEventByArtifact(
            transaction,
            "media_review_task",
            committed.id,
          );
          return commandResult(
            { task: committed, custodyEvent },
            "evidence_media_review_task",
            committed.id,
            committed.taskRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, evidenceMediaStreamId(object.evidenceId), result.task.auditEvent);
        await this.insertEvidenceMediaReviewTask(transaction, result.task);
        await this.insertDomainEvent(
          transaction,
          evidenceMediaStreamId(object.evidenceId),
          result.custodyEvent.auditEvent,
        );
        await this.insertEvidenceMediaCustodyEvent(transaction, result.custodyEvent);
        return commandResult(
          result,
          "evidence_media_review_task",
          result.task.id,
          result.task.taskRoot,
          result.task.auditEvent,
        );
      },
    });
  }

  async assignEvidenceMediaReviewTask(
    input: unknown,
    organizationId: string,
    actorId: string,
    actorRole: "owner" | "admin",
    idempotencyKey: string,
  ) {
    const parsed = evidenceMediaReviewAssignmentCommandSchema.parse(input);
    return this.executeCommand({
      actorId,
      organizationId,
      operation: "evidence.media-review-task.assign",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, actorRole, input: parsed },
      replay: (transaction, assignmentId) =>
        this.requireEvidenceMediaReviewAssignmentBundle(transaction, assignmentId),
      execute: async (transaction) => {
        const task = await this.requireEvidenceMediaReviewTask(transaction, parsed.taskId);
        assertEvidenceCustodyOrganization(task.organizationId, organizationId);
        await this.lockSemanticStream(transaction, evidenceMediaStreamId(task.evidenceId));
        const assigner = await this.loadVerificationActorSnapshot(transaction, actorId, actorRole, organizationId);
        const reviewer = await this.loadVerificationActorSnapshot(
          transaction,
          parsed.reviewerId,
          "verifier",
          organizationId,
        );
        const domain = await this.loadEvidenceMediaReviewDomain(transaction, task.evidenceId);
        const result = domain.assignReviewTask(parsed, assigner, reviewer);
        const committed = await this.loadEvidenceMediaReviewAssignment(transaction, result.assignment.id);
        if (committed) {
          if (
            committed.assignmentRoot !== result.assignment.assignmentRoot ||
            committed.commandHash !== result.assignment.commandHash
          ) {
            throw conflict();
          }
          const custodyEvent = await this.requireEvidenceMediaCustodyEventByArtifact(
            transaction,
            "media_review_assignment",
            committed.id,
          );
          return commandResult(
            { assignment: committed, custodyEvent },
            "evidence_media_review_assignment",
            committed.id,
            committed.assignmentRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, evidenceMediaStreamId(task.evidenceId), result.assignment.auditEvent);
        await this.insertEvidenceMediaReviewAssignment(transaction, result.assignment);
        await this.insertDomainEvent(
          transaction,
          evidenceMediaStreamId(task.evidenceId),
          result.custodyEvent.auditEvent,
        );
        await this.insertEvidenceMediaCustodyEvent(transaction, result.custodyEvent);
        return commandResult(
          result,
          "evidence_media_review_assignment",
          result.assignment.id,
          result.assignment.assignmentRoot,
          result.assignment.auditEvent,
        );
      },
    });
  }

  async decideEvidenceMediaReviewTask(
    input: unknown,
    organizationId: string,
    reviewerId: string,
    idempotencyKey: string,
  ) {
    const parsed = evidenceMediaReviewDecisionCommandSchema.parse(input);
    return this.executeCommand({
      actorId: reviewerId,
      organizationId,
      operation: "evidence.media-review-task.decide",
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      request: { organizationId, input: parsed },
      replay: (transaction, decisionId) => this.requireEvidenceMediaReviewDecisionBundle(transaction, decisionId),
      execute: async (transaction) => {
        const task = await this.requireEvidenceMediaReviewTask(transaction, parsed.taskId);
        assertEvidenceCustodyOrganization(task.organizationId, organizationId);
        await this.lockSemanticStream(transaction, evidenceMediaStreamId(task.evidenceId));
        const object = await this.requireEvidenceMediaObject(transaction, task.objectId);
        const intent = await this.requireEvidenceMediaUploadIntent(transaction, object.intentId);
        const reviewer = await this.loadVerificationActorSnapshot(
          transaction,
          reviewerId,
          "verifier",
          organizationId,
        );
        const mediaProjection = await this.loadEvidenceMediaProjection(
          transaction,
          object,
          intent,
          parsed.decidedAt,
        );
        const domain = await this.loadEvidenceMediaReviewDomain(transaction, task.evidenceId);
        const result = domain.decideReviewTask(parsed, reviewer, mediaProjection);
        const committed = await this.loadEvidenceMediaReviewDecision(transaction, result.decision.id);
        if (committed) {
          if (
            committed.decisionRoot !== result.decision.decisionRoot ||
            committed.commandHash !== result.decision.commandHash
          ) {
            throw conflict();
          }
          const custodyEvent = await this.requireEvidenceMediaCustodyEventByArtifact(
            transaction,
            "media_review_decision",
            committed.id,
          );
          return commandResult(
            { decision: committed, custodyEvent },
            "evidence_media_review_decision",
            committed.id,
            committed.decisionRoot,
            committed.auditEvent,
          );
        }
        await this.insertDomainEvent(transaction, evidenceMediaStreamId(task.evidenceId), result.decision.auditEvent);
        await this.insertEvidenceMediaReviewDecision(transaction, result.decision);
        await this.insertDomainEvent(
          transaction,
          evidenceMediaStreamId(task.evidenceId),
          result.custodyEvent.auditEvent,
        );
        await this.insertEvidenceMediaCustodyEvent(transaction, result.custodyEvent);
        return commandResult(
          result,
          "evidence_media_review_decision",
          result.decision.id,
          result.decision.decisionRoot,
          result.decision.auditEvent,
        );
      },
    });
  }

  async getEvidenceMediaReviewTask(taskId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const task = await this.requireEvidenceMediaReviewTask(transaction, taskId);
      assertEvidenceCustodyOrganization(task.organizationId, organizationId);
      return task;
    });
  }

  async getEvidenceMediaReviewTaskProjection(taskId: string, organizationId: string) {
    return this.read(async (transaction) => {
      const task = await this.requireEvidenceMediaReviewTask(transaction, taskId);
      assertEvidenceCustodyOrganization(task.organizationId, organizationId);
      return (await this.loadEvidenceMediaReviewDomain(transaction, task.evidenceId)).projectReviewTask(taskId);
    });
  }

  async commitVisualEvidenceAuthoritySnapshot(
    snapshot: CanopyProofVisualEvidenceAuthoritySnapshot,
    scope: VisualAuthorityScope,
    actorId: string,
    idempotencyKey: string,
  ) {
    const normalizedKey = requireIdempotencyKey(idempotencyKey);
    const normalizedScope = normalizeVisualAuthorityScope(scope);
    const verification = verifyVisualEvidenceAuthoritySnapshot(snapshot);
    if (!verification.valid) {
      throw new Error(`CanopyProof visual authority snapshot is invalid: ${verification.issues.join(", ")}`);
    }
    assertVisualSnapshotScope(snapshot, normalizedScope);

    return this.executeCommand({
      actorId,
      operation: "visual.authority.snapshot.commit",
      idempotencyKey: normalizedKey,
      tenantId: normalizedScope.tenantId,
      request: { scope: normalizedScope, snapshotRoot: snapshot.snapshotRoot },
      replay: (transaction, resultId, auditEventRoot) =>
        this.requireVisualAuthoritySnapshotByResult(transaction, resultId, auditEventRoot),
      execute: async (transaction) => {
        const streamId = visualAuthorityStreamId(normalizedScope);
        await this.lockSemanticStream(transaction, streamId);
        const current = await this.loadVisualAuthoritySnapshot(transaction, normalizedScope);
        const delta = visualAuthorityDelta(current, snapshot);
        if (delta.length === 0) throw conflict();

        const actors = new Map<string, VisualAuthorityActor>();
        for (const record of delta) {
          if (record.createdBy !== actorId) {
            throw new Error("CanopyProof visual command actor does not own every appended fact.");
          }
          actors.set(record.actorAuthorityRoot, record.actorSnapshot);
        }
        for (const actor of actors.values()) {
          await this.assertCanonicalVisualActor(transaction, actor);
        }

        const recordsById = new Map(
          visualAuthorityRecords(snapshot).map((record) => [record.id, record] as const),
        );
        for (const record of delta) {
          await this.insertDomainEvent(transaction, streamId, record.auditEvent);
          await this.insertVisualAuthorityFact(transaction, record);
          if (visualRecordType(record) === "dataset_snapshot") {
            await this.insertVisualDatasetSnapshotMembers(transaction, record as DatasetSnapshot);
          } else if (visualRecordType(record) === "review_queue_snapshot") {
            await this.insertVisualReviewQueueSnapshot(
              transaction,
              record as ReviewQueueSnapshot,
              recordsById,
            );
          }
        }
        const terminal = delta.at(-1);
        if (!terminal) throw unavailable();
        return commandResult(
          snapshot,
          "visual_authority_snapshot",
          terminal.id,
          snapshot.snapshotRoot,
          terminal.auditEvent,
        );
      },
    });
  }

  async getVisualEvidenceAuthoritySnapshot(scope: VisualAuthorityScope) {
    const normalizedScope = normalizeVisualAuthorityScope(scope);
    return this.read(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT set_config('canopyproof.tenant_id', ${normalizedScope.tenantId}, true)`,
      );
      const snapshot = await this.loadVisualAuthoritySnapshot(transaction, normalizedScope);
      if (!snapshot) throw new Error("CanopyProof visual authority snapshot was not found.");
      return snapshot;
    });
  }

  private async loadVisualAuthoritySnapshot(
    transaction: TrustTransaction,
    scope: VisualAuthorityScope,
    terminalSequence?: number,
  ): Promise<CanopyProofVisualEvidenceAuthoritySnapshot | undefined> {
    const rows = visualAuthorityFactPayloadRowSchema.array().parse(
      await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact.payload, event.sequence_no
        FROM visual.authority_facts fact
        JOIN audit.domain_events event
          ON event.id = fact.audit_event_id
         AND event.event_root = fact.audit_event_root
        WHERE fact.tenant_id = ${scope.tenantId}
          AND fact.organization_id = ${scope.organizationId}
          AND fact.project_id IS NOT DISTINCT FROM ${scope.projectId ?? null}
          AND (${terminalSequence ?? null}::bigint IS NULL OR event.sequence_no <= ${terminalSequence ?? null}::bigint)
        ORDER BY event.sequence_no, fact.entity_type, fact.id, fact.entity_version
      `),
    );
    if (rows.length === 0) return undefined;
    const records = rows.map((row) => row.payload as unknown as VisualRecordEnvelope);
    const auditHistory = records.map((record) => record.auditEvent);
    return rebuildVisualEvidenceAuthoritySnapshot(records, auditHistory);
  }

  private async requireVisualAuthoritySnapshotByResult(
    transaction: TrustTransaction,
    resultEntityId: string,
    auditEventRoot: string,
  ) {
    const rows = visualAuthorityScopeRowSchema.extend({
      sequence_no: databaseSafeIntegerSchema.refine((value) => value > 0),
    }).array().parse(
      await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact.tenant_id, fact.organization_id, fact.project_id, event.sequence_no
        FROM visual.authority_facts fact
        JOIN audit.domain_events event
          ON event.id = fact.audit_event_id
         AND event.event_root = fact.audit_event_root
        WHERE fact.id = ${resultEntityId}
          AND fact.audit_event_root = ${auditEventRoot}
      `),
    );
    if (rows.length !== 1) throw unavailable();
    const row = rows[0];
    if (!row) throw unavailable();
    const snapshot = await this.loadVisualAuthoritySnapshot(
      transaction,
      {
        tenantId: row.tenant_id,
        organizationId: row.organization_id,
        ...(row.project_id ? { projectId: row.project_id } : {}),
      },
      row.sequence_no,
    );
    if (!snapshot) throw unavailable();
    return snapshot;
  }

  private async assertCanonicalVisualActor(
    transaction: TrustTransaction,
    actor: VisualAuthorityActor,
  ) {
    const actorFields = actor as unknown as Readonly<Record<string, unknown>>;
    const accreditationId =
      typeof actorFields.accreditationId === "string" ? actorFields.accreditationId : null;
    const rows = visualCanonicalActorRowSchema.array().parse(
      await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT
          participant.id,
          participant.participant_type,
          participant.organization_id AS participant_organization_id,
          participant.roles,
          participant.verification_status AS participant_verification_status,
          organization.verification_status AS organization_verification_status,
          COALESCE((
            SELECT array_agg(membership.role ORDER BY membership.role)
            FROM organizations.memberships membership
            WHERE membership.organization_id = organization.id
              AND membership.actor_id = participant.id
              AND membership.status = 'active'
          ), ARRAY[]::text[]) AS membership_roles,
          COALESCE(agent.capabilities, ARRAY[]::text[]) AS agent_capabilities,
          agent.status AS agent_status,
          agent.final_authority AS agent_final_authority,
          accreditation.id AS accreditation_id,
          accreditation.status AS accreditation_status,
          COALESCE(accreditation.scope, ARRAY[]::text[]) AS accreditation_scope,
          accreditation.audit_event_root AS accreditation_root
        FROM identity.participants participant
        JOIN organizations.organizations organization
          ON organization.id = ${actor.organizationId}
        LEFT JOIN identity.agent_profiles agent
          ON agent.id = participant.id
        LEFT JOIN organizations.accreditations accreditation
          ON accreditation.id = ${accreditationId}
         AND accreditation.organization_id = organization.id
        WHERE participant.id = ${actor.id}
      `),
    );
    if (rows.length !== 1) throw new Error("CanopyProof visual actor is not registered.");
    const authority = rows[0];
    if (
      !authority ||
      authority.participant_verification_status !== "verified" ||
      authority.organization_verification_status !== "verified" ||
      authority.participant_organization_id !== actor.organizationId
    ) {
      throw new Error("CanopyProof visual actor or organization is not verified.");
    }

    if (actor.actorType === "agent") {
      const capability = typeof actorFields.capability === "string" ? actorFields.capability : undefined;
      if (
        authority.participant_type !== "agent" ||
        !capability ||
        authority.agent_status !== "active" ||
        authority.agent_final_authority !== false ||
        !authority.agent_capabilities.includes(capability)
      ) {
        throw new Error("CanopyProof visual agent capability is not active.");
      }
      return;
    }
    if (actor.actorType !== "human" || authority.participant_type !== "human") {
      throw new Error("CanopyProof durable visual authority requires a registered human or agent.");
    }

    const membershipRole = ["auditor", "government", "un_partner"].includes(actor.role)
      ? "verifier"
      : actor.role;
    const accreditationRoot =
      typeof actorFields.accreditationRoot === "string" ? actorFields.accreditationRoot : undefined;
    const conflictFree = actorFields.conflictFree === true;
    if (
      !authority.roles.includes(membershipRole) ||
      !authority.membership_roles.includes(membershipRole) ||
      !accreditationId ||
      authority.accreditation_id !== accreditationId ||
      authority.accreditation_status !== "approved" ||
      authority.accreditation_root !== accreditationRoot ||
      !authority.accreditation_scope.includes("visual_evidence_review") ||
      !conflictFree
    ) {
      throw new Error("CanopyProof visual human reviewer lacks independent accredited authority.");
    }
  }

  private async insertVisualAuthorityFact(
    transaction: TrustTransaction,
    record: VisualRecordEnvelope,
  ) {
    const recordType = visualRecordType(record);
    const entityType = visualSqlEntityTypeByRecordType[recordType];
    let priorFactRoot = visualEvidenceAuditGenesisRoot();
    if (record.version > 1) {
      const priorRecordId =
        recordType === "review_queue_snapshot"
          ? (record as ReviewQueueSnapshot).priorQueueSnapshotId
          : record.id;
      if (!priorRecordId) throw conflict();
      const priorRows = await transaction.$queryRaw<Array<{ fact_root: string }>>(Prisma.sql`
        SELECT fact_root
        FROM visual.authority_facts
        WHERE entity_type = CAST(${entityType} AS visual.entity_type)
          AND id = ${priorRecordId}
          AND entity_version = ${record.version - 1}
      `);
      if (priorRows.length !== 1 || !priorRows[0]?.fact_root) throw conflict();
      priorFactRoot = priorRows[0].fact_root;
    }
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO visual.authority_facts (
        entity_type, id, entity_version, stream_sequence,
        tenant_id, organization_id, project_id, classification,
        license_policy_id, actor_id, actor_type, actor_authority_root,
        created_at, source_roots, payload, fact_hash, fact_root,
        prior_fact_root, audit_event_id, audit_event_root
      ) VALUES (
        CAST(${entityType} AS visual.entity_type), ${record.id}, ${record.version}, ${record.version},
        ${record.tenantId}, ${record.organizationId}, ${record.projectId ?? null},
        CAST(${record.classification} AS visual.classification),
        ${record.licensePolicyId}, ${record.createdBy}, CAST(${record.createdByActorType} AS visual.actor_type),
        ${record.actorAuthorityRoot}, ${asDate(record.createdAt)},
        CAST(${JSON.stringify(record.sourceRoots)} AS jsonb), CAST(${JSON.stringify(record)} AS jsonb),
        ${record.factHash}, ${record.factRoot}, ${priorFactRoot},
        ${record.auditEvent.id}, ${record.auditEvent.eventRoot}
      )
    `));
  }

  private async insertVisualDatasetSnapshotMembers(
    transaction: TrustTransaction,
    snapshot: DatasetSnapshot,
  ) {
    for (const [ordinal, member] of snapshot.members.entries()) {
      requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
        INSERT INTO visual.dataset_snapshot_members (
          tenant_id, organization_id, project_id, dataset_snapshot_id, ordinal,
          sample_id, asset_id, asset_version, asset_root, content_hash,
          sensor_stream_id, paired_sample_ids, license_policy_id, snapshot_fact_root
        ) VALUES (
          ${snapshot.tenantId}, ${snapshot.organizationId}, ${snapshot.projectId ?? null},
          ${snapshot.id}, ${ordinal}, ${member.sampleId}, ${member.assetId}, ${member.assetVersion},
          ${member.assetRoot}, ${member.contentHash}, ${member.sensorStreamId},
          CAST(${JSON.stringify(member.pairedSampleIds)} AS jsonb), ${member.licensePolicyId}, ${snapshot.factRoot}
        )
      `));
    }
  }

  private async insertVisualReviewQueueSnapshot(
    transaction: TrustTransaction,
    snapshot: ReviewQueueSnapshot,
    recordsById: ReadonlyMap<string, VisualRecordEnvelope>,
  ) {
    const randomQaSeedHash = snapshot.randomQaSeed
      ? hashJson({ kind: "canopyproof-visual-random-qa-seed-v1", value: snapshot.randomQaSeed })
      : null;
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO visual.review_queue_snapshots (
        tenant_id, organization_id, project_id, id, review_queue_id, version,
        dataset_snapshot_id, dataset_manifest_hash, sample_ids, candidate_ids,
        filter_expression, sort_expression, model_run_ids, random_qa_seed_hash,
        prior_queue_snapshot_id, review_queue_hash, created_by, created_at, snapshot_fact_root
      ) VALUES (
        ${snapshot.tenantId}, ${snapshot.organizationId}, ${snapshot.projectId ?? null},
        ${snapshot.id}, ${snapshot.reviewQueueId}, ${snapshot.version}, ${snapshot.datasetSnapshotId},
        ${snapshot.datasetManifestHash}, CAST(${JSON.stringify(snapshot.sampleIds)} AS jsonb),
        CAST(${JSON.stringify(snapshot.candidateIds)} AS jsonb), ${snapshot.filterExpression},
        ${snapshot.sortExpression}, CAST(${JSON.stringify(snapshot.modelRunIds)} AS jsonb),
        ${randomQaSeedHash}, ${snapshot.priorQueueSnapshotId ?? null}, ${snapshot.reviewQueueHash},
        ${snapshot.createdBy}, ${asDate(snapshot.createdAt)}, ${snapshot.factRoot}
      )
    `));
    for (const [ordinal, candidateId] of snapshot.candidateIds.entries()) {
      const candidate = recordsById.get(candidateId);
      if (!candidate || visualRecordType(candidate) !== "candidate_finding") throw unavailable();
      const finding = candidate as CandidateFinding;
      requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
        INSERT INTO visual.review_queue_members (
          tenant_id, organization_id, project_id, review_queue_snapshot_id,
          ordinal, sample_id, candidate_id, model_run_id, candidate_fact_root
        ) VALUES (
          ${snapshot.tenantId}, ${snapshot.organizationId}, ${snapshot.projectId ?? null},
          ${snapshot.id}, ${ordinal}, ${finding.sampleId}, ${finding.id},
          ${finding.modelRunId}, ${finding.factRoot}
        )
      `));
    }
  }

  private async executeCommand<T>(input: Readonly<{
    actorId: string;
    operation: string;
    idempotencyKey: string;
    tenantId?: string;
    organizationId?: string;
    request: unknown;
    replay: (
      transaction: TrustTransaction,
      resultEntityId: string,
      auditEventRoot: string,
    ) => Promise<T>;
    execute: (transaction: TrustTransaction) => Promise<CommandResult<T>>;
  }>): Promise<T> {
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: input.idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-trust-command-request-v1", actorId: input.actorId, operation: input.operation, request: input.request });
    for (let attempt = 0; attempt < canopyProofTrustCommandMaxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${input.actorId}, true)`);
            if (input.organizationId) {
              await transaction.$queryRaw(
                Prisma.sql`SELECT set_config('app.organization_id', ${input.organizationId}, true)`,
              );
            }
            if (input.tenantId) {
              await transaction.$queryRaw(
                Prisma.sql`SELECT set_config('canopyproof.tenant_id', ${input.tenantId}, true)`,
              );
            }
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `trust-command:${input.actorId}:${input.operation}:${idempotencyKeyHash}`,
            );
            const receipts = await transaction.$queryRaw<unknown[]>(Prisma.sql`
              SELECT request_hash, result_entity_type, result_entity_id,
                     response_hash, audit_event_root
              FROM audit.command_receipts
              WHERE actor_id = ${input.actorId}
                AND operation = ${input.operation}
                AND idempotency_key_hash = ${idempotencyKeyHash}
              FOR UPDATE
            `);
            if (receipts.length > 1) throw unavailable();
            const receipt = receipts[0] ? commandReceiptRowSchema.safeParse(receipts[0]) : undefined;
            if (receipt && !receipt.success) throw unavailable();
            if (receipt?.success) {
              const bindingRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
                SELECT actor_id, entity_id, event_root
                FROM audit.domain_events
                WHERE event_root = ${receipt.data.audit_event_root}
              `);
              if (bindingRows.length !== 1) throw unavailable();
              const binding = receiptEventBindingSchema.safeParse(bindingRows[0]);
              if (
                !binding.success ||
                binding.data.actor_id !== input.actorId ||
                binding.data.entity_id !== receipt.data.result_entity_id
              ) {
                throw unavailable();
              }
              if (receipt.data.request_hash !== requestHash) throw conflict();
              return input.replay(
                transaction,
                receipt.data.result_entity_id,
                receipt.data.audit_event_root,
              );
            }

            const result = await input.execute(transaction);
            const receiptId = `cp_command_${hashJson({ input: idempotencyKeyHash, operation: input.operation, actorId: input.actorId }).slice(0, 24)}`;
            requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
              INSERT INTO audit.command_receipts (
                id, actor_id, operation, idempotency_key_hash, request_hash,
                result_entity_type, result_entity_id, response_hash,
                audit_event_root, created_at
              ) VALUES (
                ${receiptId}, ${input.actorId}, ${input.operation}, ${idempotencyKeyHash}, ${requestHash},
                ${result.resultEntityType}, ${result.resultEntityId}, ${result.responseHash},
                ${result.auditEventRoot}, ${asDate(result.createdAt)}
              )
            `));
            return result.value;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof CanopyProofTrustRegistryError) throw error;
        if (
          isCanopyProofPostgresRetryableWriteConflict(error) &&
          attempt < canopyProofTrustCommandMaxAttempts - 1
        ) {
          continue;
        }
        if (
          isPrismaConflict(error) ||
          isPrismaProjectConstraintConflict(error) ||
          isPrismaEvidenceConstraintConflict(error)
        ) {
          throw conflict();
        }
        if (isPrismaFailure(error)) throw unavailable();
        throw error;
      }
    }
    throw unavailable();
  }

  private async read<T>(operation: (transaction: TrustTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    } catch (error) {
      if (error instanceof CanopyProofTrustRegistryError) throw error;
      if (isPrismaFailure(error)) throw unavailable();
      throw error;
    }
  }

  private async readOrganization<T>(
    organizationId: string,
    operation: (transaction: TrustTransaction) => Promise<T>,
  ): Promise<T> {
    return this.read(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
      );
      return operation(transaction);
    });
  }

  private async lockSemanticStream(transaction: TrustTransaction, streamId: string) {
    await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${streamId}`);
  }

  private async lockSemanticStreams(transaction: TrustTransaction, streamIds: readonly string[]) {
    for (const streamId of [...new Set(streamIds)].sort()) {
      await this.lockSemanticStream(transaction, streamId);
    }
  }

  private async lockProjectAuthorityShared(transaction: TrustTransaction, projectId: string) {
    await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${projectId}`, "shared");
  }

  private async lockEvidenceMedia(transaction: TrustTransaction, mediaHash: string) {
    await acquireCanopyProofPostgresTransactionLock(transaction, `evidence-media:${mediaHash}`);
  }

  private async touchAuthorityFence(transaction: TrustTransaction, authorityKey: string) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      INSERT INTO audit.authority_fences (authority_key, revision, updated_at)
      VALUES (${authorityKey}, 1, clock_timestamp())
      ON CONFLICT (authority_key) DO UPDATE
      SET revision = audit.authority_fences.revision + 1,
          updated_at = clock_timestamp()
      RETURNING revision::text AS revision
    `);
    if (rows.length !== 1 || !authorityFenceRowSchema.safeParse(rows[0]).success) {
      throw unavailable();
    }
  }

  private async observeAuthorityFence(transaction: TrustTransaction, authorityKey: string) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT revision::text AS revision
      FROM audit.authority_fences
      WHERE authority_key = ${authorityKey}
      FOR SHARE
    `);
    if (rows.length !== 1 || !authorityFenceRowSchema.safeParse(rows[0]).success) {
      throw unavailable();
    }
  }

  private async loadEvidenceCustodyActorSnapshot(
    transaction: TrustTransaction,
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    organizationId: string,
  ): Promise<CanopyProofEvidenceCustodyActorSnapshot> {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        participant.id,
        participant.participant_type,
        participant.roles,
        participant.verification_status,
        participant.organization_id AS participant_organization_id,
        participant.subject_hash,
        organization.id AS organization_id,
        organization.verification_status AS organization_verification_status,
        organization.profile_hash AS organization_root,
        membership.id AS membership_id,
        membership.status AS membership_status,
        membership.audit_event_root AS membership_root,
        NULL::text AS accreditation_id,
        NULL::text AS accreditation_status,
        NULL::text AS accreditation_root,
        NULL::text[] AS accreditation_scope
      FROM identity.participants participant
      JOIN organizations.organizations organization ON organization.id = ${organizationId}
      LEFT JOIN organizations.memberships membership
        ON membership.organization_id = organization.id
       AND membership.actor_id = participant.id
       AND membership.role = ${actorRole}
       AND membership.status = 'active'
      WHERE participant.id = ${actorId}
    `);
    if (rows.length !== 1) throw new Error(`CanopyProof evidence custody actor authority not found: ${actorId}`);
    const parsed = verificationActorAuthorityRowSchema.safeParse(rows[0]);
    if (!parsed.success || parsed.data.participant_type !== "human" || !parsed.data.roles.includes(actorRole)) {
      throw new Error(`CanopyProof evidence custody actor authority is invalid: ${actorId}`);
    }
    const row = parsed.data;
    const membershipId = row.membership_id;
    const membershipStatus = row.membership_status;
    const membershipRoot = row.membership_root;
    if (!membershipId || !membershipStatus || !membershipRoot) {
      throw new Error(`CanopyProof evidence custody actor membership is invalid: ${actorId}`);
    }
    const normalized = {
      id: row.id,
      participantType: "human",
      role: actorRole,
      verificationStatus: row.verification_status,
      organizationId: row.organization_id,
      organizationVerificationStatus: row.organization_verification_status,
      participantRoot: row.subject_hash,
      organizationRoot: row.organization_root,
      membershipId,
      membershipStatus,
      membershipRoot,
    } as const;
    return {
      ...normalized,
      authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(normalized),
    };
  }

  private async loadEvidenceConsentReceiptRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.consent_receipts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.subject_id, fact.subject_sequence, fact.id
    `);
  }

  private async loadEvidenceConsentRevocationRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.consent_revocations fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.subject_id, fact.subject_sequence, fact.id
    `);
  }

  private async loadEvidenceDeviceAttestationRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM identity.device_attestations fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.subject_id, fact.subject_sequence, fact.id
    `);
  }

  private async loadEvidenceCustodyDomain(transaction: TrustTransaction, subjectId: string) {
    const [receiptRows, revocationRows, attestationRows] = await Promise.all([
      this.loadEvidenceConsentReceiptRows(transaction, Prisma.sql`WHERE fact.subject_id = ${subjectId}`),
      this.loadEvidenceConsentRevocationRows(transaction, Prisma.sql`WHERE fact.subject_id = ${subjectId}`),
      this.loadEvidenceDeviceAttestationRows(transaction, Prisma.sql`WHERE fact.subject_id = ${subjectId}`),
    ]);
    return CanopyProofEvidenceCustodyAuthorityService.fromAuthoritySnapshot({
      consentReceipts: receiptRows.map(mapEvidenceConsentReceipt),
      consentRevocations: revocationRows.map(mapEvidenceConsentRevocation),
      deviceAttestations: attestationRows.map(mapEvidenceDeviceAttestation),
    });
  }

  private async loadEvidenceConsentReceipt(transaction: TrustTransaction, receiptId: string) {
    const rows = await this.loadEvidenceConsentReceiptRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${receiptId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const mapped = mapEvidenceConsentReceipt(rows[0]);
    return (await this.loadEvidenceCustodyDomain(transaction, mapped.subjectId)).getConsentReceipt(receiptId);
  }

  private async requireEvidenceConsentReceipt(transaction: TrustTransaction, receiptId: string) {
    const receipt = await this.loadEvidenceConsentReceipt(transaction, receiptId);
    if (!receipt) throw new Error(`CanopyProof evidence consent receipt not found: ${receiptId}`);
    return receipt;
  }

  private async loadEvidenceConsentRevocation(transaction: TrustTransaction, revocationId: string) {
    const rows = await this.loadEvidenceConsentRevocationRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${revocationId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const mapped = mapEvidenceConsentRevocation(rows[0]);
    return (await this.loadEvidenceCustodyDomain(transaction, mapped.subjectId)).getConsentRevocation(revocationId);
  }

  private async requireEvidenceConsentRevocation(transaction: TrustTransaction, revocationId: string) {
    const revocation = await this.loadEvidenceConsentRevocation(transaction, revocationId);
    if (!revocation) throw new Error(`CanopyProof evidence consent revocation not found: ${revocationId}`);
    return revocation;
  }

  private async loadEvidenceDeviceAttestation(transaction: TrustTransaction, attestationId: string) {
    const rows = await this.loadEvidenceDeviceAttestationRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${attestationId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const mapped = mapEvidenceDeviceAttestation(rows[0]);
    return (await this.loadEvidenceCustodyDomain(transaction, mapped.subjectId)).getDeviceAttestation(attestationId);
  }

  private async requireEvidenceDeviceAttestation(transaction: TrustTransaction, attestationId: string) {
    const attestation = await this.loadEvidenceDeviceAttestation(transaction, attestationId);
    if (!attestation) throw new Error(`CanopyProof evidence device attestation not found: ${attestationId}`);
    return attestation;
  }

  private async insertEvidenceConsentReceipt(
    transaction: TrustTransaction,
    receipt: CanopyProofEvidenceConsentReceiptFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.consent_receipts (
        id, organization_id, subject_id, subject_root, subject_authority_root,
        device_fingerprint_hash, purposes, lawful_basis, privacy_mode, policy_version,
        evidence_hash, retention_days, actor_snapshot, command_hash, subject_sequence,
        previous_event_root, receipt_hash, receipt_root, granted_at, expires_at,
        revoked_at, revocation_reason, created_by, safety, audit_event_root
      ) VALUES (
        ${receipt.id}, ${receipt.organizationId}, ${receipt.subjectId}, ${receipt.subjectRoot},
        ${receipt.subjectAuthorityRoot}, ${receipt.deviceFingerprintHash ?? null},
        ${textArray(receipt.purposes)}, ${receipt.lawfulBasis}, ${receipt.privacyMode},
        ${receipt.policyVersion}, ${receipt.evidenceHash}, ${receipt.retentionDays},
        ${jsonValue(receipt.actor)}, ${receipt.commandHash}, ${receipt.subjectSequence},
        ${receipt.previousEventRoot}, ${receipt.receiptHash}, ${receipt.receiptRoot},
        ${asDate(receipt.grantedAt)}, ${receipt.expiresAt ? asDate(receipt.expiresAt) : null},
        NULL, NULL, ${receipt.subjectId}, ${jsonValue(receipt.safety)}, ${receipt.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceConsentRevocation(
    transaction: TrustTransaction,
    revocation: CanopyProofEvidenceConsentRevocationFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.consent_revocations (
        id, receipt_id, receipt_root, organization_id, subject_id, subject_root,
        reason_hash, revoked_at, actor_snapshot, command_hash, subject_sequence,
        previous_event_root, revocation_hash, revocation_root, revoked_by, safety,
        audit_event_root
      ) VALUES (
        ${revocation.id}, ${revocation.receiptId}, ${revocation.receiptRoot},
        ${revocation.organizationId}, ${revocation.subjectId}, ${revocation.subjectRoot},
        ${revocation.reasonHash}, ${asDate(revocation.revokedAt)}, ${jsonValue(revocation.actor)},
        ${revocation.commandHash}, ${revocation.subjectSequence}, ${revocation.previousEventRoot},
        ${revocation.revocationHash}, ${revocation.revocationRoot}, ${revocation.subjectId},
        ${jsonValue(revocation.safety)}, ${revocation.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceDeviceAttestation(
    transaction: TrustTransaction,
    attestation: CanopyProofEvidenceDeviceAttestationFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO identity.device_attestations (
        id, organization_id, subject_id, subject_root, subject_authority_root,
        device_fingerprint_hash, consent_receipt_id, consent_receipt_root,
        attestation_type, provider, provider_key_id, provider_receipt_hash,
        provider_verification_state, public_key_hash, attestation_hash,
        reputation_score, risk_flags, actor_snapshot, command_hash, subject_sequence,
        previous_event_root, device_hash, attestation_root, issued_at, expires_at,
        created_by, safety, audit_event_root
      ) VALUES (
        ${attestation.id}, ${attestation.organizationId}, ${attestation.subjectId},
        ${attestation.subjectRoot}, ${attestation.subjectAuthorityRoot},
        ${attestation.deviceFingerprintHash}, ${attestation.consentReceiptId},
        ${attestation.consentReceiptRoot}, ${attestation.attestationType}, ${attestation.provider},
        ${attestation.providerKeyId}, ${attestation.providerReceiptHash},
        ${attestation.providerVerificationState}, ${attestation.publicKeyHash},
        ${attestation.attestationHash}, ${attestation.reputationScore},
        ${textArray(attestation.riskFlags)}, ${jsonValue(attestation.actor)},
        ${attestation.commandHash}, ${attestation.subjectSequence}, ${attestation.previousEventRoot},
        ${attestation.deviceHash}, ${attestation.attestationRoot}, ${asDate(attestation.issuedAt)},
        ${asDate(attestation.expiresAt)}, ${attestation.subjectId}, ${jsonValue(attestation.safety)},
        ${attestation.auditEvent.eventRoot}
      )
    `));
  }

  private async loadEvidenceConsentProjection(
    transaction: TrustTransaction,
    receipt: CanopyProofEvidenceConsentReceiptFact,
    evaluatedAt: string,
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM evidence.consent_receipt_projection(${receipt.id}, ${asDate(evaluatedAt)})
    `);
    if (rows.length !== 1) throw unavailable();
    const projection = mapEvidenceConsentProjection(rows[0]);
    const replayed = (await this.loadEvidenceCustodyDomain(transaction, receipt.subjectId)).projectConsentReceipt(
      receipt.id,
      evaluatedAt,
    );
    if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
    return projection;
  }

  private async loadEvidenceDeviceProjection(
    transaction: TrustTransaction,
    attestation: CanopyProofEvidenceDeviceAttestationFact,
    evaluatedAt: string,
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM evidence.device_attestation_projection(${attestation.id}, ${asDate(evaluatedAt)})
    `);
    if (rows.length !== 1) throw unavailable();
    const projection = mapEvidenceDeviceAttestationProjection(rows[0]);
    const replayed = (await this.loadEvidenceCustodyDomain(transaction, attestation.subjectId)).projectDeviceAttestation(
      attestation.id,
      evaluatedAt,
    );
    if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
    return projection;
  }

  private async loadEvidenceEffectiveDeviceProjection(
    transaction: TrustTransaction,
    attestation: CanopyProofEvidenceDeviceAttestationFact,
    evaluatedAt: string,
  ): Promise<CanopyProofEffectiveDeviceAttestationProjection> {
    const consent = await this.requireEvidenceConsentReceipt(transaction, attestation.consentReceiptId);
    const consentProjection = await this.loadEvidenceConsentProjection(transaction, consent, evaluatedAt);
    const factRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record
      FROM identity.device_attestation_verification_facts
      WHERE attestation_id = ${attestation.id}
        AND verified_at <= ${asDate(evaluatedAt)}
      ORDER BY verified_at, attestation_sequence, id
    `);
    const verifications = factRows.map((row) => {
      const parsed = evidenceDeviceAttestationVerificationFactRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      return assertCanopyProofDeviceAttestationVerificationFact(
        attestation,
        parsed.data.fact_record as CanopyProofDeviceAttestationVerificationFact,
      );
    });
    const projectionRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM evidence.effective_device_attestation_projection(
        ${attestation.id}, ${asDate(evaluatedAt)}
      )
    `);
    if (projectionRows.length !== 1) throw unavailable();
    const projection = mapEffectiveDeviceAttestationProjection(projectionRows[0]);
    const replayed = projectCanopyProofEffectiveDeviceAttestation({
      attestation,
      consentProjection,
      verifications,
      evaluatedAt,
    });
    if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
    return projection;
  }

  private async loadEvidenceMediaAgentSnapshot(
    transaction: TrustTransaction,
    agentId: string,
    organizationId: string,
    capability: CanopyProofEvidenceMediaAgentCapability,
  ): Promise<CanopyProofEvidenceMediaAgentSnapshot> {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        participant.id,
        participant.participant_type,
        participant.roles,
        participant.verification_status,
        participant.organization_id,
        participant.subject_hash,
        organization.verification_status AS organization_verification_status,
        organization.profile_hash AS organization_root,
        profile.agent_type,
        profile.status AS agent_status,
        profile.capabilities,
        profile.registry_hash
      FROM identity.participants participant
      JOIN organizations.organizations organization
        ON organization.id = participant.organization_id
      JOIN identity.agent_profiles profile ON profile.id = participant.id
      WHERE participant.id = ${agentId}
        AND participant.organization_id = ${organizationId}
    `);
    const schema = z.object({
      id: z.string().min(1),
      participant_type: z.literal("agent"),
      roles: z.array(z.string()).refine((roles) => roles.includes("agent")),
      verification_status: z.literal("verified"),
      organization_id: z.string().min(1),
      subject_hash: z.string().regex(/^[a-f0-9]{64}$/),
      organization_verification_status: z.literal("verified"),
      organization_root: z.string().regex(/^[a-f0-9]{64}$/),
      agent_type: z.literal("evidence"),
      agent_status: z.literal("active"),
      capabilities: z.array(z.enum(canopyProofEvidenceMediaAgentCapabilities)),
      registry_hash: z.string().regex(/^[a-f0-9]{64}$/),
    });
    if (rows.length !== 1) throw new Error(`CanopyProof evidence media agent authority not found: ${agentId}`);
    const parsed = schema.safeParse(rows[0]);
    if (!parsed.success || !parsed.data.capabilities.includes(capability)) {
      throw new Error(`CanopyProof evidence media agent lacks ${capability} capability.`);
    }
    const normalized = {
      id: parsed.data.id,
      participantType: "agent",
      role: "agent",
      verificationStatus: parsed.data.verification_status,
      organizationId: parsed.data.organization_id,
      organizationVerificationStatus: parsed.data.organization_verification_status,
      participantRoot: parsed.data.subject_hash,
      organizationRoot: parsed.data.organization_root,
      agentType: parsed.data.agent_type,
      agentStatus: parsed.data.agent_status,
      capability,
      agentRegistryHash: parsed.data.registry_hash,
    } as const;
    return { ...normalized, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(normalized) };
  }

  private async loadEvidenceMediaUploadIntentRows(
    transaction: TrustTransaction,
    organizationId: string,
    evidenceId: string,
    contentHash: string,
  ) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_upload_intent_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      WHERE fact.organization_id = ${organizationId}
        AND (fact.evidence_id = ${evidenceId} OR fact.content_hash = ${contentHash})
      ORDER BY fact.evidence_id, fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaObjectRows(
    transaction: TrustTransaction,
    organizationId: string,
    evidenceId: string,
    contentHash: string,
  ) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_object_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      WHERE fact.organization_id = ${organizationId}
        AND (fact.evidence_id = ${evidenceId} OR fact.content_hash = ${contentHash})
      ORDER BY fact.evidence_id, fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaDuplicateRows(
    transaction: TrustTransaction,
    organizationId: string,
    evidenceId: string,
    contentHash: string,
  ) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_duplicate_relation_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      WHERE fact.organization_id = ${organizationId}
        AND (fact.evidence_id = ${evidenceId} OR fact.content_hash = ${contentHash})
      ORDER BY fact.evidence_id, fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaScanRows(
    transaction: TrustTransaction,
    organizationId: string,
    evidenceId: string,
    contentHash: string,
  ) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_scan_result_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      JOIN evidence.media_object_facts object ON object.id = fact.object_id
      WHERE fact.organization_id = ${organizationId}
        AND (fact.evidence_id = ${evidenceId} OR object.content_hash = ${contentHash})
      ORDER BY fact.evidence_id, fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaDomain(
    transaction: TrustTransaction,
    evidenceId: string,
    organizationId?: string,
    contentHash?: string,
  ) {
    const registration = await this.requireEvidenceRegistration(transaction, evidenceId);
    const scopeOrganizationId = organizationId ?? registration.organizationId;
    const scopeContentHash = normalizeHash(contentHash ?? registration.media_hash);
    const [intentRows, objectRows, duplicateRows, scanRows] = await Promise.all([
      this.loadEvidenceMediaUploadIntentRows(transaction, scopeOrganizationId, evidenceId, scopeContentHash),
      this.loadEvidenceMediaObjectRows(transaction, scopeOrganizationId, evidenceId, scopeContentHash),
      this.loadEvidenceMediaDuplicateRows(transaction, scopeOrganizationId, evidenceId, scopeContentHash),
      this.loadEvidenceMediaScanRows(transaction, scopeOrganizationId, evidenceId, scopeContentHash),
    ]);
    const snapshot: CanopyProofEvidenceMediaAuthoritySnapshot = {
      uploadIntents: intentRows.map(mapEvidenceMediaUploadIntent),
      mediaObjects: objectRows.map(mapEvidenceMediaObject),
      duplicateRelations: duplicateRows.map(mapEvidenceMediaDuplicateRelation),
      scanResults: scanRows.map(mapEvidenceMediaScanResult),
    };
    return CanopyProofEvidenceMediaAuthorityService.fromAuthoritySnapshot(snapshot);
  }

  private async loadEvidenceMediaUploadIntent(transaction: TrustTransaction, intentId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string; organization_id: string; content_hash: string }>>(
      Prisma.sql`SELECT evidence_id, organization_id, content_hash FROM evidence.media_upload_intent_facts WHERE id = ${intentId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return (await this.loadEvidenceMediaDomain(
      transaction,
      rows[0]!.evidence_id,
      rows[0]!.organization_id,
      rows[0]!.content_hash,
    )).getUploadIntent(intentId);
  }

  private async requireEvidenceMediaUploadIntent(transaction: TrustTransaction, intentId: string) {
    const intent = await this.loadEvidenceMediaUploadIntent(transaction, intentId);
    if (!intent) throw new Error(`CanopyProof evidence media upload intent not found: ${intentId}`);
    return intent;
  }

  private async loadEvidenceMediaObject(transaction: TrustTransaction, objectId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string; organization_id: string; content_hash: string }>>(
      Prisma.sql`SELECT evidence_id, organization_id, content_hash FROM evidence.media_object_facts WHERE id = ${objectId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return (await this.loadEvidenceMediaDomain(
      transaction,
      rows[0]!.evidence_id,
      rows[0]!.organization_id,
      rows[0]!.content_hash,
    )).getMediaObject(objectId);
  }

  private async requireEvidenceMediaObject(transaction: TrustTransaction, objectId: string) {
    const object = await this.loadEvidenceMediaObject(transaction, objectId);
    if (!object) throw new Error(`CanopyProof evidence media object not found: ${objectId}`);
    return object;
  }

  private async loadEvidenceMediaDuplicateRelationByObject(transaction: TrustTransaction, objectId: string) {
    const rows = await transaction.$queryRaw<Array<{ id: string; evidence_id: string; organization_id: string; content_hash: string }>>(
      Prisma.sql`
        SELECT id, evidence_id, organization_id, content_hash
        FROM evidence.media_duplicate_relation_facts
        WHERE object_id = ${objectId}
      `,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const row = rows[0]!;
    return (await this.loadEvidenceMediaDomain(
      transaction,
      row.evidence_id,
      row.organization_id,
      row.content_hash,
    )).getDuplicateRelation(row.id);
  }

  private async requireEvidenceMediaDuplicateRelationByObject(transaction: TrustTransaction, objectId: string) {
    const relation = await this.loadEvidenceMediaDuplicateRelationByObject(transaction, objectId);
    if (!relation) throw new Error(`CanopyProof evidence media duplicate relation not found for object: ${objectId}`);
    return relation;
  }

  private async loadEvidenceMediaScanResult(transaction: TrustTransaction, scanId: string) {
    const rows = await transaction.$queryRaw<
      Array<{ evidence_id: string; organization_id: string; content_hash: string }>
    >(Prisma.sql`
      SELECT scan.evidence_id, scan.organization_id, object.content_hash
      FROM evidence.media_scan_result_facts scan
      JOIN evidence.media_object_facts object ON object.id = scan.object_id
      WHERE scan.id = ${scanId}
    `);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return (await this.loadEvidenceMediaDomain(
      transaction,
      rows[0]!.evidence_id,
      rows[0]!.organization_id,
      rows[0]!.content_hash,
    )).getScanResult(scanId);
  }

  private async requireEvidenceMediaScanResult(transaction: TrustTransaction, scanId: string) {
    const scan = await this.loadEvidenceMediaScanResult(transaction, scanId);
    if (!scan) throw new Error(`CanopyProof evidence media scan result not found: ${scanId}`);
    return scan;
  }

  private async loadEvidenceMediaProviderVerificationRows(
    transaction: TrustTransaction,
    tail: Prisma.Sql,
  ) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_provider_receipt_verification_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaProviderVerification(
    transaction: TrustTransaction,
    verificationId: string,
  ) {
    const rows = await this.loadEvidenceMediaProviderVerificationRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${verificationId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return mapEvidenceMediaProviderVerification(rows[0]);
  }

  private async loadEvidenceMediaProviderVerificationByIntent(
    transaction: TrustTransaction,
    intentId: string,
    organizationId: string,
  ) {
    const rows = await this.loadEvidenceMediaProviderVerificationRows(
      transaction,
      Prisma.sql`WHERE fact.intent_id = ${intentId} AND fact.organization_id = ${organizationId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return mapEvidenceMediaProviderVerification(rows[0]);
  }

  private async requireEvidenceMediaProviderVerificationByObject(
    transaction: TrustTransaction,
    objectId: string,
    organizationId: string,
  ) {
    const rows = await this.loadEvidenceMediaProviderVerificationRows(
      transaction,
      Prisma.sql`WHERE fact.object_id = ${objectId} AND fact.organization_id = ${organizationId}`,
    );
    if (rows.length !== 1) {
      throw new Error("CANOPYPROOF_E2A_PROVIDER_VERIFICATION_REQUIRED");
    }
    return mapEvidenceMediaProviderVerification(rows[0]);
  }

  private async requireEvidenceMediaProviderVerificationBundle(
    transaction: TrustTransaction,
    verificationId: string,
  ): Promise<CanopyProofEvidenceMediaProviderVerificationBundle> {
    const verification = await this.loadEvidenceMediaProviderVerification(transaction, verificationId);
    if (!verification) {
      throw new Error(`CanopyProof media provider verification not found: ${verificationId}`);
    }
    const object = await this.requireEvidenceMediaObject(transaction, verification.objectId);
    if (object.organizationId !== verification.organizationId) throw unavailable();
    const duplicateRelation = await this.loadEvidenceMediaDuplicateRelationByObject(transaction, object.id);
    return { object, ...(duplicateRelation ? { duplicateRelation } : {}), verification };
  }

  private async loadEvidenceMediaScannerVerificationRows(
    transaction: TrustTransaction,
    tail: Prisma.Sql,
  ) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        source_scan.verdict AS source_scan_verdict,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_scanner_receipt_verification_facts fact
      JOIN evidence.media_scan_result_facts source_scan ON source_scan.id = fact.scan_result_id
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaScannerVerificationByScan(
    transaction: TrustTransaction,
    scanResultId: string,
    organizationId: string,
  ) {
    const rows = await this.loadEvidenceMediaScannerVerificationRows(
      transaction,
      Prisma.sql`WHERE fact.scan_result_id = ${scanResultId} AND fact.organization_id = ${organizationId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return mapEvidenceMediaScannerVerification(rows[0]);
  }

  private async loadLatestEvidenceMediaScannerVerificationByObject(
    transaction: TrustTransaction,
    objectId: string,
    organizationId: string,
  ) {
    const rows = await this.loadEvidenceMediaScannerVerificationRows(
      transaction,
      Prisma.sql`WHERE fact.object_id = ${objectId} AND fact.organization_id = ${organizationId}`,
    );
    if (rows.length === 0) return undefined;
    return rows.map(mapEvidenceMediaScannerVerification).sort(
      (left, right) =>
        Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt) || right.id.localeCompare(left.id),
    )[0];
  }

  private async requireEvidenceMediaScannerVerificationBundle(
    transaction: TrustTransaction,
    verificationId: string,
  ): Promise<CanopyProofEvidenceMediaScannerVerificationBundle> {
    const rows = await this.loadEvidenceMediaScannerVerificationRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${verificationId}`,
    );
    if (rows.length !== 1) {
      throw new Error(`CanopyProof media scanner verification not found: ${verificationId}`);
    }
    const verification = mapEvidenceMediaScannerVerification(rows[0]);
    const scan = await this.requireEvidenceMediaScanResult(transaction, verification.scanResultId);
    if (scan.organizationId !== verification.organizationId) throw unavailable();
    return { scan, verification };
  }

  private async insertEvidenceMediaUploadIntent(
    transaction: TrustTransaction,
    intent: CanopyProofEvidenceMediaUploadIntentFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_upload_intent_facts (
        id, organization_id, project_id, project_root, project_status, evidence_id,
        subject_id, subject_root, subject_authority_root, consent_receipt_id,
        consent_receipt_root, consent_projection_root, device_attestation_id,
        device_attestation_root, device_projection_root, device_trust_state,
        content_hash, content_type, byte_length, object_key, captured_at, expires_at,
        actor_snapshot, command_hash, evidence_sequence, previous_event_root,
        intent_hash, intent_root, safety, audit_event_root
      ) VALUES (
        ${intent.id}, ${intent.organizationId}, ${intent.projectId}, ${intent.projectRoot},
        ${intent.projectStatus}, ${intent.evidenceId}, ${intent.subjectId}, ${intent.subjectRoot},
        ${intent.subjectAuthorityRoot}, ${intent.consentReceiptId}, ${intent.consentReceiptRoot},
        ${intent.consentProjectionRoot}, ${intent.deviceAttestationId}, ${intent.deviceAttestationRoot},
        ${intent.deviceProjectionRoot}, ${intent.deviceTrustState}, ${intent.contentHash},
        ${intent.contentType}, ${intent.byteLength}, ${intent.objectKey}, ${asDate(intent.capturedAt)},
        ${asDate(intent.expiresAt)}, ${jsonValue(intent.actor)}, ${intent.commandHash},
        ${intent.evidenceSequence}, ${intent.previousEventRoot}, ${intent.intentHash},
        ${intent.intentRoot}, ${jsonValue(intent.safety)}, ${intent.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaObject(
    transaction: TrustTransaction,
    object: CanopyProofEvidenceMediaObjectFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_object_facts (
        id, intent_id, intent_root, organization_id, project_id, project_root,
        evidence_id, content_hash, content_type, byte_length, object_key,
        storage_provider, provider_namespace, object_version, etag_hash,
        provider_receipt_hash, provider_verification_state, encryption_mode,
        encryption_key_ref, object_lock_mode, retain_until, stored_at, agent_snapshot,
        command_hash, evidence_sequence, previous_event_root, object_hash, object_root,
        safety, audit_event_root
      ) VALUES (
        ${object.id}, ${object.intentId}, ${object.intentRoot}, ${object.organizationId},
        ${object.projectId}, ${object.projectRoot}, ${object.evidenceId}, ${object.contentHash},
        ${object.contentType}, ${object.byteLength}, ${object.objectKey}, ${object.storageProvider},
        ${object.providerNamespace}, ${object.objectVersion}, ${object.etagHash},
        ${object.providerReceiptHash}, ${object.providerVerificationState}, ${object.encryptionMode},
        ${object.encryptionKeyRef ?? null}, ${object.objectLockMode},
        ${object.retainUntil ? asDate(object.retainUntil) : null}, ${asDate(object.storedAt)},
        ${jsonValue(object.agent)}, ${object.commandHash}, ${object.evidenceSequence},
        ${object.previousEventRoot}, ${object.objectHash}, ${object.objectRoot},
        ${jsonValue(object.safety)}, ${object.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaDuplicateRelation(
    transaction: TrustTransaction,
    relation: CanopyProofEvidenceMediaDuplicateRelationFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_duplicate_relation_facts (
        id, organization_id, project_id, evidence_id, object_id, object_root,
        duplicate_of_object_id, duplicate_of_object_root, content_hash, detected_at,
        agent_snapshot, command_hash, evidence_sequence, previous_event_root,
        relation_hash, relation_root, safety, audit_event_root
      ) VALUES (
        ${relation.id}, ${relation.organizationId}, ${relation.projectId}, ${relation.evidenceId},
        ${relation.objectId}, ${relation.objectRoot}, ${relation.duplicateOfObjectId},
        ${relation.duplicateOfObjectRoot}, ${relation.contentHash}, ${asDate(relation.detectedAt)},
        ${jsonValue(relation.agent)}, ${relation.commandHash}, ${relation.evidenceSequence},
        ${relation.previousEventRoot}, ${relation.relationHash}, ${relation.relationRoot},
        ${jsonValue(relation.safety)}, ${relation.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaScanResult(
    transaction: TrustTransaction,
    scan: CanopyProofEvidenceMediaScanResultFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_scan_result_facts (
        id, organization_id, project_id, evidence_id, object_id, object_root,
        scanner_name, scanner_version, scanner_image_digest, signature_database_version,
        verdict, finding_hashes, provider_receipt_hash, provider_verification_state,
        scanned_at, agent_snapshot, command_hash, evidence_sequence, previous_event_root,
        scan_hash, scan_root, safety, audit_event_root
      ) VALUES (
        ${scan.id}, ${scan.organizationId}, ${scan.projectId}, ${scan.evidenceId},
        ${scan.objectId}, ${scan.objectRoot}, ${scan.scannerName}, ${scan.scannerVersion},
        ${scan.scannerImageDigest}, ${scan.signatureDatabaseVersion}, ${scan.verdict},
        ${textArray(scan.findingHashes)}, ${scan.providerReceiptHash},
        ${scan.providerVerificationState}, ${asDate(scan.scannedAt)}, ${jsonValue(scan.agent)},
        ${scan.commandHash}, ${scan.evidenceSequence}, ${scan.previousEventRoot},
        ${scan.scanHash}, ${scan.scanRoot}, ${jsonValue(scan.safety)}, ${scan.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaAdapterCommandReceipt(
    transaction: TrustTransaction,
    fact: CanopyProofEvidenceMediaProviderVerificationFact | CanopyProofEvidenceMediaScannerVerificationFact,
  ) {
    const provider = fact.factType === "evidence_media_provider_receipt_verification";
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.command_receipts (
        id, actor_id, operation, idempotency_key_hash, request_hash,
        result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
      ) VALUES (
        ${fact.commandReceiptId}, ${fact.verifierId},
        ${provider ? "evidence.media-provider-receipt.verify" : "evidence.media-scanner-receipt.verify"},
        ${fact.commandHash}, ${fact.commandHash},
        ${provider ? "media_provider_receipt_verification" : "media_scanner_receipt_verification"},
        ${fact.id}, ${fact.factRoot}, ${fact.auditEvent.eventRoot}, ${asDate(fact.verifiedAt)}
      )
    `));
  }

  private async insertEvidenceMediaProviderVerification(
    transaction: TrustTransaction,
    fact: CanopyProofEvidenceMediaProviderVerificationFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_provider_receipt_verification_facts (
        id, organization_id, project_id, evidence_id, object_id, object_root,
        intent_id, intent_root, verifier_id, verifier_snapshot, storage_provider,
        provider_namespace, object_key, object_version, content_hash, content_type,
        byte_length, etag_hash, uploaded_at, encryption_mode, encryption_key_ref,
        object_lock_mode, retain_until, retention_policy_root, retention_verification_state,
        provider_receipt_hash, verified_at, provider_verification_root, command_hash,
        evidence_sequence, previous_event_root, audit_event_root, command_receipt_id,
        fact_root, safety
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId},
        ${fact.objectId}, ${fact.objectRoot}, ${fact.intentId}, ${fact.intentRoot},
        ${fact.verifierId}, ${jsonValue(fact.verifier)}, ${fact.storageProvider},
        ${fact.providerNamespace}, ${fact.objectKey}, ${fact.objectVersion},
        ${fact.contentHash}, ${fact.contentType}, ${fact.byteLength}, ${fact.etagHash},
        ${asDate(fact.uploadedAt)}, ${fact.encryptionMode}, ${fact.encryptionKeyRef ?? null},
        ${fact.objectLockMode}, ${fact.retainUntil ? asDate(fact.retainUntil) : null},
        ${fact.retentionPolicyRoot ?? null}, ${fact.retentionVerificationState},
        ${fact.providerReceiptHash}, ${asDate(fact.verifiedAt)}, ${fact.providerVerificationRoot},
        ${fact.commandHash}, ${fact.evidenceSequence}, ${fact.previousEventRoot},
        ${fact.auditEvent.eventRoot}, ${fact.commandReceiptId}, ${fact.factRoot},
        ${jsonValue(fact.safety)}
      )
    `));
  }

  private async insertEvidenceMediaScannerVerification(
    transaction: TrustTransaction,
    fact: CanopyProofEvidenceMediaScannerVerificationFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_scanner_receipt_verification_facts (
        id, organization_id, project_id, evidence_id, object_id, object_root,
        scan_result_id, scan_root, verifier_id, verifier_snapshot, scanner_id,
        signer_key_id, signature_algorithm, signature_hash, scanner_policy_root,
        object_provider_receipt_hash, scanner_receipt_hash, verified_at,
        scanner_verification_root, command_hash, evidence_sequence, previous_event_root,
        audit_event_root, command_receipt_id, fact_root, safety
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId},
        ${fact.objectId}, ${fact.objectRoot}, ${fact.scanResultId}, ${fact.scanRoot},
        ${fact.verifierId}, ${jsonValue(fact.verifier)}, ${fact.scannerId},
        ${fact.signerKeyId}, ${fact.signatureAlgorithm}, ${fact.signatureHash},
        ${fact.scannerPolicyRoot}, ${fact.objectProviderReceiptHash},
        ${fact.scannerReceiptHash}, ${asDate(fact.verifiedAt)},
        ${fact.scannerVerificationRoot}, ${fact.commandHash}, ${fact.evidenceSequence},
        ${fact.previousEventRoot}, ${fact.auditEvent.eventRoot}, ${fact.commandReceiptId},
        ${fact.factRoot}, ${jsonValue(fact.safety)}
      )
    `));
  }

  private async loadEvidenceMediaProjection(
    transaction: TrustTransaction,
    object: CanopyProofEvidenceMediaObjectFact,
    intent: CanopyProofEvidenceMediaUploadIntentFact,
    evaluatedAt: string,
  ) {
    const consent = await this.requireEvidenceConsentReceipt(transaction, intent.consentReceiptId);
    const device = await this.requireEvidenceDeviceAttestation(transaction, intent.deviceAttestationId);
    const current = {
      consent: await this.loadEvidenceConsentProjection(transaction, consent, evaluatedAt),
      device: await this.loadEvidenceEffectiveDeviceProjection(transaction, device, evaluatedAt),
    };
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM evidence.media_object_projection(${object.id}, ${asDate(evaluatedAt)})
    `);
    if (rows.length !== 1) throw unavailable();
    const projection = mapEvidenceMediaObjectProjection(rows[0]);
    const replayed = (await this.loadEvidenceMediaDomain(transaction, object.evidenceId)).projectMediaObject(
      object.id,
      evaluatedAt,
      current,
    );
    if (hashJson(projection) !== hashJson(replayed)) throw unavailable();
    return projection;
  }

  private async loadEvidenceMediaReviewTaskRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_review_task_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaReviewAssignmentRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_review_assignment_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaReviewDecisionRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_review_decision_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaCustodyEventRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.media_custody_event_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceMediaReviewDomain(transaction: TrustTransaction, evidenceId: string) {
    const [streamEvents, taskRows, assignmentRows, decisionRows, custodyRows] = await Promise.all([
      this.loadAuditHistory(transaction, evidenceMediaStreamId(evidenceId)),
      this.loadEvidenceMediaReviewTaskRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
      this.loadEvidenceMediaReviewAssignmentRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
      this.loadEvidenceMediaReviewDecisionRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
      this.loadEvidenceMediaCustodyEventRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
    ]);
    const snapshot: CanopyProofEvidenceMediaReviewAuthoritySnapshot = {
      streamEvents,
      reviewTasks: taskRows.map(mapEvidenceMediaReviewTask),
      reviewAssignments: assignmentRows.map(mapEvidenceMediaReviewAssignment),
      reviewDecisions: decisionRows.map(mapEvidenceMediaReviewDecision),
      custodyEvents: custodyRows.map(mapEvidenceMediaCustodyEvent),
    };
    return CanopyProofEvidenceMediaReviewAuthorityService.fromAuthoritySnapshot(snapshot);
  }

  private async loadEvidenceMediaReviewTask(transaction: TrustTransaction, taskId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM evidence.media_review_task_facts WHERE id = ${taskId}
    `);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return (await this.loadEvidenceMediaReviewDomain(transaction, rows[0]!.evidence_id)).getReviewTask(taskId);
  }

  private async requireEvidenceMediaReviewTask(transaction: TrustTransaction, taskId: string) {
    const task = await this.loadEvidenceMediaReviewTask(transaction, taskId);
    if (!task) throw new Error(`CanopyProof evidence media review task not found: ${taskId}`);
    return task;
  }

  private async loadEvidenceMediaReviewAssignment(transaction: TrustTransaction, assignmentId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM evidence.media_review_assignment_facts WHERE id = ${assignmentId}
    `);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return (await this.loadEvidenceMediaReviewDomain(transaction, rows[0]!.evidence_id)).getReviewAssignment(
      assignmentId,
    );
  }

  private async requireEvidenceMediaReviewAssignment(transaction: TrustTransaction, assignmentId: string) {
    const assignment = await this.loadEvidenceMediaReviewAssignment(transaction, assignmentId);
    if (!assignment) throw new Error(`CanopyProof evidence media review assignment not found: ${assignmentId}`);
    return assignment;
  }

  private async loadEvidenceMediaReviewDecision(transaction: TrustTransaction, decisionId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM evidence.media_review_decision_facts WHERE id = ${decisionId}
    `);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return (await this.loadEvidenceMediaReviewDomain(transaction, rows[0]!.evidence_id)).getReviewDecision(decisionId);
  }

  private async requireEvidenceMediaReviewDecision(transaction: TrustTransaction, decisionId: string) {
    const decision = await this.loadEvidenceMediaReviewDecision(transaction, decisionId);
    if (!decision) throw new Error(`CanopyProof evidence media review decision not found: ${decisionId}`);
    return decision;
  }

  private async loadEvidenceMediaCustodyEventByArtifact(
    transaction: TrustTransaction,
    artifactType: CanopyProofEvidenceMediaCustodyEventFact["artifactType"],
    artifactId: string,
  ) {
    const rows = await this.loadEvidenceMediaCustodyEventRows(
      transaction,
      Prisma.sql`WHERE fact.artifact_type = ${artifactType} AND fact.artifact_id = ${artifactId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const mapped = mapEvidenceMediaCustodyEvent(rows[0]);
    return (await this.loadEvidenceMediaReviewDomain(transaction, mapped.evidenceId)).getCustodyEvent(mapped.id);
  }

  private async requireEvidenceMediaCustodyEventByArtifact(
    transaction: TrustTransaction,
    artifactType: CanopyProofEvidenceMediaCustodyEventFact["artifactType"],
    artifactId: string,
  ) {
    const event = await this.loadEvidenceMediaCustodyEventByArtifact(transaction, artifactType, artifactId);
    if (!event) throw new Error(`CanopyProof evidence media custody event not found for artifact: ${artifactId}`);
    return event;
  }

  private async requireEvidenceMediaReviewTaskBundle(transaction: TrustTransaction, taskId: string) {
    const task = await this.requireEvidenceMediaReviewTask(transaction, taskId);
    return {
      task,
      custodyEvent: await this.requireEvidenceMediaCustodyEventByArtifact(
        transaction,
        "media_review_task",
        task.id,
      ),
    };
  }

  private async requireEvidenceMediaReviewAssignmentBundle(transaction: TrustTransaction, assignmentId: string) {
    const assignment = await this.requireEvidenceMediaReviewAssignment(transaction, assignmentId);
    return {
      assignment,
      custodyEvent: await this.requireEvidenceMediaCustodyEventByArtifact(
        transaction,
        "media_review_assignment",
        assignment.id,
      ),
    };
  }

  private async requireEvidenceMediaReviewDecisionBundle(transaction: TrustTransaction, decisionId: string) {
    const decision = await this.requireEvidenceMediaReviewDecision(transaction, decisionId);
    return {
      decision,
      custodyEvent: await this.requireEvidenceMediaCustodyEventByArtifact(
        transaction,
        "media_review_decision",
        decision.id,
      ),
    };
  }

  private async insertEvidenceMediaReviewTask(
    transaction: TrustTransaction,
    task: CanopyProofEvidenceMediaReviewTaskFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_review_task_facts (
        id, organization_id, project_id, evidence_id, object_id, object_root,
        media_projection_state, media_projection_root, contributor_id, review_round,
        previous_review_task_root, reason_codes, severity, policy_id, opened_by,
        opener_snapshot, opened_at, due_at, command_hash, evidence_sequence,
        previous_event_root, task_hash, task_root, safety, audit_event_root
      ) VALUES (
        ${task.id}, ${task.organizationId}, ${task.projectId}, ${task.evidenceId},
        ${task.objectId}, ${task.objectRoot}, ${task.mediaProjectionState},
        ${task.mediaProjectionRoot}, ${task.contributorId}, ${task.reviewRound},
        ${task.previousReviewTaskRoot}, ${textArray(task.reasonCodes)}, ${task.severity},
        ${task.policyId}, ${task.openedBy}, ${jsonValue(task.opener)}, ${asDate(task.openedAt)},
        ${asDate(task.dueAt)}, ${task.commandHash}, ${task.evidenceSequence},
        ${task.previousEventRoot}, ${task.taskHash}, ${task.taskRoot}, ${jsonValue(task.safety)},
        ${task.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaReviewAssignment(
    transaction: TrustTransaction,
    assignment: CanopyProofEvidenceMediaReviewAssignmentFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_review_assignment_facts (
        id, organization_id, project_id, evidence_id, object_id, task_id, task_root,
        contributor_id, reviewer_id, reviewer_snapshot, assigned_by, assigner_snapshot,
        assigned_at, command_hash, evidence_sequence, previous_event_root,
        assignment_hash, assignment_root, safety, audit_event_root
      ) VALUES (
        ${assignment.id}, ${assignment.organizationId}, ${assignment.projectId},
        ${assignment.evidenceId}, ${assignment.objectId}, ${assignment.taskId},
        ${assignment.taskRoot}, ${assignment.contributorId}, ${assignment.reviewerId},
        ${jsonValue(assignment.reviewer)}, ${assignment.assignedBy}, ${jsonValue(assignment.assigner)},
        ${asDate(assignment.assignedAt)}, ${assignment.commandHash}, ${assignment.evidenceSequence},
        ${assignment.previousEventRoot}, ${assignment.assignmentHash}, ${assignment.assignmentRoot},
        ${jsonValue(assignment.safety)}, ${assignment.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaReviewDecision(
    transaction: TrustTransaction,
    decision: CanopyProofEvidenceMediaReviewDecisionFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_review_decision_facts (
        id, organization_id, project_id, evidence_id, object_id, task_id, task_root,
        assignment_id, assignment_root, media_projection_state, media_projection_root,
        reviewer_id, reviewer_snapshot, decision, rationale_hash, limitation_hashes,
        decided_at, command_hash, evidence_sequence, previous_event_root,
        decision_hash, decision_root, safety, audit_event_root
      ) VALUES (
        ${decision.id}, ${decision.organizationId}, ${decision.projectId}, ${decision.evidenceId},
        ${decision.objectId}, ${decision.taskId}, ${decision.taskRoot}, ${decision.assignmentId},
        ${decision.assignmentRoot}, ${decision.mediaProjectionState}, ${decision.mediaProjectionRoot},
        ${decision.reviewerId}, ${jsonValue(decision.reviewer)}, ${decision.decision},
        ${decision.rationaleHash}, ${textArray(decision.limitationHashes)}, ${asDate(decision.decidedAt)},
        ${decision.commandHash}, ${decision.evidenceSequence}, ${decision.previousEventRoot},
        ${decision.decisionHash}, ${decision.decisionRoot}, ${jsonValue(decision.safety)},
        ${decision.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceMediaCustodyEvent(
    transaction: TrustTransaction,
    event: CanopyProofEvidenceMediaCustodyEventFact,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_custody_event_facts (
        id, organization_id, project_id, evidence_id, action, artifact_type,
        artifact_id, source_root, custodian_id, custodian_snapshot, custody_note_hash,
        policy_id, occurred_at, previous_custody_root, command_hash, evidence_sequence,
        previous_event_root, custody_hash, custody_root, safety, audit_event_root
      ) VALUES (
        ${event.id}, ${event.organizationId}, ${event.projectId}, ${event.evidenceId},
        ${event.action}, ${event.artifactType}, ${event.artifactId}, ${event.sourceRoot},
        ${event.custodianId}, ${jsonValue(event.custodian)}, ${event.custodyNoteHash},
        ${event.policyId}, ${asDate(event.occurredAt)}, ${event.previousCustodyRoot},
        ${event.commandHash}, ${event.evidenceSequence}, ${event.previousEventRoot},
        ${event.custodyHash}, ${event.custodyRoot}, ${jsonValue(event.safety)},
        ${event.auditEvent.eventRoot}
      )
    `));
  }

  private async loadEvidenceRegistration(transaction: TrustTransaction, evidenceId: string) {
    const rows = await this.loadEvidenceRegistrationRows(
      transaction,
      Prisma.sql`WHERE registration.id = ${evidenceId}`,
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return hydrateEvidenceAuthoritySnapshot({ registrations: [mapEvidenceRegistration(rows[0])] }).getEvidence(evidenceId);
  }

  private async requireEvidenceRegistration(transaction: TrustTransaction, evidenceId: string) {
    const evidence = await this.loadEvidenceRegistration(transaction, evidenceId);
    if (!evidence) throw new Error(`CanopyProof evidence not found: ${evidenceId}`);
    return evidence;
  }

  private async requireEvidenceOrganization(
    transaction: TrustTransaction,
    evidenceId: string,
    organizationId: string,
  ) {
    const evidence = await this.requireEvidenceRegistration(transaction, evidenceId);
    if (evidence.organizationId !== organizationId) {
      throw new Error("CanopyProof evidence organization scope mismatch.");
    }
    return evidence;
  }

  private async loadEvidenceVerificationDomain(transaction: TrustTransaction, evidenceId: string) {
    const replacementRows = await transaction.$queryRaw<Array<{ replacement_evidence_id: string | null }>>(Prisma.sql`
      SELECT replacement_evidence_id
      FROM verification.evidence_corrections
      WHERE evidence_id = ${evidenceId} AND replacement_evidence_id IS NOT NULL
    `);
    return this.loadEvidenceVerificationDomains(transaction, [
      evidenceId,
      ...replacementRows.flatMap((row) => row.replacement_evidence_id ? [row.replacement_evidence_id] : []),
    ]);
  }

  private async loadEvidenceVerificationDomains(transaction: TrustTransaction, evidenceIds: readonly string[]) {
    const normalizedEvidenceIds = [...new Set(evidenceIds)].sort();
    const registrations = await Promise.all(
      normalizedEvidenceIds.map((evidenceId) => this.requireEvidenceRegistration(transaction, evidenceId)),
    );
    const rowSets = await Promise.all(
      normalizedEvidenceIds.map(async (evidenceId) => {
        const [
          validationRows,
          analysisRows,
          reviewRows,
          challengeRows,
          resolutionRows,
          correctionRows,
          finalDecisionRows,
        ] =
          await Promise.all([
            this.loadEvidenceValidationRunRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
            this.loadEvidenceAiAnalysisRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
            this.loadEvidenceHumanReviewRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
            this.loadEvidenceChallengeRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
            this.loadEvidenceChallengeResolutionRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
            this.loadEvidenceCorrectionRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
            this.loadEvidenceFinalDecisionRows(transaction, Prisma.sql`WHERE fact.evidence_id = ${evidenceId}`),
          ]);
        return {
          validationRows,
          analysisRows,
          reviewRows,
          challengeRows,
          resolutionRows,
          correctionRows,
          finalDecisionRows,
        };
      }),
    );
    return CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot({
      registrations,
      validationRuns: rowSets.flatMap(({ validationRows }) => validationRows.map(mapEvidenceValidationRun)),
      aiAnalyses: rowSets.flatMap(({ analysisRows }) => analysisRows.map(mapEvidenceAiAnalysis)),
      humanReviews: rowSets.flatMap(({ reviewRows }) => reviewRows.map(mapEvidenceHumanReview)),
      challenges: rowSets.flatMap(({ challengeRows }) => challengeRows.map(mapEvidenceChallenge)),
      challengeResolutions: rowSets.flatMap(({ resolutionRows }) =>
        resolutionRows.map(mapEvidenceChallengeResolution),
      ),
      corrections: rowSets.flatMap(({ correctionRows }) => correctionRows.map(mapEvidenceCorrection)),
      finalDecisions: rowSets.flatMap(({ finalDecisionRows }) =>
        finalDecisionRows.map(mapEvidenceFinalDecision),
      ),
    });
  }

  private async requireEvidenceValidationRun(transaction: TrustTransaction, validationRunId: string) {
    const references = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM verification.evidence_validation_runs WHERE id = ${validationRunId}
    `);
    if (references.length !== 1 || !references[0]?.evidence_id) {
      throw new Error(`CanopyProof validation run not found: ${validationRunId}`);
    }
    return (await this.loadEvidenceVerificationDomain(transaction, references[0].evidence_id)).getValidationRun(
      validationRunId,
    );
  }

  private async requireEvidenceAiAnalysis(transaction: TrustTransaction, analysisId: string) {
    const references = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM verification.evidence_ai_analyses WHERE id = ${analysisId}
    `);
    if (references.length !== 1 || !references[0]?.evidence_id) {
      throw new Error(`CanopyProof AI analysis not found: ${analysisId}`);
    }
    return (await this.loadEvidenceVerificationDomain(transaction, references[0].evidence_id)).getAiAnalysis(analysisId);
  }

  private async requireEvidenceHumanReview(transaction: TrustTransaction, reviewId: string) {
    const references = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM verification.evidence_human_reviews WHERE id = ${reviewId}
    `);
    if (references.length !== 1 || !references[0]?.evidence_id) {
      throw new Error(`CanopyProof human review not found: ${reviewId}`);
    }
    return (await this.loadEvidenceVerificationDomain(transaction, references[0].evidence_id)).getHumanReview(reviewId);
  }

  private async requireEvidenceChallengeReference(transaction: TrustTransaction, challengeId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string; organization_id: string }>>(Prisma.sql`
      SELECT evidence_id, organization_id FROM verification.evidence_challenges WHERE id = ${challengeId}
    `);
    if (rows.length !== 1 || !rows[0]?.evidence_id || !rows[0]?.organization_id) {
      throw new Error(`CanopyProof evidence challenge not found: ${challengeId}`);
    }
    return { evidenceId: rows[0].evidence_id, organizationId: rows[0].organization_id };
  }

  private async requireEvidenceChallenge(transaction: TrustTransaction, challengeId: string) {
    const reference = await this.requireEvidenceChallengeReference(transaction, challengeId);
    return (await this.loadEvidenceVerificationDomain(transaction, reference.evidenceId)).getChallenge(challengeId);
  }

  private async requireEvidenceChallengeResolutionReference(transaction: TrustTransaction, resolutionId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string; organization_id: string }>>(Prisma.sql`
      SELECT evidence_id, organization_id
      FROM verification.evidence_challenge_resolutions
      WHERE id = ${resolutionId}
    `);
    if (rows.length !== 1 || !rows[0]?.evidence_id || !rows[0]?.organization_id) {
      throw new Error(`CanopyProof evidence challenge resolution not found: ${resolutionId}`);
    }
    return { evidenceId: rows[0].evidence_id, organizationId: rows[0].organization_id };
  }

  private async requireEvidenceChallengeResolution(transaction: TrustTransaction, resolutionId: string) {
    const reference = await this.requireEvidenceChallengeResolutionReference(transaction, resolutionId);
    return (await this.loadEvidenceVerificationDomain(transaction, reference.evidenceId)).getChallengeResolution(
      resolutionId,
    );
  }

  private async requireEvidenceCorrection(transaction: TrustTransaction, correctionId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM verification.evidence_corrections WHERE id = ${correctionId}
    `);
    if (rows.length !== 1 || !rows[0]?.evidence_id) {
      throw new Error(`CanopyProof evidence correction not found: ${correctionId}`);
    }
    return (await this.loadEvidenceVerificationDomain(transaction, rows[0].evidence_id)).getCorrection(correctionId);
  }

  private async requireEvidenceFinalDecision(transaction: TrustTransaction, decisionId: string) {
    const rows = await transaction.$queryRaw<Array<{ evidence_id: string }>>(Prisma.sql`
      SELECT evidence_id FROM verification.evidence_final_decisions WHERE id = ${decisionId}
    `);
    if (rows.length !== 1 || !rows[0]?.evidence_id) {
      throw new Error(`CanopyProof evidence final decision not found: ${decisionId}`);
    }
    return (await this.loadEvidenceVerificationDomain(transaction, rows[0].evidence_id)).getFinalDecision(decisionId);
  }

  private async loadEvidenceValidationRunRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_validation_runs fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceAiAnalysisRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_ai_analyses fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceHumanReviewRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_human_reviews fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceChallengeRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_challenges fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceChallengeResolutionRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_challenge_resolutions fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceCorrectionRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_corrections fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadEvidenceFinalDecisionRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM verification.evidence_final_decisions fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.evidence_sequence, fact.id
    `);
  }

  private async loadGovernedPolicyRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.proof_policy_versions fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.created_at, fact.id
    `);
  }

  private async loadGovernedPolicyDomain(transaction: TrustTransaction) {
    const policies = (await this.loadGovernedPolicyRows(transaction, Prisma.empty)).map(mapGovernedPolicy);
    return CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot({
      policies,
      methodologies: [],
      approvals: [],
      publications: [],
    });
  }

  private async requireGovernedPolicy(transaction: TrustTransaction, policyId: string) {
    const rows = await this.loadGovernedPolicyRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${policyId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof governed policy not found: ${policyId}`);
    const policy = mapGovernedPolicy(rows[0]);
    CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot({
      policies: (await this.loadGovernedPolicyRows(transaction, Prisma.empty)).map(mapGovernedPolicy),
      methodologies: [],
      approvals: [],
      publications: [],
    });
    return policy;
  }

  private async loadMethodologyVersionRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.methodologies fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.event_root
      ${tail}
      ORDER BY fact.created_at, fact.id
    `);
  }

  private async loadMethodologyVersionDomain(transaction: TrustTransaction) {
    const methodologies = (await this.loadMethodologyVersionRows(transaction, Prisma.empty)).map(mapMethodologyVersion);
    return CanopyProofMethodologyRegistryService.fromAuthoritySnapshot({ methodologies });
  }

  private async requireMethodologyVersion(transaction: TrustTransaction, methodologyId: string) {
    const rows = await this.loadMethodologyVersionRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${methodologyId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof methodology version not found: ${methodologyId}`);
    const methodology = mapMethodologyVersion(rows[0]);
    await this.loadMethodologyVersionDomain(transaction);
    return methodology;
  }

  private async loadMethodologyPublicationApprovalRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.methodology_publication_approvals fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.methodology_id, fact.methodology_sequence, fact.id
    `);
  }

  private async loadMethodologyPublicationRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.methodology_publications fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.published_at, fact.id
    `);
  }

  private async loadMethodologyGovernanceDomain(transaction: TrustTransaction) {
    const [policies, methodologies, approvals, publications] = await Promise.all([
      this.loadGovernedPolicyRows(transaction, Prisma.empty),
      this.loadMethodologyVersionRows(transaction, Prisma.empty),
      this.loadMethodologyPublicationApprovalRows(transaction, Prisma.empty),
      this.loadMethodologyPublicationRows(transaction, Prisma.empty),
    ]);
    return CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot({
      policies: policies.map(mapGovernedPolicy),
      methodologies: methodologies.map(mapMethodologyVersion),
      approvals: approvals.map(mapMethodologyPublicationApproval),
      publications: publications.map(mapMethodologyPublication),
    });
  }

  private async requireMethodologyPublicationApproval(transaction: TrustTransaction, approvalId: string) {
    const rows = await this.loadMethodologyPublicationApprovalRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${approvalId}`,
    );
    if (rows.length !== 1) {
      throw new Error(`CanopyProof methodology publication approval not found: ${approvalId}`);
    }
    const approval = mapMethodologyPublicationApproval(rows[0]);
    await this.loadMethodologyGovernanceDomain(transaction);
    return approval;
  }

  private async requireMethodologyPublication(transaction: TrustTransaction, publicationId: string) {
    const rows = await this.loadMethodologyPublicationRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${publicationId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof methodology publication not found: ${publicationId}`);
    const publication = mapMethodologyPublication(rows[0]);
    await this.loadMethodologyGovernanceDomain(transaction);
    return publication;
  }

  private async loadEnvironmentalProofCandidateRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM certificates.environmental_proof_candidates fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.derived_at, fact.id
    `);
  }

  private async loadEnvironmentalProofApprovalRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.environmental_proof_candidate_approvals fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.candidate_id, fact.candidate_sequence, fact.id
    `);
  }

  private async loadEnvironmentalProofRecordRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM certificates.environmental_proof_record_facts fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.candidate_id, fact.candidate_sequence, fact.id
    `);
  }

  private async loadEnvironmentalProofDomain(transaction: TrustTransaction) {
    const [candidateRows, approvalRows, recordRows] = await Promise.all([
      this.loadEnvironmentalProofCandidateRows(transaction, Prisma.empty),
      this.loadEnvironmentalProofApprovalRows(transaction, Prisma.empty),
      this.loadEnvironmentalProofRecordRows(transaction, Prisma.empty),
    ]);
    return CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot({
      candidates: candidateRows.map(mapEnvironmentalProofCandidate),
      approvals: approvalRows.map(mapEnvironmentalProofApproval),
      records: recordRows.map(mapEnvironmentalProofRecord),
    });
  }

  private async requireEnvironmentalProofCandidate(transaction: TrustTransaction, candidateId: string) {
    const rows = await this.loadEnvironmentalProofCandidateRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${candidateId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof Environmental Proof candidate not found: ${candidateId}`);
    await this.loadEnvironmentalProofDomain(transaction);
    return mapEnvironmentalProofCandidate(rows[0]);
  }

  private async requireEnvironmentalProofApproval(transaction: TrustTransaction, approvalId: string) {
    const rows = await this.loadEnvironmentalProofApprovalRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${approvalId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof Environmental Proof approval not found: ${approvalId}`);
    await this.loadEnvironmentalProofDomain(transaction);
    return mapEnvironmentalProofApproval(rows[0]);
  }

  private async requireEnvironmentalProofRecord(transaction: TrustTransaction, recordId: string) {
    const rows = await this.loadEnvironmentalProofRecordRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${recordId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof Environmental Proof record not found: ${recordId}`);
    await this.loadEnvironmentalProofDomain(transaction);
    return mapEnvironmentalProofRecord(rows[0]);
  }

  private async loadEnvironmentalProofChallengeRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM certificates.environmental_proof_challenges fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.candidate_id, fact.record_sequence, fact.id
    `);
  }

  private async loadEnvironmentalProofChallengeRiskRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM certificates.environmental_proof_challenge_risk_signals fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.record_id, fact.record_sequence, fact.id
    `);
  }

  private async loadEnvironmentalProofChallengeReviewRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.environmental_proof_challenge_reviews fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.record_id, fact.record_sequence, fact.id
    `);
  }

  private async loadEnvironmentalProofChallengeResolutionRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM governance.environmental_proof_challenge_resolutions fact
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = fact.audit_event_root
      ${tail}
      ORDER BY fact.record_id, fact.record_sequence, fact.id
    `);
  }

  private async loadEnvironmentalProofChallengeDomain(transaction: TrustTransaction) {
    const [proof, challengeRows, riskRows, reviewRows, resolutionRows] = await Promise.all([
      this.loadEnvironmentalProofDomain(transaction),
      this.loadEnvironmentalProofChallengeRows(transaction, Prisma.empty),
      this.loadEnvironmentalProofChallengeRiskRows(transaction, Prisma.empty),
      this.loadEnvironmentalProofChallengeReviewRows(transaction, Prisma.empty),
      this.loadEnvironmentalProofChallengeResolutionRows(transaction, Prisma.empty),
    ]);
    return CanopyProofEnvironmentalProofChallengeAuthorityService.fromAuthoritySnapshot(
      proof.getAuthoritySnapshot(),
      {
        challenges: challengeRows.map(mapEnvironmentalProofChallenge),
        riskSignals: riskRows.map(mapEnvironmentalProofChallengeRisk),
        reviews: reviewRows.map(mapEnvironmentalProofChallengeReview),
        resolutions: resolutionRows.map(mapEnvironmentalProofChallengeResolution),
      },
    );
  }

  private async requireEnvironmentalProofChallenge(transaction: TrustTransaction, challengeId: string) {
    const rows = await this.loadEnvironmentalProofChallengeRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${challengeId}`,
    );
    if (rows.length !== 1) throw new Error(`CanopyProof Environmental Proof challenge not found: ${challengeId}`);
    await this.loadEnvironmentalProofChallengeDomain(transaction);
    return mapEnvironmentalProofChallenge(rows[0]);
  }

  private async requireEnvironmentalProofChallengeBundle(
    transaction: TrustTransaction,
    challengeId: string,
  ): Promise<CanopyProofEnvironmentalProofChallengeBundle> {
    return (await this.loadEnvironmentalProofChallengeDomain(transaction)).getChallengeBundle(challengeId);
  }

  private async requireEnvironmentalProofChallengeReview(transaction: TrustTransaction, reviewId: string) {
    const rows = await this.loadEnvironmentalProofChallengeReviewRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${reviewId}`,
    );
    if (rows.length !== 1) {
      throw new Error(`CanopyProof Environmental Proof challenge review not found: ${reviewId}`);
    }
    await this.loadEnvironmentalProofChallengeDomain(transaction);
    return mapEnvironmentalProofChallengeReview(rows[0]);
  }

  private async requireEnvironmentalProofChallengeResolution(
    transaction: TrustTransaction,
    resolutionId: string,
  ) {
    const rows = await this.loadEnvironmentalProofChallengeResolutionRows(
      transaction,
      Prisma.sql`WHERE fact.id = ${resolutionId}`,
    );
    if (rows.length !== 1) {
      throw new Error(`CanopyProof Environmental Proof challenge resolution not found: ${resolutionId}`);
    }
    await this.loadEnvironmentalProofChallengeDomain(transaction);
    return mapEnvironmentalProofChallengeResolution(rows[0]);
  }

  private async loadEnvironmentalProofSources(
    transaction: TrustTransaction,
    projectId: string,
    evidenceIds: readonly string[],
  ) {
    const [projects, evidenceVerification, methodologyGovernance] = await Promise.all([
      this.loadProjectAuthoritySnapshot(transaction, [projectId]),
      this.loadEvidenceVerificationDomains(transaction, evidenceIds),
      this.loadMethodologyGovernanceDomain(transaction),
    ]);
    return {
      projects,
      evidenceVerification: evidenceVerification.getAuthoritySnapshot(),
      methodologyGovernance: methodologyGovernance.getAuthoritySnapshot(),
    };
  }

  private async loadVerificationActorSnapshot(
    transaction: TrustTransaction,
    actorId: string,
    actorRole: CanopyProofVerificationActorSnapshot["role"],
    organizationId: string,
  ): Promise<CanopyProofVerificationActorSnapshot> {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        participant.id,
        participant.participant_type,
        participant.roles,
        participant.verification_status,
        participant.organization_id AS participant_organization_id,
        participant.subject_hash,
        organization.id AS organization_id,
        organization.verification_status AS organization_verification_status,
        organization.profile_hash AS organization_root,
        membership.id AS membership_id,
        membership.status AS membership_status,
        membership.audit_event_root AS membership_root,
        accreditation.id AS accreditation_id,
        accreditation.status AS accreditation_status,
        accreditation.audit_event_root AS accreditation_root,
        accreditation.scope AS accreditation_scope
      FROM identity.participants participant
      JOIN organizations.organizations organization ON organization.id = ${organizationId}
      LEFT JOIN organizations.memberships membership
        ON membership.organization_id = organization.id
       AND membership.actor_id = participant.id
       AND membership.role = ${actorRole}
       AND membership.status = 'active'
      LEFT JOIN LATERAL (
        SELECT candidate.id, candidate.status, candidate.audit_event_root, candidate.scope
        FROM organizations.accreditations candidate
        WHERE candidate.organization_id = organization.id
        ORDER BY candidate.decided_at DESC, candidate.id DESC
        LIMIT 1
      ) accreditation ON true
      WHERE participant.id = ${actorId}
    `);
    if (rows.length !== 1) throw new Error(`CanopyProof verification actor authority not found: ${actorId}`);
    const parsed = verificationActorAuthorityRowSchema.safeParse(rows[0]);
    if (!parsed.success || !parsed.data.roles.includes(actorRole)) {
      throw new Error(`CanopyProof verification actor authority is invalid: ${actorId}`);
    }
    const row = parsed.data;
    if (row.participant_type === "agent") {
      if (actorRole !== "agent" || row.participant_organization_id !== organizationId) {
        throw new Error(`CanopyProof verification agent authority is invalid: ${actorId}`);
      }
    } else if (!row.membership_id || !row.membership_status || !row.membership_root) {
      throw new Error(`CanopyProof verification human membership is invalid: ${actorId}`);
    }
    const accreditationScope = [...(row.accreditation_scope ?? [])].sort();
    const normalized = {
      id: row.id,
      participantType: row.participant_type,
      role: actorRole,
      verificationStatus: row.verification_status,
      organizationId: row.organization_id,
      organizationVerificationStatus: row.organization_verification_status,
      participantRoot: row.subject_hash,
      organizationRoot: row.organization_root,
      ...(row.participant_type === "human" && row.membership_id && row.membership_status && row.membership_root
        ? {
            membershipId: row.membership_id,
            membershipStatus: row.membership_status,
            membershipRoot: row.membership_root,
          }
        : {}),
      ...(row.participant_type === "human" && row.accreditation_id && row.accreditation_status && row.accreditation_root
        ? {
            accreditationId: row.accreditation_id,
            accreditationStatus: row.accreditation_status,
            accreditationRoot: row.accreditation_root,
          }
        : {}),
      accreditationScope: row.participant_type === "human" ? accreditationScope : [],
    } as const;
    return {
      ...normalized,
      authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
    };
  }

  private async insertEvidenceValidationRun(
    transaction: TrustTransaction,
    run: CanopyProofEvidenceValidationRun,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_validation_runs (
        id, evidence_id, project_id, organization_id, evidence_root,
        ruleset_id, ruleset_version, ruleset_hash, checks, issues, outcome,
        confidence_score, executor_id, executor_snapshot, executed_at,
        command_hash, evidence_sequence, previous_event_root, validation_hash,
        validation_root, safety, audit_event_root
      ) VALUES (
        ${run.id}, ${run.evidenceId}, ${run.projectId}, ${run.organizationId}, ${run.evidenceRoot},
        ${run.rulesetId}, ${run.rulesetVersion}, ${run.rulesetHash}, ${jsonValue(run.checks)},
        ${textArray(run.issues)}, ${run.outcome}, ${run.confidenceScore}, ${run.executor.id},
        ${jsonValue(run.executor)}, ${asDate(run.executedAt)}, ${run.commandHash}, ${run.evidenceSequence},
        ${run.previousEventRoot}, ${run.validationHash}, ${run.validationRoot}, ${jsonValue(run.safety)},
        ${run.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceAiAnalysis(
    transaction: TrustTransaction,
    analysis: CanopyProofAdvisoryAiAnalysis,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_ai_analyses (
        id, evidence_id, project_id, organization_id, evidence_root,
        validation_run_id, validation_root, agent_id, agent_snapshot,
        model_provider, model_name, model_version, model_artifact_hash, prompt_hash,
        dataset_snapshot_roots, source_event_roots, execution_environment, capabilities,
        findings, recommendation, claimed_confidence_score, confidence_score, advisory_only,
        analyzed_at, command_hash, evidence_sequence, previous_event_root, analysis_hash,
        analysis_root, safety, audit_event_root
      ) VALUES (
        ${analysis.id}, ${analysis.evidenceId}, ${analysis.projectId}, ${analysis.organizationId}, ${analysis.evidenceRoot},
        ${analysis.validationRunId}, ${analysis.validationRoot}, ${analysis.agent.id}, ${jsonValue(analysis.agent)},
        ${analysis.modelProvider}, ${analysis.modelName}, ${analysis.modelVersion}, ${analysis.modelArtifactHash},
        ${analysis.promptHash}, ${textArray(analysis.datasetSnapshotRoots)}, ${textArray(analysis.sourceEventRoots)},
        ${analysis.executionEnvironment}, ${textArray(analysis.capabilities)}, ${jsonValue(analysis.findings)},
        ${analysis.recommendation}, ${analysis.claimedConfidenceScore}, ${analysis.confidenceScore}, true,
        ${asDate(analysis.analyzedAt)}, ${analysis.commandHash}, ${analysis.evidenceSequence},
        ${analysis.previousEventRoot}, ${analysis.analysisHash}, ${analysis.analysisRoot}, ${jsonValue(analysis.safety)},
        ${analysis.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceHumanReview(
    transaction: TrustTransaction,
    review: CanopyProofEvidenceHumanReview,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_human_reviews (
        id, evidence_id, project_id, organization_id, evidence_root,
        validation_run_id, validation_root, ai_analysis_ids, ai_analysis_roots,
        reviewer_id, reviewer_snapshot, decision, finding_dispositions, rationale,
        limitations, reviewed_at, command_hash, evidence_sequence, previous_event_root,
        source_root, review_hash, review_root, safety, audit_event_root
      ) VALUES (
        ${review.id}, ${review.evidenceId}, ${review.projectId}, ${review.organizationId}, ${review.evidenceRoot},
        ${review.validationRunId}, ${review.validationRoot}, ${textArray(review.aiAnalysisIds)},
        ${textArray(review.aiAnalysisRoots)}, ${review.reviewer.id}, ${jsonValue(review.reviewer)},
        ${review.decision}, ${jsonValue(review.findingDispositions)}, ${review.rationale},
        ${textArray(review.limitations)}, ${asDate(review.reviewedAt)}, ${review.commandHash},
        ${review.evidenceSequence}, ${review.previousEventRoot}, ${review.sourceRoot}, ${review.reviewHash},
        ${review.reviewRoot}, ${jsonValue(review.safety)}, ${review.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceChallenge(
    transaction: TrustTransaction,
    challenge: CanopyProofEvidenceChallenge,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_challenges (
        id, evidence_id, project_id, organization_id, evidence_root,
        challenged_reliance_state, challenged_reliance_root, challenged_terminal_event_root,
        challenged_validation_run_id, challenged_validation_root,
        challenged_ai_analysis_ids, challenged_ai_analysis_roots,
        challenged_human_review_id, challenged_human_review_root,
        reason, severity, rationale, supporting_artifact_hashes, evidence_event_roots,
        challenger_id, challenger_organization_id, challenger_snapshot, challenged_at,
        command_hash, evidence_sequence, previous_event_root, challenge_hash,
        challenge_root, safety, audit_event_root
      ) VALUES (
        ${challenge.id}, ${challenge.evidenceId}, ${challenge.projectId}, ${challenge.organizationId}, ${challenge.evidenceRoot},
        ${challenge.challengedRelianceState}, ${challenge.challengedRelianceRoot}, ${challenge.challengedTerminalEventRoot},
        ${challenge.challengedValidationRunId ?? null}, ${challenge.challengedValidationRoot ?? null},
        ${textArray(challenge.challengedAiAnalysisIds)}, ${textArray(challenge.challengedAiAnalysisRoots)},
        ${challenge.challengedHumanReviewId ?? null}, ${challenge.challengedHumanReviewRoot ?? null},
        ${challenge.reason}, ${challenge.severity}, ${challenge.rationale},
        ${textArray(challenge.supportingArtifactHashes)}, ${textArray(challenge.evidenceEventRoots)},
        ${challenge.challenger.id}, ${challenge.challenger.organizationId}, ${jsonValue(challenge.challenger)},
        ${asDate(challenge.challengedAt)}, ${challenge.commandHash}, ${challenge.evidenceSequence},
        ${challenge.previousEventRoot}, ${challenge.challengeHash}, ${challenge.challengeRoot},
        ${jsonValue(challenge.safety)}, ${challenge.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceChallengeResolution(
    transaction: TrustTransaction,
    resolution: CanopyProofEvidenceChallengeResolution,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_challenge_resolutions (
        id, challenge_id, challenge_root, evidence_id, project_id, organization_id, evidence_root,
        previous_resolution_id, previous_resolution_root, decision, rationale, limitations,
        evidence_event_roots, reviewer_id, reviewer_snapshot, reviewed_at, command_hash,
        evidence_sequence, previous_event_root, source_root, resolution_hash, resolution_root,
        safety, audit_event_root
      ) VALUES (
        ${resolution.id}, ${resolution.challengeId}, ${resolution.challengeRoot}, ${resolution.evidenceId},
        ${resolution.projectId}, ${resolution.organizationId}, ${resolution.evidenceRoot},
        ${resolution.previousResolutionId ?? null}, ${resolution.previousResolutionRoot ?? null},
        ${resolution.decision}, ${resolution.rationale}, ${textArray(resolution.limitations)},
        ${textArray(resolution.evidenceEventRoots)}, ${resolution.reviewer.id}, ${jsonValue(resolution.reviewer)},
        ${asDate(resolution.reviewedAt)}, ${resolution.commandHash}, ${resolution.evidenceSequence},
        ${resolution.previousEventRoot}, ${resolution.sourceRoot}, ${resolution.resolutionHash},
        ${resolution.resolutionRoot}, ${jsonValue(resolution.safety)}, ${resolution.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceCorrection(
    transaction: TrustTransaction,
    correction: CanopyProofEvidenceCorrection,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_corrections (
        id, challenge_id, challenge_root, resolution_id, resolution_root,
        evidence_id, project_id, organization_id, evidence_root, action,
        replacement_evidence_id, replacement_evidence_root, replacement_reliance_root,
        replacement_terminal_event_root, rationale, evidence_event_roots,
        publisher_id, publisher_snapshot, corrected_at, command_hash, evidence_sequence,
        previous_event_root, source_root, correction_hash, correction_root, safety, audit_event_root
      ) VALUES (
        ${correction.id}, ${correction.challengeId}, ${correction.challengeRoot},
        ${correction.resolutionId}, ${correction.resolutionRoot}, ${correction.evidenceId},
        ${correction.projectId}, ${correction.organizationId}, ${correction.evidenceRoot}, ${correction.action},
        ${correction.replacementEvidenceId ?? null}, ${correction.replacementEvidenceRoot ?? null},
        ${correction.replacementRelianceRoot ?? null}, ${correction.replacementTerminalEventRoot ?? null},
        ${correction.rationale}, ${textArray(correction.evidenceEventRoots)}, ${correction.publisher.id},
        ${jsonValue(correction.publisher)}, ${asDate(correction.correctedAt)}, ${correction.commandHash},
        ${correction.evidenceSequence}, ${correction.previousEventRoot}, ${correction.sourceRoot},
        ${correction.correctionHash}, ${correction.correctionRoot}, ${jsonValue(correction.safety)},
        ${correction.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEvidenceFinalDecision(
    transaction: TrustTransaction,
    decision: CanopyProofEvidenceFinalDecision,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO verification.evidence_final_decisions (
        id, evidence_id, project_id, organization_id, evidence_root,
        pre_decision_reliance_state, pre_decision_reliance_root,
        pre_decision_terminal_event_root, validation_run_id, validation_root,
        ai_analysis_ids, ai_analysis_roots, human_review_id, human_review_root,
        prior_final_decision_id, prior_final_decision_root, decision, rationale,
        limitations, source_event_roots, source_root, verifier_id, verifier_snapshot,
        decided_at, command_hash, evidence_sequence, previous_event_root,
        decision_hash, decision_root, safety, audit_event_root
      ) VALUES (
        ${decision.id}, ${decision.evidenceId}, ${decision.projectId}, ${decision.organizationId},
        ${decision.evidenceRoot}, ${decision.preDecisionRelianceState}, ${decision.preDecisionRelianceRoot},
        ${decision.preDecisionTerminalEventRoot}, ${decision.validationRunId}, ${decision.validationRoot},
        ${textArray(decision.aiAnalysisIds)}, ${textArray(decision.aiAnalysisRoots)},
        ${decision.humanReviewId}, ${decision.humanReviewRoot}, ${decision.priorFinalDecisionId ?? null},
        ${decision.priorFinalDecisionRoot ?? null}, ${decision.decision}, ${decision.rationale},
        ${textArray(decision.limitations)}, ${textArray(decision.sourceEventRoots)}, ${decision.sourceRoot},
        ${decision.verifier.id}, ${jsonValue(decision.verifier)}, ${asDate(decision.decidedAt)},
        ${decision.commandHash}, ${decision.evidenceSequence}, ${decision.previousEventRoot},
        ${decision.decisionHash}, ${decision.decisionRoot}, ${jsonValue(decision.safety)},
        ${decision.auditEvent.eventRoot}
      )
    `));
  }

  private async insertGovernedPolicy(
    transaction: TrustTransaction,
    policy: CanopyProofGovernedPolicyAuthority,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.proof_policy_versions (
        id, subject, governance_organization_id, title, required_approvals,
        allowed_reviewer_roles, supersedes_policy_id, supersedes_policy_root,
        creator_id, creator_snapshot, created_at, command_hash, policy_hash,
        policy_root, safety, audit_event_root
      ) VALUES (
        ${policy.id}, ${policy.subject}, ${policy.governanceOrganizationId}, ${policy.title},
        ${policy.requiredApprovals}, ${textArray(policy.allowedReviewerRoles)},
        ${policy.supersedesPolicyId ?? null}, ${policy.supersedesPolicyRoot ?? null},
        ${policy.creator.id}, ${jsonValue(policy.creator)}, ${asDate(policy.createdAt)},
        ${policy.commandHash}, ${policy.policyHash}, ${policy.policyRoot},
        ${jsonValue(policy.safety)}, ${policy.auditEvent.eventRoot}
      )
    `));
  }

  private async insertMethodologyVersion(
    transaction: TrustTransaction,
    methodology: CanopyProofMethodology,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.methodologies (
        id, slug, version, title, scope, status, summary, required_data_sources,
        quality_gates, minimum_gps_accuracy_meters, monitoring_cadence_days,
        evidence_retention_days, governance_approval_ids, supersedes, limitations,
        claim_boundary, quality_gate_root, methodology_hash, created_by, created_at,
        published_at, event_root
      ) VALUES (
        ${methodology.id}, ${methodology.slug}, ${methodology.version}, ${methodology.title},
        ${methodology.scope}, ${methodology.status}, ${methodology.summary},
        ${textArray(methodology.requiredDataSources)}, ${textArray(methodology.qualityGates)},
        ${methodology.minimumGpsAccuracyMeters}, ${methodology.monitoringCadenceDays},
        ${methodology.evidenceRetentionDays}, ${textArray(methodology.governanceApprovalIds)},
        ${methodology.supersedes ?? null}, ${textArray(methodology.limitations)},
        ${jsonValue(methodology.claimBoundary)}, ${methodology.qualityGateRoot},
        ${methodology.methodologyHash}, ${methodology.createdBy}, ${asDate(methodology.createdAt)},
        ${methodology.publishedAt ? asDate(methodology.publishedAt) : null},
        ${methodology.auditEvent.eventRoot}
      )
    `));
  }

  private async insertMethodologyPublicationApproval(
    transaction: TrustTransaction,
    approval: CanopyProofMethodologyPublicationApproval,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.methodology_publication_approvals (
        id, methodology_id, methodology_hash, methodology_event_root,
        policy_id, policy_root, governance_organization_id,
        prior_approval_id, prior_approval_root, decision, rationale,
        conflict_disclosure, limitations, source_event_roots, source_root,
        approver_id, approver_snapshot, decided_at, command_hash,
        methodology_sequence, previous_event_root, approval_hash,
        approval_root, safety, audit_event_root
      ) VALUES (
        ${approval.id}, ${approval.methodologyId}, ${approval.methodologyHash},
        ${approval.methodologyEventRoot}, ${approval.policyId}, ${approval.policyRoot},
        ${approval.governanceOrganizationId}, ${approval.priorApprovalId ?? null},
        ${approval.priorApprovalRoot ?? null}, ${approval.decision}, ${approval.rationale},
        ${approval.conflictDisclosure}, ${textArray(approval.limitations)},
        ${textArray(approval.sourceEventRoots)}, ${approval.sourceRoot}, ${approval.approver.id},
        ${jsonValue(approval.approver)}, ${asDate(approval.decidedAt)}, ${approval.commandHash},
        ${approval.methodologySequence}, ${approval.previousEventRoot}, ${approval.approvalHash},
        ${approval.approvalRoot}, ${jsonValue(approval.safety)}, ${approval.auditEvent.eventRoot}
      )
    `));
  }

  private async insertMethodologyPublication(
    transaction: TrustTransaction,
    publication: CanopyProofMethodologyPublication,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.methodology_publications (
        id, methodology_id, methodology_hash, methodology_quality_gate_root,
        methodology_event_root, policy_id, policy_root, governance_organization_id,
        approval_ids, approval_roots, approval_quorum_root, publisher_id,
        publisher_snapshot, rationale, limitations, source_event_roots, source_root,
        published_at, command_hash, methodology_sequence, previous_event_root,
        publication_hash, publication_root, safety, audit_event_root
      ) VALUES (
        ${publication.id}, ${publication.methodologyId}, ${publication.methodologyHash},
        ${publication.methodologyQualityGateRoot}, ${publication.methodologyEventRoot},
        ${publication.policyId}, ${publication.policyRoot}, ${publication.governanceOrganizationId},
        ${textArray(publication.approvalIds)}, ${textArray(publication.approvalRoots)},
        ${publication.approvalQuorumRoot}, ${publication.publisher.id},
        ${jsonValue(publication.publisher)}, ${publication.rationale},
        ${textArray(publication.limitations)}, ${textArray(publication.sourceEventRoots)},
        ${publication.sourceRoot}, ${asDate(publication.publishedAt)}, ${publication.commandHash},
        ${publication.methodologySequence}, ${publication.previousEventRoot},
        ${publication.publicationHash}, ${publication.publicationRoot},
        ${jsonValue(publication.safety)}, ${publication.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofCandidate(
    transaction: TrustTransaction,
    candidate: CanopyProofEnvironmentalProofCandidate,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO certificates.environmental_proof_candidates (
        id, organization_id, project_id, project_status, project_root,
        project_event_root, methodology_id, methodology_hash,
        methodology_quality_gate_root, methodology_event_root,
        methodology_publication_id, methodology_publication_root,
        methodology_publication_event_root, methodology_publication_bundle_root,
        methodology_publication_policy_root, methodology_publication_policy_event_root,
        methodology_approval_roots, methodology_approval_quorum_root,
        policy_id, policy_hash, policy_root, policy_event_root,
        required_approvals, allowed_reviewer_roles, evidence_ids,
        evidence_registration_roots, evidence_final_decision_ids,
        evidence_final_decision_roots, evidence_final_verification_roots,
        evidence_root, final_decision_root, monitoring_event_ids,
        monitoring_roots, monitoring_root, contributor_ids, source_actor_ids,
        public_location, confidence_score, limitations, source_event_roots,
        source_root, authority_root, derived_by_id, derived_by_snapshot,
        derived_at, command_hash, candidate_hash, candidate_root, safety,
        audit_event_root
      ) VALUES (
        ${candidate.id}, ${candidate.organizationId}, ${candidate.projectId},
        ${candidate.projectStatus}, ${candidate.projectRoot}, ${candidate.projectEventRoot},
        ${candidate.methodologyId}, ${candidate.methodologyHash},
        ${candidate.methodologyQualityGateRoot}, ${candidate.methodologyEventRoot},
        ${candidate.methodologyPublicationId}, ${candidate.methodologyPublicationRoot},
        ${candidate.methodologyPublicationEventRoot}, ${candidate.methodologyPublicationBundleRoot},
        ${candidate.methodologyPublicationPolicyRoot}, ${candidate.methodologyPublicationPolicyEventRoot},
        ${textArray(candidate.methodologyApprovalRoots)}, ${candidate.methodologyApprovalQuorumRoot},
        ${candidate.policyId}, ${candidate.policyHash}, ${candidate.policyRoot}, ${candidate.policyEventRoot},
        ${candidate.requiredApprovals}, ${textArray(candidate.allowedReviewerRoles)},
        ${textArray(candidate.evidenceIds)}, ${textArray(candidate.evidenceRegistrationRoots)},
        ${textArray(candidate.evidenceFinalDecisionIds)}, ${textArray(candidate.evidenceFinalDecisionRoots)},
        ${textArray(candidate.evidenceFinalVerificationRoots)}, ${candidate.evidenceRoot},
        ${candidate.finalDecisionRoot}, ${textArray(candidate.monitoringEventIds)},
        ${textArray(candidate.monitoringRoots)}, ${candidate.monitoringRoot},
        ${textArray(candidate.contributorIds)}, ${textArray(candidate.sourceActorIds)},
        ${jsonValue(candidate.publicLocation)}, ${candidate.confidenceScore},
        ${textArray(candidate.limitations)}, ${textArray(candidate.sourceEventRoots)},
        ${candidate.sourceRoot}, ${candidate.authorityRoot}, ${candidate.derivedBy.id},
        ${jsonValue(candidate.derivedBy)}, ${asDate(candidate.derivedAt)}, ${candidate.commandHash},
        ${candidate.candidateHash}, ${candidate.candidateRoot}, ${jsonValue(candidate.safety)},
        ${candidate.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofApproval(
    transaction: TrustTransaction,
    approval: CanopyProofEnvironmentalProofCandidateApproval,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.environmental_proof_candidate_approvals (
        id, candidate_id, candidate_root, organization_id, project_id,
        policy_id, policy_hash, prior_approval_id, prior_approval_root,
        decision, rationale, conflict_disclosure, limitations,
        source_event_roots, source_root, approver_id, approver_snapshot,
        decided_at, command_hash, candidate_sequence, previous_event_root,
        approval_hash, approval_root, safety, audit_event_root
      ) VALUES (
        ${approval.id}, ${approval.candidateId}, ${approval.candidateRoot},
        ${approval.organizationId}, ${approval.projectId}, ${approval.policyId},
        ${approval.policyHash}, ${approval.priorApprovalId ?? null},
        ${approval.priorApprovalRoot ?? null}, ${approval.decision}, ${approval.rationale},
        ${approval.conflictDisclosure}, ${textArray(approval.limitations)},
        ${textArray(approval.sourceEventRoots)}, ${approval.sourceRoot}, ${approval.approver.id},
        ${jsonValue(approval.approver)}, ${asDate(approval.decidedAt)}, ${approval.commandHash},
        ${approval.candidateSequence}, ${approval.previousEventRoot}, ${approval.approvalHash},
        ${approval.approvalRoot}, ${jsonValue(approval.safety)}, ${approval.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofRecord(
    transaction: TrustTransaction,
    record: CanopyProofEnvironmentalProofRecord,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO certificates.environmental_proof_record_facts (
        id, record_type, candidate_id, candidate_root, authority_root,
        organization_id, project_id, project_root, methodology_id,
        methodology_hash, methodology_publication_id, methodology_publication_root,
        policy_id, policy_root, evidence_ids, evidence_root,
        evidence_final_decision_ids, evidence_final_decision_roots,
        monitoring_event_ids, monitoring_root, contributor_ids, public_location,
        confidence_score, governance_approval_ids, governance_approval_roots,
        governance_quorum_root, issuer_id, issuer_snapshot, rationale,
        limitations, source_event_roots, source_root, issued_at, command_hash,
        candidate_sequence, previous_event_root, record_hash, record_root,
        status, claim_boundary, audit_event_root
      ) VALUES (
        ${record.id}, ${record.recordType}, ${record.candidateId}, ${record.candidateRoot},
        ${record.authorityRoot}, ${record.organizationId}, ${record.projectId},
        ${record.projectRoot}, ${record.methodologyId}, ${record.methodologyHash},
        ${record.methodologyPublicationId}, ${record.methodologyPublicationRoot},
        ${record.policyId}, ${record.policyRoot}, ${textArray(record.evidenceIds)},
        ${record.evidenceRoot}, ${textArray(record.evidenceFinalDecisionIds)},
        ${textArray(record.evidenceFinalDecisionRoots)}, ${textArray(record.monitoringEventIds)},
        ${record.monitoringRoot}, ${textArray(record.contributorIds)},
        ${jsonValue(record.publicLocation)}, ${record.confidenceScore},
        ${textArray(record.governanceApprovalIds)}, ${textArray(record.governanceApprovalRoots)},
        ${record.governanceQuorumRoot}, ${record.issuer.id}, ${jsonValue(record.issuer)},
        ${record.rationale}, ${textArray(record.limitations)}, ${textArray(record.sourceEventRoots)},
        ${record.sourceRoot}, ${asDate(record.issuedAt)}, ${record.commandHash},
        ${record.candidateSequence}, ${record.previousEventRoot}, ${record.recordHash},
        ${record.recordRoot}, ${record.status}, ${jsonValue(record.claimBoundary)},
        ${record.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofChallenge(
    transaction: TrustTransaction,
    challenge: CanopyProofEnvironmentalProofChallenge,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO certificates.environmental_proof_challenges (
        id, record_id, record_root, candidate_id, candidate_root, authority_root,
        organization_id, project_id, policy_id, policy_hash, policy_root,
        challenged_record_state, challenged_record_projection_root,
        challenged_source_authority_current, challenged_current_authority_root,
        prior_challenge_id, prior_resolution_id, prior_resolution_root,
        reason, severity, rationale, supporting_artifact_hashes,
        source_event_roots, source_root, challenger_id, challenger_snapshot,
        challenger_organization_id, opened_at, command_hash, record_sequence,
        previous_event_root, challenge_hash, challenge_root, safety, audit_event_root
      ) VALUES (
        ${challenge.id}, ${challenge.recordId}, ${challenge.recordRoot},
        ${challenge.candidateId}, ${challenge.candidateRoot}, ${challenge.authorityRoot},
        ${challenge.organizationId}, ${challenge.projectId}, ${challenge.policyId},
        ${challenge.policyHash}, ${challenge.policyRoot}, ${challenge.challengedRecordState},
        ${challenge.challengedRecordProjectionRoot}, ${challenge.challengedSourceAuthorityCurrent},
        ${challenge.challengedCurrentAuthorityRoot}, ${challenge.priorChallengeId ?? null},
        ${challenge.priorResolutionId ?? null}, ${challenge.priorResolutionRoot ?? null},
        ${challenge.reason}, ${challenge.severity}, ${challenge.rationale},
        ${textArray(challenge.supportingArtifactHashes)}, ${textArray(challenge.sourceEventRoots)},
        ${challenge.sourceRoot}, ${challenge.challenger.id}, ${jsonValue(challenge.challenger)},
        ${challenge.challengerOrganizationId}, ${asDate(challenge.openedAt)}, ${challenge.commandHash},
        ${challenge.recordSequence}, ${challenge.previousEventRoot}, ${challenge.challengeHash},
        ${challenge.challengeRoot}, ${jsonValue(challenge.safety)}, ${challenge.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofChallengeRisk(
    transaction: TrustTransaction,
    risk: CanopyProofEnvironmentalProofChallengeRiskSignal,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO certificates.environmental_proof_challenge_risk_signals (
        id, challenge_id, challenge_root, record_id, record_root,
        organization_id, project_id, reason, risk_level, source_event_roots,
        source_root, detected_by_id, detected_by_snapshot, detected_at,
        record_sequence, previous_event_root, risk_hash, risk_root, safety,
        audit_event_root
      ) VALUES (
        ${risk.id}, ${risk.challengeId}, ${risk.challengeRoot}, ${risk.recordId},
        ${risk.recordRoot}, ${risk.organizationId}, ${risk.projectId}, ${risk.reason},
        ${risk.riskLevel}, ${textArray(risk.sourceEventRoots)}, ${risk.sourceRoot},
        ${risk.detectedBy.id}, ${jsonValue(risk.detectedBy)}, ${asDate(risk.detectedAt)},
        ${risk.recordSequence}, ${risk.previousEventRoot}, ${risk.riskHash}, ${risk.riskRoot},
        ${jsonValue(risk.safety)}, ${risk.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofChallengeReview(
    transaction: TrustTransaction,
    review: CanopyProofEnvironmentalProofChallengeReview,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.environmental_proof_challenge_reviews (
        id, challenge_id, challenge_root, risk_signal_id, risk_root,
        record_id, record_root, organization_id, project_id, policy_id,
        policy_hash, policy_root, prior_review_id, prior_review_root,
        decision, rationale, conflict_disclosure, limitations, source_event_roots,
        source_root, reviewer_id, reviewer_snapshot, reviewed_at, command_hash,
        record_sequence, previous_event_root, review_hash, review_root, safety,
        audit_event_root
      ) VALUES (
        ${review.id}, ${review.challengeId}, ${review.challengeRoot}, ${review.riskSignalId},
        ${review.riskRoot}, ${review.recordId}, ${review.recordRoot}, ${review.organizationId},
        ${review.projectId}, ${review.policyId}, ${review.policyHash}, ${review.policyRoot},
        ${review.priorReviewId ?? null}, ${review.priorReviewRoot ?? null}, ${review.decision},
        ${review.rationale}, ${review.conflictDisclosure}, ${textArray(review.limitations)},
        ${textArray(review.sourceEventRoots)}, ${review.sourceRoot}, ${review.reviewer.id},
        ${jsonValue(review.reviewer)}, ${asDate(review.reviewedAt)}, ${review.commandHash},
        ${review.recordSequence}, ${review.previousEventRoot}, ${review.reviewHash},
        ${review.reviewRoot}, ${jsonValue(review.safety)}, ${review.auditEvent.eventRoot}
      )
    `));
  }

  private async insertEnvironmentalProofChallengeResolution(
    transaction: TrustTransaction,
    resolution: CanopyProofEnvironmentalProofChallengeResolution,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.environmental_proof_challenge_resolutions (
        id, challenge_id, challenge_root, risk_signal_id, risk_root,
        record_id, record_root, organization_id, project_id, policy_id,
        policy_hash, policy_root, review_ids, review_roots, review_quorum_root,
        decision, rationale, limitations, source_event_roots, source_root,
        resolver_id, resolver_snapshot, resolved_at, command_hash, record_sequence,
        previous_event_root, resolution_hash, resolution_root, safety, audit_event_root
      ) VALUES (
        ${resolution.id}, ${resolution.challengeId}, ${resolution.challengeRoot},
        ${resolution.riskSignalId}, ${resolution.riskRoot}, ${resolution.recordId},
        ${resolution.recordRoot}, ${resolution.organizationId}, ${resolution.projectId},
        ${resolution.policyId}, ${resolution.policyHash}, ${resolution.policyRoot},
        ${textArray(resolution.reviewIds)}, ${textArray(resolution.reviewRoots)},
        ${resolution.reviewQuorumRoot}, ${resolution.decision}, ${resolution.rationale},
        ${textArray(resolution.limitations)}, ${textArray(resolution.sourceEventRoots)},
        ${resolution.sourceRoot}, ${resolution.resolver.id}, ${jsonValue(resolution.resolver)},
        ${asDate(resolution.resolvedAt)}, ${resolution.commandHash}, ${resolution.recordSequence},
        ${resolution.previousEventRoot}, ${resolution.resolutionHash}, ${resolution.resolutionRoot},
        ${jsonValue(resolution.safety)}, ${resolution.auditEvent.eventRoot}
      )
    `));
  }

  private async findEvidenceByMediaHash(transaction: TrustTransaction, mediaHash: string) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM evidence.evidence_objects WHERE media_hash = ${mediaHash}
    `);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1 || !rows[0]?.id) throw unavailable();
    return rows[0].id;
  }

  private async loadEvidenceRegistrationRows(transaction: TrustTransaction, tail: Prisma.Sql) {
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        registration.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM evidence.evidence_objects registration
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = registration.audit_event_root
      ${tail}
    `);
  }

  private async loadProjectRegistration(transaction: TrustTransaction, projectId: string) {
    const rows = await this.loadProjectRegistrationRows(transaction, [projectId]);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    return mapProjectRegistration(rows[0]);
  }

  private async requireProjectRegistration(transaction: TrustTransaction, projectId: string) {
    const project = await this.loadProjectRegistration(transaction, projectId);
    if (!project) throw new Error(`CanopyProof project not found: ${projectId}`);
    return project;
  }

  private async requireProjectDomain(transaction: TrustTransaction, projectId: string) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM projects.projects WHERE id = ${projectId}
    `);
    if (rows.length === 0) throw new Error(`CanopyProof project not found: ${projectId}`);
    if (rows.length !== 1) throw unavailable();
    return this.loadProjectDomain(transaction, [projectId]);
  }

  private async loadProjectDomain(
    transaction: TrustTransaction,
    projectIds: readonly string[],
    maximumSequence?: number,
  ) {
    if (projectIds.length === 0) return new CanopyProofProjectRegistryService();
    return hydrateProjectAuthoritySnapshot(
      await this.loadProjectAuthoritySnapshot(transaction, projectIds, maximumSequence),
    );
  }

  private async loadProjectAuthoritySnapshot(
    transaction: TrustTransaction,
    projectIds: readonly string[],
    maximumSequence?: number,
  ): Promise<CanopyProofProjectAuthoritySnapshot> {
    if (projectIds.length === 0) {
      return { projects: [], statusTransitions: [], monitoringEvents: [] };
    }
    const sequenceBound = maximumSequence === undefined
      ? Prisma.empty
      : Prisma.sql`AND semantic_event.sequence_no <= ${maximumSequence}`;
    const projectRows = await this.loadProjectRegistrationRows(transaction, projectIds);
    const transitionRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT
          transition.*,
          semantic_event.id AS semantic_event_id,
          semantic_event.action AS semantic_event_action,
          semantic_event.actor_id AS semantic_event_actor_id,
          semantic_event.entity_type AS semantic_event_entity_type,
          semantic_event.entity_id AS semantic_event_entity_id,
          semantic_event.previous_root AS semantic_event_previous_root,
          semantic_event.payload_hash AS semantic_event_payload_hash,
          semantic_event.event_root AS semantic_event_root,
          semantic_event.created_at AS semantic_event_created_at,
          semantic_event.rationale AS semantic_event_rationale,
          semantic_event.sequence_no AS semantic_event_sequence_no
        FROM projects.project_status_transitions transition
        JOIN audit.domain_events semantic_event ON semantic_event.event_root = transition.audit_event_root
        WHERE transition.project_id = ANY(${textArray(projectIds)})
          ${sequenceBound}
        ORDER BY transition.project_id, semantic_event.sequence_no, transition.id
      `);
    const monitoringRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT
          monitoring.*,
          semantic_event.id AS semantic_event_id,
          semantic_event.action AS semantic_event_action,
          semantic_event.actor_id AS semantic_event_actor_id,
          semantic_event.entity_type AS semantic_event_entity_type,
          semantic_event.entity_id AS semantic_event_entity_id,
          semantic_event.previous_root AS semantic_event_previous_root,
          semantic_event.payload_hash AS semantic_event_payload_hash,
          semantic_event.event_root AS semantic_event_root,
          semantic_event.created_at AS semantic_event_created_at,
          semantic_event.rationale AS semantic_event_rationale,
          semantic_event.sequence_no AS semantic_event_sequence_no
        FROM projects.monitoring_events monitoring
        JOIN audit.domain_events semantic_event ON semantic_event.event_root = monitoring.audit_event_root
        WHERE monitoring.project_id = ANY(${textArray(projectIds)})
          ${sequenceBound}
        ORDER BY monitoring.project_id, semantic_event.sequence_no, monitoring.id
      `);
    if (projectRows.length !== projectIds.length) throw unavailable();
    return {
      projects: projectRows.map((row) => mapProjectRegistration(row)),
      statusTransitions: transitionRows.map((row) => mapProjectStatusTransition(row)),
      monitoringEvents: monitoringRows.map((row) => mapProjectMonitoringEvent(row)),
    };
  }

  private async loadProjectRegistrationRows(transaction: TrustTransaction, projectIds: readonly string[]) {
    if (projectIds.length === 0) return [];
    return transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        registration.*,
        semantic_event.id AS semantic_event_id,
        semantic_event.action AS semantic_event_action,
        semantic_event.actor_id AS semantic_event_actor_id,
        semantic_event.entity_type AS semantic_event_entity_type,
        semantic_event.entity_id AS semantic_event_entity_id,
        semantic_event.previous_root AS semantic_event_previous_root,
        semantic_event.payload_hash AS semantic_event_payload_hash,
        semantic_event.event_root AS semantic_event_root,
        semantic_event.created_at AS semantic_event_created_at,
        semantic_event.rationale AS semantic_event_rationale,
        semantic_event.sequence_no AS semantic_event_sequence_no
      FROM projects.projects registration
      JOIN audit.domain_events semantic_event ON semantic_event.event_root = registration.audit_event_root
      WHERE registration.id = ANY(${textArray(projectIds)})
      ORDER BY registration.id
    `);
  }

  private async requireProjectAtSequence(
    transaction: TrustTransaction,
    projectId: string,
    boundaryEvent: CanopyProofAuditEvent,
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT sequence_no
      FROM audit.domain_events
      WHERE stream_id = ${projectId}
        AND event_root = ${boundaryEvent.eventRoot}
    `);
    if (rows.length !== 1) throw unavailable();
    const parsed = z.object({ sequence_no: z.coerce.number().int().positive() }).safeParse(rows[0]);
    if (!parsed.success) throw unavailable();
    return (await this.loadProjectDomain(transaction, [projectId], parsed.data.sequence_no)).getProject(projectId);
  }

  private async requireProjectStatusTransition(transaction: TrustTransaction, transitionId: string) {
    const rows = await transaction.$queryRaw<Array<{ project_id: string }>>(Prisma.sql`
      SELECT project_id FROM projects.project_status_transitions WHERE id = ${transitionId}
    `);
    if (rows.length === 0) throw new Error(`CanopyProof project status transition not found: ${transitionId}`);
    if (rows.length !== 1 || !rows[0]?.project_id) throw unavailable();
    return (await this.loadProjectDomain(transaction, [rows[0].project_id])).getProjectStatusTransition(transitionId);
  }

  private async requireProjectMonitoringEvent(transaction: TrustTransaction, eventId: string) {
    const rows = await transaction.$queryRaw<Array<{ project_id: string }>>(Prisma.sql`
      SELECT project_id FROM projects.monitoring_events WHERE id = ${eventId}
    `);
    if (rows.length === 0) throw new Error(`CanopyProof project monitoring event not found: ${eventId}`);
    if (rows.length !== 1 || !rows[0]?.project_id) throw unavailable();
    return (await this.loadProjectDomain(transaction, [rows[0].project_id])).getMonitoringEvent(eventId);
  }

  private async insertEvidenceRegistration(
    transaction: TrustTransaction,
    evidence: CanopyProofEvidenceRegistration,
  ) {
    const auditEvent = evidence.audit_history[0];
    if (!auditEvent) throw unavailable();
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.evidence_objects (
        id, project_id, organization_id, project_root_at_submission,
        project_status_at_submission, project_region_id_at_submission,
        project_authority_updated_at_at_submission,
        evidence_type, location, observed_at, contributor_id, contributor_role,
        media_hash, gps_hash, offline_sync_id, device_fingerprint_hash, exif_hash,
        verification_status, confidence_score, reviewers, validation_issues,
        created_at, evidence_hash, evidence_root, audit_event_root,
        audit_history, claim_boundary
      ) VALUES (
        ${evidence.id}, ${evidence.projectId}, ${evidence.organizationId}, ${evidence.projectRootAtSubmission},
        ${evidence.projectStatusAtSubmission}, ${evidence.projectRegionIdAtSubmission},
        ${asDate(evidence.projectAuthorityUpdatedAtAtSubmission)},
        ${evidence.evidenceType}, ${jsonValue(evidence.location)}, ${asDate(evidence.timestamp)},
        ${evidence.contributor}, ${evidence.contributorRole}, ${evidence.media_hash}, ${evidence.gps_hash},
        ${evidence.offline_sync_id ?? null}, ${evidence.device_fingerprint_hash ?? null}, ${evidence.exif_hash ?? null},
        ${evidence.verification_status}, ${evidence.confidence_score}, ${textArray(evidence.reviewers)},
        ${textArray(evidence.validationIssues)}, ${asDate(evidence.createdAt)}, ${evidence.evidenceHash},
        ${evidence.evidenceRoot}, ${auditEvent.eventRoot}, ${jsonValue(evidence.audit_history)},
        ${jsonValue(evidence.claimBoundary)}
      )
    `));
  }

  private async insertProjectRegistration(
    transaction: TrustTransaction,
    project: CanopyProofProjectProfile,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.projects (
        id, organization_id, region_id, title, project_type, status,
        location, area_hectares, target_tree_count, biodiversity_indicators,
        water_indicators, climate_risk_indicators, monitoring_cadence_days,
        governance_policy_id, governance_approval_id, created_by, created_by_role,
        created_at, updated_at, project_hash, project_root, audit_event_root,
        audit_history, claim_boundary
      ) VALUES (
        ${project.id}, ${project.organizationId}, ${project.regionId}, ${project.title}, ${project.projectType}, ${project.status},
        ${jsonValue(project.location)}, ${project.location.areaHectares}, ${project.targetTreeCount},
        ${textArray(project.biodiversityIndicators)}, ${textArray(project.waterIndicators)},
        ${textArray(project.climateRiskIndicators)}, ${project.monitoringCadenceDays},
        ${project.governancePolicyId ?? null}, ${project.governanceApprovalId ?? null}, ${project.createdBy}, ${project.createdByRole},
        ${asDate(project.createdAt)}, ${asDate(project.updatedAt)}, ${project.projectHash}, ${project.projectRoot},
        ${requireLastAuditEvent(project.auditHistory).eventRoot}, ${jsonValue(project.auditHistory)}, ${jsonValue(project.claimBoundary)}
      )
    `));
  }

  private async insertProjectStatusTransition(
    transaction: TrustTransaction,
    transition: CanopyProofProjectStatusTransition,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.project_status_transitions (
        id, project_id, organization_id, previous_status, status,
        previous_project_root, governance_approval_id, rationale,
        updated_by, updater_role, updated_at, transition_hash,
        transition_root, audit_event_root
      ) VALUES (
        ${transition.id}, ${transition.projectId}, ${transition.organizationId}, ${transition.previousStatus}, ${transition.status},
        ${transition.previousProjectRoot}, ${transition.governanceApprovalId ?? null}, ${transition.rationale},
        ${transition.updatedBy}, ${transition.updaterRole}, ${asDate(transition.updatedAt)}, ${transition.transitionHash},
        ${transition.transitionRoot}, ${transition.auditEvent.eventRoot}
      )
    `));
  }

  private async insertProjectMonitoringEvent(
    transaction: TrustTransaction,
    monitoring: CanopyProofProjectMonitoringEvent,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.monitoring_events (
        id, project_id, organization_id, event_type, observed_at, observed_by,
        observer_role, previous_status, project_status, previous_project_root,
        evidence_ids, terra_scene_ids, biodiversity_indicators, water_indicators,
        climate_risk_indicators, metrics, state, rationale, event_hash,
        monitoring_root, audit_event_root
      ) VALUES (
        ${monitoring.id}, ${monitoring.projectId}, ${monitoring.organizationId}, ${monitoring.eventType},
        ${asDate(monitoring.observedAt)}, ${monitoring.observedBy}, ${monitoring.observerRole},
        ${monitoring.previousStatus}, ${monitoring.projectStatus}, ${monitoring.previousProjectRoot},
        ${textArray(monitoring.evidenceIds)}, ${textArray(monitoring.terraSceneIds)},
        ${textArray(monitoring.biodiversityIndicators)}, ${textArray(monitoring.waterIndicators)},
        ${textArray(monitoring.climateRiskIndicators)}, ${jsonValue(monitoring.metrics)}, ${monitoring.state},
        ${monitoring.rationale}, ${monitoring.eventHash}, ${monitoring.monitoringRoot}, ${monitoring.auditEvent.eventRoot}
      )
    `));
  }

  private async loadParticipant(transaction: TrustTransaction, participantId: string, lock = false) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`SELECT * FROM identity.participants WHERE id = ${participantId} FOR UPDATE`)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`SELECT * FROM identity.participants WHERE id = ${participantId}`);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const parsed = participantRowSchema.safeParse(rows[0]);
    if (!parsed.success || !parsed.data.owner_id || !parsed.data.subject_hash) throw unavailable();
    const auditHistory = await this.loadAuditHistory(transaction, participantId);
    return {
      id: parsed.data.id,
      participantType: parsed.data.participant_type,
      displayName: parsed.data.display_name,
      ownerId: parsed.data.owner_id,
      ...(parsed.data.organization_id ? { organizationId: parsed.data.organization_id } : {}),
      roles: parsed.data.roles,
      verificationStatus: parsed.data.verification_status,
      reputationScore: parsed.data.reputation_score,
      credentialCommitments: parsed.data.credential_commitments,
      ...(parsed.data.public_key_hash ? { publicKeyHash: parsed.data.public_key_hash } : {}),
      createdAt: parsed.data.created_at.toISOString(),
      updatedAt: parsed.data.updated_at.toISOString(),
      subjectHash: parsed.data.subject_hash,
      auditHistory,
    } satisfies CanopyProofIdentityParticipant;
  }

  private async requireParticipant(transaction: TrustTransaction, participantId: string, lock = false) {
    const participant = await this.loadParticipant(transaction, participantId, lock);
    if (!participant) throw new Error(`CanopyProof identity participant not found: ${participantId}`);
    return participant;
  }

  private async loadReputationSnapshots(
    transaction: TrustTransaction,
    participantId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM identity.reputation_snapshots
      WHERE participant_id = ${participantId}
      ORDER BY recorded_at DESC, id ASC
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = reputationRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "identity_reputation_snapshot") throw unavailable();
      return {
        id: parsed.data.id,
        participantId: parsed.data.participant_id,
        previousScore: parsed.data.previous_score,
        newScore: parsed.data.new_score,
        source: parsed.data.source,
        reason: parsed.data.reason,
        recordedBy: parsed.data.recorded_by,
        recordedAt: parsed.data.recorded_at.toISOString(),
        snapshotHash: parsed.data.snapshot_hash,
        auditEvent,
      } satisfies CanopyProofIdentityReputationSnapshot;
    });
  }

  private async requireReputationSnapshot(transaction: TrustTransaction, snapshotId: string) {
    const rows = await transaction.$queryRaw<Array<{ participant_id: string }>>(Prisma.sql`
      SELECT participant_id FROM identity.reputation_snapshots WHERE id = ${snapshotId}
    `);
    const participantId = rows[0]?.participant_id;
    if (!participantId) throw new Error(`CanopyProof identity reputation snapshot not found: ${snapshotId}`);
    const participant = await this.requireParticipant(transaction, participantId);
    const snapshots = await this.loadReputationSnapshots(transaction, participantId, participant.auditHistory);
    const snapshot = snapshots.find((entry) => entry.id === snapshotId);
    if (!snapshot) throw unavailable();
    return snapshot;
  }

  private async loadOrganization(transaction: TrustTransaction, organizationId: string, lock = false) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`SELECT * FROM organizations.organizations WHERE id = ${organizationId} FOR UPDATE`)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`SELECT * FROM organizations.organizations WHERE id = ${organizationId}`);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable();
    const parsed = organizationRowSchema.safeParse(rows[0]);
    if (!parsed.success || !parsed.data.name || !parsed.data.public_contact || !parsed.data.profile_hash) throw unavailable();
    const documentRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, document_type, document_hash, issued_by, uploaded_at
      FROM organizations.verification_documents
      WHERE organization_id = ${organizationId}
      ORDER BY id
    `);
    const documents = documentRows.map((row) => mapDocument(row));
    const authorizedUsers = authorizedUsersSchema.safeParse(parsed.data.authorized_users);
    if (!authorizedUsers.success) throw unavailable();
    const auditHistory = await this.loadAuditHistory(transaction, organizationId);
    return {
      id: parsed.data.id,
      name: parsed.data.name,
      legalName: parsed.data.legal_name,
      organizationType: parsed.data.organization_type,
      jurisdiction: parsed.data.jurisdiction,
      ...(parsed.data.registration_number ? { registrationNumber: parsed.data.registration_number } : {}),
      publicContact: parsed.data.public_contact,
      operatingRegions: parsed.data.operating_regions,
      verificationCapabilities: parsed.data.verification_capabilities,
      accreditationStatus: parsed.data.accreditation_status,
      verificationStatus: parsed.data.verification_status,
      documents,
      authorizedUsers: authorizedUsers.data,
      trustLevel: parsed.data.trust_level,
      dataSharingPolicy: parsed.data.data_sharing_policy,
      profileHash: parsed.data.profile_hash,
      createdAt: parsed.data.created_at.toISOString(),
      updatedAt: parsed.data.updated_at.toISOString(),
      auditHistory,
    } satisfies CanopyProofOrganizationProfile;
  }

  private async requireOrganization(transaction: TrustTransaction, organizationId: string, lock = false) {
    const organization = await this.loadOrganization(transaction, organizationId, lock);
    if (!organization) throw new Error(`CanopyProof organization not found: ${organizationId}`);
    return organization;
  }

  private async loadOrganizationAuthoritySnapshot(transaction: TrustTransaction, organizationId: string, lock = false) {
    const organization = await this.requireOrganization(transaction, organizationId, lock);
    const [memberships, accreditations] = await Promise.all([
      this.loadMemberships(transaction, organizationId, organization.auditHistory),
      this.loadAccreditations(transaction, organizationId, organization.auditHistory),
    ]);
    return { organizations: [organization], memberships, accreditations };
  }

  private async loadMemberships(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM organizations.memberships
      WHERE organization_id = ${organizationId}
      ORDER BY actor_id, role, id
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = membershipRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "membership") throw unavailable();
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        actorId: parsed.data.actor_id,
        role: parsed.data.role,
        status: parsed.data.status,
        conflictDisclosure: parsed.data.conflict_disclosure,
        grantedBy: parsed.data.granted_by,
        grantedAt: parsed.data.granted_at.toISOString(),
        auditEvent,
      } satisfies CanopyProofMembership;
    });
  }

  private async requireMembership(transaction: TrustTransaction, membershipId: string, lock = false) {
    const rows = lock
      ? await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
          SELECT organization_id FROM organizations.memberships WHERE id = ${membershipId} FOR UPDATE
        `)
      : await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
          SELECT organization_id FROM organizations.memberships WHERE id = ${membershipId}
        `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof membership not found: ${membershipId}`);
    const organization = await this.requireOrganization(transaction, organizationId);
    const memberships = await this.loadMemberships(transaction, organizationId, organization.auditHistory);
    const membership = memberships.find((entry) => entry.id === membershipId);
    if (!membership) throw unavailable();
    return membership;
  }

  private async loadAccreditations(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM organizations.accreditations
      WHERE organization_id = ${organizationId}
      ORDER BY decided_at DESC, id ASC
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = accreditationRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "accreditation") throw unavailable();
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        status: parsed.data.status,
        scope: parsed.data.scope,
        decidedBy: parsed.data.decided_by,
        decidedAt: parsed.data.decided_at.toISOString(),
        rationale: parsed.data.rationale,
        evidenceHash: parsed.data.evidence_hash,
        auditEvent,
      } satisfies CanopyProofAccreditation;
    });
  }

  private async requireAccreditation(transaction: TrustTransaction, accreditationId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id FROM organizations.accreditations WHERE id = ${accreditationId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof accreditation not found: ${accreditationId}`);
    const organization = await this.requireOrganization(transaction, organizationId);
    const accreditations = await this.loadAccreditations(transaction, organizationId, organization.auditHistory);
    const accreditation = accreditations.find((entry) => entry.id === accreditationId);
    if (!accreditation) throw unavailable();
    return accreditation;
  }

  private async loadDataSharingGovernanceSnapshot(transaction: TrustTransaction, organizationId: string, lock = false) {
    const organization = await this.requireOrganization(transaction, organizationId, lock);
    const [dataSharingAgreements, dataSharingAgreementRevocations, dataSharingAgreementSupersessions] = await Promise.all([
      this.loadDataSharingAgreements(transaction, organizationId, organization.auditHistory),
      this.loadDataSharingAgreementRevocations(transaction, organizationId, organization.auditHistory),
      this.loadDataSharingAgreementSupersessions(transaction, organizationId, organization.auditHistory),
    ]);
    return {
      organizations: [organization],
      memberships: [],
      accreditations: [],
      dataSharingAgreements,
      dataSharingAgreementRevocations,
      dataSharingAgreementSupersessions,
    };
  }

  private async loadDataAccessGovernanceSnapshot(transaction: TrustTransaction, organizationId: string, lock = false) {
    const agreementSnapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId, lock);
    const organization = agreementSnapshot.organizations[0];
    if (!organization) throw unavailable();
    const [
      dataAccessRequests,
      dataAccessRequestDecisions,
      dataAccessDeliveryReceipts,
      dataUseAttestations,
      dataUseEnforcementCases,
      dataAccessRestrictions,
      dataAccessAccountabilityPackets,
      dataAccessAccountabilityVerifications,
      dataAccessAccountabilityDisclosures,
      dataAccessAccountabilityDisclosureChallenges,
      dataAccessAccountabilityDisclosureResolutions,
      dataAccessAccountabilityDisclosureNotices,
    ] = await Promise.all([
      this.loadDataAccessRequests(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessRequestDecisions(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessDeliveryReceipts(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataUseAttestations(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataUseEnforcementCases(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessRestrictions(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessAccountabilityPackets(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessAccountabilityVerifications(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessAccountabilityDisclosures(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessAccountabilityDisclosureChallenges(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessAccountabilityDisclosureResolutions(transaction, organizationId, organization.auditHistory, lock),
      this.loadDataAccessAccountabilityDisclosureNotices(transaction, organizationId, organization.auditHistory, lock),
    ]);
    return {
      ...agreementSnapshot,
      dataAccessRequests,
      dataAccessRequestDecisions,
      dataAccessDeliveryReceipts,
      dataUseAttestations,
      dataUseEnforcementCases,
      dataAccessRestrictions,
      dataAccessAccountabilityPackets,
      dataAccessAccountabilityVerifications,
      dataAccessAccountabilityDisclosures,
      dataAccessAccountabilityDisclosureChallenges,
      dataAccessAccountabilityDisclosureResolutions,
      dataAccessAccountabilityDisclosureNotices,
    };
  }

  private async loadDataAccessRequests(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT *
          FROM organizations.data_access_requests
          WHERE organization_id = ${organizationId}
          ORDER BY requested_at ASC, id ASC
          FOR UPDATE
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT *
          FROM organizations.data_access_requests
          WHERE organization_id = ${organizationId}
          ORDER BY requested_at ASC, id ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessRequestRowSchema.safeParse(row);
      if (
        !parsed.success ||
        parsed.data.status !== "pending" ||
        parsed.data.decision_by !== null ||
        parsed.data.decided_at !== null ||
        parsed.data.decision_rationale !== null
      ) {
        throw unavailable();
      }
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_access_request" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        agreementId: parsed.data.agreement_id,
        datasetScopes: parsed.data.dataset_scopes,
        permittedUses: parsed.data.permitted_uses,
        privacyTier: parsed.data.privacy_tier,
        purpose: parsed.data.purpose,
        status: "pending",
        requestedBy: parsed.data.requested_by,
        requestedAt: parsed.data.requested_at.toISOString(),
        ...(parsed.data.expires_at ? { expiresAt: parsed.data.expires_at.toISOString() } : {}),
        requestHash: parsed.data.request_hash,
        accessRoot: parsed.data.access_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessRequest;
    });
  }

  private async loadDataAccessRequestDecisions(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT decision.*
          FROM organizations.data_access_request_decisions decision
          JOIN audit.domain_events event ON event.event_root = decision.audit_event_root
          WHERE decision.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF decision
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT decision.*
          FROM organizations.data_access_request_decisions decision
          JOIN audit.domain_events event ON event.event_root = decision.audit_event_root
          WHERE decision.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessRequestDecisionRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_request_decision" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        agreementId: parsed.data.agreement_id,
        previousStatus: parsed.data.previous_status,
        status: parsed.data.status,
        decisionBy: parsed.data.decision_by,
        decidedAt: parsed.data.decided_at.toISOString(),
        rationale: parsed.data.rationale,
        decisionHash: parsed.data.decision_hash,
        decisionRoot: parsed.data.decision_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessRequestDecision;
    });
  }

  private async loadDataAccessDeliveryReceipts(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT receipt.*
          FROM organizations.data_access_delivery_receipts receipt
          JOIN audit.domain_events event ON event.event_root = receipt.audit_event_root
          WHERE receipt.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF receipt
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT receipt.*
          FROM organizations.data_access_delivery_receipts receipt
          JOIN audit.domain_events event ON event.event_root = receipt.audit_event_root
          WHERE receipt.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessDeliveryReceiptRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_delivery_receipt" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        agreementId: parsed.data.agreement_id,
        manifestId: parsed.data.manifest_id,
        manifestRequesterOrganizationId: parsed.data.manifest_requester_organization_id,
        manifestHash: parsed.data.manifest_hash,
        manifestEntryRoot: parsed.data.manifest_entry_root,
        manifestClassification: parsed.data.manifest_classification,
        channel: parsed.data.channel,
        recipientActorId: parsed.data.recipient_actor_id,
        deliveredBy: parsed.data.delivered_by,
        deliveredAt: parsed.data.delivered_at.toISOString(),
        purpose: parsed.data.purpose,
        accessRoot: parsed.data.access_root,
        receiptHash: parsed.data.receipt_hash,
        deliveryRoot: parsed.data.delivery_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessDeliveryReceipt;
    });
  }

  private async loadDataUseAttestations(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT attestation.*
          FROM organizations.data_use_attestations attestation
          JOIN audit.domain_events event ON event.event_root = attestation.audit_event_root
          WHERE attestation.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF attestation
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT attestation.*
          FROM organizations.data_use_attestations attestation
          JOIN audit.domain_events event ON event.event_root = attestation.audit_event_root
          WHERE attestation.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataUseAttestationRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_use_attestation" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        deliveryId: parsed.data.delivery_id,
        manifestId: parsed.data.manifest_id,
        usageState: parsed.data.usage_state,
        useCase: parsed.data.use_case,
        outputHashes: parsed.data.output_hashes,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        limitations: parsed.data.limitations,
        attestedBy: parsed.data.attested_by,
        attestedAt: parsed.data.attested_at.toISOString(),
        attestationHash: parsed.data.attestation_hash,
        usageRoot: parsed.data.usage_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataUseAttestation;
    });
  }

  private async loadDataUseEnforcementCases(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT enforcement_case.*
          FROM organizations.data_use_enforcement_cases enforcement_case
          JOIN audit.domain_events event ON event.event_root = enforcement_case.audit_event_root
          WHERE enforcement_case.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF enforcement_case
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT enforcement_case.*
          FROM organizations.data_use_enforcement_cases enforcement_case
          JOIN audit.domain_events event ON event.event_root = enforcement_case.audit_event_root
          WHERE enforcement_case.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataUseEnforcementCaseRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_use_enforcement_case" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        deliveryId: parsed.data.delivery_id,
        attestationId: parsed.data.attestation_id,
        manifestId: parsed.data.manifest_id,
        caseState: parsed.data.case_state,
        enforcementAction: parsed.data.enforcement_action,
        rationale: parsed.data.rationale,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        reviewerId: parsed.data.reviewer_id,
        reviewedAt: parsed.data.reviewed_at.toISOString(),
        enforcementHash: parsed.data.enforcement_hash,
        enforcementRoot: parsed.data.enforcement_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataUseEnforcementCase;
    });
  }

  private async loadDataAccessRestrictions(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT restriction.*
          FROM organizations.data_access_restrictions restriction
          JOIN audit.domain_events event ON event.event_root = restriction.audit_event_root
          WHERE restriction.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF restriction
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT restriction.*
          FROM organizations.data_access_restrictions restriction
          JOIN audit.domain_events event ON event.event_root = restriction.audit_event_root
          WHERE restriction.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessRestrictionRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_access_restriction" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        enforcementCaseId: parsed.data.enforcement_case_id,
        attestationId: parsed.data.attestation_id,
        deliveryId: parsed.data.delivery_id,
        ...(parsed.data.previous_restriction_id
          ? {
              previousRestrictionId: parsed.data.previous_restriction_id,
              previousRestrictionRoot: parsed.data.previous_restriction_root!,
              previousRestrictionState: parsed.data.previous_restriction_state!,
            }
          : {}),
        restrictionState: parsed.data.restriction_state,
        rationale: parsed.data.rationale,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        decidedBy: parsed.data.decided_by,
        decidedAt: parsed.data.decided_at.toISOString(),
        ...(parsed.data.expires_at ? { expiresAt: parsed.data.expires_at.toISOString() } : {}),
        restrictionHash: parsed.data.restriction_hash,
        restrictionRoot: parsed.data.restriction_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessRestriction;
    });
  }

  private async loadDataAccessAccountabilityPackets(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT packet.*
          FROM organizations.data_access_accountability_packets packet
          JOIN audit.domain_events event ON event.event_root = packet.audit_event_root
          WHERE packet.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF packet
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT packet.*
          FROM organizations.data_access_accountability_packets packet
          JOIN audit.domain_events event ON event.event_root = packet.audit_event_root
          WHERE packet.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessAccountabilityPacketRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_accountability_packet" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        agreementId: parsed.data.agreement_id,
        generatedBy: parsed.data.generated_by,
        generatedAt: parsed.data.generated_at.toISOString(),
        intendedAudience: parsed.data.intended_audience,
        requestStatus: parsed.data.request_status,
        counts: parsed.data.counts,
        lineageRoots: parsed.data.lineage_roots,
        packetHash: parsed.data.packet_hash,
        packetRoot: parsed.data.packet_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessAccountabilityPacket;
    });
  }

  private async loadDataAccessAccountabilityVerifications(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT verification.*
          FROM organizations.data_access_accountability_verifications verification
          JOIN audit.domain_events event ON event.event_root = verification.audit_event_root
          WHERE verification.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF verification
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT verification.*
          FROM organizations.data_access_accountability_verifications verification
          JOIN audit.domain_events event ON event.event_root = verification.audit_event_root
          WHERE verification.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessAccountabilityVerificationRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_accountability_verification" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        packetId: parsed.data.packet_id,
        organizationId: parsed.data.organization_id,
        requestId: parsed.data.request_id,
        valid: parsed.data.valid,
        issues: parsed.data.issues,
        ...(parsed.data.expected_packet_root ? { expectedPacketRoot: parsed.data.expected_packet_root } : {}),
        packetHash: parsed.data.packet_hash,
        recomputedPacketHash: parsed.data.recomputed_packet_hash,
        packetRoot: parsed.data.packet_root,
        recomputedPacketRoot: parsed.data.recomputed_packet_root,
        verifiedBy: parsed.data.verified_by,
        verifiedAt: parsed.data.verified_at.toISOString(),
        verificationRoot: parsed.data.verification_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessAccountabilityVerification;
    });
  }

  private async loadDataAccessAccountabilityDisclosures(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT disclosure.*
          FROM organizations.data_access_accountability_disclosures disclosure
          JOIN audit.domain_events event ON event.event_root = disclosure.audit_event_root
          WHERE disclosure.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF disclosure
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT disclosure.*
          FROM organizations.data_access_accountability_disclosures disclosure
          JOIN audit.domain_events event ON event.event_root = disclosure.audit_event_root
          WHERE disclosure.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessAccountabilityDisclosureRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_accountability_disclosure" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        packetId: parsed.data.packet_id,
        packetHash: parsed.data.packet_hash,
        packetRoot: parsed.data.packet_root,
        verificationId: parsed.data.verification_id,
        verificationRoot: parsed.data.verification_root,
        policyId: parsed.data.policy_id,
        publishedBy: parsed.data.published_by,
        publishedAt: parsed.data.published_at.toISOString(),
        disclosureHash: parsed.data.disclosure_hash,
        disclosureRoot: parsed.data.disclosure_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessAccountabilityDisclosure;
    });
  }

  private async loadDataAccessAccountabilityDisclosureChallenges(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT challenge.*
          FROM organizations.data_access_accountability_disclosure_challenges challenge
          JOIN audit.domain_events event ON event.event_root = challenge.audit_event_root
          WHERE challenge.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF challenge
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT challenge.*
          FROM organizations.data_access_accountability_disclosure_challenges challenge
          JOIN audit.domain_events event ON event.event_root = challenge.audit_event_root
          WHERE challenge.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessAccountabilityDisclosureChallengeRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_accountability_disclosure_challenge" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        disclosureId: parsed.data.disclosure_id,
        disclosureRoot: parsed.data.disclosure_root,
        reason: parsed.data.reason,
        statement: parsed.data.statement,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        challengedBy: parsed.data.challenged_by,
        challengerRole: parsed.data.challenger_role,
        challengedAt: parsed.data.challenged_at.toISOString(),
        challengeHash: parsed.data.challenge_hash,
        challengeRoot: parsed.data.challenge_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessAccountabilityDisclosureChallenge;
    });
  }

  private async loadDataAccessAccountabilityDisclosureResolutions(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT resolution.*
          FROM organizations.data_access_accountability_disclosure_resolutions resolution
          JOIN audit.domain_events event ON event.event_root = resolution.audit_event_root
          WHERE resolution.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF resolution
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT resolution.*
          FROM organizations.data_access_accountability_disclosure_resolutions resolution
          JOIN audit.domain_events event ON event.event_root = resolution.audit_event_root
          WHERE resolution.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessAccountabilityDisclosureResolutionRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_accountability_disclosure_resolution" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        disclosureId: parsed.data.disclosure_id,
        challengeId: parsed.data.challenge_id,
        decision: parsed.data.decision,
        remedialAction: parsed.data.remedial_action,
        rationale: parsed.data.rationale,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        ...(parsed.data.previous_resolution_id && parsed.data.previous_resolution_root
          ? {
              previousResolutionId: parsed.data.previous_resolution_id,
              previousResolutionRoot: parsed.data.previous_resolution_root,
            }
          : {}),
        reviewedBy: parsed.data.reviewed_by,
        reviewerRole: parsed.data.reviewer_role,
        reviewedAt: parsed.data.reviewed_at.toISOString(),
        resolutionHash: parsed.data.resolution_hash,
        resolutionRoot: parsed.data.resolution_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessAccountabilityDisclosureResolution;
    });
  }

  private async loadDataAccessAccountabilityDisclosureNotices(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
    lock = false,
  ) {
    const rows = lock
      ? await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT notice.*
          FROM organizations.data_access_accountability_disclosure_notices notice
          JOIN audit.domain_events event ON event.event_root = notice.audit_event_root
          WHERE notice.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
          FOR UPDATE OF notice
        `)
      : await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT notice.*
          FROM organizations.data_access_accountability_disclosure_notices notice
          JOIN audit.domain_events event ON event.event_root = notice.audit_event_root
          WHERE notice.organization_id = ${organizationId}
          ORDER BY event.sequence_no ASC
        `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataAccessAccountabilityDisclosureNoticeRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (
        !auditEvent ||
        auditEvent.entityType !== "data_access_accountability_disclosure_notice" ||
        auditEvent.entityId !== parsed.data.id
      ) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        disclosureId: parsed.data.disclosure_id,
        challengeId: parsed.data.challenge_id,
        resolutionId: parsed.data.resolution_id,
        noticeType: parsed.data.notice_type,
        ...(parsed.data.replacement_disclosure_id
          ? { replacementDisclosureId: parsed.data.replacement_disclosure_id }
          : {}),
        statement: parsed.data.statement,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        publishedBy: parsed.data.published_by,
        publisherRole: parsed.data.publisher_role,
        publishedAt: parsed.data.published_at.toISOString(),
        noticeHash: parsed.data.notice_hash,
        noticeRoot: parsed.data.notice_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataAccessAccountabilityDisclosureNotice;
    });
  }

  private async loadAuditExportManifests(
    transaction: TrustTransaction,
    requesterOrganizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT *
      FROM audit.export_manifests
      WHERE requester_organization_id = ${requesterOrganizationId}
      ORDER BY created_at ASC, id ASC
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = auditExportManifestRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.event_root);
      if (!auditEvent || auditEvent.entityType !== "audit_export_manifest" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        manifestVersion: parsed.data.manifest_version,
        kind: parsed.data.manifest_kind,
        scope: parsed.data.scope,
        subjectId: parsed.data.subject_id,
        requesterOrganizationId: parsed.data.requester_organization_id,
        requestedBy: parsed.data.requested_by,
        purpose: parsed.data.purpose,
        classification: parsed.data.classification,
        entries: parsed.data.entries.map(
          (entry) =>
            ({
              id: entry.id,
              resourceType: entry.resourceType,
              resourceId: entry.resourceId,
              contentHash: entry.contentHash,
              ...(entry.eventRoot ? { eventRoot: entry.eventRoot } : {}),
              classification: entry.classification,
              redactionPolicy: entry.redactionPolicy,
              included: entry.included,
              reason: entry.reason,
            }) satisfies CanopyProofAuditExportEntry,
        ),
        entryRoot: parsed.data.entry_root,
        redactionRoot: parsed.data.redaction_root,
        sourceEventRoot: parsed.data.source_event_root,
        exportHash: parsed.data.export_hash,
        ...(parsed.data.expires_at ? { expiresAt: parsed.data.expires_at.toISOString() } : {}),
        createdAt: parsed.data.created_at.toISOString(),
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofAuditExportManifest;
    });
  }

  private async loadDataSharingAgreements(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT *
      FROM organizations.data_sharing_agreements
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC, id ASC
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataSharingAgreementRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_sharing_agreement" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        datasetScopes: parsed.data.dataset_scopes,
        privacyTier: parsed.data.privacy_tier,
        permittedUses: parsed.data.permitted_uses,
        revoked: parsed.data.revoked,
        superseded: false,
        ...(parsed.data.expires_at ? { expiresAt: parsed.data.expires_at.toISOString() } : {}),
        createdBy: parsed.data.created_by,
        createdAt: parsed.data.created_at.toISOString(),
        agreementHash: parsed.data.agreement_hash,
        auditEvent,
      } satisfies CanopyProofDataSharingAgreement;
    });
  }

  private async loadDataSharingAgreementRevocations(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT *
      FROM organizations.data_sharing_agreement_revocations
      WHERE organization_id = ${organizationId}
      ORDER BY revoked_at DESC, id ASC
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataSharingAgreementRevocationRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_sharing_agreement_revocation" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        agreementId: parsed.data.agreement_id,
        rationale: parsed.data.rationale,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        revokedBy: parsed.data.revoked_by,
        revokedAt: parsed.data.revoked_at.toISOString(),
        revocationHash: parsed.data.revocation_hash,
        revocationRoot: parsed.data.revocation_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataSharingAgreementRevocation;
    });
  }

  private async loadDataSharingAgreementSupersessions(
    transaction: TrustTransaction,
    organizationId: string,
    auditHistory: readonly CanopyProofAuditEvent[],
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT *
      FROM organizations.data_sharing_agreement_supersessions
      WHERE organization_id = ${organizationId}
      ORDER BY superseded_at DESC, id ASC
    `);
    const eventsByRoot = new Map(auditHistory.map((event) => [event.eventRoot, event]));
    return rows.map((row) => {
      const parsed = dataSharingAgreementSupersessionRowSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      const auditEvent = eventsByRoot.get(parsed.data.audit_event_root);
      if (!auditEvent || auditEvent.entityType !== "data_sharing_agreement_supersession" || auditEvent.entityId !== parsed.data.id) {
        throw unavailable();
      }
      return {
        id: parsed.data.id,
        organizationId: parsed.data.organization_id,
        predecessorAgreementId: parsed.data.predecessor_agreement_id,
        predecessorAgreementHash: parsed.data.predecessor_agreement_hash,
        successorAgreementId: parsed.data.successor_agreement_id,
        successorAgreementHash: parsed.data.successor_agreement_hash,
        transitionType: parsed.data.transition_type,
        rationale: parsed.data.rationale,
        evidenceEventRoots: parsed.data.evidence_event_roots,
        supersededBy: parsed.data.superseded_by,
        supersededAt: parsed.data.superseded_at.toISOString(),
        supersessionHash: parsed.data.supersession_hash,
        supersessionRoot: parsed.data.supersession_root,
        safety: parsed.data.safety,
        auditEvent,
      } satisfies CanopyProofDataSharingAgreementSupersession;
    });
  }

  private async dataSharingAgreementOrganizationId(transaction: TrustTransaction, agreementId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_sharing_agreements
      WHERE id = ${agreementId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data-sharing agreement not found: ${agreementId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataSharingAgreement(transaction: TrustTransaction, agreementId: string) {
    const organizationId = await this.dataSharingAgreementOrganizationId(transaction, agreementId);
    const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId);
    const agreement = hydratePartnerAuthoritySnapshot(snapshot)
      .listDataSharingAgreements(organizationId)
      .find((entry) => entry.id === agreementId);
    if (!agreement) throw unavailable();
    return agreement;
  }

  private async requireDataSharingAgreementRevocation(transaction: TrustTransaction, revocationId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_sharing_agreement_revocations
      WHERE id = ${revocationId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data-sharing agreement revocation not found: ${revocationId}`);
    if (rows.length !== 1) throw unavailable();
    const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataSharingAgreementRevocation(revocationId);
  }

  private async requireDataSharingAgreementSupersession(transaction: TrustTransaction, supersessionId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_sharing_agreement_supersessions
      WHERE id = ${supersessionId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data-sharing agreement supersession not found: ${supersessionId}`);
    if (rows.length !== 1) throw unavailable();
    const snapshot = await this.loadDataSharingGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataSharingAgreementSupersession(supersessionId);
  }

  private async dataAccessRequestOrganizationId(transaction: TrustTransaction, requestId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_requests
      WHERE id = ${requestId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data access request not found: ${requestId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessRequest(transaction: TrustTransaction, requestId: string) {
    const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessRequest(requestId);
  }

  private async requireDataAccessRequestAtCreation(transaction: TrustTransaction, requestId: string) {
    const organizationId = await this.dataAccessRequestOrganizationId(transaction, requestId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    const organization = snapshot.organizations[0];
    const request = snapshot.dataAccessRequests?.find((entry) => entry.id === requestId);
    if (!organization || !request) throw unavailable();
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    const creationOrder = eventOrder.get(request.auditEvent.eventRoot);
    if (creationOrder === undefined) throw unavailable();
    const decisionsAtCreation = (snapshot.dataAccessRequestDecisions ?? []).filter((decision) => {
      const order = eventOrder.get(decision.auditEvent.eventRoot);
      if (order === undefined) throw unavailable();
      return order <= creationOrder;
    });
    return hydratePartnerAuthoritySnapshot({
      ...snapshot,
      dataAccessRequestDecisions: decisionsAtCreation,
      dataAccessDeliveryReceipts: [],
      dataUseAttestations: [],
      dataUseEnforcementCases: [],
      dataAccessRestrictions: [],
    }).getDataAccessRequest(requestId);
  }

  private async requireDataAccessRequestAtDecision(transaction: TrustTransaction, decisionId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string; request_id: string; audit_event_root: string }>>(Prisma.sql`
      SELECT organization_id, request_id, audit_event_root
      FROM organizations.data_access_request_decisions
      WHERE id = ${decisionId}
    `);
    const decisionRow = rows[0];
    if (!decisionRow) throw new Error(`CanopyProof data access request decision not found: ${decisionId}`);
    if (rows.length !== 1) throw unavailable();
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, decisionRow.organization_id);
    const organization = snapshot.organizations[0];
    if (!organization) throw unavailable();
    const eventOrder = new Map(organization.auditHistory.map((event, index) => [event.eventRoot, index]));
    const targetOrder = eventOrder.get(decisionRow.audit_event_root);
    if (targetOrder === undefined) throw unavailable();
    const projectedDecisions = (snapshot.dataAccessRequestDecisions ?? []).filter((decision) => {
      const order = eventOrder.get(decision.auditEvent.eventRoot);
      if (order === undefined) throw unavailable();
      return order <= targetOrder;
    });
    const projected = hydratePartnerAuthoritySnapshot({
      ...snapshot,
      dataAccessRequestDecisions: projectedDecisions,
      dataAccessDeliveryReceipts: [],
      dataUseAttestations: [],
      dataUseEnforcementCases: [],
      dataAccessRestrictions: [],
    }).getDataAccessRequest(decisionRow.request_id);
    if (projected.decisionAuditEvent?.eventRoot !== decisionRow.audit_event_root) throw unavailable();
    return projected;
  }

  private async insertDataAccessRequest(transaction: TrustTransaction, request: CanopyProofDataAccessRequest) {
    if (
      request.status !== "pending" ||
      request.decisionBy ||
      request.decidedAt ||
      request.decisionRationale ||
      request.decisionAuditEvent
    ) {
      throw unavailable();
    }
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_requests (
        id, organization_id, agreement_id, dataset_scopes, permitted_uses,
        privacy_tier, purpose, status, requested_by, requested_at,
        decision_by, decided_at, decision_rationale, expires_at, request_hash,
        access_root, safety, audit_event_root
      ) VALUES (
        ${request.id}, ${request.organizationId}, ${request.agreementId}, ${textArray(request.datasetScopes)},
        ${textArray(request.permittedUses)}, ${request.privacyTier}, ${request.purpose}, 'pending',
        ${request.requestedBy}, ${asDate(request.requestedAt)}, NULL, NULL, NULL,
        ${request.expiresAt ? asDate(request.expiresAt) : null}, ${request.requestHash},
        ${request.accessRoot}, ${jsonValue(request.safety)}, ${request.auditEvent.eventRoot}
      )
    `));
  }

  private async insertDataAccessRequestDecision(
    transaction: TrustTransaction,
    decision: CanopyProofDataAccessRequestDecision,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_request_decisions (
        id, organization_id, request_id, agreement_id, previous_status, status,
        decision_by, decided_at, rationale, decision_hash, decision_root,
        safety, audit_event_root
      ) VALUES (
        ${decision.id}, ${decision.organizationId}, ${decision.requestId}, ${decision.agreementId},
        ${decision.previousStatus}, ${decision.status}, ${decision.decisionBy}, ${asDate(decision.decidedAt)},
        ${decision.rationale}, ${decision.decisionHash}, ${decision.decisionRoot},
        ${jsonValue(decision.safety)}, ${decision.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessDeliveryOrganizationId(transaction: TrustTransaction, deliveryId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_delivery_receipts
      WHERE id = ${deliveryId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data access delivery receipt not found: ${deliveryId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessDeliveryReceipt(transaction: TrustTransaction, deliveryId: string) {
    const organizationId = await this.dataAccessDeliveryOrganizationId(transaction, deliveryId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessDeliveryReceipt(deliveryId);
  }

  private async insertDataAccessDeliveryReceipt(
    transaction: TrustTransaction,
    receipt: CanopyProofDataAccessDeliveryReceipt,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_delivery_receipts (
        id, organization_id, request_id, agreement_id, manifest_id,
        manifest_requester_organization_id, manifest_hash, manifest_entry_root,
        manifest_classification, channel, recipient_actor_id, delivered_by,
        delivered_at, purpose, access_root, receipt_hash, delivery_root,
        safety, audit_event_root
      ) VALUES (
        ${receipt.id}, ${receipt.organizationId}, ${receipt.requestId}, ${receipt.agreementId},
        ${receipt.manifestId}, ${receipt.manifestRequesterOrganizationId}, ${receipt.manifestHash},
        ${receipt.manifestEntryRoot}, ${receipt.manifestClassification}, ${receipt.channel},
        ${receipt.recipientActorId}, ${receipt.deliveredBy}, ${asDate(receipt.deliveredAt)},
        ${receipt.purpose}, ${receipt.accessRoot}, ${receipt.receiptHash}, ${receipt.deliveryRoot},
        ${jsonValue(receipt.safety)}, ${receipt.auditEvent.eventRoot}
      )
    `));
  }

  private async dataUseAttestationOrganizationId(transaction: TrustTransaction, attestationId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_use_attestations
      WHERE id = ${attestationId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data-use attestation not found: ${attestationId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataUseAttestation(transaction: TrustTransaction, attestationId: string) {
    const organizationId = await this.dataUseAttestationOrganizationId(transaction, attestationId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataUseAttestation(attestationId);
  }

  private async insertDataUseAttestation(
    transaction: TrustTransaction,
    attestation: CanopyProofDataUseAttestation,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_use_attestations (
        id, organization_id, request_id, delivery_id, manifest_id,
        usage_state, use_case, output_hashes, evidence_event_roots,
        limitations, attested_by, attested_at, attestation_hash,
        usage_root, safety, audit_event_root
      ) VALUES (
        ${attestation.id}, ${attestation.organizationId}, ${attestation.requestId},
        ${attestation.deliveryId}, ${attestation.manifestId}, ${attestation.usageState},
        ${attestation.useCase}, ${textArray(attestation.outputHashes)},
        ${textArray(attestation.evidenceEventRoots)}, ${textArray(attestation.limitations)},
        ${attestation.attestedBy}, ${asDate(attestation.attestedAt)},
        ${attestation.attestationHash}, ${attestation.usageRoot},
        ${jsonValue(attestation.safety)}, ${attestation.auditEvent.eventRoot}
      )
    `));
  }

  private async dataUseEnforcementCaseOrganizationId(transaction: TrustTransaction, caseId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_use_enforcement_cases
      WHERE id = ${caseId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data-use enforcement case not found: ${caseId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataUseEnforcementCase(transaction: TrustTransaction, caseId: string) {
    const organizationId = await this.dataUseEnforcementCaseOrganizationId(transaction, caseId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataUseEnforcementCase(caseId);
  }

  private async insertDataUseEnforcementCase(
    transaction: TrustTransaction,
    enforcementCase: CanopyProofDataUseEnforcementCase,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_use_enforcement_cases (
        id, organization_id, request_id, delivery_id, attestation_id,
        manifest_id, case_state, enforcement_action, rationale,
        evidence_event_roots, reviewer_id, reviewed_at, enforcement_hash,
        enforcement_root, safety, audit_event_root
      ) VALUES (
        ${enforcementCase.id}, ${enforcementCase.organizationId}, ${enforcementCase.requestId},
        ${enforcementCase.deliveryId}, ${enforcementCase.attestationId}, ${enforcementCase.manifestId},
        ${enforcementCase.caseState}, ${enforcementCase.enforcementAction}, ${enforcementCase.rationale},
        ${textArray(enforcementCase.evidenceEventRoots)}, ${enforcementCase.reviewerId},
        ${asDate(enforcementCase.reviewedAt)}, ${enforcementCase.enforcementHash},
        ${enforcementCase.enforcementRoot}, ${jsonValue(enforcementCase.safety)},
        ${enforcementCase.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessRestrictionOrganizationId(transaction: TrustTransaction, restrictionId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_restrictions
      WHERE id = ${restrictionId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data access restriction not found: ${restrictionId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessRestriction(transaction: TrustTransaction, restrictionId: string) {
    const organizationId = await this.dataAccessRestrictionOrganizationId(transaction, restrictionId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessRestriction(restrictionId);
  }

  private async insertDataAccessRestriction(
    transaction: TrustTransaction,
    restriction: CanopyProofDataAccessRestriction,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_restrictions (
        id, organization_id, request_id, enforcement_case_id,
        attestation_id, delivery_id, previous_restriction_id,
        previous_restriction_root, previous_restriction_state,
        restriction_state, rationale, evidence_event_roots, decided_by,
        decided_at, expires_at, restriction_hash, restriction_root,
        safety, audit_event_root
      ) VALUES (
        ${restriction.id}, ${restriction.organizationId}, ${restriction.requestId},
        ${restriction.enforcementCaseId}, ${restriction.attestationId}, ${restriction.deliveryId},
        ${restriction.previousRestrictionId ?? null}, ${restriction.previousRestrictionRoot ?? null},
        ${restriction.previousRestrictionState ?? null}, ${restriction.restrictionState},
        ${restriction.rationale}, ${textArray(restriction.evidenceEventRoots)},
        ${restriction.decidedBy}, ${asDate(restriction.decidedAt)},
        ${restriction.expiresAt ? asDate(restriction.expiresAt) : null},
        ${restriction.restrictionHash}, ${restriction.restrictionRoot},
        ${jsonValue(restriction.safety)}, ${restriction.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessAccountabilityPacketOrganizationId(transaction: TrustTransaction, packetId: string) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_accountability_packets
      WHERE id = ${packetId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) throw new Error(`CanopyProof data access accountability packet not found: ${packetId}`);
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessAccountabilityPacket(transaction: TrustTransaction, packetId: string) {
    const organizationId = await this.dataAccessAccountabilityPacketOrganizationId(transaction, packetId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessAccountabilityPacket(packetId);
  }

  private async insertDataAccessAccountabilityPacket(
    transaction: TrustTransaction,
    packet: CanopyProofDataAccessAccountabilityPacket,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_accountability_packets (
        id, organization_id, request_id, agreement_id, generated_by,
        generated_at, intended_audience, request_status, counts,
        lineage_roots, packet_hash, packet_root, safety, audit_event_root
      ) VALUES (
        ${packet.id}, ${packet.organizationId}, ${packet.requestId}, ${packet.agreementId},
        ${packet.generatedBy}, ${asDate(packet.generatedAt)}, ${packet.intendedAudience},
        ${packet.requestStatus}, ${jsonValue(packet.counts)}, ${jsonValue(packet.lineageRoots)},
        ${packet.packetHash}, ${packet.packetRoot}, ${jsonValue(packet.safety)},
        ${packet.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessAccountabilityVerificationOrganizationId(
    transaction: TrustTransaction,
    verificationId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_accountability_verifications
      WHERE id = ${verificationId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) {
      throw new Error(`CanopyProof data access accountability verification not found: ${verificationId}`);
    }
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessAccountabilityVerification(transaction: TrustTransaction, verificationId: string) {
    const organizationId = await this.dataAccessAccountabilityVerificationOrganizationId(transaction, verificationId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessAccountabilityVerification(verificationId);
  }

  private async insertDataAccessAccountabilityVerification(
    transaction: TrustTransaction,
    verification: CanopyProofDataAccessAccountabilityVerification,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_accountability_verifications (
        id, packet_id, organization_id, request_id, valid, issues,
        expected_packet_root, packet_hash, recomputed_packet_hash,
        packet_root, recomputed_packet_root, verified_by, verified_at,
        verification_root, safety, audit_event_root
      ) VALUES (
        ${verification.id}, ${verification.packetId}, ${verification.organizationId},
        ${verification.requestId}, ${verification.valid}, ${textArray(verification.issues)},
        ${verification.expectedPacketRoot ?? null}, ${verification.packetHash},
        ${verification.recomputedPacketHash}, ${verification.packetRoot},
        ${verification.recomputedPacketRoot}, ${verification.verifiedBy},
        ${asDate(verification.verifiedAt)}, ${verification.verificationRoot},
        ${jsonValue(verification.safety)}, ${verification.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessAccountabilityDisclosureOrganizationId(
    transaction: TrustTransaction,
    disclosureId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_accountability_disclosures
      WHERE id = ${disclosureId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) {
      throw new Error(`CanopyProof data access accountability disclosure not found: ${disclosureId}`);
    }
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessAccountabilityDisclosure(
    transaction: TrustTransaction,
    disclosureId: string,
  ) {
    const organizationId = await this.dataAccessAccountabilityDisclosureOrganizationId(transaction, disclosureId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessAccountabilityDisclosure(disclosureId);
  }

  private async insertDataAccessAccountabilityDisclosure(
    transaction: TrustTransaction,
    disclosure: CanopyProofDataAccessAccountabilityDisclosure,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_accountability_disclosures (
        id, organization_id, packet_id, packet_hash, packet_root,
        verification_id, verification_root, policy_id, published_by,
        published_at, disclosure_hash, disclosure_root, safety,
        audit_event_root
      ) VALUES (
        ${disclosure.id}, ${disclosure.organizationId}, ${disclosure.packetId},
        ${disclosure.packetHash}, ${disclosure.packetRoot}, ${disclosure.verificationId},
        ${disclosure.verificationRoot}, ${disclosure.policyId}, ${disclosure.publishedBy},
        ${asDate(disclosure.publishedAt)}, ${disclosure.disclosureHash},
        ${disclosure.disclosureRoot}, ${jsonValue(disclosure.safety)},
        ${disclosure.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessAccountabilityDisclosureChallengeOrganizationId(
    transaction: TrustTransaction,
    challengeId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_accountability_disclosure_challenges
      WHERE id = ${challengeId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) {
      throw new Error(`CanopyProof data access accountability disclosure challenge not found: ${challengeId}`);
    }
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessAccountabilityDisclosureChallenge(
    transaction: TrustTransaction,
    challengeId: string,
  ) {
    const organizationId = await this.dataAccessAccountabilityDisclosureChallengeOrganizationId(transaction, challengeId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessAccountabilityDisclosureChallenge(challengeId);
  }

  private async insertDataAccessAccountabilityDisclosureChallenge(
    transaction: TrustTransaction,
    challenge: CanopyProofDataAccessAccountabilityDisclosureChallenge,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_accountability_disclosure_challenges (
        id, organization_id, disclosure_id, disclosure_root, reason,
        statement, evidence_event_roots, challenged_by, challenger_role,
        challenged_at, challenge_hash, challenge_root, safety,
        audit_event_root
      ) VALUES (
        ${challenge.id}, ${challenge.organizationId}, ${challenge.disclosureId},
        ${challenge.disclosureRoot}, ${challenge.reason}, ${challenge.statement},
        ${textArray(challenge.evidenceEventRoots)}, ${challenge.challengedBy},
        ${challenge.challengerRole}, ${asDate(challenge.challengedAt)},
        ${challenge.challengeHash}, ${challenge.challengeRoot},
        ${jsonValue(challenge.safety)}, ${challenge.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessAccountabilityDisclosureResolutionOrganizationId(
    transaction: TrustTransaction,
    resolutionId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_accountability_disclosure_resolutions
      WHERE id = ${resolutionId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) {
      throw new Error(`CanopyProof data access accountability disclosure resolution not found: ${resolutionId}`);
    }
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessAccountabilityDisclosureResolution(
    transaction: TrustTransaction,
    resolutionId: string,
  ) {
    const organizationId = await this.dataAccessAccountabilityDisclosureResolutionOrganizationId(transaction, resolutionId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessAccountabilityDisclosureResolution(resolutionId);
  }

  private async insertDataAccessAccountabilityDisclosureResolution(
    transaction: TrustTransaction,
    resolution: CanopyProofDataAccessAccountabilityDisclosureResolution,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_accountability_disclosure_resolutions (
        id, organization_id, disclosure_id, challenge_id, decision,
        remedial_action, rationale, evidence_event_roots, previous_resolution_id,
        previous_resolution_root, reviewed_by, reviewer_role, reviewed_at,
        resolution_hash, resolution_root, safety, audit_event_root
      ) VALUES (
        ${resolution.id}, ${resolution.organizationId}, ${resolution.disclosureId},
        ${resolution.challengeId}, ${resolution.decision}, ${resolution.remedialAction},
        ${resolution.rationale}, ${textArray(resolution.evidenceEventRoots)},
        ${resolution.previousResolutionId ?? null}, ${resolution.previousResolutionRoot ?? null},
        ${resolution.reviewedBy}, ${resolution.reviewerRole}, ${asDate(resolution.reviewedAt)},
        ${resolution.resolutionHash}, ${resolution.resolutionRoot},
        ${jsonValue(resolution.safety)}, ${resolution.auditEvent.eventRoot}
      )
    `));
  }

  private async dataAccessAccountabilityDisclosureNoticeOrganizationId(
    transaction: TrustTransaction,
    noticeId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ organization_id: string }>>(Prisma.sql`
      SELECT organization_id
      FROM organizations.data_access_accountability_disclosure_notices
      WHERE id = ${noticeId}
    `);
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) {
      throw new Error(`CanopyProof data access accountability disclosure notice not found: ${noticeId}`);
    }
    if (rows.length !== 1) throw unavailable();
    return organizationId;
  }

  private async requireDataAccessAccountabilityDisclosureNotice(
    transaction: TrustTransaction,
    noticeId: string,
  ) {
    const organizationId = await this.dataAccessAccountabilityDisclosureNoticeOrganizationId(transaction, noticeId);
    const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
    return hydratePartnerAuthoritySnapshot(snapshot).getDataAccessAccountabilityDisclosureNotice(noticeId);
  }

  private async insertDataAccessAccountabilityDisclosureNotice(
    transaction: TrustTransaction,
    notice: CanopyProofDataAccessAccountabilityDisclosureNotice,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_access_accountability_disclosure_notices (
        id, organization_id, disclosure_id, challenge_id, resolution_id,
        notice_type, replacement_disclosure_id, statement, evidence_event_roots,
        published_by, publisher_role, published_at, notice_hash, notice_root,
        safety, audit_event_root
      ) VALUES (
        ${notice.id}, ${notice.organizationId}, ${notice.disclosureId},
        ${notice.challengeId}, ${notice.resolutionId}, ${notice.noticeType},
        ${notice.replacementDisclosureId ?? null}, ${notice.statement},
        ${textArray(notice.evidenceEventRoots)}, ${notice.publishedBy},
        ${notice.publisherRole}, ${asDate(notice.publishedAt)}, ${notice.noticeHash},
        ${notice.noticeRoot}, ${jsonValue(notice.safety)}, ${notice.auditEvent.eventRoot}
      )
    `));
  }

  private async publicDataAccessAccountabilityDisclosureCandidate(
    transaction: TrustTransaction,
    disclosureId: string,
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        disclosure.id,
        disclosure.organization_id,
        disclosure.published_at,
        CASE
          WHEN organizations.data_access_accountability_packet_is_current(
            disclosure.packet_id,
            (
              SELECT COALESCE(MAX(event.sequence_no), 0) + 1
              FROM audit.domain_events event
              WHERE event.stream_id = disclosure.organization_id
            )
          ) THEN 'current'
          ELSE 'stale'
        END AS current_state,
        organizations.data_access_accountability_disclosure_governance_state(disclosure.id) AS governance_state
      FROM organizations.data_access_accountability_disclosures disclosure
      WHERE disclosure.id = ${disclosureId}
    `);
    if (rows.length !== 1) {
      throw new Error(`CanopyProof public accountability disclosure cursor is invalid: ${disclosureId}`);
    }
    const parsed = publicDataAccessAccountabilityDisclosureCandidateSchema.safeParse(rows[0]);
    if (!parsed.success) throw unavailable();
    return parsed.data;
  }

  private async listPublicDataAccessAccountabilityDisclosureCandidates(
    transaction: TrustTransaction,
    input: Readonly<{
      organizationId?: string;
      currentState?: CanopyProofDataAccessAccountabilityDisclosureState;
      governanceState?: CanopyProofDataAccessAccountabilityDisclosureGovernanceState;
    }>,
    cursor: z.infer<typeof publicDataAccessAccountabilityDisclosureCandidateSchema> | undefined,
    limit: number,
  ) {
    const organizationFilter = input.organizationId
      ? Prisma.sql`AND candidate.organization_id = ${input.organizationId}`
      : Prisma.empty;
    const stateFilter = input.currentState
      ? Prisma.sql`AND candidate.current_state = ${input.currentState}`
      : Prisma.empty;
    const governanceFilter = input.governanceState
      ? Prisma.sql`AND candidate.governance_state = ${input.governanceState}`
      : Prisma.empty;
    const cursorFilter = cursor
      ? Prisma.sql`AND (
          candidate.published_at < ${cursor.published_at} OR
          (candidate.published_at = ${cursor.published_at} AND candidate.id > ${cursor.id})
        )`
      : Prisma.empty;
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      WITH candidates AS (
        SELECT
          disclosure.id,
          disclosure.organization_id,
          disclosure.published_at,
          CASE
            WHEN organizations.data_access_accountability_packet_is_current(
              disclosure.packet_id,
              (
                SELECT COALESCE(MAX(event.sequence_no), 0) + 1
                FROM audit.domain_events event
                WHERE event.stream_id = disclosure.organization_id
              )
            ) THEN 'current'
            ELSE 'stale'
          END AS current_state,
          organizations.data_access_accountability_disclosure_governance_state(disclosure.id) AS governance_state
        FROM organizations.data_access_accountability_disclosures disclosure
      )
      SELECT candidate.*
      FROM candidates candidate
      WHERE true
        ${organizationFilter}
        ${stateFilter}
        ${governanceFilter}
        ${cursorFilter}
      ORDER BY candidate.published_at DESC, candidate.id ASC
      LIMIT ${limit}
    `);
    return rows.map((row) => {
      const parsed = publicDataAccessAccountabilityDisclosureCandidateSchema.safeParse(row);
      if (!parsed.success) throw unavailable();
      return parsed.data;
    });
  }

  private async aggregatePublicDataAccessAccountabilityDisclosures(
    transaction: TrustTransaction,
    input: Readonly<{
      organizationId?: string;
      currentState?: CanopyProofDataAccessAccountabilityDisclosureState;
      governanceState?: CanopyProofDataAccessAccountabilityDisclosureGovernanceState;
    }>,
  ) {
    const organizationFilter = input.organizationId
      ? Prisma.sql`AND candidate.organization_id = ${input.organizationId}`
      : Prisma.empty;
    const stateFilter = input.currentState
      ? Prisma.sql`AND candidate.current_state = ${input.currentState}`
      : Prisma.empty;
    const governanceFilter = input.governanceState
      ? Prisma.sql`AND candidate.governance_state = ${input.governanceState}`
      : Prisma.empty;
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      WITH candidates AS (
        SELECT
          disclosure.organization_id,
          disclosure.disclosure_root,
          organizations.data_access_accountability_disclosure_open_challenge_count(disclosure.id) AS open_challenge_count,
          CASE
            WHEN organizations.data_access_accountability_packet_is_current(
              disclosure.packet_id,
              (
                SELECT COALESCE(MAX(event.sequence_no), 0) + 1
                FROM audit.domain_events event
                WHERE event.stream_id = disclosure.organization_id
              )
            ) THEN 'current'
            ELSE 'stale'
          END AS current_state,
          organizations.data_access_accountability_disclosure_governance_state(disclosure.id) AS governance_state
        FROM organizations.data_access_accountability_disclosures disclosure
      ), filtered AS (
        SELECT candidate.*
        FROM candidates candidate
        WHERE true
          ${organizationFilter}
          ${stateFilter}
          ${governanceFilter}
      )
      SELECT
        COUNT(*)::text AS total_count,
        COUNT(*) FILTER (WHERE current_state = 'current')::text AS current_count,
        COUNT(*) FILTER (WHERE current_state = 'stale')::text AS stale_count,
        COUNT(*) FILTER (WHERE governance_state <> 'unchallenged')::text AS challenged_disclosure_count,
        COALESCE(SUM(open_challenge_count), 0)::text AS open_challenge_count,
        COUNT(*) FILTER (WHERE governance_state = 'corrected')::text AS corrected_disclosure_count,
        COUNT(*) FILTER (WHERE governance_state = 'withdrawn')::text AS withdrawn_disclosure_count,
        audit.merkle_root(
          COALESCE(array_agg(disclosure_root ORDER BY disclosure_root), ARRAY[]::text[])
        ) AS disclosure_root
      FROM filtered
    `);
    if (rows.length !== 1) throw unavailable();
    const parsed = publicDataAccessAccountabilityDisclosureAggregateSchema.safeParse(rows[0]);
    if (!parsed.success) throw unavailable();
    return parsed.data;
  }

  private async loadPublicDataAccessAccountabilityDisclosureViews(
    transaction: TrustTransaction,
    candidates: readonly z.infer<typeof publicDataAccessAccountabilityDisclosureCandidateSchema>[],
  ) {
    const disclosureIdsByOrganization = new Map<string, string[]>();
    for (const candidate of candidates) {
      const disclosureIds = disclosureIdsByOrganization.get(candidate.organization_id) ?? [];
      disclosureIds.push(candidate.id);
      disclosureIdsByOrganization.set(candidate.organization_id, disclosureIds);
    }
    const views: CanopyProofDataAccessAccountabilityDisclosureView[] = [];
    for (const [organizationId, disclosureIds] of disclosureIdsByOrganization) {
      const snapshot = await this.loadDataAccessGovernanceSnapshot(transaction, organizationId);
      const domain = hydratePartnerAuthoritySnapshot(snapshot);
      for (const disclosureId of disclosureIds) {
        views.push(domain.getDataAccessAccountabilityDisclosure(disclosureId));
      }
    }
    return views;
  }

  private async requireAuditExportManifest(
    transaction: TrustTransaction,
    manifestId: string,
    requesterOrganizationId: string,
  ) {
    const matchingRows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM audit.export_manifests
      WHERE id = ${manifestId}
        AND requester_organization_id = ${requesterOrganizationId}
    `);
    if (matchingRows.length === 0) {
      throw new Error(`CanopyProof audit export manifest not found: ${manifestId}`);
    }
    if (matchingRows.length !== 1) throw unavailable();
    const organization = await this.requireOrganization(transaction, requesterOrganizationId);
    const manifests = await this.loadAuditExportManifests(
      transaction,
      requesterOrganizationId,
      organization.auditHistory,
    );
    const manifest = hydrateAuditExportManifestSnapshot(manifests)
      .listManifests({ requesterOrganizationId, includeSensitive: true })
      .find((entry) => entry.id === manifestId);
    if (!manifest) throw unavailable();
    return manifest;
  }

  private async insertAuditExportManifest(
    transaction: TrustTransaction,
    manifest: CanopyProofAuditExportManifest,
  ) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.export_manifests (
        id, manifest_version, manifest_kind, scope, subject_id,
        requester_organization_id, requested_by, purpose, classification,
        entries, entry_root, redaction_root, source_event_root, export_hash,
        safety, expires_at, created_at, event_root
      ) VALUES (
        ${manifest.id}, ${manifest.manifestVersion}, ${manifest.kind}, ${manifest.scope}, ${manifest.subjectId},
        ${manifest.requesterOrganizationId}, ${manifest.requestedBy}, ${manifest.purpose}, ${manifest.classification},
        ${jsonValue(manifest.entries)}, ${manifest.entryRoot}, ${manifest.redactionRoot}, ${manifest.sourceEventRoot},
        ${manifest.exportHash}, ${jsonValue(manifest.safety)},
        ${manifest.expiresAt ? asDate(manifest.expiresAt) : null}, ${asDate(manifest.createdAt)},
        ${manifest.auditEvent.eventRoot}
      )
    `));
  }

  private async insertDataSharingAgreement(transaction: TrustTransaction, agreement: CanopyProofDataSharingAgreement) {
    if (agreement.revoked || agreement.superseded) throw unavailable();
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.data_sharing_agreements (
        id, organization_id, dataset_scopes, privacy_tier, permitted_uses,
        revoked, expires_at, created_by, created_at, agreement_hash,
        audit_event_root
      ) VALUES (
        ${agreement.id}, ${agreement.organizationId}, ${textArray(agreement.datasetScopes)}, ${agreement.privacyTier},
        ${textArray(agreement.permittedUses)}, false, ${agreement.expiresAt ? asDate(agreement.expiresAt) : null},
        ${agreement.createdBy}, ${asDate(agreement.createdAt)}, ${agreement.agreementHash},
        ${agreement.auditEvent.eventRoot}
      )
    `));
  }

  private async updateOrganizationTimestamp(transaction: TrustTransaction, organizationId: string, timestamp: string) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      UPDATE organizations.organizations
      SET updated_at = ${asDate(timestamp)}
      WHERE id = ${organizationId}
    `));
  }

  private async loadAuditHistory(transaction: TrustTransaction, streamId: string): Promise<readonly CanopyProofAuditEvent[]> {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, action, actor_id, entity_type, entity_id, previous_root,
             payload_hash, event_root, created_at, rationale
      FROM audit.domain_events
      WHERE stream_id = ${streamId}
      ORDER BY sequence_no
    `);
    const events = rows.map((row) => mapAuditEvent(row));
    const terminalEvent = events.at(-1);
    if (terminalEvent && !verifyCanopyProofAuditChain(events, terminalEvent.createdAt).valid) throw unavailable();
    return events;
  }

  private async insertDomainEvent(transaction: TrustTransaction, streamId: string, event: CanopyProofAuditEvent) {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, ${streamId}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
        ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
      )
    `));
  }

  private async insertOrganizationDocuments(
    transaction: TrustTransaction,
    organization: CanopyProofOrganizationProfile,
    actorId: string,
    auditEventRoot: string,
  ) {
    for (const document of organization.documents) {
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO organizations.verification_documents (
          id, organization_id, document_type, document_hash, issued_by,
          uploaded_at, uploaded_by, audit_event_root
        ) VALUES (
          ${document.documentId}, ${organization.id}, ${document.documentType}, ${document.documentHash},
          ${document.issuedBy ?? null}, ${asDate(document.uploadedAt)}, ${actorId}, ${auditEventRoot}
        )
        ON CONFLICT (organization_id, document_hash) DO NOTHING
      `);
    }
  }
}

function mapAuditEvent(row: unknown): CanopyProofAuditEvent {
  const parsed = auditEventRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    id: parsed.data.id,
    action: parsed.data.action,
    actor: parsed.data.actor_id,
    entityType: parsed.data.entity_type,
    entityId: parsed.data.entity_id,
    previousRoot: parsed.data.previous_root,
    payloadHash: parsed.data.payload_hash,
    eventRoot: parsed.data.event_root,
    createdAt: parsed.data.created_at.toISOString(),
    rationale: parsed.data.rationale,
  };
}

function mapJoinedAuditEvent(row: z.infer<typeof joinedAuditEventRowSchema>): CanopyProofAuditEvent {
  return {
    id: row.semantic_event_id,
    action: row.semantic_event_action,
    actor: row.semantic_event_actor_id,
    entityType: row.semantic_event_entity_type,
    entityId: row.semantic_event_entity_id,
    previousRoot: row.semantic_event_previous_root,
    payloadHash: row.semantic_event_payload_hash,
    eventRoot: row.semantic_event_root,
    createdAt: row.semantic_event_created_at.toISOString(),
    rationale: row.semantic_event_rationale,
  };
}

function mapEvidenceCustodyActorSnapshot(
  actor: z.infer<typeof evidenceCustodyActorSnapshotRowSchema>,
): CanopyProofEvidenceCustodyActorSnapshot {
  return {
    id: actor.id,
    participantType: actor.participantType,
    role: actor.role,
    verificationStatus: actor.verificationStatus,
    organizationId: actor.organizationId,
    organizationVerificationStatus: actor.organizationVerificationStatus,
    participantRoot: actor.participantRoot,
    organizationRoot: actor.organizationRoot,
    membershipId: actor.membershipId,
    membershipStatus: actor.membershipStatus,
    membershipRoot: actor.membershipRoot,
    authorityRoot: actor.authorityRoot,
  };
}

function mapEvidenceConsentReceipt(row: unknown): CanopyProofEvidenceConsentReceiptFact {
  const parsed = evidenceConsentReceiptRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.subject_sequence ||
    auditEvent.action !== "ASSERT" ||
    auditEvent.actor !== fact.subject_id ||
    auditEvent.entityType !== "consent_receipt" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.granted_at.toISOString() ||
    fact.created_by !== fact.subject_id ||
    fact.actor_snapshot.id !== fact.subject_id ||
    fact.actor_snapshot.organizationId !== fact.organization_id ||
    fact.actor_snapshot.participantRoot !== fact.subject_root ||
    fact.actor_snapshot.authorityRoot !== fact.subject_authority_root
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_consent_receipt",
    id: fact.id,
    organizationId: fact.organization_id,
    subjectId: fact.subject_id,
    subjectRoot: fact.subject_root,
    subjectAuthorityRoot: fact.subject_authority_root,
    ...(fact.device_fingerprint_hash ? { deviceFingerprintHash: fact.device_fingerprint_hash } : {}),
    purposes: fact.purposes,
    lawfulBasis: fact.lawful_basis,
    privacyMode: fact.privacy_mode,
    policyVersion: fact.policy_version,
    evidenceHash: fact.evidence_hash,
    grantedAt: fact.granted_at.toISOString(),
    ...(fact.expires_at ? { expiresAt: fact.expires_at.toISOString() } : {}),
    retentionDays: fact.retention_days,
    actor: mapEvidenceCustodyActorSnapshot(fact.actor_snapshot),
    commandHash: fact.command_hash,
    subjectSequence: fact.subject_sequence,
    previousEventRoot: fact.previous_event_root,
    receiptHash: fact.receipt_hash,
    receiptRoot: fact.receipt_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceConsentRevocation(row: unknown): CanopyProofEvidenceConsentRevocationFact {
  const parsed = evidenceConsentRevocationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.subject_sequence ||
    auditEvent.action !== "CHALLENGE" ||
    auditEvent.actor !== fact.subject_id ||
    auditEvent.entityType !== "consent_revocation" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.revoked_at.toISOString() ||
    fact.revoked_by !== fact.subject_id ||
    fact.actor_snapshot.id !== fact.subject_id ||
    fact.actor_snapshot.organizationId !== fact.organization_id ||
    fact.actor_snapshot.participantRoot !== fact.subject_root
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_consent_revocation",
    id: fact.id,
    receiptId: fact.receipt_id,
    receiptRoot: fact.receipt_root,
    organizationId: fact.organization_id,
    subjectId: fact.subject_id,
    subjectRoot: fact.subject_root,
    reasonHash: fact.reason_hash,
    revokedAt: fact.revoked_at.toISOString(),
    actor: mapEvidenceCustodyActorSnapshot(fact.actor_snapshot),
    commandHash: fact.command_hash,
    subjectSequence: fact.subject_sequence,
    previousEventRoot: fact.previous_event_root,
    revocationHash: fact.revocation_hash,
    revocationRoot: fact.revocation_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceDeviceAttestation(row: unknown): CanopyProofEvidenceDeviceAttestationFact {
  const parsed = evidenceDeviceAttestationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const expectedAction = fact.provider_verification_state !== "verified" || fact.risk_flags.length > 0
    ? "CHALLENGE"
    : "ASSERT";
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.subject_sequence ||
    auditEvent.action !== expectedAction ||
    auditEvent.actor !== fact.subject_id ||
    auditEvent.entityType !== "device_attestation" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.issued_at.toISOString() ||
    fact.created_by !== fact.subject_id ||
    fact.actor_snapshot.id !== fact.subject_id ||
    fact.actor_snapshot.organizationId !== fact.organization_id ||
    fact.actor_snapshot.participantRoot !== fact.subject_root ||
    fact.actor_snapshot.authorityRoot !== fact.subject_authority_root
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_device_attestation",
    id: fact.id,
    organizationId: fact.organization_id,
    subjectId: fact.subject_id,
    subjectRoot: fact.subject_root,
    subjectAuthorityRoot: fact.subject_authority_root,
    consentReceiptId: fact.consent_receipt_id,
    consentReceiptRoot: fact.consent_receipt_root,
    deviceFingerprintHash: fact.device_fingerprint_hash,
    attestationType: fact.attestation_type,
    provider: fact.provider,
    providerKeyId: fact.provider_key_id,
    providerReceiptHash: fact.provider_receipt_hash,
    providerVerificationState: fact.provider_verification_state,
    publicKeyHash: fact.public_key_hash,
    attestationHash: fact.attestation_hash,
    issuedAt: fact.issued_at.toISOString(),
    expiresAt: fact.expires_at.toISOString(),
    reputationScore: fact.reputation_score,
    riskFlags: fact.risk_flags,
    actor: mapEvidenceCustodyActorSnapshot(fact.actor_snapshot),
    commandHash: fact.command_hash,
    subjectSequence: fact.subject_sequence,
    previousEventRoot: fact.previous_event_root,
    deviceHash: fact.device_hash,
    attestationRoot: fact.attestation_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceConsentProjection(row: unknown): CanopyProofEvidenceConsentProjection {
  const parsed = evidenceConsentProjectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    receiptId: parsed.data.receipt_id,
    receiptRoot: parsed.data.receipt_root,
    organizationId: parsed.data.organization_id,
    subjectId: parsed.data.subject_id,
    state: parsed.data.state,
    evaluatedAt: parsed.data.evaluated_at_utc.toISOString(),
    ...(parsed.data.revocation_id ? { revocationId: parsed.data.revocation_id } : {}),
    ...(parsed.data.revocation_root ? { revocationRoot: parsed.data.revocation_root } : {}),
    projectionRoot: parsed.data.projection_root,
    safety: parsed.data.safety,
  };
}

function mapEvidenceDeviceAttestationProjection(
  row: unknown,
): CanopyProofEvidenceDeviceAttestationProjection {
  const parsed = evidenceDeviceAttestationProjectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    attestationId: parsed.data.attestation_id,
    attestationRoot: parsed.data.attestation_root,
    organizationId: parsed.data.organization_id,
    subjectId: parsed.data.subject_id,
    consentReceiptId: parsed.data.consent_receipt_id,
    state: parsed.data.state,
    evaluatedAt: parsed.data.evaluated_at_utc.toISOString(),
    consentProjectionRoot: parsed.data.consent_projection_root,
    projectionRoot: parsed.data.projection_root,
    safety: parsed.data.safety,
  };
}

function mapEffectiveDeviceAttestationProjection(
  row: unknown,
): CanopyProofEffectiveDeviceAttestationProjection {
  const parsed = effectiveDeviceAttestationProjectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    attestationId: parsed.data.attestation_id,
    attestationRoot: parsed.data.attestation_root,
    organizationId: parsed.data.organization_id,
    subjectId: parsed.data.subject_id,
    consentReceiptId: parsed.data.consent_receipt_id,
    state: parsed.data.state,
    issueCodes: parsed.data.issue_codes,
    evaluatedAt: parsed.data.evaluated_at_utc.toISOString(),
    consentProjectionRoot: parsed.data.consent_projection_root,
    ...(parsed.data.verification_fact_id
      ? { verificationFactId: parsed.data.verification_fact_id }
      : {}),
    ...(parsed.data.verification_root ? { verificationRoot: parsed.data.verification_root } : {}),
    projectionRoot: parsed.data.projection_root,
    safety: parsed.data.safety,
  };
}

function mapEvidenceMediaAgentSnapshot(
  agent: z.infer<typeof evidenceMediaAgentSnapshotRowSchema>,
): CanopyProofEvidenceMediaAgentSnapshot {
  return {
    id: agent.id,
    participantType: agent.participantType,
    role: agent.role,
    verificationStatus: agent.verificationStatus,
    organizationId: agent.organizationId,
    organizationVerificationStatus: agent.organizationVerificationStatus,
    participantRoot: agent.participantRoot,
    organizationRoot: agent.organizationRoot,
    agentType: agent.agentType,
    agentStatus: agent.agentStatus,
    capability: agent.capability,
    agentRegistryHash: agent.agentRegistryHash,
    authorityRoot: agent.authorityRoot,
  };
}

function mapEvidenceMediaUploadIntent(row: unknown): CanopyProofEvidenceMediaUploadIntentFact {
  const parsed = evidenceMediaUploadIntentRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== "ASSERT" ||
    auditEvent.actor !== fact.subject_id ||
    auditEvent.entityType !== "media_upload_intent" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.captured_at.toISOString() ||
    fact.actor_snapshot.id !== fact.subject_id ||
    fact.actor_snapshot.organizationId !== fact.organization_id ||
    fact.actor_snapshot.participantRoot !== fact.subject_root ||
    fact.actor_snapshot.authorityRoot !== fact.subject_authority_root
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_upload_intent",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    projectRoot: fact.project_root,
    projectStatus: fact.project_status,
    evidenceId: fact.evidence_id,
    subjectId: fact.subject_id,
    subjectRoot: fact.subject_root,
    subjectAuthorityRoot: fact.subject_authority_root,
    consentReceiptId: fact.consent_receipt_id,
    consentReceiptRoot: fact.consent_receipt_root,
    consentProjectionRoot: fact.consent_projection_root,
    deviceAttestationId: fact.device_attestation_id,
    deviceAttestationRoot: fact.device_attestation_root,
    deviceProjectionRoot: fact.device_projection_root,
    deviceTrustState: fact.device_trust_state,
    contentHash: fact.content_hash,
    contentType: fact.content_type,
    byteLength: fact.byte_length,
    objectKey: fact.object_key,
    capturedAt: fact.captured_at.toISOString(),
    expiresAt: fact.expires_at.toISOString(),
    actor: mapEvidenceCustodyActorSnapshot(fact.actor_snapshot),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    intentHash: fact.intent_hash,
    intentRoot: fact.intent_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaObject(row: unknown): CanopyProofEvidenceMediaObjectFact {
  const parsed = evidenceMediaObjectRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const expectedAction = fact.provider_verification_state === "verified" ? "FULFILL" : "REASON";
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== expectedAction ||
    auditEvent.actor !== fact.agent_snapshot.id ||
    auditEvent.entityType !== "media_object" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.stored_at.toISOString() ||
    fact.agent_snapshot.organizationId !== fact.organization_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_object",
    id: fact.id,
    intentId: fact.intent_id,
    intentRoot: fact.intent_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    projectRoot: fact.project_root,
    evidenceId: fact.evidence_id,
    contentHash: fact.content_hash,
    contentType: fact.content_type,
    byteLength: fact.byte_length,
    objectKey: fact.object_key,
    storageProvider: fact.storage_provider,
    providerNamespace: fact.provider_namespace,
    objectVersion: fact.object_version,
    etagHash: fact.etag_hash,
    providerReceiptHash: fact.provider_receipt_hash,
    providerVerificationState: fact.provider_verification_state,
    encryptionMode: fact.encryption_mode,
    ...(fact.encryption_key_ref ? { encryptionKeyRef: fact.encryption_key_ref } : {}),
    objectLockMode: fact.object_lock_mode,
    ...(fact.retain_until ? { retainUntil: fact.retain_until.toISOString() } : {}),
    storedAt: fact.stored_at.toISOString(),
    agent: mapEvidenceMediaAgentSnapshot(fact.agent_snapshot),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    objectHash: fact.object_hash,
    objectRoot: fact.object_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaDuplicateRelation(
  row: unknown,
): CanopyProofEvidenceMediaDuplicateRelationFact {
  const parsed = evidenceMediaDuplicateRelationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== "CHALLENGE" ||
    auditEvent.actor !== fact.agent_snapshot.id ||
    auditEvent.entityType !== "media_duplicate_relation" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.detected_at.toISOString() ||
    fact.agent_snapshot.organizationId !== fact.organization_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_duplicate_relation",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    objectRoot: fact.object_root,
    duplicateOfObjectId: fact.duplicate_of_object_id,
    duplicateOfObjectRoot: fact.duplicate_of_object_root,
    contentHash: fact.content_hash,
    detectedAt: fact.detected_at.toISOString(),
    agent: mapEvidenceMediaAgentSnapshot(fact.agent_snapshot),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    relationHash: fact.relation_hash,
    relationRoot: fact.relation_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaScanResult(row: unknown): CanopyProofEvidenceMediaScanResultFact {
  const parsed = evidenceMediaScanResultRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const expectedAction = fact.verdict === "clean" && fact.provider_verification_state === "verified"
    ? "FULFILL"
    : fact.verdict === "clean"
      ? "REASON"
      : "CHALLENGE";
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== expectedAction ||
    auditEvent.actor !== fact.agent_snapshot.id ||
    auditEvent.entityType !== "media_scan_result" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.scanned_at.toISOString() ||
    fact.agent_snapshot.organizationId !== fact.organization_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_scan_result",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    objectRoot: fact.object_root,
    scannerName: fact.scanner_name,
    scannerVersion: fact.scanner_version,
    scannerImageDigest: fact.scanner_image_digest,
    signatureDatabaseVersion: fact.signature_database_version,
    verdict: fact.verdict,
    findingHashes: fact.finding_hashes,
    providerReceiptHash: fact.provider_receipt_hash,
    providerVerificationState: fact.provider_verification_state,
    scannedAt: fact.scanned_at.toISOString(),
    agent: mapEvidenceMediaAgentSnapshot(fact.agent_snapshot),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    scanHash: fact.scan_hash,
    scanRoot: fact.scan_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaProviderVerification(
  row: unknown,
): CanopyProofEvidenceMediaProviderVerificationFact {
  const parsed = evidenceMediaProviderVerificationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const uploadedAt = fact.uploaded_at.toISOString();
  const verifiedAt = fact.verified_at.toISOString();
  const receiptSeed = {
    intentId: fact.intent_id,
    intentRoot: fact.intent_root,
    provider: fact.storage_provider,
    providerNamespace: fact.provider_namespace,
    objectKey: fact.object_key,
    objectVersion: fact.object_version,
    contentHash: fact.content_hash,
    contentType: fact.content_type,
    byteLength: fact.byte_length,
    etagHash: fact.etag_hash,
    uploadedAt,
    encryptionMode: fact.encryption_mode,
    ...(fact.encryption_key_ref ? { encryptionKeyRef: fact.encryption_key_ref } : {}),
    objectLockMode: fact.object_lock_mode,
    ...(fact.retain_until ? { retainUntil: fact.retain_until.toISOString() } : {}),
    ...(fact.retention_policy_root ? { retentionPolicyRoot: fact.retention_policy_root } : {}),
    retentionVerificationState: fact.retention_verification_state,
    verifiedAt,
  } as const;
  const providerReceiptHash = hashJson({
    kind: "canopyproof-stored-object-provider-receipt-v1",
    ...receiptSeed,
  });
  const providerVerificationRoot = hashJson({
    kind: "canopyproof-stored-object-provider-verification-v1",
    intentId: fact.intent_id,
    intentRoot: fact.intent_root,
    provider: fact.storage_provider,
    providerNamespace: fact.provider_namespace,
    providerReceiptHash,
    verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-media-provider-verification-command-v1",
    objectId: fact.object_id,
    objectRoot: fact.object_root,
    providerReceiptHash,
    providerVerificationRoot,
    verifierId: fact.verifier_id,
    verifierAuthorityRoot: fact.verifier_snapshot.authorityRoot,
    verifiedAt,
  });
  const factRoot = hashJson({
    kind: "canopyproof-media-provider-verification-fact-root-v1",
    commandHash,
    providerVerificationRoot,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId: fact.command_receipt_id,
    safety: fact.safety,
  });
  const expectedAction = fact.retention_verification_state === "verified" ? "FULFILL" : "REASON";
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== expectedAction ||
    auditEvent.actor !== fact.verifier_id ||
    auditEvent.entityType !== "media_provider_receipt_verification" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.payloadHash !== providerVerificationRoot ||
    auditEvent.createdAt !== verifiedAt ||
    fact.verifier_snapshot.organizationId !== fact.organization_id ||
    fact.verifier_snapshot.id !== fact.verifier_id ||
    fact.provider_receipt_hash !== providerReceiptHash ||
    fact.provider_verification_root !== providerVerificationRoot ||
    fact.command_hash !== commandHash ||
    fact.id !== `cp_media_provider_verify_${commandHash.slice(0, 24)}` ||
    fact.fact_root !== factRoot
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_provider_receipt_verification",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    objectRoot: fact.object_root,
    intentId: fact.intent_id,
    intentRoot: fact.intent_root,
    verifierId: fact.verifier_id,
    verifier: mapEvidenceMediaAgentSnapshot(fact.verifier_snapshot),
    storageProvider: fact.storage_provider,
    providerNamespace: fact.provider_namespace,
    objectKey: fact.object_key,
    objectVersion: fact.object_version,
    contentHash: fact.content_hash,
    contentType: fact.content_type,
    byteLength: fact.byte_length,
    etagHash: fact.etag_hash,
    uploadedAt,
    encryptionMode: fact.encryption_mode,
    ...(fact.encryption_key_ref ? { encryptionKeyRef: fact.encryption_key_ref } : {}),
    objectLockMode: fact.object_lock_mode,
    ...(fact.retain_until ? { retainUntil: fact.retain_until.toISOString() } : {}),
    ...(fact.retention_policy_root ? { retentionPolicyRoot: fact.retention_policy_root } : {}),
    retentionVerificationState: fact.retention_verification_state,
    providerReceiptHash,
    verifiedAt,
    providerVerificationRoot,
    commandHash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    commandReceiptId: fact.command_receipt_id,
    factRoot,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaScannerVerification(
  row: unknown,
): CanopyProofEvidenceMediaScannerVerificationFact {
  const parsed = evidenceMediaScannerVerificationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const verifiedAt = fact.verified_at.toISOString();
  const scannerVerificationRoot = hashJson({
    kind: "canopyproof-malware-scan-verification-v1",
    receiptHash: fact.scanner_receipt_hash,
    signerKeyId: fact.signer_key_id,
    scannerPolicyRoot: fact.scanner_policy_root,
    signatureHash: fact.signature_hash,
    verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-media-scanner-verification-command-v1",
    scanResultId: fact.scan_result_id,
    scanRoot: fact.scan_root,
    scannerReceiptHash: fact.scanner_receipt_hash,
    scannerVerificationRoot,
    verifierId: fact.verifier_id,
    verifierAuthorityRoot: fact.verifier_snapshot.authorityRoot,
    verifiedAt,
  });
  const factRoot = hashJson({
    kind: "canopyproof-media-scanner-verification-fact-root-v1",
    commandHash,
    scannerVerificationRoot,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId: fact.command_receipt_id,
    safety: fact.safety,
  });
  const expectedAction = fact.source_scan_verdict === "clean" ? "FULFILL" : "CHALLENGE";
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== expectedAction ||
    auditEvent.actor !== fact.verifier_id ||
    auditEvent.entityType !== "media_scanner_receipt_verification" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.payloadHash !== scannerVerificationRoot ||
    auditEvent.createdAt !== verifiedAt ||
    fact.verifier_snapshot.organizationId !== fact.organization_id ||
    fact.verifier_snapshot.id !== fact.verifier_id ||
    fact.scanner_verification_root !== scannerVerificationRoot ||
    fact.command_hash !== commandHash ||
    fact.id !== `cp_media_scanner_verify_${commandHash.slice(0, 24)}` ||
    fact.fact_root !== factRoot
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_scanner_receipt_verification",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    objectRoot: fact.object_root,
    scanResultId: fact.scan_result_id,
    scanRoot: fact.scan_root,
    verifierId: fact.verifier_id,
    verifier: mapEvidenceMediaAgentSnapshot(fact.verifier_snapshot),
    scannerId: fact.scanner_id,
    signerKeyId: fact.signer_key_id,
    signatureAlgorithm: fact.signature_algorithm,
    signatureHash: fact.signature_hash,
    scannerPolicyRoot: fact.scanner_policy_root,
    objectProviderReceiptHash: fact.object_provider_receipt_hash,
    scannerReceiptHash: fact.scanner_receipt_hash,
    verifiedAt,
    scannerVerificationRoot,
    commandHash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    commandReceiptId: fact.command_receipt_id,
    factRoot,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaObjectProjection(row: unknown): CanopyProofEvidenceMediaObjectProjection {
  const parsed = evidenceMediaObjectProjectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    objectId: parsed.data.object_id,
    objectRoot: parsed.data.object_root,
    organizationId: parsed.data.organization_id,
    projectId: parsed.data.project_id,
    evidenceId: parsed.data.evidence_id,
    state: parsed.data.state,
    evaluatedAt: parsed.data.evaluated_at_utc.toISOString(),
    consentState: parsed.data.consent_state,
    deviceState: parsed.data.device_state,
    ...(parsed.data.latest_scan_result_id
      ? { latestScanResultId: parsed.data.latest_scan_result_id }
      : {}),
    ...(parsed.data.latest_scan_root ? { latestScanRoot: parsed.data.latest_scan_root } : {}),
    ...(parsed.data.duplicate_relation_id
      ? { duplicateRelationId: parsed.data.duplicate_relation_id }
      : {}),
    ...(parsed.data.duplicate_relation_root
      ? { duplicateRelationRoot: parsed.data.duplicate_relation_root }
      : {}),
    projectionRoot: parsed.data.projection_root,
    safety: parsed.data.safety,
  };
}

function mapEvidenceMediaAdapterTrustProjection(
  row: unknown,
): CanopyProofEvidenceMediaAdapterTrustProjection {
  const parsed = evidenceMediaAdapterTrustProjectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    objectId: parsed.data.object_id,
    objectRoot: parsed.data.object_root,
    organizationId: parsed.data.organization_id,
    ...(parsed.data.provider_verification_fact_id
      ? { providerVerificationFactId: parsed.data.provider_verification_fact_id }
      : {}),
    ...(parsed.data.provider_verification_root
      ? { providerVerificationRoot: parsed.data.provider_verification_root }
      : {}),
    ...(parsed.data.retention_verification_state
      ? { retentionVerificationState: parsed.data.retention_verification_state }
      : {}),
    ...(parsed.data.latest_scan_result_id
      ? { latestScanResultId: parsed.data.latest_scan_result_id }
      : {}),
    ...(parsed.data.latest_scan_root ? { latestScanRoot: parsed.data.latest_scan_root } : {}),
    ...(parsed.data.scanner_verification_fact_id
      ? { scannerVerificationFactId: parsed.data.scanner_verification_fact_id }
      : {}),
    ...(parsed.data.scanner_verification_root
      ? { scannerVerificationRoot: parsed.data.scanner_verification_root }
      : {}),
    state: parsed.data.state,
    evaluatedAt: parsed.data.evaluated_at_utc.toISOString(),
    projectionRoot: parsed.data.projection_root,
    safety: parsed.data.safety,
  };
}

function mapEffectiveMediaObjectProjection(row: unknown): CanopyProofEffectiveMediaObjectProjection {
  const parsed = effectiveMediaObjectProjectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    objectId: parsed.data.object_id,
    objectRoot: parsed.data.object_root,
    organizationId: parsed.data.organization_id,
    projectId: parsed.data.project_id,
    evidenceId: parsed.data.evidence_id,
    baseProjectionRoot: parsed.data.base_projection_root,
    adapterTrustProjectionRoot: parsed.data.adapter_trust_projection_root,
    ...(parsed.data.device_trust_projection_root
      ? { deviceTrustProjectionRoot: parsed.data.device_trust_projection_root }
      : {}),
    state: parsed.data.state,
    issueCodes: parsed.data.issue_codes,
    evaluatedAt: parsed.data.evaluated_at_utc.toISOString(),
    projectionRoot: parsed.data.projection_root,
    safety: parsed.data.safety,
  };
}

function mapEvidenceMediaReviewTask(row: unknown): CanopyProofEvidenceMediaReviewTaskFact {
  const parsed = evidenceMediaReviewTaskRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== "REASON" ||
    auditEvent.actor !== fact.opened_by ||
    auditEvent.entityType !== "evidence_media_review_task" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.opened_at.toISOString() ||
    fact.opener_snapshot.id !== fact.opened_by ||
    fact.opener_snapshot.organizationId !== fact.organization_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_review_task",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    objectRoot: fact.object_root,
    mediaProjectionState: fact.media_projection_state,
    mediaProjectionRoot: fact.media_projection_root,
    contributorId: fact.contributor_id,
    reviewRound: fact.review_round,
    previousReviewTaskRoot: fact.previous_review_task_root,
    reasonCodes: fact.reason_codes,
    severity: fact.severity,
    policyId: fact.policy_id,
    openedBy: fact.opened_by,
    opener: mapVerificationActorSnapshot(fact.opener_snapshot),
    openedAt: fact.opened_at.toISOString(),
    dueAt: fact.due_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    taskHash: fact.task_hash,
    taskRoot: fact.task_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaReviewAssignment(row: unknown): CanopyProofEvidenceMediaReviewAssignmentFact {
  const parsed = evidenceMediaReviewAssignmentRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== "DELEGATE" ||
    auditEvent.actor !== fact.assigned_by ||
    auditEvent.entityType !== "evidence_media_review_assignment" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.assigned_at.toISOString() ||
    fact.reviewer_snapshot.id !== fact.reviewer_id ||
    fact.assigner_snapshot.id !== fact.assigned_by
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_review_assignment",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    taskId: fact.task_id,
    taskRoot: fact.task_root,
    contributorId: fact.contributor_id,
    reviewerId: fact.reviewer_id,
    reviewer: mapVerificationActorSnapshot(fact.reviewer_snapshot),
    assignedBy: fact.assigned_by,
    assigner: mapVerificationActorSnapshot(fact.assigner_snapshot),
    assignedAt: fact.assigned_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    assignmentHash: fact.assignment_hash,
    assignmentRoot: fact.assignment_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaReviewDecision(row: unknown): CanopyProofEvidenceMediaReviewDecisionFact {
  const parsed = evidenceMediaReviewDecisionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const expectedAction =
    fact.decision === "accept_for_processing" || fact.decision === "retain_non_final"
      ? "FULFILL"
      : "CHALLENGE";
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.action !== expectedAction ||
    auditEvent.actor !== fact.reviewer_id ||
    auditEvent.entityType !== "evidence_media_review_decision" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.decided_at.toISOString() ||
    fact.reviewer_snapshot.id !== fact.reviewer_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_review_decision",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    objectId: fact.object_id,
    taskId: fact.task_id,
    taskRoot: fact.task_root,
    assignmentId: fact.assignment_id,
    assignmentRoot: fact.assignment_root,
    mediaProjectionState: fact.media_projection_state,
    mediaProjectionRoot: fact.media_projection_root,
    reviewerId: fact.reviewer_id,
    reviewer: mapVerificationActorSnapshot(fact.reviewer_snapshot),
    decision: fact.decision,
    rationaleHash: fact.rationale_hash,
    limitationHashes: fact.limitation_hashes,
    decidedAt: fact.decided_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    decisionHash: fact.decision_hash,
    decisionRoot: fact.decision_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceMediaCustodyEvent(row: unknown): CanopyProofEvidenceMediaCustodyEventFact {
  const parsed = evidenceMediaCustodyEventRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  const actionIsValid =
    (fact.action === "review_opened" && auditEvent.action === "REASON") ||
    (fact.action === "review_assigned" && auditEvent.action === "DELEGATE") ||
    (fact.action === "review_decided" && ["FULFILL", "CHALLENGE"].includes(auditEvent.action));
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    !actionIsValid ||
    auditEvent.actor !== fact.custodian_id ||
    auditEvent.entityType !== "evidence_media_custody_event" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.previousRoot !== fact.previous_event_root ||
    auditEvent.createdAt !== fact.occurred_at.toISOString() ||
    fact.custodian_snapshot.id !== fact.custodian_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_media_custody_event",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    evidenceId: fact.evidence_id,
    action: fact.action,
    artifactType: fact.artifact_type,
    artifactId: fact.artifact_id,
    sourceRoot: fact.source_root,
    custodianId: fact.custodian_id,
    custodian: mapVerificationActorSnapshot(fact.custodian_snapshot),
    custodyNoteHash: fact.custody_note_hash,
    policyId: fact.policy_id,
    occurredAt: fact.occurred_at.toISOString(),
    previousCustodyRoot: fact.previous_custody_root,
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    custodyHash: fact.custody_hash,
    custodyRoot: fact.custody_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceRegistration(row: unknown): CanopyProofEvidenceRegistration {
  const parsed = evidenceRegistrationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const evidence = parsed.data;
  const auditEvent = mapJoinedAuditEvent(evidence);
  if (
    evidence.audit_event_root !== auditEvent.eventRoot ||
    evidence.semantic_event_sequence_no !== 1 ||
    evidence.semantic_event_entity_type !== "evidence"
  ) {
    throw unavailable();
  }
  return {
    id: evidence.id,
    projectId: evidence.project_id,
    organizationId: evidence.organization_id,
    projectRootAtSubmission: evidence.project_root_at_submission,
    projectStatusAtSubmission: evidence.project_status_at_submission,
    projectRegionIdAtSubmission: evidence.project_region_id_at_submission,
    projectAuthorityUpdatedAtAtSubmission: evidence.project_authority_updated_at_at_submission.toISOString(),
    evidenceType: evidence.evidence_type,
    location: {
      latitude: evidence.location.latitude,
      longitude: evidence.location.longitude,
      ...(evidence.location.accuracyMeters !== undefined
        ? { accuracyMeters: evidence.location.accuracyMeters }
        : {}),
      ...(evidence.location.regionId ? { regionId: evidence.location.regionId } : {}),
    },
    timestamp: evidence.observed_at.toISOString(),
    createdAt: evidence.created_at.toISOString(),
    contributor: evidence.contributor_id,
    contributorRole: evidence.contributor_role,
    media_hash: evidence.media_hash,
    gps_hash: evidence.gps_hash,
    verification_status: evidence.verification_status,
    confidence_score: evidence.confidence_score,
    reviewers: [],
    validationIssues: evidence.validation_issues,
    ...(evidence.offline_sync_id ? { offline_sync_id: evidence.offline_sync_id } : {}),
    ...(evidence.device_fingerprint_hash
      ? { device_fingerprint_hash: evidence.device_fingerprint_hash }
      : {}),
    ...(evidence.exif_hash ? { exif_hash: evidence.exif_hash } : {}),
    evidenceHash: evidence.evidence_hash,
    evidenceRoot: evidence.evidence_root,
    audit_history: [auditEvent],
    claimBoundary: evidence.claim_boundary satisfies CanopyProofEvidenceClaimBoundary,
  };
}

function mapEvidenceValidationRun(row: unknown): CanopyProofEvidenceValidationRun {
  const parsed = evidenceValidationRunRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "validation_run" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.executor_id
  ) {
    throw unavailable();
  }
  return {
    factType: "validation_run",
    id: fact.id,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    rulesetId: fact.ruleset_id,
    rulesetVersion: fact.ruleset_version,
    rulesetHash: fact.ruleset_hash,
    checks: fact.checks,
    issues: fact.issues,
    outcome: fact.outcome,
    confidenceScore: fact.confidence_score,
    executor: mapVerificationActorSnapshot(fact.executor_snapshot),
    executedAt: fact.executed_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    validationHash: fact.validation_hash,
    validationRoot: fact.validation_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceAiAnalysis(row: unknown): CanopyProofAdvisoryAiAnalysis {
  const parsed = advisoryAiAnalysisRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "ai_analysis" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.agent_id
  ) {
    throw unavailable();
  }
  return {
    factType: "ai_analysis",
    id: fact.id,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    validationRunId: fact.validation_run_id,
    validationRoot: fact.validation_root,
    agent: mapVerificationActorSnapshot(fact.agent_snapshot),
    modelProvider: fact.model_provider,
    modelName: fact.model_name,
    modelVersion: fact.model_version,
    modelArtifactHash: fact.model_artifact_hash,
    promptHash: fact.prompt_hash,
    datasetSnapshotRoots: fact.dataset_snapshot_roots,
    sourceEventRoots: fact.source_event_roots,
    executionEnvironment: fact.execution_environment,
    capabilities: fact.capabilities,
    findings: fact.findings,
    recommendation: fact.recommendation,
    claimedConfidenceScore: fact.claimed_confidence_score,
    confidenceScore: fact.confidence_score,
    advisoryOnly: true,
    analyzedAt: fact.analyzed_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    analysisHash: fact.analysis_hash,
    analysisRoot: fact.analysis_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceHumanReview(row: unknown): CanopyProofEvidenceHumanReview {
  const parsed = evidenceHumanReviewRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "human_review" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.reviewer_id
  ) {
    throw unavailable();
  }
  return {
    factType: "human_review",
    id: fact.id,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    validationRunId: fact.validation_run_id,
    validationRoot: fact.validation_root,
    aiAnalysisIds: fact.ai_analysis_ids,
    aiAnalysisRoots: fact.ai_analysis_roots,
    reviewer: mapVerificationActorSnapshot(fact.reviewer_snapshot),
    decision: fact.decision,
    findingDispositions: fact.finding_dispositions,
    rationale: fact.rationale,
    limitations: fact.limitations,
    reviewedAt: fact.reviewed_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    sourceRoot: fact.source_root,
    reviewHash: fact.review_hash,
    reviewRoot: fact.review_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceChallenge(row: unknown): CanopyProofEvidenceChallenge {
  const parsed = evidenceChallengeRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "evidence_challenge" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.challenger_id ||
    fact.challenger_snapshot.organizationId !== fact.challenger_organization_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_challenge",
    id: fact.id,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    challengedRelianceState: fact.challenged_reliance_state,
    challengedRelianceRoot: fact.challenged_reliance_root,
    challengedTerminalEventRoot: fact.challenged_terminal_event_root,
    ...(fact.challenged_validation_run_id && fact.challenged_validation_root
      ? {
          challengedValidationRunId: fact.challenged_validation_run_id,
          challengedValidationRoot: fact.challenged_validation_root,
        }
      : {}),
    challengedAiAnalysisIds: fact.challenged_ai_analysis_ids,
    challengedAiAnalysisRoots: fact.challenged_ai_analysis_roots,
    ...(fact.challenged_human_review_id && fact.challenged_human_review_root
      ? {
          challengedHumanReviewId: fact.challenged_human_review_id,
          challengedHumanReviewRoot: fact.challenged_human_review_root,
        }
      : {}),
    reason: fact.reason,
    severity: fact.severity,
    rationale: fact.rationale,
    supportingArtifactHashes: fact.supporting_artifact_hashes,
    evidenceEventRoots: fact.evidence_event_roots,
    challenger: mapVerificationActorSnapshot(fact.challenger_snapshot),
    challengedAt: fact.challenged_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    challengeHash: fact.challenge_hash,
    challengeRoot: fact.challenge_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceChallengeResolution(row: unknown): CanopyProofEvidenceChallengeResolution {
  const parsed = evidenceChallengeResolutionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "evidence_challenge_resolution" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.reviewer_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_challenge_resolution",
    id: fact.id,
    challengeId: fact.challenge_id,
    challengeRoot: fact.challenge_root,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    ...(fact.previous_resolution_id && fact.previous_resolution_root
      ? {
          previousResolutionId: fact.previous_resolution_id,
          previousResolutionRoot: fact.previous_resolution_root,
        }
      : {}),
    decision: fact.decision,
    rationale: fact.rationale,
    limitations: fact.limitations,
    evidenceEventRoots: fact.evidence_event_roots,
    reviewer: mapVerificationActorSnapshot(fact.reviewer_snapshot),
    reviewedAt: fact.reviewed_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    sourceRoot: fact.source_root,
    resolutionHash: fact.resolution_hash,
    resolutionRoot: fact.resolution_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceCorrection(row: unknown): CanopyProofEvidenceCorrection {
  const parsed = evidenceCorrectionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "evidence_correction" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.publisher_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_correction",
    id: fact.id,
    challengeId: fact.challenge_id,
    challengeRoot: fact.challenge_root,
    resolutionId: fact.resolution_id,
    resolutionRoot: fact.resolution_root,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    action: fact.action,
    ...(fact.replacement_evidence_id &&
    fact.replacement_evidence_root &&
    fact.replacement_reliance_root &&
    fact.replacement_terminal_event_root
      ? {
          replacementEvidenceId: fact.replacement_evidence_id,
          replacementEvidenceRoot: fact.replacement_evidence_root,
          replacementRelianceRoot: fact.replacement_reliance_root,
          replacementTerminalEventRoot: fact.replacement_terminal_event_root,
        }
      : {}),
    rationale: fact.rationale,
    evidenceEventRoots: fact.evidence_event_roots,
    publisher: mapVerificationActorSnapshot(fact.publisher_snapshot),
    correctedAt: fact.corrected_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    sourceRoot: fact.source_root,
    correctionHash: fact.correction_hash,
    correctionRoot: fact.correction_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEvidenceFinalDecision(row: unknown): CanopyProofEvidenceFinalDecision {
  const parsed = evidenceFinalDecisionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.evidence_sequence ||
    auditEvent.entityType !== "evidence_final_decision" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.verifier_id
  ) {
    throw unavailable();
  }
  return {
    factType: "evidence_final_decision",
    id: fact.id,
    evidenceId: fact.evidence_id,
    projectId: fact.project_id,
    organizationId: fact.organization_id,
    evidenceRoot: fact.evidence_root,
    preDecisionRelianceState: fact.pre_decision_reliance_state,
    preDecisionRelianceRoot: fact.pre_decision_reliance_root,
    preDecisionTerminalEventRoot: fact.pre_decision_terminal_event_root,
    validationRunId: fact.validation_run_id,
    validationRoot: fact.validation_root,
    aiAnalysisIds: fact.ai_analysis_ids,
    aiAnalysisRoots: fact.ai_analysis_roots,
    humanReviewId: fact.human_review_id,
    humanReviewRoot: fact.human_review_root,
    ...(fact.prior_final_decision_id && fact.prior_final_decision_root
      ? {
          priorFinalDecisionId: fact.prior_final_decision_id,
          priorFinalDecisionRoot: fact.prior_final_decision_root,
        }
      : {}),
    decision: fact.decision,
    rationale: fact.rationale,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    verifier: mapVerificationActorSnapshot(fact.verifier_snapshot),
    decidedAt: fact.decided_at.toISOString(),
    commandHash: fact.command_hash,
    evidenceSequence: fact.evidence_sequence,
    previousEventRoot: fact.previous_event_root,
    decisionHash: fact.decision_hash,
    decisionRoot: fact.decision_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapGovernedPolicy(row: unknown): CanopyProofGovernedPolicyAuthority {
  const parsed = governedPolicyRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    auditEvent.entityType !== "governed_policy_authority" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.creator_id ||
    auditEvent.action !== "ASSERT"
  ) {
    throw unavailable();
  }
  return {
    factType: "governed_policy_authority",
    id: fact.id,
    subject: fact.subject,
    governanceOrganizationId: fact.governance_organization_id,
    title: fact.title,
    requiredApprovals: fact.required_approvals,
    allowedReviewerRoles: fact.allowed_reviewer_roles,
    ...(fact.supersedes_policy_id && fact.supersedes_policy_root
      ? {
          supersedesPolicyId: fact.supersedes_policy_id,
          supersedesPolicyRoot: fact.supersedes_policy_root,
        }
      : {}),
    creator: mapVerificationActorSnapshot(fact.creator_snapshot),
    createdAt: fact.created_at.toISOString(),
    commandHash: fact.command_hash,
    policyHash: fact.policy_hash,
    policyRoot: fact.policy_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapMethodologyVersion(row: unknown): CanopyProofMethodology {
  const parsed = methodologyVersionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.event_root !== auditEvent.eventRoot ||
    auditEvent.entityType !== "methodology" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.created_by
  ) {
    throw unavailable();
  }
  return {
    id: fact.id,
    slug: fact.slug,
    version: fact.version,
    title: fact.title,
    scope: fact.scope,
    status: fact.status,
    summary: fact.summary,
    requiredDataSources: fact.required_data_sources,
    qualityGates: fact.quality_gates,
    minimumGpsAccuracyMeters: fact.minimum_gps_accuracy_meters,
    monitoringCadenceDays: fact.monitoring_cadence_days,
    evidenceRetentionDays: fact.evidence_retention_days,
    governanceApprovalIds: fact.governance_approval_ids,
    ...(fact.supersedes ? { supersedes: fact.supersedes } : {}),
    limitations: fact.limitations,
    claimBoundary: fact.claim_boundary,
    createdBy: fact.created_by,
    createdAt: fact.created_at.toISOString(),
    ...(fact.published_at ? { publishedAt: fact.published_at.toISOString() } : {}),
    methodologyHash: fact.methodology_hash,
    qualityGateRoot: fact.quality_gate_root,
    auditEvent,
  };
}

function mapMethodologyPublicationApproval(row: unknown): CanopyProofMethodologyPublicationApproval {
  const parsed = methodologyPublicationApprovalRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.methodology_sequence ||
    auditEvent.entityType !== "methodology_publication_approval" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.approver_id
  ) {
    throw unavailable();
  }
  return {
    factType: "methodology_publication_approval",
    id: fact.id,
    methodologyId: fact.methodology_id,
    methodologyHash: fact.methodology_hash,
    methodologyEventRoot: fact.methodology_event_root,
    policyId: fact.policy_id,
    policyRoot: fact.policy_root,
    governanceOrganizationId: fact.governance_organization_id,
    ...(fact.prior_approval_id && fact.prior_approval_root
      ? { priorApprovalId: fact.prior_approval_id, priorApprovalRoot: fact.prior_approval_root }
      : {}),
    decision: fact.decision,
    rationale: fact.rationale,
    conflictDisclosure: fact.conflict_disclosure,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    approver: mapVerificationActorSnapshot(fact.approver_snapshot),
    decidedAt: fact.decided_at.toISOString(),
    commandHash: fact.command_hash,
    methodologySequence: fact.methodology_sequence,
    previousEventRoot: fact.previous_event_root,
    approvalHash: fact.approval_hash,
    approvalRoot: fact.approval_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapMethodologyPublication(row: unknown): CanopyProofMethodologyPublication {
  const parsed = methodologyPublicationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.methodology_sequence ||
    auditEvent.entityType !== "methodology_publication" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.publisher_id
  ) {
    throw unavailable();
  }
  return {
    factType: "methodology_publication",
    id: fact.id,
    methodologyId: fact.methodology_id,
    methodologyHash: fact.methodology_hash,
    methodologyQualityGateRoot: fact.methodology_quality_gate_root,
    methodologyEventRoot: fact.methodology_event_root,
    policyId: fact.policy_id,
    policyRoot: fact.policy_root,
    governanceOrganizationId: fact.governance_organization_id,
    approvalIds: fact.approval_ids,
    approvalRoots: fact.approval_roots,
    approvalQuorumRoot: fact.approval_quorum_root,
    publisher: mapVerificationActorSnapshot(fact.publisher_snapshot),
    rationale: fact.rationale,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    publishedAt: fact.published_at.toISOString(),
    commandHash: fact.command_hash,
    methodologySequence: fact.methodology_sequence,
    previousEventRoot: fact.previous_event_root,
    publicationHash: fact.publication_hash,
    publicationRoot: fact.publication_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEnvironmentalProofCandidate(row: unknown): CanopyProofEnvironmentalProofCandidate {
  const parsed = environmentalProofCandidateRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== 1 ||
    auditEvent.entityType !== "environmental_proof_candidate" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.derived_by_id ||
    auditEvent.action !== "ASSERT"
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_candidate",
    id: fact.id,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    projectStatus: fact.project_status,
    projectRoot: fact.project_root,
    projectEventRoot: fact.project_event_root,
    methodologyId: fact.methodology_id,
    methodologyHash: fact.methodology_hash,
    methodologyQualityGateRoot: fact.methodology_quality_gate_root,
    methodologyEventRoot: fact.methodology_event_root,
    methodologyPublicationId: fact.methodology_publication_id,
    methodologyPublicationRoot: fact.methodology_publication_root,
    methodologyPublicationEventRoot: fact.methodology_publication_event_root,
    methodologyPublicationBundleRoot: fact.methodology_publication_bundle_root,
    methodologyPublicationPolicyRoot: fact.methodology_publication_policy_root,
    methodologyPublicationPolicyEventRoot: fact.methodology_publication_policy_event_root,
    methodologyApprovalRoots: fact.methodology_approval_roots,
    methodologyApprovalQuorumRoot: fact.methodology_approval_quorum_root,
    policyId: fact.policy_id,
    policyHash: fact.policy_hash,
    policyRoot: fact.policy_root,
    policyEventRoot: fact.policy_event_root,
    requiredApprovals: fact.required_approvals,
    allowedReviewerRoles: fact.allowed_reviewer_roles,
    evidenceIds: fact.evidence_ids,
    evidenceRegistrationRoots: fact.evidence_registration_roots,
    evidenceFinalDecisionIds: fact.evidence_final_decision_ids,
    evidenceFinalDecisionRoots: fact.evidence_final_decision_roots,
    evidenceFinalVerificationRoots: fact.evidence_final_verification_roots,
    evidenceRoot: fact.evidence_root,
    finalDecisionRoot: fact.final_decision_root,
    monitoringEventIds: fact.monitoring_event_ids,
    monitoringRoots: fact.monitoring_roots,
    monitoringRoot: fact.monitoring_root,
    contributorIds: fact.contributor_ids,
    sourceActorIds: fact.source_actor_ids,
    publicLocation: fact.public_location,
    confidenceScore: fact.confidence_score,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    authorityRoot: fact.authority_root,
    derivedBy: mapVerificationActorSnapshot(fact.derived_by_snapshot),
    derivedAt: fact.derived_at.toISOString(),
    commandHash: fact.command_hash,
    candidateHash: fact.candidate_hash,
    candidateRoot: fact.candidate_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEnvironmentalProofApproval(row: unknown): CanopyProofEnvironmentalProofCandidateApproval {
  const parsed = environmentalProofApprovalRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.candidate_sequence ||
    auditEvent.entityType !== "environmental_proof_candidate_approval" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.approver_id
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_candidate_approval",
    id: fact.id,
    candidateId: fact.candidate_id,
    candidateRoot: fact.candidate_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    policyId: fact.policy_id,
    policyHash: fact.policy_hash,
    ...(fact.prior_approval_id && fact.prior_approval_root
      ? { priorApprovalId: fact.prior_approval_id, priorApprovalRoot: fact.prior_approval_root }
      : {}),
    decision: fact.decision,
    rationale: fact.rationale,
    conflictDisclosure: fact.conflict_disclosure,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    approver: mapVerificationActorSnapshot(fact.approver_snapshot),
    decidedAt: fact.decided_at.toISOString(),
    commandHash: fact.command_hash,
    candidateSequence: fact.candidate_sequence,
    previousEventRoot: fact.previous_event_root,
    approvalHash: fact.approval_hash,
    approvalRoot: fact.approval_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEnvironmentalProofRecord(row: unknown): CanopyProofEnvironmentalProofRecord {
  const parsed = environmentalProofRecordRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.candidate_sequence ||
    auditEvent.entityType !== "environmental_proof_record" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.issuer_id ||
    auditEvent.action !== "FULFILL"
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_record",
    id: fact.id,
    recordType: fact.record_type,
    candidateId: fact.candidate_id,
    candidateRoot: fact.candidate_root,
    authorityRoot: fact.authority_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    projectRoot: fact.project_root,
    methodologyId: fact.methodology_id,
    methodologyHash: fact.methodology_hash,
    methodologyPublicationId: fact.methodology_publication_id,
    methodologyPublicationRoot: fact.methodology_publication_root,
    policyId: fact.policy_id,
    policyRoot: fact.policy_root,
    evidenceIds: fact.evidence_ids,
    evidenceRoot: fact.evidence_root,
    evidenceFinalDecisionIds: fact.evidence_final_decision_ids,
    evidenceFinalDecisionRoots: fact.evidence_final_decision_roots,
    monitoringEventIds: fact.monitoring_event_ids,
    monitoringRoot: fact.monitoring_root,
    contributorIds: fact.contributor_ids,
    publicLocation: fact.public_location,
    confidenceScore: fact.confidence_score,
    governanceApprovalIds: fact.governance_approval_ids,
    governanceApprovalRoots: fact.governance_approval_roots,
    governanceQuorumRoot: fact.governance_quorum_root,
    issuer: mapVerificationActorSnapshot(fact.issuer_snapshot),
    rationale: fact.rationale,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    issuedAt: fact.issued_at.toISOString(),
    commandHash: fact.command_hash,
    candidateSequence: fact.candidate_sequence,
    previousEventRoot: fact.previous_event_root,
    recordHash: fact.record_hash,
    recordRoot: fact.record_root,
    status: fact.status,
    claimBoundary: fact.claim_boundary,
    auditEvent,
  };
}

function mapEnvironmentalProofChallenge(row: unknown): CanopyProofEnvironmentalProofChallenge {
  const parsed = environmentalProofChallengeRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.record_sequence ||
    auditEvent.entityType !== "environmental_proof_challenge" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.challenger_id ||
    auditEvent.action !== "CHALLENGE"
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_challenge",
    id: fact.id,
    recordId: fact.record_id,
    recordRoot: fact.record_root,
    candidateId: fact.candidate_id,
    candidateRoot: fact.candidate_root,
    authorityRoot: fact.authority_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    policyId: fact.policy_id,
    policyHash: fact.policy_hash,
    policyRoot: fact.policy_root,
    challengedRecordState: fact.challenged_record_state,
    challengedRecordProjectionRoot: fact.challenged_record_projection_root,
    challengedSourceAuthorityCurrent: fact.challenged_source_authority_current,
    challengedCurrentAuthorityRoot: fact.challenged_current_authority_root,
    ...(fact.prior_challenge_id && fact.prior_resolution_id && fact.prior_resolution_root
      ? {
          priorChallengeId: fact.prior_challenge_id,
          priorResolutionId: fact.prior_resolution_id,
          priorResolutionRoot: fact.prior_resolution_root,
        }
      : {}),
    reason: fact.reason,
    severity: fact.severity,
    rationale: fact.rationale,
    supportingArtifactHashes: fact.supporting_artifact_hashes,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    challenger: mapVerificationActorSnapshot(fact.challenger_snapshot),
    challengerOrganizationId: fact.challenger_organization_id,
    openedAt: fact.opened_at.toISOString(),
    commandHash: fact.command_hash,
    recordSequence: fact.record_sequence,
    previousEventRoot: fact.previous_event_root,
    challengeHash: fact.challenge_hash,
    challengeRoot: fact.challenge_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEnvironmentalProofChallengeRisk(row: unknown): CanopyProofEnvironmentalProofChallengeRiskSignal {
  const parsed = environmentalProofChallengeRiskRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.record_sequence ||
    auditEvent.entityType !== "environmental_proof_challenge_risk" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.detected_by_id ||
    auditEvent.action !== "ASSERT"
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_challenge_risk",
    id: fact.id,
    challengeId: fact.challenge_id,
    challengeRoot: fact.challenge_root,
    recordId: fact.record_id,
    recordRoot: fact.record_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    reason: fact.reason,
    riskLevel: fact.risk_level,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    detectedBy: mapVerificationActorSnapshot(fact.detected_by_snapshot),
    detectedAt: fact.detected_at.toISOString(),
    recordSequence: fact.record_sequence,
    previousEventRoot: fact.previous_event_root,
    riskHash: fact.risk_hash,
    riskRoot: fact.risk_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEnvironmentalProofChallengeReview(row: unknown): CanopyProofEnvironmentalProofChallengeReview {
  const parsed = environmentalProofChallengeReviewRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.record_sequence ||
    auditEvent.entityType !== "environmental_proof_challenge_review" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.reviewer_id ||
    auditEvent.action !== (fact.decision === "uphold" ? "CHALLENGE" : "REASON")
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_challenge_review",
    id: fact.id,
    challengeId: fact.challenge_id,
    challengeRoot: fact.challenge_root,
    riskSignalId: fact.risk_signal_id,
    riskRoot: fact.risk_root,
    recordId: fact.record_id,
    recordRoot: fact.record_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    policyId: fact.policy_id,
    policyHash: fact.policy_hash,
    policyRoot: fact.policy_root,
    ...(fact.prior_review_id && fact.prior_review_root
      ? { priorReviewId: fact.prior_review_id, priorReviewRoot: fact.prior_review_root }
      : {}),
    decision: fact.decision,
    rationale: fact.rationale,
    conflictDisclosure: fact.conflict_disclosure,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    reviewer: mapVerificationActorSnapshot(fact.reviewer_snapshot),
    reviewedAt: fact.reviewed_at.toISOString(),
    commandHash: fact.command_hash,
    recordSequence: fact.record_sequence,
    previousEventRoot: fact.previous_event_root,
    reviewHash: fact.review_hash,
    reviewRoot: fact.review_root,
    safety: fact.safety,
    auditEvent,
  };
}

function mapEnvironmentalProofChallengeResolution(
  row: unknown,
): CanopyProofEnvironmentalProofChallengeResolution {
  const parsed = environmentalProofChallengeResolutionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const fact = parsed.data;
  const auditEvent = mapJoinedAuditEvent(fact);
  if (
    fact.audit_event_root !== auditEvent.eventRoot ||
    fact.semantic_event_sequence_no !== fact.record_sequence ||
    auditEvent.entityType !== "environmental_proof_challenge_resolution" ||
    auditEvent.entityId !== fact.id ||
    auditEvent.actor !== fact.resolver_id ||
    auditEvent.action !== (fact.decision === "uphold" ? "CHALLENGE" : "FULFILL")
  ) {
    throw unavailable();
  }
  return {
    factType: "environmental_proof_challenge_resolution",
    id: fact.id,
    challengeId: fact.challenge_id,
    challengeRoot: fact.challenge_root,
    riskSignalId: fact.risk_signal_id,
    riskRoot: fact.risk_root,
    recordId: fact.record_id,
    recordRoot: fact.record_root,
    organizationId: fact.organization_id,
    projectId: fact.project_id,
    policyId: fact.policy_id,
    policyHash: fact.policy_hash,
    policyRoot: fact.policy_root,
    reviewIds: fact.review_ids,
    reviewRoots: fact.review_roots,
    reviewQuorumRoot: fact.review_quorum_root,
    decision: fact.decision,
    rationale: fact.rationale,
    limitations: fact.limitations,
    sourceEventRoots: fact.source_event_roots,
    sourceRoot: fact.source_root,
    resolver: mapVerificationActorSnapshot(fact.resolver_snapshot),
    resolvedAt: fact.resolved_at.toISOString(),
    commandHash: fact.command_hash,
    recordSequence: fact.record_sequence,
    previousEventRoot: fact.previous_event_root,
    resolutionHash: fact.resolution_hash,
    resolutionRoot: fact.resolution_root,
    safety: fact.safety,
    auditEvent,
  };
}

function actorInput(actor: CanopyProofVerificationActorSnapshot) {
  return {
    id: actor.id,
    participantType: actor.participantType,
    role: actor.role,
    verificationStatus: actor.verificationStatus,
    organizationId: actor.organizationId,
    organizationVerificationStatus: actor.organizationVerificationStatus,
    participantRoot: actor.participantRoot,
    organizationRoot: actor.organizationRoot,
    ...(actor.membershipId ? { membershipId: actor.membershipId } : {}),
    ...(actor.membershipStatus ? { membershipStatus: actor.membershipStatus } : {}),
    ...(actor.membershipRoot ? { membershipRoot: actor.membershipRoot } : {}),
    ...(actor.accreditationId ? { accreditationId: actor.accreditationId } : {}),
    ...(actor.accreditationStatus ? { accreditationStatus: actor.accreditationStatus } : {}),
    ...(actor.accreditationRoot ? { accreditationRoot: actor.accreditationRoot } : {}),
    accreditationScope: actor.accreditationScope,
  };
}

function mapVerificationActorSnapshot(
  actor: z.infer<typeof verificationActorSnapshotRowSchema>,
): CanopyProofVerificationActorSnapshot {
  return {
    id: actor.id,
    participantType: actor.participantType,
    role: actor.role,
    verificationStatus: actor.verificationStatus,
    organizationId: actor.organizationId,
    organizationVerificationStatus: actor.organizationVerificationStatus,
    participantRoot: actor.participantRoot,
    organizationRoot: actor.organizationRoot,
    ...(actor.membershipId ? { membershipId: actor.membershipId } : {}),
    ...(actor.membershipStatus ? { membershipStatus: actor.membershipStatus } : {}),
    ...(actor.membershipRoot ? { membershipRoot: actor.membershipRoot } : {}),
    ...(actor.accreditationId ? { accreditationId: actor.accreditationId } : {}),
    ...(actor.accreditationStatus ? { accreditationStatus: actor.accreditationStatus } : {}),
    ...(actor.accreditationRoot ? { accreditationRoot: actor.accreditationRoot } : {}),
    accreditationScope: actor.accreditationScope,
    authorityRoot: actor.authorityRoot,
  };
}

function mapProjectRegistration(row: unknown): CanopyProofProjectProfile {
  const parsed = projectRegistrationRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const project = parsed.data;
  const auditEvent = mapJoinedAuditEvent(project);
  if (
    project.audit_event_root !== auditEvent.eventRoot ||
    project.updated_at.toISOString() !== project.created_at.toISOString()
  ) {
    throw unavailable();
  }
  return {
    id: project.id,
    organizationId: project.organization_id,
    title: project.title,
    projectType: project.project_type,
    regionId: project.region_id,
    location: {
      latitude: project.location.latitude,
      longitude: project.location.longitude,
      areaHectares: project.location.areaHectares,
      ...(project.location.boundaryHash ? { boundaryHash: project.location.boundaryHash } : {}),
    },
    targetTreeCount: project.target_tree_count,
    biodiversityIndicators: project.biodiversity_indicators,
    waterIndicators: project.water_indicators,
    climateRiskIndicators: project.climate_risk_indicators,
    monitoringCadenceDays: project.monitoring_cadence_days,
    ...(project.governance_policy_id ? { governancePolicyId: project.governance_policy_id } : {}),
    status: project.status,
    createdAt: project.created_at.toISOString(),
    updatedAt: project.updated_at.toISOString(),
    createdBy: project.created_by,
    createdByRole: project.created_by_role,
    projectHash: project.project_hash,
    projectRoot: project.project_root,
    auditHistory: [auditEvent],
    claimBoundary: project.claim_boundary satisfies CanopyProofProjectClaimBoundary,
  };
}

function mapProjectStatusTransition(row: unknown): CanopyProofProjectStatusTransition {
  const parsed = projectStatusTransitionRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const transition = parsed.data;
  const auditEvent = mapJoinedAuditEvent(transition);
  if (transition.audit_event_root !== auditEvent.eventRoot) throw unavailable();
  return {
    id: transition.id,
    projectId: transition.project_id,
    organizationId: transition.organization_id,
    previousStatus: transition.previous_status,
    status: transition.status,
    previousProjectRoot: transition.previous_project_root,
    ...(transition.governance_approval_id ? { governanceApprovalId: transition.governance_approval_id } : {}),
    rationale: transition.rationale,
    updatedBy: transition.updated_by,
    updaterRole: transition.updater_role,
    updatedAt: transition.updated_at.toISOString(),
    transitionHash: transition.transition_hash,
    transitionRoot: transition.transition_root,
    auditEvent,
  };
}

function mapProjectMonitoringEvent(row: unknown): CanopyProofProjectMonitoringEvent {
  const parsed = projectMonitoringRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  const monitoring = parsed.data;
  const auditEvent = mapJoinedAuditEvent(monitoring);
  if (monitoring.audit_event_root !== auditEvent.eventRoot) throw unavailable();
  return {
    id: monitoring.id,
    projectId: monitoring.project_id,
    organizationId: monitoring.organization_id,
    eventType: monitoring.event_type,
    observedAt: monitoring.observed_at.toISOString(),
    observedBy: monitoring.observed_by,
    observerRole: monitoring.observer_role,
    previousStatus: monitoring.previous_status,
    projectStatus: monitoring.project_status,
    previousProjectRoot: monitoring.previous_project_root,
    evidenceIds: monitoring.evidence_ids,
    terraSceneIds: monitoring.terra_scene_ids,
    biodiversityIndicators: monitoring.biodiversity_indicators,
    waterIndicators: monitoring.water_indicators,
    climateRiskIndicators: monitoring.climate_risk_indicators,
    metrics: monitoring.metrics,
    state: monitoring.state,
    rationale: monitoring.rationale,
    eventHash: monitoring.event_hash,
    monitoringRoot: monitoring.monitoring_root,
    auditEvent,
  };
}

function mapDocument(row: unknown): CanopyProofOrganizationDocument {
  const parsed = documentRowSchema.safeParse(row);
  if (!parsed.success) throw unavailable();
  return {
    documentId: parsed.data.id,
    documentType: parsed.data.document_type,
    documentHash: parsed.data.document_hash,
    ...(parsed.data.issued_by ? { issuedBy: parsed.data.issued_by } : {}),
    uploadedAt: parsed.data.uploaded_at.toISOString(),
  };
}

function commandResult<T>(
  value: T,
  resultEntityType: string,
  resultEntityId: string,
  responseHash: string,
  auditEvent: CanopyProofAuditEvent | undefined,
): CommandResult<T> {
  if (!auditEvent) throw unavailable();
  return {
    value,
    resultEntityType,
    resultEntityId,
    responseHash: normalizeHash(responseHash),
    auditEventRoot: auditEvent.eventRoot,
    createdAt: auditEvent.createdAt,
  };
}

function revalidateStoredObjectReceipt(
  intent: CanopyProofEvidenceMediaUploadIntentFact,
  receipt: CanopyProofAdapterVerifiedStoredObjectReceipt,
) {
  const { providerVerificationRoot, ...providerReceipt } = receipt;
  const validated = validateCanopyProofStoredObjectReceipt(intent, providerReceipt, {
    now: receipt.verifiedAt,
    provider: receipt.provider,
    providerNamespace: receipt.providerNamespace,
    maximumClockSkewSeconds: 0,
  });
  if (
    validated.providerReceiptHash !== receipt.providerReceiptHash ||
    validated.providerVerificationRoot !== providerVerificationRoot
  ) {
    throw new Error("CANOPYPROOF_E2A_PROVIDER_RECEIPT_REVALIDATION_FAILED");
  }
}

function providerReceiptToObjectInput(receipt: CanopyProofStoredObjectReceipt) {
  return {
    intentId: receipt.intentId,
    storageProvider: receipt.provider,
    providerNamespace: receipt.providerNamespace,
    objectVersion: receipt.objectVersion,
    contentHash: receipt.contentHash,
    byteLength: receipt.byteLength,
    etagHash: receipt.etagHash,
    providerReceiptHash: receipt.providerReceiptHash,
    providerVerificationState: "modeled_only" as const,
    encryptionMode: receipt.encryptionMode,
    ...(receipt.encryptionKeyRef ? { encryptionKeyRef: receipt.encryptionKeyRef } : {}),
    objectLockMode: receipt.objectLockMode,
    ...(receipt.retainUntil ? { retainUntil: receipt.retainUntil } : {}),
    storedAt: receipt.uploadedAt,
  };
}

function scannerReceiptToScanInput(receipt: CanopyProofDurableMalwareScanReceipt) {
  return {
    objectId: receipt.objectId,
    scannerName: receipt.scannerName,
    scannerVersion: receipt.scannerVersion,
    scannerImageDigest: receipt.scannerImageDigest,
    signatureDatabaseVersion: receipt.signatureDatabaseVersion,
    verdict: receipt.verdict,
    findingHashes: [...receipt.findingHashes],
    providerReceiptHash: receipt.receiptHash,
    providerVerificationState: "modeled_only" as const,
    scannedAt: receipt.scannedAt,
  };
}

function requireLastAuditEvent(history: readonly CanopyProofAuditEvent[]) {
  const event = history.at(-1);
  if (!event) throw unavailable();
  return event;
}

function requireIdempotencyKey(value: string) {
  const normalized = value.trim();
  const containsControlCharacter = [...normalized].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (normalized.length < 8 || normalized.length > 256 || containsControlCharacter) {
    throw new CanopyProofTrustRegistryError("CANOPYPROOF_IDEMPOTENCY_REQUIRED", 400);
  }
  return normalized;
}

function withTimestamp(input: unknown, field: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Readonly<Record<string, unknown>>;
  if (!(field in record)) return { ...record, [field]: new Date().toISOString() };
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) return input;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? { ...record, [field]: timestamp.toISOString() } : input;
}

function optionalStringField(input: unknown, field: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = (input as Readonly<Record<string, unknown>>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textArray(values: readonly string[]) {
  return values.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
}

function jsonValue(value: unknown) {
  return Prisma.sql`${JSON.stringify(value)}::jsonb`;
}

function asDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("CanopyProof trust command timestamp is invalid.");
  return parsed;
}

function normalizeHash(value: string) {
  return /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : hashJson(value);
}

function idRow(value: unknown) {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(value);
  if (!parsed.success) throw unavailable();
  return parsed.data.id;
}

function hydratePartnerAuthoritySnapshot(snapshot: CanopyProofPartnerAuthoritySnapshot) {
  try {
    return CanopyProofPartnerService.fromAuthoritySnapshot(snapshot);
  } catch (error) {
    if (error instanceof CanopyProofTrustRegistryError) throw error;
    throw unavailable();
  }
}

function hydrateProjectAuthoritySnapshot(snapshot: CanopyProofProjectAuthoritySnapshot) {
  try {
    return CanopyProofProjectRegistryService.fromAuthoritySnapshot(snapshot);
  } catch (error) {
    if (error instanceof CanopyProofTrustRegistryError) throw error;
    throw unavailable();
  }
}

function hydrateEvidenceAuthoritySnapshot(snapshot: CanopyProofEvidenceAuthoritySnapshot) {
  try {
    return CanopyProofEvidenceRegistryService.fromAuthoritySnapshot(snapshot);
  } catch (error) {
    if (error instanceof CanopyProofTrustRegistryError) throw error;
    throw unavailable();
  }
}

function evidenceRegistrationResult(evidence: CanopyProofEvidenceRegistration) {
  return {
    valid: evidence.verification_status === "validated",
    issues: evidence.validationIssues,
    evidence,
  } as const;
}

function boundedProjectReadLimit(value: number | undefined) {
  const limit = value ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("CanopyProof project read limit must be an integer between 1 and 100.");
  }
  return limit;
}

function boundedEvidenceReadLimit(value: number | undefined) {
  const limit = value ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("CanopyProof evidence read limit must be an integer between 1 and 100.");
  }
  return limit;
}

function publicDataAccessAccountabilityDisclosureSafetyBoundary() {
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

function hydrateAuditExportManifestSnapshot(manifests: readonly CanopyProofAuditExportManifest[]) {
  try {
    return CanopyProofAuditExportManifestService.fromAuthoritySnapshot({ manifests });
  } catch (error) {
    if (error instanceof CanopyProofTrustRegistryError) throw error;
    throw unavailable();
  }
}

function evidenceCustodyStreamId(subjectId: string) {
  return `evidence-custody:${subjectId}`;
}

function evidenceCustodyFenceId(subjectId: string) {
  return evidenceCustodyStreamId(subjectId);
}

function projectAuthorityFenceId(projectId: string) {
  return `project:${projectId}`;
}

function evidenceMediaStreamId(evidenceId: string) {
  return `evidence-media:${evidenceId}`;
}

function evidenceMediaAdapterStreamId(evidenceId: string) {
  return `evidence-media-adapter:${evidenceId}`;
}

function assertEvidenceCustodyOrganization(actualOrganizationId: string, expectedOrganizationId: string) {
  if (actualOrganizationId !== expectedOrganizationId) {
    throw new Error("CanopyProof evidence custody organization scope mismatch.");
  }
}

function governedPolicyStreamId(subject: CanopyProofGovernedPolicySubject) {
  return `governed_policy:${subject}`;
}

function methodologyVersionStreamId() {
  return "methodology_versions";
}

function requireObjectString(input: unknown, field: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`CanopyProof trust command requires ${field}.`);
  }
  const value = Reflect.get(input, field);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`CanopyProof trust command requires ${field}.`);
  }
  return value.trim();
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw unavailable();
}

function conflict() {
  return new CanopyProofTrustRegistryError("CANOPYPROOF_TRUST_REGISTRY_CONFLICT", 409);
}

function isDataSharingAgreementStateConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /already|revoked|superseded|expired|successor data-sharing agreement exists/i.test(error.message);
}

function isDataAccessRequestStateConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /cannot transition|already|current state|predecessor|expired request|active data-sharing agreement/i.test(error.message);
}

function isDataAccessDeliveryStateConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /approved data access request|revoked|superseded|expired|currently restricted|already exists/i.test(error.message);
}

function isDataUseAttestationStateConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /within-scope data use|currently restricted|already exists|named delivery recipient|expired data-sharing agreement/i.test(error.message);
}

function isDataUseEnforcementCaseStateConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /challenged or revocation-requested|independent human reviewer|cannot predate|retain every challenged|not valid for state|already exists/i.test(
    error.message,
  );
}

function isDataAccessRestrictionStateConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /separate independent approval|cannot predate|expiry|retain every enforcement|enforcement disposition|active prior restriction|prior restriction decision|state transition|already exists|current semantic state/i.test(
    error.message,
  );
}

function unavailable() {
  return new CanopyProofTrustRegistryError("CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE", 503);
}

function normalizeVisualAuthorityScope(scope: VisualAuthorityScope): VisualAuthorityScope {
  const tenantId = scope.tenantId.trim();
  const organizationId = scope.organizationId.trim();
  const projectId = scope.projectId?.trim();
  if (!tenantId || !organizationId) {
    throw new Error("CanopyProof visual authority requires tenant and organization scope.");
  }
  return {
    tenantId,
    organizationId,
    ...(projectId ? { projectId } : {}),
  };
}

function visualAuthorityStreamId(scope: VisualAuthorityScope) {
  return `visual:${hashJson({
    kind: "canopyproof-visual-authority-stream-v1",
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    projectId: scope.projectId ?? null,
  })}`;
}

function visualRecordType(record: VisualRecordEnvelope): VisualSqlRecordType {
  const recordType = (record as VisualRecordEnvelope & { readonly recordType?: unknown }).recordType;
  if (typeof recordType !== "string" || !(recordType in visualSqlEntityTypeByRecordType)) {
    throw new Error(`CanopyProof visual record type is unsupported for ${record.id}.`);
  }
  return recordType as VisualSqlRecordType;
}

function visualRecordStorageKey(record: VisualRecordEnvelope) {
  return `${visualRecordType(record)}\u0000${record.id}\u0000${record.version}`;
}

function assertVisualSnapshotScope(
  snapshot: CanopyProofVisualEvidenceAuthoritySnapshot,
  scope: VisualAuthorityScope,
) {
  const records = visualAuthorityRecords(snapshot);
  if (records.length === 0) throw new Error("CanopyProof visual authority snapshot cannot be empty.");
  for (const record of records) {
    if (
      record.tenantId !== scope.tenantId ||
      record.organizationId !== scope.organizationId ||
      record.projectId !== scope.projectId
    ) {
      throw new Error(`CanopyProof visual authority scope mismatch for ${record.id}.`);
    }
  }
}

function visualAuthorityDelta(
  current: CanopyProofVisualEvidenceAuthoritySnapshot | undefined,
  incoming: CanopyProofVisualEvidenceAuthoritySnapshot,
): readonly VisualRecordEnvelope[] {
  const incomingRecords = visualAuthorityRecords(incoming);
  const incomingByKey = new Map(incomingRecords.map((record) => [visualRecordStorageKey(record), record] as const));
  const incomingByAuditId = new Map(incomingRecords.map((record) => [record.auditEvent.id, record] as const));
  const currentRecords = current ? visualAuthorityRecords(current) : [];
  for (const record of currentRecords) {
    const candidate = incomingByKey.get(visualRecordStorageKey(record));
    if (!candidate || hashJson(candidate) !== hashJson(record)) {
      throw conflict();
    }
  }

  const currentAudit = current?.auditHistory ?? [];
  if (currentAudit.length > incoming.auditHistory.length) throw conflict();
  for (const [index, event] of currentAudit.entries()) {
    if (hashJson(event) !== hashJson(incoming.auditHistory[index])) throw conflict();
  }

  const currentKeys = new Set(currentRecords.map((record) => visualRecordStorageKey(record)));
  const deltaByKey = new Map(
    incomingRecords
      .filter((record) => !currentKeys.has(visualRecordStorageKey(record)))
      .map((record) => [visualRecordStorageKey(record), record] as const),
  );
  const orderedDelta: VisualRecordEnvelope[] = [];
  for (const event of incoming.auditHistory.slice(currentAudit.length)) {
    const record = incomingByAuditId.get(event.id);
    if (!record || !deltaByKey.delete(visualRecordStorageKey(record))) throw conflict();
    orderedDelta.push(record);
  }
  if (deltaByKey.size > 0 || orderedDelta.length !== incoming.auditHistory.length - currentAudit.length) {
    throw conflict();
  }
  return orderedDelta;
}

function isPrismaConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || prismaDatabaseCode(error) === "23505")
  );
}

function isPrismaProjectConstraintConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const databaseCode = prismaDatabaseCode(error);
  return (databaseCode === "23503" || databaseCode === "23514") && prismaErrorMetadata(error).includes("project");
}

function isPrismaEvidenceConstraintConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const databaseCode = prismaDatabaseCode(error);
  return (databaseCode === "23503" || databaseCode === "23514") && prismaErrorMetadata(error).includes("evidence");
}

function prismaDatabaseCode(error: Prisma.PrismaClientKnownRequestError) {
  if (!error.meta || typeof error.meta !== "object") return undefined;
  const code = Reflect.get(error.meta, "code");
  return typeof code === "string" ? code : undefined;
}

function prismaErrorMetadata(error: Prisma.PrismaClientKnownRequestError) {
  try {
    return JSON.stringify(error.meta ?? {}).toLowerCase();
  } catch {
    return "";
  }
}

function isPrismaFailure(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError
  );
}
