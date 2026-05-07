# RWA Boundary

Dropin Earth V1 treats RWA fragments as gated utility or allocation records, not guaranteed
yield instruments.

Allowed V1 fragment types:

```text
allocation
fee_rebate
impact_right
```

`qualified_yield` exists only as a disabled schema state for future licensed and
jurisdiction-gated work. The claim gate blocks it in V1.

## Claim Safety

```text
No KYC, no yield RWA.
No MRV, no carbon credit.
No retirement, no offset claim.
No license, no carbon tax service.
```

RWA fragments must not be marketed as guaranteed returns, tax offsets, dividends, or certified
carbon credits. Until a certificate is MRV-certified and retired through an eligible registry,
the product language remains `estimated impact`, `Impact Certificate`, or `future carbon
fragment eligibility`.

## Phase 6 Gate

RWA fragment claims run through the deterministic V1 risk score:

```text
score >= 0.75  → claimable
score < 0.75   → manual_review
blocked wallet → blocked
qualified_yield → blocked
```

Manual review produces a `risk_event` so the operations team can resolve or dismiss it with an
audit trail.

## Payment Boundary

Payment Intents do not change RWA status or create yield rights. A confirmed Payment Intent
can unlock Tree Lotto entry and later a deterministic drop result, but any RWA Fragment claim
still passes through the V1 risk gate and remains non-yield utility/allocation state unless a
future licensed jurisdiction flow explicitly enables something stricter.
