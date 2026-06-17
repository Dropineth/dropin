import type { CSSProperties, ImgHTMLAttributes } from "react";

export type FetchPriority = "high" | "low" | "auto";

export type RemoteImagePolicyInput = {
  src: string;
  /** Intrinsic width in px — required to reserve layout space (CLS). */
  width: number;
  /** Intrinsic height in px — required to reserve layout space (CLS). */
  height: number;
  alt?: string;
  /** `high` for above-the-fold brand marks, `low`/`auto` otherwise. */
  priority?: FetchPriority;
  /** Skip lazy-loading for the first meaningful paint. */
  eager?: boolean;
  className?: string;
};

export type RemoteImageAttrs = Pick<
  ImgHTMLAttributes<HTMLImageElement>,
  | "src"
  | "width"
  | "height"
  | "alt"
  | "loading"
  | "decoding"
  | "fetchPriority"
  | "referrerPolicy"
  | "className"
  | "style"
> & { "aria-hidden"?: boolean | undefined };

/**
 * Content-budgeting policy for external `<img>` assets.
 *
 * Every remote image gets: explicit intrinsic dimensions + an `aspect-ratio`
 * box so the layout never shifts while bytes arrive (CLS = 0), async decoding so
 * paint is never blocked, lazy-loading by default for low-bandwidth clients, and
 * an explicit fetch priority so only brand-critical marks compete for the
 * first-paint budget. Decorative images (no `alt`) are hidden from a11y trees.
 */
export function remoteImageAttrs(input: RemoteImagePolicyInput): RemoteImageAttrs {
  const { src, width, height, alt = "", priority = "auto", eager = false, className = "" } = input;

  const style: CSSProperties = {
    aspectRatio: `${width} / ${height}`,
    contain: "content",
  };

  return {
    src,
    width,
    height,
    alt,
    "aria-hidden": alt ? undefined : true,
    loading: eager ? "eager" : "lazy",
    decoding: "async",
    fetchPriority: priority,
    referrerPolicy: "no-referrer",
    className,
    style,
  };
}
