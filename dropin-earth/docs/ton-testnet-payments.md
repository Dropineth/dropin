# TON Testnet Payments

Phase 10 adds a TON testnet Payment Intent verifier.

Core rule:

```text
Dropin verifies user-submitted TON testnet transactions. It does not custody funds,
hold private keys, or execute mainnet transfers.
```

## Environment

```bash
DROPIN_TON_TESTNET_ENABLED=true
DROPIN_TON_TESTNET_TREASURY_ADDRESS=<ton-testnet-recipient>
DROPIN_TON_TESTNET_API_URL=<optional-normalized-transaction-api>
```

If the adapter is disabled, treasury address is missing, or the provider is unavailable,
verification fails closed with a clear error.

In Phase 12, the launch readiness gate explicitly reports whether TON testnet is enabled.
Disabled TON testnet is treated as a warning for mock/manual rehearsals, while live mainnet
TON remains out of scope.

## Instructions

For `chain=ton` and `currency=TON`, payment instructions return:

```text
recipient = DROPIN_TON_TESTNET_TREASURY_ADDRESS
amount    = PaymentIntent.amount
memo      = DROPIN:<paymentIntentId>:<paymentNonce>
network   = testnet
expiresAt = PaymentIntent.expiresAt
```

API:

```text
GET /payments/intents/:paymentIntentId/instructions
```

## Verification

API:

```text
POST /payments/intents/:paymentIntentId/verify
```

Input:

```json
{
  "txHash": "ton-testnet-transaction-hash"
}
```

The adapter checks:

```text
wrong_recipient
amount_mismatch
currency_mismatch
missing_memo
wrong_network
expired_intent
duplicate_tx_hash
```

Successful verification confirms the Payment Intent and posts the internal
`payment_confirmation` treasury ledger entry. Lottery entry still requires a confirmed
Payment Intent.

## Provider Boundary

The provider returns a normalized transaction:

```json
{
  "txHash": "abc",
  "recipient": "ton-testnet-recipient",
  "amount": "1",
  "currency": "TON",
  "memo": "DROPIN:payment_intent_x:payment_nonce_y",
  "network": "testnet",
  "blockTime": "2026-05-07T00:00:00.000Z"
}
```

No TON SDK dependency is required in Phase 10. A future provider can wrap a TON testnet API
without changing the Payment Intent contract.
