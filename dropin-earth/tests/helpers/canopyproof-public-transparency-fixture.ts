import { hashJson, merkleRoot } from "@dropin/crypto";
import {
  canopyProofEnvironmentalProofSafetyBoundary,
  type CanopyProofEnvironmentalProofRecord,
} from "../../services/api/src/domain/canopyproof/environmental-proof-authority.js";
import {
  canopyProofEnvironmentalProofChallengeSafetyBoundary,
  type CanopyProofEnvironmentalProofChallengedRecordProjection,
} from "../../services/api/src/domain/canopyproof/environmental-proof-challenge-authority.js";
import {
  canopyProofEnvironmentalProofLifecycleSafetyBoundary,
  type CanopyProofEnvironmentalProofLifecycleBindingFact,
  type CanopyProofEnvironmentalProofLifecycleProjection,
  type CanopyProofEnvironmentalProofSignatureReceiptFact,
} from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-authority.js";
import type { CanopyProofPublicTransparencySourceAuthority } from
  "../../services/api/src/domain/canopyproof/public-transparency-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";
import {
  createEsgMetricFixture,
  fixtureHash,
  metricActor,
} from "./canopyproof-esg-metric-fixture.js";

export const publicTransparencyReviewedAt = "2026-07-14T08:10:00.000Z";
export const publicTransparencyPublishedAt = "2026-07-14T08:20:00.000Z";

export function createPublicTransparencyFixture(
  options: Readonly<{ organizationId?: string; projectId?: string; suffix?: string }> = {},
) {
  const suffix = options.suffix ?? "001";
  const baseSuffix = `public-${suffix.replaceAll("_", "-")}`;
  const base = createEsgMetricFixture({
    organizationId: options.organizationId,
    projectId: options.projectId,
    suffix: baseSuffix,
  });
  const canonicalSource = canonicalizeSource(base.source);
  const reviewer = metricActor(
    base.organization,
    `cp_public_privacy_reviewer_${suffix}`,
    "verifier",
    ["public_transparency:privacy_review"],
  );
  const publisher = metricActor(
    base.organization,
    `cp_public_publisher_${suffix}`,
    "admin",
    ["public_transparency:publish"],
  );
  const reviewSource = evaluatePublicTransparencySource(canonicalSource, {
    evaluatedAt: publicTransparencyReviewedAt,
  });
  const publicationSource = evaluatePublicTransparencySource(canonicalSource, {
    evaluatedAt: publicTransparencyPublishedAt,
  });
  return {
    organization: base.organization,
    projectId: base.projectId,
    reviewer,
    publisher,
    canonicalSource,
    reviewSource,
    publicationSource,
    reviewInput: {
      organizationId: base.organization.id,
      projectId: base.projectId,
      recordId: canonicalSource.record.id,
      expectedRecordRoot: canonicalSource.record.recordRoot,
      expectedLifecycleProjectionRoot: reviewSource.lifecycleProjection.projectionRoot,
      classification: "public" as const,
      locationDisclosure: "region" as const,
      areaDisclosure: "band" as const,
      reasonCodes: [
        "community_safety_reviewed",
        "data_rights_reviewed",
        "habitat_sensitivity_reviewed",
        "location_minimized",
        "personal_data_excluded",
      ] as const,
      limitationHashes: [fixtureHash(`public limitation:${suffix}`)],
      reviewedAt: publicTransparencyReviewedAt,
    },
  };
}

export function evaluatePublicTransparencySource(
  source: CanopyProofPublicTransparencySourceAuthority,
  options: Readonly<{
    evaluatedAt: string;
    governedRecordState?: CanopyProofEnvironmentalProofChallengedRecordProjection["state"];
    governedSourceAuthorityCurrent?: boolean;
    challengeState?: CanopyProofEnvironmentalProofChallengedRecordProjection["challengeState"];
    challengeId?: string;
    challengeRoot?: string;
    resolutionId?: string;
    resolutionRoot?: string;
    lifecycleState?: CanopyProofEnvironmentalProofLifecycleProjection["state"];
    lifecycleSourceAuthorityCurrent?: boolean;
    mrvState?: CanopyProofEnvironmentalProofLifecycleProjection["mrvState"];
    boundMrvSnapshotCurrent?: boolean;
    keyState?: CanopyProofEnvironmentalProofLifecycleProjection["keyState"];
    signatureVerified?: boolean;
    validityCurrent?: boolean;
    currentControlAction?: CanopyProofEnvironmentalProofLifecycleProjection["currentControlAction"];
    successorBindingId?: string;
    issueCodes?: readonly string[];
  }>,
): CanopyProofPublicTransparencySourceAuthority {
  const governedRecordState = options.governedRecordState ?? "issued";
  const governedSeed = {
    recordId: source.record.id,
    recordRoot: source.record.recordRoot,
    state: governedRecordState,
    baseState: governedRecordState === "stale" ? "stale" as const : "issued" as const,
    sourceAuthorityCurrent: options.governedSourceAuthorityCurrent ?? true,
    ...(options.challengeState ? { challengeState: options.challengeState } : {}),
    ...(options.challengeId ? { challengeId: options.challengeId } : {}),
    ...(options.challengeRoot ? { challengeRoot: options.challengeRoot } : {}),
    ...(options.resolutionId ? { resolutionId: options.resolutionId } : {}),
    ...(options.resolutionRoot ? { resolutionRoot: options.resolutionRoot } : {}),
  };
  const governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection = {
    ...governedSeed,
    projectionRoot: hashJson({
      kind: "canopyproof-environmental-proof-challenged-record-projection-v1",
      recordId: governedSeed.recordId,
      recordRoot: governedSeed.recordRoot,
      state: governedSeed.state,
      baseState: governedSeed.baseState,
      sourceAuthorityCurrent: governedSeed.sourceAuthorityCurrent,
      challengeState: options.challengeState ?? null,
      challengeId: options.challengeId ?? null,
      challengeRoot: options.challengeRoot ?? null,
      resolutionId: options.resolutionId ?? null,
      resolutionRoot: options.resolutionRoot ?? null,
    }),
    safety: canopyProofEnvironmentalProofChallengeSafetyBoundary(),
  };
  const issueCodes = [...new Set(options.issueCodes ?? [])].sort();
  const lifecycleSeed = {
    organizationId: source.record.organizationId,
    projectId: source.record.projectId,
    recordId: source.record.id,
    recordRoot: source.record.recordRoot,
    bindingId: source.lifecycleBinding.id,
    bindingRoot: source.lifecycleBinding.bindingRoot,
    state: options.lifecycleState ?? "active",
    evaluatedAt: options.evaluatedAt,
    governedRecordState,
    sourceAuthorityCurrent: options.lifecycleSourceAuthorityCurrent ?? true,
    mrvState: options.mrvState ?? "reviewed_for_lineage",
    boundMrvSnapshotCurrent: options.boundMrvSnapshotCurrent ?? true,
    keyState: options.keyState ?? "active",
    signatureVerified: options.signatureVerified ?? true,
    validityCurrent: options.validityCurrent ?? true,
    ...(options.currentControlAction ? { currentControlAction: options.currentControlAction } : {}),
    ...(options.successorBindingId ? { successorBindingId: options.successorBindingId } : {}),
    issueCodes,
  };
  const lifecycleProjection: CanopyProofEnvironmentalProofLifecycleProjection = {
    ...lifecycleSeed,
    projectionRoot: hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-projection-v1",
      ...lifecycleSeed,
      currentControlAction: options.currentControlAction ?? null,
      successorBindingId: options.successorBindingId ?? null,
    }),
    safety: canopyProofEnvironmentalProofLifecycleSafetyBoundary(),
  };
  return { ...source, governedRecordProjection, lifecycleProjection };
}

function canonicalizeSource(
  source: ReturnType<typeof createEsgMetricFixture>["source"],
): CanopyProofPublicTransparencySourceAuthority {
  const record = canonicalRecord(source.record);
  const governedRecordProjection = evaluateGovernedRecord(record);
  const lifecycleBinding = canonicalBinding(
    source.lifecycleBinding,
    record,
    governedRecordProjection,
  );
  const signatureReceipt = canonicalSignatureReceipt(source.signatureReceipt, lifecycleBinding);
  const authority = {
    record,
    governedRecordProjection,
    lifecycleBinding,
    signatureReceipt,
    lifecycleProjection: source.lifecycleProjection,
  };
  return evaluatePublicTransparencySource(authority, {
    evaluatedAt: source.lifecycleProjection.evaluatedAt,
  });
}

function canonicalRecord(input: CanopyProofEnvironmentalProofRecord): CanopyProofEnvironmentalProofRecord {
  const id = `cp_environmental_proof_record_${input.commandHash.slice(0, 24)}`;
  const seed = {
    recordType: input.recordType,
    candidateId: input.candidateId,
    candidateRoot: input.candidateRoot,
    authorityRoot: input.authorityRoot,
    organizationId: input.organizationId,
    projectId: input.projectId,
    projectRoot: input.projectRoot,
    methodologyId: input.methodologyId,
    methodologyHash: input.methodologyHash,
    methodologyPublicationId: input.methodologyPublicationId,
    methodologyPublicationRoot: input.methodologyPublicationRoot,
    policyId: input.policyId,
    policyRoot: input.policyRoot,
    evidenceIds: input.evidenceIds,
    evidenceRoot: input.evidenceRoot,
    evidenceFinalDecisionIds: input.evidenceFinalDecisionIds,
    evidenceFinalDecisionRoots: input.evidenceFinalDecisionRoots,
    monitoringEventIds: input.monitoringEventIds,
    monitoringRoot: input.monitoringRoot,
    contributorIds: input.contributorIds,
    publicLocation: input.publicLocation,
    confidenceScore: input.confidenceScore,
    governanceApprovalIds: input.governanceApprovalIds,
    governanceApprovalRoots: input.governanceApprovalRoots,
    governanceQuorumRoot: input.governanceQuorumRoot,
    issuer: input.issuer,
    rationale: input.rationale,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    sourceRoot: input.sourceRoot,
    issuedAt: input.issuedAt,
    commandHash: input.commandHash,
    candidateSequence: input.candidateSequence,
    previousEventRoot: input.previousEventRoot,
  };
  const recordHash = hashJson({ kind: "canopyproof-environmental-proof-record-v2", ...seed });
  const recordRoot = hashJson({
    kind: "canopyproof-environmental-proof-record-root-v1",
    candidateRoot: input.candidateRoot,
    governanceQuorumRoot: input.governanceQuorumRoot,
    sourceRoot: input.sourceRoot,
    recordHash,
    previousEventRoot: input.previousEventRoot,
    candidateSequence: input.candidateSequence,
  });
  const payload = {
    factType: "environmental_proof_record" as const,
    id,
    ...seed,
    recordHash,
    recordRoot,
    status: "issued" as const,
    claimBoundary: canopyProofEnvironmentalProofSafetyBoundary(),
  };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "FULFILL",
    actor: input.issuer.id,
    entityType: "environmental_proof_record",
    entityId: id,
    payload,
    createdAt: input.issuedAt,
    rationale: input.rationale,
  }).at(-1)!;
  return { ...payload, auditEvent };
}

function evaluateGovernedRecord(
  record: CanopyProofEnvironmentalProofRecord,
): CanopyProofEnvironmentalProofChallengedRecordProjection {
  const seed = {
    recordId: record.id,
    recordRoot: record.recordRoot,
    state: "issued" as const,
    baseState: "issued" as const,
    sourceAuthorityCurrent: true,
    challengeState: undefined,
    challengeId: undefined,
    challengeRoot: undefined,
    resolutionId: undefined,
    resolutionRoot: undefined,
  };
  return {
    ...seed,
    projectionRoot: hashJson({
      kind: "canopyproof-environmental-proof-challenged-record-projection-v1",
      recordId: seed.recordId,
      recordRoot: seed.recordRoot,
      state: seed.state,
      baseState: seed.baseState,
      sourceAuthorityCurrent: seed.sourceAuthorityCurrent,
      challengeState: null,
      challengeId: null,
      challengeRoot: null,
      resolutionId: null,
      resolutionRoot: null,
    }),
    safety: canopyProofEnvironmentalProofChallengeSafetyBoundary(),
  };
}

function canonicalBinding(
  input: CanopyProofEnvironmentalProofLifecycleBindingFact,
  record: CanopyProofEnvironmentalProofRecord,
  governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection,
): CanopyProofEnvironmentalProofLifecycleBindingFact {
  const sourceEventRoots = [record.auditEvent.eventRoot];
  const sourceRoot = merkleRoot([
    record.recordRoot,
    governedRecordProjection.projectionRoot,
    input.mrvSnapshotRoot,
    input.mrvGraphRoot,
    input.signingKeyRoot,
    record.issuer.authorityRoot,
    ...sourceEventRoots,
  ].sort());
  const authoritySeed = {
    organizationId: record.organizationId,
    projectId: record.projectId,
    recordId: record.id,
    recordRoot: record.recordRoot,
    recordIssuedAt: record.issuedAt,
    governedRecordProjectionRoot: governedRecordProjection.projectionRoot,
    mrvSnapshotId: input.mrvSnapshotId,
    mrvSnapshotRoot: input.mrvSnapshotRoot,
    mrvEdgeSetRoot: input.mrvEdgeSetRoot,
    mrvGraphRoot: input.mrvGraphRoot,
    mrvReviewedAt: input.mrvReviewedAt,
    methodologyId: record.methodologyId,
    methodologyPublicationRoot: record.methodologyPublicationRoot,
    observationPeriod: input.observationPeriod,
    validity: input.validity,
    monitoringSchedule: input.monitoringSchedule,
    assertionType: input.assertionType,
    assertionScopeHash: input.assertionScopeHash,
    locationScopeHash: input.locationScopeHash,
    uncertaintyHash: input.uncertaintyHash,
    limitationHashes: input.limitationHashes,
    relianceStatement: input.relianceStatement,
    issuer: record.issuer,
    signingKeyAuthorityId: input.signingKeyAuthorityId,
    signingKeyRoot: input.signingKeyRoot,
    sourceEventRoots,
    sourceRoot,
    boundAt: input.boundAt,
  };
  const signaturePayloadHash = hashJson({
    kind: "canopyproof-environmental-proof-signature-payload-v1",
    ...authoritySeed,
  });
  const commandHash = hashJson({
    kind: "canopyproof-environmental-proof-lifecycle-binding-command-v1",
    ...authoritySeed,
    signaturePayloadHash,
  });
  const id = `cp_environmental_proof_lifecycle_${commandHash.slice(0, 24)}`;
  const seed = {
    id,
    ...authoritySeed,
    signaturePayloadHash,
    commandHash,
    recordSequence: 1,
    previousEventRoot: canopyProofAuditGenesisRoot(),
  };
  const bindingHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-binding-v1", ...seed });
  const bindingRoot = hashJson({
    kind: "canopyproof-environmental-proof-lifecycle-binding-root-v1",
    recordRoot: record.recordRoot,
    mrvSnapshotRoot: input.mrvSnapshotRoot,
    signingKeyRoot: input.signingKeyRoot,
    sourceRoot,
    bindingHash,
    previousEventRoot: seed.previousEventRoot,
    recordSequence: seed.recordSequence,
  });
  const payload = {
    factType: "environmental_proof_lifecycle_binding" as const,
    ...seed,
    bindingHash,
    bindingRoot,
    safety: canopyProofEnvironmentalProofLifecycleSafetyBoundary(),
  };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: record.issuer.id,
    entityType: "environmental_proof_lifecycle_binding",
    entityId: id,
    payload,
    createdAt: input.boundAt,
    rationale:
      "A canonical Environmental Proof Record was bound to reviewed MRV lineage, fixed validity, and managed-key authority.",
  }).at(-1)!;
  return { ...payload, auditEvent };
}

function canonicalSignatureReceipt(
  input: CanopyProofEnvironmentalProofSignatureReceiptFact,
  binding: CanopyProofEnvironmentalProofLifecycleBindingFact,
): CanopyProofEnvironmentalProofSignatureReceiptFact {
  const signatureHash = hashJson({
    kind: "canopyproof-environmental-proof-detached-signature-v1",
    algorithm: input.algorithm,
    detachedSignature: input.detachedSignature,
  });
  const commandSeed = {
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    recordId: binding.recordId,
    recordRoot: binding.recordRoot,
    bindingId: binding.id,
    bindingRoot: binding.bindingRoot,
    signingKeyAuthorityId: binding.signingKeyAuthorityId,
    signingKeyRoot: binding.signingKeyRoot,
    algorithm: input.algorithm,
    signaturePayloadHash: binding.signaturePayloadHash,
    detachedSignature: input.detachedSignature,
    signatureHash,
    externalVerifierId: input.externalVerifierId,
    providerReceiptIdHash: input.providerReceiptIdHash,
    providerReceiptHash: input.providerReceiptHash,
    signedAt: input.signedAt,
    verifiedAt: input.verifiedAt,
  };
  const commandHash = hashJson({
    kind: "canopyproof-environmental-proof-signature-receipt-command-v1",
    ...commandSeed,
  });
  const id = `cp_environmental_proof_signature_${commandHash.slice(0, 24)}`;
  const previousEventRoot = binding.auditEvent.eventRoot;
  const sourceRoot = merkleRoot([
    binding.bindingRoot,
    binding.signingKeyRoot,
    signatureHash,
    input.providerReceiptHash,
  ].sort());
  const seed = {
    id,
    ...commandSeed,
    commandHash,
    recordSequence: 2,
    previousEventRoot,
    sourceRoot,
  };
  const receiptHash = hashJson({ kind: "canopyproof-environmental-proof-signature-receipt-v1", ...seed });
  const receiptRoot = hashJson({
    kind: "canopyproof-environmental-proof-signature-receipt-root-v1",
    bindingRoot: binding.bindingRoot,
    signingKeyRoot: binding.signingKeyRoot,
    sourceRoot,
    receiptHash,
    previousEventRoot,
    recordSequence: seed.recordSequence,
  });
  const payload = {
    factType: "environmental_proof_signature_receipt" as const,
    ...seed,
    receiptHash,
    receiptRoot,
    safety: canopyProofEnvironmentalProofLifecycleSafetyBoundary(),
  };
  const auditEvent = appendCanopyProofAuditEvent([binding.auditEvent], {
    action: "FULFILL",
    actor: input.externalVerifierId,
    entityType: "environmental_proof_signature_receipt",
    entityId: id,
    payload,
    createdAt: input.verifiedAt,
    rationale:
      "An external managed-signature verifier accepted the detached signature for the exact lifecycle payload.",
  }).at(-1)!;
  return { ...payload, auditEvent };
}
