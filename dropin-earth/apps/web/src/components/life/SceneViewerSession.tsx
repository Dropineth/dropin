"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { SectionBoundary } from "../system/SectionBoundary";
import {
  evaluateSceneEmbed, nextViewerPhase, observeSceneReadiness, viewerDeviceFallback,
  type Scene,
} from "../../data/life/scenes";
import styles from "./SceneViewer.module.css";

type Props = { scene: Scene; locale: "zh" | "en" };
const copy = {
  zh: {
    viewer: "空间查看器", placeholder: "空间示意图 · 非实景照片", pending: "站内浏览暂未开放",
    explanation: "这项三维场景资料仍待核实。场景内容、展示许可和安全浏览地址确认后，才可在本站开放查看。",
    prerequisite: "开放浏览前需确认", requirements: ["场景及相关内容使用安全连接", "来源方允许在本站展示", "场景可在受支持的浏览器中正常打开"],
    thirdParty: "原始链接属于第三方，使用未加密的 HTTP。仅在你主动点击后离开本站；请勿提交个人信息。",
    open: "打开第三方原始链接 ↗", copy: "复制原始链接", copied: "链接已复制", copyFailed: "无法自动复制，请选择下面的原始链接手动复制。",
    consent: "我同意连接已确认的第三方来源，加载此场景。", start: "按需加载场景", retry: "重试加载", stop: "关闭查看器",
    fullscreen: "全屏", exitFullscreen: "退出全屏", fullscreenFailed: "浏览器不支持此次全屏请求；可继续在页内查看。",
    idle: "选择同意后，可加载第三方场景。", loading: "正在连接场景并确认加载状态…",
    ready: "场景已就绪，可开始浏览。此状态不表示可用于机器人导航。", timeout: "暂时无法确认场景已就绪，查看器已关闭。可重试，或查看原始来源。",
    error: "场景未能完成加载，查看器已关闭。可重试或打开原始链接。",
    unsupported: "浏览器没有可用的 WebGL。未加载场景，可使用原始链接在兼容浏览器中查看。",
    mobile: "小屏幕使用轻量模式，不启动三维查看器。可在桌面浏览器重试，或手动打开原始链接。",
    destroyed: "查看器已关闭，第三方场景已卸载。", boundary: "查看器暂不可用。原始来源信息仍可在本页查看。",
    unverified: "视觉浏览不等于导航地图；3DGS 不证明度量精度、版权或生态成果。",
  },
  en: {
    viewer: "Spatial viewer", placeholder: "Spatial illustration · not a site photo", pending: "On-site viewing is not yet available",
    explanation: "This 3D scene reference is awaiting verification. On-site viewing requires confirmed content, display permission and a secure viewing address.",
    prerequisite: "Before viewing becomes available", requirements: ["A secure connection for the scene and related content", "The source owner’s permission to display it here", "A working viewer in supported browsers"],
    thirdParty: "The original link belongs to a third party and uses unencrypted HTTP. You leave this site only when you choose to open it. Do not submit personal information.",
    open: "Open original third-party link ↗", copy: "Copy original link", copied: "Link copied", copyFailed: "Automatic copying is unavailable. Select the original link below to copy it manually.",
    consent: "I agree to connect to the approved third-party source to load this scene.", start: "Load scene on demand", retry: "Retry loading", stop: "Close viewer",
    fullscreen: "Full screen", exitFullscreen: "Exit full screen", fullscreenFailed: "This browser could not enter full screen. You can continue within the page.",
    idle: "Give your consent above to load the third-party scene.", loading: "Connecting to the scene and checking its status…",
    ready: "The scene is ready to view. This does not approve it for robot navigation.", timeout: "We could not confirm that the scene was ready, so the viewer has closed. Retry or check the original source.",
    error: "The scene could not finish loading and the viewer has closed. Retry or open the original link.",
    unsupported: "WebGL is unavailable. No scene was loaded. You can open the original link in a compatible browser.",
    mobile: "Small screens use a lightweight fallback without starting the 3D viewer. Try a desktop browser or open the original link manually.",
    destroyed: "Viewer closed and third-party content unloaded.", boundary: "The viewer is temporarily unavailable. Original source information remains on this page.",
    unverified: "Visual browsing is not a navigation map. 3DGS does not establish metric accuracy, rights or ecological outcomes.",
  },
};

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
}

function Viewer({ scene, locale }: Props) {
  const text = copy[locale];
  const gate = evaluateSceneEmbed(scene);
  const embedUrl = gate.allowed ? gate.url : null;
  const origin = gate.allowed ? gate.origin : null;
  const [phase, dispatch] = useReducer(nextViewerPhase, "idle");
  const [consent, setConsent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "copyFailed" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const alive = useRef(true);
  const mounted = sessionId !== null && embedUrl !== null && (phase === "loading" || phase === "ready");

  useEffect(() => {
    alive.current = true;
    const element = stage.current;
    const changed = () => setFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", changed);
    return () => {
      alive.current = false;
      document.removeEventListener("fullscreenchange", changed);
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
      // React removes the iframe document on unmount; the readiness effect removes its timer/listener.
    };
  }, []);

  useEffect(() => {
    if (!mounted || !origin || !sessionId) return;
    return observeSceneReadiness({
      events: window, origin, sceneId: scene.id, sessionId,
      getSource: () => frame.current?.contentWindow,
      onReady: () => dispatch("authenticated-ready"),
      onTimeout: () => { dispatch("timeout"); setSessionId(null); },
    });
  }, [mounted, origin, scene.id, sessionId]);

  useEffect(() => {
    if (!mounted && document.fullscreenElement === stage.current) void document.exitFullscreen().catch(() => undefined);
  }, [mounted]);

  function start() {
    if (!gate.allowed || !consent) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const fallback = viewerDeviceFallback({ mobile, webgl: mobile ? false : hasWebGL() });
    if (fallback) { dispatch(fallback); return; }
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      setSessionId(Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""));
      dispatch("load");
    } catch { dispatch("load"); dispatch("error"); }
  }

  function stop() {
    setSessionId(null);
    dispatch("destroy");
    if (document.fullscreenElement === stage.current) void document.exitFullscreen().catch(() => undefined);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === stage.current) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else setFullscreenFailed(true);
    } catch { setFullscreenFailed(true); }
  }

  async function copySource() {
    try { await navigator.clipboard.writeText(scene.sourceUrl); if (alive.current) setCopyStatus("copied"); }
    catch { if (alive.current) setCopyStatus("copyFailed"); }
  }

  return (
    <section className={styles.viewer} aria-label={text.viewer} data-scene-id={scene.id} data-viewer-state={gate.allowed ? phase : "blocked"}>
      <div className={styles.stage} ref={stage}>
        {mounted ? (
          <iframe
            ref={frame} src={embedUrl ?? undefined} title={locale === "zh" ? scene.titleZh : scene.titleEn}
            sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
            allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'"
            onLoad={() => {
              // An unexpected navigation after readiness invalidates that readiness.
              if (phase === "ready") { dispatch("error"); setSessionId(null); return; }
              dispatch("document-loaded");
              // A document load is only a chance to request readiness, never evidence of a ready engine.
              if (origin && sessionId) frame.current?.contentWindow?.postMessage({ type: "lifepp:request-ready", protocol: 1, sceneId: scene.id, sessionId }, origin);
            }}
            onError={() => { dispatch("error"); setSessionId(null); }}
          />
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.grid} aria-hidden="true"><span>＋</span></div>
            <span className={styles.sceneNumber}>{scene.id}</span>
            <p>{text.placeholder}</p>
          </div>
        )}
        {mounted && <div className={styles.controls}>
          <button type="button" onClick={() => void toggleFullscreen()}>{fullscreen ? text.exitFullscreen : text.fullscreen}</button>
          <button type="button" onClick={stop}>{text.stop}</button>
        </div>}
      </div>
      <div className={styles.body}>
        <span className={styles.badge}>{gate.allowed ? text.viewer : text.pending}</span>
        <p role="status" aria-live="polite">{gate.allowed ? text[phase] : text.explanation}</p>
        {fullscreenFailed && <p role="status">{text.fullscreenFailed}</p>}
        {!gate.allowed && <div className={styles.requirements}><h3>{text.prerequisite}</h3><ul>{text.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        {gate.allowed && !mounted && <>
          <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />{text.consent}</label>
          <button type="button" disabled={!consent} className={styles.primary} onClick={start}>{phase === "idle" ? text.start : text.retry}</button>
        </>}
        <div className={styles.source}>
          <p>{text.thirdParty}</p>
          <div className={styles.actions}>
            <a href={scene.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{text.open}</a>
            <button type="button" onClick={() => void copySource()}>{text.copy}</button>
          </div>
          <code>{scene.sourceUrl}</code>
          {copyStatus && <p role="status">{text[copyStatus]}</p>}
        </div>
        <p className={styles.note}>{text.unverified}</p>
      </div>
    </section>
  );
}

export function SceneViewer(props: Props) {
  return <SectionBoundary label="LifeSceneViewer" fallback={<p role="status">{copy[props.locale].boundary}</p>}>
    <Viewer key={props.scene.id} {...props} />
  </SectionBoundary>;
}
