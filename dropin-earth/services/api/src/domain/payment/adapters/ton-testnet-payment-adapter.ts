import { hashJson } from "@dropin/crypto";
import type { PaymentIntent } from "@dropin/schemas";
import { PaymentVerificationError } from "../payment-errors.js";

export type NormalizedTonTransaction = {
  txHash: string;
  recipient: string;
  amount: string;
  currency: "TON";
  memo?: string | undefined;
  network: "testnet" | "mainnet" | string;
  blockTime?: string | undefined;
  rawPayload?: unknown;
};

export type PaymentVerificationResult = {
  status: "confirmed" | "failed" | "pending";
  confirmedTxHash?: string | undefined;
  confirmedAmount?: string | undefined;
  confirmedCurrency?: PaymentIntent["currency"] | undefined;
  confirmedRecipient?: string | undefined;
  confirmedMemo?: string | undefined;
  confirmedBlockTime?: string | undefined;
  rawPayloadHash?: string | undefined;
  failureReason?: string | undefined;
};

export interface TonTestnetPaymentProvider {
  getTransaction(txHash: string): Promise<NormalizedTonTransaction | undefined>;
}

export class TonTestnetPaymentAdapter {
  readonly name = "ton_testnet";

  constructor(
    readonly options: {
      enabled: boolean;
      treasuryAddress?: string | undefined;
      provider?: TonTestnetPaymentProvider | undefined;
    },
  ) {}

  async verifyPaymentIntent(intent: PaymentIntent, submittedTxHash: string): Promise<PaymentVerificationResult> {
    if (!this.options.enabled) {
      throw new PaymentVerificationError("TON testnet adapter is disabled. Set DROPIN_TON_TESTNET_ENABLED=true.");
    }
    if (!this.options.treasuryAddress) {
      throw new PaymentVerificationError("TON testnet treasury address is not configured.");
    }
    if (!this.options.provider) {
      throw new PaymentVerificationError("TON testnet RPC/API provider is unavailable.");
    }
    if (intent.chain !== "ton" || intent.currency !== "TON") {
      throw new PaymentVerificationError("TON testnet verification requires a TON payment intent.");
    }

    const transaction = await this.options.provider.getTransaction(submittedTxHash);
    if (!transaction) {
      return { status: "pending", failureReason: "transaction_not_found" };
    }

    const rawPayloadHash = hashJson({
      kind: "dropin-ton-testnet-payment-v1",
      transaction,
    });
    const base = {
      confirmedTxHash: transaction.txHash,
      confirmedAmount: transaction.amount,
      confirmedCurrency: transaction.currency,
      confirmedRecipient: transaction.recipient,
      confirmedMemo: transaction.memo,
      confirmedBlockTime: transaction.blockTime,
      rawPayloadHash,
    } satisfies Omit<PaymentVerificationResult, "status" | "failureReason">;

    if (transaction.network !== "testnet") {
      return { ...base, status: "failed", failureReason: "wrong_network" };
    }
    if (transaction.recipient !== intent.expectedRecipient) {
      return { ...base, status: "failed", failureReason: "wrong_recipient" };
    }
    if (transaction.amount !== intent.amount) {
      return { ...base, status: "failed", failureReason: "amount_mismatch" };
    }
    if (transaction.currency !== intent.currency) {
      return { ...base, status: "failed", failureReason: "currency_mismatch" };
    }
    if (!transaction.memo || transaction.memo !== intent.expectedMemo) {
      return { ...base, status: "failed", failureReason: "missing_memo" };
    }

    return { ...base, status: "confirmed" };
  }
}

export class EnvTonTestnetPaymentProvider implements TonTestnetPaymentProvider {
  constructor(readonly endpoint?: string | undefined) {}

  async getTransaction(txHash: string): Promise<NormalizedTonTransaction | undefined> {
    if (!this.endpoint) {
      throw new PaymentVerificationError("TON testnet RPC/API endpoint is unavailable.");
    }
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/transactions/${encodeURIComponent(txHash)}`);
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new PaymentVerificationError(`TON testnet RPC/API request failed: ${response.status}`);
    }
    const payload = (await response.json()) as Partial<NormalizedTonTransaction>;
    if (!payload.txHash || !payload.recipient || !payload.amount || !payload.currency || !payload.network) {
      throw new PaymentVerificationError("TON testnet RPC/API returned an invalid transaction payload.");
    }
    return {
      txHash: payload.txHash,
      recipient: payload.recipient,
      amount: payload.amount,
      currency: "TON",
      memo: payload.memo,
      network: payload.network,
      blockTime: payload.blockTime,
      rawPayload: payload.rawPayload ?? payload,
    };
  }
}

export class MockTonTestnetPaymentProvider implements TonTestnetPaymentProvider {
  constructor(readonly transactions = new Map<string, NormalizedTonTransaction>()) {}

  async getTransaction(txHash: string) {
    return this.transactions.get(txHash);
  }
}
