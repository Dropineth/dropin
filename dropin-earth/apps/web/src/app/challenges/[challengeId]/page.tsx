import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type ChallengeDetail = {
  challenge: {
    id: string;
    targetType: string;
    targetId: string;
    challenger: string;
    severity: string;
    title: string;
    attackScenario: string;
    evidenceHash: string;
    bondAmount: string;
    status: string;
    result: string;
    protocolFix?: string;
  };
  evidence: Array<{ id: string; uri: string; evidenceHash: string; submittedBy: string; createdAt: string }>;
  resolutions: Array<{ id: string; resolver: string; action: string; outcome: string; notes?: string; createdAt: string }>;
};

export default async function ChallengeDetailPage({ params }: { params: Promise<{ challengeId: string }> }) {
  const { challengeId } = await params;
  const detail = await getApi<ChallengeDetail>(`/challenges/${challengeId}`);
  const { challenge } = detail;

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/challenges">
            Challenges
          </Link>
          <span className="text-sm text-sky-200">{challenge.status}</span>
        </div>

        <section className="py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{challenge.severity} case</p>
          <h1 className="mt-3 text-5xl font-semibold">{challenge.title}</h1>
          <p className="mt-5 max-w-3xl leading-7 text-slate-300">{challenge.attackScenario}</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Target</h2>
            <div className="mt-5 grid gap-4">
              <Metric label="Type" value={challenge.targetType} />
              <Metric label="ID" value={challenge.targetId} />
              <Metric label="Challenger" value={challenge.challenger} />
              <Metric label="Bond" value={`${challenge.bondAmount} USDC`} />
              <Metric label="Result" value={challenge.result} />
            </div>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Submitted Evidence</h2>
            <div className="mt-5 grid gap-3">
              <div className="break-all rounded border border-white/10 bg-[#05070A] p-4 text-sm text-slate-300">
                Initial evidence hash: {challenge.evidenceHash}
              </div>
              {detail.evidence.map((item) => (
                <div className="rounded border border-white/10 bg-[#05070A] p-4" key={item.id}>
                  <div className="font-semibold">{item.submittedBy}</div>
                  <div className="mt-2 break-all text-xs text-slate-300">{item.evidenceHash}</div>
                  <div className="mt-2 break-all text-xs text-slate-400">{item.uri}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-5">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Resolution</h2>
            <div className="mt-5 grid gap-3">
              {detail.resolutions.length === 0 ? (
                <p className="text-slate-300">No resolution has been recorded.</p>
              ) : (
                detail.resolutions.map((item) => (
                  <div className="rounded border border-white/10 bg-[#05070A] p-4" key={item.id}>
                    <div className="font-semibold">
                      {item.action} / {item.outcome}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{item.notes ?? "No notes"}</div>
                  </div>
                ))
              )}
              {challenge.protocolFix ? <p className="text-emerald-200">Protocol fix: {challenge.protocolFix}</p> : null}
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
