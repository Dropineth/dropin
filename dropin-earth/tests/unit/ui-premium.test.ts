import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("Landing/Home includes 70% winner, 20% verified reforestation, 10% operations", () => {
  const source = file("apps/web/src/app/page.tsx");

  assert.match(source, /70% Winner/);
  assert.match(source, /20% Verified Reforestation/);
  assert.match(source, /10% Dropin Operations/);
  assert.match(source, /Join climate-impact prize pools\. Track every tree through proof\./);
  assert.match(source, /1 TON \/ USDC Join Draw/);
  assert.match(source, /ClimateDrawPass/);
});

test("Active Draw renders prize pool and Plant & Enter CTA", () => {
  const source = file("apps/web/src/app/lottery/[roundId]/page.tsx");

  assert.match(source, /Active Draw \/ Pre-draw/);
  assert.match(source, /ClimateDrawPass/);
  assert.match(source, /ParticipantAvatars/);
  assert.match(source, /Plant & Enter/);
});

test("Impact Proof includes no certified carbon credit safety copy", () => {
  const source = file("apps/web/src/app/lottery/[roundId]/page.tsx");

  assert.match(source, /Impact Certificate is not a certified carbon credit/);
});

test("Status page renders readiness and system status text", () => {
  const source = file("apps/web/src/app/status/page.tsx");

  assert.match(source, /Public Testnet Readiness/);
  assert.match(source, /API readiness/);
  assert.match(source, /repository mode/i);
  assert.match(source, /TON testnet/i);
});

test("Feedback form renders category and submit controls", () => {
  const source = file("apps/web/src/app/feedback/feedback-form.tsx");

  assert.match(source, /Category/);
  assert.match(source, /Send feedback/);
  assert.match(source, /value: "payment"/);
  assert.match(source, /value: "risk"/);
});

test("Admin readiness panel renders pass, warn, and fail states", () => {
  const source = file("packages/ui/src/index.tsx");
  const adminPage = file("apps/admin/src/app/launch/page.tsx");

  assert.match(source, /AdminReadinessPanel/);
  assert.match(source, /pass/);
  assert.match(source, /warn/);
  assert.match(source, /fail/);
  assert.match(adminPage, /AdminReadinessPanel/);
});

test("Mini App campaign includes testnet-only and Leaf Points non-transferable notices", () => {
  const source = file("apps/miniapp-ton/src/app/campaign/[campaignId]/page.tsx");

  assert.match(source, /Testnet only/);
  assert.match(source, /Leaf Points are non-transferable testnet points/);
  assert.match(source, /Climate Impact Lottery/);
  assert.match(source, /1 TON \/ USDC/);
});
