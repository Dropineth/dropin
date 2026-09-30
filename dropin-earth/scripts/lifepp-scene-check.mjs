/**
 * Read-only, bounded HEAD observations of the two supplied URLs only.
 * No page body, assets, credentials, cookies, alternate URLs, proxy or TLS bypass.
 * A successful HEAD is not permission, an embed test, or source-content verification.
 */
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
import process from 'node:process';

export const SOURCE_ALLOWLIST = Object.freeze([
  'http://kjlying.com:8456/scenes/31',
  'http://kjlying.com:8456/scenes/29',
]);
export const LIMITS = Object.freeze({ timeoutMs: 5000, maxRedirects: 2, maxHeaderBytes: 16384, maxHeaderValueChars: 1024 });
const OBSERVED_HEADERS = ['location', 'content-type', 'content-length', 'content-security-policy', 'x-frame-options', 'access-control-allow-origin', 'strict-transport-security'];

export function isAllowedSource(value) {
  if (typeof value !== 'string' || !SOURCE_ALLOWLIST.includes(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.href === value;
  } catch { return false; }
}

export function checkedRedirect(currentUrl, location) {
  if (typeof location !== 'string' || location.length > LIMITS.maxHeaderValueChars) return null;
  try {
    const target = new URL(location, currentUrl).href;
    return isAllowedSource(target) ? target : null;
  } catch { return null; }
}

export function requestHead(address) {
  if (!isAllowedSource(address)) return Promise.reject(new Error('Source is outside the exact allowlist'));
  return new Promise((resolve, reject) => {
    const url = new URL(address);
    const transport = url.protocol === 'https:' ? https : http;
    let settled = false;
    const request = transport.request(url, {
      method: 'HEAD', maxHeaderSize: LIMITS.maxHeaderBytes,
      headers: { 'User-Agent': 'CanopyProof-LifePP-ReadOnly-HEAD/1.0', Accept: '*/*', Connection: 'close' },
      // Normal platform TLS certificate validation is retained. No redirects are followed by this client.
    });
    const timer = setTimeout(() => request.destroy(new Error('HEAD_TIMEOUT')), LIMITS.timeoutMs);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    request.once('response', (response) => {
      const headers = {};
      for (const name of OBSERVED_HEADERS) {
        const raw = response.headers[name];
        if (raw !== undefined) headers[name] = String(Array.isArray(raw) ? raw.join(', ') : raw).slice(0, LIMITS.maxHeaderValueChars);
      }
      const socket = response.socket;
      const tls = url.protocol === 'https:' ? {
        transport: 'https', certificateAuthorized: socket.authorized === true,
        protocol: typeof socket.getProtocol === 'function' ? socket.getProtocol() : null,
      } : { transport: 'http', certificateAuthorized: null, protocol: null };
      finish(null, { statusCode: response.statusCode ?? null, headers, tls });
      response.destroy();
      request.destroy();
    });
    request.once('error', (error) => finish(error));
    request.end();
  });
}

export async function checkSource(sourceUrl, head = requestHead) {
  const observedAt = new Date().toISOString();
  if (!isAllowedSource(sourceUrl)) return { sourceUrl, observedAt, status: 'blocked_non_allowlist', requests: [] };
  const requests = [];
  const seen = new Set();
  let address = sourceUrl;
  for (let redirects = 0; redirects <= LIMITS.maxRedirects; redirects += 1) {
    seen.add(address);
    try {
      const observation = await head(address);
      requests.push({ url: address, observedAt: new Date().toISOString(), ...observation });
      if ([301, 302, 303, 307, 308].includes(observation.statusCode)) {
        const target = checkedRedirect(address, observation.headers.location);
        if (!target) return { sourceUrl, observedAt, status: 'blocked_redirect_outside_allowlist', requests };
        if (seen.has(target)) return { sourceUrl, observedAt, status: 'unverified_redirect_loop', requests };
        if (redirects === LIMITS.maxRedirects) return { sourceUrl, observedAt, status: 'unverified_redirect_limit', requests };
        address = target;
        continue;
      }
      return {
        sourceUrl, observedAt,
        status: observation.statusCode >= 200 && observation.statusCode < 300 ? 'head_response_observed_content_unverified' : 'head_http_status_observed_content_unverified',
        requests,
      };
    } catch (error) {
      // Connection failures say nothing about whether the source is globally online or offline.
      requests.push({ url: address, observedAt: new Date().toISOString(), error: { code: error?.code ?? null, message: String(error?.message ?? error).slice(0, 300) } });
      return { sourceUrl, observedAt, status: 'unverified_access_failed', requests };
    }
  }
}

async function main() {
  if (process.argv.length > 2) throw new Error('This checker accepts no URL arguments; only the supplied registry is checked.');
  const path = new URL('../apps/web/src/data/life/site-manifest.json', import.meta.url);
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const sources = manifest.scenes?.map((scene) => scene.sourceUrl);
  if (!sources || sources.length !== SOURCE_ALLOWLIST.length || new Set(sources).size !== SOURCE_ALLOWLIST.length || sources.some((source) => !isAllowedSource(source))) throw new Error('Scene registry source identities do not match the fixed allowlist');
  const observations = [];
  for (const source of sources) observations.push(await checkSource(source));
  process.stdout.write(`${JSON.stringify({
    checkedAt: new Date().toISOString(), method: 'HEAD', limits: LIMITS,
    scope: 'Response headers only. No source content, subresource, model, permission or real browser embed verification.',
    limitations: ['HTTP transport is unencrypted; HTTPS is not guessed or tested.', 'Redirects only follow another exact supplied source URL.', 'CORS does not establish iframe eligibility.', 'HEAD responses do not prove rights, subresource safety, engine readiness or navigation accuracy.'],
    observations,
  }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(process.argv[1]))) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
