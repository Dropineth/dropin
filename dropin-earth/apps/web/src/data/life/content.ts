import manifest from './site-manifest.json';
import { LIFEPP_PUBLIC_BRAND } from './public-brand';

export type LifeLocale = 'zh' | 'en';
export type LifePageId = 'home' | 'spaces' | 'center' | 'agents' | 'membership' | 'partners' | 'trust' | 'company';
export type Bilingual = { zh: string; en: string };
export const t = (locale: LifeLocale, value: Bilingual) => value[locale];
export const lifePath = (locale: LifeLocale, path = '/life') => `${locale === 'en' ? '/en' : ''}${path}`;
export const currentPlan = manifest.currentPlan;

export const navigation: { path: string; label: Bilingual }[] = [
  { path: '/life/spaces', label: { zh: '三维空间', en: '3D spaces' } },
  { path: '/life/center', label: { zh: '共生中心', en: 'Center' } },
  { path: '/life/agents', label: { zh: '数字分身', en: 'Agents' } },
  { path: '/life/membership', label: { zh: '参与计划', en: 'Participation' } },
  { path: '/life/trust', label: { zh: '授权与隐私', en: 'Trust & privacy' } },
];

export const rooms = manifest.spaces.map((room) => {
  const labels: Record<string, { title: Bilingual; description: Bilingual }> = {
    L112: {
      title: { zh: '机器人机库', en: 'Robot Fleet Garage' },
      description: { zh: '规划机器人停放、自检、充电与派单，并安排远程值守和维修响应。配送服务须先确认设备、路线、保险与现场安全；自动装卸另行验证。', en: 'A planned base for robot parking, checks, charging and dispatch, supported by remote supervision and maintenance. Delivery services require confirmed equipment, routes, insurance and site safety. Automated loading needs separate assessment.' },
    },
    L203: {
      title: { zh: '三维体验与空间采集', en: '3D experiences & spatial capture' },
      description: { zh: '规划三维体验、空间采集演示，以及采集设备的租售咨询。培训和较长活动与 L202 共享场地。运动装置仅用于体验；设备引入、价格和合作条件另行确认。', en: 'Planned 3D experiences, spatial-capture demonstrations and enquiries about capture-equipment rental or purchase. Training and longer events share L202. Sports installations are for experiences; equipment availability, prices and partnerships remain to be agreed.' },
    },
    L202: {
      title: { zh: '数字分身与社区共学', en: 'Digital agents & community learning' },
      description: { zh: '规划个人智能助手、共学工作坊、咖啡交流及高尔夫、划船、骑行模拟体验。与 L203 共享培训和活动；两铺连接方案须先完成现场、机电与消防核查。', en: 'Planned personal AI assistance, learning workshops, café gatherings and simulated golf, rowing and cycling. Training and events share L203. Connecting the two units requires site, building-services and fire-safety checks.' },
    },
  };
  const content = labels[room.unit];
  if (!content) throw new Error(`Missing room content: ${room.unit}`);
  return { ...room, ...content };
});

export const modules: { number: string; icon: 'space' | 'agent' | 'club' | 'robot'; title: Bilingual; subtitle: string; description: Bilingual; audience: Bilingual; stage: Bilingual; next: Bilingual; path: string }[] = [
  { number: '01', icon: 'agent', title: { zh: '个人智能助手', en: 'Personal AI assistance' }, subtitle: 'PERSONAL AI', audience: { zh: '个人、家庭与小团队', en: 'Individuals, families and small teams' }, description: { zh: '从整理资料、拟定日程或一项重复任务开始，讨论 CAI 如何提供帮助。先约定可用数据、任务范围与需要确认的步骤。', en: 'Start with organizing information, planning a schedule or a recurring task. Discuss how CAI could help, with agreed data access, task limits and confirmation steps.' }, stage: { zh: '试点规划中', en: 'Pilot in planning' }, next: { zh: '描述你的任务', en: 'Describe your task' }, path: '/life/agents#agent-enquiry' },
  { number: '02', icon: 'space', title: { zh: '三维空间展示', en: 'Present a space in 3D' }, subtitle: 'SPATIAL CAPTURE', audience: { zh: '物业、商户与展商', en: 'Property teams, merchants and exhibitors' }, description: { zh: '讨论空间采集、线上展示与后续更新。先确定哪些区域可展示、谁来使用，以及交付标准。机器人导航需另行验证。', en: 'Discuss spatial capture, online presentation and future updates. Agree which areas may be shown, who will use them and the delivery criteria. Robot navigation requires separate validation.' }, stage: { zh: '方案与来源说明可查看', en: 'Plans and source notes available' }, next: { zh: '了解三维空间', en: 'Explore 3D spaces' }, path: '/life/spaces' },
  { number: '03', icon: 'club', title: { zh: '社区学习与交流', en: 'Learn and connect' }, subtitle: 'COMMUNITY LEARNING', audience: { zh: '社区、学校与家庭', en: 'Communities, schools and families' }, description: { zh: '讨论共学工作坊、主题交流和体验活动。每次活动需先确认课程目标、适合人群、场地与安排。', en: 'Discuss workshops, focused conversations and shared experiences. Agree learning goals, intended participants, venue and arrangements for each activity.' }, stage: { zh: '活动筹备中 · 暂未开放预约', en: 'In planning · Bookings unavailable' }, next: { zh: '了解参与方式', en: 'Explore participation' }, path: '/life/membership' },
  { number: '04', icon: 'robot', title: { zh: '企业与机构试点', en: 'Business & institutional pilots' }, subtitle: 'PARTNERSHIPS', audience: { zh: '企业、机构与场地方', en: 'Businesses, institutions and venues' }, description: { zh: '选择一个具体问题，约定试点目标、职责、预算与验收方式。涉及设备或机器人时，另行确认现场安全条件。', en: 'Choose a specific problem and agree pilot goals, responsibilities, budget and review criteria. Equipment and robot projects also require site safety checks.' }, stage: { zh: '可整理合作需求', en: 'Prepare a partnership enquiry' }, next: { zh: '查看合作流程', en: 'See the partnership process' }, path: '/life/partners' },
];

export const tiers = manifest.membership.tiers.map((tier, index) => ({
  ...tier,
  description: [
    { zh: '从相聚开始', en: 'Start with community' },
    { zh: '在体验中连接', en: 'Connect through experience' },
    { zh: '共同探索下一步', en: 'Explore what comes next' },
  ][index] ?? { zh: '参与意向', en: 'Participation interest' },
  benefits: [
    [{ zh: '社区交流与主题活动', en: 'Community gatherings and themed activities' }, { zh: '具体场次与使用安排待确认', en: 'Sessions and access to be confirmed' }],
    [{ zh: '高尔夫、划船、骑行模拟体验', en: 'Simulated golf, rowing and cycling' }, { zh: '体验次数与活动安排待确认', en: 'Experience quotas and events to be confirmed' }],
    [{ zh: 'CAI 智能助手与数据授权咨询', en: 'CAI assistance and data-permission guidance' }, { zh: '专题交流与服务范围待确认', en: 'Focused discussions and service scope to be confirmed' }],
  ][index] ?? [],
}));

export const pageMeta: Record<LifePageId, { title: Bilingual; description: Bilingual }> = {
  home: { title: { zh: LIFEPP_PUBLIC_BRAND, en: LIFEPP_PUBLIC_BRAND }, description: { zh: '把三维空间、个人智能助手与社区学习连接起来。以深圳会展湾 380.48㎡ 三铺规划为起点，探索人与智能共同参与的日常服务。', en: 'Connect 3D spaces, personal AI assistance and community learning. Our planned 380.48 m² center at Expo Bay, Shenzhen, brings these ideas into one setting.' } },
  spaces: { title: { zh: '三维空间', en: '3D spaces' }, description: { zh: '了解三维空间展示、来源说明与使用许可。当前两项场景资料尚未开放站内浏览。', en: 'Explore spatial presentation, source information and permissions. The two current scene references are not yet available in the on-site viewer.' } },
  center: { title: { zh: '共生中心', en: `The ${LIFEPP_PUBLIC_BRAND} center` }, description: { zh: 'L112、L203、L202 三铺合计 380.48㎡，规划机器人机库、三维空间体验与社区共学。二层两铺共 321.79㎡；L201 不在本期范围。', en: 'L112, L203 and L202 total 380.48 m², with planned areas for a robot garage, 3D experiences and community learning. The two second-floor units total 321.79 m². L201 is outside this phase.' } },
  agents: { title: { zh: '数字分身与边缘计算', en: 'Agents & edge computing' }, description: { zh: '在明确授权、任务边界与可撤回条件下，探索数字分身、边缘终端与云服务。', en: 'Explore digital agents, edge devices and cloud services with explicit authorization, bounded tasks and withdrawal.' } },
  membership: { title: { zh: '参与计划', en: 'Participation plans' }, description: { zh: 'Life、Life+、Life++拟议年度订阅方案。尚未开放收费。', en: 'Proposed annual Life, Life+ and Life++ plans. Payments are not open.' } },
  partners: { title: { zh: '从一个具体问题开始合作', en: 'Start with a specific problem' }, description: { zh: '面向学校、机构、企业与社区伙伴，明确需求、试点范围和下一步。', en: 'For schools, institutions, businesses and community partners: define a need, a pilot scope and the next step.' } },
  trust: { title: { zh: '每一次协作，都有边界', en: 'Every collaboration has boundaries' }, description: { zh: '了解空间来源、独立授权、责任主体、审阅、申诉与撤回。', en: 'Understand sources, separate permissions, responsible parties, review, challenges and withdrawal.' } },
  company: { title: { zh: 'CanopyProof Limited', en: 'CanopyProof Limited' }, description: { zh: `了解 CanopyProof 的生态证据工作与 ${LIFEPP_PUBLIC_BRAND} 的空间、智能助手和社区学习规划。`, en: `Explore CanopyProof’s ecological evidence work and ${LIFEPP_PUBLIC_BRAND} plans for spaces, AI assistance and community learning.` } },
};
