import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../../lib/api";

type CampaignDetail = {
  campaign: {
    id: string;
    title: string;
    status: string;
    regionId: string;
    roundId?: string;
    projectId?: string;
  };
  participantCount: number;
  leaderboard: Array<{ rank: number; userId: string; leafPoints: number }>;
};

type CampaignReport = {
  ticketCount: number;
  confirmedPaymentIntentCount: number;
  totalConfirmedPaymentAmount: string;
  evidenceCount: number;
  challengeCount: number;
  riskEventCount: number;
  impactCertificateStatuses: Record<string, number>;
};

export default async function AdminCampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const [detail, report] = await Promise.all([
    getApi<CampaignDetail>(`/campaigns/${campaignId}`),
    getApi<CampaignReport>(`/campaigns/${campaignId}/report`),
  ]);
  const { campaign } = detail;

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/campaigns" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Campaigns
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>{campaign.title}</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Admin campaign cockpit for growth status, report review, risk summary, and challenge summary.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 28 }}>
          <Card tone="dark"><Metric label="Status" value={campaign.status} /></Card>
          <Card tone="dark"><Metric label="Participants" value={String(detail.participantCount)} /></Card>
          <Card tone="dark"><Metric label="Tickets" value={String(report.ticketCount)} /></Card>
          <Card tone="dark"><Metric label="Confirmed intents" value={String(report.confirmedPaymentIntentCount)} /></Card>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginTop: 22 }}>
          <Card tone="dark">
            <h2 style={{ margin: 0, fontSize: 24 }}>Report</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <Metric label="Payment amount" value={report.totalConfirmedPaymentAmount} />
              <Metric label="Evidence" value={String(report.evidenceCount)} />
              <Metric label="Certificate states" value={JSON.stringify(report.impactCertificateStatuses)} />
            </div>
          </Card>
          <Card tone="dark">
            <h2 style={{ margin: 0, fontSize: 24 }}>Risk / Challenge</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <Metric label="Challenges" value={String(report.challengeCount)} />
              <Metric label="Risk events" value={String(report.riskEventCount)} />
              <Metric label="Region" value={campaign.regionId} />
            </div>
          </Card>
          <Card tone="dark">
            <h2 style={{ margin: 0, fontSize: 24 }}>Leaderboard</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              {detail.leaderboard.slice(0, 8).map((entry) => (
                <div key={`${entry.rank}:${entry.userId}`} style={{ display: "flex", justifyContent: "space-between", border: "1px solid rgb(255 255 255 / 12%)", padding: 10 }}>
                  <span>#{entry.rank} {entry.userId}</span>
                  <strong>{entry.leafPoints} LP</strong>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
