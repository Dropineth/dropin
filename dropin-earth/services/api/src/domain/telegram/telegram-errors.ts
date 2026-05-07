export class TelegramAuthError extends Error {
  constructor(message = "Telegram authentication failed.") {
    super(message);
  }
}

export class TelegramAccountNotFoundError extends Error {
  constructor(subject: string) {
    super(`Telegram account not found: ${subject}`);
  }
}

export class ReferralCodeNotFoundError extends Error {
  constructor(code: string) {
    super(`Referral code not found: ${code}`);
  }
}
