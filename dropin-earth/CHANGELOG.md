# Changelog

## v0.15.0-testnet-campaign - 2026-05-08

Public Testnet Launch Candidate for the Dropin Earth Great Green Wall Testnet Campaign.

### Launch Decision

```text
GO, with testnet-only constraints.
```

### Included

- Production monorepo for Web, Admin, API, Mini App, packages, contracts, docs, and scripts.
- Tree Lotto with deterministic randomness, winner roots, drop roots, and Earth Response.
- Payment Intent layer with mock/manual flow and TON testnet verification adapter.
- Treasury / Fund Engine with append-only internal ledger and milestone settlement.
- Impact Ledger with evidence hashing, Impact Certificate viewer, challenge hook, and safety copy.
- Solana Anchor proof layer for round roots, impact certificate roots, Merkle claims, and revoke paths.
- Risk Engine, Challenge Board, claim gating, and red-team challenge guide.
- Public Testnet Campaign / Growth Loop with non-transferable Leaf Points and campaign report.
- Launch readiness, metrics, feedback, operator dry run, failure injection, incident runbook, and GO decision record.
- Premium mobile-first climate-impact lottery UI using the 70/20/10 public allocation model.

### Validation

```text
npm run ci: PASS
unit tests: 112/112 passed
npm audit --audit-level=moderate: 0 vulnerabilities
npm run anchor:test: PASS, 9/9 passed
npm run dry-run:operator: PASS
npm run dry-run:failure: PASS
/ready: pass:true
```

### Testnet-Only Constraints

```text
No mainnet funds.
No private keys.
No real-money transfer execution.
No automatic $CANOPY distribution.
Leaf Points are non-transferable testnet points.
Impact Certificate is not a certified carbon credit.
RWA Fragment is not guaranteed yield.
$CANOPY does not offset carbon tax.
```
