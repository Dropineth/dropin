"use client";

import { useEffect, useMemo, useState } from "react";

export function MetricsCard({
  title,
  value,
  unit = "",
  caption,
  verificationStatus = "verified",
  density = "standard",
  experimentId,
  experimentVariant = "control",
}: {
  title: string;
  value: number;
  unit?: string;
  caption?: string;
  verificationStatus?: string;
  density?: "standard" | "compact" | "proof";
  experimentId?: string;
  experimentVariant?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const formatted = useMemo(() => new Intl.NumberFormat("en-US").format(displayValue), [displayValue]);
  const densityClass =
    density === "compact"
      ? "min-h-[140px] p-4"
      : density === "proof"
        ? "min-h-[168px] border-emerald-300/20 bg-emerald-300/[0.08] p-5"
        : "min-h-[180px] p-5";

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || value <= 0) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const totalFrames = 36;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      setDisplayValue(Math.round(value * progress));
      if (progress === 1) {
        window.clearInterval(timer);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [value]);

  return (
    <article
      className={`rounded-[22px] border border-white/10 bg-white/[0.07] text-white shadow-[0_18px_70px_rgb(0_0_0/0.22)] backdrop-blur ${densityClass}`}
      data-experiment-id={experimentId}
      data-experiment-variant={experimentVariant}
      data-ux-component="MetricsCard"
      data-ux-event="metrics_impression"
      data-ux-track="metric-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
          {verificationStatus}
        </span>
      </div>
      <p className="mt-5 text-4xl font-semibold leading-none text-white">
        {formatted}
        {unit ? <span className="ml-1 text-xl text-slate-300">{unit}</span> : null}
      </p>
      {caption ? <p className="mt-4 text-sm leading-6 text-slate-300">{caption}</p> : null}
    </article>
  );
}
