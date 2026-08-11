import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofEarlyWarningCandidate,
  buildCanopyProofEarlyWarningControl,
  buildCanopyProofEarlyWarningPublication,
  buildCanopyProofEarlyWarningReview,
  canopyProofEarlyWarningScopes,
  type CanopyProofEarlyWarningCandidateInput,
} from "../../services/api/src/domain/canopyproof/early-warning-authority.js";
import { PrismaCanopyProofEarlyWarningRepository } from "../../services/api/src/domain/canopyproof/early-warning-postgres.js";

const baseSql = readFileSync(
  join(process.cwd(), "services/api/prisma/canopyproof-os.sql"),
  "utf8",
);
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/early-warning-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/early-warning-authority.rollback.sql"),
  "utf8",
);

const organizationId = "org_early_warning_pglite";
const scopeId = "region_early_warning_pglite";
const allScopes = Object.values(canopyProofEarlyWarningScopes).sort();

test("early-warning PostgreSQL authority is atomic, tenant-bound, fail-closed, and replayable", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await seedAuthority(db);

    const preparer = actor("risk_pglite_preparer", "researcher");
    const scientificReviewer = actor("risk_pglite_scientist", "researcher");
    const operationalReviewer = actor("risk_pglite_operator", "verifier");
    const publisher = actor("risk_pglite_publisher", "admin");
    const governor = actor("risk_pglite_governor", "verifier");
    const candidate = buildCanopyProofEarlyWarningCandidate(
      candidateInput("2026-08-01T00:00:00.000Z"),
      preparer,
    );
    const scientificReview = buildCanopyProofEarlyWarningReview(
      {
        candidate,
        reviewKind: "scientific",
        decision: "accepted",
        reasonCode: "source_consistent",
        rationale:
          "Independent scientific review confirms the bounded source and indicator lineage.",
        reviewedAt: "2026-07-19T02:00:00.000Z",
      },
      scientificReviewer,
    );
    const operationalReview = buildCanopyProofEarlyWarningReview(
      {
        candidate,
        reviewKind: "operational",
        decision: "accepted",
        reasonCode: "audience_window_appropriate",
        rationale:
          "Independent operational review confirms the bounded audience and validity window.",
        reviewedAt: "2026-07-19T03:00:00.000Z",
      },
      operationalReviewer,
    );
    const publication = buildCanopyProofEarlyWarningPublication(
      {
        candidate,
        scientificReview,
        operationalReview,
        predecessorPublicationRoot: null,
        publishedAt: "2026-07-19T05:00:00.000Z",
      },
      publisher,
    );
    const repository = new PrismaCanopyProofEarlyWarningRepository(
      pglitePrismaClient(db),
    );

    const reviewPreflight = await db.query<{
      candidate_valid: boolean;
      preparer_current: boolean;
      reviewer_current: boolean;
      candidate_root: string;
      command_hash: string;
      review_root: string;
    }>(
      `SELECT impact.validate_early_warning_candidate($1::jsonb) AS candidate_valid,
        impact.early_warning_preparer_is_current(
          $1::jsonb->'preparer', $2, $3
        ) AS preparer_current,
        impact.early_warning_human_actor_is_current(
          $4::jsonb, $5, $3, 'risk:scientific-review',
          ARRAY['verifier','researcher']::text[]
        ) AS reviewer_current,
        impact.early_warning_candidate_root($1::jsonb) AS candidate_root,
        impact.early_warning_review_command_hash($6::jsonb) AS command_hash,
        impact.early_warning_review_root($6::jsonb) AS review_root`,
      [
        JSON.stringify(candidate),
        preparer.id,
        organizationId,
        JSON.stringify(scientificReviewer),
        scientificReviewer.id,
        JSON.stringify(scientificReview),
      ],
    );
    assert.deepEqual(reviewPreflight.rows[0], {
      candidate_valid: true,
      preparer_current: true,
      reviewer_current: true,
      candidate_root: candidate.candidateRoot,
      command_hash: scientificReview.commandHash,
      review_root: scientificReview.reviewRoot,
    });

    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-early-warning-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      liveFeedEnabled: false,
      notificationDeliveryEnabled: false,
      emergencyDeclarationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      threeIndependentAccreditedHumansRequired: true,
      adverseStateNeverFallsBack: true,
    });

    const scientificResolver = async () => ({
      candidate,
      reviewer: scientificReviewer,
    });
    const operationalResolver = async () => ({
      candidate,
      reviewer: operationalReviewer,
    });
    assert.deepEqual(
      await repository.commitReview(
        scientificReview,
        "risk-scientific-review-pglite-001",
        scientificResolver,
      ),
      scientificReview,
    );
    assert.deepEqual(
      await repository.commitReview(
        scientificReview,
        "risk-scientific-review-pglite-001",
        scientificResolver,
      ),
      scientificReview,
    );
    assert.deepEqual(
      await repository.commitReview(
        operationalReview,
        "risk-operational-review-pglite-001",
        operationalResolver,
      ),
      operationalReview,
    );
    assert.deepEqual(
      await repository.commitReview(
        operationalReview,
        "risk-operational-review-pglite-001",
        operationalResolver,
      ),
      operationalReview,
    );

    const publicationResolver = async () => ({
      candidate,
      scientificReviewer,
      operationalReviewer,
      publisher,
    });
    assert.deepEqual(
      await repository.commitPublication(
        publication,
        "risk-publication-pglite-001",
        publicationResolver,
      ),
      publication,
    );
    assert.deepEqual(
      await repository.commitPublication(
        publication,
        "risk-publication-pglite-001",
        publicationResolver,
      ),
      publication,
    );

    const active = await repository.resolveCurrentProjection({
      organizationId,
      actorId: publisher.id,
      scopeId,
      riskClass: "drought",
      evaluatedAt: "2026-07-20T00:00:00.000Z",
    });
    assert.equal(active?.state, "active");
    assert.deepEqual(active?.publicProjection, publication.publicProjection);
    assert.equal(
      await repository.resolveCurrentProjection({
        organizationId: "org_early_warning_other",
        actorId: publisher.id,
        scopeId,
        riskClass: "drought",
        evaluatedAt: "2026-07-20T00:00:00.000Z",
      }),
      undefined,
    );

    const restarted = new PrismaCanopyProofEarlyWarningRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(
      await restarted.resolveCurrentProjection({
        organizationId,
        actorId: publisher.id,
        scopeId,
        riskClass: "drought",
        evaluatedAt: "2026-07-20T00:00:00.000Z",
      }),
      active,
    );
    assert.equal(
      (
        await restarted.resolveCurrentProjection({
          organizationId,
          actorId: publisher.id,
          scopeId,
          riskClass: "drought",
          evaluatedAt: "2026-08-01T00:00:00.001Z",
        })
      )?.state,
      "expired",
    );

    const control = buildCanopyProofEarlyWarningControl(
      {
        publication,
        action: "challenge",
        reasonCode: "scientific_dispute",
        rationale:
          "A qualified independent reviewer disputed the current source interpretation.",
        controlledAt: "2026-07-21T00:00:00.000Z",
      },
      governor,
      [publication.auditEvent],
    );
    const controlResolver = async () => ({ governor });
    assert.deepEqual(
      await repository.commitControl(
        control,
        "risk-control-pglite-001",
        controlResolver,
      ),
      control,
    );
    assert.deepEqual(
      await repository.commitControl(
        control,
        "risk-control-pglite-001",
        controlResolver,
      ),
      control,
    );
    const challenged = await restarted.resolveCurrentProjection({
      organizationId,
      actorId: governor.id,
      scopeId,
      riskClass: "drought",
      evaluatedAt: "2026-07-22T00:00:00.000Z",
    });
    assert.equal(challenged?.state, "challenged");
    assert.equal(challenged?.controlRoot, control.controlRoot);

    const sqlRoots = await db.query<{
      candidate_root: string;
      source_member_root: string;
      indicator_member_root: string;
      scientific_review_root: string;
      operational_review_root: string;
      projection_root: string;
      publication_root: string;
      control_root: string;
    }>(
      `SELECT impact.early_warning_candidate_root($1::jsonb) AS candidate_root,
        impact.early_warning_member_root($2::jsonb) AS source_member_root,
        impact.early_warning_member_root($3::jsonb) AS indicator_member_root,
        impact.early_warning_review_root($4::jsonb) AS scientific_review_root,
        impact.early_warning_review_root($5::jsonb) AS operational_review_root,
        impact.early_warning_projection_root($6::jsonb) AS projection_root,
        impact.early_warning_publication_root($7::jsonb) AS publication_root,
        impact.early_warning_control_root($8::jsonb) AS control_root`,
      [
        JSON.stringify(candidate),
        JSON.stringify(candidate.sources.map((source) => source.memberRoot)),
        JSON.stringify(candidate.indicators.map((indicator) => indicator.memberRoot)),
        JSON.stringify(scientificReview),
        JSON.stringify(operationalReview),
        JSON.stringify(publication.publicProjection),
        JSON.stringify(publication),
        JSON.stringify(control),
      ],
    );
    assert.deepEqual(sqlRoots.rows[0], {
      candidate_root: candidate.candidateRoot,
      source_member_root: candidate.sourceMemberRoot,
      indicator_member_root: candidate.indicatorMemberRoot,
      scientific_review_root: scientificReview.reviewRoot,
      operational_review_root: operationalReview.reviewRoot,
      projection_root: publication.publicProjection.projectionRoot,
      publication_root: publication.publicationRoot,
      control_root: control.controlRoot,
    });

    assert.equal(await count(db, "impact.early_warning_review_facts"), 2);
    assert.equal(await count(db, "impact.early_warning_publication_facts"), 1);
    assert.equal(await count(db, "impact.early_warning_control_facts"), 1);
    assert.equal(await count(db, "audit.command_receipts"), 4);
    assert.equal(await count(db, "audit.domain_events"), 4);
    const mutationAudit = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.event_log
       WHERE schema_name = 'impact'
         AND table_name IN (
           'early_warning_review_facts',
           'early_warning_publication_facts',
           'early_warning_control_facts'
         )`,
    );
    assert.equal(mutationAudit.rows[0]?.count, 4);

    const rowSecurity = await db.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      policy_count: number;
    }>(
      `SELECT class.relname, class.relrowsecurity, class.relforcerowsecurity,
        count(policy.policyname)::integer AS policy_count
       FROM pg_class class
       JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
       LEFT JOIN pg_policies policy
         ON policy.schemaname = namespace.nspname AND policy.tablename = class.relname
       WHERE namespace.nspname = 'impact'
         AND class.relname IN (
           'early_warning_review_facts',
           'early_warning_publication_facts',
           'early_warning_control_facts'
         )
       GROUP BY class.relname, class.relrowsecurity, class.relforcerowsecurity
       ORDER BY class.relname`,
    );
    assert.deepEqual(rowSecurity.rows, [
      {
        relname: "early_warning_control_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
      {
        relname: "early_warning_publication_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
      {
        relname: "early_warning_review_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
    ]);

    await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
    await db.exec(`SELECT set_config('app.actor_id', '${publisher.id}', false)`);
    await assert.rejects(
      db.query(
        "UPDATE impact.early_warning_publication_facts SET published_at = published_at + interval '1 second' WHERE id = $1",
        [publication.id],
      ),
      /audit records are append-only/i,
    );
    await assert.rejects(
      db.query("DELETE FROM impact.early_warning_review_facts WHERE id = $1", [
        scientificReview.id,
      ]),
      /audit records are append-only/i,
    );

    const changedCandidate = buildCanopyProofEarlyWarningCandidate(
      {
        ...candidateInput("2026-08-02T00:00:00.000Z"),
        advisoryCode: "drought_watch_changed",
        summary:
          "Changed deterministic candidate proves current authority and exact retry denial.",
      },
      preparer,
    );
    const changedReview = buildCanopyProofEarlyWarningReview(
      {
        candidate: changedCandidate,
        reviewKind: "scientific",
        decision: "accepted",
        reasonCode: "source_consistent_changed",
        rationale:
          "The changed immutable source and indicator roots remain internally consistent.",
        reviewedAt: "2026-07-19T02:01:00.000Z",
      },
      scientificReviewer,
    );
    await assert.rejects(
      repository.commitReview(
        changedReview,
        "risk-review-current-authority-change",
        async () => ({ candidate, reviewer: scientificReviewer }),
      ),
      /CURRENT_REVIEW_AUTHORITY_INVALID/,
    );
    await assert.rejects(
      repository.commitReview(
        changedReview,
        "risk-scientific-review-pglite-001",
        async () => ({ candidate: changedCandidate, reviewer: scientificReviewer }),
      ),
      /IDEMPOTENCY_CONFLICT/,
    );
    await assert.rejects(
      db.query(
        `INSERT INTO impact.early_warning_review_facts (
          id, organization_id, scope_id, scope_type, risk_class, candidate_root,
          source_authority_root, review_kind, decision, reviewer_id,
          reviewer_snapshot, reviewed_at, review_root, audit_event_root, fact_record
        ) VALUES ($1, $2, $3, 'region', 'drought', $4, $5, 'scientific',
          'accepted', $6, $7::jsonb, $8, $9, $10, $11::jsonb)`,
        [
          changedReview.id,
          organizationId,
          scopeId,
          changedCandidate.candidateRoot,
          changedCandidate.sourceAuthorityRoot,
          scientificReviewer.id,
          JSON.stringify(scientificReviewer),
          changedReview.reviewedAt,
          changedReview.reviewRoot,
          changedReview.auditEvent.eventRoot,
          JSON.stringify(changedReview),
        ],
      ),
      /query returned no rows|foreign key|violates foreign key/i,
    );
    await assert.rejects(
      db.exec(rollbackSql),
      /CANOPYPROOF_EARLY_WARNING_ROLLBACK_REFUSES_NON_EMPTY_AUTHORITY/,
    );
  } finally {
    await db.close();
  }
});

test("early-warning rollback removes only an empty authority", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(rollbackSql);
    const relations = await db.query<{ relation_name: string | null }>(
      `SELECT to_regclass('impact.early_warning_review_facts')::text AS relation_name`,
    );
    assert.equal(relations.rows[0]?.relation_name, null);
  } finally {
    await db.close();
  }
});

function candidateInput(validUntil: string): CanopyProofEarlyWarningCandidateInput {
  return {
    organizationId,
    organizationPublicId: "org_public_early_warning_pglite",
    scopeType: "region",
    scopeId,
    scopePublicId: "region_public_early_warning_pglite",
    scopeAuthorityRoot: "a".repeat(64),
    riskClass: "drought",
    severity: "high",
    confidenceBps: 8_200,
    advisoryCode: "drought_watch_pglite_v1",
    summary:
      "Observed moisture deficit exceeds the governed drought advisory threshold.",
    intendedAudiences: ["operator", "community", "government"],
    sources: [
      {
        sourceType: "satellite_observation",
        sourceId: "satellite_observation_pglite_001",
        sourceRoot: "b".repeat(64),
        observedAt: "2026-07-19T00:20:00.000Z",
        receivedAt: "2026-07-19T00:40:00.000Z",
        provenancePolicyRoot: "c".repeat(64),
      },
      {
        sourceType: "field_evidence",
        sourceId: "field_evidence_pglite_001",
        sourceRoot: "d".repeat(64),
        observedAt: "2026-07-19T00:10:00.000Z",
        receivedAt: "2026-07-19T00:30:00.000Z",
        provenancePolicyRoot: "e".repeat(64),
      },
    ],
    indicators: [
      {
        indicatorKey: "soil_moisture_pct",
        valueScaled: 1_200,
        scale: 100,
        unit: "percent",
        thresholdScaled: 1_800,
        thresholdScale: 100,
        comparison: "lte",
      },
      {
        indicatorKey: "rainfall_deficit_index",
        valueScaled: 7_100,
        scale: 100,
        unit: "index_points",
        thresholdScaled: 6_500,
        thresholdScale: 100,
        comparison: "gte",
      },
    ],
    observationStart: "2026-07-19T00:00:00.000Z",
    observationEnd: "2026-07-19T00:30:00.000Z",
    policyId: "early_warning_policy_pglite_v1",
    policyVersion: "1.0.0",
    policyRoot: "f".repeat(64),
    validFrom: "2026-07-19T04:00:00.000Z",
    validUntil,
    preparedAt: "2026-07-19T01:00:00.000Z",
  };
}

function actor(
  id: string,
  role: "admin" | "verifier" | "researcher",
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "early-warning-pglite-participant", id }),
    organizationRoot: hashJson({ kind: "early-warning-pglite-organization", organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "early-warning-pglite-membership", id, role }),
    accreditationId: "accreditation_early_warning_pglite",
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({
      kind: "early-warning-pglite-accreditation",
      organizationId,
      allScopes,
    }),
    accreditationScope: allScopes,
  };
  return {
    ...normalized,
    authorityRoot: hashJson({
      kind: "canopyproof-verification-actor-authority-v1",
      ...normalized,
    }),
  };
}

async function seedAuthority(db: PGlite) {
  const identities = [
    ["risk_pglite_preparer", "researcher"],
    ["risk_pglite_scientist", "researcher"],
    ["risk_pglite_operator", "verifier"],
    ["risk_pglite_publisher", "admin"],
    ["risk_pglite_governor", "verifier"],
  ] as const;
  const organizationRoot = hashJson({
    kind: "early-warning-pglite-organization",
    organizationId,
  });
  const accreditationRoot = hashJson({
    kind: "early-warning-pglite-accreditation",
    organizationId,
    allScopes,
  });
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [
      identities[3][0],
    ]);
    for (const [id, role] of identities) {
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES ($1, 'human', $2, $3, ARRAY[$4]::text[], 'verified', 80,
          ARRAY[]::text[], $5, $6, $6)`,
        [
          id,
          `Early warning ${role}`,
          organizationId,
          role,
          hashJson({ kind: "early-warning-pglite-participant", id }),
          "2026-07-18T00:00:00.000Z",
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, operating_regions,
        verification_capabilities, verification_status, trust_level,
        accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES ($1, 'Early Warning PGlite Authority', 'research_institution',
        'Early Warning PGlite Authority', 'GLOBAL', ARRAY['global']::text[],
        ARRAY['environmental_risk_review']::text[], 'verified', 'institutional',
        'approved', 'restricted', $2, $3, $3)`,
      [organizationId, organizationRoot, "2026-07-18T00:00:00.000Z"],
    );
    for (const [id, role] of identities) {
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, $4, 'active',
          'No disclosed conflict for this deterministic fixture.', $5, $6, $6, $7)`,
        [
          `membership_${id}`,
          organizationId,
          id,
          role,
          identities[3][0],
          "2026-07-18T00:01:00.000Z",
          hashJson({ kind: "early-warning-pglite-membership", id, role }),
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES ('accreditation_early_warning_pglite', $1, 'approved',
        $2::text[], $3, $4,
        'Institutional early-warning fixture accreditation.', $5, $6)`,
      [
        organizationId,
        allScopes,
        identities[3][0],
        "2026-07-18T00:02:00.000Z",
        hashJson({ kind: "early-warning-pglite-accreditation-evidence" }),
        accreditationRoot,
      ],
    );
  });
}

async function count(db: PGlite, relation: string) {
  if (!/^[a-z_]+\.[a-z_]+$/.test(relation)) {
    throw new Error("invalid relation fixture");
  }
  await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
  const result = await db.query<{ count: number }>(
    `SELECT count(*)::integer AS count FROM ${relation}`,
  );
  return result.rows[0]?.count;
}

function pglitePrismaClient(db: PGlite) {
  const client = {
    async $transaction<T>(
      operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    ) {
      return db.transaction((transaction) =>
        operation(pgliteTransactionClient(transaction)),
      );
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
