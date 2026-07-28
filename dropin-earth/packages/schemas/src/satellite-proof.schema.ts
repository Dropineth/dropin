import { z } from "zod";

export const satelliteBaselineSources = ["sentinel-1", "sentinel-2", "landsat"] as const;
export const satelliteObservationSources = ["planet", "iceye", "capella"] as const;
export const satelliteAuditSources = ["maxar", "airbus", "drone", "field_validator"] as const;
export const satelliteObservationEventTypes = [
  "growth",
  "fire_risk",
  "deforestation",
  "water_stress",
  "survival_drop",
] as const;

export const satelliteHighRiskObservationEventTypes = [
  "fire_risk",
  "deforestation",
  "survival_drop",
] as const;

const identifierSchema = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const gridIdSchema = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const timestampSchema = z.string().datetime({ offset: true });
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const percentageSchema = z.number().finite().min(0).max(100);
const ndviSchema = z.number().finite().min(-1).max(1);
const sarBackscatterSchema = z.number().finite().min(-100).max(100);

export const baselineSnapshotInputSchema = z
  .object({
    gridId: gridIdSchema,
    timestamp: timestampSchema,
    source: z.enum(satelliteBaselineSources),
    canopyCoverPct: percentageSchema,
    ndvi: ndviSchema.nullable().default(null),
    sarBackscatterDb: sarBackscatterSchema.nullable().default(null),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.ndvi === null && input.sarBackscatterDb === null) {
      context.addIssue({
        code: "custom",
        message: "A baseline snapshot requires at least one NDVI or SAR measurement.",
      });
    }
    if (input.source === "sentinel-1" && input.sarBackscatterDb === null) {
      context.addIssue({
        code: "custom",
        path: ["sarBackscatterDb"],
        message: "Sentinel-1 baselines require a SAR backscatter measurement.",
      });
    }
    if ((input.source === "sentinel-2" || input.source === "landsat") && input.ndvi === null) {
      context.addIssue({
        code: "custom",
        path: ["ndvi"],
        message: `${input.source} baselines require an NDVI measurement.`,
      });
    }
  });

export const baselineSnapshotSchema = z
  .object({
    baselineId: identifierSchema,
    gridId: gridIdSchema,
    timestamp: timestampSchema,
    source: z.enum(satelliteBaselineSources),
    canopyCoverPct: percentageSchema,
    ndvi: ndviSchema.nullable(),
    sarBackscatterDb: sarBackscatterSchema.nullable(),
    baselineRoot: rootSchema,
  })
  .strict();

export const observationEventInputSchema = z
  .object({
    gridId: gridIdSchema,
    timestamp: timestampSchema,
    source: z.enum(satelliteObservationSources),
    eventType: z.enum(satelliteObservationEventTypes),
    canopyCoverPct: percentageSchema.nullable().default(null),
    ndvi: ndviSchema.nullable().default(null),
    sarBackscatterDb: sarBackscatterSchema.nullable().default(null),
    treeSurvivalRate: percentageSchema.nullable().default(null),
    waterStressIndex: z.number().finite().min(0).max(1).nullable().default(null),
    anomalyConfidence: z.number().finite().min(0).max(1),
    anomalyThreshold: z.number().finite().min(0).max(1).default(0.8),
  })
  .strict()
  .superRefine((input, context) => {
    const hasMeasurement =
      input.canopyCoverPct !== null ||
      input.ndvi !== null ||
      input.sarBackscatterDb !== null ||
      input.treeSurvivalRate !== null ||
      input.waterStressIndex !== null;
    if (!hasMeasurement) {
      context.addIssue({
        code: "custom",
        message: "An observation event requires at least one physical measurement.",
      });
    }
    if ((input.source === "iceye" || input.source === "capella") && input.sarBackscatterDb === null) {
      context.addIssue({
        code: "custom",
        path: ["sarBackscatterDb"],
        message: `${input.source} observations require a SAR backscatter measurement.`,
      });
    }
  });

export const observationEventSchema = z
  .object({
    observationId: identifierSchema,
    gridId: gridIdSchema,
    timestamp: timestampSchema,
    source: z.enum(satelliteObservationSources),
    eventType: z.enum(satelliteObservationEventTypes),
    canopyCoverPct: percentageSchema.nullable(),
    ndvi: ndviSchema.nullable(),
    sarBackscatterDb: sarBackscatterSchema.nullable(),
    treeSurvivalRate: percentageSchema.nullable(),
    waterStressIndex: z.number().finite().min(0).max(1).nullable(),
    anomalyConfidence: z.number().finite().min(0).max(1),
    anomalyThreshold: z.number().finite().min(0).max(1),
    observationRoot: rootSchema,
  })
  .strict();

export const auditAttestationDraftSchema = z
  .object({
    gridId: gridIdSchema,
    timestamp: timestampSchema,
    source: z.enum(satelliteAuditSources),
    auditorId: identifierSchema,
    verifiedCanopyCoverPct: percentageSchema,
    verifiedTreeSurvivalRate: percentageSchema,
    verifiedTco2eDelta: z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000),
    auditorSignature: z.string().trim().min(16).max(4096),
  })
  .strict();

export const auditAttestationInputSchema = auditAttestationDraftSchema.extend({
  baselineRoot: rootSchema,
  observationRoot: rootSchema,
});

export const auditAttestationSchema = auditAttestationInputSchema.extend({
  auditAttestationId: identifierSchema,
  auditRoot: rootSchema,
});

export const satelliteCertificateRequestSchema = z
  .object({
    certificateId: identifierSchema,
    timestamp: timestampSchema,
    verifiedTco2e: z.number().finite().positive().max(1_000_000_000_000),
    methodologyVersion: identifierSchema,
  })
  .strict();

export const satelliteUnlockRequestSchema = z
  .object({
    unlockId: identifierSchema,
    timestamp: timestampSchema,
    token: z.literal("CANOPY"),
    amount: z
      .string()
      .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/)
      .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, "Unlock amount must be positive."),
  })
  .strict();

export const satelliteReplayRootsSchema = z
  .object({
    stateRoot: rootSchema,
    certificateRoot: rootSchema,
    unlockRoot: rootSchema,
    challengeRoot: rootSchema,
  })
  .strict();

export const satelliteProofReplayFixtureSchema = z
  .object({
    schemaVersion: z.literal("canopyproof-satellite-proof-fixture/v1"),
    baseline: baselineSnapshotInputSchema,
    observation: observationEventInputSchema,
    audit: auditAttestationDraftSchema,
    certificate: satelliteCertificateRequestSchema,
    unlock: satelliteUnlockRequestSchema.optional(),
    expectedRoots: satelliteReplayRootsSchema.optional(),
  })
  .strict();

export type SatelliteBaselineSource = (typeof satelliteBaselineSources)[number];
export type SatelliteObservationSource = (typeof satelliteObservationSources)[number];
export type SatelliteAuditSource = (typeof satelliteAuditSources)[number];
export type SatelliteObservationEventType = (typeof satelliteObservationEventTypes)[number];
export type BaselineSnapshotInput = z.input<typeof baselineSnapshotInputSchema>;
export type BaselineSnapshot = z.output<typeof baselineSnapshotSchema>;
export type ObservationEventInput = z.input<typeof observationEventInputSchema>;
export type ObservationEvent = z.output<typeof observationEventSchema>;
export type AuditAttestationDraft = z.input<typeof auditAttestationDraftSchema>;
export type AuditAttestationInput = z.input<typeof auditAttestationInputSchema>;
export type AuditAttestation = z.output<typeof auditAttestationSchema>;
export type SatelliteCertificateRequest = z.output<typeof satelliteCertificateRequestSchema>;
export type SatelliteUnlockRequest = z.output<typeof satelliteUnlockRequestSchema>;
export type SatelliteProofReplayFixture = z.output<typeof satelliteProofReplayFixtureSchema>;
