import {sha256Hex} from './sha256.mjs';
/** Source facts and demonstration fixtures deliberately remain separate. */
export const SOURCE_HEAD = 'a9c83284cf41179e2ef9935436912ba0f4f5d5d0';
export const SNAPSHOT = Object.freeze({ asOf: '2026-10-05', sourceHead: SOURCE_HEAD, release: 'HOLD', lifeCI: 'SUCCESS', trustGate: 'FAIL', highFindings: 4, scene33: 'UNVERIFIED', scene29: 'UNVERIFIED', scene31: 'LEGACY_UNVERIFIED', enquiry: 'DRAFT_NOT_SENT', production: 'NOT_DEPLOYED', robotCommands: false, billing: false, telemetry: false });
export const ROOMS = Object.freeze([
 {id:'L112',floor:'1F',area:58.69,zh:'机器人机库',en:'Robot Fleet Garage',subtitle:'ROBOT FLEET GARAGE',color:'#6946db',page:2,roleZh:'设备维护、充电与可逆机器人试点。',roleEn:'Equipment care, charging and a reversible robot pilot.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.17,.633],polygon:[[147,469],[223,469],[223,506],[147,506]]},
 {id:'L203',floor:'2F',area:135.80,zh:'数字分身与边缘实验室',en:'Agent & Edge Lab',subtitle:'SOVEREIGN AGENT & EDGE LAB',color:'#6946db',page:3,roleZh:'CAI 数字分身、边缘设备咨询与共创。',roleEn:'CAI agents, edge-device enquiries and co-creation.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.430,.580],polygon:[[434,437],[441,426],[466,421],[501,416],[501,466],[434,466]]},
 {id:'L202',floor:'2F',area:185.99,zh:'生生俱乐部',en:'Life++ Club',subtitle:'LIFE++ CLUB',color:'#187d7e',page:3,roleZh:'社区相聚、会员体验与共学交流。',roleEn:'Community gatherings, membership experiences and shared learning.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.480,.580],polygon:[[501,416],[533,407],[564,396],[564,466],[501,466]]},
 {id:'L201',floor:'2F',area:290.78,zh:'共学与空间竞技',en:'Learning & Spatial Arena',subtitle:'LEARNING + SPATIAL ARENA',color:'#708c45',page:3,roleZh:'工作坊、空间展示与赛事意向验证。',roleEn:'Workshops, spatial presentation and event-interest validation.',sourceKind:'user_provided_plan',lease:null,open:false,sceneBinding:null,marker:[.550,.63],polygon:[[564,396],[592,400],[630,413],[667,426],[700,440],[700,494],[664,508],[646,525],[585,549],[585,519],[564,516]]}
]);
export const AREA_TOTAL = 671.26;
export const AREA_SECOND_FLOOR = 612.57;
export const NODES = Object.freeze([
 {id:'human',zh:'人类运营者',en:'Human operator',caption:'AUTHORITY',position:[-10,1,0],color:'#9a6633'},
 {id:'cai',zh:'CAI 数字分身',en:'CAI agent',caption:'BOUNDED AGENT',position:[-3,3,0],color:'#6946db'},
 {id:'L112',zh:'机器人机库',en:'Robot garage',caption:'L112 · 1F',position:[3,-2,4],color:'#6946db'},
 {id:'L203',zh:'边缘实验室',en:'Edge lab',caption:'L203 · 2F',position:[3,4,-4],color:'#6946db'},
 {id:'L202',zh:'社区与俱乐部',en:'Community & club',caption:'L202 · 2F',position:[9,3,2],color:'#187d7e'},
 {id:'L201',zh:'共学与空间',en:'Learning & space',caption:'L201 · 2F',position:[8,0,-6],color:'#708c45'},
 {id:'evidence',zh:'可审阅记录',en:'Reviewable record',caption:'DEMO READ MODEL',position:[-3,-3,-5],color:'#657386'}
]);
export const EDGES = Object.freeze([['human','cai'],['cai','L112'],['cai','L203'],['cai','L202'],['cai','L201'],['L203','evidence'],['L112','evidence'],['L201','evidence'],['L202','evidence'],['evidence','human']]);
export const TASKS = Object.freeze([
 {id:'DEMO-001',room:'L203',zh:'准备边缘设备咨询清单',en:'Prepare an edge-device enquiry',state:'DRAFT',owner:'demo:operator',purpose:'REVIEW_ONLY'},
 {id:'DEMO-002',room:'L201',zh:'复核工作坊场地条件',en:'Review workshop venue conditions',state:'REVIEW',owner:'demo:venue-reviewer',purpose:'REVIEW_ONLY'},
 {id:'DEMO-003',room:'L112',zh:'核对机器人试点前置条件',en:'Check robot-pilot prerequisites',state:'BLOCKED',owner:'demo:safety-reviewer',purpose:'REVIEW_ONLY'},
 {id:'DEMO-004',room:'L202',zh:'整理俱乐部活动意向',en:'Organize club activity interests',state:'DRAFT',owner:'demo:community',purpose:'REVIEW_ONLY'}
]);
export const STEPS = Object.freeze([
 {action:'ASSERT',zh:'声明需求与来源',en:'State the need and source',noteZh:'记录演示任务与规划空间，不创建真实订单。',noteEn:'Record a demo task and planned unit. No real order is created.'},
 {action:'REASON',zh:'检查条件与缺项',en:'Inspect conditions and gaps',noteZh:'场地、范围、接收方与权限仍需真实证据。',noteEn:'Venue, scope, recipient and permissions still require real evidence.'},
 {action:'DELEGATE',zh:'生成限定委托草稿',en:'Draft a bounded delegation',noteZh:'委托尚未签署；不会调用机器人、模型或外部接口。',noteEn:'Unsigned delegation. No robot, model or external API is invoked.'},
 {action:'FULFILL',zh:'展示示例交付',en:'Present a sample deliverable',noteZh:'仅为合成回放事件，不是实际履行、收件或验收。',noteEn:'A synthetic replay event, not actual fulfillment, receipt or acceptance.'},
 {action:'CHALLENGE',zh:'保留异议与纠错',en:'Keep a challenge path',noteZh:'演示异议事件不构成已建立的真实申诉渠道。',noteEn:'A demo challenge event is not an established live appeal service.'}
]);
export function adjacentNodeIds(id) { return new Set([id,...EDGES.filter(e=>e.includes(id)).flat()]); }
export function filteredTasks(state='ALL') { return TASKS.filter(t=>state==='ALL'||t.state===state); }
export function sourceFacts() { return {sourceHead:SOURCE_HEAD,totalArea:AREA_TOTAL,secondFloorArea:AREA_SECOND_FLOOR,units:ROOMS.map(({id,floor,area,page})=>({id,floor,area,sourcePage:page})),leaseVerified:false,navigationApproved:false}; }
export function makeEvent(index,taskId='DEMO-001') {
 if (!Number.isInteger(index)||index<0||index>=STEPS.length||!TASKS.some(t=>t.id===taskId)) throw new RangeError('Invalid demo event');
 return {schema:'lifepp.spatial.demo-event.v1',sequence:index+1,taskId,action:STEPS[index].action,actor:'demo:operator',accountableActor:'demo:human-reviewer',scope:'local_replay_only',isDemo:true,signed:false,finalAuthority:false,executedExternalAction:false,sourceHead:SOURCE_HEAD};
}
export async function hashEvents(events, cryptoProvider=globalThis.crypto) {

 let previousHash='0'.repeat(64); const out=[];
 for (const e of events) { const payload={...e,previousHash}; const bytes=new globalThis.TextEncoder().encode(JSON.stringify(payload)); const hash=cryptoProvider?.subtle?[...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''):sha256Hex(bytes);out.push({...payload,hash});previousHash=hash; }
 return out;
}
