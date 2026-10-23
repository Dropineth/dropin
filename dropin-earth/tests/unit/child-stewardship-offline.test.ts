import test from "node:test";
import assert from "node:assert/strict";
import { CHILD_DRAFT_SCHEMA, ChildDraftVault, ChildDraftSync, parseChildDraft, type ChildDraft, type ChildDraftStorage, type SealedChildDraft, type ChildSyncTransport } from "../../apps/web/src/lib/child-stewardship-offline.ts";
class MemoryStorage implements ChildDraftStorage {
  sessions = new Map<string, SealedChildDraft>();
  async putSession(value: SealedChildDraft) { this.sessions.set(value.profile, value); }
  async getSession(profile: ChildDraft["profile"]) { return this.sessions.get(profile); }
  async removeSession(profile: ChildDraft["profile"]) { this.sessions.delete(profile); }
  keys = new Map<string, CryptoKey>(); records = new Map<string, SealedChildDraft>();
  async getKey(profile: ChildDraft["profile"]) { return this.keys.get(profile); }
  async putKey(profile: ChildDraft["profile"], key: CryptoKey) { const existing = this.keys.get(profile); if (existing) return existing; this.keys.set(profile, key); return key; }
  async put(value: SealedChildDraft) { this.records.set(value.id, structuredClone(value)); }
  async list(profile: ChildDraft["profile"]) { return [...this.records.values()].filter(value => value.profile === profile); }
  async remove(id: string, profile: ChildDraft["profile"]) { if (this.records.get(id)?.profile === profile) this.records.delete(id); }
  async clear(profile: ChildDraft["profile"]) { this.sessions.delete(profile); this.keys.delete(profile); for (const record of await this.list(profile)) this.records.delete(record.id); }
}
const makeDraft = (changes: Partial<ChildDraft> = {}): ChildDraft => ({ schema: CHILD_DRAFT_SCHEMA, id: crypto.randomUUID(), profile: "synthetic-a", task: "synthetic-indoor-comparison", answer: "not_sure", source: "synthetic_reference", createdAt: "2026-10-23T02:00:00.000Z", consentEpoch: 0, submissionVersion: null, serverBinding: null, ...changes });
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
  const draft = makeDraft(); sync.authorize(draft); sync.withdraw(); await assert.rejects(() => sync.sync(draft, transport), /CONSENT_WITHDRAWN/); assert.equal(prepares, 0); assert.equal(sends, 0);
});
test("EX-04 withdrawal while server authorization is pending blocks first draft byte", async () => {
  const sync = new ChildDraftSync("synthetic-a"); const draft = makeDraft(); sync.authorize(draft); const permit = deferred<{ synthetic: true; allowed: boolean }>(); let sends = 0;
  const request = sync.sync(draft, { prepare: async () => permit.promise, send: async draft => { sends++; return { synthetic: true, status: "received", draftId: draft.id, receiptId: "demo-receipt" }; } });
  sync.withdraw(); permit.resolve({ synthetic: true, allowed: true }); await assert.rejects(() => request, /CONSENT_WITHDRAWN/); assert.equal(sends, 0);
});
test("EX-04 withdrawal aborts in-flight sending and never reports receipt as newly authorized", async () => {
  const sync = new ChildDraftSync("synthetic-a"); const started = deferred<AbortSignal>(); const returned = deferred<void>(); const draft = makeDraft(); sync.authorize(draft);
  const request = sync.sync(draft, { prepare: async () => ({ synthetic: true, allowed: true }), send: async (value, signal) => { started.resolve(signal); await returned.promise; return { synthetic: true, status: "received", draftId: value.id, receiptId: "demo-receipt" }; } });
  const signal = await started.promise; sync.withdraw(); assert.equal(signal.aborted, true); returned.resolve(); await assert.rejects(() => request, /CONSENT_WITHDRAWN/);
});
test("AT-16 same draft retry preserves stable draft ID after unknown network result", async () => {
  const sync = new ChildDraftSync("synthetic-a"); const ids: string[] = []; const draft = makeDraft(); sync.authorize(draft);
  const transport: ChildSyncTransport = { prepare: async () => ({ synthetic: true, allowed: true }), send: async value => { ids.push(value.id); if (ids.length === 1) throw new Error("RESPONSE_LOST"); return { synthetic: true, status: "received", draftId: value.id, receiptId: "demo-receipt" }; } };
  await assert.rejects(() => sync.sync(draft, transport)); assert.equal((await sync.sync(draft, transport)).receiptId, "demo-receipt"); assert.deepEqual(ids, [draft.id, draft.id]);
});
test("AT-06 unavailable or non-synthetic provider authorization cannot send draft", async () => {
  const sync = new ChildDraftSync("synthetic-a"); const draft = makeDraft(); sync.authorize(draft); let sends = 0;
  for (const permission of [{ synthetic: true, allowed: false }, { synthetic: false, allowed: true }]) await assert.rejects(() => sync.sync(draft, { prepare: async () => permission as { synthetic: true; allowed: boolean }, send: async () => { sends++; throw new Error(); } }), /SERVICE_UNAVAILABLE/);
  assert.equal(sends, 0);
});
test("AT-16 mismatched or fabricated receipt cannot acknowledge another draft", async () => {
  const sync = new ChildDraftSync("synthetic-a"); const draft = makeDraft(); sync.authorize(draft); await assert.rejects(() => sync.sync(draft, { prepare: async () => ({ synthetic: true, allowed: true }), send: async () => ({ synthetic: true, status: "received", draftId: crypto.randomUUID(), receiptId: "demo-receipt" }) }), /RECEIPT_INVALID/);
});
test("AT-06 approving a different object does not revive a stopped draft or another profile", async () => {
  const sync = new ChildDraftSync("synthetic-a"); const draft = makeDraft(); sync.authorize(draft); sync.withdraw(); sync.authorize(makeDraft()); let sends = 0;
  const transport: ChildSyncTransport = { prepare: async () => ({ synthetic: true, allowed: true }), send: async () => { sends++; throw new Error(); } };
  await assert.rejects(() => sync.sync(draft, transport), /CONSENT_WITHDRAWN/);
  await assert.rejects(() => sync.sync(makeDraft({ profile: "synthetic-b", consentEpoch: 1 }), transport), /CONSENT_WITHDRAWN/); assert.equal(sends, 0);
});

// Uses the actual Hono route and learning domain with an explicitly test-only transactional store.
// This is not PostgreSQL, external-provider or production acceptance evidence.
import { ChildDemoApi } from "../../apps/web/src/lib/child-stewardship-api.ts";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.ts";
import { TestChildResumeStore } from "../fixtures/child-stewardship-resume.ts";
function apiFixture() {
  const store = new TestChildResumeStore();
  const app = createChildStewardshipRoutes({ mode: "synthetic-demo", store, resumeStore: store, now: () => new Date().toISOString() });
  let viewHook: (() => Promise<void>) | undefined;
  const posts: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); const path = url.slice(url.indexOf("/v1") + 3);
    if (path === "/view" && viewHook) await viewHook();
    if (path === "/commands") posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return app.request(`http://synthetic.invalid${path}`, init);
  };
  const api = new ChildDemoApi("http://synthetic.invalid", fetcher);
  return { store, api, posts, newApi: () => new ChildDemoApi("http://synthetic.invalid", fetcher), setViewHook: (hook: (() => Promise<void>) | undefined) => { viewHook = hook; } };
}
async function approveCurrent(api: ChildDemoApi, draft: ChildDraft, sync: ChildDraftSync): Promise<void> {
  const proposal = await api.inspectDraftAuthorization(draft); await api.authorizeDraft(draft, proposal); sync.authorize(draft);
}
test("AT-16 actual client + Hono + learning domain returns one receipt for stable replay", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = await fixture.api.prepareDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a"); await approveCurrent(fixture.api, draft, sync);
  const first = await sync.sync(draft, fixture.api.transport(draft));
  const second = await sync.sync(draft, fixture.api.transport(draft));
  assert.equal(first.receiptId, second.receiptId);
  assert.equal(Object.keys([...fixture.store.sessions.values()][0]!.snapshot.learning.observations).length, 1);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 2);
});
test("EX-04 actual API withdrawal between both authorization reads sends zero observation bytes", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = await fixture.api.prepareDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a"); await approveCurrent(fixture.api, draft, sync);
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
  const draft = await fixture.api.prepareDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a"); await approveCurrent(fixture.api, draft, sync);
  await fixture.api.command("child", { type: "set-assent", profileId: "demo-profile-a", purpose: "upload", willing: false });
  await fixture.api.command("guardian", { type: "grant-consent", profileId: "demo-profile-a", purpose: "upload", policyVersion: "child-learning-demo-v1" });
  await fixture.api.command("child", { type: "set-assent", profileId: "demo-profile-a", purpose: "upload", willing: true });
  await assert.rejects(() => sync.sync(draft, fixture.api.transport(draft)), /CONSENT_WITHDRAWN/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});
test("AT-09 persisted binding prevents uncertain draft replay into a new synthetic session", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = await fixture.api.prepareDraft(makeDraft(), true);
  const vault = new ChildDraftVault(new MemoryStorage()); await vault.save(draft);
  const [restored] = await vault.list("synthetic-a");
  await fixture.api.start(); await fixture.api.setup("9-12", true);
  const sync = new ChildDraftSync("synthetic-a"); sync.authorize(restored!);
  await assert.rejects(() => sync.sync(restored!, fixture.api.transport(restored!)), /CURRENT_DRAFT_AUTHORIZATION_REQUIRED|CONSENT_WITHDRAWN/);
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


test("AT-09 encrypted original session and exact intent resume an unknown result without a new effect", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage);
  const draft = await fixture.api.prepareDraft(makeDraft(), true); await vault.save(draft);
  const sync = new ChildDraftSync("synthetic-a"); await approveCurrent(fixture.api, draft, sync);
  const first = await sync.sync(draft, fixture.api.transport(draft));
  await vault.saveSession("synthetic-a", await fixture.api.suspend(0));
  // Explicit clean suspend persists a one-use ticket, never active bearer credentials.
  fixture.api.close(); const reopened = new ChildDraftVault(storage); const [restored] = await reopened.list("synthetic-a");
  const session = await reopened.loadSession("synthetic-a"); assert.ok(session);
  assert.equal(new TextDecoder().decode(storage.sessions.get("synthetic-a")!.ciphertext).includes("cp-demo."), false);
  const resumed = fixture.newApi(); await resumed.resume(session);
  const restartedSync = new ChildDraftSync("synthetic-a");
  await assert.rejects(() => restartedSync.sync(restored!, resumed.transport(restored!)), /CONSENT_WITHDRAWN/);
  await approveCurrent(resumed, restored!, restartedSync);
  const retry = await restartedSync.sync(restored!, resumed.transport(restored!));
  assert.equal(first.receiptId, retry.receiptId);
  const submissions = fixture.posts.filter(post => post.type === "submit-observation"); assert.equal(submissions.length, 2); assert.deepEqual(submissions[0], submissions[1]);
  assert.equal(Object.keys([...fixture.store.sessions.values()][0]!.snapshot.learning.observations).length, 1);
});
test("AT-09 original-session offline bound draft can prepare its first intent after restart", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage);
  const boundOffline = fixture.api.bindDraft(makeDraft(), true); assert.equal(boundOffline.submissionVersion, null); await vault.save(boundOffline);
  await vault.saveSession("synthetic-a", await fixture.api.suspend(0));
  const resumed = fixture.newApi(); await resumed.resume((await vault.loadSession("synthetic-a"))!);
  const ready = await resumed.prepareDraft((await vault.list("synthetic-a"))[0]!); await vault.save(ready);
  const sync = new ChildDraftSync("synthetic-a"); await approveCurrent(resumed, ready, sync); await sync.sync(ready, resumed.transport(ready));
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 1);
});
test("EX-04 consumed ticket cannot resurrect authority after failed durable deletion and offline withdrawal", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = await fixture.api.prepareDraft(makeDraft(), true);
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage); await vault.save(draft);
  const ticket = await fixture.api.suspend(0); await vault.saveSession("synthetic-a", ticket);
  const resumed = fixture.newApi(); await resumed.resume(ticket);
  storage.removeSession = async () => { throw new Error("STORAGE_WRITE_FAILED"); };
  await assert.rejects(() => vault.forgetSession("synthetic-a"), /STORAGE_WRITE_FAILED/);
  // localStorage write and server withdrawal unavailable: only current controller stops live bytes.
  const sync = new ChildDraftSync("synthetic-a"); sync.authorize(draft); sync.withdraw();
  await assert.rejects(() => sync.sync(draft, resumed.transport(draft)), /CONSENT_WITHDRAWN/);
  const staleTicket = await new ChildDraftVault(storage).loadSession("synthetic-a"); assert.ok(staleTicket);
  await assert.rejects(() => fixture.newApi().resume(staleTicket!), /CONSENT_REQUIRED|SERVICE_UNAVAILABLE/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});
test("EX-04 removing encrypted resume credentials survives reopen without localStorage", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage);
  await vault.saveSession("synthetic-a", await fixture.api.suspend(0)); await vault.save(makeDraft());
  await vault.forgetSession("synthetic-a"); const reopened = new ChildDraftVault(storage);
  assert.equal(await reopened.loadSession("synthetic-a"), null); assert.equal((await reopened.list("synthetic-a")).length, 1);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});
test("AT-03 synthetic session resume rejects expired, other-origin and tampered encrypted credentials", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const session = await fixture.api.suspend(0);
  await assert.rejects(() => fixture.newApi().resume({ ...session, expiresAt: "2000-01-01T00:00:00.000Z" }), /SESSION_EXPIRED_OR_MISMATCHED/);
  await assert.rejects(() => fixture.newApi().resume({ ...session, serverOrigin: "https://another.invalid" }), /SESSION_EXPIRED_OR_MISMATCHED/);
  const storage = new MemoryStorage(); const vault = new ChildDraftVault(storage); await assert.rejects(() => vault.saveSession("synthetic-b", session), /SESSION_SCOPE_MISMATCH/); await vault.saveSession("synthetic-a", session);
  new Uint8Array(storage.sessions.get("synthetic-a")!.ciphertext)[0] ^= 1;
  await assert.rejects(() => vault.loadSession("synthetic-a"));
});

test("AT-09 v1 encrypted drafts migrate as readable v2 without inventing a persisted intent", async () => {
  const storage = new MemoryStorage(); const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); await storage.putKey("synthetic-a", key);
  const draft = makeDraft(); const { submissionVersion: version, ...legacy } = { ...draft, schema: "CanopyProof-SyntheticDraft/1" }; assert.equal(version, null);
  const iv = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`CanopyProof-SyntheticDraft/1:synthetic-a:${draft.id}`) }, key, new TextEncoder().encode(JSON.stringify(legacy)));
  await storage.put({ id: draft.id, profile: "synthetic-a", iv, ciphertext });
  const [restored] = await new ChildDraftVault(storage).list("synthetic-a"); assert.equal(restored!.schema, CHILD_DRAFT_SCHEMA); assert.equal(restored!.submissionVersion, null); assert.equal(restored!.serverBinding, null);
});

test("EX-04 resumed login and original provenance grant no upload until a new exact-object authorization", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = await fixture.api.prepareDraft(makeDraft(), true); const original = JSON.stringify(draft);
  const ticket = await fixture.api.suspend(0); const resumed = fixture.newApi(); await resumed.resume(ticket);
  const sync = new ChildDraftSync("synthetic-a");
  await assert.rejects(() => sync.sync(draft, resumed.transport(draft)), /CONSENT_WITHDRAWN/);
  sync.authorize(draft); // Even a caller bypassing the UI cannot replace the API/server proof.
  await assert.rejects(() => sync.sync(draft, resumed.transport(draft)), /CURRENT_DRAFT_AUTHORIZATION_REQUIRED/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
  await assert.rejects(() => resumed.command("child", { type: "submit-observation", assignmentId: draft.serverBinding!.assignmentId, sampleId: "demo-leaf-green", answer: "uncertain", capturedAtClaimed: draft.createdAt }), /CONSENT_REQUIRED/);
  assert.equal(Object.keys([...fixture.store.sessions.values()][0]!.snapshot.learning.observations).length, 0);
  await approveCurrent(resumed, draft, sync); await sync.sync(draft, resumed.transport(draft));
  assert.equal(Object.keys([...fixture.store.sessions.values()][0]!.snapshot.learning.observations).length, 1);
  assert.equal(JSON.stringify(draft), original, "New current authority never rewrites original provenance or immutable intent");
});

test("EX-04 suspended ticket cancellation consumes the raw capability without minting active tokens", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const ticket = await fixture.api.suspend(0); assert.equal(fixture.store.tokens.size, 0);
  await fixture.newApi().cancelResume(ticket); await fixture.newApi().cancelResume(ticket);
  assert.equal(fixture.store.tokens.size, 0);
  await assert.rejects(() => fixture.newApi().resume(ticket), /SERVICE_UNAVAILABLE|CONSENT_REQUIRED/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});


test("EX-04 explicit current authorization cannot cover changed contents, another object or another policy", async () => {
  const fixture = apiFixture(); await fixture.api.start(); await fixture.api.setup("9-12", true);
  const draft = await fixture.api.prepareDraft(makeDraft(), true); const sync = new ChildDraftSync("synthetic-a");
  const proposal = await fixture.api.inspectDraftAuthorization(draft);
  await assert.rejects(() => fixture.api.authorizeDraft(draft, { ...proposal, draftId: crypto.randomUUID() }), /DRAFT_SCOPE_MISMATCH/);
  await assert.rejects(() => fixture.api.authorizeDraft(draft, { ...proposal, policyVersion: "changed-policy" }), /VERSION_CONFLICT/);
  await fixture.api.authorizeDraft(draft, proposal); sync.authorize(draft);
  const changed = { ...draft, answer: "yellow_leaves" as const };
  await assert.rejects(() => sync.sync(changed, fixture.api.transport(changed)), /CONSENT_WITHDRAWN/);
  // Even a caller authorizing changed local bytes cannot change the server/client intent proof.
  sync.authorize(changed);
  await assert.rejects(() => sync.sync(changed, fixture.api.transport(changed)), /CURRENT_DRAFT_AUTHORIZATION_REQUIRED/);
  assert.equal(fixture.posts.filter(post => post.type === "submit-observation").length, 0);
});
