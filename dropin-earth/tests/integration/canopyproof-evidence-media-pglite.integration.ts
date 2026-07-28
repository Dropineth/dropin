import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";
import {
  canopyProofEvidenceMetadataAdapterSafetyBoundary,
  projectCanopyProofEvidenceMetadataExtraction,
  type CanopyProofEvidenceMetadataExtractionVerificationFact,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-adapter-authority.js";
import {
  CanopyProofEvidenceMetadataRetentionAuthorityService,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-retention-authority.js";
import {
  PrismaCanopyProofEvidenceMetadataRetentionRepository,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-retention-postgres.js";
import {
  PrismaCanopyProofMetadataExtractionOrchestrationRepository,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-orchestration-postgres.js";
import {
  CanopyProofMetadataExtractionOrchestrator,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-orchestrator.js";
import {
  canopyProofMetadataExtractionReceiptSeed,
  PolicyEnforcedCanopyProofMetadataExtractorAdapter,
} from "../../services/api/src/domain/canopyproof/metadata-extractor-adapter.js";
import {
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceCustodyActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  canopyProofDeviceAttestationReceiptSeed,
  PolicyEnforcedCanopyProofDeviceAttestationAdapter,
  WebCryptoEd25519DeviceAttestationSignatureVerifier,
  type CanopyProofDeviceAttestationProviderReceipt,
  type CanopyProofDeviceAttestationProviderRequest,
} from "../../services/api/src/domain/canopyproof/device-attestation-adapter.js";
import { PrismaCanopyProofDeviceAttestationAdapterRepository } from
  "../../services/api/src/domain/canopyproof/evidence-device-attestation-adapter-postgres.js";
import { CanopyProofDeviceAttestationAdapterOrchestrator } from
  "../../services/api/src/domain/canopyproof/evidence-device-attestation-adapter-orchestrator.js";
import {
  CanopyProofCommunityAttestationAuthorityService,
  CanopyProofEvidenceOfflineSyncAuthorityService,
  offlineBatchGenesis,
} from "../../services/api/src/domain/canopyproof/evidence-offline-community-authority.js";
import {
  PrismaCanopyProofEvidenceOfflineCommunityRepository,
} from "../../services/api/src/domain/canopyproof/evidence-offline-community-postgres.js";
import {
  CanopyProofMobileEvidenceSyncAuthorityService,
  mobileEvidenceClientBatchId,
  mobileEvidenceSyncPayloadHash,
} from "../../services/api/src/domain/canopyproof/mobile-evidence-sync-authority.js";
import type {
  CanopyProofVerificationActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentCapability,
  type CanopyProofEvidenceMediaAgentSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-media-authority.js";
import {
  DisabledCanopyProofObjectStorageAdapter,
  PolicyEnforcedCanopyProofObjectStorageAdapter,
} from "../../services/api/src/domain/canopyproof/object-storage-adapter.js";
import {
  DisabledCanopyProofMalwareScannerAdapter,
  PolicyEnforcedCanopyProofMalwareScannerAdapter,
} from "../../services/api/src/domain/canopyproof/malware-scanner-adapter.js";
import {
  CanopyProofEvidenceMediaAdapterOrchestrator,
} from "../../services/api/src/domain/canopyproof/evidence-media-adapter-orchestrator.js";

test("CanopyProof evidence media custody is append-only, tenant-bound, and restart-safe", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const e1aContract = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-device-attestation-adapters.sql"),
    "utf8",
  );
  const e3bContract = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-metadata-retention.sql"),
    "utf8",
  );
  const e3bRollback = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-metadata-retention.rollback.sql"),
    "utf8",
  );
  const e3cContract = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-metadata-adapters.sql"),
    "utf8",
  );
  const e3cRollback = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-metadata-adapters.rollback.sql"),
    "utf8",
  );
  const e3dContract = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-metadata-orchestration.sql"),
    "utf8",
  );
  const e3dRollback = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-metadata-orchestration.rollback.sql"),
    "utf8",
  );
  const e2aContract = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-media-adapters.sql"),
    "utf8",
  );
  const e2aRollback = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-media-adapters.rollback.sql"),
    "utf8",
  );
  const e4Contract = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-offline-community.sql"),
    "utf8",
  );
  const e4Rollback = await readFile(
    join(process.cwd(), "services/api/prisma/evidence-offline-community.rollback.sql"),
    "utf8",
  );
  const ownerId = "cp_media_pglite_owner";
  const subjectId = "cp_media_pglite_subject";
  const agentId = "cp_media_pglite_agent";
  const reviewerId = "cp_media_pglite_reviewer";
  const organizationId = "cp_media_pglite_org";
  const projectId = "cp_media_pglite_project";
  const evidenceId = "cp_media_pglite_evidence";
  const contentHash = "a".repeat(64);

  try {
    await db.exec(contract);
    await db.exec(contract);
    await db.exec(e1aContract);
    await db.exec(e1aContract);
    await db.exec(e2aContract);
    await db.exec(e2aContract);
    await db.exec(e3bContract);
    await db.exec(e3bContract);
    await db.exec(e3cContract);
    await db.exec(e3cContract);
    await db.exec(e3dContract);
    await db.exec(e3dContract);
    await db.exec(e4Contract);
    await db.exec(e4Contract);
    await insertBootstrapOwner(db, ownerId);
    const service = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));

    const status = service.getStatus();
    assert.equal(status.evidenceMediaUploadIntentWritesDurable, true);
    assert.equal(status.evidenceMediaObjectWritesDurable, true);
    assert.equal(status.evidenceMediaDuplicateRelationWritesDurable, true);
    assert.equal(status.evidenceMediaScanResultWritesDurable, true);
    assert.equal(status.evidenceMediaProviderReceiptVerificationWritesDurable, true);
    assert.equal(status.evidenceMediaScannerReceiptVerificationWritesDurable, true);
    assert.equal(status.evidenceMediaAdapterRoutesMounted, false);
    assert.equal(status.evidenceMediaReviewTaskWritesDurable, true);
    assert.equal(status.evidenceMediaReviewAssignmentWritesDurable, true);
    assert.equal(status.evidenceMediaReviewDecisionWritesDurable, true);
    assert.equal(status.evidenceMediaCustodyEventWritesDurable, true);

    const organization = await service.registerOrganization(
      {
        id: organizationId,
        name: "PGlite Evidence Media Cooperative",
        organizationType: "community_organization",
        jurisdiction: "GLOBAL",
        publicContact: "media-custody@example.org",
        operatingRegions: ["global"],
        verificationCapabilities: ["field evidence collection"],
        documents: [],
        authorizedUsers: [ownerId],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-13T00:01:00.000Z",
      },
      ownerId,
      "media-org-create",
    );
    await service.updateOrganizationVerification(
      organization.id,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "MEDIA-CUSTODY-001",
        documents: [
          {
            documentType: "registration",
            documentHash: "1".repeat(64),
            issuedBy: "Evidence Media Test Registry",
            uploadedAt: "2026-07-13T00:02:00.000Z",
          },
        ],
        authorizedUsers: [ownerId, subjectId, agentId, reviewerId],
        rationale: "Verified solely for deterministic media custody integration testing.",
        reviewedAt: "2026-07-13T00:02:00.000Z",
      },
      ownerId,
      "media-org-verify",
    );
    await service.registerParticipant(
      {
        id: subjectId,
        participantType: "human",
        displayName: "PGlite Evidence Media Contributor",
        organizationId,
        roles: ["community"],
        verificationStatus: "verified",
        credentialCommitments: ["2".repeat(64)],
        createdAt: "2026-07-13T00:03:00.000Z",
      },
      ownerId,
      "media-subject-create",
    );
    await service.registerParticipant(
      {
        id: agentId,
        participantType: "agent",
        displayName: "PGlite Evidence Media Custody Agent",
        organizationId,
        roles: ["agent"],
        verificationStatus: "verified",
        credentialCommitments: ["3".repeat(64)],
        createdAt: "2026-07-13T00:04:00.000Z",
      },
      ownerId,
      "media-agent-create",
    );
    await service.registerParticipant(
      {
        id: reviewerId,
        participantType: "human",
        displayName: "PGlite Independent Evidence Media Reviewer",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["a".repeat(64)],
        createdAt: "2026-07-13T00:04:30.000Z",
      },
      ownerId,
      "media-reviewer-create",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: ownerId,
        role: "owner",
        conflictDisclosure: "The project owner is separate from media custody automation authority.",
        grantedAt: "2026-07-13T00:05:00.000Z",
      },
      ownerId,
      "media-owner-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: subjectId,
        role: "community",
        conflictDisclosure: "The contributor acts only for their own consent-bound field evidence.",
        grantedAt: "2026-07-13T00:06:00.000Z",
      },
      ownerId,
      "media-subject-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: reviewerId,
        role: "verifier",
        conflictDisclosure: "The reviewer is independent from the contributor, task opener, and assignment authority.",
        grantedAt: "2026-07-13T00:06:30.000Z",
      },
      ownerId,
      "media-reviewer-membership",
    );
    await service.recordAccreditation(
      organizationId,
      {
        status: "approved",
        scope: ["evidence_media_review", "evidence_retention_governance"],
        rationale: "Institutional scope covers independent media review and governed retention decisions.",
        evidenceHash: "0".repeat(64),
        decidedAt: "2026-07-13T00:06:45.000Z",
      },
      ownerId,
      "media-review-accreditation",
    );
    await insertMediaAgentProfile(db, ownerId, agentId);
    await insertProjectPolicy(db, ownerId);

    const project = await service.registerProject(
      {
        id: projectId,
        organizationId,
        title: "Consent-bound restoration media custody project",
        projectType: "ecosystem_restoration",
        regionId: "region_media_custody",
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          areaHectares: 42,
          boundaryHash: "4".repeat(64),
        },
        targetTreeCount: 12_000,
        biodiversityIndicators: ["native canopy continuity"],
        waterIndicators: ["soil moisture retention"],
        climateRiskIndicators: ["typhoon exposure"],
        monitoringCadenceDays: 30,
        governancePolicyId: "cp_media_pglite_project_policy",
        createdAt: "2026-07-13T00:08:00.000Z",
      },
      ownerId,
      "owner",
      "media-project-create",
    );
    assert.equal(project.status, "submitted");

    const evidence = await service.registerEvidence(
      {
        id: evidenceId,
        projectId,
        evidenceType: "restoration",
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          accuracyMeters: 5,
          regionId: "region_media_custody",
        },
        timestamp: "2026-07-13T00:09:00.000Z",
        createdAt: "2026-07-13T00:09:00.000Z",
        media_hash: contentHash,
        gps_hash: "5".repeat(64),
        confidence_score: 90,
      },
      subjectId,
      "community",
      "media-evidence-create",
    );
    assert.equal(evidence.valid, true);

    const fingerprintHash = "6".repeat(64);
    const consent = await service.recordEvidenceConsentReceipt(
      {
        subjectId,
        deviceFingerprintHash: fingerprintHash,
        purposes: ["media_upload", "evidence_collection", "geolocation"],
        lawfulBasis: "consent",
        privacyMode: "restricted",
        policyVersion: "evidence-media-consent-v1",
        evidenceHash: "7".repeat(64),
        grantedAt: "2026-07-13T00:10:00.000Z",
        expiresAt: "2027-07-13T00:10:00.000Z",
        retentionDays: 365,
      },
      organizationId,
      subjectId,
      "community",
      "media-consent-create",
    );
    const device = await service.recordEvidenceDeviceAttestation(
      {
        subjectId,
        consentReceiptId: consent.id,
        deviceFingerprintHash: fingerprintHash,
        attestationType: "secure_enclave",
        provider: "apple_app_attest",
        providerKeyId: "media-pglite-device-key-v1",
        providerReceiptHash: "8".repeat(64),
        providerVerificationState: "modeled_only",
        publicKeyHash: "9".repeat(64),
        attestationHash: "b".repeat(64),
        issuedAt: "2026-07-13T00:11:00.000Z",
        expiresAt: "2027-01-13T00:11:00.000Z",
        reputationScore: 80,
        riskFlags: [],
      },
      organizationId,
      subjectId,
      "community",
      "media-device-create",
    );
    const e1aSignerKeyId = "cp-media-pglite-e1a-signer-v1";
    const e1aKeyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const e1aPublicKey = await crypto.subtle.exportKey("jwk", e1aKeyPair.publicKey);
    const e1aPolicy = {
      provider: "apple_app_attest" as const,
      attestationType: "secure_enclave" as const,
      verifierId: "cp-media-pglite-e1a-verifier",
      verifierVersion: "1.0.0",
      providerPolicyRoot: hashJson({ kind: "cp-media-pglite-e1a-policy" }),
      allowedSignerKeyIds: [e1aSignerKeyId],
      maximumVerificationLifetimeSeconds: 30 * 86_400,
    };
    const e1aAdapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
      e1aPolicy,
      {
        verifyAttestation: (request) => signDeviceAttestationReceipt(
          request,
          e1aPolicy,
          e1aSignerKeyId,
          e1aKeyPair.privateKey,
          "2026-08-12T00:11:30.000Z",
        ),
      },
      new WebCryptoEd25519DeviceAttestationSignatureVerifier({
        [e1aSignerKeyId]: e1aPublicKey,
      }),
    );
    const e1aVerification = await new CanopyProofDeviceAttestationAdapterOrchestrator(
      new PrismaCanopyProofDeviceAttestationAdapterRepository(pglitePrismaClient(db)),
      e1aAdapter,
    ).verifyAttestation({
      organizationId,
      attestationId: device.id,
      verifierAgentId: agentId,
      idempotencyKey: "media-device-verification-0001",
      requestedAt: "2026-07-13T00:11:30.000Z",
    });
    assert.equal(device.providerVerificationState, "modeled_only");
    assert.equal(e1aVerification.projection.state, "current");

    const intentInput = {
      evidenceId,
      consentReceiptId: consent.id,
      deviceAttestationId: device.id,
      contentHash,
      contentType: "image/jpeg",
      byteLength: 1_048_576,
      capturedAt: "2026-07-13T00:12:00.000Z",
    } as const;
    const intent = await service.createEvidenceMediaUploadIntent(
      intentInput,
      organizationId,
      subjectId,
      "community",
      "media-intent-create",
    );
    assert.equal(intent.projectStatus, "submitted");
    assert.equal(JSON.stringify(intent).includes("uploadUrl"), false);
    assert.deepEqual(
      await service.createEvidenceMediaUploadIntent(
        intentInput,
        organizationId,
        subjectId,
        "community",
        "media-intent-create",
      ),
      intent,
    );
    await assert.rejects(
      service.createEvidenceMediaUploadIntent(
        { ...intentInput, byteLength: intentInput.byteLength + 1 },
        organizationId,
        subjectId,
        "community",
        "media-intent-create",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
    );

    const providerVerifiedAt = "2026-07-13T00:13:30.000Z";
    const retentionPolicyRoot = hashJson({
      kind: "canopyproof-e2a-retention-policy-v1",
      providerNamespace: "canopyproof-evidence-pglite",
    });
    const providerReceiptSeed = {
      intentId: intent.id,
      intentRoot: intent.intentRoot,
      provider: "cloudflare_r2" as const,
      providerNamespace: "canopyproof-evidence-pglite",
      objectKey: intent.objectKey,
      objectVersion: "version-0001",
      contentHash,
      contentType: intent.contentType,
      byteLength: intent.byteLength,
      etagHash: "c".repeat(64),
      uploadedAt: "2026-07-13T00:13:00.000Z",
      encryptionMode: "r2_managed" as const,
      objectLockMode: "governance" as const,
      retainUntil: "2027-07-13T00:13:00.000Z",
      retentionPolicyRoot,
      retentionVerificationState: "verified" as const,
      verifiedAt: providerVerifiedAt,
    };
    const providerReceiptHash = hashJson({
      kind: "canopyproof-stored-object-provider-receipt-v1",
      ...providerReceiptSeed,
    });
    const objectInput = {
      intentId: intent.id,
      storageProvider: providerReceiptSeed.provider,
      providerNamespace: providerReceiptSeed.providerNamespace,
      objectVersion: providerReceiptSeed.objectVersion,
      contentHash,
      byteLength: intent.byteLength,
      etagHash: providerReceiptSeed.etagHash,
      providerReceiptHash,
      providerVerificationState: "modeled_only",
      encryptionMode: providerReceiptSeed.encryptionMode,
      objectLockMode: providerReceiptSeed.objectLockMode,
      retainUntil: providerReceiptSeed.retainUntil,
      storedAt: providerReceiptSeed.uploadedAt,
    } as const;
    await assert.rejects(
      service.confirmEvidenceMediaObject(
        { ...objectInput, providerVerificationState: "verified" },
        organizationId,
        agentId,
        "media-object-self-verified",
      ),
      /approved object-storage adapter verifies the receipt/,
    );
    await assert.rejects(
      service.confirmEvidenceMediaObject(objectInput, organizationId, subjectId, "media-object-human-agent"),
      /agent authority not found/,
    );
    let providerHeadCalls = 0;
    const objectAdapter = new PolicyEnforcedCanopyProofObjectStorageAdapter(
      {
        provider: "cloudflare_r2",
        providerNamespace: providerReceiptSeed.providerNamespace,
        allowedUploadHosts: ["test-account.r2.cloudflarestorage.com"],
      },
      {
        async createUploadGrant() {
          throw new Error("PGlite adapter integration does not request an upload grant.");
        },
        async headStoredObject(request) {
          providerHeadCalls += 1;
          assert.equal(request.intentId, intent.id);
          assert.equal(request.intentRoot, intent.intentRoot);
          return { ...providerReceiptSeed, providerReceiptHash };
        },
      },
    );
    const providerOrchestrator = new CanopyProofEvidenceMediaAdapterOrchestrator(
      service,
      objectAdapter,
      new DisabledCanopyProofMalwareScannerAdapter(),
    );
    const objectBundle = await providerOrchestrator.verifyStoredObject({
      organizationId,
      agentId,
      intentId: intent.id,
      idempotencyKey: "media-provider-adapter-commit",
      correlationId: "cp_media_pglite_provider_head_001",
      now: providerVerifiedAt,
    });
    assert.equal(objectBundle.duplicateRelation, undefined);
    assert.equal(objectBundle.verification.providerReceiptHash, providerReceiptHash);
    assert.equal(objectBundle.verification.retentionVerificationState, "verified");
    assert.equal(providerHeadCalls, 1);
    assert.equal(
      (await service.getEvidenceMediaObjectProjection(
        objectBundle.object.id,
        organizationId,
        "2026-07-13T00:13:30.000Z",
      )).state,
      "pending_scan",
    );
    assert.deepEqual(
      await providerOrchestrator.verifyStoredObject({
        organizationId,
        agentId,
        intentId: intent.id,
        idempotencyKey: "media-provider-adapter-commit",
        correlationId: "cp_media_pglite_provider_head_retry",
        now: providerVerifiedAt,
      }),
      objectBundle,
    );
    assert.equal(providerHeadCalls, 1);
    assert.equal(
      await service.findEvidenceMediaProviderVerificationForIntent(intent.id, "cp_media_other_org"),
      undefined,
    );

    const scannerId = "clamav-isolated-nonproduction";
    const scannerSignerKeyId = "scanner-ed25519-key-2026-07";
    const scannerPolicyRoot = hashJson({ kind: "canopyproof-e2a-scanner-policy-v1" });
    const scannerVerifiedAt = "2026-07-13T00:14:30.000Z";
    const scanReceiptSeed = {
      objectId: objectBundle.object.id,
      objectRoot: objectBundle.object.objectRoot,
      providerReceiptHash: objectBundle.object.providerReceiptHash,
      scannerId,
      scannerName: "clamav-isolated",
      scannerVersion: "1.4.3",
      scannerImageDigest: "e".repeat(64),
      signatureDatabaseVersion: "daily-2026-07-13",
      verdict: "clean",
      findingHashes: [] as readonly string[],
      scannedAt: "2026-07-13T00:14:00.000Z",
      signerKeyId: scannerSignerKeyId,
      signatureAlgorithm: "ed25519" as const,
    } as const;
    const scannerReceiptHash = hashJson({
      kind: "canopyproof-malware-scan-receipt-v1",
      ...scanReceiptSeed,
    });
    const scanInput = {
      objectId: scanReceiptSeed.objectId,
      scannerName: scanReceiptSeed.scannerName,
      scannerVersion: scanReceiptSeed.scannerVersion,
      scannerImageDigest: scanReceiptSeed.scannerImageDigest,
      signatureDatabaseVersion: scanReceiptSeed.signatureDatabaseVersion,
      verdict: scanReceiptSeed.verdict,
      findingHashes: scanReceiptSeed.findingHashes,
      providerReceiptHash: scannerReceiptHash,
      providerVerificationState: "modeled_only",
      scannedAt: scanReceiptSeed.scannedAt,
    } as const;
    await assert.rejects(
      service.recordEvidenceMediaScanResult(
        { ...scanInput, providerVerificationState: "verified" },
        organizationId,
        agentId,
        "media-scan-self-verified",
      ),
      /approved scanner adapter verifies the receipt/,
    );
    const rawScannerSignature = "A".repeat(86);
    let scannerCalls = 0;
    const scannerAdapter = new PolicyEnforcedCanopyProofMalwareScannerAdapter(
      {
        scannerId,
        scannerPolicyRoot,
        allowedSignerKeyIds: [scannerSignerKeyId],
      },
      {
        async scanObject(request) {
          scannerCalls += 1;
          assert.equal(request.objectId, objectBundle.object.id);
          assert.equal(request.providerReceiptHash, providerReceiptHash);
          return {
            ...scanReceiptSeed,
            signature: rawScannerSignature,
            receiptHash: scannerReceiptHash,
          };
        },
      },
      {
        async verify(request) {
          return request.receiptHash === scannerReceiptHash && request.signature === rawScannerSignature;
        },
      },
    );
    const scannerOrchestrator = new CanopyProofEvidenceMediaAdapterOrchestrator(
      service,
      new DisabledCanopyProofObjectStorageAdapter(),
      scannerAdapter,
    );
    const scanBundle = await scannerOrchestrator.scanStoredObject({
      organizationId,
      agentId,
      objectId: objectBundle.object.id,
      idempotencyKey: "media-scanner-adapter-commit",
      correlationId: "cp_media_pglite_scanner_001",
      now: scannerVerifiedAt,
    });
    const scan = scanBundle.scan;
    assert.equal(scanBundle.verification.scannerReceiptHash, scannerReceiptHash);
    assert.equal(scannerCalls, 1);
    assert.deepEqual(
      await scannerOrchestrator.scanStoredObject({
        organizationId,
        agentId,
        objectId: objectBundle.object.id,
        idempotencyKey: "media-scanner-adapter-commit",
        correlationId: "cp_media_pglite_scanner_retry",
        now: scannerVerifiedAt,
      }),
      scanBundle,
    );
    assert.equal(scannerCalls, 1);
    assert.equal(
      await service.findEvidenceMediaScannerVerificationForObject(
        objectBundle.object.id,
        "cp_media_other_org",
      ),
      undefined,
    );
    const reviewProjection = await service.getEvidenceMediaObjectProjection(
      objectBundle.object.id,
      organizationId,
      "2026-07-13T00:14:30.000Z",
    );
    assert.equal(reviewProjection.state, "needs_review");
    assert.equal(reviewProjection.latestScanResultId, scan.id);
    assert.equal(reviewProjection.safety.notFinalProofAuthority, true);
    await assert.rejects(
      service.getEvidenceMediaObject(objectBundle.object.id, "cp_media_other_org"),
      /organization scope mismatch/,
    );

    const reviewTaskInput = {
      objectId: objectBundle.object.id,
      reasonCodes: ["modeled_provider_verification"],
      severity: "medium",
      policyId: "cp_media_pglite_project_policy",
      openedAt: "2026-07-13T00:14:31.000Z",
      dueAt: "2026-07-14T00:14:31.000Z",
    } as const;
    const taskBundle = await service.openEvidenceMediaReviewTask(
      reviewTaskInput,
      organizationId,
      ownerId,
      "owner",
      "media-review-task-open",
    );
    assert.equal(taskBundle.task.mediaProjectionState, "needs_review");
    assert.equal(taskBundle.custodyEvent.sourceRoot, taskBundle.task.taskRoot);
    assert.equal(taskBundle.custodyEvent.previousEventRoot, taskBundle.task.auditEvent.eventRoot);
    assert.deepEqual(
      await service.openEvidenceMediaReviewTask(
        reviewTaskInput,
        organizationId,
        ownerId,
        "owner",
        "media-review-task-open",
      ),
      taskBundle,
    );

    const assignmentInput = {
      taskId: taskBundle.task.id,
      reviewerId,
      assignedAt: "2026-07-13T00:14:32.000Z",
    } as const;
    const assignmentBundle = await service.assignEvidenceMediaReviewTask(
      assignmentInput,
      organizationId,
      ownerId,
      "owner",
      "media-review-task-assign",
    );
    assert.equal(assignmentBundle.assignment.reviewerId, reviewerId);
    assert.equal(assignmentBundle.assignment.reviewer.accreditationStatus, "approved");
    assert.deepEqual(assignmentBundle.assignment.reviewer.accreditationScope, [
      "evidence_media_review",
      "evidence_retention_governance",
    ]);
    assert.equal(assignmentBundle.custodyEvent.sourceRoot, assignmentBundle.assignment.assignmentRoot);
    assert.equal(
      assignmentBundle.custodyEvent.previousCustodyRoot,
      taskBundle.custodyEvent.custodyRoot,
    );

    await assert.rejects(
      service.decideEvidenceMediaReviewTask(
        {
          taskId: taskBundle.task.id,
          decision: "accept_for_processing",
          rationale: "A human reviewer cannot promote modeled provider receipts to verified authority.",
          limitations: ["Provider and scanner receipts remain modeled only."],
          decidedAt: "2026-07-13T00:14:33.000Z",
        },
        organizationId,
        reviewerId,
        "media-review-decision-invalid-promotion",
      ),
      /cannot override provider or trust verification/,
    );

    const reviewDecisionInput = {
      taskId: taskBundle.task.id,
      decision: "retain_non_final",
      rationale: "Retain the media for bounded analysis without granting final proof authority.",
      limitations: ["Provider and scanner receipts remain modeled only."],
      decidedAt: "2026-07-13T00:14:34.000Z",
    } as const;
    const decisionBundle = await service.decideEvidenceMediaReviewTask(
      reviewDecisionInput,
      organizationId,
      reviewerId,
      "media-review-decision-retain",
    );
    assert.equal(decisionBundle.decision.decision, "retain_non_final");
    assert.equal(decisionBundle.decision.mediaProjectionState, "needs_review");
    assert.equal(JSON.stringify(decisionBundle).includes(reviewDecisionInput.rationale), false);
    assert.equal(decisionBundle.custodyEvent.sourceRoot, decisionBundle.decision.decisionRoot);
    assert.equal(
      decisionBundle.custodyEvent.previousCustodyRoot,
      assignmentBundle.custodyEvent.custodyRoot,
    );
    assert.deepEqual(
      await service.decideEvidenceMediaReviewTask(
        reviewDecisionInput,
        organizationId,
        reviewerId,
        "media-review-decision-retain",
      ),
      decisionBundle,
    );

    const taskProjection = await service.getEvidenceMediaReviewTaskProjection(
      taskBundle.task.id,
      organizationId,
    );
    assert.equal(taskProjection.status, "decided");
    assert.equal(taskProjection.decision, "retain_non_final");
    assert.equal(taskProjection.safety.reviewCannotOverrideProviderVerification, true);
    await assert.rejects(
      service.getEvidenceMediaReviewTask(taskBundle.task.id, "cp_media_other_org"),
      /organization scope mismatch/,
    );

    const parity = await db.query<{
      intent_command: boolean;
      intent_hash: boolean;
      intent_root: boolean;
      object_command: boolean;
      object_hash: boolean;
      object_root: boolean;
      scan_command: boolean;
      scan_hash: boolean;
      scan_root: boolean;
      task_command: boolean;
      task_hash: boolean;
      task_root: boolean;
      assignment_command: boolean;
      assignment_hash: boolean;
      assignment_root: boolean;
      decision_command: boolean;
      decision_hash: boolean;
      decision_root: boolean;
      custody_commands: boolean;
      custody_hashes: boolean;
      custody_roots: boolean;
    }>(
      `SELECT
         intent.command_hash = evidence.media_upload_intent_command_hash(intent) AS intent_command,
         intent.intent_hash = evidence.media_upload_intent_hash(intent) AS intent_hash,
         intent.intent_root = evidence.media_upload_intent_root(intent) AS intent_root,
         object_fact.command_hash = evidence.media_object_command_hash(object_fact) AS object_command,
         object_fact.object_hash = evidence.media_object_hash(object_fact) AS object_hash,
         object_fact.object_root = evidence.media_object_root(object_fact) AS object_root,
         scan.command_hash = evidence.media_scan_command_hash(scan) AS scan_command,
         scan.scan_hash = evidence.media_scan_hash(scan) AS scan_hash,
         scan.scan_root = evidence.media_scan_root(scan) AS scan_root,
         task.command_hash = evidence.media_review_task_command_hash(task) AS task_command,
         task.task_hash = evidence.media_review_task_hash(task) AS task_hash,
         task.task_root = evidence.media_review_task_root(task) AS task_root,
         assignment.command_hash = evidence.media_review_assignment_command_hash(assignment)
           AS assignment_command,
         assignment.assignment_hash = evidence.media_review_assignment_hash(assignment)
           AS assignment_hash,
         assignment.assignment_root = evidence.media_review_assignment_root(assignment)
           AS assignment_root,
         decision_fact.command_hash = evidence.media_review_decision_command_hash(decision_fact)
           AS decision_command,
         decision_fact.decision_hash = evidence.media_review_decision_hash(decision_fact) AS decision_hash,
         decision_fact.decision_root = evidence.media_review_decision_root(decision_fact) AS decision_root,
         (SELECT bool_and(custody.command_hash = evidence.media_custody_command_hash(custody))
          FROM evidence.media_custody_event_facts custody
          WHERE custody.evidence_id = intent.evidence_id) AS custody_commands,
         (SELECT bool_and(custody.custody_hash = evidence.media_custody_hash(custody))
          FROM evidence.media_custody_event_facts custody
          WHERE custody.evidence_id = intent.evidence_id) AS custody_hashes,
         (SELECT bool_and(custody.custody_root = evidence.media_custody_root(custody))
          FROM evidence.media_custody_event_facts custody
          WHERE custody.evidence_id = intent.evidence_id) AS custody_roots
       FROM evidence.media_upload_intent_facts intent
       JOIN evidence.media_object_facts object_fact ON object_fact.intent_id = intent.id
       JOIN evidence.media_scan_result_facts scan ON scan.object_id = object_fact.id
       JOIN evidence.media_review_task_facts task ON task.object_id = object_fact.id
       JOIN evidence.media_review_assignment_facts assignment ON assignment.task_id = task.id
       JOIN evidence.media_review_decision_facts decision_fact ON decision_fact.task_id = task.id
       WHERE intent.id = $1`,
      [intent.id],
    );
    assert.deepEqual(parity.rows, [
      {
        intent_command: true,
        intent_hash: true,
        intent_root: true,
        object_command: true,
        object_hash: true,
        object_root: true,
        scan_command: true,
        scan_hash: true,
        scan_root: true,
        task_command: true,
        task_hash: true,
        task_root: true,
        assignment_command: true,
        assignment_hash: true,
        assignment_root: true,
        decision_command: true,
        decision_hash: true,
        decision_root: true,
        custody_commands: true,
        custody_hashes: true,
        custody_roots: true,
      },
    ]);

    const durableCounts = await db.query<{
      intents: number;
      objects: number;
      scans: number;
      review_tasks: number;
      review_assignments: number;
      review_decisions: number;
      custody_events: number;
      semantic_events: number;
      command_receipts: number;
      database_events: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM evidence.media_upload_intent_facts WHERE evidence_id = $1) AS intents,
         (SELECT count(*)::int FROM evidence.media_object_facts WHERE evidence_id = $1) AS objects,
         (SELECT count(*)::int FROM evidence.media_scan_result_facts WHERE evidence_id = $1) AS scans,
         (SELECT count(*)::int FROM evidence.media_review_task_facts WHERE evidence_id = $1) AS review_tasks,
         (SELECT count(*)::int FROM evidence.media_review_assignment_facts WHERE evidence_id = $1)
           AS review_assignments,
         (SELECT count(*)::int FROM evidence.media_review_decision_facts WHERE evidence_id = $1)
           AS review_decisions,
         (SELECT count(*)::int FROM evidence.media_custody_event_facts WHERE evidence_id = $1)
           AS custody_events,
         (SELECT count(*)::int FROM audit.domain_events
          WHERE stream_id IN ('evidence-media:' || $1, 'evidence-media-adapter:' || $1))
           AS semantic_events,
         (SELECT count(*)::int FROM audit.command_receipts
          WHERE operation IN ('evidence.media-upload-intent.create',
            'evidence.media-provider-receipt.commit', 'evidence.media-provider-receipt.verify',
            'evidence.media-scanner-receipt.commit', 'evidence.media-scanner-receipt.verify',
            'evidence.media-review-task.open',
            'evidence.media-review-task.assign', 'evidence.media-review-task.decide')) AS command_receipts,
         (SELECT count(*)::int FROM audit.event_log
          WHERE table_name IN ('media_upload_intent_facts', 'media_object_facts', 'media_scan_result_facts',
            'media_provider_receipt_verification_facts', 'media_scanner_receipt_verification_facts',
            'media_review_task_facts', 'media_review_assignment_facts', 'media_review_decision_facts',
            'media_custody_event_facts')) AS database_events`,
      [evidenceId],
    );
    assert.deepEqual(durableCounts.rows, [
      {
        intents: 1,
        objects: 1,
        scans: 1,
        review_tasks: 1,
        review_assignments: 1,
        review_decisions: 1,
        custody_events: 3,
        semantic_events: 11,
        command_receipts: 8,
        database_events: 11,
      },
    ]);

    const forbiddenColumns = await db.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'evidence'
         AND table_name IN ('media_upload_intent_facts', 'media_object_facts')
         AND column_name IN ('upload_url', 'url', 'token', 'credential', 'secret')`,
    );
    assert.deepEqual(forbiddenColumns.rows, []);

    const forbiddenReviewColumns = await db.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'evidence'
         AND table_name IN ('media_review_task_facts', 'media_review_assignment_facts',
           'media_review_decision_facts', 'media_custody_event_facts')
         AND column_name IN ('rationale', 'limitations', 'custody_note', 'provider_credential', 'secret')`,
    );
    assert.deepEqual(forbiddenReviewColumns.rows, []);

    await assertAppendOnly(
      db,
      subjectId,
      "UPDATE evidence.media_upload_intent_facts SET content_type = content_type WHERE id = $1",
      intent.id,
    );
    await assertAppendOnly(
      db,
      agentId,
      "UPDATE evidence.media_object_facts SET provider_verification_state = 'verified' WHERE id = $1",
      objectBundle.object.id,
    );
    await assertAppendOnly(
      db,
      agentId,
      "DELETE FROM evidence.media_scan_result_facts WHERE id = $1",
      scan.id,
    );
    await assertAppendOnly(
      db,
      ownerId,
      "UPDATE evidence.media_review_task_facts SET severity = severity WHERE id = $1",
      taskBundle.task.id,
    );
    await assertAppendOnly(
      db,
      ownerId,
      "DELETE FROM evidence.media_review_assignment_facts WHERE id = $1",
      assignmentBundle.assignment.id,
    );
    await assertAppendOnly(
      db,
      reviewerId,
      "UPDATE evidence.media_review_decision_facts SET decision = decision WHERE id = $1",
      decisionBundle.decision.id,
    );
    await assertAppendOnly(
      db,
      reviewerId,
      "DELETE FROM evidence.media_custody_event_facts WHERE id = $1",
      decisionBundle.custodyEvent.id,
    );

    const e3bRepository = new PrismaCanopyProofEvidenceMetadataRetentionRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(e3bRepository.getStatus(), {
      service: "canopyproof-evidence-metadata-retention-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      idempotencyRequired: true,
      providerReceipts: "modeled_only",
      finalProofAuthority: false,
    });
    const metadataDomain = CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot(
      await e3bRepository.loadAuthoritySnapshot(organizationId, evidenceId),
    );
    const extractedAt = "2026-07-13T00:14:35.000Z";
    const metadataAgent = mediaAgentForCapability(
      objectBundle.object.agent,
      "metadata_extraction_receipt",
    );
    const mediaProjectionAuthority = await service.getEvidenceMediaExtractionProjectionAuthority(
      objectBundle.object.id,
      organizationId,
      extractedAt,
    );
    const metadataFact = metadataDomain.recordMetadataExtraction(
      {
        objectId: objectBundle.object.id,
        extractorName: "exiftool-isolated",
        extractorVersion: "13.30",
        extractorImageDigest: "1".repeat(64),
        metadataSchemaVersion: "canopyproof.metadata.v1",
        exifHash: "2".repeat(64),
        gpsHash: evidence.evidence.gps_hash,
        metadataOutputRoot: "3".repeat(64),
        locationDisclosure: "none",
        accuracyBand: "under_10m",
        clockSkewBand: "under_1m",
        providerReceiptHash: "4".repeat(64),
        providerVerificationState: "modeled_only",
        observedAt: intent.capturedAt,
        extractedAt,
      },
      {
        intent,
        object: objectBundle.object,
        ...mediaProjectionAuthority,
        consent,
        consentProjection: await service.getEvidenceConsentProjection(
          consent.id,
          organizationId,
          extractedAt,
        ),
        device,
        deviceProjection: await service.getEvidenceEffectiveDeviceAttestationProjection(
          device.id,
          organizationId,
          extractedAt,
        ),
        registeredGpsHash: evidence.evidence.gps_hash,
        agent: metadataAgent,
      },
    );
    assert.equal(metadataFact.extractionState, "needs_review");
    assert.deepEqual(metadataFact.issueCodes, ["metadata_provider_verification_pending"]);
    assert.deepEqual(
      await e3bRepository.commitFact(metadataFact, "e3b-metadata-commit"),
      metadataFact,
    );
    assert.deepEqual(
      await e3bRepository.commitFact(metadataFact, "e3b-metadata-commit"),
      metadataFact,
    );

    const e3cVerifier = mediaAgentForCapability(
      objectBundle.object.agent,
      "verified_metadata_extraction_receipt",
    );
    const e3cVerifiedAt = metadataFact.extractedAt;
    const e3cExtractorId = "cp-e3c-pglite-extractor";
    const e3cSignerKeyId = "cp-e3c-pglite-ed25519-v1";
    const e3cSignatureHash = hashJson({ kind: "cp-e3c-pglite-signature" });
    const e3cPolicyRoot = hashJson({ kind: "cp-e3c-pglite-policy" });
    const e3cAdapterRoot = hashJson({ kind: "cp-e3c-pglite-adapter-verification" });
    const e3cVerificationRoot = hashJson({
      kind: "canopyproof-metadata-extraction-receipt-verification-v1",
      metadataReceiptHash: metadataFact.providerReceiptHash,
      extractionRoot: metadataFact.extractionRoot,
      objectRoot: objectBundle.object.objectRoot,
      extractorId: e3cExtractorId,
      verifierId: e3cVerifier.id,
      signerKeyId: e3cSignerKeyId,
      extractorPolicyRoot: e3cPolicyRoot,
      signatureHash: e3cSignatureHash,
      adapterVerificationRoot: e3cAdapterRoot,
      verifiedAt: e3cVerifiedAt,
    });
    const e3cCommandHash = hashJson({
      kind: "canopyproof-metadata-extraction-verification-command-v1",
      extractionId: metadataFact.id,
      extractionRoot: metadataFact.extractionRoot,
      objectId: objectBundle.object.id,
      objectRoot: objectBundle.object.objectRoot,
      metadataReceiptHash: metadataFact.providerReceiptHash,
      verificationRoot: e3cVerificationRoot,
      verifierId: e3cVerifier.id,
      verifierAuthorityRoot: e3cVerifier.authorityRoot,
      verifiedAt: e3cVerifiedAt,
    });
    const e3cId = `cp_metadata_verify_${e3cCommandHash.slice(0, 24)}`;
    const e3cEventSeed = {
      action: "FULFILL" as const,
      actor: e3cVerifier.id,
      entityType: "metadata_extraction_receipt_verification" as const,
      entityId: e3cId,
      previousRoot: canopyProofAuditGenesisRoot(),
      payloadHash: e3cVerificationRoot,
      createdAt: e3cVerifiedAt,
      rationale: "An independently signed metadata-extraction receipt verification fact was appended.",
    };
    const e3cEventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...e3cEventSeed });
    const e3cAuditEvent = {
      id: `cp_audit_${e3cEventRoot.slice(0, 24)}`,
      ...e3cEventSeed,
      eventRoot: e3cEventRoot,
    };
    const e3cCommandReceiptId = `cp_e3c_command_${e3cCommandHash.slice(0, 24)}`;
    const e3cSafety = canopyProofEvidenceMetadataAdapterSafetyBoundary();
    const e3cFactRoot = hashJson({
      kind: "canopyproof-metadata-extraction-verification-fact-root-v1",
      commandHash: e3cCommandHash,
      verificationRoot: e3cVerificationRoot,
      auditEventRoot: e3cEventRoot,
      commandReceiptId: e3cCommandReceiptId,
      safety: e3cSafety,
    });
    const e3cFact: CanopyProofEvidenceMetadataExtractionVerificationFact = {
      factType: "evidence_metadata_extraction_receipt_verification",
      id: e3cId,
      organizationId,
      projectId,
      evidenceId,
      objectId: objectBundle.object.id,
      objectRoot: objectBundle.object.objectRoot,
      extractionId: metadataFact.id,
      extractionRoot: metadataFact.extractionRoot,
      verifierId: e3cVerifier.id,
      verifier: e3cVerifier,
      extractorId: e3cExtractorId,
      signerKeyId: e3cSignerKeyId,
      signatureAlgorithm: "ed25519",
      signatureHash: e3cSignatureHash,
      extractorPolicyRoot: e3cPolicyRoot,
      metadataReceiptHash: metadataFact.providerReceiptHash,
      adapterVerificationRoot: e3cAdapterRoot,
      verifiedAt: e3cVerifiedAt,
      verificationRoot: e3cVerificationRoot,
      commandHash: e3cCommandHash,
      evidenceSequence: 1,
      previousEventRoot: e3cAuditEvent.previousRoot,
      commandReceiptId: e3cCommandReceiptId,
      factRoot: e3cFactRoot,
      safety: e3cSafety,
      auditEvent: e3cAuditEvent,
    };
    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [e3cVerifier.id]);
      await transaction.query(
        `INSERT INTO audit.domain_events (
          id, stream_id, action, actor_id, entity_type, entity_id,
          previous_root, payload_hash, event_root, created_at, rationale
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          e3cAuditEvent.id,
          `evidence-metadata-adapter:${evidenceId}`,
          e3cAuditEvent.action,
          e3cAuditEvent.actor,
          e3cAuditEvent.entityType,
          e3cAuditEvent.entityId,
          e3cAuditEvent.previousRoot,
          e3cAuditEvent.payloadHash,
          e3cAuditEvent.eventRoot,
          e3cAuditEvent.createdAt,
          e3cAuditEvent.rationale,
        ],
      );
      await transaction.query(
        `INSERT INTO audit.command_receipts (
          id, actor_id, operation, idempotency_key_hash, request_hash,
          result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          e3cCommandReceiptId,
          e3cVerifier.id,
          "evidence.metadata-extraction-receipt.verify",
          e3cCommandHash,
          e3cCommandHash,
          "metadata_extraction_receipt_verification",
          e3cId,
          e3cFactRoot,
          e3cEventRoot,
          e3cVerifiedAt,
        ],
      );
      await transaction.query(
        `INSERT INTO evidence.metadata_extraction_verification_facts (
          id, organization_id, project_id, evidence_id, object_id, object_root,
          extraction_id, extraction_root, verifier_id, verifier_snapshot, extractor_id,
          signer_key_id, signature_algorithm, signature_hash, extractor_policy_root,
          metadata_receipt_hash, adapter_verification_root, verified_at, verification_root,
          command_hash, evidence_sequence, previous_event_root, command_receipt_id,
          fact_root, safety, fact_record, audit_event_root
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26::jsonb,$27
        )`,
        [
          e3cFact.id,
          e3cFact.organizationId,
          e3cFact.projectId,
          e3cFact.evidenceId,
          e3cFact.objectId,
          e3cFact.objectRoot,
          e3cFact.extractionId,
          e3cFact.extractionRoot,
          e3cFact.verifierId,
          JSON.stringify(e3cFact.verifier),
          e3cFact.extractorId,
          e3cFact.signerKeyId,
          e3cFact.signatureAlgorithm,
          e3cFact.signatureHash,
          e3cFact.extractorPolicyRoot,
          e3cFact.metadataReceiptHash,
          e3cFact.adapterVerificationRoot,
          e3cFact.verifiedAt,
          e3cFact.verificationRoot,
          e3cFact.commandHash,
          e3cFact.evidenceSequence,
          e3cFact.previousEventRoot,
          e3cFact.commandReceiptId,
          e3cFact.factRoot,
          JSON.stringify(e3cFact.safety),
          JSON.stringify(e3cFact),
          e3cFact.auditEvent.eventRoot,
        ],
      );
    });
    const e3cParity = await queryE3b<{
      verification_root: boolean;
      command_hash: boolean;
      fact_root: boolean;
      raw_signature_forbidden: boolean;
    }>(
      db,
      organizationId,
      `SELECT
         verification_root = evidence.e3c_verification_root(fact) AS verification_root,
         command_hash = evidence.e3c_command_hash(fact) AS command_hash,
         fact_root = evidence.e3c_fact_root(fact) AS fact_root,
         evidence.e3c_has_forbidden_key('{"signature":"forbidden"}'::jsonb)
           AS raw_signature_forbidden
       FROM evidence.metadata_extraction_verification_facts fact
       WHERE id = $1`,
      [e3cFact.id],
    );
    assert.deepEqual(e3cParity, [{
      verification_root: true,
      command_hash: true,
      fact_root: true,
      raw_signature_forbidden: true,
    }]);
    const e3cTypeScriptProjection = projectCanopyProofEvidenceMetadataExtraction({
      object: objectBundle.object,
      extraction: metadataFact,
      verification: e3cFact,
      evaluatedAt: e3cVerifiedAt,
    });
    const e3cSqlProjection = await queryE3b<{
      verification_state: string;
      state: string;
      issue_codes: string[];
      projection_root: string;
    }>(
      db,
      organizationId,
      `SELECT verification_state, state, issue_codes, projection_root
       FROM evidence.metadata_extraction_trust_projection($1, $2::timestamptz)`,
      [metadataFact.id, e3cVerifiedAt],
    );
    assert.deepEqual(e3cSqlProjection, [{
      verification_state: "verified",
      state: "accepted",
      issue_codes: [],
      projection_root: e3cTypeScriptProjection.projectionRoot,
    }]);

    const retentionEvaluatedAt = "2026-07-13T00:14:36.000Z";
    const retentionDecision = metadataDomain.recordRetentionDecision(
      {
        sourceType: "metadata_extraction",
        sourceId: metadataFact.id,
        basis: "data_minimization",
        disposition: "minimize",
        retainUntil: "2026-08-13T00:00:00.000Z",
        policyId: "cp-e3b-retention-v1",
        rationale: "Minimize derived location metadata after the bounded institutional review window.",
        evaluatedAt: retentionEvaluatedAt,
      },
      {
        source: metadataFact,
        intent,
        consent,
        consentProjection: await service.getEvidenceConsentProjection(
          consent.id,
          organizationId,
          retentionEvaluatedAt,
        ),
        decider: taskBundle.task.opener,
      },
    );
    assert.deepEqual(
      await e3bRepository.commitFact(retentionDecision, "e3b-decision-commit"),
      retentionDecision,
    );

    const retentionExecution = metadataDomain.recordRetentionExecution(
      {
        decisionId: retentionDecision.id,
        operation: "minimize",
        result: "completed",
        storageProvider: "cloudflare_r2",
        providerNamespace: "canopyproof-evidence-pglite",
        providerReceiptHash: "5".repeat(64),
        providerVerificationState: "modeled_only",
        resultingRoot: "6".repeat(64),
        reasonHashes: [],
        executedAt: "2026-07-13T00:14:37.000Z",
      },
      {
        source: metadataFact,
        decision: retentionDecision,
        object: objectBundle.object,
        agent: mediaAgentForCapability(
          objectBundle.object.agent,
          "retention_execution_receipt",
        ),
      },
    );
    assert.deepEqual(
      await e3bRepository.commitFact(retentionExecution, "e3b-execution-commit"),
      retentionExecution,
    );
    assert.equal(
      (
        await e3bRepository.projectRetention(
          organizationId,
          evidenceId,
          "metadata_extraction",
          metadataFact.id,
          "2026-07-13T00:14:38.000Z",
        )
      ).state,
      "minimization_pending",
    );

    const restartedE3b = new PrismaCanopyProofEvidenceMetadataRetentionRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(
      await restartedE3b.getFact(organizationId, evidenceId, metadataFact.id),
      metadataFact,
    );
    await assert.rejects(
      restartedE3b.getFact("cp_media_other_org", evidenceId, metadataFact.id),
      /ORGANIZATION_SCOPE_MISMATCH/,
    );
    const e3bCountsBeforeRejectedWrite = await queryE3b<{
      metadata_facts: number;
      decisions: number;
      executions: number;
      semantic_events: number;
      command_receipts: number;
      database_events: number;
    }>(
      db,
      organizationId,
      `SELECT
         (SELECT count(*)::int FROM evidence.media_metadata_extraction_facts
          WHERE evidence_id = $1) AS metadata_facts,
         (SELECT count(*)::int FROM evidence.retention_decision_facts
          WHERE evidence_id = $1) AS decisions,
         (SELECT count(*)::int FROM evidence.retention_execution_facts
          WHERE evidence_id = $1) AS executions,
         (SELECT count(*)::int FROM audit.domain_events
          WHERE stream_id = 'evidence-media:' || $1) AS semantic_events,
         (SELECT count(*)::int FROM audit.command_receipts
          WHERE operation IN ('evidence.metadata-extraction.commit',
            'evidence.retention-decision.commit', 'evidence.retention-execution.commit'))
           AS command_receipts,
         (SELECT count(*)::int FROM audit.event_log
          WHERE table_name IN ('media_metadata_extraction_facts', 'retention_decision_facts',
            'retention_execution_facts')) AS database_events`,
      [evidenceId],
    );
    assert.deepEqual(e3bCountsBeforeRejectedWrite, [{
      metadata_facts: 1,
      decisions: 1,
      executions: 1,
      semantic_events: 12,
      command_receipts: 3,
      database_events: 3,
    }]);
    await assert.rejects(
      e3bRepository.commitFact(
        {
          ...metadataFact,
          metadataOutputRoot: "7".repeat(64),
        },
        "e3b-tampered-fact",
      ),
      /E3B_FACT_CONFLICT/,
    );
    assert.deepEqual(
      await queryE3b(
        db,
        organizationId,
        `SELECT
           (SELECT count(*)::int FROM evidence.media_metadata_extraction_facts
            WHERE evidence_id = $1) AS metadata_facts,
           (SELECT count(*)::int FROM evidence.retention_decision_facts
            WHERE evidence_id = $1) AS decisions,
           (SELECT count(*)::int FROM evidence.retention_execution_facts
            WHERE evidence_id = $1) AS executions,
           (SELECT count(*)::int FROM audit.domain_events
            WHERE stream_id = 'evidence-media:' || $1) AS semantic_events,
           (SELECT count(*)::int FROM audit.command_receipts
            WHERE operation IN ('evidence.metadata-extraction.commit',
              'evidence.retention-decision.commit', 'evidence.retention-execution.commit'))
             AS command_receipts,
           (SELECT count(*)::int FROM audit.event_log
            WHERE table_name IN ('media_metadata_extraction_facts', 'retention_decision_facts',
              'retention_execution_facts')) AS database_events`,
        [evidenceId],
      ),
      e3bCountsBeforeRejectedWrite,
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      metadataAgent.id,
      "UPDATE evidence.media_metadata_extraction_facts SET extracted_at = extracted_at WHERE id = $1",
      metadataFact.id,
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      taskBundle.task.opener.id,
      "DELETE FROM evidence.retention_decision_facts WHERE id = $1",
      retentionDecision.id,
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      retentionExecution.agent.id,
      "UPDATE evidence.retention_execution_facts SET executed_at = executed_at WHERE id = $1",
      retentionExecution.id,
    );

    const e3bParity = await queryE3b<{
      metadata_command: boolean;
      metadata_hash: boolean;
      metadata_root: boolean;
      decision_command: boolean;
      decision_hash: boolean;
      decision_root: boolean;
      execution_command: boolean;
      execution_hash: boolean;
      execution_root: boolean;
    }>(
      db,
      organizationId,
      `SELECT
         metadata.command_hash = evidence.e3b_metadata_command_hash(metadata.fact_record) AS metadata_command,
         metadata.extraction_hash = evidence.e3b_metadata_hash(metadata.fact_record) AS metadata_hash,
         metadata.extraction_root = evidence.e3b_metadata_root(metadata.fact_record) AS metadata_root,
         decision.command_hash = evidence.e3b_decision_command_hash(decision.fact_record) AS decision_command,
         decision.decision_hash = evidence.e3b_decision_hash(decision.fact_record) AS decision_hash,
         decision.decision_root = evidence.e3b_decision_root(decision.fact_record) AS decision_root,
         execution.command_hash = evidence.e3b_execution_command_hash(execution.fact_record) AS execution_command,
         execution.execution_hash = evidence.e3b_execution_hash(execution.fact_record) AS execution_hash,
         execution.execution_root = evidence.e3b_execution_root(execution.fact_record) AS execution_root
       FROM evidence.media_metadata_extraction_facts metadata
       JOIN evidence.retention_decision_facts decision ON decision.source_id = metadata.id
       JOIN evidence.retention_execution_facts execution ON execution.decision_id = decision.id
       WHERE metadata.id = $1`,
      [metadataFact.id],
    );
    assert.deepEqual(e3bParity, [{
      metadata_command: true,
      metadata_hash: true,
      metadata_root: true,
      decision_command: true,
      decision_hash: true,
      decision_root: true,
      execution_command: true,
      execution_hash: true,
      execution_root: true,
    }]);

    await assertTriggerCatalog(db, "evidence.media_metadata_extraction_facts", [
      "evidence_e3b_metadata_audit",
      "evidence_e3b_metadata_validate",
      "media_metadata_extraction_facts_append_only",
    ]);
    await assertTriggerCatalog(db, "evidence.retention_decision_facts", [
      "evidence_e3b_decision_audit",
      "evidence_e3b_decision_validate",
      "retention_decision_facts_append_only",
    ]);
    await assertTriggerCatalog(db, "evidence.retention_execution_facts", [
      "evidence_e3b_execution_audit",
      "evidence_e3b_execution_validate",
      "retention_execution_facts_append_only",
    ]);
    await assertTenantPolicy(
      db,
      "metadata_extraction_verification_facts",
      "evidence_e3c_verification_tenant",
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      e3cVerifier.id,
      `UPDATE evidence.metadata_extraction_verification_facts
       SET verified_at = verified_at WHERE id = $1`,
      e3cFact.id,
    );
    await assertTriggerCatalog(db, "evidence.metadata_extraction_verification_facts", [
      "evidence_e3c_verification_append_only",
      "evidence_e3c_verification_audit",
      "evidence_e3c_verification_validate",
    ]);
    const e3dRequestedAt = "2026-07-13T00:14:39.000Z";
    const e3dAuthority = {
      intent,
      object: objectBundle.object,
      ...(await service.getEvidenceMediaExtractionProjectionAuthority(
        objectBundle.object.id,
        organizationId,
        e3dRequestedAt,
      )),
      consent,
      consentProjection: await service.getEvidenceConsentProjection(
        consent.id,
        organizationId,
        e3dRequestedAt,
      ),
      device,
      deviceProjection: await service.getEvidenceEffectiveDeviceAttestationProjection(
        device.id,
        organizationId,
        e3dRequestedAt,
      ),
      registeredGpsHash: evidence.evidence.gps_hash,
      agent: mediaAgentForCapability(
        objectBundle.object.agent,
        "metadata_extraction_receipt",
      ),
    };
    const e3dSignerKeyId = "cp-e3d-pglite-ed25519-v1";
    const e3dExtractorConfiguration = {
      extractorId: "cp-e3d-pglite-extractor",
      extractorName: "exiftool-isolated",
      extractorVersion: "13.30",
      extractorImageDigest: hashJson({ kind: "cp-e3d-pglite-extractor-image" }),
      metadataSchemaVersion: "canopyproof.metadata.v1",
      extractorPolicyRoot: hashJson({ kind: "cp-e3d-pglite-extractor-policy" }),
      allowedSignerKeyIds: [e3dSignerKeyId],
      maximumObservationAgeSeconds: 365 * 86_400,
    } as const;
    const e3dReceiptSeed = {
      objectId: objectBundle.object.id,
      objectRoot: objectBundle.object.objectRoot,
      storageProvider: objectBundle.object.storageProvider,
      providerNamespace: objectBundle.object.providerNamespace,
      objectKey: objectBundle.object.objectKey,
      objectVersion: objectBundle.object.objectVersion,
      storedObjectProviderReceiptHash: objectBundle.object.providerReceiptHash,
      mediaProjectionRoot: e3dAuthority.mediaProjection.projectionRoot,
      consentReceiptId: consent.id,
      consentReceiptRoot: consent.receiptRoot,
      consentProjectionRoot: e3dAuthority.consentProjection.projectionRoot,
      deviceAttestationId: device.id,
      deviceAttestationRoot: device.attestationRoot,
      deviceProjectionRoot: e3dAuthority.deviceProjection.projectionRoot,
      registeredGpsHash: evidence.evidence.gps_hash,
      privacyMode: consent.privacyMode,
      extractorId: e3dExtractorConfiguration.extractorId,
      extractorName: e3dExtractorConfiguration.extractorName,
      extractorVersion: e3dExtractorConfiguration.extractorVersion,
      extractorImageDigest: e3dExtractorConfiguration.extractorImageDigest,
      metadataSchemaVersion: e3dExtractorConfiguration.metadataSchemaVersion,
      exifHash: hashJson({ kind: "cp-e3d-pglite-exif" }),
      gpsHash: evidence.evidence.gps_hash,
      metadataOutputRoot: hashJson({ kind: "cp-e3d-pglite-output" }),
      locationDisclosure: "none" as const,
      accuracyBand: "under_10m" as const,
      clockSkewBand: "under_1m" as const,
      observedAt: intent.capturedAt,
      extractedAt: e3dRequestedAt,
      signerKeyId: e3dSignerKeyId,
      signatureAlgorithm: "ed25519" as const,
    };
    const e3dReceiptHash = hashJson({
      kind: "canopyproof-metadata-extraction-receipt-v1",
      ...canopyProofMetadataExtractionReceiptSeed(e3dReceiptSeed),
    });
    const e3dRawSignature = "A".repeat(86);
    const e3dReceipt = {
      ...e3dReceiptSeed,
      signature: e3dRawSignature,
      receiptHash: e3dReceiptHash,
    };
    let e3dExternalCalls = 0;
    const e3dAdapter = new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
      e3dExtractorConfiguration,
      {
        async extractMetadata(request) {
          e3dExternalCalls += 1;
          assert.equal(request.objectId, objectBundle.object.id);
          assert.equal(request.mediaProjectionRoot, e3dAuthority.mediaProjection.projectionRoot);
          return e3dReceipt;
        },
      },
      {
        async verify(input) {
          return input.signerKeyId === e3dSignerKeyId &&
            input.receiptHash === e3dReceiptHash &&
            input.signature === e3dRawSignature;
        },
      },
    );
    const e3dRepository = new PrismaCanopyProofMetadataExtractionOrchestrationRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(e3dRepository.getStatus(), {
      service: "canopyproof-metadata-extraction-orchestration-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      requestBeforeExternalIo: true,
      currentAuthorityRecheckedBeforeExternalIo: true,
      finalProofAuthority: false,
    });
    const e3dOrchestrator = new CanopyProofMetadataExtractionOrchestrator(
      e3dRepository,
      e3dAdapter,
      () => e3dRequestedAt,
    );
    const e3dCommand = {
      organizationId,
      objectId: objectBundle.object.id,
      requesterAgentId: agentId,
      verifierAgentId: agentId,
      idempotencyKey: "e3d-pglite-extraction-request-0001",
      requestedAt: e3dRequestedAt,
    } as const;
    const e3dResult = await e3dOrchestrator.extractMetadata(e3dCommand);
    assert.equal(e3dResult.projection.state, "accepted");
    assert.equal(e3dResult.request.mediaProjectionRoot, e3dAuthority.mediaProjection.projectionRoot);
    assert.equal(e3dResult.extraction.extractionState, "needs_review");
    assert.deepEqual(e3dResult.extraction.issueCodes, ["metadata_provider_verification_pending"]);
    assert.equal(JSON.stringify(e3dResult).includes(e3dRawSignature), false);
    assert.deepEqual(await e3dOrchestrator.extractMetadata(e3dCommand), e3dResult);
    assert.equal(e3dExternalCalls, 1);
    await assert.rejects(
      e3dOrchestrator.extractMetadata({
        ...e3dCommand,
        requestedAt: "2026-07-13T00:14:39.001Z",
      }),
      /CANOPYPROOF_E3D_IDEMPOTENCY_CONFLICT/,
    );
    assert.equal(e3dExternalCalls, 1);
    const e3dPending = await e3dRepository.prepareMetadataExtractionRequest({
      organizationId,
      objectId: objectBundle.object.id,
      requesterAgentId: agentId,
      idempotencyKey: "e3d-pglite-extraction-request-pending-0002",
      requestedAt: "2026-07-13T00:14:39.100Z",
      policy: e3dAdapter.getPolicyDescriptor(),
    });
    await assert.rejects(
      e3dRepository.assertMetadataExtractionDispatchAuthorized(
        e3dPending,
        e3dPending.request.dispatchExpiresAt,
      ),
      /CANOPYPROOF_E3D_DISPATCH_EXPIRED/,
    );

    const e3dParity = await queryE3b<{
      request_hash: boolean;
      command_hash: boolean;
      request_root: boolean;
      raw_signature_forbidden: boolean;
      raw_idempotency_key_absent: boolean;
    }>(
      db,
      organizationId,
      `SELECT
         request_hash = evidence.e3d_request_hash(fact) AS request_hash,
         command_hash = evidence.e3d_request_command_hash(fact) AS command_hash,
         request_root = evidence.e3d_request_root(fact) AS request_root,
         evidence.e3d_has_forbidden_key('{"signature":"forbidden"}'::jsonb)
           AS raw_signature_forbidden,
         position($2 in fact_record::text) = 0 AS raw_idempotency_key_absent
       FROM evidence.metadata_extraction_request_facts fact
       WHERE id = $1`,
      [e3dResult.request.id, e3dCommand.idempotencyKey],
    );
    assert.deepEqual(e3dParity, [{
      request_hash: true,
      command_hash: true,
      request_root: true,
      raw_signature_forbidden: true,
      raw_idempotency_key_absent: true,
    }]);
    await assertTenantPolicy(
      db,
      "metadata_extraction_request_facts",
      "evidence_e3d_request_tenant",
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      agentId,
      `UPDATE evidence.metadata_extraction_request_facts
       SET requested_at = requested_at WHERE id = $1`,
      e3dResult.request.id,
    );
    await assertTriggerCatalog(db, "evidence.metadata_extraction_request_facts", [
      "evidence_e3d_request_append_only",
      "evidence_e3d_request_audit",
      "evidence_e3d_request_validate",
    ]);
    await assert.rejects(db.exec(e3dRollback), /CANOPYPROOF_E3D_ROLLBACK_REFUSED/);
    await assert.rejects(db.exec(e3cRollback), /CANOPYPROOF_E3C_ROLLBACK_REFUSED/);
    await assert.rejects(db.exec(e3bRollback), /CANOPYPROOF_E3B_ROLLBACK_REFUSED/);

    const offlineClientBatchId = "media-field-batch-001";
    const offlineEvidence = await service.registerEvidence(
      {
        id: "cp_media_pglite_offline_evidence",
        projectId,
        evidenceType: "restoration",
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          accuracyMeters: 6,
          regionId: "region_media_custody",
        },
        timestamp: "2026-07-13T00:14:40.000Z",
        createdAt: "2026-07-13T00:14:40.000Z",
        media_hash: "d".repeat(64),
        gps_hash: "e".repeat(64),
        confidence_score: 85,
        offline_sync_id: offlineClientBatchId,
        device_fingerprint_hash: fingerprintHash,
      },
      subjectId,
      "community",
      "media-offline-evidence-create",
    );
    const e4Repository = new PrismaCanopyProofEvidenceOfflineCommunityRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(e4Repository.getStatus(), {
      service: "canopyproof-evidence-offline-community-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      idempotencyRequired: true,
      atomicOfflineBundles: true,
      communityStatementsFinalAuthority: false,
    });
    const offlineDomain = CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(
      await e4Repository.loadOfflineAuthoritySnapshot(organizationId, device.id),
    );
    const offlineReceivedAt = "2026-07-13T00:14:46.000Z";
    const offlineBundle = offlineDomain.recordOfflineBundle(
      {
        clientBatchId: offlineClientBatchId,
        deviceSequence: 1,
        previousBatchRoot: offlineBatchGenesis(device.id, device.attestationRoot),
        deviceClockStartedAt: "2026-07-13T00:14:39.000Z",
        deviceClockEndedAt: "2026-07-13T00:14:45.000Z",
        receivedAt: offlineReceivedAt,
        connectivity: "offline",
        items: [
          {
            clientRecordId: "media-field-record-001",
            evidenceId: offlineEvidence.evidence.id,
            evidenceRoot: offlineEvidence.evidence.evidenceRoot,
            clientPayloadHash: "f".repeat(64),
          },
        ],
      },
      {
        actor: intent.actor,
        project: {
          id: project.id,
          organizationId: project.organizationId,
          regionId: project.regionId,
          status: project.status,
          projectRoot: project.projectRoot,
          updatedAt: project.updatedAt,
        },
        consent,
        consentProjection: await service.getEvidenceConsentProjection(
          consent.id,
          organizationId,
          offlineReceivedAt,
        ),
        device,
        deviceProjection: await service.getEvidenceEffectiveDeviceAttestationProjection(
          device.id,
          organizationId,
          offlineReceivedAt,
        ),
        registrations: [offlineEvidence.evidence],
      },
    );
    assert.equal(offlineBundle.batch.batchState, "reconciled");
    assert.deepEqual(offlineBundle.batch.issueCodes, []);
    assert.deepEqual(
      await e4Repository.commitOfflineBundle(
        offlineBundle.batch,
        offlineBundle.items,
        "e4-offline-bundle-commit",
      ),
      offlineBundle,
    );
    assert.deepEqual(
      await e4Repository.commitOfflineBundle(
        offlineBundle.batch,
        offlineBundle.items,
        "e4-offline-bundle-commit",
      ),
      offlineBundle,
    );
    await assert.rejects(
      e4Repository.commitOfflineBundle(
        { ...offlineBundle.batch, batchState: "needs_review" },
        offlineBundle.items,
        "e4-offline-bundle-commit",
      ),
      /E4_OFFLINE_IDEMPOTENCY_CONFLICT/,
    );

    const mobileBindingIdempotencyKey = "mobile-sync-binding-command-0001";
    const mobileClientRecordId = `cp_evidence_draft_${"1".repeat(32)}`;
    const mobileClientBatchId = mobileEvidenceClientBatchId(
      mobileClientRecordId,
      mobileBindingIdempotencyKey,
    );
    const mobileSyncCapture = {
      evidenceType: "restoration" as const,
      projectId,
      observedAt: "2026-07-13T00:14:47.000Z",
      latitude: 22.3193,
      longitude: 114.1694,
      gpsAccuracyMeters: 6,
      mediaHash: hashJson({ kind: "mobile-sync-pglite-media" }),
      deviceFingerprintHash: fingerprintHash,
      exifHash: null,
      notesHash: hashJson({ kind: "mobile-sync-pglite-note" }),
    };
    const mobileSync = new CanopyProofMobileEvidenceSyncAuthorityService(
      service,
      e4Repository,
      () => new Date("2026-07-13T00:14:50.000Z"),
    );
    const mobileActor = { id: subjectId, role: "community" as const, organizationId };
    const mobileBindingRequest = {
      schemaVersion: "canopyproof.mobile-evidence-binding-request/v1" as const,
      clientRecordId: mobileClientRecordId,
      clientBatchId: mobileClientBatchId,
      syncPayloadHash: mobileEvidenceSyncPayloadHash(mobileSyncCapture),
      capture: mobileSyncCapture,
      consentReceiptId: consent.id,
      deviceAttestationId: device.id,
      queuedAt: "2026-07-13T00:14:49.000Z",
    };
    const mobileBinding = await mobileSync.bindDraft(
      mobileBindingRequest,
      mobileActor,
      mobileBindingIdempotencyKey,
    );
    assert.equal(mobileBinding.rawNotesRetained, false);
    assert.equal(mobileBinding.finalVerification, false);
    assert.equal(mobileBinding.binding.clientBatchId, mobileClientBatchId);

    const mobileBatchRequest = {
      schemaVersion: "canopyproof.mobile-evidence-batch-request/v1" as const,
      clientBatchId: mobileClientBatchId,
      projectId,
      consentReceiptId: consent.id,
      deviceAttestationId: device.id,
      connectivity: "offline" as const,
      deviceClockStartedAt: "2026-07-13T00:14:47.000Z",
      deviceClockEndedAt: "2026-07-13T00:14:49.000Z",
      bindings: [mobileBinding.binding],
    };
    const mobileBatch = await mobileSync.commitBatch(
      mobileBatchRequest,
      mobileActor,
      "mobile-sync-batch-command-0001",
    );
    const mobileReplay = await mobileSync.commitBatch(
      mobileBatchRequest,
      mobileActor,
      "mobile-sync-batch-command-0001",
    );
    const mobileRecovery = await mobileSync.recoverBatch(
      {
        schemaVersion: "canopyproof.mobile-evidence-recovery-request/v1",
        clientBatchId: mobileClientBatchId,
        projectId,
        deviceAttestationId: device.id,
      },
      mobileActor,
    );
    assert.equal(mobileBatch.batchState, "reconciled");
    assert.equal(mobileBatch.recovered, false);
    assert.equal(mobileReplay.recovered, true);
    assert.equal(mobileRecovery.recovered, true);
    assert.deepEqual(mobileReplay.acknowledgements, mobileBatch.acknowledgements);
    assert.deepEqual(mobileRecovery.acknowledgements, mobileBatch.acknowledgements);
    assert.equal(
      (await e4Repository.loadOfflineAuthoritySnapshot(organizationId, device.id)).batches.length,
      2,
    );

    const communityDomain = CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(
      await e4Repository.loadCommunityAuthoritySnapshot(organizationId, offlineEvidence.evidence.id),
    );
    const communityFact = communityDomain.recordAttestation(
      {
        stance: "challenge",
        relationship: "field_observer",
        observationBasis: "direct_observation",
        conflictOfInterestDeclared: false,
        noteHash: hashJson({
          kind: "canopyproof-community-note-v1",
          note: "The visible plot boundary requires independent reconciliation.",
        }),
        confidenceScore: 72,
        reasonCodes: ["plot_boundary_needs_review"],
        observedAt: "2026-07-13T00:14:47.000Z",
        createdAt: "2026-07-13T00:14:48.000Z",
      },
      {
        actor: custodyActorFromVerification(assignmentBundle.assignment.reviewer),
        evidence: offlineEvidence.evidence,
      },
    );
    assert.equal(communityFact.attestationState, "review_required");
    assert.equal(JSON.stringify(communityFact).includes("visible plot boundary"), false);
    assert.deepEqual(
      await e4Repository.commitCommunityAttestation(
        communityFact,
        "e4-community-attestation-commit",
      ),
      communityFact,
    );
    assert.deepEqual(
      await e4Repository.commitCommunityAttestation(
        communityFact,
        "e4-community-attestation-commit",
      ),
      communityFact,
    );
    await assert.rejects(
      e4Repository.commitCommunityAttestation(
        { ...communityFact, confidenceScore: 73 },
        "e4-community-attestation-commit",
      ),
      /E4_COMMUNITY_IDEMPOTENCY_CONFLICT/,
    );
    const communityProjection = await e4Repository.projectCommunitySignal(
      organizationId,
      offlineEvidence.evidence.id,
    );
    assert.equal(communityProjection.state, "review_required");
    assert.equal(communityProjection.advisoryOnly, true);
    assert.equal(communityProjection.finalVerificationChanged, false);

    const restartedE4 = new PrismaCanopyProofEvidenceOfflineCommunityRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(
      await restartedE4.getOfflineBundle(organizationId, device.id, offlineBundle.batch.id),
      offlineBundle,
    );
    assert.deepEqual(
      await restartedE4.getCommunityAttestation(
        organizationId,
        offlineEvidence.evidence.id,
        communityFact.id,
      ),
      communityFact,
    );
    await assert.rejects(
      restartedE4.getOfflineBundle("cp_media_other_org", device.id, offlineBundle.batch.id),
      /ORGANIZATION_SCOPE_MISMATCH/,
    );
    await assert.rejects(
      restartedE4.getCommunityAttestation(
        "cp_media_other_org",
        offlineEvidence.evidence.id,
        communityFact.id,
      ),
      /ORGANIZATION_SCOPE_MISMATCH/,
    );

    const e4Parity = await queryE3b<{
      batch_hash: boolean;
      batch_root: boolean;
      item_hash: boolean;
      item_root: boolean;
      community_command: boolean;
      community_hash: boolean;
      community_root: boolean;
    }>(
      db,
      organizationId,
      `SELECT
         batch.batch_hash = evidence.e4_offline_batch_hash(batch.fact_record) AS batch_hash,
         batch.batch_root = evidence.e4_offline_batch_root(batch.fact_record) AS batch_root,
         item.item_hash = evidence.e4_offline_item_hash(item.fact_record) AS item_hash,
         item.item_root = evidence.e4_offline_item_root(item.fact_record) AS item_root,
         community.command_hash = evidence.e4_community_command_hash(community.fact_record) AS community_command,
         community.attestation_hash = evidence.e4_community_hash(community.fact_record) AS community_hash,
         community.attestation_root = evidence.e4_community_root(community.fact_record) AS community_root
       FROM evidence.offline_sync_batch_facts batch
       JOIN evidence.offline_sync_item_facts item ON item.batch_id = batch.id
       JOIN evidence.community_attestation_facts community ON community.evidence_id = item.evidence_id
       WHERE batch.id = $1`,
      [offlineBundle.batch.id],
    );
    assert.deepEqual(e4Parity, [{
      batch_hash: true,
      batch_root: true,
      item_hash: true,
      item_root: true,
      community_command: true,
      community_hash: true,
      community_root: true,
    }]);
    const rogueCommunityDomain = CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(
      await restartedE4.loadCommunityAuthoritySnapshot(organizationId, offlineEvidence.evidence.id),
    );
    const rogueCommunityFact = rogueCommunityDomain.recordAttestation(
      {
        stance: "support",
        relationship: "resident",
        observationBasis: "local_knowledge",
        conflictOfInterestDeclared: false,
        noteHash: hashJson({ kind: "canopyproof-e4-rogue-note-v1" }),
        confidenceScore: 40,
        reasonCodes: [],
        observedAt: "2026-07-13T00:14:49.000Z",
        createdAt: "2026-07-13T00:14:50.000Z",
      },
      {
        actor: unregisteredCustodyActor(organizationId),
        evidence: offlineEvidence.evidence,
      },
    );
    await assert.rejects(
      restartedE4.commitCommunityAttestation(
        rogueCommunityFact,
        "e4-community-unregistered-actor",
      ),
      /foreign key/i,
    );
    const e4Counts = await queryE3b<{
      batches: number;
      items: number;
      attestations: number;
      semantic_events: number;
      command_receipts: number;
      database_events: number;
    }>(
      db,
      organizationId,
      `SELECT
         (SELECT count(*)::int FROM evidence.offline_sync_batch_facts) AS batches,
         (SELECT count(*)::int FROM evidence.offline_sync_item_facts) AS items,
         (SELECT count(*)::int FROM evidence.community_attestation_facts) AS attestations,
         (SELECT count(*)::int FROM audit.domain_events
          WHERE stream_id IN ('evidence-offline-device:' || $1, 'evidence-community:' || $2)) AS semantic_events,
         (SELECT count(*)::int FROM audit.command_receipts
          WHERE operation IN ('evidence.offline-sync-bundle.commit', 'evidence.community-attestation.commit')) AS command_receipts,
         (SELECT count(*)::int FROM audit.event_log
          WHERE table_name IN ('offline_sync_batch_facts', 'offline_sync_item_facts',
            'community_attestation_facts')) AS database_events`,
      [device.id, offlineEvidence.evidence.id],
    );
    assert.deepEqual(e4Counts, [{
      batches: 2,
      items: 2,
      attestations: 1,
      semantic_events: 3,
      command_receipts: 3,
      database_events: 5,
    }]);
    await assertE3bAppendOnly(
      db,
      organizationId,
      subjectId,
      "UPDATE evidence.offline_sync_batch_facts SET received_at = received_at WHERE id = $1",
      offlineBundle.batch.id,
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      subjectId,
      "DELETE FROM evidence.offline_sync_item_facts WHERE id = $1",
      offlineBundle.items[0]!.id,
    );
    await assertE3bAppendOnly(
      db,
      organizationId,
      reviewerId,
      "UPDATE evidence.community_attestation_facts SET created_at = created_at WHERE id = $1",
      communityFact.id,
    );
    await assertTriggerCatalog(db, "evidence.offline_sync_batch_facts", [
      "evidence_e4_offline_batch_audit",
      "evidence_e4_offline_batch_validate",
      "evidence_e4_offline_bundle_complete",
      "offline_sync_batch_facts_append_only",
    ]);
    await assertTriggerCatalog(db, "evidence.offline_sync_item_facts", [
      "evidence_e4_offline_item_audit",
      "evidence_e4_offline_item_validate",
      "offline_sync_item_facts_append_only",
    ]);
    await assertTriggerCatalog(db, "evidence.community_attestation_facts", [
      "community_attestation_facts_append_only",
      "evidence_e4_community_audit",
      "evidence_e4_community_validate",
    ]);
    await assert.rejects(db.exec(e4Rollback), /CANOPYPROOF_E4_ROLLBACK_REFUSED/);

    await service.revokeEvidenceConsentReceipt(
      consent.id,
      {
        reason: "The contributor withdrew media processing permission after review.",
        revokedAt: "2026-07-13T00:15:00.000Z",
      },
      organizationId,
      subjectId,
      "community",
      "media-consent-revoke",
    );
    await assert.rejects(
      e3dRepository.assertMetadataExtractionDispatchAuthorized(
        e3dPending,
        "2026-07-13T00:15:00.001Z",
      ),
      /CANOPYPROOF_E3D_DISPATCH_AUTHORITY_REVOKED/,
    );
    assert.deepEqual(
      await mobileSync.bindDraft(
        mobileBindingRequest,
        mobileActor,
        mobileBindingIdempotencyKey,
      ),
      mobileBinding,
    );
    const revokedBindingIdempotencyKey = "mobile-sync-binding-command-0002";
    const revokedClientRecordId = `cp_evidence_draft_${"2".repeat(32)}`;
    await assert.rejects(
      mobileSync.bindDraft(
        {
          ...mobileBindingRequest,
          clientRecordId: revokedClientRecordId,
          clientBatchId: mobileEvidenceClientBatchId(
            revokedClientRecordId,
            revokedBindingIdempotencyKey,
          ),
        },
        mobileActor,
        revokedBindingIdempotencyKey,
      ),
      /CANOPYPROOF_MOBILE_SYNC_CONSENT_INACTIVE/,
    );
    const mobileAuthorityCounts = await queryE3b<{
      command_receipts: number;
      evidence_registrations: number;
      subject_fence_revision: number;
    }>(
      db,
      organizationId,
      `SELECT
         (SELECT count(*)::int FROM audit.command_receipts
          WHERE operation = 'evidence.mobile-binding.create') AS command_receipts,
         (SELECT count(*)::int FROM evidence.evidence_objects
          WHERE offline_sync_id = $1) AS evidence_registrations,
         (SELECT revision::int FROM audit.authority_fences
          WHERE authority_key = $2) AS subject_fence_revision`,
      [mobileClientBatchId, `evidence-custody:${subjectId}`],
    );
    assert.deepEqual(mobileAuthorityCounts, [{
      command_receipts: 1,
      evidence_registrations: 1,
      subject_fence_revision: 4,
    }]);
    assert.equal(
      (await service.getEvidenceMediaObjectProjection(
        objectBundle.object.id,
        organizationId,
        "2026-07-13T00:15:30.000Z",
      )).state,
      "quarantined",
    );

    const restarted = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(await restarted.getEvidenceMediaUploadIntent(intent.id, organizationId), intent);
    assert.deepEqual(await restarted.getEvidenceMediaObject(objectBundle.object.id, organizationId), objectBundle.object);
    assert.deepEqual(
      await restarted.getEvidenceMediaReviewTask(taskBundle.task.id, organizationId),
      taskBundle.task,
    );
    assert.deepEqual(
      await restarted.getEvidenceMediaReviewTaskProjection(taskBundle.task.id, organizationId),
      taskProjection,
    );
    assert.equal(
      (await restarted.getEvidenceMediaObjectProjection(
        objectBundle.object.id,
        organizationId,
        "2026-07-13T00:15:30.000Z",
      )).state,
      "quarantined",
    );

    const adapterVerifications = {
      provider: objectBundle.verification,
      scanner: scanBundle.verification,
    };
    assert.equal(adapterVerifications.provider.providerReceiptHash, providerReceiptHash);
    assert.equal(adapterVerifications.scanner.scannerReceiptHash, scannerReceiptHash);

    const adapterEvents = await queryE3b<{
      sequence_no: number;
      entity_type: string;
      previous_root: string;
    }>(
      db,
      organizationId,
      `SELECT sequence_no::int, entity_type, previous_root
       FROM audit.domain_events
       WHERE stream_id = 'evidence-media-adapter:' || $1
       ORDER BY sequence_no`,
      [evidenceId],
    );
    assert.deepEqual(adapterEvents, [
      {
        sequence_no: 1,
        entity_type: "media_provider_receipt_verification",
        previous_root: adapterVerifications.provider.auditEvent.previousRoot,
      },
      {
        sequence_no: 2,
        entity_type: "media_scanner_receipt_verification",
        previous_root: adapterVerifications.provider.auditEvent.eventRoot,
      },
    ]);
    const rawSignatureColumns = await db.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'evidence'
         AND table_name IN ('media_provider_receipt_verification_facts',
           'media_scanner_receipt_verification_facts')
         AND column_name IN ('signature', 'raw_signature', 'upload_url', 'signed_url')`,
    );
    assert.deepEqual(rawSignatureColumns.rows, []);

    const adapterParity = await queryE3b<{
      provider_receipt_hash: boolean;
      provider_verification_root: boolean;
      provider_command_hash: boolean;
      provider_fact_root: boolean;
      scanner_receipt_hash: boolean;
      scanner_verification_root: boolean;
      scanner_command_hash: boolean;
      scanner_fact_root: boolean;
    }>(
      db,
      organizationId,
      `SELECT
         provider.provider_receipt_hash = evidence.e2a_provider_receipt_hash(provider)
           AS provider_receipt_hash,
         provider.provider_verification_root = evidence.e2a_provider_verification_root(provider)
           AS provider_verification_root,
         provider.command_hash = evidence.e2a_provider_command_hash(provider)
           AS provider_command_hash,
         provider.fact_root = evidence.e2a_provider_fact_root(provider)
           AS provider_fact_root,
         scanner.scanner_receipt_hash = evidence.e2a_scanner_receipt_hash(scanner)
           AS scanner_receipt_hash,
         scanner.scanner_verification_root = evidence.e2a_scanner_verification_root(scanner)
           AS scanner_verification_root,
         scanner.command_hash = evidence.e2a_scanner_command_hash(scanner)
           AS scanner_command_hash,
         scanner.fact_root = evidence.e2a_scanner_fact_root(scanner)
           AS scanner_fact_root
       FROM evidence.media_provider_receipt_verification_facts provider
       JOIN evidence.media_scanner_receipt_verification_facts scanner
         ON scanner.object_id = provider.object_id
       WHERE provider.object_id = $1`,
      [objectBundle.object.id],
    );
    assert.deepEqual(adapterParity, [{
      provider_receipt_hash: true,
      provider_verification_root: true,
      provider_command_hash: true,
      provider_fact_root: true,
      scanner_receipt_hash: true,
      scanner_verification_root: true,
      scanner_command_hash: true,
      scanner_fact_root: true,
    }]);

    const adapterProjection = await queryE3b<{
      state: string;
      provider_verification_root: string;
      scanner_verification_root: string;
      not_availability_decision: boolean;
    }>(
      db,
      organizationId,
      `SELECT state, provider_verification_root, scanner_verification_root,
              (safety->>'notAvailabilityDecision')::boolean AS not_availability_decision
       FROM evidence.media_adapter_trust_projection($1, $2::timestamptz)`,
      [objectBundle.object.id, "2026-07-13T00:18:00.000Z"],
    );
    assert.deepEqual(adapterProjection, [{
      state: "verified_receipts",
      provider_verification_root: adapterVerifications.provider.providerVerificationRoot,
      scanner_verification_root: adapterVerifications.scanner.scannerVerificationRoot,
      not_availability_decision: true,
    }]);
    await assertTenantPolicy(
      db,
      "media_provider_receipt_verification_facts",
      "evidence_e2a_provider_tenant",
    );
    await assertTenantPolicy(
      db,
      "media_scanner_receipt_verification_facts",
      "evidence_e2a_scanner_tenant",
    );
    await assertE2aAppendOnly(
      db,
      organizationId,
      agentId,
      `UPDATE evidence.media_provider_receipt_verification_facts
       SET verified_at = verified_at WHERE id = $1`,
      adapterVerifications.provider.id,
    );
    await assertE2aAppendOnly(
      db,
      organizationId,
      agentId,
      "DELETE FROM evidence.media_scanner_receipt_verification_facts WHERE id = $1",
      adapterVerifications.scanner.id,
    );
    await assertTriggerCatalog(db, "evidence.media_provider_receipt_verification_facts", [
      "evidence_e2a_provider_append_only",
      "evidence_e2a_provider_audit",
      "evidence_e2a_provider_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_scanner_receipt_verification_facts", [
      "evidence_e2a_scanner_append_only",
      "evidence_e2a_scanner_audit",
      "evidence_e2a_scanner_validate",
    ]);
    await assert.rejects(db.exec(e2aRollback), /CANOPYPROOF_E2A_ROLLBACK_REFUSED/);

    await assertTriggerCatalog(db, "evidence.media_upload_intent_facts", [
      "evidence_media_upload_intent_facts_audit",
      "evidence_media_upload_intent_facts_no_delete",
      "evidence_media_upload_intent_facts_no_update",
      "evidence_media_upload_intent_facts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_object_facts", [
      "evidence_media_object_facts_audit",
      "evidence_media_object_facts_no_delete",
      "evidence_media_object_facts_no_update",
      "evidence_media_object_facts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_scan_result_facts", [
      "evidence_media_scan_result_facts_audit",
      "evidence_media_scan_result_facts_no_delete",
      "evidence_media_scan_result_facts_no_update",
      "evidence_media_scan_result_facts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_review_task_facts", [
      "evidence_media_review_task_facts_audit",
      "evidence_media_review_task_facts_no_delete",
      "evidence_media_review_task_facts_no_update",
      "evidence_media_review_task_facts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_review_assignment_facts", [
      "evidence_media_review_assignment_facts_audit",
      "evidence_media_review_assignment_facts_no_delete",
      "evidence_media_review_assignment_facts_no_update",
      "evidence_media_review_assignment_facts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_review_decision_facts", [
      "evidence_media_review_decision_facts_audit",
      "evidence_media_review_decision_facts_no_delete",
      "evidence_media_review_decision_facts_no_update",
      "evidence_media_review_decision_facts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.media_custody_event_facts", [
      "evidence_media_custody_event_facts_audit",
      "evidence_media_custody_event_facts_no_delete",
      "evidence_media_custody_event_facts_no_update",
      "evidence_media_custody_event_facts_validate",
    ]);
  } finally {
    await db.close();
  }
});

function pglitePrismaClient(db: PGlite) {
  const client = {
    async $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
      return db.transaction((transaction) => operation(pgliteTransactionClient(transaction)));
    },
  };
  return client as unknown as PrismaClient;
}

function pgliteTransactionClient(transaction: Transaction) {
  return {
    async $queryRaw<T = unknown[]>(query: Prisma.Sql): Promise<T> {
      const result = await transaction.query(query.text, query.values);
      return result.rows as T;
    },
    async $executeRaw(query: Prisma.Sql) {
      const result = await transaction.query(query.text, query.values);
      return result.affectedRows ?? 0;
    },
  } as unknown as Prisma.TransactionClient;
}

async function insertBootstrapOwner(db: PGlite, actorId: string) {
  const createdAt = "2026-07-13T00:00:00.000Z";
  const subjectHash = hashJson({ kind: "canopyproof-evidence-media-bootstrap-v1", actorId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["owner"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "PGlite evidence media owner provisioned through an explicit bootstrap transaction.",
  })[0]!;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES ($1, 'human', 'Evidence Media Owner', $1, ARRAY['owner']::text[],
        'verified', 100, ARRAY[]::text[], $2, $3, $3)`,
      [actorId, subjectHash, createdAt],
    );
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        event.id,
        actorId,
        event.action,
        event.actor,
        event.entityType,
        event.entityId,
        event.previousRoot,
        event.payloadHash,
        event.eventRoot,
        event.createdAt,
        event.rationale,
      ],
    );
  });
}

async function insertMediaAgentProfile(db: PGlite, actorId: string, agentId: string) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.agent_profiles (
        id, agent_type, layer, capabilities, allowed_actions,
        human_review_required, final_authority, status, registry_hash
      ) VALUES ($1, 'evidence', 'Evidence',
        ARRAY['device_attestation_receipt', 'malware_scan_result', 'metadata_extraction_receipt', 'object_storage_receipt',
          'retention_execution_receipt', 'verified_metadata_extraction_receipt']::text[],
        ARRAY['verify_device_attestation_receipt', 'record_malware_scan', 'record_metadata_extraction', 'record_object_receipt',
          'record_retention_execution']::text[],
        true, false, 'active', $2)`,
      [agentId, hashJson({ kind: "canopyproof-evidence-media-agent-registry-v1", agentId })],
    );
  });
}

async function signDeviceAttestationReceipt(
  request: CanopyProofDeviceAttestationProviderRequest,
  policy: Readonly<{
    verifierId: string;
    verifierVersion: string;
    providerPolicyRoot: string;
  }>,
  signerKeyId: string,
  privateKey: CryptoKey,
  expiresAt: string,
): Promise<CanopyProofDeviceAttestationProviderReceipt> {
  const base = {
    attestationId: request.attestationId,
    attestationRoot: request.attestationRoot,
    organizationId: request.organizationId,
    subjectId: request.subjectId,
    subjectRoot: request.subjectRoot,
    consentReceiptId: request.consentReceiptId,
    consentReceiptRoot: request.consentReceiptRoot,
    deviceFingerprintHash: request.deviceFingerprintHash,
    attestationType: request.attestationType,
    provider: request.provider,
    providerKeyId: request.providerKeyId,
    providerReceiptHash: request.providerReceiptHash,
    publicKeyHash: request.publicKeyHash,
    attestationHash: request.attestationHash,
    challengeHash: request.challengeHash,
    verifierId: policy.verifierId,
    verifierVersion: policy.verifierVersion,
    providerPolicyRoot: policy.providerPolicyRoot,
    result: "verified" as const,
    reasonCodes: [] as readonly string[],
    verifiedAt: request.requestedAt,
    expiresAt,
    signerKeyId,
    signatureAlgorithm: "ed25519" as const,
  };
  const receiptHash = hashJson({
    kind: "canopyproof-device-attestation-provider-receipt-v1",
    ...canopyProofDeviceAttestationReceiptSeed(base),
  });
  const signature = Buffer.from(await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(receiptHash),
  )).toString("base64url");
  return { ...base, signature, receiptHash };
}

async function insertProjectPolicy(db: PGlite, actorId: string) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO governance.policies (
        id, title, applies_to, required_approvals, allowed_reviewer_roles,
        human_authority_required, conflict_disclosure_required,
        claim_boundary_enforced, policy_hash, created_at
      ) VALUES ('cp_media_pglite_project_policy', 'Media custody project policy',
        ARRAY['project']::text[], 1, ARRAY['admin']::text[],
        true, true, true, $1, '2026-07-13T00:07:00.000Z')`,
      [hashJson({ kind: "canopyproof-evidence-media-project-policy-v1" })],
    );
  });
}

function mediaAgentForCapability(
  agent: CanopyProofEvidenceMediaAgentSnapshot,
  capability: CanopyProofEvidenceMediaAgentCapability,
): CanopyProofEvidenceMediaAgentSnapshot {
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
    capability,
    agentRegistryHash: agent.agentRegistryHash,
  } as const;
  return { ...seed, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(seed) };
}

function custodyActorFromVerification(
  actor: CanopyProofVerificationActorSnapshot,
): CanopyProofEvidenceCustodyActorSnapshot {
  if (
    actor.participantType !== "human" ||
    !["owner", "admin", "verifier", "researcher", "community"].includes(actor.role)
  ) {
    throw new Error("CanopyProof E4 test actor is not a custody-eligible human.");
  }
  const role = actor.role as CanopyProofEvidenceCustodyActorSnapshot["role"];
  const seed = {
    id: actor.id,
    participantType: "human" as const,
    role,
    verificationStatus: actor.verificationStatus,
    organizationId: actor.organizationId,
    organizationVerificationStatus: actor.organizationVerificationStatus,
    participantRoot: actor.participantRoot,
    organizationRoot: actor.organizationRoot,
    membershipId: actor.membershipId,
    membershipStatus: actor.membershipStatus,
    membershipRoot: actor.membershipRoot,
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function unregisteredCustodyActor(
  organizationId: string,
): CanopyProofEvidenceCustodyActorSnapshot {
  const id = "cp_media_e4_unregistered_attester";
  const seed = {
    id,
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "canopyproof-e4-unregistered-participant-v1", id }),
    organizationRoot: hashJson({
      kind: "canopyproof-e4-unregistered-organization-v1",
      organizationId,
    }),
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "canopyproof-e4-unregistered-membership-v1", id }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

async function queryE3b<T extends Record<string, unknown>>(
  db: PGlite,
  organizationId: string,
  statement: string,
  parameters: readonly unknown[],
) {
  return db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await transaction.query<T>(statement, [...parameters]);
    return result.rows;
  });
}

async function assertE3bAppendOnly(
  db: PGlite,
  organizationId: string,
  actorId: string,
  statement: string,
  id: string,
) {
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await transaction.query(statement, [id]);
    }),
    /APPEND_ONLY_VIOLATION/,
  );
}

async function assertE2aAppendOnly(
  db: PGlite,
  organizationId: string,
  actorId: string,
  statement: string,
  id: string,
) {
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await transaction.query(statement, [id]);
    }),
    /append-only/,
  );
}

async function assertAppendOnly(db: PGlite, actorId: string, statement: string, id: string) {
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await transaction.query(statement, [id]);
    }),
    /append-only/,
  );
}

async function assertTriggerCatalog(db: PGlite, relation: string, expected: readonly string[]) {
  const rows = await db.query<{ tgname: string }>(
    `SELECT tgname
     FROM pg_trigger
     WHERE tgrelid = $1::regclass
       AND NOT tgisinternal
     ORDER BY tgname`,
    [relation],
  );
  assert.deepEqual(rows.rows.map((row) => row.tgname), expected);
}

async function assertTenantPolicy(db: PGlite, tableName: string, policyName: string) {
  const rows = await db.query<{
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    policy_name: string;
    using_expression: string;
    check_expression: string;
  }>(
    `SELECT relation.relrowsecurity,
            relation.relforcerowsecurity,
            policy.polname AS policy_name,
            pg_get_expr(policy.polqual, policy.polrelid) AS using_expression,
            pg_get_expr(policy.polwithcheck, policy.polrelid) AS check_expression
     FROM pg_class relation
     JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     JOIN pg_policy policy ON policy.polrelid = relation.oid
     WHERE namespace.nspname = 'evidence'
       AND relation.relname = $1
       AND policy.polname = $2`,
    [tableName, policyName],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]!.relrowsecurity, true);
  assert.equal(rows.rows[0]!.relforcerowsecurity, true);
  assert.match(rows.rows[0]!.using_expression, /organization_id.*app\.organization_id/);
  assert.match(rows.rows[0]!.check_expression, /organization_id.*app\.organization_id/);
}
