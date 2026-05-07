import type { PaymentIntent } from "@dropin/schemas";
import { PaymentStateError } from "./payment-errors.js";

const transitions: Record<PaymentIntent["status"], PaymentIntent["status"][]> = {
  created: ["awaiting_payment", "expired", "failed", "challenged"],
  awaiting_payment: ["submitted", "confirming", "confirmed", "expired", "failed", "challenged"],
  submitted: ["confirming", "confirmed", "failed", "expired", "challenged"],
  confirming: ["confirmed", "failed", "expired", "challenged"],
  confirmed: ["reconciled", "refunded", "challenged"],
  reconciled: ["challenged", "refunded"],
  expired: ["challenged"],
  failed: ["challenged"],
  refunded: ["challenged"],
  challenged: [],
};

export function assertPaymentTransition(from: PaymentIntent["status"], to: PaymentIntent["status"]) {
  if (from === to) {
    return;
  }
  if (!transitions[from].includes(to)) {
    throw new PaymentStateError(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export function defaultPaymentExpiry(now = Date.now()) {
  return new Date(now + 30 * 60 * 1000).toISOString();
}
