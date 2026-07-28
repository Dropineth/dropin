import {
  canopyProofMobileEvidenceBatchRequestSchema,
  canopyProofMobileEvidenceBatchResultSchema,
  canopyProofMobileEvidenceBindingRequestSchema,
  canopyProofMobileEvidenceBindingResultSchema,
  canopyProofMobileEvidenceRecoveryRequestSchema,
  canopyProofMobileEvidenceServerBindingSchema,
  canopyProofMobileEvidenceSyncCaptureSchema,
  type CanopyProofMobileEvidenceBatchRequest,
  type CanopyProofMobileEvidenceBatchResult,
  type CanopyProofMobileEvidenceBindingResult,
  type CanopyProofMobileEvidenceBindingRequest,
  type CanopyProofMobileEvidenceConnectivityMode,
  type CanopyProofMobileEvidenceDraft,
  type CanopyProofMobileEvidenceServerBinding,
  type CanopyProofMobileEvidenceSyncCapture,
} from "@dropin/schemas/canopyproof-mobile-evidence";
import {
  CanopyProofMobileEvidenceVault,
  CanopyProofMobileEvidenceVaultError,
} from "./canopyproof-mobile-evidence-vault";

export type CanopyProofMobileEvidenceSyncPrerequisites = Readonly<{
  consentReceiptId: string;
  deviceAttestationId: string;
  connectivity: CanopyProofMobileEvidenceConnectivityMode;
}>;

export interface CanopyProofMobileEvidenceSyncTransport {
  bindDraft(
    request: CanopyProofMobileEvidenceBindingRequest,
    idempotencyKey: string,
  ): Promise<CanopyProofMobileEvidenceBindingResult>;
  commitBatch(
    request: CanopyProofMobileEvidenceBatchRequest,
    idempotencyKey: string,
  ): Promise<CanopyProofMobileEvidenceBatchResult>;
  recoverBatch(
    request: Readonly<{
      schemaVersion: "canopyproof.mobile-evidence-recovery-request/v1";
      clientBatchId: string;
      projectId: string;
      deviceAttestationId: string;
    }>,
  ): Promise<CanopyProofMobileEvidenceBatchResult>;
}

export class CanopyProofMobileEvidenceSyncTransportError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(normalizeProtocolErrorCode(code), options);
    this.name = "CanopyProofMobileEvidenceSyncTransportError";
  }
}

export type CanopyProofMobileEvidenceSyncCoordinatorOptions = Readonly<{
  vault: CanopyProofMobileEvidenceVault;
  transport: CanopyProofMobileEvidenceSyncTransport;
  enabled?: boolean;
  crypto?: Crypto;
  now?: () => Date;
  retryDelayMs?: number;
}>;

export class CanopyProofMobileEvidenceSyncCoordinator {
  private readonly vault: CanopyProofMobileEvidenceVault;
  private readonly transport: CanopyProofMobileEvidenceSyncTransport;
  private readonly enabled: boolean;
  private readonly crypto: Crypto;
  private readonly now: () => Date;
  private readonly retryDelayMs: number;

  constructor(options: CanopyProofMobileEvidenceSyncCoordinatorOptions) {
    this.vault = options.vault;
    this.transport = options.transport;
    this.enabled = options.enabled ?? false;
    this.crypto = options.crypto ?? requireWebCrypto();
    this.now = options.now ?? (() => new Date());
    this.retryDelayMs = options.retryDelayMs ?? 30_000;
    if (!Number.isSafeInteger(this.retryDelayMs) || this.retryDelayMs < 1_000 || this.retryDelayMs > 3_600_000) {
      throw new CanopyProofMobileEvidenceSyncTransportError(
        "CANOPYPROOF_MOBILE_SYNC_CONFIGURATION_INVALID",
        false,
      );
    }
  }

  async syncOne(
    recordId: string,
    prerequisites: CanopyProofMobileEvidenceSyncPrerequisites,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    this.requireEnabled();
    let draft = await this.vault.getDraft(recordId);
    if (draft.state === "acknowledged" || draft.state === "rejected") return draft;

    if (draft.state === "draft_queued" || draft.state === "blocked_prerequisites") {
      try {
        const request = await buildMobileEvidenceBindingRequest(this.crypto, draft, prerequisites);
        const response = canopyProofMobileEvidenceBindingResultSchema.parse(
          await this.transport.bindDraft(request, draft.idempotencyKey),
        );
        await assertBindingResponse(this.crypto, request, response);
        draft = await this.vault.bindServerAuthority(recordId, response.binding);
      } catch (error) {
        const protocolError = normalizeTransportError(error);
        return this.vault.markPrerequisitesBlocked(recordId, protocolError.message);
      }
    }

    if (draft.state !== "ready_to_sync") {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
    }
    draft = await this.vault.leaseForSync(recordId);
    try {
      const request = await buildMobileEvidenceBatchRequest(this.crypto, draft, prerequisites);
      const response = canopyProofMobileEvidenceBatchResultSchema.parse(
        await this.transport.commitBatch(request, mobileEvidenceBatchIdempotencyKey(request.clientBatchId)),
      );
      const acknowledgement = requireDraftAcknowledgement(response, draft);
      return await this.vault.acknowledge(recordId, acknowledgement);
    } catch (error) {
      const protocolError = normalizeTransportError(error);
      if (!protocolError.retryable) return this.vault.reject(recordId, protocolError.message);
      const retryAt = new Date(requireNow(this.now).getTime() + this.retryDelayMs).toISOString();
      return this.vault.releaseForRetry(recordId, protocolError.message, retryAt);
    }
  }

  async recoverOne(
    recordId: string,
    prerequisites: CanopyProofMobileEvidenceSyncPrerequisites,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    this.requireEnabled();
    let draft = await this.vault.getDraft(recordId);
    if (draft.state === "acknowledged" || draft.state === "rejected") return draft;
    if (draft.state === "ready_to_sync") draft = await this.vault.leaseForSync(recordId);
    if (draft.state !== "sync_leased" || draft.serverBinding === null) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
    }
    const batch = await buildMobileEvidenceBatchRequest(this.crypto, draft, prerequisites);
    const request = canopyProofMobileEvidenceRecoveryRequestSchema.parse({
      schemaVersion: "canopyproof.mobile-evidence-recovery-request/v1",
      clientBatchId: batch.clientBatchId,
      projectId: batch.projectId,
      deviceAttestationId: batch.deviceAttestationId,
    });
    try {
      const response = canopyProofMobileEvidenceBatchResultSchema.parse(await this.transport.recoverBatch(request));
      return this.vault.acknowledge(recordId, requireDraftAcknowledgement(response, draft));
    } catch (error) {
      const protocolError = normalizeTransportError(error);
      if (!protocolError.retryable) return this.vault.reject(recordId, protocolError.message);
      const retryAt = new Date(requireNow(this.now).getTime() + this.retryDelayMs).toISOString();
      return this.vault.releaseForRetry(recordId, protocolError.message, retryAt);
    }
  }

  private requireEnabled() {
    if (!this.enabled) {
      throw new CanopyProofMobileEvidenceSyncTransportError("CANOPYPROOF_MOBILE_SYNC_DISABLED", false);
    }
  }
}

export async function buildMobileEvidenceBindingRequest(
  crypto: Crypto,
  draft: CanopyProofMobileEvidenceDraft,
  prerequisites: CanopyProofMobileEvidenceSyncPrerequisites,
): Promise<CanopyProofMobileEvidenceBindingRequest> {
  if (draft.state !== "draft_queued" && draft.state !== "blocked_prerequisites") {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
  }
  const notesHash = draft.capture.notes === null
    ? null
    : await sha256Hex(crypto, {
        domain: "canopyproof/mobile-evidence/note/v1",
        note: draft.capture.notes,
      });
  const capture = canopyProofMobileEvidenceSyncCaptureSchema.parse({
    evidenceType: draft.capture.evidenceType,
    projectId: draft.capture.projectId,
    observedAt: draft.capture.observedAt,
    latitude: draft.capture.latitude,
    longitude: draft.capture.longitude,
    gpsAccuracyMeters: draft.capture.gpsAccuracyMeters,
    mediaHash: draft.capture.mediaHash,
    deviceFingerprintHash: draft.capture.deviceFingerprintHash,
    exifHash: draft.capture.exifHash,
    notesHash,
  });
  const identityHash = await sha256Hex(crypto, {
    domain: "canopyproof/mobile-evidence/batch-identity/v1",
    clientRecordId: draft.id,
    idempotencyKey: draft.idempotencyKey,
  });
  return canopyProofMobileEvidenceBindingRequestSchema.parse({
    schemaVersion: "canopyproof.mobile-evidence-binding-request/v1",
    clientRecordId: draft.id,
    clientBatchId: `cp_mobile_evidence_batch_${identityHash.slice(0, 32)}`,
    syncPayloadHash: await mobileEvidenceSyncPayloadHash(crypto, capture),
    capture,
    consentReceiptId: prerequisites.consentReceiptId,
    deviceAttestationId: prerequisites.deviceAttestationId,
    queuedAt: draft.createdAt,
  });
}

export async function buildMobileEvidenceBatchRequest(
  crypto: Crypto,
  draft: CanopyProofMobileEvidenceDraft,
  prerequisites: CanopyProofMobileEvidenceSyncPrerequisites,
): Promise<CanopyProofMobileEvidenceBatchRequest> {
  const binding = draft.serverBinding;
  if ((draft.state !== "ready_to_sync" && draft.state !== "sync_leased") || binding === null) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
  }
  if (
    binding.consentReceiptId !== prerequisites.consentReceiptId ||
    binding.deviceAttestationId !== prerequisites.deviceAttestationId
  ) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
  }
  await assertServerBindingRoot(crypto, binding);
  return canopyProofMobileEvidenceBatchRequestSchema.parse({
    schemaVersion: "canopyproof.mobile-evidence-batch-request/v1",
    clientBatchId: binding.clientBatchId,
    projectId: binding.projectId,
    consentReceiptId: binding.consentReceiptId,
    deviceAttestationId: binding.deviceAttestationId,
    connectivity: prerequisites.connectivity,
    deviceClockStartedAt: draft.capture.observedAt,
    deviceClockEndedAt: draft.createdAt,
    bindings: [binding],
  });
}

export async function mobileEvidenceSyncPayloadHash(
  crypto: Crypto,
  capture: CanopyProofMobileEvidenceSyncCapture,
) {
  return sha256Hex(crypto, { domain: "canopyproof/mobile-evidence/sync-projection/v1", capture });
}

async function assertBindingResponse(
  crypto: Crypto,
  request: CanopyProofMobileEvidenceBindingRequest,
  response: CanopyProofMobileEvidenceBindingResult,
) {
  const binding = canopyProofMobileEvidenceServerBindingSchema.parse(response.binding);
  if (
    response.rawNotesRetained ||
    response.finalVerification ||
    binding.clientRecordId !== request.clientRecordId ||
    binding.clientBatchId !== request.clientBatchId ||
    binding.projectId !== request.capture.projectId ||
    binding.consentReceiptId !== request.consentReceiptId ||
    binding.deviceAttestationId !== request.deviceAttestationId ||
    binding.syncPayloadHash !== request.syncPayloadHash
  ) {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_SYNC_BINDING_MISMATCH",
      false,
    );
  }
  await assertServerBindingRoot(crypto, binding);
}

async function assertServerBindingRoot(crypto: Crypto, binding: CanopyProofMobileEvidenceServerBinding) {
  const { bindingRoot, ...seed } = binding;
  const expected = await sha256Hex(crypto, {
    kind: "canopyproof-mobile-evidence-server-binding-v1",
    ...seed,
  });
  if (bindingRoot !== expected) {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_SYNC_BINDING_MISMATCH",
      false,
    );
  }
}

function requireDraftAcknowledgement(
  result: CanopyProofMobileEvidenceBatchResult,
  draft: CanopyProofMobileEvidenceDraft,
) {
  const binding = draft.serverBinding;
  if (binding === null) {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_SYNC_ACKNOWLEDGEMENT_MISMATCH",
      false,
    );
  }
  const acknowledgement = result.acknowledgements.find((candidate) => candidate.clientRecordId === draft.id);
  if (
    !acknowledgement ||
    acknowledgement.evidenceId !== binding.evidenceId ||
    acknowledgement.evidenceRoot !== binding.evidenceRoot
  ) {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_SYNC_ACKNOWLEDGEMENT_MISMATCH",
      false,
    );
  }
  return acknowledgement;
}

function mobileEvidenceBatchIdempotencyKey(clientBatchId: string) {
  return `cp_mobile_evidence_batch_command_${clientBatchId.slice("cp_mobile_evidence_batch_".length)}`;
}

function normalizeTransportError(error: unknown) {
  if (error instanceof CanopyProofMobileEvidenceSyncTransportError) return error;
  return new CanopyProofMobileEvidenceSyncTransportError(
    "CANOPYPROOF_MOBILE_SYNC_TRANSPORT_UNAVAILABLE",
    true,
    { cause: error },
  );
}

function normalizeProtocolErrorCode(input: string) {
  const value = input.trim().toUpperCase();
  if (!/^CANOPYPROOF_[A-Z0-9_]{1,120}$/.test(value)) return "CANOPYPROOF_MOBILE_SYNC_PROTOCOL_ERROR";
  return value;
}

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.getRandomValues !== "function") {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE",
      false,
    );
  }
  return globalThis.crypto;
}

function requireNow(now: () => Date) {
  const value = now();
  if (!Number.isFinite(value.getTime())) {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_SYNC_CONFIGURATION_INVALID",
      false,
    );
  }
  return value;
}

async function sha256Hex(crypto: Crypto, input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new CanopyProofMobileEvidenceSyncTransportError(
      "CANOPYPROOF_MOBILE_SYNC_PROTOCOL_ERROR",
      false,
    );
  }
  return serialized;
}
