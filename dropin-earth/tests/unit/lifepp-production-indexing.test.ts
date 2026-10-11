import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { renderedMetadata } from "../helpers/lifepp-metadata";

const projectRoot = process.cwd();
const promoteScript = join(projectRoot, "apps/web/scripts/promote-static-homepage.mjs");
const productionMetadata = renderedMetadata(true);
const previewMetadata = renderedMetadata(false);
const publicKeys = ["NEXT_PUBLIC_CANOPYPROOF_MODE", "NEXT_PUBLIC_DROPIN_SITE_URL"] as const;
const fixtureScript = "window.__lifepp_fixture = true;";

function workflowBuildEnvironment(name: string): Record<string, string> {
  const source = readFileSync(join(projectRoot, "../.github/workflows", name), "utf8");
  // Public build values may be inherited from workflow-level env or job env.
  // Read only the two public settings; keep the no-shadow assertion across all jobs.
  const jobEnvironment = source.match(/^ {4}env:\n((?: {6}.*(?:\n|$))*)/m)?.[1];
  const globalEnvironment = source.match(/^env:\n((?: {2}.*(?:\n|$))*)/m)?.[1];
  assert.ok(jobEnvironment || globalEnvironment, `${name} must have an explicit inherited build environment`);
  const environment: Record<string, string> = {};
  for (const key of publicKeys) {
    const value = jobEnvironment?.match(new RegExp(`^ {6}${key}: (.+)$`, "m"))?.[1]
      ?? globalEnvironment?.match(new RegExp(`^ {2}${key}: (.+)$`, "m"))?.[1];
    assert.ok(value, `${name} must expose ${key} to build subprocesses`);
    assert.equal(source.match(new RegExp(`${key}:`, "g"))?.length, 1, `${name} must not shadow the public build setting`);
    environment[key] = value;
  }
  return environment;
}

function promotedFixture(environment: Record<string, string>, sourceIsProduction: boolean, omitRobots = false, fixtureHtml = `<!doctype html><title>FIXTURE ONLY</title><script>${fixtureScript}</script>`) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "lifepp-indexing-artifacts-"));
  try {
    const next = join(fixtureRoot, ".next/server/app");
    const assets = join(fixtureRoot, ".open-next/assets");
    mkdirSync(next, { recursive: true });
    // Synthetic Next artifact envelopes use actual metadata functions above. This
    // executes the real promotion script, not a deploy or full Next/OpenNext build.
    const metadata = sourceIsProduction ? productionMetadata : previewMetadata;
    const robots = sourceIsProduction
      ? `User-agent: *\nAllow: /\nSitemap: ${metadata.robots.sitemap}\n`
      : "User-agent: *\nDisallow: /\n";
    const sitemap = `<urlset>${metadata.sitemap.map((entry) => `<url><loc>${entry.url}</loc></url>`).join("")}</urlset>`;
    writeFileSync(join(next, "index.html"), fixtureHtml);
    writeFileSync(join(next, "index.rsc"), "FIXTURE RSC");
    if (!omitRobots) writeFileSync(join(next, "robots.txt.body"), robots);
    writeFileSync(join(next, "sitemap.xml.body"), sitemap);
    const result = spawnSync(process.execPath, [promoteScript], { cwd: fixtureRoot, env: environment, encoding: "utf8", timeout: 5000 });
    const read = (name: string) => existsSync(join(assets, name)) ? readFileSync(join(assets, name), "utf8") : null;
    return { status: result.status, error: result.error, stderr: result.stderr, robots: read("robots.txt"), sitemap: read("sitemap.xml"), headers: read("_headers"), html: read("index.html"), rsc: read("index.rsc"), sourceRobots: robots, sourceSitemap: sitemap };
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

for (const workflow of ["deploy-cloudflare-worker.yml", "deploy-canopyproof.yml"]) {
  test(`${workflow} passes production public variables through to indexable promoted artifacts`, () => {
    const environment = workflowBuildEnvironment(workflow);
    assert.deepEqual(environment, {
      NEXT_PUBLIC_CANOPYPROOF_MODE: "production",
      NEXT_PUBLIC_DROPIN_SITE_URL: "https://canopyproof.org",
    });
    const artifact = promotedFixture(environment, true);
    assert.equal(artifact.error, undefined);
    assert.equal(artifact.status, 0, artifact.stderr);
    assert.equal(artifact.robots, artifact.sourceRobots, "Production robots must not be replaced by preview disallow");
    assert.equal(artifact.sitemap, artifact.sourceSitemap);
    assert.match(artifact.sitemap ?? "", /<loc>https:\/\/canopyproof\.org\/life\/spaces\/31<\/loc>/);
    assert.match(artifact.sitemap ?? "", /<loc>https:\/\/canopyproof\.org\/en\/life\/spaces\/29<\/loc>/);
    const expectedHash = createHash("sha256").update(fixtureScript).digest("base64");
    assert.match(artifact.headers ?? "", new RegExp("script-src 'self' 'sha256-" + expectedHash + "'"), "Static home CSP must pin the exact built inline script");
    assert.match(artifact.headers ?? "", /^\/\n  Content-Security-Policy:/);
    assert.match(artifact.headers ?? "", /X-Frame-Options: DENY/);
    assert.match(artifact.headers ?? "", /Strict-Transport-Security: max-age=63072000/);
    assert.doesNotMatch(artifact.headers ?? "", /X-Robots-Tag:\s*noindex/, "Approved production homepage must remain indexable");
    assert.doesNotMatch(artifact.headers ?? "", /script-src[^;\n]*'unsafe-inline'/);
    assert.match(artifact.html ?? "", /FIXTURE ONLY/);
    assert.equal(artifact.rsc, "FIXTURE RSC");
  });
}

test("preview artifacts remain nonindexable with an empty sitemap", () => {
  const artifact = promotedFixture({ NEXT_PUBLIC_CANOPYPROOF_MODE: "staging", NEXT_PUBLIC_DROPIN_SITE_URL: "https://preview.example.invalid" }, false);
  assert.equal(artifact.status, 0, artifact.stderr);
  assert.equal(artifact.robots, "User-agent: *\nDisallow: /\n");
  assert.equal(artifact.sitemap, "<urlset></urlset>");
  assert.equal(artifact.headers, "/*\n  X-Robots-Tag: noindex, nofollow\n");
});

test("missing or mismatched build variables cannot enable indexing even with a production robots input", () => {
  const invalid: Record<string, string>[] = [
    {},
    { NEXT_PUBLIC_CANOPYPROOF_MODE: "production" },
    { NEXT_PUBLIC_DROPIN_SITE_URL: "https://canopyproof.org" },
    { NEXT_PUBLIC_CANOPYPROOF_MODE: "production", NEXT_PUBLIC_DROPIN_SITE_URL: "https://preview.example.invalid" },
    { NEXT_PUBLIC_CANOPYPROOF_MODE: "staging", NEXT_PUBLIC_DROPIN_SITE_URL: "https://canopyproof.org" },
  ];
  for (const environment of invalid) {
    const artifact = promotedFixture(environment, true);
    assert.equal(artifact.status, 0, artifact.stderr);
    assert.equal(artifact.robots, "User-agent: *\nDisallow: /\n");
    assert.match(artifact.headers ?? "", /X-Robots-Tag: noindex, nofollow/);
  }
});

test("promotion fails if a required metadata artifact is missing", () => {
  const artifact = promotedFixture(workflowBuildEnvironment("deploy-cloudflare-worker.yml"), true, true);
  assert.notEqual(artifact.status, 0);
  assert.match(artifact.stderr, /Cannot promote static homepage asset: missing robots\.txt\.body/);
});

test("production static CSP fails closed when hashes exceed Cloudflare's header line limit", () => {
  const html = '<!doctype html><title>FIXTURE ONLY</title>' +
    Array.from({ length: 50 }, (_, i) => '<script>window.__lifepp_fixture_' + i + '=' + i + ';</script>').join("");
  const artifact = promotedFixture(workflowBuildEnvironment("deploy-canopyproof.yml"), true, false, html);
  assert.notEqual(artifact.status, 0, "Oversized CSP must fail the production build");
  assert.match(artifact.stderr, /Static homepage CSP exceeds the Cloudflare _headers line limit/);
});
