import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CanopyProofEvidenceDeviceAttestationFact } from "./evidence-custody-authority.js";
import {
  assertCanopyProofDeviceAttestationVerificationFact,
  buildCanopyProofDeviceAttestationVerificationFact,
  isCanopyProofDurableDeviceAttestationReceipt,
  projectCanopyProofEffectiveDeviceAttestation,
  type CanopyProofDeviceAttestationVerificationFact,
  type CanopyProofDurableDeviceAttestationReceipt,
  type CanopyProofEffectiveDeviceAttestationProjection,
} from "./evidence-device-attestation-adapter-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import {
  canopyProofAuditEntityTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import { PrismaCanopyProofTrustRegistryService } from "./trust-registry.js";

type E1aTransaction = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const factRowSchema = z.object({ fact_record: z.unknown() });
const factEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_device_attestation_receipt_verification"),
    id: z.string().min(1),
    attestationId: z.string().min(1),
    attestationRoot: z.string().regex(HASH_PATTERN),
    signedReceiptHash: z.string().regex(HASH_PATTERN),
    verificationRoot: z.string().regex(HASH_PATTERN),
    factRoot: z.string().regex(HASH_PATTERN),
  })
  .passthrough();
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
const projectionRowSchema = z.object({
  attestation_id: z.string().min(1),
  attestation_root: z.string().regex(HASH_PATTERN),
  organization_id: z.string().min(1),
  subject_id: z.string().min(1),
  consent_receipt_id: z.string().min(1),
  state: z.enum([
    "current",
    "expired",
    "consent_revoked",
    "consent_expired",
    "needs_review",
    "rejected",
    "verification_expired",
  ]),
  issue_codes: z.array(z.string()),
  evaluated_at_utc: z.coerce.date(),
  consent_projection_root: z.string().regex(HASH_PATTERN),
  verification_fact_id: z.string().nullish(),
  verification_root: z.string().regex(HASH_PATTERN).nullish(),
  projection_root: z.string().regex(HASH_PATTERN),
  safety: z.unknown(),
});

export type CanopyProofDeviceAttestationVerificationBundle = Readonly<{
  attestation: CanopyProofEvidenceDeviceAttestationFact;
  verification: CanopyProofDeviceAttestationVerificationFact;
  projection: CanopyProofEffectiveDeviceAttestationProjection;
}>;

export class PrismaCanopyProofDeviceAttestationAdapterRepository {
  readonly #trust: PrismaCanopyProofTrustRegistryService;

  constructor(private readonly prisma: PrismaClient) {
    this.#trust = new PrismaCanopyProofTrustRegistryService(prisma);
  }

  getStatus() {
    return {
      service: "canopyproof-device-attestation-adapter-repository" as const,
      storage: "postgresql" as const,
      routeMounted: false as const,
      productionActivated: false as const,
      appendOnly: true as const,
      tenantScoped: true as const,
      serializableWrites: true as const,
      baseAttestationMutated: false as const,
      rawSignaturePersisted: false as const,
      finalProofAuthority: false as const,
    };
  }

  getDeviceAttestation(attestationId: string, organizationId: string) {
    return this.#trust.getEvidenceDeviceAttestation(attestationId, organizationId);
  }

  async findVerification(
    attestationId: string,
    organizationId: string,
    challengeHash?: string,
  ): Promise<CanopyProofDeviceAttestationVerificationFact | undefined> {
    const attestation = await this.getDeviceAttestation(attestationId, organizationId);
    const rows = await this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT fact_record
          FROM identity.device_attestation_verification_facts
          WHERE attestation_id = ${attestationId}
            ${challengeHash ? Prisma.sql`AND challenge_hash = ${challengeHash}` : Prisma.empty}
          ORDER BY verified_at DESC, attestation_sequence DESC, id DESC
          LIMIT 1
        `);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (rows.length === 0) return undefined;
    return parseAndAssertFact(attestation, rows[0]);
  }

  async commitVerification(input: Readonly<{
    receipt: CanopyProofDurableDeviceAttestationReceipt;
    organizationId: string;
    verifierAgentId: string;
  }>): Promise<CanopyProofDeviceAttestationVerificationFact> {
    if (!isCanopyProofDurableDeviceAttestationReceipt(input.receipt)) {
      throw new Error("CANOPYPROOF_E1A_RECEIPT_NOT_MINIMIZED_BY_AUTHORITY");
    }
    const attestation = await this.getDeviceAttestation(
      input.receipt.attestationId,
      input.organizationId,
    );
    const verifier = await this.#trust.getEvidenceMediaAgentAuthority(
      input.verifierAgentId,
      input.organizationId,
      "device_attestation_receipt",
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, input.organizationId, input.verifierAgentId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `e1a-attestation:${attestation.id}`,
            );
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `domain-event:evidence-device-adapter:${attestation.id}`,
            );
            const existingRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
              SELECT fact_record
              FROM identity.device_attestation_verification_facts
              WHERE signed_receipt_hash = ${input.receipt.receiptHash}
              FOR UPDATE
            `);
            if (existingRows.length > 1) {
              throw new Error("CANOPYPROOF_E1A_VERIFICATION_CARDINALITY_INVALID");
            }
            if (existingRows[0]) return parseAndAssertFact(attestation, existingRows[0]);

            const streamId = `evidence-device-adapter:${attestation.id}`;
            const streamEvents = await loadAuditHistory(transaction, streamId);
            const fact = buildCanopyProofDeviceAttestationVerificationFact({
              attestation,
              receipt: input.receipt,
              verifier,
              streamEvents,
            });
            await insertDomainEvent(transaction, streamId, fact.auditEvent);
            await insertCommandReceipt(transaction, fact);
            await insertVerificationFact(transaction, fact);
            return fact;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_E1A_VERIFICATION_WRITE_UNAVAILABLE");
  }

  async getEffectiveProjection(
    attestationId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEffectiveDeviceAttestationProjection> {
    const evaluation = canonicalInstant(evaluatedAt);
    const attestation = await this.getDeviceAttestation(attestationId, organizationId);
    const consentProjection = await this.#trust.getEvidenceConsentProjection(
      attestation.consentReceiptId,
      organizationId,
      evaluation,
    );
    const result = await this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const [projectionRows, factRows] = await Promise.all([
          transaction.$queryRaw<unknown[]>(Prisma.sql`
            SELECT * FROM evidence.effective_device_attestation_projection(
              ${attestationId}, ${asDate(evaluation)}
            )
          `),
          transaction.$queryRaw<unknown[]>(Prisma.sql`
            SELECT fact_record
            FROM identity.device_attestation_verification_facts
            WHERE attestation_id = ${attestationId} AND verified_at <= ${asDate(evaluation)}
            ORDER BY verified_at, attestation_sequence, id
          `),
        ]);
        return { projectionRows, factRows };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (result.projectionRows.length !== 1) {
      throw new Error("CANOPYPROOF_E1A_PROJECTION_CARDINALITY_INVALID");
    }
    const facts = result.factRows.map((row) => parseAndAssertFact(attestation, row));
    const sqlProjection = mapProjection(result.projectionRows[0]);
    const replayed = projectCanopyProofEffectiveDeviceAttestation({
      attestation,
      consentProjection,
      verifications: facts,
      evaluatedAt: evaluation,
    });
    if (hashJson(sqlProjection) !== hashJson(replayed)) {
      throw new Error("CANOPYPROOF_E1A_PROJECTION_PARITY_INVALID");
    }
    return sqlProjection;
  }

  async getVerificationBundle(
    attestationId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofDeviceAttestationVerificationBundle | undefined> {
    const verification = await this.findVerification(attestationId, organizationId);
    if (!verification) return undefined;
    const attestation = await this.getDeviceAttestation(attestationId, organizationId);
    const projection = await this.getEffectiveProjection(attestationId, organizationId, evaluatedAt);
    return { attestation, verification, projection };
  }
}

function parseAndAssertFact(attestation: CanopyProofEvidenceDeviceAttestationFact, row: unknown) {
  const record = factRowSchema.parse(row).fact_record;
  factEnvelopeSchema.parse(record);
  return assertCanopyProofDeviceAttestationVerificationFact(
    attestation,
    record as CanopyProofDeviceAttestationVerificationFact,
  );
}

function mapProjection(row: unknown): CanopyProofEffectiveDeviceAttestationProjection {
  const parsed = projectionRowSchema.parse(row);
  return {
    attestationId: parsed.attestation_id,
    attestationRoot: parsed.attestation_root,
    organizationId: parsed.organization_id,
    subjectId: parsed.subject_id,
    consentReceiptId: parsed.consent_receipt_id,
    state: parsed.state,
    issueCodes: parsed.issue_codes,
    evaluatedAt: parsed.evaluated_at_utc.toISOString(),
    consentProjectionRoot: parsed.consent_projection_root,
    ...(parsed.verification_fact_id ? { verificationFactId: parsed.verification_fact_id } : {}),
    ...(parsed.verification_root ? { verificationRoot: parsed.verification_root } : {}),
    projectionRoot: parsed.projection_root,
    safety: parsed.safety as CanopyProofEffectiveDeviceAttestationProjection["safety"],
  };
}

async function insertDomainEvent(
  transaction: E1aTransaction,
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

async function insertCommandReceipt(
  transaction: E1aTransaction,
  fact: CanopyProofDeviceAttestationVerificationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${fact.commandReceiptId}, ${fact.verifierId},
      'evidence.device-attestation-receipt.verify', ${fact.commandHash}, ${fact.commandHash},
      'device_attestation_receipt_verification', ${fact.id}, ${fact.factRoot},
      ${fact.auditEvent.eventRoot}, ${asDate(fact.verifiedAt)}
    )
  `));
}

async function insertVerificationFact(
  transaction: E1aTransaction,
  fact: CanopyProofDeviceAttestationVerificationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO identity.device_attestation_verification_facts (
      id, organization_id, subject_id, subject_root, consent_receipt_id,
      consent_receipt_root, attestation_id, attestation_root, provider,
      attestation_type, provider_key_id, provider_receipt_hash, verifier_id,
      verifier_snapshot, provider_verifier_id, provider_verifier_version,
      signer_key_id, signer_set_root, provider_policy_root, challenge_hash,
      signed_receipt_hash, signature_algorithm, signature_hash,
      adapter_verification_root, result, reason_codes, verified_at, expires_at,
      verification_root, command_hash, attestation_sequence, previous_event_root,
      command_receipt_id, fact_root, safety, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.subjectId}, ${fact.subjectRoot},
      ${fact.consentReceiptId}, ${fact.consentReceiptRoot}, ${fact.attestationId},
      ${fact.attestationRoot}, ${fact.provider}, ${fact.attestationType},
      ${fact.providerKeyId}, ${fact.providerReceiptHash}, ${fact.verifierId},
      ${JSON.stringify(fact.verifier)}::jsonb, ${fact.providerVerifierId},
      ${fact.providerVerifierVersion}, ${fact.signerKeyId}, ${fact.signerSetRoot},
      ${fact.providerPolicyRoot}, ${fact.challengeHash}, ${fact.signedReceiptHash},
      ${fact.signatureAlgorithm}, ${fact.signatureHash}, ${fact.adapterVerificationRoot},
      ${fact.result}, ${textArray(fact.reasonCodes)}, ${asDate(fact.verifiedAt)},
      ${asDate(fact.expiresAt)}, ${fact.verificationRoot}, ${fact.commandHash},
      ${fact.attestationSequence}, ${fact.previousEventRoot}, ${fact.commandReceiptId},
      ${fact.factRoot}, ${JSON.stringify(fact.safety)}::jsonb,
      ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function loadAuditHistory(transaction: E1aTransaction, streamId: string) {
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
    throw new Error("CANOPYPROOF_E1A_EVENT_STREAM_INVALID");
  }
  return events;
}

async function setContext(
  transaction: E1aTransaction,
  organizationId: string,
  actorId = "system-read",
) {
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config('app.organization_id', ${organizationId}, true)
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config('app.actor_id', ${actorId}, true)
  `);
}

function textArray(values: readonly string[]) {
  return values.length > 0
    ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]`
    : Prisma.sql`ARRAY[]::text[]`;
}

function canonicalInstant(value: string) {
  const canonical = new Date(value).toISOString();
  if (canonical !== value) throw new Error("CANOPYPROOF_E1A_TIMESTAMP_INVALID");
  return canonical;
}

function asDate(value: string) {
  return new Date(canonicalInstant(value));
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_E1A_MUTATION_CARDINALITY_INVALID");
}
