import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { releasePrNumber, validateBaselineReachability, ENVIRONMENT, REPOSITORY, TRUST_GATES, WEB_GATES, sha256, validateContext, validatePullRequest, validateAttestation,
  validateWorkflowRun, validateEvidence, validateEnvironmentApproval, validateRollback, validateRoutes, validateSourceConfig } from '../../scripts/lifepp-release-policy.mjs';
import { inventory, verifyBundle, readReleaseJson, verifyReleasePullRequests } from '../../scripts/lifepp-release-run.mjs';

// All identities, approvals, deployment IDs and API responses below are SYNTHETIC unit fixtures.
// These tests perform no network requests and do not create actual release authority.
const target = 'a'.repeat(40);
const head = 'b'.repeat(40);
const version = '11111111-1111-4111-8111-111111111111';
const deployment = '22222222-2222-4222-8222-222222222222';
const manifestHash = 'c'.repeat(64);
const input = { releasePrNumber: '4', expectedSha: target, rollbackVersion: version, rollbackDeployment: deployment, attestationUrl: 'https://github.com/Dropineth/dropin/pull/4#issuecomment-123' };
const ctx = { repository: REPOSITORY, event: 'workflow_dispatch', ref: 'refs/heads/main', sha: target, attempt: '1', actor: 'fixture-operator', triggeringActor: 'fixture-operator' };
const user = (login: string) => ({ login, type: 'User' });
const pr = { number: 4, merged: true, state: 'closed', draft: false, base: { ref: 'main', repo: { full_name: REPOSITORY } },
  head: { sha: head, repo: { full_name: REPOSITORY } }, user: user('fixture-author'), merge_commit_sha: target, merged_at: '2026-09-30T08:00:00Z' };
const review = { id: 1, state: 'APPROVED', user: user('fixture-reviewer'), commit_id: head, submitted_at: '2026-09-30T07:00:00Z', html_url: 'https://github.com/Dropineth/dropin/pull/4#pullrequestreview-1' };
const declaration = { kind: 'lifepp-production-attestation-v1', expected_commit_sha: target, worker: 'canopyproof-web', rollback_version_id: version, rollback_deployment_id: deployment,
  git_integration: { production_branch: 'main', can_publish_without_environment_approval: false, evidence_url: 'https://github.com/Dropineth/dropin/pull/4#issuecomment-100' },
  rollback: { known_good: true, bindings_compatible: true, operator_login: 'fixture-operator', evidence_url: 'https://github.com/Dropineth/dropin/actions/runs/100' },
  visual_review: { reviewed: true, evidence_url: `https://github.com/Dropineth/dropin/blob/${target}/dropin-earth/docs/lifepp/review.md` } };
const comment = { id: 123, user: user('fixture-maintainer'), issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/4`, html_url: input.attestationUrl,
  body: JSON.stringify(declaration), created_at: '2026-09-30T08:10:00Z', updated_at: '2026-09-30T08:10:00Z' };

test('release context rejects push, non-main, rerun, ref/checkout drift and invented target identifiers', () => {
  validateContext(ctx, input, target, target);
  for (const delta of [{ event: 'push' }, { ref: 'refs/heads/codex/candidate' }, { attempt: '2' }, { sha: head }, { repository: 'other/repository' }]) assert.throws(() => validateContext({ ...ctx, ...delta }, input, target, target));
  for (const delta of [{ expectedSha: 'main' }, { expectedSha: target.slice(0, 7) }, { rollbackVersion: 'not-a-version' }, { rollbackDeployment: '' }, { attestationUrl: 'https://example.com/approval' }]) assert.throws(() => validateContext(ctx, { ...input, ...delta }, target, target));
  assert.throws(() => validateContext(ctx, input, head, target));
  assert.throws(() => validateContext(ctx, input, target, head));
});

test('a real final-head PR approval is required; dismissed, stale, self, bot or post-merge approvals cannot substitute', () => {
  assert.equal(validatePullRequest(pr, [review], target, 4)[0].reviewer, review.user.login);
  for (const reviews of [[], [{ ...review, commit_id: target }], [{ ...review, user: pr.user }], [{ ...review, user: { login: 'fixture-bot', type: 'Bot' } }],
    [review, { ...review, id: 2, state: 'DISMISSED' }], [review, { ...review, id: 2, state: 'CHANGES_REQUESTED' }], [{ ...review, submitted_at: '2026-09-30T09:00:00Z' }]]) assert.throws(() => validatePullRequest(pr, reviews, target, 4));
  for (const delta of [{ merged: false }, { draft: true }, { merge_commit_sha: head }]) assert.throws(() => validatePullRequest({ ...pr, ...delta }, [review], target, 4));
  assert.equal(validatePullRequest(pr, [review, { ...review, id: 2, state: 'COMMENTED' }], target, 4).length, 1, 'A later comment does not erase an approval');
});

test('maintainer declaration must be authentic, specific, post-merge and fail closed on unknown independent publishing or rollback', () => {
  assert.equal(validateAttestation(comment, 'maintain', input, pr).bodySha256, sha256(comment.body));
  for (const role of ['write', 'read', 'none']) assert.throws(() => validateAttestation(comment, role, input, pr));
  for (const delta of [{ issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/3` }, { html_url: input.attestationUrl + '0' }, { created_at: '2026-09-30T07:00:00Z' }, { user: { login: 'fixture-bot', type: 'Bot' } }]) assert.throws(() => validateAttestation({ ...comment, ...delta }, 'admin', input, pr));
  for (const value of [{ ...declaration, expected_commit_sha: head }, { ...declaration, rollback_version_id: deployment },
    { ...declaration, git_integration: { ...declaration.git_integration, can_publish_without_environment_approval: true } },
    { ...declaration, rollback: { ...declaration.rollback, known_good: false } },
    { ...declaration, rollback: { ...declaration.rollback, bindings_compatible: false } },
    { ...declaration, visual_review: { ...declaration.visual_review, reviewed: false } },
    { ...declaration, arbitrary_secret: 'fixture-only' }]) assert.throws(() => validateAttestation({ ...comment, body: JSON.stringify(value) }, 'admin', input, pr));
});

const workflowRun = { id: 10, run_attempt: 1, workflow_id: 1, repository: { full_name: REPOSITORY }, head_sha: target, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success' };
const jobs = [{ name: 'web', status: 'completed', conclusion: 'success', steps: [{ name: 'Acceptance', status: 'completed', conclusion: 'success' }] }];
test('workflow status must name the actual workflow, final main SHA and successful complete required steps', () => {
  validateWorkflowRun(workflowRun, 1, target, jobs, 'web');
  for (const delta of [{ workflow_id: 2 }, { head_sha: head }, { head_branch: 'candidate' }, { event: 'pull_request' }, { status: 'in_progress' }, { conclusion: 'failure' }]) assert.throws(() => validateWorkflowRun({ ...workflowRun, ...delta }, 1, target, jobs, 'web'));
  assert.throws(() => validateWorkflowRun(workflowRun, 1, target, [], 'web'));
  assert.throws(() => validateWorkflowRun(workflowRun, 1, target, [{ ...jobs[0], steps: [{ name: 'Acceptance', status: 'completed', conclusion: 'skipped' }] }], 'web'));
  validateWorkflowRun(workflowRun, 1, target, [{ ...jobs[0], steps: [...jobs[0].steps, { name: 'Post Setup Node', status: 'completed', conclusion: 'skipped' }] }], 'web');
});

const snapshot = { head: target, node: 'v22.22.3', npm: '10.9.4', lockSha256: 'd'.repeat(64), sourceFingerprintSha256: 'e'.repeat(64), sourceStatus: '' };
const evidence = (gates: string[]) => ({ schemaVersion: 1, status: 'PASS', ...snapshot, expectedSha: target, runId: '10', runAttempt: '1', checkoutClean: true, finalSnapshot: { ...snapshot }, expectedCommands: gates,
  commands: gates.map(id => ({ id, status: 'PASS', exitCode: 0, commandExitCode: 0, signal: null, startedAt: '2026-09-30T06:00:00Z', finishedAt: '2026-09-30T06:01:00Z', before: { ...snapshot }, after: { ...snapshot } })) });
test('CI artifact receipt independently rejects omitted gates, stale SHA/run, failed command and changed source/lock/runtime', () => {
  for (const gates of [TRUST_GATES, WEB_GATES]) {
    const valid = evidence(gates); validateEvidence(valid, target, workflowRun, gates);
    for (const delta of [{ runId: '9' }, { runAttempt: '2' }, { checkoutClean: false }, { head }, { expectedSha: head }, { status: 'RUNNING' },
      { commands: valid.commands.slice(1) }, { expectedCommands: gates.slice(1) },
      { commands: [{ ...valid.commands[0], commandExitCode: 1 }, ...valid.commands.slice(1)] },
      { finalSnapshot: { ...snapshot, lockSha256: 'changed' } }, { finalSnapshot: { ...snapshot, npm: '11.0.0' } },
      { finalSnapshot: { ...snapshot, sourceFingerprintSha256: 'changed' } },
      { commands: [{ ...valid.commands[0], before: { ...snapshot, head } }, ...valid.commands.slice(1)] }]) assert.throws(() => validateEvidence({ ...valid, ...delta }, target, workflowRun, gates));
  }
  for (const engine of ['chromium', 'firefox', 'webkit']) { assert.ok(WEB_GATES.includes(`browser-next-${engine}`)); assert.ok(WEB_GATES.includes(`floorplan-${engine}`)); }
  for (const required of ['native-postgres', 'coverage', 'critical-coverage', 'workspace', 'webgl', 'lifepp-workerd']) assert.ok(TRUST_GATES.includes(required));
});

const environment = { id: 42, name: ENVIRONMENT, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{ type: 'User', reviewer: user('fixture-reviewer') }] }] };
const approval = { state: 'approved', user: user('fixture-reviewer'), environments: [{ id: 42, name: ENVIRONMENT }], comment: `APPROVE ${target} MANIFEST ${manifestHash} ROLLBACK ${version}` };
test('environment approval must be an actual eligible independent human approval of this SHA, artifact and rollback', () => {
  validateEnvironmentApproval(environment, [approval], ctx, input, manifestHash, pr.user.login);
  for (const approvals of [[], [{ ...approval, state: 'rejected' }], [{ ...approval, comment: 'Ship it' }], [{ ...approval, environments: [{ id: 43, name: ENVIRONMENT }] }],
    [{ ...approval, user: { login: 'fixture-reviewer', type: 'Bot' } }]]) assert.throws(() => validateEnvironmentApproval(environment, approvals, ctx, input, manifestHash, pr.user.login));
  assert.throws(() => validateEnvironmentApproval(environment, [approval], { ...ctx, actor: 'fixture-reviewer' }, input, manifestHash, pr.user.login));
  assert.throws(() => validateEnvironmentApproval(environment, [approval], { ...ctx, triggeringActor: 'fixture-reviewer' }, input, manifestHash, pr.user.login));
  assert.throws(() => validateEnvironmentApproval(environment, [approval], ctx, input, manifestHash, 'fixture-reviewer'));
  assert.throws(() => validateEnvironmentApproval(environment, [approval], ctx, input, manifestHash, 'FIXTURE-REVIEWER'));
  assert.throws(() => validateEnvironmentApproval({ ...environment, protection_rules: [{ ...environment.protection_rules[0], prevent_self_review: false }] }, [approval], ctx, input, manifestHash, pr.user.login));
});

const active = { id: deployment, created_on: '2026-09-29T00:00:00Z', strategy: 'percentage', versions: [{ version_id: version, percentage: 100 }] };
const cloudVersion = { id: version, resources: { script: { etag: 'fixture-script-content-hash' } } };
test('rollback must really be the currently deployed 100-percent version, not merely an uploaded version', () => {
  assert.equal(validateRollback([active], cloudVersion, input).deploymentId, deployment);
  for (const history of [[], [{ ...active, id: version }], [{ ...active, versions: [{ version_id: version, percentage: 50 }] }], [{ ...active, versions: [{ version_id: deployment, percentage: 100 }] }]]) assert.throws(() => validateRollback(history, cloudVersion, input));
  assert.throws(() => validateRollback([active], { ...cloudVersion, id: deployment }, input));
  assert.throws(() => validateRollback([active], { id: version, resources: {} }, input));
});

test('existing web/API route ownership and resource configuration cannot silently change', () => {
  const routes = [{ pattern: 'canopyproof.org/*', script: 'canopyproof-web' }, { pattern: 'www.canopyproof.org/*', script: 'canopyproof-web' }, { pattern: 'canopyproof.org/api/*', script: 'canopyproof-api-proxy' }];
  validateRoutes(routes);
  assert.throws(() => validateRoutes(routes.slice(0, 2)));
  assert.throws(() => validateRoutes([...routes.slice(0, 2), { ...routes[2], script: 'canopyproof-web' }]));
  const config = JSON.parse(readFileSync('apps/web/wrangler.jsonc', 'utf8'));
  const pkg = JSON.parse(readFileSync('apps/web/package.json', 'utf8'));
  validateSourceConfig(config, pkg);
  for (const delta of [{ name: 'new-worker' }, { d1_databases: [] }, { routes: [{ pattern: 'other.example/*' }] }, { vars: { ...config.vars, DROPIN_ALLOW_ADMIN_PROXY: 'true' } }]) assert.throws(() => validateSourceConfig({ ...config, ...delta }, pkg));
  assert.throws(() => validateSourceConfig(config, { ...pkg, scripts: { ...pkg.scripts, 'precf:deploy': 'unreviewed-command' } }));
});

test('prepared release manifest and archive hashes reject tampering, and artifact inventory rejects symlinks', () => {
  const root = mkdtempSync(join(tmpdir(), 'lifepp-release-fixture-'));
  try {
    writeFileSync(join(root, 'opennext.tar.gz'), 'SYNTHETIC ARCHIVE');
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ archiveSha256: sha256('SYNTHETIC ARCHIVE') }));
    const hash = sha256(readFileSync(join(root, 'manifest.json')));
    verifyBundle(root, hash);
    assert.throws(() => verifyBundle(root, 'f'.repeat(64)));
    writeFileSync(join(root, 'opennext.tar.gz'), 'ALTERED');
    assert.throws(() => verifyBundle(root, hash));
    mkdirSync(join(root, 'tree')); writeFileSync(join(root, 'tree', 'worker.js'), 'FIXTURE');
    assert.deepEqual(inventory(join(root, 'tree')), [{ path: 'worker.js', size: 7, sha256: sha256('FIXTURE') }]);
    symlinkSync('../manifest.json', join(root, 'tree', 'unsafe-link'));
    assert.throws(() => inventory(join(root, 'tree')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release API reads fail closed on 403 HTML, redirects, malformed responses and network errors without logging bodies or credentials', async () => {
  let reads = 0;
  const valid = await readReleaseJson('https://fixture.invalid/read', 'FIXTURE_TOKEN', 'Fixture read', async (_url: string, options: RequestInit) => {
    reads++; assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    return new Response('{"success":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(reads, 1); assert.deepEqual(valid, { success: true });
  for (const [url, expected] of [['https://api.github.com/fixture', 'application/vnd.github+json'], ['https://api.cloudflare.com/fixture', 'application/json']]) {
    await readReleaseJson(url, 'FIXTURE_TOKEN', 'Fixture read', async (_url: string, options: RequestInit) => {
      assert.equal(new Headers(options.headers).get('accept'), expected);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    });
  }
  for (const response of [new Response('PRIVATE_RESPONSE_BODY', { status: 403, headers: { 'content-type': 'text/html' } }),
    new Response('', { status: 302, headers: { location: 'https://other.invalid' } }),
    new Response('PRIVATE_RESPONSE_BODY', { status: 200, headers: { 'content-type': 'text/html' } }),
    new Response('PRIVATE_RESPONSE_BODY', { status: 200, headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(() => readReleaseJson('https://fixture.invalid/read', 'FIXTURE_TOKEN', 'Fixture read', async () => response), error => {
      assert.ok(error instanceof Error); assert.doesNotMatch(error.message, /PRIVATE_RESPONSE_BODY|FIXTURE_TOKEN|other\.invalid/); return true;
    });
  }
  await assert.rejects(() => readReleaseJson('https://fixture.invalid/read', 'FIXTURE_TOKEN', 'Fixture read', async () => { throw new Error('PRIVATE_RESPONSE_BODY'); }), /network request failed; no bypass attempted/);
});

test('release PR input is explicit and canonical, and cannot borrow another PR attestation URL', () => {
  assert.equal(releasePrNumber('9'), 9);
  for (const value of [undefined, null, '', '04', '0', '-1', '4x', '1e2', ' 4', '4/../5', '9007199254740992', [4], {}]) {
    assert.throws(() => releasePrNumber(value));
  }
  assert.throws(() => validateContext(ctx, { ...input, releasePrNumber: undefined }, target, target));
  assert.throws(() => validateContext(ctx, { ...input, releasePrNumber: '9' }, target, target));
  validateContext(ctx, { ...input, releasePrNumber: '9', attestationUrl: input.attestationUrl.replace('/4#', '/9#') }, target, target);
});

const baselineMerge = 'd'.repeat(40);
const comparison = (base = baselineMerge, release = target) => ({
  url: `https://api.github.com/repos/${REPOSITORY}/compare/${base}...${release}`,
  base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: 0,
  ahead_by: base === release ? 0 : 3, status: base === release ? 'identical' : 'ahead',
  // GitHub may truncate/paginate this list: reachability must not depend on it.
  commits: [],
});

test('baseline reachability requires the exact GitHub comparison and a nondivergent descendant, including PR4 identity', () => {
  assert.equal(validateBaselineReachability(comparison(), baselineMerge, target).status, 'ahead');
  assert.equal(validateBaselineReachability(comparison(target, target), target, target).status, 'identical');
  for (const delta of [{ url: comparison(target, baselineMerge).url }, { base_commit: { sha: head } },
    { merge_base_commit: { sha: head } }, { merge_base_commit: undefined }, { behind_by: 1 }, { behind_by: undefined },
    { status: 'behind' }, { status: 'diverged' }, { status: 'identical' }, { ahead_by: 0 }, { ahead_by: undefined }, { ahead_by: '3' }]) {
    assert.throws(() => validateBaselineReachability({ ...comparison(), ...delta }, baselineMerge, target));
  }
  assert.throws(() => validateBaselineReachability({ ...comparison(target, target), ahead_by: 1 }, target, target));
});

const releasePr = { ...pr, number: 9, head: { ...pr.head, sha: 'e'.repeat(40) }, user: user('fixture-followup-author') };
const releaseReview = { ...review, id: 9, user: user('fixture-followup-reviewer'), commit_id: releasePr.head.sha, html_url: 'https://github.com/Dropineth/dropin/pull/9#pullrequestreview-9' };
const baselinePr = { ...pr, merge_commit_sha: baselineMerge };
const followupInput = { ...input, releasePrNumber: '9', attestationUrl: input.attestationUrl.replace('/4#', '/9#') };

function releaseReads(options: { release?: typeof releasePr; baseline?: typeof baselinePr; releaseReviews?: typeof review[]; baselineReviews?: typeof review[];
  compare?: ReturnType<typeof comparison>; permission?: (login: string) => Promise<string> } = {}) {
  const requests: string[] = [];
  return { requests, reads: {
    read: async (path: string) => {
      requests.push(path);
      if (path === `/repos/${REPOSITORY}/pulls/9`) return options.release ?? releasePr;
      if (path === `/repos/${REPOSITORY}/pulls/4`) return options.baseline ?? baselinePr;
      assert.equal(path, `/repos/${REPOSITORY}/compare/${(options.baseline ?? baselinePr).merge_commit_sha}...${target}?per_page=1`);
      return options.compare ?? comparison();
    },
    list: async (path: string) => {
      requests.push(path);
      if (path === `/repos/${REPOSITORY}/pulls/9/reviews`) return options.releaseReviews ?? [releaseReview];
      assert.equal(path, `/repos/${REPOSITORY}/pulls/4/reviews`);
      return options.baselineReviews ?? [review];
    },
    reviewPermission: options.permission ?? (async () => 'write'),
  } };
}

test('follow-up release orchestration independently reads and approves both release PR and PR4 baseline before checking ancestry', async () => {
  const fixture = releaseReads();
  const value = await verifyReleasePullRequests(followupInput, fixture.reads);
  assert.equal(value.pr.number, 9);
  assert.equal(value.pr.merge_commit_sha, target);
  assert.equal(value.baseline.pr.number, 4);
  assert.equal(value.baseline.pr.mergeSha, baselineMerge);
  assert.equal(value.baseline.reachability.releaseSha, target);
  assert.deepEqual(fixture.requests, [
    `/repos/${REPOSITORY}/pulls/9`, `/repos/${REPOSITORY}/pulls/9/reviews`,
    `/repos/${REPOSITORY}/pulls/4`, `/repos/${REPOSITORY}/pulls/4/reviews`,
    `/repos/${REPOSITORY}/compare/${baselineMerge}...${target}?per_page=1`,
  ]);
  for (const options of [
    { release: { ...releasePr, number: 4 } }, { release: { ...releasePr, merge_commit_sha: baselineMerge } },
    { release: { ...releasePr, merged: false } }, { baseline: { ...baselinePr, merged: false } },
    { baseline: { ...baselinePr, merge_commit_sha: target } }, { releaseReviews: [] }, { baselineReviews: [] },
    { compare: { ...comparison(), status: 'diverged', behind_by: 2 } },
    { permission: async (login: string) => login === review.user.login ? 'read' : 'write' },
    { permission: async (login: string) => login === releaseReview.user.login ? 'read' : 'write' },
  ]) await assert.rejects(() => verifyReleasePullRequests(followupInput, releaseReads(options).reads));
  for (const reviews of [[{ ...releaseReview, commit_id: head }], [{ ...releaseReview, user: releasePr.user }],
    [{ ...releaseReview, user: { login: 'fixture-bot', type: 'Bot' } }],
    [releaseReview, { ...releaseReview, id: 10, state: 'DISMISSED' }], [releaseReview, { ...releaseReview, id: 10, state: 'CHANGES_REQUESTED' }],
    [{ ...releaseReview, submitted_at: '2026-09-30T09:00:00Z' }]]) {
    await assert.rejects(() => verifyReleasePullRequests(followupInput, releaseReads({ releaseReviews: reviews }).reads));
  }
});

test('explicit PR4 release remains supported and still obtains identical-SHA GitHub reachability evidence', async () => {
  const paths: string[] = [];
  const value = await verifyReleasePullRequests(input, {
    read: async (path: string) => { paths.push(path); return path.endsWith('/pulls/4') ? pr : comparison(target, target); },
    list: async (path: string) => { assert.equal(path, `/repos/${REPOSITORY}/pulls/4/reviews`); return [review]; },
    reviewPermission: async () => 'maintain',
  });
  assert.equal(value.pr.number, 4);
  assert.equal(value.baseline.pr.mergeSha, target);
  assert.equal(value.baseline.reachability.status, 'identical');
  assert.deepEqual(paths, [`/repos/${REPOSITORY}/pulls/4`, `/repos/${REPOSITORY}/compare/${target}...${target}?per_page=1`]);
});

test('v2 declaration binds the actual release PR; legacy PR4 statements cannot authorize a follow-up release', () => {
  const v2 = { ...declaration, kind: 'lifepp-production-attestation-v2', release_pr_number: 9,
    visual_review: { ...declaration.visual_review, evidence_url: 'https://github.com/Dropineth/dropin/pull/9#issuecomment-99' } };
  const actual = { ...comment, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/9`, html_url: followupInput.attestationUrl, body: JSON.stringify(v2) };
  validateAttestation(actual, 'maintain', followupInput, releasePr);
  validateAttestation(comment, 'maintain', input, pr);
  validateAttestation({ ...comment, body: JSON.stringify({ ...v2, release_pr_number: 4, visual_review: declaration.visual_review }) }, 'admin', input, pr);
  for (const value of [declaration, { ...v2, release_pr_number: 4 }, { ...v2, release_pr_number: '9' },
    { ...v2, release_pr_number: undefined }, { ...v2, expected_commit_sha: baselineMerge },
    { ...v2, visual_review: { ...v2.visual_review, evidence_url: 'https://github.com/Dropineth/dropin/pull/99#issuecomment-99' } }]) {
    assert.throws(() => validateAttestation({ ...actual, body: JSON.stringify(value) }, 'admin', followupInput, releasePr));
  }
  assert.throws(() => validateAttestation(comment, 'admin', followupInput, releasePr));
  assert.throws(() => validateAttestation(actual, 'admin', followupInput, pr));
  assert.throws(() => validateAttestation({ ...actual, created_at: '2026-09-30T07:00:00Z' }, 'admin', followupInput, releasePr));
});

test('environment approval remains independent of both the actual release author and the reviewed baseline author', () => {
  validateEnvironmentApproval(environment, [approval], ctx, followupInput, manifestHash, releasePr.user.login, baselinePr.user.login);
  assert.throws(() => validateEnvironmentApproval(environment, [approval], ctx, followupInput, manifestHash, releasePr.user.login, 'fixture-reviewer'));
  assert.throws(() => validateEnvironmentApproval(environment, [approval], ctx, followupInput, manifestHash, 'FIXTURE-REVIEWER', baselinePr.user.login));
});


test('seal and restore reject changed release PR input before Git, extraction or credential operations', () => {
  const root = mkdtempSync(join(tmpdir(), 'lifepp-pr-binding-fixture-'));
  try {
    const script = resolve('scripts/lifepp-release-run.mjs');
    writeFileSync(join(root, 'preflight.json'), JSON.stringify({ target: input }));
    writeFileSync(join(root, 'opennext.tar.gz'), 'SYNTHETIC NOT A TAR');
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ target: input, archiveSha256: sha256('SYNTHETIC NOT A TAR') }));
    const hash = sha256(readFileSync(join(root, 'manifest.json')));
    for (const mode of ['seal', 'restore']) {
      const result = spawnSync(process.execPath, [script, mode], { cwd: root, encoding: 'utf8', env: {
        PATH: process.env.PATH, LIFEPP_RELEASE_DIR: root, LIFEPP_MANIFEST_SHA256: hash,
        LIFEPP_RELEASE_PR_NUMBER: '9', LIFEPP_RELEASE_SHA: target, LIFEPP_ROLLBACK_VERSION: version,
        LIFEPP_ROLLBACK_DEPLOYMENT: deployment, LIFEPP_ATTESTATION_URL: input.attestationUrl,
      } });
      assert.equal(result.status, 1);
      assert.match(result.stderr, mode === 'seal' ? /Release inputs changed before sealing/ : /Prepared artifact names different release inputs/);
      assert.doesNotMatch(result.stderr, /not a git repository|tar:|credential/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
