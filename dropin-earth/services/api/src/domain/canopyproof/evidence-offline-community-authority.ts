import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceConsentProjection,
  type CanopyProofEvidenceConsentReceiptFact,
  type CanopyProofEvidenceCustodyActorSnapshot,
  type CanopyProofEvidenceDeviceAttestationFact,
  type CanopyProofEvidenceDeviceAttestationProjection,
} from "./evidence-custody-authority.js";
import type { CanopyProofEffectiveDeviceAttestationProjection } from
  "./evidence-device-attestation-adapter-authority.js";
import type {
  CanopyProofEvidenceProjectBoundary,
  CanopyProofEvidenceRegistration,
} from "./evidence-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofOfflineConnectivityModes = ["offline", "cellular", "wifi", "satellite"] as const;
export const canopyProofOfflineItemStates = ["reconciled", "needs_review"] as const;
export const canopyProofOfflineBatchStates = ["reconciled", "needs_review"] as const;
export const canopyProofCommunityAttestationStances = ["support", "challenge", "needs_review"] as const;
export const canopyProofCommunityRelationships = [
  "resident",
  "local_ngo",
  "field_observer",
  "independent_researcher",
] as const;
export const canopyProofCommunityObservationBases = [
  "direct_observation",
  "local_knowledge",
  "secondary_media",
  "records_review",
] as const;

export type CanopyProofOfflineConnectivityMode = (typeof canopyProofOfflineConnectivityModes)[number];
export type CanopyProofOfflineItemState = (typeof canopyProofOfflineItemStates)[number];
export type CanopyProofOfflineBatchState = (typeof canopyProofOfflineBatchStates)[number];
export type CanopyProofCommunityAttestationStance = (typeof canopyProofCommunityAttestationStances)[number];
export type CanopyProofCommunityRelationship = (typeof canopyProofCommunityRelationships)[number];
export type CanopyProofCommunityObservationBasis = (typeof canopyProofCommunityObservationBases)[number];

export type CanopyProofEvidenceOfflineCommunitySafetyBoundary = {
  readonly appendOnly: true;
  readonly organizationBound: true;
  readonly projectBound: true;
  readonly evidenceBound: true;
  readonly consentBound: true;
  readonly deviceBound: true;
  readonly semanticEventBound: true;
  readonly exactRetryRequired: true;
  readonly clientSequenceBound: true;
  readonly localClockAdvisoryOnly: true;
  readonly rawPayloadExcluded: true;
  readonly rawLocationExcluded: true;
  readonly rawCommunityNoteExcluded: true;
  readonly rawContactDataExcluded: true;
  readonly selfAttestationRejected: true;
  readonly oneAttestationPerActorEvidence: true;
  readonly communityAttestationNonFinal: true;
  readonly communityCannotMutateVerification: true;
  readonly humanReviewRequiredForChallenge: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofOfflineSyncItemFact = {
  readonly factType: "evidence_offline_sync_item";
  readonly id: string;
  readonly batchId: string;
  readonly batchCommandHash: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly subjectId: string;
  readonly deviceAttestationId: string;
  readonly itemIndex: number;
  readonly clientRecordId: string;
  readonly evidenceId: string;
  readonly evidenceHash: string;
  readonly evidenceRoot: string;
  readonly clientPayloadHash: string;
  readonly result: CanopyProofOfflineItemState;
  readonly issueCodes: readonly string[];
  readonly itemHash: string;
  readonly itemRoot: string;
  readonly safety: CanopyProofEvidenceOfflineCommunitySafetyBoundary;
};

export type CanopyProofOfflineSyncBatchFact = {
  readonly factType: "evidence_offline_sync_batch";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly subjectId: string;
  readonly consentReceiptId: string;
  readonly consentReceiptRoot: string;
  readonly consentProjectionRoot: string;
  readonly deviceAttestationId: string;
  readonly deviceAttestationRoot: string;
  readonly deviceProjectionState: "current" | "needs_review";
  readonly deviceProjectionRoot: string;
  readonly clientBatchId: string;
  readonly deviceSequence: number;
  readonly previousBatchRoot: string;
  readonly deviceClockStartedAt: string;
  readonly deviceClockEndedAt: string;
  readonly receivedAt: string;
  readonly connectivity: CanopyProofOfflineConnectivityMode;
  readonly itemCount: number;
  readonly reconciledCount: number;
  readonly needsReviewCount: number;
  readonly itemRoots: readonly string[];
  readonly manifestRoot: string;
  readonly issueCodes: readonly string[];
  readonly batchState: CanopyProofOfflineBatchState;
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly commandHash: string;
  readonly streamSequence: number;
  readonly previousEventRoot: string;
  readonly batchHash: string;
  readonly batchRoot: string;
  readonly safety: CanopyProofEvidenceOfflineCommunitySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofCommunityAttestationFact = {
  readonly factType: "evidence_community_attestation";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly evidenceRoot: string;
  readonly evidenceContributorId: string;
  readonly attesterId: string;
  readonly stance: CanopyProofCommunityAttestationStance;
  readonly relationship: CanopyProofCommunityRelationship;
  readonly observationBasis: CanopyProofCommunityObservationBasis;
  readonly conflictOfInterestDeclared: false;
  readonly noteHash: string;
  readonly confidenceScore: number;
  readonly reasonCodes: readonly string[];
  readonly supportingMediaHash?: string;
  readonly supportingGpsHash?: string;
  readonly observedAt: string;
  readonly createdAt: string;
  readonly attestationState: "supporting_context" | "review_required";
  readonly attester: CanopyProofEvidenceCustodyActorSnapshot;
  readonly attestationSequence: number;
  readonly previousAttestationRoot: string;
  readonly commandHash: string;
  readonly streamSequence: number;
  readonly previousEventRoot: string;
  readonly attestationHash: string;
  readonly attestationRoot: string;
  readonly safety: CanopyProofEvidenceOfflineCommunitySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofOfflineSyncAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly batches: readonly CanopyProofOfflineSyncBatchFact[];
  readonly items: readonly CanopyProofOfflineSyncItemFact[];
};

export type CanopyProofCommunityAttestationAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly attestations: readonly CanopyProofCommunityAttestationFact[];
};

export type CanopyProofOfflineSyncAuthority = {
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly project: CanopyProofEvidenceProjectBoundary;
  readonly consent: CanopyProofEvidenceConsentReceiptFact;
  readonly consentProjection: CanopyProofEvidenceConsentProjection;
  readonly device: CanopyProofEvidenceDeviceAttestationFact;
  readonly deviceProjection:
    | CanopyProofEvidenceDeviceAttestationProjection
    | CanopyProofEffectiveDeviceAttestationProjection;
  readonly registrations: readonly CanopyProofEvidenceRegistration[];
};

export type CanopyProofCommunityAttestationAuthority = {
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly evidence: CanopyProofEvidenceRegistration;
};

export type CanopyProofCommunitySignalProjection = {
  readonly organizationId: string;
  readonly evidenceId: string;
  readonly evidenceRoot: string;
  readonly state: "no_context" | "supporting_context" | "review_required";
  readonly attestationRoots: readonly string[];
  readonly projectionRoot: string;
  readonly advisoryOnly: true;
  readonly finalVerificationChanged: false;
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const reasonCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9_:-]{0,119}$/);
const offlineItemInputSchema = z
  .object({
    clientRecordId: identifierSchema,
    evidenceId: identifierSchema,
    evidenceRoot: hashSchema,
    clientPayloadHash: hashSchema,
  })
  .strict();
const offlineBatchInputSchema = z
  .object({
    clientBatchId: identifierSchema,
    deviceSequence: z.number().int().positive(),
    previousBatchRoot: hashSchema,
    deviceClockStartedAt: z.string().datetime(),
    deviceClockEndedAt: z.string().datetime(),
    receivedAt: z.string().datetime(),
    connectivity: z.enum(canopyProofOfflineConnectivityModes),
    items: z.array(offlineItemInputSchema).min(1).max(100),
  })
  .strict();
const communityAttestationInputSchema = z
  .object({
    stance: z.enum(canopyProofCommunityAttestationStances),
    relationship: z.enum(canopyProofCommunityRelationships),
    observationBasis: z.enum(canopyProofCommunityObservationBases),
    conflictOfInterestDeclared: z.literal(false),
    noteHash: hashSchema,
    confidenceScore: z.number().int().min(0).max(100),
    reasonCodes: z.array(reasonCodeSchema).max(32).default([]),
    supportingMediaHash: hashSchema.optional(),
    supportingGpsHash: hashSchema.optional(),
    observedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  })
  .strict();

const offlineRationale =
  "An offline evidence reconciliation manifest was appended without replacing canonical evidence authority.";
const communityRationale =
  "A non-final community statement was appended without changing evidence verification authority.";

export class CanopyProofEvidenceOfflineSyncAuthorityService {
  private readonly batchesById = new Map<string, CanopyProofOfflineSyncBatchFact>();
  private readonly batchIdsByClientId = new Map<string, string>();
  private readonly itemsById = new Map<string, CanopyProofOfflineSyncItemFact>();
  private streamEvents: CanopyProofAuditEvent[];

  constructor(streamEvents: readonly CanopyProofAuditEvent[] = []) {
    this.streamEvents = validateStreamEvents(streamEvents);
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofOfflineSyncAuthoritySnapshot) {
    const service = new CanopyProofEvidenceOfflineSyncAuthorityService(snapshot.streamEvents);
    const itemsByBatch = new Map<string, CanopyProofOfflineSyncItemFact[]>();
    for (const item of snapshot.items) {
      itemsByBatch.set(item.batchId, [...(itemsByBatch.get(item.batchId) ?? []), item]);
    }
    for (const batch of [...snapshot.batches].sort(compareOfflineBatches)) {
      service.replayBundle(batch, itemsByBatch.get(batch.id) ?? []);
      itemsByBatch.delete(batch.id);
    }
    if (itemsByBatch.size > 0) {
      throw new Error("CanopyProof E4 snapshot contains orphan offline sync items.");
    }
    return service;
  }

  recordOfflineBundle(input: unknown, authority: CanopyProofOfflineSyncAuthority) {
    const parsed = offlineBatchInputSchema.parse(input);
    assertMillisecondTimestamp(parsed.deviceClockStartedAt, "offline deviceClockStartedAt");
    assertMillisecondTimestamp(parsed.deviceClockEndedAt, "offline deviceClockEndedAt");
    assertMillisecondTimestamp(parsed.receivedAt, "offline receivedAt");
    assertOfflineChronology(parsed.deviceClockStartedAt, parsed.deviceClockEndedAt, parsed.receivedAt);
    const actor = normalizeActor(authority.actor);
    assertOfflineAuthority(parsed, authority, actor);
    const deviceProjectionState = authority.deviceProjection.state;
    if (deviceProjectionState !== "current" && deviceProjectionState !== "needs_review") {
      throw new Error("CanopyProof offline device projection is not eligible.");
    }

    const previous = this.listBatches().at(-1);
    const expectedPreviousRoot =
      previous?.batchRoot ?? offlineBatchGenesis(authority.device.id, authority.device.attestationRoot);
    if (parsed.deviceSequence !== (previous?.deviceSequence ?? 0) + 1) {
      throw new Error("CanopyProof offline device sequence is not contiguous.");
    }
    if (normalizeHash(parsed.previousBatchRoot) !== expectedPreviousRoot) {
      throw new Error("CanopyProof offline previous batch root is invalid.");
    }
    if (this.batchIdsByClientId.has(parsed.clientBatchId)) {
      throw new Error("CanopyProof offline client batch identifier is already committed.");
    }

    const registrationById = new Map(authority.registrations.map((registration) => [registration.id, registration]));
    const clientRecordIds = new Set<string>();
    const evidenceIds = new Set<string>();
    for (const binding of parsed.items) {
      if (clientRecordIds.has(binding.clientRecordId) || evidenceIds.has(binding.evidenceId)) {
        throw new Error("CanopyProof offline batch contains duplicate item identity.");
      }
      clientRecordIds.add(binding.clientRecordId);
      evidenceIds.add(binding.evidenceId);
    }

    const normalizedBindings = parsed.items.map((binding, itemIndex) => {
      const registration = registrationById.get(binding.evidenceId);
      if (!registration) throw new Error(`CanopyProof offline evidence registration not found: ${binding.evidenceId}`);
      assertOfflineRegistration(parsed, authority, actor, binding, registration);
      return {
        itemIndex,
        clientRecordId: binding.clientRecordId,
        evidenceId: registration.id,
        evidenceHash: registration.evidenceHash,
        evidenceRoot: registration.evidenceRoot,
        clientPayloadHash: normalizeHash(binding.clientPayloadHash),
        result: registration.verification_status === "validated" && deviceProjectionState === "current"
          ? ("reconciled" as const)
          : ("needs_review" as const),
        issueCodes: offlineItemIssues(registration, deviceProjectionState),
      };
    });
    const issueCodes = offlineBatchIssues(parsed.deviceClockEndedAt, parsed.receivedAt, deviceProjectionState);
    const commandSeed = {
      organizationId: authority.project.organizationId,
      projectId: authority.project.id,
      projectRoot: authority.project.projectRoot,
      subjectId: actor.id,
      consentReceiptId: authority.consent.id,
      consentReceiptRoot: authority.consent.receiptRoot,
      consentProjectionRoot: authority.consentProjection.projectionRoot,
      deviceAttestationId: authority.device.id,
      deviceAttestationRoot: authority.device.attestationRoot,
      deviceProjectionState,
      deviceProjectionRoot: authority.deviceProjection.projectionRoot,
      clientBatchId: parsed.clientBatchId,
      deviceSequence: parsed.deviceSequence,
      previousBatchRoot: expectedPreviousRoot,
      deviceClockStartedAt: parsed.deviceClockStartedAt,
      deviceClockEndedAt: parsed.deviceClockEndedAt,
      receivedAt: parsed.receivedAt,
      connectivity: parsed.connectivity,
      items: normalizedBindings,
      actor,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-offline-sync-batch-command-v1", ...commandSeed });
    const id = `cp_offline_batch_${commandHash.slice(0, 24)}`;
    const safety = canopyProofEvidenceOfflineCommunitySafetyBoundary();
    const items = normalizedBindings.map((binding) => createOfflineItem(id, commandHash, commandSeed, binding, safety));
    const itemRoots = items.map((item) => item.itemRoot);
    const manifestRoot = merkleRoot(itemRoots);
    const reconciledCount = items.filter((item) => item.result === "reconciled").length;
    const needsReviewCount = items.length - reconciledCount;
    const batchState: CanopyProofOfflineBatchState =
      needsReviewCount === 0 && issueCodes.length === 0 ? "reconciled" : "needs_review";
    const lineage = this.nextLineage();
    const seed = {
      id,
      organizationId: commandSeed.organizationId,
      projectId: commandSeed.projectId,
      projectRoot: commandSeed.projectRoot,
      subjectId: commandSeed.subjectId,
      consentReceiptId: commandSeed.consentReceiptId,
      consentReceiptRoot: commandSeed.consentReceiptRoot,
      consentProjectionRoot: commandSeed.consentProjectionRoot,
      deviceAttestationId: commandSeed.deviceAttestationId,
      deviceAttestationRoot: commandSeed.deviceAttestationRoot,
      deviceProjectionState: commandSeed.deviceProjectionState,
      deviceProjectionRoot: commandSeed.deviceProjectionRoot,
      clientBatchId: commandSeed.clientBatchId,
      deviceSequence: commandSeed.deviceSequence,
      previousBatchRoot: commandSeed.previousBatchRoot,
      deviceClockStartedAt: commandSeed.deviceClockStartedAt,
      deviceClockEndedAt: commandSeed.deviceClockEndedAt,
      receivedAt: commandSeed.receivedAt,
      connectivity: commandSeed.connectivity,
      itemCount: items.length,
      reconciledCount,
      needsReviewCount,
      itemRoots,
      manifestRoot,
      issueCodes,
      batchState,
      actor,
      commandHash,
      ...lineage,
    } as const;
    const batchHash = hashJson({ kind: "canopyproof-offline-sync-batch-v1", ...seed });
    const batchRoot = offlineBatchRoot({ ...seed, batchHash });
    const payload = {
      factType: "evidence_offline_sync_batch" as const,
      ...seed,
      batchHash,
      batchRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: batchState === "reconciled" ? "ASSERT" : "CHALLENGE",
      actor: actor.id,
      entityType: "evidence_sync_batch",
      entityId: id,
      payload,
      createdAt: parsed.receivedAt,
      rationale: offlineRationale,
    });
    const batch: CanopyProofOfflineSyncBatchFact = { ...payload, auditEvent };
    this.storeBundle(batch, items);
    return { batch, items } as const;
  }

  listBatches() {
    return [...this.batchesById.values()].sort(compareOfflineBatches);
  }

  listItems(batchId?: string) {
    return [...this.itemsById.values()]
      .filter((item) => !batchId || item.batchId === batchId)
      .sort((left, right) => left.itemIndex - right.itemIndex || left.id.localeCompare(right.id));
  }

  getBundle(batchId: string) {
    const batch = this.batchesById.get(batchId);
    if (!batch) throw new Error(`CanopyProof offline sync batch not found: ${batchId}`);
    return { batch, items: this.listItems(batchId) } as const;
  }

  getAuthoritySnapshot(): CanopyProofOfflineSyncAuthoritySnapshot {
    return {
      streamEvents: [...this.streamEvents],
      batches: this.listBatches(),
      items: this.listItems(),
    };
  }

  private replayBundle(batch: CanopyProofOfflineSyncBatchFact, itemFacts: readonly CanopyProofOfflineSyncItemFact[]) {
    const actor = normalizeActor(batch.actor);
    const previous = this.listBatches().at(-1);
    const items = [...itemFacts].sort((left, right) => left.itemIndex - right.itemIndex || left.id.localeCompare(right.id));
    const expectedPreviousRoot =
      previous?.batchRoot ?? offlineBatchGenesis(batch.deviceAttestationId, batch.deviceAttestationRoot);
    const expectedItems = items.map((item) => replayOfflineItem(item, batch, actor));
    const itemRoots = expectedItems.map((item) => item.itemRoot);
    const seed = offlineBatchFactSeed(batch);
    const commandHash = hashJson({
      kind: "canopyproof-offline-sync-batch-command-v1",
      ...offlineBatchCommandSeed(batch, items),
    });
    const batchHash = hashJson({ kind: "canopyproof-offline-sync-batch-v1", ...seed });
    const batchRoot = offlineBatchRoot({ ...seed, batchHash });
    if (
      batch.deviceSequence !== (previous?.deviceSequence ?? 0) + 1 ||
      batch.previousBatchRoot !== expectedPreviousRoot ||
      batch.itemCount !== items.length ||
      batch.reconciledCount !== items.filter((item) => item.result === "reconciled").length ||
      batch.needsReviewCount !== items.filter((item) => item.result === "needs_review").length ||
      hashJson(itemRoots) !== hashJson(batch.itemRoots) ||
      batch.manifestRoot !== merkleRoot(itemRoots) ||
      commandHash !== batch.commandHash ||
      batch.id !== `cp_offline_batch_${commandHash.slice(0, 24)}` ||
      batchHash !== batch.batchHash ||
      batchRoot !== batch.batchRoot
    ) {
      throw new Error(`CanopyProof offline sync batch lineage is invalid: ${batch.id}`);
    }
    assertSafety(batch.safety, batch.id);
    this.assertReplayEvent(batch, batch.batchState === "reconciled" ? "ASSERT" : "CHALLENGE", {
      factType: batch.factType,
      ...seed,
      batchHash,
      batchRoot,
      safety: batch.safety,
    });
    this.storeBundle(batch, expectedItems);
  }

  private assertReplayEvent(
    batch: CanopyProofOfflineSyncBatchFact,
    action: CanopyProofAuditEvent["action"],
    payload: unknown,
  ) {
    const event = this.streamEvents[batch.streamSequence - 1];
    if (!event || hashJson(event) !== hashJson(batch.auditEvent)) {
      throw new Error(`CanopyProof offline event position is invalid: ${batch.id}`);
    }
    const replayed = appendCanopyProofAuditEvent(this.streamEvents.slice(0, batch.streamSequence - 1), {
      action,
      actor: batch.subjectId,
      entityType: "evidence_sync_batch",
      entityId: batch.id,
      payload,
      createdAt: batch.receivedAt,
      rationale: offlineRationale,
    }).at(-1)!;
    if (hashJson(replayed) !== hashJson(batch.auditEvent)) {
      throw new Error(`CanopyProof offline semantic event is invalid: ${batch.id}`);
    }
  }

  private storeBundle(batch: CanopyProofOfflineSyncBatchFact, items: readonly CanopyProofOfflineSyncItemFact[]) {
    if (this.batchesById.has(batch.id) || this.batchIdsByClientId.has(batch.clientBatchId)) {
      throw new Error(`CanopyProof offline sync batch is duplicated: ${batch.id}`);
    }
    this.batchesById.set(batch.id, batch);
    this.batchIdsByClientId.set(batch.clientBatchId, batch.id);
    for (const item of items) {
      if (this.itemsById.has(item.id)) throw new Error(`CanopyProof offline sync item is duplicated: ${item.id}`);
      this.itemsById.set(item.id, item);
    }
  }

  private appendEvent(input: Parameters<typeof appendCanopyProofAuditEvent>[1]) {
    const event = appendCanopyProofAuditEvent(this.streamEvents, input).at(-1)!;
    this.streamEvents = [...this.streamEvents, event];
    return event;
  }

  private nextLineage() {
    return {
      streamSequence: this.streamEvents.length + 1,
      previousEventRoot: this.streamEvents.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    };
  }
}

export class CanopyProofCommunityAttestationAuthorityService {
  private readonly attestationsById = new Map<string, CanopyProofCommunityAttestationFact>();
  private readonly attestationIdByActor = new Map<string, string>();
  private streamEvents: CanopyProofAuditEvent[];

  constructor(streamEvents: readonly CanopyProofAuditEvent[] = []) {
    this.streamEvents = validateStreamEvents(streamEvents);
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofCommunityAttestationAuthoritySnapshot) {
    const service = new CanopyProofCommunityAttestationAuthorityService(snapshot.streamEvents);
    for (const fact of [...snapshot.attestations].sort(compareAttestations)) service.replayAttestation(fact);
    return service;
  }

  recordAttestation(input: unknown, authority: CanopyProofCommunityAttestationAuthority) {
    const parsed = communityAttestationInputSchema.parse(input);
    assertMillisecondTimestamp(parsed.observedAt, "community observedAt");
    assertMillisecondTimestamp(parsed.createdAt, "community createdAt");
    const actor = normalizeActor(authority.actor);
    assertCommunityAuthority(parsed, authority, actor);
    if (this.attestationIdByActor.has(actor.id)) {
      throw new Error("CanopyProof community actor already attested to this evidence.");
    }
    const reasonCodes = canonicalReasonCodes(parsed.reasonCodes);
    if (parsed.stance !== "support" && reasonCodes.length === 0) {
      throw new Error("CanopyProof community challenge or review request requires reason codes.");
    }
    if (parsed.stance === "support" && reasonCodes.length > 0) {
      throw new Error("CanopyProof supporting community context cannot include challenge reasons.");
    }
    const previous = this.listAttestations().at(-1);
    const normalized = {
      organizationId: authority.evidence.organizationId,
      projectId: authority.evidence.projectId,
      evidenceId: authority.evidence.id,
      evidenceRoot: authority.evidence.evidenceRoot,
      evidenceContributorId: authority.evidence.contributor,
      attesterId: actor.id,
      stance: parsed.stance,
      relationship: parsed.relationship,
      observationBasis: parsed.observationBasis,
      conflictOfInterestDeclared: false as const,
      noteHash: normalizeHash(parsed.noteHash),
      confidenceScore: parsed.confidenceScore,
      reasonCodes,
      ...(parsed.supportingMediaHash ? { supportingMediaHash: normalizeHash(parsed.supportingMediaHash) } : {}),
      ...(parsed.supportingGpsHash ? { supportingGpsHash: normalizeHash(parsed.supportingGpsHash) } : {}),
      observedAt: parsed.observedAt,
      createdAt: parsed.createdAt,
      attestationState: parsed.stance === "support" ? ("supporting_context" as const) : ("review_required" as const),
      attester: actor,
      attestationSequence: (previous?.attestationSequence ?? 0) + 1,
      previousAttestationRoot:
        previous?.attestationRoot ?? communityAttestationGenesis(authority.evidence.id, authority.evidence.evidenceRoot),
    };
    const commandHash = hashJson({ kind: "canopyproof-community-attestation-command-v1", ...normalized });
    const id = `cp_community_attestation_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const attestationHash = hashJson({ kind: "canopyproof-community-attestation-fact-v1", ...seed });
    const attestationRoot = communityAttestationRoot({ ...seed, attestationHash });
    const safety = canopyProofEvidenceOfflineCommunitySafetyBoundary();
    const payload = {
      factType: "evidence_community_attestation" as const,
      ...seed,
      attestationHash,
      attestationRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: communityAction(parsed.stance),
      actor: actor.id,
      entityType: "community_attestation",
      entityId: id,
      payload,
      createdAt: parsed.createdAt,
      rationale: communityRationale,
    });
    const fact: CanopyProofCommunityAttestationFact = { ...payload, auditEvent };
    this.storeAttestation(fact);
    return fact;
  }

  listAttestations() {
    return [...this.attestationsById.values()].sort(compareAttestations);
  }

  getAttestation(id: string) {
    const fact = this.attestationsById.get(id);
    if (!fact) throw new Error(`CanopyProof community attestation not found: ${id}`);
    return fact;
  }

  projectSignal(
    organizationId: string,
    evidenceId: string,
    evidenceRoot: string,
  ): CanopyProofCommunitySignalProjection {
    const facts = this.listAttestations();
    if (
      facts.some(
        (fact) =>
          fact.organizationId !== organizationId ||
          fact.evidenceId !== evidenceId ||
          fact.evidenceRoot !== evidenceRoot,
      )
    ) {
      throw new Error("CanopyProof community projection evidence authority mismatch.");
    }
    const state = facts.some((fact) => fact.attestationState === "review_required")
      ? "review_required"
      : facts.length > 0
        ? "supporting_context"
        : "no_context";
    const attestationRoots = facts.map((fact) => fact.attestationRoot);
    return {
      organizationId,
      evidenceId,
      evidenceRoot,
      state,
      attestationRoots,
      projectionRoot: hashJson({
        kind: "canopyproof-community-signal-projection-v1",
        organizationId,
        evidenceId,
        evidenceRoot,
        state,
        attestationRoots,
        advisoryOnly: true,
        finalVerificationChanged: false,
      }),
      advisoryOnly: true,
      finalVerificationChanged: false,
    };
  }

  getAuthoritySnapshot(): CanopyProofCommunityAttestationAuthoritySnapshot {
    return { streamEvents: [...this.streamEvents], attestations: this.listAttestations() };
  }

  private replayAttestation(fact: CanopyProofCommunityAttestationFact) {
    const actor = normalizeActor(fact.attester);
    const previous = this.listAttestations().at(-1);
    const seed = communityAttestationFactSeed(fact);
    const commandHash = hashJson({
      kind: "canopyproof-community-attestation-command-v1",
      ...communityAttestationCommandSeed(fact),
    });
    const attestationHash = hashJson({ kind: "canopyproof-community-attestation-fact-v1", ...seed });
    const attestationRoot = communityAttestationRoot({ ...seed, attestationHash });
    if (
      actor.id !== fact.attesterId ||
      fact.attesterId === fact.evidenceContributorId ||
      this.attestationIdByActor.has(fact.attesterId) ||
      fact.attestationSequence !== (previous?.attestationSequence ?? 0) + 1 ||
      fact.previousAttestationRoot !==
        (previous?.attestationRoot ?? communityAttestationGenesis(fact.evidenceId, fact.evidenceRoot)) ||
      fact.attestationState !== (fact.stance === "support" ? "supporting_context" : "review_required") ||
      commandHash !== fact.commandHash ||
      fact.id !== `cp_community_attestation_${commandHash.slice(0, 24)}` ||
      attestationHash !== fact.attestationHash ||
      attestationRoot !== fact.attestationRoot
    ) {
      throw new Error(`CanopyProof community attestation lineage is invalid: ${fact.id}`);
    }
    assertSafety(fact.safety, fact.id);
    const event = this.streamEvents[fact.streamSequence - 1];
    if (!event || hashJson(event) !== hashJson(fact.auditEvent)) {
      throw new Error(`CanopyProof community event position is invalid: ${fact.id}`);
    }
    const replayed = appendCanopyProofAuditEvent(this.streamEvents.slice(0, fact.streamSequence - 1), {
      action: communityAction(fact.stance),
      actor: fact.attesterId,
      entityType: "community_attestation",
      entityId: fact.id,
      payload: {
        factType: fact.factType,
        ...seed,
        attestationHash,
        attestationRoot,
        safety: fact.safety,
      },
      createdAt: fact.createdAt,
      rationale: communityRationale,
    }).at(-1)!;
    if (hashJson(replayed) !== hashJson(fact.auditEvent)) {
      throw new Error(`CanopyProof community semantic event is invalid: ${fact.id}`);
    }
    this.storeAttestation(fact);
  }

  private storeAttestation(fact: CanopyProofCommunityAttestationFact) {
    if (this.attestationsById.has(fact.id) || this.attestationIdByActor.has(fact.attesterId)) {
      throw new Error(`CanopyProof community attestation is duplicated: ${fact.id}`);
    }
    this.attestationsById.set(fact.id, fact);
    this.attestationIdByActor.set(fact.attesterId, fact.id);
  }

  private appendEvent(input: Parameters<typeof appendCanopyProofAuditEvent>[1]) {
    const event = appendCanopyProofAuditEvent(this.streamEvents, input).at(-1)!;
    this.streamEvents = [...this.streamEvents, event];
    return event;
  }

  private nextLineage() {
    return {
      streamSequence: this.streamEvents.length + 1,
      previousEventRoot: this.streamEvents.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    };
  }
}

export function canopyProofEvidenceOfflineCommunitySafetyBoundary(): CanopyProofEvidenceOfflineCommunitySafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    projectBound: true,
    evidenceBound: true,
    consentBound: true,
    deviceBound: true,
    semanticEventBound: true,
    exactRetryRequired: true,
    clientSequenceBound: true,
    localClockAdvisoryOnly: true,
    rawPayloadExcluded: true,
    rawLocationExcluded: true,
    rawCommunityNoteExcluded: true,
    rawContactDataExcluded: true,
    selfAttestationRejected: true,
    oneAttestationPerActorEvidence: true,
    communityAttestationNonFinal: true,
    communityCannotMutateVerification: true,
    humanReviewRequiredForChallenge: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function offlineBatchGenesis(deviceAttestationId: string, deviceAttestationRoot: string) {
  return hashJson({
    kind: "canopyproof-offline-sync-batch-genesis-v1",
    deviceAttestationId,
    deviceAttestationRoot,
  });
}

export function communityAttestationGenesis(evidenceId: string, evidenceRoot: string) {
  return hashJson({ kind: "canopyproof-community-attestation-genesis-v1", evidenceId, evidenceRoot });
}

function createOfflineItem(
  batchId: string,
  batchCommandHash: string,
  commandSeed: {
    readonly organizationId: string;
    readonly projectId: string;
    readonly subjectId: string;
    readonly deviceAttestationId: string;
  },
  binding: {
    readonly itemIndex: number;
    readonly clientRecordId: string;
    readonly evidenceId: string;
    readonly evidenceHash: string;
    readonly evidenceRoot: string;
    readonly clientPayloadHash: string;
    readonly result: CanopyProofOfflineItemState;
    readonly issueCodes: readonly string[];
  },
  safety: CanopyProofEvidenceOfflineCommunitySafetyBoundary,
): CanopyProofOfflineSyncItemFact {
  const seed = {
    batchId,
    batchCommandHash,
    organizationId: commandSeed.organizationId,
    projectId: commandSeed.projectId,
    subjectId: commandSeed.subjectId,
    deviceAttestationId: commandSeed.deviceAttestationId,
    ...binding,
  };
  const itemHash = hashJson({ kind: "canopyproof-offline-sync-item-v1", ...seed });
  const id = `cp_offline_item_${itemHash.slice(0, 24)}`;
  const itemRoot = hashJson({
    kind: "canopyproof-offline-sync-item-root-v1",
    batchCommandHash,
    itemIndex: binding.itemIndex,
    clientRecordId: binding.clientRecordId,
    evidenceRoot: binding.evidenceRoot,
    clientPayloadHash: binding.clientPayloadHash,
    result: binding.result,
    itemHash,
  });
  return { factType: "evidence_offline_sync_item", id, ...seed, itemHash, itemRoot, safety };
}

function replayOfflineItem(
  item: CanopyProofOfflineSyncItemFact,
  batch: CanopyProofOfflineSyncBatchFact,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
) {
  assertSafety(item.safety, item.id);
  const expected = createOfflineItem(
    batch.id,
    batch.commandHash,
    {
      organizationId: batch.organizationId,
      projectId: batch.projectId,
      subjectId: actor.id,
      deviceAttestationId: batch.deviceAttestationId,
    },
    {
      itemIndex: item.itemIndex,
      clientRecordId: item.clientRecordId,
      evidenceId: item.evidenceId,
      evidenceHash: item.evidenceHash,
      evidenceRoot: item.evidenceRoot,
      clientPayloadHash: item.clientPayloadHash,
      result: item.result,
      issueCodes: item.issueCodes,
    },
    item.safety,
  );
  if (hashJson(expected) !== hashJson(item)) {
    throw new Error(`CanopyProof offline sync item lineage is invalid: ${item.id}`);
  }
  return item;
}

function assertOfflineAuthority(
  input: z.infer<typeof offlineBatchInputSchema>,
  authority: CanopyProofOfflineSyncAuthority,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
) {
  if (
    actor.id !== authority.consent.subjectId ||
    actor.id !== authority.device.subjectId ||
    actor.organizationId !== authority.project.organizationId ||
    authority.device.organizationId !== authority.project.organizationId ||
    authority.consent.organizationId !== authority.project.organizationId ||
    authority.device.consentReceiptId !== authority.consent.id ||
    authority.device.consentReceiptRoot !== authority.consent.receiptRoot ||
    authority.consentProjection.receiptId !== authority.consent.id ||
    authority.consentProjection.state !== "active" ||
    authority.deviceProjection.attestationId !== authority.device.id ||
    !["current", "needs_review"].includes(authority.deviceProjection.state) ||
    authority.deviceProjection.consentProjectionRoot !== authority.consentProjection.projectionRoot ||
    !authority.consent.purposes.includes("evidence_collection") ||
    !authority.consent.purposes.includes("geolocation")
  ) {
    throw new Error("CanopyProof offline consent, device, actor, or project authority mismatch.");
  }
  if (
    authority.consent.deviceFingerprintHash &&
    normalizeHash(authority.consent.deviceFingerprintHash) !== normalizeHash(authority.device.deviceFingerprintHash)
  ) {
    throw new Error("CanopyProof offline consent device commitment mismatch.");
  }
  if (authority.registrations.length !== input.items.length) {
    throw new Error("CanopyProof offline authority registration count does not match the client manifest.");
  }
}

function assertOfflineRegistration(
  input: z.infer<typeof offlineBatchInputSchema>,
  authority: CanopyProofOfflineSyncAuthority,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
  binding: z.infer<typeof offlineItemInputSchema>,
  registration: CanopyProofEvidenceRegistration,
) {
  if (
    registration.id !== binding.evidenceId ||
    registration.evidenceRoot !== normalizeHash(binding.evidenceRoot) ||
    registration.organizationId !== authority.project.organizationId ||
    registration.projectId !== authority.project.id ||
    registration.projectRootAtSubmission !== authority.project.projectRoot ||
    registration.contributor !== actor.id ||
    registration.contributorRole !== actor.role ||
    registration.offline_sync_id !== input.clientBatchId ||
    normalizeHash(registration.device_fingerprint_hash ?? "") !== normalizeHash(authority.device.deviceFingerprintHash)
  ) {
    throw new Error(`CanopyProof offline evidence authority mismatch: ${registration.id}`);
  }
  if (
    Date.parse(registration.timestamp) < Date.parse(input.deviceClockStartedAt) ||
    Date.parse(registration.timestamp) > Date.parse(input.deviceClockEndedAt) ||
    Date.parse(registration.createdAt) > Date.parse(input.receivedAt)
  ) {
    throw new Error(`CanopyProof offline evidence chronology is invalid: ${registration.id}`);
  }
}

function assertCommunityAuthority(
  input: z.infer<typeof communityAttestationInputSchema>,
  authority: CanopyProofCommunityAttestationAuthority,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
) {
  if (!["community", "researcher", "verifier"].includes(actor.role)) {
    throw new Error("CanopyProof community attestation role is not eligible.");
  }
  if (actor.organizationId !== authority.evidence.organizationId) {
    throw new Error("CanopyProof community attestation organization authority mismatch.");
  }
  if (actor.id === authority.evidence.contributor) {
    throw new Error("CanopyProof evidence contributor cannot self-attest.");
  }
  if (
    Date.parse(input.observedAt) < Date.parse(authority.evidence.timestamp) ||
    Date.parse(input.observedAt) > Date.parse(input.createdAt) ||
    Date.parse(input.createdAt) < Date.parse(authority.evidence.createdAt)
  ) {
    throw new Error("CanopyProof community attestation chronology is invalid.");
  }
}

function assertOfflineChronology(startedAt: string, endedAt: string, receivedAt: string) {
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  const received = Date.parse(receivedAt);
  if (started > ended || ended > received || ended - started > 365 * 24 * 60 * 60 * 1_000) {
    throw new Error("CanopyProof offline batch clock interval is invalid.");
  }
}

function offlineItemIssues(
  registration: CanopyProofEvidenceRegistration,
  deviceState:
    | CanopyProofEvidenceDeviceAttestationProjection["state"]
    | CanopyProofEffectiveDeviceAttestationProjection["state"],
) {
  const issues: string[] = [...registration.validationIssues];
  if (registration.verification_status === "challenged") issues.push("evidence_registration_needs_review");
  if (deviceState !== "current") issues.push("device_attestation_needs_review");
  return canonicalReasonCodes(issues);
}

function offlineBatchIssues(
  deviceClockEndedAt: string,
  receivedAt: string,
  deviceState:
    | CanopyProofEvidenceDeviceAttestationProjection["state"]
    | CanopyProofEffectiveDeviceAttestationProjection["state"],
) {
  const issues: string[] = [];
  if (deviceState !== "current") issues.push("device_attestation_needs_review");
  if (Date.parse(receivedAt) - Date.parse(deviceClockEndedAt) > 30 * 24 * 60 * 60 * 1_000) {
    issues.push("offline_delivery_delay_needs_review");
  }
  return canonicalReasonCodes(issues);
}

function normalizeActor(input: CanopyProofEvidenceCustodyActorSnapshot): CanopyProofEvidenceCustodyActorSnapshot {
  const normalized = {
    id: identifierSchema.parse(input.id),
    participantType: input.participantType,
    role: input.role,
    verificationStatus: input.verificationStatus,
    organizationId: identifierSchema.parse(input.organizationId),
    organizationVerificationStatus: input.organizationVerificationStatus,
    participantRoot: normalizeHash(input.participantRoot),
    organizationRoot: normalizeHash(input.organizationRoot),
    membershipId: identifierSchema.parse(input.membershipId),
    membershipStatus: input.membershipStatus,
    membershipRoot: normalizeHash(input.membershipRoot),
  } as const;
  const authorityRoot = canopyProofEvidenceCustodyActorAuthorityRoot(normalized);
  if (
    normalized.participantType !== "human" ||
    normalized.verificationStatus !== "verified" ||
    normalized.organizationVerificationStatus !== "verified" ||
    normalized.membershipStatus !== "active" ||
    authorityRoot !== normalizeHash(input.authorityRoot)
  ) {
    throw new Error("CanopyProof E4 actor authority is invalid.");
  }
  return { ...normalized, authorityRoot };
}

function normalizeHash(value: string) {
  return hashSchema.parse(value).toLowerCase().replace(/^sha256:/, "");
}

function canonicalReasonCodes(values: readonly string[]) {
  return [...new Set(values.map((value) => reasonCodeSchema.parse(value)))].sort();
}

function assertMillisecondTimestamp(value: string, label: string) {
  if (new Date(value).toISOString() !== value) {
    throw new Error(`CanopyProof ${label} must be canonical millisecond UTC.`);
  }
}

function assertSafety(safety: CanopyProofEvidenceOfflineCommunitySafetyBoundary, id: string) {
  if (hashJson(safety) !== hashJson(canopyProofEvidenceOfflineCommunitySafetyBoundary())) {
    throw new Error(`CanopyProof E4 safety boundary is invalid: ${id}`);
  }
}

function validateStreamEvents(events: readonly CanopyProofAuditEvent[]) {
  const normalized = [...events];
  if (!verifyCanopyProofAuditChain(normalized)) throw new Error("CanopyProof E4 semantic event stream is invalid.");
  return normalized;
}

function offlineBatchRoot(input: ReturnType<typeof offlineBatchFactSeed> & { readonly batchHash: string }) {
  return hashJson({
    kind: "canopyproof-offline-sync-batch-root-v1",
    projectRoot: input.projectRoot,
    consentReceiptRoot: input.consentReceiptRoot,
    deviceAttestationRoot: input.deviceAttestationRoot,
    deviceProjectionRoot: input.deviceProjectionRoot,
    manifestRoot: input.manifestRoot,
    deviceSequence: input.deviceSequence,
    previousBatchRoot: input.previousBatchRoot,
    commandHash: input.commandHash,
    batchHash: input.batchHash,
    streamSequence: input.streamSequence,
    previousEventRoot: input.previousEventRoot,
  });
}

function communityAttestationRoot(
  input: ReturnType<typeof communityAttestationFactSeed> & { readonly attestationHash: string },
) {
  return hashJson({
    kind: "canopyproof-community-attestation-root-v1",
    evidenceRoot: input.evidenceRoot,
    attesterAuthorityRoot: input.attester.authorityRoot,
    stance: input.stance,
    noteHash: input.noteHash,
    attestationSequence: input.attestationSequence,
    previousAttestationRoot: input.previousAttestationRoot,
    commandHash: input.commandHash,
    attestationHash: input.attestationHash,
    streamSequence: input.streamSequence,
    previousEventRoot: input.previousEventRoot,
  });
}

function offlineBatchFactSeed(fact: CanopyProofOfflineSyncBatchFact) {
  return {
    id: fact.id,
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    projectRoot: fact.projectRoot,
    subjectId: fact.subjectId,
    consentReceiptId: fact.consentReceiptId,
    consentReceiptRoot: fact.consentReceiptRoot,
    consentProjectionRoot: fact.consentProjectionRoot,
    deviceAttestationId: fact.deviceAttestationId,
    deviceAttestationRoot: fact.deviceAttestationRoot,
    deviceProjectionState: fact.deviceProjectionState,
    deviceProjectionRoot: fact.deviceProjectionRoot,
    clientBatchId: fact.clientBatchId,
    deviceSequence: fact.deviceSequence,
    previousBatchRoot: fact.previousBatchRoot,
    deviceClockStartedAt: fact.deviceClockStartedAt,
    deviceClockEndedAt: fact.deviceClockEndedAt,
    receivedAt: fact.receivedAt,
    connectivity: fact.connectivity,
    itemCount: fact.itemCount,
    reconciledCount: fact.reconciledCount,
    needsReviewCount: fact.needsReviewCount,
    itemRoots: fact.itemRoots,
    manifestRoot: fact.manifestRoot,
    issueCodes: fact.issueCodes,
    batchState: fact.batchState,
    actor: fact.actor,
    commandHash: fact.commandHash,
    streamSequence: fact.streamSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function offlineBatchCommandSeed(
  batch: CanopyProofOfflineSyncBatchFact,
  items: readonly CanopyProofOfflineSyncItemFact[],
) {
  return {
    organizationId: batch.organizationId,
    projectId: batch.projectId,
    projectRoot: batch.projectRoot,
    subjectId: batch.subjectId,
    consentReceiptId: batch.consentReceiptId,
    consentReceiptRoot: batch.consentReceiptRoot,
    consentProjectionRoot: batch.consentProjectionRoot,
    deviceAttestationId: batch.deviceAttestationId,
    deviceAttestationRoot: batch.deviceAttestationRoot,
    deviceProjectionState: batch.deviceProjectionState,
    deviceProjectionRoot: batch.deviceProjectionRoot,
    clientBatchId: batch.clientBatchId,
    deviceSequence: batch.deviceSequence,
    previousBatchRoot: batch.previousBatchRoot,
    deviceClockStartedAt: batch.deviceClockStartedAt,
    deviceClockEndedAt: batch.deviceClockEndedAt,
    receivedAt: batch.receivedAt,
    connectivity: batch.connectivity,
    items: items.map((item) => ({
      itemIndex: item.itemIndex,
      clientRecordId: item.clientRecordId,
      evidenceId: item.evidenceId,
      evidenceHash: item.evidenceHash,
      evidenceRoot: item.evidenceRoot,
      clientPayloadHash: item.clientPayloadHash,
      result: item.result,
      issueCodes: item.issueCodes,
    })),
    actor: batch.actor,
  };
}

function communityAttestationFactSeed(fact: CanopyProofCommunityAttestationFact) {
  return {
    id: fact.id,
    ...communityAttestationCommandSeed(fact),
    commandHash: fact.commandHash,
    streamSequence: fact.streamSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function communityAttestationCommandSeed(fact: CanopyProofCommunityAttestationFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    evidenceRoot: fact.evidenceRoot,
    evidenceContributorId: fact.evidenceContributorId,
    attesterId: fact.attesterId,
    stance: fact.stance,
    relationship: fact.relationship,
    observationBasis: fact.observationBasis,
    conflictOfInterestDeclared: fact.conflictOfInterestDeclared,
    noteHash: fact.noteHash,
    confidenceScore: fact.confidenceScore,
    reasonCodes: fact.reasonCodes,
    ...(fact.supportingMediaHash ? { supportingMediaHash: fact.supportingMediaHash } : {}),
    ...(fact.supportingGpsHash ? { supportingGpsHash: fact.supportingGpsHash } : {}),
    observedAt: fact.observedAt,
    createdAt: fact.createdAt,
    attestationState: fact.attestationState,
    attester: fact.attester,
    attestationSequence: fact.attestationSequence,
    previousAttestationRoot: fact.previousAttestationRoot,
  };
}

function communityAction(stance: CanopyProofCommunityAttestationStance): CanopyProofAuditEvent["action"] {
  if (stance === "challenge") return "CHALLENGE";
  if (stance === "support") return "ASSERT";
  return "REASON";
}

function compareOfflineBatches(left: CanopyProofOfflineSyncBatchFact, right: CanopyProofOfflineSyncBatchFact) {
  return left.deviceSequence - right.deviceSequence || left.id.localeCompare(right.id);
}

function compareAttestations(left: CanopyProofCommunityAttestationFact, right: CanopyProofCommunityAttestationFact) {
  return left.attestationSequence - right.attestationSequence || left.id.localeCompare(right.id);
}
