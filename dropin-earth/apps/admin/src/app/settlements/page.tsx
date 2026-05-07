import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type SettlementCertificate = {
  id: string;
  projectId: string;
  milestoneId: string;
  releaseId: string;
  evidenceRoot: string;
  amount: string;
  currency: string;
  certificateId?: string;
  settlementHash: string;
  finalSettlement: boolean;
  status: string;
  claimBoundary: string;
};

export default async function AdminSettlementsPage() {
  const settlements = await getApi<SettlementCertificate[]>("/settlements");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Settlement Certificates</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Settlement certificates bind milestone release, accepted evidence, amount, and optional Impact Certificate state.
          They are internal settlement proofs, not carbon credits.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {settlements.length === 0 ? (
            <Card tone="dark">
              <p style={{ color: "#AFC2D1" }}>No settlement certificates yet.</p>
            </Card>
          ) : (
            settlements.map((settlement) => (
              <Card key={settlement.id} tone="dark">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, overflowWrap: "anywhere" }}>{settlement.id}</h2>
                    <p style={{ color: "#AFC2D1" }}>{settlement.projectId} / {settlement.milestoneId}</p>
                  </div>
                  <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {settlement.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 18 }}>
                  <Metric label="Amount" value={`${settlement.amount} ${settlement.currency}`} />
                  <Metric label="Final" value={settlement.finalSettlement ? "yes" : "no"} />
                  <Metric label="Certificate" value={settlement.certificateId ?? "not required"} />
                  <Metric label="Release" value={settlement.releaseId} />
                </div>
                <div style={{ marginTop: 16, overflowWrap: "anywhere", color: "#AFC2D1", fontSize: 13 }}>
                  Settlement hash: {settlement.settlementHash}
                </div>
                <p style={{ marginTop: 12, color: "#F2DCA0", fontSize: 13 }}>{settlement.claimBoundary}</p>
              </Card>
            ))
          )}
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
