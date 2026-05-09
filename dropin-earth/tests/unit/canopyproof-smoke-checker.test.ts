import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const scriptPath = join(process.cwd(), "scripts/check-canopyproof.py");

test("CanopyProof smoke checker is dependency-free and checks production edge gates", () => {
  const script = readFileSync(scriptPath, "utf8");

  assert.match(script, /urllib\.request/);
  assert.doesNotMatch(script, /import requests/);
  assert.match(script, /198\.18\.0\.0\/15/);
  assert.match(script, /--require-www/);
  assert.match(script, /--json-report/);
  assert.match(script, /\/api\/ready/);
  assert.match(script, /\/api\/admin\/launch\/readiness/);
  assert.match(script, /set\(range\(200, 300\)\)/);
  assert.match(script, /\{401, 403\}/);
});

test("CanopyProof smoke checker self-test runs without network access", () => {
  const output = execFileSync("python3", [scriptPath, "--self-test"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.match(output, /CanopyProof DNS \/ TLS \/ Worker Smoke Check/);
  assert.match(output, /\[PASS\] dns/);
  assert.match(output, /\[PASS\] admin/);
  assert.match(output, /Summary: failures=0 warnings=0 checks=4/);
});
