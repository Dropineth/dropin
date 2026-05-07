# Public Testnet Campaigns

Phase 11 adds a public growth loop for Dropin Earth without mainnet funds, private keys,
or automatic `$CANOPY` distribution.

```text
Campaign
→ Region
→ Tree Lotto Round
→ Project
→ Plant & Enter
→ Leaf Points
→ Co-Plant referral
→ Public impact report
```

## Scope

Campaigns bind:

```text
regionId
roundId
projectId
fundingGoalAmount
treeGoal
participants
Leaf Points
campaign report
```

Leaf Points are non-transferable public testnet points only. They are not `$CANOPY`, do
not represent RWA yield, and do not offset carbon tax.

## State Machine

```text
draft
→ scheduled
→ active
→ ended
→ finalized
```

`cancelled` is available from pre-final states. Finalization publishes a campaign report
snapshot.

## Leaf Points

```text
Lottery entry       -> +10
Climate Proof Card  -> +5
Valid referral      -> +20
Suspicious referral -> 0 + risk_event
```

Awards are idempotent by:

```text
userId + sourceType + sourceId
```

## Public Report

`GET /campaigns/:campaignId/report` aggregates:

```text
participant count
ticket count
confirmed Payment Intent count
total confirmed payment amount
fund allocations
project milestone statuses
evidence count
Impact Certificate statuses
challenge count
risk event count
top leaderboard entries
```

Impact Certificates in reports are impact proof only, not certified carbon credits.

## Launch Readiness

Phase 12 adds a launch gate around the campaign:

```text
Campaign + linked round + linked project
→ payment and TON testnet configuration
→ treasury accounts
→ risk / challenge / feedback queues
→ readiness decision
→ launch check audit log
```

Useful routes:

```text
GET  /ready
GET  /status/system
GET  /admin/launch/readiness
POST /admin/launch/check
POST /feedback
GET  /admin/feedback
POST /admin/feedback/:feedbackId/resolve
```

TON testnet disabled is a warning for mock/manual launch rehearsals, not an automatic
blocker. Critical reconciliation mismatches, missing campaign data, or missing treasury
accounts should block public launch.

## Routes

```text
GET  /campaigns
GET  /campaigns/:campaignId
POST /admin/campaigns
POST /admin/campaigns/:campaignId/schedule
POST /admin/campaigns/:campaignId/start
POST /admin/campaigns/:campaignId/end
POST /admin/campaigns/:campaignId/finalize
GET  /campaigns/:campaignId/leaderboard
GET  /campaigns/:campaignId/report
POST /campaigns/:campaignId/join
GET  /campaigns/:campaignId/me
GET  /me/leaf-points
GET  /campaigns/:campaignId/leaf-points
```

## Demo

Seeded campaign:

```text
campaign_v1_ggw_testnet
```

Useful local URLs:

```text
http://localhost:3001/campaigns
http://localhost:3001/campaigns/campaign_v1_ggw_testnet
http://localhost:3002/campaigns
http://localhost:3002/campaigns/campaign_v1_ggw_testnet
http://localhost:3003/campaign/campaign_v1_ggw_testnet
http://localhost:3001/status
http://localhost:3001/feedback
http://localhost:3002/launch
http://localhost:3002/status
http://localhost:3002/feedback
http://localhost:8787/campaigns/campaign_v1_ggw_testnet/report
```

## External Launch Pack

Phase 13 packages the campaign for external testers:

```text
docs/launch-pack/landing-page-copy.md
docs/launch-pack/twitter-thread.md
docs/launch-pack/telegram-announcement.md
docs/launch-pack/user-guide.md
docs/launch-pack/faq.md
docs/launch-pack/risk-disclosure.md
docs/launch-pack/red-team-challenge-guide.md
docs/launch-pack/public-impact-report-template.md
```

Public routes:

```text
GET /public/launch-pack
http://localhost:3001/faq
http://localhost:3001/red-team
```

Every external campaign page must visibly state:

```text
Testnet only.
No mainnet funds.
Leaf Points are non-transferable testnet points.
Impact Certificate is not a certified carbon credit.
RWA Fragment is not guaranteed yield.
$CANOPY does not offset carbon tax.
```

## Premium Campaign UI

The Great Green Wall campaign page now presents the public testnet campaign as a
premium climate-impact lottery, not a casino UI. First-screen pool economics must show:

```text
70% Winner
20% Verified Reforestation
10% Dropin Operations
```

Campaign pages also surface readiness status, leaderboard preview, public report preview,
feedback CTA, challenge CTA, and the full testnet-only safety boundary.
