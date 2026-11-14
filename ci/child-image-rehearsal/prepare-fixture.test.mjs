import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {localAdminUrl,main} from './prepare-fixture.mjs';

test('fixture accepts only explicitly confirmed disposable loopback PostgreSQL URLs',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]']){
    assert.equal(localAdminUrl(`postgresql://fixture:temporary@${host}:5432/native_test`,'disposable-local-synthetic').hostname,host);
  }
  for(const url of [undefined,'not-url','https://fixture:temporary@localhost/native_test',
    'postgres://fixture:temporary@example.invalid/native_test','postgres://fixture:temporary@localhost/production',
    'postgres://fixture:temporary@localhost/native_test?sslmode=disable','postgres://fixture:temporary@localhost/native_test#fragment',
    'postgres://localhost/native_test','postgres://fixture:temporary@localhost/native_test%2Fother']){
    assert.throws(()=>localAdminUrl(url,'disposable-local-synthetic'));
  }
  assert.throws(()=>localAdminUrl('postgres://fixture:temporary@localhost/native_test',''));
});

test('invalid operations cannot load candidate code or connect',async()=>{
  for(const args of [[],['deploy','/missing','/missing'],['prepare','/missing'],['tls','/missing','/missing']]){
    await assert.rejects(main(args,{}),/REHEARSAL_FIXTURE_FAILED/);
  }
});

test('CLI rejects without printing credential/URL/path or underlying error',()=>{
  const result=spawnSync(process.execPath,[new URL('./prepare-fixture.mjs',import.meta.url).pathname,'prepare','/MUST_NOT_ECHO','/MUST_NOT_ECHO'],{
    encoding:'utf8',env:{PATH:process.env.PATH,REHEARSAL_CONFIRM:'disposable-local-synthetic',REHEARSAL_DATABASE_URL:'postgres://fixture:MUST_NOT_ECHO@external.invalid/test'},timeout:5000,
  });
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  assert.equal(result.stderr,'REHEARSAL_FIXTURE_FAILED\n');
});
