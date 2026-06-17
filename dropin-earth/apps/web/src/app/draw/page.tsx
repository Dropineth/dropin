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
import { selectUxExperience, type UxExperienceFlags } from "@/lib/ux-experiments";

export const runtime = "edge";

const SELECTED_REGION_ID = "region_xishuangbanna_canopyproof";

type HeroMetric = {
  caption: string;
  title: string;
  unit?: string;
  value: number;
};

type AllocationRow = {
  label: string;
  value: string;
};

const activeRegions = [
  {
    id: SELECTED_REGION_ID,
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
] satisfies Region[];

const leaderboardEntries = [
  { rank: 1, userId: "Aurora DAO", leafPoints: 884_200 },
  { rank: 2, userId: "Mangrove Guild", leafPoints: 642_910 },
  { rank: 3, userId: "H3 Cell 872830", leafPoints: 519_440 },
  { rank: 4, userId: "CanopyProof Rangers", leafPoints: 418_120 },
] satisfies LeaderboardEntry[];

const heroMetrics = [
  {
    title: "Verified trees",
    value: 1_756_440,
    caption: "Aggregated from challengeable proof timelines.",
  },
  {
    title: "Estimated impact",
    value: 718_500,
    unit: "tCO2e",
    caption: "Estimate only. Not a certified carbon credit.",
  },
  {
    title: "Open challenges",
    value: 7,
    caption: "Red-team checks remain fail-closed.",
  },
] satisfies HeroMetric[];

const allocationRows = [
  { label: "70% Winner", value: "Prize pool" },
  { label: "20% Verified Reforestation", value: "Tree work escrow" },
  { label: "10% CanopyProof Operations", value: "Audits and ops" },
] satisfies AllocationRow[];

const walletRails = [
  { label: "TON testnet Payment Intent", chain: "TON", status: "testnet" },
  { label: "Ethereum proof wallet", chain: "Ethereum", status: "mock" },
  { label: "Solana anchor witness", chain: "Solana", status: "disabled" },
] satisfies Array<{
  chain: "TON" | "Ethereum" | "Solana";
  label: string;
  status: "disabled" | "mock" | "testnet";
}>;

const leafActivities = [
  { label: "Payment Intent confirmed", amount: 120, source: "testnet", createdAt: "2026-05-17T00:00:00.000Z" },
  { label: "Proof challenge reviewed", amount: 45, source: "red-team", createdAt: "2026-05-17T01:30:00.000Z" },
  { label: "Planting evidence accepted", amount: 240, source: "proof", createdAt: "2026-05-17T03:00:00.000Z" },
];

const poccEvents = [
  { agentId: "proof-of-planting", eventType: "ImpactCertificateIssued", status: "completed" },
  { agentId: "pocc-ahin", eventType: "AhinConsensusCommit", status: "completed" },
];

const proofSteps = [
  { label: "Payment Intent", completed: true, description: "Mock/manual or TON testnet verification only." },
  { label: "Evidence root", completed: true, description: "Satellite, field, and operator evidence hashed." },
  { label: "Challenge window", completed: false, description: "Open before any impact record is trusted." },
  { label: "Impact Certificate", completed: false, description: "Proof artifact only, not a carbon credit." },
];

function hasItems<T>(items: readonly T[]): items is readonly [T, ...T[]] {
  return items.length > 0;
}

export default function DrawHome() {
  const ux = selectUxExperience("web", "canopyproof-production-home");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <UxInteractionCollector surface="web" experimentId={ux.experimentId} variant={ux.variant} />

      <HeroSection ux={ux} />
      <RestorationProofSection />
      <DashboardSection />
    </main>
  );
}

function HeroSection({ ux }: { ux: UxExperienceFlags }) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900">
      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-5 py-12 md:grid-cols-2 md:items-center lg:px-8">
        <div className="space-y-8">
          <div className="inline-flex items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-100">
            Testnet only CanopyProof / Dropin Earth V1
          </div>

          <div className="space-y-5">
            <h1 className="max-w-4xl text-5xl font-semibold leading-none md:text-7xl">
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

          <HeroMetricDeck metrics={heroMetrics} ux={ux} />
        </div>

        <div className="grid gap-5">
          <HeroEarthOrb experimentId={ux.experimentId} experimentVariant={ux.heroVariant} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RoundEconomicsCard winner={70} reforestation={20} operations={10} title="Active Draw Economics" />
            <ActiveDrawPanel rows={allocationRows} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMetricDeck({ metrics, ux }: { metrics: readonly HeroMetric[]; ux: UxExperienceFlags }) {
  if (!hasItems(metrics)) {
    return <MetricSkeletonDeck />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <MetricsCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          caption={metric.caption}
          density={ux.metricDensity}
          experimentId={ux.experimentId}
          experimentVariant={ux.variant}
          {...(metric.unit ? { unit: metric.unit } : {})}
        />
      ))}
    </div>
  );
}

function MetricSkeletonDeck() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Loading impact metrics">
      {["verified-trees", "estimated-impact", "open-challenges"].map((metric) => (
        <div
          className="min-h-44 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur"
          key={metric}
        >
          <div className="h-3 w-24 rounded-full bg-white/10" />
          <div className="mt-6 h-9 w-32 rounded-full bg-white/10" />
          <div className="mt-5 h-3 w-full rounded-full bg-white/10" />
          <div className="mt-2 h-3 w-3/4 rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function ActiveDrawPanel({ rows }: { rows: readonly AllocationRow[] }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">ClimateDrawPass</p>
      <h2 className="mt-2 text-2xl font-semibold">Active Draw / Pre-draw</h2>
      <div className="mt-5 grid gap-3 text-sm text-slate-300">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-3"
            key={row.label}
          >
            <span>{row.label}</span>
            <strong className="text-white">{row.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function RestorationProofSection() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-5 py-10 lg:grid-cols-2 lg:px-8">
      <RegionImpactMap regions={activeRegions} selectedRegionId={SELECTED_REGION_ID} />
      <div className="grid gap-5">
        <LeaderboardCard entries={leaderboardEntries} />
        <WalletRailCard rails={walletRails} />
      </div>
    </section>
  );
}

function DashboardSection() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-12 lg:grid-cols-2 lg:px-8">
      <LeafPointsDashboard
        title="LeafPointsDashboard"
        userId="demo-user"
        leafPoints={18_420}
        rwaTokens={0}
        rank={12}
        activities={leafActivities}
        poccEvents={poccEvents}
      />
      <div className="grid gap-5">
        <ProofTimeline
          steps={proofSteps}
          disclaimer="Impact Certificate is not a certified carbon credit. RWA Fragment is not guaranteed yield. $CANOPY does not offset carbon tax."
        />
        <ChallengeSurface openChallengeCount={7} riskEventCount={3} />
      </div>
    </section>
  );
}
