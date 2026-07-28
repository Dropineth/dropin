import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { normalizeCriticalCoverage } from "../../scripts/canopyproof-critical-coverage-normalizer.mjs";

function location(line: number, start: number, end: number) {
  return {
    start: { line, column: start },
    end: { line, column: end },
  };
}

function range(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
) {
  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "canopyproof-normalizer-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = "services/api/src/critical.ts";
  const absolute = join(root, source);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(
    absolute,
    [
      'import { value } from "./value.js";',
      "export function critical(input: boolean) {",
      "  if (input) return value;",
      "  return false;",
      "}",
      "",
    ].join("\n"),
  );
  const coverage = {
    [absolute]: {
      path: absolute,
      statementMap: {
        "0": location(3, 2, 26),
        "1": location(4, 2, 15),
      },
      fnMap: {
        "0": { name: "critical", decl: location(2, 16, 24), loc: range(2, 7, 5, 1), line: 2 },
        "1": { name: "synthetic", decl: location(1, 0, 6), loc: location(1, 0, 6), line: 1 },
      },
      branchMap: {
        "0": { type: "branch", line: 3, loc: location(3, 2, 26), locations: [location(3, 2, 26)] },
        "1": { type: "branch", line: 1, loc: location(1, 0, 6), locations: [location(1, 0, 6)] },
        "2": { type: "branch", line: 2, loc: location(2, 16, 24), locations: [location(2, 16, 24)] },
        "3": { type: "branch", line: 2, loc: range(2, 7, 5, 1), locations: [range(2, 7, 5, 1)] },
        "4": { type: "branch", line: 5, loc: location(5, 0, 1), locations: [location(5, 0, 1)] },
      },
      s: { "0": 1, "1": 0 },
      f: { "0": 1, "1": 0 },
      b: { "0": [0], "1": [0], "2": [0], "3": [1], "4": [0] },
    },
  };
  return { root, source, absolute, coverage };
}

test("normalizer removes only proven V8 source-map artifacts", (t) => {
  const input = fixture(t);
  const result = normalizeCriticalCoverage({
    root: input.root,
    coverage: input.coverage,
    sourceFiles: [input.source],
  });
  const normalized = result.coverage[input.absolute]!;

  assert.deepEqual(Object.keys(normalized.f), ["0"]);
  assert.deepEqual(Object.keys(normalized.b).sort(), ["0", "3"]);
  assert.equal(normalized.b["0"]?.[0], 0, "real uncovered if branch must remain");
  assert.equal(normalized.s["1"], 0, "real uncovered statements must remain");
  assert.deepEqual(
    new Set(result.audit.removals.map((entry) => entry.reason)),
    new Set([
      "import_declaration",
      "duplicate_function_export_binding",
      "non_executable_closing_brace",
    ]),
  );
});

test("normalizer never removes covered entries even when their source location is synthetic", (t) => {
  const input = fixture(t);
  input.coverage[input.absolute]!.f["1"] = 1;
  input.coverage[input.absolute]!.b["1"] = [1];
  const result = normalizeCriticalCoverage({
    root: input.root,
    coverage: input.coverage,
    sourceFiles: [input.source],
  });
  const normalized = result.coverage[input.absolute]!;

  assert.equal(normalized.f["1"], 1);
  assert.deepEqual(normalized.b["1"], [1]);
});
