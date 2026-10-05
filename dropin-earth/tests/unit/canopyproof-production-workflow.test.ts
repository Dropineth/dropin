import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

test("production release is manual, exact-SHA, protected and confined to the existing web Worker", () => {
  const workflow = readFileSync(join(process.cwd(), "..", ".github/workflows/deploy-canopyproof.yml"), "utf8");
  const parsed = parse(workflow) as { on: Record<string, { inputs?: Record<string, { required: boolean }> }>; jobs: Record<string, { if: string; environment?: string; steps: Array<{ run?: string; env?: Record<string, string> }> }> };
  assert.deepEqual(Object.keys(parsed.on), ["workflow_dispatch"], "Main pushes must never automatically deploy");
  for (const name of ["expected_commit_sha", "rollback_version_id", "rollback_deployment_id", "maintainer_attestation_url"]) assert.equal(parsed.on.workflow_dispatch.inputs?.[name].required, true);
  assert.match(workflow, /CanopyProof Production Deploy/);
  assert.match(workflow, /working-directory: dropin-earth/);
  assert.match(workflow, /cache-dependency-path: dropin-earth\/package-lock\.json/);
  for (const job of Object.values(parsed.jobs)) {
    assert.match(job.if, /github\.ref == 'refs\/heads\/main'/);
    assert.match(job.if, /github\.run_attempt == 1/);
    assert.match(job.steps[0].run ?? '', /test "\$LIFEPP_RELEASE_SHA" = "\$GITHUB_SHA"/, 'Reject alternate checkout input before repository code executes');
    for (const step of job.steps) if (step.run) {
      const syntax = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' });
      assert.equal(syntax.status, 0, syntax.stderr);
    }
  }
  assert.equal(parsed.jobs.prepare.environment, undefined);
  assert.equal(parsed.jobs["deploy-production"].environment, "canopyproof-production");
  assert.ok(parsed.jobs.prepare.steps.every(step => !JSON.stringify(step).includes("secrets.")), "No cloud credential before approval");
  assert.match(workflow, /node-version: 22\.22\.3/);
  assert.match(workflow, /npm install --global npm@10\.9\.4/);
  assert.match(workflow, /npm ci --include=optional/);
  assert.match(workflow, /npm --workspace apps\/web run cf:build/);
  assert.match(workflow, /lifepp-release-run\.mjs prepare/);
  assert.match(workflow, /lifepp-release-run\.mjs seal/);
  assert.match(workflow, /lifepp-release-run\.mjs restore/);
  assert.match(workflow, /lifepp-release-run\.mjs deploy/);
  assert.ok(!parsed.jobs["deploy-production"].steps.some(step => step.run?.includes("cf:build")), "Deploy consumes the reviewed artifact without rebuilding");
  const credentialSteps = parsed.jobs["deploy-production"].steps.filter(step => Object.values(step.env ?? {}).some(value => value.includes("secrets.")));
  assert.equal(credentialSteps.length, 1);
  assert.equal(credentialSteps[0].run, "node scripts/lifepp-release-run.mjs deploy");
  assert.equal(credentialSteps[0].env?.CLOUDFLARE_API_TOKEN, "${{ secrets.CF_API_TOKEN_PROD }}");
  assert.equal(credentialSteps[0].env?.CLOUDFLARE_ACCOUNT_ID, "${{ secrets.CF_ACCOUNT_ID_PROD }}");
  assert.equal(credentialSteps[0].env?.WORKER_ZONE_ID_PROD, "${{ secrets.WORKER_ZONE_ID_PROD }}");
  for (const flag of ["DROPIN_ALLOW_ADMIN_PROXY", "DROPIN_MAINNET_TRANSFERS_ENABLED", "DROPIN_PHASE16_PROTOCOL_WRITES_ENABLED", "NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS"]) assert.match(workflow, new RegExp(`${flag}: 'false'`));
  assert.doesNotMatch(workflow, /continue-on-error|pull_request_target|npm install --global wrangler|DROPIN_OPENNEXT_DEPLOY_COMMAND|bash -lc|deploy-canopyproof-auto\.sh/);
  // API deployment and external notifications belonged to the old combined wrapper.
  // Website authorization now requires preserving the independent API proxy unchanged.
  assert.doesNotMatch(workflow, /DROPIN_API_ORIGIN|SLACK_WEBHOOK_URL|TELEGRAM_BOT_TOKEN|NOTIFY/);
  const script = readFileSync("scripts/lifepp-release-run.mjs", "utf8");
  assert.match(script, /https:\/\/canopyproof\.org\/api\/ready/);
  assert.match(script, /https:\/\/www\.canopyproof\.org\//);
  assert.match(script, /https:\/\/canopyproof\.org\/api\/admin\/launch\/readiness', \[403\]/);
  assert.match(script, /validateRoutes/);
  assert.match(script, /spawnSync\('npm', \['--workspace', 'apps\/web', 'run', 'cf:deploy'\]/);
  assert.doesNotMatch(script, /spawnSync\('bash'|shell: true|YOUR_CF|testnet\.canopyproof\.org/);
});
