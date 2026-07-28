import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofChallengeCaseService } from "../../services/api/src/domain/canopyproof/challenge-cases.js";

const timestamp = "2026-07-10T00:00:00.000Z";

function headers(role: string, actorId = `${role}_challenge_case_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function challengeCasePayload(id: string) {
  return {
    id,
    subjectType: "quality_scorecard",
    subjectId: "cp_quality_scorecard_challenge_subject_001",
    reason: "satellite_contradiction",
    severity: "high",
    title: "Satellite scene contradicts quality scorecard",
    description: "A newer satellite scene contradicts the published quality scorecard and needs accountable human review.",
    assignedRole: "researcher",
    evidence: [
      {
        evidenceType: "satellite_scene",
        contentHash: "a".repeat(64),
        sourceId: "cp_terra_scene_challenge_001",
        description: "Content-addressed Sentinel scene hash showing canopy loss in the disputed grid.",
        submittedAt: timestamp,
      },
      {
        evidenceType: "quality_scorecard",
        contentHash: `sha256:${"b".repeat(64)}`,
        sourceId: "cp_quality_scorecard_challenge_subject_001",
        description: "Original scorecard root being challenged by the newer remote-sensing observation.",
        submittedAt: timestamp,
      },
    ],
    relatedAuditRoots: ["c".repeat(64), `sha256:${"d".repeat(64)}`],
    openedAt: timestamp,
  };
}

test("CanopyProof challenge case service opens governed public disputes with audit lineage", () => {
  const service = new CanopyProofChallengeCaseService();
  const challengeCase = service.openChallengeCase(challengeCasePayload("cp_challenge_case_domain_001"), "community_challenge_case_domain");

  assert.equal(challengeCase.id, "cp_challenge_case_domain_001");
  assert.equal(challengeCase.subjectType, "quality_scorecard");
  assert.equal(challengeCase.status, "open");
  assert.equal(challengeCase.assignedRole, "researcher");
  assert.deepEqual(challengeCase.relatedAuditRoots, ["c".repeat(64), "d".repeat(64)]);
  assert.match(challengeCase.evidenceRoot, /^[a-f0-9]{64}$/);
  assert.match(challengeCase.challengeHash, /^[a-f0-9]{64}$/);
  assert.equal(challengeCase.safety.humanResolutionRequired, true);
  assert.equal(challengeCase.safety.rawEvidenceExcluded, true);
  assert.equal(challengeCase.safety.noCarbonCreditAuthority, true);
  assert.equal(challengeCase.auditHistory[0]?.entityType, "challenge_case");
  assert.equal(challengeCase.auditHistory[0]?.action, "CHALLENGE");
  assert.equal(service.getStatus().challengeCaseCount, 1);
  assert.equal(service.getStatus().criticalCount, 0);
});

test("CanopyProof challenge cases reject unsupported evidence and unsafe claims", () => {
  const service = new CanopyProofChallengeCaseService();

  assert.throws(
    () =>
      service.openChallengeCase(
        {
          ...challengeCasePayload("cp_challenge_case_missing_gps_001"),
          reason: "gps_spoofing",
        },
        "community_challenge_case_domain",
      ),
    /requires GPS hash evidence/,
  );

  assert.throws(
    () =>
      service.openChallengeCase(
        {
          ...challengeCasePayload("cp_challenge_case_unsafe_001"),
          description: "This disputed scorecard should be marketed as a certified carbon credit product.",
        },
        "community_challenge_case_domain",
      ),
    /unsupported public claim/,
  );

  const challengeCase = service.openChallengeCase(
    {
      ...challengeCasePayload("cp_challenge_case_resolve_001"),
      severity: "critical",
    },
    "community_challenge_case_domain",
  );
  const resolved = service.resolveChallengeCase(
    challengeCase.id,
    {
      decision: "accept",
      rationale: "Human researcher accepted the dispute after reviewing the satellite scene and audit-root linkage.",
      publicOutcome: "Challenge accepted; the subject remains disputed pending corrective governance action.",
      resolvedAt: "2026-07-10T01:00:00.000Z",
    },
    "researcher_challenge_case_resolver",
  );

  assert.equal(resolved.status, "accepted");
  assert.equal(resolved.resolution?.resolvedBy, "researcher_challenge_case_resolver");
  assert.match(resolved.resolution?.resolutionRoot ?? "", /^[a-f0-9]{64}$/);
  assert.equal(resolved.auditHistory.at(-1)?.entityType, "challenge_case");
});

test("CanopyProof challenge case API enforces RBAC, safe reads, and human resolution", async () => {
  const observerDenied = await app.request("/canopyproof/verification/challenge-cases", {
    method: "POST",
    headers: headers("observer", "observer_challenge_case_denied"),
    body: JSON.stringify(challengeCasePayload("cp_challenge_case_api_denied_001")),
  });
  assert.equal(observerDenied.status, 403);

  const created = await app.request("/canopyproof/verification/challenge-cases", {
    method: "POST",
    headers: headers("community", "community_challenge_case_api"),
    body: JSON.stringify({
      ...challengeCasePayload("cp_challenge_case_api_001"),
      subjectId: "cp_quality_scorecard_challenge_api_subject_001",
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      status: string;
      openedBy: string;
      safety: { humanResolutionRequired: true; noAutomaticTokenDistribution: true };
      auditHistory: Array<{ entityType: string }>;
    };
  }>(created);
  assert.equal(createdBody.data.id, "cp_challenge_case_api_001");
  assert.equal(createdBody.data.openedBy, "community_challenge_case_api");
  assert.equal(createdBody.data.auditHistory[0]?.entityType, "challenge_case");
  assert.equal(createdBody.data.safety.humanResolutionRequired, true);
  assert.equal(createdBody.data.safety.noAutomaticTokenDistribution, true);

  const observerList = await app.request(
    "/canopyproof/verification/challenge-cases?status=open&reason=satellite_contradiction&subjectType=quality_scorecard",
    {
      headers: headers("observer", "observer_challenge_case_list"),
    },
  );
  assert.equal(observerList.status, 200);
  const observerListBody = await json<{ ok: true; data: Array<{ id: string; status: string }> }>(observerList);
  assert.ok(observerListBody.data.some((item) => item.id === "cp_challenge_case_api_001" && item.status === "open"));

  const detail = await app.request("/canopyproof/verification/challenge-cases/cp_challenge_case_api_001", {
    headers: headers("agent", "agent_challenge_case_detail"),
  });
  assert.equal(detail.status, 200);

  const communityDeniedResolution = await app.request("/canopyproof/verification/challenge-cases/cp_challenge_case_api_001/resolve", {
    method: "POST",
    headers: headers("community", "community_challenge_case_resolve_denied"),
    body: JSON.stringify({
      decision: "reject",
      rationale: "Community actors cannot resolve institutional challenge cases.",
      publicOutcome: "Resolution denied by RBAC.",
    }),
  });
  assert.equal(communityDeniedResolution.status, 403);

  const needsMoreEvidence = await app.request("/canopyproof/verification/challenge-cases/cp_challenge_case_api_001/resolve", {
    method: "POST",
    headers: headers("verifier", "verifier_challenge_case_resolver"),
    body: JSON.stringify({
      decision: "request_more_evidence",
      rationale: "Verifier needs the next satellite pass before accepting or rejecting the dispute.",
      publicOutcome: "Challenge remains open for additional content-addressed evidence.",
      resolvedAt: "2026-07-10T02:00:00.000Z",
    }),
  });
  assert.equal(needsMoreEvidence.status, 202);
  const needsMoreEvidenceBody = await json<{ ok: true; data: { status: string } }>(needsMoreEvidence);
  assert.equal(needsMoreEvidenceBody.data.status, "needs_more_evidence");

  const accepted = await app.request("/canopyproof/verification/challenge-cases/cp_challenge_case_api_001/resolve", {
    method: "POST",
    headers: headers("researcher", "researcher_challenge_case_acceptor"),
    body: JSON.stringify({
      decision: "accept",
      rationale: "Researcher accepted the dispute after reviewing the follow-up satellite scene and audit trail.",
      publicOutcome: "Challenge accepted; corrective verification and governance actions are required.",
      resolvedAt: "2026-07-10T03:00:00.000Z",
      resolutionEvidence: [
        {
          evidenceType: "audit_root",
          contentHash: "e".repeat(64),
          description: "Follow-up audit root tying the accepted dispute to corrective verification action.",
          submittedAt: "2026-07-10T03:00:00.000Z",
        },
      ],
    }),
  });
  assert.equal(accepted.status, 200);
  const acceptedBody = await json<{ ok: true; data: { status: string; resolution: { decision: string } } }>(accepted);
  assert.equal(acceptedBody.data.status, "accepted");
  assert.equal(acceptedBody.data.resolution.decision, "accept");

  const invalidStatus = await app.request("/canopyproof/verification/challenge-cases?status=certified", {
    headers: headers("observer", "observer_challenge_case_invalid"),
  });
  assert.equal(invalidStatus.status, 400);
});

test("CanopyProof SQL contract stores append-only institutional challenge cases", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS verification\.challenge_cases/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS verification\.challenge_evidence/);
  assert.match(sql, /subject_type text NOT NULL CHECK \(subject_type IN \('evidence', 'proof_record', 'project', 'quality_scorecard', 'verification_decision'/);
  assert.match(sql, /reason text NOT NULL CHECK \(reason IN \('fake_evidence', 'duplicate_planting', 'gps_spoofing', 'satellite_contradiction'/);
  assert.match(sql, /status text NOT NULL CHECK \(status IN \('open', 'under_review', 'accepted', 'rejected', 'needs_more_evidence', 'withdrawn'\)\)/);
  assert.match(sql, /UNIQUE \(challenge_case_id, content_hash, evidence_type\)/);
  assert.match(sql, /challenge_cases_no_update/);
  assert.match(sql, /challenge_cases_no_delete/);
  assert.match(sql, /challenge_evidence_no_update/);
  assert.match(sql, /challenge_evidence_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON verification\.challenge_cases/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON verification\.challenge_evidence/);
});
