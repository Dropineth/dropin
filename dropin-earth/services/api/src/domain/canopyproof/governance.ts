import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofGovernanceSubjectTypes = [
  "organization",
  "project",
  "evidence",
  "proof_record",
  "esg_report",
  "funding_allocation",
  "risk_public_release",
  "risk_response_playbook",
] as const;

export const canopyProofGovernanceReviewerRoles = ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"] as const;
export const canopyProofGovernanceDecisionTypes = ["approve", "reject", "challenge"] as const;
export const canopyProofConflictSeverities = ["low", "medium", "high", "critical"] as const;
export const canopyProofConflictStatuses = ["open", "review_required", "cleared", "waived"] as const;

export type CanopyProofGovernanceSubjectType = (typeof canopyProofGovernanceSubjectTypes)[number];
export type CanopyProofGovernanceReviewerRole = (typeof canopyProofGovernanceReviewerRoles)[number];
export type CanopyProofGovernanceDecision = (typeof canopyProofGovernanceDecisionTypes)[number];
export type CanopyProofConflictSeverity = (typeof canopyProofConflictSeverities)[number];
export type CanopyProofConflictStatus = (typeof canopyProofConflictStatuses)[number];

export type CanopyProofGovernancePolicy = {
  readonly id: string;
  readonly title: string;
  readonly appliesTo: readonly CanopyProofGovernanceSubjectType[];
  readonly requiredApprovals: number;
  readonly allowedReviewerRoles: readonly CanopyProofGovernanceReviewerRole[];
  readonly humanAuthorityRequired: true;
  readonly conflictDisclosureRequired: true;
  readonly claimBoundaryEnforced: true;
  readonly createdAt: string;
  readonly policyHash: string;
};

export type CanopyProofGovernanceApproval = {
  readonly id: string;
  readonly subjectType: CanopyProofGovernanceSubjectType;
  readonly subjectId: string;
  readonly policyId: string;
  readonly reviewer: string;
  readonly reviewerRole: CanopyProofGovernanceReviewerRole;
  readonly decision: CanopyProofGovernanceDecision;
  readonly rationale: string;
  readonly conflictDisclosure: string;
  readonly decidedAt: string;
  readonly approvalHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofConflictDisclosure = {
  readonly id: string;
  readonly subjectType: CanopyProofGovernanceSubjectType;
  readonly subjectId: string;
  readonly actorId: string;
  readonly severity: CanopyProofConflictSeverity;
  readonly status: CanopyProofConflictStatus;
  readonly disclosure: string;
  readonly recordedAt: string;
  readonly disclosureHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofGovernanceStatus = {
  readonly service: "canopyproof-governance";
  readonly policyCount: number;
  readonly approvalCount: number;
  readonly conflictDisclosureCount: number;
  readonly unresolvedConflictCount: number;
  readonly safety: {
    readonly humanAuthorityRequired: true;
    readonly conflictDisclosureRequired: true;
    readonly aiIsNeverFinalAuthority: true;
    readonly publicClaimsBounded: true;
  };
  readonly governanceRoot: string;
};

const governanceApprovalSchema = z
  .object({
    id: z.string().min(1).optional(),
    subjectType: z.enum(canopyProofGovernanceSubjectTypes),
    subjectId: z.string().min(1),
    policyId: z.string().min(1),
    decision: z.enum(canopyProofGovernanceDecisionTypes),
    rationale: z.string().min(12),
    conflictDisclosure: z.string().min(8).default("No known conflict disclosed."),
    decidedAt: z.string().datetime().optional(),
  })
  .strict();

const conflictDisclosureSchema = z
  .object({
    id: z.string().min(1).optional(),
    subjectType: z.enum(canopyProofGovernanceSubjectTypes),
    subjectId: z.string().min(1),
    severity: z.enum(canopyProofConflictSeverities),
    status: z.enum(canopyProofConflictStatuses).default("open"),
    disclosure: z.string().min(12),
    recordedAt: z.string().datetime().optional(),
  })
  .strict();

export function buildCanopyProofProofRecordSubjectId(input: Readonly<{ projectId: string; evidenceIds: readonly string[] }>) {
  const evidenceIds = [...input.evidenceIds].sort();
  return `proof_record:${input.projectId}:${hashJson({ kind: "canopyproof-proof-record-subject-v1", evidenceIds }).slice(0, 24)}`;
}

export class CanopyProofGovernanceService {
  private readonly policiesById = new Map<string, CanopyProofGovernancePolicy>(buildDefaultPolicies().map((policy) => [policy.id, policy]));
  private readonly approvalsById = new Map<string, CanopyProofGovernanceApproval>();
  private readonly conflictDisclosuresById = new Map<string, CanopyProofConflictDisclosure>();

  listPolicies(subjectType?: string) {
    const policies = [...this.policiesById.values()].sort((left, right) => left.id.localeCompare(right.id));
    if (!subjectType) return policies;
    if (!canopyProofGovernanceSubjectTypes.includes(subjectType as CanopyProofGovernanceSubjectType)) {
      throw new Error(`Unsupported CanopyProof governance subject type: ${subjectType}`);
    }
    return policies.filter((policy) => policy.appliesTo.includes(subjectType as CanopyProofGovernanceSubjectType));
  }

  getPolicy(policyId: string) {
    const policy = this.policiesById.get(policyId);
    if (!policy) {
      throw new Error(`CanopyProof governance policy not found: ${policyId}`);
    }
    return policy;
  }

  createApproval(input: unknown, reviewer: string, reviewerRole: CanopyProofGovernanceReviewerRole) {
    const parsed = governanceApprovalSchema.parse(input);
    const policy = this.getPolicy(parsed.policyId);
    assertReviewerCanApprove(policy, reviewerRole);
    assertPolicyApplies(policy, parsed.subjectType);
    assertSafeGovernanceText([parsed.subjectId, parsed.rationale, parsed.conflictDisclosure]);

    const decidedAt = parsed.decidedAt ?? new Date(0).toISOString();
    const approvalSeed = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      policyId: policy.id,
      reviewer,
      reviewerRole,
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      decidedAt,
    };
    const approvalHash = hashJson({ kind: "canopyproof-governance-approval-v1", ...approvalSeed });
    const id = parsed.id ?? `cp_governance_approval_${approvalHash.slice(0, 24)}`;
    if (this.approvalsById.has(id)) {
      throw new Error(`CanopyProof governance approval already exists: ${id}`);
    }
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: parsed.decision === "approve" ? "FULFILL" : "CHALLENGE",
      actor: reviewer,
      entityType: "governance_approval",
      entityId: id,
      payload: approvalSeed,
      createdAt: decidedAt,
      rationale: "Governance approval decision recorded with reviewer role, policy binding, and conflict disclosure.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof governance approval failed to append audit event.");
    }
    const approval: CanopyProofGovernanceApproval = {
      id,
      ...approvalSeed,
      approvalHash,
      auditEvent,
    };
    this.approvalsById.set(approval.id, approval);
    return approval;
  }

  listApprovals(filter: Readonly<{ subjectType?: string; subjectId?: string; policyId?: string }> = {}) {
    return [...this.approvalsById.values()]
      .filter((approval) => !filter.subjectType || approval.subjectType === filter.subjectType)
      .filter((approval) => !filter.subjectId || approval.subjectId === filter.subjectId)
      .filter((approval) => !filter.policyId || approval.policyId === filter.policyId)
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt) || left.id.localeCompare(right.id));
  }

  getApproval(approvalId: string) {
    const approval = this.approvalsById.get(approvalId);
    if (!approval) {
      throw new Error(`CanopyProof governance approval not found: ${approvalId}`);
    }
    return approval;
  }

  validateApprovalReferences(input: Readonly<{
    subjectType: CanopyProofGovernanceSubjectType;
    subjectId: string;
    approvalIds: readonly string[];
  }>) {
    const approvalIds = [...new Set(input.approvalIds)];
    if (approvalIds.length === 0) {
      throw new Error("CanopyProof governance approval reference is required.");
    }

    const approvals = approvalIds.map((approvalId) => this.getApproval(approvalId));
    const approvalsByPolicy = new Map<string, CanopyProofGovernanceApproval[]>();
    for (const approval of approvals) {
      if (approval.subjectType !== input.subjectType || approval.subjectId !== input.subjectId) {
        throw new Error(
          `CanopyProof governance approval ${approval.id} is bound to ${approval.subjectType}:${approval.subjectId}, not ${input.subjectType}:${input.subjectId}.`,
        );
      }
      if (approval.decision !== "approve") {
        throw new Error(`CanopyProof governance approval ${approval.id} is not approved: ${approval.decision}.`);
      }
      const policy = this.getPolicy(approval.policyId);
      assertPolicyApplies(policy, input.subjectType);
      assertReviewerCanApprove(policy, approval.reviewerRole);
      approvalsByPolicy.set(policy.id, [...(approvalsByPolicy.get(policy.id) ?? []), approval]);
    }

    const unresolvedConflicts = this.listConflictDisclosures({ subjectType: input.subjectType, subjectId: input.subjectId }).filter(
      (disclosure) => disclosure.status !== "cleared" && disclosure.status !== "waived",
    );
    if (unresolvedConflicts.length > 0) {
      throw new Error(`CanopyProof governance subject has unresolved conflict disclosures: ${unresolvedConflicts.map((item) => item.id).join(",")}`);
    }

    for (const [policyId, policyApprovals] of approvalsByPolicy) {
      const policy = this.getPolicy(policyId);
      const uniqueReviewers = new Set(policyApprovals.map((approval) => approval.reviewer));
      if (uniqueReviewers.size < policy.requiredApprovals) {
        throw new Error(`CanopyProof governance policy ${policy.id} requires ${policy.requiredApprovals} unique approval(s).`);
      }
    }

    return approvals;
  }

  recordConflictDisclosure(input: unknown, actorId: string) {
    const parsed = conflictDisclosureSchema.parse(input);
    assertSafeGovernanceText([parsed.subjectId, parsed.disclosure]);
    const recordedAt = parsed.recordedAt ?? new Date(0).toISOString();
    const disclosureSeed = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      actorId,
      severity: parsed.severity,
      status: parsed.status,
      disclosure: parsed.disclosure,
      recordedAt,
    };
    const disclosureHash = hashJson({ kind: "canopyproof-conflict-disclosure-v1", ...disclosureSeed });
    const id = parsed.id ?? `cp_conflict_${disclosureHash.slice(0, 24)}`;
    if (this.conflictDisclosuresById.has(id)) {
      throw new Error(`CanopyProof conflict disclosure already exists: ${id}`);
    }
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: parsed.status === "cleared" || parsed.status === "waived" ? "FULFILL" : "CHALLENGE",
      actor: actorId,
      entityType: "conflict_disclosure",
      entityId: id,
      payload: disclosureSeed,
      createdAt: recordedAt,
      rationale: "Conflict disclosure recorded for governance review before public environmental accountability action.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof conflict disclosure failed to append audit event.");
    }
    const disclosure: CanopyProofConflictDisclosure = {
      id,
      ...disclosureSeed,
      disclosureHash,
      auditEvent,
    };
    this.conflictDisclosuresById.set(disclosure.id, disclosure);
    return disclosure;
  }

  listConflictDisclosures(filter: Readonly<{ subjectType?: string; subjectId?: string; actorId?: string }> = {}) {
    return [...this.conflictDisclosuresById.values()]
      .filter((disclosure) => !filter.subjectType || disclosure.subjectType === filter.subjectType)
      .filter((disclosure) => !filter.subjectId || disclosure.subjectId === filter.subjectId)
      .filter((disclosure) => !filter.actorId || disclosure.actorId === filter.actorId)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.id.localeCompare(right.id));
  }

  getStatus(): CanopyProofGovernanceStatus {
    const policies = [...this.policiesById.values()];
    const approvals = [...this.approvalsById.values()];
    const disclosures = [...this.conflictDisclosuresById.values()];
    const unresolvedConflictCount = disclosures.filter((disclosure) => disclosure.status !== "cleared" && disclosure.status !== "waived").length;
    return {
      service: "canopyproof-governance",
      policyCount: policies.length,
      approvalCount: approvals.length,
      conflictDisclosureCount: disclosures.length,
      unresolvedConflictCount,
      safety: {
        humanAuthorityRequired: true,
        conflictDisclosureRequired: true,
        aiIsNeverFinalAuthority: true,
        publicClaimsBounded: true,
      },
      governanceRoot: hashJson({
        kind: "canopyproof-governance-status-v1",
        policyRoot: merkleRoot(policies.map((policy) => policy.policyHash).sort()),
        approvalRoot: merkleRoot(approvals.map((approval) => approval.approvalHash).sort()),
        conflictRoot: merkleRoot(disclosures.map((disclosure) => disclosure.disclosureHash).sort()),
      }),
    };
  }
}

function buildDefaultPolicies(): readonly CanopyProofGovernancePolicy[] {
  return [
    buildPolicy({
      id: "canopyproof_policy_proof_record_issuance_v1",
      title: "Environmental Proof Record issuance",
      appliesTo: ["proof_record"],
      requiredApprovals: 1,
      allowedReviewerRoles: ["owner", "admin", "verifier"],
    }),
    buildPolicy({
      id: "canopyproof_policy_esg_publication_v1",
      title: "Institutional ESG publication",
      appliesTo: ["esg_report"],
      requiredApprovals: 1,
      allowedReviewerRoles: ["owner", "admin", "researcher", "verifier"],
    }),
    buildPolicy({
      id: "canopyproof_policy_funding_allocation_v1",
      title: "Funding transparency allocation",
      appliesTo: ["funding_allocation"],
      requiredApprovals: 1,
      allowedReviewerRoles: ["owner", "admin"],
    }),
    buildPolicy({
      id: "canopyproof_policy_public_risk_release_v1",
      title: "Public early-warning release",
      appliesTo: ["risk_public_release"],
      requiredApprovals: 1,
      allowedReviewerRoles: ["owner", "admin", "verifier", "researcher"],
    }),
    buildPolicy({
      id: "canopyproof_policy_risk_response_playbook_v1",
      title: "Early-warning response playbook governance",
      appliesTo: ["risk_response_playbook"],
      requiredApprovals: 1,
      allowedReviewerRoles: ["owner", "admin", "verifier", "researcher"],
    }),
    buildPolicy({
      id: "canopyproof_policy_partner_onboarding_v1",
      title: "Institutional partner onboarding",
      appliesTo: ["organization", "project"],
      requiredApprovals: 1,
      allowedReviewerRoles: ["owner", "admin"],
    }),
  ] as const;
}

function buildPolicy(input: Readonly<{
  id: string;
  title: string;
  appliesTo: readonly CanopyProofGovernanceSubjectType[];
  requiredApprovals: number;
  allowedReviewerRoles: readonly CanopyProofGovernanceReviewerRole[];
}>): CanopyProofGovernancePolicy {
  const createdAt = new Date(0).toISOString();
  const policySeed = {
    ...input,
    humanAuthorityRequired: true as const,
    conflictDisclosureRequired: true as const,
    claimBoundaryEnforced: true as const,
    createdAt,
  };
  return {
    ...policySeed,
    policyHash: hashJson({ kind: "canopyproof-governance-policy-v1", ...policySeed }),
  };
}

function assertPolicyApplies(policy: CanopyProofGovernancePolicy, subjectType: CanopyProofGovernanceSubjectType) {
  if (!policy.appliesTo.includes(subjectType)) {
    throw new Error(`CanopyProof governance policy ${policy.id} does not apply to ${subjectType}.`);
  }
}

function assertReviewerCanApprove(policy: CanopyProofGovernancePolicy, reviewerRole: CanopyProofGovernanceReviewerRole) {
  if (!policy.allowedReviewerRoles.includes(reviewerRole)) {
    throw new Error(`CANOPYPROOF_RBAC_DENIED: role ${reviewerRole} cannot approve policy ${policy.id}.`);
  }
}

function assertSafeGovernanceText(values: readonly string[]) {
  const unsafeClaims = [
    /certified carbon credit/i,
    /carbon[- ]?tax offset/i,
    /guaranteed yield/i,
    /automatic CANOPY distribution/i,
    /mainnet funds/i,
  ] as const;
  for (const value of values) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited)\b/i.test(value)) {
        throw new Error("CanopyProof governance text contains an unsupported public claim.");
      }
    }
  }
}
