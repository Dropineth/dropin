import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cwd, stdout } from "node:process";

const appRoot = cwd();
const nextAppDir = join(appRoot, ".next", "server", "app");
const openNextAssetsDir = join(appRoot, ".open-next", "assets");

const assets = [
  ["index.html", "index.html"],
  ["index.rsc", "index.rsc"],
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
    continue;
  }
  copyFileSync(sourcePath, join(openNextAssetsDir, targetName));
}

stdout.write("[CanopyProof] Promoted prerendered homepage into OpenNext Worker assets.\n");
