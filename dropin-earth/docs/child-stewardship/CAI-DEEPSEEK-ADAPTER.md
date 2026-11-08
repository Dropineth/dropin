# CAI proposal adapter for child accounts

Status: locally runnable synthetic Router/Worker integration; not a deployed agent or AHIN authority.

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
No upstream source is copied into this repository. The local runtime loads the
actual core from an explicit checkout after checking every core source file and
LICENSE against the pinned SHA-256 inventory. The loader captures verified bytes,
bundles only those bytes in memory, allows only the Node crypto builtin as an
external import, and never imports the mutable checkout after verification. That checkout retains its MIT
notice. Any later vendoring must also preserve the notice.

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
2. `reviewCaiChildProposal(input, current)` checks the original server-stored work event and exact event/operation binding
   and calls the existing `applyRightsOperation` with server-supplied current state
   and context. It discards the calculated state, including all simulated outbox
   effects. Its versioned, digest-only result is advisory and cannot authorize
   execution. Retries consume no ledger nonce. `ahin-execution` always fails with
   `AHIN_AUTHORITY_UNAVAILABLE`.

Only trusted server code may supply `current`, including `expectedTrigger` loaded
from its private job store rather than copied from the worker report. Worker reports never supply
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

The review seam is now exercised by the local runtime below. It is not a
durable queue, public source plugin, live model or 24/7 service. No public events are emitted: even digests and opaque references remain
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


## Run the actual synthetic Router/Worker integration

Prerequisites: Node 22.23.4, installed locked application dependencies, Docker,
and the reviewed DeepSeek source checkout. No Prisma generation, provider keys,
DSH Harness installation, GitHub/Feishu account or child account is required.

```sh
git clone https://github.com/deepseek-ai/dsh-superagent-prototype.git /tmp/cai-deepseek
git -C /tmp/cai-deepseek checkout --detach 8c32a9dc5d72c033816c6a8110b37f40cf94fba4
docker pull node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
# From dropin-earth:
CAI_DEEPSEEK_ROOT=/tmp/cai-deepseek npm run demo:cai:synthetic
CAI_DEEPSEEK_ROOT=/tmp/cai-deepseek npm run test:cai:synthetic
```

The driver never pulls images implicitly. The image is the inspected immutable
Node 22.23.4 Alpine image. Tests without the explicit source path are marked
skipped in the ordinary unit suite; the dedicated integration command instead
fails if the path is missing. A failed source pin, missing image or Docker
unavailability fails closed. No mock engine substitutes for DeepSeek.

`integrations/cai/synthetic-router.mjs` composes the upstream `Engine`,
`MemoryRepositories`, `Policy`, `Assessor`, `Executor`, and `Outbox` interfaces.
The deterministic Assessor accepts only an exact registered local proposal using
an inferred synthetic rule. The Engine creates the real Ticket/Assignment and
records completion. Executor callbacks enqueue work; container execution occurs
after the synchronous Engine command. Each work item owns a separate original
operation and trusted current-state provider. Source events carry no reply
channel, and the Outbox rejects external sends.

The Worker is a fixed program, not an LLM. It receives only a work ID, operation
digest and bounded synthetic delay. Docker runs it without networking, host
mounts or injected environment, as UID/GID 65534, with a read-only filesystem,
dropped capabilities, no-new-privileges, CPU/memory/PID limits and a deadline.
The Router host still needs trusted local Docker access; do not expose its daemon
or run untrusted extensions on that host. The Worker never receives the Docker
socket, operations, beneficiary records, authority state, signatures or keys.

The host uses ephemeral **synthetic** Ed25519 fixtures for the actual existing
role verifier, checks current authority before launch and again after the
asynchronous worker report, and discards the simulated state. Reports must match
the expected work ID/digest and fixed schema exactly. A worker report cannot
supply authority. A successful run returns `executionEnabled:false` and
`finalAuthority:false`; it has no payment/ledger effects.

There are at most two concurrent workers and eight total jobs by default (hard
maximum 32). Stop cancels queued or running jobs without a vote. Shutdown refuses
new work and waits for owned containers to be removed; a cleanup error is surfaced
rather than reported as clean shutdown. Timeouts and bad reports fail closed;
there is no automatic retry or restoration of permission. The demo handles SIGINT
and SIGTERM and exits after its bounded work. Crashed hosts may leave a stopped
or running container; operational crash recovery is not implemented. Containers
are identifiable by `io.canopyproof.cai=synthetic` and `cai-synthetic-` names.

Local tests use the real pinned Engine and real Docker execution. They cover
positive multi-role review, sandbox settings, cross-task isolation, post-dispatch
revocation, child-only payment, signature tampering, Tree Lotto rejection,
bounded queue/timeout, queued and active cancellation, shutdown, malformed worker
input, and tampered upstream source. This is a runnable engineering increment;
production signing, persistence, authenticated external ingress, model inference,
real enrollment, deployment and always-on operation remain unimplemented.


## Independent automated adversarial review

A separate automated reviewer examined the integration at commit
`4c364865f9c2365fa29d9ff88c094de8d6eabbcd`. This was not independent human review
and does not satisfy a production release approval requirement.

The reviewer reproduced a low-severity trusted-checkout race: changing a source
file after its digest check but before its path import executed unverified code
in the Router host. The Worker could not exploit this because it has no host
mount. The fix loads a bundle constructed solely from captured, verified bytes,
with no filesystem fallback or local tsconfig resolution. The original independent
reproduction now reports `unverifiedSourceExecuted:false`. A deterministic FIFO
regression coordinates a mutation after hashing and verifies the altered code
never executes. The reviewer inspected the fix and found no introduced bypass.

The reviewer independently passed the original eight integration tests, then the
new verified-byte race and active containment probes. The complete updated
integration suite passes ten tests. No worker-controlled authorization bypass was
found within this reviewed synthetic scope.

Containment evidence must be separated from configuration and assumptions:

- Configuration inspected: immutable image, network none, rootfs read-only,
  UID/GID 65534, no host mounts or forwarded application credentials, resource
  limits, dropped capabilities and no-new-privileges.
- Actively tested in the actual Worker container: `/tmp` rootfs writes fail with
  EROFS; an existing nonsecret host sentinel and the Docker socket are unavailable;
  only loopback is visible and an attempted route to documentation-only
  `192.0.2.1` fails; effective capabilities are zero and NoNewPrivs is enabled.
- Not established: resistance to kernel/container-runtime exploits, safety of
  arbitrary future model tools, an untrusted Router host/Docker daemon, crash or
  daemon-outage cleanup, a production key registry, or production authorization.

Private work IDs and digests are correlation data, not anonymous/public records.
The synthetic worker input is bounded and contains neither beneficiary records
nor signatures. The Router host and its current-state provider remain trusted;
this increment does not elevate a worker result into authority.
