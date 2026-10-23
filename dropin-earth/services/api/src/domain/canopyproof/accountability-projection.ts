import { verifyProjectionTransport, type ProjectionKeyAuthority } from "@dropin/crypto";

/** A signed protocol record is evidence about a decision, not authority to mutate product ledgers. */
export async function projectAccountabilityEvidence(
  input: Parameters<typeof verifyProjectionTransport>[0],
  authority: ProjectionKeyAuthority | undefined,
  clock: () => number = Date.now,
) {
  const verified = await verifyProjectionTransport(input, authority, clock);
  return Object.freeze({
    reference: verified.recordHash,
    scope: "authenticated-external-record" as const,
    transportSignatureVerified: true as const,
    observation: "unassessed" as const,
    contribution: "not-awarded" as const,
    entitlement: "not-conferred" as const,
    funding: "not-authorized" as const,
  });
}

/** All four mutations need their own current, operation-bound product authorization. */
export function authorizeLedgerMutationFromProjection(_projection: unknown, _operation: unknown): never {
  void _projection;
  void _operation;
  throw new Error("PROJECTION_CANNOT_AUTHORIZE_LEDGER_MUTATION");
}
