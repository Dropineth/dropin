"use client";

import type { CanopyProofGlobalCommandCenterRegion } from "@dropin/schemas/canopyproof-global-command-center";
import dynamic from "next/dynamic";

export type GlobalImpactEarthProps = {
  readonly regions: readonly CanopyProofGlobalCommandCenterRegion[];
  readonly dashboardRoot: string;
};

const GlobalImpactEarth = dynamic<GlobalImpactEarthProps>(
  () => import("./GlobalImpactEarth").then((module) => module.GlobalImpactEarth),
  {
    ssr: false,
    loading: () => (
      <section aria-busy="true" aria-label="Preparing public-safe Earth view" className="mt-10 border-y border-zinc-800 py-7">
        <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Public-safe Earth view</p>
        <div className="mt-5 flex h-80 w-full animate-pulse items-center justify-center bg-zinc-900 text-sm text-zinc-500 sm:h-auto sm:aspect-[16/7]">
          Preparing WebGL context
        </div>
      </section>
    ),
  },
);

export function GlobalImpactEarthLoader(props: GlobalImpactEarthProps) {
  return <GlobalImpactEarth {...props} />;
}
