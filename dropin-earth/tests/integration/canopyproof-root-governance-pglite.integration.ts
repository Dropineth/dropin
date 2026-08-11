import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofRootGovernanceAuthorityService,
  canopyProofRootGovernanceScopes,
  normalizeRootGovernanceMember,
  rootGovernanceAttestationSigningBytes,
  type CanopyProofRootGovernanceAttestationFact,
  type CanopyProofRootGovernanceDecisionFact,
  type CanopyProofRootGovernanceMember,
  type CanopyProofRootGovernanceProposalFact,
} from "../../services/api/src/domain/canopyproof/root-governance-authority.js";
import { PrismaCanopyProofRootGovernanceRepository } from "../../services/api/src/domain/canopyproof/root-governance-postgres.js";
import { CanopyProofCanonicalOrganizationAccreditationResolver } from "../../services/api/src/domain/canopyproof/canonical-organization-accreditation-resolver.js";

const baseSql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
const migrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/root-governance-authority.sql"),
  "utf8",
);
const accreditationMigrationSql = readFileSync(
  join(process.cwd(), "services/api/prisma/organization-accreditation-authority.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(process.cwd(), "services/api/prisma/root-governance-authority.rollback.sql"),
  "utf8",
);

type CouncilSigner = Readonly<{
  member: CanopyProofRootGovernanceMember;
  privateKey: CryptoKey;
}>;

test("root governance persists a signed independent quorum with deterministic SQL parity", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(accreditationMigrationSql);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    const council = await buildCouncil("durable");
    await seedCouncil(db, council);
    const fixture = await authorityFixture(council);
    const repository = new PrismaCanopyProofRootGovernanceRepository(pglitePrismaClient(db));

    assert.deepEqual(repository.getStatus(), {
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
    });
    await assertSqlCouncilCurrent(db, fixture.proposal);
    await assertSqlProposalRoots(db, fixture.proposal);
    for (const attestation of fixture.attestations) await assertSqlAttestationRoots(db, attestation);
    await assertSqlDecisionRoots(db, fixture.decision);
    const versions = await db.query<{ greater: boolean; lower: boolean }>(
      `SELECT
         governance.root_governance_semver_is_greater('v1.10.0', 'v1.9.99') AS greater,
         governance.root_governance_semver_is_greater('v1.9.99', 'v1.10.0') AS lower`,
    );
    assert.deepEqual(versions.rows[0], { greater: true, lower: false });

    assert.deepEqual(
      await repository.commitProposal(fixture.proposal, "root-proposal-idempotency"),
      fixture.proposal,
    );
    assert.deepEqual(
      await repository.commitProposal(fixture.proposal, "root-proposal-idempotency"),
      fixture.proposal,
    );
    const conflicting = new CanopyProofRootGovernanceAuthorityService().propose(
      initialProposalInput(council, {
        rationale: "A materially different constitution must not reuse an existing idempotency command identity.",
      }),
      council[0]!.member,
    );
    await assert.rejects(
      repository.commitProposal(conflicting, "root-proposal-idempotency"),
      /IDEMPOTENCY_CONFLICT/,
    );

    for (const [index, attestation] of fixture.attestations.entries()) {
      await repository.commitAttestation(attestation, `root-attestation-${index + 1}`);
    }
    await repository.commitDecision(fixture.decision, "root-decision-idempotency");

    const resolver = new CanopyProofCanonicalOrganizationAccreditationResolver();
    assert.deepEqual(resolver.getStatus(), {
      service: "canopyproof-canonical-organization-accreditation-resolver",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      rootGovernanceBootstrapEnabled: true,
      canonicalAccreditationEnabled: true,
      compatibilityAccreditationFallback: false,
      currentDatabaseStateRequired: true,
      explicitAsOfRequired: true,
    });
    const resolvedRootActor = await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [resolverSubjectOrganizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [council[0]!.member.participantId]);
      return resolver.resolve(
        {
          operation: "review",
          organizationId: resolverSubjectOrganizationId,
          actorId: council[0]!.member.participantId,
          actorOrganizationId: council[0]!.member.organizationId,
          actorRole: council[0]!.member.role,
          profileRoot: resolverSubjectProfileRoot,
          policyRoot,
          requiredScope: canopyProofRootGovernanceScopes[2],
          effectiveAt: "2026-07-20T00:00:00.000Z",
        },
        pgliteTransactionClient(transaction),
      );
    });
    assert.equal(resolvedRootActor.actor.authoritySource, "root_governance_bootstrap");
    assert.equal(resolvedRootActor.actor.accreditationId, fixture.decision.id);
    assert.equal(resolvedRootActor.actor.accreditationDecisionRoot, fixture.decision.decisionRoot);
    assert.equal(resolvedRootActor.policyRoot, policyRoot);
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [resolverSubjectOrganizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [council[0]!.member.participantId]);
        return resolver.resolve(
          {
            operation: "review",
            organizationId: resolverSubjectOrganizationId,
            actorId: council[0]!.member.participantId,
            actorOrganizationId: council[0]!.member.organizationId,
            actorRole: council[0]!.member.role,
            profileRoot: resolverSubjectProfileRoot,
            policyRoot: root("substituted-policy"),
            requiredScope: canopyProofRootGovernanceScopes[2],
            effectiveAt: "2026-07-20T00:00:00.000Z",
          },
          pgliteTransactionClient(transaction),
        );
      }),
      /CANONICAL_AUTHORITY_REQUIRED/,
    );

    const active = await repository.getProjection("2026-07-20T00:00:00.000Z", council[0]!.member.participantId);
    assert.equal(active.status, "active");
    assert.equal(active.policyRoot, policyRoot);
    assert.equal(
      (await repository.getProjection("2027-07-20T00:00:00.000Z", council[0]!.member.participantId)).status,
      "expired",
    );
    assert.deepEqual(
      await repository.getAuthoritySnapshot(council[0]!.member.participantId),
      fixture.snapshot,
    );

    await setRootContext(db, council[0]!.member.participantId);
    assert.equal(await count(db, "governance.root_governance_proposal_facts"), 1);
    assert.equal(await count(db, "governance.root_governance_attestation_facts"), 3);
    assert.equal(await count(db, "governance.root_governance_decision_facts"), 1);
    assert.equal(await count(db, "audit.command_receipts"), 5);
    const events = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM audit.domain_events WHERE stream_id = 'root-governance:organization-accreditation'`,
    );
    assert.equal(events.rows[0]?.count, 5);

    await assert.rejects(
      db.query(
        `UPDATE governance.root_governance_proposal_facts SET policy_root = $2 WHERE id = $1`,
        [fixture.proposal.id, root("tampered-policy")],
      ),
      /append-only|cannot be updated or deleted/i,
    );

    await db.exec("CREATE ROLE canopyproof_root_governance_reader NOLOGIN NOBYPASSRLS");
    await db.exec("GRANT USAGE ON SCHEMA governance TO canopyproof_root_governance_reader");
    await db.exec(
      `GRANT SELECT ON
         governance.root_governance_proposal_facts,
         governance.root_governance_attestation_facts,
         governance.root_governance_decision_facts
       TO canopyproof_root_governance_reader`,
    );
    const hidden = await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.root_governance_access', '', true)");
      await transaction.query("SET LOCAL ROLE canopyproof_root_governance_reader");
      return transaction.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM governance.root_governance_proposal_facts",
      );
    });
    assert.equal(hidden.rows[0]?.count, 0);
    await assert.rejects(
      db.exec(rollbackSql),
      /CANOPYPROOF_ROOT_GOVERNANCE_ROLLBACK_BLOCKED_FACTS_EXIST/,
    );
  } finally {
    await db.close();
  }
});

test("current council membership drift rejects atomically", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    const council = await buildCouncil("drift");
    await seedCouncil(db, council);
    const fixture = await authorityFixture(council);
    const repository = new PrismaCanopyProofRootGovernanceRepository(pglitePrismaClient(db));
    await repository.commitProposal(fixture.proposal, "drift-root-proposal");

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [council[0]!.member.participantId]);
      await transaction.query(
        "UPDATE organizations.memberships SET status = 'suspended', updated_at = $2 WHERE id = $1",
        [council[0]!.member.membershipId, "2026-07-19T00:30:00.000Z"],
      );
    });
    await assert.rejects(
      repository.commitAttestation(fixture.attestations[0]!, "drift-root-attestation"),
      /ATTESTATION_FACT_INVALID|MEMBER/i,
    );
    await setRootContext(db, council[0]!.member.participantId);
    assert.equal(await count(db, "governance.root_governance_attestation_facts"), 0);
    assert.equal(await count(db, "audit.command_receipts"), 1);
    const events = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM audit.domain_events WHERE stream_id = 'root-governance:organization-accreditation'`,
    );
    assert.equal(events.rows[0]?.count, 1);
  } finally {
    await db.close();
  }
});

test("durable succession requires both predecessor and successor council quorums", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    const oldCouncil = await buildCouncil("durable-old");
    const newCouncil = await buildCouncil("durable-new");
    await seedCouncil(db, oldCouncil);
    await seedCouncil(db, newCouncil, false);
    const service = new CanopyProofRootGovernanceAuthorityService();
    const initial = service.propose(initialProposalInput(oldCouncil), oldCouncil[0]!.member);
    const initialApprovals = await attestProposal(service, initial, oldCouncil, [
      "2026-07-19T01:00:00.000Z",
      "2026-07-19T02:00:00.000Z",
      "2026-07-19T03:00:00.000Z",
    ]);
    const initialDecision = service.decide(initial.id, {
      approvalAttestationIds: initialApprovals.map((fact) => fact.id),
      decidedAt: "2026-07-19T04:00:00.000Z",
    });
    const successor = service.propose(
      {
        ...initialProposalInput(newCouncil),
        action: "supersede",
        charterVersion: "v2.0.0",
        predecessorDecisionId: initialDecision.id,
        targetDecisionId: initialDecision.id,
        reasonCode: "scheduled_succession",
        rationale: "The outgoing council proposes a bounded successor charter with independently committed members.",
        proposedAt: "2026-08-01T00:00:00.000Z",
        requestedValidUntil: "2027-07-31T00:00:00.000Z",
      },
      oldCouncil[0]!.member,
    );
    const newApprovals = await attestProposal(service, successor, newCouncil, [
      "2026-08-01T01:00:00.000Z",
      "2026-08-01T02:00:00.000Z",
      "2026-08-01T03:00:00.000Z",
    ]);
    const oldApprovals = await attestProposal(service, successor, oldCouncil, [
      "2026-08-01T04:00:00.000Z",
      "2026-08-01T05:00:00.000Z",
      "2026-08-01T06:00:00.000Z",
    ]);
    const successorDecision = service.decide(successor.id, {
      approvalAttestationIds: [...newApprovals, ...oldApprovals].map((fact) => fact.id),
      decidedAt: "2026-08-01T07:00:00.000Z",
    });
    const repository = new PrismaCanopyProofRootGovernanceRepository(pglitePrismaClient(db));
    const snapshot = service.getAuthoritySnapshot();
    const facts = [
      ...snapshot.proposalFacts,
      ...snapshot.attestationFacts,
      ...snapshot.decisionFacts,
    ].sort((left, right) => left.globalSequence - right.globalSequence);
    for (const fact of facts) {
      const key = `durable-successor-${fact.globalSequence}`;
      if (fact.factType === "root_governance_proposal") await repository.commitProposal(fact, key);
      else if (fact.factType === "root_governance_attestation") await repository.commitAttestation(fact, key);
      else await repository.commitDecision(fact, key);
    }
    const projection = await repository.getProjection("2026-08-02T00:00:00.000Z", newCouncil[0]!.member.participantId);
    assert.equal(projection.status, "active");
    assert.equal(projection.charterVersion, "v2.0.0");
    assert.equal(projection.charterDecisionId, successorDecision.id);
  } finally {
    await db.close();
  }
});

test("empty root governance migration rolls back without touching base governance", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(baseSql);
    await db.exec(migrationSql);
    await db.exec(rollbackSql);
    const removed = await db.query<{ relation_name: string | null }>(
      "SELECT to_regclass('governance.root_governance_proposal_facts')::text AS relation_name",
    );
    assert.equal(removed.rows[0]?.relation_name, null);
    const retained = await db.query<{ relation_name: string | null }>(
      "SELECT to_regclass('governance.proposals')::text AS relation_name",
    );
    assert.equal(retained.rows[0]?.relation_name, "governance.proposals");
  } finally {
    await db.close();
  }
});

async function authorityFixture(council: readonly CouncilSigner[]) {
  const service = new CanopyProofRootGovernanceAuthorityService();
  const proposal = service.propose(initialProposalInput(council), council[0]!.member);
  const attestations = await attestProposal(service, proposal, council, [
    "2026-07-19T01:00:00.000Z",
    "2026-07-19T02:00:00.000Z",
    "2026-07-19T03:00:00.000Z",
  ]);
  const decision = service.decide(proposal.id, {
    approvalAttestationIds: attestations.map((attestation) => attestation.id),
    decidedAt: "2026-07-19T04:00:00.000Z",
  });
  return { proposal, attestations, decision, snapshot: service.getAuthoritySnapshot() };
}

async function attestProposal(
  service: CanopyProofRootGovernanceAuthorityService,
  proposal: CanopyProofRootGovernanceProposalFact,
  council: readonly CouncilSigner[],
  timestamps: readonly string[],
) {
  assert.equal(timestamps.length, council.length);
  const attestations: CanopyProofRootGovernanceAttestationFact[] = [];
  for (const [index, signer] of council.entries()) {
    const attestedAt = timestamps[index]!;
    const signature = await crypto.subtle.sign(
      { name: "Ed25519" },
      signer.privateKey,
      rootGovernanceAttestationSigningBytes({
        proposalRoot: proposal.proposalRoot,
        decision: "approve",
        signerMemberRoot: signer.member.memberRoot,
        attestedAt,
      }),
    );
    attestations.push(
      await service.attest(
        proposal.id,
        {
          decision: "approve",
          rationale: "This independent council member approves the exact committed constitution and policy roots.",
          conflictDisclosure: "No employment, ownership, funding, family, or advisory conflict is known or concealed.",
          attestedAt,
          signatureBase64Url: Buffer.from(signature).toString("base64url"),
        },
        signer.member,
      ),
    );
  }
  return attestations;
}

function initialProposalInput(
  council: readonly CouncilSigner[],
  overrides: Partial<{ rationale: string }> = {},
) {
  return {
    action: "activate_initial" as const,
    charterVersion: "v1.0.0",
    charterDocumentRoot: root("charter-v1"),
    policyRoot,
    delegatedScopes: canopyProofRootGovernanceScopes,
    councilMembers: council.map((signer) => signer.member),
    requiredApprovals: 3,
    requestedValidUntil: "2027-07-19T00:00:00.000Z",
    reasonCode: "initial_constitution" as const,
    rationale:
      overrides.rationale ??
      "Three independent organizations establish a bounded root authority for accreditation governance only.",
    evidenceEventRoots: [root("constitution-evidence")],
    proposedAt: "2026-07-19T00:00:00.000Z",
  };
}

async function buildCouncil(prefix: string): Promise<readonly CouncilSigner[]> {
  const roles = ["owner", "verifier", "researcher"] as const;
  const members: CouncilSigner[] = [];
  for (const [index, role] of roles.entries()) {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const participantId = `root-${prefix}-member-${index + 1}`;
    const organizationId = `root-${prefix}-organization-${index + 1}`;
    const membershipId = `root-${prefix}-membership-${index + 1}`;
    const member = normalizeRootGovernanceMember({
      participantId,
      participantRoot: participantRoot(participantId),
      role,
      verificationStatus: "verified",
      organizationId,
      organizationRoot: organizationRoot(organizationId),
      organizationVerificationStatus: "verified",
      membershipId,
      membershipRoot: membershipRoot(membershipId, organizationId, participantId, role),
      membershipStatus: "active",
      keyId: `root-${prefix}-key-${index + 1}`,
      publicKeyJwk: {
        kty: "OKP",
        crv: "Ed25519",
        x: exported.x,
        key_ops: ["verify"],
        ext: true,
      },
    });
    members.push({ member, privateKey: keyPair.privateKey });
  }
  return members;
}

async function seedCouncil(db: PGlite, council: readonly CouncilSigner[], includeResolverSubject = true) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [council[0]!.member.participantId]);
    for (const { member } of council) {
      await transaction.query(
        `INSERT INTO organizations.organizations (
          id, name, organization_type, legal_name, jurisdiction, operating_regions,
          verification_capabilities, verification_status, trust_level, accreditation_status,
          data_sharing_policy, profile_hash, created_at, updated_at
        ) VALUES ($1, $2, 'research_institution', $2, 'GLOBAL', ARRAY['global']::text[],
          ARRAY['organization_governance']::text[], 'verified', 'institutional', 'approved',
          'restricted', $3, $4, $4)`,
        [member.organizationId, `Root Governance ${member.organizationId}`, member.organizationRoot, "2026-01-01T00:00:00.000Z"],
      );
      await transaction.query(
        `INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES ($1, 'human', $2, $3, ARRAY[$4]::text[], 'verified', 100,
          ARRAY[]::text[], $5, $6, $6)`,
        [member.participantId, `Root Governance ${member.role}`, member.organizationId, member.role, member.participantRoot, "2026-01-01T00:01:00.000Z"],
      );
      await transaction.query(
        `INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES ($1, $2, $3, $4, 'active',
          'No disclosed conflict for this deterministic root-governance fixture.',
          $5, $6, $6, $7)`,
        [member.membershipId, member.organizationId, member.participantId, member.role, council[0]!.member.participantId, "2026-01-01T00:02:00.000Z", member.membershipRoot],
      );
    }
    if (includeResolverSubject) {
      await transaction.query(
        `INSERT INTO organizations.organizations (
          id, name, organization_type, legal_name, jurisdiction, operating_regions,
          verification_capabilities, verification_status, trust_level, accreditation_status,
          data_sharing_policy, profile_hash, created_at, updated_at
        ) VALUES ($1, 'Root Governance Resolver Subject', 'ngo', 'Root Governance Resolver Subject',
          'GLOBAL', ARRAY['global']::text[], ARRAY['restoration']::text[], 'verified',
          'institutional', 'pending', 'restricted', $2, $3, $3)`,
        [resolverSubjectOrganizationId, resolverSubjectProfileRoot, "2026-01-01T00:00:00.000Z"],
      );
    }
  });
}

async function assertSqlProposalRoots(db: PGlite, fact: CanopyProofRootGovernanceProposalFact) {
  const result = await db.query<Record<string, string>>(
    `SELECT
       governance.root_governance_council_root($1::jsonb) AS council_root,
       governance.root_governance_proposal_evidence_root($1::jsonb) AS evidence_root,
       governance.root_governance_proposal_command_hash($1::jsonb) AS command_hash,
       governance.root_governance_proposal_hash($1::jsonb) AS proposal_hash,
       governance.root_governance_proposal_root($1::jsonb) AS proposal_root,
       audit.sha256_stable_json($1::jsonb - 'auditEvent') AS payload_hash`,
    [JSON.stringify(fact)],
  );
  assert.deepEqual(result.rows[0], {
    council_root: fact.councilRoot,
    evidence_root: fact.evidenceRoot,
    command_hash: fact.commandHash,
    proposal_hash: fact.proposalHash,
    proposal_root: fact.proposalRoot,
    payload_hash: fact.auditEvent.payloadHash,
  });
}

async function assertSqlCouncilCurrent(db: PGlite, fact: CanopyProofRootGovernanceProposalFact) {
  for (const member of fact.councilMembers) {
    const current = await db.query<{
      valid: boolean;
      current: boolean;
      member_keys: number;
      jwk_keys: number;
      fingerprint_match: boolean;
      member_root_match: boolean;
      minimized: boolean;
    }>(
      `SELECT
         governance.root_governance_member_is_valid($1::jsonb) AS valid,
         governance.root_governance_member_is_current($1::jsonb) AS current,
         (SELECT count(*)::integer FROM jsonb_object_keys($1::jsonb)) AS member_keys,
         (SELECT count(*)::integer FROM jsonb_object_keys($1::jsonb->'publicKeyJwk')) AS jwk_keys,
         $1::jsonb->>'publicKeyFingerprint' =
           governance.root_governance_public_key_fingerprint($1::jsonb) AS fingerprint_match,
         $1::jsonb->>'memberRoot' = governance.root_governance_member_root($1::jsonb) AS member_root_match,
         governance.root_governance_document_is_minimized($1::jsonb) AS minimized`,
      [JSON.stringify(member)],
    );
    assert.deepEqual(
      current.rows[0],
      {
        valid: true,
        current: true,
        member_keys: 14,
        jwk_keys: 5,
        fingerprint_match: true,
        member_root_match: true,
        minimized: true,
      },
      member.participantId,
    );
  }
  const council = await db.query<{
    council_valid: boolean;
    document_minimized: boolean;
    evidence_valid: boolean;
  }>(
    `SELECT
       governance.root_governance_council_is_valid($1::jsonb, $2) AS council_valid,
       governance.root_governance_document_is_minimized($3::jsonb) AS document_minimized,
       governance.root_governance_roots_are_sorted_unique($4::jsonb) AS evidence_valid`,
    [
      JSON.stringify(fact.councilMembers),
      fact.requiredApprovals,
      JSON.stringify(fact),
      JSON.stringify(fact.evidenceEventRoots),
    ],
  );
  assert.deepEqual(council.rows[0], {
    council_valid: true,
    document_minimized: true,
    evidence_valid: true,
  });
}

async function assertSqlAttestationRoots(db: PGlite, fact: CanopyProofRootGovernanceAttestationFact) {
  const result = await db.query<Record<string, string>>(
    `SELECT
       governance.root_governance_signed_payload_root($1::jsonb) AS signed_payload_root,
       governance.root_governance_signature_hash($1::jsonb) AS signature_hash,
       governance.root_governance_verification_receipt_root($1::jsonb) AS receipt_root,
       governance.root_governance_attestation_command_hash($1::jsonb) AS command_hash,
       governance.root_governance_attestation_hash($1::jsonb) AS attestation_hash,
       governance.root_governance_attestation_root($1::jsonb) AS attestation_root,
       audit.sha256_stable_json($1::jsonb - 'auditEvent') AS payload_hash`,
    [JSON.stringify(fact)],
  );
  assert.deepEqual(result.rows[0], {
    signed_payload_root: fact.signedPayloadRoot,
    signature_hash: fact.signatureHash,
    receipt_root: fact.verificationReceiptRoot,
    command_hash: fact.commandHash,
    attestation_hash: fact.attestationHash,
    attestation_root: fact.attestationRoot,
    payload_hash: fact.auditEvent.payloadHash,
  });
}

async function assertSqlDecisionRoots(db: PGlite, fact: CanopyProofRootGovernanceDecisionFact) {
  const result = await db.query<Record<string, string>>(
    `SELECT
       governance.root_governance_decision_command_hash($1::jsonb) AS command_hash,
       governance.root_governance_decision_hash($1::jsonb) AS decision_hash,
       governance.root_governance_decision_root($1::jsonb) AS decision_root,
       audit.sha256_stable_json($1::jsonb - 'auditEvent') AS payload_hash`,
    [JSON.stringify(fact)],
  );
  assert.deepEqual(result.rows[0], {
    command_hash: fact.commandHash,
    decision_hash: fact.decisionHash,
    decision_root: fact.decisionRoot,
    payload_hash: fact.auditEvent.payloadHash,
  });
}

const policyRoot = root("root-governance-policy-v1");
const resolverSubjectOrganizationId = "root-governance-resolver-subject";
const resolverSubjectProfileRoot = root("root-governance-resolver-subject-profile");

function participantRoot(participantId: string) {
  return hashJson({ kind: "root-governance-pglite-participant", participantId });
}

function organizationRoot(organizationId: string) {
  return hashJson({ kind: "root-governance-pglite-organization", organizationId });
}

function membershipRoot(membershipId: string, organizationId: string, participantId: string, role: string) {
  return hashJson({
    kind: "root-governance-pglite-membership",
    membershipId,
    organizationId,
    participantId,
    role,
  });
}

function root(label: string) {
  return hashJson({ kind: "root-governance-pglite-root", label });
}

async function setRootContext(db: PGlite, actorId: string) {
  await db.query("SELECT set_config('app.actor_id', $1, false)", [actorId]);
  await db.query("SELECT set_config('app.root_governance_access', 'authorized', false)");
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
