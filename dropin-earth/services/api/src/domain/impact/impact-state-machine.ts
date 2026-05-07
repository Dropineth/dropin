import type { Project } from "@dropin/schemas";
import { InvalidImpactTransitionError } from "./impact-errors.js";

export const projectTransitions: Record<Project["status"], readonly Project["status"][]> = {
  draft: ["submitted", "reviewing", "approved", "rejected"],
  submitted: ["reviewing", "approved", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: ["funded", "challenged"],
  funded: ["milestone_1_released", "planting_started", "challenged"],
  milestone_1_released: ["planting_started", "evidence_submitted", "challenged"],
  planting_started: ["evidence_submitted", "field_verified", "challenged"],
  evidence_submitted: ["field_verified", "challenged", "rejected"],
  field_verified: ["impact_certified", "challenged"],
  impact_certified: ["carbon_monitoring", "rwa_eligible", "completed", "challenged"],
  carbon_monitoring: ["rwa_eligible", "completed", "challenged"],
  rwa_eligible: ["completed", "challenged"],
  completed: ["challenged"],
  challenged: ["reviewing", "rejected", "completed"],
  rejected: [],
};

export function assertProjectTransition(from: Project["status"], to: Project["status"]) {
  if (!projectTransitions[from].includes(to)) {
    throw new InvalidImpactTransitionError(from, to);
  }
}
