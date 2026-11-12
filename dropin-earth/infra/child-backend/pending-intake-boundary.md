# Device-independent subjects and pending intake: synthetic boundary only

This slice adds a pure model and tests, not an account service or a live intake form.
Nothing is stored, sent, deployed, signed, funded, verified, claimed or paid. No real
child information belongs in these fixtures. There is no runtime flag that enables
real intake or claim approval, and no existing API/store imports this module.

## What is represented

- A synthetic subject is an unverified container with a random synthetic reference.
  It requires no device, credential, child key, learning activity, CAI or AHIN role.
  It does not establish a person's existence, identity or legal beneficiary status.
- Pending intake contains only a fixed review category, fixed synthetic source,
  random reference, optional **unverified** subject association, explicit fixture
  receipt/expiry times and the immutable classifications `pending_review` and
  `authority: none`. It may exist before a subject is known.
- Strict versioned parsers reject extra fields rather than retaining or silently
  dropping them. There is no name, location, birth date, guardian claim, free text,
  URL, attachment, amount, currency, signature, consent or arbitrary metadata field.
- References are not credentials. Parsing validates structure, not authenticity,
  ownership, present-time eligibility or access. Expired fixture data can be parsed
  without renewing it. No ID should be used as a public lookup or bearer link.

The explicit `SIMULATION_ONLY` context supplies a test clock. Its seven-day maximum
retention is a fixture constraint, **not a global legal retention policy or an
implemented purge job**. Returned flat records are frozen copies. These functions
have no storage, logging, network, environment-variable or production adapter.
`RightsBeneficiary`, rights state, session snapshots and payment outboxes are unchanged.

## Required next slices before real data

1. Establish a jurisdiction-aware, independently reviewed account/subject service
   separate from session lifetimes. Device revocation or logout must remove access,
   not erase a person's subject or valid rights. Keep credential/access relationships
   separate. Do not derive IDs from names, birthdays, fingerprints or their hashes.
2. Before persistence: define authorized intake operators, lawful purpose, local data
   residence, per-record access, retention/deletion and correction policy. Use the
   existing PostgreSQL restricted-login, transaction and RLS boundaries or a separately
   reviewed equivalent. No D1 substitution or unauthenticated public intake endpoint.
   Add idempotency/conflict handling and concurrency tests at that actual storage layer.
3. Shared-device access must explicitly switch identities and revoke sessions without
   exposing a previous person's drafts, recovery tickets or cached data. Offline
   assistance must use the helper's own narrowly scoped, expiring, revocable authority,
   rechecked when consumed. It is not a child signature, assent or guardian consent.
4. Claim and correction need separate case records, real verification, legal-caregiver
   authority where applicable, dispute handling and concurrent-claim exclusion.
   A receipt/reference or operator's assertion cannot approve a claim. Preserve review
   provenance and versioned corrections; never silently merge people or upgrade pending
   intake into a legal obligation, balance, vote, contribution or payment authority.
5. Assess regional legal, language, accessibility, bandwidth, disconnected and no-device
   conditions explicitly. A migration must preserve origin, uncertainty, expiry and
   correction history. Cross-region failover must not bypass access or residency policy.

The 2050 **51-billion-tonne vision (510 亿吨)** is a goal, not achieved or verified
impact and not an outcome guaranteed by trees alone. This module records no carbon
quantity. Any later impact model must separate observations, estimates and independently
verified results, with units, periods, methods, evidence versions and corrections.
