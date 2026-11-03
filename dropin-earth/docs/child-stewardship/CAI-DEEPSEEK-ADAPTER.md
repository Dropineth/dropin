# CAI proposal adapter for child accounts

Status: local synthetic review integration; not a deployed agent or AHIN authority.

CAI means Causal-chain-reconstructing Augmented Individuality; AHIN means Active
Hashing Interaction Network; POCC means Proof of Cognitive Canxian. The existing
CAI ontology owns source mapping, AHIN owns runtime mutation, and POCC owns
validation. This application adapter does not redefine those responsibilities.

## Source pin and inspected implementation

| Field | Value |
| --- | --- |
| Repository | https://github.com/deepseek-ai/dsh-superagent-prototype |
| Commit | `8c32a9dc5d72c033816c6a8110b37f40cf94fba4` |
| License | MIT, copyright 2026 DeepSeek Harness Team |
| Relevance | Trigger/Thread/Ticket separation, advisory worker isolation and report routing |

Inspected README, LICENSE, `docs/002-authorization.md`, `003-execution.md`,
`007-architecture.md`, and `src/core/model.ts`, `ports.ts`, `src/index.ts`.
The upstream explicitly calls itself a research prototype, and says some article
designs are not implemented. Its actual runtime uses DeepSeek Harness services;
this change neither installs that runtime nor claims its benchmark figures.
No upstream source is copied or loaded as a runtime dependency. Any later
vendoring must preserve its MIT notice.

Accepted concepts: a source event routes work; workers report to a coordinator;
untrusted text stays data; external work runs outside database transactions.
Rejected authority mapping: a DeepSeek Mandate is not child consent, a guardian
appointment, a signature, or a multisignature vote. Subscriptions deliver context
without new authority. Upstream policy changes need not immediately revoke live
mandates, and workers run commands as the operator OS user. Consequently neither
its prompts nor command wrappers are an execution security boundary here.

## Implemented seam

`services/api/src/domain/child-stewardship/cai-proposal.ts` exports two pure ports:

1. `createCaiChildTrigger(workId, at, operation)` validates the existing synthetic
   rights operation and produces a structurally compatible upstream Trigger.
   It includes fixed text, an opaque work reference, operation type and canonical
   operation digest. It includes no beneficiary, destination, evidence, key,
   signature, access token or reply channel. Its source identity is the application
   service, not a purported human author. It is not an authenticated ingress.
2. `reviewCaiChildProposal(input, current)` checks exact event/operation binding
   and calls the existing `applyRightsOperation` with server-supplied current state
   and context. It discards the calculated state, including all simulated outbox
   effects. Its versioned, digest-only result is advisory and cannot authorize
   execution. Retries consume no ledger nonce. `ahin-execution` always fails with
   `AHIN_AUTHORITY_UNAVAILABLE`.

Only trusted server code may supply `current`. Worker reports never supply
credentials, policy, current time, restore checkpoints or consent state. Review
results are not authorization tokens. A later execution must independently enter
the existing command transaction and recheck all authorization, consent, replay,
restore and revocation conditions after lock waits. This module is not mounted
as an HTTP endpoint and exposes no execution callback, wallet or signing API.

The existing static learning gateway and its receipt schema remain unchanged.
Do not insert network inference inside its session lock. A future inference
implementation needs bounded inference outside the transaction, fresh authority
and consent checks before commit, and a new versioned receipt contract.

## Verification and remaining deployment work

Tests exercise unchanged input state, operation substitution, injected worker
text/metadata, current revocation/registry/epoch/restore changes, replay, expiry,
child-payment denial, human/representative duplicate voting, agent-key denial,
individual protection pause, real-value denial and Tree Lotto exclusion. Existing
role-policy and signature tests supply the underlying actual Ed25519 controls.

This is the review seam, not a durable queue, source plugin, live model or 24/7
service. No public events are emitted: even digests and opaque references remain
private. Production needs authenticated source admission, private thread scoping,
durable bounded queues and idempotent jobs, cancellation and watchdog budgets,
an isolated executor without guardian keys or production database access, and
operational tests. Watchdog recovery must not restore withdrawn permissions.

The accepted AHIN signing profile/test vectors, current signer/control registry,
trust roots and verifier/consume contract listed in
[AHIN-AUTHORIZATION-STATUS.md](AHIN-AUTHORIZATION-STATUS.md) remain missing.
Conformance schemas and signature references cannot fill those gaps. Formal
create/authorize/execute/challenge/revoke/recover acceptance remains blocked.
No real child enrollment, carbon certification, payment, UNICEF signing authority,
production deployment or procurement readiness is established by this increment.
