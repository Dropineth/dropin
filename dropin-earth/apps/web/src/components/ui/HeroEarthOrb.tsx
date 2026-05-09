import styles from "./HeroEarthOrb.module.css";

export function HeroEarthOrb({
  label = "CanopyProof rotating Earth and forest orb",
  compact = false,
  className = "",
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      className={`${styles.orbShell} ${compact ? styles.compact : ""} ${className}`}
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
