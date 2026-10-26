import assert from 'node:assert/strict';
import test from 'node:test';
import {createSyntheticRightsFixture,now as historicalNow} from '../fixtures/child-stewardship-rights.js';
import {nativeRightsClock} from '../fixtures/child-stewardship-native-time.js';

test('native fixture time supports future executions without changing historical unit fixtures or expiry guards',()=>{
  assert.equal(createSyntheticRightsFixture().context.now,historicalNow);
  for(const instant of ['2026-10-26T15:00:00Z','2028-02-29T23:59:59Z','2036-01-01T00:00:00Z']){
    const clock=nativeRightsClock(instant),f=createSyntheticRightsFixture(clock),state=f.funded(),payment=f.payment();
    assert.equal(f.context.now,new Date(instant).toISOString());
    assert.equal(f.apply(state,payment,['g','r1','t']).payments['payout-a']!.status,'submitted');
    const before=JSON.stringify(state);
    f.context.now=new Date(Date.parse(clock.after)+1).toISOString();
    assert.throws(()=>f.apply(state,payment,['g','r1','t']),/AUTHORIZATION_EXPIRED/);
    assert.equal(JSON.stringify(state),before,'Expired signed intent produces no journal, balance or outbox change');
  }
  assert.equal(createSyntheticRightsFixture().context.now,historicalNow);
  assert.throws(()=>nativeRightsClock('invalid'),/INVALID_NATIVE_FIXTURE_INSTANT/);
});
