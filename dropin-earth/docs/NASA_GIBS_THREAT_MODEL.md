# NASA GIBS Connector Threat Model

Status: PROPOSED

Date: 2026-07-14

## 1. Protected Assets

- tenant, organization, project, and sensitive-location boundaries;
- CanopyProof identities, roles, audit roots, and signing keys;
- TerraProof product, comparison, watch, and handoff integrity;
- availability and freshness semantics;
- NASA attribution and non-endorsement obligations;
- API, egress, memory, CPU, and tile-request capacity;
- the separation between visualization context and verified proof.

## 2. Trust Boundaries

```text
untrusted caller
  -> CanopyProof authentication / authorization
  -> connector request schemas
  -> fixed NASA endpoint resolver
  -> untrusted external HTTP and XML
  -> normalized TerraProof registry
  -> signed disclosure manifest
  -> untrusted browser / exported artifact
```

NASA responses are authentic only to the extent established by HTTPS and the
configured egress trust store. Their contents are still untrusted parser input
and are not CanopyProof authority records until normalized, validated, hashed,
and audited.

## 3. Threats and Mandatory Controls

| Threat | Attack | Required control |
| --- | --- | --- |
| SSRF | Caller supplies a URL, redirect, metadata link, alternate host, or encoded path | Immutable endpoint IDs; HTTPS and exact host; redirect denial; egress allowlist; no arbitrary URLs |
| DNS rebinding / routing compromise | Approved hostname resolves to an unintended network | Egress proxy with DNS/IP policy; no private/link-local destinations; TLS verification |
| XML entity expansion / XXE | Malicious DOCTYPE, ENTITY, XInclude, or external reference | Reject dangerous constructs before parse; parser without external resolution; strict root/version checks |
| Oversized or compressed response | Capabilities response exhausts memory/CPU | Content-length and streamed-byte cap; decompression cap at proxy; timeout; layer/string/count limits |
| Parser differential | Namespace, duplicate keys, malformed time, or unexpected root changes meaning | Namespace-aware normalization; reject ambiguous duplicates; schema validation; fixture and fuzz tests |
| Catalog truncation | Partial response replaces the last valid catalog | Validate complete candidate snapshot and minimum invariants before atomic replacement |
| Retry divergence | A transport retry reuses its idempotency key but receives a new server timestamp | Bind idempotency to caller-controlled request fields and endpoint; keep execution time out of request identity |
| Historical-layer resurrection | A removed layer is resolved from an older immutable snapshot | Product and availability reads join only the newest complete snapshot for each endpoint |
| Stale-data deception | Old imagery is presented as current | Preserve observation/publication/default dates; freshness badge; stale warning; no sync-time substitution |
| Nearest-date ambiguity | WMS silently snaps to a nearby date | Prefer explicit WMTS dates; record requested and resolved date where available; availability validation |
| Axis-order error | WMS 1.3.0 EPSG:4326 bbox is reversed | Version/projection-specific axis-order handling; deterministic bbox tests; prefer WMTS for tiled display |
| Projection confusion | Product or bbox used in unsupported CRS | Projection enum, product availability check, coordinate bounds, and explicit reprojection prohibition |
| Template injection | Layer ID, title, or URL template injects HTML or arbitrary requests | Bounded identifier grammar; text-only rendering; templates produced locally, never trusted from XML |
| Manifest forgery/replay | Client changes product/date/bbox or reuses a manifest | Canonical payload, asymmetric signature, key ID, nonce, expiry, tenant binding, replay store |
| Capability rollback | Attacker serves an older valid document | Snapshot sequence, synchronized-at, source hash, monotonic policy, and operator-visible rollback alert |
| Cross-tenant disclosure | One tenant reads another comparison, project link, or precise bbox | RLS, canonical project-organization checks, database insert triggers, tenant-bound hashes/signatures, and adversarial tests |
| Attribution stripping | Screenshot/export omits NASA acknowledgement | Attribution embedded in manifest and export metadata; export validation; report appendix check |
| False endorsement | UI/report suggests NASA approved CanopyProof | Mandatory non-endorsement text; prohibited wording tests; brand policy review |
| Proof laundering | Tile or model interpretation becomes verified proof/ESG/funding | Type-level authority classes; disallowed transitions; human verification and governance remain separate |
| Upstream outage | NASA timeout cascades into API failure | Circuit breaker, bounded retry, cached last-valid snapshot, typed fail-soft state, stale warning |
| Tile amplification | Client causes excessive GIBS requests or telemetry writes | Manifest scope, tile budget, browser cache, first-error telemetry deduplication, authenticated product validation, per-tenant rate limit, no server-side open proxy |
| Telemetry leakage | URLs, bbox, tenant, or credentials enter labels/logs | Low-cardinality endpoint IDs; structured redaction; no query strings or precise coordinates in metrics |
| Supply-chain compromise | Worldview or parser code is silently vendored/updated | No Worldview vendoring; pinned parser; SBOM, audit, provenance, and reviewed update process |

## 4. Abuse Cases

The connector must reject:

1. any non-NASA endpoint or NASA-looking subdomain not in the registry;
2. malformed, oversized, entity-bearing, or wrong-service XML;
3. unsupported projection, format, matrix set, or date;
4. future dates beyond a bounded clock-skew allowance;
5. unsigned, expired, replayed, cross-tenant, or tampered manifests;
6. comparisons whose current product root differs from the frozen root;
7. a model, watch, tile, screenshot, or visual comparison promoted directly to
   verified proof, ESG metric, public emergency, certificate, or funding;
8. manifests or exports containing credentials, arbitrary service URLs, or
   unredacted restricted locations.

## 5. Failure Semantics

Upstream failures are categorized using bounded codes such as
`TIMEOUT`, `UPSTREAM_STATUS`, `CONTENT_TYPE`, `OVERSIZED`, `MALFORMED_XML`,
`UNSUPPORTED_SCHEMA`, and `CATALOG_INVARIANT`. Error bodies are not reflected to
callers or stored in low-cardinality telemetry.

The last valid snapshot remains readable with `STALE` or `OUTAGE` state. A
failed sync never returns an empty success, deletes products, advances a
capabilities root, or suppresses the audit event.

## 6. Security Verification

Required automated tests:

- arbitrary non-NASA endpoint rejected;
- redirects rejected;
- malformed, entity-bearing, and oversized XML rejected;
- unsupported projection/service/version/format rejected;
- invalid and future dates rejected;
- unavailable date rejected rather than silently using `default`;
- unsigned, expired, replayed, and tampered manifests rejected;
- comparison hash tampering and cross-tenant access rejected;
- withdrawn historical products are not returned by current-product reads;
- project links are rejected when the project is absent or belongs to another organization;
- stale products and upstream outages are explicit and fail soft;
- tile and comparison records cannot enter proof, ESG, certificate, funding, or
  emergency authority states;
- manifest and telemetry contain no credentials or arbitrary URLs;
- attribution and non-endorsement survive map, screenshot, and export paths;
- parser fuzz corpus terminates within memory and time bounds.

Native PostgreSQL RLS, concurrency, egress, KMS, load, outage, and chaos tests
remain mandatory before production route mounting.

## 7. Residual Risk

Even with these controls, NASA publication latency, upstream corrections,
visualization palettes, cloud/no-data conditions, science-product uncertainty,
and human interpretation can produce misleading context. The connector reduces
software and governance risk; it does not establish scientific truth.
