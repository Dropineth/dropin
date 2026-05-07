# Treasury / Fund Engine

Phase 7 adds an internal ledger and milestone settlement state machine. It intentionally does
not connect real payment rails.

## Accounts

```text
payment_clearing
prize_pool
tree_planting_fund
operations
insurance_challenge_pool
referral_growth
protocol_reserve
round_escrow
project_escrow
```

`round_escrow` and `project_escrow` are placeholders for internal accounting. They are not
bank accounts, smart-contract vaults, or money transmitters.

## Transaction Types

```text
payment_confirmation
lottery_allocation
sponsor_allocation
admin_adjustment
milestone_release
milestone_settlement
challenge_freeze
challenge_release
revoke_reversal
```

Every transaction has:

```text
debitAccountId
creditAccountId
amount
currency
sourceType
sourceId
status
```

Posted records are append-only. Reversals create a new `revoke_reversal` transaction and
never mutate the posted transaction amount.

## Allocation State

```text
created
→ allocated
→ pending_approval
→ approved
→ timelocked
→ released
→ evidence_required
→ evidence_accepted
→ impact_certified
→ settled
```

`challenged` and `revoked` are available for red-team or admin interventions.

## Milestone Settlement

Milestone release moves internal ledger value from `tree_planting_fund` to a project escrow
placeholder.

Settlement requires:

- At least one accepted Evidence Object.
- An issued Impact Certificate when `finalSettlement = true`.

The settlement certificate hash is deterministic over:

```text
projectId
milestoneId
evidenceRoot
amount
currency
certificateId optional
finalSettlement
```

Settlement certificates are internal fund settlement proofs. They are not carbon credits,
payment execution receipts, or tax-offset claims.

## Payment Intent Integration

Phase 8 posts a `payment_confirmation` transaction only after a Payment Intent is confirmed.
The default lottery path is:

```text
payment_clearing
→ round_escrow
→ Tree Lotto finalize
→ prize_pool / tree_planting_fund / operations / referral_growth / insurance_challenge_pool
```

The `payment_clearing` account is an internal placeholder for reconciliation. It is not a
bank account, user custody wallet, smart-contract vault, or proof of a live mainnet transfer.
