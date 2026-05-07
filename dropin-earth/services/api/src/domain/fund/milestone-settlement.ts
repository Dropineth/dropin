import type { ImpactCertificate, ProjectMilestone } from "@dropin/schemas";
import { SettlementRequirementError } from "./fund-errors.js";

export function assertMilestoneReleaseable(milestone: ProjectMilestone) {
  if (!["approved", "funded", "released", "evidence_required", "verified"].includes(milestone.status)) {
    throw new SettlementRequirementError(`Milestone ${milestone.id} is not approved for release.`);
  }
}

export function assertIssuedCertificate(certificate: ImpactCertificate | undefined, certificateId: string) {
  if (!certificate) {
    throw new SettlementRequirementError(`Impact Certificate not found: ${certificateId}`);
  }
  if (certificate.status !== "issued") {
    throw new SettlementRequirementError(`Impact Certificate ${certificateId} must be issued before final settlement.`);
  }
}
