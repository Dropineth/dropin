import { CanopyProofLogo } from "../canopyproof/CanopyProofLogo";
import { planetaryHref, planetaryTitles, type PlanetaryLocale, type PlanetaryView } from "@/data/planetary";
import { LIFEPP_PUBLIC_BRAND } from "@/data/life/public-brand";
import { ReferenceGlobe } from "./ReferenceGlobe";
import { ReferencePanels } from "./ReferencePanels";
import styles from "./PlanetarySite.module.css";

export function PlanetarySite({ locale = "en", view = "home" }: { locale?: PlanetaryLocale; view?: PlanetaryView }) {
  const zh = locale === "zh";
  const life = zh ? "/life" : "/en/life";
  const children = zh ? "/zh/child-accounts" : "/child-accounts";
  const copy = (cn: string, en: string) => zh ? cn : en;
  const descriptions = {
    earth: copy("从地区背景到一条观察记录，了解环境信息如何联系起来。", "Explore how a place, an observation and its supporting records fit together."),
    evidence: copy("用一条示例记录，了解来源、审核状态与适用范围。", "Use a sample record to understand sources, review status and the limits of a claim."),
    participation: copy("找到适合你的入口：了解合作、预览教学活动，或和孩子一起体验。", "Find your starting point: discuss a project, preview a learning activity or explore with your family."),
    trust: copy("了解哪些信息有依据、哪些仍待确认，以及如何查阅来源。", "See what the records support, what remains unconfirmed and where to check the sources."),
  };
  return <div className={styles.root} lang={zh ? "zh-CN" : "en"}>
    <a className={styles.skip} href="#planetary-main">{copy("跳至正文", "Skip to content")}</a>
    <header className={styles.header}>
      <a className={styles.brand} href={planetaryHref(locale)} aria-label={copy("CanopyProof 首页", "CanopyProof home")}>
        <CanopyProofLogo loading="eager" size={46} />
        <span>CanopyProof<small style={{ textTransform: "none" }}>Dropin · {LIFEPP_PUBLIC_BRAND}</small></span>
      </a>
      <nav className={styles.nav} aria-label={copy("主导航", "Main navigation")}>
        {(["home", "earth", "evidence", "participation"] as const).map(key => <a key={key} href={planetaryHref(locale, key)} aria-current={view === key ? "page" : undefined}>{planetaryTitles[locale][key]}</a>)}
        <a href={life}>{LIFEPP_PUBLIC_BRAND}</a>
        <a href={children}>{copy("亲子学习", "Family learning")}</a>
      </nav>
      <div className={styles.headerActions}>
        <a href={planetaryHref(zh ? "en" : "zh", view)} hrefLang={zh ? "en" : "zh-CN"} lang={zh ? "en" : "zh-CN"}>{zh ? "EN" : "中文"}</a>
        <a className={styles.smallButton} href={planetaryHref(locale, "trust")}>{copy("透明说明", "Trust")} ↗</a>
      </div>
    </header>
    <p className={styles.notice}><span aria-hidden="true">●</span>{copy("可查看环境记录示例、体验自然学习。真实项目参与和资金交易尚未开放。", "Explore sample records and learning demos. Live project participation and payments are not available here.")}</p>
    <main id="planetary-main" tabIndex={-1}>
      {view === "home" ? <>
        <section className={`${styles.hero} cp-hero`} id="top">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy("环境证据 · 自然学习 · 共同参与", "ENVIRONMENTAL EVIDENCE · LEARNING · PARTICIPATION")}</p>
            <h1>{copy("一起认识自然，", "Understand nature.")}<br /><em>{copy("让行动更有依据。", "Make evidence count.")}</em></h1>
            <p className={styles.lead}>{copy("了解环境记录如何核验，和孩子体验自然观察学习，或为机构与学校咨询试点合作。", "Explore environmental evidence, try a nature-learning activity with children, or discuss a pilot for your organisation or school.")}</p>
            <div className={styles.actions}>
              <a className={styles.button} href={children}>{copy("了解亲子学习", "Explore family learning")} ↗</a>
              <a className={styles.quiet} href={`${life}/partners`}>{copy("咨询试点合作", "Discuss a pilot")} →</a>
            </div>
            <p className={styles.proofLine}><span>{copy("01 / 观察", "01 / OBSERVE")}</span><span>{copy("02 / 了解", "02 / UNDERSTAND")}</span><span>{copy("03 / 核查", "03 / CHECK")}</span></p>
            <p className={styles.micro}>{copy("先看来源，再看结论。示例用于帮助理解，真实成果需要相应记录与审核。", "Start with the source. Examples help explain the process; real outcomes need supporting records and review.")}</p>
          </div>
          <ReferenceGlobe locale={locale} />
        </section>
        <section className={styles.portals} id="explorer" aria-label={copy("选择适合你的入口", "Choose your starting point")}>
          {[
            { key: "institutions", icon: "◎", number: copy("01 / 机构", "01 / ORGANISATIONS"), title: copy("把项目需求说清楚", "For organisations"), note: copy("围绕环境记录、社区参与或试点目标，讨论合适的合作方式。", "Discuss environmental records, community participation and the scope of a possible pilot."), action: copy("咨询项目合作", "Discuss your project"), href: `${life}/partners` },
            { key: "schools", icon: "⠿", number: copy("02 / 学校", "02 / SCHOOLS"), title: copy("先体验，再设计课堂", "For schools & teachers"), note: copy("预览自然观察活动，了解孩子会看到什么、如何作出自己的选择。", "Preview a nature-learning activity and see how children can take part and make choices."), action: copy("了解课堂用法", "Read the school guide"), href: `${children}#schools` },
            { key: "families", icon: "◇", number: copy("03 / 家庭", "03 / FAMILIES"), title: copy("和孩子一起探索", "For parents & caregivers"), note: copy("一起了解学习流程、参与选择与暂停方式，从演示体验开始。", "Explore the demo together, including participation choices and ways to pause."), action: copy("阅读家长指南", "Read the family guide"), href: `${children}#family` },
            { key: "children", icon: "+", number: copy("04 / 孩子", "04 / CHILDREN"), title: copy("发现自然的小变化", "For young explorers"), note: copy("看看小树的示例图片，说说你的发现。不需要上传真实照片。", "Look at sample pictures of a tree and describe what you notice. No real photos needed."), action: copy("看看怎么开始", "See how to start"), href: `${children}#journey` },
          ].map(card => <a className={styles.portal} href={card.href} key={card.key}>
            <span className={styles.number}>{card.number}</span><span className={styles.portalIcon} aria-hidden="true">{card.icon}</span><h2>{card.title}</h2><p>{card.note}</p><span className={styles.portalCta}>{card.action} →</span><span className={styles.arrow} aria-hidden="true">↗</span>
          </a>)}
        </section>
        <section className={styles.foundation} id="protocol">
          <div><p className={styles.eyebrow}>{copy("让每一步都说得清楚", "CLEAR RECORDS, INFORMED DECISIONS")}</p><h2>{copy("看得到来源，", "See the source.")}<br />{copy("才读得懂结果。", "Understand the result.")}</h2></div>
          <div className={styles.steps} id="how-it-works">
            {[
              [copy("先了解记录从哪里来", "Start with the source"), copy("查看采集时间、资料来源和使用许可。缺失的信息会明确标出。", "Check when and where information was collected, and how it may be used. Missing information is labelled.")],
              [copy("分清不同阶段", "Check the stage"), copy("一次观察、一次估算和一项核证结果，代表不同的事情。", "An observation, an estimate and a verified result each mean something different.")],
              [copy("再判断能用来做什么", "Understand what it supports"), copy("结合方法、审核记录与适用范围，决定是否足以支持下一步行动。", "Read the method, review record and limitations before using a claim to guide an action.")],
            ].map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></article>)}
          </div>
        </section>
        <section className={styles.existing} aria-label={copy("继续了解", "Explore further")}>
          <div id="methodology"><h2>{copy("环境记录与方法", "Evidence & methods")}</h2><p>{copy("用示例了解一条环境记录需要哪些依据。", "See what information belongs in an environmental record.")}</p><a href={planetaryHref(locale, "evidence")}>{copy("查看记录示例", "Explore a sample record")} ↗</a><a href={zh ? "/ecology?lang=zh#methodology" : "/ecology#methodology"}>{copy("阅读方法说明", "Read about the methods")} ↗</a></div>
          <div id="telemetry"><h2>{copy("地区与观察示例", "Places & observations")}</h2><p>{copy("从地区背景到观察记录，了解信息之间的联系。", "Explore regional context and examples of environmental observations.")}</p><a href={planetaryHref(locale, "earth")}>{copy("探索地球视图", "Explore the globe")} ↗</a><a href={zh ? "/ecology?lang=zh#telemetry" : "/ecology#telemetry"}>{copy("查看监测示例", "View monitoring examples")} ↗</a></div>
          <div id="stack"><h2>{LIFEPP_PUBLIC_BRAND}</h2><p>{copy("了解社区空间、学习活动与人机协作的规划。", "Explore plans for community spaces, shared learning and collaboration with technology.")}</p><a href={life}>{copy("了解社区计划", "Explore the community plan")} ↗</a><a href={zh ? "/ecology?lang=zh#stack" : "/ecology#stack"}>{copy("查看技术说明", "Read the technical overview")} ↗</a></div>
          <div id="contact"><h2>{copy("联系与合作", "Talk to us")}</h2><p>{copy("告诉我们你的地区、参与对象和希望解决的问题。", "Tell us where you work, who would take part and what you hope to achieve.")}</p><a href={`${life}/partners`}>{copy("整理合作咨询", "Prepare a partnership enquiry")} ↗</a><a href={zh ? "/faq?lang=zh" : "/faq"}>{copy("查看常见问题", "Read the FAQs")} ↗</a></div>
        </section>
      </> : <div className={styles.workspace}>
        <div className={styles.workspaceHeading}><p className={styles.eyebrow}>CANOPYPROOF</p><h1>{planetaryTitles[locale][view]}</h1><p>{descriptions[view]}</p></div>
        <ReferencePanels view={view} locale={locale} />
      </div>}
    </main>
    <footer className={styles.footer}>
      <span>CanopyProof Limited<small>{copy("由 Dropin 开发", "Developed by Dropin")}</small></span>
      <span>{copy("示例记录不代表已核证的环境成果或可交易的碳信用。", "Sample records do not represent verified environmental outcomes or tradable carbon credits.")}</span>
      <a href={zh ? "/about?lang=zh" : "/about"}>{copy("关于我们", "About us")} ↗</a>
      <a href={zh ? "/faq?lang=zh" : "/faq"}>{copy("常见问题", "FAQs")} ↗</a>
      <a href="https://ahin.io/" rel="noreferrer" referrerPolicy="no-referrer">{copy("AHIN 项目网站", "AHIN project website")} ↗</a>
    </footer>
  </div>;
}
