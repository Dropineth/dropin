import {sha256Hex} from './sha256.mjs';
/** Source facts and demonstration fixtures deliberately remain separate. */
export const SOURCE_HEAD = 'a9c83284cf41179e2ef9935436912ba0f4f5d5d0';
export const SNAPSHOT = Object.freeze({ asOf: '2026-10-05', sourceHead: SOURCE_HEAD, release: 'HOLD', lifeCI: 'SUCCESS', trustGate: 'FAIL', highFindings: 4, scene33: 'UNVERIFIED', scene29: 'UNVERIFIED', scene31: 'LEGACY_UNVERIFIED', enquiry: 'DRAFT_NOT_SENT', production: 'NOT_DEPLOYED', robotCommands: false, billing: false, telemetry: false });
/** Current planning input; it does not supersede the historical CI snapshot above. */
export const PLAN_SOURCE = Object.freeze({asOf:'2026-10-19',document:'Life++HERE × CoHERE three-store proposal',pages:Object.freeze([1,2,3,4,5]),status:'proposal_not_accepted',excludedUnits:Object.freeze(['L201']),originalDrawingsUnchanged:true});
export const ROOMS = Object.freeze([
 {id:'L112',floor:'1F',area:58.69,zh:'机器人机库',en:'Robot Fleet Garage',subtitle:'ROBOT FLEET GARAGE',color:'#6946db',page:2,roleZh:'规划机器人停放、检查、充电与任务调度；日常无人值守的方案须配套远程监管、异常处理和维修响应。',roleEn:'Proposed parking, checks, charging and dispatch for robots. Unattended operation would require remote supervision, incident handling and maintenance.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.17,.633],polygon:[[147,469],[223,469],[223,506],[147,506]]},
 {id:'L203',floor:'2F',area:135.80,zh:'3DGS体验、空间采集与设备展售',en:'3DGS experience, capture & equipment showcase',subtitle:'3DGS EXPERIENCE & CAPTURE',color:'#6946db',page:3,roleZh:'规划三维体验、空间采集演示与设备租购咨询；培训和较长活动拟与 L202 共用场地。',roleEn:'Proposed 3D experiences, spatial-capture demonstrations and equipment enquiries. Training and longer activities would share L202.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.430,.580],polygon:[[434,437],[441,426],[466,421],[501,416],[501,466],[434,466]]},
 {id:'L202',floor:'2F',area:185.99,zh:'数字分身、共学与生活方式体验',en:'Digital agents, learning & lifestyle experiences',subtitle:'DIGITAL AGENTS & SHARED LEARNING',color:'#187d7e',page:3,roleZh:'规划经授权的智能助手、社区共学、咖啡社交与模拟运动体验；连接 L203 的设计仍需场地及消防核查。',roleEn:'Proposed AI assistance, community learning, café activities and simulated sports. Connecting to L203 requires site and fire-safety review.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.480,.580],polygon:[[501,416],[533,407],[564,396],[564,466],[501,466]]}
]);
export const AREA_TOTAL = 380.48;
export const AREA_SECOND_FLOOR = 321.79;
export const NODES = Object.freeze([
 {id:'human',zh:'人类运营者',en:'Human operator',caption:'AUTHORITY',position:[-10,1,0],color:'#9a6633'},
 {id:'cai',zh:'CAI 数字分身',en:'CAI agent',caption:'BOUNDED AGENT',position:[-3,3,0],color:'#6946db'},
 {id:'L112',zh:'机器人机库',en:'Robot garage',caption:'L112 · 1F',position:[3,-2,4],color:'#6946db'},
 {id:'L203',zh:'空间采集与体验',en:'Capture & experience',caption:'L203 · 2F',position:[3,4,-4],color:'#6946db'},
 {id:'L202',zh:'数字分身与共学',en:'Agents & shared learning',caption:'L202 · 2F',position:[9,3,2],color:'#187d7e'},
 {id:'evidence',zh:'可审阅记录',en:'Reviewable record',caption:'DEMO RECORD',position:[-3,-3,-5],color:'#657386'}
]);
export const EDGES = Object.freeze([['human','cai'],['cai','L112'],['cai','L203'],['cai','L202'],['L203','evidence'],['L112','evidence'],['L202','evidence'],['evidence','human']]);
export const TASKS = Object.freeze([
 {id:'DEMO-001',room:'L203',zh:'准备空间采集与设备咨询清单',en:'Prepare a spatial-capture equipment enquiry',state:'DRAFT',owner:'demo:operator',purpose:'REVIEW_ONLY'},
 {id:'DEMO-002',room:'L202',zh:'复核共享培训与共学场地条件',en:'Review the venue needs for workshops and shared learning',state:'REVIEW',owner:'demo:venue-reviewer',purpose:'REVIEW_ONLY'},
 {id:'DEMO-003',room:'L112',zh:'核对机器人试点前置条件',en:'Check robot-pilot prerequisites',state:'BLOCKED',owner:'demo:safety-reviewer',purpose:'REVIEW_ONLY'},
 {id:'DEMO-004',room:'L202',zh:'整理社区与模拟运动体验意向',en:'Gather interest in community activities and simulated sports',state:'DRAFT',owner:'demo:community',purpose:'REVIEW_ONLY'}
]);
export const STEPS = Object.freeze([
 {action:'ASSERT',zh:'声明需求与来源',en:'State the need and source',noteZh:'记录演示任务与规划空间，不创建真实订单。',noteEn:'Record a demo task and planned unit. No real order is created.'},
 {action:'REASON',zh:'检查条件与缺项',en:'Inspect conditions and gaps',noteZh:'场地、范围、接收方与权限仍需真实证据。',noteEn:'Venue, scope, recipient and permissions still require real evidence.'},
 {action:'DELEGATE',zh:'生成有限授权草稿',en:'Draft a limited authorization',noteZh:'授权草稿尚未签署；不会调用机器人、AI 服务或其他外部服务。',noteEn:'The draft is unsigned. It does not activate robots, AI services or other external services.'},
 {action:'FULFILL',zh:'展示示例交付',en:'Present a sample deliverable',noteZh:'这是示例记录，不代表服务已完成、资料已送达或结果已验收。',noteEn:'This sample record does not confirm service completion, delivery or acceptance.'},
 {action:'CHALLENGE',zh:'提出异议并纠正',en:'Raise concerns and correct errors',noteZh:'此处仅演示如何记录异议；正式反馈请使用页面的合作咨询入口。',noteEn:'This step only shows how a concern could be recorded. Use the page’s enquiry route for an actual concern.'}
]);
export function adjacentNodeIds(id) { return new Set([id,...EDGES.filter(e=>e.includes(id)).flat()]); }
export function filteredTasks(state='ALL') { return TASKS.filter(t=>state==='ALL'||t.state===state); }
export function sourceFacts() { return {sourceHead:SOURCE_HEAD,planSource:PLAN_SOURCE,totalArea:AREA_TOTAL,secondFloorArea:AREA_SECOND_FLOOR,units:ROOMS.map(({id,floor,area,page})=>({id,floor,area,sourcePage:page})),leaseVerified:false,navigationApproved:false}; }
export function makeEvent(index,taskId='DEMO-001') {
 if (!Number.isInteger(index)||index<0||index>=STEPS.length||!TASKS.some(t=>t.id===taskId)) throw new RangeError('Invalid demo event');
 return {schema:'lifepp.spatial.demo-event.v1',sequence:index+1,taskId,action:STEPS[index].action,actor:'demo:operator',accountableActor:'demo:human-reviewer',scope:'local_replay_only',isDemo:true,signed:false,finalAuthority:false,executedExternalAction:false,sourceHead:SOURCE_HEAD};
}
export async function hashEvents(events, cryptoProvider=globalThis.crypto) {

 let previousHash='0'.repeat(64); const out=[];
 for (const e of events) { const payload={...e,previousHash}; const bytes=new globalThis.TextEncoder().encode(JSON.stringify(payload)); const hash=cryptoProvider?.subtle?[...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''):sha256Hex(bytes);out.push({...payload,hash});previousHash=hash; }
 return out;
}
