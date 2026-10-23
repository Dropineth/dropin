# CanopyProof / God's Eye View — P0 integration contract

Status: initial integration scaffold. **No live satellite ingestion, carbon verification, or production deployment is claimed.**

## Architecture boundaries

- **Dropin:** existing wallet, crowdfunding, DePIN and rights workflows. Do not treat a token or planting claim as measured carbon removal.
- **Earth observation:** provider adapters for STAC catalogs and Sentinel-2 / Landsat scenes; GEDI biomass observations require separate access and quality filtering.
- **MRV:** versioned project boundaries, observation provenance, QA flags, biomass estimation, uncertainty, and independent verification status.
- **Evidence:** immutable references to input asset IDs, processing code/model version, timestamps, units, CRS and reproducible outputs.

## P0 acceptance criteria

1. Inventory actual application packages, APIs, contracts, databases, CI and deployment ownership before wiring production endpoints.
2. Define validated STAC item references with collection, item ID, datetime, geometry, asset href, license, and provider.
3. Implement a read-only observation ingestion adapter with pagination, timeout, retries, rate limits and fixture-based tests. No hardcoded credentials.
4. Store reproducible provenance and explicit quality masks (clouds, sensor flags, spatial/temporal coverage).
5. Model carbon estimates separately from verified credits, including methodology, baseline, leakage, permanence, units, confidence intervals and verifier decision.
6. Add CI checks for schema validation, tests, secrets scanning and build; verify against the existing application.
7. Document staging deployment, rollback and canopyproof.org DNS/hosting ownership. Do not auto-deploy to production without passing checks and authorization.

## Proposed interfaces (not yet implemented)

- `GET /api/earth-observation/projects/:id/scenes`
- `POST /api/mrv/projects/:id/estimate` (authenticated; async job)
- `GET /api/mrv/projects/:id/evidence`

## Data integrity

Satellite reflectance or canopy cover is **not** a direct measurement of issued carbon credits. Require geospatial validation, calibrated allometry or defensible models, uncertainty propagation and independent verification before presenting any verified credit claim.

## Next implementation pass

Locate the application root and deployment configuration, select its native language/framework, add schemas and provider interfaces, then run the repository's own test/build pipeline. This document is a planning baseline, not a completed P0 implementation.
