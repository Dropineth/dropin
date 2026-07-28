import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { buildCanopyProofProofRecordSubjectId } from "../../services/api/src/domain/canopyproof/governance.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

const timestamp = "2026-07-08T00:00:00.000Z";

function evidencePayload(id: string, mediaHash: string, overrides: Record<string, unknown> = {}) {
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
    contributor: `community_verifier_${id}`,
    media_hash: mediaHash,
    gps_hash: "2".repeat(64),
    confidence_score: 90,
    offline_sync_id: `offline_${id}`,
    device_fingerprint_hash: "3".repeat(64),
    exif_hash: "4".repeat(64),
    ...overrides,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function headers(role: string, actorId = `${role}_api_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function createProofGovernanceApproval(input: Readonly<{
  projectId: string;
  evidenceIds: readonly string[];
  suffix: string;
  reviewer?: string;
}>) {
  const response = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId: buildCanopyProofProofRecordSubjectId({ projectId: input.projectId, evidenceIds: input.evidenceIds }),
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approved for Environmental Proof Record issuance after evidence, AI advisory, and human review checks.",
      conflictDisclosure: "No known conflict disclosed for this proof issuance approval.",
      decidedAt: "2026-07-08T01:30:00.000Z",
    }),
    headers: headers("verifier", input.reviewer ?? `verifier_governance_${input.suffix}`),
  });
  const body = await json<{ ok: true; data: { id: string; decision: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(body.data.decision, "approve");
  return body.data.id;
}

test("CanopyProof audit verification API validates hash-linked chains and challenges tampering", async () => {
  const payload = { evidenceId: "evidence_audit_api_001", mediaHash: "8".repeat(64) };
  const auditHistory = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: "community_audit_api",
    entityType: "evidence",
    entityId: "evidence_audit_api_001",
    payload,
    createdAt: "2026-07-08T00:00:00.000Z",
    rationale: "Evidence audit event submitted for API verification.",
  });

  const verified = await app.request("/canopyproof/audit/verify", {
    method: "POST",
    body: JSON.stringify({
      verifiedAt: "2026-07-08T00:01:00.000Z",
      entries: [{ event: auditHistory[0], payload }],
    }),
    headers: headers("observer", "observer_audit_api"),
  });
  const verifiedBody = await json<{
    ok: true;
    data: { valid: boolean; eventCount: number; chainRoot: string; auditEvent: { entityType: string; action: string; actor: string } };
  }>(verified);

  assert.equal(verified.status, 200);
  assert.equal(verifiedBody.data.valid, true);
  assert.equal(verifiedBody.data.eventCount, 1);
  assert.match(verifiedBody.data.chainRoot, /^[a-f0-9]{64}$/);
  assert.equal(verifiedBody.data.auditEvent.entityType, "audit_verification");
  assert.equal(verifiedBody.data.auditEvent.action, "ASSERT");
  assert.equal(verifiedBody.data.auditEvent.actor, "observer_audit_api");

  const tampered = await app.request("/canopyproof/audit/verify", {
    method: "POST",
    body: JSON.stringify({
      entries: [{ event: { ...auditHistory[0], rationale: "Tampered after submission." }, payload }],
    }),
    headers: headers("observer", "observer_audit_api"),
  });
  const tamperedBody = await json<{
    ok: true;
    data: { valid: boolean; issues: Array<{ code: string }>; auditEvent: { entityType: string; action: string } };
  }>(tampered);

  assert.equal(tampered.status, 422);
  assert.equal(tamperedBody.data.valid, false);
  assert.ok(tamperedBody.data.issues.some((issue) => issue.code === "invalid_event_root"));
  assert.equal(tamperedBody.data.auditEvent.entityType, "audit_verification");
  assert.equal(tamperedBody.data.auditEvent.action, "CHALLENGE");
});

test("CanopyProof proof API validates evidence and issues bounded Environmental Proof Records", async () => {
  const evidenceId = "evidence_api_clean_001";
  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(evidenceId, "5".repeat(64))),
    headers: headers("community", "community_verifier_api_clean"),
  });
  const evidenceBody = await json<{
    ok: true;
    data: { valid: boolean; issues: string[]; evidence: { id: string; contributor: string; verification_status: string; audit_history: unknown[] } };
  }>(evidenceResponse);

  assert.equal(evidenceResponse.status, 201);
  assert.equal(evidenceBody.data.valid, true);
  assert.deepEqual(evidenceBody.data.issues, []);
  assert.equal(evidenceBody.data.evidence.contributor, "community_verifier_api_clean");
  assert.equal(evidenceBody.data.evidence.verification_status, "validated");
  assert.ok(evidenceBody.data.evidence.audit_history.length >= 2);

  const aiResponse = await app.request(`/canopyproof/evidence/${evidenceId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({ observedAt: "2026-07-08T00:05:00.000Z" }),
    headers: headers("agent", "canopy_ai_agent_api"),
  });
  const aiBody = await json<{
    ok: true;
    data: { analysis: { advisoryOnly: true; findings: unknown[] }; evidence: { verification_status: string } };
  }>(aiResponse);

  assert.equal(aiResponse.status, 201);
  assert.equal(aiBody.data.analysis.advisoryOnly, true);
  assert.equal(aiBody.data.analysis.findings.length, 0);
  assert.equal(aiBody.data.evidence.verification_status, "needs_human_review");

  const governanceApprovalId = await createProofGovernanceApproval({
    projectId: "project_v1_ggw_demo",
    evidenceIds: [evidenceId],
    suffix: "api_001",
    reviewer: "verifier_api_authority_001",
  });
  const monitoringResponse = await app.request("/canopyproof/projects/project_v1_ggw_demo/monitoring-events", {
    method: "POST",
    body: JSON.stringify({
      eventType: "terra_scene_review",
      observedAt: "2026-07-08T01:20:00.000Z",
      evidenceIds: [evidenceId],
      terraSceneIds: ["cp_terra_scene_certificate_api_001"],
      biodiversityIndicators: ["native species survivorship"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      metrics: {
        ndviMean: 0.61,
        survivalPercent: 91,
      },
      state: "accepted",
      rationale: "Verifier linked TerraProof scene and field evidence before proof-record issuance.",
    }),
    headers: headers("verifier", "verifier_api_authority_001"),
  });
  const monitoringBody = await json<{ ok: true; data: { id: string; eventHash: string; auditEvent: { eventRoot: string } } }>(
    monitoringResponse,
  );

  assert.equal(monitoringResponse.status, 201);
  assert.match(monitoringBody.data.eventHash, /^[a-f0-9]{64}$/);

  const recordResponse = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      evidenceIds: [evidenceId],
      humanReview: {
        reviewer: "verifier_api_001",
        role: "verifier",
        decision: "approve",
        rationale: "Approved after field review and advisory AI consistency checks.",
        reviewedAt: "2026-07-08T01:00:00.000Z",
      },
      governanceApprovals: [governanceApprovalId],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
      monitoringEventIds: [monitoringBody.data.id],
      issuedAt: "2026-07-08T02:00:00.000Z",
    }),
    headers: headers("verifier", "verifier_api_authority_001"),
  });
  const recordBody = await json<{
    ok: true;
    data: {
      id: string;
      recordType: string;
      evidenceRoot: string;
      evidenceIds: string[];
      verificationHistory: unknown[];
      monitoringTimeline: string[];
      monitoringEventIds: string[];
      contributors: string[];
      governanceApprovals: string[];
      status: string;
      recordHash: string;
      claimBoundary: {
        notCarbonCredit: true;
        notFinancialAsset: true;
        notTaxOffset: true;
        notGuaranteedYield: true;
        notAutomaticCanopyDistribution: true;
        disclosure: string;
      };
    };
  }>(recordResponse);

  assert.equal(recordResponse.status, 201);
  assert.equal(recordBody.data.recordType, "environmental_proof_record");
  assert.equal(recordBody.data.status, "issued");
  assert.equal(recordBody.data.claimBoundary.notCarbonCredit, true);
  assert.equal(recordBody.data.claimBoundary.notFinancialAsset, true);
  assert.equal(recordBody.data.claimBoundary.notTaxOffset, true);
  assert.equal(recordBody.data.claimBoundary.notGuaranteedYield, true);
  assert.equal(recordBody.data.claimBoundary.notAutomaticCanopyDistribution, true);
  assert.match(recordBody.data.claimBoundary.disclosure, /not a certified carbon credit/);
  assert.deepEqual(recordBody.data.monitoringEventIds, [monitoringBody.data.id]);

  const certificateResponse = await app.request(`/canopyproof/proof-records/${recordBody.data.id}/certificate`, {
    headers: headers("observer", "observer_certificate_api_001"),
  });
  const certificateBody = await json<{
    ok: true;
    data: {
      certificateId: string;
      certificateVersion: "canopyproof_certificate_artifact_v1";
      recordId: string;
      recordType: string;
      project: { id: string; evidenceCount: number };
      location: {
        primary: { latitude: number; longitude: number; accuracyMeters?: number; regionId?: string };
        evidenceLocations: Array<{ latitude: number; longitude: number; accuracyMeters?: number; regionId?: string }>;
      };
      evidenceRoot: string;
      evidenceIds: string[];
      verificationHistory: unknown[];
      monitoringTimeline: string[];
      monitoringEventIds: string[];
      monitoringEventRoot: string;
      projectMonitoringEvents: Array<{
        id: string;
        projectId: string;
        eventType: string;
        state: string;
        eventHash: string;
        auditEventRoot: string;
      }>;
      contributors: string[];
      governanceApprovalIds: string[];
      governanceApprovals: Array<{
        id: string;
        subjectType: "proof_record";
        subjectId: string;
        policyId: string;
        reviewer: string;
        reviewerRole: string;
        decision: "approve";
        rationale: string;
        conflictDisclosure: string;
        decidedAt: string;
        approvalHash: string;
        auditEventRoot: string;
      }>;
      publicChallenges: unknown[];
      status: string;
      sourceRecordHash: string;
      disclosure: string;
      certificateHash: string;
      claimBoundary: {
        notCarbonCredit: true;
        notFinancialAsset: true;
        notTaxOffset: true;
        notGuaranteedYield: true;
        notAutomaticCanopyDistribution: true;
      };
    };
  }>(certificateResponse);

  assert.equal(certificateResponse.status, 200);
  assert.equal(certificateBody.data.certificateVersion, "canopyproof_certificate_artifact_v1");
  assert.equal(certificateBody.data.recordId, recordBody.data.id);
  assert.equal(certificateBody.data.recordType, "environmental_proof_record");
  assert.equal(certificateBody.data.project.id, "project_v1_ggw_demo");
  assert.equal(certificateBody.data.project.evidenceCount, 1);
  assert.deepEqual(certificateBody.data.evidenceIds, recordBody.data.evidenceIds);
  assert.equal(certificateBody.data.evidenceRoot, recordBody.data.evidenceRoot);
  assert.equal(certificateBody.data.sourceRecordHash, recordBody.data.recordHash);
  assert.deepEqual(certificateBody.data.monitoringTimeline, recordBody.data.monitoringTimeline);
  assert.deepEqual(certificateBody.data.monitoringEventIds, recordBody.data.monitoringEventIds);
  assert.match(certificateBody.data.monitoringEventRoot, /^[a-f0-9]{64}$/);
  assert.equal(certificateBody.data.projectMonitoringEvents.length, 1);
  assert.equal(certificateBody.data.projectMonitoringEvents[0]?.id, monitoringBody.data.id);
  assert.equal(certificateBody.data.projectMonitoringEvents[0]?.projectId, "project_v1_ggw_demo");
  assert.equal(certificateBody.data.projectMonitoringEvents[0]?.eventType, "terra_scene_review");
  assert.equal(certificateBody.data.projectMonitoringEvents[0]?.state, "accepted");
  assert.equal(certificateBody.data.projectMonitoringEvents[0]?.eventHash, monitoringBody.data.eventHash);
  assert.equal(certificateBody.data.projectMonitoringEvents[0]?.auditEventRoot, monitoringBody.data.auditEvent.eventRoot);
  assert.deepEqual(certificateBody.data.contributors, recordBody.data.contributors);
  assert.deepEqual(certificateBody.data.governanceApprovalIds, recordBody.data.governanceApprovals);
  assert.equal(certificateBody.data.governanceApprovals.length, 1);
  assert.equal(certificateBody.data.governanceApprovals[0]?.id, governanceApprovalId);
  assert.equal(certificateBody.data.governanceApprovals[0]?.subjectType, "proof_record");
  assert.equal(certificateBody.data.governanceApprovals[0]?.policyId, "canopyproof_policy_proof_record_issuance_v1");
  assert.equal(certificateBody.data.governanceApprovals[0]?.reviewer, "verifier_api_authority_001");
  assert.equal(certificateBody.data.governanceApprovals[0]?.reviewerRole, "verifier");
  assert.equal(certificateBody.data.governanceApprovals[0]?.decision, "approve");
  assert.match(certificateBody.data.governanceApprovals[0]?.rationale ?? "", /Environmental Proof Record issuance/);
  assert.match(certificateBody.data.governanceApprovals[0]?.conflictDisclosure ?? "", /No known conflict/);
  assert.match(certificateBody.data.governanceApprovals[0]?.approvalHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(certificateBody.data.governanceApprovals[0]?.auditEventRoot ?? "", /^[a-f0-9]{64}$/);
  assert.equal(certificateBody.data.location.primary.regionId, "region_ggw_sahel");
  assert.equal(certificateBody.data.location.evidenceLocations.length, 1);
  assert.equal(certificateBody.data.verificationHistory.length, recordBody.data.verificationHistory.length);
  assert.deepEqual(certificateBody.data.publicChallenges, []);
  assert.equal(certificateBody.data.status, "issued");
  assert.match(certificateBody.data.certificateId, /^cp_cert_[a-f0-9]{24}$/);
  assert.match(certificateBody.data.certificateHash, /^[a-f0-9]{64}$/);
  assert.equal(certificateBody.data.claimBoundary.notCarbonCredit, true);
  assert.equal(certificateBody.data.claimBoundary.notFinancialAsset, true);
  assert.equal(certificateBody.data.claimBoundary.notTaxOffset, true);
  assert.equal(certificateBody.data.claimBoundary.notGuaranteedYield, true);
  assert.equal(certificateBody.data.claimBoundary.notAutomaticCanopyDistribution, true);
  assert.match(certificateBody.data.disclosure, /not a certified carbon credit/);
});

test("CanopyProof proof API retains fake evidence as challenged instead of issuing final proof", async () => {
  const evidenceId = "evidence_api_fake_001";
  const response = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(
      evidencePayload(evidenceId, "6".repeat(64), {
        location: {
          latitude: 14.7167,
          longitude: -17.4677,
          accuracyMeters: 800,
          regionId: "region_ggw_sahel",
        },
      }),
    ),
    headers: headers("community", "community_verifier_api_fake"),
  });
  const body = await json<{
    ok: true;
    data: { valid: boolean; issues: string[]; evidence: { verification_status: string; confidence_score: number } };
  }>(response);

  assert.equal(response.status, 202);
  assert.equal(body.data.valid, false);
  assert.ok(body.data.issues.includes("gps_accuracy_too_weak"));
  assert.equal(body.data.evidence.verification_status, "challenged");
  assert.ok(body.data.evidence.confidence_score <= 25);
});

test("CanopyProof proof API rejects non-accepted project monitoring events for issuance", async () => {
  const monitoringResponse = await app.request("/canopyproof/projects/project_v1_ggw_demo/monitoring-events", {
    method: "POST",
    body: JSON.stringify({
      eventType: "risk_signal",
      observedAt: "2026-07-08T03:00:00.000Z",
      terraSceneIds: ["cp_terra_scene_needs_review_for_proof_api"],
      climateRiskIndicators: ["drought exposure"],
      metrics: {
        droughtRiskScore: 0.72,
      },
      state: "needs_review",
      rationale: "Monitoring signal requires reviewer resolution before supporting proof issuance.",
    }),
    headers: headers("verifier", "verifier_monitoring_needs_review"),
  });
  const monitoringBody = await json<{ ok: true; data: { id: string; state: string } }>(monitoringResponse);

  assert.equal(monitoringResponse.status, 202);
  assert.equal(monitoringBody.data.state, "needs_review");

  const blockedRecord = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      evidenceIds: ["cp_evidence_monitoring_needs_review_for_proof_api"],
      humanReview: {
        reviewer: "verifier_body_should_be_overridden",
        role: "verifier",
        decision: "approve",
        rationale: "Attempted issuance with a monitoring event that still needs review.",
        reviewedAt: "2026-07-08T03:10:00.000Z",
      },
      governanceApprovals: ["cp_governance_monitoring_needs_review_for_proof_api"],
      monitoringTimeline: ["submitted", "monitoring_needs_review"],
      monitoringEventIds: [monitoringBody.data.id],
      issuedAt: "2026-07-08T03:15:00.000Z",
    }),
    headers: headers("verifier", "verifier_monitoring_needs_review"),
  });
  const blockedBody = await json<{ ok: false; error: string }>(blockedRecord);

  assert.equal(blockedRecord.status, 400);
  assert.match(blockedBody.error, /must be accepted before proof issuance/);
});

test("CanopyProof proof API blocks unresolved duplicate, GPS spoofing, and satellite contradiction findings", async () => {
  const firstId = "evidence_api_attack_seed_001";
  const secondId = "evidence_api_attack_target_001";
  const sharedMediaHash = "7".repeat(64);

  await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(firstId, sharedMediaHash)),
    headers: headers("community", "community_verifier_attack_seed"),
  });
  await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload(secondId, sharedMediaHash, { gps_hash: "8".repeat(64) })),
    headers: headers("community", "community_verifier_attack_target"),
  });

  const aiResponse = await app.request(`/canopyproof/evidence/${secondId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({
      observedAt: "2026-07-08T00:10:00.000Z",
      expectedLocation: { latitude: 15.5, longitude: -17.4677 },
      satelliteObservation: {
        vegetationSignal: "contradicts",
        waterSignal: "contradicts",
        acquiredAt: "2026-07-08T00:00:00.000Z",
      },
      ecologicalObservation: {
        biodiversitySignal: "neutral",
        soilMoistureSignal: "contradicts",
        disturbanceSignal: "major",
        observedAt: "2026-07-08T00:06:00.000Z",
      },
      survivalObservation: {
        survivalSignal: "contradicts",
        estimatedSurvivalPercent: 52,
        mortalityPercent: 48,
        observedAt: "2026-07-08T00:07:00.000Z",
        method: "field_count",
      },
    }),
    headers: headers("agent", "canopy_ai_agent_attack"),
  });
  const aiBody = await json<{
    ok: true;
    data: { analysis: { advisoryOnly: true; findings: Array<{ id: string; code: string }> } };
  }>(aiResponse);
  const findingCodes = aiBody.data.analysis.findings.map((finding) => finding.code).join(" ");

  assert.equal(aiResponse.status, 202);
  assert.equal(aiBody.data.analysis.advisoryOnly, true);
  assert.match(findingCodes, /duplicate_media_hash/);
  assert.match(findingCodes, /gps_spoofing_suspected/);
  assert.match(findingCodes, /satellite_contradiction/);
  assert.match(findingCodes, /ecological_context_risk/);
  assert.match(findingCodes, /survival_estimation_contradiction/);

  const governanceApprovalId = await createProofGovernanceApproval({
    projectId: "project_v1_ggw_demo",
    evidenceIds: [secondId],
    suffix: "api_002",
    reviewer: "verifier_api_attack",
  });

  const blockedRecord = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      evidenceIds: [secondId],
      humanReview: {
        reviewer: "verifier_api_002",
        role: "verifier",
        decision: "approve",
        rationale: "Attempted approval without resolving critical findings.",
        reviewedAt: "2026-07-08T01:00:00.000Z",
      },
      governanceApprovals: [governanceApprovalId],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
    }),
    headers: headers("verifier", "verifier_api_attack"),
  });
  const blockedBody = await json<{ ok: false; error: string }>(blockedRecord);

  assert.equal(blockedRecord.status, 400);
  assert.equal(blockedBody.ok, false);
  assert.match(blockedBody.error, /Critical AI findings must be explicitly resolved/);
});

test("CanopyProof proof API enforces RBAC for evidence, AI analysis, and proof issuance", async () => {
  const deniedEvidence = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload("evidence_api_rbac_denied_001", "9".repeat(64))),
    headers: headers("observer", "observer_api_denied"),
  });
  const deniedEvidenceBody = await json<{ ok: false; error: string }>(deniedEvidence);

  assert.equal(deniedEvidence.status, 403);
  assert.equal(deniedEvidenceBody.ok, false);
  assert.match(deniedEvidenceBody.error, /CANOPYPROOF_RBAC_DENIED/);

  const allowedEvidence = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify(evidencePayload("evidence_api_rbac_allowed_001", "a".repeat(64))),
    headers: headers("community", "community_verifier_rbac_allowed"),
  });
  assert.equal(allowedEvidence.status, 201);

  const deniedAi = await app.request("/canopyproof/evidence/evidence_api_rbac_allowed_001/ai-analysis", {
    method: "POST",
    body: JSON.stringify({ observedAt: "2026-07-08T00:05:00.000Z" }),
    headers: headers("community", "community_verifier_rbac_allowed"),
  });
  assert.equal(deniedAi.status, 403);

  const deniedProof = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      evidenceIds: ["evidence_api_rbac_allowed_001"],
      humanReview: {
        reviewer: "admin_should_not_be_trusted",
        role: "verifier",
        decision: "approve",
        rationale: "Admin cannot self-promote into verifier authority at this boundary.",
        reviewedAt: "2026-07-08T01:00:00.000Z",
      },
      governanceApprovals: ["ngo_board_approval_api_rbac"],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
    }),
    headers: headers("admin", "admin_api_denied_for_proof"),
  });
  assert.equal(deniedProof.status, 403);
});

test("CanopyProof OS PostgreSQL contract defines required schemas and append-only audit triggers", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  for (const schema of [
    "identity",
    "organizations",
    "projects",
    "evidence",
    "verification",
    "certificates",
    "satellite",
    "impact",
    "funding",
    "governance",
    "reporting",
    "audit",
  ]) {
    assert.match(sql, new RegExp(`CREATE SCHEMA IF NOT EXISTS ${schema};`), `${schema} schema must exist`);
  }

  for (const table of [
    "identity.participants",
    "identity.device_attestations",
    "organizations.organizations",
    "organizations.roles",
    "organizations.permissions",
    "projects.monitoring_events",
    "projects.project_status_transitions",
    "organizations.memberships",
    "organizations.verification_documents",
    "organizations.accreditations",
    "organizations.data_sharing_agreements",
    "projects.projects",
    "evidence.evidence_objects",
    "evidence.media_upload_intents",
    "evidence.media_objects",
    "evidence.consent_receipts",
    "evidence.media_metadata_extractions",
    "evidence.review_tasks",
    "evidence.retention_policy_decisions",
    "evidence.offline_sync_batches",
    "evidence.offline_sync_items",
    "evidence.community_attestations",
    "verification.ai_analyses",
    "verification.work_items",
    "verification.human_reviews",
    "certificates.environmental_proof_candidates",
    "governance.environmental_proof_candidate_approvals",
    "certificates.environmental_proof_record_facts",
    "certificates.environmental_proof_challenges",
    "certificates.environmental_proof_challenge_risk_signals",
    "governance.environmental_proof_challenge_reviews",
    "governance.environmental_proof_challenge_resolutions",
    "certificates.environmental_proof_records",
    "certificates.proof_record_challenges",
    "satellite.observations",
    "impact.metrics",
    "funding.allocations",
    "governance.policies",
    "governance.approvals",
    "governance.conflict_disclosures",
    "governance.proposals",
    "governance.votes",
    "governance.release_council_reviews",
    "reporting.framework_packages",
    "reporting.investor_review_packages",
    "audit.event_log",
    "audit.memory_records",
    "audit.abuse_signals",
    "audit.resilience_drills",
    "audit.audit_verifications",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table.replace(".", "\\.")}`), `${table} table must exist`);
  }

  assert.match(sql, /audit\.prevent_event_log_update_or_delete/);
  assert.match(sql, /audit records are append-only/);
  assert.match(sql, /subject_type IN \([\s\S]*'proof_record'[\s\S]*'agent_event'[\s\S]*'governance_approval'/);
  assert.match(sql, /retention_class text NOT NULL CHECK \(retention_class IN \('operational', 'institutional', 'research', 'legal_hold'\)\)/);
  assert.match(sql, /final_authority boolean NOT NULL DEFAULT false CHECK \(final_authority IS false\)/);
  assert.match(sql, /CHECK \(array_length\(source_ids, 1\) > 0\)/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.evidence_objects/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.media_upload_intents/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.media_objects/);
  assert.match(sql, /organization_type IN \([\s\S]*'research_institution'[\s\S]*'corporate'[\s\S]*'community_organization'[\s\S]*'auditor'/);
  assert.match(sql, /project_type text NOT NULL CHECK \(project_type IN \('reforestation', 'ecosystem_restoration', 'biodiversity', 'water', 'soil_regeneration', 'climate_observation'\)\)/);
  assert.match(sql, /status text NOT NULL DEFAULT 'submitted' CHECK \(status IN \('submitted', 'under_review', 'active', 'monitored', 'challenged', 'suspended', 'archived'\)\)/);
  assert.match(sql, /area_hectares numeric\(18, 6\) NOT NULL DEFAULT 0 CHECK \(area_hectares >= 0\)/);
  assert.match(sql, /monitoring_cadence_days integer NOT NULL DEFAULT 90 CHECK \(monitoring_cadence_days > 0\)/);
  assert.match(sql, /governance_approval_id text,/);
  assert.match(
    sql,
    /ADD CONSTRAINT projects_governance_approval_fk[\s\S]*FOREIGN KEY \(governance_approval_id\) REFERENCES governance\.approvals\(id\)/,
  );
  assert.match(sql, /project_hash text NOT NULL UNIQUE/);
  assert.match(sql, /claim_boundary jsonb NOT NULL/);
  assert.match(sql, /CHECK \(status = 'submitted'\)/);
  assert.match(sql, /project_root text NOT NULL UNIQUE/);
  assert.match(sql, /audit_event_root text NOT NULL UNIQUE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS projects\.project_status_transitions/);
  assert.match(sql, /project_transition_governance_approval_fk/);
  assert.match(sql, /event_type text NOT NULL CHECK \(event_type IN \('field_observation', 'terra_scene_review', 'biodiversity_survey', 'water_measurement', 'survival_check', 'risk_signal'\)\)/);
  assert.match(sql, /state text NOT NULL CHECK \(state IN \('submitted', 'accepted', 'needs_review', 'challenged'\)\)/);
  assert.match(sql, /event_hash text NOT NULL UNIQUE/);
  assert.match(sql, /CHECK \(cardinality\(evidence_ids\) > 0 OR cardinality\(terra_scene_ids\) > 0\)/);
  assert.match(sql, /project_registration_event_binding/);
  assert.match(sql, /project_transition_event_binding/);
  assert.match(sql, /project_monitoring_event_binding/);
  assert.match(sql, /project_registration_no_update/);
  assert.match(sql, /project_transition_no_update/);
  assert.match(sql, /project_monitoring_no_update/);
  assert.match(sql, /project_root_at_submission text NOT NULL/);
  assert.match(sql, /project_region_id_at_submission text NOT NULL/);
  assert.match(sql, /project_authority_updated_at_at_submission timestamptz NOT NULL/);
  assert.match(sql, /contributor_role text NOT NULL CHECK \(contributor_role IN \('owner', 'admin', 'verifier', 'researcher', 'community'\)\)/);
  assert.match(sql, /verification_status text NOT NULL CHECK \(verification_status IN \('validated', 'challenged'\)\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION evidence\.registration_hash/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION evidence\.registration_root/);
  assert.match(sql, /evidence_registration_event_binding/);
  assert.match(sql, /evidence_registration_validate/);
  assert.match(sql, /evidence_registration_no_update/);
  assert.match(sql, /evidence_registration_no_delete/);
  assert.match(sql, /structuralValidationOnly/);
  assert.match(sql, /pendingAiAndHumanReview/);
  assert.match(sql, /record_type text NOT NULL DEFAULT 'environmental_proof_record' CHECK \(record_type = 'environmental_proof_record'\)/);
  assert.match(sql, /location jsonb NOT NULL/);
  assert.match(sql, /verification_history jsonb NOT NULL/);
  assert.match(sql, /monitoring_event_ids text\[\] NOT NULL DEFAULT ARRAY\[\]::text\[\]/);
  assert.match(sql, /status text NOT NULL CHECK \(status IN \('issued', 'challenged', 'revoked'\)\)/);
  assert.match(sql, /verification_status text NOT NULL DEFAULT 'pending'/);
  assert.match(sql, /trust_level text NOT NULL DEFAULT 'unverified'/);
  assert.match(sql, /documents jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(sql, /authorized_users jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(sql, /role_name text NOT NULL UNIQUE CHECK \(role_name IN \('owner', 'admin', 'verifier', 'researcher', 'community', 'observer'\)\)/);
  assert.match(sql, /resource text NOT NULL CHECK \(resource IN \('organization', 'membership', 'accreditation', 'data_sharing_agreement', 'evidence', 'report', 'audit'\)\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS organizations\.memberships/);
  assert.match(sql, /UNIQUE \(organization_id, actor_id, role\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS organizations\.verification_documents/);
  assert.match(sql, /document_type text NOT NULL CHECK \(document_type IN \('registration', 'tax', 'accreditation', 'mandate', 'audit_letter', 'other'\)\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS organizations\.accreditations/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS organizations\.data_sharing_agreements/);
  assert.match(sql, /privacy_tier text NOT NULL CHECK \(privacy_tier IN \('public', 'restricted', 'confidential'\)\)/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON identity\.device_attestations/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON organizations\.roles/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON organizations\.permissions/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON organizations\.memberships/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON organizations\.verification_documents/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON organizations\.accreditations/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON organizations\.data_sharing_agreements/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON projects\.monitoring_events/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.consent_receipts/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.media_metadata_extractions/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.review_tasks/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.retention_policy_decisions/);
  assert.match(sql, /identity_device_attestations_no_update/);
  assert.match(sql, /identity_device_attestations_no_delete/);
  assert.match(sql, /evidence_media_objects_no_update/);
  assert.match(sql, /evidence_media_objects_no_delete/);
  assert.match(sql, /evidence_consent_receipts_no_delete/);
  assert.match(sql, /media_metadata_extractions_no_update/);
  assert.match(sql, /media_metadata_extractions_no_delete/);
  assert.match(sql, /organizations_roles_no_update/);
  assert.match(sql, /organizations_roles_no_delete/);
  assert.match(sql, /organizations_permissions_no_update/);
  assert.match(sql, /organizations_permissions_no_delete/);
  assert.match(sql, /organizations_memberships_no_delete/);
  assert.match(sql, /organizations_verification_documents_no_update/);
  assert.match(sql, /organizations_verification_documents_no_delete/);
  assert.match(sql, /organizations_accreditations_no_update/);
  assert.match(sql, /organizations_accreditations_no_delete/);
  assert.match(sql, /organizations_data_sharing_agreements_no_update/);
  assert.match(sql, /organizations_data_sharing_agreements_no_delete/);
  assert.match(sql, /evidence_review_tasks_no_delete/);
  assert.match(sql, /retention_policy_decisions_no_update/);
  assert.match(sql, /retention_policy_decisions_no_delete/);
  assert.match(sql, /verification_work_items_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.offline_sync_batches/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON evidence\.community_attestations/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON verification\.work_items/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON verification\.human_reviews/);
  assert.match(sql, /environmental_proof_candidates_validate/);
  assert.match(sql, /environmental_proof_candidates_no_update/);
  assert.match(sql, /environmental_proof_candidate_approvals_validate/);
  assert.match(sql, /environmental_proof_candidate_approvals_no_update/);
  assert.match(sql, /environmental_proof_record_facts_validate/);
  assert.match(sql, /environmental_proof_record_facts_no_update/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION certificates\.environmental_proof_record_projection/);
  assert.match(sql, /environmental_proof_challenges_validate/);
  assert.match(sql, /environmental_proof_challenges_no_update/);
  assert.match(sql, /environmental_proof_challenge_risk_signals_validate/);
  assert.match(sql, /environmental_proof_challenge_reviews_validate/);
  assert.match(sql, /environmental_proof_challenge_resolutions_validate/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION certificates\.environmental_proof_governed_record_projection/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON certificates\.environmental_proof_records/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON certificates\.proof_record_challenges/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.policies/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.approvals/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.conflict_disclosures/);
  assert.match(sql, /proposal_type text NOT NULL CHECK \(\s*proposal_type IN \([\s\S]*'policy_change'[\s\S]*'partner_accreditation'[\s\S]*'release_governance'/);
  assert.match(sql, /status text NOT NULL CHECK \(status IN \('draft', 'open', 'approved', 'rejected', 'challenged', 'executed', 'withdrawn'\)\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS governance\.votes/);
  assert.match(sql, /decision text NOT NULL CHECK \(decision IN \('approve', 'reject', 'abstain', 'challenge'\)\)/);
  assert.match(sql, /UNIQUE \(proposal_id, voter_id\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS governance\.release_council_reviews/);
  assert.match(sql, /target_commit text NOT NULL CHECK \(target_commit ~ '\^\[0-9a-f\]\{40\}\$'\)/);
  assert.match(sql, /reviewer_role text NOT NULL CHECK \(reviewer_role = 'release-council'\)/);
  assert.match(sql, /UNIQUE \(target, target_commit, reviewer_id\)/);
  assert.match(sql, /governance_proposals_no_update/);
  assert.match(sql, /governance_proposals_no_delete/);
  assert.match(sql, /governance_votes_no_update/);
  assert.match(sql, /governance_votes_no_delete/);
  assert.match(sql, /governance_release_council_reviews_no_update/);
  assert.match(sql, /governance_release_council_reviews_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.proposals/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.votes/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.release_council_reviews/);
  assert.match(sql, /framework text NOT NULL CHECK \(framework IN \('UN_SDG', 'UNFCCC', 'GRI', 'ISSB', 'TCFD'\)\)/);
  assert.match(sql, /CHECK \(jsonb_array_length\(metrics\) > 0\)/);
  assert.match(sql, /CHECK \(array_length\(esg_report_ids, 1\) > 0\)/);
  assert.match(sql, /reporting_framework_packages_no_update/);
  assert.match(sql, /reporting_framework_packages_no_delete/);
  assert.match(sql, /reporting_investor_review_packages_no_update/);
  assert.match(sql, /reporting_investor_review_packages_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON reporting\.framework_packages/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON reporting\.investor_review_packages/);
  assert.match(sql, /audit_memory_records_no_update/);
  assert.match(sql, /audit_memory_records_no_delete/);
  assert.match(sql, /audit_verifications_no_update/);
  assert.match(sql, /audit_verifications_no_delete/);
  assert.match(sql, /scope text NOT NULL CHECK \(scope IN \('evidence', 'proof_record', 'organization', 'funding', 'governance', 'reporting', 'system'\)\)/);
  assert.match(sql, /event_count integer NOT NULL CHECK \(event_count > 0\)/);
  assert.match(sql, /chain_root text NOT NULL UNIQUE/);
  assert.match(sql, /issue_codes text\[\] NOT NULL DEFAULT ARRAY\[\]::text\[\]/);
  assert.match(sql, /submitted_event_roots text\[\] NOT NULL/);
  assert.match(sql, /verifier_version text NOT NULL/);
  assert.match(sql, /CHECK \(array_length\(submitted_event_roots, 1\) = event_count\)/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON audit\.memory_records/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON audit\.abuse_signals/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON audit\.resilience_drills/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON audit\.audit_verifications/);
  assert.match(sql, /CHECK \(advisory_only IS true\)/);
});
