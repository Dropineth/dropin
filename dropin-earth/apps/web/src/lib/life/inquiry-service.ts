import { createHmac, timingSafeEqual } from 'node:crypto';
import { validateInquiry, type Inquiry } from '../../data/life/inquiry';

// Narrow storage port checked against real local D1 in the integration test.
// This is not a hand-written Worker Env declaration; binding types must be generated
// from the authorized deployment config when an actual binding is provisioned.
export interface InquiryStatement {
  bind(...values: (string | number | null)[]): InquiryStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface InquiryDatabase {
  prepare(sql: string): InquiryStatement;
  batch(statements: InquiryStatement[]): Promise<unknown[]>;
}
export type InquiryConfig = {
  enabled: boolean; origin: string; retentionDays: number; policyVersion: string;
  acceptanceRef: string; controller: string; backupNoticeZh: string; backupNoticeEn: string;
  hmacKey: string; maintenanceToken: string;
};
export type InquiryRuntime = { db: InquiryDatabase; config: InquiryConfig };
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MAX_BODY = 8_192;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const noStore = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
function json(body: unknown, status = 200, extra: Record<string, string> = {}) { return Response.json(body, { status, headers: { ...noStore, ...extra } }); }
function record(input: unknown): input is Record<string, unknown> { return !!input && typeof input === 'object' && !Array.isArray(input); }
function sign(config: InquiryConfig, purpose: string, value: string) { return createHmac('sha256', config.hmacKey).update(`${purpose}\0${value}`).digest('hex'); }
function equal(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }

export function parseInquiryConfig(env: Record<string, unknown>): InquiryConfig | null {
  const text = (key: string) => typeof env[key] === 'string' ? env[key] as string : '';
  const origin = text('LIFEPP_INQUIRY_SITE_ORIGIN');
  try { const parsed = new URL(origin); if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.username || parsed.password) return null; } catch { return null; }
  const days = text('LIFEPP_INQUIRY_RETENTION_DAYS');
  if (!/^[1-9][0-9]?$/.test(days) || Number(days) > 30) return null;
  const config: InquiryConfig = {
    enabled: text('LIFEPP_INQUIRY_ENABLED') === 'true', origin, retentionDays: Number(days),
    policyVersion: text('LIFEPP_INQUIRY_POLICY_VERSION'), acceptanceRef: text('LIFEPP_INQUIRY_ACCEPTANCE_REF'),
    controller: text('LIFEPP_INQUIRY_CONTROLLER'), backupNoticeZh: text('LIFEPP_INQUIRY_BACKUP_NOTICE_ZH'), backupNoticeEn: text('LIFEPP_INQUIRY_BACKUP_NOTICE_EN'),
    hmacKey: text('LIFEPP_INQUIRY_HMAC_KEY'), maintenanceToken: text('LIFEPP_INQUIRY_MAINTENANCE_TOKEN'),
  };
  if (![config.policyVersion, config.acceptanceRef].every(value => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/.test(value))) return null;
  if (![config.controller, config.backupNoticeZh, config.backupNoticeEn].every(value => value.trim().length >= 3 && value.length <= 600 && !Array.from(value).some(character => character.charCodeAt(0) < 32))) return null;
  if (config.hmacKey.length < 32 || config.maintenanceToken.length < 32 || config.hmacKey === config.maintenanceToken) return null;
  return config;
}

export function parseSubmittedInquiry(input: unknown): { inquiry: Inquiry; idempotencyKey: string; policyVersion: string } | null {
  if (!record(input) || Object.keys(input).sort().join(',') !== 'idempotencyKey,inquiry,policyVersion,sendConsent,website') return null;
  if (input.sendConsent !== true || input.website !== '' || typeof input.idempotencyKey !== 'string' || !UUID.test(input.idempotencyKey) || typeof input.policyVersion !== 'string' || !record(input.inquiry)) return null;
  const value = input.inquiry;
  if (Object.keys(value).sort().join(',') !== 'channel,consent,contact,message,name,organization,type') return null;
  for (const key of ['name', 'organization', 'channel', 'contact', 'type', 'message']) if (typeof value[key] !== 'string') return null;
  if (value.consent !== true) return null;
  const inquiry = value as Inquiry;
  if (Object.keys(validateInquiry(inquiry)).length || Array.from([inquiry.name, inquiry.organization, inquiry.message].join('')).some(character => character.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(character))) return null;
  return { inquiry: { name: inquiry.name.trim(), organization: inquiry.organization.trim(), channel: inquiry.channel, contact: inquiry.contact.trim(), type: inquiry.type, message: inquiry.message.trim(), consent: true }, idempotencyKey: input.idempotencyKey, policyVersion: input.policyVersion };
}

async function body(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json' || request.headers.get('content-encoding')) throw new Error('invalid-body');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new Error('invalid-body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid-body');
  const chunks: Uint8Array[] = []; let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error('body-timeout')); void reader.cancel().catch(() => undefined); }, 5000); });
  try {
    for (;;) { const item = await Promise.race([reader.read(), deadline]); if (item.done) break; total += item.value.length; if (total > MAX_BODY) { await reader.cancel(); throw new Error('invalid-body'); } chunks.push(item.value); }
  } finally { if (timer !== undefined) clearTimeout(timer); reader.releaseLock(); }
  const data = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
}
function sameOrigin(request: Request, config: InquiryConfig) {
  return request.headers.get('origin') === config.origin && request.headers.get('sec-fetch-site') === 'same-origin' && request.headers.get('x-lifepp-inquiry') === '1';
}
async function accepted(runtime: InquiryRuntime, now: number) {
  const rows = await runtime.db.prepare('SELECT key, value FROM lifepp_inquiry_control').all<{ key: string; value: string }>();
  const state = Object.fromEntries(rows.results.map(row => [row.key, row.value]));
  const last = Number(state.last_cleanup_at);
  return state.schema_version === '1' && state.acceptance_ref === runtime.config.acceptanceRef && state.policy_version === runtime.config.policyVersion && Number.isFinite(last) && last <= now && now - last <= HOUR;
}
export async function cleanupInquiries(runtime: InquiryRuntime, now: number) {
  await runtime.db.batch([
    runtime.db.prepare('DELETE FROM lifepp_inquiries WHERE expires_at <= ?').bind(now),
    runtime.db.prepare('DELETE FROM lifepp_inquiry_withdrawals WHERE expires_at <= ?').bind(now),
    runtime.db.prepare('DELETE FROM lifepp_inquiry_limits WHERE expires_at <= ?').bind(now),
    runtime.db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('last_cleanup_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(now)),
  ]);
}

export async function inquiryStatus(runtime: InquiryRuntime | null, now = Date.now()): Promise<Response> {
  try {
    if (!runtime?.config.enabled || !await accepted(runtime, now)) return json({ mode: 'draft' });
    // Readiness verifies the dedicated tables as well as the accepted cleanup heartbeat.
    await runtime.db.prepare('SELECT id FROM lifepp_inquiries LIMIT 1').first();
    await runtime.db.prepare('SELECT idempotency_key FROM lifepp_inquiry_withdrawals LIMIT 1').first();
    await runtime.db.prepare('SELECT bucket FROM lifepp_inquiry_limits LIMIT 1').first();
    return json({ mode: 'receive', policyVersion: runtime.config.policyVersion, retentionDays: runtime.config.retentionDays, controller: runtime.config.controller, backupNoticeZh: runtime.config.backupNoticeZh, backupNoticeEn: runtime.config.backupNoticeEn });
  } catch { return json({ mode: 'draft' }); }
}

export async function maintainInquiries(request: Request, runtime: InquiryRuntime | null, now = Date.now()): Promise<Response> {
  if (!runtime) return json({ error: 'unavailable' }, 503);
  const authorization = request.headers.get('authorization') ?? '';
  if (authorization.length > 1024 || !equal(authorization, `Bearer ${runtime.config.maintenanceToken}`)) return json({ error: 'unauthorized' }, 401);
  try { await cleanupInquiries(runtime, now); return json({ cleaned: true, at: new Date(now).toISOString() }); }
  catch { return json({ error: 'unavailable' }, 503); }
}

export async function submitInquiry(request: Request, runtime: InquiryRuntime | null, clientIp: string | null, now = Date.now()): Promise<Response> {
  if (!runtime?.config.enabled) return json({ error: 'unavailable', mode: 'draft' }, 503);
  if (!sameOrigin(request, runtime.config)) return json({ error: 'origin' }, 403);
  if (!clientIp || clientIp.length > 80 || !/^[a-fA-F0-9:.]+$/.test(clientIp)) return json({ error: 'unavailable' }, 503);
  let input: ReturnType<typeof parseSubmittedInquiry>;
  try { input = parseSubmittedInquiry(await body(request)); } catch { return json({ error: 'invalid' }, 400); }
  if (!input) return json({ error: 'invalid' }, 400);
  if (input.policyVersion !== runtime.config.policyVersion) return json({ error: 'policy_changed' }, 409);
  try {
    if (!await accepted(runtime, now)) return json({ error: 'unavailable', mode: 'draft' }, 503);
    const { config, db } = runtime;
    const serialized = JSON.stringify(input.inquiry);
    // Sending consent is bound to the policy the user saw; a later policy cannot
    // reuse an earlier receipt merely because the enquiry text is unchanged.
    const fingerprint = sign(config, 'payload', JSON.stringify({ inquiry: input.inquiry, policyVersion: input.policyVersion }));
    const key = sign(config, 'idempotency', input.idempotencyKey);
    const withdrawalToken = sign(config, 'withdrawal', input.idempotencyKey);
    const id = crypto.randomUUID();
    const window = Math.floor(now / HOUR);
    const bucket = sign(config, 'client', `${clientIp}:${window}`);
    const globalBucket = `global:${window}`;
    const expiry = (window + 1) * HOUR;
    const expiresAt = now + config.retentionDays * DAY;
    // D1 batch runs transactionally. Both admission counters and the conditional insert
    // serialize together; isolate-local maps never control the distributed budget.
    await db.batch([
      db.prepare('DELETE FROM lifepp_inquiries WHERE expires_at <= ?').bind(now),
      db.prepare('DELETE FROM lifepp_inquiry_withdrawals WHERE expires_at <= ?').bind(now),
      db.prepare('DELETE FROM lifepp_inquiry_limits WHERE expires_at <= ?').bind(now),
      db.prepare('INSERT INTO lifepp_inquiry_limits(bucket,count,expires_at) SELECT ?,1,? WHERE NOT EXISTS (SELECT 1 FROM lifepp_inquiries WHERE idempotency_key=?) AND NOT EXISTS (SELECT 1 FROM lifepp_inquiry_withdrawals WHERE idempotency_key=?) ON CONFLICT(bucket) DO UPDATE SET count=MIN(count+1,4)').bind(bucket, expiry, key, key),
      db.prepare('INSERT INTO lifepp_inquiry_limits(bucket,count,expires_at) SELECT ?,1,? WHERE (SELECT count FROM lifepp_inquiry_limits WHERE bucket=?) <= 3 AND NOT EXISTS (SELECT 1 FROM lifepp_inquiries WHERE idempotency_key=?) AND NOT EXISTS (SELECT 1 FROM lifepp_inquiry_withdrawals WHERE idempotency_key=?) ON CONFLICT(bucket) DO UPDATE SET count=MIN(count+1,101)').bind(globalBucket, expiry, bucket, key, key),
      db.prepare(`INSERT INTO lifepp_inquiries(id,idempotency_key,fingerprint,body,withdrawal_hash,policy_version,send_consent,created_at,expires_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT count FROM lifepp_inquiry_limits WHERE bucket=?) <= 3
        AND (SELECT count FROM lifepp_inquiry_limits WHERE bucket=?) <= 100
        AND NOT EXISTS (SELECT 1 FROM lifepp_inquiry_withdrawals WHERE idempotency_key=?)
        ON CONFLICT(idempotency_key) DO NOTHING`).bind(id, key, fingerprint, serialized, sign(config, 'withdrawal-proof', withdrawalToken), config.policyVersion, 1, now, expiresAt, bucket, globalBucket, key),
    ]);
    const stored = await db.prepare('SELECT id,fingerprint,expires_at FROM lifepp_inquiries WHERE idempotency_key=? AND expires_at>?').bind(key, now).first<{ id: string; fingerprint: string; expires_at: number }>();
    if (!stored) {
      const withdrawn = await db.prepare('SELECT idempotency_key FROM lifepp_inquiry_withdrawals WHERE idempotency_key=? AND expires_at>?').bind(key, now).first();
      if (withdrawn) return json({ error: 'withdrawn' }, 409);
      return json({ error: 'rate_limited' }, 429, { 'retry-after': String(Math.max(1, Math.ceil((expiry - now) / 1000))) });
    }
    if (!equal(stored.fingerprint, fingerprint)) return json({ error: 'duplicate_conflict' }, 409);
    // A receipt exists only after successful persistence and a read-back. It is not email delivery.
    return json({ status: 'stored', receiptId: stored.id, expiresAt: new Date(stored.expires_at).toISOString(), withdrawalToken, duplicate: stored.id !== id }, stored.id === id ? 201 : 200);
  } catch { return json({ error: 'unavailable' }, 503); }
}

export async function withdrawInquiry(request: Request, runtime: InquiryRuntime | null): Promise<Response> {
  if (!runtime) return json({ error: 'unavailable' }, 503);
  if (!sameOrigin(request, runtime.config)) return json({ error: 'origin' }, 403);
  let input: unknown;
  try { input = await body(request); } catch { return json({ error: 'invalid' }, 400); }
  if (!record(input) || Object.keys(input).sort().join(',') !== 'receiptId,withdrawalToken' || typeof input.receiptId !== 'string' || !UUID.test(input.receiptId) || typeof input.withdrawalToken !== 'string' || !TOKEN.test(input.withdrawalToken)) return json({ error: 'invalid' }, 400);
  try {
    const withdrawalHash = sign(runtime.config, 'withdrawal-proof', input.withdrawalToken);
    await runtime.db.batch([
      runtime.db.prepare('INSERT INTO lifepp_inquiry_withdrawals(idempotency_key,expires_at) SELECT idempotency_key,expires_at FROM lifepp_inquiries WHERE id=? AND withdrawal_hash=? ON CONFLICT(idempotency_key) DO NOTHING').bind(input.receiptId, withdrawalHash),
      runtime.db.prepare('DELETE FROM lifepp_inquiries WHERE id=? AND withdrawal_hash=?').bind(input.receiptId, withdrawalHash),
    ]);
    const remaining = await runtime.db.prepare('SELECT id FROM lifepp_inquiries WHERE id=?').bind(input.receiptId).first();
    if (remaining) return json({ error: 'not_removed' }, 403);
    return json({ status: 'removed_from_primary_store' });
  } catch { return json({ error: 'unavailable' }, 503); }
}
