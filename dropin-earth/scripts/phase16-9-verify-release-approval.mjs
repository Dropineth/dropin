#!/usr/bin/env node
/* global console, process */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readArg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

function fail(message) {
  console.error(`PHASE16_9_RELEASE_APPROVAL_INVALID: ${message}`);
  process.exit(1);
}

const approvalPath = resolve(readArg("approval", "reports/phase16-9-release-council-approval.json"));
const expectedTarget = readArg("target", "canopyproof-production");
const expectedSha = readArg("target-sha") ?? process.env.TARGET_SHA ?? process.env.GITHUB_SHA;

if (!expectedSha || !/^[0-9a-f]{40}$/i.test(expectedSha)) {
  fail("expected target SHA must be a full 40-character hex commit");
}

let approval;
try {
  approval = JSON.parse(readFileSync(approvalPath, "utf8"));
} catch (error) {
  fail(`cannot read approval artifact at ${approvalPath}: ${error.message}`);
}

if (approval.phase !== "16.9") {
  fail(`phase must be 16.9, got ${JSON.stringify(approval.phase)}`);
}

if (approval.target !== expectedTarget) {
  fail(`target must be ${expectedTarget}, got ${JSON.stringify(approval.target)}`);
}

if (approval.target_commit !== expectedSha) {
  fail(`target_commit ${approval.target_commit} does not match expected ${expectedSha}`);
}

if (approval.approval_model !== "2-of-N release council") {
  fail("approval_model must be 2-of-N release council");
}

if (!Array.isArray(approval.approvals) || approval.approvals.length < 2) {
  fail("at least two approvals are required");
}

const reviewers = new Set();
for (const [index, item] of approval.approvals.entries()) {
  if (!item || typeof item !== "object") {
    fail(`approval ${index} must be an object`);
  }

  if (!item.reviewer || typeof item.reviewer !== "string") {
    fail(`approval ${index} must include reviewer`);
  }

  if (reviewers.has(item.reviewer)) {
    fail(`approval reviewer ${item.reviewer} is duplicated`);
  }
  reviewers.add(item.reviewer);

  if (item.role !== "release-council") {
    fail(`approval ${item.reviewer} must have role release-council`);
  }

  if (item.decision !== "approve") {
    fail(`approval ${item.reviewer} must approve`);
  }

  if (!item.timestamp || Number.isNaN(Date.parse(item.timestamp))) {
    fail(`approval ${item.reviewer} must include a valid timestamp`);
  }

  if (!item.rationale || typeof item.rationale !== "string" || item.rationale.trim().length < 24) {
    fail(`approval ${item.reviewer} must include a substantive rationale`);
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      phase: approval.phase,
      target: approval.target,
      target_commit: approval.target_commit,
      approval_model: approval.approval_model,
      approvals: approval.approvals.length,
    },
    null,
    2,
  ),
);
