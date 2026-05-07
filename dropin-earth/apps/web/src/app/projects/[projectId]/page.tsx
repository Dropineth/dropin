import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type ProjectDetail = {
  project: {
    id: string;
    title: string;
    regionId: string;
    operator: string;
    targetTreeCount: number;
    targetSpecies: string[];
    budgetAmount: string;
    status: string;
  };
  milestones: Array<{ id: string; title: string; amount: string; status: string }>;
  evidence: Array<{ id: string; kind: string; uri: string; sha256Hash: string; status: string }>;
  certificates: Array<{ id: string; evidenceRoot: string; verifiedTreeCount: number; status: string }>;
};

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const detail = await getApi<ProjectDetail>(`/projects/${projectId}`);
  const { project } = detail;

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/projects">
            Projects
          </Link>
          <Link className="text-sm text-sky-200" href="/lottery/round_v1_ggw_demo">
            Active Tree Lotto round
          </Link>
        </div>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              Impact Project
            </p>
            <h1 className="mt-3 text-5xl font-semibold">{project.title}</h1>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">
              {project.operator} is responsible for milestone execution and evidence submission.
              Impact Certificates depend on accepted evidence and remain separate from carbon credits.
            </p>
          </div>
          <Card tone="dark">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Status</div>
                <div className="mt-1 text-2xl font-semibold">{project.status}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Target</div>
                <div className="mt-1 text-2xl font-semibold">{project.targetTreeCount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Budget</div>
                <div className="mt-1 text-2xl font-semibold">${project.budgetAmount}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Species</div>
                <div className="mt-1 text-sm font-semibold">{project.targetSpecies.join(", ")}</div>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Milestones</h2>
            <div className="mt-5 grid gap-3">
              {detail.milestones.map((milestone) => (
                <div className="rounded border border-white/10 bg-[#05070A] p-4" key={milestone.id}>
                  <div className="font-semibold">{milestone.title}</div>
                  <div className="mt-2 text-sm text-slate-300">${milestone.amount} / {milestone.status}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Evidence</h2>
            <div className="mt-5 grid gap-3">
              {detail.evidence.map((evidence) => (
                <div className="rounded border border-white/10 bg-[#05070A] p-4" key={evidence.id}>
                  <div className="font-semibold">{evidence.kind} / {evidence.status}</div>
                  <div className="mt-2 break-all text-xs text-slate-300">{evidence.sha256Hash}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Certificates</h2>
            <div className="mt-5 grid gap-3">
              {detail.certificates.map((certificate) => (
                <Link
                  className="rounded border border-white/10 bg-[#05070A] p-4 transition hover:border-emerald-300/50"
                  href={`/certificates/${certificate.id}`}
                  key={certificate.id}
                >
                  <div className="font-semibold">{certificate.id}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    {certificate.verifiedTreeCount} verified trees / {certificate.status}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
