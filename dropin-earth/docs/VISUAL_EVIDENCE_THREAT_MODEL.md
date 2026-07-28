# CanopyProof Visual Evidence Threat Model

Status: IMPLEMENTATION BASELINE - security tests permitted; deployment prohibited

Date: 2026-07-13

Owners: CanopyProof Security, Trust Kernel, Visual Review, and Earth Science

Related policy: `docs/FIFTYONE_INTEGRATION_POLICY.md`

## 1. Security Objectives

The Visual Evidence Intelligence layer must preserve:

- tenant, organization, project, and reviewer isolation;
- immutable raw assets, snapshots, decisions, and provenance;
- separation between model candidate, human review, visual finding, evidence,
  proof, governance, and public claim;
- exact sensor, spatial, temporal, model, and processing applicability;
- license, classification, retention, residency, consent, and location policy;
- append-only negative controls, challenges, corrections, and withdrawals;
- short-lived, least-privilege workbench access;
- availability under malformed media, model, plugin, and queue inputs;
- privacy of people, communities, sensitive ecosystems, and precise locations.

The system fails closed when identity, authority, tenant, source hash, license,
CRS/frame, registration, sensor domain, provenance, uncertainty, human review,
or audit evidence is absent or ambiguous.

## 2. Protected Assets

- raw image, video, thermal, orthophoto, LAZ, and COPC objects;
- checksums, provider versions, object-lock and custody facts;
- sensor identities, calibration records, mission plans, and precise locations;
- dataset snapshots, pairing edges, queue membership, and queue hashes;
- models, rules, weights, preprocessing, containers, SBOMs, and signatures;
- embeddings, indexes, candidates, scores, and uncertainty;
- reviewer identity, assignment, decision, rationale, and accreditation;
- field tasks, device attestations, GPS claims, media, and results;
- hard negatives, known decoys, challenges, and correction history;
- license evidence, attribution, classification, and export decisions;
- audit events, command receipts, provenance roots, and governance records;
- API capabilities, manifest keys, ephemeral grants, and service identities.

## 3. Trust Boundaries

```text
External source/sensor
  | untrusted bytes and claims
  v
Quarantine and TerraProof authority
  | immutable approved asset references
  v
Visual authority API/database
  | bounded work items
  v
Isolated parser/model workers
  | untrusted derived results
  v
Visual authority import
  | frozen review manifest
  v
Identity-aware proxy -> FiftyOne/plugin/MongoDB
  | untrusted human command request
  v
Visual authority transaction
  | bounded VisualFinding
  v
Trust Kernel -> independent governance
```

Crossing a boundary never carries authority implicitly. Results are validated,
policy-evaluated, and appended through a new authoritative transaction.

## 4. Threat Actors

- unauthenticated Internet actors probing public and private endpoints;
- authenticated users attempting cross-project or cross-tenant access;
- contributors supplying copied, manipulated, mislabeled, or malicious media;
- reviewers acting outside assignment, colluding, or hiding false positives;
- compromised field devices or spoofed sensor/GPS/time attestations;
- malicious or compromised model, plugin, package, container, or dataset source;
- compromised FiftyOne, MongoDB, browser session, or identity-aware proxy;
- operators broadening license, classification, or domain policy;
- insiders attempting to erase negatives, challenges, or prior decisions;
- attackers exploiting native LAZ/PCD/image/video parsers;
- external providers changing bytes or rights at a stable URL;
- automated clients exhausting inference, similarity, tile, or manifest capacity.

## 5. Entry Points

- mission, sensor, dataset, asset, model, and snapshot registration APIs;
- object storage confirmation and processing callbacks;
- native parser and model worker inputs;
- review queue creation, filtering, sorting, and random sampling;
- FiftyOne manifest issuance, media delivery, plugin actions, and MongoDB;
- annotation, model hub, dataset hub, and package/plugin integrations;
- review decision, hard-negative, challenge, and field-check APIs;
- field device sync, GPS, media, and attestation receipts;
- export, training, disclosure, and institutional-reporting gates;
- logs, metrics, traces, backups, support bundles, and incident exports.

## 6. Threat And Control Register

| ID | Threat | Impact | Required controls |
| --- | --- | --- | --- |
| V01 | Cross-tenant asset, candidate, queue, or decision ID substitution | Confidentiality breach and false lineage | Scope from verified identity; RLS; mandatory tenant/project predicates; opaque IDs; negative authorization tests. |
| V02 | Workbench session treated as CanopyProof authentication | Reviewer impersonation | Identity-aware proxy plus server-side token verification; CanopyProof reauthorizes every action; no trust in labels/session fields. |
| V03 | Dynamic FiftyOne saved view used as historical queue | Review membership silently changes | Freeze ordered member IDs, selection expressions, model runs, seed, dataset hash, and queue hash in immutable `ReviewQueueSnapshot`. |
| V04 | Dataset changes under an active queue | Decisions bind to different source state | Snapshot source versions; reject hash drift; create a new queue version; preserve prior assignment. |
| V05 | Machine candidate promoted to verified evidence | False environmental conclusion | State machine permits model output only as `CandidateFinding`; separate human review, field, Trust Kernel, and governance commands. |
| V06 | Plugin or AI issues proof, certificate, ESG metric, or funding action | Institutional misrepresentation or financial harm | No such plugin capabilities/routes; actor-type and separation checks; API/schema allowlist; governance foreign keys and tests. |
| V07 | Reviewer approves own model/run or contributor approves own candidate | Conflict of interest | Actor separation, accreditation, assignment, conflict disclosure, second-review policy, database constraints. |
| V08 | Rejected candidate deleted or score history overwritten | Biased evaluation and audit loss | Append-only facts; no-update/no-delete triggers; hard-negative/decoy records; reconciliation and retention tests. |
| V09 | Known decoy reappears as positive after rerun | Regression and unsafe model calibration | Stable decoy identity; expected disposition; run evaluation gate; alert on positive ranking/review; human override requires governance rationale. |
| V10 | RGB model applied to thermal, wrong altitude/resolution, or wrong ecosystem | Invalid inference and false confidence | Machine-evaluable sensor-domain declaration; pre-run and import checks; narrow reviewed exceptions; domain-failure metrics. |
| V11 | Uncalibrated RGB values presented as reflectance | Scientifically invalid evidence | Sensor/calibration metadata; methodology gate; explicit measurement semantics; bounded claim language. |
| V12 | Local coordinate frame compared with absolute CRS without registration | False change/height/location result | Frame state; approved CRS registry; registration transform and residuals; comparison API fails closed before registration. |
| V13 | Malicious CRS, axis order, unit, scale, offset, or vertical datum | Spatial displacement and invalid metrics | Parse into typed CRS/frame contract; bounds/unit checks; pinned transforms; golden tests; reviewer-visible uncertainty. |
| V14 | PCD review copy substitutes for LAZ/COPC authority | Lost points, precision, attributes, and provenance | Format-role constraint; source roots; no authoritative import from PCD; database and API reject replacement. |
| V15 | Raw LAZ/COPC overwritten in place | Irreproducible evidence and hidden tampering | Content addressing, object versioning/write-once policy, conditional create, periodic hash inventory, new-version-only mutation. |
| V16 | Crafted LAZ/PCD/image/video exploits native parser | RCE, exfiltration, or corruption | Quarantine; minimal pinned non-root container; read-only root; no network; seccomp/runtime isolation; parser fuzzing and CVE response. |
| V17 | Point-cloud or decompression bomb | CPU, memory, disk, or cost denial | Streaming envelope inspection; byte/point/dimension/attribute/archive-depth quotas; bounded scratch/time; kill and quarantine. |
| V18 | Plugin downloaded from mutable branch or package installed at runtime | Supply-chain code execution | Exact source commit and image digest; signed build/SBOM; runtime downloads disabled; read-only plugin directory; startup hash check. |
| V19 | Generic Python/JS/delegated operator executes arbitrary code | Secret theft and policy bypass | Operator allowlist; generic delegation/export/import/install disabled; no arbitrary parameters; process/network/file quotas. |
| V20 | Plugin reads environment, filesystem, cloud metadata, or other tenant volume | Credential/data exfiltration | No secrets; dedicated identity; read-only filesystem; no host mounts; egress deny; metadata IP deny; canary tests. |
| V21 | Arbitrary URL or redirect reaches storage/internal service | SSRF and network pivot | Opaque registry IDs only; exact route/host/method allowlist; DNS/IP validation; deny redirects/IP literals/private/link-local/metadata ranges. |
| V22 | Manifest tampering or field injection | Unauthorized samples/actions | Canonical serialization, managed asymmetric signature, strict schema, reject unknown fields, queue/dataset hash verification. |
| V23 | Expired, replayed, wrong-subject, or wrong-audience manifest | Continued or transferred access | Short expiry; subject/audience/purpose/nonce binding; one assignment; revocation; replay cache; clock policy. |
| V24 | Manifest or object grant exposes bucket prefix or arbitrary key | Bulk data theft | Per-sample proxy or per-object grant; no list/prefix; read-only; size/content disposition; expiry no later than manifest. |
| V25 | Precise restricted location leaks through sample fields, EXIF, thumbnails, logs, or errors | Ecological/community harm | EXIF stripping in projection; generalized geometry; allowlisted schema/log fields; output scanning; classification-aware access. |
| V26 | Embedding index crosses tenants or leaks source membership | Re-identification, membership inference, or proprietary-data leak | Tenant-scoped indexes; source classification inheritance; no cross-tenant join absent agreement; bounded results; export denial. |
| V27 | Similarity result treated as duplicate/identity truth | False rejection or linkage | Advisory semantics; independent content/provenance checks; human review; no state transition from similarity alone. |
| V28 | Poisoned calibration/training data or model artifact | Systematic false findings | Immutable dataset/model versions; rights/provenance; decoys and holdout evaluation; signing/SBOM; approval; rollback/challenge. |
| V29 | Unclear-license imagery used for training/export/public display | Legal, ethical, and institutional breach | Machine-evaluable rights policy; explicit rights evidence; fail closed; provenance fan-out; denial metrics; revocation workflow. |
| V30 | Attribution removed from benchmark derivatives | CC BY breach | Attribution manifest; immutable license version; export/render tests; source citation bundled with every allowed derivative. |
| V31 | External source changes content at stable URL | Hidden input drift | Ingest immutable permitted copy; checksum/provider version/time receipt; URL not identity; append new asset/version. |
| V32 | Media pairing by filename instead of time/geometry/sensor lineage | Wrong RGB/thermal association | Explicit pairing edges, tolerance policy, calibration/frame checks, ambiguity state, human review. |
| V33 | Thermal artifact or shadow dominates candidate ranking | False positives and review overload | Sensor-specific preprocessing/models; decoy suite; score calibration; random QA; field checks; per-domain metrics. |
| V34 | Ranking excludes low-score true positives without sampling | Silent recall loss | Methodology-approved thresholds; uncertainty band; deterministic random QA sample; reviewer disagreement and field-confirmation monitoring. |
| V35 | Reviewer accepts modified geometry/label not in decision hash | Decision tampering | Typed schema; canonical geometry; source and decision hashes; audit root; server recomputation; immutable supersession. |
| V36 | Field result submitted by wrong device/reviewer or after expiry | Fabricated confirmation | Assignment and verified human binding; current device attestation; expiry/chronology/GPS checks; media custody; server-side authority. |
| V37 | Field GPS/media replayed across tasks | Duplicate or false confirmation | Content and metadata hashes; task nonce; device/time/source roots; duplicate detection; cross-project policy. |
| V38 | Field worker harmed by precise-location disclosure or unsafe assignment | Physical/privacy harm | Generalized task location until need-to-know; safety assessment; organization assignment; expiry; offline policy; incident path. |
| V39 | MongoDB label/state treated as authoritative or lost before import | Lost/forged review decision | Authoritative receipt required; pending-import state; idempotent import; disposable DB recovery test; no downstream reads from MongoDB. |
| V40 | FiftyOne database backup exceeds retention or crosses residency | Contract/privacy breach | Dedicated encrypted storage; scoped backup; lifecycle/legal hold; regional placement; restore/disposal tests. |
| V41 | License/classification changes while manifest is active | Continued unauthorized access | Short expiry; revocation index; policy version checks on every action/media request; terminate active assignment; purge cache. |
| V42 | Challenge or withdrawal not propagated to queues/findings/reports | Known-bad result remains relied upon | Provenance fan-out; state projection; queue invalidation; non-reliance notice; report-owner notification; reconciliation monitor. |
| V43 | Audit event omitted or written after domain mutation | Unaccountable state transition | Same serializable transaction; database trigger/foreign key; command receipt; missing-audit negative tests. |
| V44 | Idempotency key replay with altered body | Conflicting duplicate decision/task | Actor/operation/key lock and request hash; exact replay returns prior result; conflicting replay rejected. |
| V45 | Metrics/logs expose coordinates, sample IDs, prompts, or labels | Secondary disclosure | Bounded labels, opaque correlation, structured allowlist, redaction, restricted retention/access, leak tests. |
| V46 | Expensive similarity/model/preview requests exhaust capacity | Availability and cost failure | Pre-approved work items; quotas; concurrency/queue limits; cancellation; cached immutable products; per-tenant budgets. |
| V47 | Model or worker result callback is forged | Fake candidates or derived products | Service identity and audience; signed/provider receipt where available; work-item/input hash binding; output hash verification; replay protection. |
| V48 | Reviewer collusion or systematic bias | False acceptance/rejection | Random assignment, conflict disclosure, second review, disagreement metrics, decoy calibration, independent audit, challenge channel. |
| V49 | Decoy/hard-negative data used for training despite rights prohibition | License breach and contaminated model | Separate evaluation/training permission fields; license gate at dataset assembly; training manifest and provenance checks. |
| V50 | Operator broadens policy or suppresses negative results | Institutional fraud | Least privilege; dual approval for policy; immutable versions; no plugin policy APIs; alerts and public/internal audit. |
| V51 | Sensitive personal data appears incidentally in imagery | Privacy breach | Data minimization, detection/triage, classification, masking derivative, restricted raw access, consent/legal-basis review, deletion only through governed source policy. |
| V52 | Low-quality point cloud yields precise-looking CHM/volume | False scientific precision | Density/continuity/registration/occlusion QA; uncertainty budget; no zero-for-unknown; methodology fitness gate. |
| V53 | Cross-season change confounds phenology, moisture, sensor, or registration | Invalid temporal conclusion | Season/domain metadata; co-registration residuals; comparable acquisition policy; uncertainty decomposition; bounded finding. |
| V54 | External annotation service receives unapproved media | Unauthorized export | Integrations disabled by default; explicit export/license/privacy/residency decision; no provider token; audit and DLP. |
| V55 | Public UI or API describes a candidate/finding as certified carbon impact | Misleading regulated claim | Bounded vocabulary; schema/state separation; content tests; governance publication gate; no certified credit/tax/yield language. |

## 7. Service-Specific Controls

### 7.1 Visual Authority API

- production authentication uses the existing verified subject path;
- caller headers/body cannot establish tenant, organization, project, role, or
  provider verification;
- typed request schemas reject unknown fields;
- every mutation carries idempotency and expected source roots;
- authorization, license, classification, domain, separation, and lifecycle
  checks are server-side;
- PostgreSQL independently enforces append-only and hash/root constraints.

### 7.2 Parser And Model Workers

- isolated from public request handling and Trust Kernel credentials;
- input is immutable registry IDs and expected hashes, not URLs or paths;
- images are digest-pinned and run non-root with no network by default;
- bounded scratch is destroyed after outputs are committed/quarantined;
- outputs are untrusted until hash, schema, quality, domain, and provenance
  validation completes;
- workers cannot review or approve their own output.

### 7.3 FiftyOne And Plugin

- private identity-aware ingress and dedicated disposable MongoDB;
- exact internal plugin only; runtime installation and generic delegation off;
- no secrets or broad object access;
- immutable queue manifest and short-lived capabilities;
- all plugin mutations call the authoritative API;
- local labels remain explicitly non-authoritative.

### 7.4 Media Delivery

- registry IDs resolve server-side to allowlisted immutable objects;
- source hash/provider version checked before grant;
- grants are object-specific, read-only, short-lived, and non-listable;
- classification, location, license, and assignment checked on every access;
- caching keys bind tenant/project/classification/object version/manifest.

### 7.5 Field Verification

- assigned verified human plus current device-attestation policy;
- privacy-safe task geometry and explicit safety/expiry constraints;
- media enters evidence custody quarantine;
- result import verifies task, device, time, GPS, duplicate, and source roots;
- field confirmation cannot bypass Trust Kernel verification/governance.

## 8. Required Security Tests

### Authority And State

1. Machine candidate cannot become verified evidence or a certificate.
2. AI, worker, plugin, device, and contributor actors cannot satisfy human or
   governance approval.
3. Missing audit event causes transaction failure.
4. Exact idempotent replay returns the same root; changed replay is rejected.
5. Rejected candidate and known shadow decoy remain append-only and rejected.
6. Challenge, correction, supersession, and withdrawal preserve original facts.

### Tenant And Access

7. Cross-tenant/project dataset, asset, candidate, queue, decision, manifest,
   media, embedding, field task, and export access is denied.
8. Reviewer without current assignment/accreditation is denied.
9. Manifest subject/audience/purpose/nonce/expiry/hash mismatch is denied.
10. Precise restricted location is absent from workbench, logs, metrics, and
    generalized field tasks.

### Workbench And Plugin

11. Plugin cannot access secrets, host paths, metadata service, arbitrary
    network destinations, package installers, model hubs, or generic delegates.
12. Plugin cannot publish ESG claims, modify raw evidence, change policy,
    release funding, or issue proof/certificate.
13. Saved-view drift creates a new queue version and does not alter prior
    membership.
14. Queue hash changes for any membership, order, filter, sort, model, seed, or
    dataset-snapshot change.
15. Deleting/rebuilding FiftyOne and MongoDB does not lose authority.

### Spatial And Sensor

16. Local-frame/absolute-CRS comparison fails before reviewed registration.
17. Unsupported CRS, axis, units, vertical datum, scale, offset, and bounds fail.
18. RGB/thermal, altitude, resolution, season, ecosystem, and geography domain
    mismatch fail without an approved narrow exception.
19. Uncalibrated RGB cannot support reflectance evidence.
20. Raw LAZ mutation is rejected; PCD cannot replace LAZ/COPC.
21. Derived products retain complete input/run/recipe/quality/uncertainty
    lineage; missing or cyclic provenance blocks use.
22. Cross-season comparison records registration, acquisition, phenology, and
    sensor uncertainty.

### License And Privacy

23. Unclear-license imagery is blocked from training, institutional export,
    public display, and production evidence.
24. VineLiDAR use is limited to lab benchmark and includes CC BY attribution.
25. Rights revocation invalidates manifests and blocks downstream use.
26. Hard-negative training is independently rights-gated.
27. EXIF and exact location cannot escape through derivatives or errors.

### Resilience

28. Malformed media, decompression bombs, point explosions, and parser crashes
    remain quarantined within resource limits.
29. Forged worker/provider callback and output substitution fail.
30. Revoked image/plugin/config digest prevents startup.
31. License/classification/assignment revocation terminates active access.
32. Audit and provenance reconciliation detects missing projections or imports.

## 9. Detection And Response

Alert on:

- cross-tenant or unauthorized reviewer denials;
- manifest replay, signature, subject, queue-hash, and policy failures;
- operator/image/config drift or runtime download attempt;
- unexpected egress, filesystem, secret, or metadata access;
- native parser crash, quota kill, point explosion, or repeated malformed file;
- domain, CRS registration, license, and precise-location denials;
- known decoy accepted or negative record deletion attempt;
- reviewer disagreement/collusion anomaly and abnormal acceptance rate;
- field device/task/GPS replay or attestation failure;
- missing audit/provenance root or queue reconstruction mismatch;
- challenged/withdrawn source still present in a queue, finding, export, or
  report projection.

Incident response follows containment, capability revocation, immutable
evidence preservation, provenance fan-out analysis, challenge/correction,
known-good rebuild, and governance disclosure. It never deletes authoritative
history.

## 10. Residual Risks

- A valid license may not resolve every privacy, cultural, sovereignty, or
  community-consent obligation.
- Human reviewers and field workers can collude or make systematic mistakes.
- Model/domain documentation can be incomplete despite technical checks.
- Dense point clouds and embeddings can expose sensitive structure even when
  direct identifiers are absent.
- Registration and uncertainty models cannot eliminate acquisition bias,
  occlusion, seasonality, or missing coverage.
- External sources may change bytes, terms, or availability.
- Container isolation reduces but does not eliminate native-parser and
  supply-chain risk.
- No triage system can guarantee detection of an object or environmental event.

These risks require bounded claims, independent review, challenge rights,
continuous evaluation, and explicit non-reliance when uncertainty is not fit
for the requested institutional use.

## 11. Approval Gate

This threat model governs non-production contracts and security tests under
`docs/RFC_VISUAL_EVIDENCE_INTELLIGENCE.md`. No live institutional data,
Visual Evidence Intelligence service, or FiftyOne deployment is authorized by
this document.
