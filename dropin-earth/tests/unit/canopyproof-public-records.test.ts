import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { buildCanopyProofProofRecordSubjectId } from "../../services/api/src/domain/canopyproof/governance.js";

const timestamp = "2026-07-08T00:00:00.000Z";

function headers(role: string, actorId = `${role}_public_record_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function evidencePayload(id: string, mediaHash: string) {
  return {
    id,
    projectId: "project_v1_ggw_demo",
    evidenceType: "tree_planting",
    location: {
      latitude: 14.7167123,
      longitude: -17.4677456,
      accuracyMeters: 7,
      regionId: "region_ggw_sahel",
    },
    timestamp,
    contributor: `community_public_record_${id}`,
    media_hash: mediaHash,
    gps_hash: "a".repeat(64),
    confidence_score: 93,
    offline_sync_id: `offline_${id}`,
    device_fingerprint_hash: "b".repeat(64),
    exif_hash: "c".repeat(64),
  };
}

async function createIssuedProofRecord(suffix: string) {
  const projectId = "project_v1_ggw_demo";
  const evidenceId = `evidence_public_record_${suffix}`;

  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(evidenceId, suffix.endsWith("002") ? "2".repeat(64) : "1".repeat(64))),
    headers: headers("community", `community_public_record_${suffix}`),
  });
  assert.equal(evidenceResponse.status, 201);

  const aiResponse = await app.request(`/canopyproof/evidence/${evidenceId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({ observedAt: "2026-07-08T00:05:00.000Z" }),
    headers: headers("agent", `canopy_ai_public_record_${suffix}`),
  });
  assert.equal(aiResponse.status, 201);

  const approvalResponse = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId: buildCanopyProofProofRecordSubjectId({ projectId, evidenceIds: [evidenceId] }),
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approved for public Environmental Proof Record registration after AI advisory and human review.",
      conflictDisclosure: "No known conflict disclosed for this public record approval.",
      decidedAt: "2026-07-08T01:00:00.000Z",
    }),
    headers: headers("verifier", `verifier_public_record_approval_${suffix}`),
  });
  assert.equal(approvalResponse.status, 201);
  const approvalBody = await json<{ ok: true; data: { id: string } }>(approvalResponse);

  const recordResponse = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      evidenceIds: [evidenceId],
      humanReview: {
        reviewer: "body_reviewer_overridden",
        role: "verifier",
        decision: "approve",
        rationale: "Approved after field review and advisory AI checks for public registry read model.",
        reviewedAt: "2026-07-08T01:30:00.000Z",
      },
      governanceApprovals: [approvalBody.data.id],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
      issuedAt: "2026-07-08T02:00:00.000Z",
    }),
    headers: headers("verifier", `verifier_public_record_issuer_${suffix}`),
  });
  assert.equal(recordResponse.status, 201);
  const recordBody = await json<{ ok: true; data: { id: string; recordHash: string; evidenceRoot: string; status: string } }>(recordResponse);

  assert.equal(recordBody.data.status, "issued");
  return recordBody.data;
}

test("CanopyProof public record registry exposes redacted Environmental Proof Records without actor headers", async () => {
  const record = await createIssuedProofRecord("api_001");

  const index = await app.request("/canopyproof/public-records?projectId=project_v1_ggw_demo");
  assert.equal(index.status, 200);
  const indexBody = await json<{
    ok: true;
    data: {
      service: string;
      recordCount: number;
      issuedRecordCount: number;
      records: Array<{
        recordId: string;
        status: string;
        project: { id: string; regionId: string; title: string };
        location: {
          regionId: string;
          precision: string;
          latitude?: number;
          longitude?: number;
          accuracyMeters?: number;
        };
        evidence: { evidenceCount: number; evidenceRoot: string };
        governance: { approvalCount: number; approvalRoot: string };
        challenges: { totalCount: number; publicSummaries: unknown[] };
        hashes: { sourceRecordHash: string; publicRecordHash: string };
        claimBoundary: { notCarbonCredit: boolean; notFinancialAsset: boolean };
        contributors?: unknown;
        verificationHistory?: unknown;
        evidenceIds?: unknown;
      }>;
      lineage: { publicRecordRoot: string; sourceRecordRoot: string };
      safety: {
        canonical: boolean;
        durable: boolean;
        institutionalRelianceAuthorized: boolean;
        publicSafeReadModel: boolean;
        preciseEvidenceLocationsRedacted: boolean;
        contributorIdentifiersRedacted: boolean;
      };
    };
  }>(index);

  assert.equal(indexBody.data.service, "canopyproof-public-record-registry");
  assert.ok(indexBody.data.recordCount >= 1);
  assert.ok(indexBody.data.issuedRecordCount >= 1);
  const publicRecord = indexBody.data.records.find((item) => item.recordId === record.id);
  assert.ok(publicRecord);
  assert.equal(publicRecord.status, "issued");
  assert.equal(publicRecord.project.id, "project_v1_ggw_demo");
  assert.equal(publicRecord.project.regionId, "region_ggw_sahel");
  assert.equal(publicRecord.location.precision, "region_only");
  assert.equal(publicRecord.location.regionId, "region_ggw_sahel");
  assert.equal(publicRecord.location.latitude, undefined);
  assert.equal(publicRecord.location.longitude, undefined);
  assert.equal(publicRecord.location.accuracyMeters, undefined);
  assert.equal(publicRecord.evidence.evidenceCount, 1);
  assert.equal(publicRecord.evidence.evidenceRoot, record.evidenceRoot);
  assert.equal(publicRecord.governance.approvalCount, 1);
  assert.equal(publicRecord.challenges.totalCount, 0);
  assert.equal(publicRecord.hashes.sourceRecordHash, record.recordHash);
  assert.match(publicRecord.hashes.publicRecordHash, /^[a-f0-9]{64}$/);
  assert.equal(publicRecord.claimBoundary.notCarbonCredit, true);
  assert.equal(publicRecord.claimBoundary.notFinancialAsset, true);
  assert.equal(publicRecord.contributors, undefined);
  assert.equal(publicRecord.verificationHistory, undefined);
  assert.equal(publicRecord.evidenceIds, undefined);
  assert.doesNotMatch(JSON.stringify(publicRecord), /14\.7167123|-17\.4677456/);
  assert.match(indexBody.data.lineage.publicRecordRoot, /^[a-f0-9]{64}$/);
  assert.match(indexBody.data.lineage.sourceRecordRoot, /^[a-f0-9]{64}$/);
  assert.equal(indexBody.data.safety.publicSafeReadModel, true);
  assert.equal(indexBody.data.safety.canonical, false);
  assert.equal(indexBody.data.safety.durable, false);
  assert.equal(indexBody.data.safety.institutionalRelianceAuthorized, false);
  assert.equal(indexBody.data.safety.preciseEvidenceLocationsRedacted, true);
  assert.equal(indexBody.data.safety.contributorIdentifiersRedacted, true);

  const detail = await app.request(`/canopyproof/public-records/${record.id}`);
  assert.equal(detail.status, 200);
  const detailBody = await json<{ ok: true; data: { recordId: string; hashes: { publicRecordHash: string } } }>(detail);
  assert.equal(detailBody.data.recordId, record.id);
  assert.equal(detailBody.data.hashes.publicRecordHash, publicRecord.hashes.publicRecordHash);
});

test("CanopyProof public record registry reflects open challenges and invalid filters fail closed", async () => {
  const record = await createIssuedProofRecord("api_002");

  const challengeResponse = await app.request(`/canopyproof/proof-records/${record.id}/challenges`, {
    method: "POST",
    body: JSON.stringify({
      reason: "satellite_contradiction",
      severity: "high",
      description: "Public registry challenge links a newer satellite observation to the record status.",
      evidenceHashes: ["d".repeat(64)],
      submittedAt: "2026-07-08T03:00:00.000Z",
    }),
    headers: headers("observer", "observer_public_record_challenger"),
  });
  assert.equal(challengeResponse.status, 202);
  const challengeBody = await json<{ ok: true; data: { challenge: { id: string; status: string } } }>(challengeResponse);
  assert.equal(challengeBody.data.challenge.status, "open");

  const challenged = await app.request(`/canopyproof/public-records/${record.id}`);
  assert.equal(challenged.status, 200);
  const challengedBody = await json<{
    ok: true;
    data: {
      status: string;
      challenges: {
        totalCount: number;
        openCount: number;
        challengeRoot: string;
        publicSummaries: Array<{ id: string; status: string; publicOutcome: string }>;
      };
    };
  }>(challenged);

  assert.equal(challengedBody.data.status, "challenged");
  assert.equal(challengedBody.data.challenges.totalCount, 1);
  assert.equal(challengedBody.data.challenges.openCount, 1);
  assert.match(challengedBody.data.challenges.challengeRoot, /^[a-f0-9]{64}$/);
  assert.ok(challengedBody.data.challenges.publicSummaries.some((summary) => summary.id === challengeBody.data.challenge.id));
  assert.match(challengedBody.data.challenges.publicSummaries[0]?.publicOutcome ?? "", /awaiting accredited human review/);

  const filtered = await app.request("/canopyproof/public-records?status=challenged");
  assert.equal(filtered.status, 200);
  const filteredBody = await json<{ ok: true; data: { records: Array<{ recordId: string; status: string }> } }>(filtered);
  assert.ok(filteredBody.data.records.some((item) => item.recordId === record.id && item.status === "challenged"));

  const invalidFilter = await app.request("/canopyproof/public-records?status=certified");
  assert.equal(invalidFilter.status, 400);
  const invalidBody = await json<{ ok: false; error: string }>(invalidFilter);
  assert.match(invalidBody.error, /public record status is invalid/);
});

test("CanopyProof SQL contract stores append-only public proof record projections", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS certificates\.public_records/);
  assert.match(sql, /public_record_hash text NOT NULL UNIQUE/);
  assert.match(sql, /certificates_public_records_no_update/);
  assert.match(sql, /certificates_public_records_no_delete/);
  assert.match(sql, /certificates_public_records_audit/);
  assert.match(sql, /notCarbonCredit/);
  assert.match(sql, /notAutomaticCanopyDistribution/);
});
