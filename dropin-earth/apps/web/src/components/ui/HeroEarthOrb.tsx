import styles from "./HeroEarthOrb.module.css";

export function HeroEarthOrb({
  label = "CanopyProof rotating Earth and forest orb",
  compact = false,
  experimentId,
  experimentVariant = "control",
  className = "",
}: {
  label?: string;
  compact?: boolean;
  experimentId?: string;
  experimentVariant?: "control" | "impact_first" | "proof_first";
  className?: string;
}) {
  const variantClass = experimentVariant === "control" ? "" : styles[experimentVariant];

  return (
    <div
      aria-label={label}
      className={`${styles.orbShell} ${compact ? styles.compact : ""} ${variantClass} ${className}`}
      data-experiment-id={experimentId}
      data-experiment-variant={experimentVariant}
      data-ux-component="Hero"
      data-ux-event="hero_impression"
      data-ux-track="hero-orb"
      role="img"
    >
      <div className={styles.trace} aria-hidden="true" />
      <div className={styles.caption}>
        <div className={styles.eyebrow}>Proof layer online</div>
        <p className={styles.body}>
          Dynamic forest and Earth orb adapted from the CanopyProof UI System import.
        </p>
      </div>
    </div>
  );
}
