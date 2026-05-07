export class LotteryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "LotteryError";
  }
}

export class LotteryNotFoundError extends LotteryError {
  constructor(roundId: string) {
    super(`Lottery round not found: ${roundId}`, "LOTTERY_ROUND_NOT_FOUND");
  }
}

export class InvalidLotteryTransitionError extends LotteryError {
  constructor(from: string, to: string) {
    super(`Invalid lottery round transition: ${from} -> ${to}`, "INVALID_LOTTERY_TRANSITION");
  }
}

export class LotteryEntryClosedError extends LotteryError {
  constructor(status: string) {
    super(`Lottery entries require open status. Current status: ${status}`, "LOTTERY_ENTRY_CLOSED");
  }
}

export class LotteryAlreadyFinalizedError extends LotteryError {
  constructor(roundId: string) {
    super(`Lottery round is already finalized: ${roundId}`, "LOTTERY_ALREADY_FINALIZED");
  }
}
