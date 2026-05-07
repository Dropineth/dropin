import type { FundAllocation } from "@dropin/schemas";
import { InvalidFundTransitionError } from "./fund-errors.js";

export const fundAllocationTransitions: Record<FundAllocation["status"], readonly FundAllocation["status"][]> = {
  created: ["allocated", "pending_approval", "approved", "challenged", "revoked"],
  allocated: ["pending_approval", "approved", "challenged", "revoked"],
  pending_approval: ["approved", "challenged", "revoked"],
  approved: ["timelocked", "released", "challenged", "revoked"],
  timelocked: ["released", "challenged", "revoked"],
  released: ["evidence_required", "evidence_accepted", "challenged", "revoked"],
  evidence_required: ["evidence_accepted", "challenged", "revoked"],
  evidence_accepted: ["impact_certified", "settled", "challenged", "revoked"],
  impact_certified: ["settled", "challenged", "revoked"],
  settled: ["challenged", "revoked"],
  challenged: ["revoked", "pending_approval", "approved"],
  revoked: [],
};

export function assertFundTransition(from: FundAllocation["status"], to: FundAllocation["status"]) {
  if (!fundAllocationTransitions[from].includes(to)) {
    throw new InvalidFundTransitionError(from, to);
  }
}
