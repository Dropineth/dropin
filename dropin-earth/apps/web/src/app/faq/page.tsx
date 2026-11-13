import { publicPageMetadata, publicPageLocale } from "@/data/public-page-metadata";
import Link from "next/link";
import { CanopyProofLogo } from "@/components/canopyproof/CanopyProofLogo";


export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return publicPageMetadata("/faq", (await searchParams).lang, ["Common questions · CanopyProof", "常见问题 · CanopyProof"], ["Practical answers about learning, privacy, environmental records and current availability.", "了解学习演示、隐私保护、环境记录与当前服务的实用说明。"]);
}

export default async function FaqPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const zh = publicPageLocale((await searchParams).lang) === "zh";
  const t = (en: string, cn: string) => zh ? cn : en;
  const faqs = [
    [t("What can I do today?", "现在可以做什么？"), t("Read the public guides, explore example environmental records and try the learning demo. Real child enrollment and live financial services are not open. Each experience explains what is available before you begin.", "可以阅读公开指南、查看环境记录示例，并体验学习演示。真实儿童注册和真实资金服务尚未开放。各页面会先说明当前可用的内容。")],
    [t("Do children need an account?", "孩子需要注册账户吗？"), t("No. The public guide and learning preview do not require a real child account. Do not enter a child's name, contact details, photo or identity documents.", "不需要。公开指南和学习预览无需真实儿童账户。请勿填写孩子的姓名、联系方式，也不要上传照片或身份证明。")],
    [t("Can a school use the learning examples?", "学校可以怎样使用这些学习示例？"), t("Teachers can review the public material and use it to discuss observation, evidence and responsible AI. The demo is not a school enrollment or student-record service. Any organized activity needs the school's own suitability and safeguarding review.", "教师可以先阅读公开材料，用于讨论观察方法、证据和负责任的 AI 使用。演示不提供学校报名或学生档案服务。组织活动前，学校仍需自行评估内容是否适合学生，并做好儿童保护安排。")],
    [t("Is the AI assistant live?", "这里的 AI 助手已经接通了吗？"), t("The child learning demo uses prepared explanations. A live AI service is not connected. AI may help explain or suggest; it cannot give consent or make a guardian's decision.", "儿童学习演示使用预先编写的讲解，尚未接通实时 AI 服务。AI 可以辅助解释和提出建议，但不能表示同意，也不能替监护人作决定。")],
    [t("What does “saved on this device” mean?", "“保存在本机”是什么意思？"), t("A saved draft stays in this browser. It has not necessarily been sent, received or reviewed. Clear local drafts before leaving a shared device. If browser storage is cleared, those drafts may be lost.", "已保存的草稿留在当前浏览器中，不代表已经发送、接收或审核。离开共用设备前，请清除本机草稿。清理浏览器存储也可能导致草稿丢失。")],
    [t("Are the maps and sample results verified?", "地图和示例数据都经过核证了吗？"), t("No. Maps provide context and sample records explain the workflow. A real environmental conclusion needs identified sources, a suitable method and independent review. A picture, estimate or learning activity alone cannot establish an outcome.", "没有。地图用于了解背景，示例记录用于说明流程。真实环境结论需要明确的信息来源、适用的方法和独立审核。一张图片、一次估算或一次学习活动，都不能单独证明环境成果。")],
    [t("Can I look up a real project?", "可以查询真实项目吗？"), t("The Public Explorer accepts a project ID supplied with an approved public record. If the record or service is unavailable, it says so. It does not substitute an example or expose private project details.", "公开记录查询页可使用已批准公开的项目编号进行查阅。记录或服务暂不可用时，页面会明确提示，不会用示例替代，也不会公开项目的私密资料。")],
    [t("How can an organization discuss a project?", "机构如何洽谈项目？"), t("Start with the collaboration page. It lets you prepare an enquiry draft about your needs. Check its delivery status: preparing a draft does not send it or confirm a partnership.", "可以从合作页面开始，填写需求并整理咨询草稿。请留意页面上的发送状态：生成草稿不等于已经发送，也不代表合作已经成立。")],
    [t("Does a learning record earn money or carbon credits?", "学习记录可以换钱或换碳信用吗？"), t("No. A learning record is feedback on an activity. An Impact Certificate is not a certified carbon credit. The demo does not create a cash balance, land ownership or a benefit entitlement.", "不可以。学习记录用于反馈活动过程。Impact Certificate（成果记录证书）不等于核证碳信用。演示不会产生现金余额、土地所有权或福利权益。")],
    [t("What are the older testnet pages?", "网站上的旧测试页面是什么？"), t("Some Dropin Earth pages demonstrate prize pools and payment steps using a testnet-only environment. They do not request real money. Leaf Points are non-transferable testnet points only. RWA Fragment is not guaranteed yield. $CANOPY does not offset carbon tax.", "部分 Dropin Earth 页面在测试环境中演示抽奖池和支付步骤，不收取真实资金。Leaf Points 只是不可转让的测试积分；RWA Fragment 不承诺收益；$CANOPY 不能抵扣碳税。")],
    [t("How do I report a problem?", "遇到问题怎么办？"), t("For a website issue, use the feedback page and describe the page and what happened. Do not include personal child information or account secrets. The site is not an emergency or child-protection reporting service; a child who feels unsafe should ask a trusted adult nearby for help.", "网站使用问题可在反馈页面说明：哪个页面、发生了什么。请勿包含儿童个人信息或账户密钥。这里不提供紧急救助或儿童保护报案服务；孩子感到不安全时，应向身边信任的大人求助。")],
  ];
  return <main className="min-h-screen bg-[#f5f3e9] text-[#172e26]" lang={zh ? "zh-CN" : "en"}>
    <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#b9c6bb] pb-6"><Link className="flex min-h-11 items-center gap-3 text-xl font-semibold" href={zh ? "/zh" : "/"}><CanopyProofLogo size={36} />CanopyProof</Link><Link className="py-3 text-sm underline underline-offset-4" href={zh ? "/faq" : "/faq?lang=zh"} lang={zh ? "en" : "zh-CN"}>{zh ? "English" : "中文"}</Link></header>
      <section className="py-12 sm:py-16"><p className="text-sm font-semibold text-[#4b6258]">{t("HELP AND INFORMATION", "使用说明")}</p><h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">{t("Common questions", "常见问题")}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#4b6258]">{t("Practical answers for children, families, schools and organizations.", "给孩子、家长、学校和机构的实用说明。")}</p></section>
      <section aria-label={t("Questions and answers", "问题与回答")}>{faqs.map(([question, answer], i) => <details className="group border-t border-[#b9c6bb] py-5" key={question} open={i === 0}><summary className="cursor-pointer py-2 text-xl font-semibold leading-8 marker:text-[#295b42]">{question}</summary><p className="max-w-3xl py-4 text-base leading-8 text-[#4b6258]">{answer}</p></details>)}</section>
      <footer className="mt-8 flex flex-wrap gap-6 border-t border-[#b9c6bb] py-8 text-sm"><Link className="py-3 underline underline-offset-4" href={zh ? "/about?lang=zh" : "/about"}>{t("About CanopyProof", "认识 CanopyProof")}</Link><Link className="py-3 underline underline-offset-4" href={zh ? "/zh/children" : "/children"}>{t("Children and family guide", "儿童与家长指南")}</Link><Link className="py-3 underline underline-offset-4" href={zh ? "/feedback?lang=zh" : "/feedback"}>{t("Website feedback", "网站反馈")}</Link></footer>
    </div>
  </main>;
}
