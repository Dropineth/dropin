import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("Draw surface includes 70% winner, 20% verified reforestation, 10% operations", () => {
  const source = file("apps/web/src/app/draw/page.tsx");

  assert.match(source, /70% Winner/);
  assert.match(source, /20% Verified Reforestation/);
  assert.match(source, /10% CanopyProof Operations/);
  assert.match(source, /Join climate-impact prize pools\. Track every tree through proof\./);
  assert.match(source, /1 TON \/ USDC Join Draw/);
  assert.match(source, /ClimateDrawPass/);
  assert.match(source, /CTAButton/);
  assert.match(source, /MetricsCard/);
});

test("CanopyProof imported UI components exist as web-local adapters", () => {
  const hero = file("apps/web/src/components/ui/HeroEarthOrb.tsx");
  const heroCss = file("apps/web/src/components/ui/HeroEarthOrb.module.css");
  const metrics = file("apps/web/src/components/ui/MetricsCard.tsx");
  const button = file("apps/web/src/components/ui/CTAButton.tsx");
  const economics = file("apps/web/src/components/ui/RoundEconomicsCard.tsx");
  const proofTimeline = file("apps/web/src/components/ui/ProofTimeline.tsx");
  const regionMap = file("apps/web/src/components/ui/RegionImpactMap.tsx");
  const leaderboard = file("apps/web/src/components/ui/LeaderboardCard.tsx");
  const challenge = file("apps/web/src/components/ui/ChallengeSurface.tsx");
  const walletRails = file("apps/web/src/components/ui/WalletRailCard.tsx");
  const index = file("apps/web/src/components/ui/index.ts");

  assert.match(hero, /CanopyProof rotating Earth and forest orb/);
  assert.match(heroCss, /canopyproof-orbit/);
  assert.match(heroCss, /prefers-reduced-motion/);
  assert.match(metrics, /Intl\.NumberFormat/);
  assert.match(metrics, /prefers-reduced-motion/);
  assert.match(button, /aria-disabled/);
  assert.match(button, /min-w-\[200px\]/);
  assert.match(economics, /Verified Reforestation/);
  assert.match(economics, /70\/20\/10/);
  assert.match(proofTimeline, /Impact proof timeline/);
  assert.match(proofTimeline, /Challengeable/);
  assert.match(regionMap, /Global Map \/ Area Selection/);
  assert.match(regionMap, /Interactive 3D Earth orb region selector/);
  assert.match(leaderboard, /Global \/ Regional Leaderboard/);
  assert.match(challenge, /Payment, randomness, evidence, Impact Certificate/);
  assert.match(walletRails, /TON \/ Ethereum \/ Solana ready/);
  assert.match(index, /HeroEarthOrb/);
  assert.match(index, /MetricsCard/);
  assert.match(index, /CTAButton/);
  assert.match(index, /RoundEconomicsCard/);
  assert.match(index, /ProofTimeline/);
  assert.match(index, /RegionImpactMap/);
  assert.match(index, /LeaderboardCard/);
  assert.match(index, /ChallengeSurface/);
  assert.match(index, /WalletRailCard/);
});

test("Active Draw renders prize pool and Plant & Enter CTA", () => {
  const source = file("apps/web/src/app/lottery/[roundId]/page.tsx");

  assert.match(source, /Active Draw \/ Pre-draw/);
  assert.match(source, /ClimateDrawPass/);
  assert.match(source, /ParticipantAvatars/);
  assert.match(source, /Plant & Enter/);
  const home = file("apps/web/src/app/page.tsx");
  const draw = file("apps/web/src/app/draw/page.tsx");
  assert.match(home, /CanopyProofLanding/);
  assert.match(draw, /RegionImpactMap/);
  assert.match(draw, /LeaderboardCard/);
  assert.match(draw, /WalletRailCard/);
  assert.match(draw, /ChallengeSurface/);
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
  const index = file("apps/miniapp-ton/src/components/ui/index.ts");
  const hero = file("apps/miniapp-ton/src/components/ui/MiniHeroEarthOrb.tsx");
  const region = file("apps/miniapp-ton/src/components/ui/MiniImpactRegionCard.tsx");
  const economics = file("apps/miniapp-ton/src/components/ui/MiniRoundEconomicsCard.tsx");
  const leaderboard = file("apps/miniapp-ton/src/components/ui/MiniLeaderboardCard.tsx");

  assert.match(source, /Testnet only/);
  assert.match(source, /Leaf Points are non-transferable testnet points/);
  assert.match(source, /Climate Impact Lottery/);
  assert.match(source, /1 TON \/ USDC/);
  assert.match(source, /Plant & Enter/);
  assert.match(source, /MiniHeroEarthOrb/);
  assert.match(source, /MiniRoundEconomicsCard/);
  assert.match(source, /MiniLeaderboardCard/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /setInterval/);
  assert.match(index, /MiniHeroEarthOrb/);
  assert.match(index, /MiniMetricsCard/);
  assert.match(index, /MiniCTAButton/);
  assert.match(index, /MiniRoundEconomicsCard/);
  assert.match(index, /MiniLeaderboardCard/);
  assert.match(index, /MiniImpactRegionCard/);
  assert.match(hero, /TON \/ USDC testnet only/);
  assert.match(region, /Mini 3D Earth orb region selector/);
  assert.match(region, /Carbon Claim/);
  assert.match(economics, /Verified Reforestation/);
  assert.match(economics, /70\/20\/10/);
  assert.match(leaderboard, /Leaderboard/);
  assert.match(leaderboard, /No Leaf Points yet/);
});

test("Mini App round links campaign and renders production-safe payment and proof status", () => {
  const source = file("apps/miniapp-ton/src/app/round/[roundId]/page.tsx");
  const entry = file("apps/miniapp-ton/src/app/round/[roundId]/mini-round-entry.tsx");
  const index = file("apps/miniapp-ton/src/components/ui/index.ts");
  const proofTimeline = file("apps/miniapp-ton/src/components/ui/MiniProofTimeline.tsx");
  const statusCard = file("apps/miniapp-ton/src/components/ui/MiniStatusCard.tsx");

  assert.match(source, /campaign_v1_ggw_testnet/);
  assert.match(source, /Back to Campaign/);
  assert.match(source, /Proof Layer \/ Anchor/);
  assert.match(source, /Proof Layer Online/);
  assert.match(source, /Leaf Points/);
  assert.match(source, /TON \/ USDC testnet draw/);
  assert.match(entry, /Payment Intent Status/);
  assert.match(entry, /Ticket Seed/);
  assert.match(entry, /Create \$\{selectedCurrency\} Payment Intent/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(entry, /Math\.random/);
  assert.doesNotMatch(entry, /setInterval/);
  assert.match(index, /MiniProofTimeline/);
  assert.match(index, /MiniStatusCard/);
  assert.match(proofTimeline, /Proof Layer \/ Anchor/);
  assert.match(statusCard, /MiniStatusCard/);
});
