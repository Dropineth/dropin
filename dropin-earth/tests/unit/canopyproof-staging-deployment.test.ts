import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  REQUIRED_SITEMAP_PATHS,
  STAGING_PUBLIC_ROUTES,
  runStagingSmoke,
} from "../../scripts/canopyproof-staging-smoke.mjs";
import {
  runStagingPreflight,
  validateResourceManifest,
  validateStagingOrigin,
} from "../../scripts/canopyproof-staging-preflight.mjs";

const repositoryRoot = join(process.cwd(), "..");
const workflowPath = join(
  repositoryRoot,
  ".github",
  "workflows",
  "deploy-canopyproof-staging.yml",
);
const webConfigPath = join(process.cwd(), "apps", "web", "wrangler.staging.jsonc");
const apiConfigPath = join(
  process.cwd(),
  "infra",
  "cloudflare",
  "canopyproof-api-proxy.staging.wrangler.jsonc",
);
const runbookPath = join(process.cwd(), "docs", "CANOPYPROOF_STAGING_RUNBOOK.md");
const targetSha = "7f7b7027fbd7ae08f35bdcb4d256d0242ceceac2";
const stagingApiOrigin = "https://staging-api-origin.example.test";

function resourceManifest() {
  return JSON.stringify({
    schemaVersion: 1,
    environment: "canopyproof-staging",
    apiOrigin: stagingApiOrigin,
    productionData: false,
    database: {
      kind: "postgresql",
      identifier: "canopyproof-staging-postgresql",
      productionData: false,
    },
    objectStorage: {
      identifier: "canopyproof-staging-evidence",
      productionData: false,
    },
  });
}

function preflightEnvironment(overrides: Record<string, string> = {}) {
  const manifest = resourceManifest();
  return {
    STAGING_CONFIRM: "isolated-canopyproof-staging",
    REQUESTED_TARGET_SHA: targetSha,
    RESOURCE_MANIFEST_SHA256: createHash("sha256").update(manifest).digest("hex"),
    CLOUDFLARE_API_TOKEN: "test-token-not-a-real-secret",
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    CANOPYPROOF_STAGING_API_ORIGIN: stagingApiOrigin,
    CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON: manifest,
    DROPIN_PRODUCTION_API_ORIGIN: "https://production-api-origin.example.test",
    ...overrides,
  };
}

test("staging workflow is exact-SHA, reviewer-gated, isolated, and non-production", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  assert.match(workflow, /name: CanopyProof Isolated Staging Deploy/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types:\n\s+- labeled/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.event\.label\.name == 'canopyproof-staging'/);
  assert.match(
    workflow,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.match(workflow, /environment: canopyproof-staging/);
  assert.match(workflow, /node-version: 22\.22\.3/);
  assert.match(workflow, /npm install --global npm@10\.9\.4/);
  assert.match(workflow, /ref: \$\{\{ env\.REQUESTED_TARGET_SHA \}\}/);
  assert.match(workflow, /actual_sha="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /Manual staging target must equal the industrial RC branch tip/);
  assert.match(workflow, /npm ci --include=optional/);
  assert.match(workflow, /npm run gate:supply-chain/);
  assert.match(workflow, /npm run ci/);
  assert.match(workflow, /npm run db:verify:canopyproof:native/);
  assert.match(workflow, /npm run test:coverage:ratchet/);
  assert.match(workflow, /npm run ci:critical/);
  assert.match(
    workflow,
    /npx playwright install --with-deps chromium firefox webkit/,
  );
  assert.match(workflow, /npm run test:webgl:browser/);
  assert.match(workflow, /npm run test:workerd/);
  assert.match(workflow, /postgres:17\.10/);
  assert.match(workflow, /canopyproof-web-staging/);
  assert.match(workflow, /canopyproof-api-staging/);
  assert.match(workflow, /canopyproof-staging-preflight\.mjs/);
  assert.match(workflow, /canopyproof-staging-smoke\.mjs/);
  assert.match(workflow, /CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON/);
  assert.match(workflow, /CANOPYPROOF_STAGING_API_ORIGIN/);
  assert.match(
    workflow,
    /RESOURCE_MANIFEST_SHA256: \$\{\{ vars\.CANOPYPROOF_STAGING_RESOURCE_MANIFEST_SHA256 \}\}/,
  );
  assert.match(
    workflow,
    /Manual manifest digest must equal the protected Environment value/,
  );
  assert.match(workflow, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.match(workflow, /CANOPY_PRODUCTION_UNLOCK: "false"/);
  assert.match(workflow, /PLANETARY_LAB: "false"/);
  assert.doesNotMatch(workflow, /DROPIN_ALLOW_ADMIN_PROXY: "true"/);
  assert.doesNotMatch(workflow, /CANOPY_PRODUCTION_UNLOCK: "true"/);
  assert.doesNotMatch(workflow, /environment: canopyproof-production/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /canopyproof\.org\/\*/);
  assert.doesNotMatch(workflow, /www\.canopyproof\.org\/\*/);

  const apiDeployIndex = workflow.indexOf(
    "- name: Deploy separate staging API proxy Worker",
  );
  for (const requiredGate of [
    "npm run gate:supply-chain",
    "npm run test:coverage:ratchet",
    "npm run ci:critical",
    "npm run test:webgl:browser",
    "npm run test:workerd",
  ]) {
    const gateIndex = workflow.indexOf(requiredGate);
    assert.ok(gateIndex >= 0, `missing staging gate: ${requiredGate}`);
    assert.ok(
      gateIndex < apiDeployIndex,
      `${requiredGate} must pass before either staging Worker is deployed`,
    );
  }

  const jobEnvironment = workflow.match(
    /\n[ ]{4}env:\n(?<contents>[\s\S]*?)\n\n[ ]{4}steps:/,
  )?.groups?.contents;
  assert.ok(jobEnvironment);
  assert.doesNotMatch(
    jobEnvironment,
    /(?:^|\n)\s+(?:DATABASE_URL|CANOPYPROOF_NATIVE_DATABASE_URL):/,
  );
  assert.doesNotMatch(workflow, />> "\$GITHUB_ENV"/);
});

test("staging Wrangler configs expose only separate workers.dev services", () => {
  const webConfig = JSON.parse(readFileSync(webConfigPath, "utf8")) as {
    name: string;
    routes?: unknown;
    workers_dev: boolean;
    services: Array<{ binding: string; service: string }>;
    vars: Record<string, string>;
  };
  const apiConfig = JSON.parse(readFileSync(apiConfigPath, "utf8")) as {
    name: string;
    routes?: unknown;
    workers_dev: boolean;
    vars: Record<string, string>;
  };

  assert.equal(webConfig.name, "canopyproof-web-staging");
  assert.equal(apiConfig.name, "canopyproof-api-staging");
  assert.equal(webConfig.workers_dev, true);
  assert.equal(apiConfig.workers_dev, true);
  assert.equal(webConfig.routes, undefined);
  assert.equal(apiConfig.routes, undefined);
  assert.deepEqual(webConfig.services, [
    {
      binding: "WORKER_SELF_REFERENCE",
      service: "canopyproof-web-staging",
    },
  ]);
  assert.equal(apiConfig.vars.DROPIN_ALLOW_ADMIN_PROXY, "false");
  assert.equal(apiConfig.vars.DROPIN_CANOPYPROOF_MODE, "testnet");
  assert.equal(webConfig.vars.CANOPY_PRODUCTION_UNLOCK, "false");
  assert.equal(webConfig.vars.DROPIN_ALLOW_ADMIN_PROXY, "false");
  assert.equal(webConfig.vars.DROPIN_AUTOMATIC_CANOPY_DISTRIBUTION_ENABLED, "false");
  assert.equal(webConfig.vars.DROPIN_MAINNET_TRANSFERS_ENABLED, "false");
  assert.equal(webConfig.vars.DROPIN_PHASE16_PROTOCOL_WRITES_ENABLED, "false");
  assert.equal(webConfig.vars.NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS, "false");
  assert.equal(webConfig.vars.PLANETARY_LAB, "false");
  assert.match(webConfig.vars.NEXT_PUBLIC_DROPIN_API_URL, /\.invalid\/api$/u);
  assert.match(apiConfig.vars.DROPIN_API_ORIGIN, /\.invalid$/u);
});

test("staging runbook requires independent review and isolated resources", () => {
  const runbook = readFileSync(runbookPath, "utf8");

  assert.match(runbook, /Status: NOT DEPLOYED/u);
  assert.match(runbook, /same independent reviewer set as `canopyproof-production`/u);
  assert.match(runbook, /self-review prevention enabled/u);
  assert.match(runbook, /distinct HTTPS origin backed by isolated PostgreSQL and object storage/u);
  assert.match(runbook, /API and Web Workers remain separate/u);
  assert.match(runbook, /never assigns `canopyproof\.org\/\*`/u);
  assert.doesNotMatch(runbook, /Status: DEPLOYED/u);
});

test("staging preflight binds isolated resources without retaining credentials", () => {
  const result = runStagingPreflight(preflightEnvironment());

  assert.equal(result.environment, "canopyproof-staging");
  assert.equal(result.targetSha, targetSha);
  assert.equal(result.stagingApiOrigin, stagingApiOrigin);
  assert.equal(result.resourceManifest.database.kind, "postgresql");
  assert.equal(result.resourceManifest.database.productionData, false);
  assert.equal(result.resourceManifest.objectStorage.productionData, false);
  assert.equal(result.safetyBoundaries.DROPIN_ALLOW_ADMIN_PROXY, false);
  assert.equal(result.safetyBoundaries.CANOPY_PRODUCTION_UNLOCK, false);
  assert.doesNotMatch(JSON.stringify(result), /test-token-not-a-real-secret/u);
});

test("staging preflight rejects production origins, manifest tampering, and secret-bearing keys", () => {
  assert.throws(
    () => validateStagingOrigin("https://canopyproof.org"),
    /must not use production or local hosts/u,
  );
  assert.throws(
    () => validateStagingOrigin(stagingApiOrigin, stagingApiOrigin),
    /must be different/u,
  );

  const manifest = resourceManifest();
  assert.throws(
    () => validateResourceManifest(manifest, "0".repeat(64), stagingApiOrigin),
    /hash does not match/u,
  );
  const unsafeManifest = JSON.stringify({
    ...JSON.parse(manifest),
    database: {
      ...JSON.parse(manifest).database,
      password: "must-never-be-accepted",
    },
  });
  assert.throws(
    () =>
      validateResourceManifest(
        unsafeManifest,
        createHash("sha256").update(unsafeManifest).digest("hex"),
        stagingApiOrigin,
      ),
    /forbidden key/u,
  );
});

test("staging smoke verifies public routes, JPG assets, API readiness, and admin denial", async () => {
  const webOrigin = "https://canopyproof-web-staging.example.workers.dev";
  const apiOrigin = "https://canopyproof-api-staging.example.workers.dev";
  const icon = readFileSync(join(process.cwd(), "apps", "web", "public", "icon.jpg"));
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...REQUIRED_SITEMAP_PATHS.map((path) => {
      const url = path === "/" ? "https://canopyproof.org/" : `https://canopyproof.org${path}`;
      return `<url><loc>${url}</loc></url>`;
    }),
    "</urlset>",
  ].join("");
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.origin === apiOrigin && url.pathname === "/api/ready") {
      return Response.json({ ok: true });
    }
    if (url.origin === apiOrigin && url.pathname === "/api/admin/launch/readiness") {
      return Response.json({ error: "admin_proxy_disabled" }, { status: 403 });
    }
    if (url.origin !== webOrigin) {
      return new Response("unexpected origin", { status: 500 });
    }
    if (url.pathname === "/icon.svg") {
      return new Response("not found", { status: 404 });
    }
    if (url.pathname === "/icon.jpg" || url.pathname === "/apple-touch-icon.jpg") {
      return new Response(icon, {
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(sitemap, {
        headers: { "content-type": "application/xml" },
      });
    }
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n");
    }
    if (STAGING_PUBLIC_ROUTES.includes(url.pathname)) {
      return new Response("<!doctype html><title>CanopyProof</title>");
    }
    return new Response("not found", { status: 404 });
  };
  const reportDir = mkdtempSync(join(tmpdir(), "canopyproof-staging-smoke-"));

  try {
    const result = await runStagingSmoke({
      webUrl: webOrigin,
      apiUrl: apiOrigin,
      targetSha,
      fetcher,
      reportDir,
      now: new Date("2026-07-28T00:00:00.000Z"),
      workflowRunUrl: "https://github.com/Dropineth/dropin/actions/runs/1",
    });

    assert.equal(result.smoke.ok, true);
    assert.equal(result.deployment.status, "SMOKE_PASS");
    assert.equal(result.deployment.productionRoutesModified, false);
    assert.equal(result.deployment.productionDataUsed, false);
    assert.equal(result.deployment.apiAndWebWorkersSeparated, true);
    assert.equal(
      statSync(join(reportDir, "canopyproof-staging-deployment.json")).isFile(),
      true,
    );
    assert.equal(statSync(join(reportDir, "canopyproof-staging-smoke.json")).isFile(), true);
    assert.equal(statSync(join(reportDir, "canopyproof-staging-smoke.md")).isFile(), true);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("production sitemap advertises every required staging-smoke public route", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "apps", "web", "src", "app", "sitemap.ts"),
    "utf8",
  );
  const publicSitemap = readFileSync(
    join(process.cwd(), "apps", "web", "public", "sitemap.xml"),
    "utf8",
  );

  for (const path of REQUIRED_SITEMAP_PATHS) {
    if (path === "/") {
      assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/<\/loc>/u);
      continue;
    }
    assert.match(routeSource, new RegExp(`"${path.replaceAll("/", "\\/")}"`, "u"));
    assert.match(
      publicSitemap,
      new RegExp(`<loc>https:\\/\\/canopyproof\\.org${path.replaceAll("/", "\\/")}<\\/loc>`, "u"),
    );
  }
});
