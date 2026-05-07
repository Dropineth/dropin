export class FundAllocationNotFoundError extends Error {
  constructor(allocationId: string) {
    super(`Fund allocation not found: ${allocationId}`);
  }
}

export class TreasuryTransactionNotFoundError extends Error {
  constructor(transactionId: string) {
    super(`Treasury transaction not found: ${transactionId}`);
  }
}

export class MilestoneReleaseNotFoundError extends Error {
  constructor(releaseId: string) {
    super(`Project milestone release not found: ${releaseId}`);
  }
}

export class SettlementCertificateNotFoundError extends Error {
  constructor(settlementId: string) {
    super(`Settlement certificate not found: ${settlementId}`);
  }
}

export class InvalidFundTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid fund allocation transition from ${from} to ${to}.`);
  }
}

export class SettlementRequirementError extends Error {
  constructor(message: string) {
    super(message);
  }
}
