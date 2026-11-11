# CAI child-account request boundary

The child account is organized around its CAI lifecycle. CAI maintains the
proposal workflow and binds it to the account, human consent, current Life++
eligibility and independently supplied authorization. It is not an optional
chatbot and is not a signer. DeepSeek's Engine supplies orchestration ports;
it does not replace Life++ identity or human authority.

## Implemented request binding

`createChildTwinOrchestration` validates the exact cloned request:

1. Before scheduling inference.
2. Immediately before invoking the provider in the queued microtask.
3. After inference returns, before presenting the human-consent handoff.
4. Through the existing signature/assent checks at authorization and execution.
5. Through the existing synchronous recheck before a synthetic learning receipt.

`network.assertProposalAllowed(request)` now requires an explicit learning
request. It checks the strict profile, account, current epoch, unconsumed nonce,
expiry, 30-second lifetime bound and valid host time, then the composed Life++
eligibility gate. Foreign, revoked, expired or already consumed requests cannot
reach the provider or become a new human-consent handoff. Checks do not consume
the nonce, record assent, issue a signature or confer authority. Revocation or
consumption during asynchronous inference rejects the returned proposal.

The previous implementation checked only account closure and optional protocol
eligibility at the pre-inference boundary. It still enforced request scope at
authorization, but could invoke the scoped provider for a stale or foreign
request. The new checks close that earlier account-isolation gap without
relaxing the later authorization requirements.

The standalone legacy synthetic network has no monotonic-clock guarantee.
The composed Life++ boundary separately checks clock rollback. Neither is a
durable replay registry, production guardian registry or distributed
revocation/commit protocol. A process restart must not be treated as authority
renewal. No production gate is opened by this change.

## Verified source and limits

Checked on 2026-11-11 against Dropineth/dropin main
`f602d58efa30cc17d6cbd522c79c7a645e361048`. The upstream pin remains
`8c32a9dc5d72c033816c6a8110b37f40cf94fba4` from
https://github.com/deepseek-ai/dsh-superagent-prototype. All 18 pinned files,
including the MIT license, matched their recorded SHA-256 values. The real
Engine and MemoryRepositories loaded from those verified bytes.

DeepSeek labels this repository a research prototype, not an official product
or production-ready system. This patch does not configure live model inference,
public ingress, real-child enrollment, persistent account state, production
keys, custody, payments, contract execution or institutional participation.
Model input remains only a digest and an empty tool list. Even digests are not
assumed anonymous; no real-child data was used or transmitted in these tests.

## Local validation

The five new request-scope regression groups fail against unchanged main and
pass with the patch. They cover foreign accounts, stale epochs, expired and
overlong requests, consumed nonces, revocation before the provider microtask,
expiry/revocation/consumption during inference, invalid host clocks and
non-authoritative proposal handoff. Relevant existing CAI/Life++ tests and a
strict TypeScript check pass in the focused source snapshot.

The snapshot is not the complete application checkout. Docker is not installed
in this environment, so container tests are skipped rather than replaced with
a mock engine. Full lint, complete repository CI, the actual isolated-worker
run and production deployment have not been verified by this patch.

Run the new focused regression from dropin-earth:

```sh
node --import tsx --test tests/unit/child-stewardship-cai-request-scope.test.ts
```

Before release, also run the repository's required checks and the existing
explicit-source Docker integration suite in an appropriately provisioned
environment. Keep real enrollment and consequential execution closed pending
the independent authority, persistence, safeguarding and release gates.
