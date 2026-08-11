import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofGlobalCommandCenterGovernanceApproval,
  buildCanopyProofGlobalCommandCenterPublication,
  buildCanopyProofGlobalCommandCenterSourceAuthorityRoot,
  canopyProofGlobalCommandCenterPublishingScopes,
  verifyCanopyProofGlobalCommandCenterPublication,
} from "../../services/api/src/domain/canopyproof/global-command-center-publishing-authority.js";
import { buildCanopyProofGlobalCommandCenter } from "../../services/api/src/domain/canopyproof/global-command-center.js";
import { CanopyProofEarlyWarningService } from "../../services/api/src/domain/canopyproof/early-warning.js";
import { CanopyProofFundingTransparencyService } from "../../services/api/src/domain/canopyproof/funding-transparency.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";
import { CanopyProofService } from "../../services/api/src/domain/canopyproof/proof-service.js";
import { TerraProofService } from "../../services/api/src/domain/canopyproof/terra-intelligence.js";

const generatedAt = "2026-07-18T00:00:00.000Z";
const publishedAt = "2026-07-18T00:05:00.000Z";
const policyId = "cp_global_projection_policy_v1";
const policyRoot = "9".repeat(64);

test("Global Command Center publication roots replay deterministically under independent governance", () => {
  const snapshot = snapshotAt(generatedAt);
  const sourceAuthorityRoot = buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(snapshot);
  const publisher = actor(
    "cp_global_projection_agent",
    "agent",
    "agent",
    canopyProofGlobalCommandCenterPublishingScopes.publish,
  );
  const governor = actor(
    "cp_global_projection_governor",
    "human",
    "verifier",
    canopyProofGlobalCommandCenterPublishingScopes.govern,
  );
  const approval = buildApproval(snapshot.lineage.dashboardRoot, sourceAuthorityRoot, governor);
  const input = { snapshot, sourceAuthorityRoot, policyId, policyRoot, publishedAt };

  const first = buildCanopyProofGlobalCommandCenterPublication(input, {
    publisher,
    governanceApproval: approval,
  });
  const replay = buildCanopyProofGlobalCommandCenterPublication(input, {
    publisher,
    governanceApproval: approval,
  });

  assert.deepEqual(replay, first);
  assert.deepEqual(verifyCanopyProofGlobalCommandCenterPublication(first, snapshot), first);
  assert.equal(first.globalSequence, 1);
  assert.equal(first.auditEvent.actor, publisher.id);
  assert.equal(first.auditEvent.entityType, "global_command_center_snapshot");
  assert.equal(first.safety.routeMounted, false);
  assert.equal(first.safety.schedulerMounted, false);
  assert.equal(first.safety.productionActivationEnabled, false);
  assert.equal(first.safety.noMainnetFunds, true);
  assert.equal(first.safety.noAutomaticCanopyDistribution, true);
  assert.equal(first.safety.notCertifiedCarbonCredit, true);
  assert.equal(first.safety.notCarbonTaxOffset, true);
  assert.equal(first.safety.notGuaranteedYield, true);

  const nextSnapshot = snapshotAt("2026-07-18T00:06:00.000Z");
  const nextSourceRoot = buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(nextSnapshot);
  const nextApproval = buildApproval(nextSnapshot.lineage.dashboardRoot, nextSourceRoot, governor, {
    approvedAt: "2026-07-18T00:06:00.000Z",
    validFrom: "2026-07-18T00:06:00.000Z",
    validUntil: "2026-07-18T00:20:00.000Z",
  });
  const second = buildCanopyProofGlobalCommandCenterPublication(
    {
      snapshot: nextSnapshot,
      sourceAuthorityRoot: nextSourceRoot,
      policyId,
      policyRoot,
      publishedAt: "2026-07-18T00:07:00.000Z",
    },
    { publisher, governanceApproval: nextApproval },
    [first.auditEvent],
  );
  assert.equal(second.globalSequence, 2);
  assert.equal(second.previousEventRoot, first.auditEvent.eventRoot);
  assert.deepEqual(
    verifyCanopyProofGlobalCommandCenterPublication(second, nextSnapshot, [first.auditEvent]),
    second,
  );
});

test("Global Command Center publication rejects stale, changed, self-approved, and unauthorized authority", () => {
  const snapshot = snapshotAt(generatedAt);
  const sourceAuthorityRoot = buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(snapshot);
  const publisher = actor(
    "cp_global_projection_agent",
    "agent",
    "agent",
    canopyProofGlobalCommandCenterPublishingScopes.publish,
  );
  const governor = actor(
    "cp_global_projection_governor",
    "human",
    "verifier",
    canopyProofGlobalCommandCenterPublishingScopes.govern,
  );
  const approval = buildApproval(snapshot.lineage.dashboardRoot, sourceAuthorityRoot, governor);
  const validInput = { snapshot, sourceAuthorityRoot, policyId, policyRoot, publishedAt };

  assert.throws(
    () => buildCanopyProofGlobalCommandCenterPublication(
      { ...validInput, sourceAuthorityRoot: "1".repeat(64) },
      { publisher, governanceApproval: approval },
    ),
    /SOURCE_AUTHORITY_ROOT_INVALID/,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterPublication(
      { ...validInput, policyRoot: "2".repeat(64) },
      { publisher, governanceApproval: approval },
    ),
    /APPROVAL_SCOPE_MISMATCH/,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterPublication(
      { ...validInput, publishedAt: "2026-07-18T00:11:00.000Z" },
      { publisher, governanceApproval: approval },
    ),
    /PUBLICATION_WINDOW_INVALID/,
  );

  const sameIdentityGovernor = actor(
    publisher.id,
    "human",
    "admin",
    canopyProofGlobalCommandCenterPublishingScopes.govern,
  );
  const sameIdentityApproval = buildApproval(
    snapshot.lineage.dashboardRoot,
    sourceAuthorityRoot,
    sameIdentityGovernor,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterPublication(validInput, {
      publisher,
      governanceApproval: sameIdentityApproval,
    }),
    /INDEPENDENT_GOVERNANCE_REQUIRED/,
  );

  const agentGovernor = actor(
    "cp_global_projection_agent_governor",
    "agent",
    "agent",
    canopyProofGlobalCommandCenterPublishingScopes.govern,
  );
  assert.throws(
    () => buildApproval(snapshot.lineage.dashboardRoot, sourceAuthorityRoot, agentGovernor),
    /GOVERNOR_INVALID/,
  );

  const wrongScopePublisher = actor(
    "cp_global_projection_wrong_scope",
    "agent",
    "agent",
    "global_command_center:observe",
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterPublication(validInput, {
      publisher: wrongScopePublisher,
      governanceApproval: approval,
    }),
    /PUBLISHER_AUTHORITY_INVALID/,
  );

  const valid = buildCanopyProofGlobalCommandCenterPublication(validInput, {
    publisher,
    governanceApproval: approval,
  });
  const changedSnapshot = snapshotAt("2026-07-18T00:00:01.000Z");
  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterPublication(valid, changedSnapshot),
    /SOURCE_AUTHORITY_ROOT_INVALID|PUBLICATION_ROOT_INVALID/,
  );
  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterPublication(
      { ...valid, publicationRoot: "0".repeat(64) },
      snapshot,
    ),
    /PUBLICATION_ROOT_INVALID/,
  );
});

function buildApproval(
  dashboardRoot: string,
  sourceAuthorityRoot: string,
  governor: CanopyProofVerificationActorSnapshot,
  time: Readonly<{
    approvedAt: string;
    validFrom: string;
    validUntil: string;
  }> = {
    approvedAt: generatedAt,
    validFrom: generatedAt,
    validUntil: "2026-07-18T00:10:00.000Z",
  },
) {
  return buildCanopyProofGlobalCommandCenterGovernanceApproval(
    {
      id: `cp_global_approval_${dashboardRoot.slice(0, 16)}`,
      dashboardRoot,
      sourceAuthorityRoot,
      policyId,
      policyRoot,
      maxSnapshotAgeSeconds: 600,
      ...time,
    },
    governor,
  );
}

function actor(
  id: string,
  participantType: "human" | "agent",
  role: "agent" | "owner" | "admin" | "verifier" | "researcher",
  scope: string,
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType,
    role,
    verificationStatus: "verified" as const,
    organizationId: "org_global_projection_authority",
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "test-participant", id }),
    organizationRoot: hashJson({ kind: "test-organization", id: "org_global_projection_authority" }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "test-membership", id }),
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "test-accreditation", id, scope }),
    accreditationScope: [scope],
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function snapshotAt(at: string) {
  return buildCanopyProofGlobalCommandCenter({
    projectRegistry: new CanopyProofProjectRegistryService(),
    proof: new CanopyProofService(),
    terra: new TerraProofService(),
    risk: new CanopyProofEarlyWarningService(),
    funding: new CanopyProofFundingTransparencyService(),
    generatedAt: at,
  });
}
