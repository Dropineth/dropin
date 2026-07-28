import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import {
  authenticateCanopyProofRequest,
  canopyProofAuthenticationStatus,
  CanopyProofAuthenticationError,
  resolveCanopyProofAuthenticationConfiguration,
} from "../../services/api/src/domain/canopyproof/identity-authentication.js";

const productionEnvironment = {
  NODE_ENV: "production",
  DROPIN_CANOPYPROOF_MODE: "production",
  DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
  DROPIN_ACCESS_TEAM_DOMAIN: "https://canopyproof.cloudflareaccess.com",
  DROPIN_ACCESS_AUD: "canopyproof-access-audience",
  DROPIN_ACCESS_ROLE_CLAIM: "canopyproof_role",
  DROPIN_ACCESS_ORGANIZATION_CLAIM: "canopyproof_organization_id",
} as const;

test("CanopyProof authentication configuration forbids development headers in production", () => {
  assert.throws(
    () =>
      resolveCanopyProofAuthenticationConfiguration({
        ...productionEnvironment,
        DROPIN_CANOPYPROOF_AUTH_MODE: "development_headers",
      }),
    (error: unknown) =>
      error instanceof CanopyProofAuthenticationError &&
      error.code === "CANOPYPROOF_AUTH_CONFIG_INVALID" &&
      error.httpStatus === 503,
  );
  assert.throws(
    () =>
      resolveCanopyProofAuthenticationConfiguration({
        ...productionEnvironment,
        DROPIN_ACCESS_TEAM_DOMAIN: "https://attacker.example",
      }),
    /CANOPYPROOF_AUTH_CONFIG_INVALID/,
  );

  const development = resolveCanopyProofAuthenticationConfiguration({ NODE_ENV: "test" });
  assert.equal(development.mode, "development_headers");
  assert.equal(development.production, false);
});

test("CanopyProof development authentication requires a complete bounded identity", async () => {
  const principal = await authenticateCanopyProofRequest(
    new Headers({
      "x-dropin-actor-id": "verifier_development_identity",
      "x-dropin-actor-role": "verifier",
      "x-dropin-organization-id": "org_development_identity",
    }),
    { NODE_ENV: "test", DROPIN_CANOPYPROOF_AUTH_MODE: "development_headers" },
  );

  assert.equal(principal?.actorId, "verifier_development_identity");
  assert.equal(principal?.role, "verifier");
  assert.equal(principal?.organizationId, "org_development_identity");
  assert.equal(principal?.authenticationMethod, "development_headers");

  await assert.rejects(
    authenticateCanopyProofRequest(
      new Headers({ "x-dropin-actor-id": "incomplete_identity" }),
      { NODE_ENV: "test", DROPIN_CANOPYPROOF_AUTH_MODE: "development_headers" },
    ),
    /CANOPYPROOF_AUTH_INVALID/,
  );
});

test("CanopyProof Access authentication maps only independently verified signed claims", async () => {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const principal = await authenticateCanopyProofRequest(
    new Headers({
      "cf-access-jwt-assertion": "opaque-signed-token",
      "x-dropin-actor-id": "spoofed-owner",
      "x-dropin-actor-role": "owner",
    }),
    productionEnvironment,
    async (token, configuration) => {
      assert.equal(token, "opaque-signed-token");
      assert.equal(configuration.teamDomain, productionEnvironment.DROPIN_ACCESS_TEAM_DOMAIN);
      assert.equal(configuration.audience, productionEnvironment.DROPIN_ACCESS_AUD);
      return {
        sub: "verifier_access_identity",
        iss: configuration.teamDomain,
        aud: configuration.audience,
        iat: nowSeconds - 1,
        exp: nowSeconds + 60,
        jti: "access-token-id",
        canopyproof_role: "verifier",
        canopyproof_organization_id: "org_access_identity",
      };
    },
  );

  assert.equal(principal?.actorId, "verifier_access_identity");
  assert.equal(principal?.role, "verifier");
  assert.equal(principal?.organizationId, "org_access_identity");
  assert.equal(principal?.tokenId, "access-token-id");
  assert.equal(principal?.authenticationMethod, "cloudflare_access_jwt");
  assert.equal(principal?.issuer, productionEnvironment.DROPIN_ACCESS_TEAM_DOMAIN);
  assert.deepEqual(principal?.audience, [productionEnvironment.DROPIN_ACCESS_AUD]);
});

test("CanopyProof Access authentication rejects ambiguous roles and inconsistent time claims", async () => {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const headers = new Headers({ "cf-access-jwt-assertion": "opaque-signed-token" });

  await assert.rejects(
    authenticateCanopyProofRequest(headers, productionEnvironment, async () => ({
      sub: "ambiguous_access_identity",
      iss: productionEnvironment.DROPIN_ACCESS_TEAM_DOMAIN,
      aud: productionEnvironment.DROPIN_ACCESS_AUD,
      iat: nowSeconds - 1,
      exp: nowSeconds + 60,
      canopyproof_role: ["owner", "verifier"],
    })),
    /exactly one recognized CanopyProof role/,
  );
  await assert.rejects(
    authenticateCanopyProofRequest(headers, productionEnvironment, async () => ({
      sub: "future_access_identity",
      iss: productionEnvironment.DROPIN_ACCESS_TEAM_DOMAIN,
      aud: productionEnvironment.DROPIN_ACCESS_AUD,
      iat: nowSeconds + 60,
      exp: nowSeconds + 120,
      canopyproof_role: "observer",
    })),
    /time claims are inconsistent/,
  );
  await assert.rejects(
    authenticateCanopyProofRequest(headers, productionEnvironment, async () => ({
      sub: "wrong_audience_identity",
      iss: productionEnvironment.DROPIN_ACCESS_TEAM_DOMAIN,
      aud: "different-audience",
      iat: nowSeconds - 1,
      exp: nowSeconds + 60,
      canopyproof_role: "observer",
    })),
    /issuer or audience is invalid/,
  );
  await assert.rejects(
    authenticateCanopyProofRequest(headers, productionEnvironment, async () => ({
      sub: "expired_access_identity",
      iss: productionEnvironment.DROPIN_ACCESS_TEAM_DOMAIN,
      aud: productionEnvironment.DROPIN_ACCESS_AUD,
      iat: nowSeconds - 120,
      exp: nowSeconds - 60,
      canopyproof_role: "observer",
    })),
    /time claims are inconsistent/,
  );
});

test("CanopyProof production API ignores raw actor headers and keeps public status anonymous", async () => {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(productionEnvironment)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }

  try {
    const denied = await app.request("/canopyproof/security/status", {
      headers: {
        "x-dropin-actor-id": "spoofed-owner",
        "x-dropin-actor-role": "owner",
      },
    });
    const deniedBody = (await denied.json()) as { ok: false; error: string };
    assert.equal(denied.status, 401);
    assert.equal(deniedBody.error, "CANOPYPROOF_AUTH_REQUIRED");
    assert.match(denied.headers.get("x-dropin-telemetry-event-hash") ?? "", /^[a-f0-9]{64}$/);

    const publicStatus = await app.request("/canopyproof/status");
    assert.equal(publicStatus.status, 200);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("CanopyProof authentication status reports configuration presence without identity material", () => {
  const status = canopyProofAuthenticationStatus(productionEnvironment);
  const serialized = JSON.stringify(status);

  assert.equal(status.mode, "cloudflare_access_jwt");
  assert.equal(status.production, true);
  assert.equal(status.configured, true);
  assert.equal(status.safety.originSignatureVerificationRequired, true);
  assert.equal(status.safety.rawActorHeadersRejectedInProduction, true);
  assert.equal(status.safety.privateKeyHandlingDisabled, true);
  assert.doesNotMatch(serialized, /canopyproof-access-audience|canopyproof\.cloudflareaccess\.com|opaque-signed-token/);
});
