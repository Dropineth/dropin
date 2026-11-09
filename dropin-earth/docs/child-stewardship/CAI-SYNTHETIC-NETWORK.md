# Synthetic children's CAI account network

This local experiment adds participant approval to the existing pinned DeepSeek
Engine/isolated-worker adapter. It does not mount an HTTP service or activate
accounts. No real child, institution, guardian, money or carbon credit is present.
It depends on the separate local ledger-boundaries increment cdd78deb.

## Source and actual integration

Upstream https://github.com/deepseek-ai/dsh-superagent-prototype was checked on
2026-11-09: HEAD 8c32a9dc5d72c033816c6a8110b37f40cf94fba4 matches
`integrations/cai/deepseek-source-pin.json`. Its MIT license names the DeepSeek
Harness Team. Its README says research prototype, not an official DeepSeek
product; some article designs are not implemented. The existing loader checks
all pinned source/license bytes and bundles only those verified bytes. No source
upgrade, installer, external model, GitHub/Feishu connection or new dependency
is introduced. Preserve upstream copyright and license when distributing it.

`synthetic-network-router.mjs` uses actual Engine, MemoryRepositories, scope,
policy, assessor, executor and outbox ports. One instance accepts one ticket.
The assessor deterministically accepts a registered learning proposal; it is not
an LLM. The existing Docker worker is a fixed explainer, not a digital person or
an independent voter. It receives only random work ID, operation digest and test
delay. No signatures, account identifiers, evidence content or keys enter it.
No tools or external replies are enabled. Docker restrictions and probes are
covered by the existing runtime suite; this does not establish kernel security.

## Local authorization contract

`synthetic-account-network.ts` owns a copied synthetic registry. Each participant
has a distinct ID, principal and Ed25519 public key. Aliases and duplicate keys
are rejected. This prevents declared duplicates, not dishonest real-world
identity claims; there is no identity proofing service here.

Learning review requires child assent, CanopyProof-placeholder and local-child-
organization-placeholder approvals, plus either UN-placeholder or BEV-placeholder.
These are configurable-in-code experimental roles, not legal requirements or
claims of institutional participation. A child's digital representative is never
an additional principal. No payment, Tree Lotto or financial action is accepted.

All signatures bind the exact strict request: profile, synthetic account, local
epoch, nonce, learning-review/withdraw action, evidence digest and expiry. Bytes
are UTF-8 `CanopyProof synthetic CAI request v1\n` followed by
`canonicalRightsJson(request)`, signed directly with Ed25519; signatures are
unpadded base64url. This is a new explicitly synthetic profile, not the approved
AHIN production wire/signing profile or current-authority snapshot format.
Approvals expire within 30 seconds. Revocation advances epoch; commit checks
freshness, all roles and current revocation synchronously after asynchronous work.
Replays are refused. A child can sign withdrawal alone without majority approval.
Withdrawal and host shutdown close the instance permanently and erase receipts.
A running worker can finish within its 3-second deadline but cannot commit after
closure; this is not immediate process cancellation on withdrawal.

Only up to 32 digest-only learning receipts are retained, without signer lists
or raw evidence. They explicitly have no cash value and are not carbon credits.
No money, entitlement or climate issuance ledger is updated. Purging means
removing in-memory references, not guaranteed RAM erasure. This sandbox has no
persistence, backups, restart replay protection, externally authenticated caller,
registry authority, production recovery or dispute service. Host controls are
trusted fixture-only; do not expose them as unauthenticated APIs.

Life++/AHIN alignment is proposal binding, independent scoped approval,
revocation and accountable evidence separation. It is not formal protocol
certification. Single-process synchronous commit prevents local interleaving;
it cannot make external registry revocation atomic with database execution.
Real distributed authority, safeguarding, recovery, independent human review
and release acceptance remain prerequisites for production.

## Run

With existing dependencies, the pinned upstream checkout and cached worker image:

```sh
CAI_DEEPSEEK_ROOT=/workspace/dsh-superagent-prototype node --import tsx --test tests/unit/child-stewardship-cai-network.test.ts
```

This is the executable synthetic demonstration: ephemeral participant keys,
real Engine routing, isolated worker, successful learning receipt and denied
commit after withdrawal, expiry, revocation and shutdown. No endpoint or account
is deployed. Setting no upstream path skips the integration case explicitly.
