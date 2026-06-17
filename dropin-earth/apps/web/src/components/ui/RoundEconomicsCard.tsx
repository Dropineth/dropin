import styles from "./RoundEconomicsCard.module.css";

type RoundEconomicsCardProps = {
  winner: number;
  reforestation: number;
  operations: number;
  title?: string;
  compact?: boolean;
};

export function RoundEconomicsCard({
  winner,
  reforestation,
  operations,
  title = "Round Economics",
  compact = false,
}: RoundEconomicsCardProps) {
  const rows = [
    { label: "Winner", value: winner, tone: styles.winner },
    { label: "Verified Reforestation", value: reforestation, tone: styles.reforestation },
    { label: "CanopyProof Operations", value: operations, tone: styles.operations },
  ];

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""}`} aria-label={title}>
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        <span className={styles.badge}>70/20/10</span>
      </div>
      <div className={styles.bar} aria-hidden="true">
        {rows.map((row) => (
          <span className={row.tone} key={row.label} style={{ width: `${row.value}%` }} />
        ))}
      </div>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}%</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}
