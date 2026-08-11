import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofMethodologyScopes = [
  "tree_planting",
  "ecosystem_restoration",
  "biodiversity",
  "water_project",
  "soil_regeneration",
  "climate_observation",
  "multi_scope",
] as const;
export const canopyProofMethodologyStatuses = ["draft", "published", "deprecated", "challenged"] as const;
export const canopyProofMethodologyDataSources = [
  "field_photo",
  "gps_trace",
  "device_attestation",
  "community_attestation",
  "satellite_scene",
  "sensor_reading",
  "governance_approval",
  "audit_attestation",
] as const;
export const canopyProofMethodologyQualityGates = [
  "media_hash_required",
  "gps_hash_required",
  "gps_accuracy_threshold",
  "device_attestation_required",
  "satellite_cross_check_required",
  "duplicate_detection_required",
  "human_review_required",
  "governance_approval_required",
  "public_challenge_window_required",
  "monitoring_timeline_required",
] as const;

export type CanopyProofMethodologyScope = (typeof canopyProofMethodologyScopes)[number];
export type CanopyProofMethodologyStatus = (typeof canopyProofMethodologyStatuses)[number];
export type CanopyProofMethodologyDataSource = (typeof canopyProofMethodologyDataSources)[number];
export type CanopyProofMethodologyQualityGate = (typeof canopyProofMethodologyQualityGates)[number];

export type CanopyProofMethodology = {
  readonly id: string;
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  readonly scope: CanopyProofMethodologyScope;
  readonly status: CanopyProofMethodologyStatus;
  readonly summary: string;
  readonly requiredDataSources: readonly CanopyProofMethodologyDataSource[];
  readonly qualityGates: readonly CanopyProofMethodologyQualityGate[];
  readonly minimumGpsAccuracyMeters: number;
  readonly monitoringCadenceDays: number;
  readonly evidenceRetentionDays: number;
  readonly governanceApprovalIds: readonly string[];
  readonly supersedes?: string;
  readonly limitations: readonly string[];
  readonly claimBoundary: {
    readonly environmentalAccountabilityOnly: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
    readonly notAutomaticCanopyDistribution: true;
  };
  readonly createdBy: string;
  readonly createdAt: string;
  readonly publishedAt?: string;
  readonly methodologyHash: string;
  readonly qualityGateRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMethodologyAuthoritySnapshot = {
  readonly methodologies: readonly CanopyProofMethodology[];
};

export type CanopyProofMethodologyRegistryStatus = {
  readonly service: "canopyproof-methodology-registry";
  readonly methodologyCount: number;
  readonly publishedCount: number;
  readonly challengedCount: number;
  readonly scopes: readonly CanopyProofMethodologyScope[];
  readonly dataSources: readonly CanopyProofMethodologyDataSource[];
  readonly qualityGates: readonly CanopyProofMethodologyQualityGate[];
  readonly safety: {
    readonly versionedMethodologies: true;
    readonly publishedMethodologiesRequireGovernanceApproval: true;
    readonly methodChangesCreateNewVersions: true;
    readonly noFinancialOrCarbonCreditAuthority: true;
  };
  readonly methodologyRoot: string;
};

const methodologySchema = z
  .object({
    id: z.string().min(1).optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    title: z.string().min(8).max(200),
    scope: z.enum(canopyProofMethodologyScopes),
    status: z.enum(canopyProofMethodologyStatuses).default("draft"),
    summary: z.string().min(24).max(2_000),
    requiredDataSources: z.array(z.enum(canopyProofMethodologyDataSources)).min(1),
    qualityGates: z.array(z.enum(canopyProofMethodologyQualityGates)).min(1),
    minimumGpsAccuracyMeters: z.number().positive().max(10_000).default(50),
    monitoringCadenceDays: z.number().int().positive().max(3_650).default(90),
    evidenceRetentionDays: z.number().int().positive().max(36_500).default(2_555),
    governanceApprovalIds: z.array(z.string().min(1)).default([]),
    supersedes: z.string().min(1).optional(),
    limitations: z.array(z.string().min(12).max(1_000)).min(1),
    createdAt: z.string().datetime().optional(),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofMethodologyRegistryService {
  private readonly methodologiesById = new Map<string, CanopyProofMethodology>();

  static fromAuthoritySnapshot(snapshot: CanopyProofMethodologyAuthoritySnapshot) {
    const service = new CanopyProofMethodologyRegistryService();
    for (const methodology of [...snapshot.methodologies].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )) {
      const replayed = service.createMethodology(
        {
          id: methodology.id,
          slug: methodology.slug,
          version: methodology.version,
          title: methodology.title,
          scope: methodology.scope,
          status: methodology.status,
          summary: methodology.summary,
          requiredDataSources: methodology.requiredDataSources,
          qualityGates: methodology.qualityGates,
          minimumGpsAccuracyMeters: methodology.minimumGpsAccuracyMeters,
          monitoringCadenceDays: methodology.monitoringCadenceDays,
          evidenceRetentionDays: methodology.evidenceRetentionDays,
          governanceApprovalIds: methodology.governanceApprovalIds,
          ...(methodology.supersedes ? { supersedes: methodology.supersedes } : {}),
          limitations: methodology.limitations,
          createdAt: methodology.createdAt,
          ...(methodology.publishedAt ? { publishedAt: methodology.publishedAt } : {}),
        },
        methodology.createdBy,
      );
      if (hashJson(replayed) !== hashJson(methodology)) {
        throw new Error(`CanopyProof methodology snapshot lineage is invalid: ${methodology.id}`);
      }
    }
    return service;
  }

  createMethodology(input: unknown, actorId: string) {
    const parsed = methodologySchema.parse(input);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const requiredDataSources = [...new Set(parsed.requiredDataSources)].sort();
    const qualityGates = [...new Set(parsed.qualityGates)].sort();
    const governanceApprovalIds = [...new Set(parsed.governanceApprovalIds)].sort();
    const limitations = [...parsed.limitations].sort();
    assertSafeMethodologyText([parsed.slug, parsed.version, parsed.title, parsed.summary, ...limitations]);
    assertMethodologyPublicationRules({
      status: parsed.status,
      governanceApprovalIds,
      qualityGates,
      ...(parsed.publishedAt ? { publishedAt: parsed.publishedAt } : {}),
    });
    const qualityGateRoot = merkleRoot(
      qualityGates
        .map((qualityGate) =>
          hashJson({
            qualityGate,
            minimumGpsAccuracyMeters: parsed.minimumGpsAccuracyMeters,
            monitoringCadenceDays: parsed.monitoringCadenceDays,
            evidenceRetentionDays: parsed.evidenceRetentionDays,
          }),
        )
        .sort(),
    );
    const methodologySeed = {
      slug: parsed.slug,
      version: parsed.version,
      title: parsed.title,
      scope: parsed.scope,
      status: parsed.status,
      summary: parsed.summary,
      requiredDataSources,
      qualityGates,
      minimumGpsAccuracyMeters: parsed.minimumGpsAccuracyMeters,
      monitoringCadenceDays: parsed.monitoringCadenceDays,
      evidenceRetentionDays: parsed.evidenceRetentionDays,
      governanceApprovalIds,
      ...(parsed.supersedes ? { supersedes: parsed.supersedes } : {}),
      limitations,
      claimBoundary: methodologyClaimBoundary(),
      createdBy: actorId,
      createdAt,
      ...(parsed.status === "published" ? { publishedAt: parsed.publishedAt ?? createdAt } : {}),
      qualityGateRoot,
    };
    const methodologyHash = hashJson({ kind: "canopyproof-methodology-v1", methodology: methodologySeed });
    const id = parsed.id ?? `cp_methodology_${methodologyHash.slice(0, 24)}`;
    if (this.methodologiesById.has(id)) {
      throw new Error(`CanopyProof methodology already exists: ${id}`);
    }
    const duplicateVersion = this.listMethodologies({ includeAll: true }).find(
      (methodology) => methodology.slug === parsed.slug && methodology.version === parsed.version,
    );
    if (duplicateVersion) {
      throw new Error(`CanopyProof methodology version already exists: ${parsed.slug}@${parsed.version}`);
    }
    if (parsed.supersedes) {
      const predecessor = this.methodologiesById.get(parsed.supersedes);
      if (!predecessor) {
        throw new Error(`CanopyProof methodology supersedes unknown methodology: ${parsed.supersedes}`);
      }
      if (
        predecessor.slug !== parsed.slug ||
        predecessor.scope !== parsed.scope ||
        Date.parse(createdAt) <= Date.parse(predecessor.createdAt) ||
        [...this.methodologiesById.values()].some((methodology) => methodology.supersedes === predecessor.id)
      ) {
        throw new Error("CanopyProof methodology supersession must be a later, same-scope, non-forked version.");
      }
    }
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: parsed.status === "published" ? "FULFILL" : parsed.status === "challenged" ? "CHALLENGE" : "ASSERT",
      actor: actorId,
      entityType: "methodology",
      entityId: id,
      payload: {
        ...methodologySeed,
        methodologyHash,
      },
      createdAt,
      rationale:
        parsed.status === "published"
          ? "CanopyProof methodology published with governance approval, data-source requirements, quality gates, and claim boundary."
          : "CanopyProof methodology version recorded for institutional review without creating public proof authority.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof methodology failed to append audit event.");
    }
    const methodology: CanopyProofMethodology = {
      id,
      ...methodologySeed,
      methodologyHash,
      auditEvent,
    };
    this.methodologiesById.set(methodology.id, methodology);
    return methodology;
  }

  listMethodologies(
    filter: Readonly<{ scope?: CanopyProofMethodologyScope; status?: CanopyProofMethodologyStatus; includeAll?: boolean }> = {},
  ) {
    return [...this.methodologiesById.values()]
      .filter((methodology) => filter.includeAll || methodology.status !== "draft")
      .filter((methodology) => !filter.scope || methodology.scope === filter.scope)
      .filter((methodology) => !filter.status || methodology.status === filter.status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.slug.localeCompare(right.slug) || left.version.localeCompare(right.version));
  }

  getMethodology(methodologyId: string, includeDraft = false) {
    const methodology = this.methodologiesById.get(methodologyId);
    if (!methodology) {
      throw new Error(`CanopyProof methodology not found: ${methodologyId}`);
    }
    if (!includeDraft && methodology.status === "draft") {
      throw new Error("CANOPYPROOF_RBAC_DENIED: draft methodologies require institutional reviewer access.");
    }
    return methodology;
  }

  getStatus(): CanopyProofMethodologyRegistryStatus {
    const methodologies = this.listMethodologies({ includeAll: true });
    return {
      service: "canopyproof-methodology-registry",
      methodologyCount: methodologies.length,
      publishedCount: methodologies.filter((methodology) => methodology.status === "published").length,
      challengedCount: methodologies.filter((methodology) => methodology.status === "challenged").length,
      scopes: canopyProofMethodologyScopes,
      dataSources: canopyProofMethodologyDataSources,
      qualityGates: canopyProofMethodologyQualityGates,
      safety: {
        versionedMethodologies: true,
        publishedMethodologiesRequireGovernanceApproval: true,
        methodChangesCreateNewVersions: true,
        noFinancialOrCarbonCreditAuthority: true,
      },
      methodologyRoot:
        methodologies.length > 0
          ? merkleRoot(methodologies.map((methodology) => methodology.methodologyHash).sort())
          : hashJson({ kind: "canopyproof-empty-methodology-root-v1" }),
    };
  }
}

export function methodologyClaimBoundary(): CanopyProofMethodology["claimBoundary"] {
  return {
    environmentalAccountabilityOnly: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
    notAutomaticCanopyDistribution: true,
  };
}

function assertMethodologyPublicationRules(input: Readonly<{
  status: CanopyProofMethodologyStatus;
  governanceApprovalIds: readonly string[];
  qualityGates: readonly CanopyProofMethodologyQualityGate[];
  publishedAt?: string;
}>) {
  if (input.status === "published") {
    if (input.governanceApprovalIds.length === 0) {
      throw new Error("CanopyProof published methodologies require at least one governance approval.");
    }
    for (const requiredGate of ["human_review_required", "governance_approval_required", "public_challenge_window_required"] as const) {
      if (!input.qualityGates.includes(requiredGate)) {
        throw new Error(`CanopyProof published methodologies require quality gate: ${requiredGate}.`);
      }
    }
  }
  if ((input.status === "draft" || input.status === "challenged") && input.publishedAt) {
    throw new Error("CanopyProof unpublished or challenged methodology cannot set publishedAt.");
  }
}

function assertSafeMethodologyText(values: readonly string[]) {
  const unsafeClaims = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]?tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+(?:\$?canopy|canopy)\s+distribution/i,
    /mainnet\s+funds/i,
  ] as const;
  for (const value of values) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited|excluded)\b/i.test(value)) {
        throw new Error(`CanopyProof methodology contains unsupported public claim: ${value}`);
      }
    }
  }
}
