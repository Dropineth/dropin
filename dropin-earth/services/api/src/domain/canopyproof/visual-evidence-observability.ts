import { hashJson } from "@dropin/crypto";

export const visualEvidenceCounterNames = [
  "visual_assets_ingested_total",
  "point_cloud_assets_ingested_total",
  "model_runs_total",
  "candidate_findings_total",
  "review_queues_created_total",
  "human_reviews_total",
  "field_checks_total",
  "false_positives_total",
  "known_decoys_total",
  "cross_sensor_conflicts_total",
  "crs_registration_denials_total",
  "visual_license_denials_total",
] as const;

export const visualEvidenceQualityMetricNames = [
  "candidate_reduction_ratio",
  "median_review_time",
  "field_confirmation_rate",
  "false_positive_rate",
  "reviewer_disagreement_rate",
  "sensor_domain_failure_rate",
] as const;

export type VisualEvidenceCounterName = (typeof visualEvidenceCounterNames)[number];
export type VisualEvidenceQualityMetricName = (typeof visualEvidenceQualityMetricNames)[number];
export type VisualEvidenceMetricOutcome = "accepted" | "blocked" | "rejected" | "completed";

type CounterKey = `${VisualEvidenceCounterName}|${VisualEvidenceMetricOutcome}`;

export type VisualEvidenceMetricsSnapshot = {
  readonly schemaVersion: "canopyproof.visual-metrics.v1";
  readonly counters: readonly Readonly<{
    name: VisualEvidenceCounterName;
    outcome: VisualEvidenceMetricOutcome;
    value: number;
  }>[];
  readonly quality: readonly Readonly<{
    name: VisualEvidenceQualityMetricName;
    value: number;
    observedAt: string;
  }>[];
  readonly snapshotRoot: string;
  readonly privacy: {
    readonly noTenantLabels: true;
    readonly noAssetLabels: true;
    readonly noCoordinates: true;
    readonly boundedCardinality: true;
  };
};

function parseTime(value: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error("Visual evidence metric observedAt must be RFC3339.");
  return new Date(milliseconds).toISOString();
}

export class CanopyProofVisualEvidenceMetrics {
  private readonly counters = new Map<CounterKey, number>();
  private readonly quality = new Map<VisualEvidenceQualityMetricName, { value: number; observedAt: string }>();

  increment(
    name: VisualEvidenceCounterName,
    outcome: VisualEvidenceMetricOutcome,
    amount = 1,
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Visual evidence counter increment must be a positive safe integer.");
    }
    const key: CounterKey = `${name}|${outcome}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  observe(name: VisualEvidenceQualityMetricName, value: number, observedAt: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Visual evidence quality metric must be finite and non-negative.");
    }
    if (name.endsWith("_ratio") || name.endsWith("_rate")) {
      if (value > 1) throw new Error(`Visual evidence ${name} must be between 0 and 1.`);
    }
    this.quality.set(name, { value, observedAt: parseTime(observedAt) });
  }

  snapshot(): VisualEvidenceMetricsSnapshot {
    const counters = [...this.counters.entries()]
      .map(([key, value]) => {
        const [name, outcome] = key.split("|") as [VisualEvidenceCounterName, VisualEvidenceMetricOutcome];
        return { name, outcome, value };
      })
      .sort((left, right) => `${left.name}|${left.outcome}`.localeCompare(`${right.name}|${right.outcome}`));
    const quality = [...this.quality.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const privacy = {
      noTenantLabels: true as const,
      noAssetLabels: true as const,
      noCoordinates: true as const,
      boundedCardinality: true as const,
    };
    return {
      schemaVersion: "canopyproof.visual-metrics.v1",
      counters,
      quality,
      snapshotRoot: hashJson({ kind: "canopyproof-visual-metrics-v1", counters, quality, privacy }),
      privacy,
    };
  }

  renderPrometheus() {
    const snapshot = this.snapshot();
    const lines: string[] = [];
    for (const counter of snapshot.counters) {
      const metric = `canopyproof_${counter.name}`;
      lines.push(`# TYPE ${metric} counter`);
      lines.push(`${metric}{outcome="${counter.outcome}"} ${counter.value}`);
    }
    for (const quality of snapshot.quality) {
      const metric = `canopyproof_${quality.name}`;
      lines.push(`# TYPE ${metric} gauge`);
      lines.push(`${metric} ${quality.value}`);
    }
    return `${lines.join("\n")}\n`;
  }
}
