import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitSceneCamera,layoutSceneLabels,sceneZoomDistance} from '../../apps/web/src/components/life/spatial/spatial-scene.mjs';

const viewports=[
 {width:312,height:342,region:{left:10,top:76,right:261,bottom:312}},
 {width:327,height:342,region:{left:10,top:76,right:276,bottom:312}},
 {width:684,height:405,region:{left:10,top:80,right:628,bottom:375}},
 {width:862,height:480,region:{left:10,top:65,right:806,bottom:445}},
 {width:1190,height:555,region:{left:10,top:65,right:1134,bottom:520}},
];
for(const viewport of viewports)for(const pitch of [.48,.70,1.53])test(`Bound corners stay clear of caption/controls: ${viewport.width}px, pitch ${pitch}`,()=>{
 for(const [min,max] of [
  [[-15,-1,-8],[15,8,8]],
  [[-12,-4,-8],[11,6,6]],
  [[370,40,-80],[410,41,-79]],
 ]){
  const bounds=new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max));
  const yaw=.13,fit=fitSceneCamera(bounds,{...viewport,yaw,pitch});
  const camera=new THREE.PerspectiveCamera(38,viewport.width/viewport.height,.1,fit.maxDistance+100);
  camera.position.copy(fit.target).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(fit.distance));
  camera.lookAt(fit.target);camera.updateMatrixWorld(true);
  // Independent projection through Three's real camera, rather than restating the fit formula.
  for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
   const p=new THREE.Vector3(x,y,z).project(camera),px=(p.x+1)*viewport.width/2,py=(1-p.y)*viewport.height/2;
   assert(px>=viewport.region.left&&px<=viewport.region.right,`x=${px}`);
   assert(py>=viewport.region.top&&py<=viewport.region.bottom,`y=${py}`);
   assert(p.z>-1&&p.z<1,'geometry stays within clipping planes');
  }
 }
});

test('Zoom-out remains monotonic even when a narrow viewport requires more than the old 80-unit cap',()=>{
 const fit=fitSceneCamera(new THREE.Box3(new THREE.Vector3(-35,-3,-6),new THREE.Vector3(35,9,6)),viewports[0]);
 assert(fit.distance>80);
 let distance=fit.distance;
 for(let i=0;i<20;i++){const next=sceneZoomDistance(distance,1.22,fit.distance);assert(next>=distance);assert(next<=fit.maxDistance);distance=next;}
 assert.equal(distance,fit.maxDistance);
 assert(sceneZoomDistance(fit.distance,.82,fit.distance)<fit.distance);
 assert.equal(sceneZoomDistance(9,.82,fit.distance),9);
});

test('Camera fit rejects empty bounds or unusable viewports instead of returning a misleading default',()=>{
 assert.throws(()=>fitSceneCamera(new THREE.Box3(),viewports[0]),RangeError);
 const bounds=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
 assert.throws(()=>fitSceneCamera(bounds,{...viewports[0],width:0}),RangeError);
 assert.throws(()=>fitSceneCamera(bounds,{...viewports[0],region:{left:10,right:10,top:0,bottom:20}}),RangeError);
});

test('Four room labels that project into the caption are bounded and separated on mobile',()=>{
 const items=['L112','L203','L202','L201'].map(id=>({id,x:295,y:30,width:67,height:36}));
 const region=viewports[0].region,placed=layoutSceneLabels(items,region);
 assert.deepEqual(placed,layoutSceneLabels(items,region),'layout is deterministic');
 assert.equal(placed.filter(p=>!p.hidden).length,4);
 for(const p of placed){
  assert(p.left>=region.left&&p.left+p.width<=region.right);
  assert(p.top>=region.top&&p.top+p.height<=region.bottom);
  for(const q of placed)if(p.id!==q.id)assert(p.left+p.width+6<=q.left||q.left+q.width+6<=p.left||p.top+p.height+6<=q.top||q.top+q.height+6<=p.top);
 }
});

test('Seven network labels fit without obscuring the protected caption/control regions',()=>{
 const items=Array.from({length:7},(_,i)=>({id:String(i),x:100,y:100,width:110,height:32}));
 const placed=layoutSceneLabels(items,viewports[0].region);
 assert.equal(placed.filter(p=>!p.hidden).length,7);
});

test('Labels that cannot fit use the existing text-list alternative, never cover reserved UI',()=>{
 const placed=layoutSceneLabels([{id:'wide',x:0,y:0,width:400,height:50}],viewports[0].region);
 assert.equal(placed[0].hidden,true);
});
