# Payment Intents

Phase 8 adds a production-grade Payment Intent layer before real payment rails. Phase 10
adds TON testnet verification behind the same abstraction.

Core rule:

```text
Tree Lotto consumes confirmed Payment Intents, not raw user-submitted payment claims.
```

## State Machine

```text
created
→ awaiting_payment
→ submitted
→ confirming
→ confirmed
→ reconciled
```

Terminal and intervention states:

```text
expired
failed
refunded
challenged
```

## Supported Adapters

```text
MockPaymentAdapter
ManualPaymentAdapter
SolanaDevnetPaymentAdapter skeleton
TonTestnetPaymentAdapter
```

Payment adapters do not execute live mainnet transfers, do not store private keys, and do
not custody funds. Optional RPC/API URLs are environment variables only.

## Lottery Entry Flow

```text
POST /payments/intents
→ POST /payments/intents/:id/submit
→ POST /admin/payments/:id/confirm
→ POST /lottery/rounds/:roundId/enter with paymentIntentId
```

TON testnet flow:

```text
POST /payments/intents with chain=ton, currency=TON
→ GET /payments/intents/:id/instructions
→ user sends TON testnet transfer externally
→ POST /payments/intents/:id/submit
→ POST /payments/intents/:id/verify
→ POST /lottery/rounds/:roundId/enter with confirmed paymentIntentId
```

If `paymentIntentId` is missing, lottery entry is only allowed when
`DROPIN_PAYMENT_MODE=mock` is explicitly enabled for local demos.

## Reconciliation

`POST /admin/payments/reconcile` checks:

```text
duplicate txHash
wrong recipient
amount mismatch
currency mismatch
missing memo
expired intent
wrong network
stale pending intent
stale submitted tx
```

Anomalies create risk events and can be challenged by the Red Team Challenge Layer.

## Treasury Posting

Confirmed lottery payments post one internal ledger entry:

```text
payment_clearing
→ round_escrow
```

Tree Lotto finalization later allocates round escrow into prize pool, Tree Planting Fund,
operations, referral growth, and insurance/challenge pool accounts. These are internal
ledger entries, not payment execution receipts.

## TON Testnet Guardrails

TON verification is disabled unless:

```bash
DROPIN_TON_TESTNET_ENABLED=true
DROPIN_TON_TESTNET_TREASURY_ADDRESS=<testnet-recipient>
```

`DROPIN_TON_TESTNET_API_URL` or `DROPIN_TON_TESTNET_RPC_URL` may point at a normalized
testnet transaction provider. If the provider is unavailable, verification fails closed.

Expected memo format:

```text
DROPIN:<paymentIntentId>:<paymentNonce>
```
