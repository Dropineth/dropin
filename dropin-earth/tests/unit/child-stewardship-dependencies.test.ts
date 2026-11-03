import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

const require = createRequire(import.meta.url);
const apiRequire = createRequire(new URL("../../services/api/package.json", import.meta.url));

test("dependency regression: actual Node adapter cannot double-decode past static authorization", { timeout: 5000 }, async (t) => {
  // Resolve the API workspace's actual locked adapter, not a separately hoisted copy.
  const { serve } = apiRequire("@hono/node-server");
  const { serveStatic: nodeServeStatic } = apiRequire("@hono/node-server/serve-static");
  const root = await mkdtemp(join(tmpdir(), "child-node-static-"));
  let server: Server | undefined;
  t.after(async () => {
    try {
      if (server?.listening) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await mkdir(join(root, "static/admin"), { recursive: true });
  await writeFile(join(root, "static/admin/secret.txt"), "synthetic private fixture");
  await writeFile(join(root, "static/public.txt"), "public positive control");
  let servedFiles = 0;
  const app = new Hono();
  app.get("/static/admin/*", context => context.text("Not authorized", 401));
  app.use("/static/*", nodeServeStatic({ root, onFound: () => { servedFiles++; } }));
  await new Promise<void>((resolve, reject) => {
    server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, resolve);
    server!.once("error", reject);
  });
  const address = server!.address() as AddressInfo;
  const request = (path: string) => fetch(`http://127.0.0.1:${address.port}${path}`, { signal: AbortSignal.timeout(1500) });
  const denied = await request("/static/admin/secret.txt");
  assert.equal(denied.status, 401); await denied.text();
  for (const path of ["/static/%%36%31dmin/secret.txt", "/static/%2Fadmin/secret.txt"]) {
    const response = await request(path);
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes("synthetic private fixture"));
  }
  assert.equal(servedFiles, 0, "rejected requests never serve a private file");
  const allowed = await request("/static/public.txt");
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), "public positive control");
  assert.equal(servedFiles, 1, "legitimate Node HTTP streaming remains available");
});

test("dependency regression: malformed encoded static paths cannot bypass prefix authorization", async () => {
  let reads = 0;
  const app = new Hono();
  app.get("/static/admin/*", (context) => context.text("Not authorized", 401));
  app.use("/static/*", serveStatic({
    getContent: async () => { reads++; return "synthetic private fixture"; },
  }));
  assert.equal((await app.request("/static/admin/secret.txt")).status, 401);
  for (const pathname of ["/static/%%36%31dmin/secret.txt", "/static/%2Fadmin/secret.txt"]) {
    assert.equal((await app.request(pathname)).status, 404);
  }
  assert.equal(reads, 0, "rejected paths must not reach the content reader");
  assert.equal((await app.request("/static/public.txt")).status, 200);
  assert.equal(reads, 1, "ordinary public files remain available");
});

test("dependency regression: Anchor TOML handles large table sets and rejects unbounded integers within a process deadline", () => {
  const anchorRequire = createRequire(require.resolve("@coral-xyz/anchor/package.json"));
  const result = spawnSync(process.execPath, ["--max-old-space-size=192", "--input-type=commonjs", "-e", String.raw`
    const assert = require('node:assert/strict');
    const toml = require(process.argv[1]);
    const count = 20000;
    const source = Array.from({length: count}, (_, i) => '[[row' + i + ']]\nvalue = 1').join('\n');
    const parsed = toml.parse(source);
    assert.equal(Object.keys(parsed).length, count);
    assert.equal(parsed.row19999[0].value, 1);
    const path = Array.from({length: 4000}, (_, i) => 'key' + i);
    let nested = toml.parse(path.join('.') + ' = 2');
    for (const key of path) nested = nested[key];
    assert.equal(nested, 2);
    assert.throws(() => toml.parse('amount = ' + '9'.repeat(100000)), /64-bit signed integer range/);
    process.stdout.write('bounded TOML regression passed\n');
  `, anchorRequire.resolve("toml")], {
    encoding: "utf8", timeout: 8000, killSignal: "SIGKILL", maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "bounded TOML regression passed\n");
});
