import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  CanopyProofEvidenceVerificationAuthorityService,
  type CanopyProofEvidenceFinalDecision,
  type CanopyProofEvidenceVerificationAuthoritySnapshot,
  type CanopyProofVerificationActorSnapshot,
} from "./evidence-verification-authority.js";
import type {
  CanopyProofMethodology,
  CanopyProofMethodologyQualityGate,
} from "./methodology-registry.js";
import {
  CanopyProofMethodologyGovernanceAuthorityService,
  type CanopyProofGovernedPolicyAuthority,
  type CanopyProofGovernedPolicyReviewerRole,
  type CanopyProofMethodologyGovernanceAuthoritySnapshot,
} from "./methodology-governance-authority.js";
import {
  CanopyProofProjectRegistryService,
  type CanopyProofProjectAuthoritySnapshot,
  type CanopyProofProjectMonitoringEvent,
  type CanopyProofProjectProfile,
} from "./project-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofEnvironmentalProofApprovalDecisions = ["approve", "reject", "request_changes"] as const;
export const canopyProofEnvironmentalProofRecordStates = ["issued", "stale", "challenged", "revoked"] as const;

export type CanopyProofEnvironmentalProofApprovalDecision =
  (typeof canopyProofEnvironmentalProofApprovalDecisions)[number];
export type CanopyProofEnvironmentalProofRecordState = (typeof canopyProofEnvironmentalProofRecordStates)[number];

export type CanopyProofEnvironmentalProofAuthoritySources = {
  readonly projects: CanopyProofProjectAuthoritySnapshot;
  readonly evidenceVerification: CanopyProofEvidenceVerificationAuthoritySnapshot;
  readonly methodologyGovernance: CanopyProofMethodologyGovernanceAuthoritySnapshot;
};

export type CanopyProofEnvironmentalProofSafetyBoundary = {
  readonly environmentalAccountabilityOnly: true;
  readonly sourceAuthorityReplayed: true;
  readonly currentFinalEvidenceOnly: true;
  readonly governedMethodologyRequired: true;
  readonly acceptedMonitoringRequired: true;
  readonly independentHumanGovernanceRequired: true;
  readonly publicChallengeRequiredBeforePublicReliance: true;
  readonly noRawEvidence: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEnvironmentalProofCandidate = {
  readonly factType: "environmental_proof_candidate";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectStatus: "active" | "monitored";
  readonly projectRoot: string;
  readonly projectEventRoot: string;
  readonly methodologyId: string;
  readonly methodologyHash: string;
  readonly methodologyQualityGateRoot: string;
  readonly methodologyEventRoot: string;
  readonly methodologyPublicationId: string;
  readonly methodologyPublicationRoot: string;
  readonly methodologyPublicationEventRoot: string;
  readonly methodologyPublicationBundleRoot: string;
  readonly methodologyPublicationPolicyRoot: string;
  readonly methodologyPublicationPolicyEventRoot: string;
  readonly methodologyApprovalRoots: readonly string[];
  readonly methodologyApprovalQuorumRoot: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly policyRoot: string;
  readonly policyEventRoot: string;
  readonly requiredApprovals: number;
  readonly allowedReviewerRoles: readonly CanopyProofGovernedPolicyReviewerRole[];
  readonly evidenceIds: readonly string[];
  readonly evidenceRegistrationRoots: readonly string[];
  readonly evidenceFinalDecisionIds: readonly string[];
  readonly evidenceFinalDecisionRoots: readonly string[];
  readonly evidenceFinalVerificationRoots: readonly string[];
  readonly evidenceRoot: string;
  readonly finalDecisionRoot: string;
  readonly monitoringEventIds: readonly string[];
  readonly monitoringRoots: readonly string[];
  readonly monitoringRoot: string;
  readonly contributorIds: readonly string[];
  readonly sourceActorIds: readonly string[];
  readonly publicLocation: {
    readonly latitude: number;
    readonly longitude: number;
    readonly regionId: string;
    readonly areaHectares: number;
  };
  readonly confidenceScore: number;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly authorityRoot: string;
  readonly derivedBy: CanopyProofVerificationActorSnapshot;
  readonly derivedAt: string;
  readonly commandHash: string;
  readonly candidateHash: string;
  readonly candidateRoot: string;
  readonly safety: CanopyProofEnvironmentalProofSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofCandidateApproval = {
  readonly factType: "environmental_proof_candidate_approval";
  readonly id: string;
  readonly candidateId: string;
  readonly candidateRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly priorApprovalId?: string;
  readonly priorApprovalRoot?: string;
  readonly decision: CanopyProofEnvironmentalProofApprovalDecision;
  readonly rationale: string;
  readonly conflictDisclosure: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly approver: CanopyProofVerificationActorSnapshot;
  readonly decidedAt: string;
  readonly commandHash: string;
  readonly candidateSequence: number;
  readonly previousEventRoot: string;
  readonly approvalHash: string;
  readonly approvalRoot: string;
  readonly safety: CanopyProofEnvironmentalProofSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofRecord = {
  readonly factType: "environmental_proof_record";
  readonly id: string;
  readonly recordType: "environmental_proof_record";
  readonly candidateId: string;
  readonly candidateRoot: string;
  readonly authorityRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly methodologyId: string;
  readonly methodologyHash: string;
  readonly methodologyPublicationId: string;
  readonly methodologyPublicationRoot: string;
  readonly policyId: string;
  readonly policyRoot: string;
  readonly evidenceIds: readonly string[];
  readonly evidenceRoot: string;
  readonly evidenceFinalDecisionIds: readonly string[];
  readonly evidenceFinalDecisionRoots: readonly string[];
  readonly monitoringEventIds: readonly string[];
  readonly monitoringRoot: string;
  readonly contributorIds: readonly string[];
  readonly publicLocation: CanopyProofEnvironmentalProofCandidate["publicLocation"];
  readonly confidenceScore: number;
  readonly governanceApprovalIds: readonly string[];
  readonly governanceApprovalRoots: readonly string[];
  readonly governanceQuorumRoot: string;
  readonly issuer: CanopyProofVerificationActorSnapshot;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly issuedAt: string;
  readonly commandHash: string;
  readonly candidateSequence: number;
  readonly previousEventRoot: string;
  readonly recordHash: string;
  readonly recordRoot: string;
  readonly status: "issued";
  readonly claimBoundary: CanopyProofEnvironmentalProofSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofRecordProjection = {
  readonly recordId: string;
  readonly recordRoot: string;
  readonly state: CanopyProofEnvironmentalProofRecordState;
  readonly sourceAuthorityCurrent: boolean;
  readonly authorityRootAtIssuance: string;
  readonly currentAuthorityRoot: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEnvironmentalProofSafetyBoundary;
};

export type CanopyProofEnvironmentalProofAuthoritySnapshot = {
  readonly candidates: readonly CanopyProofEnvironmentalProofCandidate[];
  readonly approvals: readonly CanopyProofEnvironmentalProofCandidateApproval[];
  readonly records: readonly CanopyProofEnvironmentalProofRecord[];
};

type CandidateSourceProjection = Omit<
  CanopyProofEnvironmentalProofCandidate,
  | "factType"
  | "id"
  | "derivedBy"
  | "derivedAt"
  | "commandHash"
  | "candidateHash"
  | "candidateRoot"
  | "safety"
  | "auditEvent"
>;

const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const identifierSchema = z.string().trim().min(1).max(240);
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

const candidateInputSchema = z
  .object({
    id: identifierSchema.optional(),
    projectId: identifierSchema,
    methodologyId: identifierSchema,
    policyId: identifierSchema,
    evidenceIds: z.array(identifierSchema).min(1).max(256),
    monitoringEventIds: z.array(identifierSchema).min(1).max(256),
    derivedAt: z.string().datetime(),
  })
  .strict();

const approvalInputSchema = z
  .object({
    id: identifierSchema.optional(),
    decision: z.enum(canopyProofEnvironmentalProofApprovalDecisions),
    rationale: z.string().trim().min(24).max(4_000),
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(hashSchema).min(1).max(256),
    decidedAt: z.string().datetime(),
  })
  .strict();

const recordInputSchema = z
  .object({
    id: identifierSchema.optional(),
    approvalIds: z.array(identifierSchema).min(2).max(32),
    rationale: z.string().trim().min(24).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(hashSchema).min(1).max(512),
    issuedAt: z.string().datetime(),
  })
  .strict();

export class CanopyProofEnvironmentalProofAuthorityService {
  private readonly candidatesById = new Map<string, CanopyProofEnvironmentalProofCandidate>();
  private readonly candidateIdByCandidateRoot = new Map<string, string>();
  private readonly candidateIdByAuthorityRoot = new Map<string, string>();
  private readonly approvalsById = new Map<string, CanopyProofEnvironmentalProofCandidateApproval>();
  private readonly approvalIdsByCandidateId = new Map<string, string[]>();
  private readonly recordsById = new Map<string, CanopyProofEnvironmentalProofRecord>();
  private readonly recordIdByCandidateId = new Map<string, string>();
  private readonly eventsByCandidateId = new Map<string, CanopyProofAuditEvent[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofEnvironmentalProofAuthoritySnapshot) {
    const service = new CanopyProofEnvironmentalProofAuthorityService();
    const allFacts = [...snapshot.candidates, ...snapshot.approvals, ...snapshot.records];
    const factIds = new Set<string>();
    for (const fact of allFacts) {
      if (factIds.has(fact.id)) {
        throw new Error(`CanopyProof Environmental Proof snapshot contains duplicate fact id: ${fact.id}`);
      }
      factIds.add(fact.id);
    }

    for (const candidate of [...snapshot.candidates].sort(
      (left, right) => left.derivedAt.localeCompare(right.derivedAt) || left.id.localeCompare(right.id),
    )) {
      const replayed = replayEnvironmentalProofCandidate(candidate);
      if (service.candidateIdByCandidateRoot.has(replayed.candidateRoot)) {
        throw new Error(`CanopyProof Environmental Proof snapshot contains duplicate candidate root: ${replayed.candidateRoot}`);
      }
      if (service.candidateIdByAuthorityRoot.has(replayed.authorityRoot)) {
        throw new Error(`CanopyProof Environmental Proof snapshot contains duplicate source authority: ${replayed.authorityRoot}`);
      }
      service.candidatesById.set(replayed.id, replayed);
      service.candidateIdByCandidateRoot.set(replayed.candidateRoot, replayed.id);
      service.candidateIdByAuthorityRoot.set(replayed.authorityRoot, replayed.id);
      service.eventsByCandidateId.set(replayed.id, [replayed.auditEvent]);
    }

    for (const approval of [...snapshot.approvals].sort(
      (left, right) =>
        left.candidateId.localeCompare(right.candidateId) ||
        left.candidateSequence - right.candidateSequence ||
        left.id.localeCompare(right.id),
    )) {
      const replayed = service.approveCandidate(
        approval.candidateId,
        {
          id: approval.id,
          decision: approval.decision,
          rationale: approval.rationale,
          conflictDisclosure: approval.conflictDisclosure,
          limitations: approval.limitations,
          sourceEventRoots: approval.sourceEventRoots,
          decidedAt: approval.decidedAt,
        },
        approval.approver,
      );
      if (hashJson(replayed) !== hashJson(approval)) {
        throw new Error(`CanopyProof Environmental Proof snapshot approval lineage is invalid: ${approval.id}`);
      }
    }

    for (const record of [...snapshot.records].sort(
      (left, right) =>
        left.candidateId.localeCompare(right.candidateId) ||
        left.candidateSequence - right.candidateSequence ||
        left.id.localeCompare(right.id),
    )) {
      service.replayRecordFact(record);
    }
    return service;
  }

  deriveCandidate(
    input: unknown,
    actorInput: unknown,
    sources: CanopyProofEnvironmentalProofAuthoritySources,
  ): CanopyProofEnvironmentalProofCandidate {
    const parsed = candidateInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    const source = deriveCandidateSourceProjection(parsed, sources);
    assertOrganizationMember(actor, source.organizationId, ["owner", "admin", "verifier", "researcher"]);
    assertSafeText([parsed.id ?? "", ...source.limitations]);
    if (Date.parse(parsed.derivedAt) < latestSourceTime(source, sources)) {
      throw new Error("CanopyProof Environmental Proof candidate cannot predate its latest source authority.");
    }
    const commandHash = hashJson({
      kind: "canopyproof-environmental-proof-candidate-command-v1",
      ...source,
      derivedBy: actor,
      derivedAt: parsed.derivedAt,
    });
    const id = `cp_environmental_proof_candidate_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof Environmental Proof candidate id does not match its canonical command hash.");
    }
    const existing = this.candidatesById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof Environmental Proof candidate conflicts with committed authority: ${id}`);
    }
    if (this.candidateIdByAuthorityRoot.has(source.authorityRoot)) {
      throw new Error("CanopyProof Environmental Proof source authority already has a candidate.");
    }
    const candidateSeed = {
      ...source,
      derivedBy: actor,
      derivedAt: parsed.derivedAt,
      commandHash,
    };
    const candidateHash = hashJson({ kind: "canopyproof-environmental-proof-candidate-v1", ...candidateSeed });
    const candidateRoot = hashJson({
      kind: "canopyproof-environmental-proof-candidate-root-v1",
      authorityRoot: source.authorityRoot,
      sourceRoot: source.sourceRoot,
      candidateHash,
    });
    const safety = environmentalProofSafetyBoundary();
    const payload = {
      factType: "environmental_proof_candidate",
      id,
      ...candidateSeed,
      candidateHash,
      candidateRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actor.id,
      entityType: "environmental_proof_candidate",
      entityId: id,
      payload,
      createdAt: parsed.derivedAt,
      rationale: "A bounded Environmental Proof candidate was derived from current durable source authority.",
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof Environmental Proof candidate event was not appended.");
    const candidate: CanopyProofEnvironmentalProofCandidate = {
      factType: "environmental_proof_candidate",
      id,
      ...candidateSeed,
      candidateHash,
      candidateRoot,
      safety,
      auditEvent,
    };
    this.candidatesById.set(id, candidate);
    this.candidateIdByCandidateRoot.set(candidateRoot, id);
    this.candidateIdByAuthorityRoot.set(candidate.authorityRoot, id);
    this.eventsByCandidateId.set(id, [auditEvent]);
    return candidate;
  }

  approveCandidate(
    candidateId: string,
    input: unknown,
    actorInput: unknown,
  ): CanopyProofEnvironmentalProofCandidateApproval {
    const candidate = this.getCandidate(candidateId);
    if (this.recordIdByCandidateId.has(candidateId)) {
      throw new Error("CanopyProof Environmental Proof candidate is already issued and cannot accept later approvals.");
    }
    const parsed = approvalInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    assertOrganizationMember(actor, candidate.organizationId, ["owner", "admin", "verifier"]);
    if (!candidate.allowedReviewerRoles.includes(actor.role as CanopyProofGovernedPolicyReviewerRole)) {
      throw new Error("CanopyProof Environmental Proof policy does not authorize this approval role.");
    }
    if (actor.role === "verifier") requireAccreditation(actor);
    const approvals = this.listApprovals(candidateId);
    const limitations = normalizeUniqueStrings(parsed.limitations, "proof approval limitation");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "proof approval source event root");
    assertSafeText([parsed.id ?? "", parsed.rationale, parsed.conflictDisclosure, ...limitations]);
    const actorApproval = approvals.find((approval) => approval.approver.id === actor.id);
    if (actorApproval) {
      const actorApprovalPrior = actorApproval.priorApprovalId
        ? this.getApproval(actorApproval.priorApprovalId)
        : undefined;
      const retryCommandHash = environmentalProofApprovalCommandHash({
        candidate,
        ...(actorApprovalPrior ? { prior: actorApprovalPrior } : {}),
        decision: parsed.decision,
        rationale: parsed.rationale,
        conflictDisclosure: parsed.conflictDisclosure,
        limitations,
        sourceEventRoots,
        approver: actor,
        decidedAt: parsed.decidedAt,
      });
      const retryId = `cp_environmental_proof_approval_${retryCommandHash.slice(0, 24)}`;
      if ((!parsed.id || parsed.id === retryId) && actorApproval.commandHash === retryCommandHash) {
        return actorApproval;
      }
      throw new Error("CanopyProof Environmental Proof approval requires an independent human approver.");
    }
    if (candidate.sourceActorIds.includes(actor.id) || candidate.derivedBy.id === actor.id) {
      throw new Error("CanopyProof Environmental Proof approval requires an independent human approver.");
    }
    const prior = approvals.at(-1);
    const events = this.requireCandidateEvents(candidateId);
    requireEventRoots(sourceEventRoots, events, "proof approval source event");
    if (!sourceEventRoots.includes(candidate.auditEvent.eventRoot)) {
      throw new Error("CanopyProof Environmental Proof approval must bind the candidate event.");
    }
    if (prior && !sourceEventRoots.includes(prior.auditEvent.eventRoot)) {
      throw new Error("CanopyProof Environmental Proof approval must bind the previous approval event.");
    }
    assertMonotonicTime(events, parsed.decidedAt);
    const commandHash = environmentalProofApprovalCommandHash({
      candidate,
      ...(prior ? { prior } : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      limitations,
      sourceEventRoots,
      approver: actor,
      decidedAt: parsed.decidedAt,
    });
    const id = `cp_environmental_proof_approval_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof Environmental Proof approval id does not match its canonical command hash.");
    }
    const sourceRoot = merkleRoot(
      [candidate.candidateRoot, ...sourceEventRoots, ...(prior ? [prior.approvalRoot] : [])].sort(),
    );
    const candidateSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const approvalSeed = {
      candidateId,
      candidateRoot: candidate.candidateRoot,
      organizationId: candidate.organizationId,
      projectId: candidate.projectId,
      policyId: candidate.policyId,
      policyHash: candidate.policyHash,
      ...(prior ? { priorApprovalId: prior.id, priorApprovalRoot: prior.approvalRoot } : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      limitations,
      sourceEventRoots,
      sourceRoot,
      approver: actor,
      decidedAt: parsed.decidedAt,
      commandHash,
      candidateSequence,
      previousEventRoot,
    };
    const approvalHash = hashJson({ kind: "canopyproof-environmental-proof-candidate-approval-v1", ...approvalSeed });
    const approvalRoot = hashJson({
      kind: "canopyproof-environmental-proof-candidate-approval-root-v1",
      candidateRoot: candidate.candidateRoot,
      sourceRoot,
      approvalHash,
      previousEventRoot,
      candidateSequence,
    });
    const safety = environmentalProofSafetyBoundary();
    const payload = {
      factType: "environmental_proof_candidate_approval",
      id,
      ...approvalSeed,
      approvalHash,
      approvalRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: parsed.decision === "approve" ? "FULFILL" : parsed.decision === "reject" ? "CHALLENGE" : "REASON",
      actor: actor.id,
      entityType: "environmental_proof_candidate_approval",
      entityId: id,
      payload,
      createdAt: parsed.decidedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof Environmental Proof approval event was not appended.");
    const approval: CanopyProofEnvironmentalProofCandidateApproval = {
      factType: "environmental_proof_candidate_approval",
      id,
      ...approvalSeed,
      approvalHash,
      approvalRoot,
      safety,
      auditEvent,
    };
    this.approvalsById.set(id, approval);
    this.approvalIdsByCandidateId.set(candidateId, [...(this.approvalIdsByCandidateId.get(candidateId) ?? []), id]);
    this.eventsByCandidateId.set(candidateId, [...events, auditEvent]);
    return approval;
  }

  issueRecord(
    candidateId: string,
    input: unknown,
    issuerInput: unknown,
    currentSources: CanopyProofEnvironmentalProofAuthoritySources,
  ): CanopyProofEnvironmentalProofRecord {
    const candidate = this.getCandidate(candidateId);
    const parsed = recordInputSchema.parse(input);
    const issuer = normalizeActor(issuerInput);
    assertOrganizationMember(issuer, candidate.organizationId, ["owner", "admin"]);
    const approvals = this.listApprovals(candidateId);
    const approvalIds = normalizeUniqueStrings(parsed.approvalIds, "proof record approval id");
    if (hashJson(approvalIds) !== hashJson(approvals.map((approval) => approval.id).sort())) {
      throw new Error("CanopyProof Environmental Proof issuance must bind the complete candidate approval set.");
    }
    assertApprovalQuorum(candidate, approvals);
    if (
      candidate.sourceActorIds.includes(issuer.id) ||
      candidate.derivedBy.id === issuer.id ||
      approvals.some((approval) => approval.approver.id === issuer.id)
    ) {
      throw new Error("CanopyProof Environmental Proof issuance requires an independent human issuer.");
    }
    const existingId = this.recordIdByCandidateId.get(candidateId);
    const existing = existingId ? this.recordsById.get(existingId) : undefined;
    const limitations = normalizeUniqueStrings(parsed.limitations, "proof record limitation");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "proof record source event root");
    assertSafeText([parsed.id ?? "", parsed.rationale, ...limitations]);
    const events = this.requireCandidateEvents(candidateId);
    requireEventRoots(sourceEventRoots, events, "proof record source event");
    const requiredEvents = [candidate.auditEvent.eventRoot, ...approvals.map((approval) => approval.auditEvent.eventRoot)];
    const missingEvent = requiredEvents.find((root) => !sourceEventRoots.includes(root));
    if (missingEvent) throw new Error(`CanopyProof Environmental Proof record omits required authority event: ${missingEvent}`);
    assertMonotonicTime(events, parsed.issuedAt);
    const governanceApprovalRoots = approvals.map((approval) => approval.approvalRoot).sort();
    const governanceQuorumRoot = merkleRoot(governanceApprovalRoots);
    const commandHash = environmentalProofRecordCommandHash({
      candidate,
      governanceApprovalIds: approvalIds,
      governanceApprovalRoots,
      governanceQuorumRoot,
      issuer,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      issuedAt: parsed.issuedAt,
    });
    const id = `cp_environmental_proof_record_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof Environmental Proof record id does not match its canonical command hash.");
    }
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof Environmental Proof candidate already has a conflicting issued record.");
    }
    const currentSource = deriveCandidateSourceProjection(
      {
        projectId: candidate.projectId,
        methodologyId: candidate.methodologyId,
        policyId: candidate.policyId,
        evidenceIds: candidate.evidenceIds,
        monitoringEventIds: candidate.monitoringEventIds,
        derivedAt: candidate.derivedAt,
      },
      currentSources,
    );
    if (currentSource.authorityRoot !== candidate.authorityRoot) {
      throw new Error("CanopyProof Environmental Proof candidate source authority is stale.");
    }
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const candidateSequence = events.length + 1;
    const sourceRoot = merkleRoot(
      [candidate.candidateRoot, candidate.authorityRoot, ...governanceApprovalRoots, ...sourceEventRoots].sort(),
    );
    const recordSeed = environmentalProofRecordSeed({
      candidate,
      governanceApprovalIds: approvalIds,
      governanceApprovalRoots,
      governanceQuorumRoot,
      issuer,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      sourceRoot,
      issuedAt: parsed.issuedAt,
      commandHash,
      candidateSequence,
      previousEventRoot,
    });
    const recordHash = hashJson({ kind: "canopyproof-environmental-proof-record-v2", ...recordSeed });
    const recordRoot = hashJson({
      kind: "canopyproof-environmental-proof-record-root-v1",
      candidateRoot: candidate.candidateRoot,
      governanceQuorumRoot,
      sourceRoot,
      recordHash,
      previousEventRoot,
      candidateSequence,
    });
    const claimBoundary = environmentalProofSafetyBoundary();
    const payload = {
      factType: "environmental_proof_record",
      id,
      ...recordSeed,
      recordHash,
      recordRoot,
      status: "issued",
      claimBoundary,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "FULFILL",
      actor: issuer.id,
      entityType: "environmental_proof_record",
      entityId: id,
      payload,
      createdAt: parsed.issuedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof Environmental Proof record event was not appended.");
    const record: CanopyProofEnvironmentalProofRecord = {
      factType: "environmental_proof_record",
      id,
      ...recordSeed,
      recordHash,
      recordRoot,
      status: "issued",
      claimBoundary,
      auditEvent,
    };
    this.recordsById.set(id, record);
    this.recordIdByCandidateId.set(candidateId, id);
    this.eventsByCandidateId.set(candidateId, [...events, auditEvent]);
    return record;
  }

  getCandidate(candidateId: string) {
    const candidate = this.candidatesById.get(candidateId);
    if (!candidate) throw new Error(`CanopyProof Environmental Proof candidate not found: ${candidateId}`);
    return candidate;
  }

  getCandidateByRoot(candidateRoot: string) {
    const candidateId = this.candidateIdByCandidateRoot.get(normalizeHash(candidateRoot));
    if (!candidateId) throw new Error(`CanopyProof Environmental Proof candidate root not found: ${candidateRoot}`);
    return this.getCandidate(candidateId);
  }

  listApprovals(candidateId: string) {
    this.getCandidate(candidateId);
    return (this.approvalIdsByCandidateId.get(candidateId) ?? [])
      .map((id) => this.approvalsById.get(id)!)
      .sort((left, right) => left.candidateSequence - right.candidateSequence || left.id.localeCompare(right.id));
  }

  getApproval(approvalId: string) {
    const approval = this.approvalsById.get(approvalId);
    if (!approval) throw new Error(`CanopyProof Environmental Proof approval not found: ${approvalId}`);
    return approval;
  }

  getRecord(recordId: string) {
    const record = this.recordsById.get(recordId);
    if (!record) throw new Error(`CanopyProof Environmental Proof record not found: ${recordId}`);
    return record;
  }

  listCandidates(organizationId?: string) {
    return [...this.candidatesById.values()]
      .filter((candidate) => !organizationId || candidate.organizationId === organizationId)
      .sort((left, right) => right.derivedAt.localeCompare(left.derivedAt) || left.id.localeCompare(right.id));
  }

  listRecords(organizationId?: string) {
    return [...this.recordsById.values()]
      .filter((record) => !organizationId || record.organizationId === organizationId)
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt) || left.id.localeCompare(right.id));
  }

  projectRecordStatus(
    recordId: string,
    currentSources: CanopyProofEnvironmentalProofAuthoritySources,
  ): CanopyProofEnvironmentalProofRecordProjection {
    const record = this.getRecord(recordId);
    const candidate = this.getCandidate(record.candidateId);
    let currentAuthorityRoot = hashJson({ kind: "canopyproof-environmental-proof-unavailable-authority-v1" });
    try {
      currentAuthorityRoot = deriveCandidateSourceProjection(
        {
          projectId: candidate.projectId,
          methodologyId: candidate.methodologyId,
          policyId: candidate.policyId,
          evidenceIds: candidate.evidenceIds,
          monitoringEventIds: candidate.monitoringEventIds,
          derivedAt: candidate.derivedAt,
        },
        currentSources,
      ).authorityRoot;
    } catch {
      // An unavailable or now-ineligible source is represented as stale, never as current authority.
    }
    const sourceAuthorityCurrent = currentAuthorityRoot === record.authorityRoot;
    const state: CanopyProofEnvironmentalProofRecordState = sourceAuthorityCurrent ? "issued" : "stale";
    return {
      recordId,
      recordRoot: record.recordRoot,
      state,
      sourceAuthorityCurrent,
      authorityRootAtIssuance: record.authorityRoot,
      currentAuthorityRoot,
      projectionRoot: hashJson({
        kind: "canopyproof-environmental-proof-record-projection-v1",
        recordId,
        recordRoot: record.recordRoot,
        state,
        sourceAuthorityCurrent,
        authorityRootAtIssuance: record.authorityRoot,
        currentAuthorityRoot,
      }),
      safety: environmentalProofSafetyBoundary(),
    };
  }

  getAuthoritySnapshot(): CanopyProofEnvironmentalProofAuthoritySnapshot {
    return {
      candidates: this.listCandidates(),
      approvals: [...this.approvalsById.values()].sort(
        (left, right) =>
          left.candidateId.localeCompare(right.candidateId) ||
          left.candidateSequence - right.candidateSequence ||
          left.id.localeCompare(right.id),
      ),
      records: this.listRecords(),
    };
  }

  private requireCandidateEvents(candidateId: string) {
    const events = this.eventsByCandidateId.get(candidateId);
    if (!events) throw new Error(`CanopyProof Environmental Proof event stream not found: ${candidateId}`);
    return events;
  }

  private replayRecordFact(record: CanopyProofEnvironmentalProofRecord) {
    const candidate = this.getCandidate(record.candidateId);
    if (this.recordIdByCandidateId.has(candidate.id)) {
      throw new Error(`CanopyProof Environmental Proof snapshot contains duplicate candidate record: ${candidate.id}`);
    }
    const parsed = recordInputSchema.parse({
      id: record.id,
      approvalIds: record.governanceApprovalIds,
      rationale: record.rationale,
      limitations: record.limitations,
      sourceEventRoots: record.sourceEventRoots,
      issuedAt: record.issuedAt,
    });
    const issuer = normalizeActor(record.issuer);
    if (hashJson(issuer) !== hashJson(record.issuer)) {
      throw new Error(`CanopyProof Environmental Proof snapshot issuer authority is non-canonical: ${record.id}`);
    }
    assertOrganizationMember(issuer, candidate.organizationId, ["owner", "admin"]);
    const approvals = this.listApprovals(candidate.id);
    const approvalIds = normalizeUniqueStrings(parsed.approvalIds, "proof record approval id");
    if (hashJson(approvalIds) !== hashJson(approvals.map((approval) => approval.id).sort())) {
      throw new Error("CanopyProof Environmental Proof snapshot record omits candidate approval authority.");
    }
    assertApprovalQuorum(candidate, approvals);
    if (
      candidate.sourceActorIds.includes(issuer.id) ||
      candidate.derivedBy.id === issuer.id ||
      approvals.some((approval) => approval.approver.id === issuer.id)
    ) {
      throw new Error("CanopyProof Environmental Proof snapshot issuer is not independent.");
    }
    const limitations = normalizeUniqueStrings(parsed.limitations, "proof record limitation");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "proof record source event root");
    assertSafeText([record.id, parsed.rationale, ...limitations]);
    const events = this.requireCandidateEvents(candidate.id);
    requireEventRoots(sourceEventRoots, events, "proof record source event");
    const requiredEvents = [candidate.auditEvent.eventRoot, ...approvals.map((approval) => approval.auditEvent.eventRoot)];
    const missingEvent = requiredEvents.find((root) => !sourceEventRoots.includes(root));
    if (missingEvent) {
      throw new Error(`CanopyProof Environmental Proof snapshot record omits required authority event: ${missingEvent}`);
    }
    assertMonotonicTime(events, parsed.issuedAt);
    const governanceApprovalRoots = approvals.map((approval) => approval.approvalRoot).sort();
    const governanceQuorumRoot = merkleRoot(governanceApprovalRoots);
    const commandHash = environmentalProofRecordCommandHash({
      candidate,
      governanceApprovalIds: approvalIds,
      governanceApprovalRoots,
      governanceQuorumRoot,
      issuer,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      issuedAt: parsed.issuedAt,
    });
    const id = `cp_environmental_proof_record_${commandHash.slice(0, 24)}`;
    if (record.id !== id) {
      throw new Error("CanopyProof Environmental Proof snapshot record id is non-canonical.");
    }
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const candidateSequence = events.length + 1;
    const sourceRoot = merkleRoot(
      [candidate.candidateRoot, candidate.authorityRoot, ...governanceApprovalRoots, ...sourceEventRoots].sort(),
    );
    const recordSeed = environmentalProofRecordSeed({
      candidate,
      governanceApprovalIds: approvalIds,
      governanceApprovalRoots,
      governanceQuorumRoot,
      issuer,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      sourceRoot,
      issuedAt: parsed.issuedAt,
      commandHash,
      candidateSequence,
      previousEventRoot,
    });
    const recordHash = hashJson({ kind: "canopyproof-environmental-proof-record-v2", ...recordSeed });
    const recordRoot = hashJson({
      kind: "canopyproof-environmental-proof-record-root-v1",
      candidateRoot: candidate.candidateRoot,
      governanceQuorumRoot,
      sourceRoot,
      recordHash,
      previousEventRoot,
      candidateSequence,
    });
    const claimBoundary = environmentalProofSafetyBoundary();
    const payload = {
      factType: "environmental_proof_record",
      id,
      ...recordSeed,
      recordHash,
      recordRoot,
      status: "issued",
      claimBoundary,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "FULFILL",
      actor: issuer.id,
      entityType: "environmental_proof_record",
      entityId: id,
      payload,
      createdAt: parsed.issuedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof Environmental Proof snapshot record event was not appended.");
    const replayed: CanopyProofEnvironmentalProofRecord = {
      factType: "environmental_proof_record",
      id,
      ...recordSeed,
      recordHash,
      recordRoot,
      status: "issued",
      claimBoundary,
      auditEvent,
    };
    if (hashJson(replayed) !== hashJson(record)) {
      throw new Error(`CanopyProof Environmental Proof snapshot record lineage is invalid: ${record.id}`);
    }
    this.recordsById.set(replayed.id, replayed);
    this.recordIdByCandidateId.set(candidate.id, replayed.id);
    this.eventsByCandidateId.set(candidate.id, [...events, replayed.auditEvent]);
    return replayed;
  }
}

function replayEnvironmentalProofCandidate(
  candidate: CanopyProofEnvironmentalProofCandidate,
): CanopyProofEnvironmentalProofCandidate {
  const source = candidateSourceProjectionFromFact(candidate);
  validateCandidateSourceProjection(source);
  const derivedBy = normalizeActor(candidate.derivedBy);
  if (hashJson(derivedBy) !== hashJson(candidate.derivedBy)) {
    throw new Error(`CanopyProof Environmental Proof candidate actor authority is non-canonical: ${candidate.id}`);
  }
  assertOrganizationMember(derivedBy, source.organizationId, ["owner", "admin", "verifier", "researcher"]);
  assertSafeText([candidate.id, ...source.limitations]);
  const commandHash = hashJson({
    kind: "canopyproof-environmental-proof-candidate-command-v1",
    ...source,
    derivedBy,
    derivedAt: candidate.derivedAt,
  });
  const id = `cp_environmental_proof_candidate_${commandHash.slice(0, 24)}`;
  const candidateSeed = { ...source, derivedBy, derivedAt: candidate.derivedAt, commandHash };
  const candidateHash = hashJson({ kind: "canopyproof-environmental-proof-candidate-v1", ...candidateSeed });
  const candidateRoot = hashJson({
    kind: "canopyproof-environmental-proof-candidate-root-v1",
    authorityRoot: source.authorityRoot,
    sourceRoot: source.sourceRoot,
    candidateHash,
  });
  const safety = environmentalProofSafetyBoundary();
  const payload = {
    factType: "environmental_proof_candidate",
    id,
    ...candidateSeed,
    candidateHash,
    candidateRoot,
    safety,
  };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: derivedBy.id,
    entityType: "environmental_proof_candidate",
    entityId: id,
    payload,
    createdAt: candidate.derivedAt,
    rationale: "A bounded Environmental Proof candidate was derived from current durable source authority.",
  }).at(-1);
  if (!auditEvent) throw new Error("CanopyProof Environmental Proof candidate replay event was not appended.");
  const replayed: CanopyProofEnvironmentalProofCandidate = {
    factType: "environmental_proof_candidate",
    id,
    ...candidateSeed,
    candidateHash,
    candidateRoot,
    safety,
    auditEvent,
  };
  if (hashJson(replayed) !== hashJson(candidate)) {
    throw new Error(`CanopyProof Environmental Proof snapshot candidate lineage is invalid: ${candidate.id}`);
  }
  return replayed;
}

function candidateSourceProjectionFromFact(
  candidate: CanopyProofEnvironmentalProofCandidate,
): CandidateSourceProjection {
  return {
    organizationId: candidate.organizationId,
    projectId: candidate.projectId,
    projectStatus: candidate.projectStatus,
    projectRoot: candidate.projectRoot,
    projectEventRoot: candidate.projectEventRoot,
    methodologyId: candidate.methodologyId,
    methodologyHash: candidate.methodologyHash,
    methodologyQualityGateRoot: candidate.methodologyQualityGateRoot,
    methodologyEventRoot: candidate.methodologyEventRoot,
    methodologyPublicationId: candidate.methodologyPublicationId,
    methodologyPublicationRoot: candidate.methodologyPublicationRoot,
    methodologyPublicationEventRoot: candidate.methodologyPublicationEventRoot,
    methodologyPublicationBundleRoot: candidate.methodologyPublicationBundleRoot,
    methodologyPublicationPolicyRoot: candidate.methodologyPublicationPolicyRoot,
    methodologyPublicationPolicyEventRoot: candidate.methodologyPublicationPolicyEventRoot,
    methodologyApprovalRoots: candidate.methodologyApprovalRoots,
    methodologyApprovalQuorumRoot: candidate.methodologyApprovalQuorumRoot,
    policyId: candidate.policyId,
    policyHash: candidate.policyHash,
    policyRoot: candidate.policyRoot,
    policyEventRoot: candidate.policyEventRoot,
    requiredApprovals: candidate.requiredApprovals,
    allowedReviewerRoles: candidate.allowedReviewerRoles,
    evidenceIds: candidate.evidenceIds,
    evidenceRegistrationRoots: candidate.evidenceRegistrationRoots,
    evidenceFinalDecisionIds: candidate.evidenceFinalDecisionIds,
    evidenceFinalDecisionRoots: candidate.evidenceFinalDecisionRoots,
    evidenceFinalVerificationRoots: candidate.evidenceFinalVerificationRoots,
    evidenceRoot: candidate.evidenceRoot,
    finalDecisionRoot: candidate.finalDecisionRoot,
    monitoringEventIds: candidate.monitoringEventIds,
    monitoringRoots: candidate.monitoringRoots,
    monitoringRoot: candidate.monitoringRoot,
    contributorIds: candidate.contributorIds,
    sourceActorIds: candidate.sourceActorIds,
    publicLocation: candidate.publicLocation,
    confidenceScore: candidate.confidenceScore,
    limitations: candidate.limitations,
    sourceEventRoots: candidate.sourceEventRoots,
    sourceRoot: candidate.sourceRoot,
    authorityRoot: candidate.authorityRoot,
  };
}

function validateCandidateSourceProjection(source: CandidateSourceProjection) {
  if (source.requiredApprovals < 2 || source.requiredApprovals > 32) {
    throw new Error("CanopyProof Environmental Proof candidate approval threshold is invalid.");
  }
  const allowedRoles = ["admin", "owner", "researcher", "verifier"];
  if (
    source.allowedReviewerRoles.some((role) => !allowedRoles.includes(role)) ||
    !source.allowedReviewerRoles.includes("verifier") ||
    (!source.allowedReviewerRoles.includes("owner") && !source.allowedReviewerRoles.includes("admin"))
  ) {
    throw new Error("CanopyProof Environmental Proof candidate policy roles are invalid.");
  }
  assertCanonicalValues(source.allowedReviewerRoles, canonicalStringSet(source.allowedReviewerRoles), "candidate reviewer roles");
  assertCanonicalValues(source.evidenceIds, canonicalStringSet(source.evidenceIds), "candidate evidence ids");
  assertCanonicalValues(
    source.evidenceRegistrationRoots,
    canonicalHashSet(source.evidenceRegistrationRoots),
    "candidate evidence roots",
  );
  assertCanonicalValues(
    source.evidenceFinalDecisionIds,
    canonicalStringSet(source.evidenceFinalDecisionIds),
    "candidate final decision ids",
  );
  assertCanonicalValues(
    source.evidenceFinalDecisionRoots,
    canonicalHashSet(source.evidenceFinalDecisionRoots),
    "candidate final decision roots",
  );
  assertCanonicalValues(
    source.evidenceFinalVerificationRoots,
    canonicalHashSet(source.evidenceFinalVerificationRoots),
    "candidate final verification roots",
  );
  assertCanonicalValues(
    source.methodologyApprovalRoots,
    canonicalHashSet(source.methodologyApprovalRoots),
    "candidate methodology approval roots",
  );
  assertCanonicalValues(source.monitoringEventIds, canonicalStringSet(source.monitoringEventIds), "candidate monitoring ids");
  assertCanonicalValues(source.monitoringRoots, canonicalHashSet(source.monitoringRoots), "candidate monitoring roots");
  assertCanonicalValues(source.contributorIds, canonicalStringSet(source.contributorIds), "candidate contributors");
  assertCanonicalValues(source.sourceActorIds, canonicalStringSet(source.sourceActorIds), "candidate source actors");
  assertCanonicalValues(source.limitations, canonicalStringSet(source.limitations), "candidate limitations");
  assertCanonicalValues(source.sourceEventRoots, canonicalHashSet(source.sourceEventRoots), "candidate source event roots");
  if (
    source.evidenceIds.length === 0 ||
    source.evidenceIds.length !== source.evidenceRegistrationRoots.length ||
    source.evidenceIds.length !== source.evidenceFinalDecisionIds.length ||
    source.evidenceIds.length !== source.evidenceFinalDecisionRoots.length ||
    source.evidenceIds.length !== source.evidenceFinalVerificationRoots.length
  ) {
    throw new Error("CanopyProof Environmental Proof candidate evidence authority cardinality is invalid.");
  }
  if (source.monitoringEventIds.length === 0 || source.monitoringEventIds.length !== source.monitoringRoots.length) {
    throw new Error("CanopyProof Environmental Proof candidate monitoring authority cardinality is invalid.");
  }
  for (const hash of [
    source.projectRoot,
    source.projectEventRoot,
    source.methodologyHash,
    source.methodologyQualityGateRoot,
    source.methodologyEventRoot,
    source.methodologyPublicationRoot,
    source.methodologyPublicationEventRoot,
    source.methodologyPublicationBundleRoot,
    source.methodologyPublicationPolicyRoot,
    source.methodologyPublicationPolicyEventRoot,
    source.methodologyApprovalQuorumRoot,
    source.policyHash,
    source.policyRoot,
    source.policyEventRoot,
    source.evidenceRoot,
    source.finalDecisionRoot,
    source.monitoringRoot,
    source.sourceRoot,
    source.authorityRoot,
  ]) {
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error("CanopyProof Environmental Proof candidate contains a malformed authority hash.");
    }
  }
  if (
    !source.sourceEventRoots.includes(source.projectEventRoot) ||
    !source.sourceEventRoots.includes(source.methodologyEventRoot) ||
    !source.sourceEventRoots.includes(source.methodologyPublicationEventRoot) ||
    !source.sourceEventRoots.includes(source.methodologyPublicationPolicyEventRoot) ||
    !source.sourceEventRoots.includes(source.policyEventRoot)
  ) {
    throw new Error("CanopyProof Environmental Proof candidate omits required project or methodology events.");
  }
  if (merkleRoot(source.evidenceRegistrationRoots) !== source.evidenceRoot) {
    throw new Error("CanopyProof Environmental Proof candidate evidence root is invalid.");
  }
  if (merkleRoot(source.evidenceFinalDecisionRoots) !== source.finalDecisionRoot) {
    throw new Error("CanopyProof Environmental Proof candidate final-decision root is invalid.");
  }
  if (merkleRoot(source.monitoringRoots) !== source.monitoringRoot) {
    throw new Error("CanopyProof Environmental Proof candidate monitoring root is invalid.");
  }
  if (merkleRoot(source.methodologyApprovalRoots) !== source.methodologyApprovalQuorumRoot) {
    throw new Error("CanopyProof Environmental Proof candidate methodology approval quorum root is invalid.");
  }
  const expectedMethodologyBundleRoot = hashJson({
    kind: "canopyproof-methodology-publication-bundle-v1",
    methodologyHash: source.methodologyHash,
    methodologyEventRoot: source.methodologyEventRoot,
    policyRoot: source.methodologyPublicationPolicyRoot,
    policyEventRoot: source.methodologyPublicationPolicyEventRoot,
    approvalRoots: source.methodologyApprovalRoots,
    publicationRoot: source.methodologyPublicationRoot,
    publicationEventRoot: source.methodologyPublicationEventRoot,
  });
  if (expectedMethodologyBundleRoot !== source.methodologyPublicationBundleRoot) {
    throw new Error("CanopyProof Environmental Proof candidate methodology publication bundle root is invalid.");
  }
  if (
    !Number.isFinite(source.publicLocation.latitude) ||
    source.publicLocation.latitude < -90 ||
    source.publicLocation.latitude > 90 ||
    !Number.isFinite(source.publicLocation.longitude) ||
    source.publicLocation.longitude < -180 ||
    source.publicLocation.longitude > 180 ||
    !Number.isFinite(source.publicLocation.areaHectares) ||
    source.publicLocation.areaHectares <= 0 ||
    source.publicLocation.regionId.trim().length === 0 ||
    !Number.isFinite(source.confidenceScore) ||
    source.confidenceScore < 0 ||
    source.confidenceScore > 100
  ) {
    throw new Error("CanopyProof Environmental Proof candidate public projection is invalid.");
  }
  const expectedSourceRoot = merkleRoot(
    [
      source.projectRoot,
      source.methodologyHash,
      source.methodologyQualityGateRoot,
      source.methodologyPublicationRoot,
      source.methodologyPublicationBundleRoot,
      source.methodologyPublicationPolicyRoot,
      ...source.methodologyApprovalRoots,
      source.policyHash,
      source.policyRoot,
      ...source.evidenceRegistrationRoots,
      ...source.evidenceFinalDecisionRoots,
      ...source.evidenceFinalVerificationRoots,
      ...source.monitoringRoots,
      ...source.sourceEventRoots,
    ].sort(),
  );
  if (expectedSourceRoot !== source.sourceRoot) {
    throw new Error("CanopyProof Environmental Proof candidate source root is invalid.");
  }
  const { authorityRoot, ...authoritySeed } = source;
  const expectedAuthorityRoot = hashJson({ kind: "canopyproof-environmental-proof-authority-v1", ...authoritySeed });
  if (expectedAuthorityRoot !== authorityRoot) {
    throw new Error("CanopyProof Environmental Proof candidate authority root is invalid.");
  }
}

function environmentalProofRecordCommandHash(input: Readonly<{
  candidate: CanopyProofEnvironmentalProofCandidate;
  governanceApprovalIds: readonly string[];
  governanceApprovalRoots: readonly string[];
  governanceQuorumRoot: string;
  issuer: CanopyProofVerificationActorSnapshot;
  rationale: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  issuedAt: string;
}>) {
  return hashJson({
    kind: "canopyproof-environmental-proof-record-command-v1",
    candidateId: input.candidate.id,
    candidateRoot: input.candidate.candidateRoot,
    authorityRoot: input.candidate.authorityRoot,
    governanceApprovalIds: input.governanceApprovalIds,
    governanceApprovalRoots: input.governanceApprovalRoots,
    governanceQuorumRoot: input.governanceQuorumRoot,
    issuer: input.issuer,
    rationale: input.rationale,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    issuedAt: input.issuedAt,
  });
}

function environmentalProofRecordSeed(input: Readonly<{
  candidate: CanopyProofEnvironmentalProofCandidate;
  governanceApprovalIds: readonly string[];
  governanceApprovalRoots: readonly string[];
  governanceQuorumRoot: string;
  issuer: CanopyProofVerificationActorSnapshot;
  rationale: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  sourceRoot: string;
  issuedAt: string;
  commandHash: string;
  candidateSequence: number;
  previousEventRoot: string;
}>) {
  return {
    recordType: "environmental_proof_record" as const,
    candidateId: input.candidate.id,
    candidateRoot: input.candidate.candidateRoot,
    authorityRoot: input.candidate.authorityRoot,
    organizationId: input.candidate.organizationId,
    projectId: input.candidate.projectId,
    projectRoot: input.candidate.projectRoot,
    methodologyId: input.candidate.methodologyId,
    methodologyHash: input.candidate.methodologyHash,
    methodologyPublicationId: input.candidate.methodologyPublicationId,
    methodologyPublicationRoot: input.candidate.methodologyPublicationRoot,
    policyId: input.candidate.policyId,
    policyRoot: input.candidate.policyRoot,
    evidenceIds: input.candidate.evidenceIds,
    evidenceRoot: input.candidate.evidenceRoot,
    evidenceFinalDecisionIds: input.candidate.evidenceFinalDecisionIds,
    evidenceFinalDecisionRoots: input.candidate.evidenceFinalDecisionRoots,
    monitoringEventIds: input.candidate.monitoringEventIds,
    monitoringRoot: input.candidate.monitoringRoot,
    contributorIds: input.candidate.contributorIds,
    publicLocation: input.candidate.publicLocation,
    confidenceScore: input.candidate.confidenceScore,
    governanceApprovalIds: input.governanceApprovalIds,
    governanceApprovalRoots: input.governanceApprovalRoots,
    governanceQuorumRoot: input.governanceQuorumRoot,
    issuer: input.issuer,
    rationale: input.rationale,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    sourceRoot: input.sourceRoot,
    issuedAt: input.issuedAt,
    commandHash: input.commandHash,
    candidateSequence: input.candidateSequence,
    previousEventRoot: input.previousEventRoot,
  };
}

function deriveCandidateSourceProjection(
  input: Readonly<{
    projectId: string;
    methodologyId: string;
    policyId: string;
    evidenceIds: readonly string[];
    monitoringEventIds: readonly string[];
    derivedAt: string;
  }>,
  sources: CanopyProofEnvironmentalProofAuthoritySources,
): CandidateSourceProjection {
  const evidenceIds = normalizeUniqueStrings(input.evidenceIds, "proof candidate evidence id");
  const monitoringEventIds = normalizeUniqueStrings(input.monitoringEventIds, "proof candidate monitoring event id");
  const projectService = CanopyProofProjectRegistryService.fromAuthoritySnapshot(sources.projects);
  const project = projectService.getProject(input.projectId);
  if (!(["active", "monitored"] as const).includes(project.status as "active" | "monitored")) {
    throw new Error(`CanopyProof Environmental Proof project status is ineligible: ${project.status}`);
  }
  const projectStatus = project.status as "active" | "monitored";
  const projectEventRoot = project.auditHistory.at(-1)?.eventRoot;
  if (!projectEventRoot) throw new Error("CanopyProof Environmental Proof project authority has no terminal event.");

  const methodologyGovernance = CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot(
    sources.methodologyGovernance,
  );
  const methodologyBundle = methodologyGovernance.getCurrentPublicationBundle(input.methodologyId);
  const methodology = methodologyBundle.methodology;
  validateMethodology(methodology);
  const policy = methodologyGovernance.getCurrentPolicy("environmental_proof_record");
  if (policy.id !== input.policyId) {
    throw new Error("CanopyProof Environmental Proof requires the current proof-governance policy authority.");
  }
  validateProofPolicy(policy);

  const evidenceService = CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot(
    sources.evidenceVerification,
  );
  const registrations = evidenceIds.map((evidenceId) => {
    const registration = sources.evidenceVerification.registrations.find((item) => item.id === evidenceId);
    if (!registration) throw new Error(`CanopyProof Environmental Proof evidence registration not found: ${evidenceId}`);
    if (registration.projectId !== project.id || registration.organizationId !== project.organizationId) {
      throw new Error("CanopyProof Environmental Proof evidence crosses project or organization authority.");
    }
    if (methodology.scope !== "multi_scope" && methodology.scope !== registration.evidenceType) {
      throw new Error(`CanopyProof Environmental Proof methodology scope does not cover evidence: ${evidenceId}`);
    }
    const finalVerification = evidenceService.getEvidenceFinalVerification(evidenceId);
    if (finalVerification.state !== "verified" || !finalVerification.currentDecisionId) {
      throw new Error(`CanopyProof Environmental Proof requires current verified evidence: ${evidenceId}`);
    }
    const decision = evidenceService.getFinalDecision(finalVerification.currentDecisionId);
    if (
      decision.decision !== "verify" ||
      decision.decisionRoot !== finalVerification.currentDecisionRoot ||
      decision.auditEvent.eventRoot !== finalVerification.terminalEventRoot
    ) {
      throw new Error(`CanopyProof Environmental Proof final decision is not current verify authority: ${evidenceId}`);
    }
    return { registration, finalVerification, decision };
  });

  const monitoringEvents = monitoringEventIds.map((eventId) => projectService.getMonitoringEvent(eventId));
  validateMonitoring(project, monitoringEvents, evidenceIds, registrations.map((item) => item.decision), methodology, input.derivedAt);
  validateMethodologyDataSources(methodology, registrations.map((item) => item.registration), monitoringEvents);

  const evidenceRegistrationRoots = registrations.map((item) => item.registration.evidenceRoot).sort();
  const evidenceFinalDecisionIds = registrations.map((item) => item.decision.id).sort();
  const evidenceFinalDecisionRoots = registrations.map((item) => item.decision.decisionRoot).sort();
  const evidenceFinalVerificationRoots = registrations.map((item) => item.finalVerification.finalVerificationRoot).sort();
  const monitoringRoots = monitoringEvents.map((event) => event.monitoringRoot).sort();
  const contributorIds = canonicalStringSet(
    registrations.map((item) => item.registration.contributor),
  );
  const sourceActorIds = canonicalStringSet(
    [
      methodology.createdBy,
      methodologyBundle.policy.creator.id,
      ...methodologyBundle.approvals.map((approval) => approval.approver.id),
      methodologyBundle.publication.publisher.id,
      policy.creator.id,
      ...project.auditHistory.map((event) => event.actor),
      ...registrations.flatMap(({ registration, decision }) => [
        registration.contributor,
        decision.verifier.id,
        decision.humanReviewId
          ? evidenceService.getHumanReview(decision.humanReviewId).reviewer.id
          : decision.verifier.id,
        ...decision.aiAnalysisIds.map((analysisId) => evidenceService.getAiAnalysis(analysisId).agent.id),
      ]),
      ...monitoringEvents.map((event) => event.observedBy),
    ],
  );
  const sourceEventRoots = canonicalHashSet(
    [
      projectEventRoot,
      methodology.auditEvent.eventRoot,
      methodologyBundle.policy.auditEvent.eventRoot,
      ...methodologyBundle.approvals.map((approval) => approval.auditEvent.eventRoot),
      methodologyBundle.publication.auditEvent.eventRoot,
      policy.auditEvent.eventRoot,
      ...registrations.flatMap(({ registration, decision }) => [
        registration.audit_history[0].eventRoot,
        decision.auditEvent.eventRoot,
      ]),
      ...monitoringEvents.map((event) => event.auditEvent.eventRoot),
    ],
  );
  const evidenceRoot = merkleRoot(evidenceRegistrationRoots);
  const finalDecisionRoot = merkleRoot(evidenceFinalDecisionRoots);
  const monitoringRoot = merkleRoot(monitoringRoots);
  const methodologyApprovalRoots = methodologyBundle.approvals.map((approval) => approval.approvalRoot).sort();
  const methodologyApprovalQuorumRoot = merkleRoot(methodologyApprovalRoots);
  const limitations = normalizeUniqueStrings(methodology.limitations, "proof candidate methodology limitation");
  const confidenceScore = Math.min(
    ...registrations.flatMap(({ registration, decision }) => [
      registration.confidence_score,
      ...decision.aiAnalysisIds.map((analysisId) => evidenceService.getAiAnalysis(analysisId).confidenceScore),
    ]),
  );
  const publicLocation = {
    latitude: project.location.latitude,
    longitude: project.location.longitude,
    regionId: project.regionId,
    areaHectares: project.location.areaHectares,
  };
  const sourceRoot = merkleRoot(
    [
      project.projectRoot,
      methodology.methodologyHash,
      methodology.qualityGateRoot,
      methodologyBundle.publication.publicationRoot,
      methodologyBundle.bundleRoot,
      methodologyBundle.policy.policyRoot,
      ...methodologyApprovalRoots,
      policy.policyHash,
      policy.policyRoot,
      ...evidenceRegistrationRoots,
      ...evidenceFinalDecisionRoots,
      ...evidenceFinalVerificationRoots,
      ...monitoringRoots,
      ...sourceEventRoots,
    ].sort(),
  );
  const authoritySeed = {
    organizationId: project.organizationId,
    projectId: project.id,
    projectStatus,
    projectRoot: project.projectRoot,
    projectEventRoot,
    methodologyId: methodology.id,
    methodologyHash: methodology.methodologyHash,
    methodologyQualityGateRoot: methodology.qualityGateRoot,
    methodologyEventRoot: methodology.auditEvent.eventRoot,
    methodologyPublicationId: methodologyBundle.publication.id,
    methodologyPublicationRoot: methodologyBundle.publication.publicationRoot,
    methodologyPublicationEventRoot: methodologyBundle.publication.auditEvent.eventRoot,
    methodologyPublicationBundleRoot: methodologyBundle.bundleRoot,
    methodologyPublicationPolicyRoot: methodologyBundle.policy.policyRoot,
    methodologyPublicationPolicyEventRoot: methodologyBundle.policy.auditEvent.eventRoot,
    methodologyApprovalRoots,
    methodologyApprovalQuorumRoot,
    policyId: policy.id,
    policyHash: policy.policyHash,
    policyRoot: policy.policyRoot,
    policyEventRoot: policy.auditEvent.eventRoot,
    requiredApprovals: policy.requiredApprovals,
    allowedReviewerRoles: canonicalStringSet(policy.allowedReviewerRoles) as readonly CanopyProofGovernedPolicyReviewerRole[],
    evidenceIds,
    evidenceRegistrationRoots,
    evidenceFinalDecisionIds,
    evidenceFinalDecisionRoots,
    evidenceFinalVerificationRoots,
    evidenceRoot,
    finalDecisionRoot,
    monitoringEventIds,
    monitoringRoots,
    monitoringRoot,
    contributorIds,
    sourceActorIds,
    publicLocation,
    confidenceScore,
    limitations,
    sourceEventRoots,
    sourceRoot,
  };
  return {
    ...authoritySeed,
    authorityRoot: hashJson({ kind: "canopyproof-environmental-proof-authority-v1", ...authoritySeed }),
  };
}

function validateMethodology(methodology: CanopyProofMethodology) {
  if (methodology.status !== "draft" || methodology.publishedAt || methodology.governanceApprovalIds.length > 0) {
    throw new Error("CanopyProof Environmental Proof requires a separately governed technical methodology draft.");
  }
  assertSafeText([
    methodology.id,
    methodology.slug,
    methodology.version,
    methodology.title,
    methodology.summary,
    ...methodology.limitations,
  ]);
  const requiredGates: readonly CanopyProofMethodologyQualityGate[] = [
    "human_review_required",
    "governance_approval_required",
    "public_challenge_window_required",
    "monitoring_timeline_required",
  ];
  const missingGate = requiredGates.find((gate) => !methodology.qualityGates.includes(gate));
  if (missingGate) throw new Error(`CanopyProof Environmental Proof methodology omits required gate: ${missingGate}`);
  const expectedQualityGateRoot = merkleRoot(
    methodology.qualityGates
      .map((qualityGate) =>
        hashJson({
          qualityGate,
          minimumGpsAccuracyMeters: methodology.minimumGpsAccuracyMeters,
          monitoringCadenceDays: methodology.monitoringCadenceDays,
          evidenceRetentionDays: methodology.evidenceRetentionDays,
        }),
      )
      .sort(),
  );
  if (expectedQualityGateRoot !== methodology.qualityGateRoot) {
    throw new Error("CanopyProof Environmental Proof methodology quality-gate root is invalid.");
  }
  const methodologySeed = {
    slug: methodology.slug,
    version: methodology.version,
    title: methodology.title,
    scope: methodology.scope,
    status: methodology.status,
    summary: methodology.summary,
    requiredDataSources: methodology.requiredDataSources,
    qualityGates: methodology.qualityGates,
    minimumGpsAccuracyMeters: methodology.minimumGpsAccuracyMeters,
    monitoringCadenceDays: methodology.monitoringCadenceDays,
    evidenceRetentionDays: methodology.evidenceRetentionDays,
    governanceApprovalIds: methodology.governanceApprovalIds,
    ...(methodology.supersedes ? { supersedes: methodology.supersedes } : {}),
    limitations: methodology.limitations,
    claimBoundary: methodology.claimBoundary,
    createdBy: methodology.createdBy,
    createdAt: methodology.createdAt,
    ...(methodology.publishedAt ? { publishedAt: methodology.publishedAt } : {}),
    qualityGateRoot: methodology.qualityGateRoot,
  };
  const expectedHash = hashJson({ kind: "canopyproof-methodology-v1", methodology: methodologySeed });
  const expectedPayloadHash = hashJson({ ...methodologySeed, methodologyHash: expectedHash });
  if (expectedHash !== methodology.methodologyHash || expectedPayloadHash !== methodology.auditEvent.payloadHash) {
    throw new Error("CanopyProof Environmental Proof methodology hash lineage is invalid.");
  }
  assertAuditEventIntegrity(methodology.auditEvent, "methodology", methodology.id, methodology.createdBy);
}

function validateProofPolicy(policy: CanopyProofGovernedPolicyAuthority) {
  assertSafeText([policy.id, policy.title]);
  if (policy.subject !== "environmental_proof_record") {
    throw new Error("CanopyProof Environmental Proof governance policy is invalid.");
  }
  if (
    policy.requiredApprovals < 2 ||
    policy.requiredApprovals > 32 ||
    !policy.allowedReviewerRoles.includes("verifier") ||
    (!policy.allowedReviewerRoles.includes("owner") && !policy.allowedReviewerRoles.includes("admin"))
  ) {
    throw new Error("CanopyProof Environmental Proof policy requires verifier and owner/admin quorum of at least two.");
  }
}

function validateMonitoring(
  project: CanopyProofProjectProfile,
  events: readonly CanopyProofProjectMonitoringEvent[],
  evidenceIds: readonly string[],
  decisions: readonly CanopyProofEvidenceFinalDecision[],
  methodology: CanopyProofMethodology,
  derivedAt: string,
) {
  if (events.length === 0) throw new Error("CanopyProof Environmental Proof requires accepted monitoring.");
  for (const event of events) {
    if (event.projectId !== project.id || event.organizationId !== project.organizationId || event.state !== "accepted") {
      throw new Error(`CanopyProof Environmental Proof monitoring authority is ineligible: ${event.id}`);
    }
  }
  const coverage = new Set(events.flatMap((event) => event.evidenceIds));
  const uncovered = evidenceIds.find((evidenceId) => !coverage.has(evidenceId));
  if (uncovered) throw new Error(`CanopyProof Environmental Proof monitoring does not cover evidence: ${uncovered}`);
  const latestDecisionTime = Math.max(...decisions.map((decision) => Date.parse(decision.decidedAt)));
  if (events.some((event) => Date.parse(event.observedAt) <= latestDecisionTime)) {
    throw new Error("CanopyProof Environmental Proof monitoring must postdate every final evidence decision.");
  }
  const latestMonitoringTime = Math.max(...events.map((event) => Date.parse(event.observedAt)));
  const cadenceMs = methodology.monitoringCadenceDays * 86_400_000;
  if (Date.parse(derivedAt) < latestMonitoringTime || Date.parse(derivedAt) - latestMonitoringTime > cadenceMs) {
    throw new Error("CanopyProof Environmental Proof monitoring is outside the methodology cadence window.");
  }
}

function validateMethodologyDataSources(
  methodology: CanopyProofMethodology,
  registrations: readonly CanopyProofEvidenceVerificationAuthoritySnapshot["registrations"][number][],
  monitoring: readonly CanopyProofProjectMonitoringEvent[],
) {
  for (const source of methodology.requiredDataSources) {
    const available =
      source === "field_photo"
        ? registrations.every((item) => Boolean(item.media_hash))
        : source === "gps_trace"
          ? registrations.every((item) => Boolean(item.gps_hash))
          : source === "satellite_scene"
            ? monitoring.some((item) => item.terraSceneIds.length > 0)
            : source === "sensor_reading"
              ? monitoring.some((item) => Object.keys(item.metrics).length > 0)
              : source === "governance_approval";
    if (!available) {
      throw new Error(`CanopyProof Environmental Proof lacks durable methodology data source: ${source}`);
    }
  }
}

function assertApprovalQuorum(
  candidate: CanopyProofEnvironmentalProofCandidate,
  approvals: readonly CanopyProofEnvironmentalProofCandidateApproval[],
) {
  if (approvals.length < candidate.requiredApprovals || approvals.some((approval) => approval.decision !== "approve")) {
    throw new Error("CanopyProof Environmental Proof governance approval quorum is incomplete or adverse.");
  }
  if (!approvals.some((approval) => approval.approver.role === "verifier")) {
    throw new Error("CanopyProof Environmental Proof governance quorum requires an accredited verifier.");
  }
  if (!approvals.some((approval) => approval.approver.role === "owner" || approval.approver.role === "admin")) {
    throw new Error("CanopyProof Environmental Proof governance quorum requires an owner or admin.");
  }
}

function environmentalProofApprovalCommandHash(input: Readonly<{
  candidate: CanopyProofEnvironmentalProofCandidate;
  prior?: CanopyProofEnvironmentalProofCandidateApproval;
  decision: CanopyProofEnvironmentalProofApprovalDecision;
  rationale: string;
  conflictDisclosure: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  approver: CanopyProofVerificationActorSnapshot;
  decidedAt: string;
}>) {
  return hashJson({
    kind: "canopyproof-environmental-proof-candidate-approval-command-v1",
    candidateId: input.candidate.id,
    candidateRoot: input.candidate.candidateRoot,
    policyId: input.candidate.policyId,
    policyHash: input.candidate.policyHash,
    priorApprovalId: input.prior?.id ?? null,
    priorApprovalRoot: input.prior?.approvalRoot ?? null,
    decision: input.decision,
    rationale: input.rationale,
    conflictDisclosure: input.conflictDisclosure,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    approver: input.approver,
    decidedAt: input.decidedAt,
  });
}

function normalizeActor(input: unknown): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = normalizeUniqueStrings(parsed.accreditationScope, "proof actor accreditation scope");
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
    accreditationScope,
  };
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (parsed.authorityRoot && normalizeHash(parsed.authorityRoot) !== authorityRoot) {
    throw new Error("CanopyProof Environmental Proof actor authority root is invalid.");
  }
  return {
    ...normalized,
    authorityRoot,
  };
}

function assertOrganizationMember(
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
    throw new Error("CanopyProof Environmental Proof action requires exact active human organization authority.");
  }
}

function requireAccreditation(actor: CanopyProofVerificationActorSnapshot) {
  if (
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    actor.accreditationScope.length === 0
  ) {
    throw new Error("CanopyProof Environmental Proof verifier requires current approved accreditation.");
  }
}

function latestSourceTime(source: CandidateSourceProjection, sources: CanopyProofEnvironmentalProofAuthoritySources) {
  const methodologyGovernance = CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot(
    sources.methodologyGovernance,
  );
  const publication = methodologyGovernance.getPublication(source.methodologyPublicationId);
  const policy = methodologyGovernance.getPolicy(source.policyId);
  const projectService = CanopyProofProjectRegistryService.fromAuthoritySnapshot(sources.projects);
  const project = projectService.getProject(source.projectId);
  const evidenceService = CanopyProofEvidenceVerificationAuthorityService.fromAuthoritySnapshot(sources.evidenceVerification);
  return Math.max(
    Date.parse(publication.publishedAt),
    Date.parse(policy.createdAt),
    Date.parse(project.updatedAt),
    ...source.evidenceFinalDecisionIds.map((id) => Date.parse(evidenceService.getFinalDecision(id).decidedAt)),
    ...source.monitoringEventIds.map((id) => Date.parse(projectService.getMonitoringEvent(id).observedAt)),
  );
}

function assertAuditEventIntegrity(event: CanopyProofAuditEvent, entityType: string, entityId: string, actorId: string) {
  const expectedRoot = hashJson({
    kind: "canopyproof-audit-event-v1",
    action: event.action,
    actor: event.actor,
    entityType: event.entityType,
    entityId: event.entityId,
    previousRoot: event.previousRoot,
    payloadHash: event.payloadHash,
    createdAt: event.createdAt,
    rationale: event.rationale,
  });
  if (
    event.entityType !== entityType ||
    event.entityId !== entityId ||
    event.actor !== actorId ||
    event.eventRoot !== expectedRoot ||
    event.id !== `cp_audit_${expectedRoot.slice(0, 24)}`
  ) {
    throw new Error(`CanopyProof ${entityType} semantic event is invalid.`);
  }
}

function requireEventRoots(roots: readonly string[], events: readonly CanopyProofAuditEvent[], label: string) {
  const known = new Set(events.map((event) => event.eventRoot));
  const unknown = roots.find((root) => !known.has(root));
  if (unknown) throw new Error(`CanopyProof ${label} is missing or foreign: ${unknown}`);
}

function assertMonotonicTime(events: readonly CanopyProofAuditEvent[], timestamp: string) {
  const previous = events.at(-1);
  if (previous && Date.parse(timestamp) < Date.parse(previous.createdAt)) {
    throw new Error("CanopyProof Environmental Proof fact time must be monotonic.");
  }
}

function normalizeHash(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}

function normalizeUniqueHashes(values: readonly string[], label: string) {
  return normalizeUniqueStrings(values.map(normalizeHash), label);
}

function canonicalHashSet(values: readonly string[]) {
  return canonicalStringSet(values.map(normalizeHash));
}

function canonicalStringSet(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function assertCanonicalValues(actual: readonly string[], expected: readonly string[], label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof Environmental Proof ${label} must be sorted, normalized, and unique.`);
  }
}

function normalizeUniqueStrings(values: readonly string[], label: string) {
  const normalized = values.map((value) => value.trim()).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`CanopyProof ${label} values must be unique.`);
  }
  return normalized;
}

function assertSafeText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) throw new Error(`CanopyProof Environmental Proof input contains unsafe claim or secret material: ${unsafe}`);
}

export function canopyProofEnvironmentalProofSafetyBoundary(): CanopyProofEnvironmentalProofSafetyBoundary {
  return environmentalProofSafetyBoundary();
}

function environmentalProofSafetyBoundary(): CanopyProofEnvironmentalProofSafetyBoundary {
  return {
    environmentalAccountabilityOnly: true,
    sourceAuthorityReplayed: true,
    currentFinalEvidenceOnly: true,
    governedMethodologyRequired: true,
    acceptedMonitoringRequired: true,
    independentHumanGovernanceRequired: true,
    publicChallengeRequiredBeforePublicReliance: true,
    noRawEvidence: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}
