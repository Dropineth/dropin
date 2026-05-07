import { Card } from "@dropin/ui";

const queues = [
  ["Lottery rounds", "Open, close, request randomness, finalize"],
  ["Projects", "Review proposals, approve milestones, monitor status"],
  ["Evidence", "Hash review, geofence, field attestation, challenge state"],
  ["Risk", "Sybil clusters, high-value drops, admin action anomalies"],
  ["Payments", "Payment intents, manual confirmation, reconciliation anomalies"],
  ["Campaigns", "Public testnet growth loop, Leaf Points, report review"],
  ["Challenges", "Challenge bond, evidence, arbitration, protocol fix"],
];

export default function AdminHome() {
  return (
    <main style={{ minHeight: "100vh", padding: "32px" }}>
      <section style={{ margin: "0 auto", maxWidth: "1120px" }}>
        <p style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Dropin Climate Operations Center
        </p>
        <h1 style={{ marginTop: 12, maxWidth: 780, fontSize: 52, lineHeight: 1.05 }}>
          Project, fund, evidence, risk, and red-team queues for V1.
        </h1>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginTop: 32 }}>
          {queues.map(([title, detail]) => (
            <Card key={title} tone="dark">
              <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
              <p style={{ color: "#AFC2D1", lineHeight: 1.6 }}>{detail}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
