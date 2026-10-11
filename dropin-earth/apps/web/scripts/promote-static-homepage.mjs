import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cwd, stdout, env } from "node:process";

const appRoot = cwd();
const nextAppDir = join(appRoot, ".next", "server", "app");
const openNextAssetsDir = join(appRoot, ".open-next", "assets");

const assets = [
  ["index.html", "index.html"],
  ["index.rsc", "index.rsc"],
  ["robots.txt.body", "robots.txt"],
  ["sitemap.xml.body", "sitemap.xml"],
];

function requireFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Cannot promote static homepage asset: missing ${label} at ${path}`);
  }
}

requireFile(join(nextAppDir, "index.html"), "prerendered homepage HTML");
mkdirSync(openNextAssetsDir, { recursive: true });

for (const [sourceName, targetName] of assets) {
  const sourcePath = join(nextAppDir, sourceName);
  if (!existsSync(sourcePath)) {
    if (sourceName !== "index.rsc") requireFile(sourcePath, sourceName);
    continue;
  }
  copyFileSync(sourcePath, join(openNextAssetsDir, targetName));
}

stdout.write("[CanopyProof] Promoted prerendered homepage into OpenNext Worker assets.\n");

// Static assets bypass Next middleware in workerd. Preview must fail closed here too.
const production = env.NEXT_PUBLIC_CANOPYPROOF_MODE === "production"
  && env.NEXT_PUBLIC_DROPIN_SITE_URL === "https://canopyproof.org";
if (production) {
  // The root HTML is served as a static asset before the Next.js Worker runs.
  // Request middleware cannot attach its per-request nonce CSP to this route.
  // Pin every inline Next.js bootstrap script by its actual built-content hash.
  const html = readFileSync(join(nextAppDir, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const openingScripts = [...html.matchAll(/<script\b/gi)].length;
  if (scripts.length !== openingScripts) {
    throw new Error("Static homepage CSP: malformed or unmatched script element");
  }
  const hashes = [...new Set(
    scripts.filter(([, attrs, script]) => !/(?:^|\s)src\s*=/i.test(attrs) && script.length > 0)
      .map(([, , script]) => "'sha256-" + createHash("sha256").update(script, "utf8").digest("base64") + "'"),
  )];
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    ["script-src 'self'", ...hashes].join(" "),
    "script-src-attr 'none'",
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
    "upgrade-insecure-requests",
  ].join("; ");
  const staticHeaders = [
    "  Content-Security-Policy: " + policy,
    "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  X-DNS-Prefetch-Control: off",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  ];
  // Workers Static Assets _headers has a hard 2,000-character line limit.
  // Fail the build rather than silently ship a truncated or permissive CSP.
  for (const line of staticHeaders) {
    if (Buffer.byteLength(line, "utf8") > 2000) {
      throw new Error("Static homepage CSP exceeds the Cloudflare _headers line limit");
    }
  }
  writeFileSync(join(openNextAssetsDir, "_headers"), [
    "/", ...staticHeaders,
    "/index.html", ...staticHeaders, "",
  ].join("\n"));
} else {
  writeFileSync(join(openNextAssetsDir, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  writeFileSync(join(openNextAssetsDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
}
