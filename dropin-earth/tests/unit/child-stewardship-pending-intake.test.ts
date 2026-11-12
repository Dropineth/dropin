import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createSyntheticBeneficiarySubject, createSyntheticPendingIntake,
  parseSyntheticBeneficiarySubject, parseSyntheticPendingIntake, PendingIntakeBoundaryError,
} from '../../services/api/src/domain/child-stewardship/pending-intake.js';
import { applyRightsOperation } from '../../services/api/src/domain/child-stewardship/rights.js';
import type { RightsOperation } from '../../services/api/src/domain/child-stewardship/rights-types.js';
import { createSyntheticRightsFixture } from '../fixtures/child-stewardship-rights.js';

const context = Object.freeze({ environment: 'SIMULATION_ONLY', receivedAt: '2026-11-12T00:00:00.000Z', retentionMs: 86_400_000 });
const input = Object.freeze({ category: 'general_support_review', subjectRef: null });
const reject = (action: () => unknown) => assert.throws(action, error => error instanceof PendingIntakeBoundaryError && error.message === 'SYNTHETIC_PENDING_INTAKE_BOUNDARY');

test('device-free subjects require no child key, CAI, AHIN, learning or guardian claim', () => {
  const a = createSyntheticBeneficiarySubject(context), b = createSyntheticBeneficiarySubject(context);
  assert.notEqual(a.subjectRef, b.subjectRef);
  assert.match(a.subjectRef, /^synthetic-subject:[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(a).sort(), ['createdAt', 'environment', 'identityStatus', 'schema', 'subjectRef']);
  assert.equal(a.identityStatus, 'unverified');
  assert.equal(a.environment, 'SIMULATION_ONLY');
});

test('intake can precede a subject, and an association never verifies identity or ownership', () => {
  const pending = createSyntheticPendingIntake(input, context);
  assert.equal(pending.subjectRef, null);
  assert.equal(pending.subjectAssociation, 'unassigned');
  const subject = createSyntheticBeneficiarySubject(context);
  const associated = createSyntheticPendingIntake({ ...input, subjectRef: subject.subjectRef }, context);
  assert.equal(associated.subjectAssociation, 'unverified');
  assert.equal(associated.authority, 'none');
  assert.equal(associated.status, 'pending_review');
  assert.equal(associated.source, 'synthetic-test-fixture');
  assert.notEqual(associated.intakeRef, pending.intakeRef);
});

test('missing, real or weakened execution context stays closed', () => {
  for (const bad of [undefined, null, {}, { ...context, environment: 'PRODUCTION' }, { ...context, environment: 'synthetic-demo' }, { ...context, guardianVerified: true }]) {
    reject(() => createSyntheticBeneficiarySubject(bad));
    reject(() => createSyntheticPendingIntake(input, bad));
  }
});

test('strict inputs reject PII, free text, agent authority, financial promises and signatures', () => {
  const fields = ['name', 'birthday', 'contact', 'location', 'document', 'metadata', 'evidence', 'deviceId', 'guardianVerified', 'childAssent', 'signature', 'caiAgent', 'ahinParticipant', 'amountMinor', 'currency', 'legalState', 'consent', 'intakeRef', 'receivedAt'];
  for (const field of fields) {
    reject(() => createSyntheticPendingIntake({ ...input, [field]: { private: 'fixture-only-invalid-value' } }, context));
  }
  for (const bad of ['free text', { nested: 'fixture' }, ['general_support_review'], null, undefined]) reject(() => createSyntheticPendingIntake({ ...input, category: bad }, context));
});

test('persisted-shape parsers reject elevation, extra data and synthetic scope removal', () => {
  const subject = createSyntheticBeneficiarySubject(context), pending = createSyntheticPendingIntake(input, context);
  for (const bad of [{ ...subject, identityStatus: 'verified' }, { ...subject, environment: 'PRODUCTION' }, { ...subject, deviceId: 'fixture' }, { ...subject, schema: 'unknown' }]) reject(() => parseSyntheticBeneficiarySubject(bad));
  for (const bad of [{ ...pending, authority: 'approved' }, { ...pending, status: 'claimed' }, { ...pending, environment: 'PRODUCTION' }, { ...pending, source: 'legal-guardian' }, { ...pending, subjectAssociation: 'verified' }, { ...pending, amountMinor: 1 }, { ...pending, schema: 'unknown' }]) reject(() => parseSyntheticPendingIntake(bad));
});

test('only explicitly synthetic opaque references are allowed, never names, URLs or key IDs', () => {
  const subject = createSyntheticBeneficiarySubject(context), pending = createSyntheticPendingIntake(input, context);
  for (const bad of ['fixture-name', 'https://example.invalid/child', 'device:fixture', 'synthetic-subject:00000000-0000-0000-0000-000000000000', subject.subjectRef.toUpperCase(), undefined, 123, {}]) {
    reject(() => createSyntheticPendingIntake({ ...input, subjectRef: bad }, context));
    reject(() => parseSyntheticBeneficiarySubject({ ...subject, subjectRef: bad }));
  }
  reject(() => parseSyntheticPendingIntake({ ...pending, intakeRef: subject.subjectRef }));
  reject(() => parseSyntheticPendingIntake({ ...pending, subjectRef: subject.subjectRef }));
});

test('timestamps are canonical UTC and fixture retention is positive and capped at seven days', () => {
  for (const receivedAt of ['invalid', '2026-11-12', '2026-11-12T00:00:00+00:00', '2026-02-30T00:00:00.000Z', 0, null]) reject(() => createSyntheticBeneficiarySubject({ ...context, receivedAt }));
  for (const retentionMs of [0, -1, 0.1, NaN, Infinity, '1000', 604_800_001]) reject(() => createSyntheticPendingIntake(input, { ...context, retentionMs }));
  reject(() => createSyntheticPendingIntake(input, { ...context, receivedAt: '+275760-09-13T00:00:00.000Z' }));
  const pending = createSyntheticPendingIntake(input, context);
  assert.equal(pending.expiresAt, '2026-11-13T00:00:00.000Z');
  for (const expiresAt of [pending.receivedAt, '2026-11-11T00:00:00.000Z', '2026-11-20T00:00:00.000Z', 'invalid']) reject(() => parseSyntheticPendingIntake({ ...pending, expiresAt }));
  const maximum = createSyntheticPendingIntake({ ...input, category: 'education_support_review' }, { ...context, retentionMs: 604_800_000 });
  assert.equal(maximum.expiresAt, '2026-11-19T00:00:00.000Z');
});

test('parsing expired fixture data does not renew expiry or confer present-time access', () => {
  const pending = createSyntheticPendingIntake(input, { ...context, receivedAt: '2020-01-01T00:00:00.000Z' });
  assert.deepEqual(parseSyntheticPendingIntake(JSON.parse(JSON.stringify(pending))), pending);
  assert.equal(pending.expiresAt, '2020-01-02T00:00:00.000Z');
  assert.equal(pending.authority, 'none');
});

test('getters, hidden fields, symbols, arrays, inherited objects and nested fields are rejected', () => {
  let accessed = false;
  const getter = { subjectRef: null, get category() { accessed = true; return 'general_support_review'; } };
  reject(() => createSyntheticPendingIntake(getter, context));
  assert.equal(accessed, false);
  for (const bad of [[], new Date(), Object.create(input), { ...input, [Symbol('private')]: 'fixture' }, Object.defineProperty({ ...input }, 'private', { value: 'fixture' }), { ...input, subjectRef: { nested: 'fixture' } }]) reject(() => createSyntheticPendingIntake(bad, context));
  const nullPrototype = Object.assign(Object.create(null), input);
  assert.equal(createSyntheticPendingIntake(nullPrototype, context).authority, 'none');
});

test('outputs are immutable copies and rejects never echo supplied values', () => {
  const subject = createSyntheticBeneficiarySubject(context), pending = createSyntheticPendingIntake(input, context);
  const parsedSubject = parseSyntheticBeneficiarySubject(subject), parsed = parseSyntheticPendingIntake(pending);
  assert.notEqual(parsedSubject, subject); assert.notEqual(parsed, pending);
  assert.ok(Object.isFrozen(parsedSubject)); assert.ok(Object.isFrozen(parsed));
  assert.throws(() => Object.assign(parsed, { authority: 'approved' }), TypeError);
  assert.deepEqual(input, { category: 'general_support_review', subjectRef: null });
  reject(() => createSyntheticPendingIntake({ ...input, private: 'DO_NOT_ECHO_FIXTURE' }, context));
});

test('parsers use one descriptor snapshot, never changing Proxy property reads', () => {
  const subject = createSyntheticBeneficiarySubject(context), pending = createSyntheticPendingIntake(input, context);
  let reads = 0;
  const proxy = new Proxy({ ...subject }, { get(target, property) { reads++; return property === 'createdAt' ? 'DO_NOT_ECHO_FIXTURE' : Reflect.get(target, property); } });
  assert.deepEqual(parseSyntheticBeneficiarySubject(proxy), subject);
  assert.equal(reads, 0);
  const malformed = new Proxy({ ...pending }, { getOwnPropertyDescriptor(target, property) { const descriptor = Reflect.getOwnPropertyDescriptor(target, property); return property === 'receivedAt' ? { ...descriptor, value: 'DO_NOT_ECHO_FIXTURE' } : descriptor; } });
  reject(() => parseSyntheticPendingIntake(malformed));
});

test('throwing reflection traps and revoked Proxies disclose only the fixed boundary error', () => {
  const privateError = () => { throw new Error('DO_NOT_ECHO_FIXTURE'); };
  for (const traps of [{ getPrototypeOf: privateError }, { ownKeys: privateError }, { getOwnPropertyDescriptor: privateError }]) {
    reject(() => createSyntheticPendingIntake(new Proxy({ ...input }, traps), context));
    reject(() => createSyntheticBeneficiarySubject(new Proxy({ ...context }, traps)));
    reject(() => parseSyntheticBeneficiarySubject(new Proxy({}, traps)));
    reject(() => parseSyntheticPendingIntake(new Proxy({}, traps)));
  }
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  reject(() => parseSyntheticPendingIntake(revoked.proxy));
});

test('intake and subject are rejected by the actual rights executor with no state mutation', () => {
  const fixture = createSyntheticRightsFixture(), state = fixture.funded(), before = structuredClone(state);
  for (const record of [createSyntheticBeneficiarySubject(context), createSyntheticPendingIntake(input, context)]) {
    assert.throws(() => applyRightsOperation(state, record as unknown as RightsOperation, [], fixture.context));
    assert.deepEqual(state, before);
  }
});

test('model exports no claim, merge, account, persistence or approval adapter', async () => {
  const api = await import('../../services/api/src/domain/child-stewardship/pending-intake.js');
  assert.deepEqual(Object.keys(api).sort(), ['PendingIntakeBoundaryError', 'createSyntheticBeneficiarySubject', 'createSyntheticPendingIntake', 'parseSyntheticBeneficiarySubject', 'parseSyntheticPendingIntake']);
  for (const file of ['services/api/src/domain/child-stewardship/store.ts', 'services/api/src/child-backend/app.ts', 'services/api/src/routes/child-stewardship/index.ts']) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*pending-intake/);
  }
});
