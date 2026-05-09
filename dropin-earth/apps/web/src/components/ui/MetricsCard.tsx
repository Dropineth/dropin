"use client";

import { useEffect, useMemo, useState } from "react";

export function MetricsCard({
  title,
  value,
  unit = "",
  caption,
  verificationStatus = "verified",
}: {
  title: string;
  value: number;
  unit?: string;
  caption?: string;
  verificationStatus?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const formatted = useMemo(() => new Intl.NumberFormat("en-US").format(displayValue), [displayValue]);

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
    <article className="min-h-[180px] rounded-[22px] border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_18px_70px_rgb(0_0_0/0.22)] backdrop-blur">
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
