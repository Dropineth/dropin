import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { Hono } from "hono";
import type {
  CanopyProofMobileEvidenceBindingRequest,
  CanopyProofMobileEvidenceServerBinding,
} from "@dropin/schemas/canopyproof-mobile-evidence";
import {
  CanopyProofMobileEvidenceSyncCoordinator,
  CanopyProofMobileEvidenceSyncTransportError,
  buildMobileEvidenceBatchRequest,
  buildMobileEvidenceBindingRequest,
  type CanopyProofMobileEvidenceSyncTransport,
} from "../../apps/web/src/lib/canopyproof-mobile-evidence-sync.js";
import {
  CanopyProofMobileEvidenceVault,
  CanopyProofMobileEvidenceVaultError,
  type CanopyProofMobileEvidenceVaultEnvelope,
  type CanopyProofMobileEvidenceVaultKeyRecord,
  type CanopyProofMobileEvidenceVaultStorage,
} from "../../apps/web/src/lib/canopyproof-mobile-evidence-vault.js";
import {
  CanopyProofEvidenceCustodyAuthorityService,
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceConsentProjection,
  type CanopyProofEvidenceCustodyActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  CanopyProofEvidenceOfflineSyncAuthorityService,
  type CanopyProofOfflineSyncAuthoritySnapshot,
  type CanopyProofOfflineSyncBatchFact,
  type CanopyProofOfflineSyncItemFact,
} from "../../services/api/src/domain/canopyproof/evidence-offline-community-authority.js";
import {
  CanopyProofMobileEvidenceSyncAuthorityError,
  CanopyProofMobileEvidenceSyncAuthorityService,
  assertCanopyProofMobileEvidenceBindingAuthority,
  mobileEvidenceSyncPayloadHash as serverSyncPayloadHash,
  type CanopyProofMobileEvidenceBindingAuthorityRequirements,
  type CanopyProofMobileEvidenceSyncActor,
  type CanopyProofMobileEvidenceSyncAuthoritySource,
  type CanopyProofMobileEvidenceSyncRepository,
} from "../../services/api/src/domain/canopyproof/mobile-evidence-sync-authority.js";
import type {
  CanopyProofMobileEvidenceSyncAdmissionAuthority,
} from "../../services/api/src/domain/canopyproof/mobile-evidence-sync-admission.js";
import { CanopyProofEvidenceRegistryService } from
  "../../services/api/src/domain/canopyproof/evidence-registry.js";
import type { CanopyProofProjectProfile } from
  "../../services/api/src/domain/canopyproof/project-registry.js";
import {
  canopyProofMobileEvidenceSyncGateStatus,
  createCanopyProofMobileEvidenceSyncRoutes,
} from "../../services/api/src/routes/canopyproof/mobile-evidence-sync.js";
import type { CanopyProofAuthorizationBinding } from
  "../../services/api/src/domain/canopyproof/authorization-binding.js";
import type { CanopyProofAuthenticatedPrincipal } from
  "../../services/api/src/domain/canopyproof/identity-authentication.js";

const organizationId = "cp_mobile_sync_org";
const projectId = "cp_mobile_sync_project";
const actorId = "cp_mobile_sync_actor";
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const fixedNow = new Date("2026-07-17T03:00:00.000Z");
const actor: CanopyProofMobileEvidenceSyncActor = {
  id: actorId,
  role: "community",
  organizationId,
};
const capture = {
  evidenceType: "tree_planting" as const,
  projectId,
  observedAt: "2026-07-17T01:00:00.000Z",
  latitude: 1.2345,
  longitude: 36.789,
  gpsAccuracyMeters: 4.5,
  mediaHash: hashA,
  deviceFingerprintHash: hashB,
  exifHash: hashC,
  notes: "Sensitive household landmark near the restoration plot.",
};

test("mobile sync deterministically binds, reconciles, and acknowledges without transmitting raw notes", async () => {
  const fixture = createAuthorityFixture();
  const { vault } = createVault();
  const queued = await vault.queueCapture(capture);
  let capturedBindingRequest: CanopyProofMobileEvidenceBindingRequest | undefined;
  const transport = authorityTransport(fixture.service, {
    onBindingRequest: (request) => { capturedBindingRequest = request; },
  });
  const coordinator = new CanopyProofMobileEvidenceSyncCoordinator({
    vault,
    transport,
    enabled: true,
    crypto: globalThis.crypto,
    now: () => fixedNow,
  });
  const prerequisites = fixture.prerequisites();

  const acknowledged = await coordinator.syncOne(queued.id, prerequisites);
  assert.equal(acknowledged.state, "acknowledged");
  assert.equal(acknowledged.serverBinding?.clientRecordId, queued.id);
  assert.equal(acknowledged.acknowledgement?.evidenceId, acknowledged.serverBinding?.evidenceId);
  assert.equal(fixture.repository.snapshot.batches.length, 1);
  assert.equal(fixture.repository.snapshot.items.length, 1);
  assert.equal(fixture.repository.snapshot.batches[0]?.batchState, "needs_review");
  assert.equal(fixture.repository.snapshot.batches[0]?.safety.rawPayloadExcluded, true);
  assert.equal(fixture.repository.snapshot.batches[0]?.safety.communityAttestationNonFinal, true);

  assert.ok(capturedBindingRequest);
  assert.equal("notes" in capturedBindingRequest.capture, false);
  assert.equal("clientPayloadHash" in capturedBindingRequest, false);
  assert.equal(typeof capturedBindingRequest.capture.notesHash, "string");
  assert.doesNotMatch(JSON.stringify(capturedBindingRequest), /Sensitive household landmark/);
  assert.equal(capturedBindingRequest.syncPayloadHash, serverSyncPayloadHash(capturedBindingRequest.capture));

  const callsBefore = transport.callCount();
  assert.equal((await coordinator.syncOne(queued.id, prerequisites)).state, "acknowledged");
  assert.equal(transport.callCount(), callsBefore);
});

test("mobile sync identities and requests remain deterministic across retries and recovery", async () => {
  const fixture = createAuthorityFixture();
  const { vault } = createVault();
  const queued = await vault.queueCapture(capture);
  const prerequisites = fixture.prerequisites();
  const firstBindingRequest = await buildMobileEvidenceBindingRequest(globalThis.crypto, queued, prerequisites);
  const secondBindingRequest = await buildMobileEvidenceBindingRequest(globalThis.crypto, queued, prerequisites);
  assert.deepEqual(firstBindingRequest, secondBindingRequest);

  const bindingResult = await fixture.service.bindDraft(firstBindingRequest, actor, queued.idempotencyKey);
  const laterBindingResult = await new CanopyProofMobileEvidenceSyncAuthorityService(
    fixture.source,
    fixture.repository,
    () => new Date("2026-07-17T04:00:00.000Z"),
  ).bindDraft(firstBindingRequest, actor, queued.idempotencyKey);
  assert.deepEqual(laterBindingResult, bindingResult);
  const bound = await vault.bindServerAuthority(queued.id, bindingResult.binding);
  const firstBatchRequest = await buildMobileEvidenceBatchRequest(globalThis.crypto, bound, prerequisites);
  const secondBatchRequest = await buildMobileEvidenceBatchRequest(globalThis.crypto, bound, prerequisites);
  assert.deepEqual(firstBatchRequest, secondBatchRequest);

  const idempotencyKey = `cp_mobile_evidence_batch_command_${firstBatchRequest.clientBatchId.slice(-32)}`;
  const committed = await fixture.service.commitBatch(firstBatchRequest, actor, idempotencyKey);
  const replayed = await fixture.service.commitBatch(firstBatchRequest, actor, idempotencyKey);
  const recovered = await fixture.service.recoverBatch({
    schemaVersion: "canopyproof.mobile-evidence-recovery-request/v1",
    clientBatchId: firstBatchRequest.clientBatchId,
    projectId,
    deviceAttestationId: fixture.device.id,
  }, actor);
  assert.equal(committed.recovered, false);
  assert.equal(replayed.recovered, true);
  assert.equal(recovered.recovered, true);
  assert.deepEqual(replayed.acknowledgements, committed.acknowledgements);
  assert.deepEqual(recovered.acknowledgements, committed.acknowledgements);
  assert.equal(fixture.repository.snapshot.batches.length, 1);

  await assert.rejects(
    fixture.service.commitBatch(
      { ...firstBatchRequest, connectivity: "satellite" },
      actor,
      idempotencyKey,
    ),
    (error) => assertAuthorityError(error, "CANOPYPROOF_MOBILE_SYNC_BATCH_CONFLICT", 409),
  );
});

test("mobile sync fails closed for revoked consent, authority substitution, and binding tampering", async (context) => {
  await context.test("revoked consent", async () => {
    const fixture = createAuthorityFixture();
    fixture.source.beforeAtomicRegistration = () => {
      fixture.source.consentState = "revoked";
    };
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    const request = await buildMobileEvidenceBindingRequest(globalThis.crypto, queued, fixture.prerequisites());
    await assert.rejects(
      fixture.service.bindDraft(request, actor, queued.idempotencyKey),
      (error) => assertAuthorityError(error, "CANOPYPROOF_MOBILE_SYNC_CONSENT_INACTIVE", 403),
    );
    assert.equal(fixture.source.atomicRegistrationAttempts, 1);
    assert.equal(fixture.source.evidence.listEvidence().length, 0);
  });

  await context.test("actor substitution", async () => {
    const fixture = createAuthorityFixture();
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    const request = await buildMobileEvidenceBindingRequest(globalThis.crypto, queued, fixture.prerequisites());
    await assert.rejects(
      fixture.service.bindDraft(request, { ...actor, id: "cp_mobile_sync_intruder" }, queued.idempotencyKey),
      (error) => assertAuthorityError(error, "CANOPYPROOF_MOBILE_SYNC_AUTHORITY_MISMATCH", 403),
    );
  });

  await context.test("recovery actor substitution", async () => {
    const fixture = createAuthorityFixture();
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    const request = await buildMobileEvidenceBindingRequest(globalThis.crypto, queued, fixture.prerequisites());
    const binding = await fixture.service.bindDraft(request, actor, queued.idempotencyKey);
    const bound = await vault.bindServerAuthority(queued.id, binding.binding);
    const batch = await buildMobileEvidenceBatchRequest(globalThis.crypto, bound, fixture.prerequisites());
    await fixture.service.commitBatch(
      batch,
      actor,
      `cp_mobile_evidence_batch_command_${batch.clientBatchId.slice(-32)}`,
    );

    await assert.rejects(
      fixture.service.recoverBatch({
        schemaVersion: "canopyproof.mobile-evidence-recovery-request/v1",
        clientBatchId: batch.clientBatchId,
        projectId,
        deviceAttestationId: fixture.device.id,
      }, { ...actor, id: "cp_mobile_sync_intruder" }),
      (error) => assertAuthorityError(error, "CANOPYPROOF_MOBILE_SYNC_AUTHORITY_MISMATCH", 403),
    );
  });

  await context.test("binding substitution", async () => {
    const fixture = createAuthorityFixture();
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    const request = await buildMobileEvidenceBindingRequest(globalThis.crypto, queued, fixture.prerequisites());
    const result = await fixture.service.bindDraft(request, actor, queued.idempotencyKey);
    const tampered = {
      ...result.binding,
      evidenceRoot: "f".repeat(64),
    } satisfies CanopyProofMobileEvidenceServerBinding;
    const batch = {
      ...(await buildMobileEvidenceBatchRequest(
        globalThis.crypto,
        await vault.bindServerAuthority(queued.id, result.binding),
        fixture.prerequisites(),
      )),
      bindings: [tampered],
    };
    await assert.rejects(
      fixture.service.commitBatch(batch, actor, "cp_mobile_sync_tamper_idempotency_001"),
      (error) => assertAuthorityError(error, "CANOPYPROOF_MOBILE_SYNC_BINDING_MISMATCH", 422),
    );
    assert.equal(fixture.repository.snapshot.batches.length, 0);
  });
});

test("client coordinator is default closed and handles outage or substituted acknowledgement fail-closed", async (context) => {
  await context.test("default closed", async () => {
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    let calls = 0;
    const transport = inertTransport(() => { calls += 1; });
    const coordinator = new CanopyProofMobileEvidenceSyncCoordinator({ vault, transport });
    await assert.rejects(
      coordinator.syncOne(queued.id, {
        consentReceiptId: "consent",
        deviceAttestationId: "device",
        connectivity: "offline",
      }),
      /CANOPYPROOF_MOBILE_SYNC_DISABLED/,
    );
    assert.equal(calls, 0);
    assert.equal((await vault.getDraft(queued.id)).state, "draft_queued");
  });

  await context.test("retryable outage", async () => {
    const fixture = createAuthorityFixture();
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    const base = authorityTransport(fixture.service);
    const transport: CanopyProofMobileEvidenceSyncTransport = {
      bindDraft: base.bindDraft,
      recoverBatch: base.recoverBatch,
      commitBatch: async () => {
        throw new CanopyProofMobileEvidenceSyncTransportError(
          "CANOPYPROOF_MOBILE_SYNC_TRANSPORT_UNAVAILABLE",
          true,
        );
      },
    };
    const coordinator = new CanopyProofMobileEvidenceSyncCoordinator({
      vault,
      transport,
      enabled: true,
      now: () => fixedNow,
    });
    const retry = await coordinator.syncOne(queued.id, fixture.prerequisites());
    assert.equal(retry.state, "ready_to_sync");
    assert.equal(retry.lastErrorCode, "CANOPYPROOF_MOBILE_SYNC_TRANSPORT_UNAVAILABLE");
    assert.equal(retry.nextAttemptAt, "2026-07-17T03:00:30.000Z");
    assert.equal(fixture.repository.snapshot.batches.length, 0);
  });

  await context.test("substituted acknowledgement", async () => {
    const fixture = createAuthorityFixture();
    const { vault } = createVault();
    const queued = await vault.queueCapture(capture);
    const base = authorityTransport(fixture.service);
    const transport: CanopyProofMobileEvidenceSyncTransport = {
      bindDraft: base.bindDraft,
      recoverBatch: base.recoverBatch,
      commitBatch: async (request, key) => {
        const result = await base.commitBatch(request, key);
        return {
          ...result,
          acknowledgements: result.acknowledgements.map((item) => ({
            ...item,
            evidenceId: "cp_evidence_substituted",
          })),
        };
      },
    };
    const coordinator = new CanopyProofMobileEvidenceSyncCoordinator({
      vault,
      transport,
      enabled: true,
      now: () => fixedNow,
    });
    const rejected = await coordinator.syncOne(queued.id, fixture.prerequisites());
    assert.equal(rejected.state, "rejected");
    assert.equal(rejected.lastErrorCode, "CANOPYPROOF_MOBILE_SYNC_ACKNOWLEDGEMENT_MISMATCH");
  });
});

test("mobile sync activation requires durable repository, Access, feature flag, and governance unlock", () => {
  assert.deepEqual(canopyProofMobileEvidenceSyncGateStatus({}), {
    enabled: false,
    repositoryConfigured: false,
    accessAuthenticationConfigured: false,
    featureFlagEnabled: false,
    governanceUnlockEnabled: false,
    admissionFeatureFlagEnabled: false,
  });
  assert.equal(canopyProofMobileEvidenceSyncGateStatus({
    DROPIN_REPOSITORY: "prisma",
    DATABASE_URL: "postgresql://configured",
    DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
    CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED: "true",
    CANOPY_PRODUCTION_UNLOCK: "false",
  }).enabled, false);
  assert.equal(canopyProofMobileEvidenceSyncGateStatus({
    DROPIN_REPOSITORY: "prisma",
    DATABASE_URL: "postgresql://configured",
    DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
    CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED: "true",
    CANOPY_PRODUCTION_UNLOCK: "true",
    CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED: "true",
  }).enabled, true);
});

test("mobile sync HTTP commands remain closed before governance activation", async () => {
  type RouteEnvironment = {
    Variables: {
      canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
      canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
    };
  };
  const fixture = createAuthorityFixture();
  let serviceResolutions = 0;
  const app = new Hono<RouteEnvironment>();
  const principal: CanopyProofAuthenticatedPrincipal = {
    actorId,
    role: "community",
    organizationId,
    issuer: "https://canopyproof.cloudflareaccess.com",
    audience: ["canopyproof-api"],
    authenticatedAt: fixedNow.toISOString(),
    authenticationMethod: "cloudflare_access_jwt",
  };
  const binding: CanopyProofAuthorizationBinding = {
    actorId,
    participantType: "human",
    role: "community",
    participantVerificationStatus: "verified",
    organizationId,
    organizationVerificationStatus: "verified",
    organizationAccreditationStatus: "approved",
    membershipId: "cp_mobile_sync_membership",
    evaluatedAt: fixedNow.toISOString(),
    decisionHash: hashJson({ kind: "mobile-sync-route-binding" }),
    source: "postgres",
  };
  app.use("*", async (context, next) => {
    context.set("canopyProofPrincipal", principal);
    context.set("canopyProofAuthorizationBinding", binding);
    await next();
  });
  app.route("/canopyproof/evidence/mobile-sync", createCanopyProofMobileEvidenceSyncRoutes({
    environment: {
      DROPIN_REPOSITORY: "prisma",
      DATABASE_URL: "postgresql://configured",
      DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
      CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED: "false",
      CANOPY_PRODUCTION_UNLOCK: "false",
    },
    resolveService: () => {
      serviceResolutions += 1;
      return fixture.service;
    },
    resolveAdmissionAuthority: () => undefined,
  }));

  const status = await app.request("/canopyproof/evidence/mobile-sync/status");
  assert.equal(status.status, 200);
  const statusBody = await status.json() as { data: { routeWritePathBlocked: boolean } };
  assert.equal(statusBody.data.routeWritePathBlocked, true);

  const blocked = await app.request("/canopyproof/evidence/mobile-sync/bindings", {
    method: "POST",
    headers: { "idempotency-key": "cp_mobile_sync_route_idempotency_001" },
  });
  assert.equal(blocked.status, 503);
  assert.deepEqual(await blocked.json(), { ok: false, error: "CANOPYPROOF_MOBILE_SYNC_DISABLED" });
  assert.equal(serviceResolutions, 0);
});

test("mobile sync HTTP commands reject development identities before durable service resolution", async () => {
  type RouteEnvironment = {
    Variables: {
      canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
      canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
    };
  };
  let serviceResolutions = 0;
  const app = new Hono<RouteEnvironment>();
  app.use("*", async (context, next) => {
    context.set("canopyProofPrincipal", {
      actorId,
      role: "community",
      organizationId,
      issuer: "canopyproof-development",
      audience: ["canopyproof-api"],
      authenticatedAt: fixedNow.toISOString(),
      authenticationMethod: "development_headers",
    });
    context.set("canopyProofAuthorizationBinding", {
      actorId,
      participantType: "human",
      role: "community",
      participantVerificationStatus: "verified",
      organizationId,
      organizationVerificationStatus: "verified",
      organizationAccreditationStatus: "approved",
      membershipId: "cp_mobile_sync_membership",
      evaluatedAt: fixedNow.toISOString(),
      decisionHash: hashJson({ kind: "mobile-sync-route-development-binding" }),
      source: "memory",
    });
    await next();
  });
  app.route("/canopyproof/evidence/mobile-sync", createCanopyProofMobileEvidenceSyncRoutes({
    environment: {
      DROPIN_REPOSITORY: "prisma",
      DATABASE_URL: "postgresql://configured",
      DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
      CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED: "true",
      CANOPY_PRODUCTION_UNLOCK: "true",
      CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED: "true",
    },
    resolveService: () => {
      serviceResolutions += 1;
      return createAuthorityFixture().service;
    },
    resolveAdmissionAuthority: () => allowAdmissionAuthority(),
  }));

  const response = await app.request("/canopyproof/evidence/mobile-sync/bindings", {
    method: "POST",
    headers: { "idempotency-key": "cp_mobile_sync_route_idempotency_002" },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: "CANOPYPROOF_MOBILE_SYNC_RBAC_DENIED" });
  assert.equal(serviceResolutions, 0);
});

test("mobile sync HTTP adapter returns only durable binding, batch, and recovery roots when explicitly gated", async () => {
  type RouteEnvironment = {
    Variables: {
      canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
      canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
    };
  };
  const fixture = createAuthorityFixture();
  const { vault } = createVault();
  const queued = await vault.queueCapture(capture);
  const bindingRequest = await buildMobileEvidenceBindingRequest(
    globalThis.crypto,
    queued,
    fixture.prerequisites(),
  );
  const app = new Hono<RouteEnvironment>();
  app.use("*", async (context, next) => {
    context.set("canopyProofPrincipal", {
      actorId,
      role: "community",
      organizationId,
      issuer: "https://canopyproof.cloudflareaccess.com",
      audience: ["canopyproof-api"],
      authenticatedAt: fixedNow.toISOString(),
      authenticationMethod: "cloudflare_access_jwt",
    });
    context.set("canopyProofAuthorizationBinding", {
      actorId,
      participantType: "human",
      role: "community",
      participantVerificationStatus: "verified",
      organizationId,
      organizationVerificationStatus: "verified",
      organizationAccreditationStatus: "approved",
      membershipId: "cp_mobile_sync_membership",
      evaluatedAt: fixedNow.toISOString(),
      decisionHash: hashJson({ kind: "mobile-sync-route-enabled-binding" }),
      source: "postgres",
    });
    await next();
  });
  app.route("/canopyproof/evidence/mobile-sync", createCanopyProofMobileEvidenceSyncRoutes({
    environment: {
      DROPIN_REPOSITORY: "prisma",
      DATABASE_URL: "postgresql://configured",
      DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
      CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED: "true",
      CANOPY_PRODUCTION_UNLOCK: "true",
      CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED: "true",
    },
    resolveService: () => fixture.service,
    resolveAdmissionAuthority: () => allowAdmissionAuthority(),
    now: () => fixedNow,
  }));

  const bindingResponse = await app.request("/canopyproof/evidence/mobile-sync/bindings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": queued.idempotencyKey,
    },
    body: JSON.stringify(bindingRequest),
  });
  assert.equal(bindingResponse.status, 201);
  const bindingBody = await bindingResponse.json() as {
    data: Awaited<ReturnType<CanopyProofMobileEvidenceSyncAuthorityService["bindDraft"]>>;
  };
  assert.equal(bindingBody.data.rawNotesRetained, false);
  assert.equal(bindingBody.data.finalVerification, false);
  assert.equal("notes" in bindingBody.data.binding, false);

  const bound = await vault.bindServerAuthority(queued.id, bindingBody.data.binding);
  const batchRequest = await buildMobileEvidenceBatchRequest(globalThis.crypto, bound, fixture.prerequisites());
  const batchResponse = await app.request("/canopyproof/evidence/mobile-sync/batches", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `cp_mobile_evidence_batch_command_${batchRequest.clientBatchId.slice(-32)}`,
    },
    body: JSON.stringify(batchRequest),
  });
  assert.equal(batchResponse.status, 202);
  const batchBody = await batchResponse.json() as { data: { acknowledgements: unknown[]; recovered: boolean } };
  assert.equal(batchBody.data.acknowledgements.length, 1);
  assert.equal(batchBody.data.recovered, false);

  const recoveryResponse = await app.request("/canopyproof/evidence/mobile-sync/recoveries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: "canopyproof.mobile-evidence-recovery-request/v1",
      clientBatchId: batchRequest.clientBatchId,
      projectId,
      deviceAttestationId: fixture.device.id,
    }),
  });
  assert.equal(recoveryResponse.status, 200);
  const recoveryBody = await recoveryResponse.json() as { data: { recovered: boolean } };
  assert.equal(recoveryBody.data.recovered, true);
});

test("mobile sync admission rejects before request parsing or evidence command execution", async () => {
  type RouteEnvironment = {
    Variables: {
      canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
      canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
    };
  };
  const fixture = createAuthorityFixture();
  const abuseEventRoot = hashJson({ kind: "mobile-sync-admission-denial-test" });
  const app = new Hono<RouteEnvironment>();
  app.use("*", async (context, next) => {
    context.set("canopyProofPrincipal", {
      actorId,
      role: "community",
      organizationId,
      issuer: "https://canopyproof.cloudflareaccess.com",
      audience: ["canopyproof-api"],
      authenticatedAt: fixedNow.toISOString(),
      authenticationMethod: "cloudflare_access_jwt",
    });
    context.set("canopyProofAuthorizationBinding", {
      actorId,
      participantType: "human",
      role: "community",
      participantVerificationStatus: "verified",
      organizationId,
      organizationVerificationStatus: "verified",
      organizationAccreditationStatus: "approved",
      membershipId: "cp_mobile_sync_membership",
      evaluatedAt: fixedNow.toISOString(),
      decisionHash: hashJson({ kind: "mobile-sync-admission-route-binding" }),
      source: "postgres",
    });
    await next();
  });
  app.route("/canopyproof/evidence/mobile-sync", createCanopyProofMobileEvidenceSyncRoutes({
    environment: enabledMobileSyncEnvironment(),
    resolveService: () => fixture.service,
    resolveAdmissionAuthority: () => ({
      async consume(input) {
        assert.equal(input.actorId, actorId);
        assert.equal(input.organizationId, organizationId);
        assert.equal(input.command, "binding");
        return {
          allowed: false,
          policyVersion: "canopyproof.mobile-sync-admission/v1",
          command: "binding",
          limit: 30,
          remaining: 0,
          resetAt: "2026-07-17T03:01:00.000Z",
          abuseEventRoot,
        };
      },
    }),
    now: () => fixedNow,
  }));

  const response = await app.request("/canopyproof/evidence/mobile-sync/bindings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "cp_mobile_sync_admission_denial_001",
    },
    body: "{not-valid-json",
  });
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { ok: false, error: "CANOPYPROOF_MOBILE_SYNC_RATE_LIMITED" });
  assert.equal(response.headers.get("ratelimit-limit"), "30");
  assert.equal(response.headers.get("ratelimit-remaining"), "0");
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("canopyproof-abuse-event-root"), abuseEventRoot);
  assert.equal(fixture.source.atomicRegistrationAttempts, 0);
});

test("mobile sync fails closed on substituted admission policy or window metadata", async () => {
  const fixture = createAuthorityFixture();
  const decisions = [
    {
      allowed: true,
      policyVersion: "canopyproof.mobile-sync-admission/v1",
      command: "binding",
      limit: 31,
      remaining: 30,
      resetAt: "2026-07-17T03:01:00.000Z",
    },
    {
      allowed: true,
      policyVersion: "canopyproof.mobile-sync-admission/v1",
      command: "binding",
      limit: 30,
      remaining: 29,
      resetAt: "2026-07-17T03:00:59.000Z",
    },
  ] as const;

  for (const [index, decision] of decisions.entries()) {
    const app = new Hono<{
      Variables: {
        canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
        canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
      };
    }>();
    app.use("*", async (context, next) => {
      context.set("canopyProofPrincipal", {
        actorId,
        role: "community",
        organizationId,
        issuer: "https://canopyproof.cloudflareaccess.com",
        audience: ["canopyproof-api"],
        authenticatedAt: fixedNow.toISOString(),
        authenticationMethod: "cloudflare_access_jwt",
      });
      context.set("canopyProofAuthorizationBinding", {
        actorId,
        participantType: "human",
        role: "community",
        participantVerificationStatus: "verified",
        organizationId,
        organizationVerificationStatus: "verified",
        organizationAccreditationStatus: "approved",
        membershipId: "cp_mobile_sync_membership",
        evaluatedAt: fixedNow.toISOString(),
        decisionHash: hashJson({ kind: "mobile-sync-substituted-admission-binding", index }),
        source: "postgres",
      });
      await next();
    });
    app.route("/canopyproof/evidence/mobile-sync", createCanopyProofMobileEvidenceSyncRoutes({
      environment: enabledMobileSyncEnvironment(),
      resolveService: () => fixture.service,
      resolveAdmissionAuthority: () => ({ async consume() { return decision; } }),
      now: () => fixedNow,
    }));

    const response = await app.request("/canopyproof/evidence/mobile-sync/bindings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `cp_mobile_sync_substituted_admission_${index}`,
      },
      body: "{not-valid-json",
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE",
    });
  }
  assert.equal(fixture.source.atomicRegistrationAttempts, 0);
});

test("mobile sync body limits reject oversized chunked payloads before authority resolution", async () => {
  let serviceResolutions = 0;
  let admissionResolutions = 0;
  const app = new Hono();
  app.route("/canopyproof/evidence/mobile-sync", createCanopyProofMobileEvidenceSyncRoutes({
    environment: enabledMobileSyncEnvironment(),
    resolveService: () => {
      serviceResolutions += 1;
      return createAuthorityFixture().service;
    },
    resolveAdmissionAuthority: () => {
      admissionResolutions += 1;
      return allowAdmissionAuthority();
    },
  }));
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(16 * 1024));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  const request = new Request("http://localhost/canopyproof/evidence/mobile-sync/bindings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "transfer-encoding": "chunked",
    },
    body: oversized,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const response = await app.fetch(request);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: "CANOPYPROOF_MOBILE_SYNC_BODY_TOO_LARGE" });
  assert.equal(serviceResolutions, 0);
  assert.equal(admissionResolutions, 0);
});

class FakeAuthoritySource implements CanopyProofMobileEvidenceSyncAuthoritySource {
  readonly actorAuthority = actorSnapshot();
  readonly custody = new CanopyProofEvidenceCustodyAuthorityService();
  readonly evidence = new CanopyProofEvidenceRegistryService();
  readonly consent = this.custody.recordConsentReceipt({
    subjectId: actorId,
    deviceFingerprintHash: hashB,
    purposes: ["evidence_collection", "geolocation", "media_upload"],
    lawfulBasis: "consent",
    privacyMode: "restricted",
    policyVersion: "mobile-sync-test-v1",
    evidenceHash: hashJson({ kind: "mobile-sync-consent-evidence" }),
    grantedAt: "2026-07-16T00:00:00.000Z",
    expiresAt: "2027-07-16T00:00:00.000Z",
    retentionDays: 365,
  }, this.actorAuthority);
  readonly device = this.custody.recordDeviceAttestation({
    subjectId: actorId,
    consentReceiptId: this.consent.id,
    deviceFingerprintHash: hashB,
    attestationType: "manual_field_kit",
    provider: "manual_field_kit_registry",
    providerKeyId: "mobile-sync-test-provider-key",
    providerReceiptHash: hashJson({ kind: "mobile-sync-provider-receipt" }),
    providerVerificationState: "modeled_only",
    publicKeyHash: hashJson({ kind: "mobile-sync-public-key" }),
    attestationHash: hashJson({ kind: "mobile-sync-device-attestation" }),
    issuedAt: "2026-07-16T00:10:00.000Z",
    expiresAt: "2027-07-16T00:10:00.000Z",
    reputationScore: 75,
    riskFlags: [],
  }, this.actorAuthority);
  consentState: CanopyProofEvidenceConsentProjection["state"] = "active";
  atomicRegistrationAttempts = 0;
  beforeAtomicRegistration: (() => void) | undefined;

  async getEvidenceCustodyActorSnapshot() { return this.actorAuthority; }
  async getProject() { return projectProfile(); }
  async registerMobileEvidenceWithAuthority(
    input: unknown,
    requirements: CanopyProofMobileEvidenceBindingAuthorityRequirements,
  ) {
    this.atomicRegistrationAttempts += 1;
    this.beforeAtomicRegistration?.();
    const consentProjection = await this.getEvidenceConsentProjection(
      requirements.consentReceiptId,
      requirements.actor.organizationId,
      requirements.evaluatedAt,
    );
    const deviceProjection = await this.getEvidenceEffectiveDeviceAttestationProjection(
      requirements.deviceAttestationId,
      requirements.actor.organizationId,
      requirements.evaluatedAt,
    );
    assertCanopyProofMobileEvidenceBindingAuthority({
      actor: this.actorAuthority,
      project: projectProfile(),
      consent: this.consent,
      consentProjection,
      device: this.device,
      deviceProjection,
    }, requirements);
    return {
      registration: this.evidence.registerEvidence(
        input,
        projectBoundary(),
        requirements.actor.id,
        requirements.actor.role,
      ),
      consent: this.consent,
      device: this.device,
    };
  }
  async getEvidence(evidenceId: string) { return this.evidence.getEvidence(evidenceId); }
  async getEvidenceConsentReceipt() { return this.consent; }
  async getEvidenceConsentProjection(_receiptId: string, _organizationId: string, evaluatedAt: string) {
    const projection = this.custody.projectConsentReceipt(this.consent.id, evaluatedAt);
    return this.consentState === "active" ? projection : { ...projection, state: this.consentState };
  }
  async getEvidenceDeviceAttestation() { return this.device; }
  async getEvidenceEffectiveDeviceAttestationProjection(
    _id: string,
    _organizationId: string,
    evaluatedAt: string,
  ) {
    return this.custody.projectDeviceAttestation(this.device.id, evaluatedAt);
  }
}

class FakeOfflineRepository implements CanopyProofMobileEvidenceSyncRepository {
  snapshot: CanopyProofOfflineSyncAuthoritySnapshot = { streamEvents: [], batches: [], items: [] };
  private readonly receipts = new Map<string, string>();

  async loadOfflineAuthoritySnapshot() {
    return {
      streamEvents: [...this.snapshot.streamEvents],
      batches: [...this.snapshot.batches],
      items: [...this.snapshot.items],
    };
  }

  async commitOfflineBundle(
    batch: CanopyProofOfflineSyncBatchFact,
    items: readonly CanopyProofOfflineSyncItemFact[],
    idempotencyKey: string,
  ) {
    const requestHash = hashJson({ batch, items });
    const receipt = this.receipts.get(idempotencyKey);
    if (receipt && receipt !== requestHash) throw new Error("CANOPYPROOF_E4_OFFLINE_IDEMPOTENCY_CONFLICT");
    const existing = this.snapshot.batches.find((candidate) => candidate.id === batch.id);
    if (existing) {
      if (!receipt) throw new Error("CANOPYPROOF_E4_OFFLINE_FACT_CONFLICT");
      return {
        batch: existing,
        items: this.snapshot.items.filter((item) => item.batchId === existing.id),
      };
    }
    CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot({
      streamEvents: [...this.snapshot.streamEvents, batch.auditEvent],
      batches: [...this.snapshot.batches, batch],
      items: [...this.snapshot.items, ...items],
    });
    this.receipts.set(idempotencyKey, requestHash);
    this.snapshot = {
      streamEvents: [...this.snapshot.streamEvents, batch.auditEvent],
      batches: [...this.snapshot.batches, batch],
      items: [...this.snapshot.items, ...items],
    };
    return { batch, items };
  }
}

function createAuthorityFixture() {
  const source = new FakeAuthoritySource();
  const repository = new FakeOfflineRepository();
  return {
    source,
    repository,
    device: source.device,
    service: new CanopyProofMobileEvidenceSyncAuthorityService(source, repository, () => fixedNow),
    prerequisites: () => ({
      consentReceiptId: source.consent.id,
      deviceAttestationId: source.device.id,
      connectivity: "offline" as const,
    }),
  };
}

function authorityTransport(
  service: CanopyProofMobileEvidenceSyncAuthorityService,
  hooks: Readonly<{ onBindingRequest?: (request: CanopyProofMobileEvidenceBindingRequest) => void }> = {},
) {
  let calls = 0;
  const transport: CanopyProofMobileEvidenceSyncTransport & { callCount(): number } = {
    async bindDraft(request, idempotencyKey) {
      calls += 1;
      hooks.onBindingRequest?.(request);
      return service.bindDraft(request, actor, idempotencyKey);
    },
    async commitBatch(request, idempotencyKey) {
      calls += 1;
      return service.commitBatch(request, actor, idempotencyKey);
    },
    async recoverBatch(request) {
      calls += 1;
      return service.recoverBatch(request, actor);
    },
    callCount: () => calls,
  };
  return transport;
}

function inertTransport(onCall: () => void): CanopyProofMobileEvidenceSyncTransport {
  return {
    async bindDraft() { onCall(); throw new Error("unexpected"); },
    async commitBatch() { onCall(); throw new Error("unexpected"); },
    async recoverBatch() { onCall(); throw new Error("unexpected"); },
  };
}

function allowAdmissionAuthority(): CanopyProofMobileEvidenceSyncAdmissionAuthority {
  return {
    async consume(input) {
      const evaluatedAt = Date.parse(input.evaluatedAt);
      const resetAt = new Date(Math.floor(evaluatedAt / 60_000) * 60_000 + 60_000).toISOString();
      return {
        allowed: true,
        policyVersion: "canopyproof.mobile-sync-admission/v1",
        command: input.command,
        limit: input.command === "batch" ? 12 : 30,
        remaining: input.command === "batch" ? 11 : 29,
        resetAt,
      };
    },
  };
}

function enabledMobileSyncEnvironment() {
  return {
    DROPIN_REPOSITORY: "prisma",
    DATABASE_URL: "postgresql://configured",
    DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
    CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED: "true",
    CANOPY_PRODUCTION_UNLOCK: "true",
    CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED: "true",
  } as const;
}

class MemoryVaultStorage implements CanopyProofMobileEvidenceVaultStorage {
  key: CanopyProofMobileEvidenceVaultKeyRecord | undefined;
  readonly envelopes = new Map<string, CanopyProofMobileEvidenceVaultEnvelope>();
  async getOrCreateKey(candidate: CanopyProofMobileEvidenceVaultKeyRecord) { return (this.key ??= candidate); }
  async getKey() { return this.key; }
  async listEnvelopes() { return [...this.envelopes.values()].map(cloneEnvelope); }
  async getEnvelope(id: string) { const value = this.envelopes.get(id); return value && cloneEnvelope(value); }
  async insertEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, maximum: number) {
    if (this.envelopes.size >= maximum || this.envelopes.has(envelope.recordId)) throw new Error("quota");
    this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
  }
  async importEnvelopes(envelopes: readonly CanopyProofMobileEvidenceVaultEnvelope[]) {
    for (const envelope of envelopes) this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
    return envelopes.map((envelope) => envelope.recordId);
  }
  async replaceEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope, revision: number) {
    if (this.envelopes.get(envelope.recordId)?.revision !== revision) return false;
    this.envelopes.set(envelope.recordId, cloneEnvelope(envelope));
    return true;
  }
  async deleteEnvelope(id: string, revision: number) {
    if (this.envelopes.get(id)?.revision !== revision) return false;
    return this.envelopes.delete(id);
  }
  async clear() { this.key = undefined; this.envelopes.clear(); }
}

function createVault() {
  const storage = new MemoryVaultStorage();
  return {
    storage,
    vault: new CanopyProofMobileEvidenceVault({
      storage,
      crypto: globalThis.crypto,
      now: () => new Date("2026-07-17T02:00:00.000Z"),
    }),
  };
}

function cloneEnvelope(envelope: CanopyProofMobileEvidenceVaultEnvelope): CanopyProofMobileEvidenceVaultEnvelope {
  return { ...envelope, iv: new Uint8Array(envelope.iv), ciphertext: envelope.ciphertext.slice(0) };
}

function actorSnapshot(): CanopyProofEvidenceCustodyActorSnapshot {
  const seed = {
    id: actorId,
    participantType: "human" as const,
    role: "community" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "mobile-sync-participant", actorId }),
    organizationRoot: hashJson({ kind: "mobile-sync-organization", organizationId }),
    membershipId: "cp_mobile_sync_membership",
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "mobile-sync-membership", actorId, organizationId }),
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

function projectBoundary() {
  return {
    id: projectId,
    organizationId,
    regionId: "cp_mobile_sync_region",
    status: "active" as const,
    projectRoot: hashJson({ kind: "mobile-sync-project", projectId }),
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

function projectProfile(): CanopyProofProjectProfile {
  return projectBoundary() as unknown as CanopyProofProjectProfile;
}

function assertAuthorityError(error: unknown, code: string, status: number) {
  assert.ok(error instanceof CanopyProofMobileEvidenceSyncAuthorityError);
  assert.equal(error.code, code);
  assert.equal(error.httpStatus, status);
  return true;
}

void CanopyProofMobileEvidenceVaultError;
