import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  organizationAccreditationActorAuthorityRoot,
  type CanopyProofOrganizationAccreditationActorSnapshot,
} from "./organization-accreditation-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofProjectLifecycleSchemaVersion =
  "canopyproof.project-lifecycle.v1" as const;

export const canopyProofProjectLifecycleScopes = {
  propose: "projects:lifecycle_propose",
  review: "projects:lifecycle_review",
  govern: "projects:lifecycle_govern",
} as const;

export const canopyProofProjectLifecycleStages = [
  "PENDING_REVIEW",
  "REJECTED",
  "PROPOSED",
  "FUNDED",
  "VERIFIED",
  "LONG_TERM_OBSERVATION",
  "CLOSED",
  "CHALLENGED",
  "SUSPENDED",
  "REVOKED",
  "EXPIRED",
] as const;

export const canopyProofProjectLifecycleCanonicalStages = [
  "PROPOSED",
  "FUNDED",
  "VERIFIED",
  "LONG_TERM_OBSERVATION",
  "CLOSED",
] as const;

export const canopyProofProjectLifecycleControlActions = [
  "challenge",
  "suspend",
  "restore",
  "revoke",
] as const;

export const canopyProofProjectLifecycleInterventionTypes = [
  "reforestation",
  "ecosystem_restoration",
  "biodiversity",
  "water",
  "soil_regeneration",
  "climate_observation",
] as const;

export type CanopyProofProjectLifecycleStage =
  (typeof canopyProofProjectLifecycleStages)[number];
export type CanopyProofProjectLifecycleCanonicalStage =
  (typeof canopyProofProjectLifecycleCanonicalStages)[number];
export type CanopyProofProjectLifecycleControlAction =
  (typeof canopyProofProjectLifecycleControlActions)[number];

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const hashSchema = z.string().regex(HASH_PATTERN);
const identifierSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const timestampSchema = z.string().datetime({ offset: true });
const rationaleSchema = z.string().trim().min(24).max(4_000);
const reasonCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{2,63}$/);
const safeNonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(["owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: hashSchema,
    authoritySource: z.enum([
      "subject_membership",
      "root_governance_bootstrap",
      "canonical_accreditation",
    ]),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.literal("approved").optional(),
    accreditationDecisionRoot: hashSchema.optional(),
    accreditationProjectionRoot: hashSchema.optional(),
    accreditationValidFrom: timestampSchema.optional(),
    accreditationValidUntil: timestampSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(64),
    authorityRoot: hashSchema,
  })
  .strict();

const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "REASON", "CHALLENGE", "FULFILL"]),
    actor: identifierSchema,
    entityType: z.enum([
      "project_lifecycle_registration",
      "project_lifecycle_review",
      "project_lifecycle_transition",
      "project_lifecycle_control",
    ]),
    entityId: identifierSchema,
    previousRoot: hashSchema,
    payloadHash: hashSchema,
    eventRoot: hashSchema,
    createdAt: timestampSchema,
    rationale: z.string().trim().min(1).max(512),
  })
  .strict();

const safetySchema = z
  .object({
    routeMounted: z.literal(false),
    schedulerMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    appendOnly: z.literal(true),
    exactRetryRequired: z.literal(true),
    currentSourceReResolutionRequired: z.literal(true),
    independentHumanReviewRequired: z.literal(true),
    humanGovernanceRequiredForTransitions: z.literal(true),
    aiAdvisoryOnly: z.literal(true),
    adverseStateNeverFallsBack: z.literal(true),
    integerMeasurementsOnly: z.literal(true),
    noRawEvidenceOrCoordinates: z.literal(true),
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

const baselineInputSchema = z
  .object({
    baselineId: identifierSchema,
    observedAt: timestampSchema,
    evidenceRoots: z.array(hashSchema).min(1).max(512),
    satelliteRoots: z.array(hashSchema).max(256).default([]),
    metricRoots: z.array(hashSchema).max(256).default([]),
    limitations: z.array(z.string().trim().min(8).max(512)).min(1).max(32),
  })
  .strict();

const baselineSchema = baselineInputSchema
  .extend({ baselineRoot: hashSchema })
  .strict();

const interventionInputSchema = z
  .object({
    interventionId: identifierSchema,
    interventionType: z.enum(canopyProofProjectLifecycleInterventionTypes),
    startsAt: timestampSchema,
    endsAt: timestampSchema.optional(),
    targetAreaSquareMeters: safeNonnegativeIntegerSchema,
    targetTreeCount: safeNonnegativeIntegerSchema,
    methodologyRoot: hashSchema,
    evidenceRoots: z.array(hashSchema).max(512).default([]),
  })
  .strict();

const interventionSchema = interventionInputSchema
  .extend({ interventionRoot: hashSchema })
  .strict();

const monitoringPlanInputSchema = z
  .object({
    monitoringPlanId: identifierSchema,
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    cadenceDays: z.number().int().positive().max(3_650),
    indicatorCodes: z.array(identifierSchema).min(1).max(256),
    evidenceRequirementCodes: z.array(identifierSchema).min(1).max(256),
    responsibleOrganizationId: identifierSchema,
    escalationPolicyRoot: hashSchema,
  })
  .strict();

const monitoringPlanSchema = monitoringPlanInputSchema
  .extend({ monitoringPlanRoot: hashSchema })
  .strict();

const registrationInputSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema,
    projectAuthorityRoot: hashSchema,
    projectStatus: z.enum(["submitted", "under_review", "active", "monitored"]),
    baseline: baselineInputSchema,
    intervention: interventionInputSchema,
    monitoringPlan: monitoringPlanInputSchema,
    policyId: identifierSchema,
    policyVersion: identifierSchema,
    policyRoot: hashSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    registeredAt: timestampSchema,
  })
  .strict();

const registrationFactSchema = z
  .object({
    factType: z.literal("project_lifecycle_registration"),
    schemaVersion: z.literal(canopyProofProjectLifecycleSchemaVersion),
    id: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    generation: z.number().int().positive(),
    projectAuthorityRoot: hashSchema,
    projectStatus: z.enum(["submitted", "under_review", "active", "monitored"]),
    baseline: baselineSchema,
    intervention: interventionSchema,
    monitoringPlan: monitoringPlanSchema,
    policyId: identifierSchema,
    policyVersion: identifierSchema,
    policyRoot: hashSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    proposer: actorSchema,
    registeredAt: timestampSchema,
    commandHash: hashSchema,
    projectSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    registrationRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const reviewInputSchema = z
  .object({
    registrationId: identifierSchema,
    registrationRoot: hashSchema,
    decision: z.enum(["approve", "reject"]),
    reasonCode: reasonCodeSchema,
    rationale: rationaleSchema,
    reviewedAt: timestampSchema,
  })
  .strict();

const reviewFactSchema = z
  .object({
    factType: z.literal("project_lifecycle_review"),
    schemaVersion: z.literal(canopyProofProjectLifecycleSchemaVersion),
    id: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    generation: z.number().int().positive(),
    registrationId: identifierSchema,
    registrationRoot: hashSchema,
    decision: z.enum(["approve", "reject"]),
    reasonCode: reasonCodeSchema,
    rationale: rationaleSchema,
    reviewer: actorSchema,
    reviewedAt: timestampSchema,
    commandHash: hashSchema,
    projectSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    reviewRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const fundingSourceSchema = z
  .object({
    kind: z.literal("funding"),
    projectionRoots: z.array(hashSchema).min(1).max(256),
    currentRoots: z.array(hashSchema).min(1).max(256),
    allocatedCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    resolvedAt: timestampSchema,
    sourceAuthorityRoot: hashSchema,
  })
  .strict();

const proofSourceSchema = z
  .object({
    kind: z.literal("proof"),
    lifecycleProjectionRoots: z.array(hashSchema).min(1).max(256),
    currentRoots: z.array(hashSchema).min(1).max(256),
    resolvedAt: timestampSchema,
    sourceAuthorityRoot: hashSchema,
  })
  .strict();

const monitoringSourceSchema = z
  .object({
    kind: z.literal("monitoring"),
    monitoringEventRoots: z.array(hashSchema).min(1).max(1_024),
    latestObservedAt: timestampSchema,
    monitoringPlanRoot: hashSchema,
    resolvedAt: timestampSchema,
    sourceAuthorityRoot: hashSchema,
  })
  .strict();

const closureSourceSchema = z
  .object({
    kind: z.literal("closure"),
    closureEvidenceRoots: z.array(hashSchema).min(1).max(1_024),
    finalMonitoringRoot: hashSchema,
    closureReviewRoot: hashSchema,
    resolvedAt: timestampSchema,
    sourceAuthorityRoot: hashSchema,
  })
  .strict();

const transitionSourceSchema = z.discriminatedUnion("kind", [
  fundingSourceSchema,
  proofSourceSchema,
  monitoringSourceSchema,
  closureSourceSchema,
]);

const transitionInputSchema = z
  .object({
    fromStage: z.enum(canopyProofProjectLifecycleCanonicalStages),
    toStage: z.enum(canopyProofProjectLifecycleCanonicalStages),
    source: transitionSourceSchema,
    reasonCode: reasonCodeSchema,
    rationale: rationaleSchema,
    transitionedAt: timestampSchema,
  })
  .strict();

const transitionFactSchema = z
  .object({
    factType: z.literal("project_lifecycle_transition"),
    schemaVersion: z.literal(canopyProofProjectLifecycleSchemaVersion),
    id: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    generation: z.number().int().positive(),
    registrationRoot: hashSchema,
    reviewRoot: hashSchema,
    fromStage: z.enum(canopyProofProjectLifecycleCanonicalStages),
    toStage: z.enum(canopyProofProjectLifecycleCanonicalStages),
    source: transitionSourceSchema,
    reasonCode: reasonCodeSchema,
    rationale: rationaleSchema,
    governor: actorSchema,
    transitionedAt: timestampSchema,
    commandHash: hashSchema,
    projectSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    transitionRoot: hashSchema,
    safety: safetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

const controlInputSchema = z
  .object({
    action: z.enum(canopyProofProjectLifecycleControlActions),
    reasonCode: reasonCodeSchema,
    reasonRoot: hashSchema,
    rationale: rationaleSchema,
    restoresControlRoot: hashSchema.optional(),
    restorationAuthorityRoot: hashSchema.optional(),
    controlledAt: timestampSchema,
  })
  .strict();

const controlFactSchema = z
  .object({
    factType: z.literal("project_lifecycle_control"),
    schemaVersion: z.literal(canopyProofProjectLifecycleSchemaVersion),
    id: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    generation: z.number().int().positive(),
    registrationRoot: hashSchema,
    action: z.enum(canopyProofProjectLifecycleControlActions),
    underlyingStage: z.enum(canopyProofProjectLifecycleCanonicalStages),
    reasonCode: reasonCodeSchema,
    reasonRoot: hashSchema,
    rationale: rationaleSchema,
    restoresControlRoot: hashSchema.optional(),
    restorationAuthorityRoot: hashSchema.optional(),
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

const projectionSchema = z
  .object({
    schemaVersion: z.literal(canopyProofProjectLifecycleSchemaVersion),
    organizationId: identifierSchema,
    projectId: identifierSchema,
    generation: z.number().int().positive(),
    stage: z.enum(canopyProofProjectLifecycleStages),
    underlyingStage: z.enum(canopyProofProjectLifecycleCanonicalStages).nullable(),
    registrationId: identifierSchema,
    registrationRoot: hashSchema,
    reviewRoot: hashSchema.nullable(),
    latestTransitionRoot: hashSchema.nullable(),
    latestControlRoot: hashSchema.nullable(),
    projectAuthorityRoot: hashSchema,
    baselineRoot: hashSchema,
    interventionRoot: hashSchema,
    monitoringPlanRoot: hashSchema,
    policyRoot: hashSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    evaluatedAt: timestampSchema,
    issueCodes: z.array(reasonCodeSchema).max(32),
    projectionRoot: hashSchema,
    safety: safetySchema,
  })
  .strict();

export type CanopyProofProjectLifecycleBaselineInput = z.input<typeof baselineInputSchema>;
export type CanopyProofProjectLifecycleBaseline = z.output<typeof baselineSchema>;
export type CanopyProofProjectLifecycleInterventionInput = z.input<typeof interventionInputSchema>;
export type CanopyProofProjectLifecycleIntervention = z.output<typeof interventionSchema>;
export type CanopyProofProjectLifecycleMonitoringPlanInput = z.input<typeof monitoringPlanInputSchema>;
export type CanopyProofProjectLifecycleMonitoringPlan = z.output<typeof monitoringPlanSchema>;
export type CanopyProofProjectLifecycleActorSnapshot =
  CanopyProofOrganizationAccreditationActorSnapshot;
export type CanopyProofProjectLifecycleRegistrationInput = z.input<typeof registrationInputSchema>;
export type CanopyProofProjectLifecycleRegistrationFact = z.output<typeof registrationFactSchema>;
export type CanopyProofProjectLifecycleReviewInput = z.input<typeof reviewInputSchema>;
export type CanopyProofProjectLifecycleReviewFact = z.output<typeof reviewFactSchema>;
export type CanopyProofProjectLifecycleTransitionSource = z.output<typeof transitionSourceSchema>;
export type CanopyProofProjectLifecycleTransitionInput = z.input<typeof transitionInputSchema>;
export type CanopyProofProjectLifecycleTransitionFact = z.output<typeof transitionFactSchema>;
export type CanopyProofProjectLifecycleControlInput = z.input<typeof controlInputSchema>;
export type CanopyProofProjectLifecycleControlFact = z.output<typeof controlFactSchema>;
export type CanopyProofProjectLifecycleProjection = z.output<typeof projectionSchema>;

export type CanopyProofProjectLifecycleRecord =
  | Readonly<{ kind: "registration"; registration: CanopyProofProjectLifecycleRegistrationFact }>
  | Readonly<{ kind: "review"; review: CanopyProofProjectLifecycleReviewFact }>
  | Readonly<{ kind: "transition"; transition: CanopyProofProjectLifecycleTransitionFact }>
  | Readonly<{ kind: "control"; control: CanopyProofProjectLifecycleControlFact }>;

export function canopyProofProjectLifecycleSafety() {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    appendOnly: true,
    exactRetryRequired: true,
    currentSourceReResolutionRequired: true,
    independentHumanReviewRequired: true,
    humanGovernanceRequiredForTransitions: true,
    aiAdvisoryOnly: true,
    adverseStateNeverFallsBack: true,
    integerMeasurementsOnly: true,
    noRawEvidenceOrCoordinates: true,
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

export function buildCanopyProofProjectLifecycleBaseline(
  input: CanopyProofProjectLifecycleBaselineInput,
): CanopyProofProjectLifecycleBaseline {
  const parsed = baselineInputSchema.parse(input);
  const normalized = {
    ...parsed,
    evidenceRoots: canonicalHashes(parsed.evidenceRoots, "baseline evidenceRoots"),
    satelliteRoots: canonicalHashes(parsed.satelliteRoots, "baseline satelliteRoots"),
    metricRoots: canonicalHashes(parsed.metricRoots, "baseline metricRoots"),
    limitations: canonicalStrings(parsed.limitations, "baseline limitations"),
  };
  assertCanonicalTimestamp(normalized.observedAt, "baseline observedAt");
  return baselineSchema.parse({
    ...normalized,
    baselineRoot: hashJson({
      domain: "canopyproof/project-lifecycle/baseline/v1",
      ...normalized,
    }),
  });
}

export function buildCanopyProofProjectLifecycleIntervention(
  input: CanopyProofProjectLifecycleInterventionInput,
): CanopyProofProjectLifecycleIntervention {
  const parsed = interventionInputSchema.parse(input);
  assertCanonicalTimestamp(parsed.startsAt, "intervention startsAt");
  if (parsed.endsAt) {
    assertCanonicalTimestamp(parsed.endsAt, "intervention endsAt");
    assertBefore(parsed.startsAt, parsed.endsAt, "intervention interval");
  }
  if (parsed.targetAreaSquareMeters === 0 && parsed.targetTreeCount === 0) {
    throw new Error("CanopyProof project lifecycle intervention requires a bounded non-zero target.");
  }
  const normalized = {
    ...parsed,
    evidenceRoots: canonicalHashes(parsed.evidenceRoots, "intervention evidenceRoots"),
  };
  return interventionSchema.parse({
    ...normalized,
    interventionRoot: hashJson({
      domain: "canopyproof/project-lifecycle/intervention/v1",
      ...normalized,
    }),
  });
}

export function buildCanopyProofProjectLifecycleMonitoringPlan(
  input: CanopyProofProjectLifecycleMonitoringPlanInput,
): CanopyProofProjectLifecycleMonitoringPlan {
  const parsed = monitoringPlanInputSchema.parse(input);
  assertCanonicalTimestamp(parsed.startsAt, "monitoring plan startsAt");
  assertCanonicalTimestamp(parsed.endsAt, "monitoring plan endsAt");
  assertBefore(parsed.startsAt, parsed.endsAt, "monitoring plan interval");
  const normalized = {
    ...parsed,
    indicatorCodes: canonicalStrings(parsed.indicatorCodes, "monitoring indicatorCodes"),
    evidenceRequirementCodes: canonicalStrings(
      parsed.evidenceRequirementCodes,
      "monitoring evidenceRequirementCodes",
    ),
  };
  return monitoringPlanSchema.parse({
    ...normalized,
    monitoringPlanRoot: hashJson({
      domain: "canopyproof/project-lifecycle/monitoring-plan/v1",
      ...normalized,
    }),
  });
}

export function buildCanopyProofProjectLifecycleRegistration(
  input: CanopyProofProjectLifecycleRegistrationInput,
  proposerInput: CanopyProofProjectLifecycleActorSnapshot,
  history: readonly CanopyProofProjectLifecycleRecord[] = [],
): CanopyProofProjectLifecycleRegistrationFact {
  const parsed = registrationInputSchema.parse(input);
  const proposer = normalizeActor(proposerInput);
  requireSubjectProposer(proposer, parsed.organizationId);
  assertCanonicalTimestamp(parsed.registeredAt, "registration registeredAt");
  assertCanonicalTimestamp(parsed.validFrom, "registration validFrom");
  assertCanonicalTimestamp(parsed.validUntil, "registration validUntil");
  assertBefore(parsed.validFrom, parsed.validUntil, "registration validity");
  if (Date.parse(parsed.registeredAt) < Date.parse(parsed.validFrom)) {
    throw new Error("CanopyProof project lifecycle registration predates its validity interval.");
  }
  if (Date.parse(parsed.registeredAt) >= Date.parse(parsed.validUntil)) {
    throw new Error("CanopyProof project lifecycle registration is already expired.");
  }
  if (Date.parse(parsed.validUntil) - Date.parse(parsed.validFrom) > 10 * 366 * 86_400_000) {
    throw new Error("CanopyProof project lifecycle validity cannot exceed ten leap years.");
  }
  const baseline = buildCanopyProofProjectLifecycleBaseline(parsed.baseline);
  const intervention = buildCanopyProofProjectLifecycleIntervention(parsed.intervention);
  const monitoringPlan = buildCanopyProofProjectLifecycleMonitoringPlan(parsed.monitoringPlan);
  if (monitoringPlan.responsibleOrganizationId !== parsed.organizationId) {
    throw new Error("CanopyProof project lifecycle monitoring responsibility must match the project organization.");
  }
  if (Date.parse(baseline.observedAt) > Date.parse(intervention.startsAt)) {
    throw new Error("CanopyProof project lifecycle baseline must not postdate intervention start.");
  }
  if (Date.parse(monitoringPlan.startsAt) > Date.parse(intervention.startsAt)) {
    throw new Error("CanopyProof project lifecycle monitoring must start no later than the intervention.");
  }
  if (Date.parse(monitoringPlan.endsAt) < Date.parse(parsed.validUntil)) {
    throw new Error("CanopyProof project lifecycle monitoring plan must cover the full validity interval.");
  }

  const prior = replayCanopyProofProjectLifecycle(history, parsed.registeredAt, true);
  if (prior && !["EXPIRED", "REJECTED"].includes(prior.stage)) {
    throw new Error("CanopyProof project lifecycle already has a non-expired canonical generation.");
  }
  const generation = (prior?.generation ?? 0) + 1;
  const projectSequence = history.length + 1;
  const previousEventRoot = lastEventRoot(history);
  const safety = canopyProofProjectLifecycleSafety();
  const commandHash = hashJson({
    domain: "canopyproof/project-lifecycle/registration-command/v1",
    parsed,
    proposer,
    generation,
  });
  const id = `cp_project_lifecycle_registration_${commandHash.slice(0, 24)}`;
  const seed = {
    factType: "project_lifecycle_registration" as const,
    schemaVersion: canopyProofProjectLifecycleSchemaVersion,
    id,
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    generation,
    projectAuthorityRoot: parsed.projectAuthorityRoot,
    projectStatus: parsed.projectStatus,
    baseline,
    intervention,
    monitoringPlan,
    policyId: parsed.policyId,
    policyVersion: parsed.policyVersion,
    policyRoot: parsed.policyRoot,
    validFrom: parsed.validFrom,
    validUntil: parsed.validUntil,
    proposer,
    registeredAt: parsed.registeredAt,
    commandHash,
    projectSequence,
    previousEventRoot,
    safety,
  };
  const registrationRoot = hashJson({
    domain: "canopyproof/project-lifecycle/registration/v1",
    ...seed,
  });
  const auditEvent = appendLifecycleAuditEvent(history, {
    action: "ASSERT",
    actor: proposer.id,
    entityType: "project_lifecycle_registration",
    entityId: id,
    createdAt: parsed.registeredAt,
    rationale: "A bounded project lifecycle registration was proposed for independent review.",
    payload: { registrationRoot, projectAuthorityRoot: parsed.projectAuthorityRoot, generation },
  });
  return registrationFactSchema.parse({ ...seed, registrationRoot, auditEvent });
}

export function buildCanopyProofProjectLifecycleReview(
  input: CanopyProofProjectLifecycleReviewInput,
  reviewerInput: CanopyProofProjectLifecycleActorSnapshot,
  history: readonly CanopyProofProjectLifecycleRecord[],
): CanopyProofProjectLifecycleReviewFact {
  const parsed = reviewInputSchema.parse(input);
  const current = requireProjection(history, parsed.reviewedAt);
  const registration = latestRegistration(history, current.generation);
  if (current.stage !== "PENDING_REVIEW") {
    throw new Error("CanopyProof project lifecycle registration is not pending review.");
  }
  if (registration.id !== parsed.registrationId || registration.registrationRoot !== parsed.registrationRoot) {
    throw new Error("CanopyProof project lifecycle review registration binding is invalid.");
  }
  const reviewer = normalizeActor(reviewerInput);
  requireGovernanceActor(reviewer, registration.organizationId, canopyProofProjectLifecycleScopes.review, [
    "owner",
    "admin",
    "verifier",
    "researcher",
  ], parsed.reviewedAt);
  if (reviewer.id === registration.proposer.id) {
    throw new Error("CanopyProof project lifecycle proposer cannot review the same registration.");
  }
  assertFactTime(parsed.reviewedAt, registration.registeredAt, registration.validUntil, "review");
  const projectSequence = history.length + 1;
  const previousEventRoot = lastEventRoot(history);
  const safety = canopyProofProjectLifecycleSafety();
  const commandHash = hashJson({
    domain: "canopyproof/project-lifecycle/review-command/v1",
    parsed,
    reviewer,
    generation: registration.generation,
  });
  const id = `cp_project_lifecycle_review_${commandHash.slice(0, 24)}`;
  const seed = {
    factType: "project_lifecycle_review" as const,
    schemaVersion: canopyProofProjectLifecycleSchemaVersion,
    id,
    organizationId: registration.organizationId,
    projectId: registration.projectId,
    generation: registration.generation,
    registrationId: registration.id,
    registrationRoot: registration.registrationRoot,
    decision: parsed.decision,
    reasonCode: parsed.reasonCode,
    rationale: parsed.rationale,
    reviewer,
    reviewedAt: parsed.reviewedAt,
    commandHash,
    projectSequence,
    previousEventRoot,
    safety,
  };
  const reviewRoot = hashJson({
    domain: "canopyproof/project-lifecycle/review/v1",
    ...seed,
  });
  const auditEvent = appendLifecycleAuditEvent(history, {
    action: parsed.decision === "approve" ? "FULFILL" : "CHALLENGE",
    actor: reviewer.id,
    entityType: "project_lifecycle_review",
    entityId: id,
    createdAt: parsed.reviewedAt,
    rationale: "An independent human reviewed the exact project lifecycle registration.",
    payload: { registrationRoot: registration.registrationRoot, reviewRoot, decision: parsed.decision },
  });
  return reviewFactSchema.parse({ ...seed, reviewRoot, auditEvent });
}

export function buildCanopyProofProjectLifecycleTransition(
  input: CanopyProofProjectLifecycleTransitionInput,
  governorInput: CanopyProofProjectLifecycleActorSnapshot,
  history: readonly CanopyProofProjectLifecycleRecord[],
): CanopyProofProjectLifecycleTransitionFact {
  const parsed = transitionInputSchema.parse(input);
  const current = requireProjection(history, parsed.transitionedAt);
  const registration = latestRegistration(history, current.generation);
  const review = latestApprovedReview(history, current.generation);
  if (current.stage !== parsed.fromStage || current.underlyingStage !== parsed.fromStage) {
    throw new Error("CanopyProof project lifecycle transition source stage is not current.");
  }
  assertLegalTransition(parsed.fromStage, parsed.toStage);
  assertTransitionSource(parsed.toStage, parsed.source, registration, history);
  assertFactTime(parsed.transitionedAt, review.reviewedAt, registration.validUntil, "transition");
  if (parsed.source.resolvedAt !== parsed.transitionedAt) {
    throw new Error("CanopyProof project lifecycle transition source must be re-resolved at commit time.");
  }
  const governor = normalizeActor(governorInput);
  requireGovernanceActor(governor, registration.organizationId, canopyProofProjectLifecycleScopes.govern, [
    "owner",
    "admin",
    "verifier",
  ], parsed.transitionedAt);
  requireIndependentGovernor(governor, registration, review);
  const projectSequence = history.length + 1;
  const previousEventRoot = lastEventRoot(history);
  const safety = canopyProofProjectLifecycleSafety();
  const commandHash = hashJson({
    domain: "canopyproof/project-lifecycle/transition-command/v1",
    parsed,
    governor,
    generation: registration.generation,
  });
  const id = `cp_project_lifecycle_transition_${commandHash.slice(0, 24)}`;
  const seed = {
    factType: "project_lifecycle_transition" as const,
    schemaVersion: canopyProofProjectLifecycleSchemaVersion,
    id,
    organizationId: registration.organizationId,
    projectId: registration.projectId,
    generation: registration.generation,
    registrationRoot: registration.registrationRoot,
    reviewRoot: review.reviewRoot,
    fromStage: parsed.fromStage,
    toStage: parsed.toStage,
    source: normalizeTransitionSource(parsed.source),
    reasonCode: parsed.reasonCode,
    rationale: parsed.rationale,
    governor,
    transitionedAt: parsed.transitionedAt,
    commandHash,
    projectSequence,
    previousEventRoot,
    safety,
  };
  const transitionRoot = hashJson({
    domain: "canopyproof/project-lifecycle/transition/v1",
    ...seed,
  });
  const auditEvent = appendLifecycleAuditEvent(history, {
    action: "FULFILL",
    actor: governor.id,
    entityType: "project_lifecycle_transition",
    entityId: id,
    createdAt: parsed.transitionedAt,
    rationale: "An independent human governed a source-bound canonical project lifecycle transition.",
    payload: { fromStage: parsed.fromStage, toStage: parsed.toStage, transitionRoot },
  });
  return transitionFactSchema.parse({ ...seed, transitionRoot, auditEvent });
}

export function buildCanopyProofProjectLifecycleControl(
  input: CanopyProofProjectLifecycleControlInput,
  governorInput: CanopyProofProjectLifecycleActorSnapshot,
  history: readonly CanopyProofProjectLifecycleRecord[],
): CanopyProofProjectLifecycleControlFact {
  const parsed = controlInputSchema.parse(input);
  const current = requireProjection(history, parsed.controlledAt);
  const registration = latestRegistration(history, current.generation);
  const review = latestApprovedReview(history, current.generation);
  assertControlAllowed(parsed, current, history);
  assertCanonicalTimestamp(parsed.controlledAt, "control time");
  if (Date.parse(parsed.controlledAt) < Date.parse(review.reviewedAt)) {
    throw new Error("CanopyProof project lifecycle control predates the approved review.");
  }
  const governor = normalizeActor(governorInput);
  requireGovernanceActor(governor, registration.organizationId, canopyProofProjectLifecycleScopes.govern, [
    "owner",
    "admin",
    "verifier",
  ], parsed.controlledAt);
  requireIndependentGovernor(governor, registration, review);
  requireIndependentRestorer(parsed.action, governor, history);
  const projectSequence = history.length + 1;
  const previousEventRoot = lastEventRoot(history);
  const safety = canopyProofProjectLifecycleSafety();
  const commandHash = hashJson({
    domain: "canopyproof/project-lifecycle/control-command/v1",
    parsed,
    governor,
    generation: registration.generation,
    underlyingStage: current.underlyingStage,
  });
  const id = `cp_project_lifecycle_control_${commandHash.slice(0, 24)}`;
  if (!current.underlyingStage) {
    throw new Error("CanopyProof project lifecycle control requires a canonical underlying stage.");
  }
  const seed = {
    factType: "project_lifecycle_control" as const,
    schemaVersion: canopyProofProjectLifecycleSchemaVersion,
    id,
    organizationId: registration.organizationId,
    projectId: registration.projectId,
    generation: registration.generation,
    registrationRoot: registration.registrationRoot,
    action: parsed.action,
    underlyingStage: current.underlyingStage,
    reasonCode: parsed.reasonCode,
    reasonRoot: parsed.reasonRoot,
    rationale: parsed.rationale,
    ...(parsed.restoresControlRoot ? { restoresControlRoot: parsed.restoresControlRoot } : {}),
    ...(parsed.restorationAuthorityRoot
      ? { restorationAuthorityRoot: parsed.restorationAuthorityRoot }
      : {}),
    governor,
    controlledAt: parsed.controlledAt,
    commandHash,
    projectSequence,
    previousEventRoot,
    safety,
  };
  const controlRoot = hashJson({
    domain: "canopyproof/project-lifecycle/control/v1",
    ...seed,
  });
  const auditEvent = appendLifecycleAuditEvent(history, {
    action: parsed.action === "restore" ? "FULFILL" : "CHALLENGE",
    actor: governor.id,
    entityType: "project_lifecycle_control",
    entityId: id,
    createdAt: parsed.controlledAt,
    rationale: "An independent human applied an append-only project lifecycle control.",
    payload: { action: parsed.action, reasonRoot: parsed.reasonRoot, controlRoot },
  });
  return controlFactSchema.parse({ ...seed, controlRoot, auditEvent });
}

export function replayCanopyProofProjectLifecycle(
  records: readonly CanopyProofProjectLifecycleRecord[],
  evaluatedAt: string,
  allowEmpty = false,
): CanopyProofProjectLifecycleProjection | undefined {
  assertCanonicalTimestamp(evaluatedAt, "project lifecycle evaluatedAt");
  if (records.length === 0) {
    if (allowEmpty) return undefined;
    throw new Error("CanopyProof project lifecycle history is empty.");
  }
  const ordered = [...records].sort((left, right) => recordSequence(left) - recordSequence(right));
  const included = ordered.filter((record) => Date.parse(recordTimestamp(record)) <= Date.parse(evaluatedAt));
  if (included.length === 0) {
    if (allowEmpty) return undefined;
    throw new Error("CanopyProof project lifecycle did not exist at the requested evaluation time.");
  }

  let expectedSequence = 1;
  let previousEventRoot = canopyProofAuditGenesisRoot();
  let organizationId: string | undefined;
  let projectId: string | undefined;
  let generation = 0;
  let registration: CanopyProofProjectLifecycleRegistrationFact | undefined;
  let review: CanopyProofProjectLifecycleReviewFact | undefined;
  let stage: CanopyProofProjectLifecycleStage = "PENDING_REVIEW";
  let underlyingStage: CanopyProofProjectLifecycleCanonicalStage | null = null;
  let latestTransitionRoot: string | null = null;
  let latestControlRoot: string | null = null;
  let adverseControl: CanopyProofProjectLifecycleControlFact | undefined;
  const events: CanopyProofAuditEvent[] = [];

  for (const record of included) {
    const sequence = recordSequence(record);
    const event = recordAuditEvent(record);
    if (sequence !== expectedSequence || event.previousRoot !== previousEventRoot) {
      throw new Error("CanopyProof project lifecycle event sequence or predecessor is invalid.");
    }
    if (recordPreviousEventRoot(record) !== previousEventRoot) {
      throw new Error("CanopyProof project lifecycle fact predecessor is invalid.");
    }
    verifyRecord(record);
    if (organizationId && recordOrganizationId(record) !== organizationId) {
      throw new Error("CanopyProof project lifecycle history crosses organizations.");
    }
    if (projectId && recordProjectId(record) !== projectId) {
      throw new Error("CanopyProof project lifecycle history crosses projects.");
    }
    organizationId = recordOrganizationId(record);
    projectId = recordProjectId(record);

    if (
      registration &&
      isExpirableActiveStage(stage) &&
      Date.parse(recordTimestamp(record)) >= Date.parse(registration.validUntil)
    ) {
      stage = "EXPIRED";
    }

    if (record.kind === "registration") {
      if (registration && !["EXPIRED", "REJECTED"].includes(stage)) {
        throw new Error("CanopyProof project lifecycle generation cannot replace a current generation.");
      }
      if (record.registration.generation !== generation + 1) {
        throw new Error("CanopyProof project lifecycle registration generation is invalid.");
      }
      generation = record.registration.generation;
      registration = record.registration;
      review = undefined;
      stage = "PENDING_REVIEW";
      underlyingStage = null;
      latestTransitionRoot = null;
      latestControlRoot = null;
      adverseControl = undefined;
    } else {
      if (!registration || recordGeneration(record) !== generation) {
        throw new Error("CanopyProof project lifecycle fact has no current registration generation.");
      }
      if (record.kind === "review") {
        if (stage !== "PENDING_REVIEW") {
          throw new Error("CanopyProof project lifecycle review is not legal in the current stage.");
        }
        if (review) throw new Error("CanopyProof project lifecycle generation has more than one review.");
        if (
          record.review.registrationId !== registration.id ||
          record.review.registrationRoot !== registration.registrationRoot
        ) {
          throw new Error("CanopyProof project lifecycle review registration lineage is invalid.");
        }
        if (record.review.reviewer.id === registration.proposer.id) {
          throw new Error("CanopyProof project lifecycle proposer cannot review the registration.");
        }
        review = record.review;
        stage = review.decision === "approve" ? "PROPOSED" : "REJECTED";
        underlyingStage = review.decision === "approve" ? "PROPOSED" : null;
      } else if (record.kind === "transition") {
        if (!review || review.decision !== "approve") {
          throw new Error("CanopyProof project lifecycle transition requires an approved review.");
        }
        if (stage !== record.transition.fromStage || underlyingStage !== record.transition.fromStage) {
          throw new Error("CanopyProof project lifecycle transition does not continue the current stage.");
        }
        requireIndependentGovernor(record.transition.governor, registration, review);
        assertLegalTransition(record.transition.fromStage, record.transition.toStage);
        assertTransitionSource(record.transition.toStage, record.transition.source, registration, included);
        stage = record.transition.toStage;
        underlyingStage = record.transition.toStage;
        latestTransitionRoot = record.transition.transitionRoot;
        adverseControl = undefined;
      } else {
        if (!review || review.decision !== "approve" || !underlyingStage) {
          throw new Error("CanopyProof project lifecycle control requires an approved canonical stage.");
        }
        if (stage === "EXPIRED") {
          throw new Error("CanopyProof project lifecycle control cannot mutate an expired generation.");
        }
        requireIndependentGovernor(record.control.governor, registration, review);
        if (record.control.underlyingStage !== underlyingStage) {
          throw new Error("CanopyProof project lifecycle control underlying stage is invalid.");
        }
        if (record.control.action === "challenge") {
          if (!canApplyAdverseControl(stage)) throw new Error("CanopyProof project lifecycle challenge is not legal.");
          stage = "CHALLENGED";
          adverseControl = record.control;
        } else if (record.control.action === "suspend") {
          if (!canApplyAdverseControl(stage)) throw new Error("CanopyProof project lifecycle suspension is not legal.");
          stage = "SUSPENDED";
          adverseControl = record.control;
        } else if (record.control.action === "restore") {
          if (!adverseControl || !["CHALLENGED", "SUSPENDED"].includes(stage)) {
            throw new Error("CanopyProof project lifecycle restoration has no current adverse control.");
          }
          if (record.control.governor.id === adverseControl.governor.id) {
            throw new Error("CanopyProof project lifecycle restoration requires an independent governor.");
          }
          if (
            record.control.restoresControlRoot !== adverseControl.controlRoot ||
            !record.control.restorationAuthorityRoot
          ) {
            throw new Error("CanopyProof project lifecycle restoration authority is invalid.");
          }
          stage = underlyingStage;
          adverseControl = undefined;
        } else {
          if (["CLOSED", "REVOKED"].includes(stage)) {
            throw new Error("CanopyProof project lifecycle terminal stage cannot be revoked again.");
          }
          stage = "REVOKED";
          adverseControl = record.control;
        }
        latestControlRoot = record.control.controlRoot;
      }
    }

    events.push(event);
    assertValidAuditChain(events);
    expectedSequence += 1;
    previousEventRoot = event.eventRoot;
  }

  if (!registration || !organizationId || !projectId) {
    throw new Error("CanopyProof project lifecycle registration is missing.");
  }
  if (
    isExpirableActiveStage(stage) &&
    Date.parse(evaluatedAt) >= Date.parse(registration.validUntil)
  ) {
    stage = "EXPIRED";
  }
  const issueCodes = lifecycleIssueCodes(stage);
  const seed = {
    schemaVersion: canopyProofProjectLifecycleSchemaVersion,
    organizationId,
    projectId,
    generation,
    stage,
    underlyingStage,
    registrationId: registration.id,
    registrationRoot: registration.registrationRoot,
    reviewRoot: review?.reviewRoot ?? null,
    latestTransitionRoot,
    latestControlRoot,
    projectAuthorityRoot: registration.projectAuthorityRoot,
    baselineRoot: registration.baseline.baselineRoot,
    interventionRoot: registration.intervention.interventionRoot,
    monitoringPlanRoot: registration.monitoringPlan.monitoringPlanRoot,
    policyRoot: registration.policyRoot,
    validFrom: registration.validFrom,
    validUntil: registration.validUntil,
    evaluatedAt,
    issueCodes,
    safety: canopyProofProjectLifecycleSafety(),
  };
  return projectionSchema.parse({
    ...seed,
    projectionRoot: hashJson({
      domain: "canopyproof/project-lifecycle/projection/v1",
      ...seed,
    }),
  });
}

export function parseCanopyProofProjectLifecycleRegistration(input: unknown) {
  return registrationFactSchema.parse(input);
}

export function parseCanopyProofProjectLifecycleReview(input: unknown) {
  return reviewFactSchema.parse(input);
}

export function parseCanopyProofProjectLifecycleTransition(input: unknown) {
  return transitionFactSchema.parse(input);
}

export function parseCanopyProofProjectLifecycleControl(input: unknown) {
  return controlFactSchema.parse(input);
}

function verifyRecord(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") {
    const fact = registrationFactSchema.parse(record.registration);
    const proposer = verifyCanonicalActor(fact.proposer);
    requireSubjectProposer(proposer, fact.organizationId);
    assertRegistrationCommandIdentity(fact, proposer);
    const seed = registrationFactSchema
      .omit({ registrationRoot: true, auditEvent: true })
      .strip()
      .parse(fact);
    const { registrationRoot } = fact;
    if (hashJson({ domain: "canopyproof/project-lifecycle/registration/v1", ...seed }) !== registrationRoot) {
      throw new Error("CanopyProof project lifecycle registration root is invalid.");
    }
    assertExpectedAuditEvent(record, {
      action: "ASSERT",
      actor: fact.proposer.id,
      rationale: "A bounded project lifecycle registration was proposed for independent review.",
      payload: { registrationRoot, projectAuthorityRoot: fact.projectAuthorityRoot, generation: fact.generation },
    });
    return;
  }
  if (record.kind === "review") {
    const fact = reviewFactSchema.parse(record.review);
    const reviewer = verifyCanonicalActor(fact.reviewer);
    requireGovernanceActor(reviewer, fact.organizationId, canopyProofProjectLifecycleScopes.review, [
      "owner",
      "admin",
      "verifier",
      "researcher",
    ], fact.reviewedAt);
    assertReviewCommandIdentity(fact, reviewer);
    const seed = reviewFactSchema
      .omit({ reviewRoot: true, auditEvent: true })
      .strip()
      .parse(fact);
    const { reviewRoot } = fact;
    if (hashJson({ domain: "canopyproof/project-lifecycle/review/v1", ...seed }) !== reviewRoot) {
      throw new Error("CanopyProof project lifecycle review root is invalid.");
    }
    assertExpectedAuditEvent(record, {
      action: fact.decision === "approve" ? "FULFILL" : "CHALLENGE",
      actor: fact.reviewer.id,
      rationale: "An independent human reviewed the exact project lifecycle registration.",
      payload: { registrationRoot: fact.registrationRoot, reviewRoot, decision: fact.decision },
    });
    return;
  }
  if (record.kind === "transition") {
    const fact = transitionFactSchema.parse(record.transition);
    const governor = verifyCanonicalActor(fact.governor);
    requireGovernanceActor(governor, fact.organizationId, canopyProofProjectLifecycleScopes.govern, [
      "owner",
      "admin",
      "verifier",
    ], fact.transitionedAt);
    assertTransitionCommandIdentity(fact, governor);
    const seed = transitionFactSchema
      .omit({ transitionRoot: true, auditEvent: true })
      .strip()
      .parse(fact);
    const { transitionRoot } = fact;
    if (hashJson({ domain: "canopyproof/project-lifecycle/transition/v1", ...seed }) !== transitionRoot) {
      throw new Error("CanopyProof project lifecycle transition root is invalid.");
    }
    assertExpectedAuditEvent(record, {
      action: "FULFILL",
      actor: fact.governor.id,
      rationale: "An independent human governed a source-bound canonical project lifecycle transition.",
      payload: { fromStage: fact.fromStage, toStage: fact.toStage, transitionRoot },
    });
    return;
  }
  const fact = controlFactSchema.parse(record.control);
  const governor = verifyCanonicalActor(fact.governor);
  requireGovernanceActor(governor, fact.organizationId, canopyProofProjectLifecycleScopes.govern, [
    "owner",
    "admin",
    "verifier",
  ], fact.controlledAt);
  assertControlFactSemantics(fact);
  assertControlCommandIdentity(fact, governor);
  const seed = controlFactSchema
    .omit({ controlRoot: true, auditEvent: true })
    .strip()
    .parse(fact);
  const { controlRoot } = fact;
  if (hashJson({ domain: "canopyproof/project-lifecycle/control/v1", ...seed }) !== controlRoot) {
    throw new Error("CanopyProof project lifecycle control root is invalid.");
  }
  assertExpectedAuditEvent(record, {
    action: fact.action === "restore" ? "FULFILL" : "CHALLENGE",
    actor: fact.governor.id,
    rationale: "An independent human applied an append-only project lifecycle control.",
    payload: { action: fact.action, reasonRoot: fact.reasonRoot, controlRoot },
  });
}

function assertRegistrationCommandIdentity(
  fact: CanopyProofProjectLifecycleRegistrationFact,
  proposer: CanopyProofProjectLifecycleActorSnapshot,
) {
  const parsed = registrationInputSchema.parse({
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    projectAuthorityRoot: fact.projectAuthorityRoot,
    projectStatus: fact.projectStatus,
    baseline: {
      baselineId: fact.baseline.baselineId,
      observedAt: fact.baseline.observedAt,
      evidenceRoots: fact.baseline.evidenceRoots,
      satelliteRoots: fact.baseline.satelliteRoots,
      metricRoots: fact.baseline.metricRoots,
      limitations: fact.baseline.limitations,
    },
    intervention: {
      interventionId: fact.intervention.interventionId,
      interventionType: fact.intervention.interventionType,
      startsAt: fact.intervention.startsAt,
      ...(fact.intervention.endsAt ? { endsAt: fact.intervention.endsAt } : {}),
      targetAreaSquareMeters: fact.intervention.targetAreaSquareMeters,
      targetTreeCount: fact.intervention.targetTreeCount,
      methodologyRoot: fact.intervention.methodologyRoot,
      evidenceRoots: fact.intervention.evidenceRoots,
    },
    monitoringPlan: {
      monitoringPlanId: fact.monitoringPlan.monitoringPlanId,
      startsAt: fact.monitoringPlan.startsAt,
      endsAt: fact.monitoringPlan.endsAt,
      cadenceDays: fact.monitoringPlan.cadenceDays,
      indicatorCodes: fact.monitoringPlan.indicatorCodes,
      evidenceRequirementCodes: fact.monitoringPlan.evidenceRequirementCodes,
      responsibleOrganizationId: fact.monitoringPlan.responsibleOrganizationId,
      escalationPolicyRoot: fact.monitoringPlan.escalationPolicyRoot,
    },
    policyId: fact.policyId,
    policyVersion: fact.policyVersion,
    policyRoot: fact.policyRoot,
    validFrom: fact.validFrom,
    validUntil: fact.validUntil,
    registeredAt: fact.registeredAt,
  });
  const expected = hashJson({
    domain: "canopyproof/project-lifecycle/registration-command/v1",
    parsed,
    proposer,
    generation: fact.generation,
  });
  assertCommandIdentity(
    fact.commandHash,
    fact.id,
    expected,
    "cp_project_lifecycle_registration_",
  );
}

function assertReviewCommandIdentity(
  fact: CanopyProofProjectLifecycleReviewFact,
  reviewer: CanopyProofProjectLifecycleActorSnapshot,
) {
  const parsed = reviewInputSchema.parse({
    registrationId: fact.registrationId,
    registrationRoot: fact.registrationRoot,
    decision: fact.decision,
    reasonCode: fact.reasonCode,
    rationale: fact.rationale,
    reviewedAt: fact.reviewedAt,
  });
  const expected = hashJson({
    domain: "canopyproof/project-lifecycle/review-command/v1",
    parsed,
    reviewer,
    generation: fact.generation,
  });
  assertCommandIdentity(fact.commandHash, fact.id, expected, "cp_project_lifecycle_review_");
}

function assertTransitionCommandIdentity(
  fact: CanopyProofProjectLifecycleTransitionFact,
  governor: CanopyProofProjectLifecycleActorSnapshot,
) {
  const parsed = transitionInputSchema.parse({
    fromStage: fact.fromStage,
    toStage: fact.toStage,
    source: fact.source,
    reasonCode: fact.reasonCode,
    rationale: fact.rationale,
    transitionedAt: fact.transitionedAt,
  });
  const expected = hashJson({
    domain: "canopyproof/project-lifecycle/transition-command/v1",
    parsed,
    governor,
    generation: fact.generation,
  });
  assertCommandIdentity(
    fact.commandHash,
    fact.id,
    expected,
    "cp_project_lifecycle_transition_",
  );
}

function assertControlCommandIdentity(
  fact: CanopyProofProjectLifecycleControlFact,
  governor: CanopyProofProjectLifecycleActorSnapshot,
) {
  const parsed = controlInputSchema.parse({
    action: fact.action,
    reasonCode: fact.reasonCode,
    reasonRoot: fact.reasonRoot,
    rationale: fact.rationale,
    ...(fact.restoresControlRoot ? { restoresControlRoot: fact.restoresControlRoot } : {}),
    ...(fact.restorationAuthorityRoot
      ? { restorationAuthorityRoot: fact.restorationAuthorityRoot }
      : {}),
    controlledAt: fact.controlledAt,
  });
  const expected = hashJson({
    domain: "canopyproof/project-lifecycle/control-command/v1",
    parsed,
    governor,
    generation: fact.generation,
    underlyingStage: fact.underlyingStage,
  });
  assertCommandIdentity(fact.commandHash, fact.id, expected, "cp_project_lifecycle_control_");
}

function assertCommandIdentity(
  actualCommandHash: string,
  actualId: string,
  expectedCommandHash: string,
  idPrefix: string,
) {
  if (
    actualCommandHash !== expectedCommandHash ||
    actualId !== `${idPrefix}${expectedCommandHash.slice(0, 24)}`
  ) {
    throw new Error("CanopyProof project lifecycle command identity is invalid.");
  }
}

function assertExpectedAuditEvent(
  record: CanopyProofProjectLifecycleRecord,
  expected: Readonly<{
    action: CanopyProofAuditEvent["action"];
    actor: string;
    rationale: string;
    payload: unknown;
  }>,
) {
  const event = recordAuditEvent(record);
  if (
    event.action !== expected.action ||
    event.actor !== expected.actor ||
    event.entityType !== recordEntityType(record) ||
    event.entityId !== recordId(record) ||
    event.createdAt !== recordTimestamp(record) ||
    event.rationale !== expected.rationale ||
    event.payloadHash !== hashJson(expected.payload)
  ) {
    throw new Error("CanopyProof project lifecycle semantic audit event is invalid.");
  }
}

function assertTransitionSource(
  toStage: CanopyProofProjectLifecycleCanonicalStage,
  sourceInput: CanopyProofProjectLifecycleTransitionSource,
  registration: CanopyProofProjectLifecycleRegistrationFact,
  history: readonly CanopyProofProjectLifecycleRecord[],
) {
  const source = normalizeTransitionSource(sourceInput);
  if (hashJson(source) !== hashJson(sourceInput)) {
    throw new Error("CanopyProof project lifecycle transition source is not canonical.");
  }
  assertCanonicalTimestamp(source.resolvedAt, "transition source resolvedAt");
  const expectedKind = {
    FUNDED: "funding",
    VERIFIED: "proof",
    LONG_TERM_OBSERVATION: "monitoring",
    CLOSED: "closure",
    PROPOSED: "funding",
  } as const;
  if (source.kind !== expectedKind[toStage]) {
    throw new Error("CanopyProof project lifecycle transition source kind does not match its target stage.");
  }
  if (source.kind === "funding") {
    const expected = hashJson({
      domain: "canopyproof/project-lifecycle/funding-source/v1",
      kind: source.kind,
      projectionRoots: source.projectionRoots,
      currentRoots: source.currentRoots,
      allocatedCents: source.allocatedCents,
      resolvedAt: source.resolvedAt,
    });
    if (source.sourceAuthorityRoot !== expected) {
      throw new Error("CanopyProof project lifecycle funding source authority root is invalid.");
    }
  } else if (source.kind === "proof") {
    const expected = hashJson({
      domain: "canopyproof/project-lifecycle/proof-source/v1",
      kind: source.kind,
      lifecycleProjectionRoots: source.lifecycleProjectionRoots,
      currentRoots: source.currentRoots,
      resolvedAt: source.resolvedAt,
    });
    if (source.sourceAuthorityRoot !== expected) {
      throw new Error("CanopyProof project lifecycle proof source authority root is invalid.");
    }
  } else if (source.kind === "monitoring") {
    if (source.monitoringPlanRoot !== registration.monitoringPlan.monitoringPlanRoot) {
      throw new Error("CanopyProof project lifecycle monitoring source uses a different monitoring plan.");
    }
    const verified = [...history]
      .reverse()
      .find(
        (record): record is Extract<CanopyProofProjectLifecycleRecord, { kind: "transition" }> =>
          record.kind === "transition" &&
          record.transition.generation === registration.generation &&
          record.transition.toStage === "VERIFIED",
      );
    assertCanonicalTimestamp(source.latestObservedAt, "monitoring source latestObservedAt");
    if (!verified || Date.parse(source.latestObservedAt) <= Date.parse(verified.transition.transitionedAt)) {
      throw new Error("CanopyProof long-term observation requires monitoring after verification.");
    }
    const expected = hashJson({
      domain: "canopyproof/project-lifecycle/monitoring-source/v1",
      kind: source.kind,
      monitoringEventRoots: source.monitoringEventRoots,
      latestObservedAt: source.latestObservedAt,
      monitoringPlanRoot: source.monitoringPlanRoot,
      resolvedAt: source.resolvedAt,
    });
    if (source.sourceAuthorityRoot !== expected) {
      throw new Error("CanopyProof project lifecycle monitoring source authority root is invalid.");
    }
  } else {
    const expected = hashJson({
      domain: "canopyproof/project-lifecycle/closure-source/v1",
      kind: source.kind,
      closureEvidenceRoots: source.closureEvidenceRoots,
      finalMonitoringRoot: source.finalMonitoringRoot,
      closureReviewRoot: source.closureReviewRoot,
      resolvedAt: source.resolvedAt,
    });
    if (source.sourceAuthorityRoot !== expected) {
      throw new Error("CanopyProof project lifecycle closure source authority root is invalid.");
    }
  }
}

function normalizeTransitionSource(
  source: CanopyProofProjectLifecycleTransitionSource,
): CanopyProofProjectLifecycleTransitionSource {
  if (source.kind === "funding") {
    return fundingSourceSchema.parse({
      ...source,
      projectionRoots: canonicalHashes(source.projectionRoots, "funding projectionRoots"),
      currentRoots: canonicalHashes(source.currentRoots, "funding currentRoots"),
    });
  }
  if (source.kind === "proof") {
    return proofSourceSchema.parse({
      ...source,
      lifecycleProjectionRoots: canonicalHashes(
        source.lifecycleProjectionRoots,
        "proof lifecycleProjectionRoots",
      ),
      currentRoots: canonicalHashes(source.currentRoots, "proof currentRoots"),
    });
  }
  if (source.kind === "monitoring") {
    return monitoringSourceSchema.parse({
      ...source,
      monitoringEventRoots: canonicalHashes(
        source.monitoringEventRoots,
        "monitoring event roots",
      ),
    });
  }
  return closureSourceSchema.parse({
    ...source,
    closureEvidenceRoots: canonicalHashes(
      source.closureEvidenceRoots,
      "closure evidence roots",
    ),
  });
}

export function buildCanopyProofProjectLifecycleFundingSource(input: Readonly<{
  projectionRoots: readonly string[];
  currentRoots: readonly string[];
  allocatedCents: number;
  resolvedAt: string;
}>): CanopyProofProjectLifecycleTransitionSource {
  assertCanonicalTimestamp(input.resolvedAt, "funding source resolvedAt");
  const normalized = {
    kind: "funding" as const,
    projectionRoots: canonicalHashes(input.projectionRoots, "funding projectionRoots"),
    currentRoots: canonicalHashes(input.currentRoots, "funding currentRoots"),
    allocatedCents: input.allocatedCents,
    resolvedAt: input.resolvedAt,
  };
  return fundingSourceSchema.parse({
    ...normalized,
    sourceAuthorityRoot: hashJson({
      domain: "canopyproof/project-lifecycle/funding-source/v1",
      ...normalized,
    }),
  });
}

export function buildCanopyProofProjectLifecycleProofSource(input: Readonly<{
  lifecycleProjectionRoots: readonly string[];
  currentRoots: readonly string[];
  resolvedAt: string;
}>): CanopyProofProjectLifecycleTransitionSource {
  assertCanonicalTimestamp(input.resolvedAt, "proof source resolvedAt");
  const normalized = {
    kind: "proof" as const,
    lifecycleProjectionRoots: canonicalHashes(
      input.lifecycleProjectionRoots,
      "proof lifecycleProjectionRoots",
    ),
    currentRoots: canonicalHashes(input.currentRoots, "proof currentRoots"),
    resolvedAt: input.resolvedAt,
  };
  return proofSourceSchema.parse({
    ...normalized,
    sourceAuthorityRoot: hashJson({
      domain: "canopyproof/project-lifecycle/proof-source/v1",
      ...normalized,
    }),
  });
}

export function buildCanopyProofProjectLifecycleMonitoringSource(input: Readonly<{
  monitoringEventRoots: readonly string[];
  latestObservedAt: string;
  monitoringPlanRoot: string;
  resolvedAt: string;
}>): CanopyProofProjectLifecycleTransitionSource {
  assertCanonicalTimestamp(input.latestObservedAt, "monitoring source latestObservedAt");
  assertCanonicalTimestamp(input.resolvedAt, "monitoring source resolvedAt");
  const normalized = {
    kind: "monitoring" as const,
    monitoringEventRoots: canonicalHashes(input.monitoringEventRoots, "monitoring event roots"),
    latestObservedAt: input.latestObservedAt,
    monitoringPlanRoot: input.monitoringPlanRoot,
    resolvedAt: input.resolvedAt,
  };
  return monitoringSourceSchema.parse({
    ...normalized,
    sourceAuthorityRoot: hashJson({
      domain: "canopyproof/project-lifecycle/monitoring-source/v1",
      ...normalized,
    }),
  });
}

export function buildCanopyProofProjectLifecycleClosureSource(input: Readonly<{
  closureEvidenceRoots: readonly string[];
  finalMonitoringRoot: string;
  closureReviewRoot: string;
  resolvedAt: string;
}>): CanopyProofProjectLifecycleTransitionSource {
  assertCanonicalTimestamp(input.resolvedAt, "closure source resolvedAt");
  const normalized = {
    kind: "closure" as const,
    closureEvidenceRoots: canonicalHashes(input.closureEvidenceRoots, "closure evidence roots"),
    finalMonitoringRoot: input.finalMonitoringRoot,
    closureReviewRoot: input.closureReviewRoot,
    resolvedAt: input.resolvedAt,
  };
  return closureSourceSchema.parse({
    ...normalized,
    sourceAuthorityRoot: hashJson({
      domain: "canopyproof/project-lifecycle/closure-source/v1",
      ...normalized,
    }),
  });
}

function assertControlAllowed(
  input: CanopyProofProjectLifecycleControlInput,
  projection: CanopyProofProjectLifecycleProjection,
  history: readonly CanopyProofProjectLifecycleRecord[],
) {
  if (input.action === "restore") {
    if (!["CHALLENGED", "SUSPENDED"].includes(projection.stage)) {
      throw new Error("CanopyProof project lifecycle restore requires a challenged or suspended stage.");
    }
    const adverse = [...history]
      .reverse()
      .find(
        (record): record is Extract<CanopyProofProjectLifecycleRecord, { kind: "control" }> =>
          record.kind === "control" && ["challenge", "suspend"].includes(record.control.action),
      );
    if (
      !adverse ||
      input.restoresControlRoot !== adverse.control.controlRoot ||
      !input.restorationAuthorityRoot
    ) {
      throw new Error("CanopyProof project lifecycle restore does not bind the current adverse control.");
    }
    return;
  }
  if (input.restoresControlRoot || input.restorationAuthorityRoot) {
    throw new Error("CanopyProof project lifecycle non-restore control cannot contain restoration authority.");
  }
  if (["PENDING_REVIEW", "REJECTED", "CLOSED", "REVOKED", "EXPIRED"].includes(projection.stage)) {
    throw new Error("CanopyProof project lifecycle control is not legal in the current stage.");
  }
  if (["CHALLENGED", "SUSPENDED"].includes(projection.stage) && input.action !== "revoke") {
    throw new Error("CanopyProof project lifecycle adverse state requires restore or revoke.");
  }
}

function assertLegalTransition(
  fromStage: CanopyProofProjectLifecycleCanonicalStage,
  toStage: CanopyProofProjectLifecycleCanonicalStage,
) {
  const legal: Readonly<Record<CanopyProofProjectLifecycleCanonicalStage, CanopyProofProjectLifecycleCanonicalStage | null>> = {
    PROPOSED: "FUNDED",
    FUNDED: "VERIFIED",
    VERIFIED: "LONG_TERM_OBSERVATION",
    LONG_TERM_OBSERVATION: "CLOSED",
    CLOSED: null,
  };
  if (legal[fromStage] !== toStage) {
    throw new Error(`CanopyProof project lifecycle transition ${fromStage} -> ${toStage} is not legal.`);
  }
}

function canApplyAdverseControl(stage: CanopyProofProjectLifecycleStage) {
  return canopyProofProjectLifecycleCanonicalStages.includes(
    stage as CanopyProofProjectLifecycleCanonicalStage,
  ) && stage !== "CLOSED";
}

function requireProjection(
  history: readonly CanopyProofProjectLifecycleRecord[],
  evaluatedAt: string,
) {
  const projection = replayCanopyProofProjectLifecycle(history, evaluatedAt);
  if (!projection) throw new Error("CanopyProof project lifecycle projection is missing.");
  return projection;
}

function latestRegistration(
  history: readonly CanopyProofProjectLifecycleRecord[],
  generation: number,
) {
  const registration = [...history]
    .reverse()
    .find(
      (record): record is Extract<CanopyProofProjectLifecycleRecord, { kind: "registration" }> =>
        record.kind === "registration" && record.registration.generation === generation,
    )?.registration;
  if (!registration) throw new Error("CanopyProof project lifecycle registration is missing.");
  return registration;
}

function latestApprovedReview(
  history: readonly CanopyProofProjectLifecycleRecord[],
  generation: number,
) {
  const review = [...history]
    .reverse()
    .find(
      (record): record is Extract<CanopyProofProjectLifecycleRecord, { kind: "review" }> =>
        record.kind === "review" && record.review.generation === generation,
    )?.review;
  if (!review || review.decision !== "approve") {
    throw new Error("CanopyProof project lifecycle approved registration review is missing.");
  }
  return review;
}

function requireIndependentGovernor(
  governor: Readonly<{ id: string; organizationId: string }>,
  registration: CanopyProofProjectLifecycleRegistrationFact,
  review: CanopyProofProjectLifecycleReviewFact,
) {
  if (
    governor.id === registration.proposer.id ||
    governor.id === review.reviewer.id ||
    governor.organizationId === registration.proposer.organizationId ||
    governor.organizationId === review.reviewer.organizationId
  ) {
    throw new Error("CanopyProof project lifecycle governor must be independent of proposer and reviewer.");
  }
}

function requireIndependentRestorer(
  action: CanopyProofProjectLifecycleControlAction,
  governor: Readonly<{ id: string; organizationId: string }>,
  history: readonly CanopyProofProjectLifecycleRecord[],
) {
  if (action !== "restore") return;
  const adverse = [...history]
    .reverse()
    .find(
      (record): record is Extract<CanopyProofProjectLifecycleRecord, { kind: "control" }> =>
        record.kind === "control" && ["challenge", "suspend"].includes(record.control.action),
    );
  if (
    !adverse ||
    governor.id === adverse.control.governor.id ||
    governor.organizationId === adverse.control.governor.organizationId
  ) {
    throw new Error("CanopyProof project lifecycle restoration requires an independent governor.");
  }
}

function requireSubjectProposer(
  actor: CanopyProofProjectLifecycleActorSnapshot,
  subjectOrganizationId: string,
) {
  if (
    actor.organizationId !== subjectOrganizationId ||
    !["owner", "admin"].includes(actor.role) ||
    actor.authoritySource !== "subject_membership" ||
    actor.accreditationScope.length !== 0 ||
    actor.accreditationId ||
    actor.accreditationStatus ||
    actor.accreditationDecisionRoot ||
    actor.accreditationProjectionRoot ||
    actor.accreditationValidFrom ||
    actor.accreditationValidUntil
  ) {
    throw new Error("CanopyProof project lifecycle proposer lacks current subject authority.");
  }
}

function requireGovernanceActor(
  actor: CanopyProofProjectLifecycleActorSnapshot,
  subjectOrganizationId: string,
  scope: string,
  roles: readonly CanopyProofProjectLifecycleActorSnapshot["role"][],
  effectiveAt: string,
) {
  assertCanonicalTimestamp(effectiveAt, "actor authority effectiveAt");
  if (
    actor.organizationId === subjectOrganizationId ||
    !roles.includes(actor.role) ||
    actor.membershipStatus !== "active" ||
    !["root_governance_bootstrap", "canonical_accreditation"].includes(actor.authoritySource) ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationDecisionRoot ||
    !actor.accreditationProjectionRoot ||
    !actor.accreditationValidFrom ||
    !actor.accreditationValidUntil ||
    !actor.accreditationScope.includes(scope) ||
    Date.parse(effectiveAt) < Date.parse(actor.accreditationValidFrom) ||
    Date.parse(effectiveAt) >= Date.parse(actor.accreditationValidUntil)
  ) {
    throw new Error(`CanopyProof project lifecycle actor lacks current ${scope} authority.`);
  }
}

function normalizeActor(actorInput: unknown) {
  const actor = actorSchema.parse(actorInput);
  const normalized = normalizeActorAuthoritySeed(actor);
  assertActorAuthorityShape(normalized);
  const expectedAuthorityRoot = organizationAccreditationActorAuthorityRoot(normalized);
  if (actor.authorityRoot !== expectedAuthorityRoot) {
    throw new Error("CanopyProof project lifecycle actor authority root is invalid.");
  }
  return {
    ...normalized,
    authorityRoot: expectedAuthorityRoot,
  } satisfies CanopyProofProjectLifecycleActorSnapshot;
}

function verifyCanonicalActor(actorInput: unknown) {
  const normalized = normalizeActor(actorInput);
  if (hashJson(actorInput) !== hashJson(normalized)) {
    throw new Error("CanopyProof project lifecycle actor snapshot is not canonical.");
  }
  return normalized;
}

function normalizeActorAuthoritySeed(
  actor: Omit<z.output<typeof actorSchema>, "authorityRoot">,
) {
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
    authoritySource: actor.authoritySource,
    ...(actor.accreditationId ? { accreditationId: actor.accreditationId } : {}),
    ...(actor.accreditationStatus
      ? { accreditationStatus: actor.accreditationStatus }
      : {}),
    ...(actor.accreditationDecisionRoot
      ? { accreditationDecisionRoot: actor.accreditationDecisionRoot }
      : {}),
    ...(actor.accreditationProjectionRoot
      ? { accreditationProjectionRoot: actor.accreditationProjectionRoot }
      : {}),
    ...(actor.accreditationValidFrom
      ? { accreditationValidFrom: actor.accreditationValidFrom }
      : {}),
    ...(actor.accreditationValidUntil
      ? { accreditationValidUntil: actor.accreditationValidUntil }
      : {}),
    accreditationScope: canonicalStrings(actor.accreditationScope, "actor accreditationScope"),
  } satisfies Omit<CanopyProofProjectLifecycleActorSnapshot, "authorityRoot">;
}

function assertActorAuthorityShape(
  actor: Omit<CanopyProofProjectLifecycleActorSnapshot, "authorityRoot">,
) {
  const hasAccreditation = Boolean(
    actor.accreditationId ||
      actor.accreditationStatus ||
      actor.accreditationDecisionRoot ||
      actor.accreditationProjectionRoot ||
      actor.accreditationValidFrom ||
      actor.accreditationValidUntil,
  );
  if (actor.authoritySource === "subject_membership") {
    if (hasAccreditation || actor.accreditationScope.length !== 0) {
      throw new Error("CanopyProof project lifecycle subject authority contains accreditation fields.");
    }
    return;
  }
  if (
    !actor.accreditationId ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationDecisionRoot ||
    !actor.accreditationProjectionRoot ||
    !actor.accreditationValidFrom ||
    !actor.accreditationValidUntil ||
    actor.accreditationScope.length === 0
  ) {
    throw new Error("CanopyProof project lifecycle canonical actor accreditation is incomplete.");
  }
  assertCanonicalTimestamp(actor.accreditationValidFrom, "actor accreditation validFrom");
  assertCanonicalTimestamp(actor.accreditationValidUntil, "actor accreditation validUntil");
  assertBefore(
    actor.accreditationValidFrom,
    actor.accreditationValidUntil,
    "actor accreditation validity",
  );
}

export function buildCanopyProofProjectLifecycleActorAuthorityRoot(
  actorInput: Omit<CanopyProofProjectLifecycleActorSnapshot, "authorityRoot">,
) {
  const actor = actorSchema.omit({ authorityRoot: true }).parse(actorInput);
  const normalized = normalizeActorAuthoritySeed(actor);
  assertActorAuthorityShape(normalized);
  return organizationAccreditationActorAuthorityRoot(normalized);
}

function appendLifecycleAuditEvent(
  history: readonly CanopyProofProjectLifecycleRecord[],
  input: Readonly<{
    action: CanopyProofAuditEvent["action"];
    actor: string;
    entityType: CanopyProofAuditEvent["entityType"];
    entityId: string;
    createdAt: string;
    rationale: string;
    payload: unknown;
  }>,
) {
  const events = history.map(recordAuditEvent);
  const event = appendCanopyProofAuditEvent(events, input).at(-1);
  if (!event) throw new Error("CanopyProof project lifecycle audit event was not appended.");
  return auditEventSchema.parse(event);
}

function assertValidAuditChain(events: readonly CanopyProofAuditEvent[]) {
  const verification = verifyCanopyProofAuditChain(events);
  if (!verification.valid) {
    throw new Error(
      `CanopyProof project lifecycle audit chain is invalid: ${verification.issues
        .map((issue) => issue.code)
        .join(",")}`,
    );
  }
}

function assertControlFactSemantics(fact: CanopyProofProjectLifecycleControlFact) {
  if (fact.action === "restore") {
    if (!fact.restoresControlRoot || !fact.restorationAuthorityRoot) {
      throw new Error("CanopyProof project lifecycle restore authority is incomplete.");
    }
    return;
  }
  if (fact.restoresControlRoot || fact.restorationAuthorityRoot) {
    throw new Error("CanopyProof project lifecycle non-restore control contains restore authority.");
  }
}

function canonicalHashes(values: readonly string[], label: string) {
  const parsed = values.map((value) => hashSchema.parse(value));
  return canonicalStrings(parsed, label);
}

function canonicalStrings(values: readonly string[], label: string) {
  const sorted = [...new Set(values)].sort((left, right) => left.localeCompare(right));
  if (sorted.length !== values.length) {
    throw new Error(`CanopyProof project lifecycle ${label} contains duplicates.`);
  }
  return sorted;
}

function assertCanonicalTimestamp(value: string, label: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`CanopyProof project lifecycle ${label} must be canonical UTC milliseconds.`);
  }
}

function assertBefore(left: string, right: string, label: string) {
  if (Date.parse(left) >= Date.parse(right)) {
    throw new Error(`CanopyProof project lifecycle ${label} is invalid.`);
  }
}

function assertFactTime(value: string, lower: string, upper: string, label: string) {
  assertCanonicalTimestamp(value, `${label} time`);
  if (Date.parse(value) < Date.parse(lower) || Date.parse(value) >= Date.parse(upper)) {
    throw new Error(`CanopyProof project lifecycle ${label} time is outside the active registration interval.`);
  }
}

function lifecycleIssueCodes(stage: CanopyProofProjectLifecycleStage) {
  const code: Partial<Record<CanopyProofProjectLifecycleStage, string>> = {
    PENDING_REVIEW: "registration_pending_review",
    REJECTED: "registration_rejected",
    CHALLENGED: "lifecycle_challenged",
    SUSPENDED: "lifecycle_suspended",
    REVOKED: "lifecycle_revoked",
    EXPIRED: "lifecycle_expired",
  };
  return code[stage] ? [code[stage] as string] : [];
}

function isExpirableActiveStage(stage: CanopyProofProjectLifecycleStage) {
  return (
    stage === "PENDING_REVIEW" ||
    canopyProofProjectLifecycleCanonicalStages.includes(
      stage as CanopyProofProjectLifecycleCanonicalStage,
    )
  );
}

function recordSequence(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.projectSequence;
  if (record.kind === "review") return record.review.projectSequence;
  if (record.kind === "transition") return record.transition.projectSequence;
  return record.control.projectSequence;
}

function recordGeneration(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.generation;
  if (record.kind === "review") return record.review.generation;
  if (record.kind === "transition") return record.transition.generation;
  return record.control.generation;
}

function recordPreviousEventRoot(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.previousEventRoot;
  if (record.kind === "review") return record.review.previousEventRoot;
  if (record.kind === "transition") return record.transition.previousEventRoot;
  return record.control.previousEventRoot;
}

function recordAuditEvent(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.auditEvent;
  if (record.kind === "review") return record.review.auditEvent;
  if (record.kind === "transition") return record.transition.auditEvent;
  return record.control.auditEvent;
}

function recordOrganizationId(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.organizationId;
  if (record.kind === "review") return record.review.organizationId;
  if (record.kind === "transition") return record.transition.organizationId;
  return record.control.organizationId;
}

function recordProjectId(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.projectId;
  if (record.kind === "review") return record.review.projectId;
  if (record.kind === "transition") return record.transition.projectId;
  return record.control.projectId;
}

function recordTimestamp(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.registeredAt;
  if (record.kind === "review") return record.review.reviewedAt;
  if (record.kind === "transition") return record.transition.transitionedAt;
  return record.control.controlledAt;
}

function recordId(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.id;
  if (record.kind === "review") return record.review.id;
  if (record.kind === "transition") return record.transition.id;
  return record.control.id;
}

function recordEntityType(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return "project_lifecycle_registration" as const;
  if (record.kind === "review") return "project_lifecycle_review" as const;
  if (record.kind === "transition") return "project_lifecycle_transition" as const;
  return "project_lifecycle_control" as const;
}

function lastEventRoot(history: readonly CanopyProofProjectLifecycleRecord[]) {
  const latest = history.at(-1);
  return latest ? recordAuditEvent(latest).eventRoot : canopyProofAuditGenesisRoot();
}

export function buildCanopyProofProjectLifecycleSourceSetRoot(roots: readonly string[]) {
  return merkleRoot(canonicalHashes(roots, "source roots"));
}
