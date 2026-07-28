import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofEvidenceCustodyAuthorityService,
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceCustodyActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  buildCanopyProofEvidenceMetadataExtractionVerificationFact,
  isCanopyProofDurableMetadataExtractionReceipt,
  minimizeCanopyProofMetadataExtractionReceipt,
  projectCanopyProofEvidenceMetadataExtraction,
  type CanopyProofDurableMetadataExtractionReceipt,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-adapter-authority.js";
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
import {
  assertCanopyProofMetadataExtractionRequestFact,
  buildCanopyProofMetadataExtractionRequestFact,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-orchestration-authority.js";
import {
  CanopyProofMetadataExtractionOrchestrator,
  type CanopyProofMetadataExtractionOrchestrationDurablePort,
  type CanopyProofMetadataExtractionResult,
  type CanopyProofPreparedMetadataExtraction,
} from "../../services/api/src/domain/canopyproof/evidence-metadata-orchestrator.js";
import { FixedEndpointCanopyProofMetadataExtractorPort } from
  "../../services/api/src/domain/canopyproof/fixed-http-metadata-extractor-provider.js";
import {
  canopyProofMetadataExtractionReceiptSeed,
  DisabledCanopyProofMetadataExtractorAdapter,
  isCanopyProofVerifiedMetadataExtractionReceipt,
  PolicyEnforcedCanopyProofMetadataExtractorAdapter,
  WebCryptoEd25519MetadataExtractorSignatureVerifier,
  type CanopyProofMetadataExtractionReceipt,
  type CanopyProofMetadataExtractorAdapterConfiguration,
} from "../../services/api/src/domain/canopyproof/metadata-extractor-adapter.js";
import { buildEffectiveMediaFixture } from "../helpers/canopyproof-effective-media-fixture.js";

const organizationId = "cp_e3c_org";
const projectId = "cp_e3c_project";
const evidenceId = "cp_e3c_evidence";
const extractedAt = "2026-07-17T10:03:00.000Z";
const signerKeyId = "cp-e3c-extractor-ed25519-v1";

function contributor(): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id: "cp_e3c_contributor",
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e3c-contributor" }),
    organizationRoot: hashJson({ kind: "cp-e3c-organization" }),
    membershipId: "cp_e3c_contributor_membership",
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "cp-e3c-contributor-membership" }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function agent(capability: CanopyProofEvidenceMediaAgentCapability): CanopyProofEvidenceMediaAgentSnapshot {
  const id = `cp_e3c_agent_${capability}`;
  const seed = {
    id,
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e3c-agent", id }),
    organizationRoot: hashJson({ kind: "cp-e3c-organization" }),
    agentType: "evidence" as const,
    agentStatus: "active" as const,
    capability,
    agentRegistryHash: hashJson({ kind: "cp-e3c-agent-registry", id, capability }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(seed) };
}

function createFixture(
  options: Readonly<{
    privacyMode?: "precise" | "masked" | "restricted";
    contentType?: "image/jpeg" | "image/png" | "image/webp" | "application/json";
  }> = {},
) {
  const subject = contributor();
  const custody = new CanopyProofEvidenceCustodyAuthorityService();
  const capturedAt = "2026-07-17T10:00:00.000Z";
  const consent = custody.recordConsentReceipt(
    {
      subjectId: subject.id,
      deviceFingerprintHash: hashJson({ kind: "cp-e3c-device-fingerprint" }),
      purposes: ["evidence_collection", "geolocation", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: options.privacyMode ?? "restricted",
      policyVersion: "cp-e3c-consent-v1",
      evidenceHash: hashJson({ kind: "cp-e3c-consent-evidence" }),
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
      deviceFingerprintHash: hashJson({ kind: "cp-e3c-device-fingerprint" }),
      attestationType: "secure_enclave",
      provider: "apple_app_attest",
      providerKeyId: "cp-e3c-device-key-v1",
      providerReceiptHash: hashJson({ kind: "cp-e3c-device-receipt" }),
      providerVerificationState: "verified",
      publicKeyHash: hashJson({ kind: "cp-e3c-public-key" }),
      attestationHash: hashJson({ kind: "cp-e3c-attestation" }),
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
      contentHash: hashJson({ kind: "cp-e3c-media" }),
      contentType: options.contentType ?? "image/jpeg",
      byteLength: 1_048_576,
      capturedAt,
    },
    {
      actor: subject,
      project: {
        id: projectId,
        organizationId,
        status: "active",
        projectRoot: hashJson({ kind: "cp-e3c-project" }),
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
      providerNamespace: "cp-e3c-media",
      objectVersion: "cp-e3c-object-v1",
      contentHash: intent.contentHash,
      byteLength: intent.byteLength,
      etagHash: hashJson({ kind: "cp-e3c-etag" }),
      providerReceiptHash: hashJson({ kind: "cp-e3c-object-receipt" }),
      providerVerificationState: "modeled_only",
      encryptionMode: "r2_managed",
      objectLockMode: "governance",
      retainUntil: "2026-07-24T00:00:00.000Z",
      storedAt: "2026-07-17T10:01:00.000Z",
    },
    agent("object_storage_receipt"),
  ).object;
  const scan = media.recordScanResult(
    {
      objectId: object.id,
      scannerName: "clamav-isolated",
      scannerVersion: "1.4.3",
      scannerImageDigest: hashJson({ kind: "cp-e3c-scanner" }),
      signatureDatabaseVersion: "daily-2026-07-17",
      verdict: "clean",
      findingHashes: [],
      providerReceiptHash: hashJson({ kind: "cp-e3c-scan-receipt" }),
      providerVerificationState: "modeled_only",
      scannedAt: "2026-07-17T10:02:00.000Z",
    },
    agent("malware_scan_result"),
  );
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
    registeredGpsHash: hashJson({ kind: "cp-e3c-gps" }),
    agent: agent("metadata_extraction_receipt"),
  };
  return { custody, media, subject, consent, device, intent, object, extractionAuthority };
}

function adapterConfiguration(): CanopyProofMetadataExtractorAdapterConfiguration {
  return {
    extractorId: "cp-e3c-extractor",
    extractorName: "exiftool-isolated",
    extractorVersion: "13.30",
    extractorImageDigest: hashJson({ kind: "cp-e3c-extractor-image" }),
    metadataSchemaVersion: "canopyproof.metadata.v1",
    extractorPolicyRoot: hashJson({ kind: "cp-e3c-extractor-policy" }),
    allowedSignerKeyIds: [signerKeyId],
  };
}

async function signingFixture() {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return { keyPair, publicKey };
}

async function signedReceipt(
  authority: CanopyProofEvidenceMetadataExtractionAuthority,
  privateKey: CryptoKey,
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<CanopyProofMetadataExtractionReceipt> {
  const configuration = adapterConfiguration();
  const base = {
    objectId: authority.object.id,
    objectRoot: authority.object.objectRoot,
    storageProvider: authority.object.storageProvider,
    providerNamespace: authority.object.providerNamespace,
    objectKey: authority.object.objectKey,
    objectVersion: authority.object.objectVersion,
    storedObjectProviderReceiptHash: authority.object.providerReceiptHash,
    mediaProjectionRoot: authority.mediaProjection.projectionRoot,
    consentReceiptId: authority.consent.id,
    consentReceiptRoot: authority.consent.receiptRoot,
    consentProjectionRoot: authority.consentProjection.projectionRoot,
    deviceAttestationId: authority.device.id,
    deviceAttestationRoot: authority.device.attestationRoot,
    deviceProjectionRoot: authority.deviceProjection.projectionRoot,
    registeredGpsHash: authority.registeredGpsHash,
    privacyMode: authority.consent.privacyMode,
    extractorId: configuration.extractorId,
    extractorName: configuration.extractorName,
    extractorVersion: configuration.extractorVersion,
    extractorImageDigest: configuration.extractorImageDigest,
    metadataSchemaVersion: configuration.metadataSchemaVersion,
    exifHash: hashJson({ kind: "cp-e3c-exif" }),
    gpsHash: authority.registeredGpsHash,
    metadataOutputRoot: hashJson({ kind: "cp-e3c-output" }),
    locationDisclosure: "none" as const,
    accuracyBand: "under_10m" as const,
    clockSkewBand: "under_1m" as const,
    observedAt: "2026-07-17T10:00:00.000Z",
    extractedAt,
    signerKeyId,
    signatureAlgorithm: "ed25519" as const,
    ...overrides,
  } as Omit<CanopyProofMetadataExtractionReceipt, "signature" | "receiptHash">;
  const receiptHash = hashJson({
    kind: "canopyproof-metadata-extraction-receipt-v1",
    ...canopyProofMetadataExtractionReceiptSeed(base),
  });
  const signature = Buffer.from(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      privateKey,
      new TextEncoder().encode(receiptHash),
    ),
  ).toString("base64url");
  return { ...base, signature, receiptHash };
}

function extractionInput(receipt: CanopyProofMetadataExtractionReceipt) {
  return {
    objectId: receipt.objectId,
    extractorName: receipt.extractorName,
    extractorVersion: receipt.extractorVersion,
    extractorImageDigest: receipt.extractorImageDigest,
    metadataSchemaVersion: receipt.metadataSchemaVersion,
    exifHash: receipt.exifHash,
    gpsHash: receipt.gpsHash,
    metadataOutputRoot: receipt.metadataOutputRoot,
    locationDisclosure: receipt.locationDisclosure,
    ...(receipt.generalizedLocationHash
      ? { generalizedLocationHash: receipt.generalizedLocationHash }
      : {}),
    accuracyBand: receipt.accuracyBand,
    clockSkewBand: receipt.clockSkewBand,
    providerReceiptHash: receipt.receiptHash,
    providerVerificationState: "modeled_only" as const,
    observedAt: receipt.observedAt,
    extractedAt: receipt.extractedAt,
  };
}

async function verifiedPipeline(
  options: Readonly<{ accuracyBand?: "under_10m" | "unknown" }> = {},
) {
  const fixture = createFixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey, {
    ...(options.accuracyBand ? { accuracyBand: options.accuracyBand } : {}),
  });
  const adapter = new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
    adapterConfiguration(),
    { async extractMetadata() { return receipt; } },
    new WebCryptoEd25519MetadataExtractorSignatureVerifier({ [signerKeyId]: signing.publicKey }),
  );
  const verified = await adapter.extractMetadata(fixture.extractionAuthority, {
    now: extractedAt,
    correlationId: "cp-e3c-extract-001",
  });
  const metadata = new CanopyProofEvidenceMetadataRetentionAuthorityService();
  const extraction = metadata.recordMetadataExtraction(
    extractionInput(receipt),
    fixture.extractionAuthority,
  );
  const durable = minimizeCanopyProofMetadataExtractionReceipt(verified);
  const verification = buildCanopyProofEvidenceMetadataExtractionVerificationFact({
    object: fixture.object,
    extraction,
    receipt: durable,
    verifier: agent("verified_metadata_extraction_receipt"),
    streamEvents: [],
  });
  return { ...fixture, signing, receipt, verified, durable, extraction, verification };
}

class InMemoryMetadataExtractionDurablePort
  implements CanopyProofMetadataExtractionOrchestrationDurablePort
{
  readonly timeline: string[] = [];
  dispatchAuthorized = true;
  readonly #preparedByKey = new Map<string, CanopyProofPreparedMetadataExtraction>();
  readonly #resultByRequest = new Map<string, CanopyProofMetadataExtractionResult>();

  constructor(
    private readonly authority: CanopyProofEvidenceMetadataExtractionAuthority,
  ) {}

  async prepareMetadataExtractionRequest(input: Parameters<
    CanopyProofMetadataExtractionOrchestrationDurablePort["prepareMetadataExtractionRequest"]
  >[0]) {
    this.timeline.push("request-committed");
    if (
      input.organizationId !== this.authority.object.organizationId ||
      input.objectId !== this.authority.object.id ||
      input.requesterAgentId !== this.authority.agent.id
    ) {
      throw new Error("CANOPYPROOF_TEST_E3D_AUTHORITY_SCOPE_INVALID");
    }
    const idempotencyKeyHash = hashJson({
      kind: "canopyproof-metadata-extraction-idempotency-key-v1",
      organizationId: input.organizationId,
      objectId: input.objectId,
      requesterAgentId: input.requesterAgentId,
      operation: "evidence.metadata-extraction-request.prepare",
      value: input.idempotencyKey,
    });
    const request = buildCanopyProofMetadataExtractionRequestFact({
      authority: this.authority,
      policy: input.policy,
      idempotencyKeyHash,
      streamEvents: [],
      requestedAt: input.requestedAt,
    });
    const existing = this.#preparedByKey.get(idempotencyKeyHash);
    if (existing) {
      if (existing.request.commandHash !== request.commandHash) {
        throw new Error("CANOPYPROOF_E3D_IDEMPOTENCY_CONFLICT");
      }
      return existing;
    }
    const prepared = { request, authority: this.authority };
    this.#preparedByKey.set(idempotencyKeyHash, prepared);
    return prepared;
  }

  async findMetadataExtractionResult(prepared: CanopyProofPreparedMetadataExtraction) {
    this.timeline.push("result-read");
    return this.#resultByRequest.get(prepared.request.id);
  }

  async assertMetadataExtractionDispatchAuthorized(
    prepared: CanopyProofPreparedMetadataExtraction,
    dispatchedAt: string,
  ) {
    this.timeline.push("dispatch-authorized");
    if (
      Date.parse(dispatchedAt) < Date.parse(prepared.request.requestedAt) ||
      Date.parse(dispatchedAt) >= Date.parse(prepared.request.dispatchExpiresAt)
    ) {
      throw new Error("CANOPYPROOF_E3D_DISPATCH_EXPIRED");
    }
    if (!this.dispatchAuthorized) {
      throw new Error("CANOPYPROOF_E3D_DISPATCH_AUTHORITY_REVOKED");
    }
  }

  async commitMetadataExtractionResult(input: Readonly<{
    prepared: CanopyProofPreparedMetadataExtraction;
    receipt: CanopyProofDurableMetadataExtractionReceipt;
    verifierAgentId: string;
  }>) {
    this.timeline.push("result-committed");
    const replay = this.#resultByRequest.get(input.prepared.request.id);
    if (replay) return replay;
    const metadata = new CanopyProofEvidenceMetadataRetentionAuthorityService();
    const extraction = metadata.recordMetadataExtraction(
      extractionInputFromDurableReceipt(input.receipt),
      input.prepared.authority,
    );
    const verification = buildCanopyProofEvidenceMetadataExtractionVerificationFact({
      object: input.prepared.authority.object,
      extraction,
      receipt: input.receipt,
      verifier: agent("verified_metadata_extraction_receipt"),
      streamEvents: [],
    });
    if (verification.verifierId !== input.verifierAgentId) {
      throw new Error("CANOPYPROOF_TEST_E3D_VERIFIER_SCOPE_INVALID");
    }
    const result = {
      request: input.prepared.request,
      extraction,
      verification,
      projection: projectCanopyProofEvidenceMetadataExtraction({
        object: input.prepared.authority.object,
        extraction,
        verification,
        evaluatedAt: verification.verifiedAt,
      }),
    } satisfies CanopyProofMetadataExtractionResult;
    this.#resultByRequest.set(input.prepared.request.id, result);
    return result;
  }
}

function extractionInputFromDurableReceipt(
  receipt: CanopyProofDurableMetadataExtractionReceipt,
): Parameters<CanopyProofEvidenceMetadataRetentionAuthorityService["recordMetadataExtraction"]>[0] {
  return {
    objectId: receipt.objectId,
    extractorName: receipt.extractorName,
    extractorVersion: receipt.extractorVersion,
    extractorImageDigest: receipt.extractorImageDigest,
    metadataSchemaVersion: receipt.metadataSchemaVersion,
    exifHash: receipt.exifHash,
    gpsHash: receipt.gpsHash,
    metadataOutputRoot: receipt.metadataOutputRoot,
    locationDisclosure: receipt.locationDisclosure,
    ...(receipt.generalizedLocationHash
      ? { generalizedLocationHash: receipt.generalizedLocationHash }
      : {}),
    accuracyBand: receipt.accuracyBand,
    clockSkewBand: receipt.clockSkewBand,
    providerReceiptHash: receipt.receiptHash,
    providerVerificationState: "modeled_only",
    observedAt: receipt.observedAt,
    extractedAt: receipt.extractedAt,
  };
}

test("E3d commits authorization before provider I/O and replays without a second external call", async () => {
  const fixture = createFixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey);
  const durable = new InMemoryMetadataExtractionDurablePort(fixture.extractionAuthority);
  let externalCalls = 0;
  const adapter = new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
    adapterConfiguration(),
    {
      async extractMetadata() {
        externalCalls += 1;
        durable.timeline.push("external-io");
        return receipt;
      },
    },
    new WebCryptoEd25519MetadataExtractorSignatureVerifier({
      [signerKeyId]: signing.publicKey,
    }),
  );
  const orchestrator = new CanopyProofMetadataExtractionOrchestrator(
    durable,
    adapter,
    () => extractedAt,
  );
  const command = {
    organizationId,
    objectId: fixture.object.id,
    requesterAgentId: fixture.extractionAuthority.agent.id,
    verifierAgentId: agent("verified_metadata_extraction_receipt").id,
    idempotencyKey: "cp-e3d-request-0001",
    requestedAt: extractedAt,
  } as const;

  const first = await orchestrator.extractMetadata(command);
  assert.deepEqual(durable.timeline, [
    "request-committed",
    "result-read",
    "dispatch-authorized",
    "external-io",
    "result-committed",
  ]);
  assert.equal(first.projection.state, "accepted");
  assert.equal(first.request.mediaProjectionRoot, fixture.extractionAuthority.mediaProjection.projectionRoot);
  assert.equal(first.extraction.extractionState, "needs_review");
  assert.equal(first.verification.extractionRoot, first.extraction.extractionRoot);
  assert.equal(JSON.stringify(first.request).includes(command.idempotencyKey), false);
  assert.equal(JSON.stringify(first.request).includes(receipt.signature), false);
  assert.equal(JSON.stringify(first.verification).includes(receipt.signature), false);
  assertCanopyProofMetadataExtractionRequestFact({
    authority: fixture.extractionAuthority,
    policy: adapter.getPolicyDescriptor(),
    fact: first.request,
    streamEventsBefore: [],
  });
  assert.throws(
    () => assertCanopyProofMetadataExtractionRequestFact({
      authority: fixture.extractionAuthority,
      policy: adapter.getPolicyDescriptor(),
      fact: {
        ...first.request,
        requestRoot: hashJson({ kind: "cp-e3d-tampered-request-root" }),
      },
      streamEventsBefore: [],
    }),
    /REQUEST_FACT_INVALID/,
  );

  durable.timeline.length = 0;
  const replay = await orchestrator.extractMetadata(command);
  assert.deepEqual(replay, first);
  assert.deepEqual(durable.timeline, ["request-committed", "result-read"]);
  assert.equal(externalCalls, 1);
  assert.deepEqual(orchestrator.getStatus(), {
    service: "canopyproof-metadata-extraction-orchestrator",
    routeMounted: false,
    productionActivated: false,
    requestCommittedBeforeExternalIo: true,
    currentAuthorityRecheckedBeforeExternalIo: true,
    externalCallsInsideDatabaseTransaction: false,
    rawSignaturePersisted: false,
    exactlyOnceExternalExecutionClaimed: false,
    finalProofAuthority: false,
  });
});

test("E3d preserves a durable request across provider failure and resumes deterministically", async () => {
  const fixture = createFixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey);
  const durable = new InMemoryMetadataExtractionDurablePort(fixture.extractionAuthority);
  const configuration = adapterConfiguration();
  const verifier = new WebCryptoEd25519MetadataExtractorSignatureVerifier({
    [signerKeyId]: signing.publicKey,
  });
  const failed = new CanopyProofMetadataExtractionOrchestrator(
    durable,
    new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
      configuration,
      {
        async extractMetadata() {
          durable.timeline.push("external-io-failed");
          throw new Error("CANOPYPROOF_TEST_PROVIDER_OUTAGE");
        },
      },
      verifier,
    ),
    () => extractedAt,
  );
  const command = {
    organizationId,
    objectId: fixture.object.id,
    requesterAgentId: fixture.extractionAuthority.agent.id,
    verifierAgentId: agent("verified_metadata_extraction_receipt").id,
    idempotencyKey: "cp-e3d-request-0002",
    requestedAt: extractedAt,
  } as const;
  await assert.rejects(failed.extractMetadata(command), /TEST_PROVIDER_OUTAGE/);
  assert.deepEqual(durable.timeline, [
    "request-committed",
    "result-read",
    "dispatch-authorized",
    "external-io-failed",
  ]);

  durable.timeline.length = 0;
  const recovered = new CanopyProofMetadataExtractionOrchestrator(
    durable,
    new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
      configuration,
      {
        async extractMetadata() {
          durable.timeline.push("external-io-retried");
          return receipt;
        },
      },
      verifier,
    ),
    () => extractedAt,
  );
  const result = await recovered.extractMetadata(command);
  assert.equal(result.projection.state, "accepted");
  assert.deepEqual(durable.timeline, [
    "request-committed",
    "result-read",
    "dispatch-authorized",
    "external-io-retried",
    "result-committed",
  ]);
});

test("E3d rechecks current authority and expiry before every external dispatch", async () => {
  const fixture = createFixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey);
  const durable = new InMemoryMetadataExtractionDurablePort(fixture.extractionAuthority);
  durable.dispatchAuthorized = false;
  let externalCalls = 0;
  const adapter = new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
    adapterConfiguration(),
    {
      async extractMetadata() {
        externalCalls += 1;
        return receipt;
      },
    },
    new WebCryptoEd25519MetadataExtractorSignatureVerifier({
      [signerKeyId]: signing.publicKey,
    }),
  );
  const command = {
    organizationId,
    objectId: fixture.object.id,
    requesterAgentId: fixture.extractionAuthority.agent.id,
    verifierAgentId: agent("verified_metadata_extraction_receipt").id,
    idempotencyKey: "cp-e3d-request-0003",
    requestedAt: extractedAt,
  } as const;
  await assert.rejects(
    new CanopyProofMetadataExtractionOrchestrator(
      durable,
      adapter,
      () => extractedAt,
    ).extractMetadata(command),
    /DISPATCH_AUTHORITY_REVOKED/,
  );
  assert.equal(externalCalls, 0);
  assert.deepEqual(durable.timeline, [
    "request-committed",
    "result-read",
    "dispatch-authorized",
  ]);

  durable.dispatchAuthorized = true;
  durable.timeline.length = 0;
  await assert.rejects(
    new CanopyProofMetadataExtractionOrchestrator(
      durable,
      adapter,
      () => "2026-07-17T10:08:00.000Z",
    ).extractMetadata(command),
    /DISPATCH_EXPIRED/,
  );
  assert.equal(externalCalls, 0);
  assert.deepEqual(durable.timeline, [
    "request-committed",
    "result-read",
    "dispatch-authorized",
  ]);
});

test("E3c verifies a minimized signed receipt and projects acceptance without mutating E3b", async () => {
  const pipeline = await verifiedPipeline();
  assert.equal(isCanopyProofVerifiedMetadataExtractionReceipt(pipeline.verified), true);
  assert.equal(isCanopyProofDurableMetadataExtractionReceipt(pipeline.durable), true);
  assert.equal(pipeline.extraction.providerVerificationState, "modeled_only");
  assert.equal(pipeline.extraction.extractionState, "needs_review");
  assert.deepEqual(pipeline.extraction.issueCodes, ["metadata_provider_verification_pending"]);
  assert.equal("signature" in pipeline.durable, false);
  assert.equal(JSON.stringify(pipeline.verification).includes(pipeline.receipt.signature), false);

  const projection = projectCanopyProofEvidenceMetadataExtraction({
    object: pipeline.object,
    extraction: pipeline.extraction,
    verification: pipeline.verification,
    evaluatedAt: extractedAt,
  });
  assert.equal(projection.verificationState, "verified");
  assert.equal(projection.state, "accepted");
  assert.deepEqual(projection.issueCodes, []);
  assert.equal(pipeline.extraction.extractionState, "needs_review");

  const replayed = buildCanopyProofEvidenceMetadataExtractionVerificationFact({
    object: pipeline.object,
    extraction: pipeline.extraction,
    receipt: pipeline.durable,
    verifier: agent("verified_metadata_extraction_receipt"),
    streamEvents: [],
  });
  assert.deepEqual(replayed, pipeline.verification);
  assert.equal(
    projectCanopyProofEvidenceMetadataExtraction({
      object: pipeline.object,
      extraction: pipeline.extraction,
      verification: replayed,
      evaluatedAt: extractedAt,
    }).projectionRoot,
    projection.projectionRoot,
  );
});

test("E3b rejects direct verified extraction input and E3c rejects unbranded copies", async () => {
  const pipeline = await verifiedPipeline();
  const metadata = new CanopyProofEvidenceMetadataRetentionAuthorityService();
  assert.throws(
    () => metadata.recordMetadataExtraction(
      { ...extractionInput(pipeline.receipt), providerVerificationState: "verified" },
      pipeline.extractionAuthority,
    ),
    /Invalid literal value|Invalid input/,
  );
  assert.throws(
    () => minimizeCanopyProofMetadataExtractionReceipt({ ...pipeline.verified } as never),
    /NOT_ADAPTER_VERIFIED/,
  );
  assert.throws(
    () => buildCanopyProofEvidenceMetadataExtractionVerificationFact({
      object: pipeline.object,
      extraction: pipeline.extraction,
      receipt: { ...pipeline.durable } as never,
      verifier: agent("verified_metadata_extraction_receipt"),
      streamEvents: [],
    }),
    /NOT_MINIMIZED_BY_AUTHORITY/,
  );
  assert.throws(
    () => buildCanopyProofEvidenceMetadataExtractionVerificationFact({
      object: pipeline.object,
      extraction: pipeline.extraction,
      receipt: JSON.parse(JSON.stringify(pipeline.durable)) as never,
      verifier: agent("verified_metadata_extraction_receipt"),
      streamEvents: [],
    }),
    /NOT_MINIMIZED_BY_AUTHORITY/,
  );
});

test("E3c preserves non-provider quality issues after signature verification", async () => {
  const pipeline = await verifiedPipeline({ accuracyBand: "unknown" });
  assert.deepEqual(pipeline.extraction.issueCodes, [
    "gps_accuracy_needs_review",
    "metadata_provider_verification_pending",
  ]);
  const projection = projectCanopyProofEvidenceMetadataExtraction({
    object: pipeline.object,
    extraction: pipeline.extraction,
    verification: pipeline.verification,
    evaluatedAt: extractedAt,
  });
  assert.equal(projection.verificationState, "verified");
  assert.equal(projection.state, "needs_review");
  assert.deepEqual(projection.issueCodes, ["gps_accuracy_needs_review"]);
});

test("metadata extractor rejects authority, lineage, policy, privacy, raw fields, and signature substitution", async () => {
  const fixture = createFixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey);
  const verifier = new WebCryptoEd25519MetadataExtractorSignatureVerifier({
    [signerKeyId]: signing.publicKey,
  });
  let calls = 0;
  const adapterFor = (response: unknown) => new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
    adapterConfiguration(),
    { async extractMetadata() { calls += 1; return response; } },
    verifier,
  );
  await assert.rejects(
    adapterFor(receipt).extractMetadata(
      {
        ...fixture.extractionAuthority,
        mediaProjection: { ...fixture.extractionAuthority.mediaProjection, state: "needs_review" },
      },
      { now: extractedAt, correlationId: "cp-e3c-ineligible-001" },
    ),
    /EFFECTIVE_MEDIA_PROJECTION_INVALID/,
  );
  assert.equal(calls, 0);

  for (const [field, value] of [
    ["objectRoot", hashJson({ kind: "substituted-object" })],
    ["mediaProjectionRoot", hashJson({ kind: "substituted-media-projection" })],
    ["consentProjectionRoot", hashJson({ kind: "substituted-consent" })],
    ["deviceProjectionRoot", hashJson({ kind: "substituted-device" })],
    ["gpsHash", hashJson({ kind: "substituted-gps" })],
    ["privacyMode", "precise"],
  ] as const) {
    const substituted = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey, {
      [field]: value,
    });
    await assert.rejects(
      adapterFor(substituted).extractMetadata(fixture.extractionAuthority, {
        now: extractedAt,
        correlationId: `cp-e3c-substitution-${field}`,
      }),
      /RECEIPT_AUTHORITY_MISMATCH/,
    );
  }

  await assert.rejects(
    adapterFor({ ...receipt, rawExif: { GPSLatitude: 22.3 } }).extractMetadata(
      fixture.extractionAuthority,
      { now: extractedAt, correlationId: "cp-e3c-raw-exif-001" },
    ),
    /Unrecognized key/,
  );
  const badPolicy = await signedReceipt(fixture.extractionAuthority, signing.keyPair.privateKey, {
    extractorImageDigest: hashJson({ kind: "unapproved-image" }),
  });
  await assert.rejects(
    adapterFor(badPolicy).extractMetadata(fixture.extractionAuthority, {
      now: extractedAt,
      correlationId: "cp-e3c-policy-001",
    }),
    /RECEIPT_POLICY_MISMATCH/,
  );
  const second = await signingFixture();
  const wrongSignature = Buffer.from(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      second.keyPair.privateKey,
      new TextEncoder().encode(receipt.receiptHash),
    ),
  ).toString("base64url");
  await assert.rejects(
    adapterFor({ ...receipt, signature: wrongSignature }).extractMetadata(
      fixture.extractionAuthority,
      { now: extractedAt, correlationId: "cp-e3c-signature-001" },
    ),
    /SIGNATURE_INVALID/,
  );
});

test("E3c detects verification-fact tampering and does not apply future verification", async () => {
  const pipeline = await verifiedPipeline();
  const before = projectCanopyProofEvidenceMetadataExtraction({
    object: pipeline.object,
    extraction: pipeline.extraction,
    verification: pipeline.verification,
    evaluatedAt: "2026-07-17T10:02:59.999Z",
  });
  assert.equal(before.verificationState, "modeled_only");
  assert.equal(before.state, "needs_review");
  assert.throws(
    () => projectCanopyProofEvidenceMetadataExtraction({
      object: pipeline.object,
      extraction: pipeline.extraction,
      verification: {
        ...pipeline.verification,
        verificationRoot: hashJson({ kind: "tampered-e3c-verification" }),
      },
      evaluatedAt: extractedAt,
    }),
    /VERIFICATION_FACT_INVALID/,
  );
});

test("fixed metadata extractor transport emits only bounded immutable authority context", async () => {
  const fixture = createFixture();
  const authorization = "Bearer metadata-extractor-token-nonproduction";
  let body: unknown;
  const port = new FixedEndpointCanopyProofMetadataExtractorPort({
    endpoint: "https://extractor.nonproduction.example/v1/metadata-receipts",
    authorizationHeader: authorization,
    fetcher: async (input, init) => {
      assert.equal(String(input), "https://extractor.nonproduction.example/v1/metadata-receipts");
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      assert.equal(init?.cache, "no-store");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), authorization);
      body = JSON.parse(String(init?.body));
      return Response.json({ receipt: "untrusted" });
    },
  });
  const request = {
    objectId: fixture.object.id,
    objectRoot: fixture.object.objectRoot,
    storageProvider: fixture.object.storageProvider,
    providerNamespace: fixture.object.providerNamespace,
    objectKey: fixture.object.objectKey,
    objectVersion: fixture.object.objectVersion,
    storedObjectProviderReceiptHash: fixture.object.providerReceiptHash,
    contentType: "image/jpeg" as const,
    mediaProjectionRoot: fixture.extractionAuthority.mediaProjection.projectionRoot,
    consentReceiptId: fixture.consent.id,
    consentReceiptRoot: fixture.consent.receiptRoot,
    consentProjectionRoot: fixture.extractionAuthority.consentProjection.projectionRoot,
    deviceAttestationId: fixture.device.id,
    deviceAttestationRoot: fixture.device.attestationRoot,
    deviceProjectionRoot: fixture.extractionAuthority.deviceProjection.projectionRoot,
    registeredGpsHash: fixture.extractionAuthority.registeredGpsHash,
    privacyMode: fixture.consent.privacyMode,
    requestedAt: extractedAt,
    correlationId: "cp-e3c-fixed-port-001",
  };
  assert.deepEqual(await port.extractMetadata(request), { receipt: "untrusted" });
  assert.deepEqual(body, {
    protocolVersion: "canopyproof-metadata-extraction-v1",
    ...request,
  });
  assert.equal(JSON.stringify(body).includes(authorization), false);
  assert.equal(JSON.stringify(body).includes("latitude"), false);
  assert.equal(JSON.stringify(body).includes("longitude"), false);
});

test("fixed metadata extractor transport rejects endpoint and response abuse without leaking secrets", async () => {
  for (const endpoint of [
    "http://extractor.example/v1/metadata",
    "https://localhost/v1/metadata",
    "https://127.0.0.1/v1/metadata",
    "https://extractor.internal/v1/metadata",
    "https://extractor.example:8443/v1/metadata",
    "https://extractor.example/v1/metadata?object=other",
    "https://extractor.example/",
  ]) {
    assert.throws(
      () => new FixedEndpointCanopyProofMetadataExtractorPort({ endpoint }),
      /CONFIGURATION_INVALID/,
    );
  }
  const pipeline = await verifiedPipeline();
  const request = {
    objectId: pipeline.object.id,
    objectRoot: pipeline.object.objectRoot,
    storageProvider: pipeline.object.storageProvider,
    providerNamespace: pipeline.object.providerNamespace,
    objectKey: pipeline.object.objectKey,
    objectVersion: pipeline.object.objectVersion,
    storedObjectProviderReceiptHash: pipeline.object.providerReceiptHash,
    contentType: "image/jpeg" as const,
    mediaProjectionRoot: pipeline.extractionAuthority.mediaProjection.projectionRoot,
    consentReceiptId: pipeline.consent.id,
    consentReceiptRoot: pipeline.consent.receiptRoot,
    consentProjectionRoot: pipeline.extractionAuthority.consentProjection.projectionRoot,
    deviceAttestationId: pipeline.device.id,
    deviceAttestationRoot: pipeline.device.attestationRoot,
    deviceProjectionRoot: pipeline.extractionAuthority.deviceProjection.projectionRoot,
    registeredGpsHash: pipeline.extractionAuthority.registeredGpsHash,
    privacyMode: pipeline.consent.privacyMode,
    requestedAt: extractedAt,
    correlationId: "cp-e3c-fixed-port-abuse-001",
  };
  const portFor = (
    fetcher: typeof fetch,
    options: Readonly<{ timeoutMilliseconds?: number; maximumResponseBytes?: number }> = {},
  ) => new FixedEndpointCanopyProofMetadataExtractorPort({
    endpoint: "https://extractor.nonproduction.example/v1/metadata-receipts",
    fetcher,
    ...options,
  });
  await assert.rejects(
    portFor(async () => new Response("{}", {
      headers: { "content-encoding": "gzip", "content-type": "application/json" },
    })).extractMetadata(request),
    /CONTENT_ENCODING_FORBIDDEN/,
  );
  await assert.rejects(
    portFor(async () => new Response("{}", {
      headers: { "content-length": "3", "content-type": "application/json" },
    })).extractMetadata(request),
    /CONTENT_LENGTH_MISMATCH/,
  );
  const overflow = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
      controller.close();
    },
  });
  await assert.rejects(
    portFor(
      async () => new Response(overflow, { headers: { "content-type": "application/json" } }),
      { maximumResponseBytes: 1_024 },
    ).extractMetadata(request),
    /RESPONSE_TOO_LARGE/,
  );
  const providerMarker = "extractor-sensitive-marker-nonproduction";
  await assert.rejects(
    portFor(async () => { throw new Error(`provider exposed ${providerMarker}`); }).extractMetadata(request),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error).message, "CANOPYPROOF_METADATA_EXTRACTOR_REQUEST_FAILED");
      assert.equal((error as Error).message.includes(providerMarker), false);
      return true;
    },
  );
  await assert.rejects(
    portFor(async () => {
      const forged = new Error(`forged runtime error exposed ${secret}`);
      forged.name = "CanopyProofMetadataExtractorRuntimeError";
      throw forged;
    }).extractMetadata(request),
    /CANOPYPROOF_METADATA_EXTRACTOR_REQUEST_FAILED/,
  );
  await assert.rejects(
    portFor(
      async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
      { timeoutMilliseconds: 100 },
    ).extractMetadata(request),
    /CANOPYPROOF_METADATA_EXTRACTOR_TIMEOUT/,
  );
});

test("metadata extraction remains disabled by default and rejects unsupported media", async () => {
  const fixture = createFixture();
  await assert.rejects(
    new DisabledCanopyProofMetadataExtractorAdapter().extractMetadata(
      fixture.extractionAuthority,
      { now: extractedAt, correlationId: "cp-e3c-disabled-001" },
    ),
    /UNAVAILABLE/,
  );
  const jsonFixture = createFixture({ contentType: "application/json" });
  const signing = await signingFixture();
  const receipt = await signedReceipt(jsonFixture.extractionAuthority, signing.keyPair.privateKey);
  const adapter = new PolicyEnforcedCanopyProofMetadataExtractorAdapter(
    adapterConfiguration(),
    { async extractMetadata() { return receipt; } },
    new WebCryptoEd25519MetadataExtractorSignatureVerifier({ [signerKeyId]: signing.publicKey }),
  );
  await assert.rejects(
    adapter.extractMetadata(jsonFixture.extractionAuthority, {
      now: extractedAt,
      correlationId: "cp-e3c-json-001",
    }),
    /MEDIA_TYPE_UNSUPPORTED/,
  );
});
