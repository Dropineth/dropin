import { NextResponse, type NextRequest } from "next/server";
import { isProductionSite } from "./data/life/navigation";

/**
 * Edge security middleware for canopyproof.org.
 *
 * Runs on the Next.js Edge runtime (Web APIs only — no Node globals). It mints a
 * per-request nonce and emits a strict, nonce-based Content-Security-Policy plus
 * institutional transport/sniffing protections.
 *
 * Tradeoffs (documented on purpose, not hidden):
 *  - Matched pages render per request; the static ecology homepage is excluded
 *    from this matcher. Next.js automatically
 *    propagates the nonce from the request CSP header to its own scripts.
 *  - The child route pins connections to self and its configured API origin,
 *    restricts images/scripts to local resources and disallows workers/forms.
 *    Other routes retain nonce + strict-dynamic scripts and broad HTTPS images
 *    and connections for map tiles and existing API integrations.
 *  - These document headers apply on full navigation. Client-side RSC navigation
 *    does not replace a document CSP; shared telemetry separately excludes the child route.
 *  - To validate before enforcing, swap the header name below to
 *    `content-security-policy-report-only` and add a `report-to` directive.
 */

function buildContentSecurityPolicy(
  nonce: string,
  upgradeInsecureRequests: boolean,
  childRoute = false,
): string {
  let childApiOrigin = "";
  try {
    const api = new URL(process.env.NEXT_PUBLIC_DROPIN_API_URL ?? "");
    if (api.protocol === "https:" || api.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) childApiOrigin = ` ${api.origin}`;
  } catch { /* An unconfigured child route has same-origin connectivity only. */ }
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    // Child scripts stay local; other pages retain nonce-based strict-dynamic.
    `script-src 'self' 'nonce-${nonce}'${childRoute ? "" : " 'strict-dynamic'"}`,
    // Inline style attributes (aspect ratios, chart heights) require this.
    "style-src 'self' 'unsafe-inline'",
    // Local metadata/logo assets come from `self`; `https:` keeps map tiles and
    // remote campaign media working until those origins are pinned explicitly.
    childRoute ? "img-src 'self' data: blob:" : "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    childRoute ? `connect-src 'self'${childApiOrigin}` : "connect-src 'self' https:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    childRoute ? "form-action 'none'" : "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    childRoute ? "worker-src 'none'" : "worker-src 'self' blob:",
  ];
  if (upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function middleware(request: NextRequest): NextResponse {
  const childRoute = /^\/stewardship(?:\/|$)/.test(request.nextUrl.pathname);
  const nonce = generateNonce();
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim();
  const csp = buildContentSecurityPolicy(
    nonce,
    request.nextUrl.protocol === "https:" || forwardedProtocol === "https",
    childRoute,
  );

  // Forward the nonce + CSP on the request so Next.js can nonce its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-life-locale", /^\/(life(?:\/|$)|company$|zh(?:\/|$))/.test(request.nextUrl.pathname) ? "zh" : "en");
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("content-security-policy", csp);
  if (!isProductionSite) response.headers.set("x-robots-tag", "noindex, nofollow");
  response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", childRoute ? "no-referrer" : "strict-origin-when-cross-origin");
  if (childRoute) {
    response.headers.set("cache-control", "private, no-store, max-age=0");
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }
  response.headers.set("x-dns-prefetch-control", "off");
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("cross-origin-resource-policy", "same-origin");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  );

  return response;
}

export const config = {
  matcher: [
    // Dynamic app routes only. Keep the static landing page and metadata/logo
    // assets out of middleware so OpenNext serves their prerendered assets
    // without falling back to the default server function.
    {
      source:
        "/((?!$|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|icon.jpg|apple-touch-icon.jpg|og/).*)",
      // These are client-controlled headers. Even a claimed prefetch must have
      // its language/CSP/nonce replaced before RootLayout reads request headers.
    },
  ],
};
