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
  createdAt: string;
  updatedAt: string;
};

export default async function AllocationPage({ params }: { params: Promise<{ allocationId: string }> }) {
  const { allocationId } = await params;
  const allocation = await getApi<FundAllocation>(`/fund/allocations/${allocationId}`);

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/fund">
            Fund
          </Link>
          <span className="text-sm text-sky-200">{allocation.status}</span>
        </div>

        <section className="py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Fund Allocation</p>
          <h1 className="mt-3 break-all text-5xl font-semibold">{allocation.id}</h1>
          <p className="mt-5 max-w-3xl leading-7 text-slate-300">
            This allocation is an internal ledger object. It can be approved, released,
            settled, challenged, or revoked before it becomes trusted operational history.
          </p>
        </section>

        <Card tone="dark">
          <div className="grid gap-5 sm:grid-cols-2">
            <Metric label="Allocation type" value={allocation.allocationType} />
            <Metric label="Amount" value={`${allocation.amount} ${allocation.currency}`} />
            <Metric label="Source" value={`${allocation.sourceType} / ${allocation.sourceId}`} />
            <Metric label="Project" value={allocation.projectId ?? "unassigned"} />
            <Metric label="Ledger transaction" value={allocation.ledgerTransactionId ?? "pending"} />
            <Metric label="Updated" value={new Date(allocation.updatedAt).toLocaleString()} />
          </div>
        </Card>
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
