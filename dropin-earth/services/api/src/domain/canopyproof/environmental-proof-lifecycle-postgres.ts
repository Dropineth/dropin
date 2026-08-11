import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofEnvironmentalProofLifecycleAuthorityService,
  type CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot,
  type CanopyProofEnvironmentalProofLifecycleBindingFact,
  type CanopyProofEnvironmentalProofLifecycleControlFact,
  type CanopyProofEnvironmentalProofLifecycleProjection,
  type CanopyProofEnvironmentalProofSignatureReceiptFact,
  type CanopyProofEnvironmentalProofSigningKeyAttestationFact,
  type CanopyProofEnvironmentalProofSigningKeyRevocationFact,
} from "./environmental-proof-lifecycle-authority.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";

type LifecycleTransaction = Prisma.TransactionClient;
type LifecycleFact =
  | CanopyProofEnvironmentalProofSigningKeyAttestationFact
  | CanopyProofEnvironmentalProofSigningKeyRevocationFact
  | CanopyProofEnvironmentalProofLifecycleBindingFact
  | CanopyProofEnvironmentalProofSignatureReceiptFact
  | CanopyProofEnvironmentalProofLifecycleControlFact;

export type CanopyProofEnvironmentalProofLifecycleRepositoryStatus = {
  readonly service: "canopyproof-environmental-proof-lifecycle-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly serializableWrites: true;
  readonly idempotencyRequired: true;
  readonly canonicalRecordReResolved: true;
  readonly governedChallengeProjectionRequired: true;
  readonly reviewedMrvSnapshotRequired: true;
  readonly privateKeyMaterialAccepted: false;
  readonly managedProviderAdapterComposed: false;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const factRowSchema = z.object({ fact_record: z.unknown() });
const receiptRowSchema = z.object({
  request_hash: z.string().regex(HASH_PATTERN),
  result_entity_type: z.string().min(1),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(HASH_PATTERN),
  audit_event_root: z.string().regex(HASH_PATTERN),
});
const baseFactSchema = z.object({
  factType: z.enum([
    "environmental_proof_signing_key_attestation",
    "environmental_proof_signing_key_revocation",
    "environmental_proof_lifecycle_binding",
    "environmental_proof_signature_receipt",
    "environmental_proof_lifecycle_control",
  ]),
  id: z.string().min(1).max(256),
  organizationId: z.string().min(1).max(256),
  commandHash: z.string().regex(HASH_PATTERN),
  previousEventRoot: z.string().regex(HASH_PATTERN),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
  auditEvent: z.object({ eventRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
}).passthrough();
const projectionRowSchema = z.object({
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  record_id: z.string().min(1),
  record_root: z.string().regex(HASH_PATTERN),
  binding_id: z.string().min(1),
  binding_root: z.string().regex(HASH_PATTERN),
  state: z.enum(["issued", "active", "challenged", "suspended", "revoked", "expired", "superseded"]),
  evaluated_at_value: z.coerce.date(),
  governed_record_state: z.enum(["issued", "stale", "challenged", "revoked"]),
  source_authority_current: z.boolean(),
  mrv_state: z.enum(["empty", "reviewed_for_lineage", "review_required"]),
  bound_mrv_snapshot_current: z.boolean(),
  key_state: z.enum(["not_yet_active", "active", "expired", "revoked"]),
  signature_verified: z.boolean(),
  validity_current: z.boolean(),
  current_control_action: z.enum(["suspend", "reinstate", "supersede"]).nullable(),
  successor_binding_id: z.string().nullable(),
  issue_codes: z.array(z.string()),
  projection_root: z.string().regex(HASH_PATTERN),
  safety: z.unknown(),
});
const projectBindingRowSchema = z.object({ binding_id: z.string().min(1).max(256) }).strict();
const projectCurrentRootRowSchema = z
  .object({
    governed_record_projection_root: z.string().regex(HASH_PATTERN),
    snapshot_id: z.string().min(1).max(256),
    snapshot_root: z.string().regex(HASH_PATTERN),
    snapshot_state: z.enum(["reviewed_for_lineage", "review_required"]),
    reviewed_at: z.coerce.date(),
  })
  .strict();

export type CanopyProofEnvironmentalProofLifecycleCurrentProjectProjection = Readonly<{
  projection: CanopyProofEnvironmentalProofLifecycleProjection;
  governedRecordProjectionRoot: string;
  mrvGraphRoot: string;
}>;

export class PrismaCanopyProofEnvironmentalProofLifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofEnvironmentalProofLifecycleRepositoryStatus {
    return {
      service: "canopyproof-environmental-proof-lifecycle-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      idempotencyRequired: true,
      canonicalRecordReResolved: true,
      governedChallengeProjectionRequired: true,
      reviewedMrvSnapshotRequired: true,
      privateKeyMaterialAccepted: false,
      managedProviderAdapterComposed: false,
    };
  }

  async commitSigningKey(
    factInput: CanopyProofEnvironmentalProofSigningKeyAttestationFact,
    idempotencyKey: string,
  ) {
    return this.commitFact(parseSigningKey(factInput), idempotencyKey);
  }

  async commitSigningKeyRevocation(
    factInput: CanopyProofEnvironmentalProofSigningKeyRevocationFact,
    idempotencyKey: string,
  ) {
    return this.commitFact(parseSigningKeyRevocation(factInput), idempotencyKey);
  }

  async commitBinding(
    factInput: CanopyProofEnvironmentalProofLifecycleBindingFact,
    idempotencyKey: string,
  ) {
    return this.commitFact(parseBinding(factInput), idempotencyKey);
  }

  async commitSignatureReceipt(
    factInput: CanopyProofEnvironmentalProofSignatureReceiptFact,
    idempotencyKey: string,
  ) {
    return this.commitFact(parseSignature(factInput), idempotencyKey);
  }

  async commitControl(
    factInput: CanopyProofEnvironmentalProofLifecycleControlFact,
    idempotencyKey: string,
  ) {
    return this.commitFact(parseControl(factInput), idempotencyKey);
  }

  async loadAuthoritySnapshot(organizationId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.loadSnapshot(transaction, organizationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Reuses a caller-owned transaction whose tenant context is already established. */
  async getLifecycleBindingInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    bindingId: string,
  ): Promise<CanopyProofEnvironmentalProofLifecycleBindingFact> {
    const fact = await this.requireFact(transaction, organizationId, bindingId);
    if (fact.factType !== "environmental_proof_lifecycle_binding") {
      throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_BINDING_NOT_FOUND");
    }
    return fact;
  }

  /** Reuses a caller-owned transaction whose tenant context is already established. */
  async getSignatureReceiptInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    receiptId: string,
  ): Promise<CanopyProofEnvironmentalProofSignatureReceiptFact> {
    const fact = await this.requireFact(transaction, organizationId, receiptId);
    if (fact.factType !== "environmental_proof_signature_receipt") {
      throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_SIGNATURE_RECEIPT_NOT_FOUND");
    }
    return fact;
  }

  async projectLifecycle(
    organizationId: string,
    bindingId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEnvironmentalProofLifecycleProjection> {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.projectLifecycleInTransaction(transaction, organizationId, bindingId, evaluatedAt);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Reuses a caller-owned transaction without replacing its audit actor context. */
  async projectLifecycleInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    bindingId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEnvironmentalProofLifecycleProjection> {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT * FROM certificates.environmental_proof_lifecycle_projection(
        ${bindingId}, ${asDate(evaluatedAt)}
      )
    `);
    if (rows.length !== 1) {
      throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_PROJECTION_CARDINALITY_INVALID");
    }
    const projection = mapProjection(rows[0]);
    if (projection.organizationId !== organizationId) {
      throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_ORGANIZATION_SCOPE_MISMATCH");
    }
    return projection;
  }

  /** Resolves every project binding and its current component roots in one caller transaction. */
  async listProjectLifecyclesInTransaction(
    transaction: Prisma.TransactionClient,
    input: Readonly<{
      organizationId: string;
      projectId: string;
      evaluatedAt: string;
    }>,
  ): Promise<readonly CanopyProofEnvironmentalProofLifecycleCurrentProjectProjection[]> {
    const organizationId = z.string().min(1).max(256).parse(input.organizationId);
    const projectId = z.string().min(1).max(256).parse(input.projectId);
    const evaluatedAt = asDate(input.evaluatedAt);
    const bindingRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id AS binding_id
      FROM certificates.environmental_proof_lifecycle_binding_facts
      WHERE organization_id = ${organizationId}
        AND project_id = ${projectId}
        AND bound_at <= ${evaluatedAt}
      ORDER BY bound_at, id
    `);
    const result: CanopyProofEnvironmentalProofLifecycleCurrentProjectProjection[] = [];
    for (const rawBinding of bindingRows) {
      const binding = projectBindingRowSchema.parse(rawBinding);
      const projection = await this.projectLifecycleInTransaction(
        transaction,
        organizationId,
        binding.binding_id,
        input.evaluatedAt,
      );
      const currentRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT
          governed.projection_root AS governed_record_projection_root,
          snapshot.id AS snapshot_id,
          snapshot.snapshot_root,
          snapshot.snapshot_state,
          snapshot.reviewed_at
        FROM certificates.environmental_proof_lifecycle_binding_facts binding
        JOIN LATERAL certificates.environmental_proof_governed_record_projection(
          binding.record_id
        ) governed ON true
        JOIN LATERAL (
          SELECT id, snapshot_root, snapshot_state, reviewed_at
          FROM mrv.graph_snapshot_facts
          WHERE organization_id = binding.organization_id
            AND project_id = binding.project_id
          ORDER BY snapshot_sequence DESC, id DESC
          LIMIT 1
        ) snapshot ON true
        WHERE binding.id = ${binding.binding_id}
          AND binding.organization_id = ${organizationId}
          AND binding.project_id = ${projectId}
      `);
      if (currentRows.length !== 1) {
        throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_CURRENT_ROOT_CARDINALITY_INVALID");
      }
      const current = projectCurrentRootRowSchema.parse(currentRows[0]);
      if (current.reviewed_at.getTime() > evaluatedAt.getTime()) {
        throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_FUTURE_MRV_SNAPSHOT_INVALID");
      }
      result.push({
        projection,
        governedRecordProjectionRoot: current.governed_record_projection_root,
        mrvGraphRoot: hashJson({
          kind: "canopyproof-mrv-graph-projection-v1",
          organizationId,
          projectId,
          state: current.snapshot_state,
          latestSnapshotId: current.snapshot_id,
          latestSnapshotRoot: current.snapshot_root,
          finalProofChanged: false,
        }),
      });
    }
    return result;
  }

  private async commitFact<T extends LifecycleFact>(fact: T, idempotencyKeyInput: string): Promise<T> {
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const operation = operationFor(fact.factType);
    const actorId = fact.auditEvent.actor;
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: `canopyproof-${fact.factType}-commit-v1`, fact });
    const receiptId = `cp_certificate_lifecycle_command_${hashJson({
      actorId,
      operation,
      idempotencyKeyHash,
    }).slice(0, 24)}`;
    const responseHash = responseRoot(fact);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, fact.organizationId, actorId);
            await lockCommand(transaction, actorId, operation, idempotencyKeyHash);
            await lockAuthorityStream(transaction, streamId(fact));
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(
                receipt,
                requestHash,
                fact.factType,
                fact.id,
                responseHash,
                fact.auditEvent.eventRoot,
              );
              return this.requireFact(transaction, fact.organizationId, fact.id) as Promise<T>;
            }
            const snapshot = await this.loadSnapshot(transaction, fact.organizationId);
            assertProposedFact(snapshot, fact);
            await insertDomainEvent(transaction, streamId(fact), fact.auditEvent);
            await insertFact(transaction, fact);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              resultEntityType: fact.factType,
              resultEntityId: fact.id,
              responseHash,
              auditEventRoot: fact.auditEvent.eventRoot,
              createdAt: eventTime(fact),
            });
            return this.requireFact(transaction, fact.organizationId, fact.id) as Promise<T>;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_DURABLE_WRITE_UNAVAILABLE");
  }

  private async requireFact(transaction: LifecycleTransaction, organizationId: string, factId: string) {
    const service = CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const snapshot = service.getAuthoritySnapshot();
    const fact = allFacts(snapshot).find((candidate) => candidate.id === factId);
    if (!fact) throw new Error(`CANOPYPROOF_CERTIFICATE_LIFECYCLE_FACT_NOT_FOUND:${factId}`);
    return fact;
  }

  private async loadSnapshot(
    transaction: LifecycleTransaction,
    organizationId: string,
  ): Promise<CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot> {
    const organizationRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id FROM organizations.organizations WHERE id = ${organizationId} LIMIT 1
    `);
    if (organizationRows.length !== 1) throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_ORGANIZATION_SCOPE_MISMATCH");
    const [keyRows, revocationRows, bindingRows, signatureRows, controlRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM governance.environmental_proof_signing_key_attestation_facts
        WHERE organization_id = ${organizationId}
        ORDER BY organization_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM governance.environmental_proof_signing_key_revocation_facts
        WHERE organization_id = ${organizationId}
        ORDER BY organization_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM certificates.environmental_proof_lifecycle_binding_facts
        WHERE organization_id = ${organizationId}
        ORDER BY bound_at, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM certificates.environmental_proof_signature_receipt_facts
        WHERE organization_id = ${organizationId}
        ORDER BY record_id, record_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM governance.environmental_proof_lifecycle_control_facts
        WHERE organization_id = ${organizationId}
        ORDER BY record_id, record_sequence, id
      `),
    ]);
    const snapshot: CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot = {
      signingKeys: keyRows.map((row) => parseSigningKey(factRowSchema.parse(row).fact_record)),
      signingKeyRevocations: revocationRows.map((row) =>
        parseSigningKeyRevocation(factRowSchema.parse(row).fact_record)),
      bindings: bindingRows.map((row) => parseBinding(factRowSchema.parse(row).fact_record)),
      signatureReceipts: signatureRows.map((row) => parseSignature(factRowSchema.parse(row).fact_record)),
      controls: controlRows.map((row) => parseControl(factRowSchema.parse(row).fact_record)),
    };
    return CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedFact(
  snapshot: CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot,
  fact: LifecycleFact,
) {
  if (allFacts(snapshot).some((candidate) => candidate.id === fact.id || responseRoot(candidate) === responseRoot(fact))) {
    throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_FACT_CONFLICT");
  }
  const proposed: CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot = {
    signingKeys: fact.factType === "environmental_proof_signing_key_attestation"
      ? [...snapshot.signingKeys, fact]
      : snapshot.signingKeys,
    signingKeyRevocations: fact.factType === "environmental_proof_signing_key_revocation"
      ? [...snapshot.signingKeyRevocations, fact]
      : snapshot.signingKeyRevocations,
    bindings: fact.factType === "environmental_proof_lifecycle_binding"
      ? [...snapshot.bindings, fact]
      : snapshot.bindings,
    signatureReceipts: fact.factType === "environmental_proof_signature_receipt"
      ? [...snapshot.signatureReceipts, fact]
      : snapshot.signatureReceipts,
    controls: fact.factType === "environmental_proof_lifecycle_control"
      ? [...snapshot.controls, fact]
      : snapshot.controls,
  };
  CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot(proposed);
}

async function insertFact(transaction: LifecycleTransaction, fact: LifecycleFact) {
  switch (fact.factType) {
    case "environmental_proof_signing_key_attestation":
      return insertSigningKey(transaction, fact);
    case "environmental_proof_signing_key_revocation":
      return insertSigningKeyRevocation(transaction, fact);
    case "environmental_proof_lifecycle_binding":
      return insertBinding(transaction, fact);
    case "environmental_proof_signature_receipt":
      return insertSignature(transaction, fact);
    case "environmental_proof_lifecycle_control":
      return insertControl(transaction, fact);
  }
}

async function insertDomainEvent(
  transaction: LifecycleTransaction,
  authorityStream: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${authorityStream}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
      ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

async function insertSigningKey(
  transaction: LifecycleTransaction,
  fact: CanopyProofEnvironmentalProofSigningKeyAttestationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO governance.environmental_proof_signing_key_attestation_facts (
      id, organization_id, provider, provider_key_id, key_version, algorithm, purpose,
      public_key_hash, provider_attestation_hash, active_from, expires_at, registrar_id,
      external_verifier_id, provider_receipt_id_hash, provider_receipt_hash, verified_at,
      attested_at, command_hash, organization_sequence, previous_event_root, source_root,
      key_hash, key_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.provider}, ${fact.providerKeyId}, ${fact.keyVersion},
      ${fact.algorithm}, ${fact.purpose}, ${fact.publicKeyHash}, ${fact.providerAttestationHash},
      ${asDate(fact.activeFrom)}, ${fact.expiresAt ? asDate(fact.expiresAt) : null}, ${fact.registrar.id},
      ${fact.externalVerifierId}, ${fact.providerReceiptIdHash}, ${fact.providerReceiptHash},
      ${asDate(fact.verifiedAt)}, ${asDate(fact.attestedAt)}, ${fact.commandHash},
      ${fact.organizationSequence}, ${fact.previousEventRoot}, ${fact.sourceRoot}, ${fact.keyHash},
      ${fact.keyRoot}, ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertSigningKeyRevocation(
  transaction: LifecycleTransaction,
  fact: CanopyProofEnvironmentalProofSigningKeyRevocationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO governance.environmental_proof_signing_key_revocation_facts (
      id, organization_id, key_authority_id, key_root, reason_code, rationale, revoker_id,
      revoked_at, command_hash, organization_sequence, previous_event_root, source_root,
      revocation_hash, revocation_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.keyAuthorityId}, ${fact.keyRoot}, ${fact.reasonCode},
      ${fact.rationale}, ${fact.revoker.id}, ${asDate(fact.revokedAt)}, ${fact.commandHash},
      ${fact.organizationSequence}, ${fact.previousEventRoot}, ${fact.sourceRoot},
      ${fact.revocationHash}, ${fact.revocationRoot}, ${JSON.stringify(fact)}::jsonb,
      ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertBinding(
  transaction: LifecycleTransaction,
  fact: CanopyProofEnvironmentalProofLifecycleBindingFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO certificates.environmental_proof_lifecycle_binding_facts (
      id, organization_id, project_id, record_id, record_root, record_issued_at,
      governed_record_projection_root, mrv_snapshot_id, mrv_snapshot_root, mrv_edge_set_root,
      mrv_graph_root, mrv_reviewed_at, methodology_id, methodology_publication_root,
      observation_starts_at, observation_ends_at, valid_from, expires_at,
      monitoring_cadence_days, next_monitoring_due_at, monitoring_grace_days, assertion_type,
      assertion_scope_hash, location_scope_hash, uncertainty_hash, limitation_hashes,
      reliance_statement, issuer_id, signing_key_authority_id, signing_key_root,
      source_event_roots, source_root, signature_payload_hash, bound_at, command_hash,
      record_sequence, previous_event_root, binding_hash, binding_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.recordId}, ${fact.recordRoot},
      ${asDate(fact.recordIssuedAt)}, ${fact.governedRecordProjectionRoot}, ${fact.mrvSnapshotId},
      ${fact.mrvSnapshotRoot}, ${fact.mrvEdgeSetRoot}, ${fact.mrvGraphRoot}, ${asDate(fact.mrvReviewedAt)},
      ${fact.methodologyId}, ${fact.methodologyPublicationRoot}, ${asDate(fact.observationPeriod.startsAt)},
      ${asDate(fact.observationPeriod.endsAt)}, ${asDate(fact.validity.validFrom)},
      ${asDate(fact.validity.expiresAt)}, ${fact.monitoringSchedule.cadenceDays},
      ${asDate(fact.monitoringSchedule.nextDueAt)}, ${fact.monitoringSchedule.graceDays},
      ${fact.assertionType}, ${fact.assertionScopeHash}, ${fact.locationScopeHash},
      ${fact.uncertaintyHash}, ${textArray(fact.limitationHashes)}, ${fact.relianceStatement},
      ${fact.issuer.id}, ${fact.signingKeyAuthorityId}, ${fact.signingKeyRoot},
      ${textArray(fact.sourceEventRoots)}, ${fact.sourceRoot}, ${fact.signaturePayloadHash},
      ${asDate(fact.boundAt)}, ${fact.commandHash}, ${fact.recordSequence}, ${fact.previousEventRoot},
      ${fact.bindingHash}, ${fact.bindingRoot}, ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertSignature(
  transaction: LifecycleTransaction,
  fact: CanopyProofEnvironmentalProofSignatureReceiptFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO certificates.environmental_proof_signature_receipt_facts (
      id, organization_id, project_id, record_id, record_root, binding_id, binding_root,
      signing_key_authority_id, signing_key_root, algorithm, signature_payload_hash,
      detached_signature, signature_hash, external_verifier_id, provider_receipt_id_hash,
      provider_receipt_hash, signed_at, verified_at, command_hash, record_sequence,
      previous_event_root, source_root, receipt_hash, receipt_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.recordId}, ${fact.recordRoot},
      ${fact.bindingId}, ${fact.bindingRoot}, ${fact.signingKeyAuthorityId}, ${fact.signingKeyRoot},
      ${fact.algorithm}, ${fact.signaturePayloadHash}, ${fact.detachedSignature}, ${fact.signatureHash},
      ${fact.externalVerifierId}, ${fact.providerReceiptIdHash}, ${fact.providerReceiptHash},
      ${asDate(fact.signedAt)}, ${asDate(fact.verifiedAt)}, ${fact.commandHash}, ${fact.recordSequence},
      ${fact.previousEventRoot}, ${fact.sourceRoot}, ${fact.receiptHash}, ${fact.receiptRoot},
      ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertControl(
  transaction: LifecycleTransaction,
  fact: CanopyProofEnvironmentalProofLifecycleControlFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO governance.environmental_proof_lifecycle_control_facts (
      id, organization_id, project_id, record_id, record_root, binding_id, binding_root,
      action, prior_state, prior_projection_root, successor_binding_id, successor_binding_root,
      successor_projection_root, rationale, conflict_disclosure, source_projection_roots,
      source_root, governor_id, decided_at, command_hash, record_sequence, previous_event_root,
      control_hash, control_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.recordId}, ${fact.recordRoot},
      ${fact.bindingId}, ${fact.bindingRoot}, ${fact.action}, ${fact.priorState},
      ${fact.priorProjectionRoot}, ${fact.successorBindingId ?? null}, ${fact.successorBindingRoot ?? null},
      ${fact.successorProjectionRoot ?? null}, ${fact.rationale}, ${fact.conflictDisclosure},
      ${textArray(fact.sourceProjectionRoots)}, ${fact.sourceRoot}, ${fact.governor.id},
      ${asDate(fact.decidedAt)}, ${fact.commandHash}, ${fact.recordSequence}, ${fact.previousEventRoot},
      ${fact.controlHash}, ${fact.controlRoot}, ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertReceipt(
  transaction: LifecycleTransaction,
  input: Readonly<{
    id: string;
    actorId: string;
    operation: string;
    idempotencyKeyHash: string;
    requestHash: string;
    resultEntityType: string;
    resultEntityId: string;
    responseHash: string;
    auditEventRoot: string;
    createdAt: string;
  }>,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash}, ${input.requestHash},
      ${input.resultEntityType}, ${input.resultEntityId}, ${input.responseHash}, ${input.auditEventRoot},
      ${asDate(input.createdAt)}
    )
  `));
}

async function readReceipt(transaction: LifecycleTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId} FOR UPDATE
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_RECEIPT_CARDINALITY_INVALID");
  return rows[0] ? receiptRowSchema.parse(rows[0]) : undefined;
}

function assertReceipt(
  receipt: z.infer<typeof receiptRowSchema>,
  requestHash: string,
  entityType: string,
  entityId: string,
  responseHash: string,
  auditEventRoot: string,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_type !== entityType ||
    receipt.result_entity_id !== entityId ||
    receipt.response_hash !== responseHash ||
    receipt.audit_event_root !== auditEventRoot
  ) {
    throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_IDEMPOTENCY_CONFLICT");
  }
}

async function lockCommand(
  transaction: LifecycleTransaction,
  actorId: string,
  operation: string,
  idempotencyKeyHash: string,
) {
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `certificate-lifecycle-command:${actorId}:${operation}:${idempotencyKeyHash}`,
  );
}

async function lockAuthorityStream(transaction: LifecycleTransaction, authorityStream: string) {
  await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${authorityStream}`);
}

async function setContext(
  transaction: LifecycleTransaction,
  organizationId: string,
  actorId = "system-read",
) {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseBaseFact(input: unknown, expectedType: LifecycleFact["factType"]) {
  const parsed = baseFactSchema.parse(input);
  if (parsed.factType !== expectedType) {
    throw new Error(`CANOPYPROOF_CERTIFICATE_LIFECYCLE_FACT_TYPE_INVALID:${expectedType}`);
  }
  return input;
}

function parseSigningKey(input: unknown): CanopyProofEnvironmentalProofSigningKeyAttestationFact {
  return parseBaseFact(input, "environmental_proof_signing_key_attestation") as CanopyProofEnvironmentalProofSigningKeyAttestationFact;
}

function parseSigningKeyRevocation(input: unknown): CanopyProofEnvironmentalProofSigningKeyRevocationFact {
  return parseBaseFact(input, "environmental_proof_signing_key_revocation") as CanopyProofEnvironmentalProofSigningKeyRevocationFact;
}

function parseBinding(input: unknown): CanopyProofEnvironmentalProofLifecycleBindingFact {
  return parseBaseFact(input, "environmental_proof_lifecycle_binding") as CanopyProofEnvironmentalProofLifecycleBindingFact;
}

function parseSignature(input: unknown): CanopyProofEnvironmentalProofSignatureReceiptFact {
  return parseBaseFact(input, "environmental_proof_signature_receipt") as CanopyProofEnvironmentalProofSignatureReceiptFact;
}

function parseControl(input: unknown): CanopyProofEnvironmentalProofLifecycleControlFact {
  return parseBaseFact(input, "environmental_proof_lifecycle_control") as CanopyProofEnvironmentalProofLifecycleControlFact;
}

function mapProjection(input: unknown): CanopyProofEnvironmentalProofLifecycleProjection {
  const row = projectionRowSchema.parse(input);
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    recordId: row.record_id,
    recordRoot: row.record_root,
    bindingId: row.binding_id,
    bindingRoot: row.binding_root,
    state: row.state,
    evaluatedAt: row.evaluated_at_value.toISOString(),
    governedRecordState: row.governed_record_state,
    sourceAuthorityCurrent: row.source_authority_current,
    mrvState: row.mrv_state,
    boundMrvSnapshotCurrent: row.bound_mrv_snapshot_current,
    keyState: row.key_state,
    signatureVerified: row.signature_verified,
    validityCurrent: row.validity_current,
    ...(row.current_control_action ? { currentControlAction: row.current_control_action } : {}),
    ...(row.successor_binding_id ? { successorBindingId: row.successor_binding_id } : {}),
    issueCodes: row.issue_codes,
    projectionRoot: row.projection_root,
    safety: row.safety as CanopyProofEnvironmentalProofLifecycleProjection["safety"],
  };
}

function allFacts(snapshot: CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot): readonly LifecycleFact[] {
  return [
    ...snapshot.signingKeys,
    ...snapshot.signingKeyRevocations,
    ...snapshot.bindings,
    ...snapshot.signatureReceipts,
    ...snapshot.controls,
  ];
}

function responseRoot(fact: LifecycleFact) {
  switch (fact.factType) {
    case "environmental_proof_signing_key_attestation": return fact.keyRoot;
    case "environmental_proof_signing_key_revocation": return fact.revocationRoot;
    case "environmental_proof_lifecycle_binding": return fact.bindingRoot;
    case "environmental_proof_signature_receipt": return fact.receiptRoot;
    case "environmental_proof_lifecycle_control": return fact.controlRoot;
  }
}

function eventTime(fact: LifecycleFact) {
  switch (fact.factType) {
    case "environmental_proof_signing_key_attestation": return fact.attestedAt;
    case "environmental_proof_signing_key_revocation": return fact.revokedAt;
    case "environmental_proof_lifecycle_binding": return fact.boundAt;
    case "environmental_proof_signature_receipt": return fact.verifiedAt;
    case "environmental_proof_lifecycle_control": return fact.decidedAt;
  }
}

function streamId(fact: LifecycleFact) {
  return fact.factType === "environmental_proof_signing_key_attestation" ||
    fact.factType === "environmental_proof_signing_key_revocation"
    ? `certificate-key:${fact.organizationId}`
    : `certificate-lifecycle:${fact.recordId}`;
}

function operationFor(factType: LifecycleFact["factType"]) {
  return `certificate-lifecycle.${factType}.commit`;
}

function textArray(values: readonly string[]) {
  return values.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_CERTIFICATE_LIFECYCLE_MUTATION_CARDINALITY_INVALID");
}
