import { z } from "zod";

export const canopyProofPublicExplorerStates = [
  "active",
  "challenged",
  "suspended",
  "revoked",
  "expired",
  "superseded",
  "stale",
] as const;

export const canopyProofPublicExplorerAreaBands = [
  "withheld",
  "under_10_ha",
  "10_to_100_ha",
  "100_to_1000_ha",
  "over_1000_ha",
] as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const boundedIdentifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const publicOrganizationIdSchema = z.string().regex(/^cp_public_org_[a-f0-9]{24}$/);
const publicProjectIdSchema = z.string().regex(/^cp_public_project_[a-f0-9]{24}$/);
const publicationIdSchema = z.string().regex(/^cp_public_transparency_[a-f0-9]{24}$/);
const issueCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,95}$/);

export const canopyProofPublicExplorerSafetySchema = z
  .object({
    canonical: z.literal(true),
    durable: z.literal(true),
    anonymousMutationAllowed: z.literal(false),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
  })
  .strict();

const locationSchema = z
  .object({
    disclosure: z.enum(["region", "withheld"]),
    sourceRegionIdHash: hashSchema,
    regionId: boundedIdentifierSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disclosure === "region" && value.regionId === undefined) {
      context.addIssue({ code: "custom", path: ["regionId"], message: "Region disclosure requires regionId." });
    }
    if (value.disclosure === "withheld" && value.regionId !== undefined) {
      context.addIssue({ code: "custom", path: ["regionId"], message: "Withheld location cannot expose regionId." });
    }
  });

export const canopyProofPublicExplorerProjectSchema = z
  .object({
    publicOrganizationId: publicOrganizationIdSchema,
    publicProjectId: publicProjectIdSchema,
    publicationId: publicationIdSchema,
    state: z.enum(canopyProofPublicExplorerStates),
    recordIssuedOn: daySchema,
    observationPeriod: z
      .object({ startsOn: daySchema, endsOn: daySchema })
      .strict(),
    validity: z
      .object({ validFrom: timestampSchema, expiresAt: timestampSchema })
      .strict(),
    methodology: z
      .object({ id: boundedIdentifierSchema, methodologyHash: hashSchema, publicationRoot: hashSchema })
      .strict(),
    location: locationSchema,
    areaBand: z.enum(canopyProofPublicExplorerAreaBands),
    evidence: z.object({ count: z.number().int().nonnegative(), root: hashSchema }).strict(),
    verification: z.object({ count: z.number().int().nonnegative(), root: hashSchema }).strict(),
    monitoring: z.object({ count: z.number().int().nonnegative(), root: hashSchema }).strict(),
    governance: z.object({ approvalCount: z.number().int().nonnegative(), quorumRoot: hashSchema }).strict(),
    confidenceBand: z.enum(["limited", "moderate", "high"]),
    challenge: z
      .object({
        state: z.enum(["open", "under_review", "resolved", "rejected"]).optional(),
        root: hashSchema.optional(),
        resolutionRoot: hashSchema.optional(),
      })
      .strict(),
    issueCodes: z.array(issueCodeSchema).max(64),
    limitationCount: z.number().int().nonnegative(),
    limitationRoot: hashSchema,
  })
  .strict();

export const canopyProofPublicExplorerLineageSchema = z
  .object({
    recordRoot: hashSchema,
    publicationRoot: hashSchema,
    currentGovernedRecordProjectionRoot: hashSchema,
    currentLifecycleProjectionRoot: hashSchema,
    projectionRoot: hashSchema,
  })
  .strict();

export const canopyProofPublicExplorerSnapshotSchema = z
  .object({
    project: canopyProofPublicExplorerProjectSchema,
    lineage: canopyProofPublicExplorerLineageSchema,
  })
  .strict();

export const canopyProofPublicExplorerProjectResponseSchema = z
  .object({
    apiVersion: z.literal("canopyproof.public-explorer.v1"),
    evaluatedAt: timestampSchema,
    project: canopyProofPublicExplorerProjectSchema,
    lineage: canopyProofPublicExplorerLineageSchema,
    safety: canopyProofPublicExplorerSafetySchema,
  })
  .strict();

export const canopyProofPublicExplorerHistoryResponseSchema = z
  .object({
    apiVersion: z.literal("canopyproof.public-explorer.v1"),
    evaluatedAt: timestampSchema,
    items: z.array(canopyProofPublicExplorerSnapshotSchema).max(50),
    nextCursor: publicationIdSchema.nullable(),
    safety: canopyProofPublicExplorerSafetySchema,
  })
  .strict();

export const canopyProofPublicExplorerVerificationResponseSchema = z
  .object({
    apiVersion: z.literal("canopyproof.public-explorer.v1"),
    evaluatedAt: timestampSchema,
    verified: z.literal(true),
    project: canopyProofPublicExplorerProjectSchema,
    lineage: canopyProofPublicExplorerLineageSchema,
    safety: canopyProofPublicExplorerSafetySchema,
  })
  .strict();

export const canopyProofPublicExplorerErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z.enum([
      "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND",
      "CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED",
      "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID",
      "CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED",
      "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID",
    ]),
  })
  .strict();

export type CanopyProofPublicExplorerState = (typeof canopyProofPublicExplorerStates)[number];
export type CanopyProofPublicExplorerSafety = z.output<typeof canopyProofPublicExplorerSafetySchema>;
export type CanopyProofPublicExplorerProject = z.output<typeof canopyProofPublicExplorerProjectSchema>;
export type CanopyProofPublicExplorerLineage = z.output<typeof canopyProofPublicExplorerLineageSchema>;
export type CanopyProofPublicExplorerSnapshot = z.output<typeof canopyProofPublicExplorerSnapshotSchema>;
export type CanopyProofPublicExplorerProjectResponse = z.output<
  typeof canopyProofPublicExplorerProjectResponseSchema
>;
export type CanopyProofPublicExplorerHistoryResponse = z.output<
  typeof canopyProofPublicExplorerHistoryResponseSchema
>;
export type CanopyProofPublicExplorerVerificationResponse = z.output<
  typeof canopyProofPublicExplorerVerificationResponseSchema
>;
