#!/usr/bin/env node
/* global AbortController, clearTimeout, console, fetch, process, setTimeout */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://canopyproof.org";
const DEFAULT_WWW_URL = "https://www.canopyproof.org";
const DEFAULT_TIMEOUT_MS = 25_000;

export const REQUIRED_SMOKE_LABELS = [
  "root",
  "www-root",
  "robots",
  "sitemap",
  "icon",
  "api-ready",
  "admin-blocked",
  "homepage-copy-safe",
];

export const UNSAFE_HOMEPAGE_PATTERNS = [
  /certified carbon credit/i,
  /tax offset/i,
  /guaranteed yield/i,
  /automatic CANOPY distribution/i,
  /mainnet funds live/i,
];

export function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function cleanBaseUrl(value) {
  return value.replace(/\/+$/u, "");
}

function routeUrl(baseUrl, path) {
  return `${cleanBaseUrl(baseUrl)}${path}`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await options.fetcher(url, {
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function passed(label, url, details = {}) {
  return { label, url, ok: true, ...details };
}

function failed(label, url, details = {}) {
  return { label, url, ok: false, ...details };
}

async function statusCheck(label, url, expectedStatus, options) {
  try {
    const response = await fetchWithTimeout(url, options);
    return response.status === expectedStatus
      ? passed(label, url, { status: response.status, finalUrl: response.url || url })
      : failed(label, url, { status: response.status, expectedStatus, finalUrl: response.url || url });
  } catch (error) {
    return failed(label, url, { expectedStatus, error: error instanceof Error ? error.message : String(error) });
  }
}

async function rootCheck(baseUrl, options) {
  const url = routeUrl(baseUrl, "/");
  try {
    const response = await fetchWithTimeout(url, options);
    const body = await response.text();
    return response.status === 200
      ? passed("root", url, { status: response.status, finalUrl: response.url || url, body })
      : failed("root", url, { status: response.status, expectedStatus: 200, finalUrl: response.url || url, body });
  } catch (error) {
    return failed("root", url, { expectedStatus: 200, error: error instanceof Error ? error.message : String(error) });
  }
}

async function sitemapCheck(baseUrl, options) {
  const url = routeUrl(baseUrl, "/sitemap.xml");
  try {
    const response = await fetchWithTimeout(url, options);
    const body = await response.text();
    const includesRoot = body.includes("<loc>https://canopyproof.org/</loc>");
    const includesStatus = body.includes("<loc>https://canopyproof.org/status</loc>");
    const ok = response.status === 200 && includesRoot && includesStatus;

    return ok
      ? passed("sitemap", url, { status: response.status, includesRoot, includesStatus })
      : failed("sitemap", url, { status: response.status, expectedStatus: 200, includesRoot, includesStatus });
  } catch (error) {
    return failed("sitemap", url, { expectedStatus: 200, error: error instanceof Error ? error.message : String(error) });
  }
}

async function iconCheck(baseUrl, options) {
  const url = routeUrl(baseUrl, "/icon.jpg");
  try {
    const response = await fetchWithTimeout(url, options);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const isImage = /^image\//iu.test(contentType);
    const hasBody = bytes.length > 0;
    const ok = response.status === 200 && isImage && hasBody;

    return ok
      ? passed("icon", url, { status: response.status, contentType, bytes: bytes.length })
      : failed("icon", url, { status: response.status, expectedStatus: 200, contentType, bytes: bytes.length });
  } catch (error) {
    return failed("icon", url, { expectedStatus: 200, error: error instanceof Error ? error.message : String(error) });
  }
}

function homepageCopyCheck(rootResult) {
  const url = rootResult.url;
  const body = typeof rootResult.body === "string" ? rootResult.body : "";
  const matches = UNSAFE_HOMEPAGE_PATTERNS.filter((pattern) => pattern.test(body)).map((pattern) => pattern.source);

  return matches.length === 0
    ? passed("homepage-copy-safe", url, { unsafeMatches: [] })
    : failed("homepage-copy-safe", url, { unsafeMatches: matches });
}

export async function runSmoke(input = {}) {
  const baseUrl = cleanBaseUrl(input.baseUrl ?? process.env.CANOPYPROOF_BASE_URL ?? DEFAULT_BASE_URL);
  const wwwUrl = cleanBaseUrl(input.wwwUrl ?? process.env.CANOPYPROOF_WWW_URL ?? DEFAULT_WWW_URL);
  const expectApiReady = input.expectApiReady ?? parseBoolean(process.env.CANOPYPROOF_EXPECT_API_READY, true);
  const reportDir = input.reportDir ?? "reports";
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? new Date();
  const options = { fetcher, timeoutMs };

  const checks = [];
  const rootResult = await rootCheck(baseUrl, options);
  checks.push(rootResult);
  checks.push(await statusCheck("www-root", wwwUrl, 200, options));
  checks.push(await statusCheck("robots", routeUrl(baseUrl, "/robots.txt"), 200, options));
  checks.push(await sitemapCheck(baseUrl, options));
  checks.push(await iconCheck(baseUrl, options));

  if (expectApiReady) {
    checks.push(await statusCheck("api-ready", routeUrl(baseUrl, "/api/ready"), 200, options));
  } else {
    checks.push(passed("api-ready", routeUrl(baseUrl, "/api/ready"), { skipped: true }));
  }

  checks.push(await statusCheck("admin-blocked", routeUrl(baseUrl, "/api/admin/launch/readiness"), 403, options));
  checks.push(homepageCopyCheck(rootResult));

  const sanitizedChecks = checks.map((check) => {
    const sanitized = { ...check };
    delete sanitized.body;
    return sanitized;
  });

  const summary = {
    ok: checks.every((check) => check.ok),
    generatedAt: now.toISOString(),
    baseUrl,
    wwwUrl,
    expectApiReady,
    checks: sanitizedChecks,
    rollback: [
      "If homepage root fails after deployment, rollback the web OpenNext Worker to the previous successful deployment.",
      "If /api/ready fails while web root passes, inspect API proxy route precedence and DROPIN_API_ORIGIN before rolling back web.",
      "If /api/admin/* returns 200, treat as a critical incident and force DROPIN_ALLOW_ADMIN_PROXY=false before re-running smoke.",
      "If unsafe carbon-credit or yield language appears, treat it as a content release blocker and rollback or patch immediately.",
    ],
  };

  await writeSmokeReports(summary, reportDir);
  return summary;
}

export async function writeSmokeReports(summary, reportDir = "reports") {
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "canopyproof-production-smoke.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(join(reportDir, "canopyproof-production-smoke.md"), smokeMarkdown(summary));
}

export function smokeMarkdown(summary) {
  const lines = [
    "# CanopyProof Production Smoke Report",
    "",
    `Generated: ${summary.generatedAt}`,
    `Status: ${summary.ok ? "PASS" : "FAIL"}`,
    `Base URL: ${summary.baseUrl}`,
    `WWW URL: ${summary.wwwUrl}`,
    "",
    "## Checks",
    "",
    "| Check | Result | Status | URL |",
    "| --- | --- | --- | --- |",
    ...summary.checks.map((check) => {
      const status = check.status ?? (check.skipped ? "skipped" : "");
      return `| ${check.label} | ${check.ok ? "PASS" : "FAIL"} | ${status} | ${check.url} |`;
    }),
    "",
    "## Rollback Triggers",
    "",
    ...summary.rollback.map((item) => `- ${item}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main() {
  const summary = await runSmoke();
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
