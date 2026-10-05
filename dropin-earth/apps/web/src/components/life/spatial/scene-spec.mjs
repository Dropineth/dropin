import { ROOMS } from './spatial-data.mjs';
/** Coordinates are drawing-derived SCENE UNITS, never surveyed meters. */
export const floorHeight = f => f==='1F' ? 0 : 5.5;
export const point = ([x,y])=>[(x-430)*.048,(y-445)*.048];
export function buildSpec() {
 const objects=[];
 const box=(name,room,loc,size,color,extra={})=>objects.push({name,room,floor:ROOMS.find(r=>r.id===room)?.floor??null,kind:'box',loc,size,color,...extra});
 const cylinder=(name,room,loc,radius,depth,color)=>objects.push({name,room,floor:ROOMS.find(r=>r.id===room)?.floor??null,kind:'cylinder',loc,radius,depth,color});
 const addSeat=(room,x,z,h,color)=>{box(`${room}_seat_${objects.length}`,room,[x,h+.38,z],[.62,.34,.65],color);box(`${room}_back_${objects.length}`,room,[x,h+.73,z+.28],[.62,.5,.12],color);};
 for(const r of ROOMS) {
  const h=floorHeight(r.floor); const poly=r.polygon.map(point);
  objects.push({name:r.id+'_footprint',room:r.id,floor:r.floor,kind:'polygon',polygon:poly,base:h,depth:.2,color:r.color,role:'floor',sourcePage:r.page});
  // Low translucent partitions: no asserted as-built height or door positions.
  for(let i=0;i<poly.length;i++) { const a=poly[i],b=poly[(i+1)%poly.length]; const dx=b[0]-a[0],dz=b[1]-a[1];
   box(`${r.id}_partition_${i}`,r.id,[(a[0]+b[0])/2,h+.82,(a[1]+b[1])/2],[Math.hypot(dx,dz),1.35,.045],'#cfdfed',{rotationY:-Math.atan2(dz,dx),glass:true});
   box(`${r.id}_rail_${i}`,r.id,[(a[0]+b[0])/2,h+1.52,(a[1]+b[1])/2],[Math.hypot(dx,dz),.055,.055],'#a3b4c7',{rotationY:-Math.atan2(dz,dx)});
  }
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
  if(r.id==='L112') {
   for(let i=0;i<2;i++){const rx=x-.85+i*1.6;box(`DEMO_ROBOT_${i+1}`,r.id,[rx,h+.52,z],[.65,.8,.68],'#f5f5fb');box(`${r.id}_robot_screen_${i}`,r.id,[rx,h+.64,z-.35],[.45,.22,.03],'#35304c');cylinder(`${r.id}_lidar_${i}`,r.id,[rx,h+1,z],.12,.12,'#23263a');for(const s of [-1,1])box(`${r.id}_wheel_${i}_${s}`,r.id,[rx+s*.28,h+.16,z],[.12,.23,.38],'#323646');}
   box('L112_maintenance',r.id,[x,h+.57,z+.65],[2.7,.16,.35],'#a9b7cf');
  }
  if(r.id==='L203') {
   for(let i=0;i<3;i++){box(`${r.id}_rack_${i}`,r.id,[x-1+i*.73,h+.95,z+.53],[.52,1.55,.44],'#2b334e');for(let j=0;j<4;j++)box(`${r.id}_status_${i}_${j}`,r.id,[x-1+i*.73,h+.55+j*.24,z+.30],[.3,.03,.02],'#9390e6');}
   box('L203_desk',r.id,[x,h+.62,z-.46],[2.05,.12,.64],'#eff1f4');box('L203_monitor',r.id,[x,h+.97,z-.43],[.66,.39,.04],'#3c3c69');addSeat(r.id,x,z-.95,h,'#6f647f');
  }
  if(r.id==='L202') {
   cylinder('L202_table',r.id,[x,h+.49,z],.52,.14,'#d9bfa3');cylinder('L202_table_stem',r.id,[x,h+.26,z],.1,.46,'#aaa498');for(const dx of [-.88,.88]){addSeat(r.id,x+dx,z-.35,h,'#acc5b7');addSeat(r.id,x+dx,z+.45,h,'#acc5b7');}
  }
  if(r.id==='L201') {
   box('L201_stage',r.id,[x,h+.26,z-.84],[3.6,.16,1.7],'#e8e6f3');box('L201_display',r.id,[x,h+1.22,z-1.7],[3.7,1.8,.13],'#45426a');box('L201_screen',r.id,[x,h+1.25,z-1.78],[3.25,1.35,.025],'#aca8df');
   for(let row=0;row<2;row++)for(let col=0;col<4;col++)addSeat(r.id,x-1.25+col*.78,z+.3+row*.95,h,'#bcc7b1');
  }
  // Generic plants are design placeholders, not a site inventory.
  const px=Math.max(...xs)-.42,pz=Math.min(...zs)+.65;
  cylinder(`${r.id}_planter`,r.id,[px,h+.35,pz],.2,.45,'#ece4d8');cylinder(`${r.id}_plant`,r.id,[px,h+.8,pz],.31,.55,'#7b9570');
 }
 return {schema:'lifepp.spatial.scene.v1',source:'User floorplan pp.2-3; manually interpreted footprints; schematic furniture',units:'schematic_scene_units',surveyed:false,navmesh:false,collisionMap:false,floorGapIsExplodedDiagram:true,generatedBy:'scene-spec.mjs',objects};
}
export const SCENE_SPEC=buildSpec();
