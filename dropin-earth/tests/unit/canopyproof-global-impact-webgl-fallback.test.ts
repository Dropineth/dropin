import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { classifyGlobalCommandCenterResponse } from "../../apps/web/src/lib/canopyproof-global-command-center.js";
import {
  buildGlobalImpactWebglTelemetry,
  createGlobalImpactWebglInitialState,
  GLOBAL_IMPACT_WEBGL_MAX_RETRIES,
  globalImpactWebglFailureCodes,
  globalImpactWebglMetrics,
  globalImpactWebglPhases,
  reduceGlobalImpactWebglState,
  type GlobalImpactWebglState,
} from "../../apps/web/src/lib/canopyproof-global-impact-webgl.js";

test("Global Impact WebGL lifecycle is deterministic and retry bounded", () => {
  const initial = createGlobalImpactWebglInitialState();
  assert.deepEqual(initial, { phase: "SSR_PLACEHOLDER", attempt: 0 });
  assert.deepEqual(reduceGlobalImpactWebglState(initial, { type: "READY" }), initial);

  const loading = reduceGlobalImpactWebglState(initial, {
    type: "LOAD_STARTED",
  });
  assert.deepEqual(loading, { phase: "THREE_LOADING", attempt: 0 });
  const fallback = reduceGlobalImpactWebglState(loading, {
    type: "FAILED",
    code: "DYNAMIC_IMPORT_FAILED",
  });
  assert.deepEqual(fallback, {
    phase: "FALLBACK_STATIC",
    attempt: 0,
    failureCode: "DYNAMIC_IMPORT_FAILED",
  });
  const retrying = reduceGlobalImpactWebglState(fallback, { type: "RETRY" });
  assert.deepEqual(retrying, { phase: "RETRYING", attempt: 1 });
  assert.equal(retrying.attempt, GLOBAL_IMPACT_WEBGL_MAX_RETRIES);
  assert.deepEqual(
    reduceGlobalImpactWebglState(retrying, { type: "LOAD_STARTED" }),
    retrying,
  );
  const terminal = reduceGlobalImpactWebglState(retrying, {
    type: "FAILED",
    code: "INITIAL_FRAME_TIMEOUT",
  });
  assert.deepEqual(terminal, {
    phase: "TERMINAL_FALLBACK",
    attempt: 1,
    failureCode: "INITIAL_FRAME_TIMEOUT",
  });
  assert.deepEqual(
    reduceGlobalImpactWebglState(terminal, { type: "RETRY" }),
    terminal,
  );
});

test("Global Impact WebGL lifecycle handles ready, context loss, and one controlled recovery", () => {
  const loading: GlobalImpactWebglState = {
    phase: "THREE_LOADING",
    attempt: 0,
  };
  const ready = reduceGlobalImpactWebglState(loading, { type: "READY" });
  assert.deepEqual(ready, { phase: "WEBGL_READY", attempt: 0 });
  const lost = reduceGlobalImpactWebglState(ready, {
    type: "CONTEXT_LOST",
    code: "WEBGL_CONTEXT_LOST",
  });
  assert.deepEqual(lost, {
    phase: "CONTEXT_LOST",
    attempt: 0,
    failureCode: "WEBGL_CONTEXT_LOST",
  });
  assert.deepEqual(reduceGlobalImpactWebglState(lost, { type: "RETRY" }), {
    phase: "RETRYING",
    attempt: 1,
  });
  assert.deepEqual(
    reduceGlobalImpactWebglState(ready, {
      type: "FAILED",
      code: "GPU_PROCESS_UNAVAILABLE",
    }),
    {
      phase: "FALLBACK_STATIC",
      attempt: 0,
      failureCode: "GPU_PROCESS_UNAVAILABLE",
    },
  );
});

test("Global Impact WebGL telemetry is allowlisted, bounded, and identifier free", () => {
  assert.deepEqual(globalImpactWebglMetrics, [
    "global_impact_webgl_ready_total",
    "global_impact_webgl_fallback_total",
    "global_impact_webgl_context_lost_total",
    "global_impact_webgl_retry_total",
    "global_impact_webgl_cold_start_ms",
  ]);
  assert.equal(globalImpactWebglPhases.length, 7);
  assert.equal(globalImpactWebglFailureCodes.length, 10);

  const counter = buildGlobalImpactWebglTelemetry(
    "global_impact_webgl_fallback_total",
    "THREE_LOADING",
    "WEBGL_UNSUPPORTED",
    91,
  );
  assert.deepEqual(counter, {
    metric: "global_impact_webgl_fallback_total",
    value: 1,
    phase: "THREE_LOADING",
    category: "WEBGL_UNSUPPORTED",
  });
  const timing = buildGlobalImpactWebglTelemetry(
    "global_impact_webgl_cold_start_ms",
    "THREE_LOADING",
    "READY",
    1_012,
  );
  assert.equal(timing.value, 1_000);
  assert.deepEqual(Object.keys(timing).sort(), [
    "category",
    "metric",
    "phase",
    "value",
  ]);
  assert.doesNotMatch(
    JSON.stringify(timing),
    /latitude|longitude|regionId|projectId|device|exception|stack/i,
  );
  assert.throws(
    () =>
      buildGlobalImpactWebglTelemetry(
        "global_impact_webgl_cold_start_ms",
        "THREE_LOADING",
        "READY",
        Number.NaN,
      ),
    /finite and nonnegative/,
  );
});

test("Global Impact Earth source keeps one instanced marker mesh and every required fallback trigger", () => {
  const root = process.cwd();
  const page = readFileSync(
    join(root, "apps/web/src/app/dashboard/global/page.tsx"),
    "utf8",
  );
  const earth = readFileSync(
    join(
      root,
      "apps/web/src/components/canopyproof-os/GlobalImpactEarth.tsx",
    ),
    "utf8",
  );
  const loader = readFileSync(
    join(
      root,
      "apps/web/src/components/canopyproof-os/GlobalImpactEarthLoader.tsx",
    ),
    "utf8",
  );
  const fallback = readFileSync(
    join(
      root,
      "apps/web/src/components/canopyproof-os/GlobalImpactEarthFallback.tsx",
    ),
    "utf8",
  );

  assert.equal((earth.match(/<instancedMesh/g) ?? []).length, 1);
  assert.doesNotMatch(page, /export const runtime = ["']edge["']/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(earth, /THREE\.InstancedMesh/);
  assert.doesNotMatch(earth, /new THREE\.Mesh\(/);
  assert.match(earth, /webglcontextlost/);
  assert.match(earth, /PageTransitionEvent/);
  assert.match(earth, /useFrame/);
  assert.match(earth, /frameloop="demand"/);
  assert.match(loader, /ssr: false/);
  for (const code of globalImpactWebglFailureCodes) {
    assert.match(
      `${loader}\n${earth}`,
      new RegExp(code),
      `missing WebGL failure trigger ${code}`,
    );
  }
  assert.match(fallback, /deterministic view/);
  assert.match(fallback, /one-degree regional cohorts/);
  assert.match(fallback, /Snapshot root/);
  assert.doesNotMatch(
    fallback,
    /accuracyMeters|project\\.location|evidence\\.location|scene\\.bbox/,
  );
});

test("Global Impact browser fixture remains a valid durable generalized snapshot", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "tests/fixtures/canopyproof-global-impact-browser.json",
      ),
      "utf8",
    ),
  ) as unknown;
  const classified = classifyGlobalCommandCenterResponse(true, fixture);

  assert.equal(classified.kind, "ready");
  if (classified.kind !== "ready") {
    assert.fail("browser fixture must classify as a durable ready snapshot");
  }
  assert.equal(classified.response.authority, "postgresql_append_only_snapshot");
  assert.equal(
    classified.response.data.regions.some(
      (region) => region.spatial.visibility === "withheld",
    ),
    true,
  );
  for (const region of classified.response.data.regions) {
    assert.equal("latitude" in region.spatial, false);
    assert.equal("longitude" in region.spatial, false);
  }
});
