/* global console, process */
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METRICS = ["statements", "branches", "functions", "lines"];
const ALLOWED_SOURCE = /^(apps|packages|services)\/[^/]+\/src\/.+\.[cm]?[jt]sx?$/;
const FORBIDDEN_SEGMENT = /(^|\/)(coverage|dist|generated|node_modules|\.next|\.open-next|\.wrangler)(\/|$)/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashFile(file) {
  return sha256(readFileSync(file));
}

export function hashFiles(root, files) {
  const digest = createHash("sha256");
  for (const file of [...files].sort()) {
    digest.update(file);
    digest.update("\0");
    digest.update(readFileSync(path.join(root, file)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function percentage(covered, total) {
  return total === 0 ? 0 : Number(((covered / total) * 100).toFixed(2));
}

function countMap(values) {
  const counts = Object.values(values);
  return {
    covered: counts.filter((count) => Number(count) > 0).length,
    total: counts.length,
  };
}

function countBranches(values) {
  const counts = Object.values(values).flatMap((entry) => entry);
  return {
    covered: counts.filter((count) => Number(count) > 0).length,
    total: counts.length,
  };
}

function countLines(coverage) {
  const lines = new Map();
  for (const [statementId, location] of Object.entries(coverage.statementMap)) {
    const line = location.start.line;
    const current = lines.get(line) ?? 0;
    lines.set(line, Math.max(current, Number(coverage.s[statementId] ?? 0)));
  }
  return {
    covered: [...lines.values()].filter((count) => count > 0).length,
    total: lines.size,
  };
}

function metricCounts(coverage) {
  return {
    statements: countMap(coverage.s),
    branches: countBranches(coverage.b),
    functions: countMap(coverage.f),
    lines: countLines(coverage),
  };
}

function withPercentages(counts) {
  return Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      {
        ...counts[metric],
        percentage: percentage(counts[metric].covered, counts[metric].total),
      },
    ]),
  );
}

function addCounts(left, right) {
  return Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      {
        covered: left[metric].covered + right[metric].covered,
        total: left[metric].total + right[metric].total,
      },
    ]),
  );
}

function emptyCounts() {
  return Object.fromEntries(
    METRICS.map((metric) => [metric, { covered: 0, total: 0 }]),
  );
}

function parseJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `${label} is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function validateConfig(root, config, configFile) {
  if (config.schemaVersion !== 1) {
    throw new Error("critical coverage config schemaVersion must be 1");
  }
  for (const metric of METRICS) {
    if (config.thresholds?.[metric] !== 95) {
      throw new Error(`critical coverage threshold ${metric} must equal 95`);
    }
  }
  if (!Number.isInteger(config.maxCoverageAgeSeconds) || config.maxCoverageAgeSeconds <= 0) {
    throw new Error("maxCoverageAgeSeconds must be a positive integer");
  }
  if (!Array.isArray(config.modules) || config.modules.length === 0) {
    throw new Error("critical coverage config must declare modules");
  }
  if (!Array.isArray(config.testFiles) || config.testFiles.length === 0) {
    throw new Error("critical coverage config must declare testFiles");
  }

  const rootReal = realpathSync(root);
  const moduleIds = new Set();
  const sourceFiles = new Set();
  for (const module of config.modules) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(module.id) || moduleIds.has(module.id)) {
      throw new Error(`invalid or duplicate critical module id: ${module.id}`);
    }
    moduleIds.add(module.id);
    if (!Array.isArray(module.files) || module.files.length === 0) {
      throw new Error(`critical module ${module.id} has no files`);
    }
    for (const file of module.files) {
      if (
        typeof file !== "string" ||
        path.posix.normalize(file) !== file ||
        path.isAbsolute(file) ||
        file.startsWith("../") ||
        !ALLOWED_SOURCE.test(file) ||
        FORBIDDEN_SEGMENT.test(file)
      ) {
        throw new Error(`critical module ${module.id} contains unsafe source path: ${file}`);
      }
      if (sourceFiles.has(file)) {
        throw new Error(`critical source file is assigned more than once: ${file}`);
      }
      sourceFiles.add(file);
      const absolute = path.join(root, file);
      if (!existsSync(absolute) || !lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink()) {
        throw new Error(`critical source file is missing or not a regular file: ${file}`);
      }
      const real = realpathSync(absolute);
      if (real !== path.join(rootReal, file)) {
        throw new Error(`critical source file resolves outside the repository: ${file}`);
      }
    }
  }

  for (const file of config.testFiles) {
    if (
      typeof file !== "string" ||
      path.posix.normalize(file) !== file ||
      !/^tests\/unit\/[^/]+\.test\.ts$/.test(file) ||
      !existsSync(path.join(root, file))
    ) {
      throw new Error(`critical test file is missing or unsafe: ${file}`);
    }
  }

  const expectedConfigHash = hashFile(configFile);
  return {
    sourceFiles: [...sourceFiles].sort(),
    testFiles: [...new Set(config.testFiles)].sort(),
    expectedConfigHash,
  };
}

function normalizeCoverage(root, rawCoverage) {
  const entries = new Map();
  for (const [coveragePath, coverage] of Object.entries(rawCoverage)) {
    const absolute = path.isAbsolute(coveragePath)
      ? coveragePath
      : path.resolve(root, coveragePath);
    if (!existsSync(absolute)) {
      continue;
    }
    entries.set(realpathSync(absolute), coverage);
  }
  return entries;
}

function reportMarkdown(report) {
  const lines = [
    "# CanopyProof Critical Coverage",
    "",
    `Status: ${report.status}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Module | Statements | Branches | Functions | Lines | Result |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const module of report.modules) {
    lines.push(
      `| ${module.id} | ${module.metrics.statements.percentage}% | ${module.metrics.branches.percentage}% | ${module.metrics.functions.percentage}% | ${module.metrics.lines.percentage}% | ${module.status} |`,
    );
  }
  lines.push("", "## File Results", "");
  lines.push("| File | Statements | Branches | Functions | Lines | Result |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- |");
  for (const module of report.modules) {
    for (const file of module.files) {
      lines.push(
        `| \`${file.path}\` | ${file.metrics.statements.percentage}% | ${file.metrics.branches.percentage}% | ${file.metrics.functions.percentage}% | ${file.metrics.lines.percentage}% | ${file.status} |`,
      );
    }
  }
  if (report.failures.length > 0) {
    lines.push("", "## Failures", "");
    for (const failure of report.failures) {
      lines.push(`- ${failure}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function evaluateCriticalCoverage({
  root = process.cwd(),
  configPath = "config/canopyproof-critical-coverage.json",
  now = Date.now(),
} = {}) {
  const absoluteRoot = realpathSync(root);
  const configFile = path.resolve(absoluteRoot, configPath);
  const config = parseJson(configFile, "critical coverage config");
  const validated = validateConfig(absoluteRoot, config, configFile);
  const coverageFile = path.resolve(absoluteRoot, config.coverageFile);
  const rawCoverageFile = path.resolve(absoluteRoot, config.rawCoverageFile);
  const provenanceFile = path.resolve(absoluteRoot, config.provenanceFile);
  const provenance = parseJson(provenanceFile, "critical coverage provenance");
  const coverage = parseJson(coverageFile, "critical coverage data");
  parseJson(rawCoverageFile, "raw critical coverage data");

  const expectedSourceHash = hashFiles(absoluteRoot, validated.sourceFiles);
  const expectedTestHash = hashFiles(absoluteRoot, validated.testFiles);
  if (provenance.schemaVersion !== 1) {
    throw new Error("critical coverage provenance schemaVersion must be 1");
  }
  if (provenance.configHash !== validated.expectedConfigHash) {
    throw new Error("critical coverage provenance config hash is stale");
  }
  if (provenance.sourceHash !== expectedSourceHash) {
    throw new Error("critical coverage provenance source hash is stale");
  }
  if (provenance.testHash !== expectedTestHash) {
    throw new Error("critical coverage provenance test hash is stale");
  }
  const normalizerFile = path.join(
    absoluteRoot,
    "scripts",
    "canopyproof-critical-coverage-normalizer.mjs",
  );
  if (
    provenance.rawCoverageHash !== hashFile(rawCoverageFile) ||
    provenance.normalizedCoverageHash !== hashFile(coverageFile) ||
    provenance.normalizerHash !== hashFile(normalizerFile)
  ) {
    throw new Error("critical coverage normalization provenance is stale");
  }
  if (
    provenance.normalization?.schemaVersion !== 1 ||
    provenance.normalization?.normalizedCoverageHash !==
      sha256(JSON.stringify(coverage)) ||
    !Array.isArray(provenance.normalization?.removals) ||
    provenance.normalization.removalCount !== provenance.normalization.removals.length
  ) {
    throw new Error("critical coverage normalization audit is missing or invalid");
  }
  const completedAt = Date.parse(provenance.completedAt);
  const startedAt = Date.parse(provenance.startedAt);
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    completedAt < startedAt ||
    now - completedAt > config.maxCoverageAgeSeconds * 1000 ||
    completedAt > now + 5_000
  ) {
    throw new Error("critical coverage provenance is stale or has invalid timestamps");
  }
  if (statSync(coverageFile).mtimeMs + 1_000 < startedAt) {
    throw new Error("critical coverage data predates the recorded run");
  }

  const coverageByRealPath = normalizeCoverage(absoluteRoot, coverage);
  const failures = [];
  const modules = config.modules.map((module) => {
    let aggregate = emptyCounts();
    const files = module.files.map((file) => {
      const real = realpathSync(path.join(absoluteRoot, file));
      const fileCoverage = coverageByRealPath.get(real);
      if (!fileCoverage) {
        failures.push(`${module.id}: configured source is missing from coverage: ${file}`);
        return {
          path: file,
          status: "FAIL",
          metrics: withPercentages(emptyCounts()),
        };
      }
      const counts = metricCounts(fileCoverage);
      aggregate = addCounts(aggregate, counts);
      const metrics = withPercentages(counts);
      let status = "PASS";
      for (const metric of METRICS) {
        if (metrics[metric].total === 0 || metrics[metric].percentage < config.thresholds[metric]) {
          status = "FAIL";
          failures.push(
            `${module.id}/${file}: ${metric} ${metrics[metric].percentage}% < ${config.thresholds[metric]}%`,
          );
        }
      }
      return { path: file, status, metrics };
    });
    const metrics = withPercentages(aggregate);
    let status = files.every((file) => file.status === "PASS") ? "PASS" : "FAIL";
    for (const metric of METRICS) {
      if (metrics[metric].total === 0 || metrics[metric].percentage < config.thresholds[metric]) {
        status = "FAIL";
        failures.push(
          `${module.id}: aggregate ${metric} ${metrics[metric].percentage}% < ${config.thresholds[metric]}%`,
        );
      }
    }
    return { id: module.id, status, metrics, files };
  });

  const report = {
    schemaVersion: 1,
    status: failures.length === 0 ? "PASS" : "FAIL",
    generatedAt: new Date(now).toISOString(),
    thresholds: config.thresholds,
    configHash: validated.expectedConfigHash,
    sourceHash: expectedSourceHash,
    testHash: expectedTestHash,
    normalization: provenance.normalization,
    modules,
    failures,
  };
  const jsonReport = path.resolve(absoluteRoot, config.jsonReport);
  const markdownReport = path.resolve(absoluteRoot, config.markdownReport);
  mkdirSync(path.dirname(jsonReport), { recursive: true });
  mkdirSync(path.dirname(markdownReport), { recursive: true });
  writeFileSync(jsonReport, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownReport, reportMarkdown(report));
  return report;
}

function main() {
  try {
    const report = evaluateCriticalCoverage();
    for (const module of report.modules) {
      for (const metric of METRICS) {
        const result = module.metrics[metric];
        console.log(
          `${module.id}\t${metric}\t${result.percentage.toFixed(2)}%\tthreshold=95.00%\t${module.status}`,
        );
      }
    }
    if (report.status !== "PASS") {
      for (const failure of report.failures) {
        console.error(`FAIL\t${failure}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
