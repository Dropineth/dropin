"use client";

import type { ReactNode } from "react";

export function CTAButton({
  children,
  href,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const palette =
    variant === "secondary"
      ? "border border-amber-300/70 bg-white/[0.03] text-amber-100 hover:bg-amber-300/10"
      : "bg-[#00B07D] text-[#05070A] hover:bg-[#00C853]";
  const base = `inline-flex min-h-[60px] min-w-[200px] items-center justify-center rounded-2xl px-6 py-3 text-base font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 ${palette} ${disabled ? "pointer-events-none opacity-50" : "hover:-translate-y-0.5"} ${className}`;

  if (href) {
    return (
      <a
        aria-disabled={disabled}
        className={base}
        href={disabled ? undefined : href}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={base} disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}
