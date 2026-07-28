import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofFundingAccountabilitySchemaVersion =
  "canopyproof.funding-accountability.v1" as const;

export const canopyProofFundingAccountabilityScopes = {
  prepare: "funding:accountability_prepare",
  review: "funding:accountability_review",
  publish: "funding:accountability_publish",
  control: "funding:accountability_control",
} as const;

export const canopyProofFundingAccountabilitySourceTypes = [
  "donor",
  "grant",
  "public_budget",
  "philanthropic_fund",
  "climate_fund",
] as const;

export const canopyProofFundingAccountabilityMilestoneStatuses = [
  "planned",
  "evidence_required",
  "ready_for_review",
  "reconciled",
  "challenged",
] as const;

export const canopyProofFundingAccountabilityControlActions = [
  "challenge",
  "withdraw",
] as const;

export const canopyProofFundingAccountabilityControlReasons = [
  "source_invalidated",
  "evidence_challenged",
  "proof_record_challenged",
  "reconciliation_error",
  "governance_order",
  "legal_hold",
] as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const jurisdictionSchema = z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,15}$/);
const timestampSchema = z.string().datetime({ offset: true });
const rationaleSchema = z.string().trim().min(12).max(512);
const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

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

const milestoneCommitmentSchema = z
  .object({
    milestoneId: identifierSchema,
    amountCents: centsSchema,
    dueAt: timestampSchema,
    status: z.enum(canopyProofFundingAccountabilityMilestoneStatuses),
    evidenceRoots: z.array(hashSchema).max(256),
    proofRecordRoots: z.array(hashSchema).max(256),
  })
  .strict();

const milestoneSchema = z
  .object({
    ...milestoneCommitmentSchema.shape,
    evidenceRoot: hashSchema,
    proofRecordRoot: hashSchema,
    milestoneRoot: hashSchema,
  })
  .strict();

const candidateInputSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema,
    projectAuthorityRoot: hashSchema,
    sourcePublicId: identifierSchema,
    sourceType: z.enum(canopyProofFundingAccountabilitySourceTypes),
    sourceJurisdictionCode: jurisdictionSchema,
    sourceRestriction: z.enum([
      "unrestricted",
      "project_restricted",
      "milestone_restricted",
    ]),
    commitmentCents: centsSchema,
    sourceDocumentRoot: hashSchema,
    fundingSourceAuthorityRoot: hashSchema,
    allocationId: identifierSchema,
    purposeCode: identifierSchema,
    allocatedCents: centsSchema,
    allocatedAt: timestampSchema,
    milestones: z.array(milestoneCommitmentSchema).min(1).max(128),
    reportingPeriodStart: timestampSchema,
    reportingPeriodEnd: timestampSchema,
    policyId: identifierSchema,
    policyRoot: hashSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    preparedAt: timestampSchema,
  })
  .strict();

const totalsSchema = z
  .object({
    committedCents: centsSchema,
    allocatedCents: centsSchema,
    reconciledCents: centsSchema,
    challengedCents: centsSchema,
  })
  .strict();

const candidateSchema = z
  .object({
    schemaVersion: z.literal(canopyProofFundingAccountabilitySchemaVersion),
    ...candidateInputSchema.shape,
    milestones: z.array(milestoneSchema).min(1).max(128),
    totals: totalsSchema,
    evidenceRoot: hashSchema,
    proofRecordRoot: hashSchema,
    sourceAuthorityRoot: hashSchema,
    preparer: actorSchema,
    candidateRoot: hashSchema,
  })
  .strict();

const safetySchema = z
  .object({
    routeMounted: z.literal(false),
    schedulerMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    transparencyOnly: z.literal(true),
    appendOnly: z.literal(true),
    exactRetryRequired: z.literal(true),
    currentSourceReResolutionRequired: z.literal(true),
    threeIndependentAccreditedHumansRequired: z.literal(true),
    integerCentsOnly: z.literal(true),
    privateAndPaymentDataForbidden: z.literal(true),
    challengeAndWithdrawalFailClosed: z.literal(true),
    noMainnetFunds: z.literal(true),
    noAutomaticCanopyDistribution: z.literal(true),
    notPaymentRail: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notOwnershipRight: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "CHALLENGE"]),
    actor: identifierSchema,
    entityType: z.enum([
      "funding_accountability_review",
      "funding_accountability_publication",
    ]),
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
    factType: z.literal("funding_accountability_review"),
    id: identifierSchema,
    candidate: candidateSchema,
    decision: z.enum(["approved", "rejected"]),
    reviewer: actorSchema,
    reviewedAt: timestampSchema,
    rationale: rationaleSchema,
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
    schemaVersion: z.literal(canopyProofFundingAccountabilitySchemaVersion),
    publicationId: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    sourcePublicId: identifierSchema,
    sourceType: z.enum(canopyProofFundingAccountabilitySourceTypes),
    sourceJurisdictionCode: jurisdictionSchema,
    sourceRestriction: z.enum([
      "unrestricted",
      "project_restricted",
      "milestone_restricted",
    ]),
    purposeCode: identifierSchema,
    candidateRoot: hashSchema,
    sourceAuthorityRoot: hashSchema,
    totals: totalsSchema,
    milestoneCount: z.number().int().positive().max(128),
    reconciledMilestoneCount: z.number().int().nonnegative().max(128),
    challengedMilestoneCount: z.number().int().nonnegative().max(128),
    evidenceMemberCount: z.number().int().nonnegative().max(32_768),
    proofRecordMemberCount: z.number().int().nonnegative().max(32_768),
    evidenceRoot: hashSchema,
    proofRecordRoot: hashSchema,
    policyId: identifierSchema,
    policyRoot: hashSchema,
    reportingPeriodStart: timestampSchema,
    reportingPeriodEnd: timestampSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    projectionRoot: hashSchema,
  })
  .strict();

const publicationFactSchema = z
  .object({
    factType: z.literal("funding_accountability_publication"),
    id: identifierSchema,
    candidate: candidateSchema,
    reviewId: identifierSchema,
    reviewRoot: hashSchema,
    reviewerId: identifierSchema,
    reviewerAuthorityRoot: hashSchema,
    publisher: actorSchema,
    publishedAt: timestampSchema,
    commandHash: hashSchema,
    projectSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    publicProjection: publicProjectionSchema,
    publicationRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const controlFactSchema = z
  .object({
    factType: z.literal("funding_accountability_control"),
    id: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    publicationId: identifierSchema,
    publicationRoot: hashSchema,
    projectionRoot: hashSchema,
    action: z.enum(canopyProofFundingAccountabilityControlActions),
    reasonCode: z.enum(canopyProofFundingAccountabilityControlReasons),
    rationale: rationaleSchema,
    governor: actorSchema,
    controlledAt: timestampSchema,
    commandHash: hashSchema,
    projectSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    controlRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const currentProjectionSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema,
    publicationId: identifierSchema,
    publicationRoot: hashSchema,
    projectionRoot: hashSchema,
    state: z.enum(["active", "challenged", "withdrawn", "expired"]),
    evaluatedAt: timestampSchema,
    operationalTotals: totalsSchema,
    publicProjection: publicProjectionSchema,
    controlRoot: hashSchema.nullable(),
    currentRoot: hashSchema,
    safety: safetySchema,
  })
  .strict();

export type CanopyProofFundingAccountabilityCandidateInput = z.input<
  typeof candidateInputSchema
>;
export type CanopyProofFundingAccountabilityCandidate = z.output<typeof candidateSchema>;
export type CanopyProofFundingAccountabilityReviewFact = z.output<typeof reviewFactSchema>;
export type CanopyProofFundingAccountabilityPublicProjection = z.output<
  typeof publicProjectionSchema
>;
export type CanopyProofFundingAccountabilityPublicationFact = z.output<
  typeof publicationFactSchema
>;
export type CanopyProofFundingAccountabilityControlFact = z.output<
  typeof controlFactSchema
>;
export type CanopyProofFundingAccountabilityCurrentProjection = z.output<
  typeof currentProjectionSchema
>;
export type CanopyProofFundingAccountabilityRecord =
  | Readonly<{
      kind: "publication";
      publication: CanopyProofFundingAccountabilityPublicationFact;
      review: CanopyProofFundingAccountabilityReviewFact;
    }>
  | Readonly<{
      kind: "control";
      control: CanopyProofFundingAccountabilityControlFact;
    }>;

export function buildCanopyProofFundingAccountabilityCandidate(
  input: CanopyProofFundingAccountabilityCandidateInput,
  preparerInput: CanopyProofVerificationActorSnapshot,
): CanopyProofFundingAccountabilityCandidate {
  const parsed = candidateInputSchema.parse(input);
  assertCandidateTimes(parsed);
  const preparer = normalizeActor(preparerInput, "preparer");
  requireAccreditedHuman(
    preparer,
    parsed.organizationId,
    canopyProofFundingAccountabilityScopes.prepare,
    ["owner", "admin", "researcher"],
  );
  const milestones = normalizeMilestones(parsed.milestones);
  assertCandidateAmounts(parsed, milestones);
  const totals = {
    committedCents: parsed.commitmentCents,
    allocatedCents: parsed.allocatedCents,
    reconciledCents: sumSafeCents(
      milestones
        .filter((milestone) => milestone.status === "reconciled")
        .map((milestone) => milestone.amountCents),
    ),
    challengedCents: sumSafeCents(
      milestones
        .filter((milestone) => milestone.status === "challenged")
        .map((milestone) => milestone.amountCents),
    ),
  };
  const evidenceRoot = hashMemberRoot(
    "canopyproof-funding-accountability-evidence-members-v1",
    milestones.flatMap((milestone) => milestone.evidenceRoots),
  );
  const proofRecordRoot = hashMemberRoot(
    "canopyproof-funding-accountability-proof-record-members-v1",
    milestones.flatMap((milestone) => milestone.proofRecordRoots),
  );
  const sourceAuthorityRoot = hashFundingSourceAuthority({
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    projectAuthorityRoot: parsed.projectAuthorityRoot,
    sourcePublicId: parsed.sourcePublicId,
    sourceDocumentRoot: parsed.sourceDocumentRoot,
    fundingSourceAuthorityRoot: parsed.fundingSourceAuthorityRoot,
    policyId: parsed.policyId,
    policyRoot: parsed.policyRoot,
    milestones,
  });
  const seed = {
    schemaVersion: canopyProofFundingAccountabilitySchemaVersion,
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    projectAuthorityRoot: parsed.projectAuthorityRoot,
    sourcePublicId: parsed.sourcePublicId,
    sourceType: parsed.sourceType,
    sourceJurisdictionCode: parsed.sourceJurisdictionCode,
    sourceRestriction: parsed.sourceRestriction,
    commitmentCents: parsed.commitmentCents,
    sourceDocumentRoot: parsed.sourceDocumentRoot,
    fundingSourceAuthorityRoot: parsed.fundingSourceAuthorityRoot,
    allocationId: parsed.allocationId,
    purposeCode: parsed.purposeCode,
    allocatedCents: parsed.allocatedCents,
    allocatedAt: parsed.allocatedAt,
    milestones,
    reportingPeriodStart: parsed.reportingPeriodStart,
    reportingPeriodEnd: parsed.reportingPeriodEnd,
    policyId: parsed.policyId,
    policyRoot: parsed.policyRoot,
    validFrom: parsed.validFrom,
    validUntil: parsed.validUntil,
    preparedAt: parsed.preparedAt,
    totals,
    evidenceRoot,
    proofRecordRoot,
    sourceAuthorityRoot,
    preparer,
  } as const;
  assertFundingDocumentSafe(seed);
  return candidateSchema.parse({
    ...seed,
    candidateRoot: hashJson({
      kind: "canopyproof-funding-accountability-candidate-v1",
      ...seed,
    }),
  });
}

export function verifyCanopyProofFundingAccountabilityCandidate(
  input: unknown,
): CanopyProofFundingAccountabilityCandidate {
  const candidate = candidateSchema.parse(input);
  const expected = buildCanopyProofFundingAccountabilityCandidate(
    {
      organizationId: candidate.organizationId,
      projectId: candidate.projectId,
      projectAuthorityRoot: candidate.projectAuthorityRoot,
      sourcePublicId: candidate.sourcePublicId,
      sourceType: candidate.sourceType,
      sourceJurisdictionCode: candidate.sourceJurisdictionCode,
      sourceRestriction: candidate.sourceRestriction,
      commitmentCents: candidate.commitmentCents,
      sourceDocumentRoot: candidate.sourceDocumentRoot,
      fundingSourceAuthorityRoot: candidate.fundingSourceAuthorityRoot,
      allocationId: candidate.allocationId,
      purposeCode: candidate.purposeCode,
      allocatedCents: candidate.allocatedCents,
      allocatedAt: candidate.allocatedAt,
      milestones: candidate.milestones.map((milestone) => ({
        milestoneId: milestone.milestoneId,
        amountCents: milestone.amountCents,
        dueAt: milestone.dueAt,
        status: milestone.status,
        evidenceRoots: milestone.evidenceRoots,
        proofRecordRoots: milestone.proofRecordRoots,
      })),
      reportingPeriodStart: candidate.reportingPeriodStart,
      reportingPeriodEnd: candidate.reportingPeriodEnd,
      policyId: candidate.policyId,
      policyRoot: candidate.policyRoot,
      validFrom: candidate.validFrom,
      validUntil: candidate.validUntil,
      preparedAt: candidate.preparedAt,
    },
    normalizeActor(candidate.preparer, "preparer"),
  );
  if (hashJson(candidate) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CANDIDATE_ROOT_INVALID");
  }
  return candidate;
}

export function buildCanopyProofFundingAccountabilityReview(
  input: Readonly<{
    candidate: CanopyProofFundingAccountabilityCandidate;
    decision: "approved" | "rejected";
    reviewedAt: string;
    rationale: string;
  }>,
  reviewerInput: CanopyProofVerificationActorSnapshot,
): CanopyProofFundingAccountabilityReviewFact {
  const candidate = verifyCanopyProofFundingAccountabilityCandidate(input.candidate);
  const decision = z.enum(["approved", "rejected"]).parse(input.decision);
  const reviewedAt = timestampSchema.parse(input.reviewedAt);
  const rationale = rationaleSchema.parse(input.rationale);
  assertCanonicalUtc(reviewedAt, "reviewedAt");
  if (
    Date.parse(reviewedAt) < Date.parse(candidate.preparedAt) ||
    Date.parse(reviewedAt) > Date.parse(candidate.validUntil)
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_WINDOW_INVALID");
  }
  const reviewer = normalizeActor(reviewerInput, "reviewer");
  requireAccreditedHuman(
    reviewer,
    candidate.organizationId,
    canopyProofFundingAccountabilityScopes.review,
    ["admin", "verifier"],
  );
  if (reviewer.id === candidate.preparer.id) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEWER_INDEPENDENCE_REQUIRED");
  }
  const commandHash = hashJson({
    kind: "canopyproof-funding-accountability-review-command-v1",
    candidate,
    decision,
    reviewerAuthorityRoot: reviewer.authorityRoot,
    reviewedAt,
    rationale,
  });
  const id = `cp_funding_review_${commandHash.slice(0, 24)}`;
  const previousEventRoot = canopyProofAuditGenesisRoot();
  const seed = {
    factType: "funding_accountability_review" as const,
    id,
    candidate,
    decision,
    reviewer,
    reviewedAt,
    rationale,
    commandHash,
    reviewSequence: 1 as const,
    previousEventRoot,
    safety: canopyProofFundingAccountabilitySafety(),
  };
  assertFundingDocumentSafe(seed);
  const reviewRoot = hashJson({
    kind: "canopyproof-funding-accountability-review-v1",
    ...seed,
  });
  const payload = { ...seed, reviewRoot };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: decision === "approved" ? "ASSERT" : "CHALLENGE",
    actor: reviewer.id,
    entityType: "funding_accountability_review",
    entityId: id,
    payload,
    createdAt: reviewedAt,
    rationale:
      "An independent accredited human appended an immutable reconciliation review over an exact funding accountability candidate.",
  }).at(-1);
  if (!auditEvent) throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_AUDIT_MISSING");
  return reviewFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofFundingAccountabilityReview(
  input: unknown,
): CanopyProofFundingAccountabilityReviewFact {
  const review = reviewFactSchema.parse(input);
  const expected = buildCanopyProofFundingAccountabilityReview(
    {
      candidate: review.candidate,
      decision: review.decision,
      reviewedAt: review.reviewedAt,
      rationale: review.rationale,
    },
    normalizeActor(review.reviewer, "reviewer"),
  );
  if (hashJson(review) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_ROOT_INVALID");
  }
  return review;
}

export function buildCanopyProofFundingAccountabilityPublication(
  input: Readonly<{
    candidate: CanopyProofFundingAccountabilityCandidate;
    review: CanopyProofFundingAccountabilityReviewFact;
    publishedAt: string;
  }>,
  publisherInput: CanopyProofVerificationActorSnapshot,
  projectHistory: readonly CanopyProofAuditEvent[] = [],
): CanopyProofFundingAccountabilityPublicationFact {
  const candidate = verifyCanopyProofFundingAccountabilityCandidate(input.candidate);
  const review = verifyCanopyProofFundingAccountabilityReview(input.review);
  assertProjectHistory(projectHistory);
  if (review.decision !== "approved" || hashJson(review.candidate) !== hashJson(candidate)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_APPROVED_REVIEW_REQUIRED");
  }
  const publisher = normalizeActor(publisherInput, "publisher");
  requireAccreditedHuman(
    publisher,
    candidate.organizationId,
    canopyProofFundingAccountabilityScopes.publish,
    ["owner", "admin"],
  );
  if (publisher.id === candidate.preparer.id || publisher.id === review.reviewer.id) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLISHER_INDEPENDENCE_REQUIRED");
  }
  const publishedAt = timestampSchema.parse(input.publishedAt);
  assertCanonicalUtc(publishedAt, "publishedAt");
  if (
    Date.parse(publishedAt) < Date.parse(review.reviewedAt) ||
    Date.parse(publishedAt) < Date.parse(candidate.validFrom) ||
    Date.parse(publishedAt) > Date.parse(candidate.validUntil)
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_WINDOW_INVALID");
  }
  const commandHash = hashJson({
    kind: "canopyproof-funding-accountability-publication-command-v1",
    candidate,
    reviewRoot: review.reviewRoot,
    publisherAuthorityRoot: publisher.authorityRoot,
    publishedAt,
  });
  const id = `cp_funding_publication_${commandHash.slice(0, 24)}`;
  const publicProjection = buildPublicProjection(id, candidate);
  const projectSequence = projectHistory.length + 1;
  const previousEventRoot = projectHistory.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const seed = {
    factType: "funding_accountability_publication" as const,
    id,
    candidate,
    reviewId: review.id,
    reviewRoot: review.reviewRoot,
    reviewerId: review.reviewer.id,
    reviewerAuthorityRoot: review.reviewer.authorityRoot,
    publisher,
    publishedAt,
    commandHash,
    projectSequence,
    previousEventRoot,
    publicProjection,
    safety: canopyProofFundingAccountabilitySafety(),
  };
  assertFundingDocumentSafe(seed);
  const publicationRoot = hashJson({
    kind: "canopyproof-funding-accountability-publication-v1",
    ...seed,
  });
  const payload = { ...seed, publicationRoot };
  const auditEvent = appendCanopyProofAuditEvent(projectHistory, {
    action: "ASSERT",
    actor: publisher.id,
    entityType: "funding_accountability_publication",
    entityId: id,
    payload,
    createdAt: publishedAt,
    rationale:
      "A third independent accredited human published a transparency-only funding accountability package after reconciliation review.",
  }).at(-1);
  if (!auditEvent) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_AUDIT_MISSING");
  }
  return publicationFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofFundingAccountabilityPublication(
  input: unknown,
  reviewInput: unknown,
  projectHistory: readonly CanopyProofAuditEvent[] = [],
): CanopyProofFundingAccountabilityPublicationFact {
  const publication = publicationFactSchema.parse(input);
  const review = verifyCanopyProofFundingAccountabilityReview(reviewInput);
  const expected = buildCanopyProofFundingAccountabilityPublication(
    {
      candidate: publication.candidate,
      review,
      publishedAt: publication.publishedAt,
    },
    normalizeActor(publication.publisher, "publisher"),
    projectHistory,
  );
  if (hashJson(publication) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_ROOT_INVALID");
  }
  return publication;
}

export function buildCanopyProofFundingAccountabilityControl(
  input: Readonly<{
    publication: CanopyProofFundingAccountabilityPublicationFact;
    action: (typeof canopyProofFundingAccountabilityControlActions)[number];
    reasonCode: (typeof canopyProofFundingAccountabilityControlReasons)[number];
    rationale: string;
    controlledAt: string;
  }>,
  governorInput: CanopyProofVerificationActorSnapshot,
  projectHistory: readonly CanopyProofAuditEvent[],
): CanopyProofFundingAccountabilityControlFact {
  const publication = publicationFactSchema.parse(input.publication);
  const action = z.enum(canopyProofFundingAccountabilityControlActions).parse(input.action);
  const reasonCode = z.enum(canopyProofFundingAccountabilityControlReasons).parse(input.reasonCode);
  const rationale = rationaleSchema.parse(input.rationale);
  const controlledAt = timestampSchema.parse(input.controlledAt);
  assertCanonicalUtc(controlledAt, "controlledAt");
  assertProjectHistory(projectHistory);
  if (projectHistory.at(-1)?.eventRoot !== publication.auditEvent.eventRoot) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_NOT_CURRENT");
  }
  if (Date.parse(controlledAt) < Date.parse(publication.publishedAt)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_TIME_INVALID");
  }
  const governor = normalizeActor(governorInput, "governor");
  requireAccreditedHuman(
    governor,
    publication.candidate.organizationId,
    canopyProofFundingAccountabilityScopes.control,
    ["owner", "admin", "verifier"],
  );
  if (governor.id === publication.publisher.id) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_INDEPENDENCE_REQUIRED");
  }
  const commandHash = hashJson({
    kind: "canopyproof-funding-accountability-control-command-v1",
    publicationId: publication.id,
    publicationRoot: publication.publicationRoot,
    projectionRoot: publication.publicProjection.projectionRoot,
    action,
    reasonCode,
    rationale,
    governorAuthorityRoot: governor.authorityRoot,
    controlledAt,
  });
  const id = `cp_funding_control_${commandHash.slice(0, 24)}`;
  const seed = {
    factType: "funding_accountability_control" as const,
    id,
    organizationId: publication.candidate.organizationId,
    projectId: publication.candidate.projectId,
    publicationId: publication.id,
    publicationRoot: publication.publicationRoot,
    projectionRoot: publication.publicProjection.projectionRoot,
    action,
    reasonCode,
    rationale,
    governor,
    controlledAt,
    commandHash,
    projectSequence: projectHistory.length + 1,
    previousEventRoot: projectHistory.at(-1)!.eventRoot,
    safety: canopyProofFundingAccountabilitySafety(),
  };
  assertFundingDocumentSafe(seed);
  const controlRoot = hashJson({
    kind: "canopyproof-funding-accountability-control-v1",
    ...seed,
  });
  const payload = { ...seed, controlRoot };
  const auditEvent = appendCanopyProofAuditEvent(projectHistory, {
    action: "CHALLENGE",
    actor: governor.id,
    entityType: "funding_accountability_publication",
    entityId: id,
    payload,
    createdAt: controlledAt,
    rationale:
      action === "challenge"
        ? "An independent accredited human challenged the current funding accountability package; reconciled operational totals fail closed."
        : "An independent accredited human withdrew the current funding accountability package; all operational totals fail closed.",
  }).at(-1);
  if (!auditEvent) throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_AUDIT_MISSING");
  return controlFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofFundingAccountabilityControl(
  input: unknown,
  publicationInput: unknown,
  projectHistory: readonly CanopyProofAuditEvent[],
): CanopyProofFundingAccountabilityControlFact {
  const control = controlFactSchema.parse(input);
  const publication = publicationFactSchema.parse(publicationInput);
  const expected = buildCanopyProofFundingAccountabilityControl(
    {
      publication,
      action: control.action,
      reasonCode: control.reasonCode,
      rationale: control.rationale,
      controlledAt: control.controlledAt,
    },
    normalizeActor(control.governor, "governor"),
    projectHistory,
  );
  if (hashJson(control) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_ROOT_INVALID");
  }
  return control;
}

export function resolveCanopyProofFundingAccountabilityProjection(
  input: Readonly<{
    organizationId: string;
    projectId: string;
    evaluatedAt: string;
    records: readonly CanopyProofFundingAccountabilityRecord[];
  }>,
): CanopyProofFundingAccountabilityCurrentProjection | undefined {
  const organizationId = identifierSchema.parse(input.organizationId);
  const projectId = identifierSchema.parse(input.projectId);
  const evaluatedAt = timestampSchema.parse(input.evaluatedAt);
  assertCanonicalUtc(evaluatedAt, "evaluatedAt");
  if (input.records.length > 2_048) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_HISTORY_LIMIT_EXCEEDED");
  }
  const records = [...input.records].sort(
    (left, right) => recordSequence(left) - recordSequence(right),
  );
  const history: CanopyProofAuditEvent[] = [];
  let latestPublication: CanopyProofFundingAccountabilityPublicationFact | undefined;
  let latestControl: CanopyProofFundingAccountabilityControlFact | undefined;

  for (const record of records) {
    if (recordSequence(record) !== history.length + 1) {
      throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PROJECT_SEQUENCE_INVALID");
    }
    if (record.kind === "publication") {
      const publication = verifyCanopyProofFundingAccountabilityPublication(
        record.publication,
        record.review,
        history,
      );
      assertProjectScope(publication, organizationId, projectId);
      latestPublication = publication;
      latestControl = undefined;
      history.push(publication.auditEvent);
      continue;
    }
    if (!latestPublication) {
      throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_WITHOUT_PUBLICATION");
    }
    const control = verifyCanopyProofFundingAccountabilityControl(
      record.control,
      latestPublication,
      history,
    );
    if (control.organizationId !== organizationId || control.projectId !== projectId) {
      throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PROJECT_SCOPE_INVALID");
    }
    latestControl = control;
    history.push(control.auditEvent);
  }
  assertProjectHistory(history);
  if (!latestPublication) return undefined;

  const state = currentState(latestPublication, latestControl, evaluatedAt);
  const operationalTotals = operationalTotalsForState(
    latestPublication.publicProjection.totals,
    state,
  );
  const seed = {
    organizationId,
    projectId,
    publicationId: latestPublication.id,
    publicationRoot: latestPublication.publicationRoot,
    projectionRoot: latestPublication.publicProjection.projectionRoot,
    state,
    evaluatedAt,
    operationalTotals,
    publicProjection: latestPublication.publicProjection,
    controlRoot: latestControl?.controlRoot ?? null,
    safety: canopyProofFundingAccountabilitySafety(),
  };
  return currentProjectionSchema.parse({
    ...seed,
    currentRoot: hashJson({
      kind: "canopyproof-funding-accountability-current-projection-v1",
      ...seed,
    }),
  });
}

export function parseCanopyProofFundingAccountabilityReviewFact(input: unknown) {
  return reviewFactSchema.parse(input);
}

export function parseCanopyProofFundingAccountabilityPublicationFact(input: unknown) {
  return publicationFactSchema.parse(input);
}

export function parseCanopyProofFundingAccountabilityControlFact(input: unknown) {
  return controlFactSchema.parse(input);
}

export function parseCanopyProofFundingAccountabilityCurrentProjection(input: unknown) {
  return currentProjectionSchema.parse(input);
}

export function canopyProofFundingAccountabilitySafety() {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    transparencyOnly: true,
    appendOnly: true,
    exactRetryRequired: true,
    currentSourceReResolutionRequired: true,
    threeIndependentAccreditedHumansRequired: true,
    integerCentsOnly: true,
    privateAndPaymentDataForbidden: true,
    challengeAndWithdrawalFailClosed: true,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    notPaymentRail: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notOwnershipRight: true,
    notGuaranteedYield: true,
  } as const;
}

function normalizeMilestones(
  input: readonly z.input<typeof milestoneCommitmentSchema>[],
): readonly z.output<typeof milestoneSchema>[] {
  const ids = new Set<string>();
  return input
    .map((raw) => {
      const parsed = milestoneCommitmentSchema.parse(raw);
      assertCanonicalUtc(parsed.dueAt, `milestone ${parsed.milestoneId} dueAt`);
      if (ids.has(parsed.milestoneId)) {
        throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_DUPLICATE_MILESTONE");
      }
      ids.add(parsed.milestoneId);
      const evidenceRoots = normalizeRootSet(parsed.evidenceRoots, "evidence");
      const proofRecordRoots = normalizeRootSet(parsed.proofRecordRoots, "proof record");
      if (
        parsed.status === "reconciled" &&
        (evidenceRoots.length === 0 || proofRecordRoots.length === 0)
      ) {
        throw new Error(
          "CANOPYPROOF_FUNDING_ACCOUNTABILITY_RECONCILIATION_AUTHORITY_REQUIRED",
        );
      }
      const seed = {
        milestoneId: parsed.milestoneId,
        amountCents: parsed.amountCents,
        dueAt: parsed.dueAt,
        status: parsed.status,
        evidenceRoots,
        proofRecordRoots,
        evidenceRoot: hashMemberRoot(
          "canopyproof-funding-accountability-milestone-evidence-v1",
          evidenceRoots,
        ),
        proofRecordRoot: hashMemberRoot(
          "canopyproof-funding-accountability-milestone-proof-records-v1",
          proofRecordRoots,
        ),
      };
      return milestoneSchema.parse({
        ...seed,
        milestoneRoot: hashJson({
          kind: "canopyproof-funding-accountability-milestone-v1",
          ...seed,
        }),
      });
    })
    .sort((left, right) => left.milestoneId.localeCompare(right.milestoneId));
}

function buildPublicProjection(
  publicationId: string,
  candidate: CanopyProofFundingAccountabilityCandidate,
): CanopyProofFundingAccountabilityPublicProjection {
  const seed = {
    schemaVersion: canopyProofFundingAccountabilitySchemaVersion,
    publicationId,
    organizationId: candidate.organizationId,
    projectId: candidate.projectId,
    sourcePublicId: candidate.sourcePublicId,
    sourceType: candidate.sourceType,
    sourceJurisdictionCode: candidate.sourceJurisdictionCode,
    sourceRestriction: candidate.sourceRestriction,
    purposeCode: candidate.purposeCode,
    candidateRoot: candidate.candidateRoot,
    sourceAuthorityRoot: candidate.sourceAuthorityRoot,
    totals: candidate.totals,
    milestoneCount: candidate.milestones.length,
    reconciledMilestoneCount: candidate.milestones.filter(
      (milestone) => milestone.status === "reconciled",
    ).length,
    challengedMilestoneCount: candidate.milestones.filter(
      (milestone) => milestone.status === "challenged",
    ).length,
    evidenceMemberCount: candidate.milestones.reduce(
      (count, milestone) => count + milestone.evidenceRoots.length,
      0,
    ),
    proofRecordMemberCount: candidate.milestones.reduce(
      (count, milestone) => count + milestone.proofRecordRoots.length,
      0,
    ),
    evidenceRoot: candidate.evidenceRoot,
    proofRecordRoot: candidate.proofRecordRoot,
    policyId: candidate.policyId,
    policyRoot: candidate.policyRoot,
    reportingPeriodStart: candidate.reportingPeriodStart,
    reportingPeriodEnd: candidate.reportingPeriodEnd,
    validFrom: candidate.validFrom,
    validUntil: candidate.validUntil,
  };
  return publicProjectionSchema.parse({
    ...seed,
    projectionRoot: hashJson({
      kind: "canopyproof-funding-accountability-public-projection-v1",
      ...seed,
    }),
  });
}

function hashFundingSourceAuthority(input: Readonly<{
  organizationId: string;
  projectId: string;
  projectAuthorityRoot: string;
  sourcePublicId: string;
  sourceDocumentRoot: string;
  fundingSourceAuthorityRoot: string;
  policyId: string;
  policyRoot: string;
  milestones: readonly z.output<typeof milestoneSchema>[];
}>) {
  return hashJson({
    kind: "canopyproof-funding-accountability-source-authority-v1",
    organizationId: input.organizationId,
    projectId: input.projectId,
    projectAuthorityRoot: input.projectAuthorityRoot,
    sourcePublicId: input.sourcePublicId,
    sourceDocumentRoot: input.sourceDocumentRoot,
    fundingSourceAuthorityRoot: input.fundingSourceAuthorityRoot,
    policyId: input.policyId,
    policyRoot: input.policyRoot,
    milestoneAuthorities: input.milestones.map((milestone) => ({
      milestoneId: milestone.milestoneId,
      evidenceRoots: milestone.evidenceRoots,
      proofRecordRoots: milestone.proofRecordRoots,
    })),
  });
}

function assertCandidateTimes(input: z.output<typeof candidateInputSchema>) {
  for (const [label, value] of [
    ["allocatedAt", input.allocatedAt],
    ["reportingPeriodStart", input.reportingPeriodStart],
    ["reportingPeriodEnd", input.reportingPeriodEnd],
    ["validFrom", input.validFrom],
    ["validUntil", input.validUntil],
    ["preparedAt", input.preparedAt],
  ] as const) {
    assertCanonicalUtc(value, label);
  }
  if (
    Date.parse(input.reportingPeriodStart) >= Date.parse(input.reportingPeriodEnd) ||
    Date.parse(input.allocatedAt) < Date.parse(input.reportingPeriodStart) ||
    Date.parse(input.allocatedAt) > Date.parse(input.reportingPeriodEnd) ||
    Date.parse(input.reportingPeriodEnd) > Date.parse(input.preparedAt) ||
    Date.parse(input.preparedAt) > Date.parse(input.validFrom) ||
    Date.parse(input.validFrom) >= Date.parse(input.validUntil)
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_TIME_INTERVAL_INVALID");
  }
}

function assertCandidateAmounts(
  input: z.output<typeof candidateInputSchema>,
  milestones: readonly z.output<typeof milestoneSchema>[],
) {
  if (input.allocatedCents > input.commitmentCents) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_ALLOCATION_EXCEEDS_COMMITMENT");
  }
  const milestoneCents = sumSafeCents(milestones.map((milestone) => milestone.amountCents));
  if (milestoneCents > input.allocatedCents) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_MILESTONES_EXCEED_ALLOCATION");
  }
}

function currentState(
  publication: CanopyProofFundingAccountabilityPublicationFact,
  control: CanopyProofFundingAccountabilityControlFact | undefined,
  evaluatedAt: string,
): "active" | "challenged" | "withdrawn" | "expired" {
  if (control?.action === "withdraw") return "withdrawn";
  if (control?.action === "challenge") return "challenged";
  const epoch = Date.parse(evaluatedAt);
  if (
    epoch < Date.parse(publication.candidate.validFrom) ||
    epoch > Date.parse(publication.candidate.validUntil)
  ) {
    return "expired";
  }
  return "active";
}

function operationalTotalsForState(
  totals: z.output<typeof totalsSchema>,
  state: "active" | "challenged" | "withdrawn" | "expired",
) {
  if (state === "active") return totals;
  if (state === "challenged") {
    return {
      committedCents: totals.committedCents,
      allocatedCents: totals.allocatedCents,
      reconciledCents: 0,
      challengedCents: totals.allocatedCents,
    };
  }
  return {
    committedCents: 0,
    allocatedCents: 0,
    reconciledCents: 0,
    challengedCents: 0,
  };
}

function normalizeRootSet(values: readonly string[], label: string) {
  const normalized = [...new Set(values)].sort();
  if (normalized.length !== values.length) {
    throw new Error(`CANOPYPROOF_FUNDING_ACCOUNTABILITY_DUPLICATE_${label.toUpperCase().replaceAll(" ", "_")}_ROOT`);
  }
  return normalized;
}

function hashMemberRoot(kind: string, values: readonly string[]) {
  return values.length > 0
    ? merkleRoot([...values].sort())
    : hashJson({ kind, members: [] });
}

function sumSafeCents(values: readonly number[]) {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_AMOUNT_OVERFLOW");
    }
  }
  return total;
}

function normalizeActor(
  input: unknown,
  boundary: "preparer" | "reviewer" | "publisher" | "governor",
): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = [...new Set(parsed.accreditationScope)].sort();
  if (hashJson(accreditationScope) !== hashJson(parsed.accreditationScope)) {
    throw new Error(
      `CANOPYPROOF_FUNDING_ACCOUNTABILITY_${boundary.toUpperCase()}_SCOPE_NON_CANONICAL`,
    );
  }
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
    ...(parsed.accreditationRoot ? { accreditationRoot: parsed.accreditationRoot } : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({
    kind: "canopyproof-verification-actor-authority-v1",
    ...normalized,
  });
  if (authorityRoot !== parsed.authorityRoot) {
    throw new Error(
      `CANOPYPROOF_FUNDING_ACCOUNTABILITY_${boundary.toUpperCase()}_AUTHORITY_ROOT_INVALID`,
    );
  }
  return { ...normalized, authorityRoot };
}

function requireAccreditedHuman(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
  scope: string,
  roles: readonly CanopyProofVerificationActorSnapshot["role"][],
) {
  if (
    actor.participantType !== "human" ||
    !roles.includes(actor.role) ||
    actor.organizationId !== organizationId ||
    actor.organizationVerificationStatus !== "verified" ||
    !actor.membershipId ||
    actor.membershipStatus !== "active" ||
    !actor.membershipRoot ||
    !actor.accreditationId ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes(scope)
  ) {
    throw new Error(`CANOPYPROOF_FUNDING_ACCOUNTABILITY_SCOPE_REQUIRED:${scope}`);
  }
}

function assertCanonicalUtc(value: string, label: string) {
  if (new Date(value).toISOString() !== value) {
    throw new Error(`CANOPYPROOF_FUNDING_ACCOUNTABILITY_TIMESTAMP_NON_CANONICAL:${label}`);
  }
}

function assertProjectHistory(history: readonly CanopyProofAuditEvent[]) {
  if (history.length === 0) return;
  const verification = verifyCanopyProofAuditChain(history, history.at(-1)!.createdAt);
  if (!verification.valid) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_AUDIT_HISTORY_INVALID");
  }
  if (history.some((event) => event.entityType !== "funding_accountability_publication")) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_AUDIT_SCOPE_INVALID");
  }
}

function assertProjectScope(
  publication: CanopyProofFundingAccountabilityPublicationFact,
  organizationId: string,
  projectId: string,
) {
  if (
    publication.candidate.organizationId !== organizationId ||
    publication.candidate.projectId !== projectId
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PROJECT_SCOPE_INVALID");
  }
}

function recordSequence(record: CanopyProofFundingAccountabilityRecord) {
  return record.kind === "publication"
    ? record.publication.projectSequence
    : record.control.projectSequence;
}

function assertFundingDocumentSafe(input: unknown) {
  const forbiddenKeys = new Set([
    "accountnumber",
    "bankaccount",
    "bankrouting",
    "cardnumber",
    "coordinates",
    "email",
    "iban",
    "latitude",
    "longitude",
    "paymenttoken",
    "phone",
    "privatekey",
    "secret",
    "taxidentifier",
    "walletaddress",
  ]);
  const unsafeClaims = [
    /\bcertified\s+carbon\s+credit\b/i,
    /\bcarbon[-\s]?tax\s+offset\b/i,
    /\bguarantee(?:d|s|ing)?\s+(?:rwa\s+)?yield\b/i,
    /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
    /\bmainnet\s+funds?\b/i,
    /\bprivate\s+key\b/i,
  ];
  const visit = (value: unknown, depth: number) => {
    if (depth > 16) {
      throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_DOCUMENT_DEPTH_EXCEEDED");
    }
    if (typeof value === "string") {
      for (const pattern of unsafeClaims) {
        const match = pattern.exec(value);
        if (match && !claimIsExplicitlyNegated(value, match.index)) {
          throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_UNSAFE_CLAIM");
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (forbiddenKeys.has(key.toLowerCase().replaceAll(/[_-]/g, ""))) {
        throw new Error(`CANOPYPROOF_FUNDING_ACCOUNTABILITY_FORBIDDEN_KEY:${key}`);
      }
      visit(nested, depth + 1);
    }
  };
  visit(input, 0);
}

function claimIsExplicitlyNegated(value: string, matchIndex: number) {
  const prefix = value.slice(Math.max(0, matchIndex - 40), matchIndex);
  return /\b(?:no|not|never|without|does\s+not|do\s+not)(?:\s+(?:a|an|any))?\s*$/i.test(
    prefix,
  );
}
