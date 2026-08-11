import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  verifyCanopyProofGlobalCommandCenterSnapshot,
  type CanopyProofGlobalCommandCenterSnapshot,
} from "./global-command-center.js";

export const canopyProofGlobalCommandCenterErrorCodes = [
  "CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE",
  "CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID",
] as const;

export type CanopyProofGlobalCommandCenterErrorCode =
  (typeof canopyProofGlobalCommandCenterErrorCodes)[number];

export class CanopyProofGlobalCommandCenterError extends Error {
  readonly httpStatus = 503 as const;

  constructor(
    readonly code: CanopyProofGlobalCommandCenterErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "CanopyProofGlobalCommandCenterError";
  }
}

export type CanopyProofGlobalCommandCenterRepositoryStatus = {
  readonly service: "canopyproof-global-command-center-repository";
  readonly storage: "postgresql";
  readonly readOnly: true;
  readonly appendOnlySnapshots: true;
  readonly writerMounted: false;
  readonly processLocalFallbackAllowed: false;
  readonly rootReplayRequired: true;
};

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const snapshotRowSchema = z
  .object({
    generated_at_value: z.coerce.date(),
    metric_summary: z.unknown(),
    regional_summaries: z.unknown(),
    impact_indicators: z.unknown(),
    recent_activity: z.unknown(),
    lineage: z.unknown(),
    safety_boundary: z.unknown(),
    dashboard_root: hashSchema,
  })
  .strict();

export class PrismaCanopyProofGlobalCommandCenterRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofGlobalCommandCenterRepositoryStatus {
    return {
      service: "canopyproof-global-command-center-repository",
      storage: "postgresql",
      readOnly: true,
      appendOnlySnapshots: true,
      writerMounted: false,
      processLocalFallbackAllowed: false,
      rootReplayRequired: true,
    };
  }

  async getLatestSnapshot(): Promise<CanopyProofGlobalCommandCenterSnapshot> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT generated_at AS generated_at_value, metric_summary, regional_summaries,
            impact_indicators, recent_activity, lineage, safety_boundary, dashboard_root
          FROM impact.global_command_center_snapshots
          ORDER BY generated_at DESC, id DESC
          LIMIT 1
        `);
        if (rows.length === 0) {
          throw new CanopyProofGlobalCommandCenterError(
            "CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE",
          );
        }
        if (rows.length !== 1) {
          throw sourceInvalid();
        }
        const row = snapshotRowSchema.parse(rows[0]);
        const snapshot = verifyCanopyProofGlobalCommandCenterSnapshot({
          service: "canopyproof-global-impact-command-center",
          generatedAt: row.generated_at_value.toISOString(),
          metrics: row.metric_summary,
          regions: row.regional_summaries,
          impactIndicators: row.impact_indicators,
          recentActivity: row.recent_activity,
          lineage: row.lineage,
          safety: row.safety_boundary,
        });
        if (snapshot.lineage.dashboardRoot !== row.dashboard_root) {
          throw sourceInvalid();
        }
        return snapshot;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    } catch (error) {
      if (error instanceof CanopyProofGlobalCommandCenterError) throw error;
      throw sourceInvalid(error);
    }
  }
}

function sourceInvalid(cause?: unknown) {
  return new CanopyProofGlobalCommandCenterError(
    "CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID",
    cause === undefined ? undefined : { cause },
  );
}
