"use client";

import {
  canopyProofPublicExplorerErrorSchema,
  canopyProofPublicExplorerProjectResponseSchema,
  type CanopyProofPublicExplorerProjectResponse,
} from "@dropin/schemas/canopyproof-public-explorer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { CanopyProofLogo } from "./CanopyProofLogo";

const publicProjectIdPattern = /^cp_public_project_[a-f0-9]{24}$/;

type ExplorerErrorCode =
  | "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND"
  | "CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED"
  | "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID"
  | "CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED"
  | "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID";

type ExplorerViewState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly publicProjectId: string }
  | { readonly kind: "ready"; readonly response: CanopyProofPublicExplorerProjectResponse }
  | { readonly kind: "unavailable"; readonly code: ExplorerErrorCode };

export type PublicExplorerProps = {
  readonly initialPublicProjectId?: string;
};

export function PublicExplorer({ initialPublicProjectId }: PublicExplorerProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialPublicProjectId ?? "");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [view, setView] = useState<ExplorerViewState>(
    initialPublicProjectId ? { kind: "loading", publicProjectId: initialPublicProjectId } : { kind: "idle" },
  );

  useEffect(() => {
    if (!initialPublicProjectId) {
      setView({ kind: "idle" });
      return;
    }
    setQuery(initialPublicProjectId);
    if (!publicProjectIdPattern.test(initialPublicProjectId)) {
      setView({ kind: "unavailable", code: "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID" });
      return;
    }

    const controller = new AbortController();
    setView({ kind: "loading", publicProjectId: initialPublicProjectId });
    void loadPublicProject(initialPublicProjectId, controller.signal).then((nextView) => {
      if (!controller.signal.aborted) setView(nextView);
    });
    return () => controller.abort();
  }, [initialPublicProjectId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publicProjectId = query.trim();
    if (!publicProjectIdPattern.test(publicProjectId)) {
      setValidationMessage("Enter a public project ID in the published cp_public_project_... format.");
      return;
    }
    setValidationMessage(null);
    router.push(`/explorer/project/${encodeURIComponent(publicProjectId)}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link className="flex items-center gap-3" href="/" aria-label="CanopyProof home">
            <CanopyProofLogo loading="eager" size={38} />
            <span>
              <strong className="block text-sm font-semibold">CanopyProof</strong>
              <span className="block font-mono text-xs text-zinc-500">Public transparency authority</span>
            </span>
          </Link>
          <span className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-amber-200">
            Governance gated
          </span>
        </div>
      </header>

      <section className="border-b border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
          <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Canonical Explorer</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl">
            Inspect one governed public project publication.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            Results are re-derived from immutable publication, lifecycle, and challenge authorities. The public view
            excludes precise locations, identities, raw evidence, signatures, and internal review rationale.
          </p>

          <form className="mt-7 grid max-w-4xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="public-project-id">
                Public project ID
              </label>
              <input
                aria-describedby="public-project-id-help"
                aria-invalid={validationMessage !== null}
                autoComplete="off"
                className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 font-mono text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                id="public-project-id"
                name="publicProjectId"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="cp_public_project_000000000000000000000000"
                spellCheck={false}
                value={query}
              />
              <p className={validationMessage ? "mt-2 text-sm text-rose-300" : "mt-2 text-xs text-zinc-500"} id="public-project-id-help">
                {validationMessage ?? "Public IDs are issued only after a governed privacy review and publication decision."}
              </p>
            </div>
            <button
              className="h-11 self-start rounded bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-zinc-950 sm:mt-7"
              type="submit"
            >
              Inspect publication
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto min-h-[32rem] w-full max-w-7xl px-5 py-8 sm:px-8" aria-live="polite">
        {view.kind === "idle" ? <IdleState /> : null}
        {view.kind === "loading" ? <LoadingState publicProjectId={view.publicProjectId} /> : null}
        {view.kind === "unavailable" ? <UnavailableState code={view.code} /> : null}
        {view.kind === "ready" ? <ProjectPublication response={view.response} /> : null}
      </div>
    </main>
  );
}

async function loadPublicProject(publicProjectId: string, signal: AbortSignal): Promise<ExplorerViewState> {
  try {
    const response = await fetch(`/api/canopyproof/explorer/projects/${encodeURIComponent(publicProjectId)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      method: "GET",
      signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = canopyProofPublicExplorerErrorSchema.safeParse(payload);
      return {
        kind: "unavailable",
        code: error.success ? error.data.error : "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID",
      };
    }
    const parsed = canopyProofPublicExplorerProjectResponseSchema.safeParse(payload);
    return parsed.success
      ? { kind: "ready", response: parsed.data }
      : { kind: "unavailable", code: "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID" };
  } catch {
    return signal.aborted
      ? { kind: "loading", publicProjectId }
      : { kind: "unavailable", code: "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID" };
  }
}

function IdleState() {
  return (
    <section className="border-t border-zinc-800 pt-7">
      <p className="font-mono text-xs uppercase text-zinc-500">No publication selected</p>
      <h2 className="mt-3 text-xl font-semibold">Enter an approved public project ID to begin.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
        There is no browse-all endpoint. This prevents public identifiers from becoming a tenant-discovery surface.
      </p>
    </section>
  );
}

function LoadingState({ publicProjectId }: { readonly publicProjectId: string }) {
  return (
    <section aria-busy="true" className="border-t border-zinc-800 pt-7">
      <p className="font-mono text-xs text-zinc-500">Re-deriving {publicProjectId}</p>
      <div className="mt-6 grid animate-pulse gap-5 md:grid-cols-2">
        <div className="h-36 rounded bg-zinc-900" />
        <div className="h-36 rounded bg-zinc-900" />
        <div className="h-48 rounded bg-zinc-900 md:col-span-2" />
      </div>
    </section>
  );
}

function UnavailableState({ code }: { readonly code: ExplorerErrorCode }) {
  const copy = unavailableCopy[code];
  return (
    <section className="border-l-2 border-amber-300 bg-zinc-900/40 px-5 py-6" role="status">
      <p className="font-mono text-xs font-semibold uppercase text-amber-200">{copy.label}</p>
      <h2 className="mt-3 text-xl font-semibold">{copy.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{copy.detail}</p>
      <code className="mt-5 block break-all text-xs text-zinc-500">{code}</code>
    </section>
  );
}

const unavailableCopy: Record<ExplorerErrorCode, { readonly label: string; readonly title: string; readonly detail: string }> = {
  CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND: {
    label: "Publication unavailable",
    title: "No governed public publication is available for this identifier.",
    detail: "Absent, unpublished, and inaccessible records intentionally return the same public result.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED: {
    label: "Activation pending",
    title: "The canonical public query route is not active.",
    detail: "Activation requires independent privacy, safeguarding, legal, security, accessibility, and operations approval.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID: {
    label: "Authority unavailable",
    title: "A trustworthy public projection could not be derived.",
    detail: "CanopyProof fails closed when roots, source state, or response shape cannot be verified.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED: {
    label: "Request limited",
    title: "The public query rate has been exceeded.",
    detail: "Wait before retrying. Public reads are bounded to protect the authority service from enumeration and abuse.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID: {
    label: "Invalid identifier",
    title: "The public project ID is not valid.",
    detail: "Use the exact pseudonymous ID supplied with an approved publication.",
  },
};

function ProjectPublication({ response }: { readonly response: CanopyProofPublicExplorerProjectResponse }) {
  const { project, lineage } = response;
  return (
    <article>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StateBadge state={project.state} />
            <span className="font-mono text-xs text-zinc-500">Evaluated {response.evaluatedAt}</span>
          </div>
          <h2 className="mt-4 break-all font-mono text-xl font-semibold text-zinc-100">{project.publicProjectId}</h2>
          <p className="mt-2 font-mono text-xs text-zinc-500">Publication {project.publicationId}</p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          <p>Issued {project.recordIssuedOn}</p>
          <p className="mt-1">Confidence: {project.confidenceBand}</p>
        </div>
      </div>

      <section className="grid gap-8 border-b border-zinc-800 py-7 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">Public record</h3>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Fact label="Organization" value={project.publicOrganizationId} mono />
            <Fact label="Area disclosure" value={formatAreaBand(project.areaBand)} />
            <Fact label="Observation starts" value={project.observationPeriod.startsOn} />
            <Fact label="Observation ends" value={project.observationPeriod.endsOn} />
            <Fact label="Valid from" value={project.validity.validFrom} />
            <Fact label="Expires at" value={project.validity.expiresAt} />
            <Fact label="Location disclosure" value={project.location.disclosure} />
            <Fact label="Region" value={project.location.regionId ?? "Withheld"} />
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">Evidence and governance</h3>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
            <Count label="Evidence" value={project.evidence.count} />
            <Count label="Verification" value={project.verification.count} />
            <Count label="Monitoring" value={project.monitoring.count} />
            <Count label="Approvals" value={project.governance.approvalCount} />
          </dl>
          <div className="mt-5 border-l-2 border-zinc-700 pl-4">
            <p className="text-xs uppercase text-zinc-500">Methodology</p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-200">{project.methodology.id}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-zinc-800 py-7 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">Current challenge state</h3>
          <p className="mt-3 text-base font-medium text-zinc-100">{project.challenge.state ?? "No published challenge"}</p>
          {project.challenge.root ? <RootLine label="Challenge root" value={project.challenge.root} /> : null}
          {project.issueCodes.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Current issue codes">
              {project.issueCodes.map((code) => (
                <li className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-xs text-amber-100" key={code}>
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No current issue code is published.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">Public lineage</h3>
          <div className="mt-3 grid gap-3">
            <RootLine label="Projection root" value={lineage.projectionRoot} />
            <RootLine label="Publication root" value={lineage.publicationRoot} />
            <RootLine label="Record root" value={lineage.recordRoot} />
            <RootLine label="Lifecycle projection" value={lineage.currentLifecycleProjectionRoot} />
          </div>
        </div>
      </section>

      <section className="py-7">
        <h3 className="text-sm font-semibold uppercase text-zinc-300">Reliance boundaries</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">
          This is a canonical, durable transparency projection. It is not a certified carbon credit, carbon-tax
          offset, financial asset, ownership record, or guaranteed yield. It authorizes no mainnet funds, automatic
          CANOPY distribution, or anonymous mutation.
        </p>
      </section>
    </article>
  );
}

function StateBadge({ state }: { readonly state: CanopyProofPublicExplorerProjectResponse["project"]["state"] }) {
  const adverse = state !== "active";
  return (
    <span className={adverse
      ? "rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-amber-100"
      : "rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-emerald-200"}
    >
      {state}
    </span>
  );
}

function Fact({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div className="min-w-0 border-t border-zinc-800 pt-3">
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className={mono ? "mt-1 break-all font-mono text-sm text-zinc-200" : "mt-1 break-words text-sm text-zinc-200"}>{value}</dd>
    </div>
  );
}

function Count({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="bg-zinc-950 px-3 py-4">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</dd>
    </div>
  );
}

function RootLine({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="border-l border-zinc-700 pl-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <code className="mt-1 block break-all text-xs leading-5 text-zinc-300">{value}</code>
    </div>
  );
}

function formatAreaBand(value: CanopyProofPublicExplorerProjectResponse["project"]["areaBand"]): string {
  return value.replaceAll("_", " ");
}
