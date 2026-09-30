import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const anchorRequire = createRequire(require.resolve("@coral-xyz/anchor/package.json"));
const prismaRequire = createRequire(require.resolve("@prisma/config/package.json"));

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
