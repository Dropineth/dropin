import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { before } from "node:test";

type SmokeCheck = {
  label: string;
  ok: boolean;
  status?: number;
  includesRoot?: boolean;
  includesStatus?: boolean;
};

type SmokeSummary = {
  ok: boolean;
  checks: SmokeCheck[];
};

type SmokeModule = {
  runSmoke(input: {
    fetcher: Fetcher;
    reportDir: string;
    now?: Date;
  }): Promise<SmokeSummary>;
};

type ReportModule = {
  updateProductionReport(input: Record<string, unknown>): Promise<unknown>;
};

type WatchRun = {
  status: string;
  conclusion: string | null;
  url: string;
};

type WatchModule = {
  isWaitingForEnvironmentApproval(run: WatchRun): boolean;
  classifyRun(run: WatchRun): string;
  watchMarkdown(input: Record<string, unknown>): string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let smokeModule: SmokeModule;
let reportModule: ReportModule;
let watchModule: WatchModule;

before(async () => {
  smokeModule = (await import("../../scripts/canopyproof-production-smoke.mjs")) as SmokeModule;
  reportModule = (await import("../../scripts/canopyproof-update-production-report.mjs")) as ReportModule;
  watchModule = (await import("../../scripts/canopyproof-deploy-watch.mjs")) as WatchModule;
});

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "canopyproof-smoke-"));
}

function jpgResponse(): Response {
  return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
}

function textResponse(body: string, status = 200, contentType = "text/html"): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function makeFetcher(overrides: Record<string, Response> = {}): Fetcher {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://canopyproof.org/</loc></url>
  <url><loc>https://canopyproof.org/status</loc></url>
</urlset>`;

  const defaults: Record<string, Response> = {
    "canopyproof.org/": textResponse("<main>proof-first impact certificate operations</main>"),
    "www.canopyproof.org/": textResponse("<main>www root</main>"),
    "canopyproof.org/robots.txt": textResponse("User-agent: *", 200, "text/plain"),
    "canopyproof.org/sitemap.xml": textResponse(sitemap, 200, "application/xml"),
    "canopyproof.org/icon.jpg": jpgResponse(),
    "canopyproof.org/api/ready": textResponse('{"ok":true}', 200, "application/json"),
    "canopyproof.org/api/admin/launch/readiness": textResponse('{"error":"admin_proxy_disabled"}', 403, "application/json"),
  };

  return async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const key = `${url.hostname}${url.pathname}`;
    return overrides[key] ?? defaults[key] ?? textResponse("not found", 404, "text/plain");
  };
}

test("production smoke treats admin readiness 403 as success", async () => {
  const dir = tempDir();
  try {
    const summary = await smokeModule.runSmoke({
      fetcher: makeFetcher(),
      reportDir: dir,
      now: new Date("2026-07-06T00:00:00.000Z"),
    });

    const adminCheck = summary.checks.find((check) => check.label === "admin-blocked");
    assert.equal(summary.ok, true);
    assert.equal(adminCheck?.ok, true);
    assert.equal(adminCheck?.status, 403);
    assert.equal(existsSync(join(dir, "canopyproof-production-smoke.json")), true);
    assert.equal(existsSync(join(dir, "canopyproof-production-smoke.md")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production smoke treats admin readiness 200 as failure", async () => {
  const dir = tempDir();
  try {
    const summary = await smokeModule.runSmoke({
      fetcher: makeFetcher({
        "canopyproof.org/api/admin/launch/readiness": textResponse('{"secret":"leaked"}', 200, "application/json"),
      }),
      reportDir: dir,
    });

    const adminCheck = summary.checks.find((check) => check.label === "admin-blocked");
    assert.equal(summary.ok, false);
    assert.equal(adminCheck?.ok, false);
    assert.equal(adminCheck?.status, 200);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production smoke treats missing icon.jpg as failure", async () => {
  const dir = tempDir();
  try {
    const summary = await smokeModule.runSmoke({
      fetcher: makeFetcher({
        "canopyproof.org/icon.jpg": textResponse("missing", 404, "text/plain"),
      }),
      reportDir: dir,
    });

    const iconCheck = summary.checks.find((check) => check.label === "icon");
    assert.equal(summary.ok, false);
    assert.equal(iconCheck?.ok, false);
    assert.equal(iconCheck?.status, 404);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production smoke does not check icon.svg", () => {
  const source = readFileSync(join(process.cwd(), "scripts/canopyproof-production-smoke.mjs"), "utf8");
  assert.doesNotMatch(source, /icon\.svg/);
  assert.match(source, /icon\.jpg/);
});

test("production smoke requires sitemap root and status URLs", async () => {
  const dir = tempDir();
  try {
    const summary = await smokeModule.runSmoke({
      fetcher: makeFetcher({
        "canopyproof.org/sitemap.xml": textResponse("<urlset><url><loc>https://canopyproof.org/</loc></url></urlset>", 200, "application/xml"),
      }),
      reportDir: dir,
    });

    const sitemapCheck = summary.checks.find((check) => check.label === "sitemap");
    assert.equal(summary.ok, false);
    assert.equal(sitemapCheck?.ok, false);
    assert.equal(sitemapCheck?.includesRoot, true);
    assert.equal(sitemapCheck?.includesStatus, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production report updater refuses DEPLOYED when smoke JSON is missing", async () => {
  const dir = tempDir();
  try {
    await assert.rejects(
      reportModule.updateProductionReport({
        deployStatus: "DEPLOYED",
        deployTargetSha: "1557bf27dc68c73b4e91445235c13c215d702a2c",
        githubRunUrl: "https://github.com/Dropineth/dropin/actions/runs/1",
        smokePath: join(dir, "missing.json"),
        outputPath: join(dir, "report.md"),
      }),
      /smoke.*missing/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production report updater refuses DEPLOYED when smoke JSON contains failed checks", async () => {
  const dir = tempDir();
  try {
    const smokePath = join(dir, "smoke.json");
    writeFileSync(smokePath, JSON.stringify({ ok: false, checks: [{ label: "admin-blocked", ok: false }] }));

    await assert.rejects(
      reportModule.updateProductionReport({
        deployStatus: "DEPLOYED",
        deployTargetSha: "1557bf27dc68c73b4e91445235c13c215d702a2c",
        githubRunUrl: "https://github.com/Dropineth/dropin/actions/runs/1",
        smokePath,
        outputPath: join(dir, "report.md"),
      }),
      /smoke checks did not all pass/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production report includes required safety boundaries", async () => {
  const dir = tempDir();
  try {
    const smokePath = join(dir, "smoke.json");
    const outputPath = join(dir, "report.md");
    writeFileSync(
      smokePath,
      JSON.stringify({
        ok: true,
        checks: [
          { label: "root", ok: true, status: 200, url: "https://canopyproof.org/" },
          { label: "admin-blocked", ok: true, status: 403, url: "https://canopyproof.org/api/admin/launch/readiness" },
        ],
      }),
    );

    await reportModule.updateProductionReport({
      deployStatus: "DEPLOYED",
      deployTargetSha: "1557bf27dc68c73b4e91445235c13c215d702a2c",
      githubRunUrl: "https://github.com/Dropineth/dropin/actions/runs/1",
      smokePath,
      outputPath,
      now: new Date("2026-07-06T00:00:00.000Z"),
    });

    const report = readFileSync(outputPath, "utf8");
    assert.match(report, /DROPIN_ALLOW_ADMIN_PROXY=false/);
    assert.match(report, /No mainnet funds enabled/);
    assert.match(report, /No automatic CANOPY distribution enabled/);
    assert.match(report, /No certified carbon-credit claim/);
    assert.match(report, /No carbon-tax offset claim/);
    assert.match(report, /No guaranteed RWA yield/);
    assert.match(report, /API and Web Workers remain separated/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deployment watcher reports waiting environment approval without bypassing it", () => {
  const run = {
    status: "waiting",
    conclusion: null,
    url: "https://github.com/Dropineth/dropin/actions/runs/28765611499",
  };

  assert.equal(watchModule.isWaitingForEnvironmentApproval(run), true);
  assert.equal(watchModule.classifyRun(run), "WAITING_FOR_ENVIRONMENT_APPROVAL");

  const report = watchModule.watchMarkdown({
    generatedAt: "2026-07-06T00:00:00.000Z",
    status: "WAITING_FOR_ENVIRONMENT_APPROVAL",
    runId: "28765611499",
    url: run.url,
    conclusion: run.conclusion,
    message: "WAITING_FOR_ENVIRONMENT_APPROVAL: automation will not bypass this gate.",
  });

  assert.match(report, /WAITING_FOR_ENVIRONMENT_APPROVAL/);
  assert.match(report, /will not bypass/i);
});
