import { WORLD_PROFILE, LEVELS, projectWorld } from './world.mjs';

/** Entirely synthetic, public, non-sensitive fixtures; no actual participant or authority. */
export async function createWorldFixture() {
  const reference = id => ({ id: `fixture:${id}`, version: 'v1', digest: '1'.repeat(64) });
  const historyRef = reference('history');
  const node = (id, scale, members = [], extra = {}) => ({
    id, label: `Synthetic ${id}`, scale, representation: ['galaxy', 'universe'].includes(scale) ? 'conceptual' : 'fixture',
    caiId: scale === 'single_cell' ? `cai:${id}` : null, members, historyRefs: [historyRef], physicalEntityIds: [], displayAssetIds: [],
    infrastructure: { kind: 'cell', id: 'infra:sample-cell', domain: 'fixture:canopyproof' }, issues: [], formation: null, ...extra,
  });
  const nodes = [
    node('observer', 'single_cell', [], { physicalEntityIds: ['physical:tree', 'physical:sensor'], issues: [{ id: 'issue:sample-dispute', kind: 'challenge', severity: 'critical', status: 'open', evidenceRefs: [reference('dispute')] }] }),
    node('verifier', 'single_cell', [], { physicalEntityIds: ['physical:tree'] }),
    node('collector', 'single_cell', [], { physicalEntityIds: ['physical:plot'] }),
    node('observing-team', 'organization', ['observer', 'verifier']),
    node('review-unit', 'organ', ['observing-team'], { displayAssetIds: ['asset:sample-cloud'] }),
    node('monitoring-system', 'functional_system', ['review-unit']),
    node('correction-team', 'organization', ['collector', 'verifier']),
    node('correction-unit', 'organ', ['correction-team']),
    node('correction-system', 'functional_system', ['correction-unit']),
    node('site', 'organism', ['monitoring-system', 'correction-system']),
    node('sites', 'population', ['site']),
    node('ecology', 'ecosystem', ['sites']),
    node('earth-domain', 'planet', ['ecology'], { infrastructure: { kind: 'planet', id: 'infra:planet-domain', domain: 'fixture:canopyproof' } }),
    node('federation-concept', 'galaxy', ['earth-domain']),
    node('discovery-concept', 'universe', ['federation-concept']),
  ];
  const input = {
    profile: WORLD_PROFILE, snapshotId: 'fixture:ten-scales', domain: 'fixture:canopyproof', sourceMode: 'fixture', asOf: '2026-11-18T00:00:00.000Z',
    history: { protocol: 'fixture:history-reference-only', refs: [historyRef] }, nodes,
    physicalEntities: [
      { id: 'physical:tree', kind: 'tree', capturedAt: '2026-11-17T10:00:00.000Z', sourceRefs: [reference('tree-capture')] },
      { id: 'physical:sensor', kind: 'device', capturedAt: '2026-11-17T10:00:00.000Z', sourceRefs: [reference('sensor-capture')] },
      { id: 'physical:plot', kind: 'plot', capturedAt: null, sourceRefs: [] },
    ],
    displayAssets: [{ id: 'asset:sample-cloud', kind: 'point_cloud', physicalEntityIds: ['physical:tree'], lod: 2, primitiveCount: 4000, capturedAt: '2026-11-17T10:00:00.000Z', sourceRefs: [reference('cloud')] }],
    relations: [
      { id: 'relation:monitoring-correction', kind: 'depends_on', from: 'monitoring-system', to: 'correction-system', evidenceRefs: [reference('dependency')], issues: [] },
      { id: 'relation:correction-monitoring', kind: 'depends_on', from: 'correction-system', to: 'monitoring-system', evidenceRefs: [reference('dependency')], issues: [] },
      { id: 'relation:shared-resource', kind: 'shares_resource', from: 'monitoring-system', to: 'correction-system', evidenceRefs: [reference('resource')], issues: [{ id: 'issue:resource-shortage', kind: 'resource_constraint', severity: 'warning', status: 'open', evidenceRefs: [reference('resource')] }] },
    ],
  };
  const projection = await projectWorld(input);
  nodes.find(item => item.id === 'review-unit').formation = {
    version: 'v1', memberRoot: projection.nodes.find(item => item.id === 'review-unit').memberRoot,
    functionContract: reference('function-contract'), historyRefs: [historyRef], evidenceRefs: [reference('function-evidence')], assessment: reference('assessment'),
    recovery: reference('recovery'), resourceConstraints: reference('resource-constraints'), responsibilityBoundary: reference('responsibility'), exitRule: reference('exit'),
  };
  // This assertion protects the fixture's declared navigation coverage, not real-world coverage.
  if (LEVELS.some(scale => !nodes.some(item => item.scale === scale))) throw new Error('Fixture omits a navigation scale.');
  return input;
}
