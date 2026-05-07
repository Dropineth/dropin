import type { PaymentIntent } from "@dropin/schemas";

export type PaymentAdapterConfirmation = {
  txHash: string;
  amount: string;
  currency: PaymentIntent["currency"];
  confirmedAt: string;
};

export interface PaymentAdapter {
  readonly name: string;
  submit(intent: PaymentIntent, txHash: string): Promise<{ txHash: string }>;
  confirm(intent: PaymentIntent, txHash?: string): Promise<PaymentAdapterConfirmation>;
}

export class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock";

  async submit(_intent: PaymentIntent, txHash: string) {
    return { txHash };
  }

  async confirm(intent: PaymentIntent, txHash?: string) {
    return {
      txHash: txHash ?? intent.submittedTxHash ?? `mock-${intent.id}`,
      amount: intent.amount,
      currency: intent.currency,
      confirmedAt: new Date().toISOString(),
    };
  }
}

export class ManualPaymentAdapter implements PaymentAdapter {
  readonly name = "manual";

  async submit(_intent: PaymentIntent, txHash: string) {
    return { txHash };
  }

  async confirm(intent: PaymentIntent, txHash?: string) {
    return {
      txHash: txHash ?? intent.submittedTxHash ?? `manual-${intent.id}`,
      amount: intent.amount,
      currency: intent.currency,
      confirmedAt: new Date().toISOString(),
    };
  }
}

export class SolanaDevnetPaymentAdapter implements PaymentAdapter {
  readonly name = "solana-devnet";

  constructor(readonly rpcUrl?: string | undefined) {}

  async submit(_intent: PaymentIntent, txHash: string) {
    return { txHash };
  }

  async confirm(intent: PaymentIntent, txHash?: string) {
    // Phase 8 deliberately does not execute live transfer checks. The RPC URL is
    // reserved for a later verified devnet adapter.
    void this.rpcUrl;
    return {
      txHash: txHash ?? intent.submittedTxHash ?? `solana-devnet-${intent.id}`,
      amount: intent.amount,
      currency: intent.currency,
      confirmedAt: new Date().toISOString(),
    };
  }
}
