import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { validateLocalConfig } from '../../scripts/lifepp-validation-run.mjs';

const runner = resolve('scripts/lifepp-validation-run.mjs');
const validationSources = ['eslint.config.mjs', 'tsconfig.base.json', 'pnpm-workspace.yaml',
  'integrations/fiftyone/plugins/client.py', 'integrations/fiftyone/tests/test_client.py'];
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'lifepp-validation-'));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
  writeFileSync(join(cwd, '.gitignore'), 'reports/\n.next/\nnode_modules/\n');
  writeFileSync(join(cwd, 'package-lock.json'), '{"lockfileVersion":3}\n');
  mkdirSync(join(cwd, 'apps/web/src'), { recursive: true });
  mkdirSync(join(cwd, '.github/workflows'), { recursive: true });
  writeFileSync(join(cwd, 'apps/web/src/candidate.ts'), 'export const candidate = 1;\n');
  writeFileSync(join(cwd, '.github/workflows/candidate.yml'), 'name: candidate\n');
  for (const path of validationSources) {
    mkdirSync(join(cwd, path.slice(0, path.lastIndexOf('/') + 1)), { recursive: true });
    writeFileSync(join(cwd, path), 'fixture source/config\n');
  }
  writeFileSync(join(cwd, 'integrations/fiftyone/.gitignore'), '__pycache__/\n.venv/\n');
  git('init', '--quiet'); git('add', '.'); git('commit', '--quiet', '-m', 'fixture');
  const expected = git('rev-parse', 'HEAD');
  const out = join(cwd, 'reports', 'fresh');
  const call = (args: string[], override: Record<string, string> = {}) => spawnSync(process.execPath, [runner, ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', LIFEPP_EXPECTED_SHA: expected, LIFEPP_VALIDATION_OUTPUT_DIR: out, ...override },
  });
  const report = (name = 'run') => JSON.parse(readFileSync(join(out, `${name}.json`), 'utf8'));
  return { cwd, git, expected, out, call, report, close: () => rmSync(cwd, { recursive: true, force: true }) };
}

test('validation evidence binds a clean actual HEAD, lock hash, runtime and successful command', () => {
  const f = fixture();
  try {
    assert.equal(f.call(['init', 'pass']).status, 0);
    assert.equal(f.call(['run', 'pass', '--', process.execPath, '-e', 'process.stdout.write("actual fixture output")']).status, 0);
    assert.equal(f.call(['finish']).status, 0);
    const report = f.report();
    assert.equal(report.head, f.expected); assert.equal(report.expectedSha, f.expected); assert.equal(report.checkoutClean, true);
    assert.match(report.lockSha256, /^[a-f0-9]{64}$/); assert.match(report.node, /^v\d/); assert.match(report.npm, /^\d/);
    assert.match(report.sourceFingerprintSha256, /^[a-f0-9]{64}$/); assert.equal(report.sourceStatus, '');
    assert.deepEqual(report.sourceUntracked, []); assert.equal(report.sourceFileCount, 10);
    assert.equal(report.status, 'PASS'); assert.equal(report.productionAuthority, false);
    const command = report.commands[0];
    assert.deepEqual(command.command, [process.execPath, '-e', 'process.stdout.write("actual fixture output")']);
    assert.equal(command.exitCode, 0); assert.equal(command.commandExitCode, 0); assert.ok(command.finishedAt >= command.startedAt);
    assert.equal(readFileSync(join(f.out, 'pass.log'), 'utf8'), 'actual fixture output');
    assert.match(command.logSha256, /^[a-f0-9]{64}$/);
  } finally { f.close(); }
});

test('same-HEAD source mutation fails the gate while preserving actual exit code and complete command log', () => {
  for (const exitCode of [0, 7]) {
    const f = fixture();
    try {
      assert.equal(f.call(['init', 'mutate']).status, 0);
      const result = f.call(['run', 'mutate', '--', process.execPath, '-e', `require('node:fs').writeFileSync('apps/web/src/candidate.ts','export const candidate = 2;');process.stdout.write('source mutation stdout');process.stderr.write('source mutation stderr');process.exit(${exitCode})`]);
      assert.equal(result.status, exitCode || 1);
      const entry = f.report('mutate');
      assert.equal(entry.status, 'FAIL'); assert.equal(entry.commandExitCode, exitCode); assert.equal(entry.exitCode, exitCode || 1);
      assert.equal(entry.before.head, entry.after.head); assert.equal(entry.before.lockSha256, entry.after.lockSha256);
      assert.notEqual(entry.before.sourceFingerprintSha256, entry.after.sourceFingerprintSha256);
      assert.match(entry.after.sourceStatus, /apps\/web\/src\/candidate\.ts/);
      assert.match(entry.error, /Source files changed during command/); assert.match(entry.logSha256, /^[a-f0-9]{64}$/);
      const log = readFileSync(join(f.out, 'mutate.log'), 'utf8');
      assert.match(log, /source mutation stdout/); assert.match(log, /source mutation stderr/);
      assert.equal(f.call(['finish']).status, 1);
    } finally { f.close(); }
  }
});

test('root workflow changes and new untracked source block the next command before execution', () => {
  for (const path of ['.github/workflows/candidate.yml', 'apps/web/src/new.ts', 'packages/new.ts', 'services/new.ts', 'tests/new.ts', 'scripts/new.mjs', 'package-new.json',
    'integrations/fiftyone/new.py', 'infra/new.ts', 'contracts/new.ts', 'config/new.json', 'eslint.extra.config.mjs', 'tsconfig.new.json']) {
    const f = fixture();
    try {
      assert.equal(f.call(['init', 'next']).status, 0);
      const directory = join(f.cwd, path.slice(0, path.lastIndexOf('/') + 1));
      mkdirSync(directory, { recursive: true }); writeFileSync(join(f.cwd, path), 'changed source');
      assert.equal(f.call(['run', 'next', '--', process.execPath, '-e', 'process.stdout.write("MUST_NOT_RUN")']).status, 1);
      const entry = f.report('next');
      assert.equal(entry.commandExitCode, null); assert.match(entry.error, /Source files changed before command/);
      assert.throws(() => readFileSync(join(f.out, 'next.log')));
      if (path !== '.github/workflows/candidate.yml') assert.ok(entry.before.sourceUntracked.includes(path));
    } finally { f.close(); }
  }
});

test('FiftyOne implementation/tests and root validation config cannot mutate under the same HEAD', () => {
  for (const path of validationSources) {
    const f = fixture();
    try {
      assert.equal(f.call(['init', 'mutate']).status, 0);
      const result = f.call(['run', 'mutate', '--', process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(path)},'changed validation input');process.stdout.write('config or Python mutation')`]);
      assert.equal(result.status, 1);
      const entry = f.report('mutate');
      assert.equal(entry.commandExitCode, 0); assert.match(entry.error, /Source files changed during command/);
      assert.equal(entry.before.head, entry.after.head); assert.equal(entry.before.lockSha256, entry.after.lockSha256);
      assert.notEqual(entry.before.sourceFingerprintSha256, entry.after.sourceFingerprintSha256);
      assert.equal(readFileSync(join(f.out, 'mutate.log'), 'utf8'), 'config or Python mutation');
    } finally { f.close(); }
  }
});

test('generated reports, documentation and ignored build output do not change the source fingerprint', () => {
  const f = fixture();
  try {
    assert.equal(f.call(['init', 'generated']).status, 0);
    const result = f.call(['run', 'generated', '--', process.execPath, '-e', `const fs = require('node:fs');for(const path of ['docs','reports','apps/web/.next','integrations/fiftyone/__pycache__','integrations/fiftyone/.venv']){fs.mkdirSync(path,{recursive:true});fs.writeFileSync(path+'/new-output.txt','generated');}`]);
    assert.equal(result.status, 0, result.stderr);
    const entry = f.report('generated');
    assert.equal(entry.before.sourceFingerprintSha256, entry.after.sourceFingerprintSha256);
    assert.equal(f.call(['finish']).status, 0);
  } finally { f.close(); }
});

test('failure remains nonzero while an independent command can still collect evidence; missing gates never pass', () => {
  const f = fixture();
  try {
    assert.equal(f.call(['init', 'fail,later,missing']).status, 0);
    assert.equal(f.call(['run', 'fail', '--', process.execPath, '-e', 'process.stderr.write("fixture failure");process.exit(7)']).status, 7);
    assert.equal(f.report('fail').exitCode, 7);
    assert.equal(f.call(['run', 'later', '--', process.execPath, '-e', '']).status, 0);
    assert.equal(f.call(['finish']).status, 1);
    assert.deepEqual(f.report().commands.map((entry: {status: string}) => entry.status), ['FAIL', 'PASS', 'NOT_RUN']);
    assert.equal(f.report().status, 'FAIL');
  } finally { f.close(); }
});

test('wrong actual SHA and dirty CI checkout fail initialization with persisted reason', () => {
  for (const dirty of [false, true]) {
    const f = fixture();
    try {
      if (dirty) writeFileSync(join(f.cwd, 'package-lock.json'), '{}\n');
      assert.equal(f.call(['init', 'pass'], dirty ? {} : { LIFEPP_EXPECTED_SHA: 'f'.repeat(40) }).status, 1);
      assert.equal(f.report().status, 'FAIL');
      assert.match(f.report().error, dirty ? /actually clean/ : /does not match/);
      assert.equal(f.call(['run', 'pass', '--', process.execPath, '-e', '']).status, 1);
    } finally { f.close(); }
  }
});

test('lock mutation, changed candidate, duplicate results and stale report reuse fail closed', () => {
  const f = fixture();
  try {
    assert.equal(f.call(['init', 'mutate,later']).status, 0);
    assert.equal(f.call(['init', 'mutate']).status, 1);
    assert.equal(f.call(['run', 'mutate', '--', process.execPath, '-e', 'require("node:fs").writeFileSync("package-lock.json","{}")']).status, 1);
    assert.match(f.report('mutate').error, /Lockfile changed during/);
    assert.equal(f.call(['run', 'mutate', '--', process.execPath, '-e', '']).status, 1);
    f.git('add', 'package-lock.json'); f.git('commit', '--quiet', '-m', 'other candidate');
    assert.equal(f.call(['run', 'later', '--', process.execPath, '-e', '']).status, 1);
    assert.match(f.report('later').error, /Candidate changed before/);
    assert.equal(f.call(['finish']).status, 1);
  } finally { f.close(); }
});

test('unchanged old reports remain intact and are never copied; fresh failures retain their new artifacts', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.cwd, 'reports'), { recursive: true });
    writeFileSync(join(f.cwd, 'reports/canopyproof-workerd-smoke.json'), '{"status":"PASS","old":true}');
    assert.equal(f.call(['init', 'workerd-smoke,workspace']).status, 0);
    assert.equal(f.call(['run', 'workerd-smoke', '--', process.execPath, '-e', '']).status, 0);
    assert.deepEqual(f.report('workerd-smoke').artifacts, []);
    assert.equal(JSON.parse(readFileSync(join(f.cwd, 'reports/canopyproof-workerd-smoke.json'), 'utf8')).old, true);
    assert.throws(() => readFileSync(join(f.out, 'artifacts/reports/canopyproof-workerd-smoke.json')));
    assert.equal(f.call(['run', 'workspace', '--', process.execPath, '-e', 'require("node:fs").writeFileSync("reports/npm-audit-moderate.json", "{\\"status\\":\\"FAIL\\"}");process.exit(1)']).status, 1);
    assert.equal(JSON.parse(readFileSync(join(f.out, 'artifacts/reports/npm-audit-moderate.json'), 'utf8')).status, 'FAIL');
    assert.equal(f.report('workspace').artifacts[0].path, 'reports/npm-audit-moderate.json');
  } finally { f.close(); }
});

test('workerd browser config rejects routes, remote resources, wrong service and enabled authority', () => {
  const original = JSON.parse(readFileSync('apps/web/wrangler.local.jsonc', 'utf8'));
  validateLocalConfig(original);
  for (const change of [
    { routes: ['example.invalid/*'] }, { ai: { binding: 'AI' } },
    { d1_databases: [{ binding: 'DB', remote: true }] },
    { services: [{ binding: 'WORKER_SELF_REFERENCE', service: 'canopyproof-web' }] },
    { vars: { ...original.vars, CANOPY_PRODUCTION_UNLOCK: 'true' } },
    { vars: { ...original.vars, NEXT_PUBLIC_DROPIN_API_URL: 'https://canopyproof.org/api' } },
  ]) assert.throws(() => validateLocalConfig({ ...original, ...change }));
});

test('fixture-only workerd adapter runs Life++ then MapLibre, preserves either failure and cleans up its child', () => {
  for (const [lifeExit, mapExit] of [[7, 0], [0, 8], [0, 0]]) {
  const f = fixture();
  try {
    for (const path of ['apps/web/.open-next/assets', 'node_modules/wrangler/bin', 'node_modules/tsx', 'tests/browser']) mkdirSync(join(f.cwd, path), { recursive: true });
    writeFileSync(join(f.cwd, 'apps/web/wrangler.local.jsonc'), readFileSync('apps/web/wrangler.local.jsonc'));
    writeFileSync(join(f.cwd, 'apps/web/.open-next/worker.js'), '// FIXTURE ONLY; this test does not run workerd.');
    writeFileSync(join(f.cwd, 'node_modules/tsx/package.json'), '{"name":"tsx","type":"module","exports":"./index.js"}');
    writeFileSync(join(f.cwd, 'node_modules/tsx/index.js'), '// Fixture import; browser file uses plain JavaScript.');
    writeFileSync(join(f.cwd, 'node_modules/wrangler/bin/wrangler.js'), `
      const http = require('node:http'); const fs = require('node:fs');
      const args = process.argv.slice(2); const port = args[args.indexOf('--port') + 1];
      if (!args.includes('--local') || args.includes('--remote') || args.includes('deploy')) process.exit(8);
      const server = http.createServer((request, response) => response.end('fixture'));
      server.listen(Number(port), '127.0.0.1', () => console.log('Ready on http://127.0.0.1:' + port));
      process.on('SIGTERM', () => server.close(() => { fs.writeFileSync('../../fixture-child-stopped', 'true'); process.exit(0); }));
    `);
    writeFileSync(join(f.cwd, 'tests/browser/lifepp.spec.ts'), `
      const fs = require('node:fs');
      fs.writeFileSync('fixture-browser-env.json', JSON.stringify({mode:process.env.LIFEPP_BROWSER_SERVER_MODE,base:process.env.LIFEPP_BROWSER_BASE_URL,output:process.env.LIFEPP_BROWSER_OUTPUT_DIR,tokenPresent:!!process.env.CLOUDFLARE_API_TOKEN}));
      fs.appendFileSync('fixture-browser-order.txt', 'lifepp\\n');
      process.exit(${lifeExit});
    `);
    writeFileSync(join(f.cwd, 'tests/browser/maplibre-remediation.spec.ts'), `
      const fs = require('node:fs');
      fs.appendFileSync('fixture-browser-order.txt', 'maplibre\\n');
      fs.writeFileSync('fixture-maplibre-output.txt', process.env.LIFEPP_MAPLIBRE_OUTPUT_DIR);
      process.exit(${mapExit});
    `);
    const result = f.call(['workerd-browser'], { CLOUDFLARE_API_TOKEN: 'fixture-only-not-a-secret' });
    assert.equal(result.status, lifeExit || mapExit, result.stderr);
    const observed = JSON.parse(readFileSync(join(f.cwd, 'fixture-browser-env.json'), 'utf8'));
    assert.equal(observed.mode, 'workerd'); assert.match(observed.base, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(observed.output, join(f.out, 'browser-workerd')); assert.equal(observed.tokenPresent, false);
    assert.equal(readFileSync(join(f.cwd, 'fixture-browser-order.txt'), 'utf8'), 'lifepp\nmaplibre\n');
    assert.equal(readFileSync(join(f.cwd, 'fixture-maplibre-output.txt'), 'utf8'), join(f.out, 'browser-workerd'));
    assert.equal(readFileSync(join(f.cwd, 'fixture-child-stopped'), 'utf8'), 'true');
  } finally { f.close(); }
  }
});

test('read-only workflows check out candidate SHA and always upload fresh failed evidence', () => {
  for (const path of ['canopyproof-ci.yml', 'lifepp-web.yml']) {
    const text = readFileSync(resolve('..', '.github/workflows', path), 'utf8');
    assert.match(text, /ref: \$\{\{ github\.event\.pull_request\.head\.sha(?: \|\| github\.sha)? \}\}/);
    assert.match(text, /persist-credentials: false/);
    assert.match(text, /LIFEPP_EXPECTED_SHA: \$\{\{ github\.event\.pull_request\.head\.sha/);
    assert.match(text, /lifepp-validation-run\.mjs init/);
    assert.match(text, /lifepp-validation-run\.mjs finish/);
    assert.match(text, /if: always\(\)\n\s+uses: actions\/upload-artifact@v4/);
    assert.match(text, /path: dropin-earth\/\$\{\{ env\.LIFEPP_VALIDATION_OUTPUT_DIR \}\}\//);
    assert.doesNotMatch(text, /continue-on-error|secrets\.|pull_request_target|workflow_dispatch:/);
  }
  const trust = readFileSync(resolve('..', '.github/workflows/canopyproof-ci.yml'), 'utf8');
  assert.match(trust, /run lifepp-workerd -- node scripts\/lifepp-validation-run\.mjs workerd-browser/);
  assert.match(trust, /steps\.artifact\.outcome == 'success' && steps\.browsers\.outcome == 'success'/);
});
