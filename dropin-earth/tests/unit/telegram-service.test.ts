import assert from "node:assert/strict";
import test from "node:test";
import { CertificateService } from "../../services/api/src/domain/impact/certificate-service.js";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { FundService } from "../../services/api/src/domain/fund/fund-service.js";
import { InMemoryFundRepository } from "../../services/api/src/domain/fund/fund-repository.js";
import { LotteryService } from "../../services/api/src/domain/lottery/lottery-service.js";
import { InMemoryLotteryRepository } from "../../services/api/src/domain/lottery/lottery-repository.js";
import { PaymentService } from "../../services/api/src/domain/payment/payment-service.js";
import { InMemoryPaymentRepository } from "../../services/api/src/domain/payment/payment-repository.js";
import { InMemoryRiskRepository } from "../../services/api/src/domain/risk/risk-repository.js";
import { app } from "../../services/api/src/app.js";
import { InMemoryTelegramRepository } from "../../services/api/src/domain/telegram/telegram-repository.js";
import { TelegramService } from "../../services/api/src/domain/telegram/telegram-service.js";

function createTelegramContext() {
  const impactRepo = new InMemoryImpactRepository();
  const fundRepo = new InMemoryFundRepository();
  const fundService = new FundService(fundRepo, impactRepo);
  const paymentService = new PaymentService(new InMemoryPaymentRepository(), fundService, "mock");
  const lotteryService = new LotteryService(new InMemoryLotteryRepository(), fundService, paymentService);
  const certificateService = new CertificateService(impactRepo);
  const riskRepo = new InMemoryRiskRepository();
  const telegramRepo = new InMemoryTelegramRepository();
  const service = new TelegramService(telegramRepo, lotteryService, certificateService, riskRepo, "mock");
  return { riskRepo, service, telegramRepo };
}

const mockTelegramUser = {
  id: "10001",
  username: "dropin_demo",
  firstName: "Dropin",
  lastName: "Demo",
  languageCode: "en",
} as const;

test("mock telegram session creates account", async () => {
  const { service } = createTelegramContext();
  const session = await service.createSession({ user: mockTelegramUser, wallet: "ton_testnet_wallet_dropin_demo" });

  assert.equal(session.account.telegramUserId, "10001");
  assert.equal(session.account.linkedUserId, "telegram_10001");
  assert.equal(session.initDataValid, true);
});

test("repeated telegram session is idempotent", async () => {
  const { service } = createTelegramContext();
  const first = await service.createSession({ user: mockTelegramUser });
  const second = await service.createSession({ user: mockTelegramUser });

  assert.equal(second.account.id, first.account.id);
  assert.equal(second.account.telegramUserId, first.account.telegramUserId);
});

test("share-ticket creates referral code and share card", async () => {
  const { service, telegramRepo } = createTelegramContext();
  const result = await service.shareTicket({
    ticketId: "ticket_seed_test_001",
    roundId: "round_v1_ggw_demo",
    ownerUserId: "demo-user",
  });

  assert.equal(result.referral.sourceType, "ticket");
  assert.equal(result.shareCard.referralCode, result.referral.code);
  assert.equal(telegramRepo.shareCards.size, 1);
});

test("referral claim is idempotent", async () => {
  const { service } = createTelegramContext();
  const share = await service.shareTicket({
    ticketId: "ticket_seed_test_002",
    roundId: "round_v1_ggw_demo",
    ownerUserId: "demo-user",
  });
  const first = await service.claimReferral({
    code: share.referral.code,
    telegramUserId: "10002",
    roundId: "round_v1_ggw_demo",
    wallet: "ton_testnet_referred_wallet_10002",
  });
  const second = await service.claimReferral({
    code: share.referral.code,
    telegramUserId: "10002",
    roundId: "round_v1_ggw_demo",
    wallet: "ton_testnet_referred_wallet_10002",
  });

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.event.id, first.event.id);
});

test("suspicious self-referral creates risk event and no Leaf Points", async () => {
  const { riskRepo, service } = createTelegramContext();
  const share = await service.shareTicket({
    ticketId: "ticket_seed_test_003",
    roundId: "round_v1_ggw_demo",
    ownerUserId: "telegram_10001",
  });
  const claim = await service.claimReferral({
    code: share.referral.code,
    telegramUserId: "10001",
    roundId: "round_v1_ggw_demo",
  });

  assert.equal(claim.event.status, "suspicious");
  assert.equal(claim.event.leafPoints, 0);
  assert.equal(riskRepo.riskEvents.size, 1);
});

test("miniapp telegram API routes validate inputs", async () => {
  const invalid = await app.request("/telegram/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const invalidPayload = (await invalid.json()) as { ok: boolean; error: string };

  assert.equal(invalid.status, 400);
  assert.equal(invalidPayload.ok, false);

  const valid = await app.request("/telegram/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: mockTelegramUser }),
  });
  const validPayload = (await valid.json()) as { ok: boolean; data: { account: { telegramUserId: string } } };

  assert.equal(valid.status, 201);
  assert.equal(validPayload.ok, true);
  assert.equal(validPayload.data.account.telegramUserId, "10001");
});
