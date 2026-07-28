import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  buildCanopyProofEsgReport,
  canopyProofEsgFrameworks,
  renderCanopyProofEsgReportPdf,
  serializeCanopyProofEsgReportJson,
  type CanopyProofEsgReport,
} from "./esg-reporting.js";
import {
  appendCanopyProofAuditEvent,
  buildCanopyAiAnalysis,
  canopyProofEvidenceTypes,
  environmentalProofClaimBoundary,
  issueEnvironmentalProofRecord,
  validateCanopyProofEvidenceEnvelope,
  type BuildCanopyAiAnalysisInput,
  type CanopyAiAnalysis,
  type CanopyProofAuditEvent,
  type CanopyProofEvidenceEnvelope,
  type CanopyProofLocation,
  type EnvironmentalProofRecord,
} from "./proof-engine.js";

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional(),
  regionId: z.string().min(1).optional(),
});

const evidenceSubmissionSchema = z.object({
  id: z.string().min(1).optional(),
  projectId: z.string().min(1),
  evidenceType: z.enum(canopyProofEvidenceTypes),
  location: locationSchema,
  timestamp: z.string().datetime(),
  contributor: z.string().min(1),
  media_hash: sha256Schema,
  gps_hash: sha256Schema,
  confidence_score: z.number().min(0).max(100).default(80),
  offline_sync_id: z.string().min(1).optional(),
  device_fingerprint_hash: sha256Schema.optional(),
  exif_hash: sha256Schema.optional(),
});

const satelliteObservationSchema = z.object({
  vegetationSignal: z.enum(["supports", "neutral", "contradicts"]),
  waterSignal: z.enum(["supports", "neutral", "contradicts"]).optional(),
  acquiredAt: z.string().datetime(),
});

const ecologicalObservationSchema = z.object({
  biodiversitySignal: z.enum(["supports", "neutral", "contradicts"]).optional(),
  soilMoistureSignal: z.enum(["supports", "neutral", "contradicts"]).optional(),
  disturbanceSignal: z.enum(["none", "minor", "major"]).optional(),
  observedAt: z.string().datetime(),
});

const survivalObservationSchema = z.object({
  survivalSignal: z.enum(["supports", "neutral", "contradicts"]),
  estimatedSurvivalPercent: z.number().min(0).max(100).optional(),
  mortalityPercent: z.number().min(0).max(100).optional(),
  observedAt: z.string().datetime(),
  method: z.enum(["field_count", "photo_plot", "satellite_proxy", "sensor_estimate"]).optional(),
});

const aiAnalysisRequestSchema = z.object({
  modelVersion: z.string().min(1).optional(),
  observedAt: z.string().datetime().optional(),
  knownMediaHashes: z.array(sha256Schema).default([]),
  expectedLocation: locationSchema.optional(),
  satelliteObservation: satelliteObservationSchema.optional(),
  ecologicalObservation: ecologicalObservationSchema.optional(),
  survivalObservation: survivalObservationSchema.optional(),
});

const humanReviewSchema = z.object({
  reviewer: z.string().min(1),
  role: z.enum(["verifier", "ngo", "government", "un_agency", "researcher"]),
  decision: z.enum(["approve", "reject", "challenge"]),
  rationale: z.string().min(1),
  reviewedAt: z.string().datetime(),
  acceptedFindingIds: z.array(z.string().min(1)).optional(),
});

const proofRecordIssueSchema = z.object({
  projectId: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  humanReview: humanReviewSchema,
  governanceApprovals: z.array(z.string().min(1)).min(1),
  monitoringTimeline: z.array(z.string().min(1)).min(1),
  monitoringEventIds: z.array(z.string().min(1)).default([]),
  issuedAt: z.string().datetime().optional(),
});

export const canopyProofProofRecordChallengeReasons = [
  "fake_evidence",
  "duplicate_claim",
  "gps_spoofing",
  "satellite_contradiction",
  "governance_conflict",
  "unsafe_public_claim",
  "methodology_error",
  "other",
] as const;

export const canopyProofProofRecordChallengeSeverities = ["low", "medium", "high", "critical"] as const;
export const canopyProofProofRecordChallengeStatuses = ["open", "accepted", "rejected"] as const;

const proofRecordChallengeSchema = z
  .object({
    id: z.string().min(1).optional(),
    reason: z.enum(canopyProofProofRecordChallengeReasons),
    severity: z.enum(canopyProofProofRecordChallengeSeverities),
    description: z.string().min(12).max(2_000),
    evidenceIds: z.array(z.string().min(1)).default([]),
    evidenceHashes: z.array(sha256Schema).default([]),
    abuseControlPolicyId: z.string().min(1).default("canopyproof_challenge_abuse_control_v1"),
    bondRequired: z.boolean().default(false),
    bondWaivedReason: z.string().min(1).default("Public-interest CanopyProof challenge lane; no economic bond required in V1."),
    submittedAt: z.string().datetime().optional(),
  })
  .strict();

const proofRecordChallengeResolutionSchema = z
  .object({
    decision: z.enum(["accept", "reject"]),
    rationale: z.string().min(12),
    publicOutcome: z.string().min(12).max(2_000),
    resolvedAt: z.string().datetime().optional(),
  })
  .strict();

const esgReportGenerateSchema = z.object({
  projectId: z.string().min(1),
  organizationName: z.string().min(1),
  reportingPeriod: z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }),
  generatedBy: z.string().min(1),
  generatedAt: z.string().datetime().optional(),
  frameworks: z.array(z.enum(canopyProofEsgFrameworks)).optional(),
  materialTopics: z.array(z.string().min(1)).optional(),
  proofRecordIds: z.array(z.string().min(1)).optional(),
});

export type CanopyProofEvidenceSubmissionResult = {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly evidence: CanopyProofEvidenceEnvelope;
};

export type CanopyProofProofRecordChallengeReason = (typeof canopyProofProofRecordChallengeReasons)[number];
export type CanopyProofProofRecordChallengeSeverity = (typeof canopyProofProofRecordChallengeSeverities)[number];
export type CanopyProofProofRecordChallengeStatus = (typeof canopyProofProofRecordChallengeStatuses)[number];

export type CanopyProofProofRecordChallenge = {
  readonly id: string;
  readonly recordId: string;
  readonly projectId: string;
  readonly challenger: string;
  readonly reason: CanopyProofProofRecordChallengeReason;
  readonly severity: CanopyProofProofRecordChallengeSeverity;
  readonly status: CanopyProofProofRecordChallengeStatus;
  readonly description: string;
  readonly evidenceIds: readonly string[];
  readonly evidenceHashes: readonly string[];
  readonly evidenceRoot: string;
  readonly abuseControlPolicyId: string;
  readonly bondRequired: boolean;
  readonly bondWaivedReason: string;
  readonly submittedAt: string;
  readonly resolvedAt?: string;
  readonly resolvedBy?: string;
  readonly resolutionRationale?: string;
  readonly publicOutcome: string;
  readonly challengeHash: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofCertificateGovernanceApprovalSummary = {
  readonly id: string;
  readonly subjectType: "proof_record";
  readonly subjectId: string;
  readonly policyId: string;
  readonly reviewer: string;
  readonly reviewerRole: "owner" | "admin" | "verifier" | "researcher" | "community" | "observer" | "agent";
  readonly decision: "approve";
  readonly rationale: string;
  readonly conflictDisclosure: string;
  readonly decidedAt: string;
  readonly approvalHash: string;
  readonly auditEventRoot: string;
};

export type CanopyProofCertificateMonitoringEventSummary = {
  readonly id: string;
  readonly projectId: string;
  readonly eventType: string;
  readonly state: string;
  readonly observedAt: string;
  readonly observedBy: string;
  readonly evidenceIds: readonly string[];
  readonly terraSceneIds: readonly string[];
  readonly eventHash: string;
  readonly auditEventRoot: string;
};

export type CanopyProofCertificateArtifact = {
  readonly certificateId: string;
  readonly certificateVersion: "canopyproof_certificate_artifact_v1";
  readonly recordId: string;
  readonly recordType: EnvironmentalProofRecord["recordType"];
  readonly project: {
    readonly id: string;
    readonly evidenceCount: number;
  };
  readonly location: {
    readonly primary: CanopyProofLocation;
    readonly evidenceLocations: readonly CanopyProofLocation[];
  };
  readonly evidenceRoot: string;
  readonly evidenceIds: readonly string[];
  readonly verificationHistory: readonly CanopyProofAuditEvent[];
  readonly monitoringTimeline: readonly string[];
  readonly monitoringEventIds: readonly string[];
  readonly monitoringEventRoot: string;
  readonly projectMonitoringEvents: readonly CanopyProofCertificateMonitoringEventSummary[];
  readonly contributors: readonly string[];
  readonly governanceApprovalIds: readonly string[];
  readonly governanceApprovals: readonly CanopyProofCertificateGovernanceApprovalSummary[];
  readonly publicChallenges: readonly {
    readonly id: string;
    readonly reason: CanopyProofProofRecordChallengeReason;
    readonly severity: CanopyProofProofRecordChallengeSeverity;
    readonly status: CanopyProofProofRecordChallengeStatus;
    readonly evidenceRoot: string;
    readonly submittedAt: string;
    readonly publicOutcome: string;
  }[];
  readonly status: EnvironmentalProofRecord["status"];
  readonly issuedAt: string;
  readonly sourceRecordHash: string;
  readonly claimBoundary: EnvironmentalProofRecord["claimBoundary"];
  readonly disclosure: string;
  readonly certificateHash: string;
};

export class CanopyProofService {
  private readonly evidenceById = new Map<string, CanopyProofEvidenceEnvelope>();
  private readonly analysesByEvidenceId = new Map<string, CanopyAiAnalysis[]>();
  private readonly recordsById = new Map<string, EnvironmentalProofRecord>();
  private readonly proofRecordChallengesById = new Map<string, CanopyProofProofRecordChallenge>();
  private readonly proofRecordChallengeIdsByRecordId = new Map<string, string[]>();
  private readonly esgReportsById = new Map<string, CanopyProofEsgReport>();

  submitEvidence(input: unknown): CanopyProofEvidenceSubmissionResult {
    const parsed = evidenceSubmissionSchema.parse(input);
    const evidenceId =
      parsed.id ??
      `cp_evidence_${hashJson({
        projectId: parsed.projectId,
        media_hash: parsed.media_hash,
        gps_hash: parsed.gps_hash,
        timestamp: parsed.timestamp,
        contributor: parsed.contributor,
      }).slice(0, 24)}`;
    const existing = this.evidenceById.get(evidenceId);
    if (existing) {
      const sameEnvelope =
        existing.projectId === parsed.projectId &&
        existing.evidenceType === parsed.evidenceType &&
        existing.media_hash === parsed.media_hash.toLowerCase() &&
        existing.gps_hash === parsed.gps_hash.toLowerCase() &&
        existing.timestamp === parsed.timestamp &&
        existing.contributor === parsed.contributor;
      if (sameEnvelope) {
        return {
          valid: existing.verification_status !== "challenged",
          issues: [],
          evidence: existing,
        };
      }

      const issues = ["duplicate_evidence_id_conflict"] as const;
      const challenged: CanopyProofEvidenceEnvelope = {
        ...existing,
        verification_status: "challenged",
        confidence_score: Math.min(existing.confidence_score, 10),
        audit_history: appendCanopyProofAuditEvent(existing.audit_history, {
          action: "CHALLENGE",
          actor: "Evidence Agent",
          entityType: "evidence",
          entityId: evidenceId,
          payload: {
            issue: issues[0],
            attempted: {
              projectId: parsed.projectId,
              evidenceType: parsed.evidenceType,
              media_hash: parsed.media_hash.toLowerCase(),
              gps_hash: parsed.gps_hash.toLowerCase(),
              timestamp: parsed.timestamp,
              contributor: parsed.contributor,
            },
          },
          createdAt: parsed.timestamp,
          rationale: "Conflicting offline evidence replay attempted to reuse an existing evidence ID and was retained as a challenge.",
        }),
      };
      this.evidenceById.set(challenged.id, challenged);
      return {
        valid: false,
        issues,
        evidence: challenged,
      };
    }
    const initialAudit = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: parsed.contributor,
      entityType: "evidence",
      entityId: evidenceId,
      payload: {
        projectId: parsed.projectId,
        evidenceType: parsed.evidenceType,
        media_hash: parsed.media_hash,
        gps_hash: parsed.gps_hash,
        timestamp: parsed.timestamp,
      },
      createdAt: parsed.timestamp,
      rationale: "Evidence envelope submitted through the CanopyProof Evidence Collection Network.",
    });
    const submitted: CanopyProofEvidenceEnvelope = {
      id: evidenceId,
      projectId: parsed.projectId,
      evidenceType: parsed.evidenceType,
      location: compactLocation(parsed.location),
      timestamp: parsed.timestamp,
      contributor: parsed.contributor,
      media_hash: parsed.media_hash.toLowerCase(),
      gps_hash: parsed.gps_hash.toLowerCase(),
      verification_status: "submitted",
      confidence_score: parsed.confidence_score,
      reviewers: [],
      audit_history: initialAudit,
      ...(parsed.offline_sync_id ? { offline_sync_id: parsed.offline_sync_id } : {}),
      ...(parsed.device_fingerprint_hash ? { device_fingerprint_hash: parsed.device_fingerprint_hash.toLowerCase() } : {}),
      ...(parsed.exif_hash ? { exif_hash: parsed.exif_hash.toLowerCase() } : {}),
    };
    const issues = validateCanopyProofEvidenceEnvelope(submitted);
    const status = issues.length === 0 ? "validated" : "challenged";
    const rationale =
      issues.length === 0
        ? "Evidence envelope passed deterministic validation and remains pending AI/human review."
        : `Evidence envelope is retained but challenged because validation found: ${issues.join(", ")}.`;
    const evidence: CanopyProofEvidenceEnvelope = {
      ...submitted,
      verification_status: status,
      confidence_score: issues.length === 0 ? submitted.confidence_score : Math.min(submitted.confidence_score, 25),
      audit_history: appendCanopyProofAuditEvent(submitted.audit_history, {
        action: issues.length === 0 ? "ASSERT" : "CHALLENGE",
        actor: "Evidence Agent",
        entityType: "evidence",
        entityId: evidenceId,
        payload: { issues, status },
        createdAt: parsed.timestamp,
        rationale,
      }),
    };

    this.evidenceById.set(evidence.id, evidence);
    return {
      valid: issues.length === 0,
      issues,
      evidence,
    };
  }

  listEvidence() {
    return [...this.evidenceById.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  getEvidence(evidenceId: string) {
    const evidence = this.evidenceById.get(evidenceId);
    if (!evidence) {
      throw new Error(`CanopyProof evidence not found: ${evidenceId}`);
    }
    return evidence;
  }

  findEvidence(evidenceId: string) {
    return this.evidenceById.get(evidenceId);
  }

  appendEvidenceAuditEvent(
    evidenceId: string,
    input: Readonly<{
      action: CanopyProofAuditEvent["action"];
      actor: string;
      entityType: CanopyProofAuditEvent["entityType"];
      payload: unknown;
      createdAt?: string;
      rationale: string;
      reviewers?: readonly string[];
      verification_status?: CanopyProofEvidenceEnvelope["verification_status"];
      confidence_score?: number;
    }>,
  ) {
    const evidence = this.getEvidence(evidenceId);
    const audit_history = appendCanopyProofAuditEvent(evidence.audit_history, {
      action: input.action,
      actor: input.actor,
      entityType: input.entityType,
      entityId: evidenceId,
      payload: input.payload,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      rationale: input.rationale,
    });
    const updated: CanopyProofEvidenceEnvelope = {
      ...evidence,
      ...(input.verification_status ? { verification_status: input.verification_status } : {}),
      ...(input.confidence_score !== undefined ? { confidence_score: input.confidence_score } : {}),
      ...(input.reviewers ? { reviewers: [...new Set([...evidence.reviewers, ...input.reviewers])].sort() } : {}),
      audit_history,
    };
    const auditEvent = audit_history.at(-1);
    if (!auditEvent) {
      throw new Error(`CanopyProof evidence audit event was not appended: ${evidenceId}`);
    }
    this.evidenceById.set(evidenceId, updated);
    return {
      evidence: updated,
      auditEvent,
    };
  }

  analyzeEvidence(evidenceId: string, input: unknown) {
    const evidence = this.getEvidence(evidenceId);
    const parsed = aiAnalysisRequestSchema.parse(input);
    const knownMediaHashes = [
      ...new Set([
        ...parsed.knownMediaHashes.map((hash) => hash.toLowerCase()),
        ...this.listEvidence()
          .filter((item) => item.id !== evidence.id)
          .map((item) => item.media_hash),
      ]),
    ];
    const analysisInput: BuildCanopyAiAnalysisInput = {
      evidence,
      ...(parsed.modelVersion ? { modelVersion: parsed.modelVersion } : {}),
      ...(parsed.observedAt ? { observedAt: parsed.observedAt } : {}),
      knownMediaHashes,
      ...(parsed.expectedLocation ? { expectedLocation: compactLocation(parsed.expectedLocation) } : {}),
      ...(parsed.satelliteObservation
        ? {
            satelliteObservation: {
              vegetationSignal: parsed.satelliteObservation.vegetationSignal,
              acquiredAt: parsed.satelliteObservation.acquiredAt,
              ...(parsed.satelliteObservation.waterSignal ? { waterSignal: parsed.satelliteObservation.waterSignal } : {}),
            },
          }
        : {}),
      ...(parsed.ecologicalObservation
        ? {
            ecologicalObservation: {
              observedAt: parsed.ecologicalObservation.observedAt,
              ...(parsed.ecologicalObservation.biodiversitySignal
                ? { biodiversitySignal: parsed.ecologicalObservation.biodiversitySignal }
                : {}),
              ...(parsed.ecologicalObservation.soilMoistureSignal
                ? { soilMoistureSignal: parsed.ecologicalObservation.soilMoistureSignal }
                : {}),
              ...(parsed.ecologicalObservation.disturbanceSignal
                ? { disturbanceSignal: parsed.ecologicalObservation.disturbanceSignal }
                : {}),
            },
          }
        : {}),
      ...(parsed.survivalObservation
        ? {
            survivalObservation: {
              survivalSignal: parsed.survivalObservation.survivalSignal,
              observedAt: parsed.survivalObservation.observedAt,
              ...(parsed.survivalObservation.estimatedSurvivalPercent !== undefined
                ? { estimatedSurvivalPercent: parsed.survivalObservation.estimatedSurvivalPercent }
                : {}),
              ...(parsed.survivalObservation.mortalityPercent !== undefined
                ? { mortalityPercent: parsed.survivalObservation.mortalityPercent }
                : {}),
              ...(parsed.survivalObservation.method ? { method: parsed.survivalObservation.method } : {}),
            },
          }
        : {}),
    };
    const analysis = buildCanopyAiAnalysis(analysisInput);
    const updatedEvidence: CanopyProofEvidenceEnvelope = {
      ...evidence,
      verification_status: "needs_human_review",
      confidence_score: Math.min(evidence.confidence_score, analysis.confidence_score),
      audit_history: [...evidence.audit_history, analysis.audit_event],
    };

    this.evidenceById.set(evidence.id, updatedEvidence);
    this.analysesByEvidenceId.set(evidence.id, [...(this.analysesByEvidenceId.get(evidence.id) ?? []), analysis]);
    return {
      analysis,
      evidence: updatedEvidence,
    };
  }

  issueProofRecord(input: unknown) {
    const parsed = proofRecordIssueSchema.parse(input);
    const evidence = parsed.evidenceIds.map((evidenceId) => {
      const current = this.getEvidence(evidenceId);
      return {
        ...current,
        verification_status: "accepted" as const,
        reviewers: [...new Set([...current.reviewers, parsed.humanReview.reviewer])],
      };
    });
    const aiAnalyses = parsed.evidenceIds.map((evidenceId) => {
      const analyses = this.analysesByEvidenceId.get(evidenceId) ?? [];
      const latest = analyses.at(-1);
      if (!latest) {
        throw new Error(`AI advisory analysis is required before proof issuance: ${evidenceId}`);
      }
      return latest;
    });
    const record = issueEnvironmentalProofRecord({
      projectId: parsed.projectId,
      evidence,
      aiAnalyses,
      humanReview: {
        reviewer: parsed.humanReview.reviewer,
        role: parsed.humanReview.role,
        decision: parsed.humanReview.decision,
        rationale: parsed.humanReview.rationale,
        reviewedAt: parsed.humanReview.reviewedAt,
        ...(parsed.humanReview.acceptedFindingIds ? { acceptedFindingIds: parsed.humanReview.acceptedFindingIds } : {}),
      },
      governanceApprovals: parsed.governanceApprovals,
      monitoringTimeline: parsed.monitoringTimeline,
      monitoringEventIds: parsed.monitoringEventIds,
      ...(parsed.issuedAt ? { issuedAt: parsed.issuedAt } : {}),
    });

    for (const item of evidence) {
      this.evidenceById.set(item.id, item);
    }
    this.recordsById.set(record.id, record);
    return record;
  }

  listProofRecords() {
    return [...this.recordsById.values()].sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  }

  getProofRecord(recordId: string) {
    const record = this.recordsById.get(recordId);
    if (!record) {
      throw new Error(`CanopyProof proof record not found: ${recordId}`);
    }
    return record;
  }

  getProofRecordCertificate(
    recordId: string,
    governanceApprovals: readonly CanopyProofCertificateGovernanceApprovalSummary[],
    monitoringEvents: readonly CanopyProofCertificateMonitoringEventSummary[] = [],
  ): CanopyProofCertificateArtifact {
    const record = this.getProofRecord(recordId);
    const evidence = record.evidenceIds.map((evidenceId) => {
      const envelope = this.evidenceById.get(evidenceId);
      if (!envelope) {
        throw new Error(`CanopyProof proof record evidence not found: ${evidenceId}`);
      }
      return envelope;
    });
    const publicChallenges = this.listProofRecordChallenges(recordId).map((challenge) => ({
      id: challenge.id,
      reason: challenge.reason,
      severity: challenge.severity,
      status: challenge.status,
      evidenceRoot: challenge.evidenceRoot,
      submittedAt: challenge.submittedAt,
      publicOutcome: challenge.publicOutcome,
    }));
    const governanceApprovalById = new Map(governanceApprovals.map((approval) => [approval.id, approval]));
    const missingGovernanceApprovals = record.governanceApprovals.filter((approvalId) => !governanceApprovalById.has(approvalId));
    if (missingGovernanceApprovals.length > 0) {
      throw new Error(`CanopyProof certificate artifact requires governance approval summaries: ${missingGovernanceApprovals.join(",")}`);
    }
    const orderedGovernanceApprovals = record.governanceApprovals.map((approvalId) => {
      const approval = governanceApprovalById.get(approvalId);
      if (!approval) {
        throw new Error(`CanopyProof certificate artifact requires governance approval summary: ${approvalId}`);
      }
      if (approval.subjectType !== "proof_record" || approval.decision !== "approve") {
        throw new Error(`CanopyProof certificate artifact cannot include non-approved proof-record governance approval: ${approval.id}`);
      }
      return approval;
    });
    const monitoringEventById = new Map(monitoringEvents.map((event) => [event.id, event]));
    const missingMonitoringEvents = record.monitoringEventIds.filter((eventId) => !monitoringEventById.has(eventId));
    if (missingMonitoringEvents.length > 0) {
      throw new Error(`CanopyProof certificate artifact requires project monitoring event summaries: ${missingMonitoringEvents.join(",")}`);
    }
    const orderedMonitoringEvents = record.monitoringEventIds.map((eventId) => {
      const event = monitoringEventById.get(eventId);
      if (!event) {
        throw new Error(`CanopyProof certificate artifact requires project monitoring event summary: ${eventId}`);
      }
      if (event.projectId !== record.projectId) {
        throw new Error(`CanopyProof certificate artifact monitoring event ${event.id} belongs to a different project.`);
      }
      return event;
    });
    const monitoringEventRoot =
      orderedMonitoringEvents.length > 0
        ? merkleRoot(orderedMonitoringEvents.map((event) => event.eventHash).sort())
        : hashJson({ kind: "canopyproof-empty-certificate-monitoring-root-v1", recordId: record.id });
    const certificateSeed = {
      kind: "canopyproof-certificate-artifact-v1",
      recordId: record.id,
      sourceRecordHash: record.recordHash,
      evidenceRoot: record.evidenceRoot,
      monitoringEventRoot,
    };
    const certificateId = `cp_cert_${hashJson(certificateSeed).slice(0, 24)}`;
    const artifactBase = {
      certificateId,
      certificateVersion: "canopyproof_certificate_artifact_v1" as const,
      recordId: record.id,
      recordType: record.recordType,
      project: {
        id: record.projectId,
        evidenceCount: record.evidenceIds.length,
      },
      location: {
        primary: record.location,
        evidenceLocations: evidence.map((item) => item.location),
      },
      evidenceRoot: record.evidenceRoot,
      evidenceIds: record.evidenceIds,
      verificationHistory: record.verificationHistory,
      monitoringTimeline: record.monitoringTimeline,
      monitoringEventIds: record.monitoringEventIds,
      monitoringEventRoot,
      projectMonitoringEvents: orderedMonitoringEvents,
      contributors: record.contributors,
      governanceApprovalIds: record.governanceApprovals,
      governanceApprovals: orderedGovernanceApprovals,
      publicChallenges,
      status: record.status,
      issuedAt: record.issuedAt,
      sourceRecordHash: record.recordHash,
      claimBoundary: record.claimBoundary,
      disclosure: record.claimBoundary.disclosure,
    };

    return {
      ...artifactBase,
      certificateHash: hashJson(artifactBase),
    };
  }

  challengeProofRecord(recordId: string, input: unknown, actorId: string) {
    const record = this.getProofRecord(recordId);
    if (record.status === "revoked") {
      throw new Error(`CanopyProof proof record is already revoked: ${recordId}`);
    }
    const parsed = proofRecordChallengeSchema.parse(input);
    const submittedAt = parsed.submittedAt ?? new Date(0).toISOString();
    const evidenceIds = [...new Set(parsed.evidenceIds)].sort();
    const evidenceHashes = [...new Set(parsed.evidenceHashes.map((hash) => hash.toLowerCase()))].sort();
    const evidenceRoot = merkleRoot([
      ...evidenceIds.map((evidenceId) => hashJson({ kind: "canopyproof-proof-challenge-evidence-id-v1", evidenceId })),
      ...evidenceHashes,
    ]);
    const challengeSeed = {
      recordId,
      recordHash: record.recordHash,
      projectId: record.projectId,
      challenger: actorId,
      reason: parsed.reason,
      severity: parsed.severity,
      description: parsed.description,
      evidenceIds,
      evidenceHashes,
      evidenceRoot,
      abuseControlPolicyId: parsed.abuseControlPolicyId,
      bondRequired: parsed.bondRequired,
      bondWaivedReason: parsed.bondWaivedReason,
      submittedAt,
    };
    const challengeHash = hashJson({ kind: "canopyproof-proof-record-challenge-v1", ...challengeSeed });
    const id = parsed.id ?? `cp_record_challenge_${challengeHash.slice(0, 24)}`;
    if (this.proofRecordChallengesById.has(id)) {
      throw new Error(`CanopyProof proof record challenge already exists: ${id}`);
    }
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "CHALLENGE",
      actor: actorId,
      entityType: "proof_record_challenge",
      entityId: id,
      payload: challengeSeed,
      createdAt: submittedAt,
      rationale: "Public challenge opened against an Environmental Proof Record and routed to human review.",
    });
    const challenge: CanopyProofProofRecordChallenge = {
      id,
      recordId,
      projectId: record.projectId,
      challenger: actorId,
      reason: parsed.reason,
      severity: parsed.severity,
      status: "open",
      description: parsed.description,
      evidenceIds,
      evidenceHashes,
      evidenceRoot,
      abuseControlPolicyId: parsed.abuseControlPolicyId,
      bondRequired: parsed.bondRequired,
      bondWaivedReason: parsed.bondWaivedReason,
      submittedAt,
      publicOutcome: "Challenge is open and awaiting accredited human review.",
      challengeHash,
      auditHistory,
    };
    const recordAuditHistory = appendCanopyProofAuditEvent(record.verificationHistory, {
      action: "CHALLENGE",
      actor: actorId,
      entityType: "proof_record",
      entityId: record.id,
      payload: {
        challengeId: challenge.id,
        reason: challenge.reason,
        severity: challenge.severity,
        evidenceRoot: challenge.evidenceRoot,
      },
      createdAt: submittedAt,
      rationale: "Environmental Proof Record status changed to challenged while public challenge is reviewed.",
    });
    this.proofRecordChallengesById.set(challenge.id, challenge);
    this.proofRecordChallengeIdsByRecordId.set(record.id, [...(this.proofRecordChallengeIdsByRecordId.get(record.id) ?? []), challenge.id]);
    this.recordsById.set(record.id, {
      ...record,
      status: "challenged",
      verificationHistory: recordAuditHistory,
    });
    return {
      challenge,
      record: this.getProofRecord(record.id),
    };
  }

  resolveProofRecordChallenge(recordId: string, challengeId: string, input: unknown, actorId: string) {
    const record = this.getProofRecord(recordId);
    const challenge = this.getProofRecordChallenge(challengeId);
    if (challenge.recordId !== recordId) {
      throw new Error(`CanopyProof proof record challenge ${challengeId} does not belong to ${recordId}.`);
    }
    if (challenge.status !== "open") {
      throw new Error(`CanopyProof proof record challenge is already resolved: ${challengeId}`);
    }
    const parsed = proofRecordChallengeResolutionSchema.parse(input);
    const resolvedAt = parsed.resolvedAt ?? new Date(0).toISOString();
    const status = parsed.decision === "accept" ? "accepted" : "rejected";
    const auditHistory = appendCanopyProofAuditEvent(challenge.auditHistory, {
      action: parsed.decision === "accept" ? "CHALLENGE" : "FULFILL",
      actor: actorId,
      entityType: "proof_record_challenge",
      entityId: challenge.id,
      payload: {
        decision: parsed.decision,
        rationale: parsed.rationale,
        publicOutcome: parsed.publicOutcome,
        resolvedAt,
      },
      createdAt: resolvedAt,
      rationale: "Proof record challenge resolved by an accountable human reviewer.",
    });
    const resolvedChallenge: CanopyProofProofRecordChallenge = {
      ...challenge,
      status,
      resolvedAt,
      resolvedBy: actorId,
      resolutionRationale: parsed.rationale,
      publicOutcome: parsed.publicOutcome,
      auditHistory,
    };
    this.proofRecordChallengesById.set(challenge.id, resolvedChallenge);

    const otherBlockingChallenge = this.listProofRecordChallenges(recordId).some(
      (item) => item.id !== challenge.id && (item.status === "open" || item.status === "accepted"),
    );
    const recordStatus: EnvironmentalProofRecord["status"] =
      parsed.decision === "accept" ? "revoked" : otherBlockingChallenge ? "challenged" : "issued";
    const recordAuditHistory = appendCanopyProofAuditEvent(record.verificationHistory, {
      action: parsed.decision === "accept" ? "CHALLENGE" : "FULFILL",
      actor: actorId,
      entityType: "proof_record",
      entityId: record.id,
      payload: {
        challengeId: challenge.id,
        decision: parsed.decision,
        publicOutcome: parsed.publicOutcome,
        nextStatus: recordStatus,
      },
      createdAt: resolvedAt,
      rationale:
        parsed.decision === "accept"
          ? "Proof record challenge accepted; Environmental Proof Record revoked for public accountability."
          : "Proof record challenge rejected; Environmental Proof Record status restored if no other challenges remain.",
    });
    this.recordsById.set(record.id, {
      ...record,
      status: recordStatus,
      verificationHistory: recordAuditHistory,
    });
    return {
      challenge: resolvedChallenge,
      record: this.getProofRecord(record.id),
    };
  }

  listProofRecordChallenges(recordId?: string) {
    const challenges = recordId
      ? (this.proofRecordChallengeIdsByRecordId.get(recordId) ?? []).map((id) => this.getProofRecordChallenge(id))
      : [...this.proofRecordChallengesById.values()];
    return challenges.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || left.id.localeCompare(right.id));
  }

  getProofRecordChallenge(challengeId: string) {
    const challenge = this.proofRecordChallengesById.get(challengeId);
    if (!challenge) {
      throw new Error(`CanopyProof proof record challenge not found: ${challengeId}`);
    }
    return challenge;
  }

  generateEsgReport(input: unknown) {
    const parsed = esgReportGenerateSchema.parse(input);
    const proofRecords =
      parsed.proofRecordIds && parsed.proofRecordIds.length > 0
        ? parsed.proofRecordIds.map((recordId) => this.getProofRecord(recordId))
        : this.listProofRecords().filter((record) => record.projectId === parsed.projectId);
    const report = buildCanopyProofEsgReport({
      projectId: parsed.projectId,
      organizationName: parsed.organizationName,
      reportingPeriod: parsed.reportingPeriod,
      generatedBy: parsed.generatedBy,
      proofRecords,
      ...(parsed.generatedAt ? { generatedAt: parsed.generatedAt } : {}),
      ...(parsed.frameworks ? { frameworks: parsed.frameworks } : {}),
      ...(parsed.materialTopics ? { materialTopics: parsed.materialTopics } : {}),
    });
    this.esgReportsById.set(report.id, report);
    return report;
  }

  listEsgReports() {
    return [...this.esgReportsById.values()].sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  }

  getEsgReport(reportId: string) {
    const report = this.esgReportsById.get(reportId);
    if (!report) {
      throw new Error(`CanopyProof ESG report not found: ${reportId}`);
    }
    return report;
  }

  exportEsgReportJson(reportId: string) {
    return serializeCanopyProofEsgReportJson(this.getEsgReport(reportId));
  }

  exportEsgReportPdf(reportId: string) {
    return renderCanopyProofEsgReportPdf(this.getEsgReport(reportId));
  }

  getStatus() {
    return {
      service: "canopyproof-os-proof-engine",
      evidenceCount: this.evidenceById.size,
      aiAnalysisCount: [...this.analysesByEvidenceId.values()].reduce((sum, analyses) => sum + analyses.length, 0),
      proofRecordCount: this.recordsById.size,
      proofRecordChallengeCount: this.proofRecordChallengesById.size,
      openProofRecordChallengeCount: this.listProofRecordChallenges().filter((challenge) => challenge.status === "open").length,
      revokedProofRecordCount: this.listProofRecords().filter((record) => record.status === "revoked").length,
      esgReportCount: this.esgReportsById.size,
      claimBoundary: environmentalProofClaimBoundary(),
    };
  }
}

function compactLocation(location: z.infer<typeof locationSchema>): CanopyProofLocation {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    ...(location.accuracyMeters !== undefined ? { accuracyMeters: location.accuracyMeters } : {}),
    ...(location.regionId ? { regionId: location.regionId } : {}),
  };
}
