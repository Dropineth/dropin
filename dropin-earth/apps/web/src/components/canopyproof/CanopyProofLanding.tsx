import { BrandSwitcher } from "@/components/life/BrandSwitcher";
import { CanopyProofLogo } from "./CanopyProofLogo";
import { EarthOrb } from "./EarthOrb";

/** Public explanation of the workflow; examples never stand in for live records. */
export function CanopyProofLanding({ locale = "en" }: { locale?: "en" | "zh" }) {
  const zh = locale === "zh";
  const t = (en: string, cn: string) => zh ? cn : en;
  const localized = (path: string) => zh ? `${path}?lang=zh` : path;
  const steps = [
    [t("Record an observation", "记录观察"), t("Describe what was seen, when and where. Keep the original source and any permission needed to use it.", "说明看到了什么、何时何地看到，并保留原始来源和使用许可。")],
    [t("Check the information", "核对资料"), t("Compare dates, locations and other evidence. Flag gaps or contradictions so reviewers can see them.", "对照时间、位置和其他证据，清楚标出缺漏与矛盾，供审核人员判断。")],
    [t("Review the conclusion", "审核结论"), t("A qualified human reviewer assesses what the evidence supports. AI can assist, but cannot give final approval.", "由具备相应资格的审核人员判断证据能够支持什么结论。AI 可辅助分析，但不能作最终批准。")],
    [t("Publish and follow up", "公开并持续跟进"), t("Only information approved for public use belongs in a public record. Later changes and challenges need to stay visible.", "只有获准公开的信息才能进入公开记录。后续变化与异议，也应让读者看见。")],
  ];
  return <main className="cp-site" lang={zh ? "zh-CN" : "en"}>
    <a className="sr-only focus:not-sr-only" href="#top">{t("Skip to content", "跳至正文")}</a>
    <header className="cp-nav">
      <a className="cp-brand" href={zh ? "/zh" : "/"}><CanopyProofLogo loading="eager" size={42} /><span><strong>CanopyProof</strong><small>by Dropin</small></span></a>
      <nav className="cp-nav-links" aria-label={t("On this page", "本页目录")}>
        <a href="#how-it-works">{t("How it works", "如何运作")}</a><a href="#methodology">{t("Review approach", "审核方法")}</a><a href="#explorer">{t("Public records", "公开记录")}</a><a href="#contact">{t("Get started", "从这里开始")}</a>
      </nav>
      <a className="cp-nav-cta" href={zh ? "/ecology" : "/ecology?lang=zh"} lang={zh ? "en" : "zh-CN"}>{zh ? "English" : "中文"}</a>
    </header>
    <BrandSwitcher locale={locale} />
    <section className="cp-hero" id="top">
      <div className="cp-hero-copy">
        <p className="cp-eyebrow">{t("ENVIRONMENTAL EVIDENCE", "环境证据")}</p>
        <h1>{t("Environmental action. Evidence you can follow.", "了解环境行动，看清每份证据。")}</h1>
        <p className="cp-lede">{t("Understand how field observations become records that others can check. CanopyProof brings sources, review steps and open questions together for communities, schools and project teams.", "了解现场观察如何成为可供他人查阅的记录。CanopyProof 帮助社区、学校与项目团队一起看清信息来源、审核步骤，以及尚未解决的问题。")}</p>
        <div className="cp-hero-actions"><a className="cp-button cp-button-primary" href="#how-it-works">{t("See the four steps", "了解四个步骤")}</a><a className="cp-button cp-button-secondary" href={zh ? "/zh/evidence" : "/evidence"}>{t("Explore an example", "查看记录示例")}</a></div>
        <p className="mt-6 max-w-xl text-sm leading-6 text-zinc-300">{t("Public guide and sample interface. Demo data explains the process; it does not report verified results from a real project.", "公开指南与界面示例。演示数据用于说明流程，不代表真实项目的已核实成果。")}</p>
      </div>
      <div className="cp-hero-visual"><EarthOrb /><p className="text-center text-sm text-zinc-400">{t("Illustration of connected evidence sources", "不同证据来源之间的联系示意")}</p></div>
    </section>
    <section className="cp-section" id="protocol">
      <div className="cp-section-heading"><p className="cp-eyebrow">{t("A SHARED RECORD", "让记录更清楚")}</p><h2>{t("Know what happened, and how we know.", "发生了什么？我们凭什么知道？")}</h2><p>{t("An observation, an estimate and a verified result answer different questions. Keeping their status clear helps people decide what they can rely on.", "观察、估算和核实结果回答的是不同问题。标明各自的状态，才能帮助读者判断哪些信息可以作为依据。")}</p></div>
      <div className="grid gap-5 md:grid-cols-3">{[
        [t("For communities", "社区"), t("Keep local observations connected to their source and context.", "保留在地观察的来源和背景，让现场经验有迹可循。")],
        [t("For schools and families", "学校与家庭"), t("Practice asking where information comes from and what it can tell us.", "练习追问信息从哪里来，又能说明什么。")],
        [t("For organizations", "机构与项目团队"), t("Review evidence, responsibilities and gaps before using a result in a report.", "将结论写入报告前，先核对证据、责任分工与资料缺口。")],
      ].map(([title, text]) => <article className="rounded-xl border border-zinc-700 p-6" key={title}><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-zinc-300">{text}</p></article>)}</div>
    </section>
    <section className="cp-section" id="how-it-works">
      <div className="cp-section-heading"><p className="cp-eyebrow">{t("HOW IT WORKS", "如何运作")}</p><h2>{t("Four steps to a clearer record", "让记录更清楚的四个步骤")}</h2><p>{t("This is the intended review process. The public site provides examples; live intake and publication depend on service availability and the project involved.", "以下说明审核流程。公开网站提供示例；真实资料接收与记录公开，需要以相关服务和项目的实际开放情况为准。")}</p></div>
      <ol className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{steps.map(([title, text], i) => <li className="rounded-xl border border-zinc-700 p-6" key={title}><span className="text-sm text-emerald-300">0{i + 1}</span><h3 className="mt-4 text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-zinc-300">{text}</p></li>)}</ol>
    </section>
    <section className="cp-section" id="methodology">
      <div className="cp-section-heading"><p className="cp-eyebrow">{t("REVIEW APPROACH", "审核方法")}</p><h2>{t("Check the source before using the result.", "先核对来源，再使用结论。")}</h2><p>{t("A useful record shows the observation date, source material, method, reviewer and any unresolved concerns. Satellite images and AI analysis may support a review; neither replaces the evidence a specific claim requires.", "一份有用的记录，应说明观察日期、原始材料、采用的方法、审核人员，以及尚未解决的问题。卫星图像和 AI 分析可以辅助审核，但不能代替具体结论所需的证据。")}</p></div>
      <div className="grid gap-5 md:grid-cols-2"><article className="rounded-xl border border-zinc-700 p-6"><h3 className="text-xl font-semibold">{t("What an environmental record includes", "环境记录包含什么")}</h3><p className="mt-3 leading-7 text-zinc-300">{t("Project context, permitted evidence, review status and a reference for later checks. Private information should be removed before publication.", "项目背景、获准使用的证据、审核状态，以及便于后续核查的记录编号。公开前应移除私密信息。")}</p></article><article className="rounded-xl border border-zinc-700 p-6"><h3 className="text-xl font-semibold">{t("What it does not establish", "哪些结论仍需另行核实")}</h3><p className="mt-3 leading-7 text-zinc-300">{t("A record is not a certified carbon credit. A learning activity, a photograph or a map does not by itself prove a tree's survival, carbon removal or land ownership.", "一份记录不等于核证碳信用。一次学习活动、一张照片或一幅地图，本身都不能证明树木存活、碳移除量或土地所有权。")}</p></article></div>
    </section>
    <section className="cp-section" id="explorer">
      <div className="cp-section-heading"><p className="cp-eyebrow">{t("PUBLIC RECORDS", "公开记录")}</p><h2>{t("Look up a record by its public project ID.", "使用公开项目编号查阅记录。")}</h2><p>{t("Use an ID supplied with an approved publication. The Explorer checks whether a public record is available and shows its current status. Private identities, precise coordinates and raw evidence stay out of the public view.", "请使用已获准公开的项目编号。查询页会检查记录是否可用，并展示当前状态；个人身份、精确坐标和原始证据不会在这里公开。")}</p></div>
      <p className="mb-6 max-w-3xl text-sm leading-6 text-zinc-300">{t("The Explorer never substitutes demo records when a public record is unavailable. You will see a clear unavailable message instead.", "真实公开记录暂不可用时，查询页会明确提示，不会用演示记录替代。")}</p>
      {zh ? <a className="cp-button cp-button-primary" href="/explorer?lang=zh">查看公开记录</a> : <a className="cp-button cp-button-primary" href="/explorer">Open Public Explorer</a>}
    </section>
    <section className="cp-section" id="telemetry">
      <div className="cp-section-heading"><p className="cp-eyebrow">{t("EARTH OBSERVATION", "地球观测")}</p><h2>{t("See changes in context.", "结合背景，理解环境变化。")}</h2><p>{t("Satellite imagery can help people compare vegetation, water and land cover over time. Check the provider, capture date, resolution and method before drawing a conclusion about a place.", "卫星图像可以帮助比较不同时期的植被、水体和地表覆盖。判断某个地点的变化前，请先核对提供方、采集日期、分辨率和处理方法。")}</p></div>
      <div className="cp-hero-actions"><a className="cp-button cp-button-secondary" href={zh ? "/zh/earth" : "/earth"}>{t("Explore the reference map", "查看地图示例")}</a><a className="cp-button cp-button-ghost" href="/terra">{t("Open satellite tools", "打开卫星资料工具（英文）")}</a></div>
    </section>
    <section className="cp-section" id="stack">
      <div className="cp-section-heading"><p className="cp-eyebrow">{t("FOR PROJECT TEAMS", "给项目团队")}</p><h2>{t("Plan the work before connecting a project.", "先明确工作安排，再接入项目。")}</h2><p>{t("Agree who provides evidence, who may review it, what can be published and who handles corrections. Technical documentation is available for teams assessing an integration.", "先确定由谁提供证据、谁负责审核、哪些信息可以公开，以及谁处理更正。评估接入的团队可以进一步查阅技术文档。")}</p></div>
      <a className="cp-button cp-button-secondary" href="https://github.com/Dropineth/dropin" rel="noreferrer">{t("Read project documentation", "查看项目文档")} ↗</a>
    </section>
    <section className="cp-section cp-closing" id="contact">
      <h2>{t("Start with a question you want to answer.", "从你关心的一个问题开始。")}</h2><p>{t("Explore the learning guide, read the common questions or prepare a collaboration enquiry. No real child information is needed to explore these pages.", "可以先阅读学习指南和常见问题，也可以整理合作需求。浏览这些页面无需提供真实儿童信息。")}</p>
      <div className="cp-hero-actions"><a className="cp-button cp-button-primary" href={zh ? "/zh/children" : "/children"}>{t("Children and family guide", "儿童与家长指南")}</a><a className="cp-button cp-button-secondary" href={zh ? "/life/partners" : "/en/life/partners"}>{t("Discuss collaboration", "了解合作方式")}</a><a className="cp-button cp-button-ghost" href={localized("/faq")}>{t("Common questions", "常见问题")}</a></div>
    </section>
    <footer className="cp-footer"><div><strong>CanopyProof by Dropin</strong><p>{t("Environmental learning and evidence, explained clearly.", "把环境学习与证据说明白。")}</p></div><p>{t("Examples explain the workflow. They are not verified project outcomes or certified carbon credits.", "示例用于说明流程，不代表已核实的项目成果或核证碳信用。")}</p><a href={localized("/about")}>{t("About CanopyProof", "认识 CanopyProof")}</a></footer>
  </main>;
}
