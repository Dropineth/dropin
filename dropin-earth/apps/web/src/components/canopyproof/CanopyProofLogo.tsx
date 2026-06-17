import { type FetchPriority, remoteImageAttrs } from "@/lib/image-policy";
import { CANOPYPROOF_LOGO_SRC } from "./logo";

type CanopyProofLogoProps = {
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  priority?: FetchPriority;
  size?: number;
};

/**
 * Official CanopyProof brand mark.
 *
 * Bound exclusively to the raw JPG asset via a plain optimized `<img>` (no SVG /
 * vector approximation). Content-budgeting, CLS prevention, async decode, and
 * fetch priority come from the shared remote-image policy.
 */
export function CanopyProofLogo({
  alt = "",
  className = "",
  loading = "lazy",
  priority,
  size = 48,
}: CanopyProofLogoProps) {
  const attrs = remoteImageAttrs({
    src: CANOPYPROOF_LOGO_SRC,
    width: size,
    height: size,
    alt,
    eager: loading === "eager",
    priority: priority ?? (loading === "eager" ? "high" : "low"),
    className,
  });

  return <img {...attrs} />;
}
