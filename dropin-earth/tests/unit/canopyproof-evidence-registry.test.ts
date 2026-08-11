import assert from "node:assert/strict";
import test from "node:test";
import {
  CanopyProofEvidenceRegistryService,
  type CanopyProofEvidenceProjectBoundary,
} from "../../services/api/src/domain/canopyproof/evidence-registry.js";

const project: CanopyProofEvidenceProjectBoundary = {
  id: "cp_project_evidence_registry_001",
  organizationId: "cp_org_evidence_registry_001",
  regionId: "region_ggw_sahel",
  status: "active",
  projectRoot: "7".repeat(64),
  updatedAt: "2026-07-08T00:30:00.000Z",
};

function evidencePayload(
  id = "cp_evidence_registry_001",
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    id,
    projectId: project.id,
    evidenceType: "tree_planting",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 12,
      regionId: project.regionId,
    },
    timestamp: "2026-07-08T01:00:00.000Z",
    createdAt: "2026-07-08T01:05:00.000Z",
    media_hash: "1".repeat(64),
    gps_hash: "2".repeat(64),
    confidence_score: 84,
    device_fingerprint_hash: "3".repeat(64),
    exif_hash: "4".repeat(64),
    ...overrides,
  };
}

test("CanopyProof evidence registry creates immutable, project-bound structural registrations", () => {
  const service = new CanopyProofEvidenceRegistryService();
  const result = service.registerEvidence(
    evidencePayload(),
    project,
    "cp_evidence_contributor_001",
    "community",
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.evidence.verification_status, "validated");
  assert.equal(result.evidence.projectRootAtSubmission, project.projectRoot);
  assert.equal(result.evidence.projectRegionIdAtSubmission, project.regionId);
  assert.equal(result.evidence.projectStatusAtSubmission, "active");
  assert.equal(result.evidence.projectAuthorityUpdatedAtAtSubmission, project.updatedAt);
  assert.equal(result.evidence.audit_history.length, 1);
  assert.equal(result.evidence.audit_history[0].action, "ASSERT");
  assert.equal(result.evidence.audit_history[0].actor, "cp_evidence_contributor_001");
  assert.equal(result.evidence.claimBoundary.structuralValidationOnly, true);
  assert.equal(result.evidence.claimBoundary.pendingAiAndHumanReview, true);
  assert.equal(result.evidence.claimBoundary.notFinalVerification, true);
  assert.equal(result.evidence.claimBoundary.notCertifiedCarbonCredit, true);
  assert.equal(result.evidence.claimBoundary.noMainnetFunds, true);
  assert.match(result.evidence.evidenceHash, /^[a-f0-9]{64}$/);
  assert.match(result.evidence.evidenceRoot, /^[a-f0-9]{64}$/);

  const status = service.getStatus();
  assert.equal(status.registrationCount, 1);
  assert.equal(status.validatedCount, 1);
  assert.equal(status.challengedCount, 0);
  assert.equal(status.safety.structuralValidationNotFinal, true);
  assert.equal(status.safety.aiCannotApprove, true);
});

test("CanopyProof evidence registry deterministically challenges weak or cross-region envelopes", () => {
  const service = new CanopyProofEvidenceRegistryService();
  const result = service.registerEvidence(
    evidencePayload("cp_evidence_registry_challenged", {
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 250,
        regionId: "region_outside_project",
      },
      media_hash: "5".repeat(64),
      confidence_score: 18,
    }),
    project,
    "cp_evidence_researcher_001",
    "researcher",
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["gps_accuracy_too_weak", "project_region_mismatch"]);
  assert.equal(result.evidence.verification_status, "challenged");
  assert.equal(result.evidence.confidence_score, 18);
  assert.equal(result.evidence.audit_history[0].action, "CHALLENGE");

  const replayed = CanopyProofEvidenceRegistryService.fromAuthoritySnapshot({
    registrations: [result.evidence],
  });
  assert.deepEqual(replayed.getEvidence(result.evidence.id), result.evidence);
  assert.equal(replayed.getStatus().challengedCount, 1);

  assert.throws(
    () =>
      CanopyProofEvidenceRegistryService.fromAuthoritySnapshot({
        registrations: [
          {
            ...result.evidence,
            projectRegionIdAtSubmission: "region_outside_project",
          },
        ],
      }),
    /hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofEvidenceRegistryService.fromAuthoritySnapshot({
        registrations: [{ ...result.evidence, evidenceHash: "f".repeat(64) }],
      }),
    /hash lineage is invalid/,
  );
});

test("CanopyProof evidence registry provides exact retry idempotency and rejects identity or media conflicts", () => {
  const service = new CanopyProofEvidenceRegistryService();
  const payload = evidencePayload("cp_evidence_registry_retry");
  const first = service.registerEvidence(payload, project, "cp_evidence_owner_001", "owner");
  const replay = service.registerEvidence(payload, project, "cp_evidence_owner_001", "owner");

  assert.equal(replay.evidence.evidenceHash, first.evidence.evidenceHash);
  assert.equal(service.getStatus().registrationCount, 1);

  assert.throws(
    () =>
      service.registerEvidence(
        { ...payload, gps_hash: "9".repeat(64) },
        project,
        "cp_evidence_owner_001",
        "owner",
      ),
    /conflicting payload/,
  );
  assert.throws(
    () =>
      service.registerEvidence(
        evidencePayload("cp_evidence_registry_duplicate_media", {
          media_hash: payload.media_hash,
        }),
        project,
        "cp_evidence_owner_001",
        "owner",
      ),
    /media hash is already registered/,
  );
});

test("CanopyProof evidence registry fails closed on invalid time, archived projects, and unsafe claims", () => {
  const service = new CanopyProofEvidenceRegistryService();

  assert.throws(
    () =>
      service.registerEvidence(
        evidencePayload("cp_evidence_registry_future", {
          timestamp: "2026-07-08T01:10:00.000Z",
          createdAt: "2026-07-08T01:05:00.000Z",
        }),
        project,
        "cp_evidence_verifier_001",
        "verifier",
      ),
    /cannot occur after registration time/,
  );
  assert.throws(
    () =>
      service.registerEvidence(
        evidencePayload("cp_evidence_registry_backdated", {
          timestamp: "2026-07-08T00:10:00.000Z",
          createdAt: "2026-07-08T00:20:00.000Z",
        }),
        project,
        "cp_evidence_verifier_001",
        "verifier",
      ),
    /cannot predate the bound project authority/,
  );
  assert.throws(
    () =>
      service.registerEvidence(
        evidencePayload("cp_evidence_registry_archived"),
        { ...project, status: "archived" },
        "cp_evidence_verifier_001",
        "verifier",
      ),
    /archived project cannot accept/,
  );
  assert.throws(
    () =>
      service.registerEvidence(
        evidencePayload("certified carbon credit evidence"),
        project,
        "cp_evidence_verifier_001",
        "verifier",
      ),
    /unsupported public claim/,
  );
});
