import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCanopyProofAuthorizationAssurance,
  bindCanopyProofAuthorizationPrincipal,
  CanopyProofAuthorizationError,
  requireCanopyProofAuthorizationBinding,
  type CanopyProofAuthorizationBinding,
  type CanopyProofAuthorizationRegistry,
  type CanopyProofAuthorizationRegistrySnapshot,
} from "../../services/api/src/domain/canopyproof/authorization-binding.js";
import type { CanopyProofAuthenticatedPrincipal } from "../../services/api/src/domain/canopyproof/identity-authentication.js";
import {
  CanopyProofSecurityPolicyService,
  type CanopyProofAttributeAccessInput,
  type CanopyProofSecurityPolicy,
} from "../../services/api/src/domain/canopyproof/security-policy.js";

const evaluatedAt = "2026-07-10T00:00:00.000Z";
const productionEnvironment = {
  NODE_ENV: "production",
  DROPIN_CANOPYPROOF_MODE: "production",
  DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
  DROPIN_REPOSITORY: "prisma",
  DATABASE_URL: "postgresql://configured-without-secret-material",
} as const;

function principal(
  overrides: Partial<CanopyProofAuthenticatedPrincipal> = {},
): CanopyProofAuthenticatedPrincipal {
  return {
    actorId: "participant_verifier_critical",
    role: "verifier",
    organizationId: "organization_critical",
    issuer: "https://canopyproof.cloudflareaccess.com",
    audience: ["canopyproof-audience"],
    tokenId: "redacted-at-boundary",
    authenticatedAt: "2026-07-09T23:59:00.000Z",
    expiresAt: "2026-07-10T00:01:00.000Z",
    authenticationMethod: "cloudflare_access_jwt",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<CanopyProofAuthorizationRegistrySnapshot> = {},
): CanopyProofAuthorizationRegistrySnapshot {
  return {
    participantId: "participant_verifier_critical",
    participantType: "human",
    participantRoles: ["verifier"],
    participantVerificationStatus: "verified",
    participantOrganizationId: "organization_critical",
    organizationId: "organization_critical",
    organizationVerificationStatus: "verified",
    organizationAccreditationStatus: "approved",
    membershipId: "membership_verifier_critical",
    membershipRole: "verifier",
    membershipStatus: "active",
    latestAccreditationId: "accreditation_critical",
    latestAccreditationStatus: "approved",
    ...overrides,
  };
}

function fixedRegistry(
  value: CanopyProofAuthorizationRegistrySnapshot | undefined,
): CanopyProofAuthorizationRegistry {
  return {
    async resolve() {
      return value;
    },
  };
}

async function expectAuthorizationFailure(
  operation: Promise<unknown>,
  expected: {
    code: "CANOPYPROOF_AUTHORIZATION_DENIED" | "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE";
    reason: string;
    status: 403 | 503;
  },
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.code === expected.code &&
      error.reason === expected.reason &&
      error.httpStatus === expected.status,
  );
}

function unscopedCommunitySnapshot(
  overrides: Partial<CanopyProofAuthorizationRegistrySnapshot> = {},
): CanopyProofAuthorizationRegistrySnapshot {
  return {
    participantId: "participant_community_critical",
    participantType: "human",
    participantRoles: ["community"],
    participantVerificationStatus: "verified",
    ...overrides,
  };
}

function validAccessInput(
  overrides: Partial<CanopyProofAttributeAccessInput> = {},
): CanopyProofAttributeAccessInput {
  return {
    actorId: "researcher_critical",
    actorRole: "researcher",
    actorOrganizationId: "organization_critical",
    resource: "evidence",
    resourceId: "evidence_critical",
    resourceOrganizationId: "organization_critical",
    classification: "internal",
    purpose: "evidence_review",
    action: "read",
    conflictStatus: "none",
    createdAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

test("authorization binding converts registry failures to fail-closed outcomes", async () => {
  const unavailableRegistry: CanopyProofAuthorizationRegistry = {
    async resolve() {
      throw new Error("provider details must not escape");
    },
  };
  await expectAuthorizationFailure(
    bindCanopyProofAuthorizationPrincipal(
      principal(),
      productionEnvironment,
      unavailableRegistry,
      evaluatedAt,
    ),
    {
      code: "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
      reason: "registry_unavailable",
      status: 503,
    },
  );

  const expectedError = new CanopyProofAuthorizationError(
    "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
    "registry_inconsistent",
    503,
  );
  const rejectingRegistry: CanopyProofAuthorizationRegistry = {
    async resolve() {
      throw expectedError;
    },
  };
  await assert.rejects(
    bindCanopyProofAuthorizationPrincipal(
      principal(),
      productionEnvironment,
      rejectingRegistry,
      evaluatedAt,
    ),
    (error: unknown) => error === expectedError,
  );
});

test("authorization binding permits only clean unscoped community authority", async () => {
  const communityPrincipal = principal({
    actorId: "participant_community_critical",
    role: "community",
    organizationId: undefined,
  });
  const binding = await bindCanopyProofAuthorizationPrincipal(
    communityPrincipal,
    productionEnvironment,
    fixedRegistry(unscopedCommunitySnapshot()),
    evaluatedAt,
  );

  assert.equal(binding.organizationId, undefined);
  assert.equal(binding.membershipId, undefined);
  assert.doesNotThrow(() =>
    assertCanopyProofAuthorizationAssurance(binding, "participant"),
  );
  assert.throws(
    () =>
      assertCanopyProofAuthorizationAssurance(
        binding,
        "organization_member",
      ),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.reason === "assurance_not_satisfied",
  );
  assert.equal(
    requireCanopyProofAuthorizationBinding(binding, communityPrincipal),
    binding,
  );

  await expectAuthorizationFailure(
    bindCanopyProofAuthorizationPrincipal(
      principal({ organizationId: undefined }),
      productionEnvironment,
      fixedRegistry(
        snapshot({
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
    {
      code: "CANOPYPROOF_AUTHORIZATION_DENIED",
      reason: "organization_required",
      status: 403,
    },
  );
});

test("authorization binding rejects every form of unscoped registry residue", async () => {
  const communityPrincipal = principal({
    actorId: "participant_community_critical",
    role: "community",
    organizationId: undefined,
  });
  const residueCases: ReadonlyArray<
    Partial<CanopyProofAuthorizationRegistrySnapshot>
  > = [
    { organizationId: "organization_residue" },
    { membershipId: "membership_residue" },
    { membershipRole: "community" },
    { membershipStatus: "active" },
    { organizationVerificationStatus: "verified" },
    { organizationAccreditationStatus: "pending" },
    { latestAccreditationId: "accreditation_residue" },
    { latestAccreditationStatus: "pending" },
  ];

  for (const residue of residueCases) {
    await expectAuthorizationFailure(
      bindCanopyProofAuthorizationPrincipal(
        communityPrincipal,
        productionEnvironment,
        fixedRegistry(unscopedCommunitySnapshot(residue)),
        evaluatedAt,
      ),
      {
        code: "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
        reason: "registry_inconsistent",
        status: 503,
      },
    );
  }
});

test("authorization binding rejects identity, binding, and accreditation substitution", async () => {
  await expectAuthorizationFailure(
    bindCanopyProofAuthorizationPrincipal(
      principal(),
      productionEnvironment,
      fixedRegistry(snapshot({ participantId: "participant_other" })),
      evaluatedAt,
    ),
    {
      code: "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
      reason: "registry_inconsistent",
      status: 503,
    },
  );

  const validBinding = await bindCanopyProofAuthorizationPrincipal(
    principal(),
    productionEnvironment,
    fixedRegistry(snapshot()),
    evaluatedAt,
  );
  assert.throws(
    () => requireCanopyProofAuthorizationBinding(undefined, principal()),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.reason === "registry_inconsistent",
  );
  assert.throws(
    () =>
      requireCanopyProofAuthorizationBinding(
        validBinding,
        principal({ actorId: "participant_other" }),
      ),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.reason === "registry_inconsistent",
  );
  assert.throws(
    () =>
      requireCanopyProofAuthorizationBinding(
        validBinding,
        principal({ role: "researcher" }),
      ),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.reason === "registry_inconsistent",
  );

  const assuranceWithoutMembership: CanopyProofAuthorizationBinding = {
    ...validBinding,
    membershipId: undefined,
  };
  assert.throws(
    () =>
      assertCanopyProofAuthorizationAssurance(
        assuranceWithoutMembership,
        "organization_member",
      ),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.reason === "assurance_not_satisfied",
  );

  const pendingOrganization = await bindCanopyProofAuthorizationPrincipal(
    principal(),
    productionEnvironment,
    fixedRegistry(
      snapshot({
        organizationVerificationStatus: "pending",
      }),
    ),
    evaluatedAt,
  );
  assert.throws(
    () =>
      assertCanopyProofAuthorizationAssurance(
        pendingOrganization,
        "verified_organization",
      ),
    (error: unknown) =>
      error instanceof CanopyProofAuthorizationError &&
      error.reason === "assurance_not_satisfied",
  );

  for (const inconsistent of [
    snapshot({
      organizationAccreditationStatus: undefined,
      latestAccreditationId: undefined,
      latestAccreditationStatus: undefined,
    }),
    snapshot({
      latestAccreditationId: undefined,
      latestAccreditationStatus: "approved",
    }),
    snapshot({
      organizationAccreditationStatus: "approved",
      latestAccreditationStatus: "suspended",
    }),
  ]) {
    await expectAuthorizationFailure(
      bindCanopyProofAuthorizationPrincipal(
        principal(),
        productionEnvironment,
        fixedRegistry(inconsistent),
        evaluatedAt,
      ),
      {
        code: "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
        reason: "registry_inconsistent",
        status: 503,
      },
    );
  }
});

test("security policy covers high-risk limits, reset windows, and route fallbacks", () => {
  const highRiskPolicy: CanopyProofSecurityPolicy = {
    id: "critical-high-risk",
    tier: "high_risk_mutation",
    pathPattern: "/critical/exact",
    methods: ["POST"],
    windowMs: 1_000,
    maxRequests: 0,
    actorRequired: true,
  };
  const highRisk = new CanopyProofSecurityPolicyService([highRiskPolicy]);
  const rejected = highRisk.evaluateRequest({
    path: "/critical/exact",
    method: "post",
    actorId: "verifier_rate_critical",
    nowMs: 1_000,
  });
  const resetRejected = highRisk.evaluateRequest({
    path: "/critical/exact",
    method: "POST",
    actorId: "verifier_rate_critical",
    nowMs: 2_001,
  });
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfterSeconds, 1);
  assert.equal(highRisk.listAbuseSignals()[0]?.severity, "high");
  assert.notEqual(rejected.resetAt, resetRejected.resetAt);
  assert.equal(
    highRisk.evaluateRequest({
      path: "/outside-critical",
      method: "GET",
      actorId: "observer_fallback",
      nowMs: 1_000,
    }).policy.id,
    "canopyproof-authenticated-read",
  );

  const defaults = new CanopyProofSecurityPolicyService();
  assert.equal(
    defaults.evaluateRequest({
      path: "/canopyproof",
      method: "GET",
      actorId: "observer_routes",
      nowMs: 1_000,
    }).policy.id,
    "canopyproof-authenticated-read",
  );
  assert.equal(
    defaults.evaluateRequest({
      path: "/outside-canopyproof",
      method: "HEAD",
      actorId: "observer_routes",
      nowMs: 1_000,
    }).policy.id,
    "canopyproof-authenticated-read",
  );
  assert.equal(
    defaults.evaluateRequest({
      path: "/outside-canopyproof",
      method: "POST",
      actorId: "verifier_routes",
      nowMs: 1_000,
    }).policy.id,
    "canopyproof-mutation",
  );
  assert.equal(
    defaults.evaluateRequest({
      path: "/canopyproof/not-status/extra",
      method: "GET",
      actorId: "observer_routes",
      nowMs: 1_000,
    }).policy.id,
    "canopyproof-authenticated-read",
  );
});

test("security policy validates every attribute boundary before auditing", () => {
  const service = new CanopyProofSecurityPolicyService();
  assert.throws(
    () => service.evaluateAttributeAccess(validAccessInput({ actorId: " " })),
    /requires an accountable actor/,
  );
  assert.throws(
    () =>
      service.evaluateAttributeAccess(validAccessInput({ resourceId: " " })),
    /requires a resource ID/,
  );

  const invalidFields: ReadonlyArray<
    [keyof CanopyProofAttributeAccessInput, string]
  > = [
    ["actorRole", "actorRole"],
    ["resource", "resource"],
    ["classification", "classification"],
    ["purpose", "purpose"],
    ["action", "action"],
    ["conflictStatus", "conflictStatus"],
  ];
  for (const [field, expectedName] of invalidFields) {
    const invalid = {
      ...validAccessInput(),
      [field]: "invalid",
    } as unknown as CanopyProofAttributeAccessInput;
    assert.throws(
      () => service.evaluateAttributeAccess(invalid),
      new RegExp(`${expectedName} is invalid`),
    );
  }
  assert.equal(service.listAccessDecisions().length, 0);
});

test("security policy denies confidential, restricted, security, and funding escalation", () => {
  const service = new CanopyProofSecurityPolicyService();
  const confidential = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "observer_confidential",
      actorRole: "observer",
      classification: "confidential",
    }),
  );
  const restricted = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "observer_restricted",
      actorRole: "observer",
      classification: "restricted",
      action: "write",
    }),
  );
  const restrictedReview = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "observer_restricted_review",
      actorRole: "observer",
      classification: "restricted",
      action: "review",
    }),
  );
  const restrictedExport = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "observer_restricted_export",
      actorRole: "observer",
      classification: "restricted",
      action: "export",
    }),
  );
  const governanceConflict = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "verifier_governance_conflict",
      actorRole: "verifier",
      purpose: "governance_review",
      conflictStatus: "unresolved",
    }),
  );
  const reportingConflict = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "verifier_reporting_conflict",
      actorRole: "verifier",
      purpose: "institutional_reporting",
      conflictStatus: "unresolved",
    }),
  );
  const securityOperations = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "verifier_security_operations",
      actorRole: "verifier",
      classification: "internal",
      purpose: "security_operations",
      action: "read",
    }),
  );
  const funding = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "verifier_funding",
      actorRole: "verifier",
      resource: "funding",
      resourceId: "funding_critical",
      classification: "internal",
      purpose: "funding_transparency",
      action: "write",
    }),
  );

  assert.equal(
    confidential.reason,
    "role_cannot_access_confidential_resource",
  );
  assert.equal(restricted.reason, "role_cannot_mutate_restricted_resource");
  assert.equal(
    restrictedReview.reason,
    "role_cannot_mutate_restricted_resource",
  );
  assert.equal(
    restrictedExport.reason,
    "role_cannot_mutate_restricted_resource",
  );
  assert.equal(
    governanceConflict.reason,
    "unresolved_conflict_blocks_sensitive_review",
  );
  assert.equal(
    reportingConflict.reason,
    "unresolved_conflict_blocks_sensitive_review",
  );
  assert.equal(
    securityOperations.reason,
    "security_operations_requires_owner_or_admin",
  );
  assert.equal(funding.reason, "funding_write_requires_owner_or_admin");
  assert.ok(
    restricted.requiredControls.includes("restricted_mutation_policy"),
  );
  assert.ok(
    securityOperations.requiredControls.includes("security_operations_role"),
  );
  assert.ok(funding.requiredControls.includes("funding_write_policy"));
});

test("security policy allows privileged scope bypass and deduplicates audited decisions", () => {
  const service = new CanopyProofSecurityPolicyService();
  const input = validAccessInput({
    actorId: "owner_scope_bypass",
    actorRole: "owner",
    actorOrganizationId: undefined,
    resource: "governance",
    resourceId: "governance_critical",
    resourceOrganizationId: "organization_other",
    classification: "public",
    purpose: "public_transparency",
    action: "read",
    conflictStatus: undefined,
    createdAt: undefined,
  });
  const first = service.evaluateAttributeAccess(input);
  const replay = service.evaluateAttributeAccess(input);
  const unscoped = service.evaluateAttributeAccess(
    validAccessInput({
      actorId: "community_unscoped",
      actorRole: "community",
      actorOrganizationId: undefined,
      resourceOrganizationId: undefined,
      classification: "public",
      purpose: "community_verification",
      action: "read",
    }),
  );

  assert.equal(first.allowed, true);
  assert.equal(first.organizationScoped, true);
  assert.equal(first.humanReviewRequired, true);
  assert.equal(first.createdAt, "1970-01-01T00:00:00.000Z");
  assert.equal(replay, first);
  assert.equal(service.listAccessDecisions().length, 2);
  assert.equal(unscoped.organizationScoped, false);
  assert.equal(unscoped.humanReviewRequired, false);
  assert.equal(unscoped.actorOrganizationId, undefined);
  assert.equal(unscoped.resourceOrganizationId, undefined);
});

test("security policy records defaulted authentication and authorization failures", () => {
  const service = new CanopyProofSecurityPolicyService();
  const authentication = service.recordAuthenticationFailure({
    route: "/canopyproof/evidence",
    method: "post",
    configurationInvalid: true,
  });
  const authorization = service.recordAuthorizationFailure({
    actorId: "participant_authorization_default",
    route: "/canopyproof/evidence",
    method: "post",
    registryUnavailable: false,
  });

  assert.equal(
    authentication.reason,
    "authentication_configuration_invalid",
  );
  assert.equal(authentication.severity, "critical");
  assert.match(authentication.actorId, /^unauthenticated_[a-f0-9]{24}$/);
  assert.equal(authentication.method, "POST");
  assert.equal(authorization.reason, "authorization_denied");
  assert.equal(authorization.severity, "high");
  assert.equal(authorization.method, "POST");
  assert.match(authentication.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(authorization.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});
