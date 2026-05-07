import { hashHex } from "@dropin/crypto";
import type { RiskScoreInput, RiskScoreResult } from "@dropin/schemas";
import { actionForRiskLevel, riskLevelForScore } from "./risk-policy.js";

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function amountValue(input: string) {
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : 0;
}

function deterministicWalletSignal(wallet: string) {
  const digest = hashHex(`dropin-risk-v1:${wallet}`);
  const bucket = Number.parseInt(digest.slice(0, 4), 16) % 11;
  return (bucket - 5) / 500;
}

export function computeAntiSybilScore(input: RiskScoreInput): RiskScoreResult {
  const reasons: string[] = [];
  let score = 0.58 + deterministicWalletSignal(input.wallet);
  const wallet = input.wallet.toLowerCase();

  if (input.walletAgeDays === undefined) {
    score -= 0.08;
    reasons.push("wallet_age_unknown");
  } else if (input.walletAgeDays < 2) {
    score -= 0.16;
    reasons.push("wallet_age_under_2_days");
  } else if (input.walletAgeDays < 30) {
    score -= 0.06;
    reasons.push("wallet_age_under_30_days");
  } else if (input.walletAgeDays >= 90) {
    score += 0.12;
    reasons.push("wallet_age_90_days_plus");
  }

  if (input.entryCount > 50) {
    score -= 0.25;
    reasons.push("entry_count_extreme");
  } else if (input.entryCount > 10) {
    score -= 0.12;
    reasons.push("entry_count_elevated");
  }

  const totalContribution = amountValue(input.totalContributionAmount);
  if (input.entryCount > 0 && totalContribution / input.entryCount < 0.25) {
    score -= 0.08;
    reasons.push("micro_entry_pattern");
  }

  const priorClaimCount = input.priorClaimCount ?? 0;
  if (priorClaimCount > 20) {
    score -= 0.15;
    reasons.push("prior_claim_count_extreme");
  } else if (priorClaimCount > 5) {
    score -= 0.07;
    reasons.push("prior_claim_count_elevated");
  }

  const rejectedChallengeCount = input.rejectedChallengeCount ?? 0;
  if (rejectedChallengeCount > 0) {
    score -= Math.min(0.25, rejectedChallengeCount * 0.08);
    reasons.push("rejected_challenge_history");
  }

  const acceptedEvidenceCount = input.acceptedEvidenceCount ?? 0;
  if (acceptedEvidenceCount > 0) {
    score += Math.min(0.15, acceptedEvidenceCount * 0.04);
    reasons.push("accepted_evidence_history");
  }

  if (wallet.includes("sybil") || wallet.includes("blocked")) {
    score -= 0.45;
    reasons.push("deterministic_blocklist_signal");
  }

  if (wallet.includes("trusted") || wallet.includes("validator")) {
    score += 0.1;
    reasons.push("deterministic_trust_signal");
  }

  if (reasons.length === 0) {
    reasons.push("baseline_v1_policy");
  }

  const normalized = Number(clamp(score).toFixed(4));
  const riskLevel = riskLevelForScore(normalized);
  return {
    score: normalized,
    riskLevel,
    reasons,
    recommendedAction: actionForRiskLevel(riskLevel),
  };
}
