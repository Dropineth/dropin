import {
  AllocationBreakdown,
  AppShell,
  ButtonLink,
  ClimateDrawPass,
  ImpactTickerStrip,
  ImpactMetricCard,
  MobileFrame,
  PrizePoolCard,
  ProofTimeline,
  SafetyNotice,
  StatusBadge,
} from "@dropin/ui";
import { seedRegions } from "@dropin/schemas";
import { CTAButton, HeroEarthOrb, MetricsCard } from "@/components/ui";

const activeRound = {
  id: "round_v1_ggw_demo",
  title: "Great Green Wall Climate Draw",
  region: "Great Green Wall / Sahel",
  poolSize: "1,000 testnet USDC",
  ticketPrice: "1 USDC",
  entries: "Open",
  participants: 128,
};

export default function Home() {
  const ggw = seedRegions.find((region) => region.id === "region_ggw_sahel") ?? seedRegions[0];

  return (
    <AppShell
      nav={
        <>
          <a href="/campaigns/campaign_v1_ggw_testnet">Campaign</a>
          <a href="/lottery/round_v1_ggw_demo">Active Draw</a>
          <a href="/certificates/cert_v1_ggw_demo">Impact Proof</a>
          <a href="/about">How It Works</a>
          <a href="/status">Status</a>
        </>
      }
    >
      <section className="grid min-h-[calc(100vh-88px)] gap-8 py-8 lg:grid-cols-[0.96fr_1.04fr] lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="testnet">Testnet only</StatusBadge>
            <StatusBadge status="ready">CanopyProof / 林证协议</StatusBadge>
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Join climate-impact prize pools. Track every tree through proof.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Dropin Earth turns each Tree Lotto round into a transparent climate-impact pool:
            70% Winner, 20% Verified Reforestation, and 10% Dropin Operations. No casino
            framing, no mainnet funds in testnet, and every proof object can be challenged.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CTAButton href="/lottery/round_v1_ggw_demo">Join Active Draw</CTAButton>
            <CTAButton href="/certificates/cert_v1_ggw_demo" variant="secondary">
              View Impact Proof
            </CTAButton>
            <ButtonLink href="/feedback" variant="ghost">
              Send Feedback
            </ButtonLink>
          </div>
          <div className="mt-6">
            <SafetyNotice>
            Public testnet limitation: no mainnet payment rail, no automatic $CANOPY distribution,
            Leaf Points are non-transferable testnet points, and Impact Certificates are not
            certified carbon credits.
            </SafetyNotice>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <MobileFrame>
            <HeroEarthOrb compact />
            <div className="mt-4 grid gap-3">
              <ClimateDrawPass
                participants={activeRound.participants}
                poolSize={activeRound.poolSize}
                proofStatus="open"
                region={activeRound.region}
                ticketPrice="1 TON / USDC Join Draw"
                title={activeRound.title}
              />
              <AllocationBreakdown compact title="Round economics" />
            </div>
          </MobileFrame>
        </div>
      </section>

      <section className="grid gap-4 pb-10 md:grid-cols-3">
        <MetricsCard
          caption="Count-up motion comes from the imported CanopyProof MetricsCard spec."
          title="Trees Planted"
          unit="+"
          value={ggw?.verifiedTrees ?? 0}
        />
        <MetricsCard
          caption="Estimated impact only; never displayed as verified carbon."
          title="CO2 Estimated"
          unit="t"
          value={420}
          verificationStatus="estimated"
        />
        <MetricsCard
          caption="Challengeable proof objects stay visible before trust is finalized."
          title="Proofs Issued"
          value={18}
        />
      </section>

      <section className="pb-10">
        <ImpactTickerStrip
          items={[
            { label: "Prize Pool", value: activeRound.poolSize, status: "open" },
            { label: "Trees funded", value: (ggw?.verifiedTrees ?? 0).toLocaleString(), status: "verified" },
            { label: "CO2 estimated", value: "Estimated only", status: "not credit" },
            { label: "Verified sites", value: "Great Green Wall", status: "proof" },
          ]}
        />
      </section>

      <section className="grid gap-6 pb-14 lg:grid-cols-[1fr_0.9fr]">
        <PrizePoolCard
          entries="Open to testers"
          poolSize={activeRound.poolSize}
          status="open"
          ticketPrice="1 USDC / TON testnet"
          title="Active Draw / Pre-draw"
        />
        <AllocationBreakdown title="Every public pool uses 70/20/10" />
      </section>

      <section className="grid gap-6 pb-14 lg:grid-cols-3">
        <ImpactMetricCard
          detail={ggw?.name ?? "Great Green Wall"}
          label="Region"
          value="Sahel Belt"
        />
        <ImpactMetricCard
          detail="Estimated tree-equivalent progress in the demo region"
          label="Trees Funded"
          value={(ggw?.verifiedTrees ?? 0).toLocaleString()}
        />
        <ImpactMetricCard
          detail="Estimated impact only; not a certified carbon credit"
          label="Impact Status"
          status="issued"
          value="Proof-first"
        />
      </section>

      <section className="grid gap-6 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">CanopyProof / 林证协议</p>
          <h2 className="mt-3 text-4xl font-semibold">Trust comes from proof, not promises.</h2>
          <p className="mt-5 leading-7 text-slate-300">
            CanopyProof is the private proof layer for verified climate action. It links
            deterministic draws, payment intents, Tree Fund allocations, evidence roots,
            Impact Certificates, challenge windows, and Solana anchors.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/red-team" variant="secondary">
              Red-Team Guide
            </ButtonLink>
            <ButtonLink href="/status" variant="ghost">
              Launch Status
            </ButtonLink>
          </div>
        </div>
        <ProofTimeline
          disclaimer="Impact Certificate is not a certified carbon credit."
          items={[
            { label: "Join prize pool", value: "Payment Intent confirms testnet participation.", status: "ready" },
            { label: "Freeze entries", value: "Entry root is generated before deterministic finalization.", status: "pending" },
            { label: "Fund project", value: "20% verified reforestation allocation links to project milestones.", status: "ready" },
            { label: "Anchor proof", value: "Roots can be anchored and challenged before trust is finalized.", status: "challengeable" },
          ]}
        />
      </section>
    </AppShell>
  );
}
