import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type Challenge = {
  id: string;
  targetType: string;
  targetId: string;
  challenger: string;
  severity: string;
  title: string;
  status: string;
  result: string;
  createdAt: string;
};

export default async function AdminChallengesPage() {
  const challenges = await getApi<Challenge[]>("/challenges");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Red Team Challenges</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Review target challenges, accept valid attacks, reject weak claims, and resolve systemic protocol fixes.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {challenges.length === 0 ? (
            <Card tone="dark">
              <p style={{ color: "#AFC2D1" }}>No challenge cases submitted yet.</p>
            </Card>
          ) : (
            challenges.map((challenge) => (
              <Card key={challenge.id} tone="dark">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24 }}>{challenge.title}</h2>
                    <p style={{ color: "#AFC2D1", overflowWrap: "anywhere" }}>
                      {challenge.targetType} / {challenge.targetId}
                    </p>
                  </div>
                  <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {challenge.severity} / {challenge.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 18 }}>
                  <Metric label="Challenger" value={challenge.challenger} />
                  <Metric label="Result" value={challenge.result} />
                  <Metric label="Created" value={new Date(challenge.createdAt).toLocaleString()} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                  <button style={buttonStyle} type="button">Accept</button>
                  <button style={buttonStyle} type="button">Reject</button>
                  <button style={buttonStyle} type="button">Resolve</button>
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
