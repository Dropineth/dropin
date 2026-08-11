import {
  CanopyProofMobileEvidenceVault,
  CanopyProofMobileEvidenceVaultError,
  canopyProofLegacyMobileEvidenceStorageKey,
  type CanopyProofMobileEvidenceLegacyMigrationResult,
  type CanopyProofMobileEvidenceVaultEnvelope,
  type CanopyProofMobileEvidenceVaultKeyRecord,
  type CanopyProofMobileEvidenceVaultStorage,
} from "./canopyproof-mobile-evidence-vault";

const databaseName = "canopyproof-mobile-evidence-vault";
const databaseVersion = 1;
const keyStoreName = "keys";
const draftStoreName = "drafts";

export class CanopyProofMobileEvidenceIndexedDbStorage implements CanopyProofMobileEvidenceVaultStorage {
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory = requireIndexedDb()) {}

  async getOrCreateKey(
    candidate: CanopyProofMobileEvidenceVaultKeyRecord,
  ): Promise<CanopyProofMobileEvidenceVaultKeyRecord> {
    const database = await this.database();
    const transaction = database.transaction(keyStoreName, "readwrite", { durability: "strict" });
    const completion = transactionComplete(transaction);
    try {
      const store = transaction.objectStore(keyStoreName);
      const existing = await requestResult<CanopyProofMobileEvidenceVaultKeyRecord | undefined>(
        store.get(candidate.keyId),
      );
      if (existing) {
        await completion;
        return existing;
      }
      await requestResult(store.add(candidate));
      await completion;
      return candidate;
    } catch (error) {
      await completion.catch(() => undefined);
      if (isDomErrorNamed(error, "ConstraintError")) {
        const winningRecord = await this.getKey(candidate.keyId);
        if (winningRecord) return winningRecord;
      }
      throw error;
    }
  }

  async getKey(keyId: string): Promise<CanopyProofMobileEvidenceVaultKeyRecord | undefined> {
    const database = await this.database();
    const transaction = database.transaction(keyStoreName, "readonly");
    const completion = transactionComplete(transaction);
    const result = await requestResult<CanopyProofMobileEvidenceVaultKeyRecord | undefined>(
      transaction.objectStore(keyStoreName).get(keyId),
    );
    await completion;
    return result;
  }

  async listEnvelopes(): Promise<readonly CanopyProofMobileEvidenceVaultEnvelope[]> {
    const database = await this.database();
    const transaction = database.transaction(draftStoreName, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult<CanopyProofMobileEvidenceVaultEnvelope[]>(
      transaction.objectStore(draftStoreName).getAll(),
    );
    await completion;
    return records.map(normalizeEnvelopeClone);
  }

  async getEnvelope(recordId: string): Promise<CanopyProofMobileEvidenceVaultEnvelope | undefined> {
    const database = await this.database();
    const transaction = database.transaction(draftStoreName, "readonly");
    const completion = transactionComplete(transaction);
    const record = await requestResult<CanopyProofMobileEvidenceVaultEnvelope | undefined>(
      transaction.objectStore(draftStoreName).get(recordId),
    );
    await completion;
    return record ? normalizeEnvelopeClone(record) : undefined;
  }

  async insertEnvelope(
    envelope: CanopyProofMobileEvidenceVaultEnvelope,
    maximumRecords: number,
  ): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(draftStoreName, "readwrite", { durability: "strict" });
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(draftStoreName);
    const count = await requestResult<number>(store.count());
    if (count >= maximumRecords) {
      transaction.abort();
      await completion.catch(() => undefined);
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED");
    }
    await requestResult(store.add(envelope));
    await completion;
  }

  async importEnvelopes(
    envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[],
    maximumRecords: number,
  ): Promise<readonly string[]> {
    const database = await this.database();
    const transaction = database.transaction(draftStoreName, "readwrite", { durability: "strict" });
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(draftStoreName);
    const existingKeys = new Set(
      (await requestResult<IDBValidKey[]>(store.getAllKeys())).map((key) => String(key)),
    );
    const additions = envelopes.filter((envelope) => !existingKeys.has(envelope.recordId));
    if (existingKeys.size + additions.length > maximumRecords) {
      transaction.abort();
      await completion.catch(() => undefined);
      throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED");
    }
    await Promise.all(additions.map((envelope) => requestResult(store.add(envelope))));
    await completion;
    return additions.map((envelope) => envelope.recordId);
  }

  async replaceEnvelope(
    envelope: CanopyProofMobileEvidenceVaultEnvelope,
    expectedRevision: number,
  ): Promise<boolean> {
    const database = await this.database();
    const transaction = database.transaction(draftStoreName, "readwrite", { durability: "strict" });
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(draftStoreName);
    const current = await requestResult<CanopyProofMobileEvidenceVaultEnvelope | undefined>(
      store.get(envelope.recordId),
    );
    if (!current || current.revision !== expectedRevision) {
      await completion;
      return false;
    }
    await requestResult(store.put(envelope));
    await completion;
    return true;
  }

  async deleteEnvelope(recordId: string, expectedRevision: number): Promise<boolean> {
    const database = await this.database();
    const transaction = database.transaction(draftStoreName, "readwrite", { durability: "strict" });
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(draftStoreName);
    const current = await requestResult<CanopyProofMobileEvidenceVaultEnvelope | undefined>(store.get(recordId));
    if (!current || current.revision !== expectedRevision) {
      await completion;
      return false;
    }
    await requestResult(store.delete(recordId));
    await completion;
    return true;
  }

  async clear(): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction([keyStoreName, draftStoreName], "readwrite", {
      durability: "strict",
    });
    const completion = transactionComplete(transaction);
    await Promise.all([
      requestResult(transaction.objectStore(keyStoreName).clear()),
      requestResult(transaction.objectStore(draftStoreName).clear()),
    ]);
    await completion;
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close()).catch(() => undefined);
    this.databasePromise = undefined;
  }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= openDatabase(this.factory, () => {
      this.databasePromise = undefined;
    }).catch((error: unknown) => {
      this.databasePromise = undefined;
      throw error;
    });
    return this.databasePromise;
  }
}

export function createCanopyProofMobileEvidenceBrowserVault(): CanopyProofMobileEvidenceVault {
  return new CanopyProofMobileEvidenceVault({
    storage: new CanopyProofMobileEvidenceIndexedDbStorage(),
  });
}

export async function migrateCanopyProofLegacyMobileEvidenceLocalStorage(
  vault: CanopyProofMobileEvidenceVault,
  storage: Pick<Storage, "getItem" | "removeItem"> = window.localStorage,
): Promise<CanopyProofMobileEvidenceLegacyMigrationResult> {
  let raw: string | null;
  try {
    raw = storage.getItem(canopyProofLegacyMobileEvidenceStorageKey);
  } catch (error) {
    throw new CanopyProofMobileEvidenceVaultError(
      "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE",
      { cause: error },
    );
  }
  if (raw === null) return { state: "no_legacy_data", recordCount: 0, recordIds: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CanopyProofMobileEvidenceVaultError(
      "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID",
      { cause: error },
    );
  }
  const result = await vault.importLegacyDrafts(parsed);
  try {
    storage.removeItem(canopyProofLegacyMobileEvidenceStorageKey);
  } catch (error) {
    throw new CanopyProofMobileEvidenceVaultError(
      "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE",
      { cause: error },
    );
  }
  return result;
}

function openDatabase(factory: IDBFactory, onVersionChange: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = factory.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(keyStoreName)) {
        database.createObjectStore(keyStoreName, { keyPath: "keyId" });
      }
      if (!database.objectStoreNames.contains(draftStoreName)) {
        database.createObjectStore(draftStoreName, { keyPath: "recordId" });
      }
    };
    request.onerror = () => {
      settled = true;
      reject(request.error ?? new Error("IndexedDB open failed."));
    };
    request.onblocked = () => {
      settled = true;
      reject(new Error("IndexedDB upgrade is blocked by another context."));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => {
        database.close();
        onVersionChange();
      };
      resolve(database);
    };
  });
}

function requestResult<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    if (transaction.error) {
      reject(transaction.error);
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function normalizeEnvelopeClone(
  envelope: CanopyProofMobileEvidenceVaultEnvelope,
): CanopyProofMobileEvidenceVaultEnvelope {
  const iv = envelope.iv instanceof Uint8Array
    ? new Uint8Array(envelope.iv)
    : new Uint8Array(envelope.iv as unknown as ArrayBuffer);
  const ciphertext = envelope.ciphertext instanceof ArrayBuffer
    ? envelope.ciphertext.slice(0)
    : (envelope.ciphertext as unknown as Uint8Array).slice().buffer;
  return { ...envelope, iv, ciphertext };
}

function requireIndexedDb(): IDBFactory {
  if (!globalThis.indexedDB) {
    throw new CanopyProofMobileEvidenceVaultError("CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE");
  }
  return globalThis.indexedDB;
}

function isDomErrorNamed(error: unknown, expectedName: string): boolean {
  return typeof error === "object" && error !== null &&
    "name" in error && (error as { readonly name?: unknown }).name === expectedName;
}
