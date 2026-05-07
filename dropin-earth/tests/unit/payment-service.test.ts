import assert from "node:assert/strict";
import { test } from "node:test";
import { FundService } from "../../services/api/src/domain/fund/fund-service.js";
import { InMemoryFundRepository } from "../../services/api/src/domain/fund/fund-repository.js";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { LotteryService } from "../../services/api/src/domain/lottery/lottery-service.js";
import { InMemoryLotteryRepository } from "../../services/api/src/domain/lottery/lottery-repository.js";
import { PaymentService } from "../../services/api/src/domain/payment/payment-service.js";
import { InMemoryPaymentRepository } from "../../services/api/src/domain/payment/payment-repository.js";
import { DuplicatePaymentTxError, PaymentStateError } from "../../services/api/src/domain/payment/payment-errors.js";
import {
  MockTonTestnetPaymentProvider,
  TonTestnetPaymentAdapter,
  type NormalizedTonTransaction,
} from "../../services/api/src/domain/payment/adapters/ton-testnet-payment-adapter.js";
import { RiskService } from "../../services/api/src/domain/risk/risk-service.js";
import { InMemoryRiskRepository } from "../../services/api/src/domain/risk/risk-repository.js";

function createPaymentContext(mode = "manual", tonTransactions?: Map<string, NormalizedTonTransaction>, tonEnabled = true) {
  const impactRepo = new InMemoryImpactRepository();
  const fundRepo = new InMemoryFundRepository();
  const fundService = new FundService(fundRepo, impactRepo);
  const paymentRepo = new InMemoryPaymentRepository();
  const tonAdapter = new TonTestnetPaymentAdapter({
    enabled: tonEnabled,
    treasuryAddress: "ton-testnet-treasury-demo",
    provider: new MockTonTestnetPaymentProvider(tonTransactions ?? new Map()),
  });
  const paymentService = new PaymentService(paymentRepo, fundService, mode, paymentRepo, tonAdapter);
  const lotteryRepo = new InMemoryLotteryRepository();
  const lotteryService = new LotteryService(lotteryRepo, fundService, paymentService);
  return { impactRepo, fundRepo, fundService, paymentRepo, paymentService, lotteryRepo, lotteryService };
}

async function createIntent(service: PaymentService, idempotencyKey = "payment-key-0001") {
  return service.createIntent({
    userId: "demo-user",
    wallet: "solana_demo_wallet_7xDropinEarthV1",
    purpose: "lottery_entry",
    purposeId: "round_v1_ggw_demo",
    chain: "manual",
    currency: "USDC",
    amount: "1",
    idempotencyKey,
  });
}

async function createTonIntent(service: PaymentService, idempotencyKey = "ton-payment-key-0001") {
  const { intent } = await service.createIntent({
    userId: "demo-user",
    wallet: "ton_testnet_wallet_dropin_demo",
    purpose: "lottery_entry",
    purposeId: "round_v1_ggw_demo",
    chain: "ton",
    currency: "TON",
    amount: "1",
    idempotencyKey,
    metadata: { network: "testnet" },
  });
  return intent;
}

test("payment intent creation is idempotent", async () => {
  const { paymentService } = createPaymentContext();
  const first = await createIntent(paymentService);
  const second = await createIntent(paymentService);

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.intent.id, first.intent.id);
  assert.equal(second.intent.status, "awaiting_payment");
});

test("payment intent tx hash submission persists submitted status", async () => {
  const { paymentService } = createPaymentContext();
  const { intent } = await createIntent(paymentService);
  const submitted = await paymentService.submitIntent(intent.id, {
    txHash: "manual_tx_payment_submit_001",
    observedAmount: "1",
    observedCurrency: "USDC",
  });

  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.submittedTxHash, "manual_tx_payment_submit_001");
});

test("duplicate payment tx hash is rejected and creates payment risk event", async () => {
  const { paymentService, paymentRepo } = createPaymentContext();
  const first = await createIntent(paymentService, "payment-key-dup-1");
  const second = await createIntent(paymentService, "payment-key-dup-2");
  await paymentService.submitIntent(first.intent.id, { txHash: "manual_tx_duplicate_001" });

  await assert.rejects(
    () => paymentService.submitIntent(second.intent.id, { txHash: "manual_tx_duplicate_001" }),
    DuplicatePaymentTxError,
  );
  assert.equal(paymentRepo.riskEvents.size, 1);
});

test("admin confirm is idempotent, posts treasury ledger, and writes audit log", async () => {
  const { paymentService, paymentRepo, fundRepo } = createPaymentContext();
  const { intent } = await createIntent(paymentService);
  await paymentService.submitIntent(intent.id, { txHash: "manual_tx_confirm_001" });

  const confirmed = await paymentService.confirmIntent(intent.id, {
    actor: "api-admin",
    confirmedTxHash: "manual_tx_confirm_001",
    observedAmount: "1",
    observedCurrency: "USDC",
  });
  const second = await paymentService.confirmIntent(intent.id, {
    actor: "api-admin",
    confirmedTxHash: "manual_tx_confirm_001",
  });

  assert.equal(confirmed.status, "confirmed");
  assert.equal(second.id, confirmed.id);
  assert.ok(confirmed.treasuryTransactionId);
  assert.equal([...fundRepo.transactions.values()].filter((tx) => tx.sourceId === intent.id).length, 1);
  assert.equal(paymentRepo.auditLogs.filter((log) => log.action === "payment_intent.confirm").length, 1);
});

test("confirmed payment can create lottery entry", async () => {
  const { paymentService, lotteryService } = createPaymentContext();
  const { intent } = await createIntent(paymentService);
  await paymentService.submitIntent(intent.id, { txHash: "manual_tx_lotto_entry_001" });
  await paymentService.confirmIntent(intent.id, { confirmedTxHash: "manual_tx_lotto_entry_001" });

  const result = await lotteryService.enterRound("round_v1_ggw_demo", {
    userId: "demo-user",
    wallet: "solana_demo_wallet_7xDropinEarthV1",
    amount: "1",
    currency: "USDC",
    regionId: "region_ggw_sahel",
    paymentIntentId: intent.id,
    antiSybilScore: 72,
    idempotencyKey: "entry-payment-confirmed-001",
  });

  assert.equal(result.entry.paymentIntentId, intent.id);
  assert.equal(result.entry.txHash, "manual_tx_lotto_entry_001");
});

test("unconfirmed payment cannot create lottery entry", async () => {
  const { paymentService, lotteryService } = createPaymentContext();
  const { intent } = await createIntent(paymentService);

  await assert.rejects(
    () =>
      lotteryService.enterRound("round_v1_ggw_demo", {
        userId: "demo-user",
        wallet: "solana_demo_wallet_7xDropinEarthV1",
        amount: "1",
        currency: "USDC",
        regionId: "region_ggw_sahel",
        paymentIntentId: intent.id,
        antiSybilScore: 72,
        idempotencyKey: "entry-payment-unconfirmed-001",
      }),
    PaymentStateError,
  );
});

test("payment reconciliation detects stale pending intents", async () => {
  const { paymentService } = createPaymentContext();
  await paymentService.createIntent({
    userId: "demo-user",
    wallet: "solana_demo_wallet_7xDropinEarthV1",
    purpose: "lottery_entry",
    purposeId: "round_v1_ggw_demo",
    chain: "manual",
    currency: "USDC",
    amount: "1",
    idempotencyKey: "payment-key-stale-1",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });

  const report = await paymentService.reconcile({ actor: "api-admin", staleAfterMinutes: 1 });

  assert.equal(report.stalePendingCount, 1);
  assert.equal(report.status, "warnings");
});

test("payment reconciliation detects amount mismatch", async () => {
  const { paymentService } = createPaymentContext();
  const { intent } = await createIntent(paymentService, "payment-key-mismatch-1");
  await paymentService.submitIntent(intent.id, {
    txHash: "manual_tx_amount_mismatch_001",
    observedAmount: "2",
    observedCurrency: "USDC",
  });

  const report = await paymentService.reconcile({ actor: "api-admin", staleAfterMinutes: 60 });

  assert.equal(report.amountMismatchCount, 1);
  assert.equal(report.status, "warnings");
});

test("payment challenge sets payment intent status challenged", async () => {
  const { paymentService, paymentRepo, impactRepo, lotteryRepo, fundService } = createPaymentContext();
  const riskRepo = new InMemoryRiskRepository();
  const riskService = new RiskService(riskRepo, impactRepo, lotteryRepo, fundService, paymentService);
  const { intent } = await createIntent(paymentService, "payment-key-challenge-1");
  const { challenge } = await riskService.createChallenge({
    targetType: "payment_intent",
    targetId: intent.id,
    challenger: "red-team",
    severity: "high",
    title: "Duplicate payment concern",
    attackScenario: "The same transaction hash may have been reused across payment intents.",
    evidenceHash: "payment-evidence-hash",
    bondAmount: "10",
    bondCurrency: "USDC",
  });

  await riskService.acceptChallenge(challenge.id, { resolver: "api-admin", notes: "accepted" });
  const updated = await paymentRepo.getPaymentIntent(intent.id);

  assert.equal(updated?.status, "challenged");
});

test("mock payment mode preserves existing no-intent lottery entry flow", async () => {
  const { lotteryService } = createPaymentContext("mock");
  const result = await lotteryService.enterRound("round_v1_ggw_demo", {
    userId: "demo-user",
    wallet: "solana_demo_wallet_7xDropinEarthV1",
    amount: "1",
    currency: "USDC",
    regionId: "region_ggw_sahel",
    antiSybilScore: 72,
    idempotencyKey: "entry-mock-payment-001",
  });

  assert.match(result.entry.txHash ?? "", /^mock-payment-round_v1_ggw_demo/);
});

test("TON instructions generation includes recipient amount and memo", async () => {
  const { paymentService } = createPaymentContext();
  const intent = await createTonIntent(paymentService, "ton-payment-key-instructions-1");
  const instructions = await paymentService.getInstructions(intent.id);

  assert.equal(instructions.chain, "ton");
  assert.equal(instructions.network, "testnet");
  assert.equal(instructions.currency, "TON");
  assert.equal(instructions.amount, "1");
  assert.equal(instructions.recipient, "ton-testnet-treasury-demo");
  assert.match(String(instructions.memo), new RegExp(`^DROPIN:${intent.id}:payment_nonce_`));
});

test("TON adapter disabled fails closed", async () => {
  const { paymentService } = createPaymentContext("manual", new Map(), false);
  const intent = await createTonIntent(paymentService, "ton-payment-key-disabled-1");

  await assert.rejects(
    () => paymentService.verifyIntent(intent.id, { txHash: "ton_tx_disabled_001" }),
    /TON testnet adapter is disabled/,
  );
});

test("successful TON testnet verification confirms intent", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-success-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_success_001", {
    txHash: "ton_tx_success_001",
    recipient: instructions.recipient,
    amount: instructions.amount,
    currency: "TON",
    memo: instructions.memo,
    network: "testnet",
    blockTime: new Date().toISOString(),
    rawPayload: { ok: true },
  });

  const result = await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_success_001" });

  assert.equal(result.intent.status, "confirmed");
  assert.equal(result.intent.confirmedTxHash, "ton_tx_success_001");
  assert.equal(result.intent.verificationSource, "ton_testnet");
  assert.ok(result.intent.confirmedRawPayloadHash);
});

test("TON wrong recipient is rejected", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { paymentRepo, paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-wrong-recipient-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_wrong_recipient_001", {
    txHash: "ton_tx_wrong_recipient_001",
    recipient: "ton-testnet-attacker",
    amount: instructions.amount,
    currency: "TON",
    memo: instructions.memo,
    network: "testnet",
  });

  const result = await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_wrong_recipient_001" });

  assert.equal(result.intent.status, "failed");
  assert.equal(result.verification.failureReason, "wrong_recipient");
  assert.equal(paymentRepo.riskEvents.size, 1);
});

test("TON amount mismatch is rejected", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-amount-mismatch-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_amount_mismatch_001", {
    txHash: "ton_tx_amount_mismatch_001",
    recipient: instructions.recipient,
    amount: "2",
    currency: "TON",
    memo: instructions.memo,
    network: "testnet",
  });

  const result = await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_amount_mismatch_001" });

  assert.equal(result.intent.status, "failed");
  assert.equal(result.verification.failureReason, "amount_mismatch");
});

test("TON missing memo is rejected", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-missing-memo-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_missing_memo_001", {
    txHash: "ton_tx_missing_memo_001",
    recipient: instructions.recipient,
    amount: instructions.amount,
    currency: "TON",
    network: "testnet",
  });

  const result = await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_missing_memo_001" });

  assert.equal(result.intent.status, "failed");
  assert.equal(result.verification.failureReason, "missing_memo");
});

test("expired TON intent is rejected before verification", async () => {
  const { paymentService } = createPaymentContext();
  const { intent } = await paymentService.createIntent({
    userId: "demo-user",
    wallet: "ton_testnet_wallet_dropin_demo",
    purpose: "lottery_entry",
    purposeId: "round_v1_ggw_demo",
    chain: "ton",
    currency: "TON",
    amount: "1",
    idempotencyKey: "ton-payment-key-expired-1",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });

  await assert.rejects(() => paymentService.verifyIntent(intent.id, { txHash: "ton_tx_expired_001" }), PaymentStateError);
});

test("duplicate TON tx hash creates risk event", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { paymentRepo, paymentService } = createPaymentContext("manual", transactions);
  const first = await createTonIntent(paymentService, "ton-payment-key-dup-1");
  const firstInstructions = await paymentService.getInstructions(first.id);
  transactions.set("ton_tx_duplicate_001", {
    txHash: "ton_tx_duplicate_001",
    recipient: firstInstructions.recipient,
    amount: firstInstructions.amount,
    currency: "TON",
    memo: firstInstructions.memo,
    network: "testnet",
  });
  await paymentService.verifyIntent(first.id, { txHash: "ton_tx_duplicate_001" });

  const second = await createTonIntent(paymentService, "ton-payment-key-dup-2");
  await assert.rejects(() => paymentService.verifyIntent(second.id, { txHash: "ton_tx_duplicate_001" }), DuplicatePaymentTxError);
  assert.equal(paymentRepo.riskEvents.size, 1);
});

test("TON verify endpoint is idempotent", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-idempotent-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_idempotent_001", {
    txHash: "ton_tx_idempotent_001",
    recipient: instructions.recipient,
    amount: instructions.amount,
    currency: "TON",
    memo: instructions.memo,
    network: "testnet",
  });

  const first = await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_idempotent_001" });
  const second = await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_idempotent_001" });

  assert.equal(first.intent.status, "confirmed");
  assert.equal(second.idempotent, true);
  assert.equal(second.intent.id, first.intent.id);
});

test("confirmed TON intent can create lottery entry", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { lotteryService, paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-entry-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_entry_001", {
    txHash: "ton_tx_entry_001",
    recipient: instructions.recipient,
    amount: instructions.amount,
    currency: "TON",
    memo: instructions.memo,
    network: "testnet",
  });
  await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_entry_001" });

  const result = await lotteryService.enterRound("round_v1_ggw_demo", {
    userId: "demo-user",
    wallet: "ton_testnet_wallet_dropin_demo",
    amount: "1",
    currency: "TON",
    regionId: "region_ggw_sahel",
    paymentIntentId: intent.id,
    antiSybilScore: 72,
    idempotencyKey: "entry-ton-confirmed-001",
  });

  assert.equal(result.entry.paymentIntentId, intent.id);
});

test("failed TON intent cannot create lottery entry", async () => {
  const transactions = new Map<string, NormalizedTonTransaction>();
  const { lotteryService, paymentService } = createPaymentContext("manual", transactions);
  const intent = await createTonIntent(paymentService, "ton-payment-key-entry-failed-1");
  const instructions = await paymentService.getInstructions(intent.id);
  transactions.set("ton_tx_entry_failed_001", {
    txHash: "ton_tx_entry_failed_001",
    recipient: "ton-testnet-wrong",
    amount: instructions.amount,
    currency: "TON",
    memo: instructions.memo,
    network: "testnet",
  });
  await paymentService.verifyIntent(intent.id, { txHash: "ton_tx_entry_failed_001" });

  await assert.rejects(
    () =>
      lotteryService.enterRound("round_v1_ggw_demo", {
        userId: "demo-user",
        wallet: "ton_testnet_wallet_dropin_demo",
        amount: "1",
        currency: "TON",
        regionId: "region_ggw_sahel",
        paymentIntentId: intent.id,
        antiSybilScore: 72,
        idempotencyKey: "entry-ton-failed-001",
      }),
    PaymentStateError,
  );
});
