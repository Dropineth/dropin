import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { InMemoryLotteryRepository, type RwaFragmentRecord } from "../../services/api/src/domain/lottery/lottery-repository.js";
import { gateDropClaim } from "../../services/api/src/domain/risk/drop-gating.js";
import { InMemoryRiskRepository } from "../../services/api/src/domain/risk/risk-repository.js";
import { RiskService } from "../../services/api/src/domain/risk/risk-service.js";
import { computeAntiSybilScore } from "../../services/api/src/domain/risk/sybil-score.js";
import type { DropResult } from "@dropin/schemas";

function createRiskService() {
  const riskRepo = new InMemoryRiskRepository();
  const impactRepo = new InMemoryImpactRepository();
  const lotteryRepo = new InMemoryLotteryRepository();
  const service = new RiskService(riskRepo, impactRepo, lotteryRepo);
  return { service, riskRepo, impactRepo, lotteryRepo };
}

const baseRiskInput = {
  wallet: "solana_wallet_trusted_validator_111111111111111111",
  userId: "demo-user",
  roundId: "round_v1_ggw_demo",
  entryCount: 1,
  totalContributionAmount: "1",
  walletAgeDays: 120,
  priorClaimCount: 0,
  rejectedChallengeCount: 0,
  acceptedEvidenceCount: 2,
} as const;

test("anti-sybil score is deterministic", () => {
  const first = computeAntiSybilScore(baseRiskInput);
  const second = computeAntiSybilScore(baseRiskInput);

  assert.deepEqual(first, second);
  assert.equal(first.riskLevel, "low");
  assert.equal(first.recommendedAction, "allow");
});

test("risk policy thresholds classify high-risk wallets", () => {
  const result = computeAntiSybilScore({
    ...baseRiskInput,
    wallet: "solana_wallet_sybil_blocked_222222222222222222",
    entryCount: 64,
    walletAgeDays: 0,
    priorClaimCount: 24,
    rejectedChallengeCount: 3,
    acceptedEvidenceCount: 0,
  });

  assert.equal(result.riskLevel, "blocked");
  assert.equal(result.recommendedAction, "block");
});

test("common drop allows non-blocked users", () => {
  const risk = computeAntiSybilScore(baseRiskInput);
  const decision = gateDropClaim({
    kind: "drop_result",
    rarity: "common",
    score: risk.score,
    riskLevel: risk.riskLevel,
  });

  assert.equal(decision.outcome, "claimable");
});

test("epic drop is delayed or sent to manual review below threshold", () => {
  const risk = computeAntiSybilScore({
    ...baseRiskInput,
    wallet: "solana_wallet_new_user_333333333333333333",
    walletAgeDays: 1,
    entryCount: 12,
    acceptedEvidenceCount: 0,
  });
  const decision = gateDropClaim({
    kind: "drop_result",
    rarity: "epic",
    score: risk.score,
    riskLevel: risk.riskLevel,
  });

  assert.notEqual(decision.outcome, "claimable");
});

test("qualified yield RWA is disabled in V1", () => {
  const risk = computeAntiSybilScore(baseRiskInput);
  const decision = gateDropClaim({
    kind: "rwa_fragment",
    fragmentType: "qualified_yield",
    rarity: "legendary",
    score: risk.score,
    riskLevel: risk.riskLevel,
  });

  assert.equal(decision.outcome, "blocked");
});

test("challenge creation locks a challenge bond", async () => {
  const { service } = createRiskService();
  const result = await service.createChallenge({
    targetType: "impact_certificate",
    targetId: "cert_v1_ggw_demo",
    challenger: "red_team_1",
    severity: "high",
    title: "Duplicate evidence challenge",
    attackScenario: "The same field evidence appears to be reused across two different proof objects.",
    evidenceHash: "challenge-hash-001",
    bondAmount: "10",
    bondCurrency: "USDC",
  });

  assert.equal(result.challenge.status, "bonded");
  assert.equal(result.bond.status, "locked");
});

test("challenge evidence submission is recorded", async () => {
  const { service } = createRiskService();
  const { challenge } = await service.createChallenge({
    targetType: "evidence_object",
    targetId: "evidence_v1_ggw_demo_photo",
    challenger: "red_team_1",
    severity: "medium",
    title: "EXIF mismatch",
    attackScenario: "The timestamp and region metadata do not align with the planting window.",
    evidenceHash: "challenge-hash-002",
    bondAmount: "5",
  });

  const evidence = await service.addChallengeEvidence(challenge.id, {
    uri: "r2://dropin/red-team/exif-report.json",
    evidenceHash: "supplemental-hash-002",
    submittedBy: "red_team_1",
  });

  const detail = await service.getChallengeDetail(challenge.id);
  assert.equal(evidence.challengeId, challenge.id);
  assert.equal(detail.evidence.length, 1);
  assert.equal(detail.challenge.status, "evidence_submitted");
});

test("accept challenge sets impact certificate challenged", async () => {
  const { service, impactRepo } = createRiskService();
  const { challenge } = await service.createChallenge({
    targetType: "impact_certificate",
    targetId: "cert_v1_ggw_demo",
    challenger: "red_team_1",
    severity: "high",
    title: "Certificate evidence root challenge",
    attackScenario: "The evidence root may include an object that was superseded before issuance.",
    evidenceHash: "challenge-hash-003",
    bondAmount: "10",
  });

  const result = await service.acceptChallenge(challenge.id, { resolver: "api-admin", notes: "Valid red-team finding." });
  const certificate = await impactRepo.getCertificate("cert_v1_ggw_demo");

  assert.equal(result.challenge.result, "accepted");
  assert.equal(certificate?.status, "challenged");
});

test("accept challenge sets evidence challenged", async () => {
  const { service, impactRepo } = createRiskService();
  const { challenge } = await service.createChallenge({
    targetType: "evidence_object",
    targetId: "evidence_v1_ggw_demo_photo",
    challenger: "red_team_1",
    severity: "medium",
    title: "Photo reuse challenge",
    attackScenario: "The same photo hash appears in a red-team duplicate image set.",
    evidenceHash: "challenge-hash-004",
    bondAmount: "5",
  });

  await service.acceptChallenge(challenge.id, { resolver: "api-admin" });
  const evidence = await impactRepo.getEvidence("evidence_v1_ggw_demo_photo");

  assert.equal(evidence?.status, "challenged");
});

test("reject challenge preserves target status", async () => {
  const { service, impactRepo } = createRiskService();
  const before = await impactRepo.getEvidence("evidence_v1_ggw_demo_photo");
  const { challenge } = await service.createChallenge({
    targetType: "evidence_object",
    targetId: "evidence_v1_ggw_demo_photo",
    challenger: "red_team_2",
    severity: "low",
    title: "Weak GPS challenge",
    attackScenario: "The submitted issue lacks enough proof to change the evidence status.",
    evidenceHash: "challenge-hash-005",
    bondAmount: "2",
  });

  await service.rejectChallenge(challenge.id, { resolver: "api-admin", notes: "Insufficient evidence." });
  const after = await impactRepo.getEvidence("evidence_v1_ggw_demo_photo");

  assert.equal(after?.status, before?.status);
});

test("challenge resolution creates audit log", async () => {
  const { service, riskRepo } = createRiskService();
  const { challenge } = await service.createChallenge({
    targetType: "impact_certificate",
    targetId: "cert_v1_ggw_demo",
    challenger: "red_team_3",
    severity: "high",
    title: "Methodology challenge",
    attackScenario: "The certificate references a methodology version that needs operator review.",
    evidenceHash: "challenge-hash-006",
    bondAmount: "7",
  });

  await service.acceptChallenge(challenge.id, { resolver: "api-admin", protocolFix: "Lock challenged certificate viewer." });

  assert.ok(riskRepo.auditLogs.some((log) => log.action === "challenge.accept"));
});

test("risk claim gating result is deterministic", async () => {
  const { service, lotteryRepo } = createRiskService();
  const drop: DropResult = {
    id: "drop_epic_test",
    roundId: "round_v1_ggw_demo",
    entryId: "entry_test",
    userId: "demo-user",
    wallet: "solana_wallet_new_user_444444444444444444",
    canopyAmount: "120",
    rwaFragmentAmount: "0",
    rarity: "epic",
    merkleLeaf: "leaf_epic_test",
    createdAt: lotteryRepo.now(),
  };
  lotteryRepo.drops.set(drop.id, drop);

  const input = {
    wallet: drop.wallet,
    userId: drop.userId,
    walletAgeDays: 1,
    priorClaimCount: 8,
  };
  const first = await service.claimDrop(drop.id, input);
  const second = await service.claimDrop(drop.id, input);

  assert.equal(first.outcome, second.outcome);
  assert.equal(first.risk.score, second.risk.score);
});

test("RWA fragment claim below threshold enters manual review", async () => {
  const { service, lotteryRepo } = createRiskService();
  const fragment: RwaFragmentRecord = {
    id: "fragment_rwa_test",
    holderUserId: "demo-user",
    holderWallet: "solana_wallet_new_user_555555555555555555",
    roundId: "round_v1_ggw_demo",
    regionId: "region_ggw_sahel",
    type: "impact_right",
    status: "claimable",
    notionalCo2e: "0.003",
    jurisdictionMode: "global_utility",
    transferability: "restricted",
    rarity: "rare",
    createdAt: lotteryRepo.now(),
    updatedAt: lotteryRepo.now(),
  };
  lotteryRepo.rwaFragments.set(fragment.id, fragment);

  const decision = await service.claimRwaFragment(fragment.id, {
    wallet: fragment.holderWallet,
    userId: fragment.holderUserId,
    walletAgeDays: 1,
  });

  assert.equal(decision.outcome, "manual_review");
});
