#!/usr/bin/env node
/* global console, process, setTimeout */
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REPOSITORY = "Dropineth/dropin";
const DEFAULT_MAX_POLLS = 40;
const DEFAULT_INTERVAL_MS = 15_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWaitingForEnvironmentApproval(run) {
  return run?.status === "waiting";
}

export function classifyRun(run) {
  if (isWaitingForEnvironmentApproval(run)) return "WAITING_FOR_ENVIRONMENT_APPROVAL";
  if (run?.status === "completed" && run?.conclusion === "success") return "SUCCEEDED";
  if (run?.status === "completed") return "FAILED";
  return "IN_PROGRESS";
}

export function watchMarkdown(input) {
  return `# CanopyProof Deployment Watch

Generated: ${input.generatedAt}

Status: ${input.status}
Run ID: ${input.runId}
Run URL: ${input.url ?? "unknown"}
Conclusion: ${input.conclusion ?? "pending"}

${input.message}
`;
}

export async function writeWatchReport(input, reportPath = join("reports", "canopyproof-deployment-watch.md")) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, watchMarkdown(input));
}

export function getRunViaGh(runId, repository) {
  const result = spawnSync(
    "gh",
    ["run", "view", String(runId), "--repo", repository, "--json", "status,conclusion,url"],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `gh run view failed with status ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

function runCommand(command, args, env = process.env) {
  const result = spawnSync(command, args, { encoding: "utf8", env, stdio: "inherit" });
  return result.status ?? 1;
}

async function handleCompletedSuccess(run, options) {
  await writeWatchReport({
    generatedAt: new Date().toISOString(),
    status: "SUCCEEDED",
    runId: options.runId,
    url: run.url,
    conclusion: run.conclusion,
    message: "Workflow completed successfully. Running production smoke checks.",
  });

  const smokeStatus = runCommand(process.execPath, ["scripts/canopyproof-production-smoke.mjs"]);
  const deployStatus = smokeStatus === 0 ? "DEPLOYED" : "NOT DEPLOYED / SMOKE FAILED";
  const reportStatus = runCommand(process.execPath, ["scripts/canopyproof-update-production-report.mjs"], {
    ...process.env,
    DEPLOY_TARGET_SHA: options.deployTargetSha,
    GITHUB_RUN_URL: run.url,
    DEPLOY_STATUS: deployStatus,
  });

  return smokeStatus === 0 && reportStatus === 0 ? 0 : 1;
}

async function handleCompletedFailure(run, options) {
  await writeWatchReport({
    generatedAt: new Date().toISOString(),
    status: "FAILED",
    runId: options.runId,
    url: run.url,
    conclusion: run.conclusion,
    message: "Workflow failed. Production is not marked DEPLOYED. Inspect the run logs before retrying.",
  });

  runCommand(process.execPath, ["scripts/canopyproof-update-production-report.mjs"], {
    ...process.env,
    DEPLOY_TARGET_SHA: options.deployTargetSha,
    GITHUB_RUN_URL: run.url,
    DEPLOY_STATUS: "NOT DEPLOYED / WORKFLOW FAILED",
  });

  return 1;
}

export async function watchDeployment(input = {}) {
  const runId = input.runId ?? process.env.GITHUB_RUN_ID;
  if (!runId) throw new Error("GITHUB_RUN_ID is required");

  const repository = input.repository ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const maxPolls = input.maxPolls ?? Number(process.env.CANOPYPROOF_DEPLOY_WATCH_MAX_POLLS ?? DEFAULT_MAX_POLLS);
  const intervalMs = input.intervalMs ?? Number(process.env.CANOPYPROOF_DEPLOY_WATCH_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  const deployTargetSha = input.deployTargetSha ?? process.env.DEPLOY_TARGET_SHA ?? "1557bf27dc68c73b4e91445235c13c215d702a2c";
  const getRun = input.getRun ?? ((id, repo) => getRunViaGh(id, repo));

  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const run = getRun(runId, repository);
    const status = classifyRun(run);

    if (status === "WAITING_FOR_ENVIRONMENT_APPROVAL") {
      const summary = {
        generatedAt: new Date().toISOString(),
        status,
        runId,
        url: run.url,
        conclusion: run.conclusion,
        message: "WAITING_FOR_ENVIRONMENT_APPROVAL: approve the canopyproof-production GitHub Environment in the Actions UI. Automation will not bypass this gate.",
      };
      await writeWatchReport(summary);
      console.log("WAITING_FOR_ENVIRONMENT_APPROVAL");
      return { exitCode: 0, status, run };
    }

    if (status === "SUCCEEDED") {
      const exitCode = await handleCompletedSuccess(run, { runId, deployTargetSha });
      return { exitCode, status, run };
    }

    if (status === "FAILED") {
      const exitCode = await handleCompletedFailure(run, { runId, deployTargetSha });
      return { exitCode, status, run };
    }

    if (attempt < maxPolls) await sleep(intervalMs);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    status: "IN_PROGRESS",
    runId,
    url: undefined,
    conclusion: undefined,
    message: "Workflow is still in progress after the configured polling window. Production is not marked DEPLOYED.",
  };
  await writeWatchReport(summary);
  return { exitCode: 0, status: "IN_PROGRESS" };
}

async function main() {
  const result = await watchDeployment();
  process.exit(result.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
