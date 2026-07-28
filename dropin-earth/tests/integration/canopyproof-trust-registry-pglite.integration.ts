import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson, merkleRoot } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";
import { appendCanopyProofAuditEvent, verifyCanopyProofAuditChain } from "../../services/api/src/domain/canopyproof/proof-engine.js";

test("CanopyProof trust registry reconstructs agreement, access, and export governance through PostgreSQL", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const actorId = "cp_pglite_trust_owner";

  try {
    await db.exec(contract);
    await db.exec(contract);
    const challengeTriggerRows = await db.query<{ tgname: string }>(
      `SELECT tgname
       FROM pg_trigger
       WHERE tgrelid = 'organizations.data_access_accountability_disclosure_challenges'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      challengeTriggerRows.rows.map((row) => row.tgname),
      [
        "org_data_access_disclosure_challenge_audit",
        "org_data_access_disclosure_challenge_event_binding",
        "org_data_access_disclosure_challenge_no_delete",
        "org_data_access_disclosure_challenge_no_update",
        "org_data_access_disclosure_challenge_validate",
      ],
    );
    const resolutionTriggerRows = await db.query<{ tgname: string }>(
      `SELECT tgname
       FROM pg_trigger
       WHERE tgrelid = 'organizations.data_access_accountability_disclosure_resolutions'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      resolutionTriggerRows.rows.map((row) => row.tgname),
      [
        "org_data_access_disclosure_resolution_audit",
        "org_data_access_disclosure_resolution_event_binding",
        "org_data_access_disclosure_resolution_no_delete",
        "org_data_access_disclosure_resolution_no_update",
        "org_data_access_disclosure_resolution_validate",
      ],
    );
    const resolutionIndexRows = await db.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'organizations'
         AND tablename = 'data_access_accountability_disclosure_resolutions'
         AND indexname LIKE 'org_data_access_disclosure_resolution_one_%'
       ORDER BY indexname`,
    );
    assert.deepEqual(
      resolutionIndexRows.rows.map((row) => row.indexname),
      [
        "org_data_access_disclosure_resolution_one_final",
        "org_data_access_disclosure_resolution_one_root",
        "org_data_access_disclosure_resolution_one_successor",
      ],
    );
    const noticeTriggerRows = await db.query<{ tgname: string }>(
      `SELECT tgname
       FROM pg_trigger
       WHERE tgrelid = 'organizations.data_access_accountability_disclosure_notices'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      noticeTriggerRows.rows.map((row) => row.tgname),
      [
        "org_data_access_disclosure_notice_audit",
        "org_data_access_disclosure_notice_event_binding",
        "org_data_access_disclosure_notice_no_delete",
        "org_data_access_disclosure_notice_no_update",
        "org_data_access_disclosure_notice_validate",
      ],
    );
    await insertBootstrapOwner(db, actorId);
    const service = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    const organization = await service.registerOrganization(
      {
        id: "cp_pglite_data_governance_org",
        name: "PGlite Data Governance Institute",
        organizationType: "auditor",
        jurisdiction: "GLOBAL",
        publicContact: "pglite-governance@example.org",
        operatingRegions: ["global"],
        verificationCapabilities: ["independent data governance review"],
        documents: [],
        authorizedUsers: [actorId],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-11T04:00:00.000Z",
      },
      actorId,
      "pglite-organization-create",
    );

    const activeAgreementInput = {
      datasetScopes: ["proof summaries", "method metadata"],
      privacyTier: "restricted",
      permittedUses: ["institutional review"],
      expiresAt: "2027-07-11T04:00:00.000Z",
      createdAt: "2026-07-11T04:01:00.000Z",
    } as const;
    const activeAgreement = await service.createDataSharingAgreement(
      organization.id,
      activeAgreementInput,
      actorId,
      "pglite-agreement-active",
    );
    const replayedAgreement = await service.createDataSharingAgreement(
      organization.id,
      activeAgreementInput,
      actorId,
      "pglite-agreement-active",
    );
    assert.equal(replayedAgreement.id, activeAgreement.id);

    const revocableAgreement = await service.createDataSharingAgreement(
      organization.id,
      {
        datasetScopes: ["public project summaries"],
        privacyTier: "public",
        permittedUses: ["public accountability review"],
        expiresAt: "2027-07-11T04:00:00.000Z",
        createdAt: "2026-07-11T04:02:00.000Z",
      },
      actorId,
      "pglite-agreement-revocable",
    );
    const revocation = await service.revokeDataSharingAgreement(
      revocableAgreement.id,
      {
        rationale: "Institutional governance withdrew this agreement after a bounded review.",
        evidenceEventRoots: ["a".repeat(64)],
        revokedAt: "2026-07-11T04:03:00.000Z",
      },
      actorId,
      "pglite-agreement-revocation",
    );
    assert.equal((await service.getDataSharingAgreementRevocation(revocation.id)).revocationRoot, revocation.revocationRoot);

    const predecessor = await service.createDataSharingAgreement(
      organization.id,
      {
        datasetScopes: ["method summaries"],
        privacyTier: "restricted",
        permittedUses: ["research review"],
        expiresAt: "2027-07-11T04:00:00.000Z",
        createdAt: "2026-07-11T04:04:00.000Z",
      },
      actorId,
      "pglite-agreement-predecessor",
    );
    const supersession = await service.supersedeDataSharingAgreement(
      predecessor.id,
      {
        transitionType: "renewal",
        successor: {
          datasetScopes: ["method summaries"],
          privacyTier: "restricted",
          permittedUses: ["research review"],
          expiresAt: "2028-07-11T04:00:00.000Z",
        },
        rationale: "Renew the unchanged least-privilege agreement after independent governance review.",
        evidenceEventRoots: ["b".repeat(64)],
        supersededAt: "2026-07-11T04:05:00.000Z",
      },
      actorId,
      "pglite-agreement-supersession",
    );
    assert.equal(
      (await service.getDataSharingAgreementSupersession(supersession.id)).supersessionRoot,
      supersession.supersessionRoot,
    );

    const agreements = await service.listDataSharingAgreements(organization.id);
    assert.equal(agreements.length, 4);
    assert.equal(agreements.find((agreement) => agreement.id === activeAgreement.id)?.revoked, false);
    assert.equal(agreements.find((agreement) => agreement.id === revocableAgreement.id)?.revoked, true);
    assert.equal(agreements.find((agreement) => agreement.id === predecessor.id)?.superseded, true);
    assert.equal(
      agreements.find((agreement) => agreement.id === supersession.successorAgreementId)?.supersedesAgreementId,
      predecessor.id,
    );
    assert.equal((await service.listDataSharingAgreementRevocations(revocableAgreement.id)).length, 1);
    assert.equal((await service.listDataSharingAgreementSupersessions(predecessor.id)).length, 1);

    const requesterId = "cp_pglite_data_requester";
    const verifierId = "cp_pglite_data_verifier";
    const reviewerId = "cp_pglite_data_enforcement_reviewer";
    const restrictionApproverId = "cp_pglite_data_restriction_approver";
    const restorationApproverId = "cp_pglite_data_restoration_approver";
    const noticePublisherId = "cp_pglite_data_notice_publisher";
    await service.updateOrganizationVerification(
      organization.id,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "PGLITE-GOV-001",
        documents: [
          {
            documentType: "registration",
            documentHash: "c".repeat(64),
            issuedBy: "PGlite Test Registry",
            uploadedAt: "2026-07-11T04:06:00.000Z",
          },
        ],
        authorizedUsers: [
          actorId,
          requesterId,
          verifierId,
          reviewerId,
          restrictionApproverId,
          restorationApproverId,
          noticePublisherId,
        ],
        rationale: "Verified for deterministic governed data-access integration testing.",
        reviewedAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-organization-verify",
    );
    await service.registerParticipant(
      {
        id: requesterId,
        participantType: "human",
        displayName: "PGlite Institutional Researcher",
        organizationId: organization.id,
        roles: ["researcher"],
        verificationStatus: "verified",
        credentialCommitments: ["d".repeat(64)],
        createdAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-requester-register",
    );
    await service.registerParticipant(
      {
        id: verifierId,
        participantType: "human",
        displayName: "PGlite Independent Verifier",
        organizationId: organization.id,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["e".repeat(64)],
        createdAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-verifier-register",
    );
    await service.registerParticipant(
      {
        id: reviewerId,
        participantType: "human",
        displayName: "PGlite Independent Enforcement Reviewer",
        organizationId: organization.id,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["f".repeat(64)],
        createdAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-enforcement-reviewer-register",
    );
    await service.registerParticipant(
      {
        id: restrictionApproverId,
        participantType: "human",
        displayName: "PGlite Restriction Approver",
        organizationId: organization.id,
        roles: ["owner"],
        verificationStatus: "verified",
        credentialCommitments: ["1".repeat(64)],
        createdAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-restriction-approver-register",
    );
    await service.registerParticipant(
      {
        id: restorationApproverId,
        participantType: "human",
        displayName: "PGlite Restoration Approver",
        organizationId: organization.id,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["2".repeat(64)],
        createdAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-restoration-approver-register",
    );
    await service.registerParticipant(
      {
        id: noticePublisherId,
        participantType: "human",
        displayName: "PGlite Independent Notice Publisher",
        organizationId: organization.id,
        roles: ["owner"],
        verificationStatus: "verified",
        credentialCommitments: ["3".repeat(64)],
        createdAt: "2026-07-11T04:06:00.000Z",
      },
      actorId,
      "pglite-notice-publisher-register",
    );
    await service.grantMembership(
      organization.id,
      {
        actorId: requesterId,
        role: "researcher",
        conflictDisclosure: "Research access is separated from institutional approval authority.",
        grantedAt: "2026-07-11T04:07:00.000Z",
      },
      actorId,
      "pglite-requester-membership",
    );
    await service.grantMembership(
      organization.id,
      {
        actorId: verifierId,
        role: "verifier",
        conflictDisclosure: "The verifier has no authorship or requester conflict for this access decision.",
        grantedAt: "2026-07-11T04:08:00.000Z",
      },
      actorId,
      "pglite-verifier-membership",
    );
    await service.grantMembership(
      organization.id,
      {
        actorId: reviewerId,
        role: "admin",
        conflictDisclosure: "The reviewer is separate from requester, delivery actor, and challenge author.",
        grantedAt: "2026-07-11T04:08:30.000Z",
      },
      actorId,
      "pglite-enforcement-reviewer-membership",
    );
    await service.grantMembership(
      organization.id,
      {
        actorId: restrictionApproverId,
        role: "owner",
        conflictDisclosure: "The restriction approver is separate from challenge and enforcement review actors.",
        grantedAt: "2026-07-11T04:08:40.000Z",
      },
      actorId,
      "pglite-restriction-approver-membership",
    );
    await service.grantMembership(
      organization.id,
      {
        actorId: restorationApproverId,
        role: "admin",
        conflictDisclosure: "The restoration approver is separate from the prior restriction decision actor.",
        grantedAt: "2026-07-11T04:08:50.000Z",
      },
      actorId,
      "pglite-restoration-approver-membership",
    );
    await service.grantMembership(
      organization.id,
      {
        actorId: noticePublisherId,
        role: "owner",
        conflictDisclosure: "The notice publisher is separate from disclosure publication, challenge, and resolution actors.",
        grantedAt: "2026-07-11T04:08:55.000Z",
      },
      actorId,
      "pglite-notice-publisher-membership",
    );

    const requestInput = {
      agreementId: activeAgreement.id,
      datasetScopes: ["proof summaries"],
      permittedUses: ["institutional review"],
      privacyTier: "restricted",
      purpose: "Review bounded proof summaries for independent institutional quality assurance.",
      requestedAt: "2026-07-11T04:09:00.000Z",
      expiresAt: "2027-01-11T04:09:00.000Z",
    } as const;
    const accessRequest = await service.requestDataAccess(
      organization.id,
      requestInput,
      requesterId,
      "pglite-data-access-request",
    );
    const replayedRequest = await service.requestDataAccess(
      organization.id,
      requestInput,
      requesterId,
      "pglite-data-access-request",
    );
    assert.equal(replayedRequest.id, accessRequest.id);
    assert.equal(replayedRequest.status, "pending");

    const approvalInput = {
      status: "approved",
      rationale: "Approved by an independent human verifier within the active agreement boundary.",
      decidedAt: "2026-07-11T04:10:00.000Z",
    } as const;
    const approved = await service.decideDataAccessRequest(
      accessRequest.id,
      approvalInput,
      verifierId,
      "pglite-data-access-approve",
    );
    assert.equal(approved.status, "approved");
    assert.equal(approved.auditEvent.entityType, "data_access_request");
    assert.equal(approved.decisionAuditEvent?.entityType, "data_access_request_decision");

    const revoked = await service.decideDataAccessRequest(
      accessRequest.id,
      {
        status: "revoked",
        rationale: "Revoked after the bounded institutional review window was administratively closed.",
        decidedAt: "2026-07-11T04:11:00.000Z",
      },
      verifierId,
      "pglite-data-access-revoke",
    );
    assert.equal(revoked.status, "revoked");
    assert.equal((await service.getDataAccessRequest(accessRequest.id)).status, "revoked");
    assert.equal((await service.listDataAccessRequests(organization.id)).length, 1);

    const replayedCreationAfterRevocation = await service.requestDataAccess(
      organization.id,
      requestInput,
      requesterId,
      "pglite-data-access-request",
    );
    assert.equal(replayedCreationAfterRevocation.status, "pending");

    const replayedApproval = await service.decideDataAccessRequest(
      accessRequest.id,
      approvalInput,
      verifierId,
      "pglite-data-access-approve",
    );
    assert.equal(replayedApproval.status, "approved");
    assert.equal(replayedApproval.decisionAuditEvent?.eventRoot, approved.decisionAuditEvent?.eventRoot);

    const manifestInput = {
      id: "cp_pglite_audit_export_manifest",
      kind: "institutional_audit_packet",
      scope: "organization",
      subjectId: organization.id,
      requesterOrganizationId: organization.id,
      purpose: "Hash-only institutional review package for the governed data-access decision lineage.",
      classification: "restricted",
      entries: [
        {
          id: "cp_pglite_audit_export_entry",
          resourceType: "audit_event",
          resourceId: approved.decisionAuditEvent!.id,
          contentHash: approved.requestHash,
          eventRoot: approved.decisionAuditEvent!.eventRoot,
          classification: "restricted",
          redactionPolicy: "confidential_hash_only",
          included: true,
          reason: "Hash-only decision lineage included without raw evidence or private data.",
        },
      ],
      expiresAt: "2027-01-11T04:12:00.000Z",
      createdAt: "2026-07-11T04:12:00.000Z",
    } as const;
    const manifest = await service.createAuditExportManifest(
      manifestInput,
      verifierId,
      "pglite-audit-export-manifest",
    );
    const replayedManifest = await service.createAuditExportManifest(
      manifestInput,
      verifierId,
      "pglite-audit-export-manifest",
    );
    assert.equal(replayedManifest.exportHash, manifest.exportHash);
    assert.equal((await service.listAuditExportManifests(organization.id)).length, 0);
    assert.equal((await service.listAuditExportManifests(organization.id, { includeSensitive: true })).length, 1);
    assert.equal((await service.getAuditExportManifest(manifest.id, organization.id, true)).entryRoot, manifest.entryRoot);
    assert.equal((await service.getAuditExportManifestStatus(organization.id)).manifestCount, 1);
    await assert.rejects(
      service.getAuditExportManifest(manifest.id, "cp_pglite_different_organization", true),
      /not found/,
    );

    const deliveryRequest = await service.requestDataAccess(
      organization.id,
      {
        ...requestInput,
        purpose: "Review a second bounded hash-only package under the active institutional agreement.",
        requestedAt: "2026-07-11T04:13:00.000Z",
        expiresAt: "2027-01-11T04:13:00.000Z",
      },
      requesterId,
      "pglite-data-delivery-request",
    );
    const approvedDeliveryRequest = await service.decideDataAccessRequest(
      deliveryRequest.id,
      {
        status: "approved",
        rationale: "An independent verifier approved the second least-privilege delivery request.",
        decidedAt: "2026-07-11T04:14:00.000Z",
      },
      verifierId,
      "pglite-data-delivery-approve",
    );
    assert.equal(approvedDeliveryRequest.status, "approved");
    const deliveryInput = {
      manifestId: manifest.id,
      manifestRequesterOrganizationId: "cp_untrusted_body_organization",
      manifestHash: "0".repeat(64),
      manifestEntryRoot: "1".repeat(64),
      manifestClassification: "confidential",
      channel: "audit_export_manifest",
      recipientActorId: requesterId,
      purpose: "Deliver the approved hash-only institutional package to the named researcher.",
      deliveredAt: "2026-07-11T04:15:00.000Z",
    } as const;
    const delivery = await service.recordDataAccessDelivery(
      deliveryRequest.id,
      deliveryInput,
      verifierId,
      "pglite-data-delivery-record",
    );
    const replayedDelivery = await service.recordDataAccessDelivery(
      deliveryRequest.id,
      deliveryInput,
      verifierId,
      "pglite-data-delivery-record",
    );
    assert.equal(replayedDelivery.deliveryRoot, delivery.deliveryRoot);
    assert.equal((await service.getDataAccessDeliveryReceipt(delivery.id)).receiptHash, delivery.receiptHash);
    assert.equal((await service.listDataAccessDeliveryReceipts(deliveryRequest.id)).length, 1);
    assert.equal(delivery.manifestHash, manifest.exportHash);
    assert.equal(delivery.manifestEntryRoot, manifest.entryRoot);
    assert.equal(delivery.manifestRequesterOrganizationId, organization.id);
    assert.equal(delivery.manifestClassification, manifest.classification);

    const withinScopeInput = {
      usageState: "within_scope",
      useCase: "Use the redacted hash-only package within the approved institutional review scope.",
      outputHashes: ["7".repeat(64)],
      limitations: ["No raw evidence or private contact data was included."],
      attestedAt: "2026-07-11T04:16:00.000Z",
    } as const;
    const withinScope = await service.recordDataUseAttestation(
      delivery.id,
      withinScopeInput,
      requesterId,
      "pglite-data-use-within-scope",
    );
    const replayedWithinScope = await service.recordDataUseAttestation(
      delivery.id,
      withinScopeInput,
      requesterId,
      "pglite-data-use-within-scope",
    );
    assert.equal(replayedWithinScope.usageRoot, withinScope.usageRoot);
    const misuseChallenge = await service.recordDataUseAttestation(
      delivery.id,
      {
        usageState: "misuse_challenged",
        useCase: "Challenge suspected redistribution beyond the approved institutional review boundary.",
        evidenceEventRoots: ["8".repeat(64)],
        limitations: ["This challenge requires independent human review."],
        attestedAt: "2026-07-11T04:17:00.000Z",
      },
      verifierId,
      "pglite-data-use-challenge",
    );
    assert.equal(misuseChallenge.auditEvent.action, "CHALLENGE");
    assert.equal((await service.getDataUseAttestation(withinScope.id)).attestationHash, withinScope.attestationHash);
    assert.equal((await service.listDataUseAttestations(delivery.id)).length, 2);

    const mismatchedDeliveryEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "FULFILL",
        actor: verifierId,
        entityType: "data_access_delivery_receipt",
        entityId: "cp_pglite_mismatched_delivery",
        payload: { probe: "manifest hash substitution must fail" },
        createdAt: "2026-07-11T04:20:00.000Z",
        rationale: "A manifest-substitution probe must roll back with its semantic event.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            mismatchedDeliveryEvent.id,
            organization.id,
            mismatchedDeliveryEvent.action,
            mismatchedDeliveryEvent.actor,
            mismatchedDeliveryEvent.entityType,
            mismatchedDeliveryEvent.entityId,
            mismatchedDeliveryEvent.previousRoot,
            mismatchedDeliveryEvent.payloadHash,
            mismatchedDeliveryEvent.eventRoot,
            mismatchedDeliveryEvent.createdAt,
            mismatchedDeliveryEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_delivery_receipts (
            id, organization_id, request_id, agreement_id, manifest_id,
            manifest_requester_organization_id, manifest_hash, manifest_entry_root,
            manifest_classification, channel, recipient_actor_id, delivered_by,
            delivered_at, purpose, access_root, receipt_hash, delivery_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $2, $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17::jsonb, $18)`,
          [
            mismatchedDeliveryEvent.entityId,
            organization.id,
            deliveryRequest.id,
            activeAgreement.id,
            manifest.id,
            "0".repeat(64),
            manifest.entryRoot,
            manifest.classification,
            delivery.channel,
            requesterId,
            verifierId,
            mismatchedDeliveryEvent.createdAt,
            "This substituted manifest hash must be rejected by PostgreSQL.",
            delivery.accessRoot,
            "1".repeat(64),
            "2".repeat(64),
            JSON.stringify(delivery.safety),
            mismatchedDeliveryEvent.eventRoot,
          ],
        );
      }),
      /manifest authority lineage mismatch/,
    );
    const rolledBackDeliveryEvent = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE id = $1",
      [mismatchedDeliveryEvent.id],
    );
    assert.equal(String(rolledBackDeliveryEvent.rows[0]?.count), "0");

    const payloadMismatchSeed = {
      organizationId: organization.id,
      requestId: deliveryRequest.id,
      agreementId: activeAgreement.id,
      manifestId: manifest.id,
      manifestRequesterOrganizationId: organization.id,
      manifestHash: manifest.exportHash,
      manifestEntryRoot: manifest.entryRoot,
      manifestClassification: manifest.classification,
      channel: delivery.channel,
      recipientActorId: requesterId,
      deliveredBy: verifierId,
      deliveredAt: "2026-07-11T04:20:00.000Z",
      purpose: "This canonical receipt must reject a mismatched semantic event payload.",
      accessRoot: deliveryRequest.accessRoot,
      safety: delivery.safety,
    } as const;
    const payloadMismatchReceiptHash = hashJson({
      kind: "canopyproof-data-access-delivery-receipt-v1",
      ...payloadMismatchSeed,
    });
    const payloadMismatchDeliveryRoot = hashJson({
      kind: "canopyproof-data-access-delivery-root-v1",
      receiptHash: payloadMismatchReceiptHash,
      requestHash: deliveryRequest.requestHash,
      accessRoot: deliveryRequest.accessRoot,
      manifestHash: manifest.exportHash,
      manifestEntryRoot: manifest.entryRoot,
    });
    const payloadMismatchId = `cp_data_delivery_${payloadMismatchReceiptHash.slice(0, 24)}`;
    const payloadMismatchEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "FULFILL",
        actor: verifierId,
        entityType: "data_access_delivery_receipt",
        entityId: payloadMismatchId,
        payload: { probe: "incorrect payload" },
        createdAt: payloadMismatchSeed.deliveredAt,
        rationale: "A semantic payload mismatch probe must roll back with its canonical receipt.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            payloadMismatchEvent.id,
            organization.id,
            payloadMismatchEvent.action,
            payloadMismatchEvent.actor,
            payloadMismatchEvent.entityType,
            payloadMismatchEvent.entityId,
            payloadMismatchEvent.previousRoot,
            payloadMismatchEvent.payloadHash,
            payloadMismatchEvent.eventRoot,
            payloadMismatchEvent.createdAt,
            payloadMismatchEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_delivery_receipts (
            id, organization_id, request_id, agreement_id, manifest_id,
            manifest_requester_organization_id, manifest_hash, manifest_entry_root,
            manifest_classification, channel, recipient_actor_id, delivered_by,
            delivered_at, purpose, access_root, receipt_hash, delivery_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18::jsonb, $19)`,
          [
            payloadMismatchId,
            payloadMismatchSeed.organizationId,
            payloadMismatchSeed.requestId,
            payloadMismatchSeed.agreementId,
            payloadMismatchSeed.manifestId,
            payloadMismatchSeed.manifestRequesterOrganizationId,
            payloadMismatchSeed.manifestHash,
            payloadMismatchSeed.manifestEntryRoot,
            payloadMismatchSeed.manifestClassification,
            payloadMismatchSeed.channel,
            payloadMismatchSeed.recipientActorId,
            payloadMismatchSeed.deliveredBy,
            payloadMismatchSeed.deliveredAt,
            payloadMismatchSeed.purpose,
            payloadMismatchSeed.accessRoot,
            payloadMismatchReceiptHash,
            payloadMismatchDeliveryRoot,
            JSON.stringify(payloadMismatchSeed.safety),
            payloadMismatchEvent.eventRoot,
          ],
        );
      }),
      /semantic event payload does not match the canonical receipt/,
    );

    await service.decideDataAccessRequest(
      deliveryRequest.id,
      {
        status: "revoked",
        rationale: "Withdraw future use authority while preserving prior use and challenge attestations.",
        decidedAt: "2026-07-11T04:18:00.000Z",
      },
      verifierId,
      "pglite-data-delivery-request-revoke",
    );
    const noUse = await service.recordDataUseAttestation(
      delivery.id,
      {
        usageState: "no_use",
        useCase: "Confirm no additional use occurred after the governed request was revoked.",
        limitations: ["No output hash exists because no later use occurred."],
        attestedAt: "2026-07-11T04:19:00.000Z",
      },
      requesterId,
      "pglite-data-use-no-use",
    );
    assert.equal(noUse.usageState, "no_use");
    await assert.rejects(
      service.recordDataUseAttestation(
        delivery.id,
        {
          ...withinScopeInput,
          useCase: "Attempt to assert continued use after the request was revoked.",
          attestedAt: "2026-07-11T04:20:00.000Z",
        },
        requesterId,
        "pglite-data-use-after-revocation",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
    );
    assert.equal((await service.listDataUseAttestations(delivery.id)).length, 3);

    await assert.rejects(
      service.recordDataUseEnforcementCase(
        misuseChallenge.id,
        {
          caseState: "under_review",
          enforcementAction: "notify_partner",
          rationale: "The challenge author and delivery actor cannot review their own challenge.",
          evidenceEventRoots: ["a".repeat(64)],
          reviewedAt: "2026-07-11T04:19:30.000Z",
        },
        verifierId,
        "pglite-data-use-enforcement-self-review",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
    );
    const enforcementInput = {
      caseState: "remediation_required",
      enforcementAction: "require_remediation",
      rationale: "Preserve challenged hash lineage for independent institutional review after access revocation.",
      evidenceEventRoots: ["a".repeat(64)],
      reviewedAt: "2026-07-11T04:19:30.000Z",
    } as const;
    const enforcementCase = await service.recordDataUseEnforcementCase(
      misuseChallenge.id,
      enforcementInput,
      reviewerId,
      "pglite-data-use-enforcement-record",
    );
    const replayedEnforcementCase = await service.recordDataUseEnforcementCase(
      misuseChallenge.id,
      enforcementInput,
      reviewerId,
      "pglite-data-use-enforcement-record",
    );
    assert.equal(replayedEnforcementCase.enforcementRoot, enforcementCase.enforcementRoot);
    assert.equal((await service.getDataUseEnforcementCase(enforcementCase.id)).enforcementHash, enforcementCase.enforcementHash);
    assert.equal((await service.listDataUseEnforcementCases(misuseChallenge.id)).length, 1);
    assert.deepEqual(enforcementCase.evidenceEventRoots, ["8".repeat(64), "a".repeat(64)]);

    await assert.rejects(
      service.recordDataAccessRestriction(
        enforcementCase.id,
        {
          restrictionState: "remediation_hold",
          rationale: "The enforcement reviewer cannot approve the resulting access restriction.",
          evidenceEventRoots: ["c".repeat(64)],
          decidedAt: "2026-07-11T04:19:40.000Z",
        },
        reviewerId,
        "pglite-data-access-restriction-self-approve",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
    );
    const restrictionInput = {
      restrictionState: "remediation_hold",
      rationale: "Hold future governed delivery until independent remediation evidence is accepted.",
      evidenceEventRoots: ["c".repeat(64)],
      decidedAt: "2026-07-11T04:19:40.000Z",
      expiresAt: "2026-08-11T04:19:40.000Z",
    } as const;
    const restriction = await service.recordDataAccessRestriction(
      enforcementCase.id,
      restrictionInput,
      restrictionApproverId,
      "pglite-data-access-restriction-record",
    );
    const replayedRestriction = await service.recordDataAccessRestriction(
      enforcementCase.id,
      restrictionInput,
      restrictionApproverId,
      "pglite-data-access-restriction-record",
    );
    assert.equal(replayedRestriction.restrictionRoot, restriction.restrictionRoot);
    assert.equal(restriction.previousRestrictionId, undefined);
    const activeRestrictionRows = await db.query<{ restricted: boolean }>(
      "SELECT organizations.data_access_request_is_restricted($1) AS restricted",
      [deliveryRequest.id],
    );
    assert.equal(activeRestrictionRows.rows[0]?.restricted, true);

    const resolvedEnforcementCase = await service.recordDataUseEnforcementCase(
      misuseChallenge.id,
      {
        caseState: "resolved",
        enforcementAction: "notify_partner",
        rationale: "Independent review accepted remediation evidence while preserving the challenge history.",
        evidenceEventRoots: ["d".repeat(64)],
        reviewedAt: "2026-07-11T04:19:50.000Z",
      },
      reviewerId,
      "pglite-data-use-enforcement-resolved",
    );
    const restoredRestriction = await service.recordDataAccessRestriction(
      resolvedEnforcementCase.id,
      {
        restrictionState: "restored",
        rationale: "Restore only the restriction layer after resolved review and separate approval.",
        evidenceEventRoots: ["e".repeat(64)],
        decidedAt: "2026-07-11T04:20:00.000Z",
      },
      restorationApproverId,
      "pglite-data-access-restriction-restore",
    );
    assert.equal(restoredRestriction.previousRestrictionId, restriction.id);
    assert.equal(restoredRestriction.previousRestrictionRoot, restriction.restrictionRoot);
    assert.equal((await service.getDataAccessRestriction(restoredRestriction.id)).restrictionState, "restored");
    assert.equal((await service.listDataAccessRestrictions(deliveryRequest.id)).length, 2);
    const restoredRestrictionRows = await db.query<{ restricted: boolean }>(
      "SELECT organizations.data_access_request_is_restricted($1) AS restricted",
      [deliveryRequest.id],
    );
    assert.equal(restoredRestrictionRows.rows[0]?.restricted, false);

    const suspensionEnforcementCase = await service.recordDataUseEnforcementCase(
      misuseChallenge.id,
      {
        caseState: "access_suspended",
        enforcementAction: "suspend_data_access",
        rationale: "A later independent review recommends suspension after new challenge evidence was received.",
        evidenceEventRoots: ["f".repeat(64)],
        reviewedAt: "2026-07-11T04:20:10.000Z",
      },
      reviewerId,
      "pglite-data-use-enforcement-suspension",
    );
    const restrictionPayloadMismatchSeed = {
      organizationId: organization.id,
      requestId: deliveryRequest.id,
      enforcementCaseId: suspensionEnforcementCase.id,
      attestationId: misuseChallenge.id,
      deliveryId: delivery.id,
      previousRestrictionId: restoredRestriction.id,
      previousRestrictionRoot: restoredRestriction.restrictionRoot,
      previousRestrictionState: restoredRestriction.restrictionState,
      restrictionState: "suspended",
      rationale: "This canonical suspension must reject a mismatched semantic event payload.",
      evidenceEventRoots: [...suspensionEnforcementCase.evidenceEventRoots, "7".repeat(64)].sort(),
      decidedBy: restrictionApproverId,
      decidedAt: "2026-07-11T04:20:20.000Z",
      expiresAt: null,
      enforcementRoot: suspensionEnforcementCase.enforcementRoot,
      usageRoot: misuseChallenge.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      safety: restriction.safety,
    } as const;
    const restrictionPayloadMismatchHash = hashJson({
      kind: "canopyproof-data-access-restriction-v1",
      ...restrictionPayloadMismatchSeed,
    });
    const restrictionPayloadMismatchRoot = hashJson({
      kind: "canopyproof-data-access-restriction-root-v1",
      restrictionHash: restrictionPayloadMismatchHash,
      enforcementRoot: suspensionEnforcementCase.enforcementRoot,
      usageRoot: misuseChallenge.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      evidenceEventRoots: restrictionPayloadMismatchSeed.evidenceEventRoots,
      previousRestrictionRoot: restoredRestriction.restrictionRoot,
    });
    const restrictionPayloadMismatchId = `cp_data_access_restriction_${restrictionPayloadMismatchHash.slice(0, 24)}`;
    const restrictionPayloadMismatchEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "CHALLENGE",
        actor: restrictionApproverId,
        entityType: "data_access_restriction",
        entityId: restrictionPayloadMismatchId,
        payload: { probe: "incorrect restriction payload" },
        createdAt: restrictionPayloadMismatchSeed.decidedAt,
        rationale: "A restriction semantic payload mismatch probe must roll back atomically.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restrictionApproverId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            restrictionPayloadMismatchEvent.id,
            organization.id,
            restrictionPayloadMismatchEvent.action,
            restrictionPayloadMismatchEvent.actor,
            restrictionPayloadMismatchEvent.entityType,
            restrictionPayloadMismatchEvent.entityId,
            restrictionPayloadMismatchEvent.previousRoot,
            restrictionPayloadMismatchEvent.payloadHash,
            restrictionPayloadMismatchEvent.eventRoot,
            restrictionPayloadMismatchEvent.createdAt,
            restrictionPayloadMismatchEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_restrictions (
            id, organization_id, request_id, enforcement_case_id,
            attestation_id, delivery_id, previous_restriction_id,
            previous_restriction_root, previous_restriction_state,
            restriction_state, rationale, evidence_event_roots, decided_by,
            decided_at, expires_at, restriction_hash, restriction_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12::text[], $13, $14, NULL, $15, $16, $17::jsonb, $18)`,
          [
            restrictionPayloadMismatchId,
            restrictionPayloadMismatchSeed.organizationId,
            restrictionPayloadMismatchSeed.requestId,
            restrictionPayloadMismatchSeed.enforcementCaseId,
            restrictionPayloadMismatchSeed.attestationId,
            restrictionPayloadMismatchSeed.deliveryId,
            restrictionPayloadMismatchSeed.previousRestrictionId,
            restrictionPayloadMismatchSeed.previousRestrictionRoot,
            restrictionPayloadMismatchSeed.previousRestrictionState,
            restrictionPayloadMismatchSeed.restrictionState,
            restrictionPayloadMismatchSeed.rationale,
            restrictionPayloadMismatchSeed.evidenceEventRoots,
            restrictionPayloadMismatchSeed.decidedBy,
            restrictionPayloadMismatchSeed.decidedAt,
            restrictionPayloadMismatchHash,
            restrictionPayloadMismatchRoot,
            JSON.stringify(restrictionPayloadMismatchSeed.safety),
            restrictionPayloadMismatchEvent.eventRoot,
          ],
        );
      }),
      /data access restriction semantic event payload does not match the canonical decision/,
    );

    const suspendedRestrictionInput = {
      restrictionState: "suspended",
      rationale: "Suspend future governed delivery after a later independent review recommendation.",
      evidenceEventRoots: ["7".repeat(64)],
      decidedAt: "2026-07-11T04:20:20.000Z",
    } as const;
    const suspendedRestriction = await service.recordDataAccessRestriction(
      suspensionEnforcementCase.id,
      suspendedRestrictionInput,
      restrictionApproverId,
      "pglite-data-access-restriction-suspend",
    );
    assert.equal(suspendedRestriction.previousRestrictionId, restoredRestriction.id);
    assert.equal((await service.listDataAccessRestrictions(deliveryRequest.id)).length, 3);
    const suspendedRestrictionRows = await db.query<{ restricted: boolean }>(
      "SELECT organizations.data_access_request_is_restricted($1) AS restricted",
      [deliveryRequest.id],
    );
    assert.equal(suspendedRestrictionRows.rows[0]?.restricted, true);

    const stalePredecessorEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "CHALLENGE",
        actor: restorationApproverId,
        entityType: "data_access_restriction",
        entityId: "cp_data_access_restriction_stale_predecessor",
        payload: { probe: "stale predecessor" },
        createdAt: "2026-07-11T04:20:30.000Z",
        rationale: "A stale predecessor must not fork the durable restriction state stream.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restorationApproverId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            stalePredecessorEvent.id,
            organization.id,
            stalePredecessorEvent.action,
            stalePredecessorEvent.actor,
            stalePredecessorEvent.entityType,
            stalePredecessorEvent.entityId,
            stalePredecessorEvent.previousRoot,
            stalePredecessorEvent.payloadHash,
            stalePredecessorEvent.eventRoot,
            stalePredecessorEvent.createdAt,
            stalePredecessorEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_restrictions (
            id, organization_id, request_id, enforcement_case_id,
            attestation_id, delivery_id, previous_restriction_id,
            previous_restriction_root, previous_restriction_state,
            restriction_state, rationale, evidence_event_roots, decided_by,
            decided_at, expires_at, restriction_hash, restriction_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'suspended', $10,
            $11::text[], $12, $13, NULL, $14, $15, $16::jsonb, $17)`,
          [
            stalePredecessorEvent.entityId,
            organization.id,
            deliveryRequest.id,
            suspensionEnforcementCase.id,
            misuseChallenge.id,
            delivery.id,
            restoredRestriction.id,
            restoredRestriction.restrictionRoot,
            restoredRestriction.restrictionState,
            "This decision deliberately consumes a stale restriction predecessor.",
            suspensionEnforcementCase.evidenceEventRoots,
            restorationApproverId,
            stalePredecessorEvent.createdAt,
            "3".repeat(64),
            "4".repeat(64),
            JSON.stringify(restriction.safety),
            stalePredecessorEvent.eventRoot,
          ],
        );
      }),
      /predecessor does not match current semantic state/,
    );

    const accountabilityPacketInput = {
      intendedAudience: "independent institutional accountability reviewer",
      generatedAt: "2026-07-11T04:20:30.000Z",
    } as const;
    const accountabilityPacket = await service.createDataAccessAccountabilityPacket(
      deliveryRequest.id,
      accountabilityPacketInput,
      reviewerId,
      "pglite-data-access-accountability-packet",
    );
    const replayedAccountabilityPacket = await service.createDataAccessAccountabilityPacket(
      deliveryRequest.id,
      accountabilityPacketInput,
      reviewerId,
      "pglite-data-access-accountability-packet",
    );
    assert.equal(replayedAccountabilityPacket.packetRoot, accountabilityPacket.packetRoot);
    await assert.rejects(
      service.createDataAccessAccountabilityPacket(
        deliveryRequest.id,
        { ...accountabilityPacketInput, intendedAudience: "conflicting packet audience" },
        reviewerId,
        "pglite-data-access-accountability-packet",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
        error.httpStatus === 409,
    );
    assert.equal(accountabilityPacket.requestStatus, "revoked");
    assert.equal(accountabilityPacket.counts.deliveryReceiptCount, 1);
    assert.equal(accountabilityPacket.counts.dataUseAttestationCount, 3);
    assert.equal(accountabilityPacket.counts.enforcementCaseCount, 3);
    assert.equal(accountabilityPacket.counts.activeRestrictionCount, 1);
    assert.equal(accountabilityPacket.counts.totalRestrictionCount, 3);
    assert.equal(accountabilityPacket.lineageRoots.restrictionRoots.length, 3);
    assert.equal((await service.listDataAccessAccountabilityPackets(deliveryRequest.id)).length, 1);
    assert.equal(
      (await service.getDataAccessAccountabilityPacket(accountabilityPacket.id)).packetHash,
      accountabilityPacket.packetHash,
    );
    const accountabilityPacketRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_packets WHERE id = $1",
      [accountabilityPacket.id],
    );
    assert.equal(String(accountabilityPacketRows.rows[0]?.count), "1");
    const accountabilityPacketReceiptRows = await db.query<{ count: number | bigint }>(
      `SELECT count(*)::bigint AS count
       FROM audit.command_receipts
       WHERE actor_id = $1
         AND operation = 'organization.data-access-accountability-packet.create'
         AND result_entity_id = $2`,
      [reviewerId, accountabilityPacket.id],
    );
    assert.equal(String(accountabilityPacketReceiptRows.rows[0]?.count), "1");

    const accountabilityVerificationInput = {
      expectedPacketRoot: accountabilityPacket.packetRoot,
      verifiedAt: "2026-07-11T04:20:31.000Z",
    } as const;
    const accountabilityVerification = await service.verifyDataAccessAccountabilityPacket(
      accountabilityPacket.id,
      accountabilityVerificationInput,
      verifierId,
      "pglite-data-access-accountability-verification",
    );
    const replayedAccountabilityVerification = await service.verifyDataAccessAccountabilityPacket(
      accountabilityPacket.id,
      accountabilityVerificationInput,
      verifierId,
      "pglite-data-access-accountability-verification",
    );
    assert.equal(replayedAccountabilityVerification.verificationRoot, accountabilityVerification.verificationRoot);
    await assert.rejects(
      service.verifyDataAccessAccountabilityPacket(
        accountabilityPacket.id,
        { ...accountabilityVerificationInput, expectedPacketRoot: "0".repeat(64) },
        verifierId,
        "pglite-data-access-accountability-verification",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
        error.httpStatus === 409,
    );
    assert.equal(accountabilityVerification.valid, true);
    assert.deepEqual(accountabilityVerification.issues, []);
    assert.equal(accountabilityVerification.auditEvent.action, "ASSERT");
    assert.equal((await service.listDataAccessAccountabilityVerifications(accountabilityPacket.id)).length, 1);
    assert.equal(
      (await service.getDataAccessAccountabilityVerification(accountabilityVerification.id)).verificationRoot,
      accountabilityVerification.verificationRoot,
    );
    const accountabilityVerificationRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_verifications WHERE id = $1",
      [accountabilityVerification.id],
    );
    assert.equal(String(accountabilityVerificationRows.rows[0]?.count), "1");

    const accountabilityDisclosureInput = {
      verificationId: accountabilityVerification.id,
      publishedAt: "2026-07-11T04:20:31.000Z",
    } as const;
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosure(
        accountabilityPacket.id,
        accountabilityDisclosureInput,
        reviewerId,
        "pglite-data-access-accountability-disclosure-generator-self-publish",
      ),
      /requires separate packet generator, replay verifier, and publisher actors/,
    );
    const accountabilityDisclosure = await service.publishDataAccessAccountabilityDisclosure(
      accountabilityPacket.id,
      accountabilityDisclosureInput,
      restrictionApproverId,
      "pglite-data-access-accountability-disclosure",
    );
    const replayedAccountabilityDisclosure = await service.publishDataAccessAccountabilityDisclosure(
      accountabilityPacket.id,
      accountabilityDisclosureInput,
      restrictionApproverId,
      "pglite-data-access-accountability-disclosure",
    );
    assert.equal(replayedAccountabilityDisclosure.disclosureRoot, accountabilityDisclosure.disclosureRoot);
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosure(
        accountabilityPacket.id,
        { ...accountabilityDisclosureInput, publishedAt: "2026-07-11T04:20:31.001Z" },
        restrictionApproverId,
        "pglite-data-access-accountability-disclosure",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
        error.httpStatus === 409,
    );
    assert.equal(accountabilityDisclosure.currentState, "current");
    assert.equal(accountabilityDisclosure.governanceState, "unchallenged");
    assert.deepEqual(accountabilityDisclosure.currentIssues, []);
    const disclosureIndex = await service.getDataAccessAccountabilityDisclosureIndex({
      organizationId: organization.id,
      currentState: "current",
      governanceState: "unchallenged",
      limit: 1,
    });
    assert.equal(disclosureIndex.totalCount, 1);
    assert.equal(disclosureIndex.items[0]?.id, accountabilityDisclosure.id);
    assert.equal(disclosureIndex.nextCursor, undefined);
    assert.equal(disclosureIndex.safety.hashOnly, true);
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id)).disclosureRoot,
      accountabilityDisclosure.disclosureRoot,
    );
    const disclosureStatus = await service.getDataAccessAccountabilityDisclosureStatus();
    assert.equal(disclosureStatus.disclosureCount, 1);
    assert.equal(disclosureStatus.currentDisclosureCount, 1);
    assert.equal(disclosureStatus.staleDisclosureCount, 0);

    const secondAccountabilityPacket = await service.createDataAccessAccountabilityPacket(
      deliveryRequest.id,
      {
        intendedAudience: "second independent institutional accountability reviewer",
        generatedAt: "2026-07-11T04:20:31.000Z",
      },
      reviewerId,
      "pglite-second-data-access-accountability-packet",
    );
    const secondAccountabilityVerification = await service.verifyDataAccessAccountabilityPacket(
      secondAccountabilityPacket.id,
      {
        expectedPacketRoot: secondAccountabilityPacket.packetRoot,
        verifiedAt: "2026-07-11T04:20:31.000Z",
      },
      verifierId,
      "pglite-second-data-access-accountability-verification",
    );
    const secondAccountabilityDisclosure = await service.publishDataAccessAccountabilityDisclosure(
      secondAccountabilityPacket.id,
      {
        verificationId: secondAccountabilityVerification.id,
        publishedAt: "2026-07-11T04:20:31.000Z",
      },
      restrictionApproverId,
      "pglite-second-data-access-accountability-disclosure",
    );
    const firstDisclosurePage = await service.getDataAccessAccountabilityDisclosureIndex({ limit: 1 });
    assert.equal(firstDisclosurePage.totalCount, 2);
    assert.ok(firstDisclosurePage.nextCursor);
    const secondDisclosurePage = await service.getDataAccessAccountabilityDisclosureIndex({
      cursor: firstDisclosurePage.nextCursor,
      limit: 1,
    });
    assert.equal(secondDisclosurePage.totalCount, 2);
    assert.equal(secondDisclosurePage.nextCursor, undefined);
    assert.deepEqual(
      new Set([...firstDisclosurePage.items, ...secondDisclosurePage.items].map((item) => item.id)),
      new Set([accountabilityDisclosure.id, secondAccountabilityDisclosure.id]),
    );
    const twoDisclosureStatus = await service.getDataAccessAccountabilityDisclosureStatus();
    assert.equal(twoDisclosureStatus.disclosureCount, 2);
    assert.equal(
      twoDisclosureStatus.disclosureRoot,
      merkleRoot([accountabilityDisclosure.disclosureRoot, secondAccountabilityDisclosure.disclosureRoot].sort()),
    );
    const accountabilityDisclosureChallengeInput = {
      reason: "governance_violation",
      statement: "Request independent review of whether this public disclosure retained the required governance context.",
      evidenceEventRoots: [accountabilityDisclosure.auditEvent.eventRoot],
      challengedAt: "2026-07-11T04:20:31.000Z",
    } as const;
    const challengerAuthorityRows = await db.query<{ roles: string[]; membership_role: string }>(
      `SELECT participant.roles, membership.role AS membership_role
       FROM identity.participants participant
       JOIN organizations.memberships membership ON membership.actor_id = participant.id
       WHERE participant.id = $1 AND membership.status = 'active'`,
      [restorationApproverId],
    );
    assert.deepEqual(challengerAuthorityRows.rows, [{ roles: ["admin"], membership_role: "admin" }]);
    await assert.rejects(
      service.challengeDataAccessAccountabilityDisclosure(
        accountabilityDisclosure.id,
        accountabilityDisclosureChallengeInput,
        restorationApproverId,
        "owner",
        "pglite-data-access-accountability-disclosure-challenge-role-substitution",
      ),
      /requires a verified human with the claimed durable role/,
    );
    await assert.rejects(
      service.challengeDataAccessAccountabilityDisclosure(
        accountabilityDisclosure.id,
        { ...accountabilityDisclosureChallengeInput, evidenceEventRoots: ["0".repeat(64)] },
        restorationApproverId,
        "admin",
        "pglite-data-access-accountability-disclosure-challenge-missing-evidence",
      ),
      /evidence roots must bind prior semantic events/,
    );
    const accountabilityDisclosureChallenge = await service.challengeDataAccessAccountabilityDisclosure(
      accountabilityDisclosure.id,
      accountabilityDisclosureChallengeInput,
      restorationApproverId,
      "admin",
      "pglite-data-access-accountability-disclosure-challenge",
    );
    const replayedAccountabilityDisclosureChallenge = await service.challengeDataAccessAccountabilityDisclosure(
      accountabilityDisclosure.id,
      accountabilityDisclosureChallengeInput,
      restorationApproverId,
      "admin",
      "pglite-data-access-accountability-disclosure-challenge",
    );
    assert.equal(
      replayedAccountabilityDisclosureChallenge.challengeRoot,
      accountabilityDisclosureChallenge.challengeRoot,
    );
    await assert.rejects(
      service.challengeDataAccessAccountabilityDisclosure(
        accountabilityDisclosure.id,
        {
          ...accountabilityDisclosureChallengeInput,
          statement: "A changed public challenge statement must conflict with the committed command receipt.",
        },
        restorationApproverId,
        "admin",
        "pglite-data-access-accountability-disclosure-challenge",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
        error.httpStatus === 409,
    );
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosureChallenge(accountabilityDisclosureChallenge.id)).challengeRoot,
      accountabilityDisclosureChallenge.challengeRoot,
    );
    assert.equal(
      (await service.listDataAccessAccountabilityDisclosureChallenges(accountabilityDisclosure.id)).length,
      1,
    );
    const challengedDisclosureView = await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id);
    assert.equal(challengedDisclosureView.governanceState, "challenged");
    assert.equal(challengedDisclosureView.challengeCount, 1);
    assert.equal(challengedDisclosureView.openChallengeCount, 1);
    const challengedDisclosureIndex = await service.getDataAccessAccountabilityDisclosureIndex({
      governanceState: "challenged",
      limit: 10,
    });
    assert.equal(challengedDisclosureIndex.totalCount, 1);
    assert.equal(challengedDisclosureIndex.items[0]?.id, accountabilityDisclosure.id);
    const challengedDisclosureStatus = await service.getDataAccessAccountabilityDisclosureStatus();
    assert.equal(challengedDisclosureStatus.challengedDisclosureCount, 1);
    assert.equal(challengedDisclosureStatus.openChallengeCount, 1);
    const accountabilityDisclosureRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM organizations.data_access_accountability_disclosures WHERE id = $1",
      [accountabilityDisclosure.id],
    );
    assert.equal(String(accountabilityDisclosureRows.rows[0]?.count), "1");
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restrictionApproverId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_disclosures (
            id, organization_id, packet_id, packet_hash, packet_root,
            verification_id, verification_root, policy_id, published_by,
            published_at, disclosure_hash, disclosure_root, safety,
            audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7,
            'canopyproof_policy_partner_accountability_disclosure_v1', $8,
            $9, $10, $11, $12::jsonb, $13)`,
          [
            `cp_data_access_disclosure_${"1".repeat(24)}`,
            organization.id,
            accountabilityPacket.id,
            accountabilityPacket.packetHash,
            accountabilityPacket.packetRoot,
            accountabilityVerification.id,
            accountabilityVerification.verificationRoot,
            restrictionApproverId,
            "2026-07-11T04:20:31.000Z",
            "2".repeat(64),
            "3".repeat(64),
            JSON.stringify(accountabilityDisclosure.safety),
            "4".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    const accountabilityDisclosureReceiptRows = await db.query<{ count: number | bigint }>(
      `SELECT count(*)::bigint AS count
       FROM audit.command_receipts
       WHERE actor_id = $1
         AND operation = 'organization.data-access-accountability-disclosure.publish'
         AND result_entity_id = $2`,
      [restrictionApproverId, accountabilityDisclosure.id],
    );
    assert.equal(String(accountabilityDisclosureReceiptRows.rows[0]?.count), "1");

    const packetPayloadMismatchSeed = {
      organizationId: organization.id,
      requestId: deliveryRequest.id,
      agreementId: deliveryRequest.agreementId,
      generatedBy: reviewerId,
      generatedAt: "2026-07-11T04:20:31.000Z",
      intendedAudience: "institutional reviewer for a semantic payload mismatch probe",
      requestStatus: accountabilityPacket.requestStatus,
      requestHash: deliveryRequest.requestHash,
      counts: accountabilityPacket.counts,
      lineageRoots: accountabilityPacket.lineageRoots,
      safety: accountabilityPacket.safety,
    } as const;
    const packetPayloadMismatchHash = hashJson({
      kind: "canopyproof-data-access-accountability-packet-v1",
      ...packetPayloadMismatchSeed,
    });
    const packetPayloadMismatchRoot = hashJson({
      kind: "canopyproof-data-access-accountability-root-v1",
      packetHash: packetPayloadMismatchHash,
      accessRoot: deliveryRequest.accessRoot,
      lineageRoots: packetPayloadMismatchSeed.lineageRoots,
      counts: packetPayloadMismatchSeed.counts,
    });
    const packetPayloadMismatchId = `cp_data_access_packet_${packetPayloadMismatchHash.slice(0, 24)}`;
    const packetPayloadMismatchEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "ASSERT",
        actor: reviewerId,
        entityType: "data_access_accountability_packet",
        entityId: packetPayloadMismatchId,
        payload: { probe: "incorrect accountability packet payload" },
        createdAt: packetPayloadMismatchSeed.generatedAt,
        rationale: "An accountability packet semantic payload mismatch probe must roll back atomically.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            packetPayloadMismatchEvent.id,
            organization.id,
            packetPayloadMismatchEvent.action,
            packetPayloadMismatchEvent.actor,
            packetPayloadMismatchEvent.entityType,
            packetPayloadMismatchEvent.entityId,
            packetPayloadMismatchEvent.previousRoot,
            packetPayloadMismatchEvent.payloadHash,
            packetPayloadMismatchEvent.eventRoot,
            packetPayloadMismatchEvent.createdAt,
            packetPayloadMismatchEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_packets (
            id, organization_id, request_id, agreement_id, generated_by,
            generated_at, intended_audience, request_status, counts,
            lineage_roots, packet_hash, packet_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
            $10::jsonb, $11, $12, $13::jsonb, $14)`,
          [
            packetPayloadMismatchId,
            packetPayloadMismatchSeed.organizationId,
            packetPayloadMismatchSeed.requestId,
            packetPayloadMismatchSeed.agreementId,
            packetPayloadMismatchSeed.generatedBy,
            packetPayloadMismatchSeed.generatedAt,
            packetPayloadMismatchSeed.intendedAudience,
            packetPayloadMismatchSeed.requestStatus,
            JSON.stringify(packetPayloadMismatchSeed.counts),
            JSON.stringify(packetPayloadMismatchSeed.lineageRoots),
            packetPayloadMismatchHash,
            packetPayloadMismatchRoot,
            JSON.stringify(packetPayloadMismatchSeed.safety),
            packetPayloadMismatchEvent.eventRoot,
          ],
        );
      }),
      /accountability packet semantic event payload does not match the canonical snapshot/,
    );

    const enforcementPayloadMismatchSeed = {
      organizationId: organization.id,
      requestId: deliveryRequest.id,
      deliveryId: delivery.id,
      attestationId: misuseChallenge.id,
      manifestId: manifest.id,
      caseState: "under_review",
      enforcementAction: "notify_partner",
      rationale: "This canonical enforcement review must reject a mismatched semantic event payload.",
      evidenceEventRoots: ["8".repeat(64), "b".repeat(64)],
      reviewerId,
      reviewedAt: "2026-07-11T04:20:32.000Z",
      usageRoot: misuseChallenge.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      safety: enforcementCase.safety,
    } as const;
    const enforcementPayloadMismatchHash = hashJson({
      kind: "canopyproof-data-use-enforcement-case-v1",
      ...enforcementPayloadMismatchSeed,
    });
    const enforcementPayloadMismatchRoot = hashJson({
      kind: "canopyproof-data-use-enforcement-root-v1",
      enforcementHash: enforcementPayloadMismatchHash,
      usageRoot: misuseChallenge.usageRoot,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      evidenceEventRoots: enforcementPayloadMismatchSeed.evidenceEventRoots,
    });
    const enforcementPayloadMismatchId = `cp_data_use_enforcement_${enforcementPayloadMismatchHash.slice(0, 24)}`;
    const enforcementPayloadMismatchEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "CHALLENGE",
        actor: reviewerId,
        entityType: "data_use_enforcement_case",
        entityId: enforcementPayloadMismatchId,
        payload: { probe: "incorrect enforcement payload" },
        createdAt: enforcementPayloadMismatchSeed.reviewedAt,
        rationale: "An enforcement semantic payload mismatch probe must roll back with its canonical case.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            enforcementPayloadMismatchEvent.id,
            organization.id,
            enforcementPayloadMismatchEvent.action,
            enforcementPayloadMismatchEvent.actor,
            enforcementPayloadMismatchEvent.entityType,
            enforcementPayloadMismatchEvent.entityId,
            enforcementPayloadMismatchEvent.previousRoot,
            enforcementPayloadMismatchEvent.payloadHash,
            enforcementPayloadMismatchEvent.eventRoot,
            enforcementPayloadMismatchEvent.createdAt,
            enforcementPayloadMismatchEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_use_enforcement_cases (
            id, organization_id, request_id, delivery_id, attestation_id,
            manifest_id, case_state, enforcement_action, rationale,
            evidence_event_roots, reviewer_id, reviewed_at, enforcement_hash,
            enforcement_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10::text[], $11, $12, $13, $14, $15::jsonb, $16)`,
          [
            enforcementPayloadMismatchId,
            enforcementPayloadMismatchSeed.organizationId,
            enforcementPayloadMismatchSeed.requestId,
            enforcementPayloadMismatchSeed.deliveryId,
            enforcementPayloadMismatchSeed.attestationId,
            enforcementPayloadMismatchSeed.manifestId,
            enforcementPayloadMismatchSeed.caseState,
            enforcementPayloadMismatchSeed.enforcementAction,
            enforcementPayloadMismatchSeed.rationale,
            enforcementPayloadMismatchSeed.evidenceEventRoots,
            enforcementPayloadMismatchSeed.reviewerId,
            enforcementPayloadMismatchSeed.reviewedAt,
            enforcementPayloadMismatchHash,
            enforcementPayloadMismatchRoot,
            JSON.stringify(enforcementPayloadMismatchSeed.safety),
            enforcementPayloadMismatchEvent.eventRoot,
          ],
        );
      }),
      /data use enforcement semantic event payload does not match the canonical case/,
    );

    const missingChallengeRootEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "CHALLENGE",
        actor: reviewerId,
        entityType: "data_use_enforcement_case",
        entityId: "cp_data_use_enforcement_missing_challenge_root",
        payload: { probe: "challenge evidence deletion" },
        createdAt: "2026-07-11T04:20:31.000Z",
        rationale: "An enforcement review cannot delete evidence roots carried by the challenged attestation.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            missingChallengeRootEvent.id,
            organization.id,
            missingChallengeRootEvent.action,
            missingChallengeRootEvent.actor,
            missingChallengeRootEvent.entityType,
            missingChallengeRootEvent.entityId,
            missingChallengeRootEvent.previousRoot,
            missingChallengeRootEvent.payloadHash,
            missingChallengeRootEvent.eventRoot,
            missingChallengeRootEvent.createdAt,
            missingChallengeRootEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_use_enforcement_cases (
            id, organization_id, request_id, delivery_id, attestation_id,
            manifest_id, case_state, enforcement_action, rationale,
            evidence_event_roots, reviewer_id, reviewed_at, enforcement_hash,
            enforcement_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, 'under_review', 'notify_partner', $7,
            $8::text[], $9, $10, $11, $12, $13::jsonb, $14)`,
          [
            missingChallengeRootEvent.entityId,
            organization.id,
            deliveryRequest.id,
            delivery.id,
            misuseChallenge.id,
            manifest.id,
            "This review deliberately omits the challenged attestation evidence root.",
            ["c".repeat(64)],
            reviewerId,
            missingChallengeRootEvent.createdAt,
            "d".repeat(64),
            "e".repeat(64),
            JSON.stringify(enforcementCase.safety),
            missingChallengeRootEvent.eventRoot,
          ],
        );
      }),
      /must retain every challenged attestation evidence root/,
    );

    const challengedUseSeed = {
      organizationId: organization.id,
      requestId: deliveryRequest.id,
      deliveryId: delivery.id,
      manifestId: manifest.id,
      usageState: "revocation_requested",
      useCase: "Request revocation review after suspected use beyond the approved boundary.",
      outputHashes: [] as string[],
      evidenceEventRoots: ["9".repeat(64)],
      limitations: ["This is a non-final challenge requiring independent review."],
      attestedBy: verifierId,
      attestedAt: "2026-07-11T04:20:40.000Z",
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      safety: noUse.safety,
    } as const;
    const challengedUseHash = hashJson({ kind: "canopyproof-data-use-attestation-v1", ...challengedUseSeed });
    const challengedUsageRoot = hashJson({
      kind: "canopyproof-data-use-root-v1",
      attestationHash: challengedUseHash,
      deliveryRoot: delivery.deliveryRoot,
      accessRoot: delivery.accessRoot,
      outputHashes: challengedUseSeed.outputHashes,
      evidenceEventRoots: challengedUseSeed.evidenceEventRoots,
    });
    const challengedUseId = `cp_data_use_${challengedUseHash.slice(0, 24)}`;
    const challengedUseEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "CHALLENGE",
        actor: verifierId,
        entityType: "data_use_attestation",
        entityId: challengedUseId,
        payload: { probe: "incorrect data use payload" },
        createdAt: challengedUseSeed.attestedAt,
        rationale: "A data-use payload mismatch probe must roll back with its canonical attestation.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            challengedUseEvent.id,
            organization.id,
            challengedUseEvent.action,
            challengedUseEvent.actor,
            challengedUseEvent.entityType,
            challengedUseEvent.entityId,
            challengedUseEvent.previousRoot,
            challengedUseEvent.payloadHash,
            challengedUseEvent.eventRoot,
            challengedUseEvent.createdAt,
            challengedUseEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_use_attestations (
            id, organization_id, request_id, delivery_id, manifest_id,
            usage_state, use_case, output_hashes, evidence_event_roots,
            limitations, attested_by, attested_at, attestation_hash,
            usage_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7,
            $8::text[], $9::text[], $10::text[], $11, $12, $13, $14, $15::jsonb, $16)`,
          [
            challengedUseId,
            challengedUseSeed.organizationId,
            challengedUseSeed.requestId,
            challengedUseSeed.deliveryId,
            challengedUseSeed.manifestId,
            challengedUseSeed.usageState,
            challengedUseSeed.useCase,
            challengedUseSeed.outputHashes,
            challengedUseSeed.evidenceEventRoots,
            challengedUseSeed.limitations,
            challengedUseSeed.attestedBy,
            challengedUseSeed.attestedAt,
            challengedUseHash,
            challengedUsageRoot,
            JSON.stringify(challengedUseSeed.safety),
            challengedUseEvent.eventRoot,
          ],
        );
      }),
      /data use semantic event payload does not match the canonical attestation/,
    );

    const manifestRows = await db.query<{ entries: unknown; export_hash: string }>(
      "SELECT entries, export_hash FROM audit.export_manifests WHERE id = $1",
      [manifest.id],
    );
    assert.equal(manifestRows.rows.length, 1);
    assert.equal(manifestRows.rows[0]?.export_hash, manifest.exportHash);
    assert.doesNotMatch(JSON.stringify(manifestRows.rows[0]?.entries), /private[_ -]?key|password/i);

    const underclassifiedEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "DELEGATE",
        actor: verifierId,
        entityType: "audit_export_manifest",
        entityId: "cp_pglite_underclassified_manifest",
        payload: { classification: "public", entryClassification: "restricted" },
        createdAt: "2026-07-11T04:21:00.000Z",
        rationale: "An under-classified manifest probe must roll back with its semantic event.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            underclassifiedEvent.id,
            organization.id,
            underclassifiedEvent.action,
            underclassifiedEvent.actor,
            underclassifiedEvent.entityType,
            underclassifiedEvent.entityId,
            underclassifiedEvent.previousRoot,
            underclassifiedEvent.payloadHash,
            underclassifiedEvent.eventRoot,
            underclassifiedEvent.createdAt,
            underclassifiedEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO audit.export_manifests (
            id, manifest_version, manifest_kind, scope, subject_id,
            requester_organization_id, requested_by, purpose, classification,
            entries, entry_root, redaction_root, source_event_root, export_hash,
            safety, expires_at, created_at, event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'public', $9::jsonb,
            $10, $11, $12, $13, $14::jsonb, $15, $16, $17)`,
          [
            underclassifiedEvent.entityId,
            manifest.manifestVersion,
            manifest.kind,
            manifest.scope,
            manifest.subjectId,
            organization.id,
            verifierId,
            "This deliberately under-classified manifest must be rejected.",
            JSON.stringify(manifest.entries),
            manifest.entryRoot,
            manifest.redactionRoot,
            manifest.sourceEventRoot,
            "1".repeat(64),
            JSON.stringify(manifest.safety),
            "2027-01-11T04:21:00.000Z",
            underclassifiedEvent.createdAt,
            underclassifiedEvent.eventRoot,
          ],
        );
      }),
      /classification is lower than an entry classification/,
    );
    const rolledBackManifestEvent = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE id = $1",
      [underclassifiedEvent.id],
    );
    assert.equal(String(rolledBackManifestEvent.rows[0]?.count), "0");
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO audit.export_manifests (
            id, manifest_version, manifest_kind, scope, subject_id,
            requester_organization_id, requested_by, purpose, classification,
            entries, entry_root, redaction_root, source_event_root, export_hash,
            safety, expires_at, created_at, event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
            $11, $12, $13, $14, $15::jsonb, $16, $17, $18)`,
          [
            "cp_pglite_unbound_manifest",
            manifest.manifestVersion,
            manifest.kind,
            manifest.scope,
            manifest.subjectId,
            organization.id,
            verifierId,
            "This manifest intentionally lacks an exact semantic event binding.",
            manifest.classification,
            JSON.stringify(manifest.entries),
            manifest.entryRoot,
            manifest.redactionRoot,
            manifest.sourceEventRoot,
            "2".repeat(64),
            JSON.stringify(manifest.safety),
            "2027-01-11T04:22:00.000Z",
            "2026-07-11T04:22:00.000Z",
            "3".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query("UPDATE audit.export_manifests SET purpose = $1 WHERE id = $2", [
          "Attempted manifest rewrite must fail.",
          manifest.id,
        ]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restorationApproverId]);
        await transaction.query(
          "UPDATE organizations.data_access_accountability_disclosure_challenges SET statement = $1 WHERE id = $2",
          [accountabilityDisclosureChallenge.statement, accountabilityDisclosureChallenge.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_delivery_receipts (
            id, organization_id, request_id, agreement_id, manifest_id,
            manifest_requester_organization_id, manifest_hash, manifest_entry_root,
            manifest_classification, channel, recipient_actor_id, delivered_by,
            delivered_at, purpose, access_root, receipt_hash, delivery_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $2, $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17::jsonb, $18)`,
          [
            "cp_pglite_unbound_delivery",
            organization.id,
            deliveryRequest.id,
            activeAgreement.id,
            manifest.id,
            manifest.exportHash,
            manifest.entryRoot,
            manifest.classification,
            delivery.channel,
            requesterId,
            verifierId,
            "2026-07-11T04:22:00.000Z",
            "This delivery intentionally lacks an exact semantic event binding.",
            delivery.accessRoot,
            "4".repeat(64),
            "5".repeat(64),
            JSON.stringify(delivery.safety),
            "6".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query("UPDATE organizations.data_access_delivery_receipts SET purpose = $1 WHERE id = $2", [
          "Attempted delivery receipt rewrite must fail.",
          delivery.id,
        ]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [requesterId]);
        await transaction.query(
          `INSERT INTO organizations.data_use_attestations (
            id, organization_id, request_id, delivery_id, manifest_id,
            usage_state, use_case, output_hashes, evidence_event_roots,
            limitations, attested_by, attested_at, attestation_hash,
            usage_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, 'no_use', $6,
            ARRAY[]::text[], ARRAY[]::text[], $7::text[], $8, $9, $10, $11, $12::jsonb, $13)`,
          [
            "cp_pglite_unbound_data_use",
            organization.id,
            deliveryRequest.id,
            delivery.id,
            manifest.id,
            "This no-use statement intentionally lacks an exact semantic event binding.",
            ["No output exists for this deliberately unbound statement."],
            requesterId,
            "2026-07-11T04:22:00.000Z",
            "a".repeat(64),
            "b".repeat(64),
            JSON.stringify(noUse.safety),
            "c".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [requesterId]);
        await transaction.query("UPDATE organizations.data_use_attestations SET use_case = $1 WHERE id = $2", [
          "Attempted data-use attestation rewrite must fail.",
          withinScope.id,
        ]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO organizations.data_use_enforcement_cases (
            id, organization_id, request_id, delivery_id, attestation_id,
            manifest_id, case_state, enforcement_action, rationale,
            evidence_event_roots, reviewer_id, reviewed_at, enforcement_hash,
            enforcement_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, 'under_review', 'legal_hold', $7,
            $8::text[], $9, $10, $11, $12, $13::jsonb, $14)`,
          [
            "cp_pglite_unbound_data_use_enforcement",
            organization.id,
            deliveryRequest.id,
            delivery.id,
            misuseChallenge.id,
            manifest.id,
            "This enforcement case intentionally lacks an exact semantic event binding.",
            misuseChallenge.evidenceEventRoots,
            reviewerId,
            "2026-07-11T04:22:00.000Z",
            "d".repeat(64),
            "e".repeat(64),
            JSON.stringify(enforcementCase.safety),
            "f".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          "UPDATE organizations.data_use_enforcement_cases SET rationale = $1 WHERE id = $2",
          ["Attempted enforcement review rewrite must fail.", enforcementCase.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restorationApproverId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_restrictions (
            id, organization_id, request_id, enforcement_case_id,
            attestation_id, delivery_id, previous_restriction_id,
            previous_restriction_root, previous_restriction_state,
            restriction_state, rationale, evidence_event_roots, decided_by,
            decided_at, expires_at, restriction_hash, restriction_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'revoked', $10,
            $11::text[], $12, $13, NULL, $14, $15, $16::jsonb, $17)`,
          [
            "cp_pglite_unbound_data_access_restriction",
            organization.id,
            deliveryRequest.id,
            suspensionEnforcementCase.id,
            misuseChallenge.id,
            delivery.id,
            suspendedRestriction.id,
            suspendedRestriction.restrictionRoot,
            suspendedRestriction.restrictionState,
            "This access restriction intentionally lacks an exact semantic event binding.",
            suspensionEnforcementCase.evidenceEventRoots,
            restorationApproverId,
            "2026-07-11T04:22:10.000Z",
            "1".repeat(64),
            "2".repeat(64),
            JSON.stringify(restriction.safety),
            "3".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restrictionApproverId]);
        await transaction.query(
          "UPDATE organizations.data_access_restrictions SET rationale = $1 WHERE id = $2",
          ["Attempted access restriction rewrite must fail.", suspendedRestriction.id],
        );
      }),
      /append-only/,
    );
    const omittedLineageCounts = {
      ...accountabilityPacket.counts,
      totalRestrictionCount: accountabilityPacket.counts.totalRestrictionCount - 1,
    };
    const omittedLineageRoots = {
      ...accountabilityPacket.lineageRoots,
      restrictionRoots: accountabilityPacket.lineageRoots.restrictionRoots.slice(1),
    };
    const omittedLineagePacketSeed = {
      organizationId: organization.id,
      requestId: deliveryRequest.id,
      agreementId: deliveryRequest.agreementId,
      generatedBy: reviewerId,
      generatedAt: "2026-07-11T04:22:20.000Z",
      intendedAudience: "institutional reviewer for an omitted lineage probe",
      requestStatus: accountabilityPacket.requestStatus,
      requestHash: deliveryRequest.requestHash,
      counts: omittedLineageCounts,
      lineageRoots: omittedLineageRoots,
      safety: accountabilityPacket.safety,
    } as const;
    const omittedLineagePacketHash = hashJson({
      kind: "canopyproof-data-access-accountability-packet-v1",
      ...omittedLineagePacketSeed,
    });
    const omittedLineagePacketRoot = hashJson({
      kind: "canopyproof-data-access-accountability-root-v1",
      packetHash: omittedLineagePacketHash,
      accessRoot: deliveryRequest.accessRoot,
      lineageRoots: omittedLineageRoots,
      counts: omittedLineageCounts,
    });
    const omittedLineagePacketId = `cp_data_access_packet_${omittedLineagePacketHash.slice(0, 24)}`;
    const omittedLineagePacketEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "ASSERT",
        actor: reviewerId,
        entityType: "data_access_accountability_packet",
        entityId: omittedLineagePacketId,
        payload: {
          ...omittedLineagePacketSeed,
          packetHash: omittedLineagePacketHash,
          packetRoot: omittedLineagePacketRoot,
        },
        createdAt: omittedLineagePacketSeed.generatedAt,
        rationale: "An accountability packet cannot omit a preceding restriction root from its ledger prefix.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            omittedLineagePacketEvent.id,
            organization.id,
            omittedLineagePacketEvent.action,
            omittedLineagePacketEvent.actor,
            omittedLineagePacketEvent.entityType,
            omittedLineagePacketEvent.entityId,
            omittedLineagePacketEvent.previousRoot,
            omittedLineagePacketEvent.payloadHash,
            omittedLineagePacketEvent.eventRoot,
            omittedLineagePacketEvent.createdAt,
            omittedLineagePacketEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_packets (
            id, organization_id, request_id, agreement_id, generated_by,
            generated_at, intended_audience, request_status, counts,
            lineage_roots, packet_hash, packet_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
            $10::jsonb, $11, $12, $13::jsonb, $14)`,
          [
            omittedLineagePacketId,
            omittedLineagePacketSeed.organizationId,
            omittedLineagePacketSeed.requestId,
            omittedLineagePacketSeed.agreementId,
            omittedLineagePacketSeed.generatedBy,
            omittedLineagePacketSeed.generatedAt,
            omittedLineagePacketSeed.intendedAudience,
            omittedLineagePacketSeed.requestStatus,
            JSON.stringify(omittedLineagePacketSeed.counts),
            JSON.stringify(omittedLineagePacketSeed.lineageRoots),
            omittedLineagePacketHash,
            omittedLineagePacketRoot,
            JSON.stringify(omittedLineagePacketSeed.safety),
            omittedLineagePacketEvent.eventRoot,
          ],
        );
      }),
      /snapshot does not match the complete event-bound ledger prefix/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_packets (
            id, organization_id, request_id, agreement_id, generated_by,
            generated_at, intended_audience, request_status, counts,
            lineage_roots, packet_hash, packet_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
            $10::jsonb, $11, $12, $13::jsonb, $14)`,
          [
            "cp_pglite_unbound_data_access_accountability_packet",
            organization.id,
            deliveryRequest.id,
            deliveryRequest.agreementId,
            reviewerId,
            "2026-07-11T04:22:30.000Z",
            "institutional reviewer for an unbound packet probe",
            accountabilityPacket.requestStatus,
            JSON.stringify(accountabilityPacket.counts),
            JSON.stringify(accountabilityPacket.lineageRoots),
            "4".repeat(64),
            "5".repeat(64),
            JSON.stringify(accountabilityPacket.safety),
            "6".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          "UPDATE organizations.data_access_accountability_packets SET intended_audience = $1 WHERE id = $2",
          ["Attempted accountability packet rewrite must fail.", accountabilityPacket.id],
        );
      }),
      /append-only/,
    );

    const postPacketChallenge = await service.recordDataUseAttestation(
      delivery.id,
      {
        usageState: "misuse_challenged",
        useCase: "Record a later governed challenge so the historical accountability packet becomes stale without mutation.",
        evidenceEventRoots: ["9".repeat(64)],
        limitations: ["The later challenge is non-final and requires independent review."],
        attestedAt: "2026-07-11T04:23:00.000Z",
      },
      restrictionApproverId,
      "pglite-post-packet-data-use-challenge",
    );
    assert.equal(postPacketChallenge.auditEvent.action, "CHALLENGE");
    const staleAccountabilityVerification = await service.verifyDataAccessAccountabilityPacket(
      accountabilityPacket.id,
      {
        expectedPacketRoot: accountabilityPacket.packetRoot,
        verifiedAt: "2026-07-11T04:23:10.000Z",
      },
      restorationApproverId,
      "pglite-stale-data-access-accountability-verification",
    );
    assert.equal(staleAccountabilityVerification.valid, false);
    assert.deepEqual(staleAccountabilityVerification.issues, ["lineage_stale"]);
    assert.equal(staleAccountabilityVerification.auditEvent.action, "CHALLENGE");
    assert.equal((await service.getDataAccessAccountabilityVerification(accountabilityVerification.id)).valid, true);
    assert.equal((await service.listDataAccessAccountabilityVerifications(accountabilityPacket.id)).length, 2);
    const staleDisclosure = await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id);
    assert.equal(staleDisclosure.currentState, "stale");
    assert.deepEqual(staleDisclosure.currentIssues, ["lineage_stale"]);
    const staleDisclosureIndex = await service.getDataAccessAccountabilityDisclosureIndex({
      currentState: "stale",
      limit: 10,
    });
    assert.equal(staleDisclosureIndex.totalCount, 2);
    assert.deepEqual(
      new Set(staleDisclosureIndex.items.map((item) => item.id)),
      new Set([accountabilityDisclosure.id, secondAccountabilityDisclosure.id]),
    );
    const staleDisclosureStatus = await service.getDataAccessAccountabilityDisclosureStatus();
    assert.equal(staleDisclosureStatus.currentDisclosureCount, 0);
    assert.equal(staleDisclosureStatus.staleDisclosureCount, 2);

    const fabricatedValidVerificationSeed = {
      organizationId: organization.id,
      packetId: accountabilityPacket.id,
      requestId: deliveryRequest.id,
      valid: true,
      issues: [] as string[],
      expectedPacketRoot: accountabilityPacket.packetRoot,
      packetHash: accountabilityPacket.packetHash,
      recomputedPacketHash: staleAccountabilityVerification.recomputedPacketHash,
      packetRoot: accountabilityPacket.packetRoot,
      recomputedPacketRoot: staleAccountabilityVerification.recomputedPacketRoot,
      verifiedBy: verifierId,
      verifiedAt: "2026-07-11T04:23:20.000Z",
      safety: staleAccountabilityVerification.safety,
    } as const;
    const fabricatedValidVerificationRoot = hashJson({
      kind: "canopyproof-data-access-accountability-verification-v1",
      ...fabricatedValidVerificationSeed,
    });
    const fabricatedValidVerificationId = `cp_data_access_packet_verification_${fabricatedValidVerificationRoot.slice(0, 24)}`;
    const fabricatedValidVerificationEvent = appendCanopyProofAuditEvent(
      (await service.getOrganization(organization.id)).auditHistory,
      {
        action: "ASSERT",
        actor: verifierId,
        entityType: "data_access_accountability_verification",
        entityId: fabricatedValidVerificationId,
        payload: {
          ...fabricatedValidVerificationSeed,
          verificationRoot: fabricatedValidVerificationRoot,
        },
        createdAt: fabricatedValidVerificationSeed.verifiedAt,
        rationale: "A caller cannot suppress a database-derived stale-lineage issue.",
      },
    ).at(-1)!;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            fabricatedValidVerificationEvent.id,
            organization.id,
            fabricatedValidVerificationEvent.action,
            fabricatedValidVerificationEvent.actor,
            fabricatedValidVerificationEvent.entityType,
            fabricatedValidVerificationEvent.entityId,
            fabricatedValidVerificationEvent.previousRoot,
            fabricatedValidVerificationEvent.payloadHash,
            fabricatedValidVerificationEvent.eventRoot,
            fabricatedValidVerificationEvent.createdAt,
            fabricatedValidVerificationEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_verifications (
            id, packet_id, organization_id, request_id, valid, issues,
            expected_packet_root, packet_hash, recomputed_packet_hash,
            packet_root, recomputed_packet_root, verified_by, verified_at,
            verification_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9,
            $10, $11, $12, $13, $14, $15::jsonb, $16)`,
          [
            fabricatedValidVerificationId,
            fabricatedValidVerificationSeed.packetId,
            fabricatedValidVerificationSeed.organizationId,
            fabricatedValidVerificationSeed.requestId,
            fabricatedValidVerificationSeed.valid,
            fabricatedValidVerificationSeed.issues,
            fabricatedValidVerificationSeed.expectedPacketRoot,
            fabricatedValidVerificationSeed.packetHash,
            fabricatedValidVerificationSeed.recomputedPacketHash,
            fabricatedValidVerificationSeed.packetRoot,
            fabricatedValidVerificationSeed.recomputedPacketRoot,
            fabricatedValidVerificationSeed.verifiedBy,
            fabricatedValidVerificationSeed.verifiedAt,
            fabricatedValidVerificationRoot,
            JSON.stringify(fabricatedValidVerificationSeed.safety),
            fabricatedValidVerificationEvent.eventRoot,
          ],
        );
      }),
      /fields do not match database-derived replay/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_verifications (
            id, packet_id, organization_id, request_id, valid, issues,
            expected_packet_root, packet_hash, recomputed_packet_hash,
            packet_root, recomputed_packet_root, verified_by, verified_at,
            verification_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, false, ARRAY['lineage_stale']::text[], $5, $6, $7,
            $8, $9, $10, $11, $12, $13::jsonb, $14)`,
          [
            "cp_pglite_unbound_data_access_accountability_verification",
            accountabilityPacket.id,
            organization.id,
            deliveryRequest.id,
            accountabilityPacket.packetRoot,
            accountabilityPacket.packetHash,
            staleAccountabilityVerification.recomputedPacketHash,
            accountabilityPacket.packetRoot,
            staleAccountabilityVerification.recomputedPacketRoot,
            verifierId,
            "2026-07-11T04:23:30.000Z",
            "7".repeat(64),
            JSON.stringify(staleAccountabilityVerification.safety),
            "8".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          "UPDATE organizations.data_access_accountability_verifications SET valid = false WHERE id = $1",
          [accountabilityVerification.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [restrictionApproverId]);
        await transaction.query(
          "UPDATE organizations.data_access_accountability_disclosures SET policy_id = $1 WHERE id = $2",
          ["canopyproof_policy_partner_accountability_disclosure_v1", accountabilityDisclosure.id],
        );
      }),
      /append-only/,
    );

    const resolutionInput = {
      decision: "needs_more_evidence",
      remedialAction: "none",
      rationale: "Independent review requires one additional governed event before reaching a final public finding.",
      evidenceEventRoots: [accountabilityDisclosureChallenge.auditEvent.eventRoot],
      reviewedAt: "2026-07-11T04:24:00.000Z",
    } as const;
    await assert.rejects(
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        accountabilityDisclosureChallenge.id,
        resolutionInput,
        verifierId,
        "admin",
        "pglite-data-access-accountability-disclosure-resolution-role-substitution",
      ),
      /requires a verified human in the target organization with the claimed role/,
    );
    await assert.rejects(
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        accountabilityDisclosureChallenge.id,
        resolutionInput,
        restorationApproverId,
        "admin",
        "pglite-data-access-accountability-disclosure-resolution-self-review",
      ),
      /requires an independent human reviewer/,
    );
    await assert.rejects(
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        accountabilityDisclosureChallenge.id,
        { ...resolutionInput, evidenceEventRoots: ["0".repeat(64)] },
        verifierId,
        "verifier",
        "pglite-data-access-accountability-disclosure-resolution-missing-evidence",
      ),
      /evidence roots must bind prior semantic events/,
    );
    const evidenceRequestResolution = await service.resolveDataAccessAccountabilityDisclosureChallenge(
      accountabilityDisclosureChallenge.id,
      resolutionInput,
      verifierId,
      "verifier",
      "pglite-data-access-accountability-disclosure-resolution-evidence-request",
    );
    const replayedEvidenceRequestResolution = await service.resolveDataAccessAccountabilityDisclosureChallenge(
      accountabilityDisclosureChallenge.id,
      resolutionInput,
      verifierId,
      "verifier",
      "pglite-data-access-accountability-disclosure-resolution-evidence-request",
    );
    assert.equal(replayedEvidenceRequestResolution.resolutionRoot, evidenceRequestResolution.resolutionRoot);
    await assert.rejects(
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        accountabilityDisclosureChallenge.id,
        { ...resolutionInput, rationale: "A changed resolution rationale must conflict with the committed command receipt." },
        verifierId,
        "verifier",
        "pglite-data-access-accountability-disclosure-resolution-evidence-request",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
        error.httpStatus === 409,
    );
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id)).governanceState,
      "needs_more_evidence",
    );
    const correctionResolution = await service.resolveDataAccessAccountabilityDisclosureChallenge(
      accountabilityDisclosureChallenge.id,
      {
        decision: "upheld",
        remedialAction: "publish_correction",
        rationale: "The additional governed review confirms that a public correction notice is required.",
        evidenceEventRoots: [evidenceRequestResolution.auditEvent.eventRoot],
        reviewedAt: "2026-07-11T04:24:00.001Z",
      },
      reviewerId,
      "admin",
      "pglite-data-access-accountability-disclosure-resolution-final",
    );
    assert.equal(correctionResolution.previousResolutionId, evidenceRequestResolution.id);
    assert.equal(correctionResolution.previousResolutionRoot, evidenceRequestResolution.resolutionRoot);
    assert.equal(
      (
        await service.resolveDataAccessAccountabilityDisclosureChallenge(
          accountabilityDisclosureChallenge.id,
          resolutionInput,
          verifierId,
          "verifier",
          "pglite-data-access-accountability-disclosure-resolution-evidence-request",
        )
      ).id,
      evidenceRequestResolution.id,
    );
    assert.deepEqual(
      (await service.listDataAccessAccountabilityDisclosureResolutions(accountabilityDisclosureChallenge.id)).map(
        (resolution) => resolution.id,
      ),
      [evidenceRequestResolution.id, correctionResolution.id],
    );
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosureResolution(correctionResolution.id)).resolutionRoot,
      correctionResolution.resolutionRoot,
    );
    const correctionRequiredDisclosure = await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id);
    assert.equal(correctionRequiredDisclosure.governanceState, "correction_required");
    assert.equal(correctionRequiredDisclosure.openChallengeCount, 0);
    const correctionRequiredIndex = await service.getDataAccessAccountabilityDisclosureIndex({
      governanceState: "correction_required",
      limit: 10,
    });
    assert.equal(correctionRequiredIndex.totalCount, 1);
    assert.equal(correctionRequiredIndex.items[0]?.id, accountabilityDisclosure.id);
    const resolvedDisclosureStatus = await service.getDataAccessAccountabilityDisclosureStatus();
    assert.equal(resolvedDisclosureStatus.challengedDisclosureCount, 1);
    assert.equal(resolvedDisclosureStatus.openChallengeCount, 0);

    const noticeInputWithoutReplacement = {
      noticeType: "correction",
      statement: "The original disclosure remains public and requires a linked replacement disclosure.",
      evidenceEventRoots: [correctionResolution.auditEvent.eventRoot],
      publishedAt: "2026-07-11T04:24:13.000Z",
    } as const;
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        {
          ...noticeInputWithoutReplacement,
          replacementDisclosureId: secondAccountabilityDisclosure.id,
        },
        actorId,
        "owner",
        "pglite-data-access-accountability-disclosure-notice-stale-replacement",
      ),
      /requires a current, uncontested replacement disclosure/,
    );
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        {
          ...noticeInputWithoutReplacement,
          noticeType: "withdrawal",
        },
        actorId,
        "owner",
        "pglite-data-access-accountability-disclosure-notice-remedy-mismatch",
      ),
      /type must match the resolved remedial action/,
    );

    const replacementPacket = await service.createDataAccessAccountabilityPacket(
      deliveryRequest.id,
      {
        intendedAudience: "replacement disclosure institutional reviewer",
        generatedAt: "2026-07-11T04:24:10.000Z",
      },
      reviewerId,
      "pglite-data-access-accountability-replacement-packet",
    );
    const replacementVerification = await service.verifyDataAccessAccountabilityPacket(
      replacementPacket.id,
      {
        expectedPacketRoot: replacementPacket.packetRoot,
        verifiedAt: "2026-07-11T04:24:11.000Z",
      },
      verifierId,
      "pglite-data-access-accountability-replacement-verification",
    );
    const replacementDisclosure = await service.publishDataAccessAccountabilityDisclosure(
      replacementPacket.id,
      {
        verificationId: replacementVerification.id,
        publishedAt: "2026-07-11T04:24:12.000Z",
      },
      restrictionApproverId,
      "pglite-data-access-accountability-replacement-disclosure",
    );
    assert.equal(replacementDisclosure.currentState, "current");
    assert.equal(replacementDisclosure.governanceState, "unchallenged");

    const correctionNoticeInput = {
      ...noticeInputWithoutReplacement,
      replacementDisclosureId: replacementDisclosure.id,
    } as const;
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        correctionNoticeInput,
        noticePublisherId,
        "admin",
        "pglite-data-access-accountability-disclosure-notice-role-substitution",
      ),
      /requires a verified human in the target organization with the claimed role/,
    );
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        correctionNoticeInput,
        restrictionApproverId,
        "owner",
        "pglite-data-access-accountability-disclosure-notice-self-publication",
      ),
      /requires a publisher independent from the original publisher, challenger, and reviewer/,
    );
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        correctionNoticeInput,
        reviewerId,
        "admin",
        "pglite-data-access-accountability-disclosure-notice-reviewer-publication",
      ),
      /requires a publisher independent from the original publisher, challenger, and reviewer/,
    );
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        { ...correctionNoticeInput, evidenceEventRoots: ["0".repeat(64)] },
        noticePublisherId,
        "owner",
        "pglite-data-access-accountability-disclosure-notice-missing-evidence",
      ),
      /evidence roots must bind prior semantic events/,
    );
    const correctionNotice = await service.publishDataAccessAccountabilityDisclosureNotice(
      correctionResolution.id,
      correctionNoticeInput,
      noticePublisherId,
      "owner",
      "pglite-data-access-accountability-disclosure-notice",
    );
    const replayedCorrectionNotice = await service.publishDataAccessAccountabilityDisclosureNotice(
      correctionResolution.id,
      correctionNoticeInput,
      noticePublisherId,
      "owner",
      "pglite-data-access-accountability-disclosure-notice",
    );
    assert.equal(replayedCorrectionNotice.noticeRoot, correctionNotice.noticeRoot);
    await assert.rejects(
      service.publishDataAccessAccountabilityDisclosureNotice(
        correctionResolution.id,
        {
          ...correctionNoticeInput,
          statement: "Changed notice content must conflict with the committed command receipt.",
        },
        noticePublisherId,
        "owner",
        "pglite-data-access-accountability-disclosure-notice",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT" &&
        error.httpStatus === 409,
    );
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosureNotice(correctionNotice.id)).noticeRoot,
      correctionNotice.noticeRoot,
    );
    assert.deepEqual(
      (await service.listDataAccessAccountabilityDisclosureNotices(accountabilityDisclosure.id)).map((notice) => notice.id),
      [correctionNotice.id],
    );
    const correctedDisclosure = await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id);
    assert.equal(correctedDisclosure.governanceState, "corrected");
    assert.deepEqual(correctedDisclosure.noticeIds, [correctionNotice.id]);
    assert.deepEqual(correctedDisclosure.replacementDisclosureIds, [replacementDisclosure.id]);
    const correctedDisclosureStatus = await service.getDataAccessAccountabilityDisclosureStatus();
    assert.equal(correctedDisclosureStatus.correctedDisclosureCount, 1);
    assert.equal(correctedDisclosureStatus.withdrawnDisclosureCount, 0);

    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [noticePublisherId]);
        await transaction.query(
          "UPDATE organizations.data_access_accountability_disclosure_notices SET statement = $1 WHERE id = $2",
          [correctionNotice.statement, correctionNotice.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [noticePublisherId]);
        await transaction.query(
          "DELETE FROM organizations.data_access_accountability_disclosure_notices WHERE id = $1",
          [correctionNotice.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [noticePublisherId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_disclosure_notices (
            id, organization_id, disclosure_id, challenge_id, resolution_id,
            notice_type, replacement_disclosure_id, statement, evidence_event_roots,
            published_by, publisher_role, published_at, notice_hash, notice_root,
            safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, $5, 'correction', $6, $7, $8,
            $9, 'owner', $10, $11, $12, $13::jsonb, $14)`,
          [
            `cp_data_access_disclosure_notice_${"f".repeat(24)}`,
            organization.id,
            accountabilityDisclosure.id,
            accountabilityDisclosureChallenge.id,
            correctionResolution.id,
            replacementDisclosure.id,
            "This direct notice intentionally lacks an exact bound semantic event.",
            [correctionResolution.auditEvent.eventRoot],
            noticePublisherId,
            "2026-07-11T04:24:13.001Z",
            "f".repeat(64),
            "e".repeat(64),
            JSON.stringify(correctionNotice.safety),
            "d".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );

    const replacementChallenge = await service.challengeDataAccessAccountabilityDisclosure(
      replacementDisclosure.id,
      {
        reason: "source_verification_disputed",
        statement: "A later governed challenge must not rewrite the historical correction notice boundary.",
        evidenceEventRoots: [replacementDisclosure.auditEvent.eventRoot],
        challengedAt: "2026-07-11T04:24:14.000Z",
      },
      restorationApproverId,
      "admin",
      "pglite-data-access-accountability-replacement-disclosure-challenge",
    );
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosure(replacementDisclosure.id)).governanceState,
      "challenged",
    );
    assert.equal(
      (
        await service.publishDataAccessAccountabilityDisclosureNotice(
          correctionResolution.id,
          correctionNoticeInput,
          noticePublisherId,
          "owner",
          "pglite-data-access-accountability-disclosure-notice",
        )
      ).noticeRoot,
      correctionNotice.noticeRoot,
    );
    assert.equal(
      (await service.getDataAccessAccountabilityDisclosure(accountabilityDisclosure.id)).governanceState,
      "corrected",
    );
    assert.equal(replacementChallenge.disclosureId, replacementDisclosure.id);
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          "UPDATE organizations.data_access_accountability_disclosure_resolutions SET rationale = $1 WHERE id = $2",
          [correctionResolution.rationale, correctionResolution.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [reviewerId]);
        await transaction.query(
          `INSERT INTO organizations.data_access_accountability_disclosure_resolutions (
            id, organization_id, disclosure_id, challenge_id, decision,
            remedial_action, rationale, evidence_event_roots, previous_resolution_id,
            previous_resolution_root, reviewed_by, reviewer_role, reviewed_at,
            resolution_hash, resolution_root, safety, audit_event_root
          ) VALUES ($1, $2, $3, $4, 'dismissed', 'none', $5, $6, NULL,
            NULL, $7, 'admin', $8, $9, $10, $11::jsonb, $12)`,
          [
            `cp_data_access_disclosure_resolution_${"f".repeat(24)}`,
            organization.id,
            accountabilityDisclosure.id,
            accountabilityDisclosureChallenge.id,
            "This direct insert intentionally lacks an exact bound semantic resolution event.",
            [accountabilityDisclosureChallenge.auditEvent.eventRoot],
            reviewerId,
            "2026-07-11T04:24:00.002Z",
            "f".repeat(64),
            "e".repeat(64),
            JSON.stringify(correctionResolution.safety),
            "d".repeat(64),
          ],
        );
      }),
      /requires an exact semantic event binding/,
    );

    const immutableRequestRows = await db.query<{ status: string; decision_by: string | null }>(
      "SELECT status, decision_by FROM organizations.data_access_requests WHERE id = $1",
      [accessRequest.id],
    );
    assert.deepEqual(immutableRequestRows.rows, [{ status: "pending", decision_by: null }]);
    const decisionRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM organizations.data_access_request_decisions WHERE request_id = $1",
      [accessRequest.id],
    );
    assert.equal(String(decisionRows.rows[0]?.count), "2");

    const reloadedOrganization = await service.getOrganization(organization.id);
    assert.equal(
      verifyCanopyProofAuditChain(reloadedOrganization.auditHistory, reloadedOrganization.auditHistory.at(-1)?.createdAt).valid,
      true,
    );
    assert.deepEqual(
      reloadedOrganization.auditHistory.map((event) => event.entityType),
      [
        "organization",
        "data_sharing_agreement",
        "data_sharing_agreement",
        "data_sharing_agreement_revocation",
        "data_sharing_agreement",
        "data_sharing_agreement",
        "data_sharing_agreement_supersession",
        "organization_verification",
        "membership",
        "membership",
        "membership",
        "membership",
        "membership",
        "membership",
        "data_access_request",
        "data_access_request_decision",
        "data_access_request_decision",
        "audit_export_manifest",
        "data_access_request",
        "data_access_request_decision",
        "data_access_delivery_receipt",
        "data_use_attestation",
        "data_use_attestation",
        "data_access_request_decision",
        "data_use_attestation",
        "data_use_enforcement_case",
        "data_access_restriction",
        "data_use_enforcement_case",
        "data_access_restriction",
        "data_use_enforcement_case",
        "data_access_restriction",
        "data_access_accountability_packet",
        "data_access_accountability_verification",
        "data_access_accountability_disclosure",
        "data_access_accountability_packet",
        "data_access_accountability_verification",
        "data_access_accountability_disclosure",
        "data_access_accountability_disclosure_challenge",
        "data_use_attestation",
        "data_access_accountability_verification",
        "data_access_accountability_disclosure_resolution",
        "data_access_accountability_disclosure_resolution",
        "data_access_accountability_packet",
        "data_access_accountability_verification",
        "data_access_accountability_disclosure",
        "data_access_accountability_disclosure_notice",
        "data_access_accountability_disclosure_challenge",
      ],
    );

    const receiptRows = await db.query<{ count: number | bigint }>(
      "SELECT count(*)::bigint AS count FROM audit.command_receipts WHERE actor_id = $1",
      [actorId],
    );
    assert.equal(String(receiptRows.rows[0]?.count), "19");
  } finally {
    await db.close();
  }
});

test("CanopyProof project lifecycle authority is append-only, governed, and replayable through PostgreSQL", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const ownerId = "cp_pglite_project_owner";
  const verifierId = "cp_pglite_project_verifier";
  const approverId = "cp_pglite_project_approver";
  const organizationId = "cp_pglite_project_org";
  const projectId = "cp_pglite_project_authority";

  try {
    await db.exec(contract);
    await db.exec(contract);
    await assertProjectTriggerCatalog(db, "projects.projects", [
      "project_registration_event_binding",
      "project_registration_no_delete",
      "project_registration_no_update",
      "project_registration_validate",
      "projects_audit",
    ]);
    await assertProjectTriggerCatalog(db, "projects.project_status_transitions", [
      "project_status_transitions_audit",
      "project_transition_event_binding",
      "project_transition_no_delete",
      "project_transition_no_update",
      "project_transition_validate",
    ]);
    await assertProjectTriggerCatalog(db, "projects.monitoring_events", [
      "project_monitoring_event_binding",
      "project_monitoring_events_audit",
      "project_monitoring_no_delete",
      "project_monitoring_no_update",
      "project_monitoring_validate",
    ]);
    await assertProjectTriggerCatalog(db, "evidence.evidence_objects", [
      "evidence_objects_audit",
      "evidence_registration_event_binding",
      "evidence_registration_no_delete",
      "evidence_registration_no_update",
      "evidence_registration_validate",
    ]);

    await insertBootstrapOwner(db, ownerId);
    const prisma = pglitePrismaClient(db);
    const service = new PrismaCanopyProofTrustRegistryService(prisma);
    const organization = await service.registerOrganization(
      {
        id: organizationId,
        name: "PGlite Project Accountability Observatory",
        organizationType: "research_institution",
        jurisdiction: "GLOBAL",
        publicContact: "project-authority@example.org",
        operatingRegions: ["region_project_authority"],
        verificationCapabilities: ["project lifecycle review"],
        documents: [],
        authorizedUsers: [ownerId, verifierId, approverId],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-12T05:00:00.000Z",
      },
      ownerId,
      "project-org-create",
    );
    await service.updateOrganizationVerification(
      organization.id,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "PGLITE-PROJECT-001",
        documents: [
          {
            documentType: "registration",
            documentHash: "1".repeat(64),
            issuedBy: "PGlite Institutional Registry",
            uploadedAt: "2026-07-12T05:00:10.000Z",
          },
        ],
        authorizedUsers: [ownerId, verifierId, approverId],
        rationale: "Organization verified before exercising durable project lifecycle authority.",
        reviewedAt: "2026-07-12T05:00:10.000Z",
      },
      ownerId,
      "project-org-verify",
    );
    await service.registerParticipant(
      {
        id: verifierId,
        participantType: "human",
        displayName: "PGlite Project Lifecycle Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["2".repeat(64)],
        createdAt: "2026-07-12T05:00:20.000Z",
      },
      ownerId,
      "project-verifier-create",
    );
    await service.registerParticipant(
      {
        id: approverId,
        participantType: "human",
        displayName: "PGlite Independent Project Approver",
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["3".repeat(64)],
        createdAt: "2026-07-12T05:00:30.000Z",
      },
      ownerId,
      "project-approver-create",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: ownerId,
        role: "owner",
        conflictDisclosure: "Project creator authority is separated from final governance approval authority.",
        grantedAt: "2026-07-12T05:00:40.000Z",
      },
      ownerId,
      "project-owner-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: verifierId,
        role: "verifier",
        conflictDisclosure: "Lifecycle verifier is separate from the independent governance approver.",
        grantedAt: "2026-07-12T05:00:50.000Z",
      },
      ownerId,
      "project-verifier-membership",
    );

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [ownerId]);
      await transaction.query(
        `INSERT INTO governance.policies (
          id, title, applies_to, required_approvals, allowed_reviewer_roles,
          human_authority_required, conflict_disclosure_required,
          claim_boundary_enforced, policy_hash, created_at
        ) VALUES ($1, $2, ARRAY['project']::text[], 1, ARRAY['admin']::text[],
          true, true, true, $3, $4)`,
        [
          "cp_pglite_project_policy",
          "Independent project activation policy",
          hashJson({ kind: "pglite-project-policy-v1" }),
          "2026-07-12T05:01:00.000Z",
        ],
      );
    });

    const projectInput = {
      id: projectId,
      organizationId,
      title: "Institutional watershed restoration registry",
      projectType: "ecosystem_restoration",
      regionId: "region_project_authority",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        areaHectares: 125.5,
        boundaryHash: "4".repeat(64),
      },
      targetTreeCount: 50_000,
      biodiversityIndicators: ["habitat connectivity", "native species mix"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      monitoringCadenceDays: 60,
      governancePolicyId: "cp_pglite_project_policy",
      createdAt: "2026-07-12T05:02:00.000Z",
    } as const;

    await assert.rejects(
      service.registerProject(
        { ...projectInput, id: "cp_pglite_project_role_substitution" },
        verifierId,
        "owner",
        "project-role-substitution",
      ),
      /exact active organization role/,
    );

    const project = await service.registerProject(projectInput, ownerId, "owner", "project-register");
    assert.equal(project.status, "submitted");
    assert.equal(project.createdByRole, "owner");
    assert.equal(
      (await service.registerProject(projectInput, ownerId, "owner", "project-register")).projectRoot,
      project.projectRoot,
    );
    await assert.rejects(
      service.registerProject(
        { ...projectInput, title: "Conflicting institutional watershed registry" },
        ownerId,
        "owner",
        "project-register",
      ),
      (error: unknown) => error instanceof CanopyProofTrustRegistryError && error.httpStatus === 409,
    );
    await assert.rejects(
      service.updateProjectStatus(
        project.id,
        {
          status: "active",
          governanceApprovalId: "cp_pglite_missing_project_approval",
          rationale: "Attempted activation skips the mandatory institutional review state.",
          updatedAt: "2026-07-12T05:03:00.000Z",
        },
        verifierId,
        "verifier",
        "project-invalid-transition",
      ),
      /cannot transition from submitted to active/,
    );

    const underReview = await service.updateProjectStatus(
      project.id,
      {
        status: "under_review",
        rationale: "Independent institutional review opened before any project activation decision.",
        updatedAt: "2026-07-12T05:03:00.000Z",
      },
      verifierId,
      "verifier",
      "project-review-open",
    );
    assert.equal(underReview.status, "under_review");
    await assert.rejects(
      service.updateProjectStatus(
        project.id,
        {
          status: "active",
          governanceApprovalId: "cp_pglite_missing_project_approval",
          rationale: "A nonexistent approval cannot activate durable project authority.",
          updatedAt: "2026-07-12T05:04:00.000Z",
        },
        verifierId,
        "verifier",
        "project-fake-approval",
      ),
      /governance_approval|governance approval|foreign key/i,
    );

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [approverId]);
      await transaction.query(
        `INSERT INTO governance.approvals (
          id, subject_type, subject_id, policy_id, approver_id, approver_role,
          decision, rationale, conflict_disclosure, approval_hash, decided_at
        ) VALUES ($1, 'project', $2, $3, $4, 'admin', 'approve', $5, $6, $7, $8)`,
        [
          "cp_pglite_project_approval",
          project.id,
          "cp_pglite_project_policy",
          approverId,
          "Independent human governance review approved bounded project activation.",
          "Approver is neither project creator nor lifecycle transition actor.",
          hashJson({ kind: "pglite-project-approval-v1", projectId: project.id }),
          "2026-07-12T05:04:30.000Z",
        ],
      );
    });

    const active = await service.updateProjectStatus(
      project.id,
      {
        status: "active",
        governanceApprovalId: "cp_pglite_project_approval",
        rationale: "Independent human governance approval accepted after institutional review.",
        updatedAt: "2026-07-12T05:05:00.000Z",
      },
      verifierId,
      "verifier",
      "project-activate",
    );
    assert.equal(active.status, "active");
    assert.equal(active.governanceApprovalId, "cp_pglite_project_approval");

    const evidenceInput = {
      id: "cp_pglite_project_evidence",
      projectId: project.id,
      evidenceType: "restoration",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 8,
        regionId: "region_project_authority",
      },
      timestamp: "2026-07-12T05:06:00.000Z",
      createdAt: "2026-07-12T05:06:00.000Z",
      media_hash: "5".repeat(64),
      gps_hash: "6".repeat(64),
      confidence_score: 92,
    } as const;
    await assert.rejects(
      service.registerEvidence(
        { ...evidenceInput, id: "cp_pglite_evidence_role_substitution", media_hash: "8".repeat(64) },
        verifierId,
        "owner",
        "evidence-role-substitution",
      ),
      /exact active project organization role/,
    );
    const evidence = await service.registerEvidence(
      evidenceInput,
      verifierId,
      "verifier",
      "project-evidence-register",
    );
    assert.equal(evidence.valid, true);
    assert.equal(evidence.evidence.projectRootAtSubmission, active.projectRoot);
    assert.equal(evidence.evidence.projectStatusAtSubmission, "active");
    assert.equal(
      (
        await service.registerEvidence(
          evidenceInput,
          verifierId,
          "verifier",
          "project-evidence-register",
        )
      ).evidence.evidenceRoot,
      evidence.evidence.evidenceRoot,
    );
    await assert.rejects(
      service.registerEvidence(
        { ...evidenceInput, id: "cp_pglite_evidence_duplicate_media" },
        verifierId,
        "verifier",
        "project-evidence-duplicate-media",
      ),
      (error: unknown) => error instanceof CanopyProofTrustRegistryError && error.httpStatus === 409,
    );
    await assert.rejects(
      service.registerEvidence(
        { ...evidenceInput, gps_hash: "9".repeat(64) },
        verifierId,
        "verifier",
        "project-evidence-register",
      ),
      (error: unknown) => error instanceof CanopyProofTrustRegistryError && error.httpStatus === 409,
    );
    const challengedEvidence = await service.registerEvidence(
      {
        ...evidenceInput,
        id: "cp_pglite_project_evidence_challenged",
        location: {
          ...evidenceInput.location,
          accuracyMeters: 240,
          regionId: "region_outside_project_authority",
        },
        timestamp: "2026-07-12T05:06:10.000Z",
        createdAt: "2026-07-12T05:06:10.000Z",
        media_hash: "b".repeat(64),
      },
      verifierId,
      "verifier",
      "project-evidence-challenged",
    );
    assert.equal(challengedEvidence.valid, false);
    assert.deepEqual(challengedEvidence.issues, ["gps_accuracy_too_weak", "project_region_mismatch"]);
    assert.equal(challengedEvidence.evidence.confidence_score, 25);

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
      await transaction.query(
        `INSERT INTO satellite.observations (
          id, project_id, provider, layer_type, acquired_at, source_uri,
          observation_hash, contradiction_status
        ) VALUES ($1, $2, 'sentinel', 'ndvi', $3, $4, $5, 'neutral')`,
        [
          "cp_pglite_project_scene",
          project.id,
          "2026-07-12T05:06:30.000Z",
          "https://example.invalid/sentinel/project-scene",
          "7".repeat(64),
        ],
      );
    });

    const monitoringInput = {
      eventType: "terra_scene_review",
      observedAt: "2026-07-12T05:07:00.000Z",
      evidenceIds: ["cp_pglite_project_evidence"],
      terraSceneIds: ["cp_pglite_project_scene"],
      biodiversityIndicators: ["native species mix"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      metrics: { ndviMean: 0.64, survivalPercent: 91 },
      state: "accepted",
      rationale: "Accepted monitoring binds same-project field evidence and a prior satellite observation.",
    } as const;
    const monitoring = await service.recordProjectMonitoringEvent(
      project.id,
      monitoringInput,
      verifierId,
      "verifier",
      "project-monitoring-record",
    );
    assert.equal(monitoring.previousStatus, "active");
    assert.equal(monitoring.projectStatus, "monitored");
    assert.equal(
      (
        await service.recordProjectMonitoringEvent(
          project.id,
          monitoringInput,
          verifierId,
          "verifier",
          "project-monitoring-record",
        )
      ).monitoringRoot,
      monitoring.monitoringRoot,
    );
    const historicalRegistrationReplay = await service.registerProject(
      projectInput,
      ownerId,
      "owner",
      "project-register",
    );
    assert.equal(historicalRegistrationReplay.status, "submitted");
    assert.equal(historicalRegistrationReplay.projectRoot, project.projectRoot);
    const historicalActivationReplay = await service.updateProjectStatus(
      project.id,
      {
        status: "active",
        governanceApprovalId: "cp_pglite_project_approval",
        rationale: "Independent human governance approval accepted after institutional review.",
        updatedAt: "2026-07-12T05:05:00.000Z",
      },
      verifierId,
      "verifier",
      "project-activate",
    );
    assert.equal(historicalActivationReplay.status, "active");
    assert.equal(historicalActivationReplay.projectRoot, active.projectRoot);

    const reconnectService = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    const replayedEvidence = await reconnectService.getEvidence(evidence.evidence.id);
    assert.equal(replayedEvidence.evidenceRoot, evidence.evidence.evidenceRoot);
    assert.equal((await reconnectService.listEvidence({ projectId: project.id })).length, 2);
    assert.deepEqual(
      (await reconnectService.listEvidence({ verificationStatus: "challenged" })).map((item) => item.id),
      [challengedEvidence.evidence.id],
    );
    assert.equal((await reconnectService.listEvidence({ organizationId: "cp_foreign_org" })).length, 0);
    await assert.rejects(reconnectService.listEvidence({ limit: 101 }), /integer between 1 and 100/);
    const evidenceStatus = await reconnectService.getEvidenceRegistryStatus();
    assert.equal(evidenceStatus.registrationCount, 2);
    assert.equal(evidenceStatus.validatedCount, 1);
    assert.equal(evidenceStatus.challengedCount, 1);
    assert.equal(
      evidenceStatus.evidenceRoot,
      merkleRoot([evidence.evidence.evidenceRoot, challengedEvidence.evidence.evidenceRoot].sort()),
    );
    const replayed = await reconnectService.getProject(project.id);
    assert.equal(replayed.status, "monitored");
    assert.equal(replayed.projectRoot, monitoring.monitoringRoot);
    assert.equal((await reconnectService.listProjectStatusTransitions(project.id)).length, 2);
    assert.equal((await reconnectService.listProjectMonitoringEvents({ projectId: project.id })).length, 1);
    const status = await reconnectService.getProjectRegistryStatus();
    assert.equal(status.projectCount, 1);
    assert.equal(status.activeProjectCount, 1);
    assert.equal(status.statusTransitionCount, 2);
    assert.equal(status.monitoringEventCount, 1);

    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [ownerId]);
        await transaction.query("UPDATE projects.projects SET title = title WHERE id = $1", [project.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query("DELETE FROM projects.monitoring_events WHERE id = $1", [monitoring.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO evidence.evidence_objects (
            id, project_id, organization_id, project_root_at_submission,
            project_status_at_submission, project_region_id_at_submission,
            project_authority_updated_at_at_submission,
            evidence_type, location, observed_at, contributor_id, contributor_role,
            media_hash, gps_hash, verification_status, confidence_score,
            reviewers, validation_issues, created_at, evidence_hash, evidence_root,
            audit_event_root, audit_history, claim_boundary
          ) VALUES (
            $1, $2, $3, $4, 'monitored', 'region_project_authority', $6,
            'restoration', $5::jsonb, $6, $7, 'verifier', $8, $9,
            'validated', 80, ARRAY[]::text[], ARRAY[]::text[], $6,
            $10, $11, $12, '[]'::jsonb, '{}'::jsonb
          )`,
          [
            "cp_pglite_evidence_missing_event",
            project.id,
            organizationId,
            monitoring.monitoringRoot,
            JSON.stringify({ latitude: 14.7167, longitude: -17.4677 }),
            "2026-07-12T05:08:00.000Z",
            verifierId,
            "c".repeat(64),
            "d".repeat(64),
            "e".repeat(64),
            "f".repeat(64),
            "0".repeat(64),
          ],
        );
      }),
      /exact semantic event binding/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query("UPDATE evidence.evidence_objects SET confidence_score = 99 WHERE id = $1", [
          evidence.evidence.id,
        ]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query("DELETE FROM evidence.evidence_objects WHERE id = $1", [evidence.evidence.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query(
          `INSERT INTO projects.monitoring_events (
            id, project_id, organization_id, event_type, observed_at, observed_by,
            observer_role, previous_status, project_status, previous_project_root,
            evidence_ids, terra_scene_ids, biodiversity_indicators, water_indicators,
            climate_risk_indicators, metrics, state, rationale, event_hash,
            monitoring_root, audit_event_root
          ) VALUES ($1, $2, $3, 'field_observation', $4, $5, 'verifier',
            'monitored', 'monitored', $6, ARRAY[$7]::text[], ARRAY[]::text[],
            ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], '{}'::jsonb,
            'submitted', $8, $9, $10, $11)`,
          [
            `cp_project_monitoring_${"8".repeat(24)}`,
            project.id,
            organizationId,
            "2026-07-12T05:08:00.000Z",
            verifierId,
            monitoring.monitoringRoot,
            "cp_pglite_project_evidence",
            "This direct row intentionally lacks its mandatory semantic event binding.",
            "8".repeat(64),
            "9".repeat(64),
            "a".repeat(64),
          ],
        );
      }),
      /exact semantic event binding/,
    );
  } finally {
    await db.close();
  }
});

test("CanopyProof governed methodology and proof-policy authority are canonical, append-only, and restart-safe through PostgreSQL", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const actorId = "cp_pglite_governed_policy_owner";
  const organizationId = "cp_pglite_governed_policy_org";
  const methodologyVerifierId = "cp_pglite_methodology_publication_verifier";
  const methodologyResearcherId = "cp_pglite_methodology_publication_researcher";
  const methodologyPublisherId = "cp_pglite_methodology_publication_publisher";

  try {
    await db.exec(contract);
    await db.exec(contract);
    await insertBootstrapOwner(db, actorId);
    const service = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    await service.registerOrganization(
      {
        id: organizationId,
        name: "PGlite Methodology Governance Council",
        organizationType: "auditor",
        jurisdiction: "GLOBAL",
        publicContact: "policy-governance@example.org",
        operatingRegions: ["global"],
        verificationCapabilities: ["methodology governance", "proof policy review"],
        documents: [],
        authorizedUsers: [actorId, methodologyVerifierId, methodologyResearcherId, methodologyPublisherId],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-12T06:00:00.000Z",
      },
      actorId,
      "governed-policy-organization-create",
    );
    await service.updateOrganizationVerification(
      organizationId,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "PGLITE-POLICY-001",
        documents: [
          {
            documentType: "mandate",
            documentHash: "c".repeat(64),
            issuedBy: "PGlite Institutional Registry",
            uploadedAt: "2026-07-12T06:01:00.000Z",
          },
        ],
        authorizedUsers: [actorId, methodologyVerifierId, methodologyResearcherId, methodologyPublisherId],
        rationale: "Verified governance organization for canonical proof-policy integration testing.",
        reviewedAt: "2026-07-12T06:01:00.000Z",
      },
      actorId,
      "governed-policy-organization-verify",
    );
    await service.registerParticipant(
      {
        id: methodologyVerifierId,
        participantType: "human",
        displayName: "PGlite Methodology Publication Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["d".repeat(64)],
        createdAt: "2026-07-12T06:01:05.000Z",
      },
      actorId,
      "governed-methodology-verifier-create",
    );
    await service.registerParticipant(
      {
        id: methodologyResearcherId,
        participantType: "human",
        displayName: "PGlite Methodology Publication Researcher",
        organizationId,
        roles: ["researcher"],
        verificationStatus: "verified",
        credentialCommitments: ["e".repeat(64)],
        createdAt: "2026-07-12T06:01:10.000Z",
      },
      actorId,
      "governed-methodology-researcher-create",
    );
    await service.registerParticipant(
      {
        id: methodologyPublisherId,
        participantType: "human",
        displayName: "PGlite Methodology Publication Publisher",
        organizationId,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["f".repeat(64)],
        createdAt: "2026-07-12T06:01:15.000Z",
      },
      actorId,
      "governed-methodology-publisher-create",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId,
        role: "owner",
        conflictDisclosure: "Policy creator is bound to the verified governance organization and separate publication controls.",
        grantedAt: "2026-07-12T06:01:30.000Z",
      },
      actorId,
      "governed-policy-owner-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: methodologyVerifierId,
        role: "verifier",
        conflictDisclosure: "Methodology verifier is independent from the technical author, researcher, and publisher.",
        grantedAt: "2026-07-12T06:01:35.000Z",
      },
      actorId,
      "governed-methodology-verifier-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: methodologyResearcherId,
        role: "researcher",
        conflictDisclosure: "Methodology researcher is independent from the technical author, verifier, and publisher.",
        grantedAt: "2026-07-12T06:01:40.000Z",
      },
      actorId,
      "governed-methodology-researcher-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: methodologyPublisherId,
        role: "admin",
        conflictDisclosure: "Methodology publisher is independent from authorship and every publication approver.",
        grantedAt: "2026-07-12T06:01:45.000Z",
      },
      actorId,
      "governed-methodology-publisher-membership",
    );
    await service.recordAccreditation(
      organizationId,
      {
        status: "approved",
        scope: ["methodology publication review"],
        rationale: "Independent institutional accreditation approved for bounded methodology publication review.",
        evidenceHash: "a".repeat(64),
        decidedAt: "2026-07-12T06:01:50.000Z",
      },
      actorId,
      "governed-methodology-accreditation",
    );
    const methodologyPolicy = await service.createGovernedPolicy(
      {
        subject: "methodology_publication",
        title: "Independent methodology publication policy authority",
        requiredApprovals: 2,
        allowedReviewerRoles: ["researcher", "verifier"],
        createdAt: "2026-07-12T06:01:55.000Z",
      },
      organizationId,
      actorId,
      "owner",
      "governed-methodology-policy-create",
    );

    const input = {
      subject: "environmental_proof_record",
      title: "Independent Environmental Proof Record issuance policy",
      requiredApprovals: 2,
      allowedReviewerRoles: ["admin", "owner", "verifier"],
      createdAt: "2026-07-12T06:02:00.000Z",
    } as const;
    const policy = await service.createGovernedPolicy(
      input,
      organizationId,
      actorId,
      "owner",
      "governed-proof-policy-create",
    );
    assert.equal(
      (
        await service.createGovernedPolicy(
          input,
          organizationId,
          actorId,
          "owner",
          "governed-proof-policy-create",
        )
      ).policyRoot,
      policy.policyRoot,
    );
    const parity = await db.query<{
      command_hash: string;
      policy_hash: string;
      policy_root: string;
      payload_hash: string;
    }>(
      `SELECT
         governance.proof_policy_command_hash(policy) AS command_hash,
         governance.proof_policy_hash(policy) AS policy_hash,
         governance.proof_policy_root(policy) AS policy_root,
         governance.proof_policy_payload_hash(policy) AS payload_hash
       FROM governance.proof_policy_versions policy
       WHERE id = $1`,
      [policy.id],
    );
    assert.equal(parity.rows[0]?.command_hash, policy.commandHash);
    assert.equal(parity.rows[0]?.policy_hash, policy.policyHash);
    assert.equal(parity.rows[0]?.policy_root, policy.policyRoot);
    assert.equal(parity.rows[0]?.payload_hash, policy.auditEvent.payloadHash);

    const successor = await service.createGovernedPolicy(
      {
        subject: "environmental_proof_record",
        title: "Independent Environmental Proof Record issuance policy successor",
        requiredApprovals: 3,
        allowedReviewerRoles: ["admin", "owner", "verifier"],
        supersedesPolicyId: policy.id,
        createdAt: "2026-07-12T06:03:00.000Z",
      },
      organizationId,
      actorId,
      "owner",
      "governed-proof-policy-successor",
    );
    assert.equal(successor.supersedesPolicyRoot, policy.policyRoot);
    assert.equal(
      (await service.getCurrentGovernedPolicy("environmental_proof_record", organizationId)).id,
      successor.id,
    );
    assert.equal((await service.listGovernedPolicies(organizationId, "environmental_proof_record")).length, 2);

    const reconnect = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(await reconnect.getGovernedPolicy(policy.id, organizationId), policy);
    assert.deepEqual(
      await reconnect.getCurrentGovernedPolicy("environmental_proof_record", organizationId),
      successor,
    );

    const methodologyInput = {
      id: "cp_pglite_methodology_version_v1",
      slug: "pglite-environmental-proof-methodology",
      version: "v1.0.0",
      title: "PGlite Environmental Proof Technical Methodology",
      scope: "multi_scope",
      status: "draft",
      summary: "Technical draft for deterministic evidence, monitoring, and governance authority integration tests.",
      requiredDataSources: ["field_photo", "governance_approval", "gps_trace"],
      qualityGates: [
        "duplicate_detection_required",
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
      limitations: ["This draft has no publication, carbon, tax, token, funding, or financial authority."],
      createdAt: "2026-07-12T06:04:00.000Z",
    } as const;
    const methodology = await service.createMethodologyVersion(
      methodologyInput,
      actorId,
      "owner",
      "governed-methodology-v1-create",
    );
    assert.equal(
      (
        await service.createMethodologyVersion(
          methodologyInput,
          actorId,
          "owner",
          "governed-methodology-v1-create",
        )
      ).methodologyHash,
      methodology.methodologyHash,
    );
    const methodologyParity = await db.query<{
      quality_gate_root: string;
      methodology_hash: string;
      payload_hash: string;
    }>(
      `SELECT
         governance.methodology_quality_gate_root(methodology) AS quality_gate_root,
         governance.methodology_hash_canonical(methodology) AS methodology_hash,
         governance.methodology_payload_hash(methodology) AS payload_hash
       FROM governance.methodologies methodology
       WHERE id = $1`,
      [methodology.id],
    );
    assert.equal(methodologyParity.rows[0]?.quality_gate_root, methodology.qualityGateRoot);
    assert.equal(methodologyParity.rows[0]?.methodology_hash, methodology.methodologyHash);
    assert.equal(methodologyParity.rows[0]?.payload_hash, methodology.auditEvent.payloadHash);

    const verifierApprovalInput = {
      decision: "approve",
      rationale: "Independent accredited verifier approves the exact technical methodology and publication policy roots.",
      conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
      limitations: ["Approval is bounded to this immutable technical methodology version."],
      sourceEventRoots: [methodology.auditEvent.eventRoot, methodologyPolicy.auditEvent.eventRoot],
      decidedAt: "2026-07-12T06:05:00.000Z",
    } as const;
    const verifierApproval = await service.approveMethodologyPublication(
      methodology.id,
      verifierApprovalInput,
      organizationId,
      methodologyVerifierId,
      "verifier",
      "governed-methodology-verifier-approval",
    );
    assert.equal(
      (
        await service.approveMethodologyPublication(
          methodology.id,
          verifierApprovalInput,
          organizationId,
          methodologyVerifierId,
          "verifier",
          "governed-methodology-verifier-approval",
        )
      ).approvalRoot,
      verifierApproval.approvalRoot,
    );
    const researcherApproval = await service.approveMethodologyPublication(
      methodology.id,
      {
        decision: "approve",
        rationale: "Independent research reviewer approves publication after binding the accredited verifier decision.",
        conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
        limitations: ["Research approval does not grant carbon, tax, token, funding, or financial authority."],
        sourceEventRoots: [
          methodology.auditEvent.eventRoot,
          methodologyPolicy.auditEvent.eventRoot,
          verifierApproval.auditEvent.eventRoot,
        ],
        decidedAt: "2026-07-12T06:06:00.000Z",
      },
      organizationId,
      methodologyResearcherId,
      "researcher",
      "governed-methodology-researcher-approval",
    );
    const publicationInput = {
      approvalIds: [researcherApproval.id, verifierApproval.id],
      rationale: "Independent publisher records the complete methodology publication quorum and immutable source graph.",
      limitations: ["Publication remains subject to supersession, challenge, and continuing governance review."],
      sourceEventRoots: [
        methodology.auditEvent.eventRoot,
        methodologyPolicy.auditEvent.eventRoot,
        verifierApproval.auditEvent.eventRoot,
        researcherApproval.auditEvent.eventRoot,
      ],
      publishedAt: "2026-07-12T06:07:00.000Z",
    } as const;
    const publication = await service.publishMethodology(
      methodology.id,
      publicationInput,
      organizationId,
      methodologyPublisherId,
      "admin",
      "governed-methodology-publish",
    );
    assert.equal(
      (
        await service.publishMethodology(
          methodology.id,
          publicationInput,
          organizationId,
          methodologyPublisherId,
          "admin",
          "governed-methodology-publish",
        )
      ).publicationRoot,
      publication.publicationRoot,
    );
    const approvalParity = await db.query<{
      command_hash: string;
      source_root: string;
      approval_hash: string;
      approval_root: string;
      payload_hash: string;
    }>(
      `SELECT
         governance.methodology_publication_approval_command_hash(approval) AS command_hash,
         governance.methodology_publication_approval_source_root(approval) AS source_root,
         governance.methodology_publication_approval_hash(approval) AS approval_hash,
         governance.methodology_publication_approval_root(approval) AS approval_root,
         governance.methodology_publication_approval_payload_hash(approval) AS payload_hash
       FROM governance.methodology_publication_approvals approval
       WHERE id = $1`,
      [verifierApproval.id],
    );
    assert.equal(approvalParity.rows[0]?.command_hash, verifierApproval.commandHash);
    assert.equal(approvalParity.rows[0]?.source_root, verifierApproval.sourceRoot);
    assert.equal(approvalParity.rows[0]?.approval_hash, verifierApproval.approvalHash);
    assert.equal(approvalParity.rows[0]?.approval_root, verifierApproval.approvalRoot);
    assert.equal(approvalParity.rows[0]?.payload_hash, verifierApproval.auditEvent.payloadHash);
    const publicationParity = await db.query<{
      command_hash: string;
      source_root: string;
      publication_hash: string;
      publication_root: string;
      payload_hash: string;
      bundle_root: string;
    }>(
      `SELECT
         governance.methodology_publication_command_hash(publication) AS command_hash,
         governance.methodology_publication_source_root(publication) AS source_root,
         governance.methodology_publication_hash(publication) AS publication_hash,
         governance.methodology_publication_root(publication) AS publication_root,
         governance.methodology_publication_payload_hash(publication) AS payload_hash,
         governance.methodology_publication_bundle_root(publication) AS bundle_root
       FROM governance.methodology_publications publication
       WHERE id = $1`,
      [publication.id],
    );
    const publicationBundle = await service.getCurrentMethodologyPublicationBundle(methodology.id, organizationId);
    assert.equal(publicationParity.rows[0]?.command_hash, publication.commandHash);
    assert.equal(publicationParity.rows[0]?.source_root, publication.sourceRoot);
    assert.equal(publicationParity.rows[0]?.publication_hash, publication.publicationHash);
    assert.equal(publicationParity.rows[0]?.publication_root, publication.publicationRoot);
    assert.equal(publicationParity.rows[0]?.payload_hash, publication.auditEvent.payloadHash);
    assert.equal(publicationParity.rows[0]?.bundle_root, publicationBundle.bundleRoot);

    const methodologySuccessor = await service.createMethodologyVersion(
      {
        ...methodologyInput,
        id: "cp_pglite_methodology_version_v2",
        version: "v2.0.0",
        supersedes: methodology.id,
        createdAt: "2026-07-12T06:08:00.000Z",
      },
      actorId,
      "owner",
      "governed-methodology-v2-create",
    );
    assert.equal(methodologySuccessor.supersedes, methodology.id);
    const methodologyReconnect = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(await methodologyReconnect.getMethodologyVersion(methodology.id), methodology);
    assert.equal((await methodologyReconnect.listMethodologyVersions()).length, 2);
    assert.deepEqual(
      await methodologyReconnect.getMethodologyPublication(publication.id, organizationId),
      publication,
    );
    assert.equal(
      (await methodologyReconnect.listMethodologyPublicationApprovals(methodology.id, organizationId)).length,
      2,
    );

    const triggers = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'governance.proof_policy_versions'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      triggers.rows.map((row) => row.tgname),
      [
        "governance_proof_policy_versions_audit",
        "governance_proof_policy_versions_no_delete",
        "governance_proof_policy_versions_no_update",
        "governance_proof_policy_versions_validate",
      ],
    );
    const receiptCount = await db.query<{ count: bigint }>(
      `SELECT count(*)::bigint AS count FROM audit.command_receipts
       WHERE operation = 'governance.proof-policy.create'`,
    );
    assert.equal(Number(receiptCount.rows[0]?.count), 3);
    const methodologyReceiptCount = await db.query<{ count: bigint }>(
      `SELECT count(*)::bigint AS count FROM audit.command_receipts
       WHERE operation = 'governance.methodology-version.create'`,
    );
    assert.equal(Number(methodologyReceiptCount.rows[0]?.count), 2);
    const methodologyApprovalReceiptCount = await db.query<{ count: bigint }>(
      `SELECT count(*)::bigint AS count FROM audit.command_receipts
       WHERE operation = 'governance.methodology-publication.approve'`,
    );
    assert.equal(Number(methodologyApprovalReceiptCount.rows[0]?.count), 2);
    const methodologyPublicationReceiptCount = await db.query<{ count: bigint }>(
      `SELECT count(*)::bigint AS count FROM audit.command_receipts
       WHERE operation = 'governance.methodology-publication.publish'`,
    );
    assert.equal(Number(methodologyPublicationReceiptCount.rows[0]?.count), 1);
    const methodologyTriggers = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'governance.methodologies'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      methodologyTriggers.rows.map((row) => row.tgname),
      [
        "governance_methodologies_audit",
        "governance_methodologies_no_delete",
        "governance_methodologies_no_update",
        "governance_methodologies_validate",
      ],
    );
    const methodologyApprovalTriggers = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'governance.methodology_publication_approvals'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      methodologyApprovalTriggers.rows.map((row) => row.tgname),
      [
        "governance_methodology_publication_approvals_audit",
        "governance_methodology_publication_approvals_no_delete",
        "governance_methodology_publication_approvals_no_update",
        "governance_methodology_publication_approvals_validate",
      ],
    );
    const methodologyPublicationTriggers = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'governance.methodology_publications'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    assert.deepEqual(
      methodologyPublicationTriggers.rows.map((row) => row.tgname),
      [
        "governance_methodology_publications_audit",
        "governance_methodology_publications_no_delete",
        "governance_methodology_publications_no_update",
        "governance_methodology_publications_validate",
      ],
    );

    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await transaction.query(
          "UPDATE governance.proof_policy_versions SET required_approvals = 2 WHERE id = $1",
          [successor.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await transaction.query("DELETE FROM governance.proof_policy_versions WHERE id = $1", [policy.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await transaction.query("UPDATE governance.methodologies SET title = title WHERE id = $1", [methodology.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await transaction.query("DELETE FROM governance.methodologies WHERE id = $1", [methodologySuccessor.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [methodologyVerifierId]);
        await transaction.query(
          "UPDATE governance.methodology_publication_approvals SET rationale = rationale WHERE id = $1",
          [verifierApproval.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [methodologyPublisherId]);
        await transaction.query("DELETE FROM governance.methodology_publications WHERE id = $1", [publication.id]);
      }),
      /append-only/,
    );
  } finally {
    await db.close();
  }
});

function pglitePrismaClient(db: PGlite) {
  const client = {
    async $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
      return db.transaction((transaction) => operation(pgliteTransactionClient(transaction)));
    },
  };
  return client as unknown as PrismaClient;
}

async function assertProjectTriggerCatalog(db: PGlite, relation: string, expected: readonly string[]) {
  const rows = await db.query<{ tgname: string }>(
    `SELECT tgname
     FROM pg_trigger
     WHERE tgrelid = $1::regclass
       AND NOT tgisinternal
     ORDER BY tgname`,
    [relation],
  );
  assert.deepEqual(rows.rows.map((row) => row.tgname), expected);
}

function pgliteTransactionClient(transaction: Transaction) {
  return {
    async $queryRaw<T = unknown[]>(query: Prisma.Sql): Promise<T> {
      const result = await transaction.query(query.text, query.values);
      return result.rows as T;
    },
    async $executeRaw(query: Prisma.Sql) {
      const result = await transaction.query(query.text, query.values);
      return result.affectedRows ?? 0;
    },
  } as unknown as Prisma.TransactionClient;
}

async function insertBootstrapOwner(db: PGlite, actorId: string) {
  const createdAt = "2026-07-11T03:59:00.000Z";
  const subjectHash = hashJson({ kind: "canopyproof-pglite-bootstrap-subject-v1", actorId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["owner"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "PGlite trust-registry integration owner provisioned through an explicit bootstrap transaction.",
  })[0]!;

  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES ($1, 'human', 'PGlite Trust Owner', $1, ARRAY['owner']::text[],
        'verified', 100, ARRAY[]::text[], $2, $3, $3)`,
      [actorId, subjectHash, createdAt],
    );
    await transaction.query(
      `INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        event.id,
        actorId,
        event.action,
        event.actor,
        event.entityType,
        event.entityId,
        event.previousRoot,
        event.payloadHash,
        event.eventRoot,
        event.createdAt,
        event.rationale,
      ],
    );
  });
}
