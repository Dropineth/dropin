import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_SCENE_EMBEDS, SCENE_SOURCES, VIEWER_TIMEOUT_MS, evaluateSceneEmbed, getScene,
  isExactHttpsUrl, isTrustedSceneReady, nextViewerPhase, observeSceneReadiness,
  parseSceneRegistry, primaryScenes, scenes, viewerDeviceFallback, type EmbedApproval, type Scene,
} from "../../apps/web/src/data/life/scenes";

// This is a mock adapter only. No real source or real permission is claimed by these fixtures.
const mockUrl = "https://scene-adapter.example.test/scenes/31";
const mockScene: Scene = { ...getScene("31")!, embedUrl: mockUrl, embedStatus: "approved", thirdPartyRightsVerified: true, rightsStatus: "display_embed_confirmed", transportStatus: "https_embed_verified" };
const mockApproval: EmbedApproval = {
  sceneId: "31", sourceUrl: SCENE_SOURCES["31"], embedUrl: mockUrl,
  displayAndEmbedPermission: "FIXTURE_PERMISSION", httpsAndSubresourcesReview: "FIXTURE_HTTPS",
  redirectReview: "FIXTURE_REDIRECT", sourceFramePolicyReview: "FIXTURE_SOURCE_POLICY",
  siteFrameSrcReview: "FIXTURE_SITE_CSP", browserAcceptanceReview: "FIXTURE_BROWSER",
  handshakeProtocol: "lifepp-scene-v1",
};
const sessionId = "1234567890abcdef1234567890abcdef";
const frameWindow = {};
const expected = { origin: "https://scene-adapter.example.test", source: frameWindow, sceneId: "31" as const, sessionId };
const message = { type: "lifepp:scene-ready", protocol: 1, sceneId: "31", sessionId };

function freshRegistry() { return scenes.map((scene) => ({ ...scene })); }

test("supplied scene identity, null unknowns and disabled defaults are preserved", () => {
  assert.deepEqual(scenes.map((scene) => scene.id), ["33", "29", "31"]);
  for (const scene of scenes) {
    assert.equal(scene.sourceUrl, SCENE_SOURCES[scene.id]);
    for (const field of ["embedUrl", "thumbnail", "captureDate", "location", "captureProvider", "assetFormat", "assetVersion"] as const) assert.equal(scene[field], null);
    assert.equal(scene.rightsStatus, "pending_confirmation");
    assert.equal(scene.transportStatus, "http_source_provided_https_unverified");
    assert.equal(scene.embedStatus, "disabled");
    assert.equal(scene.navigationStatus, "not_validated");
    assert.equal(scene.verificationStatus, "unverified_test_input");
    assert.equal(evaluateSceneEmbed(scene).allowed, false);
    assert.equal(Object.isFrozen(scene), true);
  }
  assert.deepEqual(primaryScenes.map(scene => scene.id), ["33", "29"]);
  assert.equal(getScene("31")?.legacy, true);
  assert.ok(primaryScenes.every(scene => !scene.legacy && scene.userDisplayInstructionReceived));
  assert.ok(scenes.every(scene => !scene.thirdPartyRightsVerified && scene.roomBinding === null));
  assert.deepEqual(APPROVED_SCENE_EMBEDS, []);
  assert.equal(Object.isFrozen(scenes), true);
  for (const id of ["30", "031", "__proto__", "toString", "https://evil.test/"]) assert.equal(getScene(id), undefined);
});

test("runtime validation rejects unknown, duplicate, missing and corrupted scene input", () => {
  for (const input of [null, {}, [], [scenes[0]], [scenes[0], scenes[0]], [scenes[0], scenes[0], scenes[2]], [{ ...scenes[0], id: "toString" }, scenes[1], scenes[2]]]) assert.throws(() => parseSceneRegistry(input));
  for (const patch of [
    { sourceUrl: "https://kjlying.com:8456/scenes/31" }, { captureProvider: "" }, { thumbnail: "https://evil.test/image.jpg" },
    { embedUrl: "http://kjlying.com:8456/scenes/31" }, { primary: false }, { legacy: true }, { roomBinding: "L201" }, { thirdPartyRightsVerified: "true" }, { verificationStatus: "verified" }, { captureDate: undefined }, { id: 31 },
  ]) assert.throws(() => parseSceneRegistry([{ ...scenes[0], ...patch }, scenes[1], scenes[2]]));
  assert.deepEqual(parseSceneRegistry(freshRegistry()), scenes);
});

test("malicious URLs and unapproved HTTPS cannot bypass embed gate", () => {
  for (const address of [
    "http://scene-adapter.example.test/scenes/31", "javascript:alert(1)", "data:text/html,bad", "file:///etc/passwd", "//evil.test/",
    "https://user:secret@scene-adapter.example.test/scenes/31", "https://scene-adapter.example.test.evil.test/scenes/31",
    "https://evil.test/scenes/31", "https://scene-adapter.example.test/scenes/31?next=https://evil.test/",
    "https://scene-adapter.example.test/scenes/31#fragment", "https://scene-adapter.example.test:443/scenes/31",
    "https://scene-adapter.example.test./scenes/31", " https://scene-adapter.example.test/scenes/31",
  ]) assert.equal(evaluateSceneEmbed({ ...mockScene, embedUrl: address }, [mockApproval]).allowed, false, address);
  assert.equal(isExactHttpsUrl(null), false);
  assert.equal(isExactHttpsUrl("https://example.test/"), true);
  assert.equal(evaluateSceneEmbed(mockScene).allowed, false, "Production approvals are empty even for a fully populated fixture");
  assert.equal(evaluateSceneEmbed(mockScene, [mockApproval]).allowed, true, "Fixture gate only");
  for (const key of ["displayAndEmbedPermission", "httpsAndSubresourcesReview", "redirectReview", "sourceFramePolicyReview", "siteFrameSrcReview", "browserAcceptanceReview"] as const) {
    assert.equal(evaluateSceneEmbed(mockScene, [{ ...mockApproval, [key]: "" }]).allowed, false, key);
  }
  for (const patch of [{ thirdPartyRightsVerified: false }, { rightsStatus: "pending_confirmation" as const }, { transportStatus: "http_source_provided_https_unverified" as const }, { embedStatus: "disabled" as const }, { sourceUrl: "http://evil.test/31" }]) assert.equal(evaluateSceneEmbed({ ...mockScene, ...patch }, [mockApproval]).allowed, false);
});

test("readiness handshake requires exact origin, source, schema and current session", () => {
  assert.equal(isTrustedSceneReady({ ...expected, data: message }, expected), true);
  for (const event of [
    { origin: "https://evil.test", source: frameWindow, data: message },
    { origin: `${expected.origin}.evil.test`, source: frameWindow, data: message },
    { origin: "null", source: frameWindow, data: message },
    { origin: expected.origin, source: {}, data: message },
    ...[null, "ready", [], { ...message, protocol: "1" }, { ...message, sceneId: "29" }, { ...message, sessionId: "old-session" }, { ...message, extra: true }, { type: "ready" }].map((data) => ({ origin: expected.origin, source: frameWindow, data })),
  ]) assert.equal(isTrustedSceneReady(event, expected), false);
  assert.equal(isTrustedSceneReady({ ...expected, data: message }, { ...expected, source: null }), false);
});

test("viewer lifecycle does not promote iframe load or late readiness to ready", () => {
  assert.equal(nextViewerPhase("idle", "load"), "loading");
  assert.equal(nextViewerPhase("loading", "document-loaded"), "loading");
  assert.equal(nextViewerPhase("loading", "authenticated-ready"), "ready");
  assert.equal(nextViewerPhase("loading", "timeout"), "timeout");
  assert.equal(nextViewerPhase("timeout", "authenticated-ready"), "timeout");
  assert.equal(nextViewerPhase("timeout", "load"), "loading");
  assert.equal(nextViewerPhase("loading", "error"), "error");
  assert.equal(nextViewerPhase("error", "load"), "loading");
  assert.equal(nextViewerPhase("ready", "destroy"), "destroyed");
  assert.equal(nextViewerPhase("destroyed", "authenticated-ready"), "destroyed");
  assert.equal(viewerDeviceFallback({ mobile: true, webgl: true }), "mobile");
  assert.equal(viewerDeviceFallback({ mobile: false, webgl: false }), "unsupported");
  assert.equal(viewerDeviceFallback({ mobile: false, webgl: true }), null);
});

function readinessHarness() {
  const events = new EventTarget();
  let expiry = () => {};
  let cancelled = 0;
  let ready = 0;
  let timeout = 0;
  const cleanup = observeSceneReadiness({
    events, ...expected, getSource: () => frameWindow,
    onReady: () => { ready += 1; }, onTimeout: () => { timeout += 1; },
    schedule: (callback, ms) => { assert.equal(ms, VIEWER_TIMEOUT_MS); expiry = callback; return 1 as unknown as ReturnType<typeof setTimeout>; },
    cancel: () => { cancelled += 1; },
  });
  const send = (data: unknown, origin = expected.origin, source: unknown = frameWindow) => {
    const event = new Event("message");
    Object.assign(event, { data, origin, source });
    events.dispatchEvent(event);
  };
  return { cleanup, send, expire: () => expiry(), counts: () => ({ cancelled, ready, timeout }) };
}

test("readiness timeout releases the listener and ignores late or malicious messages", () => {
  const harness = readinessHarness();
  harness.send(message, "https://evil.test");
  assert.deepEqual(harness.counts(), { cancelled: 0, ready: 0, timeout: 0 });
  harness.expire(); harness.send(message); harness.expire(); harness.cleanup();
  assert.deepEqual(harness.counts(), { cancelled: 1, ready: 0, timeout: 1 });
});

test("accepted mock handshake cancels timeout; route cleanup is idempotent and retry is independent", () => {
  const ready = readinessHarness();
  ready.send(message); ready.expire(); ready.cleanup();
  assert.deepEqual(ready.counts(), { cancelled: 1, ready: 1, timeout: 0 });
  const abandoned = readinessHarness();
  abandoned.cleanup(); abandoned.cleanup(); abandoned.send(message); abandoned.expire();
  assert.deepEqual(abandoned.counts(), { cancelled: 1, ready: 0, timeout: 0 });
  const retry = readinessHarness();
  retry.send({ ...message, sessionId: "another-attempt" }); retry.send(message);
  assert.deepEqual(retry.counts(), { cancelled: 1, ready: 1, timeout: 0 });
});

test("HEAD checker blocks malicious redirects and does not guess HTTPS or issue GET", async () => {
  const { checkSource, checkedRedirect, isAllowedSource, SOURCE_ALLOWLIST } = await import("../../scripts/lifepp-scene-check.mjs");
  const source = SCENE_SOURCES["31"];
  assert.deepEqual(SOURCE_ALLOWLIST, scenes.map(scene => scene.sourceUrl));
  for (const value of ["https://kjlying.com:8456/scenes/31", "http://evil.test/", "http://user:secret@kjlying.com:8456/scenes/31", `${source}?q=1`, `${source}#x`]) assert.equal(isAllowedSource(value), false);
  for (const location of ["https://kjlying.com:8456/scenes/31", "http://127.0.0.1/", "//evil.test/", "javascript:alert(1)", "http://user:pass@kjlying.com:8456/scenes/29"]) assert.equal(checkedRedirect(source, location), null);
  let requests = 0;
  const result = await checkSource(source, async () => { requests += 1; return { statusCode: 302, headers: { location: "http://127.0.0.1/" } }; });
  assert.equal(result.status, "blocked_redirect_outside_allowlist");
  assert.equal(requests, 1);
  const invalid = await checkSource("http://evil.test/", async () => { throw new Error("must not fetch"); });
  assert.equal(invalid.status, "blocked_non_allowlist");
  const failed = await checkSource(source, async () => { throw new Error("FIXTURE_TIMEOUT"); });
  assert.equal(failed.status, "unverified_access_failed");
  const loop = await checkSource(source, async () => ({ statusCode: 302, headers: { location: source } }));
  assert.equal(loop.status, "unverified_redirect_loop");
});
