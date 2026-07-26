# CanopyProof Early Warning System

Status: compatibility API implemented; canonical publication authority is
route-closed and production activation is disabled

The early warning layer monitors environmental risk for restoration operations.
It is separate from Dropin's payment, anti-abuse, and challenge risk APIs.

## Risk Classes

- drought
- wildfire
- flooding
- ecosystem degradation

Signals can come from TerraProof scenes, field evidence, community reports, or
open climate datasets. Each signal is scored into `low`, `medium`, `high`, or
`critical` using bounded 0-100 indicators and source confidence.

## Alert Flow

```text
Risk signal
  -> operational alert
     -> delivery receipt ledger
        -> response playbook activation
           -> human-reviewed closure or challenge
              -> institutional after-action review
     -> acknowledgement
        -> escalation
           -> public release only after human review and governance policy
```

High and critical alerts enter `review_required` automatically. This is an
operational state, not an official emergency declaration.

## Canonical Publication Authority

The compatibility API above is not the institutional source of truth. The
canonical authority is defined by
`services/api/src/domain/canopyproof/early-warning-authority.ts`, persisted by
`early-warning-postgres.ts`, and governed by
`services/api/prisma/early-warning-authority.sql`. It is intentionally absent
from the Hono composition root and has no scheduler, live-feed adapter,
notification transport, or production activation path.

The canonical flow is:

```text
Current governed sources and scope authority
  -> deterministic advisory candidate
     -> independent accredited scientific human review
        -> independent accredited operational human review
           -> third independent accredited human publication
              -> privacy-minimized advisory projection
                 -> append-only challenge or withdrawal
```

Candidates use sorted source and indicator members, safe integer-scaled values,
explicit thresholds, basis-point confidence, bounded validity, policy roots,
and a deterministic `sourceAuthorityRoot` and `candidateRoot`. A current
organization-bound Dropin agent may prepare a candidate but cannot review,
publish, challenge, withdraw, or otherwise become final authority. A human
preparer must hold `risk:signal:prepare`; final publication always requires
three distinct current accredited humans.

Public projections expose only public organization/scope identifiers, bounded
advisory content, aggregate member counts and roots, review roots, policy
lineage, and validity. Raw coordinates, geometry, contributor/device/project
identifiers, private contact data, credentials, and secret-bearing fields are
rejected. Challenge and withdrawal require a current accredited human distinct
from the publisher. Challenge, withdrawal, and expiry fail closed and never
fall back to an older advisory.

## Audience Model

Alerts can target:

- community
- NGO
- government
- operator
- verifier

Critical alerts may include government in the operational audience, but public
messaging remains blocked until a reviewer and governance policy are attached.

Dispatch receipts record which audience-scoped participant or organization ID
was notified, the channel used, delivery state, and a deterministic
`dispatchHash`. Receipts intentionally store no raw phone numbers, emails, or
other private contact payloads.

Response playbooks define bounded operational steps for each risk class. They
require delivered or acknowledged dispatch receipts before activation, preserve
evidence requirements for closure, and explicitly avoid emergency declarations,
carbon-credit claims, tax-offset claims, and financial/yield claims.

Closure records are human-reviewed response outcomes. They require evidence IDs,
reviewer-role matching, and a typed `complete` or `challenge` decision. Agent
actors may assist earlier operational coordination but cannot close playbooks as
final authority.

After-action reviews are post-incident accountability records attached to a
closure. They require institutional human reviewer roles, preserve closure
evidence references, record lessons learned, and require corrective actions
when follow-up or governance escalation is needed.

## API Surface

The following routes are the existing non-canonical compatibility surface. No
canonical early-warning write or publication route is mounted.

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

## Safety Boundaries

- No automated public emergency claim.
- No guaranteed safety claim.
- No certified disaster claim.
- No certified carbon-credit, tax-offset, or guaranteed-yield claim.
- Human review and governance policy are required before public risk messages.
- AI/agent actors can assist playbook activation but cannot close response
  playbooks as final authority.
- Response closure requires evidence-bound human review.
- After-action reviews are institutional, post-closure, evidence-bound, and
  cannot turn an operational alert into an emergency, carbon, tax, or financial
  claim.
- All signals, alerts, dispatch receipts, playbook activations,
  response closures, after-action reviews, acknowledgements, and escalations
  append audit events.
