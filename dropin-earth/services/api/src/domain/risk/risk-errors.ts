export class RiskEventNotFoundError extends Error {
  constructor(riskEventId: string) {
    super(`Risk event not found: ${riskEventId}`);
  }
}

export class ChallengeNotFoundError extends Error {
  constructor(challengeId: string) {
    super(`Challenge not found: ${challengeId}`);
  }
}

export class DropNotFoundError extends Error {
  constructor(dropId: string) {
    super(`Drop result not found: ${dropId}`);
  }
}

export class RwaFragmentNotFoundError extends Error {
  constructor(fragmentId: string) {
    super(`RWA fragment not found: ${fragmentId}`);
  }
}
