import { MiniCTAButton, MiniHeroEarthOrb, MiniImpactRegionCard, MiniMetricsCard, MiniRoundEconomicsCard } from "@/components/ui";
import { getApi } from "@/lib/api";

type Round = {
  id: string;
  title: string;
  status: string;
  ticketPriceAmount: string;
  ticketPriceSymbol: string;
  treeFundBps: number;
  canopyDropBps: number;
  rwaFragmentDropBps: number;
  entryCount: number;
};

type Region = {
  name: string;
  restorationPriority: "low" | "medium" | "high" | "critical";
  verifiedTrees: number;
  estimatedCo2eTonnes: number;
  survivalRateEstimate: number;
};

export default async function MiniHome() {
  const [rounds, region] = await Promise.all([
    getApi<Round[]>("/telegram/rounds"),
    getApi<Region>("/regions/region_ggw_sahel"),
  ]);
  const activeRound = rounds.find((round) => round.status === "open") ?? rounds[0];

  return (
    <main className="mini-shell">
      <MiniHeroEarthOrb
        ctaHref={activeRound ? `/round/${activeRound.id}` : "/campaign/campaign_v1_ggw_testnet"}
        ctaText="Plant & Enter"
        headline="Load one tree. Co-plant the planet."
        subline="Telegram entry for Tree Lotto: TON / USDC testnet Payment Intents, non-transferable Leaf Points, and traceable Proof-of-Planting."
      />

      <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>{activeRound?.title ?? "No active round"}</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <MiniMetricsCard label="Ticket" value={activeRound ? `${activeRound.ticketPriceAmount} ${activeRound.ticketPriceSymbol}` : "pending"} />
          <MiniMetricsCard label="Entries" value={String(activeRound?.entryCount ?? 0)} />
          <MiniMetricsCard label="Winner" value="70%" color="#D4AF37" />
          <MiniMetricsCard label="Verified trees" value="20%" />
        </div>
        <p style={{ color: "#F2DCA0", lineHeight: 1.5, margin: 0 }}>
          70% Winner / 20% Verified Reforestation / 10% Dropin Operations. Testnet only.
        </p>
        {activeRound ? (
          <MiniCTAButton href={`/round/${activeRound.id}`}>
            Plant & Enter
          </MiniCTAButton>
        ) : null}
      </section>

      <section style={{ marginTop: 14 }}>
        <MiniRoundEconomicsCard
          operations={10}
          reforestation={20}
          tokenPool={{ TON: activeRound?.ticketPriceSymbol === "TON" ? activeRound.ticketPriceAmount : 1, USDC: activeRound?.ticketPriceSymbol === "USDC" ? activeRound.ticketPriceAmount : 1000 }}
          winner={70}
        />
      </section>

      <MiniImpactRegionCard region={region} />

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Global Impact Pulse</h2>
        <MiniMetricsCard label="Verified trees" value={region.verifiedTrees.toLocaleString()} />
        <MiniMetricsCard label="Estimated impact" value={`${region.estimatedCo2eTonnes.toLocaleString()} tCO2e`} color="#D4AF37" />
        <MiniMetricsCard label="Survival estimate" value={`${Math.round(region.survivalRateEstimate * 100)}%`} color="#00E5FF" />
        <MiniCTAButton href="/me/forest" variant="secondary">
          My Forest
        </MiniCTAButton>
        <MiniCTAButton href="/campaign/campaign_v1_ggw_testnet" variant="secondary">
          Testnet Campaign
        </MiniCTAButton>
      </section>
    </main>
  );
}
