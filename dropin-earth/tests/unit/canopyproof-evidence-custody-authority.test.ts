import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofEvidenceCustodyAuthorityService,
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceCustodyActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";

function actor(id = "cp_evidence_custody_subject"): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId: "cp_evidence_custody_org",
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "evidence-custody-participant", id }),
    organizationRoot: hashJson({ kind: "evidence-custody-organization" }),
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "evidence-custody-membership", id }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function consentInput(subjectId = actor().id) {
  return {
    subjectId,
    deviceFingerprintHash: hashJson({ kind: "evidence-custody-device", subjectId }),
    purposes: ["evidence_collection", "geolocation", "media_upload"] as const,
    lawfulBasis: "consent" as const,
    privacyMode: "restricted" as const,
    policyVersion: "canopyproof-evidence-consent-v2",
    evidenceHash: hashJson({ kind: "evidence-custody-consent-evidence", subjectId }),
    grantedAt: "2026-07-12T08:00:00.000Z",
    expiresAt: "2027-07-12T08:00:00.000Z",
    retentionDays: 365,
  };
}

function deviceInput(consentReceiptId: string, subjectId = actor().id) {
  return {
    subjectId,
    consentReceiptId,
    deviceFingerprintHash: hashJson({ kind: "evidence-custody-device", subjectId }),
    attestationType: "manual_field_kit" as const,
    provider: "manual_field_kit_registry" as const,
    providerKeyId: "manual-field-kit-key-v1",
    providerReceiptHash: hashJson({ kind: "evidence-custody-provider-receipt", subjectId }),
    providerVerificationState: "modeled_only" as const,
    publicKeyHash: hashJson({ kind: "evidence-custody-public-key", subjectId }),
    attestationHash: hashJson({ kind: "evidence-custody-attestation", subjectId }),
    issuedAt: "2026-07-12T08:01:00.000Z",
    expiresAt: "2026-10-12T08:01:00.000Z",
    reputationScore: 70,
    riskFlags: [] as const,
  };
}

test("CanopyProof evidence custody records and replays immutable consent and device facts", () => {
  const service = new CanopyProofEvidenceCustodyAuthorityService();
  const subject = actor();
  const receipt = service.recordConsentReceipt(consentInput(subject.id), subject);
  assert.equal(service.recordConsentReceipt(consentInput(subject.id), subject), receipt);
  assert.equal(receipt.subjectSequence, 1);
  assert.equal(service.projectConsentReceipt(receipt.id, "2026-07-12T08:00:30.000Z").state, "active");

  const attestation = service.recordDeviceAttestation(deviceInput(receipt.id, subject.id), subject);
  assert.equal(service.recordDeviceAttestation(deviceInput(receipt.id, subject.id), subject), attestation);
  assert.equal(attestation.subjectSequence, 2);
  assert.equal(
    service.projectDeviceAttestation(attestation.id, "2026-07-12T08:02:00.000Z").state,
    "needs_review",
  );
  assert.equal(attestation.safety.providerVerificationRequiredForHardwareTrust, true);

  const replayed = CanopyProofEvidenceCustodyAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getConsentReceipt(receipt.id), receipt);
  assert.deepEqual(replayed.getDeviceAttestation(attestation.id), attestation);
});

test("CanopyProof evidence custody revokes consent without mutating the receipt", () => {
  const service = new CanopyProofEvidenceCustodyAuthorityService();
  const subject = actor();
  const receipt = service.recordConsentReceipt(consentInput(subject.id), subject);
  const receiptBeforeRevocation = structuredClone(receipt);
  const revocationInput = {
    revokedAt: "2026-07-12T08:03:00.000Z",
    reason: "The subject withdrew future device-bound evidence processing consent.",
  };
  const revocation = service.revokeConsentReceipt(receipt.id, revocationInput, subject);
  assert.equal(service.revokeConsentReceipt(receipt.id, revocationInput, subject), revocation);
  assert.deepEqual(service.getConsentReceipt(receipt.id), receiptBeforeRevocation);
  assert.equal(service.projectConsentReceipt(receipt.id, "2026-07-12T08:04:00.000Z").state, "revoked");
  assert.throws(
    () => service.recordDeviceAttestation(deviceInput(receipt.id, subject.id), subject),
    /requires active consent: revoked/,
  );
  assert.throws(
    () =>
      service.revokeConsentReceipt(
        receipt.id,
        {
          revokedAt: "2026-07-12T08:05:00.000Z",
          reason: "A conflicting second revocation must not fork the subject authority stream.",
        },
        subject,
      ),
    /already revoked by a different command/,
  );

  const replayed = CanopyProofEvidenceCustodyAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getConsentRevocation(revocation.id), revocation);
});

test("CanopyProof evidence custody rejects subject substitution, secret material, and device mismatch", () => {
  const service = new CanopyProofEvidenceCustodyAuthorityService();
  const subject = actor();
  assert.throws(
    () => service.recordConsentReceipt(consentInput("cp_other_subject"), subject),
    /verified human subject to act for itself/,
  );
  const receipt = service.recordConsentReceipt(consentInput(subject.id), subject);
  assert.throws(
    () =>
      service.recordDeviceAttestation(
        {
          ...deviceInput(receipt.id, subject.id),
          providerKeyId: "private_key_material_must_be_rejected",
        },
        subject,
      ),
    /secret-like material/,
  );
  assert.throws(
    () =>
      service.recordDeviceAttestation(
        {
          ...deviceInput(receipt.id, subject.id),
          deviceFingerprintHash: hashJson({ kind: "different-device" }),
        },
        subject,
      ),
    /fingerprint does not match/,
  );
  assert.throws(
    () =>
      service.revokeConsentReceipt(
        receipt.id,
        {
          revokedAt: "2026-07-12T08:03:00.000Z",
          reason: "This reason promises automatic CANOPY distribution and must fail closed.",
        },
        subject,
      ),
    /unsupported public claim/,
  );
});

test("CanopyProof evidence custody snapshot rejects actor, receipt, and event tampering", () => {
  const service = new CanopyProofEvidenceCustodyAuthorityService();
  const subject = actor();
  const receipt = service.recordConsentReceipt(consentInput(subject.id), subject);
  const snapshot = service.getAuthoritySnapshot();

  assert.throws(
    () =>
      CanopyProofEvidenceCustodyAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        consentReceipts: [{ ...receipt, receiptRoot: hashJson({ kind: "tampered-receipt-root" }) }],
      }),
    /replay is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofEvidenceCustodyAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        consentReceipts: [
          {
            ...receipt,
            actor: { ...receipt.actor, authorityRoot: hashJson({ kind: "tampered-actor-root" }) },
          },
        ],
      }),
    /actor authority root is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofEvidenceCustodyAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        consentReceipts: [
          {
            ...receipt,
            auditEvent: { ...receipt.auditEvent, eventRoot: hashJson({ kind: "tampered-event-root" }) },
          },
        ],
      }),
    /replay is invalid/,
  );
});
