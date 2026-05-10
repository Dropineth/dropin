import type { Region } from "@dropin/schemas";

type RegionImpactMapProps = {
  regions: Region[];
  selectedRegionId?: string | undefined;
};

export function RegionImpactMap({ regions, selectedRegionId }: RegionImpactMapProps) {
  const selected = regions.find((region) => region.id === selectedRegionId) ?? regions[0];

  return (
    <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] p-5 text-white shadow-[0_18px_70px_rgb(0_0_0/0.24)] backdrop-blur">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div
          aria-label="Interactive 3D Earth orb region selector"
          className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-full border border-cyan-200/20 bg-[#061421] shadow-[0_0_90px_rgb(30_136_229/0.36)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgb(245_247_250/0.68),transparent_0_7%,transparent_12%),radial-gradient(circle_at_44%_44%,rgb(0_200_83/0.84),transparent_0_14%,transparent_26%),radial-gradient(circle_at_68%_62%,rgb(0_200_83/0.58),transparent_0_16%,transparent_30%),radial-gradient(circle_at_50%_50%,#1E88E5,#0A3552_62%,#04111B_74%)]" />
          <div className="absolute inset-6 rounded-full border border-white/10" />
          <div className="absolute left-[38%] top-[44%] h-4 w-4 rounded-full border-2 border-[#05070A] bg-emerald-300 shadow-[0_0_28px_rgb(0_200_83/0.95)]" />
          <div className="absolute left-[58%] top-[58%] h-3 w-3 rounded-full border-2 border-[#05070A] bg-amber-200 shadow-[0_0_22px_rgb(212_175_55/0.8)]" />
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Global Map / Area Selection</p>
          <h2 className="mt-3 text-3xl font-semibold">Select a planting region</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Region cards are API-backed and challenge-aware. Carbon values are displayed as estimates until verified
            MRV evidence and anchors exist.
          </p>
          <div className="mt-5 grid gap-3">
            {regions.map((region) => {
              const active = region.id === selected?.id;
              const progress = Math.min(100, Math.round((region.verifiedTrees / Math.max(1, region.requiredTreesLow)) * 100));
              return (
                <a
                  className={`rounded-[18px] border p-4 transition ${active ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10 bg-[#05070A]/78 hover:border-cyan-200/40"}`}
                  href={`/projects?regionId=${encodeURIComponent(region.id)}`}
                  key={region.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{region.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{region.restorationType}</div>
                    </div>
                    <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                      {region.restorationPriority}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
                    <span>{region.verifiedTrees.toLocaleString()} trees</span>
                    <span>{region.estimatedCo2eTonnes.toLocaleString()} tCO2e est.</span>
                    <span>{Math.round(region.survivalRateEstimate * 100)}% survival</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
