import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const workflowPath = join(process.cwd(), "..", ".github", "workflows", "canopyproof-ci.yml");
const packagePath = join(process.cwd(), "package.json");

test("repository-root CanopyProof CI is a non-deploying trust gate", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  assert.match(workflow, /name: CanopyProof Trust Gate/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.match(workflow, /working-directory: dropin-earth/);
  assert.match(workflow, /node-version: 22\.22\.3/);
  assert.match(workflow, /npm install --global npm@10\.9\.4/);
  assert.match(workflow, /npm ci --include=optional/);
  assert.match(workflow, /npm run ci/);
  assert.match(workflow, /npm run db:verify:canopyproof:native/);
  assert.match(workflow, /npm run test:coverage:ratchet 2>&1 \| tee reports\/ci\/canopyproof-coverage\.txt/);
  assert.match(workflow, /set -o pipefail/);
  assert.match(workflow, /test -s reports\/ci\/canopyproof-coverage\.txt/);
  assert.match(workflow, /test -s coverage\/coverage-summary\.json/);
  assert.match(workflow, /dropin-earth\/coverage\/coverage-summary\.json/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /npm --workspace apps\/web run cf:build/);
  assert.match(workflow, /test -f apps\/web\/\.open-next\/worker\.js/);
  assert.match(workflow, /test -d apps\/web\/\.open-next\/assets/);
  assert.match(workflow, /CANOPYPROOF_NATIVE_TEST_CONFIRM: confirm-disposable-test-database/);
  assert.match(workflow, /canopyproof_ci_test/);
  assert.match(
    workflow,
    /DATABASE_URL="\$connection_url" \\\n\s+CANOPYPROOF_NATIVE_DATABASE_URL="\$connection_url" \\\n\s+npm run db:verify:canopyproof:native/,
  );
  assert.match(workflow, /id: coverage/);
  assert.match(workflow, /steps\.coverage\.outcome != 'skipped'/);

  const jobEnvironment = workflow.match(
    /\n[ ]{4}env:\n(?<contents>[\s\S]*?)\n\n[ ]{4}steps:/,
  )?.groups?.contents;
  assert.ok(jobEnvironment, "the trust-gate job environment must be explicit");
  assert.doesNotMatch(jobEnvironment, /(?:^|\n)\s+(?:DATABASE_URL|CANOPYPROOF_NATIVE_DATABASE_URL):/);
  assert.doesNotMatch(workflow, />> "\$GITHUB_ENV"/);

  for (const boundary of [
    "CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED",
    "CANOPYPROOF_NASA_GIBS_ENABLED",
    "DROPIN_ALLOW_ADMIN_PROXY",
    "DROPIN_AUTOMATIC_CANOPY_DISTRIBUTION_ENABLED",
    "DROPIN_MAINNET_TRANSFERS_ENABLED",
    "DROPIN_PHASE16_PROTOCOL_WRITES_ENABLED",
    "NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS",
  ]) {
    assert.match(workflow, new RegExp(`${boundary}: "false"`));
    assert.doesNotMatch(workflow, new RegExp(`${boundary}: "true"`));
  }

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /environment:/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler\s+(?:deploy|publish)/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("repository coverage ratchet includes all source and remains below the unmet institutional target", () => {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const measurement = packageJson.scripts?.["test:coverage"];
  const ratchet = packageJson.scripts?.["test:coverage:ratchet"];

  assert.ok(measurement, "test:coverage measurement command must remain available");
  assert.ok(ratchet, "test:coverage:ratchet must be configured");
  assert.equal(packageJson.devDependencies?.c8, "12.0.0");
  for (const sourceGlob of [
    "apps/*/src/**/*.ts",
    "apps/*/src/**/*.tsx",
    "packages/*/src/**/*.ts",
    "packages/*/src/**/*.tsx",
    "services/*/src/**/*.ts",
    "services/*/src/**/*.tsx",
  ]) {
    assert.match(measurement, new RegExp(escapeRegex(sourceGlob)));
    assert.match(ratchet, new RegExp(escapeRegex(sourceGlob)));
  }
  assert.match(measurement, /^c8 --all /);
  assert.match(ratchet, /^c8 --all --check-coverage /);
  assert.match(ratchet, /--statements=65(?:\s|$)/);
  assert.match(ratchet, /--lines=65(?:\s|$)/);
  assert.match(ratchet, /--branches=72\.75(?:\s|$)/);
  assert.match(ratchet, /--functions=69\.5(?:\s|$)/);
  assert.match(measurement, /--reporter=json-summary/);
  assert.match(ratchet, /--reporter=json-summary/);
  assert.doesNotMatch(measurement, /--check-coverage|--(?:statements|lines|branches|functions)=/);
  assert.doesNotMatch(ratchet, /--(?:statements|lines|branches|functions)=9\d(?:\.\d+)?/);
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
