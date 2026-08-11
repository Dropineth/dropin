#!/usr/bin/env node
/* global console, process, URL */
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const STAGING_CONFIRMATION = "isolated-canopyproof-staging";
const FORBIDDEN_RESOURCE_KEYS =
  /(?:credential|password|private.?key|secret|token|database.?url|connection.?string)/iu;

function requireExactEnvironment(name, env) {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function validateStagingOrigin(value, productionOrigin = "") {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CANOPYPROOF_STAGING_API_ORIGIN must be an absolute URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("CANOPYPROOF_STAGING_API_ORIGIN must use HTTPS");
  }
  if (
    url.hostname === "canopyproof.org" ||
    url.hostname === "www.canopyproof.org" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  ) {
    throw new Error("CANOPYPROOF_STAGING_API_ORIGIN must not use production or local hosts");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(
      "CANOPYPROOF_STAGING_API_ORIGIN must not contain credentials, a path, query, or fragment",
    );
  }

  if (productionOrigin) {
    let productionUrl;
    try {
      productionUrl = new URL(productionOrigin);
    } catch {
      throw new Error("Configured production API origin is invalid");
    }
    if (url.origin === productionUrl.origin) {
      throw new Error("Staging and production API origins must be different");
    }
  }

  return url.origin;
}

function inspectResourceKeys(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectResourceKeys(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_RESOURCE_KEYS.test(key)) {
      throw new Error(`Staging resource manifest contains forbidden key at ${path}.${key}`);
    }
    inspectResourceKeys(entry, `${path}.${key}`);
  }
}

export function validateResourceManifest(rawManifest, expectedHash, stagingApiOrigin) {
  if (!/^[0-9a-f]{64}$/u.test(expectedHash)) {
    throw new Error("resource_manifest_sha256 must be a lowercase SHA-256 digest");
  }
  const actualHash = createHash("sha256").update(rawManifest, "utf8").digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error("Staging resource manifest hash does not match the approved digest");
  }

  let manifest;
  try {
    manifest = JSON.parse(rawManifest);
  } catch {
    throw new Error("CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON must be valid JSON");
  }
  inspectResourceKeys(manifest);

  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.environment !== "canopyproof-staging" ||
    manifest?.productionData !== false ||
    manifest?.apiOrigin !== stagingApiOrigin
  ) {
    throw new Error("Staging resource manifest identity is invalid");
  }
  if (
    manifest?.database?.kind !== "postgresql" ||
    manifest?.database?.productionData !== false ||
    typeof manifest?.database?.identifier !== "string" ||
    !/staging/iu.test(manifest.database.identifier)
  ) {
    throw new Error("Staging manifest must identify an isolated PostgreSQL database");
  }
  if (
    manifest?.objectStorage?.productionData !== false ||
    typeof manifest?.objectStorage?.identifier !== "string" ||
    !/staging/iu.test(manifest.objectStorage.identifier)
  ) {
    throw new Error("Staging manifest must identify isolated object storage");
  }

  return {
    manifestSha256: actualHash,
    database: {
      kind: manifest.database.kind,
      identifier: manifest.database.identifier,
      productionData: false,
    },
    objectStorage: {
      identifier: manifest.objectStorage.identifier,
      productionData: false,
    },
  };
}

export function runStagingPreflight(env = process.env) {
  if (env.STAGING_CONFIRM !== STAGING_CONFIRMATION) {
    throw new Error(`staging_confirm must equal ${STAGING_CONFIRMATION}`);
  }
  const targetSha = requireExactEnvironment("REQUESTED_TARGET_SHA", env);
  if (!/^[0-9a-f]{40}$/u.test(targetSha)) {
    throw new Error("REQUESTED_TARGET_SHA must be a full lowercase commit SHA");
  }

  requireExactEnvironment("CLOUDFLARE_API_TOKEN", env);
  requireExactEnvironment("CLOUDFLARE_ACCOUNT_ID", env);
  const stagingApiOrigin = validateStagingOrigin(
    requireExactEnvironment("CANOPYPROOF_STAGING_API_ORIGIN", env),
    env.DROPIN_PRODUCTION_API_ORIGIN ?? "",
  );
  const resourceManifest = validateResourceManifest(
    requireExactEnvironment("CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON", env),
    requireExactEnvironment("RESOURCE_MANIFEST_SHA256", env),
    stagingApiOrigin,
  );

  return {
    schemaVersion: 1,
    environment: "canopyproof-staging",
    targetSha,
    stagingApiOrigin,
    resourceManifest,
    safetyBoundaries: {
      CANOPY_PRODUCTION_UNLOCK: false,
      DROPIN_ALLOW_ADMIN_PROXY: false,
      realSatelliteProviderWrites: false,
      productionMobileSync: false,
      automaticCanopyDistribution: false,
      mainnetFunds: false,
      PLANETARY_LAB: false,
      carbonCreditIssuance: false,
      taxOffsetClaims: false,
      guaranteedYieldClaims: false,
      apiAndWebWorkersSeparated: true,
    },
  };
}

async function main() {
  const result = runStagingPreflight();
  const outputPath = requireExactEnvironment("CANOPYPROOF_STAGING_PREFLIGHT_OUTPUT", process.env);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      environment: result.environment,
      targetSha: result.targetSha,
      resourceManifestSha256: result.resourceManifest.manifestSha256,
      status: "PASS",
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
