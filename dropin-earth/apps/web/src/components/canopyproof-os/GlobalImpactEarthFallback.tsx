"use client";

import { useMemo } from "react";
import {
  buildGlobalCommandCenterEarthMarkers,
  type GlobalCommandCenterEarthMarker,
} from "@/lib/canopyproof-global-command-center-earth";
import type {
  GlobalImpactWebglFailureCode,
  GlobalImpactWebglPhase,
} from "@/lib/canopyproof-global-impact-webgl";
import type { GlobalImpactEarthProps } from "./GlobalImpactEarthLoader";

type GlobalImpactEarthFallbackProps = GlobalImpactEarthProps & {
  readonly phase: Extract<
    GlobalImpactWebglPhase,
    "FALLBACK_STATIC" | "CONTEXT_LOST" | "TERMINAL_FALLBACK"
  >;
  readonly failureCode: GlobalImpactWebglFailureCode;
  readonly onRetry?: (() => void) | undefined;
};

export function GlobalImpactEarthFallback({
  regions,
  dashboardRoot,
  phase,
  failureCode,
  onRetry,
}: GlobalImpactEarthFallbackProps) {
  const markers = useMemo(
    () => buildGlobalCommandCenterEarthMarkers(regions),
    [regions],
  );
  const withheldCount = regions.length - markers.length;

  return (
    <section
      aria-labelledby="global-earth-fallback-title"
      className="mt-10 border-y border-zinc-800 py-7"
      data-testid="global-impact-earth-fallback"
      data-webgl-failure-code={failureCode}
      data-webgl-phase={phase}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-amber-200">
            Verified static Earth view
          </p>
          <h2
            className="mt-2 text-2xl font-semibold text-white"
            id="global-earth-fallback-title"
          >
            Generalized regional projection
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            The interactive renderer is unavailable. This deterministic view
            shows only independently reviewed one-degree regional cohorts; it
            is a static snapshot, not a live operational claim.
          </p>
        </div>
        {onRetry ? (
          <button
            className="w-fit border border-zinc-600 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
            onClick={onRetry}
            type="button"
          >
            Retry interactive view
          </button>
        ) : null}
      </div>

      <div
        aria-label={`${markers.length} approved generalized regions in the static projection; ${withheldCount} regions withheld`}
        className="relative mt-5 h-80 w-full overflow-hidden border border-zinc-800 bg-zinc-950 sm:h-auto sm:aspect-[16/7]"
        data-generalization="one-degree-reviewed-cohorts"
        role="img"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-6 inset-y-8 border border-zinc-700 bg-zinc-900"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-6 top-1/2 border-t border-zinc-700"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-8 left-1/2 border-l border-zinc-700"
        />
        {markers.map((marker) => (
          <StaticMarker key={marker.regionId} marker={marker} />
        ))}
        {markers.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-400">
            No independently reviewed public geometry is available.
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 border-t border-zinc-800 pt-4 md:grid-cols-2">
        <p className="text-sm leading-6 text-zinc-400">
          {markers.length} reviewed regional cohorts shown. {withheldCount}{" "}
          regional summaries remain withheld under the same privacy policy.
        </p>
        <p className="break-all font-mono text-xs leading-5 text-zinc-600">
          Snapshot root {dashboardRoot}
        </p>
      </div>
      <code className="mt-3 block text-xs text-zinc-600">{failureCode}</code>
    </section>
  );
}

function StaticMarker({
  marker,
}: {
  readonly marker: GlobalCommandCenterEarthMarker;
}) {
  const left = ((marker.longitudeDegrees + 180) / 360) * 100;
  const top = ((90 - marker.latitudeDegrees) / 180) * 100;
  return (
    <span
      aria-label={`${marker.regionId}: ${marker.state.replace("_", " ")}, ${marker.sourceProjectCount} projects in reviewed cohort`}
      className="absolute size-3 -translate-x-1/2 -translate-y-1/2 border border-zinc-950"
      data-marker-state={marker.state}
      role="img"
      style={{
        backgroundColor: marker.color,
        left: `${left}%`,
        top: `${top}%`,
      }}
    />
  );
}
