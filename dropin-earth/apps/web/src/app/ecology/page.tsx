import { publicPageMetadata, publicPageLocale } from "@/data/public-page-metadata";
import { CanopyProofLanding } from "@/components/canopyproof/CanopyProofLanding";


export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return publicPageMetadata("/ecology", (await searchParams).lang, ["Environmental evidence, explained · CanopyProof", "看懂环境证据 · CanopyProof"], ["Follow observations through sources, review and public records. A practical guide with clearly labelled examples.", "从观察和来源核对，到审核与公开记录，通过清楚标注的示例了解流程。"]);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return <CanopyProofLanding locale={publicPageLocale((await searchParams).lang) === "zh" ? "zh" : "en"} />;
}
