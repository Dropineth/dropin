import styles from "./MiniProofTimeline.module.css";

export type MiniProofTimelineStep = {
  label: string;
  completed: boolean;
  value?: string;
};

type MiniProofTimelineProps = {
  steps: MiniProofTimelineStep[];
  title?: string;
  subtitle?: string;
};

export function MiniProofTimeline({
  steps,
  title = "Proof Layer / Anchor",
  subtitle = "Every completed step is backed by round, randomness, or proof data returned by the Dropin API.",
}: MiniProofTimelineProps) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <ol className={styles.list}>
        {steps.map((step) => (
          <li className={`${styles.step} ${step.completed ? styles.complete : ""}`} key={step.label}>
            <div className={styles.stepTop}>
              <span className={styles.label}>{step.label}</span>
              <span className={styles.state}>{step.completed ? "complete" : "pending"}</span>
            </div>
            {step.value ? <p className={styles.value}>{step.value}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
