import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofRootGovernanceAuthorityService,
  parseCanopyProofRootGovernanceAttestationFact,
  parseCanopyProofRootGovernanceDecisionFact,
  parseCanopyProofRootGovernanceProposalFact,
  type CanopyProofRootGovernanceAttestationFact,
  type CanopyProofRootGovernanceAuthoritySnapshot,
  type CanopyProofRootGovernanceDecisionFact,
  type CanopyProofRootGovernanceFact,
  type CanopyProofRootGovernanceProposalFact,
} from "./root-governance-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";

type RootGovernanceTransaction = Prisma.TransactionClient;

export type CanopyProofRootGovernanceRepositoryStatus = Readonly<{
  service: "canopyproof-root-governance-authority-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  publicBootstrapEndpoint: false;
  privateKeyHandling: false;
  compatibilityAuthorityFallback: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  signatureReplayRequired: true;
}>;

const operations = {
  proposal: "root-governance-proposal.commit",
  attestation: "root-governance-attestation.commit",
  decision: "root-governance-decision.commit",
} as const;
const resultTypes = {
  proposal: "root_governance_proposal",
  attestation: "root_governance_attestation",
  decision: "root_governance_decision",
} as const;
const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const resultTypeSchema = z.enum([resultTypes.proposal, resultTypes.attestation, resultTypes.decision]);
type ResultType = z.output<typeof resultTypeSchema>;
const receiptRowSchema = z
  .object({
    request_hash: rootSchema,
    result_entity_type: resultTypeSchema,
    result_entity_id: identifierSchema,
    response_hash: rootSchema,
    audit_event_root: rootSchema,
  })
  .strict();
const factRowSchema = z
  .object({
    id: identifierSchema,
    fact_record: z.unknown(),
    audit_event_root: rootSchema,
  })
  .strict();

export class PrismaCanopyProofRootGovernanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofRootGovernanceRepositoryStatus {
    return {
      service: "canopyproof-root-governance-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      publicBootstrapEndpoint: false,
      privateKeyHandling: false,
      compatibilityAuthorityFallback: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      signatureReplayRequired: true,
    };
  }

  async commitProposal(
    factInput: CanopyProofRootGovernanceProposalFact,
    idempotencyKeyInput: string,
  ): Promise<CanopyProofRootGovernanceProposalFact> {
    const fact = parseCanopyProofRootGovernanceProposalFact(factInput);
    return this.commitFact(fact, idempotencyKeyInput, "proposal");
  }

  async commitAttestation(
    factInput: CanopyProofRootGovernanceAttestationFact,
    idempotencyKeyInput: string,
  ): Promise<CanopyProofRootGovernanceAttestationFact> {
    const fact = parseCanopyProofRootGovernanceAttestationFact(factInput);
    return this.commitFact(fact, idempotencyKeyInput, "attestation");
  }

  async commitDecision(
    factInput: CanopyProofRootGovernanceDecisionFact,
    idempotencyKeyInput: string,
  ): Promise<CanopyProofRootGovernanceDecisionFact> {
    const fact = parseCanopyProofRootGovernanceDecisionFact(factInput);
    return this.commitFact(fact, idempotencyKeyInput, "decision");
  }

  async getProjection(asOfInput: string, actorIdInput: string) {
    const asOf = canonicalTimestamp(asOfInput);
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, actorId);
        return (await loadRootGovernanceService(transaction)).getProjection(asOf);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getAuthoritySnapshot(actorIdInput: string) {
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, actorId);
        return loadRootGovernanceSnapshot(transaction);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async commitFact<T extends CanopyProofRootGovernanceFact>(
    fact: T,
    idempotencyKeyInput: string,
    kind: "proposal" | "attestation" | "decision",
  ): Promise<T> {
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = fact.auditEvent.actor;
    const operation = operations[kind];
    const resultType = resultTypes[kind];
    const responseHash = factRoot(fact);
    const requestHash = hashJson({ kind: `canopyproof-${operation}-v1`, fact });
    const receipt = receiptIdentity(actorId, operation, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, actorId);
      await lockCommandAndStream(transaction, receipt.id);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, resultType, fact.id, responseHash, fact.auditEvent.eventRoot);
        return (await requireFact(transaction, fact.id, kind)) as T;
      }
      const snapshot = await loadRootGovernanceSnapshot(transaction);
      await assertAppendedSnapshot(snapshot, fact);
      await insertDomainEvent(transaction, fact.auditEvent);
      await insertFact(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId,
        operation,
        requestHash,
        resultType,
        resultId: fact.id,
        responseHash,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.auditEvent.createdAt,
      });
      return (await requireFact(transaction, fact.id, kind)) as T;
    });
  }

  private async withSerializableRetry<T>(operation: (transaction: RootGovernanceTransaction) => Promise<T>) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_DURABLE_WRITE_UNAVAILABLE");
  }
}

async function assertAppendedSnapshot(
  snapshot: CanopyProofRootGovernanceAuthoritySnapshot,
  fact: CanopyProofRootGovernanceFact,
) {
  const next: CanopyProofRootGovernanceAuthoritySnapshot = {
    proposalFacts:
      fact.factType === "root_governance_proposal" ? [...snapshot.proposalFacts, fact] : snapshot.proposalFacts,
    attestationFacts:
      fact.factType === "root_governance_attestation"
        ? [...snapshot.attestationFacts, fact]
        : snapshot.attestationFacts,
    decisionFacts:
      fact.factType === "root_governance_decision" ? [...snapshot.decisionFacts, fact] : snapshot.decisionFacts,
  };
  const replayed = await CanopyProofRootGovernanceAuthorityService.fromAuthoritySnapshot(next);
  const persisted = replayed.getAuthoritySnapshot();
  if (hashJson(persisted) !== hashJson(next)) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_REBUILD_MISMATCH");
  }
}

async function loadRootGovernanceService(transaction: RootGovernanceTransaction) {
  const snapshot = await loadRootGovernanceSnapshot(transaction);
  if (
    snapshot.proposalFacts.length === 0 &&
    snapshot.attestationFacts.length === 0 &&
    snapshot.decisionFacts.length === 0
  ) {
    return new CanopyProofRootGovernanceAuthorityService();
  }
  return CanopyProofRootGovernanceAuthorityService.fromAuthoritySnapshot(snapshot);
}

async function loadRootGovernanceSnapshot(
  transaction: RootGovernanceTransaction,
): Promise<CanopyProofRootGovernanceAuthoritySnapshot> {
  const [proposalRows, attestationRows, decisionRows] = await Promise.all([
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM governance.root_governance_proposal_facts ORDER BY global_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM governance.root_governance_attestation_facts ORDER BY global_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM governance.root_governance_decision_facts ORDER BY global_sequence
    `),
  ]);
  if (proposalRows.length + attestationRows.length + decisionRows.length > 4_096) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_HISTORY_LIMIT_EXCEEDED");
  }
  return {
    proposalFacts: proposalRows.map((row) =>
      parseFactRow(row, parseCanopyProofRootGovernanceProposalFact),
    ),
    attestationFacts: attestationRows.map((row) =>
      parseFactRow(row, parseCanopyProofRootGovernanceAttestationFact),
    ),
    decisionFacts: decisionRows.map((row) =>
      parseFactRow(row, parseCanopyProofRootGovernanceDecisionFact),
    ),
  };
}

function parseFactRow<T extends { id: string; auditEvent: CanopyProofAuditEvent }>(
  input: unknown,
  parse: (value: unknown) => T,
) {
  const row = factRowSchema.parse(input);
  const fact = parse(row.fact_record);
  if (fact.id !== row.id || fact.auditEvent.eventRoot !== row.audit_event_root) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_FACT_COLUMNS_INVALID");
  }
  return fact;
}

async function requireFact(
  transaction: RootGovernanceTransaction,
  factId: string,
  kind: "proposal" | "attestation" | "decision",
) {
  const relation = {
    proposal: Prisma.raw("governance.root_governance_proposal_facts"),
    attestation: Prisma.raw("governance.root_governance_attestation_facts"),
    decision: Prisma.raw("governance.root_governance_decision_facts"),
  }[kind];
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root FROM ${relation} WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ROOT_GOVERNANCE_${kind.toUpperCase()}_NOT_FOUND`);
  if (kind === "proposal") {
    return parseFactRow(rows[0], parseCanopyProofRootGovernanceProposalFact);
  }
  if (kind === "attestation") {
    return parseFactRow(rows[0], parseCanopyProofRootGovernanceAttestationFact);
  }
  return parseFactRow(rows[0], parseCanopyProofRootGovernanceDecisionFact);
}

async function insertFact(transaction: RootGovernanceTransaction, fact: CanopyProofRootGovernanceFact) {
  if (fact.factType === "root_governance_proposal") return insertProposalFact(transaction, fact);
  if (fact.factType === "root_governance_attestation") return insertAttestationFact(transaction, fact);
  return insertDecisionFact(transaction, fact);
}

async function insertProposalFact(
  transaction: RootGovernanceTransaction,
  fact: CanopyProofRootGovernanceProposalFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.root_governance_proposal_facts (
        id, action, charter_version, charter_document_root, policy_root, delegated_scopes,
        council_members, council_root, required_approvals, requested_valid_until,
        predecessor_decision_id, predecessor_decision_root, target_decision_id, target_decision_root,
        reason_code, proposer_id, proposer_organization_id, proposer_member_root, proposed_at,
        global_sequence, previous_event_root, command_hash, proposal_hash, proposal_root,
        audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.action}, ${fact.charterVersion}, ${fact.charterDocumentRoot}, ${fact.policyRoot},
        ${[...fact.delegatedScopes]}, ${JSON.stringify(fact.councilMembers)}::jsonb, ${fact.councilRoot},
        ${fact.requiredApprovals}, ${asDate(fact.requestedValidUntil)}, ${fact.predecessorDecisionId},
        ${fact.predecessorDecisionRoot}, ${fact.targetDecisionId}, ${fact.targetDecisionRoot},
        ${fact.reasonCode}, ${fact.proposer.participantId}, ${fact.proposer.organizationId},
        ${fact.proposer.memberRoot}, ${asDate(fact.proposedAt)}, ${fact.globalSequence},
        ${fact.previousEventRoot}, ${fact.commandHash}, ${fact.proposalHash}, ${fact.proposalRoot},
        ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertAttestationFact(
  transaction: RootGovernanceTransaction,
  fact: CanopyProofRootGovernanceAttestationFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.root_governance_attestation_facts (
        id, proposal_id, proposal_root, decision, signer_id, signer_organization_id,
        signer_member_root, signed_payload_root, signature_hash, verification_receipt_root,
        attested_at, global_sequence, previous_event_root, command_hash, attestation_hash,
        attestation_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.proposalId}, ${fact.proposalRoot}, ${fact.decision},
        ${fact.signer.participantId}, ${fact.signer.organizationId}, ${fact.signer.memberRoot},
        ${fact.signedPayloadRoot}, ${fact.signatureHash}, ${fact.verificationReceiptRoot},
        ${asDate(fact.attestedAt)}, ${fact.globalSequence}, ${fact.previousEventRoot},
        ${fact.commandHash}, ${fact.attestationHash}, ${fact.attestationRoot},
        ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDecisionFact(
  transaction: RootGovernanceTransaction,
  fact: CanopyProofRootGovernanceDecisionFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO governance.root_governance_decision_facts (
        id, proposal_id, proposal_root, action, approval_attestation_ids,
        approval_attestation_roots, approval_quorum_root, predecessor_decision_id,
        predecessor_decision_root, charter_decision_id, charter_decision_root,
        effective_from, effective_until, decided_at, global_sequence, previous_event_root,
        command_hash, decision_hash, decision_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.proposalId}, ${fact.proposalRoot}, ${fact.action},
        ${[...fact.approvalAttestationIds]}, ${[...fact.approvalAttestationRoots]},
        ${fact.approvalQuorumRoot}, ${fact.predecessorDecisionId}, ${fact.predecessorDecisionRoot},
        ${fact.charterDecisionId}, ${fact.charterDecisionRoot}, ${asDate(fact.effectiveFrom)},
        ${asDate(fact.effectiveUntil)}, ${asDate(fact.decidedAt)}, ${fact.globalSequence},
        ${fact.previousEventRoot}, ${fact.commandHash}, ${fact.decisionHash}, ${fact.decisionRoot},
        ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDomainEvent(transaction: RootGovernanceTransaction, event: CanopyProofAuditEvent) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, 'root-governance:organization-accreditation', ${event.action}, ${event.actor},
        ${event.entityType}, ${event.entityId}, ${event.previousRoot}, ${event.payloadHash},
        ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
      )
    `),
  );
}

async function lockCommandAndStream(transaction: RootGovernanceTransaction, receiptId: string) {
  await acquireCanopyProofPostgresTransactionLock(transaction, `root-governance-command:${receiptId}`);
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    "root-governance:organization-accreditation",
  );
}

async function setContext(transaction: RootGovernanceTransaction, actorId: string) {
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
  await transaction.$queryRaw(
    Prisma.sql`SELECT set_config('app.root_governance_access', 'authorized', true)`,
  );
}

async function readReceipt(transaction: RootGovernanceTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_RECEIPT_DUPLICATE");
  return rows.length === 0 ? undefined : receiptRowSchema.parse(rows[0]);
}

function assertReceipt(
  receipt: z.output<typeof receiptRowSchema>,
  requestHash: string,
  resultType: ResultType,
  resultId: string,
  responseHash: string,
  auditEventRoot: string,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_type !== resultType ||
    receipt.result_entity_id !== resultId ||
    receipt.response_hash !== responseHash ||
    receipt.audit_event_root !== auditEventRoot
  ) {
    throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: RootGovernanceTransaction,
  input: Readonly<{
    id: string;
    idempotencyKeyHash: string;
    actorId: string;
    operation: string;
    requestHash: string;
    resultType: ResultType;
    resultId: string;
    responseHash: string;
    auditEventRoot: string;
    createdAt: string;
  }>,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.command_receipts (
        id, actor_id, operation, idempotency_key_hash, request_hash,
        result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
      ) VALUES (
        ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
        ${input.requestHash}, ${input.resultType}, ${input.resultId}, ${input.responseHash},
        ${input.auditEventRoot}, ${asDate(input.createdAt)}
      )
    `),
  );
}

function receiptIdentity(actorId: string, operation: string, idempotencyKey: string) {
  const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
  return {
    idempotencyKeyHash,
    id: `cp_root_governance_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`,
  };
}

function factRoot(fact: CanopyProofRootGovernanceFact) {
  if (fact.factType === "root_governance_proposal") return fact.proposalRoot;
  if (fact.factType === "root_governance_attestation") return fact.attestationRoot;
  return fact.decisionRoot;
}

function canonicalTimestamp(value: string) {
  const parsed = timestampSchema.parse(value);
  const canonical = new Date(parsed).toISOString();
  if (canonical !== parsed) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_TIMESTAMP_INVALID");
  return canonical;
}

function asDate(value: string) {
  return new Date(canonicalTimestamp(value));
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_ROOT_GOVERNANCE_MUTATION_CARDINALITY_INVALID");
}
