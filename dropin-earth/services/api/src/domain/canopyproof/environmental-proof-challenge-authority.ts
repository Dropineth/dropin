import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  CanopyProofEnvironmentalProofAuthorityService,
  type CanopyProofEnvironmentalProofAuthoritySnapshot,
  type CanopyProofEnvironmentalProofAuthoritySources,
  type CanopyProofEnvironmentalProofRecordState,
} from "./environmental-proof-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  appendCanopyProofAuditEvent,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofEnvironmentalProofChallengeReasons = [
  "evidence_integrity",
  "methodology_defect",
  "monitoring_contradiction",
  "location_conflict",
  "identity_conflict",
  "undisclosed_conflict",
  "governance_failure",
  "external_observation",
  "other",
] as const;
export const canopyProofEnvironmentalProofChallengeSeverities = ["low", "medium", "high", "critical"] as const;
export const canopyProofEnvironmentalProofChallengeReviewDecisions = [
  "uphold",
  "reject",
  "needs_more_evidence",
] as const;
export const canopyProofEnvironmentalProofChallengeResolutionDecisions = ["uphold", "reject"] as const;
export const canopyProofEnvironmentalProofChallengeStates = ["open", "under_review", "resolved", "rejected"] as const;

export type CanopyProofEnvironmentalProofChallengeReason =
  (typeof canopyProofEnvironmentalProofChallengeReasons)[number];
export type CanopyProofEnvironmentalProofChallengeSeverity =
  (typeof canopyProofEnvironmentalProofChallengeSeverities)[number];
export type CanopyProofEnvironmentalProofChallengeReviewDecision =
  (typeof canopyProofEnvironmentalProofChallengeReviewDecisions)[number];
export type CanopyProofEnvironmentalProofChallengeResolutionDecision =
  (typeof canopyProofEnvironmentalProofChallengeResolutionDecisions)[number];
export type CanopyProofEnvironmentalProofChallengeState =
  (typeof canopyProofEnvironmentalProofChallengeStates)[number];

export type CanopyProofEnvironmentalProofChallengeSafetyBoundary = {
  readonly environmentalAccountabilityOnly: true;
  readonly immutableRecordPreserved: true;
  readonly riskSignalAdvisoryOnly: true;
  readonly independentHumanGovernanceRequired: true;
  readonly crossOrganizationStandingGrantsNoDataAccess: true;
  readonly noRawEvidence: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEnvironmentalProofChallenge = {
  readonly factType: "environmental_proof_challenge";
  readonly id: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly candidateId: string;
  readonly candidateRoot: string;
  readonly authorityRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly policyRoot: string;
  readonly challengedRecordState: "issued" | "stale";
  readonly challengedRecordProjectionRoot: string;
  readonly challengedSourceAuthorityCurrent: boolean;
  readonly challengedCurrentAuthorityRoot: string;
  readonly priorChallengeId?: string;
  readonly priorResolutionId?: string;
  readonly priorResolutionRoot?: string;
  readonly reason: CanopyProofEnvironmentalProofChallengeReason;
  readonly severity: CanopyProofEnvironmentalProofChallengeSeverity;
  readonly rationale: string;
  readonly supportingArtifactHashes: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly challenger: CanopyProofVerificationActorSnapshot;
  readonly challengerOrganizationId: string;
  readonly openedAt: string;
  readonly commandHash: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly challengeHash: string;
  readonly challengeRoot: string;
  readonly safety: CanopyProofEnvironmentalProofChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofChallengeRiskSignal = {
  readonly factType: "environmental_proof_challenge_risk";
  readonly id: string;
  readonly challengeId: string;
  readonly challengeRoot: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly reason: CanopyProofEnvironmentalProofChallengeReason;
  readonly riskLevel: CanopyProofEnvironmentalProofChallengeSeverity;
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly detectedBy: CanopyProofVerificationActorSnapshot;
  readonly detectedAt: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly riskHash: string;
  readonly riskRoot: string;
  readonly safety: CanopyProofEnvironmentalProofChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofChallengeReview = {
  readonly factType: "environmental_proof_challenge_review";
  readonly id: string;
  readonly challengeId: string;
  readonly challengeRoot: string;
  readonly riskSignalId: string;
  readonly riskRoot: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly policyRoot: string;
  readonly priorReviewId?: string;
  readonly priorReviewRoot?: string;
  readonly decision: CanopyProofEnvironmentalProofChallengeReviewDecision;
  readonly rationale: string;
  readonly conflictDisclosure: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly reviewedAt: string;
  readonly commandHash: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly reviewHash: string;
  readonly reviewRoot: string;
  readonly safety: CanopyProofEnvironmentalProofChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofChallengeResolution = {
  readonly factType: "environmental_proof_challenge_resolution";
  readonly id: string;
  readonly challengeId: string;
  readonly challengeRoot: string;
  readonly riskSignalId: string;
  readonly riskRoot: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly policyRoot: string;
  readonly reviewIds: readonly string[];
  readonly reviewRoots: readonly string[];
  readonly reviewQuorumRoot: string;
  readonly decision: CanopyProofEnvironmentalProofChallengeResolutionDecision;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly resolver: CanopyProofVerificationActorSnapshot;
  readonly resolvedAt: string;
  readonly commandHash: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly resolutionHash: string;
  readonly resolutionRoot: string;
  readonly safety: CanopyProofEnvironmentalProofChallengeSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofChallengeProjection = {
  readonly challengeId: string;
  readonly challengeRoot: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly state: CanopyProofEnvironmentalProofChallengeState;
  readonly reviewCount: number;
  readonly resolutionId?: string;
  readonly resolutionRoot?: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEnvironmentalProofChallengeSafetyBoundary;
};

export type CanopyProofEnvironmentalProofChallengedRecordProjection = {
  readonly recordId: string;
  readonly recordRoot: string;
  readonly state: CanopyProofEnvironmentalProofRecordState;
  readonly baseState: "issued" | "stale";
  readonly sourceAuthorityCurrent: boolean;
  readonly challengeState?: CanopyProofEnvironmentalProofChallengeState;
  readonly challengeId?: string;
  readonly challengeRoot?: string;
  readonly resolutionId?: string;
  readonly resolutionRoot?: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEnvironmentalProofChallengeSafetyBoundary;
};

export type CanopyProofEnvironmentalProofChallengeAuthoritySnapshot = {
  readonly challenges: readonly CanopyProofEnvironmentalProofChallenge[];
  readonly riskSignals: readonly CanopyProofEnvironmentalProofChallengeRiskSignal[];
  readonly reviews: readonly CanopyProofEnvironmentalProofChallengeReview[];
  readonly resolutions: readonly CanopyProofEnvironmentalProofChallengeResolution[];
};

export type CanopyProofEnvironmentalProofChallengeBundle = {
  readonly challenge: CanopyProofEnvironmentalProofChallenge;
  readonly riskSignal: CanopyProofEnvironmentalProofChallengeRiskSignal;
};

const identifierSchema = z.string().trim().min(1).max(240);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: hashSchema.optional(),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(32).default([]),
    authorityRoot: hashSchema.optional(),
  })
  .strict();

const challengeInputSchema = z
  .object({
    id: identifierSchema.optional(),
    reason: z.enum(canopyProofEnvironmentalProofChallengeReasons),
    severity: z.enum(canopyProofEnvironmentalProofChallengeSeverities),
    rationale: z.string().trim().min(24).max(4_000),
    supportingArtifactHashes: z.array(hashSchema).min(1).max(64),
    sourceEventRoots: z.array(hashSchema).min(1).max(512),
    openedAt: z.string().datetime(),
  })
  .strict();

const reviewInputSchema = z
  .object({
    id: identifierSchema.optional(),
    decision: z.enum(canopyProofEnvironmentalProofChallengeReviewDecisions),
    rationale: z.string().trim().min(24).max(4_000),
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(hashSchema).min(1).max(512),
    reviewedAt: z.string().datetime(),
  })
  .strict();

const resolutionInputSchema = z
  .object({
    id: identifierSchema.optional(),
    reviewIds: z.array(identifierSchema).min(2).max(32),
    decision: z.enum(canopyProofEnvironmentalProofChallengeResolutionDecisions),
    rationale: z.string().trim().min(24).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(hashSchema).min(1).max(512),
    resolvedAt: z.string().datetime(),
  })
  .strict();

export class CanopyProofEnvironmentalProofChallengeAuthorityService {
  private readonly proof: CanopyProofEnvironmentalProofAuthorityService;
  private readonly challengesById = new Map<string, CanopyProofEnvironmentalProofChallenge>();
  private readonly challengeIdsByRecordId = new Map<string, string[]>();
  private readonly riskSignalsById = new Map<string, CanopyProofEnvironmentalProofChallengeRiskSignal>();
  private readonly riskSignalIdByChallengeId = new Map<string, string>();
  private readonly reviewsById = new Map<string, CanopyProofEnvironmentalProofChallengeReview>();
  private readonly reviewIdsByChallengeId = new Map<string, string[]>();
  private readonly resolutionsById = new Map<string, CanopyProofEnvironmentalProofChallengeResolution>();
  private readonly resolutionIdByChallengeId = new Map<string, string>();
  private readonly eventsByRecordId = new Map<string, CanopyProofAuditEvent[]>();

  constructor(proofSnapshot: CanopyProofEnvironmentalProofAuthoritySnapshot) {
    this.proof = CanopyProofEnvironmentalProofAuthorityService.fromAuthoritySnapshot(proofSnapshot);
    for (const record of this.proof.listRecords()) {
      const candidate = this.proof.getCandidate(record.candidateId);
      const events = [
        candidate.auditEvent,
        ...this.proof.listApprovals(candidate.id).map((approval) => approval.auditEvent),
        record.auditEvent,
      ];
      this.eventsByRecordId.set(record.id, events);
    }
  }

  static fromAuthoritySnapshot(
    proofSnapshot: CanopyProofEnvironmentalProofAuthoritySnapshot,
    snapshot: CanopyProofEnvironmentalProofChallengeAuthoritySnapshot,
  ) {
    const service = new CanopyProofEnvironmentalProofChallengeAuthorityService(proofSnapshot);
    const factIds = new Set<string>();
    for (const fact of [...snapshot.challenges, ...snapshot.riskSignals, ...snapshot.reviews, ...snapshot.resolutions]) {
      if (factIds.has(fact.id)) {
        throw new Error(`CanopyProof Environmental Proof challenge snapshot contains duplicate fact id: ${fact.id}`);
      }
      factIds.add(fact.id);
    }
    for (const challenge of [...snapshot.challenges].sort(
      (left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id),
    )) {
      const risk = snapshot.riskSignals.find((item) => item.challengeId === challenge.id);
      if (!risk) throw new Error(`CanopyProof Environmental Proof challenge risk signal is missing: ${challenge.id}`);
      service.replayChallengeBundle(challenge, risk);
    }
    if (service.riskSignalsById.size !== snapshot.riskSignals.length) {
      throw new Error("CanopyProof Environmental Proof challenge snapshot contains an orphan risk signal.");
    }
    for (const review of [...snapshot.reviews].sort(
      (left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id),
    )) {
      const replayed = service.reviewChallenge(
        review.challengeId,
        {
          id: review.id,
          decision: review.decision,
          rationale: review.rationale,
          conflictDisclosure: review.conflictDisclosure,
          limitations: review.limitations,
          sourceEventRoots: review.sourceEventRoots,
          reviewedAt: review.reviewedAt,
        },
        review.reviewer,
      );
      assertFactReplay(replayed, review, `challenge review ${review.id}`);
    }
    for (const resolution of [...snapshot.resolutions].sort(
      (left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id),
    )) {
      const replayed = service.resolveChallenge(
        resolution.challengeId,
        {
          id: resolution.id,
          reviewIds: resolution.reviewIds,
          decision: resolution.decision,
          rationale: resolution.rationale,
          limitations: resolution.limitations,
          sourceEventRoots: resolution.sourceEventRoots,
          resolvedAt: resolution.resolvedAt,
        },
        resolution.resolver,
      );
      assertFactReplay(replayed, resolution, `challenge resolution ${resolution.id}`);
    }
    return service;
  }

  openChallenge(
    recordId: string,
    input: unknown,
    actorInput: unknown,
    currentSources: CanopyProofEnvironmentalProofAuthoritySources,
  ): CanopyProofEnvironmentalProofChallengeBundle {
    const parsed = challengeInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    assertHumanMember(actor, actor.organizationId, ["owner", "admin", "verifier", "researcher"]);
    const record = this.proof.getRecord(recordId);
    const candidate = this.proof.getCandidate(record.candidateId);
    const baseProjection = this.proof.projectRecordStatus(recordId, currentSources);
    const priorChallenge = this.listChallenges(recordId).at(-1);
    const priorResolution = priorChallenge ? this.getResolutionForChallengeOptional(priorChallenge.id) : undefined;
    const supportingArtifactHashes = canonicalHashes(parsed.supportingArtifactHashes, "challenge artifact hash");
    const sourceEventRoots = canonicalHashes(parsed.sourceEventRoots, "challenge source event root");
    const events = this.requireRecordEvents(recordId);
    requireKnownEvents(sourceEventRoots, events, "challenge source event");
    if (!sourceEventRoots.includes(record.auditEvent.eventRoot)) {
      throw new Error("CanopyProof Environmental Proof challenge must bind the record event.");
    }
    if (priorResolution && !sourceEventRoots.includes(priorResolution.auditEvent.eventRoot)) {
      throw new Error("CanopyProof Environmental Proof successor challenge must bind the prior resolution event.");
    }
    assertMonotonicTime(events, parsed.openedAt);
    assertSafeText([parsed.id ?? "", parsed.rationale]);
    const commandSeed = {
      recordId,
      recordRoot: record.recordRoot,
      candidateId: candidate.id,
      candidateRoot: candidate.candidateRoot,
      authorityRoot: record.authorityRoot,
      organizationId: record.organizationId,
      projectId: record.projectId,
      policyId: candidate.policyId,
      policyHash: candidate.policyHash,
      policyRoot: candidate.policyRoot,
      challengedRecordState: baseProjection.state as "issued" | "stale",
      challengedRecordProjectionRoot: baseProjection.projectionRoot,
      challengedSourceAuthorityCurrent: baseProjection.sourceAuthorityCurrent,
      challengedCurrentAuthorityRoot: baseProjection.currentAuthorityRoot,
      ...(priorChallenge && priorResolution
        ? {
            priorChallengeId: priorChallenge.id,
            priorResolutionId: priorResolution.id,
            priorResolutionRoot: priorResolution.resolutionRoot,
          }
        : {}),
      reason: parsed.reason,
      severity: parsed.severity,
      rationale: parsed.rationale,
      supportingArtifactHashes,
      sourceEventRoots,
      challenger: actor,
      challengerOrganizationId: actor.organizationId,
      openedAt: parsed.openedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-environmental-proof-challenge-command-v1", ...commandSeed });
    const id = `cp_environmental_proof_challenge_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof Environmental Proof challenge id does not match its canonical command hash.");
    }
    const existing = this.challengesById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return this.getChallengeBundle(id);
      throw new Error(`CanopyProof Environmental Proof challenge conflicts with committed authority: ${id}`);
    }
    if (priorChallenge && !priorResolution) {
      throw new Error("CanopyProof Environmental Proof record already has an unresolved challenge.");
    }
    if (priorResolution?.decision === "uphold") {
      throw new Error("CanopyProof Environmental Proof revoked record cannot accept another challenge.");
    }
    return this.appendChallengeBundle({ id, ...commandSeed, commandHash }, events);
  }

  reviewChallenge(challengeId: string, input: unknown, actorInput: unknown): CanopyProofEnvironmentalProofChallengeReview {
    const challenge = this.getChallenge(challengeId);
    if (this.resolutionIdByChallengeId.has(challengeId)) {
      throw new Error("CanopyProof Environmental Proof challenge is already resolved.");
    }
    const parsed = reviewInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    const candidate = this.proof.getCandidate(challenge.candidateId);
    const record = this.proof.getRecord(challenge.recordId);
    assertHumanMember(actor, challenge.organizationId, ["owner", "admin", "verifier"]);
    if (!candidate.allowedReviewerRoles.includes(actor.role as "owner" | "admin" | "verifier")) {
      throw new Error("CanopyProof Environmental Proof policy does not authorize this challenge reviewer role.");
    }
    if (actor.role === "verifier") requireAccreditation(actor);
    const reviews = this.listReviews(challengeId);
    const existingActorReview = reviews.find((review) => review.reviewer.id === actor.id);
    const limitations = canonicalStrings(parsed.limitations, "challenge review limitation");
    const sourceEventRoots = canonicalHashes(parsed.sourceEventRoots, "challenge review source event root");
    assertSafeText([parsed.id ?? "", parsed.rationale, parsed.conflictDisclosure, ...limitations]);
    if (existingActorReview) {
      const prior = existingActorReview.priorReviewId
        ? this.getReview(existingActorReview.priorReviewId)
        : undefined;
      const retryCommandHash = challengeReviewCommandHash({
        challenge,
        risk: this.getRiskSignalForChallenge(challengeId),
        ...(prior ? { prior } : {}),
        decision: parsed.decision,
        rationale: parsed.rationale,
        conflictDisclosure: parsed.conflictDisclosure,
        limitations,
        sourceEventRoots,
        reviewer: actor,
        reviewedAt: parsed.reviewedAt,
      });
      const retryId = `cp_environmental_proof_challenge_review_${retryCommandHash.slice(0, 24)}`;
      if ((!parsed.id || parsed.id === retryId) && existingActorReview.commandHash === retryCommandHash) {
        return existingActorReview;
      }
      throw new Error("CanopyProof Environmental Proof challenge requires a unique independent reviewer.");
    }
    const candidateApproverIds = this.proof.listApprovals(candidate.id).map((approval) => approval.approver.id);
    if (
      actor.id === challenge.challenger.id ||
      actor.id === record.issuer.id ||
      actor.id === candidate.derivedBy.id ||
      candidate.sourceActorIds.includes(actor.id) ||
      candidateApproverIds.includes(actor.id)
    ) {
      throw new Error("CanopyProof Environmental Proof challenge review requires an independent human reviewer.");
    }
    const risk = this.getRiskSignalForChallenge(challengeId);
    const prior = reviews.at(-1);
    const events = this.requireRecordEvents(challenge.recordId);
    requireKnownEvents(sourceEventRoots, events, "challenge review source event");
    for (const requiredRoot of [challenge.auditEvent.eventRoot, risk.auditEvent.eventRoot, prior?.auditEvent.eventRoot]) {
      if (requiredRoot && !sourceEventRoots.includes(requiredRoot)) {
        throw new Error(`CanopyProof Environmental Proof challenge review omits required authority event: ${requiredRoot}`);
      }
    }
    assertMonotonicTime(events, parsed.reviewedAt);
    const commandHash = challengeReviewCommandHash({
      challenge,
      risk,
      ...(prior ? { prior } : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      limitations,
      sourceEventRoots,
      reviewer: actor,
      reviewedAt: parsed.reviewedAt,
    });
    const id = `cp_environmental_proof_challenge_review_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof Environmental Proof challenge review id does not match its canonical command hash.");
    }
    const sourceRoot = merkleRoot(
      [challenge.challengeRoot, risk.riskRoot, ...sourceEventRoots, ...(prior ? [prior.reviewRoot] : [])].sort(),
    );
    const recordSequence = events.length + 1;
    const previousEventRoot = events.at(-1)!.eventRoot;
    const seed = {
      challengeId,
      challengeRoot: challenge.challengeRoot,
      riskSignalId: risk.id,
      riskRoot: risk.riskRoot,
      recordId: record.id,
      recordRoot: record.recordRoot,
      organizationId: record.organizationId,
      projectId: record.projectId,
      policyId: challenge.policyId,
      policyHash: challenge.policyHash,
      policyRoot: challenge.policyRoot,
      ...(prior ? { priorReviewId: prior.id, priorReviewRoot: prior.reviewRoot } : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      limitations,
      sourceEventRoots,
      sourceRoot,
      reviewer: actor,
      reviewedAt: parsed.reviewedAt,
      commandHash,
      recordSequence,
      previousEventRoot,
    };
    const reviewHash = hashJson({ kind: "canopyproof-environmental-proof-challenge-review-v1", ...seed });
    const reviewRoot = hashJson({
      kind: "canopyproof-environmental-proof-challenge-review-root-v1",
      challengeRoot: challenge.challengeRoot,
      riskRoot: risk.riskRoot,
      sourceRoot,
      reviewHash,
      previousEventRoot,
      recordSequence,
    });
    const safety = challengeSafetyBoundary();
    const payload = {
      factType: "environmental_proof_challenge_review",
      id,
      ...seed,
      reviewHash,
      reviewRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: parsed.decision === "uphold" ? "CHALLENGE" : "REASON",
      actor: actor.id,
      entityType: "environmental_proof_challenge_review",
      entityId: id,
      payload,
      createdAt: parsed.reviewedAt,
      rationale: parsed.rationale,
    }).at(-1)!;
    const review: CanopyProofEnvironmentalProofChallengeReview = {
      factType: "environmental_proof_challenge_review",
      id,
      ...seed,
      reviewHash,
      reviewRoot,
      safety,
      auditEvent,
    };
    this.reviewsById.set(id, review);
    this.reviewIdsByChallengeId.set(challengeId, [...reviews.map((item) => item.id), id]);
    this.eventsByRecordId.set(record.id, [...events, auditEvent]);
    return review;
  }

  resolveChallenge(
    challengeId: string,
    input: unknown,
    actorInput: unknown,
  ): CanopyProofEnvironmentalProofChallengeResolution {
    const challenge = this.getChallenge(challengeId);
    const parsed = resolutionInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    const candidate = this.proof.getCandidate(challenge.candidateId);
    const record = this.proof.getRecord(challenge.recordId);
    assertHumanMember(actor, challenge.organizationId, ["owner", "admin"]);
    const reviews = this.listReviews(challengeId);
    const reviewIds = canonicalStrings(parsed.reviewIds, "challenge resolution review id");
    if (hashJson(reviewIds) !== hashJson(reviews.map((review) => review.id).sort())) {
      throw new Error("CanopyProof Environmental Proof challenge resolution must bind the complete review set.");
    }
    assertReviewQuorum(candidate.requiredApprovals, reviews, parsed.decision);
    const existingId = this.resolutionIdByChallengeId.get(challengeId);
    const existing = existingId ? this.resolutionsById.get(existingId) : undefined;
    const limitations = canonicalStrings(parsed.limitations, "challenge resolution limitation");
    const sourceEventRoots = canonicalHashes(parsed.sourceEventRoots, "challenge resolution source event root");
    assertSafeText([parsed.id ?? "", parsed.rationale, ...limitations]);
    const risk = this.getRiskSignalForChallenge(challengeId);
    const reviewRoots = reviews.map((review) => review.reviewRoot).sort();
    const reviewQuorumRoot = merkleRoot(reviewRoots);
    const commandHash = challengeResolutionCommandHash({
      challenge,
      risk,
      reviewIds,
      reviewRoots,
      reviewQuorumRoot,
      decision: parsed.decision,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      resolver: actor,
      resolvedAt: parsed.resolvedAt,
    });
    const id = `cp_environmental_proof_challenge_resolution_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof Environmental Proof challenge resolution id does not match its canonical command hash.");
    }
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof Environmental Proof challenge already has a conflicting terminal resolution.");
    }
    const candidateApproverIds = this.proof.listApprovals(candidate.id).map((approval) => approval.approver.id);
    if (
      actor.id === challenge.challenger.id ||
      actor.id === record.issuer.id ||
      actor.id === candidate.derivedBy.id ||
      candidate.sourceActorIds.includes(actor.id) ||
      candidateApproverIds.includes(actor.id) ||
      reviews.some((review) => review.reviewer.id === actor.id)
    ) {
      throw new Error("CanopyProof Environmental Proof challenge resolution requires an independent human resolver.");
    }
    const events = this.requireRecordEvents(record.id);
    requireKnownEvents(sourceEventRoots, events, "challenge resolution source event");
    const requiredEvents = [
      challenge.auditEvent.eventRoot,
      risk.auditEvent.eventRoot,
      ...reviews.map((review) => review.auditEvent.eventRoot),
    ];
    const missing = requiredEvents.find((root) => !sourceEventRoots.includes(root));
    if (missing) throw new Error(`CanopyProof Environmental Proof challenge resolution omits authority event: ${missing}`);
    assertMonotonicTime(events, parsed.resolvedAt);
    const sourceRoot = merkleRoot(
      [challenge.challengeRoot, risk.riskRoot, ...reviewRoots, ...sourceEventRoots].sort(),
    );
    const recordSequence = events.length + 1;
    const previousEventRoot = events.at(-1)!.eventRoot;
    const seed = {
      challengeId,
      challengeRoot: challenge.challengeRoot,
      riskSignalId: risk.id,
      riskRoot: risk.riskRoot,
      recordId: record.id,
      recordRoot: record.recordRoot,
      organizationId: record.organizationId,
      projectId: record.projectId,
      policyId: challenge.policyId,
      policyHash: challenge.policyHash,
      policyRoot: challenge.policyRoot,
      reviewIds,
      reviewRoots,
      reviewQuorumRoot,
      decision: parsed.decision,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      sourceRoot,
      resolver: actor,
      resolvedAt: parsed.resolvedAt,
      commandHash,
      recordSequence,
      previousEventRoot,
    };
    const resolutionHash = hashJson({ kind: "canopyproof-environmental-proof-challenge-resolution-v1", ...seed });
    const resolutionRoot = hashJson({
      kind: "canopyproof-environmental-proof-challenge-resolution-root-v1",
      challengeRoot: challenge.challengeRoot,
      riskRoot: risk.riskRoot,
      reviewQuorumRoot,
      sourceRoot,
      resolutionHash,
      previousEventRoot,
      recordSequence,
    });
    const safety = challengeSafetyBoundary();
    const payload = {
      factType: "environmental_proof_challenge_resolution",
      id,
      ...seed,
      resolutionHash,
      resolutionRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: parsed.decision === "uphold" ? "CHALLENGE" : "FULFILL",
      actor: actor.id,
      entityType: "environmental_proof_challenge_resolution",
      entityId: id,
      payload,
      createdAt: parsed.resolvedAt,
      rationale: parsed.rationale,
    }).at(-1)!;
    const resolution: CanopyProofEnvironmentalProofChallengeResolution = {
      factType: "environmental_proof_challenge_resolution",
      id,
      ...seed,
      resolutionHash,
      resolutionRoot,
      safety,
      auditEvent,
    };
    this.resolutionsById.set(id, resolution);
    this.resolutionIdByChallengeId.set(challengeId, id);
    this.eventsByRecordId.set(record.id, [...events, auditEvent]);
    return resolution;
  }

  projectChallenge(challengeId: string): CanopyProofEnvironmentalProofChallengeProjection {
    const challenge = this.getChallenge(challengeId);
    const reviews = this.listReviews(challengeId);
    const resolution = this.getResolutionForChallengeOptional(challengeId);
    const state: CanopyProofEnvironmentalProofChallengeState = resolution
      ? resolution.decision === "uphold"
        ? "resolved"
        : "rejected"
      : reviews.length > 0
        ? "under_review"
        : "open";
    const seed = {
      challengeId,
      challengeRoot: challenge.challengeRoot,
      recordId: challenge.recordId,
      recordRoot: challenge.recordRoot,
      state,
      reviewCount: reviews.length,
      resolutionId: resolution?.id ?? null,
      resolutionRoot: resolution?.resolutionRoot ?? null,
    };
    return {
      challengeId,
      challengeRoot: challenge.challengeRoot,
      recordId: challenge.recordId,
      recordRoot: challenge.recordRoot,
      state,
      reviewCount: reviews.length,
      ...(resolution ? { resolutionId: resolution.id, resolutionRoot: resolution.resolutionRoot } : {}),
      projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-challenge-projection-v1", ...seed }),
      safety: challengeSafetyBoundary(),
    };
  }

  projectRecordStatus(
    recordId: string,
    currentSources: CanopyProofEnvironmentalProofAuthoritySources,
  ): CanopyProofEnvironmentalProofChallengedRecordProjection {
    const base = this.proof.projectRecordStatus(recordId, currentSources);
    const latest = this.listChallenges(recordId).at(-1);
    const challengeProjection = latest ? this.projectChallenge(latest.id) : undefined;
    const state: CanopyProofEnvironmentalProofRecordState = !challengeProjection
      ? base.state
      : challengeProjection.state === "resolved"
        ? "revoked"
        : challengeProjection.state === "rejected"
          ? base.state
          : "challenged";
    const seed = {
      recordId,
      recordRoot: base.recordRoot,
      state,
      baseState: base.state as "issued" | "stale",
      sourceAuthorityCurrent: base.sourceAuthorityCurrent,
      challengeState: challengeProjection?.state ?? null,
      challengeId: challengeProjection?.challengeId ?? null,
      challengeRoot: challengeProjection?.challengeRoot ?? null,
      resolutionId: challengeProjection?.resolutionId ?? null,
      resolutionRoot: challengeProjection?.resolutionRoot ?? null,
    };
    return {
      recordId,
      recordRoot: base.recordRoot,
      state,
      baseState: base.state as "issued" | "stale",
      sourceAuthorityCurrent: base.sourceAuthorityCurrent,
      ...(challengeProjection
        ? {
            challengeState: challengeProjection.state,
            challengeId: challengeProjection.challengeId,
            challengeRoot: challengeProjection.challengeRoot,
            ...(challengeProjection.resolutionId && challengeProjection.resolutionRoot
              ? {
                  resolutionId: challengeProjection.resolutionId,
                  resolutionRoot: challengeProjection.resolutionRoot,
                }
              : {}),
          }
        : {}),
      projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-challenged-record-projection-v1", ...seed }),
      safety: challengeSafetyBoundary(),
    };
  }

  getChallenge(challengeId: string) {
    const challenge = this.challengesById.get(challengeId);
    if (!challenge) throw new Error(`CanopyProof Environmental Proof challenge not found: ${challengeId}`);
    return challenge;
  }

  getChallengeBundle(challengeId: string): CanopyProofEnvironmentalProofChallengeBundle {
    return { challenge: this.getChallenge(challengeId), riskSignal: this.getRiskSignalForChallenge(challengeId) };
  }

  getRiskSignal(riskSignalId: string) {
    const signal = this.riskSignalsById.get(riskSignalId);
    if (!signal) throw new Error(`CanopyProof Environmental Proof challenge risk signal not found: ${riskSignalId}`);
    return signal;
  }

  getReview(reviewId: string) {
    const review = this.reviewsById.get(reviewId);
    if (!review) throw new Error(`CanopyProof Environmental Proof challenge review not found: ${reviewId}`);
    return review;
  }

  getResolution(resolutionId: string) {
    const resolution = this.resolutionsById.get(resolutionId);
    if (!resolution) throw new Error(`CanopyProof Environmental Proof challenge resolution not found: ${resolutionId}`);
    return resolution;
  }

  listChallenges(recordId?: string) {
    return [...this.challengesById.values()]
      .filter((challenge) => !recordId || challenge.recordId === recordId)
      .sort((left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id));
  }

  listReviews(challengeId: string) {
    this.getChallenge(challengeId);
    return (this.reviewIdsByChallengeId.get(challengeId) ?? [])
      .map((id) => this.reviewsById.get(id)!)
      .sort((left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id));
  }

  getAuthoritySnapshot(): CanopyProofEnvironmentalProofChallengeAuthoritySnapshot {
    return {
      challenges: this.listChallenges(),
      riskSignals: [...this.riskSignalsById.values()].sort(
        (left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id),
      ),
      reviews: [...this.reviewsById.values()].sort(
        (left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id),
      ),
      resolutions: [...this.resolutionsById.values()].sort(
        (left, right) => left.recordSequence - right.recordSequence || left.id.localeCompare(right.id),
      ),
    };
  }

  private appendChallengeBundle(
    challengeSeed: Omit<
      CanopyProofEnvironmentalProofChallenge,
      "factType" | "sourceRoot" | "recordSequence" | "previousEventRoot" | "challengeHash" | "challengeRoot" | "safety" | "auditEvent"
    >,
    events: readonly CanopyProofAuditEvent[],
  ): CanopyProofEnvironmentalProofChallengeBundle {
    const sourceRoot = merkleRoot(
      [
        challengeSeed.recordRoot,
        challengeSeed.candidateRoot,
        challengeSeed.authorityRoot,
        challengeSeed.policyRoot,
        challengeSeed.challengedRecordProjectionRoot,
        challengeSeed.challengedCurrentAuthorityRoot,
        ...challengeSeed.supportingArtifactHashes,
        ...challengeSeed.sourceEventRoots,
        ...(challengeSeed.priorResolutionRoot ? [challengeSeed.priorResolutionRoot] : []),
      ].sort(),
    );
    const recordSequence = events.length + 1;
    const previousEventRoot = events.at(-1)!.eventRoot;
    const seed = { ...challengeSeed, sourceRoot, recordSequence, previousEventRoot };
    const challengeHash = hashJson({ kind: "canopyproof-environmental-proof-challenge-v1", ...seed });
    const challengeRoot = hashJson({
      kind: "canopyproof-environmental-proof-challenge-root-v1",
      recordRoot: challengeSeed.recordRoot,
      challengedRecordProjectionRoot: challengeSeed.challengedRecordProjectionRoot,
      sourceRoot,
      challengeHash,
      previousEventRoot,
      recordSequence,
    });
    const safety = challengeSafetyBoundary();
    const payload = {
      factType: "environmental_proof_challenge",
      ...seed,
      challengeHash,
      challengeRoot,
      safety,
    };
    const challengeEvent = appendCanopyProofAuditEvent(events, {
      action: "CHALLENGE",
      actor: challengeSeed.challenger.id,
      entityType: "environmental_proof_challenge",
      entityId: challengeSeed.id,
      payload,
      createdAt: challengeSeed.openedAt,
      rationale: challengeSeed.rationale,
    }).at(-1)!;
    const challenge: CanopyProofEnvironmentalProofChallenge = {
      factType: "environmental_proof_challenge",
      ...seed,
      challengeHash,
      challengeRoot,
      safety,
      auditEvent: challengeEvent,
    };
    const riskEvents = [...events, challengeEvent];
    const riskRecordSequence = riskEvents.length + 1;
    const riskPreviousEventRoot = challengeEvent.eventRoot;
    const riskSourceEventRoots = [challengeEvent.eventRoot];
    const riskSourceRoot = merkleRoot([challengeRoot, challengeSeed.recordRoot, ...riskSourceEventRoots].sort());
    const riskSeed = {
      challengeId: challenge.id,
      challengeRoot,
      recordId: challenge.recordId,
      recordRoot: challenge.recordRoot,
      organizationId: challenge.organizationId,
      projectId: challenge.projectId,
      reason: challenge.reason,
      riskLevel: challenge.severity,
      sourceEventRoots: riskSourceEventRoots,
      sourceRoot: riskSourceRoot,
      detectedBy: challenge.challenger,
      detectedAt: challenge.openedAt,
      recordSequence: riskRecordSequence,
      previousEventRoot: riskPreviousEventRoot,
    };
    const riskHash = hashJson({ kind: "canopyproof-environmental-proof-challenge-risk-v1", ...riskSeed });
    const riskRoot = hashJson({
      kind: "canopyproof-environmental-proof-challenge-risk-root-v1",
      challengeRoot,
      sourceRoot: riskSourceRoot,
      riskHash,
      previousEventRoot: riskPreviousEventRoot,
      recordSequence: riskRecordSequence,
    });
    const riskId = `cp_environmental_proof_challenge_risk_${riskHash.slice(0, 24)}`;
    const riskPayload = {
      factType: "environmental_proof_challenge_risk",
      id: riskId,
      ...riskSeed,
      riskHash,
      riskRoot,
      safety,
    };
    const riskEvent = appendCanopyProofAuditEvent(riskEvents, {
      action: "ASSERT",
      actor: challenge.challenger.id,
      entityType: "environmental_proof_challenge_risk",
      entityId: riskId,
      payload: riskPayload,
      createdAt: challenge.openedAt,
      rationale: "A deterministic operational risk signal was emitted for the Environmental Proof challenge.",
    }).at(-1)!;
    const riskSignal: CanopyProofEnvironmentalProofChallengeRiskSignal = {
      factType: "environmental_proof_challenge_risk",
      id: riskId,
      ...riskSeed,
      riskHash,
      riskRoot,
      safety,
      auditEvent: riskEvent,
    };
    this.challengesById.set(challenge.id, challenge);
    this.challengeIdsByRecordId.set(challenge.recordId, [
      ...(this.challengeIdsByRecordId.get(challenge.recordId) ?? []),
      challenge.id,
    ]);
    this.riskSignalsById.set(riskId, riskSignal);
    this.riskSignalIdByChallengeId.set(challenge.id, riskId);
    this.eventsByRecordId.set(challenge.recordId, [...riskEvents, riskEvent]);
    return { challenge, riskSignal };
  }

  private replayChallengeBundle(
    challenge: CanopyProofEnvironmentalProofChallenge,
    risk: CanopyProofEnvironmentalProofChallengeRiskSignal,
  ) {
    const events = this.requireRecordEvents(challenge.recordId);
    const seed = {
      id: challenge.id,
      recordId: challenge.recordId,
      recordRoot: challenge.recordRoot,
      candidateId: challenge.candidateId,
      candidateRoot: challenge.candidateRoot,
      authorityRoot: challenge.authorityRoot,
      organizationId: challenge.organizationId,
      projectId: challenge.projectId,
      policyId: challenge.policyId,
      policyHash: challenge.policyHash,
      policyRoot: challenge.policyRoot,
      challengedRecordState: challenge.challengedRecordState,
      challengedRecordProjectionRoot: challenge.challengedRecordProjectionRoot,
      challengedSourceAuthorityCurrent: challenge.challengedSourceAuthorityCurrent,
      challengedCurrentAuthorityRoot: challenge.challengedCurrentAuthorityRoot,
      ...(challenge.priorChallengeId ? { priorChallengeId: challenge.priorChallengeId } : {}),
      ...(challenge.priorResolutionId ? { priorResolutionId: challenge.priorResolutionId } : {}),
      ...(challenge.priorResolutionRoot ? { priorResolutionRoot: challenge.priorResolutionRoot } : {}),
      reason: challenge.reason,
      severity: challenge.severity,
      rationale: challenge.rationale,
      supportingArtifactHashes: challenge.supportingArtifactHashes,
      sourceEventRoots: challenge.sourceEventRoots,
      challenger: challenge.challenger,
      challengerOrganizationId: challenge.challengerOrganizationId,
      openedAt: challenge.openedAt,
      commandHash: challenge.commandHash,
    };
    const replayed = this.appendChallengeBundle(seed, events);
    assertFactReplay(replayed.challenge, challenge, `challenge ${challenge.id}`);
    assertFactReplay(replayed.riskSignal, risk, `challenge risk ${risk.id}`);
  }

  private getRiskSignalForChallenge(challengeId: string) {
    const riskId = this.riskSignalIdByChallengeId.get(challengeId);
    if (!riskId) throw new Error(`CanopyProof Environmental Proof challenge risk signal not found: ${challengeId}`);
    return this.getRiskSignal(riskId);
  }

  private getResolutionForChallengeOptional(challengeId: string) {
    const resolutionId = this.resolutionIdByChallengeId.get(challengeId);
    return resolutionId ? this.getResolution(resolutionId) : undefined;
  }

  private requireRecordEvents(recordId: string) {
    const events = this.eventsByRecordId.get(recordId);
    if (!events) throw new Error(`CanopyProof Environmental Proof record event stream not found: ${recordId}`);
    return events;
  }
}

function challengeReviewCommandHash(input: Readonly<{
  challenge: CanopyProofEnvironmentalProofChallenge;
  risk: CanopyProofEnvironmentalProofChallengeRiskSignal;
  prior?: CanopyProofEnvironmentalProofChallengeReview;
  decision: CanopyProofEnvironmentalProofChallengeReviewDecision;
  rationale: string;
  conflictDisclosure: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  reviewer: CanopyProofVerificationActorSnapshot;
  reviewedAt: string;
}>) {
  return hashJson({
    kind: "canopyproof-environmental-proof-challenge-review-command-v1",
    challengeId: input.challenge.id,
    challengeRoot: input.challenge.challengeRoot,
    riskSignalId: input.risk.id,
    riskRoot: input.risk.riskRoot,
    policyId: input.challenge.policyId,
    policyHash: input.challenge.policyHash,
    policyRoot: input.challenge.policyRoot,
    priorReviewId: input.prior?.id ?? null,
    priorReviewRoot: input.prior?.reviewRoot ?? null,
    decision: input.decision,
    rationale: input.rationale,
    conflictDisclosure: input.conflictDisclosure,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    reviewer: input.reviewer,
    reviewedAt: input.reviewedAt,
  });
}

function challengeResolutionCommandHash(input: Readonly<{
  challenge: CanopyProofEnvironmentalProofChallenge;
  risk: CanopyProofEnvironmentalProofChallengeRiskSignal;
  reviewIds: readonly string[];
  reviewRoots: readonly string[];
  reviewQuorumRoot: string;
  decision: CanopyProofEnvironmentalProofChallengeResolutionDecision;
  rationale: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  resolver: CanopyProofVerificationActorSnapshot;
  resolvedAt: string;
}>) {
  return hashJson({
    kind: "canopyproof-environmental-proof-challenge-resolution-command-v1",
    challengeId: input.challenge.id,
    challengeRoot: input.challenge.challengeRoot,
    riskSignalId: input.risk.id,
    riskRoot: input.risk.riskRoot,
    reviewIds: input.reviewIds,
    reviewRoots: input.reviewRoots,
    reviewQuorumRoot: input.reviewQuorumRoot,
    decision: input.decision,
    rationale: input.rationale,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    resolver: input.resolver,
    resolvedAt: input.resolvedAt,
  });
}

function normalizeActor(input: unknown): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: normalizeHash(parsed.membershipRoot) } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: normalizeHash(parsed.accreditationRoot) } : {}),
    accreditationScope: canonicalStrings(parsed.accreditationScope, "challenge actor accreditation scope"),
  } as const;
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (parsed.authorityRoot && normalizeHash(parsed.authorityRoot) !== authorityRoot) {
    throw new Error("CanopyProof Environmental Proof challenge actor authority root is invalid.");
  }
  return { ...normalized, authorityRoot };
}

function assertHumanMember(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
  roles: readonly CanopyProofVerificationActorSnapshot["role"][],
) {
  if (
    actor.participantType !== "human" ||
    actor.organizationId !== organizationId ||
    !roles.includes(actor.role) ||
    !actor.membershipId ||
    actor.membershipStatus !== "active" ||
    !actor.membershipRoot
  ) {
    throw new Error("CanopyProof Environmental Proof challenge requires active human organization authority.");
  }
}

function requireAccreditation(actor: CanopyProofVerificationActorSnapshot) {
  if (
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot
  ) {
    throw new Error("CanopyProof Environmental Proof challenge verifier requires current approved accreditation.");
  }
}

function assertReviewQuorum(
  requiredApprovals: number,
  reviews: readonly CanopyProofEnvironmentalProofChallengeReview[],
  decision: CanopyProofEnvironmentalProofChallengeResolutionDecision,
) {
  if (reviews.length < requiredApprovals || reviews.some((review) => review.decision !== decision)) {
    throw new Error("CanopyProof Environmental Proof challenge review quorum is incomplete, mixed, or non-terminal.");
  }
  if (!reviews.some((review) => review.reviewer.role === "verifier")) {
    throw new Error("CanopyProof Environmental Proof challenge quorum requires an accredited verifier.");
  }
  if (!reviews.some((review) => review.reviewer.role === "owner" || review.reviewer.role === "admin")) {
    throw new Error("CanopyProof Environmental Proof challenge quorum requires an owner or admin.");
  }
}

function canonicalHashes(values: readonly string[], label: string) {
  return canonicalStrings(values.map(normalizeHash), label);
}

function canonicalStrings(values: readonly string[], label: string) {
  const normalized = [...new Set(values.map((value) => value.trim()))].sort();
  if (normalized.some((value) => value.length === 0)) throw new Error(`CanopyProof ${label} is empty.`);
  return normalized;
}

function normalizeHash(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}

function requireKnownEvents(roots: readonly string[], events: readonly CanopyProofAuditEvent[], label: string) {
  const known = new Set(events.map((event) => event.eventRoot));
  const unknown = roots.find((root) => !known.has(root));
  if (unknown) throw new Error(`CanopyProof ${label} is missing or foreign: ${unknown}`);
}

function assertMonotonicTime(events: readonly CanopyProofAuditEvent[], timestamp: string) {
  const previous = events.at(-1);
  if (previous && Date.parse(timestamp) < Date.parse(previous.createdAt)) {
    throw new Error("CanopyProof Environmental Proof challenge fact time must be monotonic.");
  }
}

function assertSafeText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) {
    throw new Error(`CanopyProof Environmental Proof challenge contains unsafe claim or secret material: ${unsafe}`);
  }
}

function challengeSafetyBoundary(): CanopyProofEnvironmentalProofChallengeSafetyBoundary {
  return {
    environmentalAccountabilityOnly: true,
    immutableRecordPreserved: true,
    riskSignalAdvisoryOnly: true,
    independentHumanGovernanceRequired: true,
    crossOrganizationStandingGrantsNoDataAccess: true,
    noRawEvidence: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function canopyProofEnvironmentalProofChallengeSafetyBoundary(): CanopyProofEnvironmentalProofChallengeSafetyBoundary {
  return challengeSafetyBoundary();
}

export function verifyCanopyProofEnvironmentalProofChallengedRecordProjection(
  projection: CanopyProofEnvironmentalProofChallengedRecordProjection,
) {
  const hasChallenge = projection.challengeState !== undefined;
  const hasChallengeIdentity = projection.challengeId !== undefined && projection.challengeRoot !== undefined;
  const hasResolution = projection.resolutionId !== undefined || projection.resolutionRoot !== undefined;
  if (
    hasChallenge !== hasChallengeIdentity ||
    (hasResolution && (!projection.resolutionId || !projection.resolutionRoot || !hasChallenge))
  ) {
    return false;
  }
  const seed = {
    recordId: projection.recordId,
    recordRoot: projection.recordRoot,
    state: projection.state,
    baseState: projection.baseState,
    sourceAuthorityCurrent: projection.sourceAuthorityCurrent,
    challengeState: projection.challengeState ?? null,
    challengeId: projection.challengeId ?? null,
    challengeRoot: projection.challengeRoot ?? null,
    resolutionId: projection.resolutionId ?? null,
    resolutionRoot: projection.resolutionRoot ?? null,
  };
  return (
    projection.projectionRoot ===
      hashJson({ kind: "canopyproof-environmental-proof-challenged-record-projection-v1", ...seed }) &&
    hashJson(projection.safety) === hashJson(challengeSafetyBoundary())
  );
}

function assertFactReplay(actual: unknown, expected: unknown, label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof Environmental Proof ${label} lineage is invalid.`);
  }
}
