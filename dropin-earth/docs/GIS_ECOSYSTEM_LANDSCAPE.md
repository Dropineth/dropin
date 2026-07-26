# CanopyProof GIS Ecosystem Landscape

Status: PROPOSED - ADR approval required

Date: 2026-07-12

Decision scope: TerraProof Spatial Fabric P0

## 1. Executive Decision

CanopyProof must not become a generic GIS platform. Its institutional authority
remains identity, project, evidence, verification, certificate, challenge,
governance, funding, ESG, and audit records. TerraProof adds a bounded spatial
authority for asset metadata, observation provenance, processing recipes,
derived spatial products, quality, and uncertainty. External GIS products may
contribute data or interoperability, but they cannot issue proof, approve a
verification, certify an outcome, or rewrite CanopyProof audit history.

The recommended P0 stack is deliberately narrow:

- MapLibre GL JS plus deck.gl for the public, read-only map shell.
- PostGIS for authoritative geometry and spatial relationships.
- STAC, pgSTAC, and stac-fastapi for the spatiotemporal catalog contract.
- R2/S3-compatible immutable object storage for binary assets.
- TiTiler for raster tiles, Martin for vector tiles, and pygeoapi for bounded
  OGC API compatibility, all behind the CanopyProof service gateway.
- GDAL, Rasterio, Xarray, and PDAL only in isolated processing workers.
- COG, Zarr, GeoParquet, GeoArrow, PMTiles, GeoPackage, COPC, and EPT as
  purpose-specific formats rather than competing systems of record.

GeoLibre is reserved for a P1 expert workbench. CesiumJS and distributed
analytics engines remain laboratory options until a measured requirement
justifies a second rendering or compute runtime.

## 2. Classification Rules

Every candidate receives exactly one classification:

| Classification | Meaning |
| --- | --- |
| `ABSORB_LIBRARY` | Adopt a library, standard, or format inside a bounded CanopyProof component. It receives no independent authority. |
| `DEPLOY_SERVICE` | Operate an isolated service with its own runtime, private network boundary, health checks, and scoped gateway contract. |
| `EXTERNAL_CONNECTOR` | Integrate a separately operated source or field system through an ingest adapter and provenance envelope. |
| `INSTITUTIONAL_COMPATIBILITY` | Support interchange with the standard or product without adopting it as the CanopyProof core. |
| `LAB_ONLY` | Permit controlled research or benchmarks only; no production dependency or proof path. |
| `REJECT` | Do not introduce because it duplicates an accepted component or violates the bounded product architecture. |

Classification does not imply trust. Every input still requires tenant,
license, provenance, quality, uncertainty, and audit controls.

## 3. Repository Baseline

The current repository contains a useful TerraProof prototype, not the P0
spatial fabric:

- `services/api/src/domain/canopyproof/terra-intelligence.ts` stores layers,
  scenes, and connector runs in process-local `Map` instances.
- `services/api/src/app.ts` exposes status, layer, scene, and connector-run
  endpoints against that in-memory service.
- `apps/web/src/app/terra/page.tsx` renders the generic static CanopyProof OS
  page rather than a tenant-scoped map manifest.
- `apps/web` already includes Three.js and React Three Fiber dependencies, but
  does not include MapLibre GL JS or deck.gl.
- There is no persistent spatial authority, pgSTAC catalog, immutable object
  registry, service-to-service authorization contract, or signed map manifest.

The prototype may inform migration fixtures. It must not be relabeled as a
production spatial authority.

## 4. Evaluation Matrix

### 4.1 Browser Rendering And Catalog Exploration

| Candidate | Classification | P0 disposition and authority boundary | Official source |
| --- | --- | --- | --- |
| MapLibre GL JS | `ABSORB_LIBRARY` | P0 base-map and vector-tile renderer. It receives only a verified, read-only manifest and never credentials or unrestricted asset URLs. | [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/) |
| deck.gl | `ABSORB_LIBRARY` | P0 analytical overlays for large vector, point, raster, and columnar datasets. Share the MapLibre camera; do not create a second map state authority. | [deck.gl documentation](https://deck.gl/docs) |
| CesiumJS | `LAB_ONLY` | Evaluate later for high-precision globe, 3D Tiles, and time-dynamic use cases. A second P0 renderer would duplicate camera, cache, security, and accessibility work. | [CesiumJS](https://cesium.com/platform/cesiumjs/) |
| GeoLibre | `LAB_ONLY` | P1 expert workbench only, as a separate authenticated surface. Do not embed it in the P0 public viewer. | [GeoLibre getting started](https://geolibre.app/getting-started/) |
| OpenLayers | `REJECT` | Capable browser map library, but duplicates the selected MapLibre runtime without a P0 requirement that outweighs the extra bundle and security surface. | [OpenLayers](https://openlayers.org/) |
| TerriaJS | `INSTITUTIONAL_COMPATIBILITY` | Support catalog interchange or links to partner Terria deployments. Do not adopt its catalog explorer as CanopyProof proof authority or P0 viewer. | [TerriaJS documentation](https://docs.terria.io/guide/) |

### 4.2 Catalog, Metadata, And Geometry

| Candidate | Classification | P0 disposition and authority boundary | Official source |
| --- | --- | --- | --- |
| STAC | `ABSORB_LIBRARY` | Adopt the Item, Collection, Catalog, and API contracts for spatial discovery. TerraProof records add tenant, license, audit, quality, and provenance controls that STAC alone does not supply. | [STAC specification](https://stacspec.org/en/about/stac-spec/) |
| pgSTAC | `DEPLOY_SERVICE` | Private catalog database schema beside PostGIS. Its item replacement behavior is not audit history; CanopyProof audit and immutable asset versions remain authoritative. | [pgSTAC documentation](https://stac-utils.github.io/pgstac/) |
| stac-fastapi | `DEPLOY_SERVICE` | Private STAC API process backed by pgSTAC. Require response validation, gateway authentication, tenant filters, query limits, and no public write routes. | [stac-fastapi documentation](https://stac-utils.github.io/stac-fastapi/) |
| GeoNetwork | `INSTITUTIONAL_COMPATIBILITY` | Export and harvest institutional metadata profiles where partners require catalog interoperability. Do not create a second internal catalog authority. | [GeoNetwork documentation](https://docs.geonetwork-opensource.org/4.4/tutorials/introduction/introduction/) |
| GeoNode | `INSTITUTIONAL_COMPATIBILITY` | Provide documented import/export paths for partner SDIs. Do not deploy its full GIS CMS as the CanopyProof core. | [GeoNode documentation](https://docs.geonode.org/) |
| PostGIS | `DEPLOY_SERVICE` | P0 authoritative geometry, topology, spatial relationships, validity checks, and indexed spatial queries. Large binary assets remain outside PostgreSQL. | [PostGIS manual](https://postgis.net/documentation/manual/) |

### 4.3 Cloud-Native Formats

| Candidate | Classification | P0 disposition and authority boundary | Official source |
| --- | --- | --- | --- |
| Cloud Optimized GeoTIFF (COG) | `ABSORB_LIBRARY` | Default immutable raster delivery format, validated at ingest and read through allowlisted object identifiers and byte ranges. | [COG overview](https://cogeo.org/) |
| Zarr | `ABSORB_LIBRARY` | Multidimensional chunked datacubes for analysis and derived products. Pin format version, codecs, dimensions, chunk layout, and consolidated metadata policy per recipe. | [Zarr documentation](https://zarr.dev/) |
| GeoParquet | `ABSORB_LIBRARY` | Columnar analytical exchange and batch exports with explicit CRS and geometry metadata. Never the transactional geometry authority. | [GeoParquet specification](https://geoparquet.org/releases/v1.1.0/) |
| GeoArrow | `ABSORB_LIBRARY` | In-memory and IPC geometry columns for bounded analytical paths. Validate metadata before zero-copy consumption. | [GeoArrow](https://geoarrow.org/) |
| PMTiles | `ABSORB_LIBRARY` | Immutable, versioned public tile snapshots only. It cannot overwrite PostGIS geometry or serve as transactional state. | [PMTiles documentation](https://docs.protomaps.com/) |

### 4.4 Tile And OGC Services

| Candidate | Classification | P0 disposition and authority boundary | Official source |
| --- | --- | --- | --- |
| TiTiler | `DEPLOY_SERVICE` | Isolated raster tile and metadata service for registered COG/STAC/Zarr assets. Disable open CORS and arbitrary URL inputs; authorize through the gateway. | [TiTiler documentation](https://developmentseed.org/titiler/) |
| Martin | `DEPLOY_SERVICE` | Private Rust vector tile service for approved PostGIS views and immutable files. Its lack of built-in authorization makes the gateway mandatory. | [Martin architecture](https://maplibre.org/martin/architecture/) |
| pygeoapi | `DEPLOY_SERVICE` | Bounded OGC API facade for approved read-only collections and processes. It does not own proof, audit, or geometry lifecycle. | [pygeoapi documentation](https://docs.pygeoapi.io/en/latest/) |
| GeoServer | `INSTITUTIONAL_COMPATIBILITY` | Support WMS/WFS/WMTS exchange where institutions require it, preferably through partner deployments or a quarantined compatibility tier. | [GeoServer documentation](https://docs.geoserver.org/) |

### 4.5 Processing And Analytics

| Candidate | Classification | P0 disposition and authority boundary | Official source |
| --- | --- | --- | --- |
| GDAL | `ABSORB_LIBRARY` | Pinned native dependency in sandboxed processing images for format inspection, reprojection, conversion, and validation. Never execute user-provided command lines. | [GDAL programs](https://gdal.org/en/stable/programs/index.html) |
| Rasterio | `ABSORB_LIBRARY` | Python raster adapter inside TiTiler or isolated workers only. It is absent from the Next.js/Workers request path. | [Rasterio documentation](https://rasterio.readthedocs.io/en/stable/) |
| Xarray | `ABSORB_LIBRARY` | Labeled-array processing for controlled Zarr recipes in isolated workers, with pinned dimensions and chunk contracts. | [Xarray documentation](https://docs.xarray.dev/en/latest/getting-started-guide/index.html) |
| Dask | `LAB_ONLY` | Benchmark only after single-node and bounded job queues are measured insufficient. It adds scheduler and distributed failure complexity to P0. | [Dask documentation](https://docs.dask.org/en/stable/) |
| openEO | `INSTITUTIONAL_COMPATIBILITY` | Map approved TerraProof recipes to/from openEO process graphs where partner backends require portability. External results still enter as untrusted derived inputs. | [openEO developer documentation](https://openeo.org/documentation/1.0/developers/) |
| Open Data Cube | `INSTITUTIONAL_COMPATIBILITY` | Ingest catalog references or export datasets for institutions using ODC. Do not deploy a competing P0 cube catalog. | [Open Data Cube](https://www.opendatacube.org/) |
| Orfeo ToolBox (OTB) | `LAB_ONLY` | Evaluate specialized optical/radar algorithms in reproducible research jobs before approving any production recipe. | [OTB cookbook](https://www.orfeo-toolbox.org/CookBook/) |
| ESA SNAP | `LAB_ONLY` | Evaluate Sentinel-specific graph processing in quarantined research workers; no direct production proof path. | [ESA SNAP](https://step.esa.int/main/toolboxes/snap/) |
| GRASS GIS | `LAB_ONLY` | Research and methodology replication only. Its broad GIS runtime is unnecessary in the P0 service path. | [GRASS GIS manuals](https://grass.osgeo.org/grass-stable/manuals/) |
| DuckDB Spatial | `ABSORB_LIBRARY` | Read-only local analytics, validation, and offline packages. Never write authoritative geometry, and pin CRS/PROJ behavior in reproducible jobs. | [DuckDB Spatial overview](https://duckdb.org/docs/current/core_extensions/spatial/overview) |
| Apache Sedona | `LAB_ONLY` | Evaluate only when measured workloads require distributed vector/raster processing beyond PostGIS and bounded workers. | [Apache Sedona documentation](https://sedona.apache.org/latest/setup/overview/) |
| TorchGeo | `LAB_ONLY` | AI research and advisory model evaluation only. Outputs cannot approve evidence, issue certificates, or become final spatial truth. | [TorchGeo documentation](https://torchgeo.readthedocs.io/en/latest/) |
| eo-learn | `LAB_ONLY` | Research workflow composition only. Production processing requires approved immutable recipes and independent human review. | [eo-learn documentation](https://eo-learn.readthedocs.io/en/latest/) |

### 4.6 Field, Sensor, Biodiversity, And Point-Cloud Systems

| Candidate | Classification | P0 disposition and authority boundary | Official source |
| --- | --- | --- | --- |
| ODK | `EXTERNAL_CONNECTOR` | Import signed or authenticated field submissions, media hashes, forms, and capture metadata into evidence intake. ODK submissions are claims pending CanopyProof verification. | [ODK documentation](https://docs.getodk.org/getting-started/) |
| KoboToolbox | `EXTERNAL_CONNECTOR` | Import humanitarian and NGO survey data through scoped API credentials and immutable ingest receipts. | [KoboToolbox API](https://support.kobotoolbox.org/api) |
| QField | `EXTERNAL_CONNECTOR` | Accept versioned offline field packages and edits through a controlled review queue. QField never writes authoritative PostGIS tables directly. | [QField documentation](https://docs.qfield.org/get-started/) |
| Open Foris | `EXTERNAL_CONNECTOR` | Import forest inventory and monitoring datasets with methodology, license, contributor, and source hashes preserved. | [Open Foris](https://www.openforis.org/) |
| OpenDroneMap | `EXTERNAL_CONNECTOR` | Register photogrammetry jobs and ingest orthophoto, point-cloud, and elevation outputs as untrusted derived products with full recipe provenance. | [OpenDroneMap documentation](https://docs.opendronemap.org/) |
| PDAL | `ABSORB_LIBRARY` | Pinned point-cloud inspection and transformation library in isolated workers for LAS/LAZ/COPC/EPT pipelines. | [PDAL documentation](https://pdal.io/en/stable/) |
| OGC SensorThings API | `INSTITUTIONAL_COMPATIBILITY` | Adopt read/write adapter contracts for heterogeneous sensor observations. Sensor observations remain evidence inputs, not final proof. | [OGC SensorThings API](https://www.ogc.org/standards/sensorthings/) |
| FROST-Server | `EXTERNAL_CONNECTOR` | Connect to institution-operated SensorThings endpoints through allowlisted adapters. Do not deploy another P0 observation authority. | [FROST-Server documentation](https://fraunhoferiosb.github.io/FROST-Server/) |
| GBIF | `EXTERNAL_CONNECTOR` | Ingest occurrence references through the documented API/download path with citation, license, rate-limit, and sensitive-location handling. | [GBIF API reference](https://techdocs.gbif.org/en/openapi/) |

## 5. P0 Component Boundary

```text
CanopyProof Trust Authority
  | project, evidence, verification, governance, audit
  v
TerraProof Gateway and Registry
  | scoped IDs, policy decisions, provenance, quality, uncertainty
  +--> PostGIS / pgSTAC
  +--> immutable R2 objects
  +--> isolated TiTiler / Martin / pygeoapi / processing workers
  +--> allowlisted external connectors
  v
Signed, expiring, read-only map manifest
  v
MapLibre + deck.gl public viewer
```

The browser never selects arbitrary source URLs. Services never infer tenant or
project context from a URL. External systems never mutate CanopyProof evidence,
verification, certificate, challenge, or audit records.

## 6. Approval Gate

No package installation, schema migration, service deployment, route addition,
or viewer implementation is authorized by this landscape document. Work may
proceed only after `ADR_SPATIAL_STACK.md` receives the required architecture,
security, data-governance, and earth-science approvals.
