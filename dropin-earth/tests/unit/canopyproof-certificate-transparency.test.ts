import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { app } from "../../services/api/src/app.js";
import { CanopyProofCertificateTransparencyService } from "../../services/api/src/domain/canopyproof/certificate-transparency.js";
import { buildCanopyProofProofRecordSubjectId } from "../../services/api/src/domain/canopyproof/governance.js";
import { environmentalProofClaimBoundary } from "../../services/api/src/domain/canopyproof/proof-engine.js";
import type { CanopyProofCertificateArtifact } from "../../services/api/src/domain/canopyproof/proof-service.js";

const timestamp = "2026-07-10T00:00:00.000Z";

function headers(role: string, actorId = `${role}_certificate_transparency_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function certificateArtifact(overrides: Partial<CanopyProofCertificateArtifact> = {}): CanopyProofCertificateArtifact {
  const artifactBase = {
    certificateId: "cp_cert_transparency_domain_001",
    certificateVersion: "canopyproof_certificate_artifact_v1" as const,
    recordId: "cp_record_transparency_domain_001",
    recordType: "environmental_proof_record" as const,
    project: {
      id: "project_v1_ggw_demo",
      evidenceCount: 1,
    },
    location: {
      primary: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 10,
        regionId: "region_ggw_sahel",
      },
      evidenceLocations: [
        {
          latitude: 14.7167,
          longitude: -17.4677,
          accuracyMeters: 10,
          regionId: "region_ggw_sahel",
        },
      ],
    },
    evidenceRoot: "a".repeat(64),
    evidenceIds: ["cp_evidence_transparency_domain_001"],
    verificationHistory: [],
    monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
    monitoringEventIds: [],
    monitoringEventRoot: "b".repeat(64),
    projectMonitoringEvents: [],
    contributors: ["community_certificate_transparency_domain"],
    governanceApprovalIds: ["cp_governance_certificate_transparency_domain_001"],
    governanceApprovals: [
      {
        id: "cp_governance_certificate_transparency_domain_001",
        subjectType: "proof_record" as const,
        subjectId: "proof_record:project_v1_ggw_demo:cp_evidence_transparency_domain_001",
        policyId: "canopyproof_policy_proof_record_issuance_v1",
        reviewer: "verifier_certificate_transparency_domain",
        reviewerRole: "verifier" as const,
        decision: "approve" as const,
        rationale: "Approved bounded proof-record issuance for certificate transparency replay.",
        conflictDisclosure: "No known conflict disclosed for certificate transparency publication.",
        decidedAt: timestamp,
        approvalHash: "c".repeat(64),
        auditEventRoot: "d".repeat(64),
      },
    ],
    publicChallenges: [],
    status: "issued" as const,
    issuedAt: timestamp,
    sourceRecordHash: "e".repeat(64),
    claimBoundary: environmentalProofClaimBoundary(),
    disclosure: environmentalProofClaimBoundary().disclosure,
    ...overrides,
  };
  return {
    ...artifactBase,
    certificateHash: hashJson(artifactBase),
  };
}

function evidencePayload(id: string, mediaHash: string) {
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
    contributor: `community_certificate_transparency_${id}`,
    media_hash: mediaHash,
    gps_hash: "1".repeat(64),
    confidence_score: 92,
    offline_sync_id: `offline_${id}`,
    device_fingerprint_hash: "2".repeat(64),
    exif_hash: "3".repeat(64),
  };
}

async function createProofRecordForCertificateTransparency(suffix: string) {
  const projectId = "project_v1_ggw_demo";
  const evidenceId = `evidence_certificate_transparency_${suffix}`;
  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    headers: headers("community", `community_certificate_transparency_${suffix}`),
    body: JSON.stringify(evidencePayload(evidenceId, suffix.endsWith("002") ? "5".repeat(64) : "4".repeat(64))),
  });
  assert.equal(evidenceResponse.status, 201);

  const aiResponse = await app.request(`/canopyproof/evidence/${evidenceId}/ai-analysis`, {
    method: "POST",
    headers: headers("agent", `canopy_ai_certificate_transparency_${suffix}`),
    body: JSON.stringify({ observedAt: "2026-07-10T00:05:00.000Z" }),
  });
  assert.equal(aiResponse.status, 201);

  const approvalResponse = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    headers: headers("verifier", `verifier_certificate_transparency_approval_${suffix}`),
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId: buildCanopyProofProofRecordSubjectId({ projectId, evidenceIds: [evidenceId] }),
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approved for certificate transparency lifecycle testing after evidence and AI advisory review.",
      conflictDisclosure: "No known conflict disclosed for this certificate transparency approval.",
      decidedAt: "2026-07-10T00:30:00.000Z",
    }),
  });
  assert.equal(approvalResponse.status, 201);
  const approvalBody = await json<{ ok: true; data: { id: string } }>(approvalResponse);

  const recordResponse = await app.request("/canopyproof/proof-records", {
    method: "POST",
    headers: headers("verifier", `verifier_certificate_transparency_issuer_${suffix}`),
    body: JSON.stringify({
      projectId,
      evidenceIds: [evidenceId],
      humanReview: {
        reviewer: "body_reviewer_overridden",
        role: "verifier",
        decision: "approve",
        rationale: "Approved after field review and advisory AI checks for certificate transparency publication.",
        reviewedAt: "2026-07-10T01:00:00.000Z",
      },
      governanceApprovals: [approvalBody.data.id],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
      issuedAt: "2026-07-10T02:00:00.000Z",
    }),
  });
  assert.equal(recordResponse.status, 201);
  const recordBody = await json<{ ok: true; data: { id: string; recordHash: string; evidenceRoot: string; status: string } }>(recordResponse);
  assert.equal(recordBody.data.status, "issued");
  return recordBody.data;
}

test("CanopyProof certificate transparency service publishes and verifies replayable artifact entries", () => {
  const service = new CanopyProofCertificateTransparencyService();
  const artifact = certificateArtifact();
  const entry = service.publishCertificateArtifact({ publishedAt: "2026-07-10T01:00:00.000Z" }, artifact, "verifier_certificate_transparency_domain");

  assert.equal(entry.certificateId, artifact.certificateId);
  assert.equal(entry.recordId, artifact.recordId);
  assert.equal(entry.projectId, "project_v1_ggw_demo");
  assert.equal(entry.status, "active");
  assert.equal(entry.certificateHash, artifact.certificateHash);
  assert.match(entry.entryHash, /^[a-f0-9]{64}$/);
  assert.equal(entry.safety.publicVerification, true);
  assert.equal(entry.safety.noCarbonCreditAuthority, true);
  assert.equal(entry.auditEvent.entityType, "certificate_transparency_entry");
  assert.equal(entry.auditEvent.action, "ASSERT");

  const verified = service.verifyCertificateArtifact(
    {
      artifact,
      expectedEntryHash: entry.entryHash,
      expectedRecordHash: artifact.sourceRecordHash,
      expectedEvidenceRoot: artifact.evidenceRoot,
      expectedMonitoringEventRoot: artifact.monitoringEventRoot,
      expectedGovernanceApprovalRoot: entry.governanceApprovalRoot,
      expectedChallengeRoot: entry.challengeRoot,
      verifiedAt: "2026-07-10T01:05:00.000Z",
    },
    "observer_certificate_transparency_domain",
  );

  assert.equal(verified.valid, true);
  assert.deepEqual(verified.issues, []);
  assert.equal(verified.certificateHash, artifact.certificateHash);
  assert.equal(verified.recomputedCertificateHash, artifact.certificateHash);
  assert.equal(verified.recomputedEntryHash, entry.entryHash);
  assert.equal(verified.auditEvent.entityType, "certificate_verification");
  assert.equal(verified.auditEvent.action, "ASSERT");
  assert.equal(service.getStatus().entryCount, 1);
  assert.equal(service.getStatus().activeCount, 1);
});

test("CanopyProof certificate transparency service detects tampering and unsafe boundaries", () => {
  const service = new CanopyProofCertificateTransparencyService();
  const artifact = certificateArtifact();
  const entry = service.publishCertificateArtifact({}, artifact, "verifier_certificate_transparency_domain");
  const tampered = {
    ...artifact,
    sourceRecordHash: "0".repeat(64),
    claimBoundary: {
      ...artifact.claimBoundary,
      notCarbonCredit: false,
    },
  };

  const result = service.verifyCertificateArtifact(
    {
      artifact: tampered,
      expectedEntryHash: entry.entryHash,
      expectedRecordHash: artifact.sourceRecordHash,
      verifiedAt: "2026-07-10T01:10:00.000Z",
    },
    "observer_certificate_transparency_domain",
  );

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("invalid_certificate_hash"));
  assert.ok(result.issues.includes("entry_hash_mismatch"));
  assert.ok(result.issues.includes("record_hash_mismatch"));
  assert.ok(result.issues.includes("claim_boundary_violation"));
  assert.equal(result.auditEvent.action, "CHALLENGE");

  const { certificateHash, ...tamperedBase } = tampered;
  void certificateHash;
  assert.throws(
    () =>
      service.publishCertificateArtifact(
        {},
        { ...tamperedBase, certificateHash: hashJson(tamperedBase) } as CanopyProofCertificateArtifact,
        "verifier",
      ),
    /violates the non-credit\/non-financial claim boundary/,
  );
});

test("CanopyProof certificate transparency API publishes, lists, reads, and verifies artifacts", async () => {
  const record = await createProofRecordForCertificateTransparency("api_001");
  const certificateResponse = await app.request(`/canopyproof/proof-records/${record.id}/certificate`, {
    headers: headers("observer", "observer_certificate_transparency_artifact"),
  });
  assert.equal(certificateResponse.status, 200);
  const certificateBody = await json<{ ok: true; data: CanopyProofCertificateArtifact }>(certificateResponse);

  const communityDenied = await app.request(`/canopyproof/proof-records/${record.id}/certificate/transparency`, {
    method: "POST",
    headers: headers("community", "community_certificate_transparency_denied"),
    body: JSON.stringify({}),
  });
  assert.equal(communityDenied.status, 403);

  const published = await app.request(`/canopyproof/proof-records/${record.id}/certificate/transparency`, {
    method: "POST",
    headers: headers("verifier", "verifier_certificate_transparency_publisher"),
    body: JSON.stringify({ publishedAt: "2026-07-10T03:00:00.000Z" }),
  });
  assert.equal(published.status, 201);
  const publishedBody = await json<{
    ok: true;
    data: {
      id: string;
      certificateId: string;
      recordId: string;
      projectId: string;
      status: string;
      entryHash: string;
      governanceApprovalRoot: string;
      challengeRoot: string;
      safety: { publicVerification: true; rawEvidenceExcluded: true };
      auditEvent: { entityType: string };
    };
  }>(published);
  assert.equal(publishedBody.data.certificateId, certificateBody.data.certificateId);
  assert.equal(publishedBody.data.recordId, record.id);
  assert.equal(publishedBody.data.projectId, "project_v1_ggw_demo");
  assert.equal(publishedBody.data.status, "active");
  assert.match(publishedBody.data.entryHash, /^[a-f0-9]{64}$/);
  assert.equal(publishedBody.data.safety.publicVerification, true);
  assert.equal(publishedBody.data.safety.rawEvidenceExcluded, true);
  assert.equal(publishedBody.data.auditEvent.entityType, "certificate_transparency_entry");

  const listed = await app.request(`/canopyproof/certificates/transparency/entries?recordId=${record.id}&status=active`, {
    headers: headers("observer", "observer_certificate_transparency_list"),
  });
  assert.equal(listed.status, 200);
  const listedBody = await json<{ ok: true; data: Array<{ id: string; recordId: string }> }>(listed);
  assert.ok(listedBody.data.some((item) => item.id === publishedBody.data.id && item.recordId === record.id));

  const detail = await app.request(`/canopyproof/certificates/transparency/entries/${publishedBody.data.id}`, {
    headers: headers("agent", "agent_certificate_transparency_detail"),
  });
  assert.equal(detail.status, 200);

  const verified = await app.request("/canopyproof/certificates/transparency/verify", {
    method: "POST",
    headers: headers("observer", "observer_certificate_transparency_verify"),
    body: JSON.stringify({
      artifact: certificateBody.data,
      expectedEntryHash: publishedBody.data.entryHash,
      expectedRecordHash: certificateBody.data.sourceRecordHash,
      expectedEvidenceRoot: certificateBody.data.evidenceRoot,
      expectedGovernanceApprovalRoot: publishedBody.data.governanceApprovalRoot,
      expectedChallengeRoot: publishedBody.data.challengeRoot,
      verifiedAt: "2026-07-10T03:05:00.000Z",
    }),
  });
  assert.equal(verified.status, 200);
  const verifiedBody = await json<{ ok: true; data: { valid: boolean; issues: string[]; auditEvent: { entityType: string } } }>(verified);
  assert.equal(verifiedBody.data.valid, true);
  assert.deepEqual(verifiedBody.data.issues, []);
  assert.equal(verifiedBody.data.auditEvent.entityType, "certificate_verification");

  const tampered = await app.request("/canopyproof/certificates/transparency/verify", {
    method: "POST",
    headers: headers("observer", "observer_certificate_transparency_tamper"),
    body: JSON.stringify({
      artifact: {
        ...certificateBody.data,
        evidenceRoot: "9".repeat(64),
      },
      expectedEntryHash: publishedBody.data.entryHash,
      expectedEvidenceRoot: certificateBody.data.evidenceRoot,
      verifiedAt: "2026-07-10T03:10:00.000Z",
    }),
  });
  assert.equal(tampered.status, 422);
  const tamperedBody = await json<{ ok: true; data: { valid: boolean; issues: string[] } }>(tampered);
  assert.equal(tamperedBody.data.valid, false);
  assert.ok(tamperedBody.data.issues.includes("invalid_certificate_hash"));
  assert.ok(tamperedBody.data.issues.includes("entry_hash_mismatch"));
  assert.ok(tamperedBody.data.issues.includes("evidence_root_mismatch"));

  const invalidStatus = await app.request("/canopyproof/certificates/transparency/entries?status=certified", {
    headers: headers("observer", "observer_certificate_transparency_invalid"),
  });
  assert.equal(invalidStatus.status, 400);
});

test("CanopyProof SQL contract stores append-only certificate transparency and verification rows", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS certificates\.certificate_transparency_entries/);
  assert.match(sql, /certificate_version text NOT NULL CHECK \(certificate_version = 'canopyproof_certificate_artifact_v1'\)/);
  assert.match(sql, /status text NOT NULL CHECK \(status IN \('active', 'challenged', 'revoked'\)\)/);
  assert.match(sql, /certificate_hash text NOT NULL UNIQUE/);
  assert.match(sql, /entry_hash text NOT NULL UNIQUE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS certificates\.certificate_verifications/);
  assert.match(sql, /valid boolean NOT NULL/);
  assert.match(sql, /verification_root text NOT NULL UNIQUE/);
  assert.match(sql, /certificate_transparency_entries_no_update/);
  assert.match(sql, /certificate_transparency_entries_no_delete/);
  assert.match(sql, /certificate_verifications_no_update/);
  assert.match(sql, /certificate_verifications_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON certificates\.certificate_transparency_entries/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON certificates\.certificate_verifications/);
});
