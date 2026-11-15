import {createHash} from 'node:crypto';
export const TENANT='synthetic-community';
export function fixtures(now=Date.now()) {
 const serviceIds=['synthetic-water','synthetic-hygiene'];
 const grants=[['synthetic-dispatcher','dispatcher','synthetic-ops'],['synthetic-responder','responder','synthetic-wash'],['synthetic-backup','responder','synthetic-wash'],['synthetic-reviewer','reviewer','synthetic-review'],['synthetic-auditor','auditor','synthetic-audit']].map(([actorId,role,organizationId])=>({actorId,tenantId:TENANT,role,organizationId,serviceIds,version:1,revoked:false,validFrom:now-86400000,validUntil:now+86400000,onDuty:true}));
 const services=[{id:serviceIds[0],tenantId:TENANT,category:'water',acceptingReports:true,label:'Synthetic water point A',availability:'unknown',waterSafety:'unknown',location:null},{id:serviceIds[1],tenantId:TENANT,category:'hygiene',acceptingReports:true,label:'Synthetic hygiene point B',availability:'unknown',waterSafety:'unknown',location:null}];
 const evidence=[];for(const serviceId of serviceIds)for(const [suffix,actorId]of [['action','synthetic-responder'],['review','synthetic-reviewer'],['backup','synthetic-backup']])evidence.push({id:`${serviceId}-${suffix}`,tenantId:TENANT,serviceId,authorId:actorId,observedAt:now,expiresAt:now+86400000,privacyReviewed:true,revoked:false,license:'ORIGINAL_SYNTHETIC_FIXTURE',sourceDigest:createHash('sha256').update(`fixture:${serviceId}:${suffix}:${now}`).digest('hex')});
 return {grants,services,evidence};
}
