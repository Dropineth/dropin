import type pg from 'pg';

/** pg-pool may resolve end() before its asynchronous client removal callbacks.
 * Disposable databases/roles must not be dropped until those sockets close.
 * Call only after test queries/checkouts have completed; timeout is a failure,
 * never permission to force-delete a database with live test connections.
 */
export async function closeNativeChildPool(pool: pg.Pool): Promise<void> {
  let remaining = pool.totalCount;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removed = () => {};
  const drained = new Promise<void>((resolve, reject) => {
    if (remaining === 0) { resolve(); return; }
    removed = () => { if (--remaining === 0) resolve(); };
    pool.on('remove', removed);
    timer = setTimeout(() => reject(new Error('NATIVE_TEST_POOL_CLOSE_TIMEOUT')), 5000);
  });
  try { await Promise.all([pool.end(), drained]); }
  finally { if (timer) clearTimeout(timer); pool.off('remove', removed); }
}
