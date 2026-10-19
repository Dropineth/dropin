"use client";

import { evaluateSceneEmbed, type Scene } from "../../data/life/scenes";
import { sceneSessionKey } from "../../data/life/scene-session";
import { SceneViewer as SceneViewerSession } from "./SceneViewerSession";

/** A changed source, permission or asset revision must not inherit an earlier consent/session. */
export function SceneViewer({ scene, locale }: { scene: Scene; locale: "zh" | "en" }) {
  const sessionKey = sceneSessionKey(scene, evaluateSceneEmbed(scene));
  // Remount the entire session, including its error boundary, iframe, timer and listeners.
  // The original session implementation retains all HTTPS, approval and device checks.
  return <SceneViewerSession key={sessionKey} scene={scene} locale={locale} />;
}
