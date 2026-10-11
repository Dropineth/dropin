import { PlanetarySite } from "@/components/planetary/PlanetarySite";
import { planetaryMetadata } from "@/data/planetary";

export const metadata = planetaryMetadata("en", "earth");

export default function Page() {
  return <PlanetarySite locale="en" view="earth" />;
}
