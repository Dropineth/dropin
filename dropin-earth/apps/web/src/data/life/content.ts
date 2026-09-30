import manifest from './site-manifest.json';

export type LifeLocale = 'zh' | 'en';
export type LifePageId = 'home' | 'spaces' | 'center' | 'agents' | 'membership' | 'partners' | 'trust' | 'company';
export type Bilingual = { zh: string; en: string };
export const t = (locale: LifeLocale, value: Bilingual) => value[locale];
export const lifePath = (locale: LifeLocale, path = '/life') => `${locale === 'en' ? '/en' : ''}${path}`;

export const navigation: { path: string; label: Bilingual }[] = [
  { path: '/life/spaces', label: { zh: '探索空间', en: 'Spaces' } },
  { path: '/life/center', label: { zh: '共生中心', en: 'Center' } },
  { path: '/life/agents', label: { zh: '数字分身', en: 'Agents' } },
  { path: '/life/membership', label: { zh: '参与计划', en: 'Membership' } },
  { path: '/life/trust', label: { zh: '信任与边界', en: 'Trust' } },
];

export const rooms = manifest.spaces.map((room) => {
  const labels: Record<string, { title: Bilingual; description: Bilingual }> = {
    L112: {
      title: { zh: '机器人机库', en: 'Robot Fleet Garage' },
      description: { zh: '面向设备展示、维护与物业场景讨论的拟议试点基地。真实服务须完成设备、路线、保险及安全验收。', en: 'A proposed base for equipment demonstrations, maintenance and property pilots. Real services require approved devices, routes, insurance and safety acceptance.' },
    },
    L203: {
      title: { zh: '数字分身与边缘计算', en: 'Agent & Edge Lab' },
      description: { zh: '探索有明确授权的数字分身，以及边缘终端与云服务的协作方式。当前接受定制需求与内测意向。', en: 'Explore explicitly authorized digital agents and collaboration between edge devices and cloud services. Customization and pilot enquiries are open.' },
    },
    L202: {
      title: { zh: '会所与闭门交流', en: 'Life++ Club' },
      description: { zh: '为社区交流、主题分享与高质量闭门讨论规划的聚会空间。活动排期、服务规则与开放条件待确认。', en: 'A planned gathering space for community conversations, themed sessions and focused private discussions. Schedules, terms and opening conditions remain to be confirmed.' },
    },
    L201: {
      title: { zh: '共学、课程与空间赛事', en: 'Learning & Spatial Arena' },
      description: { zh: '共学课程、企业工作坊，以及高尔夫、划船、骑行等空间赛事的拟议空间。当前仅收集参与意向。', en: 'A proposed space for collaborative learning, business workshops and spatial golf, rowing and cycling events. Participation is currently an expression of interest.' },
    },
  };
  const content = labels[room.unit];
  if (!content) throw new Error(`Missing room content: ${room.unit}`);
  return { ...room, ...content };
});

export const modules: { number: string; icon: 'space' | 'agent' | 'club' | 'robot'; title: Bilingual; subtitle: string; description: Bilingual; path: string }[] = [
  { number: '01', icon: 'space', title: { zh: '让空间，被看见', en: 'Make space visible' }, subtitle: 'Spatial', description: { zh: '从三维采集与空间展示开始，建立清晰的交付、验收与更新约定。', en: 'Start with 3D capture and spatial presentation, with clear delivery, acceptance and update agreements.' }, path: '/life/spaces' },
  { number: '02', icon: 'agent', title: { zh: '让协作，有分寸', en: 'Give agents boundaries' }, subtitle: 'Agent & Edge', description: { zh: '在你明确授权的范围内，以数字分身、边缘终端和云服务辅助具体任务。', en: 'Use digital agents, edge devices and cloud services for specific tasks within your explicit authorization.' }, path: '/life/agents' },
  { number: '03', icon: 'club', title: { zh: '让相遇，有意义', en: 'Make room to connect' }, subtitle: 'Club & Learning', description: { zh: '围绕共学、闭门交流与空间赛事，连接有共同兴趣的人与社区。', en: 'Bring people and communities together through learning, focused conversations and spatial events.' }, path: '/life/membership' },
  { number: '04', icon: 'robot', title: { zh: '让服务，走进日常', en: 'Bring services closer' }, subtitle: 'Robot Garage', description: { zh: '携手物业、商户与设备伙伴，分阶段探索经过安全验收的机器人服务。', en: 'Work with property, retail and equipment partners on phased robot services that require safety acceptance.' }, path: '/life/center#garage' },
];

export const tiers = manifest.membership.tiers.map((tier, index) => ({
  ...tier,
  description: [
    { zh: '从相聚开始', en: 'Start with community' },
    { zh: '在体验中连接', en: 'Connect through experience' },
    { zh: '共同探索下一步', en: 'Explore what comes next' },
  ][index] ?? { zh: '参与意向', en: 'Participation interest' },
  benefits: [
    [{ zh: '拟议会所服务', en: 'Proposed club services' }, { zh: '社区交流与活动意向', en: 'Community and activity interests' }],
    [{ zh: '拟议空间赛事服务', en: 'Proposed spatial event services' }, { zh: '高尔夫、划船、骑行等方向', en: 'Golf, rowing and cycling concepts' }],
    [{ zh: '拟议数据主权与 AHIN 相关服务', en: 'Proposed data sovereignty and AHIN services' }, { zh: '高端闭门交流等方向', en: 'Focused private discussions and related activities' }],
  ][index] ?? [],
}));

export const pageMeta: Record<LifePageId, { title: Bilingual; description: Bilingual }> = {
  home: { title: { zh: 'Life++ 生生不息', en: 'Life++ — Life, connected' }, description: { zh: '让数字分身进入真实生活。从空间重建开始，连接社区服务与可问责的智能协作。', en: 'Bring digital agents into everyday life. Explore spatial reconstruction, community services and accountable collaboration.' } },
  spaces: { title: { zh: '探索空间', en: 'Explore spaces' }, description: { zh: '两个用户提供的三维高斯测试输入，清楚呈现来源、权限与验证状态。', en: 'Two user-provided Gaussian splatting test inputs, with explicit source, permission and verification status.' } },
  center: { title: { zh: '共生中心', en: 'The Life++ center' }, description: { zh: '以671.26㎡四铺导入期规划，探索空间、数字分身、共学与机器人服务。', en: 'A 671.26 m², four-unit introductory plan for spatial experiences, agents, collaborative learning and robot services.' } },
  agents: { title: { zh: '数字分身与边缘计算', en: 'Agents & edge computing' }, description: { zh: '在明确授权、任务边界与可撤回条件下，探索数字分身、边缘终端与云服务。', en: 'Explore digital agents, edge devices and cloud services with explicit authorization, bounded tasks and withdrawal.' } },
  membership: { title: { zh: '参与计划', en: 'Participation plans' }, description: { zh: 'Life、Life+、Life++拟议年度订阅方案。尚未开放收费。', en: 'Proposed annual Life, Life+ and Life++ plans. Payments are not open.' } },
  partners: { title: { zh: '一起，让想法落地', en: 'Build the next step together' }, description: { zh: '面向物业、商户、展商、设备与研究伙伴的合作意向入口。', en: 'An enquiry route for property managers, merchants, exhibitors, equipment partners and researchers.' } },
  trust: { title: { zh: '每一次协作，都有边界', en: 'Every collaboration has boundaries' }, description: { zh: '了解空间来源、独立授权、责任主体、审阅、申诉与撤回。', en: 'Understand sources, separate permissions, responsible parties, review, challenges and withdrawal.' } },
  company: { title: { zh: 'CanopyProof Limited', en: 'CanopyProof Limited' }, description: { zh: '一个主体，两个业务入口：生态与地球观测，以及Life++生生不息。', en: 'One company, two business entry points: ecology and Earth observation, and Life++.' } },
};
