import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofVisualEvidenceAuthorityService,
  createVisualHumanReviewer,
  createVisualServiceActor,
  VisualEvidenceError,
  verifyVisualEvidenceAuthoritySnapshot,
  visualEvidenceAuthorityStatus,
  type VisualEvidenceErrorCode,
} from "../../services/api/src/domain/canopyproof/visual-evidence-intelligence.js";
import {
  createArielScansDefaultLicensePolicy,
  createVineLidarLabLicensePolicy,
  createVisualLicensePolicy,
} from "../../services/api/src/domain/canopyproof/visual-license-policy.js";
import type {
  CandidateFinding,
  DatasetSnapshot,
  ModelDefinition,
  ModelRun,
  MultimodalDataset,
  ReviewQueueSnapshot,
  SensorStream,
  VisualHumanReviewer,
  VisualServiceActor,
} from "../../services/api/src/domain/canopyproof/visual-evidence-types.js";

const tenantId = "cp_visual_tenant_001";
const organizationId = "cp_visual_org_001";
const projectId = "cp_visual_project_001";
const license = createVineLidarLabLicensePolicy("2026-07-13T00:00:00.000Z");

function serviceActor(
  capability: VisualServiceActor["capability"],
  suffix = capability,
): VisualServiceActor {
  return createVisualServiceActor({
    id: `cp_visual_service_${suffix}`,
    actorType: "service",
    tenantId,
    organizationId,
    capability,
  });
}

function reviewer(id = "cp_visual_reviewer_001", overrides: Partial<Pick<VisualHumanReviewer, "tenantId" | "organizationId" | "conflictFree">> = {}) {
  return createVisualHumanReviewer({
    id,
    tenantId: overrides.tenantId ?? tenantId,
    organizationId: overrides.organizationId ?? organizationId,
    role: "verifier",
    accreditationId: `cp_visual_accreditation_${id}`,
    accreditationRoot: hashJson({ kind: "visual-reviewer-accreditation", id }),
    conflictFree: overrides.conflictFree ?? true,
  });
}

type VisualFixture = {
  readonly authority: CanopyProofVisualEvidenceAuthorityService;
  readonly stream: SensorStream;
  readonly dataset: MultimodalDataset;
  readonly snapshot: DatasetSnapshot;
  readonly model: ModelDefinition;
  readonly run: ModelRun;
  readonly firstCandidate: CandidateFinding;
  readonly secondCandidate: CandidateFinding;
};

function visualFixture(): VisualFixture {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const datasetActor = serviceActor("visual_dataset_registration");
  const mission = authority.registerAcquisitionMission(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: license.id,
      missionName: "Synthetic visual review mission",
      platformType: "fixed_fixture",
      purpose: "non-production domain validation",
      startedAt: "2026-07-13T10:00:00.000Z",
      completedAt: "2026-07-13T10:00:30.000Z",
      geometryRef: "cp_generalized_geometry_001",
      permitRoots: [hashJson({ kind: "visual-permit-fixture" })],
    },
    datasetActor,
  );
  const stream = authority.registerSensorStream(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: license.id,
      createdAt: "2026-07-13T10:01:00.000Z",
      acquisitionMissionId: mission.id,
      modality: "RGB",
      make: "Synthetic",
      model: "Fixture RGB v1",
      serialCommitment: hashJson({ kind: "visual-sensor-serial" }),
      nativeResolution: 5,
      resolutionUnit: "centimeters_per_pixel",
      altitudeRangeMeters: [15, 30],
      calibrationRecordId: "cp_visual_calibration_001",
      calibrationState: "calibrated",
      clockQuality: "verified",
      coordinateFrame: "ABSOLUTE_CRS",
      knownLimitations: ["synthetic fixture only"],
    },
    datasetActor,
  );
  const registration = authority.registerDataset(
    {
      datasetName: "Synthetic visual intelligence fixture",
      purpose: "LAB_BENCHMARK",
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      pairingPolicyVersion: "visual-pairing-v1",
      sensorStreamIds: [stream.id],
      members: [
        {
          sampleId: "cp_visual_sample_001",
          assetId: "cp_visual_asset_001",
          assetVersion: 1,
          assetRoot: hashJson({ kind: "visual-asset", id: 1 }),
          contentHash: hashJson({ kind: "visual-content", id: 1 }),
          sensorStreamId: stream.id,
          pairedSampleIds: [],
          licensePolicyId: license.id,
        },
        {
          sampleId: "cp_visual_sample_002",
          assetId: "cp_visual_asset_002",
          assetVersion: 1,
          assetRoot: hashJson({ kind: "visual-asset", id: 2 }),
          contentHash: hashJson({ kind: "visual-content", id: 2 }),
          sensorStreamId: stream.id,
          pairedSampleIds: [],
          licensePolicyId: license.id,
        },
      ],
      pairingEdgeRoots: [],
      createdAt: "2026-07-13T10:02:00.000Z",
      licensePolicy: license,
    },
    datasetActor,
  );
  const modelActor = serviceActor("visual_model_execution");
  const model = authority.registerModelDefinition(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: license.id,
      createdAt: "2026-07-13T10:03:00.000Z",
      name: "Synthetic RGB candidate model",
      modelFamily: "fixture-detector",
      artifactHash: hashJson({ kind: "visual-model-artifact" }),
      containerDigest: hashJson({ kind: "visual-model-container" }),
      sbomHash: hashJson({ kind: "visual-model-sbom" }),
      preprocessingContractHash: hashJson({ kind: "visual-model-preprocess" }),
      outputSchemaVersion: "visual-candidate-v1",
      domainPolicy: {
        supportedSensors: ["RGB"],
        supportedResolutionRange: [2, 10],
        supportedResolutionUnit: "centimeters_per_pixel",
        supportedAltitudeRange: [15, 30],
        supportedSeasons: ["summer"],
        supportedEcosystems: ["vineyard"],
        supportedGeographies: ["fixture-region"],
        requiresCalibration: true,
        knownLimitations: ["not valid for thermal"],
        calibrationDatasetRefs: [registration.snapshot.id],
      },
    },
    modelActor,
  );
  const sourceDomain = {
    sensor: "RGB" as const,
    resolution: 5,
    resolutionUnit: "centimeters_per_pixel" as const,
    altitudeMeters: 20,
    season: "summer",
    ecosystem: "vineyard",
    geography: "fixture-region",
    calibrationState: "calibrated" as const,
  };
  const run = authority.recordModelRun(
    {
      modelDefinitionId: model.id,
      datasetSnapshotId: registration.snapshot.id,
      sourceDomain,
      canonicalParametersHash: hashJson({ threshold: 0.5 }),
      deterministicSeed: "fixture-seed-001",
      runtimeDigest: hashJson({ kind: "visual-runtime" }),
      startedAt: "2026-07-13T10:04:00.000Z",
      completedAt: "2026-07-13T10:05:00.000Z",
      outputRoot: hashJson({ kind: "visual-model-output" }),
      licensePolicy: license,
    },
    modelActor,
  );
  const candidateActor = serviceActor("visual_candidate_import");
  const firstCandidate = authority.recordCandidate(
    {
      modelRunId: run.id,
      sampleId: "cp_visual_sample_001",
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      modelScore: 0.88,
      geometryScore: 0.74,
      noveltyScore: 0.61,
      uncertaintyScore: 0.2,
      sensorDomain: sourceDomain,
      createdAt: "2026-07-13T10:06:00.000Z",
    },
    candidateActor,
  );
  const secondCandidate = authority.recordCandidate(
    {
      modelRunId: run.id,
      sampleId: "cp_visual_sample_002",
      geometry: { type: "Polygon", coordinates: [[[2, 2], [3, 2], [3, 3], [2, 2]]] },
      modelScore: 0.62,
      geometryScore: 0.55,
      noveltyScore: 0.72,
      uncertaintyScore: 0.38,
      sensorDomain: sourceDomain,
      createdAt: "2026-07-13T10:07:00.000Z",
    },
    candidateActor,
  );
  return {
    authority,
    stream,
    dataset: registration.dataset,
    snapshot: registration.snapshot,
    model,
    run,
    firstCandidate,
    secondCandidate,
  };
}

function expectVisualError(code: VisualEvidenceErrorCode, operation: () => unknown) {
  assert.throws(operation, (error: unknown) => error instanceof VisualEvidenceError && error.code === code);
}

function queue(
  fixture: VisualFixture,
  candidateIds: readonly string[],
  sampleIds: readonly string[],
  options: Readonly<{ prior?: ReviewQueueSnapshot; secondReviewRequired?: boolean; fieldRequired?: boolean }> = {},
) {
  return fixture.authority.createReviewQueue(
    {
      datasetSnapshotId: fixture.snapshot.id,
      candidateIds,
      sampleIds,
      purpose: "synthetic human triage",
      methodologyId: "cp_visual_methodology_001",
      requiredReviewerRoles: ["verifier"],
      secondReviewRequired: options.secondReviewRequired ?? false,
      fieldCheckPolicy: options.fieldRequired ? "REQUIRED_FOR_ACCEPTANCE" : "ON_REQUEST",
      filterExpression: "candidate.modelScore >= 0",
      sortExpression: "candidate.modelScore DESC",
      modelRunIds: [fixture.run.id],
      randomQaSeed: "qa-seed-001",
      ...(options.prior ? { priorQueueSnapshotId: options.prior.id } : {}),
      createdAt: options.prior ? "2026-07-13T10:09:00.000Z" : "2026-07-13T10:08:00.000Z",
    },
    serviceActor("visual_manifest_issuance"),
  );
}

test("visual model output remains a candidate and cannot issue proof", () => {
  const fixture = visualFixture();
  assert.equal(fixture.firstCandidate.status, "CANDIDATE");
  assert.equal(fixture.firstCandidate.advisoryOnly, true);
  assert.equal(fixture.firstCandidate.evidenceAuthority, "NONE");
  assert.equal(fixture.authority.candidateStatus(fixture.firstCandidate.id), "CANDIDATE");
  expectVisualError("VISUAL_MACHINE_PROOF_FORBIDDEN", () =>
    fixture.authority.assertMachineCannotIssueProof(serviceActor("visual_candidate_import")),
  );
  const status = visualEvidenceAuthorityStatus();
  assert.equal(status.durableTrustRegistryAdapterImplemented, true);
  assert.equal(status.nativePostgresApprovalComplete, false);
  assert.equal(status.deploymentAuthorized, false);
});

test("visual authority snapshot detects candidate and audit tampering", () => {
  const fixture = visualFixture();
  const snapshot = fixture.authority.getAuthoritySnapshot();
  const verified = verifyVisualEvidenceAuthoritySnapshot(snapshot);
  assert.equal(verified.valid, true, verified.issues.join(", "));
  const replayed = CanopyProofVisualEvidenceAuthorityService.fromAuthoritySnapshot(snapshot);
  assert.deepEqual(replayed.getAuthoritySnapshot(), snapshot);
  const tampered = {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate, index) =>
      index === 0 ? { ...candidate, modelScore: 0.01 } : candidate,
    ),
  };
  const rejected = verifyVisualEvidenceAuthoritySnapshot(tampered);
  assert.equal(rejected.valid, false);
  assert.equal(rejected.issues.some((issue) => issue.startsWith("invalid_fact_hash:")), true);
  assert.equal(rejected.issues.includes("invalid_snapshot_root"), false);
  expectVisualError("VISUAL_IMMUTABILITY_VIOLATION", () =>
    CanopyProofVisualEvidenceAuthorityService.fromAuthoritySnapshot(tampered),
  );

  const embeddedAuditTampering = {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            auditEvent: { ...candidate.auditEvent, rationale: "A forged embedded rationale." },
          }
        : candidate,
    ),
  };
  const embeddedAuditRejected = verifyVisualEvidenceAuthoritySnapshot(embeddedAuditTampering);
  assert.equal(
    embeddedAuditRejected.issues.some((issue) => issue.startsWith("invalid_embedded_audit_event:")),
    true,
  );
});

test("sensor-domain mismatch records a gap and blocks RGB model on thermal", () => {
  const fixture = visualFixture();
  expectVisualError("VISUAL_SENSOR_DOMAIN_MISMATCH", () =>
    fixture.authority.recordModelRun(
      {
        modelDefinitionId: fixture.model.id,
        datasetSnapshotId: fixture.snapshot.id,
        sourceDomain: {
          sensor: "THERMAL",
          resolution: 5,
          resolutionUnit: "centimeters_per_pixel",
          altitudeMeters: 20,
          season: "summer",
          ecosystem: "vineyard",
          geography: "fixture-region",
          calibrationState: "calibrated",
        },
        canonicalParametersHash: hashJson({ threshold: 0.5, sensor: "thermal" }),
        runtimeDigest: hashJson({ kind: "visual-runtime" }),
        startedAt: "2026-07-13T10:08:00.000Z",
        completedAt: "2026-07-13T10:09:00.000Z",
        outputRoot: hashJson({ kind: "visual-model-output-thermal" }),
        licensePolicy: license,
      },
      serviceActor("visual_model_execution"),
    ),
  );
  assert.deepEqual(fixture.authority.listSensorDomainGaps().at(-1)?.gapDimensions, ["SENSOR"]);
  assert.equal(fixture.authority.listSensorDomainGaps().at(-1)?.disposition, "BLOCKED");
});

test("saved-view drift creates a new immutable queue version and hash", () => {
  const fixture = visualFixture();
  const first = queue(fixture, [fixture.firstCandidate.id], [fixture.firstCandidate.sampleId]);
  const replay = queue(fixture, [fixture.firstCandidate.id], [fixture.firstCandidate.sampleId], {
    prior: first.snapshot,
  });
  assert.equal(replay.createdNewVersion, false);
  assert.equal(replay.snapshot.id, first.snapshot.id);

  const changed = queue(
    fixture,
    [fixture.firstCandidate.id, fixture.secondCandidate.id],
    [fixture.firstCandidate.sampleId, fixture.secondCandidate.sampleId],
    { prior: first.snapshot },
  );
  assert.equal(changed.createdNewVersion, true);
  assert.equal(changed.snapshot.version, 2);
  assert.notEqual(changed.snapshot.reviewQueueHash, first.snapshot.reviewQueueHash);
  assert.equal(changed.snapshot.priorQueueSnapshotId, first.snapshot.id);
  const authoritySnapshot = fixture.authority.getAuthoritySnapshot();
  assert.equal(authoritySnapshot.reviewQueues.filter((item) => item.id === changed.queue.id).length, 2);
  const restarted = CanopyProofVisualEvidenceAuthorityService.fromAuthoritySnapshot(authoritySnapshot);
  assert.deepEqual(restarted.getReviewQueueSnapshot(changed.snapshot.id), changed.snapshot);
  const stableAfterRestart = restarted.createReviewQueue(
    {
      datasetSnapshotId: fixture.snapshot.id,
      candidateIds: [fixture.firstCandidate.id, fixture.secondCandidate.id],
      sampleIds: [fixture.firstCandidate.sampleId, fixture.secondCandidate.sampleId],
      purpose: "synthetic human triage",
      methodologyId: "cp_visual_methodology_001",
      requiredReviewerRoles: ["verifier"],
      secondReviewRequired: false,
      fieldCheckPolicy: "ON_REQUEST",
      filterExpression: "candidate.modelScore >= 0",
      sortExpression: "candidate.modelScore DESC",
      modelRunIds: [fixture.run.id],
      randomQaSeed: "qa-seed-001",
      priorQueueSnapshotId: changed.snapshot.id,
      createdAt: "2026-07-13T10:10:00.000Z",
    },
    serviceActor("visual_manifest_issuance"),
  );
  assert.equal(stableAfterRestart.createdNewVersion, false);
  assert.equal(stableAfterRestart.snapshot.id, changed.snapshot.id);
});

test("human rejection stays append-only and can become a rights-bounded hard negative", () => {
  const fixture = visualFixture();
  const reviewQueue = queue(fixture, [fixture.firstCandidate.id], [fixture.firstCandidate.sampleId]);
  const human = reviewer();
  const decision = fixture.authority.recordReviewDecision(
    {
      candidateId: fixture.firstCandidate.id,
      reviewQueueSnapshotId: reviewQueue.snapshot.id,
      decision: "REJECT_FALSE_POSITIVE",
      rationaleCode: "SHADOW_CONFUSER",
      reviewerConfidence: 0.99,
      reviewedAt: "2026-07-13T10:09:00.000Z",
    },
    human,
  );
  assert.equal(fixture.authority.candidateStatus(fixture.firstCandidate.id), "HUMAN_REJECTED");
  const negative = fixture.authority.registerHardNegative(
    {
      candidateId: fixture.firstCandidate.id,
      reviewDecisionId: decision.id,
      decoyType: "SHADOW",
      licensePolicy: license,
      createdAt: "2026-07-13T10:10:00.000Z",
    },
    human,
  );
  assert.equal(negative.evaluationUseAllowed, true);
  assert.equal(negative.trainingUseAllowed, false);
  assert.equal(fixture.authority.getCandidate(fixture.firstCandidate.id), fixture.firstCandidate);
  assert.equal(fixture.authority.listHardNegatives().length, 1);
});

test("known shadow decoy remains a reviewed rejected control", () => {
  const fixture = visualFixture();
  const decoy = fixture.authority.registerKnownDecoy(
    {
      name: "abstract known shadow fixture",
      decoyType: "SHADOW",
      assetRoot: hashJson({ kind: "abstract-shadow-fixture" }),
      confirmationRoot: hashJson({ kind: "field-confirmed-false-positive" }),
      evaluationUseAllowed: true,
      trainingUseAllowed: false,
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: license.id,
      createdAt: "2026-07-13T10:08:00.000Z",
    },
    reviewer(),
  );
  assert.equal(decoy.expectedDisposition, "REJECT_FALSE_POSITIVE");
  assert.equal(decoy.trainingUseAllowed, false);
  assert.equal(fixture.authority.listKnownDecoys().at(0)?.factRoot, decoy.factRoot);
});

test("cross-tenant reviewer and conflicted reviewer are denied", () => {
  const fixture = visualFixture();
  const reviewQueue = queue(fixture, [fixture.firstCandidate.id], [fixture.firstCandidate.sampleId]);
  const request = {
    candidateId: fixture.firstCandidate.id,
    reviewQueueSnapshotId: reviewQueue.snapshot.id,
    decision: "INCONCLUSIVE" as const,
    rationaleCode: "NEEDS_MORE_DATA",
    reviewerConfidence: 0.5,
    reviewedAt: "2026-07-13T10:09:00.000Z",
  };
  expectVisualError("VISUAL_AUTHORITY_MISMATCH", () =>
    fixture.authority.recordReviewDecision(
      request,
      reviewer("cp_visual_other_tenant_reviewer", { tenantId: "cp_other_tenant" }),
    ),
  );
  expectVisualError("VISUAL_REVIEWER_CONFLICT", () =>
    fixture.authority.recordReviewDecision(request, reviewer("cp_visual_conflicted_reviewer", { conflictFree: false })),
  );
});

test("field-confirmed finding requires current device attestation and stays non-evidence", () => {
  const fixture = visualFixture();
  const reviewQueue = queue(
    fixture,
    [fixture.secondCandidate.id],
    [fixture.secondCandidate.sampleId],
    { fieldRequired: true },
  );
  const human = reviewer();
  const decision = fixture.authority.recordReviewDecision(
    {
      candidateId: fixture.secondCandidate.id,
      reviewQueueSnapshotId: reviewQueue.snapshot.id,
      decision: "ACCEPT_FOR_BOUNDED_FINDING",
      rationaleCode: "VISUALLY_PLAUSIBLE_REQUIRES_FIELD",
      reviewerConfidence: 0.75,
      reviewedAt: "2026-07-13T10:09:00.000Z",
    },
    human,
  );
  expectVisualError("VISUAL_FIELD_CHECK_REQUIRED", () =>
    fixture.authority.createVisualFinding(
      {
        candidateId: fixture.secondCandidate.id,
        reviewDecisionIds: [decision.id],
        geometry: fixture.secondCandidate.geometry,
        observedAt: "2026-07-13T10:07:00.000Z",
        qualityAssessmentRoot: hashJson({ kind: "visual-quality" }),
        uncertaintyRoot: hashJson({ kind: "visual-uncertainty" }),
        createdAt: "2026-07-13T10:10:00.000Z",
      },
      human,
    ),
  );
  const task = fixture.authority.createFieldVerificationTask(
    {
      candidateId: fixture.secondCandidate.id,
      generalizedGeometry: { type: "Point", coordinates: [0, 0] },
      reason: "Methodology requires field confirmation",
      requiredObservations: ["photo", "GPS", "structure description"],
      assignedOrganizationId: organizationId,
      assignedReviewerId: human.id,
      expiresAt: "2026-07-14T10:00:00.000Z",
      createdAt: "2026-07-13T10:10:00.000Z",
    },
    serviceActor("visual_field_task_assignment"),
  );
  const fieldRequest = {
    fieldTaskId: task.id,
    gpsHash: hashJson({ kind: "field-gps" }),
    gpsAccuracyMeters: 4.5,
    observedAt: "2026-07-13T11:00:00.000Z",
    mediaRoots: [hashJson({ kind: "field-photo" })],
    notesHash: hashJson({ kind: "field-notes" }),
    deviceAttestationRoot: hashJson({ kind: "field-device-attestation" }),
    result: "CONFIRMED" as const,
  };
  expectVisualError("VISUAL_FIELD_ATTESTATION_REQUIRED", () =>
    fixture.authority.recordFieldVerificationResult(
      { ...fieldRequest, deviceAttestationCurrent: false },
      human,
    ),
  );
  const fieldResult = fixture.authority.recordFieldVerificationResult(
    { ...fieldRequest, deviceAttestationCurrent: true },
    human,
  );
  const finding = fixture.authority.createVisualFinding(
    {
      candidateId: fixture.secondCandidate.id,
      reviewDecisionIds: [decision.id],
      fieldVerificationResultId: fieldResult.id,
      geometry: fixture.secondCandidate.geometry,
      observedAt: "2026-07-13T11:00:00.000Z",
      qualityAssessmentRoot: hashJson({ kind: "visual-quality" }),
      uncertaintyRoot: hashJson({ kind: "visual-uncertainty" }),
      createdAt: "2026-07-13T11:01:00.000Z",
    },
    human,
  );
  assert.equal(finding.status, "FIELD_CHECKED");
  assert.equal(finding.boundedObservation, true);
  assert.equal(finding.evidenceVerificationState, "NOT_EVIDENCE");
  assert.equal(finding.governanceApprovalRequired, true);
});

test("unclear Ariel imagery rights fail closed for review, evaluation, and training", () => {
  const policy = createArielScansDefaultLicensePolicy("2026-07-13T00:00:00.000Z");
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const actor = serviceActor("visual_dataset_registration");
  const mission = authority.registerAcquisitionMission(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "RESTRICTED",
      licensePolicyId: policy.id,
      missionName: "Documentation-only rights test",
      platformType: "fixture",
      purpose: "rights denial",
      startedAt: "2026-07-13T12:00:00.000Z",
      geometryRef: "withheld",
      permitRoots: [],
    },
    actor,
  );
  const stream = authority.registerSensorStream(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "RESTRICTED",
      licensePolicyId: policy.id,
      createdAt: "2026-07-13T12:01:00.000Z",
      acquisitionMissionId: mission.id,
      modality: "RGB",
      make: "unknown",
      model: "unknown",
      serialCommitment: hashJson({ kind: "unknown-sensor" }),
      nativeResolution: 1,
      resolutionUnit: "meters_per_pixel",
      calibrationState: "unknown",
      clockQuality: "unknown",
      coordinateFrame: "UNKNOWN_FRAME",
      knownLimitations: ["rights not established"],
    },
    actor,
  );
  expectVisualError("VISUAL_LICENSE_DENIED", () =>
    authority.registerDataset(
      {
        datasetName: "Ariel imagery denied fixture",
        purpose: "INTERNAL_REVIEW",
        tenantId,
        organizationId,
        projectId,
        classification: "RESTRICTED",
        pairingPolicyVersion: "v1",
        sensorStreamIds: [stream.id],
        members: [
          {
            sampleId: "cp_ariel_sample_001",
            assetId: "cp_ariel_asset_001",
            assetVersion: 1,
            assetRoot: hashJson({ kind: "ariel-asset-not-copied" }),
            contentHash: hashJson({ kind: "ariel-content-not-copied" }),
            sensorStreamId: stream.id,
            pairedSampleIds: [],
            licensePolicyId: policy.id,
          },
        ],
        pairingEdgeRoots: [],
        createdAt: "2026-07-13T12:02:00.000Z",
        licensePolicy: policy,
      },
      actor,
    ),
  );
});

test("explicit policy notes cannot silently enable production evidence", () => {
  const restricted = createVisualLicensePolicy({
    version: 1,
    sourceProvider: "fixture-provider",
    sourceDataset: "fixture-dataset",
    sourceAssetRoots: [],
    rightsStatus: "VERIFIED_EXPLICIT_RIGHTS",
    rightsEvidenceRoots: [hashJson({ kind: "rights" })],
    permittedActions: ["INTERNAL_REVIEW"],
    prohibitedActions: ["PRODUCTION_EVIDENCE_INPUT"],
    modifiers: ["NO_PRODUCTION_EVIDENCE"],
    effectiveAt: "2026-07-13T00:00:00.000Z",
  });
  assert.equal(restricted.permittedActions.includes("PRODUCTION_EVIDENCE_INPUT"), false);
  assert.equal(restricted.modifiers.includes("NO_PRODUCTION_EVIDENCE"), true);
});
