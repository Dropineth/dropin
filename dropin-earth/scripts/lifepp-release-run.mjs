#!/usr/bin/env node
/* global fetch, AbortSignal, URL */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { BASELINE_PR_NUMBER, releasePrNumber, validateBaselineReachability, ENVIRONMENT, REPOSITORY, WORKER, TRUST_GATES, WEB_GATES, sha256, validateContext, validatePullRequest, validateAttestation,
  validateWorkflowRun, validateEvidence, validateEnvironmentApproval, validateRollback, validateRoutes, validateSourceConfig } from './lifepp-release-policy.mjs';

const now = () => new Date().toISOString();
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const output = () => resolve(process.env.LIFEPP_RELEASE_DIR ?? 'reports/lifepp-release');
const inputs = () => ({ releasePrNumber: process.env.LIFEPP_RELEASE_PR_NUMBER, expectedSha: process.env.LIFEPP_RELEASE_SHA, rollbackVersion: process.env.LIFEPP_ROLLBACK_VERSION,
  rollbackDeployment: process.env.LIFEPP_ROLLBACK_DEPLOYMENT, attestationUrl: process.env.LIFEPP_ATTESTATION_URL });
const context = () => ({ repository: process.env.GITHUB_REPOSITORY, event: process.env.GITHUB_EVENT_NAME,
  ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA, attempt: process.env.GITHUB_RUN_ATTEMPT,
  actor: process.env.GITHUB_ACTOR, triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR });

export async function readReleaseJson(url, token, label, fetcher = fetch) {
  let response;
  const accept = new URL(url).hostname === 'api.github.com' ? 'application/vnd.github+json' : 'application/json';
  try { response = await fetcher(url, { method: 'GET', headers: { authorization: `Bearer ${token}`, accept }, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error(`${label}: network request failed; no bypass attempted`); }
  assert.equal(response.status, 200, `${label}: unexpected HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/, `${label}: expected JSON`);
  try { return await response.json(); }
  catch { throw new Error(`${label}: invalid JSON response; body withheld`); }
}

async function github(path) {
  assert.ok(process.env.GH_TOKEN, 'GitHub read token missing');
  assert.ok(path.startsWith(`/repos/${REPOSITORY}/`));
  return readReleaseJson(`https://api.github.com${path}`, process.env.GH_TOKEN, 'GitHub read');
}

async function pages(path, key) {
  const items = [];
  for (let page = 1; page <= 20; page++) {
    const value = await github(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const list = key ? value[key] : value;
    assert.ok(Array.isArray(list), 'Unexpected GitHub list response');
    items.push(...list);
    if (list.length < 100) return items;
  }
  throw new Error('GitHub evidence exceeds bounded pagination; review required');
}

async function permission(login) {
  assert.match(login, /^[A-Za-z0-9-]+$/);
  const value = await github(`/repos/${REPOSITORY}/collaborators/${login}/permission`);
  return value.role_name ?? value.permission;
}

const prIdentity = pr => ({ number: pr.number, author: pr.user.login, headSha: pr.head.sha, mergeSha: pr.merge_commit_sha });

// Injectable reads keep orchestration tests local; production uses only authenticated GitHub GETs.
export async function verifyReleasePullRequests(target, { read = github, list = pages, reviewPermission = permission } = {}) {
  const number = releasePrNumber(target.releasePrNumber);
  async function reviewed(number, expectedSha) {
    const pr = await read(`/repos/${REPOSITORY}/pulls/${number}`);
    const approvals = validatePullRequest(pr, await list(`/repos/${REPOSITORY}/pulls/${number}/reviews`), expectedSha ?? pr.merge_commit_sha, number);
    const qualified = [];
    for (const review of approvals) if (['admin', 'maintain', 'write'].includes(await reviewPermission(review.reviewer))) qualified.push(review);
    assert.ok(qualified.length, `Independent approving reviewer of PR #${number} lacks repository review permission`);
    return { pr, reviews: qualified };
  }
  const release = await reviewed(number, target.expectedSha);
  const baseline = number === BASELINE_PR_NUMBER ? release : await reviewed(BASELINE_PR_NUMBER);
  if (number !== BASELINE_PR_NUMBER) assert.notEqual(baseline.pr.merge_commit_sha, target.expectedSha, 'A follow-up release must descend from the baseline merge');
  const comparison = await read(`/repos/${REPOSITORY}/compare/${baseline.pr.merge_commit_sha}...${target.expectedSha}?per_page=1`);
  const reachability = validateBaselineReachability(comparison, baseline.pr.merge_commit_sha, target.expectedSha);
  return { ...release, baseline: { pr: prIdentity(baseline.pr), reviews: baseline.reviews, reachability } };
}

async function verifyGithub() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Release commands only run inside the reviewed GitHub workflow');
  const target = inputs();
  const branch = await github(`/repos/${REPOSITORY}/branches/main`);
  validateContext(context(), target, branch.commit?.sha, git('rev-parse', 'HEAD'));
  const run = await github(`/repos/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  assert.equal(run.head_sha, target.expectedSha);
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.path, '.github/workflows/deploy-canopyproof.yml');
  assert.equal(run.run_attempt, 1);
  const { pr, reviews, baseline } = await verifyReleasePullRequests(target);
  const commentId = target.attestationUrl.split('issuecomment-')[1];
  const comment = await github(`/repos/${REPOSITORY}/issues/comments/${commentId}`);
  const attestation = validateAttestation(comment, await permission(comment.user?.login), target, pr);
  return { target, pr: prIdentity(pr), reviews, baseline, attestation };
}

async function downloadEvidence(artifact, destination) {
  assert.equal(artifact.expired, false, 'CI evidence expired');
  assert.ok(artifact.size_in_bytes > 0 && artifact.size_in_bytes <= 250 * 1024 * 1024, 'CI evidence archive exceeds bounded size');
  assert.match(artifact.digest ?? '', /^sha256:[a-f0-9]{64}$/, 'Missing artifact integrity digest');
  const start = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json' }, redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  assert.equal(start.status, 302, 'Expected authenticated artifact redirect');
  const location = new URL(start.headers.get('location'));
  assert.equal(location.protocol, 'https:');
  assert.ok(!location.username && !location.password && (location.hostname.endsWith('.blob.core.windows.net') || location.hostname.endsWith('.githubusercontent.com')), 'Unexpected artifact host');
  // Never send the GitHub token to the signed artifact storage URL.
  const response = await fetch(location, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 200, 'Artifact download failed');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; assert.ok(size <= 250 * 1024 * 1024, 'Artifact exceeded size limit'); chunks.push(chunk); }
  const archive = Buffer.concat(chunks);
  assert.equal(`sha256:${sha256(archive)}`, artifact.digest, 'CI artifact digest mismatch');
  writeFileSync(destination, archive);
}

function zipEntry(archive, name) {
  assert.match(name, /^[A-Za-z0-9_./-]+$/);
  assert.ok(!name.startsWith('/') && !name.split('/').includes('..'));
  return execFileSync('unzip', ['-p', archive, name], { maxBuffer: 15 * 1024 * 1024 });
}

async function verifyCi(target) {
  const receipts = [];
  for (const [file, expectedJob, prefix, gates] of [
    ['canopyproof-ci.yml', 'Verify trust kernel and OpenNext artifact', 'canopyproof-validation', TRUST_GATES],
    ['lifepp-web.yml', 'web', 'lifepp-validation', WEB_GATES],
  ]) {
    const workflow = await github(`/repos/${REPOSITORY}/actions/workflows/${file}`);
    assert.equal(workflow.path, `.github/workflows/${file}`);
    const runs = await pages(`/repos/${REPOSITORY}/actions/workflows/${workflow.id}/runs?head_sha=${target.expectedSha}`, 'workflow_runs');
    const run = runs.filter(item => item.head_sha === target.expectedSha && item.head_branch === 'main' && ['push', 'workflow_dispatch'].includes(item.event)).sort((a, b) => b.id - a.id)[0];
    assert.ok(run, `Missing same-main-SHA ${file}`);
    const jobs = await pages(`/repos/${REPOSITORY}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
    validateWorkflowRun(run, workflow.id, target.expectedSha, jobs, expectedJob);
    const artifacts = await pages(`/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`, 'artifacts');
    const matches = artifacts.filter(item => item.name === `${prefix}-${target.expectedSha}-${run.id}-${run.run_attempt}`);
    assert.equal(matches.length, 1, 'Missing or ambiguous candidate evidence artifact');
    const archive = join(output(), `${file}.zip`);
    await downloadEvidence(matches[0], archive);
    const report = JSON.parse(zipEntry(archive, 'run.json').toString('utf8'));
    validateEvidence(report, target.expectedSha, run, gates);
    assert.equal(report.lockSha256, sha256(readFileSync('package-lock.json')), 'CI lockfile differs');
    for (const entry of report.commands) {
      assert.equal(sha256(zipEntry(archive, `${entry.id}.log`)), entry.logSha256, 'Command log missing or altered');
      for (const item of entry.artifacts ?? []) assert.equal(sha256(zipEntry(archive, `artifacts/${item.path}`)), item.sha256, 'Command artifact missing or altered');
    }
    if (file === 'canopyproof-ci.yml') {
      for (const id of ['workspace', 'coverage', 'critical-coverage', 'webgl', 'workerd-smoke']) assert.ok(report.commands.find(entry => entry.id === id)?.artifacts?.length > 0, `${id} evidence missing`);
      const audit = JSON.parse(zipEntry(archive, 'artifacts/reports/npm-audit-moderate.json').toString('utf8'));
      assert.equal(audit.error, undefined, 'Audit API errors are not a successful security result');
      assert.ok(audit.metadata?.vulnerabilities, 'Missing raw successful npm audit');
      for (const severity of ['moderate', 'high', 'critical']) assert.equal(audit.metadata.vulnerabilities[severity], 0, `Unresolved ${severity} audit findings`);
    }
    receipts.push({ workflow: file, runId: run.id, attempt: run.run_attempt, sha: run.head_sha, url: run.html_url,
      artifactId: matches[0].id, artifactDigest: matches[0].digest, runReportSha256: sha256(zipEntry(archive, 'run.json')), gates });
    rmSync(archive);
  }
  return receipts;
}

export function inventory(root) {
  const result = [];
  const walk = relative => {
    for (const name of readdirSync(join(root, relative)).sort()) {
      const path = join(relative, name); const stat = lstatSync(join(root, path));
      assert.ok(!stat.isSymbolicLink(), 'Release artifacts cannot contain symlinks');
      if (stat.isDirectory()) walk(path);
      else { assert.ok(stat.isFile(), 'Unexpected release artifact type'); result.push({ path, size: stat.size, sha256: sha256(readFileSync(join(root, path))) }); }
    }
  };
  walk(''); return result;
}

function sourceConfig() {
  const config = readJson('apps/web/wrangler.jsonc');
  validateSourceConfig(config, readJson('apps/web/package.json'));
  const adapter = readFileSync('apps/web/open-next.config.ts', 'utf8');
  assert.match(adapter, /incrementalCache: "dummy"/);
  assert.match(adapter, /tagCache: "dummy"/);
  assert.match(adapter, /queue: "dummy"/);
  assert.doesNotMatch(adapter, /skewProtection|r2IncrementalCache|d1NextModeTagCache/);
  return sha256(readFileSync('apps/web/wrangler.jsonc'));
}

async function prepare() {
  assert.equal(existsSync(output()), false, 'Refuse reused release output'); mkdirSync(output(), { recursive: true });
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN_PROD', 'CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID_PROD', 'DROPIN_OPENNEXT_DEPLOY_COMMAND']) assert.ok(!process.env[key], 'Prepare must not receive cloud credentials or an opaque command');
  const verified = await verifyGithub();
  const ci = await verifyCi(verified.target);
  sourceConfig();
  writeJson(join(output(), 'preflight.json'), { schemaVersion: 1, checkedAt: now(), runId: process.env.GITHUB_RUN_ID, ...verified, ci });
}

function seal() {
  const preflight = readJson(join(output(), 'preflight.json'));
  assert.deepEqual(inputs(), preflight.target, 'Release inputs changed before sealing');
  assert.equal(git('rev-parse', 'HEAD'), preflight.target.expectedSha);
  assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Prepare source changed');
  assert.equal(process.version, 'v22.22.3');
  assert.equal(execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), '10.9.4');
  assert.equal(process.env.NEXT_PUBLIC_CANOPYPROOF_MODE, 'production');
  assert.equal(process.env.NEXT_PUBLIC_DROPIN_SITE_URL, 'https://canopyproof.org');
  const configHash = sourceConfig();
  const files = inventory('apps/web/.open-next');
  for (const path of ['worker.js', 'assets/index.html', 'assets/robots.txt', 'assets/sitemap.xml']) assert.ok(files.some(file => file.path === path), `Missing ${path}`);
  assert.doesNotMatch(readFileSync('apps/web/.open-next/assets/robots.txt', 'utf8'), /^Disallow:\s*\/$/m, 'Production robots blocks indexing');
  assert.match(readFileSync('apps/web/.open-next/assets/sitemap.xml', 'utf8'), /https:\/\/canopyproof\.org\/life/);
  if (existsSync('apps/web/.open-next/assets/_headers')) assert.doesNotMatch(readFileSync('apps/web/.open-next/assets/_headers', 'utf8'), /noindex/i);
  execFileSync('tar', ['-czf', join(output(), 'opennext.tar.gz'), '-C', 'apps/web', '.open-next']);
  const manifest = { schemaVersion: 1, status: 'PREPARED_NOT_APPROVED', preparedAt: now(), ...preflight,
    configSha256: configHash, lockSha256: sha256(readFileSync('package-lock.json')), files,
    archiveSha256: sha256(readFileSync(join(output(), 'opennext.tar.gz'))), deploymentCommand: ['npm', '--workspace', 'apps/web', 'run', 'cf:deploy'],
    scope: 'Existing canopyproof-web only; no API proxy, DNS, resource creation, notifications or business activation.' };
  writeJson(join(output(), 'manifest.json'), manifest);
  const digest = sha256(readFileSync(join(output(), 'manifest.json')));
  assert.ok(process.env.GITHUB_OUTPUT && process.env.GITHUB_STEP_SUMMARY);
  writeFileSync(process.env.GITHUB_OUTPUT, `manifest_sha256=${digest}\n`, { flag: 'a' });
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Prepared web release — approval required\n\nRelease PR: #${preflight.pr.number} (required reviewed baseline: #${preflight.baseline.pr.number}, merge \`${preflight.baseline.pr.mergeSha}\`)\n\nSHA: \`${preflight.target.expectedSha}\`\n\nManifest SHA-256: \`${digest}\`\n\nInspect the manifest/artifact and maintainer attestation before approval. Rollback cloud validation is still pending.\n\nRequired independent environment approval comment:\n\n\`APPROVE ${preflight.target.expectedSha} MANIFEST ${digest} ROLLBACK ${preflight.target.rollbackVersion}\`\n`, { flag: 'a' });
}

export function verifyBundle(root, expectedHash) {
  assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(sha256(readFileSync(join(root, 'manifest.json'))), expectedHash, 'Prepared manifest changed');
  const manifest = readJson(join(root, 'manifest.json'));
  assert.equal(sha256(readFileSync(join(root, 'opennext.tar.gz'))), manifest.archiveSha256, 'Prepared bundle changed');
  return manifest;
}

function restore() {
  const manifest = verifyBundle(output(), process.env.LIFEPP_MANIFEST_SHA256);
  assert.deepEqual(manifest.target, inputs(), 'Prepared artifact names different release inputs');
  assert.equal(manifest.target.expectedSha, git('rev-parse', 'HEAD'));
  assert.equal(manifest.lockSha256, sha256(readFileSync('package-lock.json')));
  assert.equal(manifest.configSha256, sourceConfig());
  assert.equal(existsSync('apps/web/.open-next'), false, 'Do not overwrite a different build');
  execFileSync('tar', ['-xzf', join(output(), 'opennext.tar.gz'), '-C', 'apps/web']);
  assert.deepEqual(inventory('apps/web/.open-next'), manifest.files, 'Restored output differs from the reviewed build');
}

async function cloudflare(suffix, zone = false) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.LIFEPP_PROTECTED_JOB, ENVIRONMENT, 'Cloud reads only inside the protected job');
  const account = process.env.CLOUDFLARE_ACCOUNT_ID; const zoneId = process.env.WORKER_ZONE_ID_PROD;
  assert.match(account ?? '', /^[a-f0-9]{32}$/); assert.ok(process.env.CLOUDFLARE_API_TOKEN, 'Existing cloud credential unavailable');
  if (zone) assert.match(zoneId ?? '', /^[a-f0-9]{32}$/);
  const path = zone ? `/zones/${zoneId}/workers/routes` : `/accounts/${account}/workers/scripts/${WORKER}${suffix}`;
  const value = await readReleaseJson(`https://api.cloudflare.com/client/v4${path}`, process.env.CLOUDFLARE_API_TOKEN, 'Cloudflare existing-resource read');
  assert.equal(value.success, true, 'Cloudflare read failed'); return value.result;
}

async function health() {
  const results = [];
  for (const [url, statuses] of [['https://canopyproof.org/', [200]], ['https://www.canopyproof.org/', [200, 301, 302, 307, 308]], ['https://canopyproof.org/api/ready', [200]], ['https://canopyproof.org/api/admin/launch/readiness', [403]]]) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    await response.body?.cancel(); results.push({ url, status: response.status }); assert.ok(statuses.includes(response.status), 'Public health check failed');
    if (response.status >= 300 && response.status < 400) assert.equal(new URL(response.headers.get('location'), url).href, 'https://canopyproof.org/', 'Unexpected www redirect');
  }
  return results;
}

async function deploy() {
  const manifest = verifyBundle(output(), process.env.LIFEPP_MANIFEST_SHA256);
  const verified = await verifyGithub();
  assert.deepEqual(verified.target, manifest.target);
  assert.deepEqual(verified.pr, manifest.pr, 'Release PR identity changed after prepare');
  assert.deepEqual(verified.baseline.pr, manifest.baseline.pr, 'Required baseline PR identity changed after prepare');
  assert.deepEqual(verified.baseline.reachability, manifest.baseline.reachability, 'Baseline ancestry changed after prepare');
  assert.equal(manifest.runId, process.env.GITHUB_RUN_ID, 'Prepared artifact belongs to another run');
  assert.equal(verified.attestation.bodySha256, manifest.attestation.bodySha256, 'Maintainer declaration changed after prepare');
  assert.equal(verified.attestation.author, manifest.attestation.author);
  await verifyCi(verified.target); // Recheck latest runs and complete evidence after the approval wait.
  const environment = await github(`/repos/${REPOSITORY}/environments/${ENVIRONMENT}`);
  const approvals = await github(`/repos/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/approvals`);
  const approval = validateEnvironmentApproval(environment, approvals, context(), inputs(), process.env.LIFEPP_MANIFEST_SHA256, verified.pr.author, verified.baseline.pr.author);
  assert.equal(sourceConfig(), manifest.configSha256);
  assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Protected checkout changed after install');
  assert.deepEqual(inventory('apps/web/.open-next'), manifest.files, 'Prepared artifact changed');
  const history = await cloudflare('/deployments');
  const version = await cloudflare(`/versions/${verified.target.rollbackVersion}`);
  const rollback = validateRollback(history.deployments, version, verified.target);
  validateRoutes(await cloudflare('', true));
  const smoke = await health();
  const receipt = { schemaVersion: 1, status: 'APPROVED_PREFLIGHT_ONLY', checkedAt: now(), sha: verified.target.expectedSha,
    releasePrNumber: verified.pr.number, baseline: verified.baseline, manifestSha256: process.env.LIFEPP_MANIFEST_SHA256, approval, attestation: verified.attestation, rollback, preReleaseHealth: smoke };
  writeJson(join(output(), 'deployment-receipt.json'), receipt);
  // Re-read mutable main and cloud state immediately before the sole mutation command.
  validateContext(context(), inputs(), (await github(`/repos/${REPOSITORY}/branches/main`)).commit?.sha, git('rev-parse', 'HEAD'));
  validateRollback((await cloudflare('/deployments')).deployments, version, verified.target);
  receipt.deploymentAttemptedAt = now();
  receipt.status = 'DEPLOY_COMMAND_STARTING_STATE_UNCONFIRMED';
  writeJson(join(output(), 'deployment-receipt.json'), receipt);
  const result = spawnSync('npm', ['--workspace', 'apps/web', 'run', 'cf:deploy'], { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  receipt.commandExitCode = result.status; receipt.deploymentCommandFinishedAt = now();
  receipt.status = result.status === 0 ? 'DEPLOY_COMMAND_SUCCEEDED_EXTERNAL_ACCEPTANCE_PENDING' : 'DEPLOY_COMMAND_FAILED_STATE_REQUIRES_OPERATOR_REVIEW';
  writeJson(join(output(), 'deployment-receipt.json'), receipt);
  assert.equal(result.status, 0, 'Web deployment command failed; consult the recorded rollback procedure');
  const active = (await cloudflare('/deployments')).deployments?.[0];
  assert.ok(active?.id && active.id !== rollback.deploymentId, 'No new active deployment observed');
  receipt.activeDeployment = { id: active.id, createdAt: active.created_on, versions: active.versions };
  writeJson(join(output(), 'deployment-receipt.json'), receipt);
  validateRoutes(await cloudflare('', true));
  receipt.postReleaseHealth = await health();
  receipt.status = 'DEPLOYED_BASIC_SMOKE_ONLY_FULL_R3_EXTERNAL_ACCEPTANCE_PENDING';
  writeJson(join(output(), 'deployment-receipt.json'), receipt);
}

async function main() {
  try {
    const command = process.argv[2];
    if (command === 'prepare') await prepare();
    else if (command === 'seal') seal();
    else if (command === 'restore') restore();
    else if (command === 'deploy') await deploy();
    else throw new Error('Expected prepare, seal, restore or deploy');
  } catch (error) {
    // Do not serialize HTTP responses, headers, signed download URLs or credential-bearing process state.
    if (process.argv[2] === 'deploy' && existsSync(output())) {
      const path = join(output(), 'deployment-receipt.json');
      const previous = existsSync(path) ? readJson(path) : {};
      writeJson(path, { ...previous, lastStatus: previous.status ?? null,
        status: previous.deploymentAttemptedAt ? 'RELEASE_INCOMPLETE_OPERATOR_REVIEW_REQUIRED' : 'BLOCKED_BEFORE_DEPLOYMENT',
        failedAt: now(), error: error.message });
    }
    process.stderr.write(`Release blocked: ${error.message}\n`); process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
