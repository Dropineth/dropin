/** Original downstream read model. This is not an AHIN wire format or authority. */
export const WORLD_PROFILE = 'canopyproof.collaboration-world.v1';
export const LEVELS = Object.freeze(['single_cell', 'organization', 'organ', 'functional_system', 'organism', 'population', 'ecosystem', 'planet', 'galaxy', 'universe']);
export const LIMITS = Object.freeze({ nodes: 512, memberships: 4096, physicalEntities: 512, displayAssets: 512, relations: 2048, issuesPerContainer: 64, referencesPerContainer: 64, totalReferences: 16384, totalIssueOccurrences: 8192, inputBytes: 2_000_000, projectionEntries: 32_768, outputBytes: 8_000_000 });
const LEVEL_INDEX = new Map(LEVELS.map((level, index) => [level, index]));
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const encoder = new globalThis.TextEncoder();
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = (items, key = item => item) => [...items].sort((a, b) => compare(key(a), key(b)));

export class WorldValidationError extends Error {
  constructor(code, message) { super(message); this.name = 'WorldValidationError'; this.code = code; }
}
function fail(code, message) { throw new WorldValidationError(code, message); }
function check(condition, code, message) { if (!condition) fail(code, message); }

/** Bounded data-only JSON clone; accessors, prototypes and hidden/symbol keys are rejected. */
function cloneJson(input) {
  let count = 0; let inputBytes = 0;
  const reserveBytes = size => {
    inputBytes += size;
    check(inputBytes <= LIMITS.inputBytes, 'INPUT_LIMIT', 'Input exceeds the serialized byte bound.');
  };
  const active = new WeakSet();
  const visit = (value, depth) => {
    check(++count <= 150_000 && depth <= 32, 'INPUT_LIMIT', 'Input structure exceeds the projection bound.');
    if (value === null || typeof value === 'boolean') { reserveBytes(value === null || value === true ? 4 : 5); return value; }
    if (typeof value === 'string') {
      check(value.length <= 4096, 'INPUT_LIMIT', 'Input string exceeds the projection bound.');
      reserveBytes(encoder.encode(JSON.stringify(value)).length);
      return value;
    }
    if (typeof value === 'number') {
      check(Number.isSafeInteger(value), 'INVALID_NUMBER', 'Only safe integral input numbers are supported.');
      reserveBytes(String(value).length);
      return Object.is(value, -0) ? 0 : value;
    }
    check(typeof value === 'object' && value !== null, 'INVALID_JSON', 'Input must contain only JSON data.');
    check(!active.has(value), 'CYCLIC_INPUT', 'Input data contains an object cycle.');
    check(Object.getOwnPropertySymbols(value).length === 0, 'INVALID_JSON', 'Symbol fields are not supported.');
    const array = Array.isArray(value);
    check(array ? Object.getPrototypeOf(value) === Array.prototype : [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INVALID_JSON', 'Only plain data objects and arrays are supported.');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    check(keys.length <= 20_000, 'INPUT_LIMIT', 'Input container exceeds the projection bound.');
    active.add(value);
    let result;
    if (array) {
      check(value.length <= 20_000 && keys.length === value.length + 1, 'INVALID_JSON', 'Sparse or extended arrays are not supported.');
      reserveBytes(2 + Math.max(0, value.length - 1));
      result = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = descriptors[String(i)];
        check(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'INVALID_JSON', 'Array elements must be data.');
        result.push(visit(descriptor.value, depth + 1));
      }
    } else {
      reserveBytes(2 + Math.max(0, keys.length - 1));
      result = Object.create(null);
      for (const key of keys) {
        check(key.length <= 128, 'INPUT_LIMIT', 'Input field name exceeds the projection bound.');
        reserveBytes(encoder.encode(JSON.stringify(key)).length + 1);
        const descriptor = descriptors[key];
        check(Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'INVALID_JSON', 'Object fields must be enumerable data.');
        result[key] = visit(descriptor.value, depth + 1);
      }
    }
    active.delete(value);
    return result;
  };
  const result = visit(input, 0);
  check(encoder.encode(JSON.stringify(result)).length <= LIMITS.inputBytes, 'INPUT_LIMIT', 'Input exceeds the serialized byte bound.');
  return result;
}

function exact(value, keys, name) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_SHAPE', `${name} must be an object.`);
  check(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'UNKNOWN_OR_MISSING_FIELD', `${name} has unknown or missing fields.`);
}
function identifier(value, name) { check(typeof value === 'string' && ID.test(value), 'INVALID_ID', `${name} is not an opaque bounded identifier.`); return value; }
function enumValue(value, choices, name) { check(choices.includes(value), 'INVALID_ENUM', `${name} is unsupported.`); return value; }
function boundedArray(value, limit, name) { check(Array.isArray(value) && value.length <= limit, 'INPUT_LIMIT', `${name} must be a bounded array.`); return value; }
function uniqueStrings(value, limit, name) {
  boundedArray(value, limit, name).forEach(item => identifier(item, name));
  check(new Set(value).size === value.length, 'DUPLICATE_REFERENCE', `${name} contains duplicate references.`);
  return sorted(value);
}
function timestamp(value, name) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'INVALID_TIMESTAMP', `${name} must be an exact UTC timestamp.`);
  return value;
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${sorted(Object.keys(value)).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
async function digest(kind, value) {
  check(globalThis.crypto?.subtle, 'CRYPTO_UNAVAILABLE', 'WebCrypto SHA-256 is required.');
  const bytes = encoder.encode(`${WORLD_PROFILE}\n${kind}\n${canonical(value)}`);
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Offline deterministic projection only. Source references are unverified pointers.
 * No adapter, current authorization, signing, global coverage or deployment is implied.
 */
export async function projectWorld(rawInput) {
  const input = cloneJson(rawInput);
  exact(input, ['profile', 'snapshotId', 'domain', 'sourceMode', 'asOf', 'history', 'nodes', 'physicalEntities', 'displayAssets', 'relations'], 'world');
  check(input.profile === WORLD_PROFILE, 'WRONG_PROFILE', 'Unsupported product projection profile.');
  identifier(input.snapshotId, 'snapshotId'); identifier(input.domain, 'domain');
  enumValue(input.sourceMode, ['fixture', 'source_referenced'], 'sourceMode');
  timestamp(input.asOf, 'asOf');
  exact(input.history, ['protocol', 'refs'], 'history'); identifier(input.history.protocol, 'history.protocol');
  const referenceRegistry = new Map(); let referenceCount = 0; let issueOccurrences = 0;
  const issueRegistry = new Map();
  const refKey = ref => `${ref.id}\0${ref.version}`;
  const ref = value => {
    check(++referenceCount <= LIMITS.totalReferences, 'INPUT_LIMIT', 'Too many source references.');
    exact(value, ['id', 'version', 'digest'], 'source reference');
    identifier(value.id, 'reference.id'); identifier(value.version, 'reference.version');
    check(typeof value.digest === 'string' && HASH.test(value.digest), 'INVALID_DIGEST', 'Source reference requires a SHA-256-shaped digest.');
    const old = referenceRegistry.get(refKey(value));
    check(!old || old === value.digest, 'CONFLICTING_REFERENCE', 'One source version has conflicting digests.');
    referenceRegistry.set(refKey(value), value.digest);
    return { id: value.id, version: value.version, digest: value.digest };
  };
  const refs = value => {
    const result = boundedArray(value, LIMITS.referencesPerContainer, 'source references').map(ref);
    check(new Set(result.map(refKey)).size === result.length, 'DUPLICATE_REFERENCE', 'Duplicate source version reference.');
    return sorted(result, refKey);
  };
  const issues = value => {
    const result = boundedArray(value, LIMITS.issuesPerContainer, 'issues').map(issue => {
      check(++issueOccurrences <= LIMITS.totalIssueOccurrences, 'INPUT_LIMIT', 'Too many issue occurrences.');
      exact(issue, ['id', 'kind', 'severity', 'status', 'evidenceRefs'], 'issue');
      identifier(issue.id, 'issue.id');
      enumValue(issue.kind, ['challenge', 'degraded', 'revoked', 'conflict', 'resource_constraint'], 'issue.kind');
      enumValue(issue.severity, ['info', 'warning', 'critical'], 'issue.severity');
      enumValue(issue.status, ['open', 'resolved'], 'issue.status');
      const normalized = { ...issue, evidenceRefs: refs(issue.evidenceRefs) };
      const old = issueRegistry.get(issue.id);
      check(!old || canonical(old) === canonical(normalized), 'CONFLICTING_ISSUE', 'An issue ID has conflicting source states.');
      issueRegistry.set(issue.id, normalized);
      return normalized;
    });
    check(new Set(result.map(issue => issue.id)).size === result.length, 'DUPLICATE_ISSUE', 'An issue occurs twice in one container.');
    return sorted(result, issue => issue.id);
  };
  const capturedAt = value => {
    if (value === null) return null;
    timestamp(value, 'capturedAt');
    check(value <= input.asOf, 'CAPTURE_AFTER_SNAPSHOT', 'Capture time is later than the declared snapshot time.');
    return value;
  };
  const normalizedHistory = { protocol: input.history.protocol, refs: refs(input.history.refs) };
  const allObjectIds = new Set();
  const register = (id, name) => { identifier(id, name); check(!allObjectIds.has(id), 'DUPLICATE_ID', 'Object IDs must be unambiguous.'); allObjectIds.add(id); };
  const physicalEntities = sorted(boundedArray(input.physicalEntities, LIMITS.physicalEntities, 'physicalEntities').map(entity => {
    exact(entity, ['id', 'kind', 'capturedAt', 'sourceRefs'], 'physical entity'); register(entity.id, 'physical.id');
    enumValue(entity.kind, ['tree', 'device', 'robot', 'plot', 'space'], 'physical.kind');
    return { ...entity, capturedAt: capturedAt(entity.capturedAt), sourceRefs: refs(entity.sourceRefs) };
  }), entity => entity.id);
  const physicalIds = new Set(physicalEntities.map(entity => entity.id));
  const displayAssets = sorted(boundedArray(input.displayAssets, LIMITS.displayAssets, 'displayAssets').map(asset => {
    exact(asset, ['id', 'kind', 'physicalEntityIds', 'lod', 'primitiveCount', 'capturedAt', 'sourceRefs'], 'display asset'); register(asset.id, 'asset.id');
    enumValue(asset.kind, ['3dgs', 'point_cloud', 'mesh', 'semantic'], 'asset.kind');
    check(Number.isSafeInteger(asset.lod) && asset.lod >= 0 && asset.lod <= 32, 'INVALID_LOD', 'LOD must be an integer from zero to 32.');
    check(Number.isSafeInteger(asset.primitiveCount) && asset.primitiveCount >= 0, 'INVALID_COUNT', 'Primitive count must be a nonnegative safe integer.');
    const ids = uniqueStrings(asset.physicalEntityIds, LIMITS.physicalEntities, 'asset.physicalEntityIds');
    check(ids.every(id => physicalIds.has(id)), 'MISSING_REFERENCE', 'Display asset refers to an absent physical entity.');
    return { ...asset, physicalEntityIds: ids, capturedAt: capturedAt(asset.capturedAt), sourceRefs: refs(asset.sourceRefs) };
  }), asset => asset.id);
  const assetIds = new Set(displayAssets.map(asset => asset.id));
  const caiIds = new Set(); let memberships = 0;
  const nodes = sorted(boundedArray(input.nodes, LIMITS.nodes, 'nodes').map(node => {
    exact(node, ['id', 'label', 'scale', 'representation', 'caiId', 'members', 'historyRefs', 'physicalEntityIds', 'displayAssetIds', 'infrastructure', 'issues', 'formation'], 'node'); register(node.id, 'node.id');
    check(typeof node.label === 'string' && node.label.trim().length > 0 && node.label.length <= 160 && [...node.label].every(character => {
      const code = character.codePointAt(0);
      return code > 31 && (code < 127 || code > 159);
    }), 'INVALID_LABEL', 'Node label must be bounded nonempty text without control characters.');
    enumValue(node.scale, LEVELS, 'node.scale'); enumValue(node.representation, ['fixture', 'source_referenced', 'conceptual'], 'node.representation');
    check(!['galaxy', 'universe'].includes(node.scale) || node.representation === 'conceptual', 'CONCEPTUAL_SCALE_REQUIRED', 'Galaxy and universe remain conceptual in this profile.');
    check(input.sourceMode !== 'fixture' || node.representation !== 'source_referenced', 'SOURCE_MODE_CONFLICT', 'A fixture cannot claim a source-referenced node.');
    const members = uniqueStrings(node.members, LIMITS.nodes, 'node.members'); memberships += members.length;
    check(memberships <= LIMITS.memberships, 'INPUT_LIMIT', 'Too many membership edges.');
    if (node.scale === 'single_cell') {
      identifier(node.caiId, 'caiId');
      check(!caiIds.has(node.caiId), 'DUPLICATE_CAI', 'A CAI identity must have one canonical node.'); caiIds.add(node.caiId);
      check(members.length === 0, 'CELL_HAS_MEMBERS', 'A single CAI node cannot contain members.');
    } else check(node.caiId === null, 'COMPOSITE_CAI_ID', 'A functional aggregate cannot create a CAI identity.');
    const historyRefs = refs(node.historyRefs);
    check(historyRefs.every(item => normalizedHistory.refs.some(other => refKey(other) === refKey(item) && other.digest === item.digest)), 'HISTORY_SNAPSHOT_MISMATCH', 'Node history is not referenced by this snapshot.');
    check(node.representation !== 'source_referenced' || historyRefs.length > 0, 'SOURCE_REFERENCE_REQUIRED', 'Referenced nodes need source history references.');
    const entityIds = uniqueStrings(node.physicalEntityIds, LIMITS.physicalEntities, 'node.physicalEntityIds');
    const displayIds = uniqueStrings(node.displayAssetIds, LIMITS.displayAssets, 'node.displayAssetIds');
    check(entityIds.every(id => physicalIds.has(id)) && displayIds.every(id => assetIds.has(id)), 'MISSING_REFERENCE', 'Node has an absent physical or display reference.');
    let infrastructure = null;
    if (node.infrastructure !== null) {
      exact(node.infrastructure, ['kind', 'id', 'domain'], 'infrastructure');
      enumValue(node.infrastructure.kind, ['cell', 'field', 'region', 'planet'], 'infrastructure.kind');
      identifier(node.infrastructure.id, 'infrastructure.id'); identifier(node.infrastructure.domain, 'infrastructure.domain');
      infrastructure = { ...node.infrastructure };
    }
    let formation = null;
    if (node.formation !== null) {
      check(node.scale !== 'single_cell' && node.representation !== 'conceptual', 'INVALID_FORMATION', 'Only a concrete composite can reference formation evidence.');
      exact(node.formation, ['version', 'memberRoot', 'functionContract', 'historyRefs', 'evidenceRefs', 'assessment', 'recovery', 'resourceConstraints', 'responsibilityBoundary', 'exitRule'], 'formation');
      identifier(node.formation.version, 'formation.version');
      check(typeof node.formation.memberRoot === 'string' && HASH.test(node.formation.memberRoot), 'INVALID_DIGEST', 'Formation needs an exact member commitment.');
      formation = { version: node.formation.version, memberRoot: node.formation.memberRoot };
      for (const key of ['functionContract', 'assessment', 'recovery', 'resourceConstraints', 'responsibilityBoundary', 'exitRule']) formation[key] = ref(node.formation[key]);
      formation.historyRefs = refs(node.formation.historyRefs); formation.evidenceRefs = refs(node.formation.evidenceRefs);
      check(formation.historyRefs.length > 0 && formation.evidenceRefs.length > 0, 'INVALID_FORMATION', 'Formation requires history and evidence references.');
      check(formation.historyRefs.every(item => historyRefs.some(other => refKey(other) === refKey(item) && other.digest === item.digest)), 'FORMATION_HISTORY_MISMATCH', 'Formation history must be bound to node history.');
    }
    return { ...node, members, historyRefs, physicalEntityIds: entityIds, displayAssetIds: displayIds, infrastructure, issues: issues(node.issues), formation };
  }), node => node.id);
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) for (const member of node.members) {
    check(byId.has(member), 'MISSING_REFERENCE', 'Membership refers to an absent node.');
    check(LEVEL_INDEX.get(byId.get(member).scale) < LEVEL_INDEX.get(node.scale), 'INVALID_MEMBERSHIP_SCALE', 'Containment must descend strictly in functional scale.');
  }
  const relations = sorted(boundedArray(input.relations, LIMITS.relations, 'relations').map(relation => {
    exact(relation, ['id', 'kind', 'from', 'to', 'evidenceRefs', 'issues'], 'relation'); register(relation.id, 'relation.id');
    enumValue(relation.kind, ['depends_on', 'competes_with', 'shares_resource', 'conflicts_with'], 'relation.kind');
    check(byId.has(relation.from) && byId.has(relation.to), 'MISSING_REFERENCE', 'Relation endpoint is absent.');
    check(relation.from !== relation.to, 'SELF_RELATION', 'A relation needs two distinct nodes.');
    return { ...relation, evidenceRefs: refs(relation.evidenceRefs), issues: issues(relation.issues) };
  }), relation => relation.id);
  const normalized = { ...input, history: normalizedHistory, nodes, physicalEntities, displayAssets, relations };
  const sourceDigest = await digest('source-snapshot', normalized);
  const origins = new Map();
  const registerIssue = (issue, nodeIds, relationIds) => {
    if (issue.status !== 'open') return;
    let origin = origins.get(issue.id);
    if (!origin) { origin = { issue, nodeIds: new Set(), relationIds: new Set() }; origins.set(issue.id, origin); }
    nodeIds.forEach(id => origin.nodeIds.add(id)); relationIds.forEach(id => origin.relationIds.add(id));
  };
  nodes.forEach(node => node.issues.forEach(issue => registerIssue(issue, [node.id], [])));
  relations.forEach(relation => relation.issues.forEach(issue => registerIssue(issue, [relation.from, relation.to], [relation.id])));
  const descendants = new Map();
  const visit = (id, active = new Set()) => {
    if (descendants.has(id)) return descendants.get(id);
    check(!active.has(id), 'MEMBERSHIP_CYCLE', 'Membership cycle detected.');
    active.add(id); const result = new Set([id]);
    byId.get(id).members.forEach(member => visit(member, active).forEach(child => result.add(child)));
    active.delete(id); descendants.set(id, result); return result;
  };
  const projectedNodes = []; let projectionEntries = 0; let projectedBytes = 0;
  for (const node of nodes) {
    const reached = visit(node.id);
    const leaves = sorted([...reached].map(id => byId.get(id)).filter(child => child.scale === 'single_cell'), child => child.caiId);
    const memberBindings = leaves.map(child => ({ caiId: child.caiId, nodeId: child.id }));
    const membershipEdges = sorted([...reached].flatMap(id => byId.get(id).members.map(child => ({ parent: id, child }))), edge => `${edge.parent}\0${edge.child}`);
    const memberRoot = await digest('member-commitment', { domain: input.domain, nodeId: node.id, memberBindings, membershipEdges });
    check(!node.formation || memberBindings.length > 0, 'EMPTY_FORMATION', 'Formation references require an actual nonempty CAI member set.');
    check(!node.formation || node.formation.memberRoot === memberRoot, 'FORMATION_MEMBERSHIP_MISMATCH', 'Formation evidence is bound to a different membership.');
    const unresolvedIssues = sorted([...origins.values()].filter(origin => [...origin.nodeIds].some(id => reached.has(id))).map(origin => ({ ...origin.issue, originNodeIds: sorted(origin.nodeIds), originRelationIds: sorted(origin.relationIds) })), issue => issue.id);
    projectionEntries += memberBindings.length + membershipEdges.length + unresolvedIssues.reduce((count, issue) => count + 1 + issue.evidenceRefs.length + issue.originNodeIds.length + issue.originRelationIds.length, 0);
    check(projectionEntries <= LIMITS.projectionEntries, 'PROJECTION_LIMIT', 'Expanded projection exceeds its bounded membership/issue budget.');
    const reachedPhysical = new Set([...reached].flatMap(id => byId.get(id).physicalEntityIds));
    const coverage = { scope: 'provided_snapshot', memberCount: leaves.length, sourceReferencedMemberCount: leaves.filter(child => child.representation === 'source_referenced').length, fixtureMemberCount: leaves.filter(child => child.representation === 'fixture').length, conceptualMemberCount: leaves.filter(child => child.representation === 'conceptual').length, physicalEntityCount: reachedPhysical.size, physicalEntitiesWithSourceCount: physicalEntities.filter(entity => reachedPhysical.has(entity.id) && entity.sourceRefs.length > 0).length };
    const projectedNode = { ...node, memberRoot, memberCount: leaves.length, memberBindings, membershipEdges, coverage, unresolvedIssues, formationStatus: node.formation ? 'referenced_unverified' : 'none', sourceClassification: node.representation === 'source_referenced' ? 'source_referenced_unverified' : node.representation, permissionsInherited: false, globalCoverage: null };
    projectedBytes += encoder.encode(canonical(projectedNode)).length;
    check(projectedBytes <= LIMITS.outputBytes, 'PROJECTION_LIMIT', 'Expanded nodes exceed the output byte budget.');
    projectedNodes.push(projectedNode);
  }
  const renderPrimitiveCount = displayAssets.reduce((total, asset) => total + asset.primitiveCount, 0);
  check(Number.isSafeInteger(renderPrimitiveCount), 'COUNT_OVERFLOW', 'Combined rendering primitive count exceeds exact integer bounds.');
  const renderPrimitiveCountsByKind = Object.fromEntries(['3dgs', 'point_cloud', 'mesh', 'semantic'].map(kind => [kind, displayAssets.filter(asset => asset.kind === kind).reduce((total, asset) => total + asset.primitiveCount, 0)]));
  const output = {
    profile: WORLD_PROFILE, snapshotId: input.snapshotId, domain: input.domain, sourceMode: input.sourceMode, asOf: input.asOf,
    history: normalizedHistory, sourceDigest, derivedViewOnly: true, protocolTruth: false, executionAuthority: false, productionReady: false, authenticated: false,
    authenticationStatus: 'not_performed', authorityAdapterStatus: 'not_implemented', currentness: 'not_assessed', globalCoverage: null,
    snapshotCounts: { caiCount: caiIds.size, physicalEntityCount: physicalEntities.length, displayAssetCount: displayAssets.length, renderPrimitiveCount, renderPrimitiveCountsByKind, functionalNodeCount: nodes.length, relationCount: relations.length, unresolvedIssueCount: origins.size },
    nodes: projectedNodes, physicalEntities, displayAssets, relations,
  };
  check(encoder.encode(canonical(output)).length <= LIMITS.outputBytes, 'PROJECTION_LIMIT', 'Expanded projection exceeds its byte budget.');
  return freeze({ ...output, viewRoot: await digest('derived-view', output) });
}
