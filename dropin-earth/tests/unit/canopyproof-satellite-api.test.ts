import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { satelliteProofReplayFixtureSchema } from "../../packages/schemas/src/satellite-proof.schema.js";
import { app } from "../../services/api/src/app.js";

const fixture = satelliteProofReplayFixtureSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/canopyproof-satellite-proof-replay.json"), "utf8")),
);

function headers(role: string) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": `satellite_${role}_actor`,
    "x-dropin-actor-role": role,
    "x-dropin-organization-id": "satellite_fixture_organization",
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("satellite integration status is authenticated, mock-only, and fail-closed", async () => {
  delete process.env.CANOPY_PRODUCTION_UNLOCK;
  const unauthenticated = await app.request("/canopyproof/satellite/status");
  assert.equal(unauthenticated.status, 401);

  const response = await app.request("/canopyproof/satellite/status", { headers: headers("observer") });
  const body = await json<{
    ok: true;
    data: {
      implementationGate: string;
      liveProviderCallsEnabled: boolean;
      protocolWritePathBlocked: boolean;
      safety: { auditRequiredForCertificate: boolean; noProductionClaims: boolean };
    };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(body.data.implementationGate, "mock_fixtures_only");
  assert.equal(body.data.liveProviderCallsEnabled, false);
  assert.equal(body.data.protocolWritePathBlocked, true);
  assert.equal(body.data.safety.auditRequiredForCertificate, true);
  assert.equal(body.data.safety.noProductionClaims, true);
});

test("satellite replay is read-only and rejects production unlock while governance flag is absent", async () => {
  delete process.env.CANOPY_PRODUCTION_UNLOCK;
  const blocked = await app.request("/canopyproof/satellite/replay", {
    method: "POST",
    headers: headers("researcher"),
    body: JSON.stringify(fixture),
  });
  assert.equal(blocked.status, 400);
  assert.match((await json<{ error: string }>(blocked)).error, /CANOPY_PRODUCTION_UNLOCK=true/);

  const replayOnlyFixture = {
    schemaVersion: fixture.schemaVersion,
    baseline: fixture.baseline,
    observation: fixture.observation,
    audit: fixture.audit,
    certificate: fixture.certificate,
  };
  const replayed = await app.request("/canopyproof/satellite/replay", {
    method: "POST",
    headers: headers("researcher"),
    body: JSON.stringify(replayOnlyFixture),
  });
  const replayedBody = await json<{
    ok: true;
    data: { productionWritePerformed: boolean; replay: { state: { certificateRoot: string; unlocks: object } } };
  }>(replayed);
  assert.equal(replayed.status, 200);
  assert.equal(replayedBody.data.productionWritePerformed, false);
  assert.match(replayedBody.data.replay.state.certificateRoot, /^[a-f0-9]{64}$/);
  assert.deepEqual(replayedBody.data.replay.state.unlocks, {});
});

test("community identities cannot invoke institutional satellite replay", async () => {
  const response = await app.request("/canopyproof/satellite/replay", {
    method: "POST",
    headers: headers("community"),
    body: JSON.stringify(fixture),
  });
  assert.equal(response.status, 403);
});
