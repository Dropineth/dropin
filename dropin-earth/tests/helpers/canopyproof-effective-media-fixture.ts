import { hashJson } from "@dropin/crypto";
import {
  canopyProofEvidenceMediaAdapterSafetyBoundary,
  projectCanopyProofEffectiveMediaObject,
  projectCanopyProofEvidenceMediaAdapterTrust,
  type CanopyProofEvidenceMediaProviderVerificationFact,
  type CanopyProofEvidenceMediaScannerVerificationFact,
} from "../../services/api/src/domain/canopyproof/evidence-media-adapter-authority.js";
import type {
  CanopyProofEvidenceMediaAgentSnapshot,
  CanopyProofEvidenceMediaObjectFact,
  CanopyProofEvidenceMediaObjectProjection,
  CanopyProofEvidenceMediaScanResultFact,
} from "../../services/api/src/domain/canopyproof/evidence-media-authority.js";
import { canopyProofAuditGenesisRoot, type CanopyProofAuditEvent } from
  "../../services/api/src/domain/canopyproof/proof-engine.js";

export function buildEffectiveMediaFixture(input: Readonly<{
  object: CanopyProofEvidenceMediaObjectFact;
  scan: CanopyProofEvidenceMediaScanResultFact;
  baseProjection: CanopyProofEvidenceMediaObjectProjection;
  providerVerifier: CanopyProofEvidenceMediaAgentSnapshot;
  scannerVerifier: CanopyProofEvidenceMediaAgentSnapshot;
  providerVerifiedAt?: string;
  scannerVerifiedAt?: string;
  retentionVerificationState?: "modeled_only" | "verified";
}>) {
  const providerVerification = buildProviderVerification({
    object: input.object,
    verifier: input.providerVerifier,
    verifiedAt: input.providerVerifiedAt ?? input.object.storedAt,
    retentionVerificationState: input.retentionVerificationState ?? "verified",
  });
  const scannerVerification = buildScannerVerification({
    object: input.object,
    scan: input.scan,
    verifier: input.scannerVerifier,
    verifiedAt: input.scannerVerifiedAt ?? input.scan.scannedAt,
    previousEventRoot: providerVerification.auditEvent.eventRoot,
  });
  const adapterTrustProjection = projectCanopyProofEvidenceMediaAdapterTrust({
    object: input.object,
    providerVerification,
    scans: [input.scan],
    scannerVerifications: [scannerVerification],
    evaluatedAt: input.baseProjection.evaluatedAt,
  });
  return {
    providerVerification,
    scannerVerification,
    adapterTrustProjection,
    effectiveProjection: projectCanopyProofEffectiveMediaObject({
      baseProjection: input.baseProjection,
      adapterTrustProjection,
    }),
  };
}

function buildProviderVerification(input: Readonly<{
  object: CanopyProofEvidenceMediaObjectFact;
  verifier: CanopyProofEvidenceMediaAgentSnapshot;
  verifiedAt: string;
  retentionVerificationState: "modeled_only" | "verified";
}>): CanopyProofEvidenceMediaProviderVerificationFact {
  const retentionPolicyRoot = input.retentionVerificationState === "verified"
    ? hashJson({ kind: "canopyproof-test-retention-policy", objectId: input.object.id })
    : undefined;
  const providerVerificationRoot = hashJson({
    kind: "canopyproof-stored-object-provider-verification-v1",
    intentId: input.object.intentId,
    intentRoot: input.object.intentRoot,
    provider: input.object.storageProvider,
    providerNamespace: input.object.providerNamespace,
    providerReceiptHash: input.object.providerReceiptHash,
    verifiedAt: input.verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-media-provider-verification-command-v1",
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    providerReceiptHash: input.object.providerReceiptHash,
    providerVerificationRoot,
    verifierId: input.verifier.id,
    verifierAuthorityRoot: input.verifier.authorityRoot,
    verifiedAt: input.verifiedAt,
  });
  const id = `cp_media_provider_verify_${commandHash.slice(0, 24)}`;
  const auditEvent = buildAuditEvent({
    action: input.retentionVerificationState === "verified" ? "FULFILL" : "REASON",
    actor: input.verifier.id,
    entityType: "media_provider_receipt_verification",
    entityId: id,
    previousRoot: canopyProofAuditGenesisRoot(),
    payloadHash: providerVerificationRoot,
    createdAt: input.verifiedAt,
    rationale: "An independent provider receipt and retention-policy verification fact was appended.",
  });
  const commandReceiptId = `cp_command_${commandHash.slice(0, 24)}`;
  const safety = canopyProofEvidenceMediaAdapterSafetyBoundary();
  const factRoot = hashJson({
    kind: "canopyproof-media-provider-verification-fact-root-v1",
    commandHash,
    providerVerificationRoot,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId,
    safety,
  });
  return {
    factType: "evidence_media_provider_receipt_verification",
    id,
    organizationId: input.object.organizationId,
    projectId: input.object.projectId,
    evidenceId: input.object.evidenceId,
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    intentId: input.object.intentId,
    intentRoot: input.object.intentRoot,
    verifierId: input.verifier.id,
    verifier: input.verifier,
    storageProvider: input.object.storageProvider,
    providerNamespace: input.object.providerNamespace,
    objectKey: input.object.objectKey,
    objectVersion: input.object.objectVersion,
    contentHash: input.object.contentHash,
    contentType: input.object.contentType,
    byteLength: input.object.byteLength,
    etagHash: input.object.etagHash,
    uploadedAt: input.object.storedAt,
    encryptionMode: input.object.encryptionMode,
    ...(input.object.encryptionKeyRef ? { encryptionKeyRef: input.object.encryptionKeyRef } : {}),
    objectLockMode: input.object.objectLockMode,
    ...(input.object.retainUntil ? { retainUntil: input.object.retainUntil } : {}),
    ...(retentionPolicyRoot ? { retentionPolicyRoot } : {}),
    retentionVerificationState: input.retentionVerificationState,
    providerReceiptHash: input.object.providerReceiptHash,
    verifiedAt: input.verifiedAt,
    providerVerificationRoot,
    commandHash,
    evidenceSequence: 1,
    previousEventRoot: auditEvent.previousRoot,
    commandReceiptId,
    factRoot,
    safety,
    auditEvent,
  };
}

function buildScannerVerification(input: Readonly<{
  object: CanopyProofEvidenceMediaObjectFact;
  scan: CanopyProofEvidenceMediaScanResultFact;
  verifier: CanopyProofEvidenceMediaAgentSnapshot;
  verifiedAt: string;
  previousEventRoot: string;
}>): CanopyProofEvidenceMediaScannerVerificationFact {
  const signerKeyId = "canopyproof-test-scanner-ed25519-v1";
  const scannerPolicyRoot = hashJson({ kind: "canopyproof-test-scanner-policy" });
  const signatureHash = hashJson({ kind: "canopyproof-test-scanner-signature", scanId: input.scan.id });
  const scannerVerificationRoot = hashJson({
    kind: "canopyproof-malware-scan-verification-v1",
    receiptHash: input.scan.providerReceiptHash,
    signerKeyId,
    scannerPolicyRoot,
    signatureHash,
    verifiedAt: input.verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-media-scanner-verification-command-v1",
    scanResultId: input.scan.id,
    scanRoot: input.scan.scanRoot,
    scannerReceiptHash: input.scan.providerReceiptHash,
    scannerVerificationRoot,
    verifierId: input.verifier.id,
    verifierAuthorityRoot: input.verifier.authorityRoot,
    verifiedAt: input.verifiedAt,
  });
  const id = `cp_media_scanner_verify_${commandHash.slice(0, 24)}`;
  const auditEvent = buildAuditEvent({
    action: input.scan.verdict === "clean" ? "FULFILL" : "CHALLENGE",
    actor: input.verifier.id,
    entityType: "media_scanner_receipt_verification",
    entityId: id,
    previousRoot: input.previousEventRoot,
    payloadHash: scannerVerificationRoot,
    createdAt: input.verifiedAt,
    rationale: "An independently signed malware-scanner receipt verification fact was appended.",
  });
  const commandReceiptId = `cp_command_${commandHash.slice(0, 24)}`;
  const safety = canopyProofEvidenceMediaAdapterSafetyBoundary();
  const factRoot = hashJson({
    kind: "canopyproof-media-scanner-verification-fact-root-v1",
    commandHash,
    scannerVerificationRoot,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId,
    safety,
  });
  return {
    factType: "evidence_media_scanner_receipt_verification",
    id,
    organizationId: input.object.organizationId,
    projectId: input.object.projectId,
    evidenceId: input.object.evidenceId,
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    scanResultId: input.scan.id,
    scanRoot: input.scan.scanRoot,
    verifierId: input.verifier.id,
    verifier: input.verifier,
    scannerId: "canopyproof-test-scanner",
    signerKeyId,
    signatureAlgorithm: "ed25519",
    signatureHash,
    scannerPolicyRoot,
    objectProviderReceiptHash: input.object.providerReceiptHash,
    scannerReceiptHash: input.scan.providerReceiptHash,
    verifiedAt: input.verifiedAt,
    scannerVerificationRoot,
    commandHash,
    evidenceSequence: 2,
    previousEventRoot: auditEvent.previousRoot,
    commandReceiptId,
    factRoot,
    safety,
    auditEvent,
  };
}

function buildAuditEvent(
  input: Omit<CanopyProofAuditEvent, "id" | "eventRoot">,
): CanopyProofAuditEvent {
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...input });
  return { id: `cp_audit_${eventRoot.slice(0, 24)}`, ...input, eventRoot };
}
