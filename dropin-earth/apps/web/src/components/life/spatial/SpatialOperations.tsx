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
    <section className={styles.root} aria-label={locale === 'zh' ? '空间与协作交互评审工作台' : 'Spatial collaboration review workbench'}>
      {failed && <p role="status">{locale === 'zh' ? '交互视图加载失败。上方四铺原图与文字信息仍可使用。' : 'The interactive view did not load. The original four-unit plan and text above remain available.'}</p>}
      <div ref={target} />
      <noscript>{locale === 'zh' ? '三维与回放需要 JavaScript；请使用上方四铺原图与文字列表。' : '3D and replay require JavaScript. Use the original plan and text list above.'}</noscript>
    </section>
  );
}
