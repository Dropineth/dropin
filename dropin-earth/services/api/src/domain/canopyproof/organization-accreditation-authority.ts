import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  canopyProofOrganizationVerificationStatuses,
  type CanopyProofOrganizationVerificationStatus,
} from "./partner-collaboration.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofOrganizationAccreditationScopes = {
  review: "organization:accreditation:review",
  decide: "organization:accreditation:decide",
  govern: "organization:accreditation:govern",
} as const;
export const canopyProofOrganizationAccreditationApplicationKinds = ["initial", "renewal"] as const;
export const canopyProofOrganizationAccreditationReviewDecisions = ["accepted", "rejected"] as const;
export const canopyProofOrganizationAccreditationReviewReasonCodes = [
  "evidence_sufficient",
  "evidence_insufficient",
  "scope_unsupported",
  "conflict_detected",
] as const;
export const canopyProofOrganizationAccreditationDecisions = ["approved", "denied"] as const;
export const canopyProofOrganizationAccreditationDecisionReasonCodes = [
  "requirements_satisfied",
  "requirements_not_satisfied",
  "policy_ineligible",
] as const;
export const canopyProofOrganizationAccreditationControlActions = ["suspend", "revoke"] as const;
export const canopyProofOrganizationAccreditationControlReasonCodes = [
  "compliance_concern",
  "material_misrepresentation",
  "governance_breach",
  "legal_restriction",
] as const;
export const canopyProofOrganizationAccreditationProjectionStatuses = [
  "pending",
  "approved",
  "denied",
  "expired",
  "suspended",
  "revoked",
] as const;

export type CanopyProofOrganizationAccreditationProjectionStatus =
  (typeof canopyProofOrganizationAccreditationProjectionStatuses)[number];

export type CanopyProofOrganizationAccreditationSafetyBoundary = Readonly<{
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  exactRetryRequired: true;
  explicitAsOfRequired: true;
  currentAuthorityReResolutionRequired: true;
  independentHumanReviewRequired: true;
  reviewerDeciderSeparationRequired: true;
  aiIsNeverFinalAuthority: true;
  revocationTerminal: true;
  compatibilityAccreditationIsNotCanonical: true;
  rawEvidenceForbidden: true;
  noMainnetFunds: true;
  notAutomaticCanopyDistribution: true;
  noPrivateKeyHandling: true;
  notCertifiedCarbonCredit: true;
  notCarbonTaxOffset: true;
  notFinancialAsset: true;
  notGuaranteedYield: true;
}>;

export type CanopyProofOrganizationAccreditationActorSnapshot = Readonly<{
  id: string;
  participantType: "human";
  role: "owner" | "admin" | "verifier" | "researcher";
  verificationStatus: "verified";
  organizationId: string;
  organizationVerificationStatus: CanopyProofOrganizationVerificationStatus;
  participantRoot: string;
  organizationRoot: string;
  membershipId: string;
  membershipStatus: "active";
  membershipRoot: string;
  authoritySource: "subject_membership" | "root_governance_bootstrap" | "canonical_accreditation";
  accreditationId?: string;
  accreditationStatus?: "approved";
  accreditationDecisionRoot?: string;
  accreditationProjectionRoot?: string;
  accreditationValidFrom?: string;
  accreditationValidUntil?: string;
  accreditationScope: readonly string[];
  authorityRoot: string;
}>;

type AccreditationFactCommon = Readonly<{
  id: string;
  organizationId: string;
  organizationAccreditationSequence: number;
  previousEventRoot: string;
  commandHash: string;
  safety: CanopyProofOrganizationAccreditationSafetyBoundary;
  auditEvent: CanopyProofAuditEvent;
}>;

export type CanopyProofOrganizationAccreditationApplicationFact = AccreditationFactCommon &
  Readonly<{
    factType: "organization_accreditation_application";
    applicationKind: (typeof canopyProofOrganizationAccreditationApplicationKinds)[number];
    priorDecisionId?: string;
    priorDecisionRoot?: string;
    profileRoot: string;
    scope: readonly string[];
    scopeRoot: string;
    evidenceEventRoots: readonly string[];
    evidenceRoot: string;
    policyRoot: string;
    requestedValidUntil: string;
    submitter: CanopyProofOrganizationAccreditationActorSnapshot;
    submittedAt: string;
    applicationHash: string;
    applicationRoot: string;
  }>;

export type CanopyProofOrganizationAccreditationReviewFact = AccreditationFactCommon &
  Readonly<{
    factType: "organization_accreditation_review";
    applicationId: string;
    applicationRoot: string;
    profileRoot: string;
    policyRoot: string;
    scopeRoot: string;
    decision: (typeof canopyProofOrganizationAccreditationReviewDecisions)[number];
    reasonCode: (typeof canopyProofOrganizationAccreditationReviewReasonCodes)[number];
    rationale: string;
    conflictDisclosure: string;
    sourceEventRoots: readonly string[];
    sourceRoot: string;
    reviewer: CanopyProofOrganizationAccreditationActorSnapshot;
    reviewedAt: string;
    reviewHash: string;
    reviewRoot: string;
  }>;

export type CanopyProofOrganizationAccreditationDecisionFact = AccreditationFactCommon &
  Readonly<{
    factType: "organization_accreditation_decision";
    applicationId: string;
    applicationRoot: string;
    acceptedReviewId: string;
    acceptedReviewRoot: string;
    profileRoot: string;
    policyRoot: string;
    scope: readonly string[];
    scopeRoot: string;
    decision: (typeof canopyProofOrganizationAccreditationDecisions)[number];
    reasonCode: (typeof canopyProofOrganizationAccreditationDecisionReasonCodes)[number];
    rationale: string;
    sourceEventRoots: readonly string[];
    sourceRoot: string;
    validFrom: string | null;
    validUntil: string | null;
    decider: CanopyProofOrganizationAccreditationActorSnapshot;
    decidedAt: string;
    decisionHash: string;
    decisionRoot: string;
  }>;

export type CanopyProofOrganizationAccreditationControlFact = AccreditationFactCommon &
  Readonly<{
    factType: "organization_accreditation_control";
    decisionId: string;
    decisionRoot: string;
    previousControlId?: string;
    previousControlRoot?: string;
    action: (typeof canopyProofOrganizationAccreditationControlActions)[number];
    reasonCode: (typeof canopyProofOrganizationAccreditationControlReasonCodes)[number];
    rationale: string;
    evidenceEventRoots: readonly string[];
    evidenceRoot: string;
    governor: CanopyProofOrganizationAccreditationActorSnapshot;
    controlledAt: string;
    controlHash: string;
    controlRoot: string;
  }>;

export type CanopyProofOrganizationAccreditationFact =
  | CanopyProofOrganizationAccreditationApplicationFact
  | CanopyProofOrganizationAccreditationReviewFact
  | CanopyProofOrganizationAccreditationDecisionFact
  | CanopyProofOrganizationAccreditationControlFact;

export type CanopyProofOrganizationAccreditationProjection = Readonly<{
  organizationId: string;
  applicationId: string;
  applicationRoot: string;
  status: CanopyProofOrganizationAccreditationProjectionStatus;
  scope: readonly string[];
  scopeRoot: string;
  policyRoot: string;
  decisionId: string | null;
  decisionRoot: string | null;
  controlId: string | null;
  controlRoot: string | null;
  validFrom: string | null;
  validUntil: string | null;
  asOf: string;
  latestOrganizationAccreditationSequence: number;
  latestEventRoot: string;
  projectionRoot: string;
  safety: CanopyProofOrganizationAccreditationSafetyBoundary;
}>;

export type CanopyProofOrganizationAccreditationAuthoritySnapshot = Readonly<{
  applicationFacts: readonly CanopyProofOrganizationAccreditationApplicationFact[];
  reviewFacts: readonly CanopyProofOrganizationAccreditationReviewFact[];
  decisionFacts: readonly CanopyProofOrganizationAccreditationDecisionFact[];
  controlFacts: readonly CanopyProofOrganizationAccreditationControlFact[];
}>;

type AccreditationStream = {
  readonly organizationId: string;
  readonly events: CanopyProofAuditEvent[];
  readonly applications: CanopyProofOrganizationAccreditationApplicationFact[];
  readonly reviews: CanopyProofOrganizationAccreditationReviewFact[];
  readonly decisions: CanopyProofOrganizationAccreditationDecisionFact[];
  readonly controls: CanopyProofOrganizationAccreditationControlFact[];
};

const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const rationaleSchema = z.string().trim().min(24).max(4_000);
const scopeSchema = z.array(z.string().trim().min(1).max(160)).min(1).max(64);
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(["owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.enum(canopyProofOrganizationVerificationStatuses),
    participantRoot: rootSchema,
    organizationRoot: rootSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: rootSchema,
    authoritySource: z.enum(["subject_membership", "root_governance_bootstrap", "canonical_accreditation"]),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.literal("approved").optional(),
    accreditationDecisionRoot: rootSchema.optional(),
    accreditationProjectionRoot: rootSchema.optional(),
    accreditationValidFrom: timestampSchema.optional(),
    accreditationValidUntil: timestampSchema.optional(),
    accreditationScope: scopeSchema.or(z.array(z.never())),
    authorityRoot: rootSchema,
  })
  .strict();

const applicationInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    applicationKind: z.enum(canopyProofOrganizationAccreditationApplicationKinds),
    priorDecisionId: identifierSchema.optional(),
    profileRoot: rootSchema,
    scope: scopeSchema,
    evidenceEventRoots: z.array(rootSchema).min(1).max(128),
    policyRoot: rootSchema,
    requestedValidUntil: timestampSchema,
    submittedAt: timestampSchema,
  })
  .strict();

const reviewInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    applicationId: identifierSchema,
    profileRoot: rootSchema,
    policyRoot: rootSchema,
    decision: z.enum(canopyProofOrganizationAccreditationReviewDecisions),
    reasonCode: z.enum(canopyProofOrganizationAccreditationReviewReasonCodes),
    rationale: rationaleSchema,
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    reviewedAt: timestampSchema,
  })
  .strict();

const decisionInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    applicationId: identifierSchema,
    acceptedReviewId: identifierSchema,
    profileRoot: rootSchema,
    policyRoot: rootSchema,
    scope: scopeSchema,
    decision: z.enum(canopyProofOrganizationAccreditationDecisions),
    reasonCode: z.enum(canopyProofOrganizationAccreditationDecisionReasonCodes),
    rationale: rationaleSchema,
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    validUntil: timestampSchema.nullable(),
    decidedAt: timestampSchema,
  })
  .strict();

const controlInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    decisionId: identifierSchema,
    action: z.enum(canopyProofOrganizationAccreditationControlActions),
    reasonCode: z.enum(canopyProofOrganizationAccreditationControlReasonCodes),
    rationale: rationaleSchema,
    evidenceEventRoots: z.array(rootSchema).min(1).max(128),
    controlledAt: timestampSchema,
  })
  .strict();

const safetySchema = z.object({
  routeMounted: z.literal(false),
  schedulerMounted: z.literal(false),
  productionActivationEnabled: z.literal(false),
  appendOnly: z.literal(true),
  exactRetryRequired: z.literal(true),
  explicitAsOfRequired: z.literal(true),
  currentAuthorityReResolutionRequired: z.literal(true),
  independentHumanReviewRequired: z.literal(true),
  reviewerDeciderSeparationRequired: z.literal(true),
  aiIsNeverFinalAuthority: z.literal(true),
  revocationTerminal: z.literal(true),
  compatibilityAccreditationIsNotCanonical: z.literal(true),
  rawEvidenceForbidden: z.literal(true),
  noMainnetFunds: z.literal(true),
  notAutomaticCanopyDistribution: z.literal(true),
  noPrivateKeyHandling: z.literal(true),
  notCertifiedCarbonCredit: z.literal(true),
  notCarbonTaxOffset: z.literal(true),
  notFinancialAsset: z.literal(true),
  notGuaranteedYield: z.literal(true),
}).strict();

const auditEventSchema = z.object({
  id: identifierSchema,
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor: identifierSchema,
  entityType: z.enum([
    "organization_accreditation_application",
    "organization_accreditation_review",
    "organization_accreditation_decision",
    "organization_accreditation_control",
  ]),
  entityId: identifierSchema,
  previousRoot: rootSchema,
  payloadHash: rootSchema,
  eventRoot: rootSchema,
  createdAt: timestampSchema,
  rationale: z.string().trim().min(1).max(4_000),
}).strict();

const commonFactSchema = {
  id: identifierSchema,
  organizationId: identifierSchema,
  organizationAccreditationSequence: z.number().int().positive(),
  previousEventRoot: rootSchema,
  commandHash: rootSchema,
  safety: safetySchema,
  auditEvent: auditEventSchema,
} as const;

const applicationFactSchema = z.object({
  factType: z.literal("organization_accreditation_application"),
  ...commonFactSchema,
  applicationKind: z.enum(canopyProofOrganizationAccreditationApplicationKinds),
  priorDecisionId: identifierSchema.optional(),
  priorDecisionRoot: rootSchema.optional(),
  profileRoot: rootSchema,
  scope: scopeSchema,
  scopeRoot: rootSchema,
  evidenceEventRoots: z.array(rootSchema).min(1).max(128),
  evidenceRoot: rootSchema,
  policyRoot: rootSchema,
  requestedValidUntil: timestampSchema,
  submitter: actorSchema,
  submittedAt: timestampSchema,
  applicationHash: rootSchema,
  applicationRoot: rootSchema,
}).strict();

const reviewFactSchema = z.object({
  factType: z.literal("organization_accreditation_review"),
  ...commonFactSchema,
  applicationId: identifierSchema,
  applicationRoot: rootSchema,
  profileRoot: rootSchema,
  policyRoot: rootSchema,
  scopeRoot: rootSchema,
  decision: z.enum(canopyProofOrganizationAccreditationReviewDecisions),
  reasonCode: z.enum(canopyProofOrganizationAccreditationReviewReasonCodes),
  rationale: rationaleSchema,
  conflictDisclosure: z.string().trim().min(24).max(2_000),
  sourceEventRoots: z.array(rootSchema).min(1).max(128),
  sourceRoot: rootSchema,
  reviewer: actorSchema,
  reviewedAt: timestampSchema,
  reviewHash: rootSchema,
  reviewRoot: rootSchema,
}).strict();

const decisionFactSchema = z.object({
  factType: z.literal("organization_accreditation_decision"),
  ...commonFactSchema,
  applicationId: identifierSchema,
  applicationRoot: rootSchema,
  acceptedReviewId: identifierSchema,
  acceptedReviewRoot: rootSchema,
  profileRoot: rootSchema,
  policyRoot: rootSchema,
  scope: scopeSchema,
  scopeRoot: rootSchema,
  decision: z.enum(canopyProofOrganizationAccreditationDecisions),
  reasonCode: z.enum(canopyProofOrganizationAccreditationDecisionReasonCodes),
  rationale: rationaleSchema,
  sourceEventRoots: z.array(rootSchema).min(1).max(128),
  sourceRoot: rootSchema,
  validFrom: timestampSchema.nullable(),
  validUntil: timestampSchema.nullable(),
  decider: actorSchema,
  decidedAt: timestampSchema,
  decisionHash: rootSchema,
  decisionRoot: rootSchema,
}).strict();

const controlFactSchema = z.object({
  factType: z.literal("organization_accreditation_control"),
  ...commonFactSchema,
  decisionId: identifierSchema,
  decisionRoot: rootSchema,
  previousControlId: identifierSchema.optional(),
  previousControlRoot: rootSchema.optional(),
  action: z.enum(canopyProofOrganizationAccreditationControlActions),
  reasonCode: z.enum(canopyProofOrganizationAccreditationControlReasonCodes),
  rationale: rationaleSchema,
  evidenceEventRoots: z.array(rootSchema).min(1).max(128),
  evidenceRoot: rootSchema,
  governor: actorSchema,
  controlledAt: timestampSchema,
  controlHash: rootSchema,
  controlRoot: rootSchema,
}).strict();

export class CanopyProofOrganizationAccreditationAuthorityService {
  private readonly streamsByOrganizationId = new Map<string, AccreditationStream>();
  private readonly factsById = new Map<string, CanopyProofOrganizationAccreditationFact>();

  static fromAuthoritySnapshot(snapshotInput: CanopyProofOrganizationAccreditationAuthoritySnapshot) {
    const snapshot = parseAuthoritySnapshot(snapshotInput);
    const service = new CanopyProofOrganizationAccreditationAuthorityService();
    const facts: CanopyProofOrganizationAccreditationFact[] = [
      ...snapshot.applicationFacts,
      ...snapshot.reviewFacts,
      ...snapshot.decisionFacts,
      ...snapshot.controlFacts,
    ].sort((left, right) =>
      left.organizationId.localeCompare(right.organizationId) ||
      left.organizationAccreditationSequence - right.organizationAccreditationSequence ||
      left.id.localeCompare(right.id)
    );
    if (new Set(facts.map((fact) => fact.id)).size !== facts.length) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_FACT_ID_DUPLICATE");
    }
    for (const fact of facts) {
      const replayed = replayFact(service, fact);
      if (hashJson(replayed) !== hashJson(fact)) {
        throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_REPLAY_MISMATCH:${fact.id}`);
      }
    }
    for (const stream of service.streamsByOrganizationId.values()) assertStreamIntegrity(stream);
    return service;
  }

  submitApplication(input: unknown, submitterInput: unknown): CanopyProofOrganizationAccreditationApplicationFact {
    const parsed = applicationInputSchema.parse(input);
    const submitter = normalizeActor(submitterInput);
    const submittedAt = canonicalTimestamp(parsed.submittedAt, "SUBMITTED_AT");
    const requestedValidUntil = canonicalTimestamp(parsed.requestedValidUntil, "REQUESTED_VALID_UNTIL");
    const scope = normalizeScope(parsed.scope);
    const evidenceEventRoots = normalizeRoots(parsed.evidenceEventRoots, "EVIDENCE_EVENT_ROOT");
    assertInterval(submittedAt, requestedValidUntil);
    requireSubjectActor(submitter, parsed.organizationId);
    if (submitter.organizationRoot !== parsed.profileRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_PROFILE_AUTHORITY_STALE");
    }
    const stream = this.streamsByOrganizationId.get(parsed.organizationId) ?? createStream(parsed.organizationId);
    assertMonotonic(stream, submittedAt);
    const latestApplication = stream.applications.at(-1);
    const latestDecision = stream.decisions.at(-1);
    let priorDecision: CanopyProofOrganizationAccreditationDecisionFact | undefined;
    if (parsed.applicationKind === "initial") {
      if (parsed.priorDecisionId || latestApplication) {
        throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_INITIAL_APPLICATION_INVALID");
      }
    } else {
      if (!parsed.priorDecisionId || !latestDecision || latestDecision.id !== parsed.priorDecisionId) {
        throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_RENEWAL_PREDECESSOR_REQUIRED");
      }
      if (latestApplication && !stream.decisions.some((decision) => decision.applicationId === latestApplication.id)) {
        throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_ALREADY_PENDING");
      }
      if (latestDecision.decision !== "approved" || hashJson(latestDecision.scope) !== hashJson(scope)) {
        throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_RENEWAL_SCOPE_INVALID");
      }
      const priorProjection = this.getProjection(
        parsed.organizationId,
        latestDecision.applicationId,
        submittedAt,
      );
      if (priorProjection.status === "revoked" || priorProjection.status === "denied") {
        throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_RENEWAL_TERMINAL");
      }
      priorDecision = latestDecision;
    }
    const scopeRoot = merkleRoot(scope);
    const evidenceRoot = merkleRoot([
      ...evidenceEventRoots,
      parsed.profileRoot,
      parsed.policyRoot,
      scopeRoot,
      ...(priorDecision ? [priorDecision.decisionRoot] : []),
    ].sort());
    const commandHash = hashJson({
      kind: "canopyproof-organization-accreditation-application-command-v1",
      organizationId: parsed.organizationId,
      applicationKind: parsed.applicationKind,
      priorDecisionRoot: priorDecision?.decisionRoot ?? null,
      profileRoot: parsed.profileRoot,
      scope,
      evidenceEventRoots,
      policyRoot: parsed.policyRoot,
      requestedValidUntil,
      submitter,
      submittedAt,
    });
    const id = `cp_org_accreditation_application_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "APPLICATION");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      applicationKind: parsed.applicationKind,
      ...(priorDecision ? { priorDecisionId: priorDecision.id, priorDecisionRoot: priorDecision.decisionRoot } : {}),
      profileRoot: parsed.profileRoot,
      scope,
      scopeRoot,
      evidenceEventRoots,
      evidenceRoot,
      policyRoot: parsed.policyRoot,
      requestedValidUntil,
      submitter,
      submittedAt,
    };
    const applicationHash = hashJson({
      kind: "canopyproof-organization-accreditation-application-fact-v1",
      id,
      ...seed,
    });
    const applicationRoot = factRoot("application", parsed.organizationId, applicationHash, common);
    const safety = organizationAccreditationSafetyBoundary();
    const payload = {
      factType: "organization_accreditation_application" as const,
      id,
      ...seed,
      applicationHash,
      applicationRoot,
      safety,
    };
    const auditEvent = appendAuthorityEvent(stream, {
      action: "ASSERT",
      actorId: submitter.id,
      entityType: "organization_accreditation_application",
      entityId: id,
      payload,
      createdAt: submittedAt,
      rationale: "Organization accreditation application submitted with bounded policy and evidence roots.",
    });
    const fact: CanopyProofOrganizationAccreditationApplicationFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    this.streamsByOrganizationId.set(parsed.organizationId, stream);
    return fact;
  }

  reviewApplication(input: unknown, reviewerInput: unknown): CanopyProofOrganizationAccreditationReviewFact {
    const parsed = reviewInputSchema.parse(input);
    const reviewer = normalizeActor(reviewerInput);
    const reviewedAt = canonicalTimestamp(parsed.reviewedAt, "REVIEWED_AT");
    const sourceEventRoots = normalizeRoots(parsed.sourceEventRoots, "SOURCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    assertSafeText(parsed.conflictDisclosure);
    const stream = this.requireStream(parsed.organizationId);
    assertMonotonic(stream, reviewedAt);
    const application = requireLatestApplication(stream, parsed.applicationId);
    if (stream.decisions.some((decision) => decision.applicationId === application.id)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_ALREADY_DECIDED");
    }
    if (stream.reviews.some((review) => review.applicationId === application.id)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_ALREADY_REVIEWED");
    }
    if (parsed.profileRoot !== application.profileRoot || parsed.policyRoot !== application.policyRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVIEW_SOURCE_STALE");
    }
    if (
      (parsed.decision === "accepted" && parsed.reasonCode !== "evidence_sufficient") ||
      (parsed.decision === "rejected" && parsed.reasonCode === "evidence_sufficient")
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVIEW_REASON_INVALID");
    }
    requireGovernanceActor(
      reviewer,
      parsed.organizationId,
      canopyProofOrganizationAccreditationScopes.review,
      ["admin", "verifier", "researcher"],
      reviewedAt,
    );
    if (reviewer.id === application.submitter.id || Date.parse(reviewedAt) <= Date.parse(application.submittedAt)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVIEW_SEPARATION_OR_TIME_INVALID");
    }
    const sourceRoot = merkleRoot([
      ...sourceEventRoots,
      application.applicationRoot,
      application.profileRoot,
      application.policyRoot,
      application.scopeRoot,
    ].sort());
    const commandHash = hashJson({
      kind: "canopyproof-organization-accreditation-review-command-v1",
      organizationId: parsed.organizationId,
      applicationRoot: application.applicationRoot,
      profileRoot: parsed.profileRoot,
      policyRoot: parsed.policyRoot,
      decision: parsed.decision,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceEventRoots,
      reviewer,
      reviewedAt,
    });
    const id = `cp_org_accreditation_review_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "REVIEW");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      applicationId: application.id,
      applicationRoot: application.applicationRoot,
      profileRoot: application.profileRoot,
      policyRoot: application.policyRoot,
      scopeRoot: application.scopeRoot,
      decision: parsed.decision,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceEventRoots,
      sourceRoot,
      reviewer,
      reviewedAt,
    };
    const reviewHash = hashJson({ kind: "canopyproof-organization-accreditation-review-fact-v1", id, ...seed });
    const reviewRoot = factRoot("review", parsed.organizationId, reviewHash, common);
    const safety = organizationAccreditationSafetyBoundary();
    const payload = {
      factType: "organization_accreditation_review" as const,
      id,
      ...seed,
      reviewHash,
      reviewRoot,
      safety,
    };
    const auditEvent = appendAuthorityEvent(stream, {
      action: parsed.decision === "accepted" ? "REASON" : "CHALLENGE",
      actorId: reviewer.id,
      entityType: "organization_accreditation_review",
      entityId: id,
      payload,
      createdAt: reviewedAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationAccreditationReviewFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  decideApplication(input: unknown, deciderInput: unknown): CanopyProofOrganizationAccreditationDecisionFact {
    const parsed = decisionInputSchema.parse(input);
    const decider = normalizeActor(deciderInput);
    const decidedAt = canonicalTimestamp(parsed.decidedAt, "DECIDED_AT");
    const validUntil = parsed.validUntil === null ? null : canonicalTimestamp(parsed.validUntil, "VALID_UNTIL");
    const scope = normalizeScope(parsed.scope);
    const sourceEventRoots = normalizeRoots(parsed.sourceEventRoots, "SOURCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    const stream = this.requireStream(parsed.organizationId);
    assertMonotonic(stream, decidedAt);
    const application = requireLatestApplication(stream, parsed.applicationId);
    if (stream.decisions.some((decision) => decision.applicationId === application.id)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_ALREADY_DECIDED");
    }
    const review = stream.reviews.find((candidate) => candidate.id === parsed.acceptedReviewId);
    const latestReview = stream.reviews.filter((candidate) => candidate.applicationId === application.id).at(-1);
    if (
      !review ||
      latestReview?.id !== review.id ||
      review.applicationId !== application.id ||
      review.decision !== "accepted"
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_ACCEPTED_REVIEW_REQUIRED");
    }
    if (
      parsed.profileRoot !== application.profileRoot ||
      parsed.policyRoot !== application.policyRoot ||
      hashJson(scope) !== hashJson(application.scope)
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_DECISION_SOURCE_STALE");
    }
    requireGovernanceActor(
      decider,
      parsed.organizationId,
      canopyProofOrganizationAccreditationScopes.decide,
      ["admin", "verifier"],
      decidedAt,
    );
    if (
      decider.id === application.submitter.id ||
      decider.id === review.reviewer.id ||
      Date.parse(decidedAt) <= Date.parse(review.reviewedAt)
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVIEWER_DECIDER_SEPARATION_REQUIRED");
    }
    if (
      (parsed.decision === "approved" &&
        (parsed.reasonCode !== "requirements_satisfied" ||
          validUntil === null ||
          validUntil !== application.requestedValidUntil)) ||
      (parsed.decision === "denied" &&
        (parsed.reasonCode === "requirements_satisfied" || validUntil !== null))
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_DECISION_SEMANTICS_INVALID");
    }
    if (validUntil) assertInterval(decidedAt, validUntil);
    const sourceRoot = merkleRoot([
      ...sourceEventRoots,
      application.applicationRoot,
      review.reviewRoot,
      application.profileRoot,
      application.policyRoot,
      application.scopeRoot,
    ].sort());
    const validFrom = parsed.decision === "approved" ? decidedAt : null;
    const commandHash = hashJson({
      kind: "canopyproof-organization-accreditation-decision-command-v1",
      organizationId: parsed.organizationId,
      applicationRoot: application.applicationRoot,
      acceptedReviewRoot: review.reviewRoot,
      profileRoot: parsed.profileRoot,
      policyRoot: parsed.policyRoot,
      scope,
      decision: parsed.decision,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      sourceEventRoots,
      validFrom,
      validUntil,
      decider,
      decidedAt,
    });
    const id = `cp_org_accreditation_decision_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "DECISION");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      applicationId: application.id,
      applicationRoot: application.applicationRoot,
      acceptedReviewId: review.id,
      acceptedReviewRoot: review.reviewRoot,
      profileRoot: application.profileRoot,
      policyRoot: application.policyRoot,
      scope,
      scopeRoot: application.scopeRoot,
      decision: parsed.decision,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      sourceEventRoots,
      sourceRoot,
      validFrom,
      validUntil,
      decider,
      decidedAt,
    };
    const decisionHash = hashJson({ kind: "canopyproof-organization-accreditation-decision-fact-v1", id, ...seed });
    const decisionRoot = factRoot("decision", parsed.organizationId, decisionHash, common);
    const safety = organizationAccreditationSafetyBoundary();
    const payload = {
      factType: "organization_accreditation_decision" as const,
      id,
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
    };
    const auditEvent = appendAuthorityEvent(stream, {
      action: parsed.decision === "approved" ? "FULFILL" : "CHALLENGE",
      actorId: decider.id,
      entityType: "organization_accreditation_decision",
      entityId: id,
      payload,
      createdAt: decidedAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationAccreditationDecisionFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  controlDecision(input: unknown, governorInput: unknown): CanopyProofOrganizationAccreditationControlFact {
    const parsed = controlInputSchema.parse(input);
    const governor = normalizeActor(governorInput);
    const controlledAt = canonicalTimestamp(parsed.controlledAt, "CONTROLLED_AT");
    const evidenceEventRoots = normalizeRoots(parsed.evidenceEventRoots, "EVIDENCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    const stream = this.requireStream(parsed.organizationId);
    assertMonotonic(stream, controlledAt);
    const decision = stream.decisions.find((candidate) => candidate.id === parsed.decisionId);
    const latestDecision = stream.decisions.at(-1);
    if (!decision || latestDecision?.id !== decision.id || decision.decision !== "approved") {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_CURRENT_APPROVAL_REQUIRED");
    }
    const priorControl = stream.controls.filter((candidate) => candidate.decisionId === decision.id).at(-1);
    if (priorControl?.action === "revoke") {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVOCATION_TERMINAL");
    }
    const currentStatus = projectStatus(decision, priorControl, controlledAt);
    if (
      (parsed.action === "suspend" && currentStatus !== "approved") ||
      (parsed.action === "revoke" && !["approved", "expired", "suspended"].includes(currentStatus))
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_CONTROL_TRANSITION_INVALID");
    }
    requireGovernanceActor(
      governor,
      parsed.organizationId,
      canopyProofOrganizationAccreditationScopes.govern,
      ["owner", "admin", "verifier"],
      controlledAt,
    );
    if (Date.parse(controlledAt) <= Date.parse(priorControl?.controlledAt ?? decision.decidedAt)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_CONTROL_TIME_INVALID");
    }
    const evidenceRoot = merkleRoot([
      ...evidenceEventRoots,
      decision.decisionRoot,
      ...(priorControl ? [priorControl.controlRoot] : []),
    ].sort());
    const commandHash = hashJson({
      kind: "canopyproof-organization-accreditation-control-command-v1",
      organizationId: parsed.organizationId,
      decisionRoot: decision.decisionRoot,
      previousControlRoot: priorControl?.controlRoot ?? null,
      action: parsed.action,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      evidenceEventRoots,
      governor,
      controlledAt,
    });
    const id = `cp_org_accreditation_control_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "CONTROL");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      decisionId: decision.id,
      decisionRoot: decision.decisionRoot,
      ...(priorControl ? { previousControlId: priorControl.id, previousControlRoot: priorControl.controlRoot } : {}),
      action: parsed.action,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      evidenceEventRoots,
      evidenceRoot,
      governor,
      controlledAt,
    };
    const controlHash = hashJson({ kind: "canopyproof-organization-accreditation-control-fact-v1", id, ...seed });
    const controlRoot = factRoot("control", parsed.organizationId, controlHash, common);
    const safety = organizationAccreditationSafetyBoundary();
    const payload = {
      factType: "organization_accreditation_control" as const,
      id,
      ...seed,
      controlHash,
      controlRoot,
      safety,
    };
    const auditEvent = appendAuthorityEvent(stream, {
      action: "CHALLENGE",
      actorId: governor.id,
      entityType: "organization_accreditation_control",
      entityId: id,
      payload,
      createdAt: controlledAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationAccreditationControlFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  getProjection(organizationIdInput: string, applicationIdInput: string, asOfInput: string) {
    const organizationId = identifierSchema.parse(organizationIdInput);
    const applicationId = identifierSchema.parse(applicationIdInput);
    const asOf = canonicalTimestamp(asOfInput, "AS_OF");
    const stream = this.requireStream(organizationId);
    const application = stream.applications.find((candidate) => candidate.id === applicationId);
    if (!application) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_NOT_FOUND:${applicationId}`);
    const decision = stream.decisions.find((candidate) => candidate.applicationId === application.id);
    const controls = decision
      ? stream.controls.filter(
          (candidate) => candidate.decisionId === decision.id && Date.parse(candidate.controlledAt) <= Date.parse(asOf),
        )
      : [];
    const control = controls.at(-1);
    const status = decision ? projectStatus(decision, control, asOf) : "pending";
    const safety = organizationAccreditationSafetyBoundary();
    const latestEvent = [...stream.events]
      .filter((event) => Date.parse(event.createdAt) <= Date.parse(asOf))
      .at(-1);
    const latestSequence = [
      ...stream.applications,
      ...stream.reviews,
      ...stream.decisions,
      ...stream.controls,
    ]
      .filter((fact) => Date.parse(fact.auditEvent.createdAt) <= Date.parse(asOf))
      .sort((left, right) => left.organizationAccreditationSequence - right.organizationAccreditationSequence)
      .at(-1)?.organizationAccreditationSequence ?? 0;
    const seed = {
      organizationId,
      applicationId: application.id,
      applicationRoot: application.applicationRoot,
      status,
      scope: application.scope,
      scopeRoot: application.scopeRoot,
      policyRoot: application.policyRoot,
      decisionId: decision?.id ?? null,
      decisionRoot: decision?.decisionRoot ?? null,
      controlId: control?.id ?? null,
      controlRoot: control?.controlRoot ?? null,
      validFrom: decision?.validFrom ?? null,
      validUntil: decision?.validUntil ?? null,
      asOf,
      latestOrganizationAccreditationSequence: latestSequence,
      latestEventRoot: latestEvent?.eventRoot ?? canopyProofAuditGenesisRoot(),
      safety,
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-organization-accreditation-projection-v1", ...seed }),
    } satisfies CanopyProofOrganizationAccreditationProjection;
  }

  getAuthoritySnapshot(organizationIdInput?: string): CanopyProofOrganizationAccreditationAuthoritySnapshot {
    const streams = organizationIdInput
      ? [this.requireStream(identifierSchema.parse(organizationIdInput))]
      : [...this.streamsByOrganizationId.values()].sort((left, right) =>
          left.organizationId.localeCompare(right.organizationId),
        );
    return {
      applicationFacts: streams.flatMap((stream) => stream.applications),
      reviewFacts: streams.flatMap((stream) => stream.reviews),
      decisionFacts: streams.flatMap((stream) => stream.decisions),
      controlFacts: streams.flatMap((stream) => stream.controls),
    };
  }

  private requireStream(organizationId: string) {
    const stream = this.streamsByOrganizationId.get(organizationId);
    if (!stream) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_STREAM_NOT_FOUND:${organizationId}`);
    return stream;
  }
}

export function organizationAccreditationSafetyBoundary(): CanopyProofOrganizationAccreditationSafetyBoundary {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    appendOnly: true,
    exactRetryRequired: true,
    explicitAsOfRequired: true,
    currentAuthorityReResolutionRequired: true,
    independentHumanReviewRequired: true,
    reviewerDeciderSeparationRequired: true,
    aiIsNeverFinalAuthority: true,
    revocationTerminal: true,
    compatibilityAccreditationIsNotCanonical: true,
    rawEvidenceForbidden: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
    noPrivateKeyHandling: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
  };
}

export function organizationAccreditationActorAuthorityRoot(
  input: Omit<CanopyProofOrganizationAccreditationActorSnapshot, "authorityRoot">,
) {
  return hashJson({ kind: "canopyproof-organization-accreditation-actor-authority-v1", ...input });
}

export function parseCanopyProofOrganizationAccreditationApplicationFact(input: unknown) {
  return applicationFactSchema.parse(input) as CanopyProofOrganizationAccreditationApplicationFact;
}

export function parseCanopyProofOrganizationAccreditationReviewFact(input: unknown) {
  return reviewFactSchema.parse(input) as CanopyProofOrganizationAccreditationReviewFact;
}

export function parseCanopyProofOrganizationAccreditationDecisionFact(input: unknown) {
  return decisionFactSchema.parse(input) as CanopyProofOrganizationAccreditationDecisionFact;
}

export function parseCanopyProofOrganizationAccreditationControlFact(input: unknown) {
  return controlFactSchema.parse(input) as CanopyProofOrganizationAccreditationControlFact;
}

export function verifyCanopyProofOrganizationAccreditationAuthoritySnapshot(
  snapshot: CanopyProofOrganizationAccreditationAuthoritySnapshot,
) {
  return CanopyProofOrganizationAccreditationAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
}

function parseAuthoritySnapshot(input: CanopyProofOrganizationAccreditationAuthoritySnapshot) {
  return {
    applicationFacts: input.applicationFacts.map(parseCanopyProofOrganizationAccreditationApplicationFact),
    reviewFacts: input.reviewFacts.map(parseCanopyProofOrganizationAccreditationReviewFact),
    decisionFacts: input.decisionFacts.map(parseCanopyProofOrganizationAccreditationDecisionFact),
    controlFacts: input.controlFacts.map(parseCanopyProofOrganizationAccreditationControlFact),
  };
}

function replayFact(
  service: CanopyProofOrganizationAccreditationAuthorityService,
  fact: CanopyProofOrganizationAccreditationFact,
) {
  if (fact.factType === "organization_accreditation_application") {
    return service.submitApplication(
      {
        id: fact.id,
        organizationId: fact.organizationId,
        applicationKind: fact.applicationKind,
        ...(fact.priorDecisionId ? { priorDecisionId: fact.priorDecisionId } : {}),
        profileRoot: fact.profileRoot,
        scope: fact.scope,
        evidenceEventRoots: fact.evidenceEventRoots,
        policyRoot: fact.policyRoot,
        requestedValidUntil: fact.requestedValidUntil,
        submittedAt: fact.submittedAt,
      },
      fact.submitter,
    );
  }
  if (fact.factType === "organization_accreditation_review") {
    return service.reviewApplication(
      {
        id: fact.id,
        organizationId: fact.organizationId,
        applicationId: fact.applicationId,
        profileRoot: fact.profileRoot,
        policyRoot: fact.policyRoot,
        decision: fact.decision,
        reasonCode: fact.reasonCode,
        rationale: fact.rationale,
        conflictDisclosure: fact.conflictDisclosure,
        sourceEventRoots: fact.sourceEventRoots,
        reviewedAt: fact.reviewedAt,
      },
      fact.reviewer,
    );
  }
  if (fact.factType === "organization_accreditation_decision") {
    return service.decideApplication(
      {
        id: fact.id,
        organizationId: fact.organizationId,
        applicationId: fact.applicationId,
        acceptedReviewId: fact.acceptedReviewId,
        profileRoot: fact.profileRoot,
        policyRoot: fact.policyRoot,
        scope: fact.scope,
        decision: fact.decision,
        reasonCode: fact.reasonCode,
        rationale: fact.rationale,
        sourceEventRoots: fact.sourceEventRoots,
        validUntil: fact.validUntil,
        decidedAt: fact.decidedAt,
      },
      fact.decider,
    );
  }
  return service.controlDecision(
    {
      id: fact.id,
      organizationId: fact.organizationId,
      decisionId: fact.decisionId,
      action: fact.action,
      reasonCode: fact.reasonCode,
      rationale: fact.rationale,
      evidenceEventRoots: fact.evidenceEventRoots,
      controlledAt: fact.controlledAt,
    },
    fact.governor,
  );
}

function normalizeActor(input: unknown): CanopyProofOrganizationAccreditationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = normalizeScope(parsed.accreditationScope, true);
  const authorityFields = [
    parsed.accreditationId,
    parsed.accreditationStatus,
    parsed.accreditationDecisionRoot,
    parsed.accreditationProjectionRoot,
    parsed.accreditationValidFrom,
    parsed.accreditationValidUntil,
  ];
  const hasAnyAuthority = authorityFields.some(Boolean);
  const hasCompleteAuthority = authorityFields.every(Boolean);
  if (hasAnyAuthority !== hasCompleteAuthority) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_ACTOR_AUTHORITY_INCOMPLETE");
  }
  if (
    (parsed.authoritySource === "subject_membership" && (hasAnyAuthority || accreditationScope.length !== 0)) ||
    (parsed.authoritySource !== "subject_membership" && (!hasCompleteAuthority || accreditationScope.length === 0))
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_ACTOR_AUTHORITY_SOURCE_INVALID");
  }
  const normalized = {
    id: parsed.id,
    participantType: "human" as const,
    role: parsed.role,
    verificationStatus: "verified" as const,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: parsed.participantRoot,
    organizationRoot: parsed.organizationRoot,
    membershipId: parsed.membershipId,
    membershipStatus: "active" as const,
    membershipRoot: parsed.membershipRoot,
    authoritySource: parsed.authoritySource,
    ...(hasCompleteAuthority
      ? {
          accreditationId: parsed.accreditationId,
          accreditationStatus: parsed.accreditationStatus,
          accreditationDecisionRoot: parsed.accreditationDecisionRoot,
          accreditationProjectionRoot: parsed.accreditationProjectionRoot,
          accreditationValidFrom: parsed.accreditationValidFrom,
          accreditationValidUntil: parsed.accreditationValidUntil,
        }
      : {}),
    accreditationScope,
  };
  const authorityRoot = organizationAccreditationActorAuthorityRoot(
    normalized as Omit<CanopyProofOrganizationAccreditationActorSnapshot, "authorityRoot">,
  );
  if (authorityRoot !== parsed.authorityRoot) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_ACTOR_AUTHORITY_ROOT_INVALID");
  }
  return { ...normalized, authorityRoot } as CanopyProofOrganizationAccreditationActorSnapshot;
}

function requireSubjectActor(actor: CanopyProofOrganizationAccreditationActorSnapshot, organizationId: string) {
  if (
    actor.organizationId !== organizationId ||
    actor.authoritySource !== "subject_membership" ||
    actor.organizationVerificationStatus !== "verified" ||
    (actor.role !== "owner" && actor.role !== "admin")
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_SUBJECT_AUTHORITY_REQUIRED");
  }
}

function requireGovernanceActor(
  actor: CanopyProofOrganizationAccreditationActorSnapshot,
  subjectOrganizationId: string,
  requiredScope: string,
  allowedRoles: readonly CanopyProofOrganizationAccreditationActorSnapshot["role"][],
  effectiveAt: string,
) {
  if (
    actor.organizationId === subjectOrganizationId ||
    actor.authoritySource === "subject_membership" ||
    actor.organizationVerificationStatus !== "verified" ||
    !allowedRoles.includes(actor.role) ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationDecisionRoot ||
    !actor.accreditationProjectionRoot ||
    !actor.accreditationValidFrom ||
    !actor.accreditationValidUntil ||
    !actor.accreditationScope.includes(requiredScope) ||
    Date.parse(effectiveAt) < Date.parse(actor.accreditationValidFrom) ||
    Date.parse(effectiveAt) >= Date.parse(actor.accreditationValidUntil)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED");
  }
}

function projectStatus(
  decision: CanopyProofOrganizationAccreditationDecisionFact,
  control: CanopyProofOrganizationAccreditationControlFact | undefined,
  asOf: string,
): CanopyProofOrganizationAccreditationProjectionStatus {
  if (decision.decision === "denied") return "denied";
  if (control?.action === "revoke") return "revoked";
  if (control?.action === "suspend") return "suspended";
  if (!decision.validFrom || !decision.validUntil) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPROVAL_INTERVAL_MISSING");
  }
  if (Date.parse(asOf) < Date.parse(decision.validFrom)) return "pending";
  if (Date.parse(asOf) >= Date.parse(decision.validUntil)) return "expired";
  return "approved";
}

function requireLatestApplication(stream: AccreditationStream, applicationId: string) {
  const application = stream.applications.find((candidate) => candidate.id === applicationId);
  if (!application || stream.applications.at(-1)?.id !== application.id) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_LATEST_APPLICATION_REQUIRED");
  }
  return application;
}

function createStream(organizationId: string): AccreditationStream {
  return { organizationId, events: [], applications: [], reviews: [], decisions: [], controls: [] };
}

function nextFactCommon(stream: AccreditationStream, commandHash: string) {
  return {
    organizationId: stream.organizationId,
    organizationAccreditationSequence:
      stream.applications.length + stream.reviews.length + stream.decisions.length + stream.controls.length + 1,
    previousEventRoot: stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    commandHash,
  };
}

function factRoot(
  kind: "application" | "review" | "decision" | "control",
  organizationId: string,
  factHash: string,
  common: ReturnType<typeof nextFactCommon>,
) {
  return hashJson({
    kind: `canopyproof-organization-accreditation-${kind}-root-v1`,
    organizationId,
    factHash,
    organizationAccreditationSequence: common.organizationAccreditationSequence,
    previousEventRoot: common.previousEventRoot,
  });
}

function appendAuthorityEvent(
  stream: AccreditationStream,
  input: Readonly<{
    action: CanopyProofAuditEvent["action"];
    actorId: string;
    entityType: CanopyProofAuditEvent["entityType"];
    entityId: string;
    payload: unknown;
    createdAt: string;
    rationale: string;
  }>,
) {
  const event = appendCanopyProofAuditEvent(stream.events, {
    action: input.action,
    actor: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    createdAt: input.createdAt,
    rationale: input.rationale,
  }).at(-1);
  if (!event) throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_AUDIT_EVENT_MISSING");
  return event;
}

function commitFact(
  stream: AccreditationStream,
  fact: CanopyProofOrganizationAccreditationFact,
  factsById: Map<string, CanopyProofOrganizationAccreditationFact>,
) {
  if (
    fact.organizationAccreditationSequence !== stream.events.length + 1 ||
    fact.previousEventRoot !== (stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot())
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_SEQUENCE_INVALID");
  }
  if (fact.auditEvent.previousRoot !== fact.previousEventRoot) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_EVENT_PREDECESSOR_INVALID");
  }
  if (fact.factType === "organization_accreditation_application") stream.applications.push(fact);
  else if (fact.factType === "organization_accreditation_review") stream.reviews.push(fact);
  else if (fact.factType === "organization_accreditation_decision") stream.decisions.push(fact);
  else stream.controls.push(fact);
  stream.events.push(fact.auditEvent);
  factsById.set(fact.id, fact);
}

function assertStreamIntegrity(stream: AccreditationStream) {
  const facts = [
    ...stream.applications,
    ...stream.reviews,
    ...stream.decisions,
    ...stream.controls,
  ].sort((left, right) => left.organizationAccreditationSequence - right.organizationAccreditationSequence);
  if (facts.length !== stream.events.length || !verifyCanopyProofAuditChain(stream.events)) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_STREAM_INVALID");
  }
  facts.forEach((fact, index) => {
    if (
      fact.organizationAccreditationSequence !== index + 1 ||
      fact.auditEvent.eventRoot !== stream.events[index]?.eventRoot
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_STREAM_SEQUENCE_INVALID");
    }
  });
}

function assertNewFactId(factsById: Map<string, unknown>, id: string) {
  if (factsById.has(id)) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_FACT_ALREADY_EXISTS:${id}`);
}

function assertCanonicalId(provided: string | undefined, expected: string, label: string) {
  if (provided !== undefined && provided !== expected) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_${label}_ID_INVALID`);
  }
}

function normalizeScope(input: readonly string[], allowEmpty = false) {
  if (allowEmpty && input.length === 0) return [];
  const parsed = scopeSchema.parse(input);
  const normalized = [...parsed].sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_SCOPE_DUPLICATE");
  }
  return normalized;
}

function normalizeRoots(input: readonly string[], label: string) {
  const normalized = [...input].sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_${label}_DUPLICATE`);
  }
  return normalized;
}

function canonicalTimestamp(input: string, label: string) {
  const date = new Date(input);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== input) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_${label}_INVALID`);
  }
  return input;
}

function assertInterval(validFrom: string, validUntil: string) {
  const duration = Date.parse(validUntil) - Date.parse(validFrom);
  if (duration <= 0 || duration > 366 * 24 * 60 * 60 * 1_000) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_VALIDITY_INTERVAL_INVALID");
  }
}

function assertMonotonic(stream: AccreditationStream, timestamp: string) {
  const previous = stream.events.at(-1)?.createdAt;
  if (previous && Date.parse(timestamp) <= Date.parse(previous)) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_TIME_NOT_MONOTONIC");
  }
}

function assertSafeText(value: string) {
  const forbidden = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]*tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+canopy\s+distribution/i,
    /mainnet\s+fund/i,
    /private\s+key/i,
  ];
  if (forbidden.some((pattern) => pattern.test(value))) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_UNSAFE_TEXT");
  }
}
