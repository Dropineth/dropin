import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  CanopyProofEvidenceRegistryService,
  type CanopyProofEvidenceRegistration,
} from "./evidence-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyAiCapabilities,
  type CanopyAiCapability,
  type CanopyProofAhinAction,
  type CanopyProofAuditEvent,
  type CanopyProofRiskLevel,
} from "./proof-engine.js";

export const canopyProofValidationOutcomes = ["pass", "needs_review", "blocked"] as const;
export const canopyProofValidationCheckStates = ["pass", "needs_review", "blocked"] as const;
export const canopyProofAiRecommendations = ["needs_human_review", "rejected"] as const;
export const canopyProofHumanReviewDecisions = ["approve", "reject", "challenge", "request_changes"] as const;
export const canopyProofFindingDispositions = ["accepted", "overruled", "escalated"] as const;
export const canopyProofEvidenceChallengeReasons = [
  "fake_evidence",
  "duplicate_evidence",
  "gps_spoofing",
  "satellite_contradiction",
  "device_attestation_failure",
  "methodology_gap",
  "provenance_gap",
  "privacy_risk",
  "unsafe_claim",
  "other",
] as const;
export const canopyProofEvidenceChallengeSeverities = ["low", "medium", "high", "critical"] as const;
export const canopyProofEvidenceChallengeResolutionDecisions = [
  "upheld",
  "dismissed",
  "needs_more_evidence",
] as const;
export const canopyProofEvidenceCorrectionActions = ["withdraw", "supersede"] as const;
export const canopyProofEvidenceFinalDecisionKinds = ["verify", "reject", "request_changes"] as const;
export const canopyProofEvidenceFinalVerificationStates = [
  "not_decided",
  "verified",
  "rejected",
  "changes_requested",
  "stale",
] as const;
export const canopyProofEvidenceRelianceStates = [
  "registered",
  "validation_passed",
  "needs_review",
  "blocked",
  "ai_advised",
  "approved",
  "rejected",
  "challenged",
  "changes_requested",
  "correction_required",
  "withdrawn",
  "superseded",
] as const;

export type CanopyProofValidationOutcome = (typeof canopyProofValidationOutcomes)[number];
export type CanopyProofValidationCheckState = (typeof canopyProofValidationCheckStates)[number];
export type CanopyProofAiRecommendation = (typeof canopyProofAiRecommendations)[number];
export type CanopyProofHumanReviewDecision = (typeof canopyProofHumanReviewDecisions)[number];
export type CanopyProofFindingDisposition = (typeof canopyProofFindingDispositions)[number];
export type CanopyProofEvidenceChallengeReason = (typeof canopyProofEvidenceChallengeReasons)[number];
export type CanopyProofEvidenceChallengeSeverity = (typeof canopyProofEvidenceChallengeSeverities)[number];
export type CanopyProofEvidenceChallengeResolutionDecision =
  (typeof canopyProofEvidenceChallengeResolutionDecisions)[number];
export type CanopyProofEvidenceCorrectionAction = (typeof canopyProofEvidenceCorrectionActions)[number];
export type CanopyProofEvidenceFinalDecisionKind = (typeof canopyProofEvidenceFinalDecisionKinds)[number];
export type CanopyProofEvidenceFinalVerificationState =
  (typeof canopyProofEvidenceFinalVerificationStates)[number];
export type CanopyProofEvidenceRelianceState = (typeof canopyProofEvidenceRelianceStates)[number];

export type CanopyProofVerificationActorSnapshot = {
  readonly id: string;
  readonly participantType: "human" | "agent";
  readonly role: "agent" | "owner" | "admin" | "verifier" | "researcher";
  readonly verificationStatus: "verified";
  readonly organizationId: string;
  readonly organizationVerificationStatus: "verified";
  readonly participantRoot: string;
  readonly organizationRoot: string;
  readonly membershipId?: string;
  readonly membershipStatus?: "active";
  readonly membershipRoot?: string;
  readonly accreditationId?: string;
  readonly accreditationStatus?: "approved" | "pending" | "suspended" | "revoked";
  readonly accreditationRoot?: string;
  readonly accreditationScope: readonly string[];
  readonly authorityRoot: string;
};

export type CanopyProofEvidenceValidationCheck = {
  readonly code:
    | "registration_integrity"
    | "project_status_eligible"
    | "structural_registration"
    | "location_accuracy"
    | "project_region_binding"
    | "minimum_confidence";
  readonly state: CanopyProofValidationCheckState;
  readonly detail: string;
};

export type CanopyProofEvidenceValidationRun = {
  readonly factType: "validation_run";
  readonly id: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly rulesetHash: string;
  readonly checks: readonly CanopyProofEvidenceValidationCheck[];
  readonly issues: readonly string[];
  readonly outcome: CanopyProofValidationOutcome;
  readonly confidenceScore: number;
  readonly executor: CanopyProofVerificationActorSnapshot;
  readonly executedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly validationHash: string;
  readonly validationRoot: string;
  readonly safety: CanopyProofVerificationSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofAdvisoryAiFinding = {
  readonly id: string;
  readonly capability: CanopyAiCapability;
  readonly severity: CanopyProofRiskLevel;
  readonly code: string;
  readonly message: string;
  readonly recommendedAction: Extract<CanopyProofAhinAction, "REASON" | "DELEGATE" | "CHALLENGE">;
  readonly sourceEventRoots: readonly string[];
  readonly findingHash: string;
};

export type CanopyProofAdvisoryAiAnalysis = {
  readonly factType: "ai_analysis";
  readonly id: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly validationRunId: string;
  readonly validationRoot: string;
  readonly agent: CanopyProofVerificationActorSnapshot;
  readonly modelProvider: string;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly modelArtifactHash: string;
  readonly promptHash: string;
  readonly datasetSnapshotRoots: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly executionEnvironment: string;
  readonly capabilities: readonly CanopyAiCapability[];
  readonly findings: readonly CanopyProofAdvisoryAiFinding[];
  readonly recommendation: CanopyProofAiRecommendation;
  readonly claimedConfidenceScore: number;
  readonly confidenceScore: number;
  readonly advisoryOnly: true;
  readonly analyzedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly analysisHash: string;
  readonly analysisRoot: string;
  readonly safety: CanopyProofVerificationSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofHumanFindingDisposition = {
  readonly analysisId: string;
  readonly findingId: string;
  readonly disposition: CanopyProofFindingDisposition;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly dispositionHash: string;
};

export type CanopyProofEvidenceHumanReview = {
  readonly factType: "human_review";
  readonly id: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly validationRunId: string;
  readonly validationRoot: string;
  readonly aiAnalysisIds: readonly string[];
  readonly aiAnalysisRoots: readonly string[];
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly decision: CanopyProofHumanReviewDecision;
  readonly findingDispositions: readonly CanopyProofHumanFindingDisposition[];
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly reviewedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly sourceRoot: string;
  readonly reviewHash: string;
  readonly reviewRoot: string;
  readonly safety: CanopyProofVerificationSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceChallenge = {
  readonly factType: "evidence_challenge";
  readonly id: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly challengedRelianceState: CanopyProofEvidenceRelianceState;
  readonly challengedRelianceRoot: string;
  readonly challengedTerminalEventRoot: string;
  readonly challengedValidationRunId?: string;
  readonly challengedValidationRoot?: string;
  readonly challengedAiAnalysisIds: readonly string[];
  readonly challengedAiAnalysisRoots: readonly string[];
  readonly challengedHumanReviewId?: string;
  readonly challengedHumanReviewRoot?: string;
  readonly reason: CanopyProofEvidenceChallengeReason;
  readonly severity: CanopyProofEvidenceChallengeSeverity;
  readonly rationale: string;
  readonly supportingArtifactHashes: readonly string[];
  readonly evidenceEventRoots: readonly string[];
  readonly challenger: CanopyProofVerificationActorSnapshot;
  readonly challengedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly challengeHash: string;
  readonly challengeRoot: string;
  readonly safety: CanopyProofEvidenceChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceChallengeResolution = {
  readonly factType: "evidence_challenge_resolution";
  readonly id: string;
  readonly challengeId: string;
  readonly challengeRoot: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly previousResolutionId?: string;
  readonly previousResolutionRoot?: string;
  readonly decision: CanopyProofEvidenceChallengeResolutionDecision;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly evidenceEventRoots: readonly string[];
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly reviewedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly sourceRoot: string;
  readonly resolutionHash: string;
  readonly resolutionRoot: string;
  readonly safety: CanopyProofEvidenceChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceCorrection = {
  readonly factType: "evidence_correction";
  readonly id: string;
  readonly challengeId: string;
  readonly challengeRoot: string;
  readonly resolutionId: string;
  readonly resolutionRoot: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly action: CanopyProofEvidenceCorrectionAction;
  readonly replacementEvidenceId?: string;
  readonly replacementEvidenceRoot?: string;
  readonly replacementRelianceRoot?: string;
  readonly replacementTerminalEventRoot?: string;
  readonly rationale: string;
  readonly evidenceEventRoots: readonly string[];
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly correctedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly sourceRoot: string;
  readonly correctionHash: string;
  readonly correctionRoot: string;
  readonly safety: CanopyProofEvidenceChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceFinalDecision = {
  readonly factType: "evidence_final_decision";
  readonly id: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly evidenceRoot: string;
  readonly preDecisionRelianceState: CanopyProofEvidenceRelianceState;
  readonly preDecisionRelianceRoot: string;
  readonly preDecisionTerminalEventRoot: string;
  readonly validationRunId: string;
  readonly validationRoot: string;
  readonly aiAnalysisIds: readonly string[];
  readonly aiAnalysisRoots: readonly string[];
  readonly humanReviewId: string;
  readonly humanReviewRoot: string;
  readonly priorFinalDecisionId?: string;
  readonly priorFinalDecisionRoot?: string;
  readonly decision: CanopyProofEvidenceFinalDecisionKind;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly verifier: CanopyProofVerificationActorSnapshot;
  readonly decidedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly decisionHash: string;
  readonly decisionRoot: string;
  readonly safety: CanopyProofEvidenceFinalDecisionSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofVerificationSafetyBoundary = {
  readonly evidenceRegistrationImmutable: true;
  readonly aiAdvisoryOnly: true;
  readonly independentHumanApprovalRequired: true;
  readonly notFinalVerification: true;
  readonly notCertificate: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceChallengeSafetyBoundary = CanopyProofVerificationSafetyBoundary & {
  readonly factsAppendOnly: true;
  readonly originalEvidencePreserved: true;
  readonly challengeSuspendsReliance: true;
  readonly independentHumanResolutionRequired: true;
  readonly upheldChallengeRequiresCorrection: true;
  readonly replacementRequiresIndependentApproval: true;
  readonly crossOrganizationChallengeGrantsNoAccess: true;
};

export type CanopyProofEvidenceFinalDecisionSafetyBoundary = {
  readonly evidenceRegistrationImmutable: true;
  readonly aiAdvisoryOnly: true;
  readonly makerCheckerRequired: true;
  readonly currentAccreditedVerifierRequired: true;
  readonly challengeAwareRelianceBound: true;
  readonly laterFactsInvalidateDecision: true;
  readonly notEnvironmentalProofRecord: true;
  readonly notCertificate: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceFinalVerification = {
  readonly evidenceId: string;
  readonly evidenceRoot: string;
  readonly state: CanopyProofEvidenceFinalVerificationState;
  readonly latestDecisionId?: string;
  readonly latestDecisionRoot?: string;
  readonly currentDecisionId?: string;
  readonly currentDecisionRoot?: string;
  readonly terminalEventRoot: string;
  readonly evidenceSequence: number;
  readonly finalVerificationRoot: string;
  readonly safety: CanopyProofEvidenceFinalDecisionSafetyBoundary;
};

export type CanopyProofEvidenceReliance = {
  readonly evidenceId: string;
  readonly evidenceRoot: string;
  readonly state: CanopyProofEvidenceRelianceState;
  readonly latestValidationRunId?: string;
  readonly latestValidationRoot?: string;
  readonly currentAiAnalysisIds: readonly string[];
  readonly latestHumanReviewId?: string;
  readonly latestHumanReviewRoot?: string;
  readonly openChallengeIds: readonly string[];
  readonly upheldChallengeIds: readonly string[];
  readonly dismissedChallengeIds: readonly string[];
  readonly correctedChallengeIds: readonly string[];
  readonly latestCorrectionId?: string;
  readonly latestCorrectionRoot?: string;
  readonly replacementEvidenceId?: string;
  readonly terminalEventRoot: string;
  readonly evidenceSequence: number;
  readonly relianceRoot: string;
  readonly safety: CanopyProofVerificationSafetyBoundary;
};

export type CanopyProofEvidenceVerificationAuthoritySnapshot = {
  readonly registrations: readonly CanopyProofEvidenceRegistration[];
  readonly validationRuns: readonly CanopyProofEvidenceValidationRun[];
  readonly aiAnalyses: readonly CanopyProofAdvisoryAiAnalysis[];
  readonly humanReviews: readonly CanopyProofEvidenceHumanReview[];
  readonly challenges: readonly CanopyProofEvidenceChallenge[];
  readonly challengeResolutions: readonly CanopyProofEvidenceChallengeResolution[];
  readonly corrections: readonly CanopyProofEvidenceCorrection[];
  readonly finalDecisions: readonly CanopyProofEvidenceFinalDecision[];
};

export type CanopyProofEvidenceVerificationAuthorityStatus = {
  readonly service: "canopyproof-evidence-verification-authority";
  readonly evidenceCount: number;
  readonly validationRunCount: number;
  readonly aiAnalysisCount: number;
  readonly humanReviewCount: number;
  readonly challengeCount: number;
  readonly challengeResolutionCount: number;
  readonly correctionCount: number;
  readonly finalDecisionCount: number;
  readonly authorityRoot: string;
  readonly safety: CanopyProofVerificationSafetyBoundary & {
    readonly factsAppendOnly: true;
    readonly streamForksRejected: true;
    readonly latestCycleRequired: true;
    readonly aiFindingCherryPickingRejected: true;
  };
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const boundedIdentifierSchema = z.string().trim().min(1).max(240);
const boundedTextSchema = z.string().trim().min(1).max(2_000);

const actorSnapshotSchema = z
  .object({
    id: boundedIdentifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: boundedIdentifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: sha256Schema,
    organizationRoot: sha256Schema,
    membershipId: boundedIdentifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: sha256Schema.optional(),
    accreditationId: boundedIdentifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: sha256Schema.optional(),
    accreditationScope: z.array(z.string().trim().min(1).max(240)).max(32).default([]),
  })
  .strict();

const validationRunInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    rulesetId: z.literal("canopyproof-evidence-validation-core"),
    rulesetVersion: z.literal("1.0.0"),
    executedAt: z.string().datetime(),
  })
  .strict();

const aiFindingInputSchema = z
  .object({
    capability: z.enum(canopyAiCapabilities),
    severity: z.enum(["low", "medium", "high", "critical"]),
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{2,79}$/),
    message: boundedTextSchema,
    recommendedAction: z.enum(["REASON", "DELEGATE", "CHALLENGE"]),
    sourceEventRoots: z.array(sha256Schema).min(1).max(32),
  })
  .strict();

const aiAnalysisInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    validationRunId: boundedIdentifierSchema,
    modelProvider: z.string().trim().min(1).max(160),
    modelName: z.string().trim().min(1).max(160),
    modelVersion: z.string().trim().min(1).max(160),
    modelArtifactHash: sha256Schema,
    promptHash: sha256Schema,
    datasetSnapshotRoots: z.array(sha256Schema).min(1).max(64),
    sourceEventRoots: z.array(sha256Schema).min(2).max(64),
    executionEnvironment: z.string().trim().min(1).max(240),
    findings: z.array(aiFindingInputSchema).max(64),
    confidenceScore: z.number().int().min(0).max(100),
    analyzedAt: z.string().datetime(),
  })
  .strict();

const findingDispositionInputSchema = z
  .object({
    analysisId: boundedIdentifierSchema,
    findingId: boundedIdentifierSchema,
    disposition: z.enum(canopyProofFindingDispositions),
    rationale: z.string().trim().max(2_000).default(""),
    evidenceEventRoots: z.array(sha256Schema).max(32).default([]),
  })
  .strict();

const humanReviewInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    validationRunId: boundedIdentifierSchema,
    aiAnalysisIds: z.array(boundedIdentifierSchema).min(1).max(64),
    decision: z.enum(canopyProofHumanReviewDecisions),
    findingDispositions: z.array(findingDispositionInputSchema).max(256).default([]),
    rationale: z.string().trim().min(12).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    reviewedAt: z.string().datetime(),
  })
  .strict();

const evidenceChallengeInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    reason: z.enum(canopyProofEvidenceChallengeReasons),
    severity: z.enum(canopyProofEvidenceChallengeSeverities),
    rationale: z.string().trim().min(24).max(4_000),
    supportingArtifactHashes: z.array(sha256Schema).min(1).max(128),
    evidenceEventRoots: z.array(sha256Schema).min(1).max(128),
    challengedAt: z.string().datetime(),
  })
  .strict();

const evidenceChallengeResolutionInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    decision: z.enum(canopyProofEvidenceChallengeResolutionDecisions),
    rationale: z.string().trim().min(24).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    evidenceEventRoots: z.array(sha256Schema).min(1).max(128),
    reviewedAt: z.string().datetime(),
  })
  .strict();

const evidenceCorrectionInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    action: z.enum(canopyProofEvidenceCorrectionActions),
    replacementEvidenceId: boundedIdentifierSchema.optional(),
    rationale: z.string().trim().min(24).max(4_000),
    evidenceEventRoots: z.array(sha256Schema).min(1).max(128),
    correctedAt: z.string().datetime(),
  })
  .strict();

const evidenceFinalDecisionInputSchema = z
  .object({
    id: boundedIdentifierSchema.optional(),
    decision: z.enum(canopyProofEvidenceFinalDecisionKinds),
    rationale: z.string().trim().min(24).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(sha256Schema).min(1).max(256),
    decidedAt: z.string().datetime(),
  })
  .strict();

const validationRulesetDefinition = {
  id: "canopyproof-evidence-validation-core",
  version: "1.0.0",
  checks: [
    "registration_integrity",
    "project_status_eligible",
    "structural_registration",
    "location_accuracy",
    "project_region_binding",
    "minimum_confidence",
  ],
  blockedProjectStatuses: ["suspended", "archived"],
  reviewProjectStatuses: ["submitted", "under_review", "challenged"],
  maximumGpsAccuracyMeters: 100,
  minimumReviewConfidence: 10,
  passConfidence: 50,
} as const;

export const canopyProofEvidenceValidationRuleset = {
  ...validationRulesetDefinition,
  rulesetHash: hashJson({ kind: "canopyproof-evidence-validation-ruleset-v1", ...validationRulesetDefinition }),
} as const;

type VerificationFact =
  | CanopyProofEvidenceValidationRun
  | CanopyProofAdvisoryAiAnalysis
  | CanopyProofEvidenceHumanReview
  | CanopyProofEvidenceChallenge
  | CanopyProofEvidenceChallengeResolution
  | CanopyProofEvidenceCorrection
  | CanopyProofEvidenceFinalDecision;

type EvidenceStream = {
  readonly registration: CanopyProofEvidenceRegistration;
  readonly events: CanopyProofAuditEvent[];
  readonly validationRuns: CanopyProofEvidenceValidationRun[];
  readonly aiAnalyses: CanopyProofAdvisoryAiAnalysis[];
  readonly humanReviews: CanopyProofEvidenceHumanReview[];
  readonly challenges: CanopyProofEvidenceChallenge[];
  readonly challengeResolutions: CanopyProofEvidenceChallengeResolution[];
  readonly corrections: CanopyProofEvidenceCorrection[];
  readonly finalDecisions: CanopyProofEvidenceFinalDecision[];
};

export class CanopyProofEvidenceVerificationAuthorityService {
  private readonly streamsByEvidenceId = new Map<string, EvidenceStream>();
  private readonly validationRunsById = new Map<string, CanopyProofEvidenceValidationRun>();
  private readonly aiAnalysesById = new Map<string, CanopyProofAdvisoryAiAnalysis>();
  private readonly humanReviewsById = new Map<string, CanopyProofEvidenceHumanReview>();
  private readonly challengesById = new Map<string, CanopyProofEvidenceChallenge>();
  private readonly challengeResolutionsById = new Map<string, CanopyProofEvidenceChallengeResolution>();
  private readonly correctionsById = new Map<string, CanopyProofEvidenceCorrection>();
  private readonly finalDecisionsById = new Map<string, CanopyProofEvidenceFinalDecision>();

  constructor(registrations: readonly CanopyProofEvidenceRegistration[]) {
    const evidenceRegistry = CanopyProofEvidenceRegistryService.fromAuthoritySnapshot({ registrations });
    for (const registration of evidenceRegistry.listEvidence()) {
      this.streamsByEvidenceId.set(registration.id, {
        registration,
        events: [...registration.audit_history],
        validationRuns: [],
        aiAnalyses: [],
        humanReviews: [],
        challenges: [],
        challengeResolutions: [],
        corrections: [],
        finalDecisions: [],
      });
    }
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofEvidenceVerificationAuthoritySnapshot) {
    const service = new CanopyProofEvidenceVerificationAuthorityService(snapshot.registrations);
    const facts: VerificationFact[] = [
      ...snapshot.validationRuns,
      ...snapshot.aiAnalyses,
      ...snapshot.humanReviews,
      ...snapshot.challenges,
      ...snapshot.challengeResolutions,
      ...snapshot.corrections,
      ...snapshot.finalDecisions,
    ];
    const seenFactIds = new Set<string>();
    for (const fact of facts) {
      if (seenFactIds.has(fact.id)) {
        throw new Error(`CanopyProof verification snapshot contains duplicate fact id: ${fact.id}`);
      }
      seenFactIds.add(fact.id);
    }
    const ordered = [...facts].sort(
      (left, right) =>
        left.auditEvent.createdAt.localeCompare(right.auditEvent.createdAt) ||
        left.evidenceId.localeCompare(right.evidenceId) ||
        left.evidenceSequence - right.evidenceSequence ||
        left.id.localeCompare(right.id),
    );
    for (const fact of ordered) {
      const stream = service.requireStream(fact.evidenceId);
      const expectedSequence = stream.events.length + 1;
      const expectedPreviousRoot = service.terminalEventRoot(stream);
      if (fact.evidenceSequence !== expectedSequence) {
        throw new Error(
          `CanopyProof verification snapshot sequence gap or fork for ${fact.evidenceId}: expected ${expectedSequence}, received ${fact.evidenceSequence}`,
        );
      }
      if (fact.previousEventRoot !== expectedPreviousRoot || fact.auditEvent.previousRoot !== expectedPreviousRoot) {
        throw new Error(`CanopyProof verification snapshot predecessor root is invalid: ${fact.id}`);
      }
      const replayed = service.replayFact(fact);
      if (hashJson(replayed) !== hashJson(fact)) {
        throw new Error(`CanopyProof verification snapshot fact lineage is invalid: ${fact.id}`);
      }
    }
    return service;
  }

  runValidation(
    evidenceId: string,
    input: unknown,
    executorInput: unknown,
  ): CanopyProofEvidenceValidationRun {
    const stream = this.requireStream(evidenceId);
    const parsed = validationRunInputSchema.parse(input);
    const executor = normalizeActorSnapshot(executorInput);
    assertValidationExecutor(executor, stream.registration.organizationId);
    assertSafeVerificationText([parsed.id ?? "", executor.id, executor.organizationId]);
    assertAppendTime(stream, parsed.executedAt);

    const checks = deriveValidationChecks(stream.registration);
    const outcome = deriveValidationOutcome(checks);
    const issues = checks.filter((check) => check.state !== "pass").map((check) => check.code);
    const confidenceScore = deriveValidationConfidence(stream.registration.confidence_score, outcome);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-validation-command-v1",
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      rulesetId: parsed.rulesetId,
      rulesetVersion: parsed.rulesetVersion,
      rulesetHash: canopyProofEvidenceValidationRuleset.rulesetHash,
      executor,
      executedAt: parsed.executedAt,
    });
    const canonicalId = `cp_validation_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof validation run id does not match its canonical command hash.");
    }
    const id = canonicalId;
    const existing = this.validationRunsById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof validation run already exists with conflicting payload: ${id}`);
    }
    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const seed = {
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      rulesetId: parsed.rulesetId,
      rulesetVersion: parsed.rulesetVersion,
      rulesetHash: canopyProofEvidenceValidationRuleset.rulesetHash,
      checks,
      issues,
      outcome,
      confidenceScore,
      executor,
      executedAt: parsed.executedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
    };
    const validationHash = hashJson({ kind: "canopyproof-evidence-validation-run-v1", ...seed });
    const validationRoot = hashJson({
      kind: "canopyproof-evidence-validation-root-v1",
      evidenceRoot: stream.registration.evidenceRoot,
      validationHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = verificationSafetyBoundary();
    const eventPayload = { factType: "validation_run", id, ...seed, validationHash, validationRoot, safety };
    this.assertFactIdAvailable(id);
    const auditEvent = appendFactEvent(stream, {
      action: outcome === "blocked" ? "CHALLENGE" : "REASON",
      actor: executor.id,
      entityType: "validation_run",
      entityId: id,
      payload: eventPayload,
      createdAt: parsed.executedAt,
      rationale:
        outcome === "pass"
          ? "Deterministic evidence validation completed without granting final authority."
          : "Deterministic evidence validation retained review or blocking issues for accountable follow-up.",
    });
    const run: CanopyProofEvidenceValidationRun = {
      factType: "validation_run",
      id,
      ...seed,
      validationHash,
      validationRoot,
      safety,
      auditEvent,
    };
    stream.validationRuns.push(run);
    stream.events.push(auditEvent);
    this.validationRunsById.set(id, run);
    return run;
  }

  recordAiAnalysis(
    evidenceId: string,
    input: unknown,
    agentInput: unknown,
  ): CanopyProofAdvisoryAiAnalysis {
    const stream = this.requireStream(evidenceId);
    const parsed = aiAnalysisInputSchema.parse(input);
    const agent = normalizeActorSnapshot(agentInput);
    assertAiAgent(agent, stream.registration.organizationId);
    const validation = this.requireLatestValidation(stream, parsed.validationRunId);
    assertAppendTime(stream, parsed.analyzedAt);
    if (Date.parse(parsed.analyzedAt) < Date.parse(validation.executedAt)) {
      throw new Error("CanopyProof AI analysis cannot predate its validation run.");
    }
    assertSafeVerificationText([
      parsed.id ?? "",
      parsed.modelProvider,
      parsed.modelName,
      parsed.modelVersion,
      parsed.executionEnvironment,
      ...parsed.findings.flatMap((finding) => [finding.code, finding.message]),
    ]);

    const datasetSnapshotRoots = normalizeUniqueHashes(parsed.datasetSnapshotRoots, "dataset snapshot root");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "AI source event root");
    const knownRoots = new Set(stream.events.map((event) => event.eventRoot));
    requirePriorRoots(sourceEventRoots, knownRoots, "AI source event");
    for (const requiredRoot of [stream.registration.audit_history[0]?.eventRoot, validation.auditEvent.eventRoot]) {
      if (!requiredRoot || !sourceEventRoots.includes(requiredRoot)) {
        throw new Error("CanopyProof AI analysis must bind the evidence registration and validation semantic events.");
      }
    }
    const findings = parsed.findings
      .map((findingInput) => buildAiFinding(findingInput, sourceEventRoots, knownRoots))
      .sort((left, right) => left.id.localeCompare(right.id));
    assertUnique(findings.map((finding) => finding.id), "AI finding id");
    const capabilities = [...new Set(findings.map((finding) => finding.capability))].sort() as CanopyAiCapability[];
    const recommendation: CanopyProofAiRecommendation = findings.some((finding) => finding.severity === "critical")
      ? "rejected"
      : "needs_human_review";
    const confidenceScore = deriveAiConfidence(parsed.confidenceScore, validation.confidenceScore, findings);
    const commandHash = hashJson({
      kind: "canopyproof-advisory-ai-analysis-command-v1",
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      validationRunId: validation.id,
      validationRoot: validation.validationRoot,
      agent,
      modelProvider: parsed.modelProvider,
      modelName: parsed.modelName,
      modelVersion: parsed.modelVersion,
      modelArtifactHash: normalizeHash(parsed.modelArtifactHash),
      promptHash: normalizeHash(parsed.promptHash),
      datasetSnapshotRoots,
      sourceEventRoots,
      executionEnvironment: parsed.executionEnvironment,
      findings,
      claimedConfidenceScore: parsed.confidenceScore,
      confidenceScore,
      analyzedAt: parsed.analyzedAt,
    });
    const canonicalId = `cp_ai_analysis_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof AI analysis id does not match its canonical command hash.");
    }
    const id = canonicalId;
    const existing = this.aiAnalysesById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof AI analysis already exists with conflicting payload: ${id}`);
    }
    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const seed = {
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      validationRunId: validation.id,
      validationRoot: validation.validationRoot,
      agent,
      modelProvider: parsed.modelProvider,
      modelName: parsed.modelName,
      modelVersion: parsed.modelVersion,
      modelArtifactHash: normalizeHash(parsed.modelArtifactHash),
      promptHash: normalizeHash(parsed.promptHash),
      datasetSnapshotRoots,
      sourceEventRoots,
      executionEnvironment: parsed.executionEnvironment,
      capabilities,
      findings,
      recommendation,
      claimedConfidenceScore: parsed.confidenceScore,
      confidenceScore,
      advisoryOnly: true as const,
      analyzedAt: parsed.analyzedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
    };
    const analysisHash = hashJson({ kind: "canopyproof-advisory-ai-analysis-v1", ...seed });
    const analysisRoot = hashJson({
      kind: "canopyproof-advisory-ai-analysis-root-v1",
      evidenceRoot: stream.registration.evidenceRoot,
      validationRoot: validation.validationRoot,
      analysisHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = verificationSafetyBoundary();
    const eventPayload = { factType: "ai_analysis", id, ...seed, analysisHash, analysisRoot, safety };
    this.assertFactIdAvailable(id);
    const auditEvent = appendFactEvent(stream, {
      action: recommendation === "rejected" ? "CHALLENGE" : "REASON",
      actor: agent.id,
      entityType: "ai_analysis",
      entityId: id,
      payload: eventPayload,
      createdAt: parsed.analyzedAt,
      rationale: "Verified AI agent recorded a provenance-bound advisory analysis; human authority remains required.",
    });
    const analysis: CanopyProofAdvisoryAiAnalysis = {
      factType: "ai_analysis",
      id,
      ...seed,
      analysisHash,
      analysisRoot,
      safety,
      auditEvent,
    };
    stream.aiAnalyses.push(analysis);
    stream.events.push(auditEvent);
    this.aiAnalysesById.set(id, analysis);
    return analysis;
  }

  recordHumanReview(
    evidenceId: string,
    input: unknown,
    reviewerInput: unknown,
  ): CanopyProofEvidenceHumanReview {
    const stream = this.requireStream(evidenceId);
    const parsed = humanReviewInputSchema.parse(input);
    const reviewer = normalizeActorSnapshot(reviewerInput);
    assertHumanReviewer(reviewer, stream.registration, parsed.decision);
    const validation = this.requireLatestValidation(stream, parsed.validationRunId);
    const currentAnalyses = this.currentAiAnalyses(stream, validation.id);
    const requestedAnalysisIds = normalizeUniqueStrings(parsed.aiAnalysisIds, "AI analysis id");
    const currentAnalysisIds = currentAnalyses.map((analysis) => analysis.id).sort();
    if (hashJson(requestedAnalysisIds) !== hashJson(currentAnalysisIds)) {
      throw new Error("CanopyProof human review must reference every AI analysis in the latest validation cycle.");
    }
    if (currentAnalyses.length === 0) {
      throw new Error("CanopyProof human review requires at least one prior AI advisory analysis.");
    }
    if (currentAnalyses.some((analysis) => analysis.agent.id === reviewer.id)) {
      throw new Error("CanopyProof AI agent cannot review its own analysis as a human authority.");
    }
    assertAppendTime(stream, parsed.reviewedAt);
    if (currentAnalyses.some((analysis) => Date.parse(parsed.reviewedAt) < Date.parse(analysis.analyzedAt))) {
      throw new Error("CanopyProof human review cannot predate a referenced AI analysis.");
    }
    assertSafeVerificationText([parsed.id ?? "", parsed.rationale, ...parsed.limitations]);

    const knownRoots = new Set(stream.events.map((event) => event.eventRoot));
    const findingsByKey = new Map(
      currentAnalyses.flatMap((analysis) =>
        analysis.findings.map((finding) => [`${analysis.id}:${finding.id}`, { analysis, finding }] as const),
      ),
    );
    const findingDispositions = parsed.findingDispositions
      .map((dispositionInput) => buildFindingDisposition(dispositionInput, findingsByKey, knownRoots))
      .sort((left, right) =>
        left.analysisId.localeCompare(right.analysisId) || left.findingId.localeCompare(right.findingId),
      );
    assertUnique(
      findingDispositions.map((disposition) => `${disposition.analysisId}:${disposition.findingId}`),
      "human finding disposition",
    );
    enforceHumanDecisionPolicy(parsed.decision, validation, currentAnalyses, findingDispositions, reviewer);

    const limitations = normalizeUniqueStrings(parsed.limitations, "human review limitation");
    const aiAnalysisRoots = currentAnalyses.map((analysis) => analysis.analysisRoot).sort();
    const commandHash = hashJson({
      kind: "canopyproof-evidence-human-review-command-v1",
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      validationRunId: validation.id,
      validationRoot: validation.validationRoot,
      aiAnalysisIds: currentAnalysisIds,
      aiAnalysisRoots,
      reviewer,
      decision: parsed.decision,
      findingDispositions,
      rationale: parsed.rationale,
      limitations,
      reviewedAt: parsed.reviewedAt,
    });
    const canonicalId = `cp_human_review_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof human review id does not match its canonical command hash.");
    }
    const id = canonicalId;
    const existing = this.humanReviewsById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof human review already exists with conflicting payload: ${id}`);
    }
    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const sourceRoot = merkleRoot(
      [
        stream.registration.evidenceRoot,
        validation.validationRoot,
        ...aiAnalysisRoots,
        ...findingDispositions.map((disposition) => disposition.dispositionHash),
      ].sort(),
    );
    const seed = {
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      validationRunId: validation.id,
      validationRoot: validation.validationRoot,
      aiAnalysisIds: currentAnalysisIds,
      aiAnalysisRoots,
      reviewer,
      decision: parsed.decision,
      findingDispositions,
      rationale: parsed.rationale,
      limitations,
      reviewedAt: parsed.reviewedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
      sourceRoot,
    };
    const reviewHash = hashJson({ kind: "canopyproof-evidence-human-review-v1", ...seed });
    const reviewRoot = hashJson({
      kind: "canopyproof-evidence-human-review-root-v1",
      evidenceRoot: stream.registration.evidenceRoot,
      sourceRoot,
      reviewHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = verificationSafetyBoundary();
    const eventPayload = { factType: "human_review", id, ...seed, reviewHash, reviewRoot, safety };
    this.assertFactIdAvailable(id);
    const auditEvent = appendFactEvent(stream, {
      action: parsed.decision === "approve" ? "FULFILL" : "CHALLENGE",
      actor: reviewer.id,
      entityType: "human_review",
      entityId: id,
      payload: eventPayload,
      createdAt: parsed.reviewedAt,
      rationale: parsed.rationale,
    });
    const review: CanopyProofEvidenceHumanReview = {
      factType: "human_review",
      id,
      ...seed,
      reviewHash,
      reviewRoot,
      safety,
      auditEvent,
    };
    stream.humanReviews.push(review);
    stream.events.push(auditEvent);
    this.humanReviewsById.set(id, review);
    return review;
  }

  openChallenge(
    evidenceId: string,
    input: unknown,
    challengerInput: unknown,
  ): CanopyProofEvidenceChallenge {
    const stream = this.requireStream(evidenceId);
    const parsed = evidenceChallengeInputSchema.parse(input);
    const challenger = normalizeActorSnapshot(challengerInput);
    assertChallengeActor(challenger);
    assertSafeVerificationText([parsed.id ?? "", parsed.rationale]);
    const evidenceEventRoots = normalizeUniqueHashes(parsed.evidenceEventRoots, "challenge evidence event root");
    const supportingArtifactHashes = normalizeUniqueHashes(
      parsed.supportingArtifactHashes,
      "challenge supporting artifact hash",
    );
    const retry = stream.challenges.find(
      (challenge) =>
        (!parsed.id || challenge.id === parsed.id) &&
        challenge.challenger.id === challenger.id &&
        challenge.reason === parsed.reason &&
        challenge.severity === parsed.severity &&
        challenge.rationale === parsed.rationale &&
        challenge.challengedAt === parsed.challengedAt &&
        hashJson(challenge.supportingArtifactHashes) === hashJson(supportingArtifactHashes) &&
        hashJson(challenge.evidenceEventRoots) === hashJson(evidenceEventRoots) &&
        hashJson(challenge.challenger) === hashJson(challenger),
    );
    if (retry) return retry;
    assertAppendTime(stream, parsed.challengedAt);

    const challengedReliance = this.getEvidenceReliance(evidenceId);
    if (challengedReliance.state === "withdrawn" || challengedReliance.state === "superseded") {
      throw new Error("CanopyProof cannot open a new reliance challenge after evidence withdrawal or supersession.");
    }
    const knownRoots = new Set(stream.events.map((event) => event.eventRoot));
    requirePriorRoots(evidenceEventRoots, knownRoots, "challenge evidence event");
    for (const requiredRoot of [stream.registration.audit_history[0]?.eventRoot, challengedReliance.terminalEventRoot]) {
      if (!requiredRoot || !evidenceEventRoots.includes(requiredRoot)) {
        throw new Error("CanopyProof challenge must bind registration and challenged terminal semantic events.");
      }
    }
    const challengedAiAnalyses = challengedReliance.currentAiAnalysisIds.map((id) => this.getAiAnalysis(id));
    const challengedReview = challengedReliance.latestHumanReviewId
      ? this.getHumanReview(challengedReliance.latestHumanReviewId)
      : undefined;
    const commandHash = hashJson({
      kind: "canopyproof-evidence-challenge-command-v1",
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      challengedRelianceState: challengedReliance.state,
      challengedRelianceRoot: challengedReliance.relianceRoot,
      challengedTerminalEventRoot: challengedReliance.terminalEventRoot,
      challengedValidationRunId: challengedReliance.latestValidationRunId ?? null,
      challengedValidationRoot: challengedReliance.latestValidationRoot ?? null,
      challengedAiAnalysisIds: challengedAiAnalyses.map((analysis) => analysis.id).sort(),
      challengedAiAnalysisRoots: challengedAiAnalyses.map((analysis) => analysis.analysisRoot).sort(),
      challengedHumanReviewId: challengedReview?.id ?? null,
      challengedHumanReviewRoot: challengedReview?.reviewRoot ?? null,
      reason: parsed.reason,
      severity: parsed.severity,
      rationale: parsed.rationale,
      supportingArtifactHashes,
      evidenceEventRoots,
      challenger,
      challengedAt: parsed.challengedAt,
    });
    const canonicalId = `cp_evidence_challenge_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof evidence challenge id does not match its canonical command hash.");
    }
    const duplicate = stream.challenges.find(
      (challenge) =>
        challenge.challenger.id === challenger.id &&
        challenge.reason === parsed.reason &&
        challenge.challengedRelianceRoot === challengedReliance.relianceRoot,
    );
    if (duplicate) {
      if (duplicate.commandHash === commandHash) return duplicate;
      throw new Error("CanopyProof challenger reason already exists for the challenged reliance projection.");
    }
    const existing = this.challengesById.get(canonicalId);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof evidence challenge already exists with conflicting payload: ${canonicalId}`);
    }

    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const seed = {
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      challengedRelianceState: challengedReliance.state,
      challengedRelianceRoot: challengedReliance.relianceRoot,
      challengedTerminalEventRoot: challengedReliance.terminalEventRoot,
      ...(challengedReliance.latestValidationRunId
        ? {
            challengedValidationRunId: challengedReliance.latestValidationRunId,
            challengedValidationRoot: challengedReliance.latestValidationRoot!,
          }
        : {}),
      challengedAiAnalysisIds: challengedAiAnalyses.map((analysis) => analysis.id).sort(),
      challengedAiAnalysisRoots: challengedAiAnalyses.map((analysis) => analysis.analysisRoot).sort(),
      ...(challengedReview
        ? { challengedHumanReviewId: challengedReview.id, challengedHumanReviewRoot: challengedReview.reviewRoot }
        : {}),
      reason: parsed.reason,
      severity: parsed.severity,
      rationale: parsed.rationale,
      supportingArtifactHashes,
      evidenceEventRoots,
      challenger,
      challengedAt: parsed.challengedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
    };
    const challengeHash = hashJson({ kind: "canopyproof-evidence-challenge-v1", ...seed });
    const challengeRoot = hashJson({
      kind: "canopyproof-evidence-challenge-root-v1",
      evidenceRoot: stream.registration.evidenceRoot,
      challengedRelianceRoot: challengedReliance.relianceRoot,
      challengeHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = evidenceChallengeSafetyBoundary();
    const eventPayload = {
      factType: "evidence_challenge",
      id: canonicalId,
      ...seed,
      challengeHash,
      challengeRoot,
      safety,
    };
    this.assertFactIdAvailable(canonicalId);
    const auditEvent = appendFactEvent(stream, {
      action: "CHALLENGE",
      actor: challenger.id,
      entityType: "evidence_challenge",
      entityId: canonicalId,
      payload: eventPayload,
      createdAt: parsed.challengedAt,
      rationale: "A verified human opened an evidence-rooted challenge; current reliance is suspended pending independent review.",
    });
    const challenge: CanopyProofEvidenceChallenge = {
      factType: "evidence_challenge",
      id: canonicalId,
      ...seed,
      challengeHash,
      challengeRoot,
      safety,
      auditEvent,
    };
    stream.challenges.push(challenge);
    stream.events.push(auditEvent);
    this.challengesById.set(challenge.id, challenge);
    return challenge;
  }

  resolveChallenge(
    challengeId: string,
    input: unknown,
    reviewerInput: unknown,
  ): CanopyProofEvidenceChallengeResolution {
    const challenge = this.getChallenge(challengeId);
    const stream = this.requireStream(challenge.evidenceId);
    const parsed = evidenceChallengeResolutionInputSchema.parse(input);
    const reviewer = normalizeActorSnapshot(reviewerInput);
    const priorResolutions = this.listChallengeResolutions(challengeId);
    const previousResolution = priorResolutions.at(-1);
    assertSafeVerificationText([parsed.id ?? "", parsed.rationale, ...parsed.limitations]);
    const evidenceEventRoots = normalizeUniqueHashes(
      parsed.evidenceEventRoots,
      "challenge resolution evidence event root",
    );
    const limitations = normalizeUniqueStrings(parsed.limitations, "challenge resolution limitation");
    if (
      previousResolution &&
      (!parsed.id || previousResolution.id === parsed.id) &&
      previousResolution.decision === parsed.decision &&
      previousResolution.rationale === parsed.rationale &&
      previousResolution.reviewedAt === parsed.reviewedAt &&
      hashJson(previousResolution.limitations) === hashJson(limitations) &&
      hashJson(previousResolution.evidenceEventRoots) === hashJson(evidenceEventRoots) &&
      hashJson(previousResolution.reviewer) === hashJson(reviewer)
    ) {
      return previousResolution;
    }
    if (previousResolution && previousResolution.decision !== "needs_more_evidence") {
      throw new Error(`CanopyProof evidence challenge already has a terminal resolution: ${challengeId}`);
    }
    assertChallengeReviewer(reviewer, stream, challenge, priorResolutions, parsed.decision);
    assertAppendTime(stream, parsed.reviewedAt);
    if (Date.parse(parsed.reviewedAt) < Date.parse(challenge.challengedAt)) {
      throw new Error("CanopyProof challenge resolution cannot predate its challenge.");
    }
    const knownRoots = new Set(stream.events.map((event) => event.eventRoot));
    requirePriorRoots(evidenceEventRoots, knownRoots, "challenge resolution evidence event");
    for (const requiredRoot of [challenge.auditEvent.eventRoot, previousResolution?.auditEvent.eventRoot]) {
      if (requiredRoot && !evidenceEventRoots.includes(requiredRoot)) {
        throw new Error("CanopyProof challenge resolution must bind challenge and predecessor resolution events.");
      }
    }
    const commandHash = hashJson({
      kind: "canopyproof-evidence-challenge-resolution-command-v1",
      challengeId: challenge.id,
      challengeRoot: challenge.challengeRoot,
      evidenceId: challenge.evidenceId,
      evidenceRoot: challenge.evidenceRoot,
      previousResolutionId: previousResolution?.id ?? null,
      previousResolutionRoot: previousResolution?.resolutionRoot ?? null,
      decision: parsed.decision,
      rationale: parsed.rationale,
      limitations,
      evidenceEventRoots,
      reviewer,
      reviewedAt: parsed.reviewedAt,
    });
    const canonicalId = `cp_evidence_challenge_resolution_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof challenge resolution id does not match its canonical command hash.");
    }
    const existing = this.challengeResolutionsById.get(canonicalId);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof challenge resolution already exists with conflicting payload: ${canonicalId}`);
    }

    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const sourceRoot = merkleRoot(
      [
        challenge.challengeRoot,
        ...(previousResolution ? [previousResolution.resolutionRoot] : []),
        ...evidenceEventRoots,
      ].sort(),
    );
    const seed = {
      challengeId: challenge.id,
      challengeRoot: challenge.challengeRoot,
      evidenceId: challenge.evidenceId,
      projectId: challenge.projectId,
      organizationId: challenge.organizationId,
      evidenceRoot: challenge.evidenceRoot,
      ...(previousResolution
        ? { previousResolutionId: previousResolution.id, previousResolutionRoot: previousResolution.resolutionRoot }
        : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      limitations,
      evidenceEventRoots,
      reviewer,
      reviewedAt: parsed.reviewedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
      sourceRoot,
    };
    const resolutionHash = hashJson({ kind: "canopyproof-evidence-challenge-resolution-v1", ...seed });
    const resolutionRoot = hashJson({
      kind: "canopyproof-evidence-challenge-resolution-root-v1",
      challengeRoot: challenge.challengeRoot,
      sourceRoot,
      resolutionHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = evidenceChallengeSafetyBoundary();
    const eventPayload = {
      factType: "evidence_challenge_resolution",
      id: canonicalId,
      ...seed,
      resolutionHash,
      resolutionRoot,
      safety,
    };
    this.assertFactIdAvailable(canonicalId);
    const auditEvent = appendFactEvent(stream, {
      action: parsed.decision === "dismissed" ? "FULFILL" : parsed.decision === "upheld" ? "CHALLENGE" : "REASON",
      actor: reviewer.id,
      entityType: "evidence_challenge_resolution",
      entityId: canonicalId,
      payload: eventPayload,
      createdAt: parsed.reviewedAt,
      rationale: parsed.rationale,
    });
    const resolution: CanopyProofEvidenceChallengeResolution = {
      factType: "evidence_challenge_resolution",
      id: canonicalId,
      ...seed,
      resolutionHash,
      resolutionRoot,
      safety,
      auditEvent,
    };
    stream.challengeResolutions.push(resolution);
    stream.events.push(auditEvent);
    this.challengeResolutionsById.set(resolution.id, resolution);
    return resolution;
  }

  recordCorrection(
    resolutionId: string,
    input: unknown,
    publisherInput: unknown,
  ): CanopyProofEvidenceCorrection {
    const resolution = this.getChallengeResolution(resolutionId);
    const challenge = this.getChallenge(resolution.challengeId);
    const stream = this.requireStream(challenge.evidenceId);
    const parsed = evidenceCorrectionInputSchema.parse(input);
    const publisher = normalizeActorSnapshot(publisherInput);
    const latestResolution = this.listChallengeResolutions(challenge.id).at(-1);
    if (latestResolution?.id !== resolution.id || resolution.decision !== "upheld") {
      throw new Error("CanopyProof correction requires the latest terminal upheld challenge resolution.");
    }
    assertSafeVerificationText([parsed.id ?? "", parsed.rationale, parsed.replacementEvidenceId ?? ""]);
    const evidenceEventRoots = normalizeUniqueHashes(parsed.evidenceEventRoots, "correction evidence event root");
    const priorCorrection = stream.corrections.find((correction) => correction.resolutionId === resolution.id);
    if (priorCorrection) {
      if (
        (!parsed.id || priorCorrection.id === parsed.id) &&
        priorCorrection.action === parsed.action &&
        priorCorrection.replacementEvidenceId === parsed.replacementEvidenceId &&
        priorCorrection.rationale === parsed.rationale &&
        priorCorrection.correctedAt === parsed.correctedAt &&
        hashJson(priorCorrection.evidenceEventRoots) === hashJson(evidenceEventRoots) &&
        hashJson(priorCorrection.publisher) === hashJson(publisher)
      ) {
        return priorCorrection;
      }
      throw new Error(`CanopyProof upheld challenge resolution already has a correction: ${resolution.id}`);
    }
    assertCorrectionPublisher(publisher, stream, challenge, resolution);
    assertAppendTime(stream, parsed.correctedAt);
    if (Date.parse(parsed.correctedAt) < Date.parse(resolution.reviewedAt)) {
      throw new Error("CanopyProof correction cannot predate its upheld resolution.");
    }
    const knownRoots = new Set(stream.events.map((event) => event.eventRoot));
    requirePriorRoots(evidenceEventRoots, knownRoots, "correction evidence event");
    if (!evidenceEventRoots.includes(resolution.auditEvent.eventRoot)) {
      throw new Error("CanopyProof correction must bind the upheld resolution semantic event.");
    }

    let replacement:
      | Readonly<{
          evidenceId: string;
          evidenceRoot: string;
          relianceRoot: string;
          terminalEventRoot: string;
        }>
      | undefined;
    if (parsed.action === "withdraw") {
      if (parsed.replacementEvidenceId) {
        throw new Error("CanopyProof withdrawal correction cannot reference replacement evidence.");
      }
    } else {
      if (!parsed.replacementEvidenceId || parsed.replacementEvidenceId === challenge.evidenceId) {
        throw new Error("CanopyProof supersession requires a distinct replacement evidence registration.");
      }
      const replacementStream = this.requireStream(parsed.replacementEvidenceId);
      if (
        replacementStream.registration.organizationId !== challenge.organizationId ||
        replacementStream.registration.projectId !== challenge.projectId
      ) {
        throw new Error("CanopyProof replacement evidence must remain in the same organization and project.");
      }
      const replacementReliance = this.getEvidenceReliance(parsed.replacementEvidenceId);
      if (replacementReliance.state !== "approved") {
        throw new Error("CanopyProof replacement evidence requires independent current approval.");
      }
      const replacementTerminalEvent = replacementStream.events.at(-1);
      if (!replacementTerminalEvent || Date.parse(replacementTerminalEvent.createdAt) >= Date.parse(parsed.correctedAt)) {
        throw new Error("CanopyProof replacement approval must precede the supersession correction.");
      }
      replacement = {
        evidenceId: parsed.replacementEvidenceId,
        evidenceRoot: replacementStream.registration.evidenceRoot,
        relianceRoot: replacementReliance.relianceRoot,
        terminalEventRoot: replacementReliance.terminalEventRoot,
      };
    }

    const commandHash = hashJson({
      kind: "canopyproof-evidence-correction-command-v1",
      challengeId: challenge.id,
      challengeRoot: challenge.challengeRoot,
      resolutionId: resolution.id,
      resolutionRoot: resolution.resolutionRoot,
      evidenceId: challenge.evidenceId,
      evidenceRoot: challenge.evidenceRoot,
      action: parsed.action,
      replacementEvidenceId: replacement?.evidenceId ?? null,
      replacementEvidenceRoot: replacement?.evidenceRoot ?? null,
      replacementRelianceRoot: replacement?.relianceRoot ?? null,
      replacementTerminalEventRoot: replacement?.terminalEventRoot ?? null,
      rationale: parsed.rationale,
      evidenceEventRoots,
      publisher,
      correctedAt: parsed.correctedAt,
    });
    const canonicalId = `cp_evidence_correction_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof evidence correction id does not match its canonical command hash.");
    }
    const existing = this.correctionsById.get(canonicalId);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof evidence correction already exists with conflicting payload: ${canonicalId}`);
    }

    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const sourceRoot = merkleRoot(
      [
        challenge.challengeRoot,
        resolution.resolutionRoot,
        ...evidenceEventRoots,
        ...(replacement ? [replacement.evidenceRoot, replacement.relianceRoot, replacement.terminalEventRoot] : []),
      ].sort(),
    );
    const seed = {
      challengeId: challenge.id,
      challengeRoot: challenge.challengeRoot,
      resolutionId: resolution.id,
      resolutionRoot: resolution.resolutionRoot,
      evidenceId: challenge.evidenceId,
      projectId: challenge.projectId,
      organizationId: challenge.organizationId,
      evidenceRoot: challenge.evidenceRoot,
      action: parsed.action,
      ...(replacement
        ? {
            replacementEvidenceId: replacement.evidenceId,
            replacementEvidenceRoot: replacement.evidenceRoot,
            replacementRelianceRoot: replacement.relianceRoot,
            replacementTerminalEventRoot: replacement.terminalEventRoot,
          }
        : {}),
      rationale: parsed.rationale,
      evidenceEventRoots,
      publisher,
      correctedAt: parsed.correctedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
      sourceRoot,
    };
    const correctionHash = hashJson({ kind: "canopyproof-evidence-correction-v1", ...seed });
    const correctionRoot = hashJson({
      kind: "canopyproof-evidence-correction-root-v1",
      evidenceRoot: challenge.evidenceRoot,
      resolutionRoot: resolution.resolutionRoot,
      sourceRoot,
      correctionHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = evidenceChallengeSafetyBoundary();
    const eventPayload = {
      factType: "evidence_correction",
      id: canonicalId,
      ...seed,
      correctionHash,
      correctionRoot,
      safety,
    };
    this.assertFactIdAvailable(canonicalId);
    const auditEvent = appendFactEvent(stream, {
      action: "FULFILL",
      actor: publisher.id,
      entityType: "evidence_correction",
      entityId: canonicalId,
      payload: eventPayload,
      createdAt: parsed.correctedAt,
      rationale: parsed.rationale,
    });
    const correction: CanopyProofEvidenceCorrection = {
      factType: "evidence_correction",
      id: canonicalId,
      ...seed,
      correctionHash,
      correctionRoot,
      safety,
      auditEvent,
    };
    stream.corrections.push(correction);
    stream.events.push(auditEvent);
    this.correctionsById.set(correction.id, correction);
    return correction;
  }

  recordFinalDecision(
    evidenceId: string,
    input: unknown,
    verifierInput: unknown,
  ): CanopyProofEvidenceFinalDecision {
    const stream = this.requireStream(evidenceId);
    const parsed = evidenceFinalDecisionInputSchema.parse(input);
    const verifier = normalizeActorSnapshot(verifierInput);
    assertSafeVerificationText([parsed.id ?? "", parsed.rationale, ...parsed.limitations]);
    const limitations = normalizeUniqueStrings(parsed.limitations, "final decision limitation");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "final decision source event root");
    const latestPriorDecision = stream.finalDecisions.at(-1);
    if (
      latestPriorDecision &&
      (!parsed.id || latestPriorDecision.id === parsed.id) &&
      latestPriorDecision.decision === parsed.decision &&
      latestPriorDecision.rationale === parsed.rationale &&
      latestPriorDecision.decidedAt === parsed.decidedAt &&
      hashJson(latestPriorDecision.limitations) === hashJson(limitations) &&
      hashJson(latestPriorDecision.sourceEventRoots) === hashJson(sourceEventRoots) &&
      hashJson(latestPriorDecision.verifier) === hashJson(verifier)
    ) {
      return latestPriorDecision;
    }
    if (latestPriorDecision?.auditEvent.eventRoot === this.terminalEventRoot(stream)) {
      throw new Error("CanopyProof evidence already has a current final decision; a new authority fact is required first.");
    }
    assertAppendTime(stream, parsed.decidedAt);

    const reliance = this.getEvidenceReliance(evidenceId);
    if (
      [
        "registered",
        "validation_passed",
        "ai_advised",
        "challenged",
        "correction_required",
        "withdrawn",
        "superseded",
      ].includes(reliance.state)
    ) {
      throw new Error(`CanopyProof final decision cannot proceed from evidence reliance state: ${reliance.state}`);
    }
    if (!reliance.latestValidationRunId || !reliance.latestValidationRoot || !reliance.latestHumanReviewId) {
      throw new Error("CanopyProof final decision requires current validation and authoritative human review facts.");
    }
    const validation = this.getValidationRun(reliance.latestValidationRunId);
    const analyses = reliance.currentAiAnalysisIds.map((analysisId) => this.getAiAnalysis(analysisId));
    const humanReview = this.getHumanReview(reliance.latestHumanReviewId);
    if (analyses.length === 0) {
      throw new Error("CanopyProof final decision requires the complete current AI advisory set.");
    }
    if (parsed.decision === "verify" && (reliance.state !== "approved" || humanReview.decision !== "approve")) {
      throw new Error("CanopyProof verify decision requires current approved reliance and human approval.");
    }
    assertFinalDecisionVerifier(verifier, stream, humanReview, analyses, latestPriorDecision);
    if (Date.parse(parsed.decidedAt) < Date.parse(humanReview.reviewedAt)) {
      throw new Error("CanopyProof final decision cannot predate its current human review.");
    }

    const knownRoots = new Set(stream.events.map((event) => event.eventRoot));
    requirePriorRoots(sourceEventRoots, knownRoots, "final decision source event");
    const requiredSourceRoots = [
      stream.registration.audit_history[0]?.eventRoot,
      validation.auditEvent.eventRoot,
      ...analyses.map((analysis) => analysis.auditEvent.eventRoot),
      humanReview.auditEvent.eventRoot,
      reliance.terminalEventRoot,
    ].filter((root): root is string => Boolean(root));
    const missingSource = requiredSourceRoots.find((root) => !sourceEventRoots.includes(root));
    if (missingSource) {
      throw new Error(`CanopyProof final decision omits a required current authority event: ${missingSource}`);
    }

    const aiAnalysisIds = analyses.map((analysis) => analysis.id).sort();
    const aiAnalysisRoots = analyses.map((analysis) => analysis.analysisRoot).sort();
    const commandHash = hashJson({
      kind: "canopyproof-evidence-final-decision-command-v1",
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      preDecisionRelianceState: reliance.state,
      preDecisionRelianceRoot: reliance.relianceRoot,
      preDecisionTerminalEventRoot: reliance.terminalEventRoot,
      validationRunId: validation.id,
      validationRoot: validation.validationRoot,
      aiAnalysisIds,
      aiAnalysisRoots,
      humanReviewId: humanReview.id,
      humanReviewRoot: humanReview.reviewRoot,
      priorFinalDecisionId: latestPriorDecision?.id ?? null,
      priorFinalDecisionRoot: latestPriorDecision?.decisionRoot ?? null,
      decision: parsed.decision,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      verifier,
      decidedAt: parsed.decidedAt,
    });
    const canonicalId = `cp_evidence_final_decision_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== canonicalId) {
      throw new Error("CanopyProof final decision id does not match its canonical command hash.");
    }
    const existing = this.finalDecisionsById.get(canonicalId);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof final decision already exists with conflicting payload: ${canonicalId}`);
    }

    const evidenceSequence = stream.events.length + 1;
    const previousEventRoot = this.terminalEventRoot(stream);
    const sourceRoot = merkleRoot(
      [
        stream.registration.evidenceRoot,
        reliance.relianceRoot,
        validation.validationRoot,
        ...aiAnalysisRoots,
        humanReview.reviewRoot,
        ...sourceEventRoots,
        ...(latestPriorDecision ? [latestPriorDecision.decisionRoot] : []),
      ].sort(),
    );
    const seed = {
      evidenceId,
      projectId: stream.registration.projectId,
      organizationId: stream.registration.organizationId,
      evidenceRoot: stream.registration.evidenceRoot,
      preDecisionRelianceState: reliance.state,
      preDecisionRelianceRoot: reliance.relianceRoot,
      preDecisionTerminalEventRoot: reliance.terminalEventRoot,
      validationRunId: validation.id,
      validationRoot: validation.validationRoot,
      aiAnalysisIds,
      aiAnalysisRoots,
      humanReviewId: humanReview.id,
      humanReviewRoot: humanReview.reviewRoot,
      ...(latestPriorDecision
        ? {
            priorFinalDecisionId: latestPriorDecision.id,
            priorFinalDecisionRoot: latestPriorDecision.decisionRoot,
          }
        : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      sourceRoot,
      verifier,
      decidedAt: parsed.decidedAt,
      commandHash,
      evidenceSequence,
      previousEventRoot,
    };
    const decisionHash = hashJson({ kind: "canopyproof-evidence-final-decision-v1", ...seed });
    const decisionRoot = hashJson({
      kind: "canopyproof-evidence-final-decision-root-v1",
      evidenceRoot: stream.registration.evidenceRoot,
      preDecisionRelianceRoot: reliance.relianceRoot,
      sourceRoot,
      decisionHash,
      previousEventRoot,
      evidenceSequence,
    });
    const safety = evidenceFinalDecisionSafetyBoundary();
    const eventPayload = {
      factType: "evidence_final_decision",
      id: canonicalId,
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
    };
    this.assertFactIdAvailable(canonicalId);
    const auditEvent = appendFactEvent(stream, {
      action: parsed.decision === "verify" ? "FULFILL" : parsed.decision === "reject" ? "CHALLENGE" : "REASON",
      actor: verifier.id,
      entityType: "evidence_final_decision",
      entityId: canonicalId,
      payload: eventPayload,
      createdAt: parsed.decidedAt,
      rationale: parsed.rationale,
    });
    const decision: CanopyProofEvidenceFinalDecision = {
      factType: "evidence_final_decision",
      id: canonicalId,
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
      auditEvent,
    };
    stream.finalDecisions.push(decision);
    stream.events.push(auditEvent);
    this.finalDecisionsById.set(decision.id, decision);
    return decision;
  }

  getValidationRun(validationRunId: string) {
    const run = this.validationRunsById.get(validationRunId);
    if (!run) throw new Error(`CanopyProof validation run not found: ${validationRunId}`);
    return run;
  }

  getAiAnalysis(analysisId: string) {
    const analysis = this.aiAnalysesById.get(analysisId);
    if (!analysis) throw new Error(`CanopyProof AI analysis not found: ${analysisId}`);
    return analysis;
  }

  getHumanReview(reviewId: string) {
    const review = this.humanReviewsById.get(reviewId);
    if (!review) throw new Error(`CanopyProof human review not found: ${reviewId}`);
    return review;
  }

  getChallenge(challengeId: string) {
    const challenge = this.challengesById.get(challengeId);
    if (!challenge) throw new Error(`CanopyProof evidence challenge not found: ${challengeId}`);
    return challenge;
  }

  getChallengeResolution(resolutionId: string) {
    const resolution = this.challengeResolutionsById.get(resolutionId);
    if (!resolution) throw new Error(`CanopyProof evidence challenge resolution not found: ${resolutionId}`);
    return resolution;
  }

  getCorrection(correctionId: string) {
    const correction = this.correctionsById.get(correctionId);
    if (!correction) throw new Error(`CanopyProof evidence correction not found: ${correctionId}`);
    return correction;
  }

  getFinalDecision(decisionId: string) {
    const decision = this.finalDecisionsById.get(decisionId);
    if (!decision) throw new Error(`CanopyProof evidence final decision not found: ${decisionId}`);
    return decision;
  }

  listValidationRuns(evidenceId: string) {
    return [...this.requireStream(evidenceId).validationRuns];
  }

  listAiAnalyses(evidenceId: string) {
    return [...this.requireStream(evidenceId).aiAnalyses];
  }

  listHumanReviews(evidenceId: string) {
    return [...this.requireStream(evidenceId).humanReviews];
  }

  listChallenges(evidenceId: string) {
    return [...this.requireStream(evidenceId).challenges];
  }

  listChallengeResolutions(challengeId: string) {
    const challenge = this.getChallenge(challengeId);
    return this.requireStream(challenge.evidenceId).challengeResolutions.filter(
      (resolution) => resolution.challengeId === challengeId,
    );
  }

  listCorrections(evidenceId: string) {
    return [...this.requireStream(evidenceId).corrections];
  }

  listFinalDecisions(evidenceId: string) {
    return [...this.requireStream(evidenceId).finalDecisions];
  }

  getEvidenceFinalVerification(evidenceId: string): CanopyProofEvidenceFinalVerification {
    const stream = this.requireStream(evidenceId);
    const latestDecision = stream.finalDecisions.at(-1);
    const terminalEventRoot = this.terminalEventRoot(stream);
    const currentDecision = latestDecision?.auditEvent.eventRoot === terminalEventRoot ? latestDecision : undefined;
    const state: CanopyProofEvidenceFinalVerificationState = currentDecision
      ? ({ verify: "verified", reject: "rejected", request_changes: "changes_requested" } as const)[
          currentDecision.decision
        ]
      : latestDecision
        ? "stale"
        : "not_decided";
    const evidenceSequence = stream.events.length;
    const seed = {
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      state,
      latestDecisionId: latestDecision?.id ?? null,
      latestDecisionRoot: latestDecision?.decisionRoot ?? null,
      currentDecisionId: currentDecision?.id ?? null,
      currentDecisionRoot: currentDecision?.decisionRoot ?? null,
      terminalEventRoot,
      evidenceSequence,
    };
    return {
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      state,
      ...(latestDecision ? { latestDecisionId: latestDecision.id, latestDecisionRoot: latestDecision.decisionRoot } : {}),
      ...(currentDecision
        ? { currentDecisionId: currentDecision.id, currentDecisionRoot: currentDecision.decisionRoot }
        : {}),
      terminalEventRoot,
      evidenceSequence,
      finalVerificationRoot: hashJson({ kind: "canopyproof-evidence-final-verification-v1", ...seed }),
      safety: evidenceFinalDecisionSafetyBoundary(),
    };
  }

  getEvidenceReliance(evidenceId: string): CanopyProofEvidenceReliance {
    const stream = this.requireStream(evidenceId);
    const latestValidation = stream.validationRuns.at(-1);
    const currentAnalyses = latestValidation ? this.currentAiAnalyses(stream, latestValidation.id) : [];
    const currentReviews = latestValidation
      ? stream.humanReviews.filter((review) => review.validationRunId === latestValidation.id)
      : [];
    const latestReview = currentReviews.at(-1);
    const latestAnalysisSequence = currentAnalyses.at(-1)?.evidenceSequence ?? 0;
    const authoritativeReview = latestReview && latestReview.evidenceSequence > latestAnalysisSequence ? latestReview : undefined;
    const baselineState = deriveRelianceState(latestValidation, currentAnalyses, authoritativeReview);
    const challengeProjection = deriveChallengeProjection(stream);
    const state: CanopyProofEvidenceRelianceState =
      challengeProjection.openChallengeIds.length > 0
        ? "challenged"
        : challengeProjection.upheldChallengeIds.length > 0
          ? "correction_required"
          : challengeProjection.latestCorrection?.action === "withdraw"
            ? "withdrawn"
            : challengeProjection.latestCorrection?.action === "supersede"
              ? "superseded"
              : baselineState;
    const terminalEventRoot = this.terminalEventRoot(stream);
    const evidenceSequence = stream.events.length;
    const seed = {
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      state,
      latestValidationRunId: latestValidation?.id ?? null,
      latestValidationRoot: latestValidation?.validationRoot ?? null,
      currentAiAnalysisIds: currentAnalyses.map((analysis) => analysis.id).sort(),
      latestHumanReviewId: authoritativeReview?.id ?? null,
      latestHumanReviewRoot: authoritativeReview?.reviewRoot ?? null,
      openChallengeIds: challengeProjection.openChallengeIds,
      upheldChallengeIds: challengeProjection.upheldChallengeIds,
      dismissedChallengeIds: challengeProjection.dismissedChallengeIds,
      correctedChallengeIds: challengeProjection.correctedChallengeIds,
      latestCorrectionId: challengeProjection.latestCorrection?.id ?? null,
      latestCorrectionRoot: challengeProjection.latestCorrection?.correctionRoot ?? null,
      replacementEvidenceId: challengeProjection.latestCorrection?.replacementEvidenceId ?? null,
      terminalEventRoot,
      evidenceSequence,
    };
    return {
      evidenceId,
      evidenceRoot: stream.registration.evidenceRoot,
      state,
      ...(latestValidation ? {
        latestValidationRunId: latestValidation.id,
        latestValidationRoot: latestValidation.validationRoot,
      } : {}),
      currentAiAnalysisIds: currentAnalyses.map((analysis) => analysis.id).sort(),
      ...(authoritativeReview ? {
        latestHumanReviewId: authoritativeReview.id,
        latestHumanReviewRoot: authoritativeReview.reviewRoot,
      } : {}),
      openChallengeIds: challengeProjection.openChallengeIds,
      upheldChallengeIds: challengeProjection.upheldChallengeIds,
      dismissedChallengeIds: challengeProjection.dismissedChallengeIds,
      correctedChallengeIds: challengeProjection.correctedChallengeIds,
      ...(challengeProjection.latestCorrection
        ? {
            latestCorrectionId: challengeProjection.latestCorrection.id,
            latestCorrectionRoot: challengeProjection.latestCorrection.correctionRoot,
            ...(challengeProjection.latestCorrection.replacementEvidenceId
              ? { replacementEvidenceId: challengeProjection.latestCorrection.replacementEvidenceId }
              : {}),
          }
        : {}),
      terminalEventRoot,
      evidenceSequence,
      relianceRoot: hashJson({ kind: "canopyproof-evidence-reliance-v1", ...seed }),
      safety: verificationSafetyBoundary(),
    };
  }

  getAuthoritySnapshot(): CanopyProofEvidenceVerificationAuthoritySnapshot {
    const streams = [...this.streamsByEvidenceId.values()].sort((left, right) =>
      left.registration.id.localeCompare(right.registration.id),
    );
    return {
      registrations: streams.map((stream) => stream.registration),
      validationRuns: streams.flatMap((stream) => stream.validationRuns),
      aiAnalyses: streams.flatMap((stream) => stream.aiAnalyses),
      humanReviews: streams.flatMap((stream) => stream.humanReviews),
      challenges: streams.flatMap((stream) => stream.challenges),
      challengeResolutions: streams.flatMap((stream) => stream.challengeResolutions),
      corrections: streams.flatMap((stream) => stream.corrections),
      finalDecisions: streams.flatMap((stream) => stream.finalDecisions),
    };
  }

  getStatus(): CanopyProofEvidenceVerificationAuthorityStatus {
    const snapshot = this.getAuthoritySnapshot();
    const factRoots = [
      ...snapshot.registrations.map((registration) => registration.evidenceRoot),
      ...snapshot.validationRuns.map((run) => run.validationRoot),
      ...snapshot.aiAnalyses.map((analysis) => analysis.analysisRoot),
      ...snapshot.humanReviews.map((review) => review.reviewRoot),
      ...snapshot.challenges.map((challenge) => challenge.challengeRoot),
      ...snapshot.challengeResolutions.map((resolution) => resolution.resolutionRoot),
      ...snapshot.corrections.map((correction) => correction.correctionRoot),
      ...snapshot.finalDecisions.map((decision) => decision.decisionRoot),
    ].sort();
    return {
      service: "canopyproof-evidence-verification-authority",
      evidenceCount: snapshot.registrations.length,
      validationRunCount: snapshot.validationRuns.length,
      aiAnalysisCount: snapshot.aiAnalyses.length,
      humanReviewCount: snapshot.humanReviews.length,
      challengeCount: snapshot.challenges.length,
      challengeResolutionCount: snapshot.challengeResolutions.length,
      correctionCount: snapshot.corrections.length,
      finalDecisionCount: snapshot.finalDecisions.length,
      authorityRoot:
        factRoots.length > 0
          ? merkleRoot(factRoots)
          : hashJson({ kind: "canopyproof-empty-evidence-verification-authority-v1" }),
      safety: {
        ...verificationSafetyBoundary(),
        factsAppendOnly: true,
        streamForksRejected: true,
        latestCycleRequired: true,
        aiFindingCherryPickingRejected: true,
      },
    };
  }

  private replayFact(fact: VerificationFact): VerificationFact {
    if (fact.factType === "validation_run") {
      return this.runValidation(
        fact.evidenceId,
        {
          id: fact.id,
          rulesetId: fact.rulesetId,
          rulesetVersion: fact.rulesetVersion,
          executedAt: fact.executedAt,
        },
        actorInputFromSnapshot(fact.executor),
      );
    }
    if (fact.factType === "ai_analysis") {
      return this.recordAiAnalysis(
        fact.evidenceId,
        {
          id: fact.id,
          validationRunId: fact.validationRunId,
          modelProvider: fact.modelProvider,
          modelName: fact.modelName,
          modelVersion: fact.modelVersion,
          modelArtifactHash: fact.modelArtifactHash,
          promptHash: fact.promptHash,
          datasetSnapshotRoots: fact.datasetSnapshotRoots,
          sourceEventRoots: fact.sourceEventRoots,
          executionEnvironment: fact.executionEnvironment,
          findings: fact.findings.map((finding) => ({
            capability: finding.capability,
            severity: finding.severity,
            code: finding.code,
            message: finding.message,
            recommendedAction: finding.recommendedAction,
            sourceEventRoots: finding.sourceEventRoots,
          })),
          confidenceScore: fact.claimedConfidenceScore,
          analyzedAt: fact.analyzedAt,
        },
        actorInputFromSnapshot(fact.agent),
      );
    }
    if (fact.factType === "human_review") {
      return this.recordHumanReview(
        fact.evidenceId,
        {
          id: fact.id,
          validationRunId: fact.validationRunId,
          aiAnalysisIds: fact.aiAnalysisIds,
          decision: fact.decision,
          findingDispositions: fact.findingDispositions.map((disposition) => ({
            analysisId: disposition.analysisId,
            findingId: disposition.findingId,
            disposition: disposition.disposition,
            rationale: disposition.rationale,
            evidenceEventRoots: disposition.evidenceEventRoots,
          })),
          rationale: fact.rationale,
          limitations: fact.limitations,
          reviewedAt: fact.reviewedAt,
        },
        actorInputFromSnapshot(fact.reviewer),
      );
    }
    if (fact.factType === "evidence_challenge") {
      return this.openChallenge(
        fact.evidenceId,
        {
          id: fact.id,
          reason: fact.reason,
          severity: fact.severity,
          rationale: fact.rationale,
          supportingArtifactHashes: fact.supportingArtifactHashes,
          evidenceEventRoots: fact.evidenceEventRoots,
          challengedAt: fact.challengedAt,
        },
        actorInputFromSnapshot(fact.challenger),
      );
    }
    if (fact.factType === "evidence_challenge_resolution") {
      return this.resolveChallenge(
        fact.challengeId,
        {
          id: fact.id,
          decision: fact.decision,
          rationale: fact.rationale,
          limitations: fact.limitations,
          evidenceEventRoots: fact.evidenceEventRoots,
          reviewedAt: fact.reviewedAt,
        },
        actorInputFromSnapshot(fact.reviewer),
      );
    }
    if (fact.factType === "evidence_final_decision") {
      return this.recordFinalDecision(
        fact.evidenceId,
        {
          id: fact.id,
          decision: fact.decision,
          rationale: fact.rationale,
          limitations: fact.limitations,
          sourceEventRoots: fact.sourceEventRoots,
          decidedAt: fact.decidedAt,
        },
        actorInputFromSnapshot(fact.verifier),
      );
    }
    return this.recordCorrection(
      fact.resolutionId,
      {
        id: fact.id,
        action: fact.action,
        ...(fact.replacementEvidenceId ? { replacementEvidenceId: fact.replacementEvidenceId } : {}),
        rationale: fact.rationale,
        evidenceEventRoots: fact.evidenceEventRoots,
        correctedAt: fact.correctedAt,
      },
      actorInputFromSnapshot(fact.publisher),
    );
  }

  private requireStream(evidenceId: string) {
    const stream = this.streamsByEvidenceId.get(evidenceId);
    if (!stream) throw new Error(`CanopyProof evidence verification stream not found: ${evidenceId}`);
    return stream;
  }

  private requireLatestValidation(stream: EvidenceStream, validationRunId: string) {
    const validation = this.validationRunsById.get(validationRunId);
    if (!validation || validation.evidenceId !== stream.registration.id) {
      throw new Error(`CanopyProof validation run not found for evidence: ${validationRunId}`);
    }
    if (stream.validationRuns.at(-1)?.id !== validation.id) {
      throw new Error("CanopyProof operation must bind the latest evidence validation run.");
    }
    return validation;
  }

  private currentAiAnalyses(stream: EvidenceStream, validationRunId: string) {
    return stream.aiAnalyses.filter((analysis) => analysis.validationRunId === validationRunId);
  }

  private terminalEventRoot(stream: EvidenceStream) {
    const root = stream.events.at(-1)?.eventRoot;
    if (!root) throw new Error(`CanopyProof evidence stream has no registration event: ${stream.registration.id}`);
    return root;
  }

  private assertFactIdAvailable(id: string) {
    if (
      this.validationRunsById.has(id) ||
      this.aiAnalysesById.has(id) ||
      this.humanReviewsById.has(id) ||
      this.challengesById.has(id) ||
      this.challengeResolutionsById.has(id) ||
      this.correctionsById.has(id) ||
      this.finalDecisionsById.has(id)
    ) {
      throw new Error(`CanopyProof verification fact id already exists: ${id}`);
    }
  }
}

function deriveValidationChecks(registration: CanopyProofEvidenceRegistration): readonly CanopyProofEvidenceValidationCheck[] {
  const projectStatusState: CanopyProofValidationCheckState = ["suspended", "archived"].includes(
    registration.projectStatusAtSubmission,
  )
    ? "blocked"
    : ["submitted", "under_review", "challenged"].includes(registration.projectStatusAtSubmission)
      ? "needs_review"
      : "pass";
  const accuracy = registration.location.accuracyMeters;
  const confidenceState: CanopyProofValidationCheckState =
    registration.confidence_score < 10
      ? "blocked"
      : registration.confidence_score < canopyProofEvidenceValidationRuleset.passConfidence
        ? "needs_review"
        : "pass";
  return [
    {
      code: "registration_integrity",
      state: "pass",
      detail: "Evidence registration hash lineage was replayed before validation.",
    },
    {
      code: "project_status_eligible",
      state: projectStatusState,
      detail: `Project status at evidence submission was ${registration.projectStatusAtSubmission}.`,
    },
    {
      code: "structural_registration",
      state: registration.verification_status === "validated" ? "pass" : "needs_review",
      detail: `Immutable registration structural status is ${registration.verification_status}.`,
    },
    {
      code: "location_accuracy",
      state: accuracy === undefined || accuracy > 100 ? "needs_review" : "pass",
      detail: accuracy === undefined ? "GPS accuracy was not committed." : `GPS accuracy is ${accuracy} meters.`,
    },
    {
      code: "project_region_binding",
      state:
        registration.location.regionId === undefined
          ? "needs_review"
          : registration.location.regionId === registration.projectRegionIdAtSubmission
            ? "pass"
            : "needs_review",
      detail:
        registration.location.regionId === undefined
          ? "Evidence location did not commit a project region identifier."
          : "Evidence location region was compared with the immutable project boundary.",
    },
    {
      code: "minimum_confidence",
      state: confidenceState,
      detail: `Registration confidence is ${registration.confidence_score}.`,
    },
  ];
}

function deriveValidationOutcome(checks: readonly CanopyProofEvidenceValidationCheck[]): CanopyProofValidationOutcome {
  if (checks.some((check) => check.state === "blocked")) return "blocked";
  if (checks.some((check) => check.state === "needs_review")) return "needs_review";
  return "pass";
}

function deriveValidationConfidence(score: number, outcome: CanopyProofValidationOutcome) {
  return outcome === "pass" ? score : outcome === "needs_review" ? Math.min(score, 50) : Math.min(score, 10);
}

function normalizeActorSnapshot(input: unknown): CanopyProofVerificationActorSnapshot {
  const parsed = actorSnapshotSchema.parse(input);
  assertSafeVerificationText([
    parsed.id,
    parsed.organizationId,
    parsed.membershipId ?? "",
    parsed.accreditationId ?? "",
    ...parsed.accreditationScope,
  ]);
  const accreditationScope = normalizeUniqueStrings(parsed.accreditationScope, "accreditation scope");
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: normalizeHash(parsed.membershipRoot) } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: normalizeHash(parsed.accreditationRoot) } : {}),
    accreditationScope,
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function actorInputFromSnapshot(actor: CanopyProofVerificationActorSnapshot) {
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

function assertValidationExecutor(actor: CanopyProofVerificationActorSnapshot, organizationId: string) {
  assertActorOrganization(actor, organizationId);
  if (actor.participantType === "agent") {
    if (actor.role !== "agent") throw new Error("CanopyProof validation agent requires the exact agent role.");
    return;
  }
  if (actor.role === "agent" || !["owner", "admin", "verifier", "researcher"].includes(actor.role)) {
    throw new Error("CanopyProof validation human has no permitted execution role.");
  }
  requireActiveMembership(actor);
}

function assertAiAgent(actor: CanopyProofVerificationActorSnapshot, organizationId: string) {
  assertActorOrganization(actor, organizationId);
  if (actor.participantType !== "agent" || actor.role !== "agent") {
    throw new Error("CanopyProof AI analysis requires a verified agent with the exact agent role.");
  }
}

function assertHumanReviewer(
  actor: CanopyProofVerificationActorSnapshot,
  registration: CanopyProofEvidenceRegistration,
  decision: CanopyProofHumanReviewDecision,
) {
  assertActorOrganization(actor, registration.organizationId);
  if (actor.participantType !== "human" || !["verifier", "researcher"].includes(actor.role)) {
    throw new Error("CanopyProof human review requires a verified human verifier or researcher.");
  }
  requireActiveMembership(actor);
  if (actor.id === registration.contributor) {
    throw new Error("CanopyProof evidence contributor cannot independently review their own evidence.");
  }
  if (decision === "approve") {
    if (actor.role !== "verifier") {
      throw new Error("CanopyProof evidence approval requires the exact verifier role.");
    }
    if (
      actor.accreditationStatus !== "approved" ||
      !actor.accreditationId ||
      !actor.accreditationRoot ||
      actor.accreditationScope.length === 0
    ) {
      throw new Error("CanopyProof evidence approval requires current approved accreditation authority.");
    }
  }
}

function assertChallengeActor(actor: CanopyProofVerificationActorSnapshot) {
  if (actor.participantType !== "human" || !["owner", "admin", "verifier", "researcher"].includes(actor.role)) {
    throw new Error("CanopyProof evidence challenge requires a verified human organization member.");
  }
  requireActiveMembership(actor);
}

function assertChallengeReviewer(
  actor: CanopyProofVerificationActorSnapshot,
  stream: EvidenceStream,
  challenge: CanopyProofEvidenceChallenge,
  priorResolutions: readonly CanopyProofEvidenceChallengeResolution[],
  decision: CanopyProofEvidenceChallengeResolutionDecision,
) {
  assertActorOrganization(actor, challenge.organizationId);
  if (actor.participantType !== "human" || !["verifier", "researcher"].includes(actor.role)) {
    throw new Error("CanopyProof challenge resolution requires a verified human verifier or researcher.");
  }
  requireActiveMembership(actor);
  const challengedReviewer = challenge.challengedHumanReviewId
    ? stream.humanReviews.find((review) => review.id === challenge.challengedHumanReviewId)?.reviewer.id
    : undefined;
  const challengedAiAgents = challenge.challengedAiAnalysisIds
    .map((id) => stream.aiAnalyses.find((analysis) => analysis.id === id)?.agent.id)
    .filter((id): id is string => Boolean(id));
  const conflictedActors = new Set([
    stream.registration.contributor,
    challenge.challenger.id,
    ...(challengedReviewer ? [challengedReviewer] : []),
    ...challengedAiAgents,
    ...priorResolutions.map((resolution) => resolution.reviewer.id),
  ]);
  if (conflictedActors.has(actor.id)) {
    throw new Error("CanopyProof challenge resolution requires an independent human reviewer.");
  }
  if (decision !== "needs_more_evidence") {
    if (
      actor.role !== "verifier" ||
      actor.accreditationStatus !== "approved" ||
      !actor.accreditationId ||
      !actor.accreditationRoot ||
      actor.accreditationScope.length === 0
    ) {
      throw new Error("CanopyProof terminal challenge resolution requires current accredited verifier authority.");
    }
  }
}

function assertCorrectionPublisher(
  actor: CanopyProofVerificationActorSnapshot,
  stream: EvidenceStream,
  challenge: CanopyProofEvidenceChallenge,
  resolution: CanopyProofEvidenceChallengeResolution,
) {
  assertActorOrganization(actor, challenge.organizationId);
  if (actor.participantType !== "human" || !["owner", "admin", "verifier"].includes(actor.role)) {
    throw new Error("CanopyProof evidence correction requires a verified human owner, admin, or verifier.");
  }
  requireActiveMembership(actor);
  if (
    actor.role === "verifier" &&
    (actor.accreditationStatus !== "approved" ||
      !actor.accreditationId ||
      !actor.accreditationRoot ||
      actor.accreditationScope.length === 0)
  ) {
    throw new Error("CanopyProof verifier correction publisher requires current approved accreditation.");
  }
  const challengedReviewer = challenge.challengedHumanReviewId
    ? stream.humanReviews.find((review) => review.id === challenge.challengedHumanReviewId)?.reviewer.id
    : undefined;
  const conflictedActors = new Set([
    stream.registration.contributor,
    challenge.challenger.id,
    resolution.reviewer.id,
    ...(challengedReviewer ? [challengedReviewer] : []),
  ]);
  if (conflictedActors.has(actor.id)) {
    throw new Error("CanopyProof evidence correction requires an independent human publisher.");
  }
}

function assertFinalDecisionVerifier(
  actor: CanopyProofVerificationActorSnapshot,
  stream: EvidenceStream,
  humanReview: CanopyProofEvidenceHumanReview,
  analyses: readonly CanopyProofAdvisoryAiAnalysis[],
  latestPriorDecision: CanopyProofEvidenceFinalDecision | undefined,
) {
  assertActorOrganization(actor, stream.registration.organizationId);
  if (actor.participantType !== "human" || actor.role !== "verifier") {
    throw new Error("CanopyProof final decision requires a verified human with the exact verifier role.");
  }
  requireActiveMembership(actor);
  if (
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    actor.accreditationScope.length === 0
  ) {
    throw new Error("CanopyProof final decision requires current approved accreditation authority.");
  }
  const conflictedActors = new Set([
    stream.registration.contributor,
    humanReview.reviewer.id,
    ...analyses.map((analysis) => analysis.agent.id),
    ...stream.challenges.map((challenge) => challenge.challenger.id),
    ...stream.challengeResolutions.map((resolution) => resolution.reviewer.id),
    ...stream.corrections.map((correction) => correction.publisher.id),
    ...(latestPriorDecision ? [latestPriorDecision.verifier.id] : []),
  ]);
  if (conflictedActors.has(actor.id)) {
    throw new Error("CanopyProof final decision requires an independent accredited verifier.");
  }
}

function assertActorOrganization(actor: CanopyProofVerificationActorSnapshot, organizationId: string) {
  if (actor.organizationId !== organizationId) {
    throw new Error("CanopyProof verification actor is outside the evidence-owning organization.");
  }
}

function requireActiveMembership(actor: CanopyProofVerificationActorSnapshot) {
  if (!actor.membershipId || actor.membershipStatus !== "active" || !actor.membershipRoot) {
    throw new Error("CanopyProof human verification authority requires an active membership snapshot.");
  }
}

function buildAiFinding(
  input: z.infer<typeof aiFindingInputSchema>,
  analysisSourceRoots: readonly string[],
  knownRoots: ReadonlySet<string>,
): CanopyProofAdvisoryAiFinding {
  const sourceEventRoots = normalizeUniqueHashes(input.sourceEventRoots, "AI finding source event root");
  requirePriorRoots(sourceEventRoots, knownRoots, "AI finding source event");
  if (sourceEventRoots.some((root) => !analysisSourceRoots.includes(root))) {
    throw new Error("CanopyProof AI finding source must be included in the analysis source set.");
  }
  const seed = {
    capability: input.capability,
    severity: input.severity,
    code: input.code,
    message: input.message,
    recommendedAction: input.recommendedAction,
    sourceEventRoots,
  };
  const findingHash = hashJson({ kind: "canopyproof-advisory-ai-finding-v1", ...seed });
  return {
    id: `cp_ai_finding_${findingHash.slice(0, 24)}`,
    ...seed,
    findingHash,
  };
}

function deriveAiConfidence(
  claimedScore: number,
  validationScore: number,
  findings: readonly CanopyProofAdvisoryAiFinding[],
) {
  const penalty = findings.reduce(
    (sum, finding) => sum + ({ low: 1, medium: 4, high: 10, critical: 20 } as const)[finding.severity],
    0,
  );
  return Math.max(0, Math.min(claimedScore, validationScore) - Math.min(penalty, 60));
}

function buildFindingDisposition(
  input: z.infer<typeof findingDispositionInputSchema>,
  findingsByKey: ReadonlyMap<
    string,
    Readonly<{ analysis: CanopyProofAdvisoryAiAnalysis; finding: CanopyProofAdvisoryAiFinding }>
  >,
  knownRoots: ReadonlySet<string>,
): CanopyProofHumanFindingDisposition {
  const match = findingsByKey.get(`${input.analysisId}:${input.findingId}`);
  if (!match) throw new Error(`CanopyProof human disposition references an unknown AI finding: ${input.findingId}`);
  const evidenceEventRoots = normalizeUniqueHashes(input.evidenceEventRoots, "finding disposition evidence event root");
  requirePriorRoots(evidenceEventRoots, knownRoots, "finding disposition evidence event");
  assertSafeVerificationText([input.rationale]);
  if (input.disposition !== "escalated" && (input.rationale.length < 12 || evidenceEventRoots.length === 0)) {
    throw new Error("CanopyProof accepted or overruled finding requires rationale and prior semantic evidence roots.");
  }
  if (input.disposition === "escalated" && input.rationale.length < 12) {
    throw new Error("CanopyProof escalated finding requires accountable rationale.");
  }
  const seed = {
    analysisId: match.analysis.id,
    findingId: match.finding.id,
    disposition: input.disposition,
    rationale: input.rationale,
    evidenceEventRoots,
  };
  return {
    ...seed,
    dispositionHash: hashJson({ kind: "canopyproof-human-finding-disposition-v1", ...seed }),
  };
}

function enforceHumanDecisionPolicy(
  decision: CanopyProofHumanReviewDecision,
  validation: CanopyProofEvidenceValidationRun,
  analyses: readonly CanopyProofAdvisoryAiAnalysis[],
  dispositions: readonly CanopyProofHumanFindingDisposition[],
  reviewer: CanopyProofVerificationActorSnapshot,
) {
  if (decision !== "approve") return;
  if (reviewer.role !== "verifier" || reviewer.accreditationStatus !== "approved") {
    throw new Error("CanopyProof approval lacks accredited verifier authority.");
  }
  if (validation.outcome !== "pass") {
    throw new Error("CanopyProof evidence approval requires a passing deterministic validation run.");
  }
  const requiredKeys = analyses.flatMap((analysis) =>
    analysis.findings
      .filter((finding) => finding.severity === "high" || finding.severity === "critical")
      .map((finding) => `${analysis.id}:${finding.id}`),
  );
  const dispositionsByKey = new Map(
    dispositions.map((disposition) => [`${disposition.analysisId}:${disposition.findingId}`, disposition]),
  );
  const missing = requiredKeys.filter((key) => !dispositionsByKey.has(key));
  if (missing.length > 0) {
    throw new Error(`CanopyProof high or critical AI findings require explicit human disposition: ${missing.join(",")}`);
  }
  const escalated = requiredKeys.filter((key) => dispositionsByKey.get(key)?.disposition === "escalated");
  if (escalated.length > 0) {
    throw new Error(`CanopyProof escalated AI findings block evidence approval: ${escalated.join(",")}`);
  }
}

function deriveRelianceState(
  validation: CanopyProofEvidenceValidationRun | undefined,
  analyses: readonly CanopyProofAdvisoryAiAnalysis[],
  review: CanopyProofEvidenceHumanReview | undefined,
): CanopyProofEvidenceRelianceState {
  if (!validation) return "registered";
  if (validation.outcome === "blocked") return "blocked";
  if (validation.outcome === "needs_review" && analyses.length === 0) return "needs_review";
  if (!review && analyses.length > 0) return "ai_advised";
  if (!review) return validation.outcome === "pass" ? "validation_passed" : "needs_review";
  return {
    approve: "approved",
    reject: "rejected",
    challenge: "challenged",
    request_changes: "changes_requested",
  }[review.decision] as CanopyProofEvidenceRelianceState;
}

function deriveChallengeProjection(stream: EvidenceStream) {
  const openChallengeIds: string[] = [];
  const upheldChallengeIds: string[] = [];
  const dismissedChallengeIds: string[] = [];
  const correctedChallengeIds: string[] = [];
  for (const challenge of stream.challenges) {
    const resolutions = stream.challengeResolutions.filter((resolution) => resolution.challengeId === challenge.id);
    const latestResolution = resolutions.at(-1);
    const correction = stream.corrections.find((item) => item.challengeId === challenge.id);
    if (correction) {
      correctedChallengeIds.push(challenge.id);
    } else if (!latestResolution || latestResolution.decision === "needs_more_evidence") {
      openChallengeIds.push(challenge.id);
    } else if (latestResolution.decision === "upheld") {
      upheldChallengeIds.push(challenge.id);
    } else {
      dismissedChallengeIds.push(challenge.id);
    }
  }
  return {
    openChallengeIds: openChallengeIds.sort(),
    upheldChallengeIds: upheldChallengeIds.sort(),
    dismissedChallengeIds: dismissedChallengeIds.sort(),
    correctedChallengeIds: correctedChallengeIds.sort(),
    latestCorrection: stream.corrections.at(-1),
  };
}

function appendFactEvent(
  stream: EvidenceStream,
  input: Readonly<{
    action: CanopyProofAhinAction;
    actor: string;
    entityType:
      | "validation_run"
      | "ai_analysis"
      | "human_review"
      | "evidence_challenge"
      | "evidence_challenge_resolution"
      | "evidence_correction"
      | "evidence_final_decision";
    entityId: string;
    payload: unknown;
    createdAt: string;
    rationale: string;
  }>,
) {
  const next = appendCanopyProofAuditEvent(stream.events, input).at(-1);
  if (!next) throw new Error(`CanopyProof ${input.entityType} failed to append a semantic audit event.`);
  return next;
}

function assertAppendTime(stream: EvidenceStream, timestamp: string) {
  const previous = stream.events.at(-1);
  if (!previous || Date.parse(timestamp) < Date.parse(previous.createdAt)) {
    throw new Error("CanopyProof verification fact time must be monotonic within its evidence stream.");
  }
}

function requirePriorRoots(roots: readonly string[], knownRoots: ReadonlySet<string>, label: string) {
  const unknown = roots.find((root) => !knownRoots.has(root));
  if (unknown) throw new Error(`CanopyProof ${label} root is not a prior semantic event: ${unknown}`);
}

function normalizeHash(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}

function normalizeUniqueHashes(values: readonly string[], label: string) {
  const normalized = values.map(normalizeHash);
  assertUnique(normalized, label);
  return normalized.sort();
}

function normalizeUniqueStrings(values: readonly string[], label: string) {
  const normalized = values.map((value) => value.trim()).sort();
  assertUnique(normalized, label);
  return normalized;
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`CanopyProof ${label} values must be unique.`);
  }
}

function assertSafeVerificationText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) {
    throw new Error(`CanopyProof verification fact contains unsupported public claim or secret material: ${unsafe}`);
  }
}

function verificationSafetyBoundary(): CanopyProofVerificationSafetyBoundary {
  return {
    evidenceRegistrationImmutable: true,
    aiAdvisoryOnly: true,
    independentHumanApprovalRequired: true,
    notFinalVerification: true,
    notCertificate: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function evidenceChallengeSafetyBoundary(): CanopyProofEvidenceChallengeSafetyBoundary {
  return {
    ...verificationSafetyBoundary(),
    factsAppendOnly: true,
    originalEvidencePreserved: true,
    challengeSuspendsReliance: true,
    independentHumanResolutionRequired: true,
    upheldChallengeRequiresCorrection: true,
    replacementRequiresIndependentApproval: true,
    crossOrganizationChallengeGrantsNoAccess: true,
  };
}

function evidenceFinalDecisionSafetyBoundary(): CanopyProofEvidenceFinalDecisionSafetyBoundary {
  return {
    evidenceRegistrationImmutable: true,
    aiAdvisoryOnly: true,
    makerCheckerRequired: true,
    currentAccreditedVerifierRequired: true,
    challengeAwareRelianceBound: true,
    laterFactsInvalidateDecision: true,
    notEnvironmentalProofRecord: true,
    notCertificate: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}
