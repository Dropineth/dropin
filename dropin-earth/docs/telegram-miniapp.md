# Telegram Mini App / TON Entry

Phase 9 adds the Telegram growth entry for Dropin Earth.

Core rule:

```text
Build the Telegram Mini App entry first, but keep payment execution behind Payment Intents.
```

## Scope

```text
Earth Seed loading
→ active Tree Lotto round
→ TON testnet/manual Payment Intent
→ Plant & Enter
→ Ticket Seed
→ My Forest
→ Climate Proof Card
→ Co-Plant referral
```

The Mini App does not execute uncontrolled TON mainnet transfers, stores no private keys,
and does not auto-distribute token rewards for referrals.

## Apps

```text
apps/miniapp-ton
├── /
├── /round/[roundId]
├── /campaign/[campaignId]
├── /me/forest
└── /share/[ticketId]
```

Local URL:

```bash
npm run dev:miniapp-ton
```

```text
http://localhost:3003
http://localhost:3003/round/round_v1_ggw_demo
http://localhost:3003/campaign/campaign_v1_ggw_testnet
http://localhost:3003/me/forest
http://localhost:3003/share/ticket_v1_ggw_demo?roundId=round_v1_ggw_demo
```

## API

```text
POST /telegram/session
GET  /telegram/me
GET  /telegram/rounds
GET  /telegram/forest
POST /telegram/share-ticket
POST /telegram/referrals/claim
GET  /campaigns/:campaignId
GET  /campaigns/:campaignId/me
GET  /campaigns/:campaignId/leaderboard
```

## Auth Modes

Mock mode:

```bash
TELEGRAM_AUTH_MODE=mock
```

The API accepts a Telegram user payload and creates or links a Dropin user.

Strict mode:

```bash
TELEGRAM_AUTH_MODE=strict
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
```

Strict mode verifies Telegram WebApp `initData` hash using the bot token from the
environment. The bot token is never hardcoded.

## Payment Flow

The Mini App uses Payment Intents:

```text
POST /payments/intents
→ GET /payments/intents/:id/instructions for TON testnet
→ POST /payments/intents/:id/submit
→ POST /payments/intents/:id/verify for TON testnet
→ POST /admin/payments/:id/confirm in mock/manual local mode
→ POST /lottery/rounds/:roundId/enter with paymentIntentId
```

TON testnet mode displays recipient, amount, and memo. The user submits a transaction hash,
and the API verifies the normalized testnet transaction against the Payment Intent. TON
mainnet is not enabled.

## Referral Risk

`POST /telegram/referrals/claim` is idempotent and creates a deterministic risk score
snapshot. Suspicious referrals create `risk_events`.

Campaign Leaf Points are non-transferable testnet growth points only:

```text
Plant & Enter -> +10 Leaf Points
Share card -> +5 Leaf Points
Valid Co-Plant referral -> +20 Leaf Points
Suspicious referral -> 0 Leaf Points + risk_event
No automatic $CANOPY distribution.
No guaranteed RWA yield.
No carbon tax offset claim.
```

## Premium Mini App UI

The Mini App keeps the Telegram growth path short and mobile-native:

```text
Earth Seed campaign hero
→ active draw
→ 70% Winner / 20% Verified Reforestation / 10% Dropin Operations
→ Payment Intent / TON testnet instructions
→ Plant & Enter
→ Leaf Points
→ Co-Plant invite
```

The campaign and round pages must visibly state that the flow is testnet-only and that
Leaf Points are non-transferable testnet points.
