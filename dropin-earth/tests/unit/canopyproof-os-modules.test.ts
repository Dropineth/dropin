import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const requiredRoutes = [
  ["apps/web/src/app/dashboard/global/page.tsx", "/dashboard/global", /GlobalImpactCommandCenter/],
  ["apps/web/src/app/mobile/report/page.tsx", "/mobile/report", /CanopyProofOSPage/],
  ["apps/web/src/app/terra/page.tsx", "/terra", /CanopyProofOSPage/],
  ["apps/web/src/app/reports/esg/page.tsx", "/reports/esg", /CanopyProofOSPage/],
  ["apps/web/src/app/governance/page.tsx", "/governance", /CanopyProofOSPage/],
  ["apps/web/src/app/partners/page.tsx", "/partners", /CanopyProofOSPage/],
  ["apps/web/src/app/funding/page.tsx", "/funding", /CanopyProofOSPage/],
  ["apps/web/src/app/risk/page.tsx", "/risk", /CanopyProofOSPage/],
] as const;

const openNextWorkerPageFiles = [
  "apps/web/src/app/page.tsx",
  "apps/web/src/app/draw/page.tsx",
  "apps/web/src/app/explorer/page.tsx",
  "apps/web/src/app/explorer/project/[publicProjectId]/page.tsx",
  ...requiredRoutes.map(([file]) => file),
] as const;

test("CanopyProof OS required module routes use the supported OpenNext Worker runtime", () => {
  for (const [file, route, workbench] of requiredRoutes) {
    assert.equal(existsSync(join(root, file)), true, `${route} route file must exist`);
    const source = read(file);
    assert.doesNotMatch(
      source,
      /export const runtime = ["']edge["']/,
      `${route} must use OpenNext's Cloudflare Node.js compatibility runtime`,
    );
    assert.match(source, workbench, `${route} must render its institutional OS workbench`);
  }
});

test("CanopyProof OS pages use the supported single-Worker OpenNext configuration", () => {
  const config = read("apps/web/open-next.config.ts");

  assert.match(config, /defineCloudflareConfig/);
  assert.match(config, /incrementalCache: "dummy"/);
  assert.doesNotMatch(config, /functions\s*:/, "page functions must not be split into unsupported Edge bundles");
  assert.doesNotMatch(config, /wrapper: "cloudflare-edge"/);

  for (const file of openNextWorkerPageFiles) {
    assert.doesNotMatch(
      read(file),
      /export const runtime = ["']edge["']/,
      `${file} must use OpenNext's Cloudflare Node.js compatibility runtime`,
    );
  }
});

test("CanopyProof OS data covers required layers, agents, schemas, and evidence fields", () => {
  const data = read("apps/web/src/data/canopyproof-os.ts");

  for (const route of requiredRoutes.map(([, route]) => route)) {
    assert.match(data, new RegExp(route.replace("/", "\\/")), `${route} must be represented in typed module data`);
  }

  for (const layer of ["Evidence", "Verification", "Governance", "Impact"]) {
    assert.match(data, new RegExp(`"${layer}"`), `${layer} layer must be represented`);
  }

  for (const agent of ["Evidence Agent", "Verification Agent", "ESG Agent", "Funding Agent", "Risk Agent", "Community Agent"]) {
    assert.match(data, new RegExp(agent), `${agent} must be represented`);
  }

  for (const action of ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]) {
    assert.match(data, new RegExp(action), `${action} AHIN action must be represented`);
  }

  for (const field of [
    "id",
    "location",
    "timestamp",
    "contributor",
    "media_hash",
    "gps_hash",
    "verification_status",
    "confidence_score",
    "reviewers",
    "audit_history",
    "offline_sync_id",
    "device_fingerprint_hash",
    "exif_hash",
    "community_attestations",
  ]) {
    assert.match(data, new RegExp(`key: "${field}"`), `${field} evidence schema field must be represented`);
  }

  for (const schema of ["identity", "organizations", "projects", "evidence", "verification", "certificates", "satellite", "impact", "funding", "governance", "audit"]) {
    assert.match(data, new RegExp(`"${schema}"`), `${schema} database schema must be represented`);
  }
});

test("CanopyProof OS surfaces preserve human authority and public claim boundaries", () => {
  const source = [
    read("apps/web/src/data/canopyproof-os.ts"),
    read("apps/web/src/components/canopyproof-os/CanopyProofOSPage.tsx"),
  ].join("\n");

  assert.match(source, /AI cannot issue final proof|AI never finalizes evidence|AI can observe and recommend/);
  assert.match(source, /human review|human gated|Human review/i);
  assert.match(source, /not certified carbon credits|not a certified carbon credit/i);
  assert.match(source, /not a financial asset|financial assets/i);
  assert.match(source, /carbon-tax offsets|carbon-tax offset/i);
  assert.match(source, /guaranteed yield/i);
  assert.match(source, /automatic CANOPY distribution/i);
  assert.match(source, /admin routes must remain blocked|Public admin routes must remain blocked/i);
});

test("CanopyProof mobile report uses an encrypted IndexedDB evidence vault without a compatibility sync fallback", () => {
  const page = read("apps/web/src/app/mobile/report/page.tsx");
  const shell = read("apps/web/src/components/canopyproof-os/CanopyProofOSPage.tsx");
  const queue = read("apps/web/src/components/canopyproof-os/MobileEvidenceDraftQueue.tsx");
  const vault = read("apps/web/src/lib/canopyproof-mobile-evidence-vault.ts");
  const indexedDb = read("apps/web/src/lib/canopyproof-mobile-evidence-indexeddb.ts");

  assert.doesNotMatch(page, /export const runtime = ["']edge["']/);
  assert.match(shell, /MobileEvidenceDraftQueue/);
  assert.match(queue, /^"use client";/);
  assert.match(queue, /createCanopyProofMobileEvidenceBrowserVault/);
  assert.match(queue, /migrateCanopyProofLegacyMobileEvidenceLocalStorage/);
  assert.match(queue, /Encrypted offline queue/);
  assert.match(queue, /Server sync closed/);
  assert.match(queue, /recovery_required/);
  assert.match(queue, /CANOPYPROOF_MOBILE_EVIDENCE_QUOTA_EXCEEDED|operationError/);
  assert.doesNotMatch(queue, /localStorage\.setItem/);
  assert.doesNotMatch(queue, /fetch\(/);

  assert.match(vault, /AES-GCM/);
  assert.match(vault, /generateKey\([\s\S]*false,[\s\S]*\["encrypt", "decrypt"\]/);
  assert.match(vault, /getRandomValues\(new Uint8Array\(12\)\)/);
  assert.match(vault, /additionalData/);
  assert.match(vault, /idempotencyKey/);
  assert.match(vault, /replaceEnvelope/);
  assert.match(indexedDb, /databaseName = "canopyproof-mobile-evidence-vault"/);
  assert.match(indexedDb, /createObjectStore\(keyStoreName/);
  assert.match(indexedDb, /createObjectStore\(draftStoreName/);
  assert.match(indexedDb, /canopyProofLegacyMobileEvidenceStorageKey/);
  assert.match(indexedDb, /storage\.removeItem/);
  assert.doesNotMatch(indexedDb, /storage\.setItem/);

  assert.match(queue, /GPS accuracy meters/);
  assert.match(queue, /never issues proof, moves funds, or creates a public claim/);
  assert.doesNotMatch(queue, /Math\.random/);
  assert.doesNotMatch(vault, /Math\.random/);
});
