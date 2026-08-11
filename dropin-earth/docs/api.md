# API

Current V1 routes:

```text
GET  /health
GET  /public/launch-pack
GET  /ready
GET  /metrics
GET  /status/system
POST /product-vision/plan
GET  /product-vision/status
POST /product-vision/backlog-updates
GET  /product-vision/backlog-updates
POST /admin/product-vision/github-project/sync
POST /ux-experience/analyze
GET  /ux-experience/status
POST /ux-experience/events
GET  /ux-experience/growth-referral-feed
POST /growth-referral/events
GET  /growth-referral/status
GET  /growth-referral/metrics
GET  /growth-referral/reports
GET  /growth-referral/leaderboard
GET  /growth-referral/product-vision-feed
POST /community-engagement/campaigns/run
GET  /community-engagement/status
GET  /community-engagement/metrics
GET  /community-engagement/reports
GET  /community-engagement/notifications
GET  /community-engagement/feedback
GET  /community-engagement/product-vision-feed
POST /external-partner/sync
GET  /external-partner/status
GET  /external-partner/metrics
GET  /external-partner/reports
GET  /external-partner/funding-reports
GET  /external-partner/proof-timeline
POST /content-education/progress
GET  /content-education/status
GET  /content-education/metrics
GET  /content-education/reports
POST /governance/proposals/process
GET  /governance/status
GET  /governance/metrics
GET  /governance/reports
POST /risk-red-team/analyze
GET  /risk-red-team/status
GET  /risk-red-team/metrics
GET  /risk-red-team/reports
GET  /risk-red-team/alerts
POST /ops-infrastructure/deployments/trigger
GET  /ops-infrastructure/status
GET  /ops-infrastructure/metrics
GET  /ops-infrastructure/reports
GET  /ops-infrastructure/alerts
POST /analytics-insight/reports/generate
GET  /analytics-insight/status
GET  /analytics-insight/metrics
GET  /analytics-insight/reports
GET  /analytics-insight/dashboard
GET  /analytics-insight/predictions
GET  /analytics-insight/alerts
POST /graphql
POST /pocc-ahin/consensus/commit
GET  /pocc-ahin/consensus/status
GET  /pocc-ahin/consensus/commits
GET  /pocc-ahin/consensus/metrics
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
POST /tree-lotto/rounds/:id/execute
GET  /tree-lotto/status
GET  /tree-lotto/metrics
POST /proof-of-planting/validate
GET  /proof-of-planting/status
GET  /proof-of-planting/timeline
GET  /proof-of-planting/metrics
POST /carbon-accounting/compute
GET  /carbon-accounting/status
GET  /carbon-accounting/ledger
GET  /carbon-accounting/token-metadata
GET  /carbon-accounting/metrics
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
POST /wallet-payments/confirm
GET  /wallet-payments/metrics
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
dropin_ops_mean_response_time_ms
dropin_ops_uptime
dropin_ops_smoke_pass_rate
dropin_community_engagement_rate
dropin_community_message_response_rate
dropin_external_partner_active_collaborations
dropin_external_partner_funding_transparency
dropin_analytics_report_accuracy
dropin_analytics_kpi_coverage
```

Feedback routes accept `source=web|miniapp|admin|api`. Admin feedback resolution creates
an audit log.

## Product Vision Agent Notes

`POST /product-vision/plan` accepts roadmap items, current development items, user feedback,
KPI metrics, and optional GitHub Project metadata. It returns an iteration plan, prioritized
backlog, feature status report, execution alerts, GitHub Project update payloads, and a
PoCC/AHIN consensus receipt for multi-agent verification.

Prioritization uses global impact, user adoption signals, tokenomics score, target-date
urgency, blockers, effort, and completion state. Alerts are emitted for milestone slips,
KPI deviation, low feature coverage, low iteration cycle completion, and blocked P0 items.

`POST /product-vision/backlog-updates` records feature status/priority updates and attaches
an accepted PoCC/AHIN receipt. `POST /admin/product-vision/github-project/sync` is dry-run by
default and returns project-board update payloads that an authenticated admin job can push
after GitHub Project field IDs and credentials are validated.

The lightweight GraphQL-compatible endpoint supports these operations through `operationName`
or matching query field names:

```text
ProductVisionPlan
ProductVisionStatus
UpdateBacklog
```

Product metrics are also exported from `GET /metrics`:

```text
dropin_product_iteration_cycle_completion_rate
dropin_product_feature_coverage
dropin_product_alerts_open
dropin_product_backlog_updates_total
```

## UX Experience Agent Notes

`POST /ux-experience/analyze` accepts heatmap points, clickstream summaries, engagement
metrics, and active experiment definitions for Web, Mini App, or global analysis. It returns
A/B test recommendations, experiment flags for Hero/MetricsCard/CTAButton, UI adjustment
guidance, Growth/Referral feed items, UX metrics, a fairness report, and a PoCC/AHIN receipt.

`POST /ux-experience/events` ingests interaction events from Web and Mini App components.
The Home surfaces attach experiment flags through `data-experiment-id` and
`data-experiment-variant`, while CTA, Hero, and MetricsCard components emit trackable
component/event metadata.

UX metrics are exported from `GET /metrics`:

```text
dropin_ux_page_retention
dropin_ux_cta_clicks
dropin_ux_cta_click_rate
dropin_ux_ab_test_success_rate
dropin_ux_interaction_events_total
```

## Growth & Referral Agent Notes

`POST /growth-referral/events` accepts referral claims, social share actions, campaign
joins, and campaign events from Telegram, Slack, Discord, Web, and Mini App surfaces. Each event is
scored through the Risk Agent anti-sybil model before Leaf Points are issued.

Verified events update campaign participation and the leaderboard through the existing
Leaf Points ledger. Suspicious or rejected events create Risk events and return alerts for
Risk/Red-Team review. Every report includes PoCC/AHIN consensus evidence over event input,
risk verification, Leaf Points ledger updates, and the Product Vision growth feed.

The lightweight GraphQL-compatible endpoint also supports:

```text
GrowthReferralIngest
GrowthReferralStatus
GrowthReferralMetrics
GrowthReferralProductVisionFeed
```

Growth metrics are exported from `GET /growth-referral/metrics` and `GET /metrics`:

```text
dropin_growth_daily_active_growth
dropin_growth_referral_multiplier
dropin_growth_engagement_rate
dropin_growth_leaf_points_issued_total
dropin_growth_suspicious_referrals_total
```

## Community Engagement Agent Notes

`POST /community-engagement/campaigns/run` accepts campaign broadcasts and user
interactions from Slack, Telegram, and Discord. It creates community updates, support
responses, feedback acknowledgements, reward reminders, Leaf Points events for verified
social engagement, and PoCC/AHIN evidence for the community run.

Feedback and support requests are persisted through the feedback service. Critical or
high-severity feedback is converted into Product Vision escalation signals so roadmap and
iteration planning can react to support blockers. Verified participation and social
engagement are routed into Growth & Referral for Leaf Points issuance.

The lightweight GraphQL-compatible endpoint also supports:

```text
CommunityEngagementRun
CommunityEngagementStatus
CommunityEngagementMetrics
CommunityEngagementNotifications
CommunityEngagementProductVisionFeed
```

Community metrics are exported from `GET /community-engagement/metrics` and `GET /metrics`:

```text
dropin_community_engagement_rate
dropin_community_message_response_rate
dropin_community_broadcasts_total
dropin_community_notifications_total
dropin_community_feedback_total
dropin_community_critical_feedback_total
dropin_community_leaf_points_issued_total
dropin_community_product_vision_escalations_total
```

## External Partner Agent Notes

`POST /external-partner/sync` accepts NGO, government, international organization, academic,
or foundation project submissions and grant allocations. Existing `projectId` submissions
are reconciled against Dropin projects; new submissions can create a project and milestone
records when full project fields are supplied.

Official partner evidence is uploaded and accepted as impact evidence, verified milestones
issue Impact Certificates, and certification events are added to the Proof-of-Planting
timeline. Grant allocations create funding reports with a transparency score, and optional
Leaf Points / RWA Fragment sync links partner certification back to tokenomics surfaces.

The agent also sends compact proof and funding signals to Analytics & Insight so partner
verified environmental impact appears in KPI dashboards and carbon/tree forecasts.

The lightweight GraphQL-compatible endpoint also supports:

```text
ExternalPartnerSync
ExternalPartnerStatus
ExternalPartnerMetrics
ExternalPartnerFundingReports
```

External Partner metrics are exported from `GET /external-partner/metrics` and `GET /metrics`:

```text
dropin_external_partner_active_collaborations
dropin_external_partner_funding_transparency
dropin_external_partner_verified_milestones_total
dropin_external_partner_impact_certificates_total
dropin_external_partner_funding_reports_total
dropin_external_partner_proof_timeline_updates_total
dropin_external_partner_leaf_points_issued_total
dropin_external_partner_rwa_updates_total
```

## Content / Education Agent Notes

`POST /content-education/progress` accepts Learn-Own-Earn module progress, quiz results,
time-on-module, and engagement scores. The agent verifies module completion, unlocks
achievements, updates Leaf Points through the campaign ledger, and mints a deterministic
Forest Ranger NFT when the full curriculum and quizzes are complete.

NFT minting is represented as a smart-contract-shaped mint receipt with chain, contract,
token ID, metadata URI/hash, and mock transaction hash for testnet/manual execution. If the
course is complete but no wallet is connected, the mint status is `pending_wallet`.

The lightweight GraphQL-compatible endpoint also supports:

```text
ContentEducationProgress
ContentEducationStatus
ContentEducationMetrics
```

Education metrics are exported from `GET /content-education/metrics` and `GET /metrics`:

```text
dropin_education_learning_completion_rate
dropin_education_nft_issuance_rate
dropin_education_quiz_pass_rate
dropin_education_leaf_points_issued_total
dropin_education_forest_ranger_nfts_total
```

## Governance Agent Notes

`POST /governance/proposals/process` accepts a DAO proposal plus token-holder votes. The
agent deduplicates holder votes, applies quadratic voting weight as `sqrt(voiceCredits ||
tokenBalance)`, checks quorum and approval threshold, records a smart-contract-shaped DAO
state update, and emits execution commands.

Passed proposals create Product Vision and Ops follow-up commands plus a Smart Contract
state update command. Rejected proposals keep downstream Product/Ops actions blocked. Every
report includes Product Vision, Ops, PoCC/AHIN, and Smart Contract notifications plus a
PoCC/AHIN consensus receipt over proposal, votes, on-chain state, and execution commands.

The status dashboard reads governance metrics for proposal execution and community
participation.

The lightweight GraphQL-compatible endpoint also supports:

```text
GovernanceProcessProposal
GovernanceStatus
GovernanceMetrics
```

Governance metrics are exported from `GET /governance/metrics` and `GET /metrics`:

```text
dropin_governance_proposal_execution_rate
dropin_governance_community_participation
dropin_governance_proposals_total
dropin_governance_executed_proposals_total
dropin_governance_average_approval_rate
```

## Risk / Red-Team Agent Notes

`POST /risk-red-team/analyze` accepts transaction observations, referral events,
Proof-of-Planting submissions, and Tree Lotto draw metadata. The agent detects payment
amount/currency/memo mismatches, duplicate or sybil-like referrals, fake planting proof
signals, and lottery draw anomalies.

Non-dismissed findings create risk events. Payment, Tree Lotto, and Proof-of-Planting
findings above the auto-challenge threshold also create challenge tickets using the existing
challenge board. Every report includes actionable admin alerts plus a PoCC/AHIN consensus
receipt over the input, findings, challenge board, and alert set.

The lightweight GraphQL-compatible endpoint also supports:

```text
RiskRedTeamAnalyze
RiskRedTeamStatus
RiskRedTeamMetrics
RiskRedTeamAlerts
```

Risk / Red-Team metrics are exported from `GET /risk-red-team/metrics` and `GET /metrics`:

```text
dropin_risk_red_team_detection_rate
dropin_risk_red_team_false_positive_rate
dropin_risk_red_team_analyzed_signals_total
dropin_risk_red_team_findings_total
dropin_risk_red_team_challenge_tickets_total
dropin_risk_red_team_high_severity_total
```

## Ops / Infrastructure Agent Notes

`POST /ops-infrastructure/deployments/trigger` accepts GitHub push context,
deployment trigger metadata, Worker health observations, log samples, and optional smoke
test observations. It models the GitHub Actions and Cloudflare Pages/Workers pipeline,
automatically evaluates `/ready` and `/api/ready` through the launch-readiness service, and
records rollback decisions when production health is unsafe.

The report includes deployment steps, smoke-test results, Worker health, log alerts,
optional rollback commands, PoCC/AHIN evidence, and notifications queued for Growth and
Product Vision agents. Dry runs are safe by default; a production deploy requires
`trigger.confirm=true` and `trigger.dryRun=false`.

The lightweight GraphQL-compatible endpoint also supports:

```text
OpsInfrastructureTrigger
OpsInfrastructureStatus
OpsInfrastructureMetrics
OpsInfrastructureAlerts
```

Ops / Infrastructure metrics are exported from `GET /ops-infrastructure/metrics` and
`GET /metrics` for Prometheus and Grafana dashboards:

```text
dropin_ops_mean_response_time_ms
dropin_ops_uptime
dropin_ops_deployment_success_rate
dropin_ops_smoke_pass_rate
dropin_ops_open_incidents_total
dropin_ops_rollbacks_total
dropin_ops_pipelines_total
```

## Analytics & Insight Agent Notes

`POST /analytics-insight/reports/generate` accepts all-agent event logs,
Proof-of-Planting snapshots, forecast horizon, and KPI targets. The agent aggregates
current metrics from Product Vision, UX, Wallet, Tree Lotto, Proof-of-Planting, Carbon,
PoCC/AHIN, Growth, Content, Governance, Risk, Ops, and system status services, then returns
dashboard panels, chart series, forecast predictions, Slack alert payloads, and a PoCC/AHIN
consensus receipt.

The report is optimized for the Web Dashboard and Mini App MetricsCard surfaces. It produces
tree-growth and carbon-impact forecasts with confidence intervals, KPI coverage/readiness
signals, event-log severity charts, and alerts when report accuracy, KPI coverage, proof
coverage, or individual KPIs drift below target.

The lightweight GraphQL-compatible endpoint also supports:

```text
AnalyticsInsightGenerate
AnalyticsInsightStatus
AnalyticsInsightMetrics
AnalyticsInsightDashboard
AnalyticsInsightPredictions
AnalyticsInsightAlerts
```

Analytics metrics are exported from `GET /analytics-insight/metrics` and `GET /metrics`:

```text
dropin_analytics_report_accuracy
dropin_analytics_kpi_coverage
dropin_analytics_agent_metric_coverage
dropin_analytics_proof_data_coverage
dropin_analytics_prediction_confidence
dropin_analytics_reports_total
dropin_analytics_kpis_total
dropin_analytics_charts_total
dropin_analytics_predictions_total
dropin_analytics_event_logs_total
```

## Wallet & Payment Agent Notes

`POST /wallet-payments/confirm` accepts a `paymentIntentId`, transaction hash, optional
wallet signature, observed amount/currency for adapter-backed rails, and optional ticket
mint parameters. TON/Toncoin intents are verified through the TON testnet adapter against
hash, recipient, amount, currency, memo, network, and raw payload hash. USDC and other
cross-chain testnet paths use the existing submit/confirm adapter contract.

Confirmed lottery-entry payments are posted to the Fund ledger and then idempotently assign
a Ticket NFT through the lottery entry flow. The response includes transaction confirmation,
receipt, Ticket NFT assignment, Fund ledger update, Proof-of-Planting update, failure alert
routing for Risk/Red-Team agents when verification fails, and a PoCC/AHIN consensus receipt.

The lightweight GraphQL-compatible endpoint also supports:

```text
WalletPaymentConfirm
WalletPaymentMetrics
```

Wallet payment metrics are exported from `GET /wallet-payments/metrics` and `GET /metrics`:

```text
dropin_wallet_payment_successful_transaction_rate
dropin_wallet_payment_confirmation_latency_ms
dropin_wallet_payment_confirmed_total
dropin_wallet_payment_failed_total
```

## Tree Lotto Agent Notes

`POST /tree-lotto/rounds/:id/execute` consumes tickets created from confirmed Wallet Agent
Payment Intents, optionally auto-closes an open round, finalizes deterministic winners, and
returns Tree NFT assignments, RWA token allocations, mock smart-contract records, Fund and
Impact Certificate agent notifications, draw metrics, and a PoCC/AHIN consensus receipt.

The agent enforces the public 70/20/10 split:

```text
70% Winner prize pool
20% Verified reforestation
10% Operations and protocol overhead
```

Ticket and winner records are represented as on-chain record payloads with deterministic
local roots and mock transaction hashes. RWA token allocations are generated for every drop:
positive allocations reference persisted RWA fragments, while non-eligible entries retain a
zero allocation record for auditability.

The lightweight GraphQL-compatible endpoint also supports:

```text
TreeLottoExecute
TreeLottoStatus
TreeLottoMetrics
```

Tree Lotto metrics are exported from `GET /tree-lotto/metrics` and `GET /metrics`:

```text
dropin_tree_lotto_fairness_verification_score
dropin_tree_lotto_draw_punctuality_ms
dropin_tree_lotto_rwa_allocation_correct
dropin_tree_lotto_on_chain_records_total
```

## Proof-of-Planting Agent Notes

`POST /proof-of-planting/validate` accepts tree GPS observations, IoT sensor telemetry,
satellite observations, and PoPP proof hashes. The agent validates evidence completeness,
generates per-tree Merkle leaves, anchors the Proof-of-Planting root, issues an Impact
Certificate when validation passes, and returns a Proof Timeline for Web and Mini App.

When a campaign, milestone, or RWA fragment list is supplied, the agent also awards Leaf
Points, advances project milestone progress, and marks RWA fragments as impact-verified.
Every validation report includes an AHIN consensus receipt that combines evidence,
IoT/satellite oracle checks, blockchain anchor, certificate, and fund/tokenomics updates.

The lightweight GraphQL-compatible endpoint also supports:

```text
ProofOfPlantingValidate
ProofOfPlantingStatus
ProofOfPlantingTimeline
ProofOfPlantingMetrics
```

Proof-of-Planting metrics are exported from `GET /proof-of-planting/metrics` and
`GET /metrics`:

```text
dropin_popp_evidence_completeness
dropin_popp_validation_success_rate
dropin_popp_average_validation_score
dropin_popp_proofs_total
dropin_popp_certificates_total
dropin_popp_rwa_updates_total
```

## Carbon Accounting Agent Notes

`POST /carbon-accounting/compute` accepts a verified Proof-of-Planting report, tree
metadata, species/region growth rates, and optional RWA fragment IDs. It computes annual
per-tree and per-region CO2e absorption, writes a carbon accounting ledger, builds on-chain
token metadata payloads, and updates RWA fragments to the `carbon_estimated` state when the
Proof Timeline is consistent.

This ledger is pre-MRV carbon accounting only. It is not a certified carbon credit issuance,
not a carbon tax offset, and not guaranteed yield. Timeline discrepancies, missing metadata,
non-verified proof status, and missing growth rates are returned as alerts and lower the
report status to `needs_review` or `rejected`.

The lightweight GraphQL-compatible endpoint also supports:

```text
CarbonAccountingCompute
CarbonAccountingStatus
CarbonAccountingLedger
CarbonAccountingMetrics
```

Carbon metrics are exported from `GET /carbon-accounting/metrics` and `GET /metrics`:

```text
dropin_carbon_token_precision
dropin_carbon_sequestration_accuracy
dropin_carbon_annual_co2e_tonnes
dropin_carbon_accounted_trees_total
dropin_carbon_discrepancies_total
dropin_carbon_rwa_updates_total
```

## PoCC / AHIN Consensus Agent Notes

`POST /pocc-ahin/consensus/commit` accepts proposed state transitions from Payment,
Tree Lotto, Proof-of-Planting, Carbon Accounting, Fund, Risk, Oracle, and Operator agents.
Each transition is normalized into a deterministic intent, verified with Ed25519 when a
signature/public key is supplied, checked for conflicting target states, and committed into
a Merkle root when the quorum passes.

Verified commits return a PoCC/AHIN commit certificate, an anchor receipt, the standard
AHIN consensus receipt, downstream notifications for dependent agents, and operational
metrics. Conflicted or unsigned/invalid-signature commits are returned as blocked
certificates so downstream agents do not execute ambiguous state transitions.

The lightweight GraphQL-compatible endpoint also supports:

```text
PoccAhinConsensusCommit
PoccAhinConsensusStatus
PoccAhinConsensusMetrics
```

PoCC/AHIN consensus metrics are exported from `GET /pocc-ahin/consensus/metrics` and
`GET /metrics`:

```text
dropin_ahin_consensus_latency_ms
dropin_ahin_conflict_rate
dropin_ahin_proof_verification_success
dropin_ahin_commits_total
dropin_ahin_conflicts_total
```

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
10% CanopyProof Operations
```

The pages continue to consume existing readiness, feedback, campaign, lottery, payment,
impact, challenge, fund, and status endpoints.

---

# Phase 1 RFC: CanopyProof OS API Surface

Status: design baseline

The current V1 API remains the compatibility surface. The following endpoints
define the target production API for CanopyProof OS modules. Endpoint names are
contracts for implementation planning, not proof that all handlers already
exist.

## API Principles

- All writes require authenticated Dropin identity.
- Admin and organization mutations require RBAC/ABAC authorization.
- Every mutation emits an audit event.
- AI analysis endpoints create advisory records only.
- Public endpoints must never imply certified carbon credits, tax offsets,
  guaranteed yield, automatic CANOPY distribution, or mainnet fund movement.

## Global Impact Command Center

```text
GET /global/overview
GET /global/regions
GET /global/regions/:regionId
GET /global/projects
GET /global/projects/:projectId
GET /global/layers/impact
GET /global/layers/biodiversity
GET /global/layers/water
GET /global/layers/risk
```

Required behavior:

- public-safe read model.
- project and evidence lineage links.
- explicit status labels for estimated, observed, reviewed, and challenged
  values.

Implemented authenticated read endpoint:

```text
GET /canopyproof/dashboard/global
```

`GET /canopyproof/dashboard/global` returns a versioned, read-only Global Impact
Command Center envelope. Durable PostgreSQL authorization selects the latest
`impact.global_command_center_snapshots` row in a repeatable-read transaction,
strictly parses every bounded JSON column, and independently replays region,
activity, lineage, safety, and dashboard roots. A missing snapshot returns
`503 CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE`; malformed or
root-inconsistent data returns
`503 CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID`. Production never falls
back to process-local aggregation.

Success responses identify `apiVersion` as
`canopyproof.global-command-center.v2` and `authority` as
`postgresql_append_only_snapshot`. Development compatibility responses are
explicitly labeled `process_local_compatibility`, and the production web client
rejects them. All responses are `private, no-store`. The endpoint is readable
through CanopyProof RBAC but is not anonymous; it cannot create proof, issue
certificates, move funds, distribute CANOPY, or make carbon-credit/tax-offset
claims. Each region includes a root-bound `spatial` member. It is `withheld` by
default; `generalized` is accepted only for a one-degree centroid bound to the
current region source root and project count, a minimum cohort of three,
distinct privacy and safeguarding review roots, and a current validity
interval. Raw coordinates, GPS accuracy, and scene bounding boxes are not part
of the response. The governed snapshot writer, spatial-disclosure authority/
writer, and production route activation remain closed.

## Evidence Collection Network

```text
POST /evidence/reports
GET  /evidence/reports/:evidenceId
POST /evidence/media/presign
POST /evidence/sync-batches
GET  /evidence/sync-batches/:batchId
GET  /evidence/:evidenceId/community-attestations
POST /evidence/:evidenceId/community-attestations
GET  /evidence/:evidenceId/audit
```

Write requirements:

- `Idempotency-Key` required for offline sync.
- media hash required before evidence acceptance.
- GPS/EXIF/device metadata stored as normalized evidence metadata.
- anonymous reports may be accepted only as non-settlement-grade observations.
- exact offline sync replays are idempotent; conflicting evidence ID reuse is
  challenged and cannot overwrite the previous evidence envelope.
- community attestations can support or challenge evidence, but they are
  non-final and route back to accredited human review.

## Environmental Proof Engine

```text
POST /verification/validation-runs
POST /verification/ai-observations
POST /verification/review-tasks
POST /verification/review-tasks/:taskId/decisions
GET  /verification/review-tasks
GET  /verification/review-tasks/:taskId
POST /verification/challenges
POST /verification/challenges/:challengeId/resolve
```

Required behavior:

- validation and AI observations are advisory.
- review decisions require reviewer role and organization scope.
- challenge resolution appends state; it does not delete evidence.

## TerraProof Earth Intelligence

```text
GET  /terra/layers
GET  /terra/layers/:layerId/tiles/:z/:x/:y
GET  /terra/scenes
GET  /terra/scenes/:sceneId
POST /terra/connectors/:connectorId/runs
GET  /terra/connectors/:connectorId/runs/:runId
```

Required metadata:

- dataset.
- provider.
- acquisition timestamp.
- processing version.
- spatial resolution.
- license.
- confidence and missing-data flags.

Implemented compatibility endpoints for the current CanopyProof OS slice live
under `/canopyproof/terra/*`; the non-prefixed `/terra` namespace remains the
target consolidated API surface.

```text
GET  /canopyproof/terra/status
GET  /canopyproof/terra/layers
GET  /canopyproof/terra/layers/:id
GET  /canopyproof/terra/scenes
GET  /canopyproof/terra/scenes/:id
POST /canopyproof/terra/connectors/:connectorId/runs
GET  /canopyproof/terra/connectors/:connectorId/runs/:runId
```

Implemented behavior:

- layer catalog includes satellite base imagery, NDVI, vegetation, water,
  drought, wildfire, and land-change layers.
- connector families are `sentinel`, `landsat`, `nasa`, and `open_climate`.
- every scene records provider, dataset, region, acquisition timestamp,
  processing version, spatial resolution, license, bounding box, cloud cover,
  missing-data flags, confidence score, signal summary, scene hash, and
  `terra_scene` audit event.
- connector run writes are limited to `owner`, `admin`, `verifier`,
  `researcher`, and `agent`; observer/community roles can read layer, scene,
  and run metadata but cannot create connector runs.
- missing data, high cloud cover, drought, wildfire, or low-NDVI warnings are
  retained as quality flags rather than hidden or promoted into final proof.

## Certificates

```text
POST /certificates
GET  /certificates
GET  /certificates/:certificateId
GET  /certificates/:certificateId/versions
POST /certificates/:certificateId/submit-review
POST /certificates/:certificateId/approve
POST /certificates/:certificateId/challenge
POST /certificates/:certificateId/revoke
```

Certificate response must include the disclosure:

```text
Environmental Proof Record only. Not a certified carbon credit, financial
asset, carbon-tax offset, or guaranteed-yield instrument.
```

## ESG Reporting

```text
POST /reports/esg
GET  /reports/esg
GET  /reports/esg/:reportId
POST /reports/esg/:reportId/submit-review
POST /reports/esg/:reportId/approve
GET  /reports/esg/:reportId/export.pdf
GET  /reports/esg/:reportId/export.json
```

Required behavior:

- report lineage links to projects, evidence, certificates, funding, governance,
  and methodology version.
- report export logs an audit event.
- public reports include limitations and claim boundaries.

Implemented compatibility endpoints for the current proof-engine slice live
under `/canopyproof/reports/esg/*`; the non-prefixed `/reports/esg` contract
remains the target consolidated API namespace.

### Route-Closed Canonical ESG Authority

The durable canonical authority is intentionally not exposed as HTTP. Internal
callers currently use the typed command boundaries in:

```text
CanopyProofEsgMetricAuthorityService.publishDefinition
CanopyProofEsgMetricAuthorityService.recordResult
CanopyProofEsgMetricAuthorityService.projectDefinition
CanopyProofEsgMetricAuthorityService.projectResult
CanopyProofCanonicalEsgReportingAuthorityService.publishReport
CanopyProofCanonicalEsgReportingAuthorityService.projectReport
resolveCanonicalEsgInstitutionalSource
```

Canonical report publication requires at least one current signed
Environmental Proof source and at least one current governed metric result.
Each metric result must bind its immutable definition/version, exact value
state, unit, uncertainty root, calculation artifact, independent calculator and
human reviewer, current source set, result root, and canonical projection root.
The report commits source-member and metric-member roots into its artifact,
framework disclosures, semantic event, and report root.

No `/canopyproof/esg-metrics/*` or canonical report mutation route is mounted.
`routeMounted=false` and `productionActivationEnabled=false` are normative
fail-closed controls. The mounted `/canopyproof/reports/esg/*` compatibility
surface must not be presented as this authority and remains unsuitable for
institutional reliance.

### Route-Closed Public Transparency Authority

The canonical privacy-minimized authority is an internal typed boundary only:

```text
CanopyProofPublicTransparencyAuthorityService.reviewDisclosure
CanopyProofPublicTransparencyAuthorityService.publish
CanopyProofPublicTransparencyAuthorityService.projectPublication
PrismaCanopyProofPublicTransparencyRepository.commitReview
PrismaCanopyProofPublicTransparencyRepository.commitPublication
PrismaCanopyProofPublicTransparencyRepository.projectPublication
```

Review and publication commands require independent accredited humans and
current Environmental Proof, challenge, lifecycle, MRV, and managed-signature
authority. PostgreSQL commits the fact, semantic event, database audit event,
and exact command receipt atomically. Public projections contain no coordinate,
geometry, raw evidence, contributor, reviewer, rationale, credential, or
signature bytes and visibly downgrade for challenge, suspension, revocation,
expiry, supersession, or stale authority.

No `/canopyproof/explorer/*` route is mounted. The existing
`/canopyproof/public-records*` endpoint is a process-local compatibility read
model whose response explicitly reports `canonical:false`, `durable:false`,
and `institutionalRelianceAuthorized:false`. It is not an adapter to the
canonical authority and must not be used for institutional reliance.

## Partners And Organizations

```text
POST /organizations
GET  /organizations
GET  /organizations/:organizationId
POST /organizations/:organizationId/verification
POST /organizations/:organizationId/memberships
PATCH /organizations/:organizationId/memberships/:membershipId
POST /organizations/:organizationId/accreditations
POST /organizations/:organizationId/data-sharing-agreements
GET  /partners
GET  /partners/:organizationId
```

Required behavior:

- organization-scoped roles.
- accreditation status visible in review decisions.
- membership changes append audit events.

Implemented compatibility endpoints for the current CanopyProof OS slice live
under `/canopyproof/organizations/*` and `/canopyproof/partners/*`; the
non-prefixed `/organizations` and `/partners` namespaces remain the target
consolidated API surface.

The canonical append-only organization lifecycle and appeal authority has no
HTTP route. The mounted `/canopyproof/organizations/:id/verification` endpoint
is a compatibility surface and is not an institutional reliance path. A future
route migration must preserve current registration-reference re-resolution,
cross-organization human separation, exact idempotency, session invalidation,
and terminal revocation; it requires a separate reviewed activation.

The canonical organization accreditation authority is also route-closed. Its
domain/repository surface is:

```text
commitApplication(fact, idempotencyKey, resolveCurrentSubjectAuthority)
commitReview(fact, idempotencyKey, resolveCurrentGovernanceAuthority)
commitDecision(fact, idempotencyKey, resolveCurrentGovernanceAuthority)
commitControl(fact, idempotencyKey, resolveCurrentGovernanceAuthority)
getProjection(organizationId, applicationId, asOf, actorId)
getAuthoritySnapshot(organizationId, actorId)
```

Its transaction-bound governance resolver is
`CanopyProofCanonicalOrganizationAccreditationResolver`. It derives actor
authority only from an active signed root charter or an active canonical
organization accreditation. The companion root-governance service exposes
`propose`, `attest`, `decide`, explicit-as-of projection, snapshot replay, and
durable commit methods, but none are HTTP endpoints.

Its transaction-bound governance resolver is
`CanopyProofCanonicalOrganizationAccreditationResolver`. It derives actor
authority only from an active signed root charter or an active canonical
organization accreditation. The companion root-governance service exposes
`propose`, `attest`, `decide`, explicit-as-of projection, snapshot replay, and
durable commit methods, but none are HTTP endpoints.

This is not an HTTP contract. It requires explicit as-of time, exact retry,
current profile/policy/authority re-resolution, independent external human
review and decision, a maximum 366-day approval interval, and no adverse-state
fallback. The mounted accreditation endpoints remain compatibility surfaces.
No adapter may mount the canonical writer until the implemented root-governance
protocol has completed a separately approved real ceremony and legacy
classification, least-privilege roles, native database gates, session
invalidation, security, legal, and operator-approved activation are complete.

```text
GET  /canopyproof/partners/status
POST /canopyproof/organizations
GET  /canopyproof/organizations
GET  /canopyproof/organizations/:id
POST /canopyproof/organizations/:id/verification
GET  /canopyproof/partners
GET  /canopyproof/partners/:organizationId
POST /canopyproof/organizations/:id/memberships
GET  /canopyproof/organizations/:id/memberships
PATCH /canopyproof/organizations/:id/memberships/:membershipId
POST /canopyproof/organizations/:id/accreditations
GET  /canopyproof/organizations/:id/accreditations
POST /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/organizations/:id/data-sharing-agreements
POST /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreement-revocations/:revocationId
POST /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreement-supersessions/:supersessionId
POST /canopyproof/organizations/:id/data-access-requests
GET  /canopyproof/organizations/:id/data-access-requests
GET  /canopyproof/data-access-requests/:requestId
PATCH /canopyproof/data-access-requests/:requestId
POST /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-deliveries/:deliveryId
POST /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-use-attestations/:attestationId
POST /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-enforcement-cases/:caseId
POST /canopyproof/data-use-enforcement-cases/:caseId/access-restrictions
GET  /canopyproof/data-access-requests/:requestId/restrictions
GET  /canopyproof/data-access-restrictions/:restrictionId
POST /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-accountability-packets/:packetId
POST /canopyproof/data-access-accountability-packets/:packetId/verify
GET  /canopyproof/data-access-accountability-packets/:packetId/verifications
GET  /canopyproof/data-access-accountability-verifications/:verificationId
POST /canopyproof/data-access-accountability-packets/:packetId/disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/status
GET  /canopyproof/public-accountability/data-access-disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId
POST /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId
POST /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId
POST /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId/notices
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/notices
GET  /canopyproof/public-accountability/data-access-disclosure-notices/:noticeId
```

Implemented behavior:

- Production identity and organization-authority writes use the PostgreSQL
  trust registry. Participant registration and reputation updates, organization
  registration and verification, membership changes, and accreditation
  decisions, plus data-sharing agreement creation, revocation, and
  supersession, data-access request submission, human access decisions,
  hash-only audit export manifest creation, and purpose-bound delivery receipt
  registration, plus hash-only data-use attestation, independent enforcement
  review, separately approved access restriction, and hash-only accountability
  packet creation, replay verification, and public disclosure publication,
  plus public disclosure challenge submission, independent challenge
  resolution, and correction/withdrawal notice publication, require a bounded
  `Idempotency-Key`.
  The key and request are stored only as hashes in an append-only command
  receipt.
- Each durable authority command runs at serializable isolation and commits its
  current-state mutation, normalized source rows, semantic audit event, and
  command receipt atomically. Exact retries do not reapply the effect and return
  the receipt-bound projection at the original request, decision, manifest,
  delivery, attestation, enforcement-review, restriction, packet, or
  replay-verification, disclosure-publication, disclosure-challenge,
  disclosure-resolution, or disclosure-notice event; conflicting retries return
  `409 CANOPYPROOF_TRUST_REGISTRY_CONFLICT`.
- Production never falls back to process memory. A missing/unavailable durable
  registry returns `503 CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE`; a missing or
  invalid idempotency key returns `400 CANOPYPROOF_IDEMPOTENCY_REQUIRED`.
- `GET /canopyproof/partners/status` includes `trustRegistry` configuration and
  `countsAuthoritative`. Compatibility-service counts are authoritative only in
  explicit `development_memory` mode. They are labelled non-authoritative in
  PostgreSQL mode.
- Data-sharing agreement versions, revocations, and constrained
  renewal/supersession lineage, plus purpose-bound data-access requests and
  append-only independent human decisions, hash-only delivery receipts, and
  data-use attestations, enforcement reviews, and predecessor-bound access
  restrictions, plus hash-only accountability packet generation, replay
  verification, disclosure publication, public disclosure reads, and public
  disclosure challenge and resolution create/list/get, plus correction or
  withdrawal notice create/list/get, use durable PostgreSQL adapters.
  Receipt registration
  records delivery lineage; it does not stream, download, decrypt, or otherwise
  transfer dataset bytes. Notice publication is restricted to a verified human
  target-organization owner/admin who is independent from the original
  publisher, challenger, and final reviewer. Production never reports an
  in-memory notice success.
- organization profile registration is limited to `owner` and `admin`.
- organization reads, partner reads, membership lists, accreditation lists, and
  data-sharing agreement lists accept `owner`, `admin`, `verifier`,
  `researcher`, `community`, and `observer`. Governed data-access request
  reads accept institutional reviewer and observer roles.
- membership grants, membership status changes, accreditation decisions, and
  data-sharing agreements are limited to `owner` and `admin`.
- data-access requests are limited to `owner`, `admin`, `verifier`, and
  `researcher`; data-access decisions are limited to `owner`, `admin`, and
  `verifier`. Production also requires the authenticated organization binding
  to match the request organization. PostgreSQL independently checks active
  membership and prevents the requester from deciding their own request.
- organization profiles record type, jurisdiction, public contact, operating
  regions, verification capabilities, registration number, hash-bound
  institutional documents, authorized users, verification status, trust level,
  accreditation status, and data-sharing policy.
- `/canopyproof/organizations/:id/verification` is limited to `owner`, `admin`,
  and `verifier`. `document_review` requires at least one hash-bound document;
  `verified` requires a registration number and at least one document. Every
  transition appends an `organization_verification` audit event. This remains
  the compatibility behavior; it does not replace the route-closed canonical
  lifecycle/document-review/appeal fact stream.
- membership, accreditation, data-sharing, and data-sharing agreement
  revocation changes append typed audit events without deleting historical
  records.
- data-sharing agreement revocations are limited to `owner` and `admin`.
  They require evidence event roots, create a separate
  `data_sharing_agreement_revocation` audit event, mark the current agreement
  view as revoked, block new access requests, and block future delivery
  receipts for already-approved requests under that agreement.
- data-sharing agreement renewals and supersessions are limited to `owner` and
  `admin`. They create a new immutable successor plus a separate append-only
  lineage record. Renewals must preserve scope, use, and privacy tier while
  extending a finite expiry; other supersessions may only reduce scope, use,
  privacy tier, or duration. The predecessor cannot authorize later requests or
  deliveries after the transition.
- data-access requests must reference a non-revoked, non-expired data-sharing
  agreement; requested dataset scopes and permitted uses must be subsets of the
  agreement, confidential access requires institutional trust, and approval
  requires an independent human decision actor. The request fact remains an
  immutable pending row; approvals, denials, revocations, and expirations are
  separate append-only decision rows and current state is replayed in semantic
  event sequence. Responses include only bounded request metadata, hashes,
  status, and safety flags; they do not authorize raw data export, final proof
  authority, carbon credits, tax offsets, financial assets, or guaranteed
  yield.
- data-access deliveries bind an approved request to an existing audit export
  manifest looked up server-side. The receipt records manifest ID, export hash,
  entry root, classification, channel, recipient actor ID, delivery root, and
  safety flags only. It never embeds raw evidence or personal data and cannot
  exceed the approved request privacy tier. `POST` accepts only `manifestId`,
  `channel`, `recipientActorId`, `purpose`, and optional `deliveredAt`; manifest
  organization, export hash, entry root, and classification are read from the
  durable manifest row and body-supplied substitutes are ignored. The delivery
  actor must hold active owner/admin/verifier membership, the recipient must be
  a verified participant with classification-appropriate membership, and the
  actor and recipient must differ. Request approval, agreement validity,
  expiration, manifest validity, organization ownership, and exact semantic
  event binding are rechecked in PostgreSQL in the same serializable command.
  PostgreSQL independently recomputes the deterministic receipt ID, receipt
  hash, delivery root, and semantic-event payload hash from canonical JSON.
- data-use attestations bind a delivery receipt to either within-scope use,
  no-use, misuse challenge, or revocation-request states. Within-scope
  attestations require output hashes; misuse challenges and revocation requests
  require evidence event roots. Attestations remain non-final audit evidence
  and cannot create proof authority, financial claims, carbon credits, tax
  offsets, or guaranteed yield. `POST` accepts only usage state, bounded use
  statement, output hashes, evidence event roots, limitations, and optional
  timestamp; delivery, request, manifest, delivery root, and access root are
  loaded server-side. Positive and no-use statements must come from the named
  recipient. Positive use additionally requires current request/agreement/
  manifest authority and no restriction lineage; no-use and challenge evidence
  remain recordable after revocation or expiry. PostgreSQL requires a verified
  human with active institutional membership and recomputes attestation ID/hash,
  usage root, expected event action, and semantic-event payload hash.
- data-use enforcement cases can only be opened from misuse-challenged or
  revocation-requested attestations. They require an independent human reviewer,
  evidence event roots, an explicit case state, and an allowed response action.
  `POST` accepts only those bounded review fields and an optional timestamp;
  organization, request, delivery, manifest, attestation, and safety lineage are
  loaded server-side. PostgreSQL requires a verified human owner/admin/verifier
  and separates the reviewer from the attester, delivery recipient, and
  delivery actor. It retains every challenge evidence root and independently
  recomputes upstream and case hashes, roots, expected event action, and event
  payload. Reviews remain admissible after request/agreement revocation or
  expiry because historical accountability cannot be suppressed. Enforcement
  cases are append-only governance records; any actual access mutation still
  requires a separate approval path and no case can create proof, credit,
  tax-offset, financial-asset, or guaranteed-yield authority.
- data-access restrictions are the separate approval path for enforcement
  outcomes that affect future deliveries. Only `owner` and `admin` can create
  restrictions from enforcement cases. The actor must be a verified human and
  be independent from the enforcement reviewer, original attester, delivery
  recipient, and delivery actor. Each immutable row binds the exact previous
  restriction ID, root, and state, retains every enforcement evidence root, and
  is ordered by the organization semantic-event sequence rather than a caller
  timestamp. PostgreSQL independently replays the lineage and recomputes the
  canonical ID/hash/root/event payload. Active restrictions block future
  delivery receipts and positive within-scope attestations. Expiry is only a
  review deadline and never restores access automatically; a later, independently
  approved `restored` row backed by a resolved enforcement case is required.
- data-access accountability packets generate observer-readable, hash-rooted
  institutional review snapshots for a request. Creation requires a verified
  human owner/admin/verifier/researcher in the same verified organization and a
  bounded idempotency key. Counts and sorted lineage roots are derived from the
  exact organization semantic-event prefix before the packet event; callers
  cannot supply or override them. Historical reads replay that creation boundary
  instead of silently refreshing to current state. Every JSON field, ID, hash,
  root, safety boundary, and event payload is independently recomputed in
  PostgreSQL. Packet arrays are bounded and fail closed rather than truncate.
  Packets do not embed raw evidence or personal data and are not current replay
  verification, proof authority, financial claims, carbon credits, tax offsets,
  or guaranteed yield.
- data-access accountability verification replays a packet against the current
  append-only ledger. It requires a verified human institutional member who is
  independent from the packet generator. PostgreSQL first replays packet
  integrity at its creation event, then derives the current ledger immediately
  before the verification event. Clean replay returns `valid=true`. Later valid
  governance events produce only `lineage_stale`; packet hash/root mismatch
  codes are reserved for historical packet-integrity defects. Optional pinned-
  root mismatch and unsafe safety boundaries are separately reported. Issues,
  validity, stored/current hashes and roots, verification root, and event
  payload are database-derived and append-only. Verification is hash-only and
  does not grant final proof authority or any financial/carbon/tax claim.
- public accountability disclosure is a separate `owner`/`admin` publication
  action. It requires a currently valid replay verification and three distinct
  verified human actors for packet generation, replay verification, and
  publication. PostgreSQL independently replays the packet at creation,
  verification, and publication event boundaries and derives the disclosure
  ID, hash, root, exact safety object, and `FULFILL` event payload. Public
  reads require no actor headers, expose hash-only append-only records with
  `current` or `stale` lineage state, and use deterministic cursor pagination
  capped at 100 rows. Disclosure never publishes raw evidence, private contact
  data, final proof authority, carbon-credit or tax-offset claims, financial
  assets, or guaranteed yield.
- Evidence-rooted public disclosure challenges are durable and append-only.
  The challenger must be a verified human whose claimed role is backed by an
  active membership in a verified organization; cross-organization challenges
  are allowed without granting target-organization access. PostgreSQL requires
  every bounded evidence root to reference a prior semantic event and derives
  the challenge ID/hash/root/event payload. Challenge list/get reads are public,
  and disclosure views report `challenged` until durable independent review.
- Challenge resolutions are durable, append-only, and public. A verified human
  `owner`, `admin`, or `verifier` in the challenged organization must be
  independent from the challenger and disclosure publisher. Only
  `needs_more_evidence` may have one successor; `upheld` and `dismissed` are
  terminal. PostgreSQL derives the exact decision action, predecessor chain,
  ID/hash/root/event payload, and public `needs_more_evidence`,
  `correction_required`, `withdrawal_required`, or `challenge_dismissed` state.
  AI/agent actors cannot acquire final authority. A durable correction requires
  a distinct same-organization replacement disclosure that was current and
  uncontested at the notice event boundary; a withdrawal forbids a replacement.
  PostgreSQL derives exact notice safety, ID/hash/root/event payload and public
  `corrected` or `withdrawn` state while preserving the original disclosure.

## Agent Framework

```text
GET  /agents/status
GET  /agents
GET  /agents/:agentId
GET  /agents/events
POST /agents/events
```

Required behavior:

- required agents are Evidence, Verification, ESG, Funding, Risk, and Community.
- every agent action emits an AHIN event.
- agents are never final authority.
- agent-submitted events cannot impersonate another agent identity.

Implemented compatibility endpoints for the current CanopyProof OS slice live
under `/canopyproof/agents/*`; the non-prefixed `/agents` contract remains the
target consolidated namespace.

```text
GET  /canopyproof/agents/status
GET  /canopyproof/agents
GET  /canopyproof/agents/:agentId
GET  /canopyproof/agents/events
POST /canopyproof/agents/events
```

Implemented behavior:

- `/canopyproof/agents/status` exposes registry and AHIN event root status.
- agent reads require `owner`, `admin`, `verifier`, `researcher`, `community`,
  `observer`, or `agent`.
- event writes accept `owner`, `admin`, `verifier`, `researcher`, `community`,
  and `agent`.
- if the verified request principal role is `agent`, its signed subject must
  exactly match the submitted `agentId`.
- event payloads are hashed, source IDs are Merkle-rooted, and each event
  appends an `agent_event` audit event.

## Memory Layer

```text
GET  /memory/status
POST /memory/records
GET  /memory/records
GET  /memory/records/:recordId
POST /memory/recall
```

Required behavior:

- memory records are append-only institutional read models, not mutable notes.
- memory records bind subject type, subject ID, source IDs, payload hash, source
  root, retention class, scope, tags, creator, and audit event.
- recall returns deterministic read-model results and does not mutate state.
- memory cannot issue proof, approve evidence, move funds, create carbon-credit
  claims, or replace human/governance review.

Implemented compatibility endpoints for the current CanopyProof OS slice live
under `/canopyproof/memory/*`; the non-prefixed `/memory` namespace remains the
target consolidated namespace.

```text
GET  /canopyproof/memory/status
POST /canopyproof/memory/records
GET  /canopyproof/memory/records
GET  /canopyproof/memory/records/:recordId
POST /canopyproof/memory/recall
```

Implemented behavior:

- status and reads require authorized CanopyProof RBAC.
- writes accept `owner`, `admin`, `verifier`, `researcher`, and `agent`.
- records are hash-rooted and append a `memory_record` audit event.
- recall can filter by subject, project, organization, scope, and tags, and
  returns a deterministic recall root with `finalAuthority=false`.

## Funding Transparency

```text
GET  /funding/overview
POST /funding/grants
GET  /funding/grants
GET  /funding/grants/:grantId
POST /funding/allocations
GET  /funding/allocations/:allocationId
POST /funding/allocations/:allocationId/approve
POST /funding/allocations/:allocationId/release
GET  /funding/projects/:projectId/timeline
```

Required behavior:

- all release decisions link to milestones and evidence state.
- public timeline separates pledged, allocated, approved, released, and
  reconciled amounts.

Implemented compatibility endpoints for the current CanopyProof OS slice live
under `/canopyproof/funding/*`; the non-prefixed `/funding` contract remains
the target consolidated API namespace.

```text
GET   /canopyproof/funding/status
POST  /canopyproof/funding/sources
GET   /canopyproof/funding/sources
GET   /canopyproof/funding/sources/:sourceId
POST  /canopyproof/funding/allocations
GET   /canopyproof/funding/allocations
GET   /canopyproof/funding/allocations/:allocationId
POST  /canopyproof/funding/milestones
GET   /canopyproof/funding/milestones
GET   /canopyproof/funding/milestones/:milestoneId
POST  /canopyproof/funding/milestones/:milestoneId/evidence
PATCH /canopyproof/funding/milestones/:milestoneId
GET   /canopyproof/funding/ledger
GET   /canopyproof/funding/ledger/:projectId
```

Implemented behavior:

- funding source and allocation writes are limited to `owner` and `admin`.
- milestone creation is limited to `owner` and `admin`.
- evidence links accept `owner`, `admin`, `verifier`, `researcher`, and
  `community` because field contributors can attach accepted proof material.
- milestone status changes are limited to `owner`, `admin`, and `verifier`.
- ledger, source, allocation, and milestone reads accept `owner`, `admin`,
  `verifier`, `researcher`, `community`, and `observer`.
- sources, allocations, milestones, and evidence links append typed audit
  events and deterministic hashes.
- a milestone cannot be moved to `settled` unless linked evidence includes a
  review decision or proof record.
- the funding ledger is transparency-only and can reference an existing Dropin
  fund allocation ID, but it does not execute payments, move mainnet funds,
  distribute CANOPY, issue carbon credits, offset taxes, or promise yield.

## Early Warning System

```text
GET  /risk/overview
GET  /risk/alerts
GET  /risk/alerts/:alertId
POST /risk/alerts/:alertId/acknowledge
POST /risk/alerts/:alertId/escalate
GET  /risk/layers/drought
GET  /risk/layers/wildfire
GET  /risk/layers/flooding
GET  /risk/layers/ecosystem-degradation
```

Required behavior:

- alert severity and audience are explicit.
- no automated public emergency claim without reviewer/governance policy.
- acknowledgements and escalations are audited.

Implemented compatibility endpoints for the current CanopyProof OS slice live
under `/canopyproof/risk/*`; the non-prefixed `/risk` namespace remains the
existing Dropin risk/challenge API and target consolidated namespace.

```text
GET  /canopyproof/risk/status
GET  /canopyproof/risk/overview
GET  /canopyproof/risk/layers
GET  /canopyproof/risk/layers/:riskClass
GET  /canopyproof/risk/playbooks
GET  /canopyproof/risk/playbooks/:playbookId
POST /canopyproof/risk/signals
GET  /canopyproof/risk/signals
GET  /canopyproof/risk/alerts
GET  /canopyproof/risk/alerts/:alertId
GET  /canopyproof/risk/alerts/:alertId/responses
POST /canopyproof/risk/alerts/:alertId/dispatches
GET  /canopyproof/risk/alerts/:alertId/dispatches
GET  /canopyproof/risk/dispatches/:dispatchReceiptId
POST /canopyproof/risk/alerts/:alertId/playbook-activations
GET  /canopyproof/risk/alerts/:alertId/playbook-activations
GET  /canopyproof/risk/playbook-activations/:activationId
POST /canopyproof/risk/playbook-activations/:activationId/closures
GET  /canopyproof/risk/playbook-activations/:activationId/closures
GET  /canopyproof/risk/response-closures/:closureId
POST /canopyproof/risk/response-closures/:closureId/after-action-reviews
GET  /canopyproof/risk/response-closures/:closureId/after-action-reviews
GET  /canopyproof/risk/after-action-reviews/:reviewId
POST /canopyproof/risk/alerts/:alertId/acknowledge
POST /canopyproof/risk/alerts/:alertId/escalate
```

Implemented behavior:

- risk classes are `drought`, `wildfire`, `flooding`, and
  `ecosystem_degradation`.
- layers declare source families, indicator keys, update cadence, and severity
  thresholds.
- signal ingestion accepts TerraProof scenes, field evidence, community reports,
  and open climate inputs.
- signal writes are allowed for `owner`, `admin`, `verifier`, `researcher`,
  `community`, and `agent`.
- observer/community roles may read alerts, layers, overview, and responses.
- dispatch creation is limited to `owner`, `admin`, `verifier`, and `agent`;
  it records immutable delivery receipts for community, NGO, government,
  operator, or verifier audiences without raw private contact data.
- response playbooks are deterministic operational templates for drought,
  wildfire, flooding, and ecosystem degradation. Activation requires matching
  alert risk class, sufficient severity, assigned audience scope, and delivered
  or acknowledged dispatch receipts for every required audience.
- playbook activation is allowed for `owner`, `admin`, `verifier`, `community`,
  and `agent`, and writes an audited activation record. AI/agent actors cannot
  close playbooks as final authority.
- response closure is allowed only for human roles `owner`, `admin`,
  `verifier`, `researcher`, and `community`. Closure or challenge requires
  evidence IDs, reviewer-role matching, and a human-review safety boundary;
  agent actors cannot finalize response outcomes.
- after-action reviews are allowed only for institutional human roles `owner`,
  `admin`, `verifier`, and `researcher`. Reviews attach to a closure, preserve
  closure evidence references, record lessons learned, and require corrective
  actions for follow-up or governance escalation.
- acknowledgement is allowed for `owner`, `admin`, `verifier`, `researcher`,
  and `community`.
- escalation is limited to `owner`, `admin`, and `verifier`.
- a public risk message cannot be attached during escalation unless a governance
  policy ID and human reviewer are supplied.
- every signal, alert, dispatch receipt, acknowledgement, and escalation appends
  a typed audit event.

## Implemented Proof Engine Slice

The first CanopyProof OS proof API slice is implemented under `/canopyproof/*`
in `services/api/src/app.ts` and backed by
`services/api/src/domain/canopyproof/proof-service.ts`.

```text
GET  /canopyproof/status
GET  /canopyproof/identity/status
POST /canopyproof/identity/participants
GET  /canopyproof/identity/participants
GET  /canopyproof/identity/participants/:participantId
POST /canopyproof/identity/participants/:participantId/reputation-snapshots
GET  /canopyproof/identity/participants/:participantId/reputation-snapshots
GET  /canopyproof/memory/status
POST /canopyproof/memory/records
GET  /canopyproof/memory/records
GET  /canopyproof/memory/records/:recordId
POST /canopyproof/memory/recall
GET  /canopyproof/dashboard/global
GET  /canopyproof/observability/status
GET  /canopyproof/security/status
POST /canopyproof/security/access-decisions
POST /canopyproof/audit/verify
GET  /canopyproof/audit/database-streams/status
POST /canopyproof/audit/database-streams/verify
GET  /canopyproof/audit/attestations/status
POST /canopyproof/audit/attestations
GET  /canopyproof/audit/attestations
GET  /canopyproof/audit/attestations/:attestationId
GET  /canopyproof/audit/export-manifests/status
POST /canopyproof/audit/export-manifests
GET  /canopyproof/audit/export-manifests
GET  /canopyproof/audit/export-manifests/:manifestId
GET  /canopyproof/resilience/status
POST /canopyproof/resilience/drills
GET  /canopyproof/resilience/drills
GET  /canopyproof/resilience/drills/:drillId
GET  /canopyproof/governance/status
GET  /canopyproof/governance/policies
POST /canopyproof/governance/approvals
GET  /canopyproof/governance/approvals
POST /canopyproof/governance/conflict-disclosures
GET  /canopyproof/governance/conflict-disclosures
GET  /canopyproof/methodologies/status
POST /canopyproof/methodologies
GET  /canopyproof/methodologies
GET  /canopyproof/methodologies/:methodologyId
GET  /canopyproof/quality/status
POST /canopyproof/quality/scorecards
GET  /canopyproof/quality/scorecards
GET  /canopyproof/quality/scorecards/:scorecardId
GET  /canopyproof/evidence-network/status
GET  /canopyproof/agents/status
GET  /canopyproof/agents
GET  /canopyproof/agents/:agentId
GET  /canopyproof/agents/events
POST /canopyproof/agents/events
GET  /canopyproof/partners/status
POST /canopyproof/organizations
GET  /canopyproof/organizations
GET  /canopyproof/organizations/:id
POST /canopyproof/organizations/:id/verification
GET  /canopyproof/partners
GET  /canopyproof/partners/:organizationId
POST /canopyproof/organizations/:id/memberships
GET  /canopyproof/organizations/:id/memberships
PATCH /canopyproof/organizations/:id/memberships/:membershipId
POST /canopyproof/organizations/:id/accreditations
GET  /canopyproof/organizations/:id/accreditations
POST /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/organizations/:id/data-sharing-agreements
POST /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreement-revocations/:revocationId
POST /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreement-supersessions/:supersessionId
POST /canopyproof/organizations/:id/data-access-requests
GET  /canopyproof/organizations/:id/data-access-requests
GET  /canopyproof/data-access-requests/:requestId
PATCH /canopyproof/data-access-requests/:requestId
POST /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-deliveries/:deliveryId
POST /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-use-attestations/:attestationId
POST /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-enforcement-cases/:caseId
POST /canopyproof/data-use-enforcement-cases/:caseId/access-restrictions
GET  /canopyproof/data-access-requests/:requestId/restrictions
GET  /canopyproof/data-access-restrictions/:restrictionId
POST /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-accountability-packets/:packetId
POST /canopyproof/data-access-accountability-packets/:packetId/verify
GET  /canopyproof/data-access-accountability-packets/:packetId/verifications
GET  /canopyproof/data-access-accountability-verifications/:verificationId
POST /canopyproof/data-access-accountability-packets/:packetId/disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/status
GET  /canopyproof/public-accountability/data-access-disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId
POST /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId
POST /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId
POST /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId/notices
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/notices
GET  /canopyproof/public-accountability/data-access-disclosure-notices/:noticeId
GET  /canopyproof/terra/status
GET  /canopyproof/terra/layers
GET  /canopyproof/terra/layers/:id
GET  /canopyproof/terra/scenes
GET  /canopyproof/terra/scenes/:id
POST /canopyproof/terra/connectors/:connectorId/runs
GET  /canopyproof/terra/connectors/:connectorId/runs/:runId
POST /canopyproof/evidence
POST /canopyproof/evidence/media/presign
POST /canopyproof/evidence/media/objects
GET  /canopyproof/evidence/media/objects
GET  /canopyproof/evidence/media/objects/:mediaObjectId
POST /canopyproof/evidence/consent-receipts
GET  /canopyproof/evidence/consent-receipts
POST /canopyproof/evidence/consent-receipts/:receiptId/revoke
POST /canopyproof/evidence/devices/attestations
GET  /canopyproof/evidence/devices/attestations
POST /canopyproof/evidence/media/metadata-extractions
GET  /canopyproof/evidence/media/metadata-extractions
POST /canopyproof/evidence/review-tasks
GET  /canopyproof/evidence/review-tasks
POST /canopyproof/evidence/review-tasks/:taskId/resolve
POST /canopyproof/evidence/retention/evaluations
GET  /canopyproof/evidence/retention/decisions
POST /canopyproof/evidence/sync-batches
GET  /canopyproof/evidence/sync-batches/:batchId
GET  /canopyproof/evidence/mobile-sync/status
POST /canopyproof/evidence/mobile-sync/bindings
POST /canopyproof/evidence/mobile-sync/batches
POST /canopyproof/evidence/mobile-sync/recoveries
GET  /canopyproof/evidence
GET  /canopyproof/evidence/custody-events/:custodyEventId
GET  /canopyproof/evidence/:id
POST /canopyproof/evidence/:id/custody-events
GET  /canopyproof/evidence/:id/custody-events
POST /canopyproof/evidence/:id/community-attestations
GET  /canopyproof/evidence/:id/community-attestations
POST /canopyproof/evidence/:id/ai-analysis
GET  /canopyproof/verification/queue/status
POST /canopyproof/verification/queue/pipelines
POST /canopyproof/verification/queue/work-items
GET  /canopyproof/verification/queue/work-items
POST /canopyproof/verification/queue/work-items/:workItemId/start
POST /canopyproof/verification/queue/work-items/:workItemId/complete
POST /canopyproof/verification/queue/work-items/:workItemId/block
GET  /canopyproof/verification/decisions/status
POST /canopyproof/verification/decisions
GET  /canopyproof/verification/decisions
GET  /canopyproof/verification/decisions/:decisionId
GET  /canopyproof/verification/challenge-cases/status
POST /canopyproof/verification/challenge-cases
GET  /canopyproof/verification/challenge-cases
GET  /canopyproof/verification/challenge-cases/:challengeCaseId
POST /canopyproof/verification/challenge-cases/:challengeCaseId/resolve
GET  /canopyproof/public-records/status
GET  /canopyproof/public-records
GET  /canopyproof/public-records/:recordId
POST /canopyproof/proof-records
GET  /canopyproof/proof-records
GET  /canopyproof/proof-records/:recordId/certificate
GET  /canopyproof/certificates/transparency/status
POST /canopyproof/proof-records/:recordId/certificate/transparency
GET  /canopyproof/certificates/transparency/entries
GET  /canopyproof/certificates/transparency/entries/:entryId
POST /canopyproof/certificates/transparency/verify
POST /canopyproof/proof-records/:recordId/challenges
GET  /canopyproof/proof-records/:recordId/challenges
POST /canopyproof/proof-records/:recordId/challenges/:challengeId/resolve
POST /canopyproof/reports/esg/generate
GET  /canopyproof/reports/esg
GET  /canopyproof/reports/esg/:id
GET  /canopyproof/reports/esg/:id/export.json
GET  /canopyproof/reports/esg/:id/export.pdf
GET  /canopyproof/reports/institutional/status
POST /canopyproof/reports/framework-packages
GET  /canopyproof/reports/framework-packages
GET  /canopyproof/reports/framework-packages/:id
GET  /canopyproof/reports/framework-packages/:id/export.json
GET  /canopyproof/reports/framework-packages/:id/export.pdf
POST /canopyproof/reports/investor-review-packages
GET  /canopyproof/reports/investor-review-packages
GET  /canopyproof/reports/investor-review-packages/:id
GET  /canopyproof/reports/investor-review-packages/:id/export.json
GET  /canopyproof/reports/investor-review-packages/:id/export.pdf
GET  /canopyproof/funding/status
POST /canopyproof/funding/sources
GET  /canopyproof/funding/sources
GET  /canopyproof/funding/sources/:sourceId
POST /canopyproof/funding/allocations
GET  /canopyproof/funding/allocations
GET  /canopyproof/funding/allocations/:allocationId
POST /canopyproof/funding/milestones
GET  /canopyproof/funding/milestones
GET  /canopyproof/funding/milestones/:milestoneId
POST /canopyproof/funding/milestones/:milestoneId/evidence
PATCH /canopyproof/funding/milestones/:milestoneId
GET  /canopyproof/funding/ledger
GET  /canopyproof/funding/ledger/:projectId
GET  /canopyproof/projects/status
POST /canopyproof/projects
GET  /canopyproof/projects
GET  /canopyproof/projects/monitoring-events
GET  /canopyproof/projects/:projectId
POST /canopyproof/projects/:projectId/monitoring-events
GET  /canopyproof/projects/:projectId/monitoring-events
PATCH /canopyproof/projects/:projectId/status
GET  /canopyproof/risk/status
GET  /canopyproof/risk/overview
GET  /canopyproof/risk/layers
GET  /canopyproof/risk/layers/:riskClass
GET  /canopyproof/risk/playbooks
GET  /canopyproof/risk/playbooks/:playbookId
POST /canopyproof/risk/signals
GET  /canopyproof/risk/signals
GET  /canopyproof/risk/alerts
GET  /canopyproof/risk/alerts/:alertId
GET  /canopyproof/risk/alerts/:alertId/responses
POST /canopyproof/risk/alerts/:alertId/dispatches
GET  /canopyproof/risk/alerts/:alertId/dispatches
GET  /canopyproof/risk/dispatches/:dispatchReceiptId
POST /canopyproof/risk/alerts/:alertId/playbook-activations
GET  /canopyproof/risk/alerts/:alertId/playbook-activations
GET  /canopyproof/risk/playbook-activations/:activationId
POST /canopyproof/risk/playbook-activations/:activationId/closures
GET  /canopyproof/risk/playbook-activations/:activationId/closures
GET  /canopyproof/risk/response-closures/:closureId
POST /canopyproof/risk/response-closures/:closureId/after-action-reviews
GET  /canopyproof/risk/response-closures/:closureId/after-action-reviews
GET  /canopyproof/risk/after-action-reviews/:reviewId
POST /canopyproof/risk/alerts/:alertId/acknowledge
POST /canopyproof/risk/alerts/:alertId/escalate
```

Operational boundaries:

- mutating and institutional-read routes require a verified request principal.
  Production validates `Cf-Access-Jwt-Assertion` with the Cloudflare Access
  public JWKS, issuer, application audience, RS256, time claims, subject, and a
  unique recognized role. Missing or invalid identity receives `401
  CANOPYPROOF_AUTH_REQUIRED` or `401 CANOPYPROOF_AUTH_INVALID`; an authenticated
  role without route authority receives `403 CANOPYPROOF_RBAC_DENIED`.
- production binds the verified subject and exact signed role to the current
  PostgreSQL participant record on every authenticated request. Institutional
  roles also require an exact active organization membership and a
  non-suspended organization. Durable denial returns `403
  CANOPYPROOF_AUTHORIZATION_DENIED`; unavailable or inconsistent registry state
  returns `503 CANOPYPROOF_AUTHORIZATION_UNAVAILABLE` without exposing SQL,
  tokens, or trust-registry rows.
- high-risk operations use explicit assurance levels. Proof issuance,
  verification decisions, governance approvals, organization
  verification/accreditation, audit attestations, and challenge resolution
  require a verified organization with a latest approved accreditation.
  Restricted exports and institutional report generation require a verified
  organization. AI/Agent identities cannot satisfy human final-authority roles.
- raw `x-dropin-actor-id`, `x-dropin-actor-role`, and
  `x-dropin-organization-id` are a local/test compatibility mechanism only.
  The API proxy strips them and production refuses `development_headers` mode.
- all `/canopyproof/*` routes are evaluated by the API-layer security policy
  service before domain handlers execute. Responses include
  `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset`.
- all API responses receive `x-dropin-request-id`, `x-dropin-trace-id`,
  `x-dropin-span-id`, `x-dropin-telemetry-event-hash`,
  `x-dropin-otel-span-hash`, and `server-timing`. The separate Cloudflare API
  proxy strips untrusted trace state, validates strict W3C version-00 context,
  and forwards a canonical edge-parent `traceparent`; direct origin requests
  still accept only valid context. Missing or invalid trace context receives a
  generated trace ID for log/audit correlation. The span hash is
  derived from an OTLP-compatible server span with OpenTelemetry HTTP semantic
  attributes. Fail-closed RBAC and rate-limit responses are instrumented too.
- `/canopyproof/dashboard/global` is the read-only Global Impact Command Center
  API backing `/dashboard/global`. PostgreSQL-bound requests read exactly one
  append-only snapshot and replay its strict schema and deterministic roots;
  absence or tampering fails closed with `503` and no process-local fallback.
  Compatibility responses carry a distinct authority and are rejected by the
  production web client. It is an operational view only: AI remains advisory,
  human review remains required for final proof, and the response repeats the
  no-carbon-credit, no-tax-offset, no-financial-asset, no-mainnet-fund,
  no-automatic-CANOPY, and no-guaranteed-yield boundary. Snapshot writing and
  production activation remain separately governed and closed. Region geometry
  is withheld unless a current, independently privacy- and safeguarding-reviewed
  one-degree disclosure passes strict source-root, cohort, count, time and root
  replay checks; raw location fields are excluded and no disclosure writer is
  mounted.
- `/canopyproof/identity/*` provides the current Dropin identity compatibility
  layer for CanopyProof participants. It registers accountable human, agent,
  organization, and device participants with owner identity, organization scope,
  roles, credential commitments, reputation score, subject hash, and append-only
  audit history. Reputation snapshots are non-authoritative trust context: they
  carry previous score, new score, source, reason, recorder, snapshot hash, and
  audit event root, and cannot replace RBAC, governance approval, or human
  review. Community actors can register only human/device participants; agent
  actors can register only agent participants; reputation writes are limited to
  owner, admin, verifier, and researcher roles.
- `/canopyproof/memory/*` provides the Dropin OS memory compatibility layer for
  institutional recall. Memory records bind subject, source IDs, payload hash,
  source root, retention class, scope, tags, creator, memory hash, and a
  `memory_record` audit event. Recall is a deterministic read model with
  `finalAuthority=false`; it cannot issue proof, approve evidence, move funds,
  or create climate/finance claims.
- anonymous mutations are blocked at the policy boundary, and overflow or unsafe
  claim attempts create immutable `abuse_signal` challenge events.
- `/canopyproof/security/status` is RBAC-protected and returns the policy root,
  abuse root, policy count, abuse-signal count, and active bucket count for
  operational audit. It also returns a presence-only secret posture with secret
  control IDs, environment variable names, approved storage sources, configured
  booleans, rotation windows, and a posture root. It never returns secret
  values, connection strings, webhook URLs, private keys, or deployment tokens.
  The same response includes a presence-only identity-authentication posture:
  active mode, configuration validity, assertion-header name, and safety
  invariants, without issuer, audience, token, or JWKS contents.
  It also includes the durable authorization-binding posture: enforced or
  development-isolation mode, database configuration presence, and revocation /
  latest-accreditation safety invariants. It never includes participant IDs,
  membership IDs, role claims, registry rows, or connection strings.
- `/canopyproof/security/access-decisions` records ABAC decisions for sensitive
  resources. The verified request principal supplies actor identity, role, and
  optional organization scope; request bodies cannot impersonate actors. The
  decision engine enforces organization scope, classification, purpose, action,
  conflict status, and governance approval for confidential exports. Every
  decision returns its deterministic decision root and audit event.
- `/canopyproof/methodologies` records governed methodology versions for
  evidence/proof/reporting interpretation. Creation is limited to `owner`,
  `admin`, `verifier`, and `researcher`; observers and agents can read
  published, deprecated, or challenged versions but not drafts. Published
  methodologies require governance approval IDs plus human-review,
  governance-approval, and public-challenge quality gates. Every methodology
  binds slug, semantic version, scope, required data sources, quality gates,
  GPS accuracy threshold, monitoring cadence, retention window, limitations,
  claim boundary, quality-gate root, methodology hash, and `methodology` audit
  event. Revisions create new versions instead of mutating old ones.
- `/canopyproof/quality/scorecards` records deterministic data-quality gates
  for evidence, proof records, projects, reporting packages, and Terra scenes.
  Creation is limited to `owner`, `admin`, `verifier`, and `researcher`;
  observers and agents may read the resulting hash-only scorecards. Each
  scorecard binds source roots, evidence IDs, quality signals, dimensional
  scores, findings, finding root, decision, quality hash, and a
  `quality_scorecard` audit event. Decisions are `pass`, `needs_review`, or
  `blocked`, and remain advisory quality gates only: human review and
  governance approval are still required before institutional reliance.
- `/canopyproof/audit/verify` recomputes submitted audit event roots, checks
  previous-root linkage, rejects duplicate event IDs, and optionally verifies
  supplied payloads against each event `payloadHash`. Passing verifications
  return an `audit_verification` `ASSERT` event; tampered or incomplete chains
  return an `audit_verification` `CHALLENGE` event with issue codes. Durable
  deployments persist verification attempts in append-only
  `audit.audit_verifications` rows.
- `/canopyproof/audit/database-streams/status` describes the hash-only v2
  PostgreSQL mutation-stream contract, genesis hash, checkpoint version, and
  bounded replay limit. `/canopyproof/audit/database-streams/verify`
  independently recomputes one complete row-scoped stream and optional
  checkpoint. It rejects mixed streams, sequence gaps, duplicate sequence or
  event hashes, invalid genesis/previous links, actor/timestamp or state-hash
  mutation, and checkpoint range/root/hash mismatches. Both routes require an
  authenticated owner, admin, verifier, researcher, or observer; Agent actors
  are excluded. Verification is read-only and does not create an attestation,
  approve proof, certify a carbon credit, move funds, create a tax offset, or
  guarantee yield.
- `/canopyproof/audit/attestations` records independent institutional audit
  attestations over evidence, proof-record, organization, funding, governance,
  reporting, or system scopes. Creation is limited to `owner`, `admin`,
  `verifier`, and `researcher`; observer reads are allowed. Each attestation
  binds auditor organization, methodology, standards, source event roots,
  `/audit/verify` chain root, findings, limitations, public summary, decision,
  claim boundary, deterministic attestation hash, and an `audit_attestation`
  event. `qualified` and `reject` decisions remain public review records; they
  are not overwritten into clean proof. Attestations do not issue carbon
  credits, move funds, create tax offsets, guarantee yield, or distribute
  CANOPY.
- `/canopyproof/audit/export-manifests` records hash-only institutional data
  room manifests. Creation is limited to `owner`, `admin`, `verifier`, and
  `researcher`; observer and agent reads filter out restricted/confidential
  manifests. In PostgreSQL mode all reads are scoped to the signed principal's
  organization and creation requires a bounded `Idempotency-Key`, active
  membership, verified-organization assurance, an exact semantic event, and a
  matching requester organization. Each manifest binds kind, scope, subject,
  purpose, classification, redacted entry index, entry root, redaction root,
  source event root, expiration, safety assertions, export hash, and an
  `audit_export_manifest` event. Entries identify resources by ID, content hash,
  optional event root, classification, and redaction policy. The API never
  carries raw evidence payloads, private contacts, keys, payment credentials,
  or unrestricted personal data. A manifest is not a delivery receipt and does
  not make `/data-access-requests/:requestId/deliveries` reachable.
- `/canopyproof/resilience/*` records database, API-origin, object-storage, and
  edge failure drills. Database partial writes must be atomic or recoverable;
  public final state must not leak during failure; API outages must serve
  read-only fallback or queued retries; retryable outage paths require an
  `Idempotency-Key`.
- `/canopyproof/governance/*` exposes policy-bound approvals and conflict
  disclosures. Approval reviewer identity and role are derived from
  authenticated request headers. Conflict disclosures with unresolved status
  block proof approval validation.
- proof-record governance approvals bind to a deterministic subject ID derived
  from `projectId` and sorted `evidenceIds`, which lets institutions approve an
  exact issuance request before the final record hash exists.
- `POST /canopyproof/evidence` creates an immutable evidence-registration fact
  in PostgreSQL mode and requires `Idempotency-Key`. The authenticated actor,
  exact organization role, and current project status/region/root/authority time are resolved
  server-side. PostgreSQL independently recomputes structural issues, initial
  `validated` or `challenged` status, evidence hash/root, claim boundary, and
  exact semantic event. Allowed contributor roles are `owner`, `admin`,
  `verifier`, `researcher`, and `community`; agents are excluded. `valid=true`
  means structural ingestion only and remains pending AI and human review.
- `GET /canopyproof/evidence` supports strict `projectId`, `evidenceType`,
  `status`, and `limit` filters (maximum 100). PostgreSQL reads are always
  constrained to the authenticated organization. `GET
  /canopyproof/evidence/:id` enforces the same ownership boundary and hydrates
  the singular immutable event before returning the record.
- `/canopyproof/evidence/media/presign` creates a content-addressed upload
  intent for JPG, PNG, WebP, or JSON evidence without returning private storage
  credentials.
- `/canopyproof/evidence/media/objects` confirms object-storage completion only
  for an existing upload intent. The content hash, object key, and byte length
  must match the intent; encryption-at-rest metadata and malware scan status are
  required. Clean media becomes `available`; pending scans, quarantined media,
  and duplicate content hashes remain non-final and cannot support clean proof
  lineage.
- `/canopyproof/evidence/consent-receipts` records consent, lawful basis,
  privacy mode, policy version, evidence hash, retention window, and optional
  device fingerprint commitment before device-bound evidence processing.
  The durable E1 authority stores the receipt as an immutable fact and appends
  revocation separately; future metadata extraction fails closed once a
  receipt is revoked or expired. The current HTTP route is still a guarded
  development compatibility route and does not yet call that authority.
- `/canopyproof/evidence/devices/attestations` records secure enclave, WebAuthn,
  platform-key, manual field-kit, or sensor-gateway attestations against an
  active consent receipt. Device risk flags are audit events and force
  downstream metadata extraction into review rather than clean proof. The E1
  command adapter rejects caller-asserted `verified` provider state and accepts
  only `modeled_only` until a dedicated provider-signature verifier exists.
- `/canopyproof/evidence/media/metadata-extractions` records EXIF/GPS
  extraction hashes, observed time, location, accuracy, sensor hints, and
  extractor version. Extraction requires an available clean media object, active
  consent, and active device attestation; low GPS accuracy, privacy masking,
  device risk flags, low reputation, or clock skew produce `needs_review`.
- `/canopyproof/evidence/review-tasks` exposes the Evidence Network moderation
  queue for non-final media and metadata artifacts. Quarantined media,
  duplicate media, pending scans, and risky EXIF/GPS extraction open tasks that
  require `owner`, `admin`, `verifier`, or `researcher` resolution before clean
  proof lineage can rely on them.
- `/canopyproof/evidence/retention/evaluations` runs append-only retention
  automation against consent-bound evidence. Revoked consent creates
  minimization decisions; elapsed retention windows create tombstone decisions.
  The route records policy decisions and does not silently delete evidence.
- `/canopyproof/evidence/sync-batches` is the legacy process-memory compatibility
  surface. It remains disabled by default and is never the production mobile
  sync authority.
- `/canopyproof/evidence/mobile-sync/status` exposes only authenticated activation
  posture and safety boundaries. `/bindings` derives actor, organization,
  project, consent, device and evidence roots from PostgreSQL; `/batches`
  revalidates those roots before appending the real E4 bundle; `/recoveries`
  returns an existing actor/organization/device-scoped acknowledgement without
  writing. Raw notes are excluded, every write is idempotent, and an
  acknowledgement is not final verification.
- `/bindings` uses the serializable `evidence.mobile-binding.create` Trust
  Registry command. Actor membership, project authority, active consent,
  current-or-needs-review device state, fingerprint binding, and canonical
  evidence registration are resolved under one subject/project lock boundary.
  A monotonic, non-authoritative database fence turns a pre-lock serializable
  snapshot into a retry rather than allowing stale consent/project authority.
  An exact retry replays the immutable historical binding; a new command after
  revocation is denied before any receipt or evidence row is added.
- The three mobile-sync command routes remain default closed. They require the
  Prisma repository, a database URL, Cloudflare Access JWT authentication,
  `CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED=true`, the independent
  `CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED=true` gate, and
  `CANOPY_PRODUCTION_UNLOCK=true`. Development-header principals, memory
  authorization bindings, and service fallback are rejected before durable
  service resolution. The web coordinator has an injected transport contract
  only; no production `fetch` or automatic background loop is mounted.
- `/bindings`, `/batches`, and `/recoveries` enforce fixed 16 KiB, 256 KiB, and
  4 KiB body limits before parsing. Authenticated bounded attempts then consume
  one-minute actor and organization budgets in PostgreSQL. Exhaustion returns
  `429` with rate headers and an immutable deterministic abuse-event root;
  missing or invalid admission authority returns `503`. No raw body, IP,
  coordinate, token, credential, idempotency key, or private key enters the
  admission relations. This does not replace Cloudflare edge WAF or DDoS
  controls.
- `/canopyproof/evidence/:id/custody-events` appends chain-of-custody events
  over existing evidence artifacts. Each event binds the evidence ID, artifact
  type and ID, source root, previous custody root, custodian actor, optional
  organization, policy ID, and safety flags. Custody events are not final proof
  authority and cannot contain raw private contact data or private keys.
- `/canopyproof/evidence/:id/community-attestations` records community support,
  challenge, or needs-review context. It appends audit history and can challenge
  evidence, but it is never final proof authority.
- `/canopyproof/evidence/:id/ai-analysis` is the legacy development-only
  advisory simulation. It runs Canopy AI checks for
  duplicate evidence, GPS spoofing, satellite contradiction, anomaly detection,
  fraud detection, ecological reasoning, and survival-estimation readiness.
  Requests can attach `satelliteObservation`, `ecologicalObservation`, and
  `survivalObservation` envelopes. Ecological contradictions create review
  findings, while survival contradictions or survival below the institutional
  threshold create critical findings that must be explicitly resolved by human
  review before proof issuance. AI never becomes final authority. Allowed
  roles: `owner`, `admin`, `verifier`, `researcher`, `agent`.

The media, consent, device, metadata, review-task, retention, legacy sync,
custody, community-attestation, and singular AI routes above remain development
compatibility contracts. In enforced production mode they return
`CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE` until each route has both an append-only
PostgreSQL adapter and all named external-provider/privacy gates. E1 now has a
tested consent/revocation/device adapter, but provider verification and route
security review remain incomplete, so the route family stays closed and never
falls back to process memory. The separately gated mobile-sync adapter is backed
by the durable Evidence Registry and E4 repository, but stays closed pending its
own activation review and does not open any compatibility route.

The durable evidence verification authority exposes:

- `POST /canopyproof/evidence/:id/validation-runs` appends a deterministic
  validation fact selected from the versioned
  `canopyproof-evidence-validation-core@1.0.0` ruleset. The caller cannot supply
  checks, issues, outcome, confidence, evidence root, sequence, event root, or
  validation root. Verified Agents and active organization humans with an exact
  owner/admin/verifier/researcher role may execute the deterministic ruleset.
- `GET /canopyproof/evidence/:id/validation-runs` and
  `GET /canopyproof/verification/validation-runs/:runId` return immutable,
  organization-scoped validation facts. Reads require an authenticated human
  organization role; Agents do not receive broad evidence-history reads.
- `POST /canopyproof/evidence/:id/ai-analyses` is Agent-only. It requires the
  latest validation run, model provider/name/version, model artifact and prompt
  hashes, dataset snapshot roots, prior semantic event roots, bounded findings,
  claimed confidence, and execution environment. Recommendation and effective
  confidence are derived. The output is always `advisoryOnly: true` and cannot
  approve evidence.
- `GET /canopyproof/evidence/:id/ai-analyses` and
  `GET /canopyproof/verification/ai-analyses/:analysisId` return immutable,
  organization-scoped AI provenance facts to authenticated human roles.
- `POST /canopyproof/evidence/:id/human-reviews` accepts only a verified human
  `verifier` or `researcher`. Approval additionally requires the exact verifier
  role, active organization membership, current approved accreditation, a
  passing latest validation, the complete AI analysis set for that cycle, and
  explicit non-escalated disposition of every high/critical finding. The
  contributor and referenced AI agents cannot review their own work.
- `GET /canopyproof/evidence/:id/human-reviews`,
  `GET /canopyproof/verification/human-reviews/:reviewId`, and
  `GET /canopyproof/evidence/:id/reliance` replay the append-only stream. A new
  validation or AI fact invalidates any earlier current reliance projection
  without deleting the historical review.
- `POST /canopyproof/evidence/:id/challenges` appends an evidence-specific
  challenge against the exact current reliance root. It accepts bounded reason,
  severity, rationale, prior evidence-event roots, and hash-only supporting
  artifacts. The challenger must be a verified human with an active owner,
  admin, verifier, or researcher membership in a verified organization. A
  cross-organization challenger gains no target membership or evidence access.
- `GET /canopyproof/evidence/:id/challenges` and
  `GET /canopyproof/verification/evidence-challenges/:challengeId` are scoped to
  the evidence-owning organization and return immutable challenge facts.
- `POST /canopyproof/verification/evidence-challenges/:challengeId/resolutions`
  appends `needs_more_evidence`, `dismissed`, or `upheld`. Resolution requires an
  independent human in the evidence-owning organization; terminal decisions
  require a currently accredited verifier. `needs_more_evidence` is the only
  decision that can have one successor resolution.
- `GET /canopyproof/verification/evidence-challenges/:challengeId/resolutions`
  and
  `GET /canopyproof/verification/evidence-challenge-resolutions/:resolutionId`
  return the ordered immutable resolution chain.
- `POST /canopyproof/verification/evidence-challenge-resolutions/:resolutionId/corrections`
  remedies only the latest upheld resolution. `withdraw` preserves history and
  removes current reliance. `supersede` requires a distinct, same-project,
  same-organization replacement whose own current reliance is independently
  `approved`; approval is never copied between streams.
- `GET /canopyproof/evidence/:id/corrections` and
  `GET /canopyproof/verification/evidence-corrections/:correctionId` return the
  immutable remedy lineage. Reliance replay projects unresolved review as
  `challenged`, upheld-without-remedy as `correction_required`, and completed
  remedies as `withdrawn` or `superseded`.
- `POST /canopyproof/evidence/:id/final-decisions` is restricted to an
  authenticated human with the exact `verifier` role, active membership in the
  evidence-owning organization, and current approved organization
  accreditation. It appends `verify`, `reject`, or `request_changes` over the
  exact current challenge-aware reliance root, validation, complete AI set,
  authoritative human review, predecessor event, and prior final decision. The
  final verifier must differ from the contributor, current reviewer, current AI
  agents, challenge/resolution/correction actors, and previous final verifier.
- `GET /canopyproof/evidence/:id/final-decisions`,
  `GET /canopyproof/verification/evidence-final-decisions/:decisionId`, and
  `GET /canopyproof/evidence/:id/final-verification` are organization-scoped.
  The projection is `not_decided`, `verified`, `rejected`,
  `changes_requested`, or `stale`. Any later evidence-stream fact makes the
  previously current decision stale without deleting it.

Every durable `POST` requires `Idempotency-Key` and runs in a serializable
PostgreSQL transaction. Facts bind the immutable evidence/project/organization
boundary, canonical command/fact/root hashes, one evidence-stream sequence,
the exact predecessor event, and database audit history. `approved` remains
bounded evidence reliance. Final `verified` means only that this evidence
registration completed the internal two-human decision stage. Neither state is
an Environmental Proof Record, certificate, certified carbon credit, carbon-tax
offset, financial asset, guaranteed yield, mainnet-fund instruction, or
automatic CANOPY distribution.

### Durable Environmental Proof Record authority

The PostgreSQL trust registry now implements the internal command adapters for
candidate derivation, candidate approval, record issuance, record retrieval,
and current/stale status projection. These adapters consume only the current
project authority, current verified final evidence decisions, accepted
post-decision monitoring, a separately governed methodology publication, and
the current `environmental_proof_record` policy. Candidate approvers are unique
independent humans and the complete quorum requires an accredited verifier plus
an owner/admin. The issuer is another independent owner/admin.

The intended organization-scoped routes are:

```text
POST /canopyproof/projects/:projectId/environmental-proof-candidates/derive
GET  /canopyproof/environmental-proof-candidates/:candidateId
POST /canopyproof/environmental-proof-candidates/:candidateId/approvals
GET  /canopyproof/environmental-proof-candidates/:candidateId/approvals
POST /canopyproof/environmental-proof-records
GET  /canopyproof/environmental-proof-records/:recordId
GET  /canopyproof/environmental-proof-records/:recordId/status
```

These HTTP routes remain deliberately unopened and return durable-unavailable
under enforced authorization. They must not be enabled until the disposable
native PostgreSQL concurrency gate and the Phase 1 security review pass. The
older `/canopyproof/proof-records*` path does not read the canonical authority
tables and remains a closed compatibility surface in production.

- `/canopyproof/verification/queue/pipelines` creates the deterministic
  Evidence -> Validation -> AI Analysis -> TerraProof -> Human Review -> Proof
  Issuance work plan. Work items are audit-rooted, dependency-bound, and
  capacity-gated before public proof can be issued.

The queue, legacy decision dossier, generalized compatibility challenge, proof-record,
public-record, and certificate-transparency routes remain compatibility
surfaces. In enforced mode they are closed until their own durable authority is
connected exclusively to the evidence verification facts above.
- `/canopyproof/verification/queue/work-items` exposes explicit queue work for
  validation, advisory AI, TerraProof cross-check, human review, and proof
  issuance. Queue backpressure blocks new work instead of silently dropping or
  reordering evidence. `community` actors cannot create, transition, or read
  privileged queue work; `observer` can read only.
- `/canopyproof/verification/queue/work-items/:workItemId/start`,
  `/complete`, and `/block` append audit transitions. A work item with unmet
  dependencies becomes `blocked` with a dependency reason code, while
  escalations remain non-final until accountable human or governance review.
- `/canopyproof/verification/decisions` records append-only human verification
  decision dossiers. Dossiers bind subject, evidence IDs, advisory AI analysis
  IDs, Terra scene IDs, quality scorecard IDs, human-review work item IDs,
  governance approval IDs, audit event roots, source root, decision hash,
  reviewer identity, reviewer role, limitations, and safety boundary. `agent`
  and `community` actors cannot write decision dossiers; observers can read.
  An `approve` decision cannot be recorded when the referenced quality gate is
  `blocked`, and it must include evidence, AI, quality scorecard, human-review,
  and audit-root references. The dossier does not issue a certificate, carbon
  credit, tax offset, financial asset, guaranteed yield, mainnet fund, or
  automatic CANOPY distribution.
- `/canopyproof/verification/challenge-cases` opens and reads generalized
  institutional challenge cases for evidence, proof records, projects, quality
  scorecards, verification decisions, methodologies, Terra scenes, reporting
  packages, and funding allocations. Community and institutional actors may
  open cases; observers and agents may read; only `owner`, `admin`, `verifier`,
  and `researcher` actors may resolve them. Cases bind subject, reason,
  severity, title, description, content-addressed challenge evidence, related
  audit roots, evidence root, challenge hash, safety boundary, and
  `challenge_case` audit history. Resolution can accept, reject, withdraw, or
  request more evidence; no challenge case issues carbon credits, tax offsets,
  financial assets, guaranteed yield, mainnet funds, or automatic CANOPY
  distribution.
- `/canopyproof/public-records` is the public-safe Environmental Proof Record
  compatibility registry read model. Its safety object reports
  `canonical:false`, `durable:false`, and
  `institutionalRelianceAuthorized:false`. It supports `projectId`, `regionId`, and
  `status=issued|challenged|revoked` filters and can be read without actor
  headers under the public-read rate-limit policy. The response redacts precise
  evidence locations, contributor identifiers, internal verification history,
  governance rationale, and raw evidence IDs. It exposes record status, project
  summary, coarse regional location, evidence root/count, monitoring root/count,
  governance approval root/count, public challenge summaries, source record
  hash, public record hash, and the non-credit/non-financial claim boundary.
- `/canopyproof/public-records/:recordId` returns the same public-safe
  projection for one Environmental Proof Record. `challenged` and `revoked`
  records remain visible with public challenge outcomes instead of being
  deleted or hidden.
- The compatibility `/canopyproof/proof-records` implementation requires human approval and governance approval
  before issuing an Environmental Proof Record. Governance approval IDs must
  resolve to approved `proof_record` decisions for the deterministic subject ID.
  The requested `projectId` must already exist in the CanopyProof project
  registry, preventing orphan proof records that cannot be traced to an
  accountable restoration, biodiversity, water, soil, or climate-observation
  project. Optional `monitoringEventIds` must resolve to accepted monitoring
  events on the same project before they can support issuance. Issuance is
  verifier-only at this route boundary; body-supplied reviewer identity is
  overwritten with the authenticated request actor. It is not the durable
  Environmental Proof authority and remains closed in enforced mode.
- `/canopyproof/proof-records/:recordId/certificate` returns a deterministic
  CanopyProof Certificate Artifact for institutional verification. The artifact
  includes project ID, primary and evidence locations, evidence root, evidence
  IDs, verification history, monitoring timeline, accepted project monitoring
  event IDs, monitoring event root, monitoring event summaries, contributors,
  governance approval IDs, governance approval summaries, public challenge
  summaries, source record hash, certificate hash, and the mandatory
  non-credit/non-financial claim boundary. Governance approval summaries include
  policy ID, reviewer, reviewer role, decision, rationale, conflict disclosure,
  approval hash, and audit event root so an institutional verifier can audit the
  approval chain from the artifact alone. It is a read model over the proof
  record; it does not issue a certified carbon credit, tax offset, automatic
  CANOPY distribution, or guaranteed-yield instrument.
- `/canopyproof/proof-records/:recordId/certificate/transparency` publishes the
  deterministic certificate artifact into a certificate transparency ledger.
  Publication is limited to `owner`, `admin`, `verifier`, and `researcher`.
  Transparency entries store certificate ID/version/hash, record ID, project
  ID, source record hash, evidence root, monitoring-event root, governance
  approval root, challenge root, claim-boundary root, replayable entry hash,
  publication actor, safety boundary, and a `certificate_transparency_entry`
  audit event. The entry is a verification index only; it is not a carbon-credit
  registry, tax-offset registry, financial instrument registry, or token
  distribution authority.
- `/canopyproof/certificates/transparency/entries` and `/:entryId` expose
  observer-safe certificate transparency rows. Filters include `recordId`,
  `projectId`, and `status=active|challenged|revoked`.
- `/canopyproof/certificates/transparency/verify` recomputes the certificate
  artifact hash and replayable transparency entry hash from a submitted
  artifact. Verification attempts append `certificate_verification` audit
  events with `ASSERT` for clean replay and `CHALLENGE` for tampering,
  mismatched roots, or unsafe claim boundaries.
- `/canopyproof/proof-records/:recordId/challenges` opens a public,
  authenticated challenge against an issued Environmental Proof Record. The
  challenge stores challenger identity, reason, severity, evidence IDs/hashes,
  an abuse-control policy, public outcome, and audit history. Opening a
  challenge moves the proof record to `challenged`.
- `/canopyproof/proof-records/:recordId/challenges/:challengeId/resolve` is
  limited to `owner`, `admin`, and `verifier`. Accepting a challenge revokes the
  record; rejecting it restores `issued` only when no other open or accepted
  challenge remains.
- `/canopyproof/reports/esg/generate` builds an institutional ESG report from
  issued Environmental Proof Records. Report generation is limited to `owner`,
  `admin`, `verifier`, and `researcher`; `observer` may read and export reports
  but cannot mutate them.
- ESG reports include GRI disclosures, SDG mappings, TNFD preparation material,
  biodiversity reporting, climate impact reporting, lineage roots, JSON export,
  API export metadata, and deterministic PDF export bytes.
- `/canopyproof/reports/framework-packages` creates UN SDG, UNFCCC, GRI, ISSB,
  and TCFD compatibility packages from verified organizations and issued proof
  records. Every metric must include source proof record, methodology,
  confidence, verification reference, audit reference, and limitations.
- `/canopyproof/reports/investor-review-packages` creates investor
  due-diligence packages containing organization profile, project portfolio,
  evidence coverage, verification statistics, risk profile, audit roots, ESG
  report references, JSON export metadata, and deterministic PDF export bytes.
  Creation is limited to `owner`, `admin`, `verifier`, and `researcher`;
  `observer` may read and export only.
- `/canopyproof/funding/*` exposes a transparency ledger for sources,
  allocations, milestones, evidence links, and project timeline totals. It is
  intentionally read/write separated from the legacy `/fund/*` payment and
  treasury endpoints, and can only reference existing Dropin fund allocation IDs
  as lineage.
- `/canopyproof/projects/*` exposes the project registry backbone for
  restoration, biodiversity, water, soil, and climate-observation work. Project
  registration is an immutable `submitted` fact. Current status is replayed from
  append-only predecessor-bound transitions and monitoring assertions. In
  PostgreSQL mode, mutation routes require `Idempotency-Key`, exact active
  organization role, canonical hash/root parity, and an exact semantic event;
  production does not return the process-memory compatibility registry. Active
  and monitored transitions require an independent project-applicable governance
  approval. Project profiles are not certified carbon credits, carbon-tax
  offsets, financial assets, mainnet fund movements, guaranteed-yield
  instruments, or automatic CANOPY distribution claims.
- `/canopyproof/projects/:projectId/monitoring-events` appends project-level
  monitoring observations linked to existing prior evidence objects or satellite
  observations from the same project. Each event stores observer role, previous
  and resulting status/root, bounded indicators and numeric metrics, canonical
  event/root, and a `project_monitoring_event` semantic event. Observers can read;
  only owner, admin, verifier, or researcher actors can append. List filters are
  strict and limited to at most 100 results.
- No HTTP route exists for the canonical institutional project-lifecycle
  authority. Its typed repository methods are `commitRegistration`,
  `commitReview`, `commitTransition`, `commitControl`, `getHistory`, and
  `getProjection`. Each command requires a bounded idempotency key plus a
  transaction-owned resolver for current project, actor, policy and
  stage-specific source authority. The route-closed canonical resolver now
  composes project, actor, governed policy, funding, Environmental Proof, and
  post-verification monitoring authority from durable facts in that same
  transaction. Closure and restoration remain unavailable until dedicated
  governed authorities exist. The route-closed projection alone may use
  `PROPOSED`, `FUNDED`, `VERIFIED`, `LONG_TERM_OBSERVATION`, `CLOSED`,
  `CHALLENGED`, `SUSPENDED`, `REVOKED`, or `EXPIRED`; compatibility project
  routes may not infer or publish those stages. Opening an HTTP surface still
  requires a separate reviewed activation with native PostgreSQL evidence.
- A route-closed `mrv` PostgreSQL authority now binds a strict subset of durable
  project, evidence, verification, community, monitoring, methodology, and
  Environmental Proof roots into immutable edges and independently reviewed
  graph snapshots. No `/canopyproof/mrv/*` route is mounted. Native PostgreSQL
  concurrency, current challenge reliance, privacy, authorization, and
  institutional review must pass before internal reads or writes are exposed.
- `/canopyproof/risk/*` exposes environmental early-warning layers, signals,
  alerts, acknowledgements, and escalations. It is intentionally separate from
  the existing Dropin `/risk/*` anti-abuse and challenge workflows.
- `/canopyproof/agents/*` exposes the Dropin-integrated CanopyProof agent
  registry and AHIN event ledger. Agents are advisory/coordinating actors, not
  final proof, funding, ESG, or emergency authorities.
- Proof records are not certified carbon credits, financial assets, carbon-tax
  offsets, guaranteed yield instruments, or automatic CANOPY distribution
  claims.
