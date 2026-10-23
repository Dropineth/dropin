import assert from 'node:assert/strict';
import test from 'node:test';
import { createChildDependencyGuard, type ChildOperationalSignal } from '../../services/api/src/domain/child-stewardship/dependency-guard.js';
import { ChildApiError } from '../../services/api/src/domain/child-stewardship/store.js';

const failure = () => Object.assign(new Error('secret path /protected/token?raw=value'),{code:'ECONNREFUSED'});
function fixture(){let time=Date.parse('2026-10-23T12:00:00Z');const signals:ChildOperationalSignal[]=[];return{guard:createChildDependencyGuard({emit:value=>signals.push(value),clock:()=>time}),signals,advance:(ms:number)=>{time+=ms;}};}
async function trip(guard:ReturnType<typeof createChildDependencyGuard>,actor='demo-child'){
  for(let i=0;i<3;i++)await assert.rejects(guard.run('private-session',actor,async()=>{throw failure();}));
}

test('three explicit storage failures open before any callback effect; no cached result substitutes DB',async()=>{
  const {guard,signals}=fixture();await trip(guard);let callbacks=0;
  await assert.rejects(guard.run('private-session','demo-child',async()=>{callbacks++;return 'effect';}),error=>error instanceof ChildApiError&&error.status===503&&error.code==='SERVICE_UNAVAILABLE');
  assert.equal(callbacks,0);assert.deepEqual(signals.map(s=>s.code),['STORAGE_FAILURE','STORAGE_FAILURE','STORAGE_FAILURE','CIRCUIT_OPEN']);
  for(const value of signals){assert.deepEqual(Object.keys(value).sort(),['category','code','count','time']);assert.equal(Object.isFrozen(value),true);}
  assert.doesNotMatch(JSON.stringify(signals),/secret|private-session|demo-child|protected|raw=value|ECONNREFUSED/);
});

test('guardian observations are identical with and without protected actor circuit activity',async()=>{
  const ordinary=fixture(),protectedTraffic=fixture();await trip(protectedTraffic.guard,'demo-protector');
  const observe=async(guard:typeof ordinary.guard)=>{const results:string[]=[];for(let i=0;i<5;i++)results.push(await guard.run('private-session','demo-guardian',async()=>`guardian-${i}`));return results;};
  assert.deepEqual(await observe(ordinary.guard),await observe(protectedTraffic.guard));
  await trip(protectedTraffic.guard,'demo-guardian');
  assert.equal(await protectedTraffic.guard.run('private-session','demo-child',async()=>'report accepted'),'report accepted');
  assert.equal(await protectedTraffic.guard.run('another-session','demo-guardian',async()=>'other tenant'),'other tenant');
});

test('domain denials including 503 and integrity errors do not open dependency circuit',async()=>{
  const {guard,signals}=fixture();
  for(const error of [new ChildApiError('FORBIDDEN',403),new ChildApiError('RIGHTS_UNVERIFIED',503),Object.assign(new Error('constraint'),{code:'23505'}),new Error('domain')]){
    for(let i=0;i<5;i++)await assert.rejects(guard.run('s','actor',async()=>{throw error;}),value=>value===error);
  }
  assert.equal(await guard.run('s','actor',async()=>true),true);assert.deepEqual(signals,[]);
});

test('half-open permits one concurrent probe and recovery requires actual successful callback',async()=>{
  const {guard,advance,signals}=fixture();await trip(guard);advance(15_000);
  let complete!:(value:string)=>void;let callbacks=0;
  const probe=guard.run('private-session','demo-child',()=>{callbacks++;return new Promise<string>(resolve=>{complete=resolve;});});
  await assert.rejects(guard.run('private-session','demo-child',async()=>{callbacks++;return 'duplicate';}),ChildApiError);
  assert.equal(callbacks,1);complete('fresh DB result');assert.equal(await probe,'fresh DB result');
  assert.equal(await guard.run('private-session','demo-child',async()=>'new request'),'new request');
  assert.equal(signals.at(-1)?.code,'CIRCUIT_RECOVERED');
});

test('domain throw releases probe without fabricating recovery and failed probe reopens',async()=>{
  const {guard,advance,signals}=fixture();await trip(guard);advance(15_000);
  await assert.rejects(guard.run('private-session','demo-child',async()=>{throw new ChildApiError('FORBIDDEN',403);}),ChildApiError);
  assert.equal(signals.some(value=>value.code==='CIRCUIT_RECOVERED'),false);
  await assert.rejects(guard.run('private-session','demo-child',async()=>{throw failure();}));
  let ran=false;await assert.rejects(guard.run('private-session','demo-child',async()=>{ran=true;}),ChildApiError);assert.equal(ran,false);
  advance(15_000);assert.equal(await guard.run('private-session','demo-child',async()=>true),true);
});

test('older concurrent success cannot close a newly opened circuit; logger failures do not change outcomes',async()=>{
  const {guard}=fixture();let finish!:()=>void;
  const old=guard.run('private-session','demo-child',()=>new Promise<void>(resolve=>{finish=resolve;}));
  await trip(guard);finish();await old;
  await assert.rejects(guard.run('private-session','demo-child',async()=>true),ChildApiError);
  const brokenLogger=createChildDependencyGuard({emit:()=>{throw new Error('logger down');}});const error=failure();
  await assert.rejects(brokenLogger.run('s','a',async()=>{throw error;}),value=>value===error);
});

test('tracking exhaustion never evicts another actor or replaces database authorization; stale records expire',async()=>{
  const {guard,advance}=fixture();await trip(guard);
  for(let i=0;i<2047;i++)await assert.rejects(guard.run('bounded-session',`actor-${i}`,async()=>{throw failure();}));
  let calls=0;
  for(let i=0;i<4;i++)await assert.rejects(guard.run('new-session','new-actor',async()=>{calls++;throw failure();}));
  assert.equal(calls,4,'a full tracking map still executes the real dependency, without fallback');
  await assert.rejects(guard.run('private-session','demo-child',async()=>true),ChildApiError);
  advance(60_000);
  await trip(guard,'fresh-actor');
  await assert.rejects(guard.run('private-session','fresh-actor',async()=>true),ChildApiError);
});
