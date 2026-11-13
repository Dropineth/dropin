"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  evidenceStages,
  planetaryPath,
  referenceEvidence,
  referenceLifePath,
  referenceRooms,
  type PlanetaryLocale,
  type PlanetaryView,
} from "@/data/planetary-reference";
import { ReferenceGlobe } from "./ReferenceGlobe";
import styles from "./ReferencePanels.module.css";

type LocalizedProps = { locale: PlanetaryLocale };
type ReferencePanelsProps = LocalizedProps & { view: PlanetaryView };

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.field}><dt>{label}</dt><dd>{children}</dd></div>;
}

function EarthPanel({ locale }: LocalizedProps) {
  const [region, setRegion] = useState<"geography" | "life">("geography");
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const life = region === "life";
  return <>
    <div className={styles.earthGrid}>
      <section className={`${styles.card} ${styles.globeCard}`} aria-label={t("Explore the globe", "探索地球")}>
        <div className={styles.cardTop}><span className={styles.eyebrow}>{t("PLACES IN CONTEXT", "了解地区背景")}</span><span className={styles.smallTag}>WGS84</span></div>
        <ReferenceGlobe locale={locale} compact />
        <div className={styles.segmented} role="group" aria-label={t("Choose a place to explore", "选择要了解的地区")}>
          <button type="button" aria-pressed={!life} aria-controls="reference-place" onClick={() => setRegion("geography")}>{t("Côte d’Ivoire example", "科特迪瓦示例")}</button>
          <button type="button" aria-pressed={life} aria-controls="reference-place" className={styles.lifeToggle} onClick={() => setRegion("life")}>{t("Life++HERE community plan", "Life++HERE 社区规划")}</button>
        </div>
        <p className={styles.caption}>{t("The map provides regional context. Markers do not identify surveyed land or an active project.", "地图帮助了解地区背景。标记不代表实测地块或正在开展的项目。")}</p>
      </section>
      <section className={`${styles.card} ${life ? styles.lifeCard : ""}`} id="reference-place" aria-live="polite" aria-atomic="true">
        <p className={styles.eyebrow}>{life ? t("LIFE++HERE / IN PLANNING", "LIFE++HERE / 规划中") : t("REGIONAL EXAMPLE", "地区示例")}</p>
        <h2>{life ? t("Shenzhen · Life++HERE", "深圳 · Life++HERE") : t("Côte d’Ivoire", "科特迪瓦")}</h2>
        <p className={styles.bodyCopy}>{life ? t("A proposal for three community spaces, bringing together AI assistance, spatial experiences and shared learning. The plan is available to explore; the venue is not yet open.", "由三处空间组成的社区中心规划，涵盖智能助手、空间体验与共同学习。你可以先了解方案，场地尚未开放。") : t("Explore how an environmental record can connect to a place. This country-level example introduces the steps from a location to an observation and its sources.", "环境记录与地点有什么关系？这个国家层面的示例，帮助你了解如何从地区背景找到观察记录及其来源。")}</p>
        <dl className={styles.fields}>
          <Field label={t("What is shown", "展示内容")}>{life ? t("Three proposed community spaces", "三处社区空间规划") : t("A country-level example", "国家层面的地区示例")}</Field>
          <Field label={t("Surveyed project boundary", "实测项目边界")}>{t("Not confirmed", "尚未确认")}</Field>
          <Field label={t("Field observations", "现场观察资料")}>{t("Not supplied", "尚未提供")}</Field>
          <Field label={t("Verified environmental results", "已核证环境成果")}>{t("Not confirmed", "尚未确认")}</Field>
        </dl>
        <Link className={styles.primaryLink} href={life ? referenceLifePath("/life/center", locale) : planetaryPath("/evidence", locale)}>{life ? t("Explore the community plan", "查看社区空间规划") : t("Explore a sample record", "查看一条示例记录")}<Arrow /></Link>
        {life && <p className={styles.caption}>{t("Leases, partnerships, opening dates and any robot services still require separate confirmation.", "租赁安排、合作关系、开放时间与机器人服务均需另行确认。")}</p>}
      </section>
    </div>
    {life ? <div className={styles.roomGrid} aria-label={t("Three proposed spaces", "三处拟议空间")}>
      {referenceRooms.map(room => <article key={room.id} className={`${styles.card} ${styles.roomCard}`}><span className={styles.roomId}>{room.id}</span><span className={styles.proposed}>{t("IN PLANNING", "规划中")}</span><h3>{room.title[locale]}</h3><p>{room.description[locale]}</p></article>)}
    </div> : <div className={styles.routeStrip}>
      <p className={styles.eyebrow}>{t("FROM PLACE TO RECORD", "从地点到记录")}</p>
      <ol>{[t("Region", "区域"), t("Parcel", "地块"), t("Observation", "观察"), t("Record", "记录")].map((label, index) => <li key={label}><span>0{index + 1}</span>{label}</li>)}</ol>
      <p>{t("This is an example of how records can be organised. No live project records are connected to this map.", "以上展示记录的组织方式。目前地图尚未接入真实项目记录。")}</p>
    </div>}
  </>;
}

/** Deterministic illustration; positions have no metric or environmental meaning. */
function ForestIllustration({ locale }: LocalizedProps) {
  const trees = [{ x: 99, y: 175, size: 0.75 }, { x: 160, y: 144, size: 0.88 }, { x: 246, y: 187, size: 1.06 }, { x: 315, y: 134, size: 0.76 }, { x: 385, y: 180, size: 0.94 }, { x: 181, y: 241, size: 1.02 }, { x: 336, y: 258, size: 1.12 }];
  return <svg className={styles.forest} viewBox="0 0 500 360" role="img" aria-label={locale === "zh" ? "森林示意图，用于说明记录结构，不包含实测或碳量数据" : "A forest illustration for explaining records, with no field measurements or carbon data"}>
    <defs><radialGradient id="reference-forest-glow"><stop stopColor="#245e61" /><stop offset="1" stopColor="#11383f" /></radialGradient></defs>
    <rect width="500" height="360" fill="url(#reference-forest-glow)" />
    <g stroke="#518486" strokeWidth="0.7" opacity="0.35" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map(i => <path key={i} d={`M ${35 + i * 40} 245 L ${205 + i * 40} 160 M ${55 + i * 45} 195 L ${225 + i * 35} 302`} />)}
    </g>
    <g aria-hidden="true">{trees.map((tree, treeIndex) => <g key={tree.x} transform={`translate(${tree.x} ${tree.y}) scale(${tree.size})`}>
      {[0, 1, 2, 3, 4, 5, 6].map(i => <circle key={`trunk-${i}`} cx={(i % 2) * 2} cy={-i * 6} r="1.6" fill="#c5b891" opacity="0.8" />)}
      {Array.from({ length: 74 }, (_, i) => {
        const ring = Math.floor(i / 10);
        const angle = i * 2.4 + treeIndex;
        const radius = (8 - ring) * 4.7;
        return <circle key={i} cx={Math.cos(angle) * radius} cy={-30 - ring * 8 + Math.sin(angle) * radius * 0.45} r={i % 3 === 0 ? "1.9" : "1.3"} fill={i % 4 === 0 ? "#d8ead0" : "#82c8ac"} opacity={0.5 + (i % 4) * 0.13} />;
      })}
    </g>)}</g>
    <g fill="#a9cbc6" fontFamily="monospace" fontSize="10" aria-hidden="true"><text x="22" y="29">{locale === "zh" ? "森林示意" : "SAMPLE ILLUSTRATION"}</text><text x="22" y="333">{locale === "zh" ? "非现场测量" : "NOT A FIELD SURVEY"}</text><text x="434" y="333">01</text></g>
  </svg>;
}

const inspectorTabs = ["record", "lineage", "boundaries"] as const;
type InspectorTab = typeof inspectorTabs[number];

function EvidencePanel({ locale }: LocalizedProps) {
  const [tab, setTab] = useState<InspectorTab>("record");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const unknown = t("Not supplied", "尚未提供");
  const tabLabels = { record: t("Record", "记录"), lineage: t("Sources", "来源"), boundaries: t("Use & limits", "适用范围") };
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % inspectorTabs.length;
    else if (event.key === "ArrowLeft") next = (index + inspectorTabs.length - 1) % inspectorTabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = inspectorTabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = inspectorTabs[next];
    if (!nextTab) return;
    setTab(nextTab);
    tabRefs.current[next]?.focus();
  }
  return <>
    <div className={styles.evidenceGrid}>
      <section className={`${styles.card} ${styles.forestCard}`}>
        <div className={styles.cardTop}><span className={styles.eyebrow}>{t("ILLUSTRATED EXAMPLE", "图示示例")}</span><span className={styles.darkTag}>{t("NO FIELD DATA", "不含现场数据")}</span></div>
        <h2>{t("A forest, illustrated", "用一片森林理解记录")}</h2>
        <ForestIllustration locale={locale} />
        <p>{t("This illustration helps explain how a record works. Its dots do not represent counted trees, survey points or measured carbon.", "这幅示意图用于帮助理解记录。图中的点不代表已清点的树木、测绘点或实测碳量。")}</p>
        <Link className={styles.lightLink} href={referenceLifePath("/life/spaces", locale)}>{t("Explore spatial examples", "查看空间示例")}<Arrow /></Link>
      </section>
      <section className={`${styles.card} ${styles.inspector}`} aria-label={t("Sample environmental record", "环境记录示例")}>
        <div className={styles.cardTop}><span className={styles.eyebrow}>{t("SAMPLE RECORD", "示例记录")}</span><span className={styles.smallTag}>{t("EXAMPLE", "示例")}</span></div>
        <h2>{t("What supports this record?", "这条记录有哪些依据？")} </h2>
        <div role="tablist" aria-label={t("Record details", "记录详情")} className={styles.tabs}>
          {inspectorTabs.map((item, index) => <button key={item} ref={element => { tabRefs.current[index] = element; }} type="button" role="tab" id={`reference-tab-${item}`} aria-controls="reference-panel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={event => moveTab(event, index)}>{tabLabels[item]}</button>)}
        </div>
        <div className={styles.tabPanel} role="tabpanel" id="reference-panel" aria-labelledby={`reference-tab-${tab}`} tabIndex={0}>
          {tab === "record" && <><dl className={styles.fields}>
            <Field label={t("Record ID", "记录编号")}><code>{referenceEvidence.id}</code></Field>
            <Field label={t("Source version", "来源版本")}>{unknown}</Field>
            <Field label={t("Source", "来源")}>{unknown}</Field>
            <Field label={t("Capture date", "采集日期")}>{unknown}</Field>
            <Field label={t("Permission to use", "使用许可")}>{unknown}</Field>
          </dl><details className={styles.metadata}><summary>{t("Technical details", "技术详情")}</summary><dl className={styles.fields}>
            <Field label={t("Example template version", "示例模板版本")}><code>{referenceEvidence.templateVersion}</code></Field>
            <Field label={t("Source hash", "来源哈希")}>{unknown}</Field>
            <Field label={t("Coordinate system", "坐标系统")}>{unknown}</Field>
            <Field label={t("Metric scale", "测量比例")}>{unknown}</Field>
            <Field label={t("Registration error", "配准误差")}>{unknown}</Field>
          </dl><p className={styles.caption}>{t("The template version identifies this example. It does not certify the origin or accuracy of any field data.", "模板版本用于区分示例，不证明现场资料的来源或准确性。")}</p></details></>}
          {tab === "lineage" && <><p className={styles.bodyCopy}>{t("This illustration was created for the website. To assess a real environmental claim, you would need the following supporting records; none are supplied with this example.", "这幅图是为网站制作的示意图。判断真实环境声明时，需要查阅以下资料；本示例尚未提供这些依据。")}</p><ol className={styles.lineage}>{[t("Original observations and permissions", "原始观察资料与使用许可"), t("Location, scale and measurements", "地点、比例与测量结果"), t("Methods, uncertainty and independent review", "计算方法、误差范围与独立审核"), t("Credit issuance and retirement records, if relevant", "涉及碳信用时的签发与注销记录")].map(item => <li key={item}><span>{item}</span><small>{t("Not supplied", "尚未提供")}</small></li>)}</ol></>}
          {tab === "boundaries" && <><p className={styles.bodyCopy}>{t("Use this example to understand what to look for in a record. It cannot support a claim about a real forest, land ownership, measured carbon or a verified environmental result.", "你可以用这个示例了解如何阅读记录。它不能作为真实森林状况、土地权属、实测碳量或已核证环境成果的依据。")}</p><div className={styles.notice}>{t("This example contains no field observation, estimate, independent verification, credit issuance or retirement evidence.", "本示例不包含现场观察、估算、独立核证、碳信用签发或注销的证据。")}</div></>}
        </div>
      </section>
    </div>
    <section className={styles.statusSection} aria-labelledby="reference-evidence-status">
      <div className={styles.sectionHeading}><h2 id="reference-evidence-status">{t("Each step needs its own evidence.", "每一步，都需要相应依据。")}</h2><span className={styles.caption}>{t("These are possible record stages. This example has not completed any of them.", "以下介绍记录可能经历的阶段，本示例尚未完成其中任何一步。")}</span></div>
      <ol className={styles.statusGrid}>{evidenceStages.map((stage, index) => <li key={stage.id} data-evidence-state={stage.id} data-status="not-established"><span className={styles.stageNumber}>0{index + 1}</span><h3>{stage.title[locale]}</h3><p>{stage.description[locale]}</p><span className={styles.unestablished}>{t("Not confirmed", "尚未确认")}</span></li>)}</ol>
    </section>
    <div className={styles.authorityLink}><div><strong>{t("Looking for more records?", "想查看更多记录？")}</strong><p>{t("Check each entry’s own sources and status in the record explorer. The sample on this page does not verify other records.", "进入记录浏览器，查看每条记录各自的来源与状态。本页示例不为其他记录提供核证。")}</p></div><Link href={locale === "zh" ? "/explorer?lang=zh" : "/explorer"}>{t("Browse records", "浏览记录")}<Arrow /></Link></div>
  </>;
}

function ParticipationPanel({ locale }: LocalizedProps) {
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const children = locale === "zh" ? "/zh/child-accounts" : "/child-accounts";
  return <>
    <div className={styles.participationGrid}>
      <section className={`${styles.card} ${styles.participationCard}`}>
        <span className={styles.eyebrow}>{t("FAMILIES & CLASSROOMS", "家庭与课堂")}</span>
        <h2>{t("Make room for curiosity.", "从一个小发现开始。")}</h2>
        <p className={styles.bodyCopy}>{t("Try a nature-learning demo together. Children can explore sample observations, make their own choices and pause when they want. Parents and teachers can preview the experience before discussing a real activity.", "一起体验自然观察学习：看看示例，说说发现，让孩子自己选择，也可以随时停下来。家长和老师可以先了解体验，再讨论适合孩子的真实活动。")}</p>
        <a className={styles.primaryLink} href={children}>{t("Read the learning guide", "阅读学习指南")}<Arrow /></a>
        <p className={styles.caption}>{t("The demo uses sample information. You do not need to upload a child’s photo or identity documents.", "演示使用示例信息，无需上传孩子的照片或身份证明。")}</p>
        <div className={styles.notice}>{t("Planning a class or family activity? Start by reviewing the demo with the adults and children who would take part.", "准备开展课堂或家庭活动？先和参与的成人、孩子一起了解演示内容与参与选择。")}</div>
      </section>
      <div className={styles.stackedCards}>
        <section className={`${styles.card} ${styles.lifeCard}`}><span className={styles.eyebrow}>{t("SCHOOLS & ORGANISATIONS", "学校与机构")}</span><h2>{t("Shape a useful pilot.", "从具体需求讨论试点。")}</h2><p className={styles.bodyCopy}>{t("Describe the people you work with, the problem you want to address and what you hope to learn. Prepare an enquiry about community learning, environmental records or a shared-space project.", "说明服务对象、想解决的问题与希望了解的结果。你可以围绕社区学习、环境记录或共享空间项目，整理合作咨询内容。")}</p><Link className={styles.textLink} href={referenceLifePath("/life/partners", locale)}>{t("Prepare a pilot enquiry", "整理试点合作需求")}<Arrow /></Link></section>
        <section className={styles.card}><span className={styles.eyebrow}>{t("EXPLORE & UNDERSTAND", "了解记录与规划")}</span><h2>{t("See what is available today.", "先看看目前有什么。")}</h2><p className={styles.bodyCopy}>{t("Browse environmental record examples or explore the Life++HERE community-space plan. Each page explains what is a sample, what is proposed and what is available.", "浏览环境记录示例，或了解 Life++HERE 社区空间规划。各页面会说明哪些是示例、哪些仍在规划，以及目前可以做什么。")}</p><div className={styles.linkRow}><Link className={styles.textLink} href={planetaryPath("/evidence", locale)}>{t("Explore a sample record", "查看记录示例")}<Arrow /></Link><Link className={styles.textLink} href={referenceLifePath("/life", locale)}>{t("Explore Life++HERE", "了解 Life++HERE")}<Arrow /></Link></div></section>
      </div>
    </div>
    <details className={`${styles.metadata} ${styles.participationDetails}`}>
      <summary>{t("Payments, funding and financial participation", "支付、资金与出资参与")}</summary>
      <p className={styles.bodyCopy}>{t("Payments and financial participation are not available on this page. It is not connected to live fund balances, allocation records or transaction receipts. Missing information should not be read as a zero balance.", "本页尚未开放支付或出资参与，也未接入实时资金余额、拨付记录或交易凭据。未显示余额不代表余额为零。")}</p>
      <dl className={styles.fields}>
        <Field label={t("Fund balances", "资金余额")}>{t("Not connected", "尚未接入")}</Field>
        <Field label={t("Allocation records", "拨付记录")}>{t("Not supplied", "尚未提供")}</Field>
        <Field label={t("Transaction receipts", "交易凭据")}>{t("Not supplied", "尚未提供")}</Field>
      </dl>
      <p className={styles.caption}>{t("This page confirms no contribution, allocation, settlement or return. Any financial claim needs its own attributable records.", "本页不确认任何出资、拨付、结算或收益。相关资金声明需要可追溯的独立记录。")}</p>
    </details>
  </>;
}

function TrustPanel({ locale }: LocalizedProps) {
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const boundaries = [
    { title: t("Know what the map shows.", "先了解地图展示的内容。"), body: t("The globe helps you locate a country or city. A marker gives geographic context; a real project also needs a defined site, supporting records and confirmed rights.", "地球视图帮助你找到国家或城市，标记仅提供地区背景。真实项目还需要明确的场地范围、支持资料与已确认的权利。"), status: t("GEOGRAPHIC CONTEXT", "地区背景") },
    { title: t("Recognise an illustration.", "分清示意图与实测资料。"), body: t("A visual example can help explain a place or a process. Measurements, safe navigation, ownership and environmental results need evidence beyond an image.", "图像示例有助于理解空间或流程。测量结果、导航安全、权属与环境成果，都需要图像之外的依据。"), status: t("SAMPLE VISUALS", "示例图像") },
    { title: t("Check the original source.", "追溯到原始来源。"), body: t("Look for who collected the information, when it was collected and whether it may be used. An unchanged file alone cannot confirm that its contents are true or authorised.", "查看资料由谁采集、何时采集，以及是否获得使用许可。文件内容没有变化，并不意味着内容真实或已获授权。"), status: t("SOURCE & PERMISSION", "来源与许可") },
    { title: t("Look for each review step.", "逐项查看审核与登记记录。"), body: t("Observation, estimation and independent verification are different steps. Carbon-credit issuance and retirement each need their own records. These examples issue no credits.", "观察、估算与独立核证是不同环节。碳信用的签发与注销也各有对应记录。本站示例不会签发碳信用。"), status: t("REVIEW & REGISTRY", "审核与登记") },
  ];
  return <>
    <div className={styles.trustGrid}>{boundaries.map((item, index) => <article className={styles.card} key={item.title}><div className={styles.cardTop}><span className={styles.stageNumber}>0{index + 1}</span><span className={styles.smallTag}>{item.status}</span></div><h2>{item.title}</h2><p className={styles.bodyCopy}>{item.body}</p></article>)}</div>
    <details className={`${styles.card} ${styles.sceneDisclosure}`}>
      <summary id="reference-scene-boundary">{t("Details about spatial examples 33 and 29", "空间示例 33 与 29 的详细说明")}</summary>
      <div className={styles.sceneBoundary} aria-labelledby="reference-scene-boundary">
        <div><p className={styles.eyebrow}>{t("LIFE++HERE / SPATIAL EXAMPLES", "LIFE++HERE / 空间示例")}</p><h2>{t("Check each scene’s own record.", "按场景查阅各自记录。")}</h2><p className={styles.bodyCopy}>{t("Scenes 33 and 29 are separate spatial examples. Their 3D assets are not loaded on this page, and neither scene is identified here as one of the proposed community spaces or as a forest.", "场景 33 与 29 是两个独立的空间示例。本页未加载其三维数据，也未将它们认定为规划中的社区空间或森林。")}</p><div className={styles.linkRow}><Link className={styles.textLink} href={referenceLifePath("/life/spaces/33", locale)}>{t("Scene 33 record", "场景 33 记录")}<Arrow /></Link><Link className={styles.textLink} href={referenceLifePath("/life/spaces/29", locale)}>{t("Scene 29 record", "场景 29 记录")}<Arrow /></Link></div></div>
        <dl className={styles.fields}><Field label={t("3D data on this page", "本页三维数据")}>{t("Not loaded", "未加载")}</Field><Field label={t("Capture date and source version", "采集日期与来源版本")}>{t("Not supplied", "尚未提供")}</Field><Field label={t("Third-party permissions", "第三方许可")}>{t("Not verified", "尚未核验")}</Field><Field label={t("Measurement accuracy", "测量精度")}>{t("Not verified", "尚未核验")}</Field></dl>
      </div>
    </details>
    <div className={styles.sourceFooter}><div><h2>{t("Read a record in its own context.", "结合每条记录的背景来判断。")}</h2><p>{t("Environmental records, spatial examples and community plans serve different purposes. Follow the source links and check the status shown on each page before relying on a claim.", "环境记录、空间示例与社区规划各有用途。判断相关声明前，请通过来源链接查阅详情，并确认对应页面标明的状态。")}</p></div><div className={styles.linkRow}><Link className={styles.textLink} href={locale === "zh" ? "/explorer?lang=zh" : "/explorer"}>{t("Browse records", "浏览记录")}<Arrow /></Link><Link className={styles.textLink} href={referenceLifePath("/life/trust", locale)}>{t("Life++HERE permissions", "Life++HERE 授权说明")}<Arrow /></Link></div></div>
  </>;
}

export function ReferencePanels({ view, locale }: ReferencePanelsProps) {
  return <div className={styles.root} data-scope={view === "evidence" ? "fixture" : "reference"} data-reference-view={view}>
    {view === "earth" && <EarthPanel locale={locale} />}
    {view === "evidence" && <EvidencePanel locale={locale} />}
    {view === "participation" && <ParticipationPanel locale={locale} />}
    {view === "trust" && <TrustPanel locale={locale} />}
  </div>;
}

export default ReferencePanels;
