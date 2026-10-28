import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const mirrorPath = '/etc/apt/apt-mirrors.txt';
const sourcePath = '/etc/apt/sources.list.d/ubuntu.sources';
const azure = 'http://azure.archive.ubuntu.com/ubuntu/';
const archive = 'https://archive.ubuntu.com/ubuntu/';
const security = 'https://security.ubuntu.com/ubuntu/';

// The hosted image already provides these three Ubuntu mirrors with signature
// verification. Change only their priority, never suites, keys or APT trust.
// https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/configure-apt-sources.sh
export function preferUbuntuArchive(mirrors, sources, osRelease) {
  if (!/^ID=ubuntu$/m.test(osRelease) || !/^VERSION_ID="24\.04"$/m.test(osRelease)) {
    throw new Error('Expected the pinned Ubuntu 24.04 hosted runner');
  }
  if (!/^URIs:\s+mirror\+file:\/etc\/apt\/apt-mirrors\.txt\s*$/m.test(sources)) {
    throw new Error('Ubuntu sources do not use the expected hosted mirror list');
  }
  const lines = mirrors.trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/));
  if (lines.length !== 3 || lines.some((line) => line.length !== 2)) {
    throw new Error('Unexpected hosted Ubuntu mirror list');
  }
  const expected = new Map([[azure, 'priority:1'], [archive, 'priority:2'], [security, 'priority:3']]);
  const alreadyPreferred = new Map([[azure, 'priority:2'], [archive, 'priority:1'], [security, 'priority:3']]);
  const matches = (entries) => new Set(lines.map(([url]) => url)).size === 3
    && lines.every(([url, priority]) => entries.get(url) === priority);
  if (matches(alreadyPreferred)) return mirrors;
  if (!matches(expected)) throw new Error('Unexpected hosted Ubuntu mirror priorities');
  return mirrors.replace(/priority:1\b/, 'priority:TEMP').replace(/priority:2\b/, 'priority:1').replace('priority:TEMP', 'priority:2');
}

export function prepareHostedMirror({ env, read, run, log }) {
  if (env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted') {
    throw new Error('Mirror preparation is restricted to disposable GitHub-hosted runners');
  }
  const before = read(mirrorPath, 'utf8');
  const sources = read(sourcePath, 'utf8');
  const after = preferUbuntuArchive(before, sources, read('/etc/os-release', 'utf8'));
  if (after !== before) {
    const result = run('sudo', ['-n', 'tee', mirrorPath], { input: after, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error('Could not set the temporary runner mirror priority');
  }
  if (read(mirrorPath, 'utf8') !== after || read(sourcePath, 'utf8') !== sources) {
    throw new Error('Ubuntu mirror/source read-back mismatch');
  }
  log('CI Ubuntu mirror priority: archive HTTPS first, Azure second, security HTTPS third; sources and signing keys unchanged.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    prepareHostedMirror({ env: process.env, read: readFileSync, run: spawnSync, log: console.log });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
