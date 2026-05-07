# Operator Dry Run

`scripts/operator-dry-run.ts` rehearses the public testnet launch path without adding new
product mechanics.

Default mode is safe:

```bash
npm run dry-run:operator
```

It reads the live API at:

```text
DROPIN_API_URL or http://localhost:8787
```

## What It Checks

```text
/ready
campaign detail
campaign join
Payment Intent creation
tx hash submission
manual/mock confirmation
Tree Lotto entry creation
round results
fund allocations
project and evidence
Impact Certificate
Solana Anchor config
challenge creation and resolution
feedback submission
campaign report
```

## Write Safety

By default, write actions are simulated. This keeps the script non-destructive for staging,
demo, and local operator checks.

Write mutations require both:

```bash
DRY_RUN_MODE=false
DROPIN_OPERATOR_WRITE_MODE=true
```

The script still refuses writes unless the API reports `repositoryMode=memory`. Do not use
this script to execute mainnet payment rails, hold private keys, distribute `$CANOPY`, or
perform real-money transfers.

## Rollback

The default dry run needs no rollback because it does not write.

If write mode is used against memory mode:

```text
1. Stop public promotion.
2. Restart the memory API to reset state.
3. Re-run /ready and /admin/launch/check.
4. Review created feedback/challenge records.
5. Confirm campaign page and Mini App still show testnet-only limitations.
```

If a write-mode rehearsal accidentally runs against a non-memory environment, treat it as an
incident: capture `/status/system`, run reconciliation, resolve or challenge affected objects,
and record a new launch check.

## Claim Boundaries

Operator dry runs must not state that an Impact Certificate is a certified carbon credit.
RWA Fragment is not guaranteed yield. `$CANOPY` does not offset carbon tax. Leaf Points are
non-transferable testnet points only.

