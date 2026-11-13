import Link from "next/link";
import { lifePath } from "@/data/life/content";
import { notFound } from "next/navigation";
import { LifePage } from "./LifePages";
import { LifeShell } from "./LifeShell";
import { SceneViewer } from "./SceneViewer";
import { getScene } from "@/data/life/scenes";
import { lifePages, type Locale } from "@/data/life/navigation";
import styles from "./life.module.css";

export function LifeRoute({ path, locale }: { path: string[]; locale: Locale }) {
  const key = path.join("/");
  const page = Object.hasOwn(lifePages, key) ? lifePages[key] : undefined;
  if (page) return <><LifePage locale={locale} page={page as Parameters<typeof LifePage>[0]["page"]} /></>;
  const scene = path.length === 2 && path[0] === "spaces" ? getScene(path[1] ?? "") : undefined;
  if (!scene) notFound();
  const t = (zh: string, en: string) => locale === "zh" ? zh : en;
  const fields: [string, string, unknown][] = [
    ["地点", "Location", scene.location], ["采集日期", "Capture date", scene.captureDate],
    ["采集方", "Capture provider", scene.captureProvider], ["资产格式", "Asset format", scene.assetFormat],
    ["资产版本", "Asset version", scene.assetVersion], ["缩略图", "Thumbnail", scene.thumbnail],
    ["HTTPS 嵌入地址", "HTTPS embed URL", scene.embedUrl],
    ["对应铺位", "Linked unit", scene.roomBinding],
    ["覆盖面积", "Coverage area", null],
  ];
  return <><LifeShell locale={locale} path={`/life/spaces/${scene.id}`}>
    <header className={`${styles.container} ${styles.pageHero}`}>
      <p className={styles.eyebrow}>{t("场景资料 / 来源待核实", "SCENE INFORMATION / SOURCE TO BE VERIFIED")}</p>
      <h1>{locale === "zh" ? scene.titleZh : scene.titleEn}</h1>
      <p>{t("三维高斯场景参考资料。内容来源与展示许可尚待核实，站内浏览暂未开放。", "A reference for a 3D Gaussian scene. Its source and display permissions still need verification; the on-site viewer is not yet available.")}</p>
      <span className={styles.status}>{scene.legacy ? t("历史记录 · 非主要入口", "Historical reference · Not a primary scene") : t("资料待核实 · 暂不可浏览", "Awaiting verification · Viewer unavailable")}</span>
      {scene.legacy && <p>{t("场景31保留原始来源，不视为场景33的同一资产。", "Scene 31 retains its original source and is not treated as the same asset as Scene 33.")} <Link className={styles.textLink} href={lifePath(locale,"/life/spaces")}>{t("查看主要场景33 / 29", "View primary scenes 33 / 29")}</Link></p>}
    </header>
    <section className={`${styles.container} ${styles.sectionFirst}`} aria-label={t("场景查看器", "Scene viewer")}><SceneViewer scene={scene} locale={locale} /></section>
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.sectionHeading}><h2>{t("了解场景的来源与授权。", "Understand the source and permissions.")}</h2></div>
      <dl className={`${styles.panel} ${styles.sceneMetadata}`}>{fields.map(([zh, en, value]) => <div key={en}><dt>{t(zh,en)}</dt><dd>{typeof value === "string" ? value : t("待确认", "To be confirmed")}</dd></div>)}</dl>
      <p className={styles.caption}>{t("资料核对日期：2026-09-30。场景内容、提供方和展示权利仍待核实，尚未获准用于导航。提供链接本身不代表拥有相关内容的使用权。", "Information reviewed on 30 September 2026. Scene content, the provider and display rights remain unverified. Navigation use is not approved. Supplying a link does not establish rights to use its content.")}</p>
      <Link className={styles.textLink} href={lifePath(locale,"/life/partners#enquiry")}>{t("整理场景问题反馈", "Prepare scene feedback")}</Link>
      <p className={styles.notice}>{t("该链接被描述为三维高斯场景，但内容尚未核验。视觉浏览不能证明场景可用于导航或生态成果认证。展示、下载、检索、导航、训练和再分发需要分别授权。", "The supplied link is described as a 3D Gaussian scene, but its contents remain unverified. Visual browsing cannot establish suitability for navigation or certify ecological outcomes. Display, download, retrieval, navigation, training and redistribution each need separate permission.")}</p>
    </section>
  </LifeShell></>;
}
