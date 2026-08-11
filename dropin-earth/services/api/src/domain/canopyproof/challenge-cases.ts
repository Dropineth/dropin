import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofChallengeCaseSubjectTypes = [
  "evidence",
  "proof_record",
  "project",
  "quality_scorecard",
  "verification_decision",
  "methodology",
  "terra_scene",
  "reporting_package",
  "funding_allocation",
] as const;
export const canopyProofChallengeCaseReasons = [
  "fake_evidence",
  "duplicate_planting",
  "gps_spoofing",
  "satellite_contradiction",
  "methodology_gap",
  "audit_gap",
  "privacy_risk",
  "governance_conflict",
  "unsafe_claim",
  "other",
] as const;
export const canopyProofChallengeCaseSeverities = ["low", "medium", "high", "critical"] as const;
export const canopyProofChallengeCaseStatuses = ["open", "under_review", "accepted", "rejected", "needs_more_evidence", "withdrawn"] as const;
export const canopyProofChallengeResolutionDecisions = ["accept", "reject", "request_more_evidence", "withdraw"] as const;
export const canopyProofChallengeEvidenceTypes = [
  "media_hash",
  "gps_hash",
  "device_attestation",
  "satellite_scene",
  "quality_scorecard",
  "audit_root",
  "governance_record",
  "document_hash",
  "other",
] as const;

export type CanopyProofChallengeCaseSubjectType = (typeof canopyProofChallengeCaseSubjectTypes)[number];
export type CanopyProofChallengeCaseReason = (typeof canopyProofChallengeCaseReasons)[number];
export type CanopyProofChallengeCaseSeverity = (typeof canopyProofChallengeCaseSeverities)[number];
export type CanopyProofChallengeCaseStatus = (typeof canopyProofChallengeCaseStatuses)[number];
export type CanopyProofChallengeResolutionDecision = (typeof canopyProofChallengeResolutionDecisions)[number];
export type CanopyProofChallengeEvidenceType = (typeof canopyProofChallengeEvidenceTypes)[number];

export type CanopyProofChallengeEvidence = {
  readonly id: string;
  readonly evidenceType: CanopyProofChallengeEvidenceType;
  readonly contentHash: string;
  readonly sourceId?: string;
  readonly description: string;
  readonly submittedBy: string;
  readonly submittedAt: string;
};

export type CanopyProofChallengeCase = {
  readonly id: string;
  readonly subjectType: CanopyProofChallengeCaseSubjectType;
  readonly subjectId: string;
  readonly reason: CanopyProofChallengeCaseReason;
  readonly severity: CanopyProofChallengeCaseSeverity;
  readonly status: CanopyProofChallengeCaseStatus;
  readonly title: string;
  readonly description: string;
  readonly openedBy: string;
  readonly openedAt: string;
  readonly assignedRole: "verifier" | "researcher" | "governance";
  readonly evidence: readonly CanopyProofChallengeEvidence[];
  readonly evidenceRoot: string;
  readonly relatedAuditRoots: readonly string[];
  readonly challengeHash: string;
  readonly resolution?: {
    readonly decision: CanopyProofChallengeResolutionDecision;
    readonly resolvedBy: string;
    readonly resolvedAt: string;
    readonly rationale: string;
    readonly publicOutcome: string;
    readonly resolutionRoot: string;
  };
  readonly safety: {
    readonly nonFinalChallengeProcess: true;
    readonly humanResolutionRequired: true;
    readonly disputedSubjectsRemainVisible: true;
    readonly rawEvidenceExcluded: true;
    readonly noCarbonCreditAuthority: true;
    readonly noFinancialOrTaxAuthority: true;
    readonly noAutomaticTokenDistribution: true;
  };
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofChallengeCaseStatusSummary = {
  readonly service: "canopyproof-challenge-cases";
  readonly challengeCaseCount: number;
  readonly openCount: number;
  readonly underReviewCount: number;
  readonly acceptedCount: number;
  readonly criticalCount: number;
  readonly subjectTypes: readonly CanopyProofChallengeCaseSubjectType[];
  readonly reasons: readonly CanopyProofChallengeCaseReason[];
  readonly safety: {
    readonly publicChallengePath: true;
    readonly appendOnlyAuditHistory: true;
    readonly humanResolutionRequired: true;
    readonly rawEvidencePayloadsExcluded: true;
  };
  readonly challengeRoot: string;
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const challengeEvidenceSchema = z
  .object({
    id: z.string().min(1).optional(),
    evidenceType: z.enum(canopyProofChallengeEvidenceTypes),
    contentHash: sha256Schema,
    sourceId: z.string().min(1).optional(),
    description: z.string().min(12).max(1_000),
    submittedAt: z.string().datetime().optional(),
  })
  .strict();

const openChallengeCaseSchema = z
  .object({
    id: z.string().min(1).optional(),
    subjectType: z.enum(canopyProofChallengeCaseSubjectTypes),
    subjectId: z.string().min(1),
    reason: z.enum(canopyProofChallengeCaseReasons),
    severity: z.enum(canopyProofChallengeCaseSeverities),
    title: z.string().min(8).max(200),
    description: z.string().min(24).max(2_000),
    assignedRole: z.enum(["verifier", "researcher", "governance"]).default("verifier"),
    evidence: z.array(challengeEvidenceSchema).min(1),
    relatedAuditRoots: z.array(sha256Schema).default([]),
    openedAt: z.string().datetime().optional(),
  })
  .strict();

const resolveChallengeCaseSchema = z
  .object({
    decision: z.enum(canopyProofChallengeResolutionDecisions),
    rationale: z.string().min(20).max(2_000),
    publicOutcome: z.string().min(12).max(1_000),
    resolvedAt: z.string().datetime().optional(),
    resolutionEvidence: z.array(challengeEvidenceSchema).default([]),
  })
  .strict();

export class CanopyProofChallengeCaseService {
  private readonly challengeCasesById = new Map<string, CanopyProofChallengeCase>();

  openChallengeCase(input: unknown, actorId: string) {
    const parsed = openChallengeCaseSchema.parse(input);
    const openedAt = parsed.openedAt ?? new Date(0).toISOString();
    const relatedAuditRoots = [...new Set(parsed.relatedAuditRoots.map(normalizeSha256))].sort();
    const evidence = normalizeChallengeEvidence(parsed.evidence, actorId, openedAt);
    assertSafeChallengeText([parsed.subjectId, parsed.title, parsed.description, ...evidence.map((item) => item.description)]);
    assertChallengeEvidenceSupportsReason(parsed.reason, evidence, relatedAuditRoots);
    const evidenceRoot = merkleRoot(evidence.map((item) => hashJson(item)).sort());
    const challengeSeed = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      reason: parsed.reason,
      severity: parsed.severity,
      status: "open" as const,
      title: parsed.title,
      description: parsed.description,
      openedBy: actorId,
      openedAt,
      assignedRole: parsed.assignedRole,
      evidence,
      evidenceRoot,
      relatedAuditRoots,
      safety: challengeCaseSafety(),
    };
    const challengeHash = hashJson({ kind: "canopyproof-challenge-case-v1", challenge: challengeSeed });
    const id = parsed.id ?? `cp_challenge_case_${challengeHash.slice(0, 24)}`;
    if (this.challengeCasesById.has(id)) {
      throw new Error(`CanopyProof challenge case already exists: ${id}`);
    }
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "CHALLENGE",
      actor: actorId,
      entityType: "challenge_case",
      entityId: id,
      payload: {
        ...challengeSeed,
        challengeHash,
      },
      createdAt: openedAt,
      rationale: "CanopyProof challenge case opened for accountable human verification review.",
    });
    const challengeCase: CanopyProofChallengeCase = {
      id,
      ...challengeSeed,
      challengeHash,
      auditHistory,
    };
    this.challengeCasesById.set(challengeCase.id, challengeCase);
    return challengeCase;
  }

  resolveChallengeCase(challengeCaseId: string, input: unknown, actorId: string) {
    const current = this.getChallengeCase(challengeCaseId);
    if (current.status === "accepted" || current.status === "rejected" || current.status === "withdrawn") {
      throw new Error(`CanopyProof challenge case is already resolved: ${challengeCaseId}`);
    }
    const parsed = resolveChallengeCaseSchema.parse(input);
    const resolvedAt = parsed.resolvedAt ?? new Date(0).toISOString();
    const resolutionEvidence = normalizeChallengeEvidence(parsed.resolutionEvidence, actorId, resolvedAt);
    assertSafeChallengeText([parsed.rationale, parsed.publicOutcome, ...resolutionEvidence.map((item) => item.description)]);
    const status = challengeStatusFromResolution(parsed.decision);
    const resolutionRoot = hashJson({
      kind: "canopyproof-challenge-case-resolution-v1",
      challengeCaseId,
      decision: parsed.decision,
      rationale: parsed.rationale,
      publicOutcome: parsed.publicOutcome,
      resolvedBy: actorId,
      resolvedAt,
      resolutionEvidenceRoot:
        resolutionEvidence.length > 0 ? merkleRoot(resolutionEvidence.map((item) => hashJson(item)).sort()) : hashJson({ kind: "no-resolution-evidence" }),
    });
    const evidence = [...current.evidence, ...resolutionEvidence].sort((left, right) => left.id.localeCompare(right.id));
    const evidenceRoot = merkleRoot(evidence.map((item) => hashJson(item)).sort());
    const auditHistory = appendCanopyProofAuditEvent(current.auditHistory, {
      action: parsed.decision === "reject" || parsed.decision === "withdraw" ? "FULFILL" : parsed.decision === "request_more_evidence" ? "REASON" : "CHALLENGE",
      actor: actorId,
      entityType: "challenge_case",
      entityId: current.id,
      payload: {
        challengeCaseId,
        fromStatus: current.status,
        toStatus: status,
        decision: parsed.decision,
        rationale: parsed.rationale,
        publicOutcome: parsed.publicOutcome,
        evidenceRoot,
        resolutionRoot,
      },
      createdAt: resolvedAt,
      rationale: "CanopyProof challenge case resolved or advanced by accountable human review.",
    });
    const resolved: CanopyProofChallengeCase = {
      ...current,
      status,
      evidence,
      evidenceRoot,
      resolution: {
        decision: parsed.decision,
        resolvedBy: actorId,
        resolvedAt,
        rationale: parsed.rationale,
        publicOutcome: parsed.publicOutcome,
        resolutionRoot,
      },
      auditHistory,
    };
    this.challengeCasesById.set(current.id, resolved);
    return resolved;
  }

  listChallengeCases(
    filter: Readonly<{
      subjectType?: CanopyProofChallengeCaseSubjectType;
      subjectId?: string;
      status?: CanopyProofChallengeCaseStatus;
      reason?: CanopyProofChallengeCaseReason;
    }> = {},
  ) {
    return [...this.challengeCasesById.values()]
      .filter((item) => !filter.subjectType || item.subjectType === filter.subjectType)
      .filter((item) => !filter.subjectId || item.subjectId === filter.subjectId)
      .filter((item) => !filter.status || item.status === filter.status)
      .filter((item) => !filter.reason || item.reason === filter.reason)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt) || left.id.localeCompare(right.id));
  }

  getChallengeCase(challengeCaseId: string) {
    const challengeCase = this.challengeCasesById.get(challengeCaseId);
    if (!challengeCase) {
      throw new Error(`CanopyProof challenge case not found: ${challengeCaseId}`);
    }
    return challengeCase;
  }

  getStatus(): CanopyProofChallengeCaseStatusSummary {
    const challengeCases = this.listChallengeCases();
    return {
      service: "canopyproof-challenge-cases",
      challengeCaseCount: challengeCases.length,
      openCount: challengeCases.filter((item) => item.status === "open").length,
      underReviewCount: challengeCases.filter((item) => item.status === "under_review" || item.status === "needs_more_evidence").length,
      acceptedCount: challengeCases.filter((item) => item.status === "accepted").length,
      criticalCount: challengeCases.filter((item) => item.severity === "critical").length,
      subjectTypes: canopyProofChallengeCaseSubjectTypes,
      reasons: canopyProofChallengeCaseReasons,
      safety: {
        publicChallengePath: true,
        appendOnlyAuditHistory: true,
        humanResolutionRequired: true,
        rawEvidencePayloadsExcluded: true,
      },
      challengeRoot:
        challengeCases.length > 0
          ? merkleRoot(challengeCases.map((item) => item.challengeHash).sort())
          : hashJson({ kind: "canopyproof-empty-challenge-case-root-v1" }),
    };
  }
}

function normalizeChallengeEvidence(
  evidence: readonly z.infer<typeof challengeEvidenceSchema>[],
  actorId: string,
  fallbackSubmittedAt: string,
): readonly CanopyProofChallengeEvidence[] {
  return evidence
    .map((item) => {
      const contentHash = normalizeSha256(item.contentHash);
      return {
        id:
          item.id ??
          `cp_challenge_evidence_${hashJson({
            evidenceType: item.evidenceType,
            contentHash,
            submittedBy: actorId,
          }).slice(0, 24)}`,
        evidenceType: item.evidenceType,
        contentHash,
        ...(item.sourceId ? { sourceId: item.sourceId } : {}),
        description: item.description,
        submittedBy: actorId,
        submittedAt: item.submittedAt ?? fallbackSubmittedAt,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function assertChallengeEvidenceSupportsReason(
  reason: CanopyProofChallengeCaseReason,
  evidence: readonly CanopyProofChallengeEvidence[],
  relatedAuditRoots: readonly string[],
) {
  const evidenceTypes = new Set(evidence.map((item) => item.evidenceType));
  if ((reason === "gps_spoofing" || reason === "duplicate_planting") && !evidenceTypes.has("gps_hash")) {
    throw new Error(`CanopyProof challenge reason ${reason} requires GPS hash evidence.`);
  }
  if (reason === "satellite_contradiction" && !evidenceTypes.has("satellite_scene")) {
    throw new Error("CanopyProof satellite contradiction challenge requires satellite scene evidence.");
  }
  if (reason === "audit_gap" && !evidenceTypes.has("audit_root") && relatedAuditRoots.length === 0) {
    throw new Error("CanopyProof audit-gap challenge requires audit-root evidence.");
  }
}

function challengeStatusFromResolution(decision: CanopyProofChallengeResolutionDecision): CanopyProofChallengeCaseStatus {
  if (decision === "accept") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "withdraw") return "withdrawn";
  return "needs_more_evidence";
}

function challengeCaseSafety(): CanopyProofChallengeCase["safety"] {
  return {
    nonFinalChallengeProcess: true,
    humanResolutionRequired: true,
    disputedSubjectsRemainVisible: true,
    rawEvidenceExcluded: true,
    noCarbonCreditAuthority: true,
    noFinancialOrTaxAuthority: true,
    noAutomaticTokenDistribution: true,
  };
}

function assertSafeChallengeText(values: readonly string[]) {
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
        throw new Error(`CanopyProof challenge case contains unsupported public claim: ${value}`);
      }
    }
  }
}

function normalizeSha256(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}
