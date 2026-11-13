import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest, type Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve, sep } from 'node:path';
import test from 'node:test';
import { Hono, type MiddlewareHandler } from 'hono';
import { csrf } from 'hono/csrf';
import { validator } from 'hono/validator';

const apiRequire = createRequire(new URL('../../services/api/package.json', import.meta.url));
const authorize: MiddlewareHandler = async (context, next) => {
  if (context.req.header('authorization') !== 'Bearer SYNTHETIC-LOCAL-ONLY') return context.text('unauthorized', 401);
  return next();
};
const headers = { authorization: 'Bearer SYNTHETIC-LOCAL-ONLY' };

test('security fixes pin the first patched versions and resolve the API to those exact lock entries', async () => {
  const root = JSON.parse(await readFile('package.json', 'utf8'));
  const api = JSON.parse(await readFile('services/api/package.json', 'utf8'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8')) as { packages: Record<string, { version?: string }> };
  assert.equal(root.overrides.hono, '4.13.16');
  for (const [name, version] of Object.entries({ hono: '4.13.16', '@hono/node-server': '2.1.6', 'fast-xml-parser': '5.12.0' })) {
    assert.equal(api.dependencies[name], version);
    const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`));
    assert.equal(entries.length, 1, `no stale vulnerable duplicate of ${name}`);
    const [path, entry] = entries[0]!;
    assert.equal(entry.version, version);
    assert.equal(JSON.parse(await readFile(`${path}/package.json`, 'utf8')).version, version);
    assert.ok(apiRequire.resolve(name).startsWith(`${resolve(path)}${sep}`), `API must use the verified ${name} copy`);
  }
});

test('actual Node HTTP adapter rejects raw backslash paths before a protected route can run', { timeout: 10_000 }, async (t) => {
  const { serve } = apiRequire('@hono/node-server');
  let secretReads = 0;
  const app = new Hono();
  app.get('/admin/secret', context => { secretReads++; return context.text('SYNTHETIC-PRIVATE'); });
  app.get('/public', context => context.text('public positive control'));
  let server: Server | undefined;
  t.after(async () => {
    if (!server?.listening) return;
    server.closeAllConnections();
    await new Promise<void>((yes, no) => server!.close(error => error ? no(error) : yes()));
  });
  await new Promise<void>((yes, no) => {
    server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, yes);
    server!.once('error', no);
  });
  const port = (server!.address() as AddressInfo).port;
  // fetch/URL would normalize the adversarial path before sending it. Preserve
  // the actual HTTP/1.1 request-target to test the real Node adapter boundary.
  const raw = (path: string) => new Promise<{ status: number; body: string }>((yes, no) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path, method: 'GET', headers: { connection: 'close' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; if (body.length > 4096) response.destroy(new Error('FIXTURE_BODY_LIMIT')); });
      response.once('error', no);
      response.once('end', () => yes({ status: response.statusCode ?? 0, body }));
    });
    request.once('error', no);
    request.setTimeout(2000, () => request.destroy(new Error('FIXTURE_HTTP_TIMEOUT')));
    request.end();
  });
  for (const path of ['/admin\\secret', '/public\\..\\admin/secret', 'http://fixture.invalid/public\\..\\admin/secret']) {
    const response = await raw(path);
    assert.equal(response.status, 400, path);
    assert.doesNotMatch(response.body, /SYNTHETIC-PRIVATE/);
  }
  assert.equal(secretReads, 0);
  assert.equal((await raw('/admin%5Csecret')).status, 404, 'encoded backslash is not silently normalized into the private route');
  assert.deepEqual(await raw('/public?value=one\\two'), { status: 200, body: 'public positive control' });
  assert.equal(secretReads, 0);
});

test('Hono wildcard middleware cannot be skipped by overlapping routes or explicit default parameters', async () => {
  const app = new Hono();
  app.use('/admin/*', authorize);
  app.get('/admin*', context => context.text('synthetic protected route'));
  app.use('/api/:tenant{[^/]+}/admin/*', authorize);
  app.get('/api/:tenant/admin/:id', context => context.text('synthetic tenant route'));
  for (const path of ['/admin/secret', '/api/fixture/admin/secret']) {
    assert.equal((await app.request(path)).status, 401, path);
    assert.equal((await app.request(path, { headers })).status, 200, 'authorized positive control');
  }
});

test('Hono wildcard authentication also runs before encoded-line-terminator not-found handlers', async () => {
  const app = new Hono();
  app.use('*', authorize);
  app.get('/known', context => context.text('authorized fixture'));
  app.notFound(context => context.text('synthetic not-found detail', 404));
  for (const encoded of ['%0A', '%0D', '%E2%80%A8', '%E2%80%A9']) {
    assert.equal((await app.request(`/unknown/${encoded}`)).status, 401, encoded);
    assert.equal((await app.request(`/unknown/${encoded}`, { headers })).status, 404);
  }
  assert.equal((await app.request('/known', { headers })).status, 200);
});

test('mounted paths cannot be re-normalized or truncated past outer authentication', async () => {
  const inner = new Hono();
  inner.get('/admin/secret', context => context.text('SYNTHETIC-PRIVATE'));
  for (const prefix of ['/app', '/api/:tenant']) {
    const outer = new Hono();
    outer.use(`${prefix}/admin/*`, authorize);
    outer.mount(prefix, inner.fetch);
    const base = prefix === '/app' ? '/app' : '/api/a';
    assert.equal((await outer.request(`${base}/admin/secret`)).status, 401);
    assert.equal((await outer.request(`${base}/admin/secret`, { headers })).status, 200);
    for (const path of [`${base}/public%5C..%5Cadmin/secret`, `${base}/xxxxx/admin/secret`]) {
      const response = await outer.request(path);
      assert.equal(response.status, 404, path);
      assert.doesNotMatch(await response.text(), /SYNTHETIC-PRIVATE/);
    }
  }
});

test('Hono CSRF blocks cross-origin hyperlink auditing without rejecting same-origin positive control', async () => {
  let mutations = 0;
  const app = new Hono();
  app.use('*', csrf());
  app.post('/mutate', context => { mutations++; return context.text('synthetic mutation'); });
  const request = (origin: string, site: string) => new Request('https://fixture.example/mutate', { method: 'POST', headers: { origin, 'sec-fetch-site': site, 'content-type': 'text/ping' }, body: 'PING' });
  assert.equal((await app.fetch(request('https://other.example', 'cross-site'))).status, 403);
  assert.equal(mutations, 0);
  assert.equal((await app.fetch(request('https://fixture.example', 'same-origin'))).status, 200);
  assert.equal(mutations, 1);
});

test('Hono multipart validation sees fields even with legal additional parameters or whitespace', async () => {
  for (const variant of ['extra-parameter', 'extra-space']) {
    const seen: string[][] = [];
    const app = new Hono();
    app.post('/form', validator('form', (value, context) => {
      seen.push(Object.keys(value));
      if ('role' in value) return context.text('forbidden fixture field', 400);
      return value;
    }), context => context.text('accepted fixture', 200));
    const send = async (forbidden: boolean) => {
      const form = new FormData(); form.set(forbidden ? 'role' : 'label', 'synthetic');
      const request = new Request('https://fixture.example/form', { method: 'POST', body: form });
      const type = request.headers.get('content-type')!;
      request.headers.set('content-type', variant === 'extra-parameter' ? `${type}; charset=utf-8` : type.replace('; boundary=', ';  boundary='));
      return app.fetch(request);
    };
    assert.equal((await send(true)).status, 400, variant);
    assert.deepEqual(seen[0], ['role']);
    assert.equal((await send(false)).status, 200);
    assert.deepEqual(seen[1], ['label']);
  }
});
