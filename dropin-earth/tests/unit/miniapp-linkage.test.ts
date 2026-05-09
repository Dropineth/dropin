import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("Mini App campaign links real campaign data to the active round", () => {
  const source = file("apps/miniapp-ton/src/app/campaign/[campaignId]/page.tsx");
  const index = file("apps/miniapp-ton/src/components/ui/index.ts");
  const leaderboard = file("apps/miniapp-ton/src/components/ui/MiniLeaderboardCard.tsx");

  assert.match(source, /\/campaigns\/\$\{campaignId\}/);
  assert.match(source, /\/campaigns\/\$\{campaignId\}\/me\?userId=demo-user/);
  assert.match(source, /MiniLeaderboardCard/);
  assert.match(source, /href=\{`\/round\/\$\{campaign\.roundId\}`\}/);
  assert.match(source, /Plant & Enter/);
  assert.match(source, /Leaf Points are non-transferable testnet points/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /setInterval/);
  assert.match(index, /MiniLeaderboardCard/);
  assert.match(leaderboard, /No Leaf Points yet/);
});

test("Mini App round renders production-safe payment, ticket, and proof state", () => {
  const source = file("apps/miniapp-ton/src/app/round/[roundId]/page.tsx");
  const entry = file("apps/miniapp-ton/src/app/round/[roundId]/mini-round-entry.tsx");
  const index = file("apps/miniapp-ton/src/components/ui/index.ts");

  assert.match(source, /\/lottery\/rounds\/\$\{roundId\}/);
  assert.match(source, /\/lottery\/rounds\/\$\{roundId\}\/results/);
  assert.match(source, /campaign_v1_ggw_testnet/);
  assert.match(source, /Back to Campaign/);
  assert.match(source, /MiniProofTimeline/);
  assert.match(source, /Proof Layer Online/);
  assert.match(source, /Leaf Points/);
  assert.match(entry, /Payment Intent Status/);
  assert.match(entry, /Ticket Seed/);
  assert.match(entry, /\/payments\/intents/);
  assert.match(entry, /\/lottery\/rounds\/\$\{roundId\}\/enter/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(entry, /Math\.random/);
  assert.doesNotMatch(entry, /setInterval/);
  assert.match(index, /MiniProofTimeline/);
  assert.match(index, /MiniStatusCard/);
});
