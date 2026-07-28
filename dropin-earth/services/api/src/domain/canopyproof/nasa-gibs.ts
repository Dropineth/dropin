import { hashJson } from "@dropin/crypto";
import { compactVerify } from "jose";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const nasaGibsProjections = ["EPSG:4326", "EPSG:3857", "EPSG:3413", "EPSG:3031"] as const;
export const nasaGibsServiceTypes = ["WMTS", "WMS"] as const;
export const nasaGibsComparisonModes = ["SIDE_BY_SIDE", "SWIPE", "OPACITY", "ANIMATION"] as const;
export const nasaGibsEventWatchTypes = [
  "wildfire",
  "flood",
  "drought",
  "dust",
  "air_quality",
  "storm",
  "snow_ice",
  "vegetation_change",
] as const;
export const nasaGibsAllowedWatchOutputs = ["OBSERVATION_SIGNAL", "RISK_CANDIDATE", "REVIEW_TASK"] as const;
export const nasaGibsForbiddenWatchOutputs = [
  "PUBLIC_EMERGENCY",
  "VERIFIED_PROOF",
  "ESG_CLAIM",
  "FUNDING_DECISION",
] as const;
export const nasaGibsFreshnessStates = ["current", "stale", "unknown", "outage"] as const;
export const nasaGibsAttributionArtifactKinds = [
  "comparison_report",
  "screenshot_metadata",
  "export_bundle",
  "institutional_report_appendix",
] as const;
export const nasaGibsSyncErrorCodes = [
  "TIMEOUT",
  "UPSTREAM_STATUS",
  "CONTENT_TYPE",
  "OVERSIZED",
  "MALFORMED_XML",
  "UNSUPPORTED_SCHEMA",
  "CATALOG_INVARIANT",
  "ENDPOINT_DENIED",
  "AUTHORIZATION_DENIED",
] as const;

export type NasaGibsProjection = (typeof nasaGibsProjections)[number];
export type NasaGibsServiceType = (typeof nasaGibsServiceTypes)[number];
export type NasaGibsComparisonMode = (typeof nasaGibsComparisonModes)[number];
export type NasaGibsEventWatchType = (typeof nasaGibsEventWatchTypes)[number];
export type NasaGibsAllowedWatchOutput = (typeof nasaGibsAllowedWatchOutputs)[number];
export type NasaGibsFreshnessState = (typeof nasaGibsFreshnessStates)[number];
export type NasaGibsAttributionArtifactKind = (typeof nasaGibsAttributionArtifactKinds)[number];
export type NasaGibsSyncErrorCode = (typeof nasaGibsSyncErrorCodes)[number];

export const NASA_GIBS_HOST = "gibs.earthdata.nasa.gov";
export const NASA_WORLDVIEW_ORIGIN = "https://worldview.earthdata.nasa.gov";
export const NASA_GIBS_ACKNOWLEDGEMENT =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";
export const NASA_GIBS_NON_ENDORSEMENT =
  "NASA does not endorse CanopyProof, TerraProof, their interpretations, reports, certificates, funding decisions, or services.";
export const NASA_GIBS_DEFAULT_MAX_CAPABILITIES_BYTES = 8 * 1024 * 1024;
export const NASA_GIBS_DEFAULT_TIMEOUT_MS = 15_000;
export const NASA_GIBS_MANIFEST_MAX_TTL_SECONDS = 15 * 60;

const MAX_LAYER_COUNT = 5_000;
const MAX_STRING_LENGTH = 4_096;
const MAX_FORMAT_COUNT = 16;
const MAX_MATRIX_SET_COUNT = 16;
const MAX_TEMPORAL_VALUE_COUNT = 500;
const MAX_PRODUCTS_PER_SNAPSHOT = 12_000;
const LAYER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;
const MATRIX_SET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const NONCE_PATTERN = /^[a-f0-9]{48}$/;
const OPAQUE_REFERENCE_PATTERN = /^(?:nasa:earthdata|cmr):(collection|granules|dataset):[A-Za-z0-9][A-Za-z0-9_.:/-]{0,511}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/;

export type NasaGibsBoundingBox = {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

export type NasaGibsTemporalExtent = {
  readonly start: string;
  readonly end: string;
  readonly period?: string;
  readonly sourceValue: string;
};

export type NasaGibsServiceEndpoint = {
  readonly id: string;
  readonly host: typeof NASA_GIBS_HOST;
  readonly serviceType: NasaGibsServiceType;
  readonly projection: NasaGibsProjection;
  readonly collection: "best";
  readonly capabilitiesUrl: string;
};

export type NasaGibsLayerAvailability = {
  readonly productId: string;
  readonly sourceCapabilitiesHash: string;
  readonly defaultDate?: string;
  readonly temporalExtents: readonly NasaGibsTemporalExtent[];
  readonly availableDates: readonly string[];
  readonly latestAvailableAt?: string;
  readonly completeness: "capabilities_recent_window" | "static" | "unknown";
  readonly synchronizedAt: string;
};

export type NasaGibsProduct = {
  readonly id: string;
  readonly nasaLayerId: string;
  readonly title: string;
  readonly description: string;
  readonly serviceType: NasaGibsServiceType;
  readonly projection: NasaGibsProjection;
  readonly tileMatrixSet?: string;
  readonly formats: readonly string[];
  readonly temporalExtent: readonly NasaGibsTemporalExtent[];
  readonly availableDates: readonly string[];
  readonly defaultDate?: string;
  readonly sourceEndpointId: string;
  readonly sourceCapabilitiesHash: string;
  readonly attribution: typeof NASA_GIBS_ACKNOWLEDGEMENT;
  readonly nonEndorsement: typeof NASA_GIBS_NON_ENDORSEMENT;
  readonly observedOrPublishedAt?: string;
  readonly freshness: NasaGibsFreshnessState;
  readonly freshnessReason: string;
  readonly synchronizedAt: string;
};

export type NasaGibsCatalogSnapshot = {
  readonly id: string;
  readonly endpointId: string;
  readonly serviceType: NasaGibsServiceType;
  readonly projection: NasaGibsProjection;
  readonly sourceCapabilitiesHash: string;
  readonly productCount: number;
  readonly productIds: readonly string[];
  readonly synchronizedAt: string;
  readonly snapshotRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type NasaGibsSyncFailure = {
  readonly id: string;
  readonly endpointId: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly errorCode: NasaGibsSyncErrorCode;
  readonly failedAt: string;
  readonly failureRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type NasaGibsActor = {
  readonly id: string;
  readonly organizationId: string;
  readonly role: "administrator" | "owner" | "admin" | "agent" | "researcher" | "verifier" | "community" | "observer";
  readonly capabilities: readonly string[];
};

export type NasaGibsSyncCommand = {
  readonly serviceType: NasaGibsServiceType;
  readonly projection: NasaGibsProjection;
  readonly actor: NasaGibsActor;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
};

export type NasaGibsSyncResult =
  | {
      readonly outcome: "synchronized";
      readonly snapshot: NasaGibsCatalogSnapshot;
      readonly products: readonly NasaGibsProduct[];
      readonly replayed: boolean;
    }
  | {
      readonly outcome: "outage";
      readonly endpointId: string;
      readonly errorCode: NasaGibsSyncErrorCode;
      readonly lastValidSnapshot?: NasaGibsCatalogSnapshot;
      readonly staleProducts: readonly NasaGibsProduct[];
      readonly failure: NasaGibsSyncFailure;
    };

export type NasaGibsConnectorStatus = {
  readonly service: "canopyproof-terraproof-nasa-gibs";
  readonly enabled: boolean;
  readonly storage: "postgresql" | "test-memory" | "unconfigured";
  readonly currentSnapshotCount: number;
  readonly productCount: number;
  readonly staleProductCount: number;
  readonly lastSynchronizedAt?: string;
  readonly lastFailureAt?: string;
  readonly sourceState: "ready" | "stale" | "outage" | "not_synchronized" | "disabled";
  readonly implementationGate: "non_production_only";
  readonly safety: ReturnType<typeof nasaGibsSafetyBoundary>;
};

export type NasaGibsParsedCapabilities = {
  readonly sourceCapabilitiesHash: string;
  readonly products: readonly NasaGibsProduct[];
  readonly availability: readonly NasaGibsLayerAvailability[];
};

export class NasaGibsError extends Error {
  constructor(
    readonly code: NasaGibsSyncErrorCode,
    message: string,
    readonly httpStatus: 400 | 403 | 404 | 409 | 413 | 422 | 502 | 503 = 422,
  ) {
    super(`${code}: ${message}`);
    this.name = "NasaGibsError";
  }
}

export function nasaGibsSafetyBoundary() {
  return {
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
  } as const;
}

const projectionPath: Record<NasaGibsProjection, string> = {
  "EPSG:4326": "epsg4326",
  "EPSG:3857": "epsg3857",
  "EPSG:3413": "epsg3413",
  "EPSG:3031": "epsg3031",
};

const worldviewProjection: Record<NasaGibsProjection, "geographic" | "arctic" | "antarctic"> = {
  "EPSG:4326": "geographic",
  "EPSG:3857": "geographic",
  "EPSG:3413": "arctic",
  "EPSG:3031": "antarctic",
};

const endpointRegistry = new Map<string, NasaGibsServiceEndpoint>();
for (const serviceType of nasaGibsServiceTypes) {
  for (const projection of nasaGibsProjections) {
    const path = projectionPath[projection];
    const servicePath = serviceType.toLowerCase();
    const id = `nasa-gibs-${servicePath}-${path}-best`;
    const capabilitiesUrl =
      serviceType === "WMTS"
        ? `https://${NASA_GIBS_HOST}/wmts/${path}/best/1.0.0/WMTSCapabilities.xml`
        : `https://${NASA_GIBS_HOST}/wms/${path}/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`;
    endpointRegistry.set(id, Object.freeze({
      id,
      host: NASA_GIBS_HOST,
      serviceType,
      projection,
      collection: "best",
      capabilitiesUrl,
    }));
  }
}

export function listNasaGibsServiceEndpoints(): readonly Omit<NasaGibsServiceEndpoint, "capabilitiesUrl">[] {
  return [...endpointRegistry.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((endpoint) => ({
      id: endpoint.id,
      host: endpoint.host,
      serviceType: endpoint.serviceType,
      projection: endpoint.projection,
      collection: endpoint.collection,
    }));
}

export function nasaGibsEndpointId(serviceType: NasaGibsServiceType, projection: NasaGibsProjection) {
  return `nasa-gibs-${serviceType.toLowerCase()}-${projectionPath[projection]}-best`;
}

export function resolveNasaGibsServiceEndpoint(endpointId: string): NasaGibsServiceEndpoint {
  const endpoint = endpointRegistry.get(endpointId);
  if (!endpoint) {
    throw new NasaGibsError("ENDPOINT_DENIED", "The requested endpoint is not in the immutable NASA GIBS registry.", 403);
  }
  const url = new URL(endpoint.capabilitiesUrl);
  if (url.protocol !== "https:" || url.hostname !== NASA_GIBS_HOST || url.username || url.password) {
    throw new NasaGibsError("ENDPOINT_DENIED", "The configured endpoint violates the NASA GIBS egress policy.", 503);
  }
  return endpoint;
}

export type NasaGibsHttpTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export async function fetchNasaGibsCapabilities(
  endpoint: NasaGibsServiceEndpoint,
  transport: NasaGibsHttpTransport = fetch,
  options: {
    readonly maxBytes?: number;
    readonly timeoutMs?: number;
  } = {},
): Promise<Uint8Array> {
  const approved = resolveNasaGibsServiceEndpoint(endpoint.id);
  if (approved.capabilitiesUrl !== endpoint.capabilitiesUrl) {
    throw new NasaGibsError("ENDPOINT_DENIED", "Caller-supplied NASA endpoint configuration is forbidden.", 403);
  }
  const maxBytes = boundedPositiveInteger(
    options.maxBytes ?? NASA_GIBS_DEFAULT_MAX_CAPABILITIES_BYTES,
    1_024,
    32 * 1024 * 1024,
    "maxBytes",
  );
  const timeoutMs = boundedPositiveInteger(
    options.timeoutMs ?? NASA_GIBS_DEFAULT_TIMEOUT_MS,
    100,
    60_000,
    "timeoutMs",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("NASA GIBS capabilities timeout"), timeoutMs);
  let response: Response;
  try {
    response = await transport(approved.capabilitiesUrl, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "application/xml,text/xml;q=0.9",
        "user-agent": "CanopyProof-TerraProof-NASA-GIBS/1.0",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new NasaGibsError("TIMEOUT", "NASA GIBS capabilities request timed out.", 503);
    }
    throw new NasaGibsError("UPSTREAM_STATUS", "NASA GIBS capabilities request failed.", 503);
  }
  try {
    if (!response.ok) {
      throw new NasaGibsError("UPSTREAM_STATUS", `NASA GIBS returned HTTP ${response.status}.`, 503);
    }
    const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!mediaType || !["application/xml", "text/xml", "application/vnd.ogc.wmts_xml"].includes(mediaType)) {
      throw new NasaGibsError("CONTENT_TYPE", "NASA GIBS returned an unexpected content type.", 502);
    }
    const declaredLength = response.headers.get("content-length");
    if (declaredLength) {
      const value = Number(declaredLength);
      if (!Number.isSafeInteger(value) || value < 0 || value > maxBytes) {
        throw new NasaGibsError("OVERSIZED", "NASA GIBS capabilities exceeds the configured byte limit.", 413);
      }
    }
    if (!response.body) {
      throw new NasaGibsError("MALFORMED_XML", "NASA GIBS capabilities response has no body.", 502);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("capabilities byte limit exceeded");
        throw new NasaGibsError("OVERSIZED", "NASA GIBS capabilities exceeds the configured byte limit.", 413);
      }
      chunks.push(result.value);
    }
    if (totalBytes === 0) {
      throw new NasaGibsError("MALFORMED_XML", "NASA GIBS capabilities response is empty.", 502);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    if (error instanceof NasaGibsError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new NasaGibsError("TIMEOUT", "NASA GIBS capabilities response body timed out.", 503);
    }
    throw new NasaGibsError("UPSTREAM_STATUS", "NASA GIBS capabilities response body failed.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseNasaGibsCapabilities(
  bytes: Uint8Array,
  endpoint: NasaGibsServiceEndpoint,
  synchronizedAt: string,
): Promise<NasaGibsParsedCapabilities> {
  const approvedEndpoint = resolveNasaGibsServiceEndpoint(endpoint.id);
  if (
    approvedEndpoint.host !== endpoint.host ||
    approvedEndpoint.serviceType !== endpoint.serviceType ||
    approvedEndpoint.projection !== endpoint.projection ||
    approvedEndpoint.collection !== endpoint.collection ||
    approvedEndpoint.capabilitiesUrl !== endpoint.capabilitiesUrl
  ) {
    throw new NasaGibsError("ENDPOINT_DENIED", "Caller-supplied NASA endpoint configuration is forbidden.", 403);
  }
  const synchronizedDate = requireIsoInstant(synchronizedAt, "synchronizedAt");
  if (bytes.byteLength === 0 || bytes.byteLength > 32 * 1024 * 1024) {
    throw new NasaGibsError("OVERSIZED", "NASA GIBS capabilities bytes are empty or exceed the parser ceiling.", 413);
  }
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new NasaGibsError("MALFORMED_XML", "NASA GIBS capabilities is not valid UTF-8.", 422);
  }
  rejectDangerousXml(xml);
  const validation = XMLValidator.validate(xml, {
    allowBooleanAttributes: false,
    unpairedTags: [],
  });
  if (validation !== true) {
    throw new NasaGibsError("MALFORMED_XML", "NASA GIBS capabilities XML is not well formed.", 422);
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    allowBooleanAttributes: false,
    processEntities: false,
  });
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new NasaGibsError("MALFORMED_XML", "NASA GIBS capabilities XML could not be parsed.", 422);
  }
  const sourceCapabilitiesHash = await sha256Hex(bytes);
  const products = endpoint.serviceType === "WMTS"
    ? normalizeWmtsCapabilities(parsed, endpoint, sourceCapabilitiesHash, synchronizedDate)
    : normalizeWmsCapabilities(parsed, endpoint, sourceCapabilitiesHash, synchronizedDate);
  if (products.length === 0 || products.length > MAX_PRODUCTS_PER_SNAPSHOT) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS candidate catalog has an invalid product count.", 422);
  }
  const ids = new Set(products.map((product) => product.id));
  if (ids.size !== products.length) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS candidate catalog contains duplicate product IDs.", 422);
  }
  const availability = products.map<NasaGibsLayerAvailability>((product) => ({
    productId: product.id,
    sourceCapabilitiesHash,
    ...(product.defaultDate ? { defaultDate: product.defaultDate } : {}),
    temporalExtents: product.temporalExtent,
    availableDates: product.availableDates,
    ...(product.observedOrPublishedAt ? { latestAvailableAt: product.observedOrPublishedAt } : {}),
    completeness: product.temporalExtent.length > 0 || product.availableDates.length > 0
      ? "capabilities_recent_window"
      : "static",
    synchronizedAt: synchronizedDate,
  }));
  return { sourceCapabilitiesHash, products, availability };
}

function normalizeWmtsCapabilities(
  document: unknown,
  endpoint: NasaGibsServiceEndpoint,
  sourceCapabilitiesHash: string,
  synchronizedAt: string,
): readonly NasaGibsProduct[] {
  const root = requiredRecord(requiredRecord(document, "document").Capabilities, "WMTS Capabilities");
  const version = boundedAttribute(root, "version", 16);
  if (version !== "1.0.0") {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", "Only WMTS 1.0.0 capabilities are supported.", 422);
  }
  const contents = requiredRecord(root.Contents, "WMTS Contents");
  const layers = asArray(contents.Layer);
  if (layers.length === 0 || layers.length > MAX_LAYER_COUNT) {
    throw new NasaGibsError("CATALOG_INVARIANT", "WMTS layer count is outside the accepted range.", 422);
  }
  const products: NasaGibsProduct[] = [];
  for (const layerValue of layers) {
    const layer = requiredRecord(layerValue, "WMTS Layer");
    const nasaLayerId = boundedIdentifier(textValue(layer.Identifier), "WMTS layer identifier", LAYER_ID_PATTERN);
    const title = boundedText(textValue(layer.Title) || nasaLayerId, "WMTS layer title");
    const description = boundedText(textValue(layer.Abstract) || "NASA GIBS visualization layer.", "WMTS layer description");
    const formats = boundedUniqueStrings(asArray(layer.Format).map(textValue).filter(Boolean), "WMTS formats", MAX_FORMAT_COUNT)
      .filter(isSupportedImageFormat);
    if (formats.length === 0) continue;
    const matrixSets = boundedUniqueStrings(
      asArray(layer.TileMatrixSetLink)
        .map((link) => textValue(requiredRecord(link, "WMTS TileMatrixSetLink").TileMatrixSet))
        .filter(Boolean),
      "WMTS tile matrix sets",
      MAX_MATRIX_SET_COUNT,
    ).filter((matrixSet) => MATRIX_SET_PATTERN.test(matrixSet));
    if (matrixSets.length === 0) continue;
    const temporal = wmtsTemporal(layer.Dimension);
    for (const tileMatrixSet of matrixSets) {
      products.push(buildProduct({
        nasaLayerId,
        title,
        description,
        formats,
        tileMatrixSet,
        temporal,
        endpoint,
        sourceCapabilitiesHash,
        synchronizedAt,
      }));
    }
  }
  return products.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeWmsCapabilities(
  document: unknown,
  endpoint: NasaGibsServiceEndpoint,
  sourceCapabilitiesHash: string,
  synchronizedAt: string,
): readonly NasaGibsProduct[] {
  const documentRecord = requiredRecord(document, "document");
  const rootValue = documentRecord.WMS_Capabilities ?? documentRecord.WMT_MS_Capabilities;
  const root = requiredRecord(rootValue, "WMS Capabilities");
  const version = boundedAttribute(root, "version", 16);
  if (version !== "1.3.0" && version !== "1.1.1") {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", "Only WMS 1.3.0 and 1.1.1 capabilities are supported.", 422);
  }
  const capability = requiredRecord(root.Capability, "WMS Capability");
  const request = requiredRecord(capability.Request, "WMS Request");
  const getMap = requiredRecord(request.GetMap, "WMS GetMap");
  const formats = boundedUniqueStrings(asArray(getMap.Format).map(textValue).filter(Boolean), "WMS formats", MAX_FORMAT_COUNT)
    .filter(isSupportedImageFormat);
  if (formats.length === 0) {
    throw new NasaGibsError("CATALOG_INVARIANT", "WMS GetMap has no supported image format.", 422);
  }
  const layers = flattenWmsLayers(requiredRecord(capability.Layer, "WMS root layer"));
  if (layers.length === 0 || layers.length > MAX_LAYER_COUNT) {
    throw new NasaGibsError("CATALOG_INVARIANT", "WMS layer count is outside the accepted range.", 422);
  }
  const products: NasaGibsProduct[] = [];
  for (const layer of layers) {
    const name = textValue(layer.Name);
    if (!name || !LAYER_ID_PATTERN.test(name)) continue;
    const crsValues = boundedUniqueStrings(
      [...asArray(layer.CRS), ...asArray(layer.SRS)].map(textValue).filter(Boolean),
      "WMS CRS values",
      32,
    );
    if (crsValues.length > 0 && !crsValues.includes(endpoint.projection)) continue;
    products.push(buildProduct({
      nasaLayerId: name,
      title: boundedText(textValue(layer.Title) || name, "WMS layer title"),
      description: boundedText(textValue(layer.Abstract) || "NASA GIBS visualization layer.", "WMS layer description"),
      formats,
      temporal: wmsTemporal(layer),
      endpoint,
      sourceCapabilitiesHash,
      synchronizedAt,
    }));
  }
  return products.sort((left, right) => left.id.localeCompare(right.id));
}

type ProductSeed = {
  readonly nasaLayerId: string;
  readonly title: string;
  readonly description: string;
  readonly formats: readonly string[];
  readonly tileMatrixSet?: string;
  readonly temporal: ParsedTemporal;
  readonly endpoint: NasaGibsServiceEndpoint;
  readonly sourceCapabilitiesHash: string;
  readonly synchronizedAt: string;
};

type ParsedTemporal = {
  readonly defaultDate?: string;
  readonly extents: readonly NasaGibsTemporalExtent[];
  readonly dates: readonly string[];
};

function buildProduct(seed: ProductSeed): NasaGibsProduct {
  const variantSeed = {
    nasaLayerId: seed.nasaLayerId,
    serviceType: seed.endpoint.serviceType,
    projection: seed.endpoint.projection,
    tileMatrixSet: seed.tileMatrixSet ?? null,
  };
  const id = `nasa_gibs_product_${hashJson({ kind: "nasa-gibs-product-variant-v1", ...variantSeed }).slice(0, 24)}`;
  const latest = latestTemporalValue(seed.temporal);
  const freshness = productFreshness(latest, seed.synchronizedAt);
  return {
    id,
    nasaLayerId: seed.nasaLayerId,
    title: seed.title,
    description: seed.description,
    serviceType: seed.endpoint.serviceType,
    projection: seed.endpoint.projection,
    ...(seed.tileMatrixSet ? { tileMatrixSet: seed.tileMatrixSet } : {}),
    formats: [...seed.formats].sort(),
    temporalExtent: seed.temporal.extents,
    availableDates: seed.temporal.dates,
    ...(seed.temporal.defaultDate ? { defaultDate: seed.temporal.defaultDate } : {}),
    sourceEndpointId: seed.endpoint.id,
    sourceCapabilitiesHash: seed.sourceCapabilitiesHash,
    attribution: NASA_GIBS_ACKNOWLEDGEMENT,
    nonEndorsement: NASA_GIBS_NON_ENDORSEMENT,
    ...(latest ? { observedOrPublishedAt: latest } : {}),
    freshness: freshness.state,
    freshnessReason: freshness.reason,
    synchronizedAt: seed.synchronizedAt,
  };
}

function wmtsTemporal(value: unknown): ParsedTemporal {
  const dimensions = asArray(value).map((entry) => requiredRecord(entry, "WMTS Dimension"));
  const time = dimensions.find((dimension) => textValue(dimension.Identifier).toLowerCase() === "time");
  if (!time) return { extents: [], dates: [] };
  const values = boundedUniqueStrings(
    asArray(time.Value).map(textValue).filter(Boolean),
    "WMTS temporal values",
    MAX_TEMPORAL_VALUE_COUNT,
  );
  return parseTemporalValues(values, textValue(time.Default));
}

function wmsTemporal(layer: Record<string, unknown>): ParsedTemporal {
  const candidates = [...asArray(layer.Dimension), ...asArray(layer.Extent)]
    .map((entry) => (typeof entry === "string" ? { "#text": entry } : requiredRecord(entry, "WMS time dimension")))
    .filter((entry) => boundedAttribute(entry, "name", 64).toLowerCase() === "time");
  const candidate = candidates[0];
  if (!candidate) return { extents: [], dates: [] };
  const raw = textValue(candidate["#text"] ?? candidate);
  const values = boundedUniqueStrings(raw.split(",").map((entry) => entry.trim()).filter(Boolean), "WMS temporal values", MAX_TEMPORAL_VALUE_COUNT);
  return parseTemporalValues(values, boundedAttribute(candidate, "default", 64));
}

function parseTemporalValues(values: readonly string[], defaultValue: string): ParsedTemporal {
  const dates: string[] = [];
  const extents: NasaGibsTemporalExtent[] = [];
  for (const sourceValue of values) {
    const parts = sourceValue.split("/");
    if (parts.length === 1) {
      dates.push(requireNasaDate(parts[0]!, "temporal date"));
      continue;
    }
    if (parts.length !== 2 && parts.length !== 3) {
      throw new NasaGibsError("UNSUPPORTED_SCHEMA", "NASA GIBS temporal interval has an unsupported grammar.", 422);
    }
    const start = requireNasaDate(parts[0]!, "temporal interval start");
    const end = requireNasaDate(parts[1]!, "temporal interval end");
    if (Date.parse(start) > Date.parse(end)) {
      throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS temporal interval is reversed.", 422);
    }
    const period = parts[2];
    if (period) parseTemporalPeriod(period);
    extents.push({ start, end, ...(period ? { period } : {}), sourceValue });
  }
  const normalizedDefault = defaultValue ? requireNasaDate(defaultValue, "default date") : undefined;
  const normalizedExtents = extents.sort((left, right) => left.start.localeCompare(right.start));
  const normalizedDates = [...new Set(dates)].sort();
  if (normalizedDefault && !temporalValueAvailable(normalizedDates, normalizedExtents, normalizedDefault)) {
    throw new NasaGibsError(
      "CATALOG_INVARIANT",
      "NASA GIBS default date is outside the declared temporal availability.",
      422,
    );
  }
  return {
    ...(normalizedDefault ? { defaultDate: normalizedDefault } : {}),
    extents: normalizedExtents,
    dates: normalizedDates,
  };
}

function flattenWmsLayers(root: Record<string, unknown>): readonly Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  const queue = [root];
  let visited = 0;
  while (queue.length > 0) {
    const layer = queue.shift()!;
    visited += 1;
    if (visited > MAX_LAYER_COUNT + 1) {
      throw new NasaGibsError("CATALOG_INVARIANT", "WMS layer nesting exceeds the accepted count.", 422);
    }
    if (textValue(layer.Name)) output.push(layer);
    for (const child of asArray(layer.Layer)) queue.push(requiredRecord(child, "WMS child layer"));
  }
  return output;
}

function rejectDangerousXml(xml: string) {
  if (xml.includes("\u0000")) {
    throw new NasaGibsError("MALFORMED_XML", "NASA GIBS capabilities contains a NUL byte.", 422);
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)|<\s*(?:xi:)?include\b/i.test(xml)) {
    throw new NasaGibsError("MALFORMED_XML", "DTD, entity, and XInclude constructs are forbidden.", 422);
  }
  const withoutDeclaration = xml.replace(/^\uFEFF?\s*<\?xml\s[^?]*\?>/i, "");
  if (/<\?/.test(withoutDeclaration)) {
    throw new NasaGibsError("MALFORMED_XML", "XML processing instructions are forbidden.", 422);
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", `${label} must be an XML object.`, 422);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const text = (value as Record<string, unknown>)["#text"];
    return typeof text === "string" || typeof text === "number" ? String(text).trim() : "";
  }
  return "";
}

function boundedAttribute(record: Record<string, unknown>, name: string, maxLength: number): string {
  const value = textValue(record[`@_${name}`]);
  if (value.length > maxLength) {
    throw new NasaGibsError("CATALOG_INVARIANT", `XML attribute ${name} exceeds its accepted length.`, 422);
  }
  return value;
}

function boundedIdentifier(value: string, label: string, pattern: RegExp): string {
  if (!pattern.test(value)) {
    throw new NasaGibsError("CATALOG_INVARIANT", `${label} is invalid.`, 422);
  }
  return value;
}

function boundedText(value: string, label: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > MAX_STRING_LENGTH) {
    throw new NasaGibsError("CATALOG_INVARIANT", `${label} is empty or exceeds its accepted length.`, 422);
  }
  return normalized;
}

function boundedUniqueStrings(values: readonly string[], label: string, maxCount: number): string[] {
  if (values.length > maxCount) {
    throw new NasaGibsError("CATALOG_INVARIANT", `${label} exceeds its accepted count.`, 422);
  }
  for (const value of values) {
    if (!value || value.length > MAX_STRING_LENGTH) {
      throw new NasaGibsError("CATALOG_INVARIANT", `${label} contains an invalid value.`, 422);
    }
  }
  return [...new Set(values)].sort();
}

function isSupportedImageFormat(value: string) {
  return value === "image/png" || value === "image/jpeg" || value === "image/jpg" || value === "image/webp";
}

function requireNasaDate(value: string, label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z)?$/.exec(value);
  if (!match) {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", `NASA GIBS ${label} is invalid.`, 422);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText ?? 0);
  const minute = Number(minuteText ?? 0);
  const second = Number(secondText ?? 0);
  const millisecond = Number((fractionText ?? "").padEnd(3, "0") || 0);
  const instant = new Date(0);
  instant.setUTCHours(hour, minute, second, millisecond);
  instant.setUTCFullYear(year, month - 1, day);
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day ||
    instant.getUTCHours() !== hour ||
    instant.getUTCMinutes() !== minute ||
    instant.getUTCSeconds() !== second ||
    instant.getUTCMilliseconds() !== millisecond
  ) {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", `NASA GIBS ${label} is invalid.`, 422);
  }
  return value;
}

function requireIsoInstant(value: string, label: string): string {
  const parsed = z.string().datetime({ offset: false }).safeParse(value);
  if (!parsed.success) throw new NasaGibsError("CATALOG_INVARIANT", `${label} must be an ISO-8601 UTC instant.`, 422);
  return parsed.data;
}

function latestTemporalValue(temporal: ParsedTemporal): string | undefined {
  const candidates = [
    ...temporal.dates,
    ...temporal.extents.map((extent) => extent.end),
    ...(temporal.defaultDate ? [temporal.defaultDate] : []),
  ];
  return candidates.sort((left, right) => left.localeCompare(right)).at(-1);
}

function productFreshness(latest: string | undefined, synchronizedAt: string): { state: NasaGibsFreshnessState; reason: string } {
  if (!latest) return { state: "unknown", reason: "The source capabilities does not declare a temporal extent." };
  const ageMs = Date.parse(synchronizedAt) - Date.parse(latest);
  if (ageMs < -5 * 60_000) {
    return { state: "unknown", reason: "The latest declared source period is in the future relative to catalog synchronization." };
  }
  if (ageMs <= 14 * 24 * 60 * 60 * 1_000) {
    return { state: "current", reason: "The latest declared source period is within fourteen days of catalog synchronization." };
  }
  return {
    state: "stale",
    reason: "The latest declared source period is older than fourteen days; this may be an intentionally historical product.",
  };
}

function boundedPositiveInteger(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new NasaGibsError("CATALOG_INVARIANT", `${label} is outside the accepted range.`, 422);
  }
  return value;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = Uint8Array.from(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type NasaGibsMapManifestPayload = {
  readonly version: "nasa-gibs-map-manifest-v1";
  readonly organizationId: string;
  readonly actorId: string;
  readonly purpose: "visualization" | "historical_comparison" | "human_review";
  readonly productId: string;
  readonly nasaLayerId: string;
  readonly date: string;
  readonly projection: NasaGibsProjection;
  readonly bbox: NasaGibsBoundingBox;
  readonly serviceType: NasaGibsServiceType;
  readonly endpointId: string;
  readonly templateId: "gibs-wmts-rest-v1" | "gibs-wms-getmap-v1";
  readonly tileMatrixSet?: string;
  readonly format: string;
  readonly opacity: number;
  readonly sourceCapabilitiesHash: string;
  readonly observedOrPublishedAt?: string;
  readonly freshness: NasaGibsFreshnessState;
  readonly attribution: typeof NASA_GIBS_ACKNOWLEDGEMENT;
  readonly nonEndorsement: typeof NASA_GIBS_NON_ENDORSEMENT;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly keyId: string;
};

export type NasaGibsMapManifest = NasaGibsMapManifestPayload & {
  readonly manifestHash: string;
  readonly signature: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type NasaGibsManifestSignaturePort = {
  readonly keyId: string;
  readonly algorithm: "ES256" | "EdDSA" | "RS256";
  sign(payload: Uint8Array): Promise<string>;
  verify(payload: Uint8Array, compactJws: string, keyId: string): Promise<boolean>;
};

export type NasaGibsPublicKeyResolver = (
  keyId: string,
  algorithm: NasaGibsManifestSignaturePort["algorithm"],
) => Promise<CryptoKey | Uint8Array>;

export class NasaGibsPublicJwsVerifier {
  constructor(
    private readonly resolvePublicKey: NasaGibsPublicKeyResolver,
    private readonly acceptedAlgorithms: readonly NasaGibsManifestSignaturePort["algorithm"][] = ["ES256", "EdDSA", "RS256"],
  ) {}

  async verify(payload: Uint8Array, compactJws: string, expectedKeyId: string): Promise<boolean> {
    if (!compactJws || compactJws.length > 16_384) return false;
    try {
      const [protectedSegment] = compactJws.split(".", 1);
      if (!protectedSegment) return false;
      const protectedHeader = JSON.parse(
        new TextDecoder().decode(base64UrlDecode(protectedSegment)),
      ) as { alg?: unknown; kid?: unknown };
      if (
        typeof protectedHeader.alg !== "string" ||
        !this.acceptedAlgorithms.includes(protectedHeader.alg as NasaGibsManifestSignaturePort["algorithm"]) ||
        protectedHeader.kid !== expectedKeyId
      ) {
        return false;
      }
      const algorithm = protectedHeader.alg as NasaGibsManifestSignaturePort["algorithm"];
      const publicKey = await this.resolvePublicKey(expectedKeyId, algorithm);
      const result = await compactVerify(compactJws, publicKey, { algorithms: [algorithm] });
      return constantTimeBytesEqual(result.payload, payload);
    } catch {
      return false;
    }
  }
}

export type ObservationComparison = {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId?: string;
  readonly productId: string;
  readonly beforeDate: string;
  readonly afterDate: string;
  readonly bbox: NasaGibsBoundingBox;
  readonly projection: NasaGibsProjection;
  readonly mode: NasaGibsComparisonMode;
  readonly layerConfiguration: {
    readonly format: string;
    readonly opacity: number;
    readonly tileMatrixSet?: string;
  };
  readonly sourceCapabilitiesHash: string;
  readonly actorId: string;
  readonly createdAt: string;
  readonly comparisonHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
  readonly authority: "terraproof_observation_context_only";
  readonly attribution: typeof NASA_GIBS_ACKNOWLEDGEMENT;
  readonly nonEndorsement: typeof NASA_GIBS_NON_ENDORSEMENT;
  readonly disclosure: "visualization_not_verified_evidence_or_science_data";
};

export type NasaGibsAttributionRecord = {
  readonly version: "nasa-gibs-attribution-v1";
  readonly artifactKind: NasaGibsAttributionArtifactKind;
  readonly productId: string;
  readonly nasaLayerId: string;
  readonly sourceCapabilitiesHash: string;
  readonly beforeDate: string;
  readonly afterDate: string;
  readonly attribution: typeof NASA_GIBS_ACKNOWLEDGEMENT;
  readonly nonEndorsement: typeof NASA_GIBS_NON_ENDORSEMENT;
  readonly disclosure: "visualization_not_verified_evidence_or_science_data";
  readonly recordHash: string;
};

export type NasaSourceDataHandoff = {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId?: string;
  readonly visualizationProductId: string;
  readonly scienceDatasetRef: string;
  readonly collectionRef: string;
  readonly granuleSearchRef: string;
  readonly requestedArea: NasaGibsBoundingBox;
  readonly requestedTime: { readonly start: string; readonly end: string };
  readonly purpose: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly handoffHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
  readonly disclosure: "visualization_is_not_numerical_source_data";
};

export type NasaGibsEventWatch = {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId?: string;
  readonly productId: string;
  readonly watchType: NasaGibsEventWatchType;
  readonly bbox: NasaGibsBoundingBox;
  readonly projection: NasaGibsProjection;
  readonly outputs: readonly NasaGibsAllowedWatchOutput[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly watchHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
  readonly finalAuthority: false;
};

export type NasaGibsManifestIssuance = {
  readonly manifest: NasaGibsMapManifest;
  readonly organizationId: string;
  readonly nonce: string;
};

export type NasaGibsTileFailure = {
  readonly productId: string;
  readonly failureKind: "network" | "http" | "decode" | "unknown";
};

type StoredSyncCommand = {
  readonly commandHash: string;
  readonly requestHash: string;
  readonly snapshot: NasaGibsCatalogSnapshot;
  readonly products: readonly NasaGibsProduct[];
};

type NasaGibsCatalogCommitResult = StoredSyncCommand & {
  readonly replayed: boolean;
};

export type NasaGibsRepository = {
  readonly storage: "postgresql" | "test-memory";
  findSyncCommand(commandHash: string, actor: NasaGibsActor): Promise<StoredSyncCommand | undefined>;
  commitCatalog(input: {
    readonly commandHash: string;
    readonly requestHash: string;
    readonly actor: NasaGibsActor;
    readonly idempotencyKeyHash: string;
    readonly snapshot: NasaGibsCatalogSnapshot;
    readonly products: readonly NasaGibsProduct[];
    readonly availability: readonly NasaGibsLayerAvailability[];
  }): Promise<NasaGibsCatalogCommitResult>;
  recordSyncFailure(failure: NasaGibsSyncFailure): Promise<void>;
  listCurrentSnapshots(): Promise<readonly NasaGibsCatalogSnapshot[]>;
  getCurrentSnapshot(endpointId: string): Promise<NasaGibsCatalogSnapshot | undefined>;
  listProducts(filter?: {
    readonly serviceType?: NasaGibsServiceType;
    readonly projection?: NasaGibsProjection;
    readonly freshness?: NasaGibsFreshnessState;
  }): Promise<readonly NasaGibsProduct[]>;
  getProduct(productId: string): Promise<NasaGibsProduct | undefined>;
  getAvailability(productId: string): Promise<NasaGibsLayerAvailability | undefined>;
  projectBelongsToOrganization(projectId: string, organizationId: string): Promise<boolean>;
  latestFailure(organizationId?: string): Promise<NasaGibsSyncFailure | undefined>;
  recordManifestIssuance(issuance: NasaGibsManifestIssuance): Promise<void>;
  consumeManifestNonce(organizationId: string, nonce: string, consumedAt: string): Promise<boolean>;
  saveComparison(comparison: ObservationComparison): Promise<void>;
  getComparison(comparisonId: string, organizationId: string): Promise<ObservationComparison | undefined>;
  saveSourceHandoff(handoff: NasaSourceDataHandoff): Promise<void>;
  saveEventWatch(watch: NasaGibsEventWatch): Promise<void>;
  comparisonCount(): Promise<number>;
  sourceHandoffCount(): Promise<number>;
};

/** Test-only repository. Runtime composition must use PostgreSQL. */
export class InMemoryNasaGibsRepository implements NasaGibsRepository {
  readonly storage = "test-memory" as const;
  private readonly commands = new Map<string, StoredSyncCommand>();
  private readonly snapshots = new Map<string, NasaGibsCatalogSnapshot>();
  private readonly products = new Map<string, NasaGibsProduct>();
  private readonly availability = new Map<string, NasaGibsLayerAvailability>();
  private readonly failures: NasaGibsSyncFailure[] = [];
  private readonly manifestIssuances = new Map<string, NasaGibsManifestIssuance>();
  private readonly consumedNonces = new Set<string>();
  private readonly comparisons = new Map<string, ObservationComparison>();
  private readonly handoffs = new Map<string, NasaSourceDataHandoff>();
  private readonly watches = new Map<string, NasaGibsEventWatch>();
  private readonly projectOrganizations: ReadonlyMap<string, string>;

  constructor(projectOrganizations: Readonly<Record<string, string>> = {}) {
    this.projectOrganizations = new Map(Object.entries(projectOrganizations));
  }

  async findSyncCommand(commandHash: string, actor: NasaGibsActor) {
    void actor;
    return this.commands.get(commandHash);
  }

  async commitCatalog(input: Parameters<NasaGibsRepository["commitCatalog"]>[0]) {
    const existing = this.commands.get(input.commandHash);
    if (existing) {
      if (existing.requestHash !== input.requestHash) throw new Error("NASA_GIBS_IDEMPOTENCY_CONFLICT");
      return { ...existing, replayed: true };
    }
    const nextProducts = new Map(this.products);
    const nextAvailability = new Map(this.availability);
    for (const [productId, product] of nextProducts) {
      if (product.sourceEndpointId === input.snapshot.endpointId) {
        nextProducts.delete(productId);
        nextAvailability.delete(productId);
      }
    }
    for (const product of input.products) nextProducts.set(product.id, product);
    for (const entry of input.availability) nextAvailability.set(entry.productId, entry);
    this.snapshots.set(input.snapshot.endpointId, input.snapshot);
    this.products.clear();
    for (const [id, product] of nextProducts) this.products.set(id, product);
    this.availability.clear();
    for (const [id, entry] of nextAvailability) this.availability.set(id, entry);
    const committed = {
      commandHash: input.commandHash,
      requestHash: input.requestHash,
      snapshot: input.snapshot,
      products: input.products,
    };
    this.commands.set(input.commandHash, committed);
    return { ...committed, replayed: false };
  }

  async recordSyncFailure(failure: NasaGibsSyncFailure) {
    if (!this.failures.some((entry) => entry.id === failure.id)) this.failures.push(failure);
  }

  async listCurrentSnapshots() {
    return [...this.snapshots.values()].sort((left, right) => left.endpointId.localeCompare(right.endpointId));
  }

  async getCurrentSnapshot(endpointId: string) {
    return this.snapshots.get(endpointId);
  }

  async listProducts(filter: Parameters<NasaGibsRepository["listProducts"]>[0] = {}) {
    return [...this.products.values()]
      .filter((product) => !filter.serviceType || product.serviceType === filter.serviceType)
      .filter((product) => !filter.projection || product.projection === filter.projection)
      .filter((product) => !filter.freshness || product.freshness === filter.freshness)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async getProduct(productId: string) {
    return this.products.get(productId);
  }

  async getAvailability(productId: string) {
    return this.availability.get(productId);
  }

  async projectBelongsToOrganization(projectId: string, organizationId: string) {
    return this.projectOrganizations.get(projectId) === organizationId;
  }

  async latestFailure(organizationId?: string) {
    void organizationId;
    return [...this.failures].sort((left, right) => right.failedAt.localeCompare(left.failedAt))[0];
  }

  async recordManifestIssuance(issuance: NasaGibsManifestIssuance) {
    const key = `${issuance.organizationId}:${issuance.nonce}`;
    if (this.manifestIssuances.has(key)) throw new Error("NASA_GIBS_MANIFEST_NONCE_CONFLICT");
    this.manifestIssuances.set(key, issuance);
  }

  async consumeManifestNonce(organizationId: string, nonce: string, consumedAt: string) {
    void consumedAt;
    const key = `${organizationId}:${nonce}`;
    if (!this.manifestIssuances.has(key) || this.consumedNonces.has(key)) return false;
    this.consumedNonces.add(key);
    return true;
  }

  async saveComparison(comparison: ObservationComparison) {
    const existing = this.comparisons.get(comparison.id);
    if (existing && existing.comparisonHash !== comparison.comparisonHash) throw new Error("NASA_GIBS_COMPARISON_CONFLICT");
    this.comparisons.set(comparison.id, comparison);
  }

  async getComparison(comparisonId: string, organizationId: string) {
    const comparison = this.comparisons.get(comparisonId);
    return comparison?.organizationId === organizationId ? comparison : undefined;
  }

  async saveSourceHandoff(handoff: NasaSourceDataHandoff) {
    const existing = this.handoffs.get(handoff.id);
    if (existing && existing.handoffHash !== handoff.handoffHash) throw new Error("NASA_GIBS_HANDOFF_CONFLICT");
    this.handoffs.set(handoff.id, handoff);
  }

  async saveEventWatch(watch: NasaGibsEventWatch) {
    const existing = this.watches.get(watch.id);
    if (existing && existing.watchHash !== watch.watchHash) throw new Error("NASA_GIBS_WATCH_CONFLICT");
    this.watches.set(watch.id, watch);
  }

  async comparisonCount() {
    return this.comparisons.size;
  }

  async sourceHandoffCount() {
    return this.handoffs.size;
  }
}

export type NasaGibsMetricName =
  | "nasa_gibs_sync_total"
  | "nasa_gibs_sync_failures_total"
  | "nasa_gibs_products_total"
  | "nasa_gibs_tile_failures_total"
  | "nasa_gibs_stale_products_total"
  | "nasa_gibs_comparisons_total"
  | "nasa_gibs_source_handoffs_total";

export type NasaGibsTraceName =
  | "nasa_gibs.capabilities_sync"
  | "nasa_gibs.availability_lookup"
  | "nasa_gibs.manifest_generation"
  | "nasa_gibs.comparison_creation"
  | "nasa_gibs.source_data_handoff";

export type NasaGibsTelemetry = {
  increment(metric: NasaGibsMetricName, value?: number): void;
  gauge(metric: NasaGibsMetricName, value: number): void;
  trace<T>(
    name: NasaGibsTraceName,
    attributes: Readonly<Record<string, string>>,
    operation: () => Promise<T>,
  ): Promise<T>;
  snapshot(): Readonly<Record<NasaGibsMetricName, number>>;
};

export class InMemoryNasaGibsTelemetry implements NasaGibsTelemetry {
  private readonly metrics = new Map<NasaGibsMetricName, number>();
  readonly spans: Array<{
    readonly name: NasaGibsTraceName;
    readonly attributes: Readonly<Record<string, string>>;
    readonly outcome: "ok" | "error";
  }> = [];

  increment(metric: NasaGibsMetricName, value = 1) {
    this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + value);
  }

  gauge(metric: NasaGibsMetricName, value: number) {
    this.metrics.set(metric, value);
  }

  async trace<T>(
    name: NasaGibsTraceName,
    attributes: Readonly<Record<string, string>>,
    operation: () => Promise<T>,
  ) {
    try {
      const result = await operation();
      this.spans.push({ name, attributes, outcome: "ok" });
      return result;
    } catch (error) {
      this.spans.push({ name, attributes, outcome: "error" });
      throw error;
    }
  }

  snapshot() {
    return Object.fromEntries(
      [
        "nasa_gibs_sync_total",
        "nasa_gibs_sync_failures_total",
        "nasa_gibs_products_total",
        "nasa_gibs_tile_failures_total",
        "nasa_gibs_stale_products_total",
        "nasa_gibs_comparisons_total",
        "nasa_gibs_source_handoffs_total",
      ].map((metric) => [metric, this.metrics.get(metric as NasaGibsMetricName) ?? 0]),
    ) as Readonly<Record<NasaGibsMetricName, number>>;
  }
}

type NasaGibsConnectorOptions = {
  readonly repository: NasaGibsRepository;
  readonly transport?: NasaGibsHttpTransport;
  readonly signaturePort?: NasaGibsManifestSignaturePort;
  readonly telemetry?: NasaGibsTelemetry;
  readonly enabled?: boolean;
  readonly now?: () => string;
  readonly maxCapabilitiesBytes?: number;
  readonly timeoutMs?: number;
};

export class NasaGibsConnectorService {
  private readonly transport: NasaGibsHttpTransport;
  private readonly telemetry: NasaGibsTelemetry;
  private readonly now: () => string;
  private readonly enabled: boolean;

  constructor(private readonly options: NasaGibsConnectorOptions) {
    this.transport = options.transport ?? fetch;
    this.telemetry = options.telemetry ?? new InMemoryNasaGibsTelemetry();
    this.now = options.now ?? (() => new Date().toISOString());
    this.enabled = options.enabled ?? false;
  }

  async status(actor?: NasaGibsActor): Promise<NasaGibsConnectorStatus> {
    if (!this.enabled) {
      return {
        service: "canopyproof-terraproof-nasa-gibs",
        enabled: false,
        storage: this.options.repository.storage,
        currentSnapshotCount: 0,
        productCount: 0,
        staleProductCount: 0,
        sourceState: "disabled",
        implementationGate: "non_production_only",
        safety: nasaGibsSafetyBoundary(),
      };
    }
    if (actor) assertReadAuthority(actor);
    const [snapshots, products, failure] = await Promise.all([
      this.options.repository.listCurrentSnapshots(),
      this.options.repository.listProducts(),
      this.options.repository.latestFailure(actor?.organizationId),
    ]);
    const staleProductCount = products.filter((product) => product.freshness === "stale").length;
    const lastSynchronizedAt = snapshots.map((snapshot) => snapshot.synchronizedAt).sort().at(-1);
    const sourceState = failure && (!lastSynchronizedAt || failure.failedAt > lastSynchronizedAt)
      ? "outage"
      : snapshots.length === 0
        ? "not_synchronized"
        : staleProductCount > 0
          ? "stale"
          : "ready";
    this.telemetry.gauge("nasa_gibs_products_total", products.length);
    this.telemetry.gauge("nasa_gibs_stale_products_total", staleProductCount);
    return {
      service: "canopyproof-terraproof-nasa-gibs",
      enabled: true,
      storage: this.options.repository.storage,
      currentSnapshotCount: snapshots.length,
      productCount: products.length,
      staleProductCount,
      ...(lastSynchronizedAt ? { lastSynchronizedAt } : {}),
      ...(failure ? { lastFailureAt: failure.failedAt } : {}),
      sourceState,
      implementationGate: "non_production_only",
      safety: nasaGibsSafetyBoundary(),
    };
  }

  async sync(commandInput: NasaGibsSyncCommand): Promise<NasaGibsSyncResult> {
    this.requireEnabled();
    const command = syncCommandSchema.parse(commandInput);
    assertSyncAuthority(command.actor);
    const endpointId = nasaGibsEndpointId(command.serviceType, command.projection);
    const endpoint = resolveNasaGibsServiceEndpoint(endpointId);
    const idempotencyKeyHash = hashJson({ kind: "nasa-gibs-idempotency-key-v1", value: command.idempotencyKey });
    const requestHash = hashJson({
      kind: "nasa-gibs-sync-request-v1",
      endpointId,
      organizationId: command.actor.organizationId,
      actorId: command.actor.id,
    });
    const commandHash = hashJson({
      kind: "nasa-gibs-sync-command-v1",
      endpointId,
      organizationId: command.actor.organizationId,
      actorId: command.actor.id,
      idempotencyKeyHash,
    });
    const existing = await this.options.repository.findSyncCommand(commandHash, command.actor);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new NasaGibsError("CATALOG_INVARIANT", "Idempotency key was reused with a different sync request.", 409);
      }
      return { outcome: "synchronized", snapshot: existing.snapshot, products: existing.products, replayed: true };
    }

    this.telemetry.increment("nasa_gibs_sync_total");
    return this.telemetry.trace(
      "nasa_gibs.capabilities_sync",
      { endpoint_id: endpoint.id, service_type: endpoint.serviceType, projection: endpoint.projection },
      async () => {
        try {
          const bytes = await fetchNasaGibsCapabilities(endpoint, this.transport, {
            ...(this.options.maxCapabilitiesBytes ? { maxBytes: this.options.maxCapabilitiesBytes } : {}),
            ...(this.options.timeoutMs ? { timeoutMs: this.options.timeoutMs } : {}),
          });
          const parsed = await parseNasaGibsCapabilities(bytes, endpoint, command.requestedAt);
          const productIds = parsed.products.map((product) => product.id).sort();
          const snapshotSeed = {
            endpointId,
            serviceType: command.serviceType,
            projection: command.projection,
            sourceCapabilitiesHash: parsed.sourceCapabilitiesHash,
            productCount: productIds.length,
            productIds,
            synchronizedAt: command.requestedAt,
          };
          const snapshotId = `nasa_gibs_snapshot_${hashJson({ kind: "nasa-gibs-catalog-snapshot-v1", ...snapshotSeed }).slice(0, 24)}`;
          const auditEvent = singleAuditEvent({
            action: "ASSERT",
            actor: command.actor.id,
            entityType: "nasa_gibs_catalog_snapshot",
            entityId: snapshotId,
            payload: snapshotSeed,
            createdAt: command.requestedAt,
            rationale: "An allowlisted NASA GIBS capabilities document was bounded, validated, normalized, and stored as contextual visualization metadata.",
          });
          const snapshotRoot = hashJson({
            kind: "nasa-gibs-catalog-snapshot-root-v1",
            ...snapshotSeed,
            auditEventRoot: auditEvent.eventRoot,
          });
          const snapshot: NasaGibsCatalogSnapshot = {
            id: snapshotId,
            ...snapshotSeed,
            snapshotRoot,
            auditEvent,
          };
          const committed = await this.options.repository.commitCatalog({
            commandHash,
            requestHash,
            actor: command.actor,
            idempotencyKeyHash,
            snapshot,
            products: parsed.products,
            availability: parsed.availability,
          });
          this.telemetry.gauge("nasa_gibs_products_total", committed.products.length);
          this.telemetry.gauge(
            "nasa_gibs_stale_products_total",
            committed.products.filter((product) => product.freshness === "stale").length,
          );
          return {
            outcome: "synchronized",
            snapshot: committed.snapshot,
            products: committed.products,
            replayed: committed.replayed,
          };
        } catch (error) {
          const normalized = normalizeNasaGibsError(error);
          this.telemetry.increment("nasa_gibs_sync_failures_total");
          const lastValidSnapshot = await this.options.repository.getCurrentSnapshot(endpointId);
          const currentProducts = await this.options.repository.listProducts({
            serviceType: endpoint.serviceType,
            projection: endpoint.projection,
          });
          const failureSeed = {
            endpointId,
            organizationId: command.actor.organizationId,
            actorId: command.actor.id,
            errorCode: normalized.code,
            failedAt: command.requestedAt,
          };
          const id = `nasa_gibs_failure_${hashJson({ kind: "nasa-gibs-sync-failure-v1", ...failureSeed }).slice(0, 24)}`;
          const auditEvent = singleAuditEvent({
            action: "CHALLENGE",
            actor: command.actor.id,
            entityType: "nasa_gibs_sync_failure",
            entityId: id,
            payload: failureSeed,
            createdAt: command.requestedAt,
            rationale: "NASA GIBS synchronization failed closed; the last valid catalog remains readable with an explicit outage state.",
          });
          const failure: NasaGibsSyncFailure = {
            id,
            ...failureSeed,
            failureRoot: hashJson({ kind: "nasa-gibs-sync-failure-root-v1", ...failureSeed, auditEventRoot: auditEvent.eventRoot }),
            auditEvent,
          };
          await this.options.repository.recordSyncFailure(failure);
          return {
            outcome: "outage",
            endpointId,
            errorCode: normalized.code,
            ...(lastValidSnapshot ? { lastValidSnapshot } : {}),
            staleProducts: currentProducts.map((product) => ({
              ...product,
              freshness: "outage" as const,
              freshnessReason: "The upstream synchronization failed; this is the last valid cached product metadata.",
            })),
            failure,
          };
        }
      },
    );
  }

  async listProducts(filter?: Parameters<NasaGibsRepository["listProducts"]>[0]) {
    this.requireEnabled();
    return this.options.repository.listProducts(filter);
  }

  async getProduct(productId: string) {
    this.requireEnabled();
    const product = await this.options.repository.getProduct(productIdSchema.parse(productId));
    if (!product) throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS product was not found.", 404);
    return product;
  }

  async getAvailability(productId: string) {
    this.requireEnabled();
    return this.telemetry.trace(
      "nasa_gibs.availability_lookup",
      { endpoint_id: "registry", service_type: "catalog", projection: "catalog" },
      async () => {
        const availability = await this.options.repository.getAvailability(productIdSchema.parse(productId));
        if (!availability) throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS product availability was not found.", 404);
        return availability;
      },
    );
  }

  async issueMapManifest(input: unknown, actor: NasaGibsActor): Promise<NasaGibsMapManifest> {
    this.requireEnabled();
    if (!this.options.signaturePort) {
      throw new NasaGibsError("AUTHORIZATION_DENIED", "External KMS/HSM manifest signing is not configured.", 503);
    }
    const signaturePort = this.options.signaturePort;
    return this.telemetry.trace(
      "nasa_gibs.manifest_generation",
      { endpoint_id: "registry", service_type: "manifest", projection: "bound" },
      async () => {
        assertReadAuthority(actor);
        const parsed = manifestInputSchema.parse(input);
        const product = await this.getProduct(parsed.productId);
        assertProductDate(product, parsed.date, this.now());
        const bbox = parseBoundingBox(parsed.bbox, product.projection);
        const format = parsed.format ?? product.formats[0];
        if (!format || !product.formats.includes(format)) {
          throw new NasaGibsError("CATALOG_INVARIANT", "Requested map format is not available for this product.", 422);
        }
        const issuedAt = requireIsoInstant(this.now(), "manifest issuedAt");
        const ttlSeconds = boundedPositiveInteger(parsed.ttlSeconds ?? 300, 30, NASA_GIBS_MANIFEST_MAX_TTL_SECONDS, "manifest ttlSeconds");
        const expiresAt = new Date(Date.parse(issuedAt) + ttlSeconds * 1_000).toISOString();
        const nonce = randomNonce();
        const keyId = z.string().trim().min(1).max(256).parse(signaturePort.keyId);
        z.enum(["ES256", "EdDSA", "RS256"]).parse(signaturePort.algorithm);
        const payload: NasaGibsMapManifestPayload = {
          version: "nasa-gibs-map-manifest-v1",
          organizationId: actor.organizationId,
          actorId: actor.id,
          purpose: parsed.purpose,
          productId: product.id,
          nasaLayerId: product.nasaLayerId,
          date: parsed.date,
          projection: product.projection,
          bbox,
          serviceType: product.serviceType,
          endpointId: product.sourceEndpointId,
          templateId: product.serviceType === "WMTS" ? "gibs-wmts-rest-v1" : "gibs-wms-getmap-v1",
          ...(product.tileMatrixSet ? { tileMatrixSet: product.tileMatrixSet } : {}),
          format,
          opacity: parsed.opacity,
          sourceCapabilitiesHash: product.sourceCapabilitiesHash,
          ...(product.observedOrPublishedAt ? { observedOrPublishedAt: product.observedOrPublishedAt } : {}),
          freshness: product.freshness,
          attribution: product.attribution,
          nonEndorsement: product.nonEndorsement,
          issuedAt,
          expiresAt,
          nonce,
          keyId,
        };
        const canonicalBytes = manifestCanonicalBytes(payload);
        const manifestHash = await sha256Hex(canonicalBytes);
        const signature = await signaturePort.sign(canonicalBytes);
        if (
          !signature ||
          signature.length > 16_384 ||
          !await signaturePort.verify(canonicalBytes, signature, keyId)
        ) {
          throw new NasaGibsError("AUTHORIZATION_DENIED", "External signer returned an invalid signature.", 503);
        }
        const event = singleAuditEvent({
          action: "FULFILL",
          actor: actor.id,
          entityType: "nasa_gibs_map_manifest",
          entityId: `nasa_gibs_manifest_${manifestHash.slice(0, 24)}`,
          payload: { manifestHash, organizationId: actor.organizationId, productId: product.id, expiresAt },
          createdAt: issuedAt,
          rationale: "A short-lived signed disclosure manifest was issued for contextual NASA GIBS visualization only.",
        });
        const manifest = mapManifestSchema.parse({
          ...payload,
          manifestHash,
          signature,
          auditEvent: event,
        }) as NasaGibsMapManifest;
        await this.options.repository.recordManifestIssuance({ manifest, organizationId: actor.organizationId, nonce });
        return manifest;
      },
    );
  }

  async verifyAndConsumeMapManifest(manifest: NasaGibsMapManifest, organizationId: string) {
    this.requireEnabled();
    if (!this.options.signaturePort) return false;
    const parsed = mapManifestSchema.safeParse(manifest);
    if (!parsed.success || parsed.data.organizationId !== organizationId) return false;
    const candidate = parsed.data as NasaGibsMapManifest;
    try {
      const { manifestHash, signature, auditEvent, ...payload } = candidate;
      const canonicalBytes = manifestCanonicalBytes(payload);
      const now = requireIsoInstant(this.now(), "manifest verification time");
      const issuedAt = Date.parse(candidate.issuedAt);
      const expiresAt = Date.parse(candidate.expiresAt);
      if (
        await sha256Hex(canonicalBytes) !== manifestHash ||
        expiresAt <= Date.parse(now) ||
        issuedAt >= expiresAt ||
        expiresAt - issuedAt > NASA_GIBS_MANIFEST_MAX_TTL_SECONDS * 1_000
      ) {
        return false;
      }
      const eventPayload = {
        manifestHash,
        organizationId: candidate.organizationId,
        productId: candidate.productId,
        expiresAt: candidate.expiresAt,
      };
      if (
        auditEvent.actor !== candidate.actorId ||
        auditEvent.entityType !== "nasa_gibs_map_manifest" ||
        auditEvent.entityId !== `nasa_gibs_manifest_${manifestHash.slice(0, 24)}` ||
        !verifyCanopyProofAuditChain([{ event: auditEvent, payload: eventPayload }], candidate.issuedAt).valid
      ) {
        return false;
      }
      const product = await this.options.repository.getProduct(candidate.productId);
      if (
        !product ||
        product.nasaLayerId !== candidate.nasaLayerId ||
        product.serviceType !== candidate.serviceType ||
        product.projection !== candidate.projection ||
        product.sourceEndpointId !== candidate.endpointId ||
        product.sourceCapabilitiesHash !== candidate.sourceCapabilitiesHash ||
        product.tileMatrixSet !== candidate.tileMatrixSet ||
        !product.formats.includes(candidate.format) ||
        candidate.attribution !== product.attribution ||
        candidate.nonEndorsement !== product.nonEndorsement
      ) {
        return false;
      }
      const endpoint = resolveNasaGibsServiceEndpoint(candidate.endpointId);
      if (endpoint.serviceType !== candidate.serviceType || endpoint.projection !== candidate.projection) return false;
      if (
        (candidate.serviceType === "WMTS") !== (candidate.templateId === "gibs-wmts-rest-v1") ||
        (candidate.serviceType === "WMTS") !== Boolean(candidate.tileMatrixSet)
      ) {
        return false;
      }
      assertProductDate(product, candidate.date, now);
      parseBoundingBox(candidate.bbox, candidate.projection);
      if (!await this.options.signaturePort.verify(canonicalBytes, signature, candidate.keyId)) return false;
      return this.options.repository.consumeManifestNonce(organizationId, candidate.nonce, now);
    } catch {
      return false;
    }
  }

  async createComparison(input: unknown, actor: NasaGibsActor): Promise<ObservationComparison> {
    this.requireEnabled();
    return this.telemetry.trace(
      "nasa_gibs.comparison_creation",
      { endpoint_id: "registry", service_type: "comparison", projection: "bound" },
      async () => {
        assertReadAuthority(actor);
        const parsed = comparisonInputSchema.parse(input);
        await this.assertProjectLink(parsed.projectId, actor);
        const product = await this.getProduct(parsed.productId);
        assertProductDate(product, parsed.beforeDate, this.now());
        assertProductDate(product, parsed.afterDate, this.now());
        if (Date.parse(parsed.beforeDate) >= Date.parse(parsed.afterDate)) {
          throw new NasaGibsError("CATALOG_INVARIANT", "Comparison beforeDate must precede afterDate.", 422);
        }
        const bbox = parseBoundingBox(parsed.bbox, product.projection);
        const format = parsed.format ?? product.formats[0];
        if (!format || !product.formats.includes(format)) {
          throw new NasaGibsError("CATALOG_INVARIANT", "Comparison format is unavailable for this product.", 422);
        }
        const seed: Omit<ObservationComparison, "id" | "comparisonHash" | "auditEvent"> = {
          organizationId: actor.organizationId,
          ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
          productId: product.id,
          beforeDate: parsed.beforeDate,
          afterDate: parsed.afterDate,
          bbox,
          projection: product.projection,
          mode: parsed.mode,
          layerConfiguration: {
            format,
            opacity: parsed.opacity,
            ...(product.tileMatrixSet ? { tileMatrixSet: product.tileMatrixSet } : {}),
          },
          sourceCapabilitiesHash: product.sourceCapabilitiesHash,
          actorId: actor.id,
          createdAt: requireIsoInstant(parsed.createdAt ?? this.now(), "comparison createdAt"),
          authority: "terraproof_observation_context_only" as const,
          attribution: NASA_GIBS_ACKNOWLEDGEMENT,
          nonEndorsement: NASA_GIBS_NON_ENDORSEMENT,
          disclosure: "visualization_not_verified_evidence_or_science_data" as const,
        };
        const comparisonHash = hashJson({ kind: "nasa-gibs-observation-comparison-v1", ...seed });
        const id = `nasa_gibs_comparison_${comparisonHash.slice(0, 24)}`;
        const auditEvent = singleAuditEvent({
          action: "ASSERT",
          actor: actor.id,
          entityType: "nasa_gibs_observation_comparison",
          entityId: id,
          payload: { comparisonHash, productId: product.id, sourceCapabilitiesHash: product.sourceCapabilitiesHash },
          createdAt: seed.createdAt,
          rationale: "A TerraProof temporal visualization comparison was frozen as contextual observation metadata, not scientific inference.",
        });
        const comparison: ObservationComparison = { id, ...seed, comparisonHash, auditEvent };
        await this.options.repository.saveComparison(comparison);
        this.telemetry.increment("nasa_gibs_comparisons_total");
        return comparison;
      },
    );
  }

  async getComparison(comparisonId: string, actor: NasaGibsActor) {
    this.requireEnabled();
    assertReadAuthority(actor);
    const comparison = await this.options.repository.getComparison(productIdSchema.parse(comparisonId), actor.organizationId);
    if (!comparison || !verifyObservationComparison(comparison)) {
      throw new NasaGibsError("AUTHORIZATION_DENIED", "Comparison was not found in the authenticated organization.", 404);
    }
    return comparison;
  }

  async comparisonAttribution(
    comparisonId: string,
    artifactKind: NasaGibsAttributionArtifactKind,
    actor: NasaGibsActor,
  ) {
    const comparison = await this.getComparison(comparisonId, actor);
    const product = await this.getProduct(comparison.productId);
    return buildNasaGibsAttributionRecord(comparison, product, artifactKind);
  }

  async createSourceDataHandoff(input: unknown, actor: NasaGibsActor): Promise<NasaSourceDataHandoff> {
    this.requireEnabled();
    return this.telemetry.trace(
      "nasa_gibs.source_data_handoff",
      { endpoint_id: "earthdata-reference", service_type: "handoff", projection: "bound" },
      async () => {
        assertReadAuthority(actor);
        const parsed = handoffInputSchema.parse(input);
        await this.assertProjectLink(parsed.projectId, actor);
        const product = await this.getProduct(parsed.visualizationProductId);
        const requestedArea = parseBoundingBox(parsed.requestedArea, product.projection);
        const start = requireNasaDate(parsed.requestedTime.start, "handoff start");
        const end = requireNasaDate(parsed.requestedTime.end, "handoff end");
        if (Date.parse(start) > Date.parse(end) || Date.parse(end) > Date.parse(this.now()) + 5 * 60_000) {
          throw new NasaGibsError("CATALOG_INVARIANT", "Source-data handoff time range is invalid or in the future.", 422);
        }
        const seed = {
          organizationId: actor.organizationId,
          ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
          visualizationProductId: product.id,
          scienceDatasetRef: parsed.scienceDatasetRef,
          collectionRef: parsed.collectionRef,
          granuleSearchRef: parsed.granuleSearchRef,
          requestedArea,
          requestedTime: { start, end },
          purpose: parsed.purpose,
          createdBy: actor.id,
          createdAt: requireIsoInstant(parsed.createdAt ?? this.now(), "handoff createdAt"),
          disclosure: "visualization_is_not_numerical_source_data" as const,
        };
        const handoffHash = hashJson({ kind: "nasa-gibs-source-data-handoff-v1", ...seed });
        const id = `nasa_gibs_handoff_${handoffHash.slice(0, 24)}`;
        const auditEvent = singleAuditEvent({
          action: "DELEGATE",
          actor: actor.id,
          entityType: "nasa_gibs_source_handoff",
          entityId: id,
          payload: { handoffHash, productId: product.id, disclosure: seed.disclosure },
          createdAt: seed.createdAt,
          rationale: "A GIBS visualization was linked to opaque Earthdata discovery references without claiming tile bytes are numerical source data.",
        });
        const handoff: NasaSourceDataHandoff = { id, ...seed, handoffHash, auditEvent };
        await this.options.repository.saveSourceHandoff(handoff);
        this.telemetry.increment("nasa_gibs_source_handoffs_total");
        return handoff;
      },
    );
  }

  async createEventWatch(input: unknown, actor: NasaGibsActor): Promise<NasaGibsEventWatch> {
    this.requireEnabled();
    assertReadAuthority(actor);
    const parsed = watchInputSchema.parse(input);
    await this.assertProjectLink(parsed.projectId, actor);
    const product = await this.getProduct(parsed.productId);
    const bbox = parseBoundingBox(parsed.bbox, product.projection);
    const outputs = [...new Set(parsed.outputs)].sort() as NasaGibsAllowedWatchOutput[];
    const seed = {
      organizationId: actor.organizationId,
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      productId: product.id,
      watchType: parsed.watchType,
      bbox,
      projection: product.projection,
      outputs,
      createdBy: actor.id,
      createdAt: requireIsoInstant(parsed.createdAt ?? this.now(), "event watch createdAt"),
      finalAuthority: false as const,
    };
    const watchHash = hashJson({ kind: "nasa-gibs-event-watch-v1", ...seed });
    const id = `nasa_gibs_watch_${watchHash.slice(0, 24)}`;
    const auditEvent = singleAuditEvent({
      action: "DELEGATE",
      actor: actor.id,
      entityType: "nasa_gibs_event_watch",
      entityId: id,
      payload: { watchHash, outputs, finalAuthority: false },
      createdAt: seed.createdAt,
      rationale: "A bounded internal Earth-observation watch was created; it cannot declare emergencies, proof, ESG claims, or funding decisions.",
    });
    const watch: NasaGibsEventWatch = { id, ...seed, watchHash, auditEvent };
    await this.options.repository.saveEventWatch(watch);
    return watch;
  }

  async recordTileFailure(input: unknown, actor: NasaGibsActor): Promise<NasaGibsTileFailure> {
    this.requireEnabled();
    assertReadAuthority(actor);
    const failure = tileFailureInputSchema.parse(input);
    await this.getProduct(failure.productId);
    this.telemetry.increment("nasa_gibs_tile_failures_total");
    return failure;
  }

  metrics() {
    return this.telemetry.snapshot();
  }

  private requireEnabled() {
    if (!this.enabled) {
      throw new NasaGibsError("AUTHORIZATION_DENIED", "NASA GIBS connector is disabled by the implementation gate.", 503);
    }
    if (this.options.repository.storage !== "postgresql" && process.env.NODE_ENV === "production") {
      throw new NasaGibsError("AUTHORIZATION_DENIED", "Production NASA GIBS access requires PostgreSQL persistence.", 503);
    }
  }

  private async assertProjectLink(projectId: string | undefined, actor: NasaGibsActor) {
    if (!projectId) return;
    if (!await this.options.repository.projectBelongsToOrganization(projectId, actor.organizationId)) {
      throw new NasaGibsError(
        "AUTHORIZATION_DENIED",
        "Project linkage was not found in the authenticated organization.",
        404,
      );
    }
  }
}

const actorSchema = z.object({
  id: z.string().trim().min(1).max(256),
  organizationId: z.string().trim().min(1).max(256),
  role: z.enum(["administrator", "owner", "admin", "agent", "researcher", "verifier", "community", "observer"]),
  capabilities: z.array(z.string().trim().min(1).max(128)).max(64),
}).strict();

const syncCommandSchema = z.object({
  serviceType: z.enum(nasaGibsServiceTypes),
  projection: z.enum(nasaGibsProjections),
  actor: actorSchema,
  idempotencyKey: z.string().min(16).max(512),
  requestedAt: z.string().datetime({ offset: false }),
}).strict();

const productIdSchema = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_.:-]+$/);
const bboxInputSchema = z.object({
  west: z.number().finite(),
  south: z.number().finite(),
  east: z.number().finite(),
  north: z.number().finite(),
}).strict();

const mapManifestAuditEventSchema = z.object({
  id: z.string().trim().min(1).max(256),
  action: z.literal("FULFILL"),
  actor: z.string().trim().min(1).max(256),
  entityType: z.literal("nasa_gibs_map_manifest"),
  entityId: z.string().trim().min(1).max(256),
  previousRoot: z.string().regex(SHA256_PATTERN),
  payloadHash: z.string().regex(SHA256_PATTERN),
  eventRoot: z.string().regex(SHA256_PATTERN),
  createdAt: z.string().datetime({ offset: false }),
  rationale: z.string().trim().min(1).max(2_000),
}).strict();

const mapManifestSchema = z.object({
  version: z.literal("nasa-gibs-map-manifest-v1"),
  organizationId: z.string().trim().min(1).max(256),
  actorId: z.string().trim().min(1).max(256),
  purpose: z.enum(["visualization", "historical_comparison", "human_review"]),
  productId: productIdSchema,
  nasaLayerId: z.string().regex(LAYER_ID_PATTERN),
  date: z.string().regex(ISO_DATE_PATTERN),
  projection: z.enum(nasaGibsProjections),
  bbox: bboxInputSchema,
  serviceType: z.enum(nasaGibsServiceTypes),
  endpointId: z.string().regex(/^nasa-gibs-(?:wmts|wms)-epsg(?:4326|3857|3413|3031)-best$/),
  templateId: z.enum(["gibs-wmts-rest-v1", "gibs-wms-getmap-v1"]),
  tileMatrixSet: z.string().regex(MATRIX_SET_PATTERN).optional(),
  format: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
  opacity: z.number().finite().min(0).max(1),
  sourceCapabilitiesHash: z.string().regex(SHA256_PATTERN),
  observedOrPublishedAt: z.string().regex(ISO_DATE_PATTERN).optional(),
  freshness: z.enum(nasaGibsFreshnessStates),
  attribution: z.literal(NASA_GIBS_ACKNOWLEDGEMENT),
  nonEndorsement: z.literal(NASA_GIBS_NON_ENDORSEMENT),
  issuedAt: z.string().datetime({ offset: false }),
  expiresAt: z.string().datetime({ offset: false }),
  nonce: z.string().regex(NONCE_PATTERN),
  keyId: z.string().trim().min(1).max(256),
  manifestHash: z.string().regex(SHA256_PATTERN),
  signature: z.string().min(1).max(16_384),
  auditEvent: mapManifestAuditEventSchema,
}).strict();

const manifestInputSchema = z.object({
  productId: productIdSchema,
  date: z.string().regex(ISO_DATE_PATTERN),
  bbox: bboxInputSchema,
  purpose: z.enum(["visualization", "historical_comparison", "human_review"]),
  format: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"]).optional(),
  opacity: z.number().min(0).max(1).default(1),
  ttlSeconds: z.number().int().min(30).max(NASA_GIBS_MANIFEST_MAX_TTL_SECONDS).optional(),
}).strict();

const comparisonInputSchema = z.object({
  productId: productIdSchema,
  projectId: z.string().trim().min(1).max(256).optional(),
  beforeDate: z.string().regex(ISO_DATE_PATTERN),
  afterDate: z.string().regex(ISO_DATE_PATTERN),
  bbox: bboxInputSchema,
  mode: z.enum(nasaGibsComparisonModes),
  format: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"]).optional(),
  opacity: z.number().min(0).max(1).default(0.7),
  createdAt: z.string().datetime({ offset: false }).optional(),
}).strict();

const opaqueReferenceSchema = z.string().trim().min(1).max(512).regex(OPAQUE_REFERENCE_PATTERN);
const handoffInputSchema = z.object({
  visualizationProductId: productIdSchema,
  projectId: z.string().trim().min(1).max(256).optional(),
  scienceDatasetRef: opaqueReferenceSchema,
  collectionRef: opaqueReferenceSchema,
  granuleSearchRef: opaqueReferenceSchema,
  requestedArea: bboxInputSchema,
  requestedTime: z.object({ start: z.string().regex(ISO_DATE_PATTERN), end: z.string().regex(ISO_DATE_PATTERN) }).strict(),
  purpose: z.string().trim().min(12).max(512),
  createdAt: z.string().datetime({ offset: false }).optional(),
}).strict();

const watchInputSchema = z.object({
  productId: productIdSchema,
  projectId: z.string().trim().min(1).max(256).optional(),
  watchType: z.enum(nasaGibsEventWatchTypes),
  bbox: bboxInputSchema,
  outputs: z.array(z.enum(nasaGibsAllowedWatchOutputs)).min(1).max(3),
  createdAt: z.string().datetime({ offset: false }).optional(),
}).strict();

const tileFailureInputSchema = z.object({
  productId: productIdSchema,
  failureKind: z.enum(["network", "http", "decode", "unknown"]),
}).strict();

function assertSyncAuthority(actor: NasaGibsActor) {
  actorSchema.parse(actor);
  if (!["administrator", "admin", "agent", "researcher"].includes(actor.role) || !actor.capabilities.includes("nasa_gibs_catalog_sync")) {
    throw new NasaGibsError("AUTHORIZATION_DENIED", "Actor lacks the NASA GIBS catalog synchronization capability.", 403);
  }
}

function assertReadAuthority(actor: NasaGibsActor) {
  actorSchema.parse(actor);
  if (!actor.organizationId) {
    throw new NasaGibsError("AUTHORIZATION_DENIED", "An organization-bound actor is required.", 403);
  }
}

function parseBoundingBox(input: NasaGibsBoundingBox, projection: NasaGibsProjection): NasaGibsBoundingBox {
  const parsed = bboxInputSchema.parse(input);
  const limit = projection === "EPSG:4326"
    ? { x: 180, y: 90 }
    : projection === "EPSG:3857"
      ? { x: 20_037_508.34278925, y: 20_037_508.34278925 }
      : { x: 4_194_304, y: 4_194_304 };
  if (
    parsed.west < -limit.x ||
    parsed.east > limit.x ||
    parsed.south < -limit.y ||
    parsed.north > limit.y ||
    parsed.west >= parsed.east ||
    parsed.south >= parsed.north
  ) {
    throw new NasaGibsError("CATALOG_INVARIANT", `Bounding box is invalid for ${projection}.`, 422);
  }
  return parsed;
}

function assertProductDate(product: NasaGibsProduct, value: string, now: string) {
  const date = requireNasaDate(value, "requested date");
  if (Date.parse(date) > Date.parse(now) + 5 * 60_000) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Future NASA GIBS dates are forbidden.", 422);
  }
  if (!productDateAvailable(product, date)) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Requested date is outside the declared product availability.", 422);
  }
}

function productDateAvailable(product: NasaGibsProduct, value: string) {
  return temporalValueAvailable(product.availableDates, product.temporalExtent, value);
}

type ParsedTemporalPeriod = {
  readonly calendarMonths: number;
  readonly fixedMilliseconds: number;
};

function parseTemporalPeriod(value: string): ParsedTemporalPeriod {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match) {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", "NASA GIBS temporal interval period is invalid.", 422);
  }
  const [, yearsText, monthsText, weeksText, daysText, hoursText, minutesText, secondsText] = match;
  const components = [yearsText, monthsText, weeksText, daysText, hoursText, minutesText, secondsText];
  if (components.every((component) => component === undefined) || (value.includes("T") && !hoursText && !minutesText && !secondsText)) {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", "NASA GIBS temporal interval period is empty.", 422);
  }
  const years = Number(yearsText ?? 0);
  const months = Number(monthsText ?? 0);
  const calendarMonths = years * 12 + months;
  const fixedMilliseconds = (
    Number(weeksText ?? 0) * 7 * 24 * 60 * 60 * 1_000 +
    Number(daysText ?? 0) * 24 * 60 * 60 * 1_000 +
    Number(hoursText ?? 0) * 60 * 60 * 1_000 +
    Number(minutesText ?? 0) * 60 * 1_000 +
    Number(secondsText ?? 0) * 1_000
  );
  if (
    !Number.isSafeInteger(calendarMonths) ||
    !Number.isSafeInteger(fixedMilliseconds) ||
    (calendarMonths === 0 && fixedMilliseconds === 0) ||
    (calendarMonths > 0 && fixedMilliseconds > 0)
  ) {
    throw new NasaGibsError("UNSUPPORTED_SCHEMA", "NASA GIBS temporal interval period is unsupported.", 422);
  }
  return { calendarMonths, fixedMilliseconds };
}

function temporalValueAvailable(
  availableDates: readonly string[],
  temporalExtents: readonly NasaGibsTemporalExtent[],
  value: string,
): boolean {
  if (availableDates.includes(value)) return true;
  const timestamp = Date.parse(value);
  return temporalExtents.some((extent) => {
    const startTimestamp = Date.parse(extent.start);
    if (timestamp < startTimestamp || timestamp > Date.parse(extent.end)) return false;
    if (!extent.period) return true;
    const period = parseTemporalPeriod(extent.period);
    if (period.fixedMilliseconds > 0) {
      return (timestamp - startTimestamp) % period.fixedMilliseconds === 0;
    }
    const start = new Date(startTimestamp);
    const candidate = new Date(timestamp);
    const monthDifference = (
      (candidate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      candidate.getUTCMonth() - start.getUTCMonth()
    );
    return monthDifference >= 0 &&
      monthDifference % period.calendarMonths === 0 &&
      candidate.getUTCDate() === start.getUTCDate() &&
      candidate.getUTCHours() === start.getUTCHours() &&
      candidate.getUTCMinutes() === start.getUTCMinutes() &&
      candidate.getUTCSeconds() === start.getUTCSeconds() &&
      candidate.getUTCMilliseconds() === start.getUTCMilliseconds();
  });
}

function manifestCanonicalBytes(payload: NasaGibsMapManifestPayload): Uint8Array {
  const canonical = JSON.stringify(sortJson(payload));
  return new TextEncoder().encode(canonical);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}

export function verifyObservationComparison(comparison: ObservationComparison) {
  const { id, comparisonHash, auditEvent, ...seed } = comparison;
  void id;
  void auditEvent;
  return comparisonHash === hashJson({ kind: "nasa-gibs-observation-comparison-v1", ...seed });
}

export function buildNasaGibsAttributionRecord(
  comparison: ObservationComparison,
  product: NasaGibsProduct,
  artifactKind: NasaGibsAttributionArtifactKind,
): NasaGibsAttributionRecord {
  if (!nasaGibsAttributionArtifactKinds.includes(artifactKind) || !verifyObservationComparison(comparison)) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS attribution source record is invalid.", 422);
  }
  if (comparison.productId !== product.id || comparison.sourceCapabilitiesHash !== product.sourceCapabilitiesHash) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS attribution product lineage is inconsistent.", 422);
  }
  const seed: Omit<NasaGibsAttributionRecord, "recordHash"> = {
    version: "nasa-gibs-attribution-v1" as const,
    artifactKind,
    productId: product.id,
    nasaLayerId: product.nasaLayerId,
    sourceCapabilitiesHash: product.sourceCapabilitiesHash,
    beforeDate: comparison.beforeDate,
    afterDate: comparison.afterDate,
    attribution: NASA_GIBS_ACKNOWLEDGEMENT,
    nonEndorsement: NASA_GIBS_NON_ENDORSEMENT,
    disclosure: "visualization_not_verified_evidence_or_science_data" as const,
  };
  return {
    ...seed,
    recordHash: hashJson({ kind: "nasa-gibs-attribution-record-v1", ...seed }),
  };
}

export function buildNasaWorldviewLink(input: {
  readonly product: NasaGibsProduct;
  readonly date: string;
  readonly generalizedBbox?: NasaGibsBoundingBox;
}) {
  assertProductDate(input.product, input.date, new Date().toISOString());
  const url = new URL("/", NASA_WORLDVIEW_ORIGIN);
  url.searchParams.set("p", worldviewProjection[input.product.projection]);
  url.searchParams.set("l", input.product.nasaLayerId);
  url.searchParams.set("t", input.date);
  if (input.generalizedBbox && input.product.projection === "EPSG:4326") {
    const bbox = parseBoundingBox(input.generalizedBbox, input.product.projection);
    url.searchParams.set("v", [bbox.west, bbox.south, bbox.east, bbox.north].map((value) => value.toFixed(3)).join(","));
  }
  return url.toString();
}

export function resolveNasaGibsWmtsTileTemplate(manifest: NasaGibsMapManifest) {
  const parsed = mapManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Manifest structure is invalid.", 422);
  }
  const candidate = parsed.data as NasaGibsMapManifest;
  if (candidate.templateId !== "gibs-wmts-rest-v1" || candidate.serviceType !== "WMTS" || !candidate.tileMatrixSet) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Manifest is not a WMTS tile manifest.", 422);
  }
  const endpoint = resolveNasaGibsServiceEndpoint(candidate.endpointId);
  if (endpoint.serviceType !== candidate.serviceType || endpoint.projection !== candidate.projection) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Manifest endpoint binding is inconsistent.", 422);
  }
  const extension = candidate.format === "image/jpeg" || candidate.format === "image/jpg" ? "jpg" : candidate.format === "image/webp" ? "webp" : "png";
  return `https://${NASA_GIBS_HOST}/wmts/${projectionPath[candidate.projection]}/best/${encodeURIComponent(candidate.nasaLayerId)}/default/${encodeURIComponent(candidate.date)}/${encodeURIComponent(candidate.tileMatrixSet)}/{z}/{y}/{x}.${extension}`;
}

export function resolveNasaGibsWmsGetMapUrl(
  manifest: NasaGibsMapManifest,
  size: Readonly<{ width: number; height: number }>,
) {
  const parsed = mapManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Manifest structure is invalid.", 422);
  }
  const candidate = parsed.data as NasaGibsMapManifest;
  if (candidate.templateId !== "gibs-wms-getmap-v1" || candidate.serviceType !== "WMS" || candidate.tileMatrixSet) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Manifest is not a WMS GetMap manifest.", 422);
  }
  const endpoint = resolveNasaGibsServiceEndpoint(candidate.endpointId);
  if (endpoint.serviceType !== candidate.serviceType || endpoint.projection !== candidate.projection) {
    throw new NasaGibsError("CATALOG_INVARIANT", "Manifest endpoint binding is inconsistent.", 422);
  }
  const width = boundedPositiveInteger(size.width, 1, 4_096, "WMS width");
  const height = boundedPositiveInteger(size.height, 1, 4_096, "WMS height");
  const bbox = parseBoundingBox(candidate.bbox, candidate.projection);
  const axisOrderedBbox = candidate.projection === "EPSG:4326"
    ? [bbox.south, bbox.west, bbox.north, bbox.east]
    : [bbox.west, bbox.south, bbox.east, bbox.north];
  const url = new URL(`https://${NASA_GIBS_HOST}/wms/${projectionPath[candidate.projection]}/best/wms.cgi`);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("LAYERS", candidate.nasaLayerId);
  url.searchParams.set("STYLES", "");
  url.searchParams.set("FORMAT", candidate.format);
  url.searchParams.set("TRANSPARENT", candidate.format === "image/jpeg" || candidate.format === "image/jpg" ? "FALSE" : "TRUE");
  url.searchParams.set("CRS", candidate.projection);
  url.searchParams.set("BBOX", axisOrderedBbox.join(","));
  url.searchParams.set("WIDTH", String(width));
  url.searchParams.set("HEIGHT", String(height));
  url.searchParams.set("TIME", candidate.date);
  return url.toString();
}

export function renderNasaGibsMetrics(metrics: Readonly<Record<NasaGibsMetricName, number>>) {
  const gaugeMetrics: ReadonlySet<NasaGibsMetricName> = new Set([
    "nasa_gibs_products_total",
    "nasa_gibs_stale_products_total",
  ]);
  const lines: string[] = [];
  for (const metric of Object.keys(metrics).sort() as NasaGibsMetricName[]) {
    lines.push(`# TYPE ${metric} ${gaugeMetrics.has(metric) ? "gauge" : "counter"}`);
    lines.push(`${metric} ${metrics[metric]}`);
  }
  return `${lines.join("\n")}\n`;
}

function randomNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(`${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeBytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

function singleAuditEvent(input: Parameters<typeof appendCanopyProofAuditEvent>[1]) {
  const event = appendCanopyProofAuditEvent([], input)[0];
  if (!event) throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS operation did not produce an audit event.", 503);
  return event;
}

function normalizeNasaGibsError(error: unknown) {
  if (error instanceof NasaGibsError) return error;
  return new NasaGibsError("UPSTREAM_STATUS", "NASA GIBS synchronization failed safely.", 503);
}
