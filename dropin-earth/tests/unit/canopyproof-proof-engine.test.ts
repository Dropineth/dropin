import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCanopyProofAuditEvent,
  buildCanopyAiAnalysis,
  issueEnvironmentalProofRecord,
  validateCanopyProofEvidenceEnvelope,
  verifyCanopyProofAuditChain,
  type CanopyProofEvidenceEnvelope,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";
import { EvidenceService } from "../../services/api/src/domain/impact/evidence-service.js";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { certificateDisclosure } from "../../services/api/src/domain/impact/impact-engine.js";

const mediaHash = "a".repeat(64);
const gpsHash = "b".repeat(64);

function evidence(overrides: Partial<CanopyProofEvidenceEnvelope> = {}): CanopyProofEvidenceEnvelope {
  const baseAudit = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: "field_device_001",
    entityType: "evidence",
    entityId: "evidence_cp_001",
    payload: { mediaHash, gpsHash },
    createdAt: "2026-07-08T00:00:00.000Z",
    rationale: "Offline evidence envelope created by authenticated contributor device.",
  });

  return {
    id: "evidence_cp_001",
    projectId: "project_v1_ggw_demo",
    evidenceType: "tree_planting",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 12,
      regionId: "region_ggw_sahel",
    },
    timestamp: "2026-07-08T00:00:00.000Z",
    contributor: "community_verifier_001",
    media_hash: mediaHash,
    gps_hash: gpsHash,
    verification_status: "submitted",
    confidence_score: 88,
    reviewers: [],
    audit_history: baseAudit,
    offline_sync_id: "offline_batch_001",
    device_fingerprint_hash: "c".repeat(64),
    exif_hash: "d".repeat(64),
    ...overrides,
  };
}

test("CanopyProof evidence envelope validates required production fields", () => {
  assert.deepEqual(validateCanopyProofEvidenceEnvelope(evidence()), []);

  const issues = validateCanopyProofEvidenceEnvelope(
    evidence({
      contributor: "anonymous",
      media_hash: "not-a-hash",
      location: { latitude: 120, longitude: -17.4677, accuracyMeters: 800 },
      audit_history: [],
    }),
  );

  assert.ok(issues.includes("unaccountable_contributor"));
  assert.ok(issues.includes("invalid_media_hash"));
  assert.ok(issues.includes("invalid_latitude"));
  assert.ok(issues.includes("gps_accuracy_too_weak"));
  assert.ok(issues.includes("missing_append_only_audit_history"));
});

test("CanopyProof audit chain verifier detects tampering and payload drift", () => {
  const firstPayload = { mediaHash, gpsHash };
  const secondPayload = { decision: "approve", reviewer: "verifier_audit_chain" };
  const firstHistory = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: "field_device_001",
    entityType: "evidence",
    entityId: "evidence_audit_chain_001",
    payload: firstPayload,
    createdAt: "2026-07-08T00:00:00.000Z",
    rationale: "Evidence submitted for audit chain verification.",
  });
  const fullHistory = appendCanopyProofAuditEvent(firstHistory, {
    action: "FULFILL",
    actor: "verifier_audit_chain",
    entityType: "human_review",
    entityId: "evidence_audit_chain_001",
    payload: secondPayload,
    createdAt: "2026-07-08T00:10:00.000Z",
    rationale: "Human review completed for audit chain verification.",
  });
  const verified = verifyCanopyProofAuditChain(
    [
      { event: fullHistory[0]!, payload: firstPayload },
      { event: fullHistory[1]!, payload: secondPayload },
    ],
    "2026-07-08T00:11:00.000Z",
  );
  const tamperedActor = verifyCanopyProofAuditChain([{ event: { ...fullHistory[0]!, actor: "attacker" }, payload: firstPayload }]);
  const tamperedPayload = verifyCanopyProofAuditChain([{ event: fullHistory[0]!, payload: { mediaHash, gpsHash: "tampered" } }]);
  const duplicate = verifyCanopyProofAuditChain([fullHistory[0]!, fullHistory[0]!]);

  assert.equal(verified.valid, true);
  assert.equal(verified.eventCount, 2);
  assert.equal(verified.terminalRoot, fullHistory[1]?.eventRoot);
  assert.match(verified.chainRoot, /^[a-f0-9]{64}$/);
  assert.equal(verified.safety.previousRootsLinked, true);

  assert.equal(tamperedActor.valid, false);
  assert.ok(tamperedActor.issues.some((issue) => issue.code === "invalid_event_root"));
  assert.ok(tamperedActor.issues.some((issue) => issue.code === "invalid_event_id"));

  assert.equal(tamperedPayload.valid, false);
  assert.ok(tamperedPayload.issues.some((issue) => issue.code === "invalid_payload_hash"));

  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.issues.some((issue) => issue.code === "duplicate_event_id"));
  assert.ok(duplicate.issues.some((issue) => issue.code === "invalid_previous_root"));
});

test("Canopy AI flags duplicate planting, GPS spoofing, and satellite contradiction without final authority", () => {
  const proof = evidence();
  const analysis = buildCanopyAiAnalysis({
    evidence: proof,
    knownMediaHashes: [proof.media_hash],
    expectedLocation: { latitude: 15.5, longitude: -17.4677 },
    satelliteObservation: {
      vegetationSignal: "contradicts",
      waterSignal: "neutral",
      acquiredAt: "2026-07-08T00:00:00.000Z",
    },
  });

  assert.equal(analysis.advisoryOnly, true);
  assert.equal(analysis.recommendedStatus, "rejected");
  assert.equal(analysis.audit_event.actor, "Canopy AI Agent");
  assert.match(analysis.findings.map((finding) => finding.code).join(" "), /duplicate_media_hash/);
  assert.match(analysis.findings.map((finding) => finding.code).join(" "), /gps_spoofing_suspected/);
  assert.match(analysis.findings.map((finding) => finding.code).join(" "), /satellite_contradiction/);
});

test("Canopy AI flags ecological context and survival-estimation risks without becoming final authority", () => {
  const proof = evidence({ confidence_score: 92 });
  const analysis = buildCanopyAiAnalysis({
    evidence: proof,
    ecologicalObservation: {
      biodiversitySignal: "neutral",
      soilMoistureSignal: "contradicts",
      disturbanceSignal: "major",
      observedAt: "2026-07-15T00:00:00.000Z",
    },
    survivalObservation: {
      survivalSignal: "contradicts",
      estimatedSurvivalPercent: 54,
      mortalityPercent: 46,
      observedAt: "2026-07-15T00:00:00.000Z",
      method: "field_count",
    },
  });
  const findingCodes = analysis.findings.map((finding) => finding.code).join(" ");
  const capabilities = analysis.findings.map((finding) => finding.capability).join(" ");

  assert.equal(analysis.advisoryOnly, true);
  assert.equal(analysis.recommendedStatus, "rejected");
  assert.match(findingCodes, /ecological_context_risk/);
  assert.match(findingCodes, /survival_estimation_contradiction/);
  assert.match(capabilities, /ecological reasoning/);
  assert.match(capabilities, /survival estimation/);
  assert.ok(analysis.confidence_score < proof.confidence_score);
});

test("Environmental Proof Record requires human approval and governance before issuance", () => {
  const proof = evidence({ verification_status: "accepted", reviewers: ["verifier_001"] });
  const analysis = buildCanopyAiAnalysis({ evidence: proof });

  assert.throws(
    () =>
      issueEnvironmentalProofRecord({
        projectId: proof.projectId,
        evidence: [proof],
        aiAnalyses: [analysis],
        humanReview: {
          reviewer: "verifier_001",
          role: "verifier",
          decision: "reject",
          rationale: "Rejected pending field revisit.",
          reviewedAt: "2026-07-08T01:00:00.000Z",
        },
        governanceApprovals: ["ngo_board_approval_001"],
        monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
      }),
    /HUMAN_REVIEW_REQUIRED/,
  );

  assert.throws(
    () =>
      issueEnvironmentalProofRecord({
        projectId: proof.projectId,
        evidence: [proof],
        aiAnalyses: [analysis],
        humanReview: {
          reviewer: "verifier_001",
          role: "verifier",
          decision: "approve",
          rationale: "Approved after field and satellite consistency review.",
          reviewedAt: "2026-07-08T01:00:00.000Z",
        },
        governanceApprovals: [],
        monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
      }),
    /Governance approval is required/,
  );
});

test("Environmental Proof Record is issued as a bounded non-financial proof record", () => {
  const proof = evidence({ verification_status: "accepted", reviewers: ["verifier_001"], confidence_score: 91 });
  const analysis = buildCanopyAiAnalysis({ evidence: proof });
  const record = issueEnvironmentalProofRecord({
    projectId: proof.projectId,
    evidence: [proof],
    aiAnalyses: [analysis],
    humanReview: {
      reviewer: "verifier_001",
      role: "verifier",
      decision: "approve",
      rationale: "Approved after field review and advisory AI consistency checks.",
      reviewedAt: "2026-07-08T01:00:00.000Z",
    },
    governanceApprovals: ["ngo_board_approval_001"],
    monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
    issuedAt: "2026-07-08T02:00:00.000Z",
  });

  assert.equal(record.recordType, "environmental_proof_record");
  assert.equal(record.status, "issued");
  assert.ok(record.evidenceRoot.length >= 64);
  assert.ok(record.recordHash.length >= 64);
  assert.equal(record.claimBoundary.notCarbonCredit, true);
  assert.equal(record.claimBoundary.notFinancialAsset, true);
  assert.equal(record.claimBoundary.notTaxOffset, true);
  assert.equal(record.claimBoundary.notGuaranteedYield, true);
  assert.equal(record.claimBoundary.notAutomaticCanopyDistribution, true);
  assert.match(record.claimBoundary.disclosure, /not a certified carbon credit/);
  assert.match(record.claimBoundary.disclosure, /not.*financial asset/);
  assert.match(record.claimBoundary.disclosure, /carbon-tax offset/);
  assert.match(record.claimBoundary.disclosure, /guaranteed yield/);
});

test("Critical AI findings must be explicitly resolved before proof issuance", () => {
  const proof = evidence({ verification_status: "accepted", reviewers: ["verifier_001"] });
  const analysis = buildCanopyAiAnalysis({
    evidence: proof,
    knownMediaHashes: [proof.media_hash],
  });

  assert.throws(
    () =>
      issueEnvironmentalProofRecord({
        projectId: proof.projectId,
        evidence: [proof],
        aiAnalyses: [analysis],
        humanReview: {
          reviewer: "verifier_001",
          role: "verifier",
          decision: "approve",
          rationale: "Cannot approve unless the duplicate-media critical finding is resolved.",
          reviewedAt: "2026-07-08T01:00:00.000Z",
        },
        governanceApprovals: ["ngo_board_approval_001"],
        monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
      }),
    /Critical AI findings must be explicitly resolved/,
  );

  const record = issueEnvironmentalProofRecord({
    projectId: proof.projectId,
    evidence: [proof],
    aiAnalyses: [analysis],
    humanReview: {
      reviewer: "verifier_001",
      role: "verifier",
      decision: "approve",
      rationale: "Duplicate finding was resolved by field revisit and alternate media confirmation.",
      reviewedAt: "2026-07-08T01:00:00.000Z",
      acceptedFindingIds: analysis.findings.map((finding) => finding.id),
    },
    governanceApprovals: ["ngo_board_approval_001"],
    monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed"],
  });

  assert.equal(record.status, "issued");
});

test("Evidence upload mutation creates an append-only audit event", async () => {
  const repo = new InMemoryImpactRepository();
  const service = new EvidenceService(repo);
  const uploaded = await service.uploadEvidence({
    projectId: "project_v1_ggw_demo",
    treeClusterId: "cluster_v1_ggw_demo",
    kind: "photo",
    uri: "r2://dropin/evidence/canopyproof-os-photo.jpg",
    rawContent: "photo-bytes",
    submittedBy: "field_operator_001",
  });

  assert.ok(repo.auditLogs.some((log) => log.action === "evidence.upload" && log.entityId === uploaded.id));
});

test("Impact certificate disclosure preserves CanopyProof claim boundaries", () => {
  const repo = new InMemoryImpactRepository();
  const certificate = repo.certificates.get("cert_v1_ggw_demo");
  assert.ok(certificate);

  const disclosure = certificateDisclosure(certificate);

  assert.match(disclosure.claimBoundary, /not a certified carbon credit/);
  assert.match(disclosure.claimBoundary, /financial asset/);
  assert.match(disclosure.claimBoundary, /carbon-tax offset/);
  assert.match(disclosure.claimBoundary, /guaranteed yield/);
  assert.match(disclosure.claimBoundary, /automatic CANOPY distribution/);
});
