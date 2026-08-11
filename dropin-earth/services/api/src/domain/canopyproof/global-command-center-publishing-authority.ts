import { hashJson } from "@dropin/crypto";
import {
  canopyProofGlobalCommandCenterSnapshotSchema,
  type CanopyProofGlobalCommandCenterSnapshot,
} from "@dropin/schemas/canopyproof-global-command-center";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import { verifyCanopyProofGlobalCommandCenterSnapshot } from "./global-command-center.js";

export const canopyProofGlobalCommandCenterProjectionSchema =
  "canopyproof.global-command-center.snapshot.v2" as const;

export const canopyProofGlobalCommandCenterPublishingScopes = {
  publish: "global_command_center:publish",
  govern: "global_command_center:govern",
} as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const timestampSchema = z.string().datetime({ offset: true });
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: hashSchema.optional(),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(64),
    authorityRoot: hashSchema,
  })
  .strict();

const governanceApprovalSchema = z
  .object({
    id: identifierSchema,
    dashboardRoot: hashSchema,
    sourceAuthorityRoot: hashSchema,
    policyId: identifierSchema,
    policyRoot: hashSchema,
    maxSnapshotAgeSeconds: z.number().int().min(60).max(86_400),
    validFrom: timestampSchema,
    validUntil: timestampSchema,
    approvedAt: timestampSchema,
    governor: actorSchema,
    approvalRoot: hashSchema,
  })
  .strict();

const publishingSafetySchema = z
  .object({
    routeMounted: z.literal(false),
    schedulerMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    currentSourceReResolutionRequired: z.literal(true),
    independentHumanGovernanceRequired: z.literal(true),
    readOnlyProjection: z.literal(true),
    noMainnetFunds: z.literal(true),
    noAutomaticCanopyDistribution: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.literal("ASSERT"),
    actor: identifierSchema,
    entityType: z.literal("global_command_center_snapshot"),
    entityId: identifierSchema,
    previousRoot: hashSchema,
    payloadHash: hashSchema,
    eventRoot: hashSchema,
    createdAt: timestampSchema,
    rationale: z.string().trim().min(1).max(512),
  })
  .strict();

const publicationFactSchema = z
  .object({
    factType: z.literal("global_command_center_snapshot_publication"),
    id: identifierSchema,
    snapshotId: identifierSchema,
    projectionSchema: z.literal(canopyProofGlobalCommandCenterProjectionSchema),
    dashboardRoot: hashSchema,
    snapshotContentRoot: hashSchema,
    sourceAuthorityRoot: hashSchema,
    policyId: identifierSchema,
    policyRoot: hashSchema,
    governanceApproval: governanceApprovalSchema,
    publisher: actorSchema,
    publishedAt: timestampSchema,
    commandHash: hashSchema,
    globalSequence: z.number().int().positive(),
    previousEventRoot: hashSchema,
    publicationHash: hashSchema,
    publicationRoot: hashSchema,
    safety: publishingSafetySchema,
    auditEvent: auditEventSchema,
  })
  .strict();

export type CanopyProofGlobalCommandCenterGovernanceApproval = z.output<
  typeof governanceApprovalSchema
>;

export type CanopyProofGlobalCommandCenterPublicationFact = z.output<
  typeof publicationFactSchema
>;

export type CanopyProofGlobalCommandCenterPublishingAuthority = Readonly<{
  publisher: CanopyProofVerificationActorSnapshot;
  governanceApproval: CanopyProofGlobalCommandCenterGovernanceApproval;
}>;

export type CanopyProofGlobalCommandCenterCurrentAuthority = Readonly<{
  snapshot: CanopyProofGlobalCommandCenterSnapshot;
  sourceAuthorityRoot: string;
  publisher: CanopyProofVerificationActorSnapshot;
  governor: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofGlobalCommandCenterPublishingAuthoritySnapshot = Readonly<{
  publications: readonly CanopyProofGlobalCommandCenterPublicationFact[];
  streamEvents: readonly CanopyProofAuditEvent[];
}>;

export function parseCanopyProofGlobalCommandCenterPublicationFact(
  input: unknown,
): CanopyProofGlobalCommandCenterPublicationFact {
  return publicationFactSchema.parse(input);
}

export function buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(
  input: unknown,
) {
  const snapshot = verifyCanopyProofGlobalCommandCenterSnapshot(input);
  const sourceLineage = {
    projectRoot: snapshot.lineage.projectRoot,
    monitoringRoot: snapshot.lineage.monitoringRoot,
    evidenceRoot: snapshot.lineage.evidenceRoot,
    proofRecordRoot: snapshot.lineage.proofRecordRoot,
    proofChallengeRoot: snapshot.lineage.proofChallengeRoot,
    terraSceneRoot: snapshot.lineage.terraSceneRoot,
    riskSignalRoot: snapshot.lineage.riskSignalRoot,
    riskAlertRoot: snapshot.lineage.riskAlertRoot,
    fundingLedgerRoot: snapshot.lineage.fundingLedgerRoot,
    regionRoot: snapshot.lineage.regionRoot,
  };
  return hashJson({
    kind: "canopyproof-global-command-center-source-authority-v1",
    projectionSchema: canopyProofGlobalCommandCenterProjectionSchema,
    generatedAt: snapshot.generatedAt,
    sourceLineage,
    regionalSources: snapshot.regions.map((region) => ({
      regionId: region.regionId,
      regionSourceRoot: region.sourceRoot,
      spatialDisclosureRoot:
        region.spatial.visibility === "generalized" ? region.spatial.disclosureRoot : null,
    })),
  });
}

export function buildCanopyProofGlobalCommandCenterGovernanceApproval(
  input: Readonly<{
    id: string;
    dashboardRoot: string;
    sourceAuthorityRoot: string;
    policyId: string;
    policyRoot: string;
    maxSnapshotAgeSeconds: number;
    validFrom: string;
    validUntil: string;
    approvedAt: string;
  }>,
  governorInput: CanopyProofVerificationActorSnapshot,
): CanopyProofGlobalCommandCenterGovernanceApproval {
  const parsed = governanceApprovalSchema.omit({ governor: true, approvalRoot: true }).parse(input);
  const governor = normalizeActor(governorInput, "governor");
  requireActorScope(governor, canopyProofGlobalCommandCenterPublishingScopes.govern, "governor");
  if (governor.participantType !== "human" || !["owner", "admin", "verifier"].includes(governor.role)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_GOVERNOR_INVALID");
  }
  assertCanonicalUtc(parsed.validFrom, "validFrom");
  assertCanonicalUtc(parsed.validUntil, "validUntil");
  assertCanonicalUtc(parsed.approvedAt, "approvedAt");
  if (
    Date.parse(parsed.approvedAt) > Date.parse(parsed.validFrom) ||
    Date.parse(parsed.validFrom) >= Date.parse(parsed.validUntil)
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_APPROVAL_INTERVAL_INVALID");
  }
  const seed = { ...parsed, governor };
  return governanceApprovalSchema.parse({
    ...seed,
    approvalRoot: hashJson({
      kind: "canopyproof-global-command-center-governance-approval-v1",
      ...seed,
    }),
  });
}

export function verifyCanopyProofGlobalCommandCenterGovernanceApproval(
  input: unknown,
) {
  const approval = governanceApprovalSchema.parse(input);
  const expected = buildCanopyProofGlobalCommandCenterGovernanceApproval(
    {
      id: approval.id,
      dashboardRoot: approval.dashboardRoot,
      sourceAuthorityRoot: approval.sourceAuthorityRoot,
      policyId: approval.policyId,
      policyRoot: approval.policyRoot,
      maxSnapshotAgeSeconds: approval.maxSnapshotAgeSeconds,
      validFrom: approval.validFrom,
      validUntil: approval.validUntil,
      approvedAt: approval.approvedAt,
    },
    normalizeActor(approval.governor, "governor"),
  );
  if (hashJson(approval) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_APPROVAL_ROOT_INVALID");
  }
  return approval;
}

export function buildCanopyProofGlobalCommandCenterPublication(
  input: Readonly<{
    snapshot: CanopyProofGlobalCommandCenterSnapshot;
    sourceAuthorityRoot: string;
    policyId: string;
    policyRoot: string;
    publishedAt: string;
  }>,
  authority: CanopyProofGlobalCommandCenterPublishingAuthority,
  history: readonly CanopyProofAuditEvent[] = [],
): CanopyProofGlobalCommandCenterPublicationFact {
  const snapshot = verifyCanopyProofGlobalCommandCenterSnapshot(input.snapshot);
  const sourceAuthorityRoot = hashSchema.parse(input.sourceAuthorityRoot);
  const policyId = identifierSchema.parse(input.policyId);
  const policyRoot = hashSchema.parse(input.policyRoot);
  const publishedAt = timestampSchema.parse(input.publishedAt);
  assertCanonicalUtc(publishedAt, "publishedAt");
  assertHistory(history);

  if (buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(snapshot) !== sourceAuthorityRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_AUTHORITY_ROOT_INVALID");
  }
  const publisher = normalizeActor(authority.publisher, "publisher");
  requireActorScope(publisher, canopyProofGlobalCommandCenterPublishingScopes.publish, "publisher");
  if (!new Set(["agent", "owner", "admin"]).has(publisher.role)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLISHER_INVALID");
  }
  const governanceApproval = verifyCanopyProofGlobalCommandCenterGovernanceApproval(
    authority.governanceApproval,
  );
  if (
    governanceApproval.dashboardRoot !== snapshot.lineage.dashboardRoot ||
    governanceApproval.sourceAuthorityRoot !== sourceAuthorityRoot ||
    governanceApproval.policyId !== policyId ||
    governanceApproval.policyRoot !== policyRoot
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_APPROVAL_SCOPE_MISMATCH");
  }
  if (
    publisher.id === governanceApproval.governor.id ||
    publisher.organizationId !== governanceApproval.governor.organizationId ||
    publisher.organizationRoot !== governanceApproval.governor.organizationRoot
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_INDEPENDENT_GOVERNANCE_REQUIRED");
  }
  const publishedAtEpoch = Date.parse(publishedAt);
  const generatedAtEpoch = Date.parse(snapshot.generatedAt);
  if (
    publishedAtEpoch < Date.parse(governanceApproval.validFrom) ||
    publishedAtEpoch > Date.parse(governanceApproval.validUntil) ||
    publishedAtEpoch < generatedAtEpoch ||
    publishedAtEpoch - generatedAtEpoch > governanceApproval.maxSnapshotAgeSeconds * 1_000
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_WINDOW_INVALID");
  }

  const snapshotContentRoot = hashJson({
    kind: "canopyproof-global-command-center-snapshot-content-v1",
    snapshot,
  });
  const commandSeed = {
    projectionSchema: canopyProofGlobalCommandCenterProjectionSchema,
    dashboardRoot: snapshot.lineage.dashboardRoot,
    snapshotContentRoot,
    sourceAuthorityRoot,
    policyId,
    policyRoot,
    governanceApprovalRoot: governanceApproval.approvalRoot,
    publisherAuthorityRoot: publisher.authorityRoot,
    publishedAt,
  };
  const commandHash = hashJson({
    kind: "canopyproof-global-command-center-publication-command-v1",
    ...commandSeed,
  });
  const id = `cp_global_publication_${commandHash.slice(0, 24)}`;
  const snapshotId = `cp_global_snapshot_${snapshot.lineage.dashboardRoot.slice(0, 24)}`;
  const globalSequence = history.length + 1;
  const previousEventRoot = history.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const safety = canopyProofGlobalCommandCenterPublishingSafety();
  const publicationSeed = {
    factType: "global_command_center_snapshot_publication" as const,
    id,
    snapshotId,
    projectionSchema: canopyProofGlobalCommandCenterProjectionSchema,
    dashboardRoot: snapshot.lineage.dashboardRoot,
    snapshotContentRoot,
    sourceAuthorityRoot,
    policyId,
    policyRoot,
    governanceApproval,
    publisher,
    publishedAt,
    commandHash,
    globalSequence,
    previousEventRoot,
    safety,
  };
  const publicationHash = hashJson({
    kind: "canopyproof-global-command-center-publication-v1",
    ...publicationSeed,
  });
  const payload = {
    ...publicationSeed,
    publicationHash,
    publicationRoot: hashJson({
      kind: "canopyproof-global-command-center-publication-root-v1",
      publication: { ...publicationSeed, publicationHash },
    }),
  };
  const auditEvent = appendCanopyProofAuditEvent(history, {
    action: "ASSERT",
    actor: publisher.id,
    entityType: "global_command_center_snapshot",
    entityId: id,
    payload,
    createdAt: publishedAt,
    rationale:
      "An authorized publisher appended a current-source Global Command Center projection under independent human governance.",
  }).at(-1);
  if (!auditEvent) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_AUDIT_EVENT_MISSING");
  }
  return publicationFactSchema.parse({ ...payload, auditEvent });
}

export function verifyCanopyProofGlobalCommandCenterPublication(
  publicationInput: unknown,
  snapshotInput: unknown,
  history: readonly CanopyProofAuditEvent[] = [],
) {
  const publication = publicationFactSchema.parse(publicationInput);
  const snapshot = canopyProofGlobalCommandCenterSnapshotSchema.parse(snapshotInput);
  const expected = buildCanopyProofGlobalCommandCenterPublication(
    {
      snapshot,
      sourceAuthorityRoot: publication.sourceAuthorityRoot,
      policyId: publication.policyId,
      policyRoot: publication.policyRoot,
      publishedAt: publication.publishedAt,
    },
    {
      publisher: normalizeActor(publication.publisher, "publisher"),
      governanceApproval: publication.governanceApproval,
    },
    history,
  );
  if (hashJson(publication) !== hashJson(expected)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_ROOT_INVALID");
  }
  return publication;
}

export function canopyProofGlobalCommandCenterPublishingSafety() {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    currentSourceReResolutionRequired: true,
    independentHumanGovernanceRequired: true,
    readOnlyProjection: true,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
  } as const;
}

function normalizeActor(
  input: unknown,
  boundary: "publisher" | "governor",
): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = [...new Set(parsed.accreditationScope)].sort();
  if (hashJson(accreditationScope) !== hashJson(parsed.accreditationScope)) {
    throw new Error(`CANOPYPROOF_GLOBAL_COMMAND_CENTER_${boundary.toUpperCase()}_SCOPE_NON_CANONICAL`);
  }
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: parsed.participantRoot,
    organizationRoot: parsed.organizationRoot,
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: parsed.membershipRoot } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: parsed.accreditationRoot } : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({
    kind: "canopyproof-verification-actor-authority-v1",
    ...normalized,
  });
  if (parsed.authorityRoot !== authorityRoot) {
    throw new Error(`CANOPYPROOF_GLOBAL_COMMAND_CENTER_${boundary.toUpperCase()}_AUTHORITY_ROOT_INVALID`);
  }
  return { ...normalized, authorityRoot };
}

function requireActorScope(
  actor: CanopyProofVerificationActorSnapshot,
  scope: string,
  boundary: "publisher" | "governor",
) {
  if (
    !actor.membershipId ||
    actor.membershipStatus !== "active" ||
    !actor.membershipRoot ||
    !actor.accreditationId ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes(scope)
  ) {
    throw new Error(`CANOPYPROOF_GLOBAL_COMMAND_CENTER_${boundary.toUpperCase()}_AUTHORITY_INVALID`);
  }
}

function assertHistory(history: readonly CanopyProofAuditEvent[]) {
  if (history.length === 0) return;
  const verification = verifyCanopyProofAuditChain(history, history.at(-1)!.createdAt);
  if (!verification.valid) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_AUDIT_HISTORY_INVALID");
  }
  if (history.some((event) => event.entityType !== "global_command_center_snapshot")) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_AUDIT_HISTORY_SCOPE_INVALID");
  }
}

function assertCanonicalUtc(value: string, boundary: string) {
  if (new Date(value).toISOString() !== value) {
    throw new Error(`CANOPYPROOF_GLOBAL_COMMAND_CENTER_${boundary.toUpperCase()}_NOT_CANONICAL`);
  }
}
