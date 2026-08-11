import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofOrganizationAccreditationAuthorityService,
  canopyProofOrganizationAccreditationScopes,
  organizationAccreditationActorAuthorityRoot,
  type CanopyProofOrganizationAccreditationActorSnapshot,
  type CanopyProofOrganizationAccreditationFact,
} from "../../services/api/src/domain/canopyproof/organization-accreditation-authority.js";
import {
  PrismaCanopyProofOrganizationAccreditationRepository,
  type CanopyProofOrganizationAccreditationGovernanceAuthorityResolver,
  type CanopyProofOrganizationAccreditationSubjectAuthorityResolver,
} from "../../services/api/src/domain/canopyproof/organization-accreditation-postgres.js";
import { CanopyProofCanonicalOrganizationAccreditationResolver } from "../../services/api/src/domain/canopyproof/canonical-organization-accreditation-resolver.js";

const baseSql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/organization-accreditation-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/organization-accreditation-authority.rollback.sql"),
  "utf8",
);
const rootGovernanceMigrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/root-governance-authority.sql"),
  "utf8",
);

const subjectOrganizationId = "org_accreditation_subject_pglite";
const governanceOrganizationId = "org_accreditation_governance_pglite";
const otherOrganizationId = "org_accreditation_other_pglite";
const profileRoot = root("subject-profile");
const policyRoot = root("accreditation-policy-v1");
const governanceScopes = Object.values(canopyProofOrganizationAccreditationScopes).sort();
const requestedScope = [...governanceScopes];

test("organization accreditation authority is deterministic, append-only, tenant-bound, and replayable", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await db.exec(rootGovernanceMigrationSql);
    await seedAuthority(db);
    const facts = authorityFixture();
    const repository = new PrismaCanopyProofOrganizationAccreditationRepository(pglitePrismaClient(db));

    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-organization-accreditation-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanReviewRequired: true,
      reviewerDeciderSeparationRequired: true,
      explicitAsOfRequired: true,
      compatibilityAccreditationIsNotCanonical: true,
      revocationTerminal: true,
    });

    await assertSqlRoots(db, facts.application);
    await assertSqlRoots(db, facts.review);
    await assertSqlRoots(db, facts.decision);
    await assertSqlRoots(db, facts.suspension);
    await assertSqlGovernanceActor(db, facts.review.reviewer, facts.review.reviewedAt);

    assert.deepEqual(
      await repository.commitApplication(
        facts.application,
        "accreditation-application-idempotency",
        subjectResolver(facts),
      ),
      facts.application,
    );
    assert.deepEqual(
      await repository.commitApplication(
        facts.application,
        "accreditation-application-idempotency",
        async () => {
          throw new Error("exact retry must not re-resolve current authority");
        },
      ),
      facts.application,
    );
    await assert.rejects(
      repository.commitApplication(
        facts.renewalApplication,
        "accreditation-application-idempotency",
        subjectResolver(facts),
      ),
      /IDEMPOTENCY_CONFLICT/,
    );

    await assert.rejects(
      repository.commitReview(
        facts.review,
        "accreditation-review-stale-resolver",
        async () => ({
          actor: governanceActor("unexpected-reviewer", "researcher"),
          profileRoot,
          policyRoot,
        }),
      ),
      /GOVERNANCE_CURRENT_AUTHORITY_INVALID/,
    );
    await repository.commitReview(facts.review, "accreditation-review", governanceResolver(facts));
    await repository.commitDecision(facts.decision, "accreditation-decision", governanceResolver(facts));

    const canonicalResolver = new CanopyProofCanonicalOrganizationAccreditationResolver();
    const canonicalAuthority = await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [otherOrganizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [facts.application.submitter.id]);
      return canonicalResolver.resolve(
        {
          operation: "review",
          organizationId: otherOrganizationId,
          actorId: facts.application.submitter.id,
          actorOrganizationId: subjectOrganizationId,
          actorRole: facts.application.submitter.role,
          profileRoot: organizationRoot(otherOrganizationId),
          policyRoot,
          requiredScope: canopyProofOrganizationAccreditationScopes.review,
          effectiveAt: "2026-07-20T00:00:00.000Z",
        },
        pgliteTransactionClient(transaction),
      );
    });
    assert.equal(canonicalAuthority.actor.authoritySource, "canonical_accreditation");
    assert.equal(canonicalAuthority.actor.accreditationId, facts.decision.id);
    assert.equal(canonicalAuthority.actor.accreditationDecisionRoot, facts.decision.decisionRoot);
    assert.deepEqual(canonicalAuthority.actor.accreditationScope, requestedScope);
    const directActorAuthority = await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [otherOrganizationId]);
      return canonicalResolver.resolveAccreditedActor(
        {
          subjectOrganizationId: otherOrganizationId,
          actorId: facts.application.submitter.id,
          actorOrganizationId: subjectOrganizationId,
          actorRole: facts.application.submitter.role,
          requiredScope: canopyProofOrganizationAccreditationScopes.review,
          effectiveAt: "2026-07-20T00:00:00.000Z",
        },
        pgliteTransactionClient(transaction),
      );
    });
    assert.deepEqual(directActorAuthority, canonicalAuthority.actor);

    assert.equal(
      (await repository.getProjection(
        subjectOrganizationId,
        facts.application.id,
        "2026-07-20T00:00:00.000Z",
        facts.decision.decider.id,
      )).status,
      "approved",
    );
    assert.equal(
      (await repository.getProjection(
        subjectOrganizationId,
        facts.application.id,
        "2027-01-01T00:00:00.000Z",
        facts.decision.decider.id,
      )).status,
      "expired",
    );

    await repository.commitControl(facts.suspension, "accreditation-suspension", governanceResolver(facts));
    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [facts.suspension.governor.id]);
      await transaction.query(
        `INSERT INTO organizations.accreditations (
          id, organization_id, status, scope, decided_by, decided_at,
          rationale, evidence_hash, audit_event_root
        ) VALUES ($1, $2, 'approved', $3, $4, $5,
          'Compatibility accreditation must remain non-canonical.', $6, $7)`,
        [
          "compatibility-accreditation-must-be-ignored",
          subjectOrganizationId,
          governanceScopes,
          facts.suspension.governor.id,
          "2026-08-01T01:00:00.000Z",
          root("compatibility-evidence"),
          root("compatibility-event"),
        ],
      );
    });
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [otherOrganizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [facts.application.submitter.id]);
        return canonicalResolver.resolve(
          {
            operation: "review",
            organizationId: otherOrganizationId,
            actorId: facts.application.submitter.id,
            actorOrganizationId: subjectOrganizationId,
            actorRole: facts.application.submitter.role,
            profileRoot: organizationRoot(otherOrganizationId),
            policyRoot,
            requiredScope: canopyProofOrganizationAccreditationScopes.review,
            effectiveAt: "2026-08-01T12:00:00.000Z",
          },
          pgliteTransactionClient(transaction),
        );
      }),
      /CANONICAL_AUTHORITY_REQUIRED/,
    );
    await repository.commitApplication(
      facts.renewalApplication,
      "accreditation-renewal-application",
      subjectResolver(facts),
    );
    await repository.commitReview(
      facts.renewalReview,
      "accreditation-renewal-review",
      governanceResolver(facts),
    );
    await repository.commitDecision(
      facts.renewalDecision,
      "accreditation-renewal-decision",
      governanceResolver(facts),
    );

    const originalProjection = await repository.getProjection(
      subjectOrganizationId,
      facts.application.id,
      "2026-08-05T00:00:00.000Z",
      facts.renewalDecision.decider.id,
    );
    const renewalProjection = await repository.getProjection(
      subjectOrganizationId,
      facts.renewalApplication.id,
      "2026-08-05T00:00:00.000Z",
      facts.renewalDecision.decider.id,
    );
    assert.equal(originalProjection.status, "suspended");
    assert.equal(renewalProjection.status, "approved");
    assert.deepEqual(
      await repository.getAuthoritySnapshot(subjectOrganizationId, facts.renewalDecision.decider.id),
      facts.snapshot,
    );

    await setTenant(db, subjectOrganizationId, facts.renewalDecision.decider.id);
    assert.equal(await count(db, "organizations.organization_accreditation_application_facts"), 2);
    assert.equal(await count(db, "organizations.organization_accreditation_review_facts"), 2);
    assert.equal(await count(db, "organizations.organization_accreditation_decision_facts"), 2);
    assert.equal(await count(db, "organizations.organization_accreditation_control_facts"), 1);
    assert.equal(await count(db, "audit.command_receipts"), 7);
    const events = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.domain_events WHERE stream_id = $1`,
      [`organization-accreditation:${subjectOrganizationId}`],
    );
    assert.equal(events.rows[0]?.count, 7);

    await assert.rejects(
      db.query(
        `UPDATE organizations.organization_accreditation_application_facts
         SET policy_root = $2 WHERE id = $1`,
        [facts.application.id, root("tampered-policy")],
      ),
      /append-only|cannot be updated or deleted/i,
    );

    await db.exec("CREATE ROLE canopyproof_accreditation_reader NOLOGIN NOBYPASSRLS");
    await db.exec("GRANT USAGE ON SCHEMA organizations TO canopyproof_accreditation_reader");
    await db.exec(
      `GRANT SELECT ON
        organizations.organization_accreditation_application_facts,
        organizations.organization_accreditation_review_facts,
        organizations.organization_accreditation_decision_facts,
        organizations.organization_accreditation_control_facts
       TO canopyproof_accreditation_reader`,
    );
    const hidden = await db.transaction(async (transaction) => {
      await transaction.query("SET LOCAL ROLE canopyproof_accreditation_reader");
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [otherOrganizationId]);
      return transaction.query<{ count: number }>(
        `SELECT count(*)::integer AS count
         FROM organizations.organization_accreditation_application_facts`,
      );
    });
    assert.equal(hidden.rows[0]?.count, 0);
    await assert.rejects(
      db.exec(rollbackSql),
      /CANOPYPROOF_ORGANIZATION_ACCREDITATION_ROLLBACK_BLOCKED_FACTS_EXIST/,
    );
  } finally {
    await db.close();
  }
});

test("current membership drift rejects atomically without orphan event or receipt", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await seedAuthority(db);
    const facts = authorityFixture();
    const repository = new PrismaCanopyProofOrganizationAccreditationRepository(pglitePrismaClient(db));
    await repository.commitApplication(facts.application, "drift-application", subjectResolver(facts));

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [facts.review.reviewer.id]);
      await transaction.query(
        `UPDATE organizations.memberships SET status = 'suspended', updated_at = $2 WHERE id = $1`,
        [facts.review.reviewer.membershipId, "2026-07-19T00:30:00.000Z"],
      );
    });

    await assert.rejects(
      repository.commitReview(facts.review, "drift-review", governanceResolver(facts)),
      /REVIEW_FACT_INVALID|GOVERNANCE_CURRENT_AUTHORITY/i,
    );
    await setTenant(db, subjectOrganizationId, facts.review.reviewer.id);
    assert.equal(await count(db, "organizations.organization_accreditation_review_facts"), 0);
    assert.equal(await count(db, "audit.command_receipts"), 1);
    const events = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.domain_events WHERE stream_id = $1`,
      [`organization-accreditation:${subjectOrganizationId}`],
    );
    assert.equal(events.rows[0]?.count, 1);
  } finally {
    await db.close();
  }
});

test("revocation remains terminal after durable replay", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await seedAuthority(db);
    const facts = revokedFixture();
    const repository = new PrismaCanopyProofOrganizationAccreditationRepository(pglitePrismaClient(db));
    await repository.commitApplication(facts.application, "revoke-application", subjectResolver(facts));
    await repository.commitReview(facts.review, "revoke-review", governanceResolver(facts));
    await repository.commitDecision(facts.decision, "revoke-decision", governanceResolver(facts));
    await repository.commitControl(facts.revocation, "revoke-control", governanceResolver(facts));
    assert.equal(
      (await repository.getProjection(
        subjectOrganizationId,
        facts.application.id,
        "2026-08-02T00:00:00.000Z",
        facts.revocation.governor.id,
      )).status,
      "revoked",
    );
    const replayed = CanopyProofOrganizationAccreditationAuthorityService.fromAuthoritySnapshot(
      await repository.getAuthoritySnapshot(subjectOrganizationId, facts.revocation.governor.id),
    );
    assert.throws(
      () =>
        replayed.submitApplication(
          applicationInput({
            applicationKind: "renewal",
            priorDecisionId: facts.decision.id,
            submittedAt: "2026-08-03T00:00:00.000Z",
            requestedValidUntil: "2027-08-02T00:00:00.000Z",
          }),
          subjectActor("subject-owner", "owner"),
        ),
      /RENEWAL_TERMINAL/,
    );
  } finally {
    await db.close();
  }
});

test("empty organization accreditation migration rolls back without touching base schemas", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(rollbackSql);
    const removed = await db.query<{ relation_name: string | null }>(
      `SELECT to_regclass('organizations.organization_accreditation_application_facts')::text AS relation_name`,
    );
    assert.equal(removed.rows[0]?.relation_name, null);
    const retained = await db.query<{ relation_name: string | null }>(
      `SELECT to_regclass('organizations.organizations')::text AS relation_name`,
    );
    assert.equal(retained.rows[0]?.relation_name, "organizations.organizations");
  } finally {
    await db.close();
  }
});

async function assertSqlRoots(db: PGlite, fact: CanopyProofOrganizationAccreditationFact) {
  const kind = fact.factType.replace("organization_accreditation_", "") as
    | "application"
    | "review"
    | "decision"
    | "control";
  const hashKey = `${kind}_hash`;
  const rootKey = `${kind}_root`;
  const commandFunction = `organizations.organization_accreditation_${kind}_command_hash`;
  const sourceFunction =
    kind === "application"
      ? "organizations.organization_accreditation_application_evidence_root"
      : kind === "control"
        ? "organizations.organization_accreditation_control_evidence_root"
        : `organizations.organization_accreditation_${kind}_source_root`;
  if (
    !/^organizations\.organization_accreditation_[a-z_]+$/.test(commandFunction) ||
    !/^organizations\.organization_accreditation_[a-z_]+$/.test(sourceFunction)
  ) {
    throw new Error("invalid SQL root function fixture");
  }
  const result = await db.query<Record<string, string>>(
    `SELECT
       ${commandFunction}($1::jsonb) AS command_hash,
       organizations.organization_accreditation_fact_hash($1::jsonb, $2) AS fact_hash,
       organizations.organization_accreditation_fact_root(
         $1::jsonb, $2, organizations.organization_accreditation_fact_hash($1::jsonb, $2)
       ) AS fact_root,
       ${sourceFunction}($1::jsonb) AS source_root,
       audit.sha256_stable_json($1::jsonb - 'auditEvent') AS payload_hash`,
    [JSON.stringify(fact), kind],
  );
  const factRecord = fact as unknown as Record<string, unknown>;
  const sourceKey = kind === "application" || kind === "control" ? "evidenceRoot" : "sourceRoot";
  assert.deepEqual(result.rows[0], {
    command_hash: fact.commandHash,
    fact_hash: factRecord[camelCase(hashKey)],
    fact_root: factRecord[camelCase(rootKey)],
    source_root: factRecord[sourceKey],
    payload_hash: fact.auditEvent.payloadHash,
  });
}

async function assertSqlGovernanceActor(
  db: PGlite,
  actor: CanopyProofOrganizationAccreditationActorSnapshot,
  effectiveAt: string,
) {
  const result = await db.query<{
    authority_root: string;
    current: boolean;
    missing_key_current: boolean;
  }>(
    `SELECT
       organizations.organization_accreditation_actor_authority_root($1::jsonb) AS authority_root,
       organizations.organization_accreditation_governance_actor_is_current(
         $1::jsonb, $2, $3, $4, ARRAY[$5]::text[], $6::timestamptz
       ) AS current,
       organizations.organization_accreditation_governance_actor_is_current(
         $1::jsonb - 'accreditationId', $2, $3, $4, ARRAY[$5]::text[], $6::timestamptz
       ) AS missing_key_current`,
    [
      JSON.stringify(actor),
      actor.id,
      subjectOrganizationId,
      canopyProofOrganizationAccreditationScopes.review,
      actor.role,
      effectiveAt,
    ],
  );
  assert.deepEqual(result.rows[0], {
    authority_root: actor.authorityRoot,
    current: true,
    missing_key_current: false,
  });
}

function authorityFixture() {
  const service = new CanopyProofOrganizationAccreditationAuthorityService();
  const application = service.submitApplication(applicationInput(), subjectActor("subject-owner", "owner"));
  const review = service.reviewApplication(
    reviewInput(application.id),
    governanceActor("accreditation-reviewer", "researcher"),
  );
  const decision = service.decideApplication(
    decisionInput(application.id, review.id),
    governanceActor("accreditation-decider", "admin"),
  );
  const suspension = service.controlDecision(
    controlInput(decision.id, "suspend", "2026-08-01T00:00:00.000Z"),
    governanceActor("accreditation-governor", "verifier"),
  );
  const renewalApplication = service.submitApplication(
    applicationInput({
      applicationKind: "renewal",
      priorDecisionId: decision.id,
      submittedAt: "2026-08-02T00:00:00.000Z",
      requestedValidUntil: "2027-08-01T00:00:00.000Z",
    }),
    subjectActor("subject-owner", "owner"),
  );
  const renewalReview = service.reviewApplication(
    reviewInput(renewalApplication.id, {
      reviewedAt: "2026-08-03T00:00:00.000Z",
      sourceEventRoots: [root("renewal-review-source")],
    }),
    governanceActor("renewal-reviewer", "researcher"),
  );
  const renewalDecision = service.decideApplication(
    decisionInput(renewalApplication.id, renewalReview.id, {
      decidedAt: "2026-08-04T00:00:00.000Z",
      validUntil: "2027-08-01T00:00:00.000Z",
      sourceEventRoots: [root("renewal-decision-source")],
    }),
    governanceActor("renewal-decider", "admin"),
  );
  return {
    application,
    review,
    decision,
    suspension,
    renewalApplication,
    renewalReview,
    renewalDecision,
    snapshot: service.getAuthoritySnapshot(),
  };
}

function revokedFixture() {
  const service = new CanopyProofOrganizationAccreditationAuthorityService();
  const application = service.submitApplication(applicationInput(), subjectActor("subject-owner", "owner"));
  const review = service.reviewApplication(
    reviewInput(application.id),
    governanceActor("accreditation-reviewer", "researcher"),
  );
  const decision = service.decideApplication(
    decisionInput(application.id, review.id),
    governanceActor("accreditation-decider", "admin"),
  );
  const revocation = service.controlDecision(
    controlInput(decision.id, "revoke", "2026-08-01T00:00:00.000Z"),
    governanceActor("accreditation-governor", "verifier"),
  );
  return { application, review, decision, revocation };
}

function applicationInput(
  overrides: Partial<{
    applicationKind: "initial" | "renewal";
    priorDecisionId: string;
    requestedValidUntil: string;
    submittedAt: string;
  }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    applicationKind: overrides.applicationKind ?? ("initial" as const),
    ...(overrides.priorDecisionId ? { priorDecisionId: overrides.priorDecisionId } : {}),
    profileRoot,
    scope: requestedScope,
    evidenceEventRoots: [root(overrides.applicationKind === "renewal" ? "renewal-evidence" : "application-evidence")],
    policyRoot,
    requestedValidUntil: overrides.requestedValidUntil ?? "2027-01-01T00:00:00.000Z",
    submittedAt: overrides.submittedAt ?? "2026-07-19T00:00:00.000Z",
  };
}

function reviewInput(
  applicationId: string,
  overrides: Partial<{ reviewedAt: string; sourceEventRoots: readonly string[] }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    applicationId,
    profileRoot,
    policyRoot,
    decision: "accepted" as const,
    reasonCode: "evidence_sufficient" as const,
    rationale: "Independent review confirmed the exact policy, scope, and hash-bound evidence package.",
    conflictDisclosure: "The reviewer has no employment, funding, ownership, family, or advisory conflict.",
    sourceEventRoots: overrides.sourceEventRoots ?? [root("review-source")],
    reviewedAt: overrides.reviewedAt ?? "2026-07-19T01:00:00.000Z",
  };
}

function decisionInput(
  applicationId: string,
  acceptedReviewId: string,
  overrides: Partial<{ decidedAt: string; validUntil: string; sourceEventRoots: readonly string[] }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    applicationId,
    acceptedReviewId,
    profileRoot,
    policyRoot,
    scope: requestedScope,
    decision: "approved" as const,
    reasonCode: "requirements_satisfied" as const,
    rationale: "A separate governance authority approved the exact reviewed scope for a bounded interval.",
    sourceEventRoots: overrides.sourceEventRoots ?? [root("decision-source")],
    validUntil: overrides.validUntil ?? "2027-01-01T00:00:00.000Z",
    decidedAt: overrides.decidedAt ?? "2026-07-19T02:00:00.000Z",
  };
}

function controlInput(decisionId: string, action: "suspend" | "revoke", controlledAt: string) {
  return {
    organizationId: subjectOrganizationId,
    decisionId,
    action,
    reasonCode: action === "suspend" ? ("compliance_concern" as const) : ("governance_breach" as const),
    rationale:
      action === "suspend"
        ? "A material compliance concern requires immediate suspension pending a newly reviewed application."
        : "A documented governance breach requires terminal revocation of this accreditation stream.",
    evidenceEventRoots: [root(`${action}-evidence`)],
    controlledAt,
  };
}

function subjectResolver(
  facts: ReturnType<typeof authorityFixture> | ReturnType<typeof revokedFixture>,
): CanopyProofOrganizationAccreditationSubjectAuthorityResolver {
  return async (query) => {
    const application = "renewalApplication" in facts && facts.renewalApplication.id
      ? [facts.application, facts.renewalApplication].find(
          (candidate) => candidate.submitter.id === query.actorId && candidate.submittedAt === query.effectiveAt,
        )
      : facts.application.submitter.id === query.actorId && facts.application.submittedAt === query.effectiveAt
        ? facts.application
        : undefined;
    if (!application) throw new Error(`missing subject authority fixture: ${query.actorId}/${query.effectiveAt}`);
    return { actor: application.submitter, profileRoot };
  };
}

function governanceResolver(
  facts: ReturnType<typeof authorityFixture> | ReturnType<typeof revokedFixture>,
): CanopyProofOrganizationAccreditationGovernanceAuthorityResolver {
  return async (query) => {
    const candidates = [
      facts.review.reviewer,
      facts.decision.decider,
      "suspension" in facts ? facts.suspension.governor : facts.revocation.governor,
      ...("renewalReview" in facts ? [facts.renewalReview.reviewer, facts.renewalDecision.decider] : []),
    ];
    const actor = candidates.find((candidate) => candidate.id === query.actorId);
    if (!actor) throw new Error(`missing governance authority fixture: ${query.actorId}/${query.effectiveAt}`);
    return { actor, profileRoot, policyRoot };
  };
}

async function seedAuthority(db: PGlite) {
  const actors = [
    ["subject-owner", subjectOrganizationId, "owner"],
    ["accreditation-reviewer", governanceOrganizationId, "researcher"],
    ["accreditation-decider", governanceOrganizationId, "admin"],
    ["accreditation-governor", governanceOrganizationId, "verifier"],
    ["renewal-reviewer", governanceOrganizationId, "researcher"],
    ["renewal-decider", governanceOrganizationId, "admin"],
    ["unexpected-reviewer", governanceOrganizationId, "researcher"],
  ] as const;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", ["accreditation-decider"]);
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, operating_regions,
        verification_capabilities, verification_status, trust_level, accreditation_status,
        data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES
        ($1, 'Accreditation Subject', 'ngo', 'Accreditation Subject', 'GLOBAL', ARRAY['global']::text[],
          ARRAY['restoration']::text[], 'verified', 'institutional', 'pending', 'restricted', $2, $3, $3),
        ($4, 'Accreditation Governance', 'un_agency', 'Accreditation Governance', 'GLOBAL', ARRAY['global']::text[],
          ARRAY['organization_governance']::text[], 'verified', 'institutional', 'approved', 'restricted', $5, $3, $3),
        ($6, 'Accreditation Other', 'research_institution', 'Accreditation Other', 'GLOBAL', ARRAY['global']::text[],
          ARRAY[]::text[], 'verified', 'institutional', 'pending', 'restricted', $7, $3, $3)`,
      [
        subjectOrganizationId,
        profileRoot,
        "2026-01-01T00:00:00.000Z",
        governanceOrganizationId,
        organizationRoot(governanceOrganizationId),
        otherOrganizationId,
        organizationRoot(otherOrganizationId),
      ],
    );
    for (const [id, organizationId, role] of actors) {
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES ($1, 'human', $2, $3, ARRAY[$4]::text[], 'verified', 80,
          ARRAY[]::text[], $5, $6, $6)`,
        [id, `Accreditation ${role}`, organizationId, role, participantRoot(id), "2026-01-01T00:01:00.000Z"],
      );
    }
    for (const [id, organizationId, role] of actors) {
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, $4, 'active',
          'No disclosed conflict for this deterministic accreditation fixture.',
          'accreditation-decider', $5, $5, $6)`,
        [
          `membership_${id}`,
          organizationId,
          id,
          role,
          "2026-01-01T00:02:00.000Z",
          membershipRoot(id, organizationId, role),
        ],
      );
    }
  });
}

function subjectActor(
  id: string,
  role: CanopyProofOrganizationAccreditationActorSnapshot["role"],
): CanopyProofOrganizationAccreditationActorSnapshot {
  return actor(id, subjectOrganizationId, role, []);
}

function governanceActor(
  id: string,
  role: CanopyProofOrganizationAccreditationActorSnapshot["role"],
): CanopyProofOrganizationAccreditationActorSnapshot {
  return actor(id, governanceOrganizationId, role, governanceScopes);
}

function actor(
  id: string,
  organizationId: string,
  role: CanopyProofOrganizationAccreditationActorSnapshot["role"],
  accreditationScope: readonly string[],
): CanopyProofOrganizationAccreditationActorSnapshot {
  const governance = organizationId === governanceOrganizationId;
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: participantRoot(id),
    organizationRoot: organizationId === subjectOrganizationId ? profileRoot : organizationRoot(organizationId),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: membershipRoot(id, organizationId, role),
    authoritySource: governance ? ("root_governance_bootstrap" as const) : ("subject_membership" as const),
    ...(governance
      ? {
          accreditationId: "root-governance-accreditation",
          accreditationStatus: "approved" as const,
          accreditationDecisionRoot: root("root-governance-decision"),
          accreditationProjectionRoot: root("root-governance-projection"),
          accreditationValidFrom: "2026-01-01T00:00:00.000Z",
          accreditationValidUntil: "2027-01-01T00:00:00.000Z",
        }
      : {}),
    accreditationScope: [...accreditationScope].sort(),
  };
  return { ...seed, authorityRoot: organizationAccreditationActorAuthorityRoot(seed) };
}

function participantRoot(id: string) {
  return hashJson({ kind: "organization-accreditation-pglite-participant", id });
}

function organizationRoot(organizationId: string) {
  return hashJson({ kind: "organization-accreditation-pglite-organization", organizationId });
}

function membershipRoot(id: string, organizationId: string, role: string) {
  return hashJson({ kind: "organization-accreditation-pglite-membership", id, organizationId, role });
}

function root(label: string) {
  return hashJson({ kind: "organization-accreditation-pglite-root", label });
}

function camelCase(value: string) {
  return value.replace(/_([a-z])/g, (_match, character: string) => character.toUpperCase());
}

async function setTenant(db: PGlite, organizationId: string, actorId: string) {
  await db.query("SELECT set_config('app.organization_id', $1, false)", [organizationId]);
  await db.query("SELECT set_config('app.actor_id', $1, false)", [actorId]);
}

async function count(db: PGlite, relation: string) {
  if (!/^[a-z_]+\.[a-z_]+$/.test(relation)) throw new Error("invalid relation fixture");
  const result = await db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM ${relation}`);
  return result.rows[0]?.count;
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
