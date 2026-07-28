import {
  canopyProofLegacyMobileEvidenceDraftSchema,
  canopyProofMobileEvidenceAcknowledgementSchema,
  canopyProofMobileEvidenceCaptureSchema,
  canopyProofMobileEvidenceDraftSchema,
  canopyProofMobileEvidenceServerBindingSchema,
  type CanopyProofLegacyMobileEvidenceDraft,
  type CanopyProofMobileEvidenceCapture,
  type CanopyProofMobileEvidenceDraft,
} from "@dropin/schemas/canopyproof-mobile-evidence";

export const canopyProofMobileEvidenceVaultKeyId = "canopyproof-mobile-evidence-aes-gcm-v1";
export const canopyProofMobileEvidenceVaultEnvelopeVersion = 1 as const;
export const canopyProofMobileEvidenceVaultKeyVersion = 1 as const;
export const canopyProofMobileEvidenceDraftSchemaVersion = "canopyproof.mobile-evidence-draft/v2" as const;
export const canopyProofLegacyMobileEvidenceStorageKey = "canopyproof.mobileEvidenceDrafts.v1";

export type CanopyProofMobileEvidenceVaultErrorCode =
  | "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE"
  | "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE"
  | "CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED"
  | "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"
  | "CANOPYPROOF_MOBILE_EVIDENCE_DRAFT_NOT_FOUND"
  | "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"
  | "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID";

export class CanopyProofMobileEvidenceVaultError extends Error {
  constructor(
    readonly code: CanopyProofMobileEvidenceVaultErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "CanopyProofMobileEvidenceVaultError";
  }
}

export type CanopyProofMobileEvidenceVaultKeyRecord = Readonly<{
  keyId: typeof canopyProofMobileEvidenceVaultKeyId;
  keyVersion: typeof canopyProofMobileEvidenceVaultKeyVersion;
  key: CryptoKey;
  createdAt: string;
}>;

export type CanopyProofMobileEvidenceVaultEnvelope = Readonly<{
  recordId: string;
  envelopeVersion: typeof canopyProofMobileEvidenceVaultEnvelopeVersion;
  payloadSchemaVersion: typeof canopyProofMobileEvidenceDraftSchemaVersion;
  keyId: typeof canopyProofMobileEvidenceVaultKeyId;
  keyVersion: typeof canopyProofMobileEvidenceVaultKeyVersion;
  revision: number;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}>;

export interface CanopyProofMobileEvidenceVaultStorage {
  getOrCreateKey(candidate: CanopyProofMobileEvidenceVaultKeyRecord): Promise<CanopyProofMobileEvidenceVaultKeyRecord>;
  getKey(keyId: string): Promise<CanopyProofMobileEvidenceVaultKeyRecord | undefined>;
  listEnvelopes(): Promise<readonly CanopyProofMobileEvidenceVaultEnvelope[]>;
  getEnvelope(recordId: string): Promise<CanopyProofMobileEvidenceVaultEnvelope | undefined>;
  insertEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, maximumRecords: number): Promise<void>;
  importEnvelopes(
    envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[],
    maximumRecords: number,
  ): Promise<readonly string[]>;
  replaceEnvelope(
    envelope: CanopyProofMobileEvidenceVaultEnvelope,
    expectedRevision: number,
  ): Promise<boolean>;
  deleteEnvelope(recordId: string, expectedRevision: number): Promise<boolean>;
  clear(): Promise<void>;
  close?(): void;
}

export type CanopyProofMobileEvidenceVaultOptions = Readonly<{
  storage: CanopyProofMobileEvidenceVaultStorage;
  crypto?: Crypto;
  now?: () => Date;
  maximumRecords?: number;
}>;

export type CanopyProofMobileEvidenceLegacyMigrationResult = Readonly<{
  state: "no_legacy_data" | "migrated";
  recordCount: number;
  recordIds: readonly string[];
}>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const hashPattern = /^[a-f0-9]{64}$/;

export class CanopyProofMobileEvidenceVault {
  private readonly storage: CanopyProofMobileEvidenceVaultStorage;
  private readonly crypto: Crypto;
  private readonly now: () => Date;
  private readonly maximumRecords: number;
  private keyPromise: Promise<CanopyProofMobileEvidenceVaultKeyRecord> | undefined;

  constructor(options: CanopyProofMobileEvidenceVaultOptions) {
    this.storage = options.storage;
    this.crypto = options.crypto ?? requireWebCrypto();
    this.now = options.now ?? (() => new Date());
    this.maximumRecords = options.maximumRecords ?? 100;
    if (!Number.isSafeInteger(this.maximumRecords) || this.maximumRecords < 1 || this.maximumRecords > 10_000) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED");
    }
  }

  async initialize(): Promise<void> {
    await this.requireKey();
    await this.listDrafts();
  }

  async queueCapture(input: unknown): Promise<CanopyProofMobileEvidenceDraft> {
    const capture = parseCapture(input);
    const timestamp = canonicalTimestamp(this.now());
    const draft = await this.createDraft(capture, {
      id: `cp_evidence_draft_${randomHex(this.crypto, 16)}`,
      idempotencyKey: `cp_mobile_evidence_${randomHex(this.crypto, 16)}`,
      createdAt: timestamp,
    });
    const key = await this.requireKey();
    const envelope = await encryptDraft(this.crypto, key, draft, 1);
    try {
      await this.storage.insertEnvelope(envelope, this.maximumRecords);
    } catch (error) {
      throw normalizeStorageError(error);
    }
    return draft;
  }

  async listDrafts(): Promise<readonly CanopyProofMobileEvidenceDraft[]> {
    const key = await this.requireKey();
    let envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[];
    try {
      envelopes = await this.storage.listEnvelopes();
    } catch (error) {
      throw normalizeStorageError(error);
    }
    const drafts = await Promise.all(envelopes.map((envelope) => decryptDraft(this.crypto, key, envelope)));
    return drafts.sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
    );
  }

  async getDraft(recordId: string): Promise<CanopyProofMobileEvidenceDraft> {
    const { draft } = await this.requireDraftEnvelope(recordId);
    return draft;
  }

  async removeDraft(recordId: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { draft, envelope } = await this.requireDraftEnvelope(recordId);
      if (draft.state === "sync_leased") {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      try {
        if (await this.storage.deleteEnvelope(recordId, envelope.revision)) return;
      } catch (error) {
        throw normalizeStorageError(error);
      }
    }
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
  }

  async markPrerequisitesBlocked(recordId: string, errorCode: string): Promise<CanopyProofMobileEvidenceDraft> {
    return this.updateDraft(recordId, (draft, now) => {
      if (draft.state !== "draft_queued" && draft.state !== "blocked_prerequisites" &&
        draft.state !== "ready_to_sync") {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      return {
        ...draft,
        state: "blocked_prerequisites",
        updatedAt: now,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        serverBinding: null,
        acknowledgement: null,
        lastErrorCode: normalizeErrorCode(errorCode),
      };
    });
  }

  async bindServerAuthority(
    recordId: string,
    bindingInput: unknown,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    const serverBinding = canopyProofMobileEvidenceServerBindingSchema.parse(bindingInput);
    return this.updateDraft(recordId, (draft, now) => {
      if (draft.state !== "draft_queued" && draft.state !== "blocked_prerequisites" &&
        draft.state !== "ready_to_sync") {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      if (draft.serverBinding !== null && stableStringify(draft.serverBinding) !== stableStringify(serverBinding)) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      if (
        serverBinding.clientRecordId !== draft.id ||
        serverBinding.projectId !== draft.capture.projectId
      ) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      if (draft.state === "ready_to_sync" && stableStringify(draft.serverBinding) === stableStringify(serverBinding)) {
        return draft;
      }
      return {
        ...draft,
        state: "ready_to_sync",
        updatedAt: now,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        serverBinding,
        acknowledgement: null,
        lastErrorCode: null,
      };
    });
  }

  async leaseForSync(recordId: string, leaseDurationMs = 30_000): Promise<CanopyProofMobileEvidenceDraft> {
    if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs < 1_000 || leaseDurationMs > 300_000) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
    }
    return this.updateDraft(recordId, (draft, now) => {
      const nowMs = Date.parse(now);
      const retryDue = draft.nextAttemptAt === null || Date.parse(draft.nextAttemptAt) <= nowMs;
      const expiredLease = draft.state === "sync_leased" &&
        draft.leaseExpiresAt !== null && Date.parse(draft.leaseExpiresAt) <= nowMs;
      if ((draft.state !== "ready_to_sync" && !expiredLease) || !retryDue || draft.serverBinding === null) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      return {
        ...draft,
        state: "sync_leased",
        attemptCount: draft.attemptCount + 1,
        updatedAt: now,
        nextAttemptAt: null,
        leaseExpiresAt: new Date(nowMs + leaseDurationMs).toISOString(),
        acknowledgement: null,
        lastErrorCode: null,
      };
    });
  }

  async releaseForRetry(
    recordId: string,
    errorCode: string,
    nextAttemptAtInput: string,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    const nextAttemptAt = canonicalTimestamp(new Date(nextAttemptAtInput));
    return this.updateDraft(recordId, (draft, now) => {
      if (draft.state !== "sync_leased" || Date.parse(nextAttemptAt) <= Date.parse(now)) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      return {
        ...draft,
        state: "ready_to_sync",
        updatedAt: now,
        nextAttemptAt,
        leaseExpiresAt: null,
        acknowledgement: null,
        lastErrorCode: normalizeErrorCode(errorCode),
      };
    });
  }

  async reject(recordId: string, errorCode: string): Promise<CanopyProofMobileEvidenceDraft> {
    return this.updateDraft(recordId, (draft, now) => {
      if (draft.state !== "ready_to_sync" && draft.state !== "sync_leased") {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      return {
        ...draft,
        state: "rejected",
        updatedAt: now,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        acknowledgement: null,
        lastErrorCode: normalizeErrorCode(errorCode),
      };
    });
  }

  async acknowledge(
    recordId: string,
    acknowledgementInput: unknown,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    const acknowledgement = canopyProofMobileEvidenceAcknowledgementSchema.parse(acknowledgementInput);
    return this.updateDraft(recordId, (draft, now) => {
      if (draft.state !== "sync_leased" || draft.serverBinding === null) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      if (
        acknowledgement.clientRecordId !== draft.id ||
        acknowledgement.evidenceId !== draft.serverBinding.evidenceId ||
        acknowledgement.evidenceRoot !== draft.serverBinding.evidenceRoot
      ) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      return {
        ...draft,
        state: "acknowledged",
        updatedAt: now,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        acknowledgement,
        lastErrorCode: null,
      };
    });
  }

  async importLegacyDrafts(input: unknown): Promise<CanopyProofMobileEvidenceLegacyMigrationResult> {
    if (!Array.isArray(input) || input.length === 0) {
      return { state: "no_legacy_data", recordCount: 0, recordIds: [] };
    }
    if (input.length > this.maximumRecords) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED");
    }
    let legacyDrafts: readonly CanopyProofLegacyMobileEvidenceDraft[];
    try {
      legacyDrafts = input.map((value) => canopyProofLegacyMobileEvidenceDraftSchema.parse(value));
    } catch (error) {
      throw new CanopyProofMobileEvidenceVaultError(
        "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID",
        { cause: error },
      );
    }
    const key = await this.requireKey();
    const drafts = await Promise.all(legacyDrafts.map((legacy) => this.createLegacyDraft(legacy)));
    const envelopes = await Promise.all(drafts.map((draft) => encryptDraft(this.crypto, key, draft, 1)));
    try {
      await this.storage.importEnvelopes(envelopes, this.maximumRecords);
    } catch (error) {
      throw normalizeStorageError(error);
    }
    for (const expected of drafts) {
      const actual = await this.getDraft(expected.id);
      if (actual.payloadHash !== expected.payloadHash || actual.idempotencyKey !== expected.idempotencyKey) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
      }
    }
    return {
      state: "migrated",
      recordCount: drafts.length,
      recordIds: drafts.map((draft) => draft.id),
    };
  }

  async eraseLocalVault(): Promise<void> {
    try {
      await this.storage.clear();
      this.keyPromise = undefined;
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  close(): void {
    this.storage.close?.();
    this.keyPromise = undefined;
  }

  private async createDraft(
    capture: CanopyProofMobileEvidenceCapture,
    identity: Readonly<{ id: string; idempotencyKey: string; createdAt: string }>,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    const payloadHash = await sha256Hex(this.crypto, {
      domain: "canopyproof/mobile-evidence/capture/v2",
      capture,
    });
    return canopyProofMobileEvidenceDraftSchema.parse({
      schemaVersion: canopyProofMobileEvidenceDraftSchemaVersion,
      id: identity.id,
      capture,
      payloadHash,
      idempotencyKey: identity.idempotencyKey,
      state: "draft_queued",
      attemptCount: 0,
      createdAt: identity.createdAt,
      updatedAt: identity.createdAt,
      nextAttemptAt: null,
      leaseExpiresAt: null,
      serverBinding: null,
      acknowledgement: null,
      lastErrorCode: null,
    });
  }

  private async createLegacyDraft(
    legacy: CanopyProofLegacyMobileEvidenceDraft,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    let capture: CanopyProofMobileEvidenceCapture;
    let createdAt: string;
    try {
      const observedAtDate = new Date(legacy.observedAt);
      capture = parseCapture({
        evidenceType: legacy.evidenceType,
        projectId: legacy.projectId,
        observedAt: canonicalTimestamp(observedAtDate),
        latitude: Number(legacy.latitude),
        longitude: Number(legacy.longitude),
        gpsAccuracyMeters: Number(legacy.gpsAccuracyMeters),
        mediaHash: legacy.mediaHash,
        deviceFingerprintHash: legacy.deviceFingerprintHash,
        exifHash: legacy.exifHash || null,
        notes: legacy.notes || null,
      });
      createdAt = canonicalTimestamp(new Date(legacy.createdAt));
    } catch (error) {
      throw new CanopyProofMobileEvidenceVaultError(
        "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID",
        { cause: error },
      );
    }
    const legacyIdentity = await sha256Hex(this.crypto, {
      domain: "canopyproof/mobile-evidence/legacy-identity/v1",
      legacyId: legacy.id,
      legacyIdempotencyKey: legacy.idempotencyKey,
      createdAt,
    });
    const legacyIdempotency = await sha256Hex(this.crypto, {
      domain: "canopyproof/mobile-evidence/legacy-idempotency/v1",
      legacyId: legacy.id,
      legacyIdempotencyKey: legacy.idempotencyKey,
    });
    return this.createDraft(capture, {
      id: `cp_evidence_draft_${legacyIdentity.slice(0, 32)}`,
      idempotencyKey: `cp_mobile_evidence_${legacyIdempotency.slice(0, 32)}`,
      createdAt,
    });
  }

  private async updateDraft(
    recordId: string,
    update: (draft: CanopyProofMobileEvidenceDraft, now: string) => CanopyProofMobileEvidenceDraft,
  ): Promise<CanopyProofMobileEvidenceDraft> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { draft, envelope, key } = await this.requireDraftEnvelope(recordId);
      let updated: CanopyProofMobileEvidenceDraft;
      try {
        updated = canopyProofMobileEvidenceDraftSchema.parse(update(draft, canonicalTimestamp(this.now())));
      } catch (error) {
        if (error instanceof CanopyProofMobileEvidenceVaultError) throw error;
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT", {
          cause: error,
        });
      }
      if (updated.id !== draft.id || updated.payloadHash !== draft.payloadHash ||
        updated.idempotencyKey !== draft.idempotencyKey || stableStringify(updated.capture) !== stableStringify(draft.capture)) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      if (Date.parse(updated.updatedAt) < Date.parse(draft.updatedAt)) {
        throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
      }
      if (stableStringify(updated) === stableStringify(draft)) return draft;
      const replacement = await encryptDraft(this.crypto, key, updated, envelope.revision + 1);
      try {
        if (await this.storage.replaceEnvelope(replacement, envelope.revision)) return updated;
      } catch (error) {
        throw normalizeStorageError(error);
      }
    }
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
  }

  private async requireDraftEnvelope(recordId: string): Promise<Readonly<{
    draft: CanopyProofMobileEvidenceDraft;
    envelope: CanopyProofMobileEvidenceVaultEnvelope;
    key: CanopyProofMobileEvidenceVaultKeyRecord;
  }>> {
    let envelope: CanopyProofMobileEvidenceVaultEnvelope | undefined;
    try {
      envelope = await this.storage.getEnvelope(recordId);
    } catch (error) {
      throw normalizeStorageError(error);
    }
    if (!envelope) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_DRAFT_NOT_FOUND");
    }
    const key = await this.requireKey();
    return { envelope, key, draft: await decryptDraft(this.crypto, key, envelope) };
  }

  private async requireKey(): Promise<CanopyProofMobileEvidenceVaultKeyRecord> {
    this.keyPromise ??= this.loadOrCreateKey();
    try {
      return await this.keyPromise;
    } catch (error) {
      this.keyPromise = undefined;
      throw error;
    }
  }

  private async loadOrCreateKey(): Promise<CanopyProofMobileEvidenceVaultKeyRecord> {
    let existing: CanopyProofMobileEvidenceVaultKeyRecord | undefined;
    try {
      existing = await this.storage.getKey(canopyProofMobileEvidenceVaultKeyId);
    } catch (error) {
      throw normalizeStorageError(error);
    }
    if (existing) return validateKeyRecord(existing);
    let key: CryptoKey;
    try {
      const generated = await this.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      if (isCryptoKeyPair(generated)) {
        throw new Error("AES-GCM key generation returned an unexpected key pair.");
      }
      key = generated;
    } catch (error) {
      throw new CanopyProofMobileEvidenceVaultError(
        "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE",
        { cause: error },
      );
    }
    const candidate: CanopyProofMobileEvidenceVaultKeyRecord = {
      keyId: canopyProofMobileEvidenceVaultKeyId,
      keyVersion: canopyProofMobileEvidenceVaultKeyVersion,
      key,
      createdAt: canonicalTimestamp(this.now()),
    };
    try {
      return validateKeyRecord(await this.storage.getOrCreateKey(candidate));
    } catch (error) {
      if (error instanceof CanopyProofMobileEvidenceVaultError) throw error;
      throw normalizeStorageError(error);
    }
  }
}

export function parseCanopyProofMobileEvidenceCapture(input: unknown): CanopyProofMobileEvidenceCapture {
  return parseCapture(input);
}

async function encryptDraft(
  crypto: Crypto,
  keyRecord: CanopyProofMobileEvidenceVaultKeyRecord,
  draft: CanopyProofMobileEvidenceDraft,
  revision: number,
): Promise<CanopyProofMobileEvidenceVaultEnvelope> {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = envelopeAad(draft.id, revision);
  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
      keyRecord.key,
      textEncoder.encode(stableStringify(draft)),
    );
  } catch (error) {
    throw new CanopyProofMobileEvidenceVaultError(
      "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE",
      { cause: error },
    );
  }
  return {
    recordId: draft.id,
    envelopeVersion: canopyProofMobileEvidenceVaultEnvelopeVersion,
    payloadSchemaVersion: canopyProofMobileEvidenceDraftSchemaVersion,
    keyId: canopyProofMobileEvidenceVaultKeyId,
    keyVersion: canopyProofMobileEvidenceVaultKeyVersion,
    revision,
    iv,
    ciphertext,
  };
}

async function decryptDraft(
  crypto: Crypto,
  keyRecord: CanopyProofMobileEvidenceVaultKeyRecord,
  envelopeInput: CanopyProofMobileEvidenceVaultEnvelope,
): Promise<CanopyProofMobileEvidenceDraft> {
  const envelope = validateEnvelope(envelopeInput);
  if (envelope.keyId !== keyRecord.keyId || envelope.keyVersion !== keyRecord.keyVersion) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: envelope.iv,
        additionalData: envelopeAad(envelope.recordId, envelope.revision),
        tagLength: 128,
      },
      keyRecord.key,
      envelope.ciphertext,
    );
  } catch (error) {
    throw new CanopyProofMobileEvidenceVaultError(
      "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED",
      { cause: error },
    );
  }
  let draft: CanopyProofMobileEvidenceDraft;
  try {
    draft = canopyProofMobileEvidenceDraftSchema.parse(JSON.parse(textDecoder.decode(plaintext)));
  } catch (error) {
    throw new CanopyProofMobileEvidenceVaultError(
      "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED",
      { cause: error },
    );
  }
  if (draft.id !== envelope.recordId) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  const expectedPayloadHash = await sha256Hex(crypto, {
    domain: "canopyproof/mobile-evidence/capture/v2",
    capture: draft.capture,
  });
  if (draft.payloadHash !== expectedPayloadHash) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  return draft;
}

function validateEnvelope(input: CanopyProofMobileEvidenceVaultEnvelope): CanopyProofMobileEvidenceVaultEnvelope {
  if (
    typeof input !== "object" || input === null ||
    input.envelopeVersion !== canopyProofMobileEvidenceVaultEnvelopeVersion ||
    input.payloadSchemaVersion !== canopyProofMobileEvidenceDraftSchemaVersion ||
    input.keyId !== canopyProofMobileEvidenceVaultKeyId ||
    input.keyVersion !== canopyProofMobileEvidenceVaultKeyVersion ||
    !/^cp_evidence_draft_[a-f0-9]{32}$/.test(input.recordId) ||
    !Number.isSafeInteger(input.revision) || input.revision < 1 ||
    !(input.iv instanceof Uint8Array) || input.iv.byteLength !== 12 ||
    !(input.ciphertext instanceof ArrayBuffer) || input.ciphertext.byteLength < 17
  ) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  return input;
}

function validateKeyRecord(input: CanopyProofMobileEvidenceVaultKeyRecord): CanopyProofMobileEvidenceVaultKeyRecord {
  if (typeof input !== "object" || input === null || !isCryptoKeyRecord(input.key)) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  const algorithm = input.key.algorithm;
  if (
    input.keyId !== canopyProofMobileEvidenceVaultKeyId ||
    input.keyVersion !== canopyProofMobileEvidenceVaultKeyVersion ||
    input.key.type !== "secret" ||
    input.key.extractable ||
    algorithm.name !== "AES-GCM" ||
    !("length" in algorithm) || algorithm.length !== 256 ||
    input.key.usages.length !== 2 ||
    !input.key.usages.includes("encrypt") ||
    !input.key.usages.includes("decrypt") ||
    canonicalTimestamp(new Date(input.createdAt)) !== input.createdAt
  ) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  return input;
}

function parseCapture(input: unknown): CanopyProofMobileEvidenceCapture {
  if (typeof input !== "object" || input === null) return canopyProofMobileEvidenceCaptureSchema.parse(input);
  const value = input as Record<string, unknown>;
  return canopyProofMobileEvidenceCaptureSchema.parse({
    ...value,
    projectId: typeof value.projectId === "string" ? value.projectId.trim() : value.projectId,
    mediaHash: normalizeHashInput(value.mediaHash),
    deviceFingerprintHash: normalizeHashInput(value.deviceFingerprintHash),
    exifHash: value.exifHash === null ? null : normalizeHashInput(value.exifHash),
    notes: typeof value.notes === "string" && value.notes.trim().length === 0 ? null : value.notes,
  });
}

function normalizeHashInput(input: unknown): unknown {
  return typeof input === "string" ? input.trim().toLowerCase().replace(/^sha256:/, "") : input;
}

function normalizeErrorCode(input: string): string {
  const normalized = input.trim().toUpperCase();
  if (!/^CANOPYPROOF_[A-Z0-9_]{1,120}$/.test(normalized)) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT");
  }
  return normalized;
}

function envelopeAad(recordId: string, revision: number): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(stableStringify({
    domain: "canopyproof/mobile-evidence/envelope/v1",
    envelopeVersion: canopyProofMobileEvidenceVaultEnvelopeVersion,
    payloadSchemaVersion: canopyProofMobileEvidenceDraftSchemaVersion,
    keyId: canopyProofMobileEvidenceVaultKeyId,
    keyVersion: canopyProofMobileEvidenceVaultKeyVersion,
    recordId,
    revision,
  }));
}

async function sha256Hex(crypto: Crypto, input: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(stableStringify(input)));
  return bytesToHex(new Uint8Array(digest));
}

function randomHex(crypto: Crypto, byteLength: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
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
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  return serialized;
}

function canonicalTimestamp(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED");
  }
  return date.toISOString();
}

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.getRandomValues !== "function") {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE");
  }
  return globalThis.crypto;
}

function normalizeStorageError(error: unknown): CanopyProofMobileEvidenceVaultError {
  if (error instanceof CanopyProofMobileEvidenceVaultError) return error;
  if (isDomErrorNamed(error, "QuotaExceededError")) {
    return new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED", {
      cause: error,
    });
  }
  if (isDomErrorNamed(error, "ConstraintError")) {
    return new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT", {
      cause: error,
    });
  }
  return new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE", {
    cause: error,
  });
}

function isCryptoKeyPair(value: CryptoKey | CryptoKeyPair): value is CryptoKeyPair {
  return typeof value === "object" && value !== null && "privateKey" in value && "publicKey" in value;
}

function isCryptoKeyRecord(value: unknown): value is CryptoKey {
  return typeof value === "object" && value !== null &&
    "algorithm" in value && typeof value.algorithm === "object" && value.algorithm !== null &&
    "extractable" in value && typeof value.extractable === "boolean" &&
    "type" in value && typeof value.type === "string" &&
    "usages" in value && Array.isArray(value.usages);
}

function isDomErrorNamed(error: unknown, expectedName: string): boolean {
  return typeof error === "object" && error !== null &&
    "name" in error && (error as { readonly name?: unknown }).name === expectedName;
}

export function isCanopyProofMobileEvidenceVaultError(
  error: unknown,
): error is CanopyProofMobileEvidenceVaultError {
  return error instanceof CanopyProofMobileEvidenceVaultError &&
    error.code.startsWith("CANOPYPROOF_MOBILE_EVIDENCE_");
}

export function isCanopyProofMobileEvidenceHash(value: string): boolean {
  return hashPattern.test(value);
}
