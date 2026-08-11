import { hashJson } from "@dropin/crypto";
import {
  canopyProofMobileEvidenceBatchRequestSchema,
  canopyProofMobileEvidenceBatchResultSchema,
  canopyProofMobileEvidenceBindingRequestSchema,
  canopyProofMobileEvidenceBindingResultSchema,
  canopyProofMobileEvidenceRecoveryRequestSchema,
  canopyProofMobileEvidenceServerBindingSchema,
  type CanopyProofMobileEvidenceAcknowledgement,
  type CanopyProofMobileEvidenceBatchRequest,
  type CanopyProofMobileEvidenceBatchResult,
  type CanopyProofMobileEvidenceBindingRequest,
  type CanopyProofMobileEvidenceBindingResult,
  type CanopyProofMobileEvidenceServerBinding,
  type CanopyProofMobileEvidenceSyncCapture,
} from "@dropin/schemas/canopyproof-mobile-evidence";
import type {
  CanopyProofEvidenceConsentProjection,
  CanopyProofEvidenceConsentReceiptFact,
  CanopyProofEvidenceCustodyActorSnapshot,
  CanopyProofEvidenceCustodyRole,
  CanopyProofEvidenceDeviceAttestationFact,
  CanopyProofEvidenceDeviceAttestationProjection,
} from "./evidence-custody-authority.js";
import type { CanopyProofEffectiveDeviceAttestationProjection } from
  "./evidence-device-attestation-adapter-authority.js";
import {
  CanopyProofEvidenceOfflineSyncAuthorityService,
  offlineBatchGenesis,
  type CanopyProofOfflineSyncAuthoritySnapshot,
  type CanopyProofOfflineSyncBatchFact,
  type CanopyProofOfflineSyncItemFact,
} from "./evidence-offline-community-authority.js";
import type {
  CanopyProofEvidenceContributorRole,
  CanopyProofEvidenceRegistration,
  CanopyProofEvidenceRegistrationResult,
} from "./evidence-registry.js";
import type { CanopyProofProjectProfile } from "./project-registry.js";

export const canopyProofMobileEvidenceSyncRequiredPurposes = [
  "evidence_collection",
  "geolocation",
  "media_upload",
] as const;

export type CanopyProofMobileEvidenceSyncActor = Readonly<{
  id: string;
  role: CanopyProofEvidenceContributorRole & CanopyProofEvidenceCustodyRole;
  organizationId: string;
}>;

export type CanopyProofMobileEvidenceBindingAuthorityRequirements = Readonly<{
  actor: CanopyProofMobileEvidenceSyncActor;
  projectId: string;
  consentReceiptId: string;
  deviceAttestationId: string;
  deviceFingerprintHash: string;
  evaluatedAt: string;
}>;

export type CanopyProofMobileEvidenceBindingAuthoritySnapshot = Readonly<{
  actor: CanopyProofEvidenceCustodyActorSnapshot;
  project: CanopyProofProjectProfile;
  consent: CanopyProofEvidenceConsentReceiptFact;
  consentProjection: CanopyProofEvidenceConsentProjection;
  device: CanopyProofEvidenceDeviceAttestationFact;
  deviceProjection:
    | CanopyProofEvidenceDeviceAttestationProjection
    | CanopyProofEffectiveDeviceAttestationProjection;
}>;

export type CanopyProofMobileEvidenceAtomicRegistrationResult = Readonly<{
  registration: CanopyProofEvidenceRegistrationResult;
  consent: CanopyProofEvidenceConsentReceiptFact;
  device: CanopyProofEvidenceDeviceAttestationFact;
}>;

export interface CanopyProofMobileEvidenceSyncAuthoritySource {
  getEvidenceCustodyActorSnapshot(
    actorId: string,
    actorRole: CanopyProofEvidenceCustodyRole,
    organizationId: string,
  ): Promise<CanopyProofEvidenceCustodyActorSnapshot>;
  getProject(projectId: string): Promise<CanopyProofProjectProfile>;
  registerMobileEvidenceWithAuthority(
    input: unknown,
    requirements: CanopyProofMobileEvidenceBindingAuthorityRequirements,
    idempotencyKey: string,
  ): Promise<CanopyProofMobileEvidenceAtomicRegistrationResult>;
  getEvidence(evidenceId: string): Promise<CanopyProofEvidenceRegistration>;
  getEvidenceConsentReceipt(
    receiptId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceConsentReceiptFact>;
  getEvidenceConsentProjection(
    receiptId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEvidenceConsentProjection>;
  getEvidenceDeviceAttestation(
    attestationId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceDeviceAttestationFact>;
  getEvidenceEffectiveDeviceAttestationProjection(
    attestationId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<
    CanopyProofEvidenceDeviceAttestationProjection | CanopyProofEffectiveDeviceAttestationProjection
  >;
}

export interface CanopyProofMobileEvidenceSyncRepository {
  loadOfflineAuthoritySnapshot(
    organizationId: string,
    deviceAttestationId: string,
  ): Promise<CanopyProofOfflineSyncAuthoritySnapshot>;
  commitOfflineBundle(
    batch: CanopyProofOfflineSyncBatchFact,
    items: readonly CanopyProofOfflineSyncItemFact[],
    idempotencyKey: string,
  ): Promise<Readonly<{
    batch: CanopyProofOfflineSyncBatchFact;
    items: readonly CanopyProofOfflineSyncItemFact[];
  }>>;
}

export class CanopyProofMobileEvidenceSyncAuthorityError extends Error {
  constructor(
    readonly code:
      | "CANOPYPROOF_MOBILE_SYNC_AUTHORITY_MISMATCH"
      | "CANOPYPROOF_MOBILE_SYNC_CONSENT_INACTIVE"
      | "CANOPYPROOF_MOBILE_SYNC_DEVICE_INACTIVE"
      | "CANOPYPROOF_MOBILE_SYNC_HASH_MISMATCH"
      | "CANOPYPROOF_MOBILE_SYNC_BINDING_MISMATCH"
      | "CANOPYPROOF_MOBILE_SYNC_BATCH_CONFLICT"
      | "CANOPYPROOF_MOBILE_SYNC_BATCH_NOT_FOUND",
    readonly httpStatus: 403 | 404 | 409 | 422,
  ) {
    super(code);
    this.name = "CanopyProofMobileEvidenceSyncAuthorityError";
  }
}

export class CanopyProofMobileEvidenceSyncAuthorityService {
  constructor(
    private readonly source: CanopyProofMobileEvidenceSyncAuthoritySource,
    private readonly repository: CanopyProofMobileEvidenceSyncRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async bindDraft(
    input: unknown,
    actor: CanopyProofMobileEvidenceSyncActor,
    idempotencyKey: string,
  ): Promise<CanopyProofMobileEvidenceBindingResult> {
    const request = canopyProofMobileEvidenceBindingRequestSchema.parse(input);
    requireIdempotencyKey(idempotencyKey);
    if (request.clientBatchId !== mobileEvidenceClientBatchId(request.clientRecordId, idempotencyKey)) {
      throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_HASH_MISMATCH", 422);
    }
    assertSyncPayloadHash(request);
    const evaluatedAt = canonicalNow(this.now);
    const authority = await this.source.registerMobileEvidenceWithAuthority(
      evidenceRegistrationInput(request),
      {
        actor,
        projectId: request.capture.projectId,
        consentReceiptId: request.consentReceiptId,
        deviceAttestationId: request.deviceAttestationId,
        deviceFingerprintHash: request.capture.deviceFingerprintHash,
        evaluatedAt,
      },
      idempotencyKey,
    );
    const registration = authority.registration;
    assertCommittedBindingAuthorityFacts(authority, request, actor);
    assertRegistrationMatchesRequest(registration.evidence, request, actor);
    const auditEvent = registration.evidence.audit_history[0];
    if (!auditEvent) throw mismatch();
    const bindingSeed = {
      clientRecordId: request.clientRecordId,
      clientBatchId: request.clientBatchId,
      organizationId: actor.organizationId,
      projectId: request.capture.projectId,
      consentReceiptId: authority.consent.id,
      consentReceiptRoot: authority.consent.receiptRoot,
      deviceAttestationId: authority.device.id,
      deviceAttestationRoot: authority.device.attestationRoot,
      evidenceId: registration.evidence.id,
      evidenceRoot: registration.evidence.evidenceRoot,
      syncPayloadHash: request.syncPayloadHash,
      boundAt: auditEvent.createdAt,
    } as const;
    const binding = canopyProofMobileEvidenceServerBindingSchema.parse({
      ...bindingSeed,
      bindingRoot: mobileEvidenceBindingRoot(bindingSeed),
    });
    return canopyProofMobileEvidenceBindingResultSchema.parse({
      binding,
      structuralState: registration.evidence.verification_status,
      registrationAuditEventRoot: auditEvent.eventRoot,
      rawNotesRetained: false,
      finalVerification: false,
    });
  }

  async commitBatch(
    input: unknown,
    actor: CanopyProofMobileEvidenceSyncActor,
    idempotencyKey: string,
  ): Promise<CanopyProofMobileEvidenceBatchResult> {
    const request = canopyProofMobileEvidenceBatchRequestSchema.parse(input);
    requireIdempotencyKey(idempotencyKey);
    const evaluatedAt = canonicalNow(this.now);
    const authority = await this.loadBatchAuthority(request, actor, evaluatedAt);
    const snapshot = await this.repository.loadOfflineAuthoritySnapshot(
      actor.organizationId,
      request.deviceAttestationId,
    );
    const existing = snapshot.batches.find((candidate) => candidate.clientBatchId === request.clientBatchId);
    if (existing) {
      const existingItems = snapshot.items
        .filter((item) => item.batchId === existing.id)
        .sort((left, right) => left.itemIndex - right.itemIndex);
      assertExistingBatchMatchesRequest(existing, existingItems, request, actor);
      const replayed = await this.repository.commitOfflineBundle(existing, existingItems, idempotencyKey);
      return batchResult(replayed.batch, replayed.items, true);
    }

    const previous = [...snapshot.batches].sort((left, right) => left.deviceSequence - right.deviceSequence).at(-1);
    const domain = CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(snapshot);
    const proposed = domain.recordOfflineBundle(
      {
        clientBatchId: request.clientBatchId,
        deviceSequence: (previous?.deviceSequence ?? 0) + 1,
        previousBatchRoot:
          previous?.batchRoot ?? offlineBatchGenesis(authority.device.id, authority.device.attestationRoot),
        deviceClockStartedAt: request.deviceClockStartedAt,
        deviceClockEndedAt: request.deviceClockEndedAt,
        receivedAt: evaluatedAt,
        connectivity: request.connectivity,
        items: request.bindings.map((binding) => ({
          clientRecordId: binding.clientRecordId,
          evidenceId: binding.evidenceId,
          evidenceRoot: binding.evidenceRoot,
          clientPayloadHash: binding.syncPayloadHash,
        })),
      },
      authority,
    );
    const committed = await this.repository.commitOfflineBundle(
      proposed.batch,
      proposed.items,
      idempotencyKey,
    );
    return batchResult(committed.batch, committed.items, false);
  }

  async recoverBatch(
    input: unknown,
    actor: CanopyProofMobileEvidenceSyncActor,
  ): Promise<CanopyProofMobileEvidenceBatchResult> {
    const request = canopyProofMobileEvidenceRecoveryRequestSchema.parse(input);
    const evaluatedAt = canonicalNow(this.now);
    const project = await this.source.getProject(request.projectId);
    if (project.organizationId !== actor.organizationId) throw mismatch();
    const actorAuthority = await this.source.getEvidenceCustodyActorSnapshot(
      actor.id,
      actor.role,
      actor.organizationId,
    );
    const device = await this.source.getEvidenceDeviceAttestation(
      request.deviceAttestationId,
      actor.organizationId,
    );
    const projection = await this.source.getEvidenceEffectiveDeviceAttestationProjection(
      request.deviceAttestationId,
      actor.organizationId,
      evaluatedAt,
    );
    assertActorDeviceAuthority(actorAuthority, device, projection, actor, undefined);
    const snapshot = await this.repository.loadOfflineAuthoritySnapshot(
      actor.organizationId,
      request.deviceAttestationId,
    );
    const batch = snapshot.batches.find((candidate) => candidate.clientBatchId === request.clientBatchId);
    if (!batch || batch.projectId !== request.projectId || batch.actor.id !== actor.id) {
      throw new CanopyProofMobileEvidenceSyncAuthorityError(
        "CANOPYPROOF_MOBILE_SYNC_BATCH_NOT_FOUND",
        404,
      );
    }
    const items = snapshot.items
      .filter((item) => item.batchId === batch.id)
      .sort((left, right) => left.itemIndex - right.itemIndex);
    return batchResult(batch, items, true);
  }

  private async loadBatchAuthority(
    request: CanopyProofMobileEvidenceBatchRequest,
    actor: CanopyProofMobileEvidenceSyncActor,
    evaluatedAt: string,
  ) {
    const [actorAuthority, project, consent, consentProjection, device, deviceProjection, ...registrations] =
      await Promise.all([
        this.source.getEvidenceCustodyActorSnapshot(actor.id, actor.role, actor.organizationId),
        this.source.getProject(request.projectId),
        this.source.getEvidenceConsentReceipt(request.consentReceiptId, actor.organizationId),
        this.source.getEvidenceConsentProjection(request.consentReceiptId, actor.organizationId, evaluatedAt),
        this.source.getEvidenceDeviceAttestation(request.deviceAttestationId, actor.organizationId),
        this.source.getEvidenceEffectiveDeviceAttestationProjection(
          request.deviceAttestationId,
          actor.organizationId,
          evaluatedAt,
        ),
        ...request.bindings.map((binding) => this.source.getEvidence(binding.evidenceId)),
      ]);
    if (project.organizationId !== actor.organizationId) throw mismatch();
    assertConsentAuthority(consent, consentProjection, actorAuthority);
    assertActorDeviceAuthority(actorAuthority, device, deviceProjection, actor, request.consentReceiptId);
    for (const [index, binding] of request.bindings.entries()) {
      const registration = registrations[index];
      if (!registration) throw mismatch();
      assertBinding(binding, registration, request, actor, consent, device);
    }
    return {
      actor: actorAuthority,
      project: {
        id: project.id,
        organizationId: project.organizationId,
        regionId: project.regionId,
        status: project.status,
        projectRoot: project.projectRoot,
        updatedAt: project.updatedAt,
      },
      consent,
      consentProjection,
      device,
      deviceProjection,
      registrations,
    };
  }
}

export function mobileEvidenceSyncPayloadHash(capture: CanopyProofMobileEvidenceSyncCapture): string {
  return hashJson({ domain: "canopyproof/mobile-evidence/sync-projection/v1", capture });
}

export function mobileEvidenceBindingRoot(
  binding: Omit<CanopyProofMobileEvidenceServerBinding, "bindingRoot">,
): string {
  return hashJson({ kind: "canopyproof-mobile-evidence-server-binding-v1", ...binding });
}

export function mobileEvidenceClientBatchId(clientRecordId: string, idempotencyKey: string): string {
  const identityHash = hashJson({
    domain: "canopyproof/mobile-evidence/batch-identity/v1",
    clientRecordId,
    idempotencyKey,
  });
  return `cp_mobile_evidence_batch_${identityHash.slice(0, 32)}`;
}

function evidenceRegistrationInput(request: CanopyProofMobileEvidenceBindingRequest) {
  const capture = request.capture;
  return {
    projectId: capture.projectId,
    evidenceType: mapEvidenceType(capture.evidenceType),
    location: {
      latitude: capture.latitude,
      longitude: capture.longitude,
      accuracyMeters: capture.gpsAccuracyMeters,
    },
    timestamp: capture.observedAt,
    media_hash: capture.mediaHash,
    gps_hash: hashJson({
      kind: "canopyproof-mobile-evidence-gps-v1",
      latitude: capture.latitude,
      longitude: capture.longitude,
      accuracyMeters: capture.gpsAccuracyMeters,
    }),
    confidence_score: 80,
    offline_sync_id: request.clientBatchId,
    device_fingerprint_hash: capture.deviceFingerprintHash,
    ...(capture.exifHash ? { exif_hash: capture.exifHash } : {}),
    createdAt: request.queuedAt,
  } as const;
}

function mapEvidenceType(type: CanopyProofMobileEvidenceSyncCapture["evidenceType"]) {
  if (type === "water") return "water_project" as const;
  if (type === "soil") return "soil_regeneration" as const;
  return type;
}

function assertSyncPayloadHash(request: CanopyProofMobileEvidenceBindingRequest) {
  if (mobileEvidenceSyncPayloadHash(request.capture) !== request.syncPayloadHash) {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_HASH_MISMATCH", 422);
  }
}

export function assertCanopyProofMobileEvidenceBindingAuthority(
  authority: CanopyProofMobileEvidenceBindingAuthoritySnapshot,
  requirements: CanopyProofMobileEvidenceBindingAuthorityRequirements,
) {
  if (
    authority.project.id !== requirements.projectId ||
    authority.project.organizationId !== requirements.actor.organizationId ||
    authority.consent.id !== requirements.consentReceiptId ||
    authority.device.id !== requirements.deviceAttestationId
  ) {
    throw mismatch();
  }
  assertConsentAuthority(
    authority.consent,
    authority.consentProjection,
    authority.actor,
    requirements.deviceFingerprintHash,
  );
  assertActorDeviceAuthority(
    authority.actor,
    authority.device,
    authority.deviceProjection,
    requirements.actor,
    requirements.consentReceiptId,
  );
  if (authority.device.deviceFingerprintHash !== requirements.deviceFingerprintHash) throw mismatch();
}

function assertCommittedBindingAuthorityFacts(
  authority: CanopyProofMobileEvidenceAtomicRegistrationResult,
  request: CanopyProofMobileEvidenceBindingRequest,
  actor: CanopyProofMobileEvidenceSyncActor,
) {
  if (
    authority.consent.id !== request.consentReceiptId ||
    authority.consent.organizationId !== actor.organizationId ||
    authority.consent.subjectId !== actor.id ||
    authority.device.id !== request.deviceAttestationId ||
    authority.device.organizationId !== actor.organizationId ||
    authority.device.subjectId !== actor.id ||
    authority.device.consentReceiptId !== authority.consent.id ||
    authority.device.deviceFingerprintHash !== request.capture.deviceFingerprintHash
  ) {
    throw mismatch();
  }
}

function assertConsentAuthority(
  consent: CanopyProofEvidenceConsentReceiptFact,
  projection: CanopyProofEvidenceConsentProjection,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
  deviceFingerprintHash?: string,
) {
  if (
    consent.organizationId !== actor.organizationId ||
    consent.subjectId !== actor.id ||
    consent.subjectAuthorityRoot !== actor.authorityRoot ||
    projection.receiptId !== consent.id ||
    projection.receiptRoot !== consent.receiptRoot ||
    projection.organizationId !== actor.organizationId ||
    projection.subjectId !== actor.id
  ) {
    throw mismatch();
  }
  if (projection.state !== "active") {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_CONSENT_INACTIVE", 403);
  }
  if (!canopyProofMobileEvidenceSyncRequiredPurposes.every((purpose) => consent.purposes.includes(purpose))) {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_CONSENT_INACTIVE", 403);
  }
  if (deviceFingerprintHash && consent.deviceFingerprintHash && consent.deviceFingerprintHash !== deviceFingerprintHash) {
    throw mismatch();
  }
}

function assertActorDeviceAuthority(
  actorAuthority: CanopyProofEvidenceCustodyActorSnapshot,
  device: CanopyProofEvidenceDeviceAttestationFact,
  projection:
    | CanopyProofEvidenceDeviceAttestationProjection
    | CanopyProofEffectiveDeviceAttestationProjection,
  actor: CanopyProofMobileEvidenceSyncActor,
  consentReceiptId: string | undefined,
) {
  if (
    actorAuthority.id !== actor.id ||
    actorAuthority.role !== actor.role ||
    actorAuthority.organizationId !== actor.organizationId ||
    device.organizationId !== actor.organizationId ||
    device.subjectId !== actor.id ||
    device.subjectAuthorityRoot !== actorAuthority.authorityRoot ||
    projection.attestationId !== device.id ||
    projection.attestationRoot !== device.attestationRoot ||
    projection.organizationId !== actor.organizationId ||
    projection.subjectId !== actor.id ||
    projection.consentReceiptId !== device.consentReceiptId ||
    (consentReceiptId !== undefined && device.consentReceiptId !== consentReceiptId)
  ) {
    throw mismatch();
  }
  if (projection.state !== "current" && projection.state !== "needs_review") {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_DEVICE_INACTIVE", 403);
  }
}

function assertRegistrationMatchesRequest(
  registration: CanopyProofEvidenceRegistration,
  request: CanopyProofMobileEvidenceBindingRequest,
  actor: CanopyProofMobileEvidenceSyncActor,
) {
  if (
    registration.projectId !== request.capture.projectId ||
    registration.organizationId !== actor.organizationId ||
    registration.contributor !== actor.id ||
    registration.contributorRole !== actor.role ||
    registration.media_hash !== request.capture.mediaHash ||
    registration.device_fingerprint_hash !== request.capture.deviceFingerprintHash ||
    registration.offline_sync_id !== request.clientBatchId ||
    registration.timestamp !== request.capture.observedAt
  ) {
    throw mismatch();
  }
}

function assertBinding(
  binding: CanopyProofMobileEvidenceServerBinding,
  registration: CanopyProofEvidenceRegistration,
  request: CanopyProofMobileEvidenceBatchRequest,
  actor: CanopyProofMobileEvidenceSyncActor,
  consent: CanopyProofEvidenceConsentReceiptFact,
  device: CanopyProofEvidenceDeviceAttestationFact,
) {
  const seed = bindingSeed(binding);
  if (
    mobileEvidenceBindingRoot(seed) !== binding.bindingRoot ||
    binding.clientBatchId !== request.clientBatchId ||
    binding.organizationId !== actor.organizationId ||
    binding.projectId !== request.projectId ||
    binding.consentReceiptId !== consent.id ||
    binding.consentReceiptRoot !== consent.receiptRoot ||
    binding.deviceAttestationId !== device.id ||
    binding.deviceAttestationRoot !== device.attestationRoot ||
    binding.evidenceId !== registration.id ||
    binding.evidenceRoot !== registration.evidenceRoot ||
    registration.organizationId !== actor.organizationId ||
    registration.projectId !== request.projectId ||
    registration.contributor !== actor.id ||
    registration.offline_sync_id !== binding.clientBatchId
  ) {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_BINDING_MISMATCH", 422);
  }
}

function bindingSeed(binding: CanopyProofMobileEvidenceServerBinding) {
  return {
    clientRecordId: binding.clientRecordId,
    clientBatchId: binding.clientBatchId,
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    consentReceiptId: binding.consentReceiptId,
    consentReceiptRoot: binding.consentReceiptRoot,
    deviceAttestationId: binding.deviceAttestationId,
    deviceAttestationRoot: binding.deviceAttestationRoot,
    evidenceId: binding.evidenceId,
    evidenceRoot: binding.evidenceRoot,
    syncPayloadHash: binding.syncPayloadHash,
    boundAt: binding.boundAt,
  } as const;
}

function assertExistingBatchMatchesRequest(
  batch: CanopyProofOfflineSyncBatchFact,
  items: readonly CanopyProofOfflineSyncItemFact[],
  request: CanopyProofMobileEvidenceBatchRequest,
  actor: CanopyProofMobileEvidenceSyncActor,
) {
  const mismatchFound =
    batch.organizationId !== actor.organizationId ||
    batch.actor.id !== actor.id ||
    batch.projectId !== request.projectId ||
    batch.consentReceiptId !== request.consentReceiptId ||
    batch.deviceAttestationId !== request.deviceAttestationId ||
    batch.connectivity !== request.connectivity ||
    batch.deviceClockStartedAt !== request.deviceClockStartedAt ||
    batch.deviceClockEndedAt !== request.deviceClockEndedAt ||
    items.length !== request.bindings.length ||
    request.bindings.some((binding, index) => {
      const item = items[index];
      return !item || item.clientRecordId !== binding.clientRecordId ||
        item.evidenceId !== binding.evidenceId || item.evidenceRoot !== binding.evidenceRoot ||
        item.clientPayloadHash !== binding.syncPayloadHash;
    });
  if (mismatchFound) {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_BATCH_CONFLICT", 409);
  }
}

function batchResult(
  batch: CanopyProofOfflineSyncBatchFact,
  items: readonly CanopyProofOfflineSyncItemFact[],
  recovered: boolean,
): CanopyProofMobileEvidenceBatchResult {
  const acknowledgements: CanopyProofMobileEvidenceAcknowledgement[] = items
    .slice()
    .sort((left, right) => left.itemIndex - right.itemIndex)
    .map((item) => ({
      clientRecordId: item.clientRecordId,
      evidenceId: item.evidenceId,
      evidenceRoot: item.evidenceRoot,
      itemRoot: item.itemRoot,
      batchId: batch.id,
      batchRoot: batch.batchRoot,
      auditEventRoot: batch.auditEvent.eventRoot,
      acknowledgedAt: batch.receivedAt,
    }));
  return canopyProofMobileEvidenceBatchResultSchema.parse({
    clientBatchId: batch.clientBatchId,
    batchState: batch.batchState,
    acknowledgements,
    recovered,
  });
}

function requireIdempotencyKey(value: string) {
  if (value.trim() !== value || value.length < 16 || value.length > 512) {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_HASH_MISMATCH", 422);
  }
}

function canonicalNow(now: () => Date) {
  const value = now();
  if (!Number.isFinite(value.getTime())) {
    throw new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_HASH_MISMATCH", 422);
  }
  return value.toISOString();
}

function mismatch() {
  return new CanopyProofMobileEvidenceSyncAuthorityError("CANOPYPROOF_MOBILE_SYNC_AUTHORITY_MISMATCH", 403);
}
