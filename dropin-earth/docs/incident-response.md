# Incident Response

Dropin Earth testnet incidents should be handled through proof, auditability, challenge,
and reversible operational state. This document covers public testnet readiness only.

## Severity

```text
Critical: funds, proof roots, payment confirmation, or certificate integrity may be wrong
High: public users can be misled or high-value claims can bypass review
Medium: operational queue, stale payment, or UX issue affects launch quality
Low: cosmetic, copy, or local-only issue
```

## Immediate Actions

1. Stop public promotion.
2. Capture `/status/system`, `/admin/launch/readiness`, and `/metrics`.
3. Create or accept a challenge for the affected object where possible.
4. Resolve or mark the target as challenged before trust is finalized.
5. Record an admin launch check after mitigation.
6. Re-run `npm run dry-run:operator` and `npm run dry-run:failure` after mitigation.

## Payment Incidents

For duplicate transaction hashes, wrong recipients, amount mismatches, missing memo, wrong
network, or stale submitted transactions:

```text
1. Do not create a lottery entry from an unconfirmed Payment Intent.
2. Run reconciliation.
3. Create or verify the risk event.
4. Fail or challenge the Payment Intent if needed.
```

## Proof / Certificate Incidents

Impact Certificates are not certified carbon credits. If evidence, certificate hash, or
anchor state is suspect:

```text
1. Submit challenge.
2. Mark evidence or certificate challenged.
3. Use Solana revoke hook for anchored objects when needed.
4. Publish a corrected status through the campaign report.
```

## Communications Boundary

Never state:

```text
Impact Certificate = carbon credit
RWA Fragment = guaranteed yield
$CANOPY = carbon tax offset
```

Use:

```text
Impact Certificate is proof of reviewed impact evidence.
RWA Fragment is gated and non-yielding in V1 unless future compliance permits otherwise.
Leaf Points are non-transferable testnet growth points only.
```

## Failure Injection Reference

Run failure injection in dry-run mode when validating a mitigation:

```bash
npm run dry-run:failure
```

It checks expected detection paths for duplicate tx hash, wrong recipient, expired intent,
suspicious referral, fake evidence challenge, open high-risk event, and readiness failure.
