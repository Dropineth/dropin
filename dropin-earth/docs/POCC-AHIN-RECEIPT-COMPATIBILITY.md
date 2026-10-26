# Local PoCC/AHIN receipt compatibility

The public receipt is a local evidence projection. Its historical `accepted`
field recorded whether that version's local weight checks passed. It never
established a signed protocol verdict, membership, legal authority, financial
permission, ledger mutation, or a deployment exemption.

The pre-change public definition at commit
`77712ef54ea8331d188c2fad33e486124bb9b785` did not contain `verificationScope` or
`finalAuthority`. The current definition requires both own properties with exact
values `"local-evidence-projection"` and `false`.

## Explicit policy: reject and recompute separately

Current schema parsing and local validation reject old receipts without these
markers, partial markers, inherited markers, and an attempted `finalAuthority:
true`. There are no inferred defaults, fallback to the historical validator,
automatic upgrades, or bulk database migration. A stored historical record must
remain unchanged, including its original bytes, hashes, timestamps and `accepted`
audit value. Its rejection as a current receipt does not erase or rewrite that
historical application result. If displayed as historical audit material, it
must be identified as unverified historical local evidence and not used as a
current authorization input. No archival reader API is introduced here.

A caller that needs a new local projection must explicitly supply the relevant
current inputs to `buildPoccAhinConsensusReceipt`, retain the historical record
separately, and use the newly computed result. This recomputes today's source,
signer, digest and weight checks. Merely appending markers is not a migration:
an old accepted duplicate-source quorum fails current validation and recomputes
to an unaccepted local projection. No migration or persisted linkage between old
and new records is implemented by this change.

Schema parsing validates shape; `validatePoccAhinConsensusReceipt` checks local
self-consistency. Neither authenticates issuance or proves freshness. An otherwise
identical valid record with manually added markers is not distinguishable from
an identical recomputed local projection, and still confers no final authority.
Any real admission must independently satisfy its existing authenticated current
registry, signatures, revocation, policy and human gates.

## Observed callers and verification

At this change, repository source searches locate the builder/validator and
schema definitions, public unit tests, and an internal schema-presence check.
No production route or persistence migration consuming this receipt was found.
This is a bounded repository inventory, not proof about external consumers and
not a claim of a production outage, successful migration, or rollout acceptance.
Existing agent audit events and application audit semantics are unchanged.

`tests/fixtures/pocc-ahin-legacy-receipts.json` contains actual output generated
by the unchanged public historical builder (Git blob
`aed4419e42692e151e6e922cb08605b489c07674`). Its first input comes from the
historical public `pocc-ahin-anchor.test.ts` (blob
`8bffa05760098ff6a647fc67412f6e0cc77cb469`); the second repeats that input's oracle
source to exercise historical acceptance. Both originally validated and were
accepted. The fixture records source digest and generation provenance. It does
not import any private convergence implementation or create legacy data by
removing markers from today's builder output.

Four focused tests verify unchanged historical rejection, absent/partial/inherited
marker rejection, rejection of a marker-only duplicate-quorum upgrade, and fresh
non-authoritative recomputation. Existing current receipt tests remain in place.

## Offline fixture reproduction

The frozen fixture is used by CI without executing historical code. For an
explicit offline audit, run the following from the repository root using the
project's supported Node 22 toolchain. It requires the pinned public commit to
already exist locally; it performs no fetch or installation. It checks the exact
historical source digest before executing that source and compares both stored
outputs using the fixture's recorded inputs. It does not rewrite the fixture.

```sh
receipt_tmp=$(mktemp -d)
trap 'rm -rf "$receipt_tmp"' EXIT
GIT_NO_LAZY_FETCH=1 git show \
  77712ef54ea8331d188c2fad33e486124bb9b785:dropin-earth/packages/crypto/src/index.ts \
  > "$receipt_tmp/historical-crypto.ts"
HISTORICAL_RECEIPT_MODULE="$receipt_tmp/historical-crypto.ts" \
node --experimental-strip-types --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const fixture = JSON.parse(readFileSync(
  'dropin-earth/tests/fixtures/pocc-ahin-legacy-receipts.json', 'utf8'));
const source = process.env.HISTORICAL_RECEIPT_MODULE;
assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'),
  fixture.provenance.builderSha256);
const historical = await import(pathToFileURL(source).href);
for (const entry of fixture.cases) {
  assert.deepEqual(historical.buildPoccAhinConsensusReceipt(entry.input), entry.receipt);
  assert.equal(historical.validatePoccAhinConsensusReceipt(entry.receipt), true);
}
console.log('Both public historical receipt outputs reproduced.');
JS
```
