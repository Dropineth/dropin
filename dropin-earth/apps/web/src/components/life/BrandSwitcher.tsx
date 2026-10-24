import { LIFEPP_PUBLIC_BRAND } from '../../data/life/public-brand';
import styles from "./BrandSwitcher.module.css";
export function BrandSwitcher() {
  return <nav aria-label="CanopyProof business areas" className={styles.switcher}>
    <div className={styles.links}>
      <a href="/#top" aria-current="page" className={styles.active}>生态与地球观测 · Ecology</a>
      <a href="/life" className={styles.life}>{LIFEPP_PUBLIC_BRAND} ↗</a>
      <a href="/life/spaces">测试场景 · Test scenes</a>
    </div>
    <a href="/company" className={styles.company}>CanopyProof Limited</a>
  </nav>;
}
