import manifest from "./site-manifest.json";

export const SCENE_SOURCES = Object.freeze({
  "33": "http://kjlying.com:8456/scenes/33",
  "31": "http://kjlying.com:8456/scenes/31",
  "29": "http://kjlying.com:8456/scenes/29",
} as const);
export type SceneId = keyof typeof SCENE_SOURCES;
export type Scene = Readonly<{
  id: SceneId;
  primary: boolean;
  legacy: boolean;
  roomBinding: null;
  userDisplayInstructionReceived: boolean;
  thirdPartyRightsVerified: boolean;
  titleZh: string;
  titleEn: string;
  sourceUrl: string;
  embedUrl: string | null;
  thumbnail: string | null;
  captureDate: string | null;
  location: string | null;
  captureProvider: string | null;
  assetFormat: string | null;
  assetVersion: string | null;
  sourceDescription: string;
  rightsStatus: "pending_confirmation" | "display_embed_confirmed";
  transportStatus: "http_source_provided_https_unverified" | "https_embed_verified";
  embedStatus: "disabled" | "approved";
  navigationStatus: "not_validated";
  verificationStatus: "unverified_test_input";
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Exact canonical addresses only: no credentials, query, fragment, normalization or alternate hosts. */
export function isExactHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash && url.href === value && !url.hostname.endsWith(".");
  } catch { return false; }
}

export function parseSceneRegistry(input: unknown): readonly Scene[] {
  if (!Array.isArray(input) || input.length !== 3) throw new Error("Expected two primary scenes and one legacy scene");
  const ids = new Set<string>();
  const nullableFields = ["thumbnail", "captureDate", "location", "captureProvider", "assetFormat", "assetVersion"] as const;
  const parsed = input.map((entry): Scene => {
    if (!isRecord(entry) || !Object.hasOwn(SCENE_SOURCES, String(entry.id))) throw new Error("Unknown scene id");
    const id = entry.id as SceneId;
    if (typeof entry.id !== "string" || ids.has(id) || entry.sourceUrl !== SCENE_SOURCES[id]) throw new Error("Invalid scene source identity");
    ids.add(id);
    if (entry.primary !== (id !== "31") || entry.legacy !== (id === "31") ||
        entry.roomBinding !== null || entry.userDisplayInstructionReceived !== (id !== "31") ||
        typeof entry.thirdPartyRightsVerified !== "boolean") throw new Error("Invalid scene role or rights provenance");
    for (const field of ["titleZh", "titleEn", "sourceDescription"] as const) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0 || entry[field].length > 300) throw new Error(`Invalid scene ${field}`);
    }
    for (const field of nullableFields) {
      if (entry[field] !== null && (typeof entry[field] !== "string" || entry[field].trim().length === 0 || entry[field].length > 300)) throw new Error(`Invalid scene ${field}`);
    }
    // Future thumbnails must be reviewed local assets; no remote image request on initial render.
    if (entry.thumbnail !== null && !/^\/life\/assets\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(String(entry.thumbnail))) throw new Error("Invalid scene thumbnail");
    if (entry.captureDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.captureDate))) throw new Error("Invalid capture date");
    if (entry.embedUrl !== null && !isExactHttpsUrl(entry.embedUrl)) throw new Error("Embed URL must be canonical HTTPS");
    if ((typeof entry.rightsStatus !== "string" || !["pending_confirmation", "display_embed_confirmed"].includes(entry.rightsStatus)) ||
        (typeof entry.transportStatus !== "string" || !["http_source_provided_https_unverified", "https_embed_verified"].includes(entry.transportStatus)) ||
        (typeof entry.embedStatus !== "string" || !["disabled", "approved"].includes(entry.embedStatus)) ||
        entry.navigationStatus !== "not_validated" || entry.verificationStatus !== "unverified_test_input") throw new Error("Invalid scene status");
    // Do not pass through unexpected manifest keys to browser code.
    return Object.freeze({
      id, primary: id !== "31", legacy: id === "31", roomBinding: null,
      userDisplayInstructionReceived: entry.userDisplayInstructionReceived as boolean,
      thirdPartyRightsVerified: entry.thirdPartyRightsVerified as boolean, titleZh: entry.titleZh as string, titleEn: entry.titleEn as string,
      sourceUrl: SCENE_SOURCES[id], embedUrl: entry.embedUrl as string | null,
      thumbnail: entry.thumbnail as string | null, captureDate: entry.captureDate as string | null,
      location: entry.location as string | null, captureProvider: entry.captureProvider as string | null,
      assetFormat: entry.assetFormat as string | null, assetVersion: entry.assetVersion as string | null,
      sourceDescription: entry.sourceDescription as string, rightsStatus: entry.rightsStatus as Scene["rightsStatus"],
      transportStatus: entry.transportStatus as Scene["transportStatus"], embedStatus: entry.embedStatus as Scene["embedStatus"],
      navigationStatus: "not_validated", verificationStatus: "unverified_test_input",
    });
  });
  return Object.freeze(parsed);
}

export const scenes = parseSceneRegistry(manifest.scenes);
export const primaryScenes = Object.freeze(scenes.filter((scene) => scene.primary));
export function getScene(id: string): Scene | undefined { return scenes.find((scene) => scene.id === id); }

/** Evidence references must be backed by a separate review, never inferred from HEAD or an iframe load. */
export type EmbedApproval = Readonly<{
  sceneId: SceneId;
  sourceUrl: string;
  embedUrl: string;
  displayAndEmbedPermission: string;
  httpsAndSubresourcesReview: string;
  redirectReview: string;
  sourceFramePolicyReview: string;
  siteFrameSrcReview: string;
  browserAcceptanceReview: string;
  handshakeProtocol: "lifepp-scene-v1";
}>;

// Empty by design. There is no verified HTTPS address, permission, frame policy, or browser acceptance.
// Changing this requires evidence and a separately reviewed exact CSP frame-src change.
export const APPROVED_SCENE_EMBEDS: readonly EmbedApproval[] = Object.freeze([]);
export type EmbedGate = { allowed: false; reason: "disabled" | "unverified" | "unapproved" } | { allowed: true; url: string; origin: string };

export function evaluateSceneEmbed(scene: Scene, approvals: readonly EmbedApproval[] = APPROVED_SCENE_EMBEDS): EmbedGate {
  if (scene.embedStatus !== "approved" || !scene.embedUrl) return { allowed: false, reason: "disabled" };
  if (!Object.hasOwn(SCENE_SOURCES, scene.id) || scene.sourceUrl !== SCENE_SOURCES[scene.id] ||
      !isExactHttpsUrl(scene.embedUrl) || scene.thirdPartyRightsVerified !== true || scene.rightsStatus !== "display_embed_confirmed" ||
      scene.transportStatus !== "https_embed_verified") return { allowed: false, reason: "unverified" };
  const approval = approvals.find((item) => item.sceneId === scene.id && item.sourceUrl === scene.sourceUrl && item.embedUrl === scene.embedUrl);
  const evidenceKeys = ["displayAndEmbedPermission", "httpsAndSubresourcesReview", "redirectReview", "sourceFramePolicyReview", "siteFrameSrcReview", "browserAcceptanceReview"] as const;
  if (!approval || approval.handshakeProtocol !== "lifepp-scene-v1" || evidenceKeys.some((key) => typeof approval[key] !== "string" || approval[key].trim().length === 0)) return { allowed: false, reason: "unapproved" };
  return { allowed: true, url: scene.embedUrl, origin: new URL(scene.embedUrl).origin };
}

export type ViewerPhase = "idle" | "loading" | "ready" | "timeout" | "error" | "unsupported" | "mobile" | "destroyed";
export type ViewerEvent = "load" | "document-loaded" | "authenticated-ready" | "timeout" | "error" | "unsupported" | "mobile" | "destroy";
export function nextViewerPhase(phase: ViewerPhase, event: ViewerEvent): ViewerPhase {
  if (event === "destroy") return "destroyed";
  if (event === "load" && phase !== "loading" && phase !== "ready") return "loading";
  if (event === "mobile" || event === "unsupported") return event;
  if (event === "error" && (phase === "loading" || phase === "ready")) return "error";
  if (event === "timeout" && phase === "loading") return "timeout";
  if (event === "authenticated-ready" && phase === "loading") return "ready";
  // iframe onLoad deliberately cannot transition to ready.
  return phase;
}

export function viewerDeviceFallback(input: { mobile: boolean; webgl: boolean }): "mobile" | "unsupported" | null {
  return input.mobile ? "mobile" : input.webgl ? null : "unsupported";
}

export type SceneReadyMessage = { type: "lifepp:scene-ready"; protocol: 1; sceneId: SceneId; sessionId: string };
/** Proposed adapter protocol, tested only with fixtures. No claim that either supplied source implements it. */
export function isTrustedSceneReady(
  event: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown; sceneId: SceneId; sessionId: string },
): event is { origin: string; source: unknown; data: SceneReadyMessage } {
  if (!expected.source || !/^https:\/\//.test(expected.origin) || !/^[a-f0-9]{32}$/.test(expected.sessionId) ||
      event.origin !== expected.origin || event.source !== expected.source || !isRecord(event.data)) return false;
  const keys = Object.keys(event.data).sort();
  return keys.join(",") === "protocol,sceneId,sessionId,type" && event.data.type === "lifepp:scene-ready" &&
    event.data.protocol === 1 && event.data.sceneId === expected.sceneId && event.data.sessionId === expected.sessionId;
}

export const VIEWER_TIMEOUT_MS = 12000;
/** Owns one frame's listeners and finite readiness timer; cleanup is idempotent. */
export function observeSceneReadiness(options: {
  events: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  getSource: () => unknown;
  origin: string;
  sceneId: SceneId;
  sessionId: string;
  onReady: () => void;
  onTimeout: () => void;
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}): () => void {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    cancel(timer);
    options.events.removeEventListener("message", onMessage);
  };
  const onMessage: EventListener = (raw) => {
    const event = raw as MessageEvent<unknown>;
    if (active && isTrustedSceneReady(event, { origin: options.origin, source: options.getSource(), sceneId: options.sceneId, sessionId: options.sessionId })) {
      cleanup();
      options.onReady();
    }
  };
  options.events.addEventListener("message", onMessage);
  const timer = schedule(() => { if (active) { cleanup(); options.onTimeout(); } }, VIEWER_TIMEOUT_MS);
  return cleanup;
}
