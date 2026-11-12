import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Hono } from "hono";
import { createChildPrivateGateway, type ChildPrivateGatewayEnv } from "../../packages/dropin-cloudflare/src/child-private-gateway.js";
import { createCanopyproofApiProxy } from "../../packages/dropin-cloudflare/src/canopyproof-api-proxy.js";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.js";
import { TestChildStore } from "../../services/api/src/domain/child-stewardship/store.js";

const prefix = "/canopyproof/child-stewardship/v1";
const privateOrigin = "https://node.synthetic.invalid:8443";
const browserOrigin = "https://canopyproof.org";
const configured = { DROPIN_CHILD_GATEWAY_MODE: "synthetic-demo", CHILD_PRIVATE_ORIGIN: privateOrigin, CHILD_GATEWAY_ALLOWED_ORIGIN: browserOrigin };
const request = (path = `${prefix}/commands`, init: RequestInit = {}) => new Request(`https://public.synthetic.invalid${path}`, init);
function privacy(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  for (const name of ["set-cookie", "access-control-allow-origin", "access-control-allow-credentials", "location", "refresh", "x-debug-token"]) assert.equal(response.headers.get(name), null, name);
}

test("private gateway defaults closed and requires every setting plus binding", async () => {
  const gateway = createChildPrivateGateway(); let calls = 0;
  const binding = { fetch: async () => { calls++; return new Response("unexpected"); } };
  const variants: ChildPrivateGatewayEnv[] = [{}, { ...configured }, { CHILD_PRIVATE_API: binding },
    { CHILD_GATEWAY_ALLOWED_ORIGIN: browserOrigin, CHILD_PRIVATE_API: binding, DROPIN_CHILD_GATEWAY_MODE: "synthetic-demo" },
    { CHILD_PRIVATE_ORIGIN: privateOrigin, CHILD_PRIVATE_API: binding, DROPIN_CHILD_GATEWAY_MODE: "synthetic-demo" }];
  for (const mode of ["", "disabled", "true", "production", "real", "child-pilot", "SYNTHETIC-DEMO"]) variants.push({ ...configured, CHILD_PRIVATE_API: binding, DROPIN_CHILD_GATEWAY_MODE: mode });
  for (const env of variants) {
    const response = await gateway.fetch(request(), env);
    assert.equal(response.status, 503); privacy(response);
    assert.deepEqual(await response.json(), { error: { code: "SERVICE_UNAVAILABLE", retryable: false } });
  }
  assert.equal(calls, 0);
});

test("private target and browser policy require one exact HTTPS origin", async () => {
  const gateway = createChildPrivateGateway();
  for (const value of ["", "not-url", "http://node.synthetic.invalid", "https://user:pass@node.synthetic.invalid", "https://node.synthetic.invalid/path", "https://node.synthetic.invalid/", "https://node.synthetic.invalid?target=evil", "https://node.synthetic.invalid#fragment", " https://node.synthetic.invalid", "https://node.synthetic.invalid,https://other.invalid"]) {
    for (const key of ["CHILD_PRIVATE_ORIGIN", "CHILD_GATEWAY_ALLOWED_ORIGIN"] as const) {
      const response = await gateway.fetch(request(), { ...configured, [key]: value, CHILD_PRIVATE_API: { fetch: async () => assert.fail("invalid origin reached binding") } });
      assert.equal(response.status, 503, `${key}: ${value}`); privacy(response);
    }
  }
});

test("only canonical child v1 paths and backend methods can reach the private service", async () => {
  const gateway = createChildPrivateGateway();
  const env = { ...configured, CHILD_PRIVATE_API: { fetch: async () => assert.fail("out-of-scope request") } };
  for (const path of ["/", "/health/live", "/health/ready", "/admin", "/api" + prefix + "/commands", prefix + "-extra/commands", "/canopyproof/child-stewardship/v2/commands", prefix + "/%63ommands", prefix + "/commands%2fextra", "/canopyproof/%63hild-stewardship/v1/%ZZ"]) {
    const response = await gateway.fetch(request(path), env); assert.equal(response.status, 404, path); privacy(response);
  }
  for (const method of ["DELETE", "PATCH", "PUT"]) {
    const response = await gateway.fetch(request(undefined, { method }), env); assert.equal(response.status, 405); privacy(response);
  }
});

test("fixed target ignores caller hostname, forwarding claims and redirect parameters while preserving opaque credentials", async () => {
  const gateway = createChildPrivateGateway(); let calls = 0;
  const kept = { authorization: "Bearer synthetic-capability", origin: browserOrigin, "sec-fetch-site": "same-site", "if-match": "7", "idempotency-key": "fixture-command-1234", "x-child-upload-authorization": "synthetic-proof", "content-type": "application/json", accept: "application/json" };
  const removed = { cookie: "session=synthetic", host: "attacker.invalid", "x-forwarded-host": "attacker.invalid", "x-forwarded-proto": "http", "x-dropin-actor-id": "operator", "x-dropin-actor-role": "guardian", "x-dropin-organization-id": "claimed", traceparent: "synthetic", baggage: "synthetic", "cf-access-jwt-assertion": "unverified", "x-arbitrary": "synthetic" };
  const privateBinding = { fetch: async function (input: Request) {
    assert.equal(this, privateBinding); calls++;
    assert.equal(input.url, `${privateOrigin}${prefix}/commands?target=https://attacker.invalid&token=synthetic`);
    assert.equal(input.method, "POST"); assert.equal(input.redirect, "manual");
    for (const [name, value] of Object.entries(kept)) assert.equal(input.headers.get(name), value, name);
    for (const name of Object.keys(removed)) assert.equal(input.headers.get(name), null, name);
    assert.equal(await input.text(), '{"url":"https://attacker.invalid","synthetic":true}');
    return Response.json({ error: { code: "SYNTHETIC_DENIED" } }, { status: 409 });
  } };
  const response = await gateway.fetch(new Request(`https://attacker.invalid${prefix}/commands?target=https://attacker.invalid&token=synthetic`, { method: "POST", headers: { ...kept, ...removed }, body: '{"url":"https://attacker.invalid","synthetic":true}' }), { ...configured, CHILD_PRIVATE_API: privateBinding });
  assert.equal(calls, 1); assert.equal(response.status, 409); privacy(response);
  assert.doesNotMatch(await response.text(), /synthetic-capability|synthetic-proof|attacker/);
});

test("an approved-looking Origin never authenticates missing or forged bearer on actual routes", async () => {
  // Explicit in-memory synthetic fixture, not a production store or authority.
  const app = new Hono().route(prefix, createChildStewardshipRoutes({ mode: "synthetic-demo", store: new TestChildStore() }));
  const provisioned = await app.request(prefix + "/demo-sessions", { method: "POST" });
  const data = await provisioned.json();
  const valid = data.data.tokens.child as string;
  const gateway = createChildPrivateGateway();
  const env = { ...configured, CHILD_PRIVATE_API: { fetch: async (input: Request) => app.fetch(input) } };
  for (const authorization of [undefined, "Bearer forged", `Bearer cp-demo.${"A".repeat(43)}`]) {
    const response = await gateway.fetch(request(prefix + "/view", { headers: { origin: browserOrigin, ...(authorization ? { authorization } : {}) } }), env);
    assert.equal(response.status, 401); privacy(response);
  }
  const accepted = await gateway.fetch(request(prefix + "/view", { headers: { origin: browserOrigin, authorization: `Bearer ${valid}` } }), env);
  assert.equal(accepted.status, 200); privacy(accepted);
  assert.doesNotMatch(await accepted.text(), new RegExp(valid.replaceAll(".", "\\.")));
});

test("gateway preserves absent Origin and rejects disallowed or cross-site metadata without manufacturing authority", async () => {
  const gateway = createChildPrivateGateway(); let calls = 0;
  const env = { ...configured, CHILD_PRIVATE_API: { fetch: async (input: Request) => { calls++; assert.equal(input.headers.get("origin"), null); assert.equal(input.headers.get("authorization"), null); return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }); } } };
  assert.equal((await gateway.fetch(request(), env)).status, 401);
  for (const headers of [{ origin: "null" }, { origin: "https://unapproved.invalid" }, { origin: browserOrigin + ".unapproved.invalid" }, { origin: browserOrigin, "sec-fetch-site": "cross-site" }]) {
    const response = await gateway.fetch(request(undefined, { headers }), env); assert.equal(response.status, 403); privacy(response);
  }
  assert.equal(calls, 1);
});

test("gateway streams negative-authority calls without readiness probes, retries or dependency substitution", async () => {
  const gateway = createChildPrivateGateway(); const seen: string[] = [];
  const env = { ...configured, CHILD_PRIVATE_API: { fetch: async (input: Request) => { seen.push(new URL(input.url).pathname); return Response.json({ status: "synthetic_revoked" }); } } };
  for (const suffix of ["guardian/logout", "resume/cancel"]) assert.equal((await gateway.fetch(request(prefix + "/" + suffix, { method: "POST", body: "{}" }), env)).status, 200);
  assert.deepEqual(seen, [prefix + "/guardian/logout", prefix + "/resume/cancel"]);
});

test("chunked request reaches binding before its body is available and preserves chunks", { timeout: 3000 }, async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } }, { highWaterMark: 0 });
  let arrived!: () => void;
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  const body = new TextEncoder();
  const init: RequestInit & { duplex: "half" } = { method: "POST", body: stream, duplex: "half" };
  const response = createChildPrivateGateway().fetch(request(undefined, init), { ...configured, CHILD_PRIVATE_API: { fetch: async (input: Request) => {
    arrived(); assert.equal(await input.text(), '{"synthetic":true}'); return new Response("streamed");
  } } });
  await reached; // No body bytes exist yet: the gateway did not buffer them.
  controller.enqueue(body.encode('{"synthetic":')); controller.enqueue(body.encode('true}')); controller.close();
  assert.equal(await (await response).text(), "streamed");
});

test("caller abort reaches private binding without retry or error disclosure", { timeout: 3000 }, async () => {
  const controller = new AbortController(); let calls = 0, arrived!: () => void;
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  const response = createChildPrivateGateway().fetch(request(undefined, { method: "POST", body: "{}", signal: controller.signal }), { ...configured, CHILD_PRIVATE_API: { fetch: async (input: Request) => {
    calls++; assert.equal(input.signal.aborted, false); arrived();
    await new Promise<void>(resolve => input.signal.addEventListener("abort", () => resolve(), { once: true }));
    assert.equal(input.signal.aborted, true); throw new Error("synthetic private abort details");
  } } });
  await reached; controller.abort(); const result = await response;
  assert.equal(result.status, 503); assert.equal(calls, 1); privacy(result);
  assert.doesNotMatch(await result.text(), /private abort details/);
});

test("private failures and redirects never leak target credentials or cause retry", async () => {
  const gateway = createChildPrivateGateway();
  for (const redirect of [false, true]) {
    let calls = 0;
    const response = await gateway.fetch(request(undefined, { method: "POST", body: "{}" }), { ...configured, CHILD_PRIVATE_API: { fetch: async () => {
      calls++; if (!redirect) throw new Error("private target and synthetic bearer must not escape");
      return new Response("private target", { status: 307, headers: { location: "https://exfiltration.invalid" } });
    } } });
    assert.equal(calls, 1); assert.equal(response.status, 503); privacy(response);
    assert.deepEqual(await response.json(), { error: { code: "SERVICE_UNAVAILABLE", retryable: false } });
  }
});

test("backend denial statuses survive, but cookies, CORS and redirect hints cannot escape", async () => {
  for (const status of [401, 403, 409, 413, 429, 503]) {
    const response = await createChildPrivateGateway().fetch(request(), { ...configured, CHILD_PRIVATE_API: { fetch: async () => Response.json({ error: { code: "SYNTHETIC_DENIED" } }, { status, headers: { "set-cookie": "session=fixture", "access-control-allow-origin": "*", "access-control-allow-credentials": "true", location: "https://unapproved.invalid", refresh: "0;url=https://unapproved.invalid", "x-debug-token": "fixture", "cache-control": "public", "referrer-policy": "unsafe-url" } }) } });
    assert.equal(response.status, status); privacy(response);
  }
});

test("actual proxy-gateway chain preserves PR47 isolation and PR45 exact preflight", async () => {
  let childCalls = 0, legacyCalls = 0;
  const gateway = createChildPrivateGateway();
  const gatewayEnv = { ...configured, CHILD_PRIVATE_API: { fetch: async (input: Request) => { childCalls++; assert.equal(input.url, `${privateOrigin}${prefix}/view`); assert.equal(input.headers.get("authorization"), "Bearer fixture"); return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }); } } };
  const proxy = createCanopyproofApiProxy({ requestIdFactory: () => "fixture", fetcher: async () => { legacyCalls++; return new Response("legacy"); } });
  const proxyEnv = { DROPIN_API_ORIGIN: "https://legacy.synthetic.invalid", DROPIN_CANOPYPROOF_MODE: "production", DROPIN_ALLOWED_ORIGINS: browserOrigin, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: { fetch: async (input: Request) => gateway.fetch(input, gatewayEnv) } };
  const response = await proxy.fetch(new Request(`${browserOrigin}/api${prefix}/view`, { headers: { origin: browserOrigin, authorization: "Bearer fixture" } }), proxyEnv);
  assert.equal(response.status, 401); assert.equal(response.headers.get("access-control-allow-origin"), browserOrigin);
  assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(childCalls, 1); assert.equal(legacyCalls, 0);
  const preflight = await proxy.fetch(new Request(`${browserOrigin}/api${prefix}/commands`, { method: "OPTIONS", headers: { origin: browserOrigin, "access-control-request-method": "POST" } }), proxyEnv);
  assert.equal(preflight.status, 204); assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /if-match,x-child-upload-authorization/); assert.equal(childCalls, 1);
  assert.equal(await (await proxy.fetch(new Request(`${browserOrigin}/api/ready`), proxyEnv)).text(), "legacy"); assert.equal(legacyCalls, 1);
});

test("gateway sample is disabled, private and contains no target or resource binding", () => {
  const config = JSON.parse(readFileSync("infra/cloudflare/child-private-gateway.wrangler.jsonc.example", "utf8"));
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false); assert.deepEqual(config.routes, []);
  assert.equal(config.vars.DROPIN_CHILD_GATEWAY_MODE, "disabled"); assert.equal(config.vars.CHILD_PRIVATE_ORIGIN, undefined); assert.equal(config.vars.CHILD_GATEWAY_ALLOWED_ORIGIN, undefined);
  for (const field of ["services", "vpc_services", "vpc_networks", "hyperdrive", "d1_databases", "durable_objects"]) assert.equal(config[field], undefined, field);
  const code = readFileSync("packages/dropin-cloudflare/src/child-private-gateway.ts", "utf8");
  assert.doesNotMatch(code, /console\.|passThroughOnException|fetch\(destination|fetch\(target/);
});
