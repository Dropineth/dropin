# CanopyProof Visual Data License Policy

Status: IMPLEMENTATION BASELINE - policy code/tests only; data-use gate closed

Date: 2026-07-13

Owners: CanopyProof Data Governance, Legal/Policy, Security, and Earth Science

Applies to: images, video, thermal data, point clouds, orthophotos, previews,
embeddings, annotations, candidates, model-training corpora, benchmarks,
derivatives, manifests, exports, and public displays

## 1. Purpose

CanopyProof must be able to prove not only where a visual result came from but
also why the organization was permitted to ingest, process, review, train on,
display, export, retain, and use it for a stated institutional purpose.

A technically accessible file is not necessarily licensed for institutional
reuse. A permissive code or annotation license does not automatically license
the underlying imagery. Public availability, a download button, a repository,
or a dataset-card statement is not a substitute for explicit rights evidence.

When rights are missing, ambiguous, contradictory, expired, or narrower than
the requested action, the action fails closed.

## 2. Scope And Non-Authority

This policy is a machine-enforceable governance baseline, not legal advice and
not a substitute for jurisdiction-specific legal, ethical, Indigenous data
sovereignty, community-consent, privacy, export-control, or contract review.

License approval does not:

- make data scientifically fit for purpose;
- establish consent or lawful handling of personal data;
- authorize disclosure of sensitive locations;
- make a model output evidence or proof;
- authorize certified carbon-credit, tax-offset, financial, or guaranteed-yield
  claims;
- waive tenant, classification, retention, residency, methodology, audit,
  human-review, or governance requirements.

The effective decision is the intersection of all applicable restrictions.

## 3. Policy Vocabulary

### 3.1 Rights Status

| Status | Meaning |
| --- | --- |
| `VERIFIED_EXPLICIT_RIGHTS` | Signed or otherwise verifiable rights evidence covers the exact asset, actor, action, territory, duration, and purpose. |
| `STANDARD_LICENSE_VERIFIED` | An identified standard license is attached to the exact work and its terms are recorded. |
| `RESTRICTED_CONTRACT` | Rights arise from a governed agreement with explicit constraints. |
| `EXPLICIT_RIGHTS_REQUIRED` | Current evidence is insufficient; no institutional use beyond bounded legal/security review. |
| `AMBIGUOUS_OR_CONFLICTING` | Terms or ownership conflict; fail closed. |
| `EXPIRED_OR_REVOKED` | Rights no longer permit new use. |
| `PROHIBITED` | Requested or all use is expressly denied. |

### 3.2 Use Class

| Use class | Meaning |
| --- | --- |
| `LAB_BENCHMARK` | Isolated evaluation/research fixture, never production project evidence. |
| `INTERNAL_REVIEW` | Authenticated bounded review under approved rights. |
| `MODEL_EVALUATION` | Evaluation only; no weight update or corpus release. |
| `MODEL_TRAINING` | Weight-affecting training/fine-tuning/distillation or retrieval corpus construction. |
| `PRODUCTION_EVIDENCE_INPUT` | Candidate source entering production evidence custody and verification. |
| `INSTITUTIONAL_EXPORT` | Transfer to a partner, auditor, fund, government, UN body, or external processor. |
| `PUBLIC_DISPLAY` | Any unauthenticated or broadly available visual exposure. |
| `PUBLIC_DATA_EXPORT` | Downloadable media, labels, embeddings, crops, point clouds, or derivatives. |

### 3.3 Mandatory Modifiers

- `ATTRIBUTION_REQUIRED`;
- `SHARE_ALIKE_REQUIRED`;
- `NONCOMMERCIAL_ONLY`;
- `NO_DERIVATIVES`;
- `NO_MODEL_TRAINING`;
- `NO_INSTITUTIONAL_REDISTRIBUTION_BY_DEFAULT`;
- `NO_PUBLIC_DISPLAY`;
- `NO_PRECISE_LOCATION_DISCLOSURE`;
- `NO_PRODUCTION_EVIDENCE`;
- `CONSENT_REVIEW_REQUIRED`;
- `JURISDICTION_REVIEW_REQUIRED`;
- `DATA_RESIDENCY_REQUIRED`.

## 4. LicensePolicy Record

Each evaluated source or dataset snapshot references an immutable policy version
with:

```text
licensePolicyId
policyVersion
tenantId
organizationId
projectId or approvedSharedDatasetScope
sourceProvider
sourceDataset
sourceAssetRoots
rightsStatus
licenseIdentifier and canonical terms URL
licensor and rights-holder evidence
rightsEvidenceRoots
permittedUseClasses
prohibitedUseClasses
modifiers
attributionRequirements
derivativeRequirements
modelTrainingTerms
redistributionTerms
publicDisplayTerms
territories
jurisdictions
effectiveAt
expiresAt or reviewAt
revocationSource
privacyConsentCommunityRestrictions
classificationFloor
retentionPolicy
decisionActor
independentReviewer
auditEventId and root
```

Free-form notes cannot broaden machine-evaluable permissions. An action is
allowed only when an explicit permitted use matches and no modifier or other
policy denies it.

## 5. Rights Evidence

Acceptable evidence may include:

- an exact standard license attached by the rights holder to the exact work;
- a signed data license, data-sharing agreement, or contributor agreement;
- a provider API/contract version and immutable receipt binding dataset/version;
- a government/open-data license with exact catalog identifier and version;
- a consent/legal-basis record where people or communities are implicated;
- a legal-review decision binding source roots, purpose, jurisdiction, and
  expiry.

Insufficient by itself:

- a public URL or repository;
- a download count or public bucket;
- a code license when the media has separate or unspecified terms;
- a dataset card saying "courtesy of" or "use in good spirit";
- uploader possession without rights-holder evidence;
- a model's ability to access or embed the data;
- an annotation license when underlying imagery rights are unclear;
- copied EXIF or metadata ownership fields;
- absence of a copyright notice.

Rights evidence is content-addressed, classified, retained, and audited. Raw
contracts or personal information are not exposed to FiftyOne or public
manifests; only the bounded policy decision and attribution are projected.

## 6. Decision Points

License policy is evaluated at every material operation, not only ingest:

1. source discovery and registration;
2. byte ingest or external-reference registration;
3. dataset snapshot creation;
4. preprocessing or derivative creation;
5. embedding, similarity, detection, or model evaluation;
6. training/fine-tuning/distillation;
7. review queue and FiftyOne manifest issuance;
8. external annotation or processor transfer;
9. field-task disclosure;
10. institutional export;
11. public display or public-data export;
12. production evidence registration;
13. ESG/report/proof dependency evaluation;
14. retention, archival, backup, legal hold, and disposal;
15. license correction, expiry, or revocation.

Each allow/deny result records policy version, action, purpose, actor, source
roots, time, rationale code, and audit event. A cached decision cannot outlive
the policy review time, license expiry, manifest, or source version.

## 7. Derivative And Provenance Inheritance

A derivative inherits the most restrictive applicable source terms unless an
approved legal decision records a different result. This applies to:

- crops, tiles, thumbnails, and previews;
- labels, masks, detections, annotations, and hard negatives;
- PCD, COPC, DTM, DSM, CHM, PMTiles, and 3D Tiles;
- embeddings, feature vectors, similarity indexes, and clusters;
- model weights, adapters, checkpoints, distilled models, and synthetic data;
- reports, screenshots, exports, and manifest projections.

Transformation does not erase rights. Hashing, downsampling, redaction,
aggregation, or embedding is not assumed to make a derivative unrestricted.

When multiple sources contribute, the decision evaluates all sources and
records provenance fan-in. One prohibited or ambiguous source blocks the
requested action unless it is removed through a new reproducible derivative
whose lineage proves exclusion.

## 8. Dataset Snapshot Contract

Each immutable `DatasetSnapshot` freezes:

- exact asset IDs, versions, and hashes;
- source/dataset/provider identifiers;
- license-policy IDs and versions for every member;
- requested purpose and allowed use classes;
- attribution bundle;
- classification and location policy;
- effective/expiry/review times;
- rights-evidence roots;
- aggregate license decision and hash.

Adding, removing, replacing, or relicensing any member creates a new snapshot.
FiftyOne saved views cannot serve as a license snapshot.

## 9. Training And Model Policy

`MODEL_TRAINING` is a distinct permission. Permission to inspect, evaluate, or
annotate does not imply permission to train.

Before a training run, CanopyProof must create an immutable training manifest
containing exact assets/labels/derivatives, source roots, license decisions,
permitted model purpose, geography/market restrictions, attribution, opt-out or
revocation handling, code/model licenses, and output obligations.

Training fails when:

- any source is `EXPLICIT_RIGHTS_REQUIRED`, `AMBIGUOUS_OR_CONFLICTING`,
  `EXPIRED_OR_REVOKED`, or `PROHIBITED`;
- `NO_MODEL_TRAINING` applies;
- personal/community data lacks required legal/ethical approval;
- a hard negative or annotation is permitted only for evaluation;
- the requested model purpose, territory, organization, or downstream license
  is outside the grant;
- the output-license/attribution obligation cannot be satisfied;
- provenance is incomplete.

Revocation impact on existing weights is governed by contract and legal review;
it is never assumed away. Affected models are identified by provenance and may
be quarantined, retrained, withdrawn, or restricted through append-only facts.

## 10. Export And Public Display

Every export or display is a new disclosure decision. It must specify recipient
or audience, purpose, fields/assets, geography, duration, onward-transfer terms,
attribution, location treatment, classification, and expiry.

Exports contain a machine-readable manifest with:

- source and derivative hashes;
- policy IDs/versions and terms identifiers;
- attribution and notice text;
- permitted purpose and prohibited onward uses;
- classification and location precision;
- creation/expiry;
- provenance and audit roots.

Short-lived FiftyOne media access is an internal disclosure and requires the
same policy evaluation. A screenshot or crop is also a derivative/export.

## 11. VineLiDAR Policy

Source references:

- [Original Zenodo dataset](https://zenodo.org/records/8113105)
- [Voxel51 VineLiDAR dataset card](https://huggingface.co/datasets/Voxel51/VineLiDAR)

Required policy:

```text
useClass = LAB_BENCHMARK
rightsStatus = STANDARD_LICENSE_VERIFIED
licenseIdentifier = CC-BY-4.0
modifiers = [ATTRIBUTION_REQUIRED, NO_PRODUCTION_EVIDENCE]
```

Allowed, subject to attribution and other controls:

- isolated internal benchmark ingestion;
- point-cloud parser, CRS, registration, COPC, PCD, DTM/DSM/CHM, lineage,
  quality, and uncertainty test development;
- model evaluation when the exact evaluation purpose and downstream artifacts
  comply with CC BY 4.0 and policy;
- authenticated internal review fixture.

Denied by CanopyProof policy even though the standard license may permit broad
reuse:

- production project evidence;
- proof/certificate/ESG/funding decisions;
- representing the benchmark as a CanopyProof monitored project;
- claiming object-level or segmentation ground truth;
- silently comparing unregistered local and absolute coordinate frames.

Attribution MUST include the original authors, dataset title, DOI
`10.5281/zenodo.8113105`, license name/link, and an indication of CanopyProof or
Voxel51 modifications such as conversion/downsampling. Attribution is carried
in the dataset record, every allowed export/manifest, and human-readable
benchmark documentation.

The original LAZ rights apply to Voxel51-derived PCD review copies. The Voxel51
preparation does not replace the original source authority.

## 12. Ariel Scans Policy

Source reference:

- [Voxel51 Ariel Scans dataset card](https://huggingface.co/datasets/Voxel51/ariel_scans)

The card states that imagery is courtesy of an original poster and asks users
to treat it as the poster's, while code and annotations are MIT. This does not
provide a standard or explicit institutional imagery license.

Required policy for imagery and imagery-derived assets:

```text
rightsStatus = EXPLICIT_RIGHTS_REQUIRED
modifiers = [
  NO_INSTITUTIONAL_REDISTRIBUTION_BY_DEFAULT,
  NO_MODEL_TRAINING,
  NO_PUBLIC_DISPLAY,
  NO_PRODUCTION_EVIDENCE,
  NO_PRECISE_LOCATION_DISCLOSURE
]
```

Default denied actions:

- institutional download/redistribution or partner export;
- ingestion into production project/evidence storage;
- public display, public dataset export, screenshots, crops, or thumbnails;
- model training, fine-tuning, distillation, or embedding corpus publication;
- external annotation-provider upload;
- use in proof, ESG, funding, or governance decisions.

The dataset card may be reviewed as public documentation. The known `0000`
shadow scenario and sensor-domain lessons may be represented as abstract test
requirements without copying imagery or derived embeddings.

Any exception requires explicit rights-holder evidence covering the exact
imagery, CanopyProof organization, purpose, processing, storage, training,
redistribution/public display as applicable, territory, duration, derivatives,
and precise-location handling. Code and annotation MIT terms are evaluated
separately and never broaden imagery rights.

## 13. Decision Matrix

| Dataset/policy state | Internal review | Model evaluation | Model training | Production evidence | Institutional export | Public display/export |
| --- | --- | --- | --- | --- | --- | --- |
| VineLiDAR approved lab snapshot | Allow with attribution | Allow if manifest and derivative terms pass | Separate explicit policy decision | Deny | Allow only if CC BY attribution and export policy pass | Allow only if separately approved with attribution; never as production evidence |
| Ariel Scans imagery default | Deny institutional ingest; documentation review only | Deny on copied imagery | Deny | Deny | Deny | Deny |
| Explicit project rights verified | Purpose-specific decision | Purpose-specific decision | Only when expressly granted | Only after custody/methodology gates | Recipient/purpose-specific | Only when expressly granted and privacy/location policy passes |
| Ambiguous/conflicting/expired/revoked | Deny | Deny | Deny | Deny | Deny | Deny |

An `Allow` in this table remains subject to tenant, classification, consent,
privacy, security, scientific fitness, provenance, and human/governance gates.

## 14. FiftyOne Manifest Policy

A FiftyOne manifest is issued only when every asset and derivative is permitted
for `INTERNAL_REVIEW` for the exact reviewer, tenant, project, location
precision, and time window.

The manifest contains policy IDs and bounded attribution, not raw contracts or
rights-holder personal data. Media grants expire no later than the manifest.
Policy expiry, revocation, classification change, assignment revocation, or
rights correction invalidates new accesses and plugin actions.

FiftyOne persistence, labels, saved views, MongoDB backups, screenshots, and
exports are included in the license/retention scope. A workbench cannot create
a less-restricted copy by changing format or tags.

## 15. Sensitive And Personal Data

License and privacy are independent gates. Even permissively licensed media may
contain people, homes, vehicles, culturally sensitive sites, endangered species
locations, community boundaries, or precise GPS/EXIF.

Required controls may include:

- consent/legal basis and community/Indigenous governance review;
- precise-location restriction/generalization;
- face/plate or other masking as a separately derived asset;
- restricted raw access and no public derivative;
- purpose limitation and minimum retention;
- residency and recipient restrictions;
- incident and subject/community challenge paths.

Redaction does not automatically cure license or consent defects. The raw asset
and every derivative retain lineage and policy references.

## 16. Expiry, Revocation, And Correction

License state is append-only. The system never edits the prior policy decision
to pretend it was always different.

On expiry, revocation, rights dispute, or correction:

1. append the new rights fact and effective time;
2. block new ingest, processing, training, manifests, exports, displays, and
   production-evidence use;
3. revoke active capabilities and purge bounded caches where possible;
4. traverse provenance to identify datasets, derivatives, embeddings, models,
   queues, findings, evidence, reports, and recipients;
5. quarantine or withdraw affected outputs according to legal/governance review;
6. issue correction/non-reliance notices where institutional users may rely;
7. preserve audit and historical facts under legal-hold/retention policy;
8. record remediation, unresolved copies, and residual risk.

Deletion, retraining, attribution correction, or continued grandfathered use is
not assumed. It follows the exact terms and approved legal decision.

## 17. Required Tests

### Policy Engine

- missing/unknown/ambiguous/conflicting/expired/revoked license fails closed;
- a code/annotation license cannot authorize underlying imagery;
- a public URL/download does not satisfy rights evidence;
- policy intersection selects the most restrictive applicable result;
- free-form notes cannot broaden a machine-evaluable permission;
- action, purpose, recipient, territory, time, and source version are bound;
- changed dataset membership or rights creates a new snapshot/decision hash.

### VineLiDAR

- only `LAB_BENCHMARK`, `CC_BY_4_0`, and `ATTRIBUTION_REQUIRED` are accepted;
- every allowed manifest/export includes authors, title, DOI, license, and
  modification notice;
- production evidence, proof, certificate, ESG, and funding use is denied;
- source LAZ and derived PCD/COPC retain the same rights lineage;
- no object/segmentation ground-truth status is invented.

### Ariel Scans

- imagery defaults to `EXPLICIT_RIGHTS_REQUIRED` and all institutional
  redistribution/training/public/production-evidence uses are denied;
- MIT code/annotation terms cannot broaden imagery rights;
- embeddings, crops, screenshots, labels, and thumbnails inherit imagery
  restrictions;
- abstract decoy/domain test requirements can exist without copying imagery;
- exact explicit rights evidence is required before any exception.

### Training, Export, And Revocation

- evaluation permission cannot authorize training;
- hard negatives require independent training permission;
- one denied source blocks a mixed training/export manifest;
- external annotation upload is treated as export;
- precise-location/privacy gate can deny an otherwise licensed action;
- expiry/revocation invalidates active manifests and future actions;
- provenance fan-out identifies affected derivatives/models/findings/reports;
- historical policy/audit facts remain immutable.

## 18. Approval Gate

Policy contracts and synthetic tests may be implemented under
`docs/RFC_VISUAL_EVIDENCE_INTELLIGENCE.md`. This policy does not authorize real
data ingest, training, export, FiftyOne deployment, production evidence use, or
public display until the parent deployment and data-use gates open.
