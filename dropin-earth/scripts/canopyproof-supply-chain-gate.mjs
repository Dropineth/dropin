#!/usr/bin/env node
/* global console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const secretPatterns = Object.freeze([
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ["github-token", /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/u],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u],
  [
    "slack-webhook",
    /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,}/u,
  ],
  ["openai-key", /\bsk-[A-Za-z0-9_-]{32,}\b/u],
]);

const generatedArtifactPattern =
  /(?:^|\/)(?:node_modules|\.next|\.open-next|coverage|dist|test-results|\.wrangler)(?:\/|$)|\.tsbuildinfo$/u;

export function findSecretMarkers(files) {
  const findings = [];
  for (const file of files) {
    for (const [category, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(file.source)) {
        findings.push(Object.freeze({ path: file.path, category }));
      }
    }
  }
  return Object.freeze(findings);
}

export function findTrackedGeneratedArtifacts(paths) {
  return Object.freeze(
    paths.filter((path) => generatedArtifactPattern.test(path)),
  );
}

export function runSupplyChainGate({
  projectRoot,
  repositoryRoot,
  generatedAt = new Date().toISOString(),
}) {
  const trackedPaths = command(
    "git",
    ["ls-files"],
    repositoryRoot,
  )
    .split("\n")
    .filter(Boolean);
  const textFiles = [];
  for (const path of trackedPaths) {
    const absolutePath = join(repositoryRoot, path);
    if (!lstatSync(absolutePath).isFile()) continue;
    const bytes = readFileSync(absolutePath);
    if (bytes.includes(0)) continue;
    textFiles.push({ path, source: bytes.toString("utf8") });
  }

  const secretFindings = findSecretMarkers(textFiles);
  if (secretFindings.length > 0) {
    throw new Error(
      `Supply-chain secret scan found ${secretFindings.length} high-confidence marker(s): ${secretFindings.map((finding) => `${finding.path}:${finding.category}`).join(", ")}`,
    );
  }
  const generatedArtifacts = findTrackedGeneratedArtifacts(trackedPaths);
  if (generatedArtifacts.length > 0) {
    throw new Error(
      `Generated artifacts are tracked: ${generatedArtifacts.join(", ")}`,
    );
  }

  const dependencyTree = JSON.parse(
    command("npm", ["ls", "--all", "--json"], projectRoot),
  );
  const sbom = JSON.parse(
    command(
      "npm",
      ["sbom", "--sbom-format", "cyclonedx"],
      projectRoot,
    ),
  );
  if (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components)) {
    throw new Error("npm did not produce a valid CycloneDX SBOM.");
  }

  const reportDirectory = join(projectRoot, "reports", "ci");
  mkdirSync(reportDirectory, { recursive: true });
  const sbomPath = join(reportDirectory, "canopyproof-sbom.cdx.json");
  writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
  const lockfilePath = join(projectRoot, "package-lock.json");
  const report = Object.freeze({
    schemaVersion: 1,
    status: "PASS",
    generatedAt,
    candidateSha: command("git", ["rev-parse", "HEAD"], repositoryRoot),
    candidateTree: command(
      "git",
      ["rev-parse", "HEAD^{tree}"],
      repositoryRoot,
    ),
    lockfileSha256: sha256(readFileSync(lockfilePath)),
    dependencyTree: Object.freeze({
      name: dependencyTree.name,
      version: dependencyTree.version,
      status: "PASS",
    }),
    sbom: Object.freeze({
      format: sbom.bomFormat,
      specVersion: sbom.specVersion,
      components: sbom.components.length,
      sha256: sha256(readFileSync(sbomPath)),
    }),
    trackedFilesScanned: trackedPaths.length,
    secretFindings: 0,
    trackedGeneratedArtifacts: 0,
    privateSigningKeyIntroduced: false,
  });
  const reportPath = join(
    reportDirectory,
    "canopyproof-supply-chain-gate.json",
  );
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return Object.freeze({ report, reportPath, sbomPath });
}

function command(name, args, cwd) {
  return execFileSync(name, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const repositoryRoot = dirname(projectRoot);
  const result = runSupplyChainGate({ projectRoot, repositoryRoot });
  console.log(
    JSON.stringify({
      status: result.report.status,
      candidateSha: result.report.candidateSha,
      components: result.report.sbom.components,
      secretFindings: result.report.secretFindings,
      trackedGeneratedArtifacts:
        result.report.trackedGeneratedArtifacts,
    }),
  );
}
