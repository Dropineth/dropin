import { publicPageMetadata, publicPageLocale } from "@/data/public-page-metadata";
import Link from "next/link";
import { CanopyProofLogo } from "@/components/canopyproof/CanopyProofLogo";


export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return publicPageMetadata("/about", (await searchParams).lang, ["About CanopyProof · Learning and environmental evidence", "认识 CanopyProof · 环境记录与自然学习"], ["Learn what CanopyProof offers today and where families, schools and organizations can start.", "了解 CanopyProof 当前提供的内容，以及家庭、学校和机构可以从哪里开始。"]);
}

export default async function AboutPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const zh = publicPageLocale((await searchParams).lang) === "zh";
  const t = (en: string, cn: string) => zh ? cn : en;
  const home = zh ? "/zh" : "/";
  const children = zh ? "/zh/children" : "/children";
  const audiences = [
    [t("Children", "儿童"), t("Look closely, ask questions and explore at your own pace. Start with pictures and simple observations alongside a trusted adult.", "和信任的大人一起，从图片和简单的观察开始。慢慢看，放心问，按照自己的节奏探索。"), children, t("Explore the learning guide", "看看可以怎样学习")],
    [t("Parents and guardians", "家长与监护人"), t("Read what the demo does, what stays on your device and how to stop. Real child enrollment is not open.", "先了解演示内容、哪些记录只保存在本机，以及如何退出。真实儿童注册尚未开放。"), `${children}#family`, t("Read the family guide", "阅读家长指南")],
    [t("Schools and educators", "学校与教育工作者"), t("Use the public examples to discuss nature, evidence and responsible AI. Review suitability for your learners before planning an activity.", "用公开示例讨论自然观察、证据和负责任的 AI 使用。安排活动前，请先判断内容是否适合自己的学生。"), `${children}#schools`, t("Review the school guide", "阅读学校指南")],
    [t("Organizations and project teams", "机构与项目团队"), t("Review the evidence workflow, privacy approach and current service availability before discussing a project.", "先了解证据流程、隐私保护方式与服务开放情况，再讨论具体项目。"), zh ? "/zh/trust" : "/trust", t("Review how records are checked", "了解记录如何审核")],
  ];
  return <main className="min-h-screen bg-[#f5f3e9] text-[#172e26]" lang={zh ? "zh-CN" : "en"}>
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#b9c6bb] pb-6">
        <Link className="flex min-h-11 items-center gap-3 text-xl font-semibold" href={home}><CanopyProofLogo size={36} />CanopyProof</Link>
        <nav className="flex flex-wrap items-center gap-6 text-sm" aria-label={t("Page navigation", "页面导航")}>
          <Link className="py-3" href={zh ? "/faq?lang=zh" : "/faq"}>{t("Common questions", "常见问题")}</Link>
          <Link className="py-3" href={zh ? "/about" : "/about?lang=zh"} lang={zh ? "en" : "zh-CN"}>{zh ? "English" : "中文"}</Link>
        </nav>
      </header>
      <section className="py-12 sm:py-20">
        <p className="text-sm font-semibold text-[#4b6258]">{t("ABOUT CANOPYPROOF", "认识 CanopyProof")}</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">{t("Understand nature. Follow the evidence.", "认识自然，让每份记录有据可查。")}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[#4b6258]">{t("CanopyProof brings environmental learning and evidence review into one place. Explore how observations are recorded, where information comes from and what still needs checking.", "CanopyProof 把环境学习与证据查阅放在一起。你可以了解一次观察如何成为记录、信息来自哪里，以及哪些结论还需要核实。")}</p>
        <p className="mt-6 max-w-3xl rounded border border-[#b9c6bb] bg-[#e4eadb] p-5 text-sm leading-6">{t("Available today: public guides, examples and a learning demo. Examples do not represent verified results from live projects. Real child enrollment, payments and carbon-credit issuance are not available here.", "目前可阅读公开指南、查看示例，并体验学习演示。示例不代表真实项目的已核实成果。真实儿童注册、支付和碳信用签发尚未开放。")}</p>
      </section>
      <section aria-labelledby="audiences" className="border-t border-[#b9c6bb] py-12">
        <h2 id="audiences" className="text-3xl font-semibold">{t("Choose a starting point", "找到适合你的入口")}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">{audiences.map(([title, description, href, action]) => <article className="flex flex-col items-start border border-[#b9c6bb] p-6 sm:p-8" key={title}><h3 className="text-2xl font-semibold">{title}</h3><p className="mb-6 mt-4 leading-7 text-[#4b6258]">{description}</p><Link className="mt-auto py-3 font-semibold underline underline-offset-4" href={href!}>{action} →</Link></article>)}</div>
      </section>
      <section className="border-t border-[#b9c6bb] py-12">
        <h2 className="text-3xl font-semibold">{t("From an observation to a reliable record", "从一次观察，到一份可靠的记录")}</h2>
        <ol className="mt-8 grid gap-7 md:grid-cols-3">{[
          [t("Record what you notice", "记下看到的事"), t("Keep the observation separate from assumptions about what it means.", "先记录观察到的内容，再讨论它可能意味着什么。")],
          [t("Check the source", "核对信息来源"), t("Look for the date, method and supporting material. Missing information stays visible.", "查看日期、方法和相关材料。缺少的信息，也应清楚标明。")],
          [t("Review before making a claim", "先审核，再作结论"), t("Qualified reviewers must assess any real environmental claim. An AI suggestion or a learning record is not verification.", "真实环境成果需要由具备相应资格的人员审核。AI 建议或学习记录本身不等于核证。")],
        ].map(([title, detail], i) => <li key={title}><span className="text-sm text-[#4b6258]">0{i + 1}</span><h3 className="mt-3 text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-[#4b6258]">{detail}</p></li>)}</ol>
      </section>
      <footer className="flex flex-wrap gap-6 border-t border-[#b9c6bb] py-8 text-sm"><Link className="py-2 underline underline-offset-4" href={home}>{t("Back to home", "返回首页")}</Link><Link className="py-2 underline underline-offset-4" href={zh ? "/zh/participation" : "/participation"}>{t("What is available today", "查看当前开放内容")}</Link></footer>
    </div>
  </main>;
}
