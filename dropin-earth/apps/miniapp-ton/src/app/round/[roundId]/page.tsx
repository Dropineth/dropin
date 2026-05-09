import Link from "next/link";
import { MiniHeroEarthOrb, MiniMetricsCard, MiniProofTimeline, MiniRoundEconomicsCard, MiniStatusCard } from "@/components/ui";
import { getApi } from "@/lib/api";
import { MiniRoundEntry } from "./mini-round-entry";
import { FeedbackCta } from "../../feedback-cta";

type RoundDetail = {
  round: {
    id: string;
    title: string;
    regionId: string;
    status: string;
    ticketPriceAmount: string;
    ticketPriceSymbol: string;
    prizePoolBps: number;
    treeFundBps: number;
    canopyDropBps: number;
    rwaFragmentDropBps: number;
    challengePoolBps: number;
    closesAt: string;
    entryCount: number;
    totalAmount: string;
    entryMerkleRoot?: string;
  };
};

type RoundResults = {
  proof: {
    randomnessCertificateId?: string;
    winnerMerkleRoot?: string;
    dropMerkleRoot?: string;
  };
};

type CampaignMe = {
  leafPointsAccount?: {
    balance: number;
  };
};

export default async function MiniRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const campaignId = "campaign_v1_ggw_testnet";
  const [detail, results, campaignMe] = await Promise.all([
    getApi<RoundDetail>(`/lottery/rounds/${roundId}`),
    getApi<RoundResults>(`/lottery/rounds/${roundId}/results`),
    getApi<CampaignMe>(`/campaigns/${campaignId}/me?userId=demo-user`).catch((): CampaignMe => ({})),
  ]);
  const round = detail.round;
  const proofSteps = [
    { label: "Round status", completed: round.status !== "open", value: round.status },
    {
      label: "Entry root generated",
      completed: Boolean(round.entryMerkleRoot),
      value: round.entryMerkleRoot ?? "Waiting for round close",
    },
    {
      label: "Randomness certificate",
      completed: Boolean(results.proof.randomnessCertificateId),
      value: results.proof.randomnessCertificateId ?? "Pending",
    },
    {
      label: "Winner root",
      completed: Boolean(results.proof.winnerMerkleRoot),
      value: results.proof.winnerMerkleRoot ?? "Pending",
    },
    {
      label: "Drop root",
      completed: Boolean(results.proof.dropMerkleRoot),
      value: results.proof.dropMerkleRoot ?? "Pending",
    },
    {
      label: "Impact Certificate issued",
      completed: false,
      value: "Pending verified evidence acceptance",
    },
    {
      label: "Solana Anchor created",
      completed: false,
      value: "Pending Impact Certificate",
    },
  ];

  return (
    <main className="mini-shell">
      <Link style={{ color: "#00E5FF", fontSize: 13, fontWeight: 800 }} href="/">
        Dropin Earth
      </Link>

      <div style={{ marginTop: 16 }}>
        <MiniHeroEarthOrb
          ctaHref="#plant-and-enter"
          ctaText="Create Payment Intent"
          headline={round.title}
          subline="TON / USDC testnet draw. Plant & Enter through Payment Intent, then track deterministic roots and Proof-of-Planting status."
        />
      </div>

      <section style={{ marginTop: 18 }}>
        <p className="mini-kicker">Tree Lotto / TON Entry</p>
        <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>
          Phase 9 uses Payment Intents with mock/manual/TON testnet placeholders. No live TON
          mainnet transfer is executed here.
        </p>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <MiniMetricsCard label="Status" value={round.status} color="#00E5FF" />
          <MiniMetricsCard label="Ticket" value={`${round.ticketPriceAmount} ${round.ticketPriceSymbol}`} />
          <MiniMetricsCard label="Entries" value={String(round.entryCount)} />
          <MiniMetricsCard label="Total" value={`${round.totalAmount} ${round.ticketPriceSymbol}`} color="#D4AF37" />
          <MiniMetricsCard label="Leaf Points" value={String(campaignMe.leafPointsAccount?.balance ?? 0)} color="#D4AF37" />
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <MiniRoundEconomicsCard
          operations={10}
          reforestation={20}
          title="Funding Flow"
          tokenPool={{ TON: round.ticketPriceSymbol === "TON" ? round.totalAmount : 1, USDC: round.ticketPriceSymbol === "USDC" ? round.totalAmount : 1000 }}
          winner={70}
        />
      </section>
      <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <p style={{ color: "#F2DCA0", lineHeight: 1.5, margin: 0 }}>
          Premium climate-impact draw. No casino spinner, no mainnet funds, no guaranteed yield.
        </p>
      </section>

      <section style={{ marginTop: 14 }}>
        <MiniStatusCard
          badge="Campaign"
          detail="Round -> Campaign linkage stays explicit so every Ticket Seed can be traced back to the Great Green Wall testnet campaign."
          label="Campaign backlink"
          tone="green"
          value="Great Green Wall Testnet Campaign"
        >
          <Link className="mini-button secondary" href={`/campaign/${campaignId}`}>
            Back to Campaign
          </Link>
        </MiniStatusCard>
      </section>

      <div id="plant-and-enter">
        <MiniRoundEntry
          amount={round.ticketPriceAmount}
          currency={round.ticketPriceSymbol}
          regionId={round.regionId}
          roundId={round.id}
        />
      </div>

      <section style={{ marginTop: 14 }}>
        <MiniProofTimeline
          steps={proofSteps}
          subtitle="Proof Layer Online: round roots and randomness evidence are displayed only when returned by the Dropin API."
          title="Proof Layer / Anchor"
        />
      </section>

      <FeedbackCta page={`/round/${round.id}`} roundId={round.id} />
    </main>
  );
}
