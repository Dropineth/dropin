import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEVELS,
  LIMITS,
  WORLD_PROFILE,
  WorldValidationError,
  projectWorld,
} from '../src/world.mjs';
import { createWorldFixture } from '../src/fixtures.mjs';

const clone = (value) => globalThis.structuredClone(value);
const byId = (world, id) => world.nodes.find((node) => node.id === id);
const atScale = (world, scale) => world.nodes.find((node) => node.scale === scale);
const leaf = (world) => atScale(world, 'single_cell');
const ref = (id = 'test-evidence') => ({ id, version: '1', digest: 'a'.repeat(64) });
const issue = (id = 'critical-challenge') => ({
  id,
  kind: 'challenge',
  severity: 'critical',
  status: 'open',
  evidenceRefs: [ref(`${id}-evidence`)],
});

function ancestorIds(world, initialIds) {
  const result = new Set(initialIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of world.nodes) {
      if (!result.has(node.id) && node.members.some((id) => result.has(id))) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

async function rejectWorld(input, label) {
  await assert.rejects(
    () => projectWorld(input),
    (error) => error instanceof WorldValidationError && typeof error.code === 'string',
    label,
  );
}

function assertNonAuthoritative(result) {
  assert.equal(result.authenticated, false);
  assert.equal(result.derivedViewOnly, true);
  assert.equal(result.protocolTruth, false);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.globalCoverage, null);
}

test('all ten scales are explicit and remain non-authoritative', async () => {
  assert.deepEqual(LEVELS, [
    'single_cell', 'organization', 'organ', 'functional_system', 'organism',
    'population', 'ecosystem', 'planet', 'galaxy', 'universe',
  ]);
  const input = await createWorldFixture();
  assert.equal(input.profile, WORLD_PROFILE);
  const before = clone(input);
  const result = await projectWorld(input);
  assert.deepEqual(input, before, 'projection must not modify source records');
  assert.deepEqual(new Set(result.nodes.map((node) => node.scale)), new Set(LEVELS));
  assertNonAuthoritative(result);
  for (const scale of ['galaxy', 'universe']) {
    assert.equal(atScale(result, scale).representation, 'conceptual');
  }
});

test('one canonical CAI may participate through multiple parents without double counting', async () => {
  const input = await createWorldFixture();
  const subject = leaf(input);
  const organization = atScale(input, 'organization');
  const duplicateParent = {
    ...clone(organization),
    id: 'second-organization',
    label: 'Second functional relationship',
    members: [subject.id],
    formation: null,
    issues: [],
  };
  input.nodes.push(duplicateParent);
  const organ = atScale(input, 'organ');
  organ.members.push(duplicateParent.id);
  organ.formation = null;
  const result = await projectWorld(input);
  const aggregate = byId(result, organ.id);
  assert.equal(aggregate.memberBindings.filter((member) => member.caiId === subject.caiId).length, 1);
  assert.equal(aggregate.memberCount, new Set(aggregate.memberBindings.map((member) => member.caiId)).size);
  assert.equal(byId(result, subject.id).memberCount, 1);
  assertNonAuthoritative(result);
});

test('a second node cannot impersonate an existing CAI identity', async () => {
  const input = await createWorldFixture();
  input.nodes.push({ ...clone(leaf(input)), id: 'duplicate-leaf-id' });
  await rejectWorld(input, 'identity aliases must not inflate membership');
});

test('keyed-array ordering does not alter membership or view commitments', async () => {
  const input = await createWorldFixture();
  const reordered = clone(input);
  reordered.nodes.reverse();
  reordered.physicalEntities.reverse();
  reordered.displayAssets.reverse();
  reordered.relations.reverse();
  reordered.history.refs.reverse();
  for (const node of reordered.nodes) {
    node.members.reverse();
    node.physicalEntityIds.reverse();
    node.displayAssetIds.reverse();
    node.historyRefs.reverse();
  }
  const [original, permuted] = await Promise.all([projectWorld(input), projectWorld(reordered)]);
  assert.equal(permuted.sourceDigest, original.sourceDigest);
  assert.equal(permuted.viewRoot, original.viewRoot);
  for (const node of original.nodes) {
    assert.equal(byId(permuted, node.id).memberRoot, node.memberRoot);
  }
});

test('unknown or duplicate membership references are rejected', async () => {
  const unknown = await createWorldFixture();
  atScale(unknown, 'organization').members.push('missing-member');
  await rejectWorld(unknown, 'missing member must not silently disappear');
  const repeated = await createWorldFixture();
  const organization = atScale(repeated, 'organization');
  organization.members.push(organization.members[0]);
  await rejectWorld(repeated, 'duplicate edge must not inflate membership');
  const duplicateNode = await createWorldFixture();
  duplicateNode.nodes.push(clone(duplicateNode.nodes[0]));
  await rejectWorld(duplicateNode, 'duplicate node IDs must fail');
});

test('membership cycles, same-scale containment and reversed scale edges fail', async () => {
  const cycle = await createWorldFixture();
  const cell = leaf(cycle);
  cell.members = [atScale(cycle, 'universe').id];
  await rejectWorld(cycle);

  const sameScale = await createWorldFixture();
  const organization = atScale(sameScale, 'organization');
  const peer = { ...clone(organization), id: 'peer-organization', formation: null };
  sameScale.nodes.push(peer);
  organization.members.push(peer.id);
  await rejectWorld(sameScale);

  const reversed = await createWorldFixture();
  atScale(reversed, 'organization').members.push(atScale(reversed, 'organ').id);
  await rejectWorld(reversed);
});

test('critical leaf challenges remain visible in every ancestor', async () => {
  const input = await createWorldFixture();
  const subject = leaf(input);
  const challenge = issue('leaf-critical');
  subject.issues.push(challenge);
  const expected = ancestorIds(input, [subject.id]);
  const result = await projectWorld(input);
  for (const id of expected) {
    const propagated = byId(result, id).unresolvedIssues.find((entry) => entry.id === challenge.id);
    assert.ok(propagated, `challenge lost at ${id}`);
    assert.equal(propagated.severity, 'critical');
    assert.ok(propagated.originNodeIds.includes(subject.id));
  }
  assert.ok(atScale(result, 'universe').unresolvedIssues.some((entry) => entry.id === challenge.id));
});

test('critical relationship conflicts propagate from both endpoints to their ancestors', async () => {
  const input = await createWorldFixture();
  const from = leaf(input).id;
  const to = atScale(input, 'organ').id;
  const conflict = { ...issue('relation-critical'), kind: 'conflict' };
  const relation = {
    id: 'critical-cross-unit-relation', kind: 'conflicts_with', from, to,
    evidenceRefs: [ref('relation-evidence')], issues: [conflict],
  };
  input.relations.push(relation);
  const result = await projectWorld(input);
  for (const id of ancestorIds(input, [from, to])) {
    const propagated = byId(result, id).unresolvedIssues.find((entry) => entry.id === conflict.id);
    assert.ok(propagated, `relationship conflict lost at ${id}`);
    assert.ok(propagated.originRelationIds.includes(relation.id));
    assert.equal(propagated.severity, 'critical');
  }
});

test('functional dependency cycles are allowed without corrupting containment', async () => {
  const input = await createWorldFixture();
  const a = leaf(input).id;
  const b = atScale(input, 'organ').id;
  input.relations.push(
    { id: 'dependency-a-b', kind: 'depends_on', from: a, to: b, evidenceRefs: [ref('ab')], issues: [] },
    { id: 'dependency-b-a', kind: 'depends_on', from: b, to: a, evidenceRefs: [ref('ba')], issues: [] },
  );
  const result = await projectWorld(input);
  assertNonAuthoritative(result);
  assert.equal(byId(result, a).memberCount, 1);
  assert.ok(byId(result, b).memberBindings.some((member) => member.nodeId === a));
});

test('resolved challenges are preserved as source facts but do not remain unresolved', async () => {
  const input = await createWorldFixture();
  const subject = leaf(input);
  subject.issues.push({ ...issue('resolved-leaf'), status: 'resolved' });
  const result = await projectWorld(input);
  assert.ok(byId(result, subject.id).issues.some((entry) => entry.id === 'resolved-leaf' && entry.status === 'resolved'));
  for (const id of ancestorIds(input, [subject.id])) {
    assert.equal(byId(result, id).unresolvedIssues.some((entry) => entry.id === 'resolved-leaf'), false);
  }
});

test('rendering primitive counts and LOD changes cannot create or delete CAIs', async () => {
  const input = await createWorldFixture();
  assert.ok(input.displayAssets.length > 0, 'fixture must exercise spatial display');
  const changed = clone(input);
  changed.displayAssets[0].primitiveCount += 1_000_000;
  changed.displayAssets[0].lod = (changed.displayAssets[0].lod + 1) % 33;
  const [before, after] = await Promise.all([projectWorld(input), projectWorld(changed)]);
  for (const node of before.nodes) {
    assert.equal(byId(after, node.id).memberCount, node.memberCount);
    assert.equal(byId(after, node.id).memberRoot, node.memberRoot);
    assert.deepEqual(byId(after, node.id).memberBindings, node.memberBindings);
  }
  assert.notEqual(after.viewRoot, before.viewRoot, 'display changes remain observable');
});

test('physical entities do not obtain a CAI identity or a vote by appearing in the scene', async () => {
  const input = await createWorldFixture();
  const tree = { id: 'another-real-world-tree', kind: 'tree', capturedAt: null, sourceRefs: [] };
  input.physicalEntities.push(tree);
  leaf(input).physicalEntityIds.push(tree.id);
  const result = await projectWorld(input);
  assert.equal(byId(result, leaf(input).id).memberCount, 1);
  assert.equal(byId(result, leaf(input).id).memberBindings.some((member) => member.caiId === tree.id), false);
  const invalid = clone(input);
  invalid.physicalEntities.find((entity) => entity.id === tree.id).caiId = 'forged-cai';
  await rejectWorld(invalid);
});

test('infrastructure partitions are independent from life organization scales', async () => {
  const input = await createWorldFixture();
  const cell = leaf(input);
  const organ = atScale(input, 'organ');
  cell.infrastructure = { kind: 'region', id: 'infra-region', domain: input.domain };
  organ.infrastructure = { kind: 'cell', id: 'infra-cell', domain: input.domain };
  const result = await projectWorld(input);
  assert.equal(byId(result, cell.id).scale, 'single_cell');
  assert.equal(byId(result, cell.id).infrastructure.kind, 'region');
  assert.equal(byId(result, organ.id).infrastructure.kind, 'cell');
  assertNonAuthoritative(result);
});

test('physical capture timestamps never generate or rewrite protocol-history references', async () => {
  const input = await createWorldFixture();
  assert.ok(input.physicalEntities.length > 0);
  const changed = clone(input);
  changed.physicalEntities[0].capturedAt = '2000-01-01T00:00:00.000Z';
  if (changed.displayAssets.length) changed.displayAssets[0].capturedAt = '2001-01-01T00:00:00.000Z';
  const [before, after] = await Promise.all([projectWorld(input), projectWorld(changed)]);
  assert.deepEqual(after.history, before.history);
  for (const node of before.nodes) {
    assert.deepEqual(byId(after, node.id).historyRefs, node.historyRefs);
    assert.equal(byId(after, node.id).memberRoot, node.memberRoot);
  }
  assert.notEqual(after.sourceDigest, before.sourceDigest);
});

test('formation evidence binds the exact members and cannot assert functional verification', async () => {
  const input = await createWorldFixture();
  const organization = atScale(input, 'organization');
  const unformed = await projectWorld(input);
  organization.formation = {
    version: 'test-formation-v1',
    memberRoot: byId(unformed, organization.id).memberRoot,
    functionContract: ref('function'),
    historyRefs: clone(organization.historyRefs),
    evidenceRefs: [ref('evidence')],
    assessment: ref('assessment'),
    recovery: ref('recovery'),
    resourceConstraints: ref('resources'),
    responsibilityBoundary: ref('responsibility'),
    exitRule: ref('exit'),
  };
  const result = await projectWorld(input);
  assert.equal(byId(result, organization.id).formationStatus, 'referenced_unverified');
  assertNonAuthoritative(result);

  const additional = clone(input);
  const newMember = { ...clone(leaf(input)), id: 'new-cell', caiId: 'new-cai', issues: [] };
  additional.nodes.push(newMember);
  byId(additional, organization.id).members.push(newMember.id);
  await rejectWorld(additional, 'changing membership must invalidate the old formation commitment');

  const hidden = clone(input);
  byId(hidden, organization.id).members = [];
  await rejectWorld(hidden, 'removing members must not retain their prior formation claim');

  const forged = clone(input);
  byId(forged, organization.id).formation.verified = true;
  await rejectWorld(forged, 'source may not self-certify functional verification');

  const wrongHistory = clone(input);
  byId(wrongHistory, organization.id).formation.historyRefs = [ref('different-history')];
  await rejectWorld(wrongHistory, 'formation cannot substitute a different interaction history');
});

test('source references are explicitly unverified and never activate LIVE publication', async () => {
  const input = await createWorldFixture();
  input.sourceMode = 'source_referenced';
  for (const node of input.nodes) {
    if (node.representation !== 'conceptual') node.representation = 'source_referenced';
  }
  const result = await projectWorld(input);
  assertNonAuthoritative(result);
  for (const unsupported of ['LIVE', 'live', 'authenticated', 'LIVE_VERIFIED']) {
    const invalid = clone(input);
    invalid.sourceMode = unsupported;
    await rejectWorld(invalid, unsupported);
  }
});

test('galaxy and universe remain conceptual regardless of claimed source classification', async () => {
  for (const scale of ['galaxy', 'universe']) {
    const input = await createWorldFixture();
    atScale(input, scale).representation = 'source_referenced';
    await rejectWorld(input, `${scale} must not imply unestablished physical deployment`);
  }
});

test('input cannot supply its own authority, coverage or member counts', async () => {
  for (const [field, value] of [
    ['authenticated', true], ['executionAuthority', true], ['productionReady', true],
    ['globalCoverage', 1], ['permissions', ['transfer']], ['votes', 5],
  ]) {
    const input = await createWorldFixture();
    input[field] = value;
    await rejectWorld(input, `unexpected root field ${field}`);
  }
  for (const [field, value] of [
    ['memberCount', 1_000_000], ['memberRoot', 'b'.repeat(64)], ['coverage', 1],
    ['authorized', true], ['rank', 100], ['grant', 'all'],
  ]) {
    const input = await createWorldFixture();
    leaf(input)[field] = value;
    await rejectWorld(input, `unexpected node field ${field}`);
  }
});

test('dangling spatial and relationship references are rejected', async () => {
  const physical = await createWorldFixture();
  leaf(physical).physicalEntityIds.push('unknown-physical-object');
  await rejectWorld(physical);
  const asset = await createWorldFixture();
  leaf(asset).displayAssetIds.push('unknown-display-asset');
  await rejectWorld(asset);
  const relation = await createWorldFixture();
  relation.relations.push({
    id: 'dangling-relation', kind: 'depends_on', from: leaf(relation).id,
    to: 'unknown-node', evidenceRefs: [ref()], issues: [],
  });
  await rejectWorld(relation);
});

test('resource limits fail explicitly instead of truncating membership or evidence', async () => {
  const tooManyNodes = await createWorldFixture();
  while (tooManyNodes.nodes.length <= LIMITS.nodes) {
    const index = tooManyNodes.nodes.length;
    tooManyNodes.nodes.push({
      ...clone(leaf(tooManyNodes)), id: `limit-cell-${index}`, caiId: `limit-cai-${index}`,
      issues: [],
    });
  }
  await rejectWorld(tooManyNodes);

  const tooManyIssues = await createWorldFixture();
  leaf(tooManyIssues).issues = Array.from({ length: LIMITS.issuesPerContainer + 1 }, (_, index) => issue(`issue-${index}`));
  await rejectWorld(tooManyIssues);

  const tooManyRefs = await createWorldFixture();
  tooManyRefs.history.refs = Array.from({ length: LIMITS.referencesPerContainer + 1 }, (_, index) => ref(`ref-${index}`));
  await rejectWorld(tooManyRefs);

  const excessiveBytes = await createWorldFixture();
  leaf(excessiveBytes).label = 'x'.repeat(LIMITS.inputBytes + 1);
  await rejectWorld(excessiveBytes);
});

test('malformed input, counts, timestamps and unsupported values fail closed', async () => {
  for (const input of [null, undefined, [], true, 'world', 7, {}]) await rejectWorld(input);
  const mutations = [
    (input) => { input.profile = 'lifepp.official.world.v1'; },
    (input) => { input.asOf = '2030-02-30T00:00:00.000Z'; },
    (input) => { input.asOf = '2030-01-01'; },
    (input) => { leaf(input).scale = 'tenth-dimension'; },
    (input) => { leaf(input).issues = [{ ...issue(), severity: 'passed' }]; },
    (input) => { input.history.refs[0].digest = 'not-a-digest'; },
    (input) => { input.displayAssets[0].primitiveCount = Number.MAX_SAFE_INTEGER + 1; },
    (input) => { input.displayAssets[0].primitiveCount = -1; },
    (input) => { input.displayAssets[0].primitiveCount = 0.5; },
    (input) => { input.displayAssets[0].lod = 33; },
    (input) => { input.physicalEntities[0].capturedAt = '2000-01-01T00:00:00Z'; },
  ];
  for (const mutate of mutations) {
    const input = await createWorldFixture();
    mutate(input);
    await rejectWorld(input);
  }
});

test('membership, physical objects and rendering primitives have independent exact counts', async () => {
  const input = await createWorldFixture();
  const result = await projectWorld(input);
  assert.equal(result.snapshotCounts.caiCount, new Set(input.nodes.filter((node) => node.caiId).map((node) => node.caiId)).size);
  assert.equal(result.snapshotCounts.physicalEntityCount, input.physicalEntities.length);
  assert.equal(result.snapshotCounts.displayAssetCount, input.displayAssets.length);
  assert.equal(result.snapshotCounts.renderPrimitiveCount, input.displayAssets.reduce((sum, asset) => sum + asset.primitiveCount, 0));
  const universe = atScale(result, 'universe');
  assert.equal(universe.memberCount, result.snapshotCounts.caiCount);
  assert.equal(universe.coverage.scope, 'provided_snapshot');
  assert.equal(universe.coverage.memberCount, universe.memberCount);
  assert.equal(universe.coverage.fixtureMemberCount, universe.memberCount);
  assert.equal(universe.coverage.sourceReferencedMemberCount, 0);
  assert.equal(universe.coverage.physicalEntitiesWithSourceCount, input.physicalEntities.filter((entity) => entity.sourceRefs.length > 0).length);
  assert.equal(universe.globalCoverage, null);
  assert.equal(universe.permissionsInherited, false);
});

test('a formation commitment detects changed membership paths even when the CAI set is unchanged', async () => {
  const input = await createWorldFixture();
  const formed = input.nodes.find((node) => node.formation !== null);
  assert.ok(formed, 'fixture must contain a formation claim');
  const originalMember = byId(input, formed.members[0]);
  const replacement = { ...clone(originalMember), id: 'equivalent-team', formation: null };
  input.nodes.push(replacement);
  formed.members[0] = replacement.id;
  await rejectWorld(input, 'same CAIs through a new organizational path need a new formation binding');
});

test('conflicting issue states and conflicting versions of one evidence reference are rejected', async () => {
  const issueConflict = await createWorldFixture();
  const subjects = issueConflict.nodes.filter((node) => node.scale === 'single_cell');
  subjects[0].issues.push(issue('conflicting-state'));
  subjects[1].issues.push({ ...issue('conflicting-state'), status: 'resolved' });
  await rejectWorld(issueConflict, 'an aggregate cannot erase a challenge through conflicting source states');

  const referenceConflict = await createWorldFixture();
  const existing = referenceConflict.history.refs[0];
  leaf(referenceConflict).historyRefs = [{ ...clone(existing), digest: 'f'.repeat(64) }];
  await rejectWorld(referenceConflict, 'one versioned source cannot simultaneously mean two different byte digests');
});

test('domain separation changes membership commitments and cannot reuse formation evidence', async () => {
  const input = await createWorldFixture();
  const changed = clone(input);
  changed.domain = 'another-project';
  await rejectWorld(changed, 'formation commitment from another domain is not portable authority');
  for (const node of changed.nodes) node.formation = null;
  const [before, after] = await Promise.all([projectWorld(input), projectWorld(changed)]);
  for (const node of before.nodes) assert.notEqual(byId(after, node.id).memberRoot, node.memberRoot);
  assertNonAuthoritative(after);
});

test('unsafe JSON shapes are rejected without executing getters or accepting hidden fields', async () => {
  const getterInput = await createWorldFixture();
  let invoked = 0;
  Object.defineProperty(getterInput, 'permissions', { enumerable: true, get() { invoked += 1; return ['all']; } });
  await rejectWorld(getterInput);
  assert.equal(invoked, 0, 'validation must not execute caller accessors');

  const hidden = await createWorldFixture();
  Object.defineProperty(hidden, 'authenticated', { enumerable: false, value: true });
  await rejectWorld(hidden);

  const symbolic = await createWorldFixture();
  symbolic[Symbol('authorization')] = true;
  await rejectWorld(symbolic);

  const sparse = await createWorldFixture();
  delete sparse.nodes[0];
  await rejectWorld(sparse);

  const cyclic = await createWorldFixture();
  cyclic.nodes[0].formation = cyclic;
  await rejectWorld(cyclic);
});

test('capture after snapshot and aggregate numeric overflow cannot produce plausible counts', async () => {
  const future = await createWorldFixture();
  future.physicalEntities[0].capturedAt = '2099-01-01T00:00:00.000Z';
  await rejectWorld(future);
  const overflow = await createWorldFixture();
  overflow.displayAssets[0].primitiveCount = Number.MAX_SAFE_INTEGER;
  overflow.displayAssets.push({ ...clone(overflow.displayAssets[0]), id: 'overflow-asset', primitiveCount: 1 });
  await rejectWorld(overflow);
});

test('dense valid containment is bounded before aggregate output amplification', async () => {
  const input = await createWorldFixture();
  const cellTemplate = clone(leaf(input));
  const compositeTemplate = clone(atScale(input, 'organization'));
  input.nodes = Array.from({ length: 400 }, (_, index) => ({
    ...clone(cellTemplate), id: `dense-cell-${index}`, caiId: `dense-cai-${index}`,
    members: [], formation: null, issues: [issue(`dense-challenge-${index}`)],
  }));
  const memberIds = input.nodes.map((node) => node.id);
  const organizations = Array.from({ length: 10 }, (_, index) => ({
    ...clone(compositeTemplate), id: `dense-team-${index}`, members: [...memberIds],
    formation: null, issues: [],
  }));
  input.nodes.push(...organizations);
  let previousIds = organizations.map((node) => node.id);
  for (const scale of LEVELS.slice(2)) {
    const id = `dense-${scale}`;
    input.nodes.push({
      ...clone(compositeTemplate), id, scale, members: previousIds, formation: null,
      representation: ['galaxy', 'universe'].includes(scale) ? 'conceptual' : 'fixture',
      issues: [],
    });
    previousIds = [id];
  }
  input.relations = [];
  assert.ok(input.nodes.length <= LIMITS.nodes);
  assert.ok(input.nodes.reduce((count, node) => count + node.members.length, 0) <= LIMITS.memberships);
  assert.ok(new globalThis.TextEncoder().encode(JSON.stringify(input)).length <= LIMITS.inputBytes);
  await assert.rejects(
    () => projectWorld(input),
    (error) => error instanceof WorldValidationError && error.code === 'PROJECTION_LIMIT',
    'valid shared memberships must fail explicitly at output budget, never silently drop members or challenges',
  );
});

test('aggregate string bytes are bounded before an oversized input can become a world', async () => {
  const oversized = Array.from({ length: 1_000 }, () => 'x'.repeat(4_096));
  assert.ok(oversized.length * oversized[0].length > LIMITS.inputBytes);
  await assert.rejects(
    () => projectWorld(oversized),
    (error) => error instanceof WorldValidationError && error.code === 'INPUT_LIMIT',
    'combined byte size must be rejected independently of per-string and world-shape checks',
  );
});

test('an empty aggregate can be navigated but cannot claim formation evidence', async () => {
  const input = await createWorldFixture();
  for (const node of input.nodes) node.formation = null;
  const empty = atScale(input, 'organization');
  empty.members = [];
  atScale(input, 'galaxy').members = [];
  const result = await projectWorld(input);
  assert.equal(byId(result, empty.id).memberCount, 0);
  assert.equal(byId(result, empty.id).formationStatus, 'none');
  assert.equal(atScale(result, 'galaxy').memberCount, 0);
  assert.equal(atScale(result, 'galaxy').representation, 'conceptual');
  empty.formation = {
    version: 'empty-formation-v1',
    memberRoot: byId(result, empty.id).memberRoot,
    functionContract: ref('empty-function'), historyRefs: clone(empty.historyRefs),
    evidenceRefs: [ref('empty-evidence')], assessment: ref('empty-assessment'),
    recovery: ref('empty-recovery'), resourceConstraints: ref('empty-resources'),
    responsibilityBoundary: ref('empty-responsibility'), exitRule: ref('empty-exit'),
  };
  await assert.rejects(
    () => projectWorld(input),
    (error) => error instanceof WorldValidationError && error.code === 'EMPTY_FORMATION',
    'an exact empty member commitment is not evidence of an existing functional organization',
  );
});

test('render primitive kinds remain separate and source references do not assess currentness', async () => {
  const input = await createWorldFixture();
  const template = input.displayAssets[0];
  input.displayAssets.push(
    { ...clone(template), id: 'asset-gaussians', kind: '3dgs', primitiveCount: 87 },
    { ...clone(template), id: 'asset-mesh', kind: 'mesh', primitiveCount: 31 },
    { ...clone(template), id: 'asset-semantic', kind: 'semantic', primitiveCount: 5 },
  );
  const result = await projectWorld(input);
  const expected = { '3dgs': 0, point_cloud: 0, mesh: 0, semantic: 0 };
  for (const asset of input.displayAssets) expected[asset.kind] += asset.primitiveCount;
  assert.deepEqual(result.snapshotCounts.renderPrimitiveCountsByKind, expected);
  assert.equal(result.currentness, 'not_assessed');
  assertNonAuthoritative(result);
});

test('node history must be part of the declared snapshot history', async () => {
  const input = await createWorldFixture();
  leaf(input).historyRefs.push(ref('unlisted-history'));
  await assert.rejects(
    () => projectWorld(input),
    (error) => error instanceof WorldValidationError && error.code === 'HISTORY_SNAPSHOT_MISMATCH',
    'a node may not splice in a history reference outside its declared snapshot',
  );
});

test('labels reject control characters while preserving ordinary multilingual text', async () => {
  for (const control of ['\u0000', '\n', '\r', '\t', '\u001b', '\u007f']) {
    const input = await createWorldFixture();
    leaf(input).label = `Observer${control}approved`;
    await rejectWorld(input, 'control characters must not spoof visible labels or logs');
  }
  const input = await createWorldFixture();
  const cell = leaf(input);
  cell.label = '生态观察 / Ecological observation';
  const result = await projectWorld(input);
  assert.equal(byId(result, cell.id).label, cell.label);
});
