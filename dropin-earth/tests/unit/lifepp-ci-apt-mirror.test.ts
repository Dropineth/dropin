import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { preferUbuntuArchive, prepareHostedMirror } from '../../scripts/lifepp-ci-apt-mirror.mjs';

const mirrors = 'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n';
const preferred = 'http://azure.archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n';
const os = 'ID=ubuntu\nVERSION_ID="24.04"\n';
const sources = 'Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble noble-updates noble-backports noble-security\nComponents: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n';

test('prefers the existing official HTTPS archive, preserves all endpoints and is idempotent', () => {
  assert.equal(preferUbuntuArchive(mirrors, sources, os), preferred);
  assert.equal(preferUbuntuArchive(preferred, sources, os), preferred);
});

test('refuses unknown OS, source routing, duplicate mirrors, priorities and extra endpoints', () => {
  for (const [list, source, release] of [
    [mirrors, sources, 'ID=debian\nVERSION_ID="13"\n'],
    [mirrors, sources, os.replace('24.04', '26.04')],
    [mirrors, sources.replace('mirror+file:/etc/apt/apt-mirrors.txt', 'https://example.invalid/'), os],
    [mirrors.replace('https://archive.ubuntu.com/ubuntu/', 'http://azure.archive.ubuntu.com/ubuntu/'), sources, os],
    [mirrors.replace('priority:2', 'priority:0'), sources, os],
    [mirrors + 'https://example.invalid/\tpriority:1\n', sources, os],
  ]) assert.throws(() => preferUbuntuArchive(list, source, release));
});

test('only writes the hosted mirror list, verifies read-back and does not run any installer', () => {
  let current = mirrors;
  const calls: unknown[] = [];
  const read = (path: string) => path.endsWith('apt-mirrors.txt') ? current : path.endsWith('ubuntu.sources') ? sources : os;
  const run = (command: string, args: string[], options: { input: string }) => {
    calls.push([command, args]); current = options.input; return { status: 0 };
  };
  const input = { env: { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' }, read, run, log: () => {} };
  prepareHostedMirror(input);
  prepareHostedMirror(input);
  assert.equal(current, preferred);
  assert.deepEqual(calls, [['sudo', ['-n', 'tee', '/etc/apt/apt-mirrors.txt']]]);
});

test('fails closed on non-hosted runners, failed writes or mismatching read-back', () => {
  const base = {
    env: { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' },
    read: (path: string) => path.endsWith('apt-mirrors.txt') ? mirrors : path.endsWith('ubuntu.sources') ? sources : os,
    run: () => ({ status: 0 }), log: () => {},
  };
  assert.throws(() => prepareHostedMirror({ ...base, env: {}, read: () => assert.fail('must not read local APT') }));
  assert.throws(() => prepareHostedMirror({ ...base, env: { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted' } }));
  assert.throws(() => prepareHostedMirror({ ...base, run: () => ({ status: 1 }) }), /Could not set/);
  assert.throws(() => prepareHostedMirror({ ...base, run: () => ({ error: new Error('spawn failed') }) }), /Could not set/);
  assert.throws(() => prepareHostedMirror(base), /read-back mismatch/);
});

test('both acceptance workflows keep the complete installer within the existing evidence gate and timeout', () => {
  for (const workflow of ['lifepp-web.yml', 'canopyproof-ci.yml']) {
    const yaml = readFileSync(resolve('..', '.github/workflows', workflow), 'utf8');
    assert.match(yaml, /runs-on: ubuntu-24\.04/);
    assert.match(yaml, /timeout-minutes: 60/);
    assert.match(yaml, /run browsers -- bash -eo pipefail -c '\n\s+node scripts\/lifepp-ci-apt-mirror\.mjs\n\s+npx playwright install --with-deps chromium firefox webkit\n\s+'/);
  }
});
