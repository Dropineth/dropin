# Life++ child-account composition candidate

Status: `SIMULATION_ONLY / DRAFT_REVIEW_CANDIDATE / NOT_DEPLOYED`.

This increment is a bounded composition check for the existing synthetic child
network. It is not a live Life++ verifier, a production child account, an
independent human approval, a legal guardianship registry, or a custody system.
It must not be mounted in the product backend or used for real child information.

## Source contract and scope

The reviewed main heads are source provenance, not activated protocol authority:

- CAI `463d4bb2bb476fbf9c718e43d48b14e3cca455bc`
- PoCC `65e5602c579e40c9b39d9fb742ce946b04d85aa0`
- AHIN `72a7d144c1920ee1c588800253f34e89469e0b05`
- ChainRank `e0707049a529b5bfbd847fc41d4efe4e6a3f99c8`

Normative reference: [Accountability Convergence v1](https://github.com/poccahin/pocc/blob/65e5602c579e40c9b39d9fb742ce946b04d85aa0/convergence/spec/CONVERGENCE_V1.md).
The upstream schema/contract direction is CAI → PoCC → AHIN → ChainRank. This
adapter consumes a deliberately separate strict **fixture projection**, not
copies of upstream private source or claims of upstream cryptographic validity.
The profile `CanopyProof-Lifepp-Child-Fixture/1` cannot be confused with
`lifepp.accountability.v1` wire records. Source-head mismatch is rejected.

Upstream reference implementations themselves disclose fixture-only boundaries.
For example, [PoCC cognitive multisig](https://github.com/poccahin/pocc/blob/65e5602c579e40c9b39d9fb742ce946b04d85aa0/convergence/lib/pocc-convergence.mjs)
uses `fixture-signature:` references. [AHIN enforcement](https://github.com/poccahin/AHIN/blob/72a7d144c1920ee1c588800253f34e89469e0b05/convergence/lib/ahin-enforcement.mjs)
uses local activation labels and records envelopes. Neither observation establishes
a production authenticated authority, independent control domain or deploy approval.

## Implemented boundaries

`createLifeppSyntheticAccountNetwork` always supplies a Life++ boundary to the
existing network. The legacy constructor remains usable as its original sandbox
and is not upgraded into a full-stack or production account by this patch.
The composed constructor returns the protocol observation port separately from
the network passed to the existing child-twin orchestration. Only the trusted
test host may receive the observation/appeal port; inference and workers must not.

The composition gate begins closed. A fresh fixture must bind the same synthetic
Persona, strict profile and exact source heads; monotonically increasing sequence;
valid safe-integer timestamps with at most 30 seconds lifetime; finalized PoCC
PASS; AHIN ACTIVE; no open challenge; active KYA 2 or 3; continuity and liveness.
KYA, membership and decisions are simulated host input, not independently verified
credentials. Unknown enums, extra fields, malformed evidence, stale timestamps
and replay clear earlier learning eligibility. Each action rechecks freshness.
Observed expiry is latched by discarding the current fixture. A monotonic
high-water clock rejects an observed rollback or invalid time and also discards
the current fixture. Neither clock rollback nor later clock recovery can revive
it; a valid, higher-sequence observation at or beyond the high-water time is
required. This only detects time sampled by this process, not unobserved changes
or cross-restart rollback.

Before inference, immediately before the provider microtask runs, and before
its output enters the human-consent handoff, orchestration calls the read-only
protocol gate. Missing or evicted Personas cannot invoke the provider. Expiry,
eviction, malformed observations or clock rollback during inference reject its
output. A provider already running is not forcibly terminated by this check.
This gate does not require assent/signatures before drafting a proposal.

Child assent and the existing externally supplied synthetic guardian signatures
are still necessary. A protocol fixture never substitutes for them. The gate is
checked again synchronously at receipt commit, so a local expiry, challenge or
eviction between dispatch and commit prevents a learning receipt. This does not
solve distributed revocation races or provide durable restart replay protection.

The CAI remains a strict non-signer. It has no human signing key or authority
issuance method. ChainRank is validated as advisory context only and never
participates in the boolean eligibility gate. Even its maximum score cannot
override missing consent, KYA, liveness, challenge, membership or hard failure.
This preserves the separation in [ChainRank routing](https://github.com/poccahin/cr/blob/e0707049a529b5bfbd847fc41d4efe4e6a3f99c8/convergence/lib/chainrank-routing.mjs).

Finalized PoCC FAIL + HARD latches the same in-memory Persona into terminal
eviction. An observed AHIN EVICTED state also fails closed. A provisional HARD
record is ineligible but does not itself claim a final verdict. Later PASS,
new rank and appeal cannot clear the latch. Immutable copies of fixture history
remain queryable with domain-separated deterministic hashes; limits deny further
updates rather than evicting history. Restarting this object loses its history.
Durable, anti-rollback Persona history is a mandatory missing production service;
this candidate does not claim permanent enforcement across restarts.

## Independent appeal and children's rights

Appeal intake records only a counterevidence digest bound to an exact existing
decision root. Two distinct synthetic human reviewer principals and distinct
control-domain labels are required; they cannot be the target Persona or share
a domain listed in the original decision's exclusion set. The trusted fixture
host must populate that set with the target, original adjudicators, relevant
guardians/operators/providers and other conflicts. Labels alone are not proof
of independence. Production requires authenticated identities, verified control
relationships, conflict review and a safeguarding operator.

An appeal remains `PENDING_INDEPENDENT_REVIEW`. There is deliberately no resolution
or authority-restoration method. A future independent process may add corrections
and remedies while preserving the original history. Same-Persona restoration is
not supported by the pinned protocol v1 and cannot be fabricated here. Any future
protocol change requires a separately versioned and reviewed migration.

CAI eviction is not punishment of a human child. Human child withdrawal and a
valid guardian withdrawal remain possible after eviction or any protocol
ineligibility. They erase local learning receipts as before; they do not mutate
the protocol fixture history, financial rights, existing custody or entitlements.
The appeal must never be a precondition for emergency care or a child's rights.

Learning observations, noncash educational feedback, contractual benefits,
custodied money/securities and certified environmental outcomes remain separate.
DRM is cognitive accountability, not an asset multisig. The new module has no
account-payment, custody, beneficial-ownership, transaction submission, credit
issuance or impact-certification function. It does not connect the asset executor.

## Production gates still closed

1. Agreed jurisdiction, operating entity and safeguarding/legal acceptance.
2. Real authenticated human-client signer and verified guardian enrollment.
3. Authenticated versioned CAI/PoCC/AHIN adapters and validated source contract
   roots, trusted authority roster, independent control evidence and current
   revocation/commit protocol. String labels and fixture signatures cannot pass.
4. Durable Persona terminal history, rollback-safe replay protection, recovery,
   independent appeal operation and child-rights preservation across failures.
5. An approved inference provider and child-data processing arrangements, with
   minimization, privacy, retention and operational incident controls.
6. A preview of the exact candidate; full required CI at its exact head;
   independent human review of the full inherited application; a verified
   authorized publisher/approver arrangement and deployment path; a tested
   rollback artifact and traffic readback. Unknown, skipped or pending checks
   are not passed release gates.

This patch does not alter workflows, permission settings, credentials, release
approval, protected environments, public routes or production traffic. Draft PR
publication is for review only. Independent human review and every preview-first
release gate remain required before any merge or deployment. Automated code
review is not independent human release approval.

## Verification

Run the new boundary and composition tests along with the existing network suite:

```sh
node --test --import tsx tests/unit/child-stewardship-lifepp-boundary.test.ts tests/unit/child-stewardship-lifepp-network.test.ts tests/unit/child-stewardship-cai-network.test.ts tests/unit/child-stewardship-twin-orchestration.test.ts
npm run lint
npm run typecheck
```

Actual pinned Engine tests also require the verified `CAI_DEEPSEEK_ROOT` and the
existing Docker workflow. Full CI, database/worker/browser checks and independent
human acceptance are separate gates. Do not report a focused subset as full CI.
