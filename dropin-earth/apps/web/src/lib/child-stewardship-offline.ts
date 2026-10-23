/** Synthetic-only draft storage. No raw media, free text or personal fields. */
export const CHILD_DRAFT_SCHEMA = "CanopyProof-SyntheticDraft/2" as const;
export type ObservationChoice = "green_leaves" | "yellow_leaves" | "not_sure";
export interface ChildDraft {
  schema: typeof CHILD_DRAFT_SCHEMA;
  id: string;
  profile: "synthetic-a" | "synthetic-b";
  task: "synthetic-indoor-comparison";
  answer: ObservationChoice;
  source: "synthetic_reference";
  createdAt: string;
  consentEpoch: number;
  submissionVersion: number | null;
  serverBinding: { sessionId: string; profileId: string; consentEpoch: number; assignmentId: string } | null;
}
export interface SealedChildDraft {
  id: string;
  profile: ChildDraft["profile"];
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}
export interface ChildDemoSession {
  schema: "CanopyProof-SyntheticResumeTicket/1";
  serverOrigin: string;
  sessionId: string;
  expiresAt: string;
  profileId: string;
  assignmentId: string;
  consentEpoch: number;
  localEpoch: number;
  resumeTicket: string;
}
export function parseChildDemoSession(input: unknown): ChildDemoSession {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("SESSION_INVALID");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "assignmentId,consentEpoch,expiresAt,localEpoch,profileId,resumeTicket,schema,serverOrigin,sessionId" ||
    value.schema !== "CanopyProof-SyntheticResumeTicket/1" || typeof value.serverOrigin !== "string" ||
    !/^https?:\/\/[^\s]+$/.test(value.serverOrigin) || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) ||
    [value.sessionId, value.profileId, value.assignmentId].some(item => typeof item !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item)) ||
    [value.consentEpoch, value.localEpoch].some(item => !Number.isSafeInteger(item) || Number(item) < 0)) throw new Error("SESSION_INVALID");
  if (typeof value.resumeTicket !== "string" || !/^cp-resume\.[A-Za-z0-9_-]{43}$/.test(value.resumeTicket)) throw new Error("SESSION_INVALID");
  return value as unknown as ChildDemoSession;
}
export interface ChildDraftStorage {
  getKey(profile: ChildDraft["profile"]): Promise<CryptoKey | undefined>;
  putKey(profile: ChildDraft["profile"], key: CryptoKey): Promise<CryptoKey>;
  put(value: SealedChildDraft): Promise<void>;
  list(profile: ChildDraft["profile"]): Promise<SealedChildDraft[]>;
  remove(id: string, profile: ChildDraft["profile"]): Promise<void>;
  clear(profile: ChildDraft["profile"]): Promise<void>;
  putSession(value: SealedChildDraft): Promise<void>;
  getSession(profile: ChildDraft["profile"]): Promise<SealedChildDraft | undefined>;
  removeSession(profile: ChildDraft["profile"]): Promise<void>;
}
export function parseChildDraft(input: unknown): ChildDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("DRAFT_INVALID");
  let draft = input as Record<string, unknown>;
  // v1 drafts remain readable, but absent persisted intents cannot be resumed as a previously sent v2 request.
  if (draft.schema === "CanopyProof-SyntheticDraft/1" && !Object.hasOwn(draft, "submissionVersion")) draft = { ...draft, schema: CHILD_DRAFT_SCHEMA, submissionVersion: null };
  const keys = ["schema", "id", "profile", "task", "answer", "source", "createdAt", "consentEpoch", "serverBinding", "submissionVersion"];
  if (Object.keys(draft).length !== keys.length || Object.keys(draft).some(key => !keys.includes(key)) ||
    draft.schema !== CHILD_DRAFT_SCHEMA || typeof draft.id !== "string" || !/^[a-f0-9-]{36}$/.test(draft.id) ||
    !["synthetic-a", "synthetic-b"].includes(String(draft.profile)) ||
    draft.task !== "synthetic-indoor-comparison" || draft.source !== "synthetic_reference" ||
    !["green_leaves", "yellow_leaves", "not_sure"].includes(String(draft.answer)) ||
    typeof draft.createdAt !== "string" || !Number.isFinite(Date.parse(draft.createdAt)) ||
    !Number.isSafeInteger(draft.consentEpoch) || Number(draft.consentEpoch) < 0) throw new Error("DRAFT_INVALID");
  if (draft.submissionVersion !== null && (!Number.isSafeInteger(draft.submissionVersion) || Number(draft.submissionVersion) < 0)) throw new Error("DRAFT_INVALID");
  if (draft.serverBinding !== null) {
    const binding = draft.serverBinding as Record<string, unknown>;
    if (!binding || typeof binding !== "object" || Array.isArray(binding) || Object.keys(binding).sort().join(",") !== "assignmentId,consentEpoch,profileId,sessionId" ||
      [binding.sessionId, binding.profileId, binding.assignmentId].some(value => typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) ||
      !Number.isSafeInteger(binding.consentEpoch) || Number(binding.consentEpoch) < 0) throw new Error("DRAFT_INVALID");
  }
  return draft as unknown as ChildDraft;
}
const associatedData = (profile: ChildDraft["profile"], id: string, schema: string = CHILD_DRAFT_SCHEMA) => new TextEncoder().encode(`${schema}:${profile}:${id}`);
export class ChildDraftVault {
  private generations = new Map<ChildDraft["profile"], number>();
  private keys = new Map<ChildDraft["profile"], Promise<CryptoKey>>();
  constructor(readonly storage: ChildDraftStorage, private readonly cryptography: Crypto = globalThis.crypto) {}
  private key(profile: ChildDraft["profile"]): Promise<CryptoKey> {
    const pending = this.keys.get(profile);
    if (pending) return pending;
    const result = this.loadKey(profile);
    this.keys.set(profile, result);
    void result.catch(() => this.keys.delete(profile));
    return result;
  }
  private async loadKey(profile: ChildDraft["profile"]): Promise<CryptoKey> {
    const existing = await this.storage.getKey(profile);
    if (existing) return existing;
    const key = await this.cryptography.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    return this.storage.putKey(profile, key);
  }
  async save(input: ChildDraft): Promise<void> {
    const draft = parseChildDraft(input);
    const generation = this.generations.get(draft.profile) ?? 0;
    const key = await this.key(draft.profile);
    const iv = this.cryptography.getRandomValues(new Uint8Array(12));
    const ciphertext = await this.cryptography.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associatedData(draft.profile, draft.id) }, key, new TextEncoder().encode(JSON.stringify(draft)));
    if ((this.generations.get(draft.profile) ?? 0) !== generation) throw new Error("DRAFT_CLEARED");
    await this.storage.put({ id: draft.id, profile: draft.profile, iv, ciphertext });
  }
  async saveSession(profile: ChildDraft["profile"], input: ChildDemoSession): Promise<void> {
    const generation = this.generations.get(profile) ?? 0;
    const session = parseChildDemoSession(input);
    if (session.profileId !== (profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b")) throw new Error("SESSION_SCOPE_MISMATCH");
    const key = await this.key(profile);
    const iv = this.cryptography.getRandomValues(new Uint8Array(12));
    const id = `resume-${profile}`;
    const ciphertext = await this.cryptography.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associatedData(profile, id) }, key, new TextEncoder().encode(JSON.stringify(session)));
    if ((this.generations.get(profile) ?? 0) !== generation) throw new Error("SESSION_REVOKED");
    await this.storage.putSession({ id, profile, iv, ciphertext });
  }
  async loadSession(profile: ChildDraft["profile"]): Promise<ChildDemoSession | null> {
    const record = await this.storage.getSession(profile);
    if (!record) return null;
    if (record.profile !== profile || record.id !== `resume-${profile}`) throw new Error("SESSION_INVALID");
    const key = await this.storage.getKey(profile);
    if (!key) throw new Error("DRAFT_KEY_UNAVAILABLE");
    const plaintext = await this.cryptography.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv), additionalData: associatedData(profile, record.id) }, key, record.ciphertext);
    const session = parseChildDemoSession(JSON.parse(new TextDecoder().decode(plaintext)));
    if (session.profileId !== (profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b")) throw new Error("SESSION_SCOPE_MISMATCH");
    if (Date.parse(session.expiresAt) <= Date.now()) { await this.storage.removeSession(profile); return null; }
    return session;
  }
  async forgetSession(profile: ChildDraft["profile"]): Promise<void> { this.generations.set(profile, (this.generations.get(profile) ?? 0) + 1); await this.storage.removeSession(profile); }
  async clear(profile: ChildDraft["profile"]): Promise<void> {
    this.generations.set(profile, (this.generations.get(profile) ?? 0) + 1);
    await this.keys.get(profile)?.catch(() => undefined);
    await this.storage.clear(profile);
    this.keys.delete(profile);
  }
  async list(profile: ChildDraft["profile"]): Promise<ChildDraft[]> {
    const records = await this.storage.list(profile);
    if (!records.length) return [];
    const key = await this.storage.getKey(profile);
    if (!key) throw new Error("DRAFT_KEY_UNAVAILABLE");
    return Promise.all(records.map(async record => {
      if (record.profile !== profile) throw new Error("DRAFT_SCOPE_MISMATCH");
      let plaintext: ArrayBuffer;
      try { plaintext = await this.cryptography.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv), additionalData: associatedData(profile, record.id) }, key, record.ciphertext); }
      catch { plaintext = await this.cryptography.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv), additionalData: associatedData(profile, record.id, "CanopyProof-SyntheticDraft/1") }, key, record.ciphertext); }
      const result = parseChildDraft(JSON.parse(new TextDecoder().decode(plaintext)));
      if (result.profile !== profile || result.id !== record.id) throw new Error("DRAFT_SCOPE_MISMATCH");
      return result;
    }));
  }
}
/** Nonextractable keys are origin-scoped; they do not protect an unlocked shared browser. Clear on shared-device exit. */
export class IndexedChildDraftStorage implements ChildDraftStorage {
  private database: Promise<IDBDatabase>;
  constructor(name = "canopyproof-child-synthetic-v1") {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("keys")) request.result.createObjectStore("keys");
        if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts", { keyPath: "id" });
        if (!request.result.objectStoreNames.contains("sessions")) request.result.createObjectStore("sessions", { keyPath: "profile" });
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      request.onblocked = () => reject(new Error("LOCAL_STORAGE_BLOCKED"));
    });
  }
  private async request<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.database;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      transaction.onabort = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
    });
  }
  getKey(profile: ChildDraft["profile"]): Promise<CryptoKey | undefined> { return this.request("keys", "readonly", store => store.get(profile)); }
  async putKey(profile: ChildDraft["profile"], key: CryptoKey): Promise<CryptoKey> {
    const database = await this.database;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("keys", "readwrite");
      const store = transaction.objectStore("keys");
      const request = store.get(profile);
      let selected = key;
      request.onsuccess = () => { if (request.result) selected = request.result as CryptoKey; else store.put(key, profile); };
      transaction.oncomplete = () => resolve(selected);
      transaction.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      transaction.onabort = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
    });
  }
  async putSession(value: SealedChildDraft): Promise<void> { await this.request("sessions", "readwrite", store => store.put(value)); }
  getSession(profile: ChildDraft["profile"]): Promise<SealedChildDraft | undefined> { return this.request("sessions", "readonly", store => store.get(profile)); }
  async removeSession(profile: ChildDraft["profile"]): Promise<void> { await this.request("sessions", "readwrite", store => store.delete(profile)); }
  async put(value: SealedChildDraft): Promise<void> { await this.request("drafts", "readwrite", store => store.put(value)); }
  async list(profile: ChildDraft["profile"]): Promise<SealedChildDraft[]> { return (await this.request<SealedChildDraft[]>("drafts", "readonly", store => store.getAll())).filter(value => value.profile === profile); }
  async remove(id: string, profile: ChildDraft["profile"]): Promise<void> {
    const database = await this.database;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      const request = store.get(id);
      request.onsuccess = () => { if (request.result?.profile === profile) store.delete(id); };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      transaction.onabort = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
    });
  }
  async clear(profile: ChildDraft["profile"]): Promise<void> {
    const database = await this.database;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(["keys", "drafts", "sessions"], "readwrite");
      transaction.objectStore("keys").delete(profile);
      transaction.objectStore("sessions").delete(profile);
      const store = transaction.objectStore("drafts");
      const cursor = store.openCursor();
      cursor.onsuccess = () => { const current = cursor.result; if (current) { if (current.value.profile === profile) current.delete(); current.continue(); } };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      transaction.onabort = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
    });
  }
}
export interface ChildSyncReceipt { draftId: string; receiptId: string; status: "received"; synthetic: true }
export interface ChildSyncTransport {
  /** May contact server for current authorization, but must not send draft contents. */
  prepare(signal: AbortSignal): Promise<{ synthetic: true; allowed: boolean }>;
  /** Server must repeat current consent, principal, task and idempotency checks. */
  send(draft: ChildDraft, signal: AbortSignal): Promise<ChildSyncReceipt>;
}
export class ChildDraftSync {
  private approvals = new Map<string, { epoch: number; object: string }>();
  private epoch = 0;
  private active = new Set<AbortController>();
  constructor(private readonly profile: ChildDraft["profile"], initialEpoch = 0) {
    if (!Number.isSafeInteger(initialEpoch) || initialEpoch < 0) throw new Error("EPOCH_INVALID");
    this.epoch = initialEpoch;
  }
  get currentEpoch(): number { return this.epoch; }
  authorize(draft: ChildDraft): void { if (draft.profile !== this.profile) throw new Error("DRAFT_SCOPE_MISMATCH"); this.approvals.set(draft.id, { epoch: this.epoch, object: JSON.stringify(parseChildDraft(draft)) }); }
  withdraw(epoch = this.epoch + 1): void { this.approvals.clear(); this.epoch = Math.max(epoch, this.epoch + 1); for (const controller of this.active) controller.abort(); this.active.clear(); }
  private assertAllowed(draft: ChildDraft, epoch: number): void {
    if (this.approvals.get(draft.id)?.epoch !== epoch || this.approvals.get(draft.id)?.object !== JSON.stringify(draft) || this.epoch !== epoch || draft.profile !== this.profile) throw new Error("CONSENT_WITHDRAWN");
  }
  async sync(input: ChildDraft, transport: ChildSyncTransport): Promise<ChildSyncReceipt> {
    const draft = parseChildDraft(input);
    const epoch = this.epoch;
    this.assertAllowed(draft, epoch);
    const controller = new AbortController();
    this.active.add(controller);
    try {
      const permission = await transport.prepare(controller.signal);
      this.assertAllowed(draft, epoch);
      if (permission.synthetic !== true || permission.allowed !== true) throw new Error("SERVICE_UNAVAILABLE");
      // The transport repeats scope/epoch checks after its own asynchronous work, immediately before POST.
      const receipt = await transport.send(draft, controller.signal);
      this.assertAllowed(draft, epoch);
      if (receipt.synthetic !== true || receipt.status !== "received" || receipt.draftId !== draft.id || typeof receipt.receiptId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(receipt.receiptId)) throw new Error("RECEIPT_INVALID");
      return receipt;
    } finally { this.active.delete(controller); }
  }
}
