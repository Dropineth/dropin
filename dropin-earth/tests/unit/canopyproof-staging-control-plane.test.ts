import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { before, test } from "node:test";

interface ReleaseDispatch {
  deployTargetSha: string;
  evidenceSha: string;
  releaseManifestSha256: string;
  workflowRef: string;
}

interface GitBindingInput {
  repoRoot: string;
  deployTargetSha: string;
  evidenceSha: string;
  reviewedRcRef: string;
}

interface VerifierModule {
  EXPECTED_BINDING: Readonly<Record<string, unknown>>;
  EXPECTED_FEATURE_FLAGS: readonly string[];
  EXPECTED_WORKFLOW_REF: string;
  calculateResourceManifestIntegrity(
    manifest: Record<string, unknown>,
    hmacKey: Buffer,
  ): Record<string, string>;
  canonicalizeJson(value: unknown): string;
  validateEvidenceReport(report: string, deployTargetSha: string): void;
  validatePullRequestReviews(
    reviewEvidence: Record<string, unknown>,
    evidenceSha: string,
  ): string[];
  validateReleaseBinding(
    binding: Record<string, unknown>,
    dispatch: ReleaseDispatch,
  ): Record<string, unknown>;
  validateResourceManifest(
    manifest: Record<string, unknown>,
    binding: Record<string, unknown>,
    hmacKey: Buffer,
  ): Record<string, unknown>;
  validateSchemaContract(
    schema: Record<string, unknown>,
    binding: Record<string, unknown>,
  ): Record<string, unknown>;
  verifyGitBinding(input: GitBindingInput): {
    reviewedRcTip: string;
    targetPathCount: number;
    evidencePathCount: number;
  };
}

const repositoryRoot = resolve(process.cwd(), "..");
const workflowPath = join(
  repositoryRoot,
  ".github",
  "workflows",
  "deploy-canopyproof-staging.yml",
);
const bindingPath = join(
  process.cwd(),
  "config",
  "canopyproof-staging-release-binding.json",
);
const schemaPath = join(
  process.cwd(),
  "config",
  "canopyproof-staging-resource-manifest.schema.json",
);
const verifierPath = join(
  process.cwd(),
  "scripts",
  "canopyproof-staging-release-verifier.mjs",
);
const adminChecklistPath = join(
  process.cwd(),
  "docs",
  "CANOPYPROOF_STAGING_ADMIN_CHECKLIST.md",
);
const reconciliationPath = join(
  process.cwd(),
  "docs",
  "CANOPYPROOF_CLOUDFLARE_CHECK_RECONCILIATION.md",
);
const controlPlanePath = join(
  process.cwd(),
  "docs",
  "CANOPYPROOF_STAGING_CONTROL_PLANE.md",
);

const hmacKey = Buffer.from(
  "97d5e9b3bc4a279127e1bc5514705fd8a4bd7310f468dc0e94db160275541470",
  "hex",
);

let verifier: VerifierModule;

before(async () => {
  verifier = (await import(verifierPath)) as VerifierModule;
});

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function binding(): Record<string, unknown> {
  return readJson(bindingPath);
}

function dispatch(overrides: Partial<ReleaseDispatch> = {}): ReleaseDispatch {
  const release = binding();
  return {
    deployTargetSha: String(release.deployTargetSha),
    evidenceSha: String(release.evidenceSha),
    releaseManifestSha256: String(release.r2ManifestSha256),
    workflowRef: verifier.EXPECTED_WORKFLOW_REF,
    ...overrides,
  };
}

function unsignedResourceManifest(): Record<string, unknown> {
  const release = binding();
  return {
    schemaVersion: 1,
    ...release,
    apiOrigin: "https://origin.staging.example.net",
    databaseIdentifier: "canopyproof-staging-postgresql",
    objectStorageIdentifier: "canopyproof-staging-evidence",
    objectStoragePrefix: "canopyproof/staging/evidence",
  };
}

function signedResourceManifest(
  mutate?: (manifest: Record<string, unknown>) => void,
): Record<string, unknown> {
  const manifest = unsignedResourceManifest();
  mutate?.(manifest);
  return {
    ...manifest,
    integrity: verifier.calculateResourceManifestIntegrity(manifest, hmacKey),
  };
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("release binding and schema lock the immutable R3A identities", () => {
  const release = verifier.validateReleaseBinding(binding(), dispatch());
  const schema = verifier.validateSchemaContract(readJson(schemaPath), release);

  assert.equal(release.deployTargetSha, verifier.EXPECTED_BINDING.deployTargetSha);
  assert.equal(release.evidenceSha, verifier.EXPECTED_BINDING.evidenceSha);
  assert.equal(release.r2ManifestSha256, verifier.EXPECTED_BINDING.r2ManifestSha256);
  assert.equal(schema.additionalProperties, false);
});

test("resource manifest is deterministic, signed, staging-only, and worker-separated", () => {
  const release = verifier.validateReleaseBinding(binding(), dispatch());
  const first = signedResourceManifest();
  const second = signedResourceManifest();

  assert.equal(verifier.canonicalizeJson(first), verifier.canonicalizeJson(second));
  const verified = verifier.validateResourceManifest(first, release, hmacKey);
  assert.equal(verified.environment, "canopyproof-staging");
  assert.equal(verified.productionDataAllowed, false);
  assert.equal(verified.apiWebWorkersSeparated, true);
  assert.notEqual(verified.webWorker, verified.apiWorker);
});

test("release binding rejects PR head, evidence substitution, tampering, and wrong workflow refs", () => {
  const cases: Array<[string, Partial<ReleaseDispatch>, RegExp]> = [
    [
      "PR head substituted for target",
      { deployTargetSha: "1".repeat(40) },
      /deploy target differs/u,
    ],
    [
      "evidence SHA substituted for target",
      {
        deployTargetSha: String(binding().evidenceSha),
      },
      /deploy target differs|substituted/u,
    ],
    [
      "manifest evidence tampering",
      { evidenceSha: "2".repeat(40) },
      /evidence SHA differs/u,
    ],
    [
      "manifest digest tampering",
      { releaseManifestSha256: "3".repeat(64) },
      /R2 release manifest SHA-256 differs/u,
    ],
    [
      "wrong workflow ref",
      {
        workflowRef:
          "Dropineth/dropin/.github/workflows/deploy-canopyproof-staging.yml@refs/heads/canopyproof/industrial-rc1",
      },
      /workflow ref is not the trusted main-owned/u,
    ],
  ];

  for (const [label, override, expected] of cases) {
    assert.throws(
      () => verifier.validateReleaseBinding(binding(), dispatch(override)),
      expected,
      label,
    );
  }

  const tamperedBinding = binding();
  tamperedBinding.deployTargetSha = "4".repeat(40);
  assert.throws(
    () => verifier.validateReleaseBinding(tamperedBinding, dispatch()),
    /release binding deployTargetSha differs/u,
  );
});

test("resource verifier rejects production identities, absent telemetry, risky flags, and credentials", () => {
  const release = verifier.validateReleaseBinding(binding(), dispatch());
  const cases: Array<[string, (manifest: Record<string, unknown>) => void, RegExp]> = [
    [
      "production Worker identity",
      (manifest) => {
        manifest.webWorker = "canopyproof-web-production";
      },
      /webWorker differs|production identity/u,
    ],
    [
      "same API and Web Worker",
      (manifest) => {
        manifest.apiWorker = manifest.webWorker;
      },
      /apiWorker differs|Workers must remain separate/u,
    ],
    [
      "production origin",
      (manifest) => {
        manifest.apiOrigin = "https://api.canopyproof.org";
      },
      /production origin/u,
    ],
    [
      "localhost origin",
      (manifest) => {
        manifest.apiOrigin = "https://localhost";
      },
      /local or placeholder host/u,
    ],
    [
      "production database",
      (manifest) => {
        manifest.databaseIdentifier = "canopyproof-production-postgresql";
      },
      /production identity/u,
    ],
    [
      "production storage",
      (manifest) => {
        manifest.objectStorageIdentifier = "canopyproof-prod-evidence";
      },
      /production identity/u,
    ],
    [
      "production storage prefix",
      (manifest) => {
        manifest.objectStoragePrefix = "canopyproof/production/evidence";
      },
      /production identity/u,
    ],
    [
      "absent telemetry",
      (manifest) => {
        delete manifest.telemetryEnvironment;
      },
      /telemetryEnvironment differs|telemetry environment/u,
    ],
    [
      "production data enabled",
      (manifest) => {
        manifest.productionDataAllowed = true;
      },
      /productionDataAllowed/u,
    ],
    [
      "high-risk feature enabled",
      (manifest) => {
        const flags = manifest.featureFlags as Record<string, unknown>;
        flags.CANOPY_PRODUCTION_UNLOCK = true;
      },
      /high-risk feature flag CANOPY_PRODUCTION_UNLOCK/u,
    ],
    [
      "credential embedded",
      (manifest) => {
        manifest.databasePassword = "forbidden";
      },
      /unsupported field|credential-like field/u,
    ],
    [
      "secret-bearing query parameter",
      (manifest) => {
        manifest.apiOrigin = "https://origin.staging.example.net?access_key=forbidden";
      },
      /query parameters/u,
    ],
  ];

  for (const [label, mutate, expected] of cases) {
    const manifest = signedResourceManifest(mutate);
    assert.throws(
      () => verifier.validateResourceManifest(manifest, release, hmacKey),
      expected,
      label,
    );
  }
});

test("resource verifier rejects unsigned and hash-mismatched manifests", () => {
  const release = verifier.validateReleaseBinding(binding(), dispatch());
  const unsigned = unsignedResourceManifest();
  assert.throws(
    () => verifier.validateResourceManifest(unsigned, release, hmacKey),
    /integrity/u,
  );

  const hashMismatch = signedResourceManifest();
  const integrity = hashMismatch.integrity as Record<string, unknown>;
  integrity.payloadSha256 = "0".repeat(64);
  assert.throws(
    () => verifier.validateResourceManifest(hashMismatch, release, hmacKey),
    /payload SHA-256 mismatch/u,
  );

  const signatureMismatch = signedResourceManifest();
  const signature = signatureMismatch.integrity as Record<string, unknown>;
  signature.signature = "0".repeat(64);
  assert.throws(
    () => verifier.validateResourceManifest(signatureMismatch, release, hmacKey),
    /HMAC signature mismatch/u,
  );
});

test("evidence report binds the target and preserves non-production status", () => {
  const target = String(binding().deployTargetSha);
  const report = [
    "# CanopyProof R2 Final Release Candidate",
    "",
    "Final state: `NOT_PRODUCTION_READY`",
    "",
    "| Role | Commit |",
    "| --- | --- |",
    `| Final deploy target | \`${target}\` |`,
    "",
    "The following documentation-only commit is not a deployment target.",
  ].join("\n");

  verifier.validateEvidenceReport(report, target);
  assert.throws(
    () => verifier.validateEvidenceReport(report.replace(target, "9".repeat(40)), target),
    /does not bind the immutable deploy target/u,
  );
});

test("staging requires two independent collaborator approvals on the exact evidence SHA", () => {
  const evidenceSha = String(binding().evidenceSha);
  const reviewEvidence = {
    pullRequest: {
      number: 2,
      author: "poccahin",
      baseRef: "main",
      headRef: "canopyproof/industrial-rc1",
      headSha: evidenceSha,
      draft: false,
    },
    reviews: [
      {
        reviewer: "xiruier",
        reviewerType: "User",
        authorAssociation: "COLLABORATOR",
        state: "APPROVED",
        commitId: evidenceSha,
        submittedAt: "2026-07-29T01:00:00.000Z",
      },
      {
        reviewer: "Dropineth",
        reviewerType: "User",
        authorAssociation: "OWNER",
        state: "APPROVED",
        commitId: evidenceSha,
        submittedAt: "2026-07-29T01:01:00.000Z",
      },
    ],
  };

  assert.deepEqual(
    verifier.validatePullRequestReviews(reviewEvidence, evidenceSha),
    ["Dropineth", "xiruier"],
  );

  const staleReview = structuredClone(reviewEvidence);
  (
    (staleReview.reviews as Array<Record<string, unknown>>)[1]
  ).commitId = "0".repeat(40);
  assert.throws(
    () => verifier.validatePullRequestReviews(staleReview, evidenceSha),
    /two independent collaborator approvals/u,
  );

  const authorApproval = structuredClone(reviewEvidence);
  (
    (authorApproval.reviews as Array<Record<string, unknown>>)[1]
  ).reviewer = "poccahin";
  assert.throws(
    () => verifier.validatePullRequestReviews(authorApproval, evidenceSha),
    /two independent collaborator approvals/u,
  );

  const draft = structuredClone(reviewEvidence);
  (draft.pullRequest as Record<string, unknown>).draft = true;
  assert.throws(
    () => verifier.validatePullRequestReviews(draft, evidenceSha),
    /must be ready for independent review/u,
  );
});

test("git binding accepts code target followed by evidence-only tip and rejects evidence targets", () => {
  const directory = mkdtempSync(join(tmpdir(), "canopyproof-staging-binding-"));
  try {
    git(directory, ["init", "-q"]);
    git(directory, ["config", "user.name", "CanopyProof Test"]);
    git(directory, ["config", "user.email", "canopyproof-test@example.invalid"]);

    const productPath = join(directory, "dropin-earth", "src");
    mkdirSync(productPath, { recursive: true });
    writeFileSync(join(productPath, "product.ts"), "export const release = true;\n");
    git(directory, ["add", "dropin-earth/src/product.ts"]);
    git(directory, ["commit", "-q", "-m", "feat: product target"]);
    const target = git(directory, ["rev-parse", "HEAD"]);

    const docsPath = join(directory, "dropin-earth", "docs");
    mkdirSync(docsPath, { recursive: true });
    writeFileSync(join(docsPath, "evidence.md"), "# Evidence\n");
    git(directory, ["add", "dropin-earth/docs/evidence.md"]);
    git(directory, ["commit", "-q", "-m", "docs: evidence"]);
    const evidence = git(directory, ["rev-parse", "HEAD"]);
    const rcRef = "refs/remotes/origin/canopyproof/industrial-rc1";
    git(directory, ["update-ref", rcRef, evidence]);

    const result = verifier.verifyGitBinding({
      repoRoot: directory,
      deployTargetSha: target,
      evidenceSha: evidence,
      reviewedRcRef: rcRef,
    });
    assert.equal(result.reviewedRcTip, evidence);
    assert.equal(result.targetPathCount, 1);
    assert.equal(result.evidencePathCount, 1);

    assert.throws(
      () =>
        verifier.verifyGitBinding({
          repoRoot: directory,
          deployTargetSha: evidence,
          evidenceSha: evidence,
          reviewedRcRef: rcRef,
        }),
      /deploy target is an evidence-only commit/u,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("main-owned workflow preserves exact verification order and never exposes secrets to PR triggers", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  assert.match(workflow, /^name: CanopyProof Protected Staging Deploy$/mu);
  assert.match(workflow, /\n[ ]{2}workflow_dispatch:\n/u);
  assert.doesNotMatch(workflow, /\bpull_request(?:_target)?:/u);
  assert.doesNotMatch(workflow, /\bpush:/u);
  assert.doesNotMatch(workflow, /github\.sha/iu);
  assert.doesNotMatch(workflow, /github\.event\.pull_request/iu);
  assert.match(workflow, /environment: canopyproof-staging/u);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/u);
  assert.match(workflow, /test "\$GITHUB_WORKFLOW_REF" = "\$EXPECTED_WORKFLOW_REF"/u);
  assert.match(workflow, /test "\$\{\{ inputs\.deploy_confirm \}\}" = "canopyproof-staging"/u);

  for (const input of [
    "deploy_target_sha",
    "evidence_sha",
    "release_manifest_sha256",
    "deploy_confirm",
  ]) {
    assert.match(workflow, new RegExp(`\\n      ${input}:`, "u"));
  }

  const orderedSteps = [
    "Checkout trusted governance main",
    "Setup pinned Node.js",
    "Pin npm",
    "Preserve trusted verifier and contracts",
    "Fetch reviewed evidence and immutable target",
    "Fetch exact Product PR review evidence",
    "Verify evidence, release binding, and staging resources",
    "Checkout exact deploy target",
    "Verify checked out target identity",
    "Install locked dependencies",
    "Run deterministic release gate",
    "Build separate staging API Worker",
    "Build separate staging Web Worker",
    "Deploy separate staging API proxy Worker",
    "Deploy separate route-free staging Web Worker",
    "Emit immutable staging deployment attestation",
  ];
  let previousIndex = -1;
  for (const stepName of orderedSteps) {
    const index = workflow.indexOf(`- name: ${stepName}`);
    assert.ok(index > previousIndex, `${stepName} must preserve governance order`);
    previousIndex = index;
  }

  const firstSecret = workflow.indexOf("${{ secrets.");
  const governanceGuard = workflow.indexOf("- name: Assert trusted workflow ref");
  const evidenceFetch = workflow.indexOf("- name: Fetch reviewed evidence");
  const targetCheckout = workflow.indexOf("- name: Checkout exact deploy target");
  assert.ok(governanceGuard >= 0 && governanceGuard < firstSecret);
  assert.ok(evidenceFetch >= 0 && evidenceFetch < targetCheckout);
  assert.doesNotMatch(workflow, /canopyproof\.org\/\*/u);
  assert.doesNotMatch(workflow, /www\.canopyproof\.org\/\*/u);
});

test("workflow consumes only the documented protected staging secret names", () => {
  const workflow = readFileSync(workflowPath, "utf8");
  const names = [
    ...workflow.matchAll(/\$\{\{ secrets\.([A-Z0-9_]+) \}\}/gu),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(names)].sort(),
    [
      "CANOPYPROOF_STAGING_RESOURCE_MANIFEST_HMAC_KEY_B64",
      "CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
    ],
  );
});

test("control-plane documentation requires main, independent review, and admin-only check reconciliation", () => {
  const checklist = readFileSync(adminChecklistPath, "utf8");
  const reconciliation = readFileSync(reconciliationPath, "utf8");
  const controlPlane = readFileSync(controlPlanePath, "utf8");

  assert.match(checklist, /Status: ADMIN_CONFIGURATION_REQUIRED/u);
  assert.match(checklist, /Deployment branch policy \| selected branch `main` only/u);
  assert.match(checklist, /two independent reviewers/u);
  assert.match(checklist, /Prevent self-review \| enabled/u);
  assert.match(checklist, /`poccahin`.*ineligible/u);
  assert.match(checklist, /`CLOUDFLARE_API_TOKEN`/u);
  assert.match(checklist, /`CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON`/u);
  assert.match(
    checklist,
    /`CANOPYPROOF_STAGING_RESOURCE_MANIFEST_HMAC_KEY_B64`/u,
  );
  assert.match(
    checklist,
    /MISCONFIGURED: custom policy currently allows `canopyproof\/industrial-rc1`/u,
  );
  assert.match(
    checklist,
    /Replace the current `canopyproof\/industrial-rc1` deployment branch policy with\s+an exact `main` policy before dispatch/u,
  );

  assert.match(reconciliation, /Workers Builds: canopyproof-web/u);
  assert.match(reconciliation, /Workers Builds: dropin/u);
  assert.match(reconciliation, /`STALE_SUPERSEDED`/u);
  assert.match(reconciliation, /`ORPHANED`/u);
  assert.match(reconciliation, /Do not dismiss a real build failure/u);

  assert.match(controlPlane, /Status: NOT DEPLOYED/u);
  assert.match(controlPlane, /label is informational only/u);
  assert.match(controlPlane, /Product PR #2 remains Draft/u);
  assert.doesNotMatch(controlPlane, /Status: DEPLOYED/u);
});

test("control-plane files contain no private key or credential assignment", () => {
  const files = [
    workflowPath,
    bindingPath,
    schemaPath,
    verifierPath,
    adminChecklistPath,
    reconciliationPath,
    controlPlanePath,
  ];
  for (const path of files) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u);
    assert.doesNotMatch(content, /(?:password|token|secret)\s*[:=]\s*["'][^$<{]/iu);
  }
});
