import { PublicExplorer } from "@/components/canopyproof/PublicExplorer";

export default async function ExplorerProjectPage({
  params,
}: {
  readonly params: Promise<{ readonly publicProjectId: string }>;
}) {
  const { publicProjectId } = await params;
  return <PublicExplorer initialPublicProjectId={publicProjectId} />;
}
