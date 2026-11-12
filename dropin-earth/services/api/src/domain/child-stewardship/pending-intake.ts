import { randomUUID } from 'node:crypto';

/** Pure, unpersisted fixtures. These types are NOT accounts, identity evidence or rights. */
const subjectSchema = 'CanopyProof-SyntheticSubject/0.1' as const;
const intakeSchema = 'CanopyProof-SyntheticPendingIntake/0.1' as const;
const maximumFixtureRetentionMs = 7 * 24 * 60 * 60 * 1000;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const subjectPattern = new RegExp(`^synthetic-subject:${uuid}$`);
const intakePattern = new RegExp(`^synthetic-intake:${uuid}$`);

export type PendingIntakeCategory = 'general_support_review' | 'education_support_review';
export type SyntheticBeneficiarySubject = Readonly<{
  schema: typeof subjectSchema;
  environment: 'SIMULATION_ONLY';
  subjectRef: string;
  identityStatus: 'unverified';
  createdAt: string;
}>;
export type SyntheticPendingIntake = Readonly<{
  schema: typeof intakeSchema;
  environment: 'SIMULATION_ONLY';
  intakeRef: string;
  subjectRef: string | null;
  subjectAssociation: 'unassigned' | 'unverified';
  category: PendingIntakeCategory;
  source: 'synthetic-test-fixture';
  receivedAt: string;
  expiresAt: string;
  status: 'pending_review';
  authority: 'none';
}>;

export class PendingIntakeBoundaryError extends Error {
  constructor() { super('SYNTHETIC_PENDING_INTAKE_BOUNDARY'); }
}
function fail(): never { throw new PendingIntakeBoundaryError(); }

/** Refuse hidden/extra fields and getters, rather than silently retaining or stripping PII. */
function exactRecord(value: unknown, keys: string[]): Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return fail();
    const actual = Reflect.ownKeys(value);
    if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) return fail();
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail();
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    // A Proxy trap is not allowed to disclose arbitrary supplied exception text.
    return fail();
  }
}
function timestamp(value: unknown): number {
  if (typeof value !== 'string') return fail();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) return fail();
  return milliseconds;
}
function reference(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) return fail();
  return value;
}
function category(value: unknown): PendingIntakeCategory {
  if (value !== 'general_support_review' && value !== 'education_support_review') return fail();
  return value;
}
function fixtureContext(value: unknown): { receivedAt: string; expiresAt: string } {
  const context = exactRecord(value, ['environment', 'receivedAt', 'retentionMs']);
  if (context.environment !== 'SIMULATION_ONLY') return fail();
  const received = timestamp(context.receivedAt);
  const retention = context.retentionMs;
  if (typeof retention !== 'number' || !Number.isSafeInteger(retention) || retention <= 0 || retention > maximumFixtureRetentionMs) return fail();
  const expiry = received + retention;
  if (!Number.isFinite(new Date(expiry).getTime())) return fail();
  return { receivedAt: context.receivedAt as string, expiresAt: new Date(expiry).toISOString() };
}

/** Parsing validates shape only. A well-shaped reference is NEVER ownership or access proof. */
export function parseSyntheticBeneficiarySubject(value: unknown): SyntheticBeneficiarySubject {
  const record = exactRecord(value, ['schema', 'environment', 'subjectRef', 'identityStatus', 'createdAt']);
  if (record.schema !== subjectSchema || record.environment !== 'SIMULATION_ONLY' || record.identityStatus !== 'unverified') return fail();
  timestamp(record.createdAt);
  return Object.freeze({ schema: subjectSchema, environment: 'SIMULATION_ONLY', subjectRef: reference(record.subjectRef, subjectPattern), identityStatus: 'unverified', createdAt: record.createdAt as string });
}

/** No device, credential, guardian, learning, CAI or AHIN precondition. No reality claim. */
export function createSyntheticBeneficiarySubject(context: unknown): SyntheticBeneficiarySubject {
  const { receivedAt } = fixtureContext(context);
  return parseSyntheticBeneficiarySubject({ schema: subjectSchema, environment: 'SIMULATION_ONLY', subjectRef: `synthetic-subject:${randomUUID()}`, identityStatus: 'unverified', createdAt: receivedAt });
}

export function parseSyntheticPendingIntake(value: unknown): SyntheticPendingIntake {
  const record = exactRecord(value, ['schema', 'environment', 'intakeRef', 'subjectRef', 'subjectAssociation', 'category', 'source', 'receivedAt', 'expiresAt', 'status', 'authority']);
  if (record.schema !== intakeSchema || record.environment !== 'SIMULATION_ONLY' || record.source !== 'synthetic-test-fixture' || record.status !== 'pending_review' || record.authority !== 'none') return fail();
  const received = timestamp(record.receivedAt), expires = timestamp(record.expiresAt);
  if (expires <= received || expires - received > maximumFixtureRetentionMs) return fail();
  const subjectRef = record.subjectRef === null ? null : reference(record.subjectRef, subjectPattern);
  const subjectAssociation = subjectRef === null ? 'unassigned' : 'unverified';
  if (record.subjectAssociation !== subjectAssociation) return fail();
  return Object.freeze({ schema: intakeSchema, environment: 'SIMULATION_ONLY', intakeRef: reference(record.intakeRef, intakePattern), subjectRef, subjectAssociation, category: category(record.category), source: 'synthetic-test-fixture', receivedAt: record.receivedAt as string, expiresAt: record.expiresAt as string, status: 'pending_review', authority: 'none' });
}

/** Input contains only a category and optional unverified association, never child information. */
export function createSyntheticPendingIntake(input: unknown, context: unknown): SyntheticPendingIntake {
  const record = exactRecord(input, ['category', 'subjectRef']);
  const { receivedAt, expiresAt } = fixtureContext(context);
  return parseSyntheticPendingIntake({ schema: intakeSchema, environment: 'SIMULATION_ONLY', intakeRef: `synthetic-intake:${randomUUID()}`, subjectRef: record.subjectRef, subjectAssociation: record.subjectRef === null ? 'unassigned' : 'unverified', category: record.category, source: 'synthetic-test-fixture', receivedAt, expiresAt, status: 'pending_review', authority: 'none' });
}

// Intentionally no claim/approval/merge/payment, storage, HTTP, logging, or production-mode adapter.
