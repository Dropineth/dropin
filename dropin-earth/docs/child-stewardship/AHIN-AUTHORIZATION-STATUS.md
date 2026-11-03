# AHIN authorization integration status

This increment depends on PR19 and PR20. It does not add a wallet, replace the
four ledgers, change the production backend, or enable real participation.

## Verified protocol boundary

The existing versioned upstream accountability protocol has cognitive multisig,
committee, intent, evidence and challenge contracts. Its merged deterministic
conformance implementation must be distinguished from later signed/durable
admission proposals and from a deployed, independently administered authority.
Private upstream schemas, source and license-restricted content are not vendored
here. The owner-local source and digest inventory is retained outside this public
repository; protocol conformance is not operational authorization.

There is no accepted production child-account binding profile or enrolled current
AHIN authority in this backend. Consequently the existing child agent gateway
remains a product proposal with `finalAuthority:false`, and authenticated external
record projections cannot authorize any of the four ledger mutations. Successful
signature verification, a committee record, a PR comment or a fixture PASS does
not create a guardian appointment, legal permission or a payment instruction.

The next formal integration needs all of these versioned artifacts:

1. Owner-approved signing bytes/profile, schema pins and test vectors for the
   supported multisig admission, plus permission to redistribute any bindings.
2. The current signer/committee registry and verifier service contract: identity
   and public-key provenance, role/independent-control mapping, revocation and
   challenge versions, time bounds, and rotation/restore semantics. A supplied
   `independent=true` flag is not real-world independence evidence.
3. An approved exact mapping from protocol intent/boundary/delegation/output and
   evidence references to the application operation digest, tenant, beneficiary,
   purpose, policy/registry versions and authorization epoch. A verified hash
   cannot be converted into a differently serialized operation by changing its
   prefix. Cognitive committee roles do not replace legal guardian/protector or
   trustee roles.
4. An execution-time consume/recheck contract with the application transaction:
   one-use authorization, immutable audit reference, current revocation after lock
   waits, failure/timeout behavior, and recovery floors. A previously accepted
   remote proof must not revive permission after withdrawal or restoration.

Until these artifacts and operational sources are verified, formal AHIN execution
remains unavailable. No invented wire profile or synthetic provider fills the gap.

## Application authorization improvements

The existing role-specific operation verifier now also compares canonical SPKI
public-key identities. Renaming one key into different actors, roles or control
domains cannot produce independent approvals; PEM line-ending aliases match.
Configured V/R panels must have distinct actors, declared domains and actual
keys, including seats that did not vote on the current operation. This catches
key reuse, not hidden common ownership of different keys, which still requires a
trusted identity/control registry and independent review.

Child signatures are rejected as payment approvals, even when the necessary adult
approvals are also present. Child voice remains separate from payment authority;
the existing individual child protection-pause path still works without a
majority. Agent credentials cannot add votes. Existing child/guardian/resume/upload
capabilities remain confined to the child namespace and cannot enter Tree Lotto,
wallet, treasury or settlement routes. No public identity or key-fingerprint ledger
is introduced. Fingerprints are local comparison values, not anonymity claims.

Native PostgreSQL tests verify denial before admission, no rights-state/revision
change after a direct HTTP attempt, and the unchanged valid adult positive path.
Existing consent withdrawal, recovery, nonce/replay and transaction checks remain
mandatory. The backend remains synthetic-only and closed without its existing
restore-authority dependencies; successful CI does not mean production deployment.

## Deployment status

No provider selection, cloud resource, credential, payment, child enrollment or
production change is part of this increment. Render selection is discontinued;
the earlier preparation worksheet is historical, not an instruction to provision.
SFO readiness is not established by this repository. Human review, current backend
and safeguarding readiness, exact-main CI, sealed release, environment approval
and tested rollback remain independent requirements. No procurement award or
contract-readiness claim follows from these code changes.
