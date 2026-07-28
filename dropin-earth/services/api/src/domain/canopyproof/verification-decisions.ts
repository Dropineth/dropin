import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofVerificationDecisionSubjectTypes = ["evidence", "proof_record", "project", "reporting_package", "terra_scene"] as const;
export const canopyProofVerificationDecisionKinds = ["approve", "reject", "challenge", "request_changes"] as const;
export const canopyProofVerificationDecisionReviewerRoles = ["owner", "admin", "verifier", "researcher"] as const;
export const canopyProofVerificationQualityGateStates = ["pass", "needs_review", "blocked"] as const;

export type CanopyProofVerificationDecisionSubjectType = (typeof canopyProofVerificationDecisionSubjectTypes)[number];
export type CanopyProofVerificationDecisionKind = (typeof canopyProofVerificationDecisionKinds)[number];
export type CanopyProofVerificationDecisionReviewerRole = (typeof canopyProofVerificationDecisionReviewerRoles)[number];
export type CanopyProofVerificationQualityGateState = (typeof canopyProofVerificationQualityGateStates)[number];

export type CanopyProofVerificationDecisionDossier = {
  readonly id: string;
  readonly subjectType: CanopyProofVerificationDecisionSubjectType;
  readonly subjectId: string;
  readonly decision: CanopyProofVerificationDecisionKind;
  readonly reviewer: string;
  readonly reviewerRole: CanopyProofVerificationDecisionReviewerRole;
  readonly evidenceIds: readonly string[];
  readonly aiAnalysisIds: readonly string[];
  readonly terraSceneIds: readonly string[];
  readonly qualityScorecardIds: readonly string[];
  readonly humanReviewWorkItemIds: readonly string[];
  readonly governanceApprovalIds: readonly string[];
  readonly auditEventRoots: readonly string[];
  readonly qualityGateState: CanopyProofVerificationQualityGateState;
  readonly sourceRoot: string;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly decisionHash: string;
  readonly decidedAt: string;
  readonly safety: {
    readonly accountableHumanReviewerRequired: true;
    readonly aiAdvisoryOnly: true;
    readonly qualityBlockedCannotApprove: true;
    readonly governanceStillRequiredForProofIssuance: true;
    readonly noCarbonCreditAuthority: true;
    readonly noFinancialOrTaxAuthority: true;
    readonly noAutomaticTokenDistribution: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofVerificationDecisionStatus = {
  readonly service: "canopyproof-verification-decisions";
  readonly decisionCount: number;
  readonly approvedCount: number;
  readonly challengedCount: number;
  readonly rejectedCount: number;
  readonly requestChangesCount: number;
  readonly subjectTypes: readonly CanopyProofVerificationDecisionSubjectType[];
  readonly decisions: readonly CanopyProofVerificationDecisionKind[];
  readonly safety: {
    readonly humanInTheLoop: true;
    readonly aiNeverFinalAuthority: true;
    readonly appendOnlyDecisionDossiers: true;
    readonly noFinancialOrCarbonCreditAuthority: true;
  };
  readonly decisionRoot: string;
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const decisionDossierSchema = z
  .object({
    id: z.string().min(1).optional(),
    subjectType: z.enum(canopyProofVerificationDecisionSubjectTypes),
    subjectId: z.string().min(1),
    decision: z.enum(canopyProofVerificationDecisionKinds),
    evidenceIds: z.array(z.string().min(1)).default([]),
    aiAnalysisIds: z.array(z.string().min(1)).default([]),
    terraSceneIds: z.array(z.string().min(1)).default([]),
    qualityScorecardIds: z.array(z.string().min(1)).default([]),
    humanReviewWorkItemIds: z.array(z.string().min(1)).default([]),
    governanceApprovalIds: z.array(z.string().min(1)).default([]),
    auditEventRoots: z.array(sha256Schema).min(1),
    qualityGateState: z.enum(canopyProofVerificationQualityGateStates),
    rationale: z.string().min(20).max(2_000),
    limitations: z.array(z.string().min(12).max(1_000)).default([]),
    decidedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofVerificationDecisionService {
  private readonly decisionsById = new Map<string, CanopyProofVerificationDecisionDossier>();

  createDecisionDossier(input: unknown, reviewer: string, reviewerRole: CanopyProofVerificationDecisionReviewerRole) {
    const parsed = decisionDossierSchema.parse(input);
    const decidedAt = parsed.decidedAt ?? new Date(0).toISOString();
    const evidenceIds = normalizeIds(parsed.evidenceIds);
    const aiAnalysisIds = normalizeIds(parsed.aiAnalysisIds);
    const terraSceneIds = normalizeIds(parsed.terraSceneIds);
    const qualityScorecardIds = normalizeIds(parsed.qualityScorecardIds);
    const humanReviewWorkItemIds = normalizeIds(parsed.humanReviewWorkItemIds);
    const governanceApprovalIds = normalizeIds(parsed.governanceApprovalIds);
    const auditEventRoots = [...new Set(parsed.auditEventRoots.map(normalizeSha256))].sort();
    const limitations = [...parsed.limitations].sort();

    assertSafeDecisionText([parsed.subjectId, parsed.rationale, ...limitations]);
    assertDecisionSafety({
      decision: parsed.decision,
      qualityGateState: parsed.qualityGateState,
      evidenceIds,
      aiAnalysisIds,
      qualityScorecardIds,
      humanReviewWorkItemIds,
      auditEventRoots,
      reviewerRole,
    });

    const sourceRoot = merkleRoot(
      [
        ...auditEventRoots,
        ...evidenceIds.map((id) => hashJson({ kind: "evidence-id", id })),
        ...aiAnalysisIds.map((id) => hashJson({ kind: "ai-analysis-id", id })),
        ...terraSceneIds.map((id) => hashJson({ kind: "terra-scene-id", id })),
        ...qualityScorecardIds.map((id) => hashJson({ kind: "quality-scorecard-id", id })),
        ...humanReviewWorkItemIds.map((id) => hashJson({ kind: "human-review-work-item-id", id })),
        ...governanceApprovalIds.map((id) => hashJson({ kind: "governance-approval-id", id })),
      ].sort(),
    );
    const decisionSeed = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      decision: parsed.decision,
      reviewer,
      reviewerRole,
      evidenceIds,
      aiAnalysisIds,
      terraSceneIds,
      qualityScorecardIds,
      humanReviewWorkItemIds,
      governanceApprovalIds,
      auditEventRoots,
      qualityGateState: parsed.qualityGateState,
      sourceRoot,
      rationale: parsed.rationale,
      limitations,
      decidedAt,
      safety: decisionDossierSafety(),
    };
    const decisionHash = hashJson({ kind: "canopyproof-verification-decision-dossier-v1", dossier: decisionSeed });
    const id = parsed.id ?? `cp_verification_decision_${decisionHash.slice(0, 24)}`;
    if (this.decisionsById.has(id)) {
      throw new Error(`CanopyProof verification decision already exists: ${id}`);
    }
    const auditEvent = appendCanopyProofAuditEvent([...this.decisionsById.values()].map((decision) => decision.auditEvent), {
      action: parsed.decision === "approve" ? "FULFILL" : parsed.decision === "request_changes" ? "REASON" : "CHALLENGE",
      actor: reviewer,
      entityType: "verification_decision",
      entityId: id,
      payload: {
        ...decisionSeed,
        decisionHash,
      },
      createdAt: decidedAt,
      rationale:
        parsed.decision === "approve"
          ? "Human verification decision dossier approved bounded reliance inputs without creating certificate or financial authority."
          : "Human verification decision dossier recorded non-approval outcome for institutional review.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof verification decision failed to append audit event.");
    }

    const dossier: CanopyProofVerificationDecisionDossier = {
      id,
      ...decisionSeed,
      decisionHash,
      auditEvent,
    };
    this.decisionsById.set(dossier.id, dossier);
    return dossier;
  }

  listDecisionDossiers(
    filter: Readonly<{
      subjectType?: CanopyProofVerificationDecisionSubjectType;
      subjectId?: string;
      decision?: CanopyProofVerificationDecisionKind;
    }> = {},
  ) {
    return [...this.decisionsById.values()]
      .filter((dossier) => !filter.subjectType || dossier.subjectType === filter.subjectType)
      .filter((dossier) => !filter.subjectId || dossier.subjectId === filter.subjectId)
      .filter((dossier) => !filter.decision || dossier.decision === filter.decision)
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt) || left.id.localeCompare(right.id));
  }

  getDecisionDossier(decisionId: string) {
    const decision = this.decisionsById.get(decisionId);
    if (!decision) {
      throw new Error(`CanopyProof verification decision not found: ${decisionId}`);
    }
    return decision;
  }

  getStatus(): CanopyProofVerificationDecisionStatus {
    const decisions = this.listDecisionDossiers();
    return {
      service: "canopyproof-verification-decisions",
      decisionCount: decisions.length,
      approvedCount: decisions.filter((dossier) => dossier.decision === "approve").length,
      challengedCount: decisions.filter((dossier) => dossier.decision === "challenge").length,
      rejectedCount: decisions.filter((dossier) => dossier.decision === "reject").length,
      requestChangesCount: decisions.filter((dossier) => dossier.decision === "request_changes").length,
      subjectTypes: canopyProofVerificationDecisionSubjectTypes,
      decisions: canopyProofVerificationDecisionKinds,
      safety: {
        humanInTheLoop: true,
        aiNeverFinalAuthority: true,
        appendOnlyDecisionDossiers: true,
        noFinancialOrCarbonCreditAuthority: true,
      },
      decisionRoot:
        decisions.length > 0
          ? merkleRoot(decisions.map((decision) => decision.decisionHash).sort())
          : hashJson({ kind: "canopyproof-empty-verification-decision-root-v1" }),
    };
  }
}

function assertDecisionSafety(input: Readonly<{
  decision: CanopyProofVerificationDecisionKind;
  qualityGateState: CanopyProofVerificationQualityGateState;
  evidenceIds: readonly string[];
  aiAnalysisIds: readonly string[];
  qualityScorecardIds: readonly string[];
  humanReviewWorkItemIds: readonly string[];
  auditEventRoots: readonly string[];
  reviewerRole: CanopyProofVerificationDecisionReviewerRole;
}>) {
  if (!canopyProofVerificationDecisionReviewerRoles.includes(input.reviewerRole)) {
    throw new Error("CANOPYPROOF_RBAC_DENIED: verification decisions require an accountable human reviewer role.");
  }
  if (input.decision === "approve") {
    if (input.qualityGateState === "blocked") {
      throw new Error("CanopyProof verification decision cannot approve a blocked quality gate.");
    }
    if (input.evidenceIds.length === 0) {
      throw new Error("CanopyProof approval decisions require evidence IDs.");
    }
    if (input.aiAnalysisIds.length === 0) {
      throw new Error("CanopyProof approval decisions require advisory AI analysis references.");
    }
    if (input.qualityScorecardIds.length === 0) {
      throw new Error("CanopyProof approval decisions require quality scorecard references.");
    }
    if (input.humanReviewWorkItemIds.length === 0) {
      throw new Error("CanopyProof approval decisions require completed human review work item references.");
    }
  }
  if (input.auditEventRoots.length === 0) {
    throw new Error("CanopyProof verification decisions require audit event roots.");
  }
}

function decisionDossierSafety(): CanopyProofVerificationDecisionDossier["safety"] {
  return {
    accountableHumanReviewerRequired: true,
    aiAdvisoryOnly: true,
    qualityBlockedCannotApprove: true,
    governanceStillRequiredForProofIssuance: true,
    noCarbonCreditAuthority: true,
    noFinancialOrTaxAuthority: true,
    noAutomaticTokenDistribution: true,
  };
}

function assertSafeDecisionText(values: readonly string[]) {
  const unsafeClaims = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]?tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+(?:\$?canopy|canopy)\s+distribution/i,
    /mainnet\s+funds/i,
  ] as const;
  for (const value of values) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited|excluded)\b/i.test(value)) {
        throw new Error(`CanopyProof verification decision contains unsupported public claim: ${value}`);
      }
    }
  }
}

function normalizeIds(ids: readonly string[]) {
  return [...new Set(ids)].sort();
}

function normalizeSha256(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}
