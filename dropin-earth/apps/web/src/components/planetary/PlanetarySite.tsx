import { CanopyProofLogo } from "../canopyproof/CanopyProofLogo";
import { planetaryHref, planetaryTitles, type PlanetaryLocale, type PlanetaryView } from "@/data/planetary";
import { ReferenceGlobe } from "./ReferenceGlobe";
import { ReferencePanels } from "./ReferencePanels";
import styles from "./PlanetarySite.module.css";

export function PlanetarySite({ locale = "en", view = "home" }: { locale?: PlanetaryLocale; view?: PlanetaryView }) {
  const zh = locale === "zh";
  const life = zh ? "/life" : "/en/life";
  const copy = (cn: string, en: string) => zh ? cn : en;
  return <div className={styles.root} lang={zh ? "zh-CN" : "en"}>
    <a className={styles.skip} href="#planetary-main">{copy("跳至内容", "Skip to content")}</a>
    <header className={styles.header}>
      <a className={styles.brand} href={planetaryHref(locale)} aria-label={copy("CanopyProof 首页", "CanopyProof home")}>
        <CanopyProofLogo loading="eager" size={46} />
        <span>CanopyProof<small>BY DROPIN · LIFE++ ECOSYSTEM</small></span>
      </a>
      <nav className={styles.nav} aria-label={copy("主导航", "Primary navigation")}>
        {(["home", "earth", "evidence", "participation"] as const).map(key => <a key={key} href={planetaryHref(locale, key)} aria-current={view === key ? "page" : undefined}>{planetaryTitles[locale][key]}</a>)}
        <a href={life}>{copy("人机共生", "Life++")}</a>
      </nav>
      <div className={styles.headerActions}>
        <a href={planetaryHref(zh ? "en" : "zh", view)} hrefLang={zh ? "en" : "zh-CN"} lang={zh ? "en" : "zh-CN"}>{zh ? "EN" : "中文"}</a>
        <a className={styles.smallButton} href={planetaryHref(locale, "trust")}>{copy("信任中心", "Trust center")} ↗</a>
      </div>
    </header>
    <p className={styles.notice}><span aria-hidden="true">●</span>{copy("地理底图为参考层，项目与数据为示意 · 非核证碳信用 · 无资金交易", "Reference geography / illustrative projects · No certified carbon credits or money transactions")}</p>
    <main id="planetary-main" tabIndex={-1}>
      {view === "home" ? <>
        <section className={`${styles.hero} cp-hero`} id="top">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>PLANETARY EVIDENCE INFRASTRUCTURE</p>
            <h1>{copy("让每一份贡献，", "A living planet.")}<br /><em>{copy("都有可验证的去向。", "A verifiable future.")}</em></h1>
            <p className={styles.lead}>{copy("从一片森林，到一座共生社区。", "From a forest to a symbiotic community.")}<br />{copy("连接空间证据、生态修复与可信的协作。", "Connect spatial evidence, restoration and accountable action.")}</p>
            <div className={styles.actions}>
              <a className={styles.button} href={planetaryHref(locale, "earth")}>{copy("探索地球证据", "Explore the evidence")} ↗</a>
              <a className={styles.quiet} href={life}>{copy("走进 Life++", "Discover Life++")} →</a>
            </div>
            <p className={styles.proofLine}><span>01 / OBSERVE</span><span>02 / TRACE</span><span>03 / VERIFY</span></p>
            <p className={styles.micro}>{copy("可视化不是核证。所有结论都应回到来源、方法与责任人。", "Visualization is not verification. Every claim needs sources, methods and accountable review.")}</p>
          </div>
          <ReferenceGlobe locale={locale} />
        </section>
        <section className={styles.portals} id="explorer" aria-label={copy("探索 CanopyProof", "Explore CanopyProof")}>
          {[
            { key: "earth", icon: "◎", number: "01 / PLANET", title: copy("地球数字孪生", "Planetary twin"), note: copy("区域 · 参考底图 · 项目边界", "Regions · reference geography · project boundaries") },
            { key: "evidence", icon: "⠿", number: "02 / EVIDENCE", title: copy("3DGS 与碳证据", "Spatial carbon evidence"), note: copy("现场重建 · 测量 · 来源核验", "Capture · measurement · provenance") },
            { key: "participation", icon: "◇", number: "03 / PARTICIPATION", title: copy("可复核的参与", "Accountable participation"), note: copy("当前状态 · 适用范围 · 责任边界", "Current status · scope · responsibility") },
            { key: "life", icon: "++", number: "04 / SYMBIOSIS", title: copy("Life++ 生生不息", "Life++ symbiosis"), note: copy("人 · 智能体 · 机器人 · 社区", "People · agents · robots · communities") },
          ].map(card => <a className={`${styles.portal} ${card.key === "life" ? styles.life : ""}`} href={card.key === "life" ? life : planetaryHref(locale, card.key as PlanetaryView)} key={card.key}>
            <span className={styles.number}>{card.number}</span><span className={styles.portalIcon} aria-hidden="true">{card.icon}</span><h2>{card.title}</h2><p>{card.note}</p><span className={styles.arrow} aria-hidden="true">↗</span>
          </a>)}
        </section>
        <section className={styles.foundation} id="protocol">
          <div><p className={styles.eyebrow}>TRUST IS A PRODUCT FEATURE</p><h2>{copy("不是更响亮的承诺。", "Not a louder promise.")}<br />{copy("是更清楚的证据。", "A clearer chain of evidence.")}</h2></div>
          <div className={styles.steps} id="how-it-works">
            {[
              [copy("来源可追溯", "Traceable origin"), copy("资产版本、采集时间、授权范围，逐项呈现。", "Asset versions, capture dates and permissions — stated individually.")],
              [copy("状态不混淆", "Explicit evidence status"), copy("观测、估算、核证、签发与注销，分别记录。", "Observation, estimation, verification, issuance and retirement stay distinct.")],
              [copy("责任有归属", "Accountable decisions"), copy("AHIN 记录认知与行动；不替代独立审核。", "AHIN records cognition and action; it does not replace independent review.")],
            ].map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></article>)}
          </div>
        </section>
        <section className={styles.existing} aria-label={copy("原生态入口", "Existing ecology resources")}>
          <div id="methodology"><h2>Methodology</h2><p>{copy("来源、方法、公开状态与原有核验流程。", "Sources, methods, public status and the existing review workflow.")}</p><a href="/ecology#methodology">{copy("查看原有方法说明", "Read the methodology")} ↗</a><a href="/explorer">Proof Explorer ↗</a></div>
          <div id="telemetry"><h2>TerraProof</h2><p>{copy("原遥测示例仍单独标记，不是项目实测数据。", "Original sample telemetry remains labeled, separate from measured project data.")}</p><a href="/ecology#telemetry">{copy("查看示例与边界", "View samples and boundaries")} ↗</a></div>
          <div id="stack"><h2>Open Stack</h2><p>{copy("保留原有工作台、技术栈与生态内容。", "Retain the existing workbenches, technology stack and ecology content.")}</p><a href="/ecology#stack">{copy("查看原生态页面", "Explore the original ecology site")} ↗</a><a href="#explorer">{copy("回到探索入口", "Back to exploration")} ↑</a></div>
          <div id="contact"><h2>{copy("联系与合作", "Contact and collaboration")}</h2><p>{copy("从具体需求开始，明确当前接入状态。", "Start with a concrete need and the current integration status.")}</p><a href={`${life}/partners`}>{copy("合作咨询", "Partnership enquiries")} ↗</a><a href="/life">Life++ · 中文 ↗</a></div>
        </section>
      </> : <div className={styles.workspace}>
        <div className={styles.workspaceHeading}><p className={styles.eyebrow}>CANOPYPROOF / {view.toUpperCase()}</p><h1>{planetaryTitles[locale][view]}</h1><p>{copy("参考、示意与真实接入，分别呈现。", "Reference material, examples and live integration are shown separately.")}</p></div>
        <ReferencePanels view={view} locale={locale} />
      </div>}
    </main>
    <footer className={styles.footer}>
      <span>CanopyProof Limited<small>{copy("主体信息以登记核验为准", "Entity identity subject to registry verification")}</small></span>
      <span>{copy("参考与示例不构成核证碳信用、签发或资金收付。", "Reference and sample material is not certified carbon credits, issuance or a funds transaction.")}</span>
      <a href="/ecology">{copy("原生态网站", "Original ecology site")} ↗</a>
    </footer>
  </div>;
}
