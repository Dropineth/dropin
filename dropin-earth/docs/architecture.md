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

---

# Phase 1 RFC: CanopyProof OS Target Architecture

Status: design baseline

Canonical product-system RFC:
`docs/RFC_CANOPYPROOF_OS_PRODUCT_SYSTEM.md`. The section below is a concise
module summary; the standalone RFC controls authority, persistence, security,
reliability, migration, rollback, and phase-gate decisions.

Canonical product-system RFC:
`docs/RFC_CANOPYPROOF_OS_PRODUCT_SYSTEM.md`. The section below is a concise
module summary; the standalone RFC controls authority, persistence, security,
reliability, migration, rollback, and phase-gate decisions.

This section defines the production target for CanopyProof as public-interest
climate accountability infrastructure. It does not claim that every module is
already implemented. Current-state gaps are tracked in
`docs/ARCHITECTURE_CURRENT_STATE.md`.

## Mission Boundary

CanopyProof is the Earth Impact Application Layer on top of Dropin OS.

```text
Dropin OS
  identity
  agent framework
  trust graph
  governance events
  memory and AHIN event stream

CanopyProof OS
  environmental accountability
  evidence collection
  verification workflows
  governance records
  public impact reporting
```

CanopyProof must never duplicate Dropin identity, agent, trust, governance, or
memory primitives. It consumes those primitives and specializes them for
environmental proof.

## Layered Architecture

```text
CanopyProof OS
├── Evidence Layer
│   ├── mobile reporting
│   ├── media hashing
│   ├── EXIF/GPS/device metadata
│   ├── offline sync
│   └── community attestations
├── Verification Layer
│   ├── deterministic validation
│   ├── AI-assisted analysis
│   ├── satellite and geospatial comparison
│   ├── fraud and duplicate detection
│   └── human review as final authority
├── Governance Layer
│   ├── organization membership
│   ├── RBAC/ABAC policy
│   ├── reviewer accreditation
│   ├── release and certificate approvals
│   └── immutable audit events
└── Impact Layer
    ├── global impact command center
    ├── environmental proof records
    ├── ESG reports
    ├── funding transparency
    └── early-warning signals
```

## Required Product Modules

### Global Impact Command Center

Route: `/dashboard/global`

Purpose: institutional command center for global restoration accountability.

Required capabilities:

- Earth visualization with project, region, risk, biodiversity, water, and
  impact layers.
- Read-only default mode for public users.
- Drill-down from global region to project to evidence to certificate.
- Separation of observed evidence, verified evidence, estimated impact, and
  public claims.
- No financial-yield, carbon-offset, or certified-carbon-credit language.

### Evidence Collection Network

Route: `/mobile/report`

Purpose: mobile-first, offline-first environmental evidence collection.

Supported report classes:

- tree planting.
- restoration progress.
- biodiversity observation.
- water project observation.
- soil regeneration observation.
- climate risk observation.

Required evidence envelope:

```json
{
  "id": "evidence_...",
  "location": {
    "latitude": 0,
    "longitude": 0,
    "accuracy_meters": 0,
    "privacy_mode": "precise|masked|region_only"
  },
  "timestamp": "2026-07-08T00:00:00.000Z",
  "contributor": "identity_...",
  "media_hash": "sha256:...",
  "gps_hash": "sha256:...",
  "verification_status": "submitted",
  "confidence_score": 0,
  "reviewers": [],
  "audit_history": []
}
```

Offline-first contract:

- Client creates local evidence envelopes before network availability.
- Media and metadata are content-addressed before upload.
- Sync is idempotent by evidence ID and media hash.
- Conflicts create review tasks; they do not overwrite accepted records.

Media provider boundary:

```text
durable upload intent
  -> fixed-account R2 SigV4 PUT capability (ephemeral, never persisted)
  -> Workers R2 binding head() (key/version/SHA-256 metadata)
  -> optional fixed management-API bucket-lock verification
  -> append-only provider verification fact
  -> fixed HTTPS malware scanner (bounded signed receipt)
  -> append-only scanner verification fact
  -> human evidence review
```

The provider and scanner calls occur outside PostgreSQL transactions. The
serializable commit reloads every immutable root and appends the resulting
facts, semantic events, and command receipt atomically. Runtime ports are
constructor-only and absent from the application composition root; production
activation, real credentials, live bucket-lock observation, and route mounting
remain closed.

Metadata extraction boundary:

```text
governed effective clean-media projection + active consent + current device
  -> fixed HTTPS minimized extractor request
  -> signed strict receipt from pinned extractor image/schema
  -> allowlisted Ed25519 verification and raw-signature minimization
  -> immutable modeled-only E3b extraction fact
  -> separate append-only E3c verification fact
  -> issue-preserving effective projection
  -> independent human review
```

The adapter fixes its endpoint and policy at construction, accepts no raw
EXIF/GPS or credentials, and is absent from the application composition root.
E3c authenticates receipt provenance only; it cannot rewrite E3b, approve
evidence, issue proof, or bypass unresolved media/device/quality issues. A
separate governed projection that reconciles E1 media state with E2a receipt
trust is required before live orchestration can satisfy the clean-media gate.

### Environmental Proof Engine

Purpose: convert raw evidence into bounded, reviewable environmental proof
records.

Pipeline:

```text
Evidence
→ validation
→ AI analysis
→ human review
→ proof certificate
→ public record
```

Required invariants:

- AI cannot issue final proof.
- Human review is required for proof certificates.
- Every mutation writes an append-only audit event.
- Certificate text must state that it is an Environmental Proof Record, not a
  carbon credit, financial asset, tax offset, or guaranteed-yield instrument.

The route-closed lifecycle authority has a constructor-only AWS KMS verification
boundary:

```text
fixed full key ARN + governance key-version label
  -> AWS KMS GetPublicKey
  -> exact SPKI hash, SIGN_VERIFY, key spec, and algorithm validation
  -> AWS KMS Verify over the canonical lifecycle digest
  -> opaque provider receipt hashes
  -> append-only lifecycle signature receipt
```

The boundary exposes no signing operation, is absent from the application
composition root, and uses deterministic mock responses only in tests. Real
IAM provisioning, CloudTrail retention, key ceremony, live compatibility,
rotation/revocation operations, route review, and production activation remain
closed.

### AI Verification Layer

Component: Canopy AI Agent

Agent capabilities:

- satellite comparison.
- anomaly detection.
- duplicate detection.
- fraud detection.
- ecological reasoning.
- survival estimation.

Agent boundary:

- AI outputs are advisory observations.
- AI outputs must include evidence references, model provenance, confidence, and
  failure modes.
- Final approval requires an accredited human reviewer or governance workflow.

CanopyProof agents:

- Evidence Agent.
- Verification Agent.
- ESG Agent.
- Funding Agent.
- Risk Agent.
- Community Agent.

Each action emits an AHIN event:

```text
ASSERT
REASON
DELEGATE
FULFILL
CHALLENGE
```

### TerraProof Earth Intelligence

Route: `/terra`

Purpose: Earth observation and climate intelligence workspace.

Required layers:

- satellite base imagery.
- NDVI.
- vegetation change.
- water stress.
- drought.
- wildfire.
- land-change detection.

Connector targets:

- Sentinel.
- Landsat.
- NASA open datasets.
- open climate and biodiversity datasets.

Data connector requirements:

- source provenance.
- acquisition timestamp.
- processing version.
- spatial resolution.
- license/distribution policy.
- confidence and missing-data flags.

### Environmental Certificate System

Artifact: Impact Certificate / Environmental Proof Record.

Required fields:

- project.
- location.
- evidence root.
- verification history.
- monitoring timeline.
- contributors.
- governance approvals.

Certificate boundary:

- not a certified carbon credit.
- not a financial asset.
- not a carbon-tax offset.
- not guaranteed yield.

### ESG Reporting Engine

Route: `/reports/esg`

Purpose: generate reviewable institutional reports without overstating claims.

Outputs:

- PDF.
- JSON.
- API.

Report families:

- GRI-aligned impact summary.
- SDG mapping.
- TNFD preparation material.
- biodiversity reports.
- climate impact reports.

### UN / NGO Collaboration Layer

Route: `/partners`

Purpose: organization profiles and permissions for trusted collaboration.

Organization types:

- UN agency.
- NGO.
- University.
- Government.
- Investor.
- Restoration organization.

Required roles:

- Owner.
- Admin.
- Verifier.
- Researcher.
- Community.
- Observer.

### Funding Transparency Layer

Route: `/funding`

Purpose: open-government style funding transparency.

Tracked entities:

- donor.
- grant.
- project.
- allocation.
- milestone.
- evidence.

Funding records must show source, allocation policy, milestone condition,
evidence dependency, approval, release state, and audit trail.

### Canonical Project Lifecycle Source Composition

The institutional lifecycle authority remains route-closed. Its repository
owns one serializable transaction and invokes a canonical resolver that reads
the immutable registration anchor, current project authority, current verified
human actor authority, governed `project_lifecycle` policy, and complete
stage-specific source sets without caches or network calls.

Supported source composition is deliberately bounded:

- `PROPOSED -> FUNDED` binds the active funding projection, positive allocated
  cents, funding current root, and current project root.
- `FUNDED -> VERIFIED` binds every active Environmental Proof lifecycle plus
  current governed-record, MRV graph, and project roots; any adverse proof state
  blocks the transition.
- `VERIFIED -> LONG_TERM_OBSERVATION` binds every accepted monitoring event
  after verification and requires the latest monitoring root to equal current
  project authority.
- closure and restoration reject until separate governed authorities define
  their evidence, independence, challenge, and policy requirements.

This composition layer does not mount an API route, schedule work, activate
production writes, or create environmental or financial claims.

### Early Warning System

Route: `/risk`

Purpose: monitor environmental risk and alert appropriate actors.

Signals:

- drought.
- wildfire.
- flooding.
- ecosystem degradation.

Alert targets:

- community.
- NGO.
- government.
- project operator.
- accredited verifier.

## Design Standard

The interface must communicate UN-grade trust:

- NASA Earth observation seriousness.
- Bloomberg terminal density where operationally useful.
- Apple-level interaction polish.
- Palantir-style clarity for provenance, lineage, and decision state.

It must not read as a crypto dashboard, speculative token app, or startup
landing page.


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
