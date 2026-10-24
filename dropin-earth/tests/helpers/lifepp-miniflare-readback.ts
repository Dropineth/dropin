import { INQUIRY_RECEIPT_LOOKUP_SQL, type InquiryDatabase, type InquiryStatement } from '../../apps/web/src/lib/life/inquiry-service';

export const MINIFLARE_RECEIPT_READ_BUDGET_MS = 5_000;
export type MiniflareReadbackMetrics = { retries: number; exhausted?: number; deadlines?: number };

/** Node getD1Database() is an RPC proxy, unlike the production Worker binding.
 * Recover only its observed closed-peer transport failure on one exact read.
 * No write, batch, arbitrary SQL, prepare/bind error or other error is retried.
 * A timer bounds an async pending read, but cannot cancel the underlying RPC.
 * Synchronous proxy RPC can block the event loop; once control returns, late
 * results are rejected. Never start another lookup after a read times out. */
export function miniflareReceiptReadback(db: InquiryDatabase, metrics: MiniflareReadbackMetrics = { retries: 0 }, clock = () => performance.now()): InquiryDatabase {
  const originals = new WeakMap<InquiryStatement, InquiryStatement>();
  function receipt(statement: InquiryStatement, bindings: (string | number | null)[]): InquiryStatement {
    const wrapped: InquiryStatement = {
      bind: (...values) => receipt(statement.bind(...values), values),
      async first<T>() {
        const started = clock();
        const deadlineError = () => { metrics.deadlines = (metrics.deadlines ?? 0) + 1; return new Error('MINIFLARE_RECEIPT_READ_DEADLINE'); };
        const withinDeadline = () => {
          const current = clock();
          if (!Number.isFinite(started) || !Number.isFinite(current) || current < started || current - started >= MINIFLARE_RECEIPT_READ_BUDGET_MS) {
            throw deadlineError();
          }
          return MINIFLARE_RECEIPT_READ_BUDGET_MS - (current - started);
        };
        const boundedRead = async (read: () => Promise<T | null>) => {
          const remaining = withinDeadline();
          let timer: ReturnType<typeof setTimeout> | undefined;
          const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(deadlineError()), remaining); });
          try {
            // Promise.race observes a late rejection too. A timeout is not the
            // recognized socket error, so this pending read is never retried.
            return await Promise.race([read(), deadline]);
          } finally { if (timer !== undefined) clearTimeout(timer); }
        };
        withinDeadline();
        try { const result = await boundedRead(() => statement.first<T>()); withinDeadline(); return result; }
        catch (error) {
          if (!(error instanceof TypeError) || error.message !== 'fetch failed') throw error;
          const cause = error.cause;
          if (!(cause instanceof Error) || cause.name !== 'SocketError' || cause.message !== 'other side closed'
            || !('code' in cause) || cause.code !== 'UND_ERR_SOCKET') throw error;
          withinDeadline();
          metrics.retries++;
          // Rebuild this read alone after the failed transport. A failure here
          // propagates unchanged: the fixed budget is two total read attempts.
          try {
            const retry = db.prepare(INQUIRY_RECEIPT_LOOKUP_SQL).bind(...bindings);
            withinDeadline();
            const result = await boundedRead(() => retry.first<T>());
            withinDeadline();
            return result;
          } catch (retryError) { metrics.exhausted = (metrics.exhausted ?? 0) + 1; throw retryError; }
        }
      },
      all: <T>() => statement.all<T>(),
      run: () => statement.run(),
    };
    originals.set(wrapped, statement);
    return wrapped;
  }
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      return sql === INQUIRY_RECEIPT_LOOKUP_SQL ? receipt(statement, []) : statement;
    },
    batch: statements => db.batch(statements.map(statement => originals.get(statement) ?? statement)),
  };
}
