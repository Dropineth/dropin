import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function rootFile(path: string) {
  return readFileSync(join(process.cwd(), "..", path), "utf8");
}

test("legacy CanopyProof workflow is restricted to dry-run guardrails", () => {
  const workflow = rootFile(".github/workflows/deploy-canopyproof.yml");

  assert.match(workflow, /CanopyProof Production Deploy \(Dry Run Only\)/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /default: "dry-run"/);
  assert.match(workflow, /environment: canopyproof-dry-run/);
  assert.match(workflow, /Block legacy live production path/);
  assert.match(workflow, /Legacy live production deployment is disabled/);
  assert.match(workflow, /deploy-cloudflare-worker\.yml/);
  assert.doesNotMatch(workflow, /\n\s+- live\n/);
  assert.match(workflow, /working-directory: dropin-earth/);
  assert.match(workflow, /cache-dependency-path: dropin-earth\/package-lock\.json/);
  assert.match(workflow, /CF_API_TOKEN_PROD: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /CF_ACCOUNT_ID_PROD: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(workflow, /WORKER_ZONE_ID_PROD: \$\{\{ secrets\.WORKER_ZONE_ID_PROD \}\}/);
  assert.match(workflow, /DROPIN_API_ORIGIN: \$\{\{ secrets\.DROPIN_API_ORIGIN \}\}/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.match(workflow, /npm run ci/);
  assert.match(workflow, /npm install --global wrangler/);
  assert.match(workflow, /\.\/deploy-canopyproof-auto\.sh/);
  assert.match(workflow, /python3 scripts\/check-canopyproof\.py/);
  assert.match(workflow, /--require-www/);
  assert.match(workflow, /--api-ready-path \/api\/ready/);
  assert.match(workflow, /--admin-path \/api\/admin\/launch\/readiness/);
  assert.match(workflow, /canopyproof-smoke-report\.json/);
  assert.match(workflow, /SLACK_WEBHOOK_URL/);
  assert.match(workflow, /TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(workflow, /YOUR_CF/);
  assert.doesNotMatch(workflow, /testnet\.canopyproof\.org/);
  assert.doesNotMatch(workflow, /matrix:/);
});
