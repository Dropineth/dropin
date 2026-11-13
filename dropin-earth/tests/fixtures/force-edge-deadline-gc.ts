import { setInterval } from 'node:timers';

// Isolated test subprocess only. Exercise collection while the 100 ms exporter
// timer is pending, without keeping an otherwise unsettled test process alive.
const collect = globalThis.gc;
if (typeof collect !== 'function') throw new Error('EDGE_DEADLINE_GC_FLAG_REQUIRED');
setInterval(() => collect(), 5).unref();
