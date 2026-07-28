import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import { CanopyProofEarlyWarningService } from "../../services/api/src/domain/canopyproof/early-warning.js";
import { CanopyProofFundingTransparencyService } from "../../services/api/src/domain/canopyproof/funding-transparency.js";
import {
  buildCanopyProofGlobalCommandCenterGovernanceApproval,
  buildCanopyProofGlobalCommandCenterPublication,
  buildCanopyProofGlobalCommandCenterSourceAuthorityRoot,
  canopyProofGlobalCommandCenterPublishingScopes,
} from "../../services/api/src/domain/canopyproof/global-command-center-publishing-authority.js";
import { PrismaCanopyProofGlobalCommandCenterPublishingRepository } from "../../services/api/src/domain/canopyproof/global-command-center-publishing-postgres.js";
import {
  buildCanopyProofGlobalCommandCenter,
  type CanopyProofGlobalCommandCenterSnapshot,
} from "../../services/api/src/domain/canopyproof/global-command-center.js";
import { PrismaCanopyProofGlobalCommandCenterRepository } from "../../services/api/src/domain/canopyproof/global-command-center-postgres.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";
import { CanopyProofService } from "../../services/api/src/domain/canopyproof/proof-service.js";
import { TerraProofService } from "../../services/api/src/domain/canopyproof/terra-intelligence.js";

const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/global-command-center-publishing-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/global-command-center-publishing-authority.rollback.sql"),
  "utf8",
);
const publisherId = "global_command_center_pglite_projector";
const organizationId = "org_global_command_center_pglite_authority";
const policyId = "cp_global_projection_policy_v1";
const policyRoot = "9".repeat(64);

test("Global Command Center governed PostgreSQL publication is atomic, replayable, and append-only", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(sql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await seedPublisher(db);
    const publisher = actor(
      publisherId,
      "agent",
      "agent",
      canopyProofGlobalCommandCenterPublishingScopes.publish,
    );
    const governor = actor(
      "global_command_center_pglite_governor",
      "human",
      "verifier",
      canopyProofGlobalCommandCenterPublishingScopes.govern,
    );
    const snapshot = snapshotAt("2026-07-18T09:01:00.000Z");
    const sourceAuthorityRoot = buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(snapshot);
    const approval = buildCanopyProofGlobalCommandCenterGovernanceApproval(
      {
        id: "cp_global_projection_pglite_approval_001",
        dashboardRoot: snapshot.lineage.dashboardRoot,
        sourceAuthorityRoot,
        policyId,
        policyRoot,
        maxSnapshotAgeSeconds: 600,
        approvedAt: "2026-07-18T09:00:00.000Z",
        validFrom: "2026-07-18T09:00:00.000Z",
        validUntil: "2026-07-18T09:10:00.000Z",
      },
      governor,
    );
    const publication = buildCanopyProofGlobalCommandCenterPublication(
      {
        snapshot,
        sourceAuthorityRoot,
        policyId,
        policyRoot,
        publishedAt: "2026-07-18T09:02:00.000Z",
      },
      { publisher, governanceApproval: approval },
    );
    const prisma = pglitePrismaClient(db);
    const writer = new PrismaCanopyProofGlobalCommandCenterPublishingRepository(prisma);
    const resolveCurrent = async () => ({
      snapshot,
      sourceAuthorityRoot,
      publisher,
      governor,
    });

    assert.deepEqual(writer.getStatus(), {
      service: "canopyproof-global-command-center-publishing-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanGovernanceRequired: true,
    });
    const committed = await writer.commitPublication(
      snapshot,
      publication,
      "global-projection-pglite-001",
      resolveCurrent,
    );
    assert.deepEqual(committed, { snapshot, publication });
    assert.deepEqual(
      await writer.commitPublication(snapshot, publication, "global-projection-pglite-001", resolveCurrent),
      committed,
    );

    const reader = new PrismaCanopyProofGlobalCommandCenterRepository(prisma);
    assert.deepEqual(await reader.getLatestSnapshot(), snapshot);
    const restartedWriter = new PrismaCanopyProofGlobalCommandCenterPublishingRepository(pglitePrismaClient(db));
    assert.deepEqual(await restartedWriter.getPublication(publication.id), committed);
    const restartedReader = new PrismaCanopyProofGlobalCommandCenterRepository(pglitePrismaClient(db));
    assert.deepEqual(await restartedReader.getLatestSnapshot(), snapshot);

    assert.equal(await count(db, "impact.global_command_center_snapshots"), 1);
    assert.equal(await count(db, "impact.global_command_center_publication_facts"), 1);
    assert.equal(await count(db, "audit.command_receipts"), 1);
    const semanticEvents = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM audit.domain_events
       WHERE stream_id = 'global-command-center:publications'`,
    );
    assert.equal(semanticEvents.rows[0]?.count, 1);
    const mutationAudit = await db.query<{ table_name: string; count: number }>(
      `SELECT table_name, count(*)::integer AS count
       FROM audit.event_log
       WHERE schema_name = 'impact'
         AND table_name IN ('global_command_center_snapshots', 'global_command_center_publication_facts')
       GROUP BY table_name ORDER BY table_name`,
    );
    assert.deepEqual(mutationAudit.rows, [
      { table_name: "global_command_center_publication_facts", count: 1 },
      { table_name: "global_command_center_snapshots", count: 1 },
    ]);

    await db.exec(`SELECT set_config('app.actor_id', '${publisherId}', false)`);
    await assert.rejects(
      db.query(
        "UPDATE impact.global_command_center_publication_facts SET published_at = published_at + interval '1 second' WHERE id = $1",
        [publication.id],
      ),
      /audit records are append-only/i,
    );
    await assert.rejects(
      db.query("DELETE FROM impact.global_command_center_snapshots WHERE id = $1", [publication.snapshotId]),
      /audit records are append-only/i,
    );

    const ungoverned = snapshotAt("2026-07-18T09:03:00.000Z");
    await assert.rejects(
      insertBareSnapshot(db, "cp_global_snapshot_without_publication", ungoverned),
      /requires exactly one governed publication fact/i,
    );

    const changed = snapshotAt("2026-07-18T09:01:01.000Z");
    await assert.rejects(
      writer.commitPublication(
        snapshot,
        publication,
        "global-projection-pglite-current-source-change",
        async () => ({ snapshot: changed, sourceAuthorityRoot, publisher, governor }),
      ),
      /CURRENT_SOURCE_AUTHORITY_INVALID|CURRENT_SOURCE_MISMATCH/,
    );
    const replacedGovernor = actor(
      "global_command_center_pglite_replaced_governor",
      "human",
      "verifier",
      canopyProofGlobalCommandCenterPublishingScopes.govern,
    );
    await assert.rejects(
      writer.commitPublication(
        snapshot,
        publication,
        "global-projection-pglite-authority-change",
        async () => ({ snapshot, sourceAuthorityRoot, publisher, governor: replacedGovernor }),
      ),
      /CURRENT_SOURCE_AUTHORITY_INVALID/,
    );
    assert.equal(await count(db, "impact.global_command_center_snapshots"), 1);

    const secondSnapshot = snapshotAt("2026-07-18T09:04:00.000Z");
    const secondSourceRoot = buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(secondSnapshot);
    const secondApproval = buildCanopyProofGlobalCommandCenterGovernanceApproval(
      {
        id: "cp_global_projection_pglite_approval_002",
        dashboardRoot: secondSnapshot.lineage.dashboardRoot,
        sourceAuthorityRoot: secondSourceRoot,
        policyId,
        policyRoot,
        maxSnapshotAgeSeconds: 600,
        approvedAt: "2026-07-18T09:03:00.000Z",
        validFrom: "2026-07-18T09:03:00.000Z",
        validUntil: "2026-07-18T09:15:00.000Z",
      },
      governor,
    );
    const secondPublication = buildCanopyProofGlobalCommandCenterPublication(
      {
        snapshot: secondSnapshot,
        sourceAuthorityRoot: secondSourceRoot,
        policyId,
        policyRoot,
        publishedAt: "2026-07-18T09:05:00.000Z",
      },
      { publisher, governanceApproval: secondApproval },
      [publication.auditEvent],
    );
    await assert.rejects(
      insertTamperedPublicationBundle(db, secondSnapshot, secondPublication),
      /publication semantic event binding is invalid/i,
    );
    assert.equal(await count(db, "impact.global_command_center_snapshots"), 1);
    assert.equal(await count(db, "audit.domain_events"), 1);
    await assert.rejects(
      writer.commitPublication(
        secondSnapshot,
        secondPublication,
        "global-projection-pglite-001",
        async () => ({
          snapshot: secondSnapshot,
          sourceAuthorityRoot: secondSourceRoot,
          publisher,
          governor,
        }),
      ),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.equal(await count(db, "impact.global_command_center_snapshots"), 1);
    await assert.rejects(db.exec(rollbackSql), /rollback refused.*publication facts exist/i);
  } finally {
    await db.close();
  }
});

async function insertTamperedPublicationBundle(
  db: PGlite,
  snapshot: CanopyProofGlobalCommandCenterSnapshot,
  publication: ReturnType<typeof buildCanopyProofGlobalCommandCenterPublication>,
) {
  return db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [publisherId]);
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1, 'global-command-center:publications', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        publication.auditEvent.id,
        publication.auditEvent.action,
        publication.auditEvent.actor,
        publication.auditEvent.entityType,
        publication.auditEvent.entityId,
        publication.auditEvent.previousRoot,
        publication.auditEvent.payloadHash,
        publication.auditEvent.eventRoot,
        publication.auditEvent.createdAt,
        publication.auditEvent.rationale,
      ],
    );
    await transaction.query(
      `INSERT INTO impact.global_command_center_snapshots (
        id, generated_at, metric_summary, regional_summaries, impact_indicators,
        recent_activity, lineage, safety_boundary, dashboard_root, created_by
      ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
      [
        publication.snapshotId,
        snapshot.generatedAt,
        JSON.stringify(snapshot.metrics),
        JSON.stringify(snapshot.regions),
        JSON.stringify(snapshot.impactIndicators),
        JSON.stringify(snapshot.recentActivity),
        JSON.stringify(snapshot.lineage),
        JSON.stringify(snapshot.safety),
        snapshot.lineage.dashboardRoot,
        publisherId,
      ],
    );
    const tamperedFact = {
      ...publication,
      auditEvent: { ...publication.auditEvent, payloadHash: "0".repeat(64) },
    };
    await transaction.query(
      `INSERT INTO impact.global_command_center_publication_facts (
        id, snapshot_id, projection_schema, dashboard_root, snapshot_content_root,
        source_authority_root, policy_id, policy_root, approval_root,
        publisher_id, publisher_snapshot, published_at, publication_root,
        audit_event_root, fact_record
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15::jsonb)`,
      [
        publication.id,
        publication.snapshotId,
        publication.projectionSchema,
        publication.dashboardRoot,
        publication.snapshotContentRoot,
        publication.sourceAuthorityRoot,
        publication.policyId,
        publication.policyRoot,
        publication.governanceApproval.approvalRoot,
        publication.publisher.id,
        JSON.stringify(publication.publisher),
        publication.publishedAt,
        publication.publicationRoot,
        publication.auditEvent.eventRoot,
        JSON.stringify(tamperedFact),
      ],
    );
  });
}

function snapshotAt(generatedAt: string) {
  const projectRegistry = new CanopyProofProjectRegistryService();
  projectRegistry.registerProject(
    {
      id: "cp_global_command_center_pglite_project_001",
      organizationId: "org_global_command_center_pglite_001",
      title: "PGlite governed spatial projection fixture",
      projectType: "ecosystem_restoration",
      regionId: "region_global_command_center_pglite_001",
      location: { latitude: 14.7, longitude: -17.4, areaHectares: 12 },
      targetTreeCount: 1_000,
      status: "submitted",
      createdAt: "2026-07-18T09:00:00.000Z",
    },
    publisherId,
  );
  return buildCanopyProofGlobalCommandCenter({
    projectRegistry,
    proof: new CanopyProofService(),
    terra: new TerraProofService(),
    risk: new CanopyProofEarlyWarningService(),
    funding: new CanopyProofFundingTransparencyService(),
    generatedAt,
  });
}

function actor(
  id: string,
  participantType: "human" | "agent",
  role: "agent" | "owner" | "admin" | "verifier" | "researcher",
  scope: string,
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "pglite-participant", id }),
    organizationRoot: hashJson({ kind: "pglite-organization", id: organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "pglite-membership", id }),
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "pglite-accreditation", id, scope }),
    accreditationScope: [scope],
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

async function seedPublisher(db: PGlite) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [publisherId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, roles, verification_status, reputation_score,
        credential_commitments, created_at, updated_at
      ) VALUES ($1, 'agent', 'Global projection test agent', ARRAY['observer']::text[],
        'verified', 0, ARRAY[]::text[], $2, $2)`,
      [publisherId, "2026-07-18T09:00:00.000Z"],
    );
  });
}

async function insertBareSnapshot(
  db: PGlite,
  id: string,
  snapshot: CanopyProofGlobalCommandCenterSnapshot,
) {
  return db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [publisherId]);
    await transaction.query(
      `INSERT INTO impact.global_command_center_snapshots (
        id, generated_at, metric_summary, regional_summaries, impact_indicators,
        recent_activity, lineage, safety_boundary, dashboard_root, created_by
      ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
      [
        id,
        snapshot.generatedAt,
        JSON.stringify(snapshot.metrics),
        JSON.stringify(snapshot.regions),
        JSON.stringify(snapshot.impactIndicators),
        JSON.stringify(snapshot.recentActivity),
        JSON.stringify(snapshot.lineage),
        JSON.stringify(snapshot.safety),
        snapshot.lineage.dashboardRoot,
        publisherId,
      ],
    );
  });
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
