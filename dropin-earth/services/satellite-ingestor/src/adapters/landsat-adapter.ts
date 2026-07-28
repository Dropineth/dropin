import {
  baselineSnapshotInputSchema,
  type BaselineSnapshot,
  type BaselineSnapshotInput,
} from "@dropin/schemas/satellite-proof";
import { buildBaselineSnapshot } from "../root-builder.js";

export class DeterministicLandsatAdapter {
  readonly adapterId = "deterministic-landsat-adapter/v1";
  readonly mockOnly = true;

  ingest(input: BaselineSnapshotInput): BaselineSnapshot {
    const parsed = baselineSnapshotInputSchema.parse(input);
    if (parsed.source !== "landsat") {
      throw new Error("Landsat adapter accepts only landsat fixture records.");
    }
    return buildBaselineSnapshot(parsed);
  }
}
