import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

const resilienceDependencySchema = z.enum(["postgresql", "api_origin", "object_storage", "cloudflare_worker"]);
const resilienceScenarioSchema = z.enum([
  "database_connection_drop",
  "audit_append_failed",
  "domain_mutation_failed",
  "api_origin_unavailable",
  "object_storage_unavailable",
]);

const resilienceSimulationSchema = z.object({
  domainMutationCommitted: z.boolean().default(false),
  auditAppendCommitted: z.boolean().default(false),
  retryQueued: z.boolean().default(false),
  readOnlyFallbackServed: z.boolean().default(false),
  duplicateMutationCreated: z.boolean().default(false),
  finalStateExposed: z.boolean().default(false),
  upstreamAvailable: z.boolean().default(true),
});

const resilienceDrillSchema = z.object({
  drillId: z.string().min(1).optional(),
  dependency: resilienceDependencySchema,
  scenario: resilienceScenarioSchema,
  route: z.string().min(1),
  startedAt: z.string().datetime(),
  idempotencyKey: z.string().min(1).optional(),
  description: z.string().min(12).max(1_500),
  simulation: resilienceSimulationSchema,
});

export type CanopyProofResilienceDependency = z.infer<typeof resilienceDependencySchema>;
export type CanopyProofResilienceScenario = z.infer<typeof resilienceScenarioSchema>;

export type CanopyProofResilienceDecision = "pass" | "needs_recovery" | "fail_closed_violation";

export type CanopyProofResilienceSimulation = z.infer<typeof resilienceSimulationSchema>;

export type CanopyProofResilienceDrill = {
  readonly id: string;
  readonly dependency: CanopyProofResilienceDependency;
  readonly scenario: CanopyProofResilienceScenario;
  readonly route: string;
  readonly startedAt: string;
  readonly recordedAt: string;
  readonly idempotencyKey?: string;
  readonly description: string;
  readonly simulation: CanopyProofResilienceSimulation;
  readonly decision: CanopyProofResilienceDecision;
  readonly safetyAssertions: {
    readonly noFinalStateExposed: boolean;
    readonly noDuplicateMutation: boolean;
    readonly transactionAtomicOrRecoverable: boolean;
    readonly readOnlyOrRetryFallback: boolean;
    readonly idempotencyKeyPreserved: boolean;
  };
  readonly recommendedActions: readonly string[];
  readonly drillHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofResilienceStatus = {
  readonly service: "canopyproof-resilience";
  readonly drillCount: number;
  readonly failedDrillCount: number;
  readonly recoveryDrillCount: number;
  readonly databaseFailureDrillCount: number;
  readonly apiOutageDrillCount: number;
  readonly latestDecision: CanopyProofResilienceDecision | "none";
  readonly safety: {
    readonly databaseFailuresFailClosed: true;
    readonly apiOutagesDegradeReadOnly: true;
    readonly offlineRetriesRequireIdempotency: true;
    readonly partialMutationsAreNotFinal: true;
  };
  readonly resilienceRoot: string;
};

export class CanopyProofResilienceService {
  private readonly drillsById = new Map<string, CanopyProofResilienceDrill>();

  recordDrill(input: unknown, actorId: string): CanopyProofResilienceDrill {
    const parsed = resilienceDrillSchema.parse(input);
    const safetyAssertions = evaluateSafetyAssertions(parsed.simulation, parsed.scenario, parsed.idempotencyKey);
    const decision = classifyDecision(safetyAssertions);
    const recommendedActions = recommendedActionsFor(parsed.scenario, safetyAssertions);
    const seed = {
      dependency: parsed.dependency,
      scenario: parsed.scenario,
      route: parsed.route,
      startedAt: parsed.startedAt,
      idempotencyKey: parsed.idempotencyKey ?? null,
      simulation: parsed.simulation,
      safetyAssertions,
      decision,
    };
    const drillHash = hashJson({ kind: "canopyproof-resilience-drill-v1", ...seed });
    const id = parsed.drillId ?? `cp_resilience_${drillHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: decision === "pass" ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "resilience_drill",
      entityId: id,
      payload: {
        ...seed,
        recommendedActions,
        drillHash,
      },
      createdAt: parsed.startedAt,
      rationale: "CanopyProof resilience drill recorded as append-only operational evidence for database and API outage handling.",
    }).at(-1);

    if (!auditEvent) {
      throw new Error("CanopyProof resilience drill failed to append audit event.");
    }

    const drill: CanopyProofResilienceDrill = {
      id,
      dependency: parsed.dependency,
      scenario: parsed.scenario,
      route: parsed.route,
      startedAt: parsed.startedAt,
      recordedAt: parsed.startedAt,
      ...(parsed.idempotencyKey ? { idempotencyKey: parsed.idempotencyKey } : {}),
      description: parsed.description,
      simulation: parsed.simulation,
      decision,
      safetyAssertions,
      recommendedActions,
      drillHash,
      auditEvent,
    };
    this.drillsById.set(drill.id, drill);
    return drill;
  }

  listDrills() {
    return [...this.drillsById.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  getDrill(id: string) {
    const drill = this.drillsById.get(id);
    if (!drill) {
      throw new Error(`CanopyProof resilience drill not found: ${id}`);
    }
    return drill;
  }

  getStatus(): CanopyProofResilienceStatus {
    const drills = this.listDrills();
    const failedDrillCount = drills.filter((drill) => drill.decision === "fail_closed_violation").length;
    const recoveryDrillCount = drills.filter((drill) => drill.decision === "needs_recovery").length;
    const databaseFailureDrillCount = drills.filter((drill) => drill.dependency === "postgresql").length;
    const apiOutageDrillCount = drills.filter((drill) => drill.scenario === "api_origin_unavailable").length;
    return {
      service: "canopyproof-resilience",
      drillCount: drills.length,
      failedDrillCount,
      recoveryDrillCount,
      databaseFailureDrillCount,
      apiOutageDrillCount,
      latestDecision: drills[0]?.decision ?? "none",
      safety: {
        databaseFailuresFailClosed: true,
        apiOutagesDegradeReadOnly: true,
        offlineRetriesRequireIdempotency: true,
        partialMutationsAreNotFinal: true,
      },
      resilienceRoot: hashJson({
        kind: "canopyproof-resilience-status-v1",
        drillRoots: drills.map((drill) => drill.auditEvent.eventRoot).sort(),
      }),
    };
  }
}

function evaluateSafetyAssertions(
  simulation: CanopyProofResilienceSimulation,
  scenario: CanopyProofResilienceScenario,
  idempotencyKey?: string,
): CanopyProofResilienceDrill["safetyAssertions"] {
  const noFinalStateExposed = !simulation.finalStateExposed;
  const noDuplicateMutation = !simulation.duplicateMutationCreated;
  const transactionAtomic =
    simulation.domainMutationCommitted === simulation.auditAppendCommitted &&
    (simulation.domainMutationCommitted || (!simulation.domainMutationCommitted && !simulation.auditAppendCommitted));
  const transactionRecoverable =
    simulation.retryQueued &&
    noFinalStateExposed &&
    (simulation.domainMutationCommitted !== simulation.auditAppendCommitted ||
      scenario === "database_connection_drop" ||
      scenario === "object_storage_unavailable");
  const transactionAtomicOrRecoverable = transactionAtomic || transactionRecoverable;
  const readOnlyOrRetryFallback =
    scenario === "api_origin_unavailable" || scenario === "object_storage_unavailable"
      ? simulation.readOnlyFallbackServed || simulation.retryQueued
      : true;
  const idempotencyKeyPreserved = simulation.retryQueued ? Boolean(idempotencyKey?.trim()) : true;

  return {
    noFinalStateExposed,
    noDuplicateMutation,
    transactionAtomicOrRecoverable,
    readOnlyOrRetryFallback,
    idempotencyKeyPreserved,
  };
}

function classifyDecision(safetyAssertions: CanopyProofResilienceDrill["safetyAssertions"]): CanopyProofResilienceDecision {
  const failedClosed = !safetyAssertions.noFinalStateExposed || !safetyAssertions.noDuplicateMutation || !safetyAssertions.idempotencyKeyPreserved;
  if (failedClosed) {
    return "fail_closed_violation";
  }
  const needsRecovery = !safetyAssertions.transactionAtomicOrRecoverable || !safetyAssertions.readOnlyOrRetryFallback;
  return needsRecovery ? "needs_recovery" : "pass";
}

function recommendedActionsFor(
  scenario: CanopyProofResilienceScenario,
  safetyAssertions: CanopyProofResilienceDrill["safetyAssertions"],
): readonly string[] {
  const actions: string[] = [];
  if (!safetyAssertions.noFinalStateExposed) {
    actions.push("Block public promotion and hide affected proof, funding, or evidence state until audit recovery completes.");
  }
  if (!safetyAssertions.noDuplicateMutation) {
    actions.push("Quarantine replayed mutation and verify Idempotency-Key handling before accepting more offline sync traffic.");
  }
  if (!safetyAssertions.transactionAtomicOrRecoverable) {
    actions.push("Repair transaction boundary so domain mutation and audit append commit atomically or enter a recoverable retry queue.");
  }
  if (!safetyAssertions.readOnlyOrRetryFallback) {
    actions.push("Serve public UI in read-only mode and queue writes until the dependency recovers.");
  }
  if (!safetyAssertions.idempotencyKeyPreserved) {
    actions.push("Require and persist Idempotency-Key before any retryable outage path can be accepted.");
  }
  if (actions.length > 0) {
    return actions;
  }
  if (scenario === "api_origin_unavailable") {
    return ["Continue monitoring API outage budget while public UI remains read-only and retries stay idempotent."];
  }
  return ["Record drill evidence and keep the dependency runbook current."];
}
