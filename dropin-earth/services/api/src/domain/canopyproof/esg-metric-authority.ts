import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type {
  CanopyProofMethodologyPublicationBundle,
  CanopyProofMethodologyPublicationProjection,
} from "./methodology-governance-authority.js";
import {
  type CanopyProofCanonicalEsgSourceAuthority,
  type CanopyProofCanonicalEnvironmentalSourceSeed,
  type CanopyProofReportingOrganizationSnapshot,
  resolveCanopyProofCanonicalEnvironmentalSource,
} from "./esg-reporting-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofEsgMetricDimensions = [
  "percentage",
  "mass_tco2e",
  "area_hectare",
  "volume_m3",
  "count",
  "index",
] as const;
export const canopyProofEsgMetricUnits = ["percent", "tCO2e", "ha", "m3", "count", "index"] as const;
export const canopyProofEsgMetricRoundingModes = ["half_even", "half_up", "floor", "ceiling"] as const;
export const canopyProofEsgMetricAggregationMethods = [
  "none",
  "sum",
  "minimum",
  "maximum",
  "mean",
  "weighted_mean",
  "last_observation",
] as const;
export const canopyProofEsgMetricValueStates = [
  "reported",
  "below_detection_limit",
  "not_applicable",
  "withheld",
  "unavailable",
] as const;
export const canopyProofEsgMetricDefinitionStates = ["current", "superseded", "methodology_superseded"] as const;
export const canopyProofEsgMetricResultStates = [
  "current",
  "definition_superseded",
  "methodology_superseded",
  "source_stale",
  "challenged",
  "revoked",
  "expired",
] as const;

export type CanopyProofEsgMetricDimension = (typeof canopyProofEsgMetricDimensions)[number];
export type CanopyProofEsgMetricUnit = (typeof canopyProofEsgMetricUnits)[number];
export type CanopyProofEsgMetricRoundingMode = (typeof canopyProofEsgMetricRoundingModes)[number];
export type CanopyProofEsgMetricAggregationMethod = (typeof canopyProofEsgMetricAggregationMethods)[number];
export type CanopyProofEsgMetricValueState = (typeof canopyProofEsgMetricValueStates)[number];
export type CanopyProofEsgMetricDefinitionState = (typeof canopyProofEsgMetricDefinitionStates)[number];
export type CanopyProofEsgMetricResultState = (typeof canopyProofEsgMetricResultStates)[number];

export type CanopyProofEsgMetricSafetyBoundary = {
  readonly immutableAuthority: true;
  readonly exactDecimalRequired: true;
  readonly explicitMissingValueStateRequired: true;
  readonly currentMethodologyRequired: true;
  readonly currentEnvironmentalProofRequired: true;
  readonly activeSignedLifecycleRequired: true;
  readonly reviewedMrvRequired: true;
  readonly independentHumanReviewRequired: true;
  readonly appendOnly: true;
  readonly exactRetryRequired: true;
  readonly tenantBound: true;
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly frameworkPreparationOnly: true;
  readonly notAssuranceOpinion: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEsgMetricFrameworkMapping = {
  readonly framework: "GRI" | "SDG" | "TNFD" | "BIODIVERSITY" | "CLIMATE_IMPACT";
  readonly disclosureCode: string;
  readonly status: "preparation_only";
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly mappingRoot: string;
};

export type CanopyProofEsgMetricUncertaintyPolicy = {
  readonly method: "confidence_interval" | "bounded_range" | "not_quantified";
  readonly allowNotQuantified: boolean;
  readonly requiredComponents: readonly string[];
  readonly policyRoot: string;
};

export type CanopyProofEsgMetricDefinitionFact = {
  readonly factType: "esg_metric_definition";
  readonly id: string;
  readonly owner: CanopyProofReportingOrganizationSnapshot;
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly dimension: CanopyProofEsgMetricDimension;
  readonly canonicalUnit: CanopyProofEsgMetricUnit;
  readonly allowedUnits: readonly CanopyProofEsgMetricUnit[];
  readonly precisionScale: number;
  readonly valueDomain: "non_negative" | "signed";
  readonly roundingMode: CanopyProofEsgMetricRoundingMode;
  readonly aggregationMethod: CanopyProofEsgMetricAggregationMethod;
  readonly spatialAggregation: "grid" | "project" | "region";
  readonly temporalAggregation: "instant" | "period_sum" | "period_mean" | "period_end";
  readonly sourceRequirements: readonly [
    "active_signed_lifecycle",
    "current_environmental_proof",
    "reviewed_mrv",
  ];
  readonly uncertaintyPolicy: CanopyProofEsgMetricUncertaintyPolicy;
  readonly frameworkMappings: readonly CanopyProofEsgMetricFrameworkMapping[];
  readonly methodologyId: string;
  readonly methodologyHash: string;
  readonly methodologyPublicationId: string;
  readonly methodologyPublicationRoot: string;
  readonly methodologyPublicationBundleRoot: string;
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly reviewers: readonly CanopyProofVerificationActorSnapshot[];
  readonly reviewerRoot: string;
  readonly limitations: readonly string[];
  readonly supersedesDefinitionId?: string;
  readonly supersedesDefinitionRoot?: string;
  readonly effectiveAt: string;
  readonly commandHash: string;
  readonly definitionSequence: number;
  readonly previousEventRoot: string;
  readonly definitionHash: string;
  readonly definitionRoot: string;
  readonly safety: CanopyProofEsgMetricSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEsgMetricDefinitionProjection = {
  readonly ownerOrganizationId: string;
  readonly slug: string;
  readonly definitionId: string;
  readonly definitionRoot: string;
  readonly state: CanopyProofEsgMetricDefinitionState;
  readonly methodologyPublicationId: string;
  readonly methodologyPublicationRoot: string;
  readonly evaluatedAt: string;
  readonly latestDefinitionId: string;
  readonly latestDefinitionRoot: string;
  readonly issueCodes: readonly string[];
  readonly projectionRoot: string;
  readonly safety: CanopyProofEsgMetricSafetyBoundary;
};

export type CanopyProofEsgMetricResultSourceFact = {
  readonly factType: "esg_metric_result_source";
  readonly id: string;
  readonly resultId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly memberIndex: number;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly governedRecordProjectionRoot: string;
  readonly lifecycleBindingId: string;
  readonly lifecycleBindingRoot: string;
  readonly lifecycleProjectionRoot: string;
  readonly signingKeyAuthorityId: string;
  readonly signingKeyRoot: string;
  readonly signatureReceiptId: string;
  readonly signatureReceiptRoot: string;
  readonly mrvSnapshotId: string;
  readonly mrvSnapshotRoot: string;
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly monitoringRoot: string;
  readonly confidenceScore: number;
  readonly memberHash: string;
  readonly memberRoot: string;
  readonly safety: CanopyProofEsgMetricSafetyBoundary;
};

export type CanopyProofEsgMetricUncertainty =
  | {
      readonly kind: "interval";
      readonly lower: string;
      readonly upper: string;
      readonly confidenceLevelPct: number;
      readonly components: readonly string[];
      readonly uncertaintyRoot: string;
    }
  | {
      readonly kind: "not_quantified";
      readonly reason: string;
      readonly components: readonly string[];
      readonly uncertaintyRoot: string;
    };

export type CanopyProofEsgMetricResultFact = {
  readonly factType: "esg_metric_result";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly definitionId: string;
  readonly definitionRoot: string;
  readonly definitionVersion: string;
  readonly reportingPeriod: { readonly startsAt: string; readonly endsAt: string };
  readonly observationPeriod: { readonly startsAt: string; readonly endsAt: string };
  readonly valueState: CanopyProofEsgMetricValueState;
  readonly decimalValue?: string;
  readonly unit: CanopyProofEsgMetricUnit;
  readonly detectionLimit?: string;
  readonly withheldReason?: string;
  readonly unavailableReason?: string;
  readonly uncertainty: CanopyProofEsgMetricUncertainty;
  readonly calculationArtifactHash: string;
  readonly calculator: CanopyProofVerificationActorSnapshot;
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly reviewRationale: string;
  readonly limitations: readonly string[];
  readonly sourceRecordIds: readonly string[];
  readonly sourceMemberRoots: readonly string[];
  readonly sourceCount: number;
  readonly sourceSetRoot: string;
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly monitoringRoot: string;
  readonly confidenceScore: number;
  readonly calculatedAt: string;
  readonly reviewedAt: string;
  readonly commandHash: string;
  readonly projectSequence: number;
  readonly previousEventRoot: string;
  readonly resultHash: string;
  readonly resultRoot: string;
  readonly safety: CanopyProofEsgMetricSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEsgMetricResultProjection = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly resultId: string;
  readonly resultRoot: string;
  readonly definitionId: string;
  readonly definitionRoot: string;
  readonly state: CanopyProofEsgMetricResultState;
  readonly evaluatedAt: string;
  readonly sourceCount: number;
  readonly currentSourceCount: number;
  readonly issueCodes: readonly string[];
  readonly currentSourceRoot: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEsgMetricSafetyBoundary;
};

export type CanopyProofEsgMetricDefinitionAuthority = {
  readonly organization: CanopyProofReportingOrganizationSnapshot;
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly reviewers: readonly CanopyProofVerificationActorSnapshot[];
  readonly methodology: CanopyProofMethodologyPublicationBundle;
  readonly methodologyProjection: CanopyProofMethodologyPublicationProjection;
};

export type CanopyProofEsgMetricResultAuthority = {
  readonly definition: CanopyProofEsgMetricDefinitionFact;
  readonly definitionProjection: CanopyProofEsgMetricDefinitionProjection;
  readonly calculator: CanopyProofVerificationActorSnapshot;
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly sources: readonly CanopyProofCanonicalEsgSourceAuthority[];
};

export type CanopyProofEsgMetricResultBundle = {
  readonly result: CanopyProofEsgMetricResultFact;
  readonly sources: readonly CanopyProofEsgMetricResultSourceFact[];
};

export type CanopyProofEsgMetricAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly definitions: readonly CanopyProofEsgMetricDefinitionFact[];
  readonly results: readonly CanopyProofEsgMetricResultFact[];
  readonly resultSources: readonly CanopyProofEsgMetricResultSourceFact[];
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime();
const decimalSchema = z.string().max(128).regex(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/);
const safeTextSchema = z.string().trim().min(2).max(4_000);
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
    accreditationScope: z.array(identifierSchema).max(32),
    authorityRoot: hashSchema,
  })
  .strict();
const organizationSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(2).max(240),
    verificationStatus: z.literal("verified"),
    organizationRoot: hashSchema,
  })
  .strict();
const frameworkMappingSchema = z
  .object({
    framework: z.enum(["GRI", "SDG", "TNFD", "BIODIVERSITY", "CLIMATE_IMPACT"]),
    disclosureCode: z.string().trim().min(1).max(120),
    rationale: z.string().trim().min(24).max(2_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).min(1).max(32),
  })
  .strict();
const definitionInputSchema = z
  .object({
    organizationId: identifierSchema,
    slug: z.string().trim().regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/).max(120),
    version: z.string().regex(/^v[0-9]+\.[0-9]+\.[0-9]+$/),
    title: z.string().trim().min(8).max(240),
    description: z.string().trim().min(32).max(4_000),
    dimension: z.enum(canopyProofEsgMetricDimensions),
    canonicalUnit: z.enum(canopyProofEsgMetricUnits),
    allowedUnits: z.array(z.enum(canopyProofEsgMetricUnits)).min(1).max(6),
    precisionScale: z.number().int().min(0).max(12),
    valueDomain: z.enum(["non_negative", "signed"]),
    roundingMode: z.enum(canopyProofEsgMetricRoundingModes),
    aggregationMethod: z.enum(canopyProofEsgMetricAggregationMethods),
    spatialAggregation: z.enum(["grid", "project", "region"]),
    temporalAggregation: z.enum(["instant", "period_sum", "period_mean", "period_end"]),
    sourceRequirements: z.array(z.enum([
      "active_signed_lifecycle",
      "current_environmental_proof",
      "reviewed_mrv",
    ])).length(3),
    uncertaintyPolicy: z.object({
      method: z.enum(["confidence_interval", "bounded_range", "not_quantified"]),
      allowNotQuantified: z.boolean(),
      requiredComponents: z.array(z.string().trim().min(1).max(120)).min(1).max(32),
    }).strict(),
    frameworkMappings: z.array(frameworkMappingSchema).min(1).max(32),
    methodologyPublicationId: identifierSchema,
    limitations: z.array(z.string().trim().min(1).max(1_000)).min(1).max(32),
    supersedesDefinitionId: identifierSchema.optional(),
    effectiveAt: timestampSchema,
  })
  .strict();
const resultInputSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema,
    definitionId: identifierSchema,
    sourceRecordIds: z.array(identifierSchema).min(1).max(128),
    reportingPeriod: z.object({ startsAt: timestampSchema, endsAt: timestampSchema }).strict(),
    observationPeriod: z.object({ startsAt: timestampSchema, endsAt: timestampSchema }).strict(),
    valueState: z.enum(canopyProofEsgMetricValueStates),
    decimalValue: decimalSchema.optional(),
    unit: z.enum(canopyProofEsgMetricUnits),
    detectionLimit: decimalSchema.optional(),
    withheldReason: safeTextSchema.optional(),
    unavailableReason: safeTextSchema.optional(),
    uncertainty: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("interval"),
        lower: decimalSchema,
        upper: decimalSchema,
        confidenceLevelPct: z.number().int().min(1).max(100),
        components: z.array(z.string().trim().min(1).max(120)).min(1).max(32),
      }).strict(),
      z.object({
        kind: z.literal("not_quantified"),
        reason: z.string().trim().min(24).max(2_000),
        components: z.array(z.string().trim().min(1).max(120)).min(1).max(32),
      }).strict(),
    ]),
    calculationArtifactHash: hashSchema,
    reviewRationale: z.string().trim().min(24).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).min(1).max(32),
    calculatedAt: timestampSchema,
    reviewedAt: timestampSchema,
  })
  .strict();

const unitsByDimension: Readonly<Record<CanopyProofEsgMetricDimension, readonly CanopyProofEsgMetricUnit[]>> = {
  percentage: ["percent"],
  mass_tco2e: ["tCO2e"],
  area_hectare: ["ha"],
  volume_m3: ["m3"],
  count: ["count"],
  index: ["index"],
};
const requiredSourceRequirements = [
  "active_signed_lifecycle",
  "current_environmental_proof",
  "reviewed_mrv",
] as const;
const unsafeTextPatterns = [
  /\bcertified\s+carbon\s+credit\b/i,
  /\bcarbon[-\s]?tax\s+offset\b/i,
  /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
  /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
  /\bregulatory\s+approval\b/i,
  /\bassurance\s+opinion\b/i,
];

export class CanopyProofEsgMetricAuthorityService {
  private readonly eventsByStream = new Map<string, CanopyProofAuditEvent[]>();
  private readonly definitionsById = new Map<string, CanopyProofEsgMetricDefinitionFact>();
  private readonly definitionsBySlug = new Map<string, CanopyProofEsgMetricDefinitionFact[]>();
  private readonly resultsById = new Map<string, CanopyProofEsgMetricResultFact>();
  private readonly sourcesByResultId = new Map<string, CanopyProofEsgMetricResultSourceFact[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofEsgMetricAuthoritySnapshot) {
    const service = new CanopyProofEsgMetricAuthorityService();
    const sourcesByResult = groupBy(snapshot.resultSources, (source) => source.resultId);
    const definitions = [...snapshot.definitions].sort(
      (left, right) =>
        definitionStreamKey(left.owner.id, left.slug).localeCompare(definitionStreamKey(right.owner.id, right.slug)) ||
        left.definitionSequence - right.definitionSequence,
    );
    for (const definition of definitions) service.replayDefinition(definition, snapshot.streamEvents);
    const results = [...snapshot.results].sort(
      (left, right) =>
        resultStreamKey(left.organizationId, left.projectId).localeCompare(resultStreamKey(right.organizationId, right.projectId)) ||
        left.projectSequence - right.projectSequence,
    );
    for (const result of results) service.replayResult(result, sourcesByResult.get(result.id) ?? [], snapshot.streamEvents);
    const knownRoots = new Set([...service.eventsByStream.values()].flatMap((events) => events.map((event) => event.eventRoot)));
    if (knownRoots.size !== snapshot.streamEvents.length || snapshot.streamEvents.some((event) => !knownRoots.has(event.eventRoot))) {
      throw new Error("CanopyProof ESG metric snapshot contains unbound semantic events.");
    }
    return service;
  }

  publishDefinition(input: unknown, authority: CanopyProofEsgMetricDefinitionAuthority): CanopyProofEsgMetricDefinitionFact {
    const parsed = definitionInputSchema.parse(input);
    const owner = normalizeOrganization(authority.organization);
    if (parsed.organizationId !== owner.id) throw new Error("CanopyProof ESG metric definition owner scope is invalid.");
    const publisher = normalizeAuthorizedActor(authority.publisher, "esg_metric:govern", owner.id);
    const reviewers = normalizeDefinitionReviewers(authority.reviewers, publisher.id);
    const methodology = validateMethodologyAuthority(
      authority.methodology,
      authority.methodologyProjection,
      parsed.methodologyPublicationId,
    );
    const allowedUnits = sortedUnique(parsed.allowedUnits, "allowedUnits") as CanopyProofEsgMetricUnit[];
    if (!allowedUnits.includes(parsed.canonicalUnit) || allowedUnits.some((unit) => !unitsByDimension[parsed.dimension].includes(unit))) {
      throw new Error("CanopyProof ESG metric units are incompatible with the declared dimension.");
    }
    const declaredSourceRequirements = sortedUnique(parsed.sourceRequirements, "sourceRequirements");
    if (hashJson(declaredSourceRequirements) !== hashJson([...requiredSourceRequirements].sort())) {
      throw new Error("CanopyProof ESG metric definition requires proof, MRV, and signed lifecycle sources.");
    }
    const sourceRequirements: CanopyProofEsgMetricDefinitionFact["sourceRequirements"] = [
      "active_signed_lifecycle",
      "current_environmental_proof",
      "reviewed_mrv",
    ];
    const frameworkMappings = normalizeFrameworkMappings(parsed.frameworkMappings);
    const uncertaintyPolicy = normalizeUncertaintyPolicy(parsed.uncertaintyPolicy);
    const limitations = sortedUnique(parsed.limitations, "limitations");
    assertSafeText([
      owner.name,
      parsed.title,
      parsed.description,
      ...limitations,
      ...frameworkMappings.flatMap((mapping) => [mapping.rationale, ...mapping.limitations]),
    ]);
    const effectiveAt = canonicalTimestamp(parsed.effectiveAt, "effectiveAt");
    if (Date.parse(methodology.publication.publishedAt) > Date.parse(effectiveAt)) {
      throw new Error("CanopyProof ESG metric definition cannot predate its methodology publication.");
    }
    const streamKey = definitionStreamKey(owner.id, parsed.slug);
    const priorDefinitions = this.definitionsBySlug.get(streamKey) ?? [];
    const predecessor = priorDefinitions.at(-1);
    validateDefinitionSupersession(parsed.version, parsed.supersedesDefinitionId, predecessor);
    const reviewerRoot = merkleRoot(reviewers.map((reviewer) => reviewer.authorityRoot));
    const commandSeed = {
      owner,
      slug: parsed.slug,
      version: parsed.version,
      title: parsed.title,
      description: parsed.description,
      dimension: parsed.dimension,
      canonicalUnit: parsed.canonicalUnit,
      allowedUnits,
      precisionScale: parsed.precisionScale,
      valueDomain: parsed.valueDomain,
      roundingMode: parsed.roundingMode,
      aggregationMethod: parsed.aggregationMethod,
      spatialAggregation: parsed.spatialAggregation,
      temporalAggregation: parsed.temporalAggregation,
      sourceRequirements,
      uncertaintyPolicy,
      frameworkMappings,
      methodologyId: methodology.methodology.id,
      methodologyHash: methodology.methodology.methodologyHash,
      methodologyPublicationId: methodology.publication.id,
      methodologyPublicationRoot: methodology.publication.publicationRoot,
      methodologyPublicationBundleRoot: methodology.bundleRoot,
      publisher,
      reviewers,
      reviewerRoot,
      limitations,
      ...(predecessor ? {
        supersedesDefinitionId: predecessor.id,
        supersedesDefinitionRoot: predecessor.definitionRoot,
      } : {}),
      effectiveAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-esg-metric-definition-command-v1", ...commandSeed });
    const id = `cp_esg_metric_definition_${commandHash.slice(0, 24)}`;
    const events = this.eventsByStream.get(streamKey) ?? [];
    const definitionSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const factSeed = { id, ...commandSeed, commandHash, definitionSequence, previousEventRoot };
    const definitionHash = hashJson({ kind: "canopyproof-esg-metric-definition-v1", ...factSeed });
    const definitionRoot = hashJson({
      kind: "canopyproof-esg-metric-definition-root-v1",
      ...factSeed,
      definitionHash,
    });
    const safety = canopyProofEsgMetricSafetyBoundary();
    const payload = {
      factType: "esg_metric_definition" as const,
      ...factSeed,
      definitionHash,
      definitionRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: publisher.id,
      entityType: "esg_metric_definition",
      entityId: id,
      payload,
      createdAt: effectiveAt,
      rationale: "Independent accredited humans published an immutable route-closed ESG metric definition.",
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof ESG metric definition semantic event was not created.");
    const definition: CanopyProofEsgMetricDefinitionFact = { ...payload, auditEvent };
    this.storeDefinition(definition);
    this.eventsByStream.set(streamKey, [...events, auditEvent]);
    return definition;
  }

  projectDefinition(
    definitionId: string,
    methodologyProjection: CanopyProofMethodologyPublicationProjection,
    evaluatedAtInput: string,
  ): CanopyProofEsgMetricDefinitionProjection {
    const definition = this.getDefinition(definitionId);
    const evaluatedAt = canonicalTimestamp(evaluatedAtInput, "evaluatedAt");
    const definitions = this.definitionsBySlug.get(definitionStreamKey(definition.owner.id, definition.slug)) ?? [];
    const latest = definitions.at(-1);
    if (!latest) throw new Error(`CanopyProof ESG metric definition stream is empty: ${definition.slug}`);
    const issues: string[] = [];
    if (
      methodologyProjection.methodologyId !== definition.methodologyId ||
      methodologyProjection.publicationId !== definition.methodologyPublicationId ||
      methodologyProjection.publicationRoot !== definition.methodologyPublicationRoot ||
      methodologyProjection.state !== "published"
    ) {
      issues.push("methodology_not_current");
    }
    if (latest.id !== definition.id) issues.push("definition_superseded");
    const state: CanopyProofEsgMetricDefinitionState = issues.includes("methodology_not_current")
      ? "methodology_superseded"
      : issues.includes("definition_superseded")
        ? "superseded"
        : "current";
    const seed = {
      ownerOrganizationId: definition.owner.id,
      slug: definition.slug,
      definitionId: definition.id,
      definitionRoot: definition.definitionRoot,
      state,
      methodologyPublicationId: definition.methodologyPublicationId,
      methodologyPublicationRoot: definition.methodologyPublicationRoot,
      evaluatedAt,
      latestDefinitionId: latest.id,
      latestDefinitionRoot: latest.definitionRoot,
      issueCodes: issues.sort(),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-esg-metric-definition-projection-v1", ...seed }),
      safety: canopyProofEsgMetricSafetyBoundary(),
    };
  }

  recordResult(input: unknown, authority: CanopyProofEsgMetricResultAuthority): CanopyProofEsgMetricResultBundle {
    const parsed = resultInputSchema.parse(input);
    const definition = authority.definition;
    if (
      parsed.definitionId !== definition.id ||
      parsed.organizationId !== definition.owner.id ||
      authority.definitionProjection.definitionId !== definition.id ||
      authority.definitionProjection.definitionRoot !== definition.definitionRoot ||
      authority.definitionProjection.state !== "current"
    ) {
      throw new Error("CanopyProof ESG metric result requires a current definition authority.");
    }
    const calculator = normalizeAuthorizedActor(authority.calculator, "esg_metric:calculate", parsed.organizationId);
    const reviewer = normalizeAuthorizedActor(authority.reviewer, "esg_metric:review");
    if (calculator.id === reviewer.id) throw new Error("CanopyProof ESG metric calculator cannot review the same result.");
    const calculatedAt = canonicalTimestamp(parsed.calculatedAt, "calculatedAt");
    const reviewedAt = canonicalTimestamp(parsed.reviewedAt, "reviewedAt");
    if (Date.parse(calculatedAt) > Date.parse(reviewedAt)) {
      throw new Error("CanopyProof ESG metric review cannot predate calculation.");
    }
    const reportingPeriod = normalizePeriod(parsed.reportingPeriod, "reportingPeriod");
    const observationPeriod = normalizePeriod(parsed.observationPeriod, "observationPeriod");
    if (
      Date.parse(observationPeriod.startsAt) < Date.parse(reportingPeriod.startsAt) ||
      Date.parse(observationPeriod.endsAt) > Date.parse(reportingPeriod.endsAt) ||
      Date.parse(reportingPeriod.endsAt) > Date.parse(reviewedAt)
    ) {
      throw new Error("CanopyProof ESG metric observation and reporting periods are inconsistent.");
    }
    if (!definition.allowedUnits.includes(parsed.unit)) {
      throw new Error("CanopyProof ESG metric result unit is not allowed by the definition.");
    }
    const normalizedValue = normalizeMetricValue(parsed, definition);
    const uncertainty = normalizeResultUncertainty(parsed.uncertainty, normalizedValue.decimalValue, definition);
    const limitations = sortedUnique(parsed.limitations, "limitations");
    assertSafeText([
      parsed.reviewRationale,
      normalizedValue.withheldReason ?? "",
      normalizedValue.unavailableReason ?? "",
      uncertainty.kind === "not_quantified" ? uncertainty.reason : "",
      ...limitations,
    ]);
    const sourceRecordIds = sortedUnique(parsed.sourceRecordIds, "sourceRecordIds");
    if (authority.sources.length !== sourceRecordIds.length) {
      throw new Error("CanopyProof ESG metric result requires the complete declared source set.");
    }
    const sourceByRecordId = new Map(authority.sources.map((source) => [source.record.id, source] as const));
    if (
      sourceByRecordId.size !== authority.sources.length ||
      hashJson([...sourceByRecordId.keys()].sort()) !== hashJson(sourceRecordIds)
    ) {
      throw new Error("CanopyProof ESG metric result source set does not match resolved authority.");
    }
    const sourceSeeds = sourceRecordIds.map((recordId) =>
      resolveCanopyProofCanonicalEnvironmentalSource(sourceByRecordId.get(recordId), {
        organizationId: parsed.organizationId,
        projectId: parsed.projectId,
        evaluatedAt: reviewedAt,
      }),
    );
    const commandSeed = {
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      definitionId: definition.id,
      definitionRoot: definition.definitionRoot,
      definitionVersion: definition.version,
      reportingPeriod,
      observationPeriod,
      valueState: parsed.valueState,
      ...normalizedValue,
      unit: parsed.unit,
      uncertainty,
      calculationArtifactHash: parsed.calculationArtifactHash,
      calculator,
      reviewer,
      reviewRationale: parsed.reviewRationale,
      limitations,
      sources: sourceSeeds,
      calculatedAt,
      reviewedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-esg-metric-result-command-v1", ...commandSeed });
    const id = `cp_esg_metric_result_${commandHash.slice(0, 24)}`;
    const safety = canopyProofEsgMetricSafetyBoundary();
    const sources = sourceSeeds.map((source, memberIndex) => createResultSource(id, memberIndex, source, safety));
    const sourceMemberRoots = sources.map((source) => source.memberRoot);
    const sourceSetRoot = merkleRoot(sourceMemberRoots);
    const evidenceRoot = merkleRoot(sources.map((source) => source.evidenceRoot));
    const verificationRoot = merkleRoot(sources.map((source) => source.verificationRoot));
    const monitoringRoot = merkleRoot(sources.map((source) => source.monitoringRoot));
    const confidenceScore = Math.min(...sources.map((source) => source.confidenceScore));
    const events = this.eventsByStream.get(resultStreamKey(parsed.organizationId, parsed.projectId)) ?? [];
    const projectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const factSeed = {
      id,
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      definitionId: definition.id,
      definitionRoot: definition.definitionRoot,
      definitionVersion: definition.version,
      reportingPeriod,
      observationPeriod,
      valueState: parsed.valueState,
      ...normalizedValue,
      unit: parsed.unit,
      uncertainty,
      calculationArtifactHash: parsed.calculationArtifactHash,
      calculator,
      reviewer,
      reviewRationale: parsed.reviewRationale,
      limitations,
      sourceRecordIds: sources.map((source) => source.recordId),
      sourceMemberRoots,
      sourceCount: sources.length,
      sourceSetRoot,
      evidenceRoot,
      verificationRoot,
      monitoringRoot,
      confidenceScore,
      calculatedAt,
      reviewedAt,
      commandHash,
      projectSequence,
      previousEventRoot,
    };
    const resultHash = hashJson({ kind: "canopyproof-esg-metric-result-v1", ...factSeed });
    const resultRoot = hashJson({ kind: "canopyproof-esg-metric-result-root-v1", ...factSeed, resultHash });
    const payload = {
      factType: "esg_metric_result" as const,
      ...factSeed,
      resultHash,
      resultRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: reviewer.id,
      entityType: "esg_metric_result",
      entityId: id,
      payload,
      createdAt: reviewedAt,
      rationale: "An independent accredited human accepted an immutable route-closed ESG metric result.",
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof ESG metric result semantic event was not created.");
    const result: CanopyProofEsgMetricResultFact = { ...payload, auditEvent };
    this.storeResult(result, sources);
    this.eventsByStream.set(resultStreamKey(parsed.organizationId, parsed.projectId), [...events, auditEvent]);
    return { result, sources };
  }

  projectResult(
    resultId: string,
    definitionProjection: CanopyProofEsgMetricDefinitionProjection,
    currentSources: readonly CanopyProofCanonicalEsgSourceAuthority[],
    evaluatedAtInput: string,
  ): CanopyProofEsgMetricResultProjection {
    const { result, sources } = this.getResult(resultId);
    const evaluatedAt = canonicalTimestamp(evaluatedAtInput, "evaluatedAt");
    const sourceByRecordId = new Map(currentSources.map((source) => [source.record.id, source] as const));
    const issueCodes: string[] = [];
    const currentRoots: string[] = [];
    let currentSourceCount = 0;
    let challenged = false;
    let revoked = false;
    let expired = false;
    if (
      definitionProjection.definitionId !== result.definitionId ||
      definitionProjection.definitionRoot !== result.definitionRoot
    ) issueCodes.push("definition_projection_mismatch");
    if (definitionProjection.state === "superseded") issueCodes.push("definition_superseded");
    if (definitionProjection.state === "methodology_superseded") issueCodes.push("methodology_superseded");
    for (const member of sources) {
      const source = sourceByRecordId.get(member.recordId);
      if (!source) {
        issueCodes.push(`source_missing:${member.recordId}`);
        continue;
      }
      if (source.governedRecordProjection.state === "revoked") revoked = true;
      else if (source.governedRecordProjection.state === "challenged") challenged = true;
      if (source.lifecycleProjection.state === "expired") expired = true;
      const root = currentEnvironmentalSourceRoot(source);
      currentRoots.push(root);
      const exactBinding = sourceMatchesMember(source, member);
      const eligible = sourceIsCurrentlyEligible(source, evaluatedAt);
      if (!exactBinding) issueCodes.push(`source_binding_changed:${member.recordId}`);
      if (!eligible) issueCodes.push(`source_not_current:${member.recordId}`);
      if (exactBinding && eligible) currentSourceCount += 1;
    }
    if (sourceByRecordId.size !== currentSources.length) issueCodes.push("source_set_contains_duplicates");
    if (sourceByRecordId.size !== sources.length) issueCodes.push("source_set_cardinality_mismatch");
    const normalizedIssues = [...new Set(issueCodes)].sort();
    const state: CanopyProofEsgMetricResultState = revoked
      ? "revoked"
      : challenged
        ? "challenged"
        : expired
          ? "expired"
          : normalizedIssues.includes("methodology_superseded")
            ? "methodology_superseded"
            : normalizedIssues.includes("definition_superseded")
              ? "definition_superseded"
              : normalizedIssues.length > 0
                ? "source_stale"
                : "current";
    const seed = {
      organizationId: result.organizationId,
      projectId: result.projectId,
      resultId: result.id,
      resultRoot: result.resultRoot,
      definitionId: result.definitionId,
      definitionRoot: result.definitionRoot,
      state,
      evaluatedAt,
      sourceCount: sources.length,
      currentSourceCount,
      issueCodes: normalizedIssues,
      currentSourceRoot: merkleRoot(currentRoots.sort()),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-esg-metric-result-projection-v1", ...seed }),
      safety: canopyProofEsgMetricSafetyBoundary(),
    };
  }

  getDefinition(definitionId: string) {
    const definition = this.definitionsById.get(definitionId);
    if (!definition) throw new Error(`CanopyProof ESG metric definition not found: ${definitionId}`);
    return definition;
  }

  getResult(resultId: string): CanopyProofEsgMetricResultBundle {
    const result = this.resultsById.get(resultId);
    if (!result) throw new Error(`CanopyProof ESG metric result not found: ${resultId}`);
    return { result, sources: [...(this.sourcesByResultId.get(resultId) ?? [])] };
  }

  getAuthoritySnapshot(): CanopyProofEsgMetricAuthoritySnapshot {
    return {
      streamEvents: [...this.eventsByStream.values()].flatMap((events) => events),
      definitions: [...this.definitionsById.values()],
      results: [...this.resultsById.values()],
      resultSources: [...this.sourcesByResultId.values()].flatMap((sources) => sources),
    };
  }

  private replayDefinition(definition: CanopyProofEsgMetricDefinitionFact, allEvents: readonly CanopyProofAuditEvent[]) {
    const streamKey = definitionStreamKey(definition.owner.id, definition.slug);
    const events = this.eventsByStream.get(streamKey) ?? [];
    const priorDefinitions = this.definitionsBySlug.get(streamKey) ?? [];
    const predecessor = priorDefinitions.at(-1);
    validateDefinitionSupersession(definition.version, definition.supersedesDefinitionId, predecessor);
    if (
      (predecessor?.definitionRoot ?? undefined) !== definition.supersedesDefinitionRoot ||
      definition.definitionSequence !== events.length + 1
    ) {
      throw new Error(`CanopyProof ESG metric definition predecessor lineage is invalid: ${definition.id}`);
    }
    const expected = rebuildDefinition(definition, events);
    const event = allEvents.find((candidate) => candidate.eventRoot === definition.auditEvent.eventRoot);
    if (!event || hashJson(expected) !== hashJson(definition) || hashJson(event) !== hashJson(definition.auditEvent)) {
      throw new Error(`CanopyProof ESG metric definition lineage is invalid: ${definition.id}`);
    }
    this.storeDefinition(definition);
    this.eventsByStream.set(streamKey, [...events, event]);
  }

  private replayResult(
    result: CanopyProofEsgMetricResultFact,
    sourcesInput: readonly CanopyProofEsgMetricResultSourceFact[],
    allEvents: readonly CanopyProofAuditEvent[],
  ) {
    const streamKey = resultStreamKey(result.organizationId, result.projectId);
    const events = this.eventsByStream.get(streamKey) ?? [];
    const sources = [...sourcesInput].sort((left, right) => left.memberIndex - right.memberIndex);
    const definition = this.getDefinition(result.definitionId);
    if (definition.definitionRoot !== result.definitionRoot || definition.version !== result.definitionVersion) {
      throw new Error(`CanopyProof ESG metric result definition lineage is invalid: ${result.id}`);
    }
    const expected = rebuildResult(result, sources, events, definition);
    const event = allEvents.find((candidate) => candidate.eventRoot === result.auditEvent.eventRoot);
    if (!event || hashJson(expected) !== hashJson(result) || hashJson(event) !== hashJson(result.auditEvent)) {
      throw new Error(`CanopyProof ESG metric result lineage is invalid: ${result.id}`);
    }
    this.storeResult(result, sources);
    this.eventsByStream.set(streamKey, [...events, event]);
  }

  private storeDefinition(definition: CanopyProofEsgMetricDefinitionFact) {
    if (this.definitionsById.has(definition.id)) throw new Error(`CanopyProof ESG metric definition is duplicated: ${definition.id}`);
    const key = definitionStreamKey(definition.owner.id, definition.slug);
    this.definitionsById.set(definition.id, definition);
    this.definitionsBySlug.set(key, [...(this.definitionsBySlug.get(key) ?? []), definition]);
  }

  private storeResult(result: CanopyProofEsgMetricResultFact, sources: readonly CanopyProofEsgMetricResultSourceFact[]) {
    if (this.resultsById.has(result.id)) throw new Error(`CanopyProof ESG metric result is duplicated: ${result.id}`);
    const sourceIds = new Set(sources.map((source) => source.id));
    if (sources.length === 0 || sourceIds.size !== sources.length) {
      throw new Error(`CanopyProof ESG metric result source members are invalid: ${result.id}`);
    }
    this.resultsById.set(result.id, result);
    this.sourcesByResultId.set(result.id, [...sources]);
  }
}

export function canopyProofEsgMetricSafetyBoundary(): CanopyProofEsgMetricSafetyBoundary {
  return {
    immutableAuthority: true,
    exactDecimalRequired: true,
    explicitMissingValueStateRequired: true,
    currentMethodologyRequired: true,
    currentEnvironmentalProofRequired: true,
    activeSignedLifecycleRequired: true,
    reviewedMrvRequired: true,
    independentHumanReviewRequired: true,
    appendOnly: true,
    exactRetryRequired: true,
    tenantBound: true,
    routeMounted: false,
    productionActivationEnabled: false,
    frameworkPreparationOnly: true,
    notAssuranceOpinion: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function canonicalizeCanopyProofMetricDecimal(input: string, precisionScale: number, name = "decimal") {
  if (!Number.isInteger(precisionScale) || precisionScale < 0 || precisionScale > 12 || !decimalSchema.safeParse(input).success) {
    throw new Error(`CanopyProof ESG metric ${name} is not a bounded exact decimal.`);
  }
  if (/^-0(?:\.0+)?$/.test(input)) throw new Error(`CanopyProof ESG metric ${name} cannot be negative zero.`);
  const negative = input.startsWith("-");
  const unsigned = negative ? input.slice(1) : input;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  if (fraction.length > precisionScale) {
    throw new Error(`CanopyProof ESG metric ${name} exceeds definition precision.`);
  }
  const canonicalInteger = integer.replace(/^0+(?=\d)/, "");
  const canonicalFraction = fraction.replace(/0+$/, "");
  const canonical = `${negative ? "-" : ""}${canonicalInteger}${canonicalFraction ? `.${canonicalFraction}` : ""}`;
  return canonical === "-0" ? "0" : canonical;
}

export function compareCanopyProofMetricDecimals(left: string, right: string) {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  const scale = Math.max(leftParts.scale, rightParts.scale);
  const leftCoefficient = leftParts.coefficient * 10n ** BigInt(scale - leftParts.scale);
  const rightCoefficient = rightParts.coefficient * 10n ** BigInt(scale - rightParts.scale);
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0;
}

function normalizeOrganization(input: unknown): CanopyProofReportingOrganizationSnapshot {
  return organizationSchema.parse(input);
}

function normalizeAuthorizedActor(
  input: unknown,
  requiredScope: "esg_metric:govern" | "esg_metric:calculate" | "esg_metric:review",
  requiredOrganizationId?: string,
): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const scope = sortedUnique(parsed.accreditationScope, "accreditationScope");
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
    accreditationScope: scope,
  };
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (
    parsed.authorityRoot !== authorityRoot ||
    parsed.participantType !== "human" ||
    parsed.role === "agent" ||
    parsed.membershipStatus !== "active" ||
    parsed.accreditationStatus !== "approved" ||
    !scope.includes(requiredScope) ||
    (requiredOrganizationId !== undefined && parsed.organizationId !== requiredOrganizationId)
  ) {
    throw new Error(`CanopyProof ESG metric actor lacks ${requiredScope} authority: ${parsed.id}`);
  }
  return { ...normalized, authorityRoot };
}

function normalizeDefinitionReviewers(
  input: readonly CanopyProofVerificationActorSnapshot[],
  publisherId: string,
) {
  const reviewers = input.map((reviewer) => normalizeAuthorizedActor(reviewer, "esg_metric:govern"))
    .sort((left, right) => left.id.localeCompare(right.id));
  const reviewerIds = new Set(reviewers.map((reviewer) => reviewer.id));
  if (reviewers.length < 2 || reviewerIds.size !== reviewers.length || reviewerIds.has(publisherId)) {
    throw new Error("CanopyProof ESG metric definition requires two independent accredited human reviewers.");
  }
  return reviewers;
}

function validateMethodologyAuthority(
  bundle: CanopyProofMethodologyPublicationBundle,
  projection: CanopyProofMethodologyPublicationProjection,
  requestedPublicationId: string,
) {
  const bundleRoot = hashJson({
    kind: "canopyproof-methodology-publication-bundle-v1",
    methodologyHash: bundle.methodology.methodologyHash,
    methodologyEventRoot: bundle.methodology.auditEvent.eventRoot,
    policyRoot: bundle.policy.policyRoot,
    policyEventRoot: bundle.policy.auditEvent.eventRoot,
    approvalRoots: bundle.approvals.map((approval) => approval.approvalRoot).sort(),
    publicationRoot: bundle.publication.publicationRoot,
    publicationEventRoot: bundle.publication.auditEvent.eventRoot,
  });
  if (
    bundle.bundleRoot !== bundleRoot ||
    requestedPublicationId !== bundle.publication.id ||
    bundle.methodology.id !== bundle.publication.methodologyId ||
    bundle.methodology.methodologyHash !== bundle.publication.methodologyHash ||
    projection.methodologyId !== bundle.methodology.id ||
    projection.publicationId !== bundle.publication.id ||
    projection.publicationRoot !== bundle.publication.publicationRoot ||
    projection.state !== "published"
  ) {
    throw new Error("CanopyProof ESG metric definition requires a current governed methodology publication.");
  }
  return bundle;
}

function normalizeFrameworkMappings(input: readonly z.infer<typeof frameworkMappingSchema>[]) {
  const mappings = input.map((mapping) => {
    const limitations = sortedUnique(mapping.limitations, "framework mapping limitations");
    const seed = {
      framework: mapping.framework,
      disclosureCode: mapping.disclosureCode,
      status: "preparation_only" as const,
      rationale: mapping.rationale,
      limitations,
    };
    return {
      ...seed,
      mappingRoot: hashJson({ kind: "canopyproof-esg-metric-framework-mapping-v1", ...seed }),
    };
  }).sort((left, right) => left.framework.localeCompare(right.framework) || left.disclosureCode.localeCompare(right.disclosureCode));
  const keys = new Set(mappings.map((mapping) => `${mapping.framework}:${mapping.disclosureCode}`));
  if (keys.size !== mappings.length) throw new Error("CanopyProof ESG metric framework mappings contain duplicates.");
  return mappings;
}

function normalizeUncertaintyPolicy(input: z.infer<typeof definitionInputSchema>["uncertaintyPolicy"]): CanopyProofEsgMetricUncertaintyPolicy {
  const requiredComponents = sortedUnique(input.requiredComponents, "uncertainty components");
  if (input.method === "not_quantified" && !input.allowNotQuantified) {
    throw new Error("CanopyProof ESG metric not-quantified policy must explicitly permit that state.");
  }
  const seed = { method: input.method, allowNotQuantified: input.allowNotQuantified, requiredComponents };
  return { ...seed, policyRoot: hashJson({ kind: "canopyproof-esg-metric-uncertainty-policy-v1", ...seed }) };
}

function validateDefinitionSupersession(
  version: string,
  supersedesDefinitionId: string | undefined,
  predecessor: CanopyProofEsgMetricDefinitionFact | undefined,
) {
  if (!predecessor && supersedesDefinitionId) throw new Error("CanopyProof first ESG metric definition cannot supersede an unknown fact.");
  if (predecessor && supersedesDefinitionId !== predecessor.id) {
    throw new Error("CanopyProof ESG metric definition must supersede the current latest definition.");
  }
  if (predecessor && compareSemver(version, predecessor.version) <= 0) {
    throw new Error("CanopyProof ESG metric definition version must increase monotonically.");
  }
}

function normalizeMetricValue(
  input: z.infer<typeof resultInputSchema>,
  definition: CanopyProofEsgMetricDefinitionFact,
) {
  const decimalValue = input.decimalValue === undefined
    ? undefined
    : canonicalizeCanopyProofMetricDecimal(input.decimalValue, definition.precisionScale, "decimalValue");
  const detectionLimit = input.detectionLimit === undefined
    ? undefined
    : canonicalizeCanopyProofMetricDecimal(input.detectionLimit, definition.precisionScale, "detectionLimit");
  if (definition.valueDomain === "non_negative" && decimalValue && compareCanopyProofMetricDecimals(decimalValue, "0") < 0) {
    throw new Error("CanopyProof ESG metric value violates the non-negative definition domain.");
  }
  if (input.valueState === "reported") {
    if (decimalValue === undefined || detectionLimit || input.withheldReason || input.unavailableReason) {
      throw new Error("CanopyProof reported ESG metric requires exactly one decimal value.");
    }
    return { decimalValue };
  }
  if (input.valueState === "below_detection_limit") {
    if (decimalValue || !detectionLimit || input.withheldReason || input.unavailableReason || compareCanopyProofMetricDecimals(detectionLimit, "0") <= 0) {
      throw new Error("CanopyProof below-detection metric requires only a positive detection limit.");
    }
    return { detectionLimit };
  }
  if (input.valueState === "withheld") {
    if (decimalValue || detectionLimit || !input.withheldReason || input.unavailableReason) {
      throw new Error("CanopyProof withheld metric requires only a privacy-safe reason.");
    }
    return { withheldReason: input.withheldReason };
  }
  if (input.valueState === "unavailable") {
    if (decimalValue || detectionLimit || input.withheldReason || !input.unavailableReason) {
      throw new Error("CanopyProof unavailable metric requires only an explicit reason.");
    }
    return { unavailableReason: input.unavailableReason };
  }
  if (decimalValue || detectionLimit || input.withheldReason || input.unavailableReason) {
    throw new Error("CanopyProof not-applicable metric cannot carry a numeric or substitute value.");
  }
  return {};
}

function normalizeResultUncertainty(
  input: z.infer<typeof resultInputSchema>["uncertainty"],
  decimalValue: string | undefined,
  definition: CanopyProofEsgMetricDefinitionFact,
): CanopyProofEsgMetricUncertainty {
  const components = sortedUnique(input.components, "uncertainty components");
  const missingComponents = definition.uncertaintyPolicy.requiredComponents.filter((component) => !components.includes(component));
  if (missingComponents.length > 0) {
    throw new Error(`CanopyProof ESG metric uncertainty is missing components: ${missingComponents.join(",")}`);
  }
  if (input.kind === "not_quantified") {
    if (!definition.uncertaintyPolicy.allowNotQuantified) {
      throw new Error("CanopyProof ESG metric definition forbids unquantified uncertainty.");
    }
    const seed = { kind: input.kind, reason: input.reason, components };
    return {
      ...seed,
      uncertaintyRoot: hashJson({ kind: "canopyproof-esg-metric-uncertainty-v1", uncertainty: seed }),
    };
  }
  const lower = canonicalizeCanopyProofMetricDecimal(input.lower, definition.precisionScale, "uncertainty.lower");
  const upper = canonicalizeCanopyProofMetricDecimal(input.upper, definition.precisionScale, "uncertainty.upper");
  if (compareCanopyProofMetricDecimals(lower, upper) > 0) throw new Error("CanopyProof ESG metric uncertainty interval is inverted.");
  if (
    decimalValue !== undefined &&
    (compareCanopyProofMetricDecimals(decimalValue, lower) < 0 || compareCanopyProofMetricDecimals(decimalValue, upper) > 0)
  ) {
    throw new Error("CanopyProof ESG metric value is outside its uncertainty interval.");
  }
  const seed = { kind: input.kind, lower, upper, confidenceLevelPct: input.confidenceLevelPct, components };
  return {
    ...seed,
    uncertaintyRoot: hashJson({ kind: "canopyproof-esg-metric-uncertainty-v1", uncertainty: seed }),
  };
}

function createResultSource(
  resultId: string,
  memberIndex: number,
  source: CanopyProofCanonicalEnvironmentalSourceSeed,
  safety: CanopyProofEsgMetricSafetyBoundary,
): CanopyProofEsgMetricResultSourceFact {
  const seed = { resultId, memberIndex, ...source };
  const memberHash = hashJson({ kind: "canopyproof-esg-metric-source-member-v1", ...seed });
  const id = `cp_esg_metric_source_${memberHash.slice(0, 24)}`;
  const memberRoot = hashJson({ kind: "canopyproof-esg-metric-source-member-root-v1", id, ...seed, memberHash });
  return { factType: "esg_metric_result_source", id, ...seed, memberHash, memberRoot, safety };
}

function rebuildDefinition(
  definition: CanopyProofEsgMetricDefinitionFact,
  events: readonly CanopyProofAuditEvent[],
): CanopyProofEsgMetricDefinitionFact {
  validateDefinitionDerivedFields(definition);
  const commandSeed = definitionCommandSeed(definition);
  const commandHash = hashJson({ kind: "canopyproof-esg-metric-definition-command-v1", ...commandSeed });
  const id = `cp_esg_metric_definition_${commandHash.slice(0, 24)}`;
  const definitionSequence = events.length + 1;
  const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const factSeed = { id, ...commandSeed, commandHash, definitionSequence, previousEventRoot };
  const definitionHash = hashJson({ kind: "canopyproof-esg-metric-definition-v1", ...factSeed });
  const definitionRoot = hashJson({ kind: "canopyproof-esg-metric-definition-root-v1", ...factSeed, definitionHash });
  const safety = canopyProofEsgMetricSafetyBoundary();
  const payload = { factType: "esg_metric_definition" as const, ...factSeed, definitionHash, definitionRoot, safety };
  const auditEvent = appendCanopyProofAuditEvent(events, {
    action: "ASSERT",
    actor: definition.publisher.id,
    entityType: "esg_metric_definition",
    entityId: id,
    payload,
    createdAt: definition.effectiveAt,
    rationale: "Independent accredited humans published an immutable route-closed ESG metric definition.",
  }).at(-1);
  if (!auditEvent) throw new Error("CanopyProof ESG metric definition replay event is missing.");
  return { ...payload, auditEvent };
}

function rebuildResult(
  result: CanopyProofEsgMetricResultFact,
  sources: readonly CanopyProofEsgMetricResultSourceFact[],
  events: readonly CanopyProofAuditEvent[],
  definition: CanopyProofEsgMetricDefinitionFact,
): CanopyProofEsgMetricResultFact {
  if (sources.some((source, index) => !verifyResultSource(source, result.id, index))) {
    throw new Error(`CanopyProof ESG metric source member lineage is invalid: ${result.id}`);
  }
  validateResultDerivedFields(result, definition);
  const sourceSeeds = sources.map(sourceFactToSeed);
  const commandSeed = resultCommandSeed(result, sourceSeeds);
  const commandHash = hashJson({ kind: "canopyproof-esg-metric-result-command-v1", ...commandSeed });
  const id = `cp_esg_metric_result_${commandHash.slice(0, 24)}`;
  const projectSequence = events.length + 1;
  const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const sourceMemberRoots = sources.map((source) => source.memberRoot);
  const factSeed = {
    id,
    organizationId: result.organizationId,
    projectId: result.projectId,
    definitionId: result.definitionId,
    definitionRoot: result.definitionRoot,
    definitionVersion: result.definitionVersion,
    reportingPeriod: result.reportingPeriod,
    observationPeriod: result.observationPeriod,
    valueState: result.valueState,
    ...(result.decimalValue !== undefined ? { decimalValue: result.decimalValue } : {}),
    ...(result.detectionLimit !== undefined ? { detectionLimit: result.detectionLimit } : {}),
    ...(result.withheldReason !== undefined ? { withheldReason: result.withheldReason } : {}),
    ...(result.unavailableReason !== undefined ? { unavailableReason: result.unavailableReason } : {}),
    unit: result.unit,
    uncertainty: result.uncertainty,
    calculationArtifactHash: result.calculationArtifactHash,
    calculator: result.calculator,
    reviewer: result.reviewer,
    reviewRationale: result.reviewRationale,
    limitations: result.limitations,
    sourceRecordIds: sources.map((source) => source.recordId),
    sourceMemberRoots,
    sourceCount: sources.length,
    sourceSetRoot: merkleRoot(sourceMemberRoots),
    evidenceRoot: merkleRoot(sources.map((source) => source.evidenceRoot)),
    verificationRoot: merkleRoot(sources.map((source) => source.verificationRoot)),
    monitoringRoot: merkleRoot(sources.map((source) => source.monitoringRoot)),
    confidenceScore: Math.min(...sources.map((source) => source.confidenceScore)),
    calculatedAt: result.calculatedAt,
    reviewedAt: result.reviewedAt,
    commandHash,
    projectSequence,
    previousEventRoot,
  };
  const resultHash = hashJson({ kind: "canopyproof-esg-metric-result-v1", ...factSeed });
  const resultRoot = hashJson({ kind: "canopyproof-esg-metric-result-root-v1", ...factSeed, resultHash });
  const safety = canopyProofEsgMetricSafetyBoundary();
  const payload = { factType: "esg_metric_result" as const, ...factSeed, resultHash, resultRoot, safety };
  const auditEvent = appendCanopyProofAuditEvent(events, {
    action: "ASSERT",
    actor: result.reviewer.id,
    entityType: "esg_metric_result",
    entityId: id,
    payload,
    createdAt: result.reviewedAt,
    rationale: "An independent accredited human accepted an immutable route-closed ESG metric result.",
  }).at(-1);
  if (!auditEvent) throw new Error("CanopyProof ESG metric result replay event is missing.");
  return { ...payload, auditEvent };
}

function definitionCommandSeed(definition: CanopyProofEsgMetricDefinitionFact) {
  return {
    owner: definition.owner,
    slug: definition.slug,
    version: definition.version,
    title: definition.title,
    description: definition.description,
    dimension: definition.dimension,
    canonicalUnit: definition.canonicalUnit,
    allowedUnits: definition.allowedUnits,
    precisionScale: definition.precisionScale,
    valueDomain: definition.valueDomain,
    roundingMode: definition.roundingMode,
    aggregationMethod: definition.aggregationMethod,
    spatialAggregation: definition.spatialAggregation,
    temporalAggregation: definition.temporalAggregation,
    sourceRequirements: definition.sourceRequirements,
    uncertaintyPolicy: definition.uncertaintyPolicy,
    frameworkMappings: definition.frameworkMappings,
    methodologyId: definition.methodologyId,
    methodologyHash: definition.methodologyHash,
    methodologyPublicationId: definition.methodologyPublicationId,
    methodologyPublicationRoot: definition.methodologyPublicationRoot,
    methodologyPublicationBundleRoot: definition.methodologyPublicationBundleRoot,
    publisher: definition.publisher,
    reviewers: definition.reviewers,
    reviewerRoot: definition.reviewerRoot,
    limitations: definition.limitations,
    ...(definition.supersedesDefinitionId ? {
      supersedesDefinitionId: definition.supersedesDefinitionId,
      supersedesDefinitionRoot: definition.supersedesDefinitionRoot!,
    } : {}),
    effectiveAt: definition.effectiveAt,
  };
}

function validateDefinitionDerivedFields(definition: CanopyProofEsgMetricDefinitionFact) {
  const owner = normalizeOrganization(definition.owner);
  if (owner.id !== definition.owner.id) {
    throw new Error(`CanopyProof ESG metric definition owner lineage is invalid: ${definition.id}`);
  }
  const publisher = normalizeAuthorizedActor(definition.publisher, "esg_metric:govern", owner.id);
  const reviewers = normalizeDefinitionReviewers(definition.reviewers, publisher.id);
  const allowedUnits = sortedUnique(definition.allowedUnits, "allowedUnits");
  if (
    hashJson(allowedUnits) !== hashJson(definition.allowedUnits) ||
    !allowedUnits.includes(definition.canonicalUnit) ||
    allowedUnits.some((unit) => !unitsByDimension[definition.dimension].includes(unit))
  ) {
    throw new Error(`CanopyProof ESG metric definition unit lineage is invalid: ${definition.id}`);
  }
  if (hashJson(definition.sourceRequirements) !== hashJson(requiredSourceRequirements)) {
    throw new Error(`CanopyProof ESG metric definition source requirements are invalid: ${definition.id}`);
  }
  const uncertaintySeed = {
    method: definition.uncertaintyPolicy.method,
    allowNotQuantified: definition.uncertaintyPolicy.allowNotQuantified,
    requiredComponents: sortedUnique(definition.uncertaintyPolicy.requiredComponents, "uncertainty components"),
  };
  if (
    hashJson(uncertaintySeed.requiredComponents) !== hashJson(definition.uncertaintyPolicy.requiredComponents) ||
    definition.uncertaintyPolicy.policyRoot !== hashJson({
      kind: "canopyproof-esg-metric-uncertainty-policy-v1",
      ...uncertaintySeed,
    })
  ) {
    throw new Error(`CanopyProof ESG metric definition uncertainty policy is invalid: ${definition.id}`);
  }
  const mappings = normalizeFrameworkMappings(definition.frameworkMappings.map((mapping) => ({
    framework: mapping.framework,
    disclosureCode: mapping.disclosureCode,
    rationale: mapping.rationale,
    limitations: [...mapping.limitations],
  })));
  if (
    hashJson(mappings) !== hashJson(definition.frameworkMappings) ||
    merkleRoot(reviewers.map((reviewer) => reviewer.authorityRoot)) !== definition.reviewerRoot ||
    hashJson(publisher) !== hashJson(definition.publisher) ||
    hashJson(reviewers) !== hashJson(definition.reviewers) ||
    hashJson(canopyProofEsgMetricSafetyBoundary()) !== hashJson(definition.safety)
  ) {
    throw new Error(`CanopyProof ESG metric definition derived lineage is invalid: ${definition.id}`);
  }
  canonicalTimestamp(definition.effectiveAt, "effectiveAt");
  assertSafeText([
    definition.title,
    definition.description,
    ...definition.limitations,
    ...definition.frameworkMappings.flatMap((mapping) => [mapping.rationale, ...mapping.limitations]),
  ]);
}

function validateResultDerivedFields(
  result: CanopyProofEsgMetricResultFact,
  definition: CanopyProofEsgMetricDefinitionFact,
) {
  const calculator = normalizeAuthorizedActor(result.calculator, "esg_metric:calculate", result.organizationId);
  const reviewer = normalizeAuthorizedActor(result.reviewer, "esg_metric:review");
  if (
    calculator.id === reviewer.id ||
    hashJson(calculator) !== hashJson(result.calculator) ||
    hashJson(reviewer) !== hashJson(result.reviewer)
  ) {
    throw new Error(`CanopyProof ESG metric result reviewer lineage is invalid: ${result.id}`);
  }
  const uncertainty = recomputeStoredUncertainty(result.uncertainty);
  if (hashJson(uncertainty) !== hashJson(result.uncertainty)) {
    throw new Error(`CanopyProof ESG metric result uncertainty lineage is invalid: ${result.id}`);
  }
  normalizePeriod(result.reportingPeriod, "reportingPeriod");
  normalizePeriod(result.observationPeriod, "observationPeriod");
  canonicalTimestamp(result.calculatedAt, "calculatedAt");
  canonicalTimestamp(result.reviewedAt, "reviewedAt");
  if (!definition.allowedUnits.includes(result.unit)) {
    throw new Error(`CanopyProof ESG metric result unit lineage is invalid: ${result.id}`);
  }
  if (result.decimalValue !== undefined) {
    const decimalValue = canonicalizeCanopyProofMetricDecimal(
      result.decimalValue,
      definition.precisionScale,
      "decimalValue",
    );
    if (
      decimalValue !== result.decimalValue ||
      (definition.valueDomain === "non_negative" && compareCanopyProofMetricDecimals(decimalValue, "0") < 0)
    ) {
      throw new Error(`CanopyProof ESG metric result decimal lineage is invalid: ${result.id}`);
    }
  }
  if (result.detectionLimit !== undefined) {
    const detectionLimit = canonicalizeCanopyProofMetricDecimal(
      result.detectionLimit,
      definition.precisionScale,
      "detectionLimit",
    );
    if (detectionLimit !== result.detectionLimit || compareCanopyProofMetricDecimals(detectionLimit, "0") <= 0) {
      throw new Error(`CanopyProof ESG metric result detection-limit lineage is invalid: ${result.id}`);
    }
  }
  if (result.uncertainty.kind === "interval") {
    const lower = canonicalizeCanopyProofMetricDecimal(
      result.uncertainty.lower,
      definition.precisionScale,
      "uncertainty.lower",
    );
    const upper = canonicalizeCanopyProofMetricDecimal(
      result.uncertainty.upper,
      definition.precisionScale,
      "uncertainty.upper",
    );
    if (
      lower !== result.uncertainty.lower ||
      upper !== result.uncertainty.upper ||
      compareCanopyProofMetricDecimals(lower, upper) > 0 ||
      (result.decimalValue !== undefined &&
        (compareCanopyProofMetricDecimals(result.decimalValue, lower) < 0 ||
          compareCanopyProofMetricDecimals(result.decimalValue, upper) > 0))
    ) {
      throw new Error(`CanopyProof ESG metric result interval lineage is invalid: ${result.id}`);
    }
  } else if (!definition.uncertaintyPolicy.allowNotQuantified) {
    throw new Error(`CanopyProof ESG metric result uncertainty policy is invalid: ${result.id}`);
  }
  const missingComponents = definition.uncertaintyPolicy.requiredComponents.filter(
    (component) => !result.uncertainty.components.includes(component),
  );
  if (missingComponents.length > 0) {
    throw new Error(`CanopyProof ESG metric result uncertainty components are invalid: ${result.id}`);
  }
  if (
    result.valueState === "reported"
      ? result.decimalValue === undefined || result.detectionLimit !== undefined || result.withheldReason !== undefined || result.unavailableReason !== undefined
      : result.valueState === "below_detection_limit"
        ? result.decimalValue !== undefined || result.detectionLimit === undefined || result.withheldReason !== undefined || result.unavailableReason !== undefined
        : result.valueState === "withheld"
          ? result.decimalValue !== undefined || result.detectionLimit !== undefined || result.withheldReason === undefined || result.unavailableReason !== undefined
          : result.valueState === "unavailable"
            ? result.decimalValue !== undefined || result.detectionLimit !== undefined || result.withheldReason !== undefined || result.unavailableReason === undefined
            : result.decimalValue !== undefined || result.detectionLimit !== undefined || result.withheldReason !== undefined || result.unavailableReason !== undefined
  ) {
    throw new Error(`CanopyProof ESG metric result value-state lineage is invalid: ${result.id}`);
  }
  assertSafeText([
    result.reviewRationale,
    result.withheldReason ?? "",
    result.unavailableReason ?? "",
    result.uncertainty.kind === "not_quantified" ? result.uncertainty.reason : "",
    ...result.limitations,
  ]);
  if (hashJson(canopyProofEsgMetricSafetyBoundary()) !== hashJson(result.safety)) {
    throw new Error(`CanopyProof ESG metric result safety lineage is invalid: ${result.id}`);
  }
}

function recomputeStoredUncertainty(input: CanopyProofEsgMetricUncertainty): CanopyProofEsgMetricUncertainty {
  if (input.kind === "not_quantified") {
    const seed = {
      kind: input.kind,
      reason: input.reason,
      components: sortedUnique(input.components, "uncertainty components"),
    };
    return {
      ...seed,
      uncertaintyRoot: hashJson({ kind: "canopyproof-esg-metric-uncertainty-v1", uncertainty: seed }),
    };
  }
  const seed = {
    kind: input.kind,
    lower: input.lower,
    upper: input.upper,
    confidenceLevelPct: input.confidenceLevelPct,
    components: sortedUnique(input.components, "uncertainty components"),
  };
  return {
    ...seed,
    uncertaintyRoot: hashJson({ kind: "canopyproof-esg-metric-uncertainty-v1", uncertainty: seed }),
  };
}

function resultCommandSeed(
  result: CanopyProofEsgMetricResultFact,
  sources: readonly CanopyProofCanonicalEnvironmentalSourceSeed[],
) {
  return {
    organizationId: result.organizationId,
    projectId: result.projectId,
    definitionId: result.definitionId,
    definitionRoot: result.definitionRoot,
    definitionVersion: result.definitionVersion,
    reportingPeriod: result.reportingPeriod,
    observationPeriod: result.observationPeriod,
    valueState: result.valueState,
    ...(result.decimalValue !== undefined ? { decimalValue: result.decimalValue } : {}),
    ...(result.detectionLimit !== undefined ? { detectionLimit: result.detectionLimit } : {}),
    ...(result.withheldReason !== undefined ? { withheldReason: result.withheldReason } : {}),
    ...(result.unavailableReason !== undefined ? { unavailableReason: result.unavailableReason } : {}),
    unit: result.unit,
    uncertainty: result.uncertainty,
    calculationArtifactHash: result.calculationArtifactHash,
    calculator: result.calculator,
    reviewer: result.reviewer,
    reviewRationale: result.reviewRationale,
    limitations: result.limitations,
    sources,
    calculatedAt: result.calculatedAt,
    reviewedAt: result.reviewedAt,
  };
}

function verifyResultSource(source: CanopyProofEsgMetricResultSourceFact, resultId: string, memberIndex: number) {
  if (
    source.factType !== "esg_metric_result_source" ||
    source.resultId !== resultId ||
    source.memberIndex !== memberIndex ||
    hashJson(source.safety) !== hashJson(canopyProofEsgMetricSafetyBoundary())
  ) return false;
  const seed = { resultId, memberIndex, ...sourceFactToSeed(source) };
  const memberHash = hashJson({ kind: "canopyproof-esg-metric-source-member-v1", ...seed });
  const id = `cp_esg_metric_source_${memberHash.slice(0, 24)}`;
  const memberRoot = hashJson({ kind: "canopyproof-esg-metric-source-member-root-v1", id, ...seed, memberHash });
  return source.id === id && source.memberHash === memberHash && source.memberRoot === memberRoot;
}

function sourceFactToSeed(source: CanopyProofEsgMetricResultSourceFact): CanopyProofCanonicalEnvironmentalSourceSeed {
  return {
    organizationId: source.organizationId,
    projectId: source.projectId,
    recordId: source.recordId,
    recordRoot: source.recordRoot,
    governedRecordProjectionRoot: source.governedRecordProjectionRoot,
    lifecycleBindingId: source.lifecycleBindingId,
    lifecycleBindingRoot: source.lifecycleBindingRoot,
    lifecycleProjectionRoot: source.lifecycleProjectionRoot,
    signingKeyAuthorityId: source.signingKeyAuthorityId,
    signingKeyRoot: source.signingKeyRoot,
    signatureReceiptId: source.signatureReceiptId,
    signatureReceiptRoot: source.signatureReceiptRoot,
    mrvSnapshotId: source.mrvSnapshotId,
    mrvSnapshotRoot: source.mrvSnapshotRoot,
    evidenceRoot: source.evidenceRoot,
    verificationRoot: source.verificationRoot,
    monitoringRoot: source.monitoringRoot,
    confidenceScore: source.confidenceScore,
  };
}

function sourceMatchesMember(
  source: CanopyProofCanonicalEsgSourceAuthority,
  member: CanopyProofEsgMetricResultSourceFact,
) {
  return source.record.id === member.recordId &&
    source.record.recordRoot === member.recordRoot &&
    source.governedRecordProjection.projectionRoot === member.governedRecordProjectionRoot &&
    source.lifecycleBinding.id === member.lifecycleBindingId &&
    source.lifecycleBinding.bindingRoot === member.lifecycleBindingRoot &&
    source.lifecycleProjection.projectionRoot === member.lifecycleProjectionRoot &&
    source.signatureReceipt.id === member.signatureReceiptId &&
    source.signatureReceipt.receiptRoot === member.signatureReceiptRoot &&
    source.lifecycleBinding.mrvSnapshotId === member.mrvSnapshotId &&
    source.lifecycleBinding.mrvSnapshotRoot === member.mrvSnapshotRoot;
}

function sourceIsCurrentlyEligible(source: CanopyProofCanonicalEsgSourceAuthority, evaluatedAt: string) {
  return source.governedRecordProjection.state === "issued" &&
    source.governedRecordProjection.sourceAuthorityCurrent &&
    source.lifecycleProjection.evaluatedAt === evaluatedAt &&
    source.lifecycleProjection.state === "active" &&
    source.lifecycleProjection.sourceAuthorityCurrent &&
    source.lifecycleProjection.boundMrvSnapshotCurrent &&
    source.lifecycleProjection.signatureVerified &&
    source.lifecycleProjection.validityCurrent;
}

function currentEnvironmentalSourceRoot(source: CanopyProofCanonicalEsgSourceAuthority) {
  return hashJson({
    kind: "canopyproof-esg-metric-current-source-v1",
    recordId: source.record.id,
    recordRoot: source.record.recordRoot,
    governedRecordProjectionRoot: source.governedRecordProjection.projectionRoot,
    lifecycleBindingId: source.lifecycleBinding.id,
    lifecycleBindingRoot: source.lifecycleBinding.bindingRoot,
    lifecycleProjectionRoot: source.lifecycleProjection.projectionRoot,
    signatureReceiptId: source.signatureReceipt.id,
    signatureReceiptRoot: source.signatureReceipt.receiptRoot,
  });
}

function normalizePeriod(input: { readonly startsAt: string; readonly endsAt: string }, name: string) {
  const startsAt = canonicalTimestamp(input.startsAt, `${name}.startsAt`);
  const endsAt = canonicalTimestamp(input.endsAt, `${name}.endsAt`);
  if (Date.parse(startsAt) > Date.parse(endsAt)) throw new Error(`CanopyProof ESG metric ${name} is inverted.`);
  return { startsAt, endsAt };
}

function canonicalTimestamp(input: string, name: string) {
  const timestamp = timestampSchema.parse(input);
  if (new Date(timestamp).toISOString() !== timestamp) throw new Error(`CanopyProof ESG metric ${name} is not canonical.`);
  return timestamp;
}

function sortedUnique<T extends string>(input: readonly T[], name: string): T[] {
  const values = [...input].sort((left, right) => left.localeCompare(right));
  if (new Set(values).size !== values.length) throw new Error(`CanopyProof ESG metric ${name} contains duplicates.`);
  return values;
}

function assertSafeText(values: readonly string[]) {
  for (const value of values) {
    for (const pattern of unsafeTextPatterns) {
      if (pattern.test(value) && !/\bnot\b/i.test(value)) {
        throw new Error(`CanopyProof ESG metric input contains unsupported claim: ${value}`);
      }
    }
  }
}

function compareSemver(left: string, right: string) {
  const leftParts = left.slice(1).split(".").map(Number);
  const rightParts = right.slice(1).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function decimalParts(input: string) {
  if (!decimalSchema.safeParse(input).success) throw new Error("CanopyProof ESG metric decimal comparison input is invalid.");
  const negative = input.startsWith("-");
  const unsigned = negative ? input.slice(1) : input;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const digits = `${integer}${fraction}`;
  const coefficient = BigInt(digits) * (negative ? -1n : 1n);
  return { coefficient, scale: fraction.length };
}

function definitionStreamKey(organizationId: string, slug: string) {
  return `esg-metric-definition:${organizationId.length}:${organizationId}${slug.length}:${slug}`;
}

function resultStreamKey(organizationId: string, projectId: string) {
  return `esg-metric-result:${organizationId.length}:${organizationId}${projectId.length}:${projectId}`;
}

function groupBy<T>(values: readonly T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const value of values) grouped.set(key(value), [...(grouped.get(key(value)) ?? []), value]);
  return grouped;
}
