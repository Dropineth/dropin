/** Private HTTP binding only. This transport does not supply identity, guardian
 * authority, a database, or permission to enroll real children. */
export interface ChildBackendBindingEnv {
  DROPIN_CHILD_BACKEND_MODE?: string;
  CHILD_BACKEND?: { fetch(request: Request): Promise<Response> };
}

const childFamily = "/api/canopyproof/child-stewardship";
const childVersion = `${childFamily}/v1`;
const requestHeaders = [
  "accept", "authorization", "content-type", "idempotency-key", "if-match",
  "origin", "sec-fetch-site", "x-child-upload-authorization",
];
const responseHeaders = [
  "content-type", "content-disposition", "content-encoding", "content-length", "etag", "retry-after",
];

function inFamily(path: string): boolean {
  return path === childFamily || path.startsWith(`${childFamily}/`);
}

/** Encoded aliases must not escape to the unrelated legacy API. Do not rewrite
 * aliases into accepted child routes: the backend receives canonical paths only. */
function ownsPath(path: string): boolean {
  if (inFamily(path)) return true;
  // The namespace is ASCII. Decode valid bytes independently so a malformed
  // escape in a later suffix cannot erase an already recognizable namespace.
  return inFamily(path.replace(/%([0-9a-f]{2})/gi, (_match, byte: string) => String.fromCharCode(Number.parseInt(byte, 16))));
}

export function childBackendPrivacyHeaders(): Headers {
  return new Headers({
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  });
}

function unavailable(): Response {
  const headers = childBackendPrivacyHeaders();
  headers.set("content-type", "application/json; charset=utf-8");
  // An interrupted command may already have committed. Never claim otherwise,
  // retry it here, or fall back to a second store/origin.
  return new Response(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", retryable: false } }), { status: 503, headers });
}

/** null means unrelated route. Child failures never return null and therefore
 * never fall through to DROPIN_API_ORIGIN (which may be memory/mock). */
export async function forwardChildBackendRequest(request: Request, env: ChildBackendBindingEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!ownsPath(url.pathname)) return null;
  if (!(url.pathname === childVersion || url.pathname.startsWith(`${childVersion}/`))
    || url.pathname.includes("%") || env.DROPIN_CHILD_BACKEND_MODE !== "synthetic-demo"
    || !env.CHILD_BACKEND || typeof env.CHILD_BACKEND.fetch !== "function") return unavailable();

  // Preserve the incoming URL's origin, not a made-up backend address. The
  // binding selects the destination; the existing backend mounts without /api.
  url.pathname = url.pathname.slice("/api".length);
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const body = request.method !== "GET" && request.method !== "HEAD" ? request.body : null;
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method, headers, redirect: "manual", signal: request.signal,
    ...(body ? { body, duplex: "half" as const } : {}),
  };
  try {
    // No edge readiness probe: the real backend retains its PostgreSQL, role,
    // per-session and per-operation checks, including negative-authority paths.
    const upstream = await env.CHILD_BACKEND.fetch(new Request(url, init));
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return unavailable();
    }
    const output = childBackendPrivacyHeaders();
    // Do not inherit cookies, CORS grants, redirect/refresh hints or trace IDs.
    // The caller applies only the existing exact Origin policy.
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value !== null) output.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: output });
  } catch {
    return unavailable();
  }
}
