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
  buildCanopyProofGlobalCommandCenterSpatialCandidate,
  buildCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  buildCanopyProofGlobalCommandCenterSpatialReview,
  buildCanopyProofGlobalCommandCenterSpatialWithdrawal,
  canopyProofGlobalCommandCenterSpatialDisclosureScopes,
} from "../../services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-authority.js";
import { PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository } from "../../services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-postgres.js";

const baseSql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/global-command-center-spatial-disclosure-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/global-command-center-spatial-disclosure-authority.rollback.sql"),
  "utf8",
);
const organizationId = "org_spatial_pglite_authority";
const regionId = "region_spatial_pglite_001";
const regionSourceRoot = "1".repeat(64);
const allScopes = Object.values(canopyProofGlobalCommandCenterSpatialDisclosureScopes).sort();

test("Global spatial disclosure PostgreSQL authority is atomic, tenant-bound, withdrawable, and replayable", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await seedAuthority(db);

    const privacyReviewer = actor("spatial_pglite_privacy", "verifier");
    const safeguardingReviewer = actor("spatial_pglite_safeguarding", "verifier");
    const publisher = actor("spatial_pglite_publisher", "admin");
    const governor = actor("spatial_pglite_governor", "verifier");
    const candidate = candidateAt("2026-07-19T11:00:00.000Z", "2026-07-20T00:00:00.000Z");
    const privacyReview = buildCanopyProofGlobalCommandCenterSpatialReview(
      {
        candidate,
        reviewKind: "privacy",
        decision: "approved",
        reviewedAt: "2026-07-19T11:00:00.000Z",
        rationale: "The one-degree regional centroid satisfies the approved privacy minimization policy.",
      },
      privacyReviewer,
    );
    const safeguardingReview = buildCanopyProofGlobalCommandCenterSpatialReview(
      {
        candidate,
        reviewKind: "safeguarding",
        decision: "approved",
        reviewedAt: "2026-07-19T11:01:00.000Z",
        rationale: "Protected habitat and community safeguarding checks permit this generalized disclosure.",
      },
      safeguardingReviewer,
    );
    const disclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      {
        candidate,
        privacyReview,
        safeguardingReview,
        publishedAt: "2026-07-19T11:02:00.000Z",
      },
      publisher,
    );
    const repository = new PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository(
      pglitePrismaClient(db),
    );

    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-global-command-center-spatial-disclosure-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanReviewsRequired: true,
      withdrawalFailClosed: true,
    });

    const privacyResolver = async () => ({ candidate, reviewer: privacyReviewer });
    const safeguardingResolver = async () => ({ candidate, reviewer: safeguardingReviewer });
    assert.deepEqual(
      await repository.commitReview(privacyReview, "spatial-review-privacy-001", privacyResolver),
      privacyReview,
    );
    assert.deepEqual(
      await repository.commitReview(privacyReview, "spatial-review-privacy-001", privacyResolver),
      privacyReview,
    );
    assert.deepEqual(
      await repository.commitReview(
        safeguardingReview,
        "spatial-review-safeguarding-001",
        safeguardingResolver,
      ),
      safeguardingReview,
    );
    const publicationResolver = async () => ({
      candidate,
      publisher,
      privacyReviewer,
      safeguardingReviewer,
    });
    assert.deepEqual(
      await repository.commitDisclosure(disclosure, "spatial-disclosure-001", publicationResolver),
      disclosure,
    );
    assert.deepEqual(
      await repository.commitDisclosure(disclosure, "spatial-disclosure-001", publicationResolver),
      disclosure,
    );

    assert.deepEqual(
      await repository.resolveCurrentDisclosure({
        organizationId,
        actorId: publisher.id,
        regionId,
        regionSourceRoot,
        sourceProjectCount: 4,
        at: "2026-07-19T11:03:00.000Z",
      }),
      disclosure.disclosure,
    );
    const restarted = new PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(
      await restarted.resolveCurrentDisclosure({
        organizationId,
        actorId: publisher.id,
        regionId,
        regionSourceRoot,
        sourceProjectCount: 4,
        at: "2026-07-19T11:03:00.000Z",
      }),
      disclosure.disclosure,
    );
    assert.equal(
      await restarted.resolveCurrentDisclosure({
        organizationId,
        actorId: publisher.id,
        regionId,
        regionSourceRoot: "2".repeat(64),
        sourceProjectCount: 4,
        at: "2026-07-19T11:03:00.000Z",
      }),
      undefined,
    );
    assert.equal(
      await restarted.resolveCurrentDisclosure({
        organizationId,
        actorId: publisher.id,
        regionId,
        regionSourceRoot,
        sourceProjectCount: 4,
        at: "2026-07-20T00:00:00.001Z",
      }),
      undefined,
    );

    const sqlRoots = await db.query<{
      candidate_root: string;
      review_root: string;
      disclosure_root: string;
      publication_root: string;
    }>(
      `SELECT impact.global_spatial_candidate_root($1::jsonb) AS candidate_root,
        impact.global_spatial_review_root($2::jsonb) AS review_root,
        impact.global_spatial_public_disclosure_root($3::jsonb) AS disclosure_root,
        impact.global_spatial_publication_root($4::jsonb) AS publication_root`,
      [
        JSON.stringify(candidate),
        JSON.stringify(privacyReview),
        JSON.stringify(disclosure.disclosure),
        JSON.stringify(disclosure),
      ],
    );
    assert.deepEqual(sqlRoots.rows[0], {
      candidate_root: candidate.candidateRoot,
      review_root: privacyReview.reviewRoot,
      disclosure_root: disclosure.disclosureRoot,
      publication_root: disclosure.publicationRoot,
    });

    const withdrawal = buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
      {
        disclosure,
        reasonCode: "safeguarding_risk",
        rationale: "A new protected habitat concern requires immediate fail-closed withdrawal.",
        controlledAt: "2026-07-19T11:04:00.000Z",
      },
      governor,
      [disclosure.auditEvent],
    );
    assert.deepEqual(
      await repository.commitWithdrawal(
        withdrawal,
        "spatial-withdrawal-001",
        async () => ({ governor }),
      ),
      withdrawal,
    );
    assert.deepEqual(
      await repository.commitWithdrawal(
        withdrawal,
        "spatial-withdrawal-001",
        async () => ({ governor }),
      ),
      withdrawal,
    );
    assert.equal(
      await repository.resolveCurrentDisclosure({
        organizationId,
        actorId: governor.id,
        regionId,
        regionSourceRoot,
        sourceProjectCount: 4,
        at: "2026-07-19T11:05:00.000Z",
      }),
      undefined,
    );

    assert.equal(await count(db, "impact.global_command_center_spatial_review_facts"), 2);
    assert.equal(await count(db, "impact.global_command_center_spatial_disclosure_facts"), 1);
    assert.equal(await count(db, "impact.global_command_center_spatial_control_facts"), 1);
    assert.equal(await count(db, "audit.command_receipts"), 4);
    assert.equal(await count(db, "audit.domain_events"), 4);
    const mutationAudit = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.event_log
       WHERE schema_name = 'impact'
         AND table_name IN (
           'global_command_center_spatial_review_facts',
           'global_command_center_spatial_disclosure_facts',
           'global_command_center_spatial_control_facts'
         )`,
    );
    assert.equal(mutationAudit.rows[0]?.count, 4);

    await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);
    await db.exec(`SELECT set_config('app.actor_id', '${publisher.id}', false)`);
    await assert.rejects(
      db.query(
        "UPDATE impact.global_command_center_spatial_disclosure_facts SET published_at = published_at + interval '1 second' WHERE id = $1",
        [disclosure.id],
      ),
      /audit records are append-only/i,
    );
    await assert.rejects(
      db.query("DELETE FROM impact.global_command_center_spatial_review_facts WHERE id = $1", [privacyReview.id]),
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
       WHERE namespace.nspname = 'impact'
         AND class.relname IN (
           'global_command_center_spatial_review_facts',
           'global_command_center_spatial_disclosure_facts',
           'global_command_center_spatial_control_facts'
         )
       GROUP BY class.relname, class.relrowsecurity, class.relforcerowsecurity
       ORDER BY class.relname`,
    );
    assert.deepEqual(rowSecurity.rows, [
      {
        relname: "global_command_center_spatial_control_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
      {
        relname: "global_command_center_spatial_disclosure_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
      {
        relname: "global_command_center_spatial_review_facts",
        relrowsecurity: true,
        relforcerowsecurity: true,
        policy_count: 1,
      },
    ]);
    await db.exec(`SELECT set_config('app.organization_id', '${organizationId}', false)`);

    const changedCandidate = candidateAt("2026-07-19T11:00:00.000Z", "2026-07-21T00:00:00.000Z");
    const changedReview = buildCanopyProofGlobalCommandCenterSpatialReview(
      {
        candidate: changedCandidate,
        reviewKind: "privacy",
        decision: "approved",
        reviewedAt: "2026-07-19T11:06:00.000Z",
        rationale: "This second candidate exists only to prove current-source and idempotency rejection.",
      },
      privacyReviewer,
    );
    await assert.rejects(
      repository.commitReview(
        changedReview,
        "spatial-review-current-source-change",
        async () => ({ candidate, reviewer: privacyReviewer }),
      ),
      /CURRENT_REVIEW_AUTHORITY_INVALID/,
    );
    await assert.rejects(
      repository.commitReview(
        changedReview,
        "spatial-review-privacy-001",
        async () => ({ candidate: changedCandidate, reviewer: privacyReviewer }),
      ),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.equal(await count(db, "impact.global_command_center_spatial_review_facts"), 2);

    await assert.rejects(
      db.query(
        `INSERT INTO impact.global_command_center_spatial_review_facts (
          id, organization_id, region_id, candidate_root, region_source_root,
          source_project_count, review_kind, decision, reviewer_id, reviewer_snapshot,
          reviewed_at, review_root, audit_event_root, fact_record
        ) VALUES ($1, $2, $3, $4, $5, 4, 'privacy', 'approved',
          $6, $7::jsonb, $8, $9, $10, $11::jsonb)`,
        [
          changedReview.id,
          organizationId,
          regionId,
          changedCandidate.candidateRoot,
          changedCandidate.regionSourceRoot,
          privacyReviewer.id,
          JSON.stringify(privacyReviewer),
          changedReview.reviewedAt,
          changedReview.reviewRoot,
          "f".repeat(64),
          JSON.stringify(changedReview),
        ],
      ),
      /query returned no rows|foreign key|violates foreign key/i,
    );
    await assert.rejects(db.exec(rollbackSql), /rollback refused.*spatial disclosure facts exist/i);
  } finally {
    await db.close();
  }
});

function candidateAt(validFrom: string, validUntil: string) {
  return buildCanopyProofGlobalCommandCenterSpatialCandidate({
    schemaVersion: "canopyproof.global-command-center.spatial-disclosure.v1",
    organizationId,
    regionId,
    centroid: { latitudeDegrees: 15, longitudeDegrees: -17 },
    precisionDegrees: 1,
    sourceProjectCount: 4,
    minimumCohortSize: 3,
    regionSourceRoot,
    policyId: "cp_spatial_policy_pglite_v1",
    policyRoot: "9".repeat(64),
    validFrom,
    validUntil,
  });
}

function actor(id: string, role: "admin" | "verifier"): CanopyProofVerificationActorSnapshot {
  const participantRoot = hashJson({ kind: "spatial-pglite-participant", id });
  const organizationRoot = hashJson({ kind: "spatial-pglite-organization", organizationId });
  const membershipRoot = hashJson({ kind: "spatial-pglite-membership", id, role });
  const accreditationRoot = hashJson({ kind: "spatial-pglite-accreditation", organizationId, allScopes });
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot,
    organizationRoot,
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot,
    accreditationId: "accreditation_spatial_pglite_authority",
    accreditationStatus: "approved" as const,
    accreditationRoot,
    accreditationScope: allScopes,
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

async function seedAuthority(db: PGlite) {
  const ids = [
    ["spatial_pglite_privacy", "verifier"],
    ["spatial_pglite_safeguarding", "verifier"],
    ["spatial_pglite_publisher", "admin"],
    ["spatial_pglite_governor", "verifier"],
  ] as const;
  const organizationRoot = hashJson({ kind: "spatial-pglite-organization", organizationId });
  const accreditationRoot = hashJson({ kind: "spatial-pglite-accreditation", organizationId, allScopes });
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [ids[2][0]]);
    for (const [id, role] of ids) {
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES ($1, 'human', $2, $3, ARRAY[$4]::text[], 'verified', 80,
          ARRAY[]::text[], $5, $6, $6)`,
        [
          id,
          `Spatial PGlite ${role}`,
          organizationId,
          role,
          hashJson({ kind: "spatial-pglite-participant", id }),
          "2026-07-19T10:00:00.000Z",
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, operating_regions,
        verification_capabilities, verification_status, trust_level,
        accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES ($1, 'Spatial PGlite Authority', 'auditor', 'Spatial PGlite Authority',
        'GLOBAL', ARRAY['global']::text[], ARRAY['spatial_review']::text[],
        'verified', 'institutional', 'approved', 'restricted', $2, $3, $3)`,
      [organizationId, organizationRoot, "2026-07-19T10:00:00.000Z"],
    );
    for (const [id, role] of ids) {
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, $4, 'active', 'No disclosed conflict for this deterministic fixture.',
          $5, $6, $6, $7)`,
        [
          `membership_${id}`,
          organizationId,
          id,
          role,
          ids[2][0],
          "2026-07-19T10:00:00.000Z",
          hashJson({ kind: "spatial-pglite-membership", id, role }),
        ],
      );
    }
    await transaction.query(
      `INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES ('accreditation_spatial_pglite_authority', $1, 'approved', $2::text[],
        $3, $4, 'Institutional spatial review fixture accreditation.', $5, $6)`,
      [
        organizationId,
        allScopes,
        ids[2][0],
        "2026-07-19T10:00:00.000Z",
        hashJson({ kind: "spatial-pglite-accreditation-evidence", organizationId }),
        accreditationRoot,
      ],
    );
  });
}

async function count(db: PGlite, relation: string) {
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
