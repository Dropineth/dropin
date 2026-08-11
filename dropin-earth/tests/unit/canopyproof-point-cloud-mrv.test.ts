import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  assertPointCloudComparisonAllowed,
  assertReviewPointCloudCannotReplaceAuthoritative,
  createPointCloudComparisonPlan,
  PointCloudMrvError,
} from "../../services/api/src/domain/canopyproof/point-cloud-mrv.js";
import {
  CanopyProofVisualEvidenceAuthorityService,
  createVisualServiceActor,
  VisualEvidenceError,
} from "../../services/api/src/domain/canopyproof/visual-evidence-intelligence.js";
import type {
  PointCloudAsset,
  VisualServiceActor,
  VisualUncertaintyComponent,
} from "../../services/api/src/domain/canopyproof/visual-evidence-types.js";

const tenantId = "cp_point_cloud_tenant";
const organizationId = "cp_point_cloud_org";
const projectId = "cp_point_cloud_project";
const licensePolicyId = "cp_visual_license_point_cloud_fixture";

function actor(): VisualServiceActor {
  return createVisualServiceActor({
    id: "cp_point_cloud_registration_service",
    actorType: "service",
    tenantId,
    organizationId,
    capability: "visual_dataset_registration",
  });
}

function registerPointCloud(
  authority: CanopyProofVisualEvidenceAuthorityService,
  input: Readonly<{
    terraProofAssetId: string;
    objectVersion: string;
    contentHash: string;
    format: "LAZ" | "COPC" | "PCD";
    role: "RAW_AUTHORITATIVE" | "NORMALIZED_AUTHORITATIVE" | "REVIEW_DERIVATIVE";
    coordinateFrame: "ABSOLUTE_CRS" | "LOCAL_UNREGISTERED";
    sourceRoots?: readonly string[];
    createdAt: string;
  }>,
): PointCloudAsset {
  const absolute = input.coordinateFrame === "ABSOLUTE_CRS";
  return authority.registerPointCloudAsset(
    {
      tenantId,
      organizationId,
      projectId,
      classification: "INTERNAL",
      licensePolicyId,
      createdAt: input.createdAt,
      terraProofAssetId: input.terraProofAssetId,
      format: input.format,
      assetRole: input.role,
      objectVersion: input.objectVersion,
      contentHash: input.contentHash,
      byteLength: 2_000_000,
      pointCount: 100_000,
      dimensions: ["X", "Y", "Z", "Intensity", "Red", "Green", "Blue"],
      ...(absolute
        ? {
            crs: "EPSG:32629",
            crsWkt: 'PROJCRS["WGS 84 / UTM zone 29N"]',
            verticalDatum: "UNKNOWN",
          }
        : {}),
      horizontalUnit: "metre",
      verticalUnit: "metre",
      coordinateFrame: input.coordinateFrame,
      bounds: [500_000, 4_600_000, 10, 500_100, 4_600_100, 40],
      scale: [0.001, 0.001, 0.001],
      offset: [500_000, 4_600_000, 0],
      sourcePointCloudRoots: input.sourceRoots ?? [],
      qualityAssessmentRoot: hashJson({ kind: "point-cloud-quality", id: input.terraProofAssetId }),
      uncertaintyRoot: hashJson({ kind: "point-cloud-uncertainty", id: input.terraProofAssetId }),
    },
    actor(),
  );
}

test("local-frame and absolute-CRS point clouds cannot be compared without registration", () => {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const local = registerPointCloud(authority, {
    terraProofAssetId: "tp_local_laz",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "local-laz" }),
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "LOCAL_UNREGISTERED",
    createdAt: "2026-07-13T13:00:00.000Z",
  });
  const absolute = registerPointCloud(authority, {
    terraProofAssetId: "tp_absolute_laz",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "absolute-laz" }),
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    createdAt: "2026-07-13T13:01:00.000Z",
  });
  assert.throws(
    () => assertPointCloudComparisonAllowed(local, absolute),
    (error: unknown) => error instanceof PointCloudMrvError && error.code === "POINT_CLOUD_UNREGISTERED_FRAME",
  );
});

test("PCD review copy cannot replace authoritative LAZ or COPC", () => {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const raw = registerPointCloud(authority, {
    terraProofAssetId: "tp_authoritative_laz",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "authoritative-laz" }),
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    createdAt: "2026-07-13T13:10:00.000Z",
  });
  const review = registerPointCloud(authority, {
    terraProofAssetId: "tp_review_pcd",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "review-pcd" }),
    format: "PCD",
    role: "REVIEW_DERIVATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    sourceRoots: [raw.factRoot],
    createdAt: "2026-07-13T13:11:00.000Z",
  });
  assert.equal(review.assetRole, "REVIEW_DERIVATIVE");
  assert.equal(review.sourcePointCloudRoots.includes(raw.factRoot), true);
  assert.throws(
    () => assertReviewPointCloudCannotReplaceAuthoritative(review, raw),
    (error: unknown) =>
      error instanceof PointCloudMrvError && error.code === "POINT_CLOUD_REVIEW_COPY_NOT_AUTHORITATIVE",
  );
});

test("raw LAZ object version cannot be rebound to mutated bytes", () => {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const first = registerPointCloud(authority, {
    terraProofAssetId: "tp_immutable_laz",
    objectVersion: "provider-version-001",
    contentHash: hashJson({ kind: "immutable-laz", revision: 1 }),
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    createdAt: "2026-07-13T13:20:00.000Z",
  });
  const replay = registerPointCloud(authority, {
    terraProofAssetId: "tp_immutable_laz",
    objectVersion: "provider-version-001",
    contentHash: first.contentHash,
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    createdAt: "2026-07-13T13:21:00.000Z",
  });
  assert.equal(replay.id, first.id);
  assert.throws(
    () =>
      registerPointCloud(authority, {
        terraProofAssetId: "tp_immutable_laz",
        objectVersion: "provider-version-001",
        contentHash: hashJson({ kind: "immutable-laz", revision: 2 }),
        format: "LAZ",
        role: "RAW_AUTHORITATIVE",
        coordinateFrame: "ABSOLUTE_CRS",
        createdAt: "2026-07-13T13:22:00.000Z",
      }),
    (error: unknown) =>
      error instanceof VisualEvidenceError && error.code === "VISUAL_IMMUTABILITY_VIOLATION",
  );
});

test("cross-season comparison carries acquisition, registration, sampling, and temporal uncertainty", () => {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const rawSpring = registerPointCloud(authority, {
    terraProofAssetId: "tp_spring_laz",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "spring-laz" }),
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    createdAt: "2026-07-13T13:30:00.000Z",
  });
  const rawSummer = registerPointCloud(authority, {
    terraProofAssetId: "tp_summer_laz",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "summer-laz" }),
    format: "LAZ",
    role: "RAW_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    createdAt: "2026-07-13T13:31:00.000Z",
  });
  const spring = registerPointCloud(authority, {
    terraProofAssetId: "tp_spring_copc",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "spring-copc" }),
    format: "COPC",
    role: "NORMALIZED_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    sourceRoots: [rawSpring.factRoot],
    createdAt: "2026-07-13T13:32:00.000Z",
  });
  const summer = registerPointCloud(authority, {
    terraProofAssetId: "tp_summer_copc",
    objectVersion: "v1",
    contentHash: hashJson({ kind: "summer-copc" }),
    format: "COPC",
    role: "NORMALIZED_AUTHORITATIVE",
    coordinateFrame: "ABSOLUTE_CRS",
    sourceRoots: [rawSummer.factRoot],
    createdAt: "2026-07-13T13:33:00.000Z",
  });
  const uncertainty: readonly VisualUncertaintyComponent[] = [
    { code: "REGISTRATION", state: "KNOWN", value: 0.12, unit: "metre", method: "control residuals" },
    { code: "ACQUISITION", state: "KNOWN", value: 0.08, unit: "metre", method: "sensor specification" },
    { code: "SAMPLING", state: "KNOWN", value: 0.2, unit: "metre", method: "density sensitivity" },
    { code: "TEMPORAL", state: "UNKNOWN", method: "phenology unavailable" },
  ];
  const plan = createPointCloudComparisonPlan({
    left: spring,
    right: summer,
    leftContext: {
      acquiredAt: "2026-04-15T10:00:00.000Z",
      season: "spring",
      sensorStreamRoot: hashJson({ kind: "spring-sensor" }),
      altitudeMeters: 20,
      densityPointsPerSquareMeter: 150,
    },
    rightContext: {
      acquiredAt: "2026-07-15T10:00:00.000Z",
      season: "summer",
      sensorStreamRoot: hashJson({ kind: "summer-sensor" }),
      altitudeMeters: 30,
      densityPointsPerSquareMeter: 90,
    },
    comparableObservationMaskRoot: hashJson({ kind: "comparable-mask" }),
    uncertaintyComponents: uncertainty,
  });
  assert.equal(plan.unknownRequiredComponent, true);
  assert.equal(plan.boundedInterpretationRequired, true);
  assert.notEqual(plan.planRoot, "");
  assert.throws(
    () =>
      createPointCloudComparisonPlan({
        left: spring,
        right: summer,
        leftContext: plan.leftContext,
        rightContext: plan.rightContext,
        comparableObservationMaskRoot: plan.comparableObservationMaskRoot,
        uncertaintyComponents: uncertainty.filter((component) => component.code !== "TEMPORAL"),
      }),
    (error: unknown) =>
      error instanceof PointCloudMrvError && error.code === "POINT_CLOUD_UNCERTAINTY_INCOMPLETE",
  );
});
