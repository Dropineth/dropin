import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import {
  canopyProofEvidenceCustodyActorAuthorityRoot,
  canopyProofEvidenceCustodyRoles,
  type CanopyProofEvidenceConsentProjection,
  type CanopyProofEvidenceConsentReceiptFact,
  type CanopyProofEvidenceCustodyActorSnapshot,
  type CanopyProofEvidenceDeviceAttestationFact,
  type CanopyProofEvidenceDeviceAttestationProjection,
} from "./evidence-custody-authority.js";
import type { CanopyProofEffectiveDeviceAttestationProjection } from
  "./evidence-device-attestation-adapter-authority.js";

type CanopyProofEvidenceDeviceTrustProjection =
  | CanopyProofEvidenceDeviceAttestationProjection
  | CanopyProofEffectiveDeviceAttestationProjection;

export const canopyProofEvidenceMediaContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/json",
] as const;
export const canopyProofEvidenceMediaStorageProviders = ["cloudflare_r2", "s3", "gcs"] as const;
export const canopyProofEvidenceMediaEncryptionModes = ["r2_managed", "sse_kms", "client_side"] as const;
export const canopyProofEvidenceMediaObjectLockModes = ["none", "governance", "compliance"] as const;
export const canopyProofEvidenceMediaAgentCapabilities = [
  "device_attestation_receipt",
  "object_storage_receipt",
  "malware_scan_result",
  "metadata_extraction_receipt",
  "verified_metadata_extraction_receipt",
  "retention_execution_receipt",
  "verified_retention_execution_receipt",
] as const;
export const canopyProofEvidenceMediaScanVerdicts = ["clean", "malicious", "indeterminate", "error"] as const;

export type CanopyProofEvidenceMediaContentType = (typeof canopyProofEvidenceMediaContentTypes)[number];
export type CanopyProofEvidenceMediaStorageProvider = (typeof canopyProofEvidenceMediaStorageProviders)[number];
export type CanopyProofEvidenceMediaAgentCapability = (typeof canopyProofEvidenceMediaAgentCapabilities)[number];
export type CanopyProofEvidenceMediaScanVerdict = (typeof canopyProofEvidenceMediaScanVerdicts)[number];

export type CanopyProofEvidenceMediaSafetyBoundary = {
  readonly appendOnly: true;
  readonly subjectBound: true;
  readonly organizationBound: true;
  readonly projectBound: true;
  readonly consentBound: true;
  readonly deviceBound: true;
  readonly semanticEventBound: true;
  readonly noPersistedUploadGrant: true;
  readonly noProviderCredential: true;
  readonly quarantineByDefault: true;
  readonly providerVerificationRequiredForAvailability: true;
  readonly scannerVerificationRequiredForAvailability: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceMediaProjectAuthority = {
  readonly id: string;
  readonly organizationId: string;
  readonly status: "submitted" | "under_review" | "active" | "monitored" | "challenged";
  readonly projectRoot: string;
};

export type CanopyProofEvidenceMediaAgentSnapshot = {
  readonly id: string;
  readonly participantType: "agent";
  readonly role: "agent";
  readonly verificationStatus: "verified";
  readonly organizationId: string;
  readonly organizationVerificationStatus: "verified";
  readonly participantRoot: string;
  readonly organizationRoot: string;
  readonly agentType: "evidence";
  readonly agentStatus: "active";
  readonly capability: CanopyProofEvidenceMediaAgentCapability;
  readonly agentRegistryHash: string;
  readonly authorityRoot: string;
};

export type CanopyProofEvidenceMediaIntentAuthority = {
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly project: CanopyProofEvidenceMediaProjectAuthority;
  readonly consent: CanopyProofEvidenceConsentReceiptFact;
  readonly consentProjection: CanopyProofEvidenceConsentProjection;
  readonly device: CanopyProofEvidenceDeviceAttestationFact;
  readonly deviceProjection: CanopyProofEvidenceDeviceTrustProjection;
};

export type CanopyProofEvidenceMediaUploadIntentFact = {
  readonly factType: "evidence_media_upload_intent";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly projectStatus: CanopyProofEvidenceMediaProjectAuthority["status"];
  readonly evidenceId: string;
  readonly subjectId: string;
  readonly subjectRoot: string;
  readonly subjectAuthorityRoot: string;
  readonly consentReceiptId: string;
  readonly consentReceiptRoot: string;
  readonly consentProjectionRoot: string;
  readonly deviceAttestationId: string;
  readonly deviceAttestationRoot: string;
  readonly deviceProjectionRoot: string;
  readonly deviceTrustState: "current" | "needs_review";
  readonly contentHash: string;
  readonly contentType: CanopyProofEvidenceMediaContentType;
  readonly byteLength: number;
  readonly objectKey: string;
  readonly capturedAt: string;
  readonly expiresAt: string;
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly intentHash: string;
  readonly intentRoot: string;
  readonly safety: CanopyProofEvidenceMediaSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaObjectFact = {
  readonly factType: "evidence_media_object";
  readonly id: string;
  readonly intentId: string;
  readonly intentRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly evidenceId: string;
  readonly contentHash: string;
  readonly contentType: CanopyProofEvidenceMediaContentType;
  readonly byteLength: number;
  readonly objectKey: string;
  readonly storageProvider: CanopyProofEvidenceMediaStorageProvider;
  readonly providerNamespace: string;
  readonly objectVersion: string;
  readonly etagHash: string;
  readonly providerReceiptHash: string;
  readonly providerVerificationState: "modeled_only" | "verified";
  readonly encryptionMode: (typeof canopyProofEvidenceMediaEncryptionModes)[number];
  readonly encryptionKeyRef?: string;
  readonly objectLockMode: (typeof canopyProofEvidenceMediaObjectLockModes)[number];
  readonly retainUntil?: string;
  readonly storedAt: string;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly objectHash: string;
  readonly objectRoot: string;
  readonly safety: CanopyProofEvidenceMediaSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaDuplicateRelationFact = {
  readonly factType: "evidence_media_duplicate_relation";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly duplicateOfObjectId: string;
  readonly duplicateOfObjectRoot: string;
  readonly contentHash: string;
  readonly detectedAt: string;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly relationHash: string;
  readonly relationRoot: string;
  readonly safety: CanopyProofEvidenceMediaSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaScanResultFact = {
  readonly factType: "evidence_media_scan_result";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly scannerName: string;
  readonly scannerVersion: string;
  readonly scannerImageDigest: string;
  readonly signatureDatabaseVersion: string;
  readonly verdict: CanopyProofEvidenceMediaScanVerdict;
  readonly findingHashes: readonly string[];
  readonly providerReceiptHash: string;
  readonly providerVerificationState: "modeled_only" | "verified";
  readonly scannedAt: string;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly scanHash: string;
  readonly scanRoot: string;
  readonly safety: CanopyProofEvidenceMediaSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaObjectProjection = {
  readonly objectId: string;
  readonly objectRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly state: "pending_scan" | "quarantined" | "duplicate" | "needs_review" | "available";
  readonly evaluatedAt: string;
  readonly consentState: "active" | "expired" | "revoked";
  readonly deviceState: CanopyProofEvidenceDeviceTrustProjection["state"];
  readonly latestScanResultId?: string;
  readonly latestScanRoot?: string;
  readonly duplicateRelationId?: string;
  readonly duplicateRelationRoot?: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEvidenceMediaSafetyBoundary;
};

export type CanopyProofEvidenceMediaAuthoritySnapshot = {
  readonly uploadIntents: readonly CanopyProofEvidenceMediaUploadIntentFact[];
  readonly mediaObjects: readonly CanopyProofEvidenceMediaObjectFact[];
  readonly duplicateRelations: readonly CanopyProofEvidenceMediaDuplicateRelationFact[];
  readonly scanResults: readonly CanopyProofEvidenceMediaScanResultFact[];
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(canopyProofEvidenceCustodyRoles),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: hashSchema,
    authorityRoot: hashSchema,
  })
  .strict();
const agentSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("agent"),
    role: z.literal("agent"),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    agentType: z.literal("evidence"),
    agentStatus: z.literal("active"),
    capability: z.enum(canopyProofEvidenceMediaAgentCapabilities),
    agentRegistryHash: hashSchema,
    authorityRoot: hashSchema,
  })
  .strict();
const projectAuthoritySchema = z
  .object({
    id: identifierSchema,
    organizationId: identifierSchema,
    status: z.enum(["submitted", "under_review", "active", "monitored", "challenged"]),
    projectRoot: hashSchema,
  })
  .strict();
const uploadIntentInputSchema = z
  .object({
    evidenceId: identifierSchema,
    contentHash: hashSchema,
    contentType: z.enum(canopyProofEvidenceMediaContentTypes),
    byteLength: z.number().int().positive().max(50 * 1024 * 1024),
    capturedAt: z.string().datetime(),
  })
  .strict();
const objectConfirmationInputSchema = z
  .object({
    intentId: identifierSchema,
    storageProvider: z.enum(canopyProofEvidenceMediaStorageProviders),
    providerNamespace: identifierSchema,
    objectVersion: identifierSchema,
    contentHash: hashSchema,
    byteLength: z.number().int().positive().max(50 * 1024 * 1024),
    etagHash: hashSchema,
    providerReceiptHash: hashSchema,
    providerVerificationState: z.enum(["modeled_only", "verified"]),
    encryptionMode: z.enum(canopyProofEvidenceMediaEncryptionModes),
    encryptionKeyRef: identifierSchema.optional(),
    objectLockMode: z.enum(canopyProofEvidenceMediaObjectLockModes),
    retainUntil: z.string().datetime().optional(),
    storedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.encryptionMode === "sse_kms" && !value.encryptionKeyRef) {
      context.addIssue({ code: "custom", path: ["encryptionKeyRef"], message: "SSE-KMS requires a key identifier." });
    }
    if (value.objectLockMode === "none" && value.retainUntil) {
      context.addIssue({ code: "custom", path: ["retainUntil"], message: "Unlocked objects cannot have retainUntil." });
    }
    if (value.objectLockMode !== "none" && !value.retainUntil) {
      context.addIssue({ code: "custom", path: ["retainUntil"], message: "Object lock requires retainUntil." });
    }
    if (value.retainUntil && Date.parse(value.retainUntil) <= Date.parse(value.storedAt)) {
      context.addIssue({ code: "custom", path: ["retainUntil"], message: "retainUntil must follow storedAt." });
    }
  });
const scanResultInputSchema = z
  .object({
    objectId: identifierSchema,
    scannerName: z.string().trim().min(2).max(100),
    scannerVersion: z.string().trim().min(1).max(100),
    scannerImageDigest: hashSchema,
    signatureDatabaseVersion: z.string().trim().min(1).max(100),
    verdict: z.enum(canopyProofEvidenceMediaScanVerdicts),
    findingHashes: z.array(hashSchema).max(256).default([]),
    providerReceiptHash: hashSchema,
    providerVerificationState: z.enum(["modeled_only", "verified"]),
    scannedAt: z.string().datetime(),
  })
  .strict();

export class CanopyProofEvidenceMediaAuthorityService {
  private readonly uploadIntentsById = new Map<string, CanopyProofEvidenceMediaUploadIntentFact>();
  private readonly mediaObjectsById = new Map<string, CanopyProofEvidenceMediaObjectFact>();
  private readonly objectIdByIntentId = new Map<string, string>();
  private readonly firstObjectIdByContentHash = new Map<string, string>();
  private readonly duplicateRelationsById = new Map<string, CanopyProofEvidenceMediaDuplicateRelationFact>();
  private readonly duplicateRelationIdByObjectId = new Map<string, string>();
  private readonly scanResultsById = new Map<string, CanopyProofEvidenceMediaScanResultFact>();
  private readonly scanResultIdsByObjectId = new Map<string, string[]>();
  private readonly eventsByEvidenceId = new Map<string, CanopyProofAuditEvent[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofEvidenceMediaAuthoritySnapshot) {
    const service = new CanopyProofEvidenceMediaAuthorityService();
    const ids = new Set<string>();
    const replay = <T extends { readonly id: string }>(facts: readonly T[], operation: (fact: T) => void) => {
      for (const fact of facts) {
        if (ids.has(fact.id)) {
          throw new Error(`CanopyProof evidence media snapshot contains duplicate fact id: ${fact.id}`);
        }
        ids.add(fact.id);
        operation(fact);
      }
    };
    replay(
      [...snapshot.uploadIntents].sort((left, right) =>
        left.auditEvent.createdAt.localeCompare(right.auditEvent.createdAt) || left.id.localeCompare(right.id)),
      (fact) => service.replayUploadIntent(fact),
    );
    replay(
      [...snapshot.mediaObjects].sort((left, right) =>
        left.storedAt.localeCompare(right.storedAt) || left.id.localeCompare(right.id)),
      (fact) => service.replayMediaObject(fact),
    );
    replay(
      [...snapshot.duplicateRelations].sort((left, right) =>
        left.detectedAt.localeCompare(right.detectedAt) || left.id.localeCompare(right.id)),
      (fact) => service.replayDuplicateRelation(fact),
    );
    replay(
      [...snapshot.scanResults].sort((left, right) =>
        left.scannedAt.localeCompare(right.scannedAt) ||
        left.evidenceSequence - right.evidenceSequence ||
        left.id.localeCompare(right.id)),
      (fact) => service.replayScanResult(fact),
    );
    return service;
  }

  createUploadIntent(input: unknown, authorityInput: CanopyProofEvidenceMediaIntentAuthority) {
    const parsed = uploadIntentInputSchema.parse(input);
    const authority = normalizeIntentAuthority(authorityInput, parsed.capturedAt);
    const deviceTrustState = authority.deviceProjection.state;
    if (deviceTrustState !== "current" && deviceTrustState !== "needs_review") {
      throw new Error("CanopyProof evidence media intent device trust state is invalid.");
    }
    const contentHash = normalizeHash(parsed.contentHash);
    const objectKey = [
      "canopyproof",
      authority.actor.organizationId,
      authority.project.id,
      parsed.evidenceId,
      contentHash,
    ].join("/");
    const normalized = {
      organizationId: authority.actor.organizationId,
      projectId: authority.project.id,
      projectRoot: normalizeHash(authority.project.projectRoot),
      projectStatus: authority.project.status,
      evidenceId: parsed.evidenceId,
      subjectId: authority.actor.id,
      subjectRoot: authority.actor.participantRoot,
      subjectAuthorityRoot: authority.actor.authorityRoot,
      consentReceiptId: authority.consent.id,
      consentReceiptRoot: authority.consent.receiptRoot,
      consentProjectionRoot: authority.consentProjection.projectionRoot,
      deviceAttestationId: authority.device.id,
      deviceAttestationRoot: authority.device.attestationRoot,
      deviceProjectionRoot: authority.deviceProjection.projectionRoot,
      deviceTrustState,
      contentHash,
      contentType: parsed.contentType,
      byteLength: parsed.byteLength,
      objectKey,
      capturedAt: parsed.capturedAt,
      expiresAt: new Date(Date.parse(parsed.capturedAt) + 24 * 60 * 60 * 1_000).toISOString(),
      actor: authority.actor,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-upload-intent-command-v1", ...normalized });
    const id = `cp_media_intent_${commandHash.slice(0, 24)}`;
    const existing = this.uploadIntentsById.get(id);
    if (existing) return existing;
    if ([...this.uploadIntentsById.values()].some((fact) => fact.evidenceId === parsed.evidenceId)) {
      throw new Error("CanopyProof evidence media already has a different upload intent.");
    }
    const lineage = this.nextLineage(parsed.evidenceId);
    const seed = { id, ...normalized, commandHash, ...lineage };
    const intentHash = hashJson({ kind: "canopyproof-evidence-media-upload-intent-v1", ...seed });
    const intentRoot = hashJson({
      kind: "canopyproof-evidence-media-upload-intent-root-v1",
      organizationId: normalized.organizationId,
      projectRoot: normalized.projectRoot,
      evidenceId: normalized.evidenceId,
      subjectRoot: normalized.subjectRoot,
      consentReceiptRoot: normalized.consentReceiptRoot,
      deviceAttestationRoot: normalized.deviceAttestationRoot,
      commandHash,
      intentHash,
      ...lineage,
    });
    const safety = mediaSafetyBoundary();
    const payload = { factType: "evidence_media_upload_intent", ...seed, intentHash, intentRoot, safety };
    const auditEvent = this.appendEvent(parsed.evidenceId, {
      action: "ASSERT",
      actor: authority.actor.id,
      entityType: "media_upload_intent",
      entityId: id,
      payload,
      createdAt: parsed.capturedAt,
      rationale: "An immutable, consent- and device-bound media upload intent was recorded without a persisted grant.",
    });
    const fact: CanopyProofEvidenceMediaUploadIntentFact = {
      factType: "evidence_media_upload_intent",
      ...seed,
      intentHash,
      intentRoot,
      safety,
      auditEvent,
    };
    this.uploadIntentsById.set(id, fact);
    return fact;
  }

  confirmMediaObject(
    input: unknown,
    agentInput: CanopyProofEvidenceMediaAgentSnapshot,
  ): Readonly<{
    object: CanopyProofEvidenceMediaObjectFact;
    duplicateRelation?: CanopyProofEvidenceMediaDuplicateRelationFact;
  }> {
    const parsed = objectConfirmationInputSchema.parse(input);
    const agent = normalizeAgent(agentInput, "object_storage_receipt");
    const intent = this.getUploadIntent(parsed.intentId);
    assertAgentOrganization(agent, intent.organizationId);
    if (Date.parse(parsed.storedAt) < Date.parse(intent.capturedAt)) {
      throw new Error("CanopyProof evidence media object storage predates capture.");
    }
    if (Date.parse(parsed.storedAt) > Date.parse(intent.expiresAt)) {
      throw new Error("CanopyProof evidence media object confirmation is after intent expiry.");
    }
    const contentHash = normalizeHash(parsed.contentHash);
    if (contentHash !== intent.contentHash || parsed.byteLength !== intent.byteLength) {
      throw new Error("CanopyProof evidence media object does not match the upload intent.");
    }
    const existingObjectId = this.objectIdByIntentId.get(intent.id);
    if (existingObjectId) {
      const object = this.getMediaObject(existingObjectId);
      const relationId = this.duplicateRelationIdByObjectId.get(object.id);
      return {
        object,
        ...(relationId ? { duplicateRelation: this.getDuplicateRelation(relationId) } : {}),
      };
    }
    const normalized = {
      intentId: intent.id,
      intentRoot: intent.intentRoot,
      organizationId: intent.organizationId,
      projectId: intent.projectId,
      projectRoot: intent.projectRoot,
      evidenceId: intent.evidenceId,
      contentHash,
      contentType: intent.contentType,
      byteLength: intent.byteLength,
      objectKey: intent.objectKey,
      storageProvider: parsed.storageProvider,
      providerNamespace: parsed.providerNamespace,
      objectVersion: parsed.objectVersion,
      etagHash: normalizeHash(parsed.etagHash),
      providerReceiptHash: normalizeHash(parsed.providerReceiptHash),
      providerVerificationState: parsed.providerVerificationState,
      encryptionMode: parsed.encryptionMode,
      ...(parsed.encryptionKeyRef ? { encryptionKeyRef: parsed.encryptionKeyRef } : {}),
      objectLockMode: parsed.objectLockMode,
      ...(parsed.retainUntil ? { retainUntil: parsed.retainUntil } : {}),
      storedAt: parsed.storedAt,
      agent,
    } as const;
    assertSafeMaterial(
      [normalized.providerNamespace, normalized.objectVersion, normalized.encryptionKeyRef ?? ""],
      "media object provider metadata",
    );
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-object-command-v1", ...normalized });
    const id = `cp_media_object_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage(intent.evidenceId);
    const seed = { id, ...normalized, commandHash, ...lineage };
    const objectHash = hashJson({ kind: "canopyproof-evidence-media-object-v1", ...seed });
    const objectRoot = hashJson({
      kind: "canopyproof-evidence-media-object-root-v1",
      intentRoot: intent.intentRoot,
      organizationId: intent.organizationId,
      projectRoot: intent.projectRoot,
      evidenceId: intent.evidenceId,
      contentHash,
      providerReceiptHash: normalized.providerReceiptHash,
      commandHash,
      objectHash,
      ...lineage,
    });
    const safety = mediaSafetyBoundary();
    const payload = { factType: "evidence_media_object", ...seed, objectHash, objectRoot, safety };
    const auditEvent = this.appendEvent(intent.evidenceId, {
      action: parsed.providerVerificationState === "verified" ? "FULFILL" : "REASON",
      actor: agent.id,
      entityType: "media_object",
      entityId: id,
      payload,
      createdAt: parsed.storedAt,
      rationale:
        parsed.providerVerificationState === "verified"
          ? "An immutable provider-verified object receipt was recorded; scan and trust projection remain required."
          : "An immutable modeled object receipt was recorded in quarantine pending provider verification.",
    });
    const object: CanopyProofEvidenceMediaObjectFact = {
      factType: "evidence_media_object",
      ...seed,
      objectHash,
      objectRoot,
      safety,
      auditEvent,
    };
    this.mediaObjectsById.set(id, object);
    this.objectIdByIntentId.set(intent.id, id);
    const firstObjectId = this.firstObjectIdByContentHash.get(contentHash);
    if (!firstObjectId) {
      this.firstObjectIdByContentHash.set(contentHash, id);
      return { object };
    }
    const duplicateRelation = this.appendDuplicateRelation(object, this.getMediaObject(firstObjectId), agent);
    return { object, duplicateRelation };
  }

  recordScanResult(input: unknown, agentInput: CanopyProofEvidenceMediaAgentSnapshot) {
    const parsed = scanResultInputSchema.parse(input);
    const agent = normalizeAgent(agentInput, "malware_scan_result");
    const object = this.getMediaObject(parsed.objectId);
    assertAgentOrganization(agent, object.organizationId);
    if (Date.parse(parsed.scannedAt) < Date.parse(object.storedAt)) {
      throw new Error("CanopyProof evidence media scan predates object storage.");
    }
    assertSafeMaterial([parsed.scannerName, parsed.scannerVersion, parsed.signatureDatabaseVersion], "scanner metadata");
    const normalized = {
      organizationId: object.organizationId,
      projectId: object.projectId,
      evidenceId: object.evidenceId,
      objectId: object.id,
      objectRoot: object.objectRoot,
      scannerName: parsed.scannerName,
      scannerVersion: parsed.scannerVersion,
      scannerImageDigest: normalizeHash(parsed.scannerImageDigest),
      signatureDatabaseVersion: parsed.signatureDatabaseVersion,
      verdict: parsed.verdict,
      findingHashes: canonicalHashes(parsed.findingHashes),
      providerReceiptHash: normalizeHash(parsed.providerReceiptHash),
      providerVerificationState: parsed.providerVerificationState,
      scannedAt: parsed.scannedAt,
      agent,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-scan-command-v1", ...normalized });
    const id = `cp_media_scan_${commandHash.slice(0, 24)}`;
    const existing = this.scanResultsById.get(id);
    if (existing) return existing;
    const lineage = this.nextLineage(object.evidenceId);
    const seed = { id, ...normalized, commandHash, ...lineage };
    const scanHash = hashJson({ kind: "canopyproof-evidence-media-scan-v1", ...seed });
    const scanRoot = hashJson({
      kind: "canopyproof-evidence-media-scan-root-v1",
      objectRoot: object.objectRoot,
      providerReceiptHash: normalized.providerReceiptHash,
      verdict: normalized.verdict,
      commandHash,
      scanHash,
      ...lineage,
    });
    const safety = mediaSafetyBoundary();
    const payload = { factType: "evidence_media_scan_result", ...seed, scanHash, scanRoot, safety };
    const isVerifiedClean = parsed.verdict === "clean" && parsed.providerVerificationState === "verified";
    const auditEvent = this.appendEvent(object.evidenceId, {
      action: isVerifiedClean ? "FULFILL" : parsed.verdict === "clean" ? "REASON" : "CHALLENGE",
      actor: agent.id,
      entityType: "media_scan_result",
      entityId: id,
      payload,
      createdAt: parsed.scannedAt,
      rationale: isVerifiedClean
        ? "An immutable provider-verified clean media scan was recorded."
        : "An immutable media scan was retained in quarantine or review state.",
    });
    const fact: CanopyProofEvidenceMediaScanResultFact = {
      factType: "evidence_media_scan_result",
      ...seed,
      scanHash,
      scanRoot,
      safety,
      auditEvent,
    };
    this.scanResultsById.set(id, fact);
    this.scanResultIdsByObjectId.set(object.id, [...(this.scanResultIdsByObjectId.get(object.id) ?? []), id]);
    return fact;
  }

  projectMediaObject(
    objectId: string,
    evaluatedAt: string,
    current: Readonly<{
      consent: CanopyProofEvidenceConsentProjection;
      device: CanopyProofEvidenceDeviceTrustProjection;
    }>,
  ): CanopyProofEvidenceMediaObjectProjection {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    const object = this.getMediaObject(objectId);
    const intent = this.getUploadIntent(object.intentId);
    if (Date.parse(object.storedAt) > Date.parse(evaluation)) {
      throw new Error("CanopyProof evidence media object did not exist at the projection time.");
    }
    if (
      current.consent.receiptId !== intent.consentReceiptId ||
      current.consent.organizationId !== object.organizationId ||
      current.device.attestationId !== intent.deviceAttestationId ||
      current.device.organizationId !== object.organizationId
    ) {
      throw new Error("CanopyProof evidence media projection authority mismatch.");
    }
    const relationId = this.duplicateRelationIdByObjectId.get(object.id);
    const candidateRelation = relationId ? this.getDuplicateRelation(relationId) : undefined;
    const relation = candidateRelation && Date.parse(candidateRelation.detectedAt) <= Date.parse(evaluation)
      ? candidateRelation
      : undefined;
    const scan = this.latestScan(object.id, evaluation);
    const state: CanopyProofEvidenceMediaObjectProjection["state"] = relation
      ? "duplicate"
      : !scan
        ? "pending_scan"
        : scan.verdict !== "clean" || current.consent.state !== "active" ||
            ["expired", "consent_expired", "consent_revoked"].includes(current.device.state)
          ? "quarantined"
          : object.providerVerificationState !== "verified" ||
              scan.providerVerificationState !== "verified" ||
              current.device.state !== "current" ||
              object.objectLockMode === "none"
            ? "needs_review"
            : "available";
    const safety = mediaSafetyBoundary();
    const seed = {
      objectId: object.id,
      objectRoot: object.objectRoot,
      organizationId: object.organizationId,
      projectId: object.projectId,
      evidenceId: object.evidenceId,
      state,
      evaluatedAt: evaluation,
      consentState: current.consent.state,
      deviceState: current.device.state,
      ...(scan ? { latestScanResultId: scan.id, latestScanRoot: scan.scanRoot } : {}),
      ...(relation ? { duplicateRelationId: relation.id, duplicateRelationRoot: relation.relationRoot } : {}),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-evidence-media-object-projection-v1", ...seed, safety }),
      safety,
    };
  }

  getUploadIntent(id: string) {
    const value = this.uploadIntentsById.get(id);
    if (!value) throw new Error(`CanopyProof evidence media upload intent not found: ${id}`);
    return value;
  }

  getMediaObject(id: string) {
    const value = this.mediaObjectsById.get(id);
    if (!value) throw new Error(`CanopyProof evidence media object not found: ${id}`);
    return value;
  }

  getDuplicateRelation(id: string) {
    const value = this.duplicateRelationsById.get(id);
    if (!value) throw new Error(`CanopyProof evidence media duplicate relation not found: ${id}`);
    return value;
  }

  getScanResult(id: string) {
    const value = this.scanResultsById.get(id);
    if (!value) throw new Error(`CanopyProof evidence media scan result not found: ${id}`);
    return value;
  }

  getAuthoritySnapshot(): CanopyProofEvidenceMediaAuthoritySnapshot {
    return {
      uploadIntents: sortedFacts(this.uploadIntentsById.values()),
      mediaObjects: sortedFacts(this.mediaObjectsById.values()),
      duplicateRelations: sortedFacts(this.duplicateRelationsById.values()),
      scanResults: sortedFacts(this.scanResultsById.values()),
    };
  }

  private appendDuplicateRelation(
    object: CanopyProofEvidenceMediaObjectFact,
    duplicateOf: CanopyProofEvidenceMediaObjectFact,
    agent: CanopyProofEvidenceMediaAgentSnapshot,
  ) {
    const normalized = {
      organizationId: object.organizationId,
      projectId: object.projectId,
      evidenceId: object.evidenceId,
      objectId: object.id,
      objectRoot: object.objectRoot,
      duplicateOfObjectId: duplicateOf.id,
      duplicateOfObjectRoot: duplicateOf.objectRoot,
      contentHash: object.contentHash,
      detectedAt: object.storedAt,
      agent,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-duplicate-command-v1", ...normalized });
    const id = `cp_media_duplicate_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage(object.evidenceId);
    const seed = { id, ...normalized, commandHash, ...lineage };
    const relationHash = hashJson({ kind: "canopyproof-evidence-media-duplicate-v1", ...seed });
    const relationRoot = hashJson({
      kind: "canopyproof-evidence-media-duplicate-root-v1",
      objectRoot: object.objectRoot,
      duplicateOfObjectRoot: duplicateOf.objectRoot,
      contentHash: object.contentHash,
      commandHash,
      relationHash,
      ...lineage,
    });
    const safety = mediaSafetyBoundary();
    const payload = {
      factType: "evidence_media_duplicate_relation",
      ...seed,
      relationHash,
      relationRoot,
      safety,
    };
    const auditEvent = this.appendEvent(object.evidenceId, {
      action: "CHALLENGE",
      actor: agent.id,
      entityType: "media_duplicate_relation",
      entityId: id,
      payload,
      createdAt: object.storedAt,
      rationale: "A duplicate media relation was appended without deleting either immutable object fact.",
    });
    const fact: CanopyProofEvidenceMediaDuplicateRelationFact = {
      factType: "evidence_media_duplicate_relation",
      ...seed,
      relationHash,
      relationRoot,
      safety,
      auditEvent,
    };
    this.duplicateRelationsById.set(id, fact);
    this.duplicateRelationIdByObjectId.set(object.id, id);
    return fact;
  }

  private replayUploadIntent(expected: CanopyProofEvidenceMediaUploadIntentFact) {
    const actor = normalizeActor(expected.actor);
    const seed = withoutFactArtifacts(expected, ["intentHash", "intentRoot"]);
    const intentHash = hashJson({ kind: "canopyproof-evidence-media-upload-intent-v1", ...seed });
    const intentRoot = hashJson({
      kind: "canopyproof-evidence-media-upload-intent-root-v1",
      organizationId: expected.organizationId,
      projectRoot: expected.projectRoot,
      evidenceId: expected.evidenceId,
      subjectRoot: expected.subjectRoot,
      consentReceiptRoot: expected.consentReceiptRoot,
      deviceAttestationRoot: expected.deviceAttestationRoot,
      commandHash: expected.commandHash,
      intentHash,
      evidenceSequence: expected.evidenceSequence,
      previousEventRoot: expected.previousEventRoot,
    });
    if (
      actor.id !== expected.subjectId ||
      actor.organizationId !== expected.organizationId ||
      actor.participantRoot !== expected.subjectRoot ||
      actor.authorityRoot !== expected.subjectAuthorityRoot ||
      expected.intentHash !== intentHash ||
      expected.intentRoot !== intentRoot
    ) {
      throw new Error(`CanopyProof evidence media upload intent lineage is invalid: ${expected.id}`);
    }
    this.assertAndAppendReplay(expected, {
      action: "ASSERT",
      actor: actor.id,
      entityType: "media_upload_intent",
      payload: { ...seed, factType: expected.factType, intentHash, intentRoot, safety: expected.safety },
      rationale: "An immutable, consent- and device-bound media upload intent was recorded without a persisted grant.",
    });
    this.uploadIntentsById.set(expected.id, expected);
  }

  private replayMediaObject(expected: CanopyProofEvidenceMediaObjectFact) {
    const intent = this.getUploadIntent(expected.intentId);
    const agent = normalizeAgent(expected.agent, "object_storage_receipt");
    const seed = withoutFactArtifacts(expected, ["objectHash", "objectRoot"]);
    const objectHash = hashJson({ kind: "canopyproof-evidence-media-object-v1", ...seed });
    const objectRoot = hashJson({
      kind: "canopyproof-evidence-media-object-root-v1",
      intentRoot: expected.intentRoot,
      organizationId: expected.organizationId,
      projectRoot: expected.projectRoot,
      evidenceId: expected.evidenceId,
      contentHash: expected.contentHash,
      providerReceiptHash: expected.providerReceiptHash,
      commandHash: expected.commandHash,
      objectHash,
      evidenceSequence: expected.evidenceSequence,
      previousEventRoot: expected.previousEventRoot,
    });
    if (
      intent.intentRoot !== expected.intentRoot ||
      intent.evidenceId !== expected.evidenceId ||
      intent.contentHash !== expected.contentHash ||
      intent.objectKey !== expected.objectKey ||
      agent.organizationId !== expected.organizationId ||
      expected.objectHash !== objectHash ||
      expected.objectRoot !== objectRoot ||
      this.objectIdByIntentId.has(intent.id)
    ) {
      throw new Error(`CanopyProof evidence media object lineage is invalid: ${expected.id}`);
    }
    const isVerified = expected.providerVerificationState === "verified";
    this.assertAndAppendReplay(expected, {
      action: isVerified ? "FULFILL" : "REASON",
      actor: agent.id,
      entityType: "media_object",
      payload: { ...seed, factType: expected.factType, objectHash, objectRoot, safety: expected.safety },
      rationale: isVerified
        ? "An immutable provider-verified object receipt was recorded; scan and trust projection remain required."
        : "An immutable modeled object receipt was recorded in quarantine pending provider verification.",
    });
    this.mediaObjectsById.set(expected.id, expected);
    this.objectIdByIntentId.set(intent.id, expected.id);
    if (!this.firstObjectIdByContentHash.has(expected.contentHash)) {
      this.firstObjectIdByContentHash.set(expected.contentHash, expected.id);
    }
  }

  private replayDuplicateRelation(expected: CanopyProofEvidenceMediaDuplicateRelationFact) {
    const object = this.getMediaObject(expected.objectId);
    const duplicateOf = this.getMediaObject(expected.duplicateOfObjectId);
    const agent = normalizeAgent(expected.agent, "object_storage_receipt");
    const seed = withoutFactArtifacts(expected, ["relationHash", "relationRoot"]);
    const relationHash = hashJson({ kind: "canopyproof-evidence-media-duplicate-v1", ...seed });
    const relationRoot = hashJson({
      kind: "canopyproof-evidence-media-duplicate-root-v1",
      objectRoot: expected.objectRoot,
      duplicateOfObjectRoot: expected.duplicateOfObjectRoot,
      contentHash: expected.contentHash,
      commandHash: expected.commandHash,
      relationHash,
      evidenceSequence: expected.evidenceSequence,
      previousEventRoot: expected.previousEventRoot,
    });
    if (
      object.objectRoot !== expected.objectRoot ||
      duplicateOf.objectRoot !== expected.duplicateOfObjectRoot ||
      object.contentHash !== duplicateOf.contentHash ||
      object.contentHash !== expected.contentHash ||
      object.id === duplicateOf.id ||
      agent.organizationId !== expected.organizationId ||
      expected.relationHash !== relationHash ||
      expected.relationRoot !== relationRoot ||
      this.duplicateRelationIdByObjectId.has(object.id)
    ) {
      throw new Error(`CanopyProof evidence media duplicate relation lineage is invalid: ${expected.id}`);
    }
    this.assertAndAppendReplay(expected, {
      action: "CHALLENGE",
      actor: agent.id,
      entityType: "media_duplicate_relation",
      payload: { ...seed, factType: expected.factType, relationHash, relationRoot, safety: expected.safety },
      rationale: "A duplicate media relation was appended without deleting either immutable object fact.",
    });
    this.duplicateRelationsById.set(expected.id, expected);
    this.duplicateRelationIdByObjectId.set(object.id, expected.id);
  }

  private replayScanResult(expected: CanopyProofEvidenceMediaScanResultFact) {
    const object = this.getMediaObject(expected.objectId);
    const agent = normalizeAgent(expected.agent, "malware_scan_result");
    const seed = withoutFactArtifacts(expected, ["scanHash", "scanRoot"]);
    const scanHash = hashJson({ kind: "canopyproof-evidence-media-scan-v1", ...seed });
    const scanRoot = hashJson({
      kind: "canopyproof-evidence-media-scan-root-v1",
      objectRoot: expected.objectRoot,
      providerReceiptHash: expected.providerReceiptHash,
      verdict: expected.verdict,
      commandHash: expected.commandHash,
      scanHash,
      evidenceSequence: expected.evidenceSequence,
      previousEventRoot: expected.previousEventRoot,
    });
    if (
      object.objectRoot !== expected.objectRoot ||
      agent.organizationId !== expected.organizationId ||
      expected.scanHash !== scanHash ||
      expected.scanRoot !== scanRoot
    ) {
      throw new Error(`CanopyProof evidence media scan lineage is invalid: ${expected.id}`);
    }
    const isVerifiedClean = expected.verdict === "clean" && expected.providerVerificationState === "verified";
    this.assertAndAppendReplay(expected, {
      action: isVerifiedClean ? "FULFILL" : expected.verdict === "clean" ? "REASON" : "CHALLENGE",
      actor: agent.id,
      entityType: "media_scan_result",
      payload: { ...seed, factType: expected.factType, scanHash, scanRoot, safety: expected.safety },
      rationale: isVerifiedClean
        ? "An immutable provider-verified clean media scan was recorded."
        : "An immutable media scan was retained in quarantine or review state.",
    });
    this.scanResultsById.set(expected.id, expected);
    this.scanResultIdsByObjectId.set(object.id, [...(this.scanResultIdsByObjectId.get(object.id) ?? []), expected.id]);
  }

  private assertAndAppendReplay(
    expected: CanopyProofEvidenceMediaUploadIntentFact | CanopyProofEvidenceMediaObjectFact |
      CanopyProofEvidenceMediaDuplicateRelationFact | CanopyProofEvidenceMediaScanResultFact,
    input: Readonly<{
      action: CanopyProofAuditEvent["action"];
      actor: string;
      entityType: CanopyProofAuditEvent["entityType"];
      payload: unknown;
      rationale: string;
    }>,
  ) {
    if (hashJson(expected.safety) !== hashJson(mediaSafetyBoundary())) {
      throw new Error(`CanopyProof evidence media safety boundary is invalid: ${expected.id}`);
    }
    const events = this.eventsForEvidence(expected.evidenceId);
    if (
      expected.evidenceSequence !== events.length + 1 ||
      expected.previousEventRoot !== (events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot())
    ) {
      throw new Error(`CanopyProof evidence media stream lineage is invalid: ${expected.id}`);
    }
    const replayed = appendCanopyProofAuditEvent(events, {
      action: input.action,
      actor: input.actor,
      entityType: input.entityType,
      entityId: expected.id,
      payload: input.payload,
      createdAt: expected.auditEvent.createdAt,
      rationale: input.rationale,
    }).at(-1)!;
    if (hashJson(replayed) !== hashJson(expected.auditEvent)) {
      throw new Error(`CanopyProof evidence media semantic event is invalid: ${expected.id}`);
    }
    this.eventsByEvidenceId.set(expected.evidenceId, [...events, expected.auditEvent]);
  }

  private nextLineage(evidenceId: string) {
    const events = this.eventsForEvidence(evidenceId);
    return {
      evidenceSequence: events.length + 1,
      previousEventRoot: events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    };
  }

  private appendEvent(
    evidenceId: string,
    input: Parameters<typeof appendCanopyProofAuditEvent>[1],
  ) {
    const events = this.eventsForEvidence(evidenceId);
    const event = appendCanopyProofAuditEvent(events, input).at(-1)!;
    this.eventsByEvidenceId.set(evidenceId, [...events, event]);
    return event;
  }

  private eventsForEvidence(evidenceId: string) {
    return this.eventsByEvidenceId.get(evidenceId) ?? [];
  }

  private latestScan(objectId: string, evaluatedAt?: string) {
    const evaluationMs = evaluatedAt === undefined ? Number.POSITIVE_INFINITY : Date.parse(evaluatedAt);
    return (this.scanResultIdsByObjectId.get(objectId) ?? [])
      .map((id) => this.getScanResult(id))
      .filter((scan) => Date.parse(scan.scannedAt) <= evaluationMs)
      .sort((left, right) => right.evidenceSequence - left.evidenceSequence || right.id.localeCompare(left.id))[0];
  }
}

export function canopyProofEvidenceMediaAgentAuthorityRoot(
  actor: Omit<CanopyProofEvidenceMediaAgentSnapshot, "authorityRoot">,
) {
  return hashJson({ kind: "canopyproof-evidence-media-agent-authority-v1", ...actor });
}

function normalizeIntentAuthority(
  input: CanopyProofEvidenceMediaIntentAuthority,
  capturedAt: string,
): CanopyProofEvidenceMediaIntentAuthority & {
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly project: CanopyProofEvidenceMediaProjectAuthority;
} {
  const actor = normalizeActor(input.actor);
  const project = projectAuthoritySchema.parse(input.project);
  if (actor.organizationId !== project.organizationId) {
    throw new Error("CanopyProof evidence media project organization authority mismatch.");
  }
  if (
    input.consent.subjectId !== actor.id ||
    input.consent.organizationId !== actor.organizationId ||
    input.consentProjection.receiptId !== input.consent.id ||
    input.consentProjection.receiptRoot !== input.consent.receiptRoot ||
    input.consentProjection.state !== "active" ||
    input.consentProjection.evaluatedAt !== capturedAt ||
    !input.consent.purposes.includes("evidence_collection") ||
    !input.consent.purposes.includes("media_upload")
  ) {
    throw new Error("CanopyProof evidence media intent requires active subject-bound collection and upload consent.");
  }
  if (
    input.device.subjectId !== actor.id ||
    input.device.organizationId !== actor.organizationId ||
    input.device.consentReceiptId !== input.consent.id ||
    input.deviceProjection.attestationId !== input.device.id ||
    input.deviceProjection.attestationRoot !== input.device.attestationRoot ||
    input.deviceProjection.evaluatedAt !== capturedAt ||
    (input.deviceProjection.state !== "current" && input.deviceProjection.state !== "needs_review")
  ) {
    throw new Error("CanopyProof evidence media intent requires a current subject-bound device fact.");
  }
  return { ...input, actor, project };
}

function normalizeActor(input: CanopyProofEvidenceCustodyActorSnapshot) {
  const parsed = actorSchema.parse(input);
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    membershipId: parsed.membershipId,
    membershipStatus: parsed.membershipStatus,
    membershipRoot: normalizeHash(parsed.membershipRoot),
  } as const;
  const authorityRoot = canopyProofEvidenceCustodyActorAuthorityRoot(normalized);
  if (authorityRoot !== normalizeHash(parsed.authorityRoot)) {
    throw new Error("CanopyProof evidence media subject authority root is invalid.");
  }
  return { ...normalized, authorityRoot };
}

function normalizeAgent(
  input: CanopyProofEvidenceMediaAgentSnapshot,
  capability: CanopyProofEvidenceMediaAgentCapability,
) {
  const parsed = agentSchema.parse(input);
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    agentType: parsed.agentType,
    agentStatus: parsed.agentStatus,
    capability: parsed.capability,
    agentRegistryHash: normalizeHash(parsed.agentRegistryHash),
  } as const;
  if (normalized.capability !== capability) {
    throw new Error(`CanopyProof evidence media agent lacks ${capability} capability.`);
  }
  const authorityRoot = canopyProofEvidenceMediaAgentAuthorityRoot(normalized);
  if (authorityRoot !== normalizeHash(parsed.authorityRoot)) {
    throw new Error("CanopyProof evidence media agent authority root is invalid.");
  }
  return { ...normalized, authorityRoot };
}

function assertAgentOrganization(agent: CanopyProofEvidenceMediaAgentSnapshot, organizationId: string) {
  if (agent.organizationId !== organizationId) {
    throw new Error("CanopyProof evidence media agent organization authority mismatch.");
  }
}

function mediaSafetyBoundary(): CanopyProofEvidenceMediaSafetyBoundary {
  return {
    appendOnly: true,
    subjectBound: true,
    organizationBound: true,
    projectBound: true,
    consentBound: true,
    deviceBound: true,
    semanticEventBound: true,
    noPersistedUploadGrant: true,
    noProviderCredential: true,
    quarantineByDefault: true,
    providerVerificationRequiredForAvailability: true,
    scannerVerificationRequiredForAvailability: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function normalizeHash(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function canonicalHashes(values: readonly string[]) {
  return [...new Set(values.map(normalizeHash))].sort();
}

function assertSafeMaterial(values: readonly string[], label: string) {
  for (const value of values) {
    if (/(?:bearer\s+|password|secret|private[_ -]?key|BEGIN [A-Z ]*PRIVATE KEY|https?:\/\/|[?&](?:token|signature|credential)=)/i.test(value)) {
      throw new Error(`CanopyProof ${label} contains credential or endpoint material.`);
    }
    if (/(?:certified carbon credit|carbon tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution)/i.test(value)) {
      throw new Error(`CanopyProof ${label} contains an unsupported public claim.`);
    }
  }
}

function sortedFacts<T extends { readonly evidenceId: string; readonly evidenceSequence: number; readonly id: string }>(
  values: Iterable<T>,
) {
  return [...values].sort(
    (left, right) =>
      left.evidenceId.localeCompare(right.evidenceId) ||
      left.evidenceSequence - right.evidenceSequence ||
      left.id.localeCompare(right.id),
  );
}

function withoutFactArtifacts<T extends Record<string, unknown>>(
  fact: T,
  hashFields: readonly (keyof T)[],
) {
  const copy = { ...fact };
  delete copy.factType;
  delete copy.auditEvent;
  delete copy.safety;
  for (const field of hashFields) delete copy[field];
  return copy;
}
