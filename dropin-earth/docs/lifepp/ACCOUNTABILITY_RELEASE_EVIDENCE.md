# Accountability evidence in the existing release path

`lifepp-release-run.mjs` validates accountability evidence inside its existing
`verifyCi` artifact check, during preparation and again after the approval wait.
This does not supply release approval or replace the independent review,
maintainer declaration, protected environment, exact SHA, rollback or other CI
requirements.

For the current candidate, the successful CanopyProof Trust Gate workspace
artifact must contain exactly one accountability JSON receipt and its TAP log.
The release checker binds them to authenticated GitHub workflow, run, attempt,
job, runner and exact main SHA metadata. The expected logical job is `trust-gate`
and the required phase is `merge_candidate`; a PR or local diagnostic receipt
cannot authorize a release. The downloaded archive digest, individual file
hashes, clean source fingerprint and pinned toolchain must agree.

The receipt must be at most 24 hours old when checked and its completion must
fall inside both the recorded workspace command and actual GitHub job interval.
An approval wait that exceeds this bound requires fresh eligible evidence.
The exact case names, test files, seed range and mutant inventory come from
`config/accountability-adversarial.json` in the verified candidate checkout.
The archived TAP must show the complete same inventory with zero failed,
skipped, cancelled or todo cases. Missing or ambiguous artifacts, neutral jobs,
self-declared runner identity, altered digests or stale inventories fail closed.

Historical evidence remains historical: existing reports and release audit
records are not rewritten or retrospectively claimed to satisfy this requirement.
The generic report parser remains available for inspection, but every new
candidate checked by this release path requires the current receipt. There is
no legacy exemption for deployment.

Local boundary tests use synthetic CI metadata and archive bytes. They verify
this artifact-validation function and its actual invocation from `verifyCi`;
they do not establish a real GitHub run, approval or deployment. Run them with:

```sh
node --test --test-reporter=tap --import tsx \
  tests/unit/lifepp-release-accountability.test.ts \
  tests/unit/accountability-adversarial-receipt.test.ts \
  tests/unit/lifepp-release-policy.test.ts
```
