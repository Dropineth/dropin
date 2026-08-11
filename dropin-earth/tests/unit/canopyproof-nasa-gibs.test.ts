import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  InMemoryNasaGibsRepository,
  InMemoryNasaGibsTelemetry,
  NASA_GIBS_ACKNOWLEDGEMENT,
  NASA_GIBS_NON_ENDORSEMENT,
  NasaGibsConnectorService,
  NasaGibsError,
  buildNasaWorldviewLink,
  fetchNasaGibsCapabilities,
  nasaGibsAttributionArtifactKinds,
  nasaGibsEndpointId,
  nasaGibsSafetyBoundary,
  parseNasaGibsCapabilities,
  resolveNasaGibsServiceEndpoint,
  resolveNasaGibsWmsGetMapUrl,
  resolveNasaGibsWmtsTileTemplate,
  verifyObservationComparison,
  type NasaGibsActor,
  type NasaGibsManifestSignaturePort,
} from "../../services/api/src/domain/canopyproof/nasa-gibs.js";

const wmtsFixture = readFileSync(join(process.cwd(), "tests/fixtures/nasa-gibs-wmts-capabilities.xml"));
const wmsFixture = readFileSync(join(process.cwd(), "tests/fixtures/nasa-gibs-wms-capabilities.xml"));
const synchronizedAt = "2026-07-13T12:00:00.000Z";

function actor(overrides: Partial<NasaGibsActor> = {}): NasaGibsActor {
  return {
    id: "nasa_gibs_operator_001",
    organizationId: "organization_nasa_gibs_001",
    role: "administrator",
    capabilities: ["nasa_gibs_catalog_sync"],
    ...overrides,
  };
}

function fixtureTransport(body = wmtsFixture, status = 200, contentType = "application/xml") {
  return async () => new Response(body, {
    status,
    headers: { "content-type": contentType, "content-length": String(body.byteLength) },
  });
}

class EphemeralEs256JwsPort implements NasaGibsManifestSignaturePort {
  readonly keyId = "kms-test-key-2026-07";
  readonly algorithm = "ES256" as const;
  private readonly keyPairPromise = crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );

  async sign(payload: Uint8Array) {
    const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: this.algorithm, kid: this.keyId, typ: "JWT" })));
    const encodedPayload = base64Url(payload);
    const signingInput = new TextEncoder().encode(`${header}.${encodedPayload}`);
    const keyPair = await this.keyPairPromise;
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      Uint8Array.from(signingInput).buffer,
    );
    return `${header}.${encodedPayload}.${base64Url(new Uint8Array(signature))}`;
  }

  async verify(payload: Uint8Array, compactJws: string, keyId: string) {
    try {
      const parts = compactJws.split(".");
      if (parts.length !== 3 || keyId !== this.keyId) return false;
      const [header, encodedPayload, signature] = parts as [string, string, string];
      const protectedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(header))) as {
        readonly alg?: unknown;
        readonly kid?: unknown;
      };
      if (protectedHeader.alg !== this.algorithm || protectedHeader.kid !== this.keyId) return false;
      if (encodedPayload !== base64Url(payload)) return false;
      const signingInput = new TextEncoder().encode(`${header}.${encodedPayload}`);
      const keyPair = await this.keyPairPromise;
      return crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        keyPair.publicKey,
        base64UrlDecode(signature).buffer,
        Uint8Array.from(signingInput).buffer,
      );
    } catch {
      return false;
    }
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(`${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function synchronizedService(options: {
  readonly repository?: InMemoryNasaGibsRepository;
  readonly telemetry?: InMemoryNasaGibsTelemetry;
  readonly signaturePort?: NasaGibsManifestSignaturePort;
} = {}) {
  const repository = options.repository ?? new InMemoryNasaGibsRepository({
    project_sahel_001: actor().organizationId,
  });
  const service = new NasaGibsConnectorService({
    repository,
    transport: fixtureTransport(),
    telemetry: options.telemetry,
    signaturePort: options.signaturePort,
    enabled: true,
    now: () => synchronizedAt,
  });
  const sync = await service.sync({
    serviceType: "WMTS",
    projection: "EPSG:3857",
    actor: actor(),
    idempotencyKey: "nasa-gibs-test-idempotency-key-0001",
    requestedAt: synchronizedAt,
  });
  assert.equal(sync.outcome, "synchronized");
  return { service, repository, products: sync.products };
}

test("NASA GIBS WMTS and WMS capabilities normalize into bounded product variants", async () => {
  const wmtsEndpoint = resolveNasaGibsServiceEndpoint(nasaGibsEndpointId("WMTS", "EPSG:3857"));
  const wmts = await parseNasaGibsCapabilities(wmtsFixture, wmtsEndpoint, synchronizedAt);
  assert.equal(wmts.products.length, 2);
  assert.equal(wmts.availability.length, 2);
  assert.match(wmts.sourceCapabilitiesHash, /^[a-f0-9]{64}$/);
  const trueColor = wmts.products.find((product) => product.nasaLayerId.includes("TrueColor"));
  assert.ok(trueColor);
  assert.equal(trueColor.serviceType, "WMTS");
  assert.equal(trueColor.projection, "EPSG:3857");
  assert.equal(trueColor.tileMatrixSet, "GoogleMapsCompatible_Level9");
  assert.equal(trueColor.attribution, NASA_GIBS_ACKNOWLEDGEMENT);
  assert.equal(trueColor.nonEndorsement, NASA_GIBS_NON_ENDORSEMENT);
  assert.equal(trueColor.freshness, "current");

  const wmsEndpoint = resolveNasaGibsServiceEndpoint(nasaGibsEndpointId("WMS", "EPSG:4326"));
  const wms = await parseNasaGibsCapabilities(wmsFixture, wmsEndpoint, synchronizedAt);
  assert.equal(wms.products.length, 1);
  assert.equal(wms.products[0]?.nasaLayerId, "MODIS_Terra_Aerosol");
  assert.equal(wms.products[0]?.serviceType, "WMS");
  assert.deepEqual(wms.products[0]?.formats, ["image/jpeg", "image/png"]);
});

test("NASA GIBS transport rejects endpoint substitution, oversized bodies, malformed XML, and dangerous entities", async () => {
  const endpoint = resolveNasaGibsServiceEndpoint(nasaGibsEndpointId("WMTS", "EPSG:3857"));
  await assert.rejects(
    fetchNasaGibsCapabilities({ ...endpoint, capabilitiesUrl: "https://example.com/evil.xml" }, fixtureTransport()),
    /ENDPOINT_DENIED/,
  );
  await assert.rejects(
    fetchNasaGibsCapabilities(endpoint, fixtureTransport(wmtsFixture), { maxBytes: 1_024 }),
    /OVERSIZED/,
  );
  await assert.rejects(
    parseNasaGibsCapabilities(new TextEncoder().encode("<Capabilities>"), endpoint, synchronizedAt),
    /MALFORMED_XML/,
  );
  await assert.rejects(
    parseNasaGibsCapabilities(
      new TextEncoder().encode('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY file SYSTEM "file:///etc/passwd">]><Capabilities>&file;</Capabilities>'),
      endpoint,
      synchronizedAt,
    ),
    /MALFORMED_XML/,
  );
  await assert.rejects(
    fetchNasaGibsCapabilities(endpoint, fixtureTransport(wmtsFixture, 200, "text/html")),
    /CONTENT_TYPE/,
  );
  await assert.rejects(
    fetchNasaGibsCapabilities(endpoint, fixtureTransport(wmtsFixture, 200, "")),
    /CONTENT_TYPE/,
    "NASA responses without a declared XML media type must fail closed",
  );
  await assert.rejects(
    parseNasaGibsCapabilities(wmtsFixture, { ...endpoint, projection: "EPSG:3413" }, synchronizedAt),
    /ENDPOINT_DENIED/,
  );
  const invalidDateFixture = new TextEncoder().encode(
    new TextDecoder().decode(wmtsFixture).replace("2026-07-12", "2026-13-99"),
  );
  await assert.rejects(
    parseNasaGibsCapabilities(invalidDateFixture, endpoint, synchronizedAt),
    /temporal date|default date|invalid/i,
  );
  const normalizedCalendarDateFixture = new TextEncoder().encode(
    new TextDecoder().decode(wmtsFixture).replace("2026-07-12", "2026-02-30"),
  );
  await assert.rejects(
    parseNasaGibsCapabilities(normalizedCalendarDateFixture, endpoint, synchronizedAt),
    /default date.*invalid/i,
    "calendar dates that JavaScript would normalize must fail closed",
  );

  let redirectMode: RequestRedirect | undefined;
  await fetchNasaGibsCapabilities(endpoint, async (_url, init) => {
    redirectMode = init.redirect;
    return new Response(wmtsFixture, { status: 200, headers: { "content-type": "application/xml" } });
  });
  assert.equal(redirectMode, "error", "NASA egress must reject redirects at the HTTP transport boundary");

  await assert.rejects(
    fetchNasaGibsCapabilities(endpoint, async (_url, init) => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        init.signal?.addEventListener("abort", () => {
          controller.error(new DOMException("Synthetic stalled body", "AbortError"));
        }, { once: true });
      },
    }), { status: 200, headers: { "content-type": "application/xml" } }), { timeoutMs: 100 }),
    /TIMEOUT: NASA GIBS capabilities response body timed out/,
  );
});

test("historical NASA GIBS products are clearly marked stale without being rejected", async () => {
  const endpoint = resolveNasaGibsServiceEndpoint(nasaGibsEndpointId("WMTS", "EPSG:3857"));
  const historicalFixture = new TextEncoder().encode(
    new TextDecoder().decode(wmtsFixture).replaceAll("2026-", "2020-"),
  );
  const parsed = await parseNasaGibsCapabilities(historicalFixture, endpoint, synchronizedAt);
  assert.ok(parsed.products.every((product) => product.freshness === "stale"));
  assert.ok(parsed.products.every((product) => /historical product/i.test(product.freshnessReason)));
});

test("NASA temporal defaults, freshness, and interval periods fail conservatively", async () => {
  const endpoint = resolveNasaGibsServiceEndpoint(nasaGibsEndpointId("WMTS", "EPSG:3857"));
  const fixtureText = new TextDecoder().decode(wmtsFixture);
  const invalidDefaultFixture = new TextEncoder().encode(
    fixtureText.replace("<Default>2026-07-12</Default>", "<Default>2025-12-31</Default>"),
  );
  await assert.rejects(
    parseNasaGibsCapabilities(invalidDefaultFixture, endpoint, synchronizedAt),
    /default date is outside the declared temporal availability/i,
  );

  const futureFixture = new TextEncoder().encode(fixtureText.replaceAll("2026-", "2027-"));
  const futureCatalog = await parseNasaGibsCapabilities(futureFixture, endpoint, synchronizedAt);
  assert.ok(futureCatalog.products.every((product) => product.freshness === "unknown"));
  assert.ok(futureCatalog.products.every((product) => /future/i.test(product.freshnessReason)));

  const everyOtherDayFixture = new TextEncoder().encode(fixtureText.replace("/P1D", "/P2D"));
  const service = new NasaGibsConnectorService({
    repository: new InMemoryNasaGibsRepository(),
    transport: fixtureTransport(everyOtherDayFixture),
    signaturePort: new EphemeralEs256JwsPort(),
    enabled: true,
    now: () => synchronizedAt,
  });
  const synchronized = await service.sync({
    serviceType: "WMTS",
    projection: "EPSG:3857",
    actor: actor(),
    idempotencyKey: "nasa-gibs-period-idempotency-key-0001",
    requestedAt: synchronizedAt,
  });
  assert.equal(synchronized.outcome, "synchronized");
  const product = synchronized.products.find((entry) => entry.nasaLayerId.includes("TrueColor"));
  assert.ok(product);
  await assert.rejects(
    service.issueMapManifest({
      productId: product.id,
      date: "2026-07-11",
      bbox: { west: -1, south: -1, east: 1, north: 1 },
      purpose: "human_review",
      opacity: 1,
      ttlSeconds: 300,
    }, actor()),
    /outside the declared product availability/i,
    "dates inside an interval but off its declared recurrence must be rejected",
  );
});

test("NASA GIBS sync is idempotent and an upstream outage preserves the last valid catalog", async () => {
  const repository = new InMemoryNasaGibsRepository();
  const telemetry = new InMemoryNasaGibsTelemetry();
  const service = new NasaGibsConnectorService({
    repository,
    transport: fixtureTransport(),
    telemetry,
    enabled: true,
    now: () => synchronizedAt,
  });
  const command = {
    serviceType: "WMTS" as const,
    projection: "EPSG:3857" as const,
    actor: actor(),
    idempotencyKey: "nasa-gibs-test-idempotency-key-0002",
    requestedAt: synchronizedAt,
  };
  const first = await service.sync(command);
  const replay = await service.sync({
    ...command,
    requestedAt: "2026-07-13T12:01:00.000Z",
  });
  assert.equal(first.outcome, "synchronized");
  assert.equal(replay.outcome, "synchronized");
  assert.equal(replay.replayed, true);

  const outageService = new NasaGibsConnectorService({
    repository,
    transport: async () => {
      throw new Error("synthetic NASA outage");
    },
    telemetry,
    enabled: true,
    now: () => "2026-07-13T12:05:00.000Z",
  });
  const outage = await outageService.sync({ ...command, idempotencyKey: "nasa-gibs-test-idempotency-key-0003", requestedAt: "2026-07-13T12:05:00.000Z" });
  assert.equal(outage.outcome, "outage");
  assert.equal(outage.errorCode, "UPSTREAM_STATUS");
  assert.ok(outage.lastValidSnapshot);
  assert.equal(outage.staleProducts.length, 2);
  assert.ok(outage.staleProducts.every((product) => product.freshness === "outage"));
  assert.equal(telemetry.snapshot().nasa_gibs_sync_failures_total, 1);
});

test("concurrent NASA GIBS sync returns the one durable catalog and marks the exact replay", async () => {
  const repository = new InMemoryNasaGibsRepository();
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const transport = async () => {
    arrivals += 1;
    if (arrivals === 2) release();
    await barrier;
    return new Response(wmtsFixture, {
      status: 200,
      headers: { "content-type": "application/xml", "content-length": String(wmtsFixture.byteLength) },
    });
  };
  const leftService = new NasaGibsConnectorService({ repository, transport, enabled: true });
  const rightService = new NasaGibsConnectorService({ repository, transport, enabled: true });
  const command = {
    serviceType: "WMTS" as const,
    projection: "EPSG:3857" as const,
    actor: actor(),
    idempotencyKey: "nasa-gibs-concurrent-idempotency-key-0001",
    requestedAt: synchronizedAt,
  };
  const [left, right] = await Promise.all([leftService.sync(command), rightService.sync(command)]);
  if (left.outcome !== "synchronized" || right.outcome !== "synchronized") {
    assert.fail("Concurrent NASA GIBS synchronization must return a durable catalog result.");
  }
  assert.equal(left.snapshot.snapshotRoot, right.snapshot.snapshotRoot);
  assert.deepEqual(
    [left.replayed, right.replayed].sort((a, b) => Number(a) - Number(b)),
    [false, true],
  );
  assert.equal((await repository.listCurrentSnapshots()).length, 1);
});

test("signed NASA map manifests bind product, date, bbox, tenant, expiry, and one-time nonce", async () => {
  const signaturePort = new EphemeralEs256JwsPort();
  const { service, products } = await synchronizedService({ signaturePort });
  const product = products.find((entry) => entry.nasaLayerId.includes("TrueColor"));
  assert.ok(product);
  const manifest = await service.issueMapManifest({
    productId: product.id,
    date: "2026-07-12",
    bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
    purpose: "human_review",
    format: "image/jpeg",
    opacity: 0.8,
    ttlSeconds: 300,
  }, actor());
  assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/);
  assert.ok(manifest.signature);
  assert.equal("url" in manifest, false);
  assert.equal("credentials" in manifest, false);
  assert.match(resolveNasaGibsWmtsTileTemplate(manifest), /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\//);
  assert.equal(
    await service.verifyAndConsumeMapManifest({ ...manifest, signature: "" }, actor().organizationId),
    false,
    "unsigned manifests must fail before nonce consumption",
  );
  assert.equal(
    await service.verifyAndConsumeMapManifest({
      ...manifest,
      auditEvent: { ...manifest.auditEvent, rationale: "A forged audit rationale that was not hash-linked." },
    }, actor().organizationId),
    false,
    "manifest audit metadata must remain hash-linked",
  );
  assert.equal(await service.verifyAndConsumeMapManifest(manifest, actor().organizationId), true);
  assert.equal(await service.verifyAndConsumeMapManifest(manifest, actor().organizationId), false, "manifest nonce must be one-time");

  const tampered = { ...manifest, opacity: 0.2 };
  assert.equal(await service.verifyAndConsumeMapManifest(tampered, actor().organizationId), false);
  await assert.rejects(
    service.issueMapManifest({
      productId: product.id,
      date: "2027-01-01",
      bbox: { west: -1, south: -1, east: 1, north: 1 },
      purpose: "visualization",
      opacity: 1,
    }, actor()),
    /Future NASA GIBS dates are forbidden/,
  );
  await assert.rejects(
    service.issueMapManifest({
      productId: product.id,
      date: "not-a-date",
      bbox: { west: -1, south: -1, east: 1, north: 1 },
      purpose: "visualization",
      opacity: 1,
    }, actor()),
  );
});

test("NASA map manifest issuance rejects a signer output that cannot self-verify", async () => {
  const invalidSigner: NasaGibsManifestSignaturePort = {
    keyId: "kms-invalid-test-key",
    algorithm: "ES256",
    async sign() {
      return "invalid.compact.signature";
    },
    async verify() {
      return false;
    },
  };
  const { service, products } = await synchronizedService({ signaturePort: invalidSigner });
  const product = products.find((entry) => entry.nasaLayerId.includes("TrueColor"));
  assert.ok(product);
  await assert.rejects(
    service.issueMapManifest({
      productId: product.id,
      date: "2026-07-12",
      bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      purpose: "human_review",
      format: "image/jpeg",
      opacity: 0.8,
    }, actor()),
    /External signer returned an invalid signature/,
  );
});

test("signed WMS manifests resolve only to bounded NASA GetMap requests with WMS 1.3 axis order", async () => {
  const signaturePort = new EphemeralEs256JwsPort();
  const service = new NasaGibsConnectorService({
    repository: new InMemoryNasaGibsRepository(),
    transport: fixtureTransport(wmsFixture),
    signaturePort,
    enabled: true,
    now: () => synchronizedAt,
  });
  const sync = await service.sync({
    serviceType: "WMS",
    projection: "EPSG:4326",
    actor: actor(),
    idempotencyKey: "nasa-gibs-wms-idempotency-key-0001",
    requestedAt: synchronizedAt,
  });
  assert.equal(sync.outcome, "synchronized");
  const product = sync.products[0];
  assert.ok(product);
  const manifest = await service.issueMapManifest({
    productId: product.id,
    date: "2026-07-01",
    bbox: { west: -20, south: 10, east: 5, north: 30 },
    purpose: "visualization",
    format: "image/png",
    opacity: 1,
  }, actor());
  const url = new URL(resolveNasaGibsWmsGetMapUrl(manifest, { width: 1_024, height: 512 }));
  assert.equal(url.origin, "https://gibs.earthdata.nasa.gov");
  assert.equal(url.pathname, "/wms/epsg4326/best/wms.cgi");
  assert.equal(url.searchParams.get("SERVICE"), "WMS");
  assert.equal(url.searchParams.get("VERSION"), "1.3.0");
  assert.equal(url.searchParams.get("CRS"), "EPSG:4326");
  assert.equal(url.searchParams.get("BBOX"), "10,-20,30,5");
  assert.equal(url.searchParams.get("LAYERS"), product.nasaLayerId);
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  await assert.rejects(
    Promise.resolve().then(() => resolveNasaGibsWmsGetMapUrl(manifest, { width: 8_192, height: 512 })),
    /WMS width is outside the accepted range/,
  );
});

test("comparison, source-data handoff, and event watch remain contextual and tenant-bound", async () => {
  const { service, products } = await synchronizedService();
  const product = products.find((entry) => entry.nasaLayerId.includes("TrueColor"));
  assert.ok(product);
  const comparison = await service.createComparison({
    productId: product.id,
    projectId: "project_sahel_001",
    beforeDate: "2026-06-01",
    afterDate: "2026-07-12",
    bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
    mode: "SWIPE",
    opacity: 0.7,
  }, actor());
  assert.equal(comparison.authority, "terraproof_observation_context_only");
  assert.equal(comparison.attribution, NASA_GIBS_ACKNOWLEDGEMENT);
  assert.equal(comparison.nonEndorsement, NASA_GIBS_NON_ENDORSEMENT);
  assert.equal(verifyObservationComparison(comparison), true);
  assert.equal(verifyObservationComparison({ ...comparison, afterDate: "2026-07-11" }), false);
  await assert.rejects(
    service.getComparison(comparison.id, actor({ organizationId: "organization_other" })),
    /authenticated organization/,
  );
  await assert.rejects(
    service.createComparison({
      productId: product.id,
      projectId: "project_from_another_organization",
      beforeDate: "2026-06-01",
      afterDate: "2026-07-12",
      bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      mode: "SWIPE",
      opacity: 0.7,
    }, actor()),
    /Project linkage was not found in the authenticated organization/,
  );
  for (const artifactKind of nasaGibsAttributionArtifactKinds) {
    const attribution = await service.comparisonAttribution(comparison.id, artifactKind, actor());
    assert.equal(attribution.artifactKind, artifactKind);
    assert.equal(attribution.attribution, NASA_GIBS_ACKNOWLEDGEMENT);
    assert.equal(attribution.nonEndorsement, NASA_GIBS_NON_ENDORSEMENT);
    assert.equal(attribution.disclosure, "visualization_not_verified_evidence_or_science_data");
    assert.match(attribution.recordHash, /^[a-f0-9]{64}$/);
  }

  const handoff = await service.createSourceDataHandoff({
    visualizationProductId: product.id,
    projectId: "project_sahel_001",
    scienceDatasetRef: "nasa:earthdata:dataset:MODIS-TERRA-L1B",
    collectionRef: "cmr:collection:C123456789-NASA",
    granuleSearchRef: "cmr:granules:C123456789-NASA",
    requestedArea: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
    requestedTime: { start: "2026-06-01", end: "2026-07-12" },
    purpose: "Retrieve separately governed numerical source data for independent research review.",
  }, actor());
  assert.equal(handoff.disclosure, "visualization_is_not_numerical_source_data");
  await assert.rejects(
    service.createSourceDataHandoff({
      visualizationProductId: product.id,
      scienceDatasetRef: "https://evil.example/data",
      collectionRef: "cmr:collection:C123456789-NASA",
      granuleSearchRef: "cmr:granules:C123456789-NASA",
      requestedArea: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      requestedTime: { start: "2026-06-01", end: "2026-07-12" },
      purpose: "Attempt an arbitrary external source reference that must be rejected.",
    }, actor()),
  );

  const watch = await service.createEventWatch({
    productId: product.id,
    projectId: "project_sahel_001",
    watchType: "wildfire",
    bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
    outputs: ["OBSERVATION_SIGNAL", "REVIEW_TASK"],
  }, actor());
  assert.equal(watch.finalAuthority, false);
  assert.deepEqual(watch.outputs, ["OBSERVATION_SIGNAL", "REVIEW_TASK"]);
  await assert.rejects(
    service.createEventWatch({
      productId: product.id,
      watchType: "wildfire",
      bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      outputs: ["VERIFIED_PROOF"],
    }, actor()),
  );
  await assert.rejects(
    service.createEventWatch({
      productId: product.id,
      watchType: "vegetation_change",
      bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
      outputs: ["ESG_CLAIM"],
    }, actor()),
  );
});

test("Worldview actions are constrained external links and connector safety forbids proof laundering", async () => {
  const { products } = await synchronizedService();
  const product = products[0];
  assert.ok(product);
  const link = buildNasaWorldviewLink({
    product,
    date: "2026-07-12",
  });
  const url = new URL(link);
  assert.equal(url.origin, "https://worldview.earthdata.nasa.gov");
  assert.equal(url.searchParams.get("p"), "geographic");
  assert.equal(url.searchParams.get("l"), product.nasaLayerId);

  const arcticEndpoint = resolveNasaGibsServiceEndpoint(nasaGibsEndpointId("WMTS", "EPSG:3413"));
  const arcticProduct = (await parseNasaGibsCapabilities(wmtsFixture, arcticEndpoint, synchronizedAt)).products[0];
  assert.ok(arcticProduct);
  const arcticLink = new URL(buildNasaWorldviewLink({ product: arcticProduct, date: "2026-07-12" }));
  assert.equal(arcticLink.searchParams.get("p"), "arctic");
  assert.deepEqual(nasaGibsSafetyBoundary(), {
    readOnlyExternalConnector: true,
    nasaIsNotProofAuthority: true,
    imageryTilesAreNotScientificSourceData: true,
    noAutomaticEvidencePromotion: true,
    noAutomaticEsgMetric: true,
    noAutomaticFundingDecision: true,
    noPublicEmergencyDeclaration: true,
    noArbitraryServiceUrls: true,
    noCredentialsInManifest: true,
    noWorldviewIframe: true,
    humanReviewStillRequired: true,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    noCertifiedCarbonCreditClaim: true,
    noCarbonTaxOffsetClaim: true,
    noGuaranteedYield: true,
  });
});

test("tile failures increment bounded telemetry without accepting unknown products", async () => {
  const telemetry = new InMemoryNasaGibsTelemetry();
  const { service, products } = await synchronizedService({ telemetry });
  const product = products[0];
  assert.ok(product);
  assert.deepEqual(
    await service.recordTileFailure({ productId: product.id, failureKind: "decode" }, actor()),
    { productId: product.id, failureKind: "decode" },
  );
  assert.equal(telemetry.snapshot().nasa_gibs_tile_failures_total, 1);
  await assert.rejects(
    service.recordTileFailure({ productId: "nasa_gibs_product_missing", failureKind: "network" }, actor()),
    /product was not found/,
  );
  assert.equal(telemetry.snapshot().nasa_gibs_tile_failures_total, 1);
});

test("connector remains disabled by default and sync requires explicit capability", async () => {
  const repository = new InMemoryNasaGibsRepository();
  const disabled = new NasaGibsConnectorService({ repository, transport: fixtureTransport() });
  assert.equal((await disabled.status()).sourceState, "disabled");
  await assert.rejects(
    disabled.listProducts(),
    (error: unknown) => error instanceof NasaGibsError && error.httpStatus === 503,
  );

  const enabled = new NasaGibsConnectorService({ repository, transport: fixtureTransport(), enabled: true });
  await assert.rejects(
    enabled.sync({
      serviceType: "WMTS",
      projection: "EPSG:3857",
      actor: actor({ capabilities: [] }),
      idempotencyKey: "nasa-gibs-test-idempotency-key-0004",
      requestedAt: synchronizedAt,
    }),
    /AUTHORIZATION_DENIED/,
  );
});
