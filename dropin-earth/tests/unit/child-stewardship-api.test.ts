import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.js";
import { TestChildStore, childDigest } from "../../services/api/src/domain/child-stewardship/store.js";
import { childBoundaryDenies } from "../../services/api/src/domain/child-stewardship/runtime-boundary.js";

import { TestChildResumeStore } from "../fixtures/child-stewardship-resume.ts";

const time = "2026-10-23T02:00:00.000Z";
async function fixture() {
  const store = new TestChildResumeStore(() => time);
  const app = createChildStewardshipRoutes({ mode: "synthetic-demo", store, now: () => time });
  const response = await app.request("/demo-sessions", { method: "POST" });
  assert.equal(response.status, 201);
  const created = await response.json();
  const tokens = created.data.tokens as Record<string, string>;
  let serial = 0; const uploadProofs = new Map<string, string>();
  async function view(role = "child") {
    const response = await app.request("/view", { headers: { authorization: `Bearer ${tokens[role]}` } });
    assert.equal(response.status, 200);
    return response.json();
  }
  async function command(role: string, fields: Record<string, unknown>, overrides: { key?: string; version?: number } = {}) {
    const current = overrides.version ?? (await view(role)).version;
    const id = overrides.key ?? (fields.type === "submit-observation" ? `demo-${crypto.randomUUID()}` : `demo-command-${++serial}`);
    const packet = { commandId: id, expectedVersion: current, ...fields };
    let proof = uploadProofs.get(id);
    if (fields.type === "submit-observation" && !proof) {
      const currentView = await view(role); const assignment = currentView.data.assignments.find((item: { id: string }) => item.id === fields.assignmentId);
      const eligibility = currentView.data.uploadEligibility.find((item: { profileId: string }) => item.profileId === assignment?.profileId);
      const admission = await app.request("/draft-authorizations", { method: "POST", headers: { authorization: `Bearer ${tokens[role]}`, "content-type": "application/json" }, body: JSON.stringify({ draftId: id.replace(/^demo-/, ""), intentDigest: childDigest(packet), assignmentId: fields.assignmentId, originalSessionId: created.data.sessionId, originalConsentEpoch: eligibility?.consentEpoch, purpose: "synthetic-learning-upload", schemaVersion: "CanopyProof-SyntheticDraft/2", policyVersion: currentView.data.policyVersion, expectedVersion: currentView.version }) });
      if (admission.status === 201) { proof = (await admission.json()).data.authorizationToken; uploadProofs.set(id, proof!); }
    }
    const response = await app.request("/commands", { method: "POST", headers: { authorization: `Bearer ${tokens[role]}`, "content-type": "application/json", "idempotency-key": id, "if-match": String(current), ...(proof ? { "x-child-upload-authorization": proof } : {}) }, body: JSON.stringify(packet) });
    return { response, body: await response.json() };
  }
  async function setup() {
    assert.equal((await command("guardian", { type: "create-profile", profileId: "demo-profile-one", ageBand: "9-12", locale: "zh-CN", nickname: "leaf" })).response.status, 200);
    for (const purpose of ["learning", "upload"]) {
      assert.equal((await command("guardian", { type: "grant-consent", profileId: "demo-profile-one", purpose, policyVersion: "child-learning-demo-v1" })).response.status, 200);
      assert.equal((await command("child", { type: "set-assent", profileId: "demo-profile-one", purpose, willing: true })).response.status, 200);
    }
    return (await command("child", { type: "assign-task", profileId: "demo-profile-one", taskId: "demo-task-leaf-comparison" })).body.data.id as string;
  }
  return { app, store, tokens, view, command, setup, sessionId: created.data.sessionId as string };
}

test("AT-01 API unavailable without explicit server mode and durable runtime store", async () => {
  for (const [mode, store] of [["production", new TestChildStore()], ["synthetic-demo", null]] as const) {
    const app = createChildStewardshipRoutes({ mode, store });
    assert.equal((await app.request("/demo-sessions", { method: "POST" })).status, 503);
    const status = await (await app.request("/status")).json();
    assert.equal(status.data.available, false);
    assert.equal(status.data.realCapabilities, false);
  }
});

test("AT-06/11/13/16 full API learning flow remains E0; withdrawal prevents later bytes being accepted", async () => {
  const f = await fixture();
  const assignmentId = await f.setup();
  const fields = { type: "submit-observation", assignmentId, sampleId: "demo-leaf-green", answer: "uncertain", capturedAtClaimed: time };
  const version = (await f.view()).version;
  const first = await f.command("child", fields, { key: "demo-51d2a9cf-37fb-47d4-9af2-0dad4f472c7d", version });
  assert.equal(first.response.status, 200);
  const duplicate = await f.command("child", fields, { key: "demo-51d2a9cf-37fb-47d4-9af2-0dad4f472c7d", version });
  assert.deepEqual(duplicate.body.data, first.body.data);
  assert.equal((await f.command("child", { ...fields, answer: "yellow" }, { key: "demo-51d2a9cf-37fb-47d4-9af2-0dad4f472c7d", version })).response.status, 409);
  const observationId = first.body.data.id;
  assert.equal((await f.command("reviewer", { type: "review-observation", observationId, decision: "insufficient_for_survival", reason: "synthetic_source" })).response.status, 200);
  assert.equal((await f.command("reviewer", { type: "grant-contribution", observationId, policyVersion: "child-learning-demo-v1" })).response.status, 200);
  const learned = await f.view();
  assert.equal(learned.data.observations.length, 1);
  assert.equal(learned.data.assessments[0].currentState, "unknown");
  assert.equal(learned.data.contributions.length, 1);
  assert.equal((await f.command("child", { type: "open-dispute", profileId: "demo-profile-one", targetId: observationId, reason: "wrong_time" })).response.status, 200);
  assert.equal((await f.command("guardian", { type: "withdraw-consent", profileId: "demo-profile-one", purpose: "upload" })).response.status, 200);
  const before = structuredClone(f.store.sessions.get(f.sessionId)!.snapshot);
  const denied = await f.command("child", fields);
  assert.equal(denied.response.status, 403);
  assert.deepEqual(f.store.sessions.get(f.sessionId)!.snapshot, before);
  assert.equal((await f.view()).data.uploadAllowed, false);
  assert.equal((await f.view()).data.contributions.length, 1);
  assert.equal(f.store.audit.get(f.sessionId)?.at(-1)?.outcome, "rejected");
});

test("EX-18 guardian response and revision do not reveal protected report existence", async () => {
  const f = await fixture(); await f.setup();
  const before = await f.view("guardian");
  const probe = async () => {
    const response = await f.app.request("/rights/operations", { method: "POST", headers: { authorization: `Bearer ${f.tokens.guardian}`, "content-type": "application/json", "idempotency-key": "guardian-rights-probe", "if-match": String(before.version) }, body: JSON.stringify({ operation: {}, approvals: [] }) });
    return { status: response.status, error: (await response.json()).error };
  };
  const beforeProbe = await probe();
  const report = await f.command("child", { type: "open-dispute", profileId: "demo-profile-one", targetId: "demo-profile-one", reason: "unsafe_adult" });
  assert.equal(report.response.status, 200);
  const after = await f.view("guardian");
  assert.deepEqual(after.data, before.data);
  assert.equal(after.version, before.version);
  assert.deepEqual(await probe(), beforeProbe);
  assert.equal(beforeProbe.status, 403);
  assert.equal((await f.view("protector")).data.disputes.length, 1);
});

test("EX-03 closed synthetic schema rejects biometric fields and revoked tokens before state effects", async () => {
  const f = await fixture();
  const denied = await f.command("guardian", { type: "create-profile", profileId: "demo-profile-one", ageBand: "9-12", locale: "zh-CN", nickname: "leaf", iris_template: "synthetic-blocked-sample" });
  assert.equal(denied.response.status, 403);
  assert.equal(Object.keys(f.store.sessions.get(f.sessionId)!.snapshot.learning.profiles).length, 0);
  assert.ok(!JSON.stringify(f.store.audit).includes("synthetic-blocked-sample"));
  f.store.sessions.get(f.sessionId)!.snapshot.learning.actors["demo-guardian"]!.revoked = true;
  const response = await f.app.request("/view", { headers: { authorization: `Bearer ${f.tokens.guardian}` } });
  assert.equal(response.status, 401);
});

test("EX-01 dedicated synthetic mode blocks every legacy route independent of actor claim", async () => {
  let calls = 0;
  const app = new Hono();
  app.use("*", async (c, next) => {
    if (childBoundaryDenies(c.req.path, c.req.header("authorization") ?? "", "synthetic-demo")) return c.json({ code: "CHILD_DOMAIN_ISOLATED" }, 403);
    await next();
  });
  app.all("*", c => { calls++; return c.json({ reached: true }); });
  for (const role of ["child", "guardian", "service-on-behalf", "admin"]) {
    for (const path of ["/payments/intents", "/admin/payments/one/confirm", "/wallets", "/treasury/transactions", "/settlements", "/admin/projects/one/fund", "/admin/fund/allocations/one/release", "/lottery/rounds/one/enter", "/rwa-fragments/one/claim", "/canopyproof/agents/events"]) {
      assert.equal((await app.request(path, { method: "POST", headers: { "x-actor-role": role }, body: JSON.stringify({ environment: "production" }) })).status, 403);
    }
  }
  assert.equal(calls, 0);
  assert.equal(childBoundaryDenies("/payments/intents", "Bearer cp-demo.anything", undefined), true);
});

test("AT-16 concurrent API stale writes are serialized, same intent retries return one receipt", async () => {
  const f = await fixture();
  const fields = { type: "create-profile", profileId: "demo-profile-one", ageBand: "9-12", locale: "zh-CN", nickname: "leaf" };
  const responses = await Promise.all(Array.from({ length: 15 }, () => f.command("guardian", fields, { key: "demo-concurrent-one", version: 0 })));
  assert.ok(responses.every(r => r.response.status === 200));
  assert.equal(f.store.sessions.get(f.sessionId)!.snapshot.version, 1);
  assert.equal(f.store.receipts.get(f.sessionId)?.length, 1);
});

test("EX-33 real signed API authorization rejects forgery, untouched cross-domain replay and revocation with no business effects", async t => {
  const externalFetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected external request"); });
  const { createSyntheticRightsFixture } = await import("../fixtures/child-stewardship-rights.js");
  const rights = createSyntheticRightsFixture();
  const f = await fixture();
  f.store.sessions.get(f.sessionId)!.snapshot.rights = rights.funded();
  f.store.sessions.get(f.sessionId)!.snapshot.rightsContext = rights.context;
  const app = createChildStewardshipRoutes({ mode: "synthetic-demo", store: f.store, now: () => time });
  const good = rights.payment();
  const goodApprovals = rights.approvals(good, ["g", "r1", "t"]);
  let sequence = 0;
  async function submit(operation: unknown, approvals: unknown, version = 0, key?: string) {
    const response = await app.request("/rights/operations", { method: "POST", headers: { authorization: `Bearer ${f.tokens.operator}`, "content-type": "application/json", "idempotency-key": key ?? `rights-request-${++sequence}`, "if-match": String(version) }, body: JSON.stringify({ operation, approvals }) });
    return { response, body: await response.json() };
  }
  const before = structuredClone(f.store.sessions.get(f.sessionId)!.snapshot);
  const cases = [
    { operation: good, approvals: goodApprovals.map((a, i) => i ? a : { ...a, signatureBase64: Buffer.alloc(64).toString("base64") }) },
    { operation: { ...good, amountMinor: 41 }, approvals: goodApprovals },
    { operation: good, approvals: goodApprovals.map(a => ({ ...a, verified: true })) },
    { operation: good, approvals: goodApprovals.map(a => ({ ...a, algorithm: "none" })) },
  ];
  const foreign = { ...good, domainSeparator: "a-different-service" };
  cases.push({ operation: foreign, approvals: rights.approvals(foreign, ["g", "r1", "t"]) });
  const foreignEnvironment = { ...good, environment: "PRODUCTION" } as typeof good;
  cases.push({ operation: foreignEnvironment, approvals: rights.approvals(foreignEnvironment, ["g", "r1", "t"]) });
  for (const candidate of cases) {
    assert.equal((await submit(candidate.operation, candidate.approvals)).response.status, 403);
    assert.deepEqual(f.store.sessions.get(f.sessionId)!.snapshot, before);
    assert.equal(f.store.receipts.get(f.sessionId)?.length ?? 0, 0);
    assert.equal(f.store.outbox.get(f.sessionId)?.length ?? 0, 0);
    assert.equal(f.store.audit.get(f.sessionId)?.at(-1)?.outcome, "rejected");
  }
  f.store.sessions.get(f.sessionId)!.snapshot.rightsContext!.credentials.find(c => c.keyId === "g")!.revoked = true;
  assert.equal((await submit(good, goodApprovals)).response.status, 403);
  assert.deepEqual(f.store.sessions.get(f.sessionId)!.snapshot.rights, before.rights);
  f.store.sessions.get(f.sessionId)!.snapshot.rightsContext!.credentials.find(c => c.keyId === "g")!.revoked = false;
  const accepted = await submit(good, goodApprovals, 0, "rights-valid-payment");
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.data.externalExecution, false);
  assert.equal(f.store.sessions.get(f.sessionId)!.snapshot.rights.outbox.length, 1);
  assert.equal((await submit(good, goodApprovals, 0, "rights-valid-payment")).response.status, 200);
  const newOpOldNonce = rights.payment(40, { nonce: good.nonce, details: { payoutId: "payout-another" } });
  assert.equal((await submit(newOpOldNonce, rights.approvals(newOpOldNonce, ["g", "r1", "t"]), 1)).response.status, 403);
  assert.equal(f.store.sessions.get(f.sessionId)!.snapshot.rights.outbox.length, 1);
  assert.equal(f.store.sessions.get(f.sessionId)!.snapshot.rights.payments["payout-a"]?.submissionCount, 1);
  assert.equal(externalFetch.mock.callCount(), 0);
});
