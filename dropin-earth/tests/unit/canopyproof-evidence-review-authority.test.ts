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
  CanopyProofEvidenceMediaReviewAuthorityService,
} from "../../services/api/src/domain/canopyproof/evidence-review-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";

const organizationId = "cp_media_review_org";
const projectId = "cp_media_review_project";
const subjectId = "cp_media_review_subject";

function custodyActor(): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id: subjectId,
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "media-review-subject" }),
    organizationRoot: hashJson({ kind: "media-review-organization" }),
    membershipId: "cp_media_review_subject_membership",
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "media-review-subject-membership" }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function reviewActor(
  id: string,
  role: "owner" | "admin" | "verifier" | "researcher",
  accredited = false,
): CanopyProofVerificationActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "media-review-actor", id }),
    organizationRoot: hashJson({ kind: "media-review-organization" }),
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "media-review-membership", id }),
    ...(accredited
      ? {
          accreditationId: "cp_media_review_accreditation",
          accreditationStatus: "approved" as const,
          accreditationRoot: hashJson({ kind: "media-review-accreditation" }),
        }
      : {}),
    accreditationScope: accredited ? ["evidence_media_review"] : [],
  };
  return {
    ...seed,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...seed }),
  };
}

function mediaAgent(capability: CanopyProofEvidenceMediaAgentCapability): CanopyProofEvidenceMediaAgentSnapshot {
  const seed = {
    id: `cp_media_review_agent_${capability}`,
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "media-review-agent", capability }),
    organizationRoot: hashJson({ kind: "media-review-organization" }),
    agentType: "evidence" as const,
    agentStatus: "active" as const,
    capability,
    agentRegistryHash: hashJson({ kind: "media-review-agent-registry", capability }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceMediaAgentAuthorityRoot(seed) };
}

function mediaFixture() {
  const capturedAt = "2026-07-13T08:00:00.000Z";
  const subject = custodyActor();
  const custody = new CanopyProofEvidenceCustodyAuthorityService();
  const fingerprint = hashJson({ kind: "media-review-device" });
  const consent = custody.recordConsentReceipt(
    {
      subjectId,
      deviceFingerprintHash: fingerprint,
      purposes: ["evidence_collection", "media_upload", "geolocation"],
      lawfulBasis: "consent",
      privacyMode: "restricted",
      policyVersion: "media-review-consent-v1",
      evidenceHash: hashJson({ kind: "media-review-consent" }),
      grantedAt: "2026-07-13T07:58:00.000Z",
      expiresAt: "2027-07-13T07:58:00.000Z",
      retentionDays: 365,
    },
    subject,
  );
  const device = custody.recordDeviceAttestation(
    {
      subjectId,
      consentReceiptId: consent.id,
      deviceFingerprintHash: fingerprint,
      attestationType: "webauthn",
      provider: "webauthn",
      providerKeyId: "media-review-device-key-v1",
      providerReceiptHash: hashJson({ kind: "media-review-device-receipt" }),
      providerVerificationState: "modeled_only",
      publicKeyHash: hashJson({ kind: "media-review-public-key" }),
      attestationHash: hashJson({ kind: "media-review-device-attestation" }),
      issuedAt: "2026-07-13T07:59:00.000Z",
      expiresAt: "2027-01-13T07:59:00.000Z",
      reputationScore: 80,
      riskFlags: [],
    },
    subject,
  );
  const media = new CanopyProofEvidenceMediaAuthorityService();
  const contentHash = hashJson({ kind: "media-review-content" });
  const intent = media.createUploadIntent(
    {
      evidenceId: "cp_media_review_evidence",
      contentHash,
      contentType: "image/jpeg",
      byteLength: 500_000,
      capturedAt,
    },
    {
      actor: subject,
      project: {
        id: projectId,
        organizationId,
        status: "active",
        projectRoot: hashJson({ kind: "media-review-project" }),
      },
      consent,
      consentProjection: custody.projectConsentReceipt(consent.id, capturedAt),
      device,
      deviceProjection: custody.projectDeviceAttestation(device.id, capturedAt),
    },
  );
  const object = media.confirmMediaObject(
    {
      intentId: intent.id,
      storageProvider: "cloudflare_r2",
      providerNamespace: "media-review-modeled-store",
      objectVersion: "version-1",
      contentHash,
      byteLength: intent.byteLength,
      etagHash: hashJson({ kind: "media-review-etag" }),
      providerReceiptHash: hashJson({ kind: "media-review-object-receipt" }),
      providerVerificationState: "modeled_only",
      encryptionMode: "r2_managed",
      objectLockMode: "governance",
      retainUntil: "2027-07-13T08:01:00.000Z",
      storedAt: "2026-07-13T08:01:00.000Z",
    },
    mediaAgent("object_storage_receipt"),
  ).object;
  media.recordScanResult(
    {
      objectId: object.id,
      scannerName: "isolated-modeled-scanner",
      scannerVersion: "1.0.0",
      scannerImageDigest: hashJson({ kind: "media-review-scanner-image" }),
      signatureDatabaseVersion: "modeled-2026-07-13",
      verdict: "clean",
      findingHashes: [],
      providerReceiptHash: hashJson({ kind: "media-review-scan-receipt" }),
      providerVerificationState: "modeled_only",
      scannedAt: "2026-07-13T08:02:00.000Z",
    },
    mediaAgent("malware_scan_result"),
  );
  const snapshot = media.getAuthoritySnapshot();
  const streamEvents = [
    ...snapshot.uploadIntents,
    ...snapshot.mediaObjects,
    ...snapshot.duplicateRelations,
    ...snapshot.scanResults,
  ]
    .sort((left, right) => left.evidenceSequence - right.evidenceSequence)
    .map((fact) => fact.auditEvent);
  return { custody, media, intent, object, streamEvents };
}

test("CanopyProof E3a review and custody facts remain independent, append-only, and replayable", () => {
  const fixture = mediaFixture();
  const service = new CanopyProofEvidenceMediaReviewAuthorityService(fixture.streamEvents);
  const openedAt = "2026-07-13T08:03:00.000Z";
  const opener = reviewActor("cp_media_review_researcher", "researcher");
  const assigner = reviewActor("cp_media_review_owner", "owner");
  const reviewer = reviewActor("cp_media_review_verifier", "verifier", true);
  const openingProjection = fixture.media.projectMediaObject(fixture.object.id, openedAt, {
    consent: fixture.custody.projectConsentReceipt(fixture.intent.consentReceiptId, openedAt),
    device: fixture.custody.projectDeviceAttestation(fixture.intent.deviceAttestationId, openedAt),
  });
  assert.equal(openingProjection.state, "needs_review");

  const opened = service.openReviewTask(
    {
      objectId: fixture.object.id,
      reasonCodes: ["modeled_provider_receipts", "object_lock_policy_review"],
      severity: "high",
      policyId: "canopyproof-media-review-v1",
      openedAt,
      dueAt: "2026-07-14T08:03:00.000Z",
    },
    { intent: fixture.intent, object: fixture.object, mediaProjection: openingProjection, opener },
  );
  assert.equal(opened.task.mediaProjectionState, "needs_review");
  assert.equal(opened.custodyEvent.sourceRoot, opened.task.taskRoot);
  assert.equal(service.projectReviewTask(opened.task.id).status, "open");

  assert.throws(
    () =>
      service.assignReviewTask(
        { taskId: opened.task.id, reviewerId: opener.id, assignedAt: "2026-07-13T08:04:00.000Z" },
        assigner,
        opener,
      ),
    /accredited human verifier/,
  );
  const assigned = service.assignReviewTask(
    { taskId: opened.task.id, reviewerId: reviewer.id, assignedAt: "2026-07-13T08:04:00.000Z" },
    assigner,
    reviewer,
  );
  assert.deepEqual(
    service.assignReviewTask(
      { taskId: opened.task.id, reviewerId: reviewer.id, assignedAt: "2026-07-13T08:04:00.000Z" },
      assigner,
      reviewer,
    ),
    assigned,
  );
  assert.throws(
    () =>
      service.assignReviewTask(
        { taskId: opened.task.id, reviewerId: reviewer.id, assignedAt: "2026-07-13T08:04:01.000Z" },
        assigner,
        reviewer,
      ),
    /different immutable assignment/,
  );
  assert.equal(assigned.assignment.reviewerId, reviewer.id);
  assert.equal(assigned.custodyEvent.previousCustodyRoot, opened.custodyEvent.custodyRoot);
  assert.equal(service.projectReviewTask(opened.task.id).status, "assigned");

  const decisionProjection = fixture.media.projectMediaObject(
    fixture.object.id,
    "2026-07-13T08:05:00.000Z",
    {
      consent: fixture.custody.projectConsentReceipt(
        fixture.intent.consentReceiptId,
        "2026-07-13T08:05:00.000Z",
      ),
      device: fixture.custody.projectDeviceAttestation(
        fixture.intent.deviceAttestationId,
        "2026-07-13T08:05:00.000Z",
      ),
    },
  );
  assert.throws(
    () =>
      service.decideReviewTask(
        {
          taskId: opened.task.id,
          decision: "accept_for_processing",
          rationale: "A human cannot override modeled provider receipt verification.",
          limitations: ["Provider and scanner receipts remain modeled only."],
          decidedAt: "2026-07-13T08:05:00.000Z",
        },
        reviewer,
        decisionProjection,
      ),
    /cannot override provider or trust verification/,
  );
  const decided = service.decideReviewTask(
    {
      taskId: opened.task.id,
      decision: "retain_non_final",
      rationale: "Retain the immutable artifact for provider verification and later independent review.",
      limitations: ["This review is not environmental proof or a provider-verification substitute."],
      decidedAt: "2026-07-13T08:05:00.000Z",
    },
    reviewer,
    decisionProjection,
  );
  assert.equal(decided.decision.safety.reviewCannotOverrideProviderVerification, true);
  assert.equal(decided.custodyEvent.previousCustodyRoot, assigned.custodyEvent.custodyRoot);
  assert.equal(service.projectReviewTask(opened.task.id).status, "decided");
  assert.equal(JSON.stringify(decided).includes("Retain the immutable artifact"), false);
  assert.deepEqual(
    service.decideReviewTask(
      {
        taskId: opened.task.id,
        decision: "retain_non_final",
        rationale: "Retain the immutable artifact for provider verification and later independent review.",
        limitations: ["This review is not environmental proof or a provider-verification substitute."],
        decidedAt: "2026-07-13T08:05:00.000Z",
      },
      reviewer,
      decisionProjection,
    ),
    decided,
  );
  assert.throws(
    () =>
      service.decideReviewTask(
        {
          taskId: opened.task.id,
          decision: "retain_non_final",
          rationale: "A materially different rationale cannot replace an existing immutable review decision.",
          limitations: ["This review remains bounded and non-final."],
          decidedAt: "2026-07-13T08:05:00.000Z",
        },
        reviewer,
        decisionProjection,
      ),
    /different immutable decision/,
  );

  const snapshot = service.getAuthoritySnapshot();
  const replayed = CanopyProofEvidenceMediaReviewAuthorityService.fromAuthoritySnapshot(snapshot);
  assert.deepEqual(replayed.getReviewTask(opened.task.id), opened.task);
  assert.deepEqual(replayed.getReviewAssignment(assigned.assignment.id), assigned.assignment);
  assert.deepEqual(replayed.getReviewDecision(decided.decision.id), decided.decision);
  assert.deepEqual(replayed.projectReviewTask(opened.task.id), service.projectReviewTask(opened.task.id));

  const tampered = {
    ...snapshot,
    reviewDecisions: snapshot.reviewDecisions.map((decision, index) =>
      index === 0 ? { ...decision, rationaleHash: "f".repeat(64) } : decision),
  };
  assert.throws(
    () => CanopyProofEvidenceMediaReviewAuthorityService.fromAuthoritySnapshot(tampered),
    /review decision lineage is invalid/,
  );
});

test("CanopyProof E3a rejects cross-organization and contributor self-review authority", () => {
  const fixture = mediaFixture();
  const service = new CanopyProofEvidenceMediaReviewAuthorityService(fixture.streamEvents);
  const openedAt = "2026-07-13T09:00:00.000Z";
  const opener = reviewActor("cp_media_review_admin", "admin");
  const projection = fixture.media.projectMediaObject(fixture.object.id, openedAt, {
    consent: fixture.custody.projectConsentReceipt(fixture.intent.consentReceiptId, openedAt),
    device: fixture.custody.projectDeviceAttestation(fixture.intent.deviceAttestationId, openedAt),
  });
  const opened = service.openReviewTask(
    {
      objectId: fixture.object.id,
      reasonCodes: ["manual_independent_review"],
      severity: "medium",
      policyId: "canopyproof-media-review-v1",
      openedAt,
      dueAt: "2026-07-14T09:00:00.000Z",
    },
    { intent: fixture.intent, object: fixture.object, mediaProjection: projection, opener },
  );
  const owner = reviewActor("cp_media_review_assignment_owner", "owner");
  const contributorReviewer = reviewActor(subjectId, "verifier", true);
  assert.throws(
    () =>
      service.assignReviewTask(
        { taskId: opened.task.id, reviewerId: subjectId, assignedAt: "2026-07-13T09:01:00.000Z" },
        owner,
        contributorReviewer,
      ),
    /independent human reviewer/,
  );

  const wrongOrganizationReviewer = {
    ...reviewActor("cp_media_review_external_verifier", "verifier", true),
    organizationId: "cp_media_review_other_org",
  };
  assert.throws(
    () =>
      service.assignReviewTask(
        {
          taskId: opened.task.id,
          reviewerId: wrongOrganizationReviewer.id,
          assignedAt: "2026-07-13T09:01:00.000Z",
        },
        owner,
        wrongOrganizationReviewer,
      ),
    /authority root is invalid|organization mismatch/,
  );
});
