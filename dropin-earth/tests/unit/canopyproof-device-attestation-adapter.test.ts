import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  canopyProofDeviceAttestationReceiptSeed,
  DisabledCanopyProofDeviceAttestationAdapter,
  isCanopyProofVerifiedDeviceAttestationReceipt,
  PolicyEnforcedCanopyProofDeviceAttestationAdapter,
  WebCryptoEd25519DeviceAttestationSignatureVerifier,
  type CanopyProofDeviceAttestationProviderReceipt,
} from "../../services/api/src/domain/canopyproof/device-attestation-adapter.js";
import {
  CanopyProofEvidenceCustodyAuthorityService,
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceCustodyActorSnapshot,
  type CanopyProofEvidenceDeviceAttestationFact,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  assertCanopyProofEffectiveDeviceAttestationProjection,
  assertCanopyProofDeviceAttestationVerificationFact,
  buildCanopyProofDeviceAttestationVerificationFact,
  isCanopyProofDurableDeviceAttestationReceipt,
  minimizeCanopyProofDeviceAttestationReceipt,
  projectCanopyProofEffectiveDeviceAttestation,
} from "../../services/api/src/domain/canopyproof/evidence-device-attestation-adapter-authority.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-media-authority.js";

const organizationId = "cp_e1a_org";
const verifiedAt = "2026-07-18T09:00:00.000Z";
const verificationExpiresAt = "2026-07-19T09:00:00.000Z";
const signerKeyId = "cp-e1a-signer-v1";
const challengeHash = hashJson({ kind: "cp-e1a-challenge" });

function contributor(id = "cp_e1a_subject"): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e1a-subject", id }),
    organizationRoot: hashJson({ kind: "cp-e1a-organization" }),
    membershipId: `cp_e1a_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "cp-e1a-membership", id }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function verifier(): CanopyProofEvidenceMediaAgentSnapshot {
  const seed = {
    id: "cp_e1a_verifier_agent",
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "cp-e1a-verifier" }),
    organizationRoot: hashJson({ kind: "cp-e1a-organization" }),
    agentType: "evidence" as const,
    agentStatus: "active" as const,
    capability: "device_attestation_receipt" as const,
    agentRegistryHash: hashJson({ kind: "cp-e1a-verifier-registry" }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(seed) };
}

function fixture(options: Readonly<{ riskFlags?: readonly string[]; subjectId?: string }> = {}) {
  const subject = contributor(options.subjectId);
  const custody = new CanopyProofEvidenceCustodyAuthorityService();
  const consent = custody.recordConsentReceipt(
    {
      subjectId: subject.id,
      deviceFingerprintHash: hashJson({ kind: "cp-e1a-device-fingerprint" }),
      purposes: ["evidence_collection", "media_upload"],
      lawfulBasis: "consent",
      privacyMode: "restricted",
      policyVersion: "cp-e1a-consent-v1",
      evidenceHash: hashJson({ kind: "cp-e1a-consent-evidence" }),
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
      deviceFingerprintHash: hashJson({ kind: "cp-e1a-device-fingerprint" }),
      attestationType: "secure_enclave",
      provider: "apple_app_attest",
      providerKeyId: "cp-e1a-apple-key-v1",
      providerReceiptHash: hashJson({ kind: "cp-e1a-provider-receipt" }),
      providerVerificationState: "modeled_only",
      publicKeyHash: hashJson({ kind: "cp-e1a-public-key" }),
      attestationHash: hashJson({ kind: "cp-e1a-attestation" }),
      issuedAt: "2026-07-01T00:01:00.000Z",
      expiresAt: "2027-01-01T00:01:00.000Z",
      reputationScore: 90,
      riskFlags: options.riskFlags ?? [],
    },
    subject,
  );
  return { subject, custody, consent, device };
}

function configuration() {
  return {
    provider: "apple_app_attest" as const,
    attestationType: "secure_enclave" as const,
    verifierId: "cp-e1a-apple-verifier",
    verifierVersion: "1.0.0",
    providerPolicyRoot: hashJson({ kind: "cp-e1a-provider-policy" }),
    allowedSignerKeyIds: [signerKeyId],
    maximumVerificationLifetimeSeconds: 86_400,
  };
}

async function signingFixture() {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return { keyPair, publicKey };
}

async function signedReceipt(
  device: CanopyProofEvidenceDeviceAttestationFact,
  privateKey: CryptoKey,
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<CanopyProofDeviceAttestationProviderReceipt> {
  const policy = configuration();
  const base = {
    attestationId: device.id,
    attestationRoot: device.attestationRoot,
    organizationId: device.organizationId,
    subjectId: device.subjectId,
    subjectRoot: device.subjectRoot,
    consentReceiptId: device.consentReceiptId,
    consentReceiptRoot: device.consentReceiptRoot,
    deviceFingerprintHash: device.deviceFingerprintHash,
    attestationType: device.attestationType,
    provider: device.provider,
    providerKeyId: device.providerKeyId,
    providerReceiptHash: device.providerReceiptHash,
    publicKeyHash: device.publicKeyHash,
    attestationHash: device.attestationHash,
    challengeHash,
    verifierId: policy.verifierId,
    verifierVersion: policy.verifierVersion,
    providerPolicyRoot: policy.providerPolicyRoot,
    result: "verified" as const,
    reasonCodes: [] as readonly string[],
    verifiedAt,
    expiresAt: verificationExpiresAt,
    signerKeyId,
    signatureAlgorithm: "ed25519" as const,
    ...overrides,
  } as Omit<CanopyProofDeviceAttestationProviderReceipt, "signature" | "receiptHash">;
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

async function verifiedPipeline(
  options: Readonly<Record<string, unknown>> = {},
) {
  const base = fixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(base.device, signing.keyPair.privateKey, options);
  const adapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
    configuration(),
    { async verifyAttestation() { return receipt; } },
    new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: signing.publicKey }),
  );
  const verified = await adapter.verifyAttestation(base.device, {
    now: verifiedAt,
    correlationId: "cp-e1a-correlation-001",
    challengeHash,
  });
  const durable = minimizeCanopyProofDeviceAttestationReceipt(verified);
  const verification = buildCanopyProofDeviceAttestationVerificationFact({
    attestation: base.device,
    receipt: durable,
    verifier: verifier(),
    streamEvents: [],
  });
  return { ...base, signing, receipt, adapter, verified, durable, verification };
}

test("E1a verifies, minimizes, appends, and replays a current effective device projection", async () => {
  const result = await verifiedPipeline();
  assert.equal(isCanopyProofVerifiedDeviceAttestationReceipt(result.verified), true);
  assert.equal(isCanopyProofDurableDeviceAttestationReceipt(result.durable), true);
  assert.equal("signature" in result.durable, false);
  assert.equal(result.device.providerVerificationState, "modeled_only");
  assertCanopyProofDeviceAttestationVerificationFact(result.device, result.verification);

  const consentProjection = result.custody.projectConsentReceipt(result.consent.id, verifiedAt);
  const projection = projectCanopyProofEffectiveDeviceAttestation({
    attestation: result.device,
    consentProjection,
    verifications: [result.verification],
    evaluatedAt: verifiedAt,
  });
  const replay = projectCanopyProofEffectiveDeviceAttestation({
    attestation: result.device,
    consentProjection,
    verifications: [result.verification],
    evaluatedAt: verifiedAt,
  });
  assert.equal(projection.state, "current");
  assert.deepEqual(assertCanopyProofEffectiveDeviceAttestationProjection(projection), projection);
  assert.deepEqual(projection.issueCodes, []);
  assert.equal(projection.projectionRoot, replay.projectionRoot);
  assert.equal(projection.verificationRoot, result.verification.verificationRoot);
  assert.equal(JSON.stringify(result.verification).includes(result.receipt.signature), false);
  assert.throws(
    () => assertCanopyProofEffectiveDeviceAttestationProjection({
      ...projection,
      state: "needs_review",
    }),
    /EFFECTIVE_DEVICE_ATTESTATION_PROJECTION_INVALID/,
  );
  assert.throws(
    () => assertCanopyProofEffectiveDeviceAttestationProjection({
      ...projection,
      issueCodes: ["device_provider_verification_pending"],
    }),
    /EFFECTIVE_DEVICE_ATTESTATION_PROJECTION_INVALID/,
  );
});

test("E1a rejects signature substitution and private signing key configuration", async () => {
  const base = fixture();
  const signing = await signingFixture();
  const other = await signingFixture();
  const receipt = await signedReceipt(base.device, other.keyPair.privateKey);
  const adapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
    configuration(),
    { async verifyAttestation() { return receipt; } },
    new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: signing.publicKey }),
  );
  await assert.rejects(
    adapter.verifyAttestation(base.device, {
      now: verifiedAt,
      correlationId: "cp-e1a-correlation-002",
      challengeHash,
    }),
    /SIGNATURE_INVALID/,
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", signing.keyPair.privateKey);
  assert.throws(
    () => new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: privateJwk }),
    /PUBLIC_KEY_INVALID/,
  );
});

test("E1a rejects cross-device receipt replay, challenge substitution, and copied brands", async () => {
  const first = await verifiedPipeline();
  const secondBase = fixture({ subjectId: "cp_e1a_second_subject" });
  const secondReceipt = first.receipt;
  const adapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
    configuration(),
    { async verifyAttestation() { return secondReceipt; } },
    new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: first.signing.publicKey }),
  );
  await assert.rejects(
    adapter.verifyAttestation(secondBase.device, {
      now: verifiedAt,
      correlationId: "cp-e1a-correlation-003",
      challengeHash,
    }),
    /RECEIPT_(AUTHORITY|HASH)_MISMATCH|RECEIPT_HASH_INVALID/,
  );
  await assert.rejects(
    first.adapter.verifyAttestation(first.device, {
      now: verifiedAt,
      correlationId: "cp-e1a-correlation-004",
      challengeHash: hashJson({ kind: "cp-e1a-other-challenge" }),
    }),
    /RECEIPT_AUTHORITY_MISMATCH/,
  );
  assert.equal(isCanopyProofVerifiedDeviceAttestationReceipt({ ...first.verified }), false);
  assert.throws(
    () => minimizeCanopyProofDeviceAttestationReceipt({ ...first.verified } as typeof first.verified),
    /NOT_ADAPTER_VERIFIED/,
  );
  assert.equal(isCanopyProofDurableDeviceAttestationReceipt({ ...first.durable }), false);
});

test("E1a signed rejection opens a rejected projection without promoting the modeled fact", async () => {
  const result = await verifiedPipeline({ result: "rejected", reasonCodes: ["integrity_check_failed"] });
  const projection = projectCanopyProofEffectiveDeviceAttestation({
    attestation: result.device,
    consentProjection: result.custody.projectConsentReceipt(result.consent.id, verifiedAt),
    verifications: [result.verification],
    evaluatedAt: verifiedAt,
  });
  assert.equal(result.verification.auditEvent.action, "CHALLENGE");
  assert.equal(projection.state, "rejected");
  assert.deepEqual(projection.issueCodes, ["device_provider_integrity_check_failed"]);
  assert.equal(result.device.providerVerificationState, "modeled_only");
});

test("E1a projection is strict as-of and fails closed on expiry, risk, and consent revocation", async () => {
  const result = await verifiedPipeline();
  const historicalAt = "2026-07-18T08:59:59.000Z";
  const historical = projectCanopyProofEffectiveDeviceAttestation({
    attestation: result.device,
    consentProjection: result.custody.projectConsentReceipt(result.consent.id, historicalAt),
    verifications: [result.verification],
    evaluatedAt: historicalAt,
  });
  assert.equal(historical.state, "needs_review");
  assert.deepEqual(historical.issueCodes, ["device_provider_verification_pending"]);

  const expiredAt = verificationExpiresAt;
  const expired = projectCanopyProofEffectiveDeviceAttestation({
    attestation: result.device,
    consentProjection: result.custody.projectConsentReceipt(result.consent.id, expiredAt),
    verifications: [result.verification],
    evaluatedAt: expiredAt,
  });
  assert.equal(expired.state, "verification_expired");

  const riskyBase = fixture({ riskFlags: ["clock_skew"] });
  const riskySigning = await signingFixture();
  const riskyReceipt = await signedReceipt(riskyBase.device, riskySigning.keyPair.privateKey);
  const riskyAdapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
    configuration(),
    { async verifyAttestation() { return riskyReceipt; } },
    new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: riskySigning.publicKey }),
  );
  const riskyDurable = minimizeCanopyProofDeviceAttestationReceipt(
    await riskyAdapter.verifyAttestation(riskyBase.device, {
      now: verifiedAt,
      correlationId: "cp-e1a-correlation-risk",
      challengeHash,
    }),
  );
  const riskyFact = buildCanopyProofDeviceAttestationVerificationFact({
    attestation: riskyBase.device,
    receipt: riskyDurable,
    verifier: verifier(),
    streamEvents: [],
  });
  const risky = projectCanopyProofEffectiveDeviceAttestation({
    attestation: riskyBase.device,
    consentProjection: riskyBase.custody.projectConsentReceipt(riskyBase.consent.id, verifiedAt),
    verifications: [riskyFact],
    evaluatedAt: verifiedAt,
  });
  assert.equal(risky.state, "needs_review");
  assert.deepEqual(risky.issueCodes, ["device_risk_clock_skew"]);

  result.custody.revokeConsentReceipt(
    result.consent.id,
    { revokedAt: "2026-07-18T10:00:00.000Z", reason: "The contributor withdrew device processing consent." },
    result.subject,
  );
  const revokedAt = "2026-07-18T10:00:00.000Z";
  const revoked = projectCanopyProofEffectiveDeviceAttestation({
    attestation: result.device,
    consentProjection: result.custody.projectConsentReceipt(result.consent.id, revokedAt),
    verifications: [result.verification],
    evaluatedAt: revokedAt,
  });
  assert.equal(revoked.state, "consent_revoked");
});

test("E1a adapter is default-off and rejects unsafe provider/type and receipt windows", async () => {
  const disabled = new DisabledCanopyProofDeviceAttestationAdapter();
  await assert.rejects(disabled.verifyAttestation(), /PROVIDER_UNAVAILABLE/);
  assert.throws(
    () => new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
      { ...configuration(), attestationType: "webauthn" },
      { async verifyAttestation() { return {}; } },
      { async verify() { return false; } },
    ),
    /PROVIDER_TYPE_UNSUPPORTED/,
  );
  const base = fixture();
  const signing = await signingFixture();
  const receipt = await signedReceipt(base.device, signing.keyPair.privateKey, {
    expiresAt: "2026-08-18T09:00:00.000Z",
  });
  const adapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
    configuration(),
    { async verifyAttestation() { return receipt; } },
    new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: signing.publicKey }),
  );
  await assert.rejects(
    adapter.verifyAttestation(base.device, {
      now: verifiedAt,
      correlationId: "cp-e1a-correlation-005",
      challengeHash,
    }),
    /RECEIPT_TIME_INVALID/,
  );
});
