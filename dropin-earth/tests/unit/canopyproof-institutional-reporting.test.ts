import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { buildCanopyProofProofRecordSubjectId } from "../../services/api/src/domain/canopyproof/governance.js";
import { canopyProofInstitutionalFrameworks } from "../../services/api/src/domain/canopyproof/institutional-reporting.js";

const timestamp = "2026-07-08T00:00:00.000Z";

function headers(role: string, actorId = `${role}_institutional_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

function evidencePayload(id: string, mediaHash: string) {
  return {
    id,
    projectId: "project_v1_institutional_demo",
    evidenceType: "restoration",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 10,
      regionId: "region_ggw_sahel",
    },
    timestamp,
    contributor: `community_institutional_${id}`,
    media_hash: mediaHash,
    gps_hash: "c".repeat(64),
    confidence_score: 91,
    offline_sync_id: `offline_${id}`,
    device_fingerprint_hash: "d".repeat(64),
    exif_hash: "e".repeat(64),
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createVerifiedOrganization(suffix: string) {
  const organizationId = `cp_org_institutional_${suffix}`;
  const created = await app.request("/canopyproof/organizations", {
    method: "POST",
    body: JSON.stringify({
      id: organizationId,
      name: `Institutional Climate Trust ${suffix}`,
      legalName: `Institutional Climate Trust ${suffix} Ltd`,
      organizationType: "research_institution",
      jurisdiction: "SN",
      publicContact: `registry+${suffix}@canopyproof.test`,
      operatingRegions: ["region_ggw_sahel"],
      verificationCapabilities: ["restoration accountability", "institutional reporting"],
      createdAt: "2026-07-08T00:10:00.000Z",
    }),
    headers: headers("owner", `owner_institutional_${suffix}`),
  });
  assert.equal(created.status, 201);

  const verified = await app.request(`/canopyproof/organizations/${organizationId}/verification`, {
    method: "POST",
    body: JSON.stringify({
      verificationStatus: "verified",
      trustLevel: "institutional",
      registrationNumber: `ICT-${suffix.toUpperCase()}-001`,
      documents: [
        {
          documentType: "registration",
          documentHash: "f".repeat(64),
          issuedBy: "Public Registry",
          uploadedAt: "2026-07-08T00:20:00.000Z",
        },
      ],
      authorizedUsers: [`researcher_institutional_${suffix}`],
      rationale: "Registration document and institutional accountability mandate were reviewed by a human verifier.",
      reviewedAt: "2026-07-08T00:30:00.000Z",
    }),
    headers: headers("verifier", `verifier_institutional_${suffix}`),
  });
  const verifiedBody = await json<{ ok: true; data: { id: string; verificationStatus: string; trustLevel: string } }>(verified);
  assert.equal(verified.status, 201);
  assert.equal(verifiedBody.data.id, organizationId);
  assert.equal(verifiedBody.data.verificationStatus, "verified");
  assert.equal(verifiedBody.data.trustLevel, "institutional");
  return organizationId;
}

async function createProofGovernanceApproval(projectId: string, evidenceIds: readonly string[], suffix: string) {
  const response = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId: buildCanopyProofProofRecordSubjectId({ projectId, evidenceIds }),
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approved for institutional reporting after evidence, AI advisory, and human review.",
      conflictDisclosure: "No known conflict disclosed for this institutional reporting proof issuance.",
      decidedAt: "2026-07-08T01:30:00.000Z",
    }),
    headers: headers("verifier", `verifier_governance_institutional_${suffix}`),
  });
  const body = await json<{ ok: true; data: { id: string; decision: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(body.data.decision, "approve");
  return body.data.id;
}

async function createIssuedProofRecord(suffix: string, mediaHash: string) {
  const evidenceId = `evidence_institutional_${suffix}`;
  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(evidenceId, mediaHash)),
    headers: headers("community", `community_institutional_${suffix}`),
  });
  assert.equal(evidenceResponse.status, 201);

  const analysisResponse = await app.request(`/canopyproof/evidence/${evidenceId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({ observedAt: "2026-07-08T00:05:00.000Z" }),
    headers: headers("agent", `canopy_ai_institutional_${suffix}`),
  });
  assert.equal(analysisResponse.status, 201);

  const governanceApprovalId = await createProofGovernanceApproval("project_v1_institutional_demo", [evidenceId], suffix);

  const recordResponse = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_institutional_demo",
      evidenceIds: [evidenceId],
      humanReview: {
        reviewer: "verifier_body_should_be_overridden",
        role: "verifier",
        decision: "approve",
        rationale: "Approved for institutional reporting after field and AI review.",
        reviewedAt: "2026-07-08T01:00:00.000Z",
      },
      governanceApprovals: [governanceApprovalId],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
      issuedAt: "2026-07-08T02:00:00.000Z",
    }),
    headers: headers("verifier", `verifier_institutional_record_${suffix}`),
  });
  const recordBody = await json<{ ok: true; data: { id: string; status: string } }>(recordResponse);
  assert.equal(recordResponse.status, 201);
  assert.equal(recordBody.data.status, "issued");
  return recordBody.data.id;
}

async function createEsgReport(recordId: string, suffix: string) {
  const created = await app.request("/canopyproof/reports/esg/generate", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_institutional_demo",
      organizationName: `Institutional Climate Trust ${suffix}`,
      reportingPeriod: {
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-07-08T00:00:00.000Z",
      },
      proofRecordIds: [recordId],
      materialTopics: ["institutional climate disclosure", "restoration accountability"],
    }),
    headers: headers("researcher", `researcher_esg_institutional_${suffix}`),
  });
  const body = await json<{ ok: true; data: { id: string; exports: { json: { href: string }; pdf: { href: string } } } }>(created);
  assert.equal(created.status, 201);
  return body.data.id;
}

function frameworkPackageBody(organizationId: string, recordId: string, reportId: string, framework = "UNFCCC") {
  return {
    organizationId,
    framework,
    reportingPeriod: {
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-07-08T00:00:00.000Z",
    },
    proofRecordIds: [recordId],
    esgReportIds: [reportId],
    methodology: "CanopyProof proof-record lineage methodology with human review, governance approval, and explicit claim boundaries.",
    metrics: [
      {
        name: "Issued restoration proof records",
        value: 1,
        unit: "record",
        sourceRecordId: recordId,
        methodology: "Count issued Environmental Proof Records that passed evidence validation, AI advisory checks, and human review.",
        confidence: 91,
        verificationReference: recordId,
        auditReference: `${recordId}:verification-history`,
        limitations: ["Metric is an accountability count and is not a carbon-credit issuance figure."],
      },
    ],
    limitations: ["Package supports institutional review and does not create certified carbon-credit, tax-offset, or guaranteed-yield claims."],
  };
}

test("CanopyProof institutional framework packages support UN, GRI, ISSB, and TCFD reporting without unsafe claims", async () => {
  const organizationId = await createVerifiedOrganization("framework_001");
  const recordId = await createIssuedProofRecord("framework_001", "1".repeat(64));
  const reportId = await createEsgReport(recordId, "framework_001");

  const status = await app.request("/canopyproof/reports/institutional/status", {
    headers: headers("observer", "observer_institutional_status"),
  });
  const statusBody = await json<{
    ok: true;
    data: {
      supportedFrameworks: string[];
      compatibilityEsgSource: {
        canonical: false;
        durable: false;
        routeMounted: true;
        productionRelianceAuthorized: false;
      };
      canonicalEsgSource: {
        adapterImplemented: true;
        routeMounted: false;
        productionRelianceAuthorized: false;
        requiredProjectionState: "current";
      };
    };
  }>(status);
  assert.equal(status.status, 200);
  assert.deepEqual(statusBody.data.supportedFrameworks, [...canopyProofInstitutionalFrameworks]);
  assert.ok(statusBody.data.supportedFrameworks.includes("UN_SDG"));
  assert.ok(statusBody.data.supportedFrameworks.includes("UNFCCC"));
  assert.ok(statusBody.data.supportedFrameworks.includes("GRI"));
  assert.ok(statusBody.data.supportedFrameworks.includes("ISSB"));
  assert.ok(statusBody.data.supportedFrameworks.includes("TCFD"));
  assert.equal(statusBody.data.compatibilityEsgSource.canonical, false);
  assert.equal(statusBody.data.compatibilityEsgSource.durable, false);
  assert.equal(statusBody.data.compatibilityEsgSource.routeMounted, true);
  assert.equal(statusBody.data.compatibilityEsgSource.productionRelianceAuthorized, false);
  assert.equal(statusBody.data.canonicalEsgSource.adapterImplemented, true);
  assert.equal(statusBody.data.canonicalEsgSource.routeMounted, false);
  assert.equal(statusBody.data.canonicalEsgSource.productionRelianceAuthorized, false);
  assert.equal(statusBody.data.canonicalEsgSource.requiredProjectionState, "current");

  const created = await app.request("/canopyproof/reports/framework-packages", {
    method: "POST",
    body: JSON.stringify(frameworkPackageBody(organizationId, recordId, reportId)),
    headers: headers("researcher", "researcher_framework_package"),
  });
  const body = await json<{
    ok: true;
    data: {
      id: string;
      framework: string;
      organization: { id: string; verificationStatus: string; trustLevel: string };
      metrics: Array<{ source: { proofRecordId: string }; methodology: string; auditReference: string }>;
      verificationReferences: string[];
      auditReferences: string[];
      packageRoot: string;
      claimBoundary: { notCarbonCredit: true; notTaxOffset: true; notGuaranteedYield: true; notAutomaticCanopyDistribution: true };
      exports: { json: { href: string }; pdf: { href: string } };
      auditEvent: { entityType: string; actor: string };
    };
  }>(created);
  assert.equal(created.status, 201);
  assert.equal(body.data.framework, "UNFCCC");
  assert.equal(body.data.organization.id, organizationId);
  assert.equal(body.data.organization.verificationStatus, "verified");
  assert.equal(body.data.organization.trustLevel, "institutional");
  assert.equal(body.data.metrics[0]?.source.proofRecordId, recordId);
  assert.match(body.data.metrics[0]?.methodology ?? "", /human review/);
  assert.match(body.data.metrics[0]?.auditReference ?? "", /verification-history/);
  assert.ok(body.data.verificationReferences.includes(recordId));
  assert.ok(body.data.auditReferences.length > 0);
  assert.match(body.data.packageRoot, /^[a-f0-9]{64}$/);
  assert.equal(body.data.claimBoundary.notCarbonCredit, true);
  assert.equal(body.data.claimBoundary.notTaxOffset, true);
  assert.equal(body.data.claimBoundary.notGuaranteedYield, true);
  assert.equal(body.data.claimBoundary.notAutomaticCanopyDistribution, true);
  assert.equal(body.data.auditEvent.entityType, "institutional_report_package");
  assert.equal(body.data.auditEvent.actor, "researcher_framework_package");

  const exportedJson = await app.request(body.data.exports.json.href, {
    headers: headers("observer", "observer_framework_export"),
  });
  assert.equal(exportedJson.status, 200);
  assert.match(exportedJson.headers.get("content-type") ?? "", /application\/json/);

  const exportedPdf = await app.request(body.data.exports.pdf.href, {
    headers: headers("observer", "observer_framework_export"),
  });
  assert.equal(exportedPdf.status, 200);
  assert.match(exportedPdf.headers.get("content-type") ?? "", /application\/pdf/);
  const pdf = new Uint8Array(await exportedPdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});

test("CanopyProof institutional framework packages reject weak metric lineage and unsafe public claims", async () => {
  const organizationId = await createVerifiedOrganization("framework_reject_001");
  const recordId = await createIssuedProofRecord("framework_reject_001", "2".repeat(64));
  const reportId = await createEsgReport(recordId, "framework_reject_001");

  const missingMetricReference = await app.request("/canopyproof/reports/framework-packages", {
    method: "POST",
    body: JSON.stringify({
      ...frameworkPackageBody(organizationId, recordId, reportId, "ISSB"),
      metrics: [
        {
          name: "Weak metric",
          value: 1,
          sourceRecordId: recordId,
          methodology: "This metric intentionally omits the required verification and audit references.",
          confidence: 90,
          limitations: ["Weak metric should be rejected."],
        },
      ],
    }),
    headers: headers("researcher", "researcher_framework_reject_missing"),
  });
  const missingBody = await json<{ ok: false; error: string }>(missingMetricReference);
  assert.equal(missingMetricReference.status, 400);
  assert.equal(missingBody.ok, false);
  assert.match(missingBody.error, /verificationReference/);

  const unsafeClaim = await app.request("/canopyproof/reports/framework-packages", {
    method: "POST",
    body: JSON.stringify({
      ...frameworkPackageBody(organizationId, recordId, reportId, "TCFD"),
      methodology: "This package promises guaranteed RWA yield from proof records.",
    }),
    headers: headers("researcher", "researcher_framework_reject_unsafe"),
  });
  const unsafeBody = await json<{ ok: false; error: string }>(unsafeClaim);
  assert.equal(unsafeClaim.status, 400);
  assert.equal(unsafeBody.ok, false);
  assert.match(unsafeBody.error, /unsupported public claim/);
});

test("CanopyProof investor review packages include profile, portfolio, evidence coverage, verification stats, audit roots, and ESG exports", async () => {
  const organizationId = await createVerifiedOrganization("investor_001");
  const recordId = await createIssuedProofRecord("investor_001", "3".repeat(64));
  const reportId = await createEsgReport(recordId, "investor_001");

  const denied = await app.request("/canopyproof/reports/investor-review-packages", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      reportingPeriod: {
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-07-08T00:00:00.000Z",
      },
      proofRecordIds: [recordId],
      esgReportIds: [reportId],
    }),
    headers: headers("observer", "observer_investor_denied"),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/reports/investor-review-packages", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      reportingPeriod: {
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-07-08T00:00:00.000Z",
      },
      proofRecordIds: [recordId],
      esgReportIds: [reportId],
      projectPortfolio: [
        {
          projectId: "project_v1_institutional_demo",
          title: "Great Green Wall institutional proof portfolio",
          regionId: "region_ggw_sahel",
          status: "monitoring",
          proofRecordIds: [recordId],
        },
      ],
      riskProfile: [
        {
          severity: "medium",
          category: "monitoring_continuity",
          summary: "Field coverage requires continued seasonal monitoring before higher assurance language is used.",
          mitigation: "Keep quarterly evidence review and TerraProof cross-checks active for all project updates.",
          sourceReference: recordId,
        },
      ],
    }),
    headers: headers("researcher", "researcher_investor_package"),
  });
  const body = await json<{
    ok: true;
    data: {
      id: string;
      organization: { id: string; registrationNumber: string; verificationStatus: string };
      projectPortfolio: Array<{ projectId: string; proofRecordIds: string[] }>;
      evidenceCoverage: { proofRecordCount: number; evidenceIdCount: number; regionCount: number; evidenceRoot: string };
      verificationStatistics: { issuedRecordCount: number; minimumConfidence: number; humanReviewRequired: true };
      riskProfile: Array<{ riskId: string; severity: string; sourceReference: string }>;
      auditHistory: { organizationAuditRoots: string[]; proofAuditRoots: string[]; esgAuditRoots: string[] };
      esgReports: Array<{ id: string; confidenceScore: number }>;
      packageRoot: string;
      exports: { json: { href: string }; pdf: { href: string } };
      auditEvent: { entityType: string; actor: string };
    };
  }>(created);
  assert.equal(created.status, 201);
  assert.equal(body.data.organization.id, organizationId);
  assert.equal(body.data.organization.verificationStatus, "verified");
  assert.match(body.data.organization.registrationNumber, /^ICT-/);
  assert.equal(body.data.projectPortfolio[0]?.projectId, "project_v1_institutional_demo");
  assert.deepEqual(body.data.projectPortfolio[0]?.proofRecordIds, [recordId]);
  assert.equal(body.data.evidenceCoverage.proofRecordCount, 1);
  assert.equal(body.data.evidenceCoverage.evidenceIdCount, 1);
  assert.equal(body.data.evidenceCoverage.regionCount, 1);
  assert.match(body.data.evidenceCoverage.evidenceRoot, /^[a-f0-9]{64}$/);
  assert.equal(body.data.verificationStatistics.issuedRecordCount, 1);
  assert.equal(body.data.verificationStatistics.humanReviewRequired, true);
  assert.ok(body.data.verificationStatistics.minimumConfidence > 0);
  assert.equal(body.data.riskProfile[0]?.severity, "medium");
  assert.equal(body.data.riskProfile[0]?.sourceReference, recordId);
  assert.ok(body.data.auditHistory.organizationAuditRoots.length > 0);
  assert.ok(body.data.auditHistory.proofAuditRoots.length > 0);
  assert.ok(body.data.auditHistory.esgAuditRoots.length > 0);
  assert.equal(body.data.esgReports[0]?.id, reportId);
  assert.match(body.data.packageRoot, /^[a-f0-9]{64}$/);
  assert.equal(body.data.auditEvent.entityType, "investor_review_package");
  assert.equal(body.data.auditEvent.actor, "researcher_investor_package");

  const exportedJson = await app.request(body.data.exports.json.href, {
    headers: headers("observer", "observer_investor_export"),
  });
  assert.equal(exportedJson.status, 200);
  assert.match(exportedJson.headers.get("content-type") ?? "", /application\/json/);

  const exportedPdf = await app.request(body.data.exports.pdf.href, {
    headers: headers("observer", "observer_investor_export"),
  });
  assert.equal(exportedPdf.status, 200);
  assert.match(exportedPdf.headers.get("content-type") ?? "", /application\/pdf/);
  const pdf = new Uint8Array(await exportedPdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});
