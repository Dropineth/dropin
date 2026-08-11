"use client";

import type { CanopyProofGlobalCommandCenterRegion } from "@dropin/schemas/canopyproof-global-command-center";
import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  buildGlobalImpactWebglTelemetry,
  createGlobalImpactWebglInitialState,
  emitGlobalImpactWebglTelemetry,
  GLOBAL_IMPACT_WEBGL_COLD_START_DEADLINE_MS,
  GLOBAL_IMPACT_WEBGL_IMPORT_TIMEOUT_MS,
  reduceGlobalImpactWebglState,
  type GlobalImpactWebglFailureCode,
} from "@/lib/canopyproof-global-impact-webgl";
import { GlobalImpactEarthFallback } from "./GlobalImpactEarthFallback";

export type GlobalImpactEarthProps = {
  readonly regions: readonly CanopyProofGlobalCommandCenterRegion[];
  readonly dashboardRoot: string;
};

type GlobalImpactEarthRuntimeProps = GlobalImpactEarthProps & {
  readonly onContextLost: (
    code: "WEBGL_CONTEXT_LOST" | "BFCACHE_CONTEXT_INVALID",
  ) => void;
  readonly onReady: () => void;
};

const loadGlobalImpactEarth = () =>
  import(
    /* webpackChunkName: "canopyproof-global-impact-earth" */
    "./GlobalImpactEarth"
  );

const GlobalImpactEarth = dynamic<GlobalImpactEarthRuntimeProps>(
  () =>
    loadGlobalImpactEarth().then((module) => module.GlobalImpactEarth),
  {
    ssr: false,
    loading: () => null,
  },
);

export function GlobalImpactEarthLoader(props: GlobalImpactEarthProps) {
  const [state, dispatch] = useReducer(
    reduceGlobalImpactWebglState,
    undefined,
    createGlobalImpactWebglInitialState,
  );
  const [moduleReady, setModuleReady] = useState(false);
  const startedAtRef = useRef(0);
  const currentAttemptRef = useRef(0);
  const runClosedRef = useRef(false);
  const importTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const coldStartTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const clearTimers = useCallback(() => {
    if (importTimerRef.current !== undefined) {
      clearTimeout(importTimerRef.current);
      importTimerRef.current = undefined;
    }
    if (coldStartTimerRef.current !== undefined) {
      clearTimeout(coldStartTimerRef.current);
      coldStartTimerRef.current = undefined;
    }
  }, []);

  const failCurrentRun = useCallback(
    (code: GlobalImpactWebglFailureCode) => {
      if (runClosedRef.current) return;
      runClosedRef.current = true;
      clearTimers();
      const phase =
        currentAttemptRef.current === 0 ? "THREE_LOADING" : "RETRYING";
      emitGlobalImpactWebglTelemetry(
        buildGlobalImpactWebglTelemetry(
          "global_impact_webgl_fallback_total",
          phase,
          code,
        ),
      );
      dispatch({ type: "FAILED", code });
    },
    [clearTimers],
  );

  useEffect(() => {
    let active = true;
    currentAttemptRef.current = state.attempt;
    runClosedRef.current = false;
    startedAtRef.current = performance.now();
    setModuleReady(false);
    dispatch({ type: "LOAD_STARTED" });

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      failCurrentRun("REDUCED_MOTION_POLICY");
      return () => {
        active = false;
        clearTimers();
      };
    }

    const preflight = probeWebgl();
    if (!preflight.supported) {
      failCurrentRun(preflight.code);
      return () => {
        active = false;
        clearTimers();
      };
    }

    importTimerRef.current = setTimeout(
      () => failCurrentRun("THREE_CHUNK_TIMEOUT"),
      GLOBAL_IMPACT_WEBGL_IMPORT_TIMEOUT_MS,
    );
    coldStartTimerRef.current = setTimeout(
      () => failCurrentRun("INITIAL_FRAME_TIMEOUT"),
      GLOBAL_IMPACT_WEBGL_COLD_START_DEADLINE_MS,
    );

    void loadGlobalImpactEarth()
      .then(() => {
        if (!active || runClosedRef.current) return;
        if (importTimerRef.current !== undefined) {
          clearTimeout(importTimerRef.current);
          importTimerRef.current = undefined;
        }
        setModuleReady(true);
      })
      .catch(() => {
        if (active) failCurrentRun("DYNAMIC_IMPORT_FAILED");
      });

    return () => {
      active = false;
      clearTimers();
    };
  }, [clearTimers, failCurrentRun, state.attempt]);

  const handleReady = useCallback(() => {
    if (runClosedRef.current) return;
    runClosedRef.current = true;
    clearTimers();
    const coldStartMs = performance.now() - startedAtRef.current;
    const phase =
      currentAttemptRef.current === 0 ? "THREE_LOADING" : "RETRYING";
    emitGlobalImpactWebglTelemetry(
      buildGlobalImpactWebglTelemetry(
        "global_impact_webgl_ready_total",
        phase,
        "READY",
      ),
    );
    emitGlobalImpactWebglTelemetry(
      buildGlobalImpactWebglTelemetry(
        "global_impact_webgl_cold_start_ms",
        phase,
        "READY",
        coldStartMs,
      ),
    );
    dispatch({ type: "READY" });
  }, [clearTimers]);

  const handleContextLost = useCallback(
    (code: "WEBGL_CONTEXT_LOST" | "BFCACHE_CONTEXT_INVALID") => {
      clearTimers();
      emitGlobalImpactWebglTelemetry(
        buildGlobalImpactWebglTelemetry(
          "global_impact_webgl_context_lost_total",
          "CONTEXT_LOST",
          code,
        ),
      );
      dispatch({ type: "CONTEXT_LOST", code });
    },
    [clearTimers],
  );

  const handleRendererFailure = useCallback(() => {
    failCurrentRun("RENDERER_CONSTRUCTOR_FAILED");
  }, [failCurrentRun]);

  const retry = useCallback(() => {
    emitGlobalImpactWebglTelemetry(
      buildGlobalImpactWebglTelemetry(
        "global_impact_webgl_retry_total",
        state.phase,
        "RETRY",
      ),
    );
    setModuleReady(false);
    dispatch({ type: "RETRY" });
  }, [state.phase]);

  const isFallback =
    state.phase === "FALLBACK_STATIC" ||
    state.phase === "CONTEXT_LOST" ||
    state.phase === "TERMINAL_FALLBACK";

  return (
    <div
      data-testid="global-impact-earth-boundary"
      data-webgl-attempt={state.attempt}
      data-webgl-state={state.phase}
    >
      {isFallback && state.failureCode ? (
        <GlobalImpactEarthFallback
          {...props}
          failureCode={state.failureCode}
          onRetry={state.phase === "TERMINAL_FALLBACK" ? undefined : retry}
          phase={state.phase}
        />
      ) : moduleReady ? (
        <GlobalImpactEarthErrorBoundary
          fallback={
            <GlobalImpactEarthFallback
              {...props}
              failureCode="RENDERER_CONSTRUCTOR_FAILED"
              onRetry={state.attempt === 0 ? retry : undefined}
              phase={
                state.attempt === 0
                  ? "FALLBACK_STATIC"
                  : "TERMINAL_FALLBACK"
              }
            />
          }
          onError={handleRendererFailure}
          resetKey={state.attempt}
        >
          <GlobalImpactEarth
            {...props}
            onContextLost={handleContextLost}
            onReady={handleReady}
          />
        </GlobalImpactEarthErrorBoundary>
      ) : (
        <GlobalImpactEarthPlaceholder retrying={state.attempt > 0} />
      )}
    </div>
  );
}

function GlobalImpactEarthPlaceholder({
  retrying,
}: {
  readonly retrying: boolean;
}) {
  return (
    <section
      aria-busy="true"
      aria-label="Preparing public-safe Earth view"
      className="mt-10 border-y border-zinc-800 py-7"
      data-testid="global-impact-earth-placeholder"
    >
      <p className="font-mono text-xs font-semibold uppercase text-emerald-300">
        Public-safe Earth view
      </p>
      <div className="mt-5 flex h-80 w-full items-center justify-center bg-zinc-900 text-sm text-zinc-500 motion-safe:animate-pulse sm:h-auto sm:aspect-[16/7]">
        {retrying ? "Retrying WebGL context" : "Preparing WebGL context"}
      </div>
    </section>
  );
}

type ErrorBoundaryProps = Readonly<{
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
  resetKey: number;
}>;

type ErrorBoundaryState = Readonly<{ failed: boolean }>;

class GlobalImpactEarthErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (
      this.state.failed &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function probeWebgl():
  | Readonly<{ supported: true }>
  | Readonly<{
      supported: false;
      code:
        | "WEBGL_UNSUPPORTED"
        | "CANVAS_CONTEXT_UNAVAILABLE"
        | "GPU_PROCESS_UNAVAILABLE";
    }> {
  if (
    typeof window.WebGLRenderingContext === "undefined" &&
    typeof window.WebGL2RenderingContext === "undefined"
  ) {
    return { supported: false, code: "WEBGL_UNSUPPORTED" };
  }
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!context) {
      return { supported: false, code: "CANVAS_CONTEXT_UNAVAILABLE" };
    }
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return { supported: true };
  } catch {
    return { supported: false, code: "GPU_PROCESS_UNAVAILABLE" };
  }
}
