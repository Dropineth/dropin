import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  AwsKmsManagedSignatureVerifier,
  computeAwsKmsProviderAttestationHash,
  type AwsKmsManagedSignatureVerifierConfiguration,
  type AwsKmsPublicKeyAttestation,
} from "../../services/api/src/domain/canopyproof/aws-kms-managed-signature-verifier.js";
import type {
  CanopyProofDetachedSignatureVerificationRequest,
  CanopyProofManagedKeyAttestationVerificationRequest,
} from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-authority.js";

const NOW = "2026-07-17T08:00:00.000Z";
const ACCOUNT_ID = "123456789012";
const REGION = "ap-southeast-1";
const KEY_ARN = `arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/12345678-1234-4234-8234-1234567890ab`;
const ORGANIZATION_ID = "cp_org_kms_fixture";
const KEY_VERSION = "governance-v1";
const ACCESS_KEY_ID = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
const SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const PUBLIC_KEY_BYTES = Uint8Array.from(
  "synthetic-der-spki-for-deterministic-aws-kms-provider-tests-v1",
  (character) => character.charCodeAt(0),
);
const PUBLIC_KEY = Buffer.from(PUBLIC_KEY_BYTES).toString("base64");
const PUBLIC_KEY_HASH = createHash("sha256").update(PUBLIC_KEY_BYTES).digest("hex");
const GET_PUBLIC_KEY_REQUEST_ID = "11111111-2222-4333-8444-555555555555";
const VERIFY_REQUEST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

type RecordedAwsCall = {
  readonly url: string;
  readonly method: string;
  readonly target: string | null;
  readonly contentType: string | null;
  readonly authorization: string | null;
  readonly body: unknown;
  readonly redirect: RequestRedirect | undefined;
  readonly credentials: RequestCredentials | undefined;
  readonly cache: RequestCache | undefined;
};

test("AWS KMS key attestation is fixed, deterministic, and uses only GetPublicKey", async () => {
  const transport = queuedAwsTransport([
    publicKeyResponse(),
    publicKeyResponse(),
  ]);
  const verifier = createVerifier(transport.fetcher);
  const request = managedKeyRequest();

  const first = await verifier.verifyManagedKeyAttestation(request);
  const second = await verifier.verifyManagedKeyAttestation(request);

  assert.deepEqual(second, first);
  assert.equal(first.verified, true);
  assert.equal(first.externalVerifierId, "canopyproof_aws_kms_verify_v1");
  assert.equal(first.verifiedAt, request.requestedAt);
  assert.match(first.providerReceiptIdHash, /^[a-f0-9]{64}$/);
  assert.match(first.providerReceiptHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(first).includes(GET_PUBLIC_KEY_REQUEST_ID), false);
  assert.deepEqual(
    transport.calls.map((call) => call.target),
    ["TrentService.GetPublicKey", "TrentService.GetPublicKey"],
  );
  for (const call of transport.calls) {
    assert.equal(call.url, `https://kms.${REGION}.amazonaws.com/`);
    assert.equal(call.method, "POST");
    assert.equal(call.contentType, "application/x-amz-json-1.1");
    assert.match(call.authorization ?? "", /^AWS4-HMAC-SHA256 /);
    assert.deepEqual(call.body, { KeyId: KEY_ARN });
    assert.equal(call.redirect, "error");
    assert.equal(call.credentials, "omit");
    assert.equal(call.cache, "no-store");
  }
});

test("AWS KMS detached verification binds digest bytes, signature bytes, key, and algorithm", async () => {
  const transport = queuedAwsTransport([
    publicKeyResponse(),
    verifyResponse(),
    publicKeyResponse(),
    verifyResponse(),
  ]);
  const verifier = createVerifier(transport.fetcher);
  const request = detachedSignatureRequest();

  const first = await verifier.verifyDetachedSignature(request);
  const second = await verifier.verifyDetachedSignature(request);

  assert.deepEqual(second, first);
  assert.equal(first.verifiedAt, NOW);
  assert.deepEqual(
    transport.calls.map((call) => call.target),
    [
      "TrentService.GetPublicKey",
      "TrentService.Verify",
      "TrentService.GetPublicKey",
      "TrentService.Verify",
    ],
  );
  const verifyCall = transport.calls[1];
  assert.ok(verifyCall);
  assert.deepEqual(verifyCall.body, {
    KeyId: KEY_ARN,
    Message: Buffer.from(request.signaturePayloadHash, "hex").toString("base64"),
    MessageType: "DIGEST",
    Signature: Buffer.from(request.detachedSignature, "base64url").toString("base64"),
    SigningAlgorithm: "ECDSA_SHA_256",
  });
  assert.equal(transport.calls.some((call) => call.target === "TrentService.Sign"), false);
});

test("AWS KMS algorithm routing is explicit for ES256, RSA-PSS, and Ed25519", async (context) => {
  const cases = [
    {
      algorithm: "ES256" as const,
      keySpec: "ECC_NIST_P256",
      signingAlgorithm: "ECDSA_SHA_256",
      messageType: "DIGEST",
      signingAlgorithms: ["ECDSA_SHA_256"],
    },
    {
      algorithm: "RSA_PSS_SHA256" as const,
      keySpec: "RSA_3072",
      signingAlgorithm: "RSASSA_PSS_SHA_256",
      messageType: "DIGEST",
      signingAlgorithms: [
        "RSASSA_PSS_SHA_512",
        "RSASSA_PKCS1_V1_5_SHA_256",
        "RSASSA_PSS_SHA_256",
      ],
    },
    {
      algorithm: "Ed25519" as const,
      keySpec: "ECC_NIST_EDWARDS25519",
      signingAlgorithm: "ED25519_SHA_512",
      messageType: "RAW",
      signingAlgorithms: ["ED25519_PH_SHA_512", "ED25519_SHA_512"],
    },
  ] as const;

  for (const entry of cases) {
    await context.test(entry.algorithm, async () => {
      const transport = queuedAwsTransport([
        publicKeyResponse({
          keySpec: entry.keySpec,
          signingAlgorithms: entry.signingAlgorithms,
        }),
        verifyResponse({ signingAlgorithm: entry.signingAlgorithm }),
      ]);
      const verifier = createVerifier(transport.fetcher, { algorithm: entry.algorithm });
      await verifier.verifyDetachedSignature(detachedSignatureRequest({ algorithm: entry.algorithm }));
      const call = transport.calls[1];
      assert.ok(call && call.body && typeof call.body === "object");
      assert.equal((call.body as Record<string, unknown>).SigningAlgorithm, entry.signingAlgorithm);
      assert.equal((call.body as Record<string, unknown>).MessageType, entry.messageType);
    });
  }
});

test("AWS KMS provider attestation hash canonicalizes signing-algorithm order", () => {
  const first = publicKeyAttestation({
    signingAlgorithms: ["ECDSA_SHA_512", "ECDSA_SHA_256", "ECDSA_SHA_384"],
  });
  const second = publicKeyAttestation({
    signingAlgorithms: ["ECDSA_SHA_384", "ECDSA_SHA_512", "ECDSA_SHA_256"],
  });
  assert.equal(
    computeAwsKmsProviderAttestationHash(first),
    computeAwsKmsProviderAttestationHash(second),
  );
});

test("AWS KMS verifier rejects caller binding substitution before network access", async (context) => {
  const substitutions: ReadonlyArray<{
    readonly name: string;
    readonly value: Partial<CanopyProofManagedKeyAttestationVerificationRequest>;
  }> = [
    { name: "organization", value: { organizationId: "cp_org_other" } },
    {
      name: "key ARN",
      value: {
        providerKeyId: `arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`,
      },
    },
    { name: "key version", value: { keyVersion: "governance-v2" } },
    { name: "algorithm", value: { algorithm: "RSA_PSS_SHA256" } },
  ];

  for (const substitution of substitutions) {
    await context.test(substitution.name, async () => {
      const transport = queuedAwsTransport([]);
      const verifier = createVerifier(transport.fetcher);
      await assert.rejects(
        verifier.verifyManagedKeyAttestation(managedKeyRequest(substitution.value)),
        exactError("CANOPYPROOF_AWS_KMS_FIXED_BINDING_MISMATCH"),
      );
      assert.equal(transport.calls.length, 0);
    });
  }
});

test("AWS KMS verifier rejects public-key and provider-attestation substitution", async (context) => {
  await context.test("public key hash", async () => {
    const transport = queuedAwsTransport([publicKeyResponse()]);
    const verifier = createVerifier(transport.fetcher);
    await assert.rejects(
      verifier.verifyManagedKeyAttestation(
        managedKeyRequest({ publicKeyHash: hashJson({ kind: "wrong-public-key" }) }),
      ),
      exactError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_HASH_MISMATCH"),
    );
  });

  await context.test("provider attestation", async () => {
    const transport = queuedAwsTransport([publicKeyResponse()]);
    const verifier = createVerifier(transport.fetcher);
    await assert.rejects(
      verifier.verifyManagedKeyAttestation(
        managedKeyRequest({ providerAttestationHash: hashJson({ kind: "wrong-attestation" }) }),
      ),
      exactError("CANOPYPROOF_AWS_KMS_PROVIDER_ATTESTATION_MISMATCH"),
    );
  });

  await context.test("key usage", async () => {
    const transport = queuedAwsTransport([
      awsJsonResponse({
        KeyId: KEY_ARN,
        KeySpec: "ECC_NIST_P256",
        KeyUsage: "ENCRYPT_DECRYPT",
        PublicKey: PUBLIC_KEY,
        SigningAlgorithms: ["ECDSA_SHA_256"],
      }, GET_PUBLIC_KEY_REQUEST_ID),
    ]);
    const verifier = createVerifier(transport.fetcher);
    await assert.rejects(
      verifier.verifyManagedKeyAttestation(managedKeyRequest()),
      exactError("CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_RESPONSE_INVALID"),
    );
  });

  await context.test("key spec", async () => {
    const transport = queuedAwsTransport([
      publicKeyResponse({ keySpec: "RSA_2048", signingAlgorithms: ["RSASSA_PSS_SHA_256"] }),
    ]);
    const verifier = createVerifier(transport.fetcher);
    await assert.rejects(
      verifier.verifyManagedKeyAttestation(managedKeyRequest()),
      exactError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_BINDING_MISMATCH"),
    );
  });
});

test("AWS KMS verifier rejects negative or cross-bound verification responses", async (context) => {
  await context.test("negative verification", async () => {
    const transport = queuedAwsTransport([
      publicKeyResponse(),
      awsJsonResponse({
        KeyId: KEY_ARN,
        SignatureValid: false,
        SigningAlgorithm: "ECDSA_SHA_256",
      }, VERIFY_REQUEST_ID),
    ]);
    const verifier = createVerifier(transport.fetcher);
    await assert.rejects(
      verifier.verifyDetachedSignature(detachedSignatureRequest()),
      exactError("CANOPYPROOF_AWS_KMS_VERIFY_RESPONSE_INVALID"),
    );
  });

  await context.test("cross-key response", async () => {
    const transport = queuedAwsTransport([
      publicKeyResponse(),
      verifyResponse({
        keyArn: `arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`,
      }),
    ]);
    const verifier = createVerifier(transport.fetcher);
    await assert.rejects(
      verifier.verifyDetachedSignature(detachedSignatureRequest()),
      exactError("CANOPYPROOF_AWS_KMS_VERIFY_BINDING_MISMATCH"),
    );
  });

  await context.test("non-canonical base64url signature", async () => {
    const transport = queuedAwsTransport([]);
    const verifier = createVerifier(transport.fetcher);
    const canonical = Buffer.from([0, 0, 1]).toString("base64url");
    await assert.rejects(
      verifier.verifyDetachedSignature(detachedSignatureRequest({ detachedSignature: `${canonical}A` })),
      exactError("CANOPYPROOF_AWS_KMS_SIGNATURE_ENCODING_INVALID"),
    );
    assert.equal(transport.calls.length, 0);
  });
});

test("AWS KMS transport rejects unsafe response behavior with stable errors", async (context) => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly response: Response;
    readonly code: string;
  }> = [
    {
      name: "non-200",
      response: awsJsonResponse({ __type: "AccessDeniedException", message: "secret detail" }, GET_PUBLIC_KEY_REQUEST_ID, 403),
      code: "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_REJECTED",
    },
    {
      name: "wrong media type",
      response: awsJsonResponse(publicKeyResponseBody(), GET_PUBLIC_KEY_REQUEST_ID, 200, {
        "content-type": "text/html",
      }),
      code: "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_CONTENT_TYPE_INVALID",
    },
    {
      name: "compression",
      response: awsJsonResponse(publicKeyResponseBody(), GET_PUBLIC_KEY_REQUEST_ID, 200, {
        "content-encoding": "gzip",
      }),
      code: "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_CONTENT_ENCODING_FORBIDDEN",
    },
    {
      name: "missing request id",
      response: awsJsonResponse(publicKeyResponseBody(), undefined),
      code: "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_REQUEST_ID_INVALID",
    },
    {
      name: "content length mismatch",
      response: awsJsonResponse(publicKeyResponseBody(), GET_PUBLIC_KEY_REQUEST_ID, 200, {
        "content-length": "1",
      }),
      code: "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_CONTENT_LENGTH_MISMATCH",
    },
  ];

  for (const entry of cases) {
    await context.test(entry.name, async () => {
      const transport = queuedAwsTransport([entry.response]);
      const verifier = createVerifier(transport.fetcher);
      await assert.rejects(
        verifier.verifyManagedKeyAttestation(managedKeyRequest()),
        exactError(entry.code),
      );
    });
  }

  await context.test("streamed overflow", async () => {
    const body = "x".repeat(1_025);
    const response = new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amzn-requestid": GET_PUBLIC_KEY_REQUEST_ID,
      },
    });
    const transport = queuedAwsTransport([response]);
    const verifier = createVerifier(transport.fetcher, { maximumResponseBytes: 1_024 });
    await assert.rejects(
      verifier.verifyManagedKeyAttestation(managedKeyRequest()),
      exactError("CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_RESPONSE_TOO_LARGE"),
    );
  });

  await context.test("timeout", async () => {
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("provider timeout detail")), {
          once: true,
        });
      })) as typeof fetch;
    const verifier = createVerifier(fetcher, { timeoutMilliseconds: 100 });
    await assert.rejects(
      verifier.verifyManagedKeyAttestation(managedKeyRequest()),
      exactError("CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_TIMEOUT"),
    );
  });
});

test("AWS KMS transport does not trust forged error names or expose dependency messages", async () => {
  const providerMarker = "do-not-leak-provider-body-or-credential";
  const fetcher = (async () => {
    const error = new Error(providerMarker);
    error.name = "CanopyProofProviderRuntimeError";
    throw error;
  }) as typeof fetch;
  const verifier = createVerifier(fetcher);

  await assert.rejects(
    verifier.verifyManagedKeyAttestation(managedKeyRequest()),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_REQUEST_FAILED");
      assert.equal(error.message.includes(providerMarker), false);
      assert.equal(error.message.includes(SECRET_ACCESS_KEY), false);
      assert.equal(error.message.includes(KEY_ARN), false);
      return true;
    },
  );
});

test("AWS KMS configuration forbids aliases, cross-scope ARNs, and unsupported partitions", () => {
  const fetcher = queuedAwsTransport([]).fetcher;
  assert.throws(
    () => createVerifier(fetcher, { keyArn: "alias/canopyproof" }),
    exactError("CANOPYPROOF_AWS_KMS_CONFIGURATION_INVALID"),
  );
  assert.throws(
    () =>
      createVerifier(fetcher, {
        keyArn: `arn:aws:kms:us-east-1:${ACCOUNT_ID}:key/12345678-1234-4234-8234-1234567890ab`,
      }),
    exactError("CANOPYPROOF_AWS_KMS_CONFIGURATION_INVALID"),
  );
  assert.throws(
    () => createVerifier(fetcher, { region: "cn-north-1" }),
    exactError("CANOPYPROOF_AWS_KMS_CONFIGURATION_INVALID"),
  );
});

function createVerifier(
  fetcher: typeof fetch,
  overrides: Partial<AwsKmsManagedSignatureVerifierConfiguration> = {},
): AwsKmsManagedSignatureVerifier {
  return new AwsKmsManagedSignatureVerifier({
    accountId: ACCOUNT_ID,
    partition: "aws",
    region: REGION,
    keyArn: KEY_ARN,
    keyVersion: KEY_VERSION,
    organizationId: ORGANIZATION_ID,
    algorithm: "ES256",
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    clock: () => new Date(NOW),
    fetcher,
    ...overrides,
  });
}

function managedKeyRequest(
  overrides: Partial<CanopyProofManagedKeyAttestationVerificationRequest> = {},
): CanopyProofManagedKeyAttestationVerificationRequest {
  return {
    organizationId: ORGANIZATION_ID,
    provider: "aws_kms",
    providerKeyId: KEY_ARN,
    keyVersion: KEY_VERSION,
    algorithm: "ES256",
    purpose: "canopyproof_environmental_proof_record",
    publicKeyHash: PUBLIC_KEY_HASH,
    providerAttestationHash: computeAwsKmsProviderAttestationHash(publicKeyAttestation()),
    activeFrom: "2026-07-17T07:00:00.000Z",
    expiresAt: "2027-07-17T07:00:00.000Z",
    requestedAt: NOW,
    ...overrides,
  };
}

function detachedSignatureRequest(
  overrides: Partial<CanopyProofDetachedSignatureVerificationRequest> = {},
): CanopyProofDetachedSignatureVerificationRequest {
  const algorithm = overrides.algorithm ?? "ES256";
  return {
    organizationId: ORGANIZATION_ID,
    recordId: "cp_environmental_record_fixture",
    recordRoot: hashJson({ kind: "aws-kms-record-root" }),
    bindingId: "cp_environmental_binding_fixture",
    bindingRoot: hashJson({ kind: "aws-kms-binding-root" }),
    provider: "aws_kms",
    providerKeyId: KEY_ARN,
    keyVersion: KEY_VERSION,
    algorithm,
    purpose: "canopyproof_environmental_proof_record",
    publicKeyHash: PUBLIC_KEY_HASH,
    signaturePayloadHash: hashJson({ kind: "aws-kms-signature-payload" }),
    detachedSignature: Buffer.from("deterministic-provider-native-signature-bytes-v1").toString("base64url"),
    signedAt: "2026-07-17T07:59:00.000Z",
    ...overrides,
  };
}

function publicKeyAttestation(
  overrides: Partial<AwsKmsPublicKeyAttestation> = {},
): AwsKmsPublicKeyAttestation {
  return {
    organizationId: ORGANIZATION_ID,
    partition: "aws",
    region: REGION,
    providerKeyId: KEY_ARN,
    keyVersion: KEY_VERSION,
    protocolAlgorithm: "ES256",
    keySpec: "ECC_NIST_P256",
    keyUsage: "SIGN_VERIFY",
    signingAlgorithms: ["ECDSA_SHA_256"],
    publicKeyHash: PUBLIC_KEY_HASH,
    ...overrides,
  };
}

function publicKeyResponse(
  overrides: {
    readonly keyArn?: string;
    readonly keySpec?: "ECC_NIST_P256" | "ECC_NIST_EDWARDS25519" | "RSA_2048" | "RSA_3072" | "RSA_4096";
    readonly signingAlgorithms?: readonly (
      | "ECDSA_SHA_256"
      | "ECDSA_SHA_384"
      | "ECDSA_SHA_512"
      | "ED25519_SHA_512"
      | "ED25519_PH_SHA_512"
      | "RSASSA_PSS_SHA_256"
      | "RSASSA_PSS_SHA_384"
      | "RSASSA_PSS_SHA_512"
      | "RSASSA_PKCS1_V1_5_SHA_256"
      | "RSASSA_PKCS1_V1_5_SHA_384"
      | "RSASSA_PKCS1_V1_5_SHA_512"
    )[];
  } = {},
): Response {
  return awsJsonResponse(publicKeyResponseBody(overrides), GET_PUBLIC_KEY_REQUEST_ID);
}

function publicKeyResponseBody(
  overrides: {
    readonly keyArn?: string;
    readonly keySpec?: string;
    readonly signingAlgorithms?: readonly string[];
  } = {},
) {
  return {
    KeyId: overrides.keyArn ?? KEY_ARN,
    KeySpec: overrides.keySpec ?? "ECC_NIST_P256",
    KeyUsage: "SIGN_VERIFY",
    PublicKey: PUBLIC_KEY,
    SigningAlgorithms: overrides.signingAlgorithms ?? ["ECDSA_SHA_256"],
  };
}

function verifyResponse(
  overrides: {
    readonly keyArn?: string;
    readonly signingAlgorithm?: string;
  } = {},
): Response {
  return awsJsonResponse({
    KeyId: overrides.keyArn ?? KEY_ARN,
    SignatureValid: true,
    SigningAlgorithm: overrides.signingAlgorithm ?? "ECDSA_SHA_256",
  }, VERIFY_REQUEST_ID);
}

function awsJsonResponse(
  body: unknown,
  requestId: string | undefined,
  status = 200,
  headerOverrides: Readonly<Record<string, string>> = {},
): Response {
  const text = JSON.stringify(body);
  const headers = new Headers({
    "content-length": String(Buffer.byteLength(text)),
    "content-type": "application/x-amz-json-1.1",
    ...headerOverrides,
  });
  if (requestId) headers.set("x-amzn-requestid", requestId);
  return new Response(text, { status, headers });
}

function queuedAwsTransport(responses: readonly Response[]) {
  const queue = [...responses];
  const calls: RecordedAwsCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push({
      url: request.url,
      method: request.method,
      target: request.headers.get("x-amz-target"),
      contentType: request.headers.get("content-type"),
      authorization: request.headers.get("authorization"),
      body: await request.clone().json(),
      redirect: init?.redirect,
      credentials: init?.credentials,
      cache: init?.cache,
    });
    const response = queue.shift();
    if (!response) throw new Error("unexpected AWS KMS request");
    return response;
  }) as typeof fetch;
  return { calls, fetcher };
}

function exactError(message: string) {
  return (error: unknown) => error instanceof Error && error.message === message;
}
