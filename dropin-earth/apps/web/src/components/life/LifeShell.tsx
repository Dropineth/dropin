import Link from 'next/link';
import type { ReactNode } from 'react';
import { lifePath, navigation, t, type LifeLocale } from '@/data/life/content';
import styles from './life.module.css';
import { LifeMobileNav } from './LifeMobileNav';

export function LifeShell({ locale, path = '/life', children }: { locale: LifeLocale; path?: string; children: ReactNode }) {
  const otherLocale = locale === 'zh' ? 'en' : 'zh';
  return (
    <div className={styles.shell} data-business="life" lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <a className={styles.skipLink} href="#life-main">{locale === 'zh' ? '跳至内容' : 'Skip to content'}</a>
      <div className={styles.businessBar}>
        <div className={styles.businessInner}>
          <a href="/" className={styles.ecologyLink}><span aria-hidden="true" className={styles.greenDot} />{locale === 'zh' ? 'CanopyProof · 生态与地球观测' : 'CanopyProof · Ecology & Earth observation'}<span aria-hidden="true">↗</span></a>
          <Link href={lifePath(locale, '/company')} className={styles.companyLink}>CanopyProof Limited</Link>
        </div>
      </div>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={lifePath(locale)} className={styles.wordmark} aria-label={locale === 'zh' ? 'Life++ 生生不息首页' : 'Life++ home'}><span>Life<span className={styles.plus}>++</span></span><small>{locale === 'zh' ? '生生不息' : 'LIFE, CONNECTED'}</small></Link>
          <nav className={styles.desktopNav} aria-label={locale === 'zh' ? '主导航' : 'Main navigation'}>{navigation.map((item) => <Link key={item.path} href={lifePath(locale, item.path)} aria-current={path === item.path || path.startsWith(`${item.path}/`) ? 'page' : undefined}>{t(locale, item.label)}</Link>)}</nav>
          <div className={styles.headerActions}>
            <a href={lifePath(otherLocale, path)} hrefLang={otherLocale === 'zh' ? 'zh-CN' : 'en'} lang={otherLocale === 'zh' ? 'zh-CN' : 'en'} className={styles.languageLink}>{locale === 'zh' ? 'EN' : '中文'}</a>
            <Link href={lifePath(locale, '/life/partners')} className={styles.headerCta}>{locale === 'zh' ? '一起共创' : 'Partner with us'}<span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <LifeMobileNav className={styles.mobileNav} label={locale === 'zh' ? '移动端导航' : 'Mobile navigation'}>{navigation.map((item) => <Link key={item.path} href={lifePath(locale, item.path)} aria-current={path === item.path || path.startsWith(`${item.path}/`) ? 'page' : undefined}>{t(locale, item.label)}</Link>)}</LifeMobileNav>
      </header>
      <main id="life-main" tabIndex={-1}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div><Link href={lifePath(locale)} className={styles.footerLogo}>Life<span>++</span></Link><p>{locale === 'zh' ? '让现实可感知，让协作可问责，' : 'Make reality perceptible. Make collaboration accountable.'}<br />{locale === 'zh' ? '让生命生生不息。' : 'Let life keep flourishing.'}</p></div>
          <div className={styles.footerLinks}><div><strong>{locale === 'zh' ? '开始探索' : 'Explore'}</strong><Link href={lifePath(locale, '/life/spaces')}>{locale === 'zh' ? '测试场景' : 'Test scenes'}</Link><Link href={lifePath(locale, '/life/center')}>{locale === 'zh' ? '四铺导入期' : 'Four-unit plan'}</Link><Link href={lifePath(locale, '/life/agents')}>{locale === 'zh' ? '数字分身' : 'Digital agents'}</Link></div><div><strong>{locale === 'zh' ? '与我们连接' : 'Connect'}</strong><Link href={lifePath(locale, '/life/partners')}>{locale === 'zh' ? '合作意向' : 'Partnership enquiries'}</Link><Link href={lifePath(locale, '/life/trust')}>{locale === 'zh' ? '数据权限与责任' : 'Permissions & responsibility'}</Link><Link href={lifePath(locale, '/company')}>{locale === 'zh' ? '关于主体' : 'About the company'}</Link></div><div><strong>{locale === 'zh' ? '另一个入口' : 'Our other entry point'}</strong><a href="/">{locale === 'zh' ? '生态与地球观测 ↗' : 'Ecology & Earth observation ↗'}</a><a href="/#explorer">Proof Explorer ↗</a><a href="/#methodology">Methodology ↗</a></div></div>
        </div>
        <div className={styles.footerBottom}><span>CanopyProof Limited · Life++</span><span>{locale === 'zh' ? '导入期规划 · 测试输入 · 订阅尚未开放收费' : 'Introductory planning · Test inputs · Subscriptions not on sale'}</span></div>
      </footer>
    </div>
  );
}
