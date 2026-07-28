import assert from "node:assert/strict";
import test from "node:test";
import {
  CanopyProofMobileEvidenceVault,
  CanopyProofMobileEvidenceVaultError,
  canopyProofLegacyMobileEvidenceStorageKey,
  type CanopyProofMobileEvidenceVaultEnvelope,
  type CanopyProofMobileEvidenceVaultKeyRecord,
  type CanopyProofMobileEvidenceVaultStorage,
} from "../../apps/web/src/lib/canopyproof-mobile-evidence-vault.js";
import { migrateCanopyProofLegacyMobileEvidenceLocalStorage } from
  "../../apps/web/src/lib/canopyproof-mobile-evidence-indexeddb.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const capture = {
  evidenceType: "tree_planting" as const,
  projectId: "project_mobile_001",
  observedAt: "2026-07-17T01:00:00.000Z",
  latitude: 1.2345,
  longitude: 36.789,
  gpsAccuracyMeters: 4.5,
  mediaHash: hashA,
  deviceFingerprintHash: hashB,
  exifHash: hashC,
  notes: "Field team observed healthy seedlings.",
};

function serverBinding(clientRecordId: string, projectId = capture.projectId) {
  return {
    clientRecordId,
    clientBatchId: `cp_mobile_evidence_batch_${"d".repeat(32)}`,
    organizationId: "organization_mobile_001",
    projectId,
    consentReceiptId: "consent_receipt_mobile_001",
    consentReceiptRoot: hashA,
    deviceAttestationId: "device_attestation_mobile_001",
    deviceAttestationRoot: hashB,
    evidenceId: "evidence_mobile_001",
    evidenceRoot: hashA,
    syncPayloadHash: hashC,
    boundAt: "2026-07-17T02:00:00.000Z",
    bindingRoot: hashB,
  };
}

function acknowledgement(clientRecordId: string, batchId: string) {
  return {
    clientRecordId,
    evidenceId: "evidence_mobile_001",
    evidenceRoot: hashA,
    itemRoot: hashA,
    batchId,
    batchRoot: hashB,
    auditEventRoot: hashC,
    acknowledgedAt: "2026-07-17T02:01:01.000Z",
  };
}

class MemoryVaultStorage implements CanopyProofMobileEvidenceVaultStorage {
  key: CanopyProofMobileEvidenceVaultKeyRecord | undefined;
  closed = false;
  readonly envelopes = new Map<string, CanopyProofMobileEvidenceVaultEnvelope>();

  async getOrCreateKey(candidate: CanopyProofMobileEvidenceVaultKeyRecord) {
    this.key ??= candidate;
    return this.key;
  }

  async getKey() {
    return this.key;
  }

  async listEnvelopes() {
    return [...this.envelopes.values()].map(cloneEnvelope);
  }

  async getEnvelope(recordId: string) {
    const envelope = this.envelopes.get(recordId);
    return envelope ? cloneEnvelope(envelope) : undefined;
  }

  async insertEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, maximumRecords: number) {
    if (this.envelopes.size >= maximumRecords || this.envelopes.has(envelope.recordId)) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED");
    }
    this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
  }

  async importEnvelopes(
    envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[],
    maximumRecords: number,
  ) {
    const additions = envelopes.filter((envelope) => !this.envelopes.has(envelope.recordId));
    if (this.envelopes.size + additions.length > maximumRecords) {
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED");
    }
    for (const envelope of additions) this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
    return additions.map((envelope) => envelope.recordId);
  }

  async replaceEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, expectedRevision: number) {
    const current = this.envelopes.get(envelope.recordId);
    if (!current || current.revision !== expectedRevision) return false;
    this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
    return true;
  }

  async deleteEnvelope(recordId: string, expectedRevision: number) {
    const current = this.envelopes.get(recordId);
    if (!current || current.revision !== expectedRevision) return false;
    this.envelopes.delete(recordId);
    return true;
  }

  async clear() {
    this.key = undefined;
    this.envelopes.clear();
  }

  close() {
    this.closed = true;
  }

  mutate(recordId: string, update: (envelope: CanopyProofMobileEvidenceVaultEnvelope) =>
    CanopyProofMobileEvidenceVaultEnvelope) {
    const current = this.envelopes.get(recordId);
    assert.ok(current);
    this.envelopes.set(recordId, update(cloneEnvelope(current)));
  }
}

function cloneEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope): CanopyProofMobileEvidenceVaultEnvelope {
  return {
    ...envelope,
    iv: new Uint8Array(envelope.iv),
    ciphertext: envelope.ciphertext.slice(0),
  };
}

function createVault(
  storage = new MemoryVaultStorage(),
  options: Readonly<{ now?: () => Date; maximumRecords?: number }> = {},
) {
  return {
    storage,
    vault: new CanopyProofMobileEvidenceVault({
      storage,
      crypto: globalThis.crypto,
      now: options.now ?? (() => new Date("2026-07-17T02:00:00.000Z")),
      ...(options.maximumRecords === undefined ? {} : { maximumRecords: options.maximumRecords }),
    }),
  };
}

function assertVaultError(error: unknown, code: CanopyProofMobileEvidenceVaultError["code"]) {
  assert.ok(error instanceof CanopyProofMobileEvidenceVaultError);
  assert.equal(error.code, code);
  return true;
}

test("mobile evidence vault encrypts sensitive drafts with a non-extractable key", async () => {
  const { storage, vault } = createVault();
  const first = await vault.queueCapture(capture);
  const second = await vault.queueCapture(capture);
  const envelopes = await storage.listEnvelopes();

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
  assert.equal(first.payloadHash, second.payloadHash);
  assert.equal(envelopes.length, 2);
  assert.notDeepEqual(envelopes[0]?.iv, envelopes[1]?.iv);
  assert.equal(storage.key?.key.extractable, false);
  assert.deepEqual(storage.key?.key.usages.slice().sort(), ["decrypt", "encrypt"]);

  const serializedEnvelope = envelopes.map((envelope) =>
    `${Array.from(envelope.iv).join(",")}:${Array.from(new Uint8Array(envelope.ciphertext)).join(",")}`
  ).join("|");
  assert.doesNotMatch(serializedEnvelope, /Field team|project_mobile|1\.2345|36\.789/);
  assert.deepEqual(
    (await vault.listDrafts()).map((draft) => draft.id),
    [first.id, second.id].sort(),
  );
  assert.deepEqual((await vault.getDraft(first.id)).capture, capture);
});

test("mobile evidence vault rejects IV, ciphertext, revision AAD, record ID, and key loss tampering", async (context) => {
  for (const mutation of ["iv", "ciphertext", "revision", "recordId", "key"] as const) {
    await context.test(mutation, async () => {
      const { storage, vault } = createVault();
      const draft = await vault.queueCapture(capture);
      if (mutation === "key") {
        storage.key = undefined;
      } else {
        storage.mutate(draft.id, (envelope) => {
          if (mutation === "iv") {
            const iv = new Uint8Array(envelope.iv);
            iv[0] = (iv[0] ?? 0) ^ 0xff;
            return { ...envelope, iv };
          }
          if (mutation === "ciphertext") {
            const ciphertext = new Uint8Array(envelope.ciphertext.slice(0));
            ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff;
            return { ...envelope, ciphertext: ciphertext.buffer };
          }
          if (mutation === "revision") return { ...envelope, revision: envelope.revision + 1 };
          return { ...envelope, recordId: `cp_evidence_draft_${"f".repeat(32)}` };
        });
      }
      const reloaded = createVault(storage).vault;
      await assert.rejects(
        reloaded.listDrafts(),
        (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED"),
      );
    });
  }
});

test("mobile evidence vault preserves idempotency across authority binding, lease, retry, and acknowledgement", async () => {
  let now = new Date("2026-07-17T02:00:00.000Z");
  const { storage, vault } = createVault(new MemoryVaultStorage(), { now: () => now });
  const queued = await vault.queueCapture(capture);
  const bound = await vault.bindServerAuthority(queued.id, serverBinding(queued.id));
  const leased = await vault.leaseForSync(queued.id);

  assert.equal(bound.state, "ready_to_sync");
  assert.equal(leased.state, "sync_leased");
  assert.equal(leased.attemptCount, 1);
  assert.equal(leased.idempotencyKey, queued.idempotencyKey);

  now = new Date("2026-07-17T02:00:30.000Z");
  const retrying = await vault.releaseForRetry(
    queued.id,
    "CANOPYPROOF_API_UNAVAILABLE",
    "2026-07-17T02:01:00.000Z",
  );
  assert.equal(retrying.state, "ready_to_sync");
  assert.equal(retrying.idempotencyKey, queued.idempotencyKey);
  await assert.rejects(
    vault.leaseForSync(queued.id),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );

  now = new Date("2026-07-17T02:01:00.000Z");
  const secondLease = await vault.leaseForSync(queued.id);
  const acknowledged = await vault.acknowledge(
    queued.id,
    acknowledgement(queued.id, "offline_batch_mobile_001"),
  );
  assert.equal(secondLease.attemptCount, 2);
  assert.equal(acknowledged.state, "acknowledged");
  assert.equal(acknowledged.idempotencyKey, queued.idempotencyKey);
  assert.ok((await storage.getEnvelope(queued.id))?.revision >= 5);
});

test("two vault clients cannot claim the same sync lease", async () => {
  const storage = new MemoryVaultStorage();
  const first = createVault(storage).vault;
  const second = createVault(storage).vault;
  const queued = await first.queueCapture(capture);
  await first.bindServerAuthority(queued.id, serverBinding(queued.id));

  const results = await Promise.allSettled([
    first.leaseForSync(queued.id),
    second.leaseForSync(queued.id),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await first.getDraft(queued.id)).state, "sync_leased");
});

test("mobile evidence vault prevents authority regressions and closes its storage", async () => {
  let now = new Date("2026-07-17T02:00:00.000Z");
  const { storage, vault } = createVault(new MemoryVaultStorage(), { now: () => now });
  const queued = await vault.queueCapture(capture);
  const binding = serverBinding(queued.id);

  const bound = await vault.bindServerAuthority(queued.id, binding);
  const revisionAfterBinding = (await storage.getEnvelope(queued.id))?.revision;
  assert.equal((await vault.bindServerAuthority(queued.id, binding)).state, "ready_to_sync");
  assert.equal((await storage.getEnvelope(queued.id))?.revision, revisionAfterBinding);

  const blocked = await vault.markPrerequisitesBlocked(queued.id, "CANOPYPROOF_CONSENT_REVOKED");
  assert.equal(blocked.state, "blocked_prerequisites");
  assert.equal(blocked.serverBinding, null);
  assert.equal((await vault.bindServerAuthority(queued.id, binding)).state, "ready_to_sync");
  await vault.leaseForSync(queued.id);
  await vault.acknowledge(
    queued.id,
    acknowledgement(queued.id, "offline_batch_mobile_terminal_001"),
  );

  await assert.rejects(
    vault.markPrerequisitesBlocked(queued.id, "CANOPYPROOF_CONSENT_REVOKED"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );
  await assert.rejects(
    vault.bindServerAuthority(queued.id, binding),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );

  const second = await vault.queueCapture({ ...capture, projectId: "project_mobile_clock_002" });
  now = new Date("2026-07-17T01:59:59.000Z");
  await assert.rejects(
    vault.markPrerequisitesBlocked(second.id, "CANOPYPROOF_AUTHORITY_UNAVAILABLE"),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_STATE_CONFLICT"),
  );

  vault.close();
  assert.equal(storage.closed, true);
  assert.equal(bound.idempotencyKey, queued.idempotencyKey);
});

test("mobile evidence vault enforces quota without evicting existing drafts", async () => {
  const { vault } = createVault(new MemoryVaultStorage(), { maximumRecords: 1 });
  const first = await vault.queueCapture(capture);
  await assert.rejects(
    vault.queueCapture({ ...capture, projectId: "project_mobile_002" }),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED"),
  );
  assert.deepEqual((await vault.listDrafts()).map((draft) => draft.id), [first.id]);
});

test("legacy plaintext migration is deterministic, idempotent, and deletes plaintext only after verification", async () => {
  const { vault } = createVault();
  const legacy = [{
    id: "cp_evidence_draft_legacy001",
    evidenceType: "restoration",
    projectId: "project_mobile_legacy",
    observedAt: "2026-07-16T01:00:00.000Z",
    latitude: "1.25",
    longitude: "36.75",
    gpsAccuracyMeters: "5",
    mediaHash: hashA,
    deviceFingerprintHash: hashB,
    exifHash: hashC,
    notes: "Legacy field note",
    idempotencyKey: "idem_cp_evidence_draft_legacy001",
    verificationState: "draft_queued",
    createdAt: "2026-07-16T02:00:00.000Z",
  }];
  const values = new Map([[canopyProofLegacyMobileEvidenceStorageKey, JSON.stringify(legacy)]]);
  const localStorage = {
    getItem(key: string) { return values.get(key) ?? null; },
    removeItem(key: string) { values.delete(key); },
  };

  const migrated = await migrateCanopyProofLegacyMobileEvidenceLocalStorage(vault, localStorage);
  assert.equal(migrated.state, "migrated");
  assert.equal(migrated.recordCount, 1);
  assert.equal(values.has(canopyProofLegacyMobileEvidenceStorageKey), false);
  const first = await vault.getDraft(migrated.recordIds[0] ?? "");

  values.set(canopyProofLegacyMobileEvidenceStorageKey, JSON.stringify(legacy));
  const repeated = await migrateCanopyProofLegacyMobileEvidenceLocalStorage(vault, localStorage);
  assert.deepEqual(repeated.recordIds, migrated.recordIds);
  assert.equal((await vault.listDrafts()).length, 1);
  assert.equal((await vault.getDraft(repeated.recordIds[0] ?? "")).payloadHash, first.payloadHash);
});

test("invalid legacy migration remains atomic and preserves plaintext for recovery", async () => {
  const { vault } = createVault();
  const raw = JSON.stringify([{ invalid: true }]);
  const values = new Map([[canopyProofLegacyMobileEvidenceStorageKey, raw]]);
  const localStorage = {
    getItem(key: string) { return values.get(key) ?? null; },
    removeItem(key: string) { values.delete(key); },
  };

  await assert.rejects(
    migrateCanopyProofLegacyMobileEvidenceLocalStorage(vault, localStorage),
    (error) => assertVaultError(error, "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID"),
  );
  assert.equal(values.get(canopyProofLegacyMobileEvidenceStorageKey), raw);
  assert.deepEqual(await vault.listDrafts(), []);
});
