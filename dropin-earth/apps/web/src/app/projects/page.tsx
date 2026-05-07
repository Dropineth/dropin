import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type Project = {
  id: string;
  title: string;
  regionId: string;
  operator: string;
  targetTreeCount: number;
  targetSpecies: string[];
  budgetAmount: string;
  status: string;
};

export default async function ProjectsPage() {
  const projects = await getApi<Project[]>("/projects");

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <h1 className="mt-8 text-5xl font-semibold">Impact Projects</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">
          Projects connect Tree Lotto fund allocation to milestones, evidence, and Impact
          Certificates. Certificates here are impact proof, not certified carbon credits.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} tone="dark">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{project.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{project.operator}</p>
                </div>
                <span className="rounded border border-white/10 px-3 py-1 text-xs font-semibold">
                  {project.status}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Target</div>
                  <div className="mt-1 font-semibold">{project.targetTreeCount.toLocaleString()} trees</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Budget</div>
                  <div className="mt-1 font-semibold">${project.budgetAmount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Region</div>
                  <div className="mt-1 font-semibold">{project.regionId}</div>
                </div>
              </div>
              <Link
                className="mt-6 inline-flex rounded bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950"
                href={`/projects/${project.id}`}
              >
                Open project
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
