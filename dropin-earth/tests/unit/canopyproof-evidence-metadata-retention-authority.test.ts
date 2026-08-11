import assert from "node:assert/strict";
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
} from "../../services/api/src/domain/canopyproof/evidence-media-authority.js";
import {
  CanopyProofEvidenceMetadataRetentionAuthorityService,
  type CanopyProofEvidenceMetadataExtractionAuthority,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-retention-authority.js";
import type { CanopyProofVerificationActorSnapshot } from
  "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import { buildEffectiveMediaFixture } from "../helpers/canopyproof-effective-media-fixture.js";

const organizationId = "cp_e3b_org";
const projectId = "cp_e3b_project";
const evidenceId = "cp_e3b_evidence";

function contributor(): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id: "cp_e3b_contributor",
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e3b-contributor" }),
    organizationRoot: hashJson({ kind: "cp-e3b-organization" }),
    membershipId: "cp_e3b_contributor_membership",
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "cp-e3b-contributor-membership" }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function agent(capability: CanopyProofEvidenceMediaAgentCapability): CanopyProofEvidenceMediaAgentSnapshot {
  const id = `cp_e3b_agent_${capability}`;
  const seed = {
    id,
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e3b-agent", id }),
    organizationRoot: hashJson({ kind: "cp-e3b-organization" }),
    agentType: "evidence" as const,
    agentStatus: "active" as const,
    capability,
    agentRegistryHash: hashJson({ kind: "cp-e3b-agent-registry", id, capability }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(seed) };
}

function retentionDecider(scope = ["evidence_retention_governance"]): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id: "cp_e3b_owner",
    participantType: "human" as const,
    role: "owner" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e3b-owner" }),
    organizationRoot: hashJson({ kind: "cp-e3b-organization" }),
    membershipId: "cp_e3b_owner_membership",
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "cp-e3b-owner-membership" }),
    accreditationId: "cp_e3b_retention_accreditation",
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "cp-e3b-retention-accreditation" }),
    accreditationScope: [...scope].sort(),
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function createFixture(options: Readonly<{ verified?: boolean; privacyMode?: "precise" | "masked" | "restricted" }> = {}) {
  const verified = options.verified ?? true;
  const subject = contributor();
  const custody = new CanopyProofEvidenceCustodyAuthorityService();
  const capturedAt = "2026-07-13T10:00:00.000Z";
  const consent = custody.recordConsentReceipt(
    {
      subjectId: subject.id,
      deviceFingerprintHash: hashJson({ kind: "cp-e3b-device-fingerprint" }),
      purposes: ["evidence_collection", "geolocation", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: options.privacyMode ?? "restricted",
      policyVersion: "cp-e3b-consent-v1",
      evidenceHash: hashJson({ kind: "cp-e3b-consent-evidence" }),
      grantedAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2027-07-01T00:00:00.000Z",
      retentionDays: 365,
    },
    subject,
  );
  const device = custody.recordDeviceAttestation(
    {
      subjectId: subject.id,
      consentReceiptId: consent.id,
      deviceFingerprintHash: hashJson({ kind: "cp-e3b-device-fingerprint" }),
      attestationType: "secure_enclave",
      provider: "apple_app_attest",
      providerKeyId: "cp-e3b-device-key-v1",
      providerReceiptHash: hashJson({ kind: "cp-e3b-device-receipt" }),
      providerVerificationState: verified ? "verified" : "modeled_only",
      publicKeyHash: hashJson({ kind: "cp-e3b-public-key" }),
      attestationHash: hashJson({ kind: "cp-e3b-attestation" }),
      issuedAt: "2026-07-01T00:01:00.000Z",
      expiresAt: "2027-01-01T00:01:00.000Z",
      reputationScore: 90,
      riskFlags: [],
    },
    subject,
  );
  const media = new CanopyProofEvidenceMediaAuthorityService();
  const consentProjection = custody.projectConsentReceipt(consent.id, capturedAt);
  const deviceProjection = custody.projectDeviceAttestation(device.id, capturedAt);
  const intent = media.createUploadIntent(
    {
      evidenceId,
      contentHash: hashJson({ kind: "cp-e3b-media" }),
      contentType: "image/jpeg",
      byteLength: 1_048_576,
      capturedAt,
    },
    {
      actor: subject,
      project: {
        id: projectId,
        organizationId,
        status: "active",
        projectRoot: hashJson({ kind: "cp-e3b-project" }),
      },
      consent,
      consentProjection,
      device,
      deviceProjection,
    },
  );
  const object = media.confirmMediaObject(
    {
      intentId: intent.id,
      storageProvider: "cloudflare_r2",
      providerNamespace: "cp-e3b-media",
      objectVersion: "cp-e3b-object-v1",
      contentHash: intent.contentHash,
      byteLength: intent.byteLength,
      etagHash: hashJson({ kind: "cp-e3b-etag" }),
      providerReceiptHash: hashJson({ kind: "cp-e3b-object-receipt" }),
      providerVerificationState: "modeled_only",
      encryptionMode: "r2_managed",
      objectLockMode: "governance",
      retainUntil: "2026-07-20T00:00:00.000Z",
      storedAt: "2026-07-13T10:01:00.000Z",
    },
    agent("object_storage_receipt"),
  ).object;
  const scan = media.recordScanResult(
    {
      objectId: object.id,
      scannerName: "clamav-isolated",
      scannerVersion: "1.4.3",
      scannerImageDigest: hashJson({ kind: "cp-e3b-scanner" }),
      signatureDatabaseVersion: "daily-2026-07-13",
      verdict: "clean",
      findingHashes: [],
      providerReceiptHash: hashJson({ kind: "cp-e3b-scan-receipt" }),
      providerVerificationState: "modeled_only",
      scannedAt: "2026-07-13T10:02:00.000Z",
    },
    agent("malware_scan_result"),
  );
  const extractedAt = "2026-07-13T10:03:00.000Z";
  const baseMediaProjection = media.projectMediaObject(object.id, extractedAt, {
    consent: custody.projectConsentReceipt(consent.id, extractedAt),
    device: custody.projectDeviceAttestation(device.id, extractedAt),
  });
  const effectiveMedia = buildEffectiveMediaFixture({
    object,
    scan,
    baseProjection: baseMediaProjection,
    providerVerifier: agent("object_storage_receipt"),
    scannerVerifier: agent("malware_scan_result"),
  });
  const extractionAuthority: CanopyProofEvidenceMetadataExtractionAuthority = {
    intent,
    object,
    baseMediaProjection,
    mediaAdapterTrustProjection: effectiveMedia.adapterTrustProjection,
    mediaProjection: effectiveMedia.effectiveProjection,
    consent,
    consentProjection: custody.projectConsentReceipt(consent.id, extractedAt),
    device,
    deviceProjection: custody.projectDeviceAttestation(device.id, extractedAt),
    registeredGpsHash: hashJson({ kind: "cp-e3b-gps" }),
    agent: agent("metadata_extraction_receipt"),
  };
  return { custody, media, subject, consent, device, intent, object, extractedAt, extractionAuthority };
}

function extractionInput(fixture: ReturnType<typeof createFixture>) {
  return {
    objectId: fixture.object.id,
    extractorName: "exiftool-isolated",
    extractorVersion: "13.30",
    extractorImageDigest: hashJson({ kind: "cp-e3b-extractor-image" }),
    metadataSchemaVersion: "canopyproof.metadata.v1",
    exifHash: hashJson({ kind: "cp-e3b-exif" }),
    gpsHash: fixture.extractionAuthority.registeredGpsHash,
    metadataOutputRoot: hashJson({ kind: "cp-e3b-output" }),
    locationDisclosure: "none" as const,
    accuracyBand: "under_10m" as const,
    clockSkewBand: "under_1m" as const,
    providerReceiptHash: hashJson({ kind: "cp-e3b-extraction-receipt" }),
    providerVerificationState: "modeled_only" as const,
    observedAt: "2026-07-13T10:00:00.000Z",
    extractedAt: fixture.extractedAt,
  };
}

test("CanopyProof E3b appends minimized metadata, retention, and verified execution facts", () => {
  const fixture = createFixture();
  const service = new CanopyProofEvidenceMetadataRetentionAuthorityService();
  const extraction = service.recordMetadataExtraction(extractionInput(fixture), fixture.extractionAuthority);
  assert.equal(extraction.extractionState, "needs_review");
  assert.deepEqual(extraction.issueCodes, ["metadata_provider_verification_pending"]);
  assert.equal(extraction.locationDisclosure, "none");
  assert.equal(JSON.stringify(extraction).includes("latitude"), false);
  assert.equal(JSON.stringify(extraction).includes("longitude"), false);
  assert.equal(extraction.safety.noRawExif, true);

  const evaluatedAt = "2026-07-13T10:04:00.000Z";
  const decision = service.recordRetentionDecision(
    {
      sourceType: "metadata_extraction",
      sourceId: extraction.id,
      basis: "data_minimization",
      disposition: "minimize",
      retainUntil: "2026-07-20T00:00:00.000Z",
      policyId: "cp-e3b-retention-v1",
      rationale: "Minimize derived location metadata after bounded review use completes.",
      evaluatedAt,
    },
    {
      source: extraction,
      intent: fixture.intent,
      consent: fixture.consent,
      consentProjection: fixture.custody.projectConsentReceipt(fixture.consent.id, evaluatedAt),
      decider: retentionDecider(),
    },
  );
  const execution = service.recordRetentionExecution(
    {
      decisionId: decision.id,
      operation: "minimize",
      result: "completed",
      storageProvider: "cloudflare_r2",
      providerNamespace: "cp-e3b-media",
      providerReceiptHash: hashJson({ kind: "cp-e3b-minimize-receipt" }),
      providerVerificationState: "verified",
      resultingRoot: hashJson({ kind: "cp-e3b-minimized-tombstone" }),
      reasonHashes: [],
      executedAt: "2026-07-13T10:05:00.000Z",
    },
    {
      source: extraction,
      decision,
      object: fixture.object,
      agent: agent("verified_retention_execution_receipt"),
    },
  );
  assert.equal(execution.auditEvent.action, "FULFILL");
  assert.equal(
    service.projectRetention("metadata_extraction", extraction.id, "2026-07-13T10:06:00.000Z").state,
    "minimized",
  );
  assert.deepEqual(
    CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot())
      .projectRetention("metadata_extraction", extraction.id, "2026-07-13T10:06:00.000Z"),
    service.projectRetention("metadata_extraction", extraction.id, "2026-07-13T10:06:00.000Z"),
  );
});

test("CanopyProof E3b quarantines modeled source trust and rejects raw coordinates or authority substitution", () => {
  const unavailable = createFixture({ verified: false });
  const service = new CanopyProofEvidenceMetadataRetentionAuthorityService();
  assert.equal(unavailable.extractionAuthority.mediaProjection.state, "needs_review");
  const modeledSourceExtraction = service.recordMetadataExtraction(
    extractionInput(unavailable),
    unavailable.extractionAuthority,
  );
  assert.equal(modeledSourceExtraction.extractionState, "needs_review");
  assert.deepEqual(modeledSourceExtraction.issueCodes, [
    "device_attestation_verification_pending",
    "media_custody_verification_pending",
    "metadata_provider_verification_pending",
  ]);

  const fixture = createFixture();
  assert.throws(
    () =>
      service.recordMetadataExtraction(
        { ...extractionInput(fixture), latitude: 22.3, longitude: 114.1 },
        fixture.extractionAuthority,
      ),
    /Unrecognized key/,
  );
  assert.throws(
    () =>
      service.recordMetadataExtraction(
        {
          ...extractionInput(fixture),
          locationDisclosure: "region_hash",
          generalizedLocationHash: hashJson({ kind: "cp-e3b-region" }),
        },
        fixture.extractionAuthority,
      ),
    /restricted consent forbids location disclosure/,
  );

  const extraction = service.recordMetadataExtraction(extractionInput(fixture), fixture.extractionAuthority);
  const evaluatedAt = "2026-07-13T10:04:00.000Z";
  assert.throws(
    () =>
      service.recordRetentionDecision(
        {
          sourceType: "metadata_extraction",
          sourceId: extraction.id,
          basis: "data_minimization",
          disposition: "minimize",
          retainUntil: "2026-07-20T00:00:00.000Z",
          policyId: "cp-e3b-retention-v1",
          rationale: "This actor lacks the required retention governance accreditation.",
          evaluatedAt,
        },
        {
          source: extraction,
          intent: fixture.intent,
          consent: fixture.consent,
          consentProjection: fixture.custody.projectConsentReceipt(fixture.consent.id, evaluatedAt),
          decider: retentionDecider(["evidence_media_review"]),
        },
      ),
    /evidence_retention_governance accreditation/,
  );
});

test("CanopyProof E3b never projects modeled execution as completed and detects tampering", () => {
  const fixture = createFixture();
  const service = new CanopyProofEvidenceMetadataRetentionAuthorityService();
  const extraction = service.recordMetadataExtraction(extractionInput(fixture), fixture.extractionAuthority);
  const evaluatedAt = "2026-07-13T10:04:00.000Z";
  const decision = service.recordRetentionDecision(
    {
      sourceType: "metadata_extraction",
      sourceId: extraction.id,
      basis: "data_minimization",
      disposition: "minimize",
      retainUntil: "2026-07-20T00:00:00.000Z",
      policyId: "cp-e3b-retention-v1",
      rationale: "Minimize derived metadata while preserving an immutable decision record.",
      evaluatedAt,
    },
    {
      source: extraction,
      intent: fixture.intent,
      consent: fixture.consent,
      consentProjection: fixture.custody.projectConsentReceipt(fixture.consent.id, evaluatedAt),
      decider: retentionDecider(),
    },
  );
  service.recordRetentionExecution(
    {
      decisionId: decision.id,
      operation: "minimize",
      result: "completed",
      storageProvider: "cloudflare_r2",
      providerNamespace: "cp-e3b-media",
      providerReceiptHash: hashJson({ kind: "cp-e3b-modeled-minimize-receipt" }),
      providerVerificationState: "modeled_only",
      resultingRoot: hashJson({ kind: "cp-e3b-modeled-tombstone" }),
      reasonHashes: [],
      executedAt: "2026-07-13T10:05:00.000Z",
    },
    {
      source: extraction,
      decision,
      object: fixture.object,
      agent: agent("retention_execution_receipt"),
    },
  );
  assert.equal(
    service.projectRetention("metadata_extraction", extraction.id, "2026-07-13T10:06:00.000Z").state,
    "minimization_pending",
  );
  const snapshot = service.getAuthoritySnapshot();
  assert.throws(
    () =>
      CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        retentionDecisions: [
          { ...decision, decisionRoot: hashJson({ kind: "cp-e3b-tampered-decision" }) },
        ],
      }),
    /retention decision lineage is invalid/,
  );
});

test("CanopyProof E3b prevents stale disposal paths from bypassing a legal hold", () => {
  const fixture = createFixture();
  const service = new CanopyProofEvidenceMetadataRetentionAuthorityService();
  const extraction = service.recordMetadataExtraction(extractionInput(fixture), fixture.extractionAuthority);
  const minimize = service.recordRetentionDecision(
    {
      sourceType: "metadata_extraction",
      sourceId: extraction.id,
      basis: "data_minimization",
      disposition: "minimize",
      retainUntil: "2026-07-20T00:00:00.000Z",
      policyId: "cp-e3b-retention-v1",
      rationale: "Minimize derived metadata after a bounded institutional review window.",
      evaluatedAt: "2026-07-13T10:04:00.000Z",
    },
    {
      source: extraction,
      intent: fixture.intent,
      consent: fixture.consent,
      consentProjection: fixture.custody.projectConsentReceipt(
        fixture.consent.id,
        "2026-07-13T10:04:00.000Z",
      ),
      decider: retentionDecider(),
    },
  );
  service.recordRetentionDecision(
    {
      sourceType: "metadata_extraction",
      sourceId: extraction.id,
      basis: "legal_hold",
      disposition: "legal_hold",
      legalHoldRoot: hashJson({ kind: "cp-e3b-legal-hold" }),
      policyId: "cp-e3b-legal-hold-v1",
      rationale: "Preserve the source while an independent institutional challenge is reviewed.",
      evaluatedAt: "2026-07-13T10:05:00.000Z",
    },
    {
      source: extraction,
      intent: fixture.intent,
      consent: fixture.consent,
      consentProjection: fixture.custody.projectConsentReceipt(
        fixture.consent.id,
        "2026-07-13T10:05:00.000Z",
      ),
      decider: retentionDecider(),
    },
  );

  assert.throws(
    () =>
      service.recordRetentionExecution(
        {
          decisionId: minimize.id,
          operation: "minimize",
          result: "completed",
          storageProvider: "cloudflare_r2",
          providerNamespace: "cp-e3b-media",
          providerReceiptHash: hashJson({ kind: "cp-e3b-stale-execution" }),
          providerVerificationState: "modeled_only",
          resultingRoot: hashJson({ kind: "cp-e3b-stale-result" }),
          reasonHashes: [],
          executedAt: "2026-07-13T10:06:00.000Z",
        },
        {
          source: extraction,
          decision: minimize,
          object: fixture.object,
          agent: agent("retention_execution_receipt"),
        },
      ),
    /latest governed decision/,
  );
  assert.throws(
    () =>
      service.recordRetentionDecision(
        {
          sourceType: "metadata_extraction",
          sourceId: extraction.id,
          basis: "data_minimization",
          disposition: "minimize",
          retainUntil: "2026-07-20T00:00:00.000Z",
          policyId: "cp-e3b-retention-v1",
          rationale: "This must not supersede an active legal hold without governed release authority.",
          evaluatedAt: "2026-07-13T10:07:00.000Z",
        },
        {
          source: extraction,
          intent: fixture.intent,
          consent: fixture.consent,
          consentProjection: fixture.custody.projectConsentReceipt(
            fixture.consent.id,
            "2026-07-13T10:07:00.000Z",
          ),
          decider: retentionDecider(),
        },
      ),
    /legal hold is terminal/,
  );
});
