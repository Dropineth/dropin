import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofOrganizationAccreditationAuthorityService,
  organizationAccreditationActorAuthorityRoot,
  parseCanopyProofOrganizationAccreditationApplicationFact,
  parseCanopyProofOrganizationAccreditationControlFact,
  parseCanopyProofOrganizationAccreditationDecisionFact,
  parseCanopyProofOrganizationAccreditationReviewFact,
  type CanopyProofOrganizationAccreditationActorSnapshot,
  type CanopyProofOrganizationAccreditationAuthoritySnapshot,
} from "./organization-accreditation-authority.js";
import type { CanopyProofOrganizationAccreditationGovernanceAuthorityResolver } from "./organization-accreditation-postgres.js";
import {
  CanopyProofRootGovernanceAuthorityService,
  parseCanopyProofRootGovernanceAttestationFact,
  parseCanopyProofRootGovernanceDecisionFact,
  parseCanopyProofRootGovernanceProposalFact,
  type CanopyProofRootGovernanceAuthoritySnapshot,
} from "./root-governance-authority.js";

const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const actorRowSchema = z
  .object({
    participant_id: identifierSchema,
    participant_type: z.literal("human"),
    participant_verification_status: z.literal("verified"),
    participant_root: rootSchema,
    organization_id: identifierSchema,
    organization_verification_status: z.literal("verified"),
    organization_root: rootSchema,
    membership_id: identifierSchema,
    membership_role: z.enum(["owner", "admin", "verifier", "researcher"]),
    membership_status: z.literal("active"),
    membership_root: rootSchema,
  })
  .strict();
const profileRowSchema = z
  .object({ profile_root: rootSchema, verification_status: z.literal("verified") })
  .strict();
const factRowSchema = z.object({ fact_record: z.unknown() }).strict();
const accreditedActorQuerySchema = z
  .object({
    subjectOrganizationId: identifierSchema,
    actorId: identifierSchema,
    actorOrganizationId: identifierSchema,
    actorRole: z.enum(["owner", "admin", "verifier", "researcher"]),
    requiredScope: identifierSchema,
    effectiveAt: z.string().datetime({ offset: true }),
    policyRoot: rootSchema.optional(),
  })
  .strict();

export type CanopyProofCanonicalAccreditedActorQuery = Readonly<
  z.input<typeof accreditedActorQuerySchema>
>;

export type CanopyProofCanonicalAccreditationResolverStatus = Readonly<{
  service: "canopyproof-canonical-organization-accreditation-resolver";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  rootGovernanceBootstrapEnabled: true;
  canonicalAccreditationEnabled: true;
  compatibilityAccreditationFallback: false;
  currentDatabaseStateRequired: true;
  explicitAsOfRequired: true;
}>;

export class CanopyProofCanonicalOrganizationAccreditationResolver {
  getStatus(): CanopyProofCanonicalAccreditationResolverStatus {
    return {
      service: "canopyproof-canonical-organization-accreditation-resolver",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      rootGovernanceBootstrapEnabled: true,
      canonicalAccreditationEnabled: true,
      compatibilityAccreditationFallback: false,
      currentDatabaseStateRequired: true,
      explicitAsOfRequired: true,
    };
  }

  readonly resolve: CanopyProofOrganizationAccreditationGovernanceAuthorityResolver = async (
    query,
    transaction,
  ) => {
    if (query.actorOrganizationId === query.organizationId) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_INDEPENDENT_AUTHORITY_REQUIRED");
    }
    const subjectRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT profile_hash AS profile_root, verification_status
      FROM organizations.organizations WHERE id = ${query.organizationId}
    `);
    if (subjectRows.length !== 1) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_SUBJECT_PROFILE_NOT_FOUND");
    }
    const subject = profileRowSchema.parse(subjectRows[0]);
    if (subject.profile_root !== query.profileRoot) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_SUBJECT_PROFILE_STALE");
    }

    const actor = await this.resolveAccreditedActor(
      {
        subjectOrganizationId: query.organizationId,
        actorId: query.actorId,
        actorOrganizationId: query.actorOrganizationId,
        actorRole: query.actorRole,
        requiredScope: query.requiredScope,
        effectiveAt: query.effectiveAt,
        policyRoot: query.policyRoot,
      },
      transaction,
    );
    return { actor, profileRoot: query.profileRoot, policyRoot: query.policyRoot };
  };

  async resolveAccreditedActor(
    input: CanopyProofCanonicalAccreditedActorQuery,
    transaction: Prisma.TransactionClient,
  ): Promise<CanopyProofOrganizationAccreditationActorSnapshot> {
    const query = accreditedActorQuerySchema.parse(input);
    if (query.actorOrganizationId === query.subjectOrganizationId) {
      throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_INDEPENDENT_AUTHORITY_REQUIRED");
    }
    await setOrganizationContext(transaction, query.actorOrganizationId);
    try {
      const actor = await loadCurrentActor(transaction, query);
      const rootAuthority = await resolveRootGovernanceAuthority(transaction, query, actor);
      if (rootAuthority) return rootAuthority;
      const canonicalAuthority = await resolveCanonicalAccreditationAuthority(
        transaction,
        query,
        actor,
      );
      if (!canonicalAuthority) {
        throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_CANONICAL_AUTHORITY_REQUIRED");
      }
      return canonicalAuthority;
    } finally {
      await setOrganizationContext(transaction, query.subjectOrganizationId);
    }
  }
}

type AccreditedActorQuery = z.output<typeof accreditedActorQuerySchema>;

async function loadCurrentActor(
  transaction: Prisma.TransactionClient,
  query: AccreditedActorQuery,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT
      participant.id AS participant_id,
      participant.participant_type,
      participant.verification_status AS participant_verification_status,
      participant.subject_hash AS participant_root,
      organization.id AS organization_id,
      organization.verification_status AS organization_verification_status,
      organization.profile_hash AS organization_root,
      membership.id AS membership_id,
      membership.role AS membership_role,
      membership.status AS membership_status,
      membership.audit_event_root AS membership_root
    FROM identity.participants participant
    JOIN organizations.organizations organization
      ON organization.id = ${query.actorOrganizationId}
    JOIN organizations.memberships membership
      ON membership.organization_id = organization.id
      AND membership.actor_id = participant.id
      AND membership.role = ${query.actorRole}
    WHERE participant.id = ${query.actorId}
      AND participant.organization_id = organization.id
      AND participant.participant_type = 'human'
      AND participant.verification_status = 'verified'
      AND ${query.actorRole} = ANY(participant.roles)
      AND organization.verification_status = 'verified'
      AND membership.status = 'active'
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_ACTOR_MEMBERSHIP_NOT_CURRENT");
  }
  return actorRowSchema.parse(rows[0]);
}

async function resolveRootGovernanceAuthority(
  transaction: Prisma.TransactionClient,
  query: AccreditedActorQuery,
  actor: z.output<typeof actorRowSchema>,
): Promise<CanopyProofOrganizationAccreditationActorSnapshot | undefined> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config('app.root_governance_access', 'authorized', true)
  `);
  const snapshot = await loadRootGovernanceSnapshot(transaction);
  if (snapshot.decisionFacts.length === 0) return undefined;
  const service = await CanopyProofRootGovernanceAuthorityService.fromAuthoritySnapshot(snapshot);
  const projection = service.getProjection(query.effectiveAt);
  if (
    projection.status !== "active" ||
    (query.policyRoot !== undefined && projection.policyRoot !== query.policyRoot) ||
    !projection.delegatedScopes.includes(query.requiredScope) ||
    !projection.charterDecisionId ||
    !projection.charterDecisionRoot ||
    !projection.effectiveFrom ||
    !projection.effectiveUntil
  ) {
    return undefined;
  }
  const member = projection.councilMembers.find((candidate) => candidate.participantId === query.actorId);
  if (
    !member ||
    member.organizationId !== query.actorOrganizationId ||
    member.role !== query.actorRole ||
    member.participantRoot !== actor.participant_root ||
    member.organizationRoot !== actor.organization_root ||
    member.membershipId !== actor.membership_id ||
    member.membershipRoot !== actor.membership_root
  ) {
    return undefined;
  }
  return actorSnapshot(actor, {
    authoritySource: "root_governance_bootstrap",
    accreditationId: projection.charterDecisionId,
    accreditationDecisionRoot: projection.charterDecisionRoot,
    accreditationProjectionRoot: projection.projectionRoot,
    accreditationValidFrom: projection.effectiveFrom,
    accreditationValidUntil: projection.effectiveUntil,
    accreditationScope: projection.delegatedScopes,
  });
}

async function resolveCanonicalAccreditationAuthority(
  transaction: Prisma.TransactionClient,
  query: AccreditedActorQuery,
  actor: z.output<typeof actorRowSchema>,
): Promise<CanopyProofOrganizationAccreditationActorSnapshot | undefined> {
  const snapshot = await loadAccreditationSnapshot(transaction, query.actorOrganizationId);
  if (snapshot.decisionFacts.length === 0) return undefined;
  const service = CanopyProofOrganizationAccreditationAuthorityService.fromAuthoritySnapshot(snapshot);
  const decisions = [...snapshot.decisionFacts]
    .filter(
      (fact) =>
        fact.decision === "approved" &&
        (query.policyRoot === undefined || fact.policyRoot === query.policyRoot),
    )
    .sort((left, right) => right.organizationAccreditationSequence - left.organizationAccreditationSequence);
  for (const decision of decisions) {
    const projection = service.getProjection(query.actorOrganizationId, decision.applicationId, query.effectiveAt);
    if (
      projection.status !== "approved" ||
      projection.decisionId !== decision.id ||
      projection.decisionRoot !== decision.decisionRoot ||
      !projection.scope.includes(query.requiredScope) ||
      !projection.validFrom ||
      !projection.validUntil
    ) {
      continue;
    }
    return actorSnapshot(actor, {
      authoritySource: "canonical_accreditation",
      accreditationId: decision.id,
      accreditationDecisionRoot: decision.decisionRoot,
      accreditationProjectionRoot: projection.projectionRoot,
      accreditationValidFrom: projection.validFrom,
      accreditationValidUntil: projection.validUntil,
      accreditationScope: projection.scope,
    });
  }
  return undefined;
}

function actorSnapshot(
  actor: z.output<typeof actorRowSchema>,
  authority: Readonly<{
    authoritySource: "root_governance_bootstrap" | "canonical_accreditation";
    accreditationId: string;
    accreditationDecisionRoot: string;
    accreditationProjectionRoot: string;
    accreditationValidFrom: string;
    accreditationValidUntil: string;
    accreditationScope: readonly string[];
  }>,
): CanopyProofOrganizationAccreditationActorSnapshot {
  const seed = {
    id: actor.participant_id,
    participantType: "human" as const,
    role: actor.membership_role,
    verificationStatus: "verified" as const,
    organizationId: actor.organization_id,
    organizationVerificationStatus: "verified" as const,
    participantRoot: actor.participant_root,
    organizationRoot: actor.organization_root,
    membershipId: actor.membership_id,
    membershipStatus: "active" as const,
    membershipRoot: actor.membership_root,
    authoritySource: authority.authoritySource,
    accreditationId: authority.accreditationId,
    accreditationStatus: "approved" as const,
    accreditationDecisionRoot: authority.accreditationDecisionRoot,
    accreditationProjectionRoot: authority.accreditationProjectionRoot,
    accreditationValidFrom: authority.accreditationValidFrom,
    accreditationValidUntil: authority.accreditationValidUntil,
    accreditationScope: [...authority.accreditationScope].sort(),
  };
  return { ...seed, authorityRoot: organizationAccreditationActorAuthorityRoot(seed) };
}

async function loadRootGovernanceSnapshot(
  transaction: Prisma.TransactionClient,
): Promise<CanopyProofRootGovernanceAuthoritySnapshot> {
  const [proposals, attestations, decisions] = await Promise.all([
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM governance.root_governance_proposal_facts ORDER BY global_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM governance.root_governance_attestation_facts ORDER BY global_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM governance.root_governance_decision_facts ORDER BY global_sequence
    `),
  ]);
  return {
    proposalFacts: proposals.map((row) => parseFactRow(row, parseCanopyProofRootGovernanceProposalFact)),
    attestationFacts: attestations.map((row) =>
      parseFactRow(row, parseCanopyProofRootGovernanceAttestationFact),
    ),
    decisionFacts: decisions.map((row) => parseFactRow(row, parseCanopyProofRootGovernanceDecisionFact)),
  };
}

async function loadAccreditationSnapshot(
  transaction: Prisma.TransactionClient,
  organizationId: string,
): Promise<CanopyProofOrganizationAccreditationAuthoritySnapshot> {
  const [applications, reviews, decisions, controls] = await Promise.all([
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM organizations.organization_accreditation_application_facts
      WHERE organization_id = ${organizationId} ORDER BY organization_accreditation_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM organizations.organization_accreditation_review_facts
      WHERE organization_id = ${organizationId} ORDER BY organization_accreditation_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM organizations.organization_accreditation_decision_facts
      WHERE organization_id = ${organizationId} ORDER BY organization_accreditation_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record FROM organizations.organization_accreditation_control_facts
      WHERE organization_id = ${organizationId} ORDER BY organization_accreditation_sequence
    `),
  ]);
  return {
    applicationFacts: applications.map((row) =>
      parseFactRow(row, parseCanopyProofOrganizationAccreditationApplicationFact),
    ),
    reviewFacts: reviews.map((row) => parseFactRow(row, parseCanopyProofOrganizationAccreditationReviewFact)),
    decisionFacts: decisions.map((row) =>
      parseFactRow(row, parseCanopyProofOrganizationAccreditationDecisionFact),
    ),
    controlFacts: controls.map((row) => parseFactRow(row, parseCanopyProofOrganizationAccreditationControlFact)),
  };
}

function parseFactRow<T>(input: unknown, parse: (value: unknown) => T) {
  const row = factRowSchema.parse(input);
  return parse(typeof row.fact_record === "string" ? JSON.parse(row.fact_record) : row.fact_record);
}

async function setOrganizationContext(transaction: Prisma.TransactionClient, organizationIdInput: string) {
  const organizationId = identifierSchema.parse(organizationIdInput);
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config('app.organization_id', ${organizationId}, true)
  `);
}
