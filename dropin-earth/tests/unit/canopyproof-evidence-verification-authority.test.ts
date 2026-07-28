import assert from "node:assert/strict";
import test from "node:test";
import { CanopyProofEvidenceRegistryService } from "../../services/api/src/domain/canopyproof/evidence-registry.js";
import {
  CanopyProofEvidenceVerificationAuthorityService,
  type CanopyProofAdvisoryAiAnalysis,
  type CanopyProofEvidenceValidationRun,
} from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";

const organizationId = "cp_org_verification_authority_001";
const project = {
  id: "cp_project_verification_authority_001",
  organizationId,
  regionId: "region_ggw_sahel",
  status: "active" as const,
  projectRoot: "1".repeat(64),
  updatedAt: "2026-07-12T00:00:00.000Z",
};

function buildRegistration(
  id = "cp_evidence_verification_authority_001",
  overrides: Readonly<Record<string, unknown>> = {},
  projectOverrides: Readonly<Record<string, unknown>> = {},
) {
  const registry = new CanopyProofEvidenceRegistryService();
  return registry.registerEvidence(
    {
      id,
      projectId: project.id,
      evidenceType: "tree_planting",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 12,
        regionId: project.regionId,
      },
      timestamp: "2026-07-12T00:10:00.000Z",
      createdAt: "2026-07-12T00:11:00.000Z",
      media_hash: hashFor(id, "media"),
      gps_hash: hashFor(id, "gps"),
      confidence_score: 84,
      ...overrides,
    },
    { ...project, ...projectOverrides },
    "cp_contributor_verification_authority_001",
    "community",
  ).evidence;
}

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
    organizationRoot: "2".repeat(64),
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

function accreditedVerifier(
  id = "cp_verifier_verification_authority_001",
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return actor(id, "human", "verifier", {
    accreditationId: `cp_accreditation_${id}`,
    accreditationStatus: "approved",
    accreditationRoot: hashFor(id, "accreditation"),
    accreditationScope: ["field evidence verification"],
    ...overrides,
  });
}

function runValidation(
  service: CanopyProofEvidenceVerificationAuthorityService,
  evidenceId: string,
  executedAt = "2026-07-12T00:20:00.000Z",
) {
  return service.runValidation(
    evidenceId,
    {
      rulesetId: "canopyproof-evidence-validation-core",
      rulesetVersion: "1.0.0",
      executedAt,
    },
    actor("cp_validation_agent_001", "agent", "agent"),
  );
}

function aiInput(
  registrationEventRoot: string,
  validation: CanopyProofEvidenceValidationRun,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    validationRunId: validation.id,
    modelProvider: "CanopyProof Research",
    modelName: "Canopy AI Advisory",
    modelVersion: "1.0.0",
    modelArtifactHash: "3".repeat(64),
    promptHash: "4".repeat(64),
    datasetSnapshotRoots: ["5".repeat(64)],
    sourceEventRoots: [registrationEventRoot, validation.auditEvent.eventRoot],
    executionEnvironment: "isolated-cpu-evaluation-v1",
    findings: [],
    confidenceScore: 81,
    analyzedAt: "2026-07-12T00:30:00.000Z",
    ...overrides,
  };
}

function recordAnalysis(
  service: CanopyProofEvidenceVerificationAuthorityService,
  evidenceId: string,
  registrationEventRoot: string,
  validation: CanopyProofEvidenceValidationRun,
  overrides: Readonly<Record<string, unknown>> = {},
  agentOverrides: Readonly<Record<string, unknown>> = {},
) {
  return service.recordAiAnalysis(
    evidenceId,
    aiInput(registrationEventRoot, validation, overrides),
    actor("cp_ai_agent_001", "agent", "agent", agentOverrides),
  );
}

function reviewInput(
  validation: CanopyProofEvidenceValidationRun,
  analyses: readonly CanopyProofAdvisoryAiAnalysis[],
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    validationRunId: validation.id,
    aiAnalysisIds: analyses.map((analysis) => analysis.id),
    decision: "approve",
    findingDispositions: [],
    rationale: "Independent accredited review confirms bounded reliance on this evidence registration.",
    limitations: ["Reliance remains limited to the immutable evidence registration."],
    reviewedAt: "2026-07-12T00:40:00.000Z",
    ...overrides,
  };
}

function approveEvidence(
  service: CanopyProofEvidenceVerificationAuthorityService,
  registration: ReturnType<typeof buildRegistration>,
  suffix: string,
  times: Readonly<{ validation?: string; analysis?: string; review?: string }> = {},
) {
  const validation = runValidation(
    service,
    registration.id,
    times.validation ?? "2026-07-12T00:20:00.000Z",
  );
  const analysis = recordAnalysis(
    service,
    registration.id,
    registration.audit_history[0].eventRoot,
    validation,
    {
      analyzedAt: times.analysis ?? "2026-07-12T00:30:00.000Z",
      modelVersion: `1.0.${suffix.length}`,
    },
    { id: `cp_ai_agent_${suffix}`, participantRoot: hashFor(suffix, "ai-participant") },
  );
  const review = service.recordHumanReview(
    registration.id,
    reviewInput(validation, [analysis], {
      reviewedAt: times.review ?? "2026-07-12T00:40:00.000Z",
    }),
    accreditedVerifier(`cp_verifier_${suffix}`),
  );
  return { validation, analysis, review };
}

function openEvidenceChallenge(
  service: CanopyProofEvidenceVerificationAuthorityService,
  registration: ReturnType<typeof buildRegistration>,
  challengerId = "cp_challenger_external_001",
  overrides: Readonly<Record<string, unknown>> = {},
  actorOverrides: Readonly<Record<string, unknown>> = {},
) {
  const reliance = service.getEvidenceReliance(registration.id);
  return service.openChallenge(
    registration.id,
    {
      reason: "satellite_contradiction",
      severity: "high",
      rationale: "Independent satellite commitments contradict the bounded field-evidence reliance projection.",
      supportingArtifactHashes: [hashFor(registration.id, "challenge-artifact")],
      evidenceEventRoots: [...new Set([registration.audit_history[0].eventRoot, reliance.terminalEventRoot])],
      challengedAt: "2026-07-12T00:50:00.000Z",
      ...overrides,
    },
    actor(challengerId, "human", "researcher", {
      organizationId: "cp_org_external_challenger_001",
      organizationRoot: "8".repeat(64),
      ...actorOverrides,
    }),
  );
}

function resolveEvidenceChallenge(
  service: CanopyProofEvidenceVerificationAuthorityService,
  challengeId: string,
  reviewerId: string,
  decision: "upheld" | "dismissed" | "needs_more_evidence",
  reviewedAt: string,
) {
  const challenge = service.getChallenge(challengeId);
  const previous = service.listChallengeResolutions(challengeId).at(-1);
  return service.resolveChallenge(
    challengeId,
    {
      decision,
      rationale: `Independent review records ${decision} after examining every committed challenge source and limitation.`,
      limitations: ["The decision governs bounded reliance on this evidence registration only."],
      evidenceEventRoots: [challenge.auditEvent.eventRoot, ...(previous ? [previous.auditEvent.eventRoot] : [])],
      reviewedAt,
    },
    decision === "needs_more_evidence"
      ? actor(reviewerId, "human", "researcher")
      : accreditedVerifier(reviewerId),
  );
}

function finalDecisionInput(
  service: CanopyProofEvidenceVerificationAuthorityService,
  registration: ReturnType<typeof buildRegistration>,
  decision: "verify" | "reject" | "request_changes" = "verify",
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const reliance = service.getEvidenceReliance(registration.id);
  const snapshot = service.getAuthoritySnapshot();
  const validation = snapshot.validationRuns.find((item) => item.id === reliance.latestValidationRunId);
  const review = snapshot.humanReviews.find((item) => item.id === reliance.latestHumanReviewId);
  const analyses = snapshot.aiAnalyses.filter((item) => reliance.currentAiAnalysisIds.includes(item.id));
  if (!validation || !review || analyses.length === 0) {
    throw new Error("Test fixture requires current validation, AI analysis, and human review authority.");
  }
  return {
    decision,
    rationale: `Independent final verifier records ${decision} over the exact current bounded evidence authority chain.`,
    limitations: ["This internal decision is not an environmental proof record or financial claim."],
    sourceEventRoots: [
      ...new Set([
        registration.audit_history[0].eventRoot,
        validation.auditEvent.eventRoot,
        ...analyses.map((analysis) => analysis.auditEvent.eventRoot),
        review.auditEvent.eventRoot,
        reliance.terminalEventRoot,
      ]),
    ],
    decidedAt: "2026-07-12T00:45:00.000Z",
    ...overrides,
  };
}

test("CanopyProof verification authority appends deterministic validation without mutating evidence", () => {
  const registration = buildRegistration();
  const original = structuredClone(registration);
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const first = runValidation(service, registration.id);
  const retry = runValidation(service, registration.id);

  assert.equal(first, retry);
  assert.equal(first.outcome, "pass");
  assert.equal(first.evidenceSequence, 2);
  assert.equal(first.previousEventRoot, registration.audit_history[0].eventRoot);
  assert.match(first.commandHash, /^[a-f0-9]{64}$/);
  assert.match(first.validationRoot, /^[a-f0-9]{64}$/);
  assert.equal(first.auditEvent.entityType, "validation_run");
  assert.deepEqual(registration, original);
  assert.equal(service.listValidationRuns(registration.id).length, 1);
  assert.equal(service.getEvidenceReliance(registration.id).state, "validation_passed");
});

test("CanopyProof validation outcomes are derived from immutable registration and project boundaries", () => {
  const challenged = buildRegistration("cp_evidence_verification_challenged", {
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 240,
      regionId: "region_outside_project",
    },
    confidence_score: 18,
  });
  const suspended = buildRegistration(
    "cp_evidence_verification_suspended",
    {},
    { status: "suspended" as const },
  );
  const challengedService = new CanopyProofEvidenceVerificationAuthorityService([challenged]);
  const suspendedService = new CanopyProofEvidenceVerificationAuthorityService([suspended]);

  const needsReview = runValidation(challengedService, challenged.id);
  const blocked = runValidation(suspendedService, suspended.id);
  assert.equal(needsReview.outcome, "needs_review");
  assert.ok(needsReview.issues.includes("structural_registration"));
  assert.ok(needsReview.issues.includes("location_accuracy"));
  assert.equal(blocked.outcome, "blocked");
  assert.ok(blocked.issues.includes("project_status_eligible"));
  assert.equal(suspendedService.getEvidenceReliance(suspended.id).state, "blocked");

  assert.throws(
    () =>
      challengedService.runValidation(
        challenged.id,
        {
          rulesetId: "canopyproof-evidence-validation-core",
          rulesetVersion: "1.0.0",
          executedAt: "2026-07-12T00:21:00.000Z",
          outcome: "pass",
        },
        actor("cp_validation_agent_002", "agent", "agent"),
      ),
    /unrecognized key|Unrecognized key/i,
  );
});

test("CanopyProof AI facts require verified agent identity and complete prior-root provenance", () => {
  const registration = buildRegistration("cp_evidence_verification_ai_authority");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = runValidation(service, registration.id);
  const registrationRoot = registration.audit_history[0].eventRoot;

  assert.throws(
    () =>
      service.recordAiAnalysis(
        registration.id,
        aiInput(registrationRoot, validation),
        actor("cp_human_claiming_ai", "human", "agent"),
      ),
    /requires a verified agent/,
  );
  assert.throws(
    () =>
      service.recordAiAnalysis(
        registration.id,
        aiInput(registrationRoot, validation, { sourceEventRoots: [registrationRoot, "9".repeat(64)] }),
        actor("cp_ai_agent_missing_source", "agent", "agent"),
      ),
    /not a prior semantic event/,
  );

  const critical = recordAnalysis(service, registration.id, registrationRoot, validation, {
    findings: [
      {
        capability: "fraud detection",
        severity: "critical",
        code: "source_commitment_conflict",
        message: "The source commitments conflict and require accountable human resolution.",
        recommendedAction: "CHALLENGE",
        sourceEventRoots: [registrationRoot, validation.auditEvent.eventRoot],
      },
    ],
  });
  const retry = recordAnalysis(service, registration.id, registrationRoot, validation, {
    findings: [
      {
        capability: "fraud detection",
        severity: "critical",
        code: "source_commitment_conflict",
        message: "The source commitments conflict and require accountable human resolution.",
        recommendedAction: "CHALLENGE",
        sourceEventRoots: [registrationRoot, validation.auditEvent.eventRoot],
      },
    ],
  });
  assert.equal(retry, critical);
  assert.equal(critical.advisoryOnly, true);
  assert.equal(critical.recommendation, "rejected");
  assert.deepEqual(critical.capabilities, ["fraud detection"]);
  assert.equal(critical.evidenceSequence, 3);
  assert.equal(service.listAiAnalyses(registration.id).length, 1);
  assert.equal(service.getEvidenceReliance(registration.id).state, "ai_advised");
});

test("CanopyProof human approval enforces independence, membership, verifier role, and accreditation", () => {
  const registration = buildRegistration("cp_evidence_verification_human_authority");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = runValidation(service, registration.id);
  const analysis = recordAnalysis(
    service,
    registration.id,
    registration.audit_history[0].eventRoot,
    validation,
  );
  const input = reviewInput(validation, [analysis]);

  assert.throws(
    () => service.recordHumanReview(registration.id, input, accreditedVerifier(registration.contributor)),
    /contributor cannot independently review/,
  );
  assert.throws(
    () => service.recordHumanReview(registration.id, input, actor("cp_researcher_001", "human", "researcher")),
    /exact verifier role/,
  );
  assert.throws(
    () => service.recordHumanReview(registration.id, input, actor("cp_agent_reviewer_001", "agent", "agent")),
    /verified human verifier or researcher/,
  );
  assert.throws(
    () => service.recordHumanReview(registration.id, input, actor("cp_verifier_unaccredited", "human", "verifier")),
    /current approved accreditation/,
  );
  assert.throws(
    () =>
      service.recordHumanReview(
        registration.id,
        input,
        accreditedVerifier("cp_verifier_foreign_org", { organizationId: "cp_org_foreign_001" }),
      ),
    /outside the evidence-owning organization|authorityRoot/i,
  );

  const review = service.recordHumanReview(registration.id, input, accreditedVerifier());
  const retry = service.recordHumanReview(registration.id, input, accreditedVerifier());
  assert.equal(retry, review);
  assert.equal(review.decision, "approve");
  assert.equal(review.auditEvent.entityType, "human_review");
  assert.equal(review.evidenceSequence, 4);
  assert.equal(service.getEvidenceReliance(registration.id).state, "approved");
});

test("CanopyProof approval rejects AI cherry-picking and unresolved or escalated material findings", () => {
  const registration = buildRegistration("cp_evidence_verification_findings");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = runValidation(service, registration.id);
  const registrationEventRoot = registration.audit_history[0].eventRoot;
  const first = recordAnalysis(service, registration.id, registrationEventRoot, validation, {
    findings: [
      {
        capability: "anomaly detection",
        severity: "high",
        code: "spatial_anomaly",
        message: "A spatial anomaly requires independent human interpretation before reliance.",
        recommendedAction: "DELEGATE",
        sourceEventRoots: [registrationEventRoot, validation.auditEvent.eventRoot],
      },
    ],
  });
  const second = recordAnalysis(
    service,
    registration.id,
    registrationEventRoot,
    validation,
    {
      modelVersion: "1.0.1",
      analyzedAt: "2026-07-12T00:31:00.000Z",
    },
    { id: "cp_ai_agent_002", participantRoot: "6".repeat(64) },
  );
  const finding = first.findings[0]!;

  assert.throws(
    () => service.recordHumanReview(registration.id, reviewInput(validation, [first]), accreditedVerifier()),
    /reference every AI analysis/,
  );
  assert.throws(
    () => service.recordHumanReview(registration.id, reviewInput(validation, [first, second]), accreditedVerifier()),
    /require explicit human disposition/,
  );
  assert.throws(
    () =>
      service.recordHumanReview(
        registration.id,
        reviewInput(validation, [first, second], {
          findingDispositions: [
            {
              analysisId: first.id,
              findingId: finding.id,
              disposition: "escalated",
              rationale: "Escalated for additional independent source assessment.",
              evidenceEventRoots: [],
            },
          ],
        }),
        accreditedVerifier(),
      ),
    /escalated AI findings block/,
  );

  const approved = service.recordHumanReview(
    registration.id,
    reviewInput(validation, [first, second], {
      findingDispositions: [
        {
          analysisId: first.id,
          findingId: finding.id,
          disposition: "overruled",
          rationale: "Independent field evidence resolves the bounded spatial anomaly for this registration.",
          evidenceEventRoots: [registrationEventRoot],
        },
      ],
    }),
    accreditedVerifier(),
  );
  assert.equal(approved.decision, "approve");
  assert.equal(approved.findingDispositions[0]?.disposition, "overruled");
});

test("CanopyProof reliance resets when new advisory facts arrive and rejects stale validation cycles", () => {
  const registration = buildRegistration("cp_evidence_verification_cycles");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const firstValidation = runValidation(service, registration.id);
  const registrationRoot = registration.audit_history[0].eventRoot;
  const firstAnalysis = recordAnalysis(service, registration.id, registrationRoot, firstValidation);
  service.recordHumanReview(registration.id, reviewInput(firstValidation, [firstAnalysis]), accreditedVerifier());
  assert.equal(service.getEvidenceReliance(registration.id).state, "approved");

  recordAnalysis(
    service,
    registration.id,
    registrationRoot,
    firstValidation,
    { modelVersion: "1.1.0", analyzedAt: "2026-07-12T00:41:00.000Z" },
    { id: "cp_ai_agent_cycle_002", participantRoot: "7".repeat(64) },
  );
  assert.equal(service.getEvidenceReliance(registration.id).state, "ai_advised");

  const secondValidation = runValidation(service, registration.id, "2026-07-12T00:50:00.000Z");
  assert.equal(service.getEvidenceReliance(registration.id).state, "validation_passed");
  assert.throws(
    () => recordAnalysis(service, registration.id, registrationRoot, firstValidation, { analyzedAt: "2026-07-12T00:51:00.000Z" }),
    /latest evidence validation run/,
  );
  assert.notEqual(secondValidation.id, firstValidation.id);
});

test("CanopyProof non-approval review remains available to independent researchers without granting approval", () => {
  const registration = buildRegistration("cp_evidence_verification_research_review");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = runValidation(service, registration.id);
  const analysis = recordAnalysis(
    service,
    registration.id,
    registration.audit_history[0].eventRoot,
    validation,
  );
  const review = service.recordHumanReview(
    registration.id,
    reviewInput(validation, [analysis], {
      decision: "challenge",
      rationale: "Independent researcher challenges reliance pending additional field evidence.",
    }),
    actor("cp_researcher_challenge_001", "human", "researcher"),
  );
  assert.equal(review.decision, "challenge");
  assert.equal(service.getEvidenceReliance(registration.id).state, "challenged");
});

test("CanopyProof verification snapshots replay exactly and reject gaps, forks, and fact tampering", () => {
  const registration = buildRegistration("cp_evidence_verification_replay");
  const source = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = runValidation(source, registration.id);
  const analysis = recordAnalysis(
    source,
    registration.id,
    registration.audit_history[0].eventRoot,
    validation,
  );
  const review = source.recordHumanReview(
    registration.id,
    reviewInput(validation, [analysis]),
    accreditedVerifier("cp_verifier_replay_001"),
  );
  const snapshot = source.getAuthoritySnapshot();
  const replayed = CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot(snapshot);
  assert.deepEqual(replayed.getEvidenceReliance(registration.id), source.getEvidenceReliance(registration.id));
  assert.equal(replayed.getStatus().authorityRoot, source.getStatus().authorityRoot);

  assert.throws(
    () =>
      CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        validationRuns: [{ ...validation, evidenceSequence: 3 }],
      }),
    /sequence gap or fork/,
  );
  assert.throws(
    () =>
      CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        aiAnalyses: [{ ...analysis, previousEventRoot: "f".repeat(64) }],
      }),
    /predecessor root is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        humanReviews: [{ ...review, rationale: "Tampered review rationale after commitment." }],
      }),
    /canonical command hash|fact lineage is invalid/,
  );
});

test("CanopyProof verification facts reject unsafe claims and secret material", () => {
  const registration = buildRegistration("cp_evidence_verification_unsafe");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const validation = runValidation(service, registration.id);

  assert.throws(
    () =>
      recordAnalysis(service, registration.id, registration.audit_history[0].eventRoot, validation, {
        modelName: "private_key inference model",
      }),
    /secret material/,
  );
  const analysis = recordAnalysis(
    service,
    registration.id,
    registration.audit_history[0].eventRoot,
    validation,
  );
  assert.throws(
    () =>
      service.recordHumanReview(
        registration.id,
        reviewInput(validation, [analysis], {
          rationale: "This result represents guaranteed RWA yield for every participant.",
        }),
        accreditedVerifier("cp_verifier_unsafe_001"),
      ),
    /unsupported public claim/,
  );
});

test("CanopyProof evidence challenge suspends approved reliance without granting cross-organization authority", () => {
  const registration = buildRegistration("cp_evidence_challenge_cross_org");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  approveEvidence(service, registration, "challenge-cross-org");
  assert.equal(service.getEvidenceReliance(registration.id).state, "approved");

  const challenge = openEvidenceChallenge(service, registration);
  const reliance = service.getEvidenceReliance(registration.id);
  assert.equal(challenge.challenger.organizationId, "cp_org_external_challenger_001");
  assert.equal(challenge.organizationId, organizationId);
  assert.equal(challenge.safety.crossOrganizationChallengeGrantsNoAccess, true);
  assert.equal(challenge.challengedRelianceState, "approved");
  assert.equal(reliance.state, "challenged");
  assert.deepEqual(reliance.openChallengeIds, [challenge.id]);
  assert.equal(reliance.latestHumanReviewId, challenge.challengedHumanReviewId);
  assert.equal(challenge.evidenceSequence, 5);
  const challengeRetry = service.openChallenge(
    registration.id,
    {
      id: challenge.id,
      reason: challenge.reason,
      severity: challenge.severity,
      rationale: challenge.rationale,
      supportingArtifactHashes: challenge.supportingArtifactHashes,
      evidenceEventRoots: challenge.evidenceEventRoots,
      challengedAt: challenge.challengedAt,
    },
    actor("cp_challenger_external_001", "human", "researcher", {
      organizationId: "cp_org_external_challenger_001",
      organizationRoot: "8".repeat(64),
    }),
  );
  assert.equal(challengeRetry, challenge);

  assert.throws(
    () =>
      service.openChallenge(
        registration.id,
        {
          reason: "other",
          severity: "low",
          rationale: "An agent cannot independently open a challenge against human-governed evidence reliance.",
          supportingArtifactHashes: ["9".repeat(64)],
          evidenceEventRoots: [challenge.auditEvent.eventRoot],
          challengedAt: "2026-07-12T00:51:00.000Z",
        },
        actor("cp_agent_challenger_forbidden", "agent", "agent"),
      ),
    /verified human organization member/,
  );
});

test("CanopyProof challenge resolution is an independent append-only chain and upheld findings require correction", () => {
  const registration = buildRegistration("cp_evidence_challenge_resolution_chain");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const approved = approveEvidence(service, registration, "challenge-resolution");
  const challenge = openEvidenceChallenge(service, registration, "cp_challenger_resolution_001");

  assert.throws(
    () =>
      service.resolveChallenge(
        challenge.id,
        {
          decision: "upheld",
          rationale: "The original reviewer cannot independently resolve a challenge against their own review decision.",
          limitations: [],
          evidenceEventRoots: [challenge.auditEvent.eventRoot],
          reviewedAt: "2026-07-12T00:55:00.000Z",
        },
        accreditedVerifier(approved.review.reviewer.id),
      ),
    /independent human reviewer/,
  );

  const interim = resolveEvidenceChallenge(
    service,
    challenge.id,
    "cp_researcher_resolution_interim",
    "needs_more_evidence",
    "2026-07-12T01:00:00.000Z",
  );
  assert.equal(service.getEvidenceReliance(registration.id).state, "challenged");
  const upheld = resolveEvidenceChallenge(
    service,
    challenge.id,
    "cp_verifier_resolution_final",
    "upheld",
    "2026-07-12T01:10:00.000Z",
  );
  assert.equal(upheld.previousResolutionId, interim.id);
  assert.equal(upheld.previousResolutionRoot, interim.resolutionRoot);
  const resolutionRetry = service.resolveChallenge(
    challenge.id,
    {
      id: upheld.id,
      decision: upheld.decision,
      rationale: upheld.rationale,
      limitations: upheld.limitations,
      evidenceEventRoots: upheld.evidenceEventRoots,
      reviewedAt: upheld.reviewedAt,
    },
    accreditedVerifier("cp_verifier_resolution_final"),
  );
  assert.equal(resolutionRetry, upheld);
  const reliance = service.getEvidenceReliance(registration.id);
  assert.equal(reliance.state, "correction_required");
  assert.deepEqual(reliance.upheldChallengeIds, [challenge.id]);
  assert.throws(
    () =>
      resolveEvidenceChallenge(
        service,
        challenge.id,
        "cp_verifier_resolution_duplicate",
        "dismissed",
        "2026-07-12T01:20:00.000Z",
      ),
    /terminal resolution/,
  );
});

test("CanopyProof dismissed challenge restores only the currently replayable verification baseline", () => {
  const registration = buildRegistration("cp_evidence_challenge_dismiss_stale");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const approved = approveEvidence(service, registration, "challenge-dismiss");
  const challenge = openEvidenceChallenge(service, registration, "cp_challenger_dismiss_001");

  recordAnalysis(
    service,
    registration.id,
    registration.audit_history[0].eventRoot,
    approved.validation,
    { modelVersion: "2.0.0", analyzedAt: "2026-07-12T00:55:00.000Z" },
    { id: "cp_ai_agent_post_challenge", participantRoot: "a".repeat(64) },
  );
  const dismissed = resolveEvidenceChallenge(
    service,
    challenge.id,
    "cp_verifier_dismiss_final",
    "dismissed",
    "2026-07-12T01:00:00.000Z",
  );
  const reliance = service.getEvidenceReliance(registration.id);
  assert.equal(dismissed.decision, "dismissed");
  assert.equal(reliance.state, "ai_advised");
  assert.deepEqual(reliance.dismissedChallengeIds, [challenge.id]);
  assert.equal(reliance.latestHumanReviewId, undefined);
});

test("CanopyProof upheld challenge withdrawal preserves history and permanently removes reliance", () => {
  const registration = buildRegistration("cp_evidence_challenge_withdraw");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const approved = approveEvidence(service, registration, "challenge-withdraw");
  const challenge = openEvidenceChallenge(service, registration, "cp_challenger_withdraw_001");
  const resolution = resolveEvidenceChallenge(
    service,
    challenge.id,
    "cp_verifier_withdraw_resolution",
    "upheld",
    "2026-07-12T01:00:00.000Z",
  );

  assert.throws(
    () =>
      service.recordCorrection(
        resolution.id,
        {
          action: "withdraw",
          rationale: "The conflicted original reviewer cannot publish the corrective withdrawal notice.",
          evidenceEventRoots: [resolution.auditEvent.eventRoot],
          correctedAt: "2026-07-12T01:10:00.000Z",
        },
        accreditedVerifier(approved.review.reviewer.id),
      ),
    /independent human publisher/,
  );
  const correction = service.recordCorrection(
    resolution.id,
    {
      action: "withdraw",
      rationale: "Independent governance withdraws bounded reliance while preserving every historical evidence fact.",
      evidenceEventRoots: [resolution.auditEvent.eventRoot],
      correctedAt: "2026-07-12T01:10:00.000Z",
    },
    actor("cp_admin_withdraw_publisher", "human", "admin"),
  );
  const reliance = service.getEvidenceReliance(registration.id);
  assert.equal(correction.action, "withdraw");
  assert.equal(reliance.state, "withdrawn");
  assert.deepEqual(reliance.correctedChallengeIds, [challenge.id]);
  assert.equal(service.listChallenges(registration.id).length, 1);
  assert.equal(service.listChallengeResolutions(challenge.id).length, 1);
  assert.equal(service.listCorrections(registration.id).length, 1);
  const correctionRetry = service.recordCorrection(
    resolution.id,
    {
      id: correction.id,
      action: correction.action,
      rationale: correction.rationale,
      evidenceEventRoots: correction.evidenceEventRoots,
      correctedAt: correction.correctedAt,
    },
    actor("cp_admin_withdraw_publisher", "human", "admin"),
  );
  assert.equal(correctionRetry, correction);
  assert.throws(
    () =>
      openEvidenceChallenge(service, registration, "cp_challenger_after_withdraw", {
        challengedAt: "2026-07-12T01:20:00.000Z",
      }),
    /after evidence withdrawal or supersession/,
  );
});

test("CanopyProof supersession requires a distinct same-project replacement with independent current approval", () => {
  const original = buildRegistration("cp_evidence_supersession_original");
  const replacement = buildRegistration("cp_evidence_supersession_replacement", {
    media_hash: hashFor("cp_evidence_supersession_replacement", "unique-media"),
  });
  const unapproved = buildRegistration("cp_evidence_supersession_unapproved", {
    media_hash: hashFor("cp_evidence_supersession_unapproved", "unique-media"),
  });
  const service = new CanopyProofEvidenceVerificationAuthorityService([original, replacement, unapproved]);
  approveEvidence(service, original, "supersession-original");
  approveEvidence(service, replacement, "supersession-replacement", {
    validation: "2026-07-12T00:21:00.000Z",
    analysis: "2026-07-12T00:31:00.000Z",
    review: "2026-07-12T00:41:00.000Z",
  });
  const challenge = openEvidenceChallenge(service, original, "cp_challenger_supersession_001");
  const resolution = resolveEvidenceChallenge(
    service,
    challenge.id,
    "cp_verifier_supersession_resolution",
    "upheld",
    "2026-07-12T01:00:00.000Z",
  );

  assert.throws(
    () =>
      service.recordCorrection(
        resolution.id,
        {
          action: "supersede",
          replacementEvidenceId: unapproved.id,
          rationale: "An unapproved registration cannot replace evidence under an upheld challenge remedy.",
          evidenceEventRoots: [resolution.auditEvent.eventRoot],
          correctedAt: "2026-07-12T01:10:00.000Z",
        },
        actor("cp_admin_supersession_publisher", "human", "admin"),
      ),
    /requires independent current approval/,
  );
  const correction = service.recordCorrection(
    resolution.id,
    {
      action: "supersede",
      replacementEvidenceId: replacement.id,
      rationale: "Independent governance links a separately approved replacement without rewriting either evidence stream.",
      evidenceEventRoots: [resolution.auditEvent.eventRoot],
      correctedAt: "2026-07-12T01:10:00.000Z",
    },
    actor("cp_admin_supersession_publisher", "human", "admin"),
  );
  const reliance = service.getEvidenceReliance(original.id);
  assert.equal(correction.action, "supersede");
  assert.equal(reliance.state, "superseded");
  assert.equal(reliance.replacementEvidenceId, replacement.id);
  assert.equal(service.getEvidenceReliance(replacement.id).state, "approved");

  const snapshot = service.getAuthoritySnapshot();
  const replayed = CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot(snapshot);
  assert.deepEqual(replayed.getEvidenceReliance(original.id), reliance);
  assert.equal(replayed.getStatus().authorityRoot, service.getStatus().authorityRoot);

  assert.throws(
    () =>
      CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        challengeResolutions: [{ ...resolution, decision: "dismissed" }],
      }),
    /canonical command hash|fact lineage is invalid/,
  );
});

test("CanopyProof final verification binds the exact approved authority chain and replays deterministically", () => {
  const registration = buildRegistration("cp_evidence_final_verification_approved");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  approveEvidence(service, registration, "final-approved");
  const input = finalDecisionInput(service, registration);
  const verifier = accreditedVerifier("cp_final_verifier_approved_001");

  const decision = service.recordFinalDecision(registration.id, input, verifier);
  const retry = service.recordFinalDecision(registration.id, input, verifier);
  assert.equal(retry, decision);
  assert.equal(decision.decision, "verify");
  assert.equal(decision.preDecisionRelianceState, "approved");
  assert.equal(decision.evidenceSequence, 5);
  assert.equal(decision.auditEvent.entityType, "evidence_final_decision");
  assert.equal(decision.safety.notEnvironmentalProofRecord, true);
  assert.equal(service.getEvidenceFinalVerification(registration.id).state, "verified");
  assert.equal(service.getEvidenceFinalVerification(registration.id).currentDecisionId, decision.id);

  assert.throws(
    () =>
      service.recordFinalDecision(
        registration.id,
        { ...input, decidedAt: "2026-07-12T00:46:00.000Z" },
        accreditedVerifier("cp_final_verifier_approved_002"),
      ),
    /already has a current final decision/,
  );

  const snapshot = service.getAuthoritySnapshot();
  const replayed = CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot(snapshot);
  assert.deepEqual(replayed.getEvidenceFinalVerification(registration.id), service.getEvidenceFinalVerification(registration.id));
  assert.equal(replayed.getStatus().authorityRoot, service.getStatus().authorityRoot);
  assert.throws(
    () =>
      CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        finalDecisions: [{ ...decision, rationale: "Tampered final decision rationale after commitment." }],
      }),
    /canonical command hash|fact lineage is invalid/,
  );
});

test("CanopyProof final decisions enforce exact role, current accreditation, and maker-checker independence", () => {
  const registration = buildRegistration("cp_evidence_final_verification_independence");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const approved = approveEvidence(service, registration, "final-independence");
  const input = finalDecisionInput(service, registration);

  assert.throws(
    () => service.recordFinalDecision(registration.id, input, accreditedVerifier(registration.contributor)),
    /independent accredited verifier/,
  );
  assert.throws(
    () => service.recordFinalDecision(registration.id, input, accreditedVerifier(approved.review.reviewer.id)),
    /independent accredited verifier/,
  );
  assert.throws(
    () => service.recordFinalDecision(registration.id, input, accreditedVerifier(approved.analysis.agent.id)),
    /independent accredited verifier/,
  );
  assert.throws(
    () => service.recordFinalDecision(registration.id, input, actor("cp_final_researcher", "human", "researcher")),
    /exact verifier role/,
  );
  assert.throws(
    () => service.recordFinalDecision(registration.id, input, actor("cp_final_agent", "agent", "agent")),
    /verified human with the exact verifier role/,
  );
  assert.throws(
    () => service.recordFinalDecision(registration.id, input, actor("cp_final_unaccredited", "human", "verifier")),
    /current approved accreditation/,
  );
});

test("CanopyProof final verification is challenge-aware and cannot certify suspended or corrected evidence", () => {
  const challenged = buildRegistration("cp_evidence_final_challenged");
  const challengedService = new CanopyProofEvidenceVerificationAuthorityService([challenged]);
  approveEvidence(challengedService, challenged, "final-challenged");
  openEvidenceChallenge(challengedService, challenged, "cp_final_challenger_001");
  assert.throws(
    () =>
      challengedService.recordFinalDecision(
        challenged.id,
        finalDecisionInput(challengedService, challenged, "verify", {
          decidedAt: "2026-07-12T00:55:00.000Z",
        }),
        accreditedVerifier("cp_final_challenged_verifier"),
      ),
    /reliance state: challenged/,
  );

  const correctionRequired = buildRegistration("cp_evidence_final_correction_required");
  const correctionService = new CanopyProofEvidenceVerificationAuthorityService([correctionRequired]);
  approveEvidence(correctionService, correctionRequired, "final-correction-required");
  const challenge = openEvidenceChallenge(correctionService, correctionRequired, "cp_final_challenger_002");
  const resolution = resolveEvidenceChallenge(
    correctionService,
    challenge.id,
    "cp_final_resolution_verifier",
    "upheld",
    "2026-07-12T01:00:00.000Z",
  );
  assert.throws(
    () =>
      correctionService.recordFinalDecision(
        correctionRequired.id,
        finalDecisionInput(correctionService, correctionRequired, "reject", {
          decidedAt: "2026-07-12T01:05:00.000Z",
        }),
        accreditedVerifier("cp_final_correction_required_verifier"),
      ),
    /reliance state: correction_required/,
  );
  correctionService.recordCorrection(
    resolution.id,
    {
      action: "withdraw",
      rationale: "Independent governance withdraws reliance while preserving the complete challenge authority chain.",
      evidenceEventRoots: [resolution.auditEvent.eventRoot],
      correctedAt: "2026-07-12T01:10:00.000Z",
    },
    actor("cp_final_withdraw_admin", "human", "admin"),
  );
  assert.throws(
    () =>
      correctionService.recordFinalDecision(
        correctionRequired.id,
        finalDecisionInput(correctionService, correctionRequired, "reject", {
          decidedAt: "2026-07-12T01:15:00.000Z",
        }),
        accreditedVerifier("cp_final_withdrawn_verifier"),
      ),
    /reliance state: withdrawn/,
  );
});

test("CanopyProof later facts stale final decisions and successor authority requires verifier rotation", () => {
  const registration = buildRegistration("cp_evidence_final_verification_successor");
  const service = new CanopyProofEvidenceVerificationAuthorityService([registration]);
  const approved = approveEvidence(service, registration, "final-successor");
  const firstVerifier = accreditedVerifier("cp_final_successor_verifier_001");
  const first = service.recordFinalDecision(
    registration.id,
    finalDecisionInput(service, registration),
    firstVerifier,
  );
  assert.equal(service.getEvidenceFinalVerification(registration.id).state, "verified");

  const secondAnalysis = recordAnalysis(
    service,
    registration.id,
    registration.audit_history[0].eventRoot,
    approved.validation,
    { modelVersion: "2.0.0", analyzedAt: "2026-07-12T00:50:00.000Z" },
    { id: "cp_ai_agent_final_successor_002", participantRoot: "b".repeat(64) },
  );
  assert.equal(service.getEvidenceFinalVerification(registration.id).state, "stale");
  const secondReview = service.recordHumanReview(
    registration.id,
    reviewInput(approved.validation, [approved.analysis, secondAnalysis], {
      reviewedAt: "2026-07-12T01:00:00.000Z",
    }),
    accreditedVerifier("cp_review_verifier_final_successor_002"),
  );
  const successorInput = finalDecisionInput(service, registration, "verify", {
    decidedAt: "2026-07-12T01:10:00.000Z",
  });
  assert.equal(secondReview.decision, "approve");
  assert.throws(
    () => service.recordFinalDecision(registration.id, successorInput, firstVerifier),
    /independent accredited verifier/,
  );
  const successor = service.recordFinalDecision(
    registration.id,
    successorInput,
    accreditedVerifier("cp_final_successor_verifier_002"),
  );
  assert.equal(successor.priorFinalDecisionId, first.id);
  assert.equal(successor.priorFinalDecisionRoot, first.decisionRoot);
  assert.equal(service.getEvidenceFinalVerification(registration.id).state, "verified");
  assert.equal(service.listFinalDecisions(registration.id).length, 2);
});
