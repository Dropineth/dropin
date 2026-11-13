'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './spatial.module.css';

/** Add below the existing FourShopPlan; do not replace the source-plan component. */
export function SpatialOperations({ locale }: { locale: 'zh' | 'en' }) {
  const target = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setFailed(false);
    void import('./spatial-engine.mjs').then(({ mountSpatialOperations }) => {
      if (cancelled || !target.current) return;
      const mounted = mountSpatialOperations(target.current, {
        locale,
      });
      dispose = () => mounted.dispose();
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; dispose?.(); };
  }, [locale]);
  return (
    <section className={styles.root} aria-label={locale === 'zh' ? '空间规划与协作演示' : 'Space planning and collaboration demo'}>
      {failed && <p role="status">{locale === 'zh' ? '交互视图暂时无法加载。请查看上方三铺平面图与文字说明。' : 'The interactive view could not load. Use the three-unit plan and descriptions above.'}</p>}
      <div ref={target} />
      <noscript>{locale === 'zh' ? '启用 JavaScript 后可查看三维演示；也可直接阅读上方三铺平面图与文字说明。' : 'Enable JavaScript to explore the 3D demo, or use the three-unit plan and descriptions above.'}</noscript>
    </section>
  );
}
