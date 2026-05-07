import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { app } from "../../services/api/src/app.js";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("campaign page copy includes testnet-only notice", () => {
  const source = file("apps/web/src/app/campaigns/[campaignId]/page.tsx");

  assert.match(source, /Testnet only/);
  assert.match(source, /No mainnet funds/);
  assert.match(source, /Leaf Points are non-transferable/);
});

test("campaign page copy includes no certified carbon credit notice", () => {
  const source = file("apps/web/src/app/campaigns/[campaignId]/page.tsx");

  assert.match(source, /Impact Certificate is not a certified carbon credit/);
});

test("campaign page copy includes no guaranteed yield notice", () => {
  const source = file("apps/web/src/app/campaigns/[campaignId]/page.tsx");

  assert.match(source, /RWA Fragment is not guaranteed yield/);
});

test("FAQ page includes key safety answers", () => {
  const source = file("apps/web/src/app/faq/page.tsx");

  assert.match(source, /testnet-only/);
  assert.match(source, /Leaf Points are non-transferable testnet points only/);
  assert.match(source, /Impact Certificate is not a certified carbon credit/);
  assert.match(source, /RWA Fragment is not guaranteed yield/);
  assert.match(source, /\$CANOPY does not offset carbon tax/);
});

test("red-team page links to challenge board", () => {
  const source = file("apps/web/src/app/red-team/page.tsx");

  assert.match(source, /href="\/challenges"/);
  assert.match(source, /Open Challenge Board/);
});

test("public launch pack endpoint returns expected docs metadata", async () => {
  const response = await app.request("/public/launch-pack");
  const payload = (await response.json()) as {
    ok: boolean;
    data: {
      status: string;
      docs: Array<{ id: string; path: string }>;
      limitations: string[];
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.status, "testnet_only");
  assert.ok(payload.data.docs.some((doc) => doc.id === "red_team_challenge_guide"));
  assert.ok(payload.data.docs.some((doc) => doc.path === "docs/launch-pack/public-impact-report-template.md"));
  assert.ok(payload.data.limitations.includes("No mainnet payment rail"));
  assert.ok(payload.data.limitations.includes("Impact Certificate is not a certified carbon credit"));
});
