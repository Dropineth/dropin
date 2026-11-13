import { publicPageMetadata, publicPageLocale } from "@/data/public-page-metadata";
import Link from "next/link";
import { AppShell, StatusBadge } from "@dropin/ui";
import { FeedbackForm } from "./feedback-form";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return publicPageMetadata("/feedback", (await searchParams).lang, ["Website feedback · CanopyProof", "网站反馈 · CanopyProof"], ["Tell us about a website issue or confusing wording. Feedback uses the test service.", "反馈网站功能问题或难懂的文字。此表单使用测试服务。"]);
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const zh = publicPageLocale((await searchParams).lang) === "zh";
  const t = (en: string, cn: string) => zh ? cn : en;
  return <AppShell nav={<><Link href={zh ? "/zh" : "/"}>{t("Home", "首页")}</Link><Link href={zh ? "/faq?lang=zh" : "/faq"}>{t("Common questions", "常见问题")}</Link><Link href={zh ? "/feedback" : "/feedback?lang=zh"} lang={zh ? "en" : "zh-CN"}>{zh ? "English" : "中文"}</Link></>}>
    <div className="mx-auto max-w-4xl py-10" lang={zh ? "zh-CN" : "en"}>
      <section><StatusBadge status="testnet">{t("Test service", "测试服务")}</StatusBadge><h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">{t("Help us improve the website", "帮助我们改进网站")}</h1><p className="mt-5 max-w-2xl leading-7 text-slate-300">{t("Tell us about a broken feature, confusing wording or an environmental record you could not understand. Include the page and the steps you took. A successful submission confirms receipt by the test service; it does not promise a response time.", "可以反馈功能问题、难懂的文字，或看不明白的环境记录。请说明页面和操作步骤。提交成功表示测试服务已收到内容，不代表承诺了回复时间。")}</p></section>
      <section className="mt-8"><FeedbackForm locale={zh ? "zh" : "en"} /></section>
    </div>
  </AppShell>;
}
