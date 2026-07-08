import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildUpstreamUrl,
  createCanopyproofApiProxy,
  validateCanopyproofCloudflareConfig,
} from "../../infra/cloudflare/canopyproof-api-proxy.ts";

const env = {
  DROPIN_API_ORIGIN: "https://api.dropin.example",
  DROPIN_ALLOWED_ORIGINS: "https://canopyproof.org,https://www.canopyproof.org",
  DROPIN_CANOPYPROOF_MODE: "production",
  DROPIN_CANONICAL_HOST: "canopyproof.org",
  DROPIN_ALLOW_ADMIN_PROXY: "false",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workflowStepBlock(workflow: string, stepName: string) {
  const match = workflow.match(new RegExp(`\\n\\s+- name: ${escapeRegExp(stepName)}\\n[\\s\\S]*?(?=\\n\\s+- name: |\\n\\s*$)`));
  assert.ok(match, `workflow step "${stepName}" must exist`);
  return match[0];
}

function assertStepRunsInDropinEarth(workflow: string, stepName: string) {
  const block = workflowStepBlock(workflow, stepName);
  assert.match(block, /working-directory:\s*dropin-earth/, `${stepName} must run from dropin-earth`);
}

test("Cloudflare config requires HTTPS API origin in production", () => {
  const result = validateCanopyproofCloudflareConfig({
    ...env,
    DROPIN_API_ORIGIN: "http://api.dropin.example",
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Production API origin must use HTTPS/);
});

test("Cloudflare proxy strips /api prefix and preserves query", () => {
  const upstream = buildUpstreamUrl("https://canopyproof.org/api/status/system?mode=testnet", new URL("https://api.dropin.example"));

  assert.equal(upstream.toString(), "https://api.dropin.example/status/system?mode=testnet");
});

test("Cloudflare proxy forwards allowed public API requests with security headers", async () => {
  const handler = createCanopyproofApiProxy({
    requestIdFactory: () => "edge-test-request",
    fetcher: async (request) =>
      new Response(JSON.stringify({ upstreamUrl: request.url, requestId: request.headers.get("x-dropin-edge-request-id") }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  const response = await handler.fetch(
    new Request("https://canopyproof.org/api/ready", {
      headers: { origin: "https://canopyproof.org" },
    }),
    env,
  );
  const body = (await response.json()) as { upstreamUrl: string; requestId: string };

  assert.equal(response.status, 200);
  assert.equal(body.upstreamUrl, "https://api.dropin.example/ready");
  assert.equal(body.requestId, "edge-test-request");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://canopyproof.org");
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age/);
});

test("Cloudflare proxy blocks admin routes by default", async () => {
  const handler = createCanopyproofApiProxy({
    requestIdFactory: () => "edge-test-request",
    fetcher: async () => new Response("should-not-call"),
  });

  const response = await handler.fetch(new Request("https://canopyproof.org/api/admin/launch/readiness"), env);
  const body = (await response.json()) as { error: string };

  assert.equal(response.status, 403);
  assert.equal(body.error, "admin_proxy_disabled");
});

test("Cloudflare deployment docs preserve safe Next.js and production launch guidance", () => {
  const text = readFileSync(join(process.cwd(), "docs/deployment-cloudflare-canopyproof.md"), "utf8");

  assert.match(text, /Do not treat `\.next` as a static Pages output directory/);
  assert.match(text, /NEXT_PUBLIC_DROPIN_API_URL=https:\/\/canopyproof\.org\/api/);
  assert.match(text, /Full \(strict\)/);
  assert.match(text, /HSTS carefully/);
  assert.match(text, /Impact Certificate is not a certified carbon credit/);
  assert.match(text, /RWA Fragment is not guaranteed yield/);
});

test("CanopyProof deploy script keeps secrets in env and refuses unsafe Pages output", () => {
  const text = readFileSync(join(process.cwd(), "scripts/deploy-canopyproof.sh"), "utf8");

  assert.match(text, /CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(text, /CF_API_TOKEN=/);
  assert.match(text, /DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof\.org/);
  assert.match(text, /Refusing to publish \.next as a static Pages artifact/);
  assert.match(text, /DROPIN_CANOPYPROOF_MODE="\$\{DROPIN_CANOPYPROOF_MODE:-production\}"/);
  assert.match(text, /DROPIN_ALLOW_ADMIN_PROXY="\$\{DROPIN_ALLOW_ADMIN_PROXY:-false\}"/);
  assert.match(text, /DROPIN_NOTIFY_DEPLOYMENT="\$\{DROPIN_NOTIFY_DEPLOYMENT:-true\}"/);
  assert.match(text, /DROPIN_NOTIFY_DRY_RUN="\$\{DROPIN_NOTIFY_DRY_RUN:-false\}"/);
  assert.match(text, /notify_deployment\(\)/);
  assert.match(text, /SLACK_WEBHOOK_URL/);
  assert.match(text, /TELEGRAM_BOT_TOKEN/);
  assert.match(text, /TELEGRAM_CHAT_ID/);
  assert.match(text, /Deployment notification secrets are configured, but external notifications are skipped in dry-run mode/);
  assert.match(text, /WORKER_ZONE_NAME="\$\{WORKER_ZONE_NAME:-\$\{CANOPYPROOF_ZONE_NAME:-canopyproof\.org\}\}"/);
  assert.match(text, /wrangler deploy --config/);
  assert.match(text, /wrangler pages deploy/);
  assert.match(text, /DROPIN_FRONTEND_DEPLOY_MODE:-skip/);
  assert.match(text, /skip\|auto\|pages-static\|opennext/);
  assert.match(text, /Auto-detected frontend mode/);
  assert.match(text, /DROPIN_OPENNEXT_DEPLOY_COMMAND is required for opennext mode/);
  assert.doesNotMatch(text, /experimental-worker/);
  assert.doesNotMatch(text, /wrangler pages publish "\$NEXT_BUILD_DIR"/);
});

test("Deployment notification script supports Slack and Telegram without third-party dependencies", () => {
  const text = readFileSync(join(process.cwd(), "scripts/deploy-notify.py"), "utf8");

  assert.match(text, /Notify Slack and Telegram/);
  assert.match(text, /urllib\.request/);
  assert.match(text, /SLACK_WEBHOOK_URL is empty/);
  assert.match(text, /TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is empty/);
  assert.match(text, /API Ready/);
  assert.match(text, /Admin Launch Readiness/);
  assert.doesNotMatch(text, /import requests/);
  assert.equal(Boolean(statSync(join(process.cwd(), "scripts/deploy-notify.py")).mode & 0o111), true);
});

test("Wrangler templates separate API proxy from OpenNext web worker safely", () => {
  const apiTemplate = readFileSync(join(process.cwd(), "infra/cloudflare/canopyproof-api-proxy.wrangler.toml.example"), "utf8");
  const webTemplate = readFileSync(join(process.cwd(), "infra/cloudflare/canopyproof-web-opennext.wrangler.toml.example"), "utf8");

  assert.match(apiTemplate, /canopyproof\.org\/api\/\*/);
  assert.match(apiTemplate, /DROPIN_ALLOW_ADMIN_PROXY = "false"/);
  assert.match(apiTemplate, /\[env\.testnet\.vars\]/);
  assert.match(apiTemplate, /\[env\.production\.vars\]/);
  assert.doesNotMatch(apiTemplate, /\[site\]/);
  assert.doesNotMatch(apiTemplate, /upload_format/);
  assert.doesNotMatch(apiTemplate, /type = "javascript"/);

  assert.match(webTemplate, /main = "\.open-next\/worker\.js"/);
  assert.match(webTemplate, /compatibility_flags = \["nodejs_compat"\]/);
  assert.match(webTemplate, /assets = \{ directory = "\.open-next\/assets", binding = "ASSETS" \}/);
  assert.match(webTemplate, /NEXT_PUBLIC_DROPIN_API_URL = "https:\/\/canopyproof\.org\/api"/);
  assert.doesNotMatch(webTemplate, /\[site\]/);
  assert.doesNotMatch(webTemplate, /bucket\s*=\s*".*\.next/);
  assert.doesNotMatch(webTemplate, /experimental/);
});

test("CanopyProof production metadata assets are present for OpenNext", () => {
  assert.equal(statSync(join(process.cwd(), "apps/web/src/app/sitemap.ts")).isFile(), true);
  assert.equal(statSync(join(process.cwd(), "apps/web/public/sitemap.xml")).isFile(), true);
  assert.equal(statSync(join(process.cwd(), "apps/web/public/icon.jpg")).isFile(), true);
  assert.equal(statSync(join(process.cwd(), "apps/web/public/apple-touch-icon.jpg")).isFile(), true);
  assert.equal(existsSync(join(process.cwd(), "apps/web/public/icon.svg")), false);

  const sitemapRoute = readFileSync(join(process.cwd(), "apps/web/src/app/sitemap.ts"), "utf8");
  const publicSitemap = readFileSync(join(process.cwd(), "apps/web/public/sitemap.xml"), "utf8");
  const icon = readFileSync(join(process.cwd(), "apps/web/public/icon.jpg"));
  const appleIcon = readFileSync(join(process.cwd(), "apps/web/public/apple-touch-icon.jpg"));

  assert.match(sitemapRoute, /MetadataRoute\.Sitemap/);
  assert.match(sitemapRoute, /https:\/\/canopyproof\.org/);
  assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/<\/loc>/);
  assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/status<\/loc>/);
  assert.ok(icon.length > 1024, "icon.jpg must be a non-empty production logo image");
  assert.equal(icon[0], 0xff, "icon.jpg must start with JPEG SOI byte 0xff");
  assert.equal(icon[1], 0xd8, "icon.jpg must start with JPEG SOI byte 0xd8");
  assert.equal(icon[2], 0xff, "icon.jpg must contain a JPEG marker byte");
  assert.ok(appleIcon.equals(icon), "apple-touch-icon.jpg must match the official production logo image");
});

test("CanopyProof OpenNext worker workflow installs deterministically from dropin-earth", () => {
  const workflows = [
    readFileSync(join(process.cwd(), "..", ".github/workflows/deploy-cloudflare-worker.yml"), "utf8"),
    readFileSync(join(process.cwd(), ".github/workflows/deploy-cloudflare-worker.yml"), "utf8"),
  ];

  for (const workflow of workflows) {
    assert.match(workflow, /Pin npm for deterministic Cloudflare install/);
    assert.match(workflow, /npm install -g npm@10\.9\.4/);
    assert.match(workflow, /cache-dependency-path: dropin-earth\/package-lock\.json/);
    assert.match(workflow, /working-directory: dropin-earth/);
    assert.match(workflowStepBlock(workflow, "Install dependencies"), /npm ci --include=optional/);
    assert.doesNotMatch(workflowStepBlock(workflow, "Install dependencies"), /run:\s*npm ci\s*$/m);

    for (const stepName of [
      "Install dependencies",
      "Lint web app",
      "Typecheck web app",
      "Run deployment safety tests",
      "Build web app",
      "Build OpenNext Worker artifact",
      "Deploy OpenNext Worker",
    ]) {
      assertStepRunsInDropinEarth(workflow, stepName);
    }

    assert.match(workflow, /phase16-9-verify-release-approval\.mjs/);
    assert.match(workflow, /Checked out SHA \$actual_sha does not match requested target/);
    assert.match(workflow, /npm --workspace apps\/web run cf:deploy/);
    assert.doesNotMatch(workflow, /wrangler pages deploy/);
  }
});

test("CanopyProof package metadata keeps npm ci PostCSS resolution locked", () => {
  const rootPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    devDependencies?: Record<string, string>;
    overrides?: Record<string, unknown>;
  };
  const webPackage = JSON.parse(readFileSync(join(process.cwd(), "apps/web/package.json"), "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  const lockfile = JSON.parse(readFileSync(join(process.cwd(), "package-lock.json"), "utf8")) as {
    packages?: Record<string, { version?: string; devDependencies?: Record<string, string> }>;
  };

  assert.equal(rootPackage.devDependencies?.postcss, "8.5.14");
  assert.equal(rootPackage.overrides?.postcss, "8.5.14");
  assert.equal(webPackage.devDependencies?.postcss, "8.5.14");
  assert.equal(lockfile.packages?.[""]?.devDependencies?.postcss, "8.5.14");
  assert.equal(lockfile.packages?.["apps/web"]?.devDependencies?.postcss, "8.5.14");
  assert.equal(lockfile.packages?.["node_modules/postcss"]?.version, "8.5.14");
});

test("GitHub Actions deploy workflow is production-only and keeps guardrails", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/deploy-canopyproof.yml"), "utf8");
  const webWorkerWorkflow = readFileSync(join(process.cwd(), ".github/workflows/deploy-cloudflare-worker.yml"), "utf8");
  const rootPackage = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const webPackage = readFileSync(join(process.cwd(), "apps/web/package.json"), "utf8");

  assert.match(workflow, /Dropin Production CI\/CD/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /default: "dry-run"/);
  assert.match(workflow, /canopyproof-production/);
  assert.match(workflow, /CANOPYPROOF_DOMAIN: canopyproof\.org/);
  assert.match(workflow, /WORKER_ROUTE: canopyproof\.org\/api\/\*/);
  assert.match(workflow, /DROPIN_CANOPYPROOF_MODE: production/);
  assert.match(workflow, /DROPIN_CLOUDFLARE_DEPLOY_CONFIRM/);
  assert.match(workflow, /DROPIN_PHASE16_DEPLOY_CONFIRM/);
  assert.match(workflow, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.match(workflow, /WORKER_ZONE_NAME: canopyproof\.org/);
  assert.match(workflow, /CF_ACCOUNT_ID_PROD/);
  assert.match(workflow, /WORKER_ZONE_ID_PROD/);
  assert.match(workflow, /DROPIN_SKIP_CI: "true"/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /npm --workspace apps\/web run build/);
  assert.match(workflow, /npm --workspace apps\/miniapp-ton run build/);
  assert.match(workflow, /npm --workspace services\/api run build/);
  assert.match(workflow, /npm run audit/);
  assert.match(workflow, /Deploy Pages and Worker through Phase16 business gate/);
  assert.match(workflow, /npm run deploy:phase16-production -- --live --output reports\/phase16-production-deploy-plan\.json/);
  assert.match(workflow, /reports\/phase16-production-deploy-plan\.json/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /DROPIN_OPENNEXT_DEPLOY_COMMAND: npm run deploy:web:cloudflare/);
  assert.match(workflow, /DROPIN_PAYMENT_MODE/);
  assert.match(workflow, /DROPIN_PRODUCTION_ASSETS_JSON/);
  assert.match(workflow, /DROPIN_KYC_PROVIDER_ENABLED/);
  assert.match(workflow, /DROPIN_TREASURY_MULTISIG_CONFIGURED/);
  assert.match(workflow, /SLACK_WEBHOOK_URL/);
  assert.match(workflow, /TELEGRAM_BOT_TOKEN/);
  assert.match(workflow, /TELEGRAM_CHAT_ID/);
  assert.match(workflow, /python3 scripts\/deploy-notify\.py/);
  assert.match(workflow, /DROPIN_NOTIFY_DEPLOYMENT: "false"/);
  assert.match(workflow, /DROPIN_NOTIFY_DRY_RUN: "false"/);
  assert.match(workflow, /dropin-api\.production\.invalid/);
  assert.doesNotMatch(workflow, /CF_API_TOKEN: YOUR/);
  assert.doesNotMatch(workflow, /target_environment:/);
  assert.doesNotMatch(workflow, /testnet\.canopyproof\.org/);
  assert.doesNotMatch(workflow, /matrix:/);

  const webPackageJson = JSON.parse(webPackage) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const rootPackageJson = JSON.parse(rootPackage) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.match(rootPackage, /deploy:web:cloudflare/);
  assert.equal(webPackageJson.scripts?.["build:cloudflare"], "npm run cf:build");
  assert.equal(rootPackageJson.devDependencies?.["@opennextjs/cloudflare"], "1.19.11");
  assert.equal(rootPackageJson.devDependencies?.wrangler, "4.107.0");

  assert.match(webWorkerWorkflow, /deploy_confirm:/);
  assert.match(webWorkerWorkflow, /phase_confirm:/);
  assert.match(webWorkerWorkflow, /target_sha:/);
  assert.match(webWorkerWorkflow, /canopyproof-production/);
  assert.match(webWorkerWorkflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(webWorkerWorkflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(webWorkerWorkflow, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.match(webWorkerWorkflow, /phase16-9-verify-release-approval\.mjs/);
  assert.match(webWorkerWorkflow, /reports\/phase16-9-release-council-approval\.json/);
  assert.doesNotMatch(webWorkerWorkflow, /wrangler pages deploy/);
});

test("CanopyProof auto deploy wrapper is production-only and delegates to the safe deploy script", () => {
  const rootWrapper = readFileSync(join(process.cwd(), "deploy-canopyproof-auto.sh"), "utf8");
  const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");

  assert.match(rootWrapper, /Production-only compatibility entrypoint/);
  assert.match(rootWrapper, /CANOPYPROOF_DOMAIN:-canopyproof\.org/);
  assert.match(rootWrapper, /WORKER_ROUTE:-canopyproof\.org\/api\/\*/);
  assert.match(rootWrapper, /DROPIN_CANOPYPROOF_MODE:-production/);
  assert.match(rootWrapper, /DROPIN_ALLOW_ADMIN_PROXY:-false/);
  assert.match(rootWrapper, /scripts\/deploy-canopyproof\.sh/);
  assert.doesNotMatch(rootWrapper, /deploy-canopyproof-matrix/);
  assert.doesNotMatch(packageJson, /deploy:canopyproof:matrix/);
  assert.equal(Boolean(statSync(join(process.cwd(), "deploy-canopyproof-auto.sh")).mode & 0o111), true);
});
