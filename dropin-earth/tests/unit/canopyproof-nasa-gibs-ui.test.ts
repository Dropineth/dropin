import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("Terra NASA GIBS viewer is client-only, lazy-loaded, and constrained to the fixed NASA host", () => {
  const page = source("apps/web/src/app/terra/page.tsx");
  const loader = source("apps/web/src/components/canopyproof-os/NasaGibsViewerLoader.tsx");
  const viewer = source("apps/web/src/components/canopyproof-os/NasaGibsEarthObservation.tsx");

  assert.doesNotMatch(page, /export const runtime = ["']edge["']/);
  assert.match(loader, /^["']use client["'];/);
  assert.match(loader, /dynamic\(/);
  assert.match(loader, /ssr:\s*false/);
  assert.match(viewer, /^["']use client["'];/);
  assert.match(viewer, /maplibre-gl/);
  assert.match(viewer, /@deck\.gl\/layers/);
  assert.match(viewer, /gibs\.earthdata\.nasa\.gov/);
  assert.doesNotMatch(viewer, /<iframe\b/i);
  assert.match(viewer, /NASA does not endorse CanopyProof/);
  assert.match(viewer, /not verified evidence|not numerical source data/i);
  assert.match(viewer, /loadState\.state === ["']disabled["']/);
  assert.match(viewer, /state === ["']outage["']/);
  assert.match(viewer, /contentType\.includes\(["']application\/json["']\)/);
  assert.match(viewer, /returned an invalid response/);
  assert.match(viewer, /\/tile-failures/);
  assert.match(viewer, /map\.on\(["']error["']/);
  assert.match(viewer, /endpointId !== ["']nasa-gibs-wmts-epsg3857-best["']/);
  assert.match(viewer, /setBeforeManifest\(undefined\)/);
  assert.match(viewer, /searchParams\.set\(["']p["'], worldviewProjection\(product\.projection\)\)/);
  assert.match(viewer, /projection === ["']EPSG:3413["'].*return ["']arctic["']/s);
  assert.match(viewer, /projection === ["']EPSG:3031["'].*return ["']antarctic["']/s);
});

test("NASA viewer never presents imagery as proof, ESG authority, or a funding decision", () => {
  const viewer = source("apps/web/src/components/canopyproof-os/NasaGibsEarthObservation.tsx");
  assert.doesNotMatch(viewer, /NASA[^\n]{0,40}(?:verified proof|certified carbon|funding decision)/i);
  assert.match(viewer, /Earth observation context/);
  assert.match(viewer, /institutional review|source-data review/i);
});
