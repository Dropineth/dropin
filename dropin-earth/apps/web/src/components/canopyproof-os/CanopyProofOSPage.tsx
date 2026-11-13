import Link from "next/link";
import type { ReactNode } from "react";
import type { CanopyProofOSModule, OperationalTone } from "@/data/canopyproof-os";
import { canopyProofOsRoutes, evidenceSchemaFields } from "@/data/canopyproof-os";
import { CanopyProofLogo } from "@/components/canopyproof/CanopyProofLogo";
import { MobileEvidenceDraftQueue } from "@/components/canopyproof-os/MobileEvidenceDraftQueue";

const toneClass: Record<OperationalTone, string> = {
  ok: "border-emerald-400/30 bg-emerald-950/30 text-emerald-100",
  watch: "border-amber-300/30 bg-amber-950/30 text-amber-100",
  review: "border-cyan-300/30 bg-cyan-950/30 text-cyan-100",
  critical: "border-rose-300/30 bg-rose-950/30 text-rose-100",
};

export type CanopyProofOSPageProps = {
  readonly module: CanopyProofOSModule;
  readonly children?: ReactNode;
};

export function CanopyProofOSPage({ module, children }: CanopyProofOSPageProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <CanopyOSNav activeRoute={module.route} />
        <p className="rounded border border-amber-300/30 bg-amber-950/20 px-5 py-4 text-sm leading-6 text-amber-100">Workflow preview · Figures and process states below are illustrative. They do not confirm live projects, approvals, payments or partnerships.</p>
        <section className="grid gap-6 rounded border border-slate-800 bg-slate-900/50 p-5 shadow-2xl shadow-slate-950/50 lg:grid-cols-[1.08fr_0.92fr] lg:p-8">
          <div className="grid content-between gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">{module.eyebrow}</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">{module.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">{module.summary}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className={`rounded border px-4 py-3 text-sm font-semibold ${toneClass.review}`}>{module.primaryAction}</span>
              <span className="rounded border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200">
                {module.secondaryAction}
              </span>
              <span className={`rounded border px-4 py-3 text-sm font-semibold ${toneClass.ok}`}>{module.layer} Layer</span>
            </div>
          </div>
          <OperationalVisual module={module} />
        </section>

        <section aria-label={`${module.eyebrow} metrics`} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {module.metrics.map((metric) => (
            <article className={`rounded border p-5 ${toneClass[metric.tone]}`} key={metric.label}>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-75">{metric.label}</p>
              <strong className="mt-3 block text-3xl font-semibold text-white">{metric.value}</strong>
              <p className="mt-2 text-sm leading-6 text-slate-300">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {module.panels.map((panel) => (
            <article className="rounded border border-slate-800 bg-slate-900/70 p-5" key={panel.title}>
              <span className={`inline-flex rounded border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${toneClass[panel.tone]}`}>
                {panel.tone}
              </span>
              <h2 className="mt-4 text-2xl font-semibold">{panel.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{panel.body}</p>
              <ul className="mt-5 grid gap-2">
                {panel.items.map((item) => (
                  <li className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="grid gap-5 rounded border border-slate-800 bg-slate-900/60 p-5 lg:grid-cols-[0.92fr_1.08fr] lg:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">How the review would work</p>
            <h2 className="mt-3 text-3xl font-semibold">From an observation to a reviewed record.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              The steps below explain who checks the information and who makes a decision. AI can observe and recommend,
              but qualified human review is required before a real result can be approved.
            </p>
          </div>
          <ol className="grid gap-3">
            {module.workflow.map((step, index) => (
              <li className="grid gap-3 rounded border border-slate-800 bg-slate-950 p-4 sm:grid-cols-[auto_1fr_auto]" key={step.label}>
                <span className="grid h-9 w-9 place-items-center rounded bg-cyan-300 text-sm font-black text-slate-950">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-white">{step.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{step.owner}</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-100">{step.state}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {module.route === "/mobile/report" ? (
          <>
            <MobileEvidenceDraftQueue />
            <EvidenceSchemaPanel />
          </>
        ) : null}

        {children}

        <section className="rounded border border-slate-800 bg-slate-950 p-5 text-sm leading-6 text-slate-300 lg:p-6">
          <h2 className="text-xl font-semibold text-white">What these records mean</h2>
          <p className="mt-3">
            CanopyProof records are environmental accountability records. They are not certified carbon credits,
            financial assets, carbon-tax offsets, guaranteed yield instruments, or automatic CANOPY distribution
            claims. This public preview does not perform those actions.
          </p>
          <details className="mt-4"><summary className="cursor-pointer py-2 font-semibold">Access and audit requirements for project teams</summary><p className="mt-2">Public admin routes must remain blocked. Changes to a real record require authorized access and an audit history.</p></details>
        </section>
      </div>
    </main>
  );
}

function CanopyOSNav({ activeRoute }: { activeRoute: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <Link aria-label="CanopyProof home" className="flex items-center gap-3" href="/">
        <CanopyProofLogo loading="eager" size={42} />
        <span>
          <strong className="block text-lg">CanopyProof OS</strong>
          <small className="text-xs uppercase tracking-widest text-slate-500">Project tools and review guides</small>
        </span>
      </Link>
      <nav aria-label="CanopyProof OS modules" className="flex flex-wrap gap-2">
        {canopyProofOsRoutes.map((route) => (
          <Link
            className={
              route.href === activeRoute
                ? "rounded border border-cyan-300 bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950"
                : "rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-300 hover:text-white"
            }
            href={route.href}
            key={route.href}
          >
            {route.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function OperationalVisual({ module }: { module: CanopyProofOSModule }) {
  if (module.mapPoints) {
    return (
      <div className="relative min-h-[360px] overflow-hidden rounded border border-slate-800 bg-slate-950">
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:100%_20%,20%_100%]" />
        <div className="absolute inset-8 rounded-full border border-cyan-300/20 bg-cyan-950/20" />
        {module.mapPoints.map((point) => (
          <div
            className={`absolute z-10 rounded-full border-2 border-white p-2 shadow-xl ${point.tone === "critical" ? "bg-rose-400" : point.tone === "watch" ? "bg-amber-300" : point.tone === "review" ? "bg-cyan-300" : "bg-emerald-300"}`}
            key={point.label}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${point.label} - ${point.region}`}
          />
        ))}
        <div className="absolute bottom-4 left-4 right-4 rounded border border-slate-800 bg-slate-950/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Example project map</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">These map points illustrate a workflow. They are not a directory of active projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[360px] content-between rounded border border-slate-800 bg-slate-950 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">{module.layer} Workbench</p>
        <div className="mt-5 grid gap-3">
          {module.panels.map((panel) => (
            <div className={`rounded border px-4 py-3 ${toneClass[panel.tone]}`} key={panel.title}>
              <strong className="block text-sm text-white">{panel.title}</strong>
              <span className="mt-1 block text-xs leading-5 text-slate-300">{panel.items.join(" / ")}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 rounded border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Record history</p>
        <p className="mt-2 font-mono text-sm text-cyan-100">Observe · Explain · Assign · Complete · Question</p>
      </div>
    </div>
  );
}

function EvidenceSchemaPanel() {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/60 p-5 lg:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Record fields</p>
      <h2 className="mt-3 text-3xl font-semibold">What a field record needs to explain.</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {evidenceSchemaFields.map((field) => (
          <article className="rounded border border-slate-800 bg-slate-950 p-4" key={field.key}>
            <h3 className="font-mono text-sm font-semibold text-cyan-100">{field.key}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{field.purpose}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Verification</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{field.verification}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
