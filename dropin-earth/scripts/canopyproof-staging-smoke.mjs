#!/usr/bin/env node
/* global AbortController, clearTimeout, console, fetch, process, setTimeout, TextDecoder, URL */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export const STAGING_PUBLIC_ROUTES = [
  "/",
  "/dashboard/global",
  "/explorer",
  "/governance",
  "/terra",
  "/mobile/report",
  "/partners",
  "/funding",
  "/risk",
  "/reports/esg",
  "/robots.txt",
];

export const REQUIRED_SITEMAP_PATHS = [
  "/",
  "/dashboard/global",
  "/explorer",
  "/governance",
  "/terra",
  "/mobile/report",
  "/partners",
  "/funding",
  "/risk",
  "/reports/esg",
];

const FORBIDDEN_TEXT_PATTERNS = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ["github-token", /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/u],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u],
  ["slack-webhook", /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,}/u],
  ["raw-latitude", /(?:"|data-)(?:raw|exact)?latitude(?:"|\s*=|\s*:)/iu],
  ["raw-longitude", /(?:"|data-)(?:raw|exact)?longitude(?:"|\s*=|\s*:)/iu],
  ["raw-scene-bounds", /(?:"|data-)sceneBounds(?:"|\s*=|\s*:)/iu],
  ["certified-carbon-credit", /certified carbon credit/iu],
  ["tax-offset", /tax offset/iu],
  ["guaranteed-yield", /guaranteed yield/iu],
  ["automatic-canopy-distribution", /automatic \$?CANOPY distribution/iu],
];

function trimTrailingSlash(value) {
  return value.replace(/\/+$/u, "");
}

function assertStagingUrl(label, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  if (
    url.hostname === "canopyproof.org" ||
    url.hostname === "www.canopyproof.org" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  ) {
    throw new Error(`${label} must reference isolated staging infrastructure`);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${label} must be an origin without credentials, query, fragment, or path`);
  }

  return trimTrailingSlash(url.origin);
}

function routeUrl(origin, path) {
  return `${origin}${path}`;
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

async function boundedText(response) {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TEXT_BYTES) {
    throw new Error(`response exceeds ${MAX_TEXT_BYTES} byte staging smoke limit`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_TEXT_BYTES) {
    throw new Error(`response exceeds ${MAX_TEXT_BYTES} byte staging smoke limit`);
  }
  return new TextDecoder().decode(bytes);
}

function textFindings(body) {
  return FORBIDDEN_TEXT_PATTERNS.filter(([, pattern]) => pattern.test(body)).map(
    ([category]) => category,
  );
}

async function publicRouteCheck(path, options) {
  const url = routeUrl(options.webOrigin, path);
  try {
    const response = await fetchWithTimeout(url, options);
    const body = await boundedText(response);
    const findings = textFindings(body);
    const hasCanopyProof =
      path !== "/" || /CanopyProof/iu.test(body) || /canopyproof/iu.test(response.url);
    return {
      label: `public:${path}`,
      url,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      findings,
      hasCanopyProof,
      ok: response.status === 200 && findings.length === 0 && hasCanopyProof,
    };
  } catch (error) {
    return {
      label: `public:${path}`,
      url,
      findings: [],
      hasCanopyProof: false,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

async function sitemapCheck(options) {
  const url = routeUrl(options.webOrigin, "/sitemap.xml");
  try {
    const response = await fetchWithTimeout(url, options);
    const body = await boundedText(response);
    const missingPaths = REQUIRED_SITEMAP_PATHS.filter((path) => {
      const canonicalUrl =
        path === "/" ? "https://canopyproof.org/" : `https://canopyproof.org${path}`;
      return !body.includes(`<loc>${canonicalUrl}</loc>`);
    });
    const findings = textFindings(body);
    return {
      label: "sitemap",
      url,
      status: response.status,
      missingPaths,
      findings,
      ok: response.status === 200 && missingPaths.length === 0 && findings.length === 0,
    };
  } catch (error) {
    return {
      label: "sitemap",
      url,
      missingPaths: [...REQUIRED_SITEMAP_PATHS],
      findings: [],
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

async function jpegCheck(path, options) {
  const url = routeUrl(options.webOrigin, path);
  try {
    const response = await fetchWithTimeout(url, options);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const jpeg =
      bytes.length > 1024 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff &&
      /^image\/jpeg(?:;|$)/iu.test(contentType);
    return {
      label: `jpeg:${path}`,
      url,
      status: response.status,
      contentType,
      bytes: bytes.length,
      ok: response.status === 200 && jpeg,
    };
  } catch (error) {
    return {
      label: `jpeg:${path}`,
      url,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

async function apiJsonCheck(label, path, expectedStatus, predicate, options) {
  const url = routeUrl(options.apiOrigin, path);
  try {
    const response = await fetchWithTimeout(url, options);
    const body = await boundedText(response);
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
    return {
      label,
      url,
      status: response.status,
      validPayload: predicate(payload),
      ok: response.status === expectedStatus && predicate(payload),
    };
  } catch (error) {
    return {
      label,
      url,
      error: error instanceof Error ? error.message : String(error),
      validPayload: false,
      ok: false,
    };
  }
}

async function missingSvgCheck(options) {
  const url = routeUrl(options.webOrigin, "/icon.svg");
  try {
    const response = await fetchWithTimeout(url, options);
    return {
      label: "svg-logo-absent",
      url,
      status: response.status,
      ok: response.status === 404,
    };
  } catch (error) {
    return {
      label: "svg-logo-absent",
      url,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

export async function runStagingSmoke(input = {}) {
  const webOrigin = assertStagingUrl(
    "CANOPYPROOF_STAGING_WEB_URL",
    input.webUrl ?? process.env.CANOPYPROOF_STAGING_WEB_URL ?? "",
  );
  const apiOrigin = assertStagingUrl(
    "CANOPYPROOF_STAGING_API_URL",
    input.apiUrl ?? process.env.CANOPYPROOF_STAGING_API_URL ?? "",
  );
  const targetSha = input.targetSha ?? process.env.REQUESTED_TARGET_SHA ?? "";
  if (!/^[0-9a-f]{40}$/u.test(targetSha)) {
    throw new Error("REQUESTED_TARGET_SHA must be a full lowercase commit SHA");
  }

  const options = {
    webOrigin,
    apiOrigin,
    fetcher: input.fetcher ?? fetch,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  const checks = [];
  for (const path of STAGING_PUBLIC_ROUTES) {
    checks.push(await publicRouteCheck(path, options));
  }
  checks.push(await sitemapCheck(options));
  checks.push(await jpegCheck("/icon.jpg", options));
  checks.push(await jpegCheck("/apple-touch-icon.jpg", options));
  checks.push(await missingSvgCheck(options));
  checks.push(
    await apiJsonCheck(
      "api-ready",
      "/api/ready",
      200,
      (payload) => payload !== null && payload.ok === true,
      options,
    ),
  );
  checks.push(
    await apiJsonCheck(
      "admin-blocked",
      "/api/admin/launch/readiness",
      403,
      (payload) => payload !== null && payload.error === "admin_proxy_disabled",
      options,
    ),
  );

  const generatedAt = (input.now ?? new Date()).toISOString();
  const smoke = {
    schemaVersion: 1,
    environment: "canopyproof-staging",
    generatedAt,
    targetSha,
    webOrigin,
    apiOrigin,
    wwwEquivalentConfigured: false,
    ok: checks.every((check) => check.ok),
    checks,
    featureFlags: {
      CANOPY_PRODUCTION_UNLOCK: false,
      DROPIN_ALLOW_ADMIN_PROXY: false,
      realSatelliteProviderWrites: false,
      productionMobileSync: false,
      automaticCanopyDistribution: false,
      mainnetFunds: false,
      PLANETARY_LAB: false,
      carbonCreditIssuance: false,
      taxOffsetClaims: false,
      guaranteedYieldClaims: false,
    },
  };
  const deployment = {
    schemaVersion: 1,
    environment: "canopyproof-staging",
    generatedAt,
    targetSha,
    workflowRunUrl: input.workflowRunUrl ?? process.env.CANOPYPROOF_WORKFLOW_RUN_URL ?? "",
    webWorker: "canopyproof-web-staging",
    apiWorker: "canopyproof-api-staging",
    webOrigin,
    apiOrigin,
    productionRoutesModified: false,
    productionDataUsed: false,
    apiAndWebWorkersSeparated: true,
    status: smoke.ok ? "SMOKE_PASS" : "SMOKE_FAIL",
  };

  await writeStagingReports(
    deployment,
    smoke,
    input.reportDir ?? process.env.CANOPYPROOF_STAGING_REPORT_DIR ?? "reports",
  );
  return { deployment, smoke };
}

export async function writeStagingReports(deployment, smoke, reportDir) {
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    join(reportDir, "canopyproof-staging-deployment.json"),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );
  await writeFile(
    join(reportDir, "canopyproof-staging-smoke.json"),
    `${JSON.stringify(smoke, null, 2)}\n`,
  );
  const rows = smoke.checks.map(
    (check) =>
      `| ${check.label} | ${check.ok ? "PASS" : "FAIL"} | ${check.status ?? ""} | ${check.url} |`,
  );
  await writeFile(
    join(reportDir, "canopyproof-staging-smoke.md"),
    [
      "# CanopyProof Staging Smoke",
      "",
      `Generated: ${smoke.generatedAt}`,
      `Target SHA: \`${smoke.targetSha}\``,
      `Status: ${smoke.ok ? "PASS" : "FAIL"}`,
      `Web: ${smoke.webOrigin}`,
      `API: ${smoke.apiOrigin}`,
      "",
      "| Check | Result | Status | URL |",
      "| --- | --- | --- | --- |",
      ...rows,
      "",
      "Production routes and production data were not used.",
      "",
    ].join("\n"),
  );
}

async function main() {
  const result = await runStagingSmoke();
  console.log(
    JSON.stringify({
      status: result.smoke.ok ? "PASS" : "FAIL",
      targetSha: result.smoke.targetSha,
      checks: result.smoke.checks.length,
    }),
  );
  process.exit(result.smoke.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
