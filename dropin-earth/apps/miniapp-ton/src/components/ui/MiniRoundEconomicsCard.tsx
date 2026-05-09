import styles from "./MiniRoundEconomicsCard.module.css";

type MiniRoundEconomicsCardProps = {
  winner: number;
  reforestation: number;
  operations: number;
  tokenPool?: { TON?: number | string; USDC?: number | string };
  title?: string;
};

export function MiniRoundEconomicsCard({
  winner,
  reforestation,
  operations,
  tokenPool,
  title = "Round Economics",
}: MiniRoundEconomicsCardProps) {
  const rows = [
    { label: "Winner", value: winner, tone: styles.winner },
    { label: "Verified Reforestation", value: reforestation, tone: styles.reforestation },
    { label: "Dropin Operations", value: operations, tone: styles.operations },
  ];

  return (
    <article className={styles.card} aria-label={title}>
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
      {tokenPool ? (
        <p className={styles.pool}>
          Pool: {tokenPool.TON ?? 0} TON / {tokenPool.USDC ?? 0} USDC
        </p>
      ) : null}
    </article>
  );
}
