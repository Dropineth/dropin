import { createHash } from 'node:crypto';
import { ChildApiError } from './store.js';

export type ChildOperationalSignal = Readonly<{
  category: 'child_storage';
  code: 'STORAGE_FAILURE' | 'CIRCUIT_OPEN' | 'CIRCUIT_RECOVERED';
  count: number;
  time: string;
}>;
type Circuit = { failures: number; openUntil: number; probing: boolean; epoch: number; touched: number };
const STORAGE_CODES = new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','EPIPE','ENETUNREACH','EHOSTUNREACH','57P01','57P02','57P03','53300','53400','58000','58030','P1001','P1002','P1008','P1017','P2024']);
export function isChildStorageFailure(error: unknown): boolean {
  if (error instanceof ChildApiError || !error || typeof error !== 'object' || !('code' in error) || typeof error.code !== 'string') return false;
  return STORAGE_CODES.has(error.code) || /^08[A-Z0-9]{3}$/.test(error.code);
}

/** Process-local load protection, never authorization, persistence or a DB fallback. */
export function createChildDependencyGuard(options: {
  emit: (signal: ChildOperationalSignal) => void;
  /** Server-owned dependency injection for deterministic tests, never request time. */
  clock?: () => number;
}) {
  const clock = options.clock ?? Date.now;
  const circuits = new Map<string, Circuit>();
  const signal = (code: ChildOperationalSignal['code'], count: number) => {
    // No caller payload, exception, principal, path or protection state enters logs.
    try { options.emit(Object.freeze({ category: 'child_storage', code, count, time: new Date(clock()).toISOString() })); } catch { /* Logging cannot change transaction semantics. */ }
  };
  return {
    async run<T>(sessionId: string, actorId: string, work: () => Promise<T>): Promise<T> {
      const now = clock();
      const key = createHash('sha256').update(JSON.stringify([sessionId,actorId])).digest('hex');
      for (const [id, value] of circuits) if (!value.probing && now - value.touched >= 60_000 && now >= value.openUntil) circuits.delete(id);
      let state = circuits.get(key);
      const epoch = state?.epoch ?? 0;
      let probe = false;
      if (state && state.openUntil > 0) {
        if (now < state.openUntil || state.probing) throw new ChildApiError('SERVICE_UNAVAILABLE',503);
        state.probing = true; state.touched = now; probe = true;
      }
      try {
        const value = await work();
        if (state && circuits.get(key) === state && state.epoch === epoch) {
          circuits.delete(key);
          if (probe) signal('CIRCUIT_RECOVERED',1);
        }
        return value;
      } catch (error) {
        if (!isChildStorageFailure(error)) {
          // Domain rejection cannot trip a circuit or strand its half-open slot.
          if (probe && state && state.epoch === epoch) state.probing = false;
          throw error;
        }
        state = circuits.get(key);
        if (!state) {
          // Memory is bounded without evicting or rejecting another actor. When
          // full, normal DB authorization still runs; only new tracking is skipped.
          if (circuits.size >= 2048) { signal('STORAGE_FAILURE',1); throw error; }
          state = { failures: 0, openUntil: 0, probing: false, epoch: 0, touched: now };
          circuits.set(key,state);
        }
        if (state.epoch !== epoch) { signal('STORAGE_FAILURE',1); throw error; }
        state.failures = Math.min(3,state.failures + 1); state.touched = clock(); state.probing = false;
        signal('STORAGE_FAILURE',state.failures);
        if (probe || state.failures >= 3) {
          state.openUntil = clock() + 15_000; state.epoch++;
          signal('CIRCUIT_OPEN',1);
        }
        throw error;
      }
    },
  };
}
