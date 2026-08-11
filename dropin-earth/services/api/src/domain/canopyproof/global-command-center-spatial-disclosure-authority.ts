import { hashJson } from "@dropin/crypto";
import {
  canopyProofGlobalCommandCenterSpatialDisclosureSchema,
  type CanopyProofGlobalCommandCenterSpatialDisclosure,
} from "@dropin/schemas/canopyproof-global-command-center";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  buildCanopyProofGlobalCommandCenterSpatialDisclosure,
} from "./global-command-center.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofGlobalCommandCenterSpatialDisclosureSchemaVersion =
  "canopyproof.global-command-center.spatial-disclosure.v1" as const;

export const canopyProofGlobalCommandCenterSpatialDisclosureScopes = {
  privacyReview: "global_command_center:spatial_privacy_review",
  safeguardingReview: "global_command_center:spatial_safeguarding_review",
  publish: "global_command_center:spatial_publish",
  withdraw: "global_command_center:spatial_withdraw",
} as const;

export const canopyProofGlobalCommandCenterSpatialReviewKinds = [
  "privacy",
  "safeguarding",
] as const;

export const canopyProofGlobalCommandCenterSpatialReviewDecisions = [
  "approved",
  "rejected",
] as const;

export const canopyProofGlobalCommandCenterSpatialWithdrawalReasons = [
  "privacy_risk",
  "safeguarding_risk",
  "source_invalidated",
  "governance_order",
] as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const timestampSchema = z.string().datetime({ offset: true });
const rationaleSchema = z.string().trim().min(12).max(512);

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
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(64),
    authorityRoot: hashSchema,
  })
  .strict();

const candidateFields = {
  schemaVersion: z.literal(canopyProofGlobalCommandCenterSpatialDisclosureSchemaVersion),
  organizationId: identifierSchema,
  regionId: identifierSchema,
  centroid: z
    .object({
      latitudeDegrees: z.number().int().min(-90).max(90),
      longitudeDegrees: z.number().int().min(-180).max(179),
    })
    .strict(),
  precisionDegrees: z.literal(1),
  sourceProjectCount: z.number().int().min(3).max(Number.MAX_SAFE_INTEGER),
  minimumCohortSize: z.literal(3),
  regionSourceRoot: hashSchema,
  policyId: identifierSchema,
  policyRoot: hashSchema,
  validFrom: timestampSchema,
  validUntil: timestampSchema,
} as const;

const candidateCommitmentSchema = z
  .object(candidateFields)
  .strict()
  .superRefine(validateCandidateInterval);

const candidateSchema = z
  .object({
    ...candidateFields,
    candidateRoot: hashSchema,
  })
  .strict()
  .superRefine(validateCandidateInterval);

const authoritySafetySchema = z
  .object({
    routeMounted: z.literal(false),
    schedulerMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    appendOnly: z.literal(true),
    exactRetryRequired: z.literal(true),
    currentSourceReResolutionRequired: z.literal(true),
    independentHumanPrivacyReviewRequired: z.literal(true),
    independentHumanSafeguardingReviewRequired: z.literal(true),
    accreditedHumanPublisherRequired: z.literal(true),
    withdrawalFailClosed: z.literal(true),
    rawCoordinatesForbidden: z.literal(true),
    minimumCohortSize: z.literal(3),
    noMainnetFunds: z.literal(true),
    noAutomaticCanopyDistribution: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "CHALLENGE"]),
    actor: identifierSchema,
    entityType: z.enum([
      "global_command_center_spatial_review",
      "global_command_center_spatial_disclosure",
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
    factType: z.literal("global_command_center_spatial_review"),
    id: identifierSchema,
    candidate: candidateSchema,
    reviewKind: z.enum(canopyProofGlobalCommandCenterSpatialReviewKinds),
    decision: z.enum(canopyProofGlobalCommandCenterSpatialReviewDecisions),
    reviewer: actorSchema,
    reviewedAt: timestampSchema,
    rationale: rationaleSchema,
    commandHash: hashSchema,
    reviewSequence: z.literal(1),
    previousEventRoot: hashSchema,
    reviewRoot: hashSchema,
    safety: authoritySafetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const disclosureFactSchema = z
  .object({
    factType: z.literal("global_command_center_spatial_disclosure"),
    id: identifierSchema,
    candidate: candidateSchema,
    privacyReviewId: identifierSchema,
    privacyReviewRoot: hashSchema,
    privacyReviewerId: identifierSchema,
    privacyReviewerAuthorityRoot: hashSchema,
    safeguardingReviewId: identifierSchema,
    safeguardingReviewRoot: hashSchema,
    safeguardingReviewerId: identifierSchema,
    safeguardingReviewerAuthorityRoot: hashSchema,
    publisher: actorSchema,
    publishedAt: timestampSchema,
    commandHash: hashSchema,
    regionSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    disclosure: canopyProofGlobalCommandCenterSpatialDisclosureSchema,
    disclosureRoot: hashSchema,
    publicationRoot: hashSchema,
    safety: authoritySafetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const controlFactSchema = z
  .object({
    factType: z.literal("global_command_center_spatial_disclosure_control"),
    id: identifierSchema,
    organizationId: identifierSchema,
    regionId: identifierSchema,
    publicationId: identifierSchema,
    publicationRoot: hashSchema,
    disclosureRoot: hashSchema,
    action: z.literal("withdraw"),
    reasonCode: z.enum(canopyProofGlobalCommandCenterSpatialWithdrawalReasons),
    rationale: rationaleSchema,
    governor: actorSchema,
    controlledAt: timestampSchema,
    commandHash: hashSchema,
    regionSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    controlRoot: hashSchema,
    safety: authoritySafetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

export type CanopyProofGlobalCommandCenterSpatialCandidateCommitment = z.input<
  typeof candidateCommitmentSchema
>;
export type CanopyProofGlobalCommandCenterSpatialCandidate = z.output<typeof candidateSchema>;
export type CanopyProofGlobalCommandCenterSpatialReviewFact = z.output<typeof reviewFactSchema>;
export type CanopyProofGlobalCommandCenterSpatialDisclosureFact = z.output<
  typeof disclosureFactSchema
>;
export type CanopyProofGlobalCommandCenterSpatialControlFact = z.output<typeof controlFactSchema>;
export type CanopyProofGlobalCommandCenterSpatialAuthorityRecord =
  | Readonly<{
      kind: "disclosure";
      disclosure: CanopyProofGlobalCommandCenterSpatialDisclosureFact;
      privacyReview: CanopyProofGlobalCommandCenterSpatialReviewFact;
      safeguardingReview: CanopyProofGlobalCommandCenterSpatialReviewFact;
    }>
  | Readonly<{
      kind: "control";
      control: CanopyProofGlobalCommandCenterSpatialControlFact;
    }>;

export function buildCanopyProofGlobalCommandCenterSpatialCandidate(
  input: CanopyProofGlobalCommandCenterSpatialCandidateCommitment,
): CanopyProofGlobalCommandCenterSpatialCandidate {
  const commitment = candidateCommitmentSchema.parse(input);
  assertCanonicalUtc(commitment.validFrom, "candidate validFrom");
  assertCanonicalUtc(commitment.validUntil, "candidate validUntil");
  return candidateSchema.parse({
    ...commitment,
    candidateRoot: hashCanopyProofGlobalCommandCenterSpatialCandidate(commitment),
  });
}

export function hashCanopyProofGlobalCommandCenterSpatialCandidate(
  input: CanopyProofGlobalCommandCenterSpatialCandidateCommitment,
) {
  const commitment = candidateCommitmentSchema.parse(input);
  return hashJson({
    kind: "canopyproof-global-command-center-spatial-candidate-v1",
    ...commitment,
  });
}

export function verifyCanopyProofGlobalCommandCenterSpatialCandidate(
  input: unknown,
): CanopyProofGlobalCommandCenterSpatialCandidate {
  const candidate = candidateSchema.parse(input);
  assertCanonicalUtc(candidate.validFrom, "candidate validFrom");
  assertCanonicalUtc(candidate.validUntil, "candidate validUntil");
  const expectedRoot = hashJson({
    kind: "canopyproof-global-command-center-spatial-candidate-v1",
    schemaVersion: candidate.schemaVersion,
    organizationId: candidate.organizationId,
    regionId: candidate.regionId,
    centroid: candidate.centroid,
    precisionDegrees: candidate.precisionDegrees,
    sourceProjectCount: candidate.sourceProjectCount,
    minimumCohortSize: candidate.minimumCohortSize,
    regionSourceRoot: candidate.regionSourceRoot,
    policyId: candidate.policyId,
    policyRoot: candidate.policyRoot,
    validFrom: candidate.validFrom,
    validUntil: candidate.validUntil,
  });
  if (candidate.candidateRoot !== expectedRoot) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CANDIDATE_ROOT_INVALID");
  }
  return candidate;
}

export function buildCanopyProofGlobalCommandCenterSpatialReview(
  input: Readonly<{
    candidate: CanopyProofGlobalCommandCenterSpatialCandidate;
    reviewKind: (typeof canopyProofGlobalCommandCenterSpatialReviewKinds)[number];
    decision: (typeof canopyProofGlobalCommandCenterSpatialReviewDecisions)[number];
    reviewedAt: string;
    rationale: string;
  }>,
  reviewerInput: CanopyProofVerificationActorSnapshot,
): CanopyProofGlobalCommandCenterSpatialReviewFact {
  const candidate = verifyCanopyProofGlobalCommandCenterSpatialCandidate(input.candidate);
  const reviewKind = z.enum(canopyProofGlobalCommandCenterSpatialReviewKinds).parse(input.reviewKind);
  const decision = z.enum(canopyProofGlobalCommandCenterSpatialReviewDecisions).parse(input.decision);
  const reviewedAt = timestampSchema.parse(input.reviewedAt);
  const rationale = rationaleSchema.parse(input.rationale);
  assertCanonicalUtc(reviewedAt, "reviewedAt");
  if (Date.parse(reviewedAt) > Date.parse(candidate.validUntil)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_WINDOW_INVALID");
  }
  const reviewer = normalizeActor(reviewerInput, "reviewer");
  const scope =
    reviewKind === "privacy"
      ? canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview
      : canopyProofGlobalCommandCenterSpatialDisclosureScopes.safeguardingReview;
  requireAccreditedActor(reviewer, candidate.organizationId, scope, "human", [
    "owner",
    "admin",
    "verifier",
  ]);
  const commandHash = hashJson({
    kind: "canopyproof-global-command-center-spatial-review-command-v1",
    candidate,
    reviewKind,
    decision,
    reviewerAuthorityRoot: reviewer.authorityRoot,
    reviewedAt,
    rationale,
  });
  const id = `cp_spatial_review_${commandHash.slice(0, 24)}`;
  const previousEventRoot = canopyProofAuditGenesisRoot();
  const seed = {
    factType: "global_command_center_spatial_review" as const,
    id,
    candidate,
    reviewKind,
    decision,
    reviewer,
    reviewedAt,
    rationale,
    commandHash,
    reviewSequence: 1 as const,
    previousEventRoot,
    safety: canopyProofGlobalCommandCenterSpatialDisclosureAuthoritySafety(),
  };
  const reviewRoot = hashJson({
    kind: "canopyproof-global-command-center-spatial-review-v1",
    ...seed,
  });
  const payload = { ...seed, reviewRoot };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: reviewer.id,
    entityType: "global_command_center_spatial_review",
    entityId: id,
    payload,
    createdAt: reviewedAt,
    rationale:
      reviewKind === "privacy"
        ? "An accredited human appended an immutable privacy decision over an exact minimized spatial candidate."
        : "An accredited human appended an immutable safeguarding decision over an exact minimized spatial candidate.",
  }).at(-1);
  if (!auditEvent) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_AUDIT_MISSING");
  return reviewFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofGlobalCommandCenterSpatialReview(
  input: unknown,
): CanopyProofGlobalCommandCenterSpatialReviewFact {
  const review = reviewFactSchema.parse(input);
  const expected = buildCanopyProofGlobalCommandCenterSpatialReview(
    {
      candidate: review.candidate,
      reviewKind: review.reviewKind,
      decision: review.decision,
      reviewedAt: review.reviewedAt,
      rationale: review.rationale,
    },
    normalizeActor(review.reviewer, "reviewer"),
  );
  if (hashJson(review) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_ROOT_INVALID");
  }
  return review;
}

export function buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
  input: Readonly<{
    candidate: CanopyProofGlobalCommandCenterSpatialCandidate;
    privacyReview: CanopyProofGlobalCommandCenterSpatialReviewFact;
    safeguardingReview: CanopyProofGlobalCommandCenterSpatialReviewFact;
    publishedAt: string;
  }>,
  publisherInput: CanopyProofVerificationActorSnapshot,
  regionHistory: readonly CanopyProofAuditEvent[] = [],
): CanopyProofGlobalCommandCenterSpatialDisclosureFact {
  const candidate = verifyCanopyProofGlobalCommandCenterSpatialCandidate(input.candidate);
  const privacyReview = verifyCanopyProofGlobalCommandCenterSpatialReview(input.privacyReview);
  const safeguardingReview = verifyCanopyProofGlobalCommandCenterSpatialReview(
    input.safeguardingReview,
  );
  assertRegionHistory(regionHistory);
  assertApprovedReviews(candidate, privacyReview, safeguardingReview);
  const publisher = normalizeActor(publisherInput, "publisher");
  requireAccreditedActor(
    publisher,
    candidate.organizationId,
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish,
    "human",
    ["owner", "admin"],
  );
  if (
    publisher.id === privacyReview.reviewer.id ||
    publisher.id === safeguardingReview.reviewer.id
  ) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_PUBLISHER_INDEPENDENCE_REQUIRED");
  }
  const publishedAt = timestampSchema.parse(input.publishedAt);
  assertCanonicalUtc(publishedAt, "publishedAt");
  if (
    Date.parse(publishedAt) < Date.parse(privacyReview.reviewedAt) ||
    Date.parse(publishedAt) < Date.parse(safeguardingReview.reviewedAt) ||
    Date.parse(publishedAt) < Date.parse(candidate.validFrom) ||
    Date.parse(publishedAt) > Date.parse(candidate.validUntil)
  ) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_PUBLICATION_WINDOW_INVALID");
  }
  const disclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure({
    regionId: candidate.regionId,
    centroid: candidate.centroid,
    precisionDegrees: candidate.precisionDegrees,
    sourceProjectCount: candidate.sourceProjectCount,
    minimumCohortSize: candidate.minimumCohortSize,
    regionSourceRoot: candidate.regionSourceRoot,
    privacyReviewRoot: privacyReview.reviewRoot,
    safeguardingReviewRoot: safeguardingReview.reviewRoot,
    validFrom: candidate.validFrom,
    validUntil: candidate.validUntil,
  });
  const commandHash = hashJson({
    kind: "canopyproof-global-command-center-spatial-disclosure-command-v1",
    candidate,
    privacyReviewRoot: privacyReview.reviewRoot,
    safeguardingReviewRoot: safeguardingReview.reviewRoot,
    publisherAuthorityRoot: publisher.authorityRoot,
    publishedAt,
  });
  const id = `cp_spatial_disclosure_${commandHash.slice(0, 24)}`;
  const regionSequence = regionHistory.length + 1;
  const previousEventRoot = regionHistory.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const seed = {
    factType: "global_command_center_spatial_disclosure" as const,
    id,
    candidate,
    privacyReviewId: privacyReview.id,
    privacyReviewRoot: privacyReview.reviewRoot,
    privacyReviewerId: privacyReview.reviewer.id,
    privacyReviewerAuthorityRoot: privacyReview.reviewer.authorityRoot,
    safeguardingReviewId: safeguardingReview.id,
    safeguardingReviewRoot: safeguardingReview.reviewRoot,
    safeguardingReviewerId: safeguardingReview.reviewer.id,
    safeguardingReviewerAuthorityRoot: safeguardingReview.reviewer.authorityRoot,
    publisher,
    publishedAt,
    commandHash,
    regionSequence,
    previousEventRoot,
    disclosure,
    disclosureRoot: disclosure.disclosureRoot,
    safety: canopyProofGlobalCommandCenterSpatialDisclosureAuthoritySafety(),
  };
  const publicationRoot = hashJson({
    kind: "canopyproof-global-command-center-spatial-disclosure-publication-v1",
    ...seed,
  });
  const payload = { ...seed, publicationRoot };
  const auditEvent = appendCanopyProofAuditEvent(regionHistory, {
    action: "ASSERT",
    actor: publisher.id,
    entityType: "global_command_center_spatial_disclosure",
    entityId: id,
    payload,
    createdAt: publishedAt,
    rationale:
      "An authorized publisher appended a one-degree regional disclosure after independent privacy and safeguarding approval.",
  }).at(-1);
  if (!auditEvent) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_AUDIT_MISSING");
  return disclosureFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact(
  input: unknown,
  privacyReviewInput: unknown,
  safeguardingReviewInput: unknown,
  regionHistory: readonly CanopyProofAuditEvent[] = [],
): CanopyProofGlobalCommandCenterSpatialDisclosureFact {
  const fact = disclosureFactSchema.parse(input);
  const privacyReview = verifyCanopyProofGlobalCommandCenterSpatialReview(privacyReviewInput);
  const safeguardingReview = verifyCanopyProofGlobalCommandCenterSpatialReview(
    safeguardingReviewInput,
  );
  const expected = buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
    {
      candidate: fact.candidate,
      privacyReview,
      safeguardingReview,
      publishedAt: fact.publishedAt,
    },
    normalizeActor(fact.publisher, "publisher"),
    regionHistory,
  );
  if (hashJson(fact) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_PUBLICATION_ROOT_INVALID");
  }
  return fact;
}

export function buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
  input: Readonly<{
    disclosure: CanopyProofGlobalCommandCenterSpatialDisclosureFact;
    reasonCode: (typeof canopyProofGlobalCommandCenterSpatialWithdrawalReasons)[number];
    rationale: string;
    controlledAt: string;
  }>,
  governorInput: CanopyProofVerificationActorSnapshot,
  regionHistory: readonly CanopyProofAuditEvent[],
): CanopyProofGlobalCommandCenterSpatialControlFact {
  const disclosure = disclosureFactSchema.parse(input.disclosure);
  const reasonCode = z.enum(canopyProofGlobalCommandCenterSpatialWithdrawalReasons).parse(input.reasonCode);
  const rationale = rationaleSchema.parse(input.rationale);
  const controlledAt = timestampSchema.parse(input.controlledAt);
  assertCanonicalUtc(controlledAt, "controlledAt");
  assertRegionHistory(regionHistory);
  if (regionHistory.at(-1)?.eventRoot !== disclosure.auditEvent.eventRoot) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_WITHDRAWAL_NOT_CURRENT");
  }
  if (Date.parse(controlledAt) < Date.parse(disclosure.publishedAt)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_WITHDRAWAL_TIME_INVALID");
  }
  const governor = normalizeActor(governorInput, "governor");
  requireAccreditedActor(
    governor,
    disclosure.candidate.organizationId,
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.withdraw,
    "human",
    ["owner", "admin", "verifier"],
  );
  if (governor.id === disclosure.publisher.id) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_WITHDRAWAL_INDEPENDENCE_REQUIRED");
  }
  const commandHash = hashJson({
    kind: "canopyproof-global-command-center-spatial-withdrawal-command-v1",
    publicationId: disclosure.id,
    publicationRoot: disclosure.publicationRoot,
    disclosureRoot: disclosure.disclosureRoot,
    reasonCode,
    rationale,
    governorAuthorityRoot: governor.authorityRoot,
    controlledAt,
  });
  const id = `cp_spatial_control_${commandHash.slice(0, 24)}`;
  const regionSequence = regionHistory.length + 1;
  const previousEventRoot = regionHistory.at(-1)!.eventRoot;
  const seed = {
    factType: "global_command_center_spatial_disclosure_control" as const,
    id,
    organizationId: disclosure.candidate.organizationId,
    regionId: disclosure.candidate.regionId,
    publicationId: disclosure.id,
    publicationRoot: disclosure.publicationRoot,
    disclosureRoot: disclosure.disclosureRoot,
    action: "withdraw" as const,
    reasonCode,
    rationale,
    governor,
    controlledAt,
    commandHash,
    regionSequence,
    previousEventRoot,
    safety: canopyProofGlobalCommandCenterSpatialDisclosureAuthoritySafety(),
  };
  const controlRoot = hashJson({
    kind: "canopyproof-global-command-center-spatial-withdrawal-v1",
    ...seed,
  });
  const payload = { ...seed, controlRoot };
  const auditEvent = appendCanopyProofAuditEvent(regionHistory, {
    action: "CHALLENGE",
    actor: governor.id,
    entityType: "global_command_center_spatial_disclosure",
    entityId: id,
    payload,
    createdAt: controlledAt,
    rationale:
      "An independent accredited human withdrew the current regional spatial disclosure; public geometry must fail closed.",
  }).at(-1);
  if (!auditEvent) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_AUDIT_MISSING");
  return controlFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofGlobalCommandCenterSpatialWithdrawal(
  input: unknown,
  disclosureInput: unknown,
  regionHistory: readonly CanopyProofAuditEvent[],
): CanopyProofGlobalCommandCenterSpatialControlFact {
  const control = controlFactSchema.parse(input);
  const disclosure = disclosureFactSchema.parse(disclosureInput);
  const expected = buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
    {
      disclosure,
      reasonCode: control.reasonCode,
      rationale: control.rationale,
      controlledAt: control.controlledAt,
    },
    normalizeActor(control.governor, "governor"),
    regionHistory,
  );
  if (hashJson(control) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_ROOT_INVALID");
  }
  return control;
}

export function resolveCanopyProofGlobalCommandCenterSpatialDisclosure(
  input: Readonly<{
    organizationId: string;
    regionId: string;
    regionSourceRoot: string;
    sourceProjectCount: number;
    at: string;
    records: readonly CanopyProofGlobalCommandCenterSpatialAuthorityRecord[];
  }>,
): CanopyProofGlobalCommandCenterSpatialDisclosure | undefined {
  const organizationId = identifierSchema.parse(input.organizationId);
  const regionId = identifierSchema.parse(input.regionId);
  const regionSourceRoot = hashSchema.parse(input.regionSourceRoot);
  const sourceProjectCount = z.number().int().nonnegative().parse(input.sourceProjectCount);
  const at = timestampSchema.parse(input.at);
  assertCanonicalUtc(at, "projection time");
  if (input.records.length > 1_024) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REGION_HISTORY_LIMIT_EXCEEDED");
  }
  const records = [...input.records].sort(
    (left, right) => recordSequence(left) - recordSequence(right),
  );
  const history: CanopyProofAuditEvent[] = [];
  let latestDisclosure:
    | CanopyProofGlobalCommandCenterSpatialDisclosureFact
    | undefined;
  let withdrawn = false;

  for (const record of records) {
    const expectedSequence = history.length + 1;
    if (recordSequence(record) !== expectedSequence) {
      throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REGION_SEQUENCE_INVALID");
    }
    if (record.kind === "disclosure") {
      const disclosure = verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        record.disclosure,
        record.privacyReview,
        record.safeguardingReview,
        history,
      );
      assertRegionScope(disclosure, organizationId, regionId);
      latestDisclosure = disclosure;
      withdrawn = false;
      history.push(disclosure.auditEvent);
      continue;
    }
    if (!latestDisclosure) {
      throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_WITHOUT_PUBLICATION");
    }
    const control = verifyCanopyProofGlobalCommandCenterSpatialWithdrawal(
      record.control,
      latestDisclosure,
      history,
    );
    if (control.organizationId !== organizationId || control.regionId !== regionId) {
      throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REGION_SCOPE_INVALID");
    }
    withdrawn = true;
    history.push(control.auditEvent);
  }

  assertRegionHistory(history);
  if (!latestDisclosure || withdrawn) return undefined;
  const candidate = latestDisclosure.candidate;
  const atEpoch = Date.parse(at);
  if (
    candidate.regionSourceRoot !== regionSourceRoot ||
    candidate.sourceProjectCount !== sourceProjectCount ||
    atEpoch < Date.parse(candidate.validFrom) ||
    atEpoch > Date.parse(candidate.validUntil)
  ) {
    return undefined;
  }
  return canopyProofGlobalCommandCenterSpatialDisclosureSchema.parse(
    latestDisclosure.disclosure,
  );
}

export function parseCanopyProofGlobalCommandCenterSpatialReviewFact(input: unknown) {
  return reviewFactSchema.parse(input);
}

export function parseCanopyProofGlobalCommandCenterSpatialDisclosureFact(input: unknown) {
  return disclosureFactSchema.parse(input);
}

export function parseCanopyProofGlobalCommandCenterSpatialControlFact(input: unknown) {
  return controlFactSchema.parse(input);
}

export function canopyProofGlobalCommandCenterSpatialDisclosureAuthoritySafety() {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    appendOnly: true,
    exactRetryRequired: true,
    currentSourceReResolutionRequired: true,
    independentHumanPrivacyReviewRequired: true,
    independentHumanSafeguardingReviewRequired: true,
    accreditedHumanPublisherRequired: true,
    withdrawalFailClosed: true,
    rawCoordinatesForbidden: true,
    minimumCohortSize: 3,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
  } as const;
}

function validateCandidateInterval(
  value: { readonly validFrom: string; readonly validUntil: string },
  context: z.RefinementCtx,
) {
  if (Date.parse(value.validFrom) >= Date.parse(value.validUntil)) {
    context.addIssue({ code: "custom", message: "Spatial candidate validity interval is invalid." });
  }
}

function assertApprovedReviews(
  candidate: CanopyProofGlobalCommandCenterSpatialCandidate,
  privacyReview: CanopyProofGlobalCommandCenterSpatialReviewFact,
  safeguardingReview: CanopyProofGlobalCommandCenterSpatialReviewFact,
) {
  if (
    privacyReview.reviewKind !== "privacy" ||
    safeguardingReview.reviewKind !== "safeguarding" ||
    privacyReview.decision !== "approved" ||
    safeguardingReview.decision !== "approved"
  ) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_TWO_APPROVALS_REQUIRED");
  }
  if (
    hashJson(privacyReview.candidate) !== hashJson(candidate) ||
    hashJson(safeguardingReview.candidate) !== hashJson(candidate)
  ) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_CANDIDATE_MISMATCH");
  }
  if (privacyReview.reviewer.id === safeguardingReview.reviewer.id) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEWER_INDEPENDENCE_REQUIRED");
  }
}

function normalizeActor(
  input: unknown,
  boundary: "reviewer" | "publisher" | "governor",
): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = [...new Set(parsed.accreditationScope)].sort();
  if (hashJson(accreditationScope) !== hashJson(parsed.accreditationScope)) {
    throw new Error(`CANOPYPROOF_SPATIAL_DISCLOSURE_${boundary.toUpperCase()}_SCOPE_NON_CANONICAL`);
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
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: parsed.accreditationRoot } : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({
    kind: "canopyproof-verification-actor-authority-v1",
    ...normalized,
  });
  if (authorityRoot !== parsed.authorityRoot) {
    throw new Error(`CANOPYPROOF_SPATIAL_DISCLOSURE_${boundary.toUpperCase()}_AUTHORITY_ROOT_INVALID`);
  }
  return { ...normalized, authorityRoot };
}

function requireAccreditedActor(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
  scope: string,
  participantType: "human" | undefined,
  roles: readonly CanopyProofVerificationActorSnapshot["role"][],
) {
  if (
    (participantType && actor.participantType !== participantType) ||
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
    throw new Error(`CANOPYPROOF_SPATIAL_DISCLOSURE_SCOPE_REQUIRED:${scope}`);
  }
}

function assertCanonicalUtc(value: string, label: string) {
  if (new Date(value).toISOString() !== value) {
    throw new Error(`CANOPYPROOF_SPATIAL_DISCLOSURE_TIMESTAMP_NON_CANONICAL:${label}`);
  }
}

function assertRegionHistory(history: readonly CanopyProofAuditEvent[]) {
  if (history.length === 0) return;
  const verification = verifyCanopyProofAuditChain(history, history.at(-1)!.createdAt);
  if (!verification.valid) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_AUDIT_HISTORY_INVALID");
  }
}

function assertRegionScope(
  disclosure: CanopyProofGlobalCommandCenterSpatialDisclosureFact,
  organizationId: string,
  regionId: string,
) {
  if (
    disclosure.candidate.organizationId !== organizationId ||
    disclosure.candidate.regionId !== regionId
  ) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REGION_SCOPE_INVALID");
  }
}

function recordSequence(record: CanopyProofGlobalCommandCenterSpatialAuthorityRecord) {
  return record.kind === "disclosure"
    ? record.disclosure.regionSequence
    : record.control.regionSequence;
}
