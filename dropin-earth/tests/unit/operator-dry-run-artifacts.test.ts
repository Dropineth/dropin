import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("operator dry-run script exists", () => {
  assert.equal(existsSync("scripts/operator-dry-run.ts"), true);
});

test("failure injection script exists", () => {
  assert.equal(existsSync("scripts/failure-injection.ts"), true);
});

test("launch decision record includes go/no-go section", () => {
  const source = file("docs/launch-decision-record.md");

  assert.match(source, /Go \/ No-Go/);
  assert.match(source, /GO \| NO-GO \| GO WITH MONITORING/);
});

test("operator docs include rollback", () => {
  const source = file("docs/operator-dry-run.md");

  assert.match(source, /Rollback/);
  assert.match(source, /DRY_RUN_MODE=false/);
  assert.match(source, /DROPIN_OPERATOR_WRITE_MODE=true/);
});

test("failure injection docs include duplicate tx hash and fake evidence challenge", () => {
  const source = file("docs/failure-injection.md");

  assert.match(source, /duplicate tx hash/);
  assert.match(source, /fake evidence challenge/);
});
