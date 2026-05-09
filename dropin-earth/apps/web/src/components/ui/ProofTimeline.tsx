import styles from "./ProofTimeline.module.css";

type ProofTimelineStep = {
  label: string;
  completed: boolean;
  description?: string;
};

type ProofTimelineProps = {
  steps: ProofTimelineStep[];
  disclaimer?: string;
};

export function ProofTimeline({ steps, disclaimer }: ProofTimelineProps) {
  return (
    <article className={styles.card} aria-label="Impact proof timeline">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Impact Proof</p>
          <h2 className={styles.title}>Traceable proof path</h2>
        </div>
        <span className={styles.badge}>Challengeable</span>
      </div>
      <ol className={styles.timeline}>
        {steps.map((step, index) => (
          <li className={step.completed ? styles.completed : ""} key={`${step.label}:${index}`}>
            <span className={styles.marker}>{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              {step.description ? <p>{step.description}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {disclaimer ? <p className={styles.disclaimer}>{disclaimer}</p> : null}
    </article>
  );
}
