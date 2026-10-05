import * as THREE from 'three';
/** Small local schematic fallback. Uses Three geometry/matrices, not WebGL.
 * Painter ordering is approximate: this is not a production PBR renderer.
 * No imagery, DOM-to-image capture, network, survey or navigation calculations.
 */
export class SchematicSoftwareRenderer {
 constructor(){this.domElement=globalThis.document.createElement('canvas');this.ctx=this.domElement.getContext('2d');if(!this.ctx)throw new Error('Canvas 2D unavailable');this.shadowMap={enabled:false};this.info={render:{calls:0,triangles:0},memory:{geometries:0}};this.width=1;this.height=1;this.ratio=1;this.isSoftwareSchematic=true;}
 setPixelRatio(r){this.ratio=Math.min(1.5,r);}
 setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
 render(scene,camera){const ctx=this.ctx,w=this.width,h=this.height;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);const background=ctx.createLinearGradient(0,0,w,h);background.addColorStop(0,'#f3f3fa');background.addColorStop(1,'#e2e8f3');ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);const cam=camera.getWorldPosition(new THREE.Vector3());
  const project=v=>v.clone().applyMatrix4(vp);const xy=v=>[(v.x*.5+.5)*w,(-v.y*.5+.5)*h];
  // A coordinate reference grid; deliberately not a geospatial or navigation grid.
  ctx.lineWidth=.55;ctx.strokeStyle='#bbc5d733';for(let i=-32;i<=32;i+=2){for(const pair of [[new THREE.Vector3(i,-1.07,-28),new THREE.Vector3(i,-1.07,28)],[new THREE.Vector3(-32,-1.07,i),new THREE.Vector3(32,-1.07,i)]]){const a=project(pair[0]),b=project(pair[1]);if(a.z>1||b.z>1)continue;const aa=xy(a),bb=xy(b);ctx.beginPath();ctx.moveTo(...aa);ctx.lineTo(...bb);ctx.stroke();}}
  const surfaces=[];let calls=0,triangles=0;const geos=new Set(),sun=new THREE.Vector3(-.5,1,.6).normalize(),fill=new THREE.Vector3(.7,.5,-.5).normalize();
  scene.traverseVisible(o=>{if(!o.isMesh||!o.geometry?.attributes?.position)return;if(o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width===130)return;
   const g=o.geometry,p=g.attributes.position,ix=g.index,m=Array.isArray(o.material)?o.material[0]:o.material;if(!m||m.visible===false)return;geos.add(g);calls++;
   const pts=Array.from({length:p.count},(_,i)=>new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld));const count=ix?ix.count:p.count;
   for(let i=0;i<count;i+=3){const a=pts[ix?ix.getX(i):i],b=pts[ix?ix.getX(i+1):i+1],c=pts[ix?ix.getX(i+2):i+2];if(!a||!b||!c)continue;const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize(),mid=a.clone().add(b).add(c).multiplyScalar(1/3);if(m.side!==THREE.DoubleSide&&normal.dot(cam.clone().sub(mid))<=0)continue;
    const pp=[project(a),project(b),project(c)];if(pp.some(v=>v.z>1||v.z<-1))continue;const color=m.color?.clone()||new THREE.Color('#bbc2d4');const intensity=.66+.32*Math.max(0,normal.dot(sun))+.10*Math.max(0,normal.dot(fill));color.multiplyScalar(intensity);if(m.emissive)color.add(m.emissive.clone().multiplyScalar(m.emissiveIntensity||0));color.convertLinearToSRGB();
    surfaces.push({pts:pp.map(xy),depth:pp.reduce((sum,v)=>sum+v.z,0)/3,opacity:m.transparent?(m.opacity??1):1,color:`rgb(${Math.round(Math.min(1,color.r)*255)},${Math.round(Math.min(1,color.g)*255)},${Math.round(Math.min(1,color.b)*255)})`,stroke:g.type==='BoxGeometry'&&!m.transparent});triangles++;
   }
  });
  surfaces.sort((a,b)=>b.depth-a.depth);for(const f of surfaces){ctx.globalAlpha=f.opacity;ctx.beginPath();ctx.moveTo(...f.pts[0]);ctx.lineTo(...f.pts[1]);ctx.lineTo(...f.pts[2]);ctx.closePath();ctx.fillStyle=f.color;ctx.fill();if(f.stroke){ctx.strokeStyle=f.color;ctx.lineWidth=.55;ctx.stroke();}}ctx.globalAlpha=1;this.info.render={calls,triangles};this.info.memory.geometries=geos.size;
 }
 dispose(){this.domElement.width=1;this.domElement.height=1;}
}
