import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
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

test("CanopyProof Explorer uses the canonical route without sample record fallbacks", () => {
  const landing = read("apps/web/src/components/canopyproof/CanopyProofLanding.tsx");
  const explorer = read("apps/web/src/components/canopyproof/PublicExplorer.tsx");
  const explorerPage = read("apps/web/src/app/explorer/page.tsx");
  const projectPage = read("apps/web/src/app/explorer/project/[publicProjectId]/page.tsx");
  const openNextConfig = read("apps/web/open-next.config.ts");
  const content = read("apps/web/src/data/siteContent.ts");

  assert.match(explorer, /^"use client";/);
  assert.match(explorer, /canopyProofPublicExplorerProjectResponseSchema\.safeParse/);
  assert.match(explorer, /fetch\(`\/api\/canopyproof\/explorer\/projects\//);
  assert.match(explorer, /cache: "no-store"/);
  assert.match(explorer, /There is no browse-all endpoint/);
  assert.match(explorer, /not a certified carbon credit/);
  assert.doesNotMatch(explorerPage, /export const runtime = ["']edge["']/);
  assert.doesNotMatch(projectPage, /export const runtime = ["']edge["']/);
  assert.match(openNextConfig, /defineCloudflareConfig/);
  assert.doesNotMatch(openNextConfig, /functions\s*:/);
  assert.doesNotMatch(openNextConfig, /cloudflare-edge/);
  assert.match(landing, /The Explorer never substitutes demo records/);
  assert.match(landing, /href="\/explorer"/);

  const explorerPresentation = `${landing}\n${content}`;
  assert.doesNotMatch(explorerPresentation, /explorerMetrics/);
  assert.doesNotMatch(explorerPresentation, /proofRecords/);
  assert.doesNotMatch(explorerPresentation, /Sample global ecological restoration map/);
  assert.doesNotMatch(explorerPresentation, /Community report submitted · 12 min ago/);
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
  const publicSitemap = read("apps/web/public/sitemap.xml");

  assert.match(layout, /CanopyProof — Environmental Accountability for Ecological Restoration/);
  assert.match(layout, /canonical: "https:\/\/canopyproof\.org"/);
  assert.match(robots, /https:\/\/canopyproof\.org\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/canopyproof\.org/);
  assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/<\/loc>/);
  assert.match(publicSitemap, /<loc>https:\/\/canopyproof\.org\/status<\/loc>/);
});

test("CanopyProof visual system includes reduced motion support and locked production logo", () => {
  const css = read("apps/web/src/app/globals.css");
  const markExists = existsSync(join(root, "apps/web/src/components/canopyproof/DropinMark.tsx"));
  const logo = read("apps/web/src/components/canopyproof/logo.ts");
  const logoComponent = read("apps/web/src/components/canopyproof/CanopyProofLogo.tsx");

  assert.equal(markExists, false);
  assert.match(logo, /\/icon\.jpg/);
  assert.doesNotMatch(logo, /pbs\.twimg\.com/);
  assert.match(logoComponent, /<img/);
  assert.doesNotMatch(logoComponent, /<svg/i);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--cp-teal: #24d6c3/i);
  assert.match(css, /--cp-ivory: #f6f1e7/i);
});

test("Cloudflare deployment docs and workflow preserve the existing OpenNext path", () => {
  const platformDocs = read("docs/deploy-cloudflare.md");
  const productionDocs = read("docs/deployment-cloudflare-canopyproof.md");
  const workflow = read(".github/workflows/deploy-cloudflare-worker.yml");

  assert.match(platformDocs, /npm run deploy:web:cloudflare/);
  assert.match(platformDocs, /npm --workspace apps\/web run cf:build/);
  assert.match(platformDocs, /Do not deploy `\.next` directly/);
  assert.match(productionDocs, /npm run deploy:web:cloudflare/);
  assert.match(productionDocs, /Do not treat `\.next` as a static Pages output directory/);
  assert.match(productionDocs, /OpenNext deployment path/);
  assert.match(workflow, /CanopyProof OpenNext Worker Deploy/);
  assert.match(workflow, /npm --workspace apps\/web run cf:build/);
  assert.match(workflow, /npm --workspace apps\/web run cf:deploy/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
});
