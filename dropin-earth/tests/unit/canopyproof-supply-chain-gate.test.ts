import assert from "node:assert/strict";
import test from "node:test";
import {
  findSecretMarkers,
  findTrackedGeneratedArtifacts,
} from "../../scripts/canopyproof-supply-chain-gate.mjs";

test("supply-chain scanner finds credential markers without exposing values", () => {
  const token = `${["github", "pat"].join("_")}_${"A".repeat(24)}`;
  const findings = findSecretMarkers([
    { path: "fixture.txt", source: `credential=${token}` },
  ]);

  assert.deepEqual(findings, [
    { path: "fixture.txt", category: "github-token" },
  ]);
  assert.doesNotMatch(JSON.stringify(findings), new RegExp(token, "u"));
});

test("supply-chain scanner rejects tracked generated build output", () => {
  assert.deepEqual(
    findTrackedGeneratedArtifacts([
      "dropin-earth/apps/web/.open-next/worker.js",
      "dropin-earth/coverage/coverage-summary.json",
      "dropin-earth/apps/web/src/app/page.tsx",
    ]),
    [
      "dropin-earth/apps/web/.open-next/worker.js",
      "dropin-earth/coverage/coverage-summary.json",
    ],
  );
});

test("supply-chain scanner accepts reviewed source and governance reports", () => {
  assert.deepEqual(
    findTrackedGeneratedArtifacts([
      ".github/workflows/canopyproof-ci.yml",
      "dropin-earth/reports/phase16-9-release-council-approval.json",
      "dropin-earth/services/api/src/app.ts",
    ]),
    [],
  );
});
