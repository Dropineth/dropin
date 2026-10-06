import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
