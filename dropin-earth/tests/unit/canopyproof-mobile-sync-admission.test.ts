import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanopyProofMobileEvidenceSyncAdmissionDenialFact,
  canopyProofMobileEvidenceSyncAdmissionDecisionSchema,
  canopyProofMobileEvidenceSyncAdmissionDenialReason,
  canopyProofMobileEvidenceSyncAdmissionPolicy,
  canopyProofMobileEvidenceSyncAdmissionWindow,
} from "../../services/api/src/domain/canopyproof/mobile-evidence-sync-admission.js";

test("mobile sync admission policies are fixed, command-specific, and body-bounded", () => {
  assert.deepEqual(canopyProofMobileEvidenceSyncAdmissionPolicy("binding"), {
    policyVersion: "canopyproof.mobile-sync-admission/v1",
    command: "binding",
    actorLimit: 30,
    organizationLimit: 300,
    maximumBodyBytes: 16 * 1024,
    windowSeconds: 60,
  });
  assert.equal(canopyProofMobileEvidenceSyncAdmissionPolicy("batch").actorLimit, 12);
  assert.equal(canopyProofMobileEvidenceSyncAdmissionPolicy("batch").maximumBodyBytes, 256 * 1024);
  assert.equal(canopyProofMobileEvidenceSyncAdmissionPolicy("recovery").maximumBodyBytes, 4 * 1024);
  assert.equal(Object.isFrozen(canopyProofMobileEvidenceSyncAdmissionPolicy("binding")), true);
});

test("mobile sync admission windows and denial roots replay deterministically", () => {
  const window = canopyProofMobileEvidenceSyncAdmissionWindow("2026-07-17T03:00:59.999Z");
  assert.deepEqual(window, {
    windowStartedAt: "2026-07-17T03:00:00.000Z",
    resetAt: "2026-07-17T03:01:00.000Z",
  });
  const input = {
    organizationId: "cp_mobile_sync_admission_org",
    actorId: "cp_mobile_sync_admission_actor",
    command: "binding" as const,
    ...window,
    actorCount: 31n,
    organizationCount: 31n,
    reason: "actor_limit_exceeded" as const,
    createdAt: "2026-07-17T03:00:59.999Z",
  };
  const first = buildCanopyProofMobileEvidenceSyncAdmissionDenialFact(input);
  const second = buildCanopyProofMobileEvidenceSyncAdmissionDenialFact(input);
  assert.deepEqual(second, first);
  assert.match(first.denialRoot, /^[a-f0-9]{64}$/);
  assert.equal(first.id, `cp_mobile_sync_denial_${first.denialRoot.slice(0, 24)}`);
  assert.equal("requestBody" in first, false);
  assert.equal("clientIp" in first, false);
  assert.notEqual(
    buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({ ...input, actorCount: 32n }).denialRoot,
    first.denialRoot,
  );
});

test("mobile sync admission uses strict greater-than limits and validates decision lineage", () => {
  const policy = canopyProofMobileEvidenceSyncAdmissionPolicy("binding");
  assert.equal(canopyProofMobileEvidenceSyncAdmissionDenialReason({
    actorCount: 30n,
    organizationCount: 300n,
    policy,
  }), undefined);
  assert.equal(canopyProofMobileEvidenceSyncAdmissionDenialReason({
    actorCount: 31n,
    organizationCount: 300n,
    policy,
  }), "actor_limit_exceeded");
  assert.equal(canopyProofMobileEvidenceSyncAdmissionDenialReason({
    actorCount: 31n,
    organizationCount: 301n,
    policy,
  }), "actor_and_organization_limits_exceeded");
  assert.equal(canopyProofMobileEvidenceSyncAdmissionDenialReason({
    actorCount: 30n,
    organizationCount: 301n,
    policy,
  }), "organization_limit_exceeded");

  assert.throws(() => canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse({
    allowed: false,
    policyVersion: "canopyproof.mobile-sync-admission/v1",
    command: "binding",
    limit: 30,
    remaining: 0,
    resetAt: "2026-07-17T03:01:00.000Z",
  }));
  assert.throws(() => canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse({
    allowed: true,
    policyVersion: "canopyproof.mobile-sync-admission/v1",
    command: "binding",
    limit: 30,
    remaining: 29,
    resetAt: "2026-07-17T03:01:00.000Z",
    abuseEventRoot: "a".repeat(64),
  }));
  assert.throws(() => canopyProofMobileEvidenceSyncAdmissionDecisionSchema.parse({
    allowed: true,
    policyVersion: "canopyproof.mobile-sync-admission/v1",
    command: "binding",
    limit: 30,
    remaining: 31,
    resetAt: "2026-07-17T03:01:00.000Z",
  }));
});

test("mobile sync denial facts reject invalid windows, timestamps, and substituted reasons", () => {
  const window = canopyProofMobileEvidenceSyncAdmissionWindow("2026-07-17T03:00:30.000Z");
  const base = {
    organizationId: "cp_mobile_sync_admission_org",
    actorId: "cp_mobile_sync_admission_actor",
    command: "binding" as const,
    ...window,
    actorCount: 31n,
    organizationCount: 300n,
    reason: "actor_limit_exceeded" as const,
    createdAt: "2026-07-17T03:00:30.000Z",
  };
  assert.throws(
    () => buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({
      ...base,
      resetAt: "2026-07-17T03:00:59.000Z",
    }),
    /WINDOW_INVALID/,
  );
  assert.throws(
    () => buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({
      ...base,
      createdAt: "2026-07-17T03:01:00.000Z",
    }),
    /WINDOW_INVALID/,
  );
  assert.throws(
    () => buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({
      ...base,
      reason: "organization_limit_exceeded",
    }),
    /REASON_INVALID/,
  );
  assert.throws(
    () => buildCanopyProofMobileEvidenceSyncAdmissionDenialFact({
      ...base,
      actorCount: 30n,
      reason: "actor_limit_exceeded",
    }),
    /REASON_INVALID/,
  );
});
