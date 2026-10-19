import { businessHref, type BusinessArea } from "../../data/life/business-entrypoints";
import { LIFEPP_PUBLIC_BRAND } from "../../data/life/public-brand";
import styles from "./BrandSwitcher.module.css";

const entries: ReadonlyArray<{ area: BusinessArea; zh: string; en: string }> = [
  { area: "overview", zh: "CanopyProof 总览", en: "CanopyProof overview" },
  { area: "ecology", zh: "生态与地球观测", en: "Ecology" },
  { area: "earth", zh: "地球参考视图", en: "Earth reference" },
  { area: "evidence", zh: "证据与复核", en: "Evidence & review" },
  { area: "life", zh: LIFEPP_PUBLIC_BRAND, en: LIFEPP_PUBLIC_BRAND },
  { area: "spaces", zh: "空间测试场景", en: "Spatial test scenes" },
];

export function BrandSwitcher({ locale = "zh", activeArea = "ecology" }: { locale?: "zh" | "en"; activeArea?: BusinessArea } = {}) {
  return <nav aria-label={locale === "zh" ? "CanopyProof 业务入口" : "CanopyProof business areas"} className={styles.switcher}>
    <div className={styles.links}>
      {entries.map(({ area, zh, en }) => <a
        key={area}
        href={businessHref(area, locale)}
        aria-current={area === activeArea ? "page" : undefined}
        className={area === activeArea ? styles.active : area === "life" ? styles.life : undefined}
      >{locale === "zh" ? zh : en}{area === "life" ? " ↗" : ""}</a>)}
    </div>
    <a href={businessHref("company", locale)} className={styles.company}>CanopyProof Limited</a>
  </nav>;
}
