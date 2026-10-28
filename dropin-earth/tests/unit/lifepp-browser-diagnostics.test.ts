import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Page, Request } from "playwright";
import { boundedDiagnostic, diagnosticError, diagnosticUrl, sampleDiagnosticPage, trackDiagnosticRequests } from "../helpers/lifepp-browser-diagnostics";

const origin = "http://127.0.0.1:3101";
test("diagnostic URLs discard secrets and only identify approved local paths", () => {
  assert.equal(diagnosticUrl(`${origin}/en/life/spaces/29?token=secret#secret`, origin), "/en/life/spaces/29");
  assert.equal(diagnosticUrl("http://user:secret@127.0.0.1:3101/life", origin), "/life");
  for (const url of ["https://third.party/secret", "http://127.0.0.1:3102/life"]) assert.equal(diagnosticUrl(url, origin), "[non-local]");
  assert.equal(diagnosticUrl(`${origin}/secret`, origin), "[local resource]");
  assert.equal(diagnosticUrl(`${origin}/_next/secret?token=secret`, origin), "/_next/[asset]");
  assert.equal(diagnosticError(new Error("secret")), "diagnostic-error");
});

test("diagnostic deadline handles pending work and late rejection", async () => {
  await assert.rejects(boundedDiagnostic(() => new Promise(() => {}), 5), /Diagnostic timeout/);
  let rejectLate!: (error: Error) => void;
  await assert.rejects(boundedDiagnostic(() => new Promise((_, reject) => { rejectLate = reject; }), 5), /Diagnostic timeout/);
  rejectLate(new Error("late failure"));
  assert.equal(await boundedDiagnostic(async () => "done"), "done");
});

test("request evidence is capped, redacted, copied and listeners removed", () => {
  const events = Object.assign(new EventEmitter(), { url: () => `${origin}/en/life?secret`, isClosed: () => false });
  const tracker = trackDiagnosticRequests(events as unknown as Page, origin);
  const requests = Array.from({ length: 40 }, () => ({ url: () => `${origin}/_next/secret?token=secret`, resourceType: () => "script" }) as Request);
  requests.forEach(request => events.emit("request", request));
  const first = tracker.snapshot();
  assert.equal(first.pending.length, 32); assert.equal(first.dropped, 8);
  events.emit("response", { request: () => requests[0], status: () => 503 });
  events.emit("requestfailed", requests[0]);
  events.emit("crash");
  assert.equal(first.pending.length, 32);
  assert.equal(tracker.snapshot().pending.length, 31);
  assert.equal(tracker.snapshot().crashed, true);
  assert.deepEqual((tracker.snapshot().recent[0] as { status: number }).status, 503);
  assert.doesNotMatch(JSON.stringify(tracker.snapshot()), /secret|token/);
  requests.forEach(request => events.emit("requestfinished", request));
  assert.equal(tracker.snapshot().recent.length, 32);
  tracker.dispose(); assert.equal(events.eventNames().length, 0);
});

test("page sampling reports unavailable evaluation without introducing page actions", async () => {
  const closed = new Error("page closed");
  const page = { evaluate: async () => { throw closed; } } as unknown as Page;
  await assert.rejects(sampleDiagnosticPage(page, origin), error => error === closed);
});
