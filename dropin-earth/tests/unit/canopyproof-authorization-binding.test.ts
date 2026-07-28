import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCanopyProofAuthorizationAssurance,
  bindCanopyProofAuthorizationPrincipal,
  canopyProofAuthorizationBindingStatus,
  CanopyProofAuthorizationError,
  type CanopyProofAuthorizationRegistry,
  type CanopyProofAuthorizationRegistrySnapshot,
} from "../../services/api/src/domain/canopyproof/authorization-binding.js";
import type { CanopyProofAuthenticatedPrincipal } from "../../services/api/src/domain/canopyproof/identity-authentication.js";

const productionEnvironment = {
  NODE_ENV: "production",
  DROPIN_CANOPYPROOF_MODE: "production",
  DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
  DROPIN_REPOSITORY: "prisma",
  DATABASE_URL: "postgresql://configured-without-secret-material",
} as const;

const evaluatedAt = "2026-07-10T00:00:00.000Z";

function accessPrincipal(
  overrides: Partial<CanopyProofAuthenticatedPrincipal> = {},
): CanopyProofAuthenticatedPrincipal {
  return {
    actorId: "participant_verifier_001",
    role: "verifier",
    organizationId: "organization_accredited_001",
    issuer: "https://canopyproof.cloudflareaccess.com",
    audience: ["canopyproof-audience"],
    tokenId: "sensitive-token-identifier",
    authenticatedAt: "2026-07-09T23:59:00.000Z",
    expiresAt: "2026-07-10T00:01:00.000Z",
    authenticationMethod: "cloudflare_access_jwt",
    ...overrides,
  };
}

function verifiedSnapshot(
  overrides: Partial<CanopyProofAuthorizationRegistrySnapshot> = {},
): CanopyProofAuthorizationRegistrySnapshot {
  return {
    participantId: "participant_verifier_001",
    participantType: "human",
    participantRoles: ["verifier"],
    participantVerificationStatus: "verified",
    participantOrganizationId: "organization_accredited_001",
    organizationId: "organization_accredited_001",
    organizationVerificationStatus: "verified",
    organizationAccreditationStatus: "approved",
    membershipId: "membership_verifier_001",
    membershipRole: "verifier",
    membershipStatus: "active",
    latestAccreditationId: "accreditation_approved_001",
    latestAccreditationStatus: "approved",
    ...overrides,
  };
}

function registry(snapshot: CanopyProofAuthorizationRegistrySnapshot | undefined): CanopyProofAuthorizationRegistry {
  return {
    async resolve() {
      return snapshot;
    },
  };
}

async function expectAuthorizationError(
  operation: Promise<unknown>,
  code: "CANOPYPROOF_AUTHORIZATION_DENIED" | "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
  status: 403 | 503,
) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError && error.code === code && error.httpStatus === status,
  );
}

test("CanopyProof binds a signed principal to an exact active accredited membership", async () => {
  const binding = await bindCanopyProofAuthorizationPrincipal(
    accessPrincipal(),
    productionEnvironment,
    registry(verifiedSnapshot()),
    evaluatedAt,
  );

  assert.equal(binding.actorId, "participant_verifier_001");
  assert.equal(binding.role, "verifier");
  assert.equal(binding.source, "postgres");
  assert.equal(binding.organizationId, "organization_accredited_001");
  assert.equal(binding.membershipId, "membership_verifier_001");
  assert.match(binding.decisionHash, /^[a-f0-9]{64}$/);
  assert.doesNotThrow(() => assertCanopyProofAuthorizationAssurance(binding, "participant"));
  assert.doesNotThrow(() => assertCanopyProofAuthorizationAssurance(binding, "organization_member"));
  assert.doesNotThrow(() => assertCanopyProofAuthorizationAssurance(binding, "verified_organization"));
  assert.doesNotThrow(() => assertCanopyProofAuthorizationAssurance(binding, "accredited_organization"));

  const serialized = JSON.stringify(binding);
  assert.doesNotMatch(serialized, /sensitive-token-identifier|canopyproof-audience|cloudflareaccess/);
});

test("CanopyProof denies absent, unverified, role-mismatched, and revoked durable authority", async () => {
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(accessPrincipal(), productionEnvironment, registry(undefined), evaluatedAt),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      accessPrincipal(),
      productionEnvironment,
      registry(verifiedSnapshot({ participantVerificationStatus: "revoked" })),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      accessPrincipal(),
      productionEnvironment,
      registry(verifiedSnapshot({ participantRoles: ["researcher"] })),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      accessPrincipal(),
      productionEnvironment,
      registry(verifiedSnapshot({ organizationVerificationStatus: "suspended" })),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      accessPrincipal(),
      productionEnvironment,
      registry(verifiedSnapshot({ membershipStatus: "revoked" })),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );
});

test("CanopyProof rejects organization substitution and agent-to-human authority substitution", async () => {
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      accessPrincipal(),
      productionEnvironment,
      registry(verifiedSnapshot({ organizationId: "organization_other_001" })),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );

  const agentPrincipal = accessPrincipal({
    actorId: "participant_agent_001",
    role: "agent",
    organizationId: undefined,
  });
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      agentPrincipal,
      productionEnvironment,
      registry(
        verifiedSnapshot({
          participantId: "participant_agent_001",
          participantRoles: ["agent"],
          participantOrganizationId: undefined,
          organizationId: undefined,
          organizationVerificationStatus: undefined,
          organizationAccreditationStatus: undefined,
          membershipId: undefined,
          membershipRole: undefined,
          membershipStatus: undefined,
          latestAccreditationId: undefined,
          latestAccreditationStatus: undefined,
        }),
      ),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_DENIED",
    403,
  );
});

test("CanopyProof requires deterministic current accreditation for final-authority assurance", async () => {
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(
      accessPrincipal(),
      productionEnvironment,
      registry(
        verifiedSnapshot({
          organizationAccreditationStatus: "approved",
          latestAccreditationId: undefined,
          latestAccreditationStatus: undefined,
        }),
      ),
      evaluatedAt,
    ),
    "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
    503,
  );

  const pendingBinding = await bindCanopyProofAuthorizationPrincipal(
    accessPrincipal(),
    productionEnvironment,
    registry(
      verifiedSnapshot({
        organizationAccreditationStatus: "pending",
        latestAccreditationId: undefined,
        latestAccreditationStatus: undefined,
      }),
    ),
    evaluatedAt,
  );
  assert.doesNotThrow(() => assertCanopyProofAuthorizationAssurance(pendingBinding, "verified_organization"));
  assert.throws(
    () => assertCanopyProofAuthorizationAssurance(pendingBinding, "accredited_organization"),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.code === "CANOPYPROOF_AUTHORIZATION_DENIED" &&
      error.httpStatus === 403,
  );
});

test("CanopyProof development isolation cannot become a production authorization fallback", async () => {
  const developmentPrincipal = accessPrincipal({
    authenticationMethod: "development_headers",
    issuer: "urn:canopyproof:development-headers",
    audience: ["canopyproof-development"],
    tokenId: undefined,
    expiresAt: undefined,
    organizationId: undefined,
  });
  const developmentBinding = await bindCanopyProofAuthorizationPrincipal(
    developmentPrincipal,
    { NODE_ENV: "test", DROPIN_CANOPYPROOF_AUTH_MODE: "development_headers" },
    undefined,
    evaluatedAt,
  );
  assert.equal(developmentBinding.source, "development_isolation");
  assert.match(developmentBinding.organizationId ?? "", /^cp_dev_organization_/);
  assert.doesNotThrow(() => assertCanopyProofAuthorizationAssurance(developmentBinding, "accredited_organization"));

  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(developmentPrincipal, productionEnvironment, undefined, evaluatedAt),
    "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
    503,
  );
  await expectAuthorizationError(
    bindCanopyProofAuthorizationPrincipal(accessPrincipal(), { ...productionEnvironment, DATABASE_URL: undefined }, undefined, evaluatedAt),
    "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
    503,
  );
});

test("CanopyProof authorization status reports only configuration posture", () => {
  const production = canopyProofAuthorizationBindingStatus(productionEnvironment);
  assert.equal(production.mode, "enforced");
  assert.equal(production.configured, true);
  assert.equal(production.databaseConfigured, true);
  assert.equal(production.safety.membershipRevocationChecked, true);

  const missingDatabase = canopyProofAuthorizationBindingStatus({
    ...productionEnvironment,
    DATABASE_URL: undefined,
  });
  assert.equal(missingDatabase.configured, false);
  assert.equal(missingDatabase.databaseConfigured, false);

  const unknownRepository = canopyProofAuthorizationBindingStatus({
    ...productionEnvironment,
    DROPIN_REPOSITORY: "unknown",
  });
  assert.equal(unknownRepository.configured, false);
  assert.equal(unknownRepository.databaseConfigured, false);

  const serialized = JSON.stringify(production);
  assert.doesNotMatch(serialized, /postgresql:|participant_verifier|sensitive-token/);
});
