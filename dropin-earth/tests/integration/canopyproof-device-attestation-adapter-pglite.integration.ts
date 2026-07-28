import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  canopyProofDeviceAttestationReceiptSeed,
  PolicyEnforcedCanopyProofDeviceAttestationAdapter,
  WebCryptoEd25519DeviceAttestationSignatureVerifier,
  type CanopyProofDeviceAttestationProviderReceipt,
  type CanopyProofDeviceAttestationProviderRequest,
} from "../../services/api/src/domain/canopyproof/device-attestation-adapter.js";
import { PrismaCanopyProofDeviceAttestationAdapterRepository } from
  "../../services/api/src/domain/canopyproof/evidence-device-attestation-adapter-postgres.js";
import { CanopyProofDeviceAttestationAdapterOrchestrator } from
  "../../services/api/src/domain/canopyproof/evidence-device-attestation-adapter-orchestrator.js";
import { appendCanopyProofAuditEvent } from
  "../../services/api/src/domain/canopyproof/proof-engine.js";
import { PrismaCanopyProofTrustRegistryService } from
  "../../services/api/src/domain/canopyproof/trust-registry.js";

const ownerId = "cp_e1a_pglite_owner";
const subjectId = "cp_e1a_pglite_subject";
const agentId = "cp_e1a_pglite_agent";
const organizationId = "cp_e1a_pglite_org";
const verifiedAt = "2026-07-18T09:00:00.000Z";
const verificationExpiresAt = "2026-07-19T09:00:00.000Z";
const signerKeyId = "cp-e1a-pglite-signer-v1";

test("E1a PostgreSQL authority is append-only, RLS-bound, root-parity checked, and restart-safe", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await apply(db, "canopyproof-os.sql");
    await apply(db, "canopyproof-os.sql");
    await apply(db, "evidence-device-attestation-adapters.sql");
    await apply(db, "evidence-device-attestation-adapters.sql");
    await insertBootstrapOwner(db, ownerId);
    const prisma = pglitePrismaClient(db);
    const trust = new PrismaCanopyProofTrustRegistryService(prisma);
    await provisionAuthority(db, trust);

    const fingerprintHash = hashJson({ kind: "cp-e1a-pglite-device-fingerprint" });
    const consent = await trust.recordEvidenceConsentReceipt(
      {
        subjectId,
        deviceFingerprintHash: fingerprintHash,
        purposes: ["media_upload", "evidence_collection"],
        lawfulBasis: "consent",
        privacyMode: "restricted",
        policyVersion: "cp-e1a-pglite-consent-v1",
        evidenceHash: hashJson({ kind: "cp-e1a-pglite-consent-evidence" }),
        grantedAt: "2026-07-01T00:00:00.000Z",
        expiresAt: "2027-07-01T00:00:00.000Z",
        retentionDays: 365,
      },
      organizationId,
      subjectId,
      "community",
      "cp-e1a-pglite-consent-create",
    );
    const device = await trust.recordEvidenceDeviceAttestation(
      {
        subjectId,
        consentReceiptId: consent.id,
        deviceFingerprintHash: fingerprintHash,
        attestationType: "secure_enclave",
        provider: "apple_app_attest",
        providerKeyId: "cp-e1a-pglite-apple-key-v1",
        providerReceiptHash: hashJson({ kind: "cp-e1a-pglite-provider-receipt" }),
        providerVerificationState: "modeled_only",
        publicKeyHash: hashJson({ kind: "cp-e1a-pglite-public-key" }),
        attestationHash: hashJson({ kind: "cp-e1a-pglite-attestation" }),
        issuedAt: "2026-07-01T00:01:00.000Z",
        expiresAt: "2027-01-01T00:01:00.000Z",
        reputationScore: 92,
        riskFlags: [],
      },
      organizationId,
      subjectId,
      "community",
      "cp-e1a-pglite-device-create",
    );
    assert.equal(device.providerVerificationState, "modeled_only");

    const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const policy = {
      provider: "apple_app_attest" as const,
      attestationType: "secure_enclave" as const,
      verifierId: "cp-e1a-pglite-apple-verifier",
      verifierVersion: "1.0.0",
      providerPolicyRoot: hashJson({ kind: "cp-e1a-pglite-provider-policy" }),
      allowedSignerKeyIds: [signerKeyId],
      maximumVerificationLifetimeSeconds: 86_400,
    };
    let externalCalls = 0;
    let rawSignature = "";
    const adapter = new PolicyEnforcedCanopyProofDeviceAttestationAdapter(
      policy,
      {
        async verifyAttestation(request) {
          externalCalls += 1;
          const receipt = await signReceipt(request, policy, keyPair.privateKey);
          rawSignature = receipt.signature;
          return receipt;
        },
      },
      new WebCryptoEd25519DeviceAttestationSignatureVerifier({ [signerKeyId]: publicKey }),
    );
    const repository = new PrismaCanopyProofDeviceAttestationAdapterRepository(prisma);
    const orchestrator = new CanopyProofDeviceAttestationAdapterOrchestrator(repository, adapter);
    assert.deepEqual(orchestrator.getStatus(), {
      service: "canopyproof-device-attestation-adapter-orchestrator",
      routeMounted: false,
      productionActivated: false,
      externalCallsInsideDatabaseTransaction: false,
      challengeCommitmentOnly: true,
      durableOnlineNonceStoreImplemented: false,
      rawSignaturePersisted: false,
      baseAttestationMutated: false,
      finalProofAuthority: false,
    });

    const command = {
      organizationId,
      attestationId: device.id,
      verifierAgentId: agentId,
      idempotencyKey: "cp-e1a-pglite-command-0001",
      requestedAt: verifiedAt,
    } as const;
    const first = await orchestrator.verifyAttestation(command);
    assert.equal(first.projection.state, "current");
    assert.deepEqual(first.projection.issueCodes, []);
    assert.equal(first.verification.attestationRoot, device.attestationRoot);
    assert.equal(JSON.stringify(first.verification).includes(rawSignature), false);
    assert.equal(externalCalls, 1);

    const restarted = new CanopyProofDeviceAttestationAdapterOrchestrator(
      new PrismaCanopyProofDeviceAttestationAdapterRepository(prisma),
      adapter,
    );
    const replay = await restarted.verifyAttestation(command);
    assert.deepEqual(replay, first);
    assert.equal(externalCalls, 1);

    const renewed = await restarted.verifyAttestation({
      ...command,
      idempotencyKey: "cp-e1a-pglite-command-0002",
      requestedAt: "2026-07-18T10:00:00.000Z",
    });
    assert.notEqual(renewed.verification.id, first.verification.id);
    assert.equal(renewed.verification.attestationSequence, 2);
    assert.equal(renewed.projection.state, "current");
    assert.equal(externalCalls, 2);
    const renewedReplay = await restarted.verifyAttestation({
      ...command,
      idempotencyKey: "cp-e1a-pglite-command-0002",
      requestedAt: "2026-07-18T10:00:00.000Z",
    });
    assert.deepEqual(renewedReplay, renewed);
    assert.equal(externalCalls, 2);

    const baseRows = await db.query<{ provider_verification_state: string }>(
      "SELECT provider_verification_state FROM identity.device_attestations WHERE id = $1",
      [device.id],
    );
    assert.equal(baseRows.rows[0]?.provider_verification_state, "modeled_only");
    const rootRows = await db.query<{
      adapter_root: string;
      verification_root: string;
      command_hash: string;
      fact_root: string;
    }>(
      `SELECT
         evidence.e1a_adapter_verification_root(fact) AS adapter_root,
         evidence.e1a_verification_root(fact) AS verification_root,
         evidence.e1a_command_hash(fact) AS command_hash,
         evidence.e1a_fact_root(fact) AS fact_root
       FROM identity.device_attestation_verification_facts fact
       WHERE id = $1`,
      [first.verification.id],
    );
    assert.deepEqual(rootRows.rows[0], {
      adapter_root: first.verification.adapterVerificationRoot,
      verification_root: first.verification.verificationRoot,
      command_hash: first.verification.commandHash,
      fact_root: first.verification.factRoot,
    });

    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [agentId]);
        await transaction.query(
          "UPDATE identity.device_attestation_verification_facts SET result = 'rejected' WHERE id = $1",
          [first.verification.id],
        );
      }),
      /audit records are append-only|event logs are append-only|cannot be updated or deleted/i,
    );

    await db.exec("CREATE ROLE canopyproof_e1a_reader NOLOGIN NOBYPASSRLS");
    await db.exec("GRANT USAGE ON SCHEMA identity TO canopyproof_e1a_reader");
    await db.exec("GRANT SELECT ON identity.device_attestation_verification_facts TO canopyproof_e1a_reader");
    const crossTenant = await db.transaction(async (transaction) => {
      await transaction.query("SET LOCAL ROLE canopyproof_e1a_reader");
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", ["cp_other_org"]);
      return transaction.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM identity.device_attestation_verification_facts",
      );
    });
    assert.equal(crossTenant.rows[0]?.count, 0);

    await assert.rejects(
      apply(db, "evidence-device-attestation-adapters.rollback.sql"),
      /CANOPYPROOF_E1A_ROLLBACK_REFUSED/,
    );
  } finally {
    await db.close();
  }
});

test("E1a rollback removes only an unused authority", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await apply(db, "canopyproof-os.sql");
    await apply(db, "evidence-device-attestation-adapters.sql");
    await apply(db, "evidence-device-attestation-adapters.rollback.sql");
    const result = await db.query<{ table_name: string | null }>(
      "SELECT to_regclass('identity.device_attestation_verification_facts')::text AS table_name",
    );
    assert.equal(result.rows[0]?.table_name, null);
  } finally {
    await db.close();
  }
});

async function provisionAuthority(db: PGlite, trust: PrismaCanopyProofTrustRegistryService) {
  const organization = await trust.registerOrganization(
    {
      id: organizationId,
      name: "PGlite Device Attestation Cooperative",
      organizationType: "community_organization",
      jurisdiction: "GLOBAL",
      publicContact: "device-attestation@example.org",
      operatingRegions: ["global"],
      verificationCapabilities: ["field evidence collection"],
      documents: [],
      authorizedUsers: [ownerId],
      verificationStatus: "pending",
      trustLevel: "unverified",
      dataSharingPolicy: "restricted",
      createdAt: "2026-07-17T00:01:00.000Z",
    },
    ownerId,
    "cp-e1a-org-create",
  );
  await trust.updateOrganizationVerification(
    organization.id,
    {
      verificationStatus: "verified",
      trustLevel: "verified",
      registrationNumber: "E1A-PGLITE-001",
      documents: [{
        documentType: "registration",
        documentHash: hashJson({ kind: "cp-e1a-org-document" }),
        issuedBy: "E1a Test Registry",
        uploadedAt: "2026-07-17T00:02:00.000Z",
      }],
      authorizedUsers: [ownerId, subjectId, agentId],
      rationale: "Verified solely for deterministic E1a contract testing.",
      reviewedAt: "2026-07-17T00:02:00.000Z",
    },
    ownerId,
    "cp-e1a-org-verify",
  );
  await trust.registerParticipant(
    {
      id: subjectId,
      participantType: "human",
      displayName: "PGlite Device Subject",
      organizationId,
      roles: ["community"],
      verificationStatus: "verified",
      credentialCommitments: [hashJson({ kind: "cp-e1a-subject-credential" })],
      createdAt: "2026-07-17T00:03:00.000Z",
    },
    ownerId,
    "cp-e1a-subject-create",
  );
  await trust.registerParticipant(
    {
      id: agentId,
      participantType: "agent",
      displayName: "PGlite Device Receipt Verifier",
      organizationId,
      roles: ["agent"],
      verificationStatus: "verified",
      credentialCommitments: [hashJson({ kind: "cp-e1a-agent-credential" })],
      createdAt: "2026-07-17T00:04:00.000Z",
    },
    ownerId,
    "cp-e1a-agent-create",
  );
  await trust.grantMembership(
    organizationId,
    {
      actorId: ownerId,
      role: "owner",
      conflictDisclosure: "The bootstrap owner cannot submit the subject device attestation.",
      grantedAt: "2026-07-17T00:05:00.000Z",
    },
    ownerId,
    "cp-e1a-owner-membership",
  );
  await trust.grantMembership(
    organizationId,
    {
      actorId: subjectId,
      role: "community",
      conflictDisclosure: "The subject controls only their consent-bound modeled device fact.",
      grantedAt: "2026-07-17T00:06:00.000Z",
    },
    ownerId,
    "cp-e1a-subject-membership",
  );
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [ownerId]);
    await transaction.query(
      `INSERT INTO identity.agent_profiles (
        id, agent_type, layer, capabilities, allowed_actions,
        human_review_required, final_authority, status, registry_hash
      ) VALUES ($1, 'evidence', 'Evidence', ARRAY['device_attestation_receipt']::text[],
        ARRAY['verify_device_attestation_receipt']::text[], true, false, 'active', $2)`,
      [agentId, hashJson({ kind: "cp-e1a-agent-registry", agentId })],
    );
  });
}

async function signReceipt(
  request: CanopyProofDeviceAttestationProviderRequest,
  policy: Readonly<{
    verifierId: string;
    verifierVersion: string;
    providerPolicyRoot: string;
  }>,
  privateKey: CryptoKey,
): Promise<CanopyProofDeviceAttestationProviderReceipt> {
  const base = {
    attestationId: request.attestationId,
    attestationRoot: request.attestationRoot,
    organizationId: request.organizationId,
    subjectId: request.subjectId,
    subjectRoot: request.subjectRoot,
    consentReceiptId: request.consentReceiptId,
    consentReceiptRoot: request.consentReceiptRoot,
    deviceFingerprintHash: request.deviceFingerprintHash,
    attestationType: request.attestationType,
    provider: request.provider,
    providerKeyId: request.providerKeyId,
    providerReceiptHash: request.providerReceiptHash,
    publicKeyHash: request.publicKeyHash,
    attestationHash: request.attestationHash,
    challengeHash: request.challengeHash,
    verifierId: policy.verifierId,
    verifierVersion: policy.verifierVersion,
    providerPolicyRoot: policy.providerPolicyRoot,
    result: "verified" as const,
    reasonCodes: [] as readonly string[],
    verifiedAt: request.requestedAt,
    expiresAt: verificationExpiresAt,
    signerKeyId,
    signatureAlgorithm: "ed25519" as const,
  };
  const receiptHash = hashJson({
    kind: "canopyproof-device-attestation-provider-receipt-v1",
    ...canopyProofDeviceAttestationReceiptSeed(base),
  });
  const signature = Buffer.from(await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(receiptHash),
  )).toString("base64url");
  return { ...base, signature, receiptHash };
}

async function apply(db: PGlite, file: string) {
  await db.exec(await readFile(join(process.cwd(), "services/api/prisma", file), "utf8"));
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

async function insertBootstrapOwner(db: PGlite, actorId: string) {
  const createdAt = "2026-07-17T00:00:00.000Z";
  const subjectHash = hashJson({ kind: "cp-e1a-bootstrap", actorId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["owner"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "PGlite E1a owner provisioned through an explicit bootstrap transaction.",
  })[0]!;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES ($1, 'human', 'E1a Owner', $1, ARRAY['owner']::text[],
        'verified', 100, ARRAY[]::text[], $2, $3, $3)`,
      [actorId, subjectHash, createdAt],
    );
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
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
