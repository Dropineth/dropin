# Testnet Campaign Runbook

This runbook is for public testnet launches only. It does not authorize mainnet payments,
private-key handling, carbon credit claims, RWA yield claims, or carbon tax claims.

## Pre-Launch

1. Start local or staging services.

```bash
DROPIN_REPOSITORY=memory \
DROPIN_PAYMENT_MODE=mock \
TELEGRAM_AUTH_MODE=mock \
DROPIN_TON_TESTNET_ENABLED=false \
npm --workspace services/api run dev
```

2. Open the readiness page.

```text
http://localhost:3002/launch
```

3. Confirm the launch gate.

```bash
curl http://localhost:8787/admin/launch/readiness
curl -X POST http://localhost:8787/admin/launch/check \
  -H 'content-type: application/json' \
  -d '{"actor":"launch-admin","campaignId":"campaign_v1_ggw_testnet"}'
```

4. Run operator rehearsals.

```bash
npm run dry-run:operator
npm run dry-run:failure
```

5. Verify public pages.

```text
http://localhost:3001/status
http://localhost:3001/campaigns/campaign_v1_ggw_testnet
http://localhost:3003/campaign/campaign_v1_ggw_testnet
```

## During Launch

Watch:

```text
open challenge cases
open risk events
pending or stale Payment Intents
feedback queue
campaign report
metrics endpoint
```

Important URLs:

```text
http://localhost:3002/status
http://localhost:3002/risk
http://localhost:3002/challenges
http://localhost:3002/feedback
http://localhost:8787/metrics
```

## Launch Gate Decisions

```text
pass -> campaign can continue
warn -> campaign can continue with active monitoring
fail -> pause public promotion and resolve blockers first
```

Critical failures include missing campaign, missing linked round/project, missing treasury
accounts, or critical reconciliation mismatches.

## Post-Launch

1. Finalize the campaign report when ready.
2. Resolve feedback items with admin audit logs.
3. Close stale risk events and challenges through their normal workflows.
4. Run another launch check to capture the final state.

## Rollback

```text
1. Pause public promotion.
2. Capture /status/system, /metrics, and /admin/launch/readiness.
3. Stop any operator script running with DROPIN_OPERATOR_WRITE_MODE=true.
4. Reconcile payment intents.
5. Challenge or resolve affected evidence, certificates, fund records, or campaign claims.
6. Re-run npm run dry-run:operator and npm run dry-run:failure.
7. Publish updated public status before resuming.
```
