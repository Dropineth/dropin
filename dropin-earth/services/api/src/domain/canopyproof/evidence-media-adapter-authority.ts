import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  isCanopyProofVerifiedMalwareScanReceipt,
  type CanopyProofMalwareScanReceipt,
  type CanopyProofVerifiedMalwareScanReceipt,
} from "./malware-scanner-adapter.js";
import {
  isCanopyProofAdapterVerifiedStoredObjectReceipt,
  type CanopyProofAdapterVerifiedStoredObjectReceipt,
  type CanopyProofStoredObjectReceipt,
} from "./object-storage-adapter.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentCapability,
  type CanopyProofEvidenceMediaAgentSnapshot,
  type CanopyProofEvidenceMediaDuplicateRelationFact,
  type CanopyProofEvidenceMediaObjectFact,
  type CanopyProofEvidenceMediaObjectProjection,
  type CanopyProofEvidenceMediaScanResultFact,
  type CanopyProofEvidenceMediaUploadIntentFact,
} from "./evidence-media-authority.js";
import {
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAhinAction,
  type CanopyProofAuditEntityType,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import {
  assertCanopyProofEffectiveDeviceAttestationProjection,
  type CanopyProofEffectiveDeviceAttestationProjection,
} from "./evidence-device-attestation-adapter-authority.js";

export type CanopyProofEvidenceMediaAdapterSafetyBoundary = {
  readonly appendOnly: true;
  readonly organizationBound: true;
  readonly projectBound: true;
  readonly evidenceBound: true;
  readonly objectBound: true;
  readonly semanticEventBound: true;
  readonly commandReceiptBound: true;
  readonly providerReceiptVerifiedIndependently: true;
  readonly retentionPolicyVerifiedIndependently: true;
  readonly scannerSignatureVerifiedIndependently: true;
  readonly noPersistedUploadGrant: true;
  readonly noRawSignature: true;
  readonly noProviderCredential: true;
  readonly notAvailabilityDecision: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceMediaProviderVerificationFact = {
  readonly factType: "evidence_media_provider_receipt_verification";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly intentId: string;
  readonly intentRoot: string;
  readonly verifierId: string;
  readonly verifier: CanopyProofEvidenceMediaAgentSnapshot;
  readonly storageProvider: CanopyProofStoredObjectReceipt["provider"];
  readonly providerNamespace: string;
  readonly objectKey: string;
  readonly objectVersion: string;
  readonly contentHash: string;
  readonly contentType: CanopyProofStoredObjectReceipt["contentType"];
  readonly byteLength: number;
  readonly etagHash: string;
  readonly uploadedAt: string;
  readonly encryptionMode: CanopyProofStoredObjectReceipt["encryptionMode"];
  readonly encryptionKeyRef?: string;
  readonly objectLockMode: CanopyProofStoredObjectReceipt["objectLockMode"];
  readonly retainUntil?: string;
  readonly retentionPolicyRoot?: string;
  readonly retentionVerificationState: CanopyProofStoredObjectReceipt["retentionVerificationState"];
  readonly providerReceiptHash: string;
  readonly verifiedAt: string;
  readonly providerVerificationRoot: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly commandReceiptId: string;
  readonly factRoot: string;
  readonly safety: CanopyProofEvidenceMediaAdapterSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

const durableMalwareScanReceiptBrand: unique symbol = Symbol("CanopyProofDurableMalwareScanReceipt");

export type CanopyProofDurableMalwareScanReceipt = Omit<CanopyProofMalwareScanReceipt, "signature"> & {
  readonly scannerPolicyRoot: string;
  readonly verifiedAt: string;
  readonly signatureHash: string;
  readonly verificationRoot: string;
  readonly [durableMalwareScanReceiptBrand]: true;
};

export type CanopyProofEvidenceMediaScannerVerificationFact = {
  readonly factType: "evidence_media_scanner_receipt_verification";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly scanResultId: string;
  readonly scanRoot: string;
  readonly verifierId: string;
  readonly verifier: CanopyProofEvidenceMediaAgentSnapshot;
  readonly scannerId: string;
  readonly signerKeyId: string;
  readonly signatureAlgorithm: "ed25519";
  readonly signatureHash: string;
  readonly scannerPolicyRoot: string;
  readonly objectProviderReceiptHash: string;
  readonly scannerReceiptHash: string;
  readonly verifiedAt: string;
  readonly scannerVerificationRoot: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly commandReceiptId: string;
  readonly factRoot: string;
  readonly safety: CanopyProofEvidenceMediaAdapterSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaProviderVerificationBundle = {
  readonly object: CanopyProofEvidenceMediaObjectFact;
  readonly duplicateRelation?: CanopyProofEvidenceMediaDuplicateRelationFact;
  readonly verification: CanopyProofEvidenceMediaProviderVerificationFact;
};

export type CanopyProofEvidenceMediaScannerVerificationBundle = {
  readonly scan: CanopyProofEvidenceMediaScanResultFact;
  readonly verification: CanopyProofEvidenceMediaScannerVerificationFact;
};

export type CanopyProofEvidenceMediaAdapterTrustProjection = {
  readonly objectId: string;
  readonly objectRoot: string;
  readonly organizationId: string;
  readonly providerVerificationFactId?: string;
  readonly providerVerificationRoot?: string;
  readonly retentionVerificationState?: "modeled_only" | "verified";
  readonly latestScanResultId?: string;
  readonly latestScanRoot?: string;
  readonly scannerVerificationFactId?: string;
  readonly scannerVerificationRoot?: string;
  readonly state:
    | "provider_pending"
    | "retention_pending"
    | "scanner_pending"
    | "receipt_challenged"
    | "verified_receipts";
  readonly evaluatedAt: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEvidenceMediaAdapterSafetyBoundary;
};

export type CanopyProofEffectiveMediaSafetyBoundary = {
  readonly derivedProjectionOnly: true;
  readonly baseProjectionBound: true;
  readonly adapterTrustProjectionBound: true;
  readonly asOfEvaluationBound: true;
  readonly hardStateCannotBePromoted: true;
  readonly verifiedReceiptsRequired: true;
  readonly activeConsentRequired: true;
  readonly currentDeviceRequired: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEffectiveMediaObjectProjection = {
  readonly objectId: string;
  readonly objectRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly baseProjectionRoot: string;
  readonly adapterTrustProjectionRoot: string;
  readonly deviceTrustProjectionRoot?: string;
  readonly state: CanopyProofEvidenceMediaObjectProjection["state"];
  readonly issueCodes: readonly string[];
  readonly evaluatedAt: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEffectiveMediaSafetyBoundary;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const hashSchema = z.string().regex(HASH_PATTERN);
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);

export function canopyProofEvidenceMediaAdapterSafetyBoundary(): CanopyProofEvidenceMediaAdapterSafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    projectBound: true,
    evidenceBound: true,
    objectBound: true,
    semanticEventBound: true,
    commandReceiptBound: true,
    providerReceiptVerifiedIndependently: true,
    retentionPolicyVerifiedIndependently: true,
    scannerSignatureVerifiedIndependently: true,
    noPersistedUploadGrant: true,
    noRawSignature: true,
    noProviderCredential: true,
    notAvailabilityDecision: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function canopyProofEffectiveMediaSafetyBoundary(): CanopyProofEffectiveMediaSafetyBoundary {
  return {
    derivedProjectionOnly: true,
    baseProjectionBound: true,
    adapterTrustProjectionBound: true,
    asOfEvaluationBound: true,
    hardStateCannotBePromoted: true,
    verifiedReceiptsRequired: true,
    activeConsentRequired: true,
    currentDeviceRequired: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function minimizeCanopyProofMalwareScanReceipt(
  receipt: CanopyProofVerifiedMalwareScanReceipt,
): CanopyProofDurableMalwareScanReceipt {
  if (!isCanopyProofVerifiedMalwareScanReceipt(receipt)) {
    throw new Error("CANOPYPROOF_SCANNER_RECEIPT_NOT_ADAPTER_VERIFIED");
  }
  const durable = {
    objectId: receipt.objectId,
    objectRoot: receipt.objectRoot,
    providerReceiptHash: receipt.providerReceiptHash,
    scannerId: receipt.scannerId,
    scannerName: receipt.scannerName,
    scannerVersion: receipt.scannerVersion,
    scannerImageDigest: receipt.scannerImageDigest,
    signatureDatabaseVersion: receipt.signatureDatabaseVersion,
    verdict: receipt.verdict,
    findingHashes: Object.freeze([...receipt.findingHashes]),
    scannedAt: receipt.scannedAt,
    signerKeyId: receipt.signerKeyId,
    signatureAlgorithm: receipt.signatureAlgorithm,
    receiptHash: receipt.receiptHash,
    scannerPolicyRoot: receipt.scannerPolicyRoot,
    verifiedAt: receipt.verifiedAt,
    signatureHash: receipt.signatureHash,
    verificationRoot: receipt.verificationRoot,
  };
  Object.defineProperty(durable, durableMalwareScanReceiptBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return Object.freeze(durable) as unknown as CanopyProofDurableMalwareScanReceipt;
}

export function buildCanopyProofEvidenceMediaProviderVerificationFact(
  input: Readonly<{
    intent: CanopyProofEvidenceMediaUploadIntentFact;
    object: CanopyProofEvidenceMediaObjectFact;
    receipt: CanopyProofAdapterVerifiedStoredObjectReceipt;
    verifier: CanopyProofEvidenceMediaAgentSnapshot;
    streamEvents: readonly CanopyProofAuditEvent[];
  }>,
): CanopyProofEvidenceMediaProviderVerificationFact {
  const verifiedAt = canonicalInstant(input.receipt.verifiedAt, "provider verifiedAt");
  const uploadedAt = canonicalInstant(input.receipt.uploadedAt, "provider uploadedAt");
  assertAgent(input.verifier, input.object.organizationId, "object_storage_receipt");
  assertStream(input.streamEvents, verifiedAt);
  assertProviderBinding(input.intent, input.object, input.receipt);

  const providerVerificationRoot = hashJson({
    kind: "canopyproof-stored-object-provider-verification-v1",
    intentId: input.intent.id,
    intentRoot: input.intent.intentRoot,
    provider: input.receipt.provider,
    providerNamespace: input.receipt.providerNamespace,
    providerReceiptHash: input.receipt.providerReceiptHash,
    verifiedAt,
  });
  if (providerVerificationRoot !== input.receipt.providerVerificationRoot) {
    throw new Error("CANOPYPROOF_E2A_PROVIDER_VERIFICATION_ROOT_INVALID");
  }
  const commandHash = hashJson({
    kind: "canopyproof-media-provider-verification-command-v1",
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    providerReceiptHash: input.receipt.providerReceiptHash,
    providerVerificationRoot,
    verifierId: input.verifier.id,
    verifierAuthorityRoot: input.verifier.authorityRoot,
    verifiedAt,
  });
  const id = `cp_media_provider_verify_${commandHash.slice(0, 24)}`;
  const action = input.receipt.retentionVerificationState === "verified" ? "FULFILL" : "REASON";
  const auditEvent = appendRootBoundEvent(input.streamEvents, {
    action,
    actor: input.verifier.id,
    entityType: "media_provider_receipt_verification",
    entityId: id,
    payloadHash: providerVerificationRoot,
    createdAt: verifiedAt,
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
    intentId: input.intent.id,
    intentRoot: input.intent.intentRoot,
    verifierId: input.verifier.id,
    verifier: input.verifier,
    storageProvider: input.receipt.provider,
    providerNamespace: input.receipt.providerNamespace,
    objectKey: input.receipt.objectKey,
    objectVersion: input.receipt.objectVersion,
    contentHash: input.receipt.contentHash,
    contentType: input.receipt.contentType,
    byteLength: input.receipt.byteLength,
    etagHash: input.receipt.etagHash,
    uploadedAt,
    encryptionMode: input.receipt.encryptionMode,
    ...(input.receipt.encryptionKeyRef ? { encryptionKeyRef: input.receipt.encryptionKeyRef } : {}),
    objectLockMode: input.receipt.objectLockMode,
    ...(input.receipt.retainUntil ? { retainUntil: input.receipt.retainUntil } : {}),
    ...(input.receipt.retentionPolicyRoot
      ? { retentionPolicyRoot: input.receipt.retentionPolicyRoot }
      : {}),
    retentionVerificationState: input.receipt.retentionVerificationState,
    providerReceiptHash: input.receipt.providerReceiptHash,
    verifiedAt,
    providerVerificationRoot,
    commandHash,
    evidenceSequence: input.streamEvents.length + 1,
    previousEventRoot: auditEvent.previousRoot,
    commandReceiptId,
    factRoot,
    safety,
    auditEvent,
  };
}

export function buildCanopyProofEvidenceMediaScannerVerificationFact(
  input: Readonly<{
    object: CanopyProofEvidenceMediaObjectFact;
    scan: CanopyProofEvidenceMediaScanResultFact;
    receipt: CanopyProofDurableMalwareScanReceipt;
    verifier: CanopyProofEvidenceMediaAgentSnapshot;
    streamEvents: readonly CanopyProofAuditEvent[];
  }>,
): CanopyProofEvidenceMediaScannerVerificationFact {
  const verifiedAt = canonicalInstant(input.receipt.verifiedAt, "scanner verifiedAt");
  assertAgent(input.verifier, input.object.organizationId, "malware_scan_result");
  assertStream(input.streamEvents, verifiedAt);
  assertScannerBinding(input.object, input.scan, input.receipt);

  const scannerVerificationRoot = hashJson({
    kind: "canopyproof-malware-scan-verification-v1",
    receiptHash: input.receipt.receiptHash,
    signerKeyId: input.receipt.signerKeyId,
    scannerPolicyRoot: input.receipt.scannerPolicyRoot,
    signatureHash: input.receipt.signatureHash,
    verifiedAt,
  });
  if (scannerVerificationRoot !== input.receipt.verificationRoot) {
    throw new Error("CANOPYPROOF_E2A_SCANNER_VERIFICATION_ROOT_INVALID");
  }
  const commandHash = hashJson({
    kind: "canopyproof-media-scanner-verification-command-v1",
    scanResultId: input.scan.id,
    scanRoot: input.scan.scanRoot,
    scannerReceiptHash: input.receipt.receiptHash,
    scannerVerificationRoot,
    verifierId: input.verifier.id,
    verifierAuthorityRoot: input.verifier.authorityRoot,
    verifiedAt,
  });
  const id = `cp_media_scanner_verify_${commandHash.slice(0, 24)}`;
  const auditEvent = appendRootBoundEvent(input.streamEvents, {
    action: input.scan.verdict === "clean" ? "FULFILL" : "CHALLENGE",
    actor: input.verifier.id,
    entityType: "media_scanner_receipt_verification",
    entityId: id,
    payloadHash: scannerVerificationRoot,
    createdAt: verifiedAt,
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
    scannerId: input.receipt.scannerId,
    signerKeyId: input.receipt.signerKeyId,
    signatureAlgorithm: input.receipt.signatureAlgorithm,
    signatureHash: input.receipt.signatureHash,
    scannerPolicyRoot: input.receipt.scannerPolicyRoot,
    objectProviderReceiptHash: input.object.providerReceiptHash,
    scannerReceiptHash: input.receipt.receiptHash,
    verifiedAt,
    scannerVerificationRoot,
    commandHash,
    evidenceSequence: input.streamEvents.length + 1,
    previousEventRoot: auditEvent.previousRoot,
    commandReceiptId,
    factRoot,
    safety,
    auditEvent,
  };
}

export function projectCanopyProofEvidenceMediaAdapterTrust(
  input: Readonly<{
    object: CanopyProofEvidenceMediaObjectFact;
    providerVerification?: CanopyProofEvidenceMediaProviderVerificationFact;
    scans: readonly CanopyProofEvidenceMediaScanResultFact[];
    scannerVerifications: readonly CanopyProofEvidenceMediaScannerVerificationFact[];
    evaluatedAt: string;
  }>,
): CanopyProofEvidenceMediaAdapterTrustProjection {
  const evaluatedAt = canonicalInstant(input.evaluatedAt, "adapter trust evaluatedAt");
  const evaluatedAtMs = Date.parse(evaluatedAt);
  if (Date.parse(input.object.storedAt) > evaluatedAtMs) {
    throw new Error("CANOPYPROOF_E2A_OBJECT_NOT_VISIBLE_AT_EVALUATION");
  }

  const providerVerification = input.providerVerification &&
      Date.parse(input.providerVerification.verifiedAt) <= evaluatedAtMs
    ? assertProviderVerificationFact(input.object, input.providerVerification)
    : undefined;
  const latestScan = input.scans
    .filter((scan) => {
      assertScanScope(input.object, scan);
      return Date.parse(canonicalInstant(scan.scannedAt, "scan scannedAt")) <= evaluatedAtMs;
    })
    .sort((left, right) =>
      right.evidenceSequence - left.evidenceSequence || right.id.localeCompare(left.id)
    )[0];
  const scannerVerification = latestScan
    ? input.scannerVerifications
      .filter((fact) => {
        if (fact.objectId !== input.object.id || fact.objectRoot !== input.object.objectRoot) {
          throw new Error("CANOPYPROOF_E2A_SCANNER_FACT_SCOPE_INVALID");
        }
        return fact.scanResultId === latestScan.id && Date.parse(fact.verifiedAt) <= evaluatedAtMs;
      })
      .sort((left, right) =>
        Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt) || right.id.localeCompare(left.id)
      )[0]
    : undefined;
  if (scannerVerification && latestScan) {
    assertScannerVerificationFact(input.object, latestScan, scannerVerification);
  }

  const state: CanopyProofEvidenceMediaAdapterTrustProjection["state"] = !providerVerification
    ? "provider_pending"
    : providerVerification.retentionVerificationState !== "verified"
      ? "retention_pending"
      : !latestScan || !scannerVerification
        ? "scanner_pending"
        : latestScan.verdict !== "clean"
          ? "receipt_challenged"
          : "verified_receipts";
  const safety = canopyProofEvidenceMediaAdapterSafetyBoundary();
  const seed = {
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    organizationId: input.object.organizationId,
    ...(providerVerification
      ? {
          providerVerificationFactId: providerVerification.id,
          providerVerificationRoot: providerVerification.providerVerificationRoot,
          retentionVerificationState: providerVerification.retentionVerificationState,
        }
      : {}),
    ...(latestScan
      ? { latestScanResultId: latestScan.id, latestScanRoot: latestScan.scanRoot }
      : {}),
    ...(scannerVerification
      ? {
          scannerVerificationFactId: scannerVerification.id,
          scannerVerificationRoot: scannerVerification.scannerVerificationRoot,
        }
      : {}),
    state,
    evaluatedAt,
    safety,
  } as const;
  return {
    ...seed,
    projectionRoot: hashJson({
      kind: "canopyproof-media-adapter-trust-projection-v1",
      objectId: seed.objectId,
      objectRoot: seed.objectRoot,
      ...(seed.providerVerificationRoot
        ? { providerVerificationRoot: seed.providerVerificationRoot }
        : {}),
      ...(seed.retentionVerificationState
        ? { retentionVerificationState: seed.retentionVerificationState }
        : {}),
      ...(seed.latestScanResultId ? { latestScanResultId: seed.latestScanResultId } : {}),
      ...(seed.latestScanRoot ? { latestScanRoot: seed.latestScanRoot } : {}),
      ...(seed.scannerVerificationRoot
        ? { scannerVerificationRoot: seed.scannerVerificationRoot }
        : {}),
      state,
      evaluatedAt,
      safety,
    }),
  };
}

export function projectCanopyProofEffectiveMediaObject(
  input: Readonly<{
    baseProjection: CanopyProofEvidenceMediaObjectProjection;
    adapterTrustProjection: CanopyProofEvidenceMediaAdapterTrustProjection;
    deviceTrustProjection?: CanopyProofEffectiveDeviceAttestationProjection;
  }>,
): CanopyProofEffectiveMediaObjectProjection {
  assertBaseProjection(input.baseProjection);
  assertAdapterTrustProjection(input.adapterTrustProjection);
  const base = input.baseProjection;
  const trust = input.adapterTrustProjection;
  const device = input.deviceTrustProjection;
  if (device) assertCanopyProofEffectiveDeviceAttestationProjection(device);
  if (
    base.objectId !== trust.objectId ||
    base.objectRoot !== trust.objectRoot ||
    base.organizationId !== trust.organizationId ||
    base.evaluatedAt !== trust.evaluatedAt
  ) {
    throw new Error("CANOPYPROOF_EFFECTIVE_MEDIA_PROJECTION_AUTHORITY_MISMATCH");
  }
  if (
    device &&
    (device.organizationId !== base.organizationId || device.evaluatedAt !== base.evaluatedAt)
  ) {
    throw new Error("CANOPYPROOF_EFFECTIVE_MEDIA_DEVICE_PROJECTION_AUTHORITY_MISMATCH");
  }
  const effectiveDeviceState = device?.state ?? base.deviceState;

  const issues = new Set<string>();
  if (base.state === "duplicate") issues.add("media_duplicate");
  if (base.state === "pending_scan") issues.add("media_scan_pending");
  if (base.state === "quarantined") issues.add("media_quarantined");
  if (base.consentState !== "active") issues.add("media_consent_inactive");
  if (effectiveDeviceState !== "current") issues.add("media_device_not_current");
  if (trust.state === "provider_pending") issues.add("media_provider_verification_pending");
  if (trust.state === "retention_pending") issues.add("media_retention_verification_pending");
  if (trust.state === "scanner_pending") issues.add("media_scanner_verification_pending");
  if (trust.state === "receipt_challenged") issues.add("media_receipt_challenged");
  const issueCodes = Object.freeze([...issues].sort());

  const state: CanopyProofEffectiveMediaObjectProjection["state"] =
    base.state === "duplicate" || base.state === "pending_scan" || base.state === "quarantined"
      ? base.state
      : base.consentState === "active" &&
          effectiveDeviceState === "current" &&
          trust.state === "verified_receipts"
        ? "available"
        : "needs_review";
  const safety = canopyProofEffectiveMediaSafetyBoundary();
  const seed = {
    objectId: base.objectId,
    objectRoot: base.objectRoot,
    organizationId: base.organizationId,
    projectId: base.projectId,
    evidenceId: base.evidenceId,
    baseProjectionRoot: base.projectionRoot,
    adapterTrustProjectionRoot: trust.projectionRoot,
    ...(device ? { deviceTrustProjectionRoot: device.projectionRoot } : {}),
    state,
    issueCodes,
    evaluatedAt: base.evaluatedAt,
    safety,
  } as const;
  return {
    ...seed,
    projectionRoot: hashJson({
      kind: device
        ? "canopyproof-effective-media-object-projection-v2"
        : "canopyproof-effective-media-object-projection-v1",
      ...seed,
    }),
  };
}

export function assertCanopyProofEffectiveMediaObjectProjection(
  input: Readonly<{
    baseProjection: CanopyProofEvidenceMediaObjectProjection;
    adapterTrustProjection: CanopyProofEvidenceMediaAdapterTrustProjection;
    deviceTrustProjection?: CanopyProofEffectiveDeviceAttestationProjection;
    effectiveProjection: CanopyProofEffectiveMediaObjectProjection;
  }>,
) {
  const expected = projectCanopyProofEffectiveMediaObject(input);
  if (hashJson(expected) !== hashJson(input.effectiveProjection)) {
    throw new Error("CANOPYPROOF_EFFECTIVE_MEDIA_PROJECTION_INVALID");
  }
  return input.effectiveProjection;
}

function assertBaseProjection(projection: CanopyProofEvidenceMediaObjectProjection) {
  const evaluatedAt = canonicalInstant(projection.evaluatedAt, "base projection evaluatedAt");
  const expectedRoot = hashJson({
    kind: "canopyproof-evidence-media-object-projection-v1",
    objectId: projection.objectId,
    objectRoot: projection.objectRoot,
    organizationId: projection.organizationId,
    projectId: projection.projectId,
    evidenceId: projection.evidenceId,
    state: projection.state,
    evaluatedAt,
    consentState: projection.consentState,
    deviceState: projection.deviceState,
    ...(projection.latestScanResultId
      ? { latestScanResultId: projection.latestScanResultId }
      : {}),
    ...(projection.latestScanRoot ? { latestScanRoot: projection.latestScanRoot } : {}),
    ...(projection.duplicateRelationId
      ? { duplicateRelationId: projection.duplicateRelationId }
      : {}),
    ...(projection.duplicateRelationRoot
      ? { duplicateRelationRoot: projection.duplicateRelationRoot }
      : {}),
    safety: projection.safety,
  });
  if (projection.projectionRoot !== expectedRoot) {
    throw new Error("CANOPYPROOF_EFFECTIVE_MEDIA_BASE_PROJECTION_INVALID");
  }
}

function assertAdapterTrustProjection(projection: CanopyProofEvidenceMediaAdapterTrustProjection) {
  const safety = canopyProofEvidenceMediaAdapterSafetyBoundary();
  const expectedRoot = hashJson({
    kind: "canopyproof-media-adapter-trust-projection-v1",
    objectId: projection.objectId,
    objectRoot: projection.objectRoot,
    ...(projection.providerVerificationRoot
      ? { providerVerificationRoot: projection.providerVerificationRoot }
      : {}),
    ...(projection.retentionVerificationState
      ? { retentionVerificationState: projection.retentionVerificationState }
      : {}),
    ...(projection.latestScanResultId
      ? { latestScanResultId: projection.latestScanResultId }
      : {}),
    ...(projection.latestScanRoot ? { latestScanRoot: projection.latestScanRoot } : {}),
    ...(projection.scannerVerificationRoot
      ? { scannerVerificationRoot: projection.scannerVerificationRoot }
      : {}),
    state: projection.state,
    evaluatedAt: canonicalInstant(projection.evaluatedAt, "adapter projection evaluatedAt"),
    safety,
  });
  if (
    projection.projectionRoot !== expectedRoot ||
    hashJson(projection.safety) !== hashJson(safety) ||
    (projection.providerVerificationFactId === undefined) !==
      (projection.providerVerificationRoot === undefined) ||
    (projection.scannerVerificationFactId === undefined) !==
      (projection.scannerVerificationRoot === undefined)
  ) {
    throw new Error("CANOPYPROOF_EFFECTIVE_MEDIA_ADAPTER_PROJECTION_INVALID");
  }
}

function assertScanScope(
  object: CanopyProofEvidenceMediaObjectFact,
  scan: CanopyProofEvidenceMediaScanResultFact,
) {
  canonicalInstant(scan.scannedAt, "scan scannedAt");
  if (
    scan.objectId !== object.id ||
    scan.objectRoot !== object.objectRoot ||
    scan.organizationId !== object.organizationId ||
    scan.projectId !== object.projectId ||
    scan.evidenceId !== object.evidenceId ||
    !Number.isInteger(scan.evidenceSequence) ||
    scan.evidenceSequence < 1
  ) {
    throw new Error("CANOPYPROOF_E2A_SCAN_SCOPE_INVALID");
  }
}

function assertProviderVerificationFact(
  object: CanopyProofEvidenceMediaObjectFact,
  fact: CanopyProofEvidenceMediaProviderVerificationFact,
) {
  const verifiedAt = canonicalInstant(fact.verifiedAt, "provider fact verifiedAt");
  assertAgent(fact.verifier, object.organizationId, "object_storage_receipt");
  const providerVerificationRoot = hashJson({
    kind: "canopyproof-stored-object-provider-verification-v1",
    intentId: fact.intentId,
    intentRoot: fact.intentRoot,
    provider: fact.storageProvider,
    providerNamespace: fact.providerNamespace,
    providerReceiptHash: fact.providerReceiptHash,
    verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-media-provider-verification-command-v1",
    objectId: object.id,
    objectRoot: object.objectRoot,
    providerReceiptHash: fact.providerReceiptHash,
    providerVerificationRoot,
    verifierId: fact.verifierId,
    verifierAuthorityRoot: fact.verifier.authorityRoot,
    verifiedAt,
  });
  const factRoot = hashJson({
    kind: "canopyproof-media-provider-verification-fact-root-v1",
    commandHash,
    providerVerificationRoot,
    auditEventRoot: fact.auditEvent.eventRoot,
    commandReceiptId: fact.commandReceiptId,
    safety: fact.safety,
  });
  if (
    fact.factType !== "evidence_media_provider_receipt_verification" ||
    fact.organizationId !== object.organizationId ||
    fact.projectId !== object.projectId ||
    fact.evidenceId !== object.evidenceId ||
    fact.objectId !== object.id ||
    fact.objectRoot !== object.objectRoot ||
    fact.intentId !== object.intentId ||
    fact.intentRoot !== object.intentRoot ||
    fact.verifierId !== fact.verifier.id ||
    fact.storageProvider !== object.storageProvider ||
    fact.providerNamespace !== object.providerNamespace ||
    fact.objectKey !== object.objectKey ||
    fact.objectVersion !== object.objectVersion ||
    fact.contentHash !== object.contentHash ||
    fact.contentType !== object.contentType ||
    fact.byteLength !== object.byteLength ||
    fact.etagHash !== object.etagHash ||
    fact.uploadedAt !== object.storedAt ||
    fact.encryptionMode !== object.encryptionMode ||
    fact.encryptionKeyRef !== object.encryptionKeyRef ||
    fact.objectLockMode !== object.objectLockMode ||
    fact.retainUntil !== object.retainUntil ||
    fact.providerReceiptHash !== object.providerReceiptHash ||
    providerVerificationRoot !== fact.providerVerificationRoot ||
    commandHash !== fact.commandHash ||
    fact.id !== `cp_media_provider_verify_${commandHash.slice(0, 24)}` ||
    fact.commandReceiptId !== `cp_command_${commandHash.slice(0, 24)}` ||
    factRoot !== fact.factRoot ||
    !auditEventIsValid(fact.auditEvent) ||
    hashJson(fact.safety) !== hashJson(canopyProofEvidenceMediaAdapterSafetyBoundary()) ||
    (fact.retentionVerificationState === "verified" &&
      (fact.objectLockMode === "none" || !fact.retentionPolicyRoot))
  ) {
    throw new Error("CANOPYPROOF_E2A_PROVIDER_VERIFICATION_FACT_INVALID");
  }
  return fact;
}

function assertScannerVerificationFact(
  object: CanopyProofEvidenceMediaObjectFact,
  scan: CanopyProofEvidenceMediaScanResultFact,
  fact: CanopyProofEvidenceMediaScannerVerificationFact,
) {
  assertScanScope(object, scan);
  const verifiedAt = canonicalInstant(fact.verifiedAt, "scanner fact verifiedAt");
  assertAgent(fact.verifier, object.organizationId, "malware_scan_result");
  const scannerVerificationRoot = hashJson({
    kind: "canopyproof-malware-scan-verification-v1",
    receiptHash: fact.scannerReceiptHash,
    signerKeyId: fact.signerKeyId,
    scannerPolicyRoot: fact.scannerPolicyRoot,
    signatureHash: fact.signatureHash,
    verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-media-scanner-verification-command-v1",
    scanResultId: scan.id,
    scanRoot: scan.scanRoot,
    scannerReceiptHash: fact.scannerReceiptHash,
    scannerVerificationRoot,
    verifierId: fact.verifierId,
    verifierAuthorityRoot: fact.verifier.authorityRoot,
    verifiedAt,
  });
  const factRoot = hashJson({
    kind: "canopyproof-media-scanner-verification-fact-root-v1",
    commandHash,
    scannerVerificationRoot,
    auditEventRoot: fact.auditEvent.eventRoot,
    commandReceiptId: fact.commandReceiptId,
    safety: fact.safety,
  });
  if (
    fact.factType !== "evidence_media_scanner_receipt_verification" ||
    fact.organizationId !== object.organizationId ||
    fact.projectId !== object.projectId ||
    fact.evidenceId !== object.evidenceId ||
    fact.objectId !== object.id ||
    fact.objectRoot !== object.objectRoot ||
    fact.scanResultId !== scan.id ||
    fact.scanRoot !== scan.scanRoot ||
    fact.verifierId !== fact.verifier.id ||
    fact.signatureAlgorithm !== "ed25519" ||
    fact.objectProviderReceiptHash !== object.providerReceiptHash ||
    fact.scannerReceiptHash !== scan.providerReceiptHash ||
    scannerVerificationRoot !== fact.scannerVerificationRoot ||
    commandHash !== fact.commandHash ||
    fact.id !== `cp_media_scanner_verify_${commandHash.slice(0, 24)}` ||
    fact.commandReceiptId !== `cp_command_${commandHash.slice(0, 24)}` ||
    factRoot !== fact.factRoot ||
    !auditEventIsValid(fact.auditEvent) ||
    hashJson(fact.safety) !== hashJson(canopyProofEvidenceMediaAdapterSafetyBoundary())
  ) {
    throw new Error("CANOPYPROOF_E2A_SCANNER_VERIFICATION_FACT_INVALID");
  }
  return fact;
}

function auditEventIsValid(event: CanopyProofAuditEvent) {
  return event.eventRoot === hashJson({
    kind: "canopyproof-audit-event-v1",
    action: event.action,
    actor: event.actor,
    entityType: event.entityType,
    entityId: event.entityId,
    previousRoot: event.previousRoot,
    payloadHash: event.payloadHash,
    createdAt: event.createdAt,
    rationale: event.rationale,
  });
}

function assertProviderBinding(
  intent: CanopyProofEvidenceMediaUploadIntentFact,
  object: CanopyProofEvidenceMediaObjectFact,
  receipt: CanopyProofAdapterVerifiedStoredObjectReceipt,
) {
  if (!isCanopyProofAdapterVerifiedStoredObjectReceipt(receipt)) {
    throw new Error("CANOPYPROOF_PROVIDER_RECEIPT_NOT_ADAPTER_VERIFIED");
  }
  if (
    object.providerVerificationState !== "modeled_only" ||
    object.intentId !== intent.id ||
    object.intentRoot !== intent.intentRoot ||
    receipt.intentId !== intent.id ||
    receipt.intentRoot !== intent.intentRoot ||
    object.storageProvider !== receipt.provider ||
    object.providerNamespace !== receipt.providerNamespace ||
    object.objectKey !== receipt.objectKey ||
    object.objectVersion !== receipt.objectVersion ||
    object.contentHash !== receipt.contentHash ||
    object.contentType !== receipt.contentType ||
    object.byteLength !== receipt.byteLength ||
    object.etagHash !== receipt.etagHash ||
    object.storedAt !== receipt.uploadedAt ||
    object.encryptionMode !== receipt.encryptionMode ||
    object.encryptionKeyRef !== receipt.encryptionKeyRef ||
    object.objectLockMode !== receipt.objectLockMode ||
    object.retainUntil !== receipt.retainUntil ||
    object.providerReceiptHash !== receipt.providerReceiptHash
  ) {
    throw new Error("CANOPYPROOF_E2A_PROVIDER_RECEIPT_BINDING_INVALID");
  }
  if (
    receipt.retentionVerificationState === "verified" &&
    (receipt.objectLockMode === "none" || !receipt.retentionPolicyRoot)
  ) {
    throw new Error("CANOPYPROOF_E2A_RETENTION_VERIFICATION_INVALID");
  }
}

function assertScannerBinding(
  object: CanopyProofEvidenceMediaObjectFact,
  scan: CanopyProofEvidenceMediaScanResultFact,
  receipt: CanopyProofDurableMalwareScanReceipt,
) {
  if (receipt[durableMalwareScanReceiptBrand] !== true) {
    throw new Error("CANOPYPROOF_SCANNER_RECEIPT_NOT_MINIMIZED_BY_AUTHORITY");
  }
  const receiptHash = hashJson({
    kind: "canopyproof-malware-scan-receipt-v1",
    objectId: object.id,
    objectRoot: object.objectRoot,
    providerReceiptHash: object.providerReceiptHash,
    scannerId: receipt.scannerId,
    scannerName: scan.scannerName,
    scannerVersion: scan.scannerVersion,
    scannerImageDigest: scan.scannerImageDigest,
    signatureDatabaseVersion: scan.signatureDatabaseVersion,
    verdict: scan.verdict,
    findingHashes: [...scan.findingHashes],
    scannedAt: scan.scannedAt,
    signerKeyId: receipt.signerKeyId,
    signatureAlgorithm: receipt.signatureAlgorithm,
  });
  if (
    scan.providerVerificationState !== "modeled_only" ||
    scan.objectId !== object.id ||
    scan.objectRoot !== object.objectRoot ||
    receipt.objectId !== object.id ||
    receipt.objectRoot !== object.objectRoot ||
    receipt.providerReceiptHash !== object.providerReceiptHash ||
    receipt.scannerName !== scan.scannerName ||
    receipt.scannerVersion !== scan.scannerVersion ||
    receipt.scannerImageDigest !== scan.scannerImageDigest ||
    receipt.signatureDatabaseVersion !== scan.signatureDatabaseVersion ||
    receipt.verdict !== scan.verdict ||
    hashJson(receipt.findingHashes) !== hashJson(scan.findingHashes) ||
    receipt.scannedAt !== scan.scannedAt ||
    receipt.receiptHash !== scan.providerReceiptHash ||
    receiptHash !== receipt.receiptHash
  ) {
    throw new Error("CANOPYPROOF_E2A_SCANNER_RECEIPT_BINDING_INVALID");
  }
  hashSchema.parse(receipt.signatureHash);
  hashSchema.parse(receipt.scannerPolicyRoot);
}

function assertAgent(
  agent: CanopyProofEvidenceMediaAgentSnapshot,
  organizationId: string,
  capability: CanopyProofEvidenceMediaAgentCapability,
) {
  identifierSchema.parse(agent.id);
  if (
    agent.organizationId !== organizationId ||
    agent.capability !== capability ||
    agent.participantType !== "agent" ||
    agent.role !== "agent" ||
    agent.verificationStatus !== "verified" ||
    agent.organizationVerificationStatus !== "verified" ||
    agent.agentType !== "evidence" ||
    agent.agentStatus !== "active"
  ) {
    throw new Error("CANOPYPROOF_E2A_VERIFIER_AUTHORITY_INVALID");
  }
  const seed = {
    id: agent.id,
    participantType: agent.participantType,
    role: agent.role,
    verificationStatus: agent.verificationStatus,
    organizationId: agent.organizationId,
    organizationVerificationStatus: agent.organizationVerificationStatus,
    participantRoot: agent.participantRoot,
    organizationRoot: agent.organizationRoot,
    agentType: agent.agentType,
    agentStatus: agent.agentStatus,
    capability: agent.capability,
    agentRegistryHash: agent.agentRegistryHash,
  };
  if (canopyProofEvidenceMediaAgentAuthorityRoot(seed) !== agent.authorityRoot) {
    throw new Error("CANOPYPROOF_E2A_VERIFIER_ROOT_INVALID");
  }
}

function assertStream(events: readonly CanopyProofAuditEvent[], createdAt: string) {
  const terminal = events.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(events, createdAt).valid) {
    throw new Error("CANOPYPROOF_E2A_EVENT_STREAM_INVALID");
  }
  if (terminal && Date.parse(createdAt) < Date.parse(terminal.createdAt)) {
    throw new Error("CANOPYPROOF_E2A_EVENT_TIME_REGRESSION");
  }
}

function appendRootBoundEvent(
  history: readonly CanopyProofAuditEvent[],
  input: Readonly<{
    action: CanopyProofAhinAction;
    actor: string;
    entityType: CanopyProofAuditEntityType;
    entityId: string;
    payloadHash: string;
    createdAt: string;
    rationale: string;
  }>,
): CanopyProofAuditEvent {
  const previousRoot = history.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const seed = {
    action: input.action,
    actor: input.actor,
    entityType: input.entityType,
    entityId: input.entityId,
    previousRoot,
    payloadHash: hashSchema.parse(input.payloadHash),
    createdAt: canonicalInstant(input.createdAt, "audit event createdAt"),
    rationale: input.rationale,
  } as const;
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...seed });
  return { id: `cp_audit_${eventRoot.slice(0, 24)}`, ...seed, eventRoot };
}

function canonicalInstant(value: string, field: string) {
  const parsed = z.string().datetime().parse(value);
  if (new Date(parsed).toISOString() !== parsed) {
    throw new Error(`CANOPYPROOF_E2A_NON_CANONICAL_TIMESTAMP: ${field}`);
  }
  return parsed;
}
