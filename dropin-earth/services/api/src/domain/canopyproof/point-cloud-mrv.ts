import { hashJson } from "@dropin/crypto";
import type {
  PointCloudAsset,
  RegistrationRecord,
  VisualProvenanceEdge,
  VisualUncertaintyComponent,
} from "./visual-evidence-types.js";

export const pointCloudMrvErrorCodes = [
  "POINT_CLOUD_INVALID_FORMAT_ROLE",
  "POINT_CLOUD_INVALID_POINT_COUNT",
  "POINT_CLOUD_INVALID_BOUNDS",
  "POINT_CLOUD_INVALID_SCALE_OFFSET",
  "POINT_CLOUD_MISSING_CRS",
  "POINT_CLOUD_UNREGISTERED_FRAME",
  "POINT_CLOUD_INCOMPATIBLE_UNITS",
  "POINT_CLOUD_INCOMPATIBLE_BODY",
  "POINT_CLOUD_REVIEW_COPY_NOT_AUTHORITATIVE",
  "POINT_CLOUD_LINEAGE_INCOMPLETE",
  "POINT_CLOUD_LINEAGE_CYCLE",
  "POINT_CLOUD_UNCERTAINTY_INCOMPLETE",
] as const;

export type PointCloudMrvErrorCode = (typeof pointCloudMrvErrorCodes)[number];

export class PointCloudMrvError extends Error {
  constructor(
    readonly code: PointCloudMrvErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "PointCloudMrvError";
  }
}

function finiteTuple(values: readonly number[], expectedLength: number, field: string) {
  if (values.length !== expectedLength || values.some((value) => !Number.isFinite(value))) {
    throw new PointCloudMrvError("POINT_CLOUD_INVALID_BOUNDS", `${field} must contain ${expectedLength} finite values.`);
  }
}

function assertPositiveFinite(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new PointCloudMrvError("POINT_CLOUD_INVALID_SCALE_OFFSET", `${field} must be positive and finite.`);
  }
}

function assertRegistrationRecord(registration: RegistrationRecord, expectedSourceRoot: string) {
  if (registration.sourceAssetRoot !== expectedSourceRoot) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_UNREGISTERED_FRAME",
      "registration does not bind the exact source asset root.",
    );
  }
  if (registration.transformMatrix.length !== 16 || registration.transformMatrix.some((value) => !Number.isFinite(value))) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_UNREGISTERED_FRAME",
      "registration transform must be a finite 4x4 matrix.",
    );
  }
  if (
    !Number.isFinite(registration.horizontalResidualMeters) ||
    registration.horizontalResidualMeters < 0 ||
    !Number.isFinite(registration.verticalResidualMeters) ||
    registration.verticalResidualMeters < 0 ||
    !Number.isFinite(registration.overlapRatio) ||
    registration.overlapRatio <= 0 ||
    registration.overlapRatio > 1
  ) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_UNREGISTERED_FRAME",
      "registration residuals and overlap must be finite and physically bounded.",
    );
  }
  const expectedRoot = hashJson({
    kind: "canopyproof-point-cloud-registration-v1",
    id: registration.id,
    sourceAssetRoot: registration.sourceAssetRoot,
    targetFrameRoot: registration.targetFrameRoot,
    transformMatrix: registration.transformMatrix,
    method: registration.method,
    horizontalResidualMeters: registration.horizontalResidualMeters,
    verticalResidualMeters: registration.verticalResidualMeters,
    overlapRatio: registration.overlapRatio,
    uncertaintyRoot: registration.uncertaintyRoot,
    reviewedBy: registration.reviewedBy,
    reviewedAt: registration.reviewedAt,
  });
  if (registration.registrationRoot !== expectedRoot) {
    throw new PointCloudMrvError("POINT_CLOUD_UNREGISTERED_FRAME", "registration root does not match its content.");
  }
}

export function createPointCloudRegistrationRecord(
  input: Omit<RegistrationRecord, "id" | "registrationRoot"> & { readonly id?: string },
): RegistrationRecord {
  const seed = {
    sourceAssetRoot: input.sourceAssetRoot,
    targetFrameRoot: input.targetFrameRoot,
    transformMatrix: [...input.transformMatrix],
    method: input.method.trim(),
    horizontalResidualMeters: input.horizontalResidualMeters,
    verticalResidualMeters: input.verticalResidualMeters,
    overlapRatio: input.overlapRatio,
    uncertaintyRoot: input.uncertaintyRoot,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date(input.reviewedAt).toISOString(),
  };
  const idSeed = hashJson({ kind: "canopyproof-point-cloud-registration-id-v1", ...seed });
  const id = input.id?.trim() || `cp_pc_registration_${idSeed.slice(0, 24)}`;
  const registrationRoot = hashJson({ kind: "canopyproof-point-cloud-registration-v1", id, ...seed });
  const registration = { id, ...seed, registrationRoot };
  assertRegistrationRecord(registration, input.sourceAssetRoot);
  return registration;
}

export function validatePointCloudAssetContract(asset: PointCloudAsset) {
  if (
    (asset.format === "LAZ" && asset.assetRole !== "RAW_AUTHORITATIVE") ||
    (asset.format === "COPC" && asset.assetRole !== "NORMALIZED_AUTHORITATIVE") ||
    (asset.format === "PCD" && asset.assetRole !== "REVIEW_DERIVATIVE")
  ) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_INVALID_FORMAT_ROLE",
      `${asset.format} is incompatible with role ${asset.assetRole}.`,
    );
  }
  if (!Number.isSafeInteger(asset.pointCount) || asset.pointCount <= 0) {
    throw new PointCloudMrvError("POINT_CLOUD_INVALID_POINT_COUNT", "point count must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0) {
    throw new PointCloudMrvError("POINT_CLOUD_INVALID_POINT_COUNT", "byte length must be a positive safe integer.");
  }
  finiteTuple(asset.bounds, 6, "bounds");
  if (asset.bounds[0] > asset.bounds[3] || asset.bounds[1] > asset.bounds[4] || asset.bounds[2] > asset.bounds[5]) {
    throw new PointCloudMrvError("POINT_CLOUD_INVALID_BOUNDS", "minimum bounds cannot exceed maximum bounds.");
  }
  finiteTuple(asset.scale, 3, "scale");
  finiteTuple(asset.offset, 3, "offset");
  asset.scale.forEach((value, index) => assertPositiveFinite(value, `scale[${index}]`));
  if (asset.coordinateFrame === "ABSOLUTE_CRS" && (!asset.crs?.trim() || !asset.crsWkt?.trim())) {
    throw new PointCloudMrvError("POINT_CLOUD_MISSING_CRS", "absolute assets require CRS identifier and WKT.");
  }
  if (asset.coordinateFrame === "LOCAL_REGISTERED") {
    if (!asset.registration) {
      throw new PointCloudMrvError("POINT_CLOUD_UNREGISTERED_FRAME", "registered local frame requires registration.");
    }
    const registrationSourceRoot = asset.sourcePointCloudRoots.at(0);
    if (!registrationSourceRoot) {
      throw new PointCloudMrvError(
        "POINT_CLOUD_LINEAGE_INCOMPLETE",
        "registered local-frame derivative must retain its unregistered source root.",
      );
    }
    assertRegistrationRecord(asset.registration, registrationSourceRoot);
  }
  if (asset.format === "COPC" && asset.sourcePointCloudRoots.length === 0) {
    throw new PointCloudMrvError("POINT_CLOUD_LINEAGE_INCOMPLETE", "COPC must retain source LAZ roots.");
  }
  if (asset.format === "PCD" && asset.sourcePointCloudRoots.length === 0) {
    throw new PointCloudMrvError("POINT_CLOUD_LINEAGE_INCOMPLETE", "PCD review derivative must retain authoritative source roots.");
  }
  return asset;
}

export function assertReviewPointCloudCannotReplaceAuthoritative(
  candidate: PointCloudAsset,
  authoritative: PointCloudAsset,
) {
  validatePointCloudAssetContract(candidate);
  validatePointCloudAssetContract(authoritative);
  if (candidate.assetRole === "REVIEW_DERIVATIVE" || candidate.format === "PCD") {
    throw new PointCloudMrvError(
      "POINT_CLOUD_REVIEW_COPY_NOT_AUTHORITATIVE",
      `review asset ${candidate.id} cannot replace authoritative asset ${authoritative.id}.`,
    );
  }
  if (candidate.sourcePointCloudRoots.length === 0 || !candidate.sourcePointCloudRoots.includes(authoritative.factRoot)) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_LINEAGE_INCOMPLETE",
      "normalized authoritative replacement must retain the prior authoritative root as lineage.",
    );
  }
}

function comparableFrame(asset: PointCloudAsset) {
  if (asset.coordinateFrame === "ABSOLUTE_CRS") {
    return hashJson({
      kind: "canopyproof-point-cloud-absolute-frame-v1",
      crs: asset.crs,
      crsWkt: asset.crsWkt,
      verticalDatum: asset.verticalDatum ?? "UNKNOWN",
      horizontalUnit: asset.horizontalUnit,
      verticalUnit: asset.verticalUnit,
    });
  }
  if (asset.coordinateFrame === "LOCAL_REGISTERED" && asset.registration) {
    const registrationSourceRoot = asset.sourcePointCloudRoots.at(0);
    if (!registrationSourceRoot) {
      throw new PointCloudMrvError(
        "POINT_CLOUD_LINEAGE_INCOMPLETE",
        "registered local-frame derivative must retain its unregistered source root.",
      );
    }
    assertRegistrationRecord(asset.registration, registrationSourceRoot);
    return asset.registration.targetFrameRoot;
  }
  throw new PointCloudMrvError(
    "POINT_CLOUD_UNREGISTERED_FRAME",
    `asset ${asset.id} is ${asset.coordinateFrame} and cannot be compared.`,
  );
}

export function assertPointCloudComparisonAllowed(left: PointCloudAsset, right: PointCloudAsset) {
  validatePointCloudAssetContract(left);
  validatePointCloudAssetContract(right);
  const leftFrame = comparableFrame(left);
  const rightFrame = comparableFrame(right);
  if (leftFrame !== rightFrame) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_UNREGISTERED_FRAME",
      "point clouds do not resolve to the same reviewed coordinate frame.",
    );
  }
  if (left.horizontalUnit !== right.horizontalUnit || left.verticalUnit !== right.verticalUnit) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_INCOMPATIBLE_UNITS",
      "point-cloud comparison requires compatible declared horizontal and vertical units.",
    );
  }
  return { leftFrame, rightFrame };
}

export type PointCloudTemporalContext = {
  readonly acquiredAt: string;
  readonly season: string;
  readonly sensorStreamRoot: string;
  readonly altitudeMeters?: number;
  readonly densityPointsPerSquareMeter?: number;
};

export type PointCloudComparisonPlan = {
  readonly leftAssetId: string;
  readonly rightAssetId: string;
  readonly commonFrameRoot: string;
  readonly comparableObservationMaskRoot: string;
  readonly leftContext: PointCloudTemporalContext;
  readonly rightContext: PointCloudTemporalContext;
  readonly uncertaintyComponents: readonly VisualUncertaintyComponent[];
  readonly unknownRequiredComponent: boolean;
  readonly boundedInterpretationRequired: true;
  readonly planRoot: string;
};

export function createPointCloudComparisonPlan(input: Readonly<{
  left: PointCloudAsset;
  right: PointCloudAsset;
  leftContext: PointCloudTemporalContext;
  rightContext: PointCloudTemporalContext;
  comparableObservationMaskRoot: string;
  uncertaintyComponents: readonly VisualUncertaintyComponent[];
}>): PointCloudComparisonPlan {
  const { leftFrame } = assertPointCloudComparisonAllowed(input.left, input.right);
  const requiredComponents = new Set(["REGISTRATION", "ACQUISITION", "SAMPLING", "TEMPORAL"]);
  const provided = new Set(input.uncertaintyComponents.map((component) => component.code));
  const missing = [...requiredComponents].filter((code) => !provided.has(code));
  if (missing.length > 0) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_UNCERTAINTY_INCOMPLETE",
      `comparison uncertainty is missing: ${missing.join(", ")}.`,
    );
  }
  const components = [...input.uncertaintyComponents].sort((left, right) => left.code.localeCompare(right.code));
  const seed = {
    leftAssetId: input.left.id,
    rightAssetId: input.right.id,
    commonFrameRoot: leftFrame,
    comparableObservationMaskRoot: input.comparableObservationMaskRoot,
    leftContext: input.leftContext,
    rightContext: input.rightContext,
    uncertaintyComponents: components,
    unknownRequiredComponent: components.some((component) => component.state === "UNKNOWN"),
    boundedInterpretationRequired: true as const,
  };
  return {
    ...seed,
    planRoot: hashJson({ kind: "canopyproof-point-cloud-comparison-plan-v1", ...seed }),
  };
}

export function verifyPointCloudProvenanceGraph(
  edges: readonly VisualProvenanceEdge[],
  targetId: string,
  expectedSourceRoots: readonly string[],
) {
  const relevant = edges.filter((edge) => edge.targetId === targetId || edge.sourceId === targetId);
  const targetEdges = relevant.filter((edge) => edge.targetId === targetId);
  const actualSourceRoots = new Set(targetEdges.map((edge) => edge.sourceRoot));
  const missing = [...new Set(expectedSourceRoots)].filter((root) => !actualSourceRoots.has(root));
  if (missing.length > 0) {
    throw new PointCloudMrvError(
      "POINT_CLOUD_LINEAGE_INCOMPLETE",
      `provenance is missing ${missing.length} expected source root(s).`,
    );
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.sourceId) ?? [];
    targets.push(edge.targetId);
    adjacency.set(edge.sourceId, targets);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (node: string): void => {
    if (visiting.has(node)) {
      throw new PointCloudMrvError("POINT_CLOUD_LINEAGE_CYCLE", `provenance cycle detected at ${node}.`);
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) walk(next);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of adjacency.keys()) walk(node);

  return {
    valid: true as const,
    targetId,
    sourceRoots: [...actualSourceRoots].sort(),
    graphRoot: hashJson({
      kind: "canopyproof-point-cloud-provenance-graph-v1",
      edges: [...edges]
        .map((edge) => ({ id: edge.id, sourceId: edge.sourceId, sourceRoot: edge.sourceRoot, targetId: edge.targetId }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }),
  };
}
