import {
  observationEventInputSchema,
  type ObservationEvent,
  type ObservationEventInput,
} from "@dropin/schemas/satellite-proof";
import { buildObservationEvent } from "../root-builder.js";

export class DeterministicSarAdapter {
  readonly adapterId = "deterministic-commercial-sar-adapter/v1";
  readonly mockOnly = true;

  ingest(input: ObservationEventInput): ObservationEvent {
    const parsed = observationEventInputSchema.parse(input);
    if (parsed.source !== "iceye" && parsed.source !== "capella") {
      throw new Error("SAR adapter accepts only iceye or capella fixture records.");
    }
    return buildObservationEvent(parsed);
  }
}
