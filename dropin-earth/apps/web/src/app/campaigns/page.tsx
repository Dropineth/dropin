import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type Campaign = {
  id: string;
  title: string;
  slug: string;
  regionId: string;
  status: string;
  fundingGoalAmount: string;
  fundingGoalCurrency: string;
  treeGoal: number;
  roundId?: string;
  projectId?: string;
};

export default async function CampaignsPage() {
  const campaigns = await getApi<Campaign[]>("/campaigns");

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Public Testnet</p>
            <h1 className="mt-3 text-5xl font-semibold">Campaigns</h1>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">
              Campaigns bind a region, Tree Lotto round, project, referral loop, Leaf Points, and a public impact report.
              Leaf Points are non-transferable growth points only.
            </p>
          </div>
          <Card tone="dark">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Campaigns" value={String(campaigns.length)} />
              <Metric label="Active" value={String(campaigns.filter((item) => item.status === "active").length)} />
              <Metric label="Tree goal" value={campaigns.reduce((sum, item) => sum + item.treeGoal, 0).toLocaleString()} />
            </div>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} tone="dark">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{campaign.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{campaign.regionId}</p>
                </div>
                <span className="border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                  {campaign.status}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="Funding goal" value={`${campaign.fundingGoalAmount} ${campaign.fundingGoalCurrency}`} />
                <Metric label="Tree goal" value={campaign.treeGoal.toLocaleString()} />
                <Metric label="Round" value={campaign.roundId ?? "pending"} />
              </div>
              <Link
                className="mt-6 inline-flex bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950"
                href={`/campaigns/${campaign.id}`}
              >
                Open campaign
              </Link>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-xl font-semibold">{value}</div>
    </div>
  );
}
