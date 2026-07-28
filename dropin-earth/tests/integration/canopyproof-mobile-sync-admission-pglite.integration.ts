import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import {
  buildCanopyProofMobileEvidenceSyncAdmissionDenialFact,
} from "../../services/api/src/domain/canopyproof/mobile-evidence-sync-admission.js";

const prismaDirectory = join(process.cwd(), "services/api/prisma");

test("mobile sync admission SQL preserves root parity, append-only denial facts, and tenant isolation", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await apply(db, "canopyproof-os.sql");
    await apply(db, "mobile-sync-admission.sql");
    await apply(db, "mobile-sync-admission.sql");

    const organizationId = "cp_mobile_admission_org_a";
    const otherOrganizationId = "cp_mobile_admission_org_b";
    const actorId = "cp_mobile_admission_actor";
    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await transaction.query(
        `INSERT INTO identity.participants (
           id, participant_type, display_name, roles, verification_status,
           reputation_score, credential_commitments, created_at, updated_at
         ) VALUES ($1, 'human', 'Admission Test Actor', ARRAY['community']::text[],
           'verified', 50, ARRAY[]::text[], $2::timestamptz, $2::timestamptz)`,
        [actorId, "2026-07-17T03:00:00.000Z"],
      );
      for (const id of [organizationId, otherOrganizationId]) {
        await transaction.query(
          `INSERT INTO organizations.organizations (
             id, organization_type, legal_name, jurisdiction, verification_status,
             trust_level, accreditation_status, data_sharing_policy
           ) VALUES ($1, 'ngo', $1, 'GLOBAL', 'verified', 'verified', 'approved', 'restricted')`,
          [id],
        );
      }
    });

    const fact = buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({
      organizationId,
      actorId,
      command: "binding",
      windowStartedAt: "2026-07-17T03:00:00.000Z",
      resetAt: "2026-07-17T03:01:00.000Z",
      actorCount: 31n,
      organizationCount: 31n,
      reason: "actor_limit_exceeded",
      createdAt: "2026-07-17T03:00:30.000Z",
    });
    const sqlRoot = await db.query<{ root: string }>(
      `SELECT audit.mobile_sync_admission_denial_root(
         $1, $2, $3, $4, $5::timestamptz, $6::timestamptz,
         $7, $8, $9::bigint, $10::bigint, $11, $12::timestamptz
       ) AS root`,
      [
        fact.organizationId,
        fact.actorId,
        fact.command,
        fact.policyVersion,
        fact.windowStartedAt,
        fact.resetAt,
        fact.actorLimit,
        fact.organizationLimit,
        fact.actorCount,
        fact.organizationCount,
        fact.reason,
        fact.createdAt,
      ],
    );
    assert.equal(sqlRoot.rows[0]?.root, fact.denialRoot);

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      await transaction.query(
        `INSERT INTO audit.mobile_sync_admission_buckets (
           organization_id, scope_type, scope_id, command_type, policy_version,
           window_started_at, reset_at, limit_count, request_count, updated_at
         ) VALUES
           ($1, 'organization', $1, 'binding', $2, $3, $4, 300, 31, $5),
           ($1, 'actor', $6, 'binding', $2, $3, $4, 30, 31, $5)`,
        [organizationId, fact.policyVersion, fact.windowStartedAt, fact.resetAt, fact.createdAt, actorId],
      );
      await insertFact(transaction, fact);
    });

    for (const statement of [
      "UPDATE audit.mobile_sync_admission_denial_facts SET denial_reason = denial_reason WHERE id = $1",
      "DELETE FROM audit.mobile_sync_admission_denial_facts WHERE id = $1",
    ]) {
      await assert.rejects(
        db.transaction(async (transaction) => {
          await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
          await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
          await transaction.query(statement, [fact.id]);
        }),
        /CANOPYPROOF_MOBILE_SYNC_ADMISSION_APPEND_ONLY_VIOLATION/,
      );
    }
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await insertFact(transaction, { ...fact, id: "cp_mobile_sync_denial_" + "f".repeat(24), denialRoot: "f".repeat(64) });
      }),
    );

    await db.exec("CREATE ROLE canopyproof_mobile_admission_reader NOLOGIN NOBYPASSRLS");
    await db.exec("GRANT USAGE ON SCHEMA audit TO canopyproof_mobile_admission_reader");
    await db.exec(
      "GRANT SELECT ON audit.mobile_sync_admission_buckets, audit.mobile_sync_admission_denial_facts TO canopyproof_mobile_admission_reader",
    );
    const crossTenant = await db.transaction(async (transaction) => {
      await transaction.query("SET LOCAL ROLE canopyproof_mobile_admission_reader");
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [otherOrganizationId]);
      return transaction.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM audit.mobile_sync_admission_denial_facts",
      );
    });
    assert.equal(crossTenant.rows[0]?.count, 0);

    await assert.rejects(apply(db, "mobile-sync-admission.rollback.sql"), /ROLLBACK_BLOCKED/);
  } finally {
    await db.close();
  }
});

test("mobile sync admission rollback removes an unused contract", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await apply(db, "canopyproof-os.sql");
    await apply(db, "mobile-sync-admission.sql");
    await apply(db, "mobile-sync-admission.rollback.sql");
    const result = await db.query<{ denial_table: string | null; bucket_table: string | null }>(
      `SELECT
         to_regclass('audit.mobile_sync_admission_denial_facts')::text AS denial_table,
         to_regclass('audit.mobile_sync_admission_buckets')::text AS bucket_table`,
    );
    assert.deepEqual(result.rows[0], { denial_table: null, bucket_table: null });
  } finally {
    await db.close();
  }
});

async function apply(db: PGlite, filename: string) {
  await db.exec(await readFile(join(prismaDirectory, filename), "utf8"));
}

type PGliteTransaction = Parameters<Parameters<PGlite["transaction"]>[0]>[0];

async function insertFact(
  transaction: PGliteTransaction,
  fact: ReturnType<typeof buildCanopyProofMobileEvidenceSyncAdmissionDenialFact>,
) {
  await transaction.query(
    `INSERT INTO audit.mobile_sync_admission_denial_facts (
       id, organization_id, actor_id, command_type, policy_version,
       window_started_at, reset_at, actor_limit, organization_limit,
       actor_count, organization_count, denial_reason, created_at, denial_root
     ) VALUES (
       $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9,
       $10::bigint, $11::bigint, $12, $13::timestamptz, $14
     )`,
    [
      fact.id,
      fact.organizationId,
      fact.actorId,
      fact.command,
      fact.policyVersion,
      fact.windowStartedAt,
      fact.resetAt,
      fact.actorLimit,
      fact.organizationLimit,
      fact.actorCount,
      fact.organizationCount,
      fact.reason,
      fact.createdAt,
      fact.denialRoot,
    ],
  );
}
