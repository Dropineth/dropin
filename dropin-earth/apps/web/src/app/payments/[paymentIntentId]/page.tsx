import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type PaymentDetail = {
  intent: {
    id: string;
    userId: string;
    wallet: string;
    purpose: string;
    purposeId: string;
    chain: string;
    currency: string;
    amount: string;
    status: string;
    expectedRecipient: string;
    paymentNonce?: string;
    expectedMemo?: string;
    submittedTxHash?: string;
    confirmedTxHash?: string;
    confirmedBlockTime?: string;
    confirmedRawPayloadHash?: string;
    verificationSource?: string;
    reconciliationStatus?: string;
    treasuryTransactionId?: string;
    createdAt: string;
    updatedAt: string;
  };
  events: Array<{ id: string; type: string; txHash?: string; createdAt: string }>;
};

export default async function PaymentIntentPage({ params }: { params: Promise<{ paymentIntentId: string }> }) {
  const { paymentIntentId } = await params;
  const detail = await getApi<PaymentDetail>(`/payments/intents/${paymentIntentId}`);
  const intent = detail.intent;

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
            Dropin Earth
          </Link>
          <span className="text-sm text-sky-200">{intent.status}</span>
        </div>
        <section className="py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Payment Intent</p>
          <h1 className="mt-3 break-all text-5xl font-semibold">{intent.id}</h1>
          <p className="mt-5 max-w-3xl leading-7 text-slate-300">
            Payment Intents gate Tree Lotto entry before any Ticket Seed is issued. Phase 8 supports
            mock/manual/devnet adapters only; no live mainnet transfer execution happens here.
          </p>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Intent</h2>
            <div className="mt-5 grid gap-4">
              <Metric label="Amount" value={`${intent.amount} ${intent.currency}`} />
              <Metric label="Chain" value={intent.chain} />
              <Metric label="Purpose" value={`${intent.purpose} / ${intent.purposeId}`} />
              <Metric label="Wallet" value={intent.wallet} />
              <Metric label="Recipient" value={intent.expectedRecipient} />
              <Metric label="Expected memo" value={intent.expectedMemo ?? "not required"} />
              <Metric label="Payment nonce" value={intent.paymentNonce ?? "not set"} />
              <Metric label="Treasury tx" value={intent.treasuryTransactionId ?? "pending"} />
              <Metric label="Reconciliation" value={intent.reconciliationStatus ?? "pending"} />
            </div>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Transaction</h2>
            <div className="mt-5 grid gap-4">
              <Metric label="Submitted" value={intent.submittedTxHash ?? "not submitted"} />
              <Metric label="Confirmed" value={intent.confirmedTxHash ?? "not confirmed"} />
              <Metric label="Verification source" value={intent.verificationSource ?? "pending"} />
              <Metric label="Confirmed block time" value={intent.confirmedBlockTime ? new Date(intent.confirmedBlockTime).toLocaleString() : "pending"} />
              <Metric label="Raw payload hash" value={intent.confirmedRawPayloadHash ?? "pending"} />
              <Metric label="Created" value={new Date(intent.createdAt).toLocaleString()} />
              <Metric label="Updated" value={new Date(intent.updatedAt).toLocaleString()} />
            </div>
          </Card>
        </section>
        <section className="mt-5">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Events</h2>
            <div className="mt-5 grid gap-3">
              {detail.events.map((event) => (
                <div className="rounded border border-white/10 bg-[#05070A] p-4" key={event.id}>
                  <div className="font-semibold">{event.type}</div>
                  <div className="mt-2 break-all text-xs text-slate-300">{event.txHash ?? "no tx hash"}</div>
                  <div className="mt-2 text-xs text-slate-400">{new Date(event.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 break-all text-lg font-semibold">{value}</div>
    </div>
  );
}
