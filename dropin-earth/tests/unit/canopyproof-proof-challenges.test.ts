import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { buildCanopyProofProofRecordSubjectId } from "../../services/api/src/domain/canopyproof/governance.js";

const timestamp = "2026-07-08T00:00:00.000Z";

function headers(role: string, actorId = `${role}_proof_challenge_actor`) {
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
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 10,
      regionId: "region_ggw_sahel",
    },
    timestamp,
    contributor: `community_challenge_${id}`,
    media_hash: mediaHash,
    gps_hash: "d".repeat(64),
    confidence_score: 91,
    offline_sync_id: `offline_${id}`,
    device_fingerprint_hash: "b".repeat(64),
    exif_hash: "c".repeat(64),
  };
}

async function createIssuedProofRecord(suffix: string) {
  const projectId = "project_v1_ggw_demo";
  const evidenceId = `evidence_proof_challenge_${suffix}`;
  const mediaHash = suffix.endsWith("002") ? "2".repeat(64) : "1".repeat(64);
  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(evidenceId, mediaHash)),
    headers: headers("community", `community_proof_challenge_${suffix}`),
  });
  assert.equal(evidenceResponse.status, 201);

  const aiResponse = await app.request(`/canopyproof/evidence/${evidenceId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({ observedAt: "2026-07-08T00:05:00.000Z" }),
    headers: headers("agent", `canopy_ai_proof_challenge_${suffix}`),
  });
  assert.equal(aiResponse.status, 201);

  const approvalResponse = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId: buildCanopyProofProofRecordSubjectId({ projectId, evidenceIds: [evidenceId] }),
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approved for proof challenge lifecycle test after evidence, AI advisory, and human review.",
      conflictDisclosure: "No known conflict disclosed for this proof challenge lifecycle approval.",
      decidedAt: "2026-07-08T01:30:00.000Z",
    }),
    headers: headers("verifier", `verifier_proof_challenge_${suffix}`),
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
        rationale: "Approved after field review, AI advisory checks, and governance approval.",
        reviewedAt: "2026-07-08T02:00:00.000Z",
      },
      governanceApprovals: [approvalBody.data.id],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "governance_approved", "public_record_issued"],
      issuedAt: "2026-07-08T03:00:00.000Z",
    }),
    headers: headers("verifier", `verifier_proof_challenge_${suffix}`),
  });
  assert.equal(recordResponse.status, 201);
  const recordBody = await json<{ ok: true; data: { id: string; status: string } }>(recordResponse);

  assert.equal(recordBody.data.status, "issued");
  return recordBody.data.id;
}

test("CanopyProof proof record challenges mark issued records as disputed and block clean ESG lineage", async () => {
  const recordId = await createIssuedProofRecord("api_001");

  const challengeResponse = await app.request(`/canopyproof/proof-records/${recordId}/challenges`, {
    method: "POST",
    body: JSON.stringify({
      reason: "satellite_contradiction",
      severity: "high",
      description: "Community reviewer found a newer satellite observation that contradicts the published survival claim.",
      evidenceHashes: ["e".repeat(64)],
      submittedAt: "2026-07-08T04:00:00.000Z",
    }),
    headers: headers("observer", "observer_proof_challenge_submitter"),
  });
  const challengeBody = await json<{
    ok: true;
    data: {
      challenge: { id: string; status: string; publicOutcome: string; auditHistory: unknown[] };
      record: { id: string; status: string; verificationHistory: unknown[] };
    };
  }>(challengeResponse);

  assert.equal(challengeResponse.status, 202);
  assert.equal(challengeBody.data.challenge.status, "open");
  assert.match(challengeBody.data.challenge.publicOutcome, /awaiting accredited human review/);
  assert.equal(challengeBody.data.record.status, "challenged");
  assert.ok(challengeBody.data.record.verificationHistory.length > 0);

  const esgWhileChallenged = await app.request("/canopyproof/reports/esg/generate", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      organizationName: "Sahel Restoration Trust",
      reportingPeriod: {
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-07-08T00:00:00.000Z",
      },
      proofRecordIds: [recordId],
    }),
    headers: headers("researcher", "researcher_proof_challenge_esg"),
  });
  const esgBody = await json<{ ok: false; error: string }>(esgWhileChallenged);

  assert.equal(esgWhileChallenged.status, 400);
  assert.match(esgBody.error, /can only use issued Environmental Proof Records/);

  const listed = await app.request(`/canopyproof/proof-records/${recordId}/challenges`, {
    headers: headers("observer", "observer_proof_challenge_reader"),
  });
  const listedBody = await json<{ ok: true; data: Array<{ id: string; status: string }> }>(listed);

  assert.equal(listed.status, 200);
  assert.ok(listedBody.data.some((challenge) => challenge.id === challengeBody.data.challenge.id && challenge.status === "open"));
});

test("CanopyProof proof challenge resolution restores or revokes records through accountable review", async () => {
  const recordId = await createIssuedProofRecord("api_002");
  const challengeResponse = await app.request(`/canopyproof/proof-records/${recordId}/challenges`, {
    method: "POST",
    body: JSON.stringify({
      reason: "methodology_error",
      severity: "medium",
      description: "The published monitoring timeline may have missed a seasonal field review window.",
      evidenceIds: ["evidence_methodology_review_001"],
      submittedAt: "2026-07-08T04:10:00.000Z",
    }),
    headers: headers("community", "community_proof_challenge_submitter"),
  });
  assert.equal(challengeResponse.status, 202);
  const challengeBody = await json<{ ok: true; data: { challenge: { id: string } } }>(challengeResponse);

  const deniedResolution = await app.request(`/canopyproof/proof-records/${recordId}/challenges/${challengeBody.data.challenge.id}/resolve`, {
    method: "POST",
    body: JSON.stringify({
      decision: "reject",
      rationale: "Community actors cannot resolve public proof record challenges.",
      publicOutcome: "Resolution denied by RBAC.",
    }),
    headers: headers("community", "community_proof_challenge_resolver_denied"),
  });
  assert.equal(deniedResolution.status, 403);

  const rejected = await app.request(`/canopyproof/proof-records/${recordId}/challenges/${challengeBody.data.challenge.id}/resolve`, {
    method: "POST",
    body: JSON.stringify({
      decision: "reject",
      rationale: "Reviewer checked the monitoring cadence and confirmed the published timeline is valid.",
      publicOutcome: "Challenge rejected after accredited review; record remains issued.",
      resolvedAt: "2026-07-08T05:00:00.000Z",
    }),
    headers: headers("verifier", "verifier_proof_challenge_resolver"),
  });
  const rejectedBody = await json<{ ok: true; data: { challenge: { status: string; resolvedBy: string }; record: { status: string } } }>(rejected);

  assert.equal(rejected.status, 200);
  assert.equal(rejectedBody.data.challenge.status, "rejected");
  assert.equal(rejectedBody.data.challenge.resolvedBy, "verifier_proof_challenge_resolver");
  assert.equal(rejectedBody.data.record.status, "issued");

  const acceptedChallenge = await app.request(`/canopyproof/proof-records/${recordId}/challenges`, {
    method: "POST",
    body: JSON.stringify({
      reason: "duplicate_claim",
      severity: "critical",
      description: "New field evidence shows this record overlaps with a prior issued restoration claim.",
      evidenceHashes: ["f".repeat(64)],
      submittedAt: "2026-07-08T06:00:00.000Z",
    }),
    headers: headers("researcher", "researcher_proof_challenge_submitter"),
  });
  assert.equal(acceptedChallenge.status, 202);
  const acceptedChallengeBody = await json<{ ok: true; data: { challenge: { id: string } } }>(acceptedChallenge);

  const accepted = await app.request(
    `/canopyproof/proof-records/${recordId}/challenges/${acceptedChallengeBody.data.challenge.id}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: "accept",
        rationale: "Verifier confirmed duplicate overlap with a prior record and accepted the public challenge.",
        publicOutcome: "Challenge accepted; Environmental Proof Record revoked and removed from clean reporting lineage.",
        resolvedAt: "2026-07-08T07:00:00.000Z",
      }),
      headers: headers("verifier", "verifier_proof_challenge_acceptor"),
    },
  );
  const acceptedBody = await json<{ ok: true; data: { challenge: { status: string }; record: { status: string } } }>(accepted);

  assert.equal(accepted.status, 200);
  assert.equal(acceptedBody.data.challenge.status, "accepted");
  assert.equal(acceptedBody.data.record.status, "revoked");
});
