# FiftyOne Integration Policy

Status: IMPLEMENTATION BASELINE - isolated code/tests only; deployment prohibited

Date: 2026-07-13

Owner: CanopyProof Security, Visual Review Operations, and Data Governance

Applies to: FiftyOne Open Source, custom FiftyOne plugins, operators, panels,
delegated operations, MongoDB metadata, manifests, and media delivery

## 1. Policy Statement

FiftyOne is an isolated internal visual-review workbench. It is not a
CanopyProof or TerraProof system of record and must never be represented as one.

The following records are authoritative only in CanopyProof or TerraProof:

- identity, organization, project, membership, accreditation, and role;
- spatial asset, acquisition, recipe, processing run, quality, uncertainty,
  and spatial provenance;
- evidence, verification, visual candidate, frozen review queue, review
  decision, field task/result, challenge, proof, certificate, governance,
  funding, ESG report, and audit event;
- license-policy decisions and disclosure classifications.

FiftyOne labels, tags, saved views, dataset persistence, brain runs, annotation
runs, plugin state, and MongoDB documents are disposable review projections.
They may be rebuilt from approved CanopyProof manifests and must not be read as
historical authority.

## 2. Basis For The Boundary

FiftyOne is useful for 2D/3D visualization, PCD point-cloud inspection,
embeddings, similarity search, model evaluation, annotation, panels, and custom
operators. Its official documentation also establishes the controls this
policy must add:

- [saved views store query rules and their membership can change](https://docs.voxel51.com/user_guide/using_views.html);
- [persistent datasets store labels/metadata while source media remains external](https://docs.voxel51.com/user_guide/using_datasets.html);
- [plugins and operators can be downloaded, enabled, and executed](https://docs.voxel51.com/plugins/using_plugins.html);
- [operators can be implemented in Python or JavaScript and can run immediately or through delegated execution](https://docs.voxel51.com/plugins/developing_plugins.html);
- [FiftyOne uses MongoDB and supports a self-managed database URI](https://docs.voxel51.com/user_guide/config.html);
- [Docker deployment persists database and dataset directories in a mounted volume](https://docs.voxel51.com/installation/environments.html).

These capabilities are not treated as a security sandbox. Any plugin or model
runner is privileged code within its container and trust zone.

## 3. Deployment Classification

The only permitted production-adjacent shape is:

```text
authorized reviewer
  -> institutional identity-aware proxy
  -> isolated FiftyOne application
  -> pinned CanopyProof review plugin
  -> narrow CanopyProof review API

CanopyProof manifest service
  -> short-lived signed manifest
  -> bounded media proxy or object grants
  -> FiftyOne disposable dataset
```

Requirements:

- private network or authenticated zero-trust ingress only;
- no direct public Internet exposure;
- no trust based solely on the FiftyOne session;
- no route shared with the public CanopyProof web Worker or API proxy;
- separate runtime identity, network policy, storage, database, and logs;
- non-root container, read-only root filesystem, bounded writable scratch;
- pinned image digest, dependency lock, SBOM, provenance/signature verification,
  vulnerability gate, and controlled rebuild cadence;
- CPU, memory, process, file-size, open-file, task-duration, and disk quotas;
- no host Docker socket, host filesystem, privileged mode, or broad cloud role;
- default-deny outbound network with only the review API, bounded media proxy,
  approved identity provider, DNS/time, and monitored package mirror available
  when explicitly required;
- test and production-adjacent instances use separate identities and data.

Open-source FiftyOne's default localhost binding is not an access-control
system. Network isolation and the identity-aware proxy are mandatory.

## 4. Supply-Chain Policy

Only CanopyProof-maintained plugin source from an approved repository and exact
commit may enter an institutional image. Runtime plugin download is disabled.

Prohibited:

- `fiftyone plugins download` against arbitrary URLs or branches;
- installing plugin requirements at runtime;
- unpinned `pip`, `npm`, model-zoo, dataset-zoo, or GitHub fetches;
- user-supplied Python modules, JavaScript bundles, notebooks, expressions,
  shell commands, model IDs, file paths, URLs, or container images;
- delegated execution of an operator outside the explicit allowlist;
- mounting a developer plugin directory into an institutional instance;
- automatic plugin updates.

Required release evidence:

- source commit and clean-build provenance;
- container digest and signature verification result;
- Python and JavaScript lockfiles;
- SBOM and vulnerability report;
- plugin manifest hash and operator allowlist hash;
- static analysis, unit tests, integration tests, and manifest-security tests;
- reviewer and security approval records.

## 5. Plugin Execution Policy

The sole institutional plugin is `canopyproof-review`. It is a thin client. It
must not contain proof, certification, funding, ESG, or license-decision logic.

### 5.1 Allowed Actions

| Action | Effect |
| --- | --- |
| Load assigned queue | Reads one immutable `ReviewQueueSnapshot` through a short-lived manifest. |
| Inspect candidate provenance | Reads bounded source/model/run/uncertainty summaries. |
| Append review decision | Sends a typed command to CanopyProof; server reauthorizes and audits it. |
| Request second review | Appends a request; cannot select or impersonate the second reviewer. |
| Create field-verification task | Sends a bounded request; CanopyProof evaluates location and assignment policy. |
| Open challenge draft | Creates a non-final draft in CanopyProof. |
| Register hard negative | Appends a typed negative candidate record subject to license policy. |

### 5.2 Prohibited Actions

The plugin may not:

- verify evidence or Environmental Proof;
- issue, revoke, or modify a certificate;
- publish or modify an ESG metric or report;
- release, allocate, or promise funding;
- enable mainnet activity or automatic CANOPY distribution;
- claim certified carbon credits, tax offsets, or guaranteed yield;
- modify, delete, overwrite, relabel, or replace raw evidence or spatial assets;
- mutate a `ReviewQueueSnapshot`;
- create or alter identity, role, membership, accreditation, tenant, project,
  license, classification, retention, or governance policy;
- read a database or object-store credential;
- enumerate a bucket, tenant, project, reviewer, or restricted location;
- submit arbitrary URLs, paths, queries, scripts, filters, or model names;
- execute generic delegation or arbitrary function-call operators;
- export media or labels except through a separately authorized CanopyProof
  export command.

The server enforces these restrictions regardless of the UI. Hiding a button
is not authorization.

## 6. Operator Allowlist

The image starts with all non-built-in plugins disabled. Built-in operators are
reviewed and disabled unless needed for display-only behavior. The effective
allowlist is stored as a versioned policy and tested at startup.

Each allowed operator declares:

- canonical URI and plugin hash;
- immediate/delegated execution setting;
- required CanopyProof capability;
- input and output schema;
- file, network, database, and secret access expectation;
- maximum duration and resource envelope;
- audit action name;
- risk classification and owning team.

Generic export, import, plugin-management, package-installation, model-zoo,
dataset-zoo, arbitrary delegation, notebook, shell, and filesystem operators
are denied in institutional instances.

## 7. Secret Policy

FiftyOne and its plugin receive no:

- PostgreSQL, pgSTAC, or Trust Kernel database credential;
- R2/S3 account key, access key, secret, bucket token, or broad signed prefix;
- KMS/HSM signing credential or private key;
- CanopyProof administrator token;
- GitHub, package registry, model hub, or annotation-provider token;
- cross-tenant service credential;
- long-lived bearer token.

The identity-aware proxy supplies a short-lived reviewer session. The plugin
exchanges it for a purpose- and audience-bound review capability. Capability
claims include subject, tenant, organization, project, queue snapshot, allowed
actions, nonce, issued-at, not-before, expiry, and key ID. The plugin cannot
choose these claims.

Sensitive values are never serialized into a FiftyOne sample, dataset info,
saved view, panel state, MongoDB document, browser storage, URL, error, log, or
metric.

## 8. Dataset Manifest Contract

CanopyProof creates one manifest for one reviewer assignment and one immutable
queue snapshot. The manifest is canonical JSON and contains:

```json
{
  "schemaVersion": "canopyproof.visual-review-manifest.v1",
  "manifestId": "opaque",
  "reviewQueueSnapshotId": "opaque",
  "reviewQueueHash": "sha256",
  "datasetSnapshotId": "opaque",
  "datasetManifestHash": "sha256",
  "tenantScope": "opaque commitment",
  "projectScope": "opaque commitment",
  "subjectId": "verified reviewer id",
  "audience": "canopyproof-fiftyone-review",
  "purpose": "human-visual-review",
  "sampleIds": ["ordered opaque ids"],
  "candidateIds": ["ordered opaque ids"],
  "modelRunIds": ["opaque ids"],
  "allowedActions": ["typed action names"],
  "classificationCeiling": "INTERNAL",
  "locationPolicy": "generalized-or-withheld",
  "licenseDecisionId": "opaque",
  "issuedAt": "RFC3339",
  "notBefore": "RFC3339",
  "expiresAt": "RFC3339",
  "nonce": "single-use value",
  "keyId": "managed signing key id",
  "signature": "detached or envelope signature"
}
```

The manifest must not contain:

- arbitrary or user-supplied URL;
- a storage endpoint, bucket, prefix, or credential;
- precise restricted coordinates;
- personal contact details;
- database identifiers usable outside the scoped API;
- raw audit payloads;
- private evidence or assets outside queue membership.

The verifier rejects unknown fields where canonical-signature semantics require
it, unsupported schema versions, invalid signatures, wrong audience/purpose,
expired/not-yet-valid manifests, reused nonce, subject mismatch, queue hash
mismatch, revoked assignment, changed license decision, or changed
classification.

Media access uses one of two patterns:

1. a bounded authenticated media proxy resolving only manifest sample IDs; or
2. per-object, read-only, content-disposition-constrained grants whose expiry is
   no later than the manifest and which do not permit prefix listing.

Manifest generation and each media access are audited in CanopyProof. The
ephemeral URL itself is never persisted.

## 9. Queue And Dataset Construction

The adapter builds a disposable FiftyOne dataset from the frozen manifest.
Each sample contains only display-safe projections:

- opaque CanopyProof sample and candidate IDs;
- bounded media reference;
- sensor/modality and non-sensitive acquisition summaries;
- model/run references and advisory scores;
- uncertainty and known-limitation summaries;
- generalized geometry or withheld location;
- read-only provenance summaries;
- local workbench labels clearly marked `NON_AUTHORITATIVE`.

The adapter verifies the queue and dataset hashes before loading. It does not
recompute membership from a saved view. FiftyOne saved views may improve the
review experience, but every submitted decision is checked against the original
immutable queue membership.

Dataset persistence is optional and short-lived. Persistence must not outlive
the queue assignment, license, retention policy, or incident hold. Rebuilding
the dataset from the manifest must produce the same ordered member identities.

## 10. MongoDB Policy

The FiftyOne MongoDB instance is dedicated and disposable. It does not share a
database, credential, network role, backup, or administrative user with
CanopyProof or TerraProof.

Controls:

- authentication and transport encryption where supported by the selected
  deployment;
- a dedicated database and least-privilege user;
- no public network exposure;
- encrypted volume and controlled backup policy;
- database migrations performed only by an approved image/role;
- retention matched to review assignment and legal-hold policy;
- no precise restricted locations, secrets, or authoritative audit records;
- restore tests prove workbench recovery, not authoritative recovery;
- deletion is permitted after authority import, retention, and legal-hold
  checks because CanopyProof remains the source of truth.

MongoDB loss must not lose a CanopyProof review decision. If it would, the
integration is non-compliant.

## 11. Review Decision Import

A plugin submission is an untrusted command request. CanopyProof must:

1. authenticate the current human subject independently of workbench labels;
2. verify manifest, assignment, queue snapshot, candidate membership, and
   nonce/correlation;
3. derive tenant, organization, project, and reviewer capability server-side;
4. re-evaluate license, classification, field-check, domain, and separation
   policy;
5. validate the typed decision and rationale;
6. reject any hidden or additional fields;
7. append an audit event, decision fact, provenance edge, and idempotency
   receipt atomically;
8. return the authoritative decision ID/root;
9. optionally project a display marker back to FiftyOne.

Failure after step 7 must be recoverable by exact idempotent replay. A local
FiftyOne label without an authoritative response ID is visibly `PENDING_IMPORT`
and has no effect outside the workbench.

## 12. Annotation Policy

FiftyOne can create/edit labels and can integrate with external annotation
services. Institutional CanopyProof use follows these rules:

- annotation is a candidate-generation or model-development activity;
- annotation providers require a separate data-processing, residency, privacy,
  and license review;
- no external annotation upload is allowed by default;
- provider API keys never enter the institutional FiftyOne container absent a
  separate approval;
- source-media upload to a provider is an export and requires an explicit
  CanopyProof export decision;
- imported annotation remains non-authoritative until human review and
  CanopyProof audit import;
- label IDs from an external tool do not become provenance authority;
- destructive label merges in a workbench cannot modify source assets or
  CanopyProof historical records.

## 13. Embedding And Similarity Policy

Embeddings and indexes are derived assets. Their definitions record model and
artifact hashes, preprocessing, dimensions, normalization, distance metric,
index implementation/version, dataset snapshot, member hash, license decision,
and run provenance.

Controls:

- no external embedding API absent explicit export and privacy approval;
- no embeddings from unclear-license data for training or public release;
- embeddings are classified at least as highly as their source;
- nearest-neighbor results are advisory and cannot establish identity,
  duplication, evidence truth, or proof;
- index rebuilds create new run/index records;
- membership drift invalidates the index for historical queue reconstruction;
- embedding inversion, membership inference, and cross-tenant similarity are
  treated as disclosure risks;
- no cross-tenant index unless a governed agreement and derived-output policy
  explicitly authorize it.

## 14. Network And Filesystem Policy

Outbound network is denied except for exact approved destinations and methods.
The review plugin may call only the CanopyProof review API routes associated
with its manifest. Redirects, alternate ports, IP literals, link-local,
loopback, private-network pivots, metadata services, and DNS rebinding targets
are rejected.

The container can read only:

- its immutable application/plugin image;
- the mounted disposable FiftyOne data volume;
- bounded media mounted or streamed for the current assignment.

It cannot read host paths, SSH agents, user home directories, CI credentials,
cloud metadata, Docker sockets, source repositories, or other tenant volumes.
All export paths are denied unless a separate bounded export job owns them.

## 15. Logging And Observability

Permitted telemetry:

- manifest issuance/verification counts;
- queue load success/failure;
- action type, authoritative result status, latency, and bounded error code;
- plugin/image/config hashes;
- resource and delegated-task health;
- denied secret, route, file, network, tenant, license, and action attempts.

Logs and metrics exclude media, exact coordinates, filenames, signed URLs,
tokens, model inputs, raw annotations, personal data, and arbitrary exception
objects. Restricted correlation uses opaque audit IDs with controlled access.

Alerts include:

- non-allowlisted operator discovery or execution;
- plugin/config hash drift;
- runtime package or model download attempt;
- unexpected egress or filesystem access;
- manifest replay or subject mismatch;
- cross-tenant/cross-project denial;
- action outside manifest capability;
- license or classification change with an active manifest;
- MongoDB or disposable-volume retention breach;
- a workbench label presented as proof or ESG state.

## 16. Incident And Revocation

On suspected compromise:

1. disable ingress and all plugin operators;
2. revoke manifest-signing key versions/capabilities and active assignments;
3. terminate delegated operations and isolate containers/volumes;
4. preserve forensic images and bounded logs under legal-hold policy;
5. identify authoritative imported decisions by manifest, image, plugin, and
   audit roots;
6. challenge or supersede affected decisions through append-only CanopyProof
   workflows;
7. rebuild from a known-good signed image and fresh disposable MongoDB;
8. reissue only reviewed queue snapshots;
9. document residual impact and governance decision.

No incident procedure edits or deletes authoritative facts.

## 17. Required Tests

### Manifest

- valid assigned manifest loads exact ordered membership;
- signature, audience, purpose, subject, tenant, project, queue hash, expiry,
  nonce, and license failures are rejected;
- membership change changes `reviewQueueHash` and creates a new queue version;
- dynamic saved-view drift cannot change authoritative queue membership;
- a manifest cannot reveal cross-tenant assets or precise restricted location;
- arbitrary URL, prefix grant, unknown action, and extra-field injection fail.

### Plugin

- plugin cannot read environment secrets or cloud metadata;
- plugin cannot access non-allowlisted network destinations or filesystem paths;
- plugin cannot install packages, models, datasets, or plugins at runtime;
- generic delegation and export operators are disabled;
- plugin cannot publish ESG claims, verify evidence, issue proof/certificate,
  release funding, modify raw evidence, or change governance;
- an unauthorized or stale reviewer is rejected server-side;
- exact replay is idempotent and conflicting replay is rejected.

### Authority

- local label without authoritative decision ID has no domain effect;
- deleting MongoDB does not remove authoritative decisions;
- rebuilding from the same manifest yields the same sample/candidate IDs;
- candidate, review, field result, and finding remain separate authority states;
- AI and plugin actors cannot satisfy human or governance gates.

### Operations

- image digest/SBOM/signature checks fail closed;
- startup fails when allowlist or configuration hash drifts;
- egress, CPU, memory, disk, process, and duration limits are enforced;
- revocation prevents new reads/actions and invalidates active manifests;
- backup/restore and disposal respect classification and retention.

## 18. Review Record

Adapter and plugin code may be developed and tested only with synthetic or
explicitly approved lab fixtures under the parent RFC. No live FiftyOne
service, institutional data, externally reachable manifest endpoint, or
production integration may be deployed until the parent RFC's deployment gate
opens.
