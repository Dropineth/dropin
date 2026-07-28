import { Prisma } from "@prisma/client";

export type CanopyProofPostgresAdvisoryLockMode = "exclusive" | "shared";

export type CanopyProofPostgresAdvisoryLockTransaction = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

type AdvisoryLockRow = {
  readonly lock_token: string;
};

export async function acquireCanopyProofPostgresTransactionLock(
  transaction: CanopyProofPostgresAdvisoryLockTransaction,
  key: string,
  mode: CanopyProofPostgresAdvisoryLockMode = "exclusive",
) {
  if (!key.trim()) {
    throw new Error("CanopyProof PostgreSQL advisory lock requires a non-empty key.");
  }

  if (mode === "shared") {
    await transaction.$queryRaw<AdvisoryLockRow[]>(Prisma.sql`
      SELECT pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))::text AS lock_token
    `);
    return;
  }

  await transaction.$queryRaw<AdvisoryLockRow[]>(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS lock_token
  `);
}

export function isCanopyProofPostgresRetryableWriteConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly meta?: Readonly<{ code?: unknown; message?: unknown }>;
  };
  const codes = [candidate.code, candidate.meta?.code].filter(
    (value): value is string => typeof value === "string",
  );
  if (codes.some((code) => ["P2002", "P2034", "23505", "40001", "40P01"].includes(code))) {
    return true;
  }
  const messages = [candidate.message, candidate.meta?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /serialization|deadlock|duplicate key|unique constraint|\b(?:23505|40001|40P01)\b/i.test(messages);
}
