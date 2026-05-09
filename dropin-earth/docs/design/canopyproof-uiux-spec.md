# CanopyProof UI/UX Design Specification

CanopyProof is the public product surface for Dropin Earth: a premium Climate Impact
Lottery and Proof-of-Planting Impact Dashboard. The experience should feel like Apple
Wallet clarity, Robinhood immediacy, Patagonia impact reporting, and institutional Web3
proof infrastructure.

Design benchmark: Apple Wallet + Robinhood + Patagonia Impact Report + premium Web3 climate dashboard.

This document is a delivery spec for design, frontend engineering, product, and launch
operations. It is intentionally implementation-ready and preserves all public safety
boundaries.

## Product Positioning

CanopyProof is not a casino UI, a generic donation page, or a speculative carbon-credit
dashboard. It is a climate-impact lottery and proof dashboard where every pool clearly
shows:

- 70% Winner
- 20% Verified Reforestation
- 10% Dropin Operations

The core narrative:

```text
Join climate-impact prize pools.
Track every tree through proof.
Challenge every claim before it becomes trusted infrastructure.
```

## User Roles

| Role | Primary Motivation | Primary UI Surface |
| --- | --- | --- |
| Visitor | Understand the mission in under 10 seconds | Landing, Campaign, FAQ |
| Participant | Join a draw and track proof | Active Draw, Payment Intent, My Participated |
| Donor / Sponsor | See transparent pool allocation | Campaign, Fund, Status |
| NGO / Project Operator | Track milestones and evidence | Project pages, Admin Projects |
| Validator / Red Team | Review proof and challenge claims | Red-Team, Challenges, Certificates |
| Operator | Monitor readiness and incidents | Admin Launch, Status, Feedback |

## Core User Journeys

### First Visitor

1. Opens `canopyproof.org`.
2. Sees Earth orb, current pool size, `1 TON / USDC Join Draw`, and 70/20/10 split.
3. Reads testnet-only and proof disclaimers.
4. Chooses `Join Active Draw` or `View Impact Proof`.

### Participant

1. Opens active draw.
2. Reviews prize pool, countdown, participant count, and allocation.
3. Connects wallet or enters a testnet/mock wallet address.
4. Creates a Payment Intent.
5. Submits testnet/manual transaction proof.
6. Receives Ticket Seed.
7. Tracks drawing progress and proof roots.

### Result Viewer

1. Sees premium result card.
2. Understands whether they won.
3. Sees impact allocation even if they did not win.
4. Opens proof timeline.
5. Shares Co-Plant invite or red-team challenge link.

### Red Team / Validator

1. Opens proof or challenge board.
2. Reviews target type and evidence.
3. Submits challenge evidence.
4. Tracks resolution and audit trail.

### Operator

1. Opens admin launch readiness.
2. Reviews pass/warn/fail checks.
3. Checks payment anomalies, risk events, feedback, and open challenges.
4. Runs launch check and records decision.

## Information Architecture

```text
/
├── campaigns
│   └── campaign_v1_ggw_testnet
├── lottery
│   └── round_v1_ggw_demo
├── certificates
│   └── cert_v1_ggw_demo
├── projects
│   └── project_v1_ggw_demo
├── fund
├── challenges
├── red-team
├── status
├── feedback
├── faq
└── about
```

Admin:

```text
/admin/launch
/admin/status
/admin/feedback
/admin/risk
/admin/challenges
/admin/payments
/admin/payments/reconciliation
/admin/fund
/admin/treasury
/admin/settlements
/admin/campaigns/campaign_v1_ggw_testnet
```

Mini App:

```text
/
/campaign/campaign_v1_ggw_testnet
/round/round_v1_ggw_demo
/me/forest
/share/ticket_v1_ggw_demo?roundId=round_v1_ggw_demo
```

## Visual Direction

### Mood

- Dark premium background
- Cinematic Earth / forest orb
- Glassmorphism proof cards
- Institutional climate-finance credibility
- Warm reward moments without casino language
- Mobile-first, iPhone 15 Pro proportions

### Avoid

- Slot machine metaphors
- “Get rich” language
- Cyberpunk clutter
- Fake impact metrics
- Unverified carbon finality
- Hidden operational assumptions

## Design Tokens

Canonical machine-readable tokens live in:

```text
docs/design/canopyproof-design-tokens.json
```

Core colors:

| Token | Value | Usage |
| --- | --- | --- |
| Deep Space | `#05070A` | Page background |
| Earth Navy | `#081827` | Panels and mobile shell |
| Climate Blue | `#1E88E5` | Earth, data, links |
| Canopy Green | `#00C853` | Primary CTA and success |
| Moss Green | `#2E7D32` | Forest support tone |
| Carbon Gold | `#D4AF37` | Winner/reward allocation |
| Mist White | `#F5F7FA` | Primary text |
| Soft Gray | `#AAB4C0` | Secondary text |
| Warning Amber | `#F6A609` | Testnet/safety notices |
| Alert Red | `#FF4D4F` | Failure, challenge, revocation |
| Cyan Trace | `#00E5FF` | Proof/data-flow accent |

Typography must not scale with viewport width. Use fixed responsive breakpoints rather
than `vw` type. Letter spacing is `0` except for small uppercase eyebrow labels.

## Core Components

| Component | Purpose | Engineering Mapping |
| --- | --- | --- |
| AppShell | Public page shell with proof-oriented nav | `packages/ui/src/index.tsx` |
| MobileFrame | iPhone-like preview/surface | `packages/ui/src/index.tsx` |
| HeroEarthOrb | Main cinematic Earth/forest visual | `packages/ui/src/index.tsx` |
| ClimateDrawPass | Premium pool card with prize, ticket, proof, participants | `packages/ui/src/index.tsx` |
| PrizePoolCard | Dense pool detail card | `packages/ui/src/index.tsx` |
| ImpactMetricCard | Impact KPI card | `packages/ui/src/index.tsx` |
| ImpactTickerStrip | First-screen metrics ticker | `packages/ui/src/index.tsx` |
| DrawCountdown | Pre-draw time state | `packages/ui/src/index.tsx` |
| DrawProgress | Deterministic proof-progress state | `packages/ui/src/index.tsx` |
| WinnerResultCard | Result state without casino framing | `packages/ui/src/index.tsx` |
| TicketCard | Ticket seed / receipt display | `packages/ui/src/index.tsx` |
| ParticipationHistory | My Participated list | `packages/ui/src/index.tsx` |
| ProofTimeline | Evidence/root/certificate progression | `packages/ui/src/index.tsx` |
| AllocationBreakdown | 70/20/10 visualization | `packages/ui/src/index.tsx` |
| StatusBadge | Semantic status display | `packages/ui/src/index.tsx` |
| SafetyNotice | Testnet/proof/risk copy block | `packages/ui/src/index.tsx` |
| FeedbackFormShell | Feedback form shell | `packages/ui/src/index.tsx` |
| AdminReadinessPanel | Admin launch checks | `packages/ui/src/index.tsx` |

## Screen Specifications

### Landing / Home

Goal: user understands product in under 10 seconds.

Required first viewport:

- Hero Earth / forest orb
- Headline: `Join climate-impact prize pools. Track every tree through proof.`
- Current draw pass
- `1 TON / USDC Join Draw`
- 70/20/10 allocation
- Impact metrics: prize pool, trees funded, CO2 estimated, verified sites
- Testnet-only safety notice
- Primary CTA: `Join Active Draw`
- Secondary CTA: `View Impact Proof`

### Connect Wallet

States:

- `disconnected`
- `connecting`
- `connected`
- `unsupported`
- `error`

Rules:

- Never ask for private keys.
- Payment Intent is always explicit.
- Testnet/manual/TON placeholder mode must be clearly labeled.

### Active Draw / Pre-Draw

Required modules:

- Round hero
- ClimateDrawPass
- AllocationBreakdown
- DrawCountdown
- ParticipantAvatars
- Plant & Enter panel
- Payment Intent state
- Proof readiness indicator

### Drawing In Progress

Use data-orbit/proof-timeline motion, not a casino spinner.

Steps:

1. Entries frozen
2. Randomness certificate generated
3. Winners computed
4. Drop roots computed
5. Fund allocation created
6. Proof anchor pending/complete

### Won / Result

Premium result card:

- Prize result
- Impact allocation
- Ticket Seed
- Proof roots
- Claim Reward CTA if enabled
- Share Impact NFT placeholder
- View Proof CTA

If user did not win:

- Show reforestation contribution
- Show Leaf Points
- Show proof timeline
- Show share/co-plant CTA

### My Participated

Show:

- Tickets
- Pools
- Won
- Pending
- Impact allocated
- Proof anchored
- Total contributed
- Trees funded
- Leaf Points

### Pool Detail

Show:

- 70/20/10 economics
- Entry count
- Payment intent rules
- Fund allocation link
- Project link
- Challenge status
- Transparency section

### Impact Proof

Show:

- Evidence root
- Impact Certificate status
- Solana anchor status
- Challenge window
- Explicit disclaimer: `Impact Certificate is not a certified carbon credit.`

### About / How It Works

Use a concise five-step explanation:

1. Join prize pool
2. 70% winner / 20% verified reforestation / 10% operations
3. Tree fund supports verified projects
4. Evidence and certificates are generated
5. Claims can be challenged before trust is finalized

Verification flow:

```text
Donation → NGO → Planting → Satellite / Oracle → On-chain proof
```

CanopyProof copy:

```text
CanopyProof is the proof layer for verified climate action.
```

### Status

Public dashboard must show:

- API readiness
- Repository mode
- Payment mode
- TON testnet enabled/disabled
- Campaign live count
- Open risk events
- Open challenge cases
- Last reconciliation time

### Feedback

Categories:

- Bug
- Payment
- Referral
- UI
- Proof
- Risk
- Other

States:

- Empty
- Typing
- Submitting
- Success
- Error

### Admin Launch Readiness / Status / Feedback

Keep operational precision. Visual polish must not hide data.

Required:

- Readiness checklist
- Pass/warn/fail states
- Recommended launch gate decision
- Recent risk/challenge/payment anomalies
- Feedback queue
- Resolve action
- Runbook links

## Figma Delivery Structure

Canonical Figma structure JSON:

```text
docs/design/canopyproof-figma-structure.json
```

Recommended Figma pages:

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Web Screens`
5. `04 Mini App Screens`
6. `05 Admin Screens`

## Interaction and Motion

Motion must support trust and comprehension:

- CountUp for impact numbers
- Subtle Earth/orb pulse
- Progress fill on proof steps
- Hover lift for cards
- Skeleton loading for metrics and cards
- Reduced-motion fallback for decorative transforms

Do not use slot-machine reels, roulette, flashing jackpot effects, or noisy reward loops.

## Accessibility

- Minimum body text contrast: 4.5:1
- Minimum large text contrast: 3:1
- Minimum hit target: 44px
- Semantic buttons for actions
- Links for navigation
- Status cannot rely on color alone
- Safety notices must be visible without hover

## Safety and Compliance Copy

Every public campaign/testnet page must visibly state:

```text
Testnet only.
No mainnet funds.
Leaf Points are non-transferable testnet points.
Impact Certificate is not a certified carbon credit.
RWA Fragment is not guaranteed yield.
$CANOPY does not offset carbon tax.
```

## Engineering Handoff

React/Tailwind mapping:

- `docs/design/canopyproof-design-tokens.json` → Tailwind theme/CSS variables
- `docs/design/canopyproof-figma-structure.json` → Figma frame/component scaffold
- `packages/ui/src/index.tsx` → shared component implementation
- `tests/unit/ui-premium.test.ts` → critical rendering/safety-copy checks

Replacement rules:

- Mock data must live in typed fixtures or API boundaries.
- Hardcoded demo values may appear only in demo route composition, not inside generic components.
- Any live payment UI must be gated by production launch gate and payment verifier status.

## Launch Funnel Optimization

Track:

- Home → Active Draw click-through
- Active Draw → Payment Intent creation
- Payment Intent → Ticket Seed success
- Ticket Seed → Share Co-Plant
- Proof view → Challenge board
- Feedback submission rate

Optimize:

- Keep 70/20/10 visible above fold.
- Keep testnet-only notice visible but not fear-inducing.
- Keep `View Proof` as a peer CTA to `Join Active Draw`.
- Make non-winning outcomes emotionally meaningful through verified reforestation contribution.

## Open Design Risks

- Live USDC/USDT language must remain disabled until regulatory and treasury gates pass.
- Estimated carbon must never visually read as verified carbon.
- RWA Fragment must not be visually framed as guaranteed yield.
- Any future Claim Reward action needs jurisdiction, KYC/AML, risk, and treasury controls.
