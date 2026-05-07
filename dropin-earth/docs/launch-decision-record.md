# Launch Decision Record

Campaign: Great Green Wall Testnet Campaign

Campaign ID: `campaign_v1_ggw_testnet`

Decision date: 2026-05-08 00:14 HKT

Operator: Dropin launch operator

Environment: local public testnet launch candidate

API base URL: `http://localhost:8787`

Repository mode: `memory`

Payment mode: `mock`

TON testnet enabled: `true`

Release candidate: `v0.15.0-testnet-campaign`

## Go / No-Go

```text
Allowed values: GO | NO-GO | GO WITH MONITORING
Decision: GO, with testnet-only constraints.
Reason:
Readiness returned pass:true / decision=pass. CI, Anchor tests, operator dry run,
failure injection, audit, status, campaign report, and launch safety copy are all
acceptable for the first public testnet cohort.
```

## Readiness Snapshot

```text
/ready decision: pass
ready: true
campaign: campaign_v1_ggw_testnet
open risk events: 0
open challenge cases: 0
critical/high challenge cases: 0
pending payment intents: 0
stale payment intents: 0
critical reconciliation mismatches: 0
feedback open: 0
Anchor config: contracts/solana/Anchor.toml found
campaigns live: 1
lottery rounds open: 1
treasury accounts: 9
```

## Validation Snapshot

```text
npm run ci: PASS
unit tests: 112/112 passed
npm audit --audit-level=moderate: 0 vulnerabilities
npm run anchor:test: PASS, 9/9 passed
/ready: pass:true
```

## Operator Dry Run

```text
npm run dry-run:operator result: PASS
dry run timestamp: 2026-05-08 00:13 HKT
mode: DRY_RUN_MODE=true, DROPIN_OPERATOR_WRITE_MODE=false
notes:
- /ready returned decision=pass, ready=true.
- Campaign, linked round, linked project, fund allocations, evidence, Impact Certificate,
  anchor config, and campaign report were reachable.
- Mutations were simulated by default.
```

## Failure Injection

```text
npm run dry-run:failure result: PASS
duplicate tx hash detection: simulated expected duplicate_tx_hash risk event or rejection
wrong recipient detection: simulated TON wrong_recipient failure
expired intent detection: simulated expired_intent / stale_pending detection
suspicious referral detection: simulated zero Leaf Points + risk_event
fake evidence challenge detection: simulated evidence_object challenge review
readiness fail condition: PASS, missing campaign safely produced fail decision
```

## Launch Actions

```text
1. Publish Telegram announcement from docs/launch-pack/telegram-announcement.md.
2. Publish X/Twitter thread from docs/launch-pack/twitter-thread.md.
3. Share Mini App campaign link:
   http://localhost:3003/campaign/campaign_v1_ggw_testnet
4. Share Web campaign link:
   http://localhost:3001/campaigns/campaign_v1_ggw_testnet
5. Open feedback:
   http://localhost:3001/feedback
6. Open red-team challenge guide:
   http://localhost:3001/red-team
7. Monitor daily operator report:
   docs/testnet-operator-daily-report.md
```

## Daily Operating Checks

```text
Check /admin/launch.
Check /admin/payments/reconciliation.
Check /admin/risk.
Check /admin/challenges.
Check /admin/feedback.
Export /campaigns/campaign_v1_ggw_testnet/report.
Publish first public impact report after one week.
```

## Known Limitations

```text
Testnet only.
No mainnet funds.
No real-money transfer execution.
No private keys.
No automatic $CANOPY distribution.
Leaf Points are non-transferable testnet points.
Impact Certificate is not a certified carbon credit.
RWA Fragment is not guaranteed yield.
$CANOPY does not offset carbon tax.
```

## Rollback / Pause Plan

```text
1. Pause public promotion.
2. Capture /status/system, /metrics, and /admin/launch/readiness.
3. Stop write-mode operator scripts.
4. Resolve or challenge affected payment, evidence, certificate, fund, or campaign objects.
5. Re-run reconciliation.
6. Re-run launch check.
7. Publish corrected public status.
```

## Sign-Off

Product: GO

Engineering: GO

Risk / Red Team: GO WITH MONITORING

Operations: GO
