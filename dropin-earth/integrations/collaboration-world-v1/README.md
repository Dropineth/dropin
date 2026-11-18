# Ten-scale collaboration world projection

An original, dependency-free application read model for the ten functional
organization levels: single cell, organization, organ, functional system,
organism, population, ecosystem, planet, galaxy and universe. It is reusable by
CanopyProof and other Life++ application integrations; it is not a child-account
service, official AHIN wire format, protocol ledger, wallet or function verifier.

See [the full production scope](../../docs/lifepp/TEN-SCALE-PRODUCTION-SCOPE.md)
for the surrounding protocol, world UI, operating and application requirements.

## Run and inspect

From `dropin-earth`:

```sh
npm run test:collaboration-world
```

There is no dependency installation, network access or secret required for the
focused contract tests. The repository's ordinary test and coverage commands
also include this suite; the dedicated workflow performs no deployment.

```js
import { projectWorld } from './integrations/collaboration-world-v1/src/world.mjs';
import { createWorldFixture } from './integrations/collaboration-world-v1/src/fixtures.mjs';

const snapshot = await createWorldFixture();
const view = await projectWorld(snapshot);

console.table(view.nodes.map(node => ({
  scale: node.scale,
  id: node.id,
  caiMembers: node.memberCount,
  unresolved: node.unresolvedIssues.length,
  formation: node.formationStatus,
})));
```

The fixture has three distinct synthetic CAIs participating in two systems,
fifteen functional nodes covering all ten levels, separate physical tree/device/
plot objects, and a display asset. A critical observation challenge remains
visible through the conceptual universe. None of these is a real participant,
capture, independent signer, authenticated history or environmental outcome.

## Input contract

`projectWorld(input)` asynchronously validates and projects an explicit bounded
snapshot. It throws `WorldValidationError` on invalid, inconsistent or excessive
input. It does not truncate away members or disputes.

The required root fields are `profile`, `snapshotId`, `domain`, `sourceMode`,
`asOf`, `history`, `nodes`, `physicalEntities`, `displayAssets` and `relations`.
All objects have closed field sets; see `world.mjs` and the fixture for the exact
shape. References contain an opaque ID, version and digest. No raw image, URL,
coordinate, credential, payment instruction, membership grant, approval or user
data payload is accepted as an extra field.

- A single-cell node has one `caiId` and no members. Each CAI has one canonical
  node; multiple organization relationships point to that node.
- A composite has no new CAI identity. Membership must descend in functional
  scale and refer to known nodes. Cross-system membership is allowed.
- Infrastructure Cell/Field/Region/Planet is a separate reference. Neither
  infrastructure location nor functional membership grants permission.
- Physical entities and display assets have distinct IDs and collections.
  Capture time, display LOD and primitive count cannot change membership roots.
- Non-containment relations include dependency, competition, shared resource and
  conflict. They may be cyclic; they never become a hidden containment path.
- Formation references include the exact membership root, versioned function,
  source history, assessment, resources, responsibility, recovery and exit rules.
  They are pointers to claims awaiting independent assessment, not certificates.

## Computed output and authority boundary

Member commitments include the domain, aggregate node, distinct CAI bindings and
actual containment edges. Reordering the same input sets does not change them;
changing a member, identity mapping or containment path does. Formation references
bound to a previous membership are rejected. These hashes use this application's
own domain-separated representation; they are not AHIN canonical signing bytes.

Unresolved issues include their original node/relation references and severity.
They are deduplicated without being removed from any affected ancestor. Resolved
source issues remain in their source records. The read model cannot independently
declare a real challenge resolved, authenticate a claim, or assess source truth.
An explicit relationship issue affects its endpoints and their ancestors;
dependency edges alone do not infer unobserved downstream failures.

Counts are actual counts of the provided snapshot. They are not network-wide
population, online concurrency, world coverage or available resource capacity.
No capacity or budget is summed across shared CAIs. All opaque references and
membership commitments must still be treated as potentially sensitive.

Every output has these immutable values:

```text
derivedViewOnly: true
protocolTruth: false
executionAuthority: false
productionReady: false
authenticated: false
authenticationStatus: not_performed
authorityAdapterStatus: not_implemented
currentness: not_assessed
globalCoverage: null
```

Per-node `permissionsInherited` is false. Formation status is only `none` or
`referenced_unverified`. Galaxy and universe are conceptual in this version.
`sourceMode: source_referenced` merely distinguishes pointers from fixtures;
it cannot upgrade a record to LIVE or verified. Authenticated/LIVE input modes
and extra fields such as `verified`, `permissions`, `memberCount` or `memberRoot`
on a node are rejected. There is no fallback from a failed live admission into
a successful fixture admission because this module has no live admission path.

The snapshot's `asOf` is a source-declared observation boundary, not a trusted
current clock or freshness proof. History references are not elapsed time.

## Future integration boundary

An authenticated server must resolve current actor/object permissions and obtain
an approved, versioned AHIN source-admission result before it serves a live view.
It must bind the admitted data to the exact read-model input, recheck current
revocation/history/restore state, and protect every referenced object/asset fetch.
No caller-supplied boolean or browser-submitted snapshot can provide this trust.

The existing private upstream implementation is not copied here. A future
adapter must use separately accepted exported contracts and conformance vectors.
This module cannot replace the independent external anchor, institutional
enrollment, protocol proof verification or the account execution boundary.

There is no mounted HTTP route, database migration, durable registry, world
renderer, production source adapter or real enrollment in this increment. The
private children's portal and the main CanopyProof site are unchanged. A real
3DGS/point-cloud dataset, coordinate/measurement QA and safe asset gateway remain
separate integrations. No UNICEF/UN/BE participation is represented as agreed.

## Resource and privacy limits

`LIMITS` is exported from `world.mjs`. Input depth, values, bytes, reference/issue
counts, memberships, nodes and output expansion are bounded. Large or dense DAGs
fail explicitly. This is a bounded per-domain projection, not a benchmark of
billions of simultaneously materialized agents. A future host must enforce a
request-body limit before JSON parsing, as well as object-level authorization,
timeouts and safe output rendering. Labels must be rendered as text, never HTML.

The function makes no network request and returns a deeply frozen data object.
It does not anonymize data: names or sensitive opaque identifiers must be removed
by an authorized upstream projection. Hashing identity records does not make
them suitable for a public immutable ledger.

`production-profile.json` records the wider requirements per application profile.
It is not evidence that a gate passed and cannot enable a route or release.
