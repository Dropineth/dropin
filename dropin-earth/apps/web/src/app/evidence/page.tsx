import { PlanetarySite } from "@/components/planetary/PlanetarySite";
import { planetaryMetadata } from "@/data/planetary";

export const metadata = planetaryMetadata("en", "evidence");

export default function Page() {
  return <PlanetarySite locale="en" view="evidence" />;
}
