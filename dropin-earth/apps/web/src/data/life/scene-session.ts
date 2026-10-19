import type { EmbedGate, Scene } from "./scenes";

/**
 * React lifecycle identity only: not a signature, authorization or evidence hash.
 * Explicit ordered fields avoid accidental remounts due to object property order.
 * Display titles/locale do not alter consent; source, asset and permission revisions do.
 */
export function sceneSessionKey(scene: Scene, gate: EmbedGate): string {
  return JSON.stringify([
    "lifepp-scene-session-v1",
    scene.id, scene.sourceUrl, scene.embedUrl,
    scene.assetFormat, scene.assetVersion, scene.captureDate, scene.captureProvider,
    scene.location, scene.roomBinding,
    scene.rightsStatus, scene.transportStatus, scene.embedStatus,
    scene.userDisplayInstructionReceived, scene.thirdPartyRightsVerified,
    scene.verificationStatus, scene.navigationStatus,
    gate.allowed ? ["allowed", gate.url, gate.origin] : ["blocked", gate.reason],
  ]);
}
