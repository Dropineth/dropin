import type { RiskScoreResult } from "@dropin/schemas";
import type { DropGateInput, DropGateOutcome } from "./risk-policy.js";
import { sybilPolicy } from "./risk-policy.js";

export type DropGatingDecision = {
  outcome: DropGateOutcome;
  reason: string;
};

export function gateDropClaim(input: DropGateInput): DropGatingDecision {
  if (input.fragmentType === "qualified_yield") {
    return {
      outcome: "blocked",
      reason: "qualified_yield_rwa_disabled_in_v1",
    };
  }

  if (input.riskLevel === "blocked") {
    return {
      outcome: "blocked",
      reason: "risk_level_blocked",
    };
  }

  if (input.kind === "rwa_fragment") {
    return input.score >= sybilPolicy.minimumRwaFragmentScore
      ? { outcome: "claimable", reason: "rwa_fragment_score_threshold_met" }
      : { outcome: "manual_review", reason: "rwa_fragment_requires_manual_review" };
  }

  if (input.rarity === "legendary") {
    return {
      outcome: "manual_review",
      reason: "legendary_drop_manual_review",
    };
  }

  if (input.rarity === "epic") {
    if (input.score >= sybilPolicy.minimumEpicScore) {
      return { outcome: "claimable", reason: "epic_score_threshold_met" };
    }
    return input.score >= sybilPolicy.minimumRareScore
      ? { outcome: "delayed", reason: "epic_drop_delayed_for_review" }
      : { outcome: "manual_review", reason: "epic_drop_manual_review" };
  }

  if (input.rarity === "rare") {
    return input.score >= sybilPolicy.minimumRareScore
      ? { outcome: "claimable", reason: "rare_score_threshold_met" }
      : { outcome: "manual_review", reason: "rare_drop_manual_review" };
  }

  return {
    outcome: "claimable",
    reason: "common_drop_auto_claimable",
  };
}

export function riskInputFromClaim(risk: RiskScoreResult) {
  return {
    score: risk.score,
    riskLevel: risk.riskLevel,
  };
}
