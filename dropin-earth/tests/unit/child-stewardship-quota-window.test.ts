import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNativeQuotaMinute, waitForNativeQuotaMinute } from '../fixtures/child-stewardship-quota-window.js';

test('native quota fixture immediately accepts a server minute with sufficient headroom', async () => {
  const minute = await waitForNativeQuotaMinute(async () => 120_000, async () => assert.fail('must not wait'));
  assert.equal(minute, 2);
  assertNativeQuotaMinute(134_999, minute);
});

test('native quota fixture waits through the observed CI minute boundary before consuming capacity', async () => {
  const samples = [Date.parse('2026-11-13T09:15:58.897Z'), Date.parse('2026-11-13T09:15:59.897Z'), Date.parse('2026-11-13T09:16:00.159Z')];
  const pauses: number[] = [];
  const minute = await waitForNativeQuotaMinute(async () => samples.shift()!, async value => { pauses.push(value); });
  assert.equal(minute, Math.floor(Date.parse('2026-11-13T09:16:00Z') / 60_000));
  assert.deepEqual(pauses, [500, 500]);
  assert.equal(samples.length, 0);
});

test('quota fixture rejects invalid server time and bounded waits cannot conceal a stalled clock', async () => {
  for (const value of [NaN, Infinity, -1]) {
    await assert.rejects(waitForNativeQuotaMinute(async () => value, async () => assert.fail('invalid time must not wait')), /Invalid native PostgreSQL clock/);
  }
  let reads = 0, waits = 0;
  await assert.rejects(waitForNativeQuotaMinute(async () => { reads++; return 59_000; }, async value => {
    assert.equal(value, 500); waits++;
  }), /could not obtain a fresh server minute/);
  assert.equal(reads, 33); assert.equal(waits, 32);
});

test('quota exhaustion evidence fails on a crossed minute or minute rollback rather than tolerating a 200 response', () => {
  const before = Date.parse('2026-11-13T09:15:58.897Z');
  const minute = Math.floor(before / 60_000);
  assertNativeQuotaMinute(before, minute);
  assert.throws(() => assertNativeQuotaMinute(Date.parse('2026-11-13T09:16:00.159Z'), minute), /crossed the server minute/);
  assert.throws(() => assertNativeQuotaMinute(before - 60_000, minute), /crossed the server minute/);
});
