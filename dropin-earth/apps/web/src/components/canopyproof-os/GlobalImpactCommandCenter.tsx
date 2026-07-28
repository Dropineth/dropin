"use client";

import {
  type CanopyProofGlobalCommandCenterActivity,
  type CanopyProofGlobalCommandCenterRegion,
  type CanopyProofGlobalCommandCenterResponse,
} from "@dropin/schemas/canopyproof-global-command-center";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CanopyProofLogo } from "@/components/canopyproof/CanopyProofLogo";
import { GlobalImpactEarthLoader } from "@/components/canopyproof-os/GlobalImpactEarthLoader";
import {
  classifyGlobalCommandCenterResponse,
  type CommandCenterState,
  type CommandCenterUnavailableCode,
} from "@/lib/canopyproof-global-command-center";

const apiBase = process.env.NEXT_PUBLIC_DROPIN_API_URL?.replace(/\/$/, "") ?? "/api";
const commandCenterPath = "/canopyproof/dashboard/global";
const commandCenterRoutes = [
  { href: "/dashboard/global", label: "Global" },
  { href: "/mobile/report", label: "Evidence" },
  { href: "/terra", label: "TerraProof" },
  { href: "/reports/esg", label: "ESG" },
  { href: "/governance", label: "Governance" },
  { href: "/partners", label: "Partners" },
  { href: "/funding", label: "Funding" },
  { href: "/risk", label: "Risk" },
] as const;

export function GlobalImpactCommandCenter() {
  const [state, setState] = useState<CommandCenterState>({ kind: "loading" });

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`${apiBase}${commandCenterPath}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        method: "GET",
        ...(signal ? { signal } : {}),
      });
      const payload: unknown = await response.json().catch(() => null);
      setState(classifyGlobalCommandCenterResponse(response.ok, payload));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({ kind: "unavailable", code: "CANOPYPROOF_GLOBAL_COMMAND_CENTER_RESPONSE_INVALID" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <CommandCenterNavigation />
      <header className="border-b border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Global Impact Command Center</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Governed restoration operations and environmental risk.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              Read-only operational projection derived from append-only records. Source authorities retain control of
              proof, review, governance, risk, and funding facts.
            </p>
          </div>
          <AuthorityStatus state={state} />
        </div>
      </header>

      <div className="mx-auto min-h-[40rem] w-full max-w-7xl px-5 py-8 sm:px-8" aria-live="polite">
        {state.kind === "loading" ? <CommandCenterSkeleton /> : null}
        {state.kind === "unavailable" ? <UnavailableState code={state.code} retry={() => void load()} /> : null}
        {state.kind === "empty" ? <EmptyState response={state.response} /> : null}
        {state.kind === "ready" ? <CommandCenterProjection response={state.response} /> : null}
      </div>
    </main>
  );
}

function CommandCenterNavigation() {
  return (
    <div className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <Link aria-label="CanopyProof home" className="flex items-center gap-3" href="/">
          <CanopyProofLogo loading="eager" size={40} />
          <span>
            <strong className="block text-sm font-semibold text-zinc-100">CanopyProof OS</strong>
            <span className="block font-mono text-xs text-zinc-500">Institutional operations</span>
          </span>
        </Link>
        <nav aria-label="CanopyProof OS modules" className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {commandCenterRoutes.map((route) => (
            <Link
              aria-current={route.href === "/dashboard/global" ? "page" : undefined}
              className={route.href === "/dashboard/global"
                ? "shrink-0 rounded border border-emerald-300 bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950"
                : "shrink-0 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"}
              href={route.href}
              key={route.href}
            >
              {route.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function AuthorityStatus({ state }: { readonly state: CommandCenterState }) {
  const ready = state.kind === "ready" || state.kind === "empty";
  return (
    <div className={ready
      ? "border-l-2 border-emerald-300 pl-4"
      : state.kind === "loading"
        ? "border-l-2 border-zinc-600 pl-4"
        : "border-l-2 border-amber-300 pl-4"}
    >
      <p className="font-mono text-xs uppercase text-zinc-500">Projection authority</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">
        {ready ? "PostgreSQL append-only snapshot" : state.kind === "loading" ? "Verifying source" : "Unavailable"}
      </p>
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading command center projection">
      <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div className="h-28 rounded bg-zinc-900" key={index} />)}
      </div>
      <div className="mt-10 grid animate-pulse gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-80 rounded bg-zinc-900" />
        <div className="h-80 rounded bg-zinc-900" />
      </div>
    </section>
  );
}

function UnavailableState({
  code,
  retry,
}: {
  readonly code: CommandCenterUnavailableCode;
  readonly retry: () => void;
}) {
  const copy = unavailableCopy[code];
  return (
    <section className="border-l-2 border-amber-300 bg-zinc-900/50 px-5 py-6" role="status">
      <p className="font-mono text-xs font-semibold uppercase text-amber-200">{copy.label}</p>
      <h2 className="mt-3 text-xl font-semibold text-white">{copy.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{copy.detail}</p>
      <code className="mt-5 block break-all text-xs text-zinc-500">{code}</code>
      <button
        className="mt-6 rounded border border-zinc-600 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
        onClick={retry}
        type="button"
      >
        Retry
      </button>
    </section>
  );
}

const unavailableCopy: Record<CommandCenterUnavailableCode, {
  readonly label: string;
  readonly title: string;
  readonly detail: string;
}> = {
  CANOPYPROOF_AUTH_REQUIRED: {
    label: "Authentication required",
    title: "A verified institutional identity is required.",
    detail: "The command center does not expose cross-organization operations through an anonymous session.",
  },
  CANOPYPROOF_RBAC_DENIED: {
    label: "Access denied",
    title: "This identity is not authorized for the operational projection.",
    detail: "Access is evaluated against current durable membership and role authority.",
  },
  CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE: {
    label: "Projection unavailable",
    title: "No governed durable snapshot is available.",
    detail: "CanopyProof does not substitute process-local or sample values when the append-only projection is absent.",
  },
  CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: {
    label: "Integrity check failed",
    title: "The current snapshot could not be verified.",
    detail: "Schema, ordering, safety, and root checks must all pass before any operational value is displayed.",
  },
  CANOPYPROOF_RATE_LIMITED: {
    label: "Request limited",
    title: "The operational read limit has been reached.",
    detail: "Wait before retrying so the authority service remains available to institutional operators.",
  },
  CANOPYPROOF_GLOBAL_COMMAND_CENTER_DURABLE_SOURCE_REQUIRED: {
    label: "Durable source required",
    title: "Compatibility data was rejected.",
    detail: "The production command center renders only an append-only PostgreSQL snapshot.",
  },
  CANOPYPROOF_GLOBAL_COMMAND_CENTER_RESPONSE_INVALID: {
    label: "Authority unavailable",
    title: "A trustworthy projection could not be loaded.",
    detail: "CanopyProof fails closed when the API response is missing, malformed, or unreachable.",
  },
};

function EmptyState({ response }: { readonly response: CanopyProofGlobalCommandCenterResponse }) {
  return (
    <section className="border-t border-zinc-800 pt-7">
      <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Verified empty projection</p>
      <h2 className="mt-3 text-xl font-semibold text-white">No governed projects are present in this snapshot.</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
        The durable source is valid; zero is reported as an explicit state rather than replaced with sample activity.
      </p>
      <ProjectionStamp response={response} />
      <SafetyBoundary disclosure={response.data.safety.disclosure} />
    </section>
  );
}

function CommandCenterProjection({ response }: { readonly response: CanopyProofGlobalCommandCenterResponse }) {
  const { data } = response;
  const metrics = [
    ["Registered projects", formatCount(data.metrics.projectCount), `${formatCount(data.metrics.activeProjectCount)} active`],
    ["Monitored projects", formatCount(data.metrics.monitoredProjectCount), `${formatCount(data.metrics.challengedProjectCount)} challenged`],
    ["Target trees", formatCount(data.metrics.targetTreeCount), `${formatDecimal(data.metrics.areaHectares)} hectares`],
    ["Evidence records", formatCount(data.metrics.evidenceCount), `${formatCount(data.metrics.acceptedEvidenceCount)} accepted`],
    ["Proof records", formatCount(data.metrics.proofRecordCount), `${formatCount(data.metrics.issuedProofRecordCount)} issued`],
    ["Active risk alerts", formatCount(data.metrics.activeRiskAlertCount), `${formatCount(data.metrics.criticalRiskAlertCount)} critical`],
    ["Terra scenes", formatCount(data.metrics.terraSceneCount), `${formatCount(data.metrics.acceptedTerraRunCount)} accepted runs`],
    ["Funding allocated", formatUsd(data.metrics.fundingAllocatedUsd), `${formatUsd(data.metrics.fundingSettledUsd)} reconciled`],
  ] as const;

  return (
    <>
      <ProjectionStamp response={response} />
      <GlobalImpactEarthLoader
        dashboardRoot={data.lineage.dashboardRoot}
        regions={data.regions}
      />
      <section aria-label="Global impact metrics" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, detail]) => (
          <article className="min-h-28 rounded border border-zinc-800 bg-zinc-900/60 p-4" key={label}>
            <p className="font-mono text-xs uppercase text-zinc-500">{label}</p>
            <strong className="mt-3 block text-2xl font-semibold text-white">{value}</strong>
            <p className="mt-2 text-sm text-zinc-400">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 border-t border-zinc-800 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Regional operations</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Current governed regional summaries</h2>
          </div>
          <span className="font-mono text-xs text-zinc-500">{data.regions.length} regions</span>
        </div>
        <RegionTable regions={data.regions} />
      </section>

      <section className="mt-10 grid gap-8 border-t border-zinc-800 pt-7 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Observed indicators</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Biodiversity, water, and climate risk</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <IndicatorList title="Biodiversity" items={data.impactIndicators.biodiversity} />
            <IndicatorList title="Water" items={data.impactIndicators.water} />
            <IndicatorList title="Climate risk" items={data.impactIndicators.climateRisk} />
          </div>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Recent authority activity</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Bounded operational timeline</h2>
          <ActivityList activities={data.recentActivity} />
        </div>
      </section>

      <section className="mt-10 grid gap-8 border-t border-zinc-800 pt-7 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Lineage</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Deterministic projection roots</h2>
          <RootLine label="Dashboard root" value={data.lineage.dashboardRoot} />
          <RootLine label="Region root" value={data.lineage.regionRoot} />
          <RootLine label="Evidence root" value={data.lineage.evidenceRoot} />
          <RootLine label="Proof record root" value={data.lineage.proofRecordRoot} />
        </div>
        <SafetyBoundary disclosure={data.safety.disclosure} />
      </section>
    </>
  );
}

function ProjectionStamp({ response }: { readonly response: CanopyProofGlobalCommandCenterResponse }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
      <span className="rounded border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-emerald-200">
        Durable snapshot verified
      </span>
      <span className="font-mono text-xs text-zinc-500">Generated {formatTimestamp(response.data.generatedAt)}</span>
    </div>
  );
}

function RegionTable({ regions }: { readonly regions: readonly CanopyProofGlobalCommandCenterRegion[] }) {
  return (
    <div className="mt-5 overflow-x-auto border border-zinc-800">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Region</th>
            <th className="px-4 py-3 font-medium">Projects</th>
            <th className="px-4 py-3 font-medium">Evidence</th>
            <th className="px-4 py-3 font-medium">Monitoring</th>
            <th className="px-4 py-3 font-medium">Risk alerts</th>
            <th className="px-4 py-3 font-medium">Allocated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {regions.map((region) => (
            <tr className="bg-zinc-950 text-zinc-300" key={region.regionId}>
              <td className="px-4 py-3 font-mono text-xs text-zinc-100">{region.regionId}</td>
              <td className="px-4 py-3">{formatCount(region.projectCount)}</td>
              <td className="px-4 py-3">{formatCount(region.evidenceCount)}</td>
              <td className="px-4 py-3">{formatCount(region.acceptedMonitoringEventCount)}</td>
              <td className="px-4 py-3">{formatCount(region.activeRiskAlertCount)}</td>
              <td className="px-4 py-3">{formatUsd(region.fundingAllocatedUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndicatorList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: CanopyProofGlobalCommandCenterResponse["data"]["impactIndicators"]["biodiversity"];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {items.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No reviewed indicator.</p> : (
        <ul className="mt-3 divide-y divide-zinc-800 border-y border-zinc-800">
          {items.map((item) => (
            <li className="py-3" key={item.key}>
              <p className="text-sm text-zinc-200">{item.key}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500">{formatCount(item.totalCount)} linked records</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityList({ activities }: { readonly activities: readonly CanopyProofGlobalCommandCenterActivity[] }) {
  if (activities.length === 0) return <p className="mt-5 text-sm text-zinc-500">No activity in this snapshot.</p>;
  return (
    <ol className="mt-5 divide-y divide-zinc-800 border-y border-zinc-800">
      {activities.map((activity) => (
        <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]" key={`${activity.kind}:${activity.id}`}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-200">{activity.summary}</p>
            <p className="mt-1 font-mono text-xs text-zinc-500">{activity.kind} / {activity.state}</p>
          </div>
          <time className="font-mono text-xs text-zinc-500" dateTime={activity.happenedAt}>
            {formatTimestamp(activity.happenedAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function RootLine({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="mt-4 border-l border-zinc-700 pl-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <code className="mt-1 block break-all text-xs leading-5 text-zinc-300">{value}</code>
    </div>
  );
}

function SafetyBoundary({ disclosure }: { readonly disclosure: string }) {
  return (
    <aside className="border-l-2 border-amber-300 bg-zinc-900/50 px-5 py-5">
      <p className="font-mono text-xs font-semibold uppercase text-amber-200">Institutional reliance boundary</p>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{disclosure}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">
        Final environmental proof remains subject to accredited human review, governance approval, and current source
        authority.
      </p>
    </aside>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatUsd(value: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
