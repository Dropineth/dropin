import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { renderedMetadata } from "../helpers/lifepp-metadata";
import { buildStaticSecurityHeaders, extractInlineScriptHashes } from "../../apps/web/scripts/static-homepage-security.mjs";

const projectRoot = process.cwd();
const promoteScript = join(projectRoot, "apps/web/scripts/promote-static-homepage.mjs");
const productionMetadata = renderedMetadata(true);
const previewMetadata = renderedMetadata(false);
const publicKeys = ["NEXT_PUBLIC_CANOPYPROOF_MODE", "NEXT_PUBLIC_DROPIN_SITE_URL"] as const;
const fixtureScripts = ["self.__next_f=(self.__next_f||[]);", "self.__next_f.push([1,\"FIXTURE ONLY\"]);", '{"@type":"WebSite"}'];
const fixtureHtml = `<!doctype html><title>FIXTURE ONLY</title><script src="/_next/static/chunks/fixture.js" async></script>${fixtureScripts.map((script) => `<script>${script}</script>`).join("")}`;
const sha256Token = (script: string) => `'sha256-${createHash("sha256").update(script).digest("base64")}'`;

function assertStaticSecurity(headers: string | null) {
  assert.ok(headers);
  const lines = headers.split("\n");
  for (const path of ["/", "/index.html"]) {
    const start = lines.indexOf(path);
    assert.notEqual(start, -1, `${path} must have its own static header rule`);
    const rule: string[] = [];
    for (let index = start + 1; lines[index]?.startsWith("  "); index += 1) rule.push(lines[index]);
    const csp = rule.find((line) => line.startsWith("  Content-Security-Policy: "));
    assert.ok(csp);
    const scriptPolicy = csp.match(/script-src ([^;]+)/)?.[1];
    assert.ok(scriptPolicy?.startsWith("'self' "), "Parser-inserted local Next chunks must remain authorized");
    for (const script of fixtureScripts) assert.ok(scriptPolicy.includes(sha256Token(script)));
    assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval|strict-dynamic|nonce-/);
    for (const required of ["frame-src 'none'", "frame-ancestors 'none'", "object-src 'none'"]) assert.ok(csp.includes(required));
    assert.ok(rule.includes("  X-Content-Type-Options: nosniff"));
    assert.ok(rule.includes("  X-Frame-Options: DENY"));
    assert.ok(rule.includes("  Referrer-Policy: strict-origin-when-cross-origin"));
    assert.ok(rule.includes("  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload"));
    assert.ok(rule.some((line) => line.startsWith("  Permissions-Policy:") && line.includes("payment=()")));
  }
  assert.ok(headers.split("\n").every((line) => line.length <= 2000));
}

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

function promotedFixture(environment: Record<string, string>, sourceIsProduction: boolean, omitRobots = false, html = fixtureHtml) {
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
    writeFileSync(join(next, "index.html"), html);
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
    assertStaticSecurity(artifact.headers);
    assert.doesNotMatch(artifact.headers ?? "", /X-Robots-Tag|noindex|nofollow/, "Production must not acquire preview noindex headers");
    assert.match(artifact.headers ?? "", /upgrade-insecure-requests/);
    assert.match(artifact.html ?? "", /FIXTURE ONLY/);
    assert.equal(artifact.rsc, "FIXTURE RSC");
  });
}

test("preview artifacts remain nonindexable with an empty sitemap", () => {
  const artifact = promotedFixture({ NEXT_PUBLIC_CANOPYPROOF_MODE: "staging", NEXT_PUBLIC_DROPIN_SITE_URL: "https://preview.example.invalid" }, false);
  assert.equal(artifact.status, 0, artifact.stderr);
  assert.equal(artifact.robots, "User-agent: *\nDisallow: /\n");
  assert.equal(artifact.sitemap, "<urlset></urlset>");
  assertStaticSecurity(artifact.headers);
  assert.ok(artifact.headers?.startsWith("/*\n  X-Robots-Tag: noindex, nofollow\n"));
  assert.doesNotMatch(artifact.headers ?? "", /upgrade-insecure-requests/);
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

test("static CSP hashes actual inline script text, deduplicates it and excludes external/commented scripts", () => {
  const script = "\n  self.example = '<tag>';\n";
  const html = `<!-- <script>commented()</script> --><script src="/chunk.js">externalBody()</script><script data-note="src='not-an-attribute' >">${script.replace(/\n/g, "\r\n")}</script><SCRIPT>${script}</SCRIPT>`;
  assert.deepEqual(extractInlineScriptHashes(html), [sha256Token(script)]);
});

test("changing an inline bootstrap requires a new static CSP; old hashes do not authorize it", () => {
  const headers = buildStaticSecurityHeaders(fixtureHtml, { production: true });
  const changedScript = `${fixtureScripts[1]}self.tampered=true;`;
  const changedHtml = fixtureHtml.replace(fixtureScripts[1], changedScript);
  assert.notEqual(buildStaticSecurityHeaders(changedHtml, { production: true }), headers);
  assert.ok(!headers.includes(sha256Token(changedScript)));
  assert.ok(buildStaticSecurityHeaders(changedHtml, { production: true }).includes(sha256Token(changedScript)));
});

test("promotion fails closed before publishing HTML when CSP exceeds the Cloudflare header-line limit", () => {
  const html = Array.from({ length: 40 }, (_, index) => `<script>self.fixture${index}=true;</script>`).join("");
  const artifact = promotedFixture(workflowBuildEnvironment("deploy-cloudflare-worker.yml"), true, false, html);
  assert.notEqual(artifact.status, 0);
  assert.match(artifact.stderr, /header line is \d+ characters \(Cloudflare limit 2000\)/);
  assert.equal(artifact.headers, null);
  assert.equal(artifact.html, null);
});

test("an incomplete generated script cannot produce a security header file", () => {
  assert.throws(() => buildStaticSecurityHeaders("<script>self.incomplete=true;", { production: true }), /unclosed script element/);
});
