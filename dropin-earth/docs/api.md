# API

Current V1 routes:

```text
GET  /health
GET  /public/launch-pack
GET  /ready
GET  /metrics
GET  /status/system
GET  /admin/launch/readiness
POST /admin/launch/check
GET  /regions
GET  /regions/:id
GET  /species
GET  /lottery/rounds
GET  /lottery/rounds/:id
POST /lottery/rounds/:id/enter
POST /admin/lottery/rounds/:id/close
POST /admin/lottery/rounds/:id/finalize
GET  /lottery/rounds/:id/results
GET  /me/tickets
GET  /me/drops
GET  /me/rwa-fragments
POST /payments/intents
GET  /payments/intents
GET  /payments/intents/:id
GET  /payments/intents/:id/instructions
POST /payments/intents/:id/submit
POST /payments/intents/:id/verify
POST /admin/payments/:id/confirm
POST /admin/payments/:id/fail
POST /admin/payments/reconcile
GET  /payments/reconciliation
POST /telegram/session
GET  /telegram/me
GET  /telegram/rounds
GET  /telegram/forest
POST /telegram/share-ticket
POST /telegram/referrals/claim
GET  /campaigns
GET  /campaigns/:id
POST /admin/campaigns
POST /admin/campaigns/:id/schedule
POST /admin/campaigns/:id/start
POST /admin/campaigns/:id/end
POST /admin/campaigns/:id/finalize
GET  /campaigns/:id/leaderboard
GET  /campaigns/:id/report
POST /campaigns/:id/join
GET  /campaigns/:id/me
GET  /me/leaf-points
GET  /campaigns/:id/leaf-points
POST /feedback
GET  /admin/feedback
POST /admin/feedback/:id/resolve
GET  /projects
GET  /projects/:id
POST /admin/projects
POST /admin/projects/:id/milestones
POST /admin/projects/:id/approve
POST /admin/projects/:id/fund
POST /admin/projects/:id/release-milestone
POST /evidence
GET  /evidence
GET  /evidence/:id
POST /admin/evidence/:id/review
POST /impact-certificates
GET  /impact-certificates
GET  /impact-certificates/:id
POST /impact-certificates/:id/challenge
GET  /risk/events
GET  /risk/events/:id
POST /risk/score
POST /admin/risk/events/:id/resolve
POST /drops/:id/claim
POST /rwa-fragments/:id/claim
POST /challenges
GET  /challenges
GET  /challenges/:id
POST /challenges/:id/evidence
POST /admin/challenges/:id/accept
POST /admin/challenges/:id/reject
POST /admin/challenges/:id/resolve
GET  /fund/allocations
GET  /fund/allocations/:id
POST /admin/fund/allocations
POST /admin/fund/allocations/:id/approve
POST /admin/fund/allocations/:id/release
POST /admin/fund/allocations/:id/challenge
GET  /treasury/accounts
GET  /treasury/transactions
GET  /projects/:projectId/milestones/:milestoneId/settlement
POST /admin/projects/:projectId/milestones/:milestoneId/release
POST /admin/projects/:projectId/milestones/:milestoneId/settle
GET  /milestone-releases
GET  /settlements
GET  /audit-logs
```

## Launch Readiness Notes

Phase 12 exposes testnet launch readiness and feedback APIs. `GET /ready` returns the same
readiness report shape as `GET /admin/launch/readiness`, wrapped in `{ ok, data }`.
`POST /admin/launch/check` persists a launch check and writes an audit log.

Readiness checks include campaign, linked round/project, treasury accounts, payment mode,
TON testnet representation, payment anomalies, risk/challenge queues, Anchor config,
repository mode, and seed/demo data.

`GET /metrics` returns Prometheus-style plain text gauges:

```text
dropin_payment_intents_pending
dropin_challenges_open
dropin_risk_events_open
dropin_campaigns_live
dropin_feedback_open
dropin_lottery_rounds_open
```

Feedback routes accept `source=web|miniapp|admin|api`. Admin feedback resolution creates
an audit log.

## Public Launch Pack

`GET /public/launch-pack` returns static metadata for the Great Green Wall Testnet Campaign
launch package, including docs paths, public routes, and safety limitations. It is read-only
and does not expose private keys, payment execution, token distribution, or mainnet rails.

Every route returns:

```json
{
  "ok": true,
  "data": {}
}
```

Errors return:

```json
{
  "ok": false,
  "error": "message"
}
```

## Impact Ledger Notes

Evidence upload accepts either `rawContent`, legacy `content`, or a precomputed 64-character
`contentHash`. Raw content is hashed before storage. Accepted evidence is required before
certificate issuance.

Impact certificate responses include a `claimBoundary` string. The API deliberately describes
these records as Impact Certificates, not certified carbon credits. Estimated CO2e values are
estimated impact only.

## Risk and Challenge Notes

`POST /risk/score` accepts deterministic V1 signals such as wallet age, entry count, prior
claim count, rejected challenge count, and accepted evidence count. It returns:

```json
{
  "score": 0.72,
  "riskLevel": "low",
  "reasons": ["wallet_age_90_days_plus"],
  "recommendedAction": "allow"
}
```

Drop claim routes return one of `claimable`, `delayed`, `manual_review`, or `blocked`.
Common drops stay low friction. Rare, epic, legendary, and RWA fragment claims pass through
stricter gates. `qualified_yield` RWA is blocked in V1.

Challenges support targets including `lottery_round`, `randomness_certificate`,
`drop_result`, `rwa_fragment`, `project`, `evidence_object`, `impact_certificate`,
`fund_allocation`, `treasury_transaction`, `settlement_certificate`, `payment_intent`,
`round_anchor`, and `impact_anchor`. Accepted challenges set target status to `challenged` where the target has
a status field, and always create an audit log plus challenge resolution.

## Payment Intent Notes

Tree Lotto entry is gated by confirmed Payment Intents in Phase 8. The route
`POST /lottery/rounds/:id/enter` accepts `paymentIntentId`; without it the API only allows
legacy local entry when `DROPIN_PAYMENT_MODE=mock`.

Payment Intent lifecycle:

```text
created
→ awaiting_payment
→ submitted
→ confirming
→ confirmed
→ reconciled
```

Failure and red-team states include `expired`, `failed`, `refunded`, and `challenged`.

Reconciliation checks:

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

Adapters are mock, manual, Solana devnet skeleton, and TON testnet verifier. No API route
executes live mainnet transfers or stores private keys. TON verification is disabled unless
`DROPIN_TON_TESTNET_ENABLED=true` and verifies user-submitted testnet transactions against
recipient, amount, memo, and network.

## Telegram Mini App Notes

Phase 9 exposes Telegram routes for Mini App growth and TON entry. The routes use the
Phase 8 Payment Intent abstraction and do not execute live TON mainnet transfers.

`POST /telegram/session` accepts either mock user payload when `TELEGRAM_AUTH_MODE=mock`
or Telegram `initData` when `TELEGRAM_AUTH_MODE=strict`. Strict mode verifies the Telegram
WebApp hash with `TELEGRAM_BOT_TOKEN` from the environment. The token is never hardcoded.

`POST /telegram/share-ticket` creates a referral code and Climate Proof Card for a Ticket
Seed or round. `POST /telegram/referrals/claim` is idempotent, creates a risk score
snapshot, and flags suspicious referrals as risk events. Referral rewards are placeholder
Leaf Points only. No token rewards are auto-distributed.

## Campaign / Growth Notes

Phase 11 campaign APIs bind a public testnet mission to a region, Tree Lotto round,
project, referral loop, and public impact report. Admin campaign mutations create
`audit_logs`.

Leaf Points rules:

```text
Lottery entry       -> +10 Leaf Points
Share ticket card   -> +5 Leaf Points
Valid referral      -> +20 Leaf Points
Suspicious referral -> 0 Leaf Points + risk_event
```

Leaf Points are non-transferable testnet growth points. They are not `$CANOPY`, do not
represent yield, and do not offset carbon tax.

`GET /campaigns/:id/report` aggregates participants, tickets, confirmed Payment Intents,
fund allocations, project milestone statuses, evidence count, Impact Certificate statuses,
challenge count, risk event count, and deterministic leaderboard ordering.

## Treasury / Fund Notes

Phase 7 routes use an internal ledger only. They do not submit stablecoin, bank, or chain
transfers.

Every treasury transaction has `debitAccountId`, `creditAccountId`, `amount`, `currency`,
`sourceType`, `sourceId`, and `status`. Posted records are append-only. Reversal is represented
by a new `revoke_reversal` transaction.

Milestone settlement requires accepted evidence. Final settlement additionally requires an
issued Impact Certificate. Settlement certificate responses describe internal fund settlement
proof and never call the Impact Certificate a carbon credit.

## UI Route Notes

No API routes were added for the premium UI pass. The existing Web, Mini App, and Admin
routes now present the Great Green Wall testnet pool with the public allocation model:

```text
70% Winner
20% Verified Reforestation
10% Dropin Operations
```

The pages continue to consume existing readiness, feedback, campaign, lottery, payment,
impact, challenge, fund, and status endpoints.
