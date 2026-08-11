# CanopyProof UN Reporting Integration

Status: Phase 3 backend foundation

CanopyProof supports UN-facing report package compatibility through
`/canopyproof/reports/framework-packages`.

Supported adapters:

- `UN_SDG`
- `UNFCCC`
- `GRI`
- `ISSB`
- `TCFD`

The UN adapters do not create assurance opinions. They package issued
Environmental Proof Records into evidence-linked accountability manifests for
institutional review.

## Required Inputs

- verified organization ID.
- reporting period.
- issued Environmental Proof Record IDs.
- optional ESG report IDs.
- metric records with source proof record, methodology, confidence,
  verification reference, audit reference, and limitations.

## Outputs

- deterministic package ID.
- package root.
- evidence root.
- verification root.
- framework sections.
- JSON export.
- deterministic PDF export.
- `institutional_report_package` audit event.

## Boundaries

Framework packages must preserve these claims:

- no certified carbon credit.
- no carbon-tax offset.
- no financial asset.
- no guaranteed RWA yield.
- no automatic CANOPY distribution.
- no mainnet funds.

Corrections are new packages. Existing packages are append-only.
