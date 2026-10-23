import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { ChildSqlClient, ChildSqlConnection, ChildRestoreAnchorProvider } from './postgres-store.js';
import { reconstructChildSnapshot, childExecutionTime, assertChildRestoreReady } from './postgres-store.js';
import { readChildLearningView, authorizeLearningInteraction } from './learning.js';
import type { LearningPrincipal, LearningState } from './learning-types.js';
import { ChildApiError } from './store.js';
import { syntheticMediaFixtures, type SyntheticMediaFixtureId } from './media-fixtures.js';

export const MEDIA_LIMITS=Object.freeze({inputBytes:262_144,inputPixels:4_194_304,inputDimension:4096,outputDimension:1024,outputBytes:2_097_152,decodeSeconds:2});
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const reject=(code:string):never=>{throw new ChildApiError(code,400);};
/** Strict containers prevent SVG, animation, concatenated files and trailing polyglots. */
function rasterContainer(bytes:Buffer):'png'|'jpeg'{
  if(bytes.length===0||bytes.length>MEDIA_LIMITS.inputBytes)throw new ChildApiError('MEDIA_BYTE_LIMIT',413);
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
    let offset=8,idat=false,first=true;
    while(offset+12<=bytes.length){
      const size=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8);
      if(size>MEDIA_LIMITS.inputBytes||offset+12+size>bytes.length)reject('MEDIA_INVALID_CONTAINER');
      if(first&&(kind!=='IHDR'||size!==13))reject('MEDIA_INVALID_CONTAINER');
      if(kind==='IHDR'){
        if(!first)reject('MEDIA_INVALID_CONTAINER');
        const width=bytes.readUInt32BE(offset+8),height=bytes.readUInt32BE(offset+12);
        if(!width||!height||width>MEDIA_LIMITS.inputDimension||height>MEDIA_LIMITS.inputDimension||width*height>MEDIA_LIMITS.inputPixels)throw new ChildApiError('MEDIA_PIXEL_LIMIT',413);
      }
      first=false;if(['acTL','fcTL','fdAT'].includes(kind))reject('MEDIA_ANIMATION_DISABLED');
      if(kind==='IDAT')idat=true;offset+=12+size;
      if(kind==='IEND'){if(size!==0||offset!==bytes.length||!idat)reject('MEDIA_INVALID_CONTAINER');return'png';}
    }
    return reject('MEDIA_INVALID_CONTAINER');
  }
  if(bytes[0]===0xff&&bytes[1]===0xd8){
    let offset=2;
    while(offset<bytes.length){
      if(bytes[offset]!==0xff)reject('MEDIA_INVALID_CONTAINER');while(bytes[offset]===0xff)offset++;
      const marker=bytes[offset++]!;
      if(marker===0xd9){if(offset!==bytes.length)reject('MEDIA_INVALID_CONTAINER');return'jpeg';}
      if(marker===0xd8||marker===0||marker===1||(marker>=0xd0&&marker<=0xd7)||offset+2>bytes.length)reject('MEDIA_INVALID_CONTAINER');
      const size=bytes.readUInt16BE(offset);if(size<2||offset+size>bytes.length)reject('MEDIA_INVALID_CONTAINER');offset+=size;
      if(marker===0xda){
        while(offset<bytes.length){
          if(bytes[offset]!==0xff){offset++;continue;}
          const next=bytes[offset+1];if(next===0||(next!==undefined&&next>=0xd0&&next<=0xd7)){offset+=2;continue;}break;
        }
      }
    }
    return reject('MEDIA_INVALID_CONTAINER');
  }
  return reject('MEDIA_RASTER_ONLY');
}
export type ProcessedSyntheticMedia={rawDigest:string;sanitizedDigest:string;pixelDigest:string;perceptualHashes:string[];width:number;height:number;sanitized:Buffer;index:Buffer;sourceFormat:'png'|'jpeg';evidenceLevel:'E0'};
/** Decoder primitive, not an upload authorization. The ingress below only supplies fixed fixtures. */
export async function processSyntheticMediaBytes(input:Uint8Array):Promise<ProcessedSyntheticMedia>{
  const bytes=Buffer.from(input),sourceFormat=rasterContainer(bytes);
  try{
    const options={failOn:'warning' as const,limitInputPixels:MEDIA_LIMITS.inputPixels,sequentialRead:true};
    const metadata=await sharp(bytes,options).metadata();
    if(metadata.format!==sourceFormat||(metadata.pages??1)!==1||!metadata.width||!metadata.height||metadata.width>MEDIA_LIMITS.inputDimension||metadata.height>MEDIA_LIMITS.inputDimension)reject('MEDIA_DIMENSIONS_OR_FORMAT');
    const decoded=await sharp(bytes,options).timeout({seconds:MEDIA_LIMITS.decodeSeconds}).autoOrient().resize({width:MEDIA_LIMITS.outputDimension,height:MEDIA_LIMITS.outputDimension,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
    const {width,height,channels}=decoded.info;if(channels!==3)reject('MEDIA_COLOURSPACE');
    const pixelDigest=hash(Buffer.concat([Buffer.from(`${width}:${height}:rgb8\0`),decoded.data]));
    const raw={width,height,channels:3 as const};
    const sanitized=await sharp(decoded.data,{raw}).png({compressionLevel:9,adaptiveFiltering:false}).toBuffer();
    if(sanitized.length>MEDIA_LIMITS.outputBytes)throw new ChildApiError('MEDIA_OUTPUT_LIMIT',413);
    const perceptualHashes:string[]=[];
    for(const crop of [1,0.8]){
      const w=Math.max(1,Math.floor(width*crop)),h=Math.max(1,Math.floor(height*crop));
      const tiny=await sharp(decoded.data,{raw}).extract({left:Math.floor((width-w)/2),top:Math.floor((height-h)/2),width:w,height:h}).resize(9,8,{fit:'fill'}).greyscale().raw().toBuffer();
      let bits=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits=(bits<<1n)|BigInt(tiny[y*9+x]!>tiny[y*9+x+1]!?1:0);
      perceptualHashes.push(bits.toString(16).padStart(16,'0'));
    }
    const sanitizedDigest=hash(sanitized),index=Buffer.from(JSON.stringify({version:1,pixelDigest,perceptualHashes,heuristicOnly:true,evidenceLevel:'E0'}));
    return{rawDigest:hash(bytes),sanitizedDigest,pixelDigest,perceptualHashes,width,height,sanitized,index,sourceFormat,evidenceLevel:'E0'};
  }catch(error){if(error instanceof ChildApiError)throw error;throw new ChildApiError('MEDIA_DECODE_REJECTED',400);}
}
export function perceptualDistance(a:string,b:string):number{
  if(!/^[a-f0-9]{16}$/.test(a)||!/^[a-f0-9]{16}$/.test(b))return reject('INVALID_PERCEPTUAL_HASH');
  let bits=BigInt(`0x${a}`)^BigInt(`0x${b}`),count=0;while(bits){count++;bits&=bits-1n;}return count;
}
export function rejectPublicMediaUpload():never{throw new ChildApiError('REAL_MEDIA_UPLOAD_DISABLED',503);}
async function load(db:ChildSqlConnection,session:string,principal:LearningPrincipal,requestedAt:string,started:number,restoreAnchor?:ChildRestoreAnchorProvider){
  await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_id',$2,true),set_config('app.child_device_id',$3,true),set_config('app.child_actor_epoch',$4,true),set_config('app.child_session_generation',$5,true)",[session,principal.actorId,principal.deviceId,String(principal.epoch),String(principal.sessionGeneration??0)]);
  const sessions=await db.query<{expires_at:Date}>("SELECT expires_at FROM child_stewardship.sessions WHERE id=$1::uuid AND storage_format='normalized-v2' FOR UPDATE",[session]);
  await assertChildRestoreReady(db,session,restoreAnchor);
  const now=childExecutionTime(requestedAt,started);if(!sessions[0]||sessions[0].expires_at.getTime()<=Date.parse(now))throw new ChildApiError('UNAUTHORIZED',401);
  const schema=await db.query<{installed:boolean}>("SELECT to_regclass('child_stewardship.session_resumption') IS NOT NULL installed");
  const resumed=schema[0]?.installed?(await db.query<{generation:string;state:string}>("SELECT generation::text,state FROM child_stewardship.session_resumption WHERE session_id=$1::uuid",[session]))[0]:undefined;
  if((resumed&&resumed.state!=='active')||Number(resumed?.generation??0)!==(principal.sessionGeneration??0))throw new ChildApiError('UNAUTHORIZED',401);
  const rows=await db.query<{domain:string;collection:string;record_id:string;payload:unknown;position:number}>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[session]);
  const state=reconstructChildSnapshot(rows,0).learning;readChildLearningView(state,principal,now);return{state,now};
}
function assignmentAuthority(state:LearningState,principal:LearningPrincipal,assignmentId:string,now:string){
  const assignment=state.assignments[assignmentId];if(!assignment)throw new ChildApiError('FORBIDDEN',403);
  const view=readChildLearningView(state,principal,now),profile=state.profiles[assignment.profileId],task=state.tasks[assignment.taskId];
  if(!profile||!task||!view.profiles.some(p=>p.id===profile.id)||!view.uploadEligibility.some(c=>c.profileId===profile.id&&c.allowed&&c.consentEpoch===assignment.consentVersion)||assignment.status!=='active'||assignment.taskVersion!==task.templateVersion)throw new ChildApiError('MEDIA_AUTHORITY_REVOKED',403);
  authorizeLearningInteraction(state,principal,task.id,now);return{assignment,profile,actor:state.actors[principal.actorId]!};
}
/** No network or public bytes ingress. Actual separate DB scopes are enforced by media.sql. */
export class SyntheticChildMediaService{
  constructor(private readonly ingress:ChildSqlClient,private readonly reviewer:ChildSqlClient,private readonly restoreAnchor?:ChildRestoreAnchorProvider){}
  /** Require independent restricted login identities; SET ROLE on an owner connection is rejected. */
  async ready():Promise<boolean>{
    try{
      const check=async(client:ChildSqlClient,scope:'ingest'|'reviewer')=>{
        const rows=await client.query<{ready:boolean}>(`WITH effective AS (SELECT oid,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user)
          SELECT current_user=session_user AND EXISTS(SELECT 1 FROM effective WHERE NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
          AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN effective e ON e.oid=m.member)
          AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN effective e ON e.oid=c.relowner WHERE c.relnamespace='child_stewardship'::regnamespace)
          AND child_stewardship.media_role($1)
          AND NOT child_stewardship.media_role(CASE WHEN $1='ingest' THEN 'reviewer' ELSE 'ingest' END)
          AND NOT EXISTS(SELECT 1 FROM child_stewardship.service_role_scopes WHERE database_role=current_user AND enabled)
          AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_worker_roles WHERE database_role=current_user AND enabled) ready`,[scope]);
        return rows[0]?.ready===true;
      };
      return await check(this.ingress,'ingest')&&await check(this.reviewer,'reviewer');
    }catch{return false;}
  }
  private async requireReady(){if(!await this.ready())throw new ChildApiError('MEDIA_STORAGE_UNAVAILABLE',503);}
  async ingestFixture(session:string,principal:LearningPrincipal,assignmentId:string,fixtureId:SyntheticMediaFixtureId,now:string){
    const started=performance.now();await this.requireReady();
    if(!Object.hasOwn(syntheticMediaFixtures,fixtureId))throw new ChildApiError('SYNTHETIC_MEDIA_NOT_ALLOWLISTED',403);
    const fixture=syntheticMediaFixtures[fixtureId],raw=Buffer.from(fixture.base64,'base64');if(hash(raw)!==fixture.sha256)throw new ChildApiError('FIXTURE_INTEGRITY_FAILURE',503);
    // Authority precedes decoding, and is checked again under lock before persistence.
    await this.ingress.transaction(async db=>{const current=await load(db,session,principal,now,started,this.restoreAnchor);assignmentAuthority(current.state,principal,assignmentId,current.now);});
    const processed=await processSyntheticMediaBytes(raw);
    return this.ingress.transaction(async db=>{
      const current=await load(db,session,principal,now,started,this.restoreAnchor),{state}=current,{profile,actor}=assignmentAuthority(state,principal,assignmentId,current.now);
      if((await db.query("SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=$1::uuid AND profile_id=$2",[session,profile.id])).length)throw new ChildApiError('PRIVACY_SUPPRESSED',403);
      const id=`demo-media-${randomUUID()}`,rawId=`${id}:source`,derivedId=`${id}:derived`,indexId=`${id}:index`;
      const candidates=await db.query<{media_id:string;raw_digest:string;pixel_digest:string;perceptual_hashes:string[]}>("SELECT media_id,raw_digest,pixel_digest,perceptual_hashes FROM child_stewardship.media_assets WHERE session_id=$1::uuid ORDER BY created_at,media_id",[session]);
      const flags=candidates.flatMap(item=>item.raw_digest===processed.rawDigest?['exact_repeat']:item.pixel_digest===processed.pixelDigest?['pixel_repeat']:item.perceptual_hashes.some(a=>processed.perceptualHashes.some(b=>perceptualDistance(a,b)<=8))?['possible_visual_repeat']:[]);
      await db.query(`INSERT INTO child_stewardship.media_assets(session_id,media_id,profile_id,assignment_id,fixture_id,uploaded_by,uploaded_domain,raw_object_id,sanitized_object_id,index_object_id,raw_digest,sanitized_digest,pixel_digest,index_digest,perceptual_hashes,width,height,duplicate_flags)
        VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18::jsonb)`,[session,id,profile.id,assignmentId,fixtureId,actor.id,actor.controlDomain,rawId,derivedId,indexId,processed.rawDigest,processed.sanitizedDigest,processed.pixelDigest,hash(processed.index),JSON.stringify(processed.perceptualHashes),processed.width,processed.height,JSON.stringify([...new Set(flags)])]);
      for(const [objectId,kind,content]of [[rawId,'source',raw],[derivedId,'derived',processed.sanitized],[indexId,'index',processed.index]]as const)await db.query("INSERT INTO child_stewardship.privacy_objects(session_id,object_id,profile_id,purpose,kind,content,expires_at,external) VALUES($1::uuid,$2,$3,'upload',$4,$5,clock_timestamp()+interval '24 hours',false)",[session,objectId,profile.id,kind,content]);
      return{mediaId:id,status:'quarantined' as const,evidenceLevel:'E0' as const,sanitizedDigest:processed.sanitizedDigest,duplicateFlags:[...new Set(flags)],syntheticOnly:true as const};
    });
  }
  async review(session:string,principal:LearningPrincipal,mediaId:string,exactDigest:string,decision:'accepted'|'rejected',now:string){
    const started=performance.now();await this.requireReady();
    return this.reviewer.transaction(async db=>{
      const{state}=await load(db,session,principal,now,started,this.restoreAnchor),actor=state.actors[principal.actorId]!;
      if(!['reviewer','protector'].includes(actor.role))throw new ChildApiError('FORBIDDEN',403);
      await db.query("INSERT INTO child_stewardship.media_reviews(session_id,media_id,reviewer_id,reviewer_domain,sanitized_digest,decision) VALUES($1::uuid,$2,$3,$4,$5,$6)",[session,mediaId,actor.id,actor.controlDomain,exactDigest,decision]);
      return{mediaId,status:decision,evidenceLevel:'E0' as const,reviewKind:'synthetic_role_separation' as const,syntheticOnly:true as const};
    });
  }
  async readSanitized(session:string,principal:LearningPrincipal,mediaId:string,now:string,forReview=false):Promise<{bytes:Buffer;contentType:'image/png';evidenceLevel:'E0';syntheticOnly:true}>{
    const started=performance.now();await this.requireReady();
    return(forReview?this.reviewer:this.ingress).transaction(async db=>{
      const current=await load(db,session,principal,now,started,this.restoreAnchor),{state}=current,actor=state.actors[principal.actorId]!;
      const records=await db.query<{profile_id:string;assignment_id:string;sanitized_object_id:string;sanitized_digest:string;status:string;uploaded_domain:string}>("SELECT profile_id,assignment_id,sanitized_object_id,sanitized_digest,status,uploaded_domain FROM child_stewardship.media_assets WHERE session_id=$1::uuid AND media_id=$2",[session,mediaId]);const item=records[0];if(!item)throw new ChildApiError('FORBIDDEN',403);
      if(forReview){if(!['reviewer','protector'].includes(actor.role)||actor.controlDomain===item.uploaded_domain||actor.controlDomain===state.actors[state.profiles[item.profile_id]?.guardianActorId??'']?.controlDomain)throw new ChildApiError('FORBIDDEN',403);}else{assignmentAuthority(state,principal,item.assignment_id,current.now);if(item.status!=='accepted')throw new ChildApiError('MEDIA_QUARANTINED',403);}
      if((await db.query("SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=$1::uuid AND profile_id=$2",[session,item.profile_id])).length)throw new ChildApiError('PRIVACY_SUPPRESSED',403);
      const bytes=await db.query<{content:Uint8Array}>("SELECT content FROM child_stewardship.privacy_objects WHERE session_id=$1::uuid AND object_id=$2 AND kind='derived' AND expires_at>clock_timestamp()",[session,item.sanitized_object_id]);if(!bytes[0])throw new ChildApiError('MEDIA_UNAVAILABLE',403);
      const content=Buffer.from(bytes[0].content);if(hash(content)!==item.sanitized_digest)throw new ChildApiError('MEDIA_INTEGRITY_FAILURE',503);
      return{bytes:content,contentType:'image/png',evidenceLevel:'E0',syntheticOnly:true};
    });
  }
}
