import Link from "next/link";
import { getApi } from "@/lib/api";
import { FeedbackCta } from "../../feedback-cta";

type CampaignDetail = {
  campaign: {
    id: string;
    title: string;
    status: string;
    fundingGoalAmount: string;
    fundingGoalCurrency: string;
    treeGoal: number;
    roundId?: string;
  };
  participantCount: number;
  leaderboard: Array<{ rank: number; userId: string; leafPoints: number }>;
};

type CampaignMe = {
  leafPointsAccount?: {
    balance: number;
  };
};

export default async function MiniCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const [detail, me] = await Promise.all([
    getApi<CampaignDetail>(`/campaigns/${campaignId}`),
    getApi<CampaignMe>(`/campaigns/${campaignId}/me?userId=demo-user`),
  ]);
  const { campaign } = detail;

  return (
    <main className="mini-shell">
      <Link style={{ color: "#00E5FF", fontSize: 13, fontWeight: 800 }} href="/">
        Dropin Earth
      </Link>
      <section className="seed-orb" style={{ marginTop: 16 }} aria-label="Earth Seed campaign hero" />
      <section style={{ marginTop: 18 }}>
        <div style={{ border: "1px solid rgb(0 200 83 / 40%)", color: "#8EF5B2", display: "inline-flex", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", padding: "5px 8px", textTransform: "uppercase" }}>
          Testnet only
        </div>
        <p className="mini-kicker" style={{ marginTop: 12 }}>Public Testnet Campaign</p>
        <h1 style={{ fontSize: 32, lineHeight: 1.05, margin: "8px 0" }}>{campaign.title}</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>
          Co-Plant into a testnet round, earn non-transferable Leaf Points, and follow the public impact report.
        </p>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Start in 3 Steps</h2>
        <div className="mini-row"><span>1. Join campaign</span><strong>testnet</strong></div>
        <div className="mini-row"><span>2. Plant & Enter</span><strong>Payment Intent</strong></div>
        <div className="mini-row"><span>3. Share Co-Plant</span><strong>Leaf Points</strong></div>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Metric label="Status" value={campaign.status} />
          <Metric label="Leaf Points" value={String(me.leafPointsAccount?.balance ?? 0)} />
          <Metric label="Participants" value={String(detail.participantCount)} />
          <Metric label="Tree goal" value={campaign.treeGoal.toLocaleString()} />
        </div>
        {campaign.roundId ? (
          <Link className="mini-button" href={`/round/${campaign.roundId}`}>
            Plant & Enter
          </Link>
        ) : null}
        <Link className="mini-button secondary" href={campaign.roundId ? `/share/ticket_v1_ggw_demo?roundId=${campaign.roundId}` : "/"}>
          Co-Plant Invite
        </Link>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Safety</h2>
        <p style={{ color: "#FFD166", lineHeight: 1.5, margin: 0 }}>
          Testnet only. No mainnet funds. Leaf Points are non-transferable testnet points. Impact Certificate is not a
          certified carbon credit. RWA Fragment is not guaranteed yield.
        </p>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Leaderboard</h2>
        {detail.leaderboard.slice(0, 8).map((entry) => (
          <div className="mini-row" key={`${entry.rank}:${entry.userId}`}>
            <span>#{entry.rank} {entry.userId}</span>
            <strong>{entry.leafPoints} LP</strong>
          </div>
        ))}
      </section>

      <FeedbackCta campaignId={campaign.id} page={`/campaign/${campaign.id}`} roundId={campaign.roundId} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mini-label">{label}</div>
      <div style={{ marginTop: 4, overflowWrap: "anywhere", fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}
