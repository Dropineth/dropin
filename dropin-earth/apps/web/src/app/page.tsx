import { PlanetarySite } from "@/components/planetary/PlanetarySite";
import { planetaryMetadata } from "@/data/planetary";

export const dynamic = "force-static";
export const metadata = planetaryMetadata("en", "home");

export default function Home() {
  return <PlanetarySite locale="en" />;
}
