import assert from "node:assert/strict";
import test from "node:test";
import {
  CanopyProofMobileEvidenceVault,
  CanopyProofMobileEvidenceVaultError,
  canopyProofMobileEvidenceDraftSchemaVersion,
  canopyProofMobileEvidenceVaultEnvelopeVersion,
  canopyProofMobileEvidenceVaultKeyId,
  canopyProofMobileEvidenceVaultKeyVersion,
  isCanopyProofMobileEvidenceHash,
  isCanopyProofMobileEvidenceVaultError,
  parseCanopyProofMobileEvidenceCapture,
  type CanopyProofMobileEvidenceVaultEnvelope,
  type CanopyProofMobileEvidenceVaultKeyRecord,
  type CanopyProofMobileEvidenceVaultStorage,
} from "../../apps/web/src/lib/canopyproof-mobile-evidence-vault.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const capture = {
  evidenceType: "tree_planting" as const,
  projectId: " project_vault_critical ",
  observedAt: "2026-07-17T01:00:00.000Z",
  latitude: 1.2345,
  longitude: 36.789,
  gpsAccuracyMeters: 4.5,
  mediaHash: `SHA256:${hashA.toUpperCase()}`,
  deviceFingerprintHash: hashB,
  exifHash: hashC,
  notes: " ",
};

type StorageMethod =
  | "getOrCreateKey"
  | "getKey"
  | "listEnvelopes"
  | "getEnvelope"
  | "insertEnvelope"
  | "importEnvelopes"
  | "replaceEnvelope"
  | "deleteEnvelope"
  | "clear";

class FaultStorage implements CanopyProofMobileEvidenceVaultStorage {
  key: CanopyProofMobileEvidenceVaultKeyRecord | undefined;
  readonly envelopes = new Map<string, CanopyProofMobileEvidenceVaultEnvelope>();
  readonly failures = new Map<StorageMethod, unknown>();
  replaceMisses = 0;
  deleteMisses = 0;
  closed = false;
  importMutator:
    | ((envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[]) => Promise<void>)
    | undefined;

  private fail(method: StorageMethod): void {
    if (this.failures.has(method)) throw this.failures.get(method);
  }

  async getOrCreateKey(candidate: CanopyProofMobileEvidenceVaultKeyRecord) {
    this.fail("getOrCreateKey");
    this.key ??= candidate;
    return this.key;
  }

  async getKey() {
    this.fail("getKey");
    return this.key;
  }

  async listEnvelopes() {
    this.fail("listEnvelopes");
    return [...this.envelopes.values()].map(cloneEnvelope);
  }

  async getEnvelope(recordId: string) {
    this.fail("getEnvelope");
    const envelope = this.envelopes.get(recordId);
    return envelope ? cloneEnvelope(envelope) : undefined;
  }

  async insertEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, maximumRecords: number) {
    this.fail("insertEnvelope");
    if (this.envelopes.size >= maximumRecords || this.envelopes.has(envelope.recordId)) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
  }

  async importEnvelopes(
    envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[],
    maximumRecords: number,
  ) {
    this.fail("importEnvelopes");
    if (this.envelopes.size + envelopes.length > maximumRecords) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    for (const envelope of envelopes) this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
    await this.importMutator?.(envelopes);
    return envelopes.map((envelope) => envelope.recordId);
  }

  async replaceEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, expectedRevision: number) {
    this.fail("replaceEnvelope");
    if (this.replaceMisses > 0) {
      this.replaceMisses -= 1;
      return false;
    }
    const current = this.envelopes.get(envelope.recordId);
    if (!current || current.revision !== expectedRevision) return false;
    this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
    return true;
  }

  async deleteEnvelope(recordId: string, expectedRevision: number) {
    this.fail("deleteEnvelope");
    if (this.deleteMisses > 0) {
      this.deleteMisses -= 1;
      return false;
    }
    const current = this.envelopes.get(recordId);
    if (!current || current.revision !== expectedRevision) return false;
    this.envelopes.delete(recordId);
    return true;
  }

  async clear() {
    this.fail("clear");
    this.key = undefined;
    this.envelopes.clear();
  }

  close() {
    this.closed = true;
  }
}

function cloneEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope): CanopyProofMobileEvidenceVaultEnvelope {
  return {
    ...envelope,
    iv: new Uint8Array(envelope.iv),
    ciphertext: envelope.ciphertext.slice(0),
  };
}

function makeVault(
  storage = new FaultStorage(),
  options: Readonly<{
    crypto?: Crypto;
    maximumRecords?: number;
    now?: () => Date;
    useDefaultCrypto?: boolean;
  }> = {},
) {
  const vaultOptions = {
    storage,
    now: options.now ?? (() => new Date("2026-07-17T02:00:00.000Z")),
    ...(options.maximumRecords === undefined ? {} : { maximumRecords: options.maximumRecords }),
    ...(options.useDefaultCrypto ? {} : { crypto: options.crypto ?? globalThis.crypto }),
  };
  return { storage, vault: new CanopyProofMobileEvidenceVault(vaultOptions) };
}

function binding(recordId: string, projectId = "project_vault_critical") {
  return {
    clientRecordId: recordId,
    clientBatchId: `cp_mobile_evidence_batch_${"d".repeat(32)}`,
    organizationId: "organization_vault_critical",
    projectId,
    consentReceiptId: "consent_vault_critical",
    consentReceiptRoot: hashA,
    deviceAttestationId: "device_vault_critical",
    deviceAttestationRoot: hashB,
    evidenceId: "evidence_vault_critical",
    evidenceRoot: hashA,
    syncPayloadHash: hashC,
    boundAt: "2026-07-17T02:00:00.000Z",
    bindingRoot: hashB,
  };
}

function acknowledgement(recordId: string, overrides: Readonly<Record<string, string>> = {}) {
  return {
    clientRecordId: recordId,
    evidenceId: "evidence_vault_critical",
    evidenceRoot: hashA,
    itemRoot: hashA,
    batchId: "offline_batch_vault_critical",
    batchRoot: hashB,
    auditEventRoot: hashC,
    acknowledgedAt: "2026-07-17T02:01:00.000Z",
    ...overrides,
  };
}

function legacy(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "legacy_vault_critical",
    evidenceType: "restoration",
    projectId: "project_legacy_critical",
    observedAt: "2026-07-16T01:00:00.000Z",
    latitude: "1.25",
    longitude: "36.75",
    gpsAccuracyMeters: "5",
    mediaHash: hashA,
    deviceFingerprintHash: hashB,
    exifHash: "",
    notes: "",
    idempotencyKey: "legacy_idempotency_critical",
    verificationState: "draft_queued",
    createdAt: "2026-07-16T02:00:00.000Z",
    ...overrides,
  };
}

function assertVaultError(error: unknown, code: CanopyProofMobileEvidenceVaultError["code"]) {
  assert.ok(isCanopyProofMobileEvidenceVaultError(error));
  assert.equal(error.code, code);
  return true;
}

function subtleOverride(
  method: keyof SubtleCrypto,
  replacement: (...args: readonly unknown[]) => unknown,
): Crypto {
  const subtle = new Proxy(globalThis.crypto.subtle, {
    get(target, property, receiver) {
      if (property === method) return replacement;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    subtle,
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
  } as Crypto;
}

test("vault defaults, initialization, parsing helpers, and constructor limits are deterministic", async () => {
  const { storage, vault } = makeVault(new FaultStorage(), { useDefaultCrypto: true });
  await vault.initialize();
  assert.ok(storage.key);
  assert.equal((await vault.listDrafts()).length, 0);

  const parsed = parseCanopyProofMobileEvidenceCapture(capture);
  assert.equal(parsed.projectId, "project_vault_critical");
  assert.equal(parsed.mediaHash, hashA);
  assert.equal(parsed.notes, null);
  assert.throws(() => parseCanopyProofMobileEvidenceCapture(null));
  assert.equal(isCanopyProofMobileEvidenceHash(hashA), true);
  assert.equal(isCanopyProofMobileEvidenceHash("SHA256:bad"), false);
  assert.equal(isCanopyProofMobileEvidenceVaultError(new Error("no")), false);
  const trueDefaults = new CanopyProofMobileEvidenceVault({ storage: new FaultStorage() });
  assert.match((await trueDefaults.queueCapture({ ...capture, projectId: "project_true_defaults" })).createdAt, /Z$/);
  assert.throws(() => parseCanopyProofMobileEvidenceCapture({ ...capture, projectId: 42 }));
  assert.throws(() => parseCanopyProofMobileEvidenceCapture({ ...capture, mediaHash: 42 }));

  for (const maximumRecords of [0, 10_001, 1.5, Number.NaN]) {
    assert.throws(
      () => makeVault(new FaultStorage(), { maximumRecords }),
      (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED"),
    );
  }
});

test("removeDraft handles success, leased-state refusal, storage failure, and exhausted CAS retries", async () => {
  const first = makeVault();
  const queued = await first.vault.queueCapture(capture);
  await first.vault.removeDraft(queued.id);
  await assert.rejects(
    first.vault.getDraft(queued.id),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_DRAFT_NOT_FOUND"),
  );

  const leased = await first.vault.queueCapture({ ...capture, projectId: "project_leased" });
  await first.vault.bindServerAuthority(leased.id, binding(leased.id, "project_leased"));
  await first.vault.leaseForSync(leased.id);
  await assert.rejects(
    first.vault.removeDraft(leased.id),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );

  const cas = makeVault();
  const casDraft = await cas.vault.queueCapture({ ...capture, projectId: "project_cas" });
  cas.storage.deleteMisses = 3;
  await assert.rejects(
    cas.vault.removeDraft(casDraft.id),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  cas.storage.failures.set("deleteEnvelope", new DOMException("constraint", "ConstraintError"));
  await assert.rejects(
    cas.vault.removeDraft(casDraft.id),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
});

test("state transitions reject forged bindings, invalid retry timing, bad acknowledgement, and terminal rollback", async () => {
  let now = new Date("2026-07-17T02:00:00.000Z");
  const { vault } = makeVault(new FaultStorage(), { now: () => now });
  const draft = await vault.queueCapture(capture);

  await assert.rejects(
    vault.markPrerequisitesBlocked(draft.id, "bad"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  await assert.rejects(
    vault.bindServerAuthority(draft.id, binding(`cp_evidence_draft_${"f".repeat(32)}`)),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  await vault.bindServerAuthority(draft.id, binding(draft.id));
  await assert.rejects(
    vault.bindServerAuthority(draft.id, { ...binding(draft.id), evidenceId: "different_evidence" }),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  for (const leaseDurationMs of [999, 300_001, 1.5]) {
    await assert.rejects(
      vault.leaseForSync(draft.id, leaseDurationMs),
      (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
    );
  }
  await vault.leaseForSync(draft.id);
  await assert.rejects(
    vault.releaseForRetry(draft.id, "CANOPYPROOF_RETRY", now.toISOString()),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  await assert.rejects(
    vault.acknowledge(draft.id, acknowledgement(draft.id, { evidenceRoot: hashB })),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  const rejected = await vault.reject(draft.id, " canopyproof_policy_rejected ");
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.lastErrorCode, "CANOPYPROOF_POLICY_REJECTED");
  await assert.rejects(
    vault.reject(draft.id, "CANOPYPROOF_POLICY_REJECTED"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  await assert.rejects(
    vault.markPrerequisitesBlocked(draft.id, "CANOPYPROOF_POLICY_REJECTED"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );

  const expiring = await vault.queueCapture({ ...capture, projectId: "project_expiring" });
  await vault.bindServerAuthority(expiring.id, binding(expiring.id, "project_expiring"));
  await vault.leaseForSync(expiring.id, 1_000);
  now = new Date("2026-07-17T02:00:02.000Z");
  assert.equal((await vault.leaseForSync(expiring.id)).attemptCount, 2);
});

test("acknowledgement requires a lease and exact server authority", async () => {
  const { vault } = makeVault();
  const draft = await vault.queueCapture(capture);
  await assert.rejects(
    vault.acknowledge(draft.id, acknowledgement(draft.id)),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  await vault.bindServerAuthority(draft.id, binding(draft.id));
  await vault.leaseForSync(draft.id);
  for (const changes of [
    { clientRecordId: `cp_evidence_draft_${"f".repeat(32)}` },
    { evidenceId: "wrong_evidence" },
    { evidenceRoot: hashB },
  ]) {
    await assert.rejects(
      vault.acknowledge(draft.id, acknowledgement(draft.id, changes)),
      (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
    );
  }
  assert.equal((await vault.acknowledge(draft.id, acknowledgement(draft.id))).state, "acknowledged");
});

test("legacy migration handles no data, quota, parse failure, storage interruption, and post-write verification mismatch", async () => {
  const empty = makeVault();
  assert.deepEqual(await empty.vault.importLegacyDrafts(undefined), {
    state: "no_legacy_data",
    recordCount: 0,
    recordIds: [],
  });
  assert.deepEqual(await empty.vault.importLegacyDrafts([]), {
    state: "no_legacy_data",
    recordCount: 0,
    recordIds: [],
  });

  const limited = makeVault(new FaultStorage(), { maximumRecords: 1 });
  await assert.rejects(
    limited.vault.importLegacyDrafts([legacy(), legacy({ id: "legacy_two" })]),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED"),
  );
  await assert.rejects(
    empty.vault.importLegacyDrafts([legacy({ observedAt: "invalid" })]),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID"),
  );

  const interrupted = makeVault();
  interrupted.storage.failures.set("importEnvelopes", new Error("interrupted"));
  await assert.rejects(
    interrupted.vault.importLegacyDrafts([legacy()]),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE"),
  );

  const mismatch = makeVault();
  mismatch.storage.importMutator = async ([envelope]) => {
    assert.ok(envelope);
    assert.ok(mismatch.storage.key);
    const aad = new TextEncoder().encode(stableStringify({
      domain: "canopyproof/mobile-evidence/envelope/v1",
      envelopeVersion: canopyProofMobileEvidenceVaultEnvelopeVersion,
      payloadSchemaVersion: canopyProofMobileEvidenceDraftSchemaVersion,
      keyId: canopyProofMobileEvidenceVaultKeyId,
      keyVersion: canopyProofMobileEvidenceVaultKeyVersion,
      recordId: envelope.recordId,
      revision: envelope.revision,
    }));
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: envelope.iv, additionalData: aad, tagLength: 128 },
      mismatch.storage.key.key,
      envelope.ciphertext,
    );
    const draft = JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
    draft.idempotencyKey = `cp_mobile_evidence_${"e".repeat(32)}`;
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: envelope.iv, additionalData: aad, tagLength: 128 },
      mismatch.storage.key.key,
      new TextEncoder().encode(JSON.stringify(draft)),
    );
    mismatch.storage.envelopes.set(envelope.recordId, { ...envelope, ciphertext });
  };
  await assert.rejects(
    mismatch.vault.importLegacyDrafts([legacy()]),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
  );
});

test("envelope and key validation reject malformed metadata before plaintext is trusted", async (context) => {
  const envelopeMutations: readonly [
    string,
    (envelope: CanopyProofMobileEvidenceVaultEnvelope) => CanopyProofMobileEvidenceVaultEnvelope,
  ][] = [
    ["envelope-version", (value) => ({ ...value, envelopeVersion: 2 as 1 })],
    ["payload-version", (value) => ({ ...value, payloadSchemaVersion: "wrong" as typeof value.payloadSchemaVersion })],
    ["key-id", (value) => ({ ...value, keyId: "wrong" as typeof value.keyId })],
    ["key-version", (value) => ({ ...value, keyVersion: 2 as 1 })],
    ["record-id", (value) => ({ ...value, recordId: "wrong" })],
    ["revision", (value) => ({ ...value, revision: 0 })],
    ["iv-type", (value) => ({ ...value, iv: new Uint8Array(12).buffer as unknown as Uint8Array<ArrayBuffer> })],
    ["iv-length", (value) => ({ ...value, iv: new Uint8Array(11) })],
    ["ciphertext-type", (value) => ({ ...value, ciphertext: new Uint8Array(32) as unknown as ArrayBuffer })],
    ["ciphertext-length", (value) => ({ ...value, ciphertext: new ArrayBuffer(16) })],
  ];
  for (const [name, mutation] of envelopeMutations) {
    await context.test(name, async () => {
      const target = makeVault();
      const draft = await target.vault.queueCapture(capture);
      const envelope = target.storage.envelopes.get(draft.id);
      assert.ok(envelope);
      target.storage.envelopes.set(draft.id, mutation(cloneEnvelope(envelope)));
      await assert.rejects(
        target.vault.getDraft(draft.id),
        (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
      );
    });
  }

  const invalidKey = makeVault();
  await invalidKey.vault.queueCapture(capture);
  assert.ok(invalidKey.storage.key);
  invalidKey.storage.key = { ...invalidKey.storage.key, keyId: "wrong" as typeof canopyProofMobileEvidenceVaultKeyId };
  const reloaded = makeVault(invalidKey.storage).vault;
  await assert.rejects(
    reloaded.listDrafts(),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
  );
});

test("storage and cryptographic provider failures are normalized without leaking provider details", async () => {
  for (const [method, action] of [
    ["getKey", async (vault: CanopyProofMobileEvidenceVault) => vault.initialize()],
    ["listEnvelopes", async (vault: CanopyProofMobileEvidenceVault) => vault.listDrafts()],
    ["getEnvelope", async (vault: CanopyProofMobileEvidenceVault) => vault.getDraft(`cp_evidence_draft_${"f".repeat(32)}`)],
    ["insertEnvelope", async (vault: CanopyProofMobileEvidenceVault) => vault.queueCapture(capture)],
    ["clear", async (vault: CanopyProofMobileEvidenceVault) => vault.eraseLocalVault()],
  ] as const) {
    const storage = new FaultStorage();
    storage.failures.set(method, new Error(`provider-${method}`));
    const vault = makeVault(storage).vault;
    await assert.rejects(
      action(vault),
      (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE"),
    );
  }

  const encryptFailure = makeVault(new FaultStorage(), {
    crypto: subtleOverride("encrypt", async () => {
      throw new Error("encrypt outage");
    }),
  });
  await assert.rejects(
    encryptFailure.vault.queueCapture(capture),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE"),
  );

  const generateFailure = makeVault(new FaultStorage(), {
    crypto: subtleOverride("generateKey", async () => {
      throw new Error("generate outage");
    }),
  });
  await assert.rejects(
    generateFailure.vault.initialize(),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE"),
  );

  const pairFailure = makeVault(new FaultStorage(), {
    crypto: subtleOverride("generateKey", async () => ({
      privateKey: {} as CryptoKey,
      publicKey: {} as CryptoKey,
    })),
  });
  await assert.rejects(
    pairFailure.vault.initialize(),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE"),
  );

  const candidateFailureStorage = new FaultStorage();
  candidateFailureStorage.failures.set(
    "getOrCreateKey",
    new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
  );
  await assert.rejects(
    makeVault(candidateFailureStorage).vault.initialize(),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
  );

  const invalidKeyStorage = new FaultStorage();
  invalidKeyStorage.key = {
    keyId: canopyProofMobileEvidenceVaultKeyId,
    keyVersion: canopyProofMobileEvidenceVaultKeyVersion,
    key: {} as CryptoKey,
    createdAt: "2026-07-17T02:00:00.000Z",
  };
  await assert.rejects(
    makeVault(invalidKeyStorage).vault.initialize(),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
  );
});

test("authenticated but malformed plaintext is rejected for JSON, record identity, and payload hash mismatch", async (context) => {
  for (const scenario of ["json", "record-id", "payload-hash"] as const) {
    await context.test(scenario, async () => {
      const target = makeVault();
      const draft = await target.vault.queueCapture({
        ...capture,
        projectId: `project_plaintext_${scenario}`,
      });
      await rewriteEnvelopePlaintext(target.storage, draft.id, (plaintext) => {
        if (scenario === "json") return "{";
        const value = JSON.parse(plaintext) as Record<string, unknown>;
        if (scenario === "record-id") {
          value.id = `cp_evidence_draft_${"f".repeat(32)}`;
        } else {
          value.payloadHash = "f".repeat(64);
        }
        return JSON.stringify(value);
      });
      await assert.rejects(
        target.vault.getDraft(draft.id),
        (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
      );
    });
  }
});

test("replace CAS exhaustion, quota DOM errors, erase, close, and key promise retry remain fail-closed", async () => {
  const target = makeVault();
  const draft = await target.vault.queueCapture(capture);
  target.storage.replaceMisses = 3;
  await assert.rejects(
    target.vault.markPrerequisitesBlocked(draft.id, "CANOPYPROOF_AUTHORITY_UNAVAILABLE"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  target.storage.failures.set("replaceEnvelope", new Error("replace outage"));
  await assert.rejects(
    target.vault.markPrerequisitesBlocked(draft.id, "CANOPYPROOF_AUTHORITY_UNAVAILABLE"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE"),
  );

  const quota = makeVault(new FaultStorage(), { maximumRecords: 1 });
  await quota.vault.queueCapture(capture);
  await assert.rejects(
    quota.vault.queueCapture({ ...capture, projectId: "project_quota" }),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED"),
  );

  await target.vault.eraseLocalVault();
  assert.equal(target.storage.envelopes.size, 0);
  target.vault.close();
  assert.equal(target.storage.closed, true);

  const retryStorage = new FaultStorage();
  retryStorage.failures.set("getKey", new Error("temporary"));
  const retryVault = makeVault(retryStorage).vault;
  await assert.rejects(retryVault.initialize());
  retryStorage.failures.delete("getKey");
  await retryVault.initialize();
  assert.ok(retryStorage.key);
});

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function rewriteEnvelopePlaintext(
  storage: FaultStorage,
  recordId: string,
  transform: (plaintext: string) => string,
): Promise<void> {
  const envelope = storage.envelopes.get(recordId);
  assert.ok(envelope);
  assert.ok(storage.key);
  const aad = new TextEncoder().encode(stableStringify({
    domain: "canopyproof/mobile-evidence/envelope/v1",
    envelopeVersion: canopyProofMobileEvidenceVaultEnvelopeVersion,
    payloadSchemaVersion: canopyProofMobileEvidenceDraftSchemaVersion,
    keyId: canopyProofMobileEvidenceVaultKeyId,
    keyVersion: canopyProofMobileEvidenceVaultKeyVersion,
    recordId: envelope.recordId,
    revision: envelope.revision,
  }));
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: envelope.iv, additionalData: aad, tagLength: 128 },
    storage.key.key,
    envelope.ciphertext,
  );
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: envelope.iv, additionalData: aad, tagLength: 128 },
    storage.key.key,
    new TextEncoder().encode(transform(new TextDecoder().decode(plaintext))),
  );
  storage.envelopes.set(recordId, { ...envelope, ciphertext });
}
