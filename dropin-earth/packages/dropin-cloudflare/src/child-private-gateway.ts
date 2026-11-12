import { childBackendPrivacyHeaders, forwardChildBackendRequest } from "./child-backend-binding.js";

/** CHILD_PRIVATE_API must be a single-target HTTP VPC Service, never a broad
 * VPC Network. Its approved service configuration owns the actual host/port. */
export interface ChildPrivateGatewayEnv {
  DROPIN_CHILD_GATEWAY_MODE?: string;
  CHILD_PRIVATE_ORIGIN?: string;
  CHILD_GATEWAY_ALLOWED_ORIGIN?: string;
  CHILD_PRIVATE_API?: { fetch(request: Request): Promise<Response> };
}

const prefix = "/canopyproof/child-stewardship/v1";
function exactHttpsOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password ? url : null;
  } catch { return null; }
}
function closed(status = 503, code = "SERVICE_UNAVAILABLE"): Response {
  const headers = childBackendPrivacyHeaders();
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ error: { code, retryable: false } }), { status, headers });
}

export function createChildPrivateGateway() {
  return {
    async fetch(request: Request, env: ChildPrivateGatewayEnv): Promise<Response> {
      const incoming = new URL(request.url);
      if (!(incoming.pathname === prefix || incoming.pathname.startsWith(`${prefix}/`)) || incoming.pathname.includes("%")) {
        return closed(404, "CAPABILITY_UNAVAILABLE");
      }
      if (!["GET", "HEAD", "POST", "OPTIONS"].includes(request.method)) return closed(405, "CAPABILITY_UNAVAILABLE");
      const target = exactHttpsOrigin(env.CHILD_PRIVATE_ORIGIN);
      const allowedOrigin = exactHttpsOrigin(env.CHILD_GATEWAY_ALLOWED_ORIGIN);
      if (env.DROPIN_CHILD_GATEWAY_MODE !== "synthetic-demo" || !target || !allowedOrigin
        || !env.CHILD_PRIVATE_API || typeof env.CHILD_PRIVATE_API.fetch !== "function") return closed();

      // Origin/Sec-Fetch-Site are caller-controlled metadata, not authentication.
      // Never manufacture an approved Origin or exchange bearer authority here.
      // Originless service clients still require the backend's own verification;
      // guardian exchange endpoints retain their existing proof-based contract.
      const origin = request.headers.get("origin");
      if ((origin !== null && origin !== allowedOrigin.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
        return closed(403, "ORIGIN_DENIED");
      }

      // Reuse PR47's streaming header allowlist, private response handling,
      // no-redirect and no-retry behavior. The helper's /api prefix is internal
      // normalization only; neither this URL's host nor any query/body field can
      // choose the private destination.
      const transportUrl = new URL(incoming);
      transportUrl.pathname = `/api${incoming.pathname}`;
      const body = request.method !== "GET" && request.method !== "HEAD" ? request.body : null;
      const transportInit: RequestInit & { duplex?: "half" } = {
        method: request.method, headers: request.headers, redirect: "manual", signal: request.signal,
        ...(body ? { body, duplex: "half" as const } : {}),
      };
      const privateBinding = env.CHILD_PRIVATE_API;
      const response = await forwardChildBackendRequest(new Request(transportUrl, transportInit), {
        DROPIN_CHILD_BACKEND_MODE: "synthetic-demo",
        CHILD_BACKEND: {
          async fetch(input: Request): Promise<Response> {
            const path = new URL(input.url);
            // Fixed, operator-approved HTTPS host/SNI. A VPC Service's registered
            // host/port still controls routing; do not replace this with fetch()
            // or a VPC Network whose destination follows the URL.
            const destination = new URL(target);
            destination.pathname = path.pathname;
            destination.search = path.search;
            const inputBody = input.method !== "GET" && input.method !== "HEAD" ? input.body : null;
            const init: RequestInit & { duplex?: "half" } = {
              method: input.method, headers: input.headers, redirect: "manual", signal: input.signal,
              ...(inputBody ? { body: inputBody, duplex: "half" as const } : {}),
            };
            return privateBinding.fetch(new Request(destination, init));
          },
        },
      });
      return response ?? closed();
    },
  };
}

export default createChildPrivateGateway();
