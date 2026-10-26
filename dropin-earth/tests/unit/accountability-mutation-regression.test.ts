import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Executable counterexamples, isolated source copies only. A parser/compiler error is not a killed mutant.
test("bounded accountability mutants are killed by assertion oracles, with a passing original control", async () => {
  const directory = await mkdtemp(join(tmpdir(), "accountability-mutants-"));
  try {
    const index = await readFile("packages/crypto/src/index.ts", "utf8");
    const projection = await readFile("packages/crypto/src/projection-admission.ts", "utf8");
    const checks = (await readFile("tests/unit/accountability-projection-adversarial.test.ts", "utf8"))
      .replace('from "@dropin/crypto"', 'from "./index.ts"');
    await writeFile(join(directory, "checks.test.ts"), checks);
    const run = () => spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--import",
      resolve("node_modules/tsx/dist/loader.mjs"), join(directory, "checks.test.ts")],
    { encoding: "utf8", timeout: 20_000, maxBuffer: 1_000_000, env: { PATH: process.env.PATH, LANG: "C" } });
    const candidates = [
      { id: "M-WEIGHT", file: "index", before: "quorumWeight >= input.requiredWeight && warnings.length === 0",
        after: "input.sources.reduce((sum, item) => sum + item.weight, 0) >= input.requiredWeight", killedBy: "C08 duplicate source" },
      { id: "M-REVOCATION", file: "projection", before: "!current || current.revoked ||", after: "!current ||", killedBy: "C08 current revocation" },
      { id: "M-AUTHORITY", file: "projection", before: "finalAuthority: false as const, economicAuthority: false as const",
        after: "finalAuthority: true as const, economicAuthority: true as const", killedBy: "C08 true transport signature" },
    ];
    await writeFile(join(directory, "index.ts"), index.replaceAll('"./projection-admission.js"', '"./projection-admission.ts"'));
    await writeFile(join(directory, "projection-admission.ts"), projection);
    const control = run();
    assert.equal(control.status, 0, `legitimate control failed: ${control.stdout}\n${control.stderr}`);
    assert.match(control.stdout, /# pass 7\b/);
    for (const mutant of candidates) {
      const original = mutant.file === "index" ? index : projection;
      assert.equal(original.split(mutant.before).length, 2, `${mutant.id}: mutation must match exactly once`);
      await writeFile(join(directory, "index.ts"), (mutant.file === "index" ? index.replace(mutant.before, mutant.after) : index)
        .replaceAll('"./projection-admission.js"', '"./projection-admission.ts"'));
      await writeFile(join(directory, "projection-admission.ts"), mutant.file === "projection" ? projection.replace(mutant.before, mutant.after) : projection);
      const result = run();
      assert.equal(result.error, undefined, `${mutant.id}: timeout/spawn failure is not a kill`);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1, `${mutant.id}: survived or runner failed: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, new RegExp(`not ok \\d+ - ${mutant.killedBy}`), `${mutant.id}: designated oracle did not fail`);
      assert.match(result.stdout, /ERR_ASSERTION/, `${mutant.id}: must fail an assertion`);
      assert.doesNotMatch(result.stdout + result.stderr, /SyntaxError|TransformError|ERR_MODULE_NOT_FOUND/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
