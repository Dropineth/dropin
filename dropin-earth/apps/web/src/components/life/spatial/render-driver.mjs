/** Owns one renderer. Readiness means a completed frame, not construction or RAF. */
export function createRenderDriver({ createPrimary, createFallback, prepare, render, primaryEnabled = true,
  attach = () => () => {}, releaseOwnedTargets = () => {}, onStatus = () => {},
  schedule = (fn) => globalThis.requestAnimationFrame(fn),
  cancel = (id) => globalThis.cancelAnimationFrame(id),
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (id) => globalThis.clearTimeout(id), restoreTimeoutMs = 3000,
}) {
  let backend = null, detach = null, frame = null, restoreTimer = null;
  let dead = false, started = false, paused = false, lost = false, terminal = false;
  let fallbackAttempted = false, status = 'initializing', shaderFailed = false;
  let width = 0, height = 0, successfulFrames = 0, rendererDisposals = 0;
  const emit = (value) => { status = value; onStatus(value); };
  function stopFrame() { if (frame !== null) cancel(frame); frame = null; }
  function stopRestore() { if (restoreTimer !== null) clearTimer(restoreTimer); restoreTimer = null; }
  function release() {
    stopFrame(); stopRestore(); lost = false;
    const old = backend; backend = null;
    if (detach) { const off = detach; detach = null; try { off(); } catch { /* Continue owned cleanup. */ } }
    if (!old) return;
    try { releaseOwnedTargets(); } finally {
      try { old.dispose(); } finally {
        rendererDisposals++;
        // Only this driver's renderer/context is owned. Listeners are already detached.
        try { old.forceContextLoss?.(); } finally { old.domElement?.remove(); }
      }
    }
  }
  function unavailable() {
    terminal = true;
    try { release(); } finally { if (!dead) emit('unavailable'); }
  }
  function acquire(factory, software) {
    shaderFailed = false;
    let candidate = null;
    try {
      candidate = factory(); backend = candidate;
      if (candidate.debug) candidate.debug.onShaderError = () => { shaderFailed = true; };
      prepare(candidate);
      const off = attach(candidate);
      const canvas = candidate.domElement;
      const contextLost = (event) => {
        event.preventDefault(); if (dead || terminal || backend !== candidate) return;
        lost = true; stopFrame(); stopRestore(); emit('context-lost');
        restoreTimer = setTimer(() => { restoreTimer = null; fail(); }, restoreTimeoutMs);
      };
      const contextRestored = () => {
        if (dead || terminal || backend !== candidate) return;
        stopRestore(); lost = false; shaderFailed = false; emit('restoring'); invalidate();
      };
      canvas.addEventListener('webglcontextlost', contextLost);
      canvas.addEventListener('webglcontextrestored', contextRestored);
      detach = () => {
        canvas.removeEventListener('webglcontextlost', contextLost);
        canvas.removeEventListener('webglcontextrestored', contextRestored);
        off?.();
      };
      if (width > 0 && height > 0) candidate.setSize(width, height);
      emit(software ? 'fallback-loading' : 'initializing');
      return true;
    } catch {
      try { release(); } catch { /* Still allow the bounded fallback. */ }
      return false;
    }
  }
  function fail() {
    if (dead || terminal) return;
    try { release(); } catch { /* A failing backend must not block text fallback. */ }
    if (!fallbackAttempted) {
      fallbackAttempted = true;
      if (acquire(createFallback, true)) { invalidate(); return; }
    }
    unavailable();
  }
  function draw() {
    frame = null;
    if (dead || terminal || paused || lost || !backend || width <= 0 || height <= 0) return;
    const current = backend;
    try {
      if (current.getContext?.().isContextLost()) throw new Error('Context unavailable');
      render(current);
      if (dead || backend !== current || lost) return;
      if (shaderFailed || current.getContext?.().isContextLost()) throw new Error('Frame failed');
      successfulFrames++;
      const ready = current.isSoftwareSchematic ? 'ready-software' : 'ready';
      if (status !== ready) emit(ready);
    } catch { fail(); }
  }
  function invalidate() {
    if (!dead && !terminal && !paused && !lost && backend && frame === null) frame = schedule(draw);
  }
  return {
    start() {
      if (dead || started) return;
      started = true;
      if (!primaryEnabled || !acquire(createPrimary, false)) fail();
      else invalidate();
    },
    resize(w, h) {
      if (dead || terminal || !Number.isFinite(w) || !Number.isFinite(h)) return;
      width = Math.max(0, w); height = Math.max(0, h);
      if (!backend || !width || !height) return;
      try { backend.setSize(width, height); invalidate(); } catch { fail(); }
    },
    setActive(value) { paused = !value; if (paused) stopFrame(); else invalidate(); },
    invalidate,
    renderer: () => backend,
    state: () => ({ status, successfulFrames, fallbackAttempted, rendererDisposals, disposed: dead }),
    dispose() {
      if (dead) return;
      dead = true; terminal = true;
      try { release(); } finally { status = 'disposed'; }
    },
  };
}
