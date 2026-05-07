import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type RiskEvent = {
  id: string;
  subjectType: string;
  subjectId: string;
  riskLevel: string;
  score: number;
  recommendedAction: string;
  reasonCodes: string[];
  status: string;
  resolution?: string;
  createdAt: string;
};

export default async function AdminRiskPage() {
  const events = await getApi<RiskEvent[]>("/risk/events");
  const manualReviewCount = events.filter((event) => event.recommendedAction === "manual_review").length;

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Risk Events</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          High-value drops and fragments enter this queue when deterministic V1 risk gates return delay,
          manual review, or block.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 24 }}>
          <Card tone="dark">
            <Metric label="Open events" value={String(events.filter((event) => event.status === "open").length)} />
          </Card>
          <Card tone="dark">
            <Metric label="Manual review" value={String(manualReviewCount)} />
          </Card>
          <Card tone="dark">
            <Metric label="Blocked" value={String(events.filter((event) => event.recommendedAction === "block").length)} />
          </Card>
        </div>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {events.length === 0 ? (
            <Card tone="dark">
              <p style={{ color: "#AFC2D1" }}>No risk events yet. Claim gates will populate this queue.</p>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} tone="dark">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{event.subjectType}</h2>
                    <p style={{ color: "#AFC2D1", overflowWrap: "anywhere" }}>{event.subjectId}</p>
                  </div>
                  <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {event.riskLevel} / {event.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 18 }}>
                  <Metric label="Score" value={event.score.toFixed(4)} />
                  <Metric label="Action" value={event.recommendedAction} />
                  <Metric label="Reasons" value={event.reasonCodes.join(", ")} />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button style={buttonStyle} type="button">Resolve</button>
                  <button style={buttonStyle} type="button">Dismiss</button>
                </div>
              </Card>
            ))
          )}
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
