# Contracts

Phase 5 adds the first contract workspace:

```text
contracts/solana
└── programs/dropin_anchor
```

The program is intentionally small. It does not compute lottery winners, carbon estimates,
RWA economics, or tax logic. It only anchors deterministic proof roots produced by the
off-chain Dropin services.

Phase 7 treasury and fund settlement also remain off-chain in the internal ledger. The Solana
program does not execute milestone payments, hold treasury funds, or settle project escrow in
this phase.

## Solana V1 Scope

- Round root anchor.
- Drop root verification against the round anchor.
- Impact Certificate hash anchor.
- Revoke path for challenged or invalid anchors.
- Merkle drop claim registry.

## Out Of Scope

- Carbon credit issuance.
- Carbon tax claims.
- Yield-bearing RWA logic.
- Complex lottery computation.
- Cross-chain settlement.
- Treasury transfer execution.
- Project milestone escrow.
