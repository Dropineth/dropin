import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type FundAllocation = {
  id: string;
  sourceType: string;
  sourceId: string;
  allocationType: string;
  projectId?: string;
  amount: string;
  currency: string;
  status: string;
  ledgerTransactionId?: string;
};

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
};

export default async function FundPage() {
  const [allocations, transactions] = await Promise.all([
    getApi<FundAllocation[]>("/fund/allocations"),
    getApi<TreasuryTransaction[]>("/treasury/transactions"),
  ]);
  const treeFundTransactions = transactions.filter((transaction) =>
    transaction.creditAccountId.includes("tree_planting_fund"),
  );

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Tree Planting Fund</p>
            <h1 className="mt-3 text-5xl font-semibold">Fund Ledger</h1>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">
              Internal allocations connect Tree Lotto rounds to project escrow placeholders,
              evidence requirements, and settlement certificates. No real payment rails execute in V1.
            </p>
          </div>
          <Card tone="dark">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Allocations" value={String(allocations.length)} />
              <Metric label="Tree fund tx" value={String(treeFundTransactions.length)} />
              <Metric label="Challenged" value={String(allocations.filter((item) => item.status === "challenged").length)} />
            </div>
          </Card>
        </section>

        <section className="mt-8 grid gap-4">
          {allocations.length === 0 ? (
            <Card tone="dark">
              <p className="text-slate-300">No fund allocations yet. Finalized Tree Lotto rounds will populate this ledger.</p>
            </Card>
          ) : (
            allocations.map((allocation) => (
              <Link
                className="block rounded border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-300/50"
                href={`/fund/allocations/${allocation.id}`}
                key={allocation.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{allocation.allocationType}</h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {allocation.sourceType} / {allocation.sourceId}
                    </p>
                  </div>
                  <span className="border border-emerald-200/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">
                    {allocation.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Amount" value={`${allocation.amount} ${allocation.currency}`} />
                  <Metric label="Project" value={allocation.projectId ?? "unassigned"} />
                  <Metric label="Ledger" value={allocation.ledgerTransactionId ?? "pending"} />
                </div>
              </Link>
            ))
          )}
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
