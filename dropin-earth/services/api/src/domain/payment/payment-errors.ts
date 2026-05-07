export class PaymentIntentNotFoundError extends Error {
  constructor(paymentIntentId: string) {
    super(`Payment intent not found: ${paymentIntentId}`);
  }
}

export class PaymentStateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicatePaymentTxError extends Error {
  constructor(txHash: string) {
    super(`Payment transaction hash already exists: ${txHash}`);
  }
}

export class PaymentMismatchError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class PaymentModeError extends Error {
  constructor() {
    super("Payment intent is required unless DROPIN_PAYMENT_MODE=mock.");
  }
}

export class PaymentVerificationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
