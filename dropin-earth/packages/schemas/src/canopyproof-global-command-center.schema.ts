import { z } from "zod";

export const canopyProofGlobalCommandCenterApiVersion =
  "canopyproof.global-command-center.v2" as const;

export const canopyProofGlobalCommandCenterAuthorities = [
  "postgresql_append_only_snapshot",
  "process_local_compatibility",
] as const;

export const canopyProofGlobalCommandCenterSafetyDisclosure =
  "CanopyProof Global Impact Command Center is a read-only operational view. It does not issue certified carbon credits, tax offsets, financial assets, mainnet fund movements, guaranteed yield, or automatic CANOPY distributions." as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const boundedTextSchema = z.string().trim().min(1).max(512);
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const decimalSchema = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const usdSchema = z.string().regex(/^(0|[1-9]\d{0,20})(\.\d{1,2})?$/);
const latitudeDegreeSchema = z.number().int().min(-90).max(90);
const longitudeDegreeSchema = z.number().int().min(-180).max(179);

const spatialDisclosureFields = {
  regionId: identifierSchema,
  centroid: z
    .object({
      latitudeDegrees: latitudeDegreeSchema,
      longitudeDegrees: longitudeDegreeSchema,
    })
    .strict(),
  precisionDegrees: z.literal(1),
  sourceProjectCount: countSchema.min(3),
  minimumCohortSize: z.literal(3),
  regionSourceRoot: hashSchema,
  privacyReviewRoot: hashSchema,
  safeguardingReviewRoot: hashSchema,
  validFrom: timestampSchema,
  validUntil: timestampSchema,
} as const;

function validateSpatialDisclosure(
  value: {
    readonly privacyReviewRoot: string;
    readonly safeguardingReviewRoot: string;
    readonly validFrom: string;
    readonly validUntil: string;
  },
  context: z.RefinementCtx,
) {
  if (/^0{64}$/.test(value.privacyReviewRoot) || /^0{64}$/.test(value.safeguardingReviewRoot)) {
    context.addIssue({ code: "custom", message: "Spatial review roots must be non-zero." });
  }
  if (value.privacyReviewRoot === value.safeguardingReviewRoot) {
    context.addIssue({ code: "custom", message: "Spatial privacy and safeguarding reviews must be independent." });
  }
  if (Date.parse(value.validFrom) >= Date.parse(value.validUntil)) {
    context.addIssue({ code: "custom", message: "Spatial disclosure validity interval is invalid." });
  }
}

export const canopyProofGlobalCommandCenterSpatialDisclosureCommitmentSchema = z
  .object(spatialDisclosureFields)
  .strict()
  .superRefine(validateSpatialDisclosure);

export const canopyProofGlobalCommandCenterSpatialDisclosureSchema = z
  .object({
    ...spatialDisclosureFields,
    disclosureRoot: hashSchema,
  })
  .strict()
  .superRefine(validateSpatialDisclosure);

export const canopyProofGlobalCommandCenterSpatialSchema = z.discriminatedUnion("visibility", [
  z
    .object({
      visibility: z.literal("withheld"),
      reason: z.literal("no_approved_disclosure"),
      minimumCohortSize: z.literal(3),
      spatialRoot: hashSchema,
    })
    .strict(),
  z
    .object({
      visibility: z.literal("generalized"),
      basis: z.literal("approved_regional_disclosure_v1"),
      ...spatialDisclosureFields,
      disclosureRoot: hashSchema,
      spatialRoot: hashSchema,
    })
    .strict()
    .superRefine(validateSpatialDisclosure),
]);

export const canopyProofGlobalCommandCenterIndicatorSchema = z
  .object({
    key: boundedTextSchema,
    projectCount: countSchema,
    monitoringEventCount: countSchema,
    totalCount: countSchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterRegionSchema = z
  .object({
    regionId: identifierSchema,
    projectCount: countSchema,
    activeProjectCount: countSchema,
    challengedProjectCount: countSchema,
    targetTreeCount: countSchema,
    areaHectares: decimalSchema,
    evidenceCount: countSchema,
    proofRecordCount: countSchema,
    issuedProofRecordCount: countSchema,
    monitoringEventCount: countSchema,
    acceptedMonitoringEventCount: countSchema,
    terraSceneCount: countSchema,
    activeRiskAlertCount: countSchema,
    fundingAllocatedUsd: usdSchema,
    fundingSettledUsd: usdSchema,
    sourceRoot: hashSchema,
    spatial: canopyProofGlobalCommandCenterSpatialSchema,
    regionRoot: hashSchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterActivitySchema = z
  .object({
    id: identifierSchema,
    kind: z.enum([
      "project_monitoring",
      "proof_record",
      "terra_scene",
      "risk_alert",
      "funding_milestone",
    ]),
    projectId: identifierSchema.optional(),
    regionId: identifierSchema.optional(),
    happenedAt: timestampSchema,
    state: identifierSchema,
    summary: boundedTextSchema,
    hash: hashSchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterMetricsSchema = z
  .object({
    projectCount: countSchema,
    activeProjectCount: countSchema,
    monitoredProjectCount: countSchema,
    challengedProjectCount: countSchema,
    targetTreeCount: countSchema,
    areaHectares: decimalSchema,
    evidenceCount: countSchema,
    acceptedEvidenceCount: countSchema,
    proofRecordCount: countSchema,
    issuedProofRecordCount: countSchema,
    challengedProofRecordCount: countSchema,
    terraLayerCount: countSchema,
    terraSceneCount: countSchema,
    acceptedTerraRunCount: countSchema,
    needsReviewTerraRunCount: countSchema,
    activeRiskAlertCount: countSchema,
    criticalRiskAlertCount: countSchema,
    fundingCommittedUsd: usdSchema,
    fundingAllocatedUsd: usdSchema,
    fundingSettledUsd: usdSchema,
    fundingChallengedUsd: usdSchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterLineageSchema = z
  .object({
    projectRoot: hashSchema,
    monitoringRoot: hashSchema,
    evidenceRoot: hashSchema,
    proofRecordRoot: hashSchema,
    proofChallengeRoot: hashSchema,
    terraSceneRoot: hashSchema,
    riskSignalRoot: hashSchema,
    riskAlertRoot: hashSchema,
    fundingLedgerRoot: hashSchema,
    regionRoot: hashSchema,
    dashboardRoot: hashSchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterSafetySchema = z
  .object({
    readOnly: z.literal(true),
    humanReviewRequiredForFinalProof: z.literal(true),
    aiAdvisoryOnly: z.literal(true),
    noMainnetFunds: z.literal(true),
    noAutomaticCanopyDistribution: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    disclosure: z.literal(canopyProofGlobalCommandCenterSafetyDisclosure),
  })
  .strict();

export const canopyProofGlobalCommandCenterSnapshotSchema = z
  .object({
    service: z.literal("canopyproof-global-impact-command-center"),
    generatedAt: timestampSchema,
    metrics: canopyProofGlobalCommandCenterMetricsSchema,
    regions: z.array(canopyProofGlobalCommandCenterRegionSchema).max(512),
    impactIndicators: z
      .object({
        biodiversity: z.array(canopyProofGlobalCommandCenterIndicatorSchema).max(256),
        water: z.array(canopyProofGlobalCommandCenterIndicatorSchema).max(256),
        climateRisk: z.array(canopyProofGlobalCommandCenterIndicatorSchema).max(256),
      })
      .strict(),
    recentActivity: z.array(canopyProofGlobalCommandCenterActivitySchema).max(12),
    lineage: canopyProofGlobalCommandCenterLineageSchema,
    safety: canopyProofGlobalCommandCenterSafetySchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterResponseSchema = z
  .object({
    ok: z.literal(true),
    apiVersion: z.literal(canopyProofGlobalCommandCenterApiVersion),
    authority: z.enum(canopyProofGlobalCommandCenterAuthorities),
    data: canopyProofGlobalCommandCenterSnapshotSchema,
  })
  .strict();

export const canopyProofGlobalCommandCenterErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z.enum([
      "CANOPYPROOF_AUTH_REQUIRED",
      "CANOPYPROOF_RBAC_DENIED",
      "CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE",
      "CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID",
      "CANOPYPROOF_RATE_LIMITED",
    ]),
  })
  .passthrough();

export type CanopyProofGlobalCommandCenterAuthority =
  (typeof canopyProofGlobalCommandCenterAuthorities)[number];
export type CanopyProofGlobalCommandCenterIndicator = z.output<
  typeof canopyProofGlobalCommandCenterIndicatorSchema
>;
export type CanopyProofGlobalCommandCenterRegion = z.output<
  typeof canopyProofGlobalCommandCenterRegionSchema
>;
export type CanopyProofGlobalCommandCenterSpatialDisclosure = z.output<
  typeof canopyProofGlobalCommandCenterSpatialDisclosureSchema
>;
export type CanopyProofGlobalCommandCenterSpatialDisclosureCommitment = z.output<
  typeof canopyProofGlobalCommandCenterSpatialDisclosureCommitmentSchema
>;
export type CanopyProofGlobalCommandCenterSpatial = z.output<
  typeof canopyProofGlobalCommandCenterSpatialSchema
>;
export type CanopyProofGlobalCommandCenterActivity = z.output<
  typeof canopyProofGlobalCommandCenterActivitySchema
>;
export type CanopyProofGlobalCommandCenterSnapshot = z.output<
  typeof canopyProofGlobalCommandCenterSnapshotSchema
>;
export type CanopyProofGlobalCommandCenterResponse = z.output<
  typeof canopyProofGlobalCommandCenterResponseSchema
>;
