import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  validateWorkerdResponse,
  WORKERD_ROUTE_CHECKS,
} from "../../scripts/canopyproof-local-workerd-smoke.mjs";

test("local workerd smoke owns all public routes and the removed SVG boundary", () => {
  assert.equal(WORKERD_ROUTE_CHECKS.length, 15);
  assert.deepEqual(WORKERD_ROUTE_CHECKS.at(-1), ["/icon.svg", 404]);
  assert.equal(
    WORKERD_ROUTE_CHECKS.some(
      ([path, status]) => path === "/dashboard/global" && status === 200,
    ),
    true,
  );
  assert.equal(
    WORKERD_ROUTE_CHECKS.some(
      ([path, status]) => path === "/apple-touch-icon.jpg" && status === 200,
    ),
    true,
  );
});

test("local workerd response validator rejects missing branding and raw coordinates", async () => {
  await assert.rejects(
    () =>
      validateWorkerdResponse(
        "/",
        new Response("<main>generic page</main>", {
          headers: { "content-type": "text/html" },
          status: 200,
        }),
      ),
    /does not contain CanopyProof HTML/u,
  );
  await assert.rejects(
    () =>
      validateWorkerdResponse(
        "/",
        new Response("<main>CanopyProof 14.7167</main>", {
          headers: { "content-type": "text/html" },
          status: 200,
        }),
      ),
    /disclosed a raw coordinate/u,
  );
});

test("Trust Gate runs workerd only after OpenNext artifact verification", () => {
  const workflow = readFileSync(
    join(process.cwd(), "..", ".github", "workflows", "canopyproof-ci.yml"),
    "utf8",
  );
  const artifactIndex = workflow.indexOf(
    "- name: Verify OpenNext artifact shape",
  );
  const workerdIndex = workflow.indexOf(
    "- name: Run local OpenNext workerd route smoke",
  );

  assert.ok(artifactIndex >= 0);
  assert.ok(workerdIndex > artifactIndex);
  assert.match(workflow, /npm run test:workerd/u);
  assert.match(
    workflow,
    /dropin-earth\/reports\/canopyproof-workerd-smoke\.json/u,
  );
});
