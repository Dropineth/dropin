import Link from "next/link";
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

export default async function MiniRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const [detail, results] = await Promise.all([
    getApi<RoundDetail>(`/lottery/rounds/${roundId}`),
    getApi<RoundResults>(`/lottery/rounds/${roundId}/results`),
  ]);
  const round = detail.round;

  return (
    <main className="mini-shell">
      <Link style={{ color: "#00E5FF", fontSize: 13, fontWeight: 800 }} href="/">
        Dropin Earth
      </Link>

      <section style={{ marginTop: 18 }}>
        <p className="mini-kicker">Tree Lotto / TON Entry</p>
        <h1 style={{ fontSize: 30, lineHeight: 1.08, margin: "8px 0" }}>{round.title}</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>
          Phase 9 uses Payment Intents with mock/manual/TON testnet placeholders. No live TON
          mainnet transfer is executed here.
        </p>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Metric label="Status" value={round.status} />
          <Metric label="Ticket" value={`${round.ticketPriceAmount} ${round.ticketPriceSymbol}`} />
          <Metric label="Entries" value={String(round.entryCount)} />
          <Metric label="Total" value={`${round.totalAmount} ${round.ticketPriceSymbol}`} />
        </div>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Funding Flow</h2>
        <Allocation label="Winner" value="70%" tone="#D4AF37" />
        <Allocation label="Verified Reforestation" value="20%" tone="#00C853" />
        <Allocation label="Dropin Operations" value="10%" tone="#00E5FF" />
        <p style={{ color: "#F2DCA0", lineHeight: 1.5, margin: 0 }}>
          Premium climate-impact draw. No casino spinner, no mainnet funds, no guaranteed yield.
        </p>
      </section>

      <MiniRoundEntry
        amount={round.ticketPriceAmount}
        currency={round.ticketPriceSymbol}
        regionId={round.regionId}
        roundId={round.id}
      />

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Proof Status</h2>
        <ProofRow label="Entry root" value={round.entryMerkleRoot ?? "Waiting for round close"} />
        <ProofRow label="Randomness certificate" value={results.proof.randomnessCertificateId ?? "Pending"} />
        <ProofRow label="Winner root" value={results.proof.winnerMerkleRoot ?? "Pending"} />
        <ProofRow label="Drop root" value={results.proof.dropMerkleRoot ?? "Pending"} />
      </section>

      <FeedbackCta page={`/round/${round.id}`} roundId={round.id} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mini-label">{label}</div>
      <div style={{ marginTop: 4, overflowWrap: "anywhere", fontSize: 17, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Allocation({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="mini-row">
      <span>{label}</span>
      <strong style={{ color: tone }}>{value}</strong>
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid rgb(255 255 255 / 10%)", padding: 10 }}>
      <div className="mini-label">{label}</div>
      <div style={{ marginTop: 5, overflowWrap: "anywhere", color: "#D8E8F2", fontSize: 12 }}>{value}</div>
    </div>
  );
}
