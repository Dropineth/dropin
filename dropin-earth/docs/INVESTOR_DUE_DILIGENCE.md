# CanopyProof Investor Due Diligence Packages

Status: Phase 3 backend foundation

Investor review packages are generated through
`/canopyproof/reports/investor-review-packages`.

They are designed for climate funds, ESG investors, auditors, and institutional
reviewers who need reproducible evidence, not promotional claims.

## Package Contents

- verified organization profile.
- reporting period.
- project portfolio.
- evidence coverage.
- verification statistics.
- risk profile.
- organization, proof, and ESG audit roots.
- ESG report references.
- Environmental Proof Record references.
- deterministic package root.
- JSON export.
- deterministic PDF export.
- `investor_review_package` audit event.

## Required Inputs

- verified organization ID.
- reporting period.
- issued Environmental Proof Record IDs.
- at least one ESG report ID.
- optional project portfolio.
- optional risk profile.

When a project portfolio is omitted, CanopyProof derives one from the proof
record project IDs and region metadata.

## Access Rules

- create: `owner`, `admin`, `verifier`, `researcher`.
- read/export: `owner`, `admin`, `verifier`, `researcher`, `observer`.

## Boundaries

Investor packages are due-diligence artifacts. They must not represent proof
records as certified carbon credits, tax offsets, financial assets, automatic
CANOPY distributions, mainnet fund movements, or guaranteed-yield instruments.
