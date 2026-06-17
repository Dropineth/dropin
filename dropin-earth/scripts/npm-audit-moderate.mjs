#!/usr/bin/env node
/* global console, process */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const reportPath = "reports/npm-audit-moderate.json";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const auditArgs = [
  "audit",
  "--audit-level=moderate",
  "--json",
  "--fetch-retries=5",
  "--fetch-retry-mintimeout=20000",
  "--fetch-retry-maxtimeout=120000",
];

function parseAuditJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function vulnerabilityTotal(report) {
  return report?.metadata?.vulnerabilities?.total;
}

function isRegistryTransportFailure(report, stderr) {
  if (report?.error && vulnerabilityTotal(report) === undefined) return true;
  return /audit endpoint returned an error|Client network socket disconnected|fetch failed|ECONNRESET|ETIMEDOUT/i.test(stderr);
}

mkdirSync("reports", { recursive: true });

let lastResult;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const result = spawnSync(npmBin, auditArgs, {
    encoding: "utf8",
    env: process.env,
  });
  lastResult = result;

  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const report = parseAuditJson(stdout);

  if (stdout) {
    writeFileSync(reportPath, `${stdout}\n`);
  } else {
    writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          error: {
            summary: "npm audit produced no JSON output",
            detail: stderr,
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  if (result.status === 0) {
    const total = vulnerabilityTotal(report) ?? 0;
    console.log(`npm audit passed with ${total} vulnerabilities at audit-level=moderate.`);
    process.exit(0);
  }

  if (!isRegistryTransportFailure(report, stderr)) {
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    process.exit(result.status ?? 1);
  }

  if (attempt < 5) {
    console.error(`npm audit transport failure on attempt ${attempt}/5; retrying.`);
    await sleep(3000 * attempt);
  }
}

if (lastResult?.stdout) console.error(lastResult.stdout.trim());
if (lastResult?.stderr) console.error(lastResult.stderr.trim());
process.exit(lastResult?.status ?? 1);
