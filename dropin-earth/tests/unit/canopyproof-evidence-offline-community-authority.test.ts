import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceConsentProjection,
  type CanopyProofEvidenceConsentReceiptFact,
  type CanopyProofEvidenceCustodyActorSnapshot,
  type CanopyProofEvidenceDeviceAttestationFact,
  type CanopyProofEvidenceDeviceAttestationProjection,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  CanopyProofCommunityAttestationAuthorityService,
  CanopyProofEvidenceOfflineSyncAuthorityService,
  communityAttestationGenesis,
  offlineBatchGenesis,
} from "../../services/api/src/domain/canopyproof/evidence-offline-community-authority.js";
import type {
  CanopyProofEvidenceProjectBoundary,
  CanopyProofEvidenceRegistration,
} from "../../services/api/src/domain/canopyproof/evidence-registry.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

const organizationId = "cp_e4_org";
const projectId = "cp_e4_project";
const contributorId = "cp_e4_contributor";
const attesterId = "cp_e4_attester";
const projectRoot = hashJson({ kind: "e4-test-project" });
const consentRoot = hashJson({ kind: "e4-test-consent" });
const consentProjectionRoot = hashJson({ kind: "e4-test-consent-projection" });
const deviceRoot = hashJson({ kind: "e4-test-device" });
const deviceProjectionRoot = hashJson({ kind: "e4-test-device-projection" });
const fingerprintHash = hashJson({ kind: "e4-test-fingerprint" });

test("E4 offline reconciliation is device-sequenced, consent-bound, and replayable", () => {
  const service = new CanopyProofEvidenceOfflineSyncAuthorityService();
  const authority = offlineAuthority("batch-field-001", "needs_review");
  const bundle = service.recordOfflineBundle(
    offlineInput("batch-field-001", 1, offlineBatchGenesis(authority.device.id, authority.device.attestationRoot)),
    authority,
  );

  assert.equal(bundle.batch.batchState, "needs_review");
  assert.equal(bundle.items.length, 1);
  assert.equal(bundle.items[0]?.result, "needs_review");
  assert.deepEqual(bundle.items[0]?.issueCodes, ["device_attestation_needs_review"]);
  assert.equal(bundle.batch.auditEvent.action, "CHALLENGE");
  assert.equal(bundle.batch.safety.rawPayloadExcluded, true);
  assert.equal(bundle.batch.safety.communityCannotMutateVerification, true);
  assert.deepEqual(
    CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot()).getBundle(
      bundle.batch.id,
    ),
    bundle,
  );

  const secondAuthority = offlineAuthority("batch-field-002", "needs_review");
  const second = service.recordOfflineBundle(
    offlineInput("batch-field-002", 2, bundle.batch.batchRoot, "client-record-002"),
    secondAuthority,
  );
  assert.equal(second.batch.deviceSequence, 2);
  assert.equal(second.batch.previousBatchRoot, bundle.batch.batchRoot);

  assert.throws(
    () =>
      service.recordOfflineBundle(
        offlineInput("batch-field-003", 4, second.batch.batchRoot, "client-record-003"),
        offlineAuthority("batch-field-003", "needs_review"),
      ),
    /device sequence is not contiguous/,
  );
});

test("E4 offline reconciliation rejects stale consent and substituted evidence authority", () => {
  const service = new CanopyProofEvidenceOfflineSyncAuthorityService();
  const authority = offlineAuthority("batch-denied-001", "needs_review");
  assert.throws(
    () =>
      service.recordOfflineBundle(
        offlineInput("batch-denied-001", 1, offlineBatchGenesis(authority.device.id, authority.device.attestationRoot)),
        {
          ...authority,
          consentProjection: { ...authority.consentProjection, state: "revoked" },
        },
      ),
    /consent, device, actor, or project authority mismatch/,
  );

  assert.throws(
    () =>
      service.recordOfflineBundle(
        offlineInput("batch-denied-001", 1, offlineBatchGenesis(authority.device.id, authority.device.attestationRoot)),
        {
          ...authority,
          registrations: [{ ...authority.registrations[0]!, contributor: "cp_e4_substitute" }],
        },
      ),
    /offline evidence authority mismatch/,
  );
  assert.equal(service.listBatches().length, 0);
});

test("E4 community challenges append hash-only non-final context without mutating evidence", () => {
  const evidence = registration("batch-community-001", contributorId);
  const service = new CanopyProofCommunityAttestationAuthorityService();
  const before = hashJson(evidence);
  const fact = service.recordAttestation(
    {
      stance: "challenge",
      relationship: "resident",
      observationBasis: "direct_observation",
      conflictOfInterestDeclared: false,
      noteHash: hashJson({ note: "Plot boundary differs from the field observation." }),
      confidenceScore: 67,
      reasonCodes: ["plot_boundary_conflict", "duplicate_media_suspected"],
      observedAt: "2026-07-14T02:40:00.000Z",
      createdAt: "2026-07-14T02:45:00.000Z",
    },
    { actor: actor(attesterId, "community"), evidence },
  );

  assert.equal(fact.attestationState, "review_required");
  assert.equal(fact.auditEvent.action, "CHALLENGE");
  assert.equal("note" in fact, false);
  assert.equal(hashJson(evidence), before);
  assert.equal(fact.safety.communityAttestationNonFinal, true);
  assert.equal(fact.safety.communityCannotMutateVerification, true);
  assert.deepEqual(fact.reasonCodes, ["duplicate_media_suspected", "plot_boundary_conflict"]);
  const projection = service.projectSignal(organizationId, evidence.id, evidence.evidenceRoot);
  assert.equal(projection.state, "review_required");
  assert.equal(projection.advisoryOnly, true);
  assert.equal(projection.finalVerificationChanged, false);
  assert.deepEqual(
    CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot()).getAttestation(
      fact.id,
    ),
    fact,
  );

  assert.throws(
    () =>
      service.recordAttestation(
        {
          stance: "support",
          relationship: "resident",
          observationBasis: "local_knowledge",
          conflictOfInterestDeclared: false,
          noteHash: hashJson({ note: "Repeated vote" }),
          confidenceScore: 80,
          reasonCodes: [],
          observedAt: "2026-07-14T02:41:00.000Z",
          createdAt: "2026-07-14T02:46:00.000Z",
        },
        { actor: actor(attesterId, "community"), evidence },
      ),
    /already attested/,
  );
});

test("E4 rejects self-attestation, ineligible roles, and tampered replay roots", () => {
  const evidence = registration("batch-community-002", contributorId);
  const input = {
    stance: "support" as const,
    relationship: "field_observer" as const,
    observationBasis: "direct_observation" as const,
    conflictOfInterestDeclared: false as const,
    noteHash: hashJson({ note: "Observed the registered planting activity." }),
    confidenceScore: 75,
    reasonCodes: [],
    observedAt: "2026-07-14T02:50:00.000Z",
    createdAt: "2026-07-14T02:55:00.000Z",
  };
  assert.throws(
    () =>
      new CanopyProofCommunityAttestationAuthorityService().recordAttestation(input, {
        actor: actor(contributorId, "community"),
        evidence,
      }),
    /cannot self-attest/,
  );
  assert.throws(
    () =>
      new CanopyProofCommunityAttestationAuthorityService().recordAttestation(input, {
        actor: actor(attesterId, "owner"),
        evidence,
      }),
    /role is not eligible/,
  );

  const service = new CanopyProofCommunityAttestationAuthorityService();
  const fact = service.recordAttestation(input, { actor: actor(attesterId, "community"), evidence });
  assert.equal(
    fact.previousAttestationRoot,
    communityAttestationGenesis(evidence.id, evidence.evidenceRoot),
  );
  assert.throws(
    () =>
      CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot({
        streamEvents: service.getAuthoritySnapshot().streamEvents,
        attestations: [{ ...fact, attestationRoot: "0".repeat(64) }],
      }),
    /lineage is invalid/,
  );
});

function offlineAuthority(
  clientBatchId: string,
  deviceState: CanopyProofEvidenceDeviceAttestationProjection["state"],
) {
  const contributor = actor(contributorId, "community");
  return {
    actor: contributor,
    project: project(),
    consent: consent(contributor),
    consentProjection: consentProjection(),
    device: device(contributor),
    deviceProjection: deviceProjection(deviceState),
    registrations: [registration(clientBatchId, contributorId)],
  };
}

function offlineInput(
  clientBatchId: string,
  deviceSequence: number,
  previousBatchRoot: string,
  clientRecordId = "client-record-001",
) {
  const evidence = registration(clientBatchId, contributorId);
  return {
    clientBatchId,
    deviceSequence,
    previousBatchRoot,
    deviceClockStartedAt: "2026-07-14T01:00:00.000Z",
    deviceClockEndedAt: "2026-07-14T02:00:00.000Z",
    receivedAt: "2026-07-14T03:00:00.000Z",
    connectivity: "offline" as const,
    items: [
      {
        clientRecordId,
        evidenceId: evidence.id,
        evidenceRoot: evidence.evidenceRoot,
        clientPayloadHash: hashJson({ kind: "e4-client-payload", clientBatchId }),
      },
    ],
  };
}

function actor(
  id: string,
  role: CanopyProofEvidenceCustodyActorSnapshot["role"],
): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "e4-test-participant", id }),
    organizationRoot: hashJson({ kind: "e4-test-organization", organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "e4-test-membership", id, role }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function project(): CanopyProofEvidenceProjectBoundary {
  return {
    id: projectId,
    organizationId,
    regionId: "e4-region",
    status: "active",
    projectRoot,
    updatedAt: "2026-07-14T00:00:00.000Z",
  };
}

function consent(owner: CanopyProofEvidenceCustodyActorSnapshot): CanopyProofEvidenceConsentReceiptFact {
  return {
    factType: "evidence_consent_receipt",
    id: "cp_e4_consent",
    organizationId,
    subjectId: owner.id,
    subjectRoot: owner.participantRoot,
    subjectAuthorityRoot: owner.authorityRoot,
    deviceFingerprintHash: fingerprintHash,
    purposes: ["evidence_collection", "geolocation", "media_upload"],
    lawfulBasis: "consent",
    privacyMode: "restricted",
    policyVersion: "e4-consent-v1",
    evidenceHash: hashJson({ kind: "e4-consent-evidence" }),
    grantedAt: "2026-07-14T00:10:00.000Z",
    expiresAt: "2027-07-14T00:10:00.000Z",
    retentionDays: 365,
    actor: owner,
    commandHash: hashJson({ kind: "e4-consent-command" }),
    subjectSequence: 1,
    previousEventRoot: hashJson({ kind: "e4-consent-previous" }),
    receiptHash: hashJson({ kind: "e4-consent-hash" }),
    receiptRoot: consentRoot,
    safety: custodySafety(),
    auditEvent: audit(owner.id, "consent_receipt", "cp_e4_consent"),
  };
}

function consentProjection(): CanopyProofEvidenceConsentProjection {
  return {
    receiptId: "cp_e4_consent",
    receiptRoot: consentRoot,
    organizationId,
    subjectId: contributorId,
    state: "active",
    evaluatedAt: "2026-07-14T03:00:00.000Z",
    projectionRoot: consentProjectionRoot,
    safety: custodySafety(),
  };
}

function device(owner: CanopyProofEvidenceCustodyActorSnapshot): CanopyProofEvidenceDeviceAttestationFact {
  return {
    factType: "evidence_device_attestation",
    id: "cp_e4_device",
    organizationId,
    subjectId: owner.id,
    subjectRoot: owner.participantRoot,
    subjectAuthorityRoot: owner.authorityRoot,
    consentReceiptId: "cp_e4_consent",
    consentReceiptRoot: consentRoot,
    deviceFingerprintHash: fingerprintHash,
    attestationType: "secure_enclave",
    provider: "apple_app_attest",
    providerKeyId: "e4-provider-key",
    providerReceiptHash: hashJson({ kind: "e4-provider-receipt" }),
    providerVerificationState: "modeled_only",
    publicKeyHash: hashJson({ kind: "e4-public-key" }),
    attestationHash: hashJson({ kind: "e4-attestation" }),
    issuedAt: "2026-07-14T00:20:00.000Z",
    expiresAt: "2027-01-14T00:20:00.000Z",
    reputationScore: 80,
    riskFlags: [],
    actor: owner,
    commandHash: hashJson({ kind: "e4-device-command" }),
    subjectSequence: 2,
    previousEventRoot: hashJson({ kind: "e4-device-previous" }),
    deviceHash: hashJson({ kind: "e4-device-hash" }),
    attestationRoot: deviceRoot,
    safety: custodySafety(),
    auditEvent: audit(owner.id, "device_attestation", "cp_e4_device"),
  };
}

function deviceProjection(
  state: CanopyProofEvidenceDeviceAttestationProjection["state"],
): CanopyProofEvidenceDeviceAttestationProjection {
  return {
    attestationId: "cp_e4_device",
    attestationRoot: deviceRoot,
    organizationId,
    subjectId: contributorId,
    consentReceiptId: "cp_e4_consent",
    state,
    evaluatedAt: "2026-07-14T03:00:00.000Z",
    consentProjectionRoot,
    projectionRoot: deviceProjectionRoot,
    safety: custodySafety(),
  };
}

function registration(clientBatchId: string, contributor: string): CanopyProofEvidenceRegistration {
  const id = `evidence_${clientBatchId}`;
  const evidenceHash = hashJson({ kind: "e4-evidence-hash", id, contributor });
  const evidenceRoot = hashJson({ kind: "e4-evidence-root", evidenceHash, projectRoot });
  return {
    id,
    projectId,
    organizationId,
    projectRootAtSubmission: projectRoot,
    projectStatusAtSubmission: "active",
    projectRegionIdAtSubmission: "e4-region",
    projectAuthorityUpdatedAtAtSubmission: "2026-07-14T00:00:00.000Z",
    evidenceType: "tree_planting",
    location: { latitude: 0, longitude: 0, accuracyMeters: 8, regionId: "e4-region" },
    timestamp: "2026-07-14T01:30:00.000Z",
    createdAt: "2026-07-14T02:30:00.000Z",
    contributor,
    contributorRole: "community",
    media_hash: hashJson({ kind: "e4-media", id }),
    gps_hash: hashJson({ kind: "e4-gps", id }),
    verification_status: "validated",
    confidence_score: 80,
    reviewers: [],
    validationIssues: [],
    offline_sync_id: clientBatchId,
    device_fingerprint_hash: fingerprintHash,
    evidenceHash,
    evidenceRoot,
    audit_history: [audit(contributor, "evidence", id)],
    claimBoundary: {
      structuralValidationOnly: true,
      pendingAiAndHumanReview: true,
      notFinalVerification: true,
      notCertificate: true,
      notCertifiedCarbonCredit: true,
      notCarbonTaxOffset: true,
      notFinancialAsset: true,
      notGuaranteedYield: true,
      noMainnetFunds: true,
      notAutomaticCanopyDistribution: true,
      disclosure: "Test evidence remains non-final.",
    },
  };
}

function audit(actorId: string, entityType: "consent_receipt" | "device_attestation" | "evidence", entityId: string) {
  return appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType,
    entityId,
    payload: { entityId },
    createdAt: "2026-07-14T00:00:00.000Z",
    rationale: "Deterministic E4 authority unit-test fixture.",
  })[0]!;
}

function custodySafety() {
  return {
    appendOnly: true as const,
    subjectBound: true as const,
    organizationBound: true as const,
    semanticEventBound: true as const,
    noRawDeviceIdentifier: true as const,
    noRawProviderCredential: true as const,
    providerVerificationRequiredForHardwareTrust: true as const,
    notFinalProofAuthority: true as const,
    notCertifiedCarbonCredit: true as const,
    notCarbonTaxOffset: true as const,
    notFinancialAsset: true as const,
    notGuaranteedYield: true as const,
    noMainnetFunds: true as const,
    notAutomaticCanopyDistribution: true as const,
  };
}
