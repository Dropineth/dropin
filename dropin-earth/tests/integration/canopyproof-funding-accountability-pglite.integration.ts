import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";
import {
  buildCanopyProofFundingAccountabilityCandidate,
  buildCanopyProofFundingAccountabilityControl,
  buildCanopyProofFundingAccountabilityPublication,
  buildCanopyProofFundingAccountabilityReview,
  canopyProofFundingAccountabilityScopes,
  type CanopyProofFundingAccountabilityCandidateInput,
} from "../../services/api/src/domain/canopyproof/funding-accountability-authority.js";
import { PrismaCanopyProofFundingAccountabilityRepository } from "../../services/api/src/domain/canopyproof/funding-accountability-postgres.js";

const baseSql = readFileSync(
  join(process.cwd(), "services/api/prisma/canopyproof-os.sql"),
  "utf8",
);
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/funding-accountability-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/funding-accountability-authority.rollback.sql"),
  "utf8",
);

const organizationId = "org_funding_accountability_pglite";
const projectId = "project_funding_accountability_pglite";
const allScopes = Object.values(canopyProofFundingAccountabilityScopes).sort();
const projectFixture = new CanopyProofProjectRegistryService().registerProject(
  {
    id: projectId,
    organizationId,
    title: "Funding Accountability Project",
    projectType: "reforestation",
    regionId: "funding-pglite-region",
    location: { latitude: 14.75, longitude: -17.4, areaHectares: 12.5 },
    targetTreeCount: 2_500,
    biodiversityIndicators: ["native_species_richness"],
    waterIndicators: ["soil_moisture"],
    climateRiskIndicators: ["drought_exposure"],
    monitoringCadenceDays: 90,
    status: "submitted",
    createdAt: "2026-06-30T00:03:00.000Z",
  },
  "funding_pglite_publisher",
  "admin",
);

test("funding accountability PostgreSQL authority is atomic, tenant-bound, fail-closed, and replayable", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await seedAuthority(db);

    const preparer = actor("funding_pglite_preparer", "researcher");
    const reviewer = actor("funding_pglite_reviewer", "verifier");
    const publisher = actor("funding_pglite_publisher", "admin");
    const governor = actor("funding_pglite_governor", "verifier");
    const candidate = buildCanopyProofFundingAccountabilityCandidate(
      candidateInput("2026-08-01T00:00:00.000Z"),
      preparer,
    );
    const review = buildCanopyProofFundingAccountabilityReview(
      {
        candidate,
        decision: "approved",
        reviewedAt: "2026-07-01T02:00:00.000Z",
        rationale: "The immutable funding source and milestone proof members reconcile under policy.",
      },
      reviewer,
    );
    const publication = buildCanopyProofFundingAccountabilityPublication(
      {
        candidate,
        review,
        publishedAt: "2026-07-01T03:00:00.000Z",
      },
      publisher,
    );
    const repository = new PrismaCanopyProofFundingAccountabilityRepository(
      pglitePrismaClient(db),
    );

    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-funding-accountability-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      threeIndependentAccreditedHumansRequired: true,
      challengeAndWithdrawalFailClosed: true,
    });

    const reviewResolver = async () => ({ candidate, reviewer });
    assert.deepEqual(
      await repository.commitReview(review, "funding-review-pglite-001", reviewResolver),
      review,
    );
    assert.deepEqual(
      await repository.commitReview(review, "funding-review-pglite-001", reviewResolver),
      review,
    );

    const publicationResolver = async () => ({ candidate, reviewer, publisher });
    assert.deepEqual(
      await repository.commitPublication(
        publication,
        "funding-publication-pglite-001",
        publicationResolver,
      ),
      publication,
    );
    assert.deepEqual(
      await repository.commitPublication(
        publication,
        "funding-publication-pglite-001",
        publicationResolver,
      ),
      publication,
    );

    const active = await repository.resolveCurrentProjection({
      organizationId,
      actorId: publisher.id,
      projectId,
      evaluatedAt: "2026-07-10T00:00:00.000Z",
    });
    assert.equal(active?.state, "active");
    assert.deepEqual(active?.operationalTotals, candidate.totals);
    assert.equal(
      await repository.resolveCurrentProjection({
        organizationId: "org_funding_accountability_other",
        actorId: publisher.id,
        projectId,
        evaluatedAt: "2026-07-10T00:00:00.000Z",
      }),
      undefined,
    );

    const restarted = new PrismaCanopyProofFundingAccountabilityRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(
      await restarted.resolveCurrentProjection({
        organizationId,
        actorId: publisher.id,
        projectId,
        evaluatedAt: "2026-07-10T00:00:00.000Z",
      }),
      active,
    );
    assert.equal(
      (
        await restarted.resolveCurrentProjection({
          organizationId,
          actorId: publisher.id,
          projectId,
          evaluatedAt: "2026-08-01T00:00:00.001Z",
        })
      )?.state,
      "expired",
    );

    const control = buildCanopyProofFundingAccountabilityControl(
      {
        publication,
        action: "challenge",
        reasonCode: "proof_record_challenged",
        rationale: "A referenced proof record entered challenge and operational totals must fail closed.",
        controlledAt: "2026-07-12T00:00:00.000Z",
      },
      governor,
      [publication.auditEvent],
    );
    const controlResolver = async () => ({ governor });
    assert.deepEqual(
      await repository.commitControl(control, "funding-control-pglite-001", controlResolver),
      control,
    );
    assert.deepEqual(
      await repository.commitControl(control, "funding-control-pglite-001", controlResolver),
      control,
    );
    const challenged = await restarted.resolveCurrentProjection({
      organizationId,
      actorId: governor.id,
      projectId,
      evaluatedAt: "2026-07-13T00:00:00.000Z",
    });
    assert.equal(challenged?.state, "challenged");
    assert.equal(challenged?.operationalTotals.reconciledCents, 0);
    assert.equal(challenged?.operationalTotals.challengedCents, candidate.allocatedCents);

    const sqlRoots = await db.query<{
      candidate_root: string;
      review_root: string;
      projection_root: string;
      publication_root: string;
      control_root: string;
    }>(
      `SELECT funding.accountability_candidate_root($1::jsonb) AS candidate_root,
        funding.accountability_review_root($2::jsonb) AS review_root,
        funding.accountability_projection_root($3::jsonb) AS projection_root,
        funding.accountability_publication_root($4::jsonb) AS publication_root,
        funding.accountability_control_root($5::jsonb) AS control_root`,
      [
        JSON.stringify(candidate),
        JSON.stringify(review),
        JSON.stringify(publication.publicProjection),
        JSON.stringify(publication),
        JSON.stringify(control),
      ],
    );
    assert.deepEqual(sqlRoots.rows[0], {
      candidate_root: candidate.candidateRoot,
      review_root: review.reviewRoot,
      projection_root: publication.publicProjection.projectionRoot,
      publication_root: publication.publicationRoot,
      control_root: control.controlRoot,
    });

    assert.equal(await count(db, "funding.accountability_review_facts"), 1);
    assert.equal(await count(db, "funding.accountability_publication_facts"), 1);
    assert.equal(await count(db, "funding.accountability_control_facts"), 1);
    assert.equal(await count(db, "audit.command_receipts"), 3);
    assert.equal(await count(db, "audit.domain_events"), 4);
    const mutationAudit = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.event_log
       WHERE schema_name = 'funding'
         AND table_name IN (
           'accountability_review_facts',
           'accountability_publication_facts',
           'accountability_control_facts'
         )`,
    );
    assert.equal(mutationAudit.rows[0]?.count, 3);

    await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
    await db.exec(`SELECT set_config('app.actor_id', '${publisher.id}', false)`);
    await assert.rejects(
      db.query(
        "UPDATE funding.accountability_publication_facts SET published_at = published_at + interval '1 second' WHERE id = $1",
        [publication.id],
      ),
      /audit records are append-only/i,
    );
    await assert.rejects(
      db.query("DELETE FROM funding.accountability_review_facts WHERE id = $1", [review.id]),
      /audit records are append-only/i,
    );

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
       WHERE namespace.nspname = 'funding'
         AND class.relname IN (
           'accountability_review_facts',
           'accountability_publication_facts',
           'accountability_control_facts'
         )
       GROUP BY class.relname, class.relrowsecurity, class.relforcerowsecurity
       ORDER BY class.relname`,
    );
    assert.deepEqual(rowSecurity.rows, [
      {
        relname: "accountability_control_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
      {
        relname: "accountability_publication_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
      {
        relname: "accountability_review_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
    ]);

    const changedCandidate = buildCanopyProofFundingAccountabilityCandidate(
      candidateInput("2026-08-02T00:00:00.000Z"),
      preparer,
    );
    const changedReview = buildCanopyProofFundingAccountabilityReview(
      {
        candidate: changedCandidate,
        decision: "approved",
        reviewedAt: "2026-07-01T02:01:00.000Z",
        rationale: "This changed candidate exists only to prove current authority and exact retry denial.",
      },
      reviewer,
    );
    await assert.rejects(
      repository.commitReview(
        changedReview,
        "funding-review-current-authority-change",
        async () => ({ candidate, reviewer }),
      ),
      /CURRENT_REVIEW_AUTHORITY_INVALID/,
    );
    await assert.rejects(
      repository.commitReview(
        changedReview,
        "funding-review-pglite-001",
        async () => ({ candidate: changedCandidate, reviewer }),
      ),
      /IDEMPOTENCY_CONFLICT/,
    );

    await assert.rejects(
      db.query(
        `INSERT INTO funding.accountability_review_facts (
          id, organization_id, project_id, candidate_root, source_authority_root,
          decision, reviewer_id, reviewer_snapshot, reviewed_at, review_root,
          audit_event_root, fact_record
        ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7::jsonb,
          $8, $9, $10, $11::jsonb)`,
        [
          changedReview.id,
          organizationId,
          projectId,
          changedReview.candidate.candidateRoot,
          changedReview.candidate.sourceAuthorityRoot,
          reviewer.id,
          JSON.stringify(reviewer),
          changedReview.reviewedAt,
          changedReview.reviewRoot,
          "f".repeat(64),
          JSON.stringify(changedReview),
        ],
      ),
      /query returned no rows|foreign key|violates foreign key/i,
    );
    await assert.rejects(
      db.exec(rollbackSql),
      /CANOPYPROOF_FUNDING_ACCOUNTABILITY_ROLLBACK_REFUSED_NON_EMPTY/,
    );
  } finally {
    await db.close();
  }
});

test("funding accountability rollback removes only an empty authority", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(rollbackSql);
    const relations = await db.query<{ relation_name: string | null }>(
      `SELECT to_regclass('funding.accountability_review_facts')::text AS relation_name`,
    );
    assert.equal(relations.rows[0]?.relation_name, null);
  } finally {
    await db.close();
  }
});

function candidateInput(validUntil: string): CanopyProofFundingAccountabilityCandidateInput {
  return {
    organizationId,
    projectId,
    projectAuthorityRoot: projectFixture.projectRoot,
    sourcePublicId: "funding_source_public_pglite_001",
    sourceType: "grant",
    sourceJurisdictionCode: "UN-MULTI",
    sourceRestriction: "milestone_restricted",
    commitmentCents: 100_000,
    sourceDocumentRoot: "b".repeat(64),
    fundingSourceAuthorityRoot: "c".repeat(64),
    allocationId: "funding_allocation_pglite_001",
    purposeCode: "restoration_field_delivery",
    allocatedCents: 80_000,
    allocatedAt: "2026-02-01T00:00:00.000Z",
    milestones: [
      {
        milestoneId: "milestone_b",
        amountCents: 20_000,
        dueAt: "2026-06-15T00:00:00.000Z",
        status: "challenged",
        evidenceRoots: ["3".repeat(64)],
        proofRecordRoots: [],
      },
      {
        milestoneId: "milestone_a",
        amountCents: 50_000,
        dueAt: "2026-05-15T00:00:00.000Z",
        status: "reconciled",
        evidenceRoots: ["1".repeat(64)],
        proofRecordRoots: ["2".repeat(64)],
      },
    ],
    reportingPeriodStart: "2026-01-01T00:00:00.000Z",
    reportingPeriodEnd: "2026-06-30T00:00:00.000Z",
    policyId: "funding_accountability_policy_pglite_v1",
    policyRoot: "d".repeat(64),
    validFrom: "2026-07-01T01:00:00.000Z",
    validUntil,
    preparedAt: "2026-07-01T00:00:00.000Z",
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
    participantRoot: hashJson({ kind: "funding-accountability-pglite-participant", id }),
    organizationRoot: hashJson({ kind: "funding-accountability-pglite-organization", organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "funding-accountability-pglite-membership", id, role }),
    accreditationId: "accreditation_funding_accountability_pglite",
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({
      kind: "funding-accountability-pglite-accreditation",
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
    ["funding_pglite_preparer", "researcher"],
    ["funding_pglite_reviewer", "verifier"],
    ["funding_pglite_publisher", "admin"],
    ["funding_pglite_governor", "verifier"],
  ] as const;
  const organizationRoot = hashJson({
    kind: "funding-accountability-pglite-organization",
    organizationId,
  });
  const accreditationRoot = hashJson({
    kind: "funding-accountability-pglite-accreditation",
    organizationId,
    allScopes,
  });
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [
      identities[2][0],
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
          `Funding accountability ${role}`,
          organizationId,
          role,
          hashJson({ kind: "funding-accountability-pglite-participant", id }),
          "2026-06-30T00:00:00.000Z",
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, operating_regions,
        verification_capabilities, verification_status, trust_level,
        accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES ($1, 'Funding Accountability PGlite Authority', 'auditor',
        'Funding Accountability PGlite Authority', 'GLOBAL', ARRAY['global']::text[],
        ARRAY['funding_reconciliation']::text[], 'verified', 'institutional',
        'approved', 'restricted', $2, $3, $3)`,
      [organizationId, organizationRoot, "2026-06-30T00:00:00.000Z"],
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
          identities[2][0],
          "2026-06-30T00:01:00.000Z",
          hashJson({ kind: "funding-accountability-pglite-membership", id, role }),
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES ('accreditation_funding_accountability_pglite', $1, 'approved',
        $2::text[], $3, $4,
        'Institutional funding accountability fixture accreditation.', $5, $6)`,
      [
        organizationId,
        allScopes,
        identities[2][0],
        "2026-06-30T00:02:00.000Z",
        hashJson({ kind: "funding-accountability-pglite-accreditation-evidence" }),
        accreditationRoot,
      ],
    );
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
        created_at, updated_at, project_hash,
        project_root, audit_event_root, audit_history, claim_boundary
      ) VALUES ($1, $2, 'funding-pglite-region', 'Funding Accountability Project',
        'reforestation', 'submitted', $3::jsonb, $4, $5, $6::text[], $7::text[],
        $8::text[], $9, $10, 'admin', $11, $11, $12, $13, $14, $15::jsonb, $16::jsonb)`,
      [
        projectFixture.id,
        projectFixture.organizationId,
        JSON.stringify(projectFixture.location),
        projectFixture.location.areaHectares,
        projectFixture.targetTreeCount,
        projectFixture.biodiversityIndicators,
        projectFixture.waterIndicators,
        projectFixture.climateRiskIndicators,
        projectFixture.monitoringCadenceDays,
        projectFixture.createdBy,
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

async function count(db: PGlite, relation: string) {
  if (!/^[a-z_]+\.[a-z_]+$/.test(relation)) throw new Error("invalid relation fixture");
  await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
  const result = await db.query<{ count: number }>(
    `SELECT count(*)::integer AS count FROM ${relation}`,
  );
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
