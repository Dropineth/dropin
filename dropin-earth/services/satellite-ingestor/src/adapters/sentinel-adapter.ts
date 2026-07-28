import {
  baselineSnapshotInputSchema,
  type BaselineSnapshot,
  type BaselineSnapshotInput,
} from "@dropin/schemas/satellite-proof";
import { buildBaselineSnapshot } from "../root-builder.js";

export class DeterministicSentinelAdapter {
  readonly adapterId = "deterministic-sentinel-adapter/v1";
  readonly mockOnly = true;

  ingest(input: BaselineSnapshotInput): BaselineSnapshot {
    const parsed = baselineSnapshotInputSchema.parse(input);
    if (parsed.source !== "sentinel-1" && parsed.source !== "sentinel-2") {
      throw new Error("Sentinel adapter accepts only sentinel-1 or sentinel-2 fixture records.");
    }
    return buildBaselineSnapshot(parsed);
  }
}
