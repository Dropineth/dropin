import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  assertCanopyProofEvidenceMetadataExtractionVerificationFact,
  buildCanopyProofEvidenceMetadataExtractionVerificationFact,
  isCanopyProofDurableMetadataExtractionReceipt,
  projectCanopyProofEvidenceMetadataExtraction,
  type CanopyProofDurableMetadataExtractionReceipt,
  type CanopyProofEvidenceMetadataExtractionVerificationFact,
} from "./evidence-metadata-adapter-authority.js";
import {
  assertCanopyProofMetadataExtractionRequestFact,
  buildCanopyProofMetadataExtractionRequestFact,
  type CanopyProofMetadataExtractionRequestFact,
} from "./evidence-metadata-orchestration-authority.js";
import type {
  CanopyProofMetadataExtractionOrchestrationDurablePort,
  CanopyProofPreparedMetadataExtraction,
} from "./evidence-metadata-orchestrator.js";
import {
  CanopyProofEvidenceMetadataRetentionAuthorityService,
  type CanopyProofEvidenceMetadataExtractionAuthority,
  type CanopyProofEvidenceMetadataExtractionFact,
} from "./evidence-metadata-retention-authority.js";
import { PrismaCanopyProofEvidenceMetadataRetentionRepository } from
  "./evidence-metadata-retention-postgres.js";
import type { CanopyProofMetadataExtractorPolicyDescriptor } from
  "./metadata-extractor-adapter.js";
import {
  canopyProofAuditEntityTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import { acquireCanopyProofPostgresTransactionLock } from "./postgres-advisory-lock.js";
import { PrismaCanopyProofTrustRegistryService } from "./trust-registry.js";

type E3dTransaction = Prisma.TransactionClient;

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const commandSchema = z
  .object({
    organizationId: z.string().min(1).max(240),
    objectId: z.string().min(1).max(240),
    requesterAgentId: z.string().min(1).max(240),
    idempotencyKey: z.string().trim().min(8).max(256),
    requestedAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => new Date(value).toISOString() === value),
    policy: z.unknown(),
  })
  .strict();
const policySchema = z
  .object({
    extractorId: z.string().min(1).max(240),
    extractorName: z.string().min(1).max(100),
    extractorVersion: z.string().min(1).max(100),
    extractorImageDigest: z.string().regex(HASH_PATTERN),
    metadataSchemaVersion: z.string().min(1).max(100),
    extractorPolicyRoot: z.string().regex(HASH_PATTERN),
    signerSetRoot: z.string().regex(HASH_PATTERN),
    maximumObservationAgeSeconds: z.number().int().min(86_400).max(366 * 86_400),
  })
  .strict();
const requestRowSchema = z.object({ fact_record: z.unknown() });
const requestEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_metadata_extraction_request"),
    id: z.string().min(1),
    organizationId: z.string().min(1),
    evidenceId: z.string().min(1),
    objectId: z.string().min(1),
    requestedBy: z.string().min(1),
    requestedAt: z.string().datetime(),
    dispatchExpiresAt: z.string().datetime(),
    idempotencyKeyHash: z.string().regex(HASH_PATTERN),
    requestHash: z.string().regex(HASH_PATTERN),
    requestRoot: z.string().regex(HASH_PATTERN),
    commandReceiptId: z.string().min(1),
  })
  .passthrough();
const factEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_media_metadata_extraction"),
    id: z.string().min(1),
  })
  .passthrough();
const verificationEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_metadata_extraction_receipt_verification"),
    id: z.string().min(1),
  })
  .passthrough();
const receiptRowSchema = z.object({
  request_hash: z.string().regex(HASH_PATTERN),
  result_entity_type: z.string().min(1),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(HASH_PATTERN),
  audit_event_root: z.string().regex(HASH_PATTERN),
});
const auditEventRowSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor_id: z.string().min(1),
  entity_type: z.enum(canopyProofAuditEntityTypes),
  entity_id: z.string().min(1),
  previous_root: z.string().regex(HASH_PATTERN),
  payload_hash: z.string().regex(HASH_PATTERN),
  event_root: z.string().regex(HASH_PATTERN),
  created_at: z.coerce.date(),
  rationale: z.string().min(1),
  sequence_no: z.coerce.number().int().positive(),
});
const dispatchAuthorityRowSchema = z.object({
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  evidence_id: z.string().min(1),
  object_root: z.string().regex(HASH_PATTERN),
  consent_receipt_id: z.string().min(1),
  consent_receipt_root: z.string().regex(HASH_PATTERN),
  consent_state: z.string().min(1),
  device_attestation_id: z.string().min(1),
  device_attestation_root: z.string().regex(HASH_PATTERN),
  device_state: z.string().min(1),
  registered_gps_hash: z.string().regex(HASH_PATTERN),
  privacy_mode: z.string().min(1),
  media_state: z.string().min(1),
  media_issue_codes: z.array(z.string()),
  requester_valid: z.boolean(),
});

export class PrismaCanopyProofMetadataExtractionOrchestrationRepository
  implements CanopyProofMetadataExtractionOrchestrationDurablePort
{
  readonly #trust: PrismaCanopyProofTrustRegistryService;
  readonly #retention: PrismaCanopyProofEvidenceMetadataRetentionRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.#trust = new PrismaCanopyProofTrustRegistryService(prisma);
    this.#retention = new PrismaCanopyProofEvidenceMetadataRetentionRepository(prisma);
  }

  getStatus() {
    return {
      service: "canopyproof-metadata-extraction-orchestration-repository" as const,
      storage: "postgresql" as const,
      routeMounted: false as const,
      appendOnly: true as const,
      tenantScoped: true as const,
      serializableWrites: true as const,
      requestBeforeExternalIo: true as const,
      currentAuthorityRecheckedBeforeExternalIo: true as const,
      finalProofAuthority: false as const,
    };
  }

  async prepareMetadataExtractionRequest(input: Readonly<{
    organizationId: string;
    objectId: string;
    requesterAgentId: string;
    idempotencyKey: string;
    requestedAt: string;
    policy: CanopyProofMetadataExtractorPolicyDescriptor;
  }>): Promise<CanopyProofPreparedMetadataExtraction> {
    const command = commandSchema.parse(input);
    const policy = policySchema.parse(command.policy);
    const authority = await this.loadAuthority(
      command.organizationId,
      command.objectId,
      command.requesterAgentId,
      command.requestedAt,
    );
    const idempotencyKeyHash = hashJson({
      kind: "canopyproof-metadata-extraction-idempotency-key-v1",
      organizationId: command.organizationId,
      objectId: command.objectId,
      requesterAgentId: command.requesterAgentId,
      operation: "evidence.metadata-extraction-request.prepare",
      value: command.idempotencyKey,
    });
    const provisional = buildCanopyProofMetadataExtractionRequestFact({
      authority,
      policy,
      idempotencyKeyHash,
      streamEvents: [],
      requestedAt: command.requestedAt,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const request = await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, command.organizationId, command.requesterAgentId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `e3d-command:${command.requesterAgentId}:${idempotencyKeyHash}`,
            );
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `domain-event:evidence-metadata-request:${authority.object.evidenceId}`,
            );
            const receipts = await transaction.$queryRaw<unknown[]>(Prisma.sql`
              SELECT request_hash, result_entity_type, result_entity_id,
                     response_hash, audit_event_root
              FROM audit.command_receipts
              WHERE id = ${provisional.commandReceiptId}
              FOR UPDATE
            `);
            if (receipts.length > 1) throw new Error("CANOPYPROOF_E3D_RECEIPT_CARDINALITY_INVALID");
            if (receipts[0]) {
              const receipt = receiptRowSchema.parse(receipts[0]);
              if (
                receipt.request_hash !== provisional.requestHash ||
                receipt.result_entity_type !== "metadata_extraction_request" ||
                receipt.response_hash.length !== 64
              ) {
                throw new Error("CANOPYPROOF_E3D_IDEMPOTENCY_CONFLICT");
              }
              const replayed = await this.requireRequest(
                transaction,
                command.organizationId,
                receipt.result_entity_id,
              );
              if (
                replayed.requestRoot !== receipt.response_hash ||
                replayed.auditEvent.eventRoot !== receipt.audit_event_root
              ) {
                throw new Error("CANOPYPROOF_E3D_IDEMPOTENCY_CONFLICT");
              }
              return replayed;
            }

            const duplicateRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
              SELECT fact_record
              FROM evidence.metadata_extraction_request_facts
              WHERE request_hash = ${provisional.requestHash}
              FOR UPDATE
            `);
            if (duplicateRows.length > 0) {
              throw new Error("CANOPYPROOF_E3D_IDEMPOTENCY_KEY_REQUIRED_FOR_REPLAY");
            }
            const streamEvents = await loadAuditHistory(
              transaction,
              `evidence-metadata-request:${authority.object.evidenceId}`,
            );
            const fact = buildCanopyProofMetadataExtractionRequestFact({
              authority,
              policy,
              idempotencyKeyHash,
              streamEvents,
              requestedAt: command.requestedAt,
            });
            await insertDomainEvent(
              transaction,
              `evidence-metadata-request:${authority.object.evidenceId}`,
              fact.auditEvent,
            );
            requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
              INSERT INTO audit.command_receipts (
                id, actor_id, operation, idempotency_key_hash, request_hash,
                result_entity_type, result_entity_id, response_hash,
                audit_event_root, created_at
              ) VALUES (
                ${fact.commandReceiptId}, ${fact.requestedBy},
                'evidence.metadata-extraction-request.prepare', ${fact.idempotencyKeyHash},
                ${fact.requestHash}, 'metadata_extraction_request', ${fact.id},
                ${fact.requestRoot}, ${fact.auditEvent.eventRoot}, ${asDate(fact.requestedAt)}
              )
            `));
            await insertRequestFact(transaction, fact);
            return this.requireRequest(transaction, command.organizationId, fact.id);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        assertCanopyProofMetadataExtractionRequestFact({
          authority,
          policy,
          fact: request,
          streamEventsBefore: await this.loadRequestStreamBefore(request),
        });
        return { request, authority };
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_E3D_DURABLE_WRITE_UNAVAILABLE");
  }

  async findMetadataExtractionResult(prepared: CanopyProofPreparedMetadataExtraction) {
    const extraction = await this.findExtraction(prepared.request);
    if (!extraction) return undefined;
    assertExtractionBindsRequest(prepared.request, extraction);
    const verification = await this.findVerification(
      prepared.request.organizationId,
      extraction,
      prepared.authority.object,
    );
    if (!verification) return undefined;
    return {
      request: prepared.request,
      extraction,
      verification,
      projection: projectCanopyProofEvidenceMetadataExtraction({
        object: prepared.authority.object,
        extraction,
        verification,
        evaluatedAt: verification.verifiedAt,
      }),
    };
  }

  async assertMetadataExtractionDispatchAuthorized(
    prepared: CanopyProofPreparedMetadataExtraction,
    dispatchedAtInput: string,
  ) {
    const dispatchedAt = asDate(dispatchedAtInput);
    const requestedAt = asDate(prepared.request.requestedAt);
    const dispatchExpiresAt = asDate(prepared.request.dispatchExpiresAt);
    if (dispatchedAt < requestedAt || dispatchedAt >= dispatchExpiresAt) {
      throw new Error("CANOPYPROOF_E3D_DISPATCH_EXPIRED");
    }
    const rows = await this.prisma.$transaction(
      async (transaction) => {
        await setContext(
          transaction,
          prepared.request.organizationId,
          prepared.request.requestedBy,
        );
        return transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT object_fact.organization_id, object_fact.project_id,
                 object_fact.evidence_id, object_fact.object_root,
                 consent.id AS consent_receipt_id,
                 consent.receipt_root AS consent_receipt_root,
                 consent_projection.state AS consent_state,
                 device.id AS device_attestation_id,
                 device.attestation_root AS device_attestation_root,
                 device_projection.state AS device_state,
                 evidence_record.gps_hash AS registered_gps_hash,
                 consent.privacy_mode,
                 media_projection.state AS media_state,
                 media_projection.issue_codes AS media_issue_codes,
                 evidence.evidence_media_agent_is_valid(
                   ${JSON.stringify(prepared.request.requester)}::jsonb,
                   ${prepared.request.organizationId},
                   'metadata_extraction_receipt'
                 ) AS requester_valid
          FROM evidence.media_object_facts object_fact
          JOIN evidence.media_upload_intent_facts intent
            ON intent.id = object_fact.intent_id
          JOIN evidence.evidence_objects evidence_record
            ON evidence_record.id = object_fact.evidence_id
          JOIN evidence.consent_receipts consent
            ON consent.id = intent.consent_receipt_id
          JOIN identity.device_attestations device
            ON device.id = intent.device_attestation_id
          CROSS JOIN LATERAL evidence.effective_media_object_projection(
            object_fact.id, ${dispatchedAt}
          ) media_projection
          CROSS JOIN LATERAL evidence.consent_receipt_projection(
            consent.id, ${dispatchedAt}
          ) consent_projection
          CROSS JOIN LATERAL evidence.effective_device_attestation_projection(
            device.id, ${dispatchedAt}
          ) device_projection
          WHERE object_fact.id = ${prepared.request.objectId}
            AND object_fact.organization_id = ${prepared.request.organizationId}
        `);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (rows.length !== 1) {
      throw new Error("CANOPYPROOF_E3D_DISPATCH_AUTHORITY_REVOKED");
    }
    const current = dispatchAuthorityRowSchema.parse(rows[0]);
    if (
      current.organization_id !== prepared.request.organizationId ||
      current.project_id !== prepared.request.projectId ||
      current.evidence_id !== prepared.request.evidenceId ||
      current.object_root !== prepared.request.objectRoot ||
      current.consent_receipt_id !== prepared.request.consentReceiptId ||
      current.consent_receipt_root !== prepared.request.consentReceiptRoot ||
      current.consent_state !== "active" ||
      current.device_attestation_id !== prepared.request.deviceAttestationId ||
      current.device_attestation_root !== prepared.request.deviceAttestationRoot ||
      current.device_state !== "current" ||
      current.registered_gps_hash !== prepared.request.registeredGpsHash ||
      current.privacy_mode !== prepared.request.privacyMode ||
      current.media_state !== "available" ||
      current.media_issue_codes.length !== 0 ||
      !current.requester_valid
    ) {
      throw new Error("CANOPYPROOF_E3D_DISPATCH_AUTHORITY_REVOKED");
    }
  }

  async commitMetadataExtractionResult(input: Readonly<{
    prepared: CanopyProofPreparedMetadataExtraction;
    receipt: CanopyProofDurableMetadataExtractionReceipt;
    verifierAgentId: string;
  }>) {
    if (!isCanopyProofDurableMetadataExtractionReceipt(input.receipt)) {
      throw new Error("CANOPYPROOF_E3D_RECEIPT_NOT_MINIMIZED_BY_AUTHORITY");
    }
    assertReceiptBindsRequest(input.prepared.request, input.receipt);
    const existing = await this.findMetadataExtractionResult(input.prepared);
    if (existing) return existing;

    const domain = CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot(
      await this.#retention.loadAuthoritySnapshot(
        input.prepared.request.organizationId,
        input.prepared.request.evidenceId,
      ),
    );
    const proposed = domain.recordMetadataExtraction(
      extractionInputFromReceipt(input.receipt),
      input.prepared.authority,
    );
    assertExtractionBindsRequest(input.prepared.request, proposed);
    const extraction = await this.#retention.commitFact(
      proposed,
      `${input.prepared.request.id}:e3b`,
    ) as CanopyProofEvidenceMetadataExtractionFact;
    const verification = await this.commitVerification(
      input.prepared,
      extraction,
      input.receipt,
      input.verifierAgentId,
    );
    return {
      request: input.prepared.request,
      extraction,
      verification,
      projection: projectCanopyProofEvidenceMetadataExtraction({
        object: input.prepared.authority.object,
        extraction,
        verification,
        evaluatedAt: verification.verifiedAt,
      }),
    };
  }

  private async loadAuthority(
    organizationId: string,
    objectId: string,
    requesterAgentId: string,
    requestedAt: string,
  ): Promise<CanopyProofEvidenceMetadataExtractionAuthority> {
    const object = await this.#trust.getEvidenceMediaObject(objectId, organizationId);
    const intent = await this.#trust.getEvidenceMediaUploadIntent(object.intentId, organizationId);
    const [projectionAuthority, consent, device, evidence, agent] = await Promise.all([
      this.#trust.getEvidenceMediaExtractionProjectionAuthority(objectId, organizationId, requestedAt),
      this.#trust.getEvidenceConsentReceipt(intent.consentReceiptId, organizationId),
      this.#trust.getEvidenceDeviceAttestation(intent.deviceAttestationId, organizationId),
      this.#trust.getEvidence(object.evidenceId),
      this.#trust.getEvidenceMediaAgentAuthority(
        requesterAgentId,
        organizationId,
        "metadata_extraction_receipt",
      ),
    ]);
    if (evidence.organizationId !== organizationId || evidence.projectId !== object.projectId) {
      throw new Error("CANOPYPROOF_E3D_EVIDENCE_SCOPE_MISMATCH");
    }
    const [consentProjection, deviceProjection] = await Promise.all([
      this.#trust.getEvidenceConsentProjection(consent.id, organizationId, requestedAt),
      this.#trust.getEvidenceEffectiveDeviceAttestationProjection(
        device.id,
        organizationId,
        requestedAt,
      ),
    ]);
    return {
      intent,
      object,
      ...projectionAuthority,
      consent,
      consentProjection,
      device,
      deviceProjection,
      registeredGpsHash: evidence.gps_hash,
      agent,
    };
  }

  private async requireRequest(
    transaction: E3dTransaction,
    organizationId: string,
    requestId: string,
  ) {
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT fact_record
      FROM evidence.metadata_extraction_request_facts
      WHERE id = ${requestId} AND organization_id = ${organizationId}
    `);
    if (rows.length !== 1) throw new Error("CANOPYPROOF_E3D_REQUEST_NOT_FOUND");
    return parseRequest(requestRowSchema.parse(rows[0]).fact_record);
  }

  private async loadRequestStreamBefore(request: CanopyProofMetadataExtractionRequestFact) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, request.organizationId, request.requestedBy);
        const events = await loadAuditHistory(
          transaction,
          `evidence-metadata-request:${request.evidenceId}`,
        );
        return events.filter((_, index) => index < request.evidenceSequence - 1);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async findExtraction(request: CanopyProofMetadataExtractionRequestFact) {
    const rows = await this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, request.organizationId, request.requestedBy);
        return transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT fact_record
          FROM evidence.media_metadata_extraction_facts
          WHERE organization_id = ${request.organizationId}
            AND object_id = ${request.objectId}
            AND extracted_at = ${asDate(request.requestedAt)}
            AND fact_record->>'mediaProjectionRoot' = ${request.mediaProjectionRoot}
            AND fact_record->>'extractorName' = ${request.extractorName}
            AND fact_record->>'extractorVersion' = ${request.extractorVersion}
            AND fact_record->>'extractorImageDigest' = ${request.extractorImageDigest}
            AND fact_record->>'metadataSchemaVersion' = ${request.metadataSchemaVersion}
          ORDER BY extraction_sequence, id
        `);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw new Error("CANOPYPROOF_E3D_RESULT_CARDINALITY_INVALID");
    const parsed = factEnvelopeSchema.parse(requestRowSchema.parse(rows[0]).fact_record);
    return this.#retention.getFact(request.organizationId, request.evidenceId, parsed.id) as
      Promise<CanopyProofEvidenceMetadataExtractionFact>;
  }

  private async findVerification(
    organizationId: string,
    extraction: CanopyProofEvidenceMetadataExtractionFact,
    object: CanopyProofEvidenceMetadataExtractionAuthority["object"],
  ) {
    const rows = await this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT fact_record
          FROM evidence.metadata_extraction_verification_facts
          WHERE organization_id = ${organizationId} AND extraction_id = ${extraction.id}
        `);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw new Error("CANOPYPROOF_E3D_VERIFICATION_CARDINALITY_INVALID");
    const verification = verificationEnvelopeSchema.parse(
      requestRowSchema.parse(rows[0]).fact_record,
    ) as CanopyProofEvidenceMetadataExtractionVerificationFact;
    return assertCanopyProofEvidenceMetadataExtractionVerificationFact(object, extraction, verification);
  }

  private async commitVerification(
    prepared: CanopyProofPreparedMetadataExtraction,
    extraction: CanopyProofEvidenceMetadataExtractionFact,
    receipt: CanopyProofDurableMetadataExtractionReceipt,
    verifierAgentId: string,
  ) {
    // Resolve the verifier before opening the write transaction. The SQL insert
    // trigger revalidates this snapshot against the current registry state, so
    // no second Prisma transaction or external work occurs while locks are held.
    const verifier = await this.#trust.getEvidenceMediaAgentAuthority(
      verifierAgentId,
      prepared.request.organizationId,
      "verified_metadata_extraction_receipt",
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, prepared.request.organizationId, verifierAgentId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `e3c-extraction:${extraction.id}`,
            );
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `domain-event:evidence-metadata-adapter:${extraction.evidenceId}`,
            );
            const existingRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
              SELECT fact_record
              FROM evidence.metadata_extraction_verification_facts
              WHERE extraction_id = ${extraction.id}
              FOR UPDATE
            `);
            if (existingRows.length > 1) {
              throw new Error("CANOPYPROOF_E3D_VERIFICATION_CARDINALITY_INVALID");
            }
            if (existingRows[0]) {
              const existing = verificationEnvelopeSchema.parse(
                requestRowSchema.parse(existingRows[0]).fact_record,
              ) as CanopyProofEvidenceMetadataExtractionVerificationFact;
              return assertCanopyProofEvidenceMetadataExtractionVerificationFact(
                prepared.authority.object,
                extraction,
                existing,
              );
            }
            const streamEvents = await loadAuditHistory(
              transaction,
              `evidence-metadata-adapter:${extraction.evidenceId}`,
            );
            const fact = buildCanopyProofEvidenceMetadataExtractionVerificationFact({
              object: prepared.authority.object,
              extraction,
              receipt,
              verifier,
              streamEvents,
            });
            await insertDomainEvent(
              transaction,
              `evidence-metadata-adapter:${extraction.evidenceId}`,
              fact.auditEvent,
            );
            requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
              INSERT INTO audit.command_receipts (
                id, actor_id, operation, idempotency_key_hash, request_hash,
                result_entity_type, result_entity_id, response_hash,
                audit_event_root, created_at
              ) VALUES (
                ${fact.commandReceiptId}, ${fact.verifierId},
                'evidence.metadata-extraction-receipt.verify', ${fact.commandHash},
                ${fact.commandHash}, 'metadata_extraction_receipt_verification',
                ${fact.id}, ${fact.factRoot}, ${fact.auditEvent.eventRoot},
                ${asDate(fact.verifiedAt)}
              )
            `));
            await insertVerificationFact(transaction, fact);
            return fact;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_E3D_VERIFICATION_WRITE_UNAVAILABLE");
  }
}

function parseRequest(input: unknown) {
  requestEnvelopeSchema.parse(input);
  return input as CanopyProofMetadataExtractionRequestFact;
}

function extractionInputFromReceipt(receipt: CanopyProofDurableMetadataExtractionReceipt) {
  return {
    objectId: receipt.objectId,
    extractorName: receipt.extractorName,
    extractorVersion: receipt.extractorVersion,
    extractorImageDigest: receipt.extractorImageDigest,
    metadataSchemaVersion: receipt.metadataSchemaVersion,
    exifHash: receipt.exifHash,
    gpsHash: receipt.gpsHash,
    metadataOutputRoot: receipt.metadataOutputRoot,
    locationDisclosure: receipt.locationDisclosure,
    ...(receipt.generalizedLocationHash
      ? { generalizedLocationHash: receipt.generalizedLocationHash }
      : {}),
    accuracyBand: receipt.accuracyBand,
    clockSkewBand: receipt.clockSkewBand,
    providerReceiptHash: receipt.receiptHash,
    providerVerificationState: "modeled_only" as const,
    observedAt: receipt.observedAt,
    extractedAt: receipt.extractedAt,
  };
}

function assertReceiptBindsRequest(
  request: CanopyProofMetadataExtractionRequestFact,
  receipt: CanopyProofDurableMetadataExtractionReceipt,
) {
  if (
    receipt.objectId !== request.objectId ||
    receipt.objectRoot !== request.objectRoot ||
    receipt.mediaProjectionRoot !== request.mediaProjectionRoot ||
    receipt.consentReceiptId !== request.consentReceiptId ||
    receipt.consentReceiptRoot !== request.consentReceiptRoot ||
    receipt.consentProjectionRoot !== request.consentProjectionRoot ||
    receipt.deviceAttestationId !== request.deviceAttestationId ||
    receipt.deviceAttestationRoot !== request.deviceAttestationRoot ||
    receipt.deviceProjectionRoot !== request.deviceProjectionRoot ||
    receipt.registeredGpsHash !== request.registeredGpsHash ||
    receipt.privacyMode !== request.privacyMode ||
    receipt.extractorId !== request.extractorId ||
    receipt.extractorName !== request.extractorName ||
    receipt.extractorVersion !== request.extractorVersion ||
    receipt.extractorImageDigest !== request.extractorImageDigest ||
    receipt.metadataSchemaVersion !== request.metadataSchemaVersion ||
    receipt.extractorPolicyRoot !== request.extractorPolicyRoot ||
    receipt.extractedAt !== request.requestedAt
  ) {
    throw new Error("CANOPYPROOF_E3D_RECEIPT_REQUEST_BINDING_INVALID");
  }
}

function assertExtractionBindsRequest(
  request: CanopyProofMetadataExtractionRequestFact,
  extraction: CanopyProofEvidenceMetadataExtractionFact,
) {
  if (
    extraction.organizationId !== request.organizationId ||
    extraction.projectId !== request.projectId ||
    extraction.evidenceId !== request.evidenceId ||
    extraction.objectId !== request.objectId ||
    extraction.objectRoot !== request.objectRoot ||
    extraction.mediaProjectionRoot !== request.mediaProjectionRoot ||
    extraction.consentReceiptId !== request.consentReceiptId ||
    extraction.consentReceiptRoot !== request.consentReceiptRoot ||
    extraction.consentProjectionRoot !== request.consentProjectionRoot ||
    extraction.deviceAttestationId !== request.deviceAttestationId ||
    extraction.deviceAttestationRoot !== request.deviceAttestationRoot ||
    extraction.deviceProjectionRoot !== request.deviceProjectionRoot ||
    extraction.gpsHash !== request.registeredGpsHash ||
    extraction.privacyMode !== request.privacyMode ||
    extraction.extractorName !== request.extractorName ||
    extraction.extractorVersion !== request.extractorVersion ||
    extraction.extractorImageDigest !== request.extractorImageDigest ||
    extraction.metadataSchemaVersion !== request.metadataSchemaVersion ||
    extraction.extractedAt !== request.requestedAt
  ) {
    throw new Error("CANOPYPROOF_E3D_EXTRACTION_REQUEST_BINDING_INVALID");
  }
}

async function insertRequestFact(
  transaction: E3dTransaction,
  fact: CanopyProofMetadataExtractionRequestFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO evidence.metadata_extraction_request_facts (
      id, organization_id, project_id, evidence_id, object_id, object_root,
      base_media_projection_root, media_adapter_trust_projection_root, media_projection_root,
      consent_receipt_id, consent_receipt_root, consent_projection_root,
      device_attestation_id, device_attestation_root, device_projection_root,
      registered_gps_hash, privacy_mode, extractor_id, extractor_name, extractor_version,
      extractor_image_digest, metadata_schema_version, extractor_policy_root, signer_set_root,
      maximum_observation_age_seconds, requested_by, requester_snapshot, requested_at,
      dispatch_expires_at,
      idempotency_key_hash, request_hash, command_hash, evidence_sequence, previous_event_root,
      command_receipt_id, request_root, safety, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId},
      ${fact.objectId}, ${fact.objectRoot}, ${fact.baseMediaProjectionRoot},
      ${fact.mediaAdapterTrustProjectionRoot}, ${fact.mediaProjectionRoot},
      ${fact.consentReceiptId}, ${fact.consentReceiptRoot}, ${fact.consentProjectionRoot},
      ${fact.deviceAttestationId}, ${fact.deviceAttestationRoot}, ${fact.deviceProjectionRoot},
      ${fact.registeredGpsHash}, ${fact.privacyMode}, ${fact.extractorId}, ${fact.extractorName},
      ${fact.extractorVersion}, ${fact.extractorImageDigest}, ${fact.metadataSchemaVersion},
      ${fact.extractorPolicyRoot}, ${fact.signerSetRoot}, ${fact.maximumObservationAgeSeconds},
      ${fact.requestedBy}, ${JSON.stringify(fact.requester)}::jsonb, ${asDate(fact.requestedAt)},
      ${asDate(fact.dispatchExpiresAt)},
      ${fact.idempotencyKeyHash}, ${fact.requestHash}, ${fact.commandHash},
      ${fact.evidenceSequence}, ${fact.previousEventRoot}, ${fact.commandReceiptId},
      ${fact.requestRoot}, ${JSON.stringify(fact.safety)}::jsonb,
      ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertVerificationFact(
  transaction: E3dTransaction,
  fact: CanopyProofEvidenceMetadataExtractionVerificationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO evidence.metadata_extraction_verification_facts (
      id, organization_id, project_id, evidence_id, object_id, object_root,
      extraction_id, extraction_root, verifier_id, verifier_snapshot, extractor_id,
      signer_key_id, signature_algorithm, signature_hash, extractor_policy_root,
      metadata_receipt_hash, adapter_verification_root, verified_at, verification_root,
      command_hash, evidence_sequence, previous_event_root, command_receipt_id,
      fact_root, safety, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId},
      ${fact.objectId}, ${fact.objectRoot}, ${fact.extractionId}, ${fact.extractionRoot},
      ${fact.verifierId}, ${JSON.stringify(fact.verifier)}::jsonb, ${fact.extractorId},
      ${fact.signerKeyId}, ${fact.signatureAlgorithm}, ${fact.signatureHash},
      ${fact.extractorPolicyRoot}, ${fact.metadataReceiptHash},
      ${fact.adapterVerificationRoot}, ${asDate(fact.verifiedAt)}, ${fact.verificationRoot},
      ${fact.commandHash}, ${fact.evidenceSequence}, ${fact.previousEventRoot},
      ${fact.commandReceiptId}, ${fact.factRoot}, ${JSON.stringify(fact.safety)}::jsonb,
      ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertDomainEvent(
  transaction: E3dTransaction,
  streamId: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${streamId}, ${event.action}, ${event.actor}, ${event.entityType},
      ${event.entityId}, ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot},
      ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

async function loadAuditHistory(transaction: E3dTransaction, streamId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, action, actor_id, entity_type, entity_id, previous_root,
           payload_hash, event_root, created_at, rationale, sequence_no
    FROM audit.domain_events
    WHERE stream_id = ${streamId}
    ORDER BY sequence_no
  `);
  const events = rows.map((row) => {
    const parsed = auditEventRowSchema.parse(row);
    return {
      id: parsed.id,
      action: parsed.action,
      actor: parsed.actor_id,
      entityType: parsed.entity_type,
      entityId: parsed.entity_id,
      previousRoot: parsed.previous_root,
      payloadHash: parsed.payload_hash,
      eventRoot: parsed.event_root,
      createdAt: parsed.created_at.toISOString(),
      rationale: parsed.rationale,
    } satisfies CanopyProofAuditEvent;
  });
  const terminal = events.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(events, terminal.createdAt).valid) {
    throw new Error("CANOPYPROOF_E3D_EVENT_STREAM_INVALID");
  }
  return events;
}

async function setContext(
  transaction: E3dTransaction,
  organizationId: string,
  actorId = "system-read",
) {
  await transaction.$queryRaw(
    Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`,
  );
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_E3D_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_E3D_MUTATION_CARDINALITY_INVALID");
}

function isRetryable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "P2034" ||
    (typeof candidate.message === "string" && /serialization|deadlock/i.test(candidate.message));
}
