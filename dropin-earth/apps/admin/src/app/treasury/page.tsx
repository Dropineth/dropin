import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type TreasuryTransaction = {
  id: string;
  type: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: string;
  currency: string;
  sourceType: string;
  sourceId: string;
  status: string;
  reversalOfId?: string;
};

export default async function AdminTreasuryPage() {
  const transactions = await getApi<TreasuryTransaction[]>("/treasury/transactions");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Treasury Ledger</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Internal posted entries are append-only. Reversals create new transactions and never mutate posted amounts.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {transactions.length === 0 ? (
            <Card tone="dark">
              <p style={{ color: "#AFC2D1" }}>No treasury transactions yet.</p>
            </Card>
          ) : (
            transactions.map((transaction) => (
              <Card key={transaction.id} tone="dark">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{transaction.type}</h2>
                    <p style={{ color: "#AFC2D1", overflowWrap: "anywhere" }}>{transaction.sourceType} / {transaction.sourceId}</p>
                  </div>
                  <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {transaction.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 18 }}>
                  <Metric label="Amount" value={`${transaction.amount} ${transaction.currency}`} />
                  <Metric label="Debit" value={transaction.debitAccountId} />
                  <Metric label="Credit" value={transaction.creditAccountId} />
                  <Metric label="Reversal of" value={transaction.reversalOfId ?? "none"} />
                </div>
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
