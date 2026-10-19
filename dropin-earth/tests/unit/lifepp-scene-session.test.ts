import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_SCENE_EMBEDS, evaluateSceneEmbed, getScene, scenes, type EmbedGate, type Scene } from "../../apps/web/src/data/life/scenes";
import { sceneSessionKey } from "../../apps/web/src/data/life/scene-session";

const original = getScene("33")!;
const blocked: EmbedGate = { allowed: false, reason: "disabled" };

test("session identity is deterministic and does not depend on property insertion order", () => {
  const reordered = Object.fromEntries(Object.entries(original).reverse()) as Scene;
  assert.equal(sceneSessionKey(original, blocked), sceneSessionKey(reordered, blocked));
  assert.equal(sceneSessionKey(original, blocked), sceneSessionKey({ ...original }, blocked));
});

test("same scene ID cannot carry consent across source, asset or permission changes", () => {
  const revisions: Partial<Scene>[] = [
    { sourceUrl: "https://fixture.example.test/changed" },
    { embedUrl: "https://fixture.example.test/scene/33" },
    { assetFormat: "fixture-ply" }, { assetVersion: "fixture-v2" },
    { captureDate: "2026-10-19" }, { captureProvider: "fixture-provider" },
    { location: "fixture-location" },
    { rightsStatus: "display_embed_confirmed" }, { transportStatus: "https_embed_verified" },
    { embedStatus: "approved" }, { userDisplayInstructionReceived: false },
    { thirdPartyRightsVerified: true },
  ];
  for (const revision of revisions) {
    assert.notEqual(sceneSessionKey(original, blocked), sceneSessionKey({ ...original, ...revision }, blocked), JSON.stringify(revision));
  }
});

test("gate revocation and approved URL changes invalidate the session identity", () => {
  const allowed: EmbedGate = { allowed: true, url: "https://fixture.example.test/one", origin: "https://fixture.example.test" };
  assert.notEqual(sceneSessionKey(original, allowed), sceneSessionKey(original, blocked));
  assert.notEqual(sceneSessionKey(original, allowed), sceneSessionKey(original, { ...allowed, url: "https://fixture.example.test/two" }));
  assert.notEqual(sceneSessionKey(original, blocked), sceneSessionKey(original, { allowed: false, reason: "unapproved" }));
});

test("a title translation alone does not change the accepted source identity", () => {
  assert.equal(sceneSessionKey(original, blocked), sceneSessionKey({ ...original, titleZh: "测试名称", titleEn: "Fixture title" }, blocked));
});

test("lifecycle hardening does not approve any real scene or enable third-party loading", () => {
  assert.deepEqual(APPROVED_SCENE_EMBEDS, []);
  for (const scene of scenes) {
    const before = JSON.stringify(scene);
    sceneSessionKey(scene, evaluateSceneEmbed(scene));
    assert.equal(JSON.stringify(scene), before);
    assert.equal(evaluateSceneEmbed(scene).allowed, false);
    assert.equal(scene.embedStatus, "disabled");
    assert.equal(scene.navigationStatus, "not_validated");
  }
});
