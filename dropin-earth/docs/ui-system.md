# Premium UI System

This UI pass turns Dropin Earth from a testnet proof dashboard into a premium,
mobile-first climate-impact lottery interface.

## Product Frame

Public pool screens must feel like Apple Wallet, Robinhood, Patagonia Impact Report,
NASA Earth Observatory, and an institutional Web3 climate dashboard. They must not look
like a casino, slot machine, or get-rich product.

## Allocation Model

Every public lottery and campaign pool view must visibly show:

```text
70% Winner
20% Verified Reforestation
10% Dropin Operations
```

The allocation is a UI/product framing for the Great Green Wall public testnet campaign.
It does not add mainnet payment execution.

## Core Components

Shared components live in `packages/ui`:

```text
AppShell
MobileFrame
HeroEarthOrb
WalletConnectCard
PrizePoolCard
ImpactMetricCard
DrawCountdown
DrawProgress
WinnerResultCard
TicketCard
ParticipationHistory
ProofTimeline
AllocationBreakdown
StatusBadge
FeedbackFormShell
AdminReadinessPanel
```

## Safety Copy

User-facing testnet pages must keep these boundaries visible:

```text
Testnet only.
No mainnet funds.
Leaf Points are non-transferable testnet points.
Impact Certificate is not a certified carbon credit.
RWA Fragment is not guaranteed yield.
$CANOPY does not offset carbon tax.
```

## Visual Tokens

```text
Deep Space: #05070A
Earth Navy: #081827
Climate Blue: #1E88E5
Canopy Green: #00C853
Moss Green: #2E7D32
Carbon Gold: #D4AF37
Mist White: #F5F7FA
Soft Gray: #AAB4C0
Alert Red: #FF4D4F
Warning Amber: #F6A609
Cyan Trace: #00E5FF
```

## Interaction Rules

- Draw animations should be proof timelines or data-orbit states, not casino spinners.
- Wallet UI must clarify that testnet flows use Payment Intents and never collect private keys.
- Result screens should reward non-winning users with impact allocation, Leaf Points context,
  proof links, and Co-Plant sharing.
- Admin screens must preserve operational precision: pass/warn/fail state, audit trail,
  anomaly queues, and launch gate actions must remain visible.
