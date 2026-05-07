# Architecture

```text
apps/web
apps/admin
apps/miniapp-ton
services/api
packages/schemas
packages/crypto
packages/ui
contracts/*
infra/*
```

The current deliverable supports both repository adapters:

- `PrismaLotteryRepository` for PostgreSQL-backed persistence.
- `InMemoryLotteryRepository` for fast unit tests and local fallback.
- `PrismaImpactRepository` for PostgreSQL-backed Impact Ledger persistence.
- `InMemoryImpactRepository` for seeded demo data and unit tests.
- `PrismaRiskRepository` for risk events, challenge bonds, challenge evidence, and resolutions.
- `InMemoryRiskRepository` for deterministic red-team and claim-gating unit tests.
- `PrismaFundRepository` for treasury accounts, ledger entries, fund allocations, milestone releases, and settlements.
- `InMemoryFundRepository` for append-only ledger and settlement unit tests.
- `PrismaPaymentRepository` for Payment Intents, payment events, and reconciliation reports.
- `InMemoryPaymentRepository` for mock/manual adapter and lotto entry gating tests.
- `PrismaTelegramRepository` for Telegram accounts, referrals, and share cards.
- `InMemoryTelegramRepository` for Mini App and referral unit tests.
- `PrismaCampaignRepository` for public testnet campaigns, participants, Leaf Points,
  campaign-round/project bindings, and public campaign reports.
- `InMemoryCampaignRepository` for deterministic growth-loop unit tests.
- `PrismaFeedbackRepository` and `InMemoryFeedbackRepository` for public launch feedback.
- `PrismaStatusRepository` and `InMemoryStatusRepository` for launch checks, status
  snapshots, and launch-gate audit logs.

The production persistence contract is defined in `services/api/prisma/schema.prisma`.

Core design boundaries:

- API inputs are validated through Zod schemas.
- Lottery and drop computation use deterministic hash expansion.
- Evidence is hashed before it can support an Impact Certificate.
- Admin-triggered state changes write audit logs.
- Carbon estimates remain separate from certified carbon credits.
- Challenge cases can mark target objects as challenged before final trust.

Lottery domain layering:

```text
services/api/src/domain/lottery/
├── lottery-engine.ts          pure deterministic functions
├── lottery-repository.ts      Prisma and in-memory adapters
├── lottery-service.ts         orchestration and idempotency
├── lottery-state-machine.ts   valid transitions
├── lottery-results.ts         public result mapping
└── lottery-errors.ts          typed errors
```

Impact domain layering:

```text
services/api/src/domain/impact/
├── impact-engine.ts           pure evidence root and certificate hash logic
├── impact-repository.ts       Prisma and in-memory adapters
├── impact-service.ts          project and milestone orchestration
├── evidence-service.ts        upload, hash, review
├── certificate-service.ts     issue and challenge certificates
├── impact-state-machine.ts    valid project transitions
└── impact-errors.ts           typed errors
```

Risk domain layering:

```text
services/api/src/domain/risk/
├── risk-engine.ts             pure exports for risk/gating primitives
├── sybil-score.ts             deterministic V1 anti-sybil score
├── drop-gating.ts             high-value drop and RWA fragment gates
├── risk-policy.ts             threshold constants
├── risk-repository.ts         Prisma and in-memory adapters
├── risk-service.ts            challenge, risk event, and claim orchestration
└── risk-errors.ts             typed errors
```

Fund domain layering:

```text
services/api/src/domain/fund/
├── fund-engine.ts             deterministic allocation and settlement hash helpers
├── treasury-ledger.ts         append-only reversal helper
├── milestone-settlement.ts    evidence and certificate settlement guards
├── fund-repository.ts         Prisma and in-memory adapters
├── fund-service.ts            allocation, release, settlement orchestration
├── fund-state-machine.ts      allocation state transitions
└── fund-errors.ts             typed errors
```

Payment domain layering:

```text
services/api/src/domain/payment/
├── payment-intent.ts          state transition guards
├── payment-adapter.ts         mock, manual, Solana devnet adapter skeletons
├── adapters/ton-testnet-payment-adapter.ts
│                              TON testnet transaction verifier boundary
├── stablecoin-router.ts       expected recipient and adapter routing
├── payment-reconciliation.ts  duplicate / mismatch / stale checks
├── payment-repository.ts      Prisma and in-memory adapters
├── payment-service.ts         intent, submit, confirm, reconcile orchestration
└── payment-errors.ts          typed errors
```

Telegram domain layering:

```text
services/api/src/domain/telegram/
├── telegram-auth.ts           mock and strict Telegram initData validation
├── telegram-referral.ts       deterministic referral code and share copy helpers
├── telegram-repository.ts     Prisma and in-memory adapters
├── telegram-service.ts        session, forest, share card, referral orchestration
└── telegram-errors.ts         typed errors
```

Campaign domain layering:

```text
services/api/src/domain/campaign/
├── campaign-state-machine.ts  draft / scheduled / active / ended / finalized
├── leaderboard-service.ts     deterministic Leaf Points ranking
├── leaf-points-service.ts     idempotent non-transferable point ledger
├── campaign-repository.ts     Prisma and in-memory adapters
├── campaign-service.ts        campaign, report, and reward orchestration
└── campaign-errors.ts         typed errors
```

Launch readiness layering:

```text
services/api/src/domain/status/
├── status-service.ts          system counts, snapshots, launch check persistence
├── readiness-service.ts       launch gate checklist and decision
├── metrics-service.ts         Prometheus-style text metrics
└── status-errors.ts           typed errors

services/api/src/domain/feedback/
├── feedback-repository.ts     Prisma and in-memory adapters
├── feedback-service.ts        create/list/resolve orchestration
└── feedback-errors.ts         typed errors
```

Phase 4 persistence loop:

```text
Project
→ ProjectMilestone
→ EvidenceObject
→ accepted evidence review
→ deterministic evidenceRoot
→ ImpactCertificate
→ ChallengeCase
→ AuditLog
```

Solana proof anchoring boundary:

```text
API deterministic finalization
→ entryRoot / randomnessCertificateHash / winnerRoot / dropRoot
→ contracts/solana RoundRootAnchor PDA

Impact Certificate issuance
→ evidenceRoot / certificateHash / methodologyHash
→ contracts/solana ImpactCertificateAnchor PDA

Drop result
→ Merkle proof
→ MerkleDropClaim PDA
```

The contract layer anchors roots only. It does not own business calculation.

Operational trust loop:

```text
Drop or certificate is created
→ deterministic risk score / challenge object
→ high-value claims can be delayed or manual reviewed
→ accepted challenge marks target challenged
→ audit log and challenge resolution preserve the decision trail
→ anchor revoke hook remains available for Solana root objects
```

Funding loop:

```text
Lottery finalize
→ allocation records by basis points
→ posted internal ledger entries
→ project milestone release to escrow placeholder
→ accepted evidence required
→ issued Impact Certificate required for final settlement
→ deterministic settlement certificate
→ challenge can mark allocation / transaction / settlement challenged
```

Payment-gated Tree Lotto loop:

```text
Payment Intent created
→ tx hash submitted
→ mock/manual/devnet confirmation
→ payment_confirmation ledger entry
→ confirmed Payment Intent consumed by lottery entry
→ Tree Lotto finalize allocates posted round escrow into fund accounts
```

The payment layer is intentionally pre-transfer infrastructure in Phase 8. It has no
private-key handling, no automatic live mainnet transfer execution, and no uncontrolled
payment rail integration.

TON testnet verification boundary:

```text
Payment Intent
→ testnet instructions with memo
→ user-submitted tx hash
→ normalized TON testnet provider
→ recipient / amount / memo / network checks
→ confirmed Payment Intent or failed-closed anomaly
```

The TON adapter is disabled unless `DROPIN_TON_TESTNET_ENABLED=true`; it never enables TON
mainnet and never stores private keys.

Telegram Mini App loop:

```text
Telegram session
→ active Tree Lotto round
→ TON testnet/manual Payment Intent placeholder
→ confirmed Payment Intent
→ Tree Lotto entry
→ Ticket Seed
→ Climate Proof Card
→ risk-scored Co-Plant referral
```

`apps/miniapp-ton` is a Next.js app on port `3003`. It shares API contracts with the web
app and uses Telegram WebApp share/open-link APIs when available, with clipboard fallback.
`TELEGRAM_AUTH_MODE=mock` is for local development. Strict mode requires `TELEGRAM_BOT_TOKEN`
from the environment and performs structured `initData` hash verification.

Public testnet campaign loop:

```text
Campaign
→ linked region / round / project
→ confirmed Plant & Enter
→ +10 non-transferable Leaf Points
→ Climate Proof Card
→ valid Co-Plant referral +20 Leaf Points
→ suspicious referral risk_event and no points
→ public campaign report
```

Campaign reports aggregate participant count, ticket count, confirmed Payment Intents,
fund allocations, milestone status, evidence count, Impact Certificate status,
challenge count, risk event count, and leaderboard. Leaf Points are not `$CANOPY`,
not transferable, not yield-bearing, and not a carbon tax offset.
