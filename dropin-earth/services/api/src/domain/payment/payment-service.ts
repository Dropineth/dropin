import {
  adminConfirmPaymentSchema,
  adminFailPaymentSchema,
  createPaymentIntentSchema,
  reconcilePaymentsSchema,
  submitPaymentIntentSchema,
  verifyPaymentIntentSchema,
  type LotteryRound,
  type PaymentIntent,
} from "@dropin/schemas";
import type { FundService } from "../fund/fund-service.js";
import {
  DuplicatePaymentTxError,
  PaymentIntentNotFoundError,
  PaymentMismatchError,
  PaymentModeError,
  PaymentStateError,
  PaymentVerificationError,
} from "./payment-errors.js";
import { defaultPaymentExpiry, assertPaymentTransition } from "./payment-intent.js";
import { MockPaymentAdapter, ManualPaymentAdapter, SolanaDevnetPaymentAdapter, type PaymentAdapter } from "./payment-adapter.js";
import {
  EnvTonTestnetPaymentProvider,
  TonTestnetPaymentAdapter,
  type PaymentVerificationResult,
} from "./adapters/ton-testnet-payment-adapter.js";
import type { PaymentRepository } from "./payment-repository.js";
import { reconcilePaymentIntents } from "./payment-reconciliation.js";
import { expectedPaymentRecipient } from "./stablecoin-router.js";

export type PaymentChallengeTargetRepository = Pick<PaymentService, "markPaymentIntentChallenged" | "getIntent">;

export class PaymentService {
  private readonly adapters: Record<string, PaymentAdapter>;

  constructor(
    private readonly repo: PaymentRepository,
    private readonly fundService: FundService,
    private readonly mode = process.env.DROPIN_PAYMENT_MODE ?? "manual",
    private readonly riskSink: Pick<PaymentRepository, "createRiskEvent"> = repo,
    private readonly tonTestnetAdapter = new TonTestnetPaymentAdapter({
      enabled: process.env.DROPIN_TON_TESTNET_ENABLED === "true",
      treasuryAddress: process.env.DROPIN_TON_TESTNET_TREASURY_ADDRESS,
      provider: new EnvTonTestnetPaymentProvider(process.env.DROPIN_TON_TESTNET_API_URL ?? process.env.DROPIN_TON_TESTNET_RPC_URL),
    }),
  ) {
    this.adapters = {
      mock: new MockPaymentAdapter(),
      manual: new ManualPaymentAdapter(),
      "solana-devnet": new SolanaDevnetPaymentAdapter(process.env.SOLANA_DEVNET_RPC_URL),
    };
  }

  async createIntent(input: unknown) {
    const parsed = createPaymentIntentSchema.parse(input);
    if (parsed.idempotencyKey) {
      const existing = await this.repo.getPaymentIntentByIdempotencyKey(parsed.idempotencyKey);
      if (existing) {
        return { intent: existing, idempotent: true };
      }
    }

    const created = await this.repo.createPaymentIntent({
      userId: parsed.userId,
      wallet: parsed.wallet,
      purpose: parsed.purpose,
      purposeId: parsed.purposeId,
      chain: parsed.chain,
      currency: parsed.currency,
      amount: parsed.amount,
      expectedRecipient:
        parsed.expectedRecipient ?? expectedPaymentRecipient({ chain: parsed.chain, currency: parsed.currency, purposeId: parsed.purposeId }),
      expiresAt: parsed.expiresAt ?? defaultPaymentExpiry(),
      idempotencyKey: parsed.idempotencyKey,
      metadata: parsed.metadata,
      status: "awaiting_payment",
    });
    const intent = await this.ensurePaymentInstructions(created);
    await this.repo.createPaymentEvent({
      paymentIntentId: intent.id,
      type: "intent_created",
      metadata: { purpose: intent.purpose, purposeId: intent.purposeId, mode: this.mode },
    });
    return { intent, idempotent: false };
  }

  async getIntent(paymentIntentId: string) {
    const intent = await this.repo.getPaymentIntent(paymentIntentId);
    if (!intent) {
      throw new PaymentIntentNotFoundError(paymentIntentId);
    }
    return intent;
  }

  async listIntents() {
    return this.repo.listPaymentIntents();
  }

  async getIntentDetail(paymentIntentId: string) {
    const [intent, events] = await Promise.all([this.getIntent(paymentIntentId), this.repo.listPaymentEvents(paymentIntentId)]);
    return { intent, events };
  }

  async getInstructions(paymentIntentId: string) {
    const intent = await this.ensurePaymentInstructions(await this.getIntent(paymentIntentId));
    if (intent.chain !== "ton" || intent.currency !== "TON") {
      return {
        paymentIntentId: intent.id,
        chain: intent.chain,
        currency: intent.currency,
        amount: intent.amount,
        recipient: intent.expectedRecipient,
        memo: intent.expectedMemo,
        expiresAt: intent.expiresAt,
      };
    }
    if (!this.tonTestnetAdapter.options.treasuryAddress) {
      throw new PaymentVerificationError("DROPIN_TON_TESTNET_TREASURY_ADDRESS is required for TON testnet payment instructions.");
    }
    return {
      paymentIntentId: intent.id,
      chain: "ton",
      network: "testnet",
      currency: "TON",
      amount: intent.amount,
      recipient: this.tonTestnetAdapter.options.treasuryAddress,
      memo: intent.expectedMemo,
      paymentNonce: intent.paymentNonce,
      expiresAt: intent.expiresAt,
    };
  }

  async submitIntent(paymentIntentId: string, input: unknown) {
    const intent = await this.getIntent(paymentIntentId);
    const parsed = submitPaymentIntentSchema.parse(input);
    this.assertNotExpired(intent);
    if (!["awaiting_payment", "submitted", "confirming"].includes(intent.status)) {
      throw new PaymentStateError(`Payment intent cannot submit from ${intent.status}.`);
    }
    await this.assertUniqueTxHash(parsed.txHash, paymentIntentId);
    const adapter = this.adapterFor(intent);
    const submission = await adapter.submit(intent, parsed.txHash);
    const updated = await this.repo.updatePaymentIntent({
      ...intent,
      status: "submitted",
      submittedTxHash: submission.txHash,
      metadata: {
        ...safeMetadata(intent.metadata),
        ...(parsed.observedAmount ? { observedAmount: parsed.observedAmount } : {}),
        ...(parsed.observedCurrency ? { observedCurrency: parsed.observedCurrency } : {}),
      },
    });
    await this.repo.createPaymentEvent({
      paymentIntentId,
      type: "payment_submitted",
      txHash: submission.txHash,
      metadata: { submittedBy: parsed.submittedBy, observedAmount: parsed.observedAmount, observedCurrency: parsed.observedCurrency },
    });
    return updated;
  }

  async confirmIntent(paymentIntentId: string, input: unknown) {
    const intent = await this.getIntent(paymentIntentId);
    const parsed = adminConfirmPaymentSchema.parse(input);
    if (intent.status === "confirmed" || intent.status === "reconciled") {
      return intent;
    }
    if (!["awaiting_payment", "submitted", "confirming"].includes(intent.status)) {
      throw new PaymentStateError(`Payment intent cannot confirm from ${intent.status}.`);
    }
    this.assertNotExpired(intent);
    const adapter = this.adapterFor(intent);
    const confirmation = await adapter.confirm(intent, parsed.confirmedTxHash);
    const txHash = parsed.confirmedTxHash ?? confirmation.txHash;
    await this.assertUniqueTxHash(txHash, paymentIntentId);

    const observedAmount = parsed.observedAmount ?? confirmation.amount;
    const observedCurrency = parsed.observedCurrency ?? confirmation.currency;
    if (observedAmount !== intent.amount) {
      await this.createPaymentRiskEvent(intent, "amount_mismatch", `Expected ${intent.amount}, observed ${observedAmount}`);
      throw new PaymentMismatchError(`Payment amount mismatch: expected ${intent.amount}, observed ${observedAmount}`);
    }
    if (observedCurrency !== intent.currency) {
      await this.createPaymentRiskEvent(intent, "currency_mismatch", `Expected ${intent.currency}, observed ${observedCurrency}`);
      throw new PaymentMismatchError(`Payment currency mismatch: expected ${intent.currency}, observed ${observedCurrency}`);
    }

    assertPaymentTransition(intent.status, "confirmed");
    const posted = await this.fundService.postPaymentConfirmation({
      paymentIntentId,
      purpose: intent.purpose,
      purposeId: intent.purposeId,
      amount: intent.amount,
      currency: intent.currency,
      actor: parsed.actor,
    });
    const updated = await this.repo.updatePaymentIntent({
      ...intent,
      status: "confirmed",
      submittedTxHash: intent.submittedTxHash ?? txHash,
      confirmedTxHash: txHash,
      confirmedAt: confirmation.confirmedAt,
      treasuryTransactionId: posted.id,
      metadata: {
        ...safeMetadata(intent.metadata),
        observedAmount,
        observedCurrency,
        ...(parsed.notes ? { confirmationNotes: parsed.notes } : {}),
      },
    });
    await this.repo.createPaymentEvent({
      paymentIntentId,
      type: "payment_confirmed",
      txHash,
      metadata: { actor: parsed.actor, treasuryTransactionId: posted.id },
    });
    await this.repo.createAuditLog({
      actor: parsed.actor,
      action: "payment_intent.confirm",
      entityType: "payment_intent",
      entityId: paymentIntentId,
      beforeState: intent,
      afterState: updated,
    });
    return updated;
  }

  async verifyIntent(paymentIntentId: string, input: unknown) {
    let intent = await this.ensurePaymentInstructions(await this.getIntent(paymentIntentId));
    const parsed = verifyPaymentIntentSchema.parse(input);
    if (intent.status === "confirmed" || intent.status === "reconciled") {
      if (intent.confirmedTxHash === parsed.txHash || intent.submittedTxHash === parsed.txHash) {
        return {
          intent,
          verification: {
            status: "confirmed",
            confirmedTxHash: intent.confirmedTxHash,
            confirmedAmount: intent.amount,
            confirmedCurrency: intent.currency,
            confirmedRecipient: intent.expectedRecipient,
            confirmedMemo: intent.expectedMemo,
            confirmedBlockTime: intent.confirmedBlockTime,
            rawPayloadHash: intent.confirmedRawPayloadHash,
          } satisfies PaymentVerificationResult,
          idempotent: true,
        };
      }
      await this.assertUniqueTxHash(parsed.txHash, paymentIntentId);
      throw new PaymentStateError(`Payment intent already confirmed with a different transaction hash.`);
    }
    if (!["awaiting_payment", "submitted", "confirming"].includes(intent.status)) {
      throw new PaymentStateError(`Payment intent cannot verify from ${intent.status}.`);
    }
    this.assertNotExpired(intent);
    await this.assertUniqueTxHash(parsed.txHash, paymentIntentId);

    if (intent.submittedTxHash !== parsed.txHash || intent.status === "awaiting_payment") {
      intent = await this.repo.updatePaymentIntent({
        ...intent,
        status: "submitted",
        submittedTxHash: parsed.txHash,
      });
      await this.repo.createPaymentEvent({
        paymentIntentId,
        type: "payment_submitted",
        txHash: parsed.txHash,
        metadata: { submittedBy: parsed.actor, source: "verify_endpoint" },
      });
    }

    const verification = await this.tonTestnetAdapter.verifyPaymentIntent(intent, parsed.txHash);
    if (verification.status === "pending") {
      const pending = await this.repo.updatePaymentIntent({
        ...intent,
        status: "confirming",
        metadata: {
          ...safeMetadata(intent.metadata),
          verificationStatus: "pending",
          failureReason: verification.failureReason,
        },
      });
      await this.repo.createPaymentEvent({
        paymentIntentId,
        type: "payment_verified",
        txHash: parsed.txHash,
        metadata: { status: "pending", failureReason: verification.failureReason },
      });
      return { intent: pending, verification, idempotent: false };
    }

    const observedMetadata = {
      observedAmount: verification.confirmedAmount,
      observedCurrency: verification.confirmedCurrency,
      observedRecipient: verification.confirmedRecipient,
      observedMemo: verification.confirmedMemo,
      observedNetwork: "testnet",
      rawPayloadHash: verification.rawPayloadHash,
      verificationSource: this.tonTestnetAdapter.name,
    };

    if (verification.status === "failed") {
      const failed = await this.repo.updatePaymentIntent({
        ...intent,
        status: "failed",
        metadata: {
          ...safeMetadata(intent.metadata),
          ...observedMetadata,
          failureReason: verification.failureReason,
        },
      });
      await this.createPaymentRiskEvent(intent, verification.failureReason ?? "payment_verification_failed", "TON testnet verification failed");
      await this.repo.createPaymentEvent({
        paymentIntentId,
        type: "payment_failed",
        txHash: parsed.txHash,
        metadata: { ...observedMetadata, failureReason: verification.failureReason },
      });
      return { intent: failed, verification, idempotent: false };
    }

    const posted = await this.fundService.postPaymentConfirmation({
      paymentIntentId,
      purpose: intent.purpose,
      purposeId: intent.purposeId,
      amount: intent.amount,
      currency: intent.currency,
      actor: parsed.actor,
    });
    const confirmed = await this.repo.updatePaymentIntent({
      ...intent,
      status: "confirmed",
      submittedTxHash: parsed.txHash,
      confirmedTxHash: verification.confirmedTxHash ?? parsed.txHash,
      confirmedAt: new Date().toISOString(),
      confirmedBlockTime: verification.confirmedBlockTime,
      confirmedRawPayloadHash: verification.rawPayloadHash,
      verificationSource: this.tonTestnetAdapter.name,
      treasuryTransactionId: posted.id,
      metadata: {
        ...safeMetadata(intent.metadata),
        ...observedMetadata,
      },
    });
    await this.repo.createPaymentEvent({
      paymentIntentId,
      type: "payment_verified",
      txHash: parsed.txHash,
      metadata: { status: "confirmed", ...observedMetadata },
    });
    await this.repo.createPaymentEvent({
      paymentIntentId,
      type: "payment_confirmed",
      txHash: parsed.txHash,
      metadata: { actor: parsed.actor, treasuryTransactionId: posted.id, verificationSource: this.tonTestnetAdapter.name },
    });
    return { intent: confirmed, verification, idempotent: false };
  }

  async failIntent(paymentIntentId: string, input: unknown) {
    const intent = await this.getIntent(paymentIntentId);
    const parsed = adminFailPaymentSchema.parse(input);
    assertPaymentTransition(intent.status, "failed");
    const updated = await this.repo.updatePaymentIntent({
      ...intent,
      status: "failed",
      metadata: { ...safeMetadata(intent.metadata), failureReason: parsed.reason },
    });
    await this.repo.createPaymentEvent({
      paymentIntentId,
      type: "payment_failed",
      metadata: { actor: parsed.actor, reason: parsed.reason },
    });
    await this.repo.createAuditLog({
      actor: parsed.actor,
      action: "payment_intent.fail",
      entityType: "payment_intent",
      entityId: paymentIntentId,
      beforeState: intent,
      afterState: updated,
    });
    return updated;
  }

  async reconcile(input: unknown) {
    const parsed = reconcilePaymentsSchema.parse(input);
    const intents = await this.repo.listPaymentIntents();
    const report = reconcilePaymentIntents({
      intents,
      now: this.repo.now(),
      staleAfterMinutes: parsed.staleAfterMinutes,
      makeId: (prefix) => this.repo.makeId(prefix),
    });
    const created = await this.repo.createReconciliationReport(report);
    const anomalies = report.anomalies as Array<{ paymentIntentId: string; type: string }>;
    for (const anomaly of anomalies) {
      await this.createPaymentRiskEvent(
        await this.getIntent(anomaly.paymentIntentId),
        anomaly.type,
        `${anomaly.type} detected during payment reconciliation`,
      );
    }
    await this.repo.createAuditLog({
      actor: parsed.actor,
      action: "payment.reconcile",
      entityType: "payment_reconciliation_report",
      entityId: created.id,
      afterState: created,
    });
    return created;
  }

  async listReconciliationReports() {
    return this.repo.listReconciliationReports();
  }

  async assertLotteryPayment(round: LotteryRound, input: { paymentIntentId?: string | undefined; amount: string; currency: string; wallet: string; userId: string }) {
    if (!input.paymentIntentId) {
      if (this.mode === "mock") {
        return { txHash: `mock-payment-${round.id}-${input.wallet}`, paymentIntentId: undefined };
      }
      throw new PaymentModeError();
    }
    const intent = await this.getIntent(input.paymentIntentId);
    if (intent.status !== "confirmed" && intent.status !== "reconciled") {
      throw new PaymentStateError(`Payment intent must be confirmed before lottery entry. Current status: ${intent.status}.`);
    }
    if (intent.purpose !== "lottery_entry" || intent.purposeId !== round.id) {
      throw new PaymentMismatchError("Payment intent purpose does not match this lottery round.");
    }
    if (intent.amount !== input.amount || intent.currency !== input.currency) {
      throw new PaymentMismatchError("Payment intent amount or currency does not match lottery entry.");
    }
    if (intent.wallet !== input.wallet || intent.userId !== input.userId) {
      throw new PaymentMismatchError("Payment intent wallet or user does not match lottery entry.");
    }
    return { txHash: intent.confirmedTxHash ?? intent.submittedTxHash ?? intent.id, paymentIntentId: intent.id };
  }

  async markPaymentIntentChallenged(paymentIntentId: string) {
    const intent = await this.getIntent(paymentIntentId);
    const updated = await this.repo.updatePaymentIntent({ ...intent, status: "challenged" });
    await this.repo.createPaymentEvent({
      paymentIntentId,
      type: "payment_challenged",
      metadata: { source: "challenge" },
    });
    return updated;
  }

  private adapterFor(intent: PaymentIntent): PaymentAdapter {
    if (this.mode === "mock") {
      return this.adapters.mock ?? new MockPaymentAdapter();
    }
    if (intent.chain === "solana") {
      return this.adapters["solana-devnet"] ?? new SolanaDevnetPaymentAdapter(process.env.SOLANA_DEVNET_RPC_URL);
    }
    if (intent.chain === "manual") {
      return this.adapters.manual ?? new ManualPaymentAdapter();
    }
    return this.adapters.mock ?? new MockPaymentAdapter();
  }

  private async ensurePaymentInstructions(intent: PaymentIntent) {
    if (intent.chain !== "ton" || intent.currency !== "TON") {
      return intent;
    }
    if (intent.paymentNonce && intent.expectedMemo) {
      return intent;
    }
    const paymentNonce = intent.paymentNonce ?? this.repo.makeId("payment_nonce");
    return this.repo.updatePaymentIntent({
      ...intent,
      expectedRecipient: this.tonTestnetAdapter.options.treasuryAddress ?? intent.expectedRecipient,
      paymentNonce,
      expectedMemo: `DROPIN:${intent.id}:${paymentNonce}`,
      metadata: {
        ...safeMetadata(intent.metadata),
        network: "testnet",
        adapter: "ton_testnet",
      },
    });
  }

  private assertNotExpired(intent: PaymentIntent) {
    if (new Date(intent.expiresAt).getTime() < Date.now()) {
      throw new PaymentStateError(`Payment intent expired: ${intent.id}`);
    }
  }

  private async assertUniqueTxHash(txHash: string, paymentIntentId: string) {
    const duplicate = await this.repo.findPaymentIntentByTxHash(txHash, paymentIntentId);
    if (duplicate) {
      await this.createPaymentRiskEvent(duplicate, "duplicate_tx", `Duplicate transaction hash: ${txHash}`);
      throw new DuplicatePaymentTxError(txHash);
    }
  }

  private async createPaymentRiskEvent(intent: PaymentIntent, code: string, message: string) {
    await this.riskSink.createRiskEvent({
      subjectType: "payment_intent",
      subjectId: intent.id,
      riskLevel: "high",
      score: 0.2,
      recommendedAction: "manual_review",
      reasonCodes: [code, message],
      status: "open",
    });
    await this.repo.createPaymentEvent({
      paymentIntentId: intent.id,
      type: "anomaly_detected",
      metadata: { code, message },
    });
  }
}

function safeMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}
