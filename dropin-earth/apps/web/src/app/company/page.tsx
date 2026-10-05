import { LifePage } from "@/components/life/LifePages";
import { lifeMetadata } from "@/data/life/navigation";
export const dynamic = "force-dynamic";
export const metadata = lifeMetadata("/company", "company", "zh");
export default function Company() { return <><LifePage page="company" locale="zh" /></>; }
