import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type Campaign = {
  id: string;
  title: string;
  regionId: string;
  status: string;
  fundingGoalAmount: string;
  fundingGoalCurrency: string;
  treeGoal: number;
  roundId?: string;
  projectId?: string;
};

export default async function AdminCampaignsPage() {
  const campaigns = await getApi<Campaign[]>("/campaigns");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Testnet Campaigns</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Create, schedule, start, end, finalize, and review public growth campaigns without mainnet funds or automatic $CANOPY distribution.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {campaigns.map((campaign) => (
            <Card key={campaign.id} tone="dark">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 24 }}>{campaign.title}</h2>
                  <p style={{ color: "#AFC2D1", overflowWrap: "anywhere" }}>{campaign.regionId}</p>
                </div>
                <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                  {campaign.status}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 18 }}>
                <Metric label="Funding goal" value={`${campaign.fundingGoalAmount} ${campaign.fundingGoalCurrency}`} />
                <Metric label="Tree goal" value={campaign.treeGoal.toLocaleString()} />
                <Metric label="Round" value={campaign.roundId ?? "pending"} />
                <Metric label="Project" value={campaign.projectId ?? "pending"} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                <Link href={`/campaigns/${campaign.id}`} style={buttonStyle}>Open</Link>
                <button style={buttonStyle} type="button">Schedule</button>
                <button style={buttonStyle} type="button">Start</button>
                <button style={buttonStyle} type="button">End</button>
                <button style={buttonStyle} type="button">Finalize</button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

const buttonStyle = {
  background: "#00C853",
  border: 0,
  color: "#05070A",
  fontWeight: 800,
  padding: "10px 14px",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
