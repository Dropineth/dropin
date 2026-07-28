# CanopyProof Point-Cloud MRV Standard

Status: IMPLEMENTATION BASELINE - contract/tests only; spatial processing gate closed

Date: 2026-07-13

Owners: CanopyProof Earth Science, TerraProof, Data Governance, and Security

Applies to: aerial, terrestrial, mobile, and satellite-derived point clouds used
for visual triage or environmental measurement, reporting, and verification

## 1. Purpose

This standard defines how CanopyProof and TerraProof register, normalize,
derive, review, compare, and govern point-cloud data without confusing a useful
visualization with authoritative measurement or proof.

Point clouds can support observations about terrain, canopy structure, height,
density, continuity, and change. They cannot by themselves establish tree
identity, carbon stock, additionality, permanence, certified carbon credits,
tax offsets, guaranteed yield, funding entitlement, or an Environmental Proof
Record.

All institutional conclusions remain subject to approved methodology,
complete provenance, quality and uncertainty fitness, independent human review,
the CanopyProof Trust Kernel, challenge rights, and governance.

## 2. Normative Language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. A waiver is valid only
when an approved methodology explicitly records scope, evidence, reviewer,
expiry, residual risk, and audit event. A waiver cannot remove license, tenant,
audit, human-review, or proof-authority requirements.

## 3. Format Roles

### 3.1 Authoritative Source Format: LAZ

Raw source point clouds MUST be retained as immutable LAS/LAZ objects when that
is the provider's delivered format. LAZ is the authoritative source artifact
for:

- original point records and dimensions;
- source scale and offset;
- source coordinate reference declaration;
- provider metadata and variable-length records;
- return, classification, intensity, RGB, waveform, GPS time, and other source
  attributes when present;
- source checksum, size, and provider object version.

The raw object MUST never be overwritten, normalized in place, or silently
repaired. Any byte change creates a new asset version and provenance branch.

### 3.2 Authoritative Normalized Format: COPC

Cloud Optimized Point Cloud (COPC) is the preferred authoritative normalized
and indexed derivative. A COPC object MUST:

- derive from one or more immutable source assets;
- preserve all policy-permitted source dimensions or record explicit loss;
- use a declared approved CRS, axis order, horizontal units, and vertical
  reference;
- preserve or document scale/offset conversion and quantization error;
- have an immutable checksum/provider version;
- reference a pinned processing recipe and run;
- pass structural, bounds, point-count, hierarchy, and sampled-content checks;
- carry a quality assessment and uncertainty budget.

COPC does not replace raw LAZ. Both remain in lineage.

### 3.3 Review Formats

The following are non-authoritative derivatives:

- PCD;
- orthographic, perspective, profile, and height-colored previews;
- density, continuity, and quality visualization tiles;
- PMTiles or 3D Tiles delivery projections where approved;
- screenshots, thumbnails, and FiftyOne scene files.

Review formats MAY be downsampled, clipped, recentered, quantized, attribute
reduced, or colorized. Every such change MUST be explicit. A review derivative
MUST NOT:

- be registered as raw or normalized authoritative point-cloud authority;
- overwrite or become the object reference of its source;
- be used to claim source point count, precision, density, or attributes;
- be used for measurement outside the validated derivative purpose;
- hide its review-only status in API, UI, export, or audit data.

## 4. Required PointCloudAsset Metadata

Each point-cloud asset record MUST include:

| Category | Required fields |
| --- | --- |
| Identity | asset ID, tenant, organization, project or approved benchmark scope, format role, media type, source provider/dataset |
| Integrity | algorithm, checksum, byte size, provider object version, ingest receipt, immutable object state |
| Acquisition | mission, sensor stream, platform, acquired time/window, altitude/range, flight/survey pattern, weather/context where available |
| Coordinates | body, coordinate-frame type, CRS authority/code and full WKT, axis order, horizontal units, vertical datum/units, bounds, scale, offset |
| Point schema | point count, dimensions, data types, return/classification semantics, missing/unknown flags |
| Sensor quality | calibration reference, clock quality, GNSS/IMU solution, scan angle/range limits, declared accuracy where supported |
| Policy | classification, license policy/version, retention, residency, consent/community restrictions, sensitive-location handling |
| Lineage | source roots, recipe/run for derivatives, software/container hashes, fact/provenance/audit roots |
| Fitness | validation state, registration state, quality assessment, uncertainty budget, methodology eligibility |

Unknown values are represented as typed `UNKNOWN` or `NOT_PROVIDED`, never as
zero, empty authority, or inferred precision.

## 5. Coordinate Frames And CRS

### 5.1 Frame Types

Each asset is exactly one of:

- `ABSOLUTE_CRS`: coordinates resolve through an approved Earth CRS and
  declared vertical reference;
- `LOCAL_REGISTERED`: local coordinates plus an approved transform and
  covariance/residuals to an absolute or common project frame;
- `LOCAL_UNREGISTERED`: local/relative coordinates without an approved common
  transform;
- `UNKNOWN_FRAME`: missing, contradictory, or invalid coordinate metadata.

Only `ABSOLUTE_CRS` and fit-for-purpose `LOCAL_REGISTERED` assets may support
spatial or temporal comparison. `LOCAL_UNREGISTERED` and `UNKNOWN_FRAME` assets
may be inspected in isolation but cannot support absolute location, area,
cross-scene height, change, or alignment claims.

### 5.2 CRS Validation

Validation MUST cover:

- known Earth body and approved CRS registry entry;
- canonical WKT and authority identifier where available;
- explicit axis order and longitude/latitude ordering;
- horizontal and vertical units;
- vertical datum or explicit absence;
- plausible project/region bounds;
- scale/offset and integer quantization range;
- antimeridian/polar behavior where applicable;
- transform grid/resource versions;
- no silent default to EPSG:4326, ellipsoidal height, or meters.

An EPSG code alone does not define vertical datum, sensor frame, or measurement
quality.

### 5.3 Registration

A registration record MUST contain:

- immutable source and target asset/frame roots;
- transform model and canonical parameters/matrix;
- control/tie features and selection method;
- initial alignment source;
- optimizer, software/container, and deterministic settings;
- inlier/outlier rules and counts;
- horizontal and vertical residual distributions;
- spatially distributed residual diagnostics, not only one RMSE;
- overlap/coverage and extrapolation mask;
- covariance or other fit uncertainty representation;
- reviewer, quality disposition, and audit event;
- intended comparison purpose and acceptance criteria from an approved
  methodology.

Registration MUST create a new derived asset or transform record. It MUST NOT
rewrite raw coordinates. A visually plausible overlay is not sufficient.

## 6. Ingest And Normalization Pipeline

```text
immutable source LAZ
  -> object/version/checksum confirmation
  -> bounded format-envelope inspection in quarantine
  -> full checksum verification
  -> point schema and count validation
  -> CRS/frame/units/scale/offset validation
  -> license/classification/tenant/purpose evaluation
  -> registration work item when required
  -> reviewed registration and uncertainty
  -> pinned LAZ-to-COPC normalization
  -> COPC structural/content verification
  -> quality assessment and uncertainty budget
  -> derivative work items
```

The pipeline MUST be idempotent by input roots, recipe version, canonical
parameters, and output role. A repeated exact run may return the same registered
result. Any parameter, software, input, policy, or output change creates a new
run and product.

## 7. Parser And Resource Safety

Point-cloud parsing and conversion MUST occur in an isolated native worker,
never in a public API, Cloudflare Worker, Next.js server function, browser, or
FiftyOne plugin process.

Before full parse, a bounded envelope check enforces:

- maximum compressed and declared uncompressed bytes;
- maximum point count and dimensions;
- maximum variable-length records and record sizes;
- supported point formats, versions, compression, and extra-byte schemas;
- coordinate and scale/offset numeric bounds;
- maximum spatial extent and density plausibility;
- no nested archive recursion;
- CPU, memory, scratch disk, process, file-descriptor, and wall-time quotas.

Workers run non-root in a minimal digest-pinned image with read-only root,
bounded scratch, no host mount, and no network by default. Parser errors,
timeouts, crashes, and quota kills leave the object quarantined and append a
run result; they never partially promote an asset.

## 8. Derived Structural Products

Every derived product references its immutable inputs, registration, recipe,
run, quality checks, uncertainty, and audit root.

### 8.1 DTM

A Digital Terrain Model MUST declare:

- ground-classification method and parameters;
- whether source classifications were trusted, replaced, or supplemented;
- interpolation method, cell size, nodata policy, edge treatment, and mask;
- terrain slope/roughness limitations;
- point density and gap diagnostics;
- vertical and interpolation uncertainty.

### 8.2 DSM

A Digital Surface Model MUST declare:

- surface selection/aggregation method;
- cell size and point support threshold;
- handling of multiple returns, outliers, scan edges, gaps, and nodata;
- acquisition geometry and occlusion limitations;
- vertical and aggregation uncertainty.

### 8.3 CHM

A Canopy Height Model is derived from compatible DSM and DTM products. It MUST
record exact source versions and propagate:

- DTM and DSM vertical uncertainty;
- registration uncertainty;
- interpolation and resolution effects;
- density/continuity limitations;
- acquisition time and phenology;
- sensor and flight geometry differences.

Negative, extreme, or unsupported cells are flagged and masked according to
methodology. They are not silently clipped into plausible values.

### 8.4 Density And Continuity

Density and continuity products MUST distinguish:

- raw/acquired point density;
- valid post-filter density;
- return and scan-angle distributions;
- spatial gaps and edge effects;
- occlusion and no-observation regions;
- interpolation support versus measured support.

A smooth raster does not prove continuous measurement.

## 9. Quality Assessment

Quality is a vector of checks, not one score. Minimum dimensions are:

- checksum and object integrity;
- parser/schema conformance;
- CRS/frame completeness;
- registration fitness;
- point density and distribution;
- coverage, overlap, gaps, and occlusion;
- noise/outlier and duplicate-point rates;
- classification quality;
- vertical/horizontal accuracy evidence;
- sensor calibration/clock/GNSS/IMU evidence;
- derivative support and nodata behavior;
- license, classification, and provenance completeness.

Each check is `PASS`, `WARN`, `FAIL`, `UNKNOWN`, or `NOT_APPLICABLE`, with
method, value, threshold source, and evidence root. A summary score cannot
average away a critical `FAIL` or `UNKNOWN` required by methodology.

Thresholds are methodology- and sensor-specific. This standard does not invent
universal centimeter, density, or RMSE limits. Missing approved criteria block
institutional use rather than defaulting to a convenient threshold.

## 10. Uncertainty Budget

Every measurement or comparison MUST carry an uncertainty budget appropriate
to its quantity and methodology. Candidate components include:

- sensor ranging and angular error;
- GNSS/IMU and platform trajectory error;
- calibration and clock error;
- coordinate transformation and geoid/vertical-datum error;
- registration residual and extrapolation error;
- quantization, scale/offset, and format-conversion error;
- point sampling, density, scan angle, and occlusion;
- ground/surface classification error;
- interpolation, rasterization, and resolution error;
- temporal mismatch, phenology, weather, and moisture;
- model or allometric error for downstream estimates.

The budget records method, assumptions, correlation treatment, spatial scope,
confidence/coverage semantics, unknown components, and reviewer. Unknown is not
zero. If required components cannot be estimated, the result is not fit for a
precision-dependent institutional claim.

## 11. Cross-Season And Change Analysis

A change comparison requires:

- distinct immutable acquisition missions and source assets;
- comparable sensor/calibration or an approved cross-sensor validation;
- explicit acquisition dates, seasons/phenological phases, weather/context,
  altitude/range, resolution, and point-density distributions;
- common absolute or registered project frame;
- transform and residuals for each epoch;
- overlap and comparable-observation mask;
- consistent or explicitly reconciled DTM/DSM/CHM recipes;
- propagated per-epoch and differential uncertainty;
- sensitivity analysis for registration and raster resolution;
- a bounded statement distinguishing observed structural change from possible
  acquisition, season, occlusion, or processing effects.

No-change and missing-data cells are distinct. A gap cannot be interpreted as
loss; newly observed coverage cannot be interpreted as growth.

## 12. Review PCD Generation

A PCD review derivative MUST record:

- authoritative source asset and run roots;
- sampling algorithm, seed, target/max points, voxel size, and stratification;
- retained/dropped attributes;
- coordinate recentering and exact offset/transform;
- quantization and numeric type changes;
- clipping/masking/generalization;
- review purpose and expiry/retention;
- output checksum, point count, bounds, and quality checks;
- visible `REVIEW_DERIVATIVE_NON_AUTHORITATIVE` designation.

Sampling SHOULD preserve diagnostically important low-density regions, classes,
returns, height strata, and known anomalies where the review purpose requires
them. A uniform visual sample can hide gaps or rare structure and must not be
used as an unbiased measurement sample without validation.

FiftyOne scene metadata may color a PCD by attributes, but the displayed color,
threshold, point size, or camera state is presentation state and not an
authoritative measurement.

## 13. Provenance

For every normalized or derived asset, provenance MUST form an acyclic,
content-addressed graph covering:

- each source object checksum/provider version;
- license/classification decision versions;
- mission, sensor, calibration, and coordinate-frame records;
- registration records;
- recipe/version and canonical parameters;
- software, library, container, and configuration hashes;
- actor/service identity and work item;
- start/end time and execution environment;
- output checksums and validation results;
- quality and uncertainty records;
- human review and audit events.

Missing edge, hash mismatch, cycle, mutable URL-only source, or unavailable
recipe blocks institutional eligibility.

## 14. VineLiDAR Benchmark Profile

VineLiDAR MAY be registered only under:

- `useClass = LAB_BENCHMARK`;
- `license = CC_BY_4_0`;
- `attributionRequired = true`;
- `productionEvidenceEligible = false`.

The original [Zenodo record](https://zenodo.org/records/8113105) is the source
authority for ten LAZ files and rights. The Voxel51 dataset preparation is a
review/evaluation projection.

Required benchmark handling:

- preserve Zenodo DOI, authors, license, source filenames, file checksums where
  supplied, and CanopyProof-computed stronger checksums;
- register ten flights across vineyard blocks B7/B9, three acquisition dates,
  and 20/30/50 m altitude domains without inventing missing combinations;
- keep 2021 local/relative frames distinct from 2022 EPSG:32629 assets;
- reject cross-year/absolute comparisons until registration is approved;
- preserve PCD recentering offsets and review-only role;
- state that RGB values are not calibrated reflectance;
- state that there are no object-detection or segmentation ground-truth labels;
- never interpret the source's satellite-validation use of "ground truth" as
  proof truth or annotated canopy truth.

## 15. Visual And Proof Authority

The maximum automatic output is a model candidate. The maximum point-cloud
pipeline output is a governed derived product with quality and uncertainty. A
human review may create a bounded `VisualFinding`.

None of these can directly:

- transition canonical evidence to verified;
- issue or revoke an Environmental Proof Record or certificate;
- publish an ESG metric;
- approve a carbon claim, credit, or tax treatment;
- release funds or create token entitlement;
- satisfy governance approval.

Downstream Trust Kernel commands must reference the exact point-cloud,
derivative, quality, uncertainty, review, and provenance roots and must perform
their own authorization and methodology gates.

## 16. Retention, Challenge, And Correction

Raw and authoritative normalized assets follow project, license, legal-hold,
and evidence-retention policy. Review derivatives may have shorter retention,
but deletion of a derivative does not erase its metadata, hash, provenance, or
decisions.

Suspected tampering, CRS error, registration failure, parser defect, license
change, or methodology issue triggers:

1. append challenge/quarantine state;
2. block new processing, manifests, exports, and institutional use;
3. trace affected products/findings/evidence/reports through provenance;
4. append corrected asset/run/product versions where possible;
5. issue withdrawal or non-reliance notices where required;
6. preserve original objects, decisions, and audit history.

## 17. Required Tests

### Integrity And Formats

- raw LAZ update/delete/overwrite is rejected;
- COPC retains source LAZ lineage and cannot replace it;
- PCD, preview, PMTiles, or 3D Tiles cannot be registered as authoritative raw
  or normalized point-cloud authority;
- changed input, recipe, parameter, image, or output creates a new run/version;
- malformed schema, point count, scale/offset, VLR, bounds, and compression fail
  within resource limits.

### Coordinates And Registration

- local-frame and absolute-CRS scenes cannot be compared before registration;
- two local frames cannot be assumed common by filename/provider/date;
- invalid/unknown CRS, axis order, units, vertical datum, or transform fails;
- registration records include transform, residual distributions, overlap,
  covariance/uncertainty, purpose, reviewer, and audit;
- raw coordinates remain unchanged after registration.

### Derivatives And Uncertainty

- DTM, DSM, CHM, density, and continuity products retain complete lineage;
- CHM source incompatibility or missing DTM/DSM uncertainty fails;
- critical quality failure cannot be hidden by a summary score;
- unknown uncertainty is not serialized or displayed as zero;
- cross-season comparison records per-epoch and differential uncertainty,
  overlap mask, domain differences, and registration sensitivity;
- missing coverage is never treated as zero height or structural loss.

### Review And Authority

- PCD downsampling metadata and recentering transform are complete;
- changing PCD sampling changes output hash/run while source remains stable;
- model output cannot issue proof, evidence verification, ESG metric,
  certificate, or funding action;
- a point-cloud-derived `VisualFinding` still requires human review and remains
  bounded;
- challenge/withdrawal propagates to queue and downstream eligibility.

### Benchmark And License

- VineLiDAR is lab-only and always carries CC BY 4.0 attribution;
- no VineLiDAR asset is production-evidence eligible;
- 2021/2022 coordinate frames are not silently compared;
- no annotation ground truth is inferred from the dataset description.

## 18. Approval Gate

Pure contracts and tests may be implemented under
`docs/RFC_VISUAL_EVIDENCE_INTELLIGENCE.md`. Any real point-cloud ingest,
normalization, processing worker, institutional dataset, or deployment depends
on approval of this standard and the opening of the separate TerraProof
`docs/ADR_SPATIAL_STACK.md` implementation gate.
