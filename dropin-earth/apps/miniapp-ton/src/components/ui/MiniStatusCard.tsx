import type { ReactNode } from "react";
import styles from "./MiniStatusCard.module.css";

type MiniStatusTone = "green" | "blue" | "gold" | "red" | "muted";

type MiniStatusCardProps = {
  label: string;
  value: string | number;
  badge?: string;
  detail?: string;
  tone?: MiniStatusTone;
  children?: ReactNode;
};

export function MiniStatusCard({
  label,
  value,
  badge,
  detail,
  tone = "blue",
  children,
}: MiniStatusCardProps) {
  return (
    <article className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.header}>
        <p className={styles.label}>{label}</p>
        {badge ? <span className={styles.badge}>{badge}</span> : null}
      </div>
      <p className={styles.value}>{value}</p>
      {detail ? <p className={styles.detail}>{detail}</p> : null}
      {children ? <div className={styles.children}>{children}</div> : null}
    </article>
  );
}
