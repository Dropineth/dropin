import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  canopyProofMethodologyQualityGates,
  CanopyProofMethodologyRegistryService,
  type CanopyProofMethodology,
  type CanopyProofMethodologyQualityGate,
} from "./methodology-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofGovernedPolicySubjects = [
  "methodology_publication",
  "environmental_proof_record",
  "project_lifecycle",
] as const;
export const canopyProofGovernedPolicyReviewerRoles = ["admin", "owner", "researcher", "verifier"] as const;
export const canopyProofMethodologyPublicationDecisions = ["approve", "reject", "request_changes"] as const;

export type CanopyProofGovernedPolicySubject = (typeof canopyProofGovernedPolicySubjects)[number];
export type CanopyProofGovernedPolicyReviewerRole = (typeof canopyProofGovernedPolicyReviewerRoles)[number];
export type CanopyProofMethodologyPublicationDecision = (typeof canopyProofMethodologyPublicationDecisions)[number];

export type CanopyProofMethodologyGovernanceSafetyBoundary = {
  readonly immutableAuthority: true;
  readonly exactHumanAuthority: true;
  readonly independentQuorumRequired: true;
  readonly aiIsNeverFinalAuthority: true;
  readonly environmentalAccountabilityOnly: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofGovernedPolicyAuthority = {
  readonly factType: "governed_policy_authority";
  readonly id: string;
  readonly subject: CanopyProofGovernedPolicySubject;
  readonly governanceOrganizationId: string;
  readonly title: string;
  readonly requiredApprovals: number;
  readonly allowedReviewerRoles: readonly CanopyProofGovernedPolicyReviewerRole[];
  readonly supersedesPolicyId?: string;
  readonly supersedesPolicyRoot?: string;
  readonly creator: CanopyProofVerificationActorSnapshot;
  readonly createdAt: string;
  readonly commandHash: string;
  readonly policyHash: string;
  readonly policyRoot: string;
  readonly safety: CanopyProofMethodologyGovernanceSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMethodologyPublicationApproval = {
  readonly factType: "methodology_publication_approval";
  readonly id: string;
  readonly methodologyId: string;
  readonly methodologyHash: string;
  readonly methodologyEventRoot: string;
  readonly policyId: string;
  readonly policyRoot: string;
  readonly governanceOrganizationId: string;
  readonly priorApprovalId?: string;
  readonly priorApprovalRoot?: string;
  readonly decision: CanopyProofMethodologyPublicationDecision;
  readonly rationale: string;
  readonly conflictDisclosure: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly approver: CanopyProofVerificationActorSnapshot;
  readonly decidedAt: string;
  readonly commandHash: string;
  readonly methodologySequence: number;
  readonly previousEventRoot: string;
  readonly approvalHash: string;
  readonly approvalRoot: string;
  readonly safety: CanopyProofMethodologyGovernanceSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMethodologyPublication = {
  readonly factType: "methodology_publication";
  readonly id: string;
  readonly methodologyId: string;
  readonly methodologyHash: string;
  readonly methodologyQualityGateRoot: string;
  readonly methodologyEventRoot: string;
  readonly policyId: string;
  readonly policyRoot: string;
  readonly governanceOrganizationId: string;
  readonly approvalIds: readonly string[];
  readonly approvalRoots: readonly string[];
  readonly approvalQuorumRoot: string;
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly publishedAt: string;
  readonly commandHash: string;
  readonly methodologySequence: number;
  readonly previousEventRoot: string;
  readonly publicationHash: string;
  readonly publicationRoot: string;
  readonly safety: CanopyProofMethodologyGovernanceSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMethodologyPublicationBundle = {
  readonly methodology: CanopyProofMethodology;
  readonly policy: CanopyProofGovernedPolicyAuthority;
  readonly approvals: readonly CanopyProofMethodologyPublicationApproval[];
  readonly publication: CanopyProofMethodologyPublication;
  readonly bundleRoot: string;
};

export type CanopyProofMethodologyPublicationProjection = {
  readonly methodologyId: string;
  readonly publicationId: string;
  readonly publicationRoot: string;
  readonly state: "published" | "superseded";
  readonly successorPublicationId?: string;
  readonly successorPublicationRoot?: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofMethodologyGovernanceSafetyBoundary;
};

export type CanopyProofMethodologyGovernanceAuthoritySnapshot = {
  readonly policies: readonly CanopyProofGovernedPolicyAuthority[];
  readonly methodologies: readonly CanopyProofMethodology[];
  readonly approvals: readonly CanopyProofMethodologyPublicationApproval[];
  readonly publications: readonly CanopyProofMethodologyPublication[];
};

type MethodologyStream = {
  readonly methodology: CanopyProofMethodology;
  readonly events: CanopyProofAuditEvent[];
  readonly approvals: CanopyProofMethodologyPublicationApproval[];
  publication?: CanopyProofMethodologyPublication;
};

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

const policyInputSchema = z
  .object({
    id: identifierSchema.optional(),
    subject: z.enum(canopyProofGovernedPolicySubjects),
    title: z.string().trim().min(16).max(240),
    requiredApprovals: z.number().int().min(2).max(32),
    allowedReviewerRoles: z.array(z.enum(canopyProofGovernedPolicyReviewerRoles)).min(2).max(4),
    supersedesPolicyId: identifierSchema.optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

const approvalInputSchema = z
  .object({
    id: identifierSchema.optional(),
    decision: z.enum(canopyProofMethodologyPublicationDecisions),
    rationale: z.string().trim().min(24).max(4_000),
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(hashSchema).min(1).max(128),
    decidedAt: z.string().datetime(),
  })
  .strict();

const publicationInputSchema = z
  .object({
    id: identifierSchema.optional(),
    approvalIds: z.array(identifierSchema).min(2).max(32),
    rationale: z.string().trim().min(24).max(4_000),
    limitations: z.array(z.string().trim().min(1).max(1_000)).max(32).default([]),
    sourceEventRoots: z.array(hashSchema).min(1).max(256),
    publishedAt: z.string().datetime(),
  })
  .strict();

export class CanopyProofMethodologyGovernanceAuthorityService {
  private readonly policiesById = new Map<string, CanopyProofGovernedPolicyAuthority>();
  private readonly currentPolicyIdBySubject = new Map<CanopyProofGovernedPolicySubject, string>();
  private readonly streamsByMethodologyId = new Map<string, MethodologyStream>();
  private readonly approvalsById = new Map<string, CanopyProofMethodologyPublicationApproval>();
  private readonly publicationsById = new Map<string, CanopyProofMethodologyPublication>();

  constructor(methodologies: readonly CanopyProofMethodology[] = []) {
    const replayedMethodologies = CanopyProofMethodologyRegistryService.fromAuthoritySnapshot({ methodologies })
      .listMethodologies({ includeAll: true });
    const seenVersions = new Set<string>();
    for (const methodology of replayedMethodologies) {
      validateMethodologyVersion(methodology);
      const versionKey = `${methodology.slug}@${methodology.version}`;
      if (seenVersions.has(versionKey) || this.streamsByMethodologyId.has(methodology.id)) {
        throw new Error(`CanopyProof methodology governance snapshot contains duplicate version: ${versionKey}`);
      }
      seenVersions.add(versionKey);
      this.streamsByMethodologyId.set(methodology.id, {
        methodology,
        events: [methodology.auditEvent],
        approvals: [],
      });
    }
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofMethodologyGovernanceAuthoritySnapshot) {
    const service = new CanopyProofMethodologyGovernanceAuthorityService(snapshot.methodologies);
    const facts = [...snapshot.policies, ...snapshot.approvals, ...snapshot.publications];
    const seenIds = new Set<string>();
    for (const fact of facts) {
      if (seenIds.has(fact.id)) {
        throw new Error(`CanopyProof methodology governance snapshot contains duplicate fact id: ${fact.id}`);
      }
      seenIds.add(fact.id);
    }
    for (const fact of [...facts].sort(
      (left, right) =>
        left.auditEvent.createdAt.localeCompare(right.auditEvent.createdAt) ||
        factReplayOrder(left.factType) - factReplayOrder(right.factType) ||
        left.id.localeCompare(right.id),
    )) {
      const replayed =
        fact.factType === "governed_policy_authority"
          ? service.createPolicy(
              {
                id: fact.id,
                subject: fact.subject,
                title: fact.title,
                requiredApprovals: fact.requiredApprovals,
                allowedReviewerRoles: fact.allowedReviewerRoles,
                ...(fact.supersedesPolicyId ? { supersedesPolicyId: fact.supersedesPolicyId } : {}),
                createdAt: fact.createdAt,
              },
              fact.creator,
            )
          : fact.factType === "methodology_publication_approval"
            ? service.approveMethodology(
                fact.methodologyId,
                {
                  id: fact.id,
                  decision: fact.decision,
                  rationale: fact.rationale,
                  conflictDisclosure: fact.conflictDisclosure,
                  limitations: fact.limitations,
                  sourceEventRoots: fact.sourceEventRoots,
                  decidedAt: fact.decidedAt,
                },
                fact.approver,
              )
            : service.publishMethodology(
                fact.methodologyId,
                {
                  id: fact.id,
                  approvalIds: fact.approvalIds,
                  rationale: fact.rationale,
                  limitations: fact.limitations,
                  sourceEventRoots: fact.sourceEventRoots,
                  publishedAt: fact.publishedAt,
                },
                fact.publisher,
              );
      if (hashJson(replayed) !== hashJson(fact)) {
        throw new Error(`CanopyProof methodology governance snapshot fact lineage is invalid: ${fact.id}`);
      }
    }
    return service;
  }

  createPolicy(input: unknown, creatorInput: unknown): CanopyProofGovernedPolicyAuthority {
    const parsed = policyInputSchema.parse(input);
    const creator = normalizeActor(creatorInput);
    assertHumanAuthority(creator, creator.organizationId, ["owner", "admin"]);
    const allowedReviewerRoles = normalizeUniqueStrings(parsed.allowedReviewerRoles, "policy reviewer role") as CanopyProofGovernedPolicyReviewerRole[];
    validateConstitutionalPolicy(parsed.subject, parsed.requiredApprovals, allowedReviewerRoles);
    assertSafeText([parsed.id ?? "", parsed.title]);
    const current = this.getCurrentPolicyOptional(parsed.subject);
    const superseded = parsed.supersedesPolicyId ? this.getPolicy(parsed.supersedesPolicyId) : undefined;
    const commandHash = hashJson({
      kind: "canopyproof-governed-policy-command-v1",
      subject: parsed.subject,
      governanceOrganizationId: creator.organizationId,
      title: parsed.title,
      requiredApprovals: parsed.requiredApprovals,
      allowedReviewerRoles,
      supersedesPolicyId: superseded?.id ?? null,
      supersedesPolicyRoot: superseded?.policyRoot ?? null,
      creator,
      createdAt: parsed.createdAt,
    });
    const id = `cp_governed_policy_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof governed policy id does not match its canonical command hash.");
    }
    const existing = this.policiesById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof governed policy conflicts with committed authority: ${id}`);
    }
    if (current && !superseded) {
      throw new Error(`CanopyProof governed policy subject already has current authority: ${parsed.subject}`);
    }
    if (
      superseded &&
      (current?.id !== superseded.id ||
        superseded.subject !== parsed.subject ||
        superseded.governanceOrganizationId !== creator.organizationId)
    ) {
      throw new Error("CanopyProof governed policy supersession must bind the current same-subject authority.");
    }
    if (superseded && Date.parse(parsed.createdAt) <= Date.parse(superseded.createdAt)) {
      throw new Error("CanopyProof governed policy successor must postdate its predecessor.");
    }
    const policySeed = {
      subject: parsed.subject,
      governanceOrganizationId: creator.organizationId,
      title: parsed.title,
      requiredApprovals: parsed.requiredApprovals,
      allowedReviewerRoles,
      ...(superseded ? { supersedesPolicyId: superseded.id, supersedesPolicyRoot: superseded.policyRoot } : {}),
      creator,
      createdAt: parsed.createdAt,
      commandHash,
    };
    const policyHash = hashJson({ kind: "canopyproof-governed-policy-v1", id, ...policySeed });
    const policyRoot = hashJson({
      kind: "canopyproof-governed-policy-root-v1",
      policyHash,
      previousPolicyRoot: superseded?.policyRoot ?? canopyProofAuditGenesisRoot(),
    });
    const safety = methodologyGovernanceSafetyBoundary();
    const payload = { factType: "governed_policy_authority", id, ...policySeed, policyHash, policyRoot, safety };
    const priorEvents = superseded ? [superseded.auditEvent] : [];
    const auditEvent = appendCanopyProofAuditEvent(priorEvents, {
      action: "ASSERT",
      actor: creator.id,
      entityType: "governed_policy_authority",
      entityId: id,
      payload,
      createdAt: parsed.createdAt,
      rationale: "An immutable governed policy version was recorded under constitutional human-quorum invariants.",
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof governed policy event was not appended.");
    const policy: CanopyProofGovernedPolicyAuthority = {
      factType: "governed_policy_authority",
      id,
      ...policySeed,
      policyHash,
      policyRoot,
      safety,
      auditEvent,
    };
    this.policiesById.set(id, policy);
    this.currentPolicyIdBySubject.set(parsed.subject, id);
    return policy;
  }

  getPolicy(policyId: string) {
    const policy = this.policiesById.get(policyId);
    if (!policy) throw new Error(`CanopyProof governed policy not found: ${policyId}`);
    return policy;
  }

  getCurrentPolicy(subject: CanopyProofGovernedPolicySubject) {
    const policy = this.getCurrentPolicyOptional(subject);
    if (!policy) throw new Error(`CanopyProof current governed policy is unavailable: ${subject}`);
    return policy;
  }

  listPolicies(subject?: CanopyProofGovernedPolicySubject) {
    return [...this.policiesById.values()]
      .filter((policy) => !subject || policy.subject === subject)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  private getCurrentPolicyOptional(subject: CanopyProofGovernedPolicySubject) {
    const id = this.currentPolicyIdBySubject.get(subject);
    return id ? this.policiesById.get(id) : undefined;
  }

  approveMethodology(
    methodologyId: string,
    input: unknown,
    approverInput: unknown,
  ): CanopyProofMethodologyPublicationApproval {
    const stream = this.requireStream(methodologyId);
    const parsed = approvalInputSchema.parse(input);
    const approver = normalizeActor(approverInput);
    const limitations = normalizeUniqueStrings(parsed.limitations, "methodology approval limitation");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "methodology approval source event root");
    assertSafeText([parsed.id ?? "", parsed.rationale, parsed.conflictDisclosure, ...limitations]);

    const actorApproval = stream.approvals.find((approval) => approval.approver.id === approver.id);
    if (actorApproval) {
      const prior = actorApproval.priorApprovalId ? this.getApproval(actorApproval.priorApprovalId) : undefined;
      const policy = this.getPolicy(actorApproval.policyId);
      const retryCommandHash = methodologyApprovalCommandHash({
        methodology: stream.methodology,
        policy,
        ...(prior ? { prior } : {}),
        decision: parsed.decision,
        rationale: parsed.rationale,
        conflictDisclosure: parsed.conflictDisclosure,
        limitations,
        sourceEventRoots,
        approver,
        decidedAt: parsed.decidedAt,
      });
      const retryId = `cp_methodology_publication_approval_${retryCommandHash.slice(0, 24)}`;
      if ((!parsed.id || parsed.id === retryId) && actorApproval.commandHash === retryCommandHash) {
        return actorApproval;
      }
      throw new Error("CanopyProof methodology publication approval requires an independent human approver.");
    }
    if (stream.publication) {
      throw new Error("CanopyProof published methodology cannot accept later publication approvals.");
    }

    const policy = this.getCurrentPolicy("methodology_publication");
    assertHumanAuthority(approver, policy.governanceOrganizationId, policy.allowedReviewerRoles);
    if (!policy.allowedReviewerRoles.includes(approver.role as CanopyProofGovernedPolicyReviewerRole)) {
      throw new Error("CanopyProof methodology publication policy does not authorize this reviewer role.");
    }
    if (approver.role === "verifier") requireAccreditation(approver);
    if (approver.id === stream.methodology.createdBy) {
      throw new Error("CanopyProof methodology publication approval requires independence from the methodology author.");
    }
    const prior = stream.approvals.at(-1);
    const knownRoots = new Set([...stream.events.map((event) => event.eventRoot), policy.auditEvent.eventRoot]);
    requireKnownRoots(sourceEventRoots, knownRoots, "methodology approval source event");
    const requiredRoots = [stream.methodology.auditEvent.eventRoot, policy.auditEvent.eventRoot, prior?.auditEvent.eventRoot]
      .filter((root): root is string => Boolean(root));
    const missingRoot = requiredRoots.find((root) => !sourceEventRoots.includes(root));
    if (missingRoot) throw new Error(`CanopyProof methodology approval omits required authority event: ${missingRoot}`);
    assertAfterEvents(stream.events, parsed.decidedAt);
    if (Date.parse(parsed.decidedAt) < Date.parse(policy.createdAt)) {
      throw new Error("CanopyProof methodology approval cannot predate its governing policy.");
    }

    const commandHash = methodologyApprovalCommandHash({
      methodology: stream.methodology,
      policy,
      ...(prior ? { prior } : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      limitations,
      sourceEventRoots,
      approver,
      decidedAt: parsed.decidedAt,
    });
    const id = `cp_methodology_publication_approval_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof methodology publication approval id is non-canonical.");
    }
    if (this.approvalsById.has(id)) {
      throw new Error(`CanopyProof methodology publication approval id conflicts with committed authority: ${id}`);
    }
    const methodologySequence = stream.events.length + 1;
    const previousEventRoot = stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceRoot = merkleRoot(
      [
        stream.methodology.methodologyHash,
        stream.methodology.qualityGateRoot,
        policy.policyRoot,
        ...sourceEventRoots,
        ...(prior ? [prior.approvalRoot] : []),
      ].sort(),
    );
    const seed = {
      methodologyId,
      methodologyHash: stream.methodology.methodologyHash,
      methodologyEventRoot: stream.methodology.auditEvent.eventRoot,
      policyId: policy.id,
      policyRoot: policy.policyRoot,
      governanceOrganizationId: policy.governanceOrganizationId,
      ...(prior ? { priorApprovalId: prior.id, priorApprovalRoot: prior.approvalRoot } : {}),
      decision: parsed.decision,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      limitations,
      sourceEventRoots,
      sourceRoot,
      approver,
      decidedAt: parsed.decidedAt,
      commandHash,
      methodologySequence,
      previousEventRoot,
    };
    const approvalHash = hashJson({ kind: "canopyproof-methodology-publication-approval-v1", ...seed });
    const approvalRoot = hashJson({
      kind: "canopyproof-methodology-publication-approval-root-v1",
      methodologyHash: stream.methodology.methodologyHash,
      policyRoot: policy.policyRoot,
      sourceRoot,
      approvalHash,
      previousEventRoot,
      methodologySequence,
    });
    const safety = methodologyGovernanceSafetyBoundary();
    const payload = { factType: "methodology_publication_approval", id, ...seed, approvalHash, approvalRoot, safety };
    const auditEvent = appendCanopyProofAuditEvent(stream.events, {
      action: parsed.decision === "approve" ? "FULFILL" : parsed.decision === "reject" ? "CHALLENGE" : "REASON",
      actor: approver.id,
      entityType: "methodology_publication_approval",
      entityId: id,
      payload,
      createdAt: parsed.decidedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof methodology publication approval event was not appended.");
    const approval: CanopyProofMethodologyPublicationApproval = {
      factType: "methodology_publication_approval",
      id,
      ...seed,
      approvalHash,
      approvalRoot,
      safety,
      auditEvent,
    };
    stream.approvals.push(approval);
    stream.events.push(auditEvent);
    this.approvalsById.set(id, approval);
    return approval;
  }

  publishMethodology(
    methodologyId: string,
    input: unknown,
    publisherInput: unknown,
  ): CanopyProofMethodologyPublication {
    const stream = this.requireStream(methodologyId);
    const parsed = publicationInputSchema.parse(input);
    const publisher = normalizeActor(publisherInput);
    const approvalIds = normalizeUniqueStrings(parsed.approvalIds, "methodology publication approval id");
    const limitations = normalizeUniqueStrings(parsed.limitations, "methodology publication limitation");
    const sourceEventRoots = normalizeUniqueHashes(parsed.sourceEventRoots, "methodology publication source event root");
    assertSafeText([parsed.id ?? "", parsed.rationale, ...limitations]);
    if (stream.publication) {
      const existing = stream.publication;
      if (
        (!parsed.id || parsed.id === existing.id) &&
        hashJson(approvalIds) === hashJson(existing.approvalIds) &&
        parsed.rationale === existing.rationale &&
        hashJson(limitations) === hashJson(existing.limitations) &&
        hashJson(sourceEventRoots) === hashJson(existing.sourceEventRoots) &&
        parsed.publishedAt === existing.publishedAt &&
        hashJson(publisher) === hashJson(existing.publisher)
      ) {
        return existing;
      }
      throw new Error("CanopyProof methodology already has a conflicting publication fact.");
    }

    const policy = this.getCurrentPolicy("methodology_publication");
    assertHumanAuthority(publisher, policy.governanceOrganizationId, ["owner", "admin"]);
    const approvals = stream.approvals;
    if (hashJson(approvalIds) !== hashJson(approvals.map((approval) => approval.id).sort())) {
      throw new Error("CanopyProof methodology publication must bind the complete approval set.");
    }
    assertMethodologyApprovalQuorum(stream.methodology, policy, approvals);
    if (publisher.id === stream.methodology.createdBy || approvals.some((approval) => approval.approver.id === publisher.id)) {
      throw new Error("CanopyProof methodology publication requires an independent human publisher.");
    }
    const knownRoots = new Set([...stream.events.map((event) => event.eventRoot), policy.auditEvent.eventRoot]);
    requireKnownRoots(sourceEventRoots, knownRoots, "methodology publication source event");
    const requiredRoots = [
      stream.methodology.auditEvent.eventRoot,
      policy.auditEvent.eventRoot,
      ...approvals.map((approval) => approval.auditEvent.eventRoot),
    ];
    const missingRoot = requiredRoots.find((root) => !sourceEventRoots.includes(root));
    if (missingRoot) throw new Error(`CanopyProof methodology publication omits required authority event: ${missingRoot}`);
    assertAfterEvents(stream.events, parsed.publishedAt);
    const approvalRoots = approvals.map((approval) => approval.approvalRoot).sort();
    const approvalQuorumRoot = merkleRoot(approvalRoots);
    const commandHash = methodologyPublicationCommandHash({
      methodology: stream.methodology,
      policy,
      approvalIds,
      approvalRoots,
      approvalQuorumRoot,
      publisher,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      publishedAt: parsed.publishedAt,
    });
    const id = `cp_methodology_publication_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CanopyProof methodology publication id is non-canonical.");
    }
    if (this.publicationsById.has(id)) {
      throw new Error(`CanopyProof methodology publication id conflicts with committed authority: ${id}`);
    }
    const methodologySequence = stream.events.length + 1;
    const previousEventRoot = stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceRoot = merkleRoot(
      [stream.methodology.methodologyHash, stream.methodology.qualityGateRoot, policy.policyRoot, ...approvalRoots, ...sourceEventRoots].sort(),
    );
    const seed = {
      methodologyId,
      methodologyHash: stream.methodology.methodologyHash,
      methodologyQualityGateRoot: stream.methodology.qualityGateRoot,
      methodologyEventRoot: stream.methodology.auditEvent.eventRoot,
      policyId: policy.id,
      policyRoot: policy.policyRoot,
      governanceOrganizationId: policy.governanceOrganizationId,
      approvalIds,
      approvalRoots,
      approvalQuorumRoot,
      publisher,
      rationale: parsed.rationale,
      limitations,
      sourceEventRoots,
      sourceRoot,
      publishedAt: parsed.publishedAt,
      commandHash,
      methodologySequence,
      previousEventRoot,
    };
    const publicationHash = hashJson({ kind: "canopyproof-methodology-publication-v1", ...seed });
    const publicationRoot = hashJson({
      kind: "canopyproof-methodology-publication-root-v1",
      methodologyHash: stream.methodology.methodologyHash,
      policyRoot: policy.policyRoot,
      approvalQuorumRoot,
      sourceRoot,
      publicationHash,
      previousEventRoot,
      methodologySequence,
    });
    const safety = methodologyGovernanceSafetyBoundary();
    const payload = { factType: "methodology_publication", id, ...seed, publicationHash, publicationRoot, safety };
    const auditEvent = appendCanopyProofAuditEvent(stream.events, {
      action: "FULFILL",
      actor: publisher.id,
      entityType: "methodology_publication",
      entityId: id,
      payload,
      createdAt: parsed.publishedAt,
      rationale: parsed.rationale,
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof methodology publication event was not appended.");
    const publication: CanopyProofMethodologyPublication = {
      factType: "methodology_publication",
      id,
      ...seed,
      publicationHash,
      publicationRoot,
      safety,
      auditEvent,
    };
    stream.publication = publication;
    stream.events.push(auditEvent);
    this.publicationsById.set(id, publication);
    return publication;
  }

  getApproval(approvalId: string) {
    const approval = this.approvalsById.get(approvalId);
    if (!approval) throw new Error(`CanopyProof methodology publication approval not found: ${approvalId}`);
    return approval;
  }

  listApprovals(methodologyId: string) {
    return [...this.requireStream(methodologyId).approvals].sort(
      (left, right) => left.methodologySequence - right.methodologySequence || left.id.localeCompare(right.id),
    );
  }

  getPublication(publicationId: string) {
    const publication = this.publicationsById.get(publicationId);
    if (!publication) throw new Error(`CanopyProof methodology publication not found: ${publicationId}`);
    return publication;
  }

  getPublicationProjection(methodologyId: string): CanopyProofMethodologyPublicationProjection {
    const stream = this.requireStream(methodologyId);
    const publication = stream.publication;
    if (!publication) throw new Error(`CanopyProof methodology has no publication authority: ${methodologyId}`);
    const successor = [...this.streamsByMethodologyId.values()]
      .filter((item) => item.methodology.supersedes === methodologyId && item.publication)
      .sort((left, right) =>
        left.publication!.publishedAt.localeCompare(right.publication!.publishedAt) || left.methodology.id.localeCompare(right.methodology.id),
      )
      .at(-1)?.publication;
    const policyCurrent = this.getCurrentPolicyOptional("methodology_publication")?.id === publication.policyId;
    const state = successor || !policyCurrent ? "superseded" : "published";
    const seed = {
      methodologyId,
      publicationId: publication.id,
      publicationRoot: publication.publicationRoot,
      state,
      successorPublicationId: successor?.id ?? null,
      successorPublicationRoot: successor?.publicationRoot ?? null,
    };
    return {
      methodologyId,
      publicationId: publication.id,
      publicationRoot: publication.publicationRoot,
      state,
      ...(successor ? { successorPublicationId: successor.id, successorPublicationRoot: successor.publicationRoot } : {}),
      projectionRoot: hashJson({ kind: "canopyproof-methodology-publication-projection-v1", ...seed }),
      safety: methodologyGovernanceSafetyBoundary(),
    };
  }

  getPublicationBundle(publicationId: string): CanopyProofMethodologyPublicationBundle {
    const publication = this.getPublication(publicationId);
    const methodology = this.requireStream(publication.methodologyId).methodology;
    const policy = this.getPolicy(publication.policyId);
    const approvals = publication.approvalIds.map((approvalId) => this.getApproval(approvalId));
    const bundleSeed = {
      methodologyHash: methodology.methodologyHash,
      methodologyEventRoot: methodology.auditEvent.eventRoot,
      policyRoot: policy.policyRoot,
      policyEventRoot: policy.auditEvent.eventRoot,
      approvalRoots: approvals.map((approval) => approval.approvalRoot).sort(),
      publicationRoot: publication.publicationRoot,
      publicationEventRoot: publication.auditEvent.eventRoot,
    };
    return {
      methodology,
      policy,
      approvals,
      publication,
      bundleRoot: hashJson({ kind: "canopyproof-methodology-publication-bundle-v1", ...bundleSeed }),
    };
  }

  getCurrentPublicationBundle(methodologyId: string) {
    const projection = this.getPublicationProjection(methodologyId);
    if (projection.state !== "published") {
      throw new Error(`CanopyProof methodology publication is not current: ${methodologyId}`);
    }
    return this.getPublicationBundle(projection.publicationId);
  }

  listPublications() {
    return [...this.publicationsById.values()].sort(
      (left, right) => left.publishedAt.localeCompare(right.publishedAt) || left.id.localeCompare(right.id),
    );
  }

  getAuthoritySnapshot(): CanopyProofMethodologyGovernanceAuthoritySnapshot {
    return {
      policies: this.listPolicies(),
      methodologies: [...this.streamsByMethodologyId.values()]
        .map((stream) => stream.methodology)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)),
      approvals: [...this.approvalsById.values()].sort(
        (left, right) =>
          left.methodologyId.localeCompare(right.methodologyId) ||
          left.methodologySequence - right.methodologySequence ||
          left.id.localeCompare(right.id),
      ),
      publications: this.listPublications(),
    };
  }

  private requireStream(methodologyId: string) {
    const stream = this.streamsByMethodologyId.get(methodologyId);
    if (!stream) throw new Error(`CanopyProof methodology governance stream not found: ${methodologyId}`);
    return stream;
  }
}

function factReplayOrder(factType: string) {
  return factType === "governed_policy_authority" ? 0 : factType === "methodology_publication_approval" ? 1 : 2;
}

function validateMethodologyVersion(methodology: CanopyProofMethodology) {
  if (methodology.status !== "draft" || methodology.publishedAt || methodology.governanceApprovalIds.length > 0) {
    throw new Error("CanopyProof methodology publication authority requires an unpublished technical draft without approval references.");
  }
  assertSafeText([
    methodology.id,
    methodology.slug,
    methodology.version,
    methodology.title,
    methodology.summary,
    ...methodology.limitations,
  ]);
  assertCanonicalValues(methodology.requiredDataSources, canonicalStringSet(methodology.requiredDataSources), "methodology data sources");
  assertCanonicalValues(methodology.qualityGates, canonicalStringSet(methodology.qualityGates), "methodology quality gates");
  assertCanonicalValues(
    methodology.governanceApprovalIds,
    canonicalStringSet(methodology.governanceApprovalIds),
    "compatibility methodology approval references",
  );
  assertCanonicalValues(methodology.limitations, canonicalStringSet(methodology.limitations), "methodology limitations");
  const requiredGates: readonly CanopyProofMethodologyQualityGate[] = [
    "human_review_required",
    "governance_approval_required",
    "public_challenge_window_required",
    "monitoring_timeline_required",
  ];
  const missing = requiredGates.find((gate) => !methodology.qualityGates.includes(gate));
  if (missing) throw new Error(`CanopyProof methodology publication omits required gate: ${missing}`);
  const unsupported = methodology.qualityGates.find((gate) => !canopyProofMethodologyQualityGates.includes(gate));
  if (unsupported) throw new Error(`CanopyProof methodology publication contains unsupported gate: ${unsupported}`);
  const qualityGateRoot = merkleRoot(
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
  if (qualityGateRoot !== methodology.qualityGateRoot) {
    throw new Error("CanopyProof methodology publication quality-gate root is invalid.");
  }
  const seed = {
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
  const methodologyHash = hashJson({ kind: "canopyproof-methodology-v1", methodology: seed });
  const payloadHash = hashJson({ ...seed, methodologyHash });
  if (methodology.methodologyHash !== methodologyHash || methodology.auditEvent.payloadHash !== payloadHash) {
    throw new Error("CanopyProof methodology publication technical-version lineage is invalid.");
  }
  assertAuditEvent(methodology.auditEvent, "methodology", methodology.id, methodology.createdBy);
}

function validateConstitutionalPolicy(
  subject: CanopyProofGovernedPolicySubject,
  requiredApprovals: number,
  roles: readonly CanopyProofGovernedPolicyReviewerRole[],
) {
  if (requiredApprovals < 2 || requiredApprovals > 32 || !roles.includes("verifier")) {
    throw new Error("CanopyProof governed policy cannot weaken the constitutional human quorum.");
  }
  const counterpartRoles =
    subject === "environmental_proof_record"
      ? ["owner", "admin"]
      : ["researcher", "owner", "admin"];
  if (!counterpartRoles.some((role) => roles.includes(role as CanopyProofGovernedPolicyReviewerRole))) {
    throw new Error("CanopyProof governed policy lacks the required independent human counterpart role.");
  }
}

function methodologyApprovalCommandHash(input: Readonly<{
  methodology: CanopyProofMethodology;
  policy: CanopyProofGovernedPolicyAuthority;
  prior?: CanopyProofMethodologyPublicationApproval;
  decision: CanopyProofMethodologyPublicationDecision;
  rationale: string;
  conflictDisclosure: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  approver: CanopyProofVerificationActorSnapshot;
  decidedAt: string;
}>) {
  return hashJson({
    kind: "canopyproof-methodology-publication-approval-command-v1",
    methodologyId: input.methodology.id,
    methodologyHash: input.methodology.methodologyHash,
    methodologyEventRoot: input.methodology.auditEvent.eventRoot,
    policyId: input.policy.id,
    policyRoot: input.policy.policyRoot,
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

function methodologyPublicationCommandHash(input: Readonly<{
  methodology: CanopyProofMethodology;
  policy: CanopyProofGovernedPolicyAuthority;
  approvalIds: readonly string[];
  approvalRoots: readonly string[];
  approvalQuorumRoot: string;
  publisher: CanopyProofVerificationActorSnapshot;
  rationale: string;
  limitations: readonly string[];
  sourceEventRoots: readonly string[];
  publishedAt: string;
}>) {
  return hashJson({
    kind: "canopyproof-methodology-publication-command-v1",
    methodologyId: input.methodology.id,
    methodologyHash: input.methodology.methodologyHash,
    methodologyQualityGateRoot: input.methodology.qualityGateRoot,
    methodologyEventRoot: input.methodology.auditEvent.eventRoot,
    policyId: input.policy.id,
    policyRoot: input.policy.policyRoot,
    approvalIds: input.approvalIds,
    approvalRoots: input.approvalRoots,
    approvalQuorumRoot: input.approvalQuorumRoot,
    publisher: input.publisher,
    rationale: input.rationale,
    limitations: input.limitations,
    sourceEventRoots: input.sourceEventRoots,
    publishedAt: input.publishedAt,
  });
}

function assertMethodologyApprovalQuorum(
  methodology: CanopyProofMethodology,
  policy: CanopyProofGovernedPolicyAuthority,
  approvals: readonly CanopyProofMethodologyPublicationApproval[],
) {
  if (
    approvals.length < policy.requiredApprovals ||
    approvals.some(
      (approval) =>
        approval.methodologyId !== methodology.id ||
        approval.methodologyHash !== methodology.methodologyHash ||
        approval.policyId !== policy.id ||
        approval.policyRoot !== policy.policyRoot ||
        approval.decision !== "approve",
    )
  ) {
    throw new Error("CanopyProof methodology publication approval quorum is incomplete, stale, or adverse.");
  }
  if (!approvals.some((approval) => approval.approver.role === "verifier")) {
    throw new Error("CanopyProof methodology publication quorum requires an accredited verifier.");
  }
  if (!approvals.some((approval) => ["researcher", "owner", "admin"].includes(approval.approver.role))) {
    throw new Error("CanopyProof methodology publication quorum requires an independent human counterpart.");
  }
}

function normalizeActor(input: unknown): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = normalizeUniqueStrings(parsed.accreditationScope, "actor accreditation scope");
  const seed = {
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
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...seed });
  if (parsed.authorityRoot && normalizeHash(parsed.authorityRoot) !== authorityRoot) {
    throw new Error("CanopyProof methodology governance actor authority root is invalid.");
  }
  return { ...seed, authorityRoot };
}

function assertHumanAuthority(
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
    throw new Error("CanopyProof methodology governance action requires exact active human organization authority.");
  }
}

function requireAccreditation(actor: CanopyProofVerificationActorSnapshot) {
  if (
    actor.role !== "verifier" ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    actor.accreditationScope.length === 0
  ) {
    throw new Error("CanopyProof methodology governance verifier requires current approved accreditation.");
  }
}

function assertAuditEvent(event: CanopyProofAuditEvent, entityType: string, entityId: string, actorId: string) {
  const eventRoot = hashJson({
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
    event.eventRoot !== eventRoot ||
    event.id !== `cp_audit_${eventRoot.slice(0, 24)}`
  ) {
    throw new Error(`CanopyProof methodology governance ${entityType} event is invalid.`);
  }
}

function requireKnownRoots(roots: readonly string[], knownRoots: ReadonlySet<string>, label: string) {
  const unknown = roots.find((root) => !knownRoots.has(root));
  if (unknown) throw new Error(`CanopyProof ${label} is missing or foreign: ${unknown}`);
}

function assertAfterEvents(events: readonly CanopyProofAuditEvent[], timestamp: string) {
  const terminal = events.at(-1);
  if (terminal && Date.parse(timestamp) < Date.parse(terminal.createdAt)) {
    throw new Error("CanopyProof methodology governance fact time must be monotonic.");
  }
}

function normalizeHash(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}

function normalizeUniqueHashes(values: readonly string[], label: string) {
  return normalizeUniqueStrings(values.map(normalizeHash), label);
}

function normalizeUniqueStrings(values: readonly string[], label: string) {
  const normalized = values.map((value) => value.trim()).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`CanopyProof ${label} values must be unique.`);
  }
  return normalized;
}

function canonicalStringSet(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function assertCanonicalValues(actual: readonly string[], expected: readonly string[], label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof ${label} must be sorted, normalized, and unique.`);
  }
}

function assertSafeText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) throw new Error(`CanopyProof methodology governance input contains unsafe claim or secret material: ${unsafe}`);
}

function methodologyGovernanceSafetyBoundary(): CanopyProofMethodologyGovernanceSafetyBoundary {
  return {
    immutableAuthority: true,
    exactHumanAuthority: true,
    independentQuorumRequired: true,
    aiIsNeverFinalAuthority: true,
    environmentalAccountabilityOnly: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}
