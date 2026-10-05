#!/usr/bin/env node
/* global fetch, AbortSignal */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const commandArtifacts = {
  'supply-chain': ['reports/ci/canopyproof-supply-chain-gate.json', 'reports/ci/canopyproof-sbom.cdx.json'],
  workspace: ['reports/npm-audit-moderate.json'],
  coverage: ['reports/ci/canopyproof-coverage.txt', 'coverage/coverage-summary.json',
    'reports/canopyproof-repository-coverage.json', 'reports/canopyproof-repository-coverage.md'],
  'critical-coverage': ['reports/canopyproof-critical-coverage.json', 'reports/canopyproof-critical-coverage.md'],
  webgl: ['reports/canopyproof-cross-browser-webgl.json', 'reports/canopyproof-cross-browser-webgl.md'],
  'workerd-smoke': ['reports/canopyproof-workerd-smoke.json'],
};
const now = () => new Date().toISOString();
const sha = (value) => createHash('sha256').update(value).digest('hex');
const json = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const outputRoot = () => resolve(process.env.LIFEPP_VALIDATION_OUTPUT_DIR ?? 'reports/lifepp-validation/local');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const npmVersion = () => execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const artifactSignature = (path) => existsSync(path) ? `${statSync(path, { bigint: true }).mtimeNs}:${sha(readFileSync(path))}` : null;

export function sourceSnapshot() {
  const repositoryRoot = git('rev-parse', '--show-toplevel');
  const prefix = git('rev-parse', '--show-prefix');
  const scope = ['apps', 'packages', 'services', 'tests', 'scripts', 'integrations', 'contracts', 'infra', 'config',
    'package*', '*.config.*', 'tsconfig*.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'yarn.lock',
    '.npmrc', '.nvmrc', '.node-version', '.gitignore', '.github'].map((path) => `${prefix}${path}`);
  scope.push('.github/workflows', '.gitignore');
  const runGit = (...args) => execFileSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const tracked = new Set(runGit('ls-files', '--cached', '-z', '--', ...scope).split('\0').filter(Boolean));
  const untracked = runGit('ls-files', '--others', '--exclude-standard', '-z', '--', ...scope).split('\0').filter(Boolean).sort();
  const entries = [...new Set([...tracked, ...untracked])].sort().map((path) => {
    const absolute = join(repositoryRoot, path);
    const stat = lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) return [path, tracked.has(path) ? 'tracked' : 'untracked', 'missing'];
    assert.ok(stat.isFile() || stat.isSymbolicLink(), `Cannot fingerprint non-file source: ${path}`);
    return [path, tracked.has(path) ? 'tracked' : 'untracked', stat.isSymbolicLink() ? 'symlink' : 'file',
      stat.mode & 0o111, sha(stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute))];
  });
  return { sourceFingerprintSha256: sha(JSON.stringify(entries)), sourceFileCount: entries.length,
    sourceStatus: runGit('status', '--porcelain=v1', '--untracked-files=all', '--', ...scope).trim(),
    sourceUntracked: untracked,
    sourceScope: 'Git-tracked and nonignored untracked application, package, service, test, script, integration, contract and infrastructure sources; project config, package/workspace manifests, runtime/ignore rules and root workflows. Project reports/docs and ignored build/cache output are outside scope.' };
}

export function snapshot() {
  return { head: git('rev-parse', 'HEAD'), node: process.version, npm: npmVersion(),
    lockSha256: sha(readFileSync('package-lock.json')), ...sourceSnapshot(), observedAt: now() };
}

export function initialize(ids) {
  assert.ok(ids.length && ids.every((id) => /^[a-z0-9-]+$/.test(id)), 'Expected gate IDs are required.');
  assert.equal(new Set(ids).size, ids.length, 'Gate IDs must be unique.');
  const root = outputRoot();
  assert.equal(existsSync(root), false, 'Refuse to reuse an evidence directory.');
  mkdirSync(root, { recursive: true });
  const actual = snapshot();
  const expectedSha = process.env.LIFEPP_EXPECTED_SHA ?? null;
  const status = git('status', '--porcelain', '--untracked-files=normal');
  const report = { schemaVersion: 1, status: 'RUNNING', startedAt: now(), ...actual, expectedSha,
    checkoutClean: status === '', checkoutStatus: status,
    trackedDiffSha256: sha(git('diff', 'HEAD', '--binary')),
    runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    workflow: process.env.GITHUB_WORKFLOW ?? null, expectedCommands: ids,
    productionAuthority: false, scope: 'Local CI validation; real third-party scene rights and readiness remain unverified.',
    artifactPolicy: 'Only command-owned outputs newly written during this run are copied. Existing checked-in evidence is never uploaded.' };
  try {
    assert.match(expectedSha ?? '', /^[a-f0-9]{40}$/, 'Expected candidate SHA must be explicit.');
    assert.equal(actual.head, expectedSha, 'Actual HEAD does not match the candidate SHA.');
    if (process.env.GITHUB_ACTIONS === 'true') assert.equal(report.checkoutClean, true, 'CI must start from an actually clean checkout.');
  } catch (error) { report.status = 'FAIL'; report.error = String(error); json(join(root, 'run.json'), report); throw error; }
  json(join(root, 'run.json'), report);
  return report;
}

export async function runCommand(id, command, { env = process.env } = {}) {
  const root = outputRoot();
  const report = JSON.parse(readFileSync(join(root, 'run.json'), 'utf8'));
  assert.equal(report.status, 'RUNNING', 'Evidence run must be initialized and open.');
  assert.ok(report.expectedCommands.includes(id), 'Command is not part of this evidence run.');
  assert.ok(command.length > 0, 'A command is required.');
  const resultPath = join(root, `${id}.json`);
  assert.equal(existsSync(resultPath), false, 'Refuse to overwrite an existing command result.');
  const entry = { id, command, startedAt: now(), status: 'RUNNING', before: snapshot(), commandExitCode: null, exitCode: null, signal: null };
  const artifactsBefore = Object.fromEntries((commandArtifacts[id] ?? []).map((path) => [path, artifactSignature(path)]));
  json(resultPath, entry);
  try {
    assert.equal(entry.before.head, report.expectedSha, 'Candidate changed before command.');
    assert.equal(entry.before.lockSha256, report.lockSha256, 'Lockfile changed before command.');
    assert.equal(entry.before.sourceFingerprintSha256, report.sourceFingerprintSha256, 'Source files changed before command.');
    const log = join(root, `${id}.log`);
    writeFileSync(log, '');
    const child = spawn(command[0], command.slice(1), { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const capture = (target) => (chunk) => { appendFileSync(log, chunk); target.write(chunk); };
    child.stdout.on('data', capture(process.stdout)); child.stderr.on('data', capture(process.stderr));
    const outcome = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolveExit({ code, signal }));
    });
    entry.commandExitCode = outcome.code; entry.exitCode = outcome.code ?? 1; entry.signal = outcome.signal;
    entry.logSha256 = sha(readFileSync(log));
    entry.after = snapshot();
    assert.equal(entry.after.head, report.expectedSha, 'Candidate changed during command.');
    assert.equal(entry.after.lockSha256, report.lockSha256, 'Lockfile changed during command.');
    assert.equal(entry.after.sourceFingerprintSha256, report.sourceFingerprintSha256, 'Source files changed during command.');
    entry.status = entry.exitCode === 0 ? 'PASS' : 'FAIL';
  } catch (error) { entry.status = 'FAIL'; entry.error = String(error); entry.exitCode = entry.exitCode || 1; }
  entry.artifacts = [];
  for (const [path, previous] of Object.entries(artifactsBefore)) {
    const current = artifactSignature(path);
    if (current === null || current === previous) continue;
    const destination = join(root, 'artifacts', path);
    mkdirSync(dirname(destination), { recursive: true }); copyFileSync(path, destination);
    entry.artifacts.push({ path, sha256: sha(readFileSync(destination)), capturedAt: now() });
  }
  entry.finishedAt = now(); json(resultPath, entry);
  return entry.exitCode;
}

export function finish() {
  const root = outputRoot();
  const report = JSON.parse(readFileSync(join(root, 'run.json'), 'utf8'));
  assert.equal(report.status, 'RUNNING', 'Cannot complete a failed or closed initialization.');
  report.commands = report.expectedCommands.map((id) => {
    const path = join(root, `${id}.json`);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { id, status: 'NOT_RUN', exitCode: null };
  });
  report.finalSnapshot = snapshot();
  report.finishedAt = now();
  report.status = report.commands.every((entry) => entry.status === 'PASS') &&
    report.finalSnapshot.head === report.expectedSha && report.finalSnapshot.lockSha256 === report.lockSha256 &&
    report.finalSnapshot.sourceFingerprintSha256 === report.sourceFingerprintSha256 ? 'PASS' : 'FAIL';
  json(join(root, 'run.json'), report);
  return report.status === 'PASS' ? 0 : 1;
}

export function validateLocalConfig(config) {
  const allowedKeys = ['$schema', 'name', 'main', 'compatibility_date', 'compatibility_flags', 'workers_dev', 'preview_urls', 'assets', 'services', 'vars'];
  assert.ok(Object.keys(config).every((key) => allowedKeys.includes(key)), 'Local config may not add routes or external bindings.');
  assert.equal(config.name, 'canopyproof-web-local-preview');
  assert.equal(config.main, '.open-next/worker.js');
  assert.deepEqual(config.assets, { directory: '.open-next/assets', binding: 'ASSETS' });
  assert.deepEqual(config.services, [{ binding: 'WORKER_SELF_REFERENCE', service: config.name }]);
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false);
  assert.equal(config.vars.NEXT_PUBLIC_CANOPYPROOF_MODE, 'staging');
  assert.equal(config.vars.NEXT_PUBLIC_DROPIN_SITE_URL, 'http://127.0.0.1:8788');
  assert.equal(config.vars.NEXT_PUBLIC_DROPIN_API_URL, 'https://unconfigured-lifepp-api.invalid/api');
  for (const key of ['CANOPY_PRODUCTION_UNLOCK', 'CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED', 'CANOPYPROOF_NASA_GIBS_ENABLED',
    'DROPIN_ALLOW_ADMIN_PROXY', 'DROPIN_AUTOMATIC_CANOPY_DISTRIBUTION_ENABLED', 'DROPIN_MAINNET_TRANSFERS_ENABLED',
    'DROPIN_PHASE16_PROTOCOL_WRITES_ENABLED', 'NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS', 'PLANETARY_LAB']) assert.equal(config.vars[key], 'false', key);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  const port = server.address().port;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

export async function workerdBrowser() {
  const webRoot = resolve('apps/web');
  validateLocalConfig(JSON.parse(readFileSync(join(webRoot, 'wrangler.local.jsonc'), 'utf8')));
  for (const path of ['.open-next/worker.js', '.open-next/assets']) assert.ok(existsSync(join(webRoot, path)), `Missing ${path}`);
  // Refuse local secret files instead of inheriting developer credentials into the preview.
  for (const path of ['.dev.vars', '.dev.vars.local', '.env', '.env.local', '.env.production', '.env.production.local']) {
    assert.equal(existsSync(join(webRoot, path)), false, `Local preview must not load ${path}`);
  }
  const port = await availablePort();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:CLOUDFLARE_|CF_|DATABASE_URL$|CANOPYPROOF_NATIVE_DATABASE_URL$)/.test(key)));
  Object.assign(env, { WRANGLER_SEND_METRICS: 'false', BROWSER: 'none', NO_COLOR: '1',
    LIFEPP_BROWSER_BASE_URL: `http://127.0.0.1:${port}`, LIFEPP_BROWSER_SERVER_MODE: 'workerd',
    LIFEPP_BROWSER_OUTPUT_DIR: join(outputRoot(), 'browser-workerd'),
    LIFEPP_MAPLIBRE_OUTPUT_DIR: join(outputRoot(), 'browser-workerd') });
  const command = [process.execPath, resolve('node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', 'wrangler.local.jsonc',
    '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0'];
  process.stdout.write(`${JSON.stringify({ localServerCommand: command, browserBaseUrl: env.LIFEPP_BROWSER_BASE_URL, serverMode: env.LIFEPP_BROWSER_SERVER_MODE })}\n`);
  const server = spawn(command[0], command.slice(1), { cwd: webRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverOutput = ''; let serverError;
  const capture = (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-30000); process.stdout.write(chunk); };
  server.stdout.on('data', capture); server.stderr.on('data', capture); server.once('error', (error) => { serverError = error; });
  try {
    const deadline = Date.now() + 120000; let ready = false;
    while (Date.now() < deadline) {
      if (serverError) throw serverError;
      assert.equal(server.exitCode, null, `Local workerd exited: ${serverOutput}`);
      if (serverOutput.includes(`Ready on http://127.0.0.1:${port}`)) {
        try { const response = await fetch(env.LIFEPP_BROWSER_BASE_URL, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
          await response.body?.cancel(); if (response.status === 200) { ready = true; break; }
        } catch { /* Only the child-owned loopback listener may become ready. */ }
      }
      await delay(250);
    }
    assert.ok(ready, `Local workerd readiness timeout: ${serverOutput}`);
    let exitCode = 0;
    for (const spec of ['tests/browser/lifepp.spec.ts', 'tests/browser/maplibre-remediation.spec.ts']) {
      const browserCommand = [process.execPath, '--import', 'tsx', spec];
      process.stdout.write(`${JSON.stringify({ browserCommand, startedAt: now() })}\n`);
      const child = spawn(browserCommand[0], browserCommand.slice(1), { env, stdio: 'inherit' });
      const code = await new Promise((resolveExit) => {
        child.once('error', () => resolveExit(1)); child.once('exit', (result) => resolveExit(result ?? 1));
      });
      process.stdout.write(`${JSON.stringify({ browserCommand, exitCode: code, finishedAt: now() })}\n`);
      if (code !== 0 && exitCode === 0) exitCode = code;
    }
    return exitCode;
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await Promise.race([new Promise((done) => server.once('exit', done)), delay(5000, undefined, { ref: false })]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
  }
}

async function main() {
  try {
    const [mode, id, ...args] = process.argv.slice(2);
    if (mode === 'init') initialize((id ?? '').split(','));
    else if (mode === 'run') { assert.equal(args.shift(), '--'); process.exitCode = await runCommand(id, args); }
    else if (mode === 'finish') process.exitCode = finish();
    else if (mode === 'workerd-browser') process.exitCode = await workerdBrowser();
    else throw new Error('Usage: lifepp-validation-run.mjs init ID,... | run ID -- COMMAND... | finish | workerd-browser');
  } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
