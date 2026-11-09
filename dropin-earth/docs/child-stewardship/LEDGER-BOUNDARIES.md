# Child-account ledger boundaries and remaining service gates

This increment starts from merged main 76881fb85c5854afb2a9e1978253c5c1639f24f2
(PR #23, merged externally 8 November 2026 at 12:11:35 UTC). It does not include
the separate local NASA/Prisma initialization fix ad1f2da. It creates no production
account, funds, benefit obligation, certification, approved identity or deployment.

## Implemented separation

| Existing record | What it represents | Enforced boundary |
| --- | --- | --- |
| Learning observations/reviews/assessments | Synthetic learning observations, E0 evidence, unknown ecological assessment | Strict runtime schemas reject upgraded evidence, verified capture, certified outcomes and additional monetary/carbon fields |
| Learning contributions | Nontransferable, noncash EDU_FEEDBACK, learning_only, amounts 0 or 1 | Read, command and durable-normalization guards reject cashValue=true, another unit, transferability, larger amounts and extra balance fields |
| Rights entitlements/funding lots/payments | Separate XTS simulation with its own authorization and conservation rules | Existing independent SQL write constraints remain; reconstruction rejects commercial currencies and non-right entitlement categories |
| Commercial accounting/customer funds | Not supplied by the isolated child backend | No observation or feedback conversion API, production payment mode or custody connection is introduced |

EDU_FEEDBACK is educational feedback, not a legally established noncash benefit
entitlement. XTS rights are simulated financial obligations, not real child-benefit
or commercial ledgers. An actual noncash benefit service and commercial accounting
integration still require their own approved contracts and operators. No new claim
is inferred from having separate record collections.

The new ledger-boundaries.ts validates the existing record shapes without rewriting
or silently dropping invalid claims. It runs before learning commands and views,
before learning state normalization, and after durable snapshot reconstruction.
Invalid records fail closed with a generic 503 boundary error; it does not repair
or certify corrupted state. Rights writes still pass through their existing SQL
constraints, preserving independent testing of financial types and conservation.
Rights read checks cover denominations/category in entitlements, funding lots and
payments; they are not exhaustive validation of every rights record or delegation.

This is application-boundary enforcement, not a replacement for database role
isolation, restore admission or independent verification. Raw database writers can
bypass application code; the learning guard does not purport to be a new SQL
constraint on every possible write path. Ordinary product views and commands reject
such malformed records instead of promoting them. Full provenance, entitlement
legality and external certification remain outside this shape/classification guard.

## Concrete controls and unresolved ownership

| Concern | Existing control | Production dependency still missing |
| --- | --- | --- |
| Consent and revocation | Purpose-bound learning consent, child assent, one-use draft authorization, execution-time checks | Verified guardian relationship, production consent policy/operator |
| Current authority | Nonce-bound signed snapshot, durable registry commitment, final command pre-commit recheck | Accepted AHIN child signing profile, enrolled trust/guardian registries; external changes between final read and COMMIT remain possible |
| Recovery | Quarantine, current checkpoint and separate verifier admission; synthetic resume invalidates old generations | Approved identity recovery and guardianship re-establishment services; login recovery is not renewed consent |
| Privacy/retention | Scoped views, suppression, deletion/export jobs, protected-case separation and retention controls | Named controller, lawful retention and transfer decisions, operational deletion acceptance |
| Safeguarding/disputes | Protected complaint visibility, protector role and conflict checks, review outbox | Accountable protection team, referral/response procedures and independently verified role appointments |
| Tenant roles/audit | Restricted PostgreSQL runtime/verifier roles, tenant scope, transactional receipts/audit/outbox | Operational access review, incident process, approved hosting and release evidence |
| Institutional procurement | Versioned interface, synthetic evidence pack, reproducible tests and explicit limits | Legal supplier identity, service/security terms, operational assurances and buyer-specific assessment; no UN endorsement, registration or procurement eligibility is asserted |

The independent review/operational gates and disabled real enrollment/payment
configuration remain unchanged. A future integration must not treat a learning
observation, reviewed activity or educational feedback as verified climate impact,
an issued carbon credit, a payable obligation or a spendable asset.

## Validation

Positive fixtures are created through the existing learning transitions. Negative
cases cover monetary units, cash/transfer flags, excessive amounts, extra balance
and certification fields, upgraded evidence/capture claims, review decisions,
assessment claims and XTS-to-USD relabeling. Durable reconstruction rejects corrupted
rows. The native test verifies invalid provisioning leaves no session and invalid
transaction mutation leaves persisted records unchanged. Valid initial sessions
remain empty: existing SQL requires fresh upload authorization to insert observations.

Independent automated review passed 26 initial learning/boundary tests, the latest
3 boundary tests and the native rollback test. It found no actionable defect within
scope and confirmed privacy-erasure compatibility. Automated review is not human
release approval. Final local validation: 171/171 child/backend/planetary unit tests and 183/183
native child/backend tests passed. Full lint, focused strict TypeScript, backend
bundle and whitespace checks passed. The complete repository unit glob and normal
workspace typecheck were not rerun; their prior dependency failures remain unresolved.

Main's combined commit-status endpoint returned an empty statuses list; that is not
passing Actions CI. Previously denied Actions, Cloudflare and Prisma download paths
were not retried. Full workspace typecheck and full repository CI remain unresolved.
