import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import test from "node:test";

interface PackageManifest {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const ROOT = process.cwd();
const PACKAGE_JSON = join(ROOT, "package.json");
const ROOT_WORKFLOW = join(ROOT, "..", ".github", "workflows", "canopyproof-ci.yml");
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "node_modules",
  "target",
]);

function readManifest(): PackageManifest {
  return JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as PackageManifest;
}

function requireScript(manifest: PackageManifest, name: string): string {
  const script = manifest.scripts?.[name];
  assert.equal(typeof script, "string", `missing package script: ${name}`);
  assert.notEqual(script.trim(), "", `empty package script: ${name}`);
  return script;
}

function listFiles(directory: string): string[] {
  if (!statSync(directory, { throwIfNoEntry: false })) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(relative(ROOT, absolutePath).split(sep).join("/"));
    }
  }
  return files.sort();
}

function integrationPaths(script: string): string[] {
  return script.match(/tests\/integration\/[A-Za-z0-9._/-]+\.integration\.ts/g) ?? [];
}

test("root unit and workflow-contract tests are owned by npm run test", () => {
  const manifest = readManifest();
  const unitScript = requireScript(manifest, "test");
  const unitFiles = listFiles(join(ROOT, "tests", "unit")).filter((path) =>
    path.endsWith(".test.ts"),
  );
  const workflowContracts = unitFiles.filter((path) =>
    /(workflow|deployment)/i.test(path),
  );

  assert.match(unitScript, /tests\/unit\/\*\.test\.ts/);
  assert.ok(unitFiles.length > 0, "unit test directory must not be empty");
  assert.ok(workflowContracts.length > 0, "workflow contract tests must remain present");
});

test("every integration test is assigned exactly once to PGlite or native PostgreSQL", () => {
  const manifest = readManifest();
  const pglite = integrationPaths(requireScript(manifest, "db:verify:canopyproof"));
  const native = integrationPaths(requireScript(manifest, "db:verify:canopyproof:native"));
  const assigned = [...pglite, ...native].sort();
  const discovered = listFiles(join(ROOT, "tests", "integration")).filter((path) =>
    path.endsWith(".integration.ts"),
  );

  assert.equal(new Set(assigned).size, assigned.length, "integration test assigned more than once");
  assert.deepEqual(assigned, discovered);
  assert.match(requireScript(manifest, "ci"), /npm run db:verify:canopyproof/);
});

test("FiftyOne and Solana workspace-local tests have explicit commands", () => {
  const manifest = readManifest();
  const fiftyOneTests = listFiles(join(ROOT, "integrations", "fiftyone", "tests")).filter(
    (path) => /\/test_[^/]+\.py$/.test(path),
  );
  const solanaTests = listFiles(join(ROOT, "contracts", "solana", "tests")).filter((path) =>
    path.endsWith(".spec.ts"),
  );

  assert.deepEqual(fiftyOneTests, [
    "integrations/fiftyone/tests/test_canopyproof_client.py",
  ]);
  assert.match(requireScript(manifest, "test:fiftyone"), /python3 -m unittest discover/);
  assert.match(requireScript(manifest, "ci"), /npm run test:fiftyone/);

  assert.deepEqual(solanaTests, ["contracts/solana/tests/dropin-anchor.spec.ts"]);
  assert.match(requireScript(manifest, "anchor:test"), /anchor test/);
});

test("browser tests have an explicit runner and CanopyProof CI preserves every gate owner", () => {
  const manifest = readManifest();
  const workflow = readFileSync(ROOT_WORKFLOW, "utf8");
  const browserTests = listFiles(join(ROOT, "tests", "browser")).filter(
    (path) => path.endsWith(".spec.ts"),
  );

  assert.deepEqual(browserTests, [
    "tests/browser/canopyproof-global-impact-webgl.spec.ts",
  ]);
  assert.match(
    requireScript(manifest, "test:webgl:browser"),
    /canopyproof-global-impact-webgl\.spec\.ts/,
  );
  assert.match(workflow, /npm run ci/);
  assert.match(workflow, /npm run db:verify:canopyproof:native/);
  assert.match(workflow, /npm run test:coverage:ratchet/);
  assert.match(workflow, /npm run coverage:critical/);
  assert.match(workflow, /npm run test:webgl:browser/);
});

test("every first-party file dependency resolves from its declaring manifest", () => {
  const manifestPaths = [
    "package.json",
    ...["apps", "packages", "services"]
      .flatMap((directory) => listFiles(join(ROOT, directory)))
      .filter((path) => path.endsWith("/package.json")),
  ];
  const dependencyFields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const;

  for (const manifestPath of manifestPaths) {
    const absoluteManifestPath = join(ROOT, manifestPath);
    const manifest = JSON.parse(
      readFileSync(absoluteManifestPath, "utf8"),
    ) as PackageManifest;

    for (const field of dependencyFields) {
      for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
        if (!specifier.startsWith("file:")) continue;
        const target = resolve(dirname(absoluteManifestPath), specifier.slice("file:".length));
        assert.equal(
          existsSync(target),
          true,
          `${manifestPath} declares missing local dependency ${name}: ${specifier}`,
        );
      }
    }
  }
});

test("no first-party test file is outside a declared suite family", () => {
  const candidates = ["apps", "contracts", "integrations", "packages", "services", "tests"]
    .flatMap((directory) => listFiles(join(ROOT, directory)))
    .filter((path) =>
      /(^|\/)(test_[^/]+\.py|[^/]+\.(test|spec)\.(cjs|js|mjs|ts|tsx)|[^/]+\.integration\.ts)$/.test(
        path,
      ),
    );
  const classified = candidates.filter(
    (path) =>
      /^tests\/unit\/[^/]+\.test\.ts$/.test(path) ||
      /^tests\/integration\/[^/]+\.integration\.ts$/.test(path) ||
      /^tests\/browser\/[^/]+\.spec\.ts$/.test(path) ||
      path === "integrations/fiftyone/tests/test_canopyproof_client.py" ||
      path === "contracts/solana/tests/dropin-anchor.spec.ts",
  );

  assert.deepEqual(classified, candidates);
});
