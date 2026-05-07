import type { DropResult, RwaFragment, RiskAction, RiskLevel } from "@dropin/schemas";

export const sybilPolicy = {
  blockedBelow: 0.25,
  highBelow: 0.45,
  mediumBelow: 0.7,
  minimumRareScore: 0.45,
  minimumEpicScore: 0.65,
  minimumRwaFragmentScore: 0.75,
} as const;

export type DropGateKind = "drop_result" | "rwa_fragment";

export type DropGateInput = {
  kind: DropGateKind;
  rarity?: DropResult["rarity"];
  fragmentType?: RwaFragment["type"];
  score: number;
  riskLevel: RiskLevel;
};

export type DropGateOutcome = "claimable" | "delayed" | "manual_review" | "blocked";

export function riskLevelForScore(score: number): RiskLevel {
  if (score < sybilPolicy.blockedBelow) return "blocked";
  if (score < sybilPolicy.highBelow) return "high";
  if (score < sybilPolicy.mediumBelow) return "medium";
  return "low";
}

export function actionForRiskLevel(riskLevel: RiskLevel): RiskAction {
  if (riskLevel === "blocked") return "block";
  if (riskLevel === "high") return "manual_review";
  if (riskLevel === "medium") return "delay";
  return "allow";
}
