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
      <section className={`${styles.card} ${styles.globeCard}`} aria-label={t("Reference globe", "参考地球")}>
        <div className={styles.cardTop}><span className={styles.eyebrow}>{t("REFERENCE GEOGRAPHY", "参考地理")}</span><span className={styles.smallTag}>WGS84</span></div>
        <ReferenceGlobe locale={locale} compact />
        <div className={styles.segmented} role="group" aria-label={t("Choose a reference context", "选择参考情境")}>
          <button type="button" aria-pressed={!life} aria-controls="reference-place" onClick={() => setRegion("geography")}>{t("Example geography", "地理示例")}</button>
          <button type="button" aria-pressed={life} aria-controls="reference-place" className={styles.lifeToggle} onClick={() => setRegion("life")}>{t("Life++ four-shop concept", "Life++ 四铺构想")}</button>
        </div>
        <p className={styles.caption}>{t("Regional context only. The globe does not identify surveyed parcels, land rights or active projects.", "仅用于区域参考。地球展示不标定测绘地块、土地权利或在运项目。")}</p>
      </section>
      <section className={`${styles.card} ${life ? styles.lifeCard : ""}`} id="reference-place" aria-live="polite" aria-atomic="true">
        <p className={styles.eyebrow}>{life ? "LIFE++ / CONCEPT" : t("SELECTED CONTEXT", "当前参考情境")}</p>
        <h2>{life ? t("Shenzhen · Life++", "深圳 · Life++") : t("Côte d’Ivoire", "科特迪瓦")}</h2>
        <p className={styles.bodyCopy}>{life ? t("Four proposed spaces for people, local intelligence and shared learning. Their inclusion is a planning reference.", "面向人、在地智能与共同学习的四处拟议空间。本页仅引用其规划构想。") : t("A country-level example for exploring how ecological evidence could be organized, from regional context to an individual source record.", "用于探索生态证据组织方式的国家级示例：从区域背景，逐步追溯到单条来源记录。")}</p>
        <dl className={styles.fields}>
          <Field label={t("Display scope", "展示范围")}>{life ? t("Four-shop planning concept", "四铺规划构想") : t("Country-level reference", "国家级参考")}</Field>
          <Field label={t("Project boundary", "项目边界")}>{t("Not established", "尚未建立")}</Field>
          <Field label={t("Source capture", "现场采集")}>{t("Not connected", "尚未接入")}</Field>
          <Field label={t("Verified ecological outcome", "已核证生态成果")}>{t("Not established", "尚未建立")}</Field>
        </dl>
        <Link className={styles.primaryLink} href={life ? referenceLifePath("/life/center", locale) : planetaryPath("/evidence", locale)}>{life ? t("Open the existing Life++ plan", "查看既有 Life++ 规划") : t("Inspect the evidence structure", "查看证据结构")}<Arrow /></Link>
        {life && <p className={styles.caption}>{t("No lease, partnership, opening or robot operation is established by this reference.", "本参考不证明租约、合作、开放营业或机器人运营已成立。")}</p>}
      </section>
    </div>
    {life ? <div className={styles.roomGrid} aria-label={t("Four proposed spaces", "四处拟议空间")}>
      {referenceRooms.map(room => <article key={room.id} className={`${styles.card} ${styles.roomCard}`}><span className={styles.roomId}>{room.id}</span><span className={styles.proposed}>{t("PROPOSED", "拟议空间")}</span><h3>{room.title[locale]}</h3><p>{room.description[locale]}</p></article>)}
    </div> : <div className={styles.routeStrip}>
      <p className={styles.eyebrow}>{t("A REFERENCE PATH", "参考路径")}</p>
      <ol>{[t("Region", "区域"), t("Parcel", "地块"), t("Capture", "采集"), t("Record", "记录")].map((label, index) => <li key={label}><span>0{index + 1}</span>{label}</li>)}</ol>
      <p>{t("Selecting a context changes this explanation only; it does not load a project registry.", "选择情境仅切换本页说明，不会加载项目登记库。")}</p>
    </div>}
  </>;
}

/** Deterministic illustration; positions have no metric or environmental meaning. */
function ForestIllustration({ locale }: LocalizedProps) {
  const trees = [{ x: 99, y: 175, size: 0.75 }, { x: 160, y: 144, size: 0.88 }, { x: 246, y: 187, size: 1.06 }, { x: 315, y: 134, size: 0.76 }, { x: 385, y: 180, size: 0.94 }, { x: 181, y: 241, size: 1.02 }, { x: 336, y: 258, size: 1.12 }];
  return <svg className={styles.forest} viewBox="0 0 500 360" role="img" aria-label={locale === "zh" ? "程序化森林点阵示意，没有现场采集、测量比例或碳量" : "Procedural forest dot illustration with no capture, survey scale or carbon measurement"}>
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
    <g fill="#a9cbc6" fontFamily="monospace" fontSize="10" aria-hidden="true"><text x="22" y="29">FIXTURE / PROCEDURAL</text><text x="22" y="333">NO CAPTURE · NO METRIC SCALE</text><text x="434" y="333">01</text></g>
  </svg>;
}

const inspectorTabs = ["record", "lineage", "boundaries"] as const;
type InspectorTab = typeof inspectorTabs[number];

function EvidencePanel({ locale }: LocalizedProps) {
  const [tab, setTab] = useState<InspectorTab>("record");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const unknown = t("UNKNOWN", "UNKNOWN · 未知");
  const tabLabels = { record: t("Record", "记录"), lineage: t("Lineage", "来源链"), boundaries: t("Boundaries", "边界") };
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
        <div className={styles.cardTop}><span className={styles.eyebrow}>{t("PROCEDURAL FIXTURE", "程序化示例")}</span><span className={styles.darkTag}>{t("NO CAPTURED 3DGS", "非实景 3DGS")}</span></div>
        <h2>{t("Forest structure study", "森林结构示意")}</h2>
        <ForestIllustration locale={locale} />
        <p>{t("Illustrative dots describe a visual structure only. They are not trees counted, survey points, captured Gaussian splats or carbon units.", "图形点阵仅用于展示结构，不是树木计数、测绘点、实景高斯数据或碳计量单位。")}</p>
        <Link className={styles.lightLink} href={referenceLifePath("/life/spaces", locale)}>{t("View existing spatial test records", "查看既有空间测试记录")}<Arrow /></Link>
      </section>
      <section className={`${styles.card} ${styles.inspector}`} aria-label={t("Sample evidence inspector", "样例证据查看器")}>
        <div className={styles.cardTop}><span className={styles.eyebrow}>{t("SAMPLE RECORD", "样例记录")}</span><span className={styles.smallTag}>FIXTURE</span></div>
        <h2>{t("Evidence before a claim.", "先有依据，再作声明。")} </h2>
        <div role="tablist" aria-label={t("Evidence detail", "证据详情")} className={styles.tabs}>
          {inspectorTabs.map((item, index) => <button key={item} ref={element => { tabRefs.current[index] = element; }} type="button" role="tab" id={`reference-tab-${item}`} aria-controls="reference-panel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={event => moveTab(event, index)}>{tabLabels[item]}</button>)}
        </div>
        <div className={styles.tabPanel} role="tabpanel" id="reference-panel" aria-labelledby={`reference-tab-${tab}`} tabIndex={0}>
          {tab === "record" && <><dl className={styles.fields}>
            <Field label={t("Record ID", "记录标识")}><code>{referenceEvidence.id}</code></Field>
            <Field label={t("Source version", "来源版本")}>{unknown}</Field>
            <Field label={t("Source", "来源")}>{unknown}</Field>
            <Field label={t("Capture date", "采集日期")}>{unknown}</Field>
            <Field label={t("Rights", "权利许可")}>{unknown}</Field>
          </dl><details className={styles.metadata}><summary>{t("Expand sample metadata", "展开样例元数据")}</summary><dl className={styles.fields}>
            <Field label={t("UI template version", "界面模板版本")}><code>{referenceEvidence.templateVersion}</code></Field>
            <Field label={t("Source hash", "来源哈希")}>{unknown}</Field>
            <Field label={t("Coordinate system", "坐标系统")}>{unknown}</Field>
            <Field label={t("Metric scale", "测量比例")}>{unknown}</Field>
            <Field label={t("Registration error", "配准误差")}>{unknown}</Field>
          </dl><p className={styles.caption}>{t("The UI template version identifies this example only. It is not a source-asset version or an authenticity certificate.", "界面模板版本仅标识此示例，不是来源资产的版本或真实性证书。")}</p></details></>}
          {tab === "lineage" && <><p className={styles.bodyCopy}>{t("The illustration was generated for this interface. No field capture or external scene is attached to this sample record.", "本图形专为界面示意生成。此样例记录未绑定现场采集或外部场景。")}</p><ol className={styles.lineage}>{[t("Source capture and permissions", "来源采集与许可"), t("Scale, registration and measurements", "尺度、配准与测量"), t("Method, uncertainty and independent review", "方法、不确定性与独立审核"), t("Registry and retirement references", "登记与注销记录")].map(item => <li key={item}><span>{item}</span><small>{t("Not supplied", "尚未提供")}</small></li>)}</ol></>}
          {tab === "boundaries" && <><p className={styles.bodyCopy}>{t("A rendered image does not establish measurement accuracy. A template or file hash can identify bytes; it cannot establish capture authenticity, land rights or carbon verification.", "渲染图像不建立测量精度。模板或文件哈希可标识字节，不能证明采集真实性、土地权利或碳核证。")}</p><div className={styles.notice}>{t("No observation, estimate, independent verification, issuance or retirement is established by this fixture.", "此示例未建立现场观测、估算、独立核证、签发或注销的证据。")}</div></>}
        </div>
      </section>
    </div>
    <section className={styles.statusSection} aria-labelledby="reference-evidence-status">
      <div className={styles.sectionHeading}><h2 id="reference-evidence-status">{t("Separate records. Separate states.", "独立记录，独立状态。")}</h2><span className={styles.caption}>{t("This fixture establishes none of these states.", "本示例未建立以下任何状态。")}</span></div>
      <ol className={styles.statusGrid}>{evidenceStages.map((stage, index) => <li key={stage.id} data-evidence-state={stage.id} data-status="not-established"><span className={styles.stageNumber}>0{index + 1}</span><h3>{stage.title[locale]}</h3><p>{stage.description[locale]}</p><span className={styles.unestablished}>{t("Not established", "尚未建立")}</span></li>)}</ol>
    </section>
    <div className={styles.authorityLink}><div><strong>{t("Looking for canonical records?", "查找正式记录？")}</strong><p>{t("The existing explorer is a separate record source. This fixture does not fill gaps in its data or change its authority.", "既有浏览器是独立的记录来源。本示例不会填补其中的数据空缺，也不会改变其权威状态。")}</p></div><Link href="/explorer">{t("Open explorer", "打开记录浏览器")}<Arrow /></Link></div>
  </>;
}

function ParticipationPanel({ locale }: LocalizedProps) {
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  return <>
    <div className={styles.participationGrid}>
      <section className={`${styles.card} ${styles.participationCard}`}>
        <span className={styles.eyebrow}>{t("CURRENT PAGE STATUS", "当前页面状态")}</span>
        <div className={styles.lockSymbol} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><rect x="12" y="21" width="24" height="19" rx="4" /><path d="M17 21v-7a7 7 0 0 1 14 0v7M24 29v4" /></svg></div>
        <h2>{t("Informational. Read-only.", "信息展示，只读访问。")}</h2>
        <p className={styles.bodyCopy}>{t("This reference page is not connected to live fund records. Unknown values are left unknown; an unavailable balance is not a zero balance.", "本参考页尚未连接实时资金记录。未知值保持未知；余额不可用不等于余额为零。")}</p>
        <dl className={styles.fields}>
          <Field label={t("Live fund balance", "实时资金余额")}>{t("NOT VERIFIED", "NOT VERIFIED · 未核验")}</Field>
          <Field label={t("Allocation records", "拨付记录")}>{t("NOT VERIFIED", "NOT VERIFIED · 未核验")}</Field>
          <Field label={t("Transaction receipts", "交易凭据")}>{t("NOT VERIFIED", "NOT VERIFIED · 未核验")}</Field>
          <Field label={t("Financial actions on this page", "本页资金操作")}>{t("DISABLED", "DISABLED · 已关闭")}</Field>
        </dl>
        <button className={styles.disabledAction} type="button" disabled>{t("Financial participation unavailable", "资金参与暂未开放")}</button>
      </section>
      <div className={styles.stackedCards}>
        <section className={styles.card}><span className={styles.eyebrow}>{t("01 / EXPLORE", "01 / 探索")}</span><h2>{t("Start with a record.", "从一条记录开始。")} </h2><p className={styles.bodyCopy}>{t("Read the existing explorer and assess each record using its own source and status. This page makes no claim about live funds held elsewhere.", "在既有浏览器中，依据每条记录自身的来源与状态进行判断。本页不声明其他系统的实时资金状况。")}</p><Link className={styles.textLink} href="/explorer">{t("Open the record explorer", "打开记录浏览器")}<Arrow /></Link></section>
        <section className={`${styles.card} ${styles.lifeCard}`}><span className={styles.eyebrow}>{t("02 / LIFE++", "02 / LIFE++")}</span><h2>{t("Explore a shared-space concept.", "了解共生空间构想。")} </h2><p className={styles.bodyCopy}>{t("Visit the existing Life++ pages for the four-shop plan, spatial test records and responsibility boundaries.", "进入既有 Life++ 页面，了解四铺规划、空间测试记录与责任边界。")}</p><Link className={styles.textLink} href={referenceLifePath("/life", locale)}>{t("Discover Life++", "探索 Life++")}<Arrow /></Link></section>
      </div>
    </div>
    <div className={styles.notice}>{t("This page does not establish contributions, allocations, settlements or returns. Financial records require independently attributable sources.", "本页不建立出资、拨付、结算或收益事实。资金记录需要独立且可追溯的来源。")}</div>
  </>;
}

function TrustPanel({ locale }: LocalizedProps) {
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const boundaries = [
    { title: t("A globe gives context.", "地球提供区域背景。"), body: t("Reference geography locates a country or city. It does not identify a surveyed parcel, establish tenure or prove a project exists.", "参考地理用于定位国家或城市，不标定测绘地块、不建立地权，也不证明项目已成立。"), status: t("REFERENCE", "参考") },
    { title: t("A scene shows appearance.", "场景展示空间外观。"), body: t("A visual reconstruction does not by itself establish metric scale, navigation safety, ownership or ecological outcomes.", "视觉重建本身不建立测量比例、导航安全、权属或生态成果。"), status: t("DISPLAY BOUNDARY", "展示边界") },
    { title: t("A hash identifies bytes.", "哈希标识字节内容。"), body: t("A template hash or file hash does not establish capture authenticity, third-party permissions or the truth of a claim.", "模板或文件哈希不证明采集真实性、第三方许可或声明内容属实。"), status: t("IDENTITY ONLY", "仅作标识") },
    { title: t("A credit needs its own record.", "碳额度需要独立记录。"), body: t("This reference issues no carbon credits. Measurement, independent verification, issuance and retirement each require separate evidence.", "本参考不签发碳信用。测量、独立核证、签发与注销分别需要独立证据。"), status: t("NOT ESTABLISHED", "尚未建立") },
  ];
  return <>
    <div className={styles.trustGrid}>{boundaries.map((item, index) => <article className={styles.card} key={item.title}><div className={styles.cardTop}><span className={styles.stageNumber}>0{index + 1}</span><span className={styles.smallTag}>{item.status}</span></div><h2>{item.title}</h2><p className={styles.bodyCopy}>{item.body}</p></article>)}</div>
    <section className={`${styles.card} ${styles.sceneBoundary}`} aria-labelledby="reference-scene-boundary">
      <div><p className={styles.eyebrow}>LIFE++ / 3DGS</p><h2 id="reference-scene-boundary">{t("Scenes 33 / 29 remain blocked here.", "场景 33 / 29 在此保持关闭。")}</h2><p className={styles.bodyCopy}>{t("The existing scene records retain their original identity. This reference loads neither asset and does not bind either scene to the four shops or a forest.", "既有场景记录保留其原始身份。本参考未加载这两个资产，也未将其绑定到四铺或森林。")}</p><div className={styles.linkRow}><Link className={styles.textLink} href={referenceLifePath("/life/spaces/33", locale)}>{t("Scene 33 record", "场景 33 记录")}<Arrow /></Link><Link className={styles.textLink} href={referenceLifePath("/life/spaces/29", locale)}>{t("Scene 29 record", "场景 29 记录")}<Arrow /></Link></div></div>
      <dl className={styles.fields}><Field label={t("Real asset loading", "真实资产加载")}>{t("BLOCKED", "BLOCKED · 已关闭")}</Field><Field label={t("Capture date / source version", "采集日期 / 来源版本")}>{t("UNKNOWN", "UNKNOWN · 未知")}</Field><Field label={t("Third-party rights", "第三方权利")}>{t("NOT VERIFIED", "NOT VERIFIED · 未核验")}</Field><Field label={t("Metric registration", "度量配准")}>{t("NOT VERIFIED", "NOT VERIFIED · 未核验")}</Field></dl>
    </section>
    <div className={styles.sourceFooter}><div><h2>{t("Keep source records separate.", "保留来源记录的独立性。")} </h2><p>{t("The planetary experience is a presentation reference. Canonical records, spatial test inputs and Life++ planning retain their own status and requirements.", "地球体验属于展示参考。正式记录、空间测试输入与 Life++ 规划各自保留其状态和要求。")}</p></div><div className={styles.linkRow}><Link className={styles.textLink} href="/explorer">{t("Record explorer", "记录浏览器")}<Arrow /></Link><Link className={styles.textLink} href={referenceLifePath("/life/trust", locale)}>{t("Life++ trust", "Life++ 信任说明")}<Arrow /></Link></div></div>
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
