import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type PaymentIntent = {
  id: string;
  userId: string;
  wallet: string;
  purpose: string;
  purposeId: string;
  chain: string;
  currency: string;
  amount: string;
  status: string;
  expectedMemo?: string;
  submittedTxHash?: string;
  confirmedTxHash?: string;
  verificationSource?: string;
  confirmedRawPayloadHash?: string;
  treasuryTransactionId?: string;
};

export default async function AdminPaymentsPage() {
  const intents = await getApi<PaymentIntent[]>("/payments/intents");
  const pending = intents.filter((intent) => ["awaiting_payment", "submitted", "confirming"].includes(intent.status));

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Payment Intents</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Confirm or fail mock/manual/devnet Payment Intents before lottery entries are issued.
          Phase 8 does not execute live mainnet transfers.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 24 }}>
          <Card tone="dark"><Metric label="Intents" value={String(intents.length)} /></Card>
          <Card tone="dark"><Metric label="Pending" value={String(pending.length)} /></Card>
          <Card tone="dark"><Metric label="Confirmed" value={String(intents.filter((intent) => intent.status === "confirmed").length)} /></Card>
        </div>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {intents.length === 0 ? (
            <Card tone="dark"><p style={{ color: "#AFC2D1" }}>No payment intents yet.</p></Card>
          ) : (
            intents.map((intent) => (
              <Card key={intent.id} tone="dark">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, overflowWrap: "anywhere" }}>{intent.id}</h2>
                    <p style={{ color: "#AFC2D1" }}>{intent.purpose} / {intent.purposeId}</p>
                  </div>
                  <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {intent.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginTop: 18 }}>
                  <Metric label="Amount" value={`${intent.amount} ${intent.currency}`} />
                  <Metric label="Chain" value={intent.chain} />
                  <Metric label="Wallet" value={intent.wallet} />
                  <Metric label="Expected memo" value={intent.expectedMemo ?? "not required"} />
                  <Metric label="Submitted tx" value={intent.submittedTxHash ?? "none"} />
                  <Metric label="Confirmed tx" value={intent.confirmedTxHash ?? "none"} />
                  <Metric label="Verification" value={intent.verificationSource ?? "pending"} />
                  <Metric label="Payload hash" value={intent.confirmedRawPayloadHash ?? "pending"} />
                  <Metric label="Treasury tx" value={intent.treasuryTransactionId ?? "pending"} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                  <button style={buttonStyle} type="button">Confirm</button>
                  <button style={buttonStyle} type="button">Fail</button>
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
