import { hashJson } from "@dropin/crypto";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export type CanopyProofSecurityTier = "public_read" | "authenticated_read" | "mutation" | "high_risk_mutation";

export type CanopyProofSecurityPolicy = {
  readonly id: string;
  readonly tier: CanopyProofSecurityTier;
  readonly pathPattern: string;
  readonly methods: readonly string[];
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly actorRequired: boolean;
};

export type CanopyProofSecretControlSource =
  | "github_environment_secret"
  | "cloudflare_worker_secret"
  | "kubernetes_secret"
  | "external_vault";

export type CanopyProofSecretControl = {
  readonly id: string;
  readonly envName: string;
  readonly source: CanopyProofSecretControlSource;
  readonly required: boolean;
  readonly purpose: string;
  readonly rotationDays: number;
  readonly exposure: "presence_only";
};

export type CanopyProofSecretControlStatus = CanopyProofSecretControl & {
  readonly configured: boolean;
  readonly valueExposed: false;
};

export type CanopyProofSecretPosture = {
  readonly service: "canopyproof-secret-posture";
  readonly requiredSecretCount: number;
  readonly configuredRequiredSecretCount: number;
  readonly missingRequiredSecretIds: readonly string[];
  readonly controls: readonly CanopyProofSecretControlStatus[];
  readonly approvedSources: readonly CanopyProofSecretControlSource[];
  readonly safety: {
    readonly noSecretValuesExposed: true;
    readonly presenceOnlyReporting: true;
    readonly approvedSecretStoresOnly: true;
    readonly rotationPolicyDefined: true;
    readonly privateKeyHandlingDisabled: true;
  };
  readonly postureRoot: string;
};

export const canopyProofAccessRoles = ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"] as const;
export const canopyProofAccessResources = [
  "evidence",
  "certificate",
  "funding",
  "governance",
  "reporting",
  "memory",
  "security",
  "terra_scene",
  "risk_alert",
] as const;
export const canopyProofAccessClassifications = ["public", "internal", "restricted", "confidential"] as const;
export const canopyProofAccessPurposes = [
  "public_transparency",
  "community_verification",
  "evidence_review",
  "proof_issuance",
  "governance_review",
  "institutional_reporting",
  "funding_transparency",
  "security_operations",
  "research",
] as const;
export const canopyProofAccessActions = ["read", "write", "review", "export"] as const;
export const canopyProofConflictStatuses = ["none", "cleared", "unresolved"] as const;

export type CanopyProofAccessRole = (typeof canopyProofAccessRoles)[number];
export type CanopyProofAccessResource = (typeof canopyProofAccessResources)[number];
export type CanopyProofAccessClassification = (typeof canopyProofAccessClassifications)[number];
export type CanopyProofAccessPurpose = (typeof canopyProofAccessPurposes)[number];
export type CanopyProofAccessAction = (typeof canopyProofAccessActions)[number];
export type CanopyProofConflictStatus = (typeof canopyProofConflictStatuses)[number];

export type CanopyProofAttributeAccessInput = {
  readonly actorId: string;
  readonly actorRole: CanopyProofAccessRole;
  readonly actorOrganizationId?: string;
  readonly resource: CanopyProofAccessResource;
  readonly resourceId: string;
  readonly resourceOrganizationId?: string;
  readonly classification: CanopyProofAccessClassification;
  readonly purpose: CanopyProofAccessPurpose;
  readonly action: CanopyProofAccessAction;
  readonly conflictStatus?: CanopyProofConflictStatus;
  readonly hasGovernanceApproval?: boolean;
  readonly createdAt?: string;
};

export type CanopyProofAttributeAccessDecision = {
  readonly id: string;
  readonly actorId: string;
  readonly actorRole: CanopyProofAccessRole;
  readonly actorOrganizationId?: string;
  readonly resource: CanopyProofAccessResource;
  readonly resourceId: string;
  readonly resourceOrganizationId?: string;
  readonly classification: CanopyProofAccessClassification;
  readonly purpose: CanopyProofAccessPurpose;
  readonly action: CanopyProofAccessAction;
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredControls: readonly string[];
  readonly organizationScoped: boolean;
  readonly humanReviewRequired: boolean;
  readonly createdAt: string;
  readonly decisionRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofAttributeAccessStatus = {
  readonly enabled: true;
  readonly decisionCount: number;
  readonly decisionRoot: string;
  readonly resources: readonly CanopyProofAccessResource[];
  readonly classifications: readonly CanopyProofAccessClassification[];
  readonly purposes: readonly CanopyProofAccessPurpose[];
  readonly actions: readonly CanopyProofAccessAction[];
  readonly safety: {
    readonly organizationScopeEnforced: true;
    readonly confidentialExportRequiresGovernanceApproval: true;
    readonly unresolvedConflictsBlockSensitiveReview: true;
    readonly decisionsAudited: true;
  };
};

export type CanopyProofSecurityEvaluation = {
  readonly allowed: boolean;
  readonly tier: CanopyProofSecurityTier;
  readonly key: string;
  readonly remaining: number;
  readonly resetAt: string;
  readonly retryAfterSeconds: number;
  readonly policy: CanopyProofSecurityPolicy;
};

export type CanopyProofAbuseSignal = {
  readonly id: string;
  readonly actorId: string;
  readonly route: string;
  readonly method: string;
  readonly reason:
    | "rate_limit_exceeded"
    | "anonymous_mutation"
    | "invalid_identity_assertion"
    | "authentication_configuration_invalid"
    | "authorization_denied"
    | "authorization_registry_unavailable"
    | "unsafe_claim";
  readonly severity: "medium" | "high" | "critical";
  readonly createdAt: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofSecurityStatus = {
  readonly service: "canopyproof-security-policy";
  readonly policyCount: number;
  readonly abuseSignalCount: number;
  readonly activeBucketCount: number;
  readonly policies: readonly CanopyProofSecurityPolicy[];
  readonly safety: {
    readonly rbacRequiredForMutations: true;
    readonly rateLimitsEnabled: true;
    readonly abusePreventionEnabled: true;
    readonly unsafeClaimsBlocked: true;
    readonly secretsManaged: true;
    readonly privateKeyHandlingDisabled: true;
    readonly attributeAccessEnabled: true;
  };
  readonly secretPosture: CanopyProofSecretPosture;
  readonly attributeAccess: CanopyProofAttributeAccessStatus;
  readonly policyRoot: string;
  readonly abuseRoot: string;
};

type Bucket = {
  count: number;
  resetAtMs: number;
};

export type CanopyProofSecurityRequest = {
  readonly path: string;
  readonly method: string;
  readonly actorId?: string;
  readonly remoteAddress?: string;
  readonly nowMs?: number;
};

export class CanopyProofSecurityPolicyService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly abuseSignalsById = new Map<string, CanopyProofAbuseSignal>();
  private readonly accessDecisionsById = new Map<string, CanopyProofAttributeAccessDecision>();

  constructor(private readonly policies: readonly CanopyProofSecurityPolicy[] = defaultCanopyProofSecurityPolicies()) {}

  evaluateRequest(request: CanopyProofSecurityRequest): CanopyProofSecurityEvaluation {
    const method = request.method.toUpperCase();
    const policy = this.policyFor(request.path, method);
    const nowMs = request.nowMs ?? Date.now();
    const actorOrAddress = request.actorId?.trim() || request.remoteAddress?.trim() || "anonymous";
    const key = `${policy.id}:${actorOrAddress}`;
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAtMs <= nowMs ? { count: 0, resetAtMs: nowMs + policy.windowMs } : current;

    if (policy.actorRequired && actorOrAddress === "anonymous") {
      this.recordAbuseSignal({
        actorId: "anonymous",
        route: request.path,
        method,
        reason: "anonymous_mutation",
        severity: "high",
        createdAt: new Date(nowMs).toISOString(),
      });
      return {
        allowed: false,
        tier: policy.tier,
        key,
        remaining: 0,
        resetAt: new Date(bucket.resetAtMs).toISOString(),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000)),
        policy,
      };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
    const remaining = Math.max(0, policy.maxRequests - bucket.count);
    const allowed = bucket.count <= policy.maxRequests;
    if (!allowed) {
      this.recordAbuseSignal({
        actorId: actorOrAddress,
        route: request.path,
        method,
        reason: "rate_limit_exceeded",
        severity: policy.tier === "high_risk_mutation" ? "high" : "medium",
        createdAt: new Date(nowMs).toISOString(),
      });
    }

    return {
      allowed,
      tier: policy.tier,
      key,
      remaining,
      resetAt: new Date(bucket.resetAtMs).toISOString(),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000)),
      policy,
    };
  }

  recordUnsafeClaim(actorId: string, route: string, method: string, createdAt = new Date(0).toISOString()) {
    return this.recordAbuseSignal({
      actorId,
      route,
      method,
      reason: "unsafe_claim",
      severity: "critical",
      createdAt,
    });
  }

  recordAuthenticationFailure(input: Readonly<{
    route: string;
    method: string;
    remoteAddress?: string;
    configurationInvalid: boolean;
    createdAt?: string;
  }>) {
    const sourceFingerprint = hashJson({
      kind: "canopyproof-unauthenticated-source-v1",
      source: input.remoteAddress?.trim() || "unknown",
    }).slice(0, 24);
    return this.recordAbuseSignal({
      actorId: `unauthenticated_${sourceFingerprint}`,
      route: input.route,
      method: input.method,
      reason: input.configurationInvalid ? "authentication_configuration_invalid" : "invalid_identity_assertion",
      severity: input.configurationInvalid ? "critical" : "high",
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  recordAuthorizationFailure(input: Readonly<{
    actorId: string;
    route: string;
    method: string;
    registryUnavailable: boolean;
    createdAt?: string;
  }>) {
    return this.recordAbuseSignal({
      actorId: input.actorId,
      route: input.route,
      method: input.method,
      reason: input.registryUnavailable ? "authorization_registry_unavailable" : "authorization_denied",
      severity: input.registryUnavailable ? "critical" : "high",
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  listAbuseSignals() {
    return [...this.abuseSignalsById.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  evaluateAttributeAccess(input: CanopyProofAttributeAccessInput): CanopyProofAttributeAccessDecision {
    const actorId = input.actorId.trim();
    if (!actorId) {
      throw new Error("CanopyProof access decision requires an accountable actor.");
    }
    const actorRole = requireOneOf(input.actorRole, canopyProofAccessRoles, "actorRole");
    const resource = requireOneOf(input.resource, canopyProofAccessResources, "resource");
    const classification = requireOneOf(input.classification, canopyProofAccessClassifications, "classification");
    const purpose = requireOneOf(input.purpose, canopyProofAccessPurposes, "purpose");
    const action = requireOneOf(input.action, canopyProofAccessActions, "action");
    const conflictStatus = requireOneOf(input.conflictStatus ?? "none", canopyProofConflictStatuses, "conflictStatus");
    const createdAt = input.createdAt ?? new Date(0).toISOString();
    const resourceId = input.resourceId.trim();
    if (!resourceId) {
      throw new Error("CanopyProof access decision requires a resource ID.");
    }
    const actorOrganizationId = input.actorOrganizationId?.trim();
    const resourceOrganizationId = input.resourceOrganizationId?.trim();
    const organizationScoped = Boolean(resourceOrganizationId);
    const requiredControls = new Set<string>(["rbac", "audit_decision"]);
    let allowed = true;
    let reason = "allowed_by_attribute_policy";

    if (organizationScoped) {
      requiredControls.add("organization_scope");
      if (!canBypassOrganizationScope(actorRole) && actorOrganizationId !== resourceOrganizationId) {
        allowed = false;
        reason = "organization_scope_mismatch";
      }
    }

    if (allowed && conflictStatus === "unresolved" && sensitiveReviewPurpose(purpose)) {
      requiredControls.add("conflict_disclosure_clearance");
      allowed = false;
      reason = "unresolved_conflict_blocks_sensitive_review";
    }

    if (allowed && classification === "confidential") {
      requiredControls.add("confidential_data_policy");
      if (!confidentialAccessRoles.has(actorRole)) {
        allowed = false;
        reason = "role_cannot_access_confidential_resource";
      } else if (action === "export") {
        requiredControls.add("governance_approval");
        if (!input.hasGovernanceApproval) {
          allowed = false;
          reason = "confidential_export_requires_governance_approval";
        }
      }
    }

    if (allowed && classification === "restricted" && sensitiveWriteAction(action) && !restrictedMutationRoles.has(actorRole)) {
      requiredControls.add("restricted_mutation_policy");
      allowed = false;
      reason = "role_cannot_mutate_restricted_resource";
    }

    if (allowed && purpose === "security_operations" && !securityOperationRoles.has(actorRole)) {
      requiredControls.add("security_operations_role");
      allowed = false;
      reason = "security_operations_requires_owner_or_admin";
    }

    if (allowed && resource === "funding" && action === "write" && !fundingWriteRoles.has(actorRole)) {
      requiredControls.add("funding_write_policy");
      allowed = false;
      reason = "funding_write_requires_owner_or_admin";
    }

    const humanReviewRequired =
      classification === "restricted" ||
      classification === "confidential" ||
      resource === "certificate" ||
      resource === "governance" ||
      purpose === "proof_issuance";
    const decisionSeed = {
      actorId,
      actorRole,
      actorOrganizationId,
      resource,
      resourceId,
      resourceOrganizationId,
      classification,
      purpose,
      action,
      conflictStatus,
      hasGovernanceApproval: Boolean(input.hasGovernanceApproval),
      allowed,
      reason,
      requiredControls: [...requiredControls].sort(),
      organizationScoped,
      humanReviewRequired,
      createdAt,
    };
    const decisionRoot = hashJson({ kind: "canopyproof-attribute-access-decision-v1", ...decisionSeed });
    const id = `cp_access_${decisionRoot.slice(0, 24)}`;
    const existing = this.accessDecisionsById.get(id);
    if (existing) {
      return existing;
    }
    const auditEvent = appendCanopyProofAuditEvent(this.listAccessDecisions().map((decision) => decision.auditEvent), {
      action: allowed ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "access_decision",
      entityId: id,
      payload: decisionSeed,
      createdAt,
      rationale: `CanopyProof ABAC decision ${reason}.`,
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof access decision failed to append audit event.");
    }
    const decision: CanopyProofAttributeAccessDecision = {
      id,
      actorId,
      actorRole,
      ...(actorOrganizationId ? { actorOrganizationId } : {}),
      resource,
      resourceId,
      ...(resourceOrganizationId ? { resourceOrganizationId } : {}),
      classification,
      purpose,
      action,
      allowed,
      reason,
      requiredControls: [...requiredControls].sort(),
      organizationScoped,
      humanReviewRequired,
      createdAt,
      decisionRoot,
      auditEvent,
    };
    this.accessDecisionsById.set(decision.id, decision);
    return decision;
  }

  listAccessDecisions() {
    return [...this.accessDecisionsById.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  getAttributeAccessStatus(): CanopyProofAttributeAccessStatus {
    const decisions = this.listAccessDecisions();
    return {
      enabled: true,
      decisionCount: decisions.length,
      decisionRoot:
        decisions.length > 0
          ? hashJson({ kind: "canopyproof-access-decision-root-v1", roots: decisions.map((decision) => decision.decisionRoot).sort() })
          : hashJson({ kind: "canopyproof-empty-access-decision-root-v1" }),
      resources: canopyProofAccessResources,
      classifications: canopyProofAccessClassifications,
      purposes: canopyProofAccessPurposes,
      actions: canopyProofAccessActions,
      safety: {
        organizationScopeEnforced: true,
        confidentialExportRequiresGovernanceApproval: true,
        unresolvedConflictsBlockSensitiveReview: true,
        decisionsAudited: true,
      },
    };
  }

  getSecretPosture(secretEnvironment: Readonly<Record<string, string | undefined>> = {}): CanopyProofSecretPosture {
    const controls = defaultCanopyProofSecretControls();
    const controlStatuses = controls.map((control) => ({
      ...control,
      configured: Boolean(secretEnvironment[control.envName]?.trim()),
      valueExposed: false as const,
    }));
    const missingRequiredSecretIds = controlStatuses.filter((control) => control.required && !control.configured).map((control) => control.id).sort();
    const approvedSources: readonly CanopyProofSecretControlSource[] = [
      "github_environment_secret",
      "cloudflare_worker_secret",
      "kubernetes_secret",
      "external_vault",
    ] as const;
    return {
      service: "canopyproof-secret-posture",
      requiredSecretCount: controlStatuses.filter((control) => control.required).length,
      configuredRequiredSecretCount: controlStatuses.filter((control) => control.required && control.configured).length,
      missingRequiredSecretIds,
      controls: controlStatuses,
      approvedSources,
      safety: {
        noSecretValuesExposed: true,
        presenceOnlyReporting: true,
        approvedSecretStoresOnly: true,
        rotationPolicyDefined: true,
        privateKeyHandlingDisabled: true,
      },
      postureRoot: hashJson({
        kind: "canopyproof-secret-posture-v1",
        controls: controlStatuses.map((control) => ({
          id: control.id,
          envName: control.envName,
          source: control.source,
          required: control.required,
          purpose: control.purpose,
          rotationDays: control.rotationDays,
          exposure: control.exposure,
          configured: control.configured,
          valueExposed: control.valueExposed,
        })),
        missingRequiredSecretIds,
      }),
    };
  }

  getStatus(secretEnvironment: Readonly<Record<string, string | undefined>> = {}): CanopyProofSecurityStatus {
    const policies = [...this.policies].sort((left, right) => left.id.localeCompare(right.id));
    const abuseSignals = this.listAbuseSignals();
    const secretPosture = this.getSecretPosture(secretEnvironment);
    const attributeAccess = this.getAttributeAccessStatus();
    return {
      service: "canopyproof-security-policy",
      policyCount: policies.length,
      abuseSignalCount: abuseSignals.length,
      activeBucketCount: this.buckets.size,
      policies,
      safety: {
        rbacRequiredForMutations: true,
        rateLimitsEnabled: true,
        abusePreventionEnabled: true,
        unsafeClaimsBlocked: true,
        secretsManaged: true,
        privateKeyHandlingDisabled: true,
        attributeAccessEnabled: true,
      },
      secretPosture,
      attributeAccess,
      policyRoot: hashJson({ kind: "canopyproof-security-policy-root-v1", policies }),
      abuseRoot: hashJson({
        kind: "canopyproof-abuse-root-v1",
        abuseEventRoots: abuseSignals.map((signal) => signal.auditEvent.eventRoot).sort(),
      }),
    };
  }

  private policyFor(path: string, method: string): CanopyProofSecurityPolicy {
    const matched = this.policies.find((policy) => policy.methods.includes(method) && pathMatches(policy.pathPattern, path));
    if (matched) {
      return matched;
    }
    const fallbackId = method === "GET" || method === "HEAD" ? "canopyproof-authenticated-read" : "canopyproof-mutation";
    const fallback =
      this.policies.find((policy) => policy.id === fallbackId) ?? defaultCanopyProofSecurityPolicies().find((policy) => policy.id === fallbackId);
    if (!fallback) {
      throw new Error(`CanopyProof security policy fallback ${fallbackId} is not configured.`);
    }
    return fallback;
  }

  private recordAbuseSignal(input: Omit<CanopyProofAbuseSignal, "id" | "auditEvent">) {
    const signalSeed = {
      actorId: input.actorId,
      route: input.route,
      method: input.method.toUpperCase(),
      reason: input.reason,
      severity: input.severity,
      createdAt: input.createdAt,
    };
    const signalRoot = hashJson({ kind: "canopyproof-abuse-signal-v1", ...signalSeed });
    const signalId = `cp_abuse_${signalRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "CHALLENGE",
      actor: input.actorId,
      entityType: "abuse_signal",
      entityId: signalId,
      payload: signalSeed,
      createdAt: input.createdAt,
      rationale: `CanopyProof security policy recorded ${input.reason}.`,
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof abuse signal failed to append audit event.");
    }
    const signal: CanopyProofAbuseSignal = {
      id: signalId,
      actorId: input.actorId,
      route: input.route,
      method: input.method.toUpperCase(),
      reason: input.reason,
      severity: input.severity,
      createdAt: input.createdAt,
      auditEvent,
    };
    this.abuseSignalsById.set(signal.id, signal);
    return signal;
  }
}

export function defaultCanopyProofSecretControls(): readonly CanopyProofSecretControl[] {
  return [
    {
      id: "canopyproof-database-url",
      envName: "DATABASE_URL",
      source: "kubernetes_secret",
      required: true,
      purpose: "PostgreSQL connection string for durable audit, evidence, and governance state.",
      rotationDays: 90,
      exposure: "presence_only",
    },
    {
      id: "canopyproof-cloudflare-api-token",
      envName: "CLOUDFLARE_API_TOKEN",
      source: "github_environment_secret",
      required: true,
      purpose: "Guarded production workflow token used only by approved deployment automation.",
      rotationDays: 60,
      exposure: "presence_only",
    },
    {
      id: "canopyproof-cloudflare-account-id",
      envName: "CLOUDFLARE_ACCOUNT_ID",
      source: "github_environment_secret",
      required: true,
      purpose: "Cloudflare account binding used by guarded deployment automation.",
      rotationDays: 180,
      exposure: "presence_only",
    },
    {
      id: "canopyproof-api-origin",
      envName: "DROPIN_API_ORIGIN",
      source: "cloudflare_worker_secret",
      required: true,
      purpose: "HTTPS API origin consumed by the public Cloudflare API proxy.",
      rotationDays: 90,
      exposure: "presence_only",
    },
    {
      id: "canopyproof-slack-webhook",
      envName: "SLACK_WEBHOOK_URL",
      source: "github_environment_secret",
      required: false,
      purpose: "Optional deployment and incident notification channel.",
      rotationDays: 90,
      exposure: "presence_only",
    },
  ] as const;
}

export function defaultCanopyProofSecurityPolicies(): readonly CanopyProofSecurityPolicy[] {
  return [
    {
      id: "canopyproof-public-read",
      tier: "public_read",
      pathPattern: "/canopyproof/*/status",
      methods: ["GET", "HEAD"],
      windowMs: 60_000,
      maxRequests: 600,
      actorRequired: false,
    },
    {
      id: "canopyproof-authenticated-read",
      tier: "authenticated_read",
      pathPattern: "/canopyproof/*",
      methods: ["GET", "HEAD"],
      windowMs: 60_000,
      maxRequests: 300,
      actorRequired: false,
    },
    {
      id: "canopyproof-high-risk-mutation",
      tier: "high_risk_mutation",
      pathPattern: "/canopyproof/proof-records",
      methods: ["POST"],
      windowMs: 60_000,
      maxRequests: 30,
      actorRequired: true,
    },
    {
      id: "canopyproof-mutation",
      tier: "mutation",
      pathPattern: "/canopyproof/*",
      methods: ["POST", "PATCH", "PUT", "DELETE"],
      windowMs: 60_000,
      maxRequests: 120,
      actorRequired: true,
    },
  ];
}

function pathMatches(pattern: string, path: string) {
  if (pattern.endsWith("/*")) {
    return path === pattern.slice(0, -2) || path.startsWith(pattern.slice(0, -1));
  }
  if (pattern.includes("*")) {
    const [prefix, suffix] = pattern.split("*");
    return path.startsWith(prefix ?? "") && path.endsWith(suffix ?? "");
  }
  return path === pattern;
}

const confidentialAccessRoles = new Set<CanopyProofAccessRole>(["owner", "admin", "verifier", "researcher"]);
const restrictedMutationRoles = new Set<CanopyProofAccessRole>(["owner", "admin", "verifier", "researcher"]);
const securityOperationRoles = new Set<CanopyProofAccessRole>(["owner", "admin"]);
const fundingWriteRoles = new Set<CanopyProofAccessRole>(["owner", "admin"]);

function canBypassOrganizationScope(role: CanopyProofAccessRole) {
  return role === "owner" || role === "admin";
}

function sensitiveReviewPurpose(purpose: CanopyProofAccessPurpose) {
  return purpose === "proof_issuance" || purpose === "governance_review" || purpose === "institutional_reporting";
}

function sensitiveWriteAction(action: CanopyProofAccessAction) {
  return action === "write" || action === "review" || action === "export";
}

function requireOneOf<TAllowed extends readonly string[]>(value: unknown, allowed: TAllowed, field: string): TAllowed[number] {
  if (typeof value !== "string" || !allowed.includes(value as TAllowed[number])) {
    throw new Error(`CanopyProof access decision ${field} is invalid.`);
  }
  return value as TAllowed[number];
}
