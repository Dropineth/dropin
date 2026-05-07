# Dropin Earth Monorepo

Dropin Earth V1 is the production engineering line for a Google-Earth-like Tree Lotto, verified planting evidence, Impact Certificate, and Red Team Challenge Layer.

This repository is structured to prove the V1 loop:

```text
Region explorer
→ Tree Lotto
→ deterministic randomness certificate
→ $CANOPY / RWA Fragment drop result
→ Tree Planting Fund allocation
→ evidence hash
→ Impact Certificate
→ Challenge Layer
→ Public testnet campaign report
```

## Apps

- `apps/web` - public Dropin Earth web app.
- `apps/admin` - operations console skeleton.
- `apps/miniapp-ton` - Telegram Mini App growth entry using Payment Intents.

## Services

- `services/api` - Hono API gateway with in-memory V1 engines and Prisma schema.

## Packages

- `packages/schemas` - Zod schemas, DTOs, state machines, seed data.
- `packages/crypto` - deterministic hashing, Merkle roots, replayable lottery helpers.
- `packages/ui` - shared UI primitives.

## Local Setup

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Run infrastructure:

```bash
docker compose up
```

Run API:

```bash
DROPIN_REPOSITORY=memory npm --workspace services/api run dev
```

Run web:

```bash
npm run dev:web
```

Run the Telegram Mini App:

```bash
npm run dev:miniapp-ton
```

The API listens on `http://localhost:8787`. The web app uses `http://localhost:3001`.
The admin app uses `http://localhost:3002`, and the Mini App uses `http://localhost:3003`.

## Prisma Persistence

When Docker Desktop is running, use the Prisma-backed flow:

```bash
docker compose up -d
npm run db:push
npm run seed
npm run dev
```

Useful URLs:

```text
Web:
http://localhost:3001

Round:
http://localhost:3001/lottery/round_v1_ggw_demo

Projects:
http://localhost:3001/projects
http://localhost:3001/projects/project_v1_ggw_demo
http://localhost:3001/certificates/cert_v1_ggw_demo
http://localhost:3001/challenges
http://localhost:3001/fund
http://localhost:3001/fund/allocations/fund_allocation_v1_ggw_tree_fund_demo
http://localhost:3001/payments/payment_intent_v1_ggw_demo
http://localhost:3001/campaigns
http://localhost:3001/campaigns/campaign_v1_ggw_testnet
http://localhost:3001/status
http://localhost:3001/feedback
http://localhost:3001/faq
http://localhost:3001/red-team
http://localhost:3001/about

Mini App:
http://localhost:3003
http://localhost:3003/round/round_v1_ggw_demo
http://localhost:3003/me/forest
http://localhost:3003/share/ticket_v1_ggw_demo?roundId=round_v1_ggw_demo
http://localhost:3003/campaign/campaign_v1_ggw_testnet

Admin:
http://localhost:3002/campaigns
http://localhost:3002/campaigns/campaign_v1_ggw_testnet
http://localhost:3002/payments
http://localhost:3002/payments/reconciliation
http://localhost:3002/projects
http://localhost:3002/evidence
http://localhost:3002/certificates
http://localhost:3002/risk
http://localhost:3002/challenges
http://localhost:3002/fund
http://localhost:3002/treasury
http://localhost:3002/settlements
http://localhost:3002/launch
http://localhost:3002/status
http://localhost:3002/feedback

API:
http://localhost:8787/health
http://localhost:8787/lottery/rounds
http://localhost:8787/lottery/rounds/round_v1_ggw_demo
http://localhost:8787/lottery/rounds/round_v1_ggw_demo/results
http://localhost:8787/projects
http://localhost:8787/projects/project_v1_ggw_demo
http://localhost:8787/impact-certificates/cert_v1_ggw_demo
http://localhost:8787/risk/events
http://localhost:8787/challenges
http://localhost:8787/payments/intents
http://localhost:8787/payments/intents/payment_intent_v1_ggw_demo
http://localhost:8787/payments/intents/payment_intent_v1_ton_testnet_demo/instructions
http://localhost:8787/payments/reconciliation
http://localhost:8787/telegram/rounds
http://localhost:8787/telegram/forest
http://localhost:8787/campaigns
http://localhost:8787/campaigns/campaign_v1_ggw_testnet
http://localhost:8787/campaigns/campaign_v1_ggw_testnet/leaderboard
http://localhost:8787/campaigns/campaign_v1_ggw_testnet/report
http://localhost:8787/me/leaf-points
http://localhost:8787/ready
http://localhost:8787/status/system
http://localhost:8787/admin/launch/readiness
http://localhost:8787/metrics
http://localhost:8787/public/launch-pack
http://localhost:8787/fund/allocations
http://localhost:8787/treasury/transactions
http://localhost:8787/settlements
```

If the database is not running, set `DROPIN_REPOSITORY=memory` for local UI/API work.

For the Phase 8 mock/manual payment flow, run the API with:

```bash
DROPIN_REPOSITORY=memory DROPIN_PAYMENT_MODE=mock npm --workspace services/api run dev
```

## Phase 12 Launch Readiness

Phase 12 adds public testnet launch gates, system status, metrics, and feedback handling.
It does not add mainnet payment rails, private-key handling, carbon credit claims, RWA
yield logic, or carbon tax claims.

Useful checks:

```bash
curl http://localhost:8787/ready
curl http://localhost:8787/status/system
curl http://localhost:8787/admin/launch/readiness
curl http://localhost:8787/metrics
```

Admin launch checks are recorded with audit logs:

```bash
curl -X POST http://localhost:8787/admin/launch/check \
  -H 'content-type: application/json' \
  -d '{"actor":"launch-admin","campaignId":"campaign_v1_ggw_testnet"}'
```

See `docs/launch-readiness.md`, `docs/runbook-testnet-campaign.md`, and
`docs/incident-response.md`.

## Phase 13 External Launch Pack

Phase 13 packages the Great Green Wall Testnet Campaign for external testers. It adds
public onboarding copy, FAQ, red-team guidance, safety disclosures, and launch assets under
`docs/launch-pack/`.

External-facing routes:

```text
http://localhost:3001/campaigns/campaign_v1_ggw_testnet
http://localhost:3001/faq
http://localhost:3001/red-team
http://localhost:8787/public/launch-pack
```

Campaign pages must visibly state the testnet-only boundary: no mainnet funds, no automatic
`$CANOPY` distribution, non-transferable Leaf Points, Impact Certificate is not a certified
carbon credit, RWA Fragment is not guaranteed yield, and `$CANOPY` does not offset carbon tax.

## Phase 14 Operator Dry Run

Phase 14 adds non-destructive operator rehearsals:

```bash
npm run dry-run:operator
npm run dry-run:failure
```

Both scripts default to dry-run mode. Write mutations require:

```bash
DRY_RUN_MODE=false DROPIN_OPERATOR_WRITE_MODE=true
```

The scripts still refuse writes unless the API reports `repositoryMode=memory`. See
`docs/operator-dry-run.md`, `docs/failure-injection.md`, and
`docs/launch-decision-record.md`.

## Phase 5 Solana Proof Anchoring

Phase 5 adds a thin Anchor program at `contracts/solana`. The program only anchors
proof roots and minimal claim/revoke state:

```text
Round Root Anchor
Drop Root verification
Impact Certificate Hash Anchor
Merkle Drop Claim
Challenge / Revoke Anchor
```

It deliberately does not move lottery computation, carbon estimates, RWA yield, or carbon
tax logic on-chain.

Run local Anchor checks when the Anchor toolchain is installed:

```bash
npm run anchor:build
npm run anchor:test
```

The npm script resets the generated local `test-ledger`, then uses `anchor build --no-idl`
and `anchor test --skip-build --no-idl` for the current Solana 1.18 / Rust 1.75 SBF
toolchain on this machine. See `docs/solana-anchor.md`.

Prepare a devnet E2E payload:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com \
DROPIN_SOLANA_PROGRAM_ID=<deployed-program-id> \
DROPIN_SOLANA_ISSUER_KEYPAIR_PATH=/absolute/path/to/issuer-keypair.json \
npm run anchor:devnet:e2e
```

More detail: `docs/solana-anchor.md`.

## Phase 2/3 Routes

```text
GET  /lottery/rounds
GET  /lottery/rounds/:roundId
POST /lottery/rounds/:roundId/enter
POST /admin/lottery/rounds/:roundId/close
POST /admin/lottery/rounds/:roundId/finalize
GET  /lottery/rounds/:roundId/results
GET  /me/tickets
GET  /me/drops
GET  /me/rwa-fragments
```

## Phase 4 Routes

```text
GET  /projects
GET  /projects/:projectId
POST /admin/projects
POST /admin/projects/:projectId/milestones
POST /admin/projects/:projectId/approve
POST /admin/projects/:projectId/fund
POST /admin/projects/:projectId/release-milestone

POST /evidence
GET  /evidence
GET  /evidence/:evidenceId
POST /admin/evidence/:evidenceId/review

POST /impact-certificates
GET  /impact-certificates
GET  /impact-certificates/:certificateId
POST /impact-certificates/:certificateId/challenge
```

Phase 4 proves the Impact Ledger loop:

```text
Project
→ Milestone
→ Evidence hash
→ Evidence review
→ Impact Certificate
→ Certificate viewer
→ Challenge hook
```

## Phase 6 Risk + Challenge Layer

Phase 6 makes the red-team layer operational:

```text
Anti-Sybil score
→ high-value drop gate
→ challenge bond ledger
→ target challenged state
→ admin resolution
→ audit log
```

Routes:

```text
GET  /risk/events
GET  /risk/events/:riskEventId
POST /risk/score
POST /admin/risk/events/:riskEventId/resolve
POST /drops/:dropId/claim
POST /rwa-fragments/:fragmentId/claim
POST /challenges
GET  /challenges
GET  /challenges/:challengeId
POST /challenges/:challengeId/evidence
POST /admin/challenges/:challengeId/accept
POST /admin/challenges/:challengeId/reject
POST /admin/challenges/:challengeId/resolve
```

V1 risk signals are deterministic local policy signals. Qualified-yield RWA is disabled in
V1 and RWA fragments remain utility/allocation objects unless future jurisdiction and KYC
gates are added.

## Phase 7 Treasury / Fund Engine

Phase 7 adds an internal fund ledger before any real payment rail:

```text
Tree Lotto finalized
→ fund allocation records
→ treasury ledger entries
→ milestone release to project escrow placeholder
→ accepted evidence check
→ optional final Impact Certificate check
→ deterministic settlement certificate
```

Routes:

```text
GET  /fund/allocations
GET  /fund/allocations/:allocationId
POST /admin/fund/allocations
POST /admin/fund/allocations/:allocationId/approve
POST /admin/fund/allocations/:allocationId/release
POST /admin/fund/allocations/:allocationId/challenge
GET  /treasury/accounts
GET  /treasury/transactions
GET  /projects/:projectId/milestones/:milestoneId/settlement
POST /admin/projects/:projectId/milestones/:milestoneId/release
POST /admin/projects/:projectId/milestones/:milestoneId/settle
GET  /milestone-releases
GET  /settlements
```

Posted treasury entries are append-only. Reversals create new `revoke_reversal`
transactions; posted amounts are not mutated.

## Phase 8 Payment Intents

Phase 8 adds a Payment Intent layer before Tree Lotto entry creation:

```text
create Payment Intent
→ submit mock/manual/devnet tx hash
→ admin or mock confirmation
→ internal payment_confirmation ledger entry
→ confirmed Payment Intent consumed by Tree Lotto enter
```

Routes:

```text
POST /payments/intents
GET  /payments/intents
GET  /payments/intents/:paymentIntentId
POST /payments/intents/:paymentIntentId/submit
POST /admin/payments/:paymentIntentId/confirm
POST /admin/payments/:paymentIntentId/fail
POST /admin/payments/reconcile
GET  /payments/reconciliation
```

Phase 8 supports mock, manual, and Solana devnet adapter skeletons only. It does not
execute uncontrolled live mainnet transfers and it stores no private keys. Tree Lotto
entries require a confirmed Payment Intent unless `DROPIN_PAYMENT_MODE=mock` is explicitly
enabled for local demos.

## Phase 9 Telegram Mini App / TON Entry

Phase 9 adds a Telegram growth entry without connecting uncontrolled TON mainnet payment
execution:

```text
Telegram session
→ active rounds
→ TON testnet/manual Payment Intent placeholder
→ confirmed Payment Intent
→ Plant & Enter
→ Ticket Seed
→ Climate Proof Card
→ Co-Plant referral claim
```

Routes:

```text
POST /telegram/session
GET  /telegram/me
GET  /telegram/rounds
GET  /telegram/forest
POST /telegram/share-ticket
POST /telegram/referrals/claim
```

Use local mock mode:

```bash
DROPIN_REPOSITORY=memory DROPIN_PAYMENT_MODE=mock TELEGRAM_AUTH_MODE=mock npm --workspace services/api run dev
npm run dev:miniapp-ton
```

Strict Telegram `initData` validation is structured behind `TELEGRAM_AUTH_MODE=strict`
and `TELEGRAM_BOT_TOKEN`. No bot token or private key is stored in code. Referral rewards
are placeholder Leaf Points only.

## Phase 10 TON Testnet Payments

Phase 10 adds TON testnet verification without enabling TON mainnet or custody:

```text
Payment Intent
→ testnet recipient / amount / memo instructions
→ user-submitted tx hash
→ TON testnet provider verification
→ confirmed Payment Intent
→ Tree Lotto entry
```

Routes:

```text
GET  /payments/intents/:paymentIntentId/instructions
POST /payments/intents/:paymentIntentId/verify
```

Enable locally only when testing TON verification:

```bash
DROPIN_TON_TESTNET_ENABLED=true
DROPIN_TON_TESTNET_TREASURY_ADDRESS=<ton-testnet-recipient>
DROPIN_TON_TESTNET_API_URL=<optional-normalized-transaction-api>
```

If the adapter is disabled or the provider is unavailable, verification fails closed.
See `docs/ton-testnet-payments.md`.

## Phase 11 Public Testnet Campaigns

Phase 11 adds the public growth loop without mainnet funds or automatic `$CANOPY`
distribution:

```text
Campaign
→ active Tree Lotto round
→ Plant & Enter
→ Leaf Points
→ Co-Plant referral
→ public campaign report
```

Leaf Points are non-transferable testnet points only. Campaign reports aggregate
participants, tickets, confirmed Payment Intents, fund allocations, project milestones,
evidence counts, Impact Certificate statuses, challenges, risk events, and leaderboard.

Routes:

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

See `docs/testnet-campaigns.md`.

## Premium Climate-Impact UI

The public Web and Mini App surfaces now use a mobile-first premium climate-impact
lottery interface. Public pool screens visibly show:

```text
70% Winner
20% Verified Reforestation
10% Dropin Operations
```

The UI is proof-oriented, not casino-oriented: draws progress through deterministic
steps, proof roots, fund allocation, impact evidence, challenge state, and status
checks. See `docs/ui-system.md` for tokens, components, and safety copy rules.

## Phase 15 Public Testnet Launch Candidate

The Great Green Wall Testnet Campaign is marked `GO, with testnet-only constraints`.

Release materials:

```text
CHANGELOG.md
docs/release/v0.15.0-testnet-campaign.md
docs/launch-decision-record.md
docs/testnet-operator-daily-report.md
docs/launch-pack/first-testers-invite.md
docs/launch-pack/telegram-announcement.md
docs/launch-pack/twitter-thread.md
```

Daily operations:

```text
Check /admin/launch.
Check /admin/payments/reconciliation.
Check /admin/risk.
Check /admin/challenges.
Check /admin/feedback.
Export /campaigns/campaign_v1_ggw_testnet/report.
```

## V1 Safety Rules

```text
No proof, no certificate.
No MRV, no carbon credit.
No retirement, no offset claim.
No license, no carbon tax service.
No KYC, no yield RWA.
No randomness proof, no lottery finality.
No survival proof, no carbon estimate upgrade.
No audit log, no admin mutation.
No challenge window, no final trust.
No fake impact, no protocol growth.
```

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit
```
