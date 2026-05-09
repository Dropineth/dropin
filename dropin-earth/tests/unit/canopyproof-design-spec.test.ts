import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(path, "utf8");
}

test("CanopyProof design tokens define premium climate lottery foundations", () => {
  const tokens = JSON.parse(read("docs/design/canopyproof-design-tokens.json")) as {
    color: Record<string, string>;
    allocation: { winner: { percent: number }; verifiedReforestation: { percent: number }; operations: { percent: number } };
    component: Record<string, unknown>;
  };

  assert.equal(tokens.color.deepSpace, "#05070A");
  assert.equal(tokens.color.canopyGreen, "#00C853");
  assert.equal(tokens.allocation.winner.percent, 70);
  assert.equal(tokens.allocation.verifiedReforestation.percent, 20);
  assert.equal(tokens.allocation.operations.percent, 10);
  assert.ok(tokens.component.cardGlass);
});

test("Figma structure includes required public, mini app, and admin screens", () => {
  const figma = JSON.parse(read("docs/design/canopyproof-figma-structure.json")) as {
    pages: Array<{ name: string; frames: Array<{ name: string; route?: string; sections?: string[] }> }>;
    constraints: string[];
  };
  const frameNames = figma.pages.flatMap((page) => page.frames.map((frame) => frame.name));
  const routes = figma.pages.flatMap((page) => page.frames.map((frame) => frame.route).filter(Boolean));

  assert.ok(frameNames.includes("Landing / Home"));
  assert.ok(frameNames.includes("Active Draw / Pre-draw"));
  assert.ok(frameNames.includes("Won / Result"));
  assert.ok(frameNames.includes("Mini App Campaign"));
  assert.ok(frameNames.includes("Launch Readiness"));
  assert.ok(routes.includes("/status"));
  assert.ok(routes.includes("/feedback"));
  assert.ok(figma.constraints.some((constraint) => constraint.includes("testnet-only limitations")));
});

test("UIUX spec preserves proof and compliance safety boundaries", () => {
  const spec = read("docs/design/canopyproof-uiux-spec.md");

  assert.match(spec, /Apple Wallet/);
  assert.match(spec, /Robinhood/);
  assert.match(spec, /Patagonia Impact Report/);
  assert.match(spec, /70% Winner/);
  assert.match(spec, /20% Verified Reforestation/);
  assert.match(spec, /10% Dropin Operations/);
  assert.match(spec, /Impact Certificate is not a certified carbon credit/);
  assert.match(spec, /RWA Fragment is not guaranteed yield/);
  assert.match(spec, /\$CANOPY does not offset carbon tax/);
  assert.match(spec, /Donation → NGO → Planting → Satellite \/ Oracle → On-chain proof/);
});
