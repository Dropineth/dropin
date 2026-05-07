import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { ImpactService } from "../../services/api/src/domain/impact/impact-service.js";
import { InMemoryLotteryRepository } from "../../services/api/src/domain/lottery/lottery-repository.js";
import { LotteryService } from "../../services/api/src/domain/lottery/lottery-service.js";
import { InMemoryFundRepository, treasuryAccountId } from "../../services/api/src/domain/fund/fund-repository.js";
import { FundService } from "../../services/api/src/domain/fund/fund-service.js";
import { assertFundTransition } from "../../services/api/src/domain/fund/fund-state-machine.js";
import { computeSettlementCertificateHash } from "../../services/api/src/domain/fund/fund-engine.js";
import { InMemoryRiskRepository } from "../../services/api/src/domain/risk/risk-repository.js";
import { RiskService } from "../../services/api/src/domain/risk/risk-service.js";

const entry = {
  userId: "demo-user",
  wallet: "solana_wallet_demo_user_111111111111111111",
  amount: "1",
  currency: "USDC",
  regionId: "region_ggw_sahel",
  antiSybilScore: 80,
  idempotencyKey: "idem-fund-0001",
} as const;

function createFundContext() {
  const impactRepo = new InMemoryImpactRepository();
  const fundRepo = new InMemoryFundRepository();
  const fundService = new FundService(fundRepo, impactRepo);
  return { impactRepo, fundRepo, fundService };
}

test("ledger posted transaction remains append-only when reversed", async () => {
  const { fundRepo, fundService } = createFundContext();
  await fundRepo.ensureCoreAccounts("USDC");
  const beforeCount = (await fundRepo.listTreasuryTransactions()).length;
  const original = await fundRepo.createTreasuryTransaction({
    id: fundRepo.makeId("treasury_tx"),
    type: "admin_adjustment",
    debitAccountId: treasuryAccountId("protocol_reserve", "USDC"),
    creditAccountId: treasuryAccountId("tree_planting_fund", "USDC"),
    amount: "100",
    currency: "USDC",
    sourceType: "admin",
    sourceId: "test_adjustment",
    status: "posted",
  });

  const reversal = await fundService.reverseTransaction(original.id, "test-admin");
  const fetchedOriginal = await fundRepo.getTreasuryTransaction(original.id);

  assert.equal(fetchedOriginal?.amount, "100");
  assert.equal(fetchedOriginal?.status, "posted");
  assert.equal(reversal.reversalOfId, original.id);
  assert.equal(reversal.debitAccountId, original.creditAccountId);
  assert.equal((await fundRepo.listTreasuryTransactions()).length, beforeCount + 2);
});

test("fund allocation state transitions accept valid path and reject invalid transition", async () => {
  assert.doesNotThrow(() => assertFundTransition("created", "allocated"));
  assert.doesNotThrow(() => assertFundTransition("allocated", "pending_approval"));
  assert.doesNotThrow(() => assertFundTransition("pending_approval", "approved"));
  assert.throws(() => assertFundTransition("created", "settled"), /Invalid fund allocation transition/);
});

test("Tree Lotto finalize creates fund allocations", async () => {
  const impactRepo = new InMemoryImpactRepository();
  const fundRepo = new InMemoryFundRepository(false);
  const fundService = new FundService(fundRepo, impactRepo);
  const lotteryRepo = new InMemoryLotteryRepository();
  const lotteryService = new LotteryService(lotteryRepo, fundService);

  await lotteryService.enterRound("round_v1_ggw_demo", entry);
  await lotteryService.closeRound("round_v1_ggw_demo", "test-admin");
  await lotteryService.finalizeRound("round_v1_ggw_demo", "test-admin");

  const allocations = await fundRepo.listFundAllocations();
  assert.ok(allocations.some((allocation) => allocation.allocationType === "tree_fund"));
  assert.ok(allocations.some((allocation) => allocation.allocationType === "prize_pool"));
  assert.ok(fundRepo.auditLogs.some((log) => log.action === "fund_allocation.lottery_allocate"));
});

test("milestone release creates ledger transaction and audit log", async () => {
  const { fundRepo, fundService } = createFundContext();
  const allocation = await fundService.createAllocation(
    {
      sourceType: "lottery_round",
      sourceId: "round_v1_ggw_demo",
      allocationType: "tree_fund",
      projectId: "project_v1_ggw_demo",
      amount: "100",
      currency: "USDC",
      status: "approved",
    },
    "test-admin",
  );

  const result = await fundService.releaseMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
    allocationId: allocation.id,
    amount: "25",
    currency: "USDC",
    actor: "test-admin",
  });

  assert.equal(result.release.status, "released");
  assert.equal(result.transaction.type, "milestone_release");
  assert.ok(fundRepo.auditLogs.some((log) => log.action === "project_milestone.release_funds"));
});

test("settlement rejects without accepted evidence", async () => {
  const impactRepo = new InMemoryImpactRepository(false);
  const impactService = new ImpactService(impactRepo);
  const fundRepo = new InMemoryFundRepository(false);
  const fundService = new FundService(fundRepo, impactRepo);
  const project = await impactService.createProject({
    title: "No Evidence Project",
    regionId: "region_ggw_sahel",
    operator: "Operator",
    targetTreeCount: 100,
    targetSpecies: ["Acacia senegal"],
    budgetAmount: "1000",
    status: "approved",
  });
  const milestone = await impactService.createMilestone(project.id, {
    title: "Release without evidence",
    amount: "100",
    status: "approved",
  });
  const release = await fundService.releaseMilestone(project.id, milestone.id, {
    amount: "10",
    currency: "USDC",
  });

  await assert.rejects(
    () => fundService.settleMilestone(project.id, milestone.id, { releaseId: release.release.id }),
    /accepted evidence/,
  );
});

test("final settlement rejects without issued Impact Certificate", async () => {
  const { fundService } = createFundContext();
  const release = await fundService.releaseMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
    amount: "25",
    currency: "USDC",
  });

  await assert.rejects(
    () =>
      fundService.settleMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
        releaseId: release.release.id,
        finalSettlement: true,
      }),
    /Final settlement requires an issued Impact Certificate/,
  );
});

test("settlement certificate hash is deterministic", () => {
  const first = computeSettlementCertificateHash({
    projectId: "project_v1_ggw_demo",
    milestoneId: "milestone_v1_ggw_demo_1",
    evidenceRoot: "evidence-root-demo",
    amount: "25",
    currency: "USDC",
    certificateId: "cert_v1_ggw_demo",
    finalSettlement: true,
  });
  const second = computeSettlementCertificateHash({
    projectId: "project_v1_ggw_demo",
    milestoneId: "milestone_v1_ggw_demo_1",
    evidenceRoot: "evidence-root-demo",
    amount: "25",
    currency: "USDC",
    certificateId: "cert_v1_ggw_demo",
    finalSettlement: true,
  });

  assert.equal(first, second);
});

test("final settlement succeeds with issued Impact Certificate and audit log", async () => {
  const { fundRepo, fundService } = createFundContext();
  const release = await fundService.releaseMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
    amount: "25",
    currency: "USDC",
    actor: "test-admin",
  });
  const result = await fundService.settleMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
    releaseId: release.release.id,
    certificateId: "cert_v1_ggw_demo",
    finalSettlement: true,
    actor: "test-admin",
  });

  assert.equal(result.settlement.status, "issued");
  assert.equal(result.settlement.certificateId, "cert_v1_ggw_demo");
  assert.ok(fundRepo.auditLogs.some((log) => log.action === "project_milestone.settle"));
});

test("accepted challenge sets fund allocation challenged", async () => {
  const { impactRepo, fundService } = createFundContext();
  const riskRepo = new InMemoryRiskRepository();
  const lotteryRepo = new InMemoryLotteryRepository();
  const riskService = new RiskService(riskRepo, impactRepo, lotteryRepo, fundService);
  const allocation = await fundService.createAllocation({
    sourceType: "lottery_round",
    sourceId: "round_v1_ggw_demo",
    allocationType: "tree_fund",
    projectId: "project_v1_ggw_demo",
    amount: "100",
    currency: "USDC",
    status: "approved",
  });
  const { challenge } = await riskService.createChallenge({
    targetType: "fund_allocation",
    targetId: allocation.id,
    challenger: "red_team_fund",
    severity: "high",
    title: "Allocation anomaly",
    attackScenario: "A red-team reviewer found a mismatch between round allocation and ledger entry.",
    evidenceHash: "fund-challenge-hash",
    bondAmount: "5",
  });

  await riskService.acceptChallenge(challenge.id, { resolver: "api-admin" });
  const updated = await fundService.getAllocation(allocation.id);

  assert.equal(updated.status, "challenged");
  assert.ok(riskRepo.auditLogs.some((log) => log.action === "challenge.accept"));
});

test("accepted challenge sets treasury transaction challenged", async () => {
  const { impactRepo, fundRepo, fundService } = createFundContext();
  await fundRepo.ensureCoreAccounts("USDC");
  const transaction = await fundRepo.createTreasuryTransaction({
    id: fundRepo.makeId("treasury_tx"),
    type: "admin_adjustment",
    debitAccountId: treasuryAccountId("protocol_reserve", "USDC"),
    creditAccountId: treasuryAccountId("tree_planting_fund", "USDC"),
    amount: "10",
    currency: "USDC",
    sourceType: "admin",
    sourceId: "challenge_tx_test",
    status: "posted",
  });
  const riskRepo = new InMemoryRiskRepository();
  const riskService = new RiskService(riskRepo, impactRepo, new InMemoryLotteryRepository(), fundService);
  const { challenge } = await riskService.createChallenge({
    targetType: "treasury_transaction",
    targetId: transaction.id,
    challenger: "red_team_fund",
    severity: "medium",
    title: "Ledger anomaly",
    attackScenario: "A red-team reviewer found a ledger transaction that should be frozen for review.",
    evidenceHash: "treasury-challenge-hash",
    bondAmount: "5",
  });

  await riskService.acceptChallenge(challenge.id, { resolver: "api-admin" });
  const updated = await fundRepo.getTreasuryTransaction(transaction.id);

  assert.equal(updated?.status, "challenged");
});

test("accepted challenge sets settlement certificate challenged", async () => {
  const { impactRepo, fundRepo, fundService } = createFundContext();
  const release = await fundService.releaseMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
    amount: "25",
    currency: "USDC",
  });
  const settled = await fundService.settleMilestone("project_v1_ggw_demo", "milestone_v1_ggw_demo_1", {
    releaseId: release.release.id,
    certificateId: "cert_v1_ggw_demo",
    finalSettlement: true,
  });
  const riskRepo = new InMemoryRiskRepository();
  const riskService = new RiskService(riskRepo, impactRepo, new InMemoryLotteryRepository(), fundService);
  const { challenge } = await riskService.createChallenge({
    targetType: "settlement_certificate",
    targetId: settled.settlement.id,
    challenger: "red_team_fund",
    severity: "high",
    title: "Settlement evidence review",
    attackScenario: "A red-team reviewer found a settlement certificate that should be frozen for evidence review.",
    evidenceHash: "settlement-challenge-hash",
    bondAmount: "5",
  });

  await riskService.acceptChallenge(challenge.id, { resolver: "api-admin" });
  const updated = await fundRepo.getSettlementCertificate(settled.settlement.id);

  assert.equal(updated?.status, "challenged");
});

test("fund approve release settle and challenge write audit logs", async () => {
  const { fundRepo, fundService } = createFundContext();
  const allocation = await fundService.createAllocation({
    sourceType: "lottery_round",
    sourceId: "round_v1_ggw_demo",
    allocationType: "tree_fund",
    projectId: "project_v1_ggw_demo",
    amount: "100",
    currency: "USDC",
  });

  await fundService.approveAllocation(allocation.id, "test-admin");
  await fundService.releaseAllocation(allocation.id, "test-admin");
  await fundService.challengeAllocation(allocation.id, { challenger: "test-admin", reason: "red-team rehearsal" });

  assert.ok(fundRepo.auditLogs.some((log) => log.action === "fund_allocation.approve"));
  assert.ok(fundRepo.auditLogs.some((log) => log.action === "fund_allocation.release"));
  assert.ok(fundRepo.auditLogs.some((log) => log.action === "fund_allocation.challenge"));
});
