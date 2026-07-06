#!/usr/bin/env node
/* global console, process */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOWED_DEPLOY_STATUSES = new Set([
  "DEPLOYED",
  "NOT DEPLOYED / SMOKE FAILED",
  "NOT DEPLOYED / WORKFLOW FAILED",
  "WAITING_FOR_ENVIRONMENT_APPROVAL",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function smokePassed(smokeReport) {
  return Boolean(
    smokeReport?.ok === true &&
      Array.isArray(smokeReport.checks) &&
      smokeReport.checks.length > 0 &&
      smokeReport.checks.every((check) => check?.ok === true),
  );
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function updateProductionReport(input = {}) {
  const deployStatus = input.deployStatus ?? process.env.DEPLOY_STATUS;
  if (!ALLOWED_DEPLOY_STATUSES.has(deployStatus)) {
    throw new Error(`DEPLOY_STATUS must be one of: ${Array.from(ALLOWED_DEPLOY_STATUSES).join(", ")}`);
  }

  const deployTargetSha = input.deployTargetSha ?? requireEnv("DEPLOY_TARGET_SHA");
  const githubRunUrl = input.githubRunUrl ?? requireEnv("GITHUB_RUN_URL");
  const smokePath = input.smokePath ?? join("reports", "canopyproof-production-smoke.json");
  const outputPath = input.outputPath ?? join("reports", "canopyproof-cloudflare-production-report.md");
  const now = input.now ?? new Date();
  const smokeReport = existsSync(smokePath) ? readJson(smokePath) : undefined;

  if (deployStatus === "DEPLOYED" && !smokeReport) {
    throw new Error("Refusing DEPLOYED status because reports/canopyproof-production-smoke.json is missing.");
  }

  if (deployStatus === "DEPLOYED" && !smokePassed(smokeReport)) {
    throw new Error("Refusing DEPLOYED status because production smoke checks did not all pass.");
  }

  const markdown = productionReportMarkdown({
    deployStatus,
    deployTargetSha,
    githubRunUrl,
    smokeReport,
    generatedAt: now.toISOString(),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown);

  return { deployStatus, deployTargetSha, githubRunUrl, outputPath, smokePassed: smokePassed(smokeReport) };
}

export function productionReportMarkdown(input) {
  const smokeRows = input.smokeReport?.checks?.length
    ? input.smokeReport.checks
        .map((check) => `| ${check.label} | ${check.ok ? "PASS" : "FAIL"} | ${check.status ?? ""} | ${check.url ?? ""} |`)
        .join("\n")
    : "| smoke | not available | | |";

  return `# CanopyProof Cloudflare Production Report

Generated: ${input.generatedAt}

Status: ${input.deployStatus}

Production URL: https://canopyproof.org
WWW URL: https://www.canopyproof.org
Deploy target SHA: \`${input.deployTargetSha}\`
Workflow run URL: ${input.githubRunUrl}

## Smoke Results

| Check | Result | Status | URL |
| --- | --- | --- | --- |
${smokeRows}

## Safety Boundaries

- DROPIN_ALLOW_ADMIN_PROXY=false
- No mainnet funds enabled.
- No automatic CANOPY distribution enabled.
- No certified carbon-credit claim.
- No carbon-tax offset claim.
- No guaranteed RWA yield.
- API and Web Workers remain separated: \`canopyproof.org/api/*\` is the API proxy, while \`canopyproof.org/*\` and \`www.canopyproof.org/*\` are the OpenNext web Worker.
- Official logo remains JPG-only through \`/icon.jpg\` and \`/apple-touch-icon.jpg\`; \`icon.svg\` must not be restored.

## Rollback Instructions

- If homepage root fails after deployment, rollback the web OpenNext Worker to the previous successful deployment.
- If \`/api/ready\` fails but web root passes, inspect the API proxy Worker, \`DROPIN_API_ORIGIN\`, and Cloudflare route precedence before rolling back web.
- If \`/api/admin/*\` returns 200, treat it as a critical incident: force \`DROPIN_ALLOW_ADMIN_PROXY=false\`, disable any unsafe admin route exposure, and re-run smoke.
- If unsafe carbon-credit, tax-offset, automatic token distribution, mainnet funds, or guaranteed yield language appears, treat it as a content release blocker and rollback or patch immediately.
- Never delete append-only ledger rows.
- Never patch production by bypassing release approval artifacts or GitHub Environment approval.
`;
}

async function main() {
  const result = await updateProductionReport();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
