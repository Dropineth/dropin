import Link from "next/link";
import {
  MiniCTAButton,
  MiniHeroEarthOrb,
  MiniLeaderboardCard,
  MiniMetricsCard,
  MiniRoundEconomicsCard,
} from "@/components/ui";
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
      <div style={{ marginTop: 16 }}>
        <MiniHeroEarthOrb
          ctaHref={campaign.roundId ? `/round/${campaign.roundId}` : undefined}
          ctaText="Plant & Enter"
          headline={campaign.title}
          subline="Join testnet climate-impact pools. Track every tree through proof. 70% Winner, 20% Verified Reforestation, 10% Dropin Operations. TON / USDC testnet only."
        />
      </div>
      <section style={{ marginTop: 18 }}>
        <p className="mini-kicker" style={{ marginTop: 12 }}>Climate Impact Lottery</p>
        <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>
          Co-Plant into a testnet round, earn non-transferable Leaf Points, and follow Proof-of-Planting impact.
        </p>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Start in 3 Steps</h2>
        <div className="mini-row"><span>1. Join campaign</span><strong>testnet</strong></div>
        <div className="mini-row"><span>2. Plant & Enter</span><strong>1 TON / USDC</strong></div>
        <div className="mini-row"><span>3. Track proof</span><strong>Leaf Points</strong></div>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <MiniMetricsCard label="Status" value={campaign.status} color="#00E5FF" />
          <MiniMetricsCard label="Leaf Points" value={String(me.leafPointsAccount?.balance ?? 0)} color="#D4AF37" />
          <MiniMetricsCard label="Participants" value={String(detail.participantCount)} />
          <MiniMetricsCard label="Tree goal" value={campaign.treeGoal.toLocaleString()} />
        </div>
        {campaign.roundId ? (
          <MiniCTAButton href={`/round/${campaign.roundId}`}>
            Plant & Enter
          </MiniCTAButton>
        ) : null}
        <MiniCTAButton href={campaign.roundId ? `/share/ticket_v1_ggw_demo?roundId=${campaign.roundId}` : "/"} variant="secondary">
          Co-Plant Invite
        </MiniCTAButton>
      </section>

      <section style={{ marginTop: 14 }}>
        <MiniRoundEconomicsCard
          operations={10}
          reforestation={20}
          tokenPool={{ TON: 1, USDC: campaign.fundingGoalCurrency === "USDC" ? campaign.fundingGoalAmount : 1000 }}
          winner={70}
        />
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Safety</h2>
        <p style={{ color: "#FFD166", lineHeight: 1.5, margin: 0 }}>
          Testnet only. No mainnet funds. Leaf Points are non-transferable testnet points. Impact Certificate is not a
          certified carbon credit. RWA Fragment is not guaranteed yield.
        </p>
      </section>

      <section style={{ marginTop: 14 }}>
        <MiniLeaderboardCard entries={detail.leaderboard} />
      </section>

      <FeedbackCta campaignId={campaign.id} page={`/campaign/${campaign.id}`} roundId={campaign.roundId} />
    </main>
  );
}
