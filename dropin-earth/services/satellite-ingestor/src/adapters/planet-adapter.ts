import {
  observationEventInputSchema,
  type ObservationEvent,
  type ObservationEventInput,
} from "@dropin/schemas/satellite-proof";
import { buildObservationEvent } from "../root-builder.js";

export class DeterministicPlanetAdapter {
  readonly adapterId = "deterministic-planet-adapter/v1";
  readonly mockOnly = true;

  ingest(input: ObservationEventInput): ObservationEvent {
    const parsed = observationEventInputSchema.parse(input);
    if (parsed.source !== "planet") {
      throw new Error("Planet adapter accepts only planet fixture records.");
    }
    return buildObservationEvent(parsed);
  }
}
