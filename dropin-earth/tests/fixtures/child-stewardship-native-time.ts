import {createSyntheticRightsFixture as createHistoricalFixture,type SyntheticRightsClock} from './child-stewardship-rights.js';

const YEAR_MS=365*86_400_000;
/** Native services advance against real execution/SQL time. Keep one recorded
 * instant per test process without changing Date.now, SQL clocks or production guards.
 * Pure unit fixtures retain their historical deterministic clock by default. */
export function nativeRightsClock(instant=new Date().toISOString()):SyntheticRightsClock {
  const time=Date.parse(instant);
  if(!Number.isFinite(time))throw new Error('INVALID_NATIVE_FIXTURE_INSTANT');
  return {now:new Date(time).toISOString(),before:new Date(time-YEAR_MS).toISOString(),after:new Date(time+YEAR_MS).toISOString()};
}
const clock=nativeRightsClock();
export const {now,before,after}=clock;
export const nativeTimeAfter=(milliseconds:number)=>new Date(Date.parse(now)+milliseconds).toISOString();
export function createSyntheticRightsFixture(){return createHistoricalFixture(clock);}
