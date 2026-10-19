"use client";

import { useEffect, useId, useRef, useState } from "react";
import { referenceLand } from "./referenceLand";
import { LIFEPP_PUBLIC_BRAND } from "@/data/life/public-brand";
import manifest from "@/data/life/site-manifest.json";
import styles from "./ReferenceGlobe.module.css";

type GlobeControls = { rotate: (degrees: number) => void; toggle: () => void };
type Vector = readonly [number, number, number];
type Texture = { pixels: Uint8ClampedArray; width: number; height: number };
type TextureMap = {
  pixels: ImageData;
  longitude: Float32Array;
  row: Uint32Array;
  light: Float32Array;
};

const RAD = Math.PI / 180;
const TILT = 12 * RAD;
const COS_TILT = Math.cos(TILT);
const SIN_TILT = Math.sin(TILT);
const MAX_DPR = 1.5;
const MAX_TEXTURE_SPHERE = 512;
const FRAME_INTERVAL = 1000 / 30;
const anchors = [
  { latitude: 6.8, longitude: -5.3, color: "#58c1ae" },
  { latitude: 22.7, longitude: 113.8, color: "#b399f0" },
] as const;

function vector(latitude: number, longitude: number): Vector {
  const lat = latitude * RAD;
  const lon = longitude * RAD;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

// Precompute this small supplied reference layer once, including for a texture-load failure.
const landVectors = referenceLand.map((ring) => ring.map(([lon, lat]) => vector(lat, lon)));
const wrapLongitude = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

/** A bounded, local reference renderer. It does not render or validate project geometry. */
export function ReferenceGlobe({ locale, compact = false }: { locale: "en" | "zh"; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<GlobeControls | null>(null);
  const [backend, setBackend] = useState<"initializing" | "canvas" | "static">("initializing");
  const [spinning, setSpinning] = useState(false);
  const captionId = useId();
  const zh = locale === "zh";

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    let context: CanvasRenderingContext2D | null = null;
    try { context = canvas.getContext("2d", { alpha: true }); } catch { /* DOM fallback below. */ }
    if (!context) {
      setBackend("static");
      return;
    }
    const c = context;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const abort = new AbortController();
    const { signal } = abort;
    const bitmap = document.createElement("canvas");
    const bitmapContext = bitmap.getContext("2d");
    let disposed = false;
    let frameId = 0;
    let lastTime = 0;
    let lastDraw = -FRAME_INTERVAL;
    let dirty = true;
    let firstDraw = true;
    let inViewport = true;
    let spin = !motion.matches;
    let longitude = 35;
    let drag: { x: number; pointerId: number } | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let texture: Texture | null = null;
    let textureMap: TextureMap | null = null;
    setSpinning(spin);

    function project(point: Vector, radius: number, cx: number, cy: number) {
      const cos = Math.cos(longitude * RAD);
      const sin = Math.sin(longitude * RAD);
      const depth = point[0] * cos + point[2] * sin;
      return {
        x: cx + (point[2] * cos - point[0] * sin) * radius,
        y: cy - (point[1] * COS_TILT - depth * SIN_TILT) * radius,
        z: depth * COS_TILT + point[1] * SIN_TILT,
      };
    }

    function prepareTexture() {
      if (!texture || !bitmapContext) return;
      const radius = Math.min(width * .355, height * .405);
      const size = Math.max(32, Math.min(MAX_TEXTURE_SPHERE, Math.ceil(radius * 2 * dpr)));
      bitmap.width = size;
      bitmap.height = size;
      const pixels = bitmapContext.createImageData(size, size);
      const longitudes = new Float32Array(size * size);
      const rows = new Uint32Array(size * size);
      const light = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = y * size + x;
          const sx = (x + .5) / size * 2 - 1;
          const sy = 1 - (y + .5) / size * 2;
          const distance = sx * sx + sy * sy;
          if (distance > 1) continue;
          const depth = Math.sqrt(1 - distance);
          const latitude = Math.asin(Math.max(-1, Math.min(1, sy * COS_TILT + depth * SIN_TILT)));
          longitudes[index] = Math.atan2(sx, depth * COS_TILT - sy * SIN_TILT) / (2 * Math.PI);
          rows[index] = Math.min(texture.height - 1, Math.floor((.5 - latitude / Math.PI) * texture.height)) * texture.width;
          light[index] = .69 + Math.max(0, -.28 * sx + .42 * sy + .82 * depth) * .5;
          pixels.data[index * 4 + 3] = Math.min(255, Math.round((1 - Math.sqrt(distance)) * size * 255));
        }
      }
      textureMap = { pixels, longitude: longitudes, row: rows, light };
    }

    function drawTexture(cx: number, cy: number, radius: number) {
      if (!texture || !textureMap || !bitmapContext) return false;
      const output = textureMap.pixels.data;
      for (let index = 0; index < textureMap.longitude.length; index++) {
        const offset = index * 4;
        if (output[offset + 3] === 0) continue;
        const x = Math.floor((textureMap.longitude[index]! + longitude / 360 + 1.5) * texture.width) % texture.width;
        const source = (textureMap.row[index]! + x) * 4;
        const light = textureMap.light[index]!;
        output[offset] = texture.pixels[source]! * light;
        output[offset + 1] = texture.pixels[source + 1]! * light;
        output[offset + 2] = texture.pixels[source + 2]! * light;
      }
      bitmapContext.putImageData(textureMap.pixels, 0, 0);
      c.drawImage(bitmap, cx - radius, cy - radius, radius * 2, radius * 2);
      return true;
    }

    function drawLand(cx: number, cy: number, radius: number) {
      const ocean = c.createRadialGradient(cx - radius * .35, cy - radius * .4, 0, cx, cy, radius * 1.1);
      ocean.addColorStop(0, "#2c6970");
      ocean.addColorStop(.65, "#164752");
      ocean.addColorStop(1, "#0a2837");
      c.fillStyle = ocean;
      c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      c.lineWidth = .55;
      c.strokeStyle = "#c3ded226";
      for (let lat = -60; lat <= 60; lat += 30) {
        c.beginPath();
        let on = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const point = project(vector(lat, lon), radius, cx, cy);
          if (point.z >= 0) { if (on) c.lineTo(point.x, point.y); else c.moveTo(point.x, point.y); }
          on = point.z >= 0;
        }
        c.stroke();
      }
      for (const ring of landVectors) {
        const points = ring.map((point) => project(point, radius, cx, cy));
        c.beginPath();
        let on = false;
        let fullyVisible = true;
        for (const point of points) {
          if (point.z >= 0) { if (on) c.lineTo(point.x, point.y); else c.moveTo(point.x, point.y); }
          else fullyVisible = false;
          on = point.z >= 0;
        }
        // Do not invent a straight project boundary across a hemisphere-clipped ring.
        if (fullyVisible) { c.closePath(); c.fillStyle = "#76a99d"; c.fill(); }
        c.strokeStyle = "#99c2b1";
        c.stroke();
      }
    }

    function draw() {
      const cx = width * .5;
      const cy = height * .49;
      const radius = Math.min(width * .355, height * .405);
      c.clearRect(0, 0, width, height);
      c.save();
      c.translate(cx, cy);
      c.strokeStyle = "#7fafa65e";
      c.lineWidth = .7;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(0, 0, radius * (1.16 + i * .07), radius * (.38 + i * .07), -.23 + i * .23, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
      const halo = c.createRadialGradient(cx, cy, radius * .94, cx, cy, radius * 1.13);
      halo.addColorStop(0, "#5ebba646");
      halo.addColorStop(1, "#5ebba600");
      c.fillStyle = halo;
      c.beginPath(); c.arc(cx, cy, radius * 1.13, 0, Math.PI * 2); c.fill();
      c.save();
      c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.clip();
      if (!drawTexture(cx, cy, radius)) drawLand(cx, cy, radius);
      const highlight = c.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      highlight.addColorStop(0, "#c4f3dd20");
      highlight.addColorStop(.5, "#0b344100");
      highlight.addColorStop(1, "#071c3560");
      c.fillStyle = highlight; c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      c.restore();
      c.strokeStyle = "#bbdcd399"; c.lineWidth = .8;
      c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.stroke();
      for (const anchor of anchors) {
        const point = project(vector(anchor.latitude, anchor.longitude), radius * 1.006, cx, cy);
        if (point.z <= .02) continue;
        c.fillStyle = anchor.color; c.strokeStyle = anchor.color;
        c.shadowColor = anchor.color; c.shadowBlur = 12;
        c.beginPath(); c.arc(point.x, point.y, 3.6, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0; c.lineWidth = 1;
        c.beginPath(); c.arc(point.x, point.y, 9, 0, Math.PI * 2); c.stroke();
      }
      if (firstDraw) { firstDraw = false; setBackend("canvas"); }
    }

    function requestDraw() {
      dirty = true;
      if (!disposed && !frameId && !document.hidden && inViewport) frameId = requestAnimationFrame(frame);
    }

    function frame(time: number) {
      frameId = 0;
      if (disposed || document.hidden || !inViewport) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 100) : 0;
      lastTime = time;
      if (spin && !drag) { longitude = wrapLongitude(longitude + elapsed * .0016); dirty = true; }
      if (dirty && time - lastDraw >= FRAME_INTERVAL) { draw(); dirty = false; lastDraw = time; }
      if (spin || dirty) frameId = requestAnimationFrame(frame);
    }

    function setSpin(value: boolean) {
      spin = value;
      lastTime = 0;
      setSpinning(value);
      requestDraw();
    }

    controlsRef.current = {
      rotate(degrees) { setSpin(false); longitude = wrapLongitude(longitude + degrees); requestDraw(); },
      toggle() { setSpin(!spin); },
    };

    function resize() {
      if (disposed) return;
      const nextWidth = Math.max(1, scene!.clientWidth);
      const nextHeight = Math.max(1, scene!.clientHeight);
      const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas!.width !== pixelWidth) canvas!.width = pixelWidth;
      if (canvas!.height !== pixelHeight) canvas!.height = pixelHeight;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      prepareTexture();
      // Resizing clears a canvas. Restore one frame immediately, even offscreen,
      // so a paused reference never depends on the visibility-gated animation loop.
      draw();
      dirty = false;
      lastDraw = performance.now();
      if (spin) requestDraw();
    }

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(scene);
    window.addEventListener("resize", resize, { signal });
    const visibilityObserver = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => {
      inViewport = entry?.isIntersecting ?? true;
      lastTime = 0;
      if (inViewport) requestDraw();
      else { cancelAnimationFrame(frameId); frameId = 0; }
    }, { rootMargin: "80px" }) : null;
    visibilityObserver?.observe(scene);
    document.addEventListener("visibilitychange", () => {
      lastTime = 0;
      if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
      else requestDraw();
    }, { signal });
    const onMotion = (event: MediaQueryListEvent) => { if (event.matches) setSpin(false); };
    motion.addEventListener("change", onMotion);
    canvas.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { x: event.clientX, pointerId: event.pointerId };
      setSpin(false);
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      longitude = wrapLongitude(longitude - (event.clientX - drag.x) * .32);
      drag.x = event.clientX;
      requestDraw();
    }, { signal });
    const endDrag = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
    };
    canvas.addEventListener("pointerup", endDrag, { signal });
    canvas.addEventListener("pointercancel", endDrag, { signal });
    canvas.addEventListener("lostpointercapture", () => { drag = null; }, { signal });

    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      try {
        const source = document.createElement("canvas");
        source.width = image.naturalWidth;
        source.height = image.naturalHeight;
        const sourceContext = source.getContext("2d", { willReadFrequently: true });
        if (!sourceContext) return;
        sourceContext.drawImage(image, 0, 0);
        texture = { pixels: sourceContext.getImageData(0, 0, source.width, source.height).data, width: source.width, height: source.height };
        prepareTexture();
        requestDraw();
      } catch { /* The bundled vector reference remains available if texture decoding fails. */ }
    };
    image.src = "/planetary/earth-texture.png";
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      abort.abort();
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      motion.removeEventListener("change", onMotion);
      if (drag && canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
      image.onload = null;
      image.removeAttribute("src");
      texture = null;
      textureMap = null;
      controlsRef.current = null;
    };
  }, []);

  return (
    <figure className={`${styles.figure}${compact ? ` ${styles.compact}` : ""}`} data-reference-globe data-globe-status={backend} data-renderer={backend === "canvas" ? "canvas2d-reference" : "static-reference"} data-rotation={backend === "canvas" && spinning ? "rotating" : "paused"}>
      <div className={styles.topline}>
        <span>{zh ? "地球 / 证据网络" : "Earth / evidence network"}</span>
        <span className={styles.chip}>{zh ? "参考图层" : "Reference layer"}</span>
      </div>
      <div className={styles.scene} ref={sceneRef}>
        <canvas className={styles.canvas} ref={canvasRef} hidden={backend === "static"} role="img" aria-label={zh ? "可旋转的地球参考图，标示科特迪瓦与深圳区域示例；不是项目边界。" : "Rotatable reference Earth with illustrative regional anchors in Côte d’Ivoire and Shenzhen; not project boundaries."} aria-describedby={captionId} />
        <div className={styles.fallback} hidden={backend === "canvas"}>
          <span aria-hidden="true" className={styles.fallbackIcon}>◎</span>
          <span>{backend === "static" ? (zh ? "交互地球不可用。区域参考见下方说明。" : "Interactive globe unavailable. Regional references are listed here.") : (zh ? "地球参考视图" : "Earth reference view")}</span>
        </div>
        <ul className={styles.callouts} aria-label={zh ? "区域参考" : "Regional references"}>
          <li className={`${styles.callout} ${styles.west}`}>
            <span className={styles.calloutIcon} aria-hidden="true">+</span>
            <div><strong>{zh ? "科特迪瓦" : "CÔTE D’IVOIRE"}</strong><small>{zh ? "森林证据 · 示意锚点" : "Forest evidence · illustrative anchor"}</small></div>
          </li>
          <li className={`${styles.callout} ${styles.east}`}>
            <span className={styles.calloutIcon} aria-hidden="true">+</span>
            <div><strong style={{ textTransform: "none" }}>{zh ? "深圳" : "SHENZHEN"} · {LIFEPP_PUBLIC_BRAND}</strong><small>{manifest.currentPlan.totalAreaSqm.toFixed(2)} {zh ? "㎡ · 三铺规划" : "m² · three-unit planning"}</small></div>
          </li>
        </ul>
      </div>
      <div className={styles.footer}>
        <p className={styles.status} role="status">{backend === "static" ? (zh ? "静态区域参考" : "Static regional reference") : spinning ? (zh ? "参考地理 · 缓慢旋转" : "Reference geography · rotating") : (zh ? "参考地理 · 已暂停" : "Reference geography · paused")}</p>
        <div className={styles.controls} role="group" aria-label={zh ? "地球视图控制" : "Globe controls"}>
          <button type="button" disabled={backend !== "canvas"} aria-label={zh ? "向左旋转地球" : "Rotate globe left"} onClick={() => controlsRef.current?.rotate(-15)}><span aria-hidden="true">←</span></button>
          <button type="button" disabled={backend !== "canvas"} aria-label={spinning ? (zh ? "暂停地球旋转" : "Pause globe rotation") : (zh ? "恢复地球旋转" : "Resume globe rotation")} onClick={() => controlsRef.current?.toggle()}><span aria-hidden="true">{spinning ? "Ⅱ" : "▷"}</span>{spinning ? (zh ? "暂停" : "Pause") : (zh ? "旋转" : "Resume")}</button>
          <button type="button" disabled={backend !== "canvas"} aria-label={zh ? "向右旋转地球" : "Rotate globe right"} onClick={() => controlsRef.current?.rotate(15)}><span aria-hidden="true">→</span></button>
        </div>
      </div>
      <figcaption className={styles.caption} id={captionId}>
        <span>{zh ? "Natural Earth 低分辨率参考地理（原型提供，公有领域）。区域锚点不是实测地块或已核证项目。" : "Natural Earth low-resolution reference geography (supplied prototype, public domain). Anchors are not surveyed parcels or verified projects."}</span>
        <span>{zh ? "拖动或使用按钮旋转。深圳面积为规划输入，不代表实测或已建成。" : "Drag or use the buttons to rotate. The Shenzhen area is a planning input, not a survey or completed site."}</span>
      </figcaption>
    </figure>
  );
}
