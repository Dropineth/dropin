import { publicPageMetadata, publicPageLocale } from "@/data/public-page-metadata";
import { PublicExplorer } from "@/components/canopyproof/PublicExplorer";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return publicPageMetadata("/explorer", (await searchParams).lang, ["Look up a public project record · CanopyProof", "查询公开项目记录 · CanopyProof"], ["Use a public project ID to check a record and its review status.", "使用公开项目编号，查询记录及其审核状态。"]);
}

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return <PublicExplorer locale={publicPageLocale((await searchParams).lang) === "zh" ? "zh" : "en"} />;
}
