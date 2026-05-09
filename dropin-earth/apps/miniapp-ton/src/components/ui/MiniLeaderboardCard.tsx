import styles from "./MiniLeaderboardCard.module.css";

type MiniLeaderboardEntry = {
  rank: number;
  userId: string;
  leafPoints: number;
};

type MiniLeaderboardCardProps = {
  entries: MiniLeaderboardEntry[];
  limit?: number;
};

export function MiniLeaderboardCard({ entries, limit = 8 }: MiniLeaderboardCardProps) {
  const visibleEntries = entries.slice(0, limit);

  return (
    <section className={styles.card} aria-label="Leaderboard">
      <h2 className={styles.title}>Leaderboard</h2>
      {visibleEntries.length > 0 ? (
        <ol className={styles.list}>
          {visibleEntries.map((entry) => (
            <li className={styles.row} key={`${entry.rank}:${entry.userId}`}>
              <span className={styles.user}>
                #{entry.rank} {entry.userId}
              </span>
              <strong className={styles.points}>{entry.leafPoints} LP</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>No Leaf Points yet. Plant & Enter to become the first visible contributor.</p>
      )}
    </section>
  );
}
