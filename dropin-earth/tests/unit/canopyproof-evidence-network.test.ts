import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofEvidenceNetworkService } from "../../services/api/src/domain/canopyproof/evidence-network.js";
import { CanopyProofService } from "../../services/api/src/domain/canopyproof/proof-service.js";

const timestamp = "2026-07-09T00:00:00.000Z";
const deviceHash = "d".repeat(64);

function evidencePayload(id: string, mediaHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    projectId: "project_v1_ggw_demo",
    evidenceType: "tree_planting",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 9,
      regionId: "region_ggw_sahel",
    },
    timestamp,
    media_hash: mediaHash,
    gps_hash: "2".repeat(64),
    confidence_score: 88,
    exif_hash: "4".repeat(64),
    ...overrides,
  };
}

function actorHeaders(role: string, actorId = `${role}_evidence_network_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

test("CanopyProof Evidence Network creates content-addressed upload intents without storage secrets", () => {
  const network = new CanopyProofEvidenceNetworkService(new CanopyProofService());
  const intent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      contentHash: "a".repeat(64),
      contentType: "image/jpeg",
      byteLength: 1024,
      capturedAt: timestamp,
      deviceFingerprintHash: deviceHash,
    },
    "community_media_actor",
  );

  assert.equal(intent.uploadMethod, "PUT");
  assert.match(intent.objectKey, /canopyproof\/evidence\/project_v1_ggw_demo\/cp_evidence_/);
  assert.match(intent.uploadUrl, /^r2:\/\/canopyproof-evidence\//);
  assert.doesNotMatch(intent.uploadUrl, /token|secret|signature/i);
  assert.equal(intent.auditEvent.entityType, "media_upload_intent");
});

test("CanopyProof Evidence Network confirms encrypted media objects with scan and duplicate state", () => {
  const network = new CanopyProofEvidenceNetworkService(new CanopyProofService());
  const firstIntent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_media_object_001",
      contentHash: "a".repeat(64),
      contentType: "image/jpeg",
      byteLength: 2048,
      capturedAt: timestamp,
      deviceFingerprintHash: deviceHash,
    },
    "community_media_actor",
  );

  const firstObject = network.confirmMediaObject(
    {
      intentId: firstIntent.id,
      contentHash: firstIntent.contentHash,
      objectKey: firstIntent.objectKey,
      byteLength: firstIntent.byteLength,
      storedAt: timestamp,
      storageProvider: "cloudflare_r2",
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: timestamp,
        signatureVersion: "main-2026-07-09",
      },
      exifHash: "4".repeat(64),
      gpsHash: "2".repeat(64),
    },
    "community_media_actor",
  );

  assert.equal(firstObject.mediaState, "available");
  assert.equal(firstObject.encryption.atRest, true);
  assert.equal(firstObject.malwareScan.status, "clean");
  assert.equal(firstObject.auditEvent.entityType, "media_object");
  assert.doesNotMatch(JSON.stringify(firstObject), /token|password|BEGIN PRIVATE/i);

  const uploadCustody = network.recordCustodyEvent(
    {
      evidenceId: firstIntent.evidenceId,
      action: "uploaded",
      artifactType: "media_upload_intent",
      artifactId: firstIntent.id,
      custodianOrganizationId: "org_field_team_001",
      custodyNote: "Field device created a content-addressed upload intent for evidence collection.",
      occurredAt: timestamp,
      policyId: "canopyproof-evidence-custody-v1",
    },
    "community_media_actor",
  );
  const storedCustody = network.recordCustodyEvent(
    {
      evidenceId: firstObject.evidenceId,
      action: "stored",
      artifactType: "media_object",
      artifactId: firstObject.id,
      custodianOrganizationId: "org_field_team_001",
      custodyNote: "Encrypted object-storage custody recorded after malware scan completion.",
      occurredAt: "2026-07-09T00:01:00.000Z",
      policyId: "canopyproof-evidence-custody-v1",
    },
    "community_media_actor",
  );
  assert.equal(uploadCustody.auditEvent.entityType, "evidence_custody_event");
  assert.equal(uploadCustody.sourceRoot, firstIntent.auditEvent.eventRoot);
  assert.equal(storedCustody.sourceRoot, firstObject.integrityRoot);
  assert.equal(storedCustody.previousCustodyRoot, uploadCustody.custodyRoot);
  assert.equal(storedCustody.safety.sourceRootBound, true);
  assert.equal(storedCustody.safety.notFinalProofAuthority, true);
  assert.equal(network.getStatus().custodyEventCount, 2);
  assert.equal(network.getStatus().safety.custodyChainIsAppendOnly, true);
  assert.throws(
    () =>
      network.recordCustodyEvent(
        {
          evidenceId: "evidence_media_object_wrong_001",
          action: "stored",
          artifactType: "media_object",
          artifactId: firstObject.id,
          custodyNote: "This custody record points to the wrong evidence ID and must fail closed.",
          occurredAt: "2026-07-09T00:01:30.000Z",
        },
        "community_media_actor",
      ),
    /does not belong to evidenceId/,
  );
  assert.throws(
    () =>
      network.recordCustodyEvent(
        {
          evidenceId: firstObject.evidenceId,
          action: "stored",
          artifactType: "media_object",
          artifactId: firstObject.id,
          custodyNote: "Contact verifier@example.org for private custody transfer.",
          occurredAt: "2026-07-09T00:01:30.000Z",
        },
        "community_media_actor",
      ),
    /must not contain raw private contact data/,
  );

  const replay = network.confirmMediaObject(
    {
      intentId: firstIntent.id,
      contentHash: firstIntent.contentHash,
      objectKey: firstIntent.objectKey,
      byteLength: firstIntent.byteLength,
      storedAt: timestamp,
      storageProvider: "cloudflare_r2",
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: timestamp,
        signatureVersion: "main-2026-07-09",
      },
    },
    "community_media_actor",
  );
  assert.equal(replay.id, firstObject.id);

  const duplicateIntent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_media_object_duplicate_001",
      contentHash: "a".repeat(64),
      contentType: "image/jpeg",
      byteLength: 2048,
      capturedAt: "2026-07-09T00:02:00.000Z",
    },
    "community_media_actor",
  );
  const duplicateObject = network.confirmMediaObject(
    {
      intentId: duplicateIntent.id,
      contentHash: duplicateIntent.contentHash,
      objectKey: duplicateIntent.objectKey,
      byteLength: duplicateIntent.byteLength,
      storedAt: "2026-07-09T00:02:00.000Z",
      storageProvider: "cloudflare_r2",
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: "2026-07-09T00:02:00.000Z",
        signatureVersion: "main-2026-07-09",
      },
    },
    "community_media_actor",
  );
  assert.equal(duplicateObject.mediaState, "duplicate");
  assert.equal(duplicateObject.duplicateOfMediaObjectId, firstObject.id);

  const quarantinedIntent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_media_object_quarantine_001",
      contentHash: "b".repeat(64),
      contentType: "image/png",
      byteLength: 4096,
      capturedAt: "2026-07-09T00:03:00.000Z",
    },
    "community_media_actor",
  );
  const quarantined = network.confirmMediaObject(
    {
      intentId: quarantinedIntent.id,
      contentHash: quarantinedIntent.contentHash,
      objectKey: quarantinedIntent.objectKey,
      byteLength: quarantinedIntent.byteLength,
      storedAt: "2026-07-09T00:03:00.000Z",
      storageProvider: "cloudflare_r2",
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "quarantined",
        scanner: "clamav-edge",
        scannedAt: "2026-07-09T00:03:00.000Z",
        signatureVersion: "main-2026-07-09",
      },
    },
    "community_media_actor",
  );
  assert.equal(quarantined.mediaState, "quarantined");
  assert.equal(network.getStatus().mediaObjectCount, 3);
  assert.equal(network.getStatus().duplicateMediaObjectCount, 1);
  assert.equal(network.getStatus().quarantinedMediaObjectCount, 1);
  assert.equal(network.getStatus().evidenceReviewTaskCount, 2);
  assert.equal(network.getStatus().openEvidenceReviewTaskCount, 2);
  assert.ok(network.listEvidenceReviewTasks({ sourceType: "media_object" }).some((task) => task.reasonCodes.includes("media_duplicate_content_hash")));
  assert.ok(network.listEvidenceReviewTasks({ sourceType: "media_object" }).some((task) => task.reasonCodes.includes("media_quarantined")));
  const mismatchIntent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_media_object_mismatch_001",
      contentHash: "d".repeat(64),
      contentType: "image/jpeg",
      byteLength: 1024,
      capturedAt: "2026-07-09T00:04:00.000Z",
    },
    "community_media_actor",
  );
  assert.throws(
    () =>
      network.confirmMediaObject(
        {
          intentId: mismatchIntent.id,
          contentHash: "c".repeat(64),
          objectKey: mismatchIntent.objectKey,
          byteLength: mismatchIntent.byteLength,
          storedAt: timestamp,
          encryption: { atRest: true, mode: "r2_managed" },
          malwareScan: { status: "pending", scanner: "clamav-edge" },
        },
        "community_media_actor",
      ),
    /media object contentHash must match/,
  );
});

test("CanopyProof Evidence Network binds EXIF/GPS extraction to consent and device attestation", () => {
  const network = new CanopyProofEvidenceNetworkService(new CanopyProofService());
  const intent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_metadata_extract_001",
      contentHash: "e".repeat(64),
      contentType: "image/jpeg",
      byteLength: 2048,
      capturedAt: timestamp,
      deviceFingerprintHash: deviceHash,
    },
    "community_metadata_actor",
  );
  const mediaObject = network.confirmMediaObject(
    {
      intentId: intent.id,
      contentHash: intent.contentHash,
      objectKey: intent.objectKey,
      byteLength: intent.byteLength,
      storedAt: timestamp,
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: timestamp,
        signatureVersion: "main-2026-07-09",
      },
      exifHash: "4".repeat(64),
      gpsHash: "2".repeat(64),
    },
    "community_metadata_actor",
  );
  const consent = network.recordConsentReceipt(
    {
      subjectId: "community_metadata_actor",
      deviceFingerprintHash: deviceHash,
      purposes: ["evidence_collection", "geolocation", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: "precise",
      policyVersion: "canopyproof-privacy-v1",
      evidenceHash: "6".repeat(64),
      grantedAt: timestamp,
      retentionDays: 365,
    },
    "community_metadata_actor",
  );
  const attestation = network.recordDeviceAttestation(
    {
      subjectId: "community_metadata_actor",
      deviceFingerprintHash: deviceHash,
      consentReceiptId: consent.id,
      attestationType: "secure_enclave",
      publicKeyHash: "7".repeat(64),
      attestationHash: "8".repeat(64),
      issuedAt: timestamp,
      expiresAt: "2026-08-09T00:00:00.000Z",
      reputationScore: 88,
      riskFlags: [],
    },
    "community_metadata_actor",
  );
  const extraction = network.extractMediaMetadata(
    {
      mediaObjectId: mediaObject.id,
      consentReceiptId: consent.id,
      deviceAttestationId: attestation.id,
      extractorVersion: "exiftool-wasm-1.0.0",
      extractedAt: "2026-07-09T00:01:00.000Z",
      observedAt: timestamp,
      exifHash: "4".repeat(64),
      gpsHash: "2".repeat(64),
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 9,
        regionId: "region_ggw_sahel",
      },
      sensorMetadata: {
        altitudeMeters: 32,
        headingDegrees: 180,
        horizontalAccuracyMeters: 9,
        clockSkewSeconds: 4,
        networkType: "offline",
      },
    },
    "community_metadata_actor",
  );

  assert.equal(extraction.extractionState, "accepted");
  assert.deepEqual(extraction.issues, []);
  assert.equal(extraction.auditEvent.entityType, "media_metadata_extraction");
  assert.match(extraction.metadataRoot, /^[a-f0-9]{64}$/);

  const revoked = network.revokeConsentReceipt(
    consent.id,
    {
      revokedAt: "2026-07-09T00:02:00.000Z",
      reason: "Contributor withdrew future geolocation consent for this device.",
    },
    "community_metadata_actor",
  );
  assert.equal(revoked.revokedAt, "2026-07-09T00:02:00.000Z");
  assert.throws(
    () =>
      network.extractMediaMetadata(
        {
          mediaObjectId: mediaObject.id,
          consentReceiptId: consent.id,
          deviceAttestationId: attestation.id,
          extractorVersion: "exiftool-wasm-1.0.0",
          extractedAt: "2026-07-09T00:03:00.000Z",
          observedAt: timestamp,
          exifHash: "4".repeat(64),
          gpsHash: "2".repeat(64),
          location: { latitude: 14.7167, longitude: -17.4677, accuracyMeters: 9 },
        },
        "community_metadata_actor",
      ),
    /consent receipt has been revoked/,
  );
  assert.equal(network.getStatus().consentReceiptCount, 1);
  assert.equal(network.getStatus().revokedConsentReceiptCount, 1);
  assert.equal(network.getStatus().deviceAttestationCount, 1);
  assert.equal(network.getStatus().mediaMetadataExtractionCount, 1);
});

test("CanopyProof Evidence Network routes risky device metadata extraction to review", () => {
  const network = new CanopyProofEvidenceNetworkService(new CanopyProofService());
  const intent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_metadata_review_001",
      contentHash: "9".repeat(64),
      contentType: "image/jpeg",
      byteLength: 1024,
      capturedAt: timestamp,
      deviceFingerprintHash: deviceHash,
    },
    "community_risky_device_actor",
  );
  const mediaObject = network.confirmMediaObject(
    {
      intentId: intent.id,
      contentHash: intent.contentHash,
      objectKey: intent.objectKey,
      byteLength: intent.byteLength,
      storedAt: timestamp,
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: timestamp,
        signatureVersion: "main-2026-07-09",
      },
      exifHash: "a".repeat(64),
      gpsHash: "b".repeat(64),
    },
    "community_risky_device_actor",
  );
  const consent = network.recordConsentReceipt(
    {
      subjectId: "community_risky_device_actor",
      deviceFingerprintHash: deviceHash,
      purposes: ["evidence_collection", "geolocation", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: "masked",
      policyVersion: "canopyproof-privacy-v1",
      evidenceHash: "c".repeat(64),
      grantedAt: timestamp,
      retentionDays: 365,
    },
    "community_risky_device_actor",
  );
  const riskyAttestation = network.recordDeviceAttestation(
    {
      subjectId: "community_risky_device_actor",
      deviceFingerprintHash: deviceHash,
      consentReceiptId: consent.id,
      attestationType: "platform_key",
      publicKeyHash: "d".repeat(64),
      attestationHash: "e".repeat(64),
      issuedAt: timestamp,
      expiresAt: "2026-08-09T00:00:00.000Z",
      reputationScore: 42,
      riskFlags: ["location_mocking", "clock_skew"],
    },
    "community_risky_device_actor",
  );
  const extraction = network.extractMediaMetadata(
    {
      mediaObjectId: mediaObject.id,
      consentReceiptId: consent.id,
      deviceAttestationId: riskyAttestation.id,
      extractorVersion: "exiftool-wasm-1.0.0",
      extractedAt: "2026-07-09T00:01:00.000Z",
      observedAt: timestamp,
      exifHash: "a".repeat(64),
      gpsHash: "b".repeat(64),
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 120,
        regionId: "region_ggw_sahel",
      },
      sensorMetadata: {
        clockSkewSeconds: 480,
        networkType: "offline",
      },
    },
    "community_risky_device_actor",
  );

  assert.equal(riskyAttestation.auditEvent.action, "CHALLENGE");
  assert.equal(extraction.extractionState, "needs_review");
  assert.ok(extraction.issues.includes("device_location_mocking"));
  assert.ok(extraction.issues.includes("privacy_mode_limits_public_location"));
  assert.ok(extraction.issues.includes("gps_accuracy_needs_review"));
  assert.equal(network.getStatus().evidenceReviewTaskCount, 1);
  assert.equal(network.getStatus().openEvidenceReviewTaskCount, 1);
  assert.ok(network.listEvidenceReviewTasks({ sourceType: "media_metadata_extraction" }).some((task) => task.severity === "high"));
  assert.equal(network.getStatus().riskyDeviceAttestationCount, 1);
  assert.equal(network.getStatus().metadataExtractionNeedsReviewCount, 1);
});

test("CanopyProof Evidence Network evaluates consent-bound retention without silent deletion", () => {
  const network = new CanopyProofEvidenceNetworkService(new CanopyProofService());
  const consentActor = "community_retention_actor";
  const intent = network.createMediaUploadIntent(
    {
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_retention_001",
      contentHash: "1".repeat(64),
      contentType: "image/jpeg",
      byteLength: 2048,
      capturedAt: "2026-01-01T00:00:00.000Z",
      deviceFingerprintHash: deviceHash,
    },
    consentActor,
  );
  const mediaObject = network.confirmMediaObject(
    {
      intentId: intent.id,
      contentHash: intent.contentHash,
      objectKey: intent.objectKey,
      byteLength: intent.byteLength,
      storedAt: "2026-01-01T00:00:00.000Z",
      encryption: { atRest: true, mode: "r2_managed" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: "2026-01-01T00:00:00.000Z",
        signatureVersion: "main-2026-01-01",
      },
      exifHash: "2".repeat(64),
      gpsHash: "3".repeat(64),
    },
    consentActor,
  );
  const consent = network.recordConsentReceipt(
    {
      subjectId: consentActor,
      deviceFingerprintHash: deviceHash,
      purposes: ["evidence_collection", "geolocation", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: "precise",
      policyVersion: "canopyproof-privacy-v1",
      evidenceHash: "4".repeat(64),
      grantedAt: "2026-01-01T00:00:00.000Z",
      retentionDays: 1,
    },
    consentActor,
  );
  const attestation = network.recordDeviceAttestation(
    {
      subjectId: consentActor,
      deviceFingerprintHash: deviceHash,
      consentReceiptId: consent.id,
      attestationType: "manual_field_kit",
      publicKeyHash: "5".repeat(64),
      attestationHash: "6".repeat(64),
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-02-01T00:00:00.000Z",
      reputationScore: 80,
      riskFlags: [],
    },
    consentActor,
  );
  const extraction = network.extractMediaMetadata(
    {
      mediaObjectId: mediaObject.id,
      consentReceiptId: consent.id,
      deviceAttestationId: attestation.id,
      extractorVersion: "exiftool-wasm-1.0.0",
      extractedAt: "2026-01-01T00:01:00.000Z",
      observedAt: "2026-01-01T00:00:00.000Z",
      exifHash: "2".repeat(64),
      gpsHash: "3".repeat(64),
      location: { latitude: 14.7167, longitude: -17.4677, accuracyMeters: 9 },
    },
    consentActor,
  );
  network.revokeConsentReceipt(
    consent.id,
    {
      revokedAt: "2026-01-02T00:00:00.000Z",
      reason: "Contributor withdrew consent after the minimum retention period.",
    },
    consentActor,
  );

  const evaluation = network.evaluateRetentionPolicies({ evaluatedAt: "2026-01-03T00:00:00.000Z" }, "verifier_retention_actor");

  assert.equal(evaluation.decisionCount, 3);
  assert.match(evaluation.evaluationRoot, /^[a-f0-9]{64}$/);
  assert.ok(evaluation.decisions.some((decision) => decision.sourceId === consent.id && decision.disposition === "minimize"));
  assert.ok(evaluation.decisions.some((decision) => decision.sourceId === consent.id && decision.disposition === "tombstone_after_retention"));
  assert.ok(evaluation.decisions.some((decision) => decision.sourceId === extraction.id && decision.disposition === "minimize"));
  assert.equal(network.getStatus().retentionPolicyDecisionCount, 3);
  assert.equal(network.getStatus().retentionMinimizationDecisionCount, 2);
  assert.equal(network.getStatus().safety.retentionAutomationIsAppendOnly, true);
});

test("CanopyProof Evidence Network syncs offline batches idempotently", () => {
  const proof = new CanopyProofService();
  const network = new CanopyProofEvidenceNetworkService(proof);
  const first = network.syncOfflineBatch(
    {
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      submittedAt: timestamp,
      evidence: [evidencePayload("evidence_offline_sync_001", "a".repeat(64))],
    },
    "community_offline_actor",
    "offline-key-001",
  );
  const replay = network.syncOfflineBatch(
    {
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      submittedAt: timestamp,
      evidence: [evidencePayload("evidence_offline_sync_001", "a".repeat(64))],
    },
    "community_offline_actor",
    "offline-key-001",
  );

  assert.equal(first.status, "accepted");
  assert.equal(first.acceptedCount, 1);
  assert.equal(first.replayed, false);
  assert.equal(replay.id, first.id);
  assert.equal(replay.replayed, true);
  assert.equal(proof.listEvidence().length, 1);
});

test("CanopyProof Evidence Network challenges conflicting duplicate evidence IDs instead of overwriting", () => {
  const proof = new CanopyProofService();
  const network = new CanopyProofEvidenceNetworkService(proof);
  network.syncOfflineBatch(
    {
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      submittedAt: timestamp,
      evidence: [evidencePayload("evidence_offline_conflict_001", "b".repeat(64))],
    },
    "community_conflict_actor",
    "offline-conflict-a",
  );
  const conflict = network.syncOfflineBatch(
    {
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      submittedAt: "2026-07-09T00:05:00.000Z",
      evidence: [evidencePayload("evidence_offline_conflict_001", "c".repeat(64))],
    },
    "community_conflict_actor",
    "offline-conflict-b",
  );
  const retained = proof.getEvidence("evidence_offline_conflict_001");

  assert.equal(conflict.status, "conflict_review");
  assert.equal(conflict.conflictCount, 1);
  assert.equal(conflict.itemResults[0]?.status, "conflict");
  assert.deepEqual(conflict.itemResults[0]?.issues, ["duplicate_evidence_id_conflict"]);
  assert.equal(retained.media_hash, "b".repeat(64));
  assert.equal(retained.verification_status, "challenged");
});

test("CanopyProof Evidence Network community challenges are non-final audit events", () => {
  const proof = new CanopyProofService();
  const network = new CanopyProofEvidenceNetworkService(proof);
  proof.submitEvidence({
    ...evidencePayload("evidence_community_attest_001", "e".repeat(64)),
    contributor: "community_attested_contributor",
  });

  const attestation = network.recordCommunityAttestation(
    "evidence_community_attest_001",
    {
      stance: "challenge",
      note: "Local reviewer saw the same photo used for a different plot and requests accredited review.",
      observedAt: "2026-07-09T00:10:00.000Z",
      confidence_score: 62,
    },
    "community_attester_actor",
  );

  assert.equal(attestation.auditEvent.action, "CHALLENGE");
  assert.equal(attestation.auditEvent.entityType, "community_attestation");
  assert.equal(attestation.evidence.verification_status, "challenged");
  assert.ok(attestation.evidence.reviewers.includes("community_attester_actor"));
  assert.equal(network.getStatus().communityAttestationCount, 1);
  assert.match(network.getStatus().networkRoot, /^[a-f0-9]{64}$/);
});

test("CanopyProof Evidence Network API enforces RBAC, idempotency, and community attestation boundaries", async (t) => {
  const previousLegacyGate = process.env.CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED;
  delete process.env.CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED;
  t.after(() => {
    if (previousLegacyGate === undefined) delete process.env.CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED;
    else process.env.CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED = previousLegacyGate;
  });
  const disabledIntent = await app.request("/canopyproof/evidence/media/presign", {
    method: "POST",
    headers: actorHeaders("community", "community_media_disabled"),
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      contentHash: "f".repeat(64),
      contentType: "image/jpeg",
      byteLength: 4096,
      capturedAt: timestamp,
    }),
  });
  assert.equal(disabledIntent.status, 503);
  assert.deepEqual(await disabledIntent.json(), {
    ok: false,
    error: "CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_DISABLED",
  });
  process.env.CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED = "true";

  const deniedIntent = await app.request("/canopyproof/evidence/media/presign", {
    method: "POST",
    headers: actorHeaders("observer", "observer_media_denied"),
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      contentHash: "f".repeat(64),
      contentType: "image/jpeg",
      byteLength: 4096,
      capturedAt: timestamp,
    }),
  });
  assert.equal(deniedIntent.status, 403);

  const intent = await app.request("/canopyproof/evidence/media/presign", {
    method: "POST",
    headers: actorHeaders("community", "community_media_api"),
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      evidenceId: "evidence_api_offline_001",
      contentHash: "f".repeat(64),
      contentType: "image/jpeg",
      byteLength: 4096,
      capturedAt: timestamp,
    }),
  });
  const intentBody = (await intent.json()) as { ok: true; data: { uploadUrl: string; auditEvent: { entityType: string } } };
  assert.equal(intent.status, 201);
  assert.match(intentBody.data.uploadUrl, /^r2:\/\/canopyproof-evidence\//);
  assert.equal(intentBody.data.auditEvent.entityType, "media_upload_intent");

  const intentData = (await app
    .request("/canopyproof/evidence/media/presign", {
      method: "POST",
      headers: actorHeaders("community", "community_media_object_api"),
      body: JSON.stringify({
        projectId: "project_v1_ggw_demo",
        evidenceId: "evidence_api_media_object_001",
        contentHash: "9".repeat(64),
        contentType: "image/jpeg",
        byteLength: 8192,
        capturedAt: timestamp,
      }),
    })
    .then((response) => response.json())) as {
    ok: true;
    data: { id: string; contentHash: string; objectKey: string; byteLength: number };
  };
  const mediaObject = await app.request("/canopyproof/evidence/media/objects", {
    method: "POST",
    headers: actorHeaders("community", "community_media_object_api"),
    body: JSON.stringify({
      intentId: intentData.data.id,
      contentHash: intentData.data.contentHash,
      objectKey: intentData.data.objectKey,
      byteLength: intentData.data.byteLength,
      storedAt: timestamp,
      storageProvider: "cloudflare_r2",
      encryption: { atRest: true, mode: "r2_managed", keyRef: "cloudflare-r2-managed-key" },
      malwareScan: {
        status: "clean",
        scanner: "clamav-edge",
        scannedAt: timestamp,
        signatureVersion: "main-2026-07-09",
      },
      exifHash: "a".repeat(64),
      gpsHash: "b".repeat(64),
    }),
  });
  const mediaObjectBody = (await mediaObject.json()) as {
    ok: true;
    data: { id: string; mediaState: string; integrityRoot: string; auditEvent: { entityType: string } };
  };
  assert.equal(mediaObject.status, 201);
  assert.equal(mediaObjectBody.data.mediaState, "available");
  assert.match(mediaObjectBody.data.integrityRoot, /^[a-f0-9]{64}$/);
  assert.equal(mediaObjectBody.data.auditEvent.entityType, "media_object");

  const custodyDenied = await app.request("/canopyproof/evidence/evidence_api_media_object_001/custody-events", {
    method: "POST",
    headers: actorHeaders("observer", "observer_custody_denied"),
    body: JSON.stringify({
      action: "stored",
      artifactType: "media_object",
      artifactId: mediaObjectBody.data.id,
      custodyNote: "Observer cannot append evidence custody records.",
      occurredAt: "2026-07-09T00:00:30.000Z",
    }),
  });
  assert.equal(custodyDenied.status, 403);

  const custody = await app.request("/canopyproof/evidence/evidence_api_media_object_001/custody-events", {
    method: "POST",
    headers: actorHeaders("verifier", "verifier_custody_api"),
    body: JSON.stringify({
      action: "stored",
      artifactType: "media_object",
      artifactId: mediaObjectBody.data.id,
      custodianOrganizationId: "org_verifier_custody_api",
      custodyNote: "Verifier recorded encrypted object custody after media object confirmation.",
      occurredAt: "2026-07-09T00:00:30.000Z",
      policyId: "canopyproof-evidence-custody-v1",
    }),
  });
  const custodyBody = (await custody.json()) as {
    ok: true;
    data: {
      id: string;
      sourceRoot: string;
      custodyRoot: string;
      auditEvent: { entityType: string };
      safety: { appendOnly: boolean; sourceRootBound: boolean; notFinalProofAuthority: boolean };
    };
  };
  assert.equal(custody.status, 201);
  assert.equal(custodyBody.data.sourceRoot, mediaObjectBody.data.integrityRoot);
  assert.equal(custodyBody.data.auditEvent.entityType, "evidence_custody_event");
  assert.equal(custodyBody.data.safety.appendOnly, true);
  assert.equal(custodyBody.data.safety.sourceRootBound, true);
  assert.equal(custodyBody.data.safety.notFinalProofAuthority, true);

  const custodyList = await app.request("/canopyproof/evidence/evidence_api_media_object_001/custody-events", {
    headers: actorHeaders("observer", "observer_custody_reader"),
  });
  const custodyListBody = (await custodyList.json()) as { ok: true; data: Array<{ id: string; custodyRoot: string }> };
  assert.equal(custodyList.status, 200);
  assert.ok(custodyListBody.data.some((item) => item.id === custodyBody.data.id && item.custodyRoot === custodyBody.data.custodyRoot));

  const custodyRead = await app.request(`/canopyproof/evidence/custody-events/${custodyBody.data.id}`, {
    headers: actorHeaders("observer", "observer_custody_reader"),
  });
  assert.equal(custodyRead.status, 200);

  const consent = await app.request("/canopyproof/evidence/consent-receipts", {
    method: "POST",
    headers: actorHeaders("community", "community_metadata_api"),
    body: JSON.stringify({
      subjectId: "community_metadata_api",
      deviceFingerprintHash: deviceHash,
      purposes: ["evidence_collection", "geolocation", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: "precise",
      policyVersion: "canopyproof-privacy-v1",
      evidenceHash: "c".repeat(64),
      grantedAt: timestamp,
      retentionDays: 365,
    }),
  });
  const consentBody = (await consent.json()) as { ok: true; data: { id: string; receiptRoot: string } };
  assert.equal(consent.status, 201);
  assert.match(consentBody.data.receiptRoot, /^[a-f0-9]{64}$/);

  const deviceAttestation = await app.request("/canopyproof/evidence/devices/attestations", {
    method: "POST",
    headers: actorHeaders("community", "community_metadata_api"),
    body: JSON.stringify({
      subjectId: "community_metadata_api",
      deviceFingerprintHash: deviceHash,
      consentReceiptId: consentBody.data.id,
      attestationType: "webauthn",
      publicKeyHash: "d".repeat(64),
      attestationHash: "e".repeat(64),
      issuedAt: timestamp,
      expiresAt: "2026-08-09T00:00:00.000Z",
      reputationScore: 91,
      riskFlags: [],
    }),
  });
  const deviceAttestationBody = (await deviceAttestation.json()) as {
    ok: true;
    data: { id: string; attestationRoot: string; auditEvent: { entityType: string } };
  };
  assert.equal(deviceAttestation.status, 201);
  assert.equal(deviceAttestationBody.data.auditEvent.entityType, "device_attestation");
  assert.match(deviceAttestationBody.data.attestationRoot, /^[a-f0-9]{64}$/);

  const metadataExtraction = await app.request("/canopyproof/evidence/media/metadata-extractions", {
    method: "POST",
    headers: actorHeaders("community", "community_metadata_api"),
    body: JSON.stringify({
      mediaObjectId: mediaObjectBody.data.id,
      consentReceiptId: consentBody.data.id,
      deviceAttestationId: deviceAttestationBody.data.id,
      extractorVersion: "exiftool-wasm-1.0.0",
      extractedAt: "2026-07-09T00:01:00.000Z",
      observedAt: timestamp,
      exifHash: "a".repeat(64),
      gpsHash: "b".repeat(64),
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 9,
        regionId: "region_ggw_sahel",
      },
      sensorMetadata: {
        horizontalAccuracyMeters: 9,
        clockSkewSeconds: 1,
        networkType: "wifi",
      },
    }),
  });
  const metadataExtractionBody = (await metadataExtraction.json()) as {
    ok: true;
    data: { extractionState: string; metadataRoot: string; auditEvent: { entityType: string } };
  };
  assert.equal(metadataExtraction.status, 201);
  assert.equal(metadataExtractionBody.data.extractionState, "accepted");
  assert.equal(metadataExtractionBody.data.auditEvent.entityType, "media_metadata_extraction");
  assert.match(metadataExtractionBody.data.metadataRoot, /^[a-f0-9]{64}$/);

  const listMetadataExtractions = await app.request(
    "/canopyproof/evidence/media/metadata-extractions?evidenceId=evidence_api_media_object_001",
    {
      headers: actorHeaders("observer", "observer_metadata_reader"),
    },
  );
  const listMetadataExtractionsBody = (await listMetadataExtractions.json()) as {
    ok: true;
    data: Array<{ metadataRoot: string }>;
  };
  assert.equal(listMetadataExtractions.status, 200);
  assert.ok(listMetadataExtractionsBody.data.some((item) => item.metadataRoot === metadataExtractionBody.data.metadataRoot));

  const revokeConsent = await app.request(`/canopyproof/evidence/consent-receipts/${consentBody.data.id}/revoke`, {
    method: "POST",
    headers: actorHeaders("community", "community_metadata_api"),
    body: JSON.stringify({
      revokedAt: "2026-07-09T00:02:00.000Z",
      reason: "Contributor withdrew device-bound geolocation metadata consent.",
    }),
  });
  assert.equal(revokeConsent.status, 202);

  const readMediaObject = await app.request(`/canopyproof/evidence/media/objects/${mediaObjectBody.data.id}`, {
    headers: actorHeaders("observer", "observer_media_object_reader"),
  });
  assert.equal(readMediaObject.status, 200);

  const reviewTask = await app.request("/canopyproof/evidence/review-tasks", {
    method: "POST",
    headers: actorHeaders("verifier", "verifier_review_task_api"),
    body: JSON.stringify({
      sourceType: "media_object",
      sourceId: mediaObjectBody.data.id,
      evidenceId: "evidence_api_media_object_001",
      reasonCodes: ["manual_chain_of_custody_review"],
      severity: "medium",
      openedAt: "2026-07-09T00:02:00.000Z",
      policyId: "canopyproof-evidence-media-review-v1",
    }),
  });
  const reviewTaskBody = (await reviewTask.json()) as { ok: true; data: { id: string; status: string; taskRoot: string } };
  assert.equal(reviewTask.status, 201);
  assert.equal(reviewTaskBody.data.status, "open");
  assert.match(reviewTaskBody.data.taskRoot, /^[a-f0-9]{64}$/);

  const resolvedReviewTask = await app.request(`/canopyproof/evidence/review-tasks/${reviewTaskBody.data.id}/resolve`, {
    method: "POST",
    headers: actorHeaders("verifier", "verifier_review_task_api"),
    body: JSON.stringify({
      decision: "retain_non_final",
      rationale: "Manual chain-of-custody review recorded; artifact remains non-final until proof reviewer accepts it.",
      resolvedAt: "2026-07-09T00:03:00.000Z",
    }),
  });
  const resolvedReviewTaskBody = (await resolvedReviewTask.json()) as {
    ok: true;
    data: { status: string; decision: string; resolvedBy: string };
  };
  assert.equal(resolvedReviewTask.status, 200);
  assert.equal(resolvedReviewTaskBody.data.status, "resolved");
  assert.equal(resolvedReviewTaskBody.data.decision, "retain_non_final");
  assert.equal(resolvedReviewTaskBody.data.resolvedBy, "verifier_review_task_api");

  const retentionEvaluation = await app.request("/canopyproof/evidence/retention/evaluations", {
    method: "POST",
    headers: actorHeaders("verifier", "verifier_retention_api"),
    body: JSON.stringify({
      evaluatedAt: "2027-07-09T00:00:00.000Z",
    }),
  });
  const retentionEvaluationBody = (await retentionEvaluation.json()) as {
    ok: true;
    data: { evaluationRoot: string; decisions: Array<{ sourceId: string; disposition: string }> };
  };
  assert.equal(retentionEvaluation.status, 202);
  assert.match(retentionEvaluationBody.data.evaluationRoot, /^[a-f0-9]{64}$/);
  assert.ok(retentionEvaluationBody.data.decisions.some((decision) => decision.sourceId === consentBody.data.id));

  const retentionDecisions = await app.request("/canopyproof/evidence/retention/decisions?sourceType=consent_receipt", {
    headers: actorHeaders("observer", "observer_retention_reader"),
  });
  const retentionDecisionsBody = (await retentionDecisions.json()) as {
    ok: true;
    data: Array<{ sourceId: string; disposition: string }>;
  };
  assert.equal(retentionDecisions.status, 200);
  assert.ok(retentionDecisionsBody.data.some((decision) => decision.sourceId === consentBody.data.id));

  const missingIdempotency = await app.request("/canopyproof/evidence/sync-batches", {
    method: "POST",
    headers: actorHeaders("community", "community_sync_missing_key"),
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      evidence: [evidencePayload("evidence_api_missing_key", "1".repeat(64))],
    }),
  });
  assert.equal(missingIdempotency.status, 400);

  const sync = await app.request("/canopyproof/evidence/sync-batches", {
    method: "POST",
    headers: {
      ...actorHeaders("community", "community_sync_api"),
      "idempotency-key": "api-offline-key-001",
    },
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      submittedAt: timestamp,
      evidence: [evidencePayload("evidence_api_offline_001", "f".repeat(64))],
    }),
  });
  const syncBody = (await sync.json()) as { ok: true; data: { id: string; status: string; replayed: boolean; evidenceIds: string[] } };
  assert.equal(sync.status, 201);
  assert.equal(syncBody.data.status, "accepted");
  assert.equal(syncBody.data.replayed, false);
  assert.deepEqual(syncBody.data.evidenceIds, ["evidence_api_offline_001"]);

  const replay = await app.request("/canopyproof/evidence/sync-batches", {
    method: "POST",
    headers: {
      ...actorHeaders("community", "community_sync_api"),
      "idempotency-key": "api-offline-key-001",
    },
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      deviceFingerprintHash: deviceHash,
      submittedAt: timestamp,
      evidence: [evidencePayload("evidence_api_offline_001", "f".repeat(64))],
    }),
  });
  const replayBody = (await replay.json()) as { ok: true; data: { id: string; replayed: boolean } };
  assert.equal(replay.status, 200);
  assert.equal(replayBody.data.id, syncBody.data.id);
  assert.equal(replayBody.data.replayed, true);

  const readBatch = await app.request(`/canopyproof/evidence/sync-batches/${syncBody.data.id}`, {
    headers: actorHeaders("observer", "observer_sync_reader"),
  });
  assert.equal(readBatch.status, 200);

  const attestation = await app.request("/canopyproof/evidence/evidence_api_offline_001/community-attestations", {
    method: "POST",
    headers: actorHeaders("community", "community_attestation_api"),
    body: JSON.stringify({
      stance: "challenge",
      note: "Community reviewer found the plot boundary inconsistent with the submitted field photo.",
      observedAt: "2026-07-09T00:15:00.000Z",
      confidence_score: 61,
    }),
  });
  const attestationBody = (await attestation.json()) as { ok: true; data: { stance: string; evidence: { verification_status: string } } };
  assert.equal(attestation.status, 202);
  assert.equal(attestationBody.data.stance, "challenge");
  assert.equal(attestationBody.data.evidence.verification_status, "challenged");

  const listAttestations = await app.request("/canopyproof/evidence/evidence_api_offline_001/community-attestations", {
    headers: actorHeaders("observer", "observer_attestation_reader"),
  });
  const listBody = (await listAttestations.json()) as { ok: true; data: Array<{ stance: string }> };
  assert.equal(listAttestations.status, 200);
  assert.ok(listBody.data.some((item) => item.stance === "challenge"));

  const networkStatus = await app.request("/canopyproof/evidence-network/status");
  const networkStatusBody = (await networkStatus.json()) as {
    ok: true;
    data: { custodyEventCount: number; safety: { custodyChainIsAppendOnly: boolean } };
  };
  assert.equal(networkStatus.status, 200);
  assert.ok(networkStatusBody.data.custodyEventCount >= 1);
  assert.equal(networkStatusBody.data.safety.custodyChainIsAppendOnly, true);
});

test("CanopyProof Evidence Network SQL declares custody events as append-only source-rooted records", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS evidence\.custody_events/);
  assert.match(
    sql,
    /action text NOT NULL CHECK \(action IN \('captured', 'uploaded', 'stored', 'metadata_extracted', 'review_opened', 'review_resolved', 'retention_decided', 'offline_synced', 'community_attested'\)\)/,
  );
  assert.match(
    sql,
    /artifact_type text NOT NULL CHECK \(artifact_type IN \('evidence', 'media_upload_intent', 'media_object', 'media_metadata_extraction', 'review_task', 'retention_policy_decision', 'offline_sync_batch', 'community_attestation'\)\)/,
  );
  assert.match(sql, /previous_custody_root text NOT NULL/);
  assert.match(sql, /CHECK \(\(safety->>'sourceRootBound'\)::boolean IS TRUE\)/);
  assert.match(sql, /CHECK \(\(safety->>'previousRootLinked'\)::boolean IS TRUE\)/);
  assert.match(sql, /CHECK \(\(safety->>'notFinalProofAuthority'\)::boolean IS TRUE\)/);
  assert.match(sql, /DROP TRIGGER IF EXISTS evidence_custody_events_no_update ON evidence\.custody_events/);
  assert.match(sql, /DROP TRIGGER IF EXISTS evidence_custody_events_no_delete ON evidence\.custody_events/);
  assert.match(sql, /CREATE TRIGGER evidence_custody_events_audit AFTER INSERT OR UPDATE OR DELETE ON evidence\.custody_events/);
});
