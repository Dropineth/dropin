import { LifeRoute } from "@/components/life/LifeRoute";
import { lifeMetadata, lifePages } from "@/data/life/navigation";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ path?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const path = (await params).path ?? [];
  return lifeMetadata(`/life${path.length ? "/" + path.join("/") : ""}`, (Object.hasOwn(lifePages, path.join("/")) ? lifePages[path.join("/")] : undefined) ?? "scene", "en");
}
export default async function Page({ params }: Props) {
  return <LifeRoute path={(await params).path ?? []} locale="en" />;
}
