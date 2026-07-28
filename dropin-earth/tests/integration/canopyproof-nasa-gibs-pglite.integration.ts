import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  InMemoryNasaGibsTelemetry,
  NasaGibsConnectorService,
  type NasaGibsActor,
} from "../../services/api/src/domain/canopyproof/nasa-gibs.js";
import { PrismaNasaGibsRepository } from "../../services/api/src/domain/canopyproof/nasa-gibs-postgres.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

const baseSql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
const nasaSql = readFileSync(join(process.cwd(), "services/api/prisma/nasa-gibs.sql"), "utf8");
const rollbackSql = readFileSync(join(process.cwd(), "services/api/prisma/nasa-gibs.rollback.sql"), "utf8");
const fixture = readFileSync(join(process.cwd(), "tests/fixtures/nasa-gibs-wmts-capabilities.xml"));

const actorId = "nasa_gibs_pglite_operator";
const organizationId = "nasa_gibs_pglite_organization";
const synchronizedAt = "2026-07-13T12:00:00.000Z";

test("NASA GIBS PostgreSQL adapter persists append-only snapshots and tenant-bound interpretation records", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(nasaSql);
    await db.exec(nasaSql);
    await insertBootstrapActorAndOrganization(db);
    const repository = new PrismaNasaGibsRepository(pglitePrismaClient(db));
    const telemetry = new InMemoryNasaGibsTelemetry();
    const service = new NasaGibsConnectorService({
      repository,
      telemetry,
      enabled: true,
      now: () => synchronizedAt,
      transport: async () => new Response(fixture, {
        status: 200,
        headers: { "content-type": "application/xml", "content-length": String(fixture.byteLength) },
      }),
    });
    const sync = await service.sync({
      serviceType: "WMTS",
      projection: "EPSG:3857",
      actor: nasaActor(),
      idempotencyKey: "nasa-gibs-pglite-idempotency-0001",
      requestedAt: synchronizedAt,
    });
    assert.equal(sync.outcome, "synchronized");
    assert.equal(sync.products.length, 2);

    const replay = await service.sync({
      serviceType: "WMTS",
      projection: "EPSG:3857",
      actor: nasaActor(),
      idempotencyKey: "nasa-gibs-pglite-idempotency-0001",
      requestedAt: synchronizedAt,
    });
    assert.equal(replay.outcome, "synchronized");
    assert.equal(replay.replayed, true);

    const removedProduct = sync.products.find((entry) => entry.nasaLayerId.includes("Thermal_Anomalies"));
    assert.ok(removedProduct);
    const reducedFixture = new TextEncoder().encode(
      new TextDecoder().decode(fixture).replace(/\s*<Layer>\s*<ows:Title>VIIRS Fires<\/ows:Title>[\s\S]*?<\/Layer>/, ""),
    );
    const updatedService = new NasaGibsConnectorService({
      repository,
      telemetry,
      enabled: true,
      now: () => "2026-07-13T12:05:00.000Z",
      transport: async () => new Response(reducedFixture, {
        status: 200,
        headers: { "content-type": "application/xml", "content-length": String(reducedFixture.byteLength) },
      }),
    });
    const updated = await updatedService.sync({
      serviceType: "WMTS",
      projection: "EPSG:3857",
      actor: nasaActor(),
      idempotencyKey: "nasa-gibs-pglite-idempotency-0002",
      requestedAt: "2026-07-13T12:05:00.000Z",
    });
    assert.equal(updated.outcome, "synchronized");
    assert.equal(updated.products.length, 1);
    await assert.rejects(updatedService.getProduct(removedProduct.id), /product was not found/);
    await assert.rejects(updatedService.getAvailability(removedProduct.id), /availability was not found/);

    const snapshots = await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM satellite.nasa_gibs_catalog_snapshots");
    const products = await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM satellite.nasa_gibs_products");
    const commands = await db.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM audit.command_receipts WHERE operation = 'satellite.nasa-gibs.sync'",
    );
    assert.equal(snapshots.rows[0]?.count, 2);
    assert.equal(products.rows[0]?.count, 3);
    assert.equal(commands.rows[0]?.count, 2);

    const product = updated.products.find((entry) => entry.nasaLayerId.includes("TrueColor"));
    assert.ok(product);
    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await assert.rejects(
        transaction.query(
          `INSERT INTO satellite.nasa_gibs_observation_comparisons (
            id, organization_id, project_id, product_id, source_capabilities_hash,
            comparison_hash, comparison_record, created_by, created_at, audit_event_root
          ) VALUES (
            'nasa_gibs_cross_tenant_probe', $1, 'project_not_in_actor_organization', $2, $3,
            $4, '{}'::jsonb, $5, $6, $7
          )`,
          [
            organizationId,
            product.id,
            product.sourceCapabilitiesHash,
            "a".repeat(64),
            actorId,
            synchronizedAt,
            "b".repeat(64),
          ],
        ),
        /NASA_GIBS_PROJECT_AUTHORITY_MISMATCH/,
      );
    });
    const comparison = await updatedService.createComparison({
      productId: product.id,
      beforeDate: "2026-06-01",
      afterDate: "2026-07-12",
      bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      mode: "SIDE_BY_SIDE",
      opacity: 0.75,
    }, nasaActor());
    assert.equal((await updatedService.getComparison(comparison.id, nasaActor())).comparisonHash, comparison.comparisonHash);
    await assert.rejects(
      updatedService.getComparison(comparison.id, nasaActor({ organizationId: "other_organization" })),
      /authenticated organization/,
    );

    await updatedService.createSourceDataHandoff({
      visualizationProductId: product.id,
      scienceDatasetRef: "nasa:earthdata:dataset:MODIS-TERRA-L1B",
      collectionRef: "cmr:collection:C123456789-NASA",
      granuleSearchRef: "cmr:granules:C123456789-NASA",
      requestedArea: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      requestedTime: { start: "2026-06-01", end: "2026-07-12" },
      purpose: "Retrieve separately governed source data for independent institutional review.",
    }, nasaActor());
    await updatedService.createEventWatch({
      productId: product.id,
      watchType: "flood",
      bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      outputs: ["OBSERVATION_SIGNAL", "RISK_CANDIDATE", "REVIEW_TASK"],
    }, nasaActor());

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await assert.rejects(
        transaction.query(
          "UPDATE satellite.nasa_gibs_observation_comparisons SET created_at = created_at + interval '1 second' WHERE id = $1",
          [comparison.id],
        ),
        /NASA_GIBS_APPEND_ONLY_VIOLATION/,
      );
    });

    const policyRows = await db.query<{ policyname: string }>(
      `SELECT policyname
       FROM pg_policies
       WHERE schemaname = 'satellite'
         AND tablename IN (
           'nasa_gibs_sync_failures',
           'nasa_gibs_observation_comparisons',
           'nasa_gibs_source_handoffs',
           'nasa_gibs_event_watches',
           'nasa_gibs_manifest_issuances',
           'nasa_gibs_manifest_nonce_consumptions'
         )
       ORDER BY policyname`,
    );
    assert.deepEqual(policyRows.rows.map((row) => row.policyname), [
      "nasa_gibs_event_watches_tenant",
      "nasa_gibs_manifest_issuances_tenant",
      "nasa_gibs_manifest_nonce_consumptions_tenant",
      "nasa_gibs_observation_comparisons_tenant",
      "nasa_gibs_source_handoffs_tenant",
      "nasa_gibs_sync_failures_tenant",
    ]);

    const forcedRlsRows = await db.query<{ relname: string; relforcerowsecurity: boolean }>(
      `SELECT relname, relforcerowsecurity
       FROM pg_class
       JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
       WHERE pg_namespace.nspname = 'satellite'
         AND relname IN (
           'nasa_gibs_sync_failures',
           'nasa_gibs_manifest_issuances',
           'nasa_gibs_manifest_nonce_consumptions',
           'nasa_gibs_observation_comparisons',
           'nasa_gibs_source_handoffs',
           'nasa_gibs_event_watches'
         )
       ORDER BY relname`,
    );
    assert.equal(forcedRlsRows.rows.length, 6);
    assert.ok(forcedRlsRows.rows.every((row) => row.relforcerowsecurity));

    await assert.rejects(db.exec(rollbackSql), /NASA_GIBS_ROLLBACK_REFUSED/);
  } finally {
    await db.close();
  }
});

test("NASA GIBS rollback removes only an empty connector schema", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(nasaSql);
    await db.exec(rollbackSql);
    const relations = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM pg_class
       JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
       WHERE pg_namespace.nspname = 'satellite'
         AND pg_class.relname LIKE 'nasa_gibs_%'
         AND pg_class.relkind = 'r'`,
    );
    assert.equal(relations.rows[0]?.count, 0);
  } finally {
    await db.close();
  }
});

function nasaActor(overrides: Partial<NasaGibsActor> = {}): NasaGibsActor {
  return {
    id: actorId,
    organizationId,
    role: "administrator",
    capabilities: ["nasa_gibs_catalog_sync"],
    ...overrides,
  };
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

async function insertBootstrapActorAndOrganization(db: PGlite) {
  const createdAt = "2026-07-13T11:50:00.000Z";
  const subjectHash = hashJson({ kind: "nasa-gibs-pglite-bootstrap-subject-v1", actorId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["admin"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "PGlite NASA GIBS operator was provisioned through an explicit test bootstrap transaction.",
  })[0]!;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, organization_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES ($1, 'human', 'NASA GIBS PGlite Operator', $1, $2, ARRAY['admin']::text[],
        'verified', 100, ARRAY[]::text[], $3, $4, $4)`,
      [actorId, organizationId, subjectHash, createdAt],
    );
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction,
        operating_regions, verification_capabilities, verification_status,
        trust_level, documents, authorized_users, accreditation_status,
        data_sharing_policy, created_at, updated_at
      ) VALUES (
        $1, 'NASA GIBS PGlite Organization', 'research_institution',
        'NASA GIBS PGlite Organization', 'GLOBAL', ARRAY['global']::text[],
        ARRAY['earth observation review']::text[], 'verified', 'institutional',
        '[]'::jsonb, jsonb_build_array($2::text), 'approved', 'restricted', $3, $3
      )`,
      [organizationId, actorId, createdAt],
    );
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        event.id,
        actorId,
        event.action,
        event.actor,
        event.entityType,
        event.entityId,
        event.previousRoot,
        event.payloadHash,
        event.eventRoot,
        event.createdAt,
        event.rationale,
      ],
    );
  });
}
