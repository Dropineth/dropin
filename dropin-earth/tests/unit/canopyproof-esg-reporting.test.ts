import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanopyAiAnalysis,
  issueEnvironmentalProofRecord,
  type CanopyProofEvidenceEnvelope,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";
import {
  buildCanopyProofEsgReport,
  renderCanopyProofEsgReportPdf,
} from "../../services/api/src/domain/canopyproof/esg-reporting.js";
import { app } from "../../services/api/src/app.js";
import { buildCanopyProofProofRecordSubjectId } from "../../services/api/src/domain/canopyproof/governance.js";

const timestamp = "2026-07-08T00:00:00.000Z";

function apiHeaders(role: string, actorId = `${role}_esg_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

function evidencePayload(id: string, mediaHash: string) {
  return {
    id,
    projectId: "project_v1_ggw_demo",
    evidenceType: "restoration",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 10,
      regionId: "region_ggw_sahel",
    },
    timestamp,
    contributor: `community_esg_${id}`,
    media_hash: mediaHash,
    gps_hash: "e".repeat(64),
    confidence_score: 92,
    offline_sync_id: `offline_${id}`,
    device_fingerprint_hash: "f".repeat(64),
    exif_hash: "1".repeat(64),
  };
}

function proofEvidence(): CanopyProofEvidenceEnvelope {
  const evidenceId = "evidence_esg_engine_001";
  const base = evidencePayload(evidenceId, "2".repeat(64));
  return {
    ...base,
    evidenceType: "restoration",
    verification_status: "accepted",
    reviewers: ["verifier_esg_001"],
    audit_history: [
      {
        id: "cp_audit_esg_seed",
        action: "ASSERT",
        actor: "community_esg_engine",
        entityType: "evidence",
        entityId: evidenceId,
        previousRoot: "0".repeat(64),
        payloadHash: "1".repeat(64),
        eventRoot: "2".repeat(64),
        createdAt: timestamp,
        rationale: "Seed evidence for ESG reporting test.",
      },
    ],
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createProofGovernanceApproval(projectId: string, evidenceIds: readonly string[], recordSuffix: string) {
  const response = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId: buildCanopyProofProofRecordSubjectId({ projectId, evidenceIds }),
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approved for ESG-linked Environmental Proof Record issuance after evidence, AI advisory, and human review.",
      conflictDisclosure: "No known conflict disclosed for this ESG proof issuance approval.",
      decidedAt: "2026-07-08T01:30:00.000Z",
    }),
    headers: apiHeaders("verifier", `verifier_esg_${recordSuffix}`),
  });
  const body = await json<{ ok: true; data: { id: string; decision: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(body.data.decision, "approve");
  return body.data.id;
}

async function createIssuedProofRecord(recordSuffix: string) {
  const evidenceId = `evidence_api_esg_${recordSuffix}`;
  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(evidenceId, "3".repeat(64))),
    headers: apiHeaders("community", `community_esg_${recordSuffix}`),
  });
  assert.equal(evidenceResponse.status, 201);

  const analysisResponse = await app.request(`/canopyproof/evidence/${evidenceId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({ observedAt: "2026-07-08T00:05:00.000Z" }),
    headers: apiHeaders("agent", `canopy_ai_esg_${recordSuffix}`),
  });
  assert.equal(analysisResponse.status, 201);

  const governanceApprovalId = await createProofGovernanceApproval("project_v1_ggw_demo", [evidenceId], recordSuffix);

  const recordResponse = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      evidenceIds: [evidenceId],
      humanReview: {
        reviewer: "verifier_body_should_be_overridden",
        role: "verifier",
        decision: "approve",
        rationale: "Approved for institutional ESG reporting after field and AI review.",
        reviewedAt: "2026-07-08T01:00:00.000Z",
      },
      governanceApprovals: [governanceApprovalId],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
      issuedAt: "2026-07-08T02:00:00.000Z",
    }),
    headers: apiHeaders("verifier", `verifier_esg_${recordSuffix}`),
  });
  assert.equal(recordResponse.status, 201);
  const recordBody = await json<{ ok: true; data: { id: string } }>(recordResponse);
  return recordBody.data.id;
}

test("CanopyProof ESG report builder maps issued proof records to GRI, SDG, TNFD, JSON, and PDF exports", () => {
  const proof = proofEvidence();
  const analysis = buildCanopyAiAnalysis({ evidence: proof, observedAt: "2026-07-08T00:05:00.000Z" });
  const record = issueEnvironmentalProofRecord({
    projectId: proof.projectId,
    evidence: [proof],
    aiAnalyses: [analysis],
    humanReview: {
      reviewer: "verifier_esg_001",
      role: "verifier",
      decision: "approve",
      rationale: "Approved after field review, governance review, and advisory AI consistency checks.",
      reviewedAt: "2026-07-08T01:00:00.000Z",
    },
    governanceApprovals: ["ngo_board_approval_esg_engine"],
    monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
    issuedAt: "2026-07-08T02:00:00.000Z",
  });
  const report = buildCanopyProofEsgReport({
    projectId: proof.projectId,
    organizationName: "Sahel Restoration Trust",
    reportingPeriod: {
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-07-08T00:00:00.000Z",
    },
    generatedBy: "researcher_esg_001",
    generatedAt: "2026-07-08T03:00:00.000Z",
    materialTopics: ["restoration accountability", "water resilience", "biodiversity monitoring"],
    proofRecords: [record],
  });

  assert.equal(report.reportType, "environmental_accountability_report");
  assert.equal(report.lineageIntegrity.allRecordsIssued, true);
  assert.equal(report.lineageIntegrity.recordCount, 1);
  assert.match(report.griDisclosures.map((disclosure) => disclosure.code).join(" "), /GRI 304/);
  assert.match(report.sdgMapping.map((mapping) => mapping.goal).join(" "), /SDG 15/);
  assert.ok(report.tnfdPreparation.governance.some((statement) => /human-led/.test(statement)));
  assert.equal(report.exports.json.mediaType, "application/json");
  assert.equal(report.exports.pdf.mediaType, "application/pdf");
  assert.equal(report.claimBoundary.notCarbonCredit, true);
  assert.equal(report.claimBoundary.notFinancialAsset, true);
  assert.equal(report.claimBoundary.notTaxOffset, true);
  assert.equal(report.claimBoundary.notGuaranteedYield, true);
  assert.equal(report.claimBoundary.notAutomaticCanopyDistribution, true);
  assert.match(report.climateImpactReport.statement, /not as an offset/);

  const pdf = renderCanopyProofEsgReportPdf(report);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});

test("CanopyProof ESG report builder refuses missing lineage and unsafe public claims", () => {
  assert.throws(
    () =>
      buildCanopyProofEsgReport({
        projectId: "project_v1_ggw_demo",
        organizationName: "Sahel Restoration Trust",
        reportingPeriod: {
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-07-08T00:00:00.000Z",
        },
        generatedBy: "researcher_esg_002",
        proofRecords: [],
      }),
    /requires at least one issued Environmental Proof Record/,
  );

  const proof = proofEvidence();
  const analysis = buildCanopyAiAnalysis({ evidence: proof });
  const record = issueEnvironmentalProofRecord({
    projectId: proof.projectId,
    evidence: [proof],
    aiAnalyses: [analysis],
    humanReview: {
      reviewer: "verifier_esg_002",
      role: "verifier",
      decision: "approve",
      rationale: "Approved after review.",
      reviewedAt: "2026-07-08T01:00:00.000Z",
    },
    governanceApprovals: ["ngo_board_approval_esg_unsafe"],
    monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
  });

  assert.throws(
    () =>
      buildCanopyProofEsgReport({
        projectId: proof.projectId,
        organizationName: "Sahel Restoration Trust",
        reportingPeriod: {
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-07-08T00:00:00.000Z",
        },
        generatedBy: "researcher_esg_003",
        materialTopics: ["certified carbon credit program"],
        proofRecords: [record],
      }),
    /unsupported public claim/,
  );
});

test("CanopyProof ESG report API generates governed reports and exports JSON/PDF without allowing observers to mutate", async () => {
  const recordId = await createIssuedProofRecord("api_001");

  const denied = await app.request("/canopyproof/reports/esg/generate", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      organizationName: "Observer Organization",
      reportingPeriod: {
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-07-08T00:00:00.000Z",
      },
      proofRecordIds: [recordId],
    }),
    headers: apiHeaders("observer", "observer_esg_denied"),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/reports/esg/generate", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      organizationName: "Sahel Restoration Trust",
      reportingPeriod: {
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-07-08T00:00:00.000Z",
      },
      proofRecordIds: [recordId],
      materialTopics: ["restoration accountability", "institutional climate disclosure"],
    }),
    headers: apiHeaders("researcher", "researcher_esg_api"),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      generatedBy: string;
      griDisclosures: Array<{ code: string }>;
      sdgMapping: Array<{ goal: string }>;
      claimBoundary: { notCarbonCredit: true; notFinancialAsset: true; notTaxOffset: true; notGuaranteedYield: true };
      exports: { json: { href: string }; pdf: { href: string } };
    };
  }>(created);

  assert.equal(createdBody.data.generatedBy, "researcher_esg_api");
  assert.ok(createdBody.data.griDisclosures.some((disclosure) => disclosure.code === "GRI 305"));
  assert.ok(createdBody.data.sdgMapping.some((mapping) => mapping.goal === "SDG 13"));
  assert.equal(createdBody.data.claimBoundary.notCarbonCredit, true);
  assert.equal(createdBody.data.claimBoundary.notFinancialAsset, true);
  assert.equal(createdBody.data.claimBoundary.notTaxOffset, true);
  assert.equal(createdBody.data.claimBoundary.notGuaranteedYield, true);

  const reportId = createdBody.data.id;
  const exportedJson = await app.request(createdBody.data.exports.json.href, {
    headers: apiHeaders("observer", "observer_esg_reader"),
  });
  assert.equal(exportedJson.status, 200);
  assert.match(exportedJson.headers.get("content-type") ?? "", /application\/json/);
  const exportedJsonBody = JSON.parse(await exportedJson.text()) as { id: string; reportType: string };
  assert.equal(exportedJsonBody.id, reportId);
  assert.equal(exportedJsonBody.reportType, "environmental_accountability_report");

  const exportedPdf = await app.request(createdBody.data.exports.pdf.href, {
    headers: apiHeaders("observer", "observer_esg_reader"),
  });
  assert.equal(exportedPdf.status, 200);
  assert.match(exportedPdf.headers.get("content-type") ?? "", /application\/pdf/);
  const pdf = new Uint8Array(await exportedPdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});
