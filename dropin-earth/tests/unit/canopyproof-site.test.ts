import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readFirstExisting(relativePaths: string[]): string {
  for (const relativePath of relativePaths) {
    const absolutePath = join(root, relativePath);
    if (existsSync(absolutePath)) {
      return readFileSync(absolutePath, "utf8");
    }
  }

  throw new Error(`None of these files exist: ${relativePaths.join(", ")}`);
}

test("CanopyProof homepage exposes the required public narrative", () => {
  const page = read("apps/web/src/components/canopyproof/CanopyProofLanding.tsx");
  const content = read("apps/web/src/data/siteContent.ts");
  const source = `${page}\n${content}`;

  assert.match(source, /Environmental accountability\. Verified\. Transparent\. Restored\./);
  assert.match(source, /CanopyProof by Dropin/);
  assert.match(source, /Reported -> Verified -> Recorded -> Monitored -> Impact Confirmed/);
  assert.match(source, /Watch 2-minute prototype demo/);
  assert.match(source, /Prototype transparency: sample metrics and selected visual scenes/);
  assert.match(source, /sample interface/i);
  assert.match(source, /demo data/i);
});

test("CanopyProof public site avoids crypto trading language", () => {
  const publicFiles = [
    "apps/web/src/components/canopyproof/CanopyProofLanding.tsx",
    "apps/web/src/data/siteContent.ts",
    "apps/web/public/og/canopyproof-og.svg",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(publicFiles, /\btrading\b/i);
  assert.doesNotMatch(publicFiles, /\byield\b/i);
  assert.doesNotMatch(publicFiles, /\bexchange\b/i);
  assert.doesNotMatch(publicFiles, /\bdefi\b/i);
  assert.doesNotMatch(publicFiles, /\bcoin\b/i);
  assert.doesNotMatch(publicFiles, /\$CANOPY/i);
  assert.doesNotMatch(publicFiles, /token chart/i);
});

test("CanopyProof SEO and crawler files are configured for canopyproof.org", () => {
  const layout = read("apps/web/src/app/layout.tsx");
  const robots = read("apps/web/src/app/robots.ts");
  const sitemap = read("apps/web/src/app/sitemap.ts");

  assert.match(layout, /CanopyProof — Environmental Accountability for Ecological Restoration/);
  assert.match(layout, /canonical: "https:\/\/canopyproof\.org"/);
  assert.match(robots, /https:\/\/canopyproof\.org\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/canopyproof\.org/);
});

test("CanopyProof visual system includes reduced motion support and reusable mark", () => {
  const css = read("apps/web/src/app/globals.css");
  const markExists = existsSync(join(root, "apps/web/src/components/canopyproof/DropinMark.tsx"));

  assert.equal(markExists, true);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--cp-teal: #24d6c3/i);
  assert.match(css, /--cp-ivory: #f6f1e7/i);
});

test("Cloudflare deployment docs and workflow preserve the existing OpenNext path", () => {
  const docs = read("docs/deploy-cloudflare.md");
  const workflow = readFirstExisting([
    ".github/workflows/deploy-cloudflare-worker.yml",
    "../.github/workflows/deploy-cloudflare-worker.yml",
  ]);

  assert.match(docs, /npm run deploy:web:cloudflare/);
  assert.match(docs, /npm --workspace apps\/web run cf:build/);
  assert.match(docs, /Do not deploy `\.next` directly/);
  assert.match(workflow, /CanopyProof OpenNext Worker Deploy/);
  assert.match(workflow, /npm --workspace apps\/web run cf:deploy/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
});
