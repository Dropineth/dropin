import type { LeaderboardEntry, Region } from "@dropin/schemas";
import {
  CTAButton,
  ChallengeSurface,
  HeroEarthOrb,
  LeafPointsDashboard,
  LeaderboardCard,
  MetricsCard,
  ProofTimeline,
  RegionImpactMap,
  RoundEconomicsCard,
  UxInteractionCollector,
  WalletRailCard,
} from "@/components/ui";
import { selectUxExperience } from "@/lib/ux-experiments";

const activeRegions: Region[] = [
  {
    id: "region_xishuangbanna_canopyproof",
    name: "Xishuangbanna Canopy Corridor",
    slug: "xishuangbanna-canopy-corridor",
    country: "China",
    restorationType: "mixed native forest",
    restorationPriority: "critical",
    requiredTreesLow: 1_200_000,
    requiredTreesHigh: 1_800_000,
    verifiedTrees: 842_120,
    estimatedCo2eTonnes: 312_400,
    survivalRateEstimate: 0.91,
  },
  {
    id: "region_sahel_great_green_wall",
    name: "Sahel Great Green Wall",
    slug: "sahel-great-green-wall",
    country: "Senegal",
    restorationType: "dryland agroforestry",
    restorationPriority: "high",
    requiredTreesLow: 900_000,
    requiredTreesHigh: 1_400_000,
    verifiedTrees: 521_440,
    estimatedCo2eTonnes: 184_200,
    survivalRateEstimate: 0.84,
  },
  {
    id: "region_kalimantan_mangrove",
    name: "Kalimantan Mangrove Edge",
    slug: "kalimantan-mangrove-edge",
    country: "Indonesia",
    restorationType: "mangrove and peat buffer",
    restorationPriority: "medium",
    requiredTreesLow: 640_000,
    requiredTreesHigh: 1_050_000,
    verifiedTrees: 392_880,
    estimatedCo2eTonnes: 221_900,
    survivalRateEstimate: 0.88,
  },
];

const leaderboardEntries: LeaderboardEntry[] = [
  { rank: 1, userId: "Aurora DAO", leafPoints: 884_200 },
  { rank: 2, userId: "Mangrove Guild", leafPoints: 642_910 },
  { rank: 3, userId: "H3 Cell 872830", leafPoints: 519_440 },
  { rank: 4, userId: "CanopyProof Rangers", leafPoints: 418_120 },
];

export default function Home() {
  const ux = selectUxExperience("web", "canopyproof-production-home");

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <UxInteractionCollector surface="web" experimentId={ux.experimentId} variant={ux.variant} />

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,176,125,0.18),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(30,136,229,0.14),transparent_28%),linear-gradient(135deg,#05070A_0%,#071B16_52%,#0A111C_100%)]" />
        <div className="relative mx-auto grid min-h-[92vh] max-w-7xl gap-10 px-5 py-10 md:grid-cols-[1.02fr_0.98fr] md:items-center lg:px-8">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-emerald-300/24 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Testnet only CanopyProof / Dropin Earth V1
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] md:text-7xl">
                Join climate-impact prize pools. Track every tree through proof.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                A production-safe CanopyProof surface for verified restoration evidence, public draw economics, and
                challengeable impact records. No mainnet funds, no private-key handling, no automatic $CANOPY
                distribution, and no certified carbon credit or carbon-tax offset claim.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <CTAButton
                href="/lottery/round_v1_ggw_demo"
                layout={ux.ctaLayout}
                experimentId={ux.experimentId}
                experimentVariant={ux.variant}
                trackingId="home-join-draw"
              >
                1 TON / USDC Join Draw
              </CTAButton>
              <CTAButton
                href="/projects"
                variant="secondary"
                layout="compact"
                experimentId={ux.experimentId}
                experimentVariant={ux.variant}
                trackingId="home-view-proof"
              >
                View proof records
              </CTAButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricsCard
                title="Verified trees"
                value={1_756_440}
                caption="Aggregated from challengeable proof timelines."
                density={ux.metricDensity}
                experimentId={ux.experimentId}
                experimentVariant={ux.variant}
              />
              <MetricsCard
                title="Estimated impact"
                value={718_500}
                unit="tCO2e"
                caption="Estimate only. Not a certified carbon credit."
                density={ux.metricDensity}
                experimentId={ux.experimentId}
                experimentVariant={ux.variant}
              />
              <MetricsCard
                title="Open challenges"
                value={7}
                caption="Red-team checks remain fail-closed."
                density={ux.metricDensity}
                experimentId={ux.experimentId}
                experimentVariant={ux.variant}
              />
            </div>
          </div>

          <div className="grid gap-5">
            <HeroEarthOrb experimentId={ux.experimentId} experimentVariant={ux.heroVariant} />
            <div className="grid gap-4 lg:grid-cols-2">
              <RoundEconomicsCard winner={70} reforestation={20} operations={10} title="Active Draw Economics" />
              <article className="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_70px_rgb(0_0_0/0.24)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">ClimateDrawPass</p>
                <h2 className="mt-2 text-2xl font-semibold">Active Draw / Pre-draw</h2>
                <div className="mt-5 grid gap-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#05070A]/70 p-3">
                    <span>70% Winner</span>
                    <strong className="text-white">Prize pool</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#05070A]/70 p-3">
                    <span>20% Verified Reforestation</span>
                    <strong className="text-white">Tree work escrow</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#05070A]/70 p-3">
                    <span>10% CanopyProof Operations</span>
                    <strong className="text-white">Audits and ops</strong>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-10 lg:grid-cols-[1.18fr_0.82fr] lg:px-8">
        <RegionImpactMap regions={activeRegions} selectedRegionId="region_xishuangbanna_canopyproof" />
        <div className="grid gap-5">
          <LeaderboardCard entries={leaderboardEntries} />
          <WalletRailCard
            rails={[
              { label: "TON testnet Payment Intent", chain: "TON", status: "testnet" },
              { label: "Ethereum proof wallet", chain: "Ethereum", status: "mock" },
              { label: "Solana anchor witness", chain: "Solana", status: "disabled" },
            ]}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <LeafPointsDashboard
          title="LeafPointsDashboard"
          userId="demo-user"
          leafPoints={18_420}
          rwaTokens={0}
          rank={12}
          activities={[
            { label: "Payment Intent confirmed", amount: 120, source: "testnet", createdAt: "2026-05-17T00:00:00.000Z" },
            { label: "Proof challenge reviewed", amount: 45, source: "red-team", createdAt: "2026-05-17T01:30:00.000Z" },
            { label: "Planting evidence accepted", amount: 240, source: "proof", createdAt: "2026-05-17T03:00:00.000Z" },
          ]}
          poccEvents={[
            { agentId: "proof-of-planting", eventType: "ImpactCertificateIssued", status: "completed" },
            { agentId: "pocc-ahin", eventType: "AhinConsensusCommit", status: "completed" },
          ]}
        />
        <div className="grid gap-5">
          <ProofTimeline
            steps={[
              { label: "Payment Intent", completed: true, description: "Mock/manual or TON testnet verification only." },
              { label: "Evidence root", completed: true, description: "Satellite, field, and operator evidence hashed." },
              { label: "Challenge window", completed: false, description: "Open before any impact record is trusted." },
              { label: "Impact Certificate", completed: false, description: "Proof artifact only, not a carbon credit." },
            ]}
            disclaimer="Impact Certificate is not a certified carbon credit. RWA Fragment is not guaranteed yield. $CANOPY does not offset carbon tax."
          />
          <ChallengeSurface openChallengeCount={7} riskEventCount={3} />
        </div>
      </section>
    </main>
  );
}
