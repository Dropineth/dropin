/* global process, console */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Acceptance uses the locked Playwright browser revisions. A system-browser
// diagnostic remains available by invoking the fixture directly.
assert.equal(process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE, undefined,
  "The acceptance matrix requires Playwright-installed browser revisions");
const results = [];
for (const engine of ["chromium", "firefox", "webkit"]) {
  const result = spawnSync(process.execPath,
    ["--import", "tsx", "tests/browser/child-stewardship.spec.ts"],
    { env: { ...process.env, CHILD_BROWSER: engine }, stdio: "inherit", timeout: 180_000 });
  results.push({ engine, status: result.status === 0 && !result.error ? "PASS" : "FAIL" });
  if (result.error) console.error(result.error.message);
}
console.log(JSON.stringify({ scope: "synthetic-Hono-TestChildStore-browser-matrix", results }));
if (results.some(result => result.status !== "PASS")) process.exitCode = 1;
