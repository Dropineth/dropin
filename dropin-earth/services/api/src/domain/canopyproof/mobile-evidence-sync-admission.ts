import { hashJson } from "@dropin/crypto";
import { z } from "zod";

export const canopyProofMobileEvidenceSyncAdmissionCommands = [
  "binding",
  "batch",
  "recovery",
] as const;

export type CanopyProofMobileEvidenceSyncAdmissionCommand =
  (typeof canopyProofMobileEvidenceSyncAdmissionCommands)[number];

export const CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION =
  "canopyproof.mobile-sync-admission/v1" as const;
export const CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_SECONDS = 60;

const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value, "Timestamp must be canonical millisecond UTC.");
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export type CanopyProofMobileEvidenceSyncAdmissionPolicy = Readonly<{
  policyVersion: typeof CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION;
  command: CanopyProofMobileEvidenceSyncAdmissionCommand;
  actorLimit: number;
  organizationLimit: number;
  maximumBodyBytes: number;
  windowSeconds: typeof CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_SECONDS;
}>;

const policies = Object.freeze({
  binding: Object.freeze({
    policyVersion: CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION,
    command: "binding",
    actorLimit: 30,
    organizationLimit: 300,
    maximumBodyBytes: 16 * 1024,
    windowSeconds: CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_SECONDS,
  }),
  batch: Object.freeze({
    policyVersion: CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION,
    command: "batch",
    actorLimit: 12,
    organizationLimit: 120,
    maximumBodyBytes: 256 * 1024,
    windowSeconds: CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_SECONDS,
  }),
  recovery: Object.freeze({
    policyVersion: CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION,
    command: "recovery",
    actorLimit: 30,
    organizationLimit: 300,
    maximumBodyBytes: 4 * 1024,
    windowSeconds: CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_SECONDS,
  }),
} satisfies Readonly<Record<CanopyProofMobileEvidenceSyncAdmissionCommand, CanopyProofMobileEvidenceSyncAdmissionPolicy>>);

export type CanopyProofMobileEvidenceSyncAdmissionInput = Readonly<{
  organizationId: string;
  actorId: string;
  command: CanopyProofMobileEvidenceSyncAdmissionCommand;
  evaluatedAt: string;
}>;

export const canopyProofMobileEvidenceSyncAdmissionInputSchema = z
  .object({
    organizationId: identifierSchema,
    actorId: identifierSchema,
    command: z.enum(canopyProofMobileEvidenceSyncAdmissionCommands),
    evaluatedAt: canonicalTimestampSchema,
  })
  .strict();

export const canopyProofMobileEvidenceSyncAdmissionDenialReasons = [
  "actor_limit_exceeded",
  "organization_limit_exceeded",
  "actor_and_organization_limits_exceeded",
] as const;

export type CanopyProofMobileEvidenceSyncAdmissionDenialReason =
  (typeof canopyProofMobileEvidenceSyncAdmissionDenialReasons)[number];

export type CanopyProofMobileEvidenceSyncAdmissionDecision = Readonly<{
  allowed: boolean;
  policyVersion: typeof CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION;
  command: CanopyProofMobileEvidenceSyncAdmissionCommand;
  limit: number;
  remaining: number;
  resetAt: string;
  abuseEventRoot?: string | undefined;
}>;

export const canopyProofMobileEvidenceSyncAdmissionDecisionSchema = z
  .object({
    allowed: z.boolean(),
    policyVersion: z.literal(CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION),
    command: z.enum(canopyProofMobileEvidenceSyncAdmissionCommands),
    limit: z.number().int().positive(),
    remaining: z.number().int().nonnegative(),
    resetAt: canonicalTimestampSchema,
    abuseEventRoot: hashSchema.optional(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.remaining > decision.limit) {
      context.addIssue({ code: "custom", path: ["remaining"], message: "Remaining cannot exceed limit." });
    }
    if (
      (decision.allowed && decision.abuseEventRoot !== undefined) ||
      (!decision.allowed && decision.abuseEventRoot === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["abuseEventRoot"],
        message: "Only denied admission decisions require an abuse event root.",
      });
    }
  });

export interface CanopyProofMobileEvidenceSyncAdmissionAuthority {
  consume(
    input: CanopyProofMobileEvidenceSyncAdmissionInput,
  ): Promise<CanopyProofMobileEvidenceSyncAdmissionDecision>;
}

export type CanopyProofMobileEvidenceSyncAdmissionWindow = Readonly<{
  windowStartedAt: string;
  resetAt: string;
}>;

export type CanopyProofMobileEvidenceSyncAdmissionDenialFact = Readonly<{
  id: string;
  organizationId: string;
  actorId: string;
  command: CanopyProofMobileEvidenceSyncAdmissionCommand;
  policyVersion: typeof CANOPYPROOF_MOBILE_SYNC_ADMISSION_POLICY_VERSION;
  windowStartedAt: string;
  resetAt: string;
  actorLimit: number;
  organizationLimit: number;
  actorCount: string;
  organizationCount: string;
  reason: CanopyProofMobileEvidenceSyncAdmissionDenialReason;
  createdAt: string;
  denialRoot: string;
}>;

export function canopyProofMobileEvidenceSyncAdmissionPolicy(
  command: CanopyProofMobileEvidenceSyncAdmissionCommand,
): CanopyProofMobileEvidenceSyncAdmissionPolicy {
  return policies[command];
}

export function canopyProofMobileEvidenceSyncAdmissionWindow(
  evaluatedAt: string,
): CanopyProofMobileEvidenceSyncAdmissionWindow {
  const timestamp = canonicalTimestampSchema.parse(evaluatedAt);
  const evaluatedMs = Date.parse(timestamp);
  const windowMs = CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_SECONDS * 1_000;
  const windowStartedMs = Math.floor(evaluatedMs / windowMs) * windowMs;
  return {
    windowStartedAt: new Date(windowStartedMs).toISOString(),
    resetAt: new Date(windowStartedMs + windowMs).toISOString(),
  };
}

export function canopyProofMobileEvidenceSyncAdmissionDenialReason(input: Readonly<{
  actorCount: bigint;
  organizationCount: bigint;
  policy: CanopyProofMobileEvidenceSyncAdmissionPolicy;
}>): CanopyProofMobileEvidenceSyncAdmissionDenialReason | undefined {
  const actorExceeded = input.actorCount > BigInt(input.policy.actorLimit);
  const organizationExceeded = input.organizationCount > BigInt(input.policy.organizationLimit);
  if (actorExceeded && organizationExceeded) return "actor_and_organization_limits_exceeded";
  if (actorExceeded) return "actor_limit_exceeded";
  if (organizationExceeded) return "organization_limit_exceeded";
  return undefined;
}

export function buildCanopyProofMobileEvidenceSyncAdmissionDenialFact(input: Readonly<{
  organizationId: string;
  actorId: string;
  command: CanopyProofMobileEvidenceSyncAdmissionCommand;
  windowStartedAt: string;
  resetAt: string;
  actorCount: bigint;
  organizationCount: bigint;
  reason: CanopyProofMobileEvidenceSyncAdmissionDenialReason;
  createdAt: string;
}>): CanopyProofMobileEvidenceSyncAdmissionDenialFact {
  const parsed = canopyProofMobileEvidenceSyncAdmissionInputSchema.parse({
    organizationId: input.organizationId,
    actorId: input.actorId,
    command: input.command,
    evaluatedAt: input.createdAt,
  });
  const policy = canopyProofMobileEvidenceSyncAdmissionPolicy(parsed.command);
  const windowStartedAt = canonicalTimestampSchema.parse(input.windowStartedAt);
  const resetAt = canonicalTimestampSchema.parse(input.resetAt);
  if (Date.parse(resetAt) - Date.parse(windowStartedAt) !== policy.windowSeconds * 1_000) {
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_INVALID");
  }
  if (Date.parse(parsed.evaluatedAt) < Date.parse(windowStartedAt) || Date.parse(parsed.evaluatedAt) >= Date.parse(resetAt)) {
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_WINDOW_INVALID");
  }
  const expectedReason = canopyProofMobileEvidenceSyncAdmissionDenialReason({
    actorCount: input.actorCount,
    organizationCount: input.organizationCount,
    policy,
  });
  if (!expectedReason || expectedReason !== input.reason) {
    throw new Error("CANOPYPROOF_MOBILE_SYNC_ADMISSION_REASON_INVALID");
  }
  const seed = {
    kind: "canopyproof-mobile-sync-admission-denial-v1",
    organizationId: parsed.organizationId,
    actorId: parsed.actorId,
    command: parsed.command,
    policyVersion: policy.policyVersion,
    windowStartedAt,
    resetAt,
    actorLimit: policy.actorLimit,
    organizationLimit: policy.organizationLimit,
    actorCount: input.actorCount.toString(),
    organizationCount: input.organizationCount.toString(),
    reason: input.reason,
    createdAt: parsed.evaluatedAt,
  } as const;
  const denialRoot = hashJson(seed);
  return {
    id: `cp_mobile_sync_denial_${denialRoot.slice(0, 24)}`,
    ...seed,
    denialRoot,
  };
}
