import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

test("CanopyProof evidence custody facts remain immutable, replayable, and transactionally bound", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const ownerId = "cp_evidence_custody_owner";
  const subjectId = "cp_evidence_custody_community";
  const substituteId = "cp_evidence_custody_substitute";
  const organizationId = "cp_evidence_custody_org";

  try {
    await db.exec(contract);
    await db.exec(contract);
    await insertBootstrapOwner(db, ownerId);
    const service = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));

    const status = service.getStatus();
    assert.equal(status.evidenceConsentReceiptWritesDurable, true);
    assert.equal(status.evidenceConsentRevocationWritesDurable, true);
    assert.equal(status.evidenceDeviceAttestationWritesDurable, true);

    const organization = await service.registerOrganization(
      {
        id: organizationId,
        name: "Evidence Custody Field Cooperative",
        organizationType: "community_organization",
        jurisdiction: "GLOBAL",
        publicContact: "custody@example.org",
        operatingRegions: ["global"],
        verificationCapabilities: ["field evidence collection"],
        documents: [],
        authorizedUsers: [ownerId],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-12T01:00:00.000Z",
      },
      ownerId,
      "custody-org-create",
    );
    await service.updateOrganizationVerification(
      organization.id,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "EVIDENCE-CUSTODY-001",
        documents: [
          {
            documentType: "registration",
            documentHash: "1".repeat(64),
            issuedBy: "Evidence Custody Test Registry",
            uploadedAt: "2026-07-12T01:01:00.000Z",
          },
        ],
        authorizedUsers: [ownerId, subjectId, substituteId],
        rationale: "Verified solely for deterministic evidence custody integration testing.",
        reviewedAt: "2026-07-12T01:01:00.000Z",
      },
      ownerId,
      "custody-org-verify",
    );
    await service.registerParticipant(
      {
        id: subjectId,
        participantType: "human",
        displayName: "Evidence Custody Community Member",
        organizationId,
        roles: ["community"],
        verificationStatus: "verified",
        credentialCommitments: ["2".repeat(64)],
        createdAt: "2026-07-12T01:02:00.000Z",
      },
      ownerId,
      "custody-subject-register",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: subjectId,
        role: "community",
        conflictDisclosure: "The field contributor acts only for their own consent and device facts.",
        grantedAt: "2026-07-12T01:03:00.000Z",
      },
      ownerId,
      "custody-subject-membership",
    );
    await service.registerParticipant(
      {
        id: substituteId,
        participantType: "human",
        displayName: "Evidence Custody Substitute Member",
        organizationId,
        roles: ["community"],
        verificationStatus: "verified",
        credentialCommitments: ["8".repeat(64)],
        createdAt: "2026-07-12T01:03:10.000Z",
      },
      ownerId,
      "custody-substitute-register",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: substituteId,
        role: "community",
        conflictDisclosure: "The substitute member has no authority to act for another evidence subject.",
        grantedAt: "2026-07-12T01:03:20.000Z",
      },
      ownerId,
      "custody-substitute-membership",
    );

    const fingerprintHash = "3".repeat(64);
    const consentInput = {
      subjectId,
      deviceFingerprintHash: fingerprintHash,
      purposes: ["media_upload", "evidence_collection", "geolocation"],
      lawfulBasis: "consent",
      privacyMode: "restricted",
      policyVersion: "evidence-collection-consent-v1",
      evidenceHash: "4".repeat(64),
      grantedAt: "2026-07-12T01:04:00.000Z",
      expiresAt: "2027-07-12T01:04:00.000Z",
      retentionDays: 365,
    } as const;
    const receipt = await service.recordEvidenceConsentReceipt(
      consentInput,
      organizationId,
      subjectId,
      "community",
      "custody-consent-record",
    );
    const replayedReceipt = await service.recordEvidenceConsentReceipt(
      consentInput,
      organizationId,
      subjectId,
      "community",
      "custody-consent-record",
    );
    assert.deepEqual(replayedReceipt, receipt);
    assert.deepEqual(receipt.purposes, ["evidence_collection", "geolocation", "media_upload"]);

    await assert.rejects(
      service.recordEvidenceConsentReceipt(
        { ...consentInput, retentionDays: 180 },
        organizationId,
        subjectId,
        "community",
        "custody-consent-record",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError && error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
    );
    await assert.rejects(
      service.recordEvidenceConsentReceipt(
        { ...consentInput, grantedAt: "2026-07-12T01:04:30.000Z" },
        organizationId,
        substituteId,
        "community",
        "custody-subject-substitution",
      ),
      /requires the verified human subject to act for itself/,
    );

    const deviceInput = {
      subjectId,
      consentReceiptId: receipt.id,
      deviceFingerprintHash: fingerprintHash,
      attestationType: "secure_enclave",
      provider: "apple_app_attest",
      providerKeyId: "apple-app-attest-key-2026-07",
      providerReceiptHash: "5".repeat(64),
      providerVerificationState: "modeled_only",
      publicKeyHash: "6".repeat(64),
      attestationHash: "7".repeat(64),
      issuedAt: "2026-07-12T01:05:00.000Z",
      expiresAt: "2027-01-12T01:05:00.000Z",
      reputationScore: 80,
      riskFlags: [],
    } as const;
    await assert.rejects(
      service.recordEvidenceDeviceAttestation(
        { ...deviceInput, providerVerificationState: "verified" },
        organizationId,
        subjectId,
        "community",
        "custody-device-self-verified",
      ),
      /trusted provider adapter verifies the receipt/,
    );
    const attestation = await service.recordEvidenceDeviceAttestation(
      deviceInput,
      organizationId,
      subjectId,
      "community",
      "custody-device-record",
    );
    assert.equal(attestation.auditEvent.action, "CHALLENGE");
    assert.equal(
      (await service.getEvidenceConsentProjection(receipt.id, organizationId, "2026-07-12T01:05:30.000Z")).state,
      "active",
    );
    assert.equal(
      (
        await service.getEvidenceDeviceAttestationProjection(
          attestation.id,
          organizationId,
          "2026-07-12T01:05:30.000Z",
        )
      ).state,
      "needs_review",
    );

    const revocation = await service.revokeEvidenceConsentReceipt(
      receipt.id,
      {
        reason: "The contributor withdrew permission for all future evidence collection.",
        revokedAt: "2026-07-12T01:06:00.000Z",
      },
      organizationId,
      subjectId,
      "community",
      "custody-consent-revoke",
    );
    assert.equal(
      (await service.getEvidenceConsentProjection(receipt.id, organizationId, "2026-07-12T01:06:30.000Z")).state,
      "revoked",
    );
    assert.equal(
      (
        await service.getEvidenceDeviceAttestationProjection(
          attestation.id,
          organizationId,
          "2026-07-12T01:06:30.000Z",
        )
      ).state,
      "consent_revoked",
    );

    const parity = await db.query<{
      receipt_command: boolean;
      receipt_hash: boolean;
      receipt_root: boolean;
      revocation_command: boolean;
      revocation_hash: boolean;
      revocation_root: boolean;
      device_command: boolean;
      device_hash: boolean;
      device_root: boolean;
    }>(
      `SELECT
         receipt.command_hash = evidence.consent_receipt_command_hash(receipt) AS receipt_command,
         receipt.receipt_hash = evidence.consent_receipt_hash(receipt) AS receipt_hash,
         receipt.receipt_root = evidence.consent_receipt_root(receipt) AS receipt_root,
         revocation.command_hash = evidence.consent_revocation_command_hash(revocation) AS revocation_command,
         revocation.revocation_hash = evidence.consent_revocation_hash(revocation) AS revocation_hash,
         revocation.revocation_root = evidence.consent_revocation_root(revocation) AS revocation_root,
         device.command_hash = evidence.device_attestation_command_hash(device) AS device_command,
         device.device_hash = evidence.device_attestation_hash(device) AS device_hash,
         device.attestation_root = evidence.device_attestation_root(device) AS device_root
       FROM evidence.consent_receipts receipt
       JOIN evidence.consent_revocations revocation ON revocation.receipt_id = receipt.id
       JOIN identity.device_attestations device ON device.consent_receipt_id = receipt.id
       WHERE receipt.id = $1`,
      [receipt.id],
    );
    assert.deepEqual(parity.rows, [
      {
        receipt_command: true,
        receipt_hash: true,
        receipt_root: true,
        revocation_command: true,
        revocation_hash: true,
        revocation_root: true,
        device_command: true,
        device_hash: true,
        device_root: true,
      },
    ]);

    const counts = await db.query<{ receipts: number; revocations: number; devices: number; events: number }>(
      `SELECT
         (SELECT count(*)::int FROM evidence.consent_receipts WHERE subject_id = $1) AS receipts,
         (SELECT count(*)::int FROM evidence.consent_revocations WHERE subject_id = $1) AS revocations,
         (SELECT count(*)::int FROM identity.device_attestations WHERE subject_id = $1) AS devices,
         (SELECT count(*)::int FROM audit.domain_events WHERE stream_id = 'evidence-custody:' || $1) AS events`,
      [subjectId],
    );
    assert.deepEqual(counts.rows, [{ receipts: 1, revocations: 1, devices: 1, events: 3 }]);

    await assertAppendOnly(db, subjectId, "UPDATE evidence.consent_receipts SET policy_version = policy_version WHERE id = $1", receipt.id);
    await assertAppendOnly(db, subjectId, "DELETE FROM evidence.consent_revocations WHERE id = $1", revocation.id);
    await assertAppendOnly(db, subjectId, "UPDATE identity.device_attestations SET reputation_score = reputation_score WHERE id = $1", attestation.id);

    const restarted = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(await restarted.getEvidenceConsentReceipt(receipt.id, organizationId), receipt);
    assert.deepEqual(await restarted.getEvidenceConsentRevocation(revocation.id, organizationId), revocation);
    assert.deepEqual(await restarted.getEvidenceDeviceAttestation(attestation.id, organizationId), attestation);
    assert.equal(
      (await restarted.getEvidenceConsentProjection(receipt.id, organizationId, "2026-07-12T01:07:00.000Z")).state,
      "revoked",
    );

    await assertTriggerCatalog(db, "evidence.consent_receipts", [
      "consent_receipts_audit",
      "evidence_consent_receipts_no_delete",
      "evidence_consent_receipts_no_update",
      "evidence_consent_receipts_validate",
    ]);
    await assertTriggerCatalog(db, "evidence.consent_revocations", [
      "consent_revocations_audit",
      "evidence_consent_revocations_no_delete",
      "evidence_consent_revocations_no_update",
      "evidence_consent_revocations_validate",
    ]);
    await assertTriggerCatalog(db, "identity.device_attestations", [
      "identity_device_attestations_audit",
      "identity_device_attestations_no_delete",
      "identity_device_attestations_no_update",
      "identity_device_attestations_validate",
    ]);
  } finally {
    await db.close();
  }
});

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

async function insertBootstrapOwner(db: PGlite, actorId: string) {
  const createdAt = "2026-07-12T00:59:00.000Z";
  const subjectHash = hashJson({ kind: "canopyproof-evidence-custody-bootstrap-v1", actorId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["owner"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "PGlite evidence custody owner provisioned through an explicit bootstrap transaction.",
  })[0]!;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES ($1, 'human', 'Evidence Custody Owner', $1, ARRAY['owner']::text[],
        'verified', 100, ARRAY[]::text[], $2, $3, $3)`,
      [actorId, subjectHash, createdAt],
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

async function assertAppendOnly(db: PGlite, actorId: string, statement: string, id: string) {
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await transaction.query(statement, [id]);
    }),
    /append-only/,
  );
}

async function assertTriggerCatalog(db: PGlite, relation: string, expected: readonly string[]) {
  const rows = await db.query<{ tgname: string }>(
    `SELECT tgname
     FROM pg_trigger
     WHERE tgrelid = $1::regclass
       AND NOT tgisinternal
     ORDER BY tgname`,
    [relation],
  );
  assert.deepEqual(rows.rows.map((row) => row.tgname), expected);
}
