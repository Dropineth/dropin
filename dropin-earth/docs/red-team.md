# Red Team

Red Team is a product layer, not only an audit process.

```text
Attack before launch.
Break before market.
Prove before scale.
```

Challenge targets:

- Lottery Round.
- Campaign.
- Randomness Certificate.
- Prize Distribution.
- Drop Result.
- Project.
- Project Funding.
- Fund Allocation.
- Treasury Transaction.
- Settlement Certificate.
- Payment Intent.
- Evidence Object.
- Impact Certificate.
- Carbon Estimate.
- RWA Fragment.
- Validator Attestation.
- Robot Mission.
- Round Anchor.
- Impact Anchor.

## Phase 6 Operational Flow

```text
Submit Challenge
→ Lock Challenge Bond
→ Add Challenge Evidence
→ Admin / Red Team Accept or Reject
→ Target enters challenged state when applicable
→ Resolution and audit log are written
```

Accepted challenge target behavior:

- `impact_certificate` sets certificate status to `challenged`.
- `evidence_object` sets evidence status to `challenged`.
- `rwa_fragment` sets fragment status to `challenged`.
- `lottery_round` sets round status to `challenged`.
- `project` sets project status to `challenged`.
- `round_anchor` and `impact_anchor` record the Solana revoke TODO hook for signer wiring.
- `fund_allocation` sets allocation status to `challenged`.
- `treasury_transaction` sets ledger transaction status to `challenged`.
- `settlement_certificate` sets settlement status to `challenged`.
- `payment_intent` sets payment intent status to `challenged`.

## Risk Gate

High-value claims pass through deterministic V1 anti-sybil scoring. Inputs include wallet age,
entry count, contribution amount, prior claims, rejected challenge history, and accepted
evidence history. The policy returns `allow`, `delay`, `manual_review`, or `block`.

```text
Common Drop       → auto claim if not blocked
Rare Drop         → score threshold
Epic Drop         → delayed or manual review below threshold
Legendary Drop    → manual review
RWA Fragment      → manual review below threshold
Qualified Yield   → disabled in V1
```

## Treasury / Fund Red-Team Rules

```text
No ledger entry, no fund action.
No accepted evidence, no milestone settlement.
No issued Impact Certificate, no final settlement.
No mutation of posted amounts.
No raw user-submitted txHash as lottery entry proof.
No real payment rail in Phase 8.
```

Challenge reviewers can challenge allocations, ledger transactions, and settlement
certificates before they become trusted operational history.

Payment reconciliation creates risk events for duplicate tx hashes, amount mismatch,
currency mismatch, and stale pending intents. These anomalies must be resolved before
payment evidence becomes trusted operating history.

## Campaign Growth Red-Team Rules

```text
No automatic $CANOPY distribution from campaign actions.
No transferable Leaf Points.
No referral points for suspicious claims.
No campaign finalization without a public report.
No campaign admin mutation without audit log.
```

Campaign and referral abuse must create risk events when detected. The Phase 11 policy
keeps low-friction Co-Plant sharing, but every valid reward is idempotent by
`userId + sourceType + sourceId`, and suspicious referrals receive zero Leaf Points.

Launch gate:

```text
Critical = 0
High = 0 or accepted with formal mitigation
Medium = tracked
Low = backlog
```

## Public Testnet Challenge Guide

Phase 13 exposes `/red-team` for external testers. The guide explains:

```text
what can be challenged
how to submit a challenge
evidence examples
what happens after review
testnet-only Leaf Points recognition placeholder
```

The public guide links to `/challenges`. Recognition remains non-transferable Leaf Points
only. There is no automatic `$CANOPY` distribution, no certified carbon credit claim, no
guaranteed yield claim, and no carbon tax offset claim.

## Premium UI Boundary

The climate-impact lottery UI must keep red-team access visible. Public pool and campaign
pages should link to `/red-team` or `/challenges`, and proof sections should show challenge
state alongside roots, evidence, and certificate status.

Do not use casino language or animations. Drawing states should be presented as proof
progress:

```text
Entries frozen
Randomness certificate generated
Winners computed
Drop roots computed
Fund allocation created
Proof anchor pending/complete
```
