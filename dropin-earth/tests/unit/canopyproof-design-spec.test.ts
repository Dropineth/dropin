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

test("Figma document template is handoff-ready for design and engineering", () => {
  const figma = JSON.parse(read("docs/design/canopyproof-figma-document.json")) as {
    document: {
      type: string;
      children: Array<{ name: string; children: Array<{ name: string; type: string; route?: string; children?: unknown[] }> }>;
    };
    components: Record<string, unknown>;
    designTokens: {
      allocation: { winnerPercent: number; verifiedReforestationPercent: number; operationsPercent: number };
      colors: Record<string, string>;
    };
    interactions: Record<string, string>;
    safety: { requiredNotices: string[]; forbiddenFraming: string[] };
    metadata: { designBenchmark: string; productPositioning: string };
  };

  const pagesCanvas = figma.document.children.find((child) => child.name === "Pages");
  assert.equal(figma.document.type, "DOCUMENT");
  assert.ok(pagesCanvas);

  const frames = pagesCanvas.children.map((frame) => frame.name);
  assert.ok(frames.includes("Landing / Home"));
  assert.ok(frames.includes("Connect Wallet"));
  assert.ok(frames.includes("Active Draw / Pre-draw"));
  assert.ok(frames.includes("Impact Proof"));
  assert.ok(frames.includes("Admin Launch Readiness"));
  assert.ok(figma.components.PrizePoolCard);
  assert.equal(figma.designTokens.allocation.winnerPercent, 70);
  assert.equal(figma.designTokens.allocation.verifiedReforestationPercent, 20);
  assert.equal(figma.designTokens.allocation.operationsPercent, 10);
  assert.equal(figma.designTokens.colors.canopyGreen, "#00C853");
  assert.equal(figma.interactions.loading, "skeleton");
  assert.ok(figma.safety.requiredNotices.includes("Impact Certificate is not a certified carbon credit."));
  assert.ok(figma.safety.forbiddenFraming.includes("casino UI"));
  assert.match(figma.metadata.designBenchmark, /Apple Wallet/);
  assert.match(figma.metadata.productPositioning, /Proof-of-Planting/);
});

test("Downloaded Figma UI system import keeps API-shaped nodes and tokens parseable", () => {
  const figma = JSON.parse(read("docs/design/canopyproof-ui-system.figma-import.json")) as {
    document: {
      type: string;
      children: Array<{
        name: string;
        type: string;
        children: Array<{
          name: string;
          type: string;
          absoluteBoundingBox?: { width: number; height: number };
          children?: Array<{ name: string; type: string; fills?: Array<{ type: string }> }>;
        }>;
      }>;
    };
    components: Record<string, { states?: string[]; animation?: string; animations?: string[] }>;
    designTokens: { colors: Record<string, string>; typography: Record<string, { size: number; weight: string }> };
    interactions: Record<string, string>;
    metadata: { author: string; platform: string; theme: string };
  };

  const pages = figma.document.children.find((child) => child.name === "Pages");
  const landing = pages?.children.find((frame) => frame.name === "Landing Page");
  const childNames = landing?.children?.map((node) => node.name) ?? [];

  assert.equal(figma.document.type, "DOCUMENT");
  assert.equal(pages?.type, "CANVAS");
  assert.equal(landing?.type, "FRAME");
  assert.equal(landing?.absoluteBoundingBox?.width, 1440);
  assert.ok(childNames.includes("HeroEarthOrb"));
  assert.ok(childNames.includes("MetricsCard"));
  assert.ok(childNames.includes("CTAButton"));
  assert.deepEqual(figma.components.CTAButton.states, ["default", "hover", "active", "disabled"]);
  assert.equal(figma.components.MetricsCard.animation, "countUp");
  assert.equal(figma.designTokens.colors.primary, "#007A5E");
  assert.equal(figma.designTokens.typography.title1.size, 64);
  assert.equal(figma.interactions.loading, "skeleton");
  assert.equal(figma.metadata.author, "CanopyProof UX Team");
  assert.equal(figma.metadata.platform, "Web + Mobile");
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
