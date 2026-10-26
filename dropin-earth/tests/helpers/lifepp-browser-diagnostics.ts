import type { Page, Request, Response } from "playwright";

const limit = 32;
export const diagnosticTimeoutMs = 2_000;

// Never retain credentials, queries, fragments, headers, bodies, DOM text or
// arbitrary URL path segments. Third-party URLs are represented only by a label.
export function diagnosticUrl(value: string, origin: string) {
  try {
    const url = new URL(value);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.origin !== origin) return "[non-local]";
    if (/^\/(en\/)?life(?:\/(?:spaces(?:\/(?:29|31|33))?|center|partners|about|solutions|technology|contact|inquiries))?\/?$/.test(url.pathname)) return url.pathname;
    if (url.pathname.startsWith("/_next/")) return "/_next/[asset]";
    return "[local resource]";
  } catch { return "[unavailable]"; }
}

export function diagnosticError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /timed? ?out|Timeout/i.test(message) ? "timeout"
    : /closed|crash/i.test(message) ? "page-or-browser-closed"
    : /captureScreenshot|capture screenshot/i.test(message) ? "screenshot-protocol-error"
    : "diagnostic-error";
}

export async function boundedDiagnostic<T>(task: () => Promise<T>, timeoutMs = diagnosticTimeoutMs): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Diagnostic timeout")), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function trackDiagnosticRequests(page: Page, origin: string) {
  const active = new Map<Request, { url: string; resourceType: string; startedAt: number; status?: number }>();
  const recent: unknown[] = [];
  let dropped = 0;
  let crashed = false;
  const onRequest = (request: Request) => {
    if (active.size >= limit) { dropped++; return; }
    active.set(request, { url: diagnosticUrl(request.url(), origin), resourceType: request.resourceType(), startedAt: Date.now() });
  };
  const onResponse = (response: Response) => {
    const entry = active.get(response.request());
    if (entry) entry.status = response.status();
  };
  const finish = (request: Request, outcome: string) => {
    const entry = active.get(request);
    if (!entry) return;
    const { startedAt, ...metadata } = entry;
    recent.push({ ...metadata, outcome, durationMs: Date.now() - startedAt });
    if (recent.length > limit) recent.shift();
    active.delete(request);
  };
  const onFinished = (request: Request) => finish(request, "finished");
  const onFailed = (request: Request) => finish(request, "failed");
  const onCrash = () => { crashed = true; };
  page.on("request", onRequest); page.on("response", onResponse);
  page.on("requestfinished", onFinished); page.on("requestfailed", onFailed); page.on("crash", onCrash);
  return {
    snapshot: () => ({ url: diagnosticUrl(page.url(), origin), closed: page.isClosed(), crashed, limit, dropped,
      pending: Array.from(active.values(), ({ startedAt, ...metadata }) => ({ ...metadata, elapsedMs: Date.now() - startedAt })), recent: [...recent] }),
    dispose: () => {
      page.off("request", onRequest); page.off("response", onResponse);
      page.off("requestfinished", onFinished); page.off("requestfailed", onFailed); page.off("crash", onCrash);
      active.clear(); recent.length = 0;
    },
  };
}

export async function sampleDiagnosticPage(page: Page, origin: string) {
  // A script string avoids tsx keepNames helpers leaking into the browser realm.
  return boundedDiagnostic(() => page.evaluate(String.raw`(() => {
    const origin = ${JSON.stringify(origin)};
    const limit = ${limit};
    if (location.origin !== origin || !["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)) return { skipped: "non-local-document" };
    const dimensions = (element) => element ? ({
      scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
      offsetWidth: element.offsetWidth, offsetHeight: element.offsetHeight,
      clientWidth: element.clientWidth, clientHeight: element.clientHeight,
    }) : null;
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
    };
    const layout = (element) => {
      const style = getComputedStyle(element);
      return { tag: element.tagName, rect: box(element), display: style.display, position: style.position,
        overflowX: style.overflowX, overflowY: style.overflowY, gridTemplateColumns: style.gridTemplateColumns.slice(0, 256),
        gridTemplateRows: style.gridTemplateRows.slice(0, 256), transform: style.transform.slice(0, 256) };
    };
    const body = dimensions(document.body), html = dimensions(document.documentElement);
    const images = Array.from(document.images);
    const viewers = document.querySelectorAll("[data-scene-id]");
    const grids = document.querySelectorAll('[class*="grid"], [class*="Grid"]');
    const active = document.activeElement;
    return {
      readyState: document.readyState, visibilityState: document.visibilityState,
      scroll: { x: scrollX, y: scrollY }, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, pageLeft: visualViewport.pageLeft, pageTop: visualViewport.pageTop, scale: visualViewport.scale } : null,
      body, html,
      fullPage: { width: Math.max(body?.scrollWidth ?? 0, body?.offsetWidth ?? 0, body?.clientWidth ?? 0, html?.scrollWidth ?? 0, html?.offsetWidth ?? 0, html?.clientWidth ?? 0),
        height: Math.max(body?.scrollHeight ?? 0, body?.offsetHeight ?? 0, body?.clientHeight ?? 0, html?.scrollHeight ?? 0, html?.offsetHeight ?? 0, html?.clientHeight ?? 0) },
      activeElement: active ? { tag: active.tagName, rect: box(active) } : null,
      fonts: { status: document.fonts.status, count: document.fonts.size },
      images: { count: images.length, incomplete: images.filter(image => !image.complete).length,
        sampled: images.slice(0, limit).map((image, index) => ({ index, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, loading: image.loading, rect: box(image) })) },
      viewers: { count: viewers.length, sampled: Array.from(viewers).slice(0, limit).map(element => ({ ...layout(element), state: ["blocked", "idle", "loading", "ready", "error", "timeout", "destroyed"].find(state => state === element.getAttribute("data-viewer-state")) ?? "other" })) },
      grids: { count: grids.length, sampled: Array.from(grids).slice(0, limit).map(layout) },
    };
  })()`));
}
