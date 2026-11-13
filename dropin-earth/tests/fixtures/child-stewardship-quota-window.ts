import assert from 'node:assert/strict';

const MINUTE_MS = 60_000;
const HEADROOM_MS = 15_000;
const MAX_WAITS = 32;

function serverMinute(milliseconds: number): number {
  assert.ok(Number.isFinite(milliseconds) && milliseconds >= 0, 'Invalid native PostgreSQL clock');
  return Math.floor(milliseconds / MINUTE_MS);
}

/** Only waits against observations of the real database clock. Never sets a
 * clock, resets a counter, retries requests or changes the production quota. */
export async function waitForNativeQuotaMinute(
  readServerMilliseconds: () => Promise<number>,
  pause: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
): Promise<number> {
  for (let waits = 0; waits <= MAX_WAITS; waits++) {
    const milliseconds = await readServerMilliseconds();
    const minute = serverMinute(milliseconds);
    if (MINUTE_MS - milliseconds % MINUTE_MS >= HEADROOM_MS) return minute;
    if (waits === MAX_WAITS) throw new Error('Native quota fixture could not obtain a fresh server minute');
    await pause(500);
  }
  throw new Error('Unreachable native quota window');
}

/** Crossing a minute is an invalid exhaustion fixture, never a passing result. */
export function assertNativeQuotaMinute(milliseconds: number, expected: number): void {
  assert.equal(serverMinute(milliseconds), expected, 'Native quota assertion crossed the server minute; no request is retried or skipped');
}
