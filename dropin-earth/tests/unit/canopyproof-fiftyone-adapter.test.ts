import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  assertFiftyOneActionAllowed,
  createFiftyOneReviewManifest,
  verifyFiftyOneReviewManifest,
  type FiftyOneManifestReplayGuard,
  type FiftyOneManifestSigner,
  type FiftyOneManifestVerifier,
} from "../../integrations/fiftyone/adapter/manifest.js";
import {
  CanopyProofVisualEvidenceAuthorityService,
  createVisualServiceActor,
} from "../../services/api/src/domain/canopyproof/visual-evidence-intelligence.js";
import {
  createVineLidarLabLicensePolicy,
  evaluateVisualLicenseAction,
} from "../../services/api/src/domain/canopyproof/visual-license-policy.js";
import type {
  CandidateFinding,
  ReviewQueueSnapshot,
  VisualServiceActor,
} from "../../services/api/src/domain/canopyproof/visual-evidence-types.js";

const tenantId = "cp_fiftyone_tenant";
const organizationId = "cp_fiftyone_org";
const projectId = "cp_fiftyone_project";
const policy = createVineLidarLabLicensePolicy("2026-07-13T00:00:00.000Z");

function actor(capability: VisualServiceActor["capability"]): VisualServiceActor {
  return createVisualServiceActor({
    id: `cp_fiftyone_service_${capability}`,
    actorType: "service",
    tenantId,
    organizationId,
    capability,
  });
}

function queueFixture(): { queue: ReviewQueueSnapshot; candidate: CandidateFinding; issuer: VisualServiceActor } {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const datasetActor = actor("visual_dataset_registration");
  const mission = authority.registerAcquisitionMission(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: policy.id,
      missionName: "FiftyOne synthetic fixture",
      platformType: "fixture",
      purpose: "manifest security tests",
      startedAt: "2026-07-13T14:00:00.000Z",
      geometryRef: "generalized",
      permitRoots: [],
    },
    datasetActor,
  );
  const stream = authority.registerSensorStream(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: policy.id,
      createdAt: "2026-07-13T14:01:00.000Z",
      acquisitionMissionId: mission.id,
      modality: "RGB",
      make: "Synthetic",
      model: "Fixture",
      serialCommitment: hashJson({ kind: "fiftyone-sensor" }),
      nativeResolution: 5,
      resolutionUnit: "centimeters_per_pixel",
      altitudeRangeMeters: [10, 30],
      calibrationState: "calibrated",
      clockQuality: "verified",
      coordinateFrame: "ABSOLUTE_CRS",
      knownLimitations: [],
    },
    datasetActor,
  );
  const dataset = authority.registerDataset(
    {
      datasetName: "FiftyOne fixture",
      purpose: "LAB_BENCHMARK",
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      pairingPolicyVersion: "v1",
      sensorStreamIds: [stream.id],
      members: [
        {
          sampleId: "cp_fiftyone_sample_001",
          assetId: "cp_fiftyone_asset_001",
          assetVersion: 1,
          assetRoot: hashJson({ kind: "fiftyone-asset" }),
          contentHash: hashJson({ kind: "fiftyone-content" }),
          sensorStreamId: stream.id,
          pairedSampleIds: [],
          licensePolicyId: policy.id,
        },
      ],
      pairingEdgeRoots: [],
      createdAt: "2026-07-13T14:02:00.000Z",
      licensePolicy: policy,
    },
    datasetActor,
  );
  const modelActor = actor("visual_model_execution");
  const model = authority.registerModelDefinition(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId: policy.id,
      createdAt: "2026-07-13T14:03:00.000Z",
      name: "FiftyOne fixture detector",
      modelFamily: "fixture",
      artifactHash: hashJson({ kind: "fiftyone-model" }),
      containerDigest: hashJson({ kind: "fiftyone-container" }),
      sbomHash: hashJson({ kind: "fiftyone-sbom" }),
      preprocessingContractHash: hashJson({ kind: "fiftyone-preprocess" }),
      outputSchemaVersion: "v1",
      domainPolicy: {
        supportedSensors: ["RGB"],
        supportedResolutionRange: [1, 10],
        supportedResolutionUnit: "centimeters_per_pixel",
        supportedAltitudeRange: [10, 30],
        supportedSeasons: ["summer"],
        supportedEcosystems: ["vineyard"],
        supportedGeographies: ["fixture"],
        requiresCalibration: true,
        knownLimitations: [],
        calibrationDatasetRefs: [dataset.snapshot.id],
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
    geography: "fixture",
    calibrationState: "calibrated" as const,
  };
  const run = authority.recordModelRun(
    {
      modelDefinitionId: model.id,
      datasetSnapshotId: dataset.snapshot.id,
      sourceDomain,
      canonicalParametersHash: hashJson({ threshold: 0.5 }),
      runtimeDigest: hashJson({ kind: "fiftyone-runtime" }),
      startedAt: "2026-07-13T14:04:00.000Z",
      completedAt: "2026-07-13T14:05:00.000Z",
      outputRoot: hashJson({ kind: "fiftyone-output" }),
      licensePolicy: policy,
    },
    modelActor,
  );
  const candidate = authority.recordCandidate(
    {
      modelRunId: run.id,
      sampleId: "cp_fiftyone_sample_001",
      geometry: { type: "Point", coordinates: [0, 0] },
      modelScore: 0.75,
      sensorDomain: sourceDomain,
      createdAt: "2026-07-13T14:06:00.000Z",
    },
    actor("visual_candidate_import"),
  );
  const issuer = actor("visual_manifest_issuance");
  const queue = authority.createReviewQueue(
    {
      datasetSnapshotId: dataset.snapshot.id,
      candidateIds: [candidate.id],
      sampleIds: [candidate.sampleId],
      purpose: "manifest fixture",
      methodologyId: "cp_fiftyone_methodology_001",
      requiredReviewerRoles: ["verifier"],
      secondReviewRequired: false,
      fieldCheckPolicy: "ON_REQUEST",
      filterExpression: "candidate.modelScore >= 0",
      sortExpression: "candidate.modelScore DESC",
      modelRunIds: [run.id],
      createdAt: "2026-07-13T14:07:00.000Z",
    },
    issuer,
  );
  return { queue: queue.snapshot, candidate, issuer };
}

class DigestSignature implements FiftyOneManifestSigner, FiftyOneManifestVerifier {
  readonly keyId = "cp_managed_key_test_001";

  async sign(payload: Uint8Array) {
    return createHash("sha256").update(payload).update(this.keyId).digest("hex");
  }

  async verify(input: Readonly<{ keyId: string; payload: Uint8Array; signature: string }>) {
    return input.keyId === this.keyId && input.signature === (await this.sign(input.payload));
  }
}

class InMemoryReplayGuard implements FiftyOneManifestReplayGuard {
  private readonly used = new Set<string>();

  async consume(input: Readonly<{ nonce: string; manifestId: string; subjectId: string; expiresAt: string }>) {
    const key = `${input.nonce}|${input.manifestId}|${input.subjectId}|${input.expiresAt}`;
    if (this.used.has(key)) return false;
    this.used.add(key);
    return true;
  }
}

async function manifestFixture() {
  const fixture = queueFixture();
  const signature = new DigestSignature();
  const licenseDecision = evaluateVisualLicenseAction(policy, "INTERNAL_REVIEW", "2026-07-13T14:08:00.000Z", {
    attributionIncluded: true,
  });
  const manifest = await createFiftyOneReviewManifest(
    {
      queueSnapshot: fixture.queue,
      candidates: [fixture.candidate],
      samples: [
        {
          sampleId: fixture.candidate.sampleId,
          candidateIds: [fixture.candidate.id],
          mediaHandle: "/internal/canopyproof/visual-media/fixture_media_handle_001",
          assetRoot: fixture.candidate.assetRoot,
          modality: "RGB",
          locationDisclosure: "GENERALIZED",
        },
      ],
      reviewerSubjectId: "cp_fiftyone_reviewer_001",
      allowedActions: ["LOAD_REVIEW_QUEUE", "INSPECT_CANDIDATE_PROVENANCE", "APPEND_REVIEW_DECISION"],
      classificationCeiling: "INTERNAL",
      licenseDecision,
      issuedAt: "2026-07-13T14:08:00.000Z",
      expiresAt: "2026-07-13T14:18:00.000Z",
      nonce: "fiftyone-manifest-nonce-0001",
    },
    fixture.issuer,
    signature,
  );
  return { ...fixture, signature, manifest };
}

test("FiftyOne manifest is short-lived, queue-bound, credential-free, and verifiable", async () => {
  const fixture = await manifestFixture();
  assert.equal(JSON.stringify(fixture.manifest).includes("database"), false);
  assert.equal(JSON.stringify(fixture.manifest).includes("bucket"), false);
  assert.equal(JSON.stringify(fixture.manifest).includes("https://"), false);
  assert.equal(fixture.manifest.reviewQueueHash, fixture.queue.reviewQueueHash);
  const verified = await verifyFiftyOneReviewManifest(fixture.manifest, {
    now: "2026-07-13T14:09:00.000Z",
    subjectId: "cp_fiftyone_reviewer_001",
    queueSnapshot: fixture.queue,
    verifier: fixture.signature,
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.reviewQueueSnapshotId, fixture.queue.id);
});

test("FiftyOne manifest rejects queue drift, subject mismatch, expiry, tampering, and replay", async () => {
  const fixture = await manifestFixture();
  await assert.rejects(
    verifyFiftyOneReviewManifest(fixture.manifest, {
      now: "2026-07-13T14:09:00.000Z",
      subjectId: "cp_other_reviewer",
      queueSnapshot: fixture.queue,
      verifier: fixture.signature,
    }),
    /subject mismatch/,
  );
  await assert.rejects(
    verifyFiftyOneReviewManifest(fixture.manifest, {
      now: "2026-07-13T14:18:00.000Z",
      subjectId: "cp_fiftyone_reviewer_001",
      queueSnapshot: fixture.queue,
      verifier: fixture.signature,
    }),
    /not currently valid/,
  );
  await assert.rejects(
    verifyFiftyOneReviewManifest(
      { ...fixture.manifest, reviewQueueHash: hashJson({ kind: "tampered-queue" }) },
      {
        now: "2026-07-13T14:09:00.000Z",
        subjectId: "cp_fiftyone_reviewer_001",
        queueSnapshot: fixture.queue,
        verifier: fixture.signature,
      },
    ),
    /queue or dataset hash mismatch/,
  );
  const guard = new InMemoryReplayGuard();
  await verifyFiftyOneReviewManifest(fixture.manifest, {
    now: "2026-07-13T14:09:00.000Z",
    subjectId: "cp_fiftyone_reviewer_001",
    queueSnapshot: fixture.queue,
    verifier: fixture.signature,
    replayGuard: guard,
  });
  await assert.rejects(
    verifyFiftyOneReviewManifest(fixture.manifest, {
      now: "2026-07-13T14:09:00.000Z",
      subjectId: "cp_fiftyone_reviewer_001",
      queueSnapshot: fixture.queue,
      verifier: fixture.signature,
      replayGuard: guard,
    }),
    /already consumed or revoked/,
  );
});

test("FiftyOne plugin capability cannot verify proof, publish ESG, release funding, or mutate raw evidence", async () => {
  const fixture = await manifestFixture();
  assert.equal(
    assertFiftyOneActionAllowed(fixture.manifest, {
      action: "APPEND_REVIEW_DECISION",
      subjectId: fixture.manifest.subjectId,
      now: "2026-07-13T14:09:00.000Z",
    }),
    true,
  );
  for (const action of [
    "VERIFY_ENVIRONMENTAL_PROOF",
    "ISSUE_CERTIFICATE",
    "PUBLISH_ESG_METRIC",
    "RELEASE_FUNDING",
    "MODIFY_RAW_EVIDENCE",
  ] as const) {
    assert.throws(
      () =>
        assertFiftyOneActionAllowed(fixture.manifest, {
          action,
          subjectId: fixture.manifest.subjectId,
          now: "2026-07-13T14:09:00.000Z",
        }),
      /permanently forbidden/,
    );
  }
});

test("FiftyOne manifest input rejects secret-bearing extensions and long lifetimes", async () => {
  const fixture = queueFixture();
  const signature = new DigestSignature();
  const licenseDecision = evaluateVisualLicenseAction(policy, "INTERNAL_REVIEW", "2026-07-13T14:08:00.000Z", {
    attributionIncluded: true,
  });
  await assert.rejects(
    createFiftyOneReviewManifest(
      {
        queueSnapshot: fixture.queue,
        candidates: [fixture.candidate],
        samples: [
          {
            sampleId: fixture.candidate.sampleId,
            candidateIds: [fixture.candidate.id],
            mediaHandle: "/internal/canopyproof/visual-media/fixture_media_handle_001",
            assetRoot: fixture.candidate.assetRoot,
            modality: "RGB",
            locationDisclosure: "WITHHELD",
            ["access" + "Token"]: "must-never-enter-manifest",
          } as never,
        ],
        reviewerSubjectId: "cp_fiftyone_reviewer_001",
        allowedActions: ["LOAD_REVIEW_QUEUE"],
        classificationCeiling: "INTERNAL",
        licenseDecision,
        issuedAt: "2026-07-13T14:08:00.000Z",
        expiresAt: "2026-07-13T14:18:00.000Z",
        nonce: "fiftyone-manifest-nonce-0002",
      },
      fixture.issuer,
      signature,
    ),
    /forbidden key/,
  );
  await assert.rejects(
    createFiftyOneReviewManifest(
      {
        queueSnapshot: fixture.queue,
        candidates: [fixture.candidate],
        samples: [
          {
            sampleId: fixture.candidate.sampleId,
            candidateIds: [fixture.candidate.id],
            mediaHandle: "/internal/canopyproof/visual-media/fixture_media_handle_001",
            assetRoot: fixture.candidate.assetRoot,
            modality: "RGB",
            locationDisclosure: "WITHHELD",
          },
        ],
        reviewerSubjectId: "cp_fiftyone_reviewer_001",
        allowedActions: ["LOAD_REVIEW_QUEUE"],
        classificationCeiling: "INTERNAL",
        licenseDecision,
        issuedAt: "2026-07-13T14:08:00.000Z",
        expiresAt: "2026-07-13T14:30:00.000Z",
        nonce: "fiftyone-manifest-nonce-0003",
      },
      fixture.issuer,
      signature,
    ),
    /exceeds 15 minutes/,
  );
});
