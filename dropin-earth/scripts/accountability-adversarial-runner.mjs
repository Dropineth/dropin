import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { snapshot } from "./lifepp-validation-run.mjs";

const config = JSON.parse(readFileSync("config/accountability-adversarial.json", "utf8"));
assert.ok(config.files.length > 0 && new Set(config.cases).size === config.cases.length);
const before = snapshot();
const head = before.head;
const command = ["--test", "--test-reporter=tap", "--import", "tsx", ...config.files];
const run = spawnSync(process.execPath, command, {encoding:"utf8", timeout:config.timeoutMs,maxBuffer:5_000_000});
const log = (run.stdout ?? "") + (run.stderr ?? "");
process.stdout.write(log);
const after = snapshot();
const passed = [...log.matchAll(/^ok \d+ - (.+)$/gm)].map(match=>match[1]);
const exact = passed.length === config.cases.length && new Set(passed).size === passed.length
  && [...passed].sort().every((name,index)=>name===[...config.cases].sort()[index]);
const success = !run.error && run.signal === null && run.status === 0 && exact && !/^not ok /m.test(log)
  && /# skipped 0\b/.test(log) && /# cancelled 0\b/.test(log)
  && before.sourceStatus === "" && after.sourceStatus === ""
  && ["head", "node", "npm", "lockSha256", "sourceFingerprintSha256"].every(key => before[key] === after[key]);
const github = process.env.GITHUB_ACTIONS === "true";
const result = {targetSha:head,runnerId:github ? `${process.env.GITHUB_REPOSITORY}:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.GITHUB_JOB}` : "local-diagnostic",
  phase:process.env.GITHUB_EVENT_NAME === "pull_request" ? "pull_request" : "merge_candidate",
  completedAt:new Date().toISOString(),conclusion:success?"success":"failure",sourceDirty:before.sourceStatus!=="" || after.sourceStatus!=="",
  before,after,command:[process.execPath,...command],seedRange:config.seedRange,mutants:config.mutants,
  tests:config.cases.map(id=>({id,executed:passed.includes(id),status:passed.includes(id)?"passed":"not-passed",assertions:passed.includes(id)?1:0})),
  assertionCountMeaning:"Lower bound of one designated assertion oracle per completed case; not an instrumented assertion total.",
  stdoutSha256:createHash("sha256").update(log).digest("hex"),exitCode:run.status,signal:run.signal,error:run.error?.message??null,
  productionAuthority:false,trust:"Runner identity and success must be independently bound to CI metadata and artifact digest; this document cannot authenticate itself."};
mkdirSync("reports/ci",{recursive:true});
writeFileSync("reports/ci/accountability-adversarial.tap",log);
writeFileSync("reports/ci/accountability-adversarial.json",JSON.stringify(result,null,2)+"\n");
process.exitCode=success?0:1;
