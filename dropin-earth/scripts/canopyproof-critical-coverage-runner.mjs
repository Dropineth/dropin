/* global process */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  renameSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { normalizeCriticalCoverage } from "./canopyproof-critical-coverage-normalizer.mjs";

const root = process.cwd();
const configPath = path.join(root, "config", "canopyproof-critical-coverage.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const coverageDirectory = path.dirname(path.join(root, config.coverageFile));
const rawCoverageFile = path.join(root, config.rawCoverageFile);
const normalizedCoverageFile = path.join(root, config.coverageFile);

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function hashFiles(files) {
  const digest = createHash("sha256");
  for (const file of [...files].sort()) {
    digest.update(file);
    digest.update("\0");
    digest.update(readFileSync(path.join(root, file)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

const sourceFiles = [...new Set(config.modules.flatMap((module) => module.files))].sort();
const testFiles = [...new Set(config.testFiles)].sort();
const startedAt = new Date();
rmSync(coverageDirectory, { recursive: true, force: true });
mkdirSync(coverageDirectory, { recursive: true });

const c8 = path.join(root, "node_modules", ".bin", "c8");
const args = [
  "--clean=true",
  "--all",
  "--reporter=json",
  "--reporter=text-summary",
  `--reports-dir=${path.relative(root, coverageDirectory)}`,
  ...sourceFiles.flatMap((file) => [`--include=${file}`]),
  process.execPath,
  "--test",
  "--test-reporter=dot",
  "--import",
  "tsx",
  ...testFiles,
];
const result = spawnSync(c8, args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const completedAt = new Date();
renameSync(normalizedCoverageFile, rawCoverageFile);
const rawCoverage = JSON.parse(readFileSync(rawCoverageFile, "utf8"));
const normalized = normalizeCriticalCoverage({
  root,
  coverage: rawCoverage,
  sourceFiles,
});
writeFileSync(normalizedCoverageFile, `${JSON.stringify(normalized.coverage)}\n`);
const provenance = {
  schemaVersion: 1,
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  configHash: sha256File(configPath),
  sourceHash: hashFiles(sourceFiles),
  testHash: hashFiles(testFiles),
  sourceFiles,
  testFiles,
  rawCoverageHash: sha256File(rawCoverageFile),
  normalizedCoverageHash: sha256File(normalizedCoverageFile),
  normalizerHash: sha256File(
    path.join(root, "scripts", "canopyproof-critical-coverage-normalizer.mjs"),
  ),
  normalization: normalized.audit,
};
writeFileSync(
  path.join(root, config.provenanceFile),
  `${JSON.stringify(provenance, null, 2)}\n`,
);

const gate = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "canopyproof-critical-coverage-gate.mjs")],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);
if (gate.error) {
  throw gate.error;
}
process.exit(gate.status ?? 1);
