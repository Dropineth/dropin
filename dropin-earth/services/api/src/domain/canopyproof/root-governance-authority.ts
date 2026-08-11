import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofRootGovernanceActions = ["activate_initial", "supersede", "suspend", "revoke"] as const;
export const canopyProofRootGovernanceAttestationDecisions = ["approve", "reject"] as const;
export const canopyProofRootGovernanceRoles = ["owner", "admin", "verifier", "researcher"] as const;
export const canopyProofRootGovernanceScopes = [
  "organization:accreditation:decide",
  "organization:accreditation:govern",
  "organization:accreditation:review",
] as const;
export const canopyProofRootGovernanceReasonCodes = [
  "initial_constitution",
  "scheduled_succession",
  "authority_compromise",
  "governance_failure",
  "legal_restriction",
  "policy_transition",
] as const;
export const canopyProofRootGovernanceProjectionStatuses = [
  "uninitialized",
  "pending",
  "active",
  "suspended",
  "revoked",
  "expired",
] as const;

export type CanopyProofRootGovernanceAction = (typeof canopyProofRootGovernanceActions)[number];
export type CanopyProofRootGovernanceProjectionStatus =
  (typeof canopyProofRootGovernanceProjectionStatuses)[number];

export type CanopyProofRootGovernanceSafetyBoundary = Readonly<{
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  publicBootstrapEndpoint: false;
  privateKeyHandling: false;
  compatibilityAuthorityFallback: false;
  appendOnly: true;
  exactRetryRequired: true;
  explicitAsOfRequired: true;
  multiOrganizationQuorumRequired: true;
  ed25519VerificationRequired: true;
  aiIsNeverFinalAuthority: true;
  noMainnetFunds: true;
  notAutomaticCanopyDistribution: true;
  notCertifiedCarbonCredit: true;
  notCarbonTaxOffset: true;
  notFinancialAsset: true;
  notGuaranteedYield: true;
}>;

export type CanopyProofRootGovernancePublicJwk = Readonly<{
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  key_ops: readonly ["verify"];
  ext: true;
}>;

export type CanopyProofRootGovernanceMember = Readonly<{
  participantId: string;
  participantRoot: string;
  role: (typeof canopyProofRootGovernanceRoles)[number];
  verificationStatus: "verified";
  organizationId: string;
  organizationRoot: string;
  organizationVerificationStatus: "verified";
  membershipId: string;
  membershipRoot: string;
  membershipStatus: "active";
  keyId: string;
  publicKeyJwk: CanopyProofRootGovernancePublicJwk;
  publicKeyFingerprint: string;
  memberRoot: string;
}>;

type RootGovernanceFactCommon = Readonly<{
  id: string;
  authorityDomain: "organization_accreditation";
  globalSequence: number;
  previousEventRoot: string;
  commandHash: string;
  safety: CanopyProofRootGovernanceSafetyBoundary;
  auditEvent: CanopyProofAuditEvent;
}>;

export type CanopyProofRootGovernanceProposalFact = RootGovernanceFactCommon &
  Readonly<{
    factType: "root_governance_proposal";
    action: CanopyProofRootGovernanceAction;
    charterVersion: string;
    charterDocumentRoot: string;
    policyRoot: string;
    delegatedScopes: readonly string[];
    councilMembers: readonly CanopyProofRootGovernanceMember[];
    councilRoot: string;
    requiredApprovals: number;
    requestedValidUntil: string;
    predecessorDecisionId: string | null;
    predecessorDecisionRoot: string | null;
    targetDecisionId: string | null;
    targetDecisionRoot: string | null;
    reasonCode: (typeof canopyProofRootGovernanceReasonCodes)[number];
    rationale: string;
    evidenceEventRoots: readonly string[];
    evidenceRoot: string;
    proposer: CanopyProofRootGovernanceMember;
    proposedAt: string;
    proposalHash: string;
    proposalRoot: string;
  }>;

export type CanopyProofRootGovernanceAttestationFact = RootGovernanceFactCommon &
  Readonly<{
    factType: "root_governance_attestation";
    proposalId: string;
    proposalRoot: string;
    decision: (typeof canopyProofRootGovernanceAttestationDecisions)[number];
    signer: CanopyProofRootGovernanceMember;
    rationale: string;
    conflictDisclosure: string;
    signedPayloadRoot: string;
    signatureAlgorithm: "ed25519";
    signatureBase64Url: string;
    signatureHash: string;
    verifiedAt: string;
    verifierVersion: "webcrypto-ed25519-v1";
    verificationReceiptRoot: string;
    attestedAt: string;
    attestationHash: string;
    attestationRoot: string;
  }>;

export type CanopyProofRootGovernanceDecisionFact = RootGovernanceFactCommon &
  Readonly<{
    factType: "root_governance_decision";
    proposalId: string;
    proposalRoot: string;
    action: CanopyProofRootGovernanceAction;
    approvalAttestationIds: readonly string[];
    approvalAttestationRoots: readonly string[];
    approvalQuorumRoot: string;
    predecessorDecisionId: string | null;
    predecessorDecisionRoot: string | null;
    charterDecisionId: string | null;
    charterDecisionRoot: string | null;
    effectiveFrom: string;
    effectiveUntil: string;
    decidedAt: string;
    decisionHash: string;
    decisionRoot: string;
  }>;

export type CanopyProofRootGovernanceFact =
  | CanopyProofRootGovernanceProposalFact
  | CanopyProofRootGovernanceAttestationFact
  | CanopyProofRootGovernanceDecisionFact;

export type CanopyProofRootGovernanceProjection = Readonly<{
  authorityDomain: "organization_accreditation";
  status: CanopyProofRootGovernanceProjectionStatus;
  proposalId: string | null;
  proposalRoot: string | null;
  latestDecisionId: string | null;
  latestDecisionRoot: string | null;
  charterDecisionId: string | null;
  charterDecisionRoot: string | null;
  charterVersion: string | null;
  charterDocumentRoot: string | null;
  policyRoot: string | null;
  delegatedScopes: readonly string[];
  councilMembers: readonly CanopyProofRootGovernanceMember[];
  councilRoot: string | null;
  requiredApprovals: number | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  asOf: string;
  latestGlobalSequence: number;
  latestEventRoot: string;
  projectionRoot: string;
  safety: CanopyProofRootGovernanceSafetyBoundary;
}>;

export type CanopyProofRootGovernanceAuthoritySnapshot = Readonly<{
  proposalFacts: readonly CanopyProofRootGovernanceProposalFact[];
  attestationFacts: readonly CanopyProofRootGovernanceAttestationFact[];
  decisionFacts: readonly CanopyProofRootGovernanceDecisionFact[];
}>;

export type ProposeCanopyProofRootGovernanceInput = Readonly<{
  id?: string;
  action: CanopyProofRootGovernanceAction;
  charterVersion?: string;
  charterDocumentRoot?: string;
  policyRoot?: string;
  delegatedScopes?: readonly string[];
  councilMembers?: readonly unknown[];
  requiredApprovals?: number;
  requestedValidUntil?: string;
  predecessorDecisionId?: string;
  targetDecisionId?: string;
  reasonCode: (typeof canopyProofRootGovernanceReasonCodes)[number];
  rationale: string;
  evidenceEventRoots: readonly string[];
  proposedAt: string;
}>;

export type AttestCanopyProofRootGovernanceInput = Readonly<{
  id?: string;
  decision: (typeof canopyProofRootGovernanceAttestationDecisions)[number];
  rationale: string;
  conflictDisclosure: string;
  attestedAt: string;
  signatureBase64Url: string;
}>;

export type DecideCanopyProofRootGovernanceInput = Readonly<{
  id?: string;
  approvalAttestationIds: readonly string[];
  decidedAt: string;
}>;

const identifierSchema = z.string().trim().min(1).max(240);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const charterVersionSchema = z.string().regex(/^v[1-9][0-9]*\.[0-9]+\.[0-9]+$/);
const base64UrlKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const signatureSchema = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
const publicJwkSchema = z
  .object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: base64UrlKeySchema,
    key_ops: z.tuple([z.literal("verify")]),
    ext: z.literal(true),
  })
  .strict();
const memberSchema = z
  .object({
    participantId: identifierSchema,
    participantRoot: hashSchema,
    role: z.enum(canopyProofRootGovernanceRoles),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationRoot: hashSchema,
    organizationVerificationStatus: z.literal("verified"),
    membershipId: identifierSchema,
    membershipRoot: hashSchema,
    membershipStatus: z.literal("active"),
    keyId: identifierSchema,
    publicKeyJwk: publicJwkSchema,
    publicKeyFingerprint: hashSchema.optional(),
    memberRoot: hashSchema.optional(),
  })
  .strict();
const proposalInputSchema = z
  .object({
    id: identifierSchema.optional(),
    action: z.enum(canopyProofRootGovernanceActions),
    charterVersion: charterVersionSchema.optional(),
    charterDocumentRoot: hashSchema.optional(),
    policyRoot: hashSchema.optional(),
    delegatedScopes: z.array(identifierSchema).min(1).max(8).optional(),
    councilMembers: z.array(z.unknown()).min(3).max(9).optional(),
    requiredApprovals: z.number().int().min(3).max(9).optional(),
    requestedValidUntil: timestampSchema.optional(),
    predecessorDecisionId: identifierSchema.optional(),
    targetDecisionId: identifierSchema.optional(),
    reasonCode: z.enum(canopyProofRootGovernanceReasonCodes),
    rationale: z.string().trim().min(32).max(4_000),
    evidenceEventRoots: z.array(hashSchema).min(1).max(128),
    proposedAt: timestampSchema,
  })
  .strict();
const attestationInputSchema = z
  .object({
    id: identifierSchema.optional(),
    decision: z.enum(canopyProofRootGovernanceAttestationDecisions),
    rationale: z.string().trim().min(32).max(4_000),
    conflictDisclosure: z.string().trim().min(32).max(2_000),
    attestedAt: timestampSchema,
    signatureBase64Url: signatureSchema,
  })
  .strict();
const decisionInputSchema = z
  .object({
    id: identifierSchema.optional(),
    approvalAttestationIds: z.array(identifierSchema).min(1).max(18),
    decidedAt: timestampSchema,
  })
  .strict();
const auditEventSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
    actor: identifierSchema,
    entityType: z.enum(["root_governance_proposal", "root_governance_attestation", "root_governance_decision"]),
    entityId: identifierSchema,
    previousRoot: hashSchema,
    payloadHash: hashSchema,
    eventRoot: hashSchema,
    createdAt: timestampSchema,
    rationale: z.string().trim().min(1).max(4_000),
  })
  .strict();
const factCommonShape = {
  id: identifierSchema,
  authorityDomain: z.literal("organization_accreditation"),
  globalSequence: z.number().int().min(1).max(4_096),
  previousEventRoot: hashSchema,
  commandHash: hashSchema,
  safety: z.unknown(),
  auditEvent: auditEventSchema,
};
const proposalFactSchema = z
  .object({
    ...factCommonShape,
    factType: z.literal("root_governance_proposal"),
    action: z.enum(canopyProofRootGovernanceActions),
    charterVersion: charterVersionSchema,
    charterDocumentRoot: hashSchema,
    policyRoot: hashSchema,
    delegatedScopes: z.array(identifierSchema).min(1).max(8),
    councilMembers: z.array(memberSchema).min(3).max(9),
    councilRoot: hashSchema,
    requiredApprovals: z.number().int().min(3).max(9),
    requestedValidUntil: timestampSchema,
    predecessorDecisionId: identifierSchema.nullable(),
    predecessorDecisionRoot: hashSchema.nullable(),
    targetDecisionId: identifierSchema.nullable(),
    targetDecisionRoot: hashSchema.nullable(),
    reasonCode: z.enum(canopyProofRootGovernanceReasonCodes),
    rationale: z.string().trim().min(32).max(4_000),
    evidenceEventRoots: z.array(hashSchema).min(1).max(128),
    evidenceRoot: hashSchema,
    proposer: memberSchema,
    proposedAt: timestampSchema,
    proposalHash: hashSchema,
    proposalRoot: hashSchema,
  })
  .strict();
const attestationFactSchema = z
  .object({
    ...factCommonShape,
    factType: z.literal("root_governance_attestation"),
    proposalId: identifierSchema,
    proposalRoot: hashSchema,
    decision: z.enum(canopyProofRootGovernanceAttestationDecisions),
    signer: memberSchema,
    rationale: z.string().trim().min(32).max(4_000),
    conflictDisclosure: z.string().trim().min(32).max(2_000),
    signedPayloadRoot: hashSchema,
    signatureAlgorithm: z.literal("ed25519"),
    signatureBase64Url: signatureSchema,
    signatureHash: hashSchema,
    verifiedAt: timestampSchema,
    verifierVersion: z.literal("webcrypto-ed25519-v1"),
    verificationReceiptRoot: hashSchema,
    attestedAt: timestampSchema,
    attestationHash: hashSchema,
    attestationRoot: hashSchema,
  })
  .strict();
const decisionFactSchema = z
  .object({
    ...factCommonShape,
    factType: z.literal("root_governance_decision"),
    proposalId: identifierSchema,
    proposalRoot: hashSchema,
    action: z.enum(canopyProofRootGovernanceActions),
    approvalAttestationIds: z.array(identifierSchema).min(3).max(18),
    approvalAttestationRoots: z.array(hashSchema).min(3).max(18),
    approvalQuorumRoot: hashSchema,
    predecessorDecisionId: identifierSchema.nullable(),
    predecessorDecisionRoot: hashSchema.nullable(),
    charterDecisionId: identifierSchema.nullable(),
    charterDecisionRoot: hashSchema.nullable(),
    effectiveFrom: timestampSchema,
    effectiveUntil: timestampSchema,
    decidedAt: timestampSchema,
    decisionHash: hashSchema,
    decisionRoot: hashSchema,
  })
  .strict();

const rootGovernanceSafety = (): CanopyProofRootGovernanceSafetyBoundary => ({
  routeMounted: false,
  schedulerMounted: false,
  productionActivationEnabled: false,
  publicBootstrapEndpoint: false,
  privateKeyHandling: false,
  compatibilityAuthorityFallback: false,
  appendOnly: true,
  exactRetryRequired: true,
  explicitAsOfRequired: true,
  multiOrganizationQuorumRequired: true,
  ed25519VerificationRequired: true,
  aiIsNeverFinalAuthority: true,
  noMainnetFunds: true,
  notAutomaticCanopyDistribution: true,
  notCertifiedCarbonCredit: true,
  notCarbonTaxOffset: true,
  notFinancialAsset: true,
  notGuaranteedYield: true,
});

export class CanopyProofRootGovernanceAuthorityService {
  private readonly proposals: CanopyProofRootGovernanceProposalFact[] = [];
  private readonly attestations: CanopyProofRootGovernanceAttestationFact[] = [];
  private readonly decisions: CanopyProofRootGovernanceDecisionFact[] = [];
  private readonly events: CanopyProofAuditEvent[] = [];

  static async fromAuthoritySnapshot(snapshot: CanopyProofRootGovernanceAuthoritySnapshot) {
    if (
      snapshot.proposalFacts.length + snapshot.attestationFacts.length + snapshot.decisionFacts.length >
      4_096
    ) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_HISTORY_LIMIT_EXCEEDED");
    }
    const service = new CanopyProofRootGovernanceAuthorityService();
    const facts = [
      ...snapshot.proposalFacts.map((fact) => parseCanopyProofRootGovernanceProposalFact(fact)),
      ...snapshot.attestationFacts.map((fact) => parseCanopyProofRootGovernanceAttestationFact(fact)),
      ...snapshot.decisionFacts.map((fact) => parseCanopyProofRootGovernanceDecisionFact(fact)),
    ].sort((left, right) => left.globalSequence - right.globalSequence);
    for (const [index, fact] of facts.entries()) {
      if (fact.globalSequence !== index + 1) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SEQUENCE_INVALID");
      }
      if (fact.factType === "root_governance_proposal") {
        const replayed = service.propose(proposalReplayInput(fact), fact.proposer);
        assertReplayEqual(replayed, fact, "proposal");
      } else if (fact.factType === "root_governance_attestation") {
        const replayed = await service.attest(
          fact.proposalId,
          {
            id: fact.id,
            decision: fact.decision,
            rationale: fact.rationale,
            conflictDisclosure: fact.conflictDisclosure,
            attestedAt: fact.attestedAt,
            signatureBase64Url: fact.signatureBase64Url,
          },
          fact.signer,
        );
        assertReplayEqual(replayed, fact, "attestation");
      } else {
        const replayed = service.decide(fact.proposalId, {
          id: fact.id,
          approvalAttestationIds: fact.approvalAttestationIds,
          decidedAt: fact.decidedAt,
        });
        assertReplayEqual(replayed, fact, "decision");
      }
    }
    const audit = verifyCanopyProofAuditChain(service.events, facts.at(-1)?.auditEvent.createdAt);
    if (!audit.valid) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_AUDIT_CHAIN_INVALID");
    return service;
  }

  getStatus() {
    return {
      service: "canopyproof-root-governance-authority" as const,
      routeMounted: false as const,
      schedulerMounted: false as const,
      productionActivationEnabled: false as const,
      publicBootstrapEndpoint: false as const,
      privateKeyHandling: false as const,
      compatibilityAuthorityFallback: false as const,
      appendOnly: true as const,
      exactRetryRequired: true as const,
      explicitAsOfRequired: true as const,
      minimumIndependentOrganizations: 3 as const,
      delegatedScopes: [...canopyProofRootGovernanceScopes],
    };
  }

  propose(
    input: ProposeCanopyProofRootGovernanceInput,
    proposerInput: unknown,
  ): CanopyProofRootGovernanceProposalFact {
    const parsed = proposalInputSchema.parse(input);
    const proposedAt = canonicalTimestamp(parsed.proposedAt, "proposal time");
    const proposer = normalizeMember(proposerInput);
    assertSafeGovernanceText(parsed.rationale, "proposal rationale");
    this.assertNoOpenProposal();

    const latestDecision = this.decisions.at(-1);
    if (latestDecision?.action === "revoke") {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_REVOKED_TERMINAL");
    }
    const currentCharter = this.latestCharterDecision();
    const currentProposal = currentCharter ? this.requireProposal(currentCharter.proposalId) : undefined;
    const currentProjection = this.getProjection(proposedAt);

    let charterVersion: string;
    let charterDocumentRoot: string;
    let policyRoot: string;
    let delegatedScopes: readonly string[];
    let councilMembers: readonly CanopyProofRootGovernanceMember[];
    let requiredApprovals: number;
    let requestedValidUntil: string;
    let predecessorDecisionId: string | null = latestDecision?.id ?? null;
    let predecessorDecisionRoot: string | null = latestDecision?.decisionRoot ?? null;
    let targetDecisionId: string | null = null;
    let targetDecisionRoot: string | null = null;

    if (parsed.action === "activate_initial") {
      if (latestDecision || this.proposals.length > 0) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_INITIAL_ALREADY_EXISTS");
      }
      predecessorDecisionId = null;
      predecessorDecisionRoot = null;
      ({
        charterVersion,
        charterDocumentRoot,
        policyRoot,
        delegatedScopes,
        councilMembers,
        requiredApprovals,
        requestedValidUntil,
      } = normalizeCharterFields(parsed, proposedAt));
      requireMember(councilMembers, proposer, "initial proposer");
      if (parsed.predecessorDecisionId || parsed.targetDecisionId) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_INITIAL_PREDECESSOR_INVALID");
      }
    } else if (parsed.action === "supersede") {
      if (!currentCharter || !currentProposal || !["active", "suspended"].includes(currentProjection.status)) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SUCCESSION_SOURCE_INVALID");
      }
      if (parsed.predecessorDecisionId !== latestDecision?.id || parsed.targetDecisionId !== currentCharter.id) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SUCCESSION_PREDECESSOR_INVALID");
      }
      targetDecisionId = currentCharter.id;
      targetDecisionRoot = currentCharter.decisionRoot;
      ({
        charterVersion,
        charterDocumentRoot,
        policyRoot,
        delegatedScopes,
        councilMembers,
        requiredApprovals,
        requestedValidUntil,
      } = normalizeCharterFields(parsed, proposedAt));
      if (compareVersions(charterVersion, currentProposal.charterVersion) <= 0) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SUCCESSOR_VERSION_INVALID");
      }
      requireMember(currentProposal.councilMembers, proposer, "successor proposer");
    } else {
      if (!currentCharter || !currentProposal) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_CONTROL_SOURCE_INVALID");
      }
      const allowedStatuses = parsed.action === "revoke" ? ["active", "suspended"] : ["active"];
      if (!allowedStatuses.includes(currentProjection.status)) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_CONTROL_STATE_INVALID");
      }
      if (parsed.targetDecisionId !== currentCharter.id || parsed.predecessorDecisionId !== latestDecision?.id) {
        throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_CONTROL_PREDECESSOR_INVALID");
      }
      assertControlFieldsAbsent(parsed);
      charterVersion = currentProposal.charterVersion;
      charterDocumentRoot = currentProposal.charterDocumentRoot;
      policyRoot = currentProposal.policyRoot;
      delegatedScopes = currentProposal.delegatedScopes;
      councilMembers = currentProposal.councilMembers;
      requiredApprovals = currentProposal.requiredApprovals;
      requestedValidUntil = currentCharter.effectiveUntil;
      targetDecisionId = currentCharter.id;
      targetDecisionRoot = currentCharter.decisionRoot;
      requireMember(councilMembers, proposer, "control proposer");
    }

    const evidenceEventRoots = normalizeUniqueRoots(parsed.evidenceEventRoots, "proposal evidence roots");
    const councilRoot = rootGovernanceCouncilRoot(councilMembers);
    const evidenceRoot = rootGovernanceProposalEvidenceRoot({
      evidenceEventRoots,
      charterDocumentRoot,
      policyRoot,
      councilRoot,
      predecessorDecisionRoot,
      targetDecisionRoot,
    });
    const commandInput = {
      action: parsed.action,
      charterVersion,
      charterDocumentRoot,
      policyRoot,
      delegatedScopes,
      councilMembers,
      councilRoot,
      requiredApprovals,
      requestedValidUntil,
      predecessorDecisionId,
      predecessorDecisionRoot,
      targetDecisionId,
      targetDecisionRoot,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      evidenceEventRoots,
      evidenceRoot,
      proposer,
      proposedAt,
    } as const;
    const commandHash = rootGovernanceProposalCommandHash(commandInput);
    const id = `cp_root_governance_proposal_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_PROPOSAL_ID_INVALID");
    }
    const globalSequence = this.nextSequence();
    const previousEventRoot = this.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const proposalHash = rootGovernanceProposalFactHash({ id, globalSequence, previousEventRoot, commandHash });
    const proposalRoot = rootGovernanceProposalFactRoot({
      proposalHash,
      commandHash,
      evidenceRoot,
      proposerRoot: proposer.memberRoot,
      predecessorDecisionRoot,
      targetDecisionRoot,
    });
    const payload = {
      factType: "root_governance_proposal" as const,
      id,
      authorityDomain: "organization_accreditation" as const,
      globalSequence,
      previousEventRoot,
      commandHash,
      safety: rootGovernanceSafety(),
      ...commandInput,
      proposalHash,
      proposalRoot,
    };
    const auditEvent = appendCanopyProofAuditEvent(this.events, {
      action: parsed.action === "revoke" ? "CHALLENGE" : "ASSERT",
      actor: proposer.participantId,
      entityType: "root_governance_proposal",
      entityId: id,
      payload,
      createdAt: proposedAt,
      rationale: "A bounded root-governance proposal was recorded without granting authority.",
    }).at(-1)!;
    const fact: CanopyProofRootGovernanceProposalFact = { ...payload, auditEvent };
    this.proposals.push(fact);
    this.events.push(auditEvent);
    return fact;
  }

  async attest(
    proposalIdInput: string,
    input: AttestCanopyProofRootGovernanceInput,
    signerInput: unknown,
  ): Promise<CanopyProofRootGovernanceAttestationFact> {
    const proposalId = identifierSchema.parse(proposalIdInput);
    const parsed = attestationInputSchema.parse(input);
    const proposal = this.requireProposal(proposalId);
    if (this.decisions.some((decision) => decision.proposalId === proposalId)) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_PROPOSAL_ALREADY_DECIDED");
    }
    const signer = normalizeMember(signerInput);
    const applicableMembers = this.applicableAttestationMembers(proposal);
    requireMember(applicableMembers, signer, "attestation signer");
    const attestedAt = canonicalTimestamp(parsed.attestedAt, "attestation time");
    if (timestampMs(attestedAt) < timestampMs(proposal.proposedAt)) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_ATTESTATION_TIME_INVALID");
    }
    assertSafeGovernanceText(parsed.rationale, "attestation rationale");
    assertSafeGovernanceText(parsed.conflictDisclosure, "attestation conflict disclosure");
    const signedPayloadRoot = rootGovernanceAttestationSignedPayloadRoot({
      proposalRoot: proposal.proposalRoot,
      decision: parsed.decision,
      signerMemberRoot: signer.memberRoot,
      attestedAt,
    });
    if (encodeBase64Url(decodeBase64Url(parsed.signatureBase64Url)) !== parsed.signatureBase64Url) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SIGNATURE_NONCANONICAL");
    }
    const verified = await verifyRootGovernanceEd25519Signature(
      signer.publicKeyJwk,
      signedPayloadRoot,
      parsed.signatureBase64Url,
    );
    if (!verified) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SIGNATURE_INVALID");
    const signatureHash = hashJson({
      kind: "canopyproof-root-governance-ed25519-signature-v1",
      signatureBase64Url: parsed.signatureBase64Url,
    });
    const verifierVersion = "webcrypto-ed25519-v1" as const;
    const verifiedAt = attestedAt;
    const verificationReceiptRoot = hashJson({
      kind: "canopyproof-root-governance-signature-verification-receipt-v1",
      signedPayloadRoot,
      signatureHash,
      publicKeyFingerprint: signer.publicKeyFingerprint,
      keyId: signer.keyId,
      verifiedAt,
      verifierVersion,
    });
    const commandInput = {
      proposalId,
      proposalRoot: proposal.proposalRoot,
      decision: parsed.decision,
      signer,
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      signedPayloadRoot,
      signatureAlgorithm: "ed25519" as const,
      signatureBase64Url: parsed.signatureBase64Url,
      signatureHash,
      verifiedAt,
      verifierVersion,
      verificationReceiptRoot,
      attestedAt,
    };
    const commandHash = rootGovernanceAttestationCommandHash(commandInput);
    const existing = this.attestations.find(
      (attestation) => attestation.proposalId === proposalId && attestation.signer.participantId === signer.participantId,
    );
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_ATTESTATION_CONFLICT");
    }
    const id = `cp_root_governance_attestation_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_ATTESTATION_ID_INVALID");
    }
    const globalSequence = this.nextSequence();
    const previousEventRoot = this.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const attestationHash = rootGovernanceAttestationFactHash({
      id,
      globalSequence,
      previousEventRoot,
      commandHash,
    });
    const attestationRoot = rootGovernanceAttestationFactRoot({
      attestationHash,
      commandHash,
      proposalRoot: proposal.proposalRoot,
      signerRoot: signer.memberRoot,
      signedPayloadRoot,
      verificationReceiptRoot,
    });
    const payload = {
      factType: "root_governance_attestation" as const,
      id,
      authorityDomain: "organization_accreditation" as const,
      globalSequence,
      previousEventRoot,
      commandHash,
      safety: rootGovernanceSafety(),
      ...commandInput,
      attestationHash,
      attestationRoot,
    };
    const auditEvent = appendCanopyProofAuditEvent(this.events, {
      action: parsed.decision === "approve" ? "ASSERT" : "CHALLENGE",
      actor: signer.participantId,
      entityType: "root_governance_attestation",
      entityId: id,
      payload,
      createdAt: attestedAt,
      rationale: "An independent signed root-governance attestation was verified and recorded.",
    }).at(-1)!;
    const fact: CanopyProofRootGovernanceAttestationFact = { ...payload, auditEvent };
    this.attestations.push(fact);
    this.events.push(auditEvent);
    return fact;
  }

  decide(
    proposalIdInput: string,
    input: DecideCanopyProofRootGovernanceInput,
  ): CanopyProofRootGovernanceDecisionFact {
    const proposalId = identifierSchema.parse(proposalIdInput);
    const parsed = decisionInputSchema.parse(input);
    const proposal = this.requireProposal(proposalId);
    const decidedAt = canonicalTimestamp(parsed.decidedAt, "decision time");
    const existing = this.decisions.find((decision) => decision.proposalId === proposalId);
    const approvalAttestationIds = normalizeUniqueStrings(
      parsed.approvalAttestationIds,
      "approval attestation ids",
    );
    const approvals = approvalAttestationIds.map((id) => this.requireAttestation(id));
    if (
      approvals.some(
        (attestation) =>
          attestation.proposalId !== proposal.id ||
          attestation.proposalRoot !== proposal.proposalRoot ||
          attestation.decision !== "approve" ||
          timestampMs(attestation.attestedAt) > timestampMs(decidedAt),
      )
    ) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DECISION_ATTESTATIONS_INVALID");
    }
    this.assertApprovalQuorum(proposal, approvals);
    if (timestampMs(decidedAt) < timestampMs(proposal.proposedAt)) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DECISION_TIME_INVALID");
    }
    const approvalAttestationRoots = approvals.map((attestation) => attestation.attestationRoot).sort();
    const approvalQuorumRoot = merkleRoot(approvalAttestationRoots);
    const predecessorDecisionId = proposal.predecessorDecisionId;
    const predecessorDecisionRoot = proposal.predecessorDecisionRoot;
    const priorCharter = this.latestCharterDecision();
    const effectiveFrom = decidedAt;
    const effectiveUntil = proposal.requestedValidUntil;
    if (timestampMs(effectiveUntil) <= timestampMs(effectiveFrom)) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DECISION_VALIDITY_INVALID");
    }
    const commandInput = {
      proposalId,
      proposalRoot: proposal.proposalRoot,
      action: proposal.action,
      approvalAttestationIds,
      approvalAttestationRoots,
      approvalQuorumRoot,
      predecessorDecisionId,
      predecessorDecisionRoot,
      charterDecisionId:
        proposal.action === "activate_initial" || proposal.action === "supersede" ? null : priorCharter?.id ?? null,
      charterDecisionRoot:
        proposal.action === "activate_initial" || proposal.action === "supersede"
          ? null
          : priorCharter?.decisionRoot ?? null,
      effectiveFrom,
      effectiveUntil,
      decidedAt,
    };
    const commandHash = rootGovernanceDecisionCommandHash(commandInput);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DECISION_CONFLICT");
    }
    this.assertDecisionPredecessor(proposal);
    const id = `cp_root_governance_decision_${commandHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== id) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DECISION_ID_INVALID");
    }
    const globalSequence = this.nextSequence();
    const previousEventRoot = this.events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const decisionHash = rootGovernanceDecisionFactHash({ id, globalSequence, previousEventRoot, commandHash });
    const decisionRoot = rootGovernanceDecisionFactRoot({
      decisionHash,
      commandHash,
      proposalRoot: proposal.proposalRoot,
      approvalQuorumRoot,
      predecessorDecisionRoot,
      charterDecisionRoot: commandInput.charterDecisionRoot,
    });
    const payload = {
      factType: "root_governance_decision" as const,
      id,
      authorityDomain: "organization_accreditation" as const,
      globalSequence,
      previousEventRoot,
      commandHash,
      safety: rootGovernanceSafety(),
      ...commandInput,
      decisionHash,
      decisionRoot,
    };
    const auditEvent = appendCanopyProofAuditEvent(this.events, {
      action: proposal.action === "revoke" ? "CHALLENGE" : "FULFILL",
      actor: proposal.proposer.participantId,
      entityType: "root_governance_decision",
      entityId: id,
      payload,
      createdAt: decidedAt,
      rationale: "A signed multi-organization quorum deterministically materialized root-governance state.",
    }).at(-1)!;
    const fact: CanopyProofRootGovernanceDecisionFact = { ...payload, auditEvent };
    this.decisions.push(fact);
    this.events.push(auditEvent);
    return fact;
  }

  getProjection(asOfInput: string): CanopyProofRootGovernanceProjection {
    const asOf = canonicalTimestamp(asOfInput, "projection time");
    const asOfMs = timestampMs(asOf);
    const proposals = this.proposals.filter((fact) => timestampMs(fact.proposedAt) <= asOfMs);
    const decisions = this.decisions.filter((fact) => timestampMs(fact.decidedAt) <= asOfMs);
    const latestDecision = decisions.at(-1);
    const latestCharter = [...decisions]
      .reverse()
      .find((decision) => decision.action === "activate_initial" || decision.action === "supersede");
    const charterProposal = latestCharter ? this.requireProposal(latestCharter.proposalId) : undefined;
    const latestEvent = [...this.events].reverse().find((event) => timestampMs(event.createdAt) <= asOfMs);
    let status: CanopyProofRootGovernanceProjectionStatus;
    if (!latestCharter || !charterProposal) {
      status = proposals.length > 0 ? "pending" : "uninitialized";
    } else if (latestDecision?.action === "revoke" && latestDecision.globalSequence > latestCharter.globalSequence) {
      status = "revoked";
    } else if (latestDecision?.action === "suspend" && latestDecision.globalSequence > latestCharter.globalSequence) {
      status = "suspended";
    } else if (asOfMs < timestampMs(latestCharter.effectiveFrom)) {
      status = "pending";
    } else if (asOfMs >= timestampMs(latestCharter.effectiveUntil)) {
      status = "expired";
    } else {
      status = "active";
    }
    const seed = {
      authorityDomain: "organization_accreditation" as const,
      status,
      proposalId: charterProposal?.id ?? proposals.at(-1)?.id ?? null,
      proposalRoot: charterProposal?.proposalRoot ?? proposals.at(-1)?.proposalRoot ?? null,
      latestDecisionId: latestDecision?.id ?? null,
      latestDecisionRoot: latestDecision?.decisionRoot ?? null,
      charterDecisionId: latestCharter?.id ?? null,
      charterDecisionRoot: latestCharter?.decisionRoot ?? null,
      charterVersion: charterProposal?.charterVersion ?? null,
      charterDocumentRoot: charterProposal?.charterDocumentRoot ?? null,
      policyRoot: charterProposal?.policyRoot ?? null,
      delegatedScopes: charterProposal?.delegatedScopes ?? [],
      councilMembers: charterProposal?.councilMembers ?? [],
      councilRoot: charterProposal?.councilRoot ?? null,
      requiredApprovals: charterProposal?.requiredApprovals ?? null,
      effectiveFrom: latestCharter?.effectiveFrom ?? null,
      effectiveUntil: latestCharter?.effectiveUntil ?? null,
      asOf,
      latestGlobalSequence: latestEvent ? this.factByEventRoot(latestEvent.eventRoot).globalSequence : 0,
      latestEventRoot: latestEvent?.eventRoot ?? canopyProofAuditGenesisRoot(),
      safety: rootGovernanceSafety(),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-root-governance-projection-v1", ...seed }),
    };
  }

  getAuthoritySnapshot(): CanopyProofRootGovernanceAuthoritySnapshot {
    return {
      proposalFacts: [...this.proposals],
      attestationFacts: [...this.attestations],
      decisionFacts: [...this.decisions],
    };
  }

  private assertNoOpenProposal() {
    const latestProposal = this.proposals.at(-1);
    if (latestProposal && !this.decisions.some((decision) => decision.proposalId === latestProposal.id)) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_PROPOSAL_PENDING");
    }
  }

  private assertDecisionPredecessor(proposal: CanopyProofRootGovernanceProposalFact) {
    const latestDecision = this.decisions.at(-1);
    if (
      (latestDecision?.id ?? null) !== proposal.predecessorDecisionId ||
      (latestDecision?.decisionRoot ?? null) !== proposal.predecessorDecisionRoot
    ) {
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DECISION_PREDECESSOR_INVALID");
    }
  }

  private assertApprovalQuorum(
    proposal: CanopyProofRootGovernanceProposalFact,
    approvals: readonly CanopyProofRootGovernanceAttestationFact[],
  ) {
    assertUniqueOrganizations(approvals.map((approval) => approval.signer), "approval quorum");
    if (proposal.action === "activate_initial") {
      assertCouncilThreshold(proposal.councilMembers, proposal.requiredApprovals, approvals, "initial council");
      return;
    }
    const charterDecision = this.requireDecision(proposal.targetDecisionId!);
    const predecessorProposal = this.requireProposal(charterDecision.proposalId);
    assertCouncilThreshold(
      predecessorProposal.councilMembers,
      predecessorProposal.requiredApprovals,
      approvals,
      "predecessor council",
    );
    if (proposal.action === "supersede") {
      assertCouncilThreshold(proposal.councilMembers, proposal.requiredApprovals, approvals, "successor council");
    }
  }

  private applicableAttestationMembers(proposal: CanopyProofRootGovernanceProposalFact) {
    if (proposal.action === "activate_initial") return proposal.councilMembers;
    const targetDecision = this.requireDecision(proposal.targetDecisionId!);
    const targetProposal = this.requireProposal(targetDecision.proposalId);
    if (proposal.action !== "supersede") return targetProposal.councilMembers;
    return normalizeCouncilMembers([...targetProposal.councilMembers, ...proposal.councilMembers], true);
  }

  private nextSequence() {
    return this.proposals.length + this.attestations.length + this.decisions.length + 1;
  }

  private latestCharterDecision() {
    return [...this.decisions]
      .reverse()
      .find((decision) => decision.action === "activate_initial" || decision.action === "supersede");
  }

  private requireProposal(id: string) {
    const fact = this.proposals.find((candidate) => candidate.id === id);
    if (!fact) throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_PROPOSAL_NOT_FOUND:${id}`);
    return fact;
  }

  private requireAttestation(id: string) {
    const fact = this.attestations.find((candidate) => candidate.id === id);
    if (!fact) throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_ATTESTATION_NOT_FOUND:${id}`);
    return fact;
  }

  private requireDecision(id: string) {
    const fact = this.decisions.find((candidate) => candidate.id === id);
    if (!fact) throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_DECISION_NOT_FOUND:${id}`);
    return fact;
  }

  private factByEventRoot(eventRoot: string): CanopyProofRootGovernanceFact {
    const fact = [...this.proposals, ...this.attestations, ...this.decisions].find(
      (candidate) => candidate.auditEvent.eventRoot === eventRoot,
    );
    if (!fact) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_EVENT_FACT_MISSING");
    return fact;
  }
}

export function normalizeRootGovernanceMember(input: unknown) {
  return normalizeMember(input);
}

export function rootGovernanceCouncilRoot(members: readonly CanopyProofRootGovernanceMember[]) {
  return merkleRoot(members.map((member) => member.memberRoot).sort());
}

export function rootGovernanceAttestationSigningBytes(input: Readonly<{
  proposalRoot: string;
  decision: (typeof canopyProofRootGovernanceAttestationDecisions)[number];
  signerMemberRoot: string;
  attestedAt: string;
}>) {
  return new TextEncoder().encode(rootGovernanceAttestationSignedPayloadRoot(input));
}

export function rootGovernanceAttestationSignedPayloadRoot(input: Readonly<{
  proposalRoot: string;
  decision: (typeof canopyProofRootGovernanceAttestationDecisions)[number];
  signerMemberRoot: string;
  attestedAt: string;
}>) {
  return hashJson({ kind: "canopyproof-root-governance-attestation-signed-payload-v1", ...input });
}

export function rootGovernanceProposalEvidenceRoot(input: Readonly<{
  evidenceEventRoots: readonly string[];
  charterDocumentRoot: string;
  policyRoot: string;
  councilRoot: string;
  predecessorDecisionRoot: string | null;
  targetDecisionRoot: string | null;
}>) {
  return merkleRoot(
    [
      ...input.evidenceEventRoots,
      input.charterDocumentRoot,
      input.policyRoot,
      input.councilRoot,
      ...(input.predecessorDecisionRoot ? [input.predecessorDecisionRoot] : []),
      ...(input.targetDecisionRoot ? [input.targetDecisionRoot] : []),
    ].sort(),
  );
}

export function rootGovernanceProposalCommandHash(input: Readonly<Record<string, unknown>>) {
  return hashJson({ kind: "canopyproof-root-governance-proposal-command-v1", ...input });
}

export function rootGovernanceProposalFactHash(input: Readonly<Record<string, unknown>>) {
  return hashJson({ kind: "canopyproof-root-governance-proposal-fact-v1", ...input });
}

export function rootGovernanceProposalFactRoot(input: Readonly<{
  proposalHash: string;
  commandHash: string;
  evidenceRoot: string;
  proposerRoot: string;
  predecessorDecisionRoot: string | null;
  targetDecisionRoot: string | null;
}>) {
  return merkleRoot(
    [
      input.proposalHash,
      input.commandHash,
      input.evidenceRoot,
      input.proposerRoot,
      ...(input.predecessorDecisionRoot ? [input.predecessorDecisionRoot] : []),
      ...(input.targetDecisionRoot ? [input.targetDecisionRoot] : []),
    ].sort(),
  );
}

export function rootGovernanceAttestationCommandHash(input: Readonly<Record<string, unknown>>) {
  return hashJson({ kind: "canopyproof-root-governance-attestation-command-v1", ...input });
}

export function rootGovernanceAttestationFactHash(input: Readonly<Record<string, unknown>>) {
  return hashJson({ kind: "canopyproof-root-governance-attestation-fact-v1", ...input });
}

export function rootGovernanceAttestationFactRoot(input: Readonly<{
  attestationHash: string;
  commandHash: string;
  proposalRoot: string;
  signerRoot: string;
  signedPayloadRoot: string;
  verificationReceiptRoot: string;
}>) {
  return merkleRoot(Object.values(input).sort());
}

export function rootGovernanceDecisionCommandHash(input: Readonly<Record<string, unknown>>) {
  return hashJson({ kind: "canopyproof-root-governance-decision-command-v1", ...input });
}

export function rootGovernanceDecisionFactHash(input: Readonly<Record<string, unknown>>) {
  return hashJson({ kind: "canopyproof-root-governance-decision-fact-v1", ...input });
}

export function rootGovernanceDecisionFactRoot(input: Readonly<{
  decisionHash: string;
  commandHash: string;
  proposalRoot: string;
  approvalQuorumRoot: string;
  predecessorDecisionRoot: string | null;
  charterDecisionRoot: string | null;
}>) {
  return merkleRoot(
    [
      input.decisionHash,
      input.commandHash,
      input.proposalRoot,
      input.approvalQuorumRoot,
      ...(input.predecessorDecisionRoot ? [input.predecessorDecisionRoot] : []),
      ...(input.charterDecisionRoot ? [input.charterDecisionRoot] : []),
    ].sort(),
  );
}

export function parseCanopyProofRootGovernanceProposalFact(input: unknown) {
  return proposalFactSchema.parse(input) as CanopyProofRootGovernanceProposalFact;
}

export function parseCanopyProofRootGovernanceAttestationFact(input: unknown) {
  return attestationFactSchema.parse(input) as CanopyProofRootGovernanceAttestationFact;
}

export function parseCanopyProofRootGovernanceDecisionFact(input: unknown) {
  return decisionFactSchema.parse(input) as CanopyProofRootGovernanceDecisionFact;
}

function normalizeCharterFields(parsed: z.output<typeof proposalInputSchema>, proposedAt: string) {
  if (
    !parsed.charterVersion ||
    !parsed.charterDocumentRoot ||
    !parsed.policyRoot ||
    !parsed.delegatedScopes ||
    !parsed.councilMembers ||
    !parsed.requiredApprovals ||
    !parsed.requestedValidUntil
  ) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_CHARTER_FIELDS_REQUIRED");
  }
  const delegatedScopes = normalizeUniqueStrings(parsed.delegatedScopes, "delegated scopes");
  if (JSON.stringify(delegatedScopes) !== JSON.stringify(canopyProofRootGovernanceScopes)) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_SCOPE_INVALID");
  }
  const councilMembers = normalizeCouncilMembers(parsed.councilMembers);
  if (parsed.requiredApprovals > councilMembers.length) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_THRESHOLD_INVALID");
  }
  const requestedValidUntil = canonicalTimestamp(parsed.requestedValidUntil, "requested validity");
  const duration = timestampMs(requestedValidUntil) - timestampMs(proposedAt);
  if (duration <= 0 || duration > 366 * 24 * 60 * 60 * 1_000) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_VALIDITY_INVALID");
  }
  return {
    charterVersion: parsed.charterVersion,
    charterDocumentRoot: parsed.charterDocumentRoot,
    policyRoot: parsed.policyRoot,
    delegatedScopes,
    councilMembers,
    requiredApprovals: parsed.requiredApprovals,
    requestedValidUntil,
  };
}

function assertControlFieldsAbsent(parsed: z.output<typeof proposalInputSchema>) {
  if (
    parsed.charterVersion ||
    parsed.charterDocumentRoot ||
    parsed.policyRoot ||
    parsed.delegatedScopes ||
    parsed.councilMembers ||
    parsed.requiredApprovals ||
    parsed.requestedValidUntil
  ) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_CONTROL_CHARTER_SUBSTITUTION");
  }
}

function normalizeCouncilMembers(input: readonly unknown[], allowOverlap = false) {
  const byParticipant = new Map<string, CanopyProofRootGovernanceMember>();
  for (const value of input) {
    const member = normalizeMember(value);
    const existing = byParticipant.get(member.participantId);
    if (existing) {
      if (allowOverlap && existing.memberRoot === member.memberRoot) continue;
      throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_MEMBER_DUPLICATE");
    }
    byParticipant.set(member.participantId, member);
  }
  const members = [...byParticipant.values()].sort((left, right) => left.participantId.localeCompare(right.participantId));
  if (members.length < 3 || members.length > (allowOverlap ? 18 : 9)) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_COUNCIL_SIZE_INVALID");
  }
  if (!allowOverlap) {
    assertUniqueOrganizations(members, "council");
    assertUniqueValues(members.map((member) => member.membershipId), "council membership");
    assertUniqueValues(members.map((member) => member.keyId), "council key");
    assertUniqueValues(members.map((member) => member.publicKeyFingerprint), "council public key");
  }
  return members;
}

function normalizeMember(input: unknown): CanopyProofRootGovernanceMember {
  assertNoPrivateMaterial(input);
  const parsed = memberSchema.parse(input);
  const publicKeyJwk: CanopyProofRootGovernancePublicJwk = {
    kty: "OKP",
    crv: "Ed25519",
    x: parsed.publicKeyJwk.x,
    key_ops: ["verify"],
    ext: true,
  };
  const publicKeyFingerprint = hashJson({
    kind: "canopyproof-root-governance-public-key-v1",
    publicKeyJwk,
  });
  if (parsed.publicKeyFingerprint && parsed.publicKeyFingerprint !== publicKeyFingerprint) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_PUBLIC_KEY_FINGERPRINT_INVALID");
  }
  const seed = {
    participantId: parsed.participantId,
    participantRoot: parsed.participantRoot,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationRoot: parsed.organizationRoot,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    membershipId: parsed.membershipId,
    membershipRoot: parsed.membershipRoot,
    membershipStatus: parsed.membershipStatus,
    keyId: parsed.keyId,
    publicKeyJwk,
    publicKeyFingerprint,
  };
  const memberRoot = hashJson({ kind: "canopyproof-root-governance-member-v1", ...seed });
  if (parsed.memberRoot && parsed.memberRoot !== memberRoot) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_MEMBER_ROOT_INVALID");
  }
  return { ...seed, memberRoot };
}

async function verifyRootGovernanceEd25519Signature(
  publicKeyJwk: CanopyProofRootGovernancePublicJwk,
  payloadRoot: string,
  signatureBase64Url: string,
) {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk as unknown as JsonWebKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      decodeBase64Url(signatureBase64Url),
      new TextEncoder().encode(payloadRoot),
    );
  } catch {
    return false;
  }
}

function requireMember(
  members: readonly CanopyProofRootGovernanceMember[],
  member: CanopyProofRootGovernanceMember,
  label: string,
) {
  const current = members.find((candidate) => candidate.participantId === member.participantId);
  if (!current || current.memberRoot !== member.memberRoot) {
    throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_${label.toUpperCase().replaceAll(" ", "_")}_INVALID`);
  }
}

function assertCouncilThreshold(
  council: readonly CanopyProofRootGovernanceMember[],
  threshold: number,
  approvals: readonly CanopyProofRootGovernanceAttestationFact[],
  label: string,
) {
  const memberRoots = new Set(council.map((member) => member.memberRoot));
  const counted = approvals.filter((approval) => memberRoots.has(approval.signer.memberRoot));
  if (counted.length < threshold) {
    throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_${label.toUpperCase().replaceAll(" ", "_")}_QUORUM_INCOMPLETE`);
  }
}

function assertUniqueOrganizations(members: readonly CanopyProofRootGovernanceMember[], label: string) {
  assertUniqueValues(members.map((member) => member.organizationId), `${label} organization`);
}

function assertUniqueValues(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_${label.toUpperCase().replaceAll(" ", "_")}_DUPLICATE`);
  }
}

function normalizeUniqueStrings(values: readonly string[], label: string) {
  const normalized = values.map((value) => identifierSchema.parse(value)).sort();
  assertUniqueValues(normalized, label);
  return normalized;
}

function normalizeUniqueRoots(values: readonly string[], label: string) {
  const normalized = values.map((value) => hashSchema.parse(value)).sort();
  assertUniqueValues(normalized, label);
  return normalized;
}

function canonicalTimestamp(input: string, label: string) {
  const parsed = timestampSchema.parse(input);
  const canonical = new Date(parsed).toISOString();
  if (canonical !== parsed) throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_${label.toUpperCase().replaceAll(" ", "_")}_NONCANONICAL`);
  return canonical;
}

function timestampMs(input: string) {
  const value = Date.parse(input);
  if (!Number.isFinite(value)) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_TIMESTAMP_INVALID");
  return value;
}

function compareVersions(left: string, right: string) {
  const parse = (value: string) => value.slice(1).split(".").map(Number);
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function decodeBase64Url(input: string) {
  const base64 =
    input.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(input: Uint8Array) {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function assertNoPrivateMaterial(input: unknown, path = "member") {
  if (!input || typeof input !== "object") return;
  if (Array.isArray(input)) {
    input.forEach((value, index) => assertNoPrivateMaterial(value, `${path}[${index}]`));
    return;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (/^(d|privateKey|private_key|secret|token|password|mnemonic|seedPhrase)$/i.test(key)) {
      throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_PRIVATE_MATERIAL_FORBIDDEN:${path}.${key}`);
    }
    assertNoPrivateMaterial(value, `${path}.${key}`);
  }
}

function assertSafeGovernanceText(value: string, label: string) {
  if (/certified carbon credit|carbon[ -]tax offset|guaranteed (yield|return|impact)|private key|seed phrase|mnemonic/i.test(value)) {
    throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_UNSAFE_${label.toUpperCase().replaceAll(" ", "_")}`);
  }
}

function proposalReplayInput(fact: CanopyProofRootGovernanceProposalFact): ProposeCanopyProofRootGovernanceInput {
  const charter = fact.action === "activate_initial" || fact.action === "supersede";
  return {
    id: fact.id,
    action: fact.action,
    ...(charter
      ? {
          charterVersion: fact.charterVersion,
          charterDocumentRoot: fact.charterDocumentRoot,
          policyRoot: fact.policyRoot,
          delegatedScopes: fact.delegatedScopes,
          councilMembers: fact.councilMembers,
          requiredApprovals: fact.requiredApprovals,
          requestedValidUntil: fact.requestedValidUntil,
        }
      : {}),
    ...(fact.predecessorDecisionId ? { predecessorDecisionId: fact.predecessorDecisionId } : {}),
    ...(fact.targetDecisionId ? { targetDecisionId: fact.targetDecisionId } : {}),
    reasonCode: fact.reasonCode,
    rationale: fact.rationale,
    evidenceEventRoots: fact.evidenceEventRoots,
    proposedAt: fact.proposedAt,
  };
}

function assertReplayEqual(actual: unknown, expected: unknown, label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_${label.toUpperCase()}_REPLAY_INVALID`);
  }
}
