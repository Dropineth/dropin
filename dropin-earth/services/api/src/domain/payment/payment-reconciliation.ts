import type { PaymentIntent, PaymentReconciliationReport } from "@dropin/schemas";

export type PaymentAnomaly = {
  type:
    | "duplicate_tx_hash"
    | "wrong_recipient"
    | "amount_mismatch"
    | "currency_mismatch"
    | "missing_memo"
    | "expired_intent"
    | "wrong_network"
    | "stale_pending"
    | "stale_submitted_tx";
  paymentIntentId: string;
  txHash?: string | undefined;
  expected?: string | undefined;
  observed?: string | undefined;
};

export function reconcilePaymentIntents(input: {
  intents: PaymentIntent[];
  now: string;
  staleAfterMinutes: number;
  makeId: (prefix: string) => string;
}): Omit<PaymentReconciliationReport, "createdAt"> {
  const nowMs = new Date(input.now).getTime();
  const txMap = new Map<string, PaymentIntent[]>();
  for (const intent of input.intents) {
    const txHash = intent.confirmedTxHash ?? intent.submittedTxHash;
    if (!txHash) {
      continue;
    }
    txMap.set(txHash, [...(txMap.get(txHash) ?? []), intent]);
  }

  const anomalies: PaymentAnomaly[] = [];
  for (const [txHash, intents] of txMap.entries()) {
    if (intents.length > 1) {
      for (const intent of intents) {
        anomalies.push({ type: "duplicate_tx_hash", paymentIntentId: intent.id, txHash });
      }
    }
  }

  for (const intent of input.intents) {
    const observedAmount = metadataString(intent.metadata, "observedAmount");
    const observedCurrency = metadataString(intent.metadata, "observedCurrency");
    if (observedAmount !== undefined && observedAmount !== intent.amount) {
      anomalies.push({
        type: "amount_mismatch",
        paymentIntentId: intent.id,
        expected: intent.amount,
        observed: observedAmount,
      });
    }
    if (observedCurrency !== undefined && observedCurrency !== intent.currency) {
      anomalies.push({
        type: "currency_mismatch",
        paymentIntentId: intent.id,
        expected: intent.currency,
        observed: observedCurrency,
      });
    }
    const observedRecipient = metadataString(intent.metadata, "observedRecipient");
    if (observedRecipient !== undefined && observedRecipient !== intent.expectedRecipient) {
      anomalies.push({
        type: "wrong_recipient",
        paymentIntentId: intent.id,
        expected: intent.expectedRecipient,
        observed: observedRecipient,
      });
    }
    const observedMemo = metadataString(intent.metadata, "observedMemo");
    if (intent.expectedMemo && intent.submittedTxHash && observedMemo !== intent.expectedMemo) {
      anomalies.push({
        type: "missing_memo",
        paymentIntentId: intent.id,
        expected: intent.expectedMemo,
        observed: observedMemo,
      });
    }
    const observedNetwork = metadataString(intent.metadata, "observedNetwork");
    if (intent.chain === "ton" && observedNetwork !== undefined && observedNetwork !== "testnet") {
      anomalies.push({
        type: "wrong_network",
        paymentIntentId: intent.id,
        expected: "testnet",
        observed: observedNetwork,
      });
    }
    const staleStatuses: PaymentIntent["status"][] = ["created", "awaiting_payment", "submitted", "confirming"];
    if (staleStatuses.includes(intent.status)) {
      const expiresAt = new Date(intent.expiresAt).getTime();
      const staleCutoff = nowMs - input.staleAfterMinutes * 60 * 1000;
      if (expiresAt < nowMs) {
        anomalies.push({ type: "expired_intent", paymentIntentId: intent.id });
      }
      if (new Date(intent.updatedAt).getTime() < staleCutoff) {
        anomalies.push({ type: "stale_pending", paymentIntentId: intent.id });
      }
      if (["submitted", "confirming"].includes(intent.status) && new Date(intent.updatedAt).getTime() < staleCutoff) {
        anomalies.push({ type: "stale_submitted_tx", paymentIntentId: intent.id, txHash: intent.submittedTxHash });
      }
    }
  }

  const duplicateTxCount = anomalies.filter((item) => item.type === "duplicate_tx_hash").length;
  const amountMismatchCount = anomalies.filter((item) => item.type === "amount_mismatch").length;
  const currencyMismatchCount = anomalies.filter((item) => item.type === "currency_mismatch").length;
  const stalePendingCount = anomalies.filter((item) => item.type === "stale_pending" || item.type === "expired_intent").length;
  const status = anomalies.length === 0 ? "clean" : "warnings";

  return {
    id: input.makeId("payment_reconciliation"),
    status,
    checkedIntentCount: input.intents.length,
    duplicateTxCount,
    amountMismatchCount,
    currencyMismatchCount,
    stalePendingCount,
    anomalies,
  };
}

export function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
