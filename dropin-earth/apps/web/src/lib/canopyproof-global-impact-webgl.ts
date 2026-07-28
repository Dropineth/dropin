export const globalImpactWebglPhases = [
  "SSR_PLACEHOLDER",
  "THREE_LOADING",
  "WEBGL_READY",
  "FALLBACK_STATIC",
  "CONTEXT_LOST",
  "RETRYING",
  "TERMINAL_FALLBACK",
] as const;

export type GlobalImpactWebglPhase =
  (typeof globalImpactWebglPhases)[number];

export const globalImpactWebglFailureCodes = [
  "WEBGL_UNSUPPORTED",
  "CANVAS_CONTEXT_UNAVAILABLE",
  "DYNAMIC_IMPORT_FAILED",
  "THREE_CHUNK_TIMEOUT",
  "RENDERER_CONSTRUCTOR_FAILED",
  "INITIAL_FRAME_TIMEOUT",
  "WEBGL_CONTEXT_LOST",
  "REDUCED_MOTION_POLICY",
  "GPU_PROCESS_UNAVAILABLE",
  "BFCACHE_CONTEXT_INVALID",
] as const;

export type GlobalImpactWebglFailureCode =
  (typeof globalImpactWebglFailureCodes)[number];

export const globalImpactWebglMetrics = [
  "global_impact_webgl_ready_total",
  "global_impact_webgl_fallback_total",
  "global_impact_webgl_context_lost_total",
  "global_impact_webgl_retry_total",
  "global_impact_webgl_cold_start_ms",
] as const;

export type GlobalImpactWebglMetric =
  (typeof globalImpactWebglMetrics)[number];

export type GlobalImpactWebglState = Readonly<{
  phase: GlobalImpactWebglPhase;
  attempt: number;
  failureCode?: GlobalImpactWebglFailureCode;
}>;

export type GlobalImpactWebglEvent =
  | Readonly<{ type: "LOAD_STARTED" }>
  | Readonly<{ type: "READY" }>
  | Readonly<{ type: "FAILED"; code: GlobalImpactWebglFailureCode }>
  | Readonly<{
      type: "CONTEXT_LOST";
      code: "WEBGL_CONTEXT_LOST" | "BFCACHE_CONTEXT_INVALID";
    }>
  | Readonly<{ type: "RETRY" }>;

export type GlobalImpactWebglTelemetry = Readonly<{
  metric: GlobalImpactWebglMetric;
  value: number;
  phase: GlobalImpactWebglPhase;
  category: GlobalImpactWebglFailureCode | "READY" | "RETRY";
}>;

export const GLOBAL_IMPACT_WEBGL_MAX_RETRIES = 1;
export const GLOBAL_IMPACT_WEBGL_IMPORT_TIMEOUT_MS = 3_500;
export const GLOBAL_IMPACT_WEBGL_COLD_START_DEADLINE_MS = 5_000;
export const GLOBAL_IMPACT_WEBGL_TELEMETRY_EVENT =
  "canopyproof:global-impact-webgl";

export function createGlobalImpactWebglInitialState(): GlobalImpactWebglState {
  return { phase: "SSR_PLACEHOLDER", attempt: 0 };
}

export function reduceGlobalImpactWebglState(
  state: GlobalImpactWebglState,
  event: GlobalImpactWebglEvent,
): GlobalImpactWebglState {
  switch (event.type) {
    case "LOAD_STARTED":
      if (
        state.phase !== "SSR_PLACEHOLDER" &&
        state.phase !== "RETRYING"
      ) {
        return state;
      }
      return {
        phase: state.attempt === 0 ? "THREE_LOADING" : "RETRYING",
        attempt: state.attempt,
      };
    case "READY":
      if (state.phase !== "THREE_LOADING" && state.phase !== "RETRYING") {
        return state;
      }
      return { phase: "WEBGL_READY", attempt: state.attempt };
    case "FAILED":
      if (
        state.phase === "FALLBACK_STATIC" ||
        state.phase === "TERMINAL_FALLBACK"
      ) {
        return state;
      }
      return {
        phase:
          state.attempt >= GLOBAL_IMPACT_WEBGL_MAX_RETRIES
            ? "TERMINAL_FALLBACK"
            : "FALLBACK_STATIC",
        attempt: state.attempt,
        failureCode: event.code,
      };
    case "CONTEXT_LOST":
      if (state.phase !== "WEBGL_READY") return state;
      return {
        phase: "CONTEXT_LOST",
        attempt: state.attempt,
        failureCode: event.code,
      };
    case "RETRY":
      if (
        state.phase !== "FALLBACK_STATIC" &&
        state.phase !== "CONTEXT_LOST"
      ) {
        return state;
      }
      if (state.attempt >= GLOBAL_IMPACT_WEBGL_MAX_RETRIES) {
        return {
          phase: "TERMINAL_FALLBACK",
          attempt: state.attempt,
          ...(state.failureCode
            ? { failureCode: state.failureCode }
            : {}),
        };
      }
      return {
        phase: "RETRYING",
        attempt: state.attempt + 1,
      };
  }
}

export function buildGlobalImpactWebglTelemetry(
  metric: GlobalImpactWebglMetric,
  phase: GlobalImpactWebglPhase,
  category: GlobalImpactWebglTelemetry["category"],
  value = 1,
): GlobalImpactWebglTelemetry {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("CanopyProof WebGL telemetry value must be finite and nonnegative.");
  }
  const normalizedValue =
    metric === "global_impact_webgl_cold_start_ms"
      ? Math.min(30_000, Math.round(value / 25) * 25)
      : 1;
  return Object.freeze({
    metric,
    value: normalizedValue,
    phase,
    category,
  });
}

export function emitGlobalImpactWebglTelemetry(
  telemetry: GlobalImpactWebglTelemetry,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<GlobalImpactWebglTelemetry>(
      GLOBAL_IMPACT_WEBGL_TELEMETRY_EVENT,
      { detail: telemetry },
    ),
  );
}
