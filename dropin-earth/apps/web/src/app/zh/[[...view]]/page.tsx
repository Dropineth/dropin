import { notFound } from "next/navigation";
import { PlanetarySite } from "@/components/planetary/PlanetarySite";
import { planetaryMetadata, planetaryViews, type PlanetaryView } from "@/data/planetary";

type Props = { params: Promise<{ view?: string[] }> };
function resolveView(parts?: string[]): PlanetaryView {
  if (!parts?.length) return "home";
  if (parts.length !== 1 || !planetaryViews.includes(parts[0] as PlanetaryView) || parts[0] === "home") notFound();
  return parts[0] as PlanetaryView;
}
export async function generateMetadata({ params }: Props) {
  return planetaryMetadata("zh", resolveView((await params).view));
}
export default async function Page({ params }: Props) {
  return <PlanetarySite locale="zh" view={resolveView((await params).view)} />;
}
