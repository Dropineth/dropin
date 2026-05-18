#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_PHASE = "16.9";
const REQUIRED_TARGET = "canopyproof-production";
const REQUIRED_APPROVAL_MODEL = "2-of-N release council";
const REQUIRED_APPROVALS = 2;
const approvalPath = resolve(
  process.cwd(),
  "reports/phase16-9-release-council-approval.json",
);

function fail(code, details = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code,
        ...details,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

function cliValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }

  return process.argv[index + 1] ?? "";
}

if (!existsSync(approvalPath)) {
  fail("RELEASE_COUNCIL_APPROVAL_FILE_MISSING", { approvalPath });
}

let payload;
try {
  payload = JSON.parse(readFileSync(approvalPath, "utf8"));
} catch (error) {
  fail("RELEASE_COUNCIL_APPROVAL_FILE_INVALID_JSON", {
    approvalPath,
    message: error instanceof Error ? error.message : String(error),
  });
}

const targetDeploySha = (
  cliValue("--target-sha") || process.env.TARGET_DEPLOY_SHA || ""
).trim();

if (!/^[0-9a-f]{40}$/i.test(targetDeploySha)) {
  fail("TARGET_DEPLOY_SHA_REQUIRED", {
    detail: "Pass --target-sha or TARGET_DEPLOY_SHA as a 40-character commit SHA.",
  });
}

if (payload.phase !== REQUIRED_PHASE) {
  fail("RELEASE_COUNCIL_APPROVAL_WRONG_PHASE", {
    expected: REQUIRED_PHASE,
    actual: payload.phase,
  });
}

if (payload.target !== REQUIRED_TARGET) {
  fail("RELEASE_COUNCIL_APPROVAL_WRONG_TARGET", {
    expected: REQUIRED_TARGET,
    actual: payload.target,
  });
}

if (Object.hasOwn(payload, "commit")) {
  fail("RELEASE_COUNCIL_APPROVAL_LEGACY_COMMIT_FIELD_PRESENT", {
    detail: "Use target_commit to avoid self-referential approval evidence.",
  });
}

if (payload.target_commit !== targetDeploySha) {
  fail("RELEASE_COUNCIL_APPROVAL_TARGET_COMMIT_MISMATCH", {
    expected: targetDeploySha,
    actual: payload.target_commit,
  });
}

if (payload.approval_model !== REQUIRED_APPROVAL_MODEL) {
  fail("RELEASE_COUNCIL_APPROVAL_MODEL_INVALID", {
    expected: REQUIRED_APPROVAL_MODEL,
    actual: payload.approval_model,
  });
}

if (!Array.isArray(payload.approvals)) {
  fail("RELEASE_COUNCIL_APPROVALS_NOT_ARRAY");
}

const uniqueApprovals = new Map();

for (const [index, approval] of payload.approvals.entries()) {
  const reviewer =
    typeof approval?.reviewer === "string" ? approval.reviewer.trim() : "";
  const role = typeof approval?.role === "string" ? approval.role.trim() : "";
  const decision =
    typeof approval?.decision === "string" ? approval.decision.trim() : "";
  const timestamp =
    typeof approval?.timestamp === "string" ? approval.timestamp.trim() : "";
  const rationale =
    typeof approval?.rationale === "string" ? approval.rationale.trim() : "";

  if (!reviewer) {
    fail("RELEASE_COUNCIL_APPROVAL_REVIEWER_MISSING", { index });
  }

  if (role !== "release-council") {
    fail("RELEASE_COUNCIL_APPROVAL_ROLE_INVALID", {
      index,
      reviewer,
      expected: "release-council",
      actual: role,
    });
  }

  if (decision !== "approve") {
    fail("RELEASE_COUNCIL_APPROVAL_DECISION_NOT_APPROVE", {
      index,
      reviewer,
      actual: decision,
    });
  }

  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    fail("RELEASE_COUNCIL_APPROVAL_TIMESTAMP_INVALID", {
      index,
      reviewer,
    });
  }

  if (!rationale) {
    fail("RELEASE_COUNCIL_APPROVAL_RATIONALE_MISSING", {
      index,
      reviewer,
    });
  }

  uniqueApprovals.set(reviewer, { reviewer, role, decision, timestamp });
}

if (uniqueApprovals.size < REQUIRED_APPROVALS) {
  fail("RELEASE_COUNCIL_APPROVAL_QUORUM_NOT_MET", {
    required: REQUIRED_APPROVALS,
    observed: uniqueApprovals.size,
    reviewers: [...uniqueApprovals.keys()],
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: REQUIRED_PHASE,
      target: REQUIRED_TARGET,
      target_commit: targetDeploySha,
      approval_model: REQUIRED_APPROVAL_MODEL,
      requiredApprovals: REQUIRED_APPROVALS,
      observedApprovals: uniqueApprovals.size,
      reviewers: [...uniqueApprovals.keys()],
      productionDeployAuthorization: "release-council-quorum-verified",
    },
    null,
    2,
  ),
);
