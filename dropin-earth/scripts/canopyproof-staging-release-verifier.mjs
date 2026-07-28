/* global Buffer, URL, console, process */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const EXPECTED_WORKFLOW_REF =
  "Dropineth/dropin/.github/workflows/deploy-canopyproof-staging.yml@refs/heads/main";

export const EXPECTED_BINDING = Object.freeze({
  releaseType: "industrial-staging",
  deployTargetSha: "a2d48748e49ffb44e9f0b0f45099a30804d7cdd8",
  evidenceSha: "baf1695239c439a17398c4406b3362e073fbd7a5",
  r2ManifestSha256:
    "f4925d27f4eaa46550cb6aefce5354deab02c088595153d6767976a5feb09698",
  environment: "canopyproof-staging",
  webWorker: "canopyproof-web-staging",
  apiWorker: "canopyproof-api-staging",
  telemetryEnvironment: "canopyproof-staging",
  databaseClass: "STAGING_ONLY",
  objectStorageClass: "STAGING_ONLY",
  productionDataAllowed: false,
  apiWebWorkersSeparated: true,
});

export const EXPECTED_FEATURE_FLAGS = Object.freeze([
  "CANOPY_PRODUCTION_UNLOCK",
  "DROPIN_ALLOW_ADMIN_PROXY",
  "productionMobileSync",
  "realSatelliteWrites",
  "automaticCanopyDistribution",
  "mainnetFunds",
  "planetaryLab",
  "certifiedCarbonCreditClaims",
  "carbonTaxOffsetClaims",
  "guaranteedRwaYieldClaims",
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RESOURCE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:/-]{8,160}$/u;
const STORAGE_PREFIX_PATTERN = /^[A-Za-z0-9._/-]{8,160}$/u;
const PRODUCTION_IDENTITY_PATTERN =
  /(?:^|[-_.:/])(prod(?:uction)?|mainnet|live)(?:$|[-_.:/])/iu;
const CREDENTIAL_KEY_PATTERN =
  /(?:token|password|passwd|secret|credential|private[-_]?key|connection[-_]?string|authorization|cookie|session|mnemonic|seed[-_]?phrase)/iu;
const EVIDENCE_PATH_PATTERNS = [
  /^docs\//u,
  /^reports\//u,
  /^dropin-earth\/docs\//u,
  /^dropin-earth\/reports\//u,
];

const TOP_LEVEL_RESOURCE_KEYS = new Set([
  "schemaVersion",
  "releaseType",
  "deployTargetSha",
  "evidenceSha",
  "r2ManifestSha256",
  "environment",
  "webWorker",
  "apiWorker",
  "apiOrigin",
  "telemetryEnvironment",
  "databaseClass",
  "databaseIdentifier",
  "objectStorageClass",
  "objectStorageIdentifier",
  "objectStoragePrefix",
  "productionDataAllowed",
  "apiWebWorkersSeparated",
  "featureFlags",
  "integrity",
]);

function fail(message) {
  throw new Error(`CanopyProof staging verification failed: ${message}`);
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    fail(`${label} must be a JSON object`);
  }
  return value;
}

function assertExactKeys(value, allowedKeys, label) {
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    fail(`${label} contains unsupported field(s): ${unexpected.join(", ")}`);
  }
}

function assertFullSha(value, label) {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) {
    fail(`${label} must be a full 40-character lowercase commit SHA`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertNoCredentialFields(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialFields(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (CREDENTIAL_KEY_PATTERN.test(key)) {
      fail(`credential-like field is forbidden at ${path}.${key}`);
    }
    assertNoCredentialFields(item, `${path}.${key}`);
  }
}

function assertStagingIdentifier(value, label, pattern = RESOURCE_IDENTIFIER_PATTERN) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} must use a bounded resource identifier`);
  }
  const normalized = value.toLowerCase();
  if (PRODUCTION_IDENTITY_PATTERN.test(normalized)) {
    fail(`${label} contains a production identity`);
  }
  if (!normalized.includes("staging")) {
    fail(`${label} must contain the staging identity`);
  }
}

function assertSafeStagingOrigin(value) {
  if (typeof value !== "string") {
    fail("apiOrigin must be a string");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    fail("apiOrigin must be a valid absolute URL");
  }

  if (url.protocol !== "https:") {
    fail("apiOrigin must use HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    fail("apiOrigin must not contain credentials, query parameters, or fragments");
  }

  const hostname = url.hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
  if (
    localHosts.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".invalid")
  ) {
    fail("apiOrigin must not use a local or placeholder host");
  }
  if (
    hostname === "canopyproof.org" ||
    hostname.endsWith(".canopyproof.org") ||
    PRODUCTION_IDENTITY_PATTERN.test(hostname)
  ) {
    fail("apiOrigin must not use a production origin");
  }
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeJsonValue(value[key])]),
    );
  }
  return value;
}

export function canonicalizeJson(value) {
  return JSON.stringify(normalizeJsonValue(value));
}

export function resourceManifestPayload(manifest) {
  const object = assertPlainObject(manifest, "resource manifest");
  const payload = { ...object };
  delete payload.integrity;
  return payload;
}

export function calculateResourceManifestIntegrity(manifest, hmacKey) {
  if (!Buffer.isBuffer(hmacKey) || hmacKey.byteLength < 32) {
    fail("resource manifest HMAC key must contain at least 32 bytes");
  }
  const canonicalPayload = canonicalizeJson(resourceManifestPayload(manifest));
  return {
    algorithm: "HMAC-SHA256",
    payloadSha256: createHash("sha256").update(canonicalPayload).digest("hex"),
    signature: createHmac("sha256", hmacKey).update(canonicalPayload).digest("hex"),
  };
}

function assertEqualDigest(actual, expected, label) {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    actualBuffer.byteLength !== expectedBuffer.byteLength ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    fail(`${label} mismatch`);
  }
}

export function verifyResourceManifestIntegrity(manifest, hmacKey) {
  const object = assertPlainObject(manifest, "resource manifest");
  const integrity = assertPlainObject(object.integrity, "resource manifest integrity");
  assertExactKeys(
    integrity,
    new Set(["algorithm", "payloadSha256", "signature"]),
    "resource manifest integrity",
  );
  if (integrity.algorithm !== "HMAC-SHA256") {
    fail("resource manifest is unsigned or uses an unsupported integrity algorithm");
  }
  assertSha256(integrity.payloadSha256, "resource manifest payloadSha256");
  assertSha256(integrity.signature, "resource manifest signature");

  const calculated = calculateResourceManifestIntegrity(object, hmacKey);
  assertEqualDigest(
    integrity.payloadSha256,
    calculated.payloadSha256,
    "resource manifest payload SHA-256",
  );
  assertEqualDigest(
    integrity.signature,
    calculated.signature,
    "resource manifest HMAC signature",
  );
  return calculated;
}

export function validateReleaseBinding(binding, dispatch) {
  const object = assertPlainObject(binding, "release binding");
  assertFullSha(dispatch.deployTargetSha, "deploy_target_sha");
  assertFullSha(dispatch.evidenceSha, "evidence_sha");
  assertSha256(dispatch.releaseManifestSha256, "release_manifest_sha256");

  for (const [key, expected] of Object.entries(EXPECTED_BINDING)) {
    if (object[key] !== expected) {
      fail(`release binding ${key} differs from the immutable R3A contract`);
    }
  }

  if (dispatch.deployTargetSha !== object.deployTargetSha) {
    fail("deploy target differs from the release binding");
  }
  if (dispatch.evidenceSha !== object.evidenceSha) {
    fail("evidence SHA differs from the release binding");
  }
  if (dispatch.releaseManifestSha256 !== object.r2ManifestSha256) {
    fail("R2 release manifest SHA-256 differs from the release binding");
  }
  if (dispatch.workflowRef !== EXPECTED_WORKFLOW_REF) {
    fail("workflow ref is not the trusted main-owned staging workflow");
  }
  if (dispatch.deployTargetSha === dispatch.evidenceSha) {
    fail("evidence SHA must never be substituted for the deploy target");
  }

  const featureFlags = assertPlainObject(object.featureFlags, "release binding featureFlags");
  assertExactKeys(
    featureFlags,
    new Set(EXPECTED_FEATURE_FLAGS),
    "release binding featureFlags",
  );
  for (const flag of EXPECTED_FEATURE_FLAGS) {
    if (featureFlags[flag] !== false) {
      fail(`high-risk feature flag ${flag} must remain false`);
    }
  }

  return object;
}

export function validateSchemaContract(schema, binding) {
  const object = assertPlainObject(schema, "resource manifest schema");
  if (object.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    fail("resource manifest schema must use JSON Schema draft 2020-12");
  }
  if (object.additionalProperties !== false) {
    fail("resource manifest schema must reject additional properties");
  }
  const required = new Set(Array.isArray(object.required) ? object.required : []);
  for (const key of TOP_LEVEL_RESOURCE_KEYS) {
    if (!required.has(key)) {
      fail(`resource manifest schema does not require ${key}`);
    }
  }

  const properties = assertPlainObject(object.properties, "resource manifest schema properties");
  for (const [key, expected] of Object.entries(EXPECTED_BINDING)) {
    if (key === "featureFlags") {
      continue;
    }
    if (!isPlainObject(properties[key]) || properties[key].const !== expected) {
      fail(`resource manifest schema does not bind ${key}`);
    }
  }

  const schemaFlags = assertPlainObject(
    properties.featureFlags?.properties,
    "resource manifest schema feature flags",
  );
  for (const flag of EXPECTED_FEATURE_FLAGS) {
    if (!isPlainObject(schemaFlags[flag]) || schemaFlags[flag].const !== false) {
      fail(`resource manifest schema does not lock ${flag} to false`);
    }
  }

  if (binding.deployTargetSha !== properties.deployTargetSha.const) {
    fail("schema deploy target differs from the trusted release binding");
  }
  return object;
}

export function validateResourceManifest(manifest, binding, hmacKey) {
  const object = assertPlainObject(manifest, "resource manifest");
  assertExactKeys(object, TOP_LEVEL_RESOURCE_KEYS, "resource manifest");
  assertNoCredentialFields(resourceManifestPayload(object));

  if (object.schemaVersion !== 1) {
    fail("resource manifest schemaVersion must equal 1");
  }
  for (const [key, expected] of Object.entries(EXPECTED_BINDING)) {
    if (key === "featureFlags") {
      continue;
    }
    if (object[key] !== expected || object[key] !== binding[key]) {
      fail(`resource manifest ${key} differs from the release binding`);
    }
  }
  if (object.webWorker === object.apiWorker || object.apiWebWorkersSeparated !== true) {
    fail("Web and API Workers must remain separate");
  }
  for (const [label, worker] of [
    ["webWorker", object.webWorker],
    ["apiWorker", object.apiWorker],
  ]) {
    assertStagingIdentifier(worker, label);
  }

  assertSafeStagingOrigin(object.apiOrigin);
  assertStagingIdentifier(object.databaseIdentifier, "databaseIdentifier");
  assertStagingIdentifier(object.objectStorageIdentifier, "objectStorageIdentifier");
  assertStagingIdentifier(
    object.objectStoragePrefix,
    "objectStoragePrefix",
    STORAGE_PREFIX_PATTERN,
  );

  if (object.telemetryEnvironment !== "canopyproof-staging") {
    fail("telemetry environment must equal canopyproof-staging");
  }
  if (object.productionDataAllowed !== false) {
    fail("productionDataAllowed must remain false");
  }

  const featureFlags = assertPlainObject(object.featureFlags, "resource manifest featureFlags");
  assertExactKeys(featureFlags, new Set(EXPECTED_FEATURE_FLAGS), "resource manifest featureFlags");
  for (const flag of EXPECTED_FEATURE_FLAGS) {
    if (featureFlags[flag] !== false) {
      fail(`high-risk feature flag ${flag} must remain false`);
    }
  }

  verifyResourceManifestIntegrity(object, hmacKey);
  return object;
}

export function validateEvidenceReport(report, deployTargetSha) {
  if (typeof report !== "string" || report.length === 0) {
    fail("evidence report is missing");
  }
  if (!report.includes("# CanopyProof R2 Final Release Candidate")) {
    fail("evidence report has the wrong release identity");
  }
  if (!report.includes("Final state: `NOT_PRODUCTION_READY`")) {
    fail("evidence report must retain its non-production status");
  }
  const escapedTarget = deployTargetSha.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const targetRow = new RegExp(
    `\\| Final deploy target \\| \`${escapedTarget}\` \\|`,
    "u",
  );
  if (!targetRow.test(report)) {
    fail("evidence report does not bind the immutable deploy target");
  }
  if (!report.includes("documentation-only commit")) {
    fail("evidence report does not distinguish evidence from deployable code");
  }
}

export function validatePullRequestReviews(reviewEvidence, evidenceSha) {
  const evidence = assertPlainObject(reviewEvidence, "pull request review evidence");
  const pullRequest = assertPlainObject(
    evidence.pullRequest,
    "pull request review evidence pullRequest",
  );
  const reviews = Array.isArray(evidence.reviews) ? evidence.reviews : [];

  if (pullRequest.number !== 2) {
    fail("review evidence must describe Product PR #2");
  }
  if (pullRequest.author !== "poccahin") {
    fail("review evidence has the wrong Product PR author");
  }
  if (pullRequest.baseRef !== "main") {
    fail("review evidence has the wrong Product PR base");
  }
  if (pullRequest.headRef !== "canopyproof/industrial-rc1") {
    fail("review evidence has the wrong Product PR branch");
  }
  if (pullRequest.headSha !== evidenceSha) {
    fail("Product PR head does not equal the reviewed evidence SHA");
  }
  if (pullRequest.draft !== false) {
    fail("Product PR must be ready for independent review before staging");
  }

  const latestByReviewer = new Map();
  for (const candidate of reviews) {
    if (!isPlainObject(candidate) || typeof candidate.reviewer !== "string") {
      fail("review evidence contains a malformed review");
    }
    const previous = latestByReviewer.get(candidate.reviewer);
    const previousTime =
      previous && typeof previous.submittedAt === "string"
        ? Date.parse(previous.submittedAt)
        : Number.NEGATIVE_INFINITY;
    const candidateTime =
      typeof candidate.submittedAt === "string"
        ? Date.parse(candidate.submittedAt)
        : Number.NaN;
    if (!Number.isFinite(candidateTime)) {
      fail(`review by ${candidate.reviewer} has an invalid timestamp`);
    }
    if (!previous || candidateTime >= previousTime) {
      latestByReviewer.set(candidate.reviewer, candidate);
    }
  }

  const allowedAssociations = new Set(["COLLABORATOR", "MEMBER", "OWNER"]);
  const approvals = [...latestByReviewer.values()].filter(
    (review) =>
      review.state === "APPROVED" &&
      review.commitId === evidenceSha &&
      review.reviewer !== pullRequest.author &&
      review.reviewerType === "User" &&
      allowedAssociations.has(review.authorAssociation),
  );

  if (approvals.length < 2) {
    fail(
      "two independent collaborator approvals on the exact evidence SHA are required",
    );
  }
  return approvals.map((review) => review.reviewer).sort();
}

function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitPaths(repoRoot, commitSha) {
  const output = git(repoRoot, [
    "diff-tree",
    "--root",
    "--no-commit-id",
    "--name-only",
    "-r",
    commitSha,
  ]);
  return output === "" ? [] : output.split("\n");
}

function isEvidenceOnlyPath(path) {
  return EVIDENCE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function verifyGitBinding({
  repoRoot,
  deployTargetSha,
  evidenceSha,
  reviewedRcRef,
}) {
  assertFullSha(deployTargetSha, "deploy target");
  assertFullSha(evidenceSha, "evidence SHA");

  for (const sha of [deployTargetSha, evidenceSha]) {
    const type = git(repoRoot, ["cat-file", "-t", sha]);
    if (type !== "commit") {
      fail(`${sha} is not a Git commit`);
    }
  }

  const rcTip = git(repoRoot, ["rev-parse", reviewedRcRef]);
  if (rcTip !== evidenceSha) {
    fail("reviewed RC branch tip does not equal the evidence SHA");
  }

  try {
    git(repoRoot, ["merge-base", "--is-ancestor", deployTargetSha, evidenceSha]);
  } catch {
    fail("deploy target is not reachable from the reviewed evidence commit");
  }

  const targetPaths = commitPaths(repoRoot, deployTargetSha);
  if (targetPaths.length === 0 || targetPaths.every(isEvidenceOnlyPath)) {
    fail("deploy target is an evidence-only commit");
  }

  const evidencePaths = commitPaths(repoRoot, evidenceSha);
  if (evidencePaths.length === 0 || !evidencePaths.every(isEvidenceOnlyPath)) {
    fail("evidence commit contains non-evidence paths");
  }

  return {
    reviewedRcTip: rcTip,
    targetPathCount: targetPaths.length,
    evidencePathCount: evidencePaths.length,
  };
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      fail(`invalid CLI argument near ${flag ?? "<end>"}`);
    }
    parsed[flag.slice(2)] = value;
  }
  return parsed;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeHmacKey(value) {
  if (typeof value !== "string" || value.length === 0) {
    fail("CANOPYPROOF_STAGING_RESOURCE_MANIFEST_HMAC_KEY_B64 is absent");
  }
  const key = Buffer.from(value, "base64");
  if (key.byteLength < 32 || key.toString("base64").replaceAll("=", "") !== value.replaceAll("=", "")) {
    fail("resource manifest HMAC key must be canonical base64 with at least 32 bytes");
  }
  return key;
}

export function runCli(argv, environment = process.env) {
  const options = parseArguments(argv);
  const requiredOptions = [
    "binding",
    "schema",
    "resource-manifest",
    "evidence-report",
    "reviews",
    "deploy-target-sha",
    "evidence-sha",
    "release-manifest-sha256",
    "workflow-ref",
    "reviewed-rc-ref",
    "repo-root",
    "output",
  ];
  for (const option of requiredOptions) {
    if (!options[option]) {
      fail(`missing --${option}`);
    }
  }

  const binding = validateReleaseBinding(
    readJson(resolve(options.binding), "release binding"),
    {
      deployTargetSha: options["deploy-target-sha"],
      evidenceSha: options["evidence-sha"],
      releaseManifestSha256: options["release-manifest-sha256"],
      workflowRef: options["workflow-ref"],
    },
  );
  const schema = readJson(resolve(options.schema), "resource manifest schema");
  validateSchemaContract(schema, binding);

  const manifest = readJson(resolve(options["resource-manifest"]), "resource manifest");
  const hmacKey = decodeHmacKey(
    environment.CANOPYPROOF_STAGING_RESOURCE_MANIFEST_HMAC_KEY_B64,
  );
  validateResourceManifest(manifest, binding, hmacKey);
  validateEvidenceReport(
    readFileSync(resolve(options["evidence-report"]), "utf8"),
    options["deploy-target-sha"],
  );
  const approvalReviewers = validatePullRequestReviews(
    readJson(resolve(options.reviews), "pull request review evidence"),
    options["evidence-sha"],
  );
  const gitBinding = verifyGitBinding({
    repoRoot: resolve(options["repo-root"]),
    deployTargetSha: options["deploy-target-sha"],
    evidenceSha: options["evidence-sha"],
    reviewedRcRef: options["reviewed-rc-ref"],
  });

  const output = {
    status: "VERIFIED",
    releaseType: binding.releaseType,
    deployTargetSha: binding.deployTargetSha,
    evidenceSha: binding.evidenceSha,
    r2ManifestSha256: binding.r2ManifestSha256,
    environment: binding.environment,
    webWorker: binding.webWorker,
    apiWorker: binding.apiWorker,
    telemetryEnvironment: binding.telemetryEnvironment,
    databaseClass: binding.databaseClass,
    objectStorageClass: binding.objectStorageClass,
    productionDataAllowed: false,
    apiWebWorkersSeparated: true,
    resourceManifestPayloadSha256: manifest.integrity.payloadSha256,
    approvalReviewers,
    reviewedRcTip: gitBinding.reviewedRcTip,
    verifiedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(options.output), `${JSON.stringify(output, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(resolve(options.output), 0o600);
  return output;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    const result = runCli(process.argv.slice(2));
    console.log(
      `CanopyProof staging release verified for ${result.deployTargetSha}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
