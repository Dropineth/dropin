"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PolygonLayer } from "@deck.gl/layers";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";

const apiBase = process.env.NEXT_PUBLIC_DROPIN_API_URL?.replace(/\/$/, "") ?? "/api";
const connectorPath = "/canopyproof/terra/connectors/nasa-gibs";
const acknowledgement =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";
const nonEndorsement =
  "NASA does not endorse CanopyProof, TerraProof, their interpretations, reports, certificates, funding decisions, or services.";

type Projection = "EPSG:4326" | "EPSG:3857" | "EPSG:3413" | "EPSG:3031";
type ComparisonMode = "SIDE_BY_SIDE" | "SWIPE" | "OPACITY" | "ANIMATION";
type Freshness = "current" | "stale" | "unknown" | "outage";

type ConnectorStatus = {
  readonly enabled: boolean;
  readonly sourceState: "ready" | "stale" | "outage" | "not_synchronized" | "disabled";
  readonly productCount: number;
  readonly staleProductCount: number;
  readonly lastSynchronizedAt?: string;
};

type TemporalExtent = {
  readonly start: string;
  readonly end: string;
  readonly period?: string;
};

type Product = {
  readonly id: string;
  readonly nasaLayerId: string;
  readonly title: string;
  readonly description: string;
  readonly serviceType: "WMTS" | "WMS";
  readonly projection: Projection;
  readonly tileMatrixSet?: string;
  readonly formats: readonly string[];
  readonly temporalExtent: readonly TemporalExtent[];
  readonly availableDates: readonly string[];
  readonly defaultDate?: string;
  readonly sourceEndpointId: string;
  readonly sourceCapabilitiesHash: string;
  readonly observedOrPublishedAt?: string;
  readonly freshness: Freshness;
  readonly freshnessReason: string;
  readonly synchronizedAt: string;
};

type BoundingBox = {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

type MapManifest = {
  readonly productId: string;
  readonly nasaLayerId: string;
  readonly date: string;
  readonly projection: Projection;
  readonly serviceType: "WMTS" | "WMS";
  readonly endpointId: string;
  readonly templateId: "gibs-wmts-rest-v1" | "gibs-wms-getmap-v1";
  readonly tileMatrixSet?: string;
  readonly format: string;
  readonly opacity: number;
  readonly freshness: Freshness;
  readonly attribution: string;
  readonly expiresAt: string;
  readonly manifestHash: string;
  readonly signature: string;
};

type ApiEnvelope<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string };

type LoadState =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly status: ConnectorStatus; readonly products: readonly Product[] }
  | { readonly state: "disabled"; readonly status: ConnectorStatus }
  | { readonly state: "error"; readonly message: string };

const mapView = { west: -18, south: 12, east: 4, north: 25 } as const;

export function NasaGibsEarthObservation() {
  const [projection, setProjection] = useState<Projection>("EPSG:3857");
  const [loadState, setLoadState] = useState<LoadState>({ state: "loading" });
  const [selectedProductId, setSelectedProductId] = useState("");
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");
  const [mode, setMode] = useState<ComparisonMode>("SWIPE");
  const [swipe, setSwipe] = useState(50);
  const [opacity, setOpacity] = useState(70);
  const [beforeManifest, setBeforeManifest] = useState<MapManifest>();
  const [afterManifest, setAfterManifest] = useState<MapManifest>();
  const [manifestState, setManifestState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [operationMessage, setOperationMessage] = useState("");
  const [animationFrame, setAnimationFrame] = useState<"before" | "after">("after");

  const loadCatalog = useCallback(async (nextProjection: Projection, signal?: AbortSignal) => {
    setLoadState({ state: "loading" });
    try {
      const status = await apiRequest<ConnectorStatus>(`${connectorPath}/status`, signal ? { signal } : {});
      if (!status.enabled) {
        setLoadState({ state: "disabled", status });
        return;
      }
      const products = await apiRequest<readonly Product[]>(
        `${connectorPath}/products?serviceType=WMTS&projection=${encodeURIComponent(nextProjection)}`,
        signal ? { signal } : {},
      );
      setLoadState({ state: "ready", status, products });
      setSelectedProductId((current) => products.some((product) => product.id === current) ? current : products[0]?.id ?? "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadState({ state: "error", message: error instanceof Error ? error.message : "NASA GIBS catalog is unavailable." });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(projection, controller.signal);
    return () => controller.abort();
  }, [loadCatalog, projection]);

  const products = loadState.state === "ready" ? loadState.products : [];
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const dateBounds = useMemo(() => productDateBounds(selectedProduct), [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) return;
    const after = selectedProduct.defaultDate ?? dateBounds.maximum ?? selectedProduct.availableDates.at(-1) ?? "";
    const before = dateBounds.minimum ?? selectedProduct.availableDates[0] ?? after;
    setAfterDate(after);
    setBeforeDate(before === after ? shiftIsoDate(after, -30) : before);
  }, [dateBounds.maximum, dateBounds.minimum, selectedProduct]);

  useEffect(() => {
    if (mode !== "ANIMATION" || !beforeManifest || !afterManifest) return;
    const timer = window.setInterval(() => setAnimationFrame((frame) => frame === "before" ? "after" : "before"), 1_250);
    return () => window.clearInterval(timer);
  }, [afterManifest, beforeManifest, mode]);

  useEffect(() => {
    setBeforeManifest(undefined);
    setAfterManifest(undefined);
    setManifestState("idle");
  }, [afterDate, beforeDate, projection, selectedProductId]);

  const requestManifests = useCallback(async () => {
    if (!selectedProduct || !beforeDate || !afterDate || projection !== "EPSG:3857") return;
    setManifestState("loading");
    setOperationMessage("");
    try {
      const bbox = geographicToWebMercator(mapView);
      const [before, after] = await Promise.all([
        apiRequest<MapManifest>(`${connectorPath}/products/${encodeURIComponent(selectedProduct.id)}/manifests`, {
          method: "POST",
          body: JSON.stringify({ date: beforeDate, bbox, purpose: "historical_comparison", opacity: 1, ttlSeconds: 600 }),
        }),
        apiRequest<MapManifest>(`${connectorPath}/products/${encodeURIComponent(selectedProduct.id)}/manifests`, {
          method: "POST",
          body: JSON.stringify({ date: afterDate, bbox, purpose: "historical_comparison", opacity: 1, ttlSeconds: 600 }),
        }),
      ]);
      setBeforeManifest(before);
      setAfterManifest(after);
      setManifestState("ready");
    } catch (error) {
      setBeforeManifest(undefined);
      setAfterManifest(undefined);
      setManifestState("unavailable");
      setOperationMessage(error instanceof Error ? error.message : "Signed map manifests are unavailable.");
    }
  }, [afterDate, beforeDate, projection, selectedProduct]);

  const freezeComparison = useCallback(async () => {
    if (!selectedProduct || !beforeDate || !afterDate) return;
    setOperationMessage("");
    try {
      const comparison = await apiRequest<{ readonly id: string }>(`${connectorPath}/comparisons`, {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProduct.id,
          beforeDate,
          afterDate,
          bbox: projection === "EPSG:3857" ? geographicToWebMercator(mapView) : mapView,
          mode,
          opacity: opacity / 100,
        }),
      });
      setOperationMessage(`Comparison frozen: ${comparison.id}`);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : "Comparison could not be recorded.");
    }
  }, [afterDate, beforeDate, mode, opacity, projection, selectedProduct]);

  if (loadState.state === "loading") return <ObservationSkeleton />;
  if (loadState.state === "disabled") {
    return (
      <ObservationBoundaryState
        title="NASA GIBS connector is not active"
        detail="The implementation gate remains closed until PostgreSQL, controlled egress, signing, and institutional review are complete. No imagery is substituted."
      />
    );
  }
  if (loadState.state === "error") {
    return <ObservationBoundaryState title="NASA source unavailable" detail={loadState.message} retry={() => void loadCatalog(projection)} />;
  }

  const beforeTiles = beforeManifest ? manifestTileTemplate(beforeManifest) : undefined;
  const afterTiles = afterManifest ? manifestTileTemplate(afterManifest) : undefined;
  const mapAvailable = Boolean(
    beforeTiles &&
    afterTiles &&
    selectedProduct &&
    projection === "EPSG:3857" &&
    beforeManifest?.productId === selectedProduct.id &&
    afterManifest?.productId === selectedProduct.id &&
    beforeManifest.date === beforeDate &&
    afterManifest.date === afterDate,
  );

  return (
    <section aria-labelledby="nasa-gibs-heading" className="grid gap-5 border border-slate-800 bg-slate-950 p-5 lg:p-6">
      <header className="grid gap-4 border-b border-slate-800 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">NASA GIBS Connector</p>
          <h2 id="nasa-gibs-heading" className="mt-2 text-2xl font-semibold text-white">Near-real-time Earth observation context</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
            Browse source-published visualizations and freeze temporal comparisons. Imagery remains observation context, never verified proof.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <StatusBadge state={loadState.status.sourceState} />
          <span className="border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300">{loadState.status.productCount} products</span>
          {loadState.status.lastSynchronizedAt ? (
            <span className="border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300">
              Synced {formatTimestamp(loadState.status.lastSynchronizedAt)}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-5 border border-slate-800 bg-slate-900/60 p-4">
          <Field label="Projection">
            <select className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" value={projection} onChange={(event) => setProjection(event.target.value as Projection)}>
              <option value="EPSG:3857">Web Mercator (EPSG:3857)</option>
              <option value="EPSG:4326">Geographic (EPSG:4326)</option>
              <option value="EPSG:3413">Arctic Polar (EPSG:3413)</option>
              <option value="EPSG:3031">Antarctic Polar (EPSG:3031)</option>
            </select>
          </Field>
          <Field label="NASA visualization">
            <select className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
            </select>
          </Field>
          {selectedProduct ? (
            <div className="grid gap-3 border-t border-slate-800 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Freshness</span>
                <FreshnessBadge freshness={selectedProduct.freshness} />
              </div>
              <p className="leading-6 text-slate-300">{selectedProduct.description}</p>
              <code className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-cyan-100" title={selectedProduct.nasaLayerId}>{selectedProduct.nasaLayerId}</code>
              {selectedProduct.freshness !== "current" ? (
                <p role="status" className="border border-amber-300/30 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">{selectedProduct.freshnessReason}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No product is available for this service and projection.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Before">
              <input className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" type="date" min={dateOnly(dateBounds.minimum)} max={dateOnly(dateBounds.maximum)} value={dateOnly(beforeDate)} onChange={(event) => setBeforeDate(event.target.value)} />
            </Field>
            <Field label="After">
              <input className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" type="date" min={dateOnly(dateBounds.minimum)} max={dateOnly(dateBounds.maximum)} value={dateOnly(afterDate)} onChange={(event) => setAfterDate(event.target.value)} />
            </Field>
          </div>
          <Field label="Comparison mode">
            <div className="grid grid-cols-2 gap-2">
              {(["SIDE_BY_SIDE", "SWIPE", "OPACITY", "ANIMATION"] as const).map((comparisonMode) => (
                <button
                  className={mode === comparisonMode ? "border border-cyan-300 bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950" : "border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-300"}
                  key={comparisonMode}
                  onClick={() => setMode(comparisonMode)}
                  type="button"
                >
                  {comparisonMode.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </Field>
          <button className="border border-cyan-300 bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500" disabled={!selectedProduct || manifestState === "loading" || projection !== "EPSG:3857"} onClick={() => void requestManifests()} type="button">
            {manifestState === "loading" ? "Requesting signed maps" : "Load signed comparison"}
          </button>
          <button className="border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:text-slate-600" disabled={!selectedProduct} onClick={() => void freezeComparison()} type="button">
            Freeze comparison record
          </button>
          {selectedProduct ? <SourceActions product={selectedProduct} beforeDate={beforeDate} afterDate={afterDate} projection={projection} /> : null}
          {operationMessage ? <p role="status" className="border border-slate-700 bg-slate-950 p-3 text-xs leading-5 text-slate-300">{operationMessage}</p> : null}
        </aside>

        <div className="grid min-w-0 gap-4">
          <div className="relative aspect-video min-h-[430px] overflow-hidden border border-slate-800 bg-slate-900">
            {mapAvailable ? (
              <ComparisonViewport
                afterTiles={afterTiles!}
                animationFrame={animationFrame}
                beforeTiles={beforeTiles!}
                mode={mode}
                opacity={opacity}
                productId={selectedProduct!.id}
                swipe={swipe}
              />
            ) : (
              <div className="grid h-full min-h-[430px] place-items-center p-8 text-center">
                <div className="max-w-xl">
                  <p className="text-sm font-semibold text-white">
                    {projection === "EPSG:3857" ? "Signed imagery is not loaded" : "Map preview is limited to Web Mercator"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {manifestState === "unavailable" ? operationMessage : "Select a product and dates, then request short-lived signed map manifests."}
                  </p>
                </div>
              </div>
            )}
          </div>
          {mode === "SWIPE" && mapAvailable ? <RangeControl label="Swipe position" value={swipe} setValue={setSwipe} /> : null}
          {mode === "OPACITY" && mapAvailable ? <RangeControl label="After-layer opacity" value={opacity} setValue={setOpacity} /> : null}
          <div className="grid gap-2 border border-slate-800 bg-slate-900/70 p-4 text-xs leading-5 text-slate-300">
            <p>{acknowledgement}</p>
            <p>{nonEndorsement}</p>
            <p className="text-amber-100">Visualization tiles and visual comparisons are not numerical source data, verified evidence, ESG claims, certificates, or funding decisions.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonViewport(props: {
  readonly beforeTiles: string;
  readonly afterTiles: string;
  readonly mode: ComparisonMode;
  readonly swipe: number;
  readonly opacity: number;
  readonly animationFrame: "before" | "after";
  readonly productId: string;
}) {
  if (props.mode === "SIDE_BY_SIDE") {
    return (
      <div className="grid h-full grid-cols-2">
        <MapPane label="Before observation" productId={props.productId} tileTemplate={props.beforeTiles} />
        <MapPane label="After observation" productId={props.productId} tileTemplate={props.afterTiles} />
      </div>
    );
  }
  if (props.mode === "ANIMATION") {
    return <MapPane label={`${props.animationFrame} observation`} productId={props.productId} tileTemplate={props.animationFrame === "before" ? props.beforeTiles : props.afterTiles} />;
  }
  return (
    <div className="relative h-full">
      <MapPane label="Before observation" productId={props.productId} tileTemplate={props.beforeTiles} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={props.mode === "SWIPE" ? { clipPath: `inset(0 ${100 - props.swipe}% 0 0)` } : { opacity: props.opacity / 100 }}
      >
        <MapPane label="After observation" productId={props.productId} tileTemplate={props.afterTiles} />
      </div>
      {props.mode === "SWIPE" ? <div className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: `${props.swipe}%` }} /> : null}
    </div>
  );
}

function MapPane({ label, productId, tileTemplate }: {
  readonly label: string;
  readonly productId: string;
  readonly tileTemplate: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const failureReportedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#07111b" } }],
      },
      center: [-7, 18.5],
      zoom: 4,
      attributionControl: false,
      cooperativeGestures: true,
    });
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [new PolygonLayer({
        id: "project-review-bounds",
        data: [{ polygon: [[mapView.west, mapView.south], [mapView.east, mapView.south], [mapView.east, mapView.north], [mapView.west, mapView.north]] }],
        getPolygon: (entry: { polygon: number[][] }) => entry.polygon,
        getFillColor: [34, 211, 238, 18],
        getLineColor: [103, 232, 249, 220],
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
      })],
    });
    const reportFirstFailure = () => {
      if (failureReportedRef.current) return;
      failureReportedRef.current = true;
      void reportTileFailure(productId);
    };
    map.on("error", reportFirstFailure);
    map.addControl(overlay as unknown as maplibregl.IControl);
    mapRef.current = map;
    return () => {
      map.off("error", reportFirstFailure);
      overlay.finalize();
      map.remove();
      mapRef.current = null;
    };
  }, [productId]);

  useEffect(() => {
    failureReportedRef.current = false;
    const map = mapRef.current;
    if (!map) return;
    const applyTiles = () => {
      if (map.getLayer("nasa-gibs-raster")) map.removeLayer("nasa-gibs-raster");
      if (map.getSource("nasa-gibs-raster")) map.removeSource("nasa-gibs-raster");
      map.addSource("nasa-gibs-raster", { type: "raster", tiles: [tileTemplate], tileSize: 256 });
      map.addLayer({ id: "nasa-gibs-raster", type: "raster", source: "nasa-gibs-raster", paint: { "raster-fade-duration": 0 } });
    };
    if (map.loaded()) applyTiles();
    else map.once("load", applyTiles);
    return () => {
      map.off("load", applyTiles);
    };
  }, [tileTemplate]);

  return <div aria-label={label} className="h-full min-h-[430px] w-full" ref={containerRef} role="img" />;
}

function SourceActions({ product, beforeDate, afterDate, projection }: {
  readonly product: Product;
  readonly beforeDate: string;
  readonly afterDate: string;
  readonly projection: Projection;
}) {
  const [message, setMessage] = useState("");
  const worldviewUrl = useMemo(() => {
    const url = new URL("https://worldview.earthdata.nasa.gov/");
    url.searchParams.set("p", worldviewProjection(product.projection));
    url.searchParams.set("l", product.nasaLayerId);
    if (afterDate) url.searchParams.set("t", afterDate);
    return url.toString();
  }, [afterDate, product.nasaLayerId, product.projection]);

  async function submitHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    try {
      const result = await apiRequest<{ readonly id: string }>(`${connectorPath}/source-data-handoffs`, {
        method: "POST",
        body: JSON.stringify({
          visualizationProductId: product.id,
          scienceDatasetRef: String(form.get("datasetRef") ?? ""),
          collectionRef: String(form.get("collectionRef") ?? ""),
          granuleSearchRef: String(form.get("granuleRef") ?? ""),
          requestedArea: projection === "EPSG:3857" ? geographicToWebMercator(mapView) : mapView,
          requestedTime: { start: beforeDate, end: afterDate },
          purpose: String(form.get("purpose") ?? ""),
        }),
      });
      setMessage(`Source-data handoff recorded: ${result.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source-data handoff could not be recorded.");
    }
  }

  return (
    <div className="grid gap-3 border-t border-slate-800 pt-4">
      <a className="border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm font-semibold text-cyan-100 hover:border-cyan-300" href={worldviewUrl} rel="noreferrer" target="_blank">Open in NASA Worldview</a>
      <details className="border border-slate-700 bg-slate-950 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">Underlying source-data handoff</summary>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void submitHandoff(event)}>
          <input aria-label="Science dataset reference" className="border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" name="datasetRef" pattern="(nasa:earthdata|cmr):(dataset|collection|granules):.+" placeholder="nasa:earthdata:dataset:..." required />
          <input aria-label="Collection reference" className="border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" name="collectionRef" pattern="cmr:collection:.+" placeholder="cmr:collection:..." required />
          <input aria-label="Granule search reference" className="border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" name="granuleRef" pattern="cmr:granules:.+" placeholder="cmr:granules:..." required />
          <textarea aria-label="Handoff purpose" className="min-h-20 border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" minLength={12} name="purpose" placeholder="Independent source-data review purpose" required />
          <button className="border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white" type="submit">Record handoff</button>
        </form>
        {message ? <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p> : null}
      </details>
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <label className="grid gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400"><span>{label}</span>{children}</label>;
}

function RangeControl({ label, value, setValue }: { readonly label: string; readonly value: number; readonly setValue: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-slate-800 bg-slate-900 p-3 text-xs font-semibold text-slate-300">
      <span>{label}</span>
      <input aria-label={label} max={100} min={0} onChange={(event) => setValue(Number(event.target.value))} type="range" value={value} />
      <span>{value}%</span>
    </label>
  );
}

function StatusBadge({ state }: { readonly state: ConnectorStatus["sourceState"] }) {
  const classes = state === "ready" ? "border-emerald-400/40 bg-emerald-950/40 text-emerald-100" : state === "outage" ? "border-rose-400/40 bg-rose-950/40 text-rose-100" : "border-amber-300/40 bg-amber-950/40 text-amber-100";
  return <span className={`border px-3 py-2 uppercase tracking-widest ${classes}`}>{state.replaceAll("_", " ")}</span>;
}

function FreshnessBadge({ freshness }: { readonly freshness: Freshness }) {
  const classes = freshness === "current" ? "border-emerald-400/40 text-emerald-100" : freshness === "outage" ? "border-rose-400/40 text-rose-100" : "border-amber-300/40 text-amber-100";
  return <span className={`border px-2 py-1 text-xs font-semibold uppercase ${classes}`}>{freshness}</span>;
}

function ObservationSkeleton() {
  return (
    <section aria-busy="true" className="grid min-h-[720px] animate-pulse gap-5 border border-slate-800 bg-slate-950 p-5 lg:grid-cols-[20rem_1fr] lg:p-6">
      <div className="h-full min-h-64 bg-slate-900" />
      <div className="aspect-video min-h-96 bg-slate-900" />
    </section>
  );
}

function ObservationBoundaryState({ title, detail, retry }: { readonly title: string; readonly detail: string; readonly retry?: () => void }) {
  return (
    <section className="grid min-h-[520px] place-items-center border border-slate-800 bg-slate-950 p-8 text-center">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">NASA GIBS source state</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-4 text-sm leading-6 text-slate-300">{detail}</p>
        {retry ? <button className="mt-5 border border-cyan-300 bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={retry} type="button">Retry source check</button> : null}
      </div>
    </section>
  );
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`NASA GIBS service returned an invalid response (HTTP ${response.status}).`);
  }
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new Error(`NASA GIBS service returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || !envelope.ok) {
    throw new Error(envelope.ok ? `NASA GIBS request failed with HTTP ${response.status}.` : envelope.error);
  }
  return envelope.data;
}

function productDateBounds(product: Product | undefined) {
  if (!product) return {};
  const minimum = [...product.availableDates, ...product.temporalExtent.map((extent) => extent.start)].sort()[0];
  const maximum = [...product.availableDates, ...product.temporalExtent.map((extent) => extent.end), ...(product.defaultDate ? [product.defaultDate] : [])].sort().at(-1);
  return { minimum, maximum };
}

function dateOnly(value: string | undefined) {
  return value?.slice(0, 10) ?? "";
}

function shiftIsoDate(value: string, days: number) {
  if (!value) return "";
  const date = new Date(`${dateOnly(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function worldviewProjection(projection: Projection) {
  if (projection === "EPSG:3413") return "arctic";
  if (projection === "EPSG:3031") return "antarctic";
  return "geographic";
}

function geographicToWebMercator(bbox: BoundingBox): BoundingBox {
  const project = (longitude: number, latitude: number) => {
    const x = longitude * 20_037_508.34278925 / 180;
    const limitedLatitude = Math.max(-85.051129, Math.min(85.051129, latitude));
    const y = Math.log(Math.tan((90 + limitedLatitude) * Math.PI / 360)) / (Math.PI / 180) * 20_037_508.34278925 / 180;
    return { x, y };
  };
  const southwest = project(bbox.west, bbox.south);
  const northeast = project(bbox.east, bbox.north);
  return { west: southwest.x, south: southwest.y, east: northeast.x, north: northeast.y };
}

function manifestTileTemplate(manifest: MapManifest) {
  if (
    manifest.templateId !== "gibs-wmts-rest-v1" ||
    manifest.serviceType !== "WMTS" ||
    manifest.projection !== "EPSG:3857" ||
    manifest.endpointId !== "nasa-gibs-wmts-epsg3857-best" ||
    !manifest.tileMatrixSet ||
    !manifest.signature ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(manifest.nasaLayerId) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(manifest.tileMatrixSet)
  ) return undefined;
  const extension = manifest.format === "image/jpeg" || manifest.format === "image/jpg" ? "jpg" : manifest.format === "image/webp" ? "webp" : "png";
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${encodeURIComponent(manifest.nasaLayerId)}/default/${encodeURIComponent(manifest.date)}/${encodeURIComponent(manifest.tileMatrixSet)}/{z}/{y}/{x}.${extension}`;
}

async function reportTileFailure(productId: string) {
  try {
    await apiRequest<NasaGibsTileFailure>(`${connectorPath}/tile-failures`, {
      method: "POST",
      body: JSON.stringify({ productId, failureKind: "unknown" }),
    });
  } catch {
    // Tile telemetry must never cascade into a viewer failure.
  }
}

type NasaGibsTileFailure = {
  readonly productId: string;
  readonly failureKind: "network" | "http" | "decode" | "unknown";
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}
