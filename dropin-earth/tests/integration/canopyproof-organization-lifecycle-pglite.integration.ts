import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofOrganizationLifecycleAuthorityService,
  canopyProofOrganizationLifecycleScopes,
  organizationRegistrationReferenceRoot,
  type CanopyProofOrganizationLifecycleActorSnapshot,
  type CanopyProofOrganizationLifecycleFact,
} from "../../services/api/src/domain/canopyproof/organization-lifecycle-authority.js";
import {
  PrismaCanopyProofOrganizationLifecycleRepository,
  type CanopyProofOrganizationAppealAuthorityResolver,
  type CanopyProofOrganizationAppealDecisionAuthorityResolver,
  type CanopyProofOrganizationLifecycleAuthorityResolver,
} from "../../services/api/src/domain/canopyproof/organization-lifecycle-postgres.js";

const baseSql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/organization-lifecycle-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/organization-lifecycle-authority.rollback.sql"),
  "utf8",
);

const subjectOrganizationId = "org_lifecycle_subject_pglite";
const governanceOrganizationId = "org_lifecycle_governance_pglite";
const profileRoot = organizationRoot(subjectOrganizationId);
const registrationNumber = "CP-ORG-PGLITE-001";
const registrationReferenceRoot = organizationRegistrationReferenceRoot(
  subjectOrganizationId,
  registrationNumber,
);
const documentRoots = [root("registration-document"), root("mandate-document")].sort();
const allScopes = Object.values(canopyProofOrganizationLifecycleScopes).sort();

test("organization lifecycle PostgreSQL authority is deterministic, append-only, tenant-bound, and replayable", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await seedAuthority(db);
    const facts = authorityFixture();
    const repository = new PrismaCanopyProofOrganizationLifecycleRepository(pglitePrismaClient(db));

    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-organization-lifecycle-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanAuthorityRequired: true,
      compatibilityStatusIsProjectionOnly: true,
      revocationTerminal: true,
    });

    await assertSqlRoots(db, facts.anchor);
    await assertSqlEvent(db, facts.anchor);
    const committedAnchor = await repository.commitLifecycleFact(
      facts.anchor,
      "organization-anchor-idempotency",
      lifecycleResolver(facts),
    );
    assert.deepEqual(committedAnchor, facts.anchor);
    assert.deepEqual(
      await repository.commitLifecycleFact(
        facts.anchor,
        "organization-anchor-idempotency",
        async () => {
          throw new Error("exact retry must not re-resolve current authority");
        },
      ),
      facts.anchor,
    );
    await assert.rejects(
      repository.commitLifecycleFact(
        facts.documentReviewTransition,
        "organization-anchor-idempotency",
        lifecycleResolver(facts),
      ),
      /IDEMPOTENCY_CONFLICT/,
    );

    await repository.commitLifecycleFact(
      facts.documentReviewTransition,
      "organization-document-transition",
      lifecycleResolver(facts),
    );
    await assert.rejects(
      repository.commitDocumentReview(
        facts.review,
        "organization-document-review-stale-resolver",
        async () => ({
          actor: governanceActor("unexpected-reviewer", "researcher"),
          profileRoot,
          registrationReferenceRoot,
          documentRoots,
        }),
      ),
      /CURRENT_AUTHORITY_INVALID/,
    );
    await repository.commitDocumentReview(
      facts.review,
      "organization-document-review",
      lifecycleResolver(facts),
    );
    await repository.commitLifecycleFact(
      facts.verified,
      "organization-verification-decision",
      lifecycleResolver(facts),
    );
    await repository.commitLifecycleFact(
      facts.suspension,
      "organization-compliance-suspension",
      lifecycleResolver(facts),
    );
    await repository.commitAppeal(facts.appeal, "organization-suspension-appeal", appealResolver(facts));
    await repository.commitAppealDecision(
      facts.appealDecision,
      "organization-appeal-resolution",
      appealDecisionResolver(facts),
    );
    await repository.commitLifecycleFact(
      facts.reinstatement,
      "organization-appeal-reinstatement",
      lifecycleResolver(facts),
    );

    const projection = await repository.getProjection(subjectOrganizationId, facts.reinstatement.actor.id);
    assert.equal(projection.currentStatus, "verified");
    assert.equal(projection.currentTrustLevel, "institutional");
    assert.equal(projection.latestOrganizationSequence, 8);
    assert.equal(projection.openAppealIds.length, 0);
    assert.deepEqual(
      await repository.getAuthoritySnapshot(subjectOrganizationId, facts.reinstatement.actor.id),
      facts.snapshot,
    );
    const mirror = await db.query<{ verification_status: string; trust_level: string }>(
      `SELECT verification_status, trust_level FROM organizations.organizations WHERE id = $1`,
      [subjectOrganizationId],
    );
    assert.deepEqual(mirror.rows[0], {
      verification_status: "verified",
      trust_level: "institutional",
    });

    await assert.rejects(
      db.query(
        `UPDATE organizations.organizations
         SET verification_status = 'revoked', trust_level = 'suspended'
         WHERE id = $1`,
        [subjectOrganizationId],
      ),
      /STATUS_REQUIRES_CANONICAL_LIFECYCLE_FACT/,
    );
    await setTenant(db, subjectOrganizationId, facts.reinstatement.actor.id);
    await assert.rejects(
      db.query(
        `UPDATE organizations.organization_lifecycle_facts
         SET reason_code = 'legal_revocation' WHERE id = $1`,
        [facts.anchor.id],
      ),
      /append-only|cannot be updated or deleted/i,
    );
    assert.equal(await count(db, "organizations.organization_lifecycle_facts", subjectOrganizationId), 5);
    assert.equal(await count(db, "organizations.organization_document_review_facts", subjectOrganizationId), 1);
    assert.equal(await count(db, "organizations.organization_appeal_facts", subjectOrganizationId), 1);
    assert.equal(await count(db, "organizations.organization_appeal_decision_facts", subjectOrganizationId), 1);
    assert.equal(await count(db, "audit.command_receipts", subjectOrganizationId), 8);

    await db.exec("CREATE ROLE canopyproof_organization_lifecycle_reader NOLOGIN NOBYPASSRLS");
    await db.exec("GRANT USAGE ON SCHEMA organizations TO canopyproof_organization_lifecycle_reader");
    await db.exec(
      `GRANT SELECT ON
        organizations.organization_lifecycle_facts,
        organizations.organization_document_review_facts,
        organizations.organization_appeal_facts,
        organizations.organization_appeal_decision_facts
       TO canopyproof_organization_lifecycle_reader`,
    );
    const hidden = await db.transaction(async (transaction) => {
      await transaction.query("SET LOCAL ROLE canopyproof_organization_lifecycle_reader");
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [
        "org_lifecycle_other_tenant",
      ]);
      return transaction.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM organizations.organization_lifecycle_facts`,
      );
    });
    assert.equal(hidden.rows[0]?.count, 0);
    await assert.rejects(db.exec(rollbackSql), /ORGANIZATION_LIFECYCLE_ROLLBACK_BLOCKED_FACTS_EXIST/);
  } finally {
    await db.close();
  }
});

test("revoked or stale governance accreditation fails closed inside the database transaction", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await seedAuthority(db);
    const facts = authorityFixture();
    const repository = new PrismaCanopyProofOrganizationLifecycleRepository(pglitePrismaClient(db));
    await repository.commitLifecycleFact(facts.anchor, "stale-anchor-command", lifecycleResolver(facts));
    await repository.commitLifecycleFact(
      facts.documentReviewTransition,
      "stale-document-transition",
      lifecycleResolver(facts),
    );
    await repository.commitDocumentReview(facts.review, "stale-document-review", lifecycleResolver(facts));

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [facts.verified.actor.id]);
      await transaction.query(
        `INSERT INTO organizations.accreditations (
          id, organization_id, status, scope, decided_by, decided_at,
          rationale, evidence_hash, audit_event_root
        ) VALUES ('accreditation_lifecycle_suspended', $1, 'suspended',
          $2::text[], $3, $4,
          'Governance authority suspended for deterministic stale-authority testing.', $5, $6)`,
        [
          governanceOrganizationId,
          allScopes,
          facts.verified.actor.id,
          "2026-07-19T02:30:00.000Z",
          root("suspended-accreditation-evidence"),
          root("suspended-accreditation-audit"),
        ],
      );
    });
    await assert.rejects(
      repository.commitLifecycleFact(
        facts.verified,
        "stale-verification-decision",
        lifecycleResolver(facts),
      ),
      /LIFECYCLE_TRANSITION_INVALID|INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED|ACTOR/i,
    );
    await setTenant(db, subjectOrganizationId, facts.verified.actor.id);
    assert.equal(await count(db, "organizations.organization_lifecycle_facts", subjectOrganizationId), 2);
    assert.equal(await count(db, "audit.command_receipts", subjectOrganizationId), 3);
    const eventCount = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.domain_events
       WHERE stream_id = $1`,
      [`organization-lifecycle:${subjectOrganizationId}`],
    );
    assert.equal(eventCount.rows[0]?.count, 3);
  } finally {
    await db.close();
  }
});

test("registration reference drift is rejected inside the database transaction", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await seedAuthority(db);
    const facts = authorityFixture();
    const repository = new PrismaCanopyProofOrganizationLifecycleRepository(pglitePrismaClient(db));
    await repository.commitLifecycleFact(facts.anchor, "registration-drift-anchor", lifecycleResolver(facts));
    await repository.commitLifecycleFact(
      facts.documentReviewTransition,
      "registration-drift-document-transition",
      lifecycleResolver(facts),
    );

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", ["subject-owner"]);
      await transaction.query(
        `UPDATE organizations.organizations
         SET registration_number = 'CP-ORG-PGLITE-REPLACED', updated_at = $2
         WHERE id = $1`,
        [subjectOrganizationId, "2026-07-19T01:30:00.000Z"],
      );
    });

    await assert.rejects(
      repository.commitDocumentReview(
        facts.review,
        "registration-drift-review",
        lifecycleResolver(facts),
      ),
      /DOCUMENT_REVIEW_FACT_INVALID|registration/i,
    );
    await setTenant(db, subjectOrganizationId, facts.review.reviewer.id);
    assert.equal(await count(db, "organizations.organization_lifecycle_facts", subjectOrganizationId), 2);
    assert.equal(await count(db, "organizations.organization_document_review_facts", subjectOrganizationId), 0);
    assert.equal(await count(db, "audit.command_receipts", subjectOrganizationId), 2);
    const eventCount = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.domain_events
       WHERE stream_id = $1`,
      [`organization-lifecycle:${subjectOrganizationId}`],
    );
    assert.equal(eventCount.rows[0]?.count, 2);
  } finally {
    await db.close();
  }
});

test("organization lifecycle migration rollback removes only route-closed authority objects", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(rollbackSql);
    const relations = await db.query<{ relation_name: string | null }>(
      `SELECT to_regclass('organizations.organization_lifecycle_facts')::text AS relation_name`,
    );
    assert.equal(relations.rows[0]?.relation_name, null);
    const baseRelation = await db.query<{ relation_name: string | null }>(
      `SELECT to_regclass('organizations.organizations')::text AS relation_name`,
    );
    assert.equal(baseRelation.rows[0]?.relation_name, "organizations.organizations");
  } finally {
    await db.close();
  }
});

async function assertSqlRoots(db: PGlite, fact: CanopyProofOrganizationLifecycleFact) {
  const result = await db.query<{
    command_hash: string;
    lifecycle_hash: string;
    lifecycle_root: string;
    source_root: string;
    payload_hash: string;
  }>(
    `SELECT
       organizations.organization_lifecycle_command_hash($1::jsonb) AS command_hash,
       organizations.organization_authority_fact_hash($1::jsonb, 'lifecycle') AS lifecycle_hash,
       organizations.organization_authority_fact_root(
         $1::jsonb, 'lifecycle', organizations.organization_authority_fact_hash($1::jsonb, 'lifecycle')
       ) AS lifecycle_root,
       organizations.organization_lifecycle_source_root($1::jsonb) AS source_root,
       audit.sha256_stable_json($1::jsonb - 'auditEvent') AS payload_hash`,
    [JSON.stringify(fact)],
  );
  assert.deepEqual(result.rows[0], {
    command_hash: fact.commandHash,
    lifecycle_hash: fact.lifecycleHash,
    lifecycle_root: fact.lifecycleRoot,
    source_root: fact.sourceRoot,
    payload_hash: fact.auditEvent.payloadHash,
  });
}

async function assertSqlEvent(db: PGlite, fact: CanopyProofOrganizationLifecycleFact) {
  const rollback = new Error("ROLLBACK_EVENT_PREFLIGHT");
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [fact.organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [fact.actor.id]);
      await transaction.query(
        `INSERT INTO audit.domain_events (
          id, stream_id, action, actor_id, entity_type, entity_id,
          previous_root, payload_hash, event_root, created_at, rationale
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          fact.auditEvent.id,
          `organization-lifecycle:${fact.organizationId}`,
          fact.auditEvent.action,
          fact.auditEvent.actor,
          fact.auditEvent.entityType,
          fact.auditEvent.entityId,
          fact.auditEvent.previousRoot,
          fact.auditEvent.payloadHash,
          fact.auditEvent.eventRoot,
          fact.auditEvent.createdAt,
          fact.auditEvent.rationale,
        ],
      );
      const result = await transaction.query<Record<string, boolean>>(
        `SELECT
          organizations.organization_authority_event_is_valid(
            $1::jsonb, $2, $3, $4, $5, $6::timestamptz
          ) AS valid,
          event.stream_id = 'organization-lifecycle:' || ($1::jsonb->>'organizationId') AS stream_valid,
          event.sequence_no = ($1::jsonb->>'organizationSequence')::bigint AS sequence_valid,
          event.action = $3 AS action_valid,
          event.actor_id = $5 AS actor_valid,
          event.entity_type = $4 AS entity_type_valid,
          event.entity_id = $1::jsonb->>'id' AS entity_id_valid,
          event.previous_root = $1::jsonb->>'previousEventRoot' AS previous_valid,
          event.payload_hash = audit.sha256_stable_json($1::jsonb - 'auditEvent') AS payload_valid,
          event.event_root = $1::jsonb->'auditEvent'->>'eventRoot' AS event_root_valid,
          event.created_at = $6::timestamptz AS created_valid,
          $1::jsonb->'auditEvent'->>'actor' = $5 AS document_actor_valid,
          $1::jsonb->'auditEvent'->>'entityType' = $4 AS document_type_valid,
          $1::jsonb->'auditEvent'->>'entityId' = $1::jsonb->>'id' AS document_id_valid,
          $1::jsonb->'auditEvent'->>'previousRoot' = $1::jsonb->>'previousEventRoot' AS document_previous_valid,
          $1::jsonb->'auditEvent'->>'payloadHash' = event.payload_hash AS document_payload_valid,
          ($1::jsonb->'auditEvent'->>'createdAt')::timestamptz = $6::timestamptz AS document_created_valid
        FROM audit.domain_events event WHERE event.event_root = $2`,
        [
          JSON.stringify(fact),
          fact.auditEvent.eventRoot,
          fact.auditEvent.action,
          fact.auditEvent.entityType,
          fact.auditEvent.actor,
          fact.auditEvent.createdAt,
        ],
      );
      assert.deepEqual(
        result.rows[0],
        Object.fromEntries(Object.keys(result.rows[0] ?? {}).map((key) => [key, true])),
      );
      throw rollback;
    }),
    (error: unknown) => error === rollback,
  );
}

function authorityFixture() {
  const service = new CanopyProofOrganizationLifecycleAuthorityService();
  const anchor = service.anchorOrganization(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      documentRoots: [],
      rationale: "The registered organization profile was anchored for deterministic institutional review.",
      sourceEventRoots: [root("registration-event")],
      anchoredAt: "2026-07-19T00:00:00.000Z",
    },
    subjectActor("subject-owner", "pending", "owner"),
  );
  const documentReviewTransition = service.transitionOrganization(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      documentRoots,
      toStatus: "document_review",
      reasonCode: "documents_submitted",
      rationale: "The subject submitted exact registration and mandate commitments for independent review.",
      sourceEventRoots: [root("document-submission-event")],
      decidedAt: "2026-07-19T01:00:00.000Z",
    },
    subjectActor("subject-owner", "pending", "owner"),
  );
  const review = service.reviewDocuments(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      registrationReferenceRoot,
      documentRoots,
      decision: "accepted",
      reasonCode: "identity_documents_valid",
      rationale: "Independent review confirmed the hash-bound registration and institutional mandate documents.",
      conflictDisclosure: "The reviewer has no employment, funding, ownership, or family conflict with the subject.",
      sourceEventRoots: [root("review-source")],
      reviewedAt: "2026-07-19T02:00:00.000Z",
    },
    governanceActor("document-reviewer", "researcher"),
  );
  const verified = service.transitionOrganization(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      documentRoots,
      toStatus: "verified",
      trustLevel: "institutional",
      reasonCode: "verification_approved",
      rationale: "A separate governance authority approved the organization after accepted document review.",
      sourceEventRoots: [root("verification-source")],
      acceptedReviewId: review.id,
      decidedAt: "2026-07-19T03:00:00.000Z",
    },
    governanceActor("verification-decider", "admin"),
  );
  const suspension = service.transitionOrganization(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      documentRoots,
      toStatus: "suspended",
      reasonCode: "compliance_suspension",
      rationale: "A documented compliance concern requires temporary suspension pending independent review.",
      sourceEventRoots: [root("suspension-source")],
      decidedAt: "2026-07-19T04:00:00.000Z",
    },
    governanceActor("suspension-governor", "verifier"),
  );
  const appeal = service.openAppeal(
    {
      organizationId: subjectOrganizationId,
      challengedLifecycleFactId: suspension.id,
      reasonCode: "material_new_evidence",
      requestedRemedy: "reinstatement",
      grounds: "New independently produced evidence materially changes the basis of the suspension action.",
      evidenceEventRoots: [root("appeal-evidence")],
      submittedAt: "2026-07-19T05:00:00.000Z",
    },
    subjectActor("subject-owner", "suspended", "owner"),
  );
  const appealDecision = service.decideAppeal(
    {
      organizationId: subjectOrganizationId,
      appealId: appeal.id,
      decision: "upheld",
      remedy: "reinstate",
      rationale: "Independent review confirmed that the new evidence removes the suspension basis.",
      conflictDisclosure: "The appeal reviewer did not participate in the original action and has no subject relationship.",
      sourceEventRoots: [root("appeal-decision-source")],
      decidedAt: "2026-07-19T06:00:00.000Z",
    },
    governanceActor("appeal-resolver", "researcher"),
  );
  const reinstatement = service.transitionOrganization(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      documentRoots,
      toStatus: "verified",
      trustLevel: "institutional",
      reasonCode: "appeal_reinstatement",
      rationale: "A separate human authority reinstated the organization after the upheld appeal decision.",
      sourceEventRoots: [root("reinstatement-source")],
      appealDecisionId: appealDecision.id,
      decidedAt: "2026-07-19T07:00:00.000Z",
    },
    governanceActor("reinstatement-authorizer", "admin"),
  );
  return {
    anchor,
    documentReviewTransition,
    review,
    verified,
    suspension,
    appeal,
    appealDecision,
    reinstatement,
    snapshot: service.getAuthoritySnapshot(),
  };
}

function lifecycleResolver(facts: ReturnType<typeof authorityFixture>): CanopyProofOrganizationLifecycleAuthorityResolver {
  return async (query) => {
    const lifecycleFact = [
      facts.anchor,
      facts.documentReviewTransition,
      facts.verified,
      facts.suspension,
      facts.reinstatement,
    ].find((fact) => fact.actor.id === query.actorId && fact.decidedAt === query.effectiveAt);
    const actor =
      query.operation === "document_review" &&
      facts.review.reviewer.id === query.actorId &&
      facts.review.reviewedAt === query.effectiveAt
        ? facts.review.reviewer
        : lifecycleFact?.actor;
    if (!actor) throw new Error(`missing actor fixture: ${query.actorId}/${query.effectiveAt}`);
    return { actor, profileRoot, registrationReferenceRoot, documentRoots: query.documentRoots };
  };
}

function appealResolver(facts: ReturnType<typeof authorityFixture>): CanopyProofOrganizationAppealAuthorityResolver {
  return async (query) => {
    const submitter = facts.appeal.submitter;
    if (submitter.id !== query.submitterId) throw new Error(`missing submitter fixture: ${query.submitterId}`);
    return { submitter, profileRoot };
  };
}

function appealDecisionResolver(
  facts: ReturnType<typeof authorityFixture>,
): CanopyProofOrganizationAppealDecisionAuthorityResolver {
  return async (query) => {
    const reviewer = facts.appealDecision.reviewer;
    if (reviewer.id !== query.reviewerId) throw new Error(`missing reviewer fixture: ${query.reviewerId}`);
    return { reviewer };
  };
}

async function seedAuthority(db: PGlite) {
  const identities = [
    ["subject-owner", subjectOrganizationId, "owner"],
    ["document-reviewer", governanceOrganizationId, "researcher"],
    ["verification-decider", governanceOrganizationId, "admin"],
    ["suspension-governor", governanceOrganizationId, "verifier"],
    ["appeal-resolver", governanceOrganizationId, "researcher"],
    ["reinstatement-authorizer", governanceOrganizationId, "admin"],
  ] as const;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", ["verification-decider"]);
    for (const [id, organizationId, role] of identities) {
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES ($1, 'human', $2, $3, ARRAY[$4]::text[], 'verified', 80,
          ARRAY[]::text[], $5, $6, $6)`,
        [
          id,
          `Lifecycle ${role}`,
          organizationId,
          role,
          participantRoot(id),
          "2026-07-18T00:00:00.000Z",
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, operating_regions,
        registration_number, verification_capabilities, verification_status, trust_level,
        accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES
        ($1, 'Lifecycle Subject', 'ngo', 'Lifecycle Subject', 'GLOBAL', ARRAY['global']::text[],
          $2, ARRAY['restoration']::text[], 'pending', 'unverified', 'pending', 'restricted', $3, $4, $4),
        ($5, 'Lifecycle Governance', 'un_agency', 'Lifecycle Governance', 'GLOBAL', ARRAY['global']::text[],
          'CP-GOV-PGLITE-001', ARRAY['institutional_identity_governance']::text[], 'verified', 'institutional', 'approved',
          'restricted', $6, $4, $4)`,
      [
        subjectOrganizationId,
        registrationNumber,
        profileRoot,
        "2026-07-18T00:00:00.000Z",
        governanceOrganizationId,
        organizationRoot(governanceOrganizationId),
      ],
    );
    for (const [id, organizationId, role] of identities) {
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, $4, 'active',
          'No disclosed conflict for this deterministic organization authority fixture.',
          'verification-decider', $5, $5, $6)`,
        [
          `membership_${id}`,
          organizationId,
          id,
          role,
          "2026-07-18T00:01:00.000Z",
          membershipRoot(id, organizationId, role),
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES ('accreditation_lifecycle_governance', $1, 'approved', $2::text[],
        'verification-decider', $3,
        'Institutional organization lifecycle fixture accreditation.', $4, $5)`,
      [
        governanceOrganizationId,
        allScopes,
        "2026-07-18T00:02:00.000Z",
        root("governance-accreditation-evidence"),
        accreditationRoot(),
      ],
    );
  });
}

function subjectActor(
  id: string,
  status: "pending" | "verified" | "suspended" | "revoked",
  role: "owner" | "admin",
) {
  return actor(id, subjectOrganizationId, status, role, false);
}

function governanceActor(id: string, role: "owner" | "admin" | "verifier" | "researcher") {
  return actor(id, governanceOrganizationId, "verified", role, true);
}

function actor(
  id: string,
  organizationId: string,
  organizationVerificationStatus: "pending" | "verified" | "suspended" | "revoked",
  role: "owner" | "admin" | "verifier" | "researcher",
  accredited: boolean,
): CanopyProofOrganizationLifecycleActorSnapshot {
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus,
    participantRoot: participantRoot(id),
    organizationRoot: organizationRoot(organizationId),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: membershipRoot(id, organizationId, role),
    ...(accredited
      ? {
          accreditationId: "accreditation_lifecycle_governance",
          accreditationStatus: "approved" as const,
          accreditationRoot: accreditationRoot(),
        }
      : {}),
    accreditationScope: accredited ? allScopes : [],
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function participantRoot(id: string) {
  return hashJson({ kind: "organization-lifecycle-pglite-participant", id });
}

function organizationRoot(organizationId: string) {
  return hashJson({ kind: "organization-lifecycle-pglite-organization", organizationId });
}

function membershipRoot(id: string, organizationId: string, role: string) {
  return hashJson({ kind: "organization-lifecycle-pglite-membership", id, organizationId, role });
}

function accreditationRoot() {
  return hashJson({ kind: "organization-lifecycle-pglite-accreditation", allScopes });
}

function root(label: string) {
  return hashJson({ kind: "organization-lifecycle-pglite-root", label });
}

async function setTenant(db: PGlite, organizationId: string, actorId: string) {
  await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
  await db.exec(`SELECT set_config('app.actor_id', '${actorId}', false)`);
}

async function count(db: PGlite, relation: string, organizationId: string) {
  if (!/^[a-z_]+\.[a-z_]+$/.test(relation)) throw new Error("invalid relation fixture");
  await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
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
