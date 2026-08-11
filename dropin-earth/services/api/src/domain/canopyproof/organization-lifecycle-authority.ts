import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  canopyProofOrganizationTrustLevels,
  canopyProofOrganizationVerificationStatuses,
  type CanopyProofOrganizationTrustLevel,
  type CanopyProofOrganizationVerificationStatus,
} from "./partner-collaboration.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofOrganizationLifecycleReasonCodes = [
  "registration_anchor",
  "documents_submitted",
  "verification_approved",
  "compliance_suspension",
  "legal_suspension",
  "fraud_revocation",
  "legal_revocation",
  "governance_revocation",
  "appeal_reinstatement",
] as const;
export const canopyProofOrganizationDocumentReviewDecisions = ["accepted", "rejected"] as const;
export const canopyProofOrganizationDocumentReviewReasonCodes = [
  "identity_documents_valid",
  "documents_insufficient",
  "registration_unconfirmed",
  "conflict_detected",
] as const;
export const canopyProofOrganizationAppealReasonCodes = [
  "procedural_error",
  "material_new_evidence",
  "mistaken_identity",
  "disproportionate_action",
] as const;
export const canopyProofOrganizationAppealRequestedRemedies = ["reinstatement", "procedural_remedy"] as const;
export const canopyProofOrganizationAppealDecisions = ["upheld", "denied", "needs_more_evidence"] as const;
export const canopyProofOrganizationAppealRemedies = ["none", "reinstate", "new_identity_required"] as const;

export const canopyProofOrganizationLifecycleScopes = {
  documentReview: "organization:lifecycle:review",
  verificationDecision: "organization:lifecycle:decide",
  governanceControl: "organization:lifecycle:govern",
  appealReview: "organization:appeal:review",
  appealResolution: "organization:appeal:resolve",
} as const;

export type CanopyProofOrganizationLifecycleReasonCode =
  (typeof canopyProofOrganizationLifecycleReasonCodes)[number];
export type CanopyProofOrganizationDocumentReviewDecision =
  (typeof canopyProofOrganizationDocumentReviewDecisions)[number];
export type CanopyProofOrganizationAppealDecision =
  (typeof canopyProofOrganizationAppealDecisions)[number];
export type CanopyProofOrganizationAppealRemedy =
  (typeof canopyProofOrganizationAppealRemedies)[number];

export type CanopyProofOrganizationLifecycleSafetyBoundary = Readonly<{
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  exactRetryRequired: true;
  currentAuthorityReResolutionRequired: true;
  independentHumanAuthorityRequired: true;
  aiIsNeverFinalAuthority: true;
  revocationTerminal: true;
  rawDocumentsForbidden: true;
  noMainnetFunds: true;
  notAutomaticCanopyDistribution: true;
  noPrivateKeyHandling: true;
  notCertifiedCarbonCredit: true;
  notCarbonTaxOffset: true;
  notFinancialAsset: true;
  notGuaranteedYield: true;
}>;

export type CanopyProofOrganizationLifecycleActorSnapshot = Readonly<{
  id: string;
  participantType: "human";
  role: "owner" | "admin" | "verifier" | "researcher";
  verificationStatus: "verified";
  organizationId: string;
  organizationVerificationStatus: CanopyProofOrganizationVerificationStatus;
  participantRoot: string;
  organizationRoot: string;
  membershipId: string;
  membershipStatus: "active";
  membershipRoot: string;
  accreditationId?: string;
  accreditationStatus?: "approved" | "pending" | "suspended" | "revoked";
  accreditationRoot?: string;
  accreditationScope: readonly string[];
  authorityRoot: string;
}>;

type OrganizationAuthorityFactCommon = Readonly<{
  id: string;
  organizationId: string;
  organizationSequence: number;
  previousEventRoot: string;
  commandHash: string;
  safety: CanopyProofOrganizationLifecycleSafetyBoundary;
  auditEvent: CanopyProofAuditEvent;
}>;

export type CanopyProofOrganizationLifecycleFact = OrganizationAuthorityFactCommon &
  Readonly<{
    factType: "organization_lifecycle";
    previousLifecycleFactId?: string;
    previousLifecycleRoot?: string;
    profileRoot: string;
    documentRoots: readonly string[];
    documentRoot: string;
    fromStatus: CanopyProofOrganizationVerificationStatus | null;
    toStatus: CanopyProofOrganizationVerificationStatus;
    trustLevel: CanopyProofOrganizationTrustLevel;
    reasonCode: CanopyProofOrganizationLifecycleReasonCode;
    rationale: string;
    sourceEventRoots: readonly string[];
    sourceRoot: string;
    acceptedReviewId?: string;
    acceptedReviewRoot?: string;
    appealDecisionId?: string;
    appealDecisionRoot?: string;
    actor: CanopyProofOrganizationLifecycleActorSnapshot;
    decidedAt: string;
    lifecycleHash: string;
    lifecycleRoot: string;
  }>;

export type CanopyProofOrganizationDocumentReviewFact = OrganizationAuthorityFactCommon &
  Readonly<{
    factType: "organization_document_review";
    lifecycleFactId: string;
    lifecycleRoot: string;
    profileRoot: string;
    registrationReferenceRoot: string | null;
    documentRoots: readonly string[];
    documentRoot: string;
    decision: CanopyProofOrganizationDocumentReviewDecision;
    reasonCode: (typeof canopyProofOrganizationDocumentReviewReasonCodes)[number];
    rationale: string;
    conflictDisclosure: string;
    sourceEventRoots: readonly string[];
    sourceRoot: string;
    reviewer: CanopyProofOrganizationLifecycleActorSnapshot;
    reviewedAt: string;
    reviewHash: string;
    reviewRoot: string;
  }>;

export type CanopyProofOrganizationAppealFact = OrganizationAuthorityFactCommon &
  Readonly<{
    factType: "organization_appeal";
    challengedLifecycleFactId: string;
    challengedLifecycleRoot: string;
    challengedStatus: "suspended" | "revoked";
    challengedActorId: string;
    profileRoot: string;
    reasonCode: (typeof canopyProofOrganizationAppealReasonCodes)[number];
    requestedRemedy: (typeof canopyProofOrganizationAppealRequestedRemedies)[number];
    grounds: string;
    evidenceEventRoots: readonly string[];
    evidenceRoot: string;
    submitter: CanopyProofOrganizationLifecycleActorSnapshot;
    submittedAt: string;
    appealHash: string;
    appealRoot: string;
  }>;

export type CanopyProofOrganizationAppealDecisionFact = OrganizationAuthorityFactCommon &
  Readonly<{
    factType: "organization_appeal_decision";
    appealId: string;
    appealRoot: string;
    challengedLifecycleRoot: string;
    challengedStatus: "suspended" | "revoked";
    priorDecisionId?: string;
    priorDecisionRoot?: string;
    appealDecisionSequence: number;
    decision: CanopyProofOrganizationAppealDecision;
    remedy: CanopyProofOrganizationAppealRemedy;
    rationale: string;
    conflictDisclosure: string;
    sourceEventRoots: readonly string[];
    sourceRoot: string;
    reviewer: CanopyProofOrganizationLifecycleActorSnapshot;
    decidedAt: string;
    decisionHash: string;
    decisionRoot: string;
  }>;

export type CanopyProofOrganizationAuthorityFact =
  | CanopyProofOrganizationLifecycleFact
  | CanopyProofOrganizationDocumentReviewFact
  | CanopyProofOrganizationAppealFact
  | CanopyProofOrganizationAppealDecisionFact;

export type CanopyProofOrganizationLifecycleProjection = Readonly<{
  organizationId: string;
  currentStatus: CanopyProofOrganizationVerificationStatus;
  currentTrustLevel: CanopyProofOrganizationTrustLevel;
  latestLifecycleFactId: string;
  latestLifecycleRoot: string;
  latestProfileRoot: string;
  latestDocumentRoot: string;
  openAppealIds: readonly string[];
  terminalRevocation: boolean;
  latestOrganizationSequence: number;
  latestEventRoot: string;
  projectionRoot: string;
  safety: CanopyProofOrganizationLifecycleSafetyBoundary;
}>;

export type CanopyProofOrganizationLifecycleAuthoritySnapshot = Readonly<{
  lifecycleFacts: readonly CanopyProofOrganizationLifecycleFact[];
  documentReviewFacts: readonly CanopyProofOrganizationDocumentReviewFact[];
  appealFacts: readonly CanopyProofOrganizationAppealFact[];
  appealDecisionFacts: readonly CanopyProofOrganizationAppealDecisionFact[];
}>;

type OrganizationAuthorityStream = {
  readonly organizationId: string;
  readonly events: CanopyProofAuditEvent[];
  readonly lifecycleFacts: CanopyProofOrganizationLifecycleFact[];
  readonly documentReviews: CanopyProofOrganizationDocumentReviewFact[];
  readonly appeals: CanopyProofOrganizationAppealFact[];
  readonly appealDecisions: CanopyProofOrganizationAppealDecisionFact[];
};

const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const rationaleSchema = z.string().trim().min(24).max(4_000);
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(["owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.enum(canopyProofOrganizationVerificationStatuses),
    participantRoot: rootSchema,
    organizationRoot: rootSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: rootSchema,
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: rootSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(32),
    authorityRoot: rootSchema,
  })
  .strict();

const anchorInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    profileRoot: rootSchema,
    documentRoots: z.array(rootSchema).max(128).default([]),
    rationale: rationaleSchema,
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    anchoredAt: timestampSchema,
  })
  .strict();

const transitionInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    profileRoot: rootSchema,
    documentRoots: z.array(rootSchema).max(128),
    toStatus: z.enum(canopyProofOrganizationVerificationStatuses),
    trustLevel: z.enum(canopyProofOrganizationTrustLevels).optional(),
    reasonCode: z.enum(canopyProofOrganizationLifecycleReasonCodes),
    rationale: rationaleSchema,
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    acceptedReviewId: identifierSchema.optional(),
    appealDecisionId: identifierSchema.optional(),
    decidedAt: timestampSchema,
  })
  .strict();

const documentReviewInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    profileRoot: rootSchema,
    registrationReferenceRoot: rootSchema.nullable(),
    documentRoots: z.array(rootSchema).min(1).max(128),
    decision: z.enum(canopyProofOrganizationDocumentReviewDecisions),
    reasonCode: z.enum(canopyProofOrganizationDocumentReviewReasonCodes),
    rationale: rationaleSchema,
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    reviewedAt: timestampSchema,
  })
  .strict();

const appealInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    challengedLifecycleFactId: identifierSchema,
    reasonCode: z.enum(canopyProofOrganizationAppealReasonCodes),
    requestedRemedy: z.enum(canopyProofOrganizationAppealRequestedRemedies),
    grounds: rationaleSchema,
    evidenceEventRoots: z.array(rootSchema).min(1).max(128),
    submittedAt: timestampSchema,
  })
  .strict();

const appealDecisionInputSchema = z
  .object({
    id: identifierSchema.optional(),
    organizationId: identifierSchema,
    appealId: identifierSchema,
    decision: z.enum(canopyProofOrganizationAppealDecisions),
    remedy: z.enum(canopyProofOrganizationAppealRemedies),
    rationale: rationaleSchema,
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    decidedAt: timestampSchema,
  })
  .strict();

const safetySchema = z
  .object({
    routeMounted: z.literal(false),
    schedulerMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    appendOnly: z.literal(true),
    exactRetryRequired: z.literal(true),
    currentAuthorityReResolutionRequired: z.literal(true),
    independentHumanAuthorityRequired: z.literal(true),
    aiIsNeverFinalAuthority: z.literal(true),
    revocationTerminal: z.literal(true),
    rawDocumentsForbidden: z.literal(true),
    noMainnetFunds: z.literal(true),
    notAutomaticCanopyDistribution: z.literal(true),
    noPrivateKeyHandling: z.literal(true),
    notCertifiedCarbonCredit: z.literal(true),
    notCarbonTaxOffset: z.literal(true),
    notFinancialAsset: z.literal(true),
    notGuaranteedYield: z.literal(true),
  })
  .strict();

const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
    actor: identifierSchema,
    entityType: z.enum([
      "organization_lifecycle",
      "organization_document_review",
      "organization_appeal",
      "organization_appeal_decision",
    ]),
    entityId: identifierSchema,
    previousRoot: rootSchema,
    payloadHash: rootSchema,
    eventRoot: rootSchema,
    createdAt: timestampSchema,
    rationale: z.string().trim().min(1).max(4_000),
  })
  .strict();

const factCommonSchema = {
  id: identifierSchema,
  organizationId: identifierSchema,
  organizationSequence: z.number().int().positive(),
  previousEventRoot: rootSchema,
  commandHash: rootSchema,
  safety: safetySchema,
  auditEvent: auditEventSchema,
} as const;

const lifecycleFactSchema = z
  .object({
    factType: z.literal("organization_lifecycle"),
    ...factCommonSchema,
    previousLifecycleFactId: identifierSchema.optional(),
    previousLifecycleRoot: rootSchema.optional(),
    profileRoot: rootSchema,
    documentRoots: z.array(rootSchema).max(128),
    documentRoot: rootSchema,
    fromStatus: z.enum(canopyProofOrganizationVerificationStatuses).nullable(),
    toStatus: z.enum(canopyProofOrganizationVerificationStatuses),
    trustLevel: z.enum(canopyProofOrganizationTrustLevels),
    reasonCode: z.enum(canopyProofOrganizationLifecycleReasonCodes),
    rationale: rationaleSchema,
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    sourceRoot: rootSchema,
    acceptedReviewId: identifierSchema.optional(),
    acceptedReviewRoot: rootSchema.optional(),
    appealDecisionId: identifierSchema.optional(),
    appealDecisionRoot: rootSchema.optional(),
    actor: actorSchema,
    decidedAt: timestampSchema,
    lifecycleHash: rootSchema,
    lifecycleRoot: rootSchema,
  })
  .strict();

const documentReviewFactSchema = z
  .object({
    factType: z.literal("organization_document_review"),
    ...factCommonSchema,
    lifecycleFactId: identifierSchema,
    lifecycleRoot: rootSchema,
    profileRoot: rootSchema,
    registrationReferenceRoot: rootSchema.nullable(),
    documentRoots: z.array(rootSchema).min(1).max(128),
    documentRoot: rootSchema,
    decision: z.enum(canopyProofOrganizationDocumentReviewDecisions),
    reasonCode: z.enum(canopyProofOrganizationDocumentReviewReasonCodes),
    rationale: rationaleSchema,
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    sourceRoot: rootSchema,
    reviewer: actorSchema,
    reviewedAt: timestampSchema,
    reviewHash: rootSchema,
    reviewRoot: rootSchema,
  })
  .strict();

const appealFactSchema = z
  .object({
    factType: z.literal("organization_appeal"),
    ...factCommonSchema,
    challengedLifecycleFactId: identifierSchema,
    challengedLifecycleRoot: rootSchema,
    challengedStatus: z.enum(["suspended", "revoked"]),
    challengedActorId: identifierSchema,
    profileRoot: rootSchema,
    reasonCode: z.enum(canopyProofOrganizationAppealReasonCodes),
    requestedRemedy: z.enum(canopyProofOrganizationAppealRequestedRemedies),
    grounds: rationaleSchema,
    evidenceEventRoots: z.array(rootSchema).min(1).max(128),
    evidenceRoot: rootSchema,
    submitter: actorSchema,
    submittedAt: timestampSchema,
    appealHash: rootSchema,
    appealRoot: rootSchema,
  })
  .strict();

const appealDecisionFactSchema = z
  .object({
    factType: z.literal("organization_appeal_decision"),
    ...factCommonSchema,
    appealId: identifierSchema,
    appealRoot: rootSchema,
    challengedLifecycleRoot: rootSchema,
    challengedStatus: z.enum(["suspended", "revoked"]),
    priorDecisionId: identifierSchema.optional(),
    priorDecisionRoot: rootSchema.optional(),
    appealDecisionSequence: z.number().int().positive(),
    decision: z.enum(canopyProofOrganizationAppealDecisions),
    remedy: z.enum(canopyProofOrganizationAppealRemedies),
    rationale: rationaleSchema,
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    sourceEventRoots: z.array(rootSchema).min(1).max(128),
    sourceRoot: rootSchema,
    reviewer: actorSchema,
    decidedAt: timestampSchema,
    decisionHash: rootSchema,
    decisionRoot: rootSchema,
  })
  .strict();

export class CanopyProofOrganizationLifecycleAuthorityService {
  private readonly streamsByOrganizationId = new Map<string, OrganizationAuthorityStream>();
  private readonly factsById = new Map<string, CanopyProofOrganizationAuthorityFact>();

  static fromAuthoritySnapshot(snapshotInput: CanopyProofOrganizationLifecycleAuthoritySnapshot) {
    const snapshot = parseAuthoritySnapshot(snapshotInput);
    const service = new CanopyProofOrganizationLifecycleAuthorityService();
    const facts: CanopyProofOrganizationAuthorityFact[] = [
      ...snapshot.lifecycleFacts,
      ...snapshot.documentReviewFacts,
      ...snapshot.appealFacts,
      ...snapshot.appealDecisionFacts,
    ].sort(
      (left, right) =>
        left.organizationId.localeCompare(right.organizationId) ||
        left.organizationSequence - right.organizationSequence ||
        left.id.localeCompare(right.id),
    );
    const uniqueIds = new Set(facts.map((fact) => fact.id));
    if (uniqueIds.size !== facts.length) {
      throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_FACT_ID_DUPLICATE");
    }
    for (const fact of facts) {
      const replayed = replayFact(service, fact);
      if (hashJson(replayed) !== hashJson(fact)) {
        throw new Error(`CANOPYPROOF_ORGANIZATION_AUTHORITY_REPLAY_MISMATCH:${fact.id}`);
      }
    }
    for (const stream of service.streamsByOrganizationId.values()) {
      assertStreamIntegrity(stream);
    }
    return service;
  }

  anchorOrganization(input: unknown, actorInput: unknown): CanopyProofOrganizationLifecycleFact {
    const parsed = anchorInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    const anchoredAt = canonicalTimestamp(parsed.anchoredAt, "ANCHORED_AT");
    const documentRoots = normalizeRoots(parsed.documentRoots, "DOCUMENT_ROOT");
    const sourceEventRoots = normalizeRoots(parsed.sourceEventRoots, "SOURCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    requireSubjectActor(actor, parsed.organizationId, "pending");
    if (actor.organizationRoot !== parsed.profileRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_PROFILE_ROOT_CURRENT_AUTHORITY_MISMATCH");
    }
    if (this.streamsByOrganizationId.has(parsed.organizationId)) {
      throw new Error(`CANOPYPROOF_ORGANIZATION_LIFECYCLE_ALREADY_ANCHORED:${parsed.organizationId}`);
    }
    const documentRoot = merkleRoot(documentRoots);
    const sourceRoot = merkleRoot([...sourceEventRoots, parsed.profileRoot, documentRoot].sort());
    const commandHash = hashJson({
      kind: "canopyproof-organization-lifecycle-command-v1",
      organizationId: parsed.organizationId,
      profileRoot: parsed.profileRoot,
      documentRoots,
      fromStatus: null,
      toStatus: "pending",
      trustLevel: "unverified",
      reasonCode: "registration_anchor",
      rationale: parsed.rationale,
      sourceEventRoots,
      actor,
      decidedAt: anchoredAt,
    });
    const id = `cp_org_lifecycle_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "LIFECYCLE");
    const stream = createStream(parsed.organizationId);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      profileRoot: parsed.profileRoot,
      documentRoots,
      documentRoot,
      fromStatus: null,
      toStatus: "pending" as const,
      trustLevel: "unverified" as const,
      reasonCode: "registration_anchor" as const,
      rationale: parsed.rationale,
      sourceEventRoots,
      sourceRoot,
      actor,
      decidedAt: anchoredAt,
    };
    const lifecycleHash = hashJson({ kind: "canopyproof-organization-lifecycle-fact-v1", id, ...seed });
    const lifecycleRoot = lifecycleFactRoot(parsed.organizationId, lifecycleHash, common);
    const safety = organizationLifecycleSafetyBoundary();
    const payload = { factType: "organization_lifecycle" as const, id, ...seed, lifecycleHash, lifecycleRoot, safety };
    const auditEvent = appendAuthorityEvent(stream, {
      action: "ASSERT",
      actorId: actor.id,
      entityType: "organization_lifecycle",
      entityId: id,
      payload,
      createdAt: anchoredAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationLifecycleFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    this.streamsByOrganizationId.set(parsed.organizationId, stream);
    return fact;
  }

  transitionOrganization(input: unknown, actorInput: unknown): CanopyProofOrganizationLifecycleFact {
    const parsed = transitionInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    const decidedAt = canonicalTimestamp(parsed.decidedAt, "DECIDED_AT");
    const documentRoots = normalizeRoots(parsed.documentRoots, "DOCUMENT_ROOT");
    const sourceEventRoots = normalizeRoots(parsed.sourceEventRoots, "SOURCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    const stream = this.requireStream(parsed.organizationId);
    const current = requireLatestLifecycle(stream);
    if (current.toStatus === "revoked") {
      throw new Error("CANOPYPROOF_ORGANIZATION_REVOKED_IDENTITY_TERMINAL");
    }
    if (parsed.profileRoot !== current.profileRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_PROFILE_ROOT_CHANGED_WITHOUT_NEW_IDENTITY");
    }
    if (Date.parse(decidedAt) <= Date.parse(stream.events.at(-1)?.createdAt ?? "")) {
      throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_TIME_NOT_MONOTONIC");
    }
    const transition = authorizeTransition({
      stream,
      current,
      parsed,
      actor,
      documentRoots,
      decidedAt,
    });
    const documentRoot = merkleRoot(documentRoots);
    const sourceRoot = merkleRoot(
      [
        ...sourceEventRoots,
        parsed.profileRoot,
        documentRoot,
        current.lifecycleRoot,
        ...(transition.acceptedReview ? [transition.acceptedReview.reviewRoot] : []),
        ...(transition.appealDecision ? [transition.appealDecision.decisionRoot] : []),
      ].sort(),
    );
    const commandHash = hashJson({
      kind: "canopyproof-organization-lifecycle-command-v1",
      organizationId: parsed.organizationId,
      previousLifecycleRoot: current.lifecycleRoot,
      profileRoot: parsed.profileRoot,
      documentRoots,
      fromStatus: current.toStatus,
      toStatus: parsed.toStatus,
      trustLevel: transition.trustLevel,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      sourceEventRoots,
      acceptedReviewRoot: transition.acceptedReview?.reviewRoot ?? null,
      appealDecisionRoot: transition.appealDecision?.decisionRoot ?? null,
      actor,
      decidedAt,
    });
    const id = `cp_org_lifecycle_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "LIFECYCLE");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      previousLifecycleFactId: current.id,
      previousLifecycleRoot: current.lifecycleRoot,
      profileRoot: parsed.profileRoot,
      documentRoots,
      documentRoot,
      fromStatus: current.toStatus,
      toStatus: parsed.toStatus,
      trustLevel: transition.trustLevel,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      sourceEventRoots,
      sourceRoot,
      ...(transition.acceptedReview
        ? { acceptedReviewId: transition.acceptedReview.id, acceptedReviewRoot: transition.acceptedReview.reviewRoot }
        : {}),
      ...(transition.appealDecision
        ? { appealDecisionId: transition.appealDecision.id, appealDecisionRoot: transition.appealDecision.decisionRoot }
        : {}),
      actor,
      decidedAt,
    };
    const lifecycleHash = hashJson({ kind: "canopyproof-organization-lifecycle-fact-v1", id, ...seed });
    const lifecycleRoot = lifecycleFactRoot(parsed.organizationId, lifecycleHash, common);
    const safety = organizationLifecycleSafetyBoundary();
    const payload = { factType: "organization_lifecycle" as const, id, ...seed, lifecycleHash, lifecycleRoot, safety };
    const auditEvent = appendAuthorityEvent(stream, {
      action: parsed.toStatus === "verified" ? "FULFILL" : parsed.toStatus === "suspended" || parsed.toStatus === "revoked" ? "CHALLENGE" : "ASSERT",
      actorId: actor.id,
      entityType: "organization_lifecycle",
      entityId: id,
      payload,
      createdAt: decidedAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationLifecycleFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  reviewDocuments(input: unknown, reviewerInput: unknown): CanopyProofOrganizationDocumentReviewFact {
    const parsed = documentReviewInputSchema.parse(input);
    const reviewer = normalizeActor(reviewerInput);
    const reviewedAt = canonicalTimestamp(parsed.reviewedAt, "REVIEWED_AT");
    const documentRoots = normalizeRoots(parsed.documentRoots, "DOCUMENT_ROOT");
    const sourceEventRoots = normalizeRoots(parsed.sourceEventRoots, "SOURCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    assertSafeText(parsed.conflictDisclosure);
    const stream = this.requireStream(parsed.organizationId);
    const current = requireLatestLifecycle(stream);
    if (current.toStatus !== "document_review") {
      throw new Error("CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_STATE_REQUIRED");
    }
    if (parsed.profileRoot !== current.profileRoot || hashJson(documentRoots) !== hashJson(current.documentRoots)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_SOURCE_STALE");
    }
    const reviewSemanticsValid =
      (parsed.decision === "accepted" &&
        parsed.reasonCode === "identity_documents_valid" &&
        parsed.registrationReferenceRoot !== null) ||
      (parsed.decision === "rejected" && parsed.reasonCode !== "identity_documents_valid");
    if (!reviewSemanticsValid) {
      throw new Error("CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_REGISTRATION_INVALID");
    }
    if (Date.parse(reviewedAt) <= Date.parse(stream.events.at(-1)?.createdAt ?? "")) {
      throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_TIME_NOT_MONOTONIC");
    }
    requireGovernanceActor(
      reviewer,
      parsed.organizationId,
      canopyProofOrganizationLifecycleScopes.documentReview,
      ["admin", "verifier", "researcher"],
    );
    const latestReview = stream.documentReviews.at(-1);
    if (latestReview?.decision === "accepted") {
      throw new Error("CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_ALREADY_ACCEPTED");
    }
    if (reviewer.id === current.actor.id) {
      throw new Error("CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_SELF_REVIEW_DENIED");
    }
    const documentRoot = merkleRoot(documentRoots);
    const sourceRoot = merkleRoot(
      [
        ...sourceEventRoots,
        current.lifecycleRoot,
        parsed.profileRoot,
        documentRoot,
        ...(parsed.registrationReferenceRoot ? [parsed.registrationReferenceRoot] : []),
        ...(latestReview ? [latestReview.reviewRoot] : []),
      ].sort(),
    );
    const commandHash = hashJson({
      kind: "canopyproof-organization-document-review-command-v1",
      organizationId: parsed.organizationId,
      lifecycleRoot: current.lifecycleRoot,
      profileRoot: parsed.profileRoot,
      registrationReferenceRoot: parsed.registrationReferenceRoot,
      documentRoots,
      decision: parsed.decision,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceEventRoots,
      reviewer,
      reviewedAt,
    });
    const id = `cp_org_document_review_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "DOCUMENT_REVIEW");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      lifecycleFactId: current.id,
      lifecycleRoot: current.lifecycleRoot,
      profileRoot: parsed.profileRoot,
      registrationReferenceRoot: parsed.registrationReferenceRoot,
      documentRoots,
      documentRoot,
      decision: parsed.decision,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceEventRoots,
      sourceRoot,
      reviewer,
      reviewedAt,
    };
    const reviewHash = hashJson({ kind: "canopyproof-organization-document-review-fact-v1", id, ...seed });
    const reviewRoot = authorityFactRoot("document-review", parsed.organizationId, reviewHash, common);
    const safety = organizationLifecycleSafetyBoundary();
    const payload = { factType: "organization_document_review" as const, id, ...seed, reviewHash, reviewRoot, safety };
    const auditEvent = appendAuthorityEvent(stream, {
      action: parsed.decision === "accepted" ? "REASON" : "CHALLENGE",
      actorId: reviewer.id,
      entityType: "organization_document_review",
      entityId: id,
      payload,
      createdAt: reviewedAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationDocumentReviewFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  openAppeal(input: unknown, submitterInput: unknown): CanopyProofOrganizationAppealFact {
    const parsed = appealInputSchema.parse(input);
    const submitter = normalizeActor(submitterInput);
    const submittedAt = canonicalTimestamp(parsed.submittedAt, "SUBMITTED_AT");
    const evidenceEventRoots = normalizeRoots(parsed.evidenceEventRoots, "EVIDENCE_EVENT_ROOT");
    assertSafeText(parsed.grounds);
    const stream = this.requireStream(parsed.organizationId);
    const challenged = requireLatestLifecycle(stream);
    if (challenged.id !== parsed.challengedLifecycleFactId || !isAdverseStatus(challenged.toStatus)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_LATEST_ADVERSE_FACT_REQUIRED");
    }
    requireSubjectActor(submitter, parsed.organizationId, challenged.toStatus);
    if (submitter.organizationRoot !== challenged.profileRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_PROFILE_AUTHORITY_STALE");
    }
    if (
      (challenged.toStatus === "suspended" && parsed.requestedRemedy !== "reinstatement") ||
      (challenged.toStatus === "revoked" && parsed.requestedRemedy !== "procedural_remedy")
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_REMEDY_INVALID_FOR_STATUS");
    }
    if (stream.appeals.some((appeal) => appeal.challengedLifecycleRoot === challenged.lifecycleRoot)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_ALREADY_EXISTS");
    }
    if (Date.parse(submittedAt) <= Date.parse(stream.events.at(-1)?.createdAt ?? "")) {
      throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_TIME_NOT_MONOTONIC");
    }
    const evidenceRoot = merkleRoot([...evidenceEventRoots, challenged.lifecycleRoot].sort());
    const commandHash = hashJson({
      kind: "canopyproof-organization-appeal-command-v1",
      organizationId: parsed.organizationId,
      challengedLifecycleRoot: challenged.lifecycleRoot,
      reasonCode: parsed.reasonCode,
      requestedRemedy: parsed.requestedRemedy,
      grounds: parsed.grounds,
      evidenceEventRoots,
      submitter,
      submittedAt,
    });
    const id = `cp_org_appeal_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "APPEAL");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      challengedLifecycleFactId: challenged.id,
      challengedLifecycleRoot: challenged.lifecycleRoot,
      challengedStatus: challenged.toStatus,
      challengedActorId: challenged.actor.id,
      profileRoot: challenged.profileRoot,
      reasonCode: parsed.reasonCode,
      requestedRemedy: parsed.requestedRemedy,
      grounds: parsed.grounds,
      evidenceEventRoots,
      evidenceRoot,
      submitter,
      submittedAt,
    };
    const appealHash = hashJson({ kind: "canopyproof-organization-appeal-fact-v1", id, ...seed });
    const appealRoot = authorityFactRoot("appeal", parsed.organizationId, appealHash, common);
    const safety = organizationLifecycleSafetyBoundary();
    const payload = { factType: "organization_appeal" as const, id, ...seed, appealHash, appealRoot, safety };
    const auditEvent = appendAuthorityEvent(stream, {
      action: "CHALLENGE",
      actorId: submitter.id,
      entityType: "organization_appeal",
      entityId: id,
      payload,
      createdAt: submittedAt,
      rationale: parsed.grounds,
    });
    const fact: CanopyProofOrganizationAppealFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  decideAppeal(input: unknown, reviewerInput: unknown): CanopyProofOrganizationAppealDecisionFact {
    const parsed = appealDecisionInputSchema.parse(input);
    const reviewer = normalizeActor(reviewerInput);
    const decidedAt = canonicalTimestamp(parsed.decidedAt, "APPEAL_DECIDED_AT");
    const sourceEventRoots = normalizeRoots(parsed.sourceEventRoots, "SOURCE_EVENT_ROOT");
    assertSafeText(parsed.rationale);
    assertSafeText(parsed.conflictDisclosure);
    const stream = this.requireStream(parsed.organizationId);
    const appeal = this.requireAppeal(parsed.appealId);
    if (appeal.organizationId !== parsed.organizationId) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_ORGANIZATION_MISMATCH");
    }
    const current = requireLatestLifecycle(stream);
    if (current.lifecycleRoot !== appeal.challengedLifecycleRoot || current.toStatus !== appeal.challengedStatus) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_CHALLENGED_STATE_NOT_CURRENT");
    }
    const priorDecisions = stream.appealDecisions.filter((decision) => decision.appealId === appeal.id);
    const prior = priorDecisions.at(-1);
    if (prior && prior.decision !== "needs_more_evidence") {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_ALREADY_FINAL");
    }
    if (Date.parse(decidedAt) <= Date.parse(stream.events.at(-1)?.createdAt ?? "")) {
      throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_TIME_NOT_MONOTONIC");
    }
    const requiredScope =
      parsed.decision === "needs_more_evidence"
        ? canopyProofOrganizationLifecycleScopes.appealReview
        : canopyProofOrganizationLifecycleScopes.appealResolution;
    requireGovernanceActor(reviewer, parsed.organizationId, requiredScope, ["admin", "verifier", "researcher"]);
    if (
      reviewer.id === appeal.submitter.id ||
      reviewer.id === appeal.challengedActorId ||
      reviewer.id === prior?.reviewer.id
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_SEPARATION_OF_DUTIES_REQUIRED");
    }
    assertAppealDecisionRemedy(appeal.challengedStatus, parsed.decision, parsed.remedy);
    const appealDecisionSequence = (prior?.appealDecisionSequence ?? 0) + 1;
    const sourceRoot = merkleRoot(
      [...sourceEventRoots, appeal.appealRoot, ...(prior ? [prior.decisionRoot] : [])].sort(),
    );
    const commandHash = hashJson({
      kind: "canopyproof-organization-appeal-decision-command-v1",
      organizationId: parsed.organizationId,
      appealRoot: appeal.appealRoot,
      priorDecisionRoot: prior?.decisionRoot ?? null,
      appealDecisionSequence,
      decision: parsed.decision,
      remedy: parsed.remedy,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceEventRoots,
      reviewer,
      decidedAt,
    });
    const id = `cp_org_appeal_decision_${commandHash.slice(0, 24)}`;
    assertCanonicalId(parsed.id, id, "APPEAL_DECISION");
    assertNewFactId(this.factsById, id);
    const common = nextFactCommon(stream, commandHash);
    const seed = {
      ...common,
      appealId: appeal.id,
      appealRoot: appeal.appealRoot,
      challengedLifecycleRoot: appeal.challengedLifecycleRoot,
      challengedStatus: appeal.challengedStatus,
      ...(prior ? { priorDecisionId: prior.id, priorDecisionRoot: prior.decisionRoot } : {}),
      appealDecisionSequence,
      decision: parsed.decision,
      remedy: parsed.remedy,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceEventRoots,
      sourceRoot,
      reviewer,
      decidedAt,
    };
    const decisionHash = hashJson({ kind: "canopyproof-organization-appeal-decision-fact-v1", id, ...seed });
    const decisionRoot = authorityFactRoot("appeal-decision", parsed.organizationId, decisionHash, common);
    const safety = organizationLifecycleSafetyBoundary();
    const payload = {
      factType: "organization_appeal_decision" as const,
      id,
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
    };
    const auditEvent = appendAuthorityEvent(stream, {
      action: parsed.decision === "upheld" ? "FULFILL" : parsed.decision === "denied" ? "CHALLENGE" : "REASON",
      actorId: reviewer.id,
      entityType: "organization_appeal_decision",
      entityId: id,
      payload,
      createdAt: decidedAt,
      rationale: parsed.rationale,
    });
    const fact: CanopyProofOrganizationAppealDecisionFact = { ...payload, auditEvent };
    commitFact(stream, fact, this.factsById);
    return fact;
  }

  getLifecycleFact(factId: string) {
    const fact = this.factsById.get(factId);
    if (!fact || fact.factType !== "organization_lifecycle") {
      throw new Error(`CANOPYPROOF_ORGANIZATION_LIFECYCLE_FACT_NOT_FOUND:${factId}`);
    }
    return fact;
  }

  getDocumentReview(reviewId: string) {
    const fact = this.factsById.get(reviewId);
    if (!fact || fact.factType !== "organization_document_review") {
      throw new Error(`CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_NOT_FOUND:${reviewId}`);
    }
    return fact;
  }

  getAppeal(appealId: string) {
    return this.requireAppeal(appealId);
  }

  getAppealDecision(decisionId: string) {
    const fact = this.factsById.get(decisionId);
    if (!fact || fact.factType !== "organization_appeal_decision") {
      throw new Error(`CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_NOT_FOUND:${decisionId}`);
    }
    return fact;
  }

  getProjection(organizationId: string): CanopyProofOrganizationLifecycleProjection {
    const stream = this.requireStream(organizationId);
    assertStreamIntegrity(stream);
    const current = requireLatestLifecycle(stream);
    const openAppealIds = stream.appeals
      .filter((appeal) => {
        const latest = stream.appealDecisions.filter((decision) => decision.appealId === appeal.id).at(-1);
        return !latest || latest.decision === "needs_more_evidence";
      })
      .map((appeal) => appeal.id)
      .sort();
    const safety = organizationLifecycleSafetyBoundary();
    const seed = {
      organizationId,
      currentStatus: current.toStatus,
      currentTrustLevel: current.trustLevel,
      latestLifecycleFactId: current.id,
      latestLifecycleRoot: current.lifecycleRoot,
      latestProfileRoot: current.profileRoot,
      latestDocumentRoot: current.documentRoot,
      openAppealIds,
      terminalRevocation: current.toStatus === "revoked",
      latestOrganizationSequence: stream.events.length,
      latestEventRoot: stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
      safety,
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-organization-lifecycle-projection-v1", ...seed }),
    };
  }

  getAuthoritySnapshot(): CanopyProofOrganizationLifecycleAuthoritySnapshot {
    const streams = [...this.streamsByOrganizationId.values()].sort((left, right) =>
      left.organizationId.localeCompare(right.organizationId),
    );
    for (const stream of streams) assertStreamIntegrity(stream);
    return {
      lifecycleFacts: streams.flatMap((stream) => stream.lifecycleFacts),
      documentReviewFacts: streams.flatMap((stream) => stream.documentReviews),
      appealFacts: streams.flatMap((stream) => stream.appeals),
      appealDecisionFacts: streams.flatMap((stream) => stream.appealDecisions),
    };
  }

  private requireStream(organizationId: string) {
    const stream = this.streamsByOrganizationId.get(organizationId);
    if (!stream) throw new Error(`CANOPYPROOF_ORGANIZATION_LIFECYCLE_NOT_ANCHORED:${organizationId}`);
    return stream;
  }

  private requireAppeal(appealId: string) {
    const fact = this.factsById.get(appealId);
    if (!fact || fact.factType !== "organization_appeal") {
      throw new Error(`CANOPYPROOF_ORGANIZATION_APPEAL_NOT_FOUND:${appealId}`);
    }
    return fact;
  }
}

export function organizationLifecycleSafetyBoundary(): CanopyProofOrganizationLifecycleSafetyBoundary {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    appendOnly: true,
    exactRetryRequired: true,
    currentAuthorityReResolutionRequired: true,
    independentHumanAuthorityRequired: true,
    aiIsNeverFinalAuthority: true,
    revocationTerminal: true,
    rawDocumentsForbidden: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
    noPrivateKeyHandling: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
  };
}

export function organizationRegistrationReferenceRoot(organizationIdInput: string, registrationNumberInput: string) {
  const organizationId = identifierSchema.parse(organizationIdInput);
  const registrationNumber = z.string().trim().min(2).max(240).parse(registrationNumberInput);
  return hashJson({
    kind: "canopyproof-organization-registration-reference-v1",
    organizationId,
    registrationNumber,
  });
}

export function parseCanopyProofOrganizationLifecycleFact(input: unknown): CanopyProofOrganizationLifecycleFact {
  return lifecycleFactSchema.parse(input) as CanopyProofOrganizationLifecycleFact;
}

export function parseCanopyProofOrganizationDocumentReviewFact(
  input: unknown,
): CanopyProofOrganizationDocumentReviewFact {
  return documentReviewFactSchema.parse(input) as CanopyProofOrganizationDocumentReviewFact;
}

export function parseCanopyProofOrganizationAppealFact(input: unknown): CanopyProofOrganizationAppealFact {
  return appealFactSchema.parse(input) as CanopyProofOrganizationAppealFact;
}

export function parseCanopyProofOrganizationAppealDecisionFact(
  input: unknown,
): CanopyProofOrganizationAppealDecisionFact {
  return appealDecisionFactSchema.parse(input) as CanopyProofOrganizationAppealDecisionFact;
}

export function verifyCanopyProofOrganizationLifecycleAuthoritySnapshot(
  snapshot: CanopyProofOrganizationLifecycleAuthoritySnapshot,
) {
  return CanopyProofOrganizationLifecycleAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
}

function parseAuthoritySnapshot(input: CanopyProofOrganizationLifecycleAuthoritySnapshot) {
  return {
    lifecycleFacts: input.lifecycleFacts.map(parseCanopyProofOrganizationLifecycleFact),
    documentReviewFacts: input.documentReviewFacts.map(parseCanopyProofOrganizationDocumentReviewFact),
    appealFacts: input.appealFacts.map(parseCanopyProofOrganizationAppealFact),
    appealDecisionFacts: input.appealDecisionFacts.map(parseCanopyProofOrganizationAppealDecisionFact),
  };
}

function replayFact(
  service: CanopyProofOrganizationLifecycleAuthorityService,
  fact: CanopyProofOrganizationAuthorityFact,
) {
  if (fact.factType === "organization_lifecycle") {
    if (fact.fromStatus === null) {
      return service.anchorOrganization(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          profileRoot: fact.profileRoot,
          documentRoots: fact.documentRoots,
          rationale: fact.rationale,
          sourceEventRoots: fact.sourceEventRoots,
          anchoredAt: fact.decidedAt,
        },
        fact.actor,
      );
    }
    return service.transitionOrganization(
      {
        id: fact.id,
        organizationId: fact.organizationId,
        profileRoot: fact.profileRoot,
        documentRoots: fact.documentRoots,
        toStatus: fact.toStatus,
        trustLevel: fact.trustLevel,
        reasonCode: fact.reasonCode,
        rationale: fact.rationale,
        sourceEventRoots: fact.sourceEventRoots,
        ...(fact.acceptedReviewId ? { acceptedReviewId: fact.acceptedReviewId } : {}),
        ...(fact.appealDecisionId ? { appealDecisionId: fact.appealDecisionId } : {}),
        decidedAt: fact.decidedAt,
      },
      fact.actor,
    );
  }
  if (fact.factType === "organization_document_review") {
    return service.reviewDocuments(
      {
        id: fact.id,
        organizationId: fact.organizationId,
        profileRoot: fact.profileRoot,
        registrationReferenceRoot: fact.registrationReferenceRoot,
        documentRoots: fact.documentRoots,
        decision: fact.decision,
        reasonCode: fact.reasonCode,
        rationale: fact.rationale,
        conflictDisclosure: fact.conflictDisclosure,
        sourceEventRoots: fact.sourceEventRoots,
        reviewedAt: fact.reviewedAt,
      },
      fact.reviewer,
    );
  }
  if (fact.factType === "organization_appeal") {
    return service.openAppeal(
      {
        id: fact.id,
        organizationId: fact.organizationId,
        challengedLifecycleFactId: fact.challengedLifecycleFactId,
        reasonCode: fact.reasonCode,
        requestedRemedy: fact.requestedRemedy,
        grounds: fact.grounds,
        evidenceEventRoots: fact.evidenceEventRoots,
        submittedAt: fact.submittedAt,
      },
      fact.submitter,
    );
  }
  return service.decideAppeal(
    {
      id: fact.id,
      organizationId: fact.organizationId,
      appealId: fact.appealId,
      decision: fact.decision,
      remedy: fact.remedy,
      rationale: fact.rationale,
      conflictDisclosure: fact.conflictDisclosure,
      sourceEventRoots: fact.sourceEventRoots,
      decidedAt: fact.decidedAt,
    },
    fact.reviewer,
  );
}

function authorizeTransition(input: Readonly<{
  stream: OrganizationAuthorityStream;
  current: CanopyProofOrganizationLifecycleFact;
  parsed: z.infer<typeof transitionInputSchema>;
  actor: CanopyProofOrganizationLifecycleActorSnapshot;
  documentRoots: readonly string[];
  decidedAt: string;
}>) {
  const { stream, current, parsed, actor, documentRoots, decidedAt } = input;
  if (parsed.toStatus === "pending" || (parsed.toStatus === "document_review" && current.toStatus !== "pending")) {
    throw new Error("CANOPYPROOF_ORGANIZATION_LIFECYCLE_TRANSITION_INVALID");
  }
  let acceptedReview: CanopyProofOrganizationDocumentReviewFact | undefined;
  let appealDecision: CanopyProofOrganizationAppealDecisionFact | undefined;
  let trustLevel: CanopyProofOrganizationTrustLevel;

  if (current.toStatus === "pending" && parsed.toStatus === "document_review") {
    if (parsed.reasonCode !== "documents_submitted" || documentRoots.length === 0) {
      throw new Error("CANOPYPROOF_ORGANIZATION_DOCUMENT_SUBMISSION_INVALID");
    }
    requireSubjectActor(actor, parsed.organizationId, "pending");
    if (actor.organizationRoot !== parsed.profileRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_PROFILE_ROOT_CURRENT_AUTHORITY_MISMATCH");
    }
    trustLevel = "basic";
  } else if (current.toStatus === "document_review" && parsed.toStatus === "verified") {
    if (parsed.reasonCode !== "verification_approved" || hashJson(documentRoots) !== hashJson(current.documentRoots)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_VERIFICATION_INPUT_INVALID");
    }
    requireGovernanceActor(
      actor,
      parsed.organizationId,
      canopyProofOrganizationLifecycleScopes.verificationDecision,
      ["admin", "verifier"],
    );
    acceptedReview = requireAcceptedReview(stream, parsed.acceptedReviewId, current, parsed.profileRoot, documentRoots);
    if (actor.id === acceptedReview.reviewer.id) {
      throw new Error("CANOPYPROOF_ORGANIZATION_REVIEWER_DECIDER_SEPARATION_REQUIRED");
    }
    if (Date.parse(decidedAt) <= Date.parse(acceptedReview.reviewedAt)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_DECISION_MUST_POSTDATE_REVIEW");
    }
    trustLevel = parsed.trustLevel ?? "verified";
    if (trustLevel !== "verified" && trustLevel !== "institutional") {
      throw new Error("CANOPYPROOF_ORGANIZATION_VERIFIED_TRUST_LEVEL_INVALID");
    }
  } else if (
    (current.toStatus === "verified" && (parsed.toStatus === "suspended" || parsed.toStatus === "revoked")) ||
    ((current.toStatus === "pending" || current.toStatus === "document_review") && parsed.toStatus === "revoked") ||
    (current.toStatus === "suspended" && parsed.toStatus === "revoked")
  ) {
    requireGovernanceActor(
      actor,
      parsed.organizationId,
      canopyProofOrganizationLifecycleScopes.governanceControl,
      ["owner", "admin", "verifier"],
    );
    const allowedReason =
      parsed.toStatus === "suspended"
        ? parsed.reasonCode === "compliance_suspension" || parsed.reasonCode === "legal_suspension"
        : parsed.reasonCode === "fraud_revocation" ||
          parsed.reasonCode === "legal_revocation" ||
          parsed.reasonCode === "governance_revocation";
    if (!allowedReason || hashJson(documentRoots) !== hashJson(current.documentRoots)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ADVERSE_TRANSITION_INVALID");
    }
    trustLevel = "suspended";
  } else if (current.toStatus === "suspended" && parsed.toStatus === "verified") {
    if (parsed.reasonCode !== "appeal_reinstatement" || hashJson(documentRoots) !== hashJson(current.documentRoots)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_REINSTATEMENT_INPUT_INVALID");
    }
    requireGovernanceActor(
      actor,
      parsed.organizationId,
      canopyProofOrganizationLifecycleScopes.appealResolution,
      ["owner", "admin", "verifier"],
    );
    appealDecision = requireReinstatementDecision(stream, parsed.appealDecisionId, current);
    const appeal = stream.appeals.find((candidate) => candidate.id === appealDecision?.appealId);
    if (
      !appeal ||
      actor.id === appealDecision.reviewer.id ||
      actor.id === appeal.submitter.id ||
      actor.id === appeal.challengedActorId
    ) {
      throw new Error("CANOPYPROOF_ORGANIZATION_REINSTATEMENT_SEPARATION_REQUIRED");
    }
    if (Date.parse(decidedAt) <= Date.parse(appealDecision.decidedAt)) {
      throw new Error("CANOPYPROOF_ORGANIZATION_REINSTATEMENT_MUST_POSTDATE_APPEAL_DECISION");
    }
    trustLevel = parsed.trustLevel ?? "verified";
    if (trustLevel !== "verified" && trustLevel !== "institutional") {
      throw new Error("CANOPYPROOF_ORGANIZATION_REINSTATED_TRUST_LEVEL_INVALID");
    }
  } else {
    throw new Error(`CANOPYPROOF_ORGANIZATION_LIFECYCLE_TRANSITION_INVALID:${current.toStatus}->${parsed.toStatus}`);
  }
  if (
    (acceptedReview && parsed.appealDecisionId) ||
    (appealDecision && parsed.acceptedReviewId) ||
    (!acceptedReview && parsed.acceptedReviewId) ||
    (!appealDecision && parsed.appealDecisionId)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_TRANSITION_AUTHORITY_REFERENCE_INVALID");
  }
  return { trustLevel, ...(acceptedReview ? { acceptedReview } : {}), ...(appealDecision ? { appealDecision } : {}) };
}

function requireAcceptedReview(
  stream: OrganizationAuthorityStream,
  reviewId: string | undefined,
  lifecycle: CanopyProofOrganizationLifecycleFact,
  profileRoot: string,
  documentRoots: readonly string[],
) {
  if (!reviewId) throw new Error("CANOPYPROOF_ORGANIZATION_ACCEPTED_DOCUMENT_REVIEW_REQUIRED");
  const review = stream.documentReviews.find((candidate) => candidate.id === reviewId);
  const latest = stream.documentReviews.at(-1);
  if (
    !review ||
    latest?.id !== review.id ||
    review.decision !== "accepted" ||
    review.registrationReferenceRoot === null ||
    review.lifecycleRoot !== lifecycle.lifecycleRoot ||
    review.profileRoot !== profileRoot ||
    hashJson(review.documentRoots) !== hashJson(documentRoots)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCEPTED_DOCUMENT_REVIEW_INVALID");
  }
  return review;
}

function requireReinstatementDecision(
  stream: OrganizationAuthorityStream,
  decisionId: string | undefined,
  lifecycle: CanopyProofOrganizationLifecycleFact,
) {
  if (!decisionId) throw new Error("CANOPYPROOF_ORGANIZATION_UPHELD_APPEAL_REQUIRED");
  const decision = stream.appealDecisions.find((candidate) => candidate.id === decisionId);
  if (
    !decision ||
    decision.decision !== "upheld" ||
    decision.remedy !== "reinstate" ||
    decision.challengedStatus !== "suspended" ||
    decision.challengedLifecycleRoot !== lifecycle.lifecycleRoot
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_UPHELD_APPEAL_INVALID");
  }
  const latest = stream.appealDecisions.filter((candidate) => candidate.appealId === decision.appealId).at(-1);
  if (latest?.id !== decision.id) {
    throw new Error("CANOPYPROOF_ORGANIZATION_UPHELD_APPEAL_NOT_CURRENT");
  }
  if (stream.lifecycleFacts.some((fact) => fact.appealDecisionId === decision.id)) {
    throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_ALREADY_CONSUMED");
  }
  return decision;
}

function assertAppealDecisionRemedy(
  challengedStatus: "suspended" | "revoked",
  decision: CanopyProofOrganizationAppealDecision,
  remedy: CanopyProofOrganizationAppealRemedy,
) {
  const valid =
    (decision === "denied" && remedy === "none") ||
    (decision === "needs_more_evidence" && remedy === "none") ||
    (decision === "upheld" && challengedStatus === "suspended" && remedy === "reinstate") ||
    (decision === "upheld" && challengedStatus === "revoked" && remedy === "new_identity_required");
  if (!valid) throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_REMEDY_INVALID");
}

function normalizeActor(input: unknown): CanopyProofOrganizationLifecycleActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = normalizeUniqueStrings(parsed.accreditationScope, "ACTOR_ACCREDITATION_SCOPE");
  const hasAnyAccreditation = Boolean(parsed.accreditationId || parsed.accreditationStatus || parsed.accreditationRoot);
  const hasCompleteAccreditation = Boolean(parsed.accreditationId && parsed.accreditationStatus && parsed.accreditationRoot);
  if (hasAnyAccreditation !== hasCompleteAccreditation) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACTOR_ACCREDITATION_SNAPSHOT_INCOMPLETE");
  }
  const normalized = {
    id: parsed.id,
    participantType: "human" as const,
    role: parsed.role,
    verificationStatus: "verified" as const,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: parsed.participantRoot,
    organizationRoot: parsed.organizationRoot,
    membershipId: parsed.membershipId,
    membershipStatus: "active" as const,
    membershipRoot: parsed.membershipRoot,
    ...(hasCompleteAccreditation
      ? {
          accreditationId: parsed.accreditationId,
          accreditationStatus: parsed.accreditationStatus,
          accreditationRoot: parsed.accreditationRoot,
        }
      : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (authorityRoot !== parsed.authorityRoot) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACTOR_AUTHORITY_ROOT_INVALID");
  }
  return { ...normalized, authorityRoot } as CanopyProofOrganizationLifecycleActorSnapshot;
}

function requireSubjectActor(
  actor: CanopyProofOrganizationLifecycleActorSnapshot,
  organizationId: string,
  expectedStatus: CanopyProofOrganizationVerificationStatus,
) {
  if (
    actor.organizationId !== organizationId ||
    actor.organizationVerificationStatus !== expectedStatus ||
    !["owner", "admin"].includes(actor.role)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_SUBJECT_ACTOR_AUTHORITY_INVALID");
  }
}

function requireGovernanceActor(
  actor: CanopyProofOrganizationLifecycleActorSnapshot,
  subjectOrganizationId: string,
  scope: string,
  roles: ReadonlyArray<CanopyProofOrganizationLifecycleActorSnapshot["role"]>,
) {
  if (
    actor.organizationId === subjectOrganizationId ||
    actor.organizationVerificationStatus !== "verified" ||
    !roles.includes(actor.role) ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes(scope)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED");
  }
}

function nextFactCommon(stream: OrganizationAuthorityStream, commandHash: string) {
  return {
    organizationId: stream.organizationId,
    organizationSequence: stream.events.length + 1,
    previousEventRoot: stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    commandHash,
  };
}

function lifecycleFactRoot(
  organizationId: string,
  lifecycleHash: string,
  common: ReturnType<typeof nextFactCommon>,
) {
  return hashJson({
    kind: "canopyproof-organization-lifecycle-root-v1",
    organizationId,
    lifecycleHash,
    organizationSequence: common.organizationSequence,
    previousEventRoot: common.previousEventRoot,
  });
}

function authorityFactRoot(
  factKind: "document-review" | "appeal" | "appeal-decision",
  organizationId: string,
  factHash: string,
  common: ReturnType<typeof nextFactCommon>,
) {
  return hashJson({
    kind: `canopyproof-organization-${factKind}-root-v1`,
    organizationId,
    factHash,
    organizationSequence: common.organizationSequence,
    previousEventRoot: common.previousEventRoot,
  });
}

function appendAuthorityEvent(
  stream: OrganizationAuthorityStream,
  input: Readonly<{
    action: "ASSERT" | "REASON" | "FULFILL" | "CHALLENGE";
    actorId: string;
    entityType:
      | "organization_lifecycle"
      | "organization_document_review"
      | "organization_appeal"
      | "organization_appeal_decision";
    entityId: string;
    payload: unknown;
    createdAt: string;
    rationale: string;
  }>,
) {
  const event = appendCanopyProofAuditEvent(stream.events, {
    action: input.action,
    actor: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    createdAt: input.createdAt,
    rationale: input.rationale,
  }).at(-1);
  if (!event) throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_EVENT_NOT_APPENDED");
  const verification = verifyCanopyProofAuditChain([...stream.events, event]);
  if (!verification.valid) throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_EVENT_CHAIN_INVALID");
  return event;
}

function commitFact(
  stream: OrganizationAuthorityStream,
  fact: CanopyProofOrganizationAuthorityFact,
  factsById: Map<string, CanopyProofOrganizationAuthorityFact>,
) {
  assertNewFactId(factsById, fact.id);
  if (fact.organizationSequence !== stream.events.length + 1 || fact.previousEventRoot !== (stream.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot())) {
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_STREAM_POSITION_INVALID");
  }
  stream.events.push(fact.auditEvent);
  if (fact.factType === "organization_lifecycle") stream.lifecycleFacts.push(fact);
  else if (fact.factType === "organization_document_review") stream.documentReviews.push(fact);
  else if (fact.factType === "organization_appeal") stream.appeals.push(fact);
  else stream.appealDecisions.push(fact);
  factsById.set(fact.id, fact);
}

function createStream(organizationId: string): OrganizationAuthorityStream {
  return {
    organizationId,
    events: [],
    lifecycleFacts: [],
    documentReviews: [],
    appeals: [],
    appealDecisions: [],
  };
}

function requireLatestLifecycle(stream: OrganizationAuthorityStream) {
  const fact = stream.lifecycleFacts.at(-1);
  if (!fact) throw new Error(`CANOPYPROOF_ORGANIZATION_LIFECYCLE_NOT_ANCHORED:${stream.organizationId}`);
  return fact;
}

function assertStreamIntegrity(stream: OrganizationAuthorityStream) {
  if (stream.lifecycleFacts.length === 0 || stream.lifecycleFacts[0]?.fromStatus !== null) {
    throw new Error("CANOPYPROOF_ORGANIZATION_LIFECYCLE_GENESIS_MISSING");
  }
  const verification = verifyCanopyProofAuditChain(stream.events);
  if (!verification.valid) throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_STREAM_INVALID");
  for (const [index, event] of stream.events.entries()) {
    const fact = [...stream.lifecycleFacts, ...stream.documentReviews, ...stream.appeals, ...stream.appealDecisions].find(
      (candidate) => candidate.organizationSequence === index + 1,
    );
    if (!fact || fact.auditEvent.eventRoot !== event.eventRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_SEQUENCE_GAP_OR_FORK");
    }
  }
}

function normalizeRoots(values: readonly string[], label: string) {
  const parsed = values.map((value) => rootSchema.parse(value));
  if (new Set(parsed).size !== parsed.length) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_${label}_DUPLICATE`);
  }
  return [...parsed].sort();
}

function normalizeUniqueStrings(values: readonly string[], label: string) {
  const normalized = values.map((value) => identifierSchema.parse(value));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_${label}_DUPLICATE`);
  }
  return [...normalized].sort();
}

function canonicalTimestamp(value: string, label: string) {
  const parsed = timestampSchema.parse(value);
  if (new Date(parsed).toISOString() !== parsed) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_${label}_NOT_CANONICAL_UTC`);
  }
  return parsed;
}

function assertCanonicalId(inputId: string | undefined, expectedId: string, label: string) {
  if (inputId && inputId !== expectedId) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_${label}_ID_NON_CANONICAL`);
  }
}

function assertNewFactId(facts: Map<string, CanopyProofOrganizationAuthorityFact>, factId: string) {
  if (facts.has(factId)) throw new Error(`CANOPYPROOF_ORGANIZATION_AUTHORITY_FACT_ID_CONFLICT:${factId}`);
}

function isAdverseStatus(status: CanopyProofOrganizationVerificationStatus): status is "suspended" | "revoked" {
  return status === "suspended" || status === "revoked";
}

function assertSafeText(value: string) {
  const unsafe = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]?tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+\$?canopy\s+distribution/i,
    /private\s+key/i,
    /mainnet\s+fund/i,
  ];
  if (unsafe.some((pattern) => pattern.test(value) && !/\bnot\b/i.test(value))) {
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_UNSUPPORTED_CLAIM");
  }
}
