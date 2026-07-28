import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofCanonicalOrganizationAccreditationResolver,
} from "./canonical-organization-accreditation-resolver.js";
import {
  PrismaCanopyProofEnvironmentalProofLifecycleRepository,
} from "./environmental-proof-lifecycle-postgres.js";
import {
  PrismaCanopyProofFundingAccountabilityRepository,
} from "./funding-accountability-postgres.js";
import { organizationAccreditationActorAuthorityRoot } from "./organization-accreditation-authority.js";
import {
  buildCanopyProofProjectLifecycleFundingSource,
  buildCanopyProofProjectLifecycleMonitoringSource,
  buildCanopyProofProjectLifecycleProofSource,
  type CanopyProofProjectLifecycleActorSnapshot,
} from "./project-lifecycle-authority.js";
import type {
  CanopyProofProjectLifecycleAuthorityQuery,
  CanopyProofProjectLifecycleAuthorityResolver,
  CanopyProofProjectLifecycleCurrentAuthority,
} from "./project-lifecycle-postgres.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(HASH_PATTERN);
const registeredProjectStatusSchema = z.enum([
  "submitted",
  "under_review",
  "active",
  "monitored",
]);
const projectStatusSchema = z.enum([
  "submitted",
  "under_review",
  "active",
  "monitored",
  "challenged",
  "suspended",
  "archived",
]);
const subjectActorRowSchema = z
  .object({
    participant_id: identifierSchema,
    participant_root: rootSchema,
    organization_id: identifierSchema,
    organization_root: rootSchema,
    membership_id: identifierSchema,
    membership_role: z.enum(["owner", "admin", "verifier", "researcher"]),
    membership_root: rootSchema,
  })
  .strict();
const projectAuthorityRowSchema = z
  .object({
    organization_id: identifierSchema,
    registered_project_root: rootSchema,
    registered_project_status: registeredProjectStatusSchema,
    current_project_root: rootSchema,
    current_project_status: projectStatusSchema,
  })
  .strict();
const policyRowSchema = z.object({ is_current: z.boolean() }).strict();
const verifiedTransitionRowSchema = z
  .object({ transitioned_at: z.coerce.date() })
  .strict();
const monitoringRowSchema = z
  .object({
    state: z.enum(["submitted", "accepted", "needs_review", "challenged"]),
    observed_at: z.coerce.date(),
    monitoring_root: rootSchema,
  })
  .strict();

export type CanopyProofCanonicalProjectLifecycleResolverStatus = Readonly<{
  service: "canopyproof-canonical-project-lifecycle-source-resolver";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  callerTransactionRequired: true;
  currentHumanAuthorityRequired: true;
  completeSourceSetRequired: true;
  closureAuthorityAvailable: false;
  restorationAuthorityAvailable: false;
}>;

type ProjectAuthority = z.output<typeof projectAuthorityRowSchema>;
type FundingProjectionReader = Pick<
  PrismaCanopyProofFundingAccountabilityRepository,
  "resolveCurrentProjectionInTransaction"
>;
type ProofLifecycleReader = Pick<
  PrismaCanopyProofEnvironmentalProofLifecycleRepository,
  "listProjectLifecyclesInTransaction"
>;
type AccreditedActorReader = Pick<
  CanopyProofCanonicalOrganizationAccreditationResolver,
  "resolveAccreditedActor"
>;

export class CanopyProofCanonicalProjectLifecycleAuthorityResolver {
  private constructor(
    private readonly fundingRepository: FundingProjectionReader,
    private readonly proofLifecycleRepository: ProofLifecycleReader,
    private readonly accreditationResolver: AccreditedActorReader,
  ) {}

  static fromPrisma(prisma: PrismaClient) {
    return new CanopyProofCanonicalProjectLifecycleAuthorityResolver(
      new PrismaCanopyProofFundingAccountabilityRepository(prisma),
      new PrismaCanopyProofEnvironmentalProofLifecycleRepository(prisma),
      new CanopyProofCanonicalOrganizationAccreditationResolver(),
    );
  }

  static fromDependencies(input: Readonly<{
    fundingRepository: FundingProjectionReader;
    proofLifecycleRepository: ProofLifecycleReader;
    accreditationResolver: AccreditedActorReader;
  }>) {
    return new CanopyProofCanonicalProjectLifecycleAuthorityResolver(
      input.fundingRepository,
      input.proofLifecycleRepository,
      input.accreditationResolver,
    );
  }

  getStatus(): CanopyProofCanonicalProjectLifecycleResolverStatus {
    return {
      service: "canopyproof-canonical-project-lifecycle-source-resolver",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      callerTransactionRequired: true,
      currentHumanAuthorityRequired: true,
      completeSourceSetRequired: true,
      closureAuthorityAvailable: false,
      restorationAuthorityAvailable: false,
    };
  }

  readonly resolve: CanopyProofProjectLifecycleAuthorityResolver = async (
    query,
    transaction,
  ) => {
    assertCanonicalTimestamp(query.effectiveAt);
    const project = await resolveProjectAuthority(transaction, query);
    await assertPolicyAuthority(transaction, query);
    const actor = await this.resolveActor(transaction, query);

    if (query.operation === "control" && query.controlAction === "restore") {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_RESTORATION_AUTHORITY_UNAVAILABLE");
    }

    const sourceAuthorityRoot = await this.resolveSourceAuthorityRoot(
      transaction,
      query,
      project,
    );
    return {
      actor,
      projectAuthorityRoot: project.registered_project_root,
      projectStatus: project.registered_project_status,
      policyRoot: query.policyRoot,
      sourceAuthorityRoot,
      restorationAuthorityRoot: null,
    } satisfies CanopyProofProjectLifecycleCurrentAuthority;
  };

  private async resolveActor(
    transaction: Prisma.TransactionClient,
    query: CanopyProofProjectLifecycleAuthorityQuery,
  ) {
    if (query.operation === "register") {
      return resolveSubjectActor(transaction, query);
    }
    return this.accreditationResolver.resolveAccreditedActor(
      {
        subjectOrganizationId: query.organizationId,
        actorId: query.actorId,
        actorOrganizationId: query.actorOrganizationId,
        actorRole: query.actorRole,
        requiredScope: query.requiredScope,
        effectiveAt: query.effectiveAt,
      },
      transaction,
    );
  }

  private async resolveSourceAuthorityRoot(
    transaction: Prisma.TransactionClient,
    query: CanopyProofProjectLifecycleAuthorityQuery,
    project: ProjectAuthority,
  ): Promise<string | null> {
    if (query.operation !== "transition") {
      if (query.sourceKind !== null || query.sourceAuthorityRoot !== null) {
        throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_UNEXPECTED_SOURCE_AUTHORITY");
      }
      return null;
    }
    assertForwardProjectAuthority(project);
    if (query.sourceKind === "closure") {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_CLOSURE_AUTHORITY_UNAVAILABLE");
    }
    if (query.sourceKind === "funding") {
      return this.resolveFundingSource(transaction, query, project);
    }
    if (query.sourceKind === "proof") {
      return this.resolveProofSource(transaction, query, project);
    }
    if (query.sourceKind === "monitoring") {
      return this.resolveMonitoringSource(transaction, query, project);
    }
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_TRANSITION_SOURCE_REQUIRED");
  }

  private async resolveFundingSource(
    transaction: Prisma.TransactionClient,
    query: CanopyProofProjectLifecycleAuthorityQuery,
    project: ProjectAuthority,
  ) {
    if (query.transitionFromStage !== "PROPOSED" || query.transitionToStage !== "FUNDED") {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_FUNDING_EDGE_INVALID");
    }
    const projection = await this.fundingRepository.resolveCurrentProjectionInTransaction(
      transaction,
      {
        organizationId: query.organizationId,
        projectId: query.projectId,
        evaluatedAt: query.effectiveAt,
      },
    );
    if (
      !projection ||
      projection.state !== "active" ||
      projection.operationalTotals.allocatedCents <= 0
    ) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_ACTIVE_FUNDING_REQUIRED");
    }
    return buildCanopyProofProjectLifecycleFundingSource({
      projectionRoots: [projection.publicProjection.projectionRoot],
      currentRoots: canonicalRoots([
        projection.currentRoot,
        project.current_project_root,
      ]),
      allocatedCents: projection.operationalTotals.allocatedCents,
      resolvedAt: query.effectiveAt,
    }).sourceAuthorityRoot;
  }

  private async resolveProofSource(
    transaction: Prisma.TransactionClient,
    query: CanopyProofProjectLifecycleAuthorityQuery,
    project: ProjectAuthority,
  ) {
    if (query.transitionFromStage !== "FUNDED" || query.transitionToStage !== "VERIFIED") {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_PROOF_EDGE_INVALID");
    }
    const projectProjections = await this.proofLifecycleRepository.listProjectLifecyclesInTransaction(
      transaction,
      {
        organizationId: query.organizationId,
        projectId: query.projectId,
        evaluatedAt: query.effectiveAt,
      },
    );
    if (
      projectProjections.some(({ projection }) =>
        projection.state === "challenged" || projection.state === "suspended",
      )
    ) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_ADVERSE_PROOF_AUTHORITY_PRESENT");
    }
    const active = projectProjections.filter(({ projection }) => projection.state === "active");
    if (active.length === 0) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_ACTIVE_PROOF_REQUIRED");
    }
    const lifecycleProjectionRoots = canonicalRoots(
      active.map(({ projection }) => projection.projectionRoot),
    );
    const currentRoots = canonicalRoots([
      project.current_project_root,
      ...active.flatMap(({ governedRecordProjectionRoot, mrvGraphRoot }) => [
        governedRecordProjectionRoot,
        mrvGraphRoot,
      ]),
    ]);
    return buildCanopyProofProjectLifecycleProofSource({
      lifecycleProjectionRoots,
      currentRoots,
      resolvedAt: query.effectiveAt,
    }).sourceAuthorityRoot;
  }

  private async resolveMonitoringSource(
    transaction: Prisma.TransactionClient,
    query: CanopyProofProjectLifecycleAuthorityQuery,
    project: ProjectAuthority,
  ) {
    if (
      query.transitionFromStage !== "VERIFIED" ||
      query.transitionToStage !== "LONG_TERM_OBSERVATION"
    ) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_MONITORING_EDGE_INVALID");
    }
    const verifiedRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT transitioned_at
      FROM projects.project_lifecycle_transition_facts
      WHERE organization_id = ${query.organizationId}
        AND project_id = ${query.projectId}
        AND generation = ${query.generation}
        AND to_stage = 'VERIFIED'
        AND transitioned_at <= ${asDate(query.effectiveAt)}
      ORDER BY project_sequence DESC, id DESC
      LIMIT 1
    `);
    if (verifiedRows.length !== 1) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_VERIFIED_SOURCE_NOT_FOUND");
    }
    const verified = verifiedTransitionRowSchema.parse(verifiedRows[0]);
    const monitoringRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT state, observed_at, monitoring_root
      FROM projects.monitoring_events
      WHERE organization_id = ${query.organizationId}
        AND project_id = ${query.projectId}
        AND observed_at > ${verified.transitioned_at}
        AND observed_at <= ${asDate(query.effectiveAt)}
      ORDER BY observed_at, id
    `);
    if (monitoringRows.length > 1_024) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_MONITORING_SOURCE_LIMIT_EXCEEDED");
    }
    const monitoring = monitoringRows.map((row) => monitoringRowSchema.parse(row));
    if (monitoring.length === 0 || monitoring.some((event) => event.state !== "accepted")) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_ACCEPTED_MONITORING_REQUIRED");
    }
    const latest = monitoring.at(-1)!;
    if (
      project.current_project_status !== "monitored" ||
      latest.monitoring_root !== project.current_project_root
    ) {
      throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_MONITORING_PROJECT_AUTHORITY_STALE");
    }
    return buildCanopyProofProjectLifecycleMonitoringSource({
      monitoringEventRoots: canonicalRoots(
        monitoring.map((event) => event.monitoring_root),
      ),
      latestObservedAt: latest.observed_at.toISOString(),
      monitoringPlanRoot: query.monitoringPlanRoot,
      resolvedAt: query.effectiveAt,
    }).sourceAuthorityRoot;
  }
}

async function resolveProjectAuthority(
  transaction: Prisma.TransactionClient,
  query: CanopyProofProjectLifecycleAuthorityQuery,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT
      project.organization_id,
      project.project_root AS registered_project_root,
      project.status AS registered_project_status,
      current.project_root AS current_project_root,
      current.status AS current_project_status
    FROM projects.projects project
    JOIN LATERAL projects.current_authority(project.id) current ON true
    WHERE project.id = ${query.projectId}
      AND project.organization_id = ${query.organizationId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_PROJECT_AUTHORITY_NOT_FOUND");
  }
  const project = projectAuthorityRowSchema.parse(rows[0]);
  if (
    project.registered_project_root !== query.projectAuthorityRoot ||
    project.registered_project_status !== query.projectStatus
  ) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_REGISTRATION_PROJECT_AUTHORITY_STALE");
  }
  if (
    query.operation === "register" &&
    (project.current_project_root !== query.projectAuthorityRoot ||
      project.current_project_status !== query.projectStatus)
  ) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_CURRENT_PROJECT_AUTHORITY_STALE");
  }
  return project;
}

async function assertPolicyAuthority(
  transaction: Prisma.TransactionClient,
  query: CanopyProofProjectLifecycleAuthorityQuery,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT NOT EXISTS (
      SELECT 1
      FROM governance.proof_policy_versions successor
      WHERE successor.supersedes_policy_id = policy.id
        AND successor.created_at <= ${asDate(query.effectiveAt)}
    ) AS is_current
    FROM governance.proof_policy_versions policy
    WHERE policy.id = ${query.policyId}
      AND policy.policy_root = ${query.policyRoot}
      AND policy.subject = 'project_lifecycle'
      AND policy.created_at <= ${asDate(query.effectiveAt)}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_POLICY_AUTHORITY_NOT_FOUND");
  }
  const policy = policyRowSchema.parse(rows[0]);
  const emergencyControl =
    query.operation === "control" &&
    query.controlAction !== null &&
    ["challenge", "suspend", "revoke"].includes(query.controlAction);
  if (!policy.is_current && !emergencyControl) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_POLICY_AUTHORITY_SUPERSEDED");
  }
}

async function resolveSubjectActor(
  transaction: Prisma.TransactionClient,
  query: CanopyProofProjectLifecycleAuthorityQuery,
): Promise<CanopyProofProjectLifecycleActorSnapshot> {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT
      participant.id AS participant_id,
      participant.subject_hash AS participant_root,
      organization.id AS organization_id,
      organization.profile_hash AS organization_root,
      membership.id AS membership_id,
      membership.role AS membership_role,
      membership.audit_event_root AS membership_root
    FROM identity.participants participant
    JOIN organizations.organizations organization
      ON organization.id = ${query.organizationId}
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
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_SUBJECT_ACTOR_NOT_CURRENT");
  }
  const row = subjectActorRowSchema.parse(rows[0]);
  const seed = {
    id: row.participant_id,
    participantType: "human" as const,
    role: row.membership_role,
    verificationStatus: "verified" as const,
    organizationId: row.organization_id,
    organizationVerificationStatus: "verified" as const,
    participantRoot: row.participant_root,
    organizationRoot: row.organization_root,
    membershipId: row.membership_id,
    membershipStatus: "active" as const,
    membershipRoot: row.membership_root,
    authoritySource: "subject_membership" as const,
    accreditationScope: [] as const,
  };
  return {
    ...seed,
    authorityRoot: organizationAccreditationActorAuthorityRoot(seed),
  };
}

function assertForwardProjectAuthority(project: ProjectAuthority) {
  if (["challenged", "suspended", "archived"].includes(project.current_project_status)) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_CURRENT_PROJECT_ADVERSE");
  }
}

function canonicalRoots(values: readonly string[]) {
  const roots = [...new Set(values.map((value) => rootSchema.parse(value)))].sort();
  if (roots.length === 0) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_SOURCE_ROOT_SET_EMPTY");
  }
  return roots;
}

function assertCanonicalTimestamp(value: string) {
  const date = asDate(value);
  if (date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_AUTHORITY_TIMESTAMP_NON_CANONICAL");
  }
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_AUTHORITY_TIMESTAMP_INVALID");
  }
  return date;
}
