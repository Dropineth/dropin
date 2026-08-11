import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  NASA_GIBS_ACKNOWLEDGEMENT,
  NASA_GIBS_NON_ENDORSEMENT,
  nasaGibsComparisonModes,
  nasaGibsFreshnessStates,
  nasaGibsProjections,
  nasaGibsServiceTypes,
  verifyObservationComparison,
  type NasaGibsActor,
  type NasaGibsCatalogSnapshot,
  type NasaGibsEventWatch,
  type NasaGibsLayerAvailability,
  type NasaGibsManifestIssuance,
  type NasaGibsProduct,
  type NasaGibsRepository,
  type NasaSourceDataHandoff,
  type NasaGibsSyncFailure,
  type ObservationComparison,
} from "./nasa-gibs.js";
import {
  canopyProofAuditEntityTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import { acquireCanopyProofPostgresTransactionLock } from "./postgres-advisory-lock.js";

type NasaGibsTransaction = Prisma.TransactionClient;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const auditEventSchema = z.object({
  id: z.string().min(1).max(256),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor: z.string().min(1).max(256),
  entityType: z.enum(canopyProofAuditEntityTypes),
  entityId: z.string().min(1).max(256),
  previousRoot: z.string().regex(SHA256_PATTERN),
  payloadHash: z.string().regex(SHA256_PATTERN),
  eventRoot: z.string().regex(SHA256_PATTERN),
  createdAt: z.string().datetime({ offset: false }),
  rationale: z.string().min(1).max(2_000),
}).strict();

const temporalExtentSchema = z.object({
  start: z.string().min(10).max(32),
  end: z.string().min(10).max(32),
  period: z.string().min(2).max(64).optional(),
  sourceValue: z.string().min(1).max(256),
}).strict();

const productSchema = z.object({
  id: z.string().min(1).max(256),
  nasaLayerId: z.string().min(1).max(256),
  title: z.string().min(1).max(4_096),
  description: z.string().min(1).max(4_096),
  serviceType: z.enum(nasaGibsServiceTypes),
  projection: z.enum(nasaGibsProjections),
  tileMatrixSet: z.string().min(1).max(128).optional(),
  formats: z.array(z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"])).min(1).max(16),
  temporalExtent: z.array(temporalExtentSchema).max(500),
  availableDates: z.array(z.string().min(10).max(32)).max(500),
  defaultDate: z.string().min(10).max(32).optional(),
  sourceEndpointId: z.string().min(1).max(128),
  sourceCapabilitiesHash: z.string().regex(SHA256_PATTERN),
  attribution: z.literal(NASA_GIBS_ACKNOWLEDGEMENT),
  nonEndorsement: z.literal(NASA_GIBS_NON_ENDORSEMENT),
  observedOrPublishedAt: z.string().min(10).max(32).optional(),
  freshness: z.enum(nasaGibsFreshnessStates),
  freshnessReason: z.string().min(1).max(1_000),
  synchronizedAt: z.string().datetime({ offset: false }),
}).strict();

const availabilitySchema = z.object({
  productId: z.string().min(1).max(256),
  sourceCapabilitiesHash: z.string().regex(SHA256_PATTERN),
  defaultDate: z.string().min(10).max(32).optional(),
  temporalExtents: z.array(temporalExtentSchema).max(500),
  availableDates: z.array(z.string().min(10).max(32)).max(500),
  latestAvailableAt: z.string().min(10).max(32).optional(),
  completeness: z.enum(["capabilities_recent_window", "static", "unknown"]),
  synchronizedAt: z.string().datetime({ offset: false }),
}).strict();

const snapshotSchema = z.object({
  id: z.string().min(1).max(256),
  endpointId: z.string().min(1).max(128),
  serviceType: z.enum(nasaGibsServiceTypes),
  projection: z.enum(nasaGibsProjections),
  sourceCapabilitiesHash: z.string().regex(SHA256_PATTERN),
  productCount: z.number().int().positive().max(12_000),
  productIds: z.array(z.string().min(1).max(256)).min(1).max(12_000),
  synchronizedAt: z.string().datetime({ offset: false }),
  snapshotRoot: z.string().regex(SHA256_PATTERN),
  auditEvent: auditEventSchema,
}).strict();

const failureSchema = z.object({
  id: z.string().min(1).max(256),
  endpointId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(256),
  actorId: z.string().min(1).max(256),
  errorCode: z.enum([
    "TIMEOUT",
    "UPSTREAM_STATUS",
    "CONTENT_TYPE",
    "OVERSIZED",
    "MALFORMED_XML",
    "UNSUPPORTED_SCHEMA",
    "CATALOG_INVARIANT",
    "ENDPOINT_DENIED",
    "AUTHORIZATION_DENIED",
  ]),
  failedAt: z.string().datetime({ offset: false }),
  failureRoot: z.string().regex(SHA256_PATTERN),
  auditEvent: auditEventSchema,
}).strict();

const boundingBoxSchema = z.object({
  west: z.number().finite(),
  south: z.number().finite(),
  east: z.number().finite(),
  north: z.number().finite(),
}).strict();

const comparisonSchema = z.object({
  id: z.string().min(1).max(256),
  organizationId: z.string().min(1).max(256),
  projectId: z.string().min(1).max(256).optional(),
  productId: z.string().min(1).max(256),
  beforeDate: z.string().min(10).max(32),
  afterDate: z.string().min(10).max(32),
  bbox: boundingBoxSchema,
  projection: z.enum(nasaGibsProjections),
  mode: z.enum(nasaGibsComparisonModes),
  layerConfiguration: z.object({
    format: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
    opacity: z.number().finite().min(0).max(1),
    tileMatrixSet: z.string().min(1).max(128).optional(),
  }).strict(),
  sourceCapabilitiesHash: z.string().regex(SHA256_PATTERN),
  actorId: z.string().min(1).max(256),
  createdAt: z.string().datetime({ offset: false }),
  comparisonHash: z.string().regex(SHA256_PATTERN),
  auditEvent: auditEventSchema,
  authority: z.literal("terraproof_observation_context_only"),
  attribution: z.literal(NASA_GIBS_ACKNOWLEDGEMENT),
  nonEndorsement: z.literal(NASA_GIBS_NON_ENDORSEMENT),
  disclosure: z.literal("visualization_not_verified_evidence_or_science_data"),
}).strict();

const jsonRowSchema = z.object({ record: z.unknown() });
const commandRowSchema = z.object({
  request_hash: z.string().regex(SHA256_PATTERN),
  snapshot_record: z.unknown(),
});
const countRowSchema = z.object({ count: z.coerce.number().int().nonnegative() });
const existsRowSchema = z.object({ exists: z.boolean() });

export class PrismaNasaGibsRepository implements NasaGibsRepository {
  readonly storage = "postgresql" as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findSyncCommand(commandHash: string, actor: NasaGibsActor) {
    return this.transaction(
      actor.organizationId,
      actor.id,
      (transaction) => readSyncCommand(transaction, commandHash, actor.id),
    );
  }

  async commitCatalog(input: Parameters<NasaGibsRepository["commitCatalog"]>[0]) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.transaction(input.actor.organizationId, input.actor.id, async (transaction) => {
          await acquireCanopyProofPostgresTransactionLock(
            transaction,
            `nasa-gibs-command:${input.commandHash}`,
          );
          await acquireCanopyProofPostgresTransactionLock(
            transaction,
            `nasa-gibs-endpoint:${input.snapshot.endpointId}`,
          );
          const existing = await readSyncCommand(
            transaction,
            input.commandHash,
            input.actor.id,
          );
          if (existing) {
            if (existing.requestHash !== input.requestHash) {
              throw new Error("NASA_GIBS_IDEMPOTENCY_CONFLICT");
            }
            return { ...existing, replayed: true };
          }
          await insertDomainEvent(transaction, input.snapshot.auditEvent);
          requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
            INSERT INTO satellite.nasa_gibs_catalog_snapshots (
              id, endpoint_id, service_type, projection, source_capabilities_hash,
              product_count, product_ids, synchronized_at, snapshot_root,
              snapshot_record, audit_event_root, created_by
            ) VALUES (
              ${input.snapshot.id}, ${input.snapshot.endpointId}, ${input.snapshot.serviceType}, ${input.snapshot.projection},
              ${input.snapshot.sourceCapabilitiesHash}, ${input.snapshot.productCount},
              ${input.snapshot.productIds as string[]}, ${asDate(input.snapshot.synchronizedAt)}, ${input.snapshot.snapshotRoot},
              ${JSON.stringify(input.snapshot)}::jsonb, ${input.snapshot.auditEvent.eventRoot}, ${input.actor.id}
            )
          `));
          requireMutationCount(await transaction.$executeRaw(Prisma.sql`
            INSERT INTO satellite.nasa_gibs_products (
              snapshot_id, product_id, endpoint_id, service_type, projection,
              nasa_layer_id, source_capabilities_hash, product_record
            )
            SELECT
              ${input.snapshot.id}, record->>'id', record->>'sourceEndpointId', record->>'serviceType',
              record->>'projection', record->>'nasaLayerId', record->>'sourceCapabilitiesHash', record
            FROM jsonb_array_elements(${JSON.stringify(input.products)}::jsonb) AS record
          `), input.products.length);
          requireMutationCount(await transaction.$executeRaw(Prisma.sql`
            INSERT INTO satellite.nasa_gibs_layer_availability (
              snapshot_id, product_id, source_capabilities_hash, availability_record
            )
            SELECT
              ${input.snapshot.id}, record->>'productId', record->>'sourceCapabilitiesHash', record
            FROM jsonb_array_elements(${JSON.stringify(input.availability)}::jsonb) AS record
          `), input.availability.length);
          const responseHash = hashJson({
            kind: "nasa-gibs-sync-response-v1",
            snapshotRoot: input.snapshot.snapshotRoot,
            productCount: input.snapshot.productCount,
          });
          requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
            INSERT INTO audit.command_receipts (
              id, actor_id, operation, idempotency_key_hash, request_hash,
              result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
            ) VALUES (
              ${input.commandHash}, ${input.actor.id}, 'satellite.nasa-gibs.sync', ${input.idempotencyKeyHash},
              ${input.requestHash}, 'nasa_gibs_catalog_snapshot', ${input.snapshot.id}, ${responseHash},
              ${input.snapshot.auditEvent.eventRoot}, ${asDate(input.snapshot.synchronizedAt)}
            )
          `));
          const committed = await readSyncCommand(
            transaction,
            input.commandHash,
            input.actor.id,
          );
          if (!committed) throw new Error("NASA_GIBS_DURABLE_WRITE_INCOMPLETE");
          return { ...committed, replayed: false };
        });
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("NASA_GIBS_DURABLE_WRITE_UNAVAILABLE");
  }

  async recordSyncFailure(failure: NasaGibsSyncFailure) {
    const expected = parseFailure(failure);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.transaction(failure.organizationId, failure.actorId, async (transaction) => {
          await acquireCanopyProofPostgresTransactionLock(
            transaction,
            `nasa-gibs-failure:${failure.id}`,
          );
          const existingRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
            SELECT failure_record AS record
            FROM satellite.nasa_gibs_sync_failures
            WHERE id = ${failure.id}
            LIMIT 1
          `);
          if (existingRows[0]) {
            const existing = parseFailure(jsonRowSchema.parse(existingRows[0]).record);
            if (hashJson(existing) !== hashJson(expected)) {
              throw new Error("NASA_GIBS_SYNC_FAILURE_CONFLICT");
            }
            return;
          }
          await insertDomainEvent(transaction, expected.auditEvent);
          requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
            INSERT INTO satellite.nasa_gibs_sync_failures (
              id, endpoint_id, organization_id, actor_id, error_code,
              failed_at, failure_root, failure_record, audit_event_root
            ) VALUES (
              ${expected.id}, ${expected.endpointId}, ${expected.organizationId}, ${expected.actorId}, ${expected.errorCode},
              ${asDate(expected.failedAt)}, ${expected.failureRoot}, ${JSON.stringify(expected)}::jsonb, ${expected.auditEvent.eventRoot}
            )
          `));
        });
        return;
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("NASA_GIBS_DURABLE_WRITE_UNAVAILABLE");
  }

  async listCurrentSnapshots() {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT DISTINCT ON (endpoint_id) snapshot_record AS record
        FROM satellite.nasa_gibs_catalog_snapshots
        ORDER BY endpoint_id, synchronized_at DESC, id DESC
      `);
      return rows.map((entry) => parseSnapshot(jsonRowSchema.parse(entry).record));
    });
  }

  async getCurrentSnapshot(endpointId: string) {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT snapshot_record AS record
        FROM satellite.nasa_gibs_catalog_snapshots
        WHERE endpoint_id = ${endpointId}
        ORDER BY synchronized_at DESC, id DESC
        LIMIT 1
      `);
      return rows[0] ? parseSnapshot(jsonRowSchema.parse(rows[0]).record) : undefined;
    });
  }

  async listProducts(filter: Parameters<NasaGibsRepository["listProducts"]>[0] = {}) {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        WITH current_snapshots AS (
          SELECT DISTINCT ON (endpoint_id) id
          FROM satellite.nasa_gibs_catalog_snapshots
          ORDER BY endpoint_id, synchronized_at DESC, id DESC
        )
        SELECT product.product_record AS record
        FROM satellite.nasa_gibs_products product
        JOIN current_snapshots current_snapshot ON current_snapshot.id = product.snapshot_id
        WHERE (${filter.serviceType ?? null}::text IS NULL OR product.service_type = ${filter.serviceType ?? null})
          AND (${filter.projection ?? null}::text IS NULL OR product.projection = ${filter.projection ?? null})
          AND (
            ${filter.freshness ?? null}::text IS NULL
            OR product.product_record->>'freshness' = ${filter.freshness ?? null}
          )
        ORDER BY product.product_id
      `);
      return rows.map((entry) => parseProduct(jsonRowSchema.parse(entry).record));
    });
  }

  async getProduct(productId: string) {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        WITH current_snapshots AS (
          SELECT DISTINCT ON (endpoint_id) id
          FROM satellite.nasa_gibs_catalog_snapshots
          ORDER BY endpoint_id, synchronized_at DESC, id DESC
        )
        SELECT product.product_record AS record
        FROM satellite.nasa_gibs_products product
        JOIN current_snapshots current_snapshot ON current_snapshot.id = product.snapshot_id
        WHERE product.product_id = ${productId}
        LIMIT 1
      `);
      return rows[0] ? parseProduct(jsonRowSchema.parse(rows[0]).record) : undefined;
    });
  }

  async getAvailability(productId: string) {
    return this.read(async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        WITH current_snapshots AS (
          SELECT DISTINCT ON (endpoint_id) id
          FROM satellite.nasa_gibs_catalog_snapshots
          ORDER BY endpoint_id, synchronized_at DESC, id DESC
        )
        SELECT availability.availability_record AS record
        FROM satellite.nasa_gibs_layer_availability availability
        JOIN current_snapshots current_snapshot ON current_snapshot.id = availability.snapshot_id
        WHERE availability.product_id = ${productId}
        LIMIT 1
      `);
      return rows[0] ? parseAvailability(jsonRowSchema.parse(rows[0]).record) : undefined;
    });
  }

  async projectBelongsToOrganization(projectId: string, organizationId: string) {
    return this.transaction(organizationId, "nasa-gibs-project-link-reader", async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM projects.projects project
          WHERE project.id = ${projectId}
            AND project.organization_id = ${organizationId}
        ) AS exists
      `);
      return existsRowSchema.parse(rows[0]).exists;
    });
  }

  async latestFailure(organizationId?: string) {
    const operation = async (transaction: NasaGibsTransaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT failure_record AS record
        FROM satellite.nasa_gibs_sync_failures
        WHERE (${organizationId ?? null}::text IS NULL OR organization_id = ${organizationId ?? null})
        ORDER BY failed_at DESC, id DESC
        LIMIT 1
      `);
      return rows[0] ? parseFailure(jsonRowSchema.parse(rows[0]).record) : undefined;
    };
    return organizationId
      ? this.transaction(organizationId, "nasa-gibs-status-reader", operation)
      : this.read(operation);
  }

  async recordManifestIssuance(issuance: NasaGibsManifestIssuance) {
    const manifest = issuance.manifest;
    await this.transaction(issuance.organizationId, manifest.actorId, async (transaction) => {
      await insertDomainEvent(transaction, manifest.auditEvent);
      requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
        INSERT INTO satellite.nasa_gibs_manifest_issuances (
          manifest_hash, organization_id, actor_id, nonce, product_id,
          source_capabilities_hash, issued_at, expires_at, manifest_record, audit_event_root
        ) VALUES (
          ${manifest.manifestHash}, ${issuance.organizationId}, ${manifest.actorId}, ${issuance.nonce}, ${manifest.productId},
          ${manifest.sourceCapabilitiesHash}, ${asDate(manifest.issuedAt)}, ${asDate(manifest.expiresAt)},
          ${JSON.stringify(manifest)}::jsonb, ${manifest.auditEvent.eventRoot}
        )
      `));
    });
  }

  async consumeManifestNonce(organizationId: string, nonce: string, consumedAt: string) {
    return this.transaction(organizationId, "nasa-gibs-manifest-verifier", async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ actor_id: string }>>(Prisma.sql`
        SELECT actor_id
        FROM satellite.nasa_gibs_manifest_issuances
        WHERE organization_id = ${organizationId} AND nonce = ${nonce}
        LIMIT 1
      `);
      if (!rows[0]) return false;
      await transaction.$executeRaw(Prisma.sql`SELECT set_config('app.actor_id', ${rows[0].actor_id}, true)`);
      const inserted = await transaction.$executeRaw(Prisma.sql`
        INSERT INTO satellite.nasa_gibs_manifest_nonce_consumptions (
          organization_id, nonce, consumed_at, consumed_by
        ) VALUES (${organizationId}, ${nonce}, ${asDate(consumedAt)}, ${rows[0].actor_id})
        ON CONFLICT (organization_id, nonce) DO NOTHING
      `);
      return inserted === 1;
    });
  }

  async saveComparison(comparison: ObservationComparison) {
    if (!verifyObservationComparison(comparison)) throw new Error("NASA_GIBS_COMPARISON_INTEGRITY_FAILURE");
    await this.transaction(comparison.organizationId, comparison.actorId, async (transaction) => {
      await insertDomainEvent(transaction, comparison.auditEvent);
      requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
        INSERT INTO satellite.nasa_gibs_observation_comparisons (
          id, organization_id, project_id, product_id, source_capabilities_hash,
          comparison_hash, comparison_record, created_by, created_at, audit_event_root
        ) VALUES (
          ${comparison.id}, ${comparison.organizationId}, ${comparison.projectId ?? null}, ${comparison.productId},
          ${comparison.sourceCapabilitiesHash}, ${comparison.comparisonHash}, ${JSON.stringify(comparison)}::jsonb,
          ${comparison.actorId}, ${asDate(comparison.createdAt)}, ${comparison.auditEvent.eventRoot}
        )
      `));
    });
  }

  async getComparison(comparisonId: string, organizationId: string) {
    return this.transaction(organizationId, "nasa-gibs-comparison-reader", async (transaction) => {
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT comparison_record AS record
        FROM satellite.nasa_gibs_observation_comparisons
        WHERE id = ${comparisonId} AND organization_id = ${organizationId}
        LIMIT 1
      `);
      if (!rows[0]) return undefined;
      const comparison = parseComparison(jsonRowSchema.parse(rows[0]).record);
      return verifyObservationComparison(comparison) ? comparison : undefined;
    });
  }

  async saveSourceHandoff(handoff: NasaSourceDataHandoff) {
    await this.transaction(handoff.organizationId, handoff.createdBy, async (transaction) => {
      await insertDomainEvent(transaction, handoff.auditEvent);
      requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
        INSERT INTO satellite.nasa_gibs_source_handoffs (
          id, organization_id, project_id, product_id, handoff_hash,
          handoff_record, created_by, created_at, audit_event_root
        ) VALUES (
          ${handoff.id}, ${handoff.organizationId}, ${handoff.projectId ?? null}, ${handoff.visualizationProductId},
          ${handoff.handoffHash}, ${JSON.stringify(handoff)}::jsonb, ${handoff.createdBy},
          ${asDate(handoff.createdAt)}, ${handoff.auditEvent.eventRoot}
        )
      `));
    });
  }

  async saveEventWatch(watch: NasaGibsEventWatch) {
    await this.transaction(watch.organizationId, watch.createdBy, async (transaction) => {
      await insertDomainEvent(transaction, watch.auditEvent);
      requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
        INSERT INTO satellite.nasa_gibs_event_watches (
          id, organization_id, project_id, product_id, watch_type,
          watch_hash, watch_record, created_by, created_at, audit_event_root
        ) VALUES (
          ${watch.id}, ${watch.organizationId}, ${watch.projectId ?? null}, ${watch.productId}, ${watch.watchType},
          ${watch.watchHash}, ${JSON.stringify(watch)}::jsonb, ${watch.createdBy},
          ${asDate(watch.createdAt)}, ${watch.auditEvent.eventRoot}
        )
      `));
    });
  }

  async comparisonCount() {
    return this.readCount("satellite.nasa_gibs_observation_comparisons");
  }

  async sourceHandoffCount() {
    return this.readCount("satellite.nasa_gibs_source_handoffs");
  }

  private async readCount(relation: "satellite.nasa_gibs_observation_comparisons" | "satellite.nasa_gibs_source_handoffs") {
    return this.read(async (transaction) => {
      const query = relation === "satellite.nasa_gibs_observation_comparisons"
        ? Prisma.sql`SELECT count(*)::bigint AS count FROM satellite.nasa_gibs_observation_comparisons`
        : Prisma.sql`SELECT count(*)::bigint AS count FROM satellite.nasa_gibs_source_handoffs`;
      const rows = await transaction.$queryRaw<unknown[]>(query);
      return countRowSchema.parse(rows[0]).count;
    });
  }

  private async read<T>(operation: (transaction: NasaGibsTransaction) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  private async transaction<T>(
    organizationId: string,
    actorId: string,
    operation: (transaction: NasaGibsTransaction) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`);
      await transaction.$executeRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
      return operation(transaction);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

async function readSyncCommand(
  transaction: NasaGibsTransaction,
  commandHash: string,
  actorId: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT receipt.request_hash, snapshot.snapshot_record
    FROM audit.command_receipts receipt
    JOIN satellite.nasa_gibs_catalog_snapshots snapshot
      ON snapshot.id = receipt.result_entity_id
    WHERE receipt.id = ${commandHash}
      AND receipt.actor_id = ${actorId}
      AND receipt.operation = 'satellite.nasa-gibs.sync'
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return undefined;
  const parsed = commandRowSchema.parse(row);
  const snapshot = parseSnapshot(parsed.snapshot_record);
  const productRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT product_record AS record
    FROM satellite.nasa_gibs_products
    WHERE snapshot_id = ${snapshot.id}
    ORDER BY product_id
  `);
  const products = productRows.map((entry) => parseProduct(jsonRowSchema.parse(entry).record));
  if (products.length !== snapshot.productCount) {
    throw new Error("NASA_GIBS_STORED_CATALOG_INCOMPLETE");
  }
  return {
    commandHash,
    requestHash: parsed.request_hash,
    snapshot,
    products,
  };
}

async function insertDomainEvent(transaction: NasaGibsTransaction, event: CanopyProofAuditEvent) {
  auditEventSchema.parse(event);
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${`nasa-gibs:${event.entityType}:${event.entityId}`}, ${event.action}, ${event.actor}, ${event.entityType},
      ${event.entityId}, ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

function parseSnapshot(value: unknown): NasaGibsCatalogSnapshot {
  const snapshot = snapshotSchema.parse(value);
  const snapshotSeed = {
    endpointId: snapshot.endpointId,
    serviceType: snapshot.serviceType,
    projection: snapshot.projection,
    sourceCapabilitiesHash: snapshot.sourceCapabilitiesHash,
    productCount: snapshot.productCount,
    productIds: snapshot.productIds,
    synchronizedAt: snapshot.synchronizedAt,
  };
  const expectedId = `nasa_gibs_snapshot_${hashJson({ kind: "nasa-gibs-catalog-snapshot-v1", ...snapshotSeed }).slice(0, 24)}`;
  const expectedRoot = hashJson({
    kind: "nasa-gibs-catalog-snapshot-root-v1",
    ...snapshotSeed,
    auditEventRoot: snapshot.auditEvent.eventRoot,
  });
  if (
    snapshot.productCount !== snapshot.productIds.length ||
    snapshot.auditEvent.entityId !== snapshot.id ||
    snapshot.id !== expectedId ||
    snapshot.snapshotRoot !== expectedRoot ||
    !verifyCanopyProofAuditChain([{ event: snapshot.auditEvent, payload: snapshotSeed }], snapshot.synchronizedAt).valid
  ) {
    throw new Error("NASA_GIBS_STORED_SNAPSHOT_INVALID");
  }
  return snapshot;
}

function parseProduct(value: unknown): NasaGibsProduct {
  const parsed = productSchema.parse(value);
  return {
    id: parsed.id,
    nasaLayerId: parsed.nasaLayerId,
    title: parsed.title,
    description: parsed.description,
    serviceType: parsed.serviceType,
    projection: parsed.projection,
    ...(parsed.tileMatrixSet ? { tileMatrixSet: parsed.tileMatrixSet } : {}),
    formats: parsed.formats,
    temporalExtent: parsed.temporalExtent.map((extent) => ({
      start: extent.start,
      end: extent.end,
      ...(extent.period ? { period: extent.period } : {}),
      sourceValue: extent.sourceValue,
    })),
    availableDates: parsed.availableDates,
    ...(parsed.defaultDate ? { defaultDate: parsed.defaultDate } : {}),
    sourceEndpointId: parsed.sourceEndpointId,
    sourceCapabilitiesHash: parsed.sourceCapabilitiesHash,
    attribution: parsed.attribution,
    nonEndorsement: parsed.nonEndorsement,
    ...(parsed.observedOrPublishedAt ? { observedOrPublishedAt: parsed.observedOrPublishedAt } : {}),
    freshness: parsed.freshness,
    freshnessReason: parsed.freshnessReason,
    synchronizedAt: parsed.synchronizedAt,
  };
}

function parseAvailability(value: unknown): NasaGibsLayerAvailability {
  const parsed = availabilitySchema.parse(value);
  return {
    productId: parsed.productId,
    sourceCapabilitiesHash: parsed.sourceCapabilitiesHash,
    ...(parsed.defaultDate ? { defaultDate: parsed.defaultDate } : {}),
    temporalExtents: parsed.temporalExtents.map((extent) => ({
      start: extent.start,
      end: extent.end,
      ...(extent.period ? { period: extent.period } : {}),
      sourceValue: extent.sourceValue,
    })),
    availableDates: parsed.availableDates,
    ...(parsed.latestAvailableAt ? { latestAvailableAt: parsed.latestAvailableAt } : {}),
    completeness: parsed.completeness,
    synchronizedAt: parsed.synchronizedAt,
  };
}

function parseFailure(value: unknown): NasaGibsSyncFailure {
  const failure = failureSchema.parse(value);
  const failureSeed = {
    endpointId: failure.endpointId,
    organizationId: failure.organizationId,
    actorId: failure.actorId,
    errorCode: failure.errorCode,
    failedAt: failure.failedAt,
  };
  const expectedId = `nasa_gibs_failure_${hashJson({ kind: "nasa-gibs-sync-failure-v1", ...failureSeed }).slice(0, 24)}`;
  const expectedRoot = hashJson({
    kind: "nasa-gibs-sync-failure-root-v1",
    ...failureSeed,
    auditEventRoot: failure.auditEvent.eventRoot,
  });
  if (
    failure.id !== expectedId ||
    failure.failureRoot !== expectedRoot ||
    failure.auditEvent.actor !== failure.actorId ||
    failure.auditEvent.entityType !== "nasa_gibs_sync_failure" ||
    failure.auditEvent.entityId !== failure.id ||
    !verifyCanopyProofAuditChain([{ event: failure.auditEvent, payload: failureSeed }], failure.failedAt).valid
  ) {
    throw new Error("NASA_GIBS_STORED_FAILURE_INVALID");
  }
  return failure;
}

function parseComparison(value: unknown): ObservationComparison {
  const parsed = comparisonSchema.parse(value);
  const comparison: ObservationComparison = {
    id: parsed.id,
    organizationId: parsed.organizationId,
    ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
    productId: parsed.productId,
    beforeDate: parsed.beforeDate,
    afterDate: parsed.afterDate,
    bbox: parsed.bbox,
    projection: parsed.projection,
    mode: parsed.mode,
    layerConfiguration: {
      format: parsed.layerConfiguration.format,
      opacity: parsed.layerConfiguration.opacity,
      ...(parsed.layerConfiguration.tileMatrixSet
        ? { tileMatrixSet: parsed.layerConfiguration.tileMatrixSet }
        : {}),
    },
    sourceCapabilitiesHash: parsed.sourceCapabilitiesHash,
    actorId: parsed.actorId,
    createdAt: parsed.createdAt,
    comparisonHash: parsed.comparisonHash,
    auditEvent: parsed.auditEvent,
    authority: parsed.authority,
    attribution: parsed.attribution,
    nonEndorsement: parsed.nonEndorsement,
    disclosure: parsed.disclosure,
  };
  if (
    comparison.auditEvent.entityId !== comparison.id ||
    comparison.auditEvent.actor !== comparison.actorId ||
    comparison.auditEvent.entityType !== "nasa_gibs_observation_comparison" ||
    !verifyCanopyProofAuditChain([{
      event: comparison.auditEvent,
      payload: {
        comparisonHash: comparison.comparisonHash,
        productId: comparison.productId,
        sourceCapabilitiesHash: comparison.sourceCapabilitiesHash,
      },
    }], comparison.createdAt).valid ||
    !verifyObservationComparison(comparison)
  ) {
    throw new Error("NASA_GIBS_STORED_COMPARISON_INVALID");
  }
  return comparison;
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("NASA_GIBS_INVALID_TIMESTAMP");
  return date;
}

function requireSingleMutation(count: number) {
  requireMutationCount(count, 1);
}

function requireMutationCount(actual: number, expected: number) {
  if (actual !== expected) throw new Error("NASA_GIBS_DURABLE_WRITE_INCOMPLETE");
}

function isRetryableTransactionError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const databaseCode = prismaDatabaseCode(error);
  return error.code === "P2034" ||
    databaseCode === "40001" ||
    databaseCode === "40P01" ||
    databaseCode === "23505";
}

function prismaDatabaseCode(error: Prisma.PrismaClientKnownRequestError) {
  if (!error.meta || typeof error.meta !== "object") return undefined;
  const code = Reflect.get(error.meta, "code");
  return typeof code === "string" ? code : undefined;
}
