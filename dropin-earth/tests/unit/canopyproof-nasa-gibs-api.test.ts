import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `nasa_gibs_${role}_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
    "x-dropin-organization-id": "nasa_gibs_api_organization",
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("NASA GIBS API routes require identity and expose an explicit disabled state by default", async () => {
  delete process.env.CANOPYPROOF_NASA_GIBS_ENABLED;
  const unauthenticated = await app.request("/canopyproof/terra/connectors/nasa-gibs/status");
  assert.equal(unauthenticated.status, 401);

  const status = await app.request("/canopyproof/terra/connectors/nasa-gibs/status", {
    headers: headers("observer"),
  });
  assert.equal(status.status, 200);
  const body = await json<{
    ok: true;
    data: { enabled: boolean; sourceState: string; implementationGate: string; safety: { nasaIsNotProofAuthority: boolean } };
  }>(status);
  assert.equal(body.data.enabled, false);
  assert.equal(body.data.sourceState, "disabled");
  assert.equal(body.data.implementationGate, "non_production_only");
  assert.equal(body.data.safety.nasaIsNotProofAuthority, true);
});

test("NASA GIBS API rejects unauthorized sync and remains fail closed while the feature gate is disabled", async () => {
  const observer = await app.request("/canopyproof/terra/connectors/nasa-gibs/sync", {
    method: "POST",
    headers: { ...headers("observer"), "idempotency-key": "nasa-gibs-api-idempotency-0001" },
    body: JSON.stringify({ serviceType: "WMTS", projection: "EPSG:3857" }),
  });
  assert.equal(observer.status, 403);

  const disabled = await app.request("/canopyproof/terra/connectors/nasa-gibs/sync", {
    method: "POST",
    headers: { ...headers("admin"), "idempotency-key": "nasa-gibs-api-idempotency-0002" },
    body: JSON.stringify({ serviceType: "WMTS", projection: "EPSG:3857" }),
  });
  assert.equal(disabled.status, 503);
  assert.deepEqual(await json(disabled), { ok: false, error: "AUTHORIZATION_DENIED" });
});

test("NASA GIBS API validates enum filters and never accepts an arbitrary endpoint URL", async () => {
  const invalidFilter = await app.request(
    "/canopyproof/terra/connectors/nasa-gibs/products?projection=EPSG%3A9999",
    { headers: headers("researcher") },
  );
  assert.equal(invalidFilter.status, 422);
  assert.deepEqual(await json(invalidFilter), { ok: false, error: "CATALOG_INVARIANT" });

  const arbitraryEndpoint = await app.request("/canopyproof/terra/connectors/nasa-gibs/sync", {
    method: "POST",
    headers: { ...headers("admin"), "idempotency-key": "nasa-gibs-api-idempotency-0003" },
    body: JSON.stringify({
      serviceType: "WMTS",
      projection: "EPSG:3857",
      endpoint: "https://example.com/capabilities.xml",
    }),
  });
  assert.equal(arbitraryEndpoint.status, 400, "strict request schema must reject caller-provided endpoint fields");
});

test("NASA GIBS tile telemetry is authenticated and remains fail closed with the connector disabled", async () => {
  const unauthenticated = await app.request("/canopyproof/terra/connectors/nasa-gibs/tile-failures", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId: "nasa_gibs_product_fixture", failureKind: "network" }),
  });
  assert.equal(unauthenticated.status, 401);

  const disabled = await app.request("/canopyproof/terra/connectors/nasa-gibs/tile-failures", {
    method: "POST",
    headers: headers("observer"),
    body: JSON.stringify({ productId: "nasa_gibs_product_fixture", failureKind: "network" }),
  });
  assert.equal(disabled.status, 503);
  assert.deepEqual(await json(disabled), { ok: false, error: "AUTHORIZATION_DENIED" });
});
