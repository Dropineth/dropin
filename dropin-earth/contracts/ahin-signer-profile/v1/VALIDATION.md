# Validation evidence

Environment: Node 22.23.4, native disposable PostgreSQL 17 container, Python
jsonschema 4.26.0. All identities, keys, roots and records are synthetic.

- Reproduced the old admission flaw: revoking a participating trustee with an
  alternative eligible trustee and unchanged checkpoint returned 200, expected 503.
- Additive migration commits the full registry digest; the same regression now
  rejects. Same-ID key replacement also rejects; unchanged registry still passes.
- A 50ms database delay past a 10ms signed-authority deadline rejects at the gate.
- Native lifecycle/guardian/restore/resume suites: 47 tests passed; affected
  backend suite rerun after subsequent changes and review correction: 8 passed.
- Focused backend/contract/provider/socket unit suites: 13 passed.
- Six exported JSON Schemas checked with Draft202012Validator; four positive and
  five negative fixtures validated, all local OpenAPI references resolved.
- OpenAPI export drift check and actual Ed25519 snapshot/checkpoint byte vectors
  pass. Eight validly signed but semantically invalid snapshots fail the client.
- Affected ESLint, strict TypeScript, backend bundle and whitespace checks pass.

Independent automated review found a negative-test masking issue introduced by
adding the alternative signer; the signature list was corrected to exactly the
aliased two-key registry and the backend suite rerun. The reviewer found no runtime
bypass in the registry gate and independently ran five focused tests and schema
validation. This is not independent human release approval or full repository CI.

No third-party full OpenAPI document validator was installed/run; validation here
covers generated schemas, internal references, export drift and actual code tests.
No production root, registry, IdP, endpoint, deployment or legal acceptance is
established. See README for deliberate compatibility restrictions and remaining
commit-time/distributed-authority gaps. Freeze is a reviewable product contract
candidate; it is not formal AHIN protocol approval.
