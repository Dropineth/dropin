import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REPOSITORY = 'Dropineth/dropin';
export const ENVIRONMENT = 'canopyproof-production';
export const WORKER = 'canopyproof-web';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const TRUST_GATES = ['pin-npm', 'install', 'supply-chain', 'workspace', 'native-postgres', 'coverage', 'critical-coverage', 'browsers', 'webgl', 'opennext', 'artifact', 'workerd-smoke', 'lifepp-workerd'];
export const WEB_GATES = ['pin-npm', 'install', 'typecheck', 'lint', 'unit', 'build', 'browsers', 'viewer-fixture', 'consultation-fixture', ...['chromium', 'firefox', 'webkit'].flatMap(engine => [`floorplan-${engine}`, `browser-next-${engine}`])];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{40}$/;
const human = user => user?.type === 'User' && /^[A-Za-z0-9-]+$/.test(user.login ?? '');
const loginKey = login => String(login ?? '').toLowerCase();
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function validateContext(context, inputs, mainSha, checkoutSha) {
  assert.equal(context.repository, REPOSITORY, 'Unexpected repository');
  assert.equal(context.event, 'workflow_dispatch', 'Only explicit workflow dispatch may release');
  assert.equal(context.ref, 'refs/heads/main', 'Release must run from main');
  assert.equal(String(context.attempt), '1', 'Use a fresh dispatch; reruns cannot inherit approval');
  assert.match(inputs.expectedSha ?? '', sha, 'Require a full lowercase commit SHA');
  assert.equal(context.sha, inputs.expectedSha, 'Workflow SHA mismatch');
  assert.equal(mainSha, inputs.expectedSha, 'Main tip changed');
  assert.equal(checkoutSha, inputs.expectedSha, 'Checkout SHA mismatch');
  assert.match(inputs.rollbackVersion ?? '', uuid, 'Require a real rollback version UUID');
  assert.match(inputs.rollbackDeployment ?? '', uuid, 'Require a real rollback deployment UUID');
  assert.match(inputs.attestationUrl ?? '', /^https:\/\/github\.com\/Dropineth\/dropin\/pull\/4#issuecomment-[1-9][0-9]*$/, 'Require a maintainer attestation comment on PR #4');
}

export function validatePullRequest(pr, reviews, expectedSha) {
  assert.equal(pr.number, 4);
  assert.equal(pr.merged, true, 'PR #4 must actually be merged');
  assert.equal(pr.state, 'closed');
  assert.equal(pr.draft, false);
  assert.equal(pr.base?.ref, 'main');
  assert.equal(pr.base?.repo?.full_name, REPOSITORY);
  assert.equal(pr.head?.repo?.full_name, REPOSITORY);
  assert.equal(pr.merge_commit_sha, expectedSha, 'Release target must be the actual PR #4 merge result');
  assert.match(pr.head?.sha ?? '', sha);
  const latest = new Map();
  for (const review of [...reviews].sort((a, b) => a.id - b.id)) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) latest.set(loginKey(review.user?.login), review);
  }
  assert.ok(![...latest.values()].some(review => review.state === 'CHANGES_REQUESTED'), 'Unresolved change request');
  const approved = [...latest.values()].filter(review => review.state === 'APPROVED'
    && review.commit_id === pr.head.sha && human(review.user) && loginKey(review.user.login) !== loginKey(pr.user?.login)
    && timestamp(review.submitted_at) && Date.parse(review.submitted_at) <= Date.parse(pr.merged_at));
  assert.ok(approved.length, 'Require an actual independent approval of the final PR head before merge');
  return approved.map(review => ({ id: review.id, reviewer: review.user.login, reviewedSha: review.commit_id, submittedAt: review.submitted_at, url: review.html_url }));
}

export function validateAttestation(comment, permission, inputs, pr) {
  assert.equal(comment.issue_url, `https://api.github.com/repos/${REPOSITORY}/issues/4`);
  assert.equal(comment.html_url, inputs.attestationUrl);
  assert.ok(human(comment.user), 'Attestation must be authored by a real human account');
  assert.ok(['admin', 'maintain'].includes(permission), 'Attestation requires an actual repository maintainer');
  assert.ok(timestamp(comment.created_at) && Date.parse(comment.created_at) >= Date.parse(pr.merged_at), 'Attestation must review the final main merge result');
  const value = JSON.parse(comment.body);
  assert.deepEqual(Object.keys(value).sort(), ['kind', 'expected_commit_sha', 'worker', 'rollback_version_id', 'rollback_deployment_id', 'git_integration', 'rollback', 'visual_review'].sort(), 'Unexpected attestation fields');
  assert.deepEqual(Object.keys(value.git_integration ?? {}).sort(), ['production_branch', 'can_publish_without_environment_approval', 'evidence_url'].sort());
  assert.deepEqual(Object.keys(value.rollback ?? {}).sort(), ['known_good', 'bindings_compatible', 'operator_login', 'evidence_url'].sort());
  assert.deepEqual(Object.keys(value.visual_review ?? {}).sort(), ['reviewed', 'evidence_url'].sort());
  assert.equal(value.kind, 'lifepp-production-attestation-v1');
  assert.equal(value.expected_commit_sha, inputs.expectedSha);
  assert.equal(value.worker, WORKER);
  assert.equal(value.rollback_version_id, inputs.rollbackVersion);
  assert.equal(value.rollback_deployment_id, inputs.rollbackDeployment);
  assert.equal(value.git_integration?.production_branch, 'main');
  assert.equal(value.git_integration?.can_publish_without_environment_approval, false, 'Unconfirmed independent Git publishing path');
  assert.equal(value.rollback?.known_good, true);
  assert.equal(value.rollback?.bindings_compatible, true);
  assert.match(value.rollback?.operator_login ?? '', /^[A-Za-z0-9-]+$/);
  assert.equal(value.visual_review?.reviewed, true);
  for (const evidence of [value.git_integration?.evidence_url, value.rollback?.evidence_url, value.visual_review?.evidence_url]) {
    assert.match(evidence ?? '', /^https:\/\/github\.com\/Dropineth\/dropin\/(?:pull\/4(?:#|\/)|actions\/runs\/[1-9][0-9]*(?:\/|$)|blob\/[a-f0-9]{40}\/)/, 'Require reviewable same-repository evidence links');
  }
  return { commentId: comment.id, author: comment.user.login, url: comment.html_url, updatedAt: comment.updated_at,
    bodySha256: sha256(comment.body), declaration: value };
}

export function validateWorkflowRun(run, workflowId, expectedSha, jobs, expectedJob) {
  assert.equal(run.workflow_id, workflowId, 'Wrong workflow identity');
  assert.equal(run.repository?.full_name, REPOSITORY);
  assert.equal(run.head_sha, expectedSha, 'CI SHA mismatch');
  assert.equal(run.head_branch, 'main');
  assert.ok(['push', 'workflow_dispatch'].includes(run.event), 'Require CI on the actual main SHA');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success', 'Required workflow did not succeed');
  assert.equal(jobs.length, 1, 'Unexpected workflow job matrix; review the release policy');
  assert.equal(jobs[0].name, expectedJob);
  assert.equal(jobs[0].status, 'completed');
  assert.equal(jobs[0].conclusion, 'success');
  assert.ok(jobs[0].steps?.length > 0, 'Missing step evidence');
  assert.ok(jobs[0].steps.every(step => step.status === 'completed' && (step.conclusion === 'success'
    || (step.conclusion === 'skipped' && step.name.startsWith('Post ')))), 'A required workflow step was omitted, skipped or failed');
}

export function validateEvidence(report, expectedSha, run, expectedGates) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status, 'PASS');
  assert.equal(report.head, expectedSha);
  assert.equal(report.expectedSha, expectedSha);
  assert.equal(String(report.runId), String(run.id));
  assert.equal(String(report.runAttempt), String(run.run_attempt));
  assert.equal(report.checkoutClean, true);
  assert.equal(report.sourceStatus, '');
  assert.equal(report.finalSnapshot?.head, expectedSha);
  assert.equal(report.finalSnapshot?.sourceStatus, '');
  assert.equal(report.finalSnapshot?.sourceFingerprintSha256, report.sourceFingerprintSha256);
  assert.equal(report.finalSnapshot?.lockSha256, report.lockSha256);
  assert.equal(report.finalSnapshot?.node, 'v22.22.3');
  assert.equal(report.finalSnapshot?.npm, '10.9.4');
  assert.deepEqual([...report.expectedCommands].sort(), [...expectedGates].sort(), 'Required gate list changed or incomplete');
  assert.equal(report.commands?.length, expectedGates.length);
  assert.equal(new Set(report.commands.map(entry => entry.id)).size, expectedGates.length);
  for (const id of expectedGates) {
    const entry = report.commands.find(item => item.id === id);
    assert.ok(entry, `Missing ${id}`);
    assert.equal(entry.status, 'PASS', `${id} not PASS`);
    assert.equal(entry.exitCode, 0);
    assert.equal(entry.commandExitCode, 0);
    assert.equal(entry.signal, null);
    assert.ok(timestamp(entry.startedAt) && timestamp(entry.finishedAt));
    for (const snapshot of [entry.before, entry.after]) {
      assert.equal(snapshot?.head, expectedSha);
      assert.equal(snapshot?.sourceFingerprintSha256, report.sourceFingerprintSha256);
      assert.equal(snapshot?.lockSha256, report.lockSha256);
    }
  }
}

export function validateEnvironmentApproval(environment, approvals, context, inputs, manifestHash, prAuthor) {
  assert.equal(environment.name, ENVIRONMENT);
  const rule = environment.protection_rules?.find(item => item.type === 'required_reviewers');
  assert.equal(rule?.prevent_self_review, true, 'Self-review protection must remain enabled');
  const eligible = new Set(rule.reviewers.filter(item => item.type === 'User').map(item => loginKey(item.reviewer.login)));
  const forbidden = new Set([context.actor, context.triggeringActor, prAuthor].map(loginKey));
  const phrase = `APPROVE ${inputs.expectedSha} MANIFEST ${manifestHash} ROLLBACK ${inputs.rollbackVersion}`;
  const review = approvals.find(item => item.state === 'approved' && human(item.user)
    && eligible.has(loginKey(item.user.login)) && !forbidden.has(loginKey(item.user.login))
    && item.environments?.some(env => env.id === environment.id && env.name === ENVIRONMENT)
    && item.comment?.trim() === phrase);
  assert.ok(review, 'Missing actual independent environment approval bound to this SHA, manifest and rollback version');
  return { reviewer: review.user.login, comment: review.comment, environment: ENVIRONMENT, environmentId: environment.id };
}

export function validateRollback(deployments, version, inputs) {
  assert.ok(Array.isArray(deployments) && deployments.length > 0, 'Missing deployment history');
  const active = deployments[0]; // Cloudflare documents the first item as actively serving traffic.
  assert.equal(active.id, inputs.rollbackDeployment, 'Active deployment drifted from the approved rollback target');
  assert.equal(active.strategy, 'percentage');
  assert.deepEqual(active.versions, [{ version_id: inputs.rollbackVersion, percentage: 100 }], 'Require one known-good version serving 100%');
  assert.ok(timestamp(active.created_on), 'Missing deployment timestamp');
  assert.equal(version.id, inputs.rollbackVersion, 'Rollback version does not exist');
  assert.ok(version.resources?.script?.etag, 'Missing actual Worker version content identity');
  return { deploymentId: active.id, versionId: version.id, deployedAt: active.created_on, scriptEtag: version.resources.script.etag };
}

export function validateRoutes(routes) {
  for (const [pattern, script] of [['canopyproof.org/*', WORKER], ['www.canopyproof.org/*', WORKER], ['canopyproof.org/api/*', 'canopyproof-api-proxy']]) {
    const matches = routes.filter(route => route.pattern === pattern);
    assert.equal(matches.length, 1, `Existing route missing or ambiguous: ${pattern}`);
    assert.equal(matches[0].script, script, `Existing route maps to another Worker: ${pattern}`);
  }
}

export function validateSourceConfig(config, packageJson) {
  assert.deepEqual(Object.keys(config).sort(), ['$schema', 'name', 'main', 'compatibility_date', 'compatibility_flags', 'assets', 'services', 'routes', 'vars'].sort(), 'Unexpected production resource or binding configuration');
  assert.equal(config.name, WORKER);
  assert.equal(config.main, '.open-next/worker.js');
  assert.equal(config.compatibility_date, '2026-06-17');
  assert.deepEqual(config.compatibility_flags, ['nodejs_compat', 'global_fetch_strictly_public']);
  assert.deepEqual(config.assets, { directory: '.open-next/assets', binding: 'ASSETS' });
  assert.deepEqual(config.services, [{ binding: 'WORKER_SELF_REFERENCE', service: WORKER }]);
  assert.deepEqual(config.routes, [{ pattern: 'canopyproof.org/*', zone_name: 'canopyproof.org' }, { pattern: 'www.canopyproof.org/*', zone_name: 'canopyproof.org' }]);
  assert.deepEqual(config.vars, { NEXT_PUBLIC_DROPIN_API_URL: 'https://canopyproof.org/api', NEXT_PUBLIC_DROPIN_SITE_URL: 'https://canopyproof.org', NEXT_PUBLIC_CANOPYPROOF_MODE: 'production' });
  for (const [name, command] of Object.entries({ 'cf:deploy': 'npm run opennext:deploy', 'opennext:deploy': 'opennextjs-cloudflare deploy' })) assert.equal(packageJson.scripts[name], command, 'Deployment command changed');
  for (const name of ['precf:deploy', 'postcf:deploy', 'preopennext:deploy', 'postopennext:deploy']) assert.equal(packageJson.scripts[name], undefined, 'Unexpected deployment lifecycle command');
}
