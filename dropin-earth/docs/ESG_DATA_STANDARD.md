# CanopyProof ESG Data Standard

Status: DRAFT - NON-PRODUCTION

Version: 0.2

Date: 2026-07-14

## 1. Purpose

This standard governs environmental metrics and report packages produced from
CanopyProof records. It is designed for traceable preparation of GRI, ISSB,
TCFD, TNFD and UN SDG-aligned disclosures without claiming external framework
certification or legal compliance.

CanopyProof ESG output is not a certified carbon credit, carbon-tax offset,
financial assurance opinion, guaranteed yield, or substitute for independent
professional review.

## 2. Authority Rule

Every reported metric must be derived from current, governed source records.
No report may turn a candidate, unreviewed model output, stale proof, challenged
record, revoked record, illustrative fixture or unavailable value into a
positive claim.

Report generation is deterministic. Report approval and publication are
separate human/governance facts.

## 3. Metric Envelope

Every metric contains:

```text
metric_id
metric_definition_id
metric_definition_version
organization_id
project_ids
reporting_period
value
unit
aggregation_method
source_record_refs
source_roots
methodology_id
methodology_version
verification_refs
verification_roots
confidence
uncertainty
geographic_scope
temporal_scope
quality_status
calculated_at
calculation_artifact_digest
```

Values and units use an approved dimension registry. Floating-point output must
declare precision and rounding. Missing, not applicable, below detection limit,
withheld and unavailable are distinct states, never numeric zero.

## 4. Metric Definition Registry

A governed metric definition records:

- canonical name and description;
- dimension and allowed units;
- numerator, denominator and aggregation rules;
- inclusion and exclusion criteria;
- spatial and temporal boundaries;
- required source and verification classes;
- accepted methodologies;
- uncertainty requirements;
- materiality and quality thresholds;
- framework mappings;
- owner, approval and effective dates; and
- supersession lineage.

Definition changes create a new version. Historical reports remain bound to the
version used at generation time.

## 5. Source Eligibility

Eligible sources are immutable references to:

- current project and monitoring projections;
- verified evidence decisions;
- current Environmental Proof Records;
- governed methodology publications;
- calibrated TerraProof products when its architecture gate is open;
- approved risk and challenge projections; and
- approved funding or operational records where relevant.

Raw observations may be included as clearly labeled observations but cannot be
represented as verified impact.

## 6. Quality And Confidence

Quality assessment includes:

- completeness;
- temporal freshness;
- spatial coverage;
- source diversity;
- custody and consent;
- methodology applicability;
- verification status;
- uncertainty;
- conflict and challenge state; and
- known sensor or model limitations.

Confidence is method-specific and cannot be compared across definitions unless
the registry explicitly permits it. A critical failed gate is
non-compensable; it cannot be averaged away by high scores elsewhere.

## 7. Aggregation

Aggregation must prevent:

- duplicate evidence or project counting;
- overlap across spatial boundaries;
- repeated inclusion of superseded records;
- combining incompatible units or methodologies;
- mixing modeled and measured values without disclosure;
- mixing verified and unverified values; and
- combining periods with materially different boundaries without restatement.

Each aggregate carries the complete input set commitment and a reproducible
calculation artifact digest.

## 8. Framework Mapping

Framework adapters map governed metric definitions to reporting concepts. The
adapter records framework name, version, disclosure identifier, mapping
rationale, required narrative, omissions and limitations.

Supported preparation targets may include:

- GRI;
- ISSB;
- TCFD;
- TNFD;
- UN SDG; and
- UNFCCC-oriented informational packages.

The presence of a mapping does not assert endorsement, assurance, conformity or
filing acceptance by the framework owner.

## 9. Report Package

An ESG report contains:

- report ID and immutable version;
- organization and reporting boundary;
- reporting period;
- approved framework mappings;
- metric definitions and values;
- source, evidence, verification and audit references;
- methodology and calculation artifacts;
- confidence, uncertainty and data-quality disclosures;
- material risks, challenges, exclusions and restatements;
- preparer, reviewers and governance approvals;
- generation and approval timestamps;
- report root and prior-version reference; and
- safety and reliance statement.

JSON is the canonical machine-readable export. PDF is a rendered view of the
same report root. A mismatch invalidates publication.

## 10. Lifecycle

The report lifecycle is:

- `DRAFT`
- `VALIDATING`
- `UNDER_REVIEW`
- `APPROVED`
- `PUBLISHED`
- `CHALLENGED`
- `RESTATED`
- `WITHDRAWN`

Generation cannot directly publish. Publication requires eligible human or
governance approval. A challenged source propagates to dependent reports and
may require withdrawal or restatement.

## 11. Restatement

A restatement is a new immutable report version containing:

- prior report root;
- reason and materiality;
- affected metrics;
- corrected source and calculation roots;
- reviewer and governance approval; and
- public correction notice where required.

Prior reports remain available according to disclosure and legal-retention
policy and are clearly marked superseded or withdrawn.

## 12. Access And Privacy

Institutional packages may contain non-public detail and require purpose-bound
authorization. Public reports expose only approved aggregate data, public
project references and privacy-safe audit roots.

Reports must exclude personal data, private reviewer notes, device identifiers,
exact protected locations, restricted media links, credentials and tenant data
outside the approved boundary.

## 13. API Requirements

Report APIs must:

- authenticate and bind current durable authority;
- enforce organization and purpose scope;
- validate framework and metric-definition versions;
- reject stale, challenged, revoked or unsupported sources;
- generate deterministically from immutable roots;
- separate generation, review, approval and publication commands;
- append audit events in the same transaction; and
- provide content digest, report root and media type on export.

## 14. Observability

Required metrics include report generation, validation failures, approval
latency, publication, challenge, restatement, unsupported-source denial,
framework mapping gaps, stale-source denial and export root mismatch.

Metrics use bounded labels and do not contain report payloads or organization-
specific sensitive identifiers.

## 15. Required Tests

Conformance tests must prove:

- every metric has source, methodology, unit, confidence and verification
  references;
- candidates and advisory AI output cannot become verified metrics;
- challenged, revoked and stale records are denied or disclosed according to
  policy;
- duplicate and overlapping inputs are not double-counted;
- missing values are not converted to zero;
- incompatible units and methodology versions are rejected;
- JSON and PDF views bind the same report root;
- unauthorized and cross-tenant report access is rejected;
- publication requires eligible human/governance approval;
- restatement preserves prior versions; and
- unsafe carbon-credit, tax-offset and guaranteed-yield claims are rejected.

## 16. Current Boundary

The repository now contains route-closed governed metric and canonical ESG
reporting authorities:

- `services/api/src/domain/canopyproof/esg-metric-authority.ts` publishes
  immutable, versioned metric definitions only after a two-person independent
  human review quorum over a current governed methodology publication. It
  records independently reviewed metric results with exact decimal strings,
  explicit missing-value states, unit and precision constraints, bounded
  uncertainty, calculation-artifact hashes, and the complete current source
  set.
- `services/api/src/domain/canopyproof/esg-metric-postgres.ts` and
  `services/api/prisma/esg-metric-authority.sql` commit definition, result,
  source-member, semantic-event, database-audit, and exact-idempotency facts in
  serializable organization-scoped transactions. The SQL projection
  re-resolves methodology and Environmental Proof authority rather than
  trusting caller-supplied current-state labels.

- `services/api/src/domain/canopyproof/esg-reporting-authority.ts` creates
  immutable report, source-member, and metric-member facts only from current governed
  Environmental Proof records, current reviewed MRV snapshots, active signed
  lifecycle bindings, current independently reviewed metric results, and an
  accredited human publisher. Metric result IDs and member roots are committed
  into the report artifact, report root, framework disclosures, and current
  projection.
- `services/api/src/domain/canopyproof/esg-reporting-postgres.ts` commits the
  report, members, semantic audit event, and exact command receipt in one
  serializable transaction.
- `services/api/prisma/esg-reporting-authority.sql` enforces append-only facts,
  forced tenant RLS, current-source re-resolution, hash parity, publisher
  accreditation, and deterministic current/stale/challenged/revoked/expired
  projection.
- `resolveCanonicalEsgInstitutionalSource` rejects every projection other than
  `current`; recomputes the projection root; and rechecks source members,
  metric members, disclosure bindings, evidence, verification, monitoring,
  source-set, and metric-set roots before an institutional package may consume
  it.

The mounted `/canopyproof/reports/esg/*` endpoints remain a process-local
compatibility surface. They are explicitly non-canonical, non-durable, and not
authorized for production or institutional reliance. The canonical authority
has no HTTP route and `productionActivationEnabled` remains false.

The current TypeScript and PGlite gates prove deterministic replay, exact-root
parity, append-only behavior, cross-tenant denial, rollback refusal after facts
exist, and rejection of forged metric projections. The revised native
PostgreSQL multi-connection path is authored but has not been executed in this
refresh because no disposable native database was configured.

The implementation still lacks production PDF/XBRL renderers, externally
reviewed framework mappings, privacy-reviewed data-room export, production
KMS/HSM operations, staffed report review/publication, a reviewed route
migration, and formal institutional approval. It is not production-conformant.
