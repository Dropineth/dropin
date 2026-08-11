import {
  createCanopyproofEdgeRequestId,
  createCanopyproofEdgeTraceContext,
  exportCanopyproofEdgeOtlpSpan,
  formatCanopyproofEdgeTraceparent,
  resolveCanopyproofEdgeOtlpConfiguration,
  scheduleCanopyproofEdgeOtlpSpan,
  type CanopyproofEdgeObservabilityEnv,
  type CanopyproofExecutionContext,
} from "./canopyproof-edge-observability.js";

export type CanopyproofMode = "testnet" | "production";

export interface CanopyproofCloudflareEnv extends CanopyproofEdgeObservabilityEnv {
  DROPIN_API_ORIGIN?: string;
  DROPIN_ALLOWED_ORIGINS?: string;
  DROPIN_ALLOW_ADMIN_PROXY?: string;
  DROPIN_CANONICAL_HOST?: string;
  DROPIN_CANOPYPROOF_MODE?: string;
}

export interface CanopyproofProxyConfig {
  apiOrigin: URL;
  allowedOrigins: string[];
  allowAdminProxy: boolean;
  canonicalHost: string;
  mode: CanopyproofMode;
}

export interface CanopyproofConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: CanopyproofProxyConfig;
}

export interface CanopyproofProxyOptions {
  fetcher?: (request: Request) => Promise<Response>;
  telemetryFetcher?: (request: Request) => Promise<Response>;
  requestIdFactory?: () => string;
  traceIdFactory?: () => string;
  spanIdFactory?: () => string;
  crypto?: Pick<Crypto, "getRandomValues" | "randomUUID" | "subtle">;
  now?: () => number;
}

const defaultAllowedOrigins = ["https://canopyproof.org", "https://www.canopyproof.org"];
const blockedUpstreamRequestHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "x-dropin-actor-id",
  "x-dropin-actor-role",
  "x-dropin-organization-id",
  "traceparent",
  "tracestate",
  "baggage",
]);

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function parseMode(value: string | undefined): CanopyproofMode {
  return value === "production" ? "production" : "testnet";
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) {
    return defaultAllowedOrigins;
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ];
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function validateCanopyproofCloudflareConfig(env: CanopyproofCloudflareEnv): CanopyproofConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mode = parseMode(env.DROPIN_CANOPYPROOF_MODE);
  const canonicalHost = env.DROPIN_CANONICAL_HOST ?? "canopyproof.org";
  const allowedOrigins = parseAllowedOrigins(env.DROPIN_ALLOWED_ORIGINS);
  const allowAdminProxy = parseBoolean(env.DROPIN_ALLOW_ADMIN_PROXY);
  let apiOrigin: URL | undefined;

  if (!env.DROPIN_API_ORIGIN) {
    errors.push("DROPIN_API_ORIGIN is required.");
  } else {
    try {
      apiOrigin = new URL(env.DROPIN_API_ORIGIN);
    } catch {
      errors.push("DROPIN_API_ORIGIN must be a valid absolute URL.");
    }
  }

  if (apiOrigin) {
    if (apiOrigin.protocol !== "http:" && apiOrigin.protocol !== "https:") {
      errors.push("API origin must use HTTP or HTTPS.");
    }

    if (mode === "production" && apiOrigin.protocol !== "https:") {
      errors.push("Production API origin must use HTTPS.");
    }

    if (mode === "production" && isLocalhost(apiOrigin.hostname)) {
      errors.push("Production API origin cannot point to localhost.");
    }

    if (apiOrigin.hostname === canonicalHost) {
      warnings.push("API origin host matches canonical host; verify this cannot proxy-loop.");
    }

    if (apiOrigin.username || apiOrigin.password || apiOrigin.search || apiOrigin.hash) {
      errors.push("API origin cannot contain credentials, a query, or a fragment.");
    }
  }

  if (allowedOrigins.length === 0) {
    errors.push("At least one allowed origin is required.");
  }

  for (const origin of allowedOrigins) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.origin !== origin || (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:")) {
        errors.push(`Allowed origin must be an exact HTTP(S) origin: ${origin}`);
      } else if (mode === "production" && parsedOrigin.protocol !== "https:") {
        errors.push(`Production allowed origin must use HTTPS: ${origin}`);
      }
    } catch {
      errors.push(`Allowed origin must be a valid absolute URL: ${origin}`);
    }
  }

  if (mode === "production" && allowAdminProxy) {
    errors.push("Production admin proxy must remain disabled.");
  }

  if (mode === "testnet") {
    warnings.push("Worker is in testnet mode; keep public pages marked testnet-only.");
  }

  if (errors.length > 0 || !apiOrigin) {
    return { valid: false, errors, warnings };
  }

  return {
    valid: true,
    errors,
    warnings,
    config: {
      apiOrigin,
      allowedOrigins,
      allowAdminProxy,
      canonicalHost,
      mode,
    },
  };
}

export function buildUpstreamUrl(requestUrl: string, apiOrigin: URL): URL {
  const incoming = new URL(requestUrl);

  if (incoming.pathname !== "/api" && !incoming.pathname.startsWith("/api/")) {
    throw new Error("request_path_must_start_with_api");
  }

  const suffix = incoming.pathname.slice("/api".length) || "/";
  const basePath = apiOrigin.pathname === "/" ? "" : apiOrigin.pathname.replace(/\/$/, "");
  const upstream = new URL(apiOrigin.toString());
  upstream.pathname = `${basePath}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  upstream.search = incoming.search;
  return upstream;
}

export function buildCanopyproofSecurityHeaders(mode: CanopyproofMode): Headers {
  const headers = new Headers();
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

  if (mode === "production") {
    // HSTS is intentionally not set in testnet mode; production operators should stage it carefully.
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return headers;
}

export function sanitizeProxyHeaders(input: Headers): Headers {
  const output = new Headers();

  input.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!blockedUpstreamRequestHeaders.has(normalized)) {
      output.set(key, value);
    }
  });

  return output;
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  return origin === null || allowedOrigins.includes(origin);
}

export function appendCorsHeaders(headers: Headers, origin: string | null, allowedOrigins: string[]): Headers {
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    headers.set("access-control-allow-headers", "authorization,content-type,idempotency-key,x-dropin-client");
    headers.set("access-control-max-age", "600");
    headers.append("vary", "origin");
  }

  return headers;
}

function jsonResponse(body: unknown, status: number, config: CanopyproofProxyConfig | undefined, origin: string | null): Response {
  const headers = buildCanopyproofSecurityHeaders(config?.mode ?? "testnet");
  headers.set("content-type", "application/json; charset=utf-8");

  if (config) {
    appendCorsHeaders(headers, origin, config.allowedOrigins);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function isAdminProxyPath(requestUrl: string): boolean {
  const pathname = new URL(requestUrl).pathname;
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function createCanopyproofApiProxy(options: CanopyproofProxyOptions = {}) {
  const fetcher = options.fetcher ?? ((request: Request) => fetch(request));
  const cryptoProvider = options.crypto ?? globalThis.crypto;
  const requestIdFactory = options.requestIdFactory ?? (() => createCanopyproofEdgeRequestId(cryptoProvider));
  const now = options.now ?? Date.now;

  return {
    async fetch(
      request: Request,
      env: CanopyproofCloudflareEnv,
      context?: CanopyproofExecutionContext,
    ): Promise<Response> {
      const validation = validateCanopyproofCloudflareConfig(env);
      const origin = request.headers.get("origin");

      if (!validation.valid || !validation.config) {
        return jsonResponse({ error: "cloudflare_proxy_misconfigured", details: validation.errors }, 503, validation.config, origin);
      }

      const config = validation.config;

      if (!isOriginAllowed(origin, config.allowedOrigins)) {
        return jsonResponse({ error: "origin_not_allowed" }, 403, config, origin);
      }

      if (request.method === "OPTIONS") {
        const headers = buildCanopyproofSecurityHeaders(config.mode);
        appendCorsHeaders(headers, origin, config.allowedOrigins);
        return new Response(null, { status: 204, headers });
      }

      if (isAdminProxyPath(request.url) && !config.allowAdminProxy) {
        return jsonResponse({ error: "admin_proxy_disabled" }, 403, config, origin);
      }

      let upstreamUrl: URL;
      try {
        upstreamUrl = buildUpstreamUrl(request.url, config.apiOrigin);
      } catch {
        return jsonResponse({ error: "not_found" }, 404, config, origin);
      }

      const otlpConfiguration = resolveCanopyproofEdgeOtlpConfiguration(env);
      const sampleRatio = otlpConfiguration.state === "ready" ? otlpConfiguration.config.sampleRatio : 0;
      let requestId: string;
      let trace: ReturnType<typeof createCanopyproofEdgeTraceContext>;
      try {
        requestId = requestIdFactory();
        trace = createCanopyproofEdgeTraceContext(request.headers.get("traceparent"), sampleRatio, {
          crypto: cryptoProvider,
          ...(options.traceIdFactory ? { traceIdFactory: options.traceIdFactory } : {}),
          ...(options.spanIdFactory ? { spanIdFactory: options.spanIdFactory } : {}),
        });
      } catch {
        return jsonResponse({ error: "edge_trace_unavailable" }, 503, config, origin);
      }

      const upstreamHeaders = sanitizeProxyHeaders(request.headers);
      try {
        upstreamHeaders.set("x-dropin-edge-request-id", requestId);
        upstreamHeaders.set("traceparent", formatCanopyproofEdgeTraceparent(trace));
      } catch {
        return jsonResponse({ error: "edge_trace_unavailable" }, 503, config, origin);
      }
      upstreamHeaders.set("x-forwarded-host", new URL(request.url).host);
      upstreamHeaders.set("x-forwarded-proto", "https");

      const body = request.method !== "GET" && request.method !== "HEAD" ? request.body : null;
      const init: RequestInit & { duplex?: "half" } = {
        method: request.method,
        headers: upstreamHeaders,
        redirect: "manual",
        ...(body ? { body, duplex: "half" as const } : {}),
      };
      const startedAtEpochMs = now();

      const scheduleEdgeSpan = (status: number, upstreamOutcome: "completed" | "unavailable") => {
        if (otlpConfiguration.state !== "ready" || !trace.sampled) return;
        scheduleCanopyproofEdgeOtlpSpan(
          context,
          () =>
            exportCanopyproofEdgeOtlpSpan({
              configuration: otlpConfiguration.config,
              span: {
                requestId,
                trace,
                method: request.method,
                status,
                startedAtEpochMs,
                endedAtEpochMs: now(),
                upstreamOutcome,
              },
              ...(options.telemetryFetcher ? { fetcher: options.telemetryFetcher } : {}),
              crypto: cryptoProvider,
            }),
        );
      };

      try {
        const upstreamResponse = await fetcher(new Request(upstreamUrl, init));
        const responseHeaders = new Headers(upstreamResponse.headers);
        buildCanopyproofSecurityHeaders(config.mode).forEach((value, key) => responseHeaders.set(key, value));
        appendCorsHeaders(responseHeaders, origin, config.allowedOrigins);
        responseHeaders.set("x-dropin-edge", "canopyproof-api-proxy");
        scheduleEdgeSpan(upstreamResponse.status, "completed");
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      } catch {
        scheduleEdgeSpan(502, "unavailable");
        return jsonResponse({ error: "upstream_unavailable" }, 502, config, origin);
      }
    },
  };
}

export default createCanopyproofApiProxy();
