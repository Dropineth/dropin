import type { ReactNode } from "react";

type GlassCardProps = {
  as?: "article" | "div" | "section";
  children: ReactNode;
  className?: string;
};

export function GlassCard({ as: Component = "article", children, className = "" }: GlassCardProps) {
  return <Component className={`cp-glass ${className}`}>{children}</Component>;
}
