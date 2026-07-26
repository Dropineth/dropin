# CanopyProof ESG Reporting Engine

Status: Compatibility API plus route-closed canonical authority

Route: `/reports/esg`

Compatibility API slice: `/canopyproof/reports/esg/*`

Purpose: let institutions generate transparent environmental reports from
evidence, review, funding, and governance records without overstating impact.

## Authority Boundary

Two surfaces currently coexist and must not be confused:

1. The mounted `/canopyproof/reports/esg/*` implementation uses process-local
   report storage. It is retained for compatibility tests and demonstrations;
   it is not canonical, durable, or authorized for institutional reliance.
2. The canonical authority in
   `services/api/src/domain/canopyproof/esg-reporting-authority.ts` and
   `services/api/src/domain/canopyproof/esg-reporting-postgres.ts` creates
   append-only report/source-member/metric-member facts from current signed
   Environmental Proof authority and current independently reviewed governed
   metric results. Its database contracts are
   `services/api/prisma/esg-metric-authority.sql` and
   `services/api/prisma/esg-reporting-authority.sql`. No canonical HTTP route
   is mounted and production activation remains disabled.

Institutional consumers use `resolveCanonicalEsgInstitutionalSource`. The
adapter requires a `current` database projection, an exact canonical projection
root, complete source and metric member sets, disclosure binding, and matching
evidence, verification, monitoring, source-set, and metric-set roots.
Challenged, stale, revoked, expired, incomplete, or tampered sources or metric
projections fail closed. Passing this adapter still does not grant
institutional accreditation or an assurance opinion.

## Report Types

- GRI-aligned restoration report.
- SDG mapping report.
- TNFD preparation report.
- biodiversity indicators report.
- climate impact report.
- water and soil regeneration report.
- funding transparency report.

## Outputs

- PDF.
- JSON.
- API.

## Report Inputs

- projects.
- accepted evidence.
- rejected/challenged evidence counts.
- verification decisions.
- Impact Certificates / Environmental Proof Records.
- monitoring timeline.
- funding allocation and milestone releases.
- governance approvals.
- methodology version.
- governed metric definition version, exact value state, unit, uncertainty,
  calculation artifact, independent calculator/reviewer separation, and metric
  result root.

Methodology versions should resolve to `/canopyproof/methodologies` records, not
free-form report text. Reports can cite methodology slug, semantic version,
quality-gate root, and methodology hash so institutional reviewers can replay
which evidence thresholds were active when the report was generated.
Evidence and proof bundles should also resolve to `/canopyproof/quality/scorecards`
before inclusion in institutional ESG exports. Reports may cite scorecard ID,
quality hash, source root, finding root, and decision so auditors can see
whether the underlying data passed, required review, or was blocked by GPS,
duplicate, satellite, audit-lineage, challenge, or privacy gates.
Where report metrics depend on verifier judgment, reports should cite
`/canopyproof/verification/decisions` dossier IDs and decision hashes so the
accountable human review of AI, TerraProof, quality, governance, and audit roots
is replayable.
Where report metrics are disputed, reports should cite
`/canopyproof/verification/challenge-cases` IDs, challenge hashes, evidence
roots, status, and resolution roots. Open or accepted challenge cases must be
shown as uncertainty or exclusion context rather than hidden behind aggregate
impact totals.
Where reports cite certificate artifacts, they should also cite
`/canopyproof/certificates/transparency/entries` entry hashes and verification
roots so readers can replay the artifact hash, source record hash, evidence
root, monitoring root, governance root, challenge root, and claim-boundary root.

## Report Workflow

```text
Draft report
→ data lineage check
→ AI-assisted explanation draft
→ human review
→ governance approval
→ public or private export
→ immutable audit event
```

## Framework Mapping

### GRI

Map project and evidence data to:

- organizational profile.
- material topics.
- environmental impact narratives.
- methodology notes.
- limitations and data quality.

### SDG

Map restoration programs to relevant goals, typically:

- SDG 6: Clean Water and Sanitation.
- SDG 13: Climate Action.
- SDG 15: Life on Land.
- local/community co-benefits where documented.

### TNFD Preparation

Provide preparation material for:

- location of nature-related dependencies.
- nature-related risks.
- monitoring indicators.
- governance process.
- limitations and data gaps.

## Claim Boundaries

Reports must not claim:

- certified carbon credits.
- carbon-tax offsets.
- guaranteed financial yield.
- automatic token distribution.

Reports may state:

- evidence-backed observations.
- estimated impact ranges.
- verification status.
- methodology limitations.
- challenge or uncertainty status.
- challenge-case status and resolution lineage.

## Compatibility Slice

The current implementation lives in:

- `services/api/src/domain/canopyproof/esg-reporting.ts`
- `services/api/src/domain/canopyproof/proof-service.ts`
- `services/api/src/app.ts`

Implemented endpoints:

```text
POST /canopyproof/reports/esg/generate
GET  /canopyproof/reports/esg
GET  /canopyproof/reports/esg/:id
GET  /canopyproof/reports/esg/:id/export.json
GET  /canopyproof/reports/esg/:id/export.pdf
```

Current behavior:

- report generation requires `owner`, `admin`, `verifier`, or `researcher`.
- observers can read and export generated reports but cannot create them.
- reports are built only from issued Environmental Proof Records.
- JSON exports preserve the full proof lineage and claim-boundary object.
- PDF exports are deterministic, self-contained report artifacts with explicit
  non-credit, non-financial, non-tax-offset, non-yield, and non-distribution
  disclosures.
- every generated report creates a CanopyProof `esg_report` audit event.
- status reports identify this surface as `canonical: false`, `durable: false`,
  and `productionRelianceAuthorized: false`.

## Canonical Route-Closed Slice

The canonical report authority additionally provides:

- deterministic report, source-member, metric-member, semantic event, and
  projection roots;
- exact command idempotency and serializable advisory locking;
- current governed-record, reviewed-MRV, active-lifecycle, and signature
  receipt binding;
- current governed methodology, versioned metric definition, exact-decimal
  result, bounded uncertainty, and independent human metric-review binding;
- accredited human publisher enforcement;
- forced organization RLS and append-only database triggers;
- fail-closed rollback after authority facts exist; and
- deterministic replay across TypeScript and PGlite. The revised native
  PostgreSQL concurrency path is present but was not executed in the current
  refresh because a disposable native database was unavailable.

It intentionally does not provide a public route, production publication,
framework assurance, certified environmental instruments, tax treatment,
financial assets, guaranteed yield, mainnet funds, or automatic CANOPY
distribution.
