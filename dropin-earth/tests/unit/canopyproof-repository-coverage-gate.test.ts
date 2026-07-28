import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildRepositoryCoverageReport,
  repositoryCoverageIntegrationPatterns,
  repositoryCoverageThresholds,
  writeRepositoryCoverageReport,
} from "../../scripts/canopyproof-repository-coverage-report.mjs";

function summary(values: {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}) {
  return {
    total: Object.fromEntries(
      Object.entries(values).map(([metric, pct]) => [
        metric,
        { total: 100, covered: pct, skipped: 0, pct },
      ]),
    ),
  };
}

test("repository coverage report enforces Gate 1 without source exclusions", () => {
  const report = buildRepositoryCoverageReport(
    summary({
      statements: 83.81,
      branches: 76.76,
      functions: 85.49,
      lines: 83.81,
    }),
    { generatedAt: "2026-07-28T00:00:00.000Z" },
  );

  assert.equal(report.status, "PASS");
  assert.deepEqual(repositoryCoverageThresholds, {
    statements: 70,
    branches: 72.75,
    functions: 70,
    lines: 70,
  });
  assert.equal(report.measurement.allFirstPartySourceEnabled, true);
  assert.equal(report.measurement.testConcurrency, 1);
  assert.deepEqual(
    report.measurement.integrationPatterns,
    repositoryCoverageIntegrationPatterns,
  );
  assert.equal(report.results.statements.delta, 16.45);
  assert.equal(report.results.lines.delta, 16.45);
});

test("repository coverage report fails below statement or line Gate 1", () => {
  const report = buildRepositoryCoverageReport(
    summary({
      statements: 69.99,
      branches: 80,
      functions: 80,
      lines: 69.99,
    }),
  );

  assert.equal(report.status, "FAIL");
  assert.deepEqual(report.failedMetrics, ["statements", "lines"]);
});

test("repository coverage report rejects malformed percentages", () => {
  assert.throws(
    () =>
      buildRepositoryCoverageReport(
        summary({
          statements: Number.NaN,
          branches: 80,
          functions: 80,
          lines: 80,
        }),
      ),
    /invalid statements percentage/u,
  );
});

test("repository coverage evidence records before, after, and added tests", () => {
  const directory = mkdtempSync(join(tmpdir(), "canopyproof-coverage-"));
  const summaryPath = join(directory, "coverage-summary.json");
  try {
    writeFileSync(
      summaryPath,
      JSON.stringify(
        summary({
          statements: 83.81,
          branches: 76.76,
          functions: 85.49,
          lines: 83.81,
        }),
      ),
      "utf8",
    );
    const result = writeRepositoryCoverageReport({
      summaryPath,
      outputDirectory: directory,
      generatedAt: "2026-07-28T00:00:00.000Z",
    });

    const markdown = readFileSync(result.markdownPath, "utf8");
    assert.match(markdown, /\| Statements \| 67\.36% \| 83\.81% \| \+16\.45 pp \| 70\.00% \| PASS \|/u);
    assert.match(
      markdown,
      /tests\/unit\/canopyproof-repository-coverage-gate\.test\.ts/u,
    );
    assert.match(markdown, /tests\/integration\/\*-pglite\.integration\.ts/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
