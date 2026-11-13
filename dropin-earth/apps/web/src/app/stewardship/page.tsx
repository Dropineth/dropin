import type { Metadata } from "next";
import { StewardshipExperience } from "@/components/child-stewardship/StewardshipExperience";
import type { ChildLocale } from "@/lib/child-stewardship-locale";

type PageProps = { searchParams: Promise<{ lang?: string | string[] }> };
const pageLocale = (lang: string | string[] | undefined): ChildLocale => (Array.isArray(lang) ? lang[0] : lang) === "en" ? "en" : "zh-CN";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const en = pageLocale((await searchParams).lang) === "en";
  return {
    title: en ? "Look, ask and learn together · CanopyProof learning demo" : "一起观察，一起提问 · CanopyProof 学习演示",
    description: en
      ? "Compare illustrated leaves, explore prepared explanations and choose whether to keep a draft in this browser. For families and schools; real enrollment and online submission are not open."
      : "比较叶片插画，阅读预先编写的讲解，自主选择是否在浏览器中留下练习草稿。适合家庭和学校了解；真实注册与在线提交尚未开放。",
    alternates: { canonical: "https://canopyproof.org/stewardship" },
    robots: { index: false, follow: false },
  };
}

export default async function StewardshipPage({ searchParams }: PageProps) {
  return <StewardshipExperience initialLocale={pageLocale((await searchParams).lang)} />;
}
