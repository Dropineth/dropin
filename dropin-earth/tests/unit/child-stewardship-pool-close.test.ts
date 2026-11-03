import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import type pg from 'pg';
import {closeNativeChildPool} from '../fixtures/child-stewardship-pool-close.js';

test('native teardown waits for every socket removal after pool.end resolves', async () => {
  const pool = Object.assign(new EventEmitter(), {totalCount:2, end:async () => {}});
  let closed = false;
  const closing = closeNativeChildPool(pool as unknown as pg.Pool).then(() => {closed = true;});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  pool.emit('remove');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  pool.emit('remove');
  await closing;
  assert.equal(closed, true);
  assert.equal(pool.listenerCount('remove'), 0);
});

test('empty pools close and end failures propagate without retained listeners', async () => {
  const empty = Object.assign(new EventEmitter(), {totalCount:0, end:async () => {}});
  await closeNativeChildPool(empty as unknown as pg.Pool);
  const failed = Object.assign(new EventEmitter(), {totalCount:1, end:async () => {throw new Error('close failed');}});
  await assert.rejects(closeNativeChildPool(failed as unknown as pg.Pool), /close failed/);
  assert.equal(failed.listenerCount('remove'), 0);
});

test('missing socket closure fails teardown instead of allowing database deletion', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const stuck = Object.assign(new EventEmitter(), {totalCount:1, end:async () => {}});
  const rejected = assert.rejects(closeNativeChildPool(stuck as unknown as pg.Pool), /NATIVE_TEST_POOL_CLOSE_TIMEOUT/);
  t.mock.timers.tick(5000);
  await rejected;
  assert.equal(stuck.listenerCount('remove'), 0);
});
