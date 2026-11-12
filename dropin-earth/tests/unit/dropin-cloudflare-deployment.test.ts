import { renderedMetadata } from "../helpers/lifepp-metadata";
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

const childCommandsPath = "/api/canopyproof/child-stewardship/v1/commands";
const ordinaryCorsHeaders = "authorization,content-type,idempotency-key,x-dropin-client";

function childCommandPreflight(path = childCommandsPath, method: string | null = "POST", origin: string | null = "https://canopyproof.org") {
  const headers = new Headers({
    "access-control-request-headers": "authorization,content-type,if-match,x-child-upload-authorization",
  });
  if (method !== null) headers.set("access-control-request-method", method);
  if (origin !== null) headers.set("origin", origin);
  return new Request(`https://canopyproof.org${path}`, { method: "OPTIONS", headers });
}

test("Cloudflare child command POST preflight allows only the two additional required headers", async () => {
  const handler = createCanopyproofApiProxy({ fetcher: async () => { throw new Error("Preflight must not reach the origin"); } });
  for (const path of [childCommandsPath, `${childCommandsPath}?request=synthetic`]) {
    for (const origin of ["https://canopyproof.org", "https://www.canopyproof.org"]) {
      const response = await handler.fetch(childCommandPreflight(path, "POST", origin), env);
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(response.headers.get("access-control-allow-headers"), `${ordinaryCorsHeaders},if-match,x-child-upload-authorization`);
      assert.equal(response.headers.get("access-control-allow-methods"), "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      assert.equal(response.headers.get("access-control-allow-credentials"), null);
      assert.equal(response.headers.get("vary"), "origin");
    }
  }
});

test("Cloudflare child preflight does not reflect arbitrary requested headers", async () => {
  const handler = createCanopyproofApiProxy({ fetcher: async () => { throw new Error("Preflight must not reach the origin"); } });
  const request = childCommandPreflight();
  request.headers.set("access-control-request-headers", "if-match,x-child-upload-authorization,x-unapproved-header");
  const response = await handler.fetch(request, env);
  assert.equal(response.status, 204);
  // The missing requested header keeps this request inadmissible to the browser.
  assert.equal(response.headers.get("access-control-allow-headers"), `${ordinaryCorsHeaders},if-match,x-child-upload-authorization`);
  assert.doesNotMatch(response.headers.get("access-control-allow-headers") ?? "", /x-unapproved-header/);
});

test("Cloudflare child preflight exception does not expand other paths or lookalike routes", async () => {
  const handler = createCanopyproofApiProxy({ fetcher: async () => { throw new Error("Preflight must not reach the origin"); } });
  for (const path of [
    "/api/ready", "/api/admin/launch/readiness", "/api/canopyproof/child-stewardship/v1",
    "/api/canopyproof/child-stewardship/v1/guardian/sessions", "/api/canopyproof/child-stewardship/v1/draft-authorizations",
    `${childCommandsPath}/`, `${childCommandsPath}-extra`, `${childCommandsPath}/extra`, `${childCommandsPath}%2Fextra`,
    "/api/canopyproof/child-stewardship/v10/commands", "/api/canopyproof/child-stewardship/v1/%63ommands",
    "/api/ready?path=/api/canopyproof/child-stewardship/v1/commands",
  ]) {
    const response = await handler.fetch(childCommandPreflight(path), env);
    assert.equal(response.status, 204, path);
    assert.equal(response.headers.get("access-control-allow-headers"), ordinaryCorsHeaders, path);
  }
});

test("Cloudflare child preflight exception is limited to POST", async () => {
  const handler = createCanopyproofApiProxy({ fetcher: async () => { throw new Error("Preflight must not reach the origin"); } });
  for (const method of [null, "GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS", "post"]) {
    const response = await handler.fetch(childCommandPreflight(childCommandsPath, method), env);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-headers"), ordinaryCorsHeaders, String(method));
  }
});

test("Cloudflare child preflight keeps exact origin restrictions and never grants an originless request", async () => {
  const handler = createCanopyproofApiProxy({ fetcher: async () => { throw new Error("Preflight must not reach the origin"); } });
  for (const origin of ["https://unapproved.example", "https://canopyproof.org.unapproved.example", "http://canopyproof.org", "null"]) {
    const response = await handler.fetch(childCommandPreflight(childCommandsPath, "POST", origin), env);
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), null, origin);
    assert.equal(response.headers.get("access-control-allow-headers"), null, origin);
  }
  const absent = await handler.fetch(childCommandPreflight(childCommandsPath, "POST", null), env);
  assert.equal(absent.status, 204);
  assert.equal(absent.headers.get("access-control-allow-origin"), null);
  assert.equal(absent.headers.get("access-control-allow-headers"), null);
});

test("Cloudflare child command forwarding preserves opaque authorization through the isolated binding", async () => {
  const handler = createCanopyproofApiProxy({
    fetcher: async () => { throw new Error("Child requests must not reach the generic origin"); },
  });
  const childBackend = {
    fetch: async (request: Request) => {
      assert.equal(request.url, "https://canopyproof.org/canopyproof/child-stewardship/v1/commands?request=synthetic");
      assert.equal(request.method, "POST");
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-test-token");
      assert.equal(request.headers.get("if-match"), '"7"');
      assert.equal(request.headers.get("x-child-upload-authorization"), "synthetic-test-proof");
      assert.equal(await request.text(), "{}");
      return new Response("{}", { status: 200 });
    },
  };
  const response = await handler.fetch(new Request(`https://canopyproof.org${childCommandsPath}?request=synthetic`, {
    method: "POST", body: "{}", headers: {
      origin: "https://canopyproof.org", "content-type": "application/json", authorization: "Bearer synthetic-test-token",
      "if-match": '"7"', "x-child-upload-authorization": "synthetic-test-proof",
    },
  }), { ...env, DROPIN_CHILD_BACKEND_MODE: "synthetic-demo", CHILD_BACKEND: childBackend });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-headers"), ordinaryCorsHeaders);
});

test("Cloudflare deployment docs preserve the separated guarded OpenNext path", () => {
  const text = readFileSync(join(process.cwd(), "docs/deploy-cloudflare.md"), "utf8");

  assert.match(text, /API proxy remains a separate Worker/);
  assert.match(text, /Public `\/api\/admin\/\*` access must return `403`/);
  assert.match(text, /Do not deploy `\.next` directly as a static artifact/);
  assert.match(text, /release-council controlled path remains/);
  assert.match(text, /No manual\s+override is allowed/);
  assert.match(text, /SSL\/TLS `Full \(strict\)`/);
  assert.match(text, /Impact Certificates remain proof records, not certified carbon credits/);
  assert.doesNotMatch(text, /wrangler pages deploy/);
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

test("R0 baseline excludes legacy deployment notification automation", () => {
  assert.equal(existsSync(join(process.cwd(), "scripts/deploy-notify.py")), false);
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
  assert.equal(existsSync(join(process.cwd(), "apps/web/public/sitemap.xml")), false, "No duplicate public file may shadow the metadata route");
  assert.equal(existsSync(join(process.cwd(), "apps/web/public/robots.txt")), false, "No duplicate public robots file");
  assert.equal(statSync(join(process.cwd(), "apps/web/public/icon.jpg")).isFile(), true);
  assert.equal(statSync(join(process.cwd(), "apps/web/public/apple-touch-icon.jpg")).isFile(), true);
  assert.equal(existsSync(join(process.cwd(), "apps/web/public/icon.svg")), false);

  const sitemapRoute = readFileSync(join(process.cwd(), "apps/web/src/app/sitemap.ts"), "utf8");
  const productionMetadata = renderedMetadata(true);
  const publicSitemap = productionMetadata.sitemap.map(item => `<loc>${item.url}</loc>`).join("\n");
  const robots = `Sitemap: ${productionMetadata.robots.sitemap}`;
  const previewMetadata = renderedMetadata(false);
  assert.deepEqual(previewMetadata.sitemap, []);
  assert.equal(previewMetadata.robots.rules[0]?.disallow, "/");
  const icon = readFileSync(join(process.cwd(), "apps/web/public/icon.jpg"));
  const appleIcon = readFileSync(join(process.cwd(), "apps/web/public/apple-touch-icon.jpg"));

  assert.match(sitemapRoute, /MetadataRoute\.Sitemap/);
  assert.match(sitemapRoute, /https:\/\/canopyproof\.org/);
  assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/<\/loc>/);
  assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/status<\/loc>/);
  assert.match(robots, /Sitemap: https:\/\/canopyproof\.org\/sitemap\.xml/);
  assert.ok(icon.length > 1024, "icon.jpg must be a non-empty production logo image");
  assert.equal(icon[0], 0xff, "icon.jpg must start with JPEG SOI byte 0xff");
  assert.equal(icon[1], 0xd8, "icon.jpg must start with JPEG SOI byte 0xd8");
  assert.equal(icon[2], 0xff, "icon.jpg must contain a JPEG marker byte");
  assert.ok(appleIcon.equals(icon), "apple-touch-icon.jpg must match the official production logo image");
});

test("CanopyProof static smoke routes bypass the OpenNext server function path", () => {
  const page = readFileSync(join(process.cwd(), "apps/web/src/app/page.tsx"), "utf8");
  const middleware = readFileSync(join(process.cwd(), "apps/web/src/middleware.ts"), "utf8");
  const webPackage = JSON.parse(readFileSync(join(process.cwd(), "apps/web/package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const promoteScript = readFileSync(join(process.cwd(), "apps/web/scripts/promote-static-homepage.mjs"), "utf8");

  assert.match(page, /export const dynamic = "force-static"/);
  assert.doesNotMatch(page, /export const runtime = "edge"/);
  assert.match(middleware, /\(\?!\$[^"]*robots\.txt[^"]*sitemap\.xml[^"]*icon\.jpg/);
  assert.match(middleware, /apple-touch-icon\.jpg/);
  assert.match(webPackage.scripts?.["opennext:build"] ?? "", /promote-static-homepage\.mjs/);
  assert.match(promoteScript, /\.next", "server", "app"/);
  assert.match(promoteScript, /\.open-next", "assets"/);
  assert.match(promoteScript, /index\.html/);
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
  const auditedPostcssVersion = "8.5.26";
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

  assert.equal(rootPackage.devDependencies?.postcss, auditedPostcssVersion);
  assert.equal(rootPackage.overrides?.postcss, auditedPostcssVersion);
  assert.equal(webPackage.devDependencies?.postcss, auditedPostcssVersion);
  assert.equal(lockfile.packages?.[""]?.devDependencies?.postcss, auditedPostcssVersion);
  assert.equal(lockfile.packages?.["apps/web"]?.devDependencies?.postcss, auditedPostcssVersion);
  assert.equal(lockfile.packages?.["node_modules/postcss"]?.version, auditedPostcssVersion);
});

test("GitHub Actions deploy workflow is manual, approved, and keeps guardrails", () => {
  const legacyWorkflowPath = join(process.cwd(), ".github/workflows/deploy-canopyproof.yml");
  const webWorkerWorkflow = readFileSync(join(process.cwd(), ".github/workflows/deploy-cloudflare-worker.yml"), "utf8");
  const rootPackage = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const webPackage = readFileSync(join(process.cwd(), "apps/web/package.json"), "utf8");

  assert.equal(existsSync(legacyWorkflowPath), false);
  assert.match(webWorkerWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(webWorkerWorkflow, /\n\s*push:/);
  assert.match(webWorkerWorkflow, /environment: canopyproof-production/);
  assert.match(webWorkerWorkflow, /deploy_confirm:/);
  assert.match(webWorkerWorkflow, /phase_confirm:/);
  assert.match(webWorkerWorkflow, /target_sha:/);
  assert.match(webWorkerWorkflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(webWorkerWorkflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(webWorkerWorkflow, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.doesNotMatch(webWorkerWorkflow, /DROPIN_ALLOW_ADMIN_PROXY: "true"/);
  assert.match(webWorkerWorkflow, /phase16-9-verify-release-approval\.mjs/);
  assert.match(webWorkerWorkflow, /reports\/phase16-9-release-council-approval\.json/);
  assert.match(webWorkerWorkflow, /npm --workspace apps\/web run cf:deploy/);
  assert.doesNotMatch(webWorkerWorkflow, /wrangler pages deploy/);

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
  assert.equal(rootPackageJson.devDependencies?.["@opennextjs/cloudflare"], "1.20.13");
  assert.equal(rootPackageJson.devDependencies?.wrangler, "4.148.0");

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
