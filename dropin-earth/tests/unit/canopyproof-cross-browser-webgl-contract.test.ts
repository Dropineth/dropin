import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const repositoryRoot = join(projectRoot, "..");
const browserPath = join(
  projectRoot,
  "tests",
  "browser",
  "canopyproof-global-impact-webgl.spec.ts",
);
const workflowPath = join(
  repositoryRoot,
  ".github",
  "workflows",
  "canopyproof-ci.yml",
);

test("cross-browser WebGL matrix executes Chromium, Firefox, and WebKit without skips", () => {
  const source = readFileSync(browserPath, "utf8");

  assert.match(source, /chromium,\n\s+firefox,\n\s+webkit,/u);
  assert.match(
    source,
    /for \(const engine of \["chromium", "firefox", "webkit"\] as const\)/u,
  );
  assert.match(source, /profile: "mobile-webkit"/u);
  assert.match(source, /WEBGL_UNSUPPORTED/u);
  assert.match(source, /CANVAS_CONTEXT_UNAVAILABLE/u);
  assert.match(source, /DYNAMIC_IMPORT_FAILED/u);
  assert.match(source, /THREE_CHUNK_TIMEOUT/u);
  assert.equal(
    source.match(/await installSuccessfulWebglPreflight\(context\);/gu)
      ?.length,
    2,
    "Chunk failure scenarios must not depend on transient CI GPU availability.",
  );
  assert.match(source, /INITIAL_FRAME_TIMEOUT/u);
  assert.match(source, /WEBGL_CONTEXT_LOST/u);
  assert.match(source, /REDUCED_MOTION_POLICY/u);
  assert.match(source, /Fallback must occupy a visible, stable viewport/u);
  assert.match(source, /region_withheld_cohort_002/u);
  assert.match(source, /canopyproof-cross-browser-webgl\.json/u);
  assert.match(source, /canopyproof-cross-browser-webgl\.md/u);
  assert.match(source, /skipped: 0/u);
  assert.doesNotMatch(source, /\.skip\(|status:\s*"SKIP"|process\.exitCode\s*=\s*0.*catch/su);
});

test("Trust Gate installs every official Playwright browser and preserves matrix evidence", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  assert.match(
    workflow,
    /npx playwright install --with-deps chromium firefox webkit/u,
  );
  assert.match(workflow, /npm run test:webgl:browser/u);
  assert.match(
    workflow,
    /dropin-earth\/reports\/canopyproof-cross-browser-webgl\.json/u,
  );
  assert.match(
    workflow,
    /dropin-earth\/reports\/canopyproof-cross-browser-webgl\.md/u,
  );
  assert.doesNotMatch(workflow, /continue-on-error/u);
});
