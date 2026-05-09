import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function rootFile(path: string) {
  return readFileSync(join(process.cwd(), "..", path), "utf8");
}

test("root GitHub Actions workflow deploys CanopyProof production with guardrails", () => {
  const workflow = rootFile(".github/workflows/deploy-canopyproof.yml");

  assert.match(workflow, /CanopyProof Production Deploy/);
  assert.match(workflow, /branches:\n\s+- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /default: "dry-run"/);
  assert.match(workflow, /working-directory: dropin-earth/);
  assert.match(workflow, /cache-dependency-path: dropin-earth\/package-lock\.json/);
  assert.match(workflow, /CF_API_TOKEN_PROD: \$\{\{ secrets\.CF_API_TOKEN_PROD \}\}/);
  assert.match(workflow, /CF_ACCOUNT_ID_PROD: \$\{\{ secrets\.CF_ACCOUNT_ID_PROD \}\}/);
  assert.match(workflow, /WORKER_ZONE_ID_PROD: \$\{\{ secrets\.WORKER_ZONE_ID_PROD \}\}/);
  assert.match(workflow, /DROPIN_API_ORIGIN: \$\{\{ secrets\.DROPIN_API_ORIGIN \}\}/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CF_API_TOKEN_PROD \}\}/);
  assert.match(workflow, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.match(workflow, /DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof\.org/);
  assert.match(workflow, /npm run ci/);
  assert.match(workflow, /npm install --global wrangler/);
  assert.match(workflow, /\.\/deploy-canopyproof-auto\.sh/);
  assert.match(workflow, /https:\/\/canopyproof\.org\/api\/ready/);
  assert.match(workflow, /\/api\/admin\/\*/);
  assert.match(workflow, /SLACK_WEBHOOK_URL/);
  assert.match(workflow, /TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(workflow, /YOUR_CF/);
  assert.doesNotMatch(workflow, /testnet\.canopyproof\.org/);
  assert.doesNotMatch(workflow, /matrix:/);
});
