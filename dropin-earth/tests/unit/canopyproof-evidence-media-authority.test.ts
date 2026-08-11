import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofEvidenceCustodyAuthorityService,
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceCustodyActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  CanopyProofEvidenceMediaAuthorityService,
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentCapability,
  type CanopyProofEvidenceMediaAgentSnapshot,
  type CanopyProofEvidenceMediaIntentAuthority,
} from "../../services/api/src/domain/canopyproof/evidence-media-authority.js";
import {
  DisabledCanopyProofObjectStorageAdapter,
  isCanopyProofAdapterVerifiedStoredObjectReceipt,
  PolicyEnforcedCanopyProofObjectStorageAdapter,
  validateCanopyProofObjectUploadGrant,
  validateCanopyProofStoredObjectReceipt,
} from "../../services/api/src/domain/canopyproof/object-storage-adapter.js";
import {
  DisabledCanopyProofMalwareScannerAdapter,
  isCanopyProofVerifiedMalwareScanReceipt,
  PolicyEnforcedCanopyProofMalwareScannerAdapter,
  WebCryptoEd25519ScannerSignatureVerifier,
  validateCanopyProofMalwareScanReceipt,
} from "../../services/api/src/domain/canopyproof/malware-scanner-adapter.js";
import {
  assertCanopyProofEffectiveMediaObjectProjection,
  minimizeCanopyProofMalwareScanReceipt,
  projectCanopyProofEffectiveMediaObject,
  projectCanopyProofEvidenceMediaAdapterTrust,
} from "../../services/api/src/domain/canopyproof/evidence-media-adapter-authority.js";
import {
  CanopyProofEvidenceMediaAdapterOrchestrator,
} from "../../services/api/src/domain/canopyproof/evidence-media-adapter-orchestrator.js";
import { buildEffectiveMediaFixture } from "../helpers/canopyproof-effective-media-fixture.js";

const organizationId = "cp_evidence_media_org";
const projectId = "cp_evidence_media_project";

test("CanopyProof media adapter migration is append-only, tenant-bound, and secret-minimized", () => {
  const migration = readFileSync(
    join(process.cwd(), "services/api/prisma/evidence-media-adapters.sql"),
    "utf8",
  );
  const rollback = readFileSync(
    join(process.cwd(), "services/api/prisma/evidence-media-adapters.rollback.sql"),
    "utf8",
  );
  assert.match(migration, /media_provider_receipt_verification_facts/);
  assert.match(migration, /media_scanner_receipt_verification_facts/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/g);
  assert.match(migration, /audit\.command_receipts/);
  assert.match(migration, /media_adapter_trust_projection/);
  assert.match(
    migration,
    /provider_fact evidence\.media_provider_receipt_verification_facts%ROWTYPE/,
  );
  assert.match(migration, /WHERE object_id = NEW\.object_id FOR SHARE/);
  assert.doesNotMatch(migration, /\bupload_url\b|\bsigned_url\b|\bbearer_token\b/i);
  assert.doesNotMatch(migration, /\bsignature\s+text\b/i);
  assert.match(rollback, /CANOPYPROOF_E2A_ROLLBACK_REFUSED/);
  assert.doesNotMatch(rollback, /CASCADE/i);

  const orchestrator = new CanopyProofEvidenceMediaAdapterOrchestrator(
    {} as never,
    new DisabledCanopyProofObjectStorageAdapter(),
    new DisabledCanopyProofMalwareScannerAdapter(),
  );
  assert.deepEqual(orchestrator.getStatus(), {
    service: "canopyproof-evidence-media-adapter-orchestrator",
    routeMounted: false,
    productionActivated: false,
    externalCallsInsideDatabaseTransaction: false,
    providerReceiptRequired: true,
    scannerSignatureRequired: true,
    rawSignaturePersisted: false,
    uploadGrantPersisted: false,
    finalProofAuthority: false,
  });
});

function actor(id = "cp_evidence_media_subject"): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "evidence-media-subject", id }),
    organizationRoot: hashJson({ kind: "evidence-media-organization" }),
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "evidence-media-membership", id }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function agent(
  capability: CanopyProofEvidenceMediaAgentCapability,
  id = `cp_evidence_media_agent_${capability}`,
): CanopyProofEvidenceMediaAgentSnapshot {
  const seed = {
    id,
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "evidence-media-agent-subject", id }),
    organizationRoot: hashJson({ kind: "evidence-media-organization" }),
    agentType: "evidence" as const,
    agentStatus: "active" as const,
    capability,
    agentRegistryHash: hashJson({ kind: "evidence-media-agent-registry", id, capability }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(seed) };
}

function intentAuthority(
  capturedAt: string,
  providerVerificationState: "modeled_only" | "verified" = "modeled_only",
): CanopyProofEvidenceMediaIntentAuthority {
  const subject = actor();
  const custody = new CanopyProofEvidenceCustodyAuthorityService();
  const consent = custody.recordConsentReceipt(
    {
      subjectId: subject.id,
      deviceFingerprintHash: hashJson({ kind: "evidence-media-device", subjectId: subject.id }),
      purposes: ["evidence_collection", "media_upload", "geolocation"],
      lawfulBasis: "consent",
      privacyMode: "restricted",
      policyVersion: "evidence-media-consent-v1",
      evidenceHash: hashJson({ kind: "evidence-media-consent-evidence", subjectId: subject.id }),
      grantedAt: "2026-07-12T09:00:00.000Z",
      expiresAt: "2027-07-12T09:00:00.000Z",
      retentionDays: 365,
    },
    subject,
  );
  const device = custody.recordDeviceAttestation(
    {
      subjectId: subject.id,
      consentReceiptId: consent.id,
      deviceFingerprintHash: hashJson({ kind: "evidence-media-device", subjectId: subject.id }),
      attestationType: "webauthn",
      provider: "webauthn",
      providerKeyId: "evidence-media-webauthn-key-v1",
      providerReceiptHash: hashJson({ kind: "evidence-media-device-receipt", subjectId: subject.id }),
      providerVerificationState,
      publicKeyHash: hashJson({ kind: "evidence-media-device-public-key", subjectId: subject.id }),
      attestationHash: hashJson({ kind: "evidence-media-device-attestation", subjectId: subject.id }),
      issuedAt: "2026-07-12T09:01:00.000Z",
      expiresAt: "2027-01-12T09:01:00.000Z",
      reputationScore: 80,
      riskFlags: [],
    },
    subject,
  );
  return {
    actor: subject,
    project: {
      id: projectId,
      organizationId,
      status: "active",
      projectRoot: hashJson({ kind: "evidence-media-project" }),
    },
    consent,
    consentProjection: custody.projectConsentReceipt(consent.id, capturedAt),
    device,
    deviceProjection: custody.projectDeviceAttestation(device.id, capturedAt),
  };
}

function uploadInput(evidenceId: string, capturedAt: string, contentHash = hashJson({ kind: "evidence-media-content" })) {
  return {
    evidenceId,
    contentHash,
    contentType: "image/jpeg" as const,
    byteLength: 1_048_576,
    capturedAt,
  };
}

function objectInput(
  intentId: string,
  contentHash: string,
  storedAt: string,
  providerVerificationState: "modeled_only" | "verified" = "modeled_only",
) {
  return {
    intentId,
    storageProvider: "cloudflare_r2" as const,
    providerNamespace: "canopyproof-evidence-production",
    objectVersion: `object-version-${storedAt.replaceAll(/[^0-9]/g, "")}`,
    contentHash,
    byteLength: 1_048_576,
    etagHash: hashJson({ kind: "evidence-media-etag", intentId }),
    providerReceiptHash: hashJson({ kind: "evidence-media-provider-receipt", intentId }),
    providerVerificationState,
    encryptionMode: "r2_managed" as const,
    objectLockMode: "governance" as const,
    retainUntil: "2027-07-12T10:00:00.000Z",
    storedAt,
  };
}

function scanInput(
  objectId: string,
  scannedAt: string,
  providerVerificationState: "modeled_only" | "verified" = "modeled_only",
) {
  return {
    objectId,
    scannerName: "clamav-isolated",
    scannerVersion: "1.4.3",
    scannerImageDigest: hashJson({ kind: "evidence-media-scanner-image" }),
    signatureDatabaseVersion: "daily-2026-07-12",
    verdict: "clean" as const,
    findingHashes: [],
    providerReceiptHash: hashJson({ kind: "evidence-media-scan-receipt", objectId }),
    providerVerificationState,
    scannedAt,
  };
}

function r2PresignedPutUrl(input: Readonly<{
  objectKey: string;
  signedAt: string;
  expiresSeconds: number;
  host?: string;
  bucket?: string;
}>) {
  const host = input.host ?? "test-account.r2.cloudflarestorage.com";
  const bucket = input.bucket ?? "canopyproof-evidence-nonproduction";
  const date = input.signedAt.slice(0, 8);
  const url = new URL(`https://${host}/${bucket}/${input.objectKey}`);
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `TESTACCESSKEY/${date}/auto/s3/aws4_request`);
  url.searchParams.set("X-Amz-Date", input.signedAt);
  url.searchParams.set("X-Amz-Expires", String(input.expiresSeconds));
  url.searchParams.set("X-Amz-Signature", "a".repeat(64));
  url.searchParams.set("X-Amz-SignedHeaders", "content-type;host;x-amz-checksum-sha256");
  return url.toString();
}

test("effective media projection is deterministic, as-of bounded, and preserves hard state", () => {
  const media = new CanopyProofEvidenceMediaAuthorityService();
  const capturedAt = "2026-07-12T10:00:00.000Z";
  const authority = intentAuthority(capturedAt, "verified");
  const intent = media.createUploadIntent(
    uploadInput("cp_media_effective_projection", capturedAt),
    authority,
  );
  const object = media.confirmMediaObject(
    objectInput(intent.id, intent.contentHash, "2026-07-12T10:01:00.000Z"),
    agent("object_storage_receipt"),
  ).object;
  const cleanScan = media.recordScanResult(
    scanInput(object.id, "2026-07-12T10:02:00.000Z"),
    agent("malware_scan_result"),
  );
  const evaluatedAt = "2026-07-12T10:03:00.000Z";
  const baseProjection = media.projectMediaObject(object.id, evaluatedAt, {
    consent: authority.consentProjection,
    device: authority.deviceProjection,
  });
  assert.equal(baseProjection.state, "needs_review");
  const fixture = buildEffectiveMediaFixture({
    object,
    scan: cleanScan,
    baseProjection,
    providerVerifier: agent("object_storage_receipt"),
    scannerVerifier: agent("malware_scan_result"),
  });
  assert.equal(fixture.adapterTrustProjection.state, "verified_receipts");
  assert.equal(fixture.effectiveProjection.state, "available");
  assert.deepEqual(fixture.effectiveProjection.issueCodes, []);
  assert.deepEqual(
    projectCanopyProofEffectiveMediaObject({
      baseProjection,
      adapterTrustProjection: fixture.adapterTrustProjection,
    }),
    fixture.effectiveProjection,
  );

  const maliciousScan = media.recordScanResult(
    { ...scanInput(object.id, "2026-07-12T10:04:00.000Z"), verdict: "malicious" },
    agent("malware_scan_result"),
  );
  const replayedBase = media.projectMediaObject(object.id, evaluatedAt, {
    consent: authority.consentProjection,
    device: authority.deviceProjection,
  });
  const replayedTrust = projectCanopyProofEvidenceMediaAdapterTrust({
    object,
    providerVerification: fixture.providerVerification,
    scans: [cleanScan, maliciousScan],
    scannerVerifications: [fixture.scannerVerification],
    evaluatedAt,
  });
  assert.equal(replayedBase.projectionRoot, baseProjection.projectionRoot);
  assert.equal(replayedTrust.projectionRoot, fixture.adapterTrustProjection.projectionRoot);
  assert.equal(
    projectCanopyProofEffectiveMediaObject({
      baseProjection: replayedBase,
      adapterTrustProjection: replayedTrust,
    }).projectionRoot,
    fixture.effectiveProjection.projectionRoot,
  );

  const afterMalware = "2026-07-12T10:05:00.000Z";
  const challengedBase = media.projectMediaObject(object.id, afterMalware, {
    consent: authority.consentProjection,
    device: authority.deviceProjection,
  });
  const challengedTrust = projectCanopyProofEvidenceMediaAdapterTrust({
    object,
    providerVerification: fixture.providerVerification,
    scans: [cleanScan, maliciousScan],
    scannerVerifications: [fixture.scannerVerification],
    evaluatedAt: afterMalware,
  });
  const challenged = projectCanopyProofEffectiveMediaObject({
    baseProjection: challengedBase,
    adapterTrustProjection: challengedTrust,
  });
  assert.equal(challengedBase.state, "quarantined");
  assert.equal(challengedTrust.state, "scanner_pending");
  assert.equal(challenged.state, "quarantined");
  assert.ok(challenged.issueCodes.includes("media_quarantined"));

  assert.throws(
    () => assertCanopyProofEffectiveMediaObjectProjection({
      baseProjection,
      adapterTrustProjection: fixture.adapterTrustProjection,
      effectiveProjection: { ...fixture.effectiveProjection, state: "needs_review" },
    }),
    /EFFECTIVE_MEDIA_PROJECTION_INVALID/,
  );
  assert.throws(
    () => media.projectMediaObject(object.id, "2026-07-12T10:00:59.999Z", {
      consent: authority.consentProjection,
      device: authority.deviceProjection,
    }),
    /did not exist at the projection time/,
  );
});

test("CanopyProof media E2 records no grant and keeps modeled receipts in review", () => {
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const capturedAt = "2026-07-12T10:00:00.000Z";
  const authority = intentAuthority(capturedAt);
  const intent = service.createUploadIntent(uploadInput("cp_media_evidence_001", capturedAt), authority);
  assert.equal(service.createUploadIntent(uploadInput("cp_media_evidence_001", capturedAt), authority), intent);
  assert.equal(JSON.stringify(intent).includes("uploadUrl"), false);
  assert.equal(JSON.stringify(intent).includes("r2://"), false);
  assert.equal(intent.safety.noPersistedUploadGrant, true);

  assert.throws(
    () =>
      service.confirmMediaObject(
        objectInput(intent.id, intent.contentHash, "2026-07-12T09:59:59.000Z"),
        agent("object_storage_receipt"),
      ),
    /storage predates capture/,
  );

  const object = service.confirmMediaObject(
    objectInput(intent.id, intent.contentHash, "2026-07-12T10:01:00.000Z"),
    agent("object_storage_receipt"),
  ).object;
  assert.equal(
    service.projectMediaObject(object.id, "2026-07-12T10:01:30.000Z", {
      consent: authority.consentProjection,
      device: authority.deviceProjection,
    }).state,
    "pending_scan",
  );
  service.recordScanResult(
    scanInput(object.id, "2026-07-12T10:02:00.000Z"),
    agent("malware_scan_result"),
  );
  assert.equal(
    service.projectMediaObject(object.id, "2026-07-12T10:02:30.000Z", {
      consent: authority.consentProjection,
      device: authority.deviceProjection,
    }).state,
    "needs_review",
  );

  const replayed = CanopyProofEvidenceMediaAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getUploadIntent(intent.id), intent);
  assert.deepEqual(replayed.getMediaObject(object.id), object);
});

test("CanopyProof media E2 derives verified availability and immutable duplicate relations", () => {
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const contentHash = hashJson({ kind: "evidence-media-shared-content" });
  const firstCapturedAt = "2026-07-12T11:00:00.000Z";
  const firstAuthority = intentAuthority(firstCapturedAt, "verified");
  const firstIntent = service.createUploadIntent(
    uploadInput("cp_media_evidence_first", firstCapturedAt, contentHash),
    firstAuthority,
  );
  const firstObject = service.confirmMediaObject(
    objectInput(firstIntent.id, contentHash, "2026-07-12T11:01:00.000Z", "verified"),
    agent("object_storage_receipt"),
  ).object;
  service.recordScanResult(
    scanInput(firstObject.id, "2026-07-12T11:02:00.000Z", "verified"),
    agent("malware_scan_result"),
  );
  assert.equal(
    service.projectMediaObject(firstObject.id, "2026-07-12T11:02:30.000Z", {
      consent: firstAuthority.consentProjection,
      device: firstAuthority.deviceProjection,
    }).state,
    "available",
  );

  const secondCapturedAt = "2026-07-12T11:03:00.000Z";
  const secondAuthority = intentAuthority(secondCapturedAt, "verified");
  const secondIntent = service.createUploadIntent(
    uploadInput("cp_media_evidence_second", secondCapturedAt, contentHash),
    secondAuthority,
  );
  const secondBundle = service.confirmMediaObject(
    objectInput(secondIntent.id, contentHash, "2026-07-12T11:04:00.000Z", "verified"),
    agent("object_storage_receipt"),
  );
  assert.equal(secondBundle.duplicateRelation?.duplicateOfObjectId, firstObject.id);
  assert.equal(
    service.projectMediaObject(secondBundle.object.id, "2026-07-12T11:04:30.000Z", {
      consent: secondAuthority.consentProjection,
      device: secondAuthority.deviceProjection,
    }).state,
    "duplicate",
  );

  const replayed = CanopyProofEvidenceMediaAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.equal(
    replayed.getDuplicateRelation(secondBundle.duplicateRelation!.id).duplicateOfObjectRoot,
    firstObject.objectRoot,
  );
});

test("CanopyProof media E2 rejects authority substitution, credentials, and snapshot tampering", () => {
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const capturedAt = "2026-07-12T12:00:00.000Z";
  const authority = intentAuthority(capturedAt);
  assert.throws(
    () =>
      service.createUploadIntent(uploadInput("cp_media_evidence_wrong_org", capturedAt), {
        ...authority,
        project: { ...authority.project, organizationId: "cp_other_org" },
      }),
    /project organization authority mismatch/,
  );
  const intent = service.createUploadIntent(uploadInput("cp_media_evidence_tamper", capturedAt), authority);
  assert.throws(
    () =>
      service.confirmMediaObject(
        {
          ...objectInput(intent.id, intent.contentHash, "2026-07-12T12:01:00.000Z"),
          providerNamespace: "https://attacker.invalid?token=secret",
        },
        agent("object_storage_receipt"),
      ),
    /Invalid string|credential or endpoint material/,
  );
  assert.throws(
    () =>
      service.confirmMediaObject(
        objectInput(intent.id, intent.contentHash, "2026-07-12T12:01:00.000Z"),
        agent("malware_scan_result"),
      ),
    /lacks object_storage_receipt capability/,
  );

  const snapshot = service.getAuthoritySnapshot();
  assert.throws(
    () =>
      CanopyProofEvidenceMediaAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        uploadIntents: [{ ...intent, intentRoot: hashJson({ kind: "tampered-media-intent" }) }],
      }),
    /upload intent lineage is invalid/,
  );
});

test("CanopyProof media E2 validates only bounded ephemeral upload grants", async () => {
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const capturedAt = "2026-07-12T13:00:00.000Z";
  const intent = service.createUploadIntent(
    uploadInput("cp_media_evidence_grant", capturedAt),
    intentAuthority(capturedAt),
  );
  const url = r2PresignedPutUrl({
    objectKey: intent.objectKey,
    signedAt: "20260712T130000Z",
    expiresSeconds: 600,
  });
  const requiredHeaders = {
    "content-length": String(intent.byteLength),
    "content-type": intent.contentType,
    "x-amz-checksum-sha256": Buffer.from(intent.contentHash, "hex").toString("base64"),
  };
  const expiresAt = "2026-07-12T13:10:00.000Z";
  const urlHash = hashJson({ kind: "canopyproof-object-upload-grant-url-v1", url });
  const grantReceiptHash = hashJson({
    kind: "canopyproof-object-upload-grant-receipt-v1",
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    provider: "cloudflare_r2",
    objectKey: intent.objectKey,
    method: "PUT",
    urlHash,
    requiredHeaders,
    expiresAt,
  });
  const grant = {
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    provider: "cloudflare_r2",
    objectKey: intent.objectKey,
    method: "PUT",
    url,
    requiredHeaders,
    expiresAt,
    urlHash,
    grantReceiptHash,
  } as const;
  assert.equal(
    validateCanopyProofObjectUploadGrant(intent, grant, {
      now: capturedAt,
      allowedHosts: ["test-account.r2.cloudflarestorage.com"],
    }).grantReceiptHash,
    grantReceiptHash,
  );
  assert.throws(
    () =>
      validateCanopyProofObjectUploadGrant(intent, { ...grant, url: "https://attacker.invalid/upload" }, {
        now: capturedAt,
        allowedHosts: ["test-account.r2.cloudflarestorage.com"],
      }),
    /allowlisted HTTPS/,
  );
  assert.throws(
    () =>
      validateCanopyProofObjectUploadGrant(intent, {
        ...grant,
        requiredHeaders: { ...grant.requiredHeaders, authorization: "Bearer leaked" },
      }, {
        now: capturedAt,
        allowedHosts: ["test-account.r2.cloudflarestorage.com"],
      }),
    /forbidden request header/,
  );
  assert.throws(
    () =>
      validateCanopyProofObjectUploadGrant(intent, {
        ...grant,
        requiredHeaders: { ...grant.requiredHeaders, "x-amz-checksum-sha256": "invalid-checksum" },
      }, {
        now: capturedAt,
        allowedHosts: ["test-account.r2.cloudflarestorage.com"],
      }),
    /checksum does not match/,
  );
  assert.throws(
    () =>
      validateCanopyProofObjectUploadGrant(intent, {
        ...grant,
        requiredHeaders: { ...grant.requiredHeaders, "Content-Type": intent.contentType },
      }, {
        now: capturedAt,
        allowedHosts: ["test-account.r2.cloudflarestorage.com"],
      }),
    /duplicate request headers/,
  );
  const overlongUrlValue = new URL(grant.url);
  overlongUrlValue.searchParams.set("X-Amz-Expires", "604800");
  const overlongUrl = overlongUrlValue.toString();
  const overlongUrlHash = hashJson({ kind: "canopyproof-object-upload-grant-url-v1", url: overlongUrl });
  assert.throws(
    () =>
      validateCanopyProofObjectUploadGrant(
        intent,
        {
          ...grant,
          url: overlongUrl,
          urlHash: overlongUrlHash,
          grantReceiptHash: hashJson({
            kind: "canopyproof-object-upload-grant-receipt-v1",
            intentId: intent.id,
            intentRoot: intent.intentRoot,
            provider: grant.provider,
            objectKey: intent.objectKey,
            method: "PUT",
            urlHash: overlongUrlHash,
            requiredHeaders: grant.requiredHeaders,
            expiresAt: grant.expiresAt,
          }),
        },
        {
          now: capturedAt,
          allowedHosts: ["test-account.r2.cloudflarestorage.com"],
        },
      ),
    /SigV4 expiry is invalid/,
  );
  await assert.rejects(
    new DisabledCanopyProofObjectStorageAdapter().createUploadGrant(intent, {
      now: capturedAt,
      correlationId: "cp_media_grant_disabled",
    }),
    /OBJECT_STORAGE_ADAPTER_UNAVAILABLE/,
  );
});

test("CanopyProof object adapter binds grants and provider receipts to one immutable intent", async () => {
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const capturedAt = "2026-07-12T14:00:00.000Z";
  const intent = service.createUploadIntent(
    uploadInput("cp_media_evidence_adapter", capturedAt),
    intentAuthority(capturedAt, "verified"),
  );
  const providerNamespace = "canopyproof-evidence-nonproduction";
  const uploadedAt = "2026-07-12T14:01:00.000Z";
  const verifiedAt = "2026-07-12T14:02:00.000Z";
  const receiptSeed = {
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    provider: "cloudflare_r2" as const,
    providerNamespace,
    objectKey: intent.objectKey,
    objectVersion: "r2-version-0001",
    contentHash: intent.contentHash,
    contentType: intent.contentType,
    byteLength: intent.byteLength,
    etagHash: hashJson({ kind: "canopyproof-r2-etag", intentId: intent.id }),
    uploadedAt,
    encryptionMode: "r2_managed" as const,
    objectLockMode: "governance" as const,
    retainUntil: "2027-07-12T14:01:00.000Z",
    retentionPolicyRoot: hashJson({ kind: "canopyproof-r2-bucket-lock-policy", providerNamespace }),
    retentionVerificationState: "verified" as const,
    verifiedAt,
  };
  const storedObjectReceipt = {
    ...receiptSeed,
    providerReceiptHash: hashJson({ kind: "canopyproof-stored-object-provider-receipt-v1", ...receiptSeed }),
  };
  const validatedStoredObject = validateCanopyProofStoredObjectReceipt(intent, storedObjectReceipt, {
      now: verifiedAt,
      provider: "cloudflare_r2",
      providerNamespace,
    });
  assert.equal(validatedStoredObject.providerReceiptHash, storedObjectReceipt.providerReceiptHash);
  assert.equal(isCanopyProofAdapterVerifiedStoredObjectReceipt(validatedStoredObject), false);
  assert.equal(
    validatedStoredObject.providerVerificationRoot,
    hashJson({
      kind: "canopyproof-stored-object-provider-verification-v1",
      intentId: intent.id,
      intentRoot: intent.intentRoot,
      provider: "cloudflare_r2",
      providerNamespace,
      providerReceiptHash: storedObjectReceipt.providerReceiptHash,
      verifiedAt,
    }),
  );
  assert.throws(
    () =>
      validateCanopyProofStoredObjectReceipt(intent, { ...storedObjectReceipt, providerNamespace: "other-bucket" }, {
        now: verifiedAt,
        provider: "cloudflare_r2",
        providerNamespace,
      }),
    /authority binding/,
  );
  assert.throws(
    () =>
      validateCanopyProofStoredObjectReceipt(intent, { ...storedObjectReceipt, byteLength: intent.byteLength - 1 }, {
        now: verifiedAt,
        provider: "cloudflare_r2",
        providerNamespace,
      }),
    /content binding/,
  );

  const adapter = new PolicyEnforcedCanopyProofObjectStorageAdapter(
    {
      provider: "cloudflare_r2",
      providerNamespace,
      allowedUploadHosts: ["test-account.r2.cloudflarestorage.com"],
      maximumGrantTtlSeconds: 600,
    },
    {
      async createUploadGrant(request) {
        const url = r2PresignedPutUrl({
          objectKey: request.objectKey,
          signedAt: "20260712T140000Z",
          expiresSeconds: 600,
        });
        const requiredHeaders = {
          "content-length": String(request.byteLength),
          "content-type": request.contentType,
          "x-amz-checksum-sha256": Buffer.from(request.contentHash, "hex").toString("base64"),
        };
        const urlHash = hashJson({ kind: "canopyproof-object-upload-grant-url-v1", url });
        return {
          intentId: intent.id,
          intentRoot: intent.intentRoot,
          provider: request.provider,
          objectKey: request.objectKey,
          method: "PUT",
          url,
          requiredHeaders,
          expiresAt: request.expiresAt,
          urlHash,
          grantReceiptHash: hashJson({
            kind: "canopyproof-object-upload-grant-receipt-v1",
            intentId: intent.id,
            intentRoot: intent.intentRoot,
            provider: request.provider,
            objectKey: request.objectKey,
            method: "PUT",
            urlHash,
            requiredHeaders,
            expiresAt: request.expiresAt,
          }),
        };
      },
      async headStoredObject(request) {
        assert.equal(request.objectKey, intent.objectKey);
        assert.equal(request.intentRoot, intent.intentRoot);
        return storedObjectReceipt;
      },
    },
  );
  const grant = await adapter.createUploadGrant(intent, {
    now: capturedAt,
    correlationId: "cp_media_adapter_grant_001",
  });
  assert.equal(grant.objectKey, intent.objectKey);
  assert.equal(grant.expiresAt, "2026-07-12T14:10:00.000Z");
  const adapterVerifiedReceipt = await adapter.verifyStoredObject(intent, {
    now: verifiedAt,
    correlationId: "cp_media_adapter_head_001",
  });
  assert.equal(adapterVerifiedReceipt.providerReceiptHash, storedObjectReceipt.providerReceiptHash);
  assert.equal(isCanopyProofAdapterVerifiedStoredObjectReceipt(adapterVerifiedReceipt), true);
  assert.equal(Object.isFrozen(adapterVerifiedReceipt), true);
  assert.throws(
    () => Object.assign(adapterVerifiedReceipt, { objectVersion: "tampered-object-version" }),
    TypeError,
  );

  const substitutedUrlValue = new URL(grant.url);
  substitutedUrlValue.pathname = "/canopyproof-evidence-nonproduction/canopyproof/other/object";
  const substitutedUrl = substitutedUrlValue.toString();
  const substitutedUrlHash = hashJson({ kind: "canopyproof-object-upload-grant-url-v1", url: substitutedUrl });
  assert.throws(
    () =>
      validateCanopyProofObjectUploadGrant(
        intent,
        {
          ...grant,
          url: substitutedUrl,
          urlHash: substitutedUrlHash,
          grantReceiptHash: hashJson({
            kind: "canopyproof-object-upload-grant-receipt-v1",
            intentId: intent.id,
            intentRoot: intent.intentRoot,
            provider: grant.provider,
            objectKey: intent.objectKey,
            method: "PUT",
            urlHash: substitutedUrlHash,
            requiredHeaders: grant.requiredHeaders,
            expiresAt: grant.expiresAt,
          }),
        },
        {
          now: capturedAt,
          allowedHosts: ["test-account.r2.cloudflarestorage.com"],
          provider: "cloudflare_r2",
        },
      ),
    /does not bind the intended object key/,
  );
});

test("CanopyProof scanner adapter rejects forged and cross-object clean receipts", async () => {
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const capturedAt = "2026-07-12T15:00:00.000Z";
  const authority = intentAuthority(capturedAt, "verified");
  const intent = service.createUploadIntent(uploadInput("cp_media_evidence_scanner", capturedAt), authority);
  const object = service.confirmMediaObject(
    objectInput(intent.id, intent.contentHash, "2026-07-12T15:01:00.000Z", "verified"),
    agent("object_storage_receipt"),
  ).object;
  const scannerPolicyRoot = hashJson({ kind: "canopyproof-scanner-policy", version: "2026-07-12" });
  const receiptSeed = {
    objectId: object.id,
    objectRoot: object.objectRoot,
    providerReceiptHash: object.providerReceiptHash,
    scannerId: "clamav-isolated-nonproduction",
    scannerName: "ClamAV isolated scanner",
    scannerVersion: "1.4.3",
    scannerImageDigest: hashJson({ kind: "canopyproof-scanner-image", version: "1.4.3" }),
    signatureDatabaseVersion: "daily-2026-07-12",
    verdict: "clean" as const,
    findingHashes: [] as readonly string[],
    scannedAt: "2026-07-12T15:02:00.000Z",
    signerKeyId: "scanner-ed25519-key-2026-07",
    signatureAlgorithm: "ed25519" as const,
  };
  const receipt = {
    ...receiptSeed,
    signature: "A".repeat(86),
    receiptHash: hashJson({ kind: "canopyproof-malware-scan-receipt-v1", ...receiptSeed }),
  };
  assert.equal(
    validateCanopyProofMalwareScanReceipt(object, receipt, {
      now: "2026-07-12T15:03:00.000Z",
      scannerId: receipt.scannerId,
      allowedSignerKeyIds: [receipt.signerKeyId],
    }).receiptHash,
    receipt.receiptHash,
  );
  assert.throws(
    () =>
      validateCanopyProofMalwareScanReceipt(object, { ...receipt, objectRoot: hashJson({ kind: "other-object" }) }, {
        now: "2026-07-12T15:03:00.000Z",
        scannerId: receipt.scannerId,
        allowedSignerKeyIds: [receipt.signerKeyId],
      }),
    /object binding/,
  );
  assert.throws(
    () =>
      validateCanopyProofMalwareScanReceipt(object, { ...receipt, signerKeyId: "unapproved-key" }, {
        now: "2026-07-12T15:03:00.000Z",
        scannerId: receipt.scannerId,
        allowedSignerKeyIds: [receipt.signerKeyId],
      }),
    /signer is not approved/,
  );

  const scanner = new PolicyEnforcedCanopyProofMalwareScannerAdapter(
    {
      scannerId: receipt.scannerId,
      scannerPolicyRoot,
      allowedSignerKeyIds: [receipt.signerKeyId],
    },
    {
      async scanObject(request) {
        assert.equal(request.objectRoot, object.objectRoot);
        assert.equal(request.objectVersion, object.objectVersion);
        return receipt;
      },
    },
    {
      async verify(input) {
        return input.receiptHash === receipt.receiptHash && input.signature === receipt.signature;
      },
    },
  );
  const verified = await scanner.scanObject(object, {
    now: "2026-07-12T15:03:00.000Z",
    correlationId: "cp_media_scanner_001",
  });
  assert.equal(isCanopyProofVerifiedMalwareScanReceipt(verified), true);
  assert.equal(Object.isFrozen(verified), true);
  assert.equal(Object.isFrozen(verified.findingHashes), true);
  assert.equal(isCanopyProofVerifiedMalwareScanReceipt({ ...verified }), false);
  assert.throws(
    () => minimizeCanopyProofMalwareScanReceipt({ ...verified } as never),
    /NOT_ADAPTER_VERIFIED/,
  );
  const durableReceipt = minimizeCanopyProofMalwareScanReceipt(verified);
  assert.equal("signature" in durableReceipt, false);
  assert.equal(Object.isFrozen(durableReceipt), true);
  assert.equal(Object.isFrozen(durableReceipt.findingHashes), true);
  assert.equal(durableReceipt.signatureHash.length, 64);
  assert.equal(verified.scannerPolicyRoot, scannerPolicyRoot);
  assert.equal(
    verified.signatureHash,
    hashJson({
      kind: "canopyproof-malware-scan-signature-v1",
      signatureAlgorithm: receipt.signatureAlgorithm,
      signature: receipt.signature,
    }),
  );
  assert.equal(
    verified.verificationRoot,
    hashJson({
      kind: "canopyproof-malware-scan-verification-v1",
      receiptHash: receipt.receiptHash,
      signerKeyId: receipt.signerKeyId,
      scannerPolicyRoot,
      signatureHash: verified.signatureHash,
      verifiedAt: "2026-07-12T15:03:00.000Z",
    }),
  );

  const rejectingScanner = new PolicyEnforcedCanopyProofMalwareScannerAdapter(
    {
      scannerId: receipt.scannerId,
      scannerPolicyRoot,
      allowedSignerKeyIds: [receipt.signerKeyId],
    },
    { async scanObject() { return receipt; } },
    { async verify() { return false; } },
  );
  await assert.rejects(
    rejectingScanner.scanObject(object, {
      now: "2026-07-12T15:03:00.000Z",
      correlationId: "cp_media_scanner_reject_001",
    }),
    /SCANNER_RECEIPT_INVALID/,
  );
  await assert.rejects(
    new DisabledCanopyProofMalwareScannerAdapter().scanObject(object, {
      now: "2026-07-12T15:03:00.000Z",
      correlationId: "cp_media_scanner_disabled_001",
    }),
    /MALWARE_SCANNER_UNAVAILABLE/,
  );
});

test("CanopyProof scanner verifier accepts only the registered Ed25519 public key", async () => {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const keyId = "scanner-ed25519-key-webcrypto-test";
  const receiptHash = hashJson({ kind: "canopyproof-scanner-signed-receipt", id: "receipt-001" });
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      keyPair.privateKey,
      new TextEncoder().encode(receiptHash),
    ),
  );
  const encodedSignature = Buffer.from(signature).toString("base64url");
  const verifier = new WebCryptoEd25519ScannerSignatureVerifier({ [keyId]: publicKey });
  assert.throws(
    () => new WebCryptoEd25519ScannerSignatureVerifier({ [keyId]: privateKey }),
    /must be an Ed25519 verification JWK/,
  );
  assert.equal(
    await verifier.verify({
      signerKeyId: keyId,
      signatureAlgorithm: "ed25519",
      receiptHash,
      signature: encodedSignature,
    }),
    true,
  );
  assert.equal(
    await verifier.verify({
      signerKeyId: keyId,
      signatureAlgorithm: "ed25519",
      receiptHash: hashJson({ kind: "tampered-scanner-receipt" }),
      signature: encodedSignature,
    }),
    false,
  );
  assert.equal(
    await verifier.verify({
      signerKeyId: "unknown-scanner-key",
      signatureAlgorithm: "ed25519",
      receiptHash,
      signature: encodedSignature,
    }),
    false,
  );
});

test("CanopyProof adapter orchestration refuses scanning before durable provider verification", async () => {
  const capturedAt = "2026-07-12T17:00:00.000Z";
  const service = new CanopyProofEvidenceMediaAuthorityService();
  const intent = service.createUploadIntent(
    uploadInput("cp_media_evidence_provider_preflight", capturedAt),
    intentAuthority(capturedAt, "verified"),
  );
  const object = service.confirmMediaObject(
    objectInput(intent.id, intent.contentHash, "2026-07-12T17:01:00.000Z", "verified"),
    agent("object_storage_receipt"),
  ).object;
  let scannerCalls = 0;
  const orchestrator = new CanopyProofEvidenceMediaAdapterOrchestrator(
    {
      async getEvidenceMediaUploadIntent() {
        return intent;
      },
      async getEvidenceMediaObject() {
        return object;
      },
      async findEvidenceMediaProviderVerificationForIntent() {
        return undefined;
      },
      async findEvidenceMediaScannerVerificationForObject() {
        return undefined;
      },
      async commitEvidenceMediaProviderVerification() {
        throw new Error("unexpected provider commit");
      },
      async commitEvidenceMediaScannerVerification() {
        throw new Error("unexpected scanner commit");
      },
    },
    new DisabledCanopyProofObjectStorageAdapter(),
    {
      async scanObject() {
        scannerCalls += 1;
        throw new Error("unexpected scanner call");
      },
    },
  );

  await assert.rejects(
    orchestrator.scanStoredObject({
      organizationId,
      agentId: "cp_evidence_media_agent_malware_scan_result",
      objectId: object.id,
      idempotencyKey: "provider-preflight-scan-001",
      correlationId: "cp_media_provider_preflight_scan",
      now: "2026-07-12T17:02:00.000Z",
    }),
    /CANOPYPROOF_E2A_PROVIDER_VERIFICATION_REQUIRED/,
  );
  assert.equal(scannerCalls, 0);
});
