import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  buildCanopyProofMobileEvidenceSyncAdmissionDenialFact,
  canopyProofMobileEvidenceSyncAdmissionDecisionSchema,
  canopyProofMobileEvidenceSyncAdmissionDenialReason,
  canopyProofMobileEvidenceSyncAdmissionInputSchema,
  canopyProofMobileEvidenceSyncAdmissionPolicy,
  canopyProofMobileEvidenceSyncAdmissionWindow,
  type CanopyProofMobileEvidenceSyncAdmissionAuthority,
  type CanopyProofMobileEvidenceSyncAdmissionDecision,
  type CanopyProofMobileEvidenceSyncAdmissionInput,
  type CanopyProofMobileEvidenceSyncAdmissionPolicy,
} from "./mobile-evidence-sync-admission.js";
import { acquireCanopyProofPostgresTransactionLock } from "./postgres-advisory-lock.js";

type AdmissionTransaction = Prisma.TransactionClient;

const bucketRowSchema = z.object({
  policy_version: z.literal("canopyproof.mobile-sync-admission/v1"),
  limit_count: z.coerce.bigint().positive(),
  request_count: z.coerce.bigint().positive(),
  window_started_at: z.coerce.date(),
  reset_at: z.coerce.date(),
});

const denialRowSchema = z.object({ denial_root: z.string().regex(/^[a-f0-9]{64}$/) });

export type CanopyProofMobileEvidenceSyncAdmissionRepositoryStatus = Readonly<{
  service: "canopyproof-mobile-evidence-sync-admission";
  storage: "postgresql";
  routeMounted: true;
  serializableCounters: true;
  tenantScoped: true;
  deniedAttemptsAppendOnly: true;
  rawRequestDataStored: false;
}>;

export class PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority
implements CanopyProofMobileEvidenceSyncAdmissionAuthority {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofMobileEvidenceSyncAdmissionRepositoryStatus {
    return {
      service: "canopyproof-mobile-evidence-sync-admission",
      storage: "postgresql",
      routeMounted: true,
      serializableCounters: true,
      tenantScoped: true,
      deniedAttemptsAppendOnly: true,
      rawRequestDataStored: false,
    };
  }

  async consume(
    inputValue: CanopyProofMobileEvidenceSyncAdmissionInput,
  ): Promise<CanopyProofMobileEvidenceSyncAdmissionDecision> {
    const input = canopyProofMobileEvidenceSyncAdmissionInputSchema.parse(inputValue);
    const policy = canopyProofMobileEvidenceSyncAdmissionPolicy(input.command);
    const window = canopyProofMobileEvidenceSyncAdmissionWindow(input.evaluatedAt);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, input.organizationId, input.actorId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              admissionLockKey("organization", input.organizationId, input.command, window.windowStartedAt),
            );
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              admissionLockKey("actor", input.actorId, input.command, window.windowStartedAt),
            );

            const organizationBucket = await incrementBucket(transaction, {
              organizationId: input.organizationId,
              scopeType: "organization",
              scopeId: input.organizationId,
              policy,
              windowStartedAt: window.windowStartedAt,
              resetAt: window.resetAt,
              evaluatedAt: input.evaluatedAt,
              limit: policy.organizationLimit,
            });
            const actorBucket = await incrementBucket(transaction, {
              organizationId: input.organizationId,
              scopeType: "actor",
              scopeId: input.actorId,
              policy,
              windowStartedAt: window.windowStartedAt,
              resetAt: window.resetAt,
              evaluatedAt: input.evaluatedAt,
              limit: policy.actorLimit,
            });
            const reason = canopyProofMobileEvidenceSyncAdmissionDenialReason({
              actorCount: actorBucket.request_count,
              organizationCount: organizationBucket.request_count,
              policy,
            });
            const limit = Math.min(policy.actorLimit, policy.organizationLimit);
            const remaining = Number(
              bigintMin(
                nonnegativeRemaining(policy.actorLimit, actorBucket.request_count),
                nonnegativeRemaining(policy.organizationLimit, organizationBucket.request_count),
              ),
            );
            if (!reason) {
              return canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse({
                allowed: true,
                policyVersion: policy.policyVersion,
                command: policy.command,
                limit,
                remaining,
                resetAt: window.resetAt,
              });
            }

            const fact = buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({
              organizationId: input.organizationId,
              actorId: input.actorId,
              command: input.command,
              windowStartedAt: window.windowStartedAt,
              resetAt: window.resetAt,
              actorCount: actorBucket.request_count,
              organizationCount: organizationBucket.request_count,
              reason,
              createdAt: input.evaluatedAt,
            });
            const insertedRoot = await insertDenialFact(transaction, fact);
            if (insertedRoot !== fact.denialRoot) {
              throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_ROOT_MISMATCH");
            }
            return canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse({
              allowed: false,
              policyVersion: policy.policyVersion,
              command: policy.command,
              limit,
              remaining,
              resetAt: window.resetAt,
              abuseEventRoot: fact.denialRoot,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE");
  }
}

type IncrementBucketInput = Readonly<{
  organizationId: string;
  scopeType: "actor" | "organization";
  scopeId: string;
  policy: CanopyProofMobileEvidenceSyncAdmissionPolicy;
  windowStartedAt: string;
  resetAt: string;
  evaluatedAt: string;
  limit: number;
}>;

async function incrementBucket(transaction: AdmissionTransaction, input: IncrementBucketInput) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    INSERT INTO audit.mobile_sync_admission_buckets (
      organization_id, scope_type, scope_id, command_type, policy_version,
      window_started_at, reset_at, limit_count, request_count, updated_at
    ) VALUES (
      ${input.organizationId}, ${input.scopeType}, ${input.scopeId}, ${input.policy.command},
      ${input.policy.policyVersion}, ${asDate(input.windowStartedAt)}, ${asDate(input.resetAt)},
      ${input.limit}, 1, ${asDate(input.evaluatedAt)}
    )
    ON CONFLICT (organization_id, scope_type, scope_id, command_type, window_started_at)
    DO UPDATE SET
      request_count = audit.mobile_sync_admission_buckets.request_count + 1,
      updated_at = EXCLUDED.updated_at
    WHERE audit.mobile_sync_admission_buckets.policy_version = EXCLUDED.policy_version
      AND audit.mobile_sync_admission_buckets.reset_at = EXCLUDED.reset_at
      AND audit.mobile_sync_admission_buckets.limit_count = EXCLUDED.limit_count
    RETURNING policy_version, limit_count, request_count, window_started_at, reset_at
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_CONFLICT");
  }
  const row = bucketRowSchema.parse(rows[0]);
  if (
    row.policy_version !== input.policy.policyVersion ||
    row.limit_count !== BigInt(input.limit) ||
    row.window_started_at.toISOString() !== input.windowStartedAt ||
    row.reset_at.toISOString() !== input.resetAt
  ) {
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_CONFLICT");
  }
  return row;
}

async function insertDenialFact(
  transaction: AdmissionTransaction,
  fact: ReturnType<typeof buildCanopyProofMobileEvidenceSyncAdmissionDenialFact>,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    INSERT INTO audit.mobile_sync_admission_denial_facts (
      id, organization_id, actor_id, command_type, policy_version,
      window_started_at, reset_at, actor_limit, organization_limit,
      actor_count, organization_count, denial_reason, created_at, denial_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.actorId}, ${fact.command}, ${fact.policyVersion},
      ${asDate(fact.windowStartedAt)}, ${asDate(fact.resetAt)}, ${fact.actorLimit},
      ${fact.organizationLimit}, ${BigInt(fact.actorCount)}, ${BigInt(fact.organizationCount)},
      ${fact.reason}, ${asDate(fact.createdAt)}, ${fact.denialRoot}
    )
    RETURNING denial_root
  `);
  if (rows.length !== 1) throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_DENIAL_WRITE_INVALID");
  return denialRowSchema.parse(rows[0]).denial_root;
}

async function setContext(transaction: AdmissionTransaction, organizationId: string, actorId: string) {
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
}

function admissionLockKey(
  scopeType: "actor" | "organization",
  scopeId: string,
  command: string,
  windowStartedAt: string,
) {
  return `mobile-sync-admission:${scopeType}:${scopeId}:${command}:${windowStartedAt}`;
}

function nonnegativeRemaining(limit: number, count: bigint) {
  const remaining = BigInt(limit) - count;
  return remaining > 0n ? remaining : 0n;
}

function bigintMin(left: bigint, right: bigint) {
  return left < right ? left : right;
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_TIMESTAMP_INVALID");
  }
  return date;
}

function isRetryable(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const databaseCode = prismaDatabaseCode(error);
  return error.code === "P2034" ||
    databaseCode === "40001" ||
    databaseCode === "40P01" ||
    databaseCode === "23505";
}

function prismaDatabaseCode(error: Prisma.PrismaClientKnownRequestError) {
  if (!error.meta || typeof error.meta !== "object") return undefined;
  const code = Reflect.get(error.meta, "code");
  return typeof code === "string" ? code : undefined;
}
