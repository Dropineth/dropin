import { z } from "zod";

export const canopyProofMobileEvidenceTypes = [
  "tree_planting",
  "restoration",
  "biodiversity",
  "water",
  "soil",
  "climate_observation",
] as const;

export const canopyProofMobileEvidenceQueueStates = [
  "draft_queued",
  "blocked_prerequisites",
  "ready_to_sync",
  "sync_leased",
  "acknowledged",
  "rejected",
] as const;

export const canopyProofMobileEvidenceConnectivityModes = [
  "offline",
  "cellular",
  "wifi",
  "satellite",
] as const;

const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value, "Timestamp must be canonical millisecond UTC.");
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const nullableHashSchema = hashSchema.nullable();

export const canopyProofMobileEvidenceCaptureSchema = z
  .object({
    evidenceType: z.enum(canopyProofMobileEvidenceTypes),
    projectId: identifierSchema,
    observedAt: canonicalTimestampSchema,
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    gpsAccuracyMeters: z.number().finite().positive().max(100_000),
    mediaHash: hashSchema,
    deviceFingerprintHash: hashSchema,
    exifHash: nullableHashSchema,
    notes: z.string().trim().min(1).max(2_000).nullable(),
  })
  .strict();

export const canopyProofMobileEvidenceSyncCaptureSchema = z
  .object({
    evidenceType: z.enum(canopyProofMobileEvidenceTypes),
    projectId: identifierSchema,
    observedAt: canonicalTimestampSchema,
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    gpsAccuracyMeters: z.number().finite().positive().max(100_000),
    mediaHash: hashSchema,
    deviceFingerprintHash: hashSchema,
    exifHash: nullableHashSchema,
    notesHash: nullableHashSchema,
  })
  .strict();

export const canopyProofMobileEvidenceBindingRequestSchema = z
  .object({
    schemaVersion: z.literal("canopyproof.mobile-evidence-binding-request/v1"),
    clientRecordId: z.string().regex(/^cp_evidence_draft_[a-f0-9]{32}$/),
    clientBatchId: z.string().regex(/^cp_mobile_evidence_batch_[a-f0-9]{32}$/),
    syncPayloadHash: hashSchema,
    capture: canopyProofMobileEvidenceSyncCaptureSchema,
    consentReceiptId: identifierSchema,
    deviceAttestationId: identifierSchema,
    queuedAt: canonicalTimestampSchema,
  })
  .strict();

export const canopyProofMobileEvidenceServerBindingSchema = z
  .object({
    clientRecordId: z.string().regex(/^cp_evidence_draft_[a-f0-9]{32}$/),
    clientBatchId: z.string().regex(/^cp_mobile_evidence_batch_[a-f0-9]{32}$/),
    organizationId: identifierSchema,
    projectId: identifierSchema,
    consentReceiptId: identifierSchema,
    consentReceiptRoot: hashSchema,
    deviceAttestationId: identifierSchema,
    deviceAttestationRoot: hashSchema,
    evidenceId: identifierSchema,
    evidenceRoot: hashSchema,
    syncPayloadHash: hashSchema,
    boundAt: canonicalTimestampSchema,
    bindingRoot: hashSchema,
  })
  .strict();

export const canopyProofMobileEvidenceBindingResultSchema = z
  .object({
    binding: canopyProofMobileEvidenceServerBindingSchema,
    structuralState: z.enum(["validated", "challenged"]),
    registrationAuditEventRoot: hashSchema,
    rawNotesRetained: z.literal(false),
    finalVerification: z.literal(false),
  })
  .strict();

export const canopyProofMobileEvidenceAcknowledgementSchema = z
  .object({
    clientRecordId: z.string().regex(/^cp_evidence_draft_[a-f0-9]{32}$/),
    evidenceId: identifierSchema,
    evidenceRoot: hashSchema,
    itemRoot: hashSchema,
    batchId: identifierSchema,
    batchRoot: hashSchema,
    auditEventRoot: hashSchema,
    acknowledgedAt: canonicalTimestampSchema,
  })
  .strict();

export const canopyProofMobileEvidenceBatchRequestSchema = z
  .object({
    schemaVersion: z.literal("canopyproof.mobile-evidence-batch-request/v1"),
    clientBatchId: z.string().regex(/^cp_mobile_evidence_batch_[a-f0-9]{32}$/),
    projectId: identifierSchema,
    consentReceiptId: identifierSchema,
    deviceAttestationId: identifierSchema,
    connectivity: z.enum(canopyProofMobileEvidenceConnectivityModes),
    deviceClockStartedAt: canonicalTimestampSchema,
    deviceClockEndedAt: canonicalTimestampSchema,
    bindings: z.array(canopyProofMobileEvidenceServerBindingSchema).min(1).max(100),
  })
  .strict()
  .superRefine((batch, context) => {
    if (Date.parse(batch.deviceClockEndedAt) < Date.parse(batch.deviceClockStartedAt)) {
      context.addIssue({
        code: "custom",
        path: ["deviceClockEndedAt"],
        message: "deviceClockEndedAt cannot precede deviceClockStartedAt.",
      });
    }
    const recordIds = new Set<string>();
    for (const [index, binding] of batch.bindings.entries()) {
      if (recordIds.has(binding.clientRecordId)) {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "clientRecordId"],
          message: "A batch cannot contain the same client record more than once.",
        });
      }
      recordIds.add(binding.clientRecordId);
      if (
        binding.clientBatchId !== batch.clientBatchId ||
        binding.projectId !== batch.projectId ||
        binding.consentReceiptId !== batch.consentReceiptId ||
        binding.deviceAttestationId !== batch.deviceAttestationId
      ) {
        context.addIssue({
          code: "custom",
          path: ["bindings", index],
          message: "Every binding must belong to the batch project, consent receipt, and device.",
        });
      }
    }
  });

export const canopyProofMobileEvidenceBatchResultSchema = z
  .object({
    clientBatchId: z.string().regex(/^cp_mobile_evidence_batch_[a-f0-9]{32}$/),
    batchState: z.enum(["reconciled", "needs_review"]),
    acknowledgements: z.array(canopyProofMobileEvidenceAcknowledgementSchema).min(1).max(100),
    recovered: z.boolean(),
  })
  .strict();

export const canopyProofMobileEvidenceRecoveryRequestSchema = z
  .object({
    schemaVersion: z.literal("canopyproof.mobile-evidence-recovery-request/v1"),
    clientBatchId: z.string().regex(/^cp_mobile_evidence_batch_[a-f0-9]{32}$/),
    projectId: identifierSchema,
    deviceAttestationId: identifierSchema,
  })
  .strict();

export const canopyProofMobileEvidenceDraftSchema = z
  .object({
    schemaVersion: z.literal("canopyproof.mobile-evidence-draft/v2"),
    id: z.string().regex(/^cp_evidence_draft_[a-f0-9]{32}$/),
    capture: canopyProofMobileEvidenceCaptureSchema,
    payloadHash: hashSchema,
    idempotencyKey: z.string().regex(/^cp_mobile_evidence_[a-f0-9]{32}$/),
    state: z.enum(canopyProofMobileEvidenceQueueStates),
    attemptCount: z.number().int().nonnegative().max(1_000),
    createdAt: canonicalTimestampSchema,
    updatedAt: canonicalTimestampSchema,
    nextAttemptAt: canonicalTimestampSchema.nullable(),
    leaseExpiresAt: canonicalTimestampSchema.nullable(),
    serverBinding: canopyProofMobileEvidenceServerBindingSchema.nullable(),
    acknowledgement: canopyProofMobileEvidenceAcknowledgementSchema.nullable(),
    lastErrorCode: z
      .string()
      .regex(/^CANOPYPROOF_[A-Z0-9_]{1,120}$/)
      .nullable(),
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.state === "sync_leased" && draft.leaseExpiresAt === null) {
      context.addIssue({
        code: "custom",
        path: ["leaseExpiresAt"],
        message: "A sync lease requires leaseExpiresAt.",
      });
    }
    if (draft.state !== "sync_leased" && draft.leaseExpiresAt !== null) {
      context.addIssue({
        code: "custom",
        path: ["leaseExpiresAt"],
        message: "Only sync_leased drafts may retain leaseExpiresAt.",
      });
    }
    if (draft.state === "acknowledged" && draft.acknowledgement === null) {
      context.addIssue({
        code: "custom",
        path: ["acknowledgement"],
        message: "An acknowledged draft requires a durable acknowledgement.",
      });
    }
    if (draft.state !== "acknowledged" && draft.acknowledgement !== null) {
      context.addIssue({
        code: "custom",
        path: ["acknowledgement"],
        message: "Only acknowledged drafts may retain an acknowledgement.",
      });
    }
    if (draft.nextAttemptAt !== null && draft.state !== "ready_to_sync") {
      context.addIssue({
        code: "custom",
        path: ["nextAttemptAt"],
        message: "Only ready_to_sync drafts may retain nextAttemptAt.",
      });
    }
    if ((draft.state === "draft_queued" || draft.state === "blocked_prerequisites") &&
      draft.serverBinding !== null) {
      context.addIssue({
        code: "custom",
        path: ["serverBinding"],
        message: `${draft.state} cannot retain a server authority binding.`,
      });
    }
    if ((draft.state === "draft_queued" || draft.state === "sync_leased" || draft.state === "acknowledged") &&
      draft.lastErrorCode !== null) {
      context.addIssue({
        code: "custom",
        path: ["lastErrorCode"],
        message: `${draft.state} cannot retain a retry error code.`,
      });
    }
    if (
      (draft.state === "ready_to_sync" || draft.state === "sync_leased" || draft.state === "acknowledged") &&
      draft.serverBinding === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["serverBinding"],
        message: `${draft.state} requires a server authority binding.`,
      });
    }
    if (Date.parse(draft.updatedAt) < Date.parse(draft.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt cannot precede createdAt.",
      });
    }
  });

export const canopyProofLegacyMobileEvidenceDraftSchema = z
  .object({
    id: z.string().min(1).max(256),
    evidenceType: z.enum(canopyProofMobileEvidenceTypes),
    projectId: z.string().trim().min(1).max(256),
    observedAt: z.string().trim().min(1).max(64),
    latitude: z.string().trim().min(1).max(64),
    longitude: z.string().trim().min(1).max(64),
    gpsAccuracyMeters: z.string().trim().min(1).max(64),
    mediaHash: z.string().trim().max(256),
    deviceFingerprintHash: z.string().trim().max(256),
    exifHash: z.string().trim().max(256),
    notes: z.string().max(2_000),
    idempotencyKey: z.string().min(1).max(256),
    verificationState: z.literal("draft_queued"),
    createdAt: z.string().trim().min(1).max(64),
  })
  .strict();

export type CanopyProofMobileEvidenceType = (typeof canopyProofMobileEvidenceTypes)[number];
export type CanopyProofMobileEvidenceConnectivityMode =
  (typeof canopyProofMobileEvidenceConnectivityModes)[number];
export type CanopyProofMobileEvidenceQueueState = (typeof canopyProofMobileEvidenceQueueStates)[number];
export type CanopyProofMobileEvidenceCapture = z.output<typeof canopyProofMobileEvidenceCaptureSchema>;
export type CanopyProofMobileEvidenceSyncCapture = z.output<
  typeof canopyProofMobileEvidenceSyncCaptureSchema
>;
export type CanopyProofMobileEvidenceBindingRequest = z.output<
  typeof canopyProofMobileEvidenceBindingRequestSchema
>;
export type CanopyProofMobileEvidenceDraft = z.output<typeof canopyProofMobileEvidenceDraftSchema>;
export type CanopyProofMobileEvidenceServerBinding = z.output<
  typeof canopyProofMobileEvidenceServerBindingSchema
>;
export type CanopyProofMobileEvidenceBindingResult = z.output<
  typeof canopyProofMobileEvidenceBindingResultSchema
>;
export type CanopyProofMobileEvidenceAcknowledgement = z.output<
  typeof canopyProofMobileEvidenceAcknowledgementSchema
>;
export type CanopyProofMobileEvidenceBatchRequest = z.output<
  typeof canopyProofMobileEvidenceBatchRequestSchema
>;
export type CanopyProofMobileEvidenceBatchResult = z.output<
  typeof canopyProofMobileEvidenceBatchResultSchema
>;
export type CanopyProofMobileEvidenceRecoveryRequest = z.output<
  typeof canopyProofMobileEvidenceRecoveryRequestSchema
>;
export type CanopyProofLegacyMobileEvidenceDraft = z.output<
  typeof canopyProofLegacyMobileEvidenceDraftSchema
>;
