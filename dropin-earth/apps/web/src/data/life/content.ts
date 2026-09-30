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

export const modules: { number: string; icon: 'space' | 'agent' | 'club' | 'robot'; title: Bilingual; subtitle: string; description: Bilingual; audience: Bilingual; stage: Bilingual; next: Bilingual; path: string }[] = [
  { number: '01', icon: 'agent', title: { zh: '个人智能助手', en: 'A personal AI assistant' }, subtitle: 'CAI / PERSONAL', audience: { zh: '个人与小团队', en: 'Individuals and small teams' }, description: { zh: '以CAI数字分身探索资料整理、日程建议与有限任务辅助。数据、算力配额和人工确认逐项约定。', en: 'Explore document organization, schedule suggestions and bounded task assistance with CAI. Agree data access, compute quotas and human confirmation for each task.' }, stage: { zh: '内测规划 · 按需求咨询', en: 'Pilot planning · Enquire for scope' }, next: { zh: '描述一个任务', en: 'Describe a task' }, path: '/life/agents#agent-enquiry' },
  { number: '02', icon: 'space', title: { zh: '三维空间展示', en: 'Show a space in 3D' }, subtitle: 'SPATIAL / PRESENTATION', audience: { zh: '物业、商户与展商', en: 'Property teams, merchants and exhibitors' }, description: { zh: '讨论空间采集、三维展示页面与版本更新。先明确展示许可、交付范围和验收，不预设导航能力。', en: 'Discuss spatial capture, a 3D presentation page and version updates. Define display rights, deliverables and acceptance without assuming navigation capability.' }, stage: { zh: '接入测试 · 逐项报价', en: 'Integration testing · Scoped quotation' }, next: { zh: '查看空间测试', en: 'View spatial tests' }, path: '/life/spaces' },
  { number: '03', icon: 'club', title: { zh: '社区学习与交流', en: 'Learn and connect' }, subtitle: 'COMMUNITY / LEARNING', audience: { zh: '社区成员与学习伙伴', en: 'Community members and learning partners' }, description: { zh: '规划共学工作坊、主题交流和空间活动。以正式排期、场地条件与服务规则确认每次参与。', en: 'Plan learning workshops, focused conversations and spatial activities. Confirm each session through an agreed schedule, site conditions and service terms.' }, stage: { zh: '规划中 · 尚未售票或收费', en: 'Planned · No ticketing or payments' }, next: { zh: '了解参与计划', en: 'Explore participation plans' }, path: '/life/membership' },
  { number: '04', icon: 'robot', title: { zh: '企业与机构协作', en: 'Work on a shared pilot' }, subtitle: 'BUSINESS / COLLABORATION', audience: { zh: '企业、机构与场地方', en: 'Businesses, institutions and venue partners' }, description: { zh: '从一个可验收的试点开始，约定职责、排期、对账与退出。设备、边缘终端或机器人另需现场安全验收。', en: 'Start with a reviewable pilot and agree responsibilities, schedule, reconciliation and exit terms. Devices, edge systems or robots require separate site safety acceptance.' }, stage: { zh: '合作咨询 · 范围另行确认', en: 'Partnership enquiries · Scope to be agreed' }, next: { zh: '了解合作试点', en: 'Discuss a pilot' }, path: '/life/partners' },
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
    [{ zh: '拟议CAI数字分身与数据授权服务', en: 'Proposed CAI agent and data permission services' }, { zh: '高端闭门交流等方向', en: 'Focused private discussions and related activities' }],
  ][index] ?? [],
}));

export const pageMeta: Record<LifePageId, { title: Bilingual; description: Bilingual }> = {
  home: { title: { zh: 'Life++ 生生不息', en: 'Life++ — Life, connected' }, description: { zh: '让数字智能，走进真实生活。以会展湾671.26㎡四铺导入期为起点，探索数字分身、三维空间与社区服务的可问责协作。', en: 'Bring digital agents into everyday life. Explore spatial reconstruction, community services and accountable collaboration.' } },
  spaces: { title: { zh: '探索空间', en: 'Explore spaces' }, description: { zh: '两个用户提供的三维高斯测试输入，清楚呈现来源、权限与验证状态。', en: 'Two user-provided Gaussian splatting test inputs, with explicit source, permission and verification status.' } },
  center: { title: { zh: '共生中心', en: 'The Life++ center' }, description: { zh: '以671.26㎡四铺导入期规划，探索空间、数字分身、共学与机器人服务。', en: 'A 671.26 m², four-unit introductory plan for spatial experiences, agents, collaborative learning and robot services.' } },
  agents: { title: { zh: '数字分身与边缘计算', en: 'Agents & edge computing' }, description: { zh: '在明确授权、任务边界与可撤回条件下，探索数字分身、边缘终端与云服务。', en: 'Explore digital agents, edge devices and cloud services with explicit authorization, bounded tasks and withdrawal.' } },
  membership: { title: { zh: '参与计划', en: 'Participation plans' }, description: { zh: 'Life、Life+、Life++拟议年度订阅方案。尚未开放收费。', en: 'Proposed annual Life, Life+ and Life++ plans. Payments are not open.' } },
  partners: { title: { zh: '一起，让想法落地', en: 'Build the next step together' }, description: { zh: '面向物业、商户、展商、设备与研究伙伴的合作意向入口。', en: 'An enquiry route for property managers, merchants, exhibitors, equipment partners and researchers.' } },
  trust: { title: { zh: '每一次协作，都有边界', en: 'Every collaboration has boundaries' }, description: { zh: '了解空间来源、独立授权、责任主体、审阅、申诉与撤回。', en: 'Understand sources, separate permissions, responsible parties, review, challenges and withdrawal.' } },
  company: { title: { zh: 'CanopyProof Limited', en: 'CanopyProof Limited' }, description: { zh: '一个主体，两个业务入口：生态与地球观测，以及Life++生生不息。', en: 'One company, two business entry points: ecology and Earth observation, and Life++.' } },
};
