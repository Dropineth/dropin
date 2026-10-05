import { execFileSync } from "node:child_process";
export function renderedMetadata(production: boolean) {
  const source = 'import sitemap from "./apps/web/src/app/sitemap.ts"; import robots from "./apps/web/src/app/robots.ts"; console.log(JSON.stringify({sitemap:sitemap(),robots:robots()}));';
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], { encoding: "utf8", env: {...process.env, NEXT_PUBLIC_CANOPYPROOF_MODE:production?"production":"staging", NEXT_PUBLIC_DROPIN_SITE_URL:production?"https://canopyproof.org":"https://preview.example.invalid"} })) as { sitemap: {url:string;alternates?:unknown}[]; robots:{rules:{disallow?:string}[];sitemap?:string} };
}
