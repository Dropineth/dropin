import assert from "node:assert/strict";
import test from "node:test";
import { CampaignService } from "../../services/api/src/domain/campaign/campaign-service.js";
import { InMemoryCampaignRepository } from "../../services/api/src/domain/campaign/campaign-repository.js";
import { FundService } from "../../services/api/src/domain/fund/fund-service.js";
import { InMemoryFundRepository } from "../../services/api/src/domain/fund/fund-repository.js";
import { CertificateService } from "../../services/api/src/domain/impact/certificate-service.js";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { LotteryService } from "../../services/api/src/domain/lottery/lottery-service.js";
import { InMemoryLotteryRepository } from "../../services/api/src/domain/lottery/lottery-repository.js";
import { PaymentService } from "../../services/api/src/domain/payment/payment-service.js";
import { InMemoryPaymentRepository } from "../../services/api/src/domain/payment/payment-repository.js";
import { InMemoryRiskRepository } from "../../services/api/src/domain/risk/risk-repository.js";
import { InMemoryTelegramRepository } from "../../services/api/src/domain/telegram/telegram-repository.js";
import { TelegramService } from "../../services/api/src/domain/telegram/telegram-service.js";

function createCampaignContext() {
  const lotteryRepo = new InMemoryLotteryRepository();
  const impactRepo = new InMemoryImpactRepository();
  const fundRepo = new InMemoryFundRepository();
  const paymentRepo = new InMemoryPaymentRepository();
  const riskRepo = new InMemoryRiskRepository();
  const campaignRepo = new InMemoryCampaignRepository();
  const fundService = new FundService(fundRepo, impactRepo);
  const paymentService = new PaymentService(paymentRepo, fundService, "mock", riskRepo);
  const campaignService = new CampaignService(campaignRepo, {
    lotteryRepo,
    paymentRepo,
    fundRepo,
    impactRepo,
    riskRepo,
  });
  const lotteryService = new LotteryService(lotteryRepo, fundService, paymentService, campaignService);
  const telegramService = new TelegramService(
    new InMemoryTelegramRepository(),
    lotteryService,
    new CertificateService(impactRepo),
    riskRepo,
    "mock",
    campaignService,
  );
  return {
    campaignRepo,
    campaignService,
    lotteryService,
    paymentRepo,
    riskRepo,
    telegramService,
  };
}

const createCampaignInput = {
  title: "Sahel Testnet Campaign",
  slug: "sahel-testnet-campaign",
  regionId: "region_ggw_sahel",
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 86_400_000).toISOString(),
  fundingGoalAmount: "500",
  fundingGoalCurrency: "USDC",
  treeGoal: 5000,
  roundId: "round_v1_ggw_demo",
  projectId: "project_v1_ggw_demo",
} as const;

const entry = {
  userId: "campaign-user",
  wallet: "solana_campaign_wallet_111111111111",
  amount: "1",
  currency: "USDC",
  regionId: "region_ggw_sahel",
  antiSybilScore: 83,
  idempotencyKey: "campaign-entry-idem-0001",
} as const;

test("campaign creation creates audit log", async () => {
  const { campaignRepo, campaignService } = createCampaignContext();
  const campaign = await campaignService.createCampaign(createCampaignInput, "test-admin");

  assert.equal(campaign.status, "draft");
  assert.ok(campaignRepo.auditLogs.some((log) => log.action === "campaign.create"));
});

test("campaign state transitions are valid and auditable", async () => {
  const { campaignRepo, campaignService } = createCampaignContext();
  const campaign = await campaignService.createCampaign({ ...createCampaignInput, slug: "sahel-state-flow" }, "test-admin");

  await campaignService.scheduleCampaign(campaign.id, "test-admin");
  await campaignService.startCampaign(campaign.id, "test-admin");
  await campaignService.endCampaign(campaign.id, "test-admin");
  const finalized = await campaignService.finalizeCampaign(campaign.id, "test-admin");

  assert.equal(finalized.campaign.status, "finalized");
  assert.ok(campaignRepo.auditLogs.some((log) => log.action === "campaign.finalize"));
});

test("invalid campaign transition is rejected", async () => {
  const { campaignService } = createCampaignContext();
  const campaign = await campaignService.createCampaign({ ...createCampaignInput, slug: "sahel-invalid-flow" });

  await assert.rejects(() => campaignService.startCampaign(campaign.id), /Invalid campaign transition/);
});

test("campaign join is idempotent", async () => {
  const { campaignService } = createCampaignContext();
  const first = await campaignService.joinCampaign("campaign_v1_ggw_testnet", {
    userId: "co-planter-1",
    wallet: "wallet_co_planter_111111",
  });
  const second = await campaignService.joinCampaign("campaign_v1_ggw_testnet", {
    userId: "co-planter-1",
    wallet: "wallet_co_planter_111111",
  });

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.participant.id, first.participant.id);
});

test("Leaf Points account creation and award are idempotent", async () => {
  const { campaignService } = createCampaignContext();
  const first = await campaignService.leafPoints.award({
    campaignId: "campaign_v1_ggw_testnet",
    userId: "leaf-user",
    amount: 10,
    sourceType: "manual_test",
    sourceId: "leaf-award-001",
    reason: "Unit test award",
  });
  const second = await campaignService.leafPoints.award({
    campaignId: "campaign_v1_ggw_testnet",
    userId: "leaf-user",
    amount: 10,
    sourceType: "manual_test",
    sourceId: "leaf-award-001",
    reason: "Unit test award",
  });

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.account.balance, 10);
});

test("lottery entry awards campaign Leaf Points", async () => {
  const { campaignService, lotteryService } = createCampaignContext();
  const result = await lotteryService.enterRound("round_v1_ggw_demo", entry);
  const me = await campaignService.getCampaignMe("campaign_v1_ggw_testnet", entry.userId);

  assert.ok(result.entry.id);
  assert.equal(me.leafPointsAccount?.balance, 10);
});

test("share ticket awards campaign Leaf Points", async () => {
  const { campaignService, telegramService } = createCampaignContext();
  await telegramService.shareTicket({
    ticketId: "ticket_campaign_share_001",
    roundId: "round_v1_ggw_demo",
    ownerUserId: "demo-user",
  });
  const transactions = await campaignService.getCampaignLeafPoints("campaign_v1_ggw_testnet");

  assert.ok(transactions.transactions.some((tx) => tx.sourceType === "share_ticket" && tx.amount === 5));
});

test("valid referral claim awards campaign Leaf Points", async () => {
  const { campaignService, telegramService } = createCampaignContext();
  const share = await telegramService.shareTicket({
    ticketId: "ticket_campaign_referral_001",
    roundId: "round_v1_ggw_demo",
    ownerUserId: "demo-user",
  });
  const claim = await telegramService.claimReferral({
    code: share.referral.code,
    telegramUserId: "20002",
    roundId: "round_v1_ggw_demo",
    wallet: "ton_testnet_referral_wallet_20002",
  });
  const leaf = await campaignService.getCampaignLeafPoints("campaign_v1_ggw_testnet");

  assert.equal(claim.event.status, "claimed");
  assert.equal(claim.event.leafPoints, 20);
  assert.ok(leaf.transactions.some((tx) => tx.sourceType === "referral_event" && tx.amount === 20));
});

test("suspicious referral does not award referral points and creates risk event", async () => {
  const { campaignService, riskRepo, telegramService } = createCampaignContext();
  const share = await telegramService.shareTicket({
    ticketId: "ticket_campaign_suspicious_001",
    roundId: "round_v1_ggw_demo",
    ownerUserId: "telegram_30003",
  });
  const claim = await telegramService.claimReferral({
    code: share.referral.code,
    telegramUserId: "30003",
    roundId: "round_v1_ggw_demo",
  });
  const leaf = await campaignService.getCampaignLeafPoints("campaign_v1_ggw_testnet");

  assert.equal(claim.event.status, "suspicious");
  assert.equal(claim.event.leafPoints, 0);
  assert.equal(riskRepo.riskEvents.size, 1);
  assert.equal(leaf.transactions.some((tx) => tx.sourceType === "referral_event" && tx.sourceId === claim.event.id), false);
});

test("leaderboard ordering is deterministic", async () => {
  const { campaignService } = createCampaignContext();
  await campaignService.leafPoints.award({
    campaignId: "campaign_v1_ggw_testnet",
    userId: "bob",
    amount: 20,
    sourceType: "manual_test",
    sourceId: "bob-20",
    reason: "Tie score",
  });
  await campaignService.leafPoints.award({
    campaignId: "campaign_v1_ggw_testnet",
    userId: "alice",
    amount: 20,
    sourceType: "manual_test",
    sourceId: "alice-20",
    reason: "Tie score",
  });
  const leaderboard = await campaignService.getLeaderboard("campaign_v1_ggw_testnet");
  const aliceIndex = leaderboard.findIndex((entry) => entry.userId === "alice");
  const bobIndex = leaderboard.findIndex((entry) => entry.userId === "bob");

  assert.ok(aliceIndex < bobIndex);
});

test("campaign report aggregates counts", async () => {
  const { campaignService, lotteryService, paymentRepo } = createCampaignContext();
  await paymentRepo.createPaymentIntent({
    userId: "report-user",
    wallet: "report_wallet_1111111111",
    purpose: "lottery_entry",
    purposeId: "round_v1_ggw_demo",
    chain: "manual",
    currency: "USDC",
    amount: "1",
    status: "confirmed",
    expectedRecipient: "manual://dropin/test",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    metadata: {},
  });
  await lotteryService.enterRound("round_v1_ggw_demo", {
    ...entry,
    userId: "report-user",
    wallet: "report_wallet_1111111111",
    idempotencyKey: "report-entry-0001",
  });
  const report = await campaignService.getReport("campaign_v1_ggw_testnet");

  assert.equal(report.ticketCount, 1);
  assert.equal(report.confirmedPaymentIntentCount, 1);
  assert.equal(report.evidenceCount, 2);
  assert.equal(report.impactCertificateStatuses.issued, 1);
});
