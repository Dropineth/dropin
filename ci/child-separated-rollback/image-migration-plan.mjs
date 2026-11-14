import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = /^[a-f0-9]{64}$/;
const basename = /^child-stewardship(?:-[a-z-]+)?\.sql$/;
const addition = 'child-stewardship-outbox-hold.sql';
const hash = text => createHash('sha256').update(text).digest('hex');

export function verifyImagePlan({baseline, manifest, files, reviewedSql}) {
  assert.equal(baseline.length,12);
  assert.equal(manifest.mode,'plan-only');
  assert.equal(manifest.createsRoles,false);
  assert.equal(manifest.grantsAuthority,false);
  assert.equal(new Set(baseline.map(x=>x.name)).size,12);
  assert.ok(!baseline.some(x=>x.name===addition));
  assert.ok(baseline.every(x=>basename.test(x.name)&&sha.test(x.digest)));
  const expected=[...baseline,{name:addition,digest:hash(reviewedSql)}];
  assert.deepEqual(manifest.migrations,expected);
  assert.deepEqual(Object.keys(files).sort(),expected.map(x=>x.name).sort());
  for(const item of expected)assert.equal(files[item.name],item.digest);
  return {priorMigrationDigestsMatch:12,packagedMigrationDigest:expected.at(-1).digest,extraMigrations:0};
}

export function ownerMigrationEnv(ownerDsn) {
  const u=new URL(ownerDsn);
  assert.equal(u.protocol,'postgresql:');
  assert.equal(u.hostname,'127.0.0.1');
  assert.match(u.username,/^oci_owner_[a-f0-9]{24}$/);
  assert.match(u.password,/^[a-f0-9]{64}$/);
  assert.equal(u.pathname,'/rehearsal_session_test');
  assert.equal(u.search,'');assert.equal(u.hash,'');
  assert.ok(Number(u.port)>0);
  u.hostname='rehearsal-pg';u.port='5432';
  return [
    'CHILD_MIGRATION_CONFIRM=apply-reviewed-synthetic-schema',
    'CHILD_DATABASE_CLASSIFICATION=synthetic-only',
    'CHILD_DATABASE_TLS=verify-full',
    'NODE_EXTRA_CA_CERTS=/rehearsal-ca.crt',
    'CHILD_MIGRATION_DATABASE_URL='+u.toString(),
    'CHILD_MIGRATION_EXPECTED_ROLE='+u.username,
    'CHILD_MIGRATION_EXPECTED_DATABASE=rehearsal_session_test'
  ].join('\n')+'\n';
}
