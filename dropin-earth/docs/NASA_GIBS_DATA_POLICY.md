# NASA GIBS Data Policy

Status: PROPOSED

Date: 2026-07-14

## 1. Scope

This policy governs NASA GIBS capabilities metadata, imagery visualizations,
temporal availability, comparison artifacts, screenshots, manifests, export
bundles, and references to underlying NASA Earthdata products used by
TerraProof and CanopyProof.

It does not grant permission to treat browse imagery as scientific source data
or CanopyProof evidence.

## 2. Data Classes

| Class | Examples | Authority and handling |
| --- | --- | --- |
| `NASA_GIBS_CAPABILITIES` | WMTS/WMS layer catalog, formats, matrix sets, time extents | External source metadata; hash and retain the exact source version used |
| `NASA_GIBS_VISUALIZATION` | WMTS tile, WMS map, screenshot | Contextual visualization only; never numerical source data or verified evidence |
| `NASA_GIBS_AVAILABILITY` | Dimension and DescribeDomains periods | Source-published availability; may be incomplete or stale |
| `NASA_SOURCE_REFERENCE` | CMR collection or granule-search reference | Discovery handoff only until independently retrieved and governed |
| `TERRAPROOF_COMPARISON` | Frozen before/after display configuration | TerraProof interpretation context; not a NASA conclusion |
| `CANOPYPROOF_AUDIT` | Actor, purpose, command, source hash, decision | CanopyProof authority record; NASA is not responsible for it |

## 3. Permitted Uses

GIBS may be used for:

- interactive visualization and temporal context;
- project-area reconnaissance;
- near-real-time situational awareness;
- historical comparison and review prioritization;
- creation of bounded observation signals and risk candidates;
- locating the underlying Earthdata collection or granule-search workflow.

Each use must display source, date, projection, freshness, capabilities hash,
and the required acknowledgement.

## 4. Prohibited Promotions

A GIBS tile, screenshot, comparison, color value, or visual inspection may not
directly become:

- verified environmental evidence;
- a proof certificate;
- a certified carbon credit or carbon-tax offset;
- an ESG metric or institutional claim;
- a public emergency declaration;
- a funding release or guaranteed-yield decision;
- a token or automatic CANOPY distribution input.

Any later scientific use must resolve the underlying science product, record
its collection/granule identity and processing level, apply an approved method,
quantify uncertainty, and undergo independent human review and governance.

## 5. Attribution and Non-Endorsement

The following acknowledgement is mandatory in map attribution, downloaded
comparison reports, screenshot metadata, export bundles, and institutional
report appendices:

> We acknowledge the use of imagery provided by services from NASA's Global
> Imagery Browse Services (GIBS), part of NASA's Earth Science Data and
> Information System (ESDIS).

CanopyProof must also state that NASA does not endorse CanopyProof, TerraProof,
its interpretations, reports, certificates, funding decisions, or services.
NASA names, insignia, identifiers, and imagery must not be used in a manner that
implies endorsement or commercial sponsorship.

NASA Earthdata guidance notes that third-party content can carry separate
rights. Product-specific metadata and source-dataset restrictions therefore
override any generic assumption of openness.

## 6. Freshness and Quality

- `near-real-time` is a source latency class, not a guarantee that a selected
  location has current coverage.
- Current-day imagery may be empty because acquisition or processing has not
  completed.
- `best` can resolve to different standard or NRT product versions over time.
- GetCapabilities may list only the latest 100 periods; complete availability
  requires DescribeDomains.
- WMS can snap to a nearest available date. Immutable records must preserve the
  requested date and, where observable, the actual published/served date.
- Web Mercator imagery is resampled and must not be represented as native
  sensor resolution.
- Source outages, stale catalogs, missing tiles, cloud, smoke, shadows, no-data,
  color palettes, and visual compression remain visible limitations.

Freshness is calculated from source publication/observation metadata when
available, otherwise from the latest declared period. Synchronization time is
never substituted for observation time.

## 7. Retention and Immutability

Retain:

- source capabilities hash and endpoint identity for every catalog snapshot;
- the exact product/date/projection/bbox configuration used by every manifest
  and comparison;
- append-only audit events and command receipts;
- attribution and source references attached to exported artifacts.

Do not persist tile caches indefinitely without a documented cache, license,
retention, and invalidation policy. Do not overwrite comparison or handoff
records. Corrections append a superseding record with rationale.

## 8. Tenant and Location Protection

Catalog metadata may be shared across tenants, but comparison, project linkage,
watch, handoff, and export records are tenant-bound. Sensitive project or
community locations must be generalized according to CanopyProof disclosure
policy before appearing in a NASA map manifest, Worldview deep link, screenshot,
or export.

Cross-tenant reads, manifests, comparisons, and handoffs are denied even when
they refer to the same public NASA product.

## 9. Export Requirements

Every export containing GIBS-derived visual context must include:

- NASA GIBS acknowledgement and non-endorsement statement;
- NASA layer identifier and internal product ID;
- date/time, projection, bbox or generalized area, format, and display mode;
- source capabilities hash and export timestamp;
- freshness and known limitations;
- a source-data handoff when the artifact supports scientific analysis;
- an explicit statement that visualization imagery is not itself verified
  proof or numerical source data.

## 10. Policy Enforcement

Violations fail closed. Accepted catalog, manifest, comparison, handoff, watch,
and export authority transitions append an immutable domain audit event.
Rejected hostile or malformed requests emit bounded, redacted security
telemetry and are rate-limited; they do not create an unbounded audit-log write
amplification path. Failed synchronization attempts are the exception because
their bounded failure record is part of source-availability provenance.

License or attribution uncertainty blocks institutional export but does not
delete prior records. Policy changes are versioned; existing artifacts retain
the policy version that governed their creation.
