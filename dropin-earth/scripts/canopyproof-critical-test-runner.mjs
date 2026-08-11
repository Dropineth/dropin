/* global process */
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const config = JSON.parse(
  readFileSync(path.join(root, "config", "canopyproof-critical-coverage.json"), "utf8"),
);
if (!Array.isArray(config.testFiles) || config.testFiles.length === 0) {
  throw new Error("critical coverage config must declare testFiles");
}

const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=dot", "--import", "tsx", ...config.testFiles],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
