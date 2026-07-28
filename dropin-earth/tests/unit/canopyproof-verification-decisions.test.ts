import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofVerificationDecisionService } from "../../services/api/src/domain/canopyproof/verification-decisions.js";

const timestamp = "2026-07-09T00:00:00.000Z";

function headers(role: string, actorId = `${role}_verification_decision_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function decisionPayload(id: string) {
  return {
    id,
    subjectType: "proof_record",
    subjectId: "cp_record_verification_decision_subject_001",
    decision: "approve",
    evidenceIds: ["cp_evidence_decision_001", "cp_evidence_decision_002"],
    aiAnalysisIds: ["cp_ai_analysis_decision_001"],
    terraSceneIds: ["cp_terra_scene_decision_001"],
    qualityScorecardIds: ["cp_quality_decision_001"],
    humanReviewWorkItemIds: ["cp_vq_human_review_decision_001"],
    governanceApprovalIds: ["cp_governance_approval_decision_001"],
    auditEventRoots: ["a".repeat(64), `sha256:${"b".repeat(64)}`],
    qualityGateState: "pass",
    rationale:
      "Human verifier reviewed evidence, advisory AI, TerraProof scene, quality scorecard, audit roots, and governance linkage before bounded reliance.",
    limitations: [
      "This decision does not certify a carbon credit, financial asset, tax offset, token distribution, or guaranteed yield.",
      "Continued monitoring remains required for future environmental claims.",
    ],
    decidedAt: timestamp,
  };
}

test("CanopyProof verification decision service creates human-in-the-loop dossiers", () => {
  const service = new CanopyProofVerificationDecisionService();
  const dossier = service.createDecisionDossier(decisionPayload("cp_verification_decision_domain_001"), "verifier_decision_domain", "verifier");

  assert.equal(dossier.decision, "approve");
  assert.equal(dossier.reviewer, "verifier_decision_domain");
  assert.equal(dossier.reviewerRole, "verifier");
  assert.deepEqual(dossier.auditEventRoots, ["a".repeat(64), "b".repeat(64)]);
  assert.match(dossier.sourceRoot, /^[a-f0-9]{64}$/);
  assert.match(dossier.decisionHash, /^[a-f0-9]{64}$/);
  assert.equal(dossier.safety.accountableHumanReviewerRequired, true);
  assert.equal(dossier.safety.aiAdvisoryOnly, true);
  assert.equal(dossier.safety.governanceStillRequiredForProofIssuance, true);
  assert.equal(dossier.safety.noCarbonCreditAuthority, true);
  assert.equal(dossier.auditEvent.entityType, "verification_decision");
  assert.equal(dossier.auditEvent.action, "FULFILL");
  assert.equal(service.getStatus().approvedCount, 1);
});

test("CanopyProof verification decision service rejects blocked approvals, missing gates, and unsafe claims", () => {
  const service = new CanopyProofVerificationDecisionService();

  assert.throws(
    () =>
      service.createDecisionDossier(
        {
          ...decisionPayload("cp_verification_decision_blocked_001"),
          qualityGateState: "blocked",
        },
        "verifier_decision_domain",
        "verifier",
      ),
    /cannot approve a blocked quality gate/,
  );

  assert.throws(
    () =>
      service.createDecisionDossier(
        {
          ...decisionPayload("cp_verification_decision_missing_ai_001"),
          aiAnalysisIds: [],
        },
        "verifier_decision_domain",
        "verifier",
      ),
    /require advisory AI analysis/,
  );

  assert.throws(
    () =>
      service.createDecisionDossier(
        {
          ...decisionPayload("cp_verification_decision_unsafe_001"),
          rationale: "This approval converts field proof into a certified carbon credit package.",
        },
        "verifier_decision_domain",
        "verifier",
      ),
    /unsupported public claim/,
  );

  const challenged = service.createDecisionDossier(
    {
      ...decisionPayload("cp_verification_decision_challenge_001"),
      decision: "challenge",
      qualityGateState: "blocked",
      rationale: "Human verifier challenged the bundle because quality gates remain blocked by unresolved evidence issues.",
    },
    "researcher_decision_domain",
    "researcher",
  );
  assert.equal(challenged.decision, "challenge");
  assert.equal(challenged.auditEvent.action, "CHALLENGE");
});

test("CanopyProof verification decision API enforces RBAC and observer-safe reads", async () => {
  const communityDenied = await app.request("/canopyproof/verification/decisions", {
    method: "POST",
    headers: headers("community", "community_decision_denied"),
    body: JSON.stringify(decisionPayload("cp_verification_decision_api_denied_001")),
  });
  assert.equal(communityDenied.status, 403);

  const agentDenied = await app.request("/canopyproof/verification/decisions", {
    method: "POST",
    headers: headers("agent", "canopy_verification_agent_denied"),
    body: JSON.stringify(decisionPayload("cp_verification_decision_agent_denied_001")),
  });
  assert.equal(agentDenied.status, 403);

  const created = await app.request("/canopyproof/verification/decisions", {
    method: "POST",
    headers: headers("verifier", "verifier_decision_api"),
    body: JSON.stringify({
      ...decisionPayload("cp_verification_decision_api_001"),
      subjectId: "cp_record_verification_decision_api_subject_001",
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      decision: string;
      reviewer: string;
      safety: { aiAdvisoryOnly: true; noAutomaticTokenDistribution: true };
      auditEvent: { entityType: string };
    };
  }>(created);
  assert.equal(createdBody.data.id, "cp_verification_decision_api_001");
  assert.equal(createdBody.data.reviewer, "verifier_decision_api");
  assert.equal(createdBody.data.auditEvent.entityType, "verification_decision");
  assert.equal(createdBody.data.safety.aiAdvisoryOnly, true);
  assert.equal(createdBody.data.safety.noAutomaticTokenDistribution, true);

  const observerList = await app.request("/canopyproof/verification/decisions?decision=approve&subjectType=proof_record", {
    headers: headers("observer", "observer_decision_list"),
  });
  assert.equal(observerList.status, 200);
  const observerListBody = await json<{ ok: true; data: Array<{ id: string; decision: string }> }>(observerList);
  assert.ok(observerListBody.data.some((item) => item.id === "cp_verification_decision_api_001" && item.decision === "approve"));

  const detail = await app.request("/canopyproof/verification/decisions/cp_verification_decision_api_001", {
    headers: headers("observer", "observer_decision_detail"),
  });
  assert.equal(detail.status, 200);

  const invalidDecision = await app.request("/canopyproof/verification/decisions?decision=certify", {
    headers: headers("observer", "observer_decision_invalid"),
  });
  assert.equal(invalidDecision.status, 400);
});

test("CanopyProof SQL contract stores append-only verification decision dossiers", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS verification\.decision_dossiers/);
  assert.match(sql, /decision text NOT NULL CHECK \(decision IN \('approve', 'reject', 'challenge', 'request_changes'\)\)/);
  assert.match(sql, /reviewer_role text NOT NULL CHECK \(reviewer_role IN \('owner', 'admin', 'verifier', 'researcher'\)\)/);
  assert.match(sql, /quality_gate_state text NOT NULL CHECK \(quality_gate_state IN \('pass', 'needs_review', 'blocked'\)\)/);
  assert.match(sql, /CHECK \(decision <> 'approve' OR quality_gate_state <> 'blocked'\)/);
  assert.match(sql, /CHECK \(decision <> 'approve' OR array_length\(human_review_work_item_ids, 1\) > 0\)/);
  assert.match(sql, /decision_dossiers_no_update/);
  assert.match(sql, /decision_dossiers_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON verification\.decision_dossiers/);
});
