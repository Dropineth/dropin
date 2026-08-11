import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ZodError } from "zod";
import {
  assertCanopyProofAuthorizationAssurance,
  requireCanopyProofAuthorizationBinding,
  type CanopyProofAuthorizationBinding,
} from "../../domain/canopyproof/authorization-binding.js";
import {
  requireCanopyProofAuthenticatedPrincipal,
  type CanopyProofAuthenticatedPrincipal,
} from "../../domain/canopyproof/identity-authentication.js";
import {
  CanopyProofMobileEvidenceSyncAuthorityError,
  type CanopyProofMobileEvidenceSyncActor,
  type CanopyProofMobileEvidenceSyncAuthorityService,
} from "../../domain/canopyproof/mobile-evidence-sync-authority.js";
import {
  canopyProofMobileEvidenceSyncAdmissionDecisionSchema,
  canopyProofMobileEvidenceSyncAdmissionPolicy,
  canopyProofMobileEvidenceSyncAdmissionWindow,
  type CanopyProofMobileEvidenceSyncAdmissionAuthority,
  type CanopyProofMobileEvidenceSyncAdmissionCommand,
} from "../../domain/canopyproof/mobile-evidence-sync-admission.js";
import type { CanopyProofAccessRole } from "../../domain/canopyproof/security-policy.js";

type MobileEvidenceSyncRouteEnvironment = {
  Variables: {
    canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
    canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
  };
};

export type CanopyProofMobileEvidenceSyncRouteOptions = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  resolveService: (
    context: Context<MobileEvidenceSyncRouteEnvironment>,
  ) => CanopyProofMobileEvidenceSyncAuthorityService | undefined;
  resolveAdmissionAuthority: (
    context: Context<MobileEvidenceSyncRouteEnvironment>,
  ) => CanopyProofMobileEvidenceSyncAdmissionAuthority | undefined;
  now?: (() => Date) | undefined;
}>;

export type CanopyProofMobileEvidenceSyncGateStatus = Readonly<{
  enabled: boolean;
  repositoryConfigured: boolean;
  accessAuthenticationConfigured: boolean;
  featureFlagEnabled: boolean;
  governanceUnlockEnabled: boolean;
  admissionFeatureFlagEnabled: boolean;
}>;

const commandRoles: readonly CanopyProofAccessRole[] = [
  "owner",
  "admin",
  "verifier",
  "researcher",
  "community",
];

export function canopyProofMobileEvidenceSyncGateStatus(
  environment: Readonly<Record<string, string | undefined>>,
): CanopyProofMobileEvidenceSyncGateStatus {
  const repositoryConfigured =
    environment.DROPIN_REPOSITORY === "prisma" && Boolean(environment.DATABASE_URL?.trim());
  const accessAuthenticationConfigured =
    environment.DROPIN_CANOPYPROOF_AUTH_MODE === "cloudflare_access_jwt";
  const featureFlagEnabled = environment.CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED === "true";
  const governanceUnlockEnabled = environment.CANOPY_PRODUCTION_UNLOCK === "true";
  const admissionFeatureFlagEnabled = environment.CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED === "true";
  return {
    enabled:
      repositoryConfigured &&
      accessAuthenticationConfigured &&
      featureFlagEnabled &&
      governanceUnlockEnabled &&
      admissionFeatureFlagEnabled,
    repositoryConfigured,
    accessAuthenticationConfigured,
    featureFlagEnabled,
    governanceUnlockEnabled,
    admissionFeatureFlagEnabled,
  };
}

export function createCanopyProofMobileEvidenceSyncRoutes(
  options: CanopyProofMobileEvidenceSyncRouteOptions,
) {
  const routes = new Hono<MobileEvidenceSyncRouteEnvironment>();
  const now = options.now ?? (() => new Date());

  routes.get("/status", (context) => {
    requireMobileEvidenceSyncActor(context, false);
    const gate = canopyProofMobileEvidenceSyncGateStatus(options.environment);
    return context.json({
      ok: true,
      data: {
        service: "canopyproof-mobile-evidence-sync-authority",
        gate,
        routeWritePathBlocked: !gate.enabled,
        legacyEvidenceNetworkEnabled: false,
        safety: {
          authenticatedOrganizationRequired: true,
          appendOnlyAuthoritiesRequired: true,
          exactIdempotencyRequired: true,
          durableAbuseAdmissionRequired: true,
          boundedRequestBodiesRequired: true,
          rawNotesExcluded: true,
          humanVerificationStillRequired: true,
          noProductionClaim: true,
          noPrivateKeyHandling: true,
          noMainnetFunds: true,
          noAutomaticCanopyDistribution: true,
        },
      },
    });
  });

  routes.post("/bindings", commandBodyLimit("binding"), async (context) => execute(context, async () => {
    const actor = requireMobileEvidenceSyncActor(context, true);
    const service = requireService(context, options);
    await admitCommand(context, options, actor, "binding", now);
    const result = await service.bindDraft(
      await context.req.json(),
      actor,
      requireIdempotencyKey(context),
    );
    return context.json({ ok: true, data: result }, 201);
  }));

  routes.post("/batches", commandBodyLimit("batch"), async (context) => execute(context, async () => {
    const actor = requireMobileEvidenceSyncActor(context, true);
    const service = requireService(context, options);
    await admitCommand(context, options, actor, "batch", now);
    const result = await service.commitBatch(
      await context.req.json(),
      actor,
      requireIdempotencyKey(context),
    );
    return context.json(
      { ok: true, data: result },
      result.recovered ? 200 : result.batchState === "reconciled" ? 201 : 202,
    );
  }));

  routes.post("/recoveries", commandBodyLimit("recovery"), async (context) => execute(context, async () => {
    const actor = requireMobileEvidenceSyncActor(context, true);
    const service = requireService(context, options);
    await admitCommand(context, options, actor, "recovery", now);
    return context.json({ ok: true, data: await service.recoverBatch(await context.req.json(), actor) });
  }));

  function requireService(
    context: Context<MobileEvidenceSyncRouteEnvironment>,
    routeOptions: CanopyProofMobileEvidenceSyncRouteOptions,
  ) {
    const gate = canopyProofMobileEvidenceSyncGateStatus(routeOptions.environment);
    if (!gate.enabled) throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_DISABLED", 503);
    const service = routeOptions.resolveService(context);
    if (!service) throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_DURABLE_AUTHORITY_UNAVAILABLE", 503);
    return service;
  }

  return routes;
}

function commandBodyLimit(command: CanopyProofMobileEvidenceSyncAdmissionCommand) {
  return bodyLimit({
    maxSize: canopyProofMobileEvidenceSyncAdmissionPolicy(command).maximumBodyBytes,
    onError: (context) => context.json(
      { ok: false, error: "CANOPYPROOF_MOBILE_SYNC_BODY_TOO_LARGE" },
      413,
      { "cache-control": "no-store" },
    ),
  });
}

async function admitCommand(
  context: Context<MobileEvidenceSyncRouteEnvironment>,
  options: CanopyProofMobileEvidenceSyncRouteOptions,
  actor: CanopyProofMobileEvidenceSyncActor,
  command: CanopyProofMobileEvidenceSyncAdmissionCommand,
  now: () => Date,
) {
  const authority = options.resolveAdmissionAuthority(context);
  if (!authority) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE", 503);
  }
  const evaluatedAt = requireNow(now).toISOString();
  let decision: ReturnType<typeof canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse>;
  try {
    decision = canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse(await authority.consume({
      organizationId: actor.organizationId,
      actorId: actor.id,
      command,
      evaluatedAt,
    }));
  } catch (error) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE", 503, undefined, {
      cause: error,
    });
  }
  const policy = canopyProofMobileEvidenceSyncAdmissionPolicy(command);
  const window = canopyProofMobileEvidenceSyncAdmissionWindow(evaluatedAt);
  const expectedLimit = Math.min(policy.actorLimit, policy.organizationLimit);
  const resetSeconds = Math.ceil((Date.parse(decision.resetAt) - Date.parse(evaluatedAt)) / 1_000);
  if (
    decision.command !== command ||
    decision.policyVersion !== policy.policyVersion ||
    decision.limit !== expectedLimit ||
    decision.remaining > expectedLimit ||
    decision.resetAt !== window.resetAt ||
    resetSeconds < 1 ||
    resetSeconds > policy.windowSeconds
  ) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE", 503);
  }
  const headers = admissionHeaders(decision.limit, decision.remaining, resetSeconds, decision.abuseEventRoot);
  for (const [name, value] of Object.entries(headers)) context.header(name, value);
  if (!decision.allowed) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_RATE_LIMITED", 429, headers);
  }
}

function admissionHeaders(
  limit: number,
  remaining: number,
  resetSeconds: number,
  abuseEventRoot: string | undefined,
) {
  return {
    "ratelimit-limit": String(limit),
    "ratelimit-remaining": String(remaining),
    "ratelimit-reset": String(resetSeconds),
    ...(abuseEventRoot
      ? {
          "retry-after": String(resetSeconds),
          "canopyproof-abuse-event-root": abuseEventRoot,
        }
      : {}),
  };
}

function requireNow(now: () => Date) {
  const value = now();
  if (!Number.isFinite(value.getTime())) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE", 503);
  }
  return value;
}

function requireMobileEvidenceSyncActor(
  context: Context<MobileEvidenceSyncRouteEnvironment>,
  requireDurableAccess: boolean,
): CanopyProofMobileEvidenceSyncActor {
  const principal = requireCanopyProofAuthenticatedPrincipal(context.get("canopyProofPrincipal"));
  const binding = requireCanopyProofAuthorizationBinding(
    context.get("canopyProofAuthorizationBinding"),
    principal,
  );
  if (!commandRoles.includes(principal.role)) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_RBAC_DENIED", 403);
  }
  assertCanopyProofAuthorizationAssurance(binding, "organization_member");
  if (
    !binding.organizationId ||
    (requireDurableAccess &&
      (principal.authenticationMethod !== "cloudflare_access_jwt" || binding.source !== "postgres"))
  ) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_RBAC_DENIED", 403);
  }
  return {
    id: principal.actorId,
    role: principal.role as CanopyProofMobileEvidenceSyncActor["role"],
    organizationId: binding.organizationId,
  };
}

function requireIdempotencyKey(context: Context<MobileEvidenceSyncRouteEnvironment>) {
  const value = context.req.header("idempotency-key")?.trim() ?? "";
  if (value.length < 16 || value.length > 512) {
    throw new MobileEvidenceSyncRouteError("CANOPYPROOF_MOBILE_SYNC_IDEMPOTENCY_REQUIRED", 422);
  }
  return value;
}

async function execute(
  context: Context<MobileEvidenceSyncRouteEnvironment>,
  operation: () => Promise<Response>,
) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MobileEvidenceSyncRouteError) {
      return context.json({ ok: false, error: error.code }, error.httpStatus, error.headers);
    }
    if (error instanceof CanopyProofMobileEvidenceSyncAuthorityError) {
      return context.json({ ok: false, error: error.code }, error.httpStatus);
    }
    if (error instanceof ZodError) {
      return context.json({ ok: false, error: "CANOPYPROOF_MOBILE_SYNC_REQUEST_INVALID" }, 400);
    }
    throw error;
  }
}

class MobileEvidenceSyncRouteError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: 403 | 422 | 429 | 503,
    readonly headers: Record<string, string> | undefined = undefined,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "MobileEvidenceSyncRouteError";
  }
}
