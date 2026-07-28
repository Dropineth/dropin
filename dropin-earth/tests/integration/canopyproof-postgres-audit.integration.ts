import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import {
  buildCanopyProofDatabaseAuditEvent,
  verifyCanopyProofDatabaseAuditStream,
} from "../../services/api/src/domain/canopyproof/database-audit-transparency.js";
import {
  CanopyProofPartnerService,
  type CanopyProofDataAccessRequest,
  type CanopyProofDataAccessRequestDecision,
  type CanopyProofDataSharingAgreement,
  type CanopyProofDataSharingAgreementRevocation,
  type CanopyProofDataSharingAgreementSupersession,
  type CanopyProofMembership,
  type CanopyProofOrganizationProfile,
} from "../../services/api/src/domain/canopyproof/partner-collaboration.js";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

type DatabaseAuditEventRow = {
  readonly event_version: "canopyproof_db_audit_v2";
  readonly stream_key: string;
  readonly schema_name: string;
  readonly table_name: string;
  readonly row_pk_hash: string;
  readonly sequence_no: number | bigint;
  readonly action: "INSERT" | "UPDATE" | "DELETE";
  readonly actor_id: string;
  readonly recorded_at_unix_micros: number | bigint;
  readonly previous_event_hash: string;
  readonly before_state_hash: string;
  readonly after_state_hash: string;
  readonly event_hash: string;
};

type DatabaseAuditCheckpointRow = {
  readonly checkpoint_version: "canopyproof_db_audit_checkpoint_v1";
  readonly stream_key: string;
  readonly first_sequence_no: number | bigint;
  readonly last_sequence_no: number | bigint;
  readonly event_count: number;
  readonly first_event_hash: string;
  readonly terminal_event_hash: string;
  readonly event_root: string;
  readonly created_by: string;
  readonly created_at_unix_micros: number | bigint;
  readonly checkpoint_hash: string;
};

type AuthorizationBindingRow = {
  readonly participant_id: string;
  readonly participant_type: string;
  readonly participant_roles: readonly string[];
  readonly participant_verification_status: string;
  readonly bound_organization_id: string | null;
  readonly organization_verification_status: string | null;
  readonly organization_accreditation_status: string | null;
  readonly membership_id: string | null;
  readonly membership_role: string | null;
  readonly membership_status: string | null;
  readonly latest_accreditation_id: string | null;
  readonly latest_accreditation_status: string | null;
};

async function actorTransaction<T>(db: PGlite, actorId: string, operation: (transaction: Transaction) => Promise<T>) {
  return db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    return operation(transaction);
  });
}

function databaseEvent(row: DatabaseAuditEventRow) {
  return {
    eventVersion: row.event_version,
    streamKey: row.stream_key,
    schemaName: row.schema_name,
    tableName: row.table_name,
    rowPkHash: row.row_pk_hash,
    sequenceNo: String(row.sequence_no),
    action: row.action,
    actorId: row.actor_id,
    recordedAtUnixMicros: String(row.recorded_at_unix_micros),
    previousEventHash: row.previous_event_hash,
    beforeStateHash: row.before_state_hash,
    afterStateHash: row.after_state_hash,
    eventHash: row.event_hash,
  };
}

function databaseCheckpoint(row: DatabaseAuditCheckpointRow) {
  return {
    checkpointVersion: row.checkpoint_version,
    streamKey: row.stream_key,
    firstSequenceNo: String(row.first_sequence_no),
    lastSequenceNo: String(row.last_sequence_no),
    eventCount: Number(row.event_count),
    firstEventHash: row.first_event_hash,
    terminalEventHash: row.terminal_event_hash,
    eventRoot: row.event_root,
    createdBy: row.created_by,
    createdAtUnixMicros: String(row.created_at_unix_micros),
    checkpointHash: row.checkpoint_hash,
  };
}

async function insertDomainEvent(transaction: Transaction, streamId: string, event: CanopyProofAuditEvent) {
  return transaction.query(
    `INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      event.id,
      streamId,
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
}

async function insertOrganizationProfile(transaction: Transaction, organization: CanopyProofOrganizationProfile) {
  return transaction.query(
    `INSERT INTO organizations.organizations (
      id, name, organization_type, legal_name, jurisdiction, public_contact,
      operating_regions, verification_capabilities, registration_number,
      verification_status, trust_level, documents, authorized_users,
      accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18)`,
    [
      organization.id,
      organization.name,
      organization.organizationType,
      organization.legalName,
      organization.jurisdiction,
      organization.publicContact,
      organization.operatingRegions,
      organization.verificationCapabilities,
      organization.registrationNumber ?? null,
      organization.verificationStatus,
      organization.trustLevel,
      JSON.stringify(organization.documents),
      JSON.stringify(organization.authorizedUsers),
      organization.accreditationStatus,
      organization.dataSharingPolicy,
      organization.profileHash,
      organization.createdAt,
      organization.updatedAt,
    ],
  );
}

async function insertDataSharingAgreement(transaction: Transaction, agreement: CanopyProofDataSharingAgreement) {
  return transaction.query(
    `INSERT INTO organizations.data_sharing_agreements (
      id, organization_id, dataset_scopes, privacy_tier, permitted_uses,
      revoked, expires_at, created_by, created_at, agreement_hash, audit_event_root
    ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, $9, $10)`,
    [
      agreement.id,
      agreement.organizationId,
      agreement.datasetScopes,
      agreement.privacyTier,
      agreement.permittedUses,
      agreement.expiresAt ?? null,
      agreement.createdBy,
      agreement.createdAt,
      agreement.agreementHash,
      agreement.auditEvent.eventRoot,
    ],
  );
}

async function insertDataSharingAgreementRevocation(
  transaction: Transaction,
  revocation: CanopyProofDataSharingAgreementRevocation,
) {
  return transaction.query(
    `INSERT INTO organizations.data_sharing_agreement_revocations (
      id, organization_id, agreement_id, rationale, evidence_event_roots,
      revoked_by, revoked_at, revocation_hash, revocation_root, safety,
      audit_event_root
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
    [
      revocation.id,
      revocation.organizationId,
      revocation.agreementId,
      revocation.rationale,
      revocation.evidenceEventRoots,
      revocation.revokedBy,
      revocation.revokedAt,
      revocation.revocationHash,
      revocation.revocationRoot,
      JSON.stringify(revocation.safety),
      revocation.auditEvent.eventRoot,
    ],
  );
}

async function insertDataSharingAgreementSupersession(
  transaction: Transaction,
  supersession: CanopyProofDataSharingAgreementSupersession,
) {
  return transaction.query(
    `INSERT INTO organizations.data_sharing_agreement_supersessions (
      id, organization_id, predecessor_agreement_id, predecessor_agreement_hash,
      successor_agreement_id, successor_agreement_hash, transition_type,
      rationale, evidence_event_roots, superseded_by, superseded_at,
      supersession_hash, supersession_root, safety, audit_event_root
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)`,
    [
      supersession.id,
      supersession.organizationId,
      supersession.predecessorAgreementId,
      supersession.predecessorAgreementHash,
      supersession.successorAgreementId,
      supersession.successorAgreementHash,
      supersession.transitionType,
      supersession.rationale,
      supersession.evidenceEventRoots,
      supersession.supersededBy,
      supersession.supersededAt,
      supersession.supersessionHash,
      supersession.supersessionRoot,
      JSON.stringify(supersession.safety),
      supersession.auditEvent.eventRoot,
    ],
  );
}

async function insertMembership(transaction: Transaction, membership: CanopyProofMembership) {
  return transaction.query(
    `INSERT INTO organizations.memberships (
      id, organization_id, actor_id, role, status, conflict_disclosure,
      granted_by, granted_at, updated_at, audit_event_root
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)`,
    [
      membership.id,
      membership.organizationId,
      membership.actorId,
      membership.role,
      membership.status,
      membership.conflictDisclosure,
      membership.grantedBy,
      membership.grantedAt,
      membership.auditEvent.eventRoot,
    ],
  );
}

async function insertDataAccessRequest(transaction: Transaction, request: CanopyProofDataAccessRequest) {
  return transaction.query(
    `INSERT INTO organizations.data_access_requests (
      id, organization_id, agreement_id, dataset_scopes, permitted_uses,
      privacy_tier, purpose, status, requested_by, requested_at,
      decision_by, decided_at, decision_rationale, expires_at, request_hash,
      access_root, safety, audit_event_root
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, NULL, NULL, NULL, $10, $11, $12, $13::jsonb, $14)`,
    [
      request.id,
      request.organizationId,
      request.agreementId,
      request.datasetScopes,
      request.permittedUses,
      request.privacyTier,
      request.purpose,
      request.requestedBy,
      request.requestedAt,
      request.expiresAt ?? null,
      request.requestHash,
      request.accessRoot,
      JSON.stringify(request.safety),
      request.auditEvent.eventRoot,
    ],
  );
}

async function insertDataAccessRequestDecision(
  transaction: Transaction,
  decision: CanopyProofDataAccessRequestDecision,
) {
  return transaction.query(
    `INSERT INTO organizations.data_access_request_decisions (
      id, organization_id, request_id, agreement_id, previous_status, status,
      decision_by, decided_at, rationale, decision_hash, decision_root,
      safety, audit_event_root
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
    [
      decision.id,
      decision.organizationId,
      decision.requestId,
      decision.agreementId,
      decision.previousStatus,
      decision.status,
      decision.decisionBy,
      decision.decidedAt,
      decision.rationale,
      decision.decisionHash,
      decision.decisionRoot,
      JSON.stringify(decision.safety),
      decision.auditEvent.eventRoot,
    ],
  );
}

test("CanopyProof PostgreSQL contract loads idempotently and emits independently replayable audit streams", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  try {
    await db.exec(contract);
    await db.exec(contract);

    const authorizationColumns = await db.query<{ readonly column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'identity'
         AND table_name = 'participants'
         AND column_name IN ('owner_id', 'organization_id', 'roles', 'verification_status', 'updated_at')
       ORDER BY column_name`,
    );
    assert.deepEqual(
      authorizationColumns.rows.map((row) => row.column_name),
      ["organization_id", "owner_id", "roles", "updated_at", "verification_status"],
    );

    await actorTransaction(db, "bootstrap_database_authorization", async (transaction) => {
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, roles, verification_status
        ) VALUES ($1, 'human', 'Durable verifier', ARRAY['verifier']::text[], 'verified')`,
        ["cp_identity_durable_verifier"],
      );
      await transaction.query(
        `INSERT INTO organizations.organizations (
          id, organization_type, legal_name, jurisdiction, verification_status,
          trust_level, accreditation_status
        ) VALUES ($1, 'auditor', 'Durable Audit Institute', 'GLOBAL', 'verified', 'institutional', 'approved')`,
        ["cp_organization_durable_auditor"],
      );
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, 'verifier', 'active', 'No disclosed conflict.', $3, now(), now(), $4)`,
        [
          "cp_membership_durable_verifier",
          "cp_organization_durable_auditor",
          "cp_identity_durable_verifier",
          "1".repeat(64),
        ],
      );
      await transaction.query(
        `INSERT INTO organizations.accreditations (
          id, organization_id, status, scope, decided_by, decided_at,
          rationale, evidence_hash, audit_event_root
        ) VALUES ($1, $2, 'approved', ARRAY['environmental_proof_review']::text[], $3, now(), $4, $5, $6)`,
        [
          "cp_accreditation_durable_approved",
          "cp_organization_durable_auditor",
          "cp_identity_durable_verifier",
          "Institutional verification capability reviewed and approved.",
          "2".repeat(64),
          "3".repeat(64),
        ],
      );
    });

    const activeAuthorization = await db.query<AuthorizationBindingRow>(
      "SELECT * FROM identity.resolve_authorization_binding($1, $2, $3)",
      ["cp_identity_durable_verifier", "verifier", "cp_organization_durable_auditor"],
    );
    assert.equal(activeAuthorization.rows.length, 1);
    assert.deepEqual(activeAuthorization.rows[0]?.participant_roles, ["verifier"]);
    assert.equal(activeAuthorization.rows[0]?.participant_verification_status, "verified");
    assert.equal(activeAuthorization.rows[0]?.organization_verification_status, "verified");
    assert.equal(activeAuthorization.rows[0]?.membership_status, "active");
    assert.equal(activeAuthorization.rows[0]?.latest_accreditation_status, "approved");

    await actorTransaction(db, "admin_database_authorization", (transaction) =>
      transaction.query(
        "UPDATE organizations.memberships SET status = 'revoked', updated_at = now() WHERE id = $1",
        ["cp_membership_durable_verifier"],
      ),
    );
    const revokedAuthorization = await db.query<AuthorizationBindingRow>(
      "SELECT * FROM identity.resolve_authorization_binding($1, $2, $3)",
      ["cp_identity_durable_verifier", "verifier", "cp_organization_durable_auditor"],
    );
    assert.equal(revokedAuthorization.rows[0]?.membership_status, "revoked");

    const firstSemanticHistory = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: "cp_identity_durable_verifier",
      entityType: "organization",
      entityId: "cp_organization_semantic_audit",
      payload: { status: "pending" },
      createdAt: "2026-07-10T01:00:00.000Z",
      rationale: "Institutional organization entered the durable trust registry.",
    });
    const secondSemanticHistory = appendCanopyProofAuditEvent(firstSemanticHistory, {
      action: "FULFILL",
      actor: "cp_identity_durable_verifier",
      entityType: "organization_verification",
      entityId: "cp_organization_semantic_audit",
      payload: { status: "verified" },
      createdAt: "2026-07-10T01:01:00.000Z",
      rationale: "Institutional organization verification completed with reviewed evidence.",
    });
    const firstSemanticEvent = firstSemanticHistory[0]!;
    const secondSemanticEvent = secondSemanticHistory[1]!;

    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, "cp_organization_semantic_audit", firstSemanticEvent);
      await insertDomainEvent(transaction, "cp_organization_semantic_audit", secondSemanticEvent);
      await transaction.query(
        `INSERT INTO audit.command_receipts (
          id, actor_id, operation, idempotency_key_hash, request_hash,
          result_entity_type, result_entity_id, response_hash,
          audit_event_root, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          "cp_command_semantic_audit",
          "cp_identity_durable_verifier",
          "organization.verification.update",
          "4".repeat(64),
          "5".repeat(64),
          "organization",
          "cp_organization_semantic_audit",
          "6".repeat(64),
          secondSemanticEvent.eventRoot,
          secondSemanticEvent.createdAt,
        ],
      );
    });
    const semanticRows = await db.query<{ sequence_no: number | bigint; previous_root: string; event_root: string }>(
      "SELECT sequence_no, previous_root, event_root FROM audit.domain_events WHERE stream_id = $1 ORDER BY sequence_no",
      ["cp_organization_semantic_audit"],
    );
    assert.deepEqual(
      semanticRows.rows.map((row) => String(row.sequence_no)),
      ["1", "2"],
    );
    assert.equal(semanticRows.rows[1]?.previous_root, semanticRows.rows[0]?.event_root);

    const internationalSemanticEvent = appendCanopyProofAuditEvent([], {
      action: "REASON",
      actor: "cp_identity_durable_verifier",
      entityType: "organization_verification",
      entityId: "cp_organization_semantic_international",
      payload: { finding: "一致" },
      createdAt: "2026-07-10T01:01:30.000Z",
      rationale: "独立审查确认：\"证据一致\"。\nInstitutional rationale remains hash-stable.",
    })[0]!;
    await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
      insertDomainEvent(transaction, "cp_organization_semantic_international", internationalSemanticEvent),
    );
    const internationalSemanticRows = await db.query<{ event_root: string }>(
      "SELECT event_root FROM audit.domain_events WHERE stream_id = $1",
      ["cp_organization_semantic_international"],
    );
    assert.equal(internationalSemanticRows.rows[0]?.event_root, internationalSemanticEvent.eventRoot);

    const dataGovernance = new CanopyProofPartnerService();
    const dataGovernanceOrganization = dataGovernance.registerOrganization(
      {
        id: "cp_organization_data_governance",
        name: "Durable Data Governance Institute",
        organizationType: "auditor",
        jurisdiction: "GLOBAL",
        publicContact: "governance@example.org",
        operatingRegions: ["global"],
        verificationCapabilities: ["data governance review"],
        registrationNumber: "DURABLE-GOV-001",
        verificationStatus: "verified",
        trustLevel: "verified",
        documents: [
          {
            documentType: "registration",
            documentHash: "9".repeat(64),
            issuedBy: "Durable Test Registry",
            uploadedAt: "2026-07-10T03:00:00.000Z",
          },
        ],
        createdAt: "2026-07-10T03:00:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    const revocableAgreement = dataGovernance.createDataSharingAgreement(
      dataGovernanceOrganization.id,
      {
        datasetScopes: ["proof summaries"],
        privacyTier: "restricted",
        permittedUses: ["institutional review"],
        expiresAt: "2027-07-10T03:00:00.000Z",
        createdAt: "2026-07-10T03:01:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, dataGovernanceOrganization.auditHistory[0]!);
      await insertOrganizationProfile(transaction, dataGovernanceOrganization);
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, revocableAgreement.auditEvent);
      await insertDataSharingAgreement(transaction, revocableAgreement);
    });

    const durableRevocation = dataGovernance.revokeDataSharingAgreement(
      revocableAgreement.id,
      {
        rationale: "Independent governance review withdrew all future access under this agreement.",
        evidenceEventRoots: ["a".repeat(64)],
        revokedAt: "2026-07-10T03:02:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, durableRevocation.auditEvent);
      await insertDataSharingAgreementRevocation(transaction, durableRevocation);
    });

    const predecessorAgreement = dataGovernance.createDataSharingAgreement(
      dataGovernanceOrganization.id,
      {
        datasetScopes: ["method summaries"],
        privacyTier: "restricted",
        permittedUses: ["research review"],
        expiresAt: "2027-07-10T03:00:00.000Z",
        createdAt: "2026-07-10T03:03:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, predecessorAgreement.auditEvent);
      await insertDataSharingAgreement(transaction, predecessorAgreement);
    });

    const durableSupersession = dataGovernance.supersedeDataSharingAgreement(
      predecessorAgreement.id,
      {
        transitionType: "renewal",
        successor: {
          datasetScopes: ["method summaries"],
          privacyTier: "restricted",
          permittedUses: ["research review"],
          expiresAt: "2028-07-10T03:00:00.000Z",
        },
        rationale: "Renew the unchanged least-privilege agreement after independent review.",
        evidenceEventRoots: ["b".repeat(64)],
        supersededAt: "2026-07-10T03:04:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    const successorAgreement = dataGovernance
      .listDataSharingAgreements(dataGovernanceOrganization.id)
      .find((agreement) => agreement.id === durableSupersession.successorAgreementId)!;
    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, successorAgreement.auditEvent);
      await insertDataSharingAgreement(transaction, successorAgreement);
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, durableSupersession.auditEvent);
      await insertDataSharingAgreementSupersession(transaction, durableSupersession);
    });

    const durableAgreementRows = await db.query<{ id: string; revoked: boolean }>(
      "SELECT id, revoked FROM organizations.data_sharing_agreements WHERE organization_id = $1 ORDER BY created_at",
      [dataGovernanceOrganization.id],
    );
    assert.equal(durableAgreementRows.rows.length, 3);
    assert.equal(durableAgreementRows.rows.every((row) => row.revoked === false), true);
    const durableRevocationRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM organizations.data_sharing_agreement_revocations WHERE agreement_id = $1",
      [revocableAgreement.id],
    );
    assert.equal(String(durableRevocationRows.rows[0]?.count), "1");
    const durableSupersessionRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM organizations.data_sharing_agreement_supersessions WHERE predecessor_agreement_id = $1",
      [predecessorAgreement.id],
    );
    assert.equal(String(durableSupersessionRows.rows[0]?.count), "1");

    const dataRequesterId = "cp_identity_data_requester";
    await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
      transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments
        ) VALUES ($1, 'human', 'Durable Data Researcher', $2, ARRAY['researcher']::text[],
          'verified', 50, ARRAY[$3]::text[])`,
        [dataRequesterId, dataGovernanceOrganization.id, "8".repeat(64)],
      ),
    );
    const verifierMembership = dataGovernance.grantMembership(
      dataGovernanceOrganization.id,
      {
        actorId: "cp_identity_durable_verifier",
        role: "verifier",
        conflictDisclosure: "No requester or dataset authorship conflict is present.",
        grantedAt: "2026-07-10T03:05:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    const requesterMembership = dataGovernance.grantMembership(
      dataGovernanceOrganization.id,
      {
        actorId: dataRequesterId,
        role: "researcher",
        conflictDisclosure: "Research access is separated from final data-access approval authority.",
        grantedAt: "2026-07-10T03:06:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, verifierMembership.auditEvent);
      await insertMembership(transaction, verifierMembership);
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, requesterMembership.auditEvent);
      await insertMembership(transaction, requesterMembership);
    });

    const durableRequest = dataGovernance.requestDataAccess(
      dataGovernanceOrganization.id,
      {
        agreementId: successorAgreement.id,
        datasetScopes: ["method summaries"],
        privacyTier: "restricted",
        permittedUses: ["research review"],
        purpose: "Review bounded methodology summaries for independent institutional quality assurance.",
        requestedAt: "2026-07-10T03:07:00.000Z",
        expiresAt: "2027-01-10T03:07:00.000Z",
      },
      dataRequesterId,
    );
    await actorTransaction(db, dataRequesterId, async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, durableRequest.auditEvent);
      await insertDataAccessRequest(transaction, durableRequest);
    });
    const approvedRequest = dataGovernance.decideDataAccessRequest(
      durableRequest.id,
      {
        status: "approved",
        rationale: "Approved by an independent human verifier within the durable agreement boundary.",
        decidedAt: "2026-07-10T03:08:00.000Z",
      },
      "cp_identity_durable_verifier",
    );
    const approvalDecision = dataGovernance
      .listDataAccessRequestDecisions(durableRequest.id)
      .find((decision) => decision.auditEvent.eventRoot === approvedRequest.decisionAuditEvent?.eventRoot)!;
    await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
      await insertDomainEvent(transaction, dataGovernanceOrganization.id, approvalDecision.auditEvent);
      await insertDataAccessRequestDecision(transaction, approvalDecision);
    });

    const requestRows = await db.query<{ status: string; decision_by: string | null }>(
      "SELECT status, decision_by FROM organizations.data_access_requests WHERE id = $1",
      [durableRequest.id],
    );
    assert.deepEqual(requestRows.rows, [{ status: "pending", decision_by: null }]);
    const decisionRows = await db.query<{ previous_status: string; status: string }>(
      "SELECT previous_status, status FROM organizations.data_access_request_decisions WHERE request_id = $1",
      [durableRequest.id],
    );
    assert.deepEqual(decisionRows.rows, [{ previous_status: "pending", status: "approved" }]);

    const selfDecisionEvent = appendCanopyProofAuditEvent(dataGovernance.getOrganization(dataGovernanceOrganization.id).auditHistory, {
      action: "CHALLENGE",
      actor: dataRequesterId,
      entityType: "data_access_request_decision",
      entityId: "cp_data_access_decision_self_probe",
      payload: { requestId: durableRequest.id, previousStatus: "approved", status: "revoked" },
      createdAt: "2026-07-10T03:09:00.000Z",
      rationale: "A requester self-decision probe must be rejected and rolled back atomically.",
    }).at(-1)!;
    let selfDecisionRejected = false;
    try {
      await actorTransaction(db, dataRequesterId, async (transaction) => {
        await insertDomainEvent(transaction, dataGovernanceOrganization.id, selfDecisionEvent);
        await transaction.query(
          `INSERT INTO organizations.data_access_request_decisions (
            id, organization_id, request_id, agreement_id, previous_status, status,
            decision_by, decided_at, rationale, decision_hash, decision_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, 'approved', 'revoked', $5, $6, $7, $8, $9, $10::jsonb, $11)`,
          [
            selfDecisionEvent.entityId,
            dataGovernanceOrganization.id,
            durableRequest.id,
            successorAgreement.id,
            dataRequesterId,
            selfDecisionEvent.createdAt,
            "A requester cannot revoke or approve their own governed data access.",
            "6".repeat(64),
            "7".repeat(64),
            JSON.stringify(approvalDecision.safety),
            selfDecisionEvent.eventRoot,
          ],
        );
      });
    } catch (error) {
      selfDecisionRejected = String(error).includes("independent from the requester");
    }
    assert.equal(selfDecisionRejected, true);
    const selfDecisionEventRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE id = $1",
      [selfDecisionEvent.id],
    );
    assert.equal(String(selfDecisionEventRows.rows[0]?.count), "0");

    let unboundRequestRejected = false;
    try {
      await actorTransaction(db, dataRequesterId, (transaction) =>
        transaction.query(
          `INSERT INTO organizations.data_access_requests (
            id, organization_id, agreement_id, dataset_scopes, permitted_uses,
            privacy_tier, purpose, status, requested_by, requested_at,
            expires_at, request_hash, access_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, ARRAY['method summaries'], ARRAY['research review'],
            'restricted', $4, 'pending', $5, $6, $7, $8, $9, $10::jsonb, $11)`,
          [
            "cp_data_access_missing_event",
            dataGovernanceOrganization.id,
            successorAgreement.id,
            "This request intentionally lacks its exact semantic event binding.",
            dataRequesterId,
            "2026-07-10T03:09:00.000Z",
            "2027-01-10T03:09:00.000Z",
            "4".repeat(64),
            "5".repeat(64),
            JSON.stringify(durableRequest.safety),
            "3".repeat(64),
          ],
        ),
      );
    } catch (error) {
      unboundRequestRejected = String(error).includes("requires an exact semantic event binding");
    }
    assert.equal(unboundRequestRejected, true);

    let missingAgreementEventRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        transaction.query(
          `INSERT INTO organizations.data_sharing_agreements (
            id, organization_id, dataset_scopes, privacy_tier, permitted_uses,
            revoked, expires_at, created_by, created_at, agreement_hash, audit_event_root
          ) VALUES ($1, $2, ARRAY['unbound'], 'restricted', ARRAY['review'], false, NULL, $3, $4, $5, $6)`,
          [
            "cp_agreement_missing_event",
            dataGovernanceOrganization.id,
            "cp_identity_durable_verifier",
            "2026-07-10T03:05:00.000Z",
            "c".repeat(64),
            "d".repeat(64),
          ],
        ),
      );
    } catch (error) {
      missingAgreementEventRejected = String(error).includes("requires an exact semantic event binding");
    }
    assert.equal(missingAgreementEventRejected, true);

    const duplicateRevocationEvent = appendCanopyProofAuditEvent(dataGovernance.getOrganization(dataGovernanceOrganization.id).auditHistory, {
      action: "CHALLENGE",
      actor: "cp_identity_durable_verifier",
      entityType: "data_sharing_agreement_revocation",
      entityId: "cp_agreement_revocation_duplicate",
      payload: { agreementId: revocableAgreement.id },
      createdAt: "2026-07-10T03:10:00.000Z",
      rationale: "Duplicate revocation probe must roll back with its semantic event.",
    }).at(-1)!;
    let duplicateRevocationRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
        await insertDomainEvent(transaction, dataGovernanceOrganization.id, duplicateRevocationEvent);
        await insertDataSharingAgreementRevocation(transaction, {
          ...durableRevocation,
          id: duplicateRevocationEvent.entityId,
          revokedAt: duplicateRevocationEvent.createdAt,
          revocationHash: "e".repeat(64),
          revocationRoot: "f".repeat(64),
          auditEvent: duplicateRevocationEvent,
        });
      });
    } catch (error) {
      duplicateRevocationRejected = String(error).includes("already has a revocation record");
    }
    assert.equal(duplicateRevocationRejected, true);
    const duplicateRevocationEventRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE id = $1",
      [duplicateRevocationEvent.id],
    );
    assert.equal(String(duplicateRevocationEventRows.rows[0]?.count), "0");

    let semanticActorMismatchRejected = false;
    try {
      await actorTransaction(db, "different_database_actor", (transaction) =>
        insertDomainEvent(transaction, "cp_organization_semantic_actor_mismatch", firstSemanticEvent),
      );
    } catch (error) {
      semanticActorMismatchRejected = String(error).includes("matching app.actor_id");
    }
    assert.equal(semanticActorMismatchRejected, true);

    let semanticRootMismatchRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        insertDomainEvent(transaction, "cp_organization_semantic_root_mismatch", {
          ...firstSemanticEvent,
          id: `cp_audit_${"a".repeat(24)}`,
          eventRoot: "a".repeat(64),
        }),
      );
    } catch (error) {
      semanticRootMismatchRejected = String(error).includes("root does not match canonical fields");
    }
    assert.equal(semanticRootMismatchRejected, true);

    let semanticIdMismatchRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        insertDomainEvent(transaction, "cp_organization_semantic_id_mismatch", {
          ...firstSemanticEvent,
          id: "cp_audit_deliberately_wrong",
        }),
      );
    } catch (error) {
      semanticIdMismatchRejected = String(error).includes("id does not match canonical root");
    }
    assert.equal(semanticIdMismatchRejected, true);

    let semanticTimestampPrecisionRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            firstSemanticEvent.id,
            "cp_organization_semantic_submillisecond",
            firstSemanticEvent.action,
            firstSemanticEvent.actor,
            firstSemanticEvent.entityType,
            firstSemanticEvent.entityId,
            firstSemanticEvent.previousRoot,
            firstSemanticEvent.payloadHash,
            firstSemanticEvent.eventRoot,
            "2026-07-10T01:00:00.000001Z",
            firstSemanticEvent.rationale,
          ],
        ),
      );
    } catch (error) {
      semanticTimestampPrecisionRejected = String(error).includes("millisecond precision");
    }
    assert.equal(semanticTimestampPrecisionRejected, true);

    const forgedSemanticHistory = appendCanopyProofAuditEvent([], {
      action: "CHALLENGE",
      actor: "cp_identity_durable_verifier",
      entityType: "organization_verification",
      entityId: "cp_organization_semantic_audit",
      payload: { status: "suspended" },
      createdAt: "2026-07-10T01:02:00.000Z",
      rationale: "This event deliberately carries a stale predecessor for integration testing.",
    });
    let semanticPredecessorRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        insertDomainEvent(transaction, "cp_organization_semantic_audit", forgedSemanticHistory[0]!),
      );
    } catch (error) {
      semanticPredecessorRejected = String(error).includes("predecessor is missing or mismatched");
    }
    assert.equal(semanticPredecessorRejected, true);

    const rollbackHistory = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: "cp_identity_durable_verifier",
      entityType: "identity_reputation_snapshot",
      entityId: "cp_reputation_rollback_probe",
      payload: { score: 101 },
      createdAt: "2026-07-10T01:03:00.000Z",
      rationale: "Rollback probe must disappear when the governed state mutation fails.",
    });
    let governedMutationRolledBack = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", async (transaction) => {
        await insertDomainEvent(transaction, "cp_identity_durable_verifier", rollbackHistory[0]!);
        await transaction.query(
          "UPDATE identity.participants SET reputation_score = 101 WHERE id = 'cp_identity_durable_verifier'",
        );
      });
    } catch (error) {
      governedMutationRolledBack = /check constraint|reputation/i.test(String(error));
    }
    assert.equal(governedMutationRolledBack, true);
    const rolledBackSemanticEvent = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE id = $1",
      [rollbackHistory[0]!.id],
    );
    assert.equal(String(rolledBackSemanticEvent.rows[0]?.count), "0");

    await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
      transaction.query(
        `INSERT INTO identity.reputation_snapshots (
          id, participant_id, previous_score, new_score, source, reason,
          recorded_by, recorded_at, snapshot_hash, audit_event_root
        ) VALUES ($1, $2, 50, 75, 'human_review', $3, $2, $4, $5, $6)`,
        [
          "cp_reputation_durable_snapshot",
          "cp_identity_durable_verifier",
          "Independent human review improved the bounded reputation context.",
          "2026-07-10T01:04:00.000Z",
          "7".repeat(64),
          "8".repeat(64),
        ],
      ),
    );
    let reputationRewriteRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        transaction.query("UPDATE identity.reputation_snapshots SET new_score = 80 WHERE id = $1", [
          "cp_reputation_durable_snapshot",
        ]),
      );
    } catch (error) {
      reputationRewriteRejected = String(error).includes("audit records are append-only");
    }
    assert.equal(reputationRewriteRejected, true);

    let commandReceiptRewriteRejected = false;
    try {
      await actorTransaction(db, "cp_identity_durable_verifier", (transaction) =>
        transaction.query("UPDATE audit.command_receipts SET request_hash = $1 WHERE id = $2", [
          "9".repeat(64),
          "cp_command_semantic_audit",
        ]),
      );
    } catch (error) {
      commandReceiptRewriteRejected = String(error).includes("audit records are append-only");
    }
    assert.equal(commandReceiptRewriteRejected, true);

    let participantDeleteRejected = false;
    try {
      await actorTransaction(db, "admin_database_authorization", (transaction) =>
        transaction.query("DELETE FROM identity.participants WHERE id = $1", ["cp_identity_durable_verifier"]),
      );
    } catch (error) {
      participantDeleteRejected = String(error).includes("audit records are append-only");
    }
    assert.equal(participantDeleteRejected, true);

    let missingActorRejected = false;
    try {
      await db.query(
        "INSERT INTO identity.participants (id, participant_type, display_name) VALUES ('cp_identity_missing_actor', 'human', 'Missing actor')",
      );
    } catch (error) {
      missingActorRejected = String(error).includes("app.actor_id transaction context");
    }
    assert.equal(missingActorRejected, true);

    await db.exec("CREATE TABLE public.canopyproof_audit_probe_without_id (value text NOT NULL)");
    await db.exec(`
      CREATE TRIGGER canopyproof_audit_probe_without_id_capture
      AFTER INSERT OR UPDATE OR DELETE ON public.canopyproof_audit_probe_without_id
      FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation()
    `);
    let missingPrimaryKeyRejected = false;
    try {
      await actorTransaction(db, "admin_database_integration", (transaction) =>
        transaction.query("INSERT INTO public.canopyproof_audit_probe_without_id (value) VALUES ('must fail closed')"),
      );
    } catch (error) {
      missingPrimaryKeyRejected = String(error).includes("non-empty id primary key");
    }
    assert.equal(missingPrimaryKeyRejected, true);

    await actorTransaction(db, "admin_database_integration", (transaction) =>
      transaction.query(
        "INSERT INTO identity.participants (id, participant_type, display_name) VALUES ('cp_identity_database_integration', 'human', 'Database integration')",
      ),
    );
    await actorTransaction(db, "verifier_database_integration", (transaction) =>
      transaction.query(
        "UPDATE identity.participants SET display_name = 'Database integration verified' WHERE id = 'cp_identity_database_integration'",
      ),
    );
    await actorTransaction(db, "admin_database_integration", (transaction) =>
      transaction.query(
        "UPDATE identity.participants SET reputation_score = 10 WHERE id = 'cp_identity_database_integration'",
      ),
    );

    const eventResult = await db.query<DatabaseAuditEventRow>(
      `SELECT *
       FROM audit.event_log
       WHERE stream_key = 'identity.participants:' || encode(digest('cp_identity_database_integration', 'sha256'), 'hex')
       ORDER BY sequence_no`,
    );
    const entries = eventResult.rows.map(databaseEvent);
    const replay = verifyCanopyProofDatabaseAuditStream({ entries, verifiedAt: "2026-07-10T00:00:00.000Z" });

    assert.equal(replay.valid, true);
    assert.deepEqual(entries.map((entry) => entry.sequenceNo), ["1", "2", "3"]);

    const streamKey = entries[0]!.streamKey;
    const checkpointResult = await actorTransaction(db, "auditor_database_integration", (transaction) =>
      transaction.query<DatabaseAuditCheckpointRow>("SELECT * FROM audit.create_event_log_checkpoint($1, $2)", [
        streamKey,
        "auditor_database_integration",
      ]),
    );
    const checkpoint = databaseCheckpoint(checkpointResult.rows[0]!);
    const checkpointReplay = verifyCanopyProofDatabaseAuditStream({
      entries,
      checkpoint,
      verifiedAt: "2026-07-10T00:00:00.000Z",
    });

    assert.equal(checkpointReplay.valid, true);
    assert.equal(checkpointReplay.checkpointValid, true);

    const timestampBoundEvent = buildCanopyProofDatabaseAuditEvent({
      schemaName: "identity",
      tableName: "participants",
      rowPkHash: entries[0]!.rowPkHash,
      sequenceNo: 4,
      action: "UPDATE",
      actorId: "attacker_database_integration",
      recordedAtUnixMicros: String(BigInt(entries[2]!.recordedAtUnixMicros) + 1n),
      previousEventHash: entries[2]!.eventHash,
      beforeStateHash: entries[2]!.afterStateHash,
      afterStateHash: entries[2]!.afterStateHash,
    });
    let inconsistentTimestampRejected = false;
    try {
      await actorTransaction(db, timestampBoundEvent.actorId, (transaction) =>
        transaction.query(
          `INSERT INTO audit.event_log (
            event_version, stream_key, schema_name, table_name, row_pk_hash,
            sequence_no, action, actor_id, recorded_at_unix_micros,
            previous_event_hash, before_state_hash, after_state_hash, event_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, to_timestamp(0))`,
          [
            timestampBoundEvent.eventVersion,
            timestampBoundEvent.streamKey,
            timestampBoundEvent.schemaName,
            timestampBoundEvent.tableName,
            timestampBoundEvent.rowPkHash,
            timestampBoundEvent.sequenceNo,
            timestampBoundEvent.action,
            timestampBoundEvent.actorId,
            timestampBoundEvent.recordedAtUnixMicros,
            timestampBoundEvent.previousEventHash,
            timestampBoundEvent.beforeStateHash,
            timestampBoundEvent.afterStateHash,
            timestampBoundEvent.eventHash,
          ],
        ),
      );
    } catch (error) {
      inconsistentTimestampRejected = /check constraint|recorded_at_unix_micros/i.test(String(error));
    }
    assert.equal(inconsistentTimestampRejected, true);

    let forgedEventRejected = false;
    try {
      await actorTransaction(db, "attacker_database_integration", (transaction) =>
        transaction.query(
          `INSERT INTO audit.event_log (
            event_version, stream_key, schema_name, table_name, row_pk_hash,
            sequence_no, action, actor_id, recorded_at_unix_micros,
            previous_event_hash, before_state_hash, after_state_hash, event_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, 4, 'UPDATE', $6, $7, $8, $9, $10, $11, now())`,
          [
            "canopyproof_db_audit_v2",
            streamKey,
            "identity",
            "participants",
            entries[0]!.rowPkHash,
            "attacker_database_integration",
            String(BigInt(entries[2]!.recordedAtUnixMicros) + 1n),
            entries[2]!.eventHash,
            entries[2]!.afterStateHash,
            entries[2]!.afterStateHash,
            "0".repeat(64),
          ],
        ),
      );
    } catch (error) {
      forgedEventRejected = /check constraint|hash/i.test(String(error));
    }
    assert.equal(forgedEventRejected, true);

    let auditUpdateRejected = false;
    try {
      await actorTransaction(db, "attacker_database_integration", (transaction) =>
        transaction.query("UPDATE audit.event_log SET actor_id = 'attacker_database_integration' WHERE stream_key = $1", [streamKey]),
      );
    } catch (error) {
      auditUpdateRejected = String(error).includes("audit records are append-only");
    }
    assert.equal(auditUpdateRejected, true);

    const rawStateColumns = await db.query<{ readonly column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'audit' AND table_name = 'event_log' AND column_name IN ('before_state', 'after_state')",
    );
    assert.equal(rawStateColumns.rows.length, 0);
  } finally {
    await db.close();
  }
});
