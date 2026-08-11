import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type {
  CanopyProofEvidenceMediaObjectFact,
  CanopyProofEvidenceMediaUploadIntentFact,
} from "../../services/api/src/domain/canopyproof/evidence-media-authority.js";
import {
  CanopyProofEvidenceMediaAdapterOrchestrator,
} from "../../services/api/src/domain/canopyproof/evidence-media-adapter-orchestrator.js";
import {
  FixedEndpointMalwareScannerPort,
} from "../../services/api/src/domain/canopyproof/fixed-http-malware-scanner-provider.js";
import {
  DisabledCanopyProofMalwareScannerAdapter,
  PolicyEnforcedCanopyProofMalwareScannerAdapter,
  WebCryptoEd25519ScannerSignatureVerifier,
} from "../../services/api/src/domain/canopyproof/malware-scanner-adapter.js";
import {
  PolicyEnforcedCanopyProofObjectStorageAdapter,
} from "../../services/api/src/domain/canopyproof/object-storage-adapter.js";
import {
  CloudflareR2ObjectStorageProviderPort,
  type CanopyProofR2ObjectMetadata,
} from "../../services/api/src/domain/canopyproof/r2-object-storage-provider.js";
import {
  CloudflareR2BucketLockVerifier,
} from "../../services/api/src/domain/canopyproof/r2-bucket-lock-verifier.js";

const accountId = "a".repeat(32);
const bucketName = "canopyproof-evidence-nonproduction";
const accessKeyId = "A".repeat(20);
const secretAccessKey = "runtime-test-secret-value-not-production";
const contentHash = hashJson({ kind: "canopyproof-provider-runtime-content", id: "media-001" });
const objectKey = `canopyproof/org-001/project-001/evidence-001/${contentHash}`;

function intentStub(): CanopyProofEvidenceMediaUploadIntentFact {
  return {
    id: "cp_media_intent_provider_runtime_001",
    intentRoot: hashJson({ kind: "canopyproof-provider-runtime-intent", id: "intent-001" }),
    objectKey,
    contentHash,
    contentType: "image/jpeg",
    byteLength: 4_096,
    capturedAt: "2026-07-17T09:59:00.000Z",
    expiresAt: "2026-07-17T10:10:00.000Z",
  } as CanopyProofEvidenceMediaUploadIntentFact;
}

function checksumBuffer(value: string) {
  return Uint8Array.from({ length: value.length / 2 }, (_, index) =>
    Number.parseInt(value.slice(index * 2, index * 2 + 2), 16),
  ).buffer;
}

function r2Metadata(overrides: Partial<CanopyProofR2ObjectMetadata> = {}): CanopyProofR2ObjectMetadata {
  return {
    key: objectKey,
    version: "r2-object-version-001",
    size: 4_096,
    etag: "6f5902ac237024bdd0c176cb93063dc4",
    uploaded: new Date("2026-07-17T10:01:00.000Z"),
    httpMetadata: { contentType: "image/jpeg" },
    checksums: { sha256: checksumBuffer(contentHash) },
    ...overrides,
  };
}

test("R2 runtime emits deterministic bounded grants and independently bound object receipts", async () => {
  const intent = intentStub();
  let now = new Date("2026-07-17T10:00:00.000Z");
  const headedKeys: string[] = [];
  const provider = new CloudflareR2ObjectStorageProviderPort({
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    bucket: {
      async head(key) {
        headedKeys.push(key);
        return r2Metadata();
      },
    },
    clock: () => now,
  });
  const adapter = new PolicyEnforcedCanopyProofObjectStorageAdapter(
    {
      provider: "cloudflare_r2",
      providerNamespace: bucketName,
      allowedUploadHosts: [`${bucketName}.${accountId}.r2.cloudflarestorage.com`],
      maximumGrantTtlSeconds: 600,
    },
    provider,
  );

  const firstGrant = await adapter.createUploadGrant(intent, {
    now: now.toISOString(),
    correlationId: "cp_provider_runtime_grant_001",
  });
  const replayedGrant = await adapter.createUploadGrant(intent, {
    now: now.toISOString(),
    correlationId: "cp_provider_runtime_grant_001",
  });
  assert.deepEqual(replayedGrant, firstGrant);
  const grantUrl = new URL(firstGrant.url);
  assert.equal(grantUrl.protocol, "https:");
  assert.equal(grantUrl.hostname, `${bucketName}.${accountId}.r2.cloudflarestorage.com`);
  assert.equal(grantUrl.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(grantUrl.searchParams.get("X-Amz-Expires"), "600");
  assert.match(grantUrl.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-type/);
  assert.match(grantUrl.searchParams.get("X-Amz-SignedHeaders") ?? "", /x-amz-checksum-sha256/);
  assert.equal(JSON.stringify(firstGrant).includes(secretAccessKey), false);

  now = new Date("2026-07-17T10:03:00.000Z");
  const receipt = await adapter.verifyStoredObject(intent, {
    now: now.toISOString(),
    correlationId: "cp_provider_runtime_head_001",
  });
  assert.deepEqual(headedKeys, [objectKey]);
  assert.equal(receipt.contentHash, contentHash);
  assert.equal(receipt.objectVersion, "r2-object-version-001");
  assert.equal(receipt.encryptionMode, "r2_managed");
  assert.equal(receipt.objectLockMode, "none");
  assert.equal(receipt.retentionVerificationState, "modeled_only");
  assert.equal(receipt.providerVerificationRoot.length, 64);
  assert.equal(JSON.stringify(receipt).includes(accessKeyId), false);
});

test("R2 runtime rejects namespace, metadata, checksum, and provider failures without leaking secrets", async () => {
  const intent = intentStub();
  const now = new Date("2026-07-17T10:03:00.000Z");
  const portFor = (head: () => Promise<CanopyProofR2ObjectMetadata | null>) =>
    new CloudflareR2ObjectStorageProviderPort({
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
      bucket: { async head() { return head(); } },
      clock: () => now,
    });
  const headRequest = {
    provider: "cloudflare_r2" as const,
    providerNamespace: bucketName,
    objectKey,
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    correlationId: "cp_provider_runtime_head_failure_001",
  };

  await assert.rejects(
    portFor(async () => r2Metadata({ key: `${objectKey}-substituted` })).headStoredObject(headRequest),
    /CANOPYPROOF_R2_OBJECT_METADATA_INVALID/,
  );
  await assert.rejects(
    portFor(async () => r2Metadata({ checksums: {} })).headStoredObject(headRequest),
    /CANOPYPROOF_R2_SHA256_REQUIRED/,
  );
  await assert.rejects(
    portFor(async () => {
      throw new Error(`provider leaked ${secretAccessKey}`);
    }).headStoredObject(headRequest),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error).message, "CANOPYPROOF_R2_HEAD_FAILED");
      assert.equal((error as Error).message.includes(secretAccessKey), false);
      return true;
    },
  );
  await assert.rejects(
    portFor(async () => r2Metadata()).headStoredObject({
      ...headRequest,
      providerNamespace: "other-evidence-bucket",
    }),
    /CANOPYPROOF_R2_NAMESPACE_MISMATCH/,
  );
});

test("R2 bucket-lock verifier selects the strictest finite rule and binds it into the provider receipt", async () => {
  const intent = intentStub();
  const now = new Date("2026-07-17T10:03:00.000Z");
  const apiToken = "cloudflare-r2-lock-token-nonproduction-001";
  let lockCalls = 0;
  const retentionPolicyVerifier = new CloudflareR2BucketLockVerifier({
    accountId,
    bucketName,
    jurisdiction: "eu",
    apiToken,
    fetcher: async (input, init) => {
      lockCalls += 1;
      assert.equal(
        String(input),
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/lock`,
      );
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "error");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), `Bearer ${apiToken}`);
      assert.equal(headers.get("cf-r2-jurisdiction"), "eu");
      return lockResponse([
        {
          id: "retain-all-one-hour",
          enabled: true,
          prefix: "canopyproof/",
          condition: { type: "Age", maxAgeSeconds: 3_600 },
        },
        {
          id: "retain-project-until-review",
          enabled: true,
          prefix: "canopyproof/org-001/project-001/",
          condition: { type: "Date", date: "2026-07-19T00:00:00Z" },
        },
        {
          id: "unrelated-indefinite",
          enabled: true,
          prefix: "other-project/",
          condition: { type: "Indefinite" },
        },
        {
          id: "disabled-indefinite",
          enabled: false,
          prefix: "canopyproof/",
          condition: { type: "Indefinite" },
        },
      ]);
    },
  });
  const provider = new CloudflareR2ObjectStorageProviderPort({
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    bucket: { async head() { return r2Metadata(); } },
    retentionPolicyVerifier,
    clock: () => now,
  });
  const adapter = new PolicyEnforcedCanopyProofObjectStorageAdapter(
    {
      provider: "cloudflare_r2",
      providerNamespace: bucketName,
      allowedUploadHosts: [`${bucketName}.${accountId}.r2.cloudflarestorage.com`],
    },
    provider,
  );

  const first = await adapter.verifyStoredObject(intent, {
    now: now.toISOString(),
    correlationId: "cp_r2_lock_verify_001",
  });
  const replayed = await adapter.verifyStoredObject(intent, {
    now: now.toISOString(),
    correlationId: "cp_r2_lock_verify_001",
  });
  assert.equal(lockCalls, 2);
  assert.equal(first.objectLockMode, "governance");
  assert.equal(first.retentionVerificationState, "verified");
  assert.equal(first.retainUntil, "2026-07-19T00:00:00.000Z");
  assert.equal(first.retentionPolicyRoot?.length, 64);
  assert.equal(first.retentionPolicyRoot, replayed.retentionPolicyRoot);
  assert.equal(first.providerReceiptHash, replayed.providerReceiptHash);
  assert.equal(JSON.stringify(first).includes(apiToken), false);
  assert.equal(JSON.stringify(retentionPolicyVerifier), "{}");
});

test("R2 bucket-lock verifier fails closed for indefinite, expired, duplicate, and unbranded policy results", async () => {
  const request = lockRequest();
  const verifierFor = (rules: readonly unknown[]) => new CloudflareR2BucketLockVerifier({
    accountId,
    bucketName,
    apiToken: "cloudflare-r2-lock-token-nonproduction-002",
    fetcher: async () => lockResponse(rules),
  });
  await assert.rejects(
    verifierFor([{
      id: "indefinite-all",
      enabled: true,
      prefix: "canopyproof/",
      condition: { type: "Indefinite" },
    }]).verifyRetentionPolicy(request),
    /CANOPYPROOF_R2_LOCK_INDEFINITE_UNSUPPORTED/,
  );
  await assert.rejects(
    verifierFor([{
      id: "expired-date",
      enabled: true,
      prefix: "canopyproof/",
      condition: { type: "Date", date: "2026-07-17T10:02:00.000Z" },
    }]).verifyRetentionPolicy(request),
    /CANOPYPROOF_R2_LOCK_RETENTION_NOT_ENFORCED/,
  );
  await assert.rejects(
    verifierFor([
      {
        id: "duplicate-rule",
        enabled: true,
        prefix: "canopyproof/",
        condition: { type: "Age", maxAgeSeconds: 3_600 },
      },
      {
        id: "duplicate-rule",
        enabled: true,
        prefix: "canopyproof/org-001/",
        condition: { type: "Age", maxAgeSeconds: 7_200 },
      },
    ]).verifyRetentionPolicy(request),
    /CANOPYPROOF_R2_LOCK_RULE_SET_INVALID/,
  );

  const provider = new CloudflareR2ObjectStorageProviderPort({
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    bucket: { async head() { return r2Metadata(); } },
    retentionPolicyVerifier: {
      async verifyRetentionPolicy(input) {
        return {
          ...input,
          objectLockMode: "governance",
          retainUntil: "2026-07-20T00:00:00.000Z",
          retentionPolicyRoot: hashJson({ kind: "forged-unbranded-retention" }),
          retentionVerificationState: "verified",
        } as never;
      },
    },
    clock: () => new Date("2026-07-17T10:03:00.000Z"),
  });
  await assert.rejects(
    provider.headStoredObject({
      provider: "cloudflare_r2",
      providerNamespace: bucketName,
      objectKey,
      intentId: intentStub().id,
      intentRoot: intentStub().intentRoot,
      correlationId: "cp_r2_lock_unbranded_001",
    }),
    /CANOPYPROOF_R2_RETENTION_ATTESTATION_INVALID/,
  );
});

test("R2 bucket-lock API boundary rejects response abuse and strips secret-bearing failures", async () => {
  const request = lockRequest();
  const apiToken = "cloudflare-r2-lock-token-nonproduction-003";
  const verifierWith = (
    fetcher: typeof fetch,
    overrides: Readonly<{ timeoutMilliseconds?: number; maximumResponseBytes?: number }> = {},
  ) => new CloudflareR2BucketLockVerifier({
    accountId,
    bucketName,
    apiToken,
    fetcher,
    ...overrides,
  });
  await assert.rejects(
    verifierWith(async () => new Response("{}", {
      headers: { "content-encoding": "gzip", "content-type": "application/json" },
    })).verifyRetentionPolicy(request),
    /CANOPYPROOF_R2_LOCK_CONTENT_ENCODING_FORBIDDEN/,
  );
  await assert.rejects(
    verifierWith(async () => new Response("{}", {
      headers: { "content-length": "3", "content-type": "application/json" },
    })).verifyRetentionPolicy(request),
    /CANOPYPROOF_R2_LOCK_CONTENT_LENGTH_MISMATCH/,
  );
  const overflow = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
      controller.close();
    },
  });
  await assert.rejects(
    verifierWith(
      async () => new Response(overflow, { headers: { "content-type": "application/json" } }),
      { maximumResponseBytes: 1_024 },
    ).verifyRetentionPolicy(request),
    /CANOPYPROOF_R2_LOCK_RESPONSE_TOO_LARGE/,
  );
  await assert.rejects(
    verifierWith(async () => {
      throw new Error(`provider exposed ${apiToken}`);
    }).verifyRetentionPolicy(request),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error).message, "CANOPYPROOF_R2_LOCK_REQUEST_FAILED");
      assert.equal((error as Error).message.includes(apiToken), false);
      return true;
    },
  );
  await assert.rejects(
    verifierWith(async () => {
      const forged = new Error(`forged runtime error exposed ${apiToken}`);
      forged.name = "CanopyProofProviderRuntimeError";
      throw forged;
    }).verifyRetentionPolicy(request),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error).message, "CANOPYPROOF_R2_LOCK_REQUEST_FAILED");
      assert.equal((error as Error).message.includes(apiToken), false);
      return true;
    },
  );
  const timedOut = verifierWith(
    async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
        once: true,
      });
    }),
    { timeoutMilliseconds: 100 },
  );
  await assert.rejects(timedOut.verifyRetentionPolicy(request), /CANOPYPROOF_R2_LOCK_TIMEOUT/);
});

test("fixed scanner runtime sends only a canonical immutable locator to its configured endpoint", async () => {
  const authorization = "Bearer scanner-service-token-nonproduction";
  let requestBody: unknown;
  const port = new FixedEndpointMalwareScannerPort({
    endpoint: "https://scanner.nonproduction.example/v1/receipts",
    authorizationHeader: authorization,
    fetcher: async (input, init) => {
      assert.equal(String(input), "https://scanner.nonproduction.example/v1/receipts");
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), authorization);
      assert.equal(headers.get("content-type"), "application/json");
      requestBody = JSON.parse(String(init?.body));
      return Response.json({ receipt: "scanner-receipt-001" });
    },
  });
  const request = scannerRequest();
  assert.deepEqual(await port.scanObject(request), { receipt: "scanner-receipt-001" });
  assert.deepEqual(requestBody, {
    protocolVersion: "canopyproof-malware-scan-v1",
    ...request,
  });
  assert.equal(JSON.stringify(requestBody).includes(authorization), false);
  assert.equal(JSON.stringify(requestBody).includes("https://"), false);
});

test("fixed scanner runtime composes with receipt hashing and Ed25519 verification", async () => {
  const object = {
    id: "cp_media_object_runtime_signed_001",
    objectRoot: hashJson({ kind: "canopyproof-runtime-signed-object", id: "object-001" }),
    providerNamespace: bucketName,
    objectKey,
    objectVersion: "r2-object-version-signed-001",
    providerReceiptHash: hashJson({ kind: "canopyproof-runtime-signed-provider-receipt" }),
    storedAt: "2026-07-17T10:01:00.000Z",
  } as CanopyProofEvidenceMediaObjectFact;
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const signerKeyId = "scanner-ed25519-runtime-test";
  const receiptSeed = {
    objectId: object.id,
    objectRoot: object.objectRoot,
    providerReceiptHash: object.providerReceiptHash,
    scannerId: "scanner-nonproduction-runtime",
    scannerName: "Isolated nonproduction scanner",
    scannerVersion: "1.0.0",
    scannerImageDigest: hashJson({ kind: "canopyproof-runtime-scanner-image", version: "1.0.0" }),
    signatureDatabaseVersion: "daily-2026-07-17",
    verdict: "clean" as const,
    findingHashes: [] as readonly string[],
    scannedAt: "2026-07-17T10:04:00.000Z",
    signerKeyId,
    signatureAlgorithm: "ed25519" as const,
  };
  const receiptHash = hashJson({ kind: "canopyproof-malware-scan-receipt-v1", ...receiptSeed });
  const signature = Buffer.from(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      keyPair.privateKey,
      new TextEncoder().encode(receiptHash),
    ),
  ).toString("base64url");
  const transport = new FixedEndpointMalwareScannerPort({
    endpoint: "https://scanner.nonproduction.example/v1/receipts",
    fetcher: async () => Response.json({ ...receiptSeed, receiptHash, signature }),
  });
  const adapter = new PolicyEnforcedCanopyProofMalwareScannerAdapter(
    {
      scannerId: receiptSeed.scannerId,
      scannerPolicyRoot: hashJson({ kind: "canopyproof-runtime-scanner-policy", version: "v1" }),
      allowedSignerKeyIds: [signerKeyId],
    },
    transport,
    new WebCryptoEd25519ScannerSignatureVerifier({ [signerKeyId]: publicKey }),
  );

  const verified = await adapter.scanObject(object, {
    now: "2026-07-17T10:05:00.000Z",
    correlationId: "cp_scanner_runtime_signed_001",
  });
  assert.equal(verified.receiptHash, receiptHash);
  assert.equal(verified.signature, signature);
  assert.equal(verified.verificationRoot.length, 64);
  assert.equal(Object.isFrozen(verified), true);
});

test("fixed scanner runtime rejects unsafe endpoints, compression, overflow, timeout, and secret-bearing failures", async () => {
  for (const endpoint of [
    "http://scanner.example/v1/scan",
    "https://localhost/v1/scan",
    "https://127.0.0.1/v1/scan",
    "https://scanner.internal/v1/scan",
    "https://scanner.example/v1/scan?target=other",
    "https://scanner.example/",
  ]) {
    assert.throws(
      () => new FixedEndpointMalwareScannerPort({ endpoint }),
      /CANOPYPROOF_SCANNER_CONFIGURATION_INVALID/,
    );
  }

  const compressed = scannerPort(async () =>
    new Response("{}", {
      headers: { "content-encoding": "gzip", "content-type": "application/json" },
    }));
  await assert.rejects(compressed.scanObject(scannerRequest()), /CONTENT_ENCODING_FORBIDDEN/);

  const oversizedDeclared = scannerPort(async () =>
    new Response("{}", {
      headers: { "content-length": "2048", "content-type": "application/json" },
    }), { maximumResponseBytes: 1_024 });
  await assert.rejects(oversizedDeclared.scanObject(scannerRequest()), /RESPONSE_TOO_LARGE/);

  const mismatchedLength = scannerPort(async () =>
    new Response("{}", {
      headers: { "content-length": "3", "content-type": "application/json" },
    }));
  await assert.rejects(mismatchedLength.scanObject(scannerRequest()), /CONTENT_LENGTH_MISMATCH/);

  const overflowStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
      controller.close();
    },
  });
  const oversizedStream = scannerPort(async () =>
    new Response(overflowStream, { headers: { "content-type": "application/json" } }),
  { maximumResponseBytes: 1_024 });
  await assert.rejects(oversizedStream.scanObject(scannerRequest()), /RESPONSE_TOO_LARGE/);

  const networkSecret = "scanner-secret-must-not-escape";
  const failed = scannerPort(async () => {
    throw new Error(networkSecret);
  });
  await assert.rejects(failed.scanObject(scannerRequest()), (error: unknown) => {
    assert.equal(error instanceof Error, true);
    assert.equal((error as Error).message, "CANOPYPROOF_SCANNER_REQUEST_FAILED");
    assert.equal((error as Error).message.includes(networkSecret), false);
    return true;
  });

  const forgedFailure = scannerPort(async () => {
    const forged = new Error(`forged runtime error exposed ${networkSecret}`);
    forged.name = "CanopyProofProviderRuntimeError";
    throw forged;
  });
  await assert.rejects(forgedFailure.scanObject(scannerRequest()), (error: unknown) => {
    assert.equal(error instanceof Error, true);
    assert.equal((error as Error).message, "CANOPYPROOF_SCANNER_REQUEST_FAILED");
    assert.equal((error as Error).message.includes(networkSecret), false);
    return true;
  });

  const timedOut = scannerPort(
    async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
      }),
    { timeoutMilliseconds: 100 },
  );
  await assert.rejects(timedOut.scanObject(scannerRequest()), /CANOPYPROOF_SCANNER_TIMEOUT/);
});

test("provider outage cannot cross the orchestrator durable commit boundary", async () => {
  let commits = 0;
  const orchestrator = new CanopyProofEvidenceMediaAdapterOrchestrator(
    {
      async getEvidenceMediaUploadIntent() { return intentStub(); },
      async getEvidenceMediaObject() { throw new Error("not used"); },
      async findEvidenceMediaProviderVerificationForIntent() { return undefined; },
      async findEvidenceMediaScannerVerificationForObject() { return undefined; },
      async commitEvidenceMediaProviderVerification() {
        commits += 1;
        throw new Error("unexpected commit");
      },
      async commitEvidenceMediaScannerVerification() {
        commits += 1;
        throw new Error("unexpected commit");
      },
    },
    {
      provider: "cloudflare_r2",
      async createUploadGrant() { throw new Error("not used"); },
      async verifyStoredObject() { throw new Error("CANOPYPROOF_R2_HEAD_FAILED"); },
    },
    new DisabledCanopyProofMalwareScannerAdapter(),
  );
  await assert.rejects(
    orchestrator.verifyStoredObject({
      organizationId: "org-001",
      agentId: "object-storage-agent-001",
      intentId: intentStub().id,
      idempotencyKey: "provider-runtime-outage-001",
      correlationId: "provider_runtime_outage_001",
      now: "2026-07-17T10:03:00.000Z",
    }),
    /CANOPYPROOF_R2_HEAD_FAILED/,
  );
  assert.equal(commits, 0);
});

function scannerRequest() {
  return {
    objectId: "cp_media_object_runtime_001",
    objectRoot: hashJson({ kind: "canopyproof-runtime-object", id: "object-001" }),
    providerNamespace: bucketName,
    objectKey,
    objectVersion: "r2-object-version-001",
    providerReceiptHash: hashJson({ kind: "canopyproof-runtime-provider-receipt", id: "receipt-001" }),
    correlationId: "cp_scanner_runtime_001",
  };
}

function lockRequest() {
  return {
    providerNamespace: bucketName,
    objectKey,
    objectVersion: "r2-object-version-001",
    uploadedAt: "2026-07-17T10:01:00.000Z",
    verifiedAt: "2026-07-17T10:03:00.000Z",
    correlationId: "cp_r2_lock_request_001",
  };
}

function lockResponse(rules: readonly unknown[]) {
  return Response.json({ success: true, errors: [], messages: [], result: { rules } });
}

function scannerPort(
  fetcher: typeof fetch,
  overrides: Readonly<{ timeoutMilliseconds?: number; maximumResponseBytes?: number }> = {},
) {
  return new FixedEndpointMalwareScannerPort({
    endpoint: "https://scanner.nonproduction.example/v1/receipts",
    fetcher,
    ...overrides,
  });
}
