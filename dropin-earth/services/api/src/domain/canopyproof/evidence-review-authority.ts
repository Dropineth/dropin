import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import type {
  CanopyProofEvidenceMediaObjectFact,
  CanopyProofEvidenceMediaObjectProjection,
  CanopyProofEvidenceMediaUploadIntentFact,
} from "./evidence-media-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";

export const canopyProofEvidenceMediaReviewSeverities = ["low", "medium", "high", "critical"] as const;
export const canopyProofEvidenceMediaReviewDecisions = [
  "accept_for_processing",
  "retain_non_final",
  "reject",
  "quarantine",
  "escalate",
] as const;
export const canopyProofEvidenceMediaCustodyActions = [
  "review_opened",
  "review_assigned",
  "review_decided",
] as const;
export const canopyProofEvidenceMediaCustodyArtifactTypes = [
  "media_review_task",
  "media_review_assignment",
  "media_review_decision",
] as const;

export type CanopyProofEvidenceMediaReviewSeverity =
  (typeof canopyProofEvidenceMediaReviewSeverities)[number];
export type CanopyProofEvidenceMediaReviewDecision =
  (typeof canopyProofEvidenceMediaReviewDecisions)[number];
export type CanopyProofEvidenceMediaCustodyAction =
  (typeof canopyProofEvidenceMediaCustodyActions)[number];
export type CanopyProofEvidenceMediaCustodyArtifactType =
  (typeof canopyProofEvidenceMediaCustodyArtifactTypes)[number];

export type CanopyProofEvidenceMediaReviewSafetyBoundary = {
  readonly appendOnly: true;
  readonly organizationBound: true;
  readonly mediaObjectBound: true;
  readonly mediaProjectionBound: true;
  readonly semanticEventBound: true;
  readonly independentAccreditedHumanReviewerRequired: true;
  readonly reviewCannotOverrideProviderVerification: true;
  readonly custodyPreviousRootLinked: true;
  readonly noRawRationale: true;
  readonly noProviderCredential: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceMediaReviewTaskFact = {
  readonly factType: "evidence_media_review_task";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly mediaProjectionState: CanopyProofEvidenceMediaObjectProjection["state"];
  readonly mediaProjectionRoot: string;
  readonly contributorId: string;
  readonly reviewRound: number;
  readonly previousReviewTaskRoot: string | null;
  readonly reasonCodes: readonly string[];
  readonly severity: CanopyProofEvidenceMediaReviewSeverity;
  readonly policyId: string;
  readonly openedBy: string;
  readonly opener: CanopyProofVerificationActorSnapshot;
  readonly openedAt: string;
  readonly dueAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly taskHash: string;
  readonly taskRoot: string;
  readonly safety: CanopyProofEvidenceMediaReviewSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaReviewAssignmentFact = {
  readonly factType: "evidence_media_review_assignment";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly taskId: string;
  readonly taskRoot: string;
  readonly contributorId: string;
  readonly reviewerId: string;
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly assignedBy: string;
  readonly assigner: CanopyProofVerificationActorSnapshot;
  readonly assignedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly assignmentHash: string;
  readonly assignmentRoot: string;
  readonly safety: CanopyProofEvidenceMediaReviewSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaReviewDecisionFact = {
  readonly factType: "evidence_media_review_decision";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly taskId: string;
  readonly taskRoot: string;
  readonly assignmentId: string;
  readonly assignmentRoot: string;
  readonly mediaProjectionState: CanopyProofEvidenceMediaObjectProjection["state"];
  readonly mediaProjectionRoot: string;
  readonly reviewerId: string;
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly decision: CanopyProofEvidenceMediaReviewDecision;
  readonly rationaleHash: string;
  readonly limitationHashes: readonly string[];
  readonly decidedAt: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly decisionHash: string;
  readonly decisionRoot: string;
  readonly safety: CanopyProofEvidenceMediaReviewSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaCustodyEventFact = {
  readonly factType: "evidence_media_custody_event";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly action: CanopyProofEvidenceMediaCustodyAction;
  readonly artifactType: CanopyProofEvidenceMediaCustodyArtifactType;
  readonly artifactId: string;
  readonly sourceRoot: string;
  readonly custodianId: string;
  readonly custodian: CanopyProofVerificationActorSnapshot;
  readonly custodyNoteHash: string;
  readonly policyId: string;
  readonly occurredAt: string;
  readonly previousCustodyRoot: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly custodyHash: string;
  readonly custodyRoot: string;
  readonly safety: CanopyProofEvidenceMediaReviewSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceMediaReviewTaskProjection = {
  readonly taskId: string;
  readonly taskRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly status: "open" | "assigned" | "decided";
  readonly assignmentId?: string;
  readonly assignmentRoot?: string;
  readonly decisionId?: string;
  readonly decisionRoot?: string;
  readonly decision?: CanopyProofEvidenceMediaReviewDecision;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEvidenceMediaReviewSafetyBoundary;
};

export type CanopyProofEvidenceMediaReviewAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly reviewTasks: readonly CanopyProofEvidenceMediaReviewTaskFact[];
  readonly reviewAssignments: readonly CanopyProofEvidenceMediaReviewAssignmentFact[];
  readonly reviewDecisions: readonly CanopyProofEvidenceMediaReviewDecisionFact[];
  readonly custodyEvents: readonly CanopyProofEvidenceMediaCustodyEventFact[];
};

export type CanopyProofEvidenceMediaReviewTaskAuthority = {
  readonly intent: CanopyProofEvidenceMediaUploadIntentFact;
  readonly object: CanopyProofEvidenceMediaObjectFact;
  readonly mediaProjection: CanopyProofEvidenceMediaObjectProjection;
  readonly opener: CanopyProofVerificationActorSnapshot;
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(["owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: hashSchema,
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(z.string().trim().min(1).max(240)).max(32),
    authorityRoot: hashSchema,
  })
  .strict();
const reviewTaskInputSchema = z
  .object({
    objectId: identifierSchema,
    reasonCodes: z.array(z.string().regex(/^[a-z0-9][a-z0-9_:-]{0,119}$/)).min(1).max(32),
    severity: z.enum(canopyProofEvidenceMediaReviewSeverities),
    policyId: identifierSchema,
    openedAt: z.string().datetime(),
    dueAt: z.string().datetime(),
  })
  .strict()
  .refine((value) => Date.parse(value.openedAt) < Date.parse(value.dueAt), {
    message: "CanopyProof evidence media review dueAt must follow openedAt.",
  });
const reviewAssignmentInputSchema = z
  .object({
    taskId: identifierSchema,
    reviewerId: identifierSchema,
    assignedAt: z.string().datetime(),
  })
  .strict();
const reviewDecisionInputSchema = z
  .object({
    taskId: identifierSchema,
    decision: z.enum(canopyProofEvidenceMediaReviewDecisions),
    rationale: z.string().trim().min(20).max(4_000),
    limitations: z.array(z.string().trim().min(3).max(1_000)).min(1).max(32),
    decidedAt: z.string().datetime(),
  })
  .strict();

export class CanopyProofEvidenceMediaReviewAuthorityService {
  private readonly reviewTasksById = new Map<string, CanopyProofEvidenceMediaReviewTaskFact>();
  private readonly reviewTaskIdsByObjectId = new Map<string, string[]>();
  private readonly reviewAssignmentsById = new Map<string, CanopyProofEvidenceMediaReviewAssignmentFact>();
  private readonly reviewAssignmentIdByTaskId = new Map<string, string>();
  private readonly reviewDecisionsById = new Map<string, CanopyProofEvidenceMediaReviewDecisionFact>();
  private readonly reviewDecisionIdByTaskId = new Map<string, string>();
  private readonly custodyEventsById = new Map<string, CanopyProofEvidenceMediaCustodyEventFact>();
  private readonly custodyEventIdsByEvidenceId = new Map<string, string[]>();
  private streamEvents: CanopyProofAuditEvent[];

  constructor(streamEvents: readonly CanopyProofAuditEvent[] = []) {
    this.streamEvents = validateStreamEvents(streamEvents);
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofEvidenceMediaReviewAuthoritySnapshot) {
    const service = new CanopyProofEvidenceMediaReviewAuthorityService(snapshot.streamEvents);
    const ids = new Set<string>();
    const facts = [
      ...snapshot.reviewTasks,
      ...snapshot.reviewAssignments,
      ...snapshot.reviewDecisions,
      ...snapshot.custodyEvents,
    ].sort((left, right) => left.evidenceSequence - right.evidenceSequence || left.id.localeCompare(right.id));
    for (const fact of facts) {
      if (ids.has(fact.id)) {
        throw new Error(`CanopyProof evidence media review snapshot contains duplicate fact id: ${fact.id}`);
      }
      ids.add(fact.id);
      if (fact.factType === "evidence_media_review_task") service.replayReviewTask(fact);
      else if (fact.factType === "evidence_media_review_assignment") service.replayReviewAssignment(fact);
      else if (fact.factType === "evidence_media_review_decision") service.replayReviewDecision(fact);
      else service.replayCustodyEvent(fact);
    }
    return service;
  }

  openReviewTask(
    input: unknown,
    authorityInput: CanopyProofEvidenceMediaReviewTaskAuthority,
  ): Readonly<{
    task: CanopyProofEvidenceMediaReviewTaskFact;
    custodyEvent: CanopyProofEvidenceMediaCustodyEventFact;
  }> {
    const parsed = reviewTaskInputSchema.parse(input);
    const opener = normalizeHumanActor(authorityInput.opener);
    if (!(["owner", "admin", "verifier", "researcher"] as const).includes(opener.role)) {
      throw new Error("CanopyProof evidence media review opener role is not authorized.");
    }
    const { intent, object, mediaProjection } = authorityInput;
    assertMediaReviewSource(parsed.objectId, intent, object, mediaProjection, parsed.openedAt);
    assertActorOrganization(opener, object.organizationId);
    const priorTasks = this.tasksForObject(object.id);
    if (priorTasks.some((task) => !this.reviewDecisionIdByTaskId.has(task.id))) {
      throw new Error("CanopyProof evidence media object already has an undecided review task.");
    }
    const reasonCodes = canonicalStrings(parsed.reasonCodes, "review reason codes");
    const previousReviewTask = priorTasks.at(-1);
    const normalized = {
      organizationId: object.organizationId,
      projectId: object.projectId,
      evidenceId: object.evidenceId,
      objectId: object.id,
      objectRoot: object.objectRoot,
      mediaProjectionState: mediaProjection.state,
      mediaProjectionRoot: mediaProjection.projectionRoot,
      contributorId: intent.subjectId,
      reviewRound: priorTasks.length + 1,
      previousReviewTaskRoot: previousReviewTask?.taskRoot ?? null,
      reasonCodes,
      severity: parsed.severity,
      policyId: parsed.policyId,
      openedBy: opener.id,
      opener,
      openedAt: parsed.openedAt,
      dueAt: parsed.dueAt,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-review-task-command-v1", ...normalized });
    const id = `cp_media_review_task_${commandHash.slice(0, 24)}`;
    const existing = this.reviewTasksById.get(id);
    if (existing) {
      const custodyEvent = this.requireCustodyForArtifact("media_review_task", existing.id);
      return { task: existing, custodyEvent };
    }
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const taskHash = hashJson({ kind: "canopyproof-evidence-media-review-task-v1", ...seed });
    const taskRoot = hashJson({
      kind: "canopyproof-evidence-media-review-task-root-v1",
      objectRoot: object.objectRoot,
      mediaProjectionRoot: mediaProjection.projectionRoot,
      contributorId: intent.subjectId,
      reviewRound: normalized.reviewRound,
      previousReviewTaskRoot: normalized.previousReviewTaskRoot,
      commandHash,
      taskHash,
      ...lineage,
    });
    const safety = canopyProofEvidenceMediaReviewSafetyBoundary();
    const payload = { factType: "evidence_media_review_task", ...seed, taskHash, taskRoot, safety };
    const auditEvent = this.appendEvent({
      action: "REASON",
      actor: opener.id,
      entityType: "evidence_media_review_task",
      entityId: id,
      payload,
      createdAt: parsed.openedAt,
      rationale: "An immutable media review task was opened against an exact object and current trust projection.",
    });
    const task: CanopyProofEvidenceMediaReviewTaskFact = {
      factType: "evidence_media_review_task",
      ...seed,
      taskHash,
      taskRoot,
      safety,
      auditEvent,
    };
    this.reviewTasksById.set(id, task);
    this.reviewTaskIdsByObjectId.set(object.id, [...(this.reviewTaskIdsByObjectId.get(object.id) ?? []), id]);
    const custodyEvent = this.appendCustodyEvent({
      organizationId: task.organizationId,
      projectId: task.projectId,
      evidenceId: task.evidenceId,
      action: "review_opened",
      artifactType: "media_review_task",
      artifactId: task.id,
      sourceRoot: task.taskRoot,
      custodian: opener,
      policyId: task.policyId,
      occurredAt: task.openedAt,
    });
    return { task, custodyEvent };
  }

  assignReviewTask(
    input: unknown,
    assignerInput: CanopyProofVerificationActorSnapshot,
    reviewerInput: CanopyProofVerificationActorSnapshot,
  ): Readonly<{
    assignment: CanopyProofEvidenceMediaReviewAssignmentFact;
    custodyEvent: CanopyProofEvidenceMediaCustodyEventFact;
  }> {
    const parsed = reviewAssignmentInputSchema.parse(input);
    const task = this.getReviewTask(parsed.taskId);
    const assigner = normalizeHumanActor(assignerInput);
    const reviewer = normalizeHumanActor(reviewerInput);
    if (assigner.role !== "owner" && assigner.role !== "admin") {
      throw new Error("CanopyProof evidence media review assignment requires owner or admin authority.");
    }
    assertActorOrganization(assigner, task.organizationId);
    assertAccreditedReviewer(reviewer, task.organizationId);
    if (parsed.reviewerId !== reviewer.id) {
      throw new Error("CanopyProof evidence media review assignment reviewer identity mismatch.");
    }
    if ([task.contributorId, task.openedBy, assigner.id].includes(reviewer.id)) {
      throw new Error("CanopyProof evidence media review requires an independent human reviewer.");
    }
    if (Date.parse(parsed.assignedAt) < Date.parse(task.openedAt)) {
      throw new Error("CanopyProof evidence media review assignment predates task creation.");
    }
    const normalized = {
      organizationId: task.organizationId,
      projectId: task.projectId,
      evidenceId: task.evidenceId,
      objectId: task.objectId,
      taskId: task.id,
      taskRoot: task.taskRoot,
      contributorId: task.contributorId,
      reviewerId: reviewer.id,
      reviewer,
      assignedBy: assigner.id,
      assigner,
      assignedAt: parsed.assignedAt,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-review-assignment-command-v1", ...normalized });
    const existingId = this.reviewAssignmentIdByTaskId.get(task.id);
    if (existingId) {
      const assignment = this.getReviewAssignment(existingId);
      if (assignment.commandHash !== commandHash) {
        throw new Error("CanopyProof evidence media review task already has a different immutable assignment.");
      }
      const custodyEvent = this.requireCustodyForArtifact("media_review_assignment", assignment.id);
      return { assignment, custodyEvent };
    }
    const id = `cp_media_review_assignment_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const assignmentHash = hashJson({ kind: "canopyproof-evidence-media-review-assignment-v1", ...seed });
    const assignmentRoot = hashJson({
      kind: "canopyproof-evidence-media-review-assignment-root-v1",
      taskRoot: task.taskRoot,
      reviewerAuthorityRoot: reviewer.authorityRoot,
      assignerAuthorityRoot: assigner.authorityRoot,
      commandHash,
      assignmentHash,
      ...lineage,
    });
    const safety = canopyProofEvidenceMediaReviewSafetyBoundary();
    const payload = {
      factType: "evidence_media_review_assignment",
      ...seed,
      assignmentHash,
      assignmentRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: "DELEGATE",
      actor: assigner.id,
      entityType: "evidence_media_review_assignment",
      entityId: id,
      payload,
      createdAt: parsed.assignedAt,
      rationale: "An independent accredited human reviewer was assigned through an immutable authority fact.",
    });
    const assignment: CanopyProofEvidenceMediaReviewAssignmentFact = {
      factType: "evidence_media_review_assignment",
      ...seed,
      assignmentHash,
      assignmentRoot,
      safety,
      auditEvent,
    };
    this.reviewAssignmentsById.set(id, assignment);
    this.reviewAssignmentIdByTaskId.set(task.id, id);
    const custodyEvent = this.appendCustodyEvent({
      organizationId: task.organizationId,
      projectId: task.projectId,
      evidenceId: task.evidenceId,
      action: "review_assigned",
      artifactType: "media_review_assignment",
      artifactId: assignment.id,
      sourceRoot: assignment.assignmentRoot,
      custodian: assigner,
      policyId: task.policyId,
      occurredAt: assignment.assignedAt,
    });
    return { assignment, custodyEvent };
  }

  decideReviewTask(
    input: unknown,
    reviewerInput: CanopyProofVerificationActorSnapshot,
    mediaProjection: CanopyProofEvidenceMediaObjectProjection,
  ): Readonly<{
    decision: CanopyProofEvidenceMediaReviewDecisionFact;
    custodyEvent: CanopyProofEvidenceMediaCustodyEventFact;
  }> {
    const parsed = reviewDecisionInputSchema.parse(input);
    const task = this.getReviewTask(parsed.taskId);
    const assignmentId = this.reviewAssignmentIdByTaskId.get(task.id);
    if (!assignmentId) throw new Error("CanopyProof evidence media review decision requires an assignment fact.");
    const assignment = this.getReviewAssignment(assignmentId);
    const reviewer = normalizeHumanActor(reviewerInput);
    assertAccreditedReviewer(reviewer, task.organizationId);
    if (reviewer.id !== assignment.reviewerId || reviewer.authorityRoot !== assignment.reviewer.authorityRoot) {
      throw new Error("CanopyProof evidence media review decision requires the exact assigned reviewer authority.");
    }
    assertReviewProjection(task, mediaProjection, parsed.decidedAt);
    if (Date.parse(parsed.decidedAt) < Date.parse(assignment.assignedAt)) {
      throw new Error("CanopyProof evidence media review decision predates assignment.");
    }
    if (parsed.decision === "accept_for_processing" && mediaProjection.state !== "available") {
      throw new Error("CanopyProof evidence media review cannot override provider or trust verification.");
    }
    const normalized = {
      organizationId: task.organizationId,
      projectId: task.projectId,
      evidenceId: task.evidenceId,
      objectId: task.objectId,
      taskId: task.id,
      taskRoot: task.taskRoot,
      assignmentId: assignment.id,
      assignmentRoot: assignment.assignmentRoot,
      mediaProjectionState: mediaProjection.state,
      mediaProjectionRoot: mediaProjection.projectionRoot,
      reviewerId: reviewer.id,
      reviewer,
      decision: parsed.decision,
      rationaleHash: hashJson({ kind: "canopyproof-evidence-media-review-rationale-v1", value: parsed.rationale }),
      limitationHashes: canonicalHashes(
        parsed.limitations.map((value) =>
          hashJson({ kind: "canopyproof-evidence-media-review-limitation-v1", value })),
      ),
      decidedAt: parsed.decidedAt,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-review-decision-command-v1", ...normalized });
    const existingId = this.reviewDecisionIdByTaskId.get(task.id);
    if (existingId) {
      const decision = this.getReviewDecision(existingId);
      if (decision.commandHash !== commandHash) {
        throw new Error("CanopyProof evidence media review task already has a different immutable decision.");
      }
      const custodyEvent = this.requireCustodyForArtifact("media_review_decision", decision.id);
      return { decision, custodyEvent };
    }
    const id = `cp_media_review_decision_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const decisionHash = hashJson({ kind: "canopyproof-evidence-media-review-decision-v1", ...seed });
    const decisionRoot = hashJson({
      kind: "canopyproof-evidence-media-review-decision-root-v1",
      taskRoot: task.taskRoot,
      assignmentRoot: assignment.assignmentRoot,
      mediaProjectionRoot: mediaProjection.projectionRoot,
      reviewerAuthorityRoot: reviewer.authorityRoot,
      decision: normalized.decision,
      commandHash,
      decisionHash,
      ...lineage,
    });
    const safety = canopyProofEvidenceMediaReviewSafetyBoundary();
    const payload = {
      factType: "evidence_media_review_decision",
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
    };
    const action = reviewDecisionAction(parsed.decision);
    const auditEvent = this.appendEvent({
      action,
      actor: reviewer.id,
      entityType: "evidence_media_review_decision",
      entityId: id,
      payload,
      createdAt: parsed.decidedAt,
      rationale: "An independent human review decision was appended without changing media or proof authority.",
    });
    const decision: CanopyProofEvidenceMediaReviewDecisionFact = {
      factType: "evidence_media_review_decision",
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
      auditEvent,
    };
    this.reviewDecisionsById.set(id, decision);
    this.reviewDecisionIdByTaskId.set(task.id, id);
    const custodyEvent = this.appendCustodyEvent({
      organizationId: task.organizationId,
      projectId: task.projectId,
      evidenceId: task.evidenceId,
      action: "review_decided",
      artifactType: "media_review_decision",
      artifactId: decision.id,
      sourceRoot: decision.decisionRoot,
      custodian: reviewer,
      policyId: task.policyId,
      occurredAt: decision.decidedAt,
      eventAction: action,
    });
    return { decision, custodyEvent };
  }

  projectReviewTask(taskId: string): CanopyProofEvidenceMediaReviewTaskProjection {
    const task = this.getReviewTask(taskId);
    const assignmentId = this.reviewAssignmentIdByTaskId.get(task.id);
    const assignment = assignmentId ? this.getReviewAssignment(assignmentId) : undefined;
    const decisionId = this.reviewDecisionIdByTaskId.get(task.id);
    const decision = decisionId ? this.getReviewDecision(decisionId) : undefined;
    const safety = canopyProofEvidenceMediaReviewSafetyBoundary();
    const seed = {
      taskId: task.id,
      taskRoot: task.taskRoot,
      organizationId: task.organizationId,
      projectId: task.projectId,
      evidenceId: task.evidenceId,
      objectId: task.objectId,
      status: decision ? "decided" : assignment ? "assigned" : ("open" as const),
      ...(assignment ? { assignmentId: assignment.id, assignmentRoot: assignment.assignmentRoot } : {}),
      ...(decision
        ? { decisionId: decision.id, decisionRoot: decision.decisionRoot, decision: decision.decision }
        : {}),
    } as const;
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-evidence-media-review-task-projection-v1", ...seed, safety }),
      safety,
    };
  }

  getReviewTask(id: string) {
    const fact = this.reviewTasksById.get(id);
    if (!fact) throw new Error(`CanopyProof evidence media review task not found: ${id}`);
    return fact;
  }

  getReviewAssignment(id: string) {
    const fact = this.reviewAssignmentsById.get(id);
    if (!fact) throw new Error(`CanopyProof evidence media review assignment not found: ${id}`);
    return fact;
  }

  getReviewDecision(id: string) {
    const fact = this.reviewDecisionsById.get(id);
    if (!fact) throw new Error(`CanopyProof evidence media review decision not found: ${id}`);
    return fact;
  }

  getCustodyEvent(id: string) {
    const fact = this.custodyEventsById.get(id);
    if (!fact) throw new Error(`CanopyProof evidence media custody event not found: ${id}`);
    return fact;
  }

  getAuthoritySnapshot(): CanopyProofEvidenceMediaReviewAuthoritySnapshot {
    return {
      streamEvents: [...this.streamEvents],
      reviewTasks: sortedFacts(this.reviewTasksById.values()),
      reviewAssignments: sortedFacts(this.reviewAssignmentsById.values()),
      reviewDecisions: sortedFacts(this.reviewDecisionsById.values()),
      custodyEvents: sortedFacts(this.custodyEventsById.values()),
    };
  }

  private appendCustodyEvent(input: Readonly<{
    organizationId: string;
    projectId: string;
    evidenceId: string;
    action: CanopyProofEvidenceMediaCustodyAction;
    artifactType: CanopyProofEvidenceMediaCustodyArtifactType;
    artifactId: string;
    sourceRoot: string;
    custodian: CanopyProofVerificationActorSnapshot;
    policyId: string;
    occurredAt: string;
    eventAction?: CanopyProofAuditEvent["action"];
  }>) {
    const custodian = normalizeHumanActor(input.custodian);
    const previousCustodyRoot = this.latestCustodyRoot(input.evidenceId);
    const normalized = {
      organizationId: input.organizationId,
      projectId: input.projectId,
      evidenceId: input.evidenceId,
      action: input.action,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      sourceRoot: normalizeHash(input.sourceRoot),
      custodianId: custodian.id,
      custodian,
      custodyNoteHash: custodyNoteHash(input.action),
      policyId: input.policyId,
      occurredAt: input.occurredAt,
      previousCustodyRoot,
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-media-custody-command-v1", ...normalized });
    const id = `cp_media_custody_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const custodyHash = hashJson({ kind: "canopyproof-evidence-media-custody-v1", ...seed });
    const custodyRoot = hashJson({
      kind: "canopyproof-evidence-media-custody-root-v1",
      evidenceId: input.evidenceId,
      action: input.action,
      sourceRoot: normalized.sourceRoot,
      custodianAuthorityRoot: custodian.authorityRoot,
      previousCustodyRoot,
      commandHash,
      custodyHash,
      ...lineage,
    });
    const safety = canopyProofEvidenceMediaReviewSafetyBoundary();
    const payload = {
      factType: "evidence_media_custody_event",
      ...seed,
      custodyHash,
      custodyRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: input.eventAction ?? (input.action === "review_assigned" ? "DELEGATE" : "REASON"),
      actor: custodian.id,
      entityType: "evidence_media_custody_event",
      entityId: id,
      payload,
      createdAt: input.occurredAt,
      rationale: "An exact-source, previous-root-linked media custody event was appended.",
    });
    const fact: CanopyProofEvidenceMediaCustodyEventFact = {
      factType: "evidence_media_custody_event",
      ...seed,
      custodyHash,
      custodyRoot,
      safety,
      auditEvent,
    };
    this.custodyEventsById.set(id, fact);
    this.custodyEventIdsByEvidenceId.set(input.evidenceId, [
      ...(this.custodyEventIdsByEvidenceId.get(input.evidenceId) ?? []),
      id,
    ]);
    return fact;
  }

  private replayReviewTask(expected: CanopyProofEvidenceMediaReviewTaskFact) {
    const opener = normalizeHumanActor(expected.opener);
    const previousReviewTaskRoot = this.tasksForObject(expected.objectId).at(-1)?.taskRoot ?? null;
    const seed = reviewTaskFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-media-review-task-command-v1",
      ...reviewTaskCommandSeed(expected),
    });
    const taskHash = hashJson({ kind: "canopyproof-evidence-media-review-task-v1", ...seed });
    const taskRoot = reviewTaskRoot(expected, taskHash);
    if (
      opener.id !== expected.openedBy ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_media_review_task_${commandHash.slice(0, 24)}` ||
      taskHash !== expected.taskHash ||
      taskRoot !== expected.taskRoot ||
      expected.reviewRound !== this.tasksForObject(expected.objectId).length + 1 ||
      expected.previousReviewTaskRoot !== previousReviewTaskRoot
    ) {
      throw new Error(`CanopyProof evidence media review task lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      "REASON",
      "evidence_media_review_task",
      { factType: expected.factType, ...seed, taskHash, taskRoot, safety: expected.safety },
      "An immutable media review task was opened against an exact object and current trust projection.",
    );
    this.reviewTasksById.set(expected.id, expected);
    this.reviewTaskIdsByObjectId.set(expected.objectId, [
      ...(this.reviewTaskIdsByObjectId.get(expected.objectId) ?? []),
      expected.id,
    ]);
  }

  private replayReviewAssignment(expected: CanopyProofEvidenceMediaReviewAssignmentFact) {
    const task = this.getReviewTask(expected.taskId);
    const reviewer = normalizeHumanActor(expected.reviewer);
    const assigner = normalizeHumanActor(expected.assigner);
    const seed = reviewAssignmentFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-media-review-assignment-command-v1",
      ...reviewAssignmentCommandSeed(expected),
    });
    const assignmentHash = hashJson({ kind: "canopyproof-evidence-media-review-assignment-v1", ...seed });
    const assignmentRoot = reviewAssignmentRoot(expected, assignmentHash);
    if (
      task.taskRoot !== expected.taskRoot ||
      reviewer.id !== expected.reviewerId ||
      assigner.id !== expected.assignedBy ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_media_review_assignment_${commandHash.slice(0, 24)}` ||
      assignmentHash !== expected.assignmentHash ||
      assignmentRoot !== expected.assignmentRoot ||
      this.reviewAssignmentIdByTaskId.has(task.id)
    ) {
      throw new Error(`CanopyProof evidence media review assignment lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      "DELEGATE",
      "evidence_media_review_assignment",
      { factType: expected.factType, ...seed, assignmentHash, assignmentRoot, safety: expected.safety },
      "An independent accredited human reviewer was assigned through an immutable authority fact.",
    );
    this.reviewAssignmentsById.set(expected.id, expected);
    this.reviewAssignmentIdByTaskId.set(task.id, expected.id);
  }

  private replayReviewDecision(expected: CanopyProofEvidenceMediaReviewDecisionFact) {
    const task = this.getReviewTask(expected.taskId);
    const assignment = this.getReviewAssignment(expected.assignmentId);
    const reviewer = normalizeHumanActor(expected.reviewer);
    const seed = reviewDecisionFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-media-review-decision-command-v1",
      ...reviewDecisionCommandSeed(expected),
    });
    const decisionHash = hashJson({ kind: "canopyproof-evidence-media-review-decision-v1", ...seed });
    const decisionRoot = reviewDecisionRoot(expected, decisionHash);
    if (
      task.taskRoot !== expected.taskRoot ||
      assignment.assignmentRoot !== expected.assignmentRoot ||
      reviewer.id !== expected.reviewerId ||
      reviewer.authorityRoot !== assignment.reviewer.authorityRoot ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_media_review_decision_${commandHash.slice(0, 24)}` ||
      decisionHash !== expected.decisionHash ||
      decisionRoot !== expected.decisionRoot ||
      this.reviewDecisionIdByTaskId.has(task.id)
    ) {
      throw new Error(`CanopyProof evidence media review decision lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      reviewDecisionAction(expected.decision),
      "evidence_media_review_decision",
      { factType: expected.factType, ...seed, decisionHash, decisionRoot, safety: expected.safety },
      "An independent human review decision was appended without changing media or proof authority.",
    );
    this.reviewDecisionsById.set(expected.id, expected);
    this.reviewDecisionIdByTaskId.set(task.id, expected.id);
  }

  private replayCustodyEvent(expected: CanopyProofEvidenceMediaCustodyEventFact) {
    const sourceRoot = this.resolveArtifactRoot(expected.artifactType, expected.artifactId);
    const custodian = normalizeHumanActor(expected.custodian);
    const seed = custodyFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-media-custody-command-v1",
      ...custodyCommandSeed(expected),
    });
    const custodyHash = hashJson({ kind: "canopyproof-evidence-media-custody-v1", ...seed });
    const custodyRoot = custodyRootFor(expected, custodyHash);
    const expectedAction =
      expected.action === "review_opened"
        ? "REASON"
        : expected.action === "review_assigned"
          ? "DELEGATE"
          : reviewDecisionAction(this.getReviewDecision(expected.artifactId).decision);
    if (
      sourceRoot !== expected.sourceRoot ||
      custodian.id !== expected.custodianId ||
      expected.previousCustodyRoot !== this.latestCustodyRoot(expected.evidenceId) ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_media_custody_${commandHash.slice(0, 24)}` ||
      custodyHash !== expected.custodyHash ||
      custodyRoot !== expected.custodyRoot
    ) {
      throw new Error(`CanopyProof evidence media custody lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      expectedAction,
      "evidence_media_custody_event",
      { factType: expected.factType, ...seed, custodyHash, custodyRoot, safety: expected.safety },
      "An exact-source, previous-root-linked media custody event was appended.",
    );
    this.custodyEventsById.set(expected.id, expected);
    this.custodyEventIdsByEvidenceId.set(expected.evidenceId, [
      ...(this.custodyEventIdsByEvidenceId.get(expected.evidenceId) ?? []),
      expected.id,
    ]);
  }

  private assertReplayEvent(
    fact: CanopyProofEvidenceMediaReviewTaskFact | CanopyProofEvidenceMediaReviewAssignmentFact |
      CanopyProofEvidenceMediaReviewDecisionFact | CanopyProofEvidenceMediaCustodyEventFact,
    action: CanopyProofAuditEvent["action"],
    entityType: CanopyProofAuditEvent["entityType"],
    payload: unknown,
    rationale: string,
  ) {
    if (hashJson(fact.safety) !== hashJson(canopyProofEvidenceMediaReviewSafetyBoundary())) {
      throw new Error(`CanopyProof evidence media review safety boundary is invalid: ${fact.id}`);
    }
    const index = fact.evidenceSequence - 1;
    const streamEvent = this.streamEvents[index];
    if (!streamEvent || hashJson(streamEvent) !== hashJson(fact.auditEvent)) {
      throw new Error(`CanopyProof evidence media review event position is invalid: ${fact.id}`);
    }
    const prefix = this.streamEvents.slice(0, index);
    const replayed = appendCanopyProofAuditEvent(prefix, {
      action,
      actor: fact.auditEvent.actor,
      entityType,
      entityId: fact.id,
      payload,
      createdAt: fact.auditEvent.createdAt,
      rationale,
    }).at(-1)!;
    if (hashJson(replayed) !== hashJson(fact.auditEvent)) {
      throw new Error(`CanopyProof evidence media review semantic event is invalid: ${fact.id}`);
    }
  }

  private appendEvent(input: Parameters<typeof appendCanopyProofAuditEvent>[1]) {
    const event = appendCanopyProofAuditEvent(this.streamEvents, input).at(-1)!;
    this.streamEvents = [...this.streamEvents, event];
    return event;
  }

  private nextLineage() {
    return {
      evidenceSequence: this.streamEvents.length + 1,
      previousEventRoot: this.streamEvents.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    };
  }

  private tasksForObject(objectId: string) {
    return (this.reviewTaskIdsByObjectId.get(objectId) ?? [])
      .map((id) => this.getReviewTask(id))
      .sort((left, right) => left.reviewRound - right.reviewRound || left.id.localeCompare(right.id));
  }

  private latestCustodyRoot(evidenceId: string) {
    const ids = this.custodyEventIdsByEvidenceId.get(evidenceId) ?? [];
    const latest = ids.map((id) => this.getCustodyEvent(id)).sort((left, right) =>
      right.evidenceSequence - left.evidenceSequence || right.id.localeCompare(left.id))[0];
    return latest?.custodyRoot ?? hashJson({ kind: "canopyproof-evidence-media-custody-genesis-v1", evidenceId });
  }

  private requireCustodyForArtifact(artifactType: CanopyProofEvidenceMediaCustodyArtifactType, artifactId: string) {
    const fact = [...this.custodyEventsById.values()].find(
      (candidate) => candidate.artifactType === artifactType && candidate.artifactId === artifactId,
    );
    if (!fact) throw new Error(`CanopyProof evidence media custody event not found for artifact: ${artifactId}`);
    return fact;
  }

  private resolveArtifactRoot(artifactType: CanopyProofEvidenceMediaCustodyArtifactType, artifactId: string) {
    if (artifactType === "media_review_task") return this.getReviewTask(artifactId).taskRoot;
    if (artifactType === "media_review_assignment") return this.getReviewAssignment(artifactId).assignmentRoot;
    return this.getReviewDecision(artifactId).decisionRoot;
  }
}

export function canopyProofEvidenceMediaReviewSafetyBoundary(): CanopyProofEvidenceMediaReviewSafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    mediaObjectBound: true,
    mediaProjectionBound: true,
    semanticEventBound: true,
    independentAccreditedHumanReviewerRequired: true,
    reviewCannotOverrideProviderVerification: true,
    custodyPreviousRootLinked: true,
    noRawRationale: true,
    noProviderCredential: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function normalizeHumanActor(input: CanopyProofVerificationActorSnapshot) {
  const parsed = actorSchema.parse(input);
  const accreditationScope = canonicalStrings(parsed.accreditationScope, "review actor accreditation scope");
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    membershipId: parsed.membershipId,
    membershipStatus: parsed.membershipStatus,
    membershipRoot: normalizeHash(parsed.membershipRoot),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: normalizeHash(parsed.accreditationRoot) } : {}),
    accreditationScope,
  } as const;
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (authorityRoot !== normalizeHash(parsed.authorityRoot)) {
    throw new Error("CanopyProof evidence media review actor authority root is invalid.");
  }
  return { ...normalized, authorityRoot } satisfies CanopyProofVerificationActorSnapshot;
}

function assertAccreditedReviewer(actor: CanopyProofVerificationActorSnapshot, organizationId: string) {
  assertActorOrganization(actor, organizationId);
  if (
    actor.role !== "verifier" ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes("evidence_media_review")
  ) {
    throw new Error("CanopyProof evidence media review requires an accredited human verifier.");
  }
}

function assertActorOrganization(actor: CanopyProofVerificationActorSnapshot, organizationId: string) {
  if (actor.organizationId !== organizationId) {
    throw new Error("CanopyProof evidence media review actor organization mismatch.");
  }
}

function assertMediaReviewSource(
  objectId: string,
  intent: CanopyProofEvidenceMediaUploadIntentFact,
  object: CanopyProofEvidenceMediaObjectFact,
  projection: CanopyProofEvidenceMediaObjectProjection,
  evaluatedAt: string,
) {
  if (
    object.id !== objectId ||
    object.intentId !== intent.id ||
    object.evidenceId !== intent.evidenceId ||
    object.organizationId !== intent.organizationId ||
    projection.objectId !== object.id ||
    projection.objectRoot !== object.objectRoot ||
    projection.organizationId !== object.organizationId ||
    projection.projectId !== object.projectId ||
    projection.evidenceId !== object.evidenceId ||
    projection.evaluatedAt !== evaluatedAt
  ) {
    throw new Error("CanopyProof evidence media review source authority mismatch.");
  }
}

function assertReviewProjection(
  task: CanopyProofEvidenceMediaReviewTaskFact,
  projection: CanopyProofEvidenceMediaObjectProjection,
  evaluatedAt: string,
) {
  if (
    projection.objectId !== task.objectId ||
    projection.organizationId !== task.organizationId ||
    projection.projectId !== task.projectId ||
    projection.evidenceId !== task.evidenceId ||
    projection.evaluatedAt !== evaluatedAt
  ) {
    throw new Error("CanopyProof evidence media review decision projection mismatch.");
  }
}

function reviewDecisionAction(decision: CanopyProofEvidenceMediaReviewDecision): CanopyProofAuditEvent["action"] {
  return decision === "accept_for_processing" || decision === "retain_non_final" ? "FULFILL" : "CHALLENGE";
}

function custodyNoteHash(action: CanopyProofEvidenceMediaCustodyAction) {
  return hashJson({
    kind: "canopyproof-evidence-media-custody-note-v1",
    value:
      action === "review_opened"
        ? "review task opened against exact media authority"
        : action === "review_assigned"
          ? "independent accredited reviewer assigned"
          : "independent review decision appended without authority promotion",
  });
}

function reviewTaskCommandSeed(fact: CanopyProofEvidenceMediaReviewTaskFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    objectId: fact.objectId,
    objectRoot: fact.objectRoot,
    mediaProjectionState: fact.mediaProjectionState,
    mediaProjectionRoot: fact.mediaProjectionRoot,
    contributorId: fact.contributorId,
    reviewRound: fact.reviewRound,
    previousReviewTaskRoot: fact.previousReviewTaskRoot,
    reasonCodes: fact.reasonCodes,
    severity: fact.severity,
    policyId: fact.policyId,
    openedBy: fact.openedBy,
    opener: fact.opener,
    openedAt: fact.openedAt,
    dueAt: fact.dueAt,
  };
}

function reviewTaskFactSeed(fact: CanopyProofEvidenceMediaReviewTaskFact) {
  return {
    id: fact.id,
    ...reviewTaskCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function reviewTaskRoot(fact: CanopyProofEvidenceMediaReviewTaskFact, taskHash: string) {
  return hashJson({
    kind: "canopyproof-evidence-media-review-task-root-v1",
    objectRoot: fact.objectRoot,
    mediaProjectionRoot: fact.mediaProjectionRoot,
    contributorId: fact.contributorId,
    reviewRound: fact.reviewRound,
    previousReviewTaskRoot: fact.previousReviewTaskRoot,
    commandHash: fact.commandHash,
    taskHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function reviewAssignmentCommandSeed(fact: CanopyProofEvidenceMediaReviewAssignmentFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    objectId: fact.objectId,
    taskId: fact.taskId,
    taskRoot: fact.taskRoot,
    contributorId: fact.contributorId,
    reviewerId: fact.reviewerId,
    reviewer: fact.reviewer,
    assignedBy: fact.assignedBy,
    assigner: fact.assigner,
    assignedAt: fact.assignedAt,
  };
}

function reviewAssignmentFactSeed(fact: CanopyProofEvidenceMediaReviewAssignmentFact) {
  return {
    id: fact.id,
    ...reviewAssignmentCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function reviewAssignmentRoot(fact: CanopyProofEvidenceMediaReviewAssignmentFact, assignmentHash: string) {
  return hashJson({
    kind: "canopyproof-evidence-media-review-assignment-root-v1",
    taskRoot: fact.taskRoot,
    reviewerAuthorityRoot: fact.reviewer.authorityRoot,
    assignerAuthorityRoot: fact.assigner.authorityRoot,
    commandHash: fact.commandHash,
    assignmentHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function reviewDecisionCommandSeed(fact: CanopyProofEvidenceMediaReviewDecisionFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    objectId: fact.objectId,
    taskId: fact.taskId,
    taskRoot: fact.taskRoot,
    assignmentId: fact.assignmentId,
    assignmentRoot: fact.assignmentRoot,
    mediaProjectionState: fact.mediaProjectionState,
    mediaProjectionRoot: fact.mediaProjectionRoot,
    reviewerId: fact.reviewerId,
    reviewer: fact.reviewer,
    decision: fact.decision,
    rationaleHash: fact.rationaleHash,
    limitationHashes: fact.limitationHashes,
    decidedAt: fact.decidedAt,
  };
}

function reviewDecisionFactSeed(fact: CanopyProofEvidenceMediaReviewDecisionFact) {
  return {
    id: fact.id,
    ...reviewDecisionCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function reviewDecisionRoot(fact: CanopyProofEvidenceMediaReviewDecisionFact, decisionHash: string) {
  return hashJson({
    kind: "canopyproof-evidence-media-review-decision-root-v1",
    taskRoot: fact.taskRoot,
    assignmentRoot: fact.assignmentRoot,
    mediaProjectionRoot: fact.mediaProjectionRoot,
    reviewerAuthorityRoot: fact.reviewer.authorityRoot,
    decision: fact.decision,
    commandHash: fact.commandHash,
    decisionHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function custodyCommandSeed(fact: CanopyProofEvidenceMediaCustodyEventFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    action: fact.action,
    artifactType: fact.artifactType,
    artifactId: fact.artifactId,
    sourceRoot: fact.sourceRoot,
    custodianId: fact.custodianId,
    custodian: fact.custodian,
    custodyNoteHash: fact.custodyNoteHash,
    policyId: fact.policyId,
    occurredAt: fact.occurredAt,
    previousCustodyRoot: fact.previousCustodyRoot,
  };
}

function custodyFactSeed(fact: CanopyProofEvidenceMediaCustodyEventFact) {
  return {
    id: fact.id,
    ...custodyCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function custodyRootFor(fact: CanopyProofEvidenceMediaCustodyEventFact, custodyHash: string) {
  return hashJson({
    kind: "canopyproof-evidence-media-custody-root-v1",
    evidenceId: fact.evidenceId,
    action: fact.action,
    sourceRoot: fact.sourceRoot,
    custodianAuthorityRoot: fact.custodian.authorityRoot,
    previousCustodyRoot: fact.previousCustodyRoot,
    commandHash: fact.commandHash,
    custodyHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function validateStreamEvents(events: readonly CanopyProofAuditEvent[]) {
  const copy = [...events];
  const terminal = copy.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(copy, terminal.createdAt).valid) {
    throw new Error("CanopyProof evidence media review stream is invalid.");
  }
  return copy;
}

function canonicalStrings(values: readonly string[], label: string) {
  const normalized = [...new Set(values.map((value) => value.trim()))].sort();
  if (normalized.length !== values.length || normalized.some((value) => value.length === 0)) {
    throw new Error(`CanopyProof evidence media ${label} must be sorted and unique.`);
  }
  return normalized;
}

function canonicalHashes(values: readonly string[]) {
  return [...new Set(values.map(normalizeHash))].sort();
}

function normalizeHash(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function sortedFacts<T extends { readonly evidenceSequence: number; readonly id: string }>(values: Iterable<T>) {
  return [...values].sort(
    (left, right) => left.evidenceSequence - right.evidenceSequence || left.id.localeCompare(right.id),
  );
}
