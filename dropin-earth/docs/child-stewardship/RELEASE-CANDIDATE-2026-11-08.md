# Child-account candidate reconciliation — 8 November 2026

Preserved candidate: 2fbaad5feef307a5e5ef33c732a8e2d4d9166bb0.
Remote main read using git ls-remote: c0ac95cac88eb4f11bc2bb60447d03695517266e.
No live child enrollment, commercial operation or deployed revision is established.

## Change and evidence

A native regression revoked the admitted trustee after an audit INSERT, while an
alternative eligible quorum remained. Before the fix the command returned 200.
PostgresChildStore.transact now reads fresh authority after tentative SQL writes,
before returning to backendSql's COMMIT wrapper. Invalid current authority aborts
and rolls back state and audit; the regression returns 503 with unchanged revision
and audit count. Transaction rollback also covers the other writes in that SQL
transaction; this regression does not individually exercise every one-use grant.

This is a bounded pre-commit improvement, not distributed atomic authorization.
Revocation after the final read and before COMMIT is still possible. Other methods
such as identity recovery need their own accepted authority design; the synthetic
provider cannot establish it. Real registration and recovery remain unavailable.

Node 22.23.4 / npm 10.9.4 validation:

- All native child stewardship and backend suites: 182 passed, zero failed.
- Independent automated native backend run: 8 passed; no actionable defect found.
- Complete unit glob: 1191 tests, 1174 passed, 17 failed. Nine affected files rerun
  on clean main with the same shared node_modules: 57 tests, 40 passed and the same
  17 failures. Ten involve unavailable Prisma functionality; seven are existing
  HTTP assertions. These are not presented as a passing repository suite.
- Full lint passed. Targeted strict TypeScript passed. Backend bundle built.
- Full workspace typecheck failed in pretypecheck Prisma generation: official
  schema-engine checksum URL returned 403. No verification bypass or further
  download retry was used. This prerequisite was invoked by the requested full
  workspace check; it did not produce a usable Prisma client.

Commands: `npm run lint`, `npm run typecheck`,
`node --test --test-concurrency=2 --import tsx tests/unit/*.test.ts`,
`node --import tsx --test --test-concurrency=1 tests/integration/child-stewardship-*.integration.ts tests/integration/child-backend.integration.ts`,
and `node --import tsx scripts/build-child-backend.mjs`.
Native tests used an isolated localhost PostgreSQL container and disposable data.

## Release/access limits

`gh pr list` GraphQL and `gh run list --commit c0ac95c...` REST requests both
returned Forbidden. Those reads were stopped, not rerouted through another API.
Previously denied Cloudflare Workers-domain and protected-environment reads were
not retried. Current CI and deployed commit therefore remain unverified here.

The checked-in production workflow is web-only and requires a reviewed merged PR,
exact-main CI, independent human approval, maintainer attestation and verified
rollback IDs. None of those missing attestations is supplied by automated review.
The backend still only accepts disabled or synthetic-demo configuration. No actual
approved guardian registry, production signing authority, authenticated IdP or
operational recovery/safeguarding evidence has been provided. No paid service,
credential or permission expansion is part of this candidate.
