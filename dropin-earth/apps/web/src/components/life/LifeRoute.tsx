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
  ];
  return <><LifeShell locale={locale} path={`/life/spaces/${scene.id}`}>
    <header className={`${styles.container} ${styles.pageHero}`}>
      <p className={styles.eyebrow}>{t("空间档案 / 用户提供的测试输入", "SPATIAL REGISTER / USER-PROVIDED TEST INPUT")}</p>
      <h1>{locale === "zh" ? scene.titleZh : scene.titleEn}</h1>
      <p>{t("3D 高斯测试链接。来源、展示许可与导航能力待确认。", "A 3D Gaussian test link. Provenance, display permissions and navigation capability await confirmation.")}</p>
    </header>
    <section className={`${styles.container} ${styles.sectionFirst}`} aria-label={t("场景查看器", "Scene viewer")}><SceneViewer scene={scene} locale={locale} /></section>
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.sectionHeading}><h2>{t("每个场景，都应有清楚的来处。", "Every scene needs a clear provenance.")}</h2></div>
      <dl className={`${styles.panel} ${styles.sceneMetadata}`}>{fields.map(([zh, en, value]) => <div key={en}><dt>{t(zh,en)}</dt><dd>{typeof value === "string" ? value : t("待确认", "To be confirmed")}</dd></div>)}</dl>
      <p className={styles.notice}>{t("用户将其描述为三维高斯测试场景；尚未读取或核验内部资产。可视浏览不等于导航地图，也不等于生态成果认证。展示、下载、检索、导航、训练和再分发需要分别授权。", "The user describes this as a 3D Gaussian test scene; internal assets have not been read or validated. Visual browsing is not a navigation map or ecological certification. Display, download, retrieval, navigation, training and redistribution each require separate permission.")}</p>
    </section>
  </LifeShell></>;
}
