import {
  canopyProofPublicExplorerErrorSchema,
} from "@dropin/schemas/canopyproof-public-explorer";
import type { CanopyProofPublicTransparencyProjection } from
  "../../domain/canopyproof/public-transparency-authority.js";
import {
  CanopyProofPublicExplorerError,
  canopyProofPublicExplorerHistoryEtag,
  canopyProofPublicExplorerProjectEtag,
  serializeCanopyProofPublicExplorerHistory,
  serializeCanopyProofPublicExplorerProject,
  serializeCanopyProofPublicExplorerVerification,
} from "../../domain/canopyproof/public-explorer.js";
import { Hono, type Context } from "hono";
import { z } from "zod";

export type CanopyProofPublicExplorerRouteName = "project" | "history" | "verify";

export type CanopyProofPublicExplorerRepositoryPort = {
  getProject(publicProjectId: string, evaluatedAt: string): Promise<CanopyProofPublicTransparencyProjection>;
  getProjectHistory(
    publicProjectId: string,
    input: Readonly<{ evaluatedAt: string; limit?: number; cursor?: string | null }>,
  ): Promise<Readonly<{
    projections: readonly CanopyProofPublicTransparencyProjection[];
    nextCursor: string | null;
  }>>;
  verifyPublication(publicationId: string, evaluatedAt: string): Promise<CanopyProofPublicTransparencyProjection>;
};

export type CanopyProofPublicExplorerActivationDecision =
  | Readonly<{ active: false }>
  | Readonly<{
    active: true;
    apiVersion: "canopyproof.public-explorer.v1";
    decisionRoot: string;
    startsAt: string;
    expiresAt: string;
    routes: readonly CanopyProofPublicExplorerRouteName[];
    reviewRoots: Readonly<{
      privacyImpact: string;
      communitySafeguarding: string;
      legalClaims: string;
      security: string;
      accessibility: string;
      rateCacheAbuse: string;
      incidentRollback: string;
    }>;
  }>;

export type CanopyProofPublicExplorerActivationVerifier = {
  verify(input: Readonly<{
    route: CanopyProofPublicExplorerRouteName;
    evaluatedAt: string;
  }>): Promise<CanopyProofPublicExplorerActivationDecision>;
};

export type CanopyProofPublicExplorerRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  abuseEventRoot?: string;
}>;

export type CanopyProofPublicExplorerRateLimiter = {
  consume(input: Readonly<{
    route: CanopyProofPublicExplorerRouteName;
    clientKey: string;
    evaluatedAt: string;
  }>): Promise<CanopyProofPublicExplorerRateDecision>;
};

export type CanopyProofPublicExplorerRouteOptions = {
  readonly repository: CanopyProofPublicExplorerRepositoryPort;
  readonly activationVerifier?: CanopyProofPublicExplorerActivationVerifier;
  readonly rateLimiter?: CanopyProofPublicExplorerRateLimiter;
  readonly now?: () => Date;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const routeNames = ["project", "history", "verify"] as const;
const activeDecisionSchema = z
  .object({
    active: z.literal(true),
    apiVersion: z.literal("canopyproof.public-explorer.v1"),
    decisionRoot: z.string().regex(HASH_PATTERN),
    startsAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    routes: z.array(z.enum(routeNames)).min(1).max(3),
    reviewRoots: z
      .object({
        privacyImpact: z.string().regex(HASH_PATTERN),
        communitySafeguarding: z.string().regex(HASH_PATTERN),
        legalClaims: z.string().regex(HASH_PATTERN),
        security: z.string().regex(HASH_PATTERN),
        accessibility: z.string().regex(HASH_PATTERN),
        rateCacheAbuse: z.string().regex(HASH_PATTERN),
        incidentRollback: z.string().regex(HASH_PATTERN),
      })
      .strict(),
  })
  .strict();
const rateDecisionSchema = z
  .object({
    allowed: z.boolean(),
    limit: z.number().int().positive(),
    remaining: z.number().int().nonnegative(),
    resetAt: z.string().datetime({ offset: true }),
    abuseEventRoot: z.string().regex(HASH_PATTERN).optional(),
  })
  .strict();
const historyQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().regex(/^cp_public_transparency_[a-f0-9]{24}$/).optional(),
  })
  .strict();

const defaultActivationVerifier: CanopyProofPublicExplorerActivationVerifier = {
  async verify() {
    return { active: false };
  },
};

const defaultRateLimiter: CanopyProofPublicExplorerRateLimiter = {
  async consume(input) {
    return {
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAt: input.evaluatedAt,
    };
  },
};

export function createCanopyProofPublicExplorerRoutes(options: CanopyProofPublicExplorerRouteOptions) {
  const routes = new Hono();
  const activationVerifier = options.activationVerifier ?? defaultActivationVerifier;
  const rateLimiter = options.rateLimiter ?? defaultRateLimiter;
  const now = options.now ?? (() => new Date());

  routes.get("/projects/:publicProjectId", async (context) =>
    handle(context, async () => {
      const evaluatedAt = evaluationTimestamp(now());
      const rateHeaders = await authorizeRequest(context, "project", evaluatedAt, activationVerifier, rateLimiter);
      const projection = await options.repository.getProject(context.req.param("publicProjectId"), evaluatedAt);
      const response = serializeCanopyProofPublicExplorerProject(projection);
      return conditionalJson(context, response, canopyProofPublicExplorerProjectEtag(response), rateHeaders, [projection]);
    }));

  routes.get("/projects/:publicProjectId/history", async (context) =>
    handle(context, async () => {
      const evaluatedAt = evaluationTimestamp(now());
      const rateHeaders = await authorizeRequest(context, "history", evaluatedAt, activationVerifier, rateLimiter);
      const query = historyQuerySchema.parse({
        ...(context.req.query("limit") ? { limit: context.req.query("limit") } : {}),
        ...(context.req.query("cursor") ? { cursor: context.req.query("cursor") } : {}),
      });
      const result = await options.repository.getProjectHistory(context.req.param("publicProjectId"), {
        evaluatedAt,
        limit: query.limit,
        cursor: query.cursor ?? null,
      });
      const response = serializeCanopyProofPublicExplorerHistory(
        result.projections,
        result.nextCursor,
        evaluatedAt,
      );
      return conditionalJson(
        context,
        response,
        canopyProofPublicExplorerHistoryEtag(response),
        rateHeaders,
        result.projections,
      );
    }));

  routes.get("/publications/:publicationId/verify", async (context) =>
    handle(context, async () => {
      const evaluatedAt = evaluationTimestamp(now());
      const rateHeaders = await authorizeRequest(context, "verify", evaluatedAt, activationVerifier, rateLimiter);
      const projection = await options.repository.verifyPublication(context.req.param("publicationId"), evaluatedAt);
      const response = serializeCanopyProofPublicExplorerVerification(projection);
      return conditionalJson(context, response, canopyProofPublicExplorerProjectEtag(response), rateHeaders, [projection]);
    }));

  return routes;
}

async function authorizeRequest(
  context: Context,
  route: CanopyProofPublicExplorerRouteName,
  evaluatedAt: string,
  activationVerifier: CanopyProofPublicExplorerActivationVerifier,
  rateLimiter: CanopyProofPublicExplorerRateLimiter,
) {
  let rawDecision: CanopyProofPublicExplorerActivationDecision;
  try {
    rawDecision = await activationVerifier.verify({ route, evaluatedAt });
  } catch (error) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED", {
      cause: error,
    });
  }
  if (!rawDecision.active) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED");
  }
  const decision = activeDecisionSchema.parse(rawDecision);
  const evaluatedMs = Date.parse(evaluatedAt);
  if (
    decision.routes.includes(route) === false ||
    Date.parse(decision.startsAt) > evaluatedMs ||
    Date.parse(decision.expiresAt) <= evaluatedMs
  ) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED");
  }

  const rate = rateDecisionSchema.parse(await rateLimiter.consume({
    route,
    clientKey: context.req.header("cf-connecting-ip") ?? "unidentified-client",
    evaluatedAt,
  }));
  if (rate.remaining > rate.limit || Date.parse(rate.resetAt) < evaluatedMs) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID");
  }
  const headers = rateHeaders(rate);
  if (!rate.allowed) {
    if (!rate.abuseEventRoot) {
      throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED");
    }
    throw new RateLimitedError(headers);
  }
  return headers;
}

async function handle(context: Context, operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return errorResponse(context, "CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED", 429, error.rateHeaders);
    }
    if (error instanceof z.ZodError) {
      return errorResponse(context, "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID", 400);
    }
    if (error instanceof CanopyProofPublicExplorerError) {
      const status = statusFor(error.code);
      return errorResponse(context, error.code, status);
    }
    return errorResponse(context, "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID", 503);
  }
}

function conditionalJson(
  context: Context,
  body: unknown,
  etag: string,
  rate: HeadersInit,
  projections: readonly CanopyProofPublicTransparencyProjection[],
) {
  const headers = responseHeaders(rate, cachePolicy(projections), etag);
  if (etagMatches(context.req.header("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(JSON.stringify(body), { status: 200, headers });
}

function errorResponse(
  _context: Context,
  error: CanopyProofPublicExplorerError["code"],
  status: 400 | 404 | 429 | 503,
  extraHeaders: HeadersInit = {},
) {
  const body = canopyProofPublicExplorerErrorSchema.parse({ ok: false, error });
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(extraHeaders, "no-store"),
  });
}

function responseHeaders(extra: HeadersInit, cacheControl: string, etag?: string) {
  const headers = new Headers(extra);
  headers.set("cache-control", cacheControl);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  headers.set("referrer-policy", "no-referrer");
  headers.set("vary", "Accept-Encoding");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  if (etag) headers.set("etag", etag);
  return headers;
}

function cachePolicy(projections: readonly CanopyProofPublicTransparencyProjection[]) {
  return projections.length > 0 && projections.every((projection) => projection.state === "active")
    ? "public, max-age=0, s-maxage=15, must-revalidate"
    : "no-store";
}

function rateHeaders(rate: z.output<typeof rateDecisionSchema>) {
  const resetEpoch = Math.floor(Date.parse(rate.resetAt) / 1000);
  return {
    "ratelimit-limit": String(rate.limit),
    "ratelimit-remaining": String(rate.remaining),
    "ratelimit-reset": String(resetEpoch),
    "x-ratelimit-limit": String(rate.limit),
    "x-ratelimit-remaining": String(rate.remaining),
    "x-ratelimit-reset": String(resetEpoch),
  };
}

function statusFor(code: CanopyProofPublicExplorerError["code"]): 400 | 404 | 429 | 503 {
  if (code === "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID") return 400;
  if (code === "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND") return 404;
  if (code === "CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED") return 429;
  return 503;
}

function evaluationTimestamp(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID");
  }
  const bucketMs = 15_000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs).toISOString();
}

function etagMatches(header: string | undefined, etag: string) {
  return header?.split(",").map((value) => value.trim()).includes(etag) ?? false;
}

class RateLimitedError extends Error {
  constructor(readonly rateHeaders: HeadersInit) {
    super("CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED");
  }
}
