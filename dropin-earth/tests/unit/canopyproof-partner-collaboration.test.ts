import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CanopyProofPartnerService } from "../../services/api/src/domain/canopyproof/partner-collaboration.js";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `${role}_partner_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function organizationPayload(id: string, name = "Sahel Restoration Observatory") {
  return {
    id,
    name,
    organizationType: "ngo",
    jurisdiction: "Senegal",
    publicContact: "partnerships@example.org",
    operatingRegions: ["region_ggw_sahel"],
    verificationCapabilities: ["field review", "community verification", "satellite evidence interpretation"],
    dataSharingPolicy: "restricted",
    createdAt: "2026-07-08T00:00:00.000Z",
  };
}

test("CanopyProof partner service manages organization profiles, memberships, accreditation, and data-sharing audit history", () => {
  const service = new CanopyProofPartnerService();
  const organization = service.registerOrganization(organizationPayload("cp_org_partner_domain_001"), "owner_partner_domain");

  assert.equal(organization.organizationType, "ngo");
  assert.equal(organization.accreditationStatus, "pending");
  assert.equal(organization.verificationStatus, "pending");
  assert.equal(organization.trustLevel, "unverified");
  assert.deepEqual(organization.documents, []);
  assert.equal(organization.auditHistory.length, 1);
  assert.equal(organization.auditHistory[0]?.entityType, "organization");
  assert.equal(service.listPartners().length, 0);

  assert.throws(
    () =>
      service.updateOrganizationVerification(
        organization.id,
        {
          verificationStatus: "verified",
          rationale: "Attempted institutional verification without registration documents.",
          reviewedAt: "2026-07-08T00:02:00.000Z",
        },
        "verifier_partner_domain",
      ),
    /requires a registration number/,
  );

  const documentReview = service.updateOrganizationVerification(
    organization.id,
    {
      verificationStatus: "document_review",
      registrationNumber: "SN-NGO-2026-001",
      documents: [
        {
          documentType: "registration",
          documentHash: "c".repeat(64),
          issuedBy: "Senegal NGO Registry",
          uploadedAt: "2026-07-08T00:02:00.000Z",
        },
      ],
      authorizedUsers: ["verifier_partner_domain_001"],
      rationale: "Registration document received for institutional review.",
      reviewedAt: "2026-07-08T00:02:00.000Z",
    },
    "verifier_partner_domain",
  );
  assert.equal(documentReview.verificationStatus, "document_review");
  assert.equal(documentReview.trustLevel, "basic");
  assert.equal(documentReview.registrationNumber, "SN-NGO-2026-001");
  assert.equal(documentReview.documents.length, 1);
  assert.equal(documentReview.auditHistory.at(-1)?.entityType, "organization_verification");

  const verifiedOrganization = service.updateOrganizationVerification(
    organization.id,
    {
      verificationStatus: "verified",
      trustLevel: "institutional",
      rationale: "Legal registration and authorized users were reviewed by an accountable verifier.",
      reviewedAt: "2026-07-08T00:03:00.000Z",
    },
    "verifier_partner_domain",
  );
  assert.equal(verifiedOrganization.verificationStatus, "verified");
  assert.equal(verifiedOrganization.trustLevel, "institutional");
  assert.ok(verifiedOrganization.authorizedUsers.includes("verifier_partner_domain_001"));

  const membership = service.grantMembership(
    organization.id,
    {
      actorId: "verifier_partner_domain_001",
      role: "verifier",
      conflictDisclosure: "No project fund control, no direct payout authority.",
      grantedAt: "2026-07-08T00:05:00.000Z",
    },
    "admin_partner_domain",
  );
  assert.equal(membership.status, "active");
  assert.equal(membership.auditEvent.entityType, "membership");

  const suspended = service.updateMembershipStatus(
    organization.id,
    membership.id,
    {
      status: "suspended",
      rationale: "Temporary suspension while conflict disclosure is refreshed.",
      changedAt: "2026-07-08T00:06:00.000Z",
    },
    "admin_partner_domain",
  );
  assert.equal(suspended.status, "suspended");
  assert.equal(suspended.auditEvent.action, "CHALLENGE");

  const accreditation = service.recordAccreditation(
    organization.id,
    {
      status: "approved",
      scope: ["field verification", "community verification"],
      rationale: "Approved after governance review and partner due diligence.",
      evidenceHash: "a".repeat(64),
      decidedAt: "2026-07-08T00:10:00.000Z",
    },
    "owner_partner_domain",
  );
  assert.equal(accreditation.status, "approved");
  assert.equal(accreditation.auditEvent.entityType, "accreditation");
  assert.equal(service.listPartners().length, 1);

  const agreement = service.createDataSharingAgreement(
    organization.id,
    {
      datasetScopes: ["evidence summaries", "TerraProof scene metadata"],
      privacyTier: "restricted",
      permittedUses: ["verification review", "ESG reporting"],
      expiresAt: "2027-07-08T00:00:00.000Z",
      createdAt: "2026-07-08T00:15:00.000Z",
    },
    "admin_partner_domain",
  );
  assert.equal(agreement.privacyTier, "restricted");
  assert.equal(agreement.revoked, false);
  assert.ok(agreement.agreementHash.length >= 64);
  assert.equal(agreement.auditEvent.entityType, "data_sharing_agreement");

  const accessRequest = service.requestDataAccess(
    organization.id,
    {
      agreementId: agreement.id,
      datasetScopes: ["evidence summaries"],
      privacyTier: "restricted",
      permittedUses: ["verification review"],
      purpose: "Review proof summaries for restoration evidence QA.",
      requestedAt: "2026-07-08T00:20:00.000Z",
      expiresAt: "2026-10-08T00:00:00.000Z",
    },
    "researcher_partner_domain",
  );
  assert.equal(accessRequest.status, "pending");
  assert.equal(accessRequest.auditEvent.entityType, "data_access_request");
  assert.equal(accessRequest.safety.agreementBound, true);
  assert.equal(accessRequest.safety.notCarbonCredit, true);
  assert.ok(accessRequest.accessRoot.length >= 64);

  assert.throws(
    () =>
      service.requestDataAccess(
        organization.id,
        {
          agreementId: agreement.id,
          datasetScopes: ["raw household contacts"],
          privacyTier: "restricted",
          permittedUses: ["verification review"],
          purpose: "Requesting a dataset outside the approved agreement boundary.",
          requestedAt: "2026-07-08T00:21:00.000Z",
        },
        "researcher_partner_domain",
      ),
    /dataset scopes must be a subset/,
  );
  assert.throws(
    () =>
      service.requestDataAccess(
        organization.id,
        {
          agreementId: agreement.id,
          datasetScopes: ["evidence summaries"],
          privacyTier: "restricted",
          permittedUses: ["verification review"],
          purpose: "Send reviewer export to private@example.org for manual review.",
          requestedAt: "2026-07-08T00:22:00.000Z",
        },
        "researcher_partner_domain",
      ),
    /cannot embed raw private contact/,
  );
  assert.throws(
    () =>
      service.decideDataAccessRequest(
        accessRequest.id,
        {
          status: "approved",
          rationale: "Self-approval is not permitted for institutional data access.",
          decidedAt: "2026-07-08T00:23:00.000Z",
        },
        "researcher_partner_domain",
      ),
    /independent human decision/,
  );

  const approvedAccess = service.decideDataAccessRequest(
    accessRequest.id,
    {
      status: "approved",
      rationale: "Approved for scoped evidence summary review under the agreement.",
      decidedAt: "2026-07-08T00:24:00.000Z",
    },
    "verifier_partner_domain",
  );
  assert.equal(approvedAccess.status, "approved");
  assert.equal(approvedAccess.decisionBy, "verifier_partner_domain");
  assert.equal(approvedAccess.auditEvent.action, "ASSERT");
  assert.equal(approvedAccess.decisionAuditEvent?.action, "FULFILL");
  assert.equal(approvedAccess.decisionAuditEvent?.entityType, "data_access_request_decision");
  assert.equal(service.listDataAccessRequests(organization.id).length, 1);

  assert.throws(
    () =>
      service.recordDataAccessDelivery(
        approvedAccess.id,
        {
          manifestId: "cp_audit_export_manifest_domain_001",
          manifestRequesterOrganizationId: organization.id,
          manifestHash: "e".repeat(64),
          manifestEntryRoot: "f".repeat(64),
          manifestClassification: "confidential",
          channel: "audit_export_manifest",
          recipientActorId: "researcher_partner_domain",
          purpose: "Attempt to deliver data above the approved restricted privacy tier.",
          deliveredAt: "2026-07-08T00:25:00.000Z",
        },
        "verifier_partner_domain",
      ),
    /classification exceeds/,
  );

  const deliveryReceipt = service.recordDataAccessDelivery(
    approvedAccess.id,
    {
      manifestId: "cp_audit_export_manifest_domain_001",
      manifestRequesterOrganizationId: organization.id,
      manifestHash: "e".repeat(64),
      manifestEntryRoot: "f".repeat(64),
      manifestClassification: "restricted",
      channel: "audit_export_manifest",
      recipientActorId: "researcher_partner_domain",
      purpose: "Deliver scoped proof summaries as a hash-only audit export manifest.",
      deliveredAt: "2026-07-08T00:26:00.000Z",
    },
    "verifier_partner_domain",
  );
  assert.equal(deliveryReceipt.requestId, approvedAccess.id);
  assert.equal(deliveryReceipt.safety.manifestHashOnly, true);
  assert.equal(deliveryReceipt.safety.notFinancialAsset, true);
  assert.equal(deliveryReceipt.auditEvent.entityType, "data_access_delivery_receipt");
  assert.equal(service.listDataAccessDeliveryReceipts(approvedAccess.id).length, 1);

  assert.throws(
    () =>
      service.recordDataUseAttestation(
        deliveryReceipt.id,
        {
          usageState: "within_scope",
          useCase: "Attempt to attest scoped use without output hashes.",
          outputHashes: [],
          limitations: ["No raw evidence was exported."],
          attestedAt: "2026-07-08T00:27:00.000Z",
        },
        "researcher_partner_domain",
      ),
    /requires at least one output hash/,
  );

  const useAttestation = service.recordDataUseAttestation(
    deliveryReceipt.id,
    {
      usageState: "within_scope",
      useCase: "Reviewed redacted proof summaries for scoped restoration QA.",
      outputHashes: ["1".repeat(64)],
      limitations: ["No raw media or personal data was exported."],
      attestedAt: "2026-07-08T00:28:00.000Z",
    },
    "researcher_partner_domain",
  );
  assert.equal(useAttestation.usageState, "within_scope");
  assert.equal(useAttestation.safety.outputHashOnly, true);
  assert.equal(useAttestation.auditEvent.action, "ASSERT");

  const challengeAttestation = service.recordDataUseAttestation(
    deliveryReceipt.id,
    {
      usageState: "misuse_challenged",
      useCase: "Challenge possible use outside the approved research review boundary.",
      evidenceEventRoots: ["2".repeat(64)],
      limitations: ["Challenge is not a final finding and requires human review."],
      attestedAt: "2026-07-08T00:29:00.000Z",
    },
    "verifier_partner_domain",
  );
  assert.equal(challengeAttestation.auditEvent.action, "CHALLENGE");
  assert.equal(service.listDataUseAttestations(deliveryReceipt.id).length, 2);

  assert.throws(
    () =>
      service.recordDataUseEnforcementCase(
        useAttestation.id,
        {
          caseState: "under_review",
          enforcementAction: "notify_partner",
          rationale: "Attempt to open enforcement from a within-scope attestation.",
          evidenceEventRoots: ["3".repeat(64)],
          reviewedAt: "2026-07-08T00:30:00.000Z",
        },
        "admin_partner_domain",
      ),
    /require a challenged or revocation-requested attestation/,
  );
  assert.throws(
    () =>
      service.recordDataUseEnforcementCase(
        challengeAttestation.id,
        {
          caseState: "under_review",
          enforcementAction: "notify_partner",
          rationale: "Self-review of a misuse challenge must be refused.",
          evidenceEventRoots: ["3".repeat(64)],
          reviewedAt: "2026-07-08T00:30:00.000Z",
        },
        "verifier_partner_domain",
      ),
    /independent human reviewer/,
  );

  const enforcementCase = service.recordDataUseEnforcementCase(
    challengeAttestation.id,
    {
      caseState: "access_suspended",
      enforcementAction: "suspend_data_access",
      rationale: "Suspend access while the challenged data-use boundary is independently reviewed.",
      evidenceEventRoots: ["3".repeat(64)],
      reviewedAt: "2026-07-08T00:31:00.000Z",
    },
    "admin_partner_domain",
  );
  assert.equal(enforcementCase.caseState, "access_suspended");
  assert.equal(enforcementCase.enforcementAction, "suspend_data_access");
  assert.equal(enforcementCase.safety.independentReviewerRequired, true);
  assert.equal(enforcementCase.safety.accessMutationRequiresSeparateApproval, true);
  assert.equal(enforcementCase.auditEvent.entityType, "data_use_enforcement_case");
  assert.equal(service.listDataUseEnforcementCases(challengeAttestation.id).length, 1);

  assert.throws(
    () =>
      service.recordDataAccessRestriction(
        enforcementCase.id,
        {
          restrictionState: "suspended",
          rationale: "Self-approval of an access suspension must be refused.",
          evidenceEventRoots: ["4".repeat(64)],
          decidedAt: "2026-07-08T00:32:00.000Z",
        },
        "admin_partner_domain",
      ),
    /separate independent approval actor/,
  );
  const restriction = service.recordDataAccessRestriction(
    enforcementCase.id,
    {
      restrictionState: "suspended",
      rationale: "Suspend future deliveries while the misuse challenge is under institutional review.",
      evidenceEventRoots: ["4".repeat(64)],
      decidedAt: "2026-07-08T00:33:00.000Z",
    },
    "owner_partner_domain",
  );
  assert.equal(restriction.restrictionState, "suspended");
  assert.equal(restriction.safety.separateApprovalPath, true);
  assert.equal(restriction.safety.deliveryBlockingEnforced, true);
  assert.equal(restriction.auditEvent.entityType, "data_access_restriction");
  assert.equal(service.listDataAccessRestrictions(approvedAccess.id).length, 1);
  assert.throws(
    () =>
      service.recordDataAccessDelivery(
        approvedAccess.id,
        {
          manifestId: "cp_audit_export_manifest_domain_002",
          manifestRequesterOrganizationId: organization.id,
          manifestHash: "d".repeat(64),
          manifestEntryRoot: "c".repeat(64),
          manifestClassification: "restricted",
          channel: "audit_export_manifest",
          recipientActorId: "researcher_partner_domain",
          purpose: "Attempt a future delivery after access suspension.",
          deliveredAt: "2026-07-08T00:34:00.000Z",
        },
        "verifier_partner_domain",
      ),
    /currently restricted: suspended/,
  );

  const packet = service.createDataAccessAccountabilityPacket(
    approvedAccess.id,
    {
      intendedAudience: "institutional audit reviewer",
      generatedAt: "2026-07-08T00:35:00.000Z",
    },
    "verifier_partner_domain",
  );
  assert.equal(packet.counts.deliveryReceiptCount, 1);
  assert.equal(packet.counts.agreementRevocationCount, 0);
  assert.equal(packet.counts.dataUseAttestationCount, 2);
  assert.equal(packet.counts.enforcementCaseCount, 1);
  assert.equal(packet.counts.activeRestrictionCount, 1);
  assert.equal(packet.lineageRoots.deliveryRoots.length, 1);
  assert.equal(packet.lineageRoots.agreementRevocationRoots.length, 0);
  assert.equal(packet.lineageRoots.usageRoots.length, 2);
  assert.equal(packet.lineageRoots.enforcementRoots.length, 1);
  assert.equal(packet.lineageRoots.restrictionRoots.length, 1);
  assert.equal(packet.safety.hashOnlyLineage, true);
  assert.equal(packet.safety.observerReadable, true);
  assert.equal(packet.auditEvent.entityType, "data_access_accountability_packet");

  assert.throws(
    () =>
      service.verifyDataAccessAccountabilityPacket(
        packet.id,
        { expectedPacketRoot: packet.packetRoot, verifiedAt: "2026-07-08T00:36:00.000Z" },
        "verifier_partner_domain",
      ),
    /actor independent from the packet generator/,
  );

  const cleanVerification = service.verifyDataAccessAccountabilityPacket(
    packet.id,
    {
      expectedPacketRoot: packet.packetRoot,
      verifiedAt: "2026-07-08T00:36:00.000Z",
    },
    "observer_partner_domain",
  );
  assert.equal(cleanVerification.valid, true);
  assert.deepEqual(cleanVerification.issues, []);
  assert.equal(cleanVerification.auditEvent.action, "ASSERT");
  assert.equal(cleanVerification.auditEvent.entityType, "data_access_accountability_verification");

  assert.throws(
    () =>
      service.publishDataAccessAccountabilityDisclosure(
        packet.id,
        { verificationId: cleanVerification.id, publishedAt: "2026-07-08T00:36:30.000Z" },
        "observer_partner_domain",
      ),
    /requires separate packet generator, replay verifier, and publisher actors/,
  );
  const disclosure = service.publishDataAccessAccountabilityDisclosure(
    packet.id,
    { verificationId: cleanVerification.id, publishedAt: "2026-07-08T00:36:30.000Z" },
    "owner_partner_domain",
  );
  assert.equal(disclosure.packetId, packet.id);
  assert.equal(disclosure.currentState, "current");
  assert.deepEqual(disclosure.currentIssues, []);
  assert.equal(disclosure.safety.hashOnly, true);
  assert.equal(disclosure.safety.independentPublicationRequired, true);
  assert.equal(disclosure.auditEvent.entityType, "data_access_accountability_disclosure");
  const disclosureIndex = service.getDataAccessAccountabilityDisclosureIndex({ limit: 1, currentState: "current" });
  assert.equal(disclosureIndex.totalCount, 1);
  assert.equal(disclosureIndex.items[0]?.id, disclosure.id);
  assert.equal(disclosureIndex.safety.boundedPagination, true);
  assert.match(disclosureIndex.indexRoot, /^[a-f0-9]{64}$/);
  assert.throws(
    () => service.getDataAccessAccountabilityDisclosureIndex({ cursor: "cp_data_access_disclosure_missing", limit: 1 }),
    /cursor is invalid/,
  );
  assert.throws(
    () =>
      service.challengeDataAccessAccountabilityDisclosure(
        disclosure.id,
        {
          reason: "privacy_risk",
          statement: "Contact private-review@example.org because this disclosure may expose private material.",
          evidenceEventRoots: ["6".repeat(64)],
          challengedAt: "2026-07-08T00:36:34.000Z",
        },
        "community_partner_domain",
        "community",
      ),
    /cannot embed raw private contact, key, or secret material/,
  );
  const disclosureChallenge = service.challengeDataAccessAccountabilityDisclosure(
    disclosure.id,
    {
      reason: "governance_violation",
      statement: "Challenge whether the published packet retained the required governance context.",
      evidenceEventRoots: ["6".repeat(64)],
      challengedAt: "2026-07-08T00:36:35.000Z",
    },
    "community_partner_domain",
    "community",
  );
  assert.equal(disclosureChallenge.auditEvent.entityType, "data_access_accountability_disclosure_challenge");
  assert.equal(disclosureChallenge.safety.humanResolutionRequired, true);
  assert.equal(service.getDataAccessAccountabilityDisclosure(disclosure.id).governanceState, "challenged");
  assert.equal(service.getDataAccessAccountabilityDisclosure(disclosure.id).openChallengeCount, 1);
  assert.throws(
    () =>
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        disclosureChallenge.id,
        {
          decision: "dismissed",
          remedialAction: "none",
          rationale: "The challenger cannot independently dismiss the same public challenge.",
          evidenceEventRoots: ["6".repeat(64)],
          reviewedAt: "2026-07-08T00:36:40.000Z",
        },
        "community_partner_domain",
        "verifier",
      ),
    /requires an independent human reviewer/,
  );
  assert.throws(
    () =>
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        disclosureChallenge.id,
        {
          decision: "needs_more_evidence",
          remedialAction: "none",
          rationale: "Send private review material to resolution-review@example.org before final disposition.",
          evidenceEventRoots: ["7".repeat(64)],
          reviewedAt: "2026-07-08T00:36:40.000Z",
        },
        "admin_partner_domain",
        "admin",
      ),
    /cannot embed raw private contact, key, or secret material/,
  );
  const evidenceRequestResolution = service.resolveDataAccessAccountabilityDisclosureChallenge(
    disclosureChallenge.id,
    {
      decision: "needs_more_evidence",
      remedialAction: "none",
      rationale: "Independent review requires one additional governance event root before final disposition.",
      evidenceEventRoots: ["7".repeat(64)],
      reviewedAt: "2026-07-08T00:36:40.000Z",
    },
    "admin_partner_domain",
    "admin",
  );
  assert.equal(evidenceRequestResolution.decision, "needs_more_evidence");
  assert.equal(service.getDataAccessAccountabilityDisclosure(disclosure.id).governanceState, "needs_more_evidence");
  const withdrawalResolution = service.resolveDataAccessAccountabilityDisclosureChallenge(
    disclosureChallenge.id,
    {
      decision: "upheld",
      remedialAction: "publish_withdrawal_notice",
      rationale: "Governance context was incomplete, so the disclosure must carry a public withdrawal notice.",
      evidenceEventRoots: ["8".repeat(64)],
      reviewedAt: "2026-07-08T00:36:45.000Z",
    },
    "verifier_partner_domain",
    "verifier",
  );
  assert.equal(withdrawalResolution.previousResolutionId, evidenceRequestResolution.id);
  assert.equal(withdrawalResolution.previousResolutionRoot, evidenceRequestResolution.resolutionRoot);
  assert.equal(
    service.resolveDataAccessAccountabilityDisclosureChallenge(
      disclosureChallenge.id,
      {
        decision: "needs_more_evidence",
        remedialAction: "none",
        rationale: "Independent review requires one additional governance event root before final disposition.",
        evidenceEventRoots: ["7".repeat(64)],
        reviewedAt: "2026-07-08T00:36:40.000Z",
      },
      "admin_partner_domain",
      "admin",
    ).id,
    evidenceRequestResolution.id,
  );
  assert.equal(service.getDataAccessAccountabilityDisclosure(disclosure.id).governanceState, "withdrawal_required");
  assert.throws(
    () =>
      service.resolveDataAccessAccountabilityDisclosureChallenge(
        disclosureChallenge.id,
        {
          decision: "dismissed",
          remedialAction: "none",
          rationale: "A final disclosure challenge resolution cannot be silently replaced.",
          evidenceEventRoots: ["9".repeat(64)],
          reviewedAt: "2026-07-08T00:36:46.000Z",
        },
        "admin_partner_domain",
        "admin",
      ),
    /already has a final resolution/,
  );
  const withdrawalNotice = service.publishDataAccessAccountabilityDisclosureNotice(
    withdrawalResolution.id,
    {
      noticeType: "withdrawal",
      statement: "This disclosure is withdrawn from current institutional reliance; its immutable history remains public.",
      evidenceEventRoots: ["a".repeat(64)],
      publishedAt: "2026-07-08T00:36:50.000Z",
    },
    "admin_partner_domain",
    "admin",
  );
  assert.equal(withdrawalNotice.safety.originalDisclosurePreserved, true);
  assert.equal(withdrawalNotice.auditEvent.entityType, "data_access_accountability_disclosure_notice");
  const withdrawnDisclosure = service.getDataAccessAccountabilityDisclosure(disclosure.id);
  assert.equal(withdrawnDisclosure.governanceState, "withdrawn");
  assert.equal(withdrawnDisclosure.openChallengeCount, 0);
  assert.deepEqual(withdrawnDisclosure.noticeIds, [withdrawalNotice.id]);
  assert.equal(service.getDataAccessAccountabilityDisclosureIndex({ governanceState: "withdrawn" }).totalCount, 1);

  const revocation = service.revokeDataSharingAgreement(
    agreement.id,
    {
      rationale: "Revoke the partner data-sharing agreement after a misuse challenge and access suspension.",
      evidenceEventRoots: ["5".repeat(64)],
      revokedAt: "2026-07-08T00:37:00.000Z",
    },
    "owner_partner_domain",
  );
  assert.equal(revocation.agreementId, agreement.id);
  assert.equal(revocation.safety.futureAccessBlocked, true);
  assert.equal(revocation.safety.futureDeliveryBlocked, true);
  assert.equal(revocation.auditEvent.entityType, "data_sharing_agreement_revocation");
  assert.equal(service.listDataSharingAgreements(organization.id)[0]?.revoked, true);
  assert.equal(service.listDataSharingAgreementRevocations(agreement.id).length, 1);
  assert.throws(
    () =>
      service.requestDataAccess(
        organization.id,
        {
          agreementId: agreement.id,
          datasetScopes: ["evidence summaries"],
          privacyTier: "restricted",
          permittedUses: ["verification review"],
          purpose: "Attempt a new access request after agreement revocation.",
          requestedAt: "2026-07-08T00:37:30.000Z",
        },
        "researcher_partner_domain",
      ),
    /revoked data-sharing agreement/,
  );
  assert.throws(
    () =>
      service.recordDataAccessDelivery(
        approvedAccess.id,
        {
          manifestId: "cp_audit_export_manifest_domain_003",
          manifestRequesterOrganizationId: organization.id,
          manifestHash: "0".repeat(64),
          manifestEntryRoot: "9".repeat(64),
          manifestClassification: "restricted",
          channel: "audit_export_manifest",
          recipientActorId: "researcher_partner_domain",
          purpose: "Attempt future delivery after agreement revocation.",
          deliveredAt: "2026-07-08T00:37:40.000Z",
        },
        "verifier_partner_domain",
      ),
    /revoked data-sharing agreement/,
  );
  const revokedAgreementVerification = service.verifyDataAccessAccountabilityPacket(
    packet.id,
    {
      expectedPacketRoot: packet.packetRoot,
      verifiedAt: "2026-07-08T00:37:50.000Z",
    },
    "observer_partner_domain",
  );
  assert.equal(revokedAgreementVerification.valid, false);
  assert.ok(revokedAgreementVerification.issues.includes("lineage_stale"));
  assert.equal(revokedAgreementVerification.auditEvent.action, "CHALLENGE");
  const staleDisclosure = service.getDataAccessAccountabilityDisclosure(disclosure.id);
  assert.equal(staleDisclosure.currentState, "stale");
  assert.ok(staleDisclosure.currentIssues.includes("lineage_stale"));
  assert.equal(service.getDataAccessAccountabilityDisclosureStatus().staleDisclosureCount, 1);
  assert.throws(
    () =>
      service.publishDataAccessAccountabilityDisclosure(
        packet.id,
        { verificationId: cleanVerification.id, publishedAt: "2026-07-08T00:37:55.000Z" },
        "admin_partner_domain",
      ),
    /already disclosed/,
  );

  const noUseAttestation = service.recordDataUseAttestation(
    deliveryReceipt.id,
    {
      usageState: "no_use",
      useCase: "Recipient later attested no further use after suspension.",
      limitations: ["No additional output artifact was produced."],
      attestedAt: "2026-07-08T00:38:00.000Z",
    },
    "researcher_partner_domain",
  );
  assert.equal(noUseAttestation.usageState, "no_use");
  const staleVerification = service.verifyDataAccessAccountabilityPacket(
    packet.id,
    {
      expectedPacketRoot: packet.packetRoot,
      verifiedAt: "2026-07-08T00:39:00.000Z",
    },
    "observer_partner_domain",
  );
  assert.equal(staleVerification.valid, false);
  assert.deepEqual(staleVerification.issues, ["lineage_stale"]);
  assert.equal(staleVerification.auditEvent.action, "CHALLENGE");

  const updatedOrganization = service.getOrganization(organization.id);
  assert.equal(updatedOrganization.auditHistory.length, 25);
  assert.equal(updatedOrganization.accreditationStatus, "approved");
  assert.equal(updatedOrganization.verificationStatus, "verified");
  assert.equal(service.getStatus().dataAccessRequestCount, 1);
  assert.equal(service.getStatus().approvedDataAccessRequestCount, 1);
  assert.equal(service.getStatus().dataAccessDeliveryReceiptCount, 1);
  assert.equal(service.getStatus().dataUseAttestationCount, 3);
  assert.equal(service.getStatus().challengedDataUseAttestationCount, 1);
  assert.equal(service.getStatus().dataUseEnforcementCaseCount, 1);
  assert.equal(service.getStatus().openDataUseEnforcementCaseCount, 1);
  assert.equal(service.getStatus().dataAccessRestrictionCount, 1);
  assert.equal(service.getStatus().activeDataAccessRestrictionCount, 1);
  assert.equal(service.getStatus().revokedDataSharingAgreementCount, 1);
  assert.equal(service.getStatus().dataSharingAgreementRevocationCount, 1);
  assert.equal(service.getStatus().dataAccessAccountabilityPacketCount, 1);
  assert.equal(service.getStatus().dataAccessAccountabilityVerificationCount, 3);
  assert.equal(service.getStatus().failedDataAccessAccountabilityVerificationCount, 2);
  assert.equal(service.getStatus().dataAccessAccountabilityDisclosureCount, 1);
  assert.equal(service.getStatus().staleDataAccessAccountabilityDisclosureCount, 1);
  assert.equal(service.getStatus().dataAccessAccountabilityDisclosureChallengeCount, 1);
  assert.equal(service.getStatus().openDataAccessAccountabilityDisclosureChallengeCount, 0);
  assert.equal(service.getStatus().dataAccessAccountabilityDisclosureResolutionCount, 2);
  assert.equal(service.getStatus().dataAccessAccountabilityDisclosureNoticeCount, 1);
  assert.equal(service.getStatus().withdrawnDataAccessAccountabilityDisclosureCount, 1);
  assert.equal(service.getStatus().correctedDataAccessAccountabilityDisclosureCount, 0);
});

test("CanopyProof partner service records constrained agreement renewal lineage and blocks predecessor reuse", () => {
  const service = new CanopyProofPartnerService();
  const organization = service.registerOrganization(organizationPayload("cp_org_partner_renewal_001", "Lake Chad Evidence Consortium"), "owner_partner_renewal");
  service.updateOrganizationVerification(
    organization.id,
    {
      verificationStatus: "document_review",
      registrationNumber: "TD-RESEARCH-2026-014",
      documents: [{ documentType: "registration", documentHash: "6".repeat(64) }],
      rationale: "Registration evidence entered for independent institutional review.",
      reviewedAt: "2026-07-08T01:00:00.000Z",
    },
    "verifier_partner_renewal",
  );
  service.updateOrganizationVerification(
    organization.id,
    {
      verificationStatus: "verified",
      trustLevel: "institutional",
      rationale: "Registration, jurisdiction, and accountable research mandate verified.",
      reviewedAt: "2026-07-08T01:01:00.000Z",
    },
    "verifier_partner_renewal",
  );
  const predecessor = service.createDataSharingAgreement(
    organization.id,
    {
      datasetScopes: ["proof record summaries", "TerraProof scene metadata"],
      privacyTier: "restricted",
      permittedUses: ["research review", "methodology evaluation"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-07-08T01:02:00.000Z",
    },
    "admin_partner_renewal",
  );
  const accessRequest = service.requestDataAccess(
    organization.id,
    {
      agreementId: predecessor.id,
      datasetScopes: ["proof record summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      purpose: "Review proof summaries before the agreement renewal boundary.",
      requestedAt: "2026-07-08T01:03:00.000Z",
      expiresAt: "2026-12-01T00:00:00.000Z",
    },
    "researcher_partner_renewal",
  );
  const approvedAccess = service.decideDataAccessRequest(
    accessRequest.id,
    {
      status: "approved",
      rationale: "Approve scoped research access before the agreement renewal.",
      decidedAt: "2026-07-08T01:04:00.000Z",
    },
    "verifier_partner_renewal",
  );
  const predecessorPacket = service.createDataAccessAccountabilityPacket(
    approvedAccess.id,
    { intendedAudience: "institutional agreement reviewer", generatedAt: "2026-07-08T01:05:00.000Z" },
    "verifier_partner_renewal",
  );
  assert.equal(predecessorPacket.counts.agreementSupersessionCount, 0);
  assert.equal(predecessorPacket.lineageRoots.agreementSupersessionRoots.length, 0);

  assert.throws(
    () =>
      service.supersedeDataSharingAgreement(
        predecessor.id,
        {
          transitionType: "renewal",
          successor: {
            datasetScopes: ["proof record summaries", "TerraProof scene metadata", "raw field media"],
            privacyTier: "restricted",
            permittedUses: ["research review", "methodology evaluation"],
            expiresAt: "2028-01-01T00:00:00.000Z",
          },
          rationale: "Attempt to widen a renewal beyond the immutable predecessor scope.",
          evidenceEventRoots: ["7".repeat(64)],
          supersededAt: "2026-07-08T01:06:00.000Z",
        },
        "admin_partner_renewal",
      ),
    /renewal must preserve dataset scopes/,
  );

  const supersession = service.supersedeDataSharingAgreement(
    predecessor.id,
    {
      transitionType: "renewal",
      successor: {
        datasetScopes: ["TerraProof scene metadata", "proof record summaries"],
        privacyTier: "restricted",
        permittedUses: ["methodology evaluation", "research review"],
        expiresAt: "2028-01-01T00:00:00.000Z",
      },
      rationale: "Renew the same least-privilege research agreement after governance review.",
      evidenceEventRoots: ["8".repeat(64)],
      supersededAt: "2026-07-08T01:06:00.000Z",
    },
    "admin_partner_renewal",
  );
  assert.equal(supersession.predecessorAgreementId, predecessor.id);
  assert.equal(supersession.transitionType, "renewal");
  assert.equal(supersession.safety.scopeExpansionBlocked, true);
  assert.equal(supersession.safety.priorAgreementFutureAccessBlocked, true);
  assert.equal(supersession.auditEvent.entityType, "data_sharing_agreement_supersession");
  const agreements = service.listDataSharingAgreements(organization.id);
  const predecessorView = agreements.find((agreement) => agreement.id === predecessor.id);
  const successor = agreements.find((agreement) => agreement.id === supersession.successorAgreementId);
  assert.ok(successor);
  assert.equal(predecessorView?.superseded, true);
  assert.equal(predecessorView?.supersededByAgreementId, supersession.successorAgreementId);
  assert.equal(successor?.superseded, false);
  assert.equal(successor?.supersedesAgreementId, predecessor.id);
  assert.equal(successor?.expiresAt, "2028-01-01T00:00:00.000Z");
  assert.equal(service.listDataSharingAgreementSupersessions(predecessor.id).length, 1);
  assert.equal(service.listDataSharingAgreementSupersessions(successor.id).length, 1);
  assert.equal(service.getDataSharingAgreementSupersession(supersession.id).supersessionRoot, supersession.supersessionRoot);

  assert.throws(
    () =>
      service.requestDataAccess(
        organization.id,
        {
          agreementId: predecessor.id,
          datasetScopes: ["proof record summaries"],
          privacyTier: "restricted",
          permittedUses: ["research review"],
          purpose: "Attempt a new request against the superseded agreement.",
          requestedAt: "2026-07-08T01:07:00.000Z",
        },
        "researcher_partner_renewal",
      ),
    /superseded data-sharing agreement/,
  );
  assert.throws(
    () =>
      service.recordDataAccessDelivery(
        approvedAccess.id,
        {
          manifestId: "cp_audit_export_manifest_renewal_001",
          manifestRequesterOrganizationId: organization.id,
          manifestHash: "9".repeat(64),
          manifestEntryRoot: "a".repeat(64),
          manifestClassification: "restricted",
          channel: "audit_export_manifest",
          recipientActorId: "researcher_partner_renewal",
          purpose: "Attempt delivery after the predecessor agreement was superseded.",
          deliveredAt: "2026-07-08T01:07:30.000Z",
        },
        "verifier_partner_renewal",
      ),
    /superseded data-sharing agreement/,
  );
  assert.throws(
    () =>
      service.supersedeDataSharingAgreement(
        predecessor.id,
        {
          transitionType: "renewal",
          successor: {
            datasetScopes: predecessor.datasetScopes,
            privacyTier: predecessor.privacyTier,
            permittedUses: predecessor.permittedUses,
            expiresAt: "2029-01-01T00:00:00.000Z",
          },
          rationale: "Attempt to attach a second successor to one predecessor agreement.",
          evidenceEventRoots: ["b".repeat(64)],
          supersededAt: "2026-07-08T01:08:00.000Z",
        },
        "admin_partner_renewal",
      ),
    /already has a successor/,
  );

  const successorRequest = service.requestDataAccess(
    organization.id,
    {
      agreementId: successor.id,
      datasetScopes: ["proof record summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      purpose: "Request scoped access under the renewed successor agreement.",
      requestedAt: "2026-07-08T01:09:00.000Z",
    },
    "researcher_partner_renewal",
  );
  const successorPacket = service.createDataAccessAccountabilityPacket(
    successorRequest.id,
    { intendedAudience: "institutional agreement reviewer", generatedAt: "2026-07-08T01:10:00.000Z" },
    "verifier_partner_renewal",
  );
  assert.equal(successorPacket.counts.agreementSupersessionCount, 1);
  assert.deepEqual(successorPacket.lineageRoots.agreementSupersessionRoots, [supersession.supersessionRoot]);
  const stalePredecessorPacket = service.verifyDataAccessAccountabilityPacket(
    predecessorPacket.id,
    { expectedPacketRoot: predecessorPacket.packetRoot, verifiedAt: "2026-07-08T01:11:00.000Z" },
    "observer_partner_renewal",
  );
  assert.equal(stalePredecessorPacket.valid, false);
  assert.ok(stalePredecessorPacket.issues.includes("lineage_stale"));
  assert.throws(
    () =>
      service.supersedeDataSharingAgreement(
        successor.id,
        {
          transitionType: "supersession",
          successor: {
            datasetScopes: ["proof record summaries"],
            privacyTier: "confidential",
            permittedUses: ["research review"],
            expiresAt: "2028-01-01T00:00:00.000Z",
          },
          rationale: "Attempt to escalate privacy authority during agreement replacement.",
          evidenceEventRoots: ["c".repeat(64)],
          supersededAt: "2026-07-08T01:12:00.000Z",
        },
        "admin_partner_renewal",
      ),
    /cannot escalate predecessor privacy tier/,
  );
  const constrainedReplacement = service.supersedeDataSharingAgreement(
    successor.id,
    {
      transitionType: "supersession",
      successor: {
        datasetScopes: ["proof record summaries"],
        privacyTier: "restricted",
        permittedUses: ["research review"],
        expiresAt: "2028-01-01T00:00:00.000Z",
      },
      rationale: "Replace the renewed agreement with a narrower research-only scope.",
      evidenceEventRoots: ["d".repeat(64)],
      supersededAt: "2026-07-08T01:12:00.000Z",
    },
    "admin_partner_renewal",
  );
  assert.equal(constrainedReplacement.transitionType, "supersession");
  assert.equal(constrainedReplacement.predecessorAgreementId, successor.id);
  assert.equal(service.listDataSharingAgreementSupersessions(successor.id).length, 2);
  assert.equal(service.getStatus().supersededDataSharingAgreementCount, 2);
  assert.equal(service.getStatus().dataSharingAgreementSupersessionCount, 2);
});

test("CanopyProof partner service refuses unsupported public climate finance claims", () => {
  const service = new CanopyProofPartnerService();
  assert.throws(
    () =>
      service.registerOrganization(
        {
          ...organizationPayload("cp_org_partner_unsafe_001", "Guaranteed RWA Yield Coalition"),
          verificationCapabilities: ["guaranteed RWA yield promotion"],
        },
        "owner_partner_unsafe",
      ),
    /unsupported public claim/,
  );
});

test("CanopyProof partner API enforces RBAC while allowing observers to read approved partners", async () => {
  const denied = await app.request("/canopyproof/organizations", {
    method: "POST",
    headers: headers("observer", "observer_partner_denied"),
    body: JSON.stringify(organizationPayload("cp_org_partner_api_denied")),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/organizations", {
    method: "POST",
    headers: headers("admin", "admin_partner_api"),
    body: JSON.stringify(organizationPayload("cp_org_partner_api_001", "Great Green Wall University Lab")),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      name: string;
      accreditationStatus: string;
      verificationStatus: string;
      trustLevel: string;
      operatingRegions: string[];
      auditHistory: Array<{ entityType: string; actor: string }>;
    };
  }>(created);
  assert.equal(createdBody.data.id, "cp_org_partner_api_001");
  assert.equal(createdBody.data.accreditationStatus, "pending");
  assert.equal(createdBody.data.verificationStatus, "pending");
  assert.equal(createdBody.data.trustLevel, "unverified");
  assert.equal(createdBody.data.auditHistory[0]?.actor, "admin_partner_api");

  const deniedVerification = await app.request(`/canopyproof/organizations/${createdBody.data.id}/verification`, {
    method: "POST",
    headers: headers("community", "community_partner_denied"),
    body: JSON.stringify({
      verificationStatus: "verified",
      registrationNumber: "SN-UNIV-2026-001",
      documents: [{ documentType: "registration", documentHash: "d".repeat(64) }],
      rationale: "Community actors cannot verify institutional organizations.",
      reviewedAt: "2026-07-08T00:02:00.000Z",
    }),
  });
  assert.equal(deniedVerification.status, 403);

  const documentReview = await app.request(`/canopyproof/organizations/${createdBody.data.id}/verification`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      verificationStatus: "document_review",
      registrationNumber: "SN-UNIV-2026-001",
      documents: [
        {
          documentType: "registration",
          documentHash: "d".repeat(64),
          issuedBy: "University Registry",
          uploadedAt: "2026-07-08T00:02:00.000Z",
        },
      ],
      authorizedUsers: ["researcher_partner_api_001"],
      rationale: "Institutional registration package is ready for review.",
      reviewedAt: "2026-07-08T00:02:00.000Z",
    }),
  });
  assert.equal(documentReview.status, 202);
  const documentReviewBody = await json<{ ok: true; data: { verificationStatus: string; documents: unknown[]; trustLevel: string } }>(
    documentReview,
  );
  assert.equal(documentReviewBody.data.verificationStatus, "document_review");
  assert.equal(documentReviewBody.data.trustLevel, "basic");
  assert.equal(documentReviewBody.data.documents.length, 1);

  const verified = await app.request(`/canopyproof/organizations/${createdBody.data.id}/verification`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      verificationStatus: "verified",
      trustLevel: "institutional",
      rationale: "Institutional documents, jurisdiction, and authorized users were reviewed.",
      reviewedAt: "2026-07-08T00:03:00.000Z",
    }),
  });
  assert.equal(verified.status, 201);
  const verifiedBody = await json<{ ok: true; data: { verificationStatus: string; trustLevel: string; auditHistory: Array<{ entityType: string }> } }>(
    verified,
  );
  assert.equal(verifiedBody.data.verificationStatus, "verified");
  assert.equal(verifiedBody.data.trustLevel, "institutional");
  assert.equal(verifiedBody.data.auditHistory.at(-1)?.entityType, "organization_verification");

  const membershipResponse = await app.request(`/canopyproof/organizations/${createdBody.data.id}/memberships`, {
    method: "POST",
    headers: headers("admin", "admin_partner_api"),
    body: JSON.stringify({
      actorId: "researcher_partner_api_001",
      role: "researcher",
      conflictDisclosure: "No direct funding authority.",
      grantedAt: "2026-07-08T00:05:00.000Z",
    }),
  });
  assert.equal(membershipResponse.status, 201);
  const membershipBody = await json<{ ok: true; data: { id: string; role: string; status: string } }>(membershipResponse);
  assert.equal(membershipBody.data.role, "researcher");
  assert.equal(membershipBody.data.status, "active");

  const suspended = await app.request(`/canopyproof/organizations/${createdBody.data.id}/memberships/${membershipBody.data.id}`, {
    method: "PATCH",
    headers: headers("owner", "owner_partner_api"),
    body: JSON.stringify({
      status: "suspended",
      rationale: "Conflict disclosure requires annual refresh.",
      changedAt: "2026-07-08T00:06:00.000Z",
    }),
  });
  assert.equal(suspended.status, 200);
  const suspendedBody = await json<{ ok: true; data: { status: string } }>(suspended);
  assert.equal(suspendedBody.data.status, "suspended");

  const accreditation = await app.request(`/canopyproof/organizations/${createdBody.data.id}/accreditations`, {
    method: "POST",
    headers: headers("owner", "owner_partner_api"),
    body: JSON.stringify({
      status: "approved",
      scope: ["research review", "ESG report review"],
      rationale: "Approved for research review after partner due diligence.",
      evidenceHash: "b".repeat(64),
      decidedAt: "2026-07-08T00:10:00.000Z",
    }),
  });
  assert.equal(accreditation.status, 201);

  const agreement = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-sharing-agreements`, {
    method: "POST",
    headers: headers("admin", "admin_partner_api"),
    body: JSON.stringify({
      datasetScopes: ["proof record summaries", "TerraProof scene metadata"],
      privacyTier: "restricted",
      permittedUses: ["research review", "ESG report preparation"],
      expiresAt: "2027-07-08T00:00:00.000Z",
      createdAt: "2026-07-08T00:15:00.000Z",
    }),
  });
  assert.equal(agreement.status, 201);
  const agreementBody = await json<{ ok: true; data: { id: string; agreementHash: string; auditEvent: { entityType: string } } }>(agreement);
  assert.ok(agreementBody.data.agreementHash.length >= 64);
  assert.equal(agreementBody.data.auditEvent.entityType, "data_sharing_agreement");

  const agreementForRevocation = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-sharing-agreements`, {
    method: "POST",
    headers: headers("admin", "admin_partner_api"),
    body: JSON.stringify({
      datasetScopes: ["public partner profile summaries"],
      privacyTier: "public",
      permittedUses: ["research review"],
      expiresAt: "2027-07-08T00:00:00.000Z",
      createdAt: "2026-07-08T00:16:00.000Z",
    }),
  });
  assert.equal(agreementForRevocation.status, 201);
  const agreementForRevocationBody = await json<{ ok: true; data: { id: string } }>(agreementForRevocation);

  const deniedObserverRevocation = await app.request(`/canopyproof/data-sharing-agreements/${agreementForRevocationBody.data.id}/revocations`, {
    method: "POST",
    headers: headers("observer", "observer_partner_denied"),
    body: JSON.stringify({
      rationale: "Observer roles cannot revoke institutional data-sharing agreements.",
      evidenceEventRoots: ["a".repeat(64)],
      revokedAt: "2026-07-08T00:17:00.000Z",
    }),
  });
  assert.equal(deniedObserverRevocation.status, 403);

  const revocation = await app.request(`/canopyproof/data-sharing-agreements/${agreementForRevocationBody.data.id}/revocations`, {
    method: "POST",
    headers: headers("owner", "owner_partner_api"),
    body: JSON.stringify({
      rationale: "Revoke this narrow agreement after institutional governance review.",
      evidenceEventRoots: ["a".repeat(64)],
      revokedAt: "2026-07-08T00:17:00.000Z",
    }),
  });
  assert.equal(revocation.status, 202);
  const revocationBody = await json<{
    ok: true;
    data: {
      id: string;
      agreementId: string;
      safety: { futureAccessBlocked: boolean; futureDeliveryBlocked: boolean };
      auditEvent: { entityType: string; action: string };
    };
  }>(revocation);
  assert.equal(revocationBody.data.agreementId, agreementForRevocationBody.data.id);
  assert.equal(revocationBody.data.safety.futureAccessBlocked, true);
  assert.equal(revocationBody.data.safety.futureDeliveryBlocked, true);
  assert.equal(revocationBody.data.auditEvent.entityType, "data_sharing_agreement_revocation");
  assert.equal(revocationBody.data.auditEvent.action, "CHALLENGE");

  const revocationList = await app.request(`/canopyproof/data-sharing-agreements/${agreementForRevocationBody.data.id}/revocations`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(revocationList.status, 200);
  const revocationListBody = await json<{ ok: true; data: Array<{ id: string; agreementId: string }> }>(revocationList);
  assert.equal(revocationListBody.data[0]?.id, revocationBody.data.id);
  assert.equal(revocationListBody.data[0]?.agreementId, agreementForRevocationBody.data.id);

  const readableRevocation = await app.request(`/canopyproof/data-sharing-agreement-revocations/${revocationBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableRevocation.status, 200);

  const agreementForRenewal = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-sharing-agreements`, {
    method: "POST",
    headers: headers("admin", "admin_partner_api"),
    body: JSON.stringify({
      datasetScopes: ["institutional method summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      expiresAt: "2027-07-08T00:00:00.000Z",
      createdAt: "2026-07-08T00:18:00.000Z",
    }),
  });
  assert.equal(agreementForRenewal.status, 201);
  const agreementForRenewalBody = await json<{ ok: true; data: { id: string } }>(agreementForRenewal);
  const deniedObserverSupersession = await app.request(
    `/canopyproof/data-sharing-agreements/${agreementForRenewalBody.data.id}/supersessions`,
    {
      method: "POST",
      headers: headers("observer", "observer_partner_denied"),
      body: JSON.stringify({
        transitionType: "renewal",
        successor: {
          datasetScopes: ["institutional method summaries"],
          privacyTier: "restricted",
          permittedUses: ["research review"],
          expiresAt: "2028-07-08T00:00:00.000Z",
        },
        rationale: "Observer roles cannot renew institutional data-sharing agreements.",
        evidenceEventRoots: ["c".repeat(64)],
        supersededAt: "2026-07-08T00:19:00.000Z",
      }),
    },
  );
  assert.equal(deniedObserverSupersession.status, 403);
  const supersession = await app.request(`/canopyproof/data-sharing-agreements/${agreementForRenewalBody.data.id}/supersessions`, {
    method: "POST",
    headers: headers("owner", "owner_partner_api"),
    body: JSON.stringify({
      transitionType: "renewal",
      successor: {
        datasetScopes: ["institutional method summaries"],
        privacyTier: "restricted",
        permittedUses: ["research review"],
        expiresAt: "2028-07-08T00:00:00.000Z",
      },
      rationale: "Renew the least-privilege institutional method review agreement.",
      evidenceEventRoots: ["c".repeat(64)],
      supersededAt: "2026-07-08T00:19:00.000Z",
    }),
  });
  assert.equal(supersession.status, 201);
  const supersessionBody = await json<{
    ok: true;
    data: {
      id: string;
      predecessorAgreementId: string;
      successorAgreementId: string;
      transitionType: string;
      safety: { scopeExpansionBlocked: boolean; priorAgreementFutureAccessBlocked: boolean };
      auditEvent: { entityType: string };
    };
  }>(supersession);
  assert.equal(supersessionBody.data.predecessorAgreementId, agreementForRenewalBody.data.id);
  assert.equal(supersessionBody.data.transitionType, "renewal");
  assert.equal(supersessionBody.data.safety.scopeExpansionBlocked, true);
  assert.equal(supersessionBody.data.safety.priorAgreementFutureAccessBlocked, true);
  assert.equal(supersessionBody.data.auditEvent.entityType, "data_sharing_agreement_supersession");
  const supersessionList = await app.request(
    `/canopyproof/data-sharing-agreements/${agreementForRenewalBody.data.id}/supersessions`,
    { headers: headers("observer", "observer_partner_reader") },
  );
  assert.equal(supersessionList.status, 200);
  const supersessionListBody = await json<{ ok: true; data: Array<{ id: string; successorAgreementId: string }> }>(supersessionList);
  assert.equal(supersessionListBody.data[0]?.id, supersessionBody.data.id);
  assert.equal(supersessionListBody.data[0]?.successorAgreementId, supersessionBody.data.successorAgreementId);
  const readableSupersession = await app.request(
    `/canopyproof/data-sharing-agreement-supersessions/${supersessionBody.data.id}`,
    { headers: headers("observer", "observer_partner_reader") },
  );
  assert.equal(readableSupersession.status, 200);
  const supersededAgreementAccess = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-access-requests`, {
    method: "POST",
    headers: headers("researcher", "researcher_partner_api_001"),
    body: JSON.stringify({
      agreementId: agreementForRenewalBody.data.id,
      datasetScopes: ["institutional method summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      purpose: "Attempt access after the predecessor agreement was superseded.",
      requestedAt: "2026-07-08T00:19:30.000Z",
    }),
  });
  assert.equal(supersededAgreementAccess.status, 400);
  const supersededAgreementAccessBody = await json<{ ok: false; error: string }>(supersededAgreementAccess);
  assert.match(supersededAgreementAccessBody.error, /superseded data-sharing agreement/);

  const revokedAgreementAccess = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-access-requests`, {
    method: "POST",
    headers: headers("researcher", "researcher_partner_api_001"),
    body: JSON.stringify({
      agreementId: agreementForRevocationBody.data.id,
      datasetScopes: ["public partner profile summaries"],
      privacyTier: "public",
      permittedUses: ["research review"],
      purpose: "Attempt access after the data-sharing agreement was revoked.",
      requestedAt: "2026-07-08T00:17:30.000Z",
    }),
  });
  assert.equal(revokedAgreementAccess.status, 400);
  const revokedAgreementAccessBody = await json<{ ok: false; error: string }>(revokedAgreementAccess);
  assert.match(revokedAgreementAccessBody.error, /revoked data-sharing agreement/);

  const deniedDataAccess = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-access-requests`, {
    method: "POST",
    headers: headers("community", "community_partner_denied"),
    body: JSON.stringify({
      agreementId: agreementBody.data.id,
      datasetScopes: ["proof record summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      purpose: "Community role cannot request institution-scoped partner data access.",
      requestedAt: "2026-07-08T00:16:00.000Z",
    }),
  });
  assert.equal(deniedDataAccess.status, 403);

  const dataAccess = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-access-requests`, {
    method: "POST",
    headers: headers("researcher", "researcher_partner_api_001"),
    body: JSON.stringify({
      agreementId: agreementBody.data.id,
      datasetScopes: ["proof record summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      purpose: "Review proof record summaries for institutional research QA.",
      requestedAt: "2026-07-08T00:20:00.000Z",
      expiresAt: "2026-09-08T00:00:00.000Z",
    }),
  });
  assert.equal(dataAccess.status, 202);
  const dataAccessBody = await json<{
    ok: true;
    data: { id: string; status: string; safety: { humanDecisionRequired: boolean }; auditEvent: { entityType: string } };
  }>(dataAccess);
  assert.equal(dataAccessBody.data.status, "pending");
  assert.equal(dataAccessBody.data.safety.humanDecisionRequired, true);
  assert.equal(dataAccessBody.data.auditEvent.entityType, "data_access_request");

  const deniedSelfDecision = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}`, {
    method: "PATCH",
    headers: headers("researcher", "researcher_partner_api_001"),
    body: JSON.stringify({
      status: "approved",
      rationale: "Researcher actors cannot approve their own partner data access request.",
      decidedAt: "2026-07-08T00:21:00.000Z",
    }),
  });
  assert.equal(deniedSelfDecision.status, 403);

  const approvedDataAccess = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}`, {
    method: "PATCH",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      status: "approved",
      rationale: "Approved for the scoped research review under the active data-sharing agreement.",
      decidedAt: "2026-07-08T00:22:00.000Z",
    }),
  });
  assert.equal(approvedDataAccess.status, 200);
  const approvedDataAccessBody = await json<{ ok: true; data: { status: string; decisionBy: string } }>(approvedDataAccess);
  assert.equal(approvedDataAccessBody.data.status, "approved");
  assert.equal(approvedDataAccessBody.data.decisionBy, "verifier_partner_api");

  const exportManifest = await app.request("/canopyproof/audit/export-manifests", {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      id: "cp_audit_export_manifest_partner_delivery_001",
      kind: "institutional_audit_packet",
      scope: "organization",
      subjectId: createdBody.data.id,
      requesterOrganizationId: createdBody.data.id,
      purpose: "Hash-only data room package for the approved partner access request.",
      classification: "restricted",
      entries: [
        {
          resourceType: "public_record",
          resourceId: "cp_public_record_partner_delivery_001",
          contentHash: "9".repeat(64),
          eventRoot: "8".repeat(64),
          classification: "restricted",
          redactionPolicy: "personal_data_redacted",
          included: true,
          reason: "Proof summary included as redacted hash-only institutional review material.",
        },
      ],
      createdAt: "2026-07-08T00:23:00.000Z",
    }),
  });
  assert.equal(exportManifest.status, 201);

  const deniedObserverDelivery = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/deliveries`, {
    method: "POST",
    headers: headers("observer", "observer_partner_denied"),
    body: JSON.stringify({
      manifestId: "cp_audit_export_manifest_partner_delivery_001",
      channel: "audit_export_manifest",
      recipientActorId: "researcher_partner_api_001",
      purpose: "Observer roles cannot deliver governed data access packages.",
      deliveredAt: "2026-07-08T00:24:00.000Z",
    }),
  });
  assert.equal(deniedObserverDelivery.status, 403);

  const delivery = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/deliveries`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      manifestId: "cp_audit_export_manifest_partner_delivery_001",
      channel: "audit_export_manifest",
      recipientActorId: "researcher_partner_api_001",
      purpose: "Deliver the approved hash-only partner data room manifest.",
      deliveredAt: "2026-07-08T00:25:00.000Z",
    }),
  });
  assert.equal(delivery.status, 201);
  const deliveryBody = await json<{
    ok: true;
    data: { id: string; manifestId: string; safety: { rawDataNotEmbedded: boolean }; auditEvent: { entityType: string } };
  }>(delivery);
  assert.equal(deliveryBody.data.manifestId, "cp_audit_export_manifest_partner_delivery_001");
  assert.equal(deliveryBody.data.safety.rawDataNotEmbedded, true);
  assert.equal(deliveryBody.data.auditEvent.entityType, "data_access_delivery_receipt");

  const deniedObserverUse = await app.request(`/canopyproof/data-access-deliveries/${deliveryBody.data.id}/use-attestations`, {
    method: "POST",
    headers: headers("observer", "observer_partner_denied"),
    body: JSON.stringify({
      usageState: "within_scope",
      useCase: "Observer roles cannot attest governed data use.",
      outputHashes: ["7".repeat(64)],
      attestedAt: "2026-07-08T00:26:00.000Z",
    }),
  });
  assert.equal(deniedObserverUse.status, 403);

  const useAttestation = await app.request(`/canopyproof/data-access-deliveries/${deliveryBody.data.id}/use-attestations`, {
    method: "POST",
    headers: headers("researcher", "researcher_partner_api_001"),
    body: JSON.stringify({
      usageState: "within_scope",
      useCase: "Researcher used the redacted proof summary for scoped QA.",
      outputHashes: ["7".repeat(64)],
      limitations: ["No raw evidence or personal contact data was exported."],
      attestedAt: "2026-07-08T00:26:00.000Z",
    }),
  });
  assert.equal(useAttestation.status, 201);
  const useAttestationBody = await json<{
    ok: true;
    data: { id: string; usageState: string; safety: { outputHashOnly: boolean }; auditEvent: { entityType: string } };
  }>(useAttestation);
  assert.equal(useAttestationBody.data.usageState, "within_scope");
  assert.equal(useAttestationBody.data.safety.outputHashOnly, true);
  assert.equal(useAttestationBody.data.auditEvent.entityType, "data_use_attestation");

  const misuseChallenge = await app.request(`/canopyproof/data-access-deliveries/${deliveryBody.data.id}/use-attestations`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      usageState: "misuse_challenged",
      useCase: "Verifier challenged possible redistribution outside the approved use.",
      evidenceEventRoots: ["6".repeat(64)],
      limitations: ["Challenge requires independent review before any enforcement action."],
      attestedAt: "2026-07-08T00:27:00.000Z",
    }),
  });
  assert.equal(misuseChallenge.status, 202);
  const misuseChallengeBody = await json<{
    ok: true;
    data: { id: string; usageState: string; auditEvent: { entityType: string } };
  }>(misuseChallenge);
  assert.equal(misuseChallengeBody.data.usageState, "misuse_challenged");
  assert.equal(misuseChallengeBody.data.auditEvent.entityType, "data_use_attestation");

  const deniedObserverEnforcement = await app.request(`/canopyproof/data-use-attestations/${misuseChallengeBody.data.id}/enforcement-cases`, {
    method: "POST",
    headers: headers("observer", "observer_partner_denied"),
    body: JSON.stringify({
      caseState: "under_review",
      enforcementAction: "notify_partner",
      rationale: "Observer roles cannot open data-use enforcement cases.",
      evidenceEventRoots: ["5".repeat(64)],
      reviewedAt: "2026-07-08T00:28:00.000Z",
    }),
  });
  assert.equal(deniedObserverEnforcement.status, 403);

  const enforcementCase = await app.request(`/canopyproof/data-use-attestations/${misuseChallengeBody.data.id}/enforcement-cases`, {
    method: "POST",
    headers: headers("admin", "admin_partner_api"),
    body: JSON.stringify({
      caseState: "remediation_required",
      enforcementAction: "require_remediation",
      rationale: "Require remediation before any additional data room access is considered.",
      evidenceEventRoots: ["5".repeat(64)],
      reviewedAt: "2026-07-08T00:29:00.000Z",
    }),
  });
  assert.equal(enforcementCase.status, 202);
  const enforcementCaseBody = await json<{
    ok: true;
    data: {
      id: string;
      attestationId: string;
      caseState: string;
      enforcementAction: string;
      safety: { independentReviewerRequired: boolean; accessMutationRequiresSeparateApproval: boolean };
      auditEvent: { entityType: string };
    };
  }>(enforcementCase);
  assert.equal(enforcementCaseBody.data.attestationId, misuseChallengeBody.data.id);
  assert.equal(enforcementCaseBody.data.caseState, "remediation_required");
  assert.equal(enforcementCaseBody.data.enforcementAction, "require_remediation");
  assert.equal(enforcementCaseBody.data.safety.independentReviewerRequired, true);
  assert.equal(enforcementCaseBody.data.safety.accessMutationRequiresSeparateApproval, true);
  assert.equal(enforcementCaseBody.data.auditEvent.entityType, "data_use_enforcement_case");

  const deniedVerifierRestriction = await app.request(`/canopyproof/data-use-enforcement-cases/${enforcementCaseBody.data.id}/access-restrictions`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      restrictionState: "remediation_hold",
      rationale: "Verifier roles cannot separately approve access restrictions.",
      evidenceEventRoots: ["4".repeat(64)],
      decidedAt: "2026-07-08T00:30:00.000Z",
    }),
  });
  assert.equal(deniedVerifierRestriction.status, 403);

  const restriction = await app.request(`/canopyproof/data-use-enforcement-cases/${enforcementCaseBody.data.id}/access-restrictions`, {
    method: "POST",
    headers: headers("owner", "owner_partner_api"),
    body: JSON.stringify({
      restrictionState: "remediation_hold",
      rationale: "Pause future deliveries until remediation evidence is reviewed.",
      evidenceEventRoots: ["4".repeat(64)],
      decidedAt: "2026-07-08T00:30:00.000Z",
    }),
  });
  assert.equal(restriction.status, 202);
  const restrictionBody = await json<{
    ok: true;
    data: {
      id: string;
      requestId: string;
      enforcementCaseId: string;
      restrictionState: string;
      safety: { separateApprovalPath: boolean; deliveryBlockingEnforced: boolean };
      auditEvent: { entityType: string };
    };
  }>(restriction);
  assert.equal(restrictionBody.data.requestId, dataAccessBody.data.id);
  assert.equal(restrictionBody.data.enforcementCaseId, enforcementCaseBody.data.id);
  assert.equal(restrictionBody.data.restrictionState, "remediation_hold");
  assert.equal(restrictionBody.data.safety.separateApprovalPath, true);
  assert.equal(restrictionBody.data.safety.deliveryBlockingEnforced, true);
  assert.equal(restrictionBody.data.auditEvent.entityType, "data_access_restriction");

  const deniedObserverPacket = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/accountability-packets`, {
    method: "POST",
    headers: headers("observer", "observer_partner_denied"),
    body: JSON.stringify({
      intendedAudience: "Observer roles cannot generate accountability packets.",
      generatedAt: "2026-07-08T00:31:00.000Z",
    }),
  });
  assert.equal(deniedObserverPacket.status, 403);

  const accountabilityPacket = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/accountability-packets`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_api"),
    body: JSON.stringify({
      intendedAudience: "institutional observer audit packet",
      generatedAt: "2026-07-08T00:31:00.000Z",
    }),
  });
  assert.equal(accountabilityPacket.status, 201);
  const accountabilityPacketBody = await json<{
    ok: true;
    data: {
      id: string;
      requestId: string;
      counts: {
        agreementRevocationCount: number;
        agreementSupersessionCount: number;
        deliveryReceiptCount: number;
        dataUseAttestationCount: number;
        enforcementCaseCount: number;
        activeRestrictionCount: number;
      };
      lineageRoots: {
        accessRoot: string;
        agreementRevocationRoots: string[];
        agreementSupersessionRoots: string[];
        deliveryRoots: string[];
        usageRoots: string[];
        enforcementRoots: string[];
        restrictionRoots: string[];
      };
      safety: { hashOnlyLineage: boolean; observerReadable: boolean };
      auditEvent: { entityType: string };
    };
  }>(accountabilityPacket);
  assert.equal(accountabilityPacketBody.data.requestId, dataAccessBody.data.id);
  assert.equal(accountabilityPacketBody.data.counts.agreementRevocationCount, 0);
  assert.equal(accountabilityPacketBody.data.counts.agreementSupersessionCount, 0);
  assert.equal(accountabilityPacketBody.data.counts.deliveryReceiptCount, 1);
  assert.equal(accountabilityPacketBody.data.counts.dataUseAttestationCount, 2);
  assert.equal(accountabilityPacketBody.data.counts.enforcementCaseCount, 1);
  assert.equal(accountabilityPacketBody.data.counts.activeRestrictionCount, 1);
  assert.match(accountabilityPacketBody.data.lineageRoots.accessRoot, /^[a-f0-9]{64}$/);
  assert.equal(accountabilityPacketBody.data.lineageRoots.agreementRevocationRoots.length, 0);
  assert.equal(accountabilityPacketBody.data.lineageRoots.agreementSupersessionRoots.length, 0);
  assert.equal(accountabilityPacketBody.data.lineageRoots.deliveryRoots.length, 1);
  assert.equal(accountabilityPacketBody.data.lineageRoots.usageRoots.length, 2);
  assert.equal(accountabilityPacketBody.data.lineageRoots.enforcementRoots.length, 1);
  assert.equal(accountabilityPacketBody.data.lineageRoots.restrictionRoots.length, 1);
  assert.equal(accountabilityPacketBody.data.safety.hashOnlyLineage, true);
  assert.equal(accountabilityPacketBody.data.safety.observerReadable, true);
  assert.equal(accountabilityPacketBody.data.auditEvent.entityType, "data_access_accountability_packet");

  const cleanVerification = await app.request(`/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/verify`, {
    method: "POST",
    headers: headers("observer", "observer_partner_reader"),
    body: JSON.stringify({
      expectedPacketRoot: readablePacketsRoot(accountabilityPacketBody.data.lineageRoots.accessRoot, accountabilityPacketBody.data.id),
      verifiedAt: "2026-07-08T00:32:00.000Z",
    }),
  });
  assert.equal(cleanVerification.status, 202);
  const rootMismatchVerificationBody = await json<{ ok: true; data: { id: string; valid: boolean; issues: string[]; auditEvent: { action: string } } }>(
    cleanVerification,
  );
  assert.equal(rootMismatchVerificationBody.data.valid, false);
  assert.ok(rootMismatchVerificationBody.data.issues.includes("expected_root_mismatch"));
  assert.equal(rootMismatchVerificationBody.data.auditEvent.action, "CHALLENGE");

  const cleanReplay = await app.request(`/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/verify`, {
    method: "POST",
    headers: headers("observer", "observer_partner_reader"),
    body: JSON.stringify({
      verifiedAt: "2026-07-08T00:33:00.000Z",
    }),
  });
  assert.equal(cleanReplay.status, 200);
  const cleanReplayBody = await json<{ ok: true; data: { id: string; valid: boolean; issues: string[]; auditEvent: { entityType: string } } }>(
    cleanReplay,
  );
  assert.equal(cleanReplayBody.data.valid, true);
  assert.deepEqual(cleanReplayBody.data.issues, []);
  assert.equal(cleanReplayBody.data.auditEvent.entityType, "data_access_accountability_verification");

  const deniedObserverDisclosure = await app.request(
    `/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/disclosures`,
    {
      method: "POST",
      headers: headers("observer", "observer_partner_denied"),
      body: JSON.stringify({ verificationId: cleanReplayBody.data.id, publishedAt: "2026-07-08T00:33:30.000Z" }),
    },
  );
  assert.equal(deniedObserverDisclosure.status, 403);
  const invalidVerificationDisclosure = await app.request(
    `/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/disclosures`,
    {
      method: "POST",
      headers: headers("owner", "owner_partner_api"),
      body: JSON.stringify({ verificationId: rootMismatchVerificationBody.data.id, publishedAt: "2026-07-08T00:33:30.000Z" }),
    },
  );
  assert.equal(invalidVerificationDisclosure.status, 400);
  const invalidVerificationDisclosureBody = await json<{ ok: false; error: string }>(invalidVerificationDisclosure);
  assert.match(invalidVerificationDisclosureBody.error, /requires a valid packet replay verification/);
  const disclosure = await app.request(
    `/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/disclosures`,
    {
      method: "POST",
      headers: headers("owner", "owner_partner_api"),
      body: JSON.stringify({ verificationId: cleanReplayBody.data.id, publishedAt: "2026-07-08T00:33:30.000Z" }),
    },
  );
  assert.equal(disclosure.status, 201);
  const disclosureBody = await json<{
    ok: true;
    data: {
      id: string;
      packetId: string;
      currentState: string;
      currentIssues: string[];
      disclosureRoot: string;
      safety: { hashOnly: boolean; observerDiscoverable: boolean };
      auditEvent: { entityType: string };
    };
  }>(disclosure);
  assert.equal(disclosureBody.data.packetId, accountabilityPacketBody.data.id);
  assert.equal(disclosureBody.data.currentState, "current");
  assert.deepEqual(disclosureBody.data.currentIssues, []);
  assert.match(disclosureBody.data.disclosureRoot, /^[a-f0-9]{64}$/);
  assert.equal(disclosureBody.data.safety.hashOnly, true);
  assert.equal(disclosureBody.data.safety.observerDiscoverable, true);
  assert.equal(disclosureBody.data.auditEvent.entityType, "data_access_accountability_disclosure");

  const publicDisclosureStatus = await app.request("/canopyproof/public-accountability/data-access-disclosures/status");
  assert.equal(publicDisclosureStatus.status, 200);
  const publicDisclosureStatusBody = await json<{
    ok: true;
    data: { disclosureCount: number; currentDisclosureCount: number; staleDisclosureCount: number; disclosureRoot: string };
  }>(publicDisclosureStatus);
  assert.ok(publicDisclosureStatusBody.data.disclosureCount >= 1);
  assert.ok(publicDisclosureStatusBody.data.currentDisclosureCount >= 1);
  assert.match(publicDisclosureStatusBody.data.disclosureRoot, /^[a-f0-9]{64}$/);
  const publicDisclosureIndex = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures?organizationId=${createdBody.data.id}&state=current&limit=1`,
  );
  assert.equal(publicDisclosureIndex.status, 200);
  const publicDisclosureIndexBody = await json<{
    ok: true;
    data: { totalCount: number; limit: number; items: Array<{ id: string; currentState: string }>; indexRoot: string };
  }>(publicDisclosureIndex);
  assert.equal(publicDisclosureIndexBody.data.totalCount, 1);
  assert.equal(publicDisclosureIndexBody.data.limit, 1);
  assert.equal(publicDisclosureIndexBody.data.items[0]?.id, disclosureBody.data.id);
  assert.equal(publicDisclosureIndexBody.data.items[0]?.currentState, "current");
  assert.match(publicDisclosureIndexBody.data.indexRoot, /^[a-f0-9]{64}$/);
  const invalidDisclosureState = await app.request("/canopyproof/public-accountability/data-access-disclosures?state=certified");
  assert.equal(invalidDisclosureState.status, 400);
  const invalidDisclosureLimit = await app.request("/canopyproof/public-accountability/data-access-disclosures?limit=101");
  assert.equal(invalidDisclosureLimit.status, 400);
  const unauthenticatedChallenge = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures/${disclosureBody.data.id}/challenges`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "incorrect_metadata",
        statement: "Unauthenticated actors cannot append public disclosure challenges.",
        evidenceEventRoots: ["5".repeat(64)],
        challengedAt: "2026-07-08T00:33:35.000Z",
      }),
    },
  );
  assert.equal(unauthenticatedChallenge.status, 401);
  const disclosureChallenge = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures/${disclosureBody.data.id}/challenges`,
    {
      method: "POST",
      headers: headers("community", "community_partner_disclosure_challenger"),
      body: JSON.stringify({
        reason: "incorrect_metadata",
        statement: "The public packet needs a replacement after newly reported use-lineage metadata is appended.",
        evidenceEventRoots: ["5".repeat(64)],
        challengedAt: "2026-07-08T00:33:35.000Z",
      }),
    },
  );
  assert.equal(disclosureChallenge.status, 202);
  const disclosureChallengeBody = await json<{
    ok: true;
    data: { id: string; disclosureId: string; reason: string; challengeRoot: string; auditEvent: { entityType: string } };
  }>(disclosureChallenge);
  assert.equal(disclosureChallengeBody.data.disclosureId, disclosureBody.data.id);
  assert.equal(disclosureChallengeBody.data.reason, "incorrect_metadata");
  assert.match(disclosureChallengeBody.data.challengeRoot, /^[a-f0-9]{64}$/);
  assert.equal(disclosureChallengeBody.data.auditEvent.entityType, "data_access_accountability_disclosure_challenge");
  const publicChallenges = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures/${disclosureBody.data.id}/challenges`,
  );
  assert.equal(publicChallenges.status, 200);
  const publicChallengesBody = await json<{ ok: true; data: Array<{ id: string }> }>(publicChallenges);
  assert.equal(publicChallengesBody.data[0]?.id, disclosureChallengeBody.data.id);
  const deniedCommunityResolution = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-challenges/${disclosureChallengeBody.data.id}/resolutions`,
    {
      method: "POST",
      headers: headers("community", "community_partner_disclosure_challenger"),
      body: JSON.stringify({
        decision: "dismissed",
        remedialAction: "none",
        rationale: "Community challengers cannot resolve their own disclosure challenge.",
        evidenceEventRoots: ["6".repeat(64)],
        reviewedAt: "2026-07-08T00:33:40.000Z",
      }),
    },
  );
  assert.equal(deniedCommunityResolution.status, 403);
  const correctionResolution = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-challenges/${disclosureChallengeBody.data.id}/resolutions`,
    {
      method: "POST",
      headers: headers("verifier", "verifier_partner_api"),
      body: JSON.stringify({
        decision: "upheld",
        remedialAction: "publish_correction",
        rationale: "Independent review requires a replacement packet after the additional use-lineage event is recorded.",
        evidenceEventRoots: ["6".repeat(64)],
        reviewedAt: "2026-07-08T00:33:40.000Z",
      }),
    },
  );
  assert.equal(correctionResolution.status, 200);
  const correctionResolutionBody = await json<{
    ok: true;
    data: { id: string; decision: string; remedialAction: string; resolutionRoot: string; auditEvent: { entityType: string } };
  }>(correctionResolution);
  assert.equal(correctionResolutionBody.data.decision, "upheld");
  assert.equal(correctionResolutionBody.data.remedialAction, "publish_correction");
  assert.match(correctionResolutionBody.data.resolutionRoot, /^[a-f0-9]{64}$/);
  assert.equal(correctionResolutionBody.data.auditEvent.entityType, "data_access_accountability_disclosure_resolution");
  const publicResolutions = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-challenges/${disclosureChallengeBody.data.id}/resolutions`,
  );
  assert.equal(publicResolutions.status, 200);
  const publicResolutionsBody = await json<{ ok: true; data: Array<{ id: string }> }>(publicResolutions);
  assert.equal(publicResolutionsBody.data[0]?.id, correctionResolutionBody.data.id);
  const publicResolution = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-resolutions/${correctionResolutionBody.data.id}`,
  );
  assert.equal(publicResolution.status, 200);
  const publicResolutionBody = await json<{ ok: true; data: { resolutionRoot: string } }>(publicResolution);
  assert.equal(publicResolutionBody.data.resolutionRoot, correctionResolutionBody.data.resolutionRoot);

  const lateNoUse = await app.request(`/canopyproof/data-access-deliveries/${deliveryBody.data.id}/use-attestations`, {
    method: "POST",
    headers: headers("researcher", "researcher_partner_api_001"),
    body: JSON.stringify({
      usageState: "no_use",
      useCase: "Researcher later confirmed no additional use after restriction.",
      limitations: ["No additional output hash exists because no further use occurred."],
      attestedAt: "2026-07-08T00:34:00.000Z",
    }),
  });
  assert.equal(lateNoUse.status, 201);

  const staleReplay = await app.request(`/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/verify`, {
    method: "POST",
    headers: headers("observer", "observer_partner_reader"),
    body: JSON.stringify({
      verifiedAt: "2026-07-08T00:35:00.000Z",
    }),
  });
  assert.equal(staleReplay.status, 202);
  const staleReplayBody = await json<{ ok: true; data: { valid: boolean; issues: string[]; auditEvent: { action: string } } }>(staleReplay);
  assert.equal(staleReplayBody.data.valid, false);
  assert.ok(staleReplayBody.data.issues.includes("lineage_stale"));
  assert.equal(staleReplayBody.data.auditEvent.action, "CHALLENGE");
  const publicStaleDisclosure = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures/${disclosureBody.data.id}`,
  );
  assert.equal(publicStaleDisclosure.status, 200);
  const publicStaleDisclosureBody = await json<{
    ok: true;
    data: { currentState: string; currentIssues: string[]; governanceState: string };
  }>(publicStaleDisclosure);
  assert.equal(publicStaleDisclosureBody.data.currentState, "stale");
  assert.ok(publicStaleDisclosureBody.data.currentIssues.includes("lineage_stale"));
  assert.equal(publicStaleDisclosureBody.data.governanceState, "correction_required");
  const staleDisclosureIndex = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures?organizationId=${createdBody.data.id}&state=stale&limit=100`,
  );
  assert.equal(staleDisclosureIndex.status, 200);
  const staleDisclosureIndexBody = await json<{ ok: true; data: { items: Array<{ id: string }> } }>(staleDisclosureIndex);
  assert.ok(staleDisclosureIndexBody.data.items.some((item) => item.id === disclosureBody.data.id));

  const replacementPacket = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/accountability-packets`, {
    method: "POST",
    headers: headers("verifier", "verifier_partner_replacement"),
    body: JSON.stringify({
      intendedAudience: "replacement institutional observer audit packet",
      generatedAt: "2026-07-08T00:36:00.000Z",
    }),
  });
  assert.equal(replacementPacket.status, 201);
  const replacementPacketBody = await json<{ ok: true; data: { id: string } }>(replacementPacket);
  const replacementVerification = await app.request(
    `/canopyproof/data-access-accountability-packets/${replacementPacketBody.data.id}/verify`,
    {
      method: "POST",
      headers: headers("observer", "observer_partner_replacement"),
      body: JSON.stringify({ verifiedAt: "2026-07-08T00:36:10.000Z" }),
    },
  );
  assert.equal(replacementVerification.status, 200);
  const replacementVerificationBody = await json<{ ok: true; data: { id: string; valid: boolean } }>(replacementVerification);
  assert.equal(replacementVerificationBody.data.valid, true);
  const replacementDisclosure = await app.request(
    `/canopyproof/data-access-accountability-packets/${replacementPacketBody.data.id}/disclosures`,
    {
      method: "POST",
      headers: headers("admin", "admin_partner_api"),
      body: JSON.stringify({
        verificationId: replacementVerificationBody.data.id,
        publishedAt: "2026-07-08T00:36:20.000Z",
      }),
    },
  );
  assert.equal(replacementDisclosure.status, 201);
  const replacementDisclosureBody = await json<{ ok: true; data: { id: string; currentState: string; governanceState: string } }>(
    replacementDisclosure,
  );
  assert.equal(replacementDisclosureBody.data.currentState, "current");
  assert.equal(replacementDisclosureBody.data.governanceState, "unchallenged");
  const mismatchedNotice = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-resolutions/${correctionResolutionBody.data.id}/notices`,
    {
      method: "POST",
      headers: headers("admin", "admin_partner_api"),
      body: JSON.stringify({
        noticeType: "withdrawal",
        statement: "A withdrawal notice cannot satisfy a correction-required resolution.",
        evidenceEventRoots: ["7".repeat(64)],
        publishedAt: "2026-07-08T00:36:25.000Z",
      }),
    },
  );
  assert.equal(mismatchedNotice.status, 400);
  const correctionNotice = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-resolutions/${correctionResolutionBody.data.id}/notices`,
    {
      method: "POST",
      headers: headers("admin", "admin_partner_api"),
      body: JSON.stringify({
        noticeType: "correction",
        replacementDisclosureId: replacementDisclosureBody.data.id,
        statement: "The original disclosure remains public but is corrected by the linked current replacement disclosure.",
        evidenceEventRoots: ["7".repeat(64)],
        publishedAt: "2026-07-08T00:36:30.000Z",
      }),
    },
  );
  assert.equal(correctionNotice.status, 201);
  const correctionNoticeBody = await json<{
    ok: true;
    data: { id: string; noticeType: string; replacementDisclosureId: string; noticeRoot: string; auditEvent: { entityType: string } };
  }>(correctionNotice);
  assert.equal(correctionNoticeBody.data.noticeType, "correction");
  assert.equal(correctionNoticeBody.data.replacementDisclosureId, replacementDisclosureBody.data.id);
  assert.match(correctionNoticeBody.data.noticeRoot, /^[a-f0-9]{64}$/);
  assert.equal(correctionNoticeBody.data.auditEvent.entityType, "data_access_accountability_disclosure_notice");
  const correctedDisclosure = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures/${disclosureBody.data.id}`,
  );
  assert.equal(correctedDisclosure.status, 200);
  const correctedDisclosureBody = await json<{
    ok: true;
    data: { governanceState: string; challengeCount: number; openChallengeCount: number; replacementDisclosureIds: string[] };
  }>(correctedDisclosure);
  assert.equal(correctedDisclosureBody.data.governanceState, "corrected");
  assert.equal(correctedDisclosureBody.data.challengeCount, 1);
  assert.equal(correctedDisclosureBody.data.openChallengeCount, 0);
  assert.deepEqual(correctedDisclosureBody.data.replacementDisclosureIds, [replacementDisclosureBody.data.id]);
  const publicNotices = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures/${disclosureBody.data.id}/notices`,
  );
  assert.equal(publicNotices.status, 200);
  const publicNoticesBody = await json<{ ok: true; data: Array<{ id: string }> }>(publicNotices);
  assert.equal(publicNoticesBody.data[0]?.id, correctionNoticeBody.data.id);
  const publicNotice = await app.request(
    `/canopyproof/public-accountability/data-access-disclosure-notices/${correctionNoticeBody.data.id}`,
  );
  assert.equal(publicNotice.status, 200);
  const publicNoticeBody = await json<{ ok: true; data: { id: string; noticeRoot: string } }>(publicNotice);
  assert.equal(publicNoticeBody.data.id, correctionNoticeBody.data.id);
  assert.equal(publicNoticeBody.data.noticeRoot, correctionNoticeBody.data.noticeRoot);
  const correctedDisclosureIndex = await app.request(
    `/canopyproof/public-accountability/data-access-disclosures?organizationId=${createdBody.data.id}&governanceState=corrected&limit=100`,
  );
  assert.equal(correctedDisclosureIndex.status, 200);
  const correctedDisclosureIndexBody = await json<{ ok: true; data: { items: Array<{ id: string }> } }>(correctedDisclosureIndex);
  assert.ok(correctedDisclosureIndexBody.data.items.some((item) => item.id === disclosureBody.data.id));

  const partners = await app.request("/canopyproof/partners", {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(partners.status, 200);
  const partnersBody = await json<{ ok: true; data: Array<{ id: string; accreditationStatus: string }> }>(partners);
  assert.ok(partnersBody.data.some((partner) => partner.id === createdBody.data.id && partner.accreditationStatus === "approved"));

  const readableAgreements = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-sharing-agreements`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableAgreements.status, 200);
  const readableAgreementsBody = await json<{
    ok: true;
    data: Array<{
      id: string;
      privacyTier: string;
      permittedUses: string[];
      revoked: boolean;
      superseded: boolean;
      supersededByAgreementId?: string;
      supersedesAgreementId?: string;
    }>;
  }>(readableAgreements);
  const readablePrimaryAgreement = readableAgreementsBody.data.find((readableAgreement) => readableAgreement.id === agreementBody.data.id);
  const readableRevokedAgreement = readableAgreementsBody.data.find((readableAgreement) => readableAgreement.id === agreementForRevocationBody.data.id);
  const readableSupersededAgreement = readableAgreementsBody.data.find(
    (readableAgreement) => readableAgreement.id === agreementForRenewalBody.data.id,
  );
  const readableSuccessorAgreement = readableAgreementsBody.data.find(
    (readableAgreement) => readableAgreement.id === supersessionBody.data.successorAgreementId,
  );
  assert.equal(readablePrimaryAgreement?.privacyTier, "restricted");
  assert.ok(readablePrimaryAgreement?.permittedUses.includes("ESG report preparation"));
  assert.equal(readableRevokedAgreement?.revoked, true);
  assert.equal(readableSupersededAgreement?.superseded, true);
  assert.equal(readableSupersededAgreement?.supersededByAgreementId, supersessionBody.data.successorAgreementId);
  assert.equal(readableSuccessorAgreement?.supersedesAgreementId, agreementForRenewalBody.data.id);

  const readableAccessRequests = await app.request(`/canopyproof/organizations/${createdBody.data.id}/data-access-requests`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableAccessRequests.status, 200);
  const readableAccessRequestsBody = await json<{ ok: true; data: Array<{ status: string; privacyTier: string }> }>(readableAccessRequests);
  assert.equal(readableAccessRequestsBody.data[0]?.status, "approved");
  assert.equal(readableAccessRequestsBody.data[0]?.privacyTier, "restricted");

  const readableAccessRequest = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableAccessRequest.status, 200);
  const readableAccessRequestBody = await json<{ ok: true; data: { status: string; requestedBy: string } }>(readableAccessRequest);
  assert.equal(readableAccessRequestBody.data.status, "approved");
  assert.equal(readableAccessRequestBody.data.requestedBy, "researcher_partner_api_001");

  const readableDeliveries = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/deliveries`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableDeliveries.status, 200);
  const readableDeliveriesBody = await json<{ ok: true; data: Array<{ manifestId: string; channel: string }> }>(readableDeliveries);
  assert.equal(readableDeliveriesBody.data[0]?.manifestId, "cp_audit_export_manifest_partner_delivery_001");
  assert.equal(readableDeliveriesBody.data[0]?.channel, "audit_export_manifest");

  const readableDelivery = await app.request(`/canopyproof/data-access-deliveries/${deliveryBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableDelivery.status, 200);
  const readableDeliveryBody = await json<{ ok: true; data: { requestId: string; receiptHash: string } }>(readableDelivery);
  assert.equal(readableDeliveryBody.data.requestId, dataAccessBody.data.id);
  assert.match(readableDeliveryBody.data.receiptHash, /^[a-f0-9]{64}$/);

  const readableUseAttestations = await app.request(`/canopyproof/data-access-deliveries/${deliveryBody.data.id}/use-attestations`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableUseAttestations.status, 200);
  const readableUseAttestationsBody = await json<{ ok: true; data: Array<{ usageState: string; deliveryId: string }> }>(readableUseAttestations);
  assert.ok(readableUseAttestationsBody.data.some((attestation) => attestation.usageState === "within_scope"));
  assert.ok(readableUseAttestationsBody.data.some((attestation) => attestation.usageState === "misuse_challenged"));

  const readableUseAttestation = await app.request(`/canopyproof/data-use-attestations/${useAttestationBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableUseAttestation.status, 200);
  const readableUseAttestationBody = await json<{ ok: true; data: { deliveryId: string; attestationHash: string } }>(readableUseAttestation);
  assert.equal(readableUseAttestationBody.data.deliveryId, deliveryBody.data.id);
  assert.match(readableUseAttestationBody.data.attestationHash, /^[a-f0-9]{64}$/);

  const readableEnforcementCases = await app.request(`/canopyproof/data-use-attestations/${misuseChallengeBody.data.id}/enforcement-cases`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableEnforcementCases.status, 200);
  const readableEnforcementCasesBody = await json<{ ok: true; data: Array<{ caseState: string; attestationId: string }> }>(
    readableEnforcementCases,
  );
  assert.equal(readableEnforcementCasesBody.data[0]?.attestationId, misuseChallengeBody.data.id);
  assert.equal(readableEnforcementCasesBody.data[0]?.caseState, "remediation_required");

  const readableEnforcementCase = await app.request(`/canopyproof/data-use-enforcement-cases/${enforcementCaseBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableEnforcementCase.status, 200);
  const readableEnforcementCaseBody = await json<{ ok: true; data: { enforcementRoot: string; caseState: string } }>(readableEnforcementCase);
  assert.equal(readableEnforcementCaseBody.data.caseState, "remediation_required");
  assert.match(readableEnforcementCaseBody.data.enforcementRoot, /^[a-f0-9]{64}$/);

  const readableRestrictions = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/restrictions`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableRestrictions.status, 200);
  const readableRestrictionsBody = await json<{ ok: true; data: Array<{ restrictionState: string; requestId: string }> }>(readableRestrictions);
  assert.equal(readableRestrictionsBody.data[0]?.requestId, dataAccessBody.data.id);
  assert.equal(readableRestrictionsBody.data[0]?.restrictionState, "remediation_hold");

  const readableRestriction = await app.request(`/canopyproof/data-access-restrictions/${restrictionBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableRestriction.status, 200);
  const readableRestrictionBody = await json<{ ok: true; data: { restrictionRoot: string; restrictionState: string } }>(readableRestriction);
  assert.equal(readableRestrictionBody.data.restrictionState, "remediation_hold");
  assert.match(readableRestrictionBody.data.restrictionRoot, /^[a-f0-9]{64}$/);

  const readablePackets = await app.request(`/canopyproof/data-access-requests/${dataAccessBody.data.id}/accountability-packets`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readablePackets.status, 200);
  const readablePacketsBody = await json<{ ok: true; data: Array<{ id: string; requestId: string; packetRoot: string }> }>(readablePackets);
  assert.equal(readablePacketsBody.data[0]?.requestId, dataAccessBody.data.id);
  assert.match(readablePacketsBody.data[0]?.packetRoot ?? "", /^[a-f0-9]{64}$/);

  const readablePacket = await app.request(`/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readablePacket.status, 200);
  const readablePacketBody = await json<{ ok: true; data: { packetHash: string; safety: { noRawDataEmbedded: boolean } } }>(readablePacket);
  assert.match(readablePacketBody.data.packetHash, /^[a-f0-9]{64}$/);
  assert.equal(readablePacketBody.data.safety.noRawDataEmbedded, true);

  const readableVerifications = await app.request(`/canopyproof/data-access-accountability-packets/${accountabilityPacketBody.data.id}/verifications`, {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(readableVerifications.status, 200);
  const readableVerificationsBody = await json<{ ok: true; data: Array<{ packetId: string; valid: boolean; verificationRoot: string }> }>(
    readableVerifications,
  );
  assert.ok(readableVerificationsBody.data.some((verification) => verification.packetId === accountabilityPacketBody.data.id && !verification.valid));
  assert.match(readableVerificationsBody.data[0]?.verificationRoot ?? "", /^[a-f0-9]{64}$/);

  const readableVerification = await app.request(
    `/canopyproof/data-access-accountability-verifications/${cleanReplayBody.data.id}`,
    {
      headers: headers("observer", "observer_partner_reader"),
    },
  );
  assert.equal(readableVerification.status, 200);
  const readableVerificationBody = await json<{ ok: true; data: { packetId: string; valid: boolean } }>(readableVerification);
  assert.equal(readableVerificationBody.data.packetId, accountabilityPacketBody.data.id);
  assert.equal(readableVerificationBody.data.valid, true);

  const partnerStatus = await app.request("/canopyproof/partners/status", {
    headers: headers("observer", "observer_partner_reader"),
  });
  assert.equal(partnerStatus.status, 200);
  const partnerStatusBody = await json<{
    ok: true;
    data: {
      dataAccessRequestCount: number;
      revokedDataSharingAgreementCount: number;
      dataSharingAgreementRevocationCount: number;
      supersededDataSharingAgreementCount: number;
      dataSharingAgreementSupersessionCount: number;
      approvedDataAccessRequestCount: number;
      dataAccessDeliveryReceiptCount: number;
      dataUseAttestationCount: number;
      challengedDataUseAttestationCount: number;
      dataUseEnforcementCaseCount: number;
      openDataUseEnforcementCaseCount: number;
      dataAccessRestrictionCount: number;
      activeDataAccessRestrictionCount: number;
      dataAccessAccountabilityPacketCount: number;
      dataAccessAccountabilityVerificationCount: number;
      failedDataAccessAccountabilityVerificationCount: number;
      dataAccessAccountabilityDisclosureCount: number;
      staleDataAccessAccountabilityDisclosureCount: number;
      dataAccessAccountabilityDisclosureChallengeCount: number;
      openDataAccessAccountabilityDisclosureChallengeCount: number;
      dataAccessAccountabilityDisclosureResolutionCount: number;
      dataAccessAccountabilityDisclosureNoticeCount: number;
      withdrawnDataAccessAccountabilityDisclosureCount: number;
      correctedDataAccessAccountabilityDisclosureCount: number;
      countsAuthoritative: boolean;
      trustRegistry: {
        mode: "postgresql" | "development_memory";
        configured: boolean;
      };
      dataAccessRequestStatuses: string[];
      dataSharingAgreementTransitionTypes: string[];
      dataAccessDeliveryChannels: string[];
      dataUseAttestationStates: string[];
      dataUseEnforcementStates: string[];
      dataUseEnforcementActions: string[];
      dataAccessRestrictionStates: string[];
      dataAccessAccountabilityDisclosureStates: string[];
      dataAccessAccountabilityDisclosureGovernanceStates: string[];
      dataAccessAccountabilityDisclosureChallengeReasons: string[];
      dataAccessAccountabilityDisclosureResolutionDecisions: string[];
      dataAccessAccountabilityDisclosureRemedialActions: string[];
      dataAccessAccountabilityDisclosureNoticeTypes: string[];
    };
  }>(partnerStatus);
  assert.ok(partnerStatusBody.data.dataAccessRequestCount >= 1);
  assert.ok(partnerStatusBody.data.revokedDataSharingAgreementCount >= 1);
  assert.ok(partnerStatusBody.data.dataSharingAgreementRevocationCount >= 1);
  assert.ok(partnerStatusBody.data.supersededDataSharingAgreementCount >= 1);
  assert.ok(partnerStatusBody.data.dataSharingAgreementSupersessionCount >= 1);
  assert.ok(partnerStatusBody.data.approvedDataAccessRequestCount >= 1);
  assert.ok(partnerStatusBody.data.dataAccessDeliveryReceiptCount >= 1);
  assert.ok(partnerStatusBody.data.dataUseAttestationCount >= 2);
  assert.ok(partnerStatusBody.data.challengedDataUseAttestationCount >= 1);
  assert.ok(partnerStatusBody.data.dataUseEnforcementCaseCount >= 1);
  assert.ok(partnerStatusBody.data.openDataUseEnforcementCaseCount >= 1);
  assert.ok(partnerStatusBody.data.dataAccessRestrictionCount >= 1);
  assert.ok(partnerStatusBody.data.activeDataAccessRestrictionCount >= 1);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityPacketCount >= 1);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityVerificationCount >= 3);
  assert.deepEqual(partnerStatusBody.data.dataSharingAgreementTransitionTypes, ["renewal", "supersession"]);
  assert.ok(partnerStatusBody.data.failedDataAccessAccountabilityVerificationCount >= 2);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureCount >= 1);
  assert.ok(partnerStatusBody.data.staleDataAccessAccountabilityDisclosureCount >= 1);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureChallengeCount >= 1);
  assert.equal(partnerStatusBody.data.openDataAccessAccountabilityDisclosureChallengeCount, 0);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureResolutionCount >= 1);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureNoticeCount >= 1);
  assert.ok(partnerStatusBody.data.correctedDataAccessAccountabilityDisclosureCount >= 1);
  assert.equal(partnerStatusBody.data.countsAuthoritative, true);
  assert.equal(partnerStatusBody.data.trustRegistry.mode, "development_memory");
  assert.ok(partnerStatusBody.data.dataAccessRequestStatuses.includes("approved"));
  assert.ok(partnerStatusBody.data.dataAccessDeliveryChannels.includes("audit_export_manifest"));
  assert.ok(partnerStatusBody.data.dataUseAttestationStates.includes("misuse_challenged"));
  assert.ok(partnerStatusBody.data.dataUseEnforcementStates.includes("remediation_required"));
  assert.ok(partnerStatusBody.data.dataUseEnforcementActions.includes("require_remediation"));
  assert.ok(partnerStatusBody.data.dataAccessRestrictionStates.includes("remediation_hold"));
  assert.deepEqual(partnerStatusBody.data.dataAccessAccountabilityDisclosureStates, ["current", "stale"]);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureGovernanceStates.includes("correction_required"));
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureChallengeReasons.includes("privacy_risk"));
  assert.deepEqual(partnerStatusBody.data.dataAccessAccountabilityDisclosureResolutionDecisions, ["upheld", "dismissed", "needs_more_evidence"]);
  assert.ok(partnerStatusBody.data.dataAccessAccountabilityDisclosureRemedialActions.includes("publish_withdrawal_notice"));
  assert.deepEqual(partnerStatusBody.data.dataAccessAccountabilityDisclosureNoticeTypes, ["correction", "withdrawal"]);
});

test("CanopyProof partner SQL includes append-only data access request ledger controls", () => {
  const schema = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_requests/);
  assert.match(schema, /agreement_id text NOT NULL REFERENCES organizations\.data_sharing_agreements/);
  assert.match(schema, /humanDecisionRequired/);
  assert.match(schema, /notCarbonCredit/);
  assert.match(schema, /organizations_data_access_requests_no_update/);
  assert.match(schema, /organizations_data_access_requests_no_delete/);
  assert.match(schema, /organizations_data_access_requests_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_request_decisions/);
  assert.match(schema, /independentHumanDecision/);
  assert.match(schema, /UNIQUE \(request_id, previous_status\)/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_request_insert/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_request_decision_insert/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_semantic_event_binding/);
  assert.match(schema, /organizations_data_access_request_decisions_no_update/);
  assert.match(schema, /organizations_data_access_request_decisions_no_delete/);
  assert.match(schema, /organizations_data_access_request_decisions_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_sharing_agreement_revocations/);
  assert.match(schema, /futureAccessBlocked/);
  assert.match(schema, /futureDeliveryBlocked/);
  assert.match(schema, /organizations_data_sharing_agreement_revocations_no_update/);
  assert.match(schema, /organizations_data_sharing_agreement_revocations_no_delete/);
  assert.match(schema, /organizations_data_sharing_agreement_revocations_audit/);
  assert.match(schema, /organizations_data_sharing_agreement_revocations_agreement_unique/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_sharing_agreement_revocation/);
  assert.match(schema, /data-sharing agreement already has a revocation record/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_sharing_agreement_supersessions/);
  assert.match(schema, /transition_type text NOT NULL CHECK \(transition_type IN \('renewal', 'supersession'\)\)/);
  assert.match(schema, /scopeExpansionBlocked/);
  assert.match(schema, /privacyEscalationBlocked/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_sharing_agreement_supersession/);
  assert.match(schema, /organizations_data_sharing_agreement_supersessions_validate/);
  assert.match(schema, /organizations_data_sharing_agreement_supersessions_no_update/);
  assert.match(schema, /organizations_data_sharing_agreement_supersessions_no_delete/);
  assert.match(schema, /organizations_data_sharing_agreement_supersessions_audit/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_sharing_semantic_event_binding/);
  assert.match(schema, /data-sharing source row requires an exact semantic event binding/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_delivery_receipts/);
  assert.match(schema, /manifest_hash text NOT NULL/);
  assert.match(schema, /manifestHashOnly/);
  assert.match(schema, /data_access_delivery_manifest_organization_match/);
  assert.match(schema, /data_access_delivery_actor_separation/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_delivery_insert/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_delivery_receipt_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_delivery_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_delivery_payload_hash/);
  assert.match(schema, /data access delivery semantic event payload does not match the canonical receipt/);
  assert.match(schema, /data access delivery requires a currently approved request/);
  assert.match(schema, /data access delivery recipient lacks an active classification-appropriate membership/);
  assert.match(schema, /organizations_data_access_delivery_receipts_event_binding/);
  assert.match(schema, /data access source row requires an exact semantic event binding/);
  assert.match(schema, /organizations_data_access_delivery_receipts_no_update/);
  assert.match(schema, /organizations_data_access_delivery_receipts_no_delete/);
  assert.match(schema, /organizations_data_access_delivery_receipts_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_use_attestations/);
  assert.match(schema, /usage_state text NOT NULL CHECK \(usage_state IN \('within_scope', 'no_use', 'misuse_challenged', 'revocation_requested'\)\)/);
  assert.match(schema, /outputHashOnly/);
  assert.match(schema, /data_use_attestation_output_hashes_shape/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_use_attestation_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_use_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_use_attestation_payload_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_use_attestation_insert/);
  assert.match(schema, /positive and no-use attestations require the named delivery recipient/);
  assert.match(schema, /data use semantic event payload does not match the canonical attestation/);
  assert.match(schema, /organizations_data_use_attestations_event_binding/);
  assert.match(schema, /organizations_data_use_attestations_validate_insert/);
  assert.match(schema, /organizations_data_use_attestations_no_update/);
  assert.match(schema, /organizations_data_use_attestations_no_delete/);
  assert.match(schema, /organizations_data_use_attestations_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_use_enforcement_cases/);
  assert.match(schema, /case_state text NOT NULL CONSTRAINT data_use_enforcement_case_state CHECK/);
  assert.match(schema, /independentReviewerRequired/);
  assert.match(schema, /accessMutationRequiresSeparateApproval/);
  assert.match(schema, /data_use_enforcement_evidence_roots_shape/);
  assert.match(schema, /data_use_enforcement_safety_boundary/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_use_enforcement_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_use_enforcement_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_use_enforcement_payload_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_use_enforcement_case_insert/);
  assert.match(schema, /reviewer must be independent from attester, recipient, and delivery actor/);
  assert.match(schema, /must retain every challenged attestation evidence root/);
  assert.match(schema, /data use enforcement semantic event payload does not match the canonical case/);
  assert.match(schema, /organizations_data_use_enforcement_cases_event_binding/);
  assert.match(schema, /organizations_data_use_enforcement_cases_validate_insert/);
  assert.match(schema, /organizations_data_use_enforcement_cases_no_update/);
  assert.match(schema, /organizations_data_use_enforcement_cases_no_delete/);
  assert.match(schema, /organizations_data_use_enforcement_cases_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_restrictions/);
  assert.match(schema, /restriction_state text NOT NULL CONSTRAINT data_access_restriction_state CHECK/);
  assert.match(schema, /separateApprovalPath/);
  assert.match(schema, /deliveryBlockingEnforced/);
  assert.match(schema, /previous_restriction_id text REFERENCES organizations\.data_access_restrictions/);
  assert.match(schema, /organizations_data_access_restriction_initial_request/);
  assert.match(schema, /organizations_data_access_restriction_successor/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_restriction_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_restriction_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_restriction_payload_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_restriction_insert/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.data_access_request_is_restricted/);
  assert.match(schema, /must retain every enforcement evidence root/);
  assert.match(schema, /data access restriction semantic event payload does not match the canonical decision/);
  assert.match(schema, /organizations_data_access_restrictions_event_binding/);
  assert.match(schema, /organizations_data_access_restrictions_validate_insert/);
  assert.match(schema, /organizations_data_access_restrictions_no_update/);
  assert.match(schema, /organizations_data_access_restrictions_no_delete/);
  assert.match(schema, /organizations_data_access_restrictions_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_accountability_packets/);
  assert.match(schema, /agreementRevocationCount/);
  assert.match(schema, /agreementRevocationRoots/);
  assert.match(schema, /agreementSupersessionCount/);
  assert.match(schema, /agreementSupersessionRoots/);
  assert.match(schema, /appendOnlyLedgerDerived/);
  assert.match(schema, /hashOnlyLineage/);
  assert.match(schema, /data_access_accountability_packets_counts_shape/);
  assert.match(schema, /data_access_accountability_packets_lineage_shape/);
  assert.match(schema, /data_access_accountability_packets_safety_boundary/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.data_access_accountability_snapshot/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_packet_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_packet_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_packet_payload_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_accountability_packet_insert/);
  assert.match(schema, /snapshot does not match the complete event-bound ledger prefix/);
  assert.match(schema, /organizations_data_access_accountability_packets_event_binding/);
  assert.match(schema, /organizations_data_access_accountability_packets_validate_insert/);
  assert.match(schema, /organizations_data_access_accountability_packets_no_update/);
  assert.match(schema, /organizations_data_access_accountability_packets_no_delete/);
  assert.match(schema, /organizations_data_access_accountability_packets_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_accountability_verifications/);
  assert.match(schema, /valid boolean NOT NULL/);
  assert.match(schema, /verification_root text NOT NULL UNIQUE/);
  assert.match(schema, /data_access_accountability_verifications_issue_shape/);
  assert.match(schema, /data_access_accountability_verifications_safety_boundary/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_verification_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_verification_payload_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_accountability_verification_insert/);
  assert.match(schema, /fields do not match database-derived replay/);
  assert.match(schema, /organizations_data_access_accountability_verifications_event_binding/);
  assert.match(schema, /organizations_data_access_accountability_verifications_validate_insert/);
  assert.match(schema, /organizations_data_access_accountability_verifications_no_update/);
  assert.match(schema, /organizations_data_access_accountability_verifications_no_delete/);
  assert.match(schema, /organizations_data_access_accountability_verifications_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_accountability_disclosures/);
  assert.match(schema, /validReplayRequired/);
  assert.match(schema, /independentPublicationRequired/);
  assert.match(schema, /observerDiscoverable/);
  assert.match(schema, /data_access_accountability_disclosures_exact_safety/);
  assert.match(schema, /data_access_accountability_disclosures_timestamp_precision/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.data_access_accountability_disclosure_safety_canonical/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_payload_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.validate_data_access_accountability_disclosure/);
  assert.match(schema, /requires three separate human actors/);
  assert.match(schema, /packet lineage is stale at publication/);
  assert.match(schema, /semantic event payload does not match database replay/);
  assert.match(schema, /organizations_data_access_accountability_disclosures_event_binding/);
  assert.match(schema, /organizations_data_access_accountability_disclosures_validate/);
  assert.match(schema, /organizations_data_access_accountability_disclosures_no_update/);
  assert.match(schema, /organizations_data_access_accountability_disclosures_no_delete/);
  assert.match(schema, /organizations_data_access_accountability_disclosures_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_accountability_disclosure_challenges/);
  assert.match(schema, /humanResolutionRequired/);
  assert.match(schema, /data_access_accountability_disclosure_challenges_evidence_shape/);
  assert.match(schema, /data_access_accountability_disclosure_challenges_exact_safety/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.data_access_accountability_disclosure_challenge_safety_canonical/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_challenge_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_challenge_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_challenge_payload_hash/);
  assert.match(schema, /requires a verified human with the claimed durable role/);
  assert.match(schema, /evidence roots must bind prior semantic events/);
  assert.match(schema, /org_data_access_disclosure_challenge_event_binding/);
  assert.match(schema, /org_data_access_disclosure_challenge_validate/);
  assert.match(schema, /org_data_access_disclosure_challenge_no_update/);
  assert.match(schema, /org_data_access_disclosure_challenge_no_delete/);
  assert.match(schema, /org_data_access_disclosure_challenge_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_accountability_disclosure_resolutions/);
  assert.match(schema, /independentHumanReviewRequired/);
  assert.match(schema, /noAutomatedFinalAuthority/);
  assert.match(schema, /data_access_disclosure_resolution_evidence_shape/);
  assert.match(schema, /data_access_disclosure_resolution_exact_safety/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.data_access_accountability_disclosure_resolution_safety_canonical/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_resolution_hash/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_resolution_root/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION organizations\.compute_data_access_accountability_disclosure_resolution_payload_hash/);
  assert.match(schema, /org_data_access_disclosure_resolution_validate/);
  assert.match(schema, /org_data_access_disclosure_resolution_event_binding/);
  assert.match(schema, /org_data_access_disclosure_resolution_one_root/);
  assert.match(schema, /org_data_access_disclosure_resolution_one_successor/);
  assert.match(schema, /org_data_access_disclosure_resolution_one_final/);
  assert.match(schema, /org_data_access_disclosure_resolution_no_update/);
  assert.match(schema, /org_data_access_disclosure_resolution_no_delete/);
  assert.match(schema, /org_data_access_disclosure_resolution_audit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS organizations\.data_access_accountability_disclosure_notices/);
  assert.match(schema, /originalDisclosurePreserved/);
  assert.match(schema, /data_access_accountability_disclosure_notice_safety_canonical/);
  assert.match(schema, /compute_data_access_accountability_disclosure_notice_hash/);
  assert.match(schema, /compute_data_access_accountability_disclosure_notice_root/);
  assert.match(schema, /compute_data_access_accountability_disclosure_notice_payload_hash/);
  assert.match(schema, /data_access_accountability_disclosure_governance_state_at/);
  assert.match(schema, /org_data_access_disclosure_notice_validate/);
  assert.match(schema, /org_data_access_disclosure_notice_event_binding/);
  assert.match(schema, /org_data_access_disclosure_notice_no_update/);
  assert.match(schema, /org_data_access_disclosure_notice_no_delete/);
  assert.match(schema, /org_data_access_disclosure_notice_audit/);
});

function readablePacketsRoot(accessRoot: string, packetId: string) {
  return `${accessRoot.slice(0, 32)}${packetId.replace(/^cp_data_access_packet_/, "").slice(0, 32)}`.padEnd(64, "0").slice(0, 64);
}
