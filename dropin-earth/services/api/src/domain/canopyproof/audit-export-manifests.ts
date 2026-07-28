import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofAuditExportManifestKinds = [
  "institutional_audit_packet",
  "public_transparency_packet",
  "regulator_review_packet",
  "esg_report_packet",
] as const;
export const canopyProofAuditExportScopes = ["evidence", "proof_record", "organization", "funding", "governance", "reporting", "system"] as const;
export const canopyProofAuditExportClassifications = ["public", "internal", "restricted", "confidential"] as const;
export const canopyProofAuditExportEntryTypes = [
  "evidence",
  "proof_record",
  "public_record",
  "audit_attestation",
  "governance_approval",
  "terra_scene",
  "funding_ledger",
  "esg_report",
  "risk_alert",
  "memory_record",
  "audit_event",
] as const;
export const canopyProofAuditExportRedactionPolicies = [
  "public_safe",
  "precise_location_redacted",
  "personal_data_redacted",
  "confidential_hash_only",
] as const;

export type CanopyProofAuditExportManifestKind = (typeof canopyProofAuditExportManifestKinds)[number];
export type CanopyProofAuditExportScope = (typeof canopyProofAuditExportScopes)[number];
export type CanopyProofAuditExportClassification = (typeof canopyProofAuditExportClassifications)[number];
export type CanopyProofAuditExportEntryType = (typeof canopyProofAuditExportEntryTypes)[number];
export type CanopyProofAuditExportRedactionPolicy = (typeof canopyProofAuditExportRedactionPolicies)[number];

export type CanopyProofAuditExportEntry = {
  readonly id: string;
  readonly resourceType: CanopyProofAuditExportEntryType;
  readonly resourceId: string;
  readonly contentHash: string;
  readonly eventRoot?: string;
  readonly classification: CanopyProofAuditExportClassification;
  readonly redactionPolicy: CanopyProofAuditExportRedactionPolicy;
  readonly included: boolean;
  readonly reason: string;
};

export type CanopyProofAuditExportManifest = {
  readonly id: string;
  readonly manifestVersion: "canopyproof_audit_export_manifest_v1";
  readonly kind: CanopyProofAuditExportManifestKind;
  readonly scope: CanopyProofAuditExportScope;
  readonly subjectId: string;
  readonly requesterOrganizationId: string;
  readonly requestedBy: string;
  readonly purpose: string;
  readonly classification: CanopyProofAuditExportClassification;
  readonly entries: readonly CanopyProofAuditExportEntry[];
  readonly entryRoot: string;
  readonly redactionRoot: string;
  readonly sourceEventRoot: string;
  readonly exportHash: string;
  readonly expiresAt?: string;
  readonly createdAt: string;
  readonly safety: {
    readonly hashOnlyManifest: true;
    readonly rawEvidenceExcluded: true;
    readonly personalDataRedacted: true;
    readonly preciseLocationRedactedUnlessAuthorized: true;
    readonly noFinancialOrCarbonCreditAuthority: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofAuditExportManifestAuthoritySnapshot = {
  readonly manifests: readonly CanopyProofAuditExportManifest[];
};

export type CanopyProofAuditExportManifestStatus = {
  readonly service: "canopyproof-audit-export-manifests";
  readonly manifestCount: number;
  readonly restrictedOrConfidentialCount: number;
  readonly kinds: readonly CanopyProofAuditExportManifestKind[];
  readonly scopes: readonly CanopyProofAuditExportScope[];
  readonly classifications: readonly CanopyProofAuditExportClassification[];
  readonly redactionPolicies: readonly CanopyProofAuditExportRedactionPolicy[];
  readonly safety: {
    readonly hashOnlyManifest: true;
    readonly appendOnlyAuditEvents: true;
    readonly publicReadsFilterSensitiveManifests: true;
    readonly noRawEvidencePayloads: true;
  };
  readonly manifestRoot: string;
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const exportEntrySchema = z
  .object({
    id: z.string().min(1).optional(),
    resourceType: z.enum(canopyProofAuditExportEntryTypes),
    resourceId: z.string().min(1),
    contentHash: sha256Schema,
    eventRoot: sha256Schema.optional(),
    classification: z.enum(canopyProofAuditExportClassifications),
    redactionPolicy: z.enum(canopyProofAuditExportRedactionPolicies),
    included: z.boolean().default(true),
    reason: z.string().min(8).max(1_000),
  })
  .strict();

const exportManifestSchema = z
  .object({
    id: z.string().min(1).optional(),
    kind: z.enum(canopyProofAuditExportManifestKinds),
    scope: z.enum(canopyProofAuditExportScopes),
    subjectId: z.string().min(1),
    requesterOrganizationId: z.string().min(1),
    purpose: z.string().min(12).max(1_000),
    classification: z.enum(canopyProofAuditExportClassifications),
    entries: z.array(exportEntrySchema).min(1),
    expiresAt: z.string().datetime().optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofAuditExportManifestService {
  private readonly manifestsById = new Map<string, CanopyProofAuditExportManifest>();

  static fromAuthoritySnapshot(
    snapshot: CanopyProofAuditExportManifestAuthoritySnapshot,
  ): CanopyProofAuditExportManifestService {
    const service = new CanopyProofAuditExportManifestService();
    for (const manifest of snapshot.manifests) {
      if (service.manifestsById.has(manifest.id)) {
        throw new Error(`CanopyProof audit export manifest snapshot contains duplicate ID: ${manifest.id}`);
      }
      if ([...service.manifestsById.values()].some((entry) => entry.exportHash === manifest.exportHash)) {
        throw new Error(`CanopyProof audit export manifest snapshot contains duplicate export hash: ${manifest.exportHash}`);
      }
      assertExportManifestSnapshotIntegrity(manifest);
      service.manifestsById.set(manifest.id, manifest);
    }
    return service;
  }

  createManifest(input: unknown, actorId: string, authorityAuditHistory?: readonly CanopyProofAuditEvent[]) {
    const parsed = exportManifestSchema.parse(input);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) <= Date.parse(createdAt)) {
      throw new Error("CanopyProof audit export manifest expiration must follow creation.");
    }
    const entries = normalizeEntries(parsed.entries);
    assertSafeExportManifestText([parsed.subjectId, parsed.requesterOrganizationId, parsed.purpose, ...entries.map((entry) => entry.reason)]);
    assertManifestClassification(parsed.classification, entries);
    assertManifestRedaction(parsed.classification, entries);
    const entryRoot = merkleRoot(entries.map((entry) => hashJson(entry)).sort());
    const redactionRoot = hashJson({
      kind: "canopyproof-audit-export-redaction-root-v1",
      policies: entries.map((entry) => ({
        id: entry.id,
        classification: entry.classification,
        redactionPolicy: entry.redactionPolicy,
        included: entry.included,
      })),
    });
    const sourceEventRoots = entries.flatMap((entry) => (entry.eventRoot ? [entry.eventRoot] : []));
    const sourceEventRoot = sourceEventRoots.length > 0 ? merkleRoot(sourceEventRoots.sort()) : hashJson({ kind: "no-source-event-roots" });
    const manifestSeed = {
      manifestVersion: "canopyproof_audit_export_manifest_v1" as const,
      kind: parsed.kind,
      scope: parsed.scope,
      subjectId: parsed.subjectId,
      requesterOrganizationId: parsed.requesterOrganizationId,
      requestedBy: actorId,
      purpose: parsed.purpose,
      classification: parsed.classification,
      entries,
      entryRoot,
      redactionRoot,
      sourceEventRoot,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      createdAt,
      safety: exportManifestSafety(),
    };
    const exportHash = hashJson({ kind: "canopyproof-audit-export-manifest-v1", manifest: manifestSeed });
    const id = parsed.id ?? `cp_audit_export_${exportHash.slice(0, 24)}`;
    const existing = this.manifestsById.get(id);
    if (existing?.exportHash === exportHash) return existing;
    if (existing) {
      throw new Error(`CanopyProof audit export manifest already exists: ${id}`);
    }
    if ([...this.manifestsById.values()].some((manifest) => manifest.exportHash === exportHash)) {
      throw new Error(`CanopyProof audit export manifest already exists for export hash: ${exportHash}`);
    }
    const localAuditHistory = [...this.manifestsById.values()]
      .filter((manifest) => manifest.requesterOrganizationId === parsed.requesterOrganizationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((manifest) => manifest.auditEvent);
    const auditHistory = authorityAuditHistory ?? localAuditHistory;
    if (
      authorityAuditHistory &&
      localAuditHistory.some((event) => !authorityAuditHistory.some((authorityEvent) => authorityEvent.eventRoot === event.eventRoot))
    ) {
      throw new Error("CanopyProof audit export authority history is missing a committed manifest event.");
    }
    const auditEvent = appendCanopyProofAuditEvent(auditHistory, {
      action: "DELEGATE",
      actor: actorId,
      entityType: "audit_export_manifest",
      entityId: id,
      payload: {
        ...manifestSeed,
        exportHash,
      },
      createdAt,
      rationale: "CanopyProof audit export manifest created as a hash-only institutional data-room index with explicit redaction policy.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof audit export manifest failed to append audit event.");
    }
    const manifest: CanopyProofAuditExportManifest = {
      id,
      ...manifestSeed,
      exportHash,
      auditEvent,
    };
    this.manifestsById.set(manifest.id, manifest);
    return manifest;
  }

  listManifests(
    filter: Readonly<{
      scope?: CanopyProofAuditExportScope;
      subjectId?: string;
      classification?: CanopyProofAuditExportClassification;
      requesterOrganizationId?: string;
      includeSensitive?: boolean;
    }> = {},
  ) {
    return [...this.manifestsById.values()]
      .filter((manifest) => !filter.scope || manifest.scope === filter.scope)
      .filter((manifest) => !filter.subjectId || manifest.subjectId === filter.subjectId)
      .filter((manifest) => !filter.classification || manifest.classification === filter.classification)
      .filter(
        (manifest) =>
          !filter.requesterOrganizationId || manifest.requesterOrganizationId === filter.requesterOrganizationId,
      )
      .filter((manifest) => filter.includeSensitive || manifest.classification === "public" || manifest.classification === "internal")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  getManifest(manifestId: string, includeSensitive = false) {
    const manifest = this.manifestsById.get(manifestId);
    if (!manifest) {
      throw new Error(`CanopyProof audit export manifest not found: ${manifestId}`);
    }
    if (!includeSensitive && (manifest.classification === "restricted" || manifest.classification === "confidential")) {
      throw new Error("CANOPYPROOF_RBAC_DENIED: sensitive audit export manifest requires institutional reviewer access.");
    }
    return manifest;
  }

  getStatus(requesterOrganizationId?: string): CanopyProofAuditExportManifestStatus {
    const manifests = this.listManifests({
      includeSensitive: true,
      ...(requesterOrganizationId ? { requesterOrganizationId } : {}),
    });
    return {
      service: "canopyproof-audit-export-manifests",
      manifestCount: manifests.length,
      restrictedOrConfidentialCount: manifests.filter(
        (manifest) => manifest.classification === "restricted" || manifest.classification === "confidential",
      ).length,
      kinds: canopyProofAuditExportManifestKinds,
      scopes: canopyProofAuditExportScopes,
      classifications: canopyProofAuditExportClassifications,
      redactionPolicies: canopyProofAuditExportRedactionPolicies,
      safety: {
        hashOnlyManifest: true,
        appendOnlyAuditEvents: true,
        publicReadsFilterSensitiveManifests: true,
        noRawEvidencePayloads: true,
      },
      manifestRoot:
        manifests.length > 0
          ? merkleRoot(manifests.map((manifest) => manifest.exportHash).sort())
          : hashJson({ kind: "canopyproof-empty-audit-export-manifest-root-v1" }),
    };
  }
}

function assertExportManifestSnapshotIntegrity(manifest: CanopyProofAuditExportManifest) {
  if (manifest.manifestVersion !== "canopyproof_audit_export_manifest_v1") {
    throw new Error(`CanopyProof audit export manifest version is invalid: ${manifest.id}`);
  }
  if (
    manifest.auditEvent.entityType !== "audit_export_manifest" ||
    manifest.auditEvent.entityId !== manifest.id ||
    manifest.auditEvent.actor !== manifest.requestedBy ||
    manifest.auditEvent.createdAt !== manifest.createdAt
  ) {
    throw new Error(`CanopyProof audit export manifest semantic event binding is invalid: ${manifest.id}`);
  }
  if (!Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new Error(`CanopyProof audit export manifest creation timestamp is invalid: ${manifest.id}`);
  }
  if (manifest.expiresAt && Date.parse(manifest.expiresAt) <= Date.parse(manifest.createdAt)) {
    throw new Error(`CanopyProof audit export manifest expiration is invalid: ${manifest.id}`);
  }
  if (new Set(manifest.entries.map((entry) => entry.id)).size !== manifest.entries.length) {
    throw new Error(`CanopyProof audit export manifest contains duplicate entry IDs: ${manifest.id}`);
  }
  const entries = normalizeEntries(manifest.entries);
  if (hashJson(entries) !== hashJson(manifest.entries)) {
    throw new Error(`CanopyProof audit export manifest entries are not canonically normalized: ${manifest.id}`);
  }
  assertSafeExportManifestText([
    manifest.subjectId,
    manifest.requesterOrganizationId,
    manifest.purpose,
    ...entries.map((entry) => entry.reason),
  ]);
  assertManifestClassification(manifest.classification, entries);
  assertManifestRedaction(manifest.classification, entries);

  const entryRoot = merkleRoot(entries.map((entry) => hashJson(entry)).sort());
  const redactionRoot = hashJson({
    kind: "canopyproof-audit-export-redaction-root-v1",
    policies: entries.map((entry) => ({
      id: entry.id,
      classification: entry.classification,
      redactionPolicy: entry.redactionPolicy,
      included: entry.included,
    })),
  });
  const sourceEventRoots = entries.flatMap((entry) => (entry.eventRoot ? [entry.eventRoot] : []));
  const sourceEventRoot =
    sourceEventRoots.length > 0
      ? merkleRoot(sourceEventRoots.sort())
      : hashJson({ kind: "no-source-event-roots" });
  if (
    manifest.entryRoot !== entryRoot ||
    manifest.redactionRoot !== redactionRoot ||
    manifest.sourceEventRoot !== sourceEventRoot
  ) {
    throw new Error(`CanopyProof audit export manifest deterministic root is invalid: ${manifest.id}`);
  }
  const safety = exportManifestSafety();
  if (hashJson(manifest.safety) !== hashJson(safety)) {
    throw new Error(`CanopyProof audit export manifest safety boundary is invalid: ${manifest.id}`);
  }
  const manifestSeed = {
    manifestVersion: manifest.manifestVersion,
    kind: manifest.kind,
    scope: manifest.scope,
    subjectId: manifest.subjectId,
    requesterOrganizationId: manifest.requesterOrganizationId,
    requestedBy: manifest.requestedBy,
    purpose: manifest.purpose,
    classification: manifest.classification,
    entries,
    entryRoot,
    redactionRoot,
    sourceEventRoot,
    ...(manifest.expiresAt ? { expiresAt: manifest.expiresAt } : {}),
    createdAt: manifest.createdAt,
    safety,
  };
  const expectedExportHash = hashJson({ kind: "canopyproof-audit-export-manifest-v1", manifest: manifestSeed });
  if (manifest.exportHash !== expectedExportHash) {
    throw new Error(`CanopyProof audit export manifest export hash is invalid: ${manifest.id}`);
  }
}

function normalizeEntries(entries: readonly z.infer<typeof exportEntrySchema>[]): readonly CanopyProofAuditExportEntry[] {
  return entries
    .map((entry) => {
      const normalized = {
        id:
          entry.id ??
          `cp_audit_export_entry_${hashJson({
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            contentHash: normalizeSha256(entry.contentHash),
          }).slice(0, 24)}`,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        contentHash: normalizeSha256(entry.contentHash),
        ...(entry.eventRoot ? { eventRoot: normalizeSha256(entry.eventRoot) } : {}),
        classification: entry.classification,
        redactionPolicy: entry.redactionPolicy,
        included: entry.included,
        reason: entry.reason,
      } satisfies CanopyProofAuditExportEntry;
      return normalized;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function exportManifestSafety(): CanopyProofAuditExportManifest["safety"] {
  return {
    hashOnlyManifest: true,
    rawEvidenceExcluded: true,
    personalDataRedacted: true,
    preciseLocationRedactedUnlessAuthorized: true,
    noFinancialOrCarbonCreditAuthority: true,
  };
}

function normalizeSha256(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function assertManifestClassification(
  classification: CanopyProofAuditExportClassification,
  entries: readonly CanopyProofAuditExportEntry[],
) {
  const rank: Record<CanopyProofAuditExportClassification, number> = {
    public: 0,
    internal: 1,
    restricted: 2,
    confidential: 3,
  };
  const highestEntryRank = Math.max(...entries.map((entry) => rank[entry.classification]));
  if (rank[classification] < highestEntryRank) {
    throw new Error("CanopyProof audit export manifest classification cannot be lower than its most sensitive entry.");
  }
}

function assertManifestRedaction(
  classification: CanopyProofAuditExportClassification,
  entries: readonly CanopyProofAuditExportEntry[],
) {
  for (const entry of entries) {
    if ((entry.classification === "restricted" || entry.classification === "confidential") && entry.redactionPolicy === "public_safe") {
      throw new Error("CanopyProof restricted export entries require an explicit redaction policy.");
    }
    if (classification === "public" && entry.redactionPolicy !== "public_safe" && entry.included) {
      throw new Error("CanopyProof public export manifests can only include public-safe entries.");
    }
  }
}

function assertSafeExportManifestText(values: readonly string[]) {
  const unsafeClaims = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]?tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+(?:\$?canopy|canopy)\s+distribution/i,
    /mainnet\s+funds/i,
    /(?:BEGIN|END)\s+(?:RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY/i,
    /private[_\s-]?key/i,
    /(?:api|access|client)?[_\s-]?secret/i,
    /password/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  ] as const;
  for (const value of values) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited|excluded)\b/i.test(value)) {
        throw new Error(`CanopyProof audit export manifest contains unsupported public claim: ${value}`);
      }
    }
  }
}
