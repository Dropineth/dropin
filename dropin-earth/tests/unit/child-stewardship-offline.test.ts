import test from "node:test";
import assert from "node:assert/strict";
import { CHILD_DRAFT_SCHEMA, ChildDraftVault, ChildDraftSync, parseChildDraft, type ChildDraft, type ChildDraftStorage, type SealedChildDraft, type ChildSyncTransport } from "../../apps/web/src/lib/child-stewardship-offline.ts";
class MemoryStorage implements ChildDraftStorage {
  keys = new Map<string, CryptoKey>(); records = new Map<string, SealedChildDraft>();
  async getKey(profile: ChildDraft["profile"]) { return this.keys.get(profile); }
  async putKey(profile: ChildDraft["profile"], key: CryptoKey) { const existing = this.keys.get(profile); if (existing) return existing; this.keys.set(profile, key); return key; }
  async put(value: SealedChildDraft) { this.records.set(value.id, structuredClone(value)); }
  async list(profile: ChildDraft["profile"]) { return [...this.records.values()].filter(value => value.profile === profile); }
  async remove(id: string, profile: ChildDraft["profile"]) { if (this.records.get(id)?.profile === profile) this.records.delete(id); }
  async clear(profile: ChildDraft["profile"]) { this.keys.delete(profile); for (const record of await this.list(profile)) this.records.delete(record.id); }
}
const makeDraft = (changes: Partial<ChildDraft> = {}): ChildDraft => ({ schema: CHILD_DRAFT_SCHEMA, id: crypto.randomUUID(), profile: "synthetic-a", task: "synthetic-indoor-comparison", answer: "not_sure", source: "synthetic_reference", createdAt: "2026-10-23T02:00:00.000Z", consentEpoch: 0, serverBinding: null, ...changes });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
test("AT-20 closed draft schema rejects raw identity, biometrics, media and free text", () => {
  for (const field of ["iris", "face_embedding", "name", "notes", "photo", "lat", "wallet"]) assert.throws(() => parseChildDraft({ ...makeDraft(), [field]: "SYNTHETIC_FORBIDDEN_FIELD" }), /DRAFT_INVALID/);
  assert.throws(() => parseChildDraft(makeDraft({ answer: "arbitrary" as ChildDraft["answer"] })), /DRAFT_INVALID/);
});
test("AT-09 draft ciphertext contains no description; nonextractable AES-GCM key survives reopen", async () => {
  const storage = new MemoryStorage(); const draft = makeDraft();
  await new ChildDraftVault(storage).save(draft);
  assert.ok(storage.records.get(draft.id)!.ciphertext.byteLength > 0);
  assert.equal(new TextDecoder().decode(storage.records.get(draft.id)!.ciphertext).includes("synthetic_reference"), false);
  assert.equal(storage.keys.get("synthetic-a")!.extractable, false);
  assert.deepEqual(await new ChildDraftVault(storage).list("synthetic-a"), [draft]);
});
test("AT-09 concurrent saves share one key and remain decryptable", async () => {
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage);
  const drafts = Array.from({ length: 20 }, () => makeDraft());
  await Promise.all(drafts.map(draft => vault.save(draft)));
  assert.equal((await vault.list("synthetic-a")).length, drafts.length);
});
test("AT-20 profiles are isolated and authenticated associated data prevents relabelling ciphertext", async () => {
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage); const draft = makeDraft();
  await vault.save(draft); assert.deepEqual(await vault.list("synthetic-b"), []);
  storage.keys.set("synthetic-b", storage.keys.get("synthetic-a")!);
  storage.records.get(draft.id)!.profile = "synthetic-b";
  await assert.rejects(() => vault.list("synthetic-b"));
});
test("AT-20 tampered ciphertext fails authenticated decryption", async () => {
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage); const draft = makeDraft();
  await vault.save(draft); new Uint8Array(storage.records.get(draft.id)!.ciphertext)[3] ^= 1;
  await assert.rejects(() => vault.list("synthetic-a"));
});
test("AT-22 shared device cleanup removes only selected profile drafts and keys", async () => {
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage);
  await vault.save(makeDraft()); const other = makeDraft({ profile: "synthetic-b" }); await vault.save(other);
  await vault.clear("synthetic-a"); assert.deepEqual(await vault.list("synthetic-a"), []); assert.equal(storage.keys.has("synthetic-a"), false); assert.deepEqual(await vault.list("synthetic-b"), [other]);
  await vault.save(makeDraft()); assert.equal((await vault.list("synthetic-a")).length, 1);
});
test("EX-04 withdrawn drafts send zero bytes and do not even request a permit", async () => {
  const sync = new ChildDraftSync("synthetic-a"); let prepares = 0; let sends = 0;
  const transport: ChildSyncTransport = { prepare: async () => { prepares++; return { synthetic: true, allowed: true }; }, send: async draft => { sends++; return { synthetic: true, status: "received", draftId: draft.id, receiptId: "demo-receipt" }; } };
  sync.grant(); sync.withdraw(); await assert.rejects(() => sync.sync(makeDraft(), transport), /CONSENT_WITHDRAWN/); assert.equal(prepares, 0); assert.equal(sends, 0);
});
test("EX-04 withdrawal while server authorization is pending blocks first draft byte", async () => {
  const sync = new ChildDraftSync("synthetic-a"); sync.grant(); const permit = deferred<{ synthetic: true; allowed: boolean }>(); let sends = 0;
  const request = sync.sync(makeDraft(), { prepare: async () => permit.promise, send: async draft => { sends++; return { synthetic: true, status: "received", draftId: draft.id, receiptId: "demo-receipt" }; } });
  sync.withdraw(); permit.resolve({ synthetic: true, allowed: true }); await assert.rejects(() => request, /CONSENT_WITHDRAWN/); assert.equal(sends, 0);
});
test("EX-04 withdrawal aborts in-flight sending and never reports receipt as newly authorized", async () => {
  const sync = new ChildDraftSync("synthetic-a"); sync.grant(); const started = deferred<AbortSignal>(); const returned = deferred<void>(); const draft = makeDraft();
  const request = sync.sync(draft, { prepare: async () => ({ synthetic: true, allowed: true }), send: async (value, signal) => { started.resolve(signal); await returned.promise; return { synthetic: true, status: "received", draftId: value.id, receiptId: "demo-receipt" }; } });
  const signal = await started.promise; sync.withdraw(); assert.equal(signal.aborted, true); returned.resolve(); await assert.rejects(() => request, /CONSENT_WITHDRAWN/);
});
test("AT-16 same draft retry preserves stable draft ID after unknown network result", async () => {
  const sync = new ChildDraftSync("synthetic-a"); sync.grant(); const ids: string[] = []; const draft = makeDraft();
  const transport: ChildSyncTransport = { prepare: async () => ({ synthetic: true, allowed: true }), send: async value => { ids.push(value.id); if (ids.length === 1) throw new Error("RESPONSE_LOST"); return { synthetic: true, status: "received", draftId: value.id, receiptId: "demo-receipt" }; } };
  await assert.rejects(() => sync.sync(draft, transport)); assert.equal((await sync.sync(draft, transport)).receiptId, "demo-receipt"); assert.deepEqual(ids, [draft.id, draft.id]);
});
test("AT-06 unavailable or non-synthetic provider authorization cannot send draft", async () => {
  const sync = new ChildDraftSync("synthetic-a"); sync.grant(); let sends = 0;
  for (const permission of [{ synthetic: true, allowed: false }, { synthetic: false, allowed: true }]) await assert.rejects(() => sync.sync(makeDraft(), { prepare: async () => permission as { synthetic: true; allowed: boolean }, send: async () => { sends++; throw new Error(); } }), /SERVICE_UNAVAILABLE/);
  assert.equal(sends, 0);
});
test("AT-16 mismatched or fabricated receipt cannot acknowledge another draft", async () => {
  const sync = new ChildDraftSync("synthetic-a"); sync.grant(); await assert.rejects(() => sync.sync(makeDraft(), { prepare: async () => ({ synthetic: true, allowed: true }), send: async () => ({ synthetic: true, status: "received", draftId: crypto.randomUUID(), receiptId: "demo-receipt" }) }), /RECEIPT_INVALID/);
});
test("AT-06 regrant does not revive old consent epoch or another profile", async () => {
  const sync = new ChildDraftSync("synthetic-a"); sync.grant(); sync.withdraw(); sync.grant(); let sends = 0;
  const transport: ChildSyncTransport = { prepare: async () => ({ synthetic: true, allowed: true }), send: async () => { sends++; throw new Error(); } };
  await assert.rejects(() => sync.sync(makeDraft(), transport), /CONSENT_WITHDRAWN/);
  await assert.rejects(() => sync.sync(makeDraft({ profile: "synthetic-b", consentEpoch: 1 }), transport), /CONSENT_WITHDRAWN/); assert.equal(sends, 0);
});

// Uses the actual Hono route and learning domain with an explicitly test-only transactional store.
// This is not PostgreSQL, external-provider or production acceptance evidence.
import { ChildDemoApi } from "../../apps/web/src/lib/child-stewardship-api.ts";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.ts";
import { TestChildStore } from "../../services/api/src/domain/child-stewardship/store.ts";
function apiFixture() {
  const store = new TestChildStore();
  const app = createChildStewardshipRoutes({ mode: "synthetic-demo", store, now: () => "2026-10-23T02:00:00.000Z" });
  let viewHook: (() => Promise<void>) | undefined;
  const posts: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); const path = url.slice(url.indexOf("/v1") + 3);
    if (path === "/view" && viewHook) await viewHook();
    if (path === "/commands") posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return app.request(`http://synthetic.invalid${path}`, init);
  };
  const api = new ChildDemoApi("http://synthetic.invalid", fetcher);
  return { store, api, posts, setViewHook: (hook: (() => Promise<void>) | undefined) => { viewHook = hook; } };
}
test("AT-16 actual client + Hono + learning domain returns one receipt for stable replay", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = fixture.api.bindDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a"); sync.grant();
  const first = await sync.sync(draft, fixture.api.transport(draft));
  const second = await sync.sync(draft, fixture.api.transport(draft));
  assert.equal(first.receiptId, second.receiptId);
  assert.equal(Object.keys([...fixture.store.sessions.values()][0]!.snapshot.learning.observations).length, 1);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 2);
});
test("EX-04 actual API withdrawal between both authorization reads sends zero observation bytes", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = fixture.api.bindDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a"); sync.grant();
  let reads = 0;
  fixture.setViewHook(async () => {
    reads++;
    if (reads === 2) {
      fixture.setViewHook(undefined);
      await fixture.api.command("child", { type: "set-assent", profileId: "demo-profile-a", purpose: "upload", willing: false });
    }
  });
  await assert.rejects(() => sync.sync(draft, fixture.api.transport(draft)), /CONSENT_WITHDRAWN/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
  assert.equal(Object.keys([...fixture.store.sessions.values()][0]!.snapshot.learning.observations).length, 0);
});
test("EX-04 actual API withdrawal then regrant never revives older bound draft", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = fixture.api.bindDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a"); sync.grant();
  await fixture.api.command("child", { type: "set-assent", profileId: "demo-profile-a", purpose: "upload", willing: false });
  await fixture.api.command("guardian", { type: "grant-consent", profileId: "demo-profile-a", purpose: "upload", policyVersion: "child-learning-demo-v1" });
  await fixture.api.command("child", { type: "set-assent", profileId: "demo-profile-a", purpose: "upload", willing: true });
  await assert.rejects(() => sync.sync(draft, fixture.api.transport(draft)), /CONSENT_WITHDRAWN/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});
test("AT-09 persisted binding prevents uncertain draft replay into a new synthetic session", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = fixture.api.bindDraft(makeDraft(), true);
  const vault = new ChildDraftVault(new MemoryStorage()); await vault.save(draft);
  const [restored] = await vault.list("synthetic-a");
  await fixture.api.start(); await fixture.api.setup("9-12", true);
  const sync = new ChildDraftSync("synthetic-a"); sync.grant();
  await assert.rejects(() => sync.sync(restored!, fixture.api.transport(restored!)), /CONSENT_WITHDRAWN/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});

test("EX-04 unknown durable revocation state never rebinds restored unbound draft", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const storage = new MemoryStorage(); await new ChildDraftVault(storage).save(makeDraft());
  const [restored] = await new ChildDraftVault(storage).list("synthetic-a");
  // Current-page provenance is absent after reload even if localStorage failed and epoch appears zero.
  assert.throws(() => fixture.api.bindDraft(restored!), /DRAFT_REAUTHORIZATION_REQUIRED/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});
