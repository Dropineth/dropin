import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderDriver} from '../../apps/web/src/components/life/spatial/render-driver.mjs';
function setup(options={}) {
 const queue=new Map(),timers=new Map(),states=[],backends=[];let id=0,draws=0,failDraw=false,failSoftware=false,shadows=0;
 const make=(software=false)=>{
  if(software&&options.fallbackConstructorFailure)throw Error('fallback constructor');
  if(!software&&options.primaryConstructorFailure)throw Error('primary constructor');
  const listeners=new Map();const b={isSoftwareSchematic:software,debug:{},disposed:0,attached:0,removed:0,lost:false,
   domElement:{addEventListener(n,f){listeners.set(n,f);},removeEventListener(n){listeners.delete(n);},remove(){b.removed++;}},
   getContext(){return {isContextLost:()=>b.lost};},dispose(){b.disposed++;},setSize(){if(options.sizeFailure&&!software)throw Error('size');},
   event(n){listeners.get(n)?.({preventDefault(){}});},listenerCount:()=>listeners.size};
  backends.push(b);return b;
 };
 const driver=createRenderDriver({primaryEnabled:options.primaryEnabled,createPrimary:()=>make(false),createFallback:()=>make(true),prepare(){},
  render(b){draws++;if((!b.isSoftwareSchematic&&failDraw)||(b.isSoftwareSchematic&&failSoftware))throw Error('draw');},
  attach(b){b.attached++;return()=>{b.attached--;};},releaseOwnedTargets:()=>{shadows++;},onStatus:s=>states.push(s),
  schedule:f=>{queue.set(++id,f);return id;},cancel:i=>queue.delete(i),setTimer:f=>{timers.set(++id,f);return id;},clearTimer:i=>timers.delete(i)});
 const flush=()=>{const q=[...queue.values()];queue.clear();q.forEach(f=>f());};
 return {driver,states,backends,queue,timers,flush,draws:()=>draws,shadows:()=>shadows,
  fail(v=true){failDraw=v;},failSoftware(v=true){failSoftware=v;},expire(){const ts=[...timers.values()];timers.clear();ts.forEach(f=>f());}};
}
test('No ready is emitted before an actual completed draw',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();assert.deepEqual(h.states,['initializing']);assert.equal(h.draws(),0);h.flush();assert.equal(h.states.at(-1),'ready');assert.equal(h.driver.state().successfulFrames,1);h.driver.dispose();});
test('Zero-area hosts remain initializing without false ready',()=>{const h=setup();h.driver.start();h.flush();assert.equal(h.draws(),0);assert(!h.states.includes('ready'));h.driver.resize(100,80);h.flush();assert.equal(h.states.at(-1),'ready');h.driver.dispose();});
test('First draw failure switches once; only successful software frame is ready',()=>{const h=setup();h.fail();h.driver.resize(100,80);h.driver.start();h.flush();assert.deepEqual(h.states,['initializing','fallback-loading']);assert.equal(h.backends[0].disposed,1);assert.equal(h.backends[0].listenerCount(),0);h.flush();assert.equal(h.states.at(-1),'ready-software');assert(!h.states.includes('ready'));h.driver.dispose();});
test('Failure after ready leaves ready, keeps no stale primary canvas',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.flush();h.fail();h.driver.invalidate();h.flush();assert.equal(h.states.at(-1),'fallback-loading');assert.equal(h.backends[0].attached,0);assert.equal(h.backends[0].disposed,1);h.flush();assert.equal(h.states.at(-1),'ready-software');h.driver.dispose();});
test('Failed software frame is terminal, with no retry/RAF loop',()=>{const h=setup();h.fail();h.failSoftware();h.driver.resize(100,80);h.driver.start();h.flush();h.flush();assert.equal(h.states.at(-1),'unavailable');assert.equal(h.queue.size,0);h.driver.invalidate();h.driver.start();assert.equal(h.queue.size,0);assert.equal(h.backends.length,2);h.driver.dispose();});
test('Constructor failures also have a bounded text fallback',()=>{const h=setup({primaryConstructorFailure:true,fallbackConstructorFailure:true});h.driver.start();assert.equal(h.states.at(-1),'unavailable');assert.equal(h.backends.length,0);h.driver.dispose();});
test('WebGL construction failure allows software without premature readiness',()=>{const h=setup({primaryConstructorFailure:true});h.driver.resize(100,80);h.driver.start();assert.equal(h.states.at(-1),'fallback-loading');h.flush();assert.equal(h.states.at(-1),'ready-software');h.driver.dispose();});
test('Context restoration waits for a successful post-restoration draw',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.flush();const b=h.backends[0];b.event('webglcontextlost');assert.equal(h.states.at(-1),'context-lost');assert.equal(h.queue.size,0);b.event('webglcontextrestored');assert.equal(h.states.at(-1),'restoring');h.flush();assert.equal(h.states.at(-1),'ready');assert.equal(h.driver.state().successfulFrames,2);assert.equal(h.timers.size,0);h.driver.dispose();});
test('Failed restored draw falls back instead of asserting ready',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.flush();h.backends[0].event('webglcontextlost');h.fail();h.backends[0].event('webglcontextrestored');h.flush();assert.equal(h.states.at(-1),'fallback-loading');h.flush();assert.equal(h.states.at(-1),'ready-software');h.driver.dispose();});
test('Unrestored context expires once into fallback',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.flush();h.backends[0].event('webglcontextlost');h.expire();h.flush();assert.equal(h.states.at(-1),'ready-software');assert.equal(h.backends.length,2);h.driver.dispose();});
test('Shader compile error prevents ready even if render returns',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.backends[0].debug.onShaderError();h.flush();assert.equal(h.states.at(-1),'fallback-loading');assert(!h.states.includes('ready'));h.flush();assert.equal(h.states.at(-1),'ready-software');h.driver.dispose();});
test('Dispose is idempotent and releases owned shadows, targets and listeners',()=>{for(let i=0;i<20;i++){const h=setup();h.driver.resize(100,80);h.driver.start();h.flush();h.driver.invalidate();h.driver.dispose();h.driver.dispose();assert.equal(h.queue.size,0);assert.equal(h.timers.size,0);assert.equal(h.shadows(),1);assert.equal(h.backends[0].disposed,1);assert.equal(h.backends[0].listenerCount(),0);assert.equal(h.backends[0].attached,0);}});
test('Unmount during restoration clears its timer and pending callbacks',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.flush();h.backends[0].event('webglcontextlost');h.driver.dispose();h.expire();h.flush();assert.equal(h.backends.length,1);assert.equal(h.timers.size,0);assert.equal(h.driver.state().status,'disposed');});
test('Hidden panels stop RAF and active panels resume on-demand drawing',()=>{const h=setup();h.driver.resize(100,80);h.driver.start();h.driver.setActive(false);h.flush();assert.equal(h.draws(),0);h.driver.setActive(true);h.flush();assert.equal(h.draws(),1);h.driver.dispose();});
test('Resize failure is bounded and does not retain the primary backend',()=>{const h=setup({sizeFailure:true});h.driver.resize(100,80);h.driver.start();h.flush();assert.equal(h.states.at(-1),'ready-software');assert.equal(h.backends[0].disposed,1);h.driver.dispose();});

test('Website software-only policy does not construct a primary renderer',()=>{
 const h=setup({primaryEnabled:false,primaryConstructorFailure:true});
 h.driver.resize(100,80);h.driver.start();
 assert.deepEqual(h.states,['fallback-loading']);assert.equal(h.draws(),0);
 assert.equal(h.backends.length,1);assert.equal(h.backends[0].isSoftwareSchematic,true);
 h.flush();assert.equal(h.states.at(-1),'ready-software');
 assert(!h.states.includes('ready'));h.driver.dispose();
});
test('Software-only failure stops at text controls without trying WebGL',()=>{
 const h=setup({primaryEnabled:false});h.failSoftware();
 h.driver.resize(100,80);h.driver.start();h.flush();
 assert.equal(h.states.at(-1),'unavailable');assert.equal(h.backends.length,1);
 assert.equal(h.backends[0].isSoftwareSchematic,true);assert.equal(h.queue.size,0);
 h.driver.invalidate();h.flush();assert.equal(h.draws(),1);h.driver.dispose();
});
