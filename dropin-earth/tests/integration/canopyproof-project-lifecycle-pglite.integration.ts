import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofCanonicalProjectLifecycleAuthorityResolver,
} from "../../services/api/src/domain/canopyproof/canonical-project-lifecycle-resolver.js";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  CanopyProofMethodologyGovernanceAuthorityService,
  type CanopyProofGovernedPolicyAuthority,
} from "../../services/api/src/domain/canopyproof/methodology-governance-authority.js";
import {
  buildCanopyProofProjectLifecycleActorAuthorityRoot,
  buildCanopyProofProjectLifecycleClosureSource,
  buildCanopyProofProjectLifecycleControl,
  buildCanopyProofProjectLifecycleFundingSource,
  buildCanopyProofProjectLifecycleMonitoringSource,
  buildCanopyProofProjectLifecycleProofSource,
  buildCanopyProofProjectLifecycleRegistration,
  buildCanopyProofProjectLifecycleReview,
  buildCanopyProofProjectLifecycleTransition,
  canopyProofProjectLifecycleScopes,
  replayCanopyProofProjectLifecycle,
  type CanopyProofProjectLifecycleActorSnapshot,
  type CanopyProofProjectLifecycleRecord,
  type CanopyProofProjectLifecycleRegistrationInput,
} from "../../services/api/src/domain/canopyproof/project-lifecycle-authority.js";
import {
  PrismaCanopyProofProjectLifecycleRepository,
  type CanopyProofProjectLifecycleAuthorityResolver,
} from "../../services/api/src/domain/canopyproof/project-lifecycle-postgres.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";

const baseSql = readFileSync(
  join(process.cwd(), "services/api/prisma/canopyproof-os.sql"),
  "utf8",
);
const accreditationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/organization-accreditation-authority.sql"),
  "utf8",
);
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/project-lifecycle-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/project-lifecycle-authority.rollback.sql"),
  "utf8",
);
const sourceResolverSql = readFileSync(
  join(process.cwd(), "services/api/prisma/project-lifecycle-source-resolver.sql"),
  "utf8",
);
const sourceResolverRollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/project-lifecycle-source-resolver.rollback.sql"),
  "utf8",
);

const organizationId = "org_project_lifecycle_pglite";
const projectId = "project_lifecycle_pglite";
const proposer = actor("project_lifecycle_proposer", organizationId, "owner", [], true);
const reviewer = actor(
  "project_lifecycle_reviewer",
  "org_project_lifecycle_review",
  "researcher",
  [canopyProofProjectLifecycleScopes.review],
);
const governor = actor(
  "project_lifecycle_governor",
  "org_project_lifecycle_governance",
  "verifier",
  [canopyProofProjectLifecycleScopes.govern],
);
const challenger = actor(
  "project_lifecycle_challenger",
  "org_project_lifecycle_challenge",
  "verifier",
  [canopyProofProjectLifecycleScopes.govern],
);
const restorer = actor(
  "project_lifecycle_restorer",
  "org_project_lifecycle_restore",
  "verifier",
  [canopyProofProjectLifecycleScopes.govern],
);
const actors = new Map(
  [proposer, reviewer, governor, challenger, restorer].map((value) => [value.id, value] as const),
);
const projectFixture = new CanopyProofProjectRegistryService().registerProject(
  {
    id: projectId,
    organizationId,
    title: "Canonical Lifecycle PGlite Project",
    projectType: "reforestation",
    regionId: "project-lifecycle-pglite-region",
    location: { latitude: 5.6, longitude: -0.2, areaHectares: 50 },
    targetTreeCount: 12_500,
    biodiversityIndicators: ["native_species_richness"],
    waterIndicators: ["soil_moisture"],
    climateRiskIndicators: ["drought_exposure"],
    monitoringCadenceDays: 30,
    status: "submitted",
    createdAt: "2026-07-18T23:00:00.000Z",
  },
  proposer.id,
  "owner",
);

test("project lifecycle PostgreSQL authority is deterministic, append-only, tenant-bound, and replayable", async () => {
  const db = await createDatabase();
  try {
    const fixture = lifecycleFixture();
    const repository = new PrismaCanopyProofProjectLifecycleRepository(pglitePrismaClient(db));
    const resolver = currentAuthorityResolver();

    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-project-lifecycle-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      canonicalAccreditationRequired: true,
      compatibilityProjectStatusIsInputOnly: true,
      adverseStateNeverFallsBack: true,
    });
    await assertSqlParity(db, fixture.history);

    assert.deepEqual(
      await repository.commitRegistration(
        fixture.registration,
        "project-lifecycle-registration-command",
        resolver,
      ),
      fixture.registration,
    );
    assert.deepEqual(
      await repository.commitRegistration(
        fixture.registration,
        "project-lifecycle-registration-command",
        resolver,
      ),
      fixture.registration,
    );

    const conflictingRegistration = buildCanopyProofProjectLifecycleRegistration(
      registrationInput({ targetTreeCount: 12_501 }),
      proposer,
    );
    await assert.rejects(
      repository.commitRegistration(
        conflictingRegistration,
        "project-lifecycle-registration-command",
        resolver,
      ),
      /IDEMPOTENCY_CONFLICT/,
    );

    await repository.commitReview(fixture.review, "project-lifecycle-review-command", resolver);
    for (const [index, transition] of fixture.transitions.entries()) {
      await repository.commitTransition(
        transition,
        `project-lifecycle-transition-${index + 1}`,
        resolver,
      );
    }

    const history = await repository.getHistory(organizationId, projectId, proposer.id);
    assert.deepEqual(history, fixture.history);
    assert.deepEqual(
      await repository.getProjection(
        organizationId,
        projectId,
        "2026-07-19T07:00:00.000Z",
        proposer.id,
      ),
      replayCanopyProofProjectLifecycle(fixture.history, "2026-07-19T07:00:00.000Z"),
    );
    assert.equal(recordCount(history, "registration"), 1);
    assert.equal(recordCount(history, "review"), 1);
    assert.equal(recordCount(history, "transition"), 4);

    await setTenant(db, organizationId, proposer.id);
    await assert.rejects(
      db.query(
        `UPDATE projects.project_lifecycle_registration_facts
         SET policy_root = $2 WHERE id = $1`,
        [fixture.registration.id, root("tampered-policy")],
      ),
      /append-only|cannot be updated or deleted/i,
    );
    await assert.rejects(
      db.query(`DELETE FROM projects.project_lifecycle_transition_facts WHERE id = $1`, [
        fixture.transitions[0]!.id,
      ]),
      /append-only|cannot be updated or deleted/i,
    );
    await assertTenantIsolation(db);
    await assert.rejects(
      db.exec(rollbackSql),
      /CANOPYPROOF_PROJECT_LIFECYCLE_ROLLBACK_BLOCKED_FACTS_EXIST/,
    );
  } finally {
    await db.close();
  }
});

test("project lifecycle current authority drift rejects atomically", async () => {
  const db = await createDatabase();
  try {
    const fixture = lifecycleFixture();
    const repository = new PrismaCanopyProofProjectLifecycleRepository(pglitePrismaClient(db));
    await repository.commitRegistration(
      fixture.registration,
      "project-lifecycle-drift-registration",
      currentAuthorityResolver(),
    );

    await assert.rejects(
      repository.commitReview(
        fixture.review,
        "project-lifecycle-stale-resolver-review",
        currentAuthorityResolver({ projectAuthorityRoot: root("stale-project-authority") }),
      ),
      /CURRENT_AUTHORITY_STALE/,
    );
    assert.deepEqual(await lifecycleCounts(db), {
      registrations: 1,
      reviews: 0,
      transitions: 0,
      controls: 0,
      events: 1,
      receipts: 1,
    });

    await db.query(
      `UPDATE organizations.memberships SET status = 'suspended', updated_at = $2 WHERE id = $1`,
      [reviewer.membershipId, "2026-07-19T01:30:00.000Z"],
    );
    await assert.rejects(
      repository.commitReview(
        fixture.review,
        "project-lifecycle-suspended-reviewer",
        currentAuthorityResolver(),
      ),
      /REVIEW_AUTHORITY_INVALID/,
    );
    assert.deepEqual(await lifecycleCounts(db), {
      registrations: 1,
      reviews: 0,
      transitions: 0,
      controls: 0,
      events: 1,
      receipts: 1,
    });
  } finally {
    await db.close();
  }
});

test("canonical project lifecycle source resolver commits only current governed registration authority", async () => {
  const db = await createDatabase();
  try {
    const policy = await insertProjectLifecyclePolicy(db);
    const registration = buildCanopyProofProjectLifecycleRegistration(
      {
        ...registrationInput(),
        policyId: policy.id,
        policyRoot: policy.policyRoot,
      },
      proposer,
    );
    const prisma = pglitePrismaClient(db);
    const repository = new PrismaCanopyProofProjectLifecycleRepository(prisma);
    const resolver = CanopyProofCanonicalProjectLifecycleAuthorityResolver.fromPrisma(prisma);

    await updateMembershipStatus(
      db,
      proposer.membershipId,
      "suspended",
      "2026-07-19T00:30:00.000Z",
    );
    await assert.rejects(
      repository.commitRegistration(
        registration,
        "canonical-project-lifecycle-registration-revoked",
        resolver.resolve,
      ),
      /SUBJECT_ACTOR_NOT_CURRENT/,
    );
    assert.deepEqual(await lifecycleCounts(db), {
      registrations: 0,
      reviews: 0,
      transitions: 0,
      controls: 0,
      events: 0,
      receipts: 0,
    });

    await updateMembershipStatus(
      db,
      proposer.membershipId,
      "active",
      "2026-07-19T00:31:00.000Z",
    );
    assert.deepEqual(
      await repository.commitRegistration(
        registration,
        "canonical-project-lifecycle-registration-current",
        resolver.resolve,
      ),
      registration,
    );
    await assert.rejects(
      db.exec(sourceResolverRollbackSql),
      /CANOPYPROOF_PROJECT_LIFECYCLE_SOURCE_RESOLVER_ROLLBACK_BLOCKED_POLICY_EXISTS/,
    );
  } finally {
    await db.close();
  }
});

test("project lifecycle challenge remains adverse until an independent restore is committed", async () => {
  const db = await createDatabase();
  try {
    const fixture = lifecycleFixture();
    const repository = new PrismaCanopyProofProjectLifecycleRepository(pglitePrismaClient(db));
    const resolver = currentAuthorityResolver();
    await repository.commitRegistration(
      fixture.registration,
      "project-lifecycle-control-registration",
      resolver,
    );
    await repository.commitReview(fixture.review, "project-lifecycle-control-review", resolver);
    await repository.commitTransition(
      fixture.transitions[0]!,
      "project-lifecycle-control-funding",
      resolver,
    );

    const fundedHistory = fixture.history.slice(0, 3);
    const challenge = buildCanopyProofProjectLifecycleControl(
      {
        action: "challenge",
        reasonCode: "current_source_anomaly",
        reasonRoot: root("challenge-reason"),
        rationale: "A current source anomaly must remain visible until independently resolved.",
        controlledAt: "2026-07-19T03:30:00.000Z",
      },
      challenger,
      fundedHistory,
    );
    const challengedHistory: CanopyProofProjectLifecycleRecord[] = [
      ...fundedHistory,
      { kind: "control", control: challenge },
    ];
    const restore = buildCanopyProofProjectLifecycleControl(
      {
        action: "restore",
        reasonCode: "source_anomaly_resolved",
        reasonRoot: root("restore-reason"),
        rationale: "An independent governor re-resolved the exact adverse source before restoration.",
        restoresControlRoot: challenge.controlRoot,
        restorationAuthorityRoot: root("restoration-authority"),
        controlledAt: "2026-07-19T03:45:00.000Z",
      },
      restorer,
      challengedHistory,
    );
    await assertSqlParity(db, [
      { kind: "control", control: challenge },
      { kind: "control", control: restore },
    ]);
    await repository.commitControl(challenge, "project-lifecycle-challenge", resolver);
    assert.equal(
      (await repository.getProjection(
        organizationId,
        projectId,
        "2026-07-19T03:30:00.000Z",
        proposer.id,
      ))?.stage,
      "CHALLENGED",
    );
    await repository.commitControl(restore, "project-lifecycle-restore", resolver);
    const restored = await repository.getProjection(
      organizationId,
      projectId,
      "2026-07-19T03:45:00.000Z",
      proposer.id,
    );
    assert.equal(restored?.stage, "FUNDED");
    assert.equal(restored?.underlyingStage, "FUNDED");
    assert.equal(recordCount(await repository.getHistory(organizationId, projectId, proposer.id), "control"), 2);
  } finally {
    await db.close();
  }
});

test("project lifecycle serializes competing transitions and preserves one canonical successor", async () => {
  const db = await createDatabase();
  try {
    const fixture = lifecycleFixture();
    const repository = new PrismaCanopyProofProjectLifecycleRepository(pglitePrismaClient(db));
    const resolver = currentAuthorityResolver();
    await repository.commitRegistration(
      fixture.registration,
      "project-lifecycle-race-registration",
      resolver,
    );
    await repository.commitReview(fixture.review, "project-lifecycle-race-review", resolver);

    const history = fixture.history.slice(0, 2);
    const competing = buildCanopyProofProjectLifecycleTransition(
      {
        fromStage: "PROPOSED",
        toStage: "FUNDED",
        source: buildCanopyProofProjectLifecycleFundingSource({
          projectionRoots: [root("competing-funding-projection")],
          currentRoots: [root("competing-funding-current")],
          allocatedCents: 40_000,
          resolvedAt: "2026-07-19T03:00:00.000Z",
        }),
        reasonCode: "competing_funding_source",
        rationale: "A competing source cannot create a second canonical successor for one project sequence.",
        transitionedAt: "2026-07-19T03:00:00.000Z",
      },
      challenger,
      history,
    );
    const outcomes = await Promise.allSettled([
      repository.commitTransition(
        fixture.transitions[0]!,
        "project-lifecycle-race-primary",
        resolver,
      ),
      repository.commitTransition(competing, "project-lifecycle-race-competing", resolver),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);

    const stored = await repository.getHistory(organizationId, projectId, proposer.id);
    assert.equal(recordCount(stored, "transition"), 1);
    assert.equal(
      replayCanopyProofProjectLifecycle(stored, "2026-07-19T03:00:00.000Z")?.stage,
      "FUNDED",
    );
    assert.deepEqual(await lifecycleCounts(db), {
      registrations: 1,
      reviews: 1,
      transitions: 1,
      controls: 0,
      events: 3,
      receipts: 3,
    });
  } finally {
    await db.close();
  }
});

test("project lifecycle migration is reversible only before durable facts exist", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(accreditationSql);
    await db.exec(migrationSql);
    await db.exec(rollbackSql);
    const relation = await db.query<{ relation: string | null }>(
      `SELECT to_regclass('projects.project_lifecycle_registration_facts')::text AS relation`,
    );
    assert.equal(relation.rows[0]?.relation, null);
  } finally {
    await db.close();
  }
});

function lifecycleFixture() {
  const registration = buildCanopyProofProjectLifecycleRegistration(registrationInput(), proposer);
  const history: CanopyProofProjectLifecycleRecord[] = [{ kind: "registration", registration }];
  const review = buildCanopyProofProjectLifecycleReview(
    {
      registrationId: registration.id,
      registrationRoot: registration.registrationRoot,
      decision: "approve",
      reasonCode: "independent_review_passed",
      rationale: "An independent accredited human reviewed the exact bounded project registration.",
      reviewedAt: "2026-07-19T02:00:00.000Z",
    },
    reviewer,
    history,
  );
  history.push({ kind: "review", review });

  const transitionInputs = [
    {
      fromStage: "PROPOSED" as const,
      toStage: "FUNDED" as const,
      source: buildCanopyProofProjectLifecycleFundingSource({
        projectionRoots: [root("funding-projection")],
        currentRoots: [root("funding-current")],
        allocatedCents: 25_000,
        resolvedAt: "2026-07-19T03:00:00.000Z",
      }),
      reasonCode: "funding_confirmed",
      rationale: "Current governed funding authorities justify this bounded canonical transition.",
      transitionedAt: "2026-07-19T03:00:00.000Z",
    },
    {
      fromStage: "FUNDED" as const,
      toStage: "VERIFIED" as const,
      source: buildCanopyProofProjectLifecycleProofSource({
        lifecycleProjectionRoots: [root("proof-projection")],
        currentRoots: [root("proof-current")],
        resolvedAt: "2026-07-19T04:00:00.000Z",
      }),
      reasonCode: "proof_current",
      rationale: "Current environmental proof authorities justify this bounded canonical transition.",
      transitionedAt: "2026-07-19T04:00:00.000Z",
    },
    {
      fromStage: "VERIFIED" as const,
      toStage: "LONG_TERM_OBSERVATION" as const,
      source: buildCanopyProofProjectLifecycleMonitoringSource({
        monitoringEventRoots: [root("monitoring-event")],
        latestObservedAt: "2026-07-19T04:30:00.000Z",
        monitoringPlanRoot: registration.monitoringPlan.monitoringPlanRoot,
        resolvedAt: "2026-07-19T05:00:00.000Z",
      }),
      reasonCode: "monitoring_current",
      rationale: "Current post-verification monitoring justifies long-term observation status.",
      transitionedAt: "2026-07-19T05:00:00.000Z",
    },
    {
      fromStage: "LONG_TERM_OBSERVATION" as const,
      toStage: "CLOSED" as const,
      source: buildCanopyProofProjectLifecycleClosureSource({
        closureEvidenceRoots: [root("closure-evidence")],
        finalMonitoringRoot: root("final-monitoring"),
        closureReviewRoot: root("closure-review"),
        resolvedAt: "2026-07-19T06:00:00.000Z",
      }),
      reasonCode: "closure_approved",
      rationale: "Independent closure evidence and final monitoring complete the bounded lifecycle.",
      transitionedAt: "2026-07-19T06:00:00.000Z",
    },
  ];
  const transitions = transitionInputs.map((input) => {
    const transition = buildCanopyProofProjectLifecycleTransition(input, governor, history);
    history.push({ kind: "transition", transition });
    return transition;
  });
  return { registration, review, transitions, history };
}

function registrationInput(
  overrides: Readonly<{ targetTreeCount?: number }> = {},
): CanopyProofProjectLifecycleRegistrationInput {
  return {
    organizationId,
    projectId,
    projectAuthorityRoot: projectFixture.projectRoot,
    projectStatus: projectFixture.status,
    baseline: {
      baselineId: "baseline_project_lifecycle_pglite",
      observedAt: "2026-07-01T00:00:00.000Z",
      evidenceRoots: [root("baseline-evidence")],
      satelliteRoots: [root("baseline-satellite")],
      metricRoots: [root("baseline-metric")],
      limitations: ["This bounded baseline is not an impact certification."],
    },
    intervention: {
      interventionId: "intervention_project_lifecycle_pglite",
      interventionType: "reforestation",
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2028-08-01T00:00:00.000Z",
      targetAreaSquareMeters: 500_000,
      targetTreeCount: overrides.targetTreeCount ?? 12_500,
      methodologyRoot: root("intervention-methodology"),
      evidenceRoots: [root("intervention-evidence")],
    },
    monitoringPlan: {
      monitoringPlanId: "monitoring_plan_project_lifecycle_pglite",
      startsAt: "2026-07-19T00:00:00.000Z",
      endsAt: "2029-07-19T00:00:00.000Z",
      cadenceDays: 30,
      indicatorCodes: ["canopy_cover", "tree_survival"],
      evidenceRequirementCodes: ["field_observation", "satellite_observation"],
      responsibleOrganizationId: organizationId,
      escalationPolicyRoot: root("monitoring-escalation-policy"),
    },
    policyId: "policy_project_lifecycle_pglite_v1",
    policyVersion: "v1.0.0",
    policyRoot: root("project-lifecycle-policy"),
    validFrom: "2026-07-19T00:00:00.000Z",
    validUntil: "2027-07-19T00:00:00.000Z",
    registeredAt: "2026-07-19T01:00:00.000Z",
  };
}

function actor(
  id: string,
  actorOrganizationId: string,
  role: CanopyProofProjectLifecycleActorSnapshot["role"],
  scopes: readonly string[],
  subject = false,
): CanopyProofProjectLifecycleActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId: actorOrganizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: root(`participant:${id}`),
    organizationRoot: root(`organization:${actorOrganizationId}`),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: root(`membership:${id}`),
    authoritySource: subject ? ("subject_membership" as const) : ("canonical_accreditation" as const),
    ...(!subject
      ? {
          accreditationId: `accreditation_${id}`,
          accreditationStatus: "approved" as const,
          accreditationDecisionRoot: root(`accreditation-decision:${id}`),
          accreditationProjectionRoot: root(`accreditation-projection:${id}`),
          accreditationValidFrom: "2026-01-01T00:00:00.000Z",
          accreditationValidUntil: "2030-01-01T00:00:00.000Z",
        }
      : {}),
    accreditationScope: [...scopes].sort((left, right) => left.localeCompare(right)),
  };
  return {
    ...seed,
    authorityRoot: buildCanopyProofProjectLifecycleActorAuthorityRoot(seed),
  };
}

function currentAuthorityResolver(
  overrides: Partial<{
    projectAuthorityRoot: string;
    projectStatus: "submitted" | "under_review" | "active" | "monitored";
    policyRoot: string;
    sourceAuthorityRoot: string | null;
    restorationAuthorityRoot: string | null;
  }> = {},
): CanopyProofProjectLifecycleAuthorityResolver {
  return async (query) => {
    const resolvedActor = actors.get(query.actorId);
    if (!resolvedActor) throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_TEST_ACTOR_UNKNOWN");
    return {
      actor: resolvedActor,
      projectAuthorityRoot: overrides.projectAuthorityRoot ?? query.projectAuthorityRoot,
      projectStatus: overrides.projectStatus ?? query.projectStatus,
      policyRoot: overrides.policyRoot ?? query.policyRoot,
      sourceAuthorityRoot: overrides.sourceAuthorityRoot ?? query.sourceAuthorityRoot,
      restorationAuthorityRoot:
        overrides.restorationAuthorityRoot ?? query.restorationAuthorityRoot,
    };
  };
}

async function createDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseSql);
  await db.exec(accreditationSql);
  await db.exec(migrationSql);
  await db.exec(migrationSql);
  await db.exec(sourceResolverSql);
  await db.exec(sourceResolverSql);
  await seedAuthority(db);
  return db;
}

async function insertProjectLifecyclePolicy(db: PGlite): Promise<CanopyProofGovernedPolicyAuthority> {
  const service = new CanopyProofMethodologyGovernanceAuthorityService();
  const creator = verificationActor(proposer);
  const policy = service.createPolicy(
    {
      subject: "project_lifecycle",
      title: "Canonical project lifecycle human governance policy",
      requiredApprovals: 2,
      allowedReviewerRoles: ["owner", "verifier"],
      createdAt: "2026-07-19T00:00:00.000Z",
    },
    creator,
  );
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [creator.id]);
    await transaction.query("SELECT set_config('app.organization_id', $1, true)", [
      creator.organizationId,
    ]);
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1, 'governed_policy:project_lifecycle', $2, $3, $4, $5,
        $6, $7, $8, $9, $10)`,
      [
        policy.auditEvent.id,
        policy.auditEvent.action,
        policy.auditEvent.actor,
        policy.auditEvent.entityType,
        policy.auditEvent.entityId,
        policy.auditEvent.previousRoot,
        policy.auditEvent.payloadHash,
        policy.auditEvent.eventRoot,
        policy.auditEvent.createdAt,
        policy.auditEvent.rationale,
      ],
    );
    await transaction.query(
      `INSERT INTO governance.proof_policy_versions (
        id, subject, governance_organization_id, title, required_approvals,
        allowed_reviewer_roles, supersedes_policy_id, supersedes_policy_root,
        creator_id, creator_snapshot, created_at, command_hash, policy_hash,
        policy_root, safety, audit_event_root
      ) VALUES ($1, $2, $3, $4, $5, $6::text[], NULL, NULL, $7, $8::jsonb,
        $9, $10, $11, $12, $13::jsonb, $14)`,
      [
        policy.id,
        policy.subject,
        policy.governanceOrganizationId,
        policy.title,
        policy.requiredApprovals,
        policy.allowedReviewerRoles,
        policy.creator.id,
        JSON.stringify(policy.creator),
        policy.createdAt,
        policy.commandHash,
        policy.policyHash,
        policy.policyRoot,
        JSON.stringify(policy.safety),
        policy.auditEvent.eventRoot,
      ],
    );
  });
  return policy;
}

function verificationActor(
  actorSnapshot: CanopyProofProjectLifecycleActorSnapshot,
): CanopyProofVerificationActorSnapshot {
  const seed = {
    id: actorSnapshot.id,
    participantType: "human" as const,
    role: actorSnapshot.role,
    verificationStatus: "verified" as const,
    organizationId: actorSnapshot.organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: actorSnapshot.participantRoot,
    organizationRoot: actorSnapshot.organizationRoot,
    membershipId: actorSnapshot.membershipId,
    membershipStatus: "active" as const,
    membershipRoot: actorSnapshot.membershipRoot,
    accreditationScope: [] as const,
  };
  return {
    ...seed,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...seed }),
  };
}

async function updateMembershipStatus(
  db: PGlite,
  membershipId: string,
  status: "active" | "suspended",
  updatedAt: string,
) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proposer.id]);
    await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    await transaction.query(
      `UPDATE organizations.memberships SET status = $2, updated_at = $3 WHERE id = $1`,
      [membershipId, status, updatedAt],
    );
  });
}

async function seedAuthority(db: PGlite) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proposer.id]);
    for (const snapshot of actors.values()) {
      await transaction.query(
        `INSERT INTO organizations.organizations (
          id, name, organization_type, legal_name, jurisdiction, operating_regions,
          verification_capabilities, verification_status, trust_level,
          accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
        ) VALUES ($1, $2, $3, $2, 'GLOBAL', ARRAY['global']::text[],
          ARRAY['project_lifecycle']::text[], 'verified', 'institutional',
          $4, 'restricted', $5, $6, $6)`,
        [
          snapshot.organizationId,
          `Project lifecycle ${snapshot.organizationId}`,
          snapshot.organizationId === organizationId ? "restoration_operator" : "auditor",
          snapshot.organizationId === organizationId ? "pending" : "approved",
          snapshot.organizationRoot,
          "2026-01-01T00:00:00.000Z",
        ],
      );
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES ($1, 'human', $2, $3, ARRAY[$4]::text[], 'verified', 100,
          ARRAY[]::text[], $5, $6, $6)`,
        [
          snapshot.id,
          `Project lifecycle ${snapshot.role}`,
          snapshot.organizationId,
          snapshot.role,
          snapshot.participantRoot,
          "2026-01-01T00:01:00.000Z",
        ],
      );
    }
    for (const snapshot of actors.values()) {
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, $4, 'active',
          'No disclosed conflict for this deterministic lifecycle fixture.',
          $5, $6, $6, $7)`,
        [
          snapshot.membershipId,
          snapshot.organizationId,
          snapshot.id,
          snapshot.role,
          proposer.id,
          "2026-01-01T00:02:00.000Z",
          snapshot.membershipRoot,
        ],
      );
    }

    const projectEvent = projectFixture.auditHistory[0];
    assert.ok(projectEvent);
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        projectEvent.id,
        projectFixture.id,
        projectEvent.action,
        projectEvent.actor,
        projectEvent.entityType,
        projectEvent.entityId,
        projectEvent.previousRoot,
        projectEvent.payloadHash,
        projectEvent.eventRoot,
        projectEvent.createdAt,
        projectEvent.rationale,
      ],
    );
    await transaction.query(
      `INSERT INTO projects.projects (
        id, organization_id, region_id, title, project_type, status, location,
        area_hectares, target_tree_count, biodiversity_indicators, water_indicators,
        climate_risk_indicators, monitoring_cadence_days, created_by, created_by_role,
        created_at, updated_at, project_hash, project_root, audit_event_root,
        audit_history, claim_boundary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::text[],
        $11::text[], $12::text[], $13, $14, $15, $16, $16, $17, $18, $19,
        $20::jsonb, $21::jsonb)`,
      [
        projectFixture.id,
        projectFixture.organizationId,
        projectFixture.regionId,
        projectFixture.title,
        projectFixture.projectType,
        projectFixture.status,
        JSON.stringify(projectFixture.location),
        projectFixture.location.areaHectares,
        projectFixture.targetTreeCount,
        projectFixture.biodiversityIndicators,
        projectFixture.waterIndicators,
        projectFixture.climateRiskIndicators,
        projectFixture.monitoringCadenceDays,
        projectFixture.createdBy,
        projectFixture.createdByRole,
        projectFixture.createdAt,
        projectFixture.projectHash,
        projectFixture.projectRoot,
        projectEvent.eventRoot,
        JSON.stringify(projectFixture.auditHistory),
        JSON.stringify(projectFixture.claimBoundary),
      ],
    );
  });
}

async function assertSqlParity(db: PGlite, history: readonly CanopyProofProjectLifecycleRecord[]) {
  for (const record of history) {
    const fact = recordFact(record);
    const kind = record.kind;
    const commandFunction = `projects.project_lifecycle_${kind}_command_hash`;
    const result = await db.query<{ command_hash: string; fact_root: string }>(
      `SELECT ${commandFunction}($1::jsonb) AS command_hash,
        projects.project_lifecycle_fact_root($1::jsonb, $2) AS fact_root`,
      [JSON.stringify(fact), kind],
    );
    assert.deepEqual(result.rows[0], {
      command_hash: fact.commandHash,
      fact_root: recordRoot(record),
    });
    if (record.kind === "registration") {
      const nested = await db.query<{
        baseline_root: string;
        intervention_root: string;
        monitoring_plan_root: string;
      }>(
        `SELECT
          projects.project_lifecycle_baseline_root($1::jsonb->'baseline') AS baseline_root,
          projects.project_lifecycle_intervention_root($1::jsonb->'intervention') AS intervention_root,
          projects.project_lifecycle_monitoring_plan_root($1::jsonb->'monitoringPlan') AS monitoring_plan_root`,
        [JSON.stringify(fact)],
      );
      assert.deepEqual(nested.rows[0], {
        baseline_root: record.registration.baseline.baselineRoot,
        intervention_root: record.registration.intervention.interventionRoot,
        monitoring_plan_root: record.registration.monitoringPlan.monitoringPlanRoot,
      });
    }
    if (record.kind === "transition") {
      const source = await db.query<{ source_root: string }>(
        `SELECT projects.project_lifecycle_source_root($1::jsonb->'source') AS source_root`,
        [JSON.stringify(fact)],
      );
      assert.equal(source.rows[0]?.source_root, record.transition.source.sourceAuthorityRoot);
    }
  }
}

async function assertTenantIsolation(db: PGlite) {
  await db.exec("CREATE ROLE canopyproof_project_lifecycle_reader NOLOGIN NOBYPASSRLS");
  await db.exec("GRANT USAGE ON SCHEMA projects TO canopyproof_project_lifecycle_reader");
  await db.exec(
    `GRANT SELECT ON
      projects.project_lifecycle_registration_facts,
      projects.project_lifecycle_review_facts,
      projects.project_lifecycle_transition_facts,
      projects.project_lifecycle_control_facts
    TO canopyproof_project_lifecycle_reader`,
  );
  const hidden = await db.transaction(async (transaction) => {
    await transaction.query("SET LOCAL ROLE canopyproof_project_lifecycle_reader");
    await transaction.query("SELECT set_config('app.organization_id', $1, true)", [
      "org_project_lifecycle_other_tenant",
    ]);
    return transaction.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM projects.project_lifecycle_registration_facts`,
    );
  });
  assert.equal(hidden.rows[0]?.count, 0);
}

async function lifecycleCounts(db: PGlite) {
  await setTenant(db, organizationId, proposer.id);
  const result = await db.query<{
    registrations: number;
    reviews: number;
    transitions: number;
    controls: number;
    events: number;
    receipts: number;
  }>(
    `SELECT
      (SELECT count(*)::integer FROM projects.project_lifecycle_registration_facts) AS registrations,
      (SELECT count(*)::integer FROM projects.project_lifecycle_review_facts) AS reviews,
      (SELECT count(*)::integer FROM projects.project_lifecycle_transition_facts) AS transitions,
      (SELECT count(*)::integer FROM projects.project_lifecycle_control_facts) AS controls,
      (SELECT count(*)::integer FROM audit.domain_events WHERE stream_id = $1) AS events,
      (SELECT count(*)::integer FROM audit.command_receipts
        WHERE result_entity_type LIKE 'project_lifecycle_%') AS receipts`,
    [`project-lifecycle:${organizationId}:${projectId}`],
  );
  const counts = result.rows[0];
  assert.ok(counts);
  return counts;
}

async function setTenant(db: PGlite, tenant: string, actorId: string) {
  await db.query("SELECT set_config('app.organization_id', $1, false)", [tenant]);
  await db.query("SELECT set_config('app.actor_id', $1, false)", [actorId]);
}

function pglitePrismaClient(db: PGlite) {
  const client = {
    async $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
      return db.transaction((transaction) => operation(pgliteTransactionClient(transaction)));
    },
  };
  return client as unknown as PrismaClient;
}

function pgliteTransactionClient(transaction: Transaction) {
  return {
    async $queryRaw<T = unknown[]>(query: Prisma.Sql): Promise<T> {
      const result = await transaction.query(query.text, query.values);
      return result.rows as T;
    },
    async $executeRaw(query: Prisma.Sql) {
      const result = await transaction.query(query.text, query.values);
      return result.affectedRows ?? 0;
    },
  } as unknown as Prisma.TransactionClient;
}

function recordFact(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration;
  if (record.kind === "review") return record.review;
  if (record.kind === "transition") return record.transition;
  return record.control;
}

function recordRoot(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.registrationRoot;
  if (record.kind === "review") return record.review.reviewRoot;
  if (record.kind === "transition") return record.transition.transitionRoot;
  return record.control.controlRoot;
}

function recordCount(history: readonly CanopyProofProjectLifecycleRecord[], kind: CanopyProofProjectLifecycleRecord["kind"]) {
  return history.filter((record) => record.kind === kind).length;
}

function root(label: string) {
  return hashJson({ kind: "canopyproof-project-lifecycle-pglite-root-v1", label });
}
