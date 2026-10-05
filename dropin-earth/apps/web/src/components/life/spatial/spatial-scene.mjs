import * as THREE from 'three';
import {createRenderDriver} from './render-driver.mjs';
import {SchematicSoftwareRenderer} from './software-renderer.mjs';
import { ROOMS,NODES,EDGES,adjacentNodeIds } from './spatial-data.mjs';
import { SCENE_SPEC, floorHeight, point } from './scene-spec.mjs';

/** Fit authored scene bounds to an unobscured pixel rectangle, not surveyed dimensions. */
export function fitSceneCamera(bounds,{width,height,region,fov=38,yaw=.13,pitch=.70}) {
 if(bounds.isEmpty()||![width,height].every(n=>Number.isFinite(n)&&n>0)||
    !(region.right>region.left&&region.bottom>region.top))throw new RangeError('A nonempty scene viewport is required');
 const center=bounds.getCenter(new THREE.Vector3());
 const direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const up=new THREE.Vector3().crossVectors(direction,right);
 const ky=Math.tan(THREE.MathUtils.degToRad(fov)/2),kx=ky*width/height;
 const left=region.left/width*2-1,rgt=region.right/width*2-1;
 const bottom=1-region.bottom/height*2,top=1-region.top/height*2;
 const mx=(left+rgt)/2,my=(bottom+top)/2;let distance=9;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const delta=new THREE.Vector3(x,y,z).sub(center),px=delta.dot(right),py=delta.dot(up),pz=delta.dot(direction);
  distance=Math.max(distance,pz+1,(px/kx+rgt*pz)/(rgt-mx),(-px/kx-left*pz)/(mx-left),
   (py/ky+top*pz)/(top-my),(-py/ky-bottom*pz)/(my-bottom));
 }
 distance*=1.04;
 const target=center.clone().addScaledVector(right,-mx*distance*kx).addScaledVector(up,-my*distance*ky);
 return {target,distance,maxDistance:Math.max(80,distance*3)};
}

export function sceneZoomDistance(distance,factor,fitDistance) {
 return Math.max(9,Math.min(Math.max(80,fitDistance*3),distance*factor));
}

/** Finite deterministic placement; never cover captions, controls or another label. */
export function layoutSceneLabels(items,region,gap=6) {
 const placed=[];
 const result=items.map(item=>{
  const maxX=region.right-item.width,maxY=region.bottom-item.height;
  if(maxX<region.left||maxY<region.top)return {...item,hidden:true};
  const clampX=x=>Math.max(region.left,Math.min(maxX,x)),clampY=y=>Math.max(region.top,Math.min(maxY,y));
  const desiredX=clampX(item.x-item.width/2),desiredY=clampY(item.y-item.height);
  const xs=[...new Set([desiredX,region.left,maxX,...placed.flatMap(p=>[p.left-item.width-gap,p.left+p.width+gap])].map(clampX))];
  const ys=[...new Set([desiredY,region.top,maxY,...placed.flatMap(p=>[p.top-item.height-gap,p.top+p.height+gap])].map(clampY))];
  let best=null,score=Infinity;
  for(const left of xs)for(const top of ys){
   if(placed.some(p=>left<p.left+p.width+gap&&left+item.width+gap>p.left&&top<p.top+p.height+gap&&top+item.height+gap>p.top))continue;
   const nextScore=(left-desiredX)**2+(top-desiredY)**2;
   if(nextScore<score){score=nextScore;best={...item,left,top,hidden:false};}
  }
  if(best)placed.push(best);
  return best??{...item,hidden:true};
 });
 // Clustered projections can fragment a greedy layout. Try a finite uniform
 // packing only when it can show every label, preserving the text-list fallback.
 if(result.some(item=>item.hidden)){
  const width=Math.max(...items.map(item=>item.width)),height=Math.max(...items.map(item=>item.height));
  const columns=Math.floor((region.right-region.left+gap)/(width+gap));
  const rows=Math.floor((region.bottom-region.top+gap)/(height+gap));
  if(columns>0&&rows>0&&columns*rows>=items.length){
   const slots=Array.from({length:items.length},(_,i)=>({left:region.left+(i%columns)*(width+gap),top:region.top+Math.floor(i/columns)*(height+gap)}));
   return items.map(item=>{
    slots.sort((a,b)=>(a.left+item.width/2-item.x)**2+(a.top+item.height-item.y)**2-
     ((b.left+item.width/2-item.x)**2+(b.top+item.height-item.y)**2));
    return {...item,...slots.shift(),hidden:false};
   });
  }
 }
 return result;
}

/** One disposable, on-demand Three.js scene; no telemetry, routes or robot IO. */
export function createSpatialScene(host,{onSelect,onStatus,locale='zh'}={}) {
 const zh=locale==='zh'; let destroyed=false,driver=null,mode='space',floor='ALL',selected='L203',isTop=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#edf0f7');
 const camera=new THREE.PerspectiveCamera(38,1,.1,220);
 const labels=globalThis.document.createElement('div');labels.className='ls-labels';host.appendChild(labels);
 scene.add(new THREE.HemisphereLight('#eef3ff','#8893a5',2.5));
 const key=new THREE.DirectionalLight('#ffffff',3.3);key.position.set(-12,30,18);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-24;key.shadow.camera.right=24;key.shadow.camera.top=22;key.shadow.camera.bottom=-20;key.shadow.normalBias=.04;scene.add(key);
 const fill=new THREE.DirectionalLight('#d4ccff',1.1);fill.position.set(20,7,-10);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(130,130),new THREE.MeshStandardMaterial({color:'#e6eaf3',roughness:.88}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.05;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(72,48,'#bdc6d8','#d6deea');grid.position.y=-1.035;grid.material.transparent=true;grid.material.opacity=.42;scene.add(grid);
 const spatial=new THREE.Group(),network=new THREE.Group();scene.add(spatial,network);network.visible=false;
 const disposables=new Set(),pickMeshes=[],roomGroups=new Map(),nodeGroups=new Map(),labelRows=[];
 function material(color,opts={}) { const m=new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.08,...opts});disposables.add(m);return m; }
 const edgeMaterial=new THREE.LineBasicMaterial({color:'#9b94c7',transparent:true,opacity:.38});disposables.add(edgeMaterial);
 for(const r of ROOMS){const g=new THREE.Group();g.userData.id=r.id;spatial.add(g);roomGroups.set(r.id,g);}
 for(const def of SCENE_SPEC.objects){
  let geometry,loc=def.loc;
  if(def.kind==='polygon'){
   const shape=new THREE.Shape();def.polygon.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
   geometry=new THREE.ExtrudeGeometry(shape,{depth:def.depth,bevelEnabled:false});geometry.rotateX(-Math.PI/2);loc=[0,def.base,0];
  } else if(def.kind==='cylinder')geometry=new THREE.CylinderGeometry(def.radius,def.radius,def.depth,20);
  else geometry=new THREE.BoxGeometry(...def.size);
  disposables.add(geometry);
  const m=material(def.color,def.glass?{transparent:true,opacity:.18,depthWrite:false,roughness:.25,side:THREE.DoubleSide}:{});
  const mesh=new THREE.Mesh(geometry,m);mesh.position.set(...loc);if(def.rotationY)mesh.rotation.y=def.rotationY;
  mesh.name=def.name;mesh.userData={room:def.room,role:def.role||'placeholder',originalColor:def.color};mesh.castShadow=!def.glass;mesh.receiveShadow=true;
  roomGroups.get(def.room).add(mesh);pickMeshes.push(mesh);
  if(def.kind==='polygon'){const egeo=new THREE.EdgesGeometry(geometry);disposables.add(egeo);const edges=new THREE.LineSegments(egeo,edgeMaterial);edges.position.copy(mesh.position);roomGroups.get(def.room).add(edges);}
 }
 // A low neutral plinth marks diagram panels, not additional leased floor area.
 for(const [floorName,loc,size] of [['1F',[-11.8,-.28,2.25],[5.9,.35,3.5]],['2F',[6.3,5.2,1.95],[15.8,.35,9.4]]]){
  const geo=new THREE.BoxGeometry(...size);disposables.add(geo);const mesh=new THREE.Mesh(geo,material('#f8f9fc'));mesh.position.set(...loc);mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.floorPanel=floorName;spatial.add(mesh);
 }
 function label(id,title,caption,parent,position){
  const button=globalThis.document.createElement('button');button.type='button';button.className='ls-label';button.dataset.pick=id;button.innerHTML=`<span>${title}</span><small>${caption}</small>`;button.setAttribute('aria-label',zh?`选择 ${title}`:`Select ${title}`);button.addEventListener('click',()=>onSelect?.(id));labels.appendChild(button);labelRows.push({id,button,parent,position:new THREE.Vector3(...position)});
 }
 for(const r of ROOMS){const ps=r.polygon.map(point),xs=ps.map(p=>p[0]),zs=ps.map(p=>p[1]);label(r.id,r.id,`${r.area.toFixed(2)} m² · ${r.floor}`,roomGroups.get(r.id),[(Math.min(...xs)+Math.max(...xs))/2,floorHeight(r.floor)+2.25,Math.min(...zs)-.5]);}
 for(const n of NODES){
  const g=new THREE.Group();g.position.set(...n.position);g.userData.id=n.id;network.add(g);nodeGroups.set(n.id,g);
  const geo=new THREE.IcosahedronGeometry(n.id==='cai'?1.12:.68,2);disposables.add(geo);const mesh=new THREE.Mesh(geo,material(n.color,{metalness:.25,roughness:.3}));mesh.userData.node=n.id;mesh.castShadow=true;g.add(mesh);pickMeshes.push(mesh);
  const ringgeo=new THREE.TorusGeometry(n.id==='cai'?1.55:1.1,.045,8,60);disposables.add(ringgeo);const ring=new THREE.Mesh(ringgeo,material(n.color));ring.rotation.x=-Math.PI/2;ring.position.y=-.58;g.add(ring);
  label(n.id,zh?n.zh:n.en,n.caption,g,[n.position[0],n.position[1]+1.5,n.position[2]]);
 }
 const links=[];
 for(const [a,b]of EDGES){const av=new THREE.Vector3(...NODES.find(n=>n.id===a).position),bv=new THREE.Vector3(...NODES.find(n=>n.id===b).position),mid=av.clone().add(bv).multiplyScalar(.5);mid.y+=1.2;
  const curve=new THREE.QuadraticBezierCurve3(av,mid,bv);const geo=new THREE.TubeGeometry(curve,32,.034,5,false);disposables.add(geo);const m=material('#9b95c6',{transparent:true,opacity:.65});const mesh=new THREE.Mesh(geo,m);network.add(mesh);links.push({a,b,mesh});
 }
 const target=new THREE.Vector3(-1.6,3,1.5);let yaw=.13,pitch=.70,distance=31,fitDistance=31,defaultView=true;
 function viewportRegion(){
  const rect=host.getBoundingClientRect(),wrap=host.parentElement;
  const tag=wrap.querySelector('.ls-stage-tag')?.getBoundingClientRect();
  const controls=wrap.querySelector('.ls-stage-controls')?.getBoundingClientRect();
  const bottom=wrap.querySelector('.ls-stage-bottom')?.getBoundingClientRect();
  return {rect,region:{left:10,top:Math.max(10,tag?.height?tag.bottom-rect.top+10:10),
   right:Math.min(rect.width-10,controls?.width?controls.left-rect.left-10:rect.width-10),
   bottom:Math.min(rect.height-10,bottom?.height?bottom.top-rect.top-10:rect.height-10)}};
 }
 const rowVisible=row=>(mode==='space'?roomGroups.has(row.id)&&row.parent.parent===spatial:row.parent.parent===network)&&row.parent.visible;
 function fitDefault(rect,region){
  scene.updateMatrixWorld(true);const bounds=new THREE.Box3();
  (mode==='space'?spatial:network).traverseVisible(object=>{
   if(!object.geometry)return;if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
   bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  for(const row of labelRows)if(rowVisible(row))bounds.expandByPoint(row.position);
  if(bounds.isEmpty()||region.right<=region.left||region.bottom<=region.top)return;
  const fit=fitSceneCamera(bounds,{width:rect.width,height:rect.height,region,fov:camera.fov,yaw,pitch});
  target.copy(fit.target);distance=fitDistance=fit.distance;
  camera.far=Math.max(220,fit.maxDistance+bounds.getSize(new THREE.Vector3()).length()*2);camera.updateProjectionMatrix();
 }
 function cameraUpdate(){camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);}
 function draw(renderer){if(destroyed)return;const {rect,region}=viewportRegion();if(defaultView)fitDefault(rect,region);
  cameraUpdate();renderer.render(scene,camera);host.dataset.cameraDistance=String(distance);host.dataset.cameraFitDistance=String(fitDistance);
  const items=[];
  for(const row of labelRows){
   const p=row.position.clone().project(camera);const visible=rowVisible(row)&&p.z<1&&p.z>-1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;
   row.button.hidden=!visible;
   if(visible)items.push({id:row.id,row,x:(p.x*.5+.5)*rect.width,y:(-p.y*.5+.5)*rect.height,width:row.button.offsetWidth||80,height:row.button.offsetHeight||36});
  }
  for(const item of layoutSceneLabels(items,region)){
   const button=item.row.button;button.hidden=item.hidden;
   if(!item.hidden){button.style.left=`${item.left+item.width/2}px`;button.style.top=`${item.top+item.height}px`;button.classList.toggle('is-selected',selected===item.id);}
  }
 }
 function invalidate(){if(!destroyed)driver?.invalidate();}
 function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;driver?.resize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();reset();invalidate();}
 const ro=new globalThis.ResizeObserver(resize);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let drag=null;
 const down=e=>{if(e.button!==0&&e.button!==2)return;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button};e.currentTarget.setPointerCapture(e.pointerId);};
 const move=e=>{if(!drag)return;defaultView=false;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.button===2||e.shiftKey){target.x-=dx*distance/800;target.z-=dy*distance/800;}else{yaw-=dx*.007;pitch=Math.max(.15,Math.min(1.54,pitch+dy*.006));}drag.x=e.clientX;drag.y=e.clientY;invalidate();};
 const up=e=>{if(!drag)return;const click=drag.button===0&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5;drag=null;
  if(click){const r=e.currentTarget.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickMeshes).find(h=>{let p=h.object;while(p){if(!p.visible)return false;p=p.parent;}return true;});if(hit)onSelect?.(hit.object.userData.node||hit.object.userData.room);}
 };
 const wheel=e=>{e.preventDefault();defaultView=false;distance=sceneZoomDistance(distance,Math.exp(e.deltaY*.001),fitDistance);invalidate();};
 const context=e=>e.preventDefault(); const cancel=()=>{drag=null;};
 
 function releaseShadows(){scene.traverse(o=>{if(o.isLight&&o.shadow){o.shadow.dispose();o.shadow.map=null;o.shadow.mapPass=null;}});}
 function attach(renderer){const canvas=renderer.domElement;canvas.className='ls-canvas';canvas.setAttribute('aria-hidden','true');host.insertBefore(canvas,labels);
  const events=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',cancel],['wheel',wheel],['contextmenu',context]];
  for(const [name,fn] of events)canvas.addEventListener(name,fn,name==='wheel'?{passive:false}:undefined);
  return ()=>{drag=null;for(const [name,fn] of events)canvas.removeEventListener(name,fn);};
 }
 // WebGL remains disabled until separately accepted; no context is requested.
 driver=createRenderDriver({primaryEnabled:false,createPrimary:()=>new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'}),createFallback:()=>new SchematicSoftwareRenderer(),
  prepare(renderer){renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=!renderer.isSoftwareSchematic;renderer.shadowMap.type=THREE.PCFSoftShadowMap;},
  attach,render:draw,releaseOwnedTargets:releaseShadows,onStatus:(status)=>{if(!destroyed){onStatus?.(status);
   // The ready caption can wrap differently from its loading text; measure it again once.
   if(status==='ready'||status==='ready-software')invalidate();}}});

 function reset(){defaultView=true;yaw=mode==='space'?.13:.02;pitch=isTop?1.53:(mode==='space'?.70:.48);invalidate();}
 const api={
  setMode(value){mode=value==='network'?'network':'space';spatial.visible=mode==='space';network.visible=mode==='network';ground.position.y=mode==='space'?-1.05:-5;grid.position.y=ground.position.y+.015;reset();},
  setFloor(value){floor=value;for(const r of ROOMS)roomGroups.get(r.id).visible=floor==='ALL'||r.floor===floor;for(const obj of spatial.children)if(obj.userData.floorPanel)obj.visible=floor==='ALL'||obj.userData.floorPanel===floor;reset();},
  select(id){selected=id;for(const [r,g]of roomGroups)g.traverse(o=>{if(o.isMesh&&o.userData.role==='floor'){o.material.emissive.set(r===id?'#4e287d':'#000000');o.material.emissiveIntensity=r===id?.18:0;}});const near=adjacentNodeIds(id);for(const [n,g]of nodeGroups)g.scale.setScalar(n===id?1.16:1);for(const e of links){e.mesh.material.opacity=e.a===id||e.b===id?1:.2;}for(const row of labelRows)row.button.classList.toggle('is-dim',mode==='network'&&!near.has(row.id));invalidate();},
  zoom(factor){defaultView=false;distance=sceneZoomDistance(distance,factor,fitDistance);invalidate();},
  top(){isTop=!isTop;reset();},reset,
  focus(){defaultView=false;if(mode==='network'){const n=NODES.find(n=>n.id===selected);if(n)target.set(...n.position);}else{const r=ROOMS.find(r=>r.id===selected);if(r){const ps=r.polygon.map(point);target.set(ps.reduce((s,p)=>s+p[0],0)/ps.length,floorHeight(r.floor)+.5,ps.reduce((s,p)=>s+p[1],0)/ps.length);}}distance=18;invalidate();},
  setActive(value){driver.setActive(value);},
  info(){const renderer=driver.renderer();return {threeRevision:THREE.REVISION,renderer:renderer?(renderer.isSoftwareSchematic?'ThreeGeometryCanvas2D':'WebGLRenderer'):'None',calls:renderer?.info.render.calls??0,triangles:renderer?.info.render.triangles??0,geometries:renderer?.info.memory.geometries??0,source:'LOCAL_SCHEMATIC',externalActions:0,...driver.state()};},
  dispose(){if(destroyed)return;destroyed=true;ro.disconnect();try{driver.dispose();}finally{
    const resources=new Set(disposables);scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
    for(const item of resources){try{item.dispose();}catch{/* Finish the remaining owned cleanup. */}}
    labels.replaceChildren();labels.remove();delete host.dataset.cameraDistance;delete host.dataset.cameraFitDistance;scene.clear();pickMeshes.length=0;labelRows.length=0;
  }}
 };
 try{ro.observe(host);driver.start();resize();api.select(selected);return api;}catch(error){api.dispose();throw error;}
}
