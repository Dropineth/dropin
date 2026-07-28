"use client";

import dynamic from "next/dynamic";

const NasaGibsEarthObservation = dynamic(
  () => import("./NasaGibsEarthObservation").then((module) => module.NasaGibsEarthObservation),
  {
    ssr: false,
    loading: () => (
      <section
        aria-busy="true"
        aria-label="Loading NASA GIBS Earth observation workbench"
        className="grid min-h-[720px] animate-pulse gap-5 border border-slate-800 bg-slate-950 p-5 lg:grid-cols-[20rem_1fr] lg:p-6"
      >
        <div className="h-full min-h-64 bg-slate-900" />
        <div className="aspect-video min-h-96 bg-slate-900" />
      </section>
    ),
  },
);

export function NasaGibsViewerLoader() {
  return <NasaGibsEarthObservation />;
}
