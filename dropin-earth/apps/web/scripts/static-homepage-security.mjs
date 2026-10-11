import { createHash } from "node:crypto";

// Cloudflare rejects header-rule lines longer than 2,000 characters. Count the
// indentation and header name too, rather than silently losing the CSP on upload.
const MAX_HEADER_LINE_LENGTH = 2000;

export function extractInlineScriptHashes(html) {
  const hashes = new Set();
  // Next emits ordinary script tags. Consume quoted attributes and comments so
  // a `>` inside an attribute, or a commented-out script, is not executable code.
  const opening = /<!--[\s\S]*?-->|<script(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  let match;
  while ((match = opening.exec(html))) {
    if (match[0].startsWith("<!--")) continue;
    const closing = /<\/script\s*>/gi;
    closing.lastIndex = opening.lastIndex;
    const end = closing.exec(html);
    if (!end) throw new Error("Cannot secure static homepage: unclosed script element");
    const attributes = [...match[1].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)];
    if (!attributes.some((attribute) => attribute[1].toLowerCase() === "src")) {
      // HTML input preprocessing normalizes line endings and replaces NULs;
      // CSP hashes the resulting script text, without trimming its whitespace.
      const script = html.slice(opening.lastIndex, end.index).replace(/\r\n?/g, "\n").replace(/\0/g, "\uFFFD");
      hashes.add(`'sha256-${createHash("sha256").update(script, "utf8").digest("base64")}'`);
    }
    opening.lastIndex = closing.lastIndex;
  }
  return [...hashes];
}

export function buildStaticSecurityHeaders(html, { production = false } = {}) {
  const hashes = extractInlineScriptHashes(html);
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    // Parser-inserted Next chunks have no nonce/integrity attribute. Keep self
    // for those chunks; strict-dynamic would disable that allowlist in browsers.
    ["script-src 'self'", ...hashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
  if (production) directives.push("upgrade-insecure-requests");
  const headers = [
    ["Content-Security-Policy", directives.join("; ")],
    ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-DNS-Prefetch-Control", "off"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["Cross-Origin-Resource-Policy", "same-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"],
  ].map(([name, value]) => `  ${name}: ${value}`);
  for (const line of headers) {
    if (line.length > MAX_HEADER_LINE_LENGTH) {
      throw new Error(`Cannot secure static homepage: header line is ${line.length} characters (Cloudflare limit ${MAX_HEADER_LINE_LENGTH})`);
    }
  }
  // Static root and its direct file alias bypass Next middleware. Dynamic pages
  // retain their request-specific nonce policy. Avoid overlapping CSP rules.
  const rules = ["/", "/index.html"].map((path) => [path, ...headers].join("\n"));
  if (!production) rules.unshift("/*\n  X-Robots-Tag: noindex, nofollow");
  return `${rules.join("\n")}\n`;
}
