# Failure Injection

`scripts/failure-injection.ts` rehearses expected detection paths for public testnet launch.
It is non-destructive by default.

Run:

```bash
npm run dry-run:failure
```

## Covered Scenarios

```text
duplicate tx hash
wrong recipient
expired intent
suspicious referral
fake evidence challenge
open high-risk event
readiness fail condition
```

## Expected Detections

### Duplicate Tx Hash

Payment submission should reject or flag duplicate transaction hashes and create a risk
event when a second Payment Intent attempts to reuse the same tx hash.

### Wrong Recipient

TON testnet verification should fail closed when the normalized transaction recipient does
not match the Payment Intent instructions.

### Expired Intent

Reconciliation should detect expired or stale Payment Intents before they can create a
Tree Lotto entry.

### Suspicious Referral

Self-referral or suspicious referral behavior should create a risk event and award zero
Leaf Points.

### Fake Evidence Challenge

A fake evidence challenge should route into the Challenge Board. If accepted, the target
evidence or certificate can be marked challenged before it becomes trusted infrastructure.

### Open High-Risk Event

Open high-severity risk or challenge queues should influence launch readiness and block or
warn the operator before launch.

## Write Safety

Default failure injection is simulated. Real mutation mode requires:

```bash
DRY_RUN_MODE=false
DROPIN_OPERATOR_WRITE_MODE=true
```

Even then, the script only writes when the API reports `repositoryMode=memory`.

