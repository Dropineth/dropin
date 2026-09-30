import assert from "node:assert/strict";
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

function workflowBuildEnvironment(name: string): Record<string, string> {
  const source = readFileSync(join(projectRoot, "../.github/workflows", name), "utf8");
  // These workflows have one deploy job. Read its job-wide env, inherited by Next,
  // OpenNext and the subsequent static-asset promotion process, without reading secrets.
  const jobEnvironment = source.match(/^ {4}env:\n((?: {6}.*(?:\n|$))*)/m)?.[1];
  assert.ok(jobEnvironment, `${name} must have an explicit job build environment`);
  const environment: Record<string, string> = {};
  for (const key of publicKeys) {
    const value = jobEnvironment.match(new RegExp(`^ {6}${key}: (.+)$`, "m"))?.[1];
    assert.ok(value, `${name} must expose ${key} to build subprocesses`);
    assert.equal(source.match(new RegExp(`${key}:`, "g"))?.length, 1, `${name} must not shadow the public build setting`);
    environment[key] = value;
  }
  return environment;
}

function promotedFixture(environment: Record<string, string>, sourceIsProduction: boolean, omitRobots = false) {
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
    writeFileSync(join(next, "index.html"), "<!doctype html><title>FIXTURE ONLY</title>");
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
    assert.equal(artifact.headers, null, "Approved production build must not acquire preview noindex headers");
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
