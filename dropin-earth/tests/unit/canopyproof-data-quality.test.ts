import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofDataQualityService } from "../../services/api/src/domain/canopyproof/data-quality.js";

function headers(role: string, actorId = `${role}_quality_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function qualityPayload(id: string) {
  return {
    id,
    subjectType: "proof_record",
    subjectId: "cp_record_quality_subject_001",
    methodologyId: "cp_methodology_quality_v1",
    evidenceIds: ["cp_evidence_quality_001", "cp_evidence_quality_002"],
    sourceRoots: ["a".repeat(64), `sha256:${"b".repeat(64)}`],
    signals: {
      evidenceCount: 2,
      mediaHashCount: 2,
      gpsHashCount: 2,
      auditEventRootCount: 3,
      humanReviewCount: 1,
      governanceApprovalCount: 1,
      monitoringEventCount: 1,
      deviceAttestationCount: 1,
      communityAttestationCount: 1,
      duplicateCandidateCount: 0,
      unresolvedChallengeCount: 0,
      missingRequiredDataSources: [],
      satelliteConsistency: "supports",
      gpsAccuracyMeters: 12,
      staleEvidenceDays: 20,
      rawMediaIncluded: false,
      personalDataExposureRisk: false,
    },
    notes: ["Quality scorecard contains only hash references and institutional lineage metadata."],
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

test("CanopyProof data quality service creates deterministic scorecards without approval authority", () => {
  const service = new CanopyProofDataQualityService();
  const scorecard = service.createScorecard(qualityPayload("cp_quality_domain_pass_001"), "verifier_quality_domain");

  assert.equal(scorecard.subjectType, "proof_record");
  assert.equal(scorecard.decision, "pass");
  assert.equal(scorecard.scores.overall >= 90, true);
  assert.equal(scorecard.sourceRoots[0], "a".repeat(64));
  assert.equal(scorecard.sourceRoots[1], "b".repeat(64));
  assert.match(scorecard.sourceRoot, /^[a-f0-9]{64}$/);
  assert.match(scorecard.findingRoot, /^[a-f0-9]{64}$/);
  assert.match(scorecard.qualityHash, /^[a-f0-9]{64}$/);
  assert.equal(scorecard.safety.advisoryQualityGateOnly, true);
  assert.equal(scorecard.safety.aiCannotApproveItself, true);
  assert.equal(scorecard.safety.noCarbonCreditAuthority, true);
  assert.equal(scorecard.auditEvent.entityType, "quality_scorecard");
  assert.equal(scorecard.auditEvent.action, "FULFILL");
  assert.equal(service.getStatus().scorecardCount, 1);
});

test("CanopyProof data quality service blocks contradiction, duplicate risk, and raw-payload exposure", () => {
  const service = new CanopyProofDataQualityService();
  const blocked = service.createScorecard(
    {
      ...qualityPayload("cp_quality_domain_blocked_001"),
      signals: {
        ...qualityPayload("cp_quality_domain_blocked_seed").signals,
        auditEventRootCount: 0,
        duplicateCandidateCount: 7,
        satelliteConsistency: "contradicts",
        gpsAccuracyMeters: 280,
        rawMediaIncluded: true,
        personalDataExposureRisk: true,
      },
    },
    "verifier_quality_domain",
  );

  assert.equal(blocked.decision, "blocked");
  assert.equal(blocked.auditEvent.action, "CHALLENGE");
  assert.ok(blocked.findings.some((finding) => finding.code === "satellite_contradiction" && finding.severity === "critical"));
  assert.ok(blocked.findings.some((finding) => finding.code === "duplicate_evidence_risk" && finding.severity === "critical"));
  assert.ok(blocked.findings.some((finding) => finding.code === "privacy_redaction_required" && finding.severity === "critical"));

  assert.throws(
    () =>
      service.createScorecard(
        {
          ...qualityPayload("cp_quality_unsafe_claim_001"),
          notes: ["This scorecard supports certified carbon credit issuance."],
        },
        "verifier_quality_domain",
      ),
    /unsupported public claim/,
  );
});

test("CanopyProof data quality API enforces RBAC and exposes observer-safe scorecard reads", async () => {
  const denied = await app.request("/canopyproof/quality/scorecards", {
    method: "POST",
    headers: headers("community", "community_quality_denied"),
    body: JSON.stringify(qualityPayload("cp_quality_api_denied_001")),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/quality/scorecards", {
    method: "POST",
    headers: headers("verifier", "verifier_quality_api"),
    body: JSON.stringify({
      ...qualityPayload("cp_quality_api_pass_001"),
      subjectId: "cp_record_quality_api_subject_001",
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      decision: string;
      scores: { overall: number };
      auditEvent: { entityType: string };
      safety: { humanReviewStillRequired: true; noAutomaticTokenDistribution: true };
    };
  }>(created);
  assert.equal(createdBody.data.id, "cp_quality_api_pass_001");
  assert.equal(createdBody.data.decision, "pass");
  assert.equal(createdBody.data.auditEvent.entityType, "quality_scorecard");
  assert.equal(createdBody.data.safety.humanReviewStillRequired, true);
  assert.equal(createdBody.data.safety.noAutomaticTokenDistribution, true);

  const list = await app.request("/canopyproof/quality/scorecards?decision=pass&subjectType=proof_record", {
    headers: headers("observer", "observer_quality_list"),
  });
  assert.equal(list.status, 200);
  const listBody = await json<{ ok: true; data: Array<{ id: string; decision: string }> }>(list);
  assert.ok(listBody.data.some((item) => item.id === "cp_quality_api_pass_001" && item.decision === "pass"));

  const detail = await app.request("/canopyproof/quality/scorecards/cp_quality_api_pass_001", {
    headers: headers("observer", "observer_quality_detail"),
  });
  assert.equal(detail.status, 200);

  const invalidDecision = await app.request("/canopyproof/quality/scorecards?decision=approved", {
    headers: headers("observer", "observer_quality_invalid"),
  });
  assert.equal(invalidDecision.status, 400);
});

test("CanopyProof SQL contract stores append-only quality scorecards", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS verification\.quality_scorecards/);
  assert.match(sql, /subject_type text NOT NULL CHECK \(subject_type IN \('evidence', 'proof_record', 'project', 'reporting_package', 'terra_scene'\)\)/);
  assert.match(sql, /decision text NOT NULL CHECK \(decision IN \('pass', 'needs_review', 'blocked'\)\)/);
  assert.match(sql, /quality_hash text NOT NULL UNIQUE/);
  assert.match(sql, /CHECK \(jsonb_typeof\(quality_signals\) = 'object'\)/);
  assert.match(sql, /CHECK \(jsonb_typeof\(findings\) = 'array'\)/);
  assert.match(sql, /quality_scorecards_no_update/);
  assert.match(sql, /quality_scorecards_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON verification\.quality_scorecards/);
});
