# Public Testnet Launch Readiness

Phase 12 makes the existing public testnet campaign observable and operable without
adding new product mechanics or live mainnet payment rails.

## Launch Gate

The launch gate is exposed through:

```text
GET  /ready
GET  /status/system
GET  /admin/launch/readiness
POST /admin/launch/check
GET  /metrics
```

`POST /admin/launch/check` records a launch check and writes an audit log. It should be
run before opening a public testnet campaign and after any incident mitigation.

## Required Checks

Readiness verifies:

```text
campaign exists
campaign status is scheduled or active
linked Tree Lotto round exists
linked project exists
treasury accounts exist
payment mode is configured
TON testnet status is explicit
pending and stale Payment Intents are visible
critical reconciliation mismatches are counted
open risk events are counted
open and critical/high challenges are counted
Solana Anchor config is visible
repository mode is visible
seed/demo data is present
```

TON testnet being disabled is a warning, not a hard failure, because some launch rehearsals
intentionally run with mock/manual payments only.

## Metrics

`GET /metrics` returns Prometheus-style plain text gauges:

```text
dropin_payment_intents_pending
dropin_challenges_open
dropin_risk_events_open
dropin_campaigns_live
dropin_feedback_open
dropin_lottery_rounds_open
```

## Admin Pages

```text
http://localhost:3002/launch
http://localhost:3002/status
http://localhost:3002/feedback
```

The public status and feedback pages are:

```text
http://localhost:3001/status
http://localhost:3001/feedback
```

Feedback is an operational object with source, severity, status, resolution, and audit log.

## External Packaging Gate

Phase 13 adds external launch packaging for the Great Green Wall Testnet Campaign. Before
sharing the campaign publicly, confirm these routes render and include safety copy:

```text
http://localhost:3001/campaigns/campaign_v1_ggw_testnet
http://localhost:3001/faq
http://localhost:3001/red-team
http://localhost:8787/public/launch-pack
```

The public campaign page, FAQ, and launch pack must state that the campaign is testnet-only,
does not use mainnet funds, uses non-transferable Leaf Points, and does not claim certified
carbon credit status, guaranteed yield, or carbon tax offset treatment.

## Status UI

The public `/status` page and admin `/launch`, `/status`, and `/feedback` pages use a
pass/warn/fail visual system. They should keep operational data visible:

```text
API readiness
repository mode
payment mode
TON testnet enabled/disabled
campaign live count
open risk events
open challenge cases
feedback queue
readiness checklist
```

The UI can be polished, but it must not hide launch gate decisions, anomaly queues, or
audit-sensitive admin actions.

## Operator Dry Run Gate

Before external launch, run:

```bash
npm run dry-run:operator
npm run dry-run:failure
```

The dry runs should complete with PASS. They are non-destructive by default and are meant to
prove that the operator can inspect readiness, campaign state, payment intent behavior,
proof records, challenges, feedback, and public reports.
