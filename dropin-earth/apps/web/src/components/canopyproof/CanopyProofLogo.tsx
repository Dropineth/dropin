import { CANOPYPROOF_LOGO_SRC } from "./logo";

type CanopyProofLogoProps = {
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  size?: number;
};

export function CanopyProofLogo({
  alt = "",
  className = "",
  loading = "lazy",
  size = 48,
}: CanopyProofLogoProps) {
  return (
    <img
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      decoding="async"
      height={size}
      loading={loading}
      src={CANOPYPROOF_LOGO_SRC}
      width={size}
    />
  );
}
