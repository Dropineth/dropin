import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../../lib/api";

type ReconciliationReport = {
  id: string;
  status: string;
  checkedIntentCount: number;
  duplicateTxCount: number;
  amountMismatchCount: number;
  currencyMismatchCount: number;
  stalePendingCount: number;
  anomalies: Array<{ type?: string } & Record<string, unknown>>;
  createdAt: string;
};

export default async function AdminPaymentReconciliationPage() {
  const reports = await getApi<ReconciliationReport[]>("/payments/reconciliation");
  const latest = reports[0];

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Payment Reconciliation</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Reconciliation reports detect duplicate transaction hashes, amount mismatch, currency mismatch,
          and stale pending intents before funds enter trusted operating history.
        </p>
        {latest ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 24 }}>
            <Card tone="dark"><Metric label="Status" value={latest.status} /></Card>
            <Card tone="dark"><Metric label="Checked" value={String(latest.checkedIntentCount)} /></Card>
            <Card tone="dark"><Metric label="Duplicate tx" value={String(latest.duplicateTxCount)} /></Card>
            <Card tone="dark"><Metric label="Amount mismatch" value={String(latest.amountMismatchCount)} /></Card>
            <Card tone="dark"><Metric label="Currency mismatch" value={String(latest.currencyMismatchCount)} /></Card>
          <Card tone="dark"><Metric label="Stale pending" value={String(latest.stalePendingCount)} /></Card>
          <Card tone="dark"><Metric label="TON recipient" value={String(countAnomaly(latest, "wrong_recipient"))} /></Card>
          <Card tone="dark"><Metric label="Missing memo" value={String(countAnomaly(latest, "missing_memo"))} /></Card>
          <Card tone="dark"><Metric label="Wrong network" value={String(countAnomaly(latest, "wrong_network"))} /></Card>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {reports.length === 0 ? (
            <Card tone="dark"><p style={{ color: "#AFC2D1" }}>No reconciliation reports have been generated yet.</p></Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} tone="dark">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{report.id}</h2>
                    <p style={{ color: "#AFC2D1" }}>{new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {report.status}
                  </span>
                </div>
                <pre style={{ marginTop: 16, overflow: "auto", whiteSpace: "pre-wrap", color: "#F2DCA0", fontSize: 12 }}>
                  {JSON.stringify(report.anomalies, null, 2)}
                </pre>
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function countAnomaly(report: ReconciliationReport, type: string) {
  return report.anomalies.filter((anomaly) => anomaly.type === type).length;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
