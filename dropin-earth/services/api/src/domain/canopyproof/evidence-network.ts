import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  type CanopyProofAuditEvent,
  type CanopyProofEvidenceEnvelope,
} from "./proof-engine.js";
import { CanopyProofService, type CanopyProofEvidenceSubmissionResult } from "./proof-service.js";

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const mediaUploadIntentSchema = z.object({
  projectId: z.string().min(1),
  evidenceId: z.string().min(1).optional(),
  contentHash: sha256Schema,
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/json"]),
  byteLength: z.number().int().positive().max(50 * 1024 * 1024),
  capturedAt: z.string().datetime(),
  deviceFingerprintHash: sha256Schema.optional(),
});

const mediaObjectConfirmationSchema = z.object({
  intentId: z.string().min(1),
  contentHash: sha256Schema,
  objectKey: z.string().min(1),
  byteLength: z.number().int().positive().max(50 * 1024 * 1024),
  storedAt: z.string().datetime(),
  storageProvider: z.enum(["cloudflare_r2", "s3", "gcs", "ipfs_archive"]).default("cloudflare_r2"),
  encryption: z
    .object({
      atRest: z.literal(true),
      mode: z.enum(["r2_managed", "sse_kms", "client_side"]),
      keyRef: z.string().min(3).max(200).optional(),
    })
    .refine((value) => !value.keyRef || !/(secret|private|token|password|BEGIN)/i.test(value.keyRef), {
      message: "CanopyProof media object encryption keyRef must be a non-secret key identifier.",
    }),
  malwareScan: z
    .object({
      status: z.enum(["clean", "pending", "quarantined"]),
      scanner: z.string().min(2).max(100),
      scannedAt: z.string().datetime().optional(),
      signatureVersion: z.string().min(1).max(100).optional(),
    })
    .refine((value) => value.status === "pending" || Boolean(value.scannedAt), {
      message: "CanopyProof media object malware scan must include scannedAt unless scan is pending.",
    }),
  exifHash: sha256Schema.optional(),
  gpsHash: sha256Schema.optional(),
});

const consentReceiptSchema = z.object({
  subjectId: z.string().min(1),
  deviceFingerprintHash: sha256Schema.optional(),
  purposes: z
    .array(z.enum(["evidence_collection", "geolocation", "media_upload", "community_verification", "research_sharing"]))
    .min(1),
  lawfulBasis: z.enum(["consent", "public_interest", "legitimate_interest"]),
  privacyMode: z.enum(["precise", "masked", "restricted"]),
  policyVersion: z.string().min(1).max(100),
  evidenceHash: sha256Schema,
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  retentionDays: z.number().int().positive().max(3650),
});

const consentRevocationSchema = z.object({
  revokedAt: z.string().datetime(),
  reason: z.string().min(12).max(1_000),
});

const deviceAttestationSchema = z
  .object({
    subjectId: z.string().min(1),
    deviceFingerprintHash: sha256Schema,
    consentReceiptId: z.string().min(1),
    attestationType: z.enum(["secure_enclave", "webauthn", "platform_key", "manual_field_kit", "sensor_gateway"]),
    publicKeyHash: sha256Schema,
    attestationHash: sha256Schema,
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    reputationScore: z.number().int().min(0).max(100).default(70),
    riskFlags: z
      .array(z.enum(["jailbreak_detected", "clock_skew", "location_mocking", "sensor_gap", "shared_device_cluster"]))
      .default([]),
  })
  .refine((value) => Date.parse(value.issuedAt) < Date.parse(value.expiresAt), {
    message: "CanopyProof device attestation expiresAt must be after issuedAt.",
  });

const mediaMetadataExtractionSchema = z.object({
  mediaObjectId: z.string().min(1),
  consentReceiptId: z.string().min(1),
  deviceAttestationId: z.string().min(1),
  extractorVersion: z.string().min(1).max(100),
  extractedAt: z.string().datetime(),
  observedAt: z.string().datetime(),
  exifHash: sha256Schema,
  gpsHash: sha256Schema,
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().positive().max(10_000),
    regionId: z.string().min(1).optional(),
  }),
  sensorMetadata: z
    .object({
      altitudeMeters: z.number().optional(),
      headingDegrees: z.number().min(0).max(360).optional(),
      horizontalAccuracyMeters: z.number().positive().optional(),
      clockSkewSeconds: z.number().optional(),
      networkType: z.enum(["offline", "cellular", "wifi", "satellite", "unknown"]).default("unknown"),
    })
    .default({ networkType: "unknown" }),
});

const evidenceReviewTaskSchema = z.object({
  sourceType: z.enum(["media_object", "media_metadata_extraction", "offline_sync_batch", "community_attestation"]),
  sourceId: z.string().min(1),
  evidenceId: z.string().min(1).optional(),
  reasonCodes: z.array(z.string().regex(/^[a-z0-9_:-]+$/)).min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  openedAt: z.string().datetime(),
  dueAt: z.string().datetime().optional(),
  assignedTo: z.string().min(1).optional(),
  policyId: z.string().min(1).optional(),
});

const evidenceReviewTaskResolutionSchema = z.object({
  decision: z.enum(["accept", "reject", "quarantine", "escalate", "retain_non_final"]),
  rationale: z.string().min(12).max(2_000),
  resolvedAt: z.string().datetime(),
});

const retentionPolicyDecisionSchema = z.object({
  sourceType: z.enum(["consent_receipt", "media_metadata_extraction", "media_object"]),
  sourceId: z.string().min(1),
  evidenceId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  basis: z.enum(["consent_retention", "expired_consent", "revoked_consent", "safety_review", "legal_hold"]),
  disposition: z.enum(["retain", "minimize", "tombstone_after_retention", "legal_hold"]),
  retainUntil: z.string().datetime().optional(),
  legalHold: z.boolean().default(false),
  evaluatedAt: z.string().datetime(),
  rationale: z.string().min(12).max(2_000),
});

const retentionPolicyEvaluationSchema = z.object({
  evaluatedAt: z.string().datetime(),
});

const offlineSyncBatchSchema = z.object({
  batchId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  deviceFingerprintHash: sha256Schema,
  deviceClockStartedAt: z.string().datetime().optional(),
  deviceClockEndedAt: z.string().datetime().optional(),
  submittedAt: z.string().datetime().optional(),
  evidence: z.array(z.unknown()).min(1).max(100),
});

const communityAttestationSchema = z.object({
  stance: z.enum(["support", "challenge", "needs_review"]),
  note: z.string().min(12).max(2_000),
  observedAt: z.string().datetime(),
  confidence_score: z.number().min(0).max(100).default(70),
  media_hash: sha256Schema.optional(),
  gps_hash: sha256Schema.optional(),
  device_fingerprint_hash: sha256Schema.optional(),
});

export const canopyProofEvidenceCustodyActions = [
  "captured",
  "uploaded",
  "stored",
  "metadata_extracted",
  "review_opened",
  "review_resolved",
  "retention_decided",
  "offline_synced",
  "community_attested",
] as const;

export const canopyProofEvidenceCustodyArtifactTypes = [
  "evidence",
  "media_upload_intent",
  "media_object",
  "media_metadata_extraction",
  "review_task",
  "retention_policy_decision",
  "offline_sync_batch",
  "community_attestation",
] as const;

export type CanopyProofEvidenceCustodyAction = (typeof canopyProofEvidenceCustodyActions)[number];
export type CanopyProofEvidenceCustodyArtifactType = (typeof canopyProofEvidenceCustodyArtifactTypes)[number];

const evidenceCustodyEventSchema = z
  .object({
    evidenceId: z.string().min(1),
    action: z.enum(canopyProofEvidenceCustodyActions),
    artifactType: z.enum(canopyProofEvidenceCustodyArtifactTypes),
    artifactId: z.string().min(1),
    custodianOrganizationId: z.string().min(1).optional(),
    custodyNote: z.string().min(12).max(1_000),
    occurredAt: z.string().datetime(),
    policyId: z.string().min(1).optional(),
  })
  .strict();

export type CanopyProofMediaUploadIntent = {
  readonly id: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly contentHash: string;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp" | "application/json";
  readonly byteLength: number;
  readonly objectKey: string;
  readonly uploadUrl: string;
  readonly uploadMethod: "PUT";
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMediaObjectState = "available" | "pending_scan" | "quarantined" | "duplicate";

export type CanopyProofMediaObject = {
  readonly id: string;
  readonly intentId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly contentHash: string;
  readonly contentType: CanopyProofMediaUploadIntent["contentType"];
  readonly byteLength: number;
  readonly objectKey: string;
  readonly storageProvider: "cloudflare_r2" | "s3" | "gcs" | "ipfs_archive";
  readonly encryption: {
    readonly atRest: true;
    readonly mode: "r2_managed" | "sse_kms" | "client_side";
    readonly keyRef?: string;
  };
  readonly malwareScan: {
    readonly status: "clean" | "pending" | "quarantined";
    readonly scanner: string;
    readonly scannedAt?: string;
    readonly signatureVersion?: string;
  };
  readonly mediaState: CanopyProofMediaObjectState;
  readonly duplicateOfMediaObjectId?: string;
  readonly exifHash?: string;
  readonly gpsHash?: string;
  readonly integrityRoot: string;
  readonly storedAt: string;
  readonly confirmedBy: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofConsentReceipt = {
  readonly id: string;
  readonly subjectId: string;
  readonly deviceFingerprintHash?: string;
  readonly purposes: readonly ("evidence_collection" | "geolocation" | "media_upload" | "community_verification" | "research_sharing")[];
  readonly lawfulBasis: "consent" | "public_interest" | "legitimate_interest";
  readonly privacyMode: "precise" | "masked" | "restricted";
  readonly policyVersion: string;
  readonly evidenceHash: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly retentionDays: number;
  readonly revokedAt?: string;
  readonly revocationReason?: string;
  readonly receiptRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDeviceAttestation = {
  readonly id: string;
  readonly subjectId: string;
  readonly deviceFingerprintHash: string;
  readonly consentReceiptId: string;
  readonly attestationType: "secure_enclave" | "webauthn" | "platform_key" | "manual_field_kit" | "sensor_gateway";
  readonly publicKeyHash: string;
  readonly attestationHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly reputationScore: number;
  readonly riskFlags: readonly ("jailbreak_detected" | "clock_skew" | "location_mocking" | "sensor_gap" | "shared_device_cluster")[];
  readonly attestationRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMediaMetadataExtraction = {
  readonly id: string;
  readonly mediaObjectId: string;
  readonly evidenceId: string;
  readonly consentReceiptId: string;
  readonly deviceAttestationId: string;
  readonly extractorVersion: string;
  readonly extractedAt: string;
  readonly observedAt: string;
  readonly exifHash: string;
  readonly gpsHash: string;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters: number;
    readonly regionId?: string;
  };
  readonly sensorMetadata: {
    readonly altitudeMeters?: number;
    readonly headingDegrees?: number;
    readonly horizontalAccuracyMeters?: number;
    readonly clockSkewSeconds?: number;
    readonly networkType: "offline" | "cellular" | "wifi" | "satellite" | "unknown";
  };
  readonly extractionState: "accepted" | "needs_review";
  readonly issues: readonly string[];
  readonly metadataRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceReviewTask = {
  readonly id: string;
  readonly sourceType: "media_object" | "media_metadata_extraction" | "offline_sync_batch" | "community_attestation";
  readonly sourceId: string;
  readonly evidenceId?: string;
  readonly reasonCodes: readonly string[];
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "assigned" | "resolved" | "escalated";
  readonly openedAt: string;
  readonly dueAt?: string;
  readonly assignedTo?: string;
  readonly policyId?: string;
  readonly resolvedAt?: string;
  readonly resolvedBy?: string;
  readonly decision?: "accept" | "reject" | "quarantine" | "escalate" | "retain_non_final";
  readonly rationale?: string;
  readonly taskRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRetentionPolicyDecision = {
  readonly id: string;
  readonly sourceType: "consent_receipt" | "media_metadata_extraction" | "media_object";
  readonly sourceId: string;
  readonly evidenceId?: string;
  readonly subjectId?: string;
  readonly basis: "consent_retention" | "expired_consent" | "revoked_consent" | "safety_review" | "legal_hold";
  readonly disposition: "retain" | "minimize" | "tombstone_after_retention" | "legal_hold";
  readonly retainUntil?: string;
  readonly legalHold: boolean;
  readonly evaluatedAt: string;
  readonly rationale: string;
  readonly decisionRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofOfflineSyncItemResult = {
  readonly evidenceId: string;
  readonly status: "accepted" | "challenged" | "duplicate" | "conflict";
  readonly issues: readonly string[];
  readonly evidence: CanopyProofEvidenceEnvelope;
};

export type CanopyProofOfflineSyncBatch = {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly submittedBy: string;
  readonly deviceFingerprintHash: string;
  readonly projectId?: string;
  readonly receivedAt: string;
  readonly status: "accepted" | "partial_review" | "conflict_review";
  readonly replayed: boolean;
  readonly evidenceIds: readonly string[];
  readonly acceptedCount: number;
  readonly challengedCount: number;
  readonly duplicateCount: number;
  readonly conflictCount: number;
  readonly itemResults: readonly CanopyProofOfflineSyncItemResult[];
  readonly syncRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofCommunityAttestation = {
  readonly id: string;
  readonly evidenceId: string;
  readonly attester: string;
  readonly stance: "support" | "challenge" | "needs_review";
  readonly note: string;
  readonly observedAt: string;
  readonly confidence_score: number;
  readonly media_hash?: string;
  readonly gps_hash?: string;
  readonly device_fingerprint_hash?: string;
  readonly attestationRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
  readonly evidence: CanopyProofEvidenceEnvelope;
};

export type CanopyProofEvidenceCustodyEvent = {
  readonly id: string;
  readonly evidenceId: string;
  readonly action: CanopyProofEvidenceCustodyAction;
  readonly artifactType: CanopyProofEvidenceCustodyArtifactType;
  readonly artifactId: string;
  readonly sourceRoot: string;
  readonly previousCustodyRoot: string;
  readonly custodianId: string;
  readonly custodianOrganizationId?: string;
  readonly custodyNote: string;
  readonly occurredAt: string;
  readonly policyId?: string;
  readonly custodyRoot: string;
  readonly custodyHash: string;
  readonly safety: {
    readonly appendOnly: true;
    readonly sourceRootBound: true;
    readonly previousRootLinked: true;
    readonly noRawPrivateContactData: true;
    readonly notFinalProofAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceNetworkStatus = {
  readonly service: "canopyproof-evidence-network";
  readonly mediaUploadIntentCount: number;
  readonly mediaObjectCount: number;
  readonly quarantinedMediaObjectCount: number;
  readonly pendingScanMediaObjectCount: number;
  readonly duplicateMediaObjectCount: number;
  readonly consentReceiptCount: number;
  readonly revokedConsentReceiptCount: number;
  readonly deviceAttestationCount: number;
  readonly riskyDeviceAttestationCount: number;
  readonly mediaMetadataExtractionCount: number;
  readonly metadataExtractionNeedsReviewCount: number;
  readonly evidenceReviewTaskCount: number;
  readonly openEvidenceReviewTaskCount: number;
  readonly escalatedEvidenceReviewTaskCount: number;
  readonly retentionPolicyDecisionCount: number;
  readonly retentionMinimizationDecisionCount: number;
  readonly offlineSyncBatchCount: number;
  readonly offlineSyncConflictCount: number;
  readonly communityAttestationCount: number;
  readonly custodyEventCount: number;
  readonly safety: {
    readonly offlineSyncRequiresIdempotencyKey: true;
    readonly duplicateEvidenceIdsBecomeChallenges: true;
    readonly communityAttestationIsNotFinalAuthority: true;
    readonly mediaUploadsAreContentAddressed: true;
    readonly mediaObjectsRequireEncryptionAtRest: true;
    readonly mediaObjectsRequireMalwareScan: true;
    readonly duplicateMediaObjectsAreNotFinalProof: true;
    readonly consentRequiredForDeviceBoundEvidence: true;
    readonly deviceAttestationRequiredForMetadataExtraction: true;
    readonly exifGpsExtractionIsHashBound: true;
    readonly moderationReviewQueueIsHumanGated: true;
    readonly retentionAutomationIsAppendOnly: true;
    readonly custodyChainIsAppendOnly: true;
  };
  readonly networkRoot: string;
};

export class CanopyProofEvidenceNetworkService {
  private readonly mediaUploadIntentsById = new Map<string, CanopyProofMediaUploadIntent>();
  private readonly mediaObjectsById = new Map<string, CanopyProofMediaObject>();
  private readonly mediaObjectIdsByIntentId = new Map<string, string>();
  private readonly mediaObjectIdByContentHash = new Map<string, string>();
  private readonly consentReceiptsById = new Map<string, CanopyProofConsentReceipt>();
  private readonly deviceAttestationsById = new Map<string, CanopyProofDeviceAttestation>();
  private readonly metadataExtractionsById = new Map<string, CanopyProofMediaMetadataExtraction>();
  private readonly reviewTasksById = new Map<string, CanopyProofEvidenceReviewTask>();
  private readonly reviewTaskIdsBySource = new Map<string, string>();
  private readonly retentionPolicyDecisionsById = new Map<string, CanopyProofRetentionPolicyDecision>();
  private readonly retentionPolicyDecisionIdsBySource = new Map<string, string>();
  private readonly syncBatchesById = new Map<string, CanopyProofOfflineSyncBatch>();
  private readonly syncBatchIdsByIdempotencyKey = new Map<string, string>();
  private readonly attestationsById = new Map<string, CanopyProofCommunityAttestation>();
  private readonly custodyEventsById = new Map<string, CanopyProofEvidenceCustodyEvent>();
  private readonly latestCustodyRootByEvidenceId = new Map<string, string>();

  constructor(private readonly proofService: CanopyProofService) {}

  createMediaUploadIntent(input: unknown, actorId: string): CanopyProofMediaUploadIntent {
    const parsed = mediaUploadIntentSchema.parse(input);
    const createdAt = parsed.capturedAt;
    const evidenceId =
      parsed.evidenceId ??
      `cp_evidence_${hashJson({
        projectId: parsed.projectId,
        contentHash: parsed.contentHash.toLowerCase(),
        capturedAt: parsed.capturedAt,
        actorId,
      }).slice(0, 24)}`;
    const contentHash = parsed.contentHash.toLowerCase();
    const objectKey = `canopyproof/evidence/${parsed.projectId}/${evidenceId}/${contentHash.replace(/^sha256:/, "")}`;
    const payload = {
      projectId: parsed.projectId,
      evidenceId,
      contentHash,
      contentType: parsed.contentType,
      byteLength: parsed.byteLength,
      objectKey,
      createdBy: actorId,
      ...(parsed.deviceFingerprintHash ? { deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase() } : {}),
    };
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "media_upload_intent",
      entityId: evidenceId,
      payload,
      createdAt,
      rationale: "Content-addressed media upload intent created without exposing storage secrets.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof media upload intent failed to append audit event.");
    }
    const id = `cp_media_${hashJson({ kind: "canopyproof-media-upload-intent-v1", ...payload }).slice(0, 24)}`;
    const intent: CanopyProofMediaUploadIntent = {
      id,
      projectId: parsed.projectId,
      evidenceId,
      contentHash,
      contentType: parsed.contentType,
      byteLength: parsed.byteLength,
      objectKey,
      uploadUrl: `r2://canopyproof-evidence/${objectKey}`,
      uploadMethod: "PUT",
      expiresAt: new Date(Date.parse(createdAt) + 15 * 60_000).toISOString(),
      createdAt,
      createdBy: actorId,
      auditEvent,
    };
    this.mediaUploadIntentsById.set(intent.id, intent);
    return intent;
  }

  confirmMediaObject(input: unknown, actorId: string): CanopyProofMediaObject {
    const parsed = mediaObjectConfirmationSchema.parse(input);
    const existingForIntent = this.mediaObjectIdsByIntentId.get(parsed.intentId);
    if (existingForIntent) {
      return this.getMediaObject(existingForIntent);
    }

    const intent = this.getMediaUploadIntent(parsed.intentId);
    const contentHash = parsed.contentHash.toLowerCase();
    if (contentHash !== intent.contentHash) {
      throw new Error("CanopyProof media object contentHash must match the upload intent.");
    }
    if (parsed.objectKey !== intent.objectKey) {
      throw new Error("CanopyProof media object objectKey must match the upload intent.");
    }
    if (parsed.byteLength !== intent.byteLength) {
      throw new Error("CanopyProof media object byteLength must match the upload intent.");
    }

    const duplicateOfMediaObjectId = this.mediaObjectIdByContentHash.get(contentHash);
    const mediaState = classifyMediaObjectState(parsed.malwareScan.status, duplicateOfMediaObjectId);
    const payload = {
      intentId: intent.id,
      projectId: intent.projectId,
      evidenceId: intent.evidenceId,
      contentHash,
      contentType: intent.contentType,
      byteLength: parsed.byteLength,
      objectKey: parsed.objectKey,
      storageProvider: parsed.storageProvider,
      encryption: {
        atRest: true as const,
        mode: parsed.encryption.mode,
        ...(parsed.encryption.keyRef ? { keyRef: parsed.encryption.keyRef } : {}),
      },
      malwareScan: {
        status: parsed.malwareScan.status,
        scanner: parsed.malwareScan.scanner,
        ...(parsed.malwareScan.scannedAt ? { scannedAt: parsed.malwareScan.scannedAt } : {}),
        ...(parsed.malwareScan.signatureVersion ? { signatureVersion: parsed.malwareScan.signatureVersion } : {}),
      },
      mediaState,
      duplicateOfMediaObjectId: duplicateOfMediaObjectId ?? null,
      ...(parsed.exifHash ? { exifHash: parsed.exifHash.toLowerCase() } : {}),
      ...(parsed.gpsHash ? { gpsHash: parsed.gpsHash.toLowerCase() } : {}),
      storedAt: parsed.storedAt,
      confirmedBy: actorId,
    };
    const integrityRoot = hashJson({ kind: "canopyproof-media-object-integrity-v1", ...payload });
    const id = `cp_media_object_${integrityRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: mediaState === "available" ? "FULFILL" : mediaState === "pending_scan" ? "REASON" : "CHALLENGE",
      actor: actorId,
      entityType: "media_object",
      entityId: id,
      payload: {
        ...payload,
        integrityRoot,
      },
      createdAt: parsed.storedAt,
      rationale:
        mediaState === "available"
          ? "Content-addressed evidence media object confirmed with encryption-at-rest and clean malware scan."
          : "Evidence media object requires review before it can support proof lineage.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof media object confirmation failed to append audit event.");
    }

    const mediaObject: CanopyProofMediaObject = {
      id,
      intentId: intent.id,
      projectId: intent.projectId,
      evidenceId: intent.evidenceId,
      contentHash,
      contentType: intent.contentType,
      byteLength: parsed.byteLength,
      objectKey: parsed.objectKey,
      storageProvider: parsed.storageProvider,
      encryption: {
        atRest: true,
        mode: parsed.encryption.mode,
        ...(parsed.encryption.keyRef ? { keyRef: parsed.encryption.keyRef } : {}),
      },
      malwareScan: {
        status: parsed.malwareScan.status,
        scanner: parsed.malwareScan.scanner,
        ...(parsed.malwareScan.scannedAt ? { scannedAt: parsed.malwareScan.scannedAt } : {}),
        ...(parsed.malwareScan.signatureVersion ? { signatureVersion: parsed.malwareScan.signatureVersion } : {}),
      },
      mediaState,
      ...(duplicateOfMediaObjectId ? { duplicateOfMediaObjectId } : {}),
      ...(parsed.exifHash ? { exifHash: parsed.exifHash.toLowerCase() } : {}),
      ...(parsed.gpsHash ? { gpsHash: parsed.gpsHash.toLowerCase() } : {}),
      integrityRoot,
      storedAt: parsed.storedAt,
      confirmedBy: actorId,
      auditEvent,
    };
    this.mediaObjectsById.set(mediaObject.id, mediaObject);
    this.mediaObjectIdsByIntentId.set(intent.id, mediaObject.id);
    if (!duplicateOfMediaObjectId) {
      this.mediaObjectIdByContentHash.set(contentHash, mediaObject.id);
    }
    if (mediaObject.mediaState !== "available") {
      this.openEvidenceReviewTask(
        {
          sourceType: "media_object",
          sourceId: mediaObject.id,
          evidenceId: mediaObject.evidenceId,
          reasonCodes: reviewReasonsForMediaObject(mediaObject),
          severity: reviewSeverityForMediaObject(mediaObject),
          openedAt: mediaObject.storedAt,
          policyId: "canopyproof-evidence-media-review-v1",
        },
        actorId,
      );
    }
    return mediaObject;
  }

  listMediaObjects(evidenceId?: string) {
    return [...this.mediaObjectsById.values()]
      .filter((mediaObject) => !evidenceId || mediaObject.evidenceId === evidenceId)
      .sort((left, right) => right.storedAt.localeCompare(left.storedAt));
  }

  getMediaObject(id: string) {
    const mediaObject = this.mediaObjectsById.get(id);
    if (!mediaObject) {
      throw new Error(`CanopyProof media object not found: ${id}`);
    }
    return mediaObject;
  }

  getMediaUploadIntent(id: string) {
    const intent = this.mediaUploadIntentsById.get(id);
    if (!intent) {
      throw new Error(`CanopyProof media upload intent not found: ${id}`);
    }
    return intent;
  }

  recordConsentReceipt(input: unknown, actorId: string): CanopyProofConsentReceipt {
    const parsed = consentReceiptSchema.parse(input);
    const payload = {
      subjectId: parsed.subjectId,
      ...(parsed.deviceFingerprintHash ? { deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase() } : {}),
      purposes: [...new Set(parsed.purposes)].sort(),
      lawfulBasis: parsed.lawfulBasis,
      privacyMode: parsed.privacyMode,
      policyVersion: parsed.policyVersion,
      evidenceHash: parsed.evidenceHash.toLowerCase(),
      grantedAt: parsed.grantedAt,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      retentionDays: parsed.retentionDays,
    };
    const receiptRoot = hashJson({ kind: "canopyproof-consent-receipt-v1", ...payload });
    const id = `cp_consent_${receiptRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "consent_receipt",
      entityId: id,
      payload: {
        ...payload,
        receiptRoot,
      },
      createdAt: parsed.grantedAt,
      rationale: "Privacy-preserving field evidence consent receipt recorded before device-bound evidence processing.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof consent receipt failed to append audit event.");
    }

    const receipt: CanopyProofConsentReceipt = {
      id,
      subjectId: parsed.subjectId,
      ...(parsed.deviceFingerprintHash ? { deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase() } : {}),
      purposes: payload.purposes,
      lawfulBasis: parsed.lawfulBasis,
      privacyMode: parsed.privacyMode,
      policyVersion: parsed.policyVersion,
      evidenceHash: parsed.evidenceHash.toLowerCase(),
      grantedAt: parsed.grantedAt,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      retentionDays: parsed.retentionDays,
      receiptRoot,
      auditEvent,
    };
    this.consentReceiptsById.set(receipt.id, receipt);
    return receipt;
  }

  revokeConsentReceipt(receiptId: string, input: unknown, actorId: string): CanopyProofConsentReceipt {
    const parsed = consentRevocationSchema.parse(input);
    const current = this.getConsentReceipt(receiptId);
    const auditEvent = appendCanopyProofAuditEvent([current.auditEvent], {
      action: "CHALLENGE",
      actor: actorId,
      entityType: "consent_receipt",
      entityId: receiptId,
      payload: {
        receiptId,
        revokedAt: parsed.revokedAt,
        reasonHash: hashJson({ kind: "canopyproof-consent-revocation-reason-v1", reason: parsed.reason }),
      },
      createdAt: parsed.revokedAt,
      rationale: "Consent receipt revoked; future device-bound evidence processing must fail closed.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof consent revocation failed to append audit event.");
    }
    const revoked: CanopyProofConsentReceipt = {
      ...current,
      revokedAt: parsed.revokedAt,
      revocationReason: parsed.reason,
      auditEvent,
    };
    this.consentReceiptsById.set(receiptId, revoked);
    return revoked;
  }

  listConsentReceipts(subjectId?: string) {
    return [...this.consentReceiptsById.values()]
      .filter((receipt) => !subjectId || receipt.subjectId === subjectId)
      .sort((left, right) => right.grantedAt.localeCompare(left.grantedAt));
  }

  getConsentReceipt(receiptId: string) {
    const receipt = this.consentReceiptsById.get(receiptId);
    if (!receipt) {
      throw new Error(`CanopyProof consent receipt not found: ${receiptId}`);
    }
    return receipt;
  }

  recordDeviceAttestation(input: unknown, actorId: string): CanopyProofDeviceAttestation {
    const parsed = deviceAttestationSchema.parse(input);
    const consent = this.getConsentReceipt(parsed.consentReceiptId);
    assertConsentActive(consent, parsed.issuedAt);
    if (consent.subjectId !== parsed.subjectId) {
      throw new Error("CanopyProof device attestation subjectId must match the consent receipt.");
    }
    if (consent.deviceFingerprintHash && consent.deviceFingerprintHash !== parsed.deviceFingerprintHash.toLowerCase()) {
      throw new Error("CanopyProof device attestation deviceFingerprintHash must match the consent receipt.");
    }
    if (!consent.purposes.includes("evidence_collection")) {
      throw new Error("CanopyProof device attestation requires evidence_collection consent purpose.");
    }

    const payload = {
      subjectId: parsed.subjectId,
      deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase(),
      consentReceiptId: parsed.consentReceiptId,
      attestationType: parsed.attestationType,
      publicKeyHash: parsed.publicKeyHash.toLowerCase(),
      attestationHash: parsed.attestationHash.toLowerCase(),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      reputationScore: parsed.reputationScore,
      riskFlags: [...new Set(parsed.riskFlags)].sort(),
    };
    const attestationRoot = hashJson({ kind: "canopyproof-device-attestation-v1", ...payload });
    const id = `cp_device_${attestationRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([consent.auditEvent], {
      action: payload.riskFlags.length > 0 ? "CHALLENGE" : "ASSERT",
      actor: actorId,
      entityType: "device_attestation",
      entityId: id,
      payload: {
        ...payload,
        attestationRoot,
      },
      createdAt: parsed.issuedAt,
      rationale:
        payload.riskFlags.length > 0
          ? "Device attestation recorded with risk flags; downstream evidence metadata must require human review."
          : "Device attestation recorded for privacy-preserving field evidence collection.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof device attestation failed to append audit event.");
    }

    const attestation: CanopyProofDeviceAttestation = {
      id,
      subjectId: parsed.subjectId,
      deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase(),
      consentReceiptId: parsed.consentReceiptId,
      attestationType: parsed.attestationType,
      publicKeyHash: parsed.publicKeyHash.toLowerCase(),
      attestationHash: parsed.attestationHash.toLowerCase(),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      reputationScore: parsed.reputationScore,
      riskFlags: payload.riskFlags,
      attestationRoot,
      auditEvent,
    };
    this.deviceAttestationsById.set(attestation.id, attestation);
    return attestation;
  }

  listDeviceAttestations(subjectId?: string) {
    return [...this.deviceAttestationsById.values()]
      .filter((attestation) => !subjectId || attestation.subjectId === subjectId)
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  }

  getDeviceAttestation(attestationId: string) {
    const attestation = this.deviceAttestationsById.get(attestationId);
    if (!attestation) {
      throw new Error(`CanopyProof device attestation not found: ${attestationId}`);
    }
    return attestation;
  }

  extractMediaMetadata(input: unknown, actorId: string): CanopyProofMediaMetadataExtraction {
    const parsed = mediaMetadataExtractionSchema.parse(input);
    const mediaObject = this.getMediaObject(parsed.mediaObjectId);
    if (mediaObject.mediaState !== "available") {
      throw new Error("CanopyProof media metadata extraction requires an available clean media object.");
    }
    if (mediaObject.exifHash && mediaObject.exifHash !== parsed.exifHash.toLowerCase()) {
      throw new Error("CanopyProof extracted EXIF hash must match the confirmed media object.");
    }
    if (mediaObject.gpsHash && mediaObject.gpsHash !== parsed.gpsHash.toLowerCase()) {
      throw new Error("CanopyProof extracted GPS hash must match the confirmed media object.");
    }

    const consent = this.getConsentReceipt(parsed.consentReceiptId);
    const attestation = this.getDeviceAttestation(parsed.deviceAttestationId);
    assertConsentActive(consent, parsed.extractedAt);
    assertAttestationActive(attestation, parsed.extractedAt);
    if (consent.subjectId !== attestation.subjectId) {
      throw new Error("CanopyProof metadata extraction consent subject must match device attestation subject.");
    }
    if (consent.deviceFingerprintHash && consent.deviceFingerprintHash !== attestation.deviceFingerprintHash) {
      throw new Error("CanopyProof metadata extraction consent device must match device attestation.");
    }
    if (!consent.purposes.includes("geolocation") || !consent.purposes.includes("media_upload")) {
      throw new Error("CanopyProof metadata extraction requires geolocation and media_upload consent purposes.");
    }

    const location: CanopyProofMediaMetadataExtraction["location"] =
      typeof parsed.location.regionId === "string"
        ? {
            latitude: parsed.location.latitude,
            longitude: parsed.location.longitude,
            accuracyMeters: parsed.location.accuracyMeters,
            regionId: parsed.location.regionId,
          }
        : {
            latitude: parsed.location.latitude,
            longitude: parsed.location.longitude,
            accuracyMeters: parsed.location.accuracyMeters,
          };
    const sensorMetadata = {
      networkType: parsed.sensorMetadata.networkType,
      ...(typeof parsed.sensorMetadata.altitudeMeters === "number" ? { altitudeMeters: parsed.sensorMetadata.altitudeMeters } : {}),
      ...(typeof parsed.sensorMetadata.headingDegrees === "number" ? { headingDegrees: parsed.sensorMetadata.headingDegrees } : {}),
      ...(typeof parsed.sensorMetadata.horizontalAccuracyMeters === "number"
        ? { horizontalAccuracyMeters: parsed.sensorMetadata.horizontalAccuracyMeters }
        : {}),
      ...(typeof parsed.sensorMetadata.clockSkewSeconds === "number" ? { clockSkewSeconds: parsed.sensorMetadata.clockSkewSeconds } : {}),
    };
    const issues = metadataExtractionIssues({
      accuracyMeters: location.accuracyMeters,
      consent,
      attestation,
      ...(typeof sensorMetadata.clockSkewSeconds === "number" ? { clockSkewSeconds: sensorMetadata.clockSkewSeconds } : {}),
    });
    const extractionState = issues.length > 0 ? "needs_review" : "accepted";
    const payload = {
      mediaObjectId: mediaObject.id,
      evidenceId: mediaObject.evidenceId,
      consentReceiptId: consent.id,
      deviceAttestationId: attestation.id,
      extractorVersion: parsed.extractorVersion,
      extractedAt: parsed.extractedAt,
      observedAt: parsed.observedAt,
      exifHash: parsed.exifHash.toLowerCase(),
      gpsHash: parsed.gpsHash.toLowerCase(),
      location,
      sensorMetadata,
      extractionState,
      issues,
    };
    const metadataRoot = hashJson({ kind: "canopyproof-media-metadata-extraction-v1", ...payload });
    const id = `cp_metadata_${metadataRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([mediaObject.auditEvent, consent.auditEvent, attestation.auditEvent], {
      action: extractionState === "accepted" ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "media_metadata_extraction",
      entityId: id,
      payload: {
        ...payload,
        metadataRoot,
      },
      createdAt: parsed.extractedAt,
      rationale:
        extractionState === "accepted"
          ? "EXIF/GPS metadata extraction is bound to clean media, active consent, and active device attestation."
          : "EXIF/GPS metadata extraction requires human review before proof lineage can use it.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof media metadata extraction failed to append audit event.");
    }

    const extraction: CanopyProofMediaMetadataExtraction = {
      id,
      mediaObjectId: mediaObject.id,
      evidenceId: mediaObject.evidenceId,
      consentReceiptId: consent.id,
      deviceAttestationId: attestation.id,
      extractorVersion: parsed.extractorVersion,
      extractedAt: parsed.extractedAt,
      observedAt: parsed.observedAt,
      exifHash: parsed.exifHash.toLowerCase(),
      gpsHash: parsed.gpsHash.toLowerCase(),
      location,
      sensorMetadata,
      extractionState,
      issues,
      metadataRoot,
      auditEvent,
    };
    this.metadataExtractionsById.set(extraction.id, extraction);
    if (extraction.extractionState === "needs_review") {
      this.openEvidenceReviewTask(
        {
          sourceType: "media_metadata_extraction",
          sourceId: extraction.id,
          evidenceId: extraction.evidenceId,
          reasonCodes: extraction.issues,
          severity: reviewSeverityForMetadataExtraction(extraction),
          openedAt: extraction.extractedAt,
          policyId: "canopyproof-metadata-review-v1",
        },
        actorId,
      );
    }
    return extraction;
  }

  listMediaMetadataExtractions(evidenceId?: string) {
    return [...this.metadataExtractionsById.values()]
      .filter((extraction) => !evidenceId || extraction.evidenceId === evidenceId)
      .sort((left, right) => right.extractedAt.localeCompare(left.extractedAt));
  }

  getMediaMetadataExtraction(extractionId: string) {
    const extraction = this.metadataExtractionsById.get(extractionId);
    if (!extraction) {
      throw new Error(`CanopyProof media metadata extraction not found: ${extractionId}`);
    }
    return extraction;
  }

  openEvidenceReviewTask(input: unknown, actorId: string): CanopyProofEvidenceReviewTask {
    const parsed = evidenceReviewTaskSchema.parse(input);
    const reasonCodes = [...new Set(parsed.reasonCodes)].sort();
    const sourceKey = `${parsed.sourceType}:${parsed.sourceId}:${reasonCodes.join("|")}`;
    const existingTaskId = this.reviewTaskIdsBySource.get(sourceKey);
    if (existingTaskId) {
      return this.getEvidenceReviewTask(existingTaskId);
    }
    assertReviewTaskSourceExists(this, parsed.sourceType, parsed.sourceId);
    const payload = {
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      ...(parsed.evidenceId ? { evidenceId: parsed.evidenceId } : {}),
      reasonCodes,
      severity: parsed.severity,
      status: parsed.assignedTo ? "assigned" : ("open" as const),
      openedAt: parsed.openedAt,
      ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
      ...(parsed.assignedTo ? { assignedTo: parsed.assignedTo } : {}),
      ...(parsed.policyId ? { policyId: parsed.policyId } : {}),
    };
    const taskRoot = hashJson({ kind: "canopyproof-evidence-review-task-v1", ...payload });
    const id = `cp_review_${taskRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: parsed.severity === "critical" || parsed.severity === "high" ? "CHALLENGE" : "REASON",
      actor: actorId,
      entityType: "evidence_review_task",
      entityId: id,
      payload: {
        ...payload,
        taskRoot,
      },
      createdAt: parsed.openedAt,
      rationale: "Evidence Network moderation review task opened for non-final evidence artifact.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof evidence review task failed to append audit event.");
    }
    const task: CanopyProofEvidenceReviewTask = {
      id,
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      ...(parsed.evidenceId ? { evidenceId: parsed.evidenceId } : {}),
      reasonCodes,
      severity: parsed.severity,
      status: parsed.assignedTo ? "assigned" : "open",
      openedAt: parsed.openedAt,
      ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
      ...(parsed.assignedTo ? { assignedTo: parsed.assignedTo } : {}),
      ...(parsed.policyId ? { policyId: parsed.policyId } : {}),
      taskRoot,
      auditEvent,
    };
    this.reviewTasksById.set(task.id, task);
    this.reviewTaskIdsBySource.set(sourceKey, task.id);
    return task;
  }

  resolveEvidenceReviewTask(taskId: string, input: unknown, actorId: string): CanopyProofEvidenceReviewTask {
    const parsed = evidenceReviewTaskResolutionSchema.parse(input);
    const current = this.getEvidenceReviewTask(taskId);
    const status = parsed.decision === "escalate" ? "escalated" : "resolved";
    const payload = {
      taskId,
      sourceType: current.sourceType,
      sourceId: current.sourceId,
      reasonCodes: current.reasonCodes,
      decision: parsed.decision,
      status,
      resolvedAt: parsed.resolvedAt,
      resolvedBy: actorId,
      rationaleHash: hashJson({ kind: "canopyproof-review-resolution-rationale-v1", rationale: parsed.rationale }),
    };
    const auditEvent = appendCanopyProofAuditEvent([current.auditEvent], {
      action: parsed.decision === "accept" ? "FULFILL" : parsed.decision === "escalate" ? "CHALLENGE" : "REASON",
      actor: actorId,
      entityType: "evidence_review_task",
      entityId: taskId,
      payload,
      createdAt: parsed.resolvedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof evidence review task resolution failed to append audit event.");
    }
    const resolved: CanopyProofEvidenceReviewTask = {
      ...current,
      status,
      resolvedAt: parsed.resolvedAt,
      resolvedBy: actorId,
      decision: parsed.decision,
      rationale: parsed.rationale,
      auditEvent,
    };
    this.reviewTasksById.set(taskId, resolved);
    return resolved;
  }

  listEvidenceReviewTasks(filters: { readonly status?: string; readonly sourceType?: string } = {}) {
    return [...this.reviewTasksById.values()]
      .filter((task) => !filters.status || task.status === filters.status)
      .filter((task) => !filters.sourceType || task.sourceType === filters.sourceType)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt));
  }

  getEvidenceReviewTask(taskId: string) {
    const task = this.reviewTasksById.get(taskId);
    if (!task) {
      throw new Error(`CanopyProof evidence review task not found: ${taskId}`);
    }
    return task;
  }

  recordRetentionPolicyDecision(input: unknown, actorId: string): CanopyProofRetentionPolicyDecision {
    const parsed = retentionPolicyDecisionSchema.parse(input);
    assertRetentionSourceExists(this, parsed.sourceType, parsed.sourceId);
    const sourceKey = `${parsed.sourceType}:${parsed.sourceId}:${parsed.basis}:${parsed.disposition}:${parsed.evaluatedAt}`;
    const existingDecisionId = this.retentionPolicyDecisionIdsBySource.get(sourceKey);
    if (existingDecisionId) {
      return this.getRetentionPolicyDecision(existingDecisionId);
    }
    const payload = {
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      ...(parsed.evidenceId ? { evidenceId: parsed.evidenceId } : {}),
      ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}),
      basis: parsed.basis,
      disposition: parsed.disposition,
      ...(parsed.retainUntil ? { retainUntil: parsed.retainUntil } : {}),
      legalHold: parsed.legalHold,
      evaluatedAt: parsed.evaluatedAt,
      rationaleHash: hashJson({ kind: "canopyproof-retention-rationale-v1", rationale: parsed.rationale }),
    };
    const decisionRoot = hashJson({ kind: "canopyproof-retention-policy-decision-v1", ...payload });
    const id = `cp_retention_${decisionRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: parsed.disposition === "legal_hold" ? "CHALLENGE" : "REASON",
      actor: actorId,
      entityType: "retention_policy_decision",
      entityId: id,
      payload: {
        ...payload,
        decisionRoot,
      },
      createdAt: parsed.evaluatedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof retention policy decision failed to append audit event.");
    }
    const decision: CanopyProofRetentionPolicyDecision = {
      id,
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      ...(parsed.evidenceId ? { evidenceId: parsed.evidenceId } : {}),
      ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}),
      basis: parsed.basis,
      disposition: parsed.disposition,
      ...(parsed.retainUntil ? { retainUntil: parsed.retainUntil } : {}),
      legalHold: parsed.legalHold,
      evaluatedAt: parsed.evaluatedAt,
      rationale: parsed.rationale,
      decisionRoot,
      auditEvent,
    };
    this.retentionPolicyDecisionsById.set(decision.id, decision);
    this.retentionPolicyDecisionIdsBySource.set(sourceKey, decision.id);
    return decision;
  }

  evaluateRetentionPolicies(input: unknown, actorId: string) {
    const parsed = retentionPolicyEvaluationSchema.parse(input);
    const decisions: CanopyProofRetentionPolicyDecision[] = [];
    for (const receipt of this.consentReceiptsById.values()) {
      const retainUntil = retentionDeadline(receipt);
      if (receipt.revokedAt && Date.parse(receipt.revokedAt) <= Date.parse(parsed.evaluatedAt)) {
        decisions.push(
          this.recordRetentionPolicyDecision(
            {
              sourceType: "consent_receipt",
              sourceId: receipt.id,
              subjectId: receipt.subjectId,
              basis: "revoked_consent",
              disposition: "minimize",
              retainUntil,
              legalHold: false,
              evaluatedAt: parsed.evaluatedAt,
              rationale: "Consent was revoked; evidence metadata must be minimized until legal retention is satisfied.",
            },
            actorId,
          ),
        );
      }
      if (Date.parse(retainUntil) <= Date.parse(parsed.evaluatedAt)) {
        decisions.push(
          this.recordRetentionPolicyDecision(
            {
              sourceType: "consent_receipt",
              sourceId: receipt.id,
              subjectId: receipt.subjectId,
              basis: "consent_retention",
              disposition: "tombstone_after_retention",
              retainUntil,
              legalHold: false,
              evaluatedAt: parsed.evaluatedAt,
              rationale: "Consent retention window elapsed; future processing must use tombstone/minimized state.",
            },
            actorId,
          ),
        );
      }
    }
    for (const extraction of this.metadataExtractionsById.values()) {
      const receipt = this.getConsentReceipt(extraction.consentReceiptId);
      const retainUntil = retentionDeadline(receipt);
      if ((receipt.revokedAt || Date.parse(retainUntil) <= Date.parse(parsed.evaluatedAt)) && Date.parse(receipt.grantedAt) <= Date.parse(parsed.evaluatedAt)) {
        decisions.push(
          this.recordRetentionPolicyDecision(
            {
              sourceType: "media_metadata_extraction",
              sourceId: extraction.id,
              evidenceId: extraction.evidenceId,
              subjectId: receipt.subjectId,
              basis: receipt.revokedAt ? "revoked_consent" : "consent_retention",
              disposition: receipt.revokedAt ? "minimize" : "tombstone_after_retention",
              retainUntil,
              legalHold: false,
              evaluatedAt: parsed.evaluatedAt,
              rationale: "Metadata extraction is bound to consent and follows the same retention/minimization policy.",
            },
            actorId,
          ),
        );
      }
    }
    return {
      evaluatedAt: parsed.evaluatedAt,
      decisionCount: decisions.length,
      decisions,
      evaluationRoot: hashJson({
        kind: "canopyproof-retention-policy-evaluation-v1",
        evaluatedAt: parsed.evaluatedAt,
        decisionRoots: decisions.map((decision) => decision.decisionRoot).sort(),
      }),
    };
  }

  listRetentionPolicyDecisions(filters: { readonly sourceType?: string; readonly disposition?: string } = {}) {
    return [...this.retentionPolicyDecisionsById.values()]
      .filter((decision) => !filters.sourceType || decision.sourceType === filters.sourceType)
      .filter((decision) => !filters.disposition || decision.disposition === filters.disposition)
      .sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt));
  }

  getRetentionPolicyDecision(decisionId: string) {
    const decision = this.retentionPolicyDecisionsById.get(decisionId);
    if (!decision) {
      throw new Error(`CanopyProof retention policy decision not found: ${decisionId}`);
    }
    return decision;
  }

  syncOfflineBatch(input: unknown, actorId: string, idempotencyKey: string): CanopyProofOfflineSyncBatch {
    if (!idempotencyKey.trim()) {
      throw new Error("CanopyProof offline sync requires Idempotency-Key.");
    }
    const replayKey = `${actorId}:${idempotencyKey.trim()}`;
    const existingBatchId = this.syncBatchIdsByIdempotencyKey.get(replayKey);
    if (existingBatchId) {
      const existing = this.getSyncBatch(existingBatchId);
      return {
        ...existing,
        replayed: true,
      };
    }

    const parsed = offlineSyncBatchSchema.parse(input);
    const receivedAt = parsed.submittedAt ?? new Date(0).toISOString();
    const itemResults: CanopyProofOfflineSyncItemResult[] = [];

    for (const item of parsed.evidence) {
      const evidenceInput = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const evidenceId = typeof evidenceInput.id === "string" ? evidenceInput.id : undefined;
      const before = evidenceId ? this.proofService.findEvidence(evidenceId) : undefined;
      const result = this.proofService.submitEvidence({
        ...evidenceInput,
        contributor: actorId,
        ...(parsed.projectId && typeof evidenceInput.projectId !== "string" ? { projectId: parsed.projectId } : {}),
        ...(typeof evidenceInput.device_fingerprint_hash !== "string"
          ? { device_fingerprint_hash: parsed.deviceFingerprintHash.toLowerCase() }
          : {}),
        ...(typeof evidenceInput.offline_sync_id !== "string" ? { offline_sync_id: parsed.batchId ?? idempotencyKey.trim() } : {}),
      });
      itemResults.push(toSyncItemResult(result, before));
    }

    const acceptedCount = itemResults.filter((item) => item.status === "accepted").length;
    const challengedCount = itemResults.filter((item) => item.status === "challenged").length;
    const duplicateCount = itemResults.filter((item) => item.status === "duplicate").length;
    const conflictCount = itemResults.filter((item) => item.status === "conflict").length;
    const status =
      conflictCount > 0 ? "conflict_review" : challengedCount > 0 ? "partial_review" : ("accepted" as const);
    const evidenceIds = itemResults.map((item) => item.evidenceId).sort();
    const syncSeed = {
      actorId,
      idempotencyKey: idempotencyKey.trim(),
      deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase(),
      receivedAt,
      evidenceIds,
      itemRoots: itemResults.map((item) => hashJson({ evidenceId: item.evidenceId, status: item.status, issues: item.issues })).sort(),
    };
    const syncRoot = hashJson({ kind: "canopyproof-offline-sync-root-v1", ...syncSeed });
    const id = parsed.batchId ?? `cp_sync_${syncRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: conflictCount > 0 ? "CHALLENGE" : "ASSERT",
      actor: actorId,
      entityType: "evidence_sync_batch",
      entityId: id,
      payload: {
        ...syncSeed,
        status,
        acceptedCount,
        challengedCount,
        duplicateCount,
        conflictCount,
      },
      createdAt: receivedAt,
      rationale: "Offline evidence sync batch processed idempotently without overwriting conflicting evidence.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof offline sync batch failed to append audit event.");
    }
    const batch: CanopyProofOfflineSyncBatch = {
      id,
      idempotencyKey: idempotencyKey.trim(),
      submittedBy: actorId,
      deviceFingerprintHash: parsed.deviceFingerprintHash.toLowerCase(),
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      receivedAt,
      status,
      replayed: false,
      evidenceIds,
      acceptedCount,
      challengedCount,
      duplicateCount,
      conflictCount,
      itemResults,
      syncRoot,
      auditEvent,
    };
    this.syncBatchesById.set(batch.id, batch);
    this.syncBatchIdsByIdempotencyKey.set(replayKey, batch.id);
    return batch;
  }

  listSyncBatches() {
    return [...this.syncBatchesById.values()].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
  }

  getSyncBatch(batchId: string) {
    const batch = this.syncBatchesById.get(batchId);
    if (!batch) {
      throw new Error(`CanopyProof offline sync batch not found: ${batchId}`);
    }
    return batch;
  }

  getEvidence(evidenceId: string) {
    return this.proofService.getEvidence(evidenceId);
  }

  recordCommunityAttestation(evidenceId: string, input: unknown, actorId: string): CanopyProofCommunityAttestation {
    const parsed = communityAttestationSchema.parse(input);
    const current = this.proofService.getEvidence(evidenceId);
    const action = parsed.stance === "challenge" ? "CHALLENGE" : parsed.stance === "support" ? "ASSERT" : "REASON";
    const payload = {
      evidenceId,
      attester: actorId,
      stance: parsed.stance,
      note: parsed.note,
      observedAt: parsed.observedAt,
      confidence_score: parsed.confidence_score,
      ...(parsed.media_hash ? { media_hash: parsed.media_hash.toLowerCase() } : {}),
      ...(parsed.gps_hash ? { gps_hash: parsed.gps_hash.toLowerCase() } : {}),
      ...(parsed.device_fingerprint_hash ? { device_fingerprint_hash: parsed.device_fingerprint_hash.toLowerCase() } : {}),
    };
    const attestationRoot = hashJson({ kind: "canopyproof-community-attestation-v1", ...payload });
    const update = this.proofService.appendEvidenceAuditEvent(evidenceId, {
      action,
      actor: actorId,
      entityType: "community_attestation",
      payload: {
        ...payload,
        attestationRoot,
      },
      createdAt: parsed.observedAt,
      rationale:
        parsed.stance === "challenge"
          ? "Community attestation challenged field evidence and routed it back to human review."
          : "Community attestation added non-final supporting context for human verification.",
      reviewers: [actorId],
      verification_status: parsed.stance === "challenge" ? "challenged" : current.verification_status,
      confidence_score: parsed.stance === "challenge" ? Math.min(current.confidence_score, parsed.confidence_score, 35) : current.confidence_score,
    });
    const id = `cp_attest_${attestationRoot.slice(0, 24)}`;
    const attestation: CanopyProofCommunityAttestation = {
      id,
      evidenceId,
      attester: actorId,
      stance: parsed.stance,
      note: parsed.note,
      observedAt: parsed.observedAt,
      confidence_score: parsed.confidence_score,
      ...(parsed.media_hash ? { media_hash: parsed.media_hash.toLowerCase() } : {}),
      ...(parsed.gps_hash ? { gps_hash: parsed.gps_hash.toLowerCase() } : {}),
      ...(parsed.device_fingerprint_hash ? { device_fingerprint_hash: parsed.device_fingerprint_hash.toLowerCase() } : {}),
      attestationRoot,
      auditEvent: update.auditEvent,
      evidence: update.evidence,
    };
    this.attestationsById.set(attestation.id, attestation);
    return attestation;
  }

  listCommunityAttestations(evidenceId?: string) {
    return [...this.attestationsById.values()]
      .filter((attestation) => !evidenceId || attestation.evidenceId === evidenceId)
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt));
  }

  recordCustodyEvent(input: unknown, actorId: string): CanopyProofEvidenceCustodyEvent {
    const parsed = evidenceCustodyEventSchema.parse(input);
    assertNoRawContactText([parsed.evidenceId, parsed.artifactId, parsed.custodianOrganizationId ?? "", parsed.custodyNote, parsed.policyId ?? ""]);
    const sourceRoot = resolveCustodySourceRoot(this, parsed.evidenceId, parsed.artifactType, parsed.artifactId);
    const previousCustodyRoot =
      this.latestCustodyRootByEvidenceId.get(parsed.evidenceId) ?? hashJson({ kind: "canopyproof-empty-custody-root-v1", evidenceId: parsed.evidenceId });
    const custodySeed = {
      evidenceId: parsed.evidenceId,
      action: parsed.action,
      artifactType: parsed.artifactType,
      artifactId: parsed.artifactId,
      sourceRoot,
      previousCustodyRoot,
      custodianId: actorId,
      custodianOrganizationId: parsed.custodianOrganizationId ?? null,
      custodyNoteHash: hashJson({ kind: "canopyproof-evidence-custody-note-v1", note: parsed.custodyNote }),
      occurredAt: parsed.occurredAt,
      policyId: parsed.policyId ?? null,
    };
    const custodyRoot = hashJson({
      kind: "canopyproof-evidence-custody-root-v1",
      ...custodySeed,
      safety: evidenceCustodySafetyBoundary(),
    });
    const custodyHash = hashJson({ kind: "canopyproof-evidence-custody-event-v1", ...custodySeed, custodyRoot });
    const id = `cp_custody_${custodyHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: custodyActionToAhin(parsed.action),
      actor: actorId,
      entityType: "evidence_custody_event",
      entityId: id,
      payload: {
        ...custodySeed,
        custodyRoot,
        custodyHash,
        safety: evidenceCustodySafetyBoundary(),
      },
      createdAt: parsed.occurredAt,
      rationale: "Evidence chain-of-custody event appended with source-root and previous-root linkage.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof evidence custody event failed to append audit event.");
    }
    const custodyEvent: CanopyProofEvidenceCustodyEvent = {
      id,
      evidenceId: parsed.evidenceId,
      action: parsed.action,
      artifactType: parsed.artifactType,
      artifactId: parsed.artifactId,
      sourceRoot,
      previousCustodyRoot,
      custodianId: actorId,
      ...(parsed.custodianOrganizationId ? { custodianOrganizationId: parsed.custodianOrganizationId } : {}),
      custodyNote: parsed.custodyNote,
      occurredAt: parsed.occurredAt,
      ...(parsed.policyId ? { policyId: parsed.policyId } : {}),
      custodyRoot,
      custodyHash,
      safety: evidenceCustodySafetyBoundary(),
      auditEvent,
    };
    this.custodyEventsById.set(custodyEvent.id, custodyEvent);
    this.latestCustodyRootByEvidenceId.set(custodyEvent.evidenceId, custodyEvent.custodyRoot);
    return custodyEvent;
  }

  listCustodyEvents(evidenceId?: string) {
    return [...this.custodyEventsById.values()]
      .filter((event) => !evidenceId || event.evidenceId === evidenceId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
  }

  getCustodyEvent(custodyEventId: string) {
    const event = this.custodyEventsById.get(custodyEventId);
    if (!event) {
      throw new Error(`CanopyProof evidence custody event not found: ${custodyEventId}`);
    }
    return event;
  }

  getStatus(): CanopyProofEvidenceNetworkStatus {
    const uploadRoots = [...this.mediaUploadIntentsById.values()].map((intent) => intent.auditEvent.eventRoot).sort();
    const mediaObjects = [...this.mediaObjectsById.values()];
    const mediaObjectRoots = mediaObjects.map((mediaObject) => mediaObject.integrityRoot).sort();
    const consentReceipts = [...this.consentReceiptsById.values()];
    const consentRoots = consentReceipts.map((receipt) => receipt.auditEvent.eventRoot).sort();
    const deviceAttestations = [...this.deviceAttestationsById.values()];
    const deviceRoots = deviceAttestations.map((attestation) => attestation.attestationRoot).sort();
    const metadataExtractions = [...this.metadataExtractionsById.values()];
    const metadataRoots = metadataExtractions.map((extraction) => extraction.metadataRoot).sort();
    const reviewTasks = [...this.reviewTasksById.values()];
    const reviewRoots = reviewTasks.map((task) => task.auditEvent.eventRoot).sort();
    const retentionDecisions = [...this.retentionPolicyDecisionsById.values()];
    const retentionRoots = retentionDecisions.map((decision) => decision.decisionRoot).sort();
    const syncBatches = [...this.syncBatchesById.values()];
    const syncRoots = syncBatches.map((batch) => batch.syncRoot).sort();
    const attestationRoots = [...this.attestationsById.values()].map((attestation) => attestation.attestationRoot).sort();
    const custodyRoots = [...this.custodyEventsById.values()].map((event) => event.custodyRoot).sort();
    return {
      service: "canopyproof-evidence-network",
      mediaUploadIntentCount: this.mediaUploadIntentsById.size,
      mediaObjectCount: this.mediaObjectsById.size,
      quarantinedMediaObjectCount: mediaObjects.filter((mediaObject) => mediaObject.mediaState === "quarantined").length,
      pendingScanMediaObjectCount: mediaObjects.filter((mediaObject) => mediaObject.mediaState === "pending_scan").length,
      duplicateMediaObjectCount: mediaObjects.filter((mediaObject) => mediaObject.mediaState === "duplicate").length,
      consentReceiptCount: consentReceipts.length,
      revokedConsentReceiptCount: consentReceipts.filter((receipt) => Boolean(receipt.revokedAt)).length,
      deviceAttestationCount: deviceAttestations.length,
      riskyDeviceAttestationCount: deviceAttestations.filter((attestation) => attestation.riskFlags.length > 0).length,
      mediaMetadataExtractionCount: metadataExtractions.length,
      metadataExtractionNeedsReviewCount: metadataExtractions.filter((extraction) => extraction.extractionState === "needs_review").length,
      evidenceReviewTaskCount: reviewTasks.length,
      openEvidenceReviewTaskCount: reviewTasks.filter((task) => task.status === "open" || task.status === "assigned").length,
      escalatedEvidenceReviewTaskCount: reviewTasks.filter((task) => task.status === "escalated").length,
      retentionPolicyDecisionCount: retentionDecisions.length,
      retentionMinimizationDecisionCount: retentionDecisions.filter((decision) => decision.disposition === "minimize").length,
      offlineSyncBatchCount: this.syncBatchesById.size,
      offlineSyncConflictCount: syncBatches.reduce((sum, batch) => sum + batch.conflictCount, 0),
      communityAttestationCount: this.attestationsById.size,
      custodyEventCount: this.custodyEventsById.size,
      safety: {
        offlineSyncRequiresIdempotencyKey: true,
        duplicateEvidenceIdsBecomeChallenges: true,
        communityAttestationIsNotFinalAuthority: true,
        mediaUploadsAreContentAddressed: true,
        mediaObjectsRequireEncryptionAtRest: true,
        mediaObjectsRequireMalwareScan: true,
        duplicateMediaObjectsAreNotFinalProof: true,
        consentRequiredForDeviceBoundEvidence: true,
        deviceAttestationRequiredForMetadataExtraction: true,
        exifGpsExtractionIsHashBound: true,
        moderationReviewQueueIsHumanGated: true,
        retentionAutomationIsAppendOnly: true,
        custodyChainIsAppendOnly: true,
      },
      networkRoot: hashJson({
        kind: "canopyproof-evidence-network-status-v1",
        uploadRoots,
        mediaObjectRoots,
        consentRoots,
        deviceRoots,
        metadataRoots,
        reviewRoots,
        retentionRoots,
        syncRoots,
        attestationRoots,
        custodyRoots,
      }),
    };
  }
}

function assertConsentActive(receipt: CanopyProofConsentReceipt, at: string) {
  if (receipt.revokedAt && Date.parse(receipt.revokedAt) <= Date.parse(at)) {
    throw new Error("CanopyProof consent receipt has been revoked.");
  }
  if (receipt.expiresAt && Date.parse(receipt.expiresAt) <= Date.parse(at)) {
    throw new Error("CanopyProof consent receipt has expired.");
  }
}

function assertReviewTaskSourceExists(
  service: CanopyProofEvidenceNetworkService,
  sourceType: CanopyProofEvidenceReviewTask["sourceType"],
  sourceId: string,
) {
  if (sourceType === "media_object") {
    service.getMediaObject(sourceId);
    return;
  }
  if (sourceType === "media_metadata_extraction") {
    service.getMediaMetadataExtraction(sourceId);
    return;
  }
  if (sourceType === "offline_sync_batch") {
    service.getSyncBatch(sourceId);
    return;
  }
  if (!service.listCommunityAttestations().some((attestation) => attestation.id === sourceId)) {
    throw new Error(`CanopyProof community attestation not found: ${sourceId}`);
  }
}

function assertRetentionSourceExists(
  service: CanopyProofEvidenceNetworkService,
  sourceType: CanopyProofRetentionPolicyDecision["sourceType"],
  sourceId: string,
) {
  if (sourceType === "consent_receipt") {
    service.getConsentReceipt(sourceId);
    return;
  }
  if (sourceType === "media_metadata_extraction") {
    service.getMediaMetadataExtraction(sourceId);
    return;
  }
  service.getMediaObject(sourceId);
}

function resolveCustodySourceRoot(
  service: CanopyProofEvidenceNetworkService,
  evidenceId: string,
  artifactType: CanopyProofEvidenceCustodyArtifactType,
  artifactId: string,
) {
  if (artifactType === "evidence") {
    if (artifactId !== evidenceId) {
      throw new Error("CanopyProof evidence custody artifactId must match evidenceId for evidence artifacts.");
    }
    const evidence = service.getEvidence(evidenceId);
    return evidence.audit_history.at(-1)?.eventRoot ?? hashJson({ kind: "canopyproof-evidence-custody-evidence-root-v1", evidenceId });
  }
  if (artifactType === "media_upload_intent") {
    const intent = service.getMediaUploadIntent(artifactId);
    assertCustodyEvidenceId(intent.evidenceId, evidenceId, artifactType);
    return intent.auditEvent.eventRoot;
  }
  if (artifactType === "media_object") {
    const mediaObject = service.getMediaObject(artifactId);
    assertCustodyEvidenceId(mediaObject.evidenceId, evidenceId, artifactType);
    return mediaObject.integrityRoot;
  }
  if (artifactType === "media_metadata_extraction") {
    const extraction = service.getMediaMetadataExtraction(artifactId);
    assertCustodyEvidenceId(extraction.evidenceId, evidenceId, artifactType);
    return extraction.metadataRoot;
  }
  if (artifactType === "review_task") {
    const task = service.getEvidenceReviewTask(artifactId);
    assertCustodyEvidenceId(task.evidenceId ?? "", evidenceId, artifactType);
    return task.taskRoot;
  }
  if (artifactType === "retention_policy_decision") {
    const decision = service.getRetentionPolicyDecision(artifactId);
    assertCustodyEvidenceId(decision.evidenceId ?? "", evidenceId, artifactType);
    return decision.decisionRoot;
  }
  if (artifactType === "offline_sync_batch") {
    const batch = service.getSyncBatch(artifactId);
    if (!batch.evidenceIds.includes(evidenceId)) {
      throw new Error("CanopyProof custody offline sync batch must include the evidenceId.");
    }
    return batch.syncRoot;
  }
  const attestation = service.listCommunityAttestations().find((item) => item.id === artifactId);
  if (!attestation) {
    throw new Error(`CanopyProof community attestation not found: ${artifactId}`);
  }
  assertCustodyEvidenceId(attestation.evidenceId, evidenceId, artifactType);
  return attestation.attestationRoot;
}

function assertCustodyEvidenceId(actualEvidenceId: string, expectedEvidenceId: string, artifactType: CanopyProofEvidenceCustodyArtifactType) {
  if (actualEvidenceId !== expectedEvidenceId) {
    throw new Error(`CanopyProof custody ${artifactType} artifact does not belong to evidenceId ${expectedEvidenceId}.`);
  }
}

function custodyActionToAhin(action: CanopyProofEvidenceCustodyAction) {
  if (action === "review_resolved" || action === "retention_decided") return "FULFILL";
  if (action === "review_opened" || action === "community_attested") return "REASON";
  return "ASSERT";
}

function evidenceCustodySafetyBoundary(): CanopyProofEvidenceCustodyEvent["safety"] {
  return {
    appendOnly: true,
    sourceRootBound: true,
    previousRootLinked: true,
    noRawPrivateContactData: true,
    notFinalProofAuthority: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  };
}

function assertNoRawContactText(values: readonly string[]) {
  const rawContactPatterns = [/@/, /\bmailto:/i, /\btel:/i, /\+\d[\d\s().-]{6,}\d/, /\bBEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY\b/i];
  for (const value of values) {
    if (!value) continue;
    for (const pattern of rawContactPatterns) {
      if (pattern.test(value)) {
        throw new Error("CanopyProof evidence custody events must not contain raw private contact data or private keys.");
      }
    }
  }
}

function retentionDeadline(receipt: CanopyProofConsentReceipt) {
  return new Date(Date.parse(receipt.grantedAt) + receipt.retentionDays * 24 * 60 * 60_000).toISOString();
}

function reviewReasonsForMediaObject(mediaObject: CanopyProofMediaObject) {
  const reasons = [];
  if (mediaObject.mediaState === "pending_scan") reasons.push("media_scan_pending");
  if (mediaObject.mediaState === "quarantined") reasons.push("media_quarantined");
  if (mediaObject.mediaState === "duplicate") reasons.push("media_duplicate_content_hash");
  return reasons;
}

function reviewSeverityForMediaObject(mediaObject: CanopyProofMediaObject): CanopyProofEvidenceReviewTask["severity"] {
  if (mediaObject.mediaState === "quarantined") return "critical";
  if (mediaObject.mediaState === "duplicate") return "high";
  return "medium";
}

function reviewSeverityForMetadataExtraction(
  extraction: CanopyProofMediaMetadataExtraction,
): CanopyProofEvidenceReviewTask["severity"] {
  if (extraction.issues.some((issue) => issue.includes("location_mocking") || issue.includes("jailbreak_detected"))) {
    return "high";
  }
  if (extraction.issues.some((issue) => issue.includes("gps_accuracy") || issue.includes("clock_skew"))) {
    return "medium";
  }
  return "low";
}

function assertAttestationActive(attestation: CanopyProofDeviceAttestation, at: string) {
  if (Date.parse(attestation.issuedAt) > Date.parse(at) || Date.parse(attestation.expiresAt) <= Date.parse(at)) {
    throw new Error("CanopyProof device attestation is not active for the requested timestamp.");
  }
}

function metadataExtractionIssues(input: {
  readonly accuracyMeters: number;
  readonly consent: CanopyProofConsentReceipt;
  readonly attestation: CanopyProofDeviceAttestation;
  readonly clockSkewSeconds?: number;
}) {
  const issues: string[] = [];
  if (input.accuracyMeters > 50) issues.push("gps_accuracy_needs_review");
  if (input.consent.privacyMode !== "precise") issues.push("privacy_mode_limits_public_location");
  if (input.attestation.reputationScore < 50) issues.push("device_reputation_needs_review");
  if (input.attestation.riskFlags.length > 0) issues.push(...input.attestation.riskFlags.map((flag) => `device_${flag}`));
  if (typeof input.clockSkewSeconds === "number" && Math.abs(input.clockSkewSeconds) > 300) {
    issues.push("device_clock_skew_needs_review");
  }
  return [...new Set(issues)].sort();
}

function classifyMediaObjectState(
  scanStatus: CanopyProofMediaObject["malwareScan"]["status"],
  duplicateOfMediaObjectId: string | undefined,
): CanopyProofMediaObjectState {
  if (scanStatus === "quarantined") return "quarantined";
  if (scanStatus === "pending") return "pending_scan";
  if (duplicateOfMediaObjectId) return "duplicate";
  return "available";
}

function toSyncItemResult(
  result: CanopyProofEvidenceSubmissionResult,
  before: CanopyProofEvidenceEnvelope | undefined,
): CanopyProofOfflineSyncItemResult {
  const conflict = result.issues.includes("duplicate_evidence_id_conflict");
  const status = conflict ? "conflict" : before ? "duplicate" : result.valid ? "accepted" : "challenged";
  return {
    evidenceId: result.evidence.id,
    status,
    issues: result.issues,
    evidence: result.evidence,
  };
}
