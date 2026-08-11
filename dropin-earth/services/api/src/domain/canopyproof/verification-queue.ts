import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";
import { CanopyProofService } from "./proof-service.js";

const verificationWorkStageSchema = z.enum(["validation", "ai_analysis", "terra_crosscheck", "human_review", "proof_issuance"]);
const verificationWorkPrioritySchema = z.enum(["low", "normal", "high", "critical"]);
const verificationWorkStatusSchema = z.enum(["queued", "running", "blocked", "completed", "escalated"]);

const enqueueWorkItemSchema = z.object({
  evidenceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  stage: verificationWorkStageSchema,
  priority: verificationWorkPrioritySchema.default("normal"),
  dependencyIds: z.array(z.string().min(1)).default([]),
  reasonCodes: z.array(z.string().regex(/^[a-z0-9_:-]+$/)).default([]),
  assignedRole: z.enum(["agent", "verifier", "researcher", "governance"]).optional(),
  availableAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  queuedAt: z.string().datetime().optional(),
});

const workItemTransitionSchema = z.object({
  transitionedAt: z.string().datetime().optional(),
  rationale: z.string().min(12).max(2_000),
});

const workItemBlockSchema = workItemTransitionSchema.extend({
  reasonCodes: z.array(z.string().regex(/^[a-z0-9_:-]+$/)).min(1),
});

const workItemListFilterSchema = z.object({
  status: verificationWorkStatusSchema.optional(),
  stage: verificationWorkStageSchema.optional(),
  evidenceId: z.string().min(1).optional(),
});

const pipelinePlanSchema = z.object({
  evidenceId: z.string().min(1),
  requestedAt: z.string().datetime().optional(),
  includeTerraCrosscheck: z.boolean().default(true),
  priority: verificationWorkPrioritySchema.default("normal"),
});

export type CanopyProofVerificationWorkStage = z.infer<typeof verificationWorkStageSchema>;
export type CanopyProofVerificationWorkStatus = z.infer<typeof verificationWorkStatusSchema>;
export type CanopyProofVerificationWorkPriority = z.infer<typeof verificationWorkPrioritySchema>;

export type CanopyProofVerificationWorkItem = {
  readonly id: string;
  readonly evidenceId: string;
  readonly projectId: string;
  readonly stage: CanopyProofVerificationWorkStage;
  readonly priority: CanopyProofVerificationWorkPriority;
  readonly status: CanopyProofVerificationWorkStatus;
  readonly dependencyIds: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly assignedRole?: "agent" | "verifier" | "researcher" | "governance";
  readonly availableAt: string;
  readonly dueAt?: string;
  readonly queuedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly blockedAt?: string;
  readonly transitionedBy?: string;
  readonly workRoot: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofVerificationQueueStatus = {
  readonly service: "canopyproof-verification-queue";
  readonly capacity: number;
  readonly totalWorkItemCount: number;
  readonly queuedWorkItemCount: number;
  readonly runningWorkItemCount: number;
  readonly blockedWorkItemCount: number;
  readonly escalatedWorkItemCount: number;
  readonly completedWorkItemCount: number;
  readonly criticalWorkItemCount: number;
  readonly backpressureActive: boolean;
  readonly queueUtilizationPercent: number;
  readonly safety: {
    readonly aiNeverFinalAuthority: true;
    readonly proofIssuanceRequiresHumanReview: true;
    readonly backpressureBlocksNewWork: true;
    readonly workItemsAreAuditRooted: true;
  };
  readonly queueRoot: string;
};

export class CanopyProofVerificationQueueService {
  private readonly workItemsById = new Map<string, CanopyProofVerificationWorkItem>();
  private readonly workItemIdsByFingerprint = new Map<string, string>();

  constructor(
    private readonly proofService: CanopyProofService,
    private readonly capacity = 1_000,
  ) {}

  enqueueWorkItem(input: unknown, actorId: string): CanopyProofVerificationWorkItem {
    const parsed = enqueueWorkItemSchema.parse(input);
    const evidence = this.proofService.getEvidence(parsed.evidenceId);
    const queuedAt = parsed.queuedAt ?? new Date(0).toISOString();
    const dependencyIds = [...new Set(parsed.dependencyIds)].sort();
    const reasonCodes = [...new Set(parsed.reasonCodes)].sort();
    this.assertDependenciesKnown(dependencyIds);
    assertStageSafety(parsed.stage, dependencyIds, this.workItemsById);

    const fingerprint = hashJson({
      kind: "canopyproof-verification-work-fingerprint-v1",
      evidenceId: parsed.evidenceId,
      stage: parsed.stage,
      dependencyIds,
      reasonCodes,
    });
    const existingId = this.workItemIdsByFingerprint.get(fingerprint);
    if (existingId) {
      return this.getWorkItem(existingId);
    }
    this.assertCapacity();

    const payload = {
      evidenceId: evidence.id,
      projectId: parsed.projectId ?? evidence.projectId,
      stage: parsed.stage,
      priority: parsed.priority,
      status: "queued" as const,
      dependencyIds,
      reasonCodes,
      ...(parsed.assignedRole ? { assignedRole: parsed.assignedRole } : {}),
      availableAt: parsed.availableAt ?? queuedAt,
      ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
      queuedAt,
    };
    const workRoot = hashJson({ kind: "canopyproof-verification-work-item-v1", ...payload });
    const id = `cp_vq_${workRoot.slice(0, 24)}`;
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "DELEGATE",
      actor: actorId,
      entityType: "verification_work_item",
      entityId: id,
      payload: { ...payload, workRoot },
      createdAt: queuedAt,
      rationale: "Verification work item queued for deterministic Evidence -> AI -> Human Review -> Proof orchestration.",
    });
    const workItem: CanopyProofVerificationWorkItem = {
      id,
      evidenceId: evidence.id,
      projectId: payload.projectId,
      stage: parsed.stage,
      priority: parsed.priority,
      status: "queued",
      dependencyIds,
      reasonCodes,
      ...(parsed.assignedRole ? { assignedRole: parsed.assignedRole } : {}),
      availableAt: payload.availableAt,
      ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
      queuedAt,
      workRoot,
      auditHistory,
    };
    this.workItemsById.set(workItem.id, workItem);
    this.workItemIdsByFingerprint.set(fingerprint, workItem.id);
    return workItem;
  }

  planEvidencePipeline(input: unknown, actorId: string) {
    const parsed = pipelinePlanSchema.parse(input);
    const evidence = this.proofService.getEvidence(parsed.evidenceId);
    const queuedAt = parsed.requestedAt ?? new Date(0).toISOString();
    const validation = this.enqueueWorkItem(
      {
        evidenceId: evidence.id,
        projectId: evidence.projectId,
        stage: "validation",
        priority: parsed.priority,
        assignedRole: "agent",
        queuedAt,
        reasonCodes: ["deterministic_schema_validation"],
      },
      actorId,
    );
    const ai = this.enqueueWorkItem(
      {
        evidenceId: evidence.id,
        projectId: evidence.projectId,
        stage: "ai_analysis",
        priority: parsed.priority,
        dependencyIds: [validation.id],
        assignedRole: "agent",
        queuedAt,
        reasonCodes: ["advisory_ai_analysis_required"],
      },
      actorId,
    );
    const terra = parsed.includeTerraCrosscheck
      ? this.enqueueWorkItem(
          {
            evidenceId: evidence.id,
            projectId: evidence.projectId,
            stage: "terra_crosscheck",
            priority: parsed.priority,
            dependencyIds: [validation.id],
            assignedRole: "researcher",
            queuedAt,
            reasonCodes: ["satellite_scene_crosscheck_required"],
          },
          actorId,
        )
      : undefined;
    const humanReview = this.enqueueWorkItem(
      {
        evidenceId: evidence.id,
        projectId: evidence.projectId,
        stage: "human_review",
        priority: parsed.priority,
        dependencyIds: terra ? [ai.id, terra.id] : [ai.id],
        assignedRole: "verifier",
        queuedAt,
        reasonCodes: ["human_review_required_before_public_record"],
      },
      actorId,
    );
    const proofIssuance = this.enqueueWorkItem(
      {
        evidenceId: evidence.id,
        projectId: evidence.projectId,
        stage: "proof_issuance",
        priority: parsed.priority,
        dependencyIds: [humanReview.id],
        assignedRole: "governance",
        queuedAt,
        reasonCodes: ["governance_approval_required_before_issuance"],
      },
      actorId,
    );
    const workItems = [validation, ai, ...(terra ? [terra] : []), humanReview, proofIssuance];
    return {
      evidenceId: evidence.id,
      workItemIds: workItems.map((item) => item.id),
      pipelineRoot: hashJson({
        kind: "canopyproof-verification-pipeline-plan-v1",
        evidenceId: evidence.id,
        workRoots: workItems.map((item) => item.workRoot).sort(),
      }),
      workItems,
    };
  }

  startWorkItem(workItemId: string, input: unknown, actorId: string) {
    const parsed = workItemTransitionSchema.parse(input);
    const current = this.getWorkItem(workItemId);
    if (current.status !== "queued") {
      throw new Error(`CanopyProof verification work item is not queued: ${workItemId}`);
    }
    const blockedDependency = current.dependencyIds.map((id) => this.getWorkItem(id)).find((item) => item.status !== "completed");
    if (blockedDependency) {
      return this.transitionWorkItem(current, "blocked", actorId, parsed.transitionedAt, parsed.rationale, [
        `dependency_not_completed:${blockedDependency.id}`,
      ]);
    }
    return this.transitionWorkItem(current, "running", actorId, parsed.transitionedAt, parsed.rationale);
  }

  completeWorkItem(workItemId: string, input: unknown, actorId: string) {
    const parsed = workItemTransitionSchema.parse(input);
    const current = this.getWorkItem(workItemId);
    if (current.status !== "running" && current.status !== "blocked") {
      throw new Error(`CanopyProof verification work item must be running or blocked before completion: ${workItemId}`);
    }
    return this.transitionWorkItem(current, "completed", actorId, parsed.transitionedAt, parsed.rationale);
  }

  blockWorkItem(workItemId: string, input: unknown, actorId: string) {
    const parsed = workItemBlockSchema.parse(input);
    const current = this.getWorkItem(workItemId);
    return this.transitionWorkItem(current, "escalated", actorId, parsed.transitionedAt, parsed.rationale, parsed.reasonCodes);
  }

  listWorkItems(filters: { readonly status?: string; readonly stage?: string; readonly evidenceId?: string } = {}) {
    const parsedFilters = workItemListFilterSchema.parse(filters);
    return [...this.workItemsById.values()]
      .filter((item) => !parsedFilters.status || item.status === parsedFilters.status)
      .filter((item) => !parsedFilters.stage || item.stage === parsedFilters.stage)
      .filter((item) => !parsedFilters.evidenceId || item.evidenceId === parsedFilters.evidenceId)
      .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt));
  }

  getWorkItem(workItemId: string) {
    const workItem = this.workItemsById.get(workItemId);
    if (!workItem) {
      throw new Error(`CanopyProof verification work item not found: ${workItemId}`);
    }
    return workItem;
  }

  getStatus(): CanopyProofVerificationQueueStatus {
    const workItems = [...this.workItemsById.values()];
    const queued = workItems.filter((item) => item.status === "queued").length;
    const running = workItems.filter((item) => item.status === "running").length;
    const blocked = workItems.filter((item) => item.status === "blocked").length;
    const escalated = workItems.filter((item) => item.status === "escalated").length;
    const completed = workItems.filter((item) => item.status === "completed").length;
    const active = queued + running + blocked + escalated;
    const queueUtilizationPercent = Math.round((active / this.capacity) * 100);
    return {
      service: "canopyproof-verification-queue",
      capacity: this.capacity,
      totalWorkItemCount: workItems.length,
      queuedWorkItemCount: queued,
      runningWorkItemCount: running,
      blockedWorkItemCount: blocked,
      escalatedWorkItemCount: escalated,
      completedWorkItemCount: completed,
      criticalWorkItemCount: workItems.filter((item) => item.priority === "critical" && item.status !== "completed").length,
      backpressureActive: active >= this.capacity,
      queueUtilizationPercent,
      safety: {
        aiNeverFinalAuthority: true,
        proofIssuanceRequiresHumanReview: true,
        backpressureBlocksNewWork: true,
        workItemsAreAuditRooted: true,
      },
      queueRoot: hashJson({
        kind: "canopyproof-verification-queue-status-v1",
        capacity: this.capacity,
        workRoots: workItems.map((item) => item.workRoot).sort(),
        latestAuditRoots: workItems.map((item) => item.auditHistory.at(-1)?.eventRoot).filter(Boolean).sort(),
      }),
    };
  }

  private assertCapacity() {
    const active = [...this.workItemsById.values()].filter((item) => item.status !== "completed").length;
    if (active >= this.capacity) {
      throw new Error("CanopyProof verification queue backpressure is active; new work is blocked.");
    }
  }

  private assertDependenciesKnown(dependencyIds: readonly string[]) {
    for (const dependencyId of dependencyIds) {
      this.getWorkItem(dependencyId);
    }
  }

  private transitionWorkItem(
    current: CanopyProofVerificationWorkItem,
    status: CanopyProofVerificationWorkStatus,
    actorId: string,
    transitionedAt: string | undefined,
    rationale: string,
    reasonCodes: readonly string[] = [],
  ) {
    const at = transitionedAt ?? new Date(0).toISOString();
    const combinedReasonCodes = [...new Set([...current.reasonCodes, ...reasonCodes])].sort();
    const payload = {
      workItemId: current.id,
      evidenceId: current.evidenceId,
      stage: current.stage,
      fromStatus: current.status,
      toStatus: status,
      reasonCodes: combinedReasonCodes,
      transitionedAt: at,
      transitionedBy: actorId,
    };
    const auditHistory = appendCanopyProofAuditEvent(current.auditHistory, {
      action: status === "completed" ? "FULFILL" : status === "escalated" || status === "blocked" ? "CHALLENGE" : "ASSERT",
      actor: actorId,
      entityType: "verification_work_item",
      entityId: current.id,
      payload,
      createdAt: at,
      rationale,
    });
    const workRoot = hashJson({ kind: "canopyproof-verification-work-item-transition-v1", ...payload });
    const transitioned: CanopyProofVerificationWorkItem = {
      ...current,
      status,
      reasonCodes: combinedReasonCodes,
      workRoot,
      auditHistory,
      transitionedBy: actorId,
      ...(status === "running" ? { startedAt: at } : {}),
      ...(status === "completed" ? { completedAt: at } : {}),
      ...(status === "blocked" || status === "escalated" ? { blockedAt: at } : {}),
    };
    this.workItemsById.set(current.id, transitioned);
    return transitioned;
  }
}

function assertStageSafety(
  stage: CanopyProofVerificationWorkStage,
  dependencyIds: readonly string[],
  workItemsById: ReadonlyMap<string, CanopyProofVerificationWorkItem>,
) {
  if (stage === "human_review") {
    const dependencyStages = dependencyIds.map((id) => workItemsById.get(id)?.stage);
    if (!dependencyStages.includes("ai_analysis")) {
      throw new Error("CanopyProof human review work requires an AI analysis dependency.");
    }
  }
  if (stage === "proof_issuance") {
    const dependencyStages = dependencyIds.map((id) => workItemsById.get(id)?.stage);
    if (!dependencyStages.includes("human_review")) {
      throw new Error("CanopyProof proof issuance work requires a human review dependency.");
    }
  }
}
