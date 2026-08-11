import assert from "node:assert/strict";
import test from "node:test";
import {
  createFiftyOneManifestRequestSchema,
  createVisualDatasetRequestSchema,
  createVisualReviewDecisionRequestSchema,
  visualEvidenceApiContracts,
  visualEvidenceApiStatus,
} from "../../services/api/src/domain/canopyproof/visual-evidence-api.js";
import {
  CanopyProofVisualEvidenceMetrics,
  visualEvidenceCounterNames,
  visualEvidenceQualityMetricNames,
} from "../../services/api/src/domain/canopyproof/visual-evidence-observability.js";

test("visual API contracts expose the required routes but remain unmounted", () => {
  const routes = new Set(visualEvidenceApiContracts.map((contract) => `${contract.method} ${contract.path}`));
  for (const route of [
    "POST /canopyproof/visual-datasets",
    "GET /canopyproof/visual-datasets/:id",
    "POST /canopyproof/visual-datasets/:id/model-runs",
    "POST /canopyproof/visual-datasets/:id/review-queues",
    "GET /canopyproof/review-queues/:id",
    "POST /canopyproof/visual-candidates/:id/reviews",
    "POST /canopyproof/visual-candidates/:id/field-checks",
    "POST /canopyproof/visual-candidates/:id/hard-negative",
    "GET /canopyproof/visual-datasets/:id/fiftyone-manifest",
  ]) {
    assert.equal(routes.has(route), true, `missing visual API contract: ${route}`);
  }
  const status = visualEvidenceApiStatus();
  assert.equal(status.mounted, false);
  assert.equal(status.externallyReachable, false);
  assert.equal(status.requiresAuthentication, true);
  assert.equal(status.requiresAuthorization, true);
  assert.equal(status.requiresTenantCheck, true);
  assert.equal(status.requiresLicenseCheck, true);
  assert.equal(status.requiresAuditEvent, true);
  assert.equal(status.deploymentAuthorized, false);
});

test("visual API mutation schemas reject caller-supplied authority and unknown fields", () => {
  const datasetBody = {
    idempotencyKey: "visual-dataset-idempotency-0001",
    projectId: "cp_project_001",
    name: "Synthetic fixture",
    purpose: "LAB_BENCHMARK",
    classification: "INTERNAL",
    pairingPolicyVersion: "v1",
    sensorStreamIds: ["cp_sensor_001"],
    members: [
      {
        sampleId: "cp_sample_001",
        assetId: "cp_asset_001",
        assetVersion: 1,
        assetRoot: "a".repeat(64),
        contentHash: "b".repeat(64),
        sensorStreamId: "cp_sensor_001",
        pairedSampleIds: [],
        licensePolicyId: "cp_license_001",
      },
    ],
    pairingEdgeRoots: [],
    licensePolicyId: "cp_license_001",
    createdAt: "2026-07-13T15:00:00.000Z",
  };
  assert.equal(createVisualDatasetRequestSchema.safeParse(datasetBody).success, true);
  for (const authorityField of [
    { actor: "api-admin" },
    { actorId: "cp_admin" },
    { role: "admin" },
    { tenantId: "cp_other_tenant" },
    { organizationId: "cp_other_org" },
    { verified: true },
    { auditEvent: { forged: true } },
  ]) {
    assert.equal(createVisualDatasetRequestSchema.safeParse({ ...datasetBody, ...authorityField }).success, false);
  }

  const review = {
    idempotencyKey: "visual-review-idempotency-0001",
    reviewQueueSnapshotId: "cp_queue_snapshot_001",
    decision: "REJECT_FALSE_POSITIVE",
    rationaleCode: "SHADOW",
    reviewerConfidence: 0.9,
    reviewedAt: "2026-07-13T15:01:00.000Z",
  };
  assert.equal(createVisualReviewDecisionRequestSchema.safeParse(review).success, true);
  assert.equal(
    createVisualReviewDecisionRequestSchema.safeParse({ ...review, evidenceVerificationState: "VERIFIED" }).success,
    false,
  );
  assert.equal(
    createVisualReviewDecisionRequestSchema.safeParse({ ...review, issueCertificate: true }).success,
    false,
  );
});

test("FiftyOne manifest API accepts only allowlisted review actions", () => {
  const base = {
    reviewQueueSnapshotId: "cp_queue_snapshot_001",
    nonce: "manifest-nonce-idempotency-0001",
    requestedActions: ["LOAD_REVIEW_QUEUE", "APPEND_REVIEW_DECISION"],
  };
  assert.equal(createFiftyOneManifestRequestSchema.safeParse(base).success, true);
  for (const action of ["ISSUE_CERTIFICATE", "PUBLISH_ESG_METRIC", "RELEASE_FUNDING", "MODIFY_RAW_EVIDENCE"]) {
    assert.equal(createFiftyOneManifestRequestSchema.safeParse({ ...base, requestedActions: [action] }).success, false);
  }
  assert.equal(
    createFiftyOneManifestRequestSchema.safeParse({ ...base, storageCredentials: { key: "secret" } }).success,
    false,
  );
});

test("visual observability implements every required low-cardinality metric", () => {
  const metrics = new CanopyProofVisualEvidenceMetrics();
  for (const counter of visualEvidenceCounterNames) metrics.increment(counter, "completed");
  for (const quality of visualEvidenceQualityMetricNames) {
    metrics.observe(quality, quality === "median_review_time" ? 42 : 0.25, "2026-07-13T15:00:00.000Z");
  }
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.counters.length, visualEvidenceCounterNames.length);
  assert.equal(snapshot.quality.length, visualEvidenceQualityMetricNames.length);
  assert.equal(snapshot.privacy.noTenantLabels, true);
  assert.equal(snapshot.privacy.noAssetLabels, true);
  assert.equal(snapshot.privacy.noCoordinates, true);
  const rendered = metrics.renderPrometheus();
  for (const name of [...visualEvidenceCounterNames, ...visualEvidenceQualityMetricNames]) {
    assert.match(rendered, new RegExp(`canopyproof_${name}`));
  }
  assert.doesNotMatch(rendered, /\{[^}]*\b(?:tenant|project|asset|latitude|longitude|sample)=/i);
});

test("visual quality metric bounds reject invalid rates and counters", () => {
  const metrics = new CanopyProofVisualEvidenceMetrics();
  assert.throws(() => metrics.increment("model_runs_total", "completed", 0), /positive safe integer/);
  assert.throws(
    () => metrics.observe("false_positive_rate", 1.01, "2026-07-13T15:00:00.000Z"),
    /between 0 and 1/,
  );
  assert.throws(
    () => metrics.observe("median_review_time", -1, "2026-07-13T15:00:00.000Z"),
    /finite and non-negative/,
  );
});
