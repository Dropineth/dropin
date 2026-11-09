# Child twin proposal and human authorization sandbox

Current implementation supersedes the institutional/child-key signing roster in
9061341. UN/international agencies are external standards/audit references; BEV
and climate-verification actors provide potential evidence attestations; schools
and local organizations facilitate enrollment only after guardian verification.
None of those roles, the protocol engine, or the CAI can grant account authority.
No institution's actual participation or endorsement has been established.

## Implemented workflow

`child-twin-orchestration.ts` implements idle → inferring → awaiting-human-consent
→ authorized → executing → receipted, plus denied/aborted terminal paths. One
instance handles one proposal. Its provider receives only an evidence digest and
an immutable empty tool list, with an abort signal and 10–3000 ms timeout. Output
must be exactly a learning proposal for that digest, with no tools or extra
fields. The returned consent payload is a copy of the strict host request, never
a model-supplied authorization. Failure, timeout, denial, abort, withdrawal and
shutdown prevent progression. A provider ignoring cancellation may continue its
own computation; orchestration rejects late output. Provider code is a trusted
host dependency, not a code sandbox. Do not install arbitrary provider code.

No live inference provider or credential is configured. Tests use clearly
synthetic providers, including malformed and stalled responses. This is tested
orchestration, not evidence of live model inference. The fixed Docker worker is
an explainer, not a live model or human digital replacement.

An explicit host human-interaction port records child assent. Externally supplied
Ed25519 guardian signatures are then verified. The experimental fixture policy
requires two independent guardian principals/keys for learning; it is not a legal
two-guardian rule. One valid guardian can withdraw; a child can withdraw via the
trusted human-interaction port without any key or majority. The CAI has neither
port nor keys. Production must authenticate human handoffs and guardian status;
local fixture registration does not verify real-world guardianship.

The separate synthetic rights backend now requires trusted credential metadata
`actorKind: human`, `signaturePurpose: account-transaction`, and `isAgent: false`
before counting a signature or selecting a recovery/guardian/participant key or
delegate. AI agents, external references and evidence attesters cannot contribute
transaction authority even with valid Ed25519 signatures and human-looking names.
Conflicting non-signer entries for the same canonical public key or actor reference
also reject the vote, including PEM formatting aliases. Account-signing and
external-attestation credentials must not share conflicting registry identities.
These classifications come from the trusted registry context, never the proposal
or approval payload. Missing legacy metadata fails closed; existing synthetic
registries need explicit reviewed classification rather than automatic inference
from role or organization names. An institution affiliation is not itself a
signer class. This does not implement an external attestation service or an
on-chain contract, and does not alter separately scoped evidence attestations.

The PostgreSQL runtime already serializes session-local changes using the session
row lock held through commit; verification admissions also bind the expected
revision. A withdrawal holding that lock commits before a waiting transaction can
read the updated consent. If an operation acquired the lock first, it can commit
before a waiting withdrawal: the latter is not retroactive cancellation. Failed
transactions roll back their tentative changes. Native tests exercise this order,
stale revisions, committed withdrawal and receipt-write rollback. No extra CAS is
claimed to close a race with external authority: a signed remote snapshot can
become stale after its final check, and an unreceived revocation is not local DB
state. Real operations remain unavailable without an accepted external authority
commit/revocation protocol and authenticated registry enrollment.

The human port requires `recordChildAssent(request)`: a missing/legacy argument
fails closed. It stores only the canonical request digest, epoch and expiry in
memory, replacing any previous grant. The complete request (including nonce and
evidence digest) must match at every authorization check and commit. Successful
commit consumes assent; failed checks leave a still-valid grant available for
the same request. Registry revocation, withdrawal and shutdown invalidate it;
expiry is evaluated on access and expired grants are lazily removed. Invalid
replacement attempts also clear the previous grant. Snapshot/audit output does
not expose the grant digest. This is local proposal-scoped assent, not proof of
human identity, a durable consent register or distributed atomic revocation.

Human children and their CAI are distinct. Direct client-side human-child signing
is not implemented in this increment. Neither raw Ed25519 nor an interface is
claimed to implement WebAuthn: the existing backend's actual WebAuthn protocols
remain separate. No browser/hardware signer integration is delivered here.

`synthetic-account-network.ts` v2 rejects the previous role roster and v1 signed
requests. It accepts only synthetic guardian public keys, rejects private PEM,
key/principal aliases, replay and extra fields. Every signature binds account,
epoch, nonce, action, evidence digest and expiry (maximum 30 seconds). Signing
bytes are UTF-8 `CanopyProof synthetic CAI request v2\n` followed by
`canonicalRightsJson(request)`, signed directly with Ed25519, unpadded base64url.
This is explicitly synthetic, not an approved production AHIN signing profile.

Execution uses only `runSyntheticNetworkReview`, the actual pinned upstream Engine
and existing isolated fixed worker. Authorization is checked before dispatch and
again synchronously at local receipt commitment. Revocation advances the epoch.
These checks prevent local concurrent state changes from slipping through; they
do not make independent external authority and database commit atomic. Operations
requiring that stronger production guarantee remain unavailable.

Receipts are bounded to 32 digest-only learning records, with no monetary value
or carbon-credit status. No money, child entitlement or certified climate ledger
is updated. Withdrawal/shutdown deletes receipts and closes the local account;
it does not cancel established rights elsewhere. Deletion removes references,
not guaranteed memory erasure. The running fixed worker may finish within its
three-second limit, but cannot commit after closure. No restart persistence,
backup deletion, external authority service or recovery/dispute endpoint exists.

## Upstream provenance and tests

https://github.com/deepseek-ai/dsh-superagent-prototype was checked 2026-11-09 at
8c32a9dc5d72c033816c6a8110b37f40cf94fba4. It is MIT licensed (DeepSeek Harness Team),
research code and explicitly not an official DeepSeek product. Existing source
pinning loads only verified bytes, including the license. Preserve that license
when distributing upstream code. No upstream installer or dependency was added.

Actual Engine scope/policy/assessor/executor/outbox ports route the bounded ticket;
no external messages or worker tools are enabled. Existing runtime tests probe
network/rootfs/host isolation; they do not prove kernel security. The host
inference provider runs outside Docker and must be approved separately.

```sh
CAI_DEEPSEEK_ROOT=/workspace/dsh-superagent-prototype node --import tsx --test tests/unit/child-stewardship-cai-network.test.ts tests/unit/child-stewardship-twin-orchestration.test.ts
```

Life++/AHIN alignment is scoped proposal binding, explicit consent, independently
verified authorization, revocation and separated evidence. No smart contract,
zero-knowledge verifier, institutional signer, commercial funds or real child
account is fabricated. Production requires an approved inference/data-processing
provider, authenticated human client signer, guardian registry and authority
service, distributed commit protocol, recovery/safeguarding operations and exact
release approval. Those capabilities remain unconfigured/closed. This branch
also depends on unpublished ledger-boundary commit cdd78de.
