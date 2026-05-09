import styles from "./MiniMetricsCard.module.css";

type MiniMetricsCardProps = {
  label: string;
  value: string | number;
  color?: string;
};

export function MiniMetricsCard({ label, value, color = "#00C853" }: MiniMetricsCardProps) {
  return (
    <article className={styles.card} style={{ borderColor: color }}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
    </article>
  );
}
