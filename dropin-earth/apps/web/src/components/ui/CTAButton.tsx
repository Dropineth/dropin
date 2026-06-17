"use client";

import type { ReactNode } from "react";

export function CTAButton({
  children,
  href,
  onClick,
  disabled = false,
  variant = "primary",
  layout = "default",
  experimentId,
  experimentVariant = "control",
  trackingId = "cta",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  layout?: "default" | "wide" | "compact";
  experimentId?: string;
  experimentVariant?: string;
  trackingId?: string;
  className?: string;
}) {
  const palette =
    variant === "secondary"
      ? "border border-amber-300/70 bg-white/[0.03] text-amber-100 hover:bg-amber-300/10"
      : "bg-[#00B07D] text-[#05070A] hover:bg-[#00C853]";
  const layoutClass =
    layout === "wide"
      ? "w-full sm:w-auto sm:min-w-[240px]"
      : layout === "compact"
        ? "min-h-[48px] min-w-[152px] px-4 py-2 text-sm"
        : "min-w-[200px] px-6 py-3 text-base";
  const base = `inline-flex min-h-[60px] items-center justify-center rounded-2xl font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 ${layoutClass} ${palette} ${disabled ? "pointer-events-none opacity-50" : "hover:-translate-y-0.5"} ${className}`;
  const trackingProps = {
    "data-ux-track": trackingId,
    "data-ux-component": "CTAButton",
    "data-ux-event": "cta_click",
    "data-experiment-id": experimentId,
    "data-experiment-variant": experimentVariant,
  };

  if (href) {
    return (
      <a
        aria-disabled={disabled}
        className={base}
        href={disabled ? undefined : href}
        onClick={onClick}
        {...trackingProps}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={base} disabled={disabled} onClick={onClick} type="button" {...trackingProps}>
      {children}
    </button>
  );
}
