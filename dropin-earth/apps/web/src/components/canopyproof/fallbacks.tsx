import type { ReactNode } from "react";

/**
 * Predefined, dependency-free static fallbacks for data-rich sections.
 *
 * These render fixed markup only — no data access, no client runtime — so they
 * are safe to show when a dynamic section throws. They preserve layout height
 * (no CLS on recovery) and stay honest: they say data is unavailable rather than
 * inventing numbers.
 */

function FallbackBanner({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-tight text-zinc-500">
      <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-zinc-600 align-middle" />
      {children}
    </p>
  );
}

export function MetricsStripFallback() {
  const cells = ["Trees restored", "CO₂e sequestered", "Projects verified"] as const;
  return (
    <section className="cp-section" aria-label="Network metrics (unavailable)">
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Network metrics</p>
          <FallbackBanner>data unavailable — showing static placeholder</FallbackBanner>
        </div>
        <dl className="grid divide-zinc-800/60 sm:grid-cols-3 sm:divide-x">
          {cells.map((label) => (
            <div className="px-6 py-8" key={label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</dt>
              <dd className="mt-3 text-4xl font-semibold tracking-tight text-zinc-700">—</dd>
              <p className="mt-2 text-[13px] text-zinc-600">currently unavailable</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function TelemetryFallback() {
  return (
    <section className="cp-section" aria-label="TerraProof telemetry (unavailable)">
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">terraproof.telemetry</p>
          <FallbackBanner>telemetry unavailable — showing static placeholder</FallbackBanner>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid h-56 place-items-center rounded-lg border border-zinc-800/60 bg-zinc-900/30">
            <p className="font-mono text-[12px] tracking-tight text-zinc-600">water restoration index · no data</p>
          </div>
          <div className="grid gap-4">
            <div className="h-24 rounded-lg border border-zinc-800/60 bg-zinc-900/30" />
            <div className="h-24 rounded-lg border border-zinc-800/60 bg-zinc-900/30" />
          </div>
        </div>
      </div>
    </section>
  );
}
