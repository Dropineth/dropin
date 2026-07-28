import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";
import {
  appendCanopyProofAuditEvent,
  verifyCanopyProofAuditChain,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";
import {
  canopyProofEvidenceCustodyActorAuthorityRoot,
  type CanopyProofEvidenceCustodyActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-custody-authority.js";
import {
  CanopyProofCommunityAttestationAuthorityService,
  CanopyProofEvidenceOfflineSyncAuthorityService,
  offlineBatchGenesis,
  type CanopyProofOfflineSyncBatchFact,
} from "../../services/api/src/domain/canopyproof/evidence-offline-community-authority.js";
import {
  PrismaCanopyProofEvidenceOfflineCommunityRepository,
} from "../../services/api/src/domain/canopyproof/evidence-offline-community-postgres.js";
import {
  NasaGibsConnectorService,
  type NasaGibsActor,
} from "../../services/api/src/domain/canopyproof/nasa-gibs.js";
import { PrismaNasaGibsRepository } from "../../services/api/src/domain/canopyproof/nasa-gibs-postgres.js";
import type {
  CanopyProofVerificationActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  CanopyProofEnvironmentalProofLifecycleAuthorityService,
  type CanopyProofEnvironmentalProofManagedSignatureVerifier,
  type CanopyProofExternalVerificationReceipt,
} from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-authority.js";
import {
  PrismaCanopyProofEnvironmentalProofLifecycleRepository,
} from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-postgres.js";
import {
  CanopyProofCanonicalEsgReportingAuthorityService,
} from "../../services/api/src/domain/canopyproof/esg-reporting-authority.js";
import {
  PrismaCanopyProofCanonicalEsgReportingRepository,
} from "../../services/api/src/domain/canopyproof/esg-reporting-postgres.js";
import {
  CanopyProofPublicTransparencyAuthorityService,
} from "../../services/api/src/domain/canopyproof/public-transparency-authority.js";
import {
  PrismaCanopyProofPublicTransparencyRepository,
  type CanopyProofPublicTransparencySourceResolver,
} from "../../services/api/src/domain/canopyproof/public-transparency-postgres.js";
import {
  PrismaCanopyProofPublicExplorerRepository,
  createCanopyProofPublicExplorerSourceResolver,
} from "../../services/api/src/domain/canopyproof/public-explorer-postgres.js";
import {
  serializeCanopyProofPublicExplorerProject,
} from "../../services/api/src/domain/canopyproof/public-explorer.js";
import {
  CanopyProofEsgMetricAuthorityService,
} from "../../services/api/src/domain/canopyproof/esg-metric-authority.js";
import {
  PrismaCanopyProofEsgMetricRepository,
} from "../../services/api/src/domain/canopyproof/esg-metric-postgres.js";
import {
  CanopyProofMrvGraphAuthorityService,
  canopyProofMrvActorAuthorityRoot,
  type CanopyProofMrvActorSnapshot,
  type CanopyProofMrvEndpointSnapshot,
  type CanopyProofMrvMethodologySnapshot,
} from "../../services/api/src/domain/canopyproof/mrv-graph-authority.js";
import { PrismaCanopyProofMrvGraphRepository } from "../../services/api/src/domain/canopyproof/mrv-graph-postgres.js";
import { CanopyProofEarlyWarningService } from "../../services/api/src/domain/canopyproof/early-warning.js";
import { CanopyProofFundingTransparencyService } from "../../services/api/src/domain/canopyproof/funding-transparency.js";
import { buildCanopyProofGlobalCommandCenter } from "../../services/api/src/domain/canopyproof/global-command-center.js";
import { PrismaCanopyProofGlobalCommandCenterRepository } from "../../services/api/src/domain/canopyproof/global-command-center-postgres.js";
import {
  buildCanopyProofGlobalCommandCenterGovernanceApproval,
  buildCanopyProofGlobalCommandCenterPublication,
  buildCanopyProofGlobalCommandCenterSourceAuthorityRoot,
  canopyProofGlobalCommandCenterPublishingScopes,
} from "../../services/api/src/domain/canopyproof/global-command-center-publishing-authority.js";
import { PrismaCanopyProofGlobalCommandCenterPublishingRepository } from "../../services/api/src/domain/canopyproof/global-command-center-publishing-postgres.js";
import {
  PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority,
} from "../../services/api/src/domain/canopyproof/mobile-evidence-sync-admission-postgres.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";
import { CanopyProofService } from "../../services/api/src/domain/canopyproof/proof-service.js";
import { TerraProofService } from "../../services/api/src/domain/canopyproof/terra-intelligence.js";

const nativeDatabaseUrlEnvironment = "CANOPYPROOF_NATIVE_DATABASE_URL";
const nativeDatabaseConfirmationEnvironment = "CANOPYPROOF_NATIVE_TEST_CONFIRM";
const nativeDatabaseConfirmation = "confirm-disposable-test-database";

type CountRow = { readonly count: bigint };
type SequenceRow = {
  readonly sequence_no: bigint;
  readonly previous_root: string;
  readonly event_root: string;
};

const nativeNasaGibsWmtsFixture = readFileSync(
  join(process.cwd(), "tests/fixtures/nasa-gibs-wmts-capabilities.xml"),
);

test(
  "CanopyProof Prisma trust registry is atomic and idempotent across native PostgreSQL connections",
  { timeout: 180_000 },
  async () => {
    const databaseUrl = requireDisposableNativeDatabase();
    applyCanopyProofContract(databaseUrl);

    const runId = randomUUID().replaceAll("-", "");
    const clientA = createSingleConnectionClient(databaseUrl);
    const clientB = createSingleConnectionClient(databaseUrl);
    const clients = [clientA, clientB];

    try {
      await Promise.all(clients.map((client) => client.$connect()));
      const serviceA = new PrismaCanopyProofTrustRegistryService(clientA);
      const serviceB = new PrismaCanopyProofTrustRegistryService(clientB);
      const bootstrapActorId = `cp_native_owner_${runId}`;
      await insertBootstrapOwner(clientA, bootstrapActorId, runId);
      await verifyNativeGlobalCommandCenter(clientA, clientB, bootstrapActorId, runId);

      const exactParticipantId = `cp_native_exact_${runId}`;
      const exactParticipantInput = {
        id: exactParticipantId,
        participantType: "human",
        displayName: "Native Concurrent Participant",
        roles: ["community"],
        verificationStatus: "verified",
        reputationScore: 50,
        credentialCommitments: [hashJson({ kind: "native-credential", runId })],
        createdAt: timestamp(0),
      } as const;
      const exactIdempotencyKey = `native-exact-${runId}`;
      const [exactLeft, exactRight] = await Promise.all([
        serviceA.registerParticipant(exactParticipantInput, bootstrapActorId, exactIdempotencyKey),
        serviceB.registerParticipant(exactParticipantInput, bootstrapActorId, exactIdempotencyKey),
      ]);
      assert.equal(exactLeft.id, exactParticipantId);
      assert.equal(exactRight.subjectHash, exactLeft.subjectHash);
      assert.equal(await countRows(clientA, "identity.participants", "id", exactParticipantId), 1);
      assert.equal(await countRows(clientA, "audit.domain_events", "stream_id", exactParticipantId), 1);
      assert.equal(
        await countCommandReceipts(clientA, bootstrapActorId, "identity.participant.register", exactParticipantId),
        1,
      );

      await assert.rejects(
        serviceB.registerParticipant(
          { ...exactParticipantInput, displayName: "Conflicting Native Participant" },
          bootstrapActorId,
          exactIdempotencyKey,
        ),
        (error: unknown) =>
          error instanceof CanopyProofTrustRegistryError &&
          error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
          error.httpStatus === 409,
      );
      assert.equal(await countRows(clientA, "audit.domain_events", "stream_id", exactParticipantId), 1);

      const independentKeyParticipantId = `cp_native_stream_${runId}`;
      const independentKeyInput = {
        ...exactParticipantInput,
        id: independentKeyParticipantId,
        displayName: "Native Stream Lock Participant",
        credentialCommitments: [hashJson({ kind: "native-stream-credential", runId })],
        createdAt: timestamp(1),
      };
      const [independentLeft, independentRight] = await Promise.all([
        serviceA.registerParticipant(independentKeyInput, bootstrapActorId, `native-stream-a-${runId}`),
        serviceB.registerParticipant(independentKeyInput, bootstrapActorId, `native-stream-b-${runId}`),
      ]);
      assert.equal(independentLeft.subjectHash, independentRight.subjectHash);
      assert.equal(await countRows(clientA, "identity.participants", "id", independentKeyParticipantId), 1);
      assert.equal(await countRows(clientA, "audit.domain_events", "stream_id", independentKeyParticipantId), 1);
      assert.equal(
        await countCommandReceipts(clientA, bootstrapActorId, "identity.participant.register", independentKeyParticipantId),
        2,
      );

      const organizationId = `cp_native_org_${runId}`;
      await serviceA.registerOrganization(
        {
          id: organizationId,
          name: "Native Trust Registry Institute",
          organizationType: "auditor",
          jurisdiction: "GLOBAL",
          publicContact: "native-test@example.invalid",
          operatingRegions: ["native-test-region"],
          verificationCapabilities: ["independent environmental review"],
          registrationNumber: `NATIVE-${runId}`,
          documents: [
            {
              documentType: "registration",
              documentHash: hashJson({ kind: "native-organization-registration", runId }),
              issuedBy: "Disposable Native Test Registry",
              uploadedAt: timestamp(2),
            },
          ],
          authorizedUsers: [bootstrapActorId],
          verificationStatus: "verified",
          trustLevel: "verified",
          dataSharingPolicy: "restricted",
          createdAt: timestamp(2),
        },
        bootstrapActorId,
        `native-org-${runId}`,
      );
      await verifyNativeMobileSyncAdmission(
        clientA,
        clientB,
        organizationId,
        bootstrapActorId,
      );

      const organizationEventCountBeforeFailure = await countRows(
        clientA,
        "audit.domain_events",
        "stream_id",
        organizationId,
      );
      await assert.rejects(
        serviceA.grantMembership(
          organizationId,
          {
            actorId: `cp_native_missing_member_${runId}`,
            role: "observer",
            conflictDisclosure: "No institutional decision authority is assigned.",
            grantedAt: timestamp(3),
          },
          bootstrapActorId,
          `native-rollback-${runId}`,
        ),
        (error: unknown) =>
          error instanceof CanopyProofTrustRegistryError &&
          error.code === "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE" &&
          error.httpStatus === 503,
      );
      assert.equal(
        await countRows(clientA, "audit.domain_events", "stream_id", organizationId),
        organizationEventCountBeforeFailure,
      );
      assert.equal(
        await countCommandReceipts(clientA, bootstrapActorId, "organization.membership.grant", undefined),
        0,
      );

      const memberIds = [
        `cp_native_member_a_${runId}`,
        `cp_native_member_b_${runId}`,
        `cp_native_member_c_${runId}`,
        `cp_native_member_d_${runId}`,
        `cp_native_member_e_${runId}`,
      ] as const;
      const memberRoles = ["verifier", "researcher", "admin", "owner", "owner"] as const;
      await Promise.all(
        memberIds.map((memberId, index) =>
          (index % 2 === 0 ? serviceA : serviceB).registerParticipant(
            {
              id: memberId,
              participantType: "human",
              displayName: `Native Institutional Member ${index + 1}`,
              organizationId,
              roles: [memberRoles[index]!],
              verificationStatus: "verified",
              reputationScore: 50,
              credentialCommitments: [hashJson({ kind: "native-member-credential", memberId })],
              createdAt: timestamp(4),
            },
            bootstrapActorId,
            `native-member-${index}-${runId}`,
          ),
        ),
      );

      const membershipTimestamp = timestamp(5);
      const [firstMembership, secondMembership, thirdMembership, fourthMembership, fifthMembership] = await Promise.all([
        serviceA.grantMembership(
          organizationId,
          {
            actorId: memberIds[0],
            role: "verifier",
            conflictDisclosure: "No project payment or review conflict is present.",
            grantedAt: membershipTimestamp,
          },
          bootstrapActorId,
          `native-membership-a-${runId}`,
        ),
        serviceB.grantMembership(
          organizationId,
          {
            actorId: memberIds[1],
            role: "researcher",
            conflictDisclosure: "Research access is separated from final verification authority.",
            grantedAt: membershipTimestamp,
          },
          bootstrapActorId,
          `native-membership-b-${runId}`,
        ),
        serviceA.grantMembership(
          organizationId,
          {
            actorId: memberIds[2],
            role: "admin",
            conflictDisclosure: "The enforcement reviewer is separate from delivery, use, and challenge actors.",
            grantedAt: membershipTimestamp,
          },
          bootstrapActorId,
          `native-membership-c-${runId}`,
        ),
        serviceB.grantMembership(
          organizationId,
          {
            actorId: memberIds[3],
            role: "owner",
            conflictDisclosure: "The restriction approver is separate from review, delivery, receipt, and use actors.",
            grantedAt: membershipTimestamp,
          },
          bootstrapActorId,
          `native-membership-d-${runId}`,
        ),
        serviceA.grantMembership(
          organizationId,
          {
            actorId: memberIds[4],
            role: "owner",
            conflictDisclosure: "The notice publisher is separate from disclosure publication, challenge, and resolution actors.",
            grantedAt: membershipTimestamp,
          },
          bootstrapActorId,
          `native-membership-e-${runId}`,
        ),
      ]);
      assert.notEqual(firstMembership.id, secondMembership.id);
      assert.notEqual(thirdMembership.id, firstMembership.id);
      assert.notEqual(fourthMembership.id, thirdMembership.id);
      assert.notEqual(fifthMembership.id, fourthMembership.id);
      assert.equal(await countRows(clientA, "organizations.memberships", "organization_id", organizationId), 5);

      const stream = await clientA.$queryRaw<SequenceRow[]>(Prisma.sql`
        SELECT sequence_no, previous_root, event_root
        FROM audit.domain_events
        WHERE stream_id = ${organizationId}
        ORDER BY sequence_no
      `);
      assert.deepEqual(
        stream.map((event) => Number(event.sequence_no)),
        [1, 2, 3, 4, 5, 6],
      );
      assert.equal(stream[1]?.previous_root, stream[0]?.event_root);
      assert.equal(stream[2]?.previous_root, stream[1]?.event_root);
      assert.equal(stream[3]?.previous_root, stream[2]?.event_root);
      assert.equal(stream[4]?.previous_root, stream[3]?.event_root);
      assert.equal(stream[5]?.previous_root, stream[4]?.event_root);

      const updatedRows = await clientA.$queryRaw<Array<{ updated_at: Date }>>(Prisma.sql`
        SELECT updated_at FROM organizations.organizations WHERE id = ${organizationId}
      `);
      assert.equal(updatedRows[0]?.updated_at.toISOString(), membershipTimestamp);

      const activeAgreementInput = {
        datasetScopes: ["proof summaries"],
        privacyTier: "restricted",
        permittedUses: ["institutional review"],
        expiresAt: timestamp(31_536_000),
        createdAt: timestamp(6),
      } as const;
      const [activeAgreementLeft, activeAgreementRight] = await Promise.all([
        serviceA.createDataSharingAgreement(
          organizationId,
          activeAgreementInput,
          bootstrapActorId,
          `native-agreement-active-${runId}`,
        ),
        serviceB.createDataSharingAgreement(
          organizationId,
          activeAgreementInput,
          bootstrapActorId,
          `native-agreement-active-${runId}`,
        ),
      ]);
      assert.equal(activeAgreementLeft.id, activeAgreementRight.id);

      const revocableAgreement = await serviceA.createDataSharingAgreement(
        organizationId,
        {
          datasetScopes: ["public summaries"],
          privacyTier: "public",
          permittedUses: ["public accountability review"],
          expiresAt: timestamp(31_536_000),
          createdAt: timestamp(7),
        },
        bootstrapActorId,
        `native-agreement-revocable-${runId}`,
      );
      const revocation = await serviceB.revokeDataSharingAgreement(
        revocableAgreement.id,
        {
          rationale: "Independent governance withdrew this agreement after bounded review.",
          evidenceEventRoots: ["a".repeat(64)],
          revokedAt: timestamp(8),
        },
        bootstrapActorId,
        `native-agreement-revoke-${runId}`,
      );
      assert.equal((await serviceA.getDataSharingAgreementRevocation(revocation.id)).agreementId, revocableAgreement.id);

      const predecessorAgreement = await serviceA.createDataSharingAgreement(
        organizationId,
        {
          datasetScopes: ["method summaries"],
          privacyTier: "restricted",
          permittedUses: ["research review"],
          expiresAt: timestamp(31_536_000),
          createdAt: timestamp(9),
        },
        bootstrapActorId,
        `native-agreement-predecessor-${runId}`,
      );
      const supersession = await serviceB.supersedeDataSharingAgreement(
        predecessorAgreement.id,
        {
          transitionType: "renewal",
          successor: {
            datasetScopes: ["method summaries"],
            privacyTier: "restricted",
            permittedUses: ["research review"],
            expiresAt: timestamp(63_072_000),
          },
          rationale: "Renew the unchanged least-privilege agreement after governance review.",
          evidenceEventRoots: ["b".repeat(64)],
          supersededAt: timestamp(10),
        },
        bootstrapActorId,
        `native-agreement-supersede-${runId}`,
      );
      const agreementViews = await serviceA.listDataSharingAgreements(organizationId);
      assert.equal(agreementViews.find((agreement) => agreement.id === revocableAgreement.id)?.revoked, true);
      assert.equal(agreementViews.find((agreement) => agreement.id === predecessorAgreement.id)?.superseded, true);
      assert.equal(
        agreementViews.find((agreement) => agreement.id === supersession.successorAgreementId)?.supersedesAgreementId,
        predecessorAgreement.id,
      );

      const requestInput = {
        agreementId: activeAgreementLeft.id,
        datasetScopes: ["proof summaries"],
        privacyTier: "restricted",
        permittedUses: ["institutional review"],
        purpose: "Review bounded proof summaries through the disposable native concurrency gate.",
        requestedAt: timestamp(11),
        expiresAt: timestamp(2_592_011),
      } as const;
      const [requestLeft, requestRight] = await Promise.all([
        serviceA.requestDataAccess(
          organizationId,
          requestInput,
          memberIds[1],
          `native-data-access-request-${runId}`,
        ),
        serviceB.requestDataAccess(
          organizationId,
          requestInput,
          memberIds[1],
          `native-data-access-request-${runId}`,
        ),
      ]);
      assert.equal(requestLeft.id, requestRight.id);
      assert.equal(requestLeft.status, "pending");

      const decisionInput = {
        status: "approved",
        rationale: "Approved by the independent native verifier within the active agreement boundary.",
        decidedAt: timestamp(12),
      } as const;
      const competingDecisions = await Promise.allSettled([
        serviceA.decideDataAccessRequest(
          requestLeft.id,
          decisionInput,
          memberIds[0],
          `native-data-access-decision-a-${runId}`,
        ),
        serviceB.decideDataAccessRequest(
          requestLeft.id,
          decisionInput,
          memberIds[0],
          `native-data-access-decision-b-${runId}`,
        ),
      ]);
      assert.equal(competingDecisions.filter((result) => result.status === "fulfilled").length, 1);
      const rejectedDecision = competingDecisions.find((result) => result.status === "rejected");
      assert.ok(rejectedDecision && rejectedDecision.status === "rejected");
      assert.equal(rejectedDecision.reason instanceof CanopyProofTrustRegistryError, true);
      assert.equal((rejectedDecision.reason as CanopyProofTrustRegistryError).code, "CANOPYPROOF_TRUST_REGISTRY_CONFLICT");
      const approvedRequest = await serviceA.getDataAccessRequest(requestLeft.id);
      assert.equal(approvedRequest.status, "approved");

      const manifestInput = {
        id: `cp_native_audit_export_${runId}`,
        kind: "institutional_audit_packet",
        scope: "organization",
        subjectId: organizationId,
        requesterOrganizationId: organizationId,
        purpose: "Hash-only native PostgreSQL review package for the approved request lineage.",
        classification: "restricted",
        entries: [
          {
            id: `cp_native_audit_export_entry_${runId}`,
            resourceType: "audit_event",
            resourceId: approvedRequest.decisionAuditEvent!.id,
            contentHash: approvedRequest.requestHash,
            eventRoot: approvedRequest.decisionAuditEvent!.eventRoot,
            classification: "restricted",
            redactionPolicy: "confidential_hash_only",
            included: true,
            reason: "Hash-only decision lineage included without raw evidence or private data.",
          },
        ],
        expiresAt: timestamp(2_592_013),
        createdAt: timestamp(13),
      } as const;
      const [manifestLeft, manifestRight] = await Promise.all([
        serviceA.createAuditExportManifest(
          manifestInput,
          memberIds[0],
          `native-audit-export-${runId}`,
        ),
        serviceB.createAuditExportManifest(
          manifestInput,
          memberIds[0],
          `native-audit-export-${runId}`,
        ),
      ]);
      assert.equal(manifestLeft.exportHash, manifestRight.exportHash);
      assert.equal((await serviceA.getAuditExportManifestStatus(organizationId)).manifestCount, 1);

      const deliveryInput = {
        manifestId: manifestLeft.id,
        channel: "audit_export_manifest",
        recipientActorId: memberIds[1],
        purpose: "Deliver the approved native hash-only package to the named institutional researcher.",
        deliveredAt: timestamp(14),
      } as const;
      const [deliveryLeft, deliveryRight] = await Promise.all([
        serviceA.recordDataAccessDelivery(
          requestLeft.id,
          deliveryInput,
          memberIds[0],
          `native-data-delivery-${runId}`,
        ),
        serviceB.recordDataAccessDelivery(
          requestLeft.id,
          deliveryInput,
          memberIds[0],
          `native-data-delivery-${runId}`,
        ),
      ]);
      assert.equal(deliveryLeft.deliveryRoot, deliveryRight.deliveryRoot);
      assert.equal(
        await countRows(clientA, "organizations.data_access_delivery_receipts", "id", deliveryLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[0],
          "organization.data-access-delivery.record",
          deliveryLeft.id,
        ),
        1,
      );

      const useAttestationInput = {
        usageState: "within_scope",
        useCase: "Use the native hash-only package within the approved institutional review scope.",
        outputHashes: [hashJson({ kind: "native-data-use-output", runId })],
        limitations: ["No raw evidence or private contact material was included."],
        attestedAt: timestamp(15),
      } as const;
      const [useAttestationLeft, useAttestationRight] = await Promise.all([
        serviceA.recordDataUseAttestation(
          deliveryLeft.id,
          useAttestationInput,
          memberIds[1],
          `native-data-use-${runId}`,
        ),
        serviceB.recordDataUseAttestation(
          deliveryLeft.id,
          useAttestationInput,
          memberIds[1],
          `native-data-use-${runId}`,
        ),
      ]);
      assert.equal(useAttestationLeft.usageRoot, useAttestationRight.usageRoot);
      assert.equal(
        await countRows(clientA, "organizations.data_use_attestations", "id", useAttestationLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[1],
          "organization.data-use-attestation.record",
          useAttestationLeft.id,
        ),
        1,
      );

      const challengedUse = await serviceA.recordDataUseAttestation(
        deliveryLeft.id,
        {
          usageState: "misuse_challenged",
          useCase: "Challenge possible redistribution outside the approved native review boundary.",
          evidenceEventRoots: [hashJson({ kind: "native-data-use-challenge", runId })],
          limitations: ["The challenge remains non-final until independent human review."],
          attestedAt: timestamp(16),
        },
        memberIds[0],
        `native-data-use-challenge-${runId}`,
      );
      const enforcementInput = {
        caseState: "access_suspended",
        enforcementAction: "suspend_data_access",
        rationale: "Suspend future governed delivery after independent review of the challenged native hash lineage.",
        evidenceEventRoots: [hashJson({ kind: "native-data-use-enforcement-evidence", runId })],
        reviewedAt: timestamp(17),
      } as const;
      const [enforcementLeft, enforcementRight] = await Promise.all([
        serviceA.recordDataUseEnforcementCase(
          challengedUse.id,
          enforcementInput,
          memberIds[2],
          `native-data-use-enforcement-${runId}`,
        ),
        serviceB.recordDataUseEnforcementCase(
          challengedUse.id,
          enforcementInput,
          memberIds[2],
          `native-data-use-enforcement-${runId}`,
        ),
      ]);
      assert.equal(enforcementLeft.enforcementRoot, enforcementRight.enforcementRoot);
      assert.equal(
        await countRows(clientA, "organizations.data_use_enforcement_cases", "id", enforcementLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[2],
          "organization.data-use-enforcement-case.record",
          enforcementLeft.id,
        ),
        1,
      );

      const restrictionInput = {
        restrictionState: "suspended",
        rationale: "Independently approve the native access suspension while preserving the complete review lineage.",
        evidenceEventRoots: [hashJson({ kind: "native-data-access-restriction-evidence", runId })],
        decidedAt: timestamp(18),
      } as const;
      const [restrictionLeft, restrictionRight] = await Promise.all([
        serviceA.recordDataAccessRestriction(
          enforcementLeft.id,
          restrictionInput,
          memberIds[3],
          `native-data-access-restriction-${runId}`,
        ),
        serviceB.recordDataAccessRestriction(
          enforcementLeft.id,
          restrictionInput,
          memberIds[3],
          `native-data-access-restriction-${runId}`,
        ),
      ]);
      assert.equal(restrictionLeft.restrictionRoot, restrictionRight.restrictionRoot);
      assert.equal(
        await countRows(clientA, "organizations.data_access_restrictions", "id", restrictionLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[3],
          "organization.data-access-restriction.record",
          restrictionLeft.id,
        ),
        1,
      );

      const packetInput = {
        intendedAudience: "independent native institutional accountability reviewer",
        generatedAt: timestamp(19),
      } as const;
      const [packetLeft, packetRight] = await Promise.all([
        serviceA.createDataAccessAccountabilityPacket(
          requestLeft.id,
          packetInput,
          memberIds[0],
          `native-data-access-accountability-packet-${runId}`,
        ),
        serviceB.createDataAccessAccountabilityPacket(
          requestLeft.id,
          packetInput,
          memberIds[0],
          `native-data-access-accountability-packet-${runId}`,
        ),
      ]);
      assert.equal(packetLeft.packetRoot, packetRight.packetRoot);
      assert.equal(packetLeft.counts.activeRestrictionCount, 1);
      assert.equal(packetLeft.counts.totalRestrictionCount, 1);
      assert.equal(
        await countRows(clientA, "organizations.data_access_accountability_packets", "id", packetLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[0],
          "organization.data-access-accountability-packet.create",
          packetLeft.id,
        ),
        1,
      );

      const verificationInput = {
        expectedPacketRoot: packetLeft.packetRoot,
        verifiedAt: timestamp(20),
      } as const;
      const [verificationLeft, verificationRight] = await Promise.all([
        serviceA.verifyDataAccessAccountabilityPacket(
          packetLeft.id,
          verificationInput,
          memberIds[1],
          `native-data-access-accountability-verification-${runId}`,
        ),
        serviceB.verifyDataAccessAccountabilityPacket(
          packetLeft.id,
          verificationInput,
          memberIds[1],
          `native-data-access-accountability-verification-${runId}`,
        ),
      ]);
      assert.equal(verificationLeft.verificationRoot, verificationRight.verificationRoot);
      assert.equal(verificationLeft.valid, true);
      assert.deepEqual(verificationLeft.issues, []);
      assert.equal(
        await countRows(clientA, "organizations.data_access_accountability_verifications", "id", verificationLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[1],
          "organization.data-access-accountability-verification.create",
          verificationLeft.id,
        ),
        1,
      );

      const disclosureInput = {
        verificationId: verificationLeft.id,
        publishedAt: timestamp(21),
      } as const;
      const [disclosureLeft, disclosureRight] = await Promise.all([
        serviceA.publishDataAccessAccountabilityDisclosure(
          packetLeft.id,
          disclosureInput,
          memberIds[2],
          `native-data-access-accountability-disclosure-${runId}`,
        ),
        serviceB.publishDataAccessAccountabilityDisclosure(
          packetLeft.id,
          disclosureInput,
          memberIds[2],
          `native-data-access-accountability-disclosure-${runId}`,
        ),
      ]);
      assert.equal(disclosureLeft.disclosureRoot, disclosureRight.disclosureRoot);
      assert.equal(disclosureLeft.currentState, "current");
      assert.equal(
        await countRows(clientA, "organizations.data_access_accountability_disclosures", "id", disclosureLeft.id),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[2],
          "organization.data-access-accountability-disclosure.publish",
          disclosureLeft.id,
        ),
        1,
      );

      const disclosureChallengeInput = {
        reason: "source_verification_disputed",
        statement: "Request independent review of the source verification retained by this durable public disclosure.",
        evidenceEventRoots: [disclosureLeft.auditEvent.eventRoot],
        challengedAt: timestamp(22),
      } as const;
      const [disclosureChallengeLeft, disclosureChallengeRight] = await Promise.all([
        serviceA.challengeDataAccessAccountabilityDisclosure(
          disclosureLeft.id,
          disclosureChallengeInput,
          memberIds[3],
          "owner",
          `native-data-access-accountability-disclosure-challenge-${runId}`,
        ),
        serviceB.challengeDataAccessAccountabilityDisclosure(
          disclosureLeft.id,
          disclosureChallengeInput,
          memberIds[3],
          "owner",
          `native-data-access-accountability-disclosure-challenge-${runId}`,
        ),
      ]);
      assert.equal(disclosureChallengeLeft.challengeRoot, disclosureChallengeRight.challengeRoot);
      assert.equal(
        await countRows(
          clientA,
          "organizations.data_access_accountability_disclosure_challenges",
          "id",
          disclosureChallengeLeft.id,
        ),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[3],
          "organization.data-access-accountability-disclosure-challenge.create",
          disclosureChallengeLeft.id,
        ),
        1,
      );

      const disclosureResolutionInput = {
        decision: "upheld",
        remedialAction: "publish_withdrawal_notice",
        rationale: "Independent native review upheld the challenge and requires an immutable public withdrawal notice.",
        evidenceEventRoots: [disclosureChallengeLeft.auditEvent.eventRoot],
        reviewedAt: timestamp(23),
      } as const;
      const [disclosureResolutionLeft, disclosureResolutionRight] = await Promise.all([
        serviceA.resolveDataAccessAccountabilityDisclosureChallenge(
          disclosureChallengeLeft.id,
          disclosureResolutionInput,
          memberIds[0],
          "verifier",
          `native-data-access-accountability-disclosure-resolution-a-${runId}`,
        ),
        serviceB.resolveDataAccessAccountabilityDisclosureChallenge(
          disclosureChallengeLeft.id,
          disclosureResolutionInput,
          memberIds[0],
          "verifier",
          `native-data-access-accountability-disclosure-resolution-b-${runId}`,
        ),
      ]);
      assert.equal(disclosureResolutionLeft.resolutionRoot, disclosureResolutionRight.resolutionRoot);
      assert.equal(
        await countRows(
          clientA,
          "organizations.data_access_accountability_disclosure_resolutions",
          "id",
          disclosureResolutionLeft.id,
        ),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[0],
          "organization.data-access-accountability-disclosure-resolution.create",
          disclosureResolutionLeft.id,
        ),
        2,
      );

      const disclosureNoticeInput = {
        noticeType: "withdrawal",
        statement: "The original disclosure remains public but is withdrawn from institutional reliance.",
        evidenceEventRoots: [disclosureResolutionLeft.auditEvent.eventRoot],
        publishedAt: timestamp(24),
      } as const;
      const [disclosureNoticeLeft, disclosureNoticeRight] = await Promise.all([
        serviceA.publishDataAccessAccountabilityDisclosureNotice(
          disclosureResolutionLeft.id,
          disclosureNoticeInput,
          memberIds[4],
          "owner",
          `native-data-access-accountability-disclosure-notice-${runId}`,
        ),
        serviceB.publishDataAccessAccountabilityDisclosureNotice(
          disclosureResolutionLeft.id,
          disclosureNoticeInput,
          memberIds[4],
          "owner",
          `native-data-access-accountability-disclosure-notice-${runId}`,
        ),
      ]);
      assert.equal(disclosureNoticeLeft.noticeRoot, disclosureNoticeRight.noticeRoot);
      assert.equal(
        await countRows(
          clientA,
          "organizations.data_access_accountability_disclosure_notices",
          "id",
          disclosureNoticeLeft.id,
        ),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[4],
          "organization.data-access-accountability-disclosure-notice.publish",
          disclosureNoticeLeft.id,
        ),
        1,
      );
      assert.equal(
        (await serviceA.getDataAccessAccountabilityDisclosure(disclosureLeft.id)).governanceState,
        "withdrawn",
      );

      const projectPolicyId = `cp_native_project_policy_${runId}`;
      const projectApprovalId = `cp_native_project_approval_${runId}`;
      const projectId = `cp_native_project_${runId}`;
      await clientA.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${memberIds[3]}, true)`);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO governance.policies (
            id, title, applies_to, required_approvals, allowed_reviewer_roles,
            human_authority_required, conflict_disclosure_required,
            claim_boundary_enforced, policy_hash, created_at
          ) VALUES (
            ${projectPolicyId}, 'Native independent project activation policy', ARRAY['project']::text[],
            1, ARRAY['admin']::text[], true, true, true,
            ${hashJson({ kind: "native-project-policy-v1", runId })}, ${new Date(timestamp(30))}
          )
        `);
      });
      const projectInput = {
        id: projectId,
        organizationId,
        title: "Native durable restoration authority",
        projectType: "ecosystem_restoration",
        regionId: "native-test-region",
        location: {
          latitude: 14.7167,
          longitude: -17.4677,
          areaHectares: 125.5,
          boundaryHash: hashJson({ kind: "native-project-boundary-v1", runId }),
        },
        targetTreeCount: 50_000,
        biodiversityIndicators: ["habitat connectivity", "native species mix"],
        waterIndicators: ["soil moisture recovery"],
        climateRiskIndicators: ["drought exposure"],
        monitoringCadenceDays: 60,
        governancePolicyId: projectPolicyId,
        createdAt: timestamp(31),
      } as const;
      const [projectLeft, projectRight] = await Promise.all([
        serviceA.registerProject(projectInput, memberIds[3], "owner", `native-project-register-${runId}`),
        serviceB.registerProject(projectInput, memberIds[3], "owner", `native-project-register-${runId}`),
      ]);
      assert.equal(projectLeft.projectRoot, projectRight.projectRoot);
      assert.equal(await countRows(clientA, "projects.projects", "id", projectId), 1);
      assert.equal(await countRows(clientA, "audit.domain_events", "stream_id", projectId), 1);

      const reviewInput = {
        status: "under_review",
        rationale: "Native institutional review opened before the governed activation decision.",
        updatedAt: timestamp(32),
      } as const;
      const [reviewLeft, reviewRight] = await Promise.all([
        serviceA.updateProjectStatus(
          projectId,
          reviewInput,
          memberIds[0],
          "verifier",
          `native-project-review-${runId}`,
        ),
        serviceB.updateProjectStatus(
          projectId,
          reviewInput,
          memberIds[0],
          "verifier",
          `native-project-review-${runId}`,
        ),
      ]);
      assert.equal(reviewLeft.projectRoot, reviewRight.projectRoot);
      assert.equal(reviewLeft.status, "under_review");

      await clientA.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${memberIds[2]}, true)`);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO governance.approvals (
            id, subject_type, subject_id, policy_id, approver_id, approver_role,
            decision, rationale, conflict_disclosure, approval_hash, decided_at
          ) VALUES (
            ${projectApprovalId}, 'project', ${projectId}, ${projectPolicyId}, ${memberIds[2]}, 'admin',
            'approve', 'Independent native human review approved bounded project activation.',
            'Approver is separate from project creator and lifecycle transition actor.',
            ${hashJson({ kind: "native-project-approval-v1", runId })}, ${new Date(timestamp(33))}
          )
        `);
      });
      const activationInput = {
        status: "active",
        governanceApprovalId: projectApprovalId,
        rationale: "Independent native governance approval completed project activation.",
        updatedAt: timestamp(34),
      } as const;
      const [activeLeft, activeRight] = await Promise.all([
        serviceA.updateProjectStatus(
          projectId,
          activationInput,
          memberIds[0],
          "verifier",
          `native-project-activate-${runId}`,
        ),
        serviceB.updateProjectStatus(
          projectId,
          activationInput,
          memberIds[0],
          "verifier",
          `native-project-activate-${runId}`,
        ),
      ]);
      assert.equal(activeLeft.projectRoot, activeRight.projectRoot);
      assert.equal(activeLeft.status, "active");

      const verificationAgentId = `cp_native_verification_agent_${runId}`;
      const finalVerifierId = `cp_native_final_verifier_${runId}`;
      const challengeResolutionVerifierId = `cp_native_challenge_resolution_verifier_${runId}`;
      const methodologyResearcherId = `cp_native_methodology_researcher_${runId}`;
      const proofVerifierId = `cp_native_environmental_proof_verifier_${runId}`;
      const proofIssuerId = `cp_native_environmental_proof_issuer_${runId}`;
      const proofChallengeOwnerReviewerId = `cp_native_environmental_proof_challenge_owner_reviewer_${runId}`;
      const proofChallengeResolverId = `cp_native_environmental_proof_challenge_resolver_${runId}`;
      const proofChallengerOrganizationId = `cp_native_environmental_proof_challenger_org_${runId}`;
      const proofChallengerId = `cp_native_environmental_proof_challenger_${runId}`;
      await serviceA.registerParticipant(
        {
          id: verificationAgentId,
          participantType: "agent",
          displayName: "Native Canopy AI Advisory Agent",
          organizationId,
          roles: ["agent"],
          verificationStatus: "verified",
          reputationScore: 50,
          credentialCommitments: [hashJson({ kind: "native-verification-agent-credential", runId })],
          createdAt: timestamp(34),
        },
        bootstrapActorId,
        `native-verification-agent-${runId}`,
      );
      await clientA.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${bootstrapActorId}, true)`);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO identity.agent_profiles (
            id, agent_type, layer, capabilities, allowed_actions,
            human_review_required, final_authority, status, registry_hash
          ) VALUES (
            ${verificationAgentId}, 'verification', 'Verification',
            ARRAY['managed_key_attestation_verification','detached_signature_verification']::text[],
            ARRAY['verify_managed_key_attestation','verify_detached_signature']::text[],
            true, false, 'active',
            ${hashJson({ kind: "native-managed-signature-verifier-profile", runId })}
          )
        `);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await serviceA.registerParticipant(
        {
          id: finalVerifierId,
          participantType: "human",
          displayName: "Native Independent Final Evidence Verifier",
          organizationId,
          roles: ["verifier"],
          verificationStatus: "verified",
          reputationScore: 50,
          credentialCommitments: [hashJson({ kind: "native-final-verifier-credential", runId })],
          createdAt: timestamp(34),
        },
        bootstrapActorId,
        `native-final-verifier-${runId}`,
      );
      await serviceA.registerParticipant(
        {
          id: challengeResolutionVerifierId,
          participantType: "human",
          displayName: "Native Independent Challenge Resolution Verifier",
          organizationId,
          roles: ["verifier"],
          verificationStatus: "verified",
          reputationScore: 50,
          credentialCommitments: [hashJson({ kind: "native-resolution-verifier-credential", runId })],
          createdAt: timestamp(34),
        },
        bootstrapActorId,
        `native-resolution-verifier-${runId}`,
      );
      await serviceA.grantMembership(
        organizationId,
        {
          actorId: finalVerifierId,
          role: "verifier",
          conflictDisclosure: "Final evidence authority is independent from contribution, AI analysis, and first review.",
          grantedAt: timestamp(34),
        },
        bootstrapActorId,
        `native-final-verifier-membership-${runId}`,
      );
      await serviceA.grantMembership(
        organizationId,
        {
          actorId: challengeResolutionVerifierId,
          role: "verifier",
          conflictDisclosure: "Challenge resolution authority is independent from evidence authorship, AI analysis, and original review.",
          grantedAt: timestamp(34),
        },
        bootstrapActorId,
        `native-resolution-verifier-membership-${runId}`,
      );
      await serviceA.recordAccreditation(
        organizationId,
        {
          status: "approved",
          scope: ["field evidence verification"],
          rationale: "Native independent accreditation authorizes bounded field evidence review.",
          evidenceHash: hashJson({ kind: "native-verification-accreditation", runId }),
          decidedAt: timestamp(34),
        },
        bootstrapActorId,
        `native-verification-accreditation-${runId}`,
      );

      const proofActors = [
        {
          id: methodologyResearcherId,
          displayName: "Native Independent Methodology Research Reviewer",
          role: "researcher",
          conflictDisclosure:
            "Research review is independent from methodology authorship, publication, proof approval, and issuance.",
        },
        {
          id: proofVerifierId,
          displayName: "Native Independent Environmental Proof Verifier",
          role: "verifier",
          conflictDisclosure:
            "Proof verification is independent from project, evidence, methodology, monitoring, and issuance sources.",
        },
        {
          id: proofIssuerId,
          displayName: "Native Independent Environmental Proof Issuer",
          role: "admin",
          conflictDisclosure: "Record issuance is independent from every source actor and candidate approver.",
        },
        {
          id: proofChallengeOwnerReviewerId,
          displayName: "Native Independent Environmental Proof Challenge Owner Reviewer",
          role: "owner",
          conflictDisclosure:
            "Challenge administration is independent from sources, candidate approvals, issuance, and the challenger.",
        },
        {
          id: proofChallengeResolverId,
          displayName: "Native Independent Environmental Proof Challenge Resolver",
          role: "owner",
          conflictDisclosure:
            "Challenge resolution is independent from sources, candidate approvals, issuance, challenger, and reviewers.",
        },
      ] as const;
      await Promise.all(
        proofActors.map((actor, index) =>
          (index % 2 === 0 ? serviceA : serviceB).registerParticipant(
            {
              id: actor.id,
              participantType: "human",
              displayName: actor.displayName,
              organizationId,
              roles: [actor.role],
              verificationStatus: "verified",
              reputationScore: 50,
              credentialCommitments: [hashJson({ kind: "native-proof-actor-credential", actorId: actor.id })],
              createdAt: timestamp(34.1),
            },
            bootstrapActorId,
            `native-proof-actor-${index}-${runId}`,
          ),
        ),
      );
      await Promise.all(
        proofActors.map((actor, index) =>
          (index % 2 === 0 ? serviceB : serviceA).grantMembership(
            organizationId,
            {
              actorId: actor.id,
              role: actor.role,
              conflictDisclosure: actor.conflictDisclosure,
              grantedAt: timestamp(34.2),
            },
            bootstrapActorId,
            `native-proof-membership-${index}-${runId}`,
          ),
        ),
      );

      await serviceA.registerOrganization(
        {
          id: proofChallengerOrganizationId,
          name: "Native External Environmental Proof Challenge Observatory",
          organizationType: "research_institution",
          jurisdiction: "GLOBAL",
          publicContact: "native-proof-challenge@example.invalid",
          operatingRegions: ["native-test-region"],
          verificationCapabilities: ["independent environmental proof challenge"],
          registrationNumber: `NATIVE-CHALLENGER-${runId}`,
          documents: [
            {
              documentType: "registration",
              documentHash: hashJson({ kind: "native-proof-challenger-registration", runId }),
              issuedBy: "Disposable Native Test Registry",
              uploadedAt: timestamp(34.3),
            },
          ],
          authorizedUsers: [bootstrapActorId, proofChallengerId],
          verificationStatus: "verified",
          trustLevel: "verified",
          dataSharingPolicy: "restricted",
          createdAt: timestamp(34.3),
        },
        bootstrapActorId,
        `native-proof-challenger-org-${runId}`,
      );
      await serviceB.registerParticipant(
        {
          id: proofChallengerId,
          participantType: "human",
          displayName: "Native External Environmental Proof Challenger",
          organizationId: proofChallengerOrganizationId,
          roles: ["researcher"],
          verificationStatus: "verified",
          reputationScore: 50,
          credentialCommitments: [hashJson({ kind: "native-proof-challenger-credential", runId })],
          createdAt: timestamp(34.4),
        },
        bootstrapActorId,
        `native-proof-challenger-${runId}`,
      );
      await serviceA.grantMembership(
        proofChallengerOrganizationId,
        {
          actorId: proofChallengerId,
          role: "researcher",
          conflictDisclosure:
            "External challenger has no target-organization membership, proof approval, issuance, or private-data authority.",
          grantedAt: timestamp(34.5),
        },
        bootstrapActorId,
        `native-proof-challenger-membership-${runId}`,
      );

      const projectEvidenceId = `cp_native_project_evidence_${runId}`;
      const projectSceneId = `cp_native_project_scene_${runId}`;
      const evidenceInput = {
        id: projectEvidenceId,
        projectId,
        evidenceType: "restoration",
        location: {
          latitude: 14.7167,
          longitude: -17.4677,
          accuracyMeters: 8,
          regionId: "native-test-region",
        },
        timestamp: timestamp(35),
        createdAt: timestamp(35),
        media_hash: hashJson({ kind: "native-project-media-v1", runId }),
        gps_hash: hashJson({ kind: "native-project-gps-v1", runId }),
        confidence_score: 92,
      } as const;
      const [evidenceLeft, evidenceRight] = await Promise.all([
        serviceA.registerEvidence(
          evidenceInput,
          memberIds[3],
          "owner",
          `native-project-evidence-${runId}`,
        ),
        serviceB.registerEvidence(
          evidenceInput,
          memberIds[3],
          "owner",
          `native-project-evidence-${runId}`,
        ),
      ]);
      assert.equal(evidenceLeft.evidence.evidenceRoot, evidenceRight.evidence.evidenceRoot);
      assert.equal(await countRows(clientA, "evidence.evidence_objects", "id", projectEvidenceId), 1);
      assert.equal(await countRows(clientA, "audit.domain_events", "stream_id", projectEvidenceId), 1);
      assert.equal(
        await countCommandReceipts(
          clientA,
          memberIds[3],
          "evidence.registration.create",
          projectEvidenceId,
        ),
        1,
      );
      const validationInput = {
        rulesetId: "canopyproof-evidence-validation-core",
        rulesetVersion: "1.0.0",
        executedAt: timestamp(36),
      } as const;
      const [validationLeft, validationRight] = await Promise.all([
        serviceA.runEvidenceValidation(
          projectEvidenceId,
          validationInput,
          verificationAgentId,
          "agent",
          `native-evidence-validation-${runId}`,
        ),
        serviceB.runEvidenceValidation(
          projectEvidenceId,
          validationInput,
          verificationAgentId,
          "agent",
          `native-evidence-validation-${runId}`,
        ),
      ]);
      assert.equal(validationLeft.validationRoot, validationRight.validationRoot);
      assert.equal(validationLeft.outcome, "pass");
      assert.equal(
        await countCommandReceipts(
          clientA,
          verificationAgentId,
          "evidence.validation.run",
          validationLeft.id,
        ),
        1,
      );
      const analysisInput = {
        validationRunId: validationLeft.id,
        modelProvider: "CanopyProof Research",
        modelName: "Canopy AI Advisory",
        modelVersion: "1.0.0",
        modelArtifactHash: hashJson({ kind: "native-ai-model", runId }),
        promptHash: hashJson({ kind: "native-ai-prompt", runId }),
        datasetSnapshotRoots: [hashJson({ kind: "native-ai-dataset", runId })],
        sourceEventRoots: [
          evidenceLeft.evidence.audit_history[0].eventRoot,
          validationLeft.auditEvent.eventRoot,
        ].sort(),
        executionEnvironment: "native-postgresql-isolated-evaluation-v1",
        findings: [],
        confidenceScore: 88,
        analyzedAt: timestamp(37),
      } as const;
      const [analysisLeft, analysisRight] = await Promise.all([
        serviceA.recordEvidenceAiAnalysis(
          projectEvidenceId,
          analysisInput,
          verificationAgentId,
          `native-evidence-ai-analysis-${runId}`,
        ),
        serviceB.recordEvidenceAiAnalysis(
          projectEvidenceId,
          analysisInput,
          verificationAgentId,
          `native-evidence-ai-analysis-${runId}`,
        ),
      ]);
      assert.equal(analysisLeft.analysisRoot, analysisRight.analysisRoot);
      assert.equal(analysisLeft.advisoryOnly, true);
      const humanReviewInput = {
        validationRunId: validationLeft.id,
        aiAnalysisIds: [analysisLeft.id],
        decision: "approve",
        findingDispositions: [],
        rationale: "Native independent accredited verifier approves bounded evidence reliance.",
        limitations: ["Reliance remains limited to this immutable evidence registration."],
        reviewedAt: timestamp(38),
      } as const;
      const [humanReviewLeft, humanReviewRight] = await Promise.all([
        serviceA.recordEvidenceHumanReview(
          projectEvidenceId,
          humanReviewInput,
          memberIds[0],
          "verifier",
          `native-evidence-human-review-${runId}`,
        ),
        serviceB.recordEvidenceHumanReview(
          projectEvidenceId,
          humanReviewInput,
          memberIds[0],
          "verifier",
          `native-evidence-human-review-${runId}`,
        ),
      ]);
      assert.equal(humanReviewLeft.reviewRoot, humanReviewRight.reviewRoot);
      assert.equal((await serviceA.getEvidenceReliance(projectEvidenceId, organizationId)).state, "approved");
      const finalDecisionInput = {
        decision: "verify",
        rationale: "Native second accredited verifier confirms the exact current bounded evidence authority chain.",
        limitations: ["This internal decision is not an environmental proof record and carries no transferable value."],
        sourceEventRoots: [
          evidenceLeft.evidence.audit_history[0].eventRoot,
          validationLeft.auditEvent.eventRoot,
          analysisLeft.auditEvent.eventRoot,
          humanReviewLeft.auditEvent.eventRoot,
        ].sort(),
        decidedAt: timestamp(39),
      } as const;
      const [finalDecisionLeft, finalDecisionRight] = await Promise.all([
        serviceA.recordEvidenceFinalDecision(
          projectEvidenceId,
          finalDecisionInput,
          finalVerifierId,
          `native-evidence-final-decision-${runId}`,
        ),
        serviceB.recordEvidenceFinalDecision(
          projectEvidenceId,
          finalDecisionInput,
          finalVerifierId,
          `native-evidence-final-decision-${runId}`,
        ),
      ]);
      assert.equal(finalDecisionLeft.decisionRoot, finalDecisionRight.decisionRoot);
      assert.equal((await serviceA.getEvidenceFinalVerification(projectEvidenceId, organizationId)).state, "verified");

      const proofMethodologyPolicy = await serviceA.createGovernedPolicy(
        {
          subject: "methodology_publication",
          title: "Native independent Environmental Proof methodology publication policy",
          requiredApprovals: 2,
          allowedReviewerRoles: ["researcher", "verifier"],
          createdAt: timestamp(39.01),
        },
        organizationId,
        memberIds[3],
        "owner",
        `native-environmental-proof-methodology-policy-${runId}`,
      );
      const proofRecordPolicy = await serviceB.createGovernedPolicy(
        {
          subject: "environmental_proof_record",
          title: "Native independent Environmental Proof candidate and issuance policy",
          requiredApprovals: 2,
          allowedReviewerRoles: ["owner", "verifier"],
          createdAt: timestamp(39.02),
        },
        organizationId,
        memberIds[3],
        "owner",
        `native-environmental-proof-record-policy-${runId}`,
      );
      const proofMethodologyInput = {
        id: `cp_native_environmental_proof_methodology_${runId}`,
        slug: `native-environmental-proof-methodology-${runId}`,
        version: "v1.0.0",
        title: "Native Environmental Proof Technical Methodology",
        scope: "multi_scope",
        status: "draft",
        summary:
          "Technical methodology binding final evidence decisions, accepted monitoring, and independent governance.",
        requiredDataSources: ["field_photo", "governance_approval", "gps_trace"],
        qualityGates: [
          "governance_approval_required",
          "human_review_required",
          "media_hash_required",
          "monitoring_timeline_required",
          "public_challenge_window_required",
        ],
        minimumGpsAccuracyMeters: 35,
        monitoringCadenceDays: 90,
        evidenceRetentionDays: 2_555,
        governanceApprovalIds: [],
        limitations: [
          "This technical methodology has no carbon, tax, token, funding, title, or financial authority.",
        ],
        createdAt: timestamp(39.03),
      } as const;
      const [proofMethodologyLeft, proofMethodologyRight] = await Promise.all([
        serviceA.createMethodologyVersion(
          proofMethodologyInput,
          memberIds[1],
          "researcher",
          `native-environmental-proof-methodology-${runId}`,
        ),
        serviceB.createMethodologyVersion(
          proofMethodologyInput,
          memberIds[1],
          "researcher",
          `native-environmental-proof-methodology-${runId}`,
        ),
      ]);
      assert.equal(proofMethodologyLeft.methodologyHash, proofMethodologyRight.methodologyHash);
      const proofMethodologyVerifierApproval = await serviceA.approveMethodologyPublication(
        proofMethodologyLeft.id,
        {
          decision: "approve",
          rationale:
            "Independent accredited verifier approves the exact methodology and publication policy authority roots.",
          conflictDisclosure:
            "No authorship, operational, financial, employment, familial, issuance, or challenge conflict is known.",
          limitations: ["Approval is bounded to this immutable methodology version."],
          sourceEventRoots: [
            proofMethodologyLeft.auditEvent.eventRoot,
            proofMethodologyPolicy.auditEvent.eventRoot,
          ],
          decidedAt: timestamp(39.04),
        },
        organizationId,
        finalVerifierId,
        "verifier",
        `native-environmental-proof-methodology-verifier-approval-${runId}`,
      );
      const proofMethodologyResearchApproval = await serviceB.approveMethodologyPublication(
        proofMethodologyLeft.id,
        {
          decision: "approve",
          rationale:
            "Independent research reviewer approves publication after binding the accredited verifier decision.",
          conflictDisclosure:
            "No authorship, operational, financial, employment, familial, issuance, or challenge conflict is known.",
          limitations: ["Research approval grants no credit, tax, token, funding, title, or financial authority."],
          sourceEventRoots: [
            proofMethodologyLeft.auditEvent.eventRoot,
            proofMethodologyPolicy.auditEvent.eventRoot,
            proofMethodologyVerifierApproval.auditEvent.eventRoot,
          ],
          decidedAt: timestamp(39.05),
        },
        organizationId,
        methodologyResearcherId,
        "researcher",
        `native-environmental-proof-methodology-researcher-approval-${runId}`,
      );
      const proofMethodologyPublication = await serviceA.publishMethodology(
        proofMethodologyLeft.id,
        {
          approvalIds: [proofMethodologyResearchApproval.id, proofMethodologyVerifierApproval.id],
          rationale:
            "Independent publisher records the complete methodology quorum and immutable source graph.",
          limitations: ["Publication remains subject to supersession, challenge, and continuing governance review."],
          sourceEventRoots: [
            proofMethodologyLeft.auditEvent.eventRoot,
            proofMethodologyPolicy.auditEvent.eventRoot,
            proofMethodologyVerifierApproval.auditEvent.eventRoot,
            proofMethodologyResearchApproval.auditEvent.eventRoot,
          ],
          publishedAt: timestamp(39.06),
        },
        organizationId,
        memberIds[2],
        "admin",
        `native-environmental-proof-methodology-publish-${runId}`,
      );
      assert.equal(proofMethodologyPublication.methodologyId, proofMethodologyLeft.id);

      const proofMonitoringInput = {
        eventType: "field_observation",
        observedAt: timestamp(39.07),
        evidenceIds: [projectEvidenceId],
        terraSceneIds: [],
        biodiversityIndicators: ["native species mix observed"],
        waterIndicators: ["soil moisture recovery observed"],
        climateRiskIndicators: ["drought exposure monitored"],
        metrics: { survivalRate: 0.93 },
        state: "accepted",
        rationale:
          "Accepted native field monitoring postdates the independent final evidence decision and covers the evidence.",
      } as const;
      const [proofMonitoringLeft, proofMonitoringRight] = await Promise.all([
        serviceA.recordProjectMonitoringEvent(
          projectId,
          proofMonitoringInput,
          memberIds[0],
          "verifier",
          `native-environmental-proof-monitoring-${runId}`,
        ),
        serviceB.recordProjectMonitoringEvent(
          projectId,
          proofMonitoringInput,
          memberIds[0],
          "verifier",
          `native-environmental-proof-monitoring-${runId}`,
        ),
      ]);
      assert.equal(proofMonitoringLeft.monitoringRoot, proofMonitoringRight.monitoringRoot);

      const proofCandidateInput = {
        projectId,
        methodologyId: proofMethodologyLeft.id,
        policyId: proofRecordPolicy.id,
        evidenceIds: [projectEvidenceId],
        monitoringEventIds: [proofMonitoringLeft.id],
        derivedAt: timestamp(39.1),
      } as const;
      const [proofCandidateLeft, proofCandidateRight] = await Promise.all([
        serviceA.deriveEnvironmentalProofCandidate(
          proofCandidateInput,
          organizationId,
          memberIds[1],
          "researcher",
          `native-environmental-proof-candidate-${runId}`,
        ),
        serviceB.deriveEnvironmentalProofCandidate(
          proofCandidateInput,
          organizationId,
          memberIds[1],
          "researcher",
          `native-environmental-proof-candidate-${runId}`,
        ),
      ]);
      assert.equal(proofCandidateLeft.candidateRoot, proofCandidateRight.candidateRoot);
      const proofVerifierApproval = await serviceA.approveEnvironmentalProofCandidate(
        proofCandidateLeft.id,
        {
          decision: "approve",
          rationale:
            "Independent accredited verifier approves the exact current Environmental Proof candidate authority.",
          conflictDisclosure:
            "No source, derivation, monitoring, authorship, financial, employment, familial, or issuer conflict is known.",
          limitations: ["Approval is limited to this immutable candidate root."],
          sourceEventRoots: [proofCandidateLeft.auditEvent.eventRoot],
          decidedAt: timestamp(39.2),
        },
        organizationId,
        proofVerifierId,
        "verifier",
        `native-environmental-proof-verifier-approval-${runId}`,
      );
      const proofOwnerApproval = await serviceB.approveEnvironmentalProofCandidate(
        proofCandidateLeft.id,
        {
          decision: "approve",
          rationale:
            "Independent owner approves after binding the prior accredited verifier decision and candidate root.",
          conflictDisclosure:
            "No source, derivation, monitoring, authorship, financial, employment, familial, or issuer conflict is known.",
          limitations: ["Owner approval grants no credit, tax, token, funding, title, or financial authority."],
          sourceEventRoots: [
            proofCandidateLeft.auditEvent.eventRoot,
            proofVerifierApproval.auditEvent.eventRoot,
          ],
          decidedAt: timestamp(39.3),
        },
        organizationId,
        memberIds[4],
        "owner",
        `native-environmental-proof-owner-approval-${runId}`,
      );
      await serviceA.recordAccreditation(
        organizationId,
        {
          status: "approved",
          scope: [
            "environmental_proof_lifecycle:govern",
            "environmental_proof_lifecycle:issue",
            "environmental_proof_signing_key:admin",
            "esg_metric:calculate",
            "esg_metric:govern",
            "esg_metric:review",
            "esg_reporting:publish",
            "mrv_graph_review",
            "public_transparency:privacy_review",
            "public_transparency:publish",
          ],
          rationale:
            "Native disposable-database authority enables route-closed MRV and lifecycle conformance only.",
          evidenceHash: hashJson({ kind: "native-lifecycle-accreditation-evidence", runId }),
          decidedAt: timestamp(39.35),
        },
        bootstrapActorId,
        `native-environmental-proof-lifecycle-accreditation-${runId}`,
      );
      const proofRecordInput = {
        approvalIds: [proofOwnerApproval.id, proofVerifierApproval.id],
        rationale:
          "Independent issuer records the complete current source authority and human governance quorum.",
        limitations: [
          "This Environmental Proof Record is an accountability statement only and carries no transferable value.",
        ],
        sourceEventRoots: [
          proofCandidateLeft.auditEvent.eventRoot,
          proofVerifierApproval.auditEvent.eventRoot,
          proofOwnerApproval.auditEvent.eventRoot,
        ],
        issuedAt: timestamp(39.4),
      } as const;
      const [proofRecordLeft, proofRecordRight] = await Promise.all([
        serviceA.issueEnvironmentalProofRecord(
          proofCandidateLeft.id,
          proofRecordInput,
          organizationId,
          proofIssuerId,
          "admin",
          `native-environmental-proof-record-${runId}`,
        ),
        serviceB.issueEnvironmentalProofRecord(
          proofCandidateLeft.id,
          proofRecordInput,
          organizationId,
          proofIssuerId,
          "admin",
          `native-environmental-proof-record-${runId}`,
        ),
      ]);
      assert.equal(proofRecordLeft.recordRoot, proofRecordRight.recordRoot);
      const issuedProofRecordProjection = await serviceA.getEnvironmentalProofRecordStatus(
        proofRecordLeft.id,
        organizationId,
      );
      assert.equal(issuedProofRecordProjection.state, "issued");

      const mrvRepositoryA = new PrismaCanopyProofMrvGraphRepository(clientA);
      const mrvRepositoryB = new PrismaCanopyProofMrvGraphRepository(clientB);
      const mrvAuthority = new CanopyProofMrvGraphAuthorityService();
      const mrvMethodology = await resolveNativeMrvMethodology(clientA, proofMethodologyLeft.id);
      const monitoringAuthor = await resolveNativeMrvActor(clientA, memberIds[0], "verifier");
      const reviewAuthor = await resolveNativeMrvActor(clientA, memberIds[0], "verifier");
      const decisionAuthor = await resolveNativeMrvActor(clientA, finalVerifierId, "verifier");
      const mrvReviewer = await resolveNativeMrvActor(clientA, proofVerifierId, "verifier");
      const projectEndpoint = await resolveNativeMrvEndpoint(clientA, "project_registration", projectId);
      const evidenceEndpoint = await resolveNativeMrvEndpoint(clientA, "evidence_object", projectEvidenceId);
      const monitoringEndpoint = await resolveNativeMrvEndpoint(
        clientA,
        "project_monitoring_event",
        proofMonitoringLeft.id,
      );
      const reviewEndpoint = await resolveNativeMrvEndpoint(clientA, "human_review", humanReviewLeft.id);
      const decisionEndpoint = await resolveNativeMrvEndpoint(
        clientA,
        "verification_decision",
        finalDecisionLeft.id,
      );
      const recordEndpoint = await resolveNativeMrvEndpoint(
        clientA,
        "environmental_proof_record",
        proofRecordLeft.id,
      );
      const mrvEdges = [
        {
          source: monitoringEndpoint,
          relationship: "MEASURES" as const,
          target: projectEndpoint,
          actor: monitoringAuthor,
          createdAt: timestamp(39.41),
        },
        {
          source: reviewEndpoint,
          relationship: "REVIEWS" as const,
          target: evidenceEndpoint,
          actor: reviewAuthor,
          createdAt: timestamp(39.42),
        },
        {
          source: decisionEndpoint,
          relationship: "DECIDES" as const,
          target: evidenceEndpoint,
          actor: decisionAuthor,
          createdAt: timestamp(39.43),
        },
        {
          source: decisionEndpoint,
          relationship: "SUPPORTS" as const,
          target: recordEndpoint,
          actor: decisionAuthor,
          createdAt: timestamp(39.44),
        },
      ].map(({ source, relationship, target, actor, createdAt }) =>
        mrvAuthority.recordEdge(
          {
            source: { type: source.type, id: source.id, root: source.root, eventRoot: source.eventRoot },
            relationship,
            target: { type: target.type, id: target.id, root: target.root, eventRoot: target.eventRoot },
            reasonHash: hashJson({ kind: "native-lifecycle-mrv-reason", relationship, runId }),
            limitationHashes: [],
            createdAt,
          },
          { source, target, methodology: mrvMethodology, actor },
        ));
      for (const [index, edge] of mrvEdges.entries()) {
        const idempotencyKey = `native-lifecycle-mrv-edge-${index + 1}-${runId}`;
        const [left, right] = await Promise.all([
          mrvRepositoryA.commitEdge(edge, idempotencyKey),
          mrvRepositoryB.commitEdge(edge, idempotencyKey),
        ]);
        assert.equal(left.edgeRoot, edge.edgeRoot);
        assert.equal(right.edgeRoot, edge.edgeRoot);
      }
      const mrvSnapshotBundle = mrvAuthority.recordSnapshot(
        {
          projectId,
          projectRoot: projectEndpoint.root,
          methodologyId: proofMethodologyLeft.id,
          methodologyPublicationRoot: proofMethodologyPublication.publicationRoot,
          edgeIds: mrvEdges.map((edge) => edge.id).sort(),
          conflictDisclosureHash: hashJson({ kind: "native-lifecycle-mrv-review-conflict", runId }),
          limitationHashes: [],
          reviewedAt: timestamp(39.45),
        },
        {
          reviewer: mrvReviewer,
          organizationId,
          projectId,
          projectRoot: projectEndpoint.root,
          methodology: mrvMethodology,
        },
      );
      assert.equal(mrvSnapshotBundle.snapshot.state, "reviewed_for_lineage");
      const [snapshotLeft, snapshotRight] = await Promise.all([
        mrvRepositoryA.commitSnapshot(
          mrvSnapshotBundle.snapshot,
          mrvSnapshotBundle.members,
          `native-lifecycle-mrv-snapshot-${runId}`,
        ),
        mrvRepositoryB.commitSnapshot(
          mrvSnapshotBundle.snapshot,
          mrvSnapshotBundle.members,
          `native-lifecycle-mrv-snapshot-${runId}`,
        ),
      ]);
      assert.equal(snapshotLeft.snapshot.snapshotRoot, mrvSnapshotBundle.snapshot.snapshotRoot);
      assert.equal(snapshotRight.snapshot.snapshotRoot, mrvSnapshotBundle.snapshot.snapshotRoot);

      const lifecycleRepositoryA = new PrismaCanopyProofEnvironmentalProofLifecycleRepository(clientA);
      const lifecycleRepositoryB = new PrismaCanopyProofEnvironmentalProofLifecycleRepository(clientB);
      const lifecycleAuthority = new CanopyProofEnvironmentalProofLifecycleAuthorityService();
      const managedVerifier = nativeManagedSignatureVerifier(verificationAgentId, runId);
      const signingKey = await lifecycleAuthority.attestManagedSigningKey(
        {
          organizationId,
          provider: "managed_hsm",
          providerKeyId: `native-environmental-proof-lifecycle-${runId}`,
          keyVersion: "v1",
          algorithm: "Ed25519",
          publicKeyHash: hashJson({ kind: "native-lifecycle-public-key", runId }),
          providerAttestationHash: hashJson({ kind: "native-lifecycle-provider-attestation", runId }),
          activeFrom: timestamp(30),
          expiresAt: timestamp(172_800),
          attestedAt: timestamp(39.401),
        },
        proofRecordLeft.issuer,
        managedVerifier,
      );
      const [keyLeft, keyRight] = await Promise.all([
        lifecycleRepositoryA.commitSigningKey(signingKey, `native-lifecycle-key-${runId}`),
        lifecycleRepositoryB.commitSigningKey(signingKey, `native-lifecycle-key-${runId}`),
      ]);
      assert.equal(keyLeft.keyRoot, signingKey.keyRoot);
      assert.equal(keyRight.keyRoot, signingKey.keyRoot);
      const lifecycleBinding = lifecycleAuthority.bindLifecycle(
        {
          recordId: proofRecordLeft.id,
          observationStartsAt: timestamp(35),
          observationEndsAt: timestamp(39.39),
          validFrom: timestamp(39.48),
          expiresAt: timestamp(86_400),
          monitoringCadenceDays: 1,
          nextMonitoringDueAt: timestamp(1_000),
          monitoringGraceDays: 1,
          assertionType: "restoration_activity",
          assertionScopeHash: hashJson({ kind: "native-lifecycle-assertion-scope", runId }),
          locationScopeHash: hashJson({ kind: "native-lifecycle-location-scope", runId }),
          uncertaintyHash: hashJson({ kind: "native-lifecycle-uncertainty", runId }),
          limitationHashes: [hashJson({ kind: "native-lifecycle-limitation", runId })],
          relianceStatement: "environmental_accountability_only",
          boundAt: timestamp(39.46),
        },
        {
          record: proofRecordLeft,
          governedRecordProjection: issuedProofRecordProjection,
          mrvAuthoritySnapshot: await mrvRepositoryA.loadAuthoritySnapshot(organizationId, projectId),
          issuer: proofRecordLeft.issuer,
          signingKeyAuthorityId: signingKey.id,
        },
      );
      const [bindingLeft, bindingRight] = await Promise.all([
        lifecycleRepositoryA.commitBinding(lifecycleBinding, `native-lifecycle-binding-${runId}`),
        lifecycleRepositoryB.commitBinding(lifecycleBinding, `native-lifecycle-binding-${runId}`),
      ]);
      assert.equal(bindingLeft.bindingRoot, lifecycleBinding.bindingRoot);
      assert.equal(bindingRight.bindingRoot, lifecycleBinding.bindingRoot);
      const signatureReceipt = await lifecycleAuthority.recordSignatureReceipt(
        lifecycleBinding.id,
        {
          detachedSignature: "bmF0aXZlX2V4dGVybmFsX21hbmFnZWRfc2lnbmF0dXJlX3Yx",
          signedAt: timestamp(39.47),
        },
        managedVerifier,
      );
      const [signatureLeft, signatureRight] = await Promise.all([
        lifecycleRepositoryA.commitSignatureReceipt(
          signatureReceipt,
          `native-lifecycle-signature-${runId}`,
        ),
        lifecycleRepositoryB.commitSignatureReceipt(
          signatureReceipt,
          `native-lifecycle-signature-${runId}`,
        ),
      ]);
      assert.equal(signatureLeft.receiptRoot, signatureReceipt.receiptRoot);
      assert.equal(signatureRight.receiptRoot, signatureReceipt.receiptRoot);
      const [activeLifecycleLeft, activeLifecycleRight] = await Promise.all([
        lifecycleRepositoryA.projectLifecycle(organizationId, lifecycleBinding.id, timestamp(39.49)),
        lifecycleRepositoryB.projectLifecycle(organizationId, lifecycleBinding.id, timestamp(39.49)),
      ]);
      assert.equal(activeLifecycleLeft.state, "active");
      assert.equal(activeLifecycleRight.projectionRoot, activeLifecycleLeft.projectionRoot);
      await assert.rejects(
        lifecycleRepositoryB.projectLifecycle(
          proofChallengerOrganizationId,
          lifecycleBinding.id,
          timestamp(39.49),
        ),
        /ORGANIZATION_SCOPE_MISMATCH|PROJECTION_CARDINALITY_INVALID/,
      );
      const lifecycleCounts = await clientA.$queryRaw<Array<{
        key_count: bigint;
        binding_count: bigint;
        signature_count: bigint;
        receipt_count: bigint;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*)::bigint FROM governance.environmental_proof_signing_key_attestation_facts
            WHERE id = ${signingKey.id}) AS key_count,
          (SELECT count(*)::bigint FROM certificates.environmental_proof_lifecycle_binding_facts
            WHERE id = ${lifecycleBinding.id}) AS binding_count,
          (SELECT count(*)::bigint FROM certificates.environmental_proof_signature_receipt_facts
            WHERE id = ${signatureReceipt.id}) AS signature_count,
          (SELECT count(*)::bigint FROM audit.command_receipts
            WHERE result_entity_id IN (${signingKey.id}, ${lifecycleBinding.id}, ${signatureReceipt.id})) AS receipt_count
      `);
      assert.deepEqual(lifecycleCounts[0], {
        key_count: 1n,
        binding_count: 1n,
        signature_count: 1n,
        receipt_count: 3n,
      });

      const transparencyRepositoryA = new PrismaCanopyProofPublicTransparencyRepository(clientA);
      const transparencyRepositoryB = new PrismaCanopyProofPublicTransparencyRepository(clientB);
      const transparencyAuthority = new CanopyProofPublicTransparencyAuthorityService();
      const transparencyReviewer = await resolveNativeVerificationActor(
        clientA,
        memberIds[0],
        "verifier",
      );
      const transparencyPublisher = await resolveNativeVerificationActor(
        clientA,
        memberIds[2],
        "admin",
      );
      assert.equal(proofRecordLeft.contributorIds.includes(transparencyReviewer.id), false);
      assert.equal(proofRecordLeft.contributorIds.includes(transparencyPublisher.id), false);
      const transparencySource = {
        record: proofRecordLeft,
        governedRecordProjection: issuedProofRecordProjection,
        lifecycleBinding,
        lifecycleProjection: activeLifecycleLeft,
        signatureReceipt,
      };
      const resolveTransparencySource: CanopyProofPublicTransparencySourceResolver = async (
        query,
        transaction,
      ) => ({
        record: proofRecordLeft,
        governedRecordProjection: await serviceA.getEnvironmentalProofRecordStatusInTransaction(
          transaction,
          query.recordId,
          query.organizationId,
        ),
        lifecycleBinding,
        lifecycleProjection: await lifecycleRepositoryA.projectLifecycleInTransaction(
          transaction,
          query.organizationId,
          lifecycleBinding.id,
          query.evaluatedAt,
        ),
        signatureReceipt,
      });
      const publicDisclosureReview = transparencyAuthority.reviewDisclosure(
        {
          organizationId,
          projectId,
          recordId: proofRecordLeft.id,
          expectedRecordRoot: proofRecordLeft.recordRoot,
          expectedLifecycleProjectionRoot: activeLifecycleLeft.projectionRoot,
          classification: "public",
          locationDisclosure: "region",
          areaDisclosure: "band",
          reasonCodes: [
            "community_safety_reviewed",
            "data_rights_reviewed",
            "habitat_sensitivity_reviewed",
            "location_minimized",
            "personal_data_excluded",
          ],
          limitationHashes: [hashJson({ kind: "native-public-transparency-limitation", runId })],
          reviewedAt: timestamp(39.49),
        },
        { reviewer: transparencyReviewer, source: transparencySource },
      );
      const [publicReviewLeft, publicReviewRight] = await Promise.all([
        transparencyRepositoryA.commitReview(
          publicDisclosureReview,
          `native-public-transparency-review-${runId}`,
          resolveTransparencySource,
        ),
        transparencyRepositoryB.commitReview(
          publicDisclosureReview,
          `native-public-transparency-review-${runId}`,
          resolveTransparencySource,
        ),
      ]);
      assert.equal(publicReviewLeft.reviewRoot, publicDisclosureReview.reviewRoot);
      assert.equal(publicReviewRight.reviewRoot, publicDisclosureReview.reviewRoot);
      const publicationLifecycle = await lifecycleRepositoryA.projectLifecycle(
        organizationId,
        lifecycleBinding.id,
        timestamp(39.491),
      );
      const publicationSource = {
        ...transparencySource,
        lifecycleProjection: publicationLifecycle,
      };
      const publicTransparencyPublication = transparencyAuthority.publish(
        {
          reviewId: publicDisclosureReview.id,
          expectedReviewRoot: publicDisclosureReview.reviewRoot,
          expectedLifecycleProjectionRoot: publicationLifecycle.projectionRoot,
          publishedAt: timestamp(39.491),
        },
        { publisher: transparencyPublisher, source: publicationSource },
      );
      const [publicPublicationLeft, publicPublicationRight] = await Promise.all([
        transparencyRepositoryA.commitPublication(
          publicTransparencyPublication,
          `native-public-transparency-publication-${runId}`,
          resolveTransparencySource,
        ),
        transparencyRepositoryB.commitPublication(
          publicTransparencyPublication,
          `native-public-transparency-publication-${runId}`,
          resolveTransparencySource,
        ),
      ]);
      assert.equal(publicPublicationLeft.publicationRoot, publicTransparencyPublication.publicationRoot);
      assert.equal(publicPublicationRight.publicationRoot, publicTransparencyPublication.publicationRoot);
      const publicTransparencyCounts = await clientA.$queryRaw<Array<{
        review_count: bigint;
        publication_count: bigint;
        receipt_count: bigint;
        review_root: string;
        publication_root: string;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM transparency.public_disclosure_review_facts
            WHERE id = ${publicDisclosureReview.id}) AS review_count,
          (SELECT count(*) FROM transparency.public_transparency_publication_facts
            WHERE id = ${publicTransparencyPublication.id}) AS publication_count,
          (SELECT count(*) FROM audit.command_receipts
            WHERE result_entity_id IN (${publicDisclosureReview.id}, ${publicTransparencyPublication.id}))
            AS receipt_count,
          transparency.public_disclosure_review_root(review.fact_record) AS review_root,
          transparency.public_transparency_publication_root(publication.fact_record) AS publication_root
        FROM transparency.public_disclosure_review_facts review
        JOIN transparency.public_transparency_publication_facts publication
          ON publication.review_id = review.id
        WHERE review.id = ${publicDisclosureReview.id}
      `);
      assert.deepEqual(publicTransparencyCounts[0], {
        review_count: 1n,
        publication_count: 1n,
        receipt_count: 2n,
        review_root: publicDisclosureReview.reviewRoot,
        publication_root: publicTransparencyPublication.publicationRoot,
      });
      const activePublicTransparency = await transparencyRepositoryA.projectPublication(
        organizationId,
        publicTransparencyPublication.id,
        timestamp(39.491),
        resolveTransparencySource,
      );
      assert.equal(activePublicTransparency.state, "active");
      assert.equal("latitude" in activePublicTransparency.location, false);
      const publicExplorer = new PrismaCanopyProofPublicExplorerRepository(
        clientA,
        createCanopyProofPublicExplorerSourceResolver({
          trustRegistry: serviceA,
          lifecycleRepository: lifecycleRepositoryA,
        }),
      );
      const activeExplorerProjection = await publicExplorer.getProject(
        activePublicTransparency.publicProjectId,
        timestamp(39.491),
      );
      const activeExplorerResponse = serializeCanopyProofPublicExplorerProject(
        activeExplorerProjection,
      );
      assert.equal(activeExplorerResponse.project.state, "active");
      assert.equal(
        activeExplorerResponse.project.publicProjectId,
        publicTransparencyPublication.publicProjectId,
      );
      assert.equal(activeExplorerResponse.lineage.projectionRoot, activePublicTransparency.projectionRoot);
      assert.equal(JSON.stringify(activeExplorerResponse).includes(organizationId), false);
      assert.equal(JSON.stringify(activeExplorerResponse).includes(projectId), false);
      const explorerLocator = await clientA.$queryRaw<Array<{
        publication_id: string;
        id: string;
        public_project_id: string;
        organization_id: string;
      }>>(Prisma.sql`
        SELECT publication_id, id, public_project_id, organization_id
        FROM transparency.public_transparency_query_catalog
        WHERE publication_id = ${publicTransparencyPublication.id}
      `);
      assert.deepEqual(explorerLocator, [{
        publication_id: publicTransparencyPublication.id,
        id: publicTransparencyPublication.id,
        public_project_id: publicTransparencyPublication.publicProjectId,
        organization_id: organizationId,
      }]);
      await clientA.$executeRaw(Prisma.sql`CREATE ROLE canopyproof_transparency_rls_reader NOLOGIN NOBYPASSRLS`);
      await clientA.$executeRaw(
        Prisma.sql`GRANT USAGE ON SCHEMA transparency TO canopyproof_transparency_rls_reader`,
      );
      await clientA.$executeRaw(
        Prisma.sql`GRANT SELECT ON transparency.public_transparency_publication_facts TO canopyproof_transparency_rls_reader`,
      );
      await clientA.$transaction(async (transaction) => {
        await transaction.$executeRaw(Prisma.sql`SET LOCAL ROLE canopyproof_transparency_rls_reader`);
        await transaction.$queryRaw(
          Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
        );
        const ownTenant = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM transparency.public_transparency_publication_facts
          WHERE id = ${publicTransparencyPublication.id}
        `);
        assert.equal(Number(ownTenant[0]?.count ?? -1n), 1);
        await transaction.$queryRaw(
          Prisma.sql`SELECT set_config('app.organization_id', 'native-cross-tenant-probe', true)`,
        );
        const otherTenant = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM transparency.public_transparency_publication_facts
          WHERE id = ${publicTransparencyPublication.id}
        `);
        assert.equal(Number(otherTenant[0]?.count ?? -1n), 0);
      });
      await assert.rejects(
        clientA.$transaction(async (transaction) => {
          await transaction.$executeRaw(Prisma.sql`SET LOCAL ROLE canopyproof_transparency_rls_reader`);
          await transaction.$queryRaw(Prisma.sql`
            SELECT publication_id
            FROM transparency.public_transparency_query_catalog
            WHERE publication_id = ${publicTransparencyPublication.id}
          `);
        }),
        /permission denied/i,
      );
      await assert.rejects(
        clientA.$transaction(async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
          );
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.actor_id', ${transparencyPublisher.id}, true)`,
          );
          await transaction.$executeRaw(Prisma.sql`
            UPDATE transparency.public_transparency_publication_facts
            SET public_project_id = public_project_id
            WHERE id = ${publicTransparencyPublication.id}
          `);
        }),
        /CANOPYPROOF_PUBLIC_TRANSPARENCY_APPEND_ONLY_VIOLATION/,
      );

      const reportingOrganizationRows = await clientA.$queryRaw<Array<{
        id: string;
        name: string;
        verification_status: "verified";
        organization_root: string;
      }>>(Prisma.sql`
        SELECT id, COALESCE(name, legal_name) AS name,
          verification_status, profile_hash AS organization_root
        FROM organizations.organizations WHERE id = ${organizationId}
      `);
      const reportingOrganization = reportingOrganizationRows[0];
      assert.ok(reportingOrganization);
      const reportingAuthority = new CanopyProofCanonicalEsgReportingAuthorityService();
      const reportingSource = {
        record: proofRecordLeft,
        governedRecordProjection: issuedProofRecordProjection,
        lifecycleBinding,
        lifecycleProjection: activeLifecycleLeft,
        signatureReceipt,
      };
      const reportingRepositoryA = new PrismaCanopyProofCanonicalEsgReportingRepository(clientA);
      const reportingRepositoryB = new PrismaCanopyProofCanonicalEsgReportingRepository(clientB);

      const metricMethodology = await serviceA.getCurrentMethodologyPublicationBundle(
        proofMethodologyLeft.id,
        organizationId,
      );
      const metricMethodologyProjectionSeed = {
        methodologyId: metricMethodology.methodology.id,
        publicationId: metricMethodology.publication.id,
        publicationRoot: metricMethodology.publication.publicationRoot,
        state: "published" as const,
        successorPublicationId: null,
        successorPublicationRoot: null,
      };
      const metricMethodologyProjection = {
        methodologyId: metricMethodologyProjectionSeed.methodologyId,
        publicationId: metricMethodologyProjectionSeed.publicationId,
        publicationRoot: metricMethodologyProjectionSeed.publicationRoot,
        state: metricMethodologyProjectionSeed.state,
        projectionRoot: hashJson({
          kind: "canopyproof-methodology-publication-projection-v1",
          ...metricMethodologyProjectionSeed,
        }),
        safety: metricMethodology.publication.safety,
      };
      const metricDefinitionReviewers = [
        await resolveNativeVerificationActor(clientA, finalVerifierId, "verifier"),
        await resolveNativeVerificationActor(clientA, methodologyResearcherId, "researcher"),
      ];
      const metricCalculator = await resolveNativeVerificationActor(clientA, proofIssuerId, "admin");
      const metricReviewer = await resolveNativeVerificationActor(clientA, finalVerifierId, "verifier");
      const metricAuthority = new CanopyProofEsgMetricAuthorityService();
      const metricDefinition = metricAuthority.publishDefinition(
        {
          organizationId,
          slug: `native_tree_survival_${runId}`,
          version: "v1.0.0",
          title: "Native verified tree survival rate",
          description:
            "Project-level survival percentage derived only from current signed Environmental Proof and reviewed MRV authority.",
          dimension: "percentage",
          canonicalUnit: "percent",
          allowedUnits: ["percent"],
          precisionScale: 2,
          valueDomain: "non_negative",
          roundingMode: "half_even",
          aggregationMethod: "weighted_mean",
          spatialAggregation: "project",
          temporalAggregation: "period_end",
          sourceRequirements: [
            "active_signed_lifecycle",
            "current_environmental_proof",
            "reviewed_mrv",
          ],
          uncertaintyPolicy: {
            method: "confidence_interval",
            allowNotQuantified: false,
            requiredComponents: ["measurement_error", "sampling_error"],
          },
          frameworkMappings: [
            {
              framework: "TNFD",
              disclosureCode: "metrics-and-targets",
              rationale:
                "Prepares a bounded survival metric for independent nature-related disclosure mapping review.",
              limitations: ["This mapping is preparation only and is not an assurance opinion."],
            },
          ],
          methodologyPublicationId: metricMethodology.publication.id,
          limitations: [
            "The value is bounded to current signed source authority and may be challenged or superseded.",
          ],
          effectiveAt: timestamp(39.47),
        },
        {
          organization: {
            id: reportingOrganization.id,
            name: reportingOrganization.name,
            verificationStatus: reportingOrganization.verification_status,
            organizationRoot: reportingOrganization.organization_root,
          },
          publisher: proofRecordLeft.issuer,
          reviewers: metricDefinitionReviewers,
          methodology: metricMethodology,
          methodologyProjection: metricMethodologyProjection,
        },
      );
      const metricDefinitionProjection = metricAuthority.projectDefinition(
        metricDefinition.id,
        metricMethodologyProjection,
        timestamp(39.49),
      );
      const metricResultBundle = metricAuthority.recordResult(
        {
          organizationId,
          projectId,
          definitionId: metricDefinition.id,
          sourceRecordIds: [proofRecordLeft.id],
          reportingPeriod: { startsAt: timestamp(35), endsAt: timestamp(39.49) },
          observationPeriod: { startsAt: timestamp(39.4), endsAt: timestamp(39.48) },
          valueState: "reported",
          decimalValue: "93.2",
          unit: "percent",
          uncertainty: {
            kind: "interval",
            lower: "90",
            upper: "95",
            confidenceLevelPct: 95,
            components: ["measurement_error", "sampling_error"],
          },
          calculationArtifactHash: hashJson({
            kind: "native-esg-metric-calculation",
            runId,
            recordRoot: proofRecordLeft.recordRoot,
          }),
          reviewRationale:
            "Independent accredited review accepts the exact decimal result and bounded uncertainty source graph.",
          limitations: [
            "No assurance, credit, offset, financial instrument, or guaranteed outcome is created.",
          ],
          calculatedAt: timestamp(39.48),
          reviewedAt: timestamp(39.49),
        },
        {
          definition: metricDefinition,
          definitionProjection: metricDefinitionProjection,
          calculator: metricCalculator,
          reviewer: metricReviewer,
          sources: [reportingSource],
        },
      );
      const metricRepositoryA = new PrismaCanopyProofEsgMetricRepository(clientA);
      const metricRepositoryB = new PrismaCanopyProofEsgMetricRepository(clientB);
      const metricDefinitionKey = `native-esg-metric-definition-${runId}`;
      const [metricDefinitionLeft, metricDefinitionRight] = await Promise.all([
        metricRepositoryA.commitDefinition(metricDefinition, metricDefinitionKey),
        metricRepositoryB.commitDefinition(metricDefinition, metricDefinitionKey),
      ]);
      assert.equal(metricDefinitionLeft.definitionRoot, metricDefinition.definitionRoot);
      assert.equal(metricDefinitionRight.definitionRoot, metricDefinition.definitionRoot);
      assert.equal(
        await countRows(clientA, "reporting.esg_metric_definition_facts", "id", metricDefinition.id),
        1,
      );
      const metricResultKey = `native-esg-metric-result-${runId}`;
      const [metricResultLeft, metricResultRight] = await Promise.all([
        metricRepositoryA.commitResult(metricResultBundle, metricResultKey),
        metricRepositoryB.commitResult(metricResultBundle, metricResultKey),
      ]);
      assert.equal(metricResultLeft.result.resultRoot, metricResultBundle.result.resultRoot);
      assert.equal(metricResultRight.result.resultRoot, metricResultBundle.result.resultRoot);
      assert.equal(
        await countRows(clientA, "reporting.esg_metric_result_facts", "id", metricResultBundle.result.id),
        1,
      );
      assert.deepEqual(
        await metricRepositoryA.projectDefinition(organizationId, metricDefinition.id, timestamp(39.49)),
        metricDefinitionProjection,
      );
      const metricResultProjection = metricAuthority.projectResult(
        metricResultBundle.result.id,
        metricDefinitionProjection,
        [reportingSource],
        timestamp(39.49),
      );
      assert.deepEqual(
        await metricRepositoryA.projectResult(organizationId, metricResultBundle.result.id, timestamp(39.49)),
        metricResultProjection,
      );
      await assert.rejects(
        metricRepositoryB.getResult(proofChallengerOrganizationId, metricResultBundle.result.id),
        /ORGANIZATION_SCOPE_MISMATCH|result not found/,
      );

      const reportingBundle = reportingAuthority.publishReport(
        {
          organizationId,
          projectId,
          sourceRecordIds: [proofRecordLeft.id],
          metricResultIds: [metricResultBundle.result.id],
          reportingPeriod: {
            startsAt: timestamp(35),
            endsAt: timestamp(39.48),
          },
          frameworks: ["TNFD", "SDG", "GRI"],
          materialTopics: ["Biodiversity condition", "Restoration monitoring"],
          generatedAt: timestamp(39.49),
        },
        {
          organization: {
            id: reportingOrganization.id,
            name: reportingOrganization.name,
            verificationStatus: reportingOrganization.verification_status,
            organizationRoot: reportingOrganization.organization_root,
          },
          publisher: proofRecordLeft.issuer,
          sources: [reportingSource],
          metrics: [{ result: metricResultBundle.result, projection: metricResultProjection }],
        },
      );
      const reportingIdempotencyKey = `native-canonical-esg-report-${runId}`;
      const [reportingLeft, reportingRight] = await Promise.all([
        reportingRepositoryA.commitReport(reportingBundle, reportingIdempotencyKey),
        reportingRepositoryB.commitReport(reportingBundle, reportingIdempotencyKey),
      ]);
      assert.equal(reportingLeft.report.reportRoot, reportingBundle.report.reportRoot);
      assert.equal(reportingRight.report.reportRoot, reportingBundle.report.reportRoot);
      assert.equal(
        await countRows(
          clientA,
          "reporting.canonical_esg_report_facts",
          "id",
          reportingBundle.report.id,
        ),
        1,
      );
      assert.equal(
        await countRows(
          clientA,
          "reporting.canonical_esg_report_metric_member_facts",
          "report_id",
          reportingBundle.report.id,
        ),
        1,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          proofRecordLeft.issuer.id,
          "canonical-esg-report.commit",
          reportingBundle.report.id,
        ),
        1,
      );
      const currentReportingProjection = await reportingRepositoryA.projectReport(
        organizationId,
        reportingBundle.report.id,
        timestamp(39.49),
      );
      assert.deepEqual(
        currentReportingProjection,
        reportingAuthority.projectReport(
          reportingBundle.report.id,
          [reportingSource],
          [metricResultProjection],
          timestamp(39.49),
        ),
      );
      await assert.rejects(
        reportingRepositoryB.projectReport(
          proofChallengerOrganizationId,
          reportingBundle.report.id,
          timestamp(39.49),
        ),
        /ORGANIZATION_SCOPE_MISMATCH|PROJECTION_CARDINALITY_INVALID|No rows/,
      );

      const proofChallengeInput = {
        reason: "monitoring_contradiction",
        severity: "high",
        rationale:
          "Independent external observation contradicts the monitoring basis and requires governed record review.",
        supportingArtifactHashes: [hashJson({ kind: "native-environmental-proof-challenge-artifact", runId })],
        sourceEventRoots: [proofRecordLeft.auditEvent.eventRoot],
        openedAt: timestamp(39.5),
      } as const;
      const [proofChallengeLeft, proofChallengeRight] = await Promise.all([
        serviceA.openEnvironmentalProofChallenge(
          proofRecordLeft.id,
          proofChallengeInput,
          proofChallengerOrganizationId,
          proofChallengerId,
          "researcher",
          `native-environmental-proof-challenge-${runId}`,
        ),
        serviceB.openEnvironmentalProofChallenge(
          proofRecordLeft.id,
          proofChallengeInput,
          proofChallengerOrganizationId,
          proofChallengerId,
          "researcher",
          `native-environmental-proof-challenge-${runId}`,
        ),
      ]);
      assert.equal(proofChallengeLeft.challenge.challengeRoot, proofChallengeRight.challenge.challengeRoot);
      assert.equal(proofChallengeLeft.riskSignal.riskRoot, proofChallengeRight.riskSignal.riskRoot);
      assert.equal(
        (await serviceA.getEnvironmentalProofRecordStatus(proofRecordLeft.id, organizationId)).state,
        "challenged",
      );
      const challengedLifecycle = await lifecycleRepositoryA.projectLifecycle(
        organizationId,
        lifecycleBinding.id,
        timestamp(39.51),
      );
      assert.equal(challengedLifecycle.state, "challenged");
      assert.ok(challengedLifecycle.issueCodes.includes("record_challenged"));
      const challengedPublicTransparency = await transparencyRepositoryA.projectPublication(
        organizationId,
        publicTransparencyPublication.id,
        timestamp(39.51),
        resolveTransparencySource,
      );
      assert.equal(challengedPublicTransparency.state, "challenged");
      assert.equal(challengedPublicTransparency.challenge.state, "open");
      assert.equal(challengedPublicTransparency.challenge.root, proofChallengeLeft.challenge.challengeRoot);
      const challengedExplorerResponse = serializeCanopyProofPublicExplorerProject(
        await publicExplorer.getProject(
          publicTransparencyPublication.publicProjectId,
          timestamp(39.51),
        ),
      );
      assert.equal(challengedExplorerResponse.project.state, "challenged");
      assert.equal(challengedExplorerResponse.project.challenge.state, "open");
      assert.equal(
        challengedExplorerResponse.project.challenge.root,
        proofChallengeLeft.challenge.challengeRoot,
      );
      assert.notEqual(
        challengedExplorerResponse.lineage.projectionRoot,
        activeExplorerResponse.lineage.projectionRoot,
      );
      const challengedReportingProjection = await reportingRepositoryA.projectReport(
        organizationId,
        reportingBundle.report.id,
        timestamp(39.51),
      );
      assert.equal(challengedReportingProjection.state, "challenged");
      assert.ok(
        challengedReportingProjection.issueCodes.includes(`source_not_current:${proofRecordLeft.id}`),
      );
      await assert.rejects(
        serviceA.getEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengerOrganizationId,
        ),
        /organization scope mismatch/,
      );

      const proofChallengeVerifierReviewInput = {
        decision: "uphold",
        rationale:
          "Independent accredited verifier confirms the contradiction materially invalidates current reliance.",
        conflictDisclosure:
          "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
        limitations: ["This review concerns only the immutable Environmental Proof Record."],
        sourceEventRoots: [
          proofChallengeLeft.challenge.auditEvent.eventRoot,
          proofChallengeLeft.riskSignal.auditEvent.eventRoot,
        ],
        reviewedAt: timestamp(39.6),
      } as const;
      const [proofChallengeVerifierReviewLeft, proofChallengeVerifierReviewRight] = await Promise.all([
        serviceA.reviewEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengeVerifierReviewInput,
          organizationId,
          challengeResolutionVerifierId,
          "verifier",
          `native-environmental-proof-challenge-verifier-review-${runId}`,
        ),
        serviceB.reviewEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengeVerifierReviewInput,
          organizationId,
          challengeResolutionVerifierId,
          "verifier",
          `native-environmental-proof-challenge-verifier-review-${runId}`,
        ),
      ]);
      assert.equal(proofChallengeVerifierReviewLeft.reviewRoot, proofChallengeVerifierReviewRight.reviewRoot);
      const proofChallengeOwnerReviewInput = {
        decision: "uphold",
        rationale:
          "Independent owner reviewer concurs after reviewing the exact challenge and risk authority roots.",
        conflictDisclosure:
          "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
        limitations: ["The review grants no credit, tax, token, funding, title, or financial authority."],
        sourceEventRoots: [
          proofChallengeLeft.challenge.auditEvent.eventRoot,
          proofChallengeLeft.riskSignal.auditEvent.eventRoot,
          proofChallengeVerifierReviewLeft.auditEvent.eventRoot,
        ],
        reviewedAt: timestamp(39.7),
      } as const;
      const [proofChallengeOwnerReviewLeft, proofChallengeOwnerReviewRight] = await Promise.all([
        serviceA.reviewEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengeOwnerReviewInput,
          organizationId,
          proofChallengeOwnerReviewerId,
          "owner",
          `native-environmental-proof-challenge-owner-review-${runId}`,
        ),
        serviceB.reviewEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengeOwnerReviewInput,
          organizationId,
          proofChallengeOwnerReviewerId,
          "owner",
          `native-environmental-proof-challenge-owner-review-${runId}`,
        ),
      ]);
      assert.equal(proofChallengeOwnerReviewLeft.reviewRoot, proofChallengeOwnerReviewRight.reviewRoot);
      const proofChallengeResolutionInput = {
        reviewIds: [proofChallengeOwnerReviewLeft.id, proofChallengeVerifierReviewLeft.id],
        decision: "uphold",
        rationale:
          "Independent resolver upholds the unanimous human quorum and revokes current reliance without rewriting issuance.",
        limitations: [
          "Revocation is an accountability state and creates no transferable or financial entitlement.",
        ],
        sourceEventRoots: [
          proofChallengeLeft.challenge.auditEvent.eventRoot,
          proofChallengeLeft.riskSignal.auditEvent.eventRoot,
          proofChallengeVerifierReviewLeft.auditEvent.eventRoot,
          proofChallengeOwnerReviewLeft.auditEvent.eventRoot,
        ],
        resolvedAt: timestamp(39.8),
      } as const;
      const [proofChallengeResolutionLeft, proofChallengeResolutionRight] = await Promise.all([
        serviceA.resolveEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengeResolutionInput,
          organizationId,
          proofChallengeResolverId,
          "owner",
          `native-environmental-proof-challenge-resolution-${runId}`,
        ),
        serviceB.resolveEnvironmentalProofChallenge(
          proofChallengeLeft.challenge.id,
          proofChallengeResolutionInput,
          organizationId,
          proofChallengeResolverId,
          "owner",
          `native-environmental-proof-challenge-resolution-${runId}`,
        ),
      ]);
      assert.equal(proofChallengeResolutionLeft.resolutionRoot, proofChallengeResolutionRight.resolutionRoot);
      assert.equal((await serviceA.getEnvironmentalProofRecordStatus(proofRecordLeft.id, organizationId)).state, "revoked");
      const proofFactCounts = await clientA.$queryRaw<Array<{
        candidate_count: bigint;
        approval_count: bigint;
        record_count: bigint;
        challenge_count: bigint;
        risk_count: bigint;
        review_count: bigint;
        resolution_count: bigint;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM certificates.environmental_proof_candidates WHERE id = ${proofCandidateLeft.id}) AS candidate_count,
          (SELECT count(*) FROM governance.environmental_proof_candidate_approvals WHERE candidate_id = ${proofCandidateLeft.id}) AS approval_count,
          (SELECT count(*) FROM certificates.environmental_proof_record_facts WHERE id = ${proofRecordLeft.id}) AS record_count,
          (SELECT count(*) FROM certificates.environmental_proof_challenges WHERE id = ${proofChallengeLeft.challenge.id}) AS challenge_count,
          (SELECT count(*) FROM certificates.environmental_proof_challenge_risk_signals WHERE challenge_id = ${proofChallengeLeft.challenge.id}) AS risk_count,
          (SELECT count(*) FROM governance.environmental_proof_challenge_reviews WHERE challenge_id = ${proofChallengeLeft.challenge.id}) AS review_count,
          (SELECT count(*) FROM governance.environmental_proof_challenge_resolutions WHERE challenge_id = ${proofChallengeLeft.challenge.id}) AS resolution_count
      `);
      assert.equal(Number(proofFactCounts[0]?.candidate_count), 1);
      assert.equal(Number(proofFactCounts[0]?.approval_count), 2);
      assert.equal(Number(proofFactCounts[0]?.record_count), 1);
      assert.equal(Number(proofFactCounts[0]?.challenge_count), 1);
      assert.equal(Number(proofFactCounts[0]?.risk_count), 1);
      assert.equal(Number(proofFactCounts[0]?.review_count), 2);
      assert.equal(Number(proofFactCounts[0]?.resolution_count), 1);
      await assert.rejects(
        clientA.$transaction(async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.actor_id', ${proofChallengeResolverId}, true)`,
          );
          await transaction.$executeRaw(Prisma.sql`
            UPDATE governance.environmental_proof_challenge_resolutions
            SET decision = 'uphold'
            WHERE id = ${proofChallengeResolutionLeft.id}
          `);
        }),
        /append-only/,
      );

      const challengeInput = {
        reason: "satellite_contradiction",
        severity: "high",
        rationale: "Native concurrent challenge commits a later contradiction against bounded approved reliance.",
        supportingArtifactHashes: [hashJson({ kind: "native-evidence-challenge-artifact", runId })],
        evidenceEventRoots: [
          evidenceLeft.evidence.audit_history[0].eventRoot,
          finalDecisionLeft.auditEvent.eventRoot,
        ].sort(),
        challengedAt: timestamp(40),
      } as const;
      const [challengeLeft, challengeRight] = await Promise.all([
        serviceA.openEvidenceChallenge(
          projectEvidenceId,
          challengeInput,
          memberIds[3],
          "owner",
          organizationId,
          `native-evidence-challenge-${runId}`,
        ),
        serviceB.openEvidenceChallenge(
          projectEvidenceId,
          challengeInput,
          memberIds[3],
          "owner",
          organizationId,
          `native-evidence-challenge-${runId}`,
        ),
      ]);
      assert.equal(challengeLeft.challengeRoot, challengeRight.challengeRoot);
      assert.equal((await serviceA.getEvidenceReliance(projectEvidenceId, organizationId)).state, "challenged");
      assert.equal((await serviceA.getEvidenceFinalVerification(projectEvidenceId, organizationId)).state, "stale");
      const resolutionInput = {
        decision: "upheld",
        rationale: "Native independent accredited resolution upholds the contradiction and requires correction.",
        limitations: ["Resolution affects bounded evidence reliance only."],
        evidenceEventRoots: [challengeLeft.auditEvent.eventRoot],
        reviewedAt: timestamp(41),
      } as const;
      const [resolutionLeft, resolutionRight] = await Promise.all([
        serviceA.resolveEvidenceChallenge(
          challengeLeft.id,
          resolutionInput,
          challengeResolutionVerifierId,
          "verifier",
          `native-evidence-challenge-resolution-${runId}`,
        ),
        serviceB.resolveEvidenceChallenge(
          challengeLeft.id,
          resolutionInput,
          challengeResolutionVerifierId,
          "verifier",
          `native-evidence-challenge-resolution-${runId}`,
        ),
      ]);
      assert.equal(resolutionLeft.resolutionRoot, resolutionRight.resolutionRoot);
      assert.equal((await serviceA.getEvidenceReliance(projectEvidenceId, organizationId)).state, "correction_required");
      const correctionInput = {
        action: "withdraw",
        rationale: "Native independent administration withdraws reliance while preserving all committed facts.",
        evidenceEventRoots: [resolutionLeft.auditEvent.eventRoot],
        correctedAt: timestamp(42),
      } as const;
      const [correctionLeft, correctionRight] = await Promise.all([
        serviceA.recordEvidenceCorrection(
          resolutionLeft.id,
          correctionInput,
          memberIds[2],
          "admin",
          `native-evidence-correction-${runId}`,
        ),
        serviceB.recordEvidenceCorrection(
          resolutionLeft.id,
          correctionInput,
          memberIds[2],
          "admin",
          `native-evidence-correction-${runId}`,
        ),
      ]);
      assert.equal(correctionLeft.correctionRoot, correctionRight.correctionRoot);
      assert.equal((await serviceA.getEvidenceReliance(projectEvidenceId, organizationId)).state, "withdrawn");
      const verificationFactCounts = await clientA.$queryRaw<Array<{
        validation_count: bigint;
        analysis_count: bigint;
        review_count: bigint;
        challenge_count: bigint;
        resolution_count: bigint;
        correction_count: bigint;
        final_decision_count: bigint;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM verification.evidence_validation_runs WHERE evidence_id = ${projectEvidenceId}) AS validation_count,
          (SELECT count(*) FROM verification.evidence_ai_analyses WHERE evidence_id = ${projectEvidenceId}) AS analysis_count,
          (SELECT count(*) FROM verification.evidence_human_reviews WHERE evidence_id = ${projectEvidenceId}) AS review_count,
          (SELECT count(*) FROM verification.evidence_challenges WHERE evidence_id = ${projectEvidenceId}) AS challenge_count,
          (SELECT count(*) FROM verification.evidence_challenge_resolutions WHERE evidence_id = ${projectEvidenceId}) AS resolution_count,
          (SELECT count(*) FROM verification.evidence_corrections WHERE evidence_id = ${projectEvidenceId}) AS correction_count,
          (SELECT count(*) FROM verification.evidence_final_decisions WHERE evidence_id = ${projectEvidenceId}) AS final_decision_count
      `);
      assert.equal(Number(verificationFactCounts[0]?.validation_count), 1);
      assert.equal(Number(verificationFactCounts[0]?.analysis_count), 1);
      assert.equal(Number(verificationFactCounts[0]?.review_count), 1);
      assert.equal(Number(verificationFactCounts[0]?.challenge_count), 1);
      assert.equal(Number(verificationFactCounts[0]?.resolution_count), 1);
      assert.equal(Number(verificationFactCounts[0]?.correction_count), 1);
      assert.equal(Number(verificationFactCounts[0]?.final_decision_count), 1);
      await clientA.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${memberIds[0]}, true)`);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO satellite.observations (
            id, project_id, provider, layer_type, acquired_at, source_uri,
            observation_hash, contradiction_status
          ) VALUES (
            ${projectSceneId}, ${projectId}, 'sentinel', 'ndvi', ${new Date(timestamp(35))},
            'https://example.invalid/native-project-scene',
            ${hashJson({ kind: "native-project-scene-v1", runId })}, 'neutral'
          )
        `);
      });
      const monitoringInput = {
        eventType: "terra_scene_review",
        observedAt: timestamp(43),
        evidenceIds: [projectEvidenceId],
        terraSceneIds: [projectSceneId],
        biodiversityIndicators: ["native species mix"],
        waterIndicators: ["soil moisture recovery"],
        climateRiskIndicators: ["drought exposure"],
        metrics: { ndviMean: 0.64, survivalPercent: 91 },
        state: "accepted",
        rationale: "Native monitoring binds prior same-project evidence and satellite authority.",
      } as const;
      const [monitoringLeft, monitoringRight] = await Promise.all([
        serviceA.recordProjectMonitoringEvent(
          projectId,
          monitoringInput,
          memberIds[0],
          "verifier",
          `native-project-monitoring-${runId}`,
        ),
        serviceB.recordProjectMonitoringEvent(
          projectId,
          monitoringInput,
          memberIds[0],
          "verifier",
          `native-project-monitoring-${runId}`,
        ),
      ]);
      assert.equal(monitoringLeft.monitoringRoot, monitoringRight.monitoringRoot);
      assert.equal(await countRows(clientA, "projects.monitoring_events", "id", monitoringLeft.id), 1);
      assert.equal(await countRows(clientA, "audit.domain_events", "stream_id", projectId), 5);

      const evidenceCustodySubjectId = memberIds[1];
      const evidenceCustodyFingerprintHash = hashJson({ kind: "native-evidence-custody-device", runId });
      const evidenceConsentInput = {
        subjectId: evidenceCustodySubjectId,
        deviceFingerprintHash: evidenceCustodyFingerprintHash,
        purposes: ["media_upload", "evidence_collection", "geolocation"],
        lawfulBasis: "consent",
        privacyMode: "restricted",
        policyVersion: "native-evidence-consent-v1",
        evidenceHash: hashJson({ kind: "native-evidence-consent", runId }),
        grantedAt: timestamp(50),
        expiresAt: timestamp(1_000),
        retentionDays: 365,
      } as const;
      const [evidenceConsentLeft, evidenceConsentRight] = await Promise.all([
        serviceA.recordEvidenceConsentReceipt(
          evidenceConsentInput,
          organizationId,
          evidenceCustodySubjectId,
          "researcher",
          `native-evidence-consent-${runId}`,
        ),
        serviceB.recordEvidenceConsentReceipt(
          evidenceConsentInput,
          organizationId,
          evidenceCustodySubjectId,
          "researcher",
          `native-evidence-consent-${runId}`,
        ),
      ]);
      assert.equal(evidenceConsentLeft.receiptRoot, evidenceConsentRight.receiptRoot);
      const evidenceDeviceInput = {
        subjectId: evidenceCustodySubjectId,
        consentReceiptId: evidenceConsentLeft.id,
        deviceFingerprintHash: evidenceCustodyFingerprintHash,
        attestationType: "webauthn",
        provider: "webauthn",
        providerKeyId: `native-webauthn-${runId}`,
        providerReceiptHash: hashJson({ kind: "native-provider-receipt", runId }),
        providerVerificationState: "modeled_only",
        publicKeyHash: hashJson({ kind: "native-provider-public-key", runId }),
        attestationHash: hashJson({ kind: "native-device-attestation", runId }),
        issuedAt: timestamp(51),
        expiresAt: timestamp(900),
        reputationScore: 75,
        riskFlags: [],
      } as const;
      const [evidenceDeviceLeft, evidenceDeviceRight] = await Promise.all([
        serviceA.recordEvidenceDeviceAttestation(
          evidenceDeviceInput,
          organizationId,
          evidenceCustodySubjectId,
          "researcher",
          `native-evidence-device-${runId}`,
        ),
        serviceB.recordEvidenceDeviceAttestation(
          evidenceDeviceInput,
          organizationId,
          evidenceCustodySubjectId,
          "researcher",
          `native-evidence-device-${runId}`,
        ),
      ]);
      assert.equal(evidenceDeviceLeft.attestationRoot, evidenceDeviceRight.attestationRoot);
      const evidenceRevocationInput = {
        reason: "The native test subject withdrew all future evidence collection consent.",
        revokedAt: timestamp(52),
      } as const;
      const [evidenceRevocationLeft, evidenceRevocationRight] = await Promise.all([
        serviceA.revokeEvidenceConsentReceipt(
          evidenceConsentLeft.id,
          evidenceRevocationInput,
          organizationId,
          evidenceCustodySubjectId,
          "researcher",
          `native-evidence-revocation-${runId}`,
        ),
        serviceB.revokeEvidenceConsentReceipt(
          evidenceConsentLeft.id,
          evidenceRevocationInput,
          organizationId,
          evidenceCustodySubjectId,
          "researcher",
          `native-evidence-revocation-${runId}`,
        ),
      ]);
      assert.equal(evidenceRevocationLeft.revocationRoot, evidenceRevocationRight.revocationRoot);
      assert.equal(
        (
          await serviceA.getEvidenceDeviceAttestationProjection(
            evidenceDeviceLeft.id,
            organizationId,
            timestamp(53),
          )
        ).state,
        "consent_revoked",
      );
      const evidenceCustodyCounts = await clientA.$queryRaw<Array<{
        receipt_count: bigint;
        revocation_count: bigint;
        device_count: bigint;
        event_count: bigint;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM evidence.consent_receipts WHERE id = ${evidenceConsentLeft.id}) AS receipt_count,
          (SELECT count(*) FROM evidence.consent_revocations WHERE id = ${evidenceRevocationLeft.id}) AS revocation_count,
          (SELECT count(*) FROM identity.device_attestations WHERE id = ${evidenceDeviceLeft.id}) AS device_count,
          (SELECT count(*) FROM audit.domain_events WHERE stream_id = ${`evidence-custody:${evidenceCustodySubjectId}`}) AS event_count
      `);
      assert.deepEqual(
        evidenceCustodyCounts.map((row) => ({
          receiptCount: Number(row.receipt_count),
          revocationCount: Number(row.revocation_count),
          deviceCount: Number(row.device_count),
          eventCount: Number(row.event_count),
        })),
        [{ receiptCount: 1, revocationCount: 1, deviceCount: 1, eventCount: 3 }],
      );
      await assert.rejects(
        clientA.$transaction(async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.actor_id', ${evidenceCustodySubjectId}, true)`,
          );
          await transaction.$executeRaw(Prisma.sql`
            UPDATE evidence.consent_receipts
            SET policy_version = policy_version
            WHERE id = ${evidenceConsentLeft.id}
          `);
        }),
        /append-only/,
      );

      const e4SubjectId = memberIds[3];
      const e4FingerprintHash = hashJson({ kind: "native-e4-device", runId });
      const e4ConsentInput = {
        subjectId: e4SubjectId,
        deviceFingerprintHash: e4FingerprintHash,
        purposes: ["media_upload", "evidence_collection", "geolocation"],
        lawfulBasis: "consent",
        privacyMode: "restricted",
        policyVersion: "native-e4-consent-v1",
        evidenceHash: hashJson({ kind: "native-e4-consent", runId }),
        grantedAt: timestamp(60),
        expiresAt: timestamp(1_000),
        retentionDays: 365,
      } as const;
      const [e4ConsentLeft, e4ConsentRight] = await Promise.all([
        serviceA.recordEvidenceConsentReceipt(
          e4ConsentInput,
          organizationId,
          e4SubjectId,
          "owner",
          `native-e4-consent-${runId}`,
        ),
        serviceB.recordEvidenceConsentReceipt(
          e4ConsentInput,
          organizationId,
          e4SubjectId,
          "owner",
          `native-e4-consent-${runId}`,
        ),
      ]);
      assert.equal(e4ConsentLeft.receiptRoot, e4ConsentRight.receiptRoot);
      const e4DeviceInput = {
        subjectId: e4SubjectId,
        consentReceiptId: e4ConsentLeft.id,
        deviceFingerprintHash: e4FingerprintHash,
        attestationType: "webauthn",
        provider: "webauthn",
        providerKeyId: `native-e4-webauthn-${runId}`,
        providerReceiptHash: hashJson({ kind: "native-e4-provider-receipt", runId }),
        providerVerificationState: "modeled_only",
        publicKeyHash: hashJson({ kind: "native-e4-public-key", runId }),
        attestationHash: hashJson({ kind: "native-e4-attestation", runId }),
        issuedAt: timestamp(61),
        expiresAt: timestamp(900),
        reputationScore: 80,
        riskFlags: [],
      } as const;
      const [e4DeviceLeft, e4DeviceRight] = await Promise.all([
        serviceA.recordEvidenceDeviceAttestation(
          e4DeviceInput,
          organizationId,
          e4SubjectId,
          "owner",
          `native-e4-device-${runId}`,
        ),
        serviceB.recordEvidenceDeviceAttestation(
          e4DeviceInput,
          organizationId,
          e4SubjectId,
          "owner",
          `native-e4-device-${runId}`,
        ),
      ]);
      assert.equal(e4DeviceLeft.attestationRoot, e4DeviceRight.attestationRoot);

      const e4ClientBatchId = `native-e4-client-batch-${runId}`;
      const e4EvidenceId = `cp_native_e4_evidence_${runId}`;
      const e4EvidenceInput = {
        id: e4EvidenceId,
        projectId,
        evidenceType: "restoration",
        location: {
          latitude: 14.7168,
          longitude: -17.4678,
          accuracyMeters: 7,
          regionId: "native-test-region",
        },
        timestamp: timestamp(62),
        createdAt: timestamp(62),
        media_hash: hashJson({ kind: "native-e4-media", runId }),
        gps_hash: hashJson({ kind: "native-e4-gps", runId }),
        confidence_score: 86,
        offline_sync_id: e4ClientBatchId,
        device_fingerprint_hash: e4FingerprintHash,
      } as const;
      const [e4EvidenceLeft, e4EvidenceRight] = await Promise.all([
        serviceA.registerEvidence(
          e4EvidenceInput,
          e4SubjectId,
          "owner",
          `native-e4-evidence-${runId}`,
        ),
        serviceB.registerEvidence(
          e4EvidenceInput,
          e4SubjectId,
          "owner",
          `native-e4-evidence-${runId}`,
        ),
      ]);
      assert.equal(e4EvidenceLeft.evidence.evidenceRoot, e4EvidenceRight.evidence.evidenceRoot);

      const e4RepositoryA = new PrismaCanopyProofEvidenceOfflineCommunityRepository(clientA);
      const e4RepositoryB = new PrismaCanopyProofEvidenceOfflineCommunityRepository(clientB);
      const e4OfflineDomain = CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(
        await e4RepositoryA.loadOfflineAuthoritySnapshot(organizationId, e4DeviceLeft.id),
      );
      const e4Project = await serviceA.getProject(projectId);
      const e4ReceivedAt = timestamp(64);
      const e4Bundle = e4OfflineDomain.recordOfflineBundle(
        {
          clientBatchId: e4ClientBatchId,
          deviceSequence: 1,
          previousBatchRoot: offlineBatchGenesis(e4DeviceLeft.id, e4DeviceLeft.attestationRoot),
          deviceClockStartedAt: timestamp(61.5),
          deviceClockEndedAt: timestamp(63),
          receivedAt: e4ReceivedAt,
          connectivity: "offline",
          items: [
            {
              clientRecordId: `native-e4-client-record-${runId}`,
              evidenceId: e4EvidenceLeft.evidence.id,
              evidenceRoot: e4EvidenceLeft.evidence.evidenceRoot,
              clientPayloadHash: hashJson({ kind: "native-e4-client-payload", runId }),
            },
          ],
        },
        {
          actor: e4ConsentLeft.actor,
          project: {
            id: e4Project.id,
            organizationId: e4Project.organizationId,
            regionId: e4Project.regionId,
            status: e4Project.status,
            projectRoot: e4Project.projectRoot,
            updatedAt: e4Project.updatedAt,
          },
          consent: e4ConsentLeft,
          consentProjection: await serviceA.getEvidenceConsentProjection(
            e4ConsentLeft.id,
            organizationId,
            e4ReceivedAt,
          ),
          device: e4DeviceLeft,
          deviceProjection: await serviceA.getEvidenceEffectiveDeviceAttestationProjection(
            e4DeviceLeft.id,
            organizationId,
            e4ReceivedAt,
          ),
          registrations: [e4EvidenceLeft.evidence],
        },
      );
      assert.equal(e4Bundle.batch.batchState, "needs_review");
      await assertNativeE4OfflineBatchAuthorityParity(clientA, e4Bundle.batch);
      const e4OfflineIdempotencyKey = `native-e4-offline-${runId}`;
      const [e4BundleLeft, e4BundleRight] = await Promise.all([
        e4RepositoryA.commitOfflineBundle(
          e4Bundle.batch,
          e4Bundle.items,
          e4OfflineIdempotencyKey,
        ),
        e4RepositoryB.commitOfflineBundle(
          e4Bundle.batch,
          e4Bundle.items,
          e4OfflineIdempotencyKey,
        ),
      ]);
      assert.equal(e4BundleLeft.batch.batchRoot, e4BundleRight.batch.batchRoot);
      await assert.rejects(
        e4RepositoryB.commitOfflineBundle(
          { ...e4Bundle.batch, batchState: "reconciled" },
          e4Bundle.items,
          e4OfflineIdempotencyKey,
        ),
        /CANOPYPROOF_E4_OFFLINE_IDEMPOTENCY_CONFLICT/,
      );

      const e4CommunityDomain = CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(
        await e4RepositoryA.loadCommunityAuthoritySnapshot(organizationId, e4EvidenceId),
      );
      const e4CommunityFact = e4CommunityDomain.recordAttestation(
        {
          stance: "challenge",
          relationship: "independent_researcher",
          observationBasis: "records_review",
          conflictOfInterestDeclared: false,
          noteHash: hashJson({ kind: "native-e4-community-note", runId }),
          confidenceScore: 70,
          reasonCodes: ["source_reconciliation_required"],
          observedAt: timestamp(65),
          createdAt: timestamp(66),
        },
        {
          actor: custodyActorFromVerification(humanReviewLeft.reviewer),
          evidence: e4EvidenceLeft.evidence,
        },
      );
      const e4CommunityIdempotencyKey = `native-e4-community-${runId}`;
      const [e4CommunityLeft, e4CommunityRight] = await Promise.all([
        e4RepositoryA.commitCommunityAttestation(
          e4CommunityFact,
          e4CommunityIdempotencyKey,
        ),
        e4RepositoryB.commitCommunityAttestation(
          e4CommunityFact,
          e4CommunityIdempotencyKey,
        ),
      ]);
      assert.equal(e4CommunityLeft.attestationRoot, e4CommunityRight.attestationRoot);
      assert.equal(
        (await e4RepositoryA.projectCommunitySignal(organizationId, e4EvidenceId)).state,
        "review_required",
      );
      await assert.rejects(
        e4RepositoryB.commitCommunityAttestation(
          { ...e4CommunityFact, confidenceScore: 71 },
          e4CommunityIdempotencyKey,
        ),
        /CANOPYPROOF_E4_COMMUNITY_IDEMPOTENCY_CONFLICT/,
      );

      const e4Counts = await clientA.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
        );
        return transaction.$queryRaw<Array<{
          batch_count: bigint;
          item_count: bigint;
          community_count: bigint;
          event_count: bigint;
          receipt_count: bigint;
        }>>(Prisma.sql`
          SELECT
            (SELECT count(*) FROM evidence.offline_sync_batch_facts
             WHERE id = ${e4Bundle.batch.id}) AS batch_count,
            (SELECT count(*) FROM evidence.offline_sync_item_facts
             WHERE batch_id = ${e4Bundle.batch.id}) AS item_count,
            (SELECT count(*) FROM evidence.community_attestation_facts
             WHERE id = ${e4CommunityFact.id}) AS community_count,
            (SELECT count(*) FROM audit.domain_events
             WHERE stream_id IN (
               ${`evidence-offline-device:${e4DeviceLeft.id}`},
               ${`evidence-community:${e4EvidenceId}`}
             )) AS event_count,
            (SELECT count(*) FROM audit.command_receipts
             WHERE operation IN (
               'evidence.offline-sync-bundle.commit',
               'evidence.community-attestation.commit'
             ) AND result_entity_id IN (${e4Bundle.batch.id}, ${e4CommunityFact.id})) AS receipt_count
        `);
      });
      assert.deepEqual(
        e4Counts.map((row) => ({
          batchCount: Number(row.batch_count),
          itemCount: Number(row.item_count),
          communityCount: Number(row.community_count),
          eventCount: Number(row.event_count),
          receiptCount: Number(row.receipt_count),
        })),
        [{ batchCount: 1, itemCount: 1, communityCount: 1, eventCount: 2, receiptCount: 2 }],
      );
      await assert.rejects(
        clientA.$transaction(async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
          );
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.actor_id', ${e4SubjectId}, true)`,
          );
          await transaction.$executeRaw(Prisma.sql`
            UPDATE evidence.offline_sync_batch_facts
            SET received_at = received_at
            WHERE id = ${e4Bundle.batch.id}
          `);
        }),
        /APPEND_ONLY_VIOLATION/,
      );

      let releaseMobileRevocationLock!: () => void;
      let signalMobileRevocationLock!: () => void;
      const mobileRevocationLockHeld = new Promise<void>((resolve) => {
        signalMobileRevocationLock = resolve;
      });
      const mobileRevocationRelease = new Promise<void>((resolve) => {
        releaseMobileRevocationLock = resolve;
      });
      const mobileRevocation = clientA.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`domain-event:evidence-custody:${e4SubjectId}`}, 0)
          )::text AS lock_token
        `);
        signalMobileRevocationLock();
        await mobileRevocationRelease;
        const transactionService = new PrismaCanopyProofTrustRegistryService(
          transactionBoundPrismaClient(transaction),
        );
        return transactionService.revokeEvidenceConsentReceipt(
          e4ConsentLeft.id,
          {
            reason: "Native contention revokes authority before a waiting mobile binding can register evidence.",
            revokedAt: timestamp(68),
          },
          organizationId,
          e4SubjectId,
          "owner",
          `native-mobile-revocation-${runId}`,
        );
      });
      await mobileRevocationLockHeld;
      const nativeMobileClientBatchId = `native-mobile-client-batch-${runId}`;
      const mobileBindingAttempt = serviceB.registerMobileEvidenceWithAuthority(
        {
          id: `cp_native_mobile_evidence_${runId}`,
          projectId,
          evidenceType: "restoration",
          location: {
            latitude: 14.7168,
            longitude: -17.4678,
            accuracyMeters: 5,
            regionId: "native-test-region",
          },
          timestamp: timestamp(67),
          createdAt: timestamp(67),
          media_hash: hashJson({ kind: "native-mobile-media", runId }),
          gps_hash: hashJson({ kind: "native-mobile-gps", runId }),
          confidence_score: 88,
          offline_sync_id: nativeMobileClientBatchId,
          device_fingerprint_hash: e4FingerprintHash,
        },
        {
          actor: { id: e4SubjectId, role: "owner", organizationId },
          projectId,
          consentReceiptId: e4ConsentLeft.id,
          deviceAttestationId: e4DeviceLeft.id,
          deviceFingerprintHash: e4FingerprintHash,
          evaluatedAt: timestamp(67),
        },
        `native-mobile-binding-${runId}`,
      );
      releaseMobileRevocationLock();
      await mobileRevocation;
      await assert.rejects(
        mobileBindingAttempt,
        /CANOPYPROOF_MOBILE_SYNC_CONSENT_INACTIVE/,
      );
      assert.equal(
        await countRows(
          clientA,
          "evidence.evidence_objects",
          "offline_sync_id",
          nativeMobileClientBatchId,
        ),
        0,
      );
      assert.equal(
        await countCommandReceipts(
          clientA,
          e4SubjectId,
          "evidence.mobile-binding.create",
          undefined,
        ),
        0,
      );

      const nasaGibsActor: NasaGibsActor = {
        id: memberIds[2],
        organizationId,
        role: "admin",
        capabilities: ["nasa_gibs_catalog_sync"],
      };
      const nasaGibsSynchronizedAt = "2026-07-13T12:00:00.000Z";
      let nasaTransportArrivals = 0;
      let releaseNasaTransport!: () => void;
      const nasaTransportBarrier = new Promise<void>((resolve) => {
        releaseNasaTransport = resolve;
      });
      const nasaTransport = async () => {
        nasaTransportArrivals += 1;
        if (nasaTransportArrivals === 2) releaseNasaTransport();
        await nasaTransportBarrier;
        return new Response(nativeNasaGibsWmtsFixture, {
          status: 200,
          headers: {
            "content-type": "application/xml",
            "content-length": String(nativeNasaGibsWmtsFixture.byteLength),
          },
        });
      };
      const nasaRepositoryA = new PrismaNasaGibsRepository(clientA);
      const nasaRepositoryB = new PrismaNasaGibsRepository(clientB);
      const nasaServiceA = new NasaGibsConnectorService({
        repository: nasaRepositoryA,
        transport: nasaTransport,
        enabled: true,
        now: () => nasaGibsSynchronizedAt,
      });
      const nasaServiceB = new NasaGibsConnectorService({
        repository: nasaRepositoryB,
        transport: nasaTransport,
        enabled: true,
        now: () => nasaGibsSynchronizedAt,
      });
      const nasaSyncCommand = {
        serviceType: "WMTS" as const,
        projection: "EPSG:3857" as const,
        actor: nasaGibsActor,
        idempotencyKey: `native-nasa-gibs-sync-${runId}`,
        requestedAt: nasaGibsSynchronizedAt,
      };
      const [nasaSyncLeft, nasaSyncRight] = await Promise.all([
        nasaServiceA.sync(nasaSyncCommand),
        nasaServiceB.sync(nasaSyncCommand),
      ]);
      if (nasaSyncLeft.outcome !== "synchronized" || nasaSyncRight.outcome !== "synchronized") {
        assert.fail("Native NASA GIBS concurrent synchronization must not be converted into an outage.");
      }
      assert.equal(nasaSyncLeft.snapshot.snapshotRoot, nasaSyncRight.snapshot.snapshotRoot);
      assert.deepEqual(
        [nasaSyncLeft.replayed, nasaSyncRight.replayed].sort((left, right) => Number(left) - Number(right)),
        [false, true],
      );
      const nasaCatalogCounts = await clientA.$queryRaw<Array<{
        snapshot_count: bigint;
        product_count: bigint;
        receipt_count: bigint;
        event_count: bigint;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM satellite.nasa_gibs_catalog_snapshots
           WHERE id = ${nasaSyncLeft.snapshot.id}) AS snapshot_count,
          (SELECT count(*) FROM satellite.nasa_gibs_products
           WHERE snapshot_id = ${nasaSyncLeft.snapshot.id}) AS product_count,
          (SELECT count(*) FROM audit.command_receipts
           WHERE operation = 'satellite.nasa-gibs.sync'
             AND result_entity_id = ${nasaSyncLeft.snapshot.id}) AS receipt_count,
          (SELECT count(*) FROM audit.domain_events
           WHERE entity_type = 'nasa_gibs_catalog_snapshot'
             AND entity_id = ${nasaSyncLeft.snapshot.id}) AS event_count
      `);
      assert.deepEqual(
        nasaCatalogCounts.map((row) => ({
          snapshotCount: Number(row.snapshot_count),
          productCount: Number(row.product_count),
          receiptCount: Number(row.receipt_count),
          eventCount: Number(row.event_count),
        })),
        [{ snapshotCount: 1, productCount: 2, receiptCount: 1, eventCount: 1 }],
      );

      const nasaFailureAt = "2026-07-13T12:05:00.000Z";
      let nasaFailureTransportArrivals = 0;
      let releaseNasaFailureTransport!: () => void;
      const nasaFailureTransportBarrier = new Promise<void>((resolve) => {
        releaseNasaFailureTransport = resolve;
      });
      const nasaFailureTransport = async () => {
        nasaFailureTransportArrivals += 1;
        if (nasaFailureTransportArrivals === 2) releaseNasaFailureTransport();
        await nasaFailureTransportBarrier;
        throw new Error("Synthetic native NASA outage");
      };
      const nasaFailureServiceA = new NasaGibsConnectorService({
        repository: nasaRepositoryA,
        transport: nasaFailureTransport,
        enabled: true,
        now: () => nasaFailureAt,
      });
      const nasaFailureServiceB = new NasaGibsConnectorService({
        repository: nasaRepositoryB,
        transport: nasaFailureTransport,
        enabled: true,
        now: () => nasaFailureAt,
      });
      const [nasaFailureLeft, nasaFailureRight] = await Promise.all([
        nasaFailureServiceA.sync({
          ...nasaSyncCommand,
          idempotencyKey: `native-nasa-gibs-failure-${runId}`,
          requestedAt: nasaFailureAt,
        }),
        nasaFailureServiceB.sync({
          ...nasaSyncCommand,
          idempotencyKey: `native-nasa-gibs-failure-${runId}`,
          requestedAt: nasaFailureAt,
        }),
      ]);
      if (nasaFailureLeft.outcome !== "outage" || nasaFailureRight.outcome !== "outage") {
        assert.fail("Native NASA GIBS concurrent upstream failures must remain fail-soft outages.");
      }
      assert.equal(nasaFailureLeft.failure.failureRoot, nasaFailureRight.failure.failureRoot);
      assert.equal(nasaFailureLeft.lastValidSnapshot?.snapshotRoot, nasaSyncLeft.snapshot.snapshotRoot);
      assert.equal(nasaFailureRight.lastValidSnapshot?.snapshotRoot, nasaSyncLeft.snapshot.snapshotRoot);
      const nasaFailureCounts = await clientA.$queryRaw<Array<{
        failure_count: bigint;
        event_count: bigint;
      }>>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM satellite.nasa_gibs_sync_failures
           WHERE id = ${nasaFailureLeft.failure.id}) AS failure_count,
          (SELECT count(*) FROM audit.domain_events
           WHERE entity_type = 'nasa_gibs_sync_failure'
             AND entity_id = ${nasaFailureLeft.failure.id}) AS event_count
      `);
      assert.deepEqual(
        nasaFailureCounts.map((row) => ({
          failureCount: Number(row.failure_count),
          eventCount: Number(row.event_count),
        })),
        [{ failureCount: 1, eventCount: 1 }],
      );

      const nasaTrueColorProduct = nasaSyncLeft.products.find((product) =>
        product.nasaLayerId.includes("TrueColor")
      );
      assert.ok(nasaTrueColorProduct);
      const nasaComparison = await nasaServiceA.createComparison({
        productId: nasaTrueColorProduct.id,
        beforeDate: "2026-07-10",
        afterDate: "2026-07-12",
        bbox: { west: -2_000_000, south: -1_000_000, east: 2_000_000, north: 1_000_000 },
        mode: "SIDE_BY_SIDE",
        opacity: 0.75,
        createdAt: nasaGibsSynchronizedAt,
      }, nasaGibsActor);
      await clientA.$executeRaw(Prisma.sql`CREATE ROLE canopyproof_nasa_rls_reader NOLOGIN`);
      await clientA.$executeRaw(Prisma.sql`GRANT USAGE ON SCHEMA satellite TO canopyproof_nasa_rls_reader`);
      await clientA.$executeRaw(
        Prisma.sql`GRANT SELECT ON satellite.nasa_gibs_observation_comparisons TO canopyproof_nasa_rls_reader`,
      );
      await clientA.$transaction(async (transaction) => {
        await transaction.$executeRaw(Prisma.sql`SET LOCAL ROLE canopyproof_nasa_rls_reader`);
        await transaction.$queryRaw(
          Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
        );
        const ownTenant = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM satellite.nasa_gibs_observation_comparisons
          WHERE id = ${nasaComparison.id}
        `);
        assert.equal(Number(ownTenant[0]?.count ?? -1n), 1);
        await transaction.$queryRaw(
          Prisma.sql`SELECT set_config('app.organization_id', 'native-cross-tenant-probe', true)`,
        );
        const otherTenant = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM satellite.nasa_gibs_observation_comparisons
          WHERE id = ${nasaComparison.id}
        `);
        assert.equal(Number(otherTenant[0]?.count ?? -1n), 0);
      });
      await assert.rejects(
        clientA.$transaction(async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
          );
          await transaction.$queryRaw(
            Prisma.sql`SELECT set_config('app.actor_id', ${nasaGibsActor.id}, true)`,
          );
          await transaction.$executeRaw(Prisma.sql`
            UPDATE satellite.nasa_gibs_observation_comparisons
            SET created_at = created_at
            WHERE id = ${nasaComparison.id}
          `);
        }),
        /NASA_GIBS_APPEND_ONLY_VIOLATION/,
      );

      const finalStream = await clientA.$queryRaw<SequenceRow[]>(Prisma.sql`
        SELECT sequence_no, previous_root, event_root
        FROM audit.domain_events
        WHERE stream_id = ${organizationId}
        ORDER BY sequence_no
      `);
      assert.equal(finalStream.length, 35);
      assert.deepEqual(
        finalStream.map((event) => Number(event.sequence_no)),
        Array.from({ length: finalStream.length }, (_, index) => index + 1),
      );

      await Promise.all(clients.map((client) => client.$disconnect()));
      const reconnectClient = createSingleConnectionClient(databaseUrl);
      try {
        await reconnectClient.$connect();
        const reconnectService = new PrismaCanopyProofTrustRegistryService(reconnectClient);
        const reconnectE4 = new PrismaCanopyProofEvidenceOfflineCommunityRepository(reconnectClient);
        const reconnectTransparency = new PrismaCanopyProofPublicTransparencyRepository(reconnectClient);
        const reconnectLifecycle = new PrismaCanopyProofEnvironmentalProofLifecycleRepository(reconnectClient);
        const reconnectExplorer = new PrismaCanopyProofPublicExplorerRepository(
          reconnectClient,
          createCanopyProofPublicExplorerSourceResolver({
            trustRegistry: reconnectService,
            lifecycleRepository: reconnectLifecycle,
          }),
        );
        const reloadedOrganization = await reconnectService.getOrganization(organizationId);
        assert.equal(reloadedOrganization.id, organizationId);
        assert.equal(
          verifyCanopyProofAuditChain(reloadedOrganization.auditHistory, reloadedOrganization.auditHistory.at(-1)?.createdAt).valid,
          true,
        );
        assert.equal((await reconnectService.getDataAccessRequest(requestLeft.id)).status, "approved");
        assert.equal(
          (await reconnectService.getAuditExportManifest(manifestLeft.id, organizationId, true)).exportHash,
          manifestLeft.exportHash,
        );
        assert.equal(
          (await reconnectService.getDataAccessDeliveryReceipt(deliveryLeft.id)).deliveryRoot,
          deliveryLeft.deliveryRoot,
        );
        assert.equal(
          (await reconnectService.getDataUseAttestation(useAttestationLeft.id)).usageRoot,
          useAttestationLeft.usageRoot,
        );
        assert.equal(
          (await reconnectService.getDataUseEnforcementCase(enforcementLeft.id)).enforcementRoot,
          enforcementLeft.enforcementRoot,
        );
        assert.equal(
          (await reconnectService.getDataAccessRestriction(restrictionLeft.id)).restrictionRoot,
          restrictionLeft.restrictionRoot,
        );
        assert.equal(
          (
            await reconnectTransparency.getPublication(
              organizationId,
              publicTransparencyPublication.id,
            )
          ).publicationRoot,
          publicTransparencyPublication.publicationRoot,
        );
        assert.equal(
          (
            await reconnectTransparency.loadAuthoritySnapshot(organizationId)
          ).publications.length,
          1,
        );
        const reloadedExplorer = serializeCanopyProofPublicExplorerProject(
          await reconnectExplorer.verifyPublication(
            publicTransparencyPublication.id,
            timestamp(39.51),
          ),
        );
        assert.equal(reloadedExplorer.project.publicProjectId, publicTransparencyPublication.publicProjectId);
        assert.equal(reloadedExplorer.lineage.publicationRoot, publicTransparencyPublication.publicationRoot);
        assert.equal(
          (await reconnectService.getDataAccessAccountabilityPacket(packetLeft.id)).packetRoot,
          packetLeft.packetRoot,
        );
        assert.equal(
          (await reconnectService.getDataAccessAccountabilityVerification(verificationLeft.id)).verificationRoot,
          verificationLeft.verificationRoot,
        );
        assert.equal(
          (await reconnectService.getDataAccessAccountabilityDisclosure(disclosureLeft.id)).disclosureRoot,
          disclosureLeft.disclosureRoot,
        );
        assert.equal(
          (
            await reconnectService.getDataAccessAccountabilityDisclosureChallenge(disclosureChallengeLeft.id)
          ).challengeRoot,
          disclosureChallengeLeft.challengeRoot,
        );
        assert.equal(
          (
            await reconnectService.getDataAccessAccountabilityDisclosureResolution(disclosureResolutionLeft.id)
          ).resolutionRoot,
          disclosureResolutionLeft.resolutionRoot,
        );
        assert.equal(
          (
            await reconnectService.getDataAccessAccountabilityDisclosureNotice(disclosureNoticeLeft.id)
          ).noticeRoot,
          disclosureNoticeLeft.noticeRoot,
        );
        assert.equal(
          (await reconnectService.getDataAccessAccountabilityDisclosure(disclosureLeft.id)).governanceState,
          "withdrawn",
        );
        const reloadedProject = await reconnectService.getProject(projectId);
        assert.equal(reloadedProject.status, "monitored");
        assert.equal(reloadedProject.projectRoot, monitoringLeft.monitoringRoot);
        assert.equal((await reconnectService.listProjectStatusTransitions(projectId)).length, 2);
        assert.equal((await reconnectService.listProjectMonitoringEvents({ projectId })).length, 2);
        assert.equal(
          (await reconnectService.getEvidence(projectEvidenceId)).evidenceRoot,
          evidenceLeft.evidence.evidenceRoot,
        );
        assert.deepEqual(
          (await reconnectService.listEvidence({ projectId })).map((evidence) => evidence.id).sort(),
          [projectEvidenceId, e4EvidenceId].sort(),
        );
        assert.equal(
          (await reconnectService.getEvidenceReliance(projectEvidenceId, organizationId)).state,
          "withdrawn",
        );
        assert.equal((await reconnectService.listEvidenceValidationRuns(projectEvidenceId, organizationId)).length, 1);
        assert.equal((await reconnectService.listEvidenceAiAnalyses(projectEvidenceId, organizationId)).length, 1);
        assert.equal((await reconnectService.listEvidenceHumanReviews(projectEvidenceId, organizationId)).length, 1);
        assert.equal(
          (await reconnectService.getEvidenceConsentReceipt(evidenceConsentLeft.id, organizationId)).receiptRoot,
          evidenceConsentLeft.receiptRoot,
        );
        assert.equal(
          (
            await reconnectService.getEvidenceConsentRevocation(
              evidenceRevocationLeft.id,
              organizationId,
            )
          ).revocationRoot,
          evidenceRevocationLeft.revocationRoot,
        );
        assert.equal(
          (
            await reconnectService.getEvidenceDeviceAttestation(
              evidenceDeviceLeft.id,
              organizationId,
            )
          ).attestationRoot,
          evidenceDeviceLeft.attestationRoot,
        );
        assert.equal(
          (
            await reconnectE4.getOfflineBundle(
              organizationId,
              e4DeviceLeft.id,
              e4Bundle.batch.id,
            )
          ).batch.batchRoot,
          e4Bundle.batch.batchRoot,
        );
        assert.equal(
          (
            await reconnectE4.getCommunityAttestation(
              organizationId,
              e4EvidenceId,
              e4CommunityFact.id,
            )
          ).attestationRoot,
          e4CommunityFact.attestationRoot,
        );
        assert.equal(
          (await reconnectService.getEnvironmentalProofRecord(proofRecordLeft.id, organizationId)).recordRoot,
          proofRecordLeft.recordRoot,
        );
        assert.equal(
          (await reconnectService.getEnvironmentalProofRecordStatus(proofRecordLeft.id, organizationId)).state,
          "revoked",
        );
        assert.equal(
          (
            await reconnectService.getEnvironmentalProofChallenge(
              proofChallengeLeft.challenge.id,
              organizationId,
            )
          ).challengeRoot,
          proofChallengeLeft.challenge.challengeRoot,
        );
        assert.deepEqual(
          (
            await reconnectService.listEnvironmentalProofChallengeReviews(
              proofChallengeLeft.challenge.id,
              organizationId,
            )
          ).map((review) => review.reviewRoot),
          [proofChallengeVerifierReviewLeft.reviewRoot, proofChallengeOwnerReviewLeft.reviewRoot],
        );
        const danglingReceiptRows = await reconnectClient.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM audit.command_receipts receipt
          LEFT JOIN audit.domain_events event
            ON event.event_root = receipt.audit_event_root
           AND event.actor_id = receipt.actor_id
           AND event.entity_id = receipt.result_entity_id
          WHERE receipt.actor_id = ${bootstrapActorId}
            AND event.id IS NULL
        `);
        assert.equal(Number(danglingReceiptRows[0]?.count ?? -1n), 0);
      } finally {
        await reconnectClient.$disconnect();
      }
    } finally {
      await Promise.allSettled(clients.map((client) => client.$disconnect()));
    }
  },
);

async function verifyNativeMobileSyncAdmission(
  clientA: PrismaClient,
  clientB: PrismaClient,
  organizationId: string,
  actorId: string,
) {
  const authorityA = new PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority(clientA);
  const authorityB = new PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority(clientB);
  const evaluatedAt = timestamp(2.5);
  const input = { organizationId, actorId, command: "binding", evaluatedAt } as const;

  for (let count = 1; count < 30; count += 1) {
    const decision = await authorityA.consume(input);
    assert.equal(decision.allowed, true);
    assert.equal(decision.remaining, 30 - count);
    assert.equal(decision.abuseEventRoot, undefined);
  }

  const boundary = await Promise.all([
    authorityA.consume(input),
    authorityB.consume(input),
  ]);
  assert.deepEqual(
    boundary.map((decision) => decision.allowed).sort(),
    [false, true],
  );
  const firstDenial = boundary.find((decision) => !decision.allowed);
  assert.ok(firstDenial?.abuseEventRoot);
  assert.match(firstDenial.abuseEventRoot, /^[a-f0-9]{64}$/);
  assert.equal(firstDenial.remaining, 0);

  const secondDenial = await authorityB.consume(input);
  assert.equal(secondDenial.allowed, false);
  assert.ok(secondDenial.abuseEventRoot);
  assert.notEqual(secondDenial.abuseEventRoot, firstDenial.abuseEventRoot);

  const persisted = await clientA.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`
      SELECT set_config('app.organization_id', ${organizationId}, true)
    `);
    await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
    const buckets = await transaction.$queryRaw<Array<{
      scope_type: "actor" | "organization";
      request_count: bigint;
    }>>(Prisma.sql`
      SELECT scope_type, request_count
      FROM audit.mobile_sync_admission_buckets
      WHERE organization_id = ${organizationId}
        AND command_type = 'binding'
      ORDER BY scope_type
    `);
    const denials = await transaction.$queryRaw<Array<{
      denial_root: string;
      actor_count: bigint;
      organization_count: bigint;
      denial_reason: string;
    }>>(Prisma.sql`
      SELECT denial_root, actor_count, organization_count, denial_reason
      FROM audit.mobile_sync_admission_denial_facts
      WHERE organization_id = ${organizationId}
        AND actor_id = ${actorId}
        AND command_type = 'binding'
      ORDER BY actor_count
    `);
    return { buckets, denials };
  });
  assert.deepEqual(
    persisted.buckets.map((bucket) => [bucket.scope_type, Number(bucket.request_count)]),
    [["actor", 32], ["organization", 32]],
  );
  assert.deepEqual(
    persisted.denials.map((denial) => ({
      root: denial.denial_root,
      actorCount: Number(denial.actor_count),
      organizationCount: Number(denial.organization_count),
      reason: denial.denial_reason,
    })),
    [
      {
        root: firstDenial.abuseEventRoot,
        actorCount: 31,
        organizationCount: 31,
        reason: "actor_limit_exceeded",
      },
      {
        root: secondDenial.abuseEventRoot,
        actorCount: 32,
        organizationCount: 32,
        reason: "actor_limit_exceeded",
      },
    ],
  );

  await assert.rejects(
    clientA.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        SELECT set_config('app.organization_id', ${organizationId}, true)
      `);
      await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
      await transaction.$executeRaw(Prisma.sql`
        UPDATE audit.mobile_sync_admission_denial_facts
        SET denial_reason = denial_reason
        WHERE denial_root = ${firstDenial.abuseEventRoot}
      `);
    }),
    /CANOPYPROOF_MOBILE_SYNC_ADMISSION_APPEND_ONLY_VIOLATION/,
  );
}

async function verifyNativeGlobalCommandCenter(
  writer: PrismaClient,
  reader: PrismaClient,
  actorId: string,
  runId: string,
) {
  const snapshot = buildCanopyProofGlobalCommandCenter({
    projectRegistry: new CanopyProofProjectRegistryService(),
    proof: new CanopyProofService(),
    terra: new TerraProofService(),
    risk: new CanopyProofEarlyWarningService(),
    funding: new CanopyProofFundingTransparencyService(),
    generatedAt: timestamp(0),
  });
  const sourceAuthorityRoot = buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(snapshot);
  const organizationId = `cp_native_global_org_${runId}`;
  const publisher = globalProjectionActor(
    actorId,
    organizationId,
    "human",
    "owner",
    canopyProofGlobalCommandCenterPublishingScopes.publish,
    runId,
  );
  const governor = globalProjectionActor(
    `cp_native_global_governor_${runId}`,
    organizationId,
    "human",
    "verifier",
    canopyProofGlobalCommandCenterPublishingScopes.govern,
    runId,
  );
  const policyId = `cp_native_global_policy_${runId}`;
  const policyRoot = hashJson({ kind: "native-global-command-center-policy", runId });
  const approval = buildCanopyProofGlobalCommandCenterGovernanceApproval(
    {
      id: `cp_native_global_approval_${runId}`,
      dashboardRoot: snapshot.lineage.dashboardRoot,
      sourceAuthorityRoot,
      policyId,
      policyRoot,
      maxSnapshotAgeSeconds: 600,
      approvedAt: timestamp(0),
      validFrom: timestamp(0),
      validUntil: timestamp(600),
    },
    governor,
  );
  const publication = buildCanopyProofGlobalCommandCenterPublication(
    {
      snapshot,
      sourceAuthorityRoot,
      policyId,
      policyRoot,
      publishedAt: timestamp(60),
    },
    { publisher, governanceApproval: approval },
  );
  const publishingRepository = new PrismaCanopyProofGlobalCommandCenterPublishingRepository(writer);
  const committed = await publishingRepository.commitPublication(
    snapshot,
    publication,
    `native-global-command-center-${runId}`,
    async () => ({ snapshot, sourceAuthorityRoot, publisher, governor }),
  );
  assert.deepEqual(committed, { snapshot, publication });

  const repository = new PrismaCanopyProofGlobalCommandCenterRepository(reader);
  assert.deepEqual(await repository.getLatestSnapshot(), snapshot);
  assert.deepEqual(
    await new PrismaCanopyProofGlobalCommandCenterRepository(reader).getLatestSnapshot(),
    snapshot,
  );
  await assert.rejects(
    writer.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
      await transaction.$executeRaw(Prisma.sql`
        UPDATE impact.global_command_center_snapshots
        SET generated_at = generated_at + interval '1 second'
        WHERE id = ${publication.snapshotId}
      `);
    }),
    /audit records are append-only/i,
  );
}

function globalProjectionActor(
  id: string,
  organizationId: string,
  participantType: "human" | "agent",
  role: CanopyProofVerificationActorSnapshot["role"],
  scope: string,
  runId: string,
): CanopyProofVerificationActorSnapshot {
  const seed = {
    id,
    participantType,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "native-global-participant", id, runId }),
    organizationRoot: hashJson({ kind: "native-global-organization", organizationId, runId }),
    membershipId: `cp_native_global_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "native-global-membership", id, runId }),
    accreditationId: `cp_native_global_accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "native-global-accreditation", id, scope, runId }),
    accreditationScope: [scope],
  };
  return {
    ...seed,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...seed }),
  };
}

function requireDisposableNativeDatabase() {
  const value = process.env[nativeDatabaseUrlEnvironment]?.trim();
  if (!value) {
    throw new Error(`${nativeDatabaseUrlEnvironment} is required for the opt-in native PostgreSQL gate.`);
  }
  if (process.env[nativeDatabaseConfirmationEnvironment] !== nativeDatabaseConfirmation) {
    throw new Error(
      `${nativeDatabaseConfirmationEnvironment} must equal ${nativeDatabaseConfirmation} before the native gate can write.`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${nativeDatabaseUrlEnvironment} must be a valid PostgreSQL URL.`);
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${nativeDatabaseUrlEnvironment} must use postgresql:// or postgres://.`);
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(databaseName)) {
    throw new Error("Native trust-registry validation requires a database name explicitly marked test or ci.");
  }
  return value;
}

function applyCanopyProofContract(databaseUrl: string) {
  const prismaBinary = join(process.cwd(), "node_modules", ".bin", "prisma");
  try {
    for (const contract of [
      "canopyproof-os.sql",
      "global-command-center-publishing-authority.sql",
      "global-command-center-spatial-disclosure-authority.sql",
      "evidence-device-attestation-adapters.sql",
      "evidence-media-adapters.sql",
      "evidence-metadata-retention.sql",
      "evidence-metadata-adapters.sql",
      "evidence-metadata-orchestration.sql",
      "evidence-offline-community.sql",
      "nasa-gibs.sql",
      "mrv-graph.sql",
      "environmental-proof-lifecycle.sql",
      "public-transparency-authority.sql",
      "public-transparency-explorer.sql",
      "esg-metric-authority.sql",
      "esg-reporting-authority.sql",
      "mobile-sync-admission.sql",
    ]) {
      execFileSync(
        prismaBinary,
        [
          "db",
          "execute",
          "--file",
          join(process.cwd(), "services", "api", "prisma", contract),
          "--schema",
          join(process.cwd(), "services", "api", "prisma", "schema.prisma"),
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: databaseUrl },
          stdio: "ignore",
        },
      );
    }
  } catch {
    throw new Error("CanopyProof native PostgreSQL contract application failed; database credentials were not logged.");
  }
}

function createSingleConnectionClient(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("connection_limit", "1");
  parsed.searchParams.set("pool_timeout", "30");
  return new PrismaClient({ datasources: { db: { url: parsed.toString() } } });
}

function transactionBoundPrismaClient(transaction: Prisma.TransactionClient) {
  return {
    async $transaction<T>(operation: (client: Prisma.TransactionClient) => Promise<T>) {
      return operation(transaction);
    },
  } as PrismaClient;
}

async function insertBootstrapOwner(client: PrismaClient, actorId: string, runId: string) {
  const createdAt = timestamp(-1);
  const subjectHash = hashJson({ kind: "canopyproof-native-bootstrap-subject-v1", runId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["owner"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "Disposable native PostgreSQL test owner provisioned through an explicit bootstrap transaction.",
  })[0]!;

  await client.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, organization_id, roles,
        verification_status, reputation_score, credential_commitments,
        public_key_hash, subject_hash, created_at, updated_at
      ) VALUES (
        ${actorId}, 'human', 'Native PostgreSQL Test Owner', ${actorId}, NULL, ARRAY['owner']::text[],
        'verified', 100, ARRAY[]::text[], NULL, ${subjectHash}, ${new Date(createdAt)}, ${new Date(createdAt)}
      )
    `);
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, ${actorId}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
        ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${new Date(event.createdAt)}, ${event.rationale}
      )
    `);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

const nativeCountQueries: Readonly<Record<string, (value: string) => Prisma.Sql>> = Object.freeze({
  "audit.domain_events:stream_id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM audit.domain_events WHERE stream_id = ${value}`,
  "evidence.evidence_objects:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM evidence.evidence_objects WHERE id = ${value}`,
  "evidence.evidence_objects:offline_sync_id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM evidence.evidence_objects WHERE offline_sync_id = ${value}`,
  "identity.participants:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM identity.participants WHERE id = ${value}`,
  "organizations.data_access_accountability_disclosure_challenges:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_disclosure_challenges WHERE id = ${value}`,
  "organizations.data_access_accountability_disclosure_notices:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_disclosure_notices WHERE id = ${value}`,
  "organizations.data_access_accountability_disclosure_resolutions:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_disclosure_resolutions WHERE id = ${value}`,
  "organizations.data_access_accountability_disclosures:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_disclosures WHERE id = ${value}`,
  "organizations.data_access_accountability_packets:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_packets WHERE id = ${value}`,
  "organizations.data_access_accountability_verifications:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_verifications WHERE id = ${value}`,
  "organizations.data_access_delivery_receipts:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_delivery_receipts WHERE id = ${value}`,
  "organizations.data_access_restrictions:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_access_restrictions WHERE id = ${value}`,
  "organizations.data_use_attestations:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_use_attestations WHERE id = ${value}`,
  "organizations.data_use_enforcement_cases:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.data_use_enforcement_cases WHERE id = ${value}`,
  "organizations.memberships:organization_id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM organizations.memberships WHERE organization_id = ${value}`,
  "reporting.canonical_esg_report_facts:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM reporting.canonical_esg_report_facts WHERE id = ${value}`,
  "reporting.canonical_esg_report_metric_member_facts:report_id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM reporting.canonical_esg_report_metric_member_facts WHERE report_id = ${value}`,
  "reporting.esg_metric_definition_facts:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM reporting.esg_metric_definition_facts WHERE id = ${value}`,
  "reporting.esg_metric_result_facts:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM reporting.esg_metric_result_facts WHERE id = ${value}`,
  "projects.monitoring_events:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM projects.monitoring_events WHERE id = ${value}`,
  "projects.projects:id": (value) =>
    Prisma.sql`SELECT count(*)::bigint AS count FROM projects.projects WHERE id = ${value}`,
});

async function countRows(client: PrismaClient, table: string, column: string, value: string) {
  const query = nativeCountQueries[`${table}:${column}`]?.(value);
  if (!query) throw new Error("Native test attempted an unapproved count query.");
  const rows = await client.$queryRaw<CountRow[]>(query);
  return Number(rows[0]?.count ?? -1n);
}

async function countCommandReceipts(
  client: PrismaClient,
  actorId: string,
  operation: string,
  resultEntityId: string | undefined,
) {
  const rows = resultEntityId
    ? await client.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT count(*)::bigint AS count
        FROM audit.command_receipts
        WHERE actor_id = ${actorId}
          AND operation = ${operation}
          AND result_entity_id = ${resultEntityId}
      `)
    : await client.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT count(*)::bigint AS count
        FROM audit.command_receipts
        WHERE actor_id = ${actorId}
          AND operation = ${operation}
      `);
  return Number(rows[0]?.count ?? -1n);
}

type NativeE4AuthorityParityRow = {
  readonly failures: readonly string[];
};

async function assertNativeE4OfflineBatchAuthorityParity(
  client: PrismaClient,
  batch: CanopyProofOfflineSyncBatchFact,
) {
  const rows = await client.$queryRaw<NativeE4AuthorityParityRow[]>(Prisma.sql`
    WITH input AS (
      SELECT ${JSON.stringify(batch)}::jsonb AS fact
    ), authority AS (
      SELECT
        input.fact,
        project_authority.project_root,
        consent.id AS consent_id,
        consent.receipt_root,
        consent.purposes,
        device.id AS device_id,
        device.subject_id AS device_subject_id,
        device.attestation_root,
        consent.subject_id AS consent_subject_id,
        consent_projection.state AS consent_state,
        consent_projection.projection_root AS consent_projection_root,
        device_projection.state AS device_state,
        device_projection.projection_root AS device_projection_root,
        COALESCE(
          (
            SELECT previous.batch_root
            FROM evidence.offline_sync_batch_facts previous
            WHERE previous.device_attestation_id = device.id
            ORDER BY previous.device_sequence DESC, previous.id DESC
            LIMIT 1
          ),
          evidence.e4_offline_batch_genesis(device.id, device.attestation_root)
        ) AS expected_previous_root,
        COALESCE(
          (
            SELECT previous.device_sequence + 1
            FROM evidence.offline_sync_batch_facts previous
            WHERE previous.device_attestation_id = device.id
            ORDER BY previous.device_sequence DESC, previous.id DESC
            LIMIT 1
          ),
          1
        ) AS expected_device_sequence
      FROM input
      JOIN projects.projects project ON project.id = input.fact->>'projectId'
      CROSS JOIN LATERAL projects.current_authority(project.id) project_authority
      JOIN identity.device_attestations device ON device.id = input.fact->>'deviceAttestationId'
      JOIN evidence.consent_receipts consent ON consent.id = device.consent_receipt_id
      CROSS JOIN LATERAL evidence.consent_receipt_projection(
        consent.id,
        (input.fact->>'receivedAt')::timestamptz
      ) consent_projection
      CROSS JOIN LATERAL evidence.device_attestation_projection(
        device.id,
        (input.fact->>'receivedAt')::timestamptz
      ) device_projection
    )
    SELECT array_remove(ARRAY[
      CASE WHEN NOT evidence.e4_has_forbidden_key(fact) THEN NULL ELSE 'forbidden_key' END,
      CASE WHEN evidence.e4_keys_are_valid(
        fact,
        ARRAY[
          'factType','id','organizationId','projectId','projectRoot','subjectId',
          'consentReceiptId','consentReceiptRoot','consentProjectionRoot',
          'deviceAttestationId','deviceAttestationRoot','deviceProjectionState',
          'deviceProjectionRoot','clientBatchId','deviceSequence','previousBatchRoot',
          'deviceClockStartedAt','deviceClockEndedAt','receivedAt','connectivity',
          'itemCount','reconciledCount','needsReviewCount','itemRoots','manifestRoot',
          'issueCodes','batchState','actor','commandHash','streamSequence',
          'previousEventRoot','batchHash','batchRoot','safety','auditEvent'
        ]::text[],
        ARRAY[
          'factType','id','organizationId','projectId','projectRoot','subjectId',
          'consentReceiptId','consentReceiptRoot','consentProjectionRoot',
          'deviceAttestationId','deviceAttestationRoot','deviceProjectionState',
          'deviceProjectionRoot','clientBatchId','deviceSequence','previousBatchRoot',
          'deviceClockStartedAt','deviceClockEndedAt','receivedAt','connectivity',
          'itemCount','reconciledCount','needsReviewCount','itemRoots','manifestRoot',
          'issueCodes','batchState','actor','commandHash','streamSequence',
          'previousEventRoot','batchHash','batchRoot','safety','auditEvent'
        ]::text[]
      ) THEN NULL ELSE 'top_level_keys' END,
      CASE WHEN fact->>'projectRoot' = project_root THEN NULL ELSE 'project_root' END,
      CASE WHEN fact->>'subjectId' = device_subject_id THEN NULL ELSE 'device_subject' END,
      CASE WHEN fact->>'subjectId' = consent_subject_id THEN NULL ELSE 'consent_subject' END,
      CASE WHEN fact->>'consentReceiptId' = consent_id THEN NULL ELSE 'consent_id' END,
      CASE WHEN fact->>'consentReceiptRoot' = receipt_root THEN NULL ELSE 'consent_root' END,
      CASE WHEN fact->>'consentProjectionRoot' = consent_projection_root THEN NULL ELSE 'consent_projection_root' END,
      CASE WHEN consent_state = 'active' THEN NULL ELSE 'consent_state' END,
      CASE WHEN purposes @> ARRAY['evidence_collection','geolocation']::text[] THEN NULL ELSE 'consent_purposes' END,
      CASE WHEN fact->>'deviceAttestationRoot' = attestation_root THEN NULL ELSE 'device_root' END,
      CASE WHEN fact->>'deviceProjectionState' = device_state THEN NULL ELSE 'device_projection_state' END,
      CASE WHEN device_state IN ('current','needs_review') THEN NULL ELSE 'device_state' END,
      CASE WHEN fact->>'deviceProjectionRoot' = device_projection_root THEN NULL ELSE 'device_projection_root' END,
      CASE WHEN evidence.evidence_custody_actor_is_valid(
        fact->'actor', fact->>'subjectId', fact->>'organizationId'
      ) THEN NULL ELSE 'actor_authority' END,
      CASE WHEN (fact->>'deviceSequence')::bigint = expected_device_sequence THEN NULL ELSE 'device_sequence' END,
      CASE WHEN fact->>'previousBatchRoot' = expected_previous_root THEN NULL ELSE 'previous_batch_root' END,
      CASE WHEN fact->>'clientBatchId' ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$' THEN NULL ELSE 'client_batch_id' END,
      CASE WHEN evidence.evidence_media_safe_material(ARRAY[fact->>'clientBatchId']) THEN NULL ELSE 'client_batch_material' END,
      CASE WHEN fact->>'connectivity' IN ('offline','cellular','wifi','satellite') THEN NULL ELSE 'connectivity' END,
      CASE WHEN (fact->>'deviceClockStartedAt')::timestamptz <=
        (fact->>'deviceClockEndedAt')::timestamptz THEN NULL ELSE 'clock_order' END,
      CASE WHEN (fact->>'deviceClockEndedAt')::timestamptz <=
        (fact->>'receivedAt')::timestamptz THEN NULL ELSE 'receive_order' END,
      CASE WHEN (fact->>'deviceClockEndedAt')::timestamptz -
        (fact->>'deviceClockStartedAt')::timestamptz <= interval '365 days' THEN NULL ELSE 'clock_span' END,
      CASE WHEN (fact->>'receivedAt')::timestamptz =
        date_trunc('milliseconds', (fact->>'receivedAt')::timestamptz) THEN NULL ELSE 'received_precision' END,
      CASE WHEN (fact->>'deviceClockStartedAt')::timestamptz =
        date_trunc('milliseconds', (fact->>'deviceClockStartedAt')::timestamptz) THEN NULL ELSE 'started_precision' END,
      CASE WHEN (fact->>'deviceClockEndedAt')::timestamptz =
        date_trunc('milliseconds', (fact->>'deviceClockEndedAt')::timestamptz) THEN NULL ELSE 'ended_precision' END,
      CASE WHEN jsonb_typeof(fact->'itemRoots') = 'array' THEN NULL ELSE 'item_roots_type' END,
      CASE WHEN jsonb_array_length(fact->'itemRoots') = (fact->>'itemCount')::integer THEN NULL ELSE 'item_count' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(fact->'itemRoots') value
        WHERE value !~ '^[0-9a-f]{64}$'
      ) THEN NULL ELSE 'item_root_format' END,
      CASE WHEN fact->>'manifestRoot' = audit.merkle_root(ARRAY(
        SELECT value FROM jsonb_array_elements_text(fact->'itemRoots') WITH ORDINALITY item(value, position)
        ORDER BY position
      )) THEN NULL ELSE 'manifest_root' END,
      CASE WHEN jsonb_typeof(fact->'issueCodes') = 'array' THEN NULL ELSE 'issue_codes_type' END,
      CASE WHEN audit.is_sorted_unique_text_array(ARRAY(
        SELECT value FROM jsonb_array_elements_text(fact->'issueCodes') WITH ORDINALITY item(value, position)
        ORDER BY position
      )) THEN NULL ELSE 'issue_codes_order' END,
      CASE WHEN (fact->>'reconciledCount')::integer +
        (fact->>'needsReviewCount')::integer = (fact->>'itemCount')::integer THEN NULL ELSE 'result_counts' END,
      CASE WHEN fact->'safety' = evidence.e4_safety_canonical() THEN NULL ELSE 'safety' END,
      CASE WHEN fact->>'batchHash' = evidence.e4_offline_batch_hash(fact) THEN NULL ELSE 'batch_hash' END,
      CASE WHEN fact->>'batchRoot' = evidence.e4_offline_batch_root(fact) THEN NULL ELSE 'batch_root' END
    ]::text[], NULL) AS failures
    FROM authority
  `);
  assert.deepEqual(rows, [{ failures: [] }]);
}

function custodyActorFromVerification(
  actor: CanopyProofVerificationActorSnapshot,
): CanopyProofEvidenceCustodyActorSnapshot {
  if (
    actor.participantType !== "human" ||
    !["owner", "admin", "verifier", "researcher", "community"].includes(actor.role) ||
    !actor.membershipId ||
    !actor.membershipStatus ||
    !actor.membershipRoot
  ) {
    throw new Error("CanopyProof native E4 actor is not a custody-eligible human.");
  }
  const role = actor.role as CanopyProofEvidenceCustodyActorSnapshot["role"];
  const seed = {
    id: actor.id,
    participantType: "human" as const,
    role,
    verificationStatus: actor.verificationStatus,
    organizationId: actor.organizationId,
    organizationVerificationStatus: actor.organizationVerificationStatus,
    participantRoot: actor.participantRoot,
    organizationRoot: actor.organizationRoot,
    membershipId: actor.membershipId,
    membershipStatus: actor.membershipStatus,
    membershipRoot: actor.membershipRoot,
  };
  return { ...seed, authorityRoot: canopyProofEvidenceCustodyActorAuthorityRoot(seed) };
}

async function resolveNativeMrvEndpoint(
  client: PrismaClient,
  type: CanopyProofMrvEndpointSnapshot["type"],
  id: string,
) {
  const rows = await client.$queryRaw<Array<{ endpoint: CanopyProofMrvEndpointSnapshot }>>(Prisma.sql`
    SELECT mrv.resolve_endpoint(${type}, ${id}) AS endpoint
  `);
  const endpoint = rows[0]?.endpoint;
  if (!endpoint) throw new Error(`CANOPYPROOF_NATIVE_MRV_ENDPOINT_NOT_FOUND:${type}:${id}`);
  return endpoint;
}

async function resolveNativeMrvMethodology(client: PrismaClient, methodologyId: string) {
  const rows = await client.$queryRaw<Array<{ methodology: CanopyProofMrvMethodologySnapshot }>>(Prisma.sql`
    SELECT mrv.resolve_methodology(${methodologyId}) AS methodology
  `);
  const methodology = rows[0]?.methodology;
  if (!methodology) throw new Error(`CANOPYPROOF_NATIVE_MRV_METHODOLOGY_NOT_FOUND:${methodologyId}`);
  return methodology;
}

async function resolveNativeMrvActor(
  client: PrismaClient,
  actorId: string,
  role: CanopyProofMrvActorSnapshot["role"],
): Promise<CanopyProofMrvActorSnapshot> {
  const rows = await client.$queryRaw<Array<{
    organization_id: string;
    subject_hash: string;
    organization_root: string;
    membership_id: string;
    membership_status: "active";
    membership_root: string;
    accreditation_id: string;
    accreditation_status: "approved";
    accreditation_root: string;
    accreditation_scope: string[];
  }>>(Prisma.sql`
    SELECT
      participant.organization_id,
      participant.subject_hash,
      organization.profile_hash AS organization_root,
      membership.id AS membership_id,
      membership.status AS membership_status,
      membership.audit_event_root AS membership_root,
      accreditation.id AS accreditation_id,
      accreditation.status AS accreditation_status,
      accreditation.audit_event_root AS accreditation_root,
      accreditation.scope AS accreditation_scope
    FROM identity.participants participant
    JOIN organizations.organizations organization
      ON organization.id = participant.organization_id
    JOIN organizations.memberships membership
      ON membership.organization_id = organization.id
     AND membership.actor_id = participant.id
     AND membership.role = ${role}
     AND membership.status = 'active'
    JOIN organizations.accreditations accreditation
      ON accreditation.organization_id = organization.id
     AND accreditation.status = 'approved'
    WHERE participant.id = ${actorId}
      AND participant.participant_type = 'human'
      AND participant.verification_status = 'verified'
      AND ${role} = ANY(participant.roles)
    ORDER BY accreditation.decided_at DESC, accreditation.id DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new Error(`CANOPYPROOF_NATIVE_MRV_ACTOR_NOT_FOUND:${actorId}`);
  const seed = {
    id: actorId,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId: row.organization_id,
    organizationVerificationStatus: "verified" as const,
    participantRoot: row.subject_hash,
    organizationRoot: row.organization_root,
    membershipId: row.membership_id,
    membershipStatus: row.membership_status,
    membershipRoot: row.membership_root,
    accreditationId: row.accreditation_id,
    accreditationStatus: row.accreditation_status,
    accreditationRoot: row.accreditation_root,
    accreditationScope: [...row.accreditation_scope].sort(),
  };
  return { ...seed, authorityRoot: canopyProofMrvActorAuthorityRoot(seed) };
}

async function resolveNativeVerificationActor(
  client: PrismaClient,
  actorId: string,
  role: Exclude<CanopyProofVerificationActorSnapshot["role"], "agent">,
): Promise<CanopyProofVerificationActorSnapshot> {
  const rows = await client.$queryRaw<Array<{
    organization_id: string;
    subject_hash: string;
    organization_root: string;
    membership_id: string;
    membership_status: "active";
    membership_root: string;
    accreditation_id: string;
    accreditation_status: "approved";
    accreditation_root: string;
    accreditation_scope: string[];
  }>>(Prisma.sql`
    SELECT
      participant.organization_id,
      participant.subject_hash,
      organization.profile_hash AS organization_root,
      membership.id AS membership_id,
      membership.status AS membership_status,
      membership.audit_event_root AS membership_root,
      accreditation.id AS accreditation_id,
      accreditation.status AS accreditation_status,
      accreditation.audit_event_root AS accreditation_root,
      accreditation.scope AS accreditation_scope
    FROM identity.participants participant
    JOIN organizations.organizations organization
      ON organization.id = participant.organization_id
    JOIN organizations.memberships membership
      ON membership.organization_id = organization.id
     AND membership.actor_id = participant.id
     AND membership.role = ${role}
     AND membership.status = 'active'
    JOIN organizations.accreditations accreditation
      ON accreditation.organization_id = organization.id
     AND accreditation.status = 'approved'
    WHERE participant.id = ${actorId}
      AND participant.participant_type = 'human'
      AND participant.verification_status = 'verified'
      AND ${role} = ANY(participant.roles)
    ORDER BY accreditation.decided_at DESC, accreditation.id DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new Error(`CANOPYPROOF_NATIVE_VERIFICATION_ACTOR_NOT_FOUND:${actorId}`);
  const seed = {
    id: actorId,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId: row.organization_id,
    organizationVerificationStatus: "verified" as const,
    participantRoot: row.subject_hash,
    organizationRoot: row.organization_root,
    membershipId: row.membership_id,
    membershipStatus: row.membership_status,
    membershipRoot: row.membership_root,
    accreditationId: row.accreditation_id,
    accreditationStatus: row.accreditation_status,
    accreditationRoot: row.accreditation_root,
    accreditationScope: [...row.accreditation_scope].sort(),
  };
  return {
    ...seed,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...seed }),
  };
}

function nativeManagedSignatureVerifier(
  externalVerifierId: string,
  runId: string,
): CanopyProofEnvironmentalProofManagedSignatureVerifier {
  return {
    async verifyManagedKeyAttestation(request) {
      return nativeExternalVerificationReceipt(
        "managed-key-attestation",
        externalVerifierId,
        runId,
        request.requestedAt,
        request,
      );
    },
    async verifyDetachedSignature(request) {
      return nativeExternalVerificationReceipt(
        "detached-signature",
        externalVerifierId,
        runId,
        new Date(Date.parse(request.signedAt) + 1).toISOString(),
        request,
      );
    },
  };
}

function nativeExternalVerificationReceipt(
  kind: string,
  externalVerifierId: string,
  runId: string,
  verifiedAt: string,
  request: unknown,
): CanopyProofExternalVerificationReceipt {
  return {
    verified: true,
    externalVerifierId,
    providerReceiptIdHash: hashJson({ kind: `${kind}-receipt-id`, runId, request }),
    providerReceiptHash: hashJson({ kind: `${kind}-receipt`, runId, request }),
    verifiedAt,
  };
}

function timestamp(offsetSeconds: number) {
  const base = Date.UTC(2026, 6, 11, 0, 0, 0, 0);
  return new Date(base + offsetSeconds * 1_000).toISOString();
}
