#!/usr/bin/env node
/* global console, process */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repositoryCoverageBaseline = Object.freeze({
  statements: 67.36,
  branches: 76.5,
  functions: 73.06,
  lines: 67.36,
});

export const repositoryCoverageThresholds = Object.freeze({
  statements: 70,
  branches: 72.75,
  functions: 70,
  lines: 70,
});

export const repositoryCoverageTestFilesAdded = Object.freeze([
  "tests/unit/canopyproof-cross-browser-webgl-contract.test.ts",
  "tests/unit/canopyproof-repository-coverage-gate.test.ts",
]);

export const repositoryCoverageIntegrationPatterns = Object.freeze([
  "tests/integration/canopyproof-postgres-audit.integration.ts",
  "tests/integration/*-pglite.integration.ts",
]);

const metricNames = [
  "statements",
  "branches",
  "functions",
  "lines",
];

export function buildRepositoryCoverageReport(summary, options = {}) {
  const measured = {};
  for (const metric of metricNames) {
    const value = summary?.total?.[metric]?.pct;
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(
        `Repository coverage summary has an invalid ${metric} percentage.`,
      );
    }
    measured[metric] = value;
  }

  const thresholds = options.thresholds ?? repositoryCoverageThresholds;
  const baseline = options.baseline ?? repositoryCoverageBaseline;
  const results = Object.fromEntries(
    metricNames.map((metric) => [
      metric,
      Object.freeze({
        before: baseline[metric],
        after: measured[metric],
        delta: roundPercentage(measured[metric] - baseline[metric]),
        threshold: thresholds[metric],
        status: measured[metric] >= thresholds[metric] ? "PASS" : "FAIL",
      }),
    ]),
  );
  const failedMetrics = metricNames.filter(
    (metric) => results[metric].status !== "PASS",
  );

  return Object.freeze({
    schemaVersion: 1,
    status: failedMetrics.length === 0 ? "PASS" : "FAIL",
    generatedAt:
      options.generatedAt ?? new Date().toISOString(),
    measurement: Object.freeze({
      sourceScope: Object.freeze([
        "apps/*/src/**/*.ts",
        "apps/*/src/**/*.tsx",
        "packages/*/src/**/*.ts",
        "packages/*/src/**/*.tsx",
        "services/*/src/**/*.ts",
        "services/*/src/**/*.tsx",
      ]),
      allFirstPartySourceEnabled: true,
      testConcurrency: 1,
      unitPattern: "tests/unit/*.test.ts",
      integrationPatterns: repositoryCoverageIntegrationPatterns,
    }),
    results: Object.freeze(results),
    testFilesAdded: repositoryCoverageTestFilesAdded,
    failedMetrics: Object.freeze(failedMetrics),
  });
}

export function writeRepositoryCoverageReport({
  summaryPath,
  outputDirectory,
  generatedAt,
}) {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const report = buildRepositoryCoverageReport(summary, { generatedAt });
  mkdirSync(outputDirectory, { recursive: true });

  const jsonPath = join(
    outputDirectory,
    "canopyproof-repository-coverage.json",
  );
  const markdownPath = join(
    outputDirectory,
    "canopyproof-repository-coverage.md",
  );
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");

  if (report.status !== "PASS") {
    throw new Error(
      `Repository coverage gate failed: ${report.failedMetrics.join(", ")}.`,
    );
  }
  return Object.freeze({ report, jsonPath, markdownPath });
}

function renderMarkdown(report) {
  const rows = metricNames.map((metric) => {
    const result = report.results[metric];
    return `| ${capitalize(metric)} | ${formatPercentage(result.before)} | ${formatPercentage(result.after)} | ${formatSignedPercentage(result.delta)} | ${formatPercentage(result.threshold)} | ${result.status} |`;
  });
  return [
    "# CanopyProof Repository Coverage",
    "",
    `Status: ${report.status}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Metric | Before | After | Delta | Gate | Result |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...rows,
    "",
    "The measurement retains `c8 --all` across every first-party app, package,",
    "and service source path. It adds the existing PGlite authority scenarios",
    "to the unit suite rather than excluding uncovered production code.",
    "",
    "## Test Files Added",
    "",
    ...report.testFilesAdded.map((path) => `- \`${path}\``),
    "",
    "## Included Integration Suites",
    "",
    ...report.measurement.integrationPatterns.map(
      (path) => `- \`${path}\``,
    ),
    "",
  ].join("\n");
}

function roundPercentage(value) {
  return Math.round(value * 100) / 100;
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

function formatSignedPercentage(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function capitalize(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const projectRoot = dirname(scriptDirectory);
  const result = writeRepositoryCoverageReport({
    summaryPath: join(projectRoot, "coverage", "coverage-summary.json"),
    outputDirectory: join(projectRoot, "reports"),
  });
  console.log(
    JSON.stringify({
      status: result.report.status,
      results: result.report.results,
      jsonPath: result.jsonPath,
      markdownPath: result.markdownPath,
    }),
  );
}
