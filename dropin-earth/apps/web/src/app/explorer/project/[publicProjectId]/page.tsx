import { publicPageLocale } from "@/data/public-page-metadata";
import { PublicExplorer } from "@/components/canopyproof/PublicExplorer";

export default async function ExplorerProjectPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly publicProjectId: string }>;
  readonly searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { publicProjectId } = await params;
  return <PublicExplorer initialPublicProjectId={publicProjectId} locale={publicPageLocale((await searchParams).lang)} />;
}
