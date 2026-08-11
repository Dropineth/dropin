import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import {
  CanopyProofSecurityPolicyService,
  defaultCanopyProofSecretControls,
  defaultCanopyProofSecurityPolicies,
  type CanopyProofSecurityPolicy,
} from "../../services/api/src/domain/canopyproof/security-policy.js";

const fixedNow = Date.parse("2026-07-08T00:00:00.000Z");

function actorHeaders(role = "observer", actorId = `${role}_security_test_actor`) {
  return {
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

test("CanopyProof security policy rate-limits without mutating request bodies", () => {
  const policies: CanopyProofSecurityPolicy[] = [
    {
      id: "test-public-read",
      tier: "public_read",
      pathPattern: "/canopyproof/status",
      methods: ["GET"],
      windowMs: 1_000,
      maxRequests: 2,
      actorRequired: false,
    },
  ];
  const service = new CanopyProofSecurityPolicyService(policies);

  const first = service.evaluateRequest({
    path: "/canopyproof/status",
    method: "GET",
    remoteAddress: "203.0.113.10",
    nowMs: fixedNow,
  });
  const second = service.evaluateRequest({
    path: "/canopyproof/status",
    method: "GET",
    remoteAddress: "203.0.113.10",
    nowMs: fixedNow + 1,
  });
  const third = service.evaluateRequest({
    path: "/canopyproof/status",
    method: "GET",
    remoteAddress: "203.0.113.10",
    nowMs: fixedNow + 2,
  });

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.tier, "public_read");
  assert.equal(third.retryAfterSeconds, 1);
  assert.equal(service.listAbuseSignals().length, 1);
  assert.equal(service.listAbuseSignals()[0]?.reason, "rate_limit_exceeded");
});

test("CanopyProof security policy blocks anonymous mutations before domain handlers", () => {
  const service = new CanopyProofSecurityPolicyService();
  const evaluation = service.evaluateRequest({
    path: "/canopyproof/evidence",
    method: "POST",
    nowMs: fixedNow,
  });

  assert.equal(evaluation.allowed, false);
  assert.equal(evaluation.tier, "mutation");
  assert.equal(service.listAbuseSignals().length, 1);
  assert.equal(service.listAbuseSignals()[0]?.reason, "anonymous_mutation");
  assert.equal(service.getStatus().safety.rbacRequiredForMutations, true);
  assert.match(service.getStatus().abuseRoot, /^[a-f0-9]{64}$/);
});

test("CanopyProof security policy prefers high-risk proof issuance limits over generic mutation limits", () => {
  const service = new CanopyProofSecurityPolicyService();
  const evaluation = service.evaluateRequest({
    path: "/canopyproof/proof-records",
    method: "POST",
    actorId: "verifier_high_risk_test",
    nowMs: fixedNow,
  });

  assert.equal(evaluation.allowed, true);
  assert.equal(evaluation.policy.id, "canopyproof-high-risk-mutation");
  assert.equal(evaluation.tier, "high_risk_mutation");
  assert.equal(evaluation.policy.maxRequests, 30);
});

test("CanopyProof security policy exposes deterministic unsafe-claim abuse roots", () => {
  const service = new CanopyProofSecurityPolicyService();
  const signal = service.recordUnsafeClaim("verifier_unsafe_claim", "/canopyproof/proof-records", "POST", "2026-07-08T00:00:00.000Z");
  const status = service.getStatus();

  assert.equal(signal.reason, "unsafe_claim");
  assert.equal(signal.severity, "critical");
  assert.equal(signal.auditEvent.action, "CHALLENGE");
  assert.equal(status.abuseSignalCount, 1);
  assert.match(status.abuseRoot, /^[a-f0-9]{64}$/);
});

test("CanopyProof security policy records identity failures without storing network identity", () => {
  const service = new CanopyProofSecurityPolicyService();
  const signal = service.recordAuthenticationFailure({
    route: "/canopyproof/evidence",
    method: "POST",
    remoteAddress: "203.0.113.44",
    configurationInvalid: false,
    createdAt: "2026-07-10T00:00:00.000Z",
  });
  const serialized = JSON.stringify(signal);

  assert.equal(signal.reason, "invalid_identity_assertion");
  assert.equal(signal.severity, "high");
  assert.match(signal.actorId, /^unauthenticated_[a-f0-9]{24}$/);
  assert.equal(signal.auditEvent.action, "CHALLENGE");
  assert.doesNotMatch(serialized, /203\.0\.113\.44/);
});

test("CanopyProof security policy records durable authorization denial without token material", () => {
  const service = new CanopyProofSecurityPolicyService();
  const denied = service.recordAuthorizationFailure({
    actorId: "participant_revoked_membership_001",
    route: "/canopyproof/proof-records",
    method: "POST",
    registryUnavailable: false,
    createdAt: "2026-07-10T00:00:00.000Z",
  });
  const unavailable = service.recordAuthorizationFailure({
    actorId: "participant_registry_outage_001",
    route: "/canopyproof/governance/approvals",
    method: "POST",
    registryUnavailable: true,
    createdAt: "2026-07-10T00:01:00.000Z",
  });
  const serialized = JSON.stringify(service.listAbuseSignals());

  assert.equal(denied.reason, "authorization_denied");
  assert.equal(denied.severity, "high");
  assert.equal(unavailable.reason, "authorization_registry_unavailable");
  assert.equal(unavailable.severity, "critical");
  assert.doesNotMatch(serialized, /jwt|bearer|postgresql:\/\//i);
});

test("CanopyProof security policy reports secret posture without exposing values", () => {
  const service = new CanopyProofSecurityPolicyService();
  const databaseUrlFixture =
    "postgresql://dropin:" + "super-secret@db.internal:5432/dropin_earth";
  const secretEnvironment = {
    DATABASE_URL: databaseUrlFixture,
    CLOUDFLARE_API_TOKEN: "cf-token-that-must-not-appear",
    CLOUDFLARE_ACCOUNT_ID: "account-id-that-must-not-appear",
    DROPIN_API_ORIGIN: "https://api.internal.example",
  };
  const posture = service.getSecretPosture(secretEnvironment);
  const serialized = JSON.stringify(posture);

  assert.equal(posture.service, "canopyproof-secret-posture");
  assert.equal(posture.requiredSecretCount, defaultCanopyProofSecretControls().filter((control) => control.required).length);
  assert.equal(posture.configuredRequiredSecretCount, posture.requiredSecretCount);
  assert.deepEqual(posture.missingRequiredSecretIds, []);
  assert.equal(posture.safety.noSecretValuesExposed, true);
  assert.equal(posture.safety.privateKeyHandlingDisabled, true);
  assert.ok(posture.controls.every((control) => control.exposure === "presence_only" && control.valueExposed === false));
  assert.doesNotMatch(serialized, /super-secret|cf-token-that-must-not-appear|account-id-that-must-not-appear|https:\/\/api\.internal\.example/);

  const missing = service.getSecretPosture({});
  assert.ok(missing.missingRequiredSecretIds.includes("canopyproof-database-url"));
  assert.match(missing.postureRoot, /^[a-f0-9]{64}$/);
});

test("CanopyProof security policy records audited attribute access decisions", () => {
  const service = new CanopyProofSecurityPolicyService();
  const organizationDenied = service.evaluateAttributeAccess({
    actorId: "researcher_abac_org_mismatch",
    actorRole: "researcher",
    actorOrganizationId: "org_research",
    resource: "evidence",
    resourceId: "ev_abac_org",
    resourceOrganizationId: "org_field",
    classification: "restricted",
    purpose: "evidence_review",
    action: "review",
    createdAt: "2026-07-08T00:00:00.000Z",
  });
  const conflictDenied = service.evaluateAttributeAccess({
    actorId: "verifier_abac_conflict",
    actorRole: "verifier",
    actorOrganizationId: "org_field",
    resource: "certificate",
    resourceId: "cert_abac_conflict",
    resourceOrganizationId: "org_field",
    classification: "restricted",
    purpose: "proof_issuance",
    action: "review",
    conflictStatus: "unresolved",
    createdAt: "2026-07-08T00:01:00.000Z",
  });
  const approvedExport = service.evaluateAttributeAccess({
    actorId: "verifier_abac_export",
    actorRole: "verifier",
    actorOrganizationId: "org_field",
    resource: "certificate",
    resourceId: "cert_abac_export",
    resourceOrganizationId: "org_field",
    classification: "confidential",
    purpose: "institutional_reporting",
    action: "export",
    conflictStatus: "cleared",
    hasGovernanceApproval: true,
    createdAt: "2026-07-08T00:02:00.000Z",
  });
  const status = service.getStatus();

  assert.equal(organizationDenied.allowed, false);
  assert.equal(organizationDenied.reason, "organization_scope_mismatch");
  assert.equal(organizationDenied.auditEvent.entityType, "access_decision");
  assert.equal(organizationDenied.auditEvent.action, "CHALLENGE");
  assert.ok(organizationDenied.requiredControls.includes("organization_scope"));

  assert.equal(conflictDenied.allowed, false);
  assert.equal(conflictDenied.reason, "unresolved_conflict_blocks_sensitive_review");
  assert.equal(conflictDenied.auditEvent.action, "CHALLENGE");
  assert.ok(conflictDenied.requiredControls.includes("conflict_disclosure_clearance"));

  assert.equal(approvedExport.allowed, true);
  assert.equal(approvedExport.reason, "allowed_by_attribute_policy");
  assert.equal(approvedExport.auditEvent.action, "ASSERT");
  assert.equal(approvedExport.humanReviewRequired, true);
  assert.ok(approvedExport.requiredControls.includes("confidential_data_policy"));
  assert.ok(approvedExport.requiredControls.includes("governance_approval"));

  assert.equal(status.attributeAccess.enabled, true);
  assert.equal(status.attributeAccess.decisionCount, 3);
  assert.equal(status.safety.attributeAccessEnabled, true);
  assert.equal(status.attributeAccess.safety.organizationScopeEnforced, true);
  assert.match(status.attributeAccess.decisionRoot, /^[a-f0-9]{64}$/);
});

test("CanopyProof API emits rate-limit headers on public status and protects security status with RBAC", async () => {
  const publicStatus = await app.request("/canopyproof/status", {
    method: "GET",
    headers: {
      "cf-connecting-ip": "203.0.113.20",
    },
  });

  assert.equal(publicStatus.status, 200);
  assert.equal(publicStatus.headers.get("x-ratelimit-limit"), "600");
  assert.ok(Number(publicStatus.headers.get("x-ratelimit-remaining")) >= 0);
  assert.match(publicStatus.headers.get("x-ratelimit-reset") ?? "", /^\d{4}-\d{2}-\d{2}T/);

  const deniedStatus = await app.request("/canopyproof/security/status", {
    method: "GET",
    headers: {
      "cf-connecting-ip": "203.0.113.21",
    },
  });
  const deniedBody = (await deniedStatus.json()) as { ok: false; error: string };

  assert.equal(deniedStatus.status, 401);
  assert.equal(deniedBody.ok, false);
  assert.equal(deniedBody.error, "CANOPYPROOF_AUTH_REQUIRED");
});

test("CanopyProof API rejects anonymous mutations at the security policy boundary", async () => {
  const response = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify({ id: "anonymous_policy_block" }),
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.22",
    },
  });
  const body = (await response.json()) as { ok: false; error: string };

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, "CANOPYPROOF_AUTH_REQUIRED");
});

test("CanopyProof API surfaces security status to authorized observers", async () => {
  const response = await app.request("/canopyproof/security/status", {
    method: "GET",
    headers: actorHeaders("observer", "observer_security_status"),
  });
  const body = (await response.json()) as {
    ok: true;
    data: {
      service: string;
      policyCount: number;
      safety: { rateLimitsEnabled: true; abusePreventionEnabled: true; secretsManaged: true; privateKeyHandlingDisabled: true };
      secretPosture: {
        service: string;
        controls: Array<{ envName: string; configured: boolean; valueExposed: false }>;
        safety: { noSecretValuesExposed: true; presenceOnlyReporting: true };
        postureRoot: string;
      };
      authentication: {
        service: string;
        mode: string;
        configured: boolean;
        safety: { rawActorHeadersRejectedInProduction: true; privateKeyHandlingDisabled: true };
      };
      authorization: {
        service: string;
        mode: string;
        configured: boolean;
        databaseConfigured: boolean;
        safety: { membershipRevocationChecked: true; latestAccreditationChecked: true };
      };
      policies: Array<{ id: string }>;
    };
  };
  const serialized = JSON.stringify(body.data);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-ratelimit-limit"), "600");
  assert.equal(body.data.service, "canopyproof-security-policy");
  assert.equal(body.data.policyCount, defaultCanopyProofSecurityPolicies().length);
  assert.equal(body.data.safety.rateLimitsEnabled, true);
  assert.equal(body.data.safety.abusePreventionEnabled, true);
  assert.equal(body.data.safety.secretsManaged, true);
  assert.equal(body.data.safety.privateKeyHandlingDisabled, true);
  assert.equal(body.data.secretPosture.service, "canopyproof-secret-posture");
  assert.equal(body.data.secretPosture.safety.noSecretValuesExposed, true);
  assert.equal(body.data.secretPosture.safety.presenceOnlyReporting, true);
  assert.match(body.data.secretPosture.postureRoot, /^[a-f0-9]{64}$/);
  assert.ok(body.data.secretPosture.controls.some((control) => control.envName === "DATABASE_URL"));
  assert.ok(body.data.secretPosture.controls.every((control) => control.valueExposed === false));
  assert.equal(body.data.authentication.service, "canopyproof-identity-authentication");
  assert.equal(body.data.authentication.mode, "development_headers");
  assert.equal(body.data.authentication.configured, true);
  assert.equal(body.data.authentication.safety.rawActorHeadersRejectedInProduction, true);
  assert.equal(body.data.authentication.safety.privateKeyHandlingDisabled, true);
  assert.equal(body.data.authorization.service, "canopyproof-authorization-binding");
  assert.equal(body.data.authorization.mode, "development_isolation");
  assert.equal(body.data.authorization.configured, true);
  assert.equal(body.data.authorization.safety.membershipRevocationChecked, true);
  assert.equal(body.data.authorization.safety.latestAccreditationChecked, true);
  assert.doesNotMatch(serialized, /postgres:\/\/|postgresql:\/\/|BEGIN PRIVATE KEY|cf-token|super-secret/);
  assert.ok(body.data.policies.some((policy) => policy.id === "canopyproof-high-risk-mutation"));
});

test("CanopyProof API records attribute decisions without trusting actor fields from the body", async () => {
  const deniedResponse = await app.request("/canopyproof/security/access-decisions", {
    method: "POST",
    body: JSON.stringify({
      actorId: "owner_impersonation_attempt",
      actorRole: "owner",
      resource: "certificate",
      resourceId: "cert_route_abac_denied",
      resourceOrganizationId: "org_route",
      classification: "confidential",
      purpose: "institutional_reporting",
      action: "export",
      hasGovernanceApproval: false,
      createdAt: "2026-07-08T00:03:00.000Z",
    }),
    headers: {
      ...actorHeaders("verifier", "verifier_route_abac"),
      "content-type": "application/json",
      "x-dropin-organization-id": "org_route",
    },
  });
  const deniedBody = (await deniedResponse.json()) as {
    ok: true;
    data: { actorId: string; actorRole: string; allowed: boolean; reason: string; auditEvent: { action: string; entityType: string } };
  };

  assert.equal(deniedResponse.status, 202);
  assert.equal(deniedBody.data.actorId, "verifier_route_abac");
  assert.equal(deniedBody.data.actorRole, "verifier");
  assert.equal(deniedBody.data.allowed, false);
  assert.equal(deniedBody.data.reason, "confidential_export_requires_governance_approval");
  assert.equal(deniedBody.data.auditEvent.action, "CHALLENGE");
  assert.equal(deniedBody.data.auditEvent.entityType, "access_decision");

  const approvedResponse = await app.request("/canopyproof/security/access-decisions", {
    method: "POST",
    body: JSON.stringify({
      resource: "certificate",
      resourceId: "cert_route_abac_approved",
      resourceOrganizationId: "org_route",
      classification: "confidential",
      purpose: "institutional_reporting",
      action: "export",
      conflictStatus: "cleared",
      hasGovernanceApproval: true,
      createdAt: "2026-07-08T00:04:00.000Z",
    }),
    headers: {
      ...actorHeaders("verifier", "verifier_route_abac"),
      "content-type": "application/json",
      "x-dropin-organization-id": "org_route",
    },
  });
  const approvedBody = (await approvedResponse.json()) as {
    ok: true;
    data: { allowed: boolean; reason: string; requiredControls: string[]; auditEvent: { action: string } };
  };

  assert.equal(approvedResponse.status, 201);
  assert.equal(approvedBody.data.allowed, true);
  assert.equal(approvedBody.data.reason, "allowed_by_attribute_policy");
  assert.equal(approvedBody.data.auditEvent.action, "ASSERT");
  assert.ok(approvedBody.data.requiredControls.includes("governance_approval"));
});
