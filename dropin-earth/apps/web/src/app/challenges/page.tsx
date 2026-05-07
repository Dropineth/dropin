import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

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

export default async function ChallengesPage() {
  const challenges = await getApi<Challenge[]>("/challenges");

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Red Team Layer</p>
            <h1 className="mt-3 text-5xl font-semibold">Challenge Board</h1>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">
              Every claim can be challenged before it becomes trusted infrastructure.
            </p>
          </div>
          <Card tone="dark">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Open cases" value={String(challenges.filter((item) => item.status !== "resolved").length)} />
              <Metric label="Accepted" value={String(challenges.filter((item) => item.result === "accepted").length)} />
              <Metric label="Targets" value={String(new Set(challenges.map((item) => item.targetType)).size)} />
            </div>
          </Card>
        </section>

        <section className="mt-8 grid gap-4">
          {challenges.length === 0 ? (
            <Card tone="dark">
              <p className="text-slate-300">No challenge cases submitted yet.</p>
            </Card>
          ) : (
            challenges.map((challenge) => (
              <Link
                className="block rounded border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-300/50"
                href={`/challenges/${challenge.id}`}
                key={challenge.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{challenge.title}</h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {challenge.targetType} / {challenge.targetId}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                    <span className="border border-amber-200/30 px-3 py-1 text-amber-200">{challenge.severity}</span>
                    <span className="border border-sky-200/30 px-3 py-1 text-sky-200">{challenge.status}</span>
                  </div>
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
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
