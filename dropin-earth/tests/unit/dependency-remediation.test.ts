import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const require = createRequire(import.meta.url);
const anchorRequire = createRequire(require.resolve("@coral-xyz/anchor/package.json"));
const prismaRequire = createRequire(require.resolve("@prisma/config/package.json"));

test("proxy-addr rejects IPv4 spoofing through broad IPv6 trust while preserving valid subnets", () => {
  // GHSA-jqcg-44mw-7w3h: an IPv6 prefix must not accidentally trust every IPv4 client.
  const proxyaddr = require("proxy-addr");
  const claimedClient = "198.51.100.77";
  const request = (remoteAddress: string) => ({
    socket: { remoteAddress }, headers: { "x-forwarded-for": claimedClient },
  });
  for (const subnet of ["::/1", "::ffff:10.0.0.0/8"]) {
    // Exercise the package's single-subnet and multi-subnet implementations.
    for (const trust of [subnet, [subnet, "192.0.2.0/24"]]) {
      for (const remoteAddress of ["203.0.113.9", "::ffff:203.0.113.9"]) {
        assert.equal(proxyaddr.compile(trust)(remoteAddress), false, `${remoteAddress} via ${JSON.stringify(trust)}`);
        assert.equal(proxyaddr(request(remoteAddress), trust), remoteAddress, "untrusted peers cannot supply the client IP");
      }
    }
  }
  for (const subnet of ["10.0.0.0/8", "::ffff:10.0.0.0/104"]) {
    for (const trust of [subnet, [subnet, "192.0.2.0/24"]]) {
      for (const remoteAddress of ["10.2.3.4", "::ffff:10.2.3.4"]) {
        assert.equal(proxyaddr.compile(trust)(remoteAddress), true);
        assert.equal(proxyaddr(request(remoteAddress), trust), claimedClient, "valid trusted proxies retain forwarding behavior");
      }
      assert.equal(proxyaddr.compile(trust)("203.0.113.9"), false);
      assert.equal(proxyaddr.compile(trust)("2001:db8::1"), false);
    }
  }
  assert.equal(proxyaddr.compile("2001:db8::/32")("2001:db8::1"), true, "native IPv6 trust still works");
});

test("source-map-js rejects malicious section offsets and preserves normal source-map roundtrips", () => {
  // GHSA-68fv-2mgg-jv7q involves synchronous work: only an external process deadline
  // can stop a regressed consumer. Never use a timer on the same event loop.
  const modulePath = require.resolve("source-map-js");
  const result = spawnSync(process.execPath, ["--max-old-space-size=64", "--input-type=commonjs", "-e", String.raw`
    const assert = require('node:assert/strict');
    const { SourceMapConsumer, SourceMapGenerator, SourceNode } = require(process.argv[1]);
    const generator = new SourceMapGenerator({ file: 'bundle.js' });
    generator.addMapping({ generated: { line: 1, column: 0 }, original: { line: 2, column: 3 }, source: 'input.ts', name: 'answer' });
    generator.setSourceContent('input.ts', '\n   answer');
    const flat = generator.toJSON();
    const consumer = new SourceMapConsumer(flat);
    assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 0 }), { source: 'input.ts', line: 2, column: 3, name: 'answer' });
    const roundtrip = new SourceMapConsumer(SourceMapGenerator.fromSourceMap(consumer).toJSON());
    assert.deepEqual(roundtrip.originalPositionFor({ line: 1, column: 0 }), consumer.originalPositionFor({ line: 1, column: 0 }));
    assert.equal(roundtrip.sourceContentFor('input.ts'), '\n   answer');
    assert.equal(SourceNode.fromStringWithSourceMap('answer', consumer).toString(), 'answer');

    const indexed = (line, column = 0, map = flat) => ({ version: 3, sections: [{ offset: { line, column }, map }] });
    const normalIndexed = new SourceMapConsumer(indexed(2));
    const mappings = [];
    normalIndexed.eachMapping(mapping => mappings.push(mapping));
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0].generatedLine, 3);
    assert.equal(SourceNode.fromStringWithSourceMap('\n\nanswer', normalIndexed).toString(), '\n\nanswer');

    // The full consumer path is deliberately inside this bounded child: the old
    // version accepts the offset and can loop/allocate after generated code ends.
    assert.throws(() => {
      const malicious = new SourceMapConsumer(indexed(2 ** 31));
      SourceNode.fromStringWithSourceMap('answer', malicious);
      SourceMapGenerator.fromSourceMap(malicious).toString();
    }, /Section offset line must not exceed/);
    assert.throws(() => new SourceMapConsumer(indexed(6_000_000, 0, indexed(6_000_000))), /including offsets of nested sections/);
    for (const invalid of [-1, 0.5, Infinity, NaN, '1']) {
      assert.throws(() => new SourceMapConsumer(indexed(invalid)), /non-negative integers/);
      assert.throws(() => new SourceMapConsumer(indexed(0, invalid)), /non-negative integers/);
    }
    process.stdout.write('source-map roundtrip and offset guards passed\n');
  `, modulePath], {
    encoding: "utf8", timeout: 5000, killSignal: "SIGKILL", maxBuffer: 64 * 1024,
  });
  const diagnostic = `module=${modulePath}; status=${result.status}; signal=${result.signal}; error=${result.error?.message ?? "none"}; stderr=${result.stderr}`;
  assert.equal(result.error, undefined, diagnostic);
  assert.equal(result.signal, null, diagnostic);
  assert.equal(result.status, 0, diagnostic);
  assert.equal(result.stdout, "source-map roundtrip and offset guards passed\n");
});

test("patched brace expansion keeps tooling globs working and bounds nested input", () => {
  const { braceExpand } = require("minimatch");
  assert.deepEqual(braceExpand("tests/{unit,browser}/*.{ts,tsx}"), [
    "tests/unit/*.ts", "tests/unit/*.tsx", "tests/browser/*.ts", "tests/browser/*.tsx",
  ]);
  let expanded: string[] = [];
  assert.doesNotThrow(() => { expanded = braceExpand(`${"{".repeat(4000)}one,two${"}".repeat(4000)}`); });
  assert.ok(expanded.length > 0 && expanded.length <= 2);
});

test("Next lint's resolved glob retains directory and brace matching with the root overrides", async () => {
  const nextRequire = createRequire(require.resolve("@next/eslint-plugin-next/package.json"));
  const globRequire = createRequire(nextRequire.resolve("glob/package.json"));
  const glob = nextRequire("glob");
  const minimatch = globRequire("minimatch");
  assert.deepEqual(minimatch.braceExpand("apps/{web,admin}"), ["apps/web", "apps/admin"]);
  const directory = await mkdtemp(path.join(tmpdir(), "lifepp-next-lint-glob-"));
  try {
    for (const app of ["web", "admin"]) {
      await mkdir(path.join(directory, "apps", app, "pages"), { recursive: true });
      await writeFile(path.join(directory, "apps", app, "pages", "index.jsx"), "export default function Page() { return null; }\n");
    }
    const appDirectories = ["admin", "web"].map((app) => path.join(directory, "apps", app));
    assert.deepEqual(glob.sync(path.join(directory, "apps", "{web,admin}"), { nodir: false }).sort(), appDirectories);
    assert.deepEqual(glob.sync(path.join(directory, "apps", "*", "pages"), { nodir: false }).sort(), appDirectories.map((app) => path.join(app, "pages")));
    assert.deepEqual(glob.sync(path.join(directory, "apps", "{web,admin}", "pages", "*.{js,jsx}"), { nodir: true }).sort(), appDirectories.map((app) => path.join(app, "pages", "index.jsx")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Next lint's active rules retain filename, ancestor and client-component checks on ESLint 10", () => {
  const { Linter } = require("eslint");
  const { fixupPluginRules } = require("@eslint/compat");
  const nextPlugin = require("@next/eslint-plugin-next");
  const rules = {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "off",
  };
  // These are the same two exclusions already present in both application configs.
  assert.equal(Object.values(rules).filter((severity) => severity !== "off").length, 19);
  const config = [{
    files: ["**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@next/next": fixupPluginRules(nextPlugin) },
    rules,
  }];
  const cases = [
    { rule: "no-head-element", filename: "pages/index.jsx", valid: "<Head/>", invalid: "<head/>" },
    { rule: "no-document-import-in-page", filename: "pages/index.jsx", valid: "import Head from 'next/head';", invalid: "import D from 'next/document';" },
    { rule: "no-head-import-in-document", filename: "pages/_document.jsx", valid: "import {Head} from 'next/document';", invalid: "import Head from 'next/head';" },
    { rule: "no-duplicate-head", filename: "pages/_document.jsx", valid: "import D from 'next/document'; class Doc extends D {render(){return <html><Head/></html>}}", invalid: "import D from 'next/document'; class Doc extends D {render(){return <html><Head/><Head/></html>}}" },
    { rule: "no-page-custom-font", filename: "pages/_document.jsx", valid: "function Doc(){return <link href='https://fonts.googleapis.com/css?family=X&display=optional'/>} export default Doc;", invalid: "function Other(){return <link href='https://fonts.googleapis.com/css?family=X&display=optional'/>} export default function Doc(){return null;}" },
    { rule: "no-before-interactive-script-outside-document", filename: "pages/index.jsx", valid: "import Script from 'next/script'; <Script strategy='afterInteractive'/>", invalid: "import Script from 'next/script'; <Script strategy='beforeInteractive'/>" },
    { rule: "no-styled-jsx-in-document", filename: "pages/_document.jsx", valid: "<style>{'x{}'}</style>", invalid: "<style jsx>{'x{}'}</style>" },
    { rule: "no-typos", filename: "pages/index.jsx", valid: "export const getStaticProps=()=>{};", invalid: "export const getStaticProp=()=>{};" },
    { rule: "no-async-client-component", filename: "app/page.jsx", valid: "'use client'; const Page=()=>null; export default Page;", invalid: "'use client'; const Page=async()=>null; export default Page;" },
    { rule: "no-assign-module-variable", filename: "pages/index.jsx", valid: "const localModule={};", invalid: "const module={};" },
    { rule: "no-sync-scripts", filename: "pages/index.jsx", valid: "<script src='/x.js' async/>", invalid: "<script src='/x.js'/>" },
  ];
  for (const fixture of cases) {
    for (const [kind, expectedCount] of [["valid", 0], ["invalid", 1]] as const) {
      const messages = new Linter().verify(fixture[kind], config, { filename: path.resolve(fixture.filename) });
      assert.equal(messages.some((message: { fatal?: boolean }) => message.fatal), false, fixture.rule);
      assert.equal(messages.filter((message: { ruleId?: string }) => message.ruleId === `@next/next/${fixture.rule}`).length, expectedCount, `${fixture.rule}: ${kind}`);
    }
  }
});

test("patched TOML preserves Anchor Buffer config parsing and rejects excessive nesting", async () => {
  const toml = anchorRequire("toml");
  const config = toml.parse(await readFile("contracts/solana/Anchor.toml"));
  assert.equal(config.features.seeds, false);
  assert.equal(config.features["skip-lint"], false);
  assert.equal(config.provider.cluster, "Localnet");
  assert.equal(config.provider.wallet, "~/.config/solana/id.json");
  assert.equal(config.programs.localnet.dropin_anchor, "D27zujuVZsAZdS1SHS2Lpi6573ioTQAvjrpWSXV3k1ks");
  assert.equal(typeof config.scripts.test, "string");
  assert.throws(() => toml.parse(`nested = ${"[".repeat(1500)}1${"]".repeat(1500)}`), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.notEqual(error.name, "RangeError", "the parser must reject nesting before a native stack overflow");
    return true;
  });
});

test("patched TOML cannot pollute Object.prototype through key paths", () => {
  const toml = anchorRequire("toml");
  const property = "lifepp_dependency_polluted";
  const parsed = toml.parse(`[__proto__]\n${property} = true\n`);
  assert.equal(Object.hasOwn(parsed, "__proto__"), true);
  // The advisory bypass traverses a scalar's actual prototype, rather than an
  // ordinary __proto__ key on a null-prototype TOML table.
  for (const input of [
    `[section.nested]\nvalue = 1\n[section.nested.value.__proto__.__proto__]\n${property} = true\n`,
    `sectionLong = 1\n[[section]]\n[sectionLong.__proto__.__proto__]\n${property} = true\n`,
  ]) {
    assert.throws(() => toml.parse(input));
    assert.equal(Object.hasOwn(Object.prototype, property), false);
  }
  assert.equal(Object.hasOwn(Object.prototype, property), false);
});

test("patched deepmerge preserves plain config merge and handles recursive object graphs", () => {
  const { deepmerge } = prismaRequire("deepmerge-ts");
  const original = { migrations: { path: "migrations", seed: "node seed.js" }, list: ["one"] };
  assert.deepEqual(deepmerge(original, { migrations: { path: "db/migrations" }, list: ["two"] }), {
    migrations: { path: "db/migrations", seed: "node seed.js" }, list: ["one", "two"],
  });
  assert.equal(original.migrations.path, "migrations");
  const circular: Record<string, unknown> = { label: "fixture" };
  circular.self = circular;
  const merged = deepmerge(circular, { additional: true });
  assert.equal(merged.label, "fixture");
  assert.equal(merged.additional, true);
  assert.equal(merged.self, merged);
});

test("Prisma 6 actually loads and resolves nested configuration using patched deepmerge", async () => {
  const { loadConfigFromFile } = prismaRequire("./dist/index.js");
  const directory = await mkdtemp(path.join(tmpdir(), "lifepp-prisma-config-"));
  try {
    await writeFile(path.join(directory, "prisma.config.mjs"), `export default {
      schema: './schema.prisma',
      migrations: { path: './migrations', seed: 'node fixture-seed.js' },
      engine: 'classic',
      datasource: { url: 'postgresql://fixture:fixture@localhost:5432/fixture' }
    };\n`);
    const result = await loadConfigFromFile({ configRoot: directory, configFile: "prisma.config.mjs" });
    assert.equal(result.error, undefined, JSON.stringify(result.error));
    assert.equal(result.config.schema, path.join(directory, "schema.prisma"));
    assert.equal(result.config.migrations.path, path.join(directory, "migrations"));
    assert.equal(result.config.migrations.seed, "node fixture-seed.js");
    assert.equal(result.config.datasource.url, "postgresql://fixture:fixture@localhost:5432/fixture");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Anchor's Solana client retains JSON-RPC success, error and batch behavior with patched Jayson", async () => {
  const { web3 } = require("@coral-xyz/anchor");
  const requests: { jsonrpc: string; method: string; id: string; params: unknown[] }[] = [];
  const connection = new web3.Connection("http://127.0.0.1:1", {
    disableRetryOnRateLimit: true,
    fetch: async (_url: unknown, init: { body: string }) => {
      const request = JSON.parse(init.body);
      if (Array.isArray(request)) {
        requests.push(...request);
        return new Response(JSON.stringify(request.map((entry) => ({ jsonrpc: "2.0", id: entry.id, result: null }))), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      requests.push(request);
      const response = request.method === "getVersion"
        ? { jsonrpc: "2.0", id: request.id, result: { "solana-core": "2.0.0", "feature-set": 1 } }
        : { jsonrpc: "2.0", id: request.id, error: { code: -32602, message: "fixture invalid parameters" } };
      return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.deepEqual(await connection.getVersion(), { "solana-core": "2.0.0", "feature-set": 1 });
  await assert.rejects(connection.getSlot(), /fixture invalid parameters/);
  assert.deepEqual(await connection.getParsedTransactions(["fixture-signature-one", "fixture-signature-two"]), [null, null]);
  assert.deepEqual(requests.map((request) => request.method), ["getVersion", "getSlot", "getTransaction", "getTransaction"]);
  assert.ok(requests.every((request) => request.jsonrpc === "2.0" && typeof request.id === "string"));
  assert.equal(new Set(requests.map((request) => request.id)).size, 4);
});

test("Undici enforces mixed-case SRI algorithms and the strongest supplied digest", async () => {
  // GHSA-f72v-6w45-q472: an uppercase algorithm must not silently disable SRI.
  const { createHash } = await import("node:crypto");
  const { fetch, MockAgent } = require("undici");
  const dispatcher = new MockAgent();
  dispatcher.disableNetConnect();
  const origin = dispatcher.get("https://integrity.invalid");
  const digest = (algorithm: string, body: string) => createHash(algorithm).update(body).digest("base64");
  try {
    for (const algorithm of ["sha256", "sha384", "sha512"]) {
      for (const token of [algorithm, algorithm.toUpperCase(), `ShA${algorithm.slice(3)}`]) {
        origin.intercept({ path: "/" }).reply(200, "expected");
        const good = await fetch("https://integrity.invalid/", { dispatcher, integrity: `${token}-${digest(algorithm, "expected")}` });
        assert.equal(await good.text(), "expected");
        origin.intercept({ path: "/" }).reply(200, "tampered");
        await assert.rejects(fetch("https://integrity.invalid/", { dispatcher, integrity: `${token}-${digest(algorithm, "expected")}` }), /fetch failed/);
      }
    }
    origin.intercept({ path: "/" }).reply(200, "expected");
    await assert.rejects(fetch("https://integrity.invalid/", {
      dispatcher,
      integrity: `sha256-${digest("sha256", "expected")} SHA512-${digest("sha512", "different")}`,
    }), /fetch failed/);
    dispatcher.assertNoPendingInterceptors();
  } finally { await dispatcher.close(); }
});

test("Undici rejects excess encodings without an orphan-stream process crash", () => {
  // GHSA-xjj6-f33q-929c: six headers, no compressed payload, bounded subprocess.
  const result = spawnSync(process.execPath, ["--max-old-space-size=64", "--input-type=commonjs", "-e", String.raw`
    const assert = require('node:assert/strict');
    const net = require('node:net');
    const { fetch, Agent } = require(process.argv[1]);
    (async () => {
      const server = net.createServer(socket => socket.once('data', request => {
        if (request.toString().startsWith('GET /bad ')) {
          socket.end('HTTP/1.1 200 OK\r\nContent-Encoding: gzip, gzip, gzip, gzip, gzip, gzip\r\nContent-Length: 1\r\nConnection: close\r\n\r\n');
        } else socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok');
      }));
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const dispatcher = new Agent();
      try {
        const origin = 'http://127.0.0.1:' + server.address().port;
        await assert.rejects(fetch(origin + '/bad', { dispatcher }), error => /too many content-encodings/.test(error.cause?.message));
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(await (await fetch(origin + '/good', { dispatcher })).text(), 'ok');
      } finally {
        await dispatcher.close();
        await new Promise(resolve => server.close(resolve));
      }
      process.stdout.write('encoding rejection and recovery passed\n');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, require.resolve("undici")], { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "encoding rejection and recovery passed\n");
});

for (const fixture of [
  { name: "empty data fields", maxEventSize: 131072, chunks: ["data:\n".repeat(1025)] },
  { name: "fragmented unfinished lines", maxEventSize: 131072, chunks: Array<string>(1025).fill("x") },
  { name: "oversize unfinished lines", maxEventSize: 32, chunks: ["data: " + "x".repeat(40)] },
]) {
  test(`Undici EventSource bounds ${fixture.name} and preserves complete events`, async () => {
    // GHSA-4qv8-2p9j-2685: at most 6,150 fixture bytes, never memory exhaustion.
    const { EventSourceStream } = require("undici/lib/web/eventsource/eventsource-stream");
    const run = async (chunks: string[], maxEventSize: number) => {
      const events: Array<{ options: { data: string } }> = [];
      const stream = new EventSourceStream({ maxEventSize, push: (event: { options: { data: string } }) => { events.push(event); return true; } });
      stream.on("error", () => {});
      let error: Error | undefined;
      try {
        for (const chunk of chunks) {
          error = await new Promise<Error | undefined>(resolve => stream.write(Buffer.from(chunk), (failure?: Error | null) => resolve(failure ?? undefined)));
          if (error) break;
        }
        return { error, events };
      } finally { stream.destroy(); }
    };
    const good = await run(["data: hello\n\n", "data: world\n\n"], fixture.maxEventSize);
    assert.equal(good.error, undefined);
    assert.deepEqual(good.events.map(event => event.options.data), ["hello", "world"]);
    const bad = await run(fixture.chunks, fixture.maxEventSize);
    assert.match(bad.error?.message ?? "", /EventSource message size exceeded/);
    assert.deepEqual(bad.events, []);
  });
}

test("Zod rejects oversize collections before element traversal and preserves overwrites", () => {
  // GHSA-mrhx-c7xc-m3w5: tiny collections demonstrate short-circuiting safely.
  const { z } = require("zod");
  let visited = 0;
  const item = z.string().refine(() => { visited += 1; return true; });
  const fixtures = [
    { schema: z.array(item).max(2), oversized: ["a", "b", "c"], valid: ["a", "b"], count: 2 },
    { schema: z.array(item).length(2), oversized: ["a", "b", "c"], valid: ["a", "b"], count: 2 },
    { schema: z.set(item).size(2), oversized: new Set(["a", "b", "c"]), valid: new Set(["a", "b"]), count: 2 },
    { schema: z.map(item, item).max(2), oversized: new Map([["a", "a"], ["b", "b"], ["c", "c"]]), valid: new Map([["a", "a"], ["b", "b"]]), count: 4 },
  ];
  for (const fixture of fixtures) {
    for (const compiledObject of [false, true]) {
      const schema = compiledObject ? z.object({ value: fixture.schema }) : fixture.schema;
      visited = 0;
      const bad = schema.safeParse(compiledObject ? { value: fixture.oversized } : fixture.oversized);
      assert.equal(bad.success, false);
      assert.equal(visited, 0, "oversize collection must not visit any element");
      assert.deepEqual(bad.error.issues.map((issue: { code: string }) => issue.code), ["too_big"]);
      visited = 0;
      assert.equal(schema.safeParse(compiledObject ? { value: fixture.valid } : fixture.valid).success, true);
      assert.equal(visited, fixture.count);
    }
  }
  assert.deepEqual(z.array(z.string()).overwrite((value: string[]) => value.slice(0, 2)).max(2).parse(["a", "b", "c"]), ["a", "b"]);
});
