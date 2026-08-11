import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofEarlyWarningSchemaVersion =
  "canopyproof.early-warning.v1" as const;

export const canopyProofEarlyWarningScopes = {
  prepare: "risk:signal:prepare",
  scientificReview: "risk:scientific-review",
  operationalReview: "risk:operational-review",
  publish: "risk:publish",
  govern: "risk:govern",
} as const;

export const canopyProofEarlyWarningRiskClasses = [
  "drought",
  "wildfire",
  "flooding",
  "ecosystem_degradation",
] as const;

export const canopyProofEarlyWarningSeverityLevels = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const canopyProofEarlyWarningScopeTypes = ["project", "region"] as const;

export const canopyProofEarlyWarningSourceTypes = [
  "satellite_observation",
  "field_evidence",
  "community_report",
  "open_climate_dataset",
] as const;

export const canopyProofEarlyWarningAudiences = [
  "community",
  "ngo",
  "government",
  "operator",
  "verifier",
] as const;

export const canopyProofEarlyWarningReviewKinds = [
  "scientific",
  "operational",
] as const;

export const canopyProofEarlyWarningReviewDecisions = [
  "accepted",
  "rejected",
] as const;

export const canopyProofEarlyWarningControlActions = [
  "challenge",
  "withdraw",
] as const;

export const canopyProofEarlyWarningControlReasons = [
  "source_invalidated",
  "scientific_dispute",
  "operational_context_changed",
  "scope_authority_changed",
  "policy_superseded",
  "governance_order",
  "legal_hold",
] as const;

export const canopyProofEarlyWarningIndicatorComparisons = ["gte", "lte"] as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const timestampSchema = z.string().datetime({ offset: true });
const rationaleSchema = z.string().trim().min(12).max(512);
const summarySchema = z.string().trim().min(12).max(280);
const safeIntegerSchema = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const positiveScaleSchema = z.number().int().positive().max(1_000_000_000);
const confidenceBpsSchema = z.number().int().min(0).max(10_000);

const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: hashSchema.optional(),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z
      .enum(["approved", "pending", "suspended", "revoked"])
      .optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(64),
    authorityRoot: hashSchema,
  })
  .strict();

const sourceMemberInputSchema = z
  .object({
    sourceType: z.enum(canopyProofEarlyWarningSourceTypes),
    sourceId: identifierSchema,
    sourceRoot: hashSchema,
    observedAt: timestampSchema,
    receivedAt: timestampSchema,
    provenancePolicyRoot: hashSchema,
  })
  .strict();

const sourceMemberSchema = sourceMemberInputSchema
  .extend({ memberRoot: hashSchema })
  .strict();

const indicatorMemberInputSchema = z
  .object({
    indicatorKey: identifierSchema,
    valueScaled: safeIntegerSchema,
    scale: positiveScaleSchema,
    unit: identifierSchema,
    thresholdScaled: safeIntegerSchema,
    thresholdScale: positiveScaleSchema,
    comparison: z.enum(canopyProofEarlyWarningIndicatorComparisons),
  })
  .strict();

const indicatorMemberSchema = indicatorMemberInputSchema
  .extend({
    breached: z.boolean(),
    memberRoot: hashSchema,
  })
  .strict();

const safetySchema = z
  .object({
    routeMounted: z.literal(false),
    schedulerMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    liveFeedEnabled: z.literal(false),
    notificationDeliveryEnabled: z.literal(false),
    emergencyDeclarationEnabled: z.literal(false),
    advisoryOnly: z.literal(true),
    appendOnly: z.literal(true),
    exactRetryRequired: z.literal(true),
    currentSourceReResolutionRequired: z.literal(true),
    threeIndependentAccreditedHumansRequired: z.literal(true),
    machineCannotReviewPublishOrControl: z.literal(true),
    integerScaledIndicatorsOnly: z.literal(true),
    rawCoordinatesAndPrivateContactDataForbidden: z.literal(true),
    adverseStateNeverFallsBack: z.literal(true),
    noSafetyOrForecastGuarantee: z.literal(true),
    noMainnetFunds: z.literal(true),
    noAutomaticCanopyDistribution: z.literal(true),
    noPrivateKeyHandling: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notOwnershipRight: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const candidateInputSchema = z
  .object({
    organizationId: identifierSchema,
    organizationPublicId: identifierSchema,
    scopeType: z.enum(canopyProofEarlyWarningScopeTypes),
    scopeId: identifierSchema,
    scopePublicId: identifierSchema,
    scopeAuthorityRoot: hashSchema,
    riskClass: z.enum(canopyProofEarlyWarningRiskClasses),
    severity: z.enum(canopyProofEarlyWarningSeverityLevels),
    confidenceBps: confidenceBpsSchema,
    advisoryCode: identifierSchema,
    summary: summarySchema,
    intendedAudiences: z
      .array(z.enum(canopyProofEarlyWarningAudiences))
      .min(1)
      .max(canopyProofEarlyWarningAudiences.length),
    sources: z.array(sourceMemberInputSchema).min(1).max(64),
    indicators: z.array(indicatorMemberInputSchema).min(1).max(64),
    observationStart: timestampSchema,
    observationEnd: timestampSchema,
    policyId: identifierSchema,
    policyVersion: identifierSchema,
    policyRoot: hashSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    preparedAt: timestampSchema,
  })
  .strict();

const candidateSchema = z
  .object({
    schemaVersion: z.literal(canopyProofEarlyWarningSchemaVersion),
    organizationId: identifierSchema,
    organizationPublicId: identifierSchema,
    scopeType: z.enum(canopyProofEarlyWarningScopeTypes),
    scopeId: identifierSchema,
    scopePublicId: identifierSchema,
    scopeAuthorityRoot: hashSchema,
    riskClass: z.enum(canopyProofEarlyWarningRiskClasses),
    severity: z.enum(canopyProofEarlyWarningSeverityLevels),
    confidenceBps: confidenceBpsSchema,
    advisoryCode: identifierSchema,
    summary: summarySchema,
    intendedAudiences: z.array(z.enum(canopyProofEarlyWarningAudiences)).min(1),
    sources: z.array(sourceMemberSchema).min(1).max(64),
    indicators: z.array(indicatorMemberSchema).min(1).max(64),
    sourceMemberRoot: hashSchema,
    indicatorMemberRoot: hashSchema,
    sourceAuthorityRoot: hashSchema,
    observationStart: timestampSchema,
    observationEnd: timestampSchema,
    policyId: identifierSchema,
    policyVersion: identifierSchema,
    policyRoot: hashSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    preparedAt: timestampSchema,
    preparer: actorSchema,
    safety: safetySchema,
    candidateRoot: hashSchema,
  })
  .strict();

const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "REASON", "CHALLENGE"]),
    actor: identifierSchema,
    entityType: z.enum(["risk_response", "risk_alert"]),
    entityId: identifierSchema,
    previousRoot: hashSchema,
    payloadHash: hashSchema,
    eventRoot: hashSchema,
    createdAt: timestampSchema,
    rationale: z.string().trim().min(1).max(512),
  })
  .strict();

const reviewFactSchema = z
  .object({
    factType: z.literal("early_warning_review"),
    id: identifierSchema,
    candidate: candidateSchema,
    reviewKind: z.enum(canopyProofEarlyWarningReviewKinds),
    decision: z.enum(canopyProofEarlyWarningReviewDecisions),
    reasonCode: identifierSchema,
    rationale: rationaleSchema,
    reviewer: actorSchema,
    reviewedAt: timestampSchema,
    commandHash: hashSchema,
    reviewSequence: z.literal(1),
    previousEventRoot: hashSchema,
    reviewRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const publicProjectionSchema = z
  .object({
    schemaVersion: z.literal(canopyProofEarlyWarningSchemaVersion),
    publicationId: identifierSchema,
    organizationPublicId: identifierSchema,
    scopeType: z.enum(canopyProofEarlyWarningScopeTypes),
    scopePublicId: identifierSchema,
    riskClass: z.enum(canopyProofEarlyWarningRiskClasses),
    severity: z.enum(canopyProofEarlyWarningSeverityLevels),
    confidenceBand: z.enum(["low", "medium", "high", "very_high"]),
    advisoryCode: identifierSchema,
    summary: summarySchema,
    intendedAudiences: z.array(z.enum(canopyProofEarlyWarningAudiences)).min(1),
    observationStart: timestampSchema,
    observationEnd: timestampSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    sourceMemberCount: z.number().int().positive().max(64),
    indicatorMemberCount: z.number().int().positive().max(64),
    sourceMemberRoot: hashSchema,
    indicatorMemberRoot: hashSchema,
    scientificReviewRoot: hashSchema,
    operationalReviewRoot: hashSchema,
    policyId: identifierSchema,
    policyVersion: identifierSchema,
    policyRoot: hashSchema,
    safetyDisclosure: z.literal(
      "Environmental risk advisory only; not an emergency declaration or guarantee.",
    ),
    projectionRoot: hashSchema,
  })
  .strict();

const publicationFactSchema = z
  .object({
    factType: z.literal("early_warning_publication"),
    id: identifierSchema,
    candidate: candidateSchema,
    scientificReviewId: identifierSchema,
    scientificReviewRoot: hashSchema,
    scientificReviewerId: identifierSchema,
    scientificReviewerAuthorityRoot: hashSchema,
    operationalReviewId: identifierSchema,
    operationalReviewRoot: hashSchema,
    operationalReviewerId: identifierSchema,
    operationalReviewerAuthorityRoot: hashSchema,
    publisher: actorSchema,
    predecessorPublicationRoot: hashSchema.nullable(),
    publishedAt: timestampSchema,
    commandHash: hashSchema,
    eventSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    publicProjection: publicProjectionSchema,
    publicationRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const controlFactSchema = z
  .object({
    factType: z.literal("early_warning_control"),
    id: identifierSchema,
    organizationId: identifierSchema,
    scopeId: identifierSchema,
    riskClass: z.enum(canopyProofEarlyWarningRiskClasses),
    publicationId: identifierSchema,
    publicationRoot: hashSchema,
    projectionRoot: hashSchema,
    action: z.enum(canopyProofEarlyWarningControlActions),
    reasonCode: z.enum(canopyProofEarlyWarningControlReasons),
    rationale: rationaleSchema,
    governor: actorSchema,
    controlledAt: timestampSchema,
    commandHash: hashSchema,
    eventSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    controlRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const currentProjectionSchema = z
  .object({
    organizationId: identifierSchema,
    scopeId: identifierSchema,
    riskClass: z.enum(canopyProofEarlyWarningRiskClasses),
    publicationId: identifierSchema,
    publicationRoot: hashSchema,
    projectionRoot: hashSchema,
    state: z.enum(["active", "challenged", "withdrawn", "expired"]),
    evaluatedAt: timestampSchema,
    publicProjection: publicProjectionSchema,
    controlRoot: hashSchema.nullable(),
    currentRoot: hashSchema,
    safety: safetySchema,
  })
  .strict();

export type CanopyProofEarlyWarningCandidateInput = z.input<typeof candidateInputSchema>;
export type CanopyProofEarlyWarningCandidate = z.output<typeof candidateSchema>;
export type CanopyProofEarlyWarningReviewFact = z.output<typeof reviewFactSchema>;
export type CanopyProofEarlyWarningPublicProjection = z.output<
  typeof publicProjectionSchema
>;
export type CanopyProofEarlyWarningPublicationFact = z.output<
  typeof publicationFactSchema
>;
export type CanopyProofEarlyWarningControlFact = z.output<typeof controlFactSchema>;
export type CanopyProofEarlyWarningCurrentProjection = z.output<
  typeof currentProjectionSchema
>;

export type CanopyProofEarlyWarningRecord =
  | Readonly<{
      kind: "publication";
      publication: CanopyProofEarlyWarningPublicationFact;
      scientificReview: CanopyProofEarlyWarningReviewFact;
      operationalReview: CanopyProofEarlyWarningReviewFact;
    }>
  | Readonly<{
      kind: "control";
      control: CanopyProofEarlyWarningControlFact;
    }>;

export function canopyProofEarlyWarningSafety() {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    liveFeedEnabled: false,
    notificationDeliveryEnabled: false,
    emergencyDeclarationEnabled: false,
    advisoryOnly: true,
    appendOnly: true,
    exactRetryRequired: true,
    currentSourceReResolutionRequired: true,
    threeIndependentAccreditedHumansRequired: true,
    machineCannotReviewPublishOrControl: true,
    integerScaledIndicatorsOnly: true,
    rawCoordinatesAndPrivateContactDataForbidden: true,
    adverseStateNeverFallsBack: true,
    noSafetyOrForecastGuarantee: true,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    noPrivateKeyHandling: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notOwnershipRight: true,
    notGuaranteedYield: true,
  } as const;
}

export function buildCanopyProofEarlyWarningCandidate(
  input: CanopyProofEarlyWarningCandidateInput,
  preparerInput: CanopyProofVerificationActorSnapshot,
): CanopyProofEarlyWarningCandidate {
  const parsed = candidateInputSchema.parse(input);
  assertCandidateTimes(parsed);
  const preparer = normalizeActor(preparerInput, "preparer");
  requireCandidatePreparer(preparer, parsed.organizationId);
  const sources = normalizeSources(parsed.sources, parsed);
  const indicators = normalizeIndicators(parsed.indicators);
  if (!indicators.some((indicator) => indicator.breached)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_THRESHOLD_BREACH_REQUIRED");
  }
  const intendedAudiences = normalizeUniqueStrings(
    parsed.intendedAudiences,
    "CANOPYPROOF_EARLY_WARNING_AUDIENCE_DUPLICATE",
  );
  const sourceMemberRoot = hashMembers(sources.map((member) => member.memberRoot));
  const indicatorMemberRoot = hashMembers(
    indicators.map((member) => member.memberRoot),
  );
  const sourceAuthorityRoot = hashJson({
    kind: "canopyproof-early-warning-source-authority-v1",
    organizationId: parsed.organizationId,
    scopeType: parsed.scopeType,
    scopeId: parsed.scopeId,
    scopeAuthorityRoot: parsed.scopeAuthorityRoot,
    riskClass: parsed.riskClass,
    sourceMemberRoot,
    indicatorMemberRoot,
    policyId: parsed.policyId,
    policyVersion: parsed.policyVersion,
    policyRoot: parsed.policyRoot,
  });
  const seed = {
    schemaVersion: canopyProofEarlyWarningSchemaVersion,
    organizationId: parsed.organizationId,
    organizationPublicId: parsed.organizationPublicId,
    scopeType: parsed.scopeType,
    scopeId: parsed.scopeId,
    scopePublicId: parsed.scopePublicId,
    scopeAuthorityRoot: parsed.scopeAuthorityRoot,
    riskClass: parsed.riskClass,
    severity: parsed.severity,
    confidenceBps: parsed.confidenceBps,
    advisoryCode: parsed.advisoryCode,
    summary: parsed.summary,
    intendedAudiences,
    sources,
    indicators,
    sourceMemberRoot,
    indicatorMemberRoot,
    sourceAuthorityRoot,
    observationStart: parsed.observationStart,
    observationEnd: parsed.observationEnd,
    policyId: parsed.policyId,
    policyVersion: parsed.policyVersion,
    policyRoot: parsed.policyRoot,
    validFrom: parsed.validFrom,
    validUntil: parsed.validUntil,
    preparedAt: parsed.preparedAt,
    preparer,
    safety: canopyProofEarlyWarningSafety(),
  };
  assertEarlyWarningDocumentSafe(seed);
  const candidateRoot = hashJson({
    kind: "canopyproof-early-warning-candidate-v1",
    ...seed,
  });
  return candidateSchema.parse({ ...seed, candidateRoot });
}

export function verifyCanopyProofEarlyWarningCandidate(
  input: unknown,
): CanopyProofEarlyWarningCandidate {
  const candidate = candidateSchema.parse(input);
  const expected = buildCanopyProofEarlyWarningCandidate(
    {
      organizationId: candidate.organizationId,
      organizationPublicId: candidate.organizationPublicId,
      scopeType: candidate.scopeType,
      scopeId: candidate.scopeId,
      scopePublicId: candidate.scopePublicId,
      scopeAuthorityRoot: candidate.scopeAuthorityRoot,
      riskClass: candidate.riskClass,
      severity: candidate.severity,
      confidenceBps: candidate.confidenceBps,
      advisoryCode: candidate.advisoryCode,
      summary: candidate.summary,
      intendedAudiences: candidate.intendedAudiences,
      sources: candidate.sources.map((source) => ({
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceRoot: source.sourceRoot,
        observedAt: source.observedAt,
        receivedAt: source.receivedAt,
        provenancePolicyRoot: source.provenancePolicyRoot,
      })),
      indicators: candidate.indicators.map((indicator) => ({
        indicatorKey: indicator.indicatorKey,
        valueScaled: indicator.valueScaled,
        scale: indicator.scale,
        unit: indicator.unit,
        thresholdScaled: indicator.thresholdScaled,
        thresholdScale: indicator.thresholdScale,
        comparison: indicator.comparison,
      })),
      observationStart: candidate.observationStart,
      observationEnd: candidate.observationEnd,
      policyId: candidate.policyId,
      policyVersion: candidate.policyVersion,
      policyRoot: candidate.policyRoot,
      validFrom: candidate.validFrom,
      validUntil: candidate.validUntil,
      preparedAt: candidate.preparedAt,
    },
    normalizeActor(candidate.preparer, "preparer"),
  );
  if (hashJson(candidate) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CANDIDATE_ROOT_INVALID");
  }
  return candidate;
}

export function buildCanopyProofEarlyWarningReview(
  input: Readonly<{
    candidate: CanopyProofEarlyWarningCandidate;
    reviewKind: (typeof canopyProofEarlyWarningReviewKinds)[number];
    decision: (typeof canopyProofEarlyWarningReviewDecisions)[number];
    reasonCode: string;
    rationale: string;
    reviewedAt: string;
  }>,
  reviewerInput: CanopyProofVerificationActorSnapshot,
): CanopyProofEarlyWarningReviewFact {
  const candidate = verifyCanopyProofEarlyWarningCandidate(input.candidate);
  const reviewKind = z.enum(canopyProofEarlyWarningReviewKinds).parse(input.reviewKind);
  const decision = z
    .enum(canopyProofEarlyWarningReviewDecisions)
    .parse(input.decision);
  const reasonCode = identifierSchema.parse(input.reasonCode);
  const rationale = rationaleSchema.parse(input.rationale);
  const reviewedAt = canonicalTimestamp(input.reviewedAt, "reviewedAt");
  if (
    Date.parse(reviewedAt) < Date.parse(candidate.preparedAt) ||
    Date.parse(reviewedAt) > Date.parse(candidate.validUntil)
  ) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEW_WINDOW_INVALID");
  }
  const reviewer = normalizeActor(reviewerInput, `${reviewKind} reviewer`);
  requireAccreditedActor(
    reviewer,
    candidate.organizationId,
    reviewKind === "scientific"
      ? canopyProofEarlyWarningScopes.scientificReview
      : canopyProofEarlyWarningScopes.operationalReview,
    reviewKind === "scientific"
      ? ["verifier", "researcher"]
      : ["owner", "admin", "verifier"],
    true,
  );
  if (reviewer.id === candidate.preparer.id) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEWER_INDEPENDENCE_REQUIRED");
  }
  const commandHash = hashJson({
    kind: "canopyproof-early-warning-review-command-v1",
    candidateRoot: candidate.candidateRoot,
    reviewKind,
    decision,
    reasonCode,
    rationale,
    reviewerAuthorityRoot: reviewer.authorityRoot,
    reviewedAt,
  });
  const id = `cp_risk_review_${commandHash.slice(0, 24)}`;
  const seed = {
    factType: "early_warning_review" as const,
    id,
    candidate,
    reviewKind,
    decision,
    reasonCode,
    rationale,
    reviewer,
    reviewedAt,
    commandHash,
    reviewSequence: 1 as const,
    previousEventRoot: canopyProofAuditGenesisRoot(),
    safety: canopyProofEarlyWarningSafety(),
  };
  assertEarlyWarningDocumentSafe(seed);
  const reviewRoot = hashJson({
    kind: "canopyproof-early-warning-review-v1",
    ...seed,
  });
  const payload = { ...seed, reviewRoot };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: decision === "accepted" ? "REASON" : "CHALLENGE",
    actor: reviewer.id,
    entityType: "risk_response",
    entityId: id,
    payload,
    createdAt: reviewedAt,
    rationale:
      reviewKind === "scientific"
        ? "An independent accredited human appended an immutable scientific review over the exact risk candidate."
        : "An independent accredited human appended an immutable operational review over the exact risk candidate.",
  }).at(-1);
  if (!auditEvent) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEW_AUDIT_MISSING");
  }
  return reviewFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofEarlyWarningReview(
  input: unknown,
): CanopyProofEarlyWarningReviewFact {
  const review = reviewFactSchema.parse(input);
  const expected = buildCanopyProofEarlyWarningReview(
    {
      candidate: review.candidate,
      reviewKind: review.reviewKind,
      decision: review.decision,
      reasonCode: review.reasonCode,
      rationale: review.rationale,
      reviewedAt: review.reviewedAt,
    },
    normalizeActor(review.reviewer, `${review.reviewKind} reviewer`),
  );
  if (hashJson(review) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEW_ROOT_INVALID");
  }
  return review;
}

export function buildCanopyProofEarlyWarningPublication(
  input: Readonly<{
    candidate: CanopyProofEarlyWarningCandidate;
    scientificReview: CanopyProofEarlyWarningReviewFact;
    operationalReview: CanopyProofEarlyWarningReviewFact;
    predecessorPublicationRoot: string | null;
    publishedAt: string;
  }>,
  publisherInput: CanopyProofVerificationActorSnapshot,
  streamHistory: readonly CanopyProofAuditEvent[] = [],
): CanopyProofEarlyWarningPublicationFact {
  const candidate = verifyCanopyProofEarlyWarningCandidate(input.candidate);
  const scientificReview = verifyCanopyProofEarlyWarningReview(
    input.scientificReview,
  );
  const operationalReview = verifyCanopyProofEarlyWarningReview(
    input.operationalReview,
  );
  assertStreamHistory(streamHistory);
  assertAcceptedReview(scientificReview, "scientific", candidate);
  assertAcceptedReview(operationalReview, "operational", candidate);
  if (scientificReview.reviewer.id === operationalReview.reviewer.id) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEWER_SEPARATION_REQUIRED");
  }
  const predecessorPublicationRoot = z
    .union([hashSchema, z.null()])
    .parse(input.predecessorPublicationRoot);
  const publisher = normalizeActor(publisherInput, "publisher");
  requireAccreditedActor(
    publisher,
    candidate.organizationId,
    canopyProofEarlyWarningScopes.publish,
    ["owner", "admin"],
    true,
  );
  const occupiedActorIds = new Set([
    candidate.preparer.id,
    scientificReview.reviewer.id,
    operationalReview.reviewer.id,
  ]);
  if (occupiedActorIds.has(publisher.id)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLISHER_INDEPENDENCE_REQUIRED");
  }
  const publishedAt = canonicalTimestamp(input.publishedAt, "publishedAt");
  const reviewTerminal = Math.max(
    Date.parse(scientificReview.reviewedAt),
    Date.parse(operationalReview.reviewedAt),
    Date.parse(candidate.validFrom),
  );
  if (
    Date.parse(publishedAt) < reviewTerminal ||
    Date.parse(publishedAt) > Date.parse(candidate.validUntil)
  ) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_WINDOW_INVALID");
  }
  const commandHash = hashJson({
    kind: "canopyproof-early-warning-publication-command-v1",
    candidateRoot: candidate.candidateRoot,
    scientificReviewRoot: scientificReview.reviewRoot,
    operationalReviewRoot: operationalReview.reviewRoot,
    publisherAuthorityRoot: publisher.authorityRoot,
    predecessorPublicationRoot,
    publishedAt,
  });
  const id = `cp_risk_publication_${commandHash.slice(0, 24)}`;
  const publicProjection = buildPublicProjection(
    id,
    candidate,
    scientificReview,
    operationalReview,
  );
  const seed = {
    factType: "early_warning_publication" as const,
    id,
    candidate,
    scientificReviewId: scientificReview.id,
    scientificReviewRoot: scientificReview.reviewRoot,
    scientificReviewerId: scientificReview.reviewer.id,
    scientificReviewerAuthorityRoot: scientificReview.reviewer.authorityRoot,
    operationalReviewId: operationalReview.id,
    operationalReviewRoot: operationalReview.reviewRoot,
    operationalReviewerId: operationalReview.reviewer.id,
    operationalReviewerAuthorityRoot: operationalReview.reviewer.authorityRoot,
    publisher,
    predecessorPublicationRoot,
    publishedAt,
    commandHash,
    eventSequence: streamHistory.length + 1,
    previousEventRoot:
      streamHistory.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    publicProjection,
    safety: canopyProofEarlyWarningSafety(),
  };
  assertEarlyWarningDocumentSafe(seed);
  const publicationRoot = hashJson({
    kind: "canopyproof-early-warning-publication-v1",
    ...seed,
  });
  const payload = { ...seed, publicationRoot };
  const auditEvent = appendCanopyProofAuditEvent(streamHistory, {
    action: "ASSERT",
    actor: publisher.id,
    entityType: "risk_alert",
    entityId: id,
    payload,
    createdAt: publishedAt,
    rationale:
      "A third independent accredited human published a bounded environmental risk advisory after scientific and operational review.",
  }).at(-1);
  if (!auditEvent) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_AUDIT_MISSING");
  }
  return publicationFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofEarlyWarningPublication(
  input: unknown,
  scientificReviewInput: unknown,
  operationalReviewInput: unknown,
  streamHistory: readonly CanopyProofAuditEvent[] = [],
): CanopyProofEarlyWarningPublicationFact {
  const publication = publicationFactSchema.parse(input);
  const scientificReview = verifyCanopyProofEarlyWarningReview(
    scientificReviewInput,
  );
  const operationalReview = verifyCanopyProofEarlyWarningReview(
    operationalReviewInput,
  );
  const expected = buildCanopyProofEarlyWarningPublication(
    {
      candidate: publication.candidate,
      scientificReview,
      operationalReview,
      predecessorPublicationRoot: publication.predecessorPublicationRoot,
      publishedAt: publication.publishedAt,
    },
    normalizeActor(publication.publisher, "publisher"),
    streamHistory,
  );
  if (hashJson(publication) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_ROOT_INVALID");
  }
  return publication;
}

export function buildCanopyProofEarlyWarningControl(
  input: Readonly<{
    publication: CanopyProofEarlyWarningPublicationFact;
    action: (typeof canopyProofEarlyWarningControlActions)[number];
    reasonCode: (typeof canopyProofEarlyWarningControlReasons)[number];
    rationale: string;
    controlledAt: string;
  }>,
  governorInput: CanopyProofVerificationActorSnapshot,
  streamHistory: readonly CanopyProofAuditEvent[],
): CanopyProofEarlyWarningControlFact {
  const publication = publicationFactSchema.parse(input.publication);
  const action = z.enum(canopyProofEarlyWarningControlActions).parse(input.action);
  const reasonCode = z
    .enum(canopyProofEarlyWarningControlReasons)
    .parse(input.reasonCode);
  const rationale = rationaleSchema.parse(input.rationale);
  const controlledAt = canonicalTimestamp(input.controlledAt, "controlledAt");
  assertStreamHistory(streamHistory);
  if (streamHistory.at(-1)?.eventRoot !== publication.auditEvent.eventRoot) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_NOT_CURRENT");
  }
  if (Date.parse(controlledAt) < Date.parse(publication.publishedAt)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_TIME_INVALID");
  }
  const governor = normalizeActor(governorInput, "governor");
  requireAccreditedActor(
    governor,
    publication.candidate.organizationId,
    canopyProofEarlyWarningScopes.govern,
    ["owner", "admin", "verifier"],
    true,
  );
  if (governor.id === publication.publisher.id) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_INDEPENDENCE_REQUIRED");
  }
  const commandHash = hashJson({
    kind: "canopyproof-early-warning-control-command-v1",
    publicationId: publication.id,
    publicationRoot: publication.publicationRoot,
    projectionRoot: publication.publicProjection.projectionRoot,
    action,
    reasonCode,
    rationale,
    governorAuthorityRoot: governor.authorityRoot,
    controlledAt,
  });
  const id = `cp_risk_control_${commandHash.slice(0, 24)}`;
  const seed = {
    factType: "early_warning_control" as const,
    id,
    organizationId: publication.candidate.organizationId,
    scopeId: publication.candidate.scopeId,
    riskClass: publication.candidate.riskClass,
    publicationId: publication.id,
    publicationRoot: publication.publicationRoot,
    projectionRoot: publication.publicProjection.projectionRoot,
    action,
    reasonCode,
    rationale,
    governor,
    controlledAt,
    commandHash,
    eventSequence: streamHistory.length + 1,
    previousEventRoot: streamHistory.at(-1)!.eventRoot,
    safety: canopyProofEarlyWarningSafety(),
  };
  assertEarlyWarningDocumentSafe(seed);
  const controlRoot = hashJson({
    kind: "canopyproof-early-warning-control-v1",
    ...seed,
  });
  const payload = { ...seed, controlRoot };
  const auditEvent = appendCanopyProofAuditEvent(streamHistory, {
    action: "CHALLENGE",
    actor: governor.id,
    entityType: "risk_alert",
    entityId: id,
    payload,
    createdAt: controlledAt,
    rationale:
      action === "challenge"
        ? "An independent accredited human challenged the current environmental risk advisory; reliance fails closed."
        : "An independent accredited human withdrew the current environmental risk advisory; reliance fails closed.",
  }).at(-1);
  if (!auditEvent) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_AUDIT_MISSING");
  }
  return controlFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofEarlyWarningControl(
  input: unknown,
  publicationInput: unknown,
  streamHistory: readonly CanopyProofAuditEvent[],
): CanopyProofEarlyWarningControlFact {
  const control = controlFactSchema.parse(input);
  const publication = publicationFactSchema.parse(publicationInput);
  const expected = buildCanopyProofEarlyWarningControl(
    {
      publication,
      action: control.action,
      reasonCode: control.reasonCode,
      rationale: control.rationale,
      controlledAt: control.controlledAt,
    },
    normalizeActor(control.governor, "governor"),
    streamHistory,
  );
  if (hashJson(control) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_ROOT_INVALID");
  }
  return control;
}

export function resolveCanopyProofEarlyWarningProjection(
  records: readonly CanopyProofEarlyWarningRecord[],
  evaluatedAtInput: string,
): CanopyProofEarlyWarningCurrentProjection | null {
  const evaluatedAt = canonicalTimestamp(evaluatedAtInput, "evaluatedAt");
  if (records.length === 0) return null;
  const ordered = [...records].sort(
    (left, right) => recordSequence(left) - recordSequence(right),
  );
  const sequences = ordered.map(recordSequence);
  assertConsecutiveSequences(sequences);
  const streamHistory: CanopyProofAuditEvent[] = [];
  const publications: CanopyProofEarlyWarningPublicationFact[] = [];
  const controls: CanopyProofEarlyWarningControlFact[] = [];
  let streamKey: string | undefined;
  let predecessorPublicationRoot: string | null = null;

  for (const record of ordered) {
    if (record.kind === "publication") {
      const publication = verifyCanopyProofEarlyWarningPublication(
        record.publication,
        record.scientificReview,
        record.operationalReview,
        streamHistory,
      );
      const candidateStreamKey = publicationStreamKey(publication);
      streamKey ??= candidateStreamKey;
      if (streamKey !== candidateStreamKey) {
        throw new Error("CANOPYPROOF_EARLY_WARNING_STREAM_MISMATCH");
      }
      if (publication.predecessorPublicationRoot !== predecessorPublicationRoot) {
        throw new Error("CANOPYPROOF_EARLY_WARNING_PREDECESSOR_INVALID");
      }
      predecessorPublicationRoot = publication.publicationRoot;
      publications.push(publication);
      streamHistory.push(publication.auditEvent);
      continue;
    }

    const publication = publications.find(
      (entry) => entry.publicationRoot === record.control.publicationRoot,
    );
    if (!publication) {
      throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_PUBLICATION_MISSING");
    }
    const control = verifyCanopyProofEarlyWarningControl(
      record.control,
      publication,
      streamHistory,
    );
    controls.push(control);
    streamHistory.push(control.auditEvent);
  }

  const publication = publications.at(-1);
  if (!publication) return null;
  const latestControls = controls.filter(
    (control) => control.publicationRoot === publication.publicationRoot,
  );
  const terminalControl = latestControls.at(-1);
  const state = terminalControl
    ? terminalControl.action === "withdraw"
      ? "withdrawn"
      : "challenged"
    : Date.parse(evaluatedAt) > Date.parse(publication.candidate.validUntil)
      ? "expired"
      : "active";
  const seed = {
    organizationId: publication.candidate.organizationId,
    scopeId: publication.candidate.scopeId,
    riskClass: publication.candidate.riskClass,
    publicationId: publication.id,
    publicationRoot: publication.publicationRoot,
    projectionRoot: publication.publicProjection.projectionRoot,
    state,
    evaluatedAt,
    publicProjection: publication.publicProjection,
    controlRoot: terminalControl?.controlRoot ?? null,
    safety: canopyProofEarlyWarningSafety(),
  };
  const currentRoot = hashJson({
    kind: "canopyproof-early-warning-current-projection-v1",
    ...seed,
  });
  return currentProjectionSchema.parse({ ...seed, currentRoot });
}

export function parseCanopyProofEarlyWarningReviewFact(input: unknown) {
  return reviewFactSchema.parse(input);
}

export function parseCanopyProofEarlyWarningPublicationFact(input: unknown) {
  return publicationFactSchema.parse(input);
}

export function parseCanopyProofEarlyWarningControlFact(input: unknown) {
  return controlFactSchema.parse(input);
}

export function parseCanopyProofEarlyWarningCurrentProjection(input: unknown) {
  return currentProjectionSchema.parse(input);
}

function normalizeSources(
  inputs: readonly z.input<typeof sourceMemberInputSchema>[],
  candidate: z.input<typeof candidateInputSchema>,
) {
  const sources = inputs.map((input) => {
    const source = sourceMemberInputSchema.parse(input);
    const observedAt = canonicalTimestamp(source.observedAt, "source.observedAt");
    const receivedAt = canonicalTimestamp(source.receivedAt, "source.receivedAt");
    if (
      Date.parse(observedAt) < Date.parse(candidate.observationStart) ||
      Date.parse(observedAt) > Date.parse(candidate.observationEnd) ||
      Date.parse(receivedAt) < Date.parse(observedAt) ||
      Date.parse(receivedAt) > Date.parse(candidate.preparedAt)
    ) {
      throw new Error("CANOPYPROOF_EARLY_WARNING_SOURCE_TIME_INVALID");
    }
    const seed = { ...source, observedAt, receivedAt };
    return sourceMemberSchema.parse({
      ...seed,
      memberRoot: hashJson({
        kind: "canopyproof-early-warning-source-member-v1",
        ...seed,
      }),
    });
  });
  sources.sort(
    (left, right) =>
      left.sourceType.localeCompare(right.sourceType) ||
      left.sourceId.localeCompare(right.sourceId) ||
      left.sourceRoot.localeCompare(right.sourceRoot),
  );
  assertUnique(
    sources.map((source) => `${source.sourceType}:${source.sourceId}`),
    "CANOPYPROOF_EARLY_WARNING_SOURCE_DUPLICATE",
  );
  return sources;
}

function normalizeIndicators(
  inputs: readonly z.input<typeof indicatorMemberInputSchema>[],
) {
  const indicators = inputs.map((input) => {
    const indicator = indicatorMemberInputSchema.parse(input);
    const breached = compareScaledIndicator(indicator);
    const seed = { ...indicator, breached };
    return indicatorMemberSchema.parse({
      ...seed,
      memberRoot: hashJson({
        kind: "canopyproof-early-warning-indicator-member-v1",
        ...seed,
      }),
    });
  });
  indicators.sort((left, right) => left.indicatorKey.localeCompare(right.indicatorKey));
  assertUnique(
    indicators.map((indicator) => indicator.indicatorKey),
    "CANOPYPROOF_EARLY_WARNING_INDICATOR_DUPLICATE",
  );
  return indicators;
}

function compareScaledIndicator(
  indicator: z.output<typeof indicatorMemberInputSchema>,
) {
  const value = BigInt(indicator.valueScaled) * BigInt(indicator.thresholdScale);
  const threshold = BigInt(indicator.thresholdScaled) * BigInt(indicator.scale);
  return indicator.comparison === "gte" ? value >= threshold : value <= threshold;
}

function buildPublicProjection(
  publicationId: string,
  candidate: CanopyProofEarlyWarningCandidate,
  scientificReview: CanopyProofEarlyWarningReviewFact,
  operationalReview: CanopyProofEarlyWarningReviewFact,
): CanopyProofEarlyWarningPublicProjection {
  const seed = {
    schemaVersion: canopyProofEarlyWarningSchemaVersion,
    publicationId,
    organizationPublicId: candidate.organizationPublicId,
    scopeType: candidate.scopeType,
    scopePublicId: candidate.scopePublicId,
    riskClass: candidate.riskClass,
    severity: candidate.severity,
    confidenceBand: confidenceBand(candidate.confidenceBps),
    advisoryCode: candidate.advisoryCode,
    summary: candidate.summary,
    intendedAudiences: candidate.intendedAudiences,
    observationStart: candidate.observationStart,
    observationEnd: candidate.observationEnd,
    validFrom: candidate.validFrom,
    validUntil: candidate.validUntil,
    sourceMemberCount: candidate.sources.length,
    indicatorMemberCount: candidate.indicators.length,
    sourceMemberRoot: candidate.sourceMemberRoot,
    indicatorMemberRoot: candidate.indicatorMemberRoot,
    scientificReviewRoot: scientificReview.reviewRoot,
    operationalReviewRoot: operationalReview.reviewRoot,
    policyId: candidate.policyId,
    policyVersion: candidate.policyVersion,
    policyRoot: candidate.policyRoot,
    safetyDisclosure:
      "Environmental risk advisory only; not an emergency declaration or guarantee." as const,
  };
  assertEarlyWarningDocumentSafe(seed);
  const projectionRoot = hashJson({
    kind: "canopyproof-early-warning-public-projection-v1",
    ...seed,
  });
  return publicProjectionSchema.parse({ ...seed, projectionRoot });
}

function confidenceBand(confidenceBps: number) {
  if (confidenceBps < 2_500) return "low" as const;
  if (confidenceBps < 5_000) return "medium" as const;
  if (confidenceBps < 7_500) return "high" as const;
  return "very_high" as const;
}

function normalizeActor(
  actorInput: unknown,
  label: string,
): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(actorInput);
  const accreditationScope = normalizeUniqueStrings(
    parsed.accreditationScope,
    `CANOPYPROOF_EARLY_WARNING_${label.toUpperCase().replaceAll(" ", "_")}_SCOPE_DUPLICATE`,
  );
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: parsed.participantRoot,
    organizationRoot: parsed.organizationRoot,
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: parsed.membershipRoot } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus
      ? { accreditationStatus: parsed.accreditationStatus }
      : {}),
    ...(parsed.accreditationRoot
      ? { accreditationRoot: parsed.accreditationRoot }
      : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({
    kind: "canopyproof-verification-actor-authority-v1",
    ...normalized,
  });
  if (authorityRoot !== parsed.authorityRoot) {
    throw new Error(
      `CANOPYPROOF_EARLY_WARNING_${label.toUpperCase().replaceAll(" ", "_")}_AUTHORITY_ROOT_INVALID`,
    );
  }
  return { ...normalized, authorityRoot };
}

function requireAccreditedActor(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
  scope: string,
  allowedRoles: ReadonlyArray<CanopyProofVerificationActorSnapshot["role"]>,
  humanOnly: boolean,
) {
  if (actor.organizationId !== organizationId) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_ACTOR_ORGANIZATION_MISMATCH");
  }
  if (humanOnly && actor.participantType !== "human") {
    throw new Error("CANOPYPROOF_EARLY_WARNING_HUMAN_AUTHORITY_REQUIRED");
  }
  if (
    actor.participantType === "agent" ? actor.role !== "agent" : actor.role === "agent"
  ) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_ACTOR_ROLE_INVALID");
  }
  if (!allowedRoles.includes(actor.role)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_ACTOR_ROLE_DENIED");
  }
  if (
    !actor.membershipId ||
    actor.membershipStatus !== "active" ||
    !actor.membershipRoot ||
    !actor.accreditationId ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes(scope)
  ) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CURRENT_ACCREDITATION_REQUIRED");
  }
}

function requireCandidatePreparer(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
) {
  if (actor.participantType === "agent") {
    if (
      actor.organizationId !== organizationId ||
      actor.role !== "agent" ||
      actor.membershipId ||
      actor.membershipStatus ||
      actor.membershipRoot ||
      actor.accreditationId ||
      actor.accreditationStatus ||
      actor.accreditationRoot ||
      actor.accreditationScope.length !== 0
    ) {
      throw new Error("CANOPYPROOF_EARLY_WARNING_AGENT_PREPARER_AUTHORITY_INVALID");
    }
    return;
  }
  requireAccreditedActor(
    actor,
    organizationId,
    canopyProofEarlyWarningScopes.prepare,
    ["owner", "admin", "verifier", "researcher"],
    true,
  );
}

function assertAcceptedReview(
  review: CanopyProofEarlyWarningReviewFact,
  expectedKind: (typeof canopyProofEarlyWarningReviewKinds)[number],
  candidate: CanopyProofEarlyWarningCandidate,
) {
  if (
    review.reviewKind !== expectedKind ||
    review.decision !== "accepted" ||
    hashJson(review.candidate) !== hashJson(candidate)
  ) {
    throw new Error(
      `CANOPYPROOF_EARLY_WARNING_${expectedKind.toUpperCase()}_REVIEW_REQUIRED`,
    );
  }
}

function assertCandidateTimes(candidate: z.input<typeof candidateInputSchema>) {
  const fields = [
    ["observationStart", candidate.observationStart],
    ["observationEnd", candidate.observationEnd],
    ["preparedAt", candidate.preparedAt],
    ["validFrom", candidate.validFrom],
    ["validUntil", candidate.validUntil],
  ] as const;
  for (const [label, value] of fields) canonicalTimestamp(value, label);
  if (
    Date.parse(candidate.observationStart) > Date.parse(candidate.observationEnd) ||
    Date.parse(candidate.observationEnd) > Date.parse(candidate.preparedAt) ||
    Date.parse(candidate.preparedAt) > Date.parse(candidate.validFrom) ||
    Date.parse(candidate.validFrom) >= Date.parse(candidate.validUntil)
  ) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CANDIDATE_TIME_INVALID");
  }
}

function canonicalTimestamp(value: string, label: string) {
  const parsed = timestampSchema.parse(value);
  if (new Date(parsed).toISOString() !== parsed) {
    throw new Error(`CANOPYPROOF_EARLY_WARNING_${label.toUpperCase()}_NOT_CANONICAL_UTC`);
  }
  return parsed;
}

function assertStreamHistory(history: readonly CanopyProofAuditEvent[]) {
  if (history.length === 0) return;
  const verification = verifyCanopyProofAuditChain(history);
  if (!verification.valid) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_STREAM_HISTORY_INVALID");
  }
}

function assertConsecutiveSequences(sequences: readonly number[]) {
  for (const [index, sequence] of sequences.entries()) {
    if (sequence !== index + 1) {
      throw new Error("CANOPYPROOF_EARLY_WARNING_EVENT_SEQUENCE_INVALID");
    }
  }
}

function recordSequence(record: CanopyProofEarlyWarningRecord) {
  return record.kind === "publication"
    ? record.publication.eventSequence
    : record.control.eventSequence;
}

function publicationStreamKey(publication: CanopyProofEarlyWarningPublicationFact) {
  return [
    publication.candidate.organizationId,
    publication.candidate.scopeId,
    publication.candidate.riskClass,
  ].join(":");
}

function hashMembers(memberRoots: readonly string[]) {
  return merkleRoot([...memberRoots].sort());
}

function normalizeUniqueStrings<T extends string>(
  values: readonly T[],
  errorCode: string,
): T[] {
  const sorted = [...values].sort();
  assertUnique(sorted, errorCode);
  return sorted;
}

function assertUnique(values: readonly string[], errorCode: string) {
  if (new Set(values).size !== values.length) throw new Error(errorCode);
}

function assertEarlyWarningDocumentSafe(document: unknown) {
  assertNoForbiddenKeys(document);
  const forbiddenText = [
    /\bofficial\s+emergency\b/i,
    /\bemergency\s+declaration\b/i,
    /\bevacuat(?:e|ion)\s+now\b/i,
    /\bguaranteed\s+(?:safe|safety|forecast|accuracy|yield)\b/i,
    /\bcertified\s+carbon\s+credits?\b/i,
    /\bcarbon[-\s]?tax\s+offsets?\b/i,
    /\bprivate\s+keys?\b/i,
    /\bmainnet\s+funds?\b/i,
    /\bautomatic\s+CANOPY\s+distribution\b/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /[-+]?\d{1,3}\.\d{4,}\s*[,/]\s*[-+]?\d{1,3}\.\d{4,}/,
  ];
  for (const [key, text] of collectStringFields(document)) {
    if (
      key === "safetyDisclosure" &&
      text ===
        "Environmental risk advisory only; not an emergency declaration or guarantee."
    ) {
      continue;
    }
    if (forbiddenText.some((pattern) => pattern.test(text))) {
      throw new Error("CANOPYPROOF_EARLY_WARNING_UNSAFE_DOCUMENT");
    }
  }
}

function collectStringFields(
  value: unknown,
  output: Array<readonly [string, string]> = [],
  key = "",
): ReadonlyArray<readonly [string, string]> {
  if (typeof value === "string") {
    output.push([key, value]);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const member of value) collectStringFields(member, output, key);
    return output;
  }
  for (const [memberKey, member] of Object.entries(value)) {
    collectStringFields(member, output, memberKey);
  }
  return output;
}

function assertNoForbiddenKeys(value: unknown, seen = new Set<object>()) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CYCLIC_DOCUMENT");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const member of value) assertNoForbiddenKeys(member, seen);
    seen.delete(value);
    return;
  }
  for (const [key, member] of Object.entries(value)) {
    if (
      /^(?:latitude|longitude|coordinates|geometry|email|phone|address|accessToken|refreshToken|password|secret|privateKey)$/i.test(
        key,
      )
    ) {
      throw new Error("CANOPYPROOF_EARLY_WARNING_FORBIDDEN_FIELD");
    }
    assertNoForbiddenKeys(member, seen);
  }
  seen.delete(value);
}
