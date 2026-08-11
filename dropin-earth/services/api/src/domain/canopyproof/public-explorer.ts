import { hashJson } from "@dropin/crypto";
import {
  canopyProofPublicExplorerHistoryResponseSchema,
  canopyProofPublicExplorerProjectResponseSchema,
  canopyProofPublicExplorerVerificationResponseSchema,
  type CanopyProofPublicExplorerHistoryResponse,
  type CanopyProofPublicExplorerProjectResponse,
  type CanopyProofPublicExplorerSafety,
  type CanopyProofPublicExplorerSnapshot,
  type CanopyProofPublicExplorerVerificationResponse,
} from "@dropin/schemas/canopyproof-public-explorer";
import {
  verifyCanopyProofPublicTransparencyProjection,
  type CanopyProofPublicTransparencyProjection,
} from "./public-transparency-authority.js";

export type CanopyProofPublicExplorerErrorCode =
  | "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND"
  | "CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED"
  | "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID"
  | "CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED"
  | "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID";

export class CanopyProofPublicExplorerError extends Error {
  constructor(readonly code: CanopyProofPublicExplorerErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "CanopyProofPublicExplorerError";
  }
}

const forbiddenKeys = new Set([
  "organizationid",
  "projectid",
  "recordid",
  "reviewer",
  "publisher",
  "issuer",
  "actor",
  "actorid",
  "credential",
  "credentials",
  "signature",
  "signatureid",
  "signaturereceiptid",
  "latitude",
  "longitude",
  "coordinates",
  "geometry",
  "evidenceids",
  "rawevidence",
  "rationale",
  "commandhash",
  "commandroot",
]);

const forbiddenText = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\bbearer\s+[a-z0-9._~-]+/i,
  /\bcertified\s+carbon\s+credit\b/i,
  /\bcarbon[- ]tax\s+offset\b/i,
  /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
];

export function canopyProofPublicExplorerSafety(): CanopyProofPublicExplorerSafety {
  return {
    canonical: true,
    durable: true,
    anonymousMutationAllowed: false,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function serializeCanopyProofPublicExplorerProject(
  projection: CanopyProofPublicTransparencyProjection,
): CanopyProofPublicExplorerProjectResponse {
  const snapshot = publicSnapshot(projection);
  const response = canopyProofPublicExplorerProjectResponseSchema.parse({
    apiVersion: "canopyproof.public-explorer.v1",
    evaluatedAt: projection.evaluatedAt,
    ...snapshot,
    safety: canopyProofPublicExplorerSafety(),
  });
  assertCanopyProofPublicExplorerResponseIsSanitized(response);
  return response;
}

export function serializeCanopyProofPublicExplorerHistory(
  projections: readonly CanopyProofPublicTransparencyProjection[],
  nextCursor: string | null,
  evaluatedAt: string,
): CanopyProofPublicExplorerHistoryResponse {
  const response = canopyProofPublicExplorerHistoryResponseSchema.parse({
    apiVersion: "canopyproof.public-explorer.v1",
    evaluatedAt,
    items: projections.map(publicSnapshot),
    nextCursor,
    safety: canopyProofPublicExplorerSafety(),
  });
  assertCanopyProofPublicExplorerResponseIsSanitized(response);
  return response;
}

export function serializeCanopyProofPublicExplorerVerification(
  projection: CanopyProofPublicTransparencyProjection,
): CanopyProofPublicExplorerVerificationResponse {
  const snapshot = publicSnapshot(projection);
  const response = canopyProofPublicExplorerVerificationResponseSchema.parse({
    apiVersion: "canopyproof.public-explorer.v1",
    evaluatedAt: projection.evaluatedAt,
    verified: true,
    ...snapshot,
    safety: canopyProofPublicExplorerSafety(),
  });
  assertCanopyProofPublicExplorerResponseIsSanitized(response);
  return response;
}

export function canopyProofPublicExplorerProjectEtag(
  response: CanopyProofPublicExplorerProjectResponse | CanopyProofPublicExplorerVerificationResponse,
): string {
  return quoteEtag(`cp-public-explorer-v1-${response.lineage.projectionRoot}`);
}

export function canopyProofPublicExplorerHistoryEtag(
  response: CanopyProofPublicExplorerHistoryResponse,
): string {
  return quoteEtag(`cp-public-explorer-history-v1-${hashJson({
    evaluatedAt: response.evaluatedAt,
    projectionRoots: response.items.map((item) => item.lineage.projectionRoot),
    nextCursor: response.nextCursor,
  })}`);
}

export function assertCanopyProofPublicExplorerResponseIsSanitized(value: unknown): void {
  inspectPublicValue(value, "$", new WeakSet<object>());
}

function publicSnapshot(
  projection: CanopyProofPublicTransparencyProjection,
): CanopyProofPublicExplorerSnapshot {
  if (!verifyCanopyProofPublicTransparencyProjection(projection)) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID");
  }
  return {
    project: {
      publicOrganizationId: projection.publicOrganizationId,
      publicProjectId: projection.publicProjectId,
      publicationId: projection.publicationId,
      state: projection.state,
      recordIssuedOn: projection.recordIssuedOn,
      observationPeriod: projection.observationPeriod,
      validity: projection.validity,
      methodology: projection.methodology,
      location: projection.location,
      areaBand: projection.areaBand,
      evidence: projection.evidence,
      verification: projection.verification,
      monitoring: projection.monitoring,
      governance: projection.governance,
      confidenceBand: projection.confidenceBand,
      challenge: projection.challenge,
      issueCodes: [...projection.issueCodes],
      limitationCount: projection.limitationCount,
      limitationRoot: projection.limitationRoot,
    },
    lineage: {
      recordRoot: projection.recordRoot,
      publicationRoot: projection.publicationRoot,
      currentGovernedRecordProjectionRoot: projection.currentGovernedRecordProjectionRoot,
      currentLifecycleProjectionRoot: projection.currentLifecycleProjectionRoot,
      projectionRoot: projection.projectionRoot,
    },
  };
}

function inspectPublicValue(value: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof value === "string") {
    if (forbiddenText.some((pattern) => pattern.test(value))) {
      throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID");
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPublicValue(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replaceAll(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (forbiddenKeys.has(normalizedKey)) {
      throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID");
    }
    inspectPublicValue(child, `${path}.${key}`, seen);
  }
}

function quoteEtag(value: string): string {
  return `"${value}"`;
}
