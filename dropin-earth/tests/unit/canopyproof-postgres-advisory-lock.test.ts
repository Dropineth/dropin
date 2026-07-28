import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
  type CanopyProofPostgresAdvisoryLockTransaction,
} from "../../services/api/src/domain/canopyproof/postgres-advisory-lock.js";

test("CanopyProof PostgreSQL advisory locks expose only a Prisma-readable scalar", async () => {
  const statements: Prisma.Sql[] = [];
  const transaction: CanopyProofPostgresAdvisoryLockTransaction = {
    async $queryRaw<T>(query: Prisma.Sql) {
      statements.push(query);
      return [] as T;
    },
  };

  await acquireCanopyProofPostgresTransactionLock(transaction, "canopyproof:exclusive");
  await acquireCanopyProofPostgresTransactionLock(transaction, "canopyproof:shared", "shared");

  assert.equal(statements.length, 2);
  assert.match(statements[0]!.sql, /pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)::text AS lock_token/);
  assert.deepEqual(statements[0]!.values, ["canopyproof:exclusive"]);
  assert.match(
    statements[1]!.sql,
    /pg_advisory_xact_lock_shared\(hashtextextended\(\?, 0\)\)::text AS lock_token/,
  );
  assert.deepEqual(statements[1]!.values, ["canopyproof:shared"]);

  await assert.rejects(
    acquireCanopyProofPostgresTransactionLock(transaction, "  "),
    /requires a non-empty key/,
  );
});

test("CanopyProof PostgreSQL retry classification unwraps Prisma and native concurrency conflicts", () => {
  assert.equal(isCanopyProofPostgresRetryableWriteConflict({ code: "P2034" }), true);
  assert.equal(
    isCanopyProofPostgresRetryableWriteConflict({
      code: "P2010",
      meta: { code: "23505", message: "duplicate key value violates unique constraint" },
    }),
    true,
  );
  assert.equal(isCanopyProofPostgresRetryableWriteConflict({ code: "40001" }), true);
  assert.equal(isCanopyProofPostgresRetryableWriteConflict({ code: "40P01" }), true);
  assert.equal(isCanopyProofPostgresRetryableWriteConflict({ code: "P2025" }), false);
  assert.equal(isCanopyProofPostgresRetryableWriteConflict(new Error("validation rejected")), false);
});
