import assert from "node:assert/strict";
import test from "node:test";
import {
  CanopyProofEnvironmentalProofAuthorityService,
  type CanopyProofEnvironmentalProofAuthoritySources,
} from "../../services/api/src/domain/canopyproof/environmental-proof-authority.js";
import { CanopyProofEnvironmentalProofChallengeAuthorityService } from "../../services/api/src/domain/canopyproof/environmental-proof-challenge-authority.js";
import { CanopyProofEvidenceRegistryService } from "../../services/api/src/domain/canopyproof/evidence-registry.js";
import { CanopyProofEvidenceVerificationAuthorityService } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import { CanopyProofMethodologyGovernanceAuthorityService } from "../../services/api/src/domain/canopyproof/methodology-governance-authority.js";
import { CanopyProofMethodologyRegistryService } from "../../services/api/src/domain/canopyproof/methodology-registry.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";

const organizationId = "cp_org_environmental_proof_authority_001";
const projectId = "cp_project_environmental_proof_authority_001";
const evidenceId = "cp_evidence_environmental_proof_authority_001";

function hashFor(id: string, label: string) {
  const seed = `${id}:${label}`;
  return Buffer.from(seed.repeat(Math.ceil(64 / seed.length))).toString("hex").slice(0, 64).padEnd(64, "0");
}

function actor(
  id: string,
  participantType: "human" | "agent",
  role: "agent" | "owner" | "admin" | "verifier" | "researcher",
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    id,
    participantType,
    role,
    verificationStatus: "verified",
    organizationId,
    organizationVerificationStatus: "verified",
    participantRoot: hashFor(id, "participant"),
    organizationRoot: hashFor(organizationId, "organization"),
    ...(participantType === "human"
      ? {
          membershipId: `cp_membership_${id}`,
          membershipStatus: "active",
          membershipRoot: hashFor(id, "membership"),
        }
      : {}),
    accreditationScope: [],
    ...overrides,
  };
}

function accreditedVerifier(id: string, overrides: Readonly<Record<string, unknown>> = {}) {
  return actor(id, "human", "verifier", {
    accreditationId: `cp_accreditation_${id}`,
    accreditationStatus: "approved",
    accreditationRoot: hashFor(id, "accreditation"),
    accreditationScope: ["environmental evidence verification"],
    ...overrides,
  });
}

function buildFixture() {
  const projects = new CanopyProofProjectRegistryService();
  const projectRegistration = projects.registerProject(
    {
      id: projectId,
      organizationId,
      title: "Sahel Community Restoration Accountability Block",
      projectType: "reforestation",
      regionId: "region_ggw_sahel",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        areaHectares: 125.5,
        boundaryHash: hashFor(projectId, "boundary"),
      },
      targetTreeCount: 50_000,
      biodiversityIndicators: ["native species mix"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      monitoringCadenceDays: 60,
      governancePolicyId: "canopyproof_policy_project_activation_v1",
      createdAt: "2026-07-12T00:00:00.000Z",
    },
    "cp_project_owner_source_001",
    "owner",
  );
  projects.updateProjectStatus(
    projectId,
    {
      status: "under_review",
      rationale: "Independent institutional project review opened before activation authority.",
      updatedAt: "2026-07-12T00:01:00.000Z",
    },
    "cp_project_reviewer_source_001",
    "verifier",
  );
  const activeProject = projects.updateProjectStatus(
    projectId,
    {
      status: "active",
      governanceApprovalId: "cp_project_activation_approval_source_001",
      rationale: "Governance approval activated the bounded restoration accountability project.",
      updatedAt: "2026-07-12T00:02:00.000Z",
    },
    "cp_project_activation_source_001",
    "verifier",
  );

  const evidenceRegistry = new CanopyProofEvidenceRegistryService();
  const registration = evidenceRegistry.registerEvidence(
    {
      id: evidenceId,
      projectId,
      evidenceType: "tree_planting",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 12,
        regionId: activeProject.regionId,
      },
      timestamp: "2026-07-12T00:10:00.000Z",
      createdAt: "2026-07-12T00:11:00.000Z",
      media_hash: hashFor(evidenceId, "media"),
      gps_hash: hashFor(evidenceId, "gps"),
      confidence_score: 86,
    },
    activeProject,
    "cp_evidence_contributor_source_001",
    "community",
  ).evidence;

  const verification = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = verification.runValidation(
    evidenceId,
    {
      rulesetId: "canopyproof-evidence-validation-core",
      rulesetVersion: "1.0.0",
      executedAt: "2026-07-12T00:20:00.000Z",
    },
    actor("cp_validation_agent_source_001", "agent", "agent"),
  );
  const analysis = verification.recordAiAnalysis(
    evidenceId,
    {
      validationRunId: validation.id,
      modelProvider: "CanopyProof Research",
      modelName: "Canopy AI Advisory",
      modelVersion: "1.0.0",
      modelArtifactHash: hashFor(evidenceId, "model"),
      promptHash: hashFor(evidenceId, "prompt"),
      datasetSnapshotRoots: [hashFor(evidenceId, "dataset")],
      sourceEventRoots: [registration.audit_history[0]!.eventRoot, validation.auditEvent.eventRoot],
      executionEnvironment: "isolated-cpu-evaluation-v1",
      findings: [],
      confidenceScore: 82,
      analyzedAt: "2026-07-12T00:30:00.000Z",
    },
    actor("cp_analysis_agent_source_001", "agent", "agent"),
  );
  const review = verification.recordHumanReview(
    evidenceId,
    {
      validationRunId: validation.id,
      aiAnalysisIds: [analysis.id],
      decision: "approve",
      findingDispositions: [],
      rationale: "Independent accredited review approves bounded reliance on the immutable evidence chain.",
      limitations: ["Reliance remains limited to the registered environmental observation."],
      reviewedAt: "2026-07-12T00:40:00.000Z",
    },
    accreditedVerifier("cp_evidence_reviewer_source_001"),
  );
  const reliance = verification.getEvidenceReliance(evidenceId);
  const finalDecision = verification.recordFinalDecision(
    evidenceId,
    {
      decision: "verify",
      rationale: "Independent final verification binds the exact current evidence authority without creating a public claim.",
      limitations: ["This final decision is not an Environmental Proof Record or financial instrument."],
      sourceEventRoots: [
        ...new Set([
          registration.audit_history[0]!.eventRoot,
          validation.auditEvent.eventRoot,
          analysis.auditEvent.eventRoot,
          review.auditEvent.eventRoot,
          reliance.terminalEventRoot,
        ]),
      ],
      decidedAt: "2026-07-12T00:45:00.000Z",
    },
    accreditedVerifier("cp_final_verifier_source_001"),
  );

  const monitoring = projects.recordMonitoringEvent(
    projectId,
    {
      eventType: "survival_check",
      observedAt: "2026-07-12T01:00:00.000Z",
      evidenceIds: [evidenceId],
      terraSceneIds: ["cp_terra_scene_environmental_proof_001"],
      metrics: { survivalPercent: 88, soilMoisturePercent: 31 },
      state: "accepted",
      rationale: "Accepted post-verification monitoring binds field evidence, satellite context, and measured indicators.",
    },
    "cp_monitoring_observer_source_001",
    "researcher",
  );

  const methodologies = new CanopyProofMethodologyRegistryService();
  const methodology = methodologies.createMethodology(
    {
      id: "cp_methodology_environmental_proof_001",
      slug: "environmental-proof-field-satellite-monitoring",
      version: "v1.0.0",
      title: "Environmental Proof Field Satellite Monitoring Methodology",
      scope: "tree_planting",
      status: "draft",
      summary: "Bounded institutional methodology for verified field evidence and post-verification monitoring authority.",
      requiredDataSources: ["field_photo", "gps_trace", "satellite_scene", "sensor_reading", "governance_approval"],
      qualityGates: [
        "media_hash_required",
        "gps_hash_required",
        "duplicate_detection_required",
        "human_review_required",
        "governance_approval_required",
        "public_challenge_window_required",
        "monitoring_timeline_required",
      ],
      minimumGpsAccuracyMeters: 35,
      monitoringCadenceDays: 30,
      evidenceRetentionDays: 2_555,
      governanceApprovalIds: [],
      limitations: ["This methodology supports bounded environmental accountability and requires continuing monitoring."],
      createdAt: "2026-07-12T00:03:00.000Z",
    },
    "cp_methodology_author_source_001",
  );
  const methodologyGovernance = new CanopyProofMethodologyGovernanceAuthorityService([methodology]);
  const methodologyPolicy = methodologyGovernance.createPolicy(
    {
      subject: "methodology_publication",
      title: "Independent methodology publication authority",
      requiredApprovals: 2,
      allowedReviewerRoles: ["researcher", "verifier"],
      createdAt: "2026-07-12T00:04:30.000Z",
    },
    actor("cp_methodology_policy_creator_source_001", "human", "owner"),
  );
  const methodologyVerifierApproval = methodologyGovernance.approveMethodology(
    methodology.id,
    {
      decision: "approve",
      rationale: "Independent accredited verifier approves the exact bounded methodology technical version.",
      conflictDisclosure: "No financial, authorship, familial, employment, or operational conflict is known or undisclosed.",
      sourceEventRoots: [methodology.auditEvent.eventRoot, methodologyPolicy.auditEvent.eventRoot],
      decidedAt: "2026-07-12T00:05:00.000Z",
    },
    accreditedVerifier("cp_methodology_verifier_source_001"),
  );
  const methodologyResearchApproval = methodologyGovernance.approveMethodology(
    methodology.id,
    {
      decision: "approve",
      rationale: "Independent research reviewer approves publication after the accredited verifier authority.",
      conflictDisclosure: "No financial, authorship, familial, employment, or operational conflict is known or undisclosed.",
      sourceEventRoots: [
        methodology.auditEvent.eventRoot,
        methodologyPolicy.auditEvent.eventRoot,
        methodologyVerifierApproval.auditEvent.eventRoot,
      ],
      decidedAt: "2026-07-12T00:06:00.000Z",
    },
    actor("cp_methodology_researcher_source_001", "human", "researcher"),
  );
  methodologyGovernance.publishMethodology(
    methodology.id,
    {
      approvalIds: [methodologyVerifierApproval.id, methodologyResearchApproval.id],
      rationale: "Independent publisher records the complete methodology publication quorum and source graph.",
      limitations: ["Publication remains bounded to environmental accountability and continuing governance review."],
      sourceEventRoots: [
        methodology.auditEvent.eventRoot,
        methodologyPolicy.auditEvent.eventRoot,
        methodologyVerifierApproval.auditEvent.eventRoot,
        methodologyResearchApproval.auditEvent.eventRoot,
      ],
      publishedAt: "2026-07-12T00:07:00.000Z",
    },
    actor("cp_methodology_publisher_source_001", "human", "admin"),
  );
  const policy = methodologyGovernance.createPolicy(
    {
      subject: "environmental_proof_record",
      title: "Independent Environmental Proof Record issuance authority",
      requiredApprovals: 2,
      allowedReviewerRoles: ["admin", "owner", "verifier"],
      createdAt: "2026-07-12T00:08:00.000Z",
    },
    actor("cp_proof_policy_creator_source_001", "human", "owner"),
  );

  function sources(): CanopyProofEnvironmentalProofAuthoritySources {
    return {
      projects: {
        projects: [projectRegistration],
        statusTransitions: projects.listProjectStatusTransitions(projectId),
        monitoringEvents: projects.listMonitoringEvents({ projectId }),
      },
      evidenceVerification: verification.getAuthoritySnapshot(),
      methodologyGovernance: methodologyGovernance.getAuthoritySnapshot(),
    };
  }

  return {
    projects,
    registration,
    verification,
    validation,
    analysis,
    review,
    finalDecision,
    monitoring,
    methodology,
    methodologyGovernance,
    policy,
    sources,
  };
}

function deriveCandidate(
  service: CanopyProofEnvironmentalProofAuthorityService,
  fixture: ReturnType<typeof buildFixture>,
) {
  return service.deriveCandidate(
    {
      projectId,
      methodologyId: fixture.methodology.id,
      policyId: fixture.policy.id,
      evidenceIds: [evidenceId],
      monitoringEventIds: [fixture.monitoring.id],
      derivedAt: "2026-07-12T01:05:00.000Z",
    },
    actor("cp_candidate_researcher_001", "human", "researcher"),
    fixture.sources(),
  );
}

function approveCandidate(
  service: CanopyProofEnvironmentalProofAuthorityService,
  candidate: ReturnType<typeof deriveCandidate>,
) {
  const verifierInput = {
    decision: "approve",
    rationale: "Independent accredited verifier approves the exact bounded proof candidate authority.",
    conflictDisclosure: "No financial, operational, familial, or evidence-production conflict is known or undisclosed.",
    limitations: ["Approval applies only to this immutable candidate root."],
    sourceEventRoots: [candidate.auditEvent.eventRoot],
    decidedAt: "2026-07-12T01:10:00.000Z",
  } as const;
  const verifier = accreditedVerifier("cp_proof_candidate_verifier_001");
  const verifierApproval = service.approveCandidate(candidate.id, verifierInput, verifier);
  const ownerInput = {
    decision: "approve",
    rationale: "Independent organization owner approves issuance review for the exact candidate and prior verifier decision.",
    conflictDisclosure: "No financial, operational, familial, or evidence-production conflict is known or undisclosed.",
    limitations: ["Owner approval does not create a carbon, tax, token, funding, or financial entitlement."],
    sourceEventRoots: [candidate.auditEvent.eventRoot, verifierApproval.auditEvent.eventRoot],
    decidedAt: "2026-07-12T01:20:00.000Z",
  } as const;
  const owner = actor("cp_proof_candidate_owner_001", "human", "owner");
  const ownerApproval = service.approveCandidate(candidate.id, ownerInput, owner);
  return { verifierInput, verifier, verifierApproval, ownerInput, owner, ownerApproval };
}

function buildIssuedProof() {
  const fixture = buildFixture();
  const proof = new CanopyProofEnvironmentalProofAuthorityService();
  const candidate = deriveCandidate(proof, fixture);
  const approvals = approveCandidate(proof, candidate);
  const record = proof.issueRecord(
    candidate.id,
    {
      approvalIds: [approvals.ownerApproval.id, approvals.verifierApproval.id],
      rationale: "Independent issuer records a bounded Environmental Proof Record before challenge governance begins.",
      limitations: ["The immutable record remains subject to challenge, review, monitoring, and revocation."],
      sourceEventRoots: [
        candidate.auditEvent.eventRoot,
        approvals.verifierApproval.auditEvent.eventRoot,
        approvals.ownerApproval.auditEvent.eventRoot,
      ],
      issuedAt: "2026-07-12T01:30:00.000Z",
    },
    actor("cp_environmental_proof_challenge_source_issuer", "human", "admin"),
    fixture.sources(),
  );
  return { fixture, proof, candidate, approvals, record };
}

test("CanopyProof derives and replays an immutable current-verified Environmental Proof Record", () => {
  const fixture = buildFixture();
  const service = new CanopyProofEnvironmentalProofAuthorityService();
  const candidate = deriveCandidate(service, fixture);
  const candidateRetry = deriveCandidate(service, fixture);
  assert.equal(candidateRetry, candidate);
  assert.equal(candidate.projectStatus, "monitored");
  assert.deepEqual(candidate.evidenceFinalDecisionIds, [fixture.finalDecision.id]);
  assert.equal(candidate.evidenceFinalDecisionRoots[0], fixture.finalDecision.decisionRoot);
  assert.ok(candidate.sourceActorIds.includes(fixture.registration.contributor));
  assert.ok(candidate.sourceActorIds.includes(fixture.methodology.createdBy));
  assert.equal(candidate.safety.currentFinalEvidenceOnly, true);

  const approvals = approveCandidate(service, candidate);
  assert.equal(service.approveCandidate(candidate.id, approvals.verifierInput, approvals.verifier), approvals.verifierApproval);
  assert.equal(service.approveCandidate(candidate.id, approvals.ownerInput, approvals.owner), approvals.ownerApproval);

  const recordInput = {
    approvalIds: [approvals.ownerApproval.id, approvals.verifierApproval.id],
    rationale: "Independent issuer records bounded environmental accountability over the exact approved authority graph.",
    limitations: ["The record requires continuing monitoring and does not convey title, credit, tax, token, or yield rights."],
    sourceEventRoots: [
      candidate.auditEvent.eventRoot,
      approvals.verifierApproval.auditEvent.eventRoot,
      approvals.ownerApproval.auditEvent.eventRoot,
    ],
    issuedAt: "2026-07-12T01:30:00.000Z",
  } as const;
  const issuer = actor("cp_environmental_proof_issuer_001", "human", "admin");
  const record = service.issueRecord(candidate.id, recordInput, issuer, fixture.sources());
  assert.equal(service.issueRecord(candidate.id, recordInput, issuer, fixture.sources()), record);
  assert.equal(record.status, "issued");
  assert.equal(record.claimBoundary.notCertifiedCarbonCredit, true);
  assert.equal(record.claimBoundary.notCarbonTaxOffset, true);
  assert.equal(record.claimBoundary.notGuaranteedYield, true);
  assert.equal(service.projectRecordStatus(record.id, fixture.sources()).state, "issued");

  const replayed = CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getRecord(record.id), record);
  assert.deepEqual(replayed.getCandidateByRoot(candidate.candidateRoot), candidate);
});

test("CanopyProof rejects role substitution, self-approval, incomplete quorum, and unsafe claims", () => {
  const fixture = buildFixture();
  const service = new CanopyProofEnvironmentalProofAuthorityService();
  const candidate = deriveCandidate(service, fixture);
  const baseApproval = {
    decision: "approve",
    rationale: "Independent reviewer evaluates the complete immutable proof candidate authority graph.",
    conflictDisclosure: "No financial, operational, familial, or evidence-production conflict is known or undisclosed.",
    limitations: ["Approval remains bounded to this candidate."],
    sourceEventRoots: [candidate.auditEvent.eventRoot],
    decidedAt: "2026-07-12T01:10:00.000Z",
  } as const;

  assert.throws(
    () => service.approveCandidate(candidate.id, baseApproval, actor("cp_proof_agent_denied", "agent", "agent")),
    /active human organization authority/,
  );
  assert.throws(
    () => service.approveCandidate(candidate.id, baseApproval, accreditedVerifier(fixture.finalDecision.verifier.id)),
    /independent human approver/,
  );
  assert.throws(
    () => service.approveCandidate(candidate.id, baseApproval, actor(candidate.derivedBy.id, "human", "researcher")),
    /active human organization authority|policy does not authorize|independent human approver/,
  );
  assert.throws(
    () =>
      service.approveCandidate(
        candidate.id,
        { ...baseApproval, rationale: "This approval promises guaranteed RWA yield from the proof record." },
        accreditedVerifier("cp_unsafe_proof_verifier_001"),
      ),
    /unsafe claim/,
  );

  const verifierApproval = service.approveCandidate(
    candidate.id,
    baseApproval,
    accreditedVerifier("cp_single_proof_verifier_001"),
  );
  assert.throws(
    () =>
      service.issueRecord(
        candidate.id,
        {
          approvalIds: [verifierApproval.id, "cp_missing_second_approval"],
          rationale: "Issuance cannot proceed without the complete independent two-person governance quorum.",
          sourceEventRoots: [candidate.auditEvent.eventRoot, verifierApproval.auditEvent.eventRoot],
          issuedAt: "2026-07-12T01:30:00.000Z",
        },
        actor("cp_incomplete_quorum_issuer", "human", "admin"),
        fixture.sources(),
      ),
    /complete candidate approval set/,
  );
});

test("CanopyProof marks an issued record stale after later source authority without rewriting history", () => {
  const fixture = buildFixture();
  const service = new CanopyProofEnvironmentalProofAuthorityService();
  const candidate = deriveCandidate(service, fixture);
  const approvals = approveCandidate(service, candidate);
  const recordInput = {
    approvalIds: [approvals.verifierApproval.id, approvals.ownerApproval.id],
    rationale: "Independent issuer records the bounded approved authority before later monitoring facts arrive.",
    limitations: ["Subsequent project or evidence authority can make this immutable record stale."],
    sourceEventRoots: [
      candidate.auditEvent.eventRoot,
      approvals.verifierApproval.auditEvent.eventRoot,
      approvals.ownerApproval.auditEvent.eventRoot,
    ],
    issuedAt: "2026-07-12T01:30:00.000Z",
  } as const;
  const issuer = actor("cp_environmental_proof_staleness_issuer", "human", "admin");
  const record = service.issueRecord(candidate.id, recordInput, issuer, fixture.sources());

  fixture.projects.recordMonitoringEvent(
    projectId,
    {
      eventType: "survival_check",
      observedAt: "2026-07-12T02:00:00.000Z",
      evidenceIds: [evidenceId],
      terraSceneIds: ["cp_terra_scene_environmental_proof_002"],
      metrics: { survivalPercent: 87 },
      state: "accepted",
      rationale: "A later accepted monitoring fact advances project authority without rewriting the issued record.",
    },
    "cp_later_monitoring_observer_source_001",
    "researcher",
  );
  const projection = service.projectRecordStatus(record.id, fixture.sources());
  assert.equal(projection.state, "stale");
  assert.equal(projection.sourceAuthorityCurrent, false);
  assert.equal(service.getRecord(record.id), record);
  assert.equal(service.issueRecord(candidate.id, recordInput, issuer, fixture.sources()), record);
});

test("CanopyProof snapshot replay rejects candidate, approval, and record tampering", () => {
  const fixture = buildFixture();
  const service = new CanopyProofEnvironmentalProofAuthorityService();
  const candidate = deriveCandidate(service, fixture);
  const approvals = approveCandidate(service, candidate);
  const record = service.issueRecord(
    candidate.id,
    {
      approvalIds: [approvals.verifierApproval.id, approvals.ownerApproval.id],
      rationale: "Independent issuer creates a replayable bounded record for adversarial snapshot validation.",
      limitations: ["Snapshot replay must reject every post-commit mutation."],
      sourceEventRoots: [
        candidate.auditEvent.eventRoot,
        approvals.verifierApproval.auditEvent.eventRoot,
        approvals.ownerApproval.auditEvent.eventRoot,
      ],
      issuedAt: "2026-07-12T01:30:00.000Z",
    },
    actor("cp_environmental_proof_replay_issuer", "human", "admin"),
    fixture.sources(),
  );
  const snapshot = service.getAuthoritySnapshot();

  assert.throws(
    () =>
      CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        candidates: [{ ...candidate, confidenceScore: 99 }],
      }),
    /candidate.*invalid|lineage is invalid/i,
  );
  assert.throws(
    () =>
      CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        approvals: [{ ...approvals.verifierApproval, rationale: "Tampered approval rationale." }, approvals.ownerApproval],
      }),
    /canonical command hash|approval lineage is invalid/i,
  );
  assert.throws(
    () =>
      CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        records: [{ ...record, confidenceScore: 99 }],
      }),
    /record lineage is invalid/i,
  );
  assert.throws(
    () =>
      CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot({
        candidates: snapshot.candidates,
        approvals: [approvals.ownerApproval],
        records: snapshot.records,
      }),
    /not found|previous approval|sequence|predecessor|approval lineage|missing or foreign/i,
  );
});

test("CanopyProof Environmental Proof challenge emits risk, independent reviews, revocation, and replay", () => {
  const issued = buildIssuedProof();
  const service = new CanopyProofEnvironmentalProofChallengeAuthorityService(issued.proof.getAuthoritySnapshot());
  const challenger = actor("cp_external_environmental_proof_challenger", "human", "researcher", {
    organizationId: "cp_external_environmental_observatory",
    organizationRoot: hashFor("cp_external_environmental_observatory", "organization"),
    membershipId: "cp_membership_external_environmental_proof_challenger",
    membershipRoot: hashFor("cp_external_environmental_proof_challenger", "external-membership"),
  });
  const challengeInput = {
    reason: "monitoring_contradiction",
    severity: "high",
    rationale: "Independent external observation contradicts the monitoring basis and requires governed review.",
    supportingArtifactHashes: [hashFor(issued.record.id, "challenge-artifact")],
    sourceEventRoots: [issued.record.auditEvent.eventRoot],
    openedAt: "2026-07-12T01:40:00.000Z",
  } as const;
  const bundle = service.openChallenge(issued.record.id, challengeInput, challenger, issued.fixture.sources());
  assert.deepEqual(
    service.openChallenge(issued.record.id, challengeInput, challenger, issued.fixture.sources()),
    bundle,
  );
  assert.equal(bundle.riskSignal.challengeRoot, bundle.challenge.challengeRoot);
  assert.equal(bundle.riskSignal.riskLevel, "high");
  assert.equal(service.projectChallenge(bundle.challenge.id).state, "open");
  assert.equal(service.projectRecordStatus(issued.record.id, issued.fixture.sources()).state, "challenged");

  const verifierInput = {
    decision: "uphold",
    rationale: "Independent accredited verifier confirms that the contradiction materially invalidates current reliance.",
    conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
    limitations: ["The review concerns only this immutable Environmental Proof Record."],
    sourceEventRoots: [bundle.challenge.auditEvent.eventRoot, bundle.riskSignal.auditEvent.eventRoot],
    reviewedAt: "2026-07-12T01:50:00.000Z",
  } as const;
  const verifier = accreditedVerifier("cp_environmental_proof_challenge_verifier");
  const verifierReview = service.reviewChallenge(bundle.challenge.id, verifierInput, verifier);
  assert.equal(service.reviewChallenge(bundle.challenge.id, verifierInput, verifier), verifierReview);
  assert.equal(service.projectChallenge(bundle.challenge.id).state, "under_review");

  const ownerInput = {
    decision: "uphold",
    rationale: "Independent organization owner concurs after reviewing the exact challenge and risk authority roots.",
    conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
    limitations: ["The governance review creates no payment, credit, tax, token, title, or yield entitlement."],
    sourceEventRoots: [
      bundle.challenge.auditEvent.eventRoot,
      bundle.riskSignal.auditEvent.eventRoot,
      verifierReview.auditEvent.eventRoot,
    ],
    reviewedAt: "2026-07-12T02:00:00.000Z",
  } as const;
  const ownerReview = service.reviewChallenge(
    bundle.challenge.id,
    ownerInput,
    actor("cp_environmental_proof_challenge_owner", "human", "owner"),
  );
  const resolutionInput = {
    reviewIds: [ownerReview.id, verifierReview.id],
    decision: "uphold",
    rationale: "Independent resolver records the complete unanimous governance quorum and revokes current reliance.",
    limitations: ["Revocation preserves the original record and every challenge fact for public accountability."],
    sourceEventRoots: [
      bundle.challenge.auditEvent.eventRoot,
      bundle.riskSignal.auditEvent.eventRoot,
      verifierReview.auditEvent.eventRoot,
      ownerReview.auditEvent.eventRoot,
    ],
    resolvedAt: "2026-07-12T02:10:00.000Z",
  } as const;
  const resolver = actor("cp_environmental_proof_challenge_resolver", "human", "admin");
  const resolution = service.resolveChallenge(bundle.challenge.id, resolutionInput, resolver);
  assert.equal(service.resolveChallenge(bundle.challenge.id, resolutionInput, resolver), resolution);
  assert.equal(service.projectChallenge(bundle.challenge.id).state, "resolved");
  assert.equal(service.projectRecordStatus(issued.record.id, issued.fixture.sources()).state, "revoked");
  assert.equal(issued.proof.getRecord(issued.record.id), issued.record);

  const replayed = CanopyProofEnvironmentalProofChallengeAuthorityService.fromAuthoritySnapshot(
    issued.proof.getAuthoritySnapshot(),
    service.getAuthoritySnapshot(),
  );
  assert.deepEqual(replayed.getChallengeBundle(bundle.challenge.id), bundle);
  assert.deepEqual(replayed.getResolution(resolution.id), resolution);
  assert.equal(replayed.projectRecordStatus(issued.record.id, issued.fixture.sources()).state, "revoked");
});

test("CanopyProof Environmental Proof rejected challenge restores independent source projection", () => {
  const issued = buildIssuedProof();
  const service = new CanopyProofEnvironmentalProofChallengeAuthorityService(issued.proof.getAuthoritySnapshot());
  const bundle = service.openChallenge(
    issued.record.id,
    {
      reason: "external_observation",
      severity: "medium",
      rationale: "A bounded external observation requires independent review without presuming that the record is invalid.",
      supportingArtifactHashes: [hashFor(issued.record.id, "rejected-challenge-artifact")],
      sourceEventRoots: [issued.record.auditEvent.eventRoot],
      openedAt: "2026-07-12T01:40:00.000Z",
    },
    actor("cp_environmental_proof_rejected_challenger", "human", "researcher"),
    issued.fixture.sources(),
  );
  const verifierReview = service.reviewChallenge(
    bundle.challenge.id,
    {
      decision: "reject",
      rationale: "Independent accredited review finds the submitted artifact insufficient to contradict the record authority.",
      conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
      sourceEventRoots: [bundle.challenge.auditEvent.eventRoot, bundle.riskSignal.auditEvent.eventRoot],
      reviewedAt: "2026-07-12T01:50:00.000Z",
    },
    accreditedVerifier("cp_environmental_proof_rejected_challenge_verifier"),
  );
  const adminReview = service.reviewChallenge(
    bundle.challenge.id,
    {
      decision: "reject",
      rationale: "Independent administrator concurs that the challenge evidence does not meet the governed contradiction threshold.",
      conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
      sourceEventRoots: [
        bundle.challenge.auditEvent.eventRoot,
        bundle.riskSignal.auditEvent.eventRoot,
        verifierReview.auditEvent.eventRoot,
      ],
      reviewedAt: "2026-07-12T02:00:00.000Z",
    },
    actor("cp_environmental_proof_rejected_challenge_admin", "human", "admin"),
  );
  service.resolveChallenge(
    bundle.challenge.id,
    {
      reviewIds: [verifierReview.id, adminReview.id],
      decision: "reject",
      rationale: "Independent resolver rejects the challenge after the complete unanimous human governance review.",
      sourceEventRoots: [
        bundle.challenge.auditEvent.eventRoot,
        bundle.riskSignal.auditEvent.eventRoot,
        verifierReview.auditEvent.eventRoot,
        adminReview.auditEvent.eventRoot,
      ],
      resolvedAt: "2026-07-12T02:10:00.000Z",
    },
    actor("cp_environmental_proof_rejected_challenge_resolver", "human", "owner"),
  );
  assert.equal(service.projectChallenge(bundle.challenge.id).state, "rejected");
  assert.equal(service.projectRecordStatus(issued.record.id, issued.fixture.sources()).state, "issued");
});

test("CanopyProof Environmental Proof challenge rejects AI, conflicts, mixed quorum, unsafe text, and tampering", () => {
  const issued = buildIssuedProof();
  const service = new CanopyProofEnvironmentalProofChallengeAuthorityService(issued.proof.getAuthoritySnapshot());
  const challengeInput = {
    reason: "evidence_integrity",
    severity: "critical",
    rationale: "A content-addressed integrity concern requires immediate independent governance review.",
    supportingArtifactHashes: [hashFor(issued.record.id, "integrity-artifact")],
    sourceEventRoots: [issued.record.auditEvent.eventRoot],
    openedAt: "2026-07-12T01:40:00.000Z",
  } as const;
  assert.throws(
    () => service.openChallenge(issued.record.id, challengeInput, actor("cp_challenge_agent", "agent", "agent"), issued.fixture.sources()),
    /active human organization authority/,
  );
  assert.throws(
    () =>
      service.openChallenge(
        issued.record.id,
        { ...challengeInput, rationale: "This challenge contains an API secret and must fail closed." },
        actor("cp_unsafe_challenger", "human", "researcher"),
        issued.fixture.sources(),
      ),
    /unsafe claim or secret/,
  );
  const bundle = service.openChallenge(
    issued.record.id,
    challengeInput,
    actor("cp_environmental_proof_integrity_challenger", "human", "researcher"),
    issued.fixture.sources(),
  );
  assert.throws(
    () =>
      service.reviewChallenge(
        bundle.challenge.id,
        {
          decision: "uphold",
          rationale: "The original record issuer cannot review the challenge against their own issuance authority.",
          conflictDisclosure: "The actor is explicitly the original issuer and is therefore conflicted.",
          sourceEventRoots: [bundle.challenge.auditEvent.eventRoot, bundle.riskSignal.auditEvent.eventRoot],
          reviewedAt: "2026-07-12T01:50:00.000Z",
        },
        issued.record.issuer,
      ),
    /independent human reviewer/,
  );
  const verifierReview = service.reviewChallenge(
    bundle.challenge.id,
    {
      decision: "uphold",
      rationale: "Independent accredited verifier finds the integrity concern material and sufficiently supported.",
      conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
      sourceEventRoots: [bundle.challenge.auditEvent.eventRoot, bundle.riskSignal.auditEvent.eventRoot],
      reviewedAt: "2026-07-12T01:50:00.000Z",
    },
    accreditedVerifier("cp_environmental_proof_integrity_verifier"),
  );
  const adminReview = service.reviewChallenge(
    bundle.challenge.id,
    {
      decision: "reject",
      rationale: "Independent administrator records a conflicting review that must block terminal resolution.",
      conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
      sourceEventRoots: [
        bundle.challenge.auditEvent.eventRoot,
        bundle.riskSignal.auditEvent.eventRoot,
        verifierReview.auditEvent.eventRoot,
      ],
      reviewedAt: "2026-07-12T02:00:00.000Z",
    },
    actor("cp_environmental_proof_integrity_admin", "human", "admin"),
  );
  assert.throws(
    () =>
      service.resolveChallenge(
        bundle.challenge.id,
        {
          reviewIds: [verifierReview.id, adminReview.id],
          decision: "uphold",
          rationale: "Mixed review decisions must never be collapsed into a terminal challenge resolution.",
          sourceEventRoots: [
            bundle.challenge.auditEvent.eventRoot,
            bundle.riskSignal.auditEvent.eventRoot,
            verifierReview.auditEvent.eventRoot,
            adminReview.auditEvent.eventRoot,
          ],
          resolvedAt: "2026-07-12T02:10:00.000Z",
        },
        actor("cp_environmental_proof_integrity_resolver", "human", "owner"),
      ),
    /quorum is incomplete, mixed, or non-terminal/,
  );

  const snapshot = service.getAuthoritySnapshot();
  assert.throws(
    () =>
      CanopyProofEnvironmentalProofChallengeAuthorityService.fromAuthoritySnapshot(
        issued.proof.getAuthoritySnapshot(),
        {
          ...snapshot,
          riskSignals: snapshot.riskSignals.map((risk) => ({ ...risk, riskLevel: "low" as const })),
        },
      ),
    /challenge risk.*lineage is invalid/i,
  );
});
