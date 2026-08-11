import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { type TestContext } from "node:test";

interface CoverageGateModule {
  evaluateCriticalCoverage(options: {
    root: string;
    configPath?: string;
    now?: number;
  }): {
    status: "PASS" | "FAIL";
    failures: string[];
  };
  hashFile(file: string): string;
  hashFiles(root: string, files: string[]): string;
}

const gateModuleUrl = pathToFileURL(
  join(process.cwd(), "scripts", "canopyproof-critical-coverage-gate.mjs"),
).href;

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function completeCoverage(sourceFile: string, hit = 1): Record<string, unknown> {
  return {
    [sourceFile]: {
      path: sourceFile,
      statementMap: {
        "0": {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 18 },
        },
      },
      fnMap: {
        "0": {
          name: "critical",
          decl: {
            start: { line: 1, column: 0 },
            end: { line: 1, column: 8 },
          },
          loc: {
            start: { line: 1, column: 0 },
            end: { line: 1, column: 18 },
          },
          line: 1,
        },
      },
      branchMap: {
        "0": {
          loc: {
            start: { line: 1, column: 0 },
            end: { line: 1, column: 18 },
          },
          type: "if",
          locations: [
            {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 18 },
            },
            {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 18 },
            },
          ],
          line: 1,
        },
      },
      s: { "0": hit },
      f: { "0": hit },
      b: { "0": [hit, hit] },
    },
  };
}

async function makeFixture(t: TestContext, hit = 1) {
  const gate = (await import(gateModuleUrl)) as CoverageGateModule;
  const root = mkdtempSync(join(tmpdir(), "canopyproof-critical-gate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const source = "services/api/src/critical.ts";
  const testFile = "tests/unit/critical.test.ts";
  const configPath = "config/canopyproof-critical-coverage.json";
  const coveragePath = "coverage/critical/coverage-final.json";
  const rawCoveragePath = "coverage/critical/coverage-raw.json";
  const provenancePath = "coverage/critical/provenance.json";
  const now = Date.now();
  mkdirSync(join(root, dirname(source)), { recursive: true });
  mkdirSync(join(root, dirname(testFile)), { recursive: true });
  writeFileSync(join(root, source), "export function critical() { return true; }\n");
  writeFileSync(join(root, testFile), "void 0;\n");

  const config = {
    schemaVersion: 1,
    thresholds: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
    maxCoverageAgeSeconds: 900,
    rawCoverageFile: rawCoveragePath,
    coverageFile: coveragePath,
    provenanceFile: provenancePath,
    jsonReport: "reports/canopyproof-critical-coverage.json",
    markdownReport: "reports/canopyproof-critical-coverage.md",
    testFiles: [testFile],
    modules: [{ id: "critical-module", files: [source] }],
  };
  writeJson(join(root, configPath), config);
  const coverage = completeCoverage(join(root, source), hit);
  writeJson(join(root, coveragePath), coverage);
  writeJson(join(root, rawCoveragePath), coverage);
  const normalizerFile = join(
    process.cwd(),
    "scripts",
    "canopyproof-critical-coverage-normalizer.mjs",
  );
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(
    join(root, "scripts", "canopyproof-critical-coverage-normalizer.mjs"),
    readFileSync(normalizerFile),
  );
  writeJson(join(root, provenancePath), {
    schemaVersion: 1,
    startedAt: new Date(now - 1_000).toISOString(),
    completedAt: new Date(now).toISOString(),
    configHash: gate.hashFile(join(root, configPath)),
    sourceHash: gate.hashFiles(root, [source]),
    testHash: gate.hashFiles(root, [testFile]),
    rawCoverageHash: gate.hashFile(join(root, rawCoveragePath)),
    normalizedCoverageHash: gate.hashFile(join(root, coveragePath)),
    normalizerHash: gate.hashFile(
      join(root, "scripts", "canopyproof-critical-coverage-normalizer.mjs"),
    ),
    normalization: {
      schemaVersion: 1,
      policy: "test",
      removalCount: 0,
      removals: [],
      normalizedCoverageHash: createHash("sha256")
        .update(JSON.stringify(coverage))
        .digest("hex"),
    },
  });
  return {
    gate,
    root,
    now,
    configPath,
    coveragePath,
    rawCoveragePath,
    provenancePath,
    source,
  };
}

test("critical coverage gate emits deterministic JSON and Markdown on pass", async (t) => {
  const fixture = await makeFixture(t);
  const report = fixture.gate.evaluateCriticalCoverage({
    root: fixture.root,
    configPath: fixture.configPath,
    now: fixture.now,
  });

  assert.equal(report.status, "PASS");
  assert.deepEqual(report.failures, []);
  const json = JSON.parse(
    readFileSync(
      join(fixture.root, "reports", "canopyproof-critical-coverage.json"),
      "utf8",
    ),
  ) as { status: string };
  assert.equal(json.status, "PASS");
  assert.match(
    readFileSync(
      join(fixture.root, "reports", "canopyproof-critical-coverage.md"),
      "utf8",
    ),
    /Status: PASS/,
  );
});

test("critical coverage gate fails each metric below 95 percent", async (t) => {
  const fixture = await makeFixture(t, 0);
  const report = fixture.gate.evaluateCriticalCoverage({
    root: fixture.root,
    configPath: fixture.configPath,
    now: fixture.now,
  });

  assert.equal(report.status, "FAIL");
  assert.ok(report.failures.some((failure) => failure.includes("statements 0% < 95%")));
  assert.ok(report.failures.some((failure) => failure.includes("branches 0% < 95%")));
  assert.ok(report.failures.some((failure) => failure.includes("functions 0% < 95%")));
  assert.ok(report.failures.some((failure) => failure.includes("lines 0% < 95%")));
});

test("critical coverage gate fails when a configured source is absent from coverage", async (t) => {
  const fixture = await makeFixture(t);
  const coverageFile = join(fixture.root, fixture.coveragePath);
  writeJson(coverageFile, {});
  const provenanceFile = join(fixture.root, fixture.provenancePath);
  const provenance = JSON.parse(readFileSync(provenanceFile, "utf8")) as {
    normalizedCoverageHash: string;
    normalization: { normalizedCoverageHash: string };
  };
  provenance.normalizedCoverageHash = fixture.gate.hashFile(coverageFile);
  provenance.normalization.normalizedCoverageHash = createHash("sha256")
    .update(JSON.stringify({}))
    .digest("hex");
  writeJson(provenanceFile, provenance);

  const report = fixture.gate.evaluateCriticalCoverage({
    root: fixture.root,
    configPath: fixture.configPath,
    now: fixture.now,
  });
  assert.equal(report.status, "FAIL");
  assert.ok(report.failures.some((failure) => failure.includes("missing from coverage")));
});

test("critical coverage gate rejects stale provenance", async (t) => {
  const fixture = await makeFixture(t);
  const provenanceFile = join(fixture.root, fixture.provenancePath);
  const provenance = JSON.parse(readFileSync(provenanceFile, "utf8")) as {
    completedAt: string;
  };
  provenance.completedAt = new Date(fixture.now - 901_000).toISOString();
  writeJson(provenanceFile, provenance);

  assert.throws(
    () =>
      fixture.gate.evaluateCriticalCoverage({
        root: fixture.root,
        configPath: fixture.configPath,
        now: fixture.now,
      }),
    /stale or has invalid timestamps/,
  );
});

test("critical coverage gate rejects normalized coverage changed after the audited run", async (t) => {
  const fixture = await makeFixture(t);
  const coverageFile = join(fixture.root, fixture.coveragePath);
  const coverage = JSON.parse(readFileSync(coverageFile, "utf8")) as Record<string, unknown>;
  coverage.unexpected = {};
  writeJson(coverageFile, coverage);

  assert.throws(
    () =>
      fixture.gate.evaluateCriticalCoverage({
        root: fixture.root,
        configPath: fixture.configPath,
        now: fixture.now,
      }),
    /normalization provenance is stale/,
  );
});

test("critical coverage gate rejects generated-file substitution and lower thresholds", async (t) => {
  const fixture = await makeFixture(t);
  const configFile = join(fixture.root, fixture.configPath);
  const config = JSON.parse(readFileSync(configFile, "utf8")) as {
    thresholds: { branches: number };
    modules: Array<{ files: string[] }>;
  };
  config.thresholds.branches = 94;
  writeJson(configFile, config);
  assert.throws(
    () =>
      fixture.gate.evaluateCriticalCoverage({
        root: fixture.root,
        configPath: fixture.configPath,
        now: fixture.now,
      }),
    /threshold branches must equal 95/,
  );

  config.thresholds.branches = 95;
  config.modules[0]!.files = ["services/api/src/generated/critical.ts"];
  mkdirSync(join(fixture.root, "services", "api", "src", "generated"), {
    recursive: true,
  });
  writeFileSync(
    join(fixture.root, "services", "api", "src", "generated", "critical.ts"),
    "export const generated = true;\n",
  );
  writeJson(configFile, config);
  assert.throws(
    () =>
      fixture.gate.evaluateCriticalCoverage({
        root: fixture.root,
        configPath: fixture.configPath,
        now: fixture.now,
      }),
    /unsafe source path/,
  );
});
