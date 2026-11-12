import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCanopyproofApiProxy } from "../../packages/dropin-cloudflare/src/canopyproof-api-proxy.js";
import { createChildBackend } from "../../services/api/src/child-backend/app.js";
import { backendConfig } from "../../services/api/src/child-backend/config.js";
const env = { DROPIN_API_ORIGIN: "https://legacy.synthetic.invalid/base", DROPIN_ALLOWED_ORIGINS: "https://canopyproof.org,https://www.canopyproof.org", DROPIN_CANOPYPROOF_MODE: "production", DROPIN_ALLOW_ADMIN_PROXY: "false" };
const prefix = "/api/canopyproof/child-stewardship", path = `${prefix}/v1/commands`;
const request = (suffix = path, init: RequestInit = {}) => new Request(`https://canopyproof.org${suffix}`, init);
const noLegacy = () => createCanopyproofApiProxy({ fetcher: async () => assert.fail("child request reached the legacy origin") });
function privacy(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
}
test("child routes default closed even with a binding but no supported mode", async () => {
  let calls = 0;
  const binding = { fetch: async () => { calls++; return new Response("not authorized"); } };
  for (const mode of [undefined, "", "disabled", "true", "production", "real", "child-pilot", "SYNTHETIC-DEMO"]) for (const bound of [false, true]) {
    const response = await noLegacy().fetch(request(path, { method: "POST", body: "{}" }), { ...env, ...(mode === undefined ? {} : { DROPIN_CHILD_BACKEND_MODE: mode }), ...(bound ? { CHILD_BACKEND: binding } : {}) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: "SERVICE_UNAVAILABLE", retryable: false } });
    privacy(response);
  }
  assert.equal(calls, 0);
});
test("explicit synthetic mode without a binding closes every child route family", async () => {
  for (const suffix of ["", "/v1", "/v1/status", "/v1/view", "/v1/guardian/sessions", "/v1/guardian/logout", "/v1/resume/cancel", "/v1/privacy/requests/fixture", "/v2/commands"]) for (const method of ["GET", "POST"]) {
    const response = await noLegacy().fetch(request(prefix + suffix, { method }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo" });
    assert.equal(response.status, 503, `${method} ${suffix}`); privacy(response);
  }
});
test("encoded child prefix with malformed suffix cannot escape the closed namespace", async () => {
  for (const mode of ["disabled", "synthetic-demo"]) for (const suffix of ["%ZZ", "%E0%A4%A", "%", "commands%FF"]) {
    const response = await noLegacy().fetch(request(`/api/canopyproof/%63hild-stewardship/v1/${suffix}`, { headers: { authorization: "Bearer synthetic-only" } }), { ...env, DROPIN_CHILD_BACKEND_MODE: mode, CHILD_BACKEND: { fetch: async () => assert.fail("malformed path reached binding") } });
    assert.equal(response.status, 503); privacy(response);
  }
});
test("child binding rejects unsupported versions and encoded aliases without fallback", async () => {
  let calls = 0;
  for (const suffix of [prefix, `${prefix}/v10/commands`, `${prefix}/v2/commands`, `${prefix}/v1/%63ommands`, `${prefix}/v1/commands%2Fextra`, "/api/canopyproof/%63hild-stewardship/v1/commands", "/api%2Fcanopyproof%2Fchild-stewardship%2Fv1%2Fcommands"]) {
    const response = await noLegacy().fetch(request(suffix), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: { fetch: async () => { calls++; return new Response("bad"); } } });
    assert.equal(response.status, 503, suffix);
  }
  assert.equal(calls, 0);
});
test("binding preserves opaque auth, revision, query and streamed body, not caller identity claims", async () => {
  let calls = 0;
  const allowed = { authorization: "Bearer synthetic-only-capability", "if-match": "7", "idempotency-key": "fixture-key-1234", "x-child-upload-authorization": "synthetic-only-proof", origin: "https://www.canopyproof.org", "sec-fetch-site": "same-site", accept: "application/json", "content-type": "application/json" };
  const removed = { cookie: "session=fixture", "x-forwarded-host": "evil.invalid", "x-forwarded-proto": "http", "x-dropin-actor-id": "operator", "x-dropin-actor-role": "guardian", "x-dropin-organization-id": "claimed", traceparent: "fixture", tracestate: "fixture", baggage: "fixture", "x-unapproved-header": "fixture" };
  const binding = { fetch: async function (input: Request) {
    assert.equal(this, binding); calls++;
    assert.equal(input.url, "https://canopyproof.org/canopyproof/child-stewardship/v1/commands?request=synthetic%20test");
    assert.equal(input.method, "POST"); assert.equal(input.redirect, "manual");
    for (const [name, value] of Object.entries(allowed)) assert.equal(input.headers.get(name), value, name);
    for (const name of Object.keys(removed)) assert.equal(input.headers.get(name), null, name);
    assert.equal(await input.text(), '{"synthetic":true}');
    return new Response('{"accepted":false}', { status: 409, headers: { "content-type": "application/json", "retry-after": "2" } });
  } };
  const response = await noLegacy().fetch(request(`${path}?request=synthetic%20test`, { method: "POST", body: '{"synthetic":true}', headers: { ...allowed, ...removed } }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: binding });
  assert.equal(calls, 1); assert.equal(response.status, 409); assert.equal(await response.text(), '{"accepted":false}');
  assert.equal(response.headers.get("retry-after"), "2"); assert.equal(response.headers.get("access-control-allow-origin"), "https://www.canopyproof.org"); privacy(response);
});
test("child calls bypass unrelated telemetry and retain per-request mode isolation", async () => {
  let calls = 0;
  const handler = createCanopyproofApiProxy({ fetcher: async () => assert.fail("legacy"), requestIdFactory: () => assert.fail("unrelated edge trace"), telemetryFetcher: async () => assert.fail("child telemetry leak") });
  const config = { ...env, CHILD_BACKEND: { fetch: async () => { calls++; return Response.json({ syntheticOnly: true }); } }, CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED: "true" };
  assert.equal((await handler.fetch(request(), { ...config, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo" })).status, 200);
  assert.equal((await handler.fetch(request(), config)).status, 503); assert.equal(calls, 1);
});
test("transport adds no positive readiness probe before logout or cancellation", async () => {
  const seen: string[] = [];
  const binding = { fetch: async (input: Request) => { seen.push(new URL(input.url).pathname); return Response.json({ status: "synthetic_revoked" }); } };
  for (const suffix of ["guardian/logout", "resume/cancel"]) assert.equal((await noLegacy().fetch(request(`${prefix}/v1/${suffix}`, { method: "POST", body: "{}" }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: binding })).status, 200);
  assert.deepEqual(seen, ["/canopyproof/child-stewardship/v1/guardian/logout", "/canopyproof/child-stewardship/v1/resume/cancel"]);
});
test("backend denial statuses are returned, never converted to acceptance or fallback", async () => {
  for (const status of [401, 403, 409, 413, 429, 503]) {
    const response = await noLegacy().fetch(request(), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: { fetch: async () => Response.json({ error: { code: "SYNTHETIC_DENIED" } }, { status }) } });
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: { code: "SYNTHETIC_DENIED" } }); privacy(response);
  }
});
test("exceptions and redirects are sanitized, attempted once and never replayed", async () => {
  for (const behavior of ["throw", "redirect"] as const) {
    let calls = 0;
    const response = await noLegacy().fetch(request(path, { method: "POST", body: "{}" }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: { fetch: async () => {
      calls++; if (behavior === "throw") throw new Error("sensitive synthetic credential");
      return new Response("sensitive synthetic redirect", { status: 307, headers: { location: "https://unapproved.invalid" } });
    } } });
    assert.equal(calls, 1); assert.equal(response.status, 503); assert.equal(response.headers.get("location"), null);
    assert.doesNotMatch(await response.text(), /sensitive|unapproved/); privacy(response);
  }
});
test("backend cannot widen Origin, credentials, cookies, redirects, caching or telemetry", async () => {
  let calls = 0;
  const binding = { fetch: async () => { calls++; return new Response("{}", { headers: {
    "access-control-allow-origin": "*", "access-control-allow-credentials": "true", "access-control-expose-headers": "set-cookie", "access-control-allow-headers": "*", "set-cookie": "synthetic_session=fixture", "cache-control": "public,max-age=99999", "referrer-policy": "unsafe-url", "content-security-policy": "default-src *", location: "https://unapproved.invalid", refresh: "0;url=https://unapproved.invalid", "x-debug-token": "fixture", "server-timing": "private", "content-type": "application/json",
  } }); } };
  for (const origin of [undefined, "https://canopyproof.org", "https://www.canopyproof.org"]) {
    const response = await noLegacy().fetch(request(path, { headers: origin ? { origin } : {} }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: binding });
    assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), origin ?? null);
    for (const header of ["access-control-expose-headers", "location", "refresh", "x-debug-token", "server-timing"]) assert.equal(response.headers.get(header), null); privacy(response);
  }
  for (const origin of ["https://canopyproof.org.unapproved.invalid", "http://canopyproof.org", "null"]) {
    const response = await noLegacy().fetch(request(path, { headers: { origin } }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: binding });
    assert.equal(response.status, 403); assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(calls, 3);
});
test("child OPTIONS retains PR45 exact preflight policy without a backend call", async () => {
  for (const mode of ["disabled", "synthetic-demo"]) {
    const response = await noLegacy().fetch(request(path, { method: "OPTIONS", headers: { origin: "https://www.canopyproof.org", "access-control-request-method": "POST", "access-control-request-headers": "if-match,x-child-upload-authorization" } }), { ...env, DROPIN_CHILD_BACKEND_MODE: mode, CHILD_BACKEND: { fetch: async () => assert.fail("preflight reached backend") } });
    assert.equal(response.status, 204); assert.equal(response.headers.get("access-control-allow-headers"), "authorization,content-type,idempotency-key,x-dropin-client,if-match,x-child-upload-authorization"); assert.equal(response.headers.get("access-control-allow-origin"), "https://www.canopyproof.org");
  }
});
test("non-child/lookalike routes retain existing upstream, origin and admin policy", async () => {
  const seen: string[] = [];
  const handler = createCanopyproofApiProxy({ requestIdFactory: () => "synthetic-request", fetcher: async input => { seen.push(input.url); return new Response("legacy"); } });
  const config = { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: { fetch: async () => assert.fail("non-child reached binding") } };
  for (const suffix of ["/api/ready?synthetic=1", "/api/canopyproof/child-stewardship-extra/v1/commands", "/api/canopyproof/other?child-stewardship/v1"]) {
    assert.equal(await (await handler.fetch(request(suffix), config)).text(), "legacy"); assert.equal(seen.at(-1), `https://legacy.synthetic.invalid/base${suffix.slice(4)}`);
  }
  assert.equal((await handler.fetch(request("/api/admin/readiness"), config)).status, 403);
  assert.equal((await handler.fetch(request("/api/ready", { headers: { origin: "https://unapproved.invalid" } }), config)).status, 403); assert.equal(seen.length, 3);
});
test("binding cannot make actual isolated backend ready without PostgreSQL and authority", async () => {
  for (const mode of ["disabled", "synthetic-demo"]) {
    const backend = createChildBackend({ config: backendConfig({ CHILD_BACKEND_MODE: mode, CHILD_WEB_ORIGIN: "https://canopyproof.org" }), migrations: [], sourceSha: "a".repeat(40) });
    const config = { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: { fetch: async (input: Request) => backend.app.fetch(input) } };
    for (const suffix of ["status", "view", "guardian/sessions", "guardian/passkeys/enroll", "demo-sessions", "draft-authorizations", "commands"]) {
      const response = await noLegacy().fetch(request(`${prefix}/v1/${suffix}`, { method: "POST", body: "{}", headers: { origin: "https://canopyproof.org" } }), config);
      assert.equal(response.status, 503, `${mode} ${suffix}`); assert.deepEqual(await response.json(), { error: { code: "SERVICE_UNAVAILABLE", retryable: true } }); privacy(response);
    }
    assert.equal(await backend.ready(), false);
  }
});
test("checked-in configs remain disabled without invented service or database resources", () => {
  const toml = readFileSync("infra/cloudflare/canopyproof-api-proxy.wrangler.toml.example", "utf8");
  assert.equal(toml.match(/DROPIN_CHILD_BACKEND_MODE = "disabled"/g)?.length, 3); assert.doesNotMatch(toml, /\[\[services\]\]|\[\[hyperdrive\]\]|\[\[d1_databases\]\]/);
  const staging = JSON.parse(readFileSync("infra/cloudflare/canopyproof-api-proxy.staging.wrangler.jsonc", "utf8"));
  assert.equal(staging.vars.DROPIN_CHILD_BACKEND_MODE, "disabled"); assert.equal(staging.services, undefined); assert.equal(staging.hyperdrive, undefined); assert.equal(staging.d1_databases, undefined);
});
