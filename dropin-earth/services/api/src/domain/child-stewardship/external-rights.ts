/** No network, credentials, environment switches, or real execution provider.
 * This module must not be interpreted as a simulated successful transaction.
 */
export class ChildExternalRightsUnavailable extends Error {
  readonly code = "CHILD_EXTERNAL_RIGHTS_UNAVAILABLE";
  constructor() {
    super("Real funds, carbon transfers and external rights verification are unavailable.");
    this.name = "ChildExternalRightsUnavailable";
  }
}

export function executeChildRealFundsTransfer(): never {
  throw new ChildExternalRightsUnavailable();
}

export function executeChildRealCarbonTransfer(): never {
  throw new ChildExternalRightsUnavailable();
}

export function verifyChildExternalLegalEntitlement(): never {
  throw new ChildExternalRightsUnavailable();
}
