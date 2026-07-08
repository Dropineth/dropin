import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge security middleware for canopyproof.org.
 *
 * Runs on the Next.js Edge runtime (Web APIs only — no Node globals). It mints a
 * per-request nonce and emits a strict, nonce-based Content-Security-Policy plus
 * institutional transport/sniffing protections.
 *
 * Tradeoffs (documented on purpose, not hidden):
 *  - A per-request nonce opts matched routes into dynamic rendering. The landing
 *    already runs as edge SSR, so this is acceptable. Next.js automatically
 *    propagates the nonce from the request CSP header to its own scripts.
 *  - `script-src` is strict (nonce + strict-dynamic) — that is where XSS risk
 *    actually lives. `img-src`/`connect-src`/`font-src` intentionally allow
 *    `https:` so other routes (map tiles, the API origin) do not silently break.
 *    Tighten these to explicit origins once the tile host + API origin are fixed.
 *  - To validate before enforcing, swap the header name below to
 *    `content-security-policy-report-only` and add a `report-to` directive.
 */

function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    // Strict: only the nonce'd bootstrap and scripts it loads execute.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Inline style attributes (aspect ratios, chart heights) require this.
    "style-src 'self' 'unsafe-inline'",
    // Local metadata/logo assets come from `self`; `https:` keeps map tiles and
    // remote campaign media working until those origins are pinned explicitly.
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
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
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce);

  // Forward the nonce + CSP on the request so Next.js can nonce its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("content-security-policy", csp);
  response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
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
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
