import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofDataQualitySubjectTypes = ["evidence", "proof_record", "project", "reporting_package", "terra_scene"] as const;
export const canopyProofDataQualityDecisions = ["pass", "needs_review", "blocked"] as const;
export const canopyProofSatelliteConsistencySignals = ["supports", "neutral", "contradicts", "unavailable"] as const;
export const canopyProofDataQualityFindingSeverities = ["info", "warning", "high", "critical"] as const;

export type CanopyProofDataQualitySubjectType = (typeof canopyProofDataQualitySubjectTypes)[number];
export type CanopyProofDataQualityDecision = (typeof canopyProofDataQualityDecisions)[number];
export type CanopyProofSatelliteConsistencySignal = (typeof canopyProofSatelliteConsistencySignals)[number];
export type CanopyProofDataQualityFindingSeverity = (typeof canopyProofDataQualityFindingSeverities)[number];

export type CanopyProofDataQualitySignals = {
  readonly evidenceCount: number;
  readonly mediaHashCount: number;
  readonly gpsHashCount: number;
  readonly auditEventRootCount: number;
  readonly humanReviewCount: number;
  readonly governanceApprovalCount: number;
  readonly monitoringEventCount: number;
  readonly deviceAttestationCount: number;
  readonly communityAttestationCount: number;
  readonly duplicateCandidateCount: number;
  readonly unresolvedChallengeCount: number;
  readonly missingRequiredDataSources: readonly string[];
  readonly satelliteConsistency: CanopyProofSatelliteConsistencySignal;
  readonly gpsAccuracyMeters?: number;
  readonly staleEvidenceDays?: number;
  readonly rawMediaIncluded: boolean;
  readonly personalDataExposureRisk: boolean;
};

export type CanopyProofDataQualityScores = {
  readonly completeness: number;
  readonly provenance: number;
  readonly spatialAccuracy: number;
  readonly temporalFreshness: number;
  readonly duplicateResistance: number;
  readonly satelliteConsistency: number;
  readonly humanGovernanceCoverage: number;
  readonly privacySafety: number;
  readonly overall: number;
};

export type CanopyProofDataQualityFinding = {
  readonly code: string;
  readonly severity: CanopyProofDataQualityFindingSeverity;
  readonly message: string;
  readonly remediation: string;
};

export type CanopyProofDataQualityScorecard = {
  readonly id: string;
  readonly subjectType: CanopyProofDataQualitySubjectType;
  readonly subjectId: string;
  readonly methodologyId?: string;
  readonly evidenceIds: readonly string[];
  readonly sourceRoots: readonly string[];
  readonly sourceRoot: string;
  readonly signals: CanopyProofDataQualitySignals;
  readonly scores: CanopyProofDataQualityScores;
  readonly findings: readonly CanopyProofDataQualityFinding[];
  readonly findingRoot: string;
  readonly decision: CanopyProofDataQualityDecision;
  readonly qualityHash: string;
  readonly notes: readonly string[];
  readonly safety: {
    readonly advisoryQualityGateOnly: true;
    readonly aiCannotApproveItself: true;
    readonly humanReviewStillRequired: true;
    readonly noCarbonCreditAuthority: true;
    readonly noFinancialOrTaxAuthority: true;
    readonly noAutomaticTokenDistribution: true;
  };
  readonly createdBy: string;
  readonly createdAt: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofDataQualityStatus = {
  readonly service: "canopyproof-data-quality";
  readonly scorecardCount: number;
  readonly blockedCount: number;
  readonly needsReviewCount: number;
  readonly subjectTypes: readonly CanopyProofDataQualitySubjectType[];
  readonly decisions: readonly CanopyProofDataQualityDecision[];
  readonly safety: {
    readonly appendOnlyScorecards: true;
    readonly noAutomaticApproval: true;
    readonly rawEvidencePayloadsExcluded: true;
    readonly institutionalQualityGate: true;
  };
  readonly scorecardRoot: string;
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const qualitySignalsSchema = z
  .object({
    evidenceCount: z.number().int().min(0).default(0),
    mediaHashCount: z.number().int().min(0).default(0),
    gpsHashCount: z.number().int().min(0).default(0),
    auditEventRootCount: z.number().int().min(0).default(0),
    humanReviewCount: z.number().int().min(0).default(0),
    governanceApprovalCount: z.number().int().min(0).default(0),
    monitoringEventCount: z.number().int().min(0).default(0),
    deviceAttestationCount: z.number().int().min(0).default(0),
    communityAttestationCount: z.number().int().min(0).default(0),
    duplicateCandidateCount: z.number().int().min(0).default(0),
    unresolvedChallengeCount: z.number().int().min(0).default(0),
    missingRequiredDataSources: z.array(z.string().min(1).max(120)).default([]),
    satelliteConsistency: z.enum(canopyProofSatelliteConsistencySignals).default("unavailable"),
    gpsAccuracyMeters: z.number().positive().max(100_000).optional(),
    staleEvidenceDays: z.number().int().min(0).max(36_500).optional(),
    rawMediaIncluded: z.boolean().default(false),
    personalDataExposureRisk: z.boolean().default(false),
  })
  .strict();

const qualityScorecardSchema = z
  .object({
    id: z.string().min(1).optional(),
    subjectType: z.enum(canopyProofDataQualitySubjectTypes),
    subjectId: z.string().min(1),
    methodologyId: z.string().min(1).optional(),
    evidenceIds: z.array(z.string().min(1)).default([]),
    sourceRoots: z.array(sha256Schema).min(1),
    signals: qualitySignalsSchema,
    notes: z.array(z.string().min(8).max(1_000)).default([]),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofDataQualityService {
  private readonly scorecardsById = new Map<string, CanopyProofDataQualityScorecard>();

  createScorecard(input: unknown, actorId: string) {
    const parsed = qualityScorecardSchema.parse(input);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const evidenceIds = [...new Set(parsed.evidenceIds)].sort();
    const sourceRoots = [...new Set(parsed.sourceRoots.map(normalizeSha256))].sort();
    const notes = [...parsed.notes].sort();
    assertSafeQualityText([parsed.subjectId, ...(parsed.methodologyId ? [parsed.methodologyId] : []), ...evidenceIds, ...notes]);
    assertSourceCoverage(parsed.subjectType, evidenceIds, parsed.signals);

    const signals = normalizeSignals(parsed.signals);
    const scores = calculateQualityScores(signals);
    const findings = buildQualityFindings(parsed.subjectType, signals);
    const findingRoot = findings.length > 0 ? merkleRoot(findings.map((finding) => hashJson(finding)).sort()) : hashJson({ kind: "no-quality-findings" });
    const decision = decideQualityGate(findings, scores);
    const sourceRoot = merkleRoot(sourceRoots);
    const scorecardSeed = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      ...(parsed.methodologyId ? { methodologyId: parsed.methodologyId } : {}),
      evidenceIds,
      sourceRoots,
      sourceRoot,
      signals,
      scores,
      findings,
      findingRoot,
      decision,
      notes,
      safety: qualityScorecardSafety(),
      createdBy: actorId,
      createdAt,
    };
    const qualityHash = hashJson({ kind: "canopyproof-data-quality-scorecard-v1", scorecard: scorecardSeed });
    const id = parsed.id ?? `cp_quality_${qualityHash.slice(0, 24)}`;
    if (this.scorecardsById.has(id)) {
      throw new Error(`CanopyProof quality scorecard already exists: ${id}`);
    }

    const auditEvent = appendCanopyProofAuditEvent([...this.scorecardsById.values()].map((scorecard) => scorecard.auditEvent), {
      action: decision === "blocked" ? "CHALLENGE" : decision === "pass" ? "FULFILL" : "REASON",
      actor: actorId,
      entityType: "quality_scorecard",
      entityId: id,
      payload: {
        ...scorecardSeed,
        qualityHash,
      },
      createdAt,
      rationale:
        decision === "pass"
          ? "CanopyProof quality scorecard passed deterministic institutional quality gates without granting proof approval authority."
          : "CanopyProof quality scorecard recorded quality findings for human review before institutional reliance.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof quality scorecard failed to append audit event.");
    }

    const scorecard: CanopyProofDataQualityScorecard = {
      id,
      ...scorecardSeed,
      qualityHash,
      auditEvent,
    };
    this.scorecardsById.set(scorecard.id, scorecard);
    return scorecard;
  }

  listScorecards(
    filter: Readonly<{
      subjectType?: CanopyProofDataQualitySubjectType;
      subjectId?: string;
      decision?: CanopyProofDataQualityDecision;
    }> = {},
  ) {
    return [...this.scorecardsById.values()]
      .filter((scorecard) => !filter.subjectType || scorecard.subjectType === filter.subjectType)
      .filter((scorecard) => !filter.subjectId || scorecard.subjectId === filter.subjectId)
      .filter((scorecard) => !filter.decision || scorecard.decision === filter.decision)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  getScorecard(scorecardId: string) {
    const scorecard = this.scorecardsById.get(scorecardId);
    if (!scorecard) {
      throw new Error(`CanopyProof quality scorecard not found: ${scorecardId}`);
    }
    return scorecard;
  }

  getStatus(): CanopyProofDataQualityStatus {
    const scorecards = this.listScorecards();
    return {
      service: "canopyproof-data-quality",
      scorecardCount: scorecards.length,
      blockedCount: scorecards.filter((scorecard) => scorecard.decision === "blocked").length,
      needsReviewCount: scorecards.filter((scorecard) => scorecard.decision === "needs_review").length,
      subjectTypes: canopyProofDataQualitySubjectTypes,
      decisions: canopyProofDataQualityDecisions,
      safety: {
        appendOnlyScorecards: true,
        noAutomaticApproval: true,
        rawEvidencePayloadsExcluded: true,
        institutionalQualityGate: true,
      },
      scorecardRoot:
        scorecards.length > 0
          ? merkleRoot(scorecards.map((scorecard) => scorecard.qualityHash).sort())
          : hashJson({ kind: "canopyproof-empty-quality-scorecard-root-v1" }),
    };
  }
}

function normalizeSignals(signals: z.infer<typeof qualitySignalsSchema>): CanopyProofDataQualitySignals {
  return {
    evidenceCount: signals.evidenceCount,
    mediaHashCount: signals.mediaHashCount,
    gpsHashCount: signals.gpsHashCount,
    auditEventRootCount: signals.auditEventRootCount,
    humanReviewCount: signals.humanReviewCount,
    governanceApprovalCount: signals.governanceApprovalCount,
    monitoringEventCount: signals.monitoringEventCount,
    deviceAttestationCount: signals.deviceAttestationCount,
    communityAttestationCount: signals.communityAttestationCount,
    duplicateCandidateCount: signals.duplicateCandidateCount,
    unresolvedChallengeCount: signals.unresolvedChallengeCount,
    missingRequiredDataSources: [...new Set(signals.missingRequiredDataSources)].sort(),
    satelliteConsistency: signals.satelliteConsistency,
    ...(signals.gpsAccuracyMeters !== undefined ? { gpsAccuracyMeters: signals.gpsAccuracyMeters } : {}),
    ...(signals.staleEvidenceDays !== undefined ? { staleEvidenceDays: signals.staleEvidenceDays } : {}),
    rawMediaIncluded: signals.rawMediaIncluded,
    personalDataExposureRisk: signals.personalDataExposureRisk,
  };
}

function calculateQualityScores(signals: CanopyProofDataQualitySignals): CanopyProofDataQualityScores {
  const completenessBase = average([
    ratioScore(signals.mediaHashCount, Math.max(signals.evidenceCount, 1)),
    ratioScore(signals.gpsHashCount, Math.max(signals.evidenceCount, 1)),
    signals.evidenceCount > 0 ? 100 : 0,
    signals.missingRequiredDataSources.length === 0 ? 100 : Math.max(0, 100 - signals.missingRequiredDataSources.length * 18),
  ]);
  const provenance = average([
    signals.auditEventRootCount > 0 ? 100 : 0,
    signals.deviceAttestationCount > 0 ? 100 : 35,
    signals.communityAttestationCount > 0 ? 90 : 55,
  ]);
  const spatialAccuracy = gpsAccuracyScore(signals.gpsAccuracyMeters, signals.gpsHashCount);
  const temporalFreshness = temporalFreshnessScore(signals.staleEvidenceDays);
  const duplicateResistance = duplicateResistanceScore(signals.duplicateCandidateCount);
  const satelliteConsistency = satelliteConsistencyScore(signals.satelliteConsistency);
  const humanGovernanceCoverage = average([
    signals.humanReviewCount > 0 ? 100 : 35,
    signals.governanceApprovalCount > 0 ? 100 : 40,
    signals.unresolvedChallengeCount === 0 ? 100 : Math.max(0, 100 - signals.unresolvedChallengeCount * 30),
    signals.monitoringEventCount > 0 ? 100 : 60,
  ]);
  const privacySafety = signals.rawMediaIncluded || signals.personalDataExposureRisk ? 20 : 100;
  const overall = Math.round(
    completenessBase * 0.18 +
      provenance * 0.14 +
      spatialAccuracy * 0.14 +
      temporalFreshness * 0.1 +
      duplicateResistance * 0.12 +
      satelliteConsistency * 0.14 +
      humanGovernanceCoverage * 0.12 +
      privacySafety * 0.06,
  );

  return {
    completeness: Math.round(completenessBase),
    provenance: Math.round(provenance),
    spatialAccuracy: Math.round(spatialAccuracy),
    temporalFreshness: Math.round(temporalFreshness),
    duplicateResistance: Math.round(duplicateResistance),
    satelliteConsistency: Math.round(satelliteConsistency),
    humanGovernanceCoverage: Math.round(humanGovernanceCoverage),
    privacySafety: Math.round(privacySafety),
    overall: clampScore(overall),
  };
}

function buildQualityFindings(
  subjectType: CanopyProofDataQualitySubjectType,
  signals: CanopyProofDataQualitySignals,
): readonly CanopyProofDataQualityFinding[] {
  const findings: CanopyProofDataQualityFinding[] = [];
  if (signals.evidenceCount === 0) {
    findings.push(finding("missing_evidence", "critical", "No evidence records were bound to the quality scorecard.", "Bind at least one submitted evidence object."));
  }
  if (signals.mediaHashCount < signals.evidenceCount) {
    findings.push(finding("missing_media_hash", "high", "One or more evidence records do not expose media hashes.", "Require media hash extraction before review."));
  }
  if (signals.gpsHashCount < signals.evidenceCount) {
    findings.push(finding("missing_gps_hash", "high", "One or more evidence records do not expose GPS hashes.", "Require GPS hash capture or documented exception."));
  }
  if (signals.auditEventRootCount === 0) {
    findings.push(finding("missing_audit_lineage", "critical", "No append-only audit event roots were supplied.", "Attach audit roots before institutional reliance."));
  }
  if (signals.gpsAccuracyMeters !== undefined && signals.gpsAccuracyMeters > 100) {
    findings.push(finding("gps_accuracy_weak", "high", "GPS accuracy is too weak for field verification.", "Escalate to verifier review and satellite cross-check."));
  }
  if (signals.satelliteConsistency === "contradicts") {
    findings.push(finding("satellite_contradiction", "critical", "Satellite signal contradicts the submitted environmental state.", "Block proof reliance until a human verifier resolves the contradiction."));
  }
  if (signals.duplicateCandidateCount > 0) {
    findings.push(
      finding(
        "duplicate_evidence_risk",
        signals.duplicateCandidateCount > 5 ? "critical" : "high",
        "Potential duplicate evidence or double-counted planting candidates were detected.",
        "Run duplicate media, location, and contributor review before proof issuance.",
      ),
    );
  }
  if (signals.humanReviewCount === 0) {
    findings.push(finding("human_review_missing", "high", "No accountable human review is attached.", "Route to verifier or researcher review; AI cannot approve itself."));
  }
  if (subjectType !== "evidence" && signals.governanceApprovalCount === 0) {
    findings.push(finding("governance_approval_missing", "high", "Institutional subject is missing governance approval linkage.", "Bind governance approval before public proof reliance."));
  }
  if (signals.unresolvedChallengeCount > 0) {
    findings.push(finding("unresolved_challenge", "high", "One or more public or institutional challenges remain unresolved.", "Resolve or disclose challenges before publishing stronger claims."));
  }
  if (signals.missingRequiredDataSources.length > 0) {
    findings.push(
      finding(
        "required_data_source_missing",
        "high",
        `Required data sources are missing: ${signals.missingRequiredDataSources.join(", ")}.`,
        "Collect missing field, device, satellite, audit, or governance sources before reliance.",
      ),
    );
  }
  if (signals.rawMediaIncluded || signals.personalDataExposureRisk) {
    findings.push(finding("privacy_redaction_required", "critical", "Raw evidence payloads or personal data exposure risk were detected.", "Export only hash references and apply redaction policy."));
  }
  if (signals.staleEvidenceDays !== undefined && signals.staleEvidenceDays > 365) {
    findings.push(finding("evidence_stale", "warning", "Evidence is older than the annual monitoring freshness window.", "Refresh monitoring evidence before high-confidence reporting."));
  }
  return findings.sort((left, right) => left.code.localeCompare(right.code));
}

function decideQualityGate(
  findings: readonly CanopyProofDataQualityFinding[],
  scores: CanopyProofDataQualityScores,
): CanopyProofDataQualityDecision {
  if (findings.some((finding) => finding.severity === "critical") || scores.overall < 45) {
    return "blocked";
  }
  if (findings.some((finding) => finding.severity === "high") || scores.overall < 80) {
    return "needs_review";
  }
  return "pass";
}

function finding(
  code: string,
  severity: CanopyProofDataQualityFindingSeverity,
  message: string,
  remediation: string,
): CanopyProofDataQualityFinding {
  return {
    code,
    severity,
    message,
    remediation,
  };
}

function qualityScorecardSafety(): CanopyProofDataQualityScorecard["safety"] {
  return {
    advisoryQualityGateOnly: true,
    aiCannotApproveItself: true,
    humanReviewStillRequired: true,
    noCarbonCreditAuthority: true,
    noFinancialOrTaxAuthority: true,
    noAutomaticTokenDistribution: true,
  };
}

function assertSourceCoverage(
  subjectType: CanopyProofDataQualitySubjectType,
  evidenceIds: readonly string[],
  signals: z.infer<typeof qualitySignalsSchema>,
) {
  if (signals.evidenceCount > 0 && evidenceIds.length === 0) {
    throw new Error("CanopyProof quality scorecard requires evidence IDs when evidenceCount is positive.");
  }
  if ((subjectType === "proof_record" || subjectType === "reporting_package") && signals.humanReviewCount === 0 && signals.auditEventRootCount === 0) {
    throw new Error("CanopyProof institutional quality scorecards require human review or audit lineage signals.");
  }
}

function assertSafeQualityText(values: readonly string[]) {
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
        throw new Error(`CanopyProof quality scorecard contains unsupported public claim: ${value}`);
      }
    }
  }
}

function normalizeSha256(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}

function ratioScore(count: number, expected: number) {
  if (expected <= 0) return 0;
  return clampScore((count / expected) * 100);
}

function gpsAccuracyScore(accuracyMeters: number | undefined, gpsHashCount: number) {
  if (gpsHashCount === 0) return 0;
  if (accuracyMeters === undefined) return 70;
  if (accuracyMeters <= 10) return 100;
  if (accuracyMeters <= 35) return 90;
  if (accuracyMeters <= 100) return 65;
  if (accuracyMeters <= 500) return 30;
  return 10;
}

function temporalFreshnessScore(staleEvidenceDays: number | undefined) {
  if (staleEvidenceDays === undefined) return 75;
  if (staleEvidenceDays <= 30) return 100;
  if (staleEvidenceDays <= 180) return 85;
  if (staleEvidenceDays <= 365) return 70;
  if (staleEvidenceDays <= 730) return 45;
  return 20;
}

function duplicateResistanceScore(duplicateCandidateCount: number) {
  if (duplicateCandidateCount === 0) return 100;
  if (duplicateCandidateCount <= 2) return 70;
  if (duplicateCandidateCount <= 5) return 45;
  return 10;
}

function satelliteConsistencyScore(signal: CanopyProofSatelliteConsistencySignal) {
  if (signal === "supports") return 100;
  if (signal === "neutral") return 75;
  if (signal === "unavailable") return 55;
  return 0;
}

function average(values: readonly number[]) {
  return clampScore(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}
