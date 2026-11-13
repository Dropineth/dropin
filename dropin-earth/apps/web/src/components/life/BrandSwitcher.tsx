import { LIFEPP_PUBLIC_BRAND } from '../../data/life/public-brand';
import styles from "./BrandSwitcher.module.css";
export function BrandSwitcher({ locale = "en" }: { locale?: "en" | "zh" }) {
  const zh = locale === "zh";
  return <nav aria-label={zh ? "CanopyProof 网站栏目" : "CanopyProof areas"} className={styles.switcher}>
    <div className={styles.links}>
      <a href={zh ? "/zh#top" : "/#top"} aria-current="page" className={styles.active}>{zh ? "生态与地球观测" : "Ecology"}</a>
      <a href={zh ? "/life" : "/en/life"} className={styles.life}>{LIFEPP_PUBLIC_BRAND} ↗</a>
      <a href={zh ? "/life/spaces" : "/en/life/spaces"}>{zh ? "三维空间" : "3D spaces"}</a>
    </div>
    <a href={zh ? "/company" : "/en/company"} className={styles.company}>CanopyProof Limited</a>
  </nav>;
}
