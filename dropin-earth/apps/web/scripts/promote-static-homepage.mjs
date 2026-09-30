import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cwd, stdout, env } from "node:process";

const appRoot = cwd();
const nextAppDir = join(appRoot, ".next", "server", "app");
const openNextAssetsDir = join(appRoot, ".open-next", "assets");

const assets = [
  ["index.html", "index.html"],
  ["index.rsc", "index.rsc"],
  ["robots.txt.body", "robots.txt"],
  ["sitemap.xml.body", "sitemap.xml"],
];

function requireFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Cannot promote static homepage asset: missing ${label} at ${path}`);
  }
}

requireFile(join(nextAppDir, "index.html"), "prerendered homepage HTML");
mkdirSync(openNextAssetsDir, { recursive: true });

for (const [sourceName, targetName] of assets) {
  const sourcePath = join(nextAppDir, sourceName);
  if (!existsSync(sourcePath)) {
    if (sourceName !== "index.rsc") requireFile(sourcePath, sourceName);
    continue;
  }
  copyFileSync(sourcePath, join(openNextAssetsDir, targetName));
}

stdout.write("[CanopyProof] Promoted prerendered homepage into OpenNext Worker assets.\n");

// Static assets bypass Next middleware in workerd. Preview must fail closed here too.
const production = env.NEXT_PUBLIC_CANOPYPROOF_MODE === "production"
  && env.NEXT_PUBLIC_DROPIN_SITE_URL === "https://canopyproof.org";
if (!production) {
  writeFileSync(join(openNextAssetsDir, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  writeFileSync(join(openNextAssetsDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
}
