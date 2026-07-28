import { z } from "zod";
import {
  visualFieldVerificationResults,
  visualKnownDecoyTypes,
  visualReviewDecisions,
  visualReviewerRoles,
  visualSensorModalities,
} from "./visual-evidence-types.js";

const opaqueIdSchema = z.string().min(3).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]+$/);
const hashSchema = z.string().regex(/^[a-f0-9]{32,128}$/i);
const timestampSchema = z.string().datetime({ offset: true });
const geometrySchema = z.record(z.string(), z.unknown());
const idempotencySchema = z.string().min(16).max(256).regex(/^[A-Za-z0-9_.:-]+$/);

const sensorDomainSchema = z
  .object({
    sensor: z.enum(visualSensorModalities),
    resolution: z.number().positive(),
    resolutionUnit: z.enum(["meters_per_pixel", "centimeters_per_pixel", "points_per_square_meter"]),
    altitudeMeters: z.number().nonnegative().optional(),
    season: z.string().min(1).max(128),
    ecosystem: z.string().min(1).max(128),
    geography: z.string().min(1).max(128),
    calibrationState: z.enum(["calibrated", "uncalibrated", "unknown"]),
  })
  .strict();

const datasetMemberSchema = z
  .object({
    sampleId: opaqueIdSchema,
    assetId: opaqueIdSchema,
    assetVersion: z.number().int().positive(),
    assetRoot: hashSchema,
    contentHash: hashSchema,
    sensorStreamId: opaqueIdSchema,
    pairedSampleIds: z.array(opaqueIdSchema).max(32).default([]),
    licensePolicyId: opaqueIdSchema,
  })
  .strict();

export const createVisualDatasetRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    projectId: opaqueIdSchema.optional(),
    name: z.string().min(1).max(200),
    purpose: z.enum(["LAB_BENCHMARK", "INTERNAL_REVIEW", "PRODUCTION_EVIDENCE_INPUT"]),
    classification: z.enum(["PUBLIC", "INTERNAL", "RESTRICTED", "HIGHLY_RESTRICTED"]),
    pairingPolicyVersion: z.string().min(1).max(128),
    sensorStreamIds: z.array(opaqueIdSchema).min(1).max(128),
    members: z.array(datasetMemberSchema).min(1).max(10_000),
    pairingEdgeRoots: z.array(hashSchema).max(20_000).default([]),
    licensePolicyId: opaqueIdSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const createVisualModelRunRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    modelDefinitionId: opaqueIdSchema,
    datasetSnapshotId: opaqueIdSchema,
    sourceDomain: sensorDomainSchema,
    canonicalParametersHash: hashSchema,
    deterministicSeed: z.string().min(1).max(256).optional(),
    runtimeDigest: hashSchema,
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    outputRoot: hashSchema,
    licensePolicyId: opaqueIdSchema,
    approvedDomainException: z
      .object({
        approvalId: opaqueIdSchema,
        approvedGapDimensions: z
          .array(z.enum(["SENSOR", "RESOLUTION", "ALTITUDE", "SEASON", "ECOSYSTEM", "GEOGRAPHY", "CALIBRATION"]))
          .min(1),
        expiresAt: timestampSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export const createVisualReviewQueueRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    candidateIds: z.array(opaqueIdSchema).min(1).max(10_000),
    sampleIds: z.array(opaqueIdSchema).min(1).max(10_000),
    purpose: z.string().min(1).max(256),
    methodologyId: opaqueIdSchema,
    requiredReviewerRoles: z.array(z.enum(visualReviewerRoles)).min(1),
    secondReviewRequired: z.boolean(),
    fieldCheckPolicy: z.enum(["NEVER", "ON_REQUEST", "REQUIRED_FOR_ACCEPTANCE"]),
    filterExpression: z.string().min(1).max(2_048),
    sortExpression: z.string().min(1).max(2_048),
    modelRunIds: z.array(opaqueIdSchema).min(1).max(128),
    randomQaSeed: z.string().min(1).max(256).optional(),
    priorQueueSnapshotId: opaqueIdSchema.optional(),
    createdAt: timestampSchema,
  })
  .strict();

export const createVisualReviewDecisionRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    reviewQueueSnapshotId: opaqueIdSchema,
    decision: z.enum(visualReviewDecisions),
    rationaleCode: z.string().min(1).max(128),
    notesHash: hashSchema.optional(),
    adjustedGeometry: geometrySchema.optional(),
    reviewerConfidence: z.number().min(0).max(1),
    supersedesDecisionId: opaqueIdSchema.optional(),
    reviewedAt: timestampSchema,
  })
  .strict();

export const createVisualFieldCheckRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    generalizedGeometry: geometrySchema,
    reason: z.string().min(1).max(1_024),
    requiredObservations: z.array(z.string().min(1).max(256)).min(1).max(64),
    assignedOrganizationId: opaqueIdSchema,
    assignedReviewerId: opaqueIdSchema,
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const createVisualFieldResultRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    gpsHash: hashSchema,
    gpsAccuracyMeters: z.number().positive().max(100_000),
    observedAt: timestampSchema,
    mediaRoots: z.array(hashSchema).min(1).max(64),
    notesHash: hashSchema,
    deviceAttestationRoot: hashSchema,
    result: z.enum(visualFieldVerificationResults),
  })
  .strict();

export const createVisualHardNegativeRequestSchema = z
  .object({
    idempotencyKey: idempotencySchema,
    reviewDecisionId: opaqueIdSchema,
    decoyType: z.enum(visualKnownDecoyTypes),
    licensePolicyId: opaqueIdSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const createFiftyOneManifestRequestSchema = z
  .object({
    reviewQueueSnapshotId: opaqueIdSchema,
    nonce: idempotencySchema,
    requestedActions: z
      .array(
        z.enum([
          "LOAD_REVIEW_QUEUE",
          "INSPECT_CANDIDATE_PROVENANCE",
          "APPEND_REVIEW_DECISION",
          "REQUEST_SECOND_REVIEW",
          "CREATE_FIELD_VERIFICATION_TASK",
          "OPEN_CHALLENGE_DRAFT",
          "REGISTER_HARD_NEGATIVE",
        ]),
      )
      .min(1),
  })
  .strict();

export const visualEvidenceApiContracts = [
  {
    method: "POST",
    path: "/canopyproof/visual-datasets",
    operation: "create_visual_dataset",
    schema: createVisualDatasetRequestSchema,
    roles: ["owner", "admin", "researcher"],
  },
  {
    method: "GET",
    path: "/canopyproof/visual-datasets/:id",
    operation: "read_visual_dataset",
    roles: ["owner", "admin", "verifier", "auditor", "researcher", "government", "un_partner"],
  },
  {
    method: "POST",
    path: "/canopyproof/visual-datasets/:id/model-runs",
    operation: "create_visual_model_run",
    schema: createVisualModelRunRequestSchema,
    roles: ["owner", "admin", "researcher"],
  },
  {
    method: "POST",
    path: "/canopyproof/visual-datasets/:id/review-queues",
    operation: "create_visual_review_queue",
    schema: createVisualReviewQueueRequestSchema,
    roles: ["owner", "admin", "verifier", "auditor"],
  },
  {
    method: "GET",
    path: "/canopyproof/review-queues/:id",
    operation: "read_visual_review_queue",
    roles: ["owner", "admin", "verifier", "auditor", "researcher", "government", "un_partner"],
  },
  {
    method: "POST",
    path: "/canopyproof/visual-candidates/:id/reviews",
    operation: "append_visual_review",
    schema: createVisualReviewDecisionRequestSchema,
    roles: ["verifier", "auditor", "researcher", "government", "un_partner"],
  },
  {
    method: "POST",
    path: "/canopyproof/visual-candidates/:id/field-checks",
    operation: "create_visual_field_check",
    schema: createVisualFieldCheckRequestSchema,
    roles: ["owner", "admin", "verifier", "auditor"],
  },
  {
    method: "POST",
    path: "/canopyproof/field-verification-tasks/:id/results",
    operation: "append_visual_field_result",
    schema: createVisualFieldResultRequestSchema,
    roles: ["verifier", "auditor", "researcher", "government", "un_partner"],
  },
  {
    method: "POST",
    path: "/canopyproof/visual-candidates/:id/hard-negative",
    operation: "append_visual_hard_negative",
    schema: createVisualHardNegativeRequestSchema,
    roles: ["verifier", "auditor", "researcher"],
  },
  {
    method: "GET",
    path: "/canopyproof/visual-datasets/:id/fiftyone-manifest",
    operation: "issue_fiftyone_manifest",
    schema: createFiftyOneManifestRequestSchema,
    roles: ["verifier", "auditor", "researcher", "government", "un_partner"],
  },
] as const;

export type VisualEvidenceApiContract = (typeof visualEvidenceApiContracts)[number];

export function visualEvidenceApiStatus() {
  return {
    service: "canopyproof-visual-evidence-api",
    contractCount: visualEvidenceApiContracts.length,
    mounted: false as const,
    externallyReachable: false as const,
    requiresAuthentication: true as const,
    requiresAuthorization: true as const,
    requiresTenantCheck: true as const,
    requiresLicenseCheck: true as const,
    requiresAuditEvent: true as const,
    requiresDurablePersistence: true as const,
    deploymentAuthorized: false as const,
  };
}
