import Link from "next/link";
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
      <section className="seed-orb" aria-label="Earth Seed loading" />
      <p style={{ color: "#00E5FF", fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", marginTop: 18, textTransform: "uppercase" }}>
        Dropin Earth / TON Mini App
      </p>
      <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0" }}>Load one tree. Co-plant the planet.</h1>
      <p style={{ color: "#AFC2D1", lineHeight: 1.6 }}>
        Telegram growth entry for Tree Lotto. Payments use mock/manual/testnet Payment Intents only.
      </p>

      <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>{activeRound?.title ?? "No active round"}</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Metric label="Ticket" value={activeRound ? `${activeRound.ticketPriceAmount} ${activeRound.ticketPriceSymbol}` : "pending"} />
          <Metric label="Entries" value={String(activeRound?.entryCount ?? 0)} />
          <Metric label="Winner" value="70%" />
          <Metric label="Verified trees" value="20%" />
        </div>
        <p style={{ color: "#F2DCA0", lineHeight: 1.5, margin: 0 }}>
          70% Winner / 20% Verified Reforestation / 10% Dropin Operations. Testnet only.
        </p>
        {activeRound ? (
          <Link className="mini-button" href={`/round/${activeRound.id}`}>
            Plant & Enter
          </Link>
        ) : null}
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Global Impact Pulse</h2>
        <Metric label="Verified trees" value={region.verifiedTrees.toLocaleString()} />
        <Metric label="Estimated impact" value={`${region.estimatedCo2eTonnes.toLocaleString()} tCO2e`} />
        <Metric label="Survival estimate" value={`${Math.round(region.survivalRateEstimate * 100)}%`} />
        <Link className="mini-button secondary" href="/me/forest">
          My Forest
        </Link>
        <Link className="mini-button secondary" href="/campaign/campaign_v1_ggw_testnet">
          Testnet Campaign
        </Link>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4, overflowWrap: "anywhere", fontSize: 17, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
